import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { DUNGEONS, runDungeon, dungeonCooldownLeft, type DungeonDef, type DungeonRun } from '../../game/dungeons';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { playSound } from '../../game/sound';

function fmt(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m}min`;
}

export default function DungeonCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [, tick] = useState(0);
  const [run, setRun] = useState<DungeonRun | null>(null);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!p) return null;

  function enter(def: DungeonDef) {
    const holder: { res: ReturnType<typeof runDungeon> | null } = { res: null };
    mutate((d) => { holder.res = runDungeon(d, def); });
    const res = holder.res;
    if (res && 'error' in res) {
      toast(res.error, 'bad');
      return;
    }
    if (res) {
      setRun(res);
      if (res.success) {
        playSound(res.levelsGained > 0 ? 'levelup' : 'win');
        if (res.levelsGained > 0) useGame.getState().celebrateLevelUp();
      } else {
        playSound('lose');
      }
    }
  }

  // ── Vue résultat ──
  if (run) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-lg font-bold">{run.def.emoji} {run.def.name}</div>
        <div className="space-y-1">
          {run.stages.map((s, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${s.victory ? 'bg-emerald-500/10' : 'bg-rose-500/15'}`}>
              <span>{s.monster.emoji} {s.monster.name}</span>
              <span className="text-xs">{s.victory ? `✓ PV restants ${Math.round(s.endHp)}` : '✗ vaincu'}</span>
            </div>
          ))}
        </div>

        {run.success ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-3">
            <div className="font-bold text-amber-300">Donjon conquis ! 🏆</div>
            <div className="mt-1 text-sm">
              +{run.xp} XP · +{run.gold} 🪙 · +{run.fateCoins} 🎲{run.gems ? ` · +${run.gems} 💎` : ''}
              {run.levelsGained > 0 && <span className="ml-2 font-bold text-amber-300">⬆ Niveau +{run.levelsGained}</span>}
            </div>
            {run.loot.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {run.loot.map((id, i) => (
                  <span key={i} className="rounded px-2 py-0.5 text-xs" style={{ background: `${RARITY_COLOR[ITEMS[id].rarity]}22`, color: RARITY_COLOR[ITEMS[id].rarity] }}>
                    {ITEMS[id].icon} {ITEMS[id].name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 p-3 text-sm">
            <div className="font-bold text-rose-300">Échec… 💀</div>
            <div className="mt-1 text-slate-300">Tu es tombé à l'étape {(run.failedAt ?? 0) + 1}. Reviens mieux équipé et soigné.</div>
          </div>
        )}

        <button onClick={() => setRun(null)} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">← Retour aux donjons</button>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Donjons à étapes : enchaîne les combats, les PV ne se régénèrent pas entre les salles.
        Soigne-toi avant d'entrer. Longue récupération entre deux runs.
      </p>
      {DUNGEONS.map((def) => {
        const locked = p.level < def.minLevel;
        const left = dungeonCooldownLeft(p, def);
        const clears = p.dungeonClears?.[def.id] ?? 0;
        return (
          <div key={def.id} className="rounded-xl bg-black/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{def.emoji} {def.name}</div>
                <div className="text-[11px] text-slate-400">{def.desc}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {def.stages.length} salles · Nv.{def.minLevel}+ · récup. {fmt(def.cooldownMs)}{clears > 0 ? ` · ${clears} clear${clears > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <button
                onClick={() => enter(def)}
                disabled={locked || left > 0}
                className="shrink-0 rounded-lg bg-purple-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-purple-500/60 disabled:opacity-40"
              >
                {locked ? `🔒 Nv.${def.minLevel}` : left > 0 ? `⏳ ${fmt(left)}` : 'Entrer'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
