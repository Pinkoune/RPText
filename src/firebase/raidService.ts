import { ref, set, onValue } from 'firebase/database';
import { rtdb } from './config';

export interface RaidBroadcast {
  key: string;
  /** Fin des inscriptions / démarrage (ms). */
  startsAt: number;
}

const SIGNUP_MS = 10 * 60 * 1000;

/** Admin : ouvre une fenêtre de raid immédiate (inscriptions 10 min). */
export async function broadcastRaid(): Promise<void> {
  if (!rtdb) throw new Error('offline');
  const now = Date.now();
  const b: RaidBroadcast = { key: `admin-${now}`, startsAt: now + SIGNUP_MS };
  await set(ref(rtdb, 'world/raid'), b);
}

/** Écoute la fenêtre de raid diffusée (admin). */
export function listenRaidBroadcast(cb: (b: RaidBroadcast | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, 'world/raid'), (snap) => cb((snap.val() as RaidBroadcast | null) ?? null));
}
