import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { playSound } from '../../game/sound';
import {
  getRelic,
  relicTier,
  relicStarCost,
  effectsForStar,
  relicEffect,
  upgradeRelic,
  RELIC_MAX_STARS,
  RELIC_STAT_STARS,
  RELIC_STAT_PER_STAR,
  RELIC_SHARD_SOURCES,
  type RelicEffectDef,
} from '../../game/relic';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Rangée d'étoiles : pleines, prochaine, et à venir. */
function Stars({ stars, color }: { stars: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {Array.from({ length: RELIC_MAX_STARS }).map((_, i) => (
        <span
          key={i}
          className={`text-base leading-none ${i < stars ? '' : 'opacity-25'}`}
          style={{ color: i < stars ? color : '#64748b' }}
          title={i < RELIC_STAT_STARS ? `Étoile ${i + 1} — statistiques` : `Étoile ${i + 1} — effet au choix`}
        >
          {i < RELIC_STAT_STARS ? '★' : '✦'}
        </span>
      ))}
    </div>
  );
}

export default function RelicCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [picked, setPicked] = useState<string | null>(null);
  if (!p) return null;

  const relic = getRelic(p);
  const tier = relicTier(relic.stars);
  const shards = p.relicShards ?? 0;
  const maxed = relic.stars >= RELIC_MAX_STARS;
  const cost = relicStarCost(relic.stars);
  const nextStar = relic.stars + 1;
  const isEffectStar = nextStar > RELIC_STAT_STARS;
  const choices = isEffectStar ? effectsForStar(nextStar) : [];
  const chosen: RelicEffectDef[] = relic.effects.map(relicEffect).filter(Boolean) as RelicEffectDef[];
  const canAfford = shards >= cost;

  function forge() {
    // `mutate` prend un callback : TypeScript ne suit pas l'affectation à
    // travers la fermeture, d'où la relecture explicite (même motif que
    // TalentCard avec `spendTalent`).
    let out: true | string = 'Erreur inconnue';
    mutate((d) => { out = upgradeRelic(d, picked ?? undefined); });
    const res = out as true | string;
    if (res === true) {
      playSound('levelup');
      setPicked(null);
      toast(`✦ Ta Relique atteint ${relic.stars + 1} étoile${relic.stars + 1 > 1 ? 's' : ''} !`, 'gold');
    } else {
      toast(res, 'bad');
    }
  }

  return (
    <div className="space-y-3">
      {/* Identité : c'est la partie qui « évolue » et qu'on montre aux autres. */}
      <div
        className="rounded-xl p-4 text-center"
        style={{ background: `linear-gradient(160deg, ${tier.color}22, rgba(0,0,0,.35))`, boxShadow: `inset 0 0 40px ${tier.color}18` }}
      >
        <div className="text-5xl leading-none">{tier.icon}</div>
        <div className="mt-2 text-lg font-bold" style={{ color: tier.color }}>{tier.name}</div>
        <div className="mt-2 flex justify-center"><Stars stars={relic.stars} color={tier.color} /></div>
        {relic.stars > 0 && relic.stars <= RELIC_STAT_STARS && (
          <div className="mt-2 text-[11px] text-emerald-300">
            +{pct(Math.min(relic.stars, RELIC_STAT_STARS) * RELIC_STAT_PER_STAR)} ATK / DEF / PV
          </div>
        )}
        {relic.stars > RELIC_STAT_STARS && (
          <div className="mt-2 text-[11px] text-emerald-300">
            +{pct(RELIC_STAT_STARS * RELIC_STAT_PER_STAR)} ATK / DEF / PV · {chosen.length} effet{chosen.length > 1 ? 's' : ''}
          </div>
        )}
        {/* Le seul objet du jeu qui traverse tout : ça mérite d'être dit. */}
        <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">
          Survit à la renaissance et au changement de saison
        </div>
      </div>

      {/* Éclats disponibles + d'où ils viennent. */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">✧ Éclats de Relique</span>
          <span className="text-lg font-bold tabular-nums text-amber-300">{shards}</span>
        </div>
        <div className="mt-2 space-y-1">
          {RELIC_SHARD_SOURCES.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              <span className="font-semibold tabular-nums text-slate-300">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gravure de l'étoile suivante. */}
      {maxed ? (
        <div className="rounded-xl border p-3 text-center text-sm font-bold" style={{ borderColor: `${tier.color}66`, color: tier.color }}>
          Ta Relique est primordiale. Il n'y a rien au-delà.
        </div>
      ) : (
        <div className="rounded-xl bg-black/25 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-slate-200">
              {isEffectStar ? `Étoile ${nextStar} — choisis un effet` : `Étoile ${nextStar}`}
            </span>
            <span className={`text-xs font-bold tabular-nums ${canAfford ? 'text-amber-300' : 'text-rose-300'}`}>
              {cost} ✧
            </span>
          </div>

          {!isEffectStar && (
            <p className="mt-1 text-[11px] text-slate-400">
              +{pct(RELIC_STAT_PER_STAR)} ATK / DEF / PV.
            </p>
          )}

          {isEffectStar && (
            <div className="mt-2 space-y-1.5">
              {choices.map((c) => {
                const on = picked === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setPicked(on ? null : c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition ${
                      on ? 'border-amber-400 bg-amber-500/15' : 'border-slate-800 bg-black/25 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl leading-none">{c.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                      <div className="text-[11px] leading-snug text-slate-400">{c.desc}</div>
                    </div>
                    {on && <span className="shrink-0 text-xs font-bold text-amber-300">✓</span>}
                  </button>
                );
              })}
              {/* Le choix est définitif : autant le dire avant, pas après. */}
              <p className="text-[10px] text-slate-500">Le choix est gravé définitivement — les deux autres seront perdus.</p>
            </div>
          )}

          <button
            onClick={forge}
            disabled={!canAfford || (isEffectStar && !picked)}
            className="mt-2.5 w-full rounded-lg bg-amber-500/35 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-500/55 disabled:opacity-35"
          >
            {!canAfford
              ? `Il te manque ${cost - shards} Éclat${cost - shards > 1 ? 's' : ''}`
              : isEffectStar && !picked
                ? 'Choisis un effet'
                : `Graver l'étoile ${nextStar}`}
          </button>
        </div>
      )}

      {/* Effets déjà gravés. */}
      {chosen.length > 0 && (
        <div className="rounded-xl bg-black/25 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Effets gravés</div>
          <div className="space-y-1.5">
            {chosen.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 rounded-lg bg-black/25 p-2">
                <span className="text-lg leading-none">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-200">{e.name}</div>
                  <div className="text-[11px] text-slate-400">{e.desc}</div>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-500">★{e.star}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
