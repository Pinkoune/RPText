import type { PlayerState, ClassId, Stats, QuestState, ItemDef, EquipmentBuild, EquippedGear } from './types';
import { CLASSES, xpToNext, xpToNextV3, MAX_LEVEL } from './classes';
import { getTeamBonus, getGuildBonus, getGuildGoldBonus } from '../firebase/groupsService';
import { item, isGearId, hasInstanceTag, mintInstanceId, addItemToInventory } from './items';
import { RECIPES, getCraftLevel } from './crafting';
import { BIOMES, BIOME_LIST } from './biomes';
import { familiarBonus, familiarAbility } from './familiars';
import { talentMods } from './talents';
import { activeEventEffect } from './events';
import { ensureSeason, seasonId } from './season';
import { prestigeBonus } from './prestige';

/** Incrémenter force un reset unique des talents de tous les joueurs (bugfix). */
export const TALENT_RESET_VERSION = 3;

/** Arme de départ selon la classe (compare à la classe DE BASE, pas la sous-classe). */
export function starterWeapon(classId: ClassId): string {
  const base = CLASSES[classId]?.parent ?? classId;
  return base === 'mage' || base === 'healer' ? 'apprentice_wand' : 'rusty_sword';
}

export function getEquipError(p: PlayerState, it: ItemDef): string | null {
  if (p.ignoreRestrictions) return null;
  
  if (it.id === 'void_reaver') return "Cette arme semble brisée...";

  const ALLOWED_SLOTS = ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'];
  if (!ALLOWED_SLOTS.includes(it.slot)) return "Cet objet ne peut pas être équipé.";

  // Restriction de classe : les objets listent les classes de BASE. Après une
  // ascension, on compare donc à la classe parente (paladin → warrior, etc.).
  if (it.classes) {
    const family = CLASSES[p.classId]?.parent ?? p.classId;
    if (!it.classes.includes(p.classId) && !it.classes.includes(family)) {
      return `Ta classe (${CLASSES[p.classId]?.name ?? p.classId}) ne peut pas équiper ${it.name}.`;
    }
  }
  
  const r = RECIPES.find(x => x.output === it.id);
  if (r) {
    const craftLvl = getCraftLevel(p.craftXp || 0).level;
    if (craftLvl < r.levelReq) return `Niveau d'artisanat ${r.levelReq} requis.`;
  } else if (it.reqLevel && p.level < it.reqLevel) {
    return `Niveau ${it.reqLevel} requis.`;
  }
  
  return null;
}

/** Le joueur peut-il équiper cet objet (restriction de classe sur les armes) ? */
export function canEquip(p: PlayerState, it: ItemDef): boolean {
  return getEquipError(p, it) === null;
}

export function freshQuestState(now = Date.now()): QuestState {
  return {
    daily: { start: now, counters: {}, claimed: [] },
    weekly: { start: now, counters: {}, claimed: [] },
  };
}

/** Complète les champs manquants des anciennes sauvegardes (migration douce). */
export function migratePlayer(p: PlayerState): PlayerState {
  // Courbe v4 (niveau max 50) : reconstitue l'XP totale sous l'ancienne courbe (v3,
  // plafond 30) puis re-nivelle sous la nouvelle. Une seule fois par joueur.
  if (p.curveVersion !== 4) {
    let totalXp = Math.max(0, p.xp || 0);
    for (let l = 1; l < (p.level || 1); l++) {
      const step = xpToNextV3(l);
      if (Number.isFinite(step)) totalXp += step;
    }
    let lvl = 1;
    let rem = totalXp;
    while (lvl < MAX_LEVEL && rem >= xpToNext(lvl)) { rem -= xpToNext(lvl); lvl += 1; }
    p.level = lvl;
    p.xp = Math.max(0, Math.floor(rem));
    p.curveVersion = 4;
  }
  if (!p.quests) p.quests = freshQuestState();
  if (!p.settledDuels) p.settledDuels = [];
  if (!p.bossClaims) p.bossClaims = [];
  if (!p.settledSales) p.settledSales = [];
  if (!p.settledCJDuels) p.settledCJDuels = [];
  if (!p.settledDungeons) p.settledDungeons = [];
  if (!p.lockedItems) p.lockedItems = [];
  if (!p.buildSlots) p.buildSlots = [];
  if (!p.biomeKills) p.biomeKills = {};
  if (!p.settledGuildGoals) p.settledGuildGoals = [];
  if (!p.settledEndless) p.settledEndless = [];
  if (p.endlessSessionId === undefined) p.endlessSessionId = null;
  if (!p.settledPvpDuels) p.settledPvpDuels = [];
  if (p.pvpDuelSessionId === undefined) p.pvpDuelSessionId = null;
  if (p.prestigeLevel === undefined) p.prestigeLevel = 0;
  if (p.classChangeTokens === undefined) p.classChangeTokens = 0;
  if (p.playtimeMs === undefined) p.playtimeMs = 0;
  if (p.cjWins == null) p.cjWins = 0;
  if (p.teamId === undefined) p.teamId = null;
  if (p.endlessBest === undefined) p.endlessBest = 0;
  if (!p.enchants) p.enchants = { weapon: [], armor: [], trinket: [] };
  // Titre par défaut retiré : les nouveaux joueurs n'ont plus aucun titre tant
  // qu'ils n'en débloquent pas un — nettoie ceux qui l'ont encore.
  if (p.title === 'Aventurier débutant') p.title = undefined;
  if (p.unlockedTitles) p.unlockedTitles = p.unlockedTitles.filter((t) => t !== 'Aventurier débutant');
  
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

  // -- Instanciation des équipements (une passe unique) --
  // Chaque pièce de gear reçoit une clé d'instance `:i<iid>` (fini le partage
  // d'étoiles/durabilité entre copies ; les stats voyagent à la revente).
  if (!(p as any).instancedGearVersion) {
    const gs = { ...p.gearStars };
    const gd = { ...p.gearDurability };
    // 1) Éclater le gear empilé de l'inventaire en exemplaires uniques.
    for (const [key, qty] of Object.entries({ ...p.inventory })) {
      if (!isGearId(key) || hasInstanceTag(key)) continue;
      delete p.inventory[key];
      for (let i = 0; i < (qty as number); i++) {
        const iid = mintInstanceId(key);
        p.inventory[iid] = 1;
        if (gs[key] !== undefined) p.gearStars[iid] = gs[key];
        if (gd[key] !== undefined) p.gearDurability[iid] = gd[key];
      }
      delete p.gearStars[key];
      delete p.gearDurability[key];
    }
    // 2) Instancier le gear équipé (référence par clé d'instance).
    for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
      const key = p.equipped[slot];
      if (!key || hasInstanceTag(key)) continue;
      const iid = mintInstanceId(key);
      p.equipped[slot] = iid;
      const def = item(key);
      if (gs[key] !== undefined) p.gearStars[iid] = gs[key];
      if (gd[key] !== undefined) p.gearDurability[iid] = gd[key];
      else if (def?.maxDurability) p.gearDurability[iid] = def.maxDurability;
      delete p.gearStars[key];
      delete p.gearDurability[key];
    }
    (p as any).instancedGearVersion = 1;
  }

  // Enchants : migrer les runes keyées par slot vers la clé d'instance équipée
  // (elles suivent désormais l'objet). Passe unique, après l'instanciation.
  if (!(p as any).enchantsInstancedVersion) {
    if (p.enchants) {
      for (const slot of ['weapon', 'armor', 'trinket'] as const) {
        const arr = p.enchants[slot];
        if (!arr || arr.length === 0) { delete p.enchants[slot]; continue; }
        const key = p.equipped[slot];
        if (key && key !== slot) {
          p.enchants[key] = [...(p.enchants[key] ?? []), ...arr];
          delete p.enchants[slot];
        } else {
          // Aucun objet équipé : on rend les runes au sac pour ne pas les perdre.
          for (const runeId of arr) p.inventory[runeId] = (p.inventory[runeId] ?? 0) + 1;
          delete p.enchants[slot];
        }
      }
    }
    (p as any).enchantsInstancedVersion = 1;
  }

  // Split des armures de set par famille de classe (plate warrior / cuir archer /
  // robe mage-healer, ex: Cuirasse ardente / Brigandine ardente / Étole
  // incandescente) : avant, une seule pièce d'armure par set servait à 2-4
  // classes, peu "lore-accurate" (un archer en cuirasse de plaques). Convertit
  // les exemplaires déjà possédés vers la variante qui correspond à la classe
  // ACTUELLE du joueur (même stats/durabilité/étoiles/runes, juste id/nom/icône)
  // — personne ne perd son objet. v2 (< 2) : ajoute la branche archer (cuir),
  // idempotent pour les joueurs déjà migrés en v1 (mage/healer/warrior).
  if (((p as any).armorSetSplitVersion ?? 0) < 2) {
    const baseClass = CLASSES[p.classId]?.parent ?? p.classId;
    const SWAP_BY_CLASS: Record<string, Record<string, string>> = {
      warrior: { cultist_robe: 'shadow_plate' },
      archer: {
        cultist_robe: 'shadow_leather', shadow_plate: 'shadow_leather',
        ember_chest: 'ember_leather', frost_plate: 'frost_leather', wind_cloak: 'wind_leather',
        scale_mail: 'water_leather', earth_plate: 'earth_leather', templar_armor: 'light_leather',
        obsidian_armor: 'obsidian_leather',
        wooden_shield: 'hide_tunic', iron_mail: 'iron_vest', sunplate_armor: 'sunplate_leather',
      },
      mage: {
        ember_chest: 'ember_robe', frost_plate: 'frost_robe', wind_cloak: 'wind_robe',
        scale_mail: 'water_robe', earth_plate: 'earth_robe', templar_armor: 'light_robe',
        obsidian_armor: 'obsidian_robe', shadow_plate: 'cultist_robe',
      },
      healer: {
        ember_chest: 'ember_robe', frost_plate: 'frost_robe', wind_cloak: 'wind_robe',
        scale_mail: 'water_robe', earth_plate: 'earth_robe', templar_armor: 'light_robe',
        obsidian_armor: 'obsidian_robe', shadow_plate: 'cultist_robe',
      },
    };
    const SWAP = SWAP_BY_CLASS[baseClass] ?? {};
    const swapKey = (key: string): string => {
      const parts = key.split(':');
      if (SWAP[parts[0]]) { parts[0] = SWAP[parts[0]]; return parts.join(':'); }
      return key;
    };
    for (const key of Object.keys(p.inventory)) {
      const nk = swapKey(key);
      if (nk === key) continue;
      p.inventory[nk] = (p.inventory[nk] ?? 0) + p.inventory[key];
      delete p.inventory[key];
      if (p.gearStars[key] !== undefined) { p.gearStars[nk] = p.gearStars[key]; delete p.gearStars[key]; }
      if (p.gearDurability[key] !== undefined) { p.gearDurability[nk] = p.gearDurability[key]; delete p.gearDurability[key]; }
      if (p.enchants[key]) { p.enchants[nk] = p.enchants[key]; delete p.enchants[key]; }
    }
    const eqKey = p.equipped.armor;
    if (eqKey) {
      const nk = swapKey(eqKey);
      if (nk !== eqKey) {
        p.equipped.armor = nk;
        if (p.gearStars[eqKey] !== undefined) { p.gearStars[nk] = p.gearStars[eqKey]; delete p.gearStars[eqKey]; }
        if (p.gearDurability[eqKey] !== undefined) { p.gearDurability[nk] = p.gearDurability[eqKey]; delete p.gearDurability[eqKey]; }
        if (p.enchants[eqKey]) { p.enchants[nk] = p.enchants[eqKey]; delete p.enchants[eqKey]; }
      }
    }
    (p as any).armorSetSplitVersion = 2;
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

  // Garde-fou : une sous-classe (ascension) exige le niveau 20. Si le joueur se
  // retrouve sous ce seuil (baisse de niveau via admin, bug, etc.) alors qu'il a
  // une sous-classe, on le renvoie de force sur sa classe de BASE et on rend les
  // points investis dans l'arbre (reset complet, comme un ascendPlayer inversé).
  if (p.level < 20 && CLASSES[p.classId]?.parent) {
    p.classId = CLASSES[p.classId].parent!;
    p.talents = {};
    p.talentPoints = Math.max(0, p.level - 1);
    p.equippedSkills = [];
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
    
    let isInvalid = getEquipError(p, it) !== null;
    
    if (isInvalid) {
      addItem(p, eqId, 1);
      p.equipped[slot] = null;
    }
  }

  if (!p.equipped.weapon) {
    // Instancing-aware : on frappe une instance neuve de l'arme de départ et on
    // l'équipe directement. (L'ancien addItem+removeItem laissait une instance
    // parasite dans le sac car addItem mint une clé unique `:iXXX` que removeItem
    // sur la clé base ne retirait pas → duplication de l'épée rouillée.)
    const start = starterWeapon(p.classId);
    const key = mintInstanceId(start);
    p.equipped.weapon = key;
    const def = item(start);
    if (def?.maxDurability) {
      if (!p.gearDurability) p.gearDurability = {};
      p.gearDurability[key] = def.maxDurability;
    }
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
  const weapon = starterWeapon(classId);
  const p: PlayerState = {
    uid,
    name,
    photoURL: photoURL ?? null,
    classId,
    level: 1,
    xp: 0,
    gold: 50,
    fateCoins: 5,
    gems: 0,
    hp: cls.base.maxHp,
    inventory: { potion: 2 },
    equipped: { weapon, armor: null, trinket: null, tool: null, profession_armor: null },
    endlessBest: 0,
    endlessSessionId: null,
    settledEndless: [],
    pvpDuelSessionId: null,
    settledPvpDuels: [],
    enchants: { weapon: [], armor: [], trinket: [] },
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
    quests: freshQuestState(Date.now()),
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
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };

  if (typeof localStorage !== 'undefined') {
    const isLegacy = localStorage.getItem(`rptext.legacy.${uid}`) === 'true';
    if (isLegacy) {
      p.isLegacy = true;
      p.title = 'Pionnier';
      p.unlockedTitles = ['Pionnier'];
      p.inventory['pioneer_medallion'] = 1;
      localStorage.removeItem(`rptext.legacy.${uid}`);
    }
  }

  return p;
}

export function deriveStats(p: PlayerState, skipEquipCheck = false): Stats {
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
        if (!broken && (skipEquipCheck || canEquip(p, it))) {
          if (slot === 'weapon') {
            weaponElement = it.element;
            weaponDmgType = it.dmgType;
            // Rune de Transmutation : inverse le type de dégâts (physique ↔ magique)
            // → contourne les résistances physiques/magiques d'un monstre.
            if (weaponDmgType && p.enchants?.[id]?.includes('rune_shift')) {
              weaponDmgType = weaponDmgType === 'physical' ? 'magical' : 'physical';
            }
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

  // Bonus des enchantements
  let enchAtkPct = 0;
  let enchDefPct = 0;
  let enchHpPct = 0;
  if (p.enchants) {
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      const key = p.equipped[slot];
      if (key && p.enchants[key]) {
        for (const runeId of p.enchants[key]) {
          if (runeId === 'rune_atk_1') enchAtkPct += 0.05;
          if (runeId === 'rune_atk_2') enchAtkPct += 0.10;
          if (runeId === 'rune_def_1') enchDefPct += 0.05;
          if (runeId === 'rune_def_2') enchDefPct += 0.10;
          if (runeId === 'rune_hp_1') enchHpPct += 0.05;
          if (runeId === 'rune_hp_2') enchHpPct += 0.10;
        }
      }
    }
  }

  const prestige = prestigeBonus(p.prestigeAura);
  // Bonus permanent de prestige (rituel Nv.50) : +8% ATK/DEF/PV par prestige,
  // plafonné à 5 (voir ascension.ts PRESTIGE_BONUS_PER_LEVEL / MAX_PRESTIGE_STACK).
  const presMult = 1 + Math.min(p.prestigeLevel ?? 0, 5) * 0.08;
  atk = Math.round(atk * (1 + mods.atkPct + evt.atkPct + setAtkPct + enchAtkPct + prestige.atkPct) * presMult);
  def = Math.round(def * (1 + mods.defPct + evt.defPct + setDefPct + enchDefPct + prestige.defPct) * presMult);
  maxHp = Math.round(maxHp * (1 + mods.hpPct + evt.hpPct + setHpPct + enchHpPct + prestige.hpPct) * presMult);


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

/** Classes de base (non-ascensions) — options d'un jeton de changement de classe. */
export const BASE_CLASSES: ClassId[] = (Object.keys(CLASSES) as ClassId[]).filter((id) => !CLASSES[id].parent);

/**
 * Change la classe de BASE du joueur (via jeton de prestige). Reset des talents
 * et compétences, arme de départ de la nouvelle classe (l'ancienne arme retourne
 * au sac). Ne touche pas au niveau/XP.
 */
export function changeBaseClass(p: PlayerState, newClassId: ClassId): void {
  if (!BASE_CLASSES.includes(newClassId)) return;
  p.classId = newClassId;
  p.talents = {};
  p.talentPoints = Math.max(0, p.level - 1);
  p.equippedSkills = [];
  const prev = p.equipped.weapon;
  if (prev) addItem(p, prev, 1);
  const key = mintInstanceId(starterWeapon(newClassId));
  p.equipped.weapon = key;
}

/** Déséquipe un slot (remet l'objet dans le sac). */
export function unequipItem(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor'): void {
  const prev = p.equipped[slot];
  if (prev) {
    addItem(p, prev, 1);
    p.equipped[slot] = null;
  }
}

export const MAX_BUILD_SLOTS = 6;
const BUILD_SLOTS: (keyof EquippedGear)[] = ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'];

/** Sauvegarde l'équipement actuel (5 slots) dans un nouveau build nommé. */
export function saveEquipmentBuild(p: PlayerState, name: string, icon: string): boolean {
  if (!p.buildSlots) p.buildSlots = [];
  if (p.buildSlots.length >= MAX_BUILD_SLOTS) return false;
  const gear: Partial<EquippedGear> = {};
  for (const slot of BUILD_SLOTS) {
    if (p.equipped[slot]) gear[slot] = p.equipped[slot];
  }
  p.buildSlots.push({ id: `build_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: name.slice(0, 20) || 'Build', icon, gear });
  return true;
}

export function deleteEquipmentBuild(p: PlayerState, buildId: string): void {
  if (!p.buildSlots) return;
  p.buildSlots = p.buildSlots.filter((b) => b.id !== buildId);
}

/** Remplace le contenu d'un build existant par l'équipement actuel (même nom/icône). */
export function updateEquipmentBuild(p: PlayerState, buildId: string): boolean {
  const build = p.buildSlots?.find((b) => b.id === buildId);
  if (!build) return false;
  const gear: Partial<EquippedGear> = {};
  for (const slot of BUILD_SLOTS) {
    if (p.equipped[slot]) gear[slot] = p.equipped[slot];
  }
  build.gear = gear;
  return true;
}

/**
 * Applique un build sauvegardé : équipe chaque pièce encore possédée (clé
 * d'instance présente dans l'inventaire), ignore les slots dont l'exemplaire a
 * disparu (vendu, cassé, etc — pas d'erreur, juste passé). Renvoie les slots
 * ignorés pour informer le joueur.
 */
export function applyEquipmentBuild(p: PlayerState, buildId: string): { applied: number; skipped: string[] } {
  const build = p.buildSlots?.find((b) => b.id === buildId);
  if (!build) return { applied: 0, skipped: [] };
  let applied = 0;
  const skipped: string[] = [];
  for (const slot of BUILD_SLOTS) {
    const key = build.gear[slot];
    if (!key) continue;
    if ((p.inventory[key] ?? 0) <= 0 && p.equipped[slot] !== key) {
      skipped.push(slot);
      continue;
    }
    if (p.equipped[slot] === key) { applied++; continue; }
    if (equipItem(p, key)) applied++;
    else skipped.push(slot);
  }
  return { applied, skipped };
}

/** Cœur chanceux (objet passif admin-only) : +550% de chance de drop relative, juste en le possédant. */
export function luckyDropMult(p: PlayerState): number {
  return (p.inventory['coeur_chanceux'] ?? 0) > 0 ? 1.5 : 1;
}

/** Applique les multiplicateurs globaux (équipe, guilde) à l'XP et à l'Or. */
export function applyBonuses(p: PlayerState, base: { xp: number; gold: number }): { xp: number; gold: number } {
  // Garde-fous : un multiplicateur non fini empoisonnerait durablement l'XP/Or du joueur.
  const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const teamMult = fin(getTeamBonus(p.teamId), 1);
  const guildMult = fin(getGuildBonus(p.guildId), 1);
  // Palier Nv.3 de guilde : le bonus s'étend à l'Or (avant, XP uniquement).
  const guildGoldMult = fin(getGuildGoldBonus(p.guildId), 1);
  const evt = activeEventEffect(p.biome);
  const prestige = prestigeBonus(p.prestigeAura);
  // +10% XP/Or par prestige (plafonné à 5) — voir ascension.ts.
  const presMult = 1 + Math.min(p.prestigeLevel ?? 0, 5) * 0.10;
  const baseXp = fin(base.xp, 0);
  const baseGold = fin(base.gold, 0);
  return {
    xp: Math.floor(baseXp * teamMult * guildMult * (1 + fin(evt.xpMult, 0) + prestige.xpPct) * presMult),
    gold: Math.floor(baseGold * teamMult * guildGoldMult * (1 + fin(evt.goldMult, 0) + prestige.goldPct) * presMult),
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
  // Équipement : chaque exemplaire reçoit une clé d'instance unique (jamais
  // empilé) → étoiles/durabilité propres à la pièce, conservées à la revente.
  // Une clé déjà instanciée (ex: retour d'équipement, achat marché) est gardée.
  addItemToInventory(p.inventory, id, qty);
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

  const weaponLoss = hitsDealt > 0 ? Math.max(1, Math.floor(hitsDealt / 3)) : 0;
  const armorLoss = hitsTaken > 0 ? Math.max(1, Math.floor(hitsTaken / 3)) : 0;
  
  if (p.equipped.weapon && (p.gearDurability[p.equipped.weapon] ?? 0) > 0) {
    p.gearDurability[p.equipped.weapon] = Math.max(0, p.gearDurability[p.equipped.weapon] - weaponLoss);
  }
  if (p.equipped.armor && (p.gearDurability[p.equipped.armor] ?? 0) > 0) {
    p.gearDurability[p.equipped.armor] = Math.max(0, p.gearDurability[p.equipped.armor] - armorLoss);
  }
  if (p.equipped.trinket && (p.gearDurability[p.equipped.trinket] ?? 0) > 0) {
    p.gearDurability[p.equipped.trinket] = Math.max(0, p.gearDurability[p.equipped.trinket] - armorLoss);
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
