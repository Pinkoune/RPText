import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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
