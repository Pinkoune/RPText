import { useGame } from '../../store/gameStore';
import { MONSTERS } from '../../game/monsters';
import { farmProgress } from '../../game/gathering';
import { getCraftLevel } from '../../game/crafting';

export default function StatsCard() {
  const player = useGame((s) => s.player);
  if (!player) return null;

  const stats = player.statistics;
  if (!stats) return <div className="p-4">Ancienne sauvegarde : relance le jeu pour activer les statistiques.</div>;

  const dungeonClears = Object.values(player.dungeonClears ?? {}).reduce((s, n) => s + n, 0);
  const farmLvl = farmProgress(player).level;
  const craftLvl = getCraftLevel(player.craftXp ?? 0).level;

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-300">
      <div className="rounded bg-black/20 p-3">
        <h3 className="mb-2 font-bold text-white">💰 Richesse</h3>
        <div className="flex justify-between">
          <span>Or total gagné</span>
          <span className="font-mono text-amber-300">{stats.goldEarned} 🪙</span>
        </div>
      </div>

      <div className="rounded bg-black/20 p-3">
        <h3 className="mb-2 font-bold text-white">🎰 Casino</h3>
        <div className="flex justify-between">
          <span>Parties jouées</span>
          <span className="font-mono">{stats.gamblesPlayed}</span>
        </div>
        <div className="flex justify-between">
          <span>Parties gagnées</span>
          <span className="font-mono text-green-400">{stats.gamblesWon}</span>
        </div>
        <div className="flex justify-between">
          <span>Bilan (net)</span>
          <span className={`font-mono ${player.gambleNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {player.gambleNet > 0 ? '+' : ''}{player.gambleNet} 🪙
          </span>
        </div>
      </div>

      <div className="rounded bg-black/20 p-3">
        <h3 className="mb-2 font-bold text-white">⚔️ Combat</h3>
        <div className="flex justify-between">
          <span>Monstres tués</span>
          <span className="font-mono">{player.kills}</span>
        </div>
        <div className="flex justify-between">
          <span>Morts</span>
          <span className="font-mono text-red-400">{player.deaths}</span>
        </div>
      </div>

      <div className="rounded bg-black/20 p-3">
        <h3 className="mb-2 font-bold text-white">🏆 Progression</h3>
        <div className="flex justify-between">
          <span>Donjons complétés</span>
          <span className="font-mono">{dungeonClears}</span>
        </div>
        <div className="flex justify-between">
          <span>Record Abysses infinis</span>
          <span className="font-mono text-purple-300">Étage {player.endlessBest ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Victoires Card-Jitsu</span>
          <span className="font-mono">{player.cjWins ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Série de connexion</span>
          <span className="font-mono text-orange-300">{player.loginStreak ?? 0} 🔥</span>
        </div>
        {(player.prestigeLevel ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Rituel du Néant</span>
            <span className="font-mono text-purple-300">✦{player.prestigeLevel}</span>
          </div>
        )}
      </div>

      <div className="rounded bg-black/20 p-3">
        <h3 className="mb-2 font-bold text-white">🪓 Métiers</h3>
        <div className="flex justify-between">
          <span>Niveau de récolte</span>
          <span className="font-mono">{farmLvl}</span>
        </div>
        <div className="flex justify-between">
          <span>Niveau d'artisanat</span>
          <span className="font-mono">{craftLvl}</span>
        </div>
      </div>

      {Object.keys(stats.mobsKilled).length > 0 && (
        <div className="rounded bg-black/20 p-3">
          <h3 className="mb-2 font-bold text-white">💀 Bestiaire</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(stats.mobsKilled)
              .sort((a, b) => b[1] - a[1])
              .map(([id, count]) => {
                const mob = MONSTERS.find((m) => m.id === id);
                return (
                  <div key={id} className="flex justify-between bg-black/20 px-2 py-1 rounded">
                    <span>{mob ? `${mob.emoji} ${mob.name}` : id}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
