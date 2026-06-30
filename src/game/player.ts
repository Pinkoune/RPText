import type { PlayerState, ClassId, Stats, QuestState, ItemDef } from './types';
import { CLASSES, xpToNext } from './classes';
import { ITEMS } from './items';

/** Arme de départ selon la classe. */
export function starterWeapon(classId: ClassId): string {
  return classId === 'mage' || classId === 'healer' ? 'apprentice_wand' : 'rusty_sword';
}

/** Le joueur peut-il équiper cet objet (restriction de classe sur les armes) ? */
export function canEquip(p: PlayerState, it: ItemDef): boolean {
  if (it.slot !== 'weapon' && it.slot !== 'armor' && it.slot !== 'trinket') return false;
  if (it.classes && !it.classes.includes(p.classId)) return false;
  return true;
}

export function freshQuestState(now = Date.now()): QuestState {
  return {
    daily: { start: now, counters: {}, claimed: [] },
    weekly: { start: now, counters: {}, claimed: [] },
  };
}

/** Complète les champs manquants des anciennes sauvegardes (migration douce). */
export function migratePlayer(p: PlayerState): PlayerState {
  if (!p.quests) p.quests = freshQuestState();
  if (!p.settledDuels) p.settledDuels = [];
  if (!p.bossClaims) p.bossClaims = [];
  if (!p.settledSales) p.settledSales = [];
  if (!p.gatherXp) p.gatherXp = { chop: 0, mine: 0, fish: 0, forage: 0 };
  if (p.farmXp == null) {
    // Récupère l'XP de récolte des anciennes sauvegardes (somme des métiers).
    p.farmXp = Object.values(p.gatherXp ?? {}).reduce((s, v) => s + (v || 0), 0);
  }
  if (!p.dungeonClears) p.dungeonClears = {};
  if (!p.statistics) {
    p.statistics = {
      goldEarned: p.gold,
      gamblesPlayed: 0,
      gamblesWon: 0,
      mobsKilled: {},
    };
  }
  if (p.title == null) p.title = 'Aventurier';
  if (!p.talents) {
    p.talents = {};
    // Crédite rétroactivement les points pour les niveaux déjà atteints.
    p.talentPoints = Math.max(0, p.level - 1);
  }
  // Arme équipée non autorisée pour la classe (ex: mage avec une épée) : on la
  // déséquipe et on s'assure que la classe a une arme de départ adaptée.
  const w = p.equipped.weapon ? ITEMS[p.equipped.weapon] : null;
  if (w && !canEquip(p, w)) {
    addItem(p, p.equipped.weapon!, 1);
    p.equipped.weapon = null;
  }
  if (!p.equipped.weapon) {
    const start = starterWeapon(p.classId);
    if ((p.inventory[start] ?? 0) <= 0) addItem(p, start, 1);
    removeItem(p, start, 1);
    p.equipped.weapon = start;
  }
  return p;
}

export function createPlayer(
  uid: string,
  name: string,
  photoURL: string | null,
  classId: ClassId,
): PlayerState {
  const cls = CLASSES[classId];
  const now = Date.now();
  const weapon = starterWeapon(classId);
  return {
    uid,
    name,
    title: 'Aventurier débutant',
    photoURL,
    classId,
    level: 1,
    xp: 0,
    gold: 50,
    fateCoins: 5,
    gems: 0,
    hp: cls.base.maxHp,
    inventory: { potion: 2 },
    equipped: { weapon, armor: null, trinket: null },
    biome: 'forest',
    unlockedBiomes: ['forest'],
    cooldowns: {},
    kills: 0,
    deaths: 0,
    gambleNet: 0,
    statistics: {
      goldEarned: 50,
      gamblesPlayed: 0,
      gamblesWon: 0,
      mobsKilled: {},
    },
    quests: freshQuestState(now),
    settledDuels: [],
    bossClaims: [],
    settledSales: [],
    gatherXp: { chop: 0, mine: 0, fish: 0, forage: 0 },
    farmXp: 0,
    dungeonClears: {},
    talentPoints: 0,
    talents: {},
    createdAt: now,
    lastSeen: now,
  };
}

/** Stats effectives = base de classe + croissance par niveau + équipement. */
export function deriveStats(p: PlayerState): Stats {
  const cls = CLASSES[p.classId];
  const lv = p.level - 1;
  let maxHp = cls.base.maxHp + cls.growth.maxHp * lv;
  let atk = cls.base.atk + cls.growth.atk * lv;
  let def = cls.base.def + cls.growth.def * lv;

  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const id = p.equipped[slot];
    const it = id ? ITEMS[id] : undefined;
    if (it && canEquip(p, it)) {
      atk += it.atk ?? 0;
      def += it.def ?? 0;
      maxHp += it.hp ?? 0;
    }
  }
  return { maxHp, atk, def, hp: Math.min(p.hp, maxHp) };
}

/** Équipe un objet de l'inventaire (remet l'ancien dans le sac). Retourne true si ok. */
export function equipItem(p: PlayerState, id: string): boolean {
  const it = ITEMS[id];
  if (!it || !canEquip(p, it)) return false;
  if ((p.inventory[id] ?? 0) <= 0) return false;
  const slot = it.slot as 'weapon' | 'armor' | 'trinket';
  const prev = p.equipped[slot];
  p.equipped[slot] = id;
  removeItem(p, id, 1);
  if (prev) addItem(p, prev, 1);
  return true;
}

/** Déséquipe un slot (remet l'objet dans le sac). */
export function unequipItem(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket'): void {
  const prev = p.equipped[slot];
  if (prev) {
    addItem(p, prev, 1);
    p.equipped[slot] = null;
  }
}

/** Applique de l'XP et gère les montées de niveau. Retourne les niveaux gagnés. */
export function grantXp(p: PlayerState, amount: number): number {
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    gained += 1;
  }
  if (gained > 0) {
    // Soin complet à la montée de niveau + points de talent.
    p.hp = deriveStats(p).maxHp;
    p.talentPoints = (p.talentPoints ?? 0) + gained;
  }
  return gained;
}

export function addItem(p: PlayerState, id: string, qty = 1) {
  p.inventory[id] = (p.inventory[id] ?? 0) + qty;
}

export function removeItem(p: PlayerState, id: string, qty = 1): boolean {
  const have = p.inventory[id] ?? 0;
  if (have < qty) return false;
  if (have === qty) delete p.inventory[id];
  else p.inventory[id] = have - qty;
  return true;
}

/** Cooldown restant en ms (0 si prêt). */
export function cooldownLeft(p: PlayerState, key: string, durationMs: number): number {
  const last = p.cooldowns[key] ?? 0;
  return Math.max(0, last + durationMs - Date.now());
}
