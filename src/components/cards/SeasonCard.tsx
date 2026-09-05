import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { TIERS, tierFor, seasonId, TIER_REWARDS, seasonProgress } from '../../game/season';
import { seasonTheme, getCurrentSeason } from '../../game/artifact';
import { item } from '../../game/items';
import { watchSeasonLadder, type LeaderRow } from '../../firebase/socialService';
import { PASS_TIERS, claimPassTier, isTierClaimed, isTierReached, tierRewardLabels } from '../../game/seasonpass';
import { playSound } from '../../game/sound';

function rewardText(r: { gold: number; fateCoins: number; gems?: number; items?: Record<string, number> }): string {
  const parts = [`${r.gold.toLocaleString()} 🪙`, `${r.fateCoins} 🎲`];
  if (r.gems) parts.push(`${r.gems} 💎`);
  if (r.items) for (const [id, q] of Object.entries(r.items)) parts.push(`${item(id)?.icon ?? ''}×${q}`);
  return parts.join(' · ');
}

export default function SeasonCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [ladder, setLadder] = useState<LeaderRow[]>([]);
  const sid = seasonId();

  useEffect(() => watchSeasonLadder(sid, 15, setLadder), [sid]);
  if (!p) return null;

  // Une seule jauge de saison : le niveau d'artefact. Il monte sur TOUT
  // (chasse, donjon, récolte, forge, camp, PvP) et pilote à la fois le rang et
  // la passe. Les « points de saison » PvP n'existent plus.
  const pts = seasonProgress(p);
  const { tier, next, into, span } = tierFor(pts);

  const season = getCurrentSeason();
  const theme = seasonTheme(season);
  const artLevel = p.artifact?.level ?? 0;

  function claim(i: number) {
    let out: true | string = 'Erreur inconnue';
    mutate((d) => { out = claimPassTier(d, i, season); });
    const res = out as true | string;
    if (res === true) { playSound('coin'); toast('Palier réclamé !', 'gold'); }
    else toast(res, 'bad');
  }

  return (
    <div className="space-y-3">
      {/* Rang actuel */}
      <div className="rounded-xl bg-black/25 p-3 text-center">
        <div className="text-3xl">{tier.icon}</div>
        <div className="text-lg font-bold" style={{ color: tier.color }}>{tier.name}</div>
        <div className="text-xs text-slate-400">Artefact niveau {pts}</div>
        {next ? (
          <>
            <div className="mt-2 h-2 rounded bg-black/40">
              <div className="h-2 rounded transition-all" style={{ width: `${Math.min(100, (into / span) * 100)}%`, background: tier.color }} />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{next.icon} {next.name} à l'artefact Nv.{next.min}</div>
          </>
        ) : (
          <div className="mt-1 text-[10px] text-purple-300">Rang maximum atteint 👑</div>
        )}
      </div>

      {/* La saison n'a plus de date de fin : elle tourne quand elle tourne. Un
          compte à rebours vers le 1er du mois affichait une échéance qui ne
          voulait plus rien dire. */}
      <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs">
        <span className="text-slate-400">Saison en cours</span>
        <span className="font-semibold" style={{ color: theme.color }}>{theme.emoji} Saison {season} · {theme.name}</span>
      </div>

      {/* La question « quelle jauge monte avec quoi ? » revenait sans arrêt :
          autant y répondre ici, une fois, en toutes lettres. */}
      <div className="rounded-lg bg-black/25 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Une seule jauge de saison</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Ton <b className="text-slate-200">niveau d'artefact</b> EST ta progression de saison. Il monte sur
          <b className="text-slate-200"> tout ce que tu fais</b> — chasse, donjon, récolte, forge, camp, et
          désormais les victoires PvP. C'est lui qui donne ton rang ci-dessus, qui remplit la passe
          ci-dessous, et qui débloque les mods de l'artefact.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          À la rotation : artefact, rang, passe et records d'Abysses repartent à zéro.
          <b className="text-slate-200"> Ton personnage n'est jamais touché</b> — niveau, équipement,
          métiers, maîtrises et Relique traversent.
        </p>
      </div>

      {/* Passe de saison — gratuite. Elle se remplit sur le niveau d'artefact,
          qui monte déjà sur tout ce que fait le joueur et repart à zéro à
          chaque rotation : c'est exactement la forme d'une piste saisonnière. */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">🎟️ Passe de saison · gratuite</span>
          <span className="text-[11px] text-slate-400">
            Artefact <b className="tabular-nums text-slate-200">Nv.{artLevel}</b>
          </span>
        </div>
        <div className="space-y-1.5">
          {PASS_TIERS.map((t, i) => {
            const reached = isTierReached(p, i);
            const claimed = isTierClaimed(p, i);
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 rounded-lg p-2 ${
                  claimed ? 'bg-emerald-500/10' : reached ? 'bg-amber-500/15' : 'bg-black/25'
                }`}
              >
                <span className={`w-10 shrink-0 text-center text-[11px] font-bold tabular-nums ${reached ? 'text-amber-300' : 'text-slate-500'}`}>
                  Nv.{t.level}
                </span>
                <span className={`min-w-0 flex-1 text-[11px] ${reached ? 'text-slate-200' : 'text-slate-500'}`}>
                  {tierRewardLabels(t, season).join(' · ')}
                </span>
                {claimed ? (
                  <span className="shrink-0 text-[11px] font-bold text-emerald-300">✓</span>
                ) : reached ? (
                  <button
                    onClick={() => claim(i)}
                    className="shrink-0 rounded bg-amber-500/40 px-2 py-1 text-[11px] font-bold text-amber-100 hover:bg-amber-500/60"
                  >
                    Réclamer
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] text-slate-600">🔒</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
