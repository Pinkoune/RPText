import { ref, onValue, runTransaction, set } from 'firebase/database';
import { rtdb, isFirebaseConfigured } from './config';

/** Un joueur ne peut frapper le boss qu'une fois toutes les 2 heures. */
export const BOSS_ATTACK_CD = 2 * 60 * 60 * 1000;

export interface BossContributor {
  name: string;
  dmg: number;
}

export interface WorldBoss {
  id: string;
  name: string;
  emoji: string;
  maxHp: number;
  hp: number;
  goldPool: number;
  fatePool: number;
  guildXpPool: number;
  spawnedAt: number;
  defeatedAt?: number;
  contributors: Record<string, BossContributor>;
}

const POOL = [
  { name: 'Kraghul, l\'Ancien', emoji: '🐲', maxHp: 6000, goldPool: 400, fatePool: 6, guildXpPool: 150 },
  { name: 'Némésis du Néant', emoji: '🕳️', maxHp: 10000, goldPool: 700, fatePool: 9, guildXpPool: 300 },
  { name: 'Titan de Givre', emoji: '🗿', maxHp: 8000, goldPool: 550, fatePool: 7, guildXpPool: 200 },
  { name: 'Phénix Corrompu', emoji: '🔥', maxHp: 12000, goldPool: 900, fatePool: 12, guildXpPool: 450 },
];

const RESPAWN_GRACE = 25_000; // 25s après la mort avant réapparition

function spawn(): WorldBoss {
  const b = POOL[Math.floor(Math.random() * POOL.length)];
  return {
    id: 'boss-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: b.name,
    emoji: b.emoji,
    maxHp: b.maxHp,
    hp: b.maxHp,
    goldPool: b.goldPool,
    fatePool: b.fatePool,
    guildXpPool: b.guildXpPool,
    spawnedAt: Date.now(),
    contributors: {},
  };
}

function needsRespawn(cur: WorldBoss | null): boolean {
  if (!cur) return true;
  if (cur.defeatedAt && Date.now() - cur.defeatedAt > RESPAWN_GRACE) return true;
  return false;
}

export const bossOnline = isFirebaseConfigured && !!rtdb;

// ── Mode local (pas de RTDB) ───────────────────────────────────────────────
const LOCAL_KEY = 'rptext.localBoss';
const LOCAL_LAST_KEY = 'rptext.localLastBoss';
let localBoss: WorldBoss | null = null;
let localLastBoss: WorldBoss | null = null;
const localListeners = new Set<(b: WorldBoss | null) => void>();
const localLastListeners = new Set<(b: WorldBoss | null) => void>();

function loadLocal(): WorldBoss | null {
  if (localBoss) return localBoss;
  const raw = localStorage.getItem(LOCAL_KEY);
  localBoss = raw ? (JSON.parse(raw) as WorldBoss) : null;
  return localBoss;
}
function saveLocal(b: WorldBoss | null) {
  localBoss = b;
  if (b) localStorage.setItem(LOCAL_KEY, JSON.stringify(b));
  localListeners.forEach((cb) => cb(b));
}
function saveLocalLast(b: WorldBoss) {
  localLastBoss = b;
  localStorage.setItem(LOCAL_LAST_KEY, JSON.stringify(b));
  localLastListeners.forEach((cb) => cb(b));
}

// ── API ────────────────────────────────────────────────────────────────────

export function watchBoss(cb: (b: WorldBoss | null) => void): () => void {
  if (!rtdb) {
    cb(loadLocal());
    localListeners.add(cb);
    return () => localListeners.delete(cb);
  }
  return onValue(ref(rtdb, 'world/boss'), (snap) => cb((snap.val() as WorldBoss | null) ?? null));
}

/**
 * Snapshot du dernier boss VAINCU (survit au respawn suivant), pour laisser
 * réclamer son butin même après la fenêtre de 25s (`RESPAWN_GRACE`) — un
 * joueur qui ouvre la fenêtre juste après le respawn perdait sinon
 * définitivement sa part, le boss précédent n'étant nulle part persisté.
 */
export function watchLastBoss(cb: (b: WorldBoss | null) => void): () => void {
  if (!rtdb) {
    if (!localLastBoss) {
      const raw = localStorage.getItem(LOCAL_LAST_KEY);
      localLastBoss = raw ? (JSON.parse(raw) as WorldBoss) : null;
    }
    cb(localLastBoss);
    localLastListeners.add(cb);
    return () => localLastListeners.delete(cb);
  }
  return onValue(ref(rtdb, 'world/lastBoss'), (snap) => cb((snap.val() as WorldBoss | null) ?? null));
}

/** Fait apparaître un boss si aucun n'est vivant (ou après le délai de respawn). */
export async function ensureBoss(): Promise<void> {
  if (!rtdb) {
    const cur = loadLocal();
    if (needsRespawn(cur)) {
      if (cur?.defeatedAt) saveLocalLast(cur);
      saveLocal(spawn());
    }
    return;
  }
  const database = rtdb;
  await runTransaction(ref(database, 'world/boss'), (cur: WorldBoss | null) => {
    if (!needsRespawn(cur)) return cur;
    if (cur?.defeatedAt) void set(ref(database, 'world/lastBoss'), cur);
    return spawn();
  });
}

/** Inflige des dégâts au boss de façon atomique. Retourne l'état après coup. */
export async function attackBoss(
  me: { uid: string; name: string },
  dmg: number,
): Promise<WorldBoss | null> {
  if (!rtdb) {
    const b = loadLocal();
    if (!b || b.hp <= 0) return b;
    b.hp = Math.max(0, b.hp - dmg);
    const c = b.contributors[me.uid] ?? { name: me.name, dmg: 0 };
    c.dmg += dmg;
    b.contributors[me.uid] = c;
    if (b.hp === 0 && !b.defeatedAt) b.defeatedAt = Date.now();
    saveLocal({ ...b });
    return localBoss;
  }
  const res = await runTransaction(ref(rtdb, 'world/boss'), (cur: WorldBoss | null) => {
    if (!cur || cur.hp <= 0) return cur;
    cur.hp = Math.max(0, cur.hp - dmg);
    const c = cur.contributors?.[me.uid] ?? { name: me.name, dmg: 0 };
    c.dmg += dmg;
    cur.contributors = { ...(cur.contributors ?? {}), [me.uid]: c };
    if (cur.hp === 0 && !cur.defeatedAt) cur.defeatedAt = Date.now();
    return cur;
  });
  return (res.snapshot.val() as WorldBoss | null) ?? null;
}

/** Récompense d'un contributeur (proportionnelle aux dégâts infligés). */
export function bossReward(boss: WorldBoss, uid: string): { gold: number; fateCoins: number; guildXp: number } {
  const dmg = boss.contributors?.[uid]?.dmg ?? 0;
  const share = dmg / boss.maxHp;
  return {
    gold: Math.round(share * boss.goldPool),
    fateCoins: Math.max(1, Math.round(share * boss.fatePool)),
    guildXp: Math.max(1, Math.round(share * boss.guildXpPool)),
  };
}
