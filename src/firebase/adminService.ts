import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './config';
import type { PlayerState } from '../game/types';

export async function getAllPlayers(): Promise<PlayerState[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'players'));
  return snap.docs.map(d => d.data() as PlayerState);
}

export async function updatePlayerAdmin(uid: string, data: Partial<PlayerState>): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'players', uid), data);
}

export async function triggerGlobalWipe(): Promise<void> {
  if (!db) return;
  // Use setDoc with merge to create the doc if it doesn't exist
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'system', 'config'), { lastWipe: Date.now() }, { merge: true });
}

export async function triggerFullWipe(): Promise<void> {
  if (!db) return;
  const database = db; // capture non-null pour les closures (db est un `let` module)
  const { setDoc, collection, getDocs, deleteDoc } = await import('firebase/firestore');
  
  // 1. Définir le lastWipe pour obliger les joueurs existants à recréer leur perso
  await setDoc(doc(db, 'system', 'config'), { lastWipe: Date.now() }, { merge: true });

  // 2. Vider les collections Firestore (Leaderboard, Guildes, Endless)
  const collectionsToWipe = ['leaderboard', 'guilds', 'endlessScores', 'endlessScoresMulti'];
  for (const colName of collectionsToWipe) {
    try {
      const snap = await getDocs(collection(database, colName));
      const promises = snap.docs.map(d => deleteDoc(doc(database, colName, d.id)));
      await Promise.all(promises);
    } catch (e) {
      console.warn(`Erreur lors du nettoyage de la collection ${colName}:`, e);
    }
  }

  // 3. Vider le Chat (RTDB)
  try {
    const { ref, set } = await import('firebase/database');
    const { rtdb } = await import('./config');
    if (rtdb) {
      await set(ref(rtdb, 'chat'), null);
    }
  } catch (e) {
    console.warn(`Erreur lors du nettoyage du chat:`, e);
  }
}

/**
 * Supprime les documents `players/*` encore antérieurs au dernier wipe global,
 * c'est-à-dire les comptes qui ne se sont PAS reconnectés depuis (ils n'ont
 * donc pas encore recréé leur perso, et leur ancien doc traîne pour rien).
 *
 * ⚠️ Volontairement séparé de `triggerFullWipe` : le statut Vétéran/Admin n'est
 * transféré au nouveau perso qu'au moment où le joueur se reconnecte et où
 * `loadPlayer()` lit son ANCIEN doc (createdAt < lastWipe) pour poser les
 * indicateurs `rptext.legacy.*` / `rptext.wasAdmin.*` en localStorage. Si on
 * supprime ce doc trop tôt, cette lecture ne se fait jamais et le joueur perd
 * son statut Vétéran/Admin. À lancer seulement après un délai de grâce
 * (quelques jours/semaines) pour laisser le temps aux joueurs de revenir.
 * Une fois reconnecté, le doc d'un joueur est de toute façon écrasé par son
 * nouveau perso (createdAt à jour) et n'est donc plus concerné par ce nettoyage.
 */
export async function cleanupOrphanedPlayers(): Promise<number> {
  if (!db) return 0;
  const database = db;
  const sysSnap = await getDoc(doc(database, 'system', 'config'));
  const lastWipe = sysSnap.exists() ? (sysSnap.data().lastWipe ?? 0) : 0;
  if (!lastWipe) return 0;

  const q = query(collection(database, 'players'), where('createdAt', '<', lastWipe));
  const snap = await getDocs(q);
  const { deleteDoc } = await import('firebase/firestore');
  await Promise.all(snap.docs.map(d => deleteDoc(doc(database, 'players', d.id))));
  return snap.docs.length;
}
