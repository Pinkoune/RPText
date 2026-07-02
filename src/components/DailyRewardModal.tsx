import { useGame } from '../store/gameStore';
import { DAILY_CYCLE } from '../game/daily';

/** Affiche la récompense de connexion journalière quand un nouveau jour est réclamé. */
export default function DailyRewardModal() {
  const reward = useGame((s) => s.dailyReward);
  const clear = useGame((s) => s.clearDailyReward);
  if (!reward) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={clear}>
      <div className="glass w-full max-w-md animate-floatIn rounded-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold text-glow">🎁 Récompense journalière</div>
        <div className="mt-1 text-xs text-slate-400">
          Série de <span className="font-bold text-amber-300">{reward.streak}</span> jour{reward.streak > 1 ? 's' : ''} consécutif{reward.streak > 1 ? 's' : ''} !
        </div>

        {/* Cycle de 7 jours */}
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {DAILY_CYCLE.map((r, i) => {
            const isToday = i + 1 === reward.day;
            const done = i + 1 < reward.day;
            return (
              <div
                key={i}
                className={`rounded-lg py-2 text-center ${
                  isToday ? 'bg-amber-500/30 ring-1 ring-amber-400' : done ? 'bg-emerald-500/15' : 'bg-black/25'
                }`}
              >
                <div className="text-[9px] text-slate-400">J{i + 1}</div>
                <div className="text-base leading-none">{done ? '✅' : r.item ? '🎁' : r.gems ? '💎' : r.fateCoins ? '🎲' : '🪙'}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-emerald-500/15 py-3 text-emerald-200">
          <div className="text-[10px] uppercase tracking-wide opacity-70">Tu reçois</div>
          <div className="text-lg font-bold">{reward.label}</div>
        </div>

        <button onClick={clear} className="mt-4 w-full rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60">
          Génial, merci !
        </button>
      </div>
    </div>
  );
}
