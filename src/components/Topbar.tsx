import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { useClock } from '../hooks/useClock';
import { isMuted, toggleMute } from '../game/sound';
import { BIOMES } from '../game/biomes';
import { CLASSES, xpToNext } from '../game/classes';
import { PHASE_EMOJI, PHASE_LABEL } from '../game/daynight';
import { deriveStats } from '../game/player';
import { useUi } from '../store/uiStore';
import { currentGlobalEvent, currentBiomeEvent, type EventDef } from '../game/events';

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

const EVENT_COLOR: Record<EventDef['kind'], string> = {
  buff: '#4ade80',
  debuff: '#fb7185',
  neutral: '#94a3b8',
  invasion: '#c084fc',
};

/** Pastille cliquable d'événement (ouvre la fenêtre Événements). */
function EventPill({ e, onClick }: { e: EventDef; onClick: () => void }) {
  const color = EVENT_COLOR[e.kind];
  const notable = e.kind === 'buff' || e.kind === 'debuff' || e.kind === 'invasion';
  return (
    <button
      onClick={onClick}
      title={`${e.name} — ${e.desc}`}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition hover:brightness-125 ${e.kind === 'invasion' ? 'animate-pulse' : ''}`}
      style={{ background: notable ? `${color}22` : 'rgba(0,0,0,0.35)' }}
    >
      <span>{e.icon}</span>
    </button>
  );
}

export default function Topbar() {
  const player = useGame((s) => s.player);
  const logout = useGame((s) => s.logout);
  const open = useUi((s) => s.open);
  const { now, phase } = useClock();
  const [muted, setMuted] = useState(isMuted());
  if (!player) return null;

  const biome = BIOMES[player.biome];
  const cls = CLASSES[player.classId];
  const globalEvent = currentGlobalEvent(now.getTime());
  const biomeEvent = currentBiomeEvent(player.biome, now.getTime());
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
          <div className="flex items-center gap-1" title="Événements en cours (clic pour détails)">
            <EventPill e={globalEvent} onClick={() => open('events', undefined, { singleton: true })} />
            <EventPill e={biomeEvent} onClick={() => open('events', undefined, { singleton: true })} />
          </div>
          <Pill icon="🪙" value={player.gold} title="Or" />
          <button
            onClick={() => open('fateshop', undefined, { singleton: true })}
            title="Fate Coins — clic pour ouvrir la Boutique du Destin"
            className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-fuchsia-500/30 sm:text-sm"
          >
            <span>🎲</span>
            <span className="font-semibold tabular-nums">{player.fateCoins}</span>
          </button>
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
