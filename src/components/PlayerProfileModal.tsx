import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSES } from '../game/classes';
import { item, RARITY_COLOR } from '../game/items';
import { fetchPublicProfile, type LeaderRow } from '../firebase/socialService';
import { tierFor } from '../game/season';
import type { PlayerState } from '../game/types';
import { deriveStats, migratePlayer } from '../game/player';
import { auraColor } from '../game/prestige';
import ItemIcon from './ItemIcon';

/** Fiche minimale nécessaire pour ouvrir la modale (ex: depuis un clic sur un pseudo en chat, sans avoir la ligne de classement complète). Le reste est comblé par `fetchPublicProfile` une fois chargé. */
export type ProfileSeed = Partial<LeaderRow> & { uid: string; name: string };

/** Fiche publique d'un joueur (ouverte depuis le classement, le chat, une équipe/guilde/duel…). */
export default function PlayerProfileModal({ row, onClose, onMessage }: { row: ProfileSeed; onClose: () => void; onMessage?: () => void }) {
  const [full, setFull] = useState<Partial<PlayerState> | null>(null);

  useEffect(() => {
    let alive = true;
    setFull(null);
    fetchPublicProfile(row.uid).then((d) => { if (alive) setFull(d); });
    return () => { alive = false; };
  }, [row.uid]);

  // `full` (doc joueur complet) est la source de vérité une fois chargé ; `row`
  // ne sert que de repli instantané (ex: ligne de classement déjà connue).
  const level = full?.level ?? row.level;
  const classId = full?.classId ?? row.classId;
  const kills = full?.kills ?? row.kills;
  const gold = full?.gold ?? row.gold;
  const photoURL = full?.photoURL ?? row.photoURL;
  const title = full?.title ?? row.title;
  const seasonPoints = full?.seasonPoints ?? row.seasonPoints;
  const prestigeAura = full?.prestigeAura ?? row.prestigeAura;
  const prestigeLevel = full?.prestigeLevel ?? row.prestigeLevel;
  const auraColorOn = full?.auraColorOn ?? row.auraColorOn ?? true;

  const cls = classId ? CLASSES[classId] : undefined;
  const tier = tierFor(seasonPoints ?? 0).tier;
  const equipped = full?.equipped;
  const nameColor = auraColor(prestigeAura, auraColorOn);

  const stats = full ? deriveStats(migratePlayer(JSON.parse(JSON.stringify(full))), true) : null;

  const lastSeenLabel = (() => {
    if (!full?.lastSeen) return null;
    const mins = Math.floor((Date.now() - full.lastSeen) / 60_000);
    if (mins < 2) return 'en ligne';
    if (mins < 60) return `vu il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `vu il y a ${hrs}h`;
    return `vu il y a ${Math.floor(hrs / 24)}j`;
  })();

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass w-full max-w-sm animate-floatIn rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {photoURL
            ? <img src={photoURL} alt="" className="h-12 w-12 rounded-full" />
            : <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-500/30 text-2xl">{cls?.emoji ?? '🧑'}</div>}
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">
              {(prestigeLevel ?? 0) > 0 && <span className="mr-1 text-purple-300" title={`Prestige ${prestigeLevel}`}>✦{prestigeLevel}</span>}
              {prestigeAura && <span className="mr-1">{prestigeAura}</span>}
              <span style={{ color: nameColor }}>{row.name}</span>
              {full?.isLegacy && <span className="ml-1" title="Joueur vétéran">🎖️</span>}
            </div>
            {title && <div className="truncate text-[11px] text-amber-300">« {title} »</div>}
            <div className="text-xs text-slate-400">
              {level != null ? `Nv.${level}` : '…'} · {cls?.name ?? classId ?? '…'}
              {lastSeenLabel && <span className={lastSeenLabel === 'en ligne' ? 'ml-1 text-emerald-400' : 'ml-1'}> · {lastSeenLabel}</span>}
            </div>
          </div>
        </div>

        {/* Stats publiques */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">☠ Kills</div><div className="font-bold">{(kills ?? 0).toLocaleString()}</div></div>
          <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">🪙 Or</div><div className="font-bold">{(gold ?? 0).toLocaleString()}</div></div>
          <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">🥷 CJ</div><div className="font-bold">{full?.cjWins ?? 0}</div></div>
        </div>

        {/* Infos complémentaires (dispo seulement une fois `full` chargé) */}
        {full && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">💀 Morts</div><div className="font-bold">{full.deaths ?? 0}</div></div>
            <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">🌌 Abysses</div><div className="font-bold">{full.endlessBest ?? 0}</div></div>
            <div className="rounded-lg bg-black/25 py-2"><div className="text-[10px] text-slate-400">🔥 Connexions</div><div className="font-bold">{full.loginStreak ?? 0}j</div></div>
          </div>
        )}

        {stats && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-rose-500/20 py-1.5"><div className="text-[10px] text-rose-300">⚔️ ATK</div><div className="font-bold text-rose-100">{stats.atk}</div></div>
            <div className="rounded-lg bg-sky-500/20 py-1.5"><div className="text-[10px] text-sky-300">🛡️ DEF</div><div className="font-bold text-sky-100">{stats.def}</div></div>
            <div className="rounded-lg bg-emerald-500/20 py-1.5"><div className="text-[10px] text-emerald-300">❤️ PV</div><div className="font-bold text-emerald-100">{stats.maxHp}</div></div>
          </div>
        )}

        {/* Rang de saison */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
          <span className="text-slate-400">Saison PvP</span>
          <span style={{ color: tier.color }}>{tier.icon} {tier.name} · {seasonPoints ?? 0} pts</span>
        </div>

        {/* Équipement */}
        {equipped && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Équipement</div>
            <div className="flex flex-wrap gap-2">
              {(['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const).map((slot) => {
                const id = equipped[slot];
                if (!id && slot !== 'weapon' && slot !== 'armor' && slot !== 'trinket') return null; // Hide empty optional slots
                const it = id ? item(id) : null;
                const stars = id && full?.gearStars ? (full.gearStars[id] ?? 0) : 0;
                return (
                  <div key={slot} className="flex min-w-[45%] flex-1 items-center gap-2 rounded-lg bg-black/25 p-2">
                    {it ? <ItemIcon id={id!} size={24} /> : <span className="text-slate-600">—</span>}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] leading-tight" style={{ color: it ? RARITY_COLOR[it.rarity] : '#64748b' }}>
                        {it?.name ?? 'vide'}
                      </div>
                      {stars > 0 && (
                        <div className="mt-0.5 text-[9px] tracking-widest text-amber-400">{'★'.repeat(stars)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {onMessage && (
            <button onClick={onMessage} className="flex-1 rounded-lg bg-rose-500/40 py-2 text-sm font-semibold hover:bg-rose-500/60">💬 MP</button>
          )}
          <button onClick={onClose} className="flex-1 rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60">Fermer</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
