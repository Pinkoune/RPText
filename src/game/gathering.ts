import type { PlayerState, BiomeId } from './types';
import { addItem, cooldownLeft, applyBonuses } from './player';
import { addQuestMetric } from './quests';

export const GATHER_COOLDOWN = 60_000; // 60s, cooldown UNIQUE partagé (une récolte à la fois)

export type GatherSkillId = 'chop' | 'mine' | 'fish' | 'forage';

interface Drop {
  id: string;
  weight: number;
  min: number;
  max: number;
  /** Niveau de métier minimum pour récolter cette ressource. */
  minLvl?: number;
}

/** XP de métier nécessaire pour passer au niveau suivant. */
export function gatherXpToNext(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.4)) + 50;
}

export function gatherProgress(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let acc = xp;
  let need = gatherXpToNext(level);
  while (acc >= need) {
    acc -= need;
    level += 1;
    need = gatherXpToNext(level);
  }
  return { level, into: acc, need };
}

/** Niveau de farm global (XP de récolte unique, façon EPIC RPG). */
export function farmProgress(p: PlayerState): { level: number; into: number; need: number } {
  return gatherProgress(p.farmXp ?? 0);
}
export function farmLevel(p: PlayerState): number {
  return gatherProgress(p.farmXp ?? 0).level;
}

export interface GatherSkill {
  id: GatherSkillId;
  name: string;
  verb: string;
  emoji: string;
  /** Tables de butin par biome (absent = métier indisponible ici). */
  byBiome: Partial<Record<BiomeId, Drop[]>>;
}

export const GATHER_SKILLS: Record<GatherSkillId, GatherSkill> = {
  chop: {
    id: 'chop',
    name: 'Bûcheronnage',
    verb: 'chop',
    emoji: '🪓',
    byBiome: {
      forest: [
        { id: 'wood', weight: 70, min: 1, max: 3 },
        { id: 'hardwood', weight: 22, min: 1, max: 1, minLvl: 3 },
        { id: 'ironwood', weight: 8, min: 1, max: 1, minLvl: 8 },
        { id: 'herb', weight: 8, min: 1, max: 2 },
      ],
      plains: [{ id: 'wood', weight: 90, min: 1, max: 2 }, { id: 'hardwood', weight: 10, min: 1, max: 1, minLvl: 3 }],
      swamp: [{ id: 'wood', weight: 60, min: 1, max: 2 }, { id: 'hardwood', weight: 18, min: 1, max: 1, minLvl: 3 }, { id: 'ironwood', weight: 7, min: 1, max: 1, minLvl: 8 }, { id: 'herb', weight: 15, min: 1, max: 2 }],
    },
  },
  mine: {
    id: 'mine',
    name: 'Minage',
    verb: 'mine',
    emoji: '⛏️',
    byBiome: {
      mountains: [
        { id: 'stone', weight: 50, min: 1, max: 3 },
        { id: 'iron_ore', weight: 25, min: 1, max: 2 },
        { id: 'mithril_ore', weight: 15, min: 1, max: 1, minLvl: 5 },
        { id: 'obsidian', weight: 10, min: 1, max: 1, minLvl: 10 },
      ],
      desert: [
        { id: 'stone', weight: 50, min: 1, max: 3 },
        { id: 'iron_ore', weight: 25, min: 1, max: 2 },
        { id: 'sun_shard', weight: 15, min: 1, max: 1 },
        { id: 'obsidian', weight: 10, min: 1, max: 1, minLvl: 10 },
      ],
      volcano: [
        { id: 'stone', weight: 35, min: 1, max: 2 },
        { id: 'ember_stone', weight: 35, min: 1, max: 1 },
        { id: 'lava_crystal', weight: 30, min: 1, max: 1 },
      ],
      crypt: [
        { id: 'stone', weight: 30, min: 1, max: 2 },
        { id: 'crypt_shard', weight: 40, min: 1, max: 1 },
        { id: 'obsidian', weight: 30, min: 1, max: 1, minLvl: 10 },
      ],
      frozen: [
        { id: 'stone', weight: 45, min: 1, max: 2 },
        { id: 'crystal', weight: 55, min: 1, max: 1, minLvl: 6 },
      ],
    },
  },
  fish: {
    id: 'fish',
    name: 'Pêche',
    verb: 'fish',
    emoji: '🎣',
    byBiome: {
      forest: [{ id: 'fish', weight: 100, min: 1, max: 2 }],
      plains: [{ id: 'fish', weight: 78, min: 1, max: 2 }, { id: 'big_fish', weight: 22, min: 1, max: 1, minLvl: 3 }],
      swamp: [
        { id: 'fish', weight: 50, min: 1, max: 3 },
        { id: 'big_fish', weight: 20, min: 1, max: 1, minLvl: 3 },
        { id: 'mudfish', weight: 20, min: 1, max: 1 },
        { id: 'cave_fish', weight: 10, min: 1, max: 1, minLvl: 8 },
      ],
      // Pêche volcanique : poissons de lave dans les bassins de magma refroidi
      volcano: [
        { id: 'fish', weight: 55, min: 1, max: 2 },
        { id: 'cave_fish', weight: 35, min: 1, max: 1, minLvl: 5 },
        { id: 'big_fish', weight: 10, min: 1, max: 1, minLvl: 8 },
      ],
    },
  },
  forage: {
    id: 'forage',
    name: 'Cueillette',
    verb: 'forage',
    emoji: '🌿',
    byBiome: {
      forest: [
        { id: 'herb', weight: 65, min: 1, max: 3 },
        { id: 'wood', weight: 15, min: 1, max: 1 },
        { id: 'silk_thread', weight: 10, min: 1, max: 1 },
        { id: 'mana_bloom', weight: 10, min: 1, max: 1, minLvl: 5 },
      ],
      plains: [
        { id: 'herb', weight: 70, min: 1, max: 2 },
        { id: 'wildflower', weight: 20, min: 1, max: 2 },
        { id: 'mana_bloom', weight: 10, min: 1, max: 1, minLvl: 5 },
      ],
      swamp: [
        { id: 'herb', weight: 70, min: 2, max: 4 },
        { id: 'bog_root', weight: 30, min: 1, max: 2 },
      ],
      desert: [
        { id: 'herb', weight: 60, min: 1, max: 1 },
        { id: 'cactus_pulp', weight: 40, min: 1, max: 2 },
      ],
      // Cueillette volcanique : herbes rares qui poussent dans les cendres
      volcano: [
        { id: 'herb', weight: 45, min: 1, max: 2 },
        { id: 'ember_stone', weight: 30, min: 1, max: 1 },
        { id: 'infernal_shard', weight: 15, min: 1, max: 1, minLvl: 8 },
        { id: 'lava_crystal', weight: 10, min: 1, max: 1, minLvl: 5 },
      ],
      // Cueillette dans la nécropole : ossements et essences errantes
      crypt: [
        { id: 'bone_dust', weight: 55, min: 1, max: 2 },
        { id: 'wraith_essence', weight: 20, min: 1, max: 1, minLvl: 15 },
        { id: 'crypt_shard', weight: 25, min: 1, max: 1, minLvl: 8 },
      ],
      frozen: [
        { id: 'herb', weight: 50, min: 1, max: 1 },
        { id: 'frost_lotus', weight: 50, min: 1, max: 1 },
      ],
    },
  },
};

export const GATHER_LIST = Object.values(GATHER_SKILLS);

function pickDrop(drops: Drop[]): Drop {
  const total = drops.reduce((s, d) => s + d.weight, 0);
  let r = Math.random() * total;
  for (const d of drops) {
    r -= d.weight;
    if (r <= 0) return d;
  }
  return drops[drops.length - 1];
}

/** Métiers disponibles dans le biome courant. */
export function skillsForBiome(biome: BiomeId): GatherSkill[] {
  return GATHER_LIST.filter((s) => s.byBiome[biome]);
}

/** Cooldown UNIQUE de récolte (toutes les récoltes le partagent). */
export function gatherCooldownLeft(p: PlayerState): number {
  return cooldownLeft(p, 'gather', GATHER_COOLDOWN);
}

export interface ExtractResult {
  ok: boolean;
  reason?: string;
  itemId?: string;
  qty?: number;
  xpGain?: number;
  leveledUp?: boolean;
  level?: number;
}

/**
 * Applique le cooldown de récolte.
 * Appelé à la fin du minijeu.
 */
export function finishGatherSession(p: PlayerState) {
  p.cooldowns['gather'] = Date.now();
}

/**
 * Extrait une ressource du pool du biome courant.
 * Appelé lors d'un coup réussi dans le minijeu.
 * qtyMult permet de doubler/multiplier le butin (ex: Coup en Force).
 */
export function extractResource(p: PlayerState, skillId: GatherSkillId, qtyMult = 1): ExtractResult {
  const skill = GATHER_SKILLS[skillId];
  const drops = skill.byBiome[p.biome];
  if (!drops) return { ok: false, reason: `${skill.name} indisponible dans ce biome.` };

  const lvlBefore = gatherProgress(p.farmXp ?? 0).level;

  // On ne récolte que ce que le niveau de farm autorise.
  const pool = drops.filter((d) => !d.minLvl || lvlBefore >= d.minLvl);
  const d = pickDrop(pool.length ? pool : drops.filter((x) => !x.minLvl));

  const bonus = Math.floor(lvlBefore / 5); // +1 quantité tous les 5 niveaux de farm
  const baseQty = d.min + Math.floor(Math.random() * (d.max - d.min + 1)) + bonus;
  const qty = baseQty * qtyMult;
  
  addItem(p, d.id, qty);
  addQuestMetric(p, 'gathers', 1);

  // XP de farm global : plus la ressource est exigeante, plus elle rapporte.
  const baseXp = (8 + baseQty * 2 + (d.minLvl ?? 0) * 5) * qtyMult;
  const { xp: xpGain } = applyBonuses(p, { xp: baseXp, gold: 0 });

  p.farmXp = (p.farmXp ?? 0) + xpGain;
  const after = gatherProgress(p.farmXp);

  return { ok: true, itemId: d.id, qty, xpGain, leveledUp: after.level > lvlBefore, level: after.level };
}
