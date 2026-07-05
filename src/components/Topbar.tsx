import { useState, useLayoutEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { useClock } from '../hooks/useClock';
import { isMuted, toggleMute } from '../game/sound';
import { BIOMES } from '../game/biomes';
import { CLASSES, xpToNext } from '../game/classes';
import { PHASE_EMOJI, PHASE_LABEL } from '../game/daynight';
import { deriveStats } from '../game/player';
import { useUi } from '../store/uiStore';
import { currentGlobalEvent, currentBiomeEvent, type EventDef } from '../game/events';
import { auraColor } from '../game/prestige';

function Pill({ icon, value, title, className = '' }: { icon: string; value: string | number; title: string; className?: string }) {
  return (
    <span
      title={title}
      className={`flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs sm:text-sm ${className}`}
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
  const hasUnreadChat = useGame((s) => s.hasUnreadChat);
  const open = useUi((s) => s.open);
  const { now, phase } = useClock();
  const [muted, setMuted] = useState(isMuted());
  const barRef = useRef<HTMLDivElement>(null);

  // Expose la hauteur réelle de la barre (elle peut passer sur 2-3 lignes) pour
  // que les fenêtres mobiles démarrent juste en dessous, sans chevauchement.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${Math.round(el.getBoundingClientRect().bottom)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener('resize', set);
    return () => { ro.disconnect(); window.removeEventListener('resize', set); };
  }, [player]);

  if (!player) return null;

  const biome = BIOMES[player.biome];
  const cls = CLASSES[player.classId];
  const globalEvent = currentGlobalEvent(now.getTime());
  const biomeEvent = currentBiomeEvent(player.biome, now.getTime());
  const stats = deriveStats(player); // stats.hp est déjà clampé à maxHp (contrairement à player.hp brut)
  const hpPct = Math.max(0, Math.min(100, Math.round((stats.hp / stats.maxHp) * 100)));
  const xpPct = Math.max(0, Math.min(100, Math.round((player.xp / xpToNext(player.level)) * 100)));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 p-2 sm:p-3">
      <div ref={barRef} className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl glass px-3 py-2">
        {/* Identité (+ or/fate à droite sur mobile, même ligne que le pseudo) */}
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          {player.photoURL ? (
            <img src={player.photoURL} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/30">{cls.emoji}</div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold" style={{ color: auraColor(player.prestigeAura, player.auraColorOn ?? true) }}>{player.name}</div>
            <div className="text-[10px] text-slate-300">
              Nv.{player.level} {cls.name}
            </div>
          </div>
          {/* Or (+ Fate à partir du niv.10) : haut-droite sur mobile uniquement */}
          <div className="ml-auto flex items-center gap-1.5 sm:hidden">
            <Pill icon="🪙" value={player.gold} title="Or" />
            {player.level >= 10 && (
              <button
                onClick={() => open('fateshop', undefined, { singleton: true })}
                title="Fate Coins — clic pour ouvrir la Boutique du Destin"
                className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-fuchsia-500/30"
              >
                <span>🎲</span>
                <span className="font-semibold tabular-nums">{player.fateCoins}</span>
              </button>
            )}
          </div>
        </div>

        {/* Barres PV / XP compactes — mobile uniquement (en haut de l'écran) */}
        <div className="flex w-full gap-2 sm:hidden">
          <div className="flex-1">
            <div className="text-[9px] leading-tight text-slate-300">PV {stats.hp}/{stats.maxHp}</div>
            <div className="h-1.5 overflow-hidden rounded bg-black/40">
              <div className={`h-1.5 rounded bg-rose-500 transition-all ${hpPct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[9px] leading-tight text-slate-300">XP {xpPct}%</div>
            <div className="h-1.5 overflow-hidden rounded bg-black/40">
              <div className="h-1.5 rounded bg-emerald-400 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Barres HP / XP */}
        <div className="hidden flex-1 gap-2 sm:flex">
          <div className="w-28">
            <div className="text-[10px] text-slate-300">PV {stats.hp}/{stats.maxHp}</div>
            <div className="h-2 overflow-hidden rounded bg-black/40">
              <div className={`h-2 rounded bg-rose-500 transition-all ${hpPct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>
          <div className="w-28">
            <div className="text-[10px] text-slate-300">XP {xpPct}%</div>
            <div className="h-2 overflow-hidden rounded bg-black/40">
              <div className="h-2 rounded bg-emerald-400 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Ressources (l'or/fate sont en haut à droite sur mobile) */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {player.level >= 3 && (
            <div className="flex items-center gap-1" title="Événements en cours (clic pour détails)">
              <EventPill e={globalEvent} onClick={() => open('events', undefined, { singleton: true })} />
              <EventPill e={biomeEvent} onClick={() => open('events', undefined, { singleton: true })} />
            </div>
          )}
          <Pill icon="🪙" value={player.gold} title="Or" className="hidden sm:flex" />
          {player.level >= 10 && (
            <button
              onClick={() => open('fateshop', undefined, { singleton: true })}
              title="Fate Coins — clic pour ouvrir la Boutique du Destin"
              className="hidden items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-fuchsia-500/30 sm:flex sm:text-sm"
            >
              <span>🎲</span>
              <span className="font-semibold tabular-nums">{player.fateCoins}</span>
            </button>
          )}
          <Pill icon={PHASE_EMOJI[phase]} value={now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} title={PHASE_LABEL[phase]} />
          <Pill icon={biome.emoji} value={biome.name.split(' ')[0]} title={biome.name} />
          <button
            onClick={() => open('chat', undefined, { singleton: true })}
            title="Chat"
            className="relative rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-white/15"
          >
            💬
            {hasUnreadChat && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#0b1020] animate-pulse" />
            )}
          </button>
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
