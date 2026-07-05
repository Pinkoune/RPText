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
  aura?: string | null;
  auraColorOn?: boolean;
}

export interface Team {
  id: string;
  name: string;
  hostUid: string;
  members: Record<string, Member>;
  dungeonId?: string;
  createdAt: number;
}

export interface GuildBoss {
  /** Identifiant de la semaine en cours (le boss tourne chaque semaine). */
  weekId: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  /** uid -> dégâts totaux infligés cette semaine. */
  contributors: Record<string, number>;
  defeatedAt?: number;
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
  boss?: GuildBoss;
  applications?: Record<string, Member>;
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
export async function createTeam(host: { uid: string; name: string; level: number; aura?: string | null; auraColorOn?: boolean }, name: string): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'teams'), {
    name: name.slice(0, 24) || 'Équipe',
    hostUid: host.uid,
    members: { [host.uid]: { name: host.name, level: host.level, aura: host.aura ?? null, auraColorOn: host.auraColorOn ?? true } },
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function joinTeam(teamId: string, me: { uid: string; name: string; level: number; aura?: string | null; auraColorOn?: boolean }): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'teams', teamId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Team, 'id'>;
    if (Object.keys(data.members).length >= TEAM_MAX) throw new Error('équipe pleine');
    tx.update(ref, { [`members.${me.uid}`]: { name: me.name, level: me.level, aura: me.aura ?? null, auraColorOn: me.auraColorOn ?? true } });
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
export async function createGuild(owner: { uid: string; name: string; level: number; aura?: string | null; auraColorOn?: boolean }, name: string, tag: string): Promise<string> {
  if (!db) throw new Error('offline');
  const ref = await addDoc(collection(db, 'guilds'), {
    name: name.slice(0, 24) || 'Guilde',
    tag: (tag || 'GLD').slice(0, 4).toUpperCase(),
    ownerUid: owner.uid,
    ownerName: owner.name,
    members: { [owner.uid]: { name: owner.name, level: owner.level, aura: owner.aura ?? null, auraColorOn: owner.auraColorOn ?? true } },
    xp: 0,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function applyGuild(guildId: string, me: { uid: string; name: string; level: number; aura?: string | null; auraColorOn?: boolean }): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Guild, 'id'>;
    if (Object.keys(data.members).length >= GUILD_MAX) throw new Error('guilde pleine');
    tx.update(ref, { [`applications.${me.uid}`]: { name: me.name, level: me.level, aura: me.aura ?? null, auraColorOn: me.auraColorOn ?? true } });
  });
}

export async function acceptApplication(guildId: string, targetUid: string): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Guild, 'id'>;
    const applicant = data.applications?.[targetUid];
    if (!applicant) throw new Error('Candidature introuvable');
    if (Object.keys(data.members).length >= GUILD_MAX) throw new Error('Guilde pleine');
    tx.update(ref, { 
      [`members.${targetUid}`]: applicant,
      [`applications.${targetUid}`]: deleteField()
    });
  });
}

export async function rejectApplication(guildId: string, targetUid: string): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'guilds', guildId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    tx.update(ref, { [`applications.${targetUid}`]: deleteField() });
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

// ─── Boss de guilde hebdomadaire ─────────────────────────────────────────────
// Objectif coopératif : chaque semaine, un boss partagé apparaît pour la guilde.
// Les membres l'attaquent (dégâts selon leur puissance), et sa récompense se
// réclame une fois par membre à sa défaite. Déterministe sur la semaine.

const GUILD_BOSS_ROSTER = [
  { name: 'Golem Ancestral', emoji: '🗿' },
  { name: 'Hydre des Abysses', emoji: '🐙' },
  { name: 'Colosse de Givre', emoji: '🧊' },
  { name: 'Dragon Céleste', emoji: '🐉' },
  { name: 'Léviathan', emoji: '🐋' },
];

/** Identifiant de la semaine (numéro de semaine depuis l'epoch). */
export function guildBossWeekId(now = Date.now()): string {
  return String(Math.floor(now / (7 * 24 * 60 * 60 * 1000)));
}

function freshBoss(weekId: string, memberCount: number, avgLevel: number): GuildBoss {
  const idx = (parseInt(weekId, 10) % GUILD_BOSS_ROSTER.length + GUILD_BOSS_ROSTER.length) % GUILD_BOSS_ROSTER.length;
  const pick = GUILD_BOSS_ROSTER[idx];
  const maxHp = Math.round(8000 + memberCount * 6000 + avgLevel * 400);
  return { weekId, name: pick.name, emoji: pick.emoji, hp: maxHp, maxHp, contributors: {} };
}

export interface GuildBossHit {
  boss: GuildBoss;
  dmg: number;
  defeated: boolean;
  justDefeated: boolean;
}

/** Attaque le boss de guilde. Crée/réinitialise le boss si la semaine a changé. */
export async function attackGuildBoss(guildId: string, uid: string, dmg: number): Promise<GuildBossHit | null> {
  if (!db) return null;
  const ref = doc(db, 'guilds', guildId);
  const wid = guildBossWeekId();
  const safeDmg = Number.isFinite(dmg) && dmg > 0 ? Math.round(dmg) : 0;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as Omit<Guild, 'id'>;
    const members = data.members ?? {};
    if (!(uid in members)) return null; // pas membre de cette guilde : pas d'attaque possible
    const memberCount = Object.keys(members).length || 1;
    const avgLevel = Object.values(members).reduce((s, m) => s + (m.level || 1), 0) / memberCount;

    let boss = data.boss;
    if (!boss || boss.weekId !== wid) boss = freshBoss(wid, memberCount, avgLevel);

    const justDefeated = boss.hp > 0 && boss.hp - safeDmg <= 0;
    boss.hp = Math.max(0, boss.hp - safeDmg);
    boss.contributors = { ...boss.contributors, [uid]: (boss.contributors[uid] ?? 0) + safeDmg };
    if (boss.hp <= 0 && !boss.defeatedAt) boss.defeatedAt = Date.now();

    tx.update(ref, { boss });
    return { boss, dmg: safeDmg, defeated: boss.hp <= 0, justDefeated };
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
  if (size <= 1) return 1.0; // seul dans son équipe : aucun bonus
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
