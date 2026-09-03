import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { CLASSES, xpToNext } from '../../game/classes';
import { powerScore, MASTERY_MAX } from '../../game/power';
import { PROFILE_BGS, profileBg } from '../../game/seasonpass';
import { BIOMES } from '../../game/biomes';
import { deriveStats, changeBaseClass, BASE_CLASSES } from '../../game/player';
import { farmProgress } from '../../game/gathering';
import { item, RARITY_COLOR } from '../../game/items';
import type { ClassId } from '../../game/types';
import ItemIcon from '../ItemIcon';

export function fmtPlaytime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-black/25 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Gear({ slot, id }: { slot: string; id: string | null }) {
  const it = id ? item(id)! : null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5 text-sm">
      <span className="text-slate-400">{slot}</span>
      <span className="inline-flex items-center gap-1.5" style={{ color: it ? RARITY_COLOR[it.rarity] : '#64748b' }}>
        {it && id ? <><ItemIcon id={id} size={16} /> {it.name}</> : '—'}
      </span>
    </div>
  );
}

export default function ProfileCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [pickClass, setPickClass] = useState(false);

  if (!p) return null;
  const cls = CLASSES[p.classId];
  const prestigeN = Math.min(p.prestigeLevel ?? 0, 5);
  const power = powerScore(p);
  const tokens = p.classChangeTokens ?? 0;

  function useToken(newClass: ClassId) {
    mutate((d) => { changeBaseClass(d, newClass); d.classChangeTokens = Math.max(0, (d.classChangeTokens ?? 0) - 1); });
    setPickClass(false);
    toast(`Tu es désormais ${CLASSES[newClass].name} !`, 'good');
  }
  const stats = deriveStats(p);
  const xpPct = Math.max(0, Math.min(100, Math.round((p.xp / xpToNext(p.level)) * 100)));
  const farm = farmProgress(p);
  const dungeonsCleared = Object.values(p.dungeonClears ?? {}).reduce((s, n) => s + n, 0);
  const since = new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : String(p.kills);

  function startEdit() { setName(p!.name); setTitle(p!.title ?? ''); setEditing(true); }
  function save() {
    const n = name.trim().slice(0, 18) || p!.name;
    const t = title.trim().slice(0, 40);
    mutate((d) => { d.name = n; d.title = t; });
    setEditing(false);
    toast('Profil mis à jour.', 'good');
  }



  return (
    <div className="space-y-4">
      {/* Fond de profil : cosmétique gagné à la passe de saison. Il habille
          l'en-tête plutôt que toute la carte, pour rester lisible. */}
      <div
        className="-mx-1 rounded-xl px-3 py-3"
        style={{ background: profileBg(p.profileBg)?.css ?? 'transparent' }}
      >
      <div className="flex items-start gap-3">
        {p.photoURL ? (
          <img src={p.photoURL} alt="" className="h-14 w-14 rounded-xl" />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-3xl">{cls.emoji}</div>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-1.5">
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 18))} placeholder="Nom" className="w-full rounded-lg bg-black/40 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-sky-400/60" />
              {(p.unlockedTitles && p.unlockedTitles.length > 0) ? (
                <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg bg-black/40 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-sky-400/60 text-amber-200">
                  <option value="">-- Aucun titre --</option>
                  {p.unlockedTitles.map(t => <option key={t} value={t}>[{t}]</option>)}
                </select>
              ) : (
                <div className="text-xs text-slate-500 italic">Aucun titre débloqué. (Voir succès)</div>
              )}
              <div className="flex gap-1.5">
                <button onClick={save} className="rounded bg-emerald-500/40 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-500/60">Enregistrer</button>
                <button onClick={() => setEditing(false)} className="rounded bg-black/30 px-2.5 py-1 text-xs hover:bg-white/10">Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="truncate text-xl font-bold">{p.name}</span>
                <button onClick={startEdit} title="Éditer" className="rounded bg-black/30 px-1.5 py-0.5 text-xs hover:bg-white/15">✏️</button>
              </div>
              {p.title && <div className="truncate text-xs font-semibold text-amber-300">[{p.title}]</div>}
              <div className="text-sm text-slate-300">Niveau {p.level} · {cls.name} {cls.emoji}</div>
              <div className="text-xs text-slate-400">{BIOMES[p.biome].emoji} {BIOMES[p.biome].name}</div>
              {p.legacyCreatedAt && (
                <div className="text-xs text-emerald-400/80 mt-0.5">Ancien compte créé le : {new Date(p.legacyCreatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              )}
            </>
          )}
        </div>
      </div>

      </div>

      {/* Choix du fond, seulement si le joueur en a débloqué. */}
      {(p.unlockedBgs?.length ?? 0) > 0 && (
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fond de profil</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => mutate((d) => { d.profileBg = undefined; })}
              className={`rounded-lg px-2.5 py-1 text-[11px] ${!p.profileBg ? 'bg-sky-500/30 text-sky-100' : 'bg-black/30 text-slate-400 hover:bg-white/10'}`}
            >
              Aucun
            </button>
            {PROFILE_BGS.filter((b) => p.unlockedBgs!.includes(b.id)).map((b) => (
              <button
                key={b.id}
                onClick={() => mutate((d) => { d.profileBg = b.id; })}
                className={`rounded-lg px-2.5 py-1 text-[11px] ${p.profileBg === b.id ? 'ring-1 ring-sky-400 text-slate-100' : 'text-slate-300 hover:brightness-125'}`}
                style={{ background: b.css }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {(p.talentPoints ?? 0) > 0 && (
        <div className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs">
          🌟 {p.talentPoints} point{p.talentPoints > 1 ? 's' : ''} de talent à dépenser — tape « talents ».
        </div>
      )}

      {/* Cote de Puissance : le classement se joue là-dessus, donc on montre
          d'où vient le score — sinon c'est un nombre opaque de plus. Chaque
          ligne est un levier concret sur lequel le joueur peut agir. */}
      <div className="rounded-lg bg-black/25 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">⚡ Puissance</span>
          <span className="text-base font-bold tabular-nums text-amber-300">{power.total.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
          <span>Niveau <b className="tabular-nums text-slate-200">{power.level}</b></span>
          {power.prestige > 0 && <span>Prestige <b className="tabular-nums text-purple-300">{power.prestige}</b></span>}
          <span>Artefact <b className="tabular-nums text-slate-200">{power.artifact}</b></span>
          <span>Étoiles <b className="tabular-nums text-slate-200">{power.stars}</b></span>
          <span>Maîtrises <b className="tabular-nums text-slate-200">{power.mastery}</b>/{MASTERY_MAX}</span>
          {power.endless > 0 && <span>Abysses <b className="tabular-nums text-slate-200">{power.endless}</b></span>}
          {power.relic > 0 && <span>Relique <b className="tabular-nums text-amber-300">{power.relic}</b></span>}
        </div>
      </div>

      {/* Prestige : insigne + bonus permanent */}
      {(p.prestigeLevel ?? 0) > 0 && (
        <div className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-2 text-xs">
          <div className="font-semibold text-purple-200">✦ Prestige {p.prestigeLevel}</div>
          <div className="mt-0.5 text-[11px] text-emerald-300">
            Bonus permanent : +{prestigeN * 8}% ATK / DEF / PV · +{prestigeN * 10}% XP et Or{(p.prestigeLevel ?? 0) > 5 ? ' (plafonné à 5 prestiges)' : ''}
          </div>
        </div>
      )}

      {/* Jeton de changement de classe (gagné au prestige) */}
      {tokens > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-200">🎫 Jeton{tokens > 1 ? 's' : ''} de classe : {tokens}</span>
            {!pickClass && <button onClick={() => setPickClass(true)} className="rounded bg-amber-500/30 px-2 py-1 text-[11px] font-semibold hover:bg-amber-500/50">Changer de classe</button>}
          </div>
          {pickClass && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] text-slate-400">Choisis ta nouvelle classe de base (reset des talents) :</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BASE_CLASSES.map((c) => (
                  <button key={c} onClick={() => useToken(c)} disabled={c === p.classId} className="rounded bg-black/30 px-2 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40">
                    {CLASSES[c].emoji} {CLASSES[c].name}{c === p.classId ? ' (actuelle)' : ''}
                  </button>
                ))}
              </div>
              <button onClick={() => setPickClass(false)} className="mt-1.5 text-[11px] text-slate-500 hover:text-slate-300">Annuler</button>
            </div>
          )}
        </div>
      )}



      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>Expérience d'aventure</span>
          <span>{p.xp} / {xpToNext(p.level)}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded bg-black/40">
          <div className="h-2.5 rounded bg-emerald-400" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-xs text-slate-400">
        <span>⏱️ Temps de jeu</span>
        <span className="tabular-nums text-slate-300">{fmtPlaytime(p.playtimeMs ?? 0)}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="PV" value={`${stats.hp}/${stats.maxHp}`} />
        <Stat label="ATK" value={stats.atk} />
        <Stat label="DEF" value={stats.def} />
        <Stat label="Farm" value={`Nv.${farm.level}`} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Kills" value={p.kills} />
        <Stat label="Morts" value={p.deaths} />
        <Stat label="K/D" value={kd} />
        <Stat label="Donjons" value={dungeonsCleared} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="🪙 Or" value={p.gold} />
        <Stat label="🎲 Fate" value={p.fateCoins} />
        <Stat label="💎 Gems" value={p.gems} />
        <Stat label="Casino" value={p.gambleNet} />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Équipement</div>
        <Gear slot="Arme" id={p.equipped.weapon} />
        <Gear slot="Armure" id={p.equipped.armor} />
        <Gear slot="Bijou" id={p.equipped.trinket} />
      </div>

      <div className="text-center text-[11px] text-slate-500">Aventurier depuis le {since}</div>
    </div>
  );
}
