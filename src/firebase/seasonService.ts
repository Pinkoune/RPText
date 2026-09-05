import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { setCurrentSeason } from '../game/artifact';

// ─── Saison pilotée par l'admin ──────────────────────────────────────────────
// La saison n'est PAS dérivée de l'horloge : c'est toi qui décides quand elle
// se termine. Le numéro vit dans `system/season`, sur le même modèle que le
// `lastWipe` de `system/config`, et tous les clients l'écoutent en direct.
//
// Changer de saison ne touche à AUCUN personnage : seul l'artefact (et donc les
// classements qui en dépendent) repart de zéro, via `rotateSeason` appelé dans
// `migratePlayer` au chargement.

export interface SeasonInfo {
  number: number;
  startedAt: number;
}

const DEFAULT: SeasonInfo = { number: 1, startedAt: 0 };

/** Lecture ponctuelle (au démarrage, avant de charger le personnage). */
export async function fetchSeason(): Promise<SeasonInfo> {
  if (!isFirebaseConfigured || !db) {
    // Hors ligne : saison 1 figée, l'artefact ne tourne jamais tout seul.
    setCurrentSeason(DEFAULT.number);
    return DEFAULT;
  }
  try {
    const snap = await getDoc(doc(db, 'system', 'season'));
    const info: SeasonInfo = snap.exists()
      ? { number: snap.data().number ?? 1, startedAt: snap.data().startedAt ?? 0 }
      : DEFAULT;
    setCurrentSeason(info.number);
    return info;
  } catch (e) {
    console.error('Lecture de la saison impossible :', e);
    return DEFAULT;
  }
}

/**
 * Écoute les changements de saison. Un changement en cours de session doit
 * provoquer un rechargement : sinon le client continuerait de jouer avec un
 * artefact périmé et l'écraserait à la prochaine sauvegarde.
 */
export function watchSeason(onChange: (info: SeasonInfo) => void): () => void {
  if (!isFirebaseConfigured || !db) return () => {};
  return onSnapshot(doc(db, 'system', 'season'), (snap) => {
    if (!snap.exists()) return;
    const info: SeasonInfo = { number: snap.data().number ?? 1, startedAt: snap.data().startedAt ?? 0 };
    onChange(info);
  });
}

/**
 * Ouvre la saison suivante (admin).
 *
 * Une rotation doit se SENTIR : avant, elle ne remettait à zéro que l'artefact,
 * et les classements d'Abysses comme le ladder PvP traînaient les scores de la
 * saison précédente — d'où l'impression d'un changement purement décoratif.
 * Elle balaie maintenant les trois d'un coup.
 *
 * Ce qu'elle ne touche toujours pas, et c'est volontaire : le personnage.
 * Niveau, équipement, métiers, maîtrises et Relique traversent la rotation.
 */
export async function advanceSeason(): Promise<number> {
  const cur = await fetchSeason();
  return setSeason(cur.number + 1);
}

/**
 * Ouvre une saison précise (admin).
 *
 * `advanceSeason` ne savait qu'incrémenter : impossible de choisir le thème, qui
 * est pourtant dérivé du numéro, ni de relancer une rotation. Comme les clients
 * comparent `artifact.season !== saison courante` pour décider de repartir à
 * zéro, écrire N'IMPORTE QUEL numéro différent déclenche la remise à zéro — un
 * simple « +1 » suffit donc à réinitialiser, et un numéro choisi permet de
 * viser un thème.
 */
export async function setSeason(next: number): Promise<number> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase non configuré.');
  if (!Number.isFinite(next) || next < 1) throw new Error('Numéro de saison invalide.');
  next = Math.floor(next);
  await setDoc(doc(db, 'system', 'season'), { number: next, startedAt: Date.now() });
  setCurrentSeason(next);
  // Les artefacts eux-mêmes repartent à zéro côté client, via `rotateSeason`
  // appelé dans `migratePlayer` au chargement. Ici on nettoie ce qui vit
  // uniquement côté serveur et qu'aucun client ne remettrait à zéro tout seul.
  // Échec non bloquant : la saison a déjà tourné, on ne veut pas la coincer.
  try {
    const { wipeEndlessScores, resetPvpSeason } = await import('./adminService');
    await Promise.all([wipeEndlessScores(), resetPvpSeason()]);
  } catch (e) {
    console.error('Rotation : nettoyage des classements incomplet.', e);
  }
  return next;
}
