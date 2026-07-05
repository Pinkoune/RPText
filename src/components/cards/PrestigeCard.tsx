import { useGame } from '../../store/gameStore';
import { PRESTIGE_AURAS } from '../../game/prestige';

export default function PrestigeCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const current = p.prestigeAura ?? '';
  const colorOn = p.auraColorOn ?? true;
  const currentDef = PRESTIGE_AURAS.find((a) => a.emoji === current);

  function choose(emoji: string) {
    mutate((d) => { d.prestigeAura = d.prestigeAura === emoji ? undefined : emoji; });
    toast(current === emoji ? 'Aura retirée.' : `Aura ${emoji} équipée !`, 'good');
  }

  function toggleColor() {
    mutate((d) => { d.auraColorOn = !(d.auraColorOn ?? true); });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-black/30 p-3">
        <div className="text-sm font-semibold text-amber-200">✨ Aura de prestige</div>
        <div className="mt-1 text-[11px] text-slate-400">
          Symbole affiché à côté de ton nom au classement — <b className="text-amber-200">et petit bonus passif</b>. Une seule active.
        </div>
        <div className="mt-2 text-sm">Actuelle : <span className="text-lg">{current || '—'}</span></div>

        {current && (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={colorOn} onChange={toggleColor} className="accent-amber-400" />
            Colorer mon pseudo {currentDef && <span style={{ color: currentDef.color }} className="font-semibold">(exemple)</span>}
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        {PRESTIGE_AURAS.map((a) => {
          const active = current === a.emoji;
          return (
            <button
              key={a.emoji}
              onClick={() => choose(a.emoji)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${active ? 'bg-amber-500/25 ring-1 ring-amber-400' : 'bg-black/25 hover:bg-white/10'}`}
            >
              <span className="text-2xl leading-none">{a.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-200">{a.label}</div>
                <div className="text-[11px]" style={{ color: a.color }}>{a.desc}</div>
              </div>
              {active && <span className="text-[11px] font-bold text-amber-300">✓ actif</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
