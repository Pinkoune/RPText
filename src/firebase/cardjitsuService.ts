import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { CJCard } from '../game/cardjitsu';
import { drawCJCard } from '../game/cardjitsu';

export interface CJDuel {
  id: string;
  hostUid: string;
  hostName: string;
  guestUid?: string;
  guestName?: string;
  bet: number;
  status: 'open' | 'playing' | 'resolved' | 'cancelled';
  winnerUid?: string | 'tie'; // tie si match nul final (ex: abandon mutuel ou bug)
  createdAt: number;
  
  // État du jeu
  hostHand: CJCard[];
  guestHand: CJCard[];
  hostBank: CJCard[];
  guestBank: CJCard[];
  
  // Choix du tour actuel (index dans la main)
  hostPick?: number | null;
  guestPick?: number | null;
}

export const cjEnabled = isFirebaseConfigured && !!db;

const HAND_SIZE = 4;
function generateHand(): CJCard[] {
  return Array.from({ length: HAND_SIZE }, drawCJCard);
}

export async function createCJDuel(host: { uid: string; name: string }, bet: number): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'cj_duels'), {
    hostUid: host.uid,
    hostName: host.name,
    bet,
    status: 'open',
    createdAt: Date.now(),
    hostHand: generateHand(),
    hostBank: [],
    guestBank: [], // initialisé vide, sera rempli quand un joueur rejoint
  });
  return ref.id;
}

export function listenCJDuels(cb: (duels: CJDuel[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'cj_duels'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CJDuel, 'id'>) })));
  });
}

export async function joinCJDuel(duelId: string, guest: { uid: string; name: string }): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'cj_duels', duelId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<CJDuel, 'id'>;
    if (data.status !== 'open') throw new Error('déjà pris');
    if (data.hostUid === guest.uid) throw new Error('toi-même');
    
    tx.update(ref, {
      guestUid: guest.uid,
      guestName: guest.name,
      status: 'playing',
      guestHand: generateHand(),
      guestBank: [],
    });
  });
}

export async function cancelCJDuel(duelId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'cj_duels', duelId), { status: 'cancelled' });
}

export async function playCJCard(duelId: string, isHost: boolean, cardIndex: number): Promise<void> {
  if (!db) return;
  const field = isHost ? 'hostPick' : 'guestPick';
  await updateDoc(doc(db, 'cj_duels', duelId), { [field]: cardIndex });
}

export async function resolveCJTurn(
  duelId: string,
  hostHand: CJCard[],
  guestHand: CJCard[],
  hostBank: CJCard[],
  guestBank: CJCard[],
  winnerUid?: string // Présent si quelqu'un a gagné la partie
): Promise<void> {
  if (!db) return;
  const update: any = {
    hostHand,
    guestHand,
    hostBank,
    guestBank,
    hostPick: null,
    guestPick: null,
  };
  if (winnerUid) {
    update.status = 'resolved';
    update.winnerUid = winnerUid;
  }
  await updateDoc(doc(db, 'cj_duels', duelId), update);
}

export async function forfeitCJDuel(duelId: string, isHost: boolean, hostUid: string, guestUid?: string): Promise<void> {
  if (!db) return;
  const winnerUid = isHost ? guestUid : hostUid;
  // Si le guest n'est pas encore là (en attente), on annule simplement
  if (!winnerUid) {
    await cancelCJDuel(duelId);
    return;
  }
  await updateDoc(doc(db, 'cj_duels', duelId), {
    status: 'resolved',
    winnerUid,
  });
}
