import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { useClock } from '../hooks/useClock';
import { isMuted, toggleMute } from '../game/sound';
import { BIOMES } from '../game/biomes';
import { CLASSES, xpToNext } from '../game/classes';
import { PHASE_EMOJI, PHASE_LABEL } from '../game/daynight';
import { deriveStats } from '../game/player';

function Pill({ icon, value, title }: { icon: string; value: string | number; title: string }) {
  return (
    <span
      title={title}
      className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs sm:text-sm"
    >
      <span>{icon}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

export default function Topbar() {
  const player = useGame((s) => s.player);
  const logout = useGame((s) => s.logout);
  const { now, phase } = useClock();
  const [muted, setMuted] = useState(isMuted());
  if (!player) return null;

  const biome = BIOMES[player.biome];
  const cls = CLASSES[player.classId];
  const stats = deriveStats(player);
  const hpPct = Math.max(0, Math.round((player.hp / stats.maxHp) * 100));
  const xpPct = Math.round((player.xp / xpToNext(player.level)) * 100);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 p-2 sm:p-3">
      <div className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl glass px-3 py-2">
        {/* Identité */}
        <div className="flex min-w-0 items-center gap-2">
          {player.photoURL ? (
            <img src={player.photoURL} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/30">{cls.emoji}</div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{player.name}</div>
            <div className="text-[10px] text-slate-300">
              Nv.{player.level} {cls.name}
            </div>
          </div>
        </div>

        {/* Barres HP / XP */}
        <div className="hidden flex-1 gap-2 sm:flex">
          <div className="w-28">
            <div className="text-[10px] text-slate-300">PV {player.hp}/{stats.maxHp}</div>
            <div className="h-2 rounded bg-black/40">
              <div className="h-2 rounded bg-rose-500 transition-all" style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="w-28">
            <div className="text-[10px] text-slate-300">XP {xpPct}%</div>
            <div className="h-2 rounded bg-black/40">
              <div className="h-2 rounded bg-emerald-400 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Ressources */}
        <div className="ml-auto flex items-center gap-1.5">
          <Pill icon="🪙" value={player.gold} title="Or" />
          <Pill icon="🎲" value={player.fateCoins} title="Fate Coins" />
          <Pill icon={PHASE_EMOJI[phase]} value={now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} title={PHASE_LABEL[phase]} />
          <Pill icon={biome.emoji} value={biome.name.split(' ')[0]} title={biome.name} />
          <button
            onClick={() => setMuted(toggleMute())}
            title={muted ? 'Activer le son' : 'Couper le son'}
            className="rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-white/15"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={logout}
            title="Se déconnecter"
            className="rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-rose-500/40"
          >
            ⏻
          </button>
        </div>
      </div>
    </div>
  );
}
