import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { useClock } from '../hooks/useClock';
import { BIOMES } from '../game/biomes';
import { CLASSES, xpToNext } from '../game/classes';
import { PHASE_EMOJI, PHASE_LABEL } from '../game/daynight';
import { deriveStats } from '../game/player';
import { useUi } from '../store/uiStore';
import { currentGlobalEvent, currentBiomeEvent, type EventDef } from '../game/events';
import { auraColor } from '../game/prestige';
import { notificationCount } from './cards/NotificationsCard';
import { seasonTheme } from '../game/artifact';

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
  const hasUnreadChat = useGame((s) => s.hasUnreadChat);
  const open = useUi((s) => s.open);
  const { now, phase } = useClock();
  const barRef = useRef<HTMLDivElement>(null);
  // Recalculé quand le chat change OU quand les nouveautés sont marquées lues
  // (l'état vit dans localStorage, d'où l'écoute d'événement).
  const [patchTick, setPatchTick] = useState(0);
  useEffect(() => {
    const h = () => setPatchTick((n) => n + 1);
    window.addEventListener('rptext:patch-seen', h);
    return () => window.removeEventListener('rptext:patch-seen', h);
  }, []);
  const notifCount = useMemo(() => notificationCount(hasUnreadChat), [hasUnreadChat, patchTick]);

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
  const artTheme = seasonTheme(player.artifact?.season);
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
          {/* Or : haut-droite sur mobile uniquement. Les Fate Coins ont quitté la
              barre (ils restent au Profil et à la Boutique du Destin). */}
          <div className="ml-auto flex items-center gap-1.5 sm:hidden">
            <Pill icon="🪙" value={player.gold} title="Or" />
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
          <Pill icon={PHASE_EMOJI[phase]} value={now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} title={PHASE_LABEL[phase]} />
          <Pill icon={biome.emoji} value={biome.name.split(' ')[0]} title={biome.name} />
          {/* Artefact de saison : la seule jauge qui avance en permanence, donc
              la seule qui mérite un accès direct depuis la barre. */}
          <button
            onClick={() => open('artifact', undefined, { singleton: true })}
            title={`${artTheme.artifactName} — niveau ${player.artifact?.level ?? 0}`}
            className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-white/15"
          >
            <span>{artTheme.emoji}</span>
            <span className="font-semibold tabular-nums" style={{ color: artTheme.color }}>{player.artifact?.level ?? 0}</span>
          </button>
          {/* Bouton de notifications PERSISTANT : messages et mises à jour au
              même endroit. Avant, chaque source avait son bouton qui
              apparaissait puis disparaissait, et la barre bougeait sans cesse. */}
          <button
            onClick={() => open('notifications', undefined, { singleton: true })}
            title={notifCount > 0 ? `${notifCount} notification${notifCount > 1 ? 's' : ''}` : 'Aucune notification'}
            className="relative rounded-full bg-black/35 px-2.5 py-1 text-xs transition hover:bg-white/15"
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#0b1020]">
                {notifCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
