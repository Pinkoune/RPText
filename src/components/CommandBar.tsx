import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { COMMANDS, runCommand, resolveCommand } from '../game/commands';
import { playSound } from '../game/sound';

export default function CommandBar() {
  const [value, setValue] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useUi((s) => s.open);
  const closeAll = useUi((s) => s.closeAll);
  const getPlayer = () => useGame.getState().player;
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [suggIdx, setSuggIdx] = useState(0);

  // Touche Entrée n'importe où → recible la barre d'écriture.
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (el === inputRef.current) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (el?.isContentEditable) return;
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return COMMANDS.filter(
      (c) => c.name.startsWith(q) || c.aliases.some((a) => a.startsWith(q)),
    ).slice(0, 5);
  }, [value]);

  // Réinitialiser la sélection de suggestion quand la valeur change
  useEffect(() => {
    setSuggIdx(0);
  }, [value]);

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    playSound('click');
    if (resolveCommand(text) === 'close') {
      closeAll();
    } else {
      runCommand(text, { getPlayer, mutate, open, toast });
    }
    setHist((h) => [text, ...h].slice(0, 30));
    setHIdx(-1);
    setValue('');
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      submit(suggestions[suggIdx] && !value.includes(' ') ? suggestions[suggIdx].name : value);
    } else if (e.key === 'Tab' && suggestions[suggIdx]) {
      e.preventDefault();
      setValue(suggestions[suggIdx].name);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSuggIdx((i) => Math.max(0, i - 1));
      } else {
        const ni = Math.min(hist.length - 1, hIdx + 1);
        if (hist[ni]) { setHIdx(ni); setValue(hist[ni]); }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSuggIdx((i) => Math.min(suggestions.length - 1, i + 1));
      } else {
        const ni = Math.max(-1, hIdx - 1);
        setHIdx(ni); setValue(ni === -1 ? '' : hist[ni]);
      }
    } else if (e.key === 'Escape') {
      closeAll();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto w-full max-w-2xl">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-xl glass">
            {suggestions.map((c, i) => (
              <button
                key={c.name}
                onClick={() => { setValue(c.name); inputRef.current?.focus(); }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  i === suggIdx ? 'bg-white/15' : ''
                } hover:bg-white/20`}
              >
                <span className="font-semibold">{c.name}</span>
                <span className="ml-3 truncate text-xs text-slate-400">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl glass px-3 py-2.5">
          <span className="text-slate-400">›</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder='Tape une commande… ("hunt", "map", "casino", "help")'
            className="w-full bg-transparent text-base outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => submit(value)}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold transition hover:bg-sky-400"
          >
            ⏎
          </button>
        </div>
      </div>
    </div>
  );
}
