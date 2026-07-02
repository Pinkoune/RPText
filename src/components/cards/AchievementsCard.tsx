import { useGame } from '../../store/gameStore';
import { ACHIEVEMENTS, isUnlocked, isClaimed, claimAchievement } from '../../game/achievements';

export default function AchievementsCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function claim(id: string, label: string) {
    let ok = false;
    mutate((d) => { ok = claimAchievement(d, id); });
    if (ok) toast(`Succès réclamé ! Récompense : ${label}`, 'good');
  }

  // Tri : réclamables d'abord, puis en cours, puis déjà réclamés.
  const rows = [...ACHIEVEMENTS].sort((a, b) => {
    const sa = isClaimed(p, a.id) ? 2 : isUnlocked(p, a) ? 0 : 1;
    const sb = isClaimed(p, b.id) ? 2 : isUnlocked(p, b) ? 0 : 1;
    return sa - sb;
  });

  const done = ACHIEVEMENTS.filter((a) => isClaimed(p, a.id)).length;

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">{done} / {ACHIEVEMENTS.length} succès débloqués</div>
      <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
        {rows.map((a) => {
          const val = a.value(p);
          const unlocked = val >= a.goal;
          const claimed = isClaimed(p, a.id);
          const pct = Math.min(100, (val / a.goal) * 100);
          return (
            <div key={a.id} className={`rounded-lg p-2.5 ${claimed ? 'bg-emerald-500/10' : 'bg-black/25'}`}>
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none mt-0.5">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    {claimed && <span className="text-[10px] text-emerald-300">✅ réclamé</span>}
                  </div>
                  <div className="text-[11px] text-slate-400">{a.desc}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${unlocked ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-500">{Math.min(val, a.goal)}/{a.goal}</span>
                  </div>
                </div>
                <div className="shrink-0 self-center">
                  {claimed ? (
                    <span className="text-[10px] text-slate-500">{a.rewardLabel}</span>
                  ) : unlocked ? (
                    <button onClick={() => claim(a.id, a.rewardLabel)} className="rounded bg-amber-500/30 px-2.5 py-1 text-xs font-semibold hover:bg-amber-500/50">
                      Réclamer
                    </button>
                  ) : (
                    <span className="rounded bg-black/30 px-2 py-1 text-[10px] text-amber-200/80">{a.rewardLabel}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
