import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { CLASSES } from '../game/classes';
import { MAX_CHARACTERS } from '../game/player';
import type { PlayerState } from '../game/types';

/** Date lisible de la dernière connexion d'un personnage. */
function lastSeenLabel(ts?: number): string {
  if (!ts) return 'jamais joué';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

function CharacterRow({ p, onPlay, onDelete }: { p: PlayerState; onPlay: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const cls = CLASSES[p.classId];

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-sky-400/40 hover:bg-black/40">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/40 text-3xl ring-1 ring-white/10">
          {cls?.emoji ?? '❔'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold text-slate-100">{p.name}</span>
            {(p.prestigeLevel ?? 0) > 0 && (
              <span className="shrink-0 rounded bg-purple-500/25 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                ✦{p.prestigeLevel}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-slate-400">
            Niveau <b className="text-sky-300">{p.level}</b> · {cls?.name ?? p.classId}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{lastSeenLabel(p.lastSeen)}</div>
        </div>
        <button
          onClick={onPlay}
          className="shrink-0 rounded-lg bg-sky-500/40 px-5 py-2.5 text-sm font-bold hover:bg-sky-500/60"
        >
          Jouer
        </button>
      </div>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-2 text-[11px] text-slate-600 transition hover:text-rose-400"
        >
          Supprimer ce personnage
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-rose-950/40 p-2">
          <span className="flex-1 text-[11px] text-rose-200">
            Supprimer <b>{p.name}</b> (Nv.{p.level}) définitivement ?
          </span>
          <button onClick={onDelete} className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500">
            Supprimer
          </button>
          <button onClick={() => setConfirming(false)} className="rounded bg-slate-700/60 px-2.5 py-1 text-[11px] hover:bg-slate-700">
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Écran de sélection de personnage — jusqu'à 3 par compte.
 *
 * Remplace le changement de classe : pour essayer une autre voie, on crée un
 * personnage au lieu de détruire celui qu'on a monté. C'est aussi ce qui rend
 * les 20 classes du jeu réellement explorables.
 */
export default function CharacterSelect() {
  const characters = useGame((s) => s.characters);
  const selectCharacter = useGame((s) => s.selectCharacter);
  const startCreateCharacter = useGame((s) => s.startCreateCharacter);
  const removeCharacter = useGame((s) => s.removeCharacter);
  const logout = useGame((s) => s.logout);
  const user = useGame((s) => s.user);

  const used = characters.filter((c) => c.player).length;

  return (
    <div className="grid h-full place-items-center overflow-auto bg-gradient-to-b from-[#0b1020] to-[#1a2b52] px-4 py-8">
      <div className="glass w-full max-w-xl animate-floatIn rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-glow">Tes personnages</h1>
            <p className="mt-1 text-sm text-slate-400">
              {used}/{MAX_CHARACTERS} emplacements utilisés. Chacun a sa classe, son niveau et son équipement.
            </p>
          </div>
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="h-10 w-10 shrink-0 rounded-full ring-1 ring-white/15" />
          )}
        </div>

        <div className="mt-5 space-y-3">
          {characters.map(({ slot, player }) =>
            player ? (
              <CharacterRow
                key={slot}
                p={player}
                onPlay={() => void selectCharacter(slot)}
                onDelete={() => void removeCharacter(slot)}
              />
            ) : (
              <button
                key={slot}
                onClick={() => startCreateCharacter(slot)}
                className="flex w-full items-center gap-4 rounded-xl border border-dashed border-white/15 bg-black/15 p-4 text-left transition hover:border-sky-400/50 hover:bg-black/30"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/30 text-2xl text-slate-600 ring-1 ring-white/5">
                  +
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-300">Emplacement libre</div>
                  <div className="text-[11px] text-slate-500">Créer un nouveau héros</div>
                </div>
              </button>
            ),
          )}
        </div>

        <button
          onClick={() => void logout()}
          className="mt-5 w-full rounded-lg bg-white/5 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
