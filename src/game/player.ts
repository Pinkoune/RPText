import type { PlayerState, ClassId, Stats, QuestState, ItemDef } from './types';
import { CLASSES, xpToNext } from './classes';
import { getTeamBonus, getGuildBonus } from '../firebase/groupsService';
import { item } from './items';
import { RECIPES, getCraftLevel } from './crafting';
import { BIOMES, BIOME_LIST } from './biomes';
import { familiarBonus, familiarAbility } from './familiars';
import { talentMods } from './talents';
import { activeEventEffect } from './events';
import { ensureSeason, seasonId } from './season';

/** Incrémenter force un reset unique des talents de tous les joueurs (bugfix). */
export const TALENT_RESET_VERSION = 3;

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
  const ALLOWED_SLOTS = ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'];
  if (!ALLOWED_SLOTS.includes(it.slot)) return false;
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
  // (v2) on utilisait l'ancienne courbe, mais maintenant tout a migré
  if (p.curveVersion !== 2) {
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
  
  // -- V2 Équipement --
  if (!p.gearDurability) {
    p.gearDurability = {};
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      if (p.equipped[slot]) {
        const def = item(p.equipped[slot]!);
        if (def && def.maxDurability) {
          p.gearDurability[def.id] = def.maxDurability;
        }
      }
    }
  } else {
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      delete p.gearDurability[slot as string];
    }
  }

  if (!p.gearStars) {
    p.gearStars = {};
  } else {
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      delete p.gearStars[slot as string];
    }
  }
  
  // -- V3 Normalisation anti-carry --
  // Certains joueurs bas niveau ont reçu énormément d'XP en se faisant "carry" dans des donjons HL.
  // On recalcule une "XP max légitime" basée sur leurs faits d'armes pour corriger les niveaux absurdes.
  if ((p as any).levelNormalizedVersion !== 2) {
    let totalXp = p.xp;
    for (let l = 1; l < p.level; l++) {
      totalXp += xpToNext(l);
    }
    
    const totalClears = Object.values(p.dungeonClears || {}).reduce((a, b) => a + b, 0);
    // Un kill donne max ~50xp, un donjon donne max ~800xp, + 3000xp buffer de quêtes/bonus
    const maxLegitXp = (p.kills * 50) + (totalClears * 800) + 3000;
    
    if (totalXp > maxLegitXp && p.level > 2) {
      // Le joueur a été propulsé illégitimement. On le plafonne à la maxLegitXp.
      let newLevel = 1;
      let remainingXp = maxLegitXp;
      
      while (remainingXp >= xpToNext(newLevel) && newLevel < 30) {
        remainingXp -= xpToNext(newLevel);
        newLevel++;
      }
      
      p.level = newLevel;
      p.xp = remainingXp;
      // On corrige ses HP et on reset ses points de talent pour correspondre au nouveau niveau
      p.hp = CLASSES[p.classId].base.maxHp; 
      p.talentPoints = Math.max(0, p.level - 1);
      p.talents = {}; // Reset complet de l'arbre
      
      // Downgrade du biome si nécessaire
      const currentBiomeDef = BIOMES[p.biome];
      if (currentBiomeDef && currentBiomeDef.minLevel > p.level) {
        const allowedBiomes = BIOME_LIST.filter(b => b.minLevel <= p.level);
        if (allowedBiomes.length > 0) {
          p.biome = allowedBiomes[allowedBiomes.length - 1].id;
        }
      }
    }
    
    (p as any).levelNormalizedVersion = 2;
  }

  if (p.equipped.tool === undefined) p.equipped.tool = null;
  if (p.equipped.profession_armor === undefined) p.equipped.profession_armor = null;

  // Déséquiper les objets devenus invalides (ex: objets cheatés achetés en boutique)
  // Ou les objets qui ont changé de slot (ex: armes devenues outils)
  for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
    const id = p.equipped[slot];
    if (id) {
      const it = item(id);
      if (!it || !canEquip(p, it) || it.slot !== slot) {
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
  ensureSeason(p);

  // Auto-réparation : une valeur NaN (issue d'un ancien multiplicateur de guilde/équipe
  // cassé) se propageait et se sauvegardait définitivement, affichant « NaN » partout.
  // On remet à zéro toute valeur numérique non finie, à chaque migration (pas seulement
  // une fois), pour rattraper les sauvegardes déjà corrompues.
  if (!Number.isFinite(p.xp)) p.xp = 0;
  if (!Number.isFinite(p.farmXp)) p.farmXp = 0;
  if (!Number.isFinite(p.craftXp)) p.craftXp = 0;
  if (!Number.isFinite(p.gold)) p.gold = 0;
  if (!Number.isFinite(p.level) || p.level < 1) p.level = 1;
  
  // Correction pour les familiers dont l'XP est passée en NaN
  if (p.familiars) {
    for (const [fId, fXp] of Object.entries(p.familiars)) {
      if (!Number.isFinite(fXp)) {
        p.familiars[fId] = 0;
      }
    }
  }

  if (!p.dungeonClears) p.dungeonClears = {};
  if (!p.statistics) {
    p.statistics = {
      goldEarned: p.gold,
      gamblesPlayed: 0,
      gamblesWon: 0,
      mobsKilled: {},
      mobsEncountered: {},
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

  // Reset forcé unique : le rework des talents avait conservé les anciens points
  // investis EN PLUS des nouveaux points de niveau, permettant d'en avoir trop.
  // On réinitialise une fois et on redonne l'équivalent exact du niveau actuel.
  if (p.talentResetVersion !== TALENT_RESET_VERSION) {
    p.talents = {};
    p.talentPoints = Math.max(0, p.level - 1);
    p.equippedSkills = []; // On déséquipe tout lors d'un reset majeur
    p.talentResetVersion = TALENT_RESET_VERSION;
  }
  
  if (!p.equippedSkills) p.equippedSkills = [];

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

  // Force unequip invalid items (class req, craft req, level req)
  const craftLvl = getCraftLevel(p.craftXp).level;
  for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
    const eqId = p.equipped[slot];
    if (!eqId) continue;
    const it = item(eqId);
    if (!it) {
      p.equipped[slot] = null;
      continue;
    }
    
    let isInvalid = !canEquip(p, it);
    if (!isInvalid) {
      const r = RECIPES.find(x => x.output === it.id);
      if (r && craftLvl < r.levelReq) isInvalid = true;
      if (!r && it.reqLevel && p.level < it.reqLevel) isInvalid = true;
    }
    
    if (isInvalid) {
      addItem(p, eqId, 1);
      p.equipped[slot] = null;
    }
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
    equipped: { weapon, armor: null, trinket: null, tool: null, profession_armor: null },
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
      mobsEncountered: {},
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
    equippedSkills: [],
    talentResetVersion: TALENT_RESET_VERSION,
    curveVersion: 2,
    familiars: {},
    activeFamiliarId: null,
    claimedAchievements: [],
    loginStreak: 0,
    seasonId: seasonId(),
    seasonPoints: 0,
    gearDurability: { [weapon]: item(weapon)?.maxDurability ?? 0 },
    gearStars: {},
    createdAt: now,
    lastSeen: now,
  };
}

export function deriveStats(p: PlayerState): Stats {
  const cls = CLASSES[p.classId];
  const lv = p.level - 1;
  let maxHp = cls.base.maxHp + cls.growth.maxHp * lv;
  let atk = cls.base.atk + cls.growth.atk * lv;
  let def = cls.base.def + cls.growth.def * lv;
  let maxCp = 0;
  let maxGp = 0;

  const setIdsCount: Record<string, number> = {};
  let weaponElement: string | undefined;
  let weaponDmgType: string | undefined;
  let armorElement: string | undefined;
  let trinketId: string | undefined;
  let toolId: string | undefined;
  let professionArmorId: string | undefined;

  for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
    const id = p.equipped[slot];
    if (id) {
      const it = item(id);
      if (it) {
        const dur = p.gearDurability ? (p.gearDurability[id] ?? it.maxDurability ?? 1) : 1;
        const broken = it.maxDurability && dur <= 0;
        if (!broken && canEquip(p, it)) {
          if (slot === 'weapon') {
            weaponElement = it.element;
            weaponDmgType = it.dmgType;
          }
          if (slot === 'armor') {
            armorElement = it.element;
          }
          if (slot === 'trinket') {
            trinketId = it.id;
          }
          if (slot === 'tool') {
            toolId = it.id;
          }
          if (slot === 'profession_armor') {
            professionArmorId = it.id;
          }

          const stars = p.gearStars ? (p.gearStars[id] || 0) : 0;
          const starMult = 1 + (stars * 0.1); // +10% stats per star
          
          atk += Math.floor((it.atk ?? 0) * starMult);
          def += Math.floor((it.def ?? 0) * starMult);
          maxHp += Math.floor((it.hp ?? 0) * starMult);
          maxCp += Math.floor((it.maxCp ?? 0) * starMult);
          maxGp += Math.floor((it.maxGp ?? 0) * starMult);
          
          if (it.setId) {
            setIdsCount[it.setId] = (setIdsCount[it.setId] || 0) + 1;
          }
        }
      }
    }
  }
  
  const fam = familiarBonus(p);
  atk += fam.atk;
  def += fam.def;
  maxHp += fam.maxHp;

  // Mods de stats permanentes des talents + événements (pourcentages, en dernier).
  const mods = talentMods(p);
  const evt = activeEventEffect(p.biome);
  
  // Bonus de Sets
  let setAtkPct = 0;
  let setDefPct = 0;
  let setHpPct = 0;
  
  for (const [setId, count] of Object.entries(setIdsCount)) {
    if (count >= 3) { // Full set
      if (setId === 'fire_set') setAtkPct += 0.2;
      if (setId === 'frost_set') setDefPct += 0.2;
      if (setId === 'earth_set') setHpPct += 0.2;
      if (setId === 'wind_set') { setAtkPct += 0.1; setHpPct += 0.1; }
      if (setId === 'water_set') { setHpPct += 0.1; setDefPct += 0.1; }
      if (setId === 'light_set') { setAtkPct += 0.1; setDefPct += 0.1; }
      if (setId === 'dark_set') { setAtkPct += 0.25; setHpPct -= 0.1; }
      if (setId === 'obsidian_set') { setDefPct += 0.25; setHpPct += 0.1; }
    }
  }

  atk = Math.round(atk * (1 + mods.atkPct + evt.atkPct + setAtkPct));
  def = Math.round(def * (1 + mods.defPct + evt.defPct + setDefPct));
  maxHp = Math.round(maxHp * (1 + mods.hpPct + evt.hpPct + setHpPct));

  return { level: p.level, maxHp, atk, def, hp: Math.min(p.hp, maxHp), maxCp, maxGp, weaponElement,
    weaponDmgType,
    armorElement,
    trinketId,
    toolId,
    professionArmorId,
    familiar: familiarAbility(p) ?? undefined,
  };
}

export function equipItem(p: PlayerState, id: string): boolean {
  const it = item(id)!;
  if (!it || !canEquip(p, it)) return false;
  if ((p.inventory[id] ?? 0) <= 0) return false;
  const slot = it.slot as 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor';
  const prev = p.equipped[slot];
  p.equipped[slot] = id;
  
  if (it.maxDurability) {
    if (!p.gearDurability) p.gearDurability = {};
    if (p.gearDurability[id] === undefined) {
      p.gearDurability[id] = it.maxDurability;
    }
  }

  removeItem(p, id, 1);
  if (prev) addItem(p, prev, 1);
  return true;
}

/** Déséquipe un slot (remet l'objet dans le sac). */
export function unequipItem(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor'): void {
  const prev = p.equipped[slot];
  if (prev) {
    addItem(p, prev, 1);
    p.equipped[slot] = null;
  }
}

/** Applique les multiplicateurs globaux (équipe, guilde) à l'XP et à l'Or. */
export function applyBonuses(p: PlayerState, base: { xp: number; gold: number }): { xp: number; gold: number } {
  // Garde-fous : un multiplicateur non fini empoisonnerait durablement l'XP/Or du joueur.
  const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const teamMult = fin(getTeamBonus(p.teamId), 1);
  const guildMult = fin(getGuildBonus(p.guildId), 1);
  const evt = activeEventEffect(p.biome);
  const baseXp = fin(base.xp, 0);
  const baseGold = fin(base.gold, 0);
  // Seule l'XP bénéficie du bonus de guilde
  return {
    xp: Math.floor(baseXp * teamMult * guildMult * (1 + fin(evt.xpMult, 0))),
    gold: Math.floor(baseGold * teamMult * (1 + fin(evt.goldMult, 0))),
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

/** Réduit la durabilité des équipements. Appelée après un combat (chasse, donjon). */
export function reduceDurability(p: PlayerState, hitsTaken: number, hitsDealt: number) {
  if (!p.gearDurability) return;
  
  if (p.equipped.weapon && (p.gearDurability[p.equipped.weapon] ?? 0) > 0) {
    p.gearDurability[p.equipped.weapon] = Math.max(0, p.gearDurability[p.equipped.weapon] - hitsDealt);
  }
  if (p.equipped.armor && (p.gearDurability[p.equipped.armor] ?? 0) > 0) {
    p.gearDurability[p.equipped.armor] = Math.max(0, p.gearDurability[p.equipped.armor] - hitsTaken);
  }
  if (p.equipped.trinket && (p.gearDurability[p.equipped.trinket] ?? 0) > 0) {
    p.gearDurability[p.equipped.trinket] = Math.max(0, p.gearDurability[p.equipped.trinket] - hitsTaken);
  }
}

export function ascendPlayer(p: PlayerState, newClassId: ClassId): boolean {
  if (p.level < 20) return false;
  p.classId = newClassId;
  // Ascension resets talents
  p.talents = {};
  p.equippedSkills = [];
  p.talentPoints = Math.max(0, p.level - 1);
  return true;
}
