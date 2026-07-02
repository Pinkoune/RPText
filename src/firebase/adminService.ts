import { ref, get, update } from 'firebase/database';
import { rtdb } from './config';
import type { PlayerState } from '../game/types';

export async function getAllPlayers(): Promise<PlayerState[]> {
  if (!rtdb) return [];
  const snapshot = await get(ref(rtdb, 'players'));
  const val = snapshot.val();
  if (!val) return [];
  return Object.values(val) as PlayerState[];
}

export async function updatePlayerAdmin(uid: string, data: Partial<PlayerState>): Promise<void> {
  if (!rtdb) return;
  await update(ref(rtdb, `players/${uid}`), data);
}
