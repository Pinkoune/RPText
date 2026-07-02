import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  runTransaction,
  query,
  where,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

export const socialEnabled = isFirebaseConfigured && !!db;

export interface Member {
  name: string;
  level: number;
}

export interface Team {
  id: string;
  name: string;
  hostUid: string;
  members: Record<string, Member>;
  dungeonId?: string;
  createdAt: number;
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  ownerUid: string;
  ownerName: string;
  members: Record<string, Member>;
  xp: number;
  createdAt: number;
}

export interface Gift {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  gold: number;
  createdAt: number;
}

export const TEAM_MAX = 4;
export const GUILD_MAX = 30;
export const GUILD_CREATE_COST = 500;

/** Niveau de guilde : +1 tous les 1000 d'XP contribué. */
export function guildLevel(xp: number): { level: number; into: number; need: number } {
  const need = 1000;
  const x = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return { level: Math.floor(x / need) + 1, into: x % need, need };
}

// ─── Équipes ────────────────────────────────────────────────────────────────
export async function createTeam(host: { uid: string; name: string; level: number }, name: string): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'teams'), {
    name: name.slice(0, 24) || 'Équipe',
    hostUid: host.uid,
    members: { [host.uid]: { name: host.name, level: host.level } },
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function joinTeam(teamId: string, me: { uid: string; name: string; level: number }): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'teams', teamId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Team, 'id'>;
    if (Object.keys(data.members).length >= TEAM_MAX) throw new Error('équipe pleine');
    tx.update(ref, { [`members.${me.uid}`]: { name: me.name, level: me.level } });
  });
}

export async function leaveTeam(teamId: string, uid: string): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'teams', teamId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Team, 'id'>;
    const members = { ...data.members };
    delete members[uid];
    if (Object.keys(members).length === 0) tx.delete(ref);
    else tx.update(ref, { members });
  });
}

export async function setTeamDungeon(teamId: string, dungeonId: string | null): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'teams', teamId), {
    dungeonId: dungeonId ? dungeonId : deleteField(),
  });
}

let cachedTeams: Record<string, Team> = {};

export function listenTeams(cb: (t: Team[]) => void): () => void {
  if (!db) { cb([]); return () => {}; }
  return onSnapshot(collection(db, 'teams'), (snap) => {
    const teams = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, 'id'>) }));
    cachedTeams = {};
    for (const t of teams) cachedTeams[t.id] = t;
    cb(teams);
  });
}

// ─── Guildes ──────────────────────────────────────────────────────────────
export async function createGuild(owner: { uid: string; name: string; level: number }, name: string, tag: string): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'guilds'), {
    name: name.slice(0, 24) || 'Guilde',
    tag: (tag || 'GLD').slice(0, 4).toUpperCase(),
    ownerUid: owner.uid,
    ownerName: owner.name,
    members: { [owner.uid]: { name: owner.name, level: owner.level } },
    xp: 0,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function joinGuild(guildId: string, me: { uid: string; name: string; level: number }): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Guild, 'id'>;
    if (Object.keys(data.members).length >= GUILD_MAX) throw new Error('guilde pleine');
    tx.update(ref, { [`members.${me.uid}`]: { name: me.name, level: me.level } });
  });
}

export async function leaveGuild(guildId: string, uid: string): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Guild, 'id'>;
    const members = { ...data.members };
    delete members[uid];
    if (Object.keys(members).length === 0) tx.delete(ref);
    else tx.update(ref, { members });
  });
}

export async function contributeGuild(guildId: string, amount: number): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Guild, 'id'>;
    tx.update(ref, { xp: safeGuildXp(data.xp) + (Number.isFinite(amount) ? amount : 0) });
  });
}

let cachedGuilds: Record<string, Guild> = {};

export function listenGuilds(cb: (g: Guild[]) => void): () => void {
  if (!db) { cb([]); return () => {}; }
  return onSnapshot(collection(db, 'guilds'), (snap) => {
    const guilds = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Guild, 'id'>) }));
    cachedGuilds = {};
    for (const g of guilds) cachedGuilds[g.id] = g;
    cb(guilds);
  });
}

/** Renvoie le multiplicateur d'XP basé sur le niveau de la guilde (1.0 + 0.02 par niveau). */
export function getGuildBonus(guildId: string | null): number {
  if (!guildId || !cachedGuilds[guildId]) return 1.0;
  const xp = cachedGuilds[guildId].xp ?? 0;
  const lvl = guildLevel(xp).level;
  return 1.0 + (lvl * 0.02);
}

/** Répare une valeur d'XP de guilde corrompue (NaN/undefined) pour l'affichage. */
export function safeGuildXp(xp: number): number {
  return Number.isFinite(xp) && xp > 0 ? xp : 0;
}

// ─── Dons de ressources (SUPPRIMÉ) ─────────────────────────────────────────────
// Le système de don d'or a été supprimé au profit d'un buff passif d'équipe.

/** Renvoie le multiplicateur de récompenses d'équipe (1.0 = aucun, jusqu'à 1.20 pour 4 membres). */
export function getTeamBonus(teamId: string | null): number {
  if (!teamId || !cachedTeams[teamId]) return 1.0;
  const size = Object.keys(cachedTeams[teamId].members).length;
  // +5% par membre
  return 1.0 + (size * 0.05);
}

export async function transferTeamHost(teamId: string, currentHostUid: string, newHostUid: string): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'teams', teamId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Team, 'id'>;
    // Only transfer if the host hasn't changed
    if (data.hostUid === currentHostUid) {
      // Clean up offline members to avoid multiple members trying to claim
      const members = { ...data.members };
      delete members[currentHostUid];
      tx.update(ref, { hostUid: newHostUid, members });
    }
  });
}
