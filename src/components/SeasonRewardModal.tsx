import { useGame } from '../store/gameStore';
import { item } from '../game/items';
import { TIERS } from '../game/season';

/** Affiche la récompense de fin de saison PvP au chargement, une fois par rotation. */
export default function SeasonRewardModal() {
  const sr = useGame((s) => s.seasonReward);
  const clear = useGame((s) => s.clearSeasonReward);
  if (!sr) return null;

  const tier = TIERS.find((t) => t.name === sr.tierName);
  const r = sr.reward;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={clear}>
      <div className="glass w-full max-w-md animate-floatIn rounded-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold text-glow">🏅 Saison terminée !</div>
        <div className="mt-2 text-4xl">{tier?.icon ?? '🏅'}</div>
        <div className="text-lg font-bold" style={{ color: tier?.color }}>Rang {sr.tierName}</div>
        <div className="text-xs text-slate-400">Voici ta récompense de fin de saison :</div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-sm text-amber-200">+{r.gold.toLocaleString()} 🪙</span>
          <span className="rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-sm text-fuchsia-200">+{r.fateCoins} 🎲</span>
          {r.gems ? <span className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-sm text-sky-200">+{r.gems} 💎</span> : null}
          {r.items && Object.entries(r.items).map(([id, qty]) => (
            <span key={id} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200">
              {item(id)?.icon} {item(id)?.name} ×{qty}
            </span>
          ))}
        </div>

        <div className="mt-3 text-[11px] text-slate-500">Une nouvelle saison commence. Bonne chance !</div>
        <button onClick={clear} className="mt-4 w-full rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60">
          Récupérer
        </button>
      </div>
    </div>
  );
}
