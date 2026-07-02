import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { TIERS, tierFor, seasonId, nextSeasonAt, SEASON_POINTS, TIER_REWARDS } from '../../game/season';
import { item } from '../../game/items';
import { watchSeasonLadder, type LeaderRow } from '../../firebase/socialService';

function rewardText(r: { gold: number; fateCoins: number; gems?: number; items?: Record<string, number> }): string {
  const parts = [`${r.gold.toLocaleString()} 🪙`, `${r.fateCoins} 🎲`];
  if (r.gems) parts.push(`${r.gems} 💎`);
  if (r.items) for (const [id, q] of Object.entries(r.items)) parts.push(`${item(id)?.icon ?? ''}×${q}`);
  return parts.join(' · ');
}

export default function SeasonCard() {
  const p = useGame((s) => s.player);
  const [ladder, setLadder] = useState<LeaderRow[]>([]);
  const sid = seasonId();

  useEffect(() => watchSeasonLadder(sid, 15, setLadder), [sid]);
  if (!p) return null;

  const pts = p.seasonPoints ?? 0;
  const { tier, next, into, span } = tierFor(pts);

  const remain = Math.max(0, nextSeasonAt() - Date.now());
  const days = Math.floor(remain / 86_400_000);
  const hours = Math.floor((remain % 86_400_000) / 3_600_000);

  return (
    <div className="space-y-3">
      {/* Rang actuel */}
      <div className="rounded-xl bg-black/25 p-3 text-center">
        <div className="text-3xl">{tier.icon}</div>
        <div className="text-lg font-bold" style={{ color: tier.color }}>{tier.name}</div>
        <div className="text-xs text-slate-400">{pts} points de saison</div>
        {next ? (
          <>
            <div className="mt-2 h-2 rounded bg-black/40">
              <div className="h-2 rounded transition-all" style={{ width: `${Math.min(100, (into / span) * 100)}%`, background: tier.color }} />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{next.icon} {next.name} dans {next.min - pts} pts</div>
          </>
        ) : (
          <div className="mt-1 text-[10px] text-purple-300">Rang maximum atteint 👑</div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs text-slate-400">
        <span>Fin de saison</span>
        <span className="tabular-nums text-slate-300">{days}j {hours}h</span>
      </div>

      <p className="text-[11px] text-slate-500">
        Gagne des points en PvP : duel gagné <b className="text-slate-300">+{SEASON_POINTS.duelWin}</b>, Card-Jitsu gagné <b className="text-slate-300">+{SEASON_POINTS.cjWin}</b>. Tout se réinitialise chaque mois.
      </p>

      {/* Ladder */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ladder de la saison</div>
        {ladder.length === 0 ? (
          <p className="text-xs text-slate-500">Personne n'a encore marqué de points ce mois-ci. Sois le premier !</p>
        ) : (
          <div className="space-y-1">
            {ladder.map((r, i) => {
              const t = tierFor(r.seasonPoints ?? 0).tier;
              const isMe = r.uid === p.uid;
              return (
                <div key={r.uid} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${isMe ? 'bg-sky-500/20' : 'bg-black/25'}`}>
                  <span className="min-w-0 truncate">
                    <span className="text-slate-500">{i + 1}.</span> {t.icon} {r.name}{isMe ? ' (toi)' : ''}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: t.color }}>{r.seasonPoints} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Récompenses de fin de saison par rang */}
      <div className="rounded-lg bg-black/20 p-2">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Récompenses de fin de saison</div>
        <div className="space-y-1">
          {TIERS.map((t) => {
            const reached = pts >= t.min;
            return (
              <div key={t.name} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-[11px] ${reached ? 'bg-white/5' : 'opacity-60'}`}>
                <span className="shrink-0 font-semibold" style={{ color: t.color }}>{t.icon} {t.name} <span className="text-slate-500">({t.min}+)</span></span>
                <span className="min-w-0 truncate text-right text-slate-300">{rewardText(TIER_REWARDS[t.name])}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10px] text-slate-500">Créditées automatiquement à la fin du mois selon ton rang atteint.</div>
      </div>
    </div>
  );
}
