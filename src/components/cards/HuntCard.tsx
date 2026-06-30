import { useEffect, useState } from 'react';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { playSound } from '../../game/sound';
import { useGame } from '../../store/gameStore';
import type { CombatLog } from '../../game/combat';

export default function HuntCard({ log }: { log: CombatLog }) {
  const [shown, setShown] = useState(0);

  // Révèle les tours du combat un par un pour l'effet "live".
  useEffect(() => {
    setShown(0);
    const t = setInterval(() => {
      setShown((s) => {
        if (s >= log.rounds.length) {
          clearInterval(t);
          return s;
        }
        return s + 1;
      });
    }, 600);
    return () => clearInterval(t);
  }, [log]);

  const done = shown >= log.rounds.length;
  const m = log.monster;

  useEffect(() => {
    if (!done || log.rounds.length === 0) return;
    if (log.levelsGained > 0) {
      playSound('levelup');
      useGame.getState().celebrateLevelUp();
    } else if (log.victory) playSound('win');
    else playSound('lose');
  }, [done]);

  const last = shown > 0 ? log.rounds[Math.min(shown, log.rounds.length) - 1] : null;
  const php = last ? last.playerHp : log.playerMaxHp;
  const mhp = last ? last.monsterHp : log.monsterMaxHp;
  const phpPct = Math.max(0, (php / log.playerMaxHp) * 100);
  const mhpPct = Math.max(0, (mhp / log.monsterMaxHp) * 100);

  return (
    <div className="space-y-3">
      {/* HUD de combat : héros vs monstre */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded-lg bg-black/25 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">⚔️ Toi</span>
            <span className="tabular-nums text-slate-400">{Math.round(php)}/{log.playerMaxHp}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-black/40">
            <div className={`h-2 rounded transition-all duration-200 ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${phpPct}%` }} />
          </div>
        </div>
        <div className="grid place-items-center text-xs text-slate-500">VS</div>
        <div className="flex-1 rounded-lg bg-black/25 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">{m.emoji} {m.name}</span>
            <span className="tabular-nums text-slate-400">{Math.max(0, Math.round(mhp))}/{log.monsterMaxHp}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-black/40">
            <div className="h-2 rounded bg-orange-400 transition-all duration-200" style={{ width: `${mhpPct}%` }} />
          </div>
        </div>
      </div>

      <div className="max-h-40 space-y-1 overflow-auto rounded-lg bg-black/30 p-2 text-sm">
        {log.rounds.slice(0, shown).map((r, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span className={r.text.startsWith('Tu') ? 'text-sky-300' : 'text-rose-300'}>{r.text}</span>
            <span className="shrink-0 text-xs text-slate-500">
              ❤{r.playerHp} · {m.emoji}{r.monsterHp}
            </span>
          </div>
        ))}
      </div>

      {done && (
        <div className="animate-floatIn space-y-2">
          {log.victory ? (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-3">
              <div className="font-bold text-emerald-300">Victoire ! 🎉</div>
              <div className="mt-1 text-sm">
                +{log.xp} XP · +{log.gold} 🪙
                {log.levelsGained > 0 && (
                  <span className="ml-2 font-bold text-amber-300">⬆ Niveau +{log.levelsGained} !</span>
                )}
              </div>
              {log.loot.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {log.loot.map((id, i) =>
                    id === '__fate' ? (
                      <span key={i} className="rounded bg-purple-500/25 px-2 py-0.5 text-xs">🎲 +1 Fate Coin</span>
                    ) : (
                      <span
                        key={i}
                        className="rounded px-2 py-0.5 text-xs"
                        style={{ background: `${RARITY_COLOR[ITEMS[id].rarity]}22`, color: RARITY_COLOR[ITEMS[id].rarity] }}
                      >
                        {ITEMS[id].icon} {ITEMS[id].name}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-3">
              <div className="font-bold text-rose-300">Défaite… 💀</div>
              <div className="mt-1 text-sm text-slate-300">
                Tu perds 10% de ton or et reviens à 30% PV. Soigne-toi avant de repartir.
              </div>
            </div>
          )}
          <div className="text-center text-xs text-slate-500">Tape « hunt » pour repartir (cooldown 90s).</div>
        </div>
      )}
    </div>
  );
}
