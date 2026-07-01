import { useGame } from '../../store/gameStore';
import { questViews, claimQuest, periodResetIn, type QuestReward, type QuestPeriod } from '../../game/quests';
import { cooldownLeft } from '../../game/player';
import { DAILY_COOLDOWN } from '../../game/commands';

import { ITEMS } from '../../game/items';

function rewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${r.gold} 🪙`);
  if (r.fateCoins) parts.push(`${r.fateCoins} 🎲`);
  if (r.gems) parts.push(`${r.gems} 💎`);
  if (r.items) {
    for (const [id, qty] of Object.entries(r.items)) {
      const it = ITEMS[id];
      if (it) parts.push(`${qty}x ${it.icon} ${it.name}`);
    }
  }
  return parts.join(' · ');
}

function fmt(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function QuestsCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const views = questViews(p);
  const dailyReady = cooldownLeft(p, 'daily', DAILY_COOLDOWN) === 0;

  function claim(id: string) {
    let r: QuestReward | null = null;
    mutate((d) => { r = claimQuest(d, id); });
    if (r) toast(`Récompense : ${rewardText(r)} !`, 'gold');
  }

  function claimLogin() {
    const gold = 50 + p!.level * 20;
    mutate((d) => {
      d.gold += gold;
      d.fateCoins += 3;
      d.cooldowns.daily = Date.now();
    });
    toast(`Connexion quotidienne : +${gold} 🪙, +3 🎲 !`, 'gold');
  }

  const section = (period: QuestPeriod, title: string) => (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</span>
        <span className="text-[10px] text-slate-500">reset dans {fmt(periodResetIn(p!, period))}</span>
      </div>
      <div className="space-y-1.5">
        {views.filter((v) => v.def.period === period).map((v) => (
          <div key={v.def.id} className="rounded-lg bg-black/25 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{v.def.label}</span>
              {v.claimed ? (
                <span className="shrink-0 text-xs text-emerald-400">✓ réclamé</span>
              ) : v.complete ? (
                <button onClick={() => claim(v.def.id)} className="shrink-0 rounded bg-amber-500/40 px-2 py-1 text-xs font-semibold hover:bg-amber-500/60">
                  Réclamer
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 text-right leading-tight max-w-[50%]">{rewardText(v.def.reward)}</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded bg-black/40">
                <div
                  className={`h-1.5 rounded ${v.complete ? 'bg-emerald-400' : 'bg-sky-400'}`}
                  style={{ width: `${(v.progress / v.def.target) * 100}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-slate-400">{v.progress}/{v.def.target}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <button
        onClick={claimLogin}
        disabled={!dailyReady}
        className="w-full rounded-xl bg-gradient-to-r from-amber-500/40 to-yellow-500/40 px-4 py-2.5 text-sm font-semibold transition hover:from-amber-500/60 hover:to-yellow-500/60 disabled:opacity-40"
      >
        {dailyReady ? '🎁 Récompense de connexion quotidienne' : `🎁 Déjà réclamée — revient dans ${fmt(cooldownLeft(p, 'daily', DAILY_COOLDOWN))}`}
      </button>
      {section('daily', 'Quêtes journalières')}
      {section('weekly', 'Quêtes hebdomadaires')}
    </div>
  );
}
