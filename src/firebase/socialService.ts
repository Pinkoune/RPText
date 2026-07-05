import { collection, getDocs, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './config';
import type { ClassId, PlayerState } from '../game/types';

/** Lit le profil public d'un joueur (best-effort). Null si indisponible. */
export async function fetchPublicProfile(uid: string): Promise<Partial<PlayerState> | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    return snap.exists() ? (snap.data() as Partial<PlayerState>) : null;
  } catch {
    return null;
  }
}

export interface LeaderRow {
  uid: string;
  name: string;
  photoURL: string | null;
  level: number;
  classId: ClassId;
  kills: number;
  gold: number;
  gambleNet: number;
  lastSeen?: number;
  title?: string;
  seasonId?: string | null;
  seasonPoints?: number;
  prestigeAura?: string;
  prestigeLevel?: number;
  auraColorOn?: boolean;
}

export interface OnlinePlayer {
  uid: string;
  name: string;
  level: number;
  /** Dernière activité (ms côté client). Sert à repérer les inactifs. */
  lastActive?: number;
}

/** Top joueurs par niveau. Vide en mode local. */
export async function fetchLeaderboard(max = 20): Promise<LeaderRow[]> {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as LeaderRow);
}

export function watchLeaderboard(max: number, onChange: (rows: LeaderRow[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as LeaderRow));
  });
}

/**
 * Ladder de la saison courante : top joueurs par points de saison.
 * On trie côté serveur par seasonPoints puis on filtre la saison courante
 * côté client (évite un index composite Firestore).
 */
export function watchSeasonLadder(currentSeasonId: string, max: number, onChange: (rows: LeaderRow[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'leaderboard'), orderBy('seasonPoints', 'desc'), limit(max * 2));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => d.data() as LeaderRow)
      .filter((r) => r.seasonId === currentSeasonId && (r.seasonPoints ?? 0) > 0)
      .slice(0, max);
    onChange(rows);
  });
}

/**
 * Déclare le joueur en ligne et écoute la liste des présents.
 * Utilise la Realtime Database (présence fiable via onDisconnect).
 */
// Référence de présence du joueur courant, pour rafraîchir son activité.
let myPresenceRef: ReturnType<typeof ref> | null = null;
let myPresenceData: { uid: string; name: string; level: number } | null = null;

export function trackPresence(
  me: { uid: string; name: string; level: number },
  onChange: (players: OnlinePlayer[]) => void,
): () => void {
  if (!isFirebaseConfigured || !rtdb) {
    onChange([{ ...me, lastActive: Date.now() }]);
    return () => {};
  }
  const meRef = ref(rtdb, `presence/${me.uid}`);
  myPresenceRef = meRef;
  myPresenceData = me;
  set(meRef, { ...me, ts: serverTimestamp(), lastActive: Date.now() });
  onDisconnect(meRef).remove();

  const listRef = ref(rtdb, 'presence');
  const unsub = onValue(listRef, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, OnlinePlayer>;
    onChange(Object.values(val));
  });
  return () => {
    myPresenceRef = null;
    myPresenceData = null;
    unsub();
  };
}

/** Rafraîchit l'horodatage d'activité du joueur (appelé à chaque action). */
export function touchPresence(): void {
  if (!myPresenceRef || !myPresenceData || !rtdb) return;
  set(myPresenceRef, { ...myPresenceData, ts: serverTimestamp(), lastActive: Date.now() });
}
