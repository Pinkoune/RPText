import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { COMMANDS, runCommand, resolveCommand } from '../game/commands';
import { playSound } from '../game/sound';
import { item, RARITY_COLOR } from '../game/items';
import { deriveStats, removeItem } from '../game/player';
import ItemIcon from './ItemIcon';

export default function CommandBar() {
  const [value, setValue] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHealPopup, setShowHealPopup] = useState(false);

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
      // Exception : les champs de saisie du chat/équipe gardent l'Entrée pour eux.
      if (el?.closest('[data-keep-enter]')) return;
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const p = getPlayer();
    const lvl = p ? p.level : 0;
    return COMMANDS.filter(
      (c) => (c.name.startsWith(q) || c.aliases.some((a) => a.startsWith(q))) &&
             (!c.reqLevel || lvl >= c.reqLevel)
    ).slice(0, 5);
  }, [value, getPlayer]);

  // Réinitialiser la sélection de suggestion quand la valeur change
  useEffect(() => {
    setSuggIdx(0);
    if (value) setShowHealPopup(false);
  }, [value]);

  const healItems = useMemo(() => {
    if (!showHealPopup) return [];
    const p = getPlayer();
    if (!p) return [];
    return Object.entries(p.inventory)
      .filter(([id, qty]) => qty > 0 && item(id)?.hp && item(id)?.slot === 'consumable')
      .map(([id, qty]) => ({ ...item(id)!, id, qty }));
  }, [showHealPopup, getPlayer]);

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    playSound('click');
    const resolved = resolveCommand(text);
    if (resolved === 'close') {
      closeAll();
    } else if (resolved === 'heal' && text.split(/\s+/).length === 1) {
      if (useGame.getState().inCombat) {
        toast("Impossible de se soigner avec la commande pendant un combat !", "bad");
      } else {
        setShowHealPopup(true);
        setValue('');
      }
      return;
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
        {/* Suggestions ou Heal Popup */}
        {showHealPopup ? (
          <div className="mb-2 overflow-hidden rounded-xl glass p-2 max-h-48 overflow-y-auto pointer-events-auto">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-sm font-semibold text-emerald-400">Choisis quoi consommer :</span>
              <button onClick={() => setShowHealPopup(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {healItems.length === 0 ? (
              <div className="text-xs text-slate-400 px-1 pb-1">Aucune potion ou nourriture dans l'inventaire.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {healItems.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      setShowHealPopup(false);
                      runCommand(`heal ${it.id}`, { getPlayer, mutate, open, toast });
                    }}
                    className="flex items-center gap-2 rounded bg-black/20 p-2 text-left hover:bg-black/40 transition"
                  >
                    <ItemIcon id={it.id} size={24} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>
                        {it.name} <span className="text-xs text-slate-400">×{it.qty}</span>
                      </div>
                      <div className="text-[10px] text-emerald-300">+{it.hp} PV</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : suggestions.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-xl glass pointer-events-auto">
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
            placeholder='Tape une commande… ("hunt", "map", "profile", "help")'
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
