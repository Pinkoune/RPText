import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './config';
import type { ClassId } from '../game/types';

export interface LeaderRow {
  uid: string;
  name: string;
  photoURL: string | null;
  level: number;
  classId: ClassId;
  kills: number;
  gold: number;
  gambleNet: number;
}

export interface OnlinePlayer {
  uid: string;
  name: string;
  level: number;
}

/** Top joueurs par niveau. Vide en mode local. */
export async function fetchLeaderboard(max = 20): Promise<LeaderRow[]> {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LeaderRow);
}

/**
 * Déclare le joueur en ligne et écoute la liste des présents.
 * Utilise la Realtime Database (présence fiable via onDisconnect).
 */
export function trackPresence(
  me: { uid: string; name: string; level: number },
  onChange: (players: OnlinePlayer[]) => void,
): () => void {
  if (!isFirebaseConfigured || !rtdb) {
    onChange([{ ...me }]);
    return () => {};
  }
  const meRef = ref(rtdb, `presence/${me.uid}`);
  set(meRef, { ...me, ts: serverTimestamp() });
  onDisconnect(meRef).remove();

  const listRef = ref(rtdb, 'presence');
  const unsub = onValue(listRef, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, OnlinePlayer>;
    onChange(Object.values(val));
  });
  return unsub;
}
