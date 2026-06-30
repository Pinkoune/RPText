import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

export interface Duel {
  id: string;
  hostUid: string;
  hostName: string;
  guestUid?: string;
  guestName?: string;
  bet: number;
  status: 'open' | 'resolved' | 'cancelled';
  winnerUid?: string;
  flip?: 'heads' | 'tails';
  createdAt: number;
  resolvedAt?: number;
}

export const duelsEnabled = isFirebaseConfigured && !!db;

/** Crée un duel ouvert (la mise a déjà été mise en séquestre côté joueur). */
export async function createDuel(host: { uid: string; name: string }, bet: number): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'duels'), {
    hostUid: host.uid,
    hostName: host.name,
    bet,
    status: 'open',
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Écoute tous les duels (lobby + résolutions). */
export function listenDuels(cb: (duels: Duel[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'duels'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Duel, 'id'>) })));
  });
}

/**
 * Rejoint un duel et le résout de façon atomique (transaction). Le gagnant est
 * tiré à pile/face. Retourne le duel résolu (pour que le joueur encaisse).
 */
export async function joinDuel(duel: Duel, guest: { uid: string; name: string }): Promise<Duel> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'duels', duel.id);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Duel, 'id'>;
    if (data.status !== 'open') throw new Error('déjà pris');
    if (data.hostUid === guest.uid) throw new Error('toi-même');
    const flip: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
    const winnerUid = Math.random() < 0.5 ? data.hostUid : guest.uid;
    const resolved = {
      ...data,
      guestUid: guest.uid,
      guestName: guest.name,
      status: 'resolved' as const,
      winnerUid,
      flip,
      resolvedAt: Date.now(),
    };
    tx.update(ref, resolved);
    return { id: duel.id, ...resolved } as Duel;
  });
  return result;
}

/** Annule un duel ouvert (hôte uniquement) — la mise est remboursée côté joueur. */
export async function cancelDuel(duelId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'duels', duelId), { status: 'cancelled' });
}
