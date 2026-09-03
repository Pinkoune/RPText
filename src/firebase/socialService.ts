import { collection, getDocs, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './config';
import type { ClassId, PlayerState } from '../game/types';
import { fallbackPower } from '../game/power';

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
  xp?: number;
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
  /** Cote de Puissance (voir game/power.ts). Absente sur les lignes d'anciens clients. */
  power?: number;
}

export interface OnlinePlayer {
  uid: string;
  name: string;
  level: number;
  /** Dernière activité (ms côté client). Sert à repérer les inactifs. */
  lastActive?: number;
  /** Temps de jeu cumulé (ms) — diffusé via la présence, donc visible seulement en ligne. */
  playtimeMs?: number;
}

/** Puissance d'une ligne, avec repli pour les lignes d'avant la cote. */
export function rowPower(r: LeaderRow): number {
  return r.power ?? fallbackPower(r);
}

/**
 * Classement par Puissance, puis niveau, puis XP brute.
 *
 * Le tri se fait ICI plutôt que dans la requête Firestore : un `orderBy('power')`
 * exclurait purement et simplement les documents qui ne portent pas encore le
 * champ (les lignes écrites par un client plus ancien disparaîtraient du
 * tableau jusqu'à la prochaine connexion de leur propriétaire).
 *
 * Départage à Puissance égale par l'XP brute : comme le seuil pour passer au
 * niveau suivant ne dépend que du niveau (pas du joueur), comparer l'XP brute
 * entre deux joueurs du même niveau revient à comparer leur % de progression.
 */
function byPower(a: LeaderRow, b: LeaderRow): number {
  const d = rowPower(b) - rowPower(a);
  if (d !== 0) return d;
  if (b.level !== a.level) return b.level - a.level;
  return (b.xp ?? 0) - (a.xp ?? 0);
}

/** Comptes admin de service (nommés "admin") : masqués de tous les classements/recherches publics. */
function isHiddenName(name: string | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'admin';
}

/**
 * Facteur de sur-échantillonnage.
 *
 * La requête doit trier sur `level` (seul champ présent sur TOUTES les lignes,
 * y compris celles d'anciens clients), mais le classement affiché est celui de
 * la Puissance. Sans marge, `limit` couperait sur le mauvais critère : un joueur
 * qui vient de renaître est au Nv.1 tout en pesant très lourd en Puissance, et
 * il serait purement et simplement absent du tableau. On rapatrie donc large,
 * on trie, puis on tranche.
 */
const OVERFETCH = 4;

function rank(rows: LeaderRow[], max: number): LeaderRow[] {
  return rows.filter((r) => !isHiddenName(r.name)).sort(byPower).slice(0, max);
}

/** Top joueurs par Puissance. Vide en mode local. */
export async function fetchLeaderboard(max = 20): Promise<LeaderRow[]> {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max * OVERFETCH));
  const snap = await getDocs(q);
  return rank(snap.docs.map((d) => d.data() as LeaderRow), max);
}

export function watchLeaderboard(max: number, onChange: (rows: LeaderRow[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max * OVERFETCH));
  return onSnapshot(q, (snap) => {
    onChange(rank(snap.docs.map((d) => d.data() as LeaderRow), max));
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
      .filter((r) => r.seasonId === currentSeasonId && (r.seasonPoints ?? 0) > 0 && !isHiddenName(r.name))
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
let myPresenceData: { uid: string; name: string; level: number; playtimeMs?: number } | null = null;

export function trackPresence(
  me: { uid: string; name: string; level: number; playtimeMs?: number },
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
    onChange(Object.values(val).filter((o) => !isHiddenName(o.name)));
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

/** Met à jour le temps de jeu diffusé en présence (PresenceTracker, toutes les 30s). */
export function updatePresencePlaytime(playtimeMs: number): void {
  if (!myPresenceRef || !myPresenceData || !rtdb) return;
  myPresenceData = { ...myPresenceData, playtimeMs };
  set(myPresenceRef, { ...myPresenceData, ts: serverTimestamp(), lastActive: Date.now() });
}
