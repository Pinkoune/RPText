import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { simulateDuel, type DuelFighter } from '../game/pvp';

export interface Duel {
  id: string;
  hostUid: string;
  hostName: string;
  hostStats: DuelFighter;
  guestUid?: string;
  guestName?: string;
  guestStats?: DuelFighter;
  bet: number;
  status: 'open' | 'resolved' | 'cancelled';
  winnerUid?: string;
  /** Journal du combat (affiché aux deux joueurs). */
  log?: string[];
  createdAt: number;
  resolvedAt?: number;
}

export const duelsEnabled = isFirebaseConfigured && !!db;

/** Crée un duel ouvert (la mise a déjà été mise en séquestre côté joueur). */
export async function createDuel(host: { uid: string; name: string; stats: DuelFighter }, bet: number): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'duels'), {
    hostUid: host.uid,
    hostName: host.name,
    hostStats: host.stats,
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
export async function joinDuel(duel: Duel, guest: { uid: string; name: string; stats: DuelFighter }): Promise<Duel> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'duels', duel.id);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Duel, 'id'>;
    if (data.status !== 'open') throw new Error('déjà pris');
    if (data.hostUid === guest.uid) throw new Error('toi-même');
    // Combat équilibré basé sur les stats des deux joueurs.
    const sim = simulateDuel(data.hostStats, guest.stats);
    const winnerUid = sim.winner === 'host' ? data.hostUid : guest.uid;
    const resolved = {
      ...data,
      guestUid: guest.uid,
      guestName: guest.name,
      guestStats: guest.stats,
      status: 'resolved' as const,
      winnerUid,
      log: sim.log,
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
