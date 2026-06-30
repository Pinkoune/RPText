import type { MonsterDef, BiomeId, Phase } from './types';

export const MONSTERS: MonsterDef[] = [
  // ── Forêt ──
  { id: 'slime', name: 'Slime', hp: 30, atk: 6, def: 1, xp: 12, gold: [3, 8], biomes: ['forest', 'plains'], loot: { slime_gel: 0.6, potion: 0.1 }, emoji: '🟢' },
  { id: 'wolf', name: 'Loup gris', hp: 55, atk: 11, def: 3, xp: 22, gold: [6, 14], biomes: ['forest'], loot: { wolf_pelt: 0.5, rusty_sword: 0.05 }, emoji: '🐺' },
  { id: 'bat', name: 'Chauve-souris', hp: 40, atk: 9, def: 2, xp: 18, gold: [4, 10], biomes: ['forest', 'swamp'], phases: ['dusk', 'night'], loot: { void_dust: 0.03, potion: 0.1 }, emoji: '🦇' },

  // ── Plaines ──
  { id: 'boar', name: 'Sanglier furieux', hp: 80, atk: 14, def: 5, xp: 35, gold: [10, 22], biomes: ['plains'], loot: { boar_tusk: 0.45, iron_blade: 0.04 }, emoji: '🐗' },
  { id: 'bandit', name: 'Bandit de grand chemin', hp: 95, atk: 16, def: 6, xp: 42, gold: [18, 40], biomes: ['plains'], phases: ['day', 'dusk'], loot: { iron_mail: 0.06, lucky_coin: 0.02 }, emoji: '🗡️' },

  // ── Montagnes ──
  { id: 'yeti', name: 'Yéti', hp: 160, atk: 24, def: 12, xp: 90, gold: [30, 60], biomes: ['mountains', 'frozen'], loot: { frost_shard: 0.4, frost_glaive: 0.05 }, emoji: '🦣' },
  { id: 'wraith', name: 'Spectre des cimes', hp: 130, atk: 30, def: 8, xp: 110, gold: [25, 55], biomes: ['mountains'], phases: ['night'], loot: { frost_shard: 0.5, void_dust: 0.1 }, emoji: '👻' },

  // ── Désert ──
  { id: 'scorpion', name: 'Scorpion géant', hp: 190, atk: 28, def: 14, xp: 130, gold: [40, 80], biomes: ['desert'], loot: { ember_core: 0.35, frost_plate: 0.04 }, emoji: '🦂' },
  { id: 'efreet', name: 'Éfrit', hp: 240, atk: 38, def: 16, xp: 200, gold: [60, 120], biomes: ['desert'], phases: ['day', 'dusk'], loot: { ember_core: 0.5, ember_axe: 0.04 }, emoji: '🔥' },

  // ── Marais ──
  { id: 'hydra', name: 'Hydre des marais', hp: 320, atk: 42, def: 20, xp: 280, gold: [80, 160], biomes: ['swamp'], loot: { void_dust: 0.3, gambler_ring: 0.03 }, emoji: '🐉' },

  // ── Abysse gelé ──
  { id: 'voidling', name: 'Rejeton du vide', hp: 420, atk: 55, def: 24, xp: 400, gold: [120, 240], biomes: ['frozen'], phases: ['night'], loot: { void_dust: 0.6, void_reaver: 0.02 }, emoji: '🕳️' },
];

/** Choisit un monstre adapté au biome et à la phase courante. */
export function pickMonster(biome: BiomeId, phase: Phase): MonsterDef {
  const pool = MONSTERS.filter(
    (m) => m.biomes.includes(biome) && (!m.phases || m.phases.includes(phase)),
  );
  const list = pool.length ? pool : MONSTERS.filter((m) => m.biomes.includes(biome));
  return list[Math.floor(Math.random() * list.length)];
}
