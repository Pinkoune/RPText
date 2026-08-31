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

/** Ouvre la saison suivante (admin). Les artefacts repartent à zéro. */
export async function advanceSeason(): Promise<number> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase non configuré.');
  const cur = await fetchSeason();
  const next = cur.number + 1;
  await setDoc(doc(db, 'system', 'season'), { number: next, startedAt: Date.now() });
  setCurrentSeason(next);
  return next;
}
