import type { PlayerState, ClassId, Stats, QuestState, ItemDef } from './types';
import { CLASSES, xpToNext, xpToNextV1 } from './classes';
import { getTeamBonus, getGuildBonus } from '../firebase/groupsService';
import { item } from './items';
import { BIOMES, BIOME_LIST } from './biomes';
import { familiarBonus } from './familiars';
import { talentMods } from './talents';

/** Arme de départ selon la classe. */
export function starterWeapon(classId: ClassId): string {
  return classId === 'mage' || classId === 'healer' ? 'apprentice_wand' : 'rusty_sword';
}

/** Le joueur peut-il équiper cet objet (restriction de classe sur les armes) ? */
export function canEquip(p: PlayerState, it: ItemDef): boolean {
  // Invalider l'ancienne faucheuse du vide (sans suffixe de qualité)
  if (it.id === 'void_reaver') return false;
  // Invalider les objets cheatés de l'ancienne boutique s'ils n'ont pas été craftés (pas de suffixe de qualité)
  const OP_SHOP_ITEMS = ['frost_glaive', 'frost_scepter', 'steel_plate', 'frost_plate', 'lucky_coin', 'gambler_ring', 'iron_spear', 'crystal_staff', 'ember_axe'];
  if (OP_SHOP_ITEMS.includes(it.id)) return false;
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
  // Recalcul unique des niveaux sous la nouvelle courbe d'XP (v2, plus dure).
  // On reconstitue l'XP totale sous l'ancienne courbe, puis on re-nivelle.
  if (p.curveVersion !== 2) {
    let total = p.xp || 0;
    for (let n = 1; n < (p.level || 1); n++) total += xpToNextV1(n);
    let lvl = 1;
    let rem = total;
    while (rem >= xpToNext(lvl)) { rem -= xpToNext(lvl); lvl += 1; }
    p.level = lvl;
    p.xp = rem;
    p.curveVersion = 2;
  }
  if (!p.quests) p.quests = freshQuestState();
  if (!p.settledDuels) p.settledDuels = [];
  if (!p.bossClaims) p.bossClaims = [];
  if (!p.settledSales) p.settledSales = [];
  if (!p.settledCJDuels) p.settledCJDuels = [];
  if (!p.settledDungeons) p.settledDungeons = [];
  if (p.cjWins == null) p.cjWins = 0;
  if (p.teamId === undefined) p.teamId = null;

  // Déséquiper les objets devenus invalides (ex: objets cheatés achetés en boutique)
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const id = p.equipped[slot];
    if (id) {
      const it = item(id);
      if (!it || !canEquip(p, it)) {
        p.equipped[slot] = null;
        if (it) addItem(p, id, 1);
      }
    }
  }

  // Vérifier si le joueur est dans un biome trop élevé pour son niveau (ex: à cause d'un changement d'équilibrage)
  const currentBiome = BIOMES[p.biome];
  if (currentBiome && p.level < currentBiome.minLevel) {
    // Le renvoyer au biome le plus haut possible
    const available = BIOME_LIST.filter(b => p.level >= b.minLevel);
    if (available.length > 0) {
      p.biome = available[available.length - 1].id;
    } else {
      p.biome = 'forest';
    }
  }

  if (!p.familiars) p.familiars = {};
  if (p.activeFamiliarId === undefined) p.activeFamiliarId = null;
  if (p.guildId === undefined) p.guildId = null;
  if (!p.settledGifts) p.settledGifts = [];
  if (!p.gatherXp) p.gatherXp = { chop: 0, mine: 0, fish: 0, forage: 0 };
  if (p.farmXp == null) {
    // Récupère l'XP de récolte des anciennes sauvegardes (somme des métiers).
    p.farmXp = Object.values(p.gatherXp ?? {}).reduce((s, v) => s + (v || 0), 0);
  }
  if (p.craftXp == null) p.craftXp = 0;
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
  // Rework de l'arbre de talents : remap des ids renommés (aucun point perdu).
  const TALENT_ID_REMAP: Record<string, string> = { a_crit: 'a_aim', a_dodge: 'a_step', h_armor: 'h_bless' };
  for (const [oldId, newId] of Object.entries(TALENT_ID_REMAP)) {
    if (p.talents[oldId] != null) {
      p.talents[newId] = (p.talents[newId] ?? 0) + p.talents[oldId];
      delete p.talents[oldId];
    }
  }

  // Biome level constraint verification
  const maxAllowedBiomeIdx = BIOME_LIST.findIndex((b, idx, arr) => 
    idx === arr.length - 1 || p.level < arr[idx + 1].minLevel
  );
  const currentBiomeIdx = BIOME_LIST.findIndex(b => b.id === p.biome);
  if (currentBiomeIdx > maxAllowedBiomeIdx && maxAllowedBiomeIdx !== -1) {
    p.biome = BIOME_LIST[maxAllowedBiomeIdx].id;
  }
  // Déséquipe les objets achetés (sans qualité) et convertit les matériaux buggés
  const toDelete: string[] = [];
  const toAdd: Record<string, number> = {};

  for (const [id, qty] of Object.entries(p.inventory)) {
    const it = item(id);
    if (!it) continue;
    
    // Si c'est un matériau ou un consommable mais qu'il a une qualité
    if (id.includes(':q') && ['material', 'consumable'].includes(it.slot)) {
      const baseId = id.split(':')[0];
      toAdd[baseId] = (toAdd[baseId] || 0) + (qty || 0);
      toDelete.push(id);
    }
  }

  for (const id of toDelete) {
    delete p.inventory[id];
  }
  for (const [id, qty] of Object.entries(toAdd)) {
    p.inventory[id] = (p.inventory[id] || 0) + qty;
  }

  if (p.equipped.weapon && !canEquip(p, item(p.equipped.weapon)!)) p.equipped.weapon = null;
  // Arme équipée non autorisée pour la classe (ex: mage avec une épée) : on la
  // déséquipe et on s'assure que la classe a une arme de départ adaptée.
  const w = p.equipped.weapon ? item(p.equipped.weapon)! : null;
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
    settledCJDuels: [],
    settledDungeons: [],
    cjWins: 0,
    bossClaims: [],
    settledSales: [],
    teamId: null,
    guildId: null,
    settledGifts: [],
    gatherXp: { chop: 0, mine: 0, fish: 0, forage: 0 },
    farmXp: 0,
    craftXp: 0,
    dungeonClears: {},
    talentPoints: 0,
    talents: {},
    curveVersion: 2,
    familiars: {},
    activeFamiliarId: null,
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
    const it = id ? item(id)! : undefined;
    if (it && canEquip(p, it)) {
      atk += it.atk ?? 0;
      def += it.def ?? 0;
      maxHp += it.hp ?? 0;
    }
  }
  const fam = familiarBonus(p);
  atk += fam.atk;
  def += fam.def;
  maxHp += fam.maxHp;

  // Mods de stats permanentes des talents (pourcentages, appliqués en dernier).
  const mods = talentMods(p);
  atk = Math.round(atk * (1 + mods.atkPct));
  def = Math.round(def * (1 + mods.defPct));
  maxHp = Math.round(maxHp * (1 + mods.hpPct));

  return { maxHp, atk, def, hp: Math.min(p.hp, maxHp) };
}

/** Équipe un objet de l'inventaire (remet l'ancien dans le sac). Retourne true si ok. */
export function equipItem(p: PlayerState, id: string): boolean {
  const it = item(id)!;
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

/** Applique les multiplicateurs globaux (équipe, guilde) à l'XP et à l'Or. */
export function applyBonuses(p: PlayerState, base: { xp: number; gold: number }): { xp: number; gold: number } {
  const teamMult = getTeamBonus(p.teamId);
  const guildMult = getGuildBonus(p.guildId);
  // Seule l'XP bénéficie du bonus de guilde
  return {
    xp: Math.floor(base.xp * teamMult * guildMult),
    gold: Math.floor(base.gold * teamMult),
  };
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
