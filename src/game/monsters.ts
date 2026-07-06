import type { MonsterDef, BiomeId, Phase } from './types';

export const MONSTERS: MonsterDef[] = [
  // ── Forêt ──
  { id: 'slime', name: 'Slime', hp: 45, atk: 10, def: 1, xp: 12, gold: [3, 8], biomes: ['forest', 'plains'], loot: { slime_gel: 0.8, potion: 0.15 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🟢', element: 'water', dmgType: 'physical', weaknesses: ['magical'], resistances: ['physical'] },
  { id: 'wolf', name: 'Loup gris', hp: 75, atk: 16, def: 3, xp: 22, gold: [6, 14], biomes: ['forest'], loot: { wolf_pelt: 0.75, rusty_sword: 0.05 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🐺', element: 'earth', dmgType: 'physical', weaknesses: ['magical'] },
  { id: 'bat', name: 'Chauve-souris', hp: 60, atk: 14, def: 2, xp: 18, gold: [4, 10], biomes: ['forest', 'swamp'], phases: ['dusk', 'night'], loot: { void_dust: 0.03, potion: 0.15 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🦇', element: 'dark', dmgType: 'physical', weaknesses: ['physical'] },
  { id: 'dryad', name: 'Dryade', hp: 90, atk: 20, def: 8, xp: 45, gold: [10, 20], biomes: ['forest'], loot: { dryad_leaf: 0.4, herb: 0.8 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🌿', element: 'earth', dmgType: 'magical', weaknesses: ['magical'], resistances: ['physical'] },

  // ── Plaines ──
  { id: 'boar', name: 'Sanglier furieux', hp: 110, atk: 22, def: 5, xp: 35, gold: [10, 22], biomes: ['plains'], loot: { boar_tusk: 0.45, iron_blade: 0.04, potion: 0.1 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🐗', element: 'earth', dmgType: 'physical', resistances: ['magical'] },
  { id: 'bandit', name: 'Bandit de grand chemin', hp: 130, atk: 26, def: 6, xp: 42, gold: [18, 40], biomes: ['plains'], phases: ['day', 'dusk'], loot: { iron_mail: 0.06, lucky_coin: 0.02, hi_potion: 0.05 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🗡️', element: 'neutral', dmgType: 'physical' },
  { id: 'water_elemental', name: 'Élémentaire d\'eau', hp: 160, atk: 30, def: 10, xp: 60, gold: [20, 45], biomes: ['plains'], loot: { pure_water: 0.5, fish: 0.5 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '💧', element: 'water', dmgType: 'magical', weaknesses: ['magical'], resistances: ['physical'] },

  // ── Montagnes ──
  { id: 'yeti', name: 'Yéti', hp: 220, atk: 35, def: 12, xp: 90, gold: [30, 60], biomes: ['mountains'], loot: { frost_shard: 0.4, hi_potion: 0.08 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🦣', element: 'frost', dmgType: 'physical', weaknesses: ['magical'] },
  { id: 'wraith', name: 'Spectre des cimes', hp: 180, atk: 45, def: 8, xp: 110, gold: [25, 55], biomes: ['mountains'], phases: ['night'], loot: { frost_shard: 0.5, void_dust: 0.1 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '👻', element: 'dark', dmgType: 'magical', weaknesses: ['magical'], resistances: ['physical'] },
  { id: 'golem', name: 'Golem de pierre', hp: 350, atk: 25, def: 20, xp: 120, gold: [35, 70], biomes: ['mountains'], loot: { stone: 0.8, iron_ore: 0.5, iron_ingot: 0.1 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🪨', element: 'earth', dmgType: 'physical', resistances: ['physical'], weaknesses: ['magical'] },

  // ── Désert ──
  { id: 'scorpion', name: 'Scorpion géant', hp: 260, atk: 42, def: 14, xp: 130, gold: [40, 80], biomes: ['desert'], loot: { ember_core: 0.35, hi_potion: 0.1 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🦂', element: 'earth', dmgType: 'physical', resistances: ['magical'] },
  { id: 'efreet', name: 'Éfrit', hp: 330, atk: 55, def: 16, xp: 200, gold: [60, 120], biomes: ['desert'], phases: ['day', 'dusk'], loot: { ember_core: 0.5, ember_axe: 0.04 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🔥', element: 'fire', dmgType: 'magical', weaknesses: ['physical'] },
  { id: 'sun_priest', name: 'Prêtre du Soleil', hp: 280, atk: 60, def: 10, xp: 180, gold: [50, 100], biomes: ['desert'], phases: ['day'], loot: { sun_orb: 0.4, sun_shard: 0.3 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '📿', element: 'light', dmgType: 'magical', weaknesses: ['physical'], resistances: ['magical'] },

  // ── Marais ──
  { id: 'hydra', name: 'Hydre des marais', hp: 450, atk: 65, def: 20, xp: 280, gold: [80, 160], biomes: ['swamp'], loot: { void_dust: 0.3, gambler_ring: 0.03, hi_potion: 0.15 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🐉', element: 'water', dmgType: 'physical' },
  { id: 'troll_shaman', name: 'Sorcier Troll', hp: 380, atk: 75, def: 15, xp: 250, gold: [70, 140], biomes: ['swamp'], phases: ['night'], loot: { voodoo_charm: 0.35, bog_root: 0.5 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '👹', element: 'dark', dmgType: 'magical', weaknesses: ['physical'], resistances: ['magical'] },

  // ── Caldeira de Braise (volcano, niv.24) ──
  { id: 'lava_salamander', name: 'Salamandre de lave', hp: 480, atk: 70, def: 18, xp: 300, gold: [90, 170], biomes: ['volcano'], loot: { lava_crystal: 0.5, hi_potion: 0.15, repair_kit: 0.05 }, emoji: '🦎', element: 'fire', dmgType: 'physical', resistances: ['magical'], weaknesses: ['physical'] },
  { id: 'magma_golem', name: 'Golem de magma', hp: 700, atk: 55, def: 35, xp: 350, gold: [100, 190], biomes: ['volcano'], loot: { ember_stone: 0.5, lava_crystal: 0.2, repair_kit: 0.05 }, emoji: '🗿', element: 'fire', dmgType: 'physical', resistances: ['physical'], weaknesses: ['magical'] },
  { id: 'minor_demon', name: 'Démon mineur', hp: 400, atk: 90, def: 10, xp: 320, gold: [110, 200], biomes: ['volcano'], phases: ['dusk', 'night'], loot: { infernal_shard: 0.35, ember_stone: 0.2 }, emoji: '👿', element: 'fire', dmgType: 'magical', weaknesses: ['physical'] },
  { id: 'ash_wraith', name: 'Esprit de cendre', hp: 300, atk: 85, def: 5, xp: 380, gold: [90, 180], biomes: ['volcano'], loot: { void_dust: 0.15, infernal_shard: 0.15, hi_potion: 0.2 }, emoji: '🌫️', element: 'fire', dmgType: 'magical', resistances: ['magical'], weaknesses: ['physical'] },
  { id: 'lava_titan', name: 'Titan de lave', hp: 1400, atk: 100, def: 40, xp: 600, gold: [280, 520], biomes: ['volcano'], loot: { boss_soul: 0.01, lava_crystal: 0.9, infernal_shard: 0.4, upgrade_matrix: 0.05 }, emoji: '🌋', element: 'fire', dmgType: 'physical', resistances: ['physical', 'magical'], weaknesses: [] },

  // ── Nécropole de Cristal (crypt, niv.30) ──
  { id: 'crypt_wraith', name: 'Spectre de la Crypte', hp: 850, atk: 95, def: 22, xp: 420, gold: [130, 230], biomes: ['crypt'], phases: ['dusk', 'night'], loot: { wraith_essence: 0.4, void_dust: 0.1, hi_potion: 0.15, repair_kit: 0.05 }, emoji: '👻', element: 'dark', dmgType: 'magical', weaknesses: ['physical'] },
  { id: 'bone_golem', name: 'Golem d\'Ossements', hp: 1300, atk: 75, def: 45, xp: 460, gold: [140, 250], biomes: ['crypt'], loot: { bone_dust: 0.7, crypt_shard: 0.25, repair_kit: 0.05 }, emoji: '💀', element: 'earth', dmgType: 'physical', resistances: ['physical'], weaknesses: ['magical'] },
  { id: 'crypt_lich', name: 'Liche Mineure', hp: 950, atk: 105, def: 25, xp: 500, gold: [160, 280], biomes: ['crypt'], phases: ['night'], loot: { wraith_essence: 0.35, crypt_shard: 0.2, hi_potion: 0.2 }, emoji: '🧙', element: 'dark', dmgType: 'magical', resistances: ['magical'], weaknesses: ['physical'] },
  { id: 'crystal_horror', name: 'Horreur Cristalline', hp: 1100, atk: 90, def: 38, xp: 480, gold: [150, 260], biomes: ['crypt'], loot: { crypt_shard: 0.5, obsidian: 0.2, upgrade_matrix: 0.03 }, emoji: '🔷', element: 'earth', dmgType: 'magical', weaknesses: ['physical'] },
  { id: 'crypt_warden', name: 'Gardien de la Crypte', hp: 2000, atk: 130, def: 55, xp: 800, gold: [350, 600], biomes: ['crypt'], loot: { boss_soul: 0.015, wraith_essence: 0.6, crypt_shard: 0.9, upgrade_matrix: 0.05 }, emoji: '🪦', element: 'dark', dmgType: 'physical', resistances: ['physical', 'magical'], weaknesses: [] },

  // ── Abysses du Vide (frozen) ──
  { id: 'voidling', name: 'Rejeton du vide', hp: 1300, atk: 140, def: 40, xp: 650, gold: [200, 380], biomes: ['frozen'], loot: { void_dust: 0.6, void_reaver: 0.03, hi_potion: 0.2 , repair_kit: 0.05 , upgrade_matrix: 0.01 }, emoji: '🕳️', element: 'dark', dmgType: 'magical', resistances: ['magical'], weaknesses: ['physical'] },
  { id: 'shadow_stalker', name: "Traqueur d'Ombres", hp: 1150, atk: 160, def: 25, xp: 700, gold: [260, 430], biomes: ['frozen'], phases: ['night', 'dusk'], loot: { void_dust: 0.8, repair_kit: 0.05, upgrade_matrix: 0.05 }, emoji: '🌑', element: 'dark', dmgType: 'physical', resistances: ['physical'], weaknesses: ['magical'] },
  { id: 'abyssal_horror', name: 'Horreur Abyssale', hp: 1700, atk: 130, def: 55, xp: 850, gold: [320, 600], biomes: ['frozen'], loot: { void_dust: 0.9, void_reaver: 0.05, upgrade_matrix: 0.08, phoenix_feather: 0.02 }, emoji: '👁️‍🗨️', element: 'dark', dmgType: 'magical', resistances: ['magical'], weaknesses: ['physical'] },
];

/** Map of bait items to the monster they attract */
export const BAIT_TARGETS: Record<string, string> = {
  bait_slime: 'slime',
  bait_wolf: 'wolf',
  bait_yeti: 'yeti',
  bait_efreet: 'efreet',
  bait_voidling: 'voidling',
};

/** Choisit un monstre adapté au biome et à la phase courante. */
export function pickMonster(biome: BiomeId, phase: Phase, playerLevel: number = 1, activeBait?: string): MonsterDef {
  const pool = MONSTERS.filter(
    (m) => m.biomes.includes(biome) && (!m.phases || m.phases.includes(phase)),
  );
  let list = pool.length ? pool : MONSTERS.filter((m) => m.biomes.includes(biome));
  
  let baseMonster = list[Math.floor(Math.random() * list.length)];

  // Appliquer l'appât (si valide pour ce biome)
  if (activeBait && BAIT_TARGETS[activeBait]) {
    const targetId = BAIT_TARGETS[activeBait];
    const targetMonster = list.find(m => m.id === targetId);
    if (targetMonster) {
      // 50% de chance d'attirer spécifiquement ce monstre s'il est dans la liste
      if (Math.random() < 0.5) {
        baseMonster = targetMonster;
      }
    }
  }
  
  // Scaling exponentiel basé sur le niveau du joueur (plus raide après l'Ascension au nv 20)
  const powerFactor = playerLevel >= 20 ? 2.0 : 1.5;
  const scale = Math.pow(1 + Math.max(0, playerLevel - 1) / 30, powerFactor);
  
  return {
    ...baseMonster,
    hp: Math.floor(baseMonster.hp * scale),
    atk: Math.floor(baseMonster.atk * scale),
    def: Math.floor(baseMonster.def * scale),
  };
}
