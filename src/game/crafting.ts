import { item } from './items';
import type { PlayerState } from './types';
import { addItem, removeItem } from './player';
import { addQuestMetric } from './quests';

export interface Recipe {
  output: string;
  qty: number;
  /** id matériau -> quantité requise */
  materials: Record<string, number>;
  gold: number;
  /** Niveau d'artisanat recommandé. */
  levelReq: number;
  /** Avancement total requis pour réussir le craft. */
  difficulty: number;
  /** Qualité maximale pour obtenir le meilleur bonus de stats. */
  maxQuality: number;
  /** Solidité de départ du craft. */
  durability: number;
}

export const RECIPES: Recipe[] = [
  // ── Matériaux Raffinés (Intermédiaires) ──
  { output: 'iron_ingot', qty: 1, materials: { iron_ore: 10, wood: 4 }, gold: 50, levelReq: 1, difficulty: 20, maxQuality: 100, durability: 40 },
  { output: 'sturdy_leather', qty: 1, materials: { wolf_pelt: 8, herb: 4 }, gold: 50, levelReq: 2, difficulty: 25, maxQuality: 100, durability: 40 },
  { output: 'refined_wood', qty: 1, materials: { hardwood: 6, slime_gel: 3 }, gold: 100, levelReq: 3, difficulty: 30, maxQuality: 150, durability: 40 },
  { output: 'magic_dust', qty: 1, materials: { slime_gel: 3, void_dust: 2, herb: 1 }, gold: 150, levelReq: 4, difficulty: 60, maxQuality: 300, durability: 50 },
  { output: 'mithril_ingot', qty: 1, materials: { mithril_ore: 10, ember_core: 5 }, gold: 500, levelReq: 12, difficulty: 120, maxQuality: 500, durability: 60 },
  
  // ── Utilitaires ──
  { output: 'repair_kit', qty: 1, materials: { iron_ingot: 2, wood: 5, herb: 5 }, gold: 100, levelReq: 2, difficulty: 25, maxQuality: 50, durability: 30 },
  { output: 'upgrade_matrix', qty: 1, materials: { magic_dust: 5, mithril_ingot: 3, void_dust: 2 }, gold: 5000, levelReq: 15, difficulty: 300, maxQuality: 1000, durability: 100 },

  // ── Équipements de Métier ──
  { output: 'smith_apron', qty: 1, materials: { sturdy_leather: 6, iron_ingot: 2 }, gold: 200, levelReq: 3, difficulty: 60, maxQuality: 150, durability: 50 },
  { output: 'master_hammer', qty: 1, materials: { iron_ingot: 8, wood: 4, stone: 10 }, gold: 500, levelReq: 5, difficulty: 100, maxQuality: 250, durability: 60 },
  { output: 'craft_goggles', qty: 1, materials: { iron_ingot: 2, crystal: 2, slime_gel: 4 }, gold: 300, levelReq: 4, difficulty: 80, maxQuality: 200, durability: 50 },
  
  { output: 'farmer_boots', qty: 1, materials: { wolf_pelt: 6, sturdy_leather: 2, herb: 10 }, gold: 200, levelReq: 3, difficulty: 60, maxQuality: 150, durability: 50 },
  { output: 'golden_sickle', qty: 1, materials: { iron_ingot: 5, wood: 4, sun_shard: 2 }, gold: 500, levelReq: 5, difficulty: 100, maxQuality: 250, durability: 60 },
  { output: 'gather_gloves', qty: 1, materials: { sturdy_leather: 4, dryad_leaf: 2, herb: 5 }, gold: 300, levelReq: 4, difficulty: 80, maxQuality: 200, durability: 50 },

  // ── Cuisine & Potions (Consommables) ──
  { output: 'herb_tea', qty: 1, materials: { herb: 6, wood: 3 }, gold: 5, levelReq: 1, difficulty: 10, maxQuality: 30, durability: 20 },
  { output: 'grilled_fish', qty: 1, materials: { fish: 6, herb: 3, wood: 3 }, gold: 20, levelReq: 1, difficulty: 15, maxQuality: 50, durability: 30 },
  { output: 'hi_potion', qty: 1, materials: { slime_gel: 4, herb: 12 }, gold: 50, levelReq: 3, difficulty: 40, maxQuality: 150, durability: 40 },
  { output: 'hearty_stew', qty: 1, materials: { big_fish: 3, fish: 6, herb: 10 }, gold: 100, levelReq: 4, difficulty: 35, maxQuality: 150, durability: 40 },

  // ── Spécialités régionales (ressources exclusives à un biome) ──
  { output: 'honey_mead', qty: 1, materials: { wildflower: 6, herb: 4 }, gold: 15, levelReq: 2, difficulty: 18, maxQuality: 60, durability: 25 },
  { output: 'cactus_water', qty: 1, materials: { cactus_pulp: 8 }, gold: 10, levelReq: 2, difficulty: 15, maxQuality: 40, durability: 20 },
  { output: 'silk_robe', qty: 1, materials: { silk_thread: 10, sturdy_leather: 3 }, gold: 350, levelReq: 4, difficulty: 55, maxQuality: 220, durability: 50 },
  { output: 'sunplate_armor', qty: 1, materials: { sun_shard: 10, iron_ingot: 8 }, gold: 1400, levelReq: 11, difficulty: 140, maxQuality: 550, durability: 70 },
  { output: 'venom_fang', qty: 1, materials: { bog_root: 12, mudfish: 6, sturdy_leather: 3 }, gold: 1000, levelReq: 13, difficulty: 160, maxQuality: 500, durability: 60 },
  { output: 'phoenix_elixir', qty: 1, materials: { frost_lotus: 6, crystal: 4, herb: 10 }, gold: 800, levelReq: 20, difficulty: 350, maxQuality: 1200, durability: 80 },

  // ── Équipement Basique (Débutant) ──
  { output: 'wooden_club', qty: 1, materials: { wood: 12 }, gold: 10, levelReq: 1, difficulty: 20, maxQuality: 50, durability: 30 },
  { output: 'apprentice_wand', qty: 1, materials: { wood: 8, slime_gel: 2 }, gold: 10, levelReq: 1, difficulty: 20, maxQuality: 50, durability: 30 },
  { output: 'cloth_robe', qty: 1, materials: { herb: 10, wolf_pelt: 2 }, gold: 15, levelReq: 1, difficulty: 25, maxQuality: 70, durability: 30 },
  { output: 'stone_axe', qty: 1, materials: { wood: 6, stone: 10 }, gold: 20, levelReq: 1, difficulty: 30, maxQuality: 80, durability: 30 },
  { output: 'hunter_bow', qty: 1, materials: { wood: 8, wolf_pelt: 2 }, gold: 25, levelReq: 2, difficulty: 35, maxQuality: 90, durability: 35 },
  { output: 'woven_shirt', qty: 1, materials: { herb: 15 }, gold: 15, levelReq: 1, difficulty: 25, maxQuality: 70, durability: 30 },
  { output: 'leather_boots', qty: 1, materials: { sturdy_leather: 2 }, gold: 20, levelReq: 3, difficulty: 25, maxQuality: 100, durability: 30 },
  { output: 'mage_hat', qty: 1, materials: { herb: 10, slime_gel: 2 }, gold: 25, levelReq: 2, difficulty: 30, maxQuality: 80, durability: 30 },
  { output: 'wooden_shield', qty: 1, materials: { wood: 5, slime_gel: 1 }, gold: 15, levelReq: 1, difficulty: 15, maxQuality: 60, durability: 25 },
  { output: 'flower_crown', qty: 1, materials: { herb: 3, slime_gel: 1 }, gold: 10, levelReq: 1, difficulty: 10, maxQuality: 50, durability: 15 },
  { output: 'bone_necklace', qty: 1, materials: { boar_tusk: 2, wolf_pelt: 1 }, gold: 30, levelReq: 2, difficulty: 30, maxQuality: 80, durability: 40 },
  { output: 'slime_ring', qty: 1, materials: { slime_gel: 6, herb: 2 }, gold: 30, levelReq: 2, difficulty: 25, maxQuality: 70, durability: 40 },

  // ── Forge (Équipements Avancés) ──
  { output: 'iron_mail', qty: 1, materials: { iron_ingot: 8, sturdy_leather: 3 }, gold: 120, levelReq: 5, difficulty: 70, maxQuality: 250, durability: 50 },
  { output: 'iron_blade', qty: 1, materials: { iron_ingot: 4, sturdy_leather: 2 }, gold: 400, levelReq: 3, difficulty: 40, maxQuality: 200, durability: 50 },

  { output: 'iron_spear', qty: 1, materials: { iron_ingot: 6, refined_wood: 4 }, gold: 900, levelReq: 6, difficulty: 70, maxQuality: 300, durability: 60 },
  { output: 'steel_plate', qty: 1, materials: { iron_ingot: 12, sturdy_leather: 6, refined_wood: 3 }, gold: 1600, levelReq: 9, difficulty: 100, maxQuality: 400, durability: 60 },
  
  { output: 'frost_glaive', qty: 1, materials: { iron_ingot: 6, frost_shard: 10, refined_wood: 4 }, gold: 800, levelReq: 10, difficulty: 120, maxQuality: 500, durability: 70 },
  { output: 'frost_plate', qty: 1, materials: { iron_ingot: 10, frost_shard: 12, sturdy_leather: 8 }, gold: 1200, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_axe', qty: 1, materials: { iron_ingot: 8, ember_core: 10, refined_wood: 6 }, gold: 2200, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  // ── Bâtons & sceptres (magie) ──
  { output: 'arcane_staff', qty: 1, materials: { refined_wood: 6, magic_dust: 3 }, gold: 500, levelReq: 5, difficulty: 60, maxQuality: 250, durability: 50 },
  { output: 'frost_scepter', qty: 1, materials: { refined_wood: 4, frost_shard: 10, magic_dust: 5 }, gold: 900, levelReq: 11, difficulty: 130, maxQuality: 500, durability: 60 },
  { output: 'crystal_staff', qty: 1, materials: { mithril_ingot: 4, crystal: 15, magic_dust: 8 }, gold: 5000, levelReq: 18, difficulty: 300, maxQuality: 1200, durability: 80 },

  // ── Sets d'Équipement ──
  { output: 'wind_blade', qty: 1, materials: { iron_ingot: 6, wildflower: 15 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_cloak', qty: 1, materials: { silk_thread: 10, sturdy_leather: 5 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_staff', qty: 1, materials: { refined_wood: 6, wildflower: 12 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_charm', qty: 1, materials: { wildflower: 8, magic_dust: 2 }, gold: 600, levelReq: 9, difficulty: 90, maxQuality: 350, durability: 50 },

  { output: 'earth_hammer', qty: 1, materials: { iron_ingot: 10, stone: 20 }, gold: 1100, levelReq: 11, difficulty: 140, maxQuality: 500, durability: 70 },
  { output: 'earth_plate', qty: 1, materials: { iron_ingot: 15, stone: 30 }, gold: 1300, levelReq: 11, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'earth_tome', qty: 1, materials: { ironwood: 6, dryad_leaf: 5 }, gold: 1100, levelReq: 11, difficulty: 140, maxQuality: 500, durability: 70 },
  { output: 'earth_talisman', qty: 1, materials: { stone: 15, magic_dust: 3 }, gold: 800, levelReq: 11, difficulty: 120, maxQuality: 400, durability: 60 },

  { output: 'ember_chest', qty: 1, materials: { iron_ingot: 15, ember_core: 12 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },
  { output: 'ember_ring', qty: 1, materials: { ember_core: 5, magic_dust: 4 }, gold: 1500, levelReq: 14, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_staff', qty: 1, materials: { refined_wood: 8, ember_core: 8 }, gold: 2200, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  { output: 'tide_spear', qty: 1, materials: { iron_ingot: 6, pure_water: 8 }, gold: 1200, levelReq: 12, difficulty: 130, maxQuality: 450, durability: 65 },
  { output: 'water_wand', qty: 1, materials: { refined_wood: 6, pure_water: 6 }, gold: 1200, levelReq: 12, difficulty: 130, maxQuality: 450, durability: 65 },
  { output: 'scale_mail', qty: 1, materials: { iron_ingot: 10, pure_water: 10, big_fish: 5 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 550, durability: 70 },
  { output: 'pearl_ring', qty: 1, materials: { pure_water: 5, magic_dust: 4 }, gold: 1000, levelReq: 12, difficulty: 110, maxQuality: 400, durability: 60 },

  { output: 'sun_blade', qty: 1, materials: { mithril_ingot: 4, sun_orb: 6 }, gold: 3500, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 90 },
  { output: 'radiant_staff', qty: 1, materials: { ironwood: 4, sun_orb: 6 }, gold: 3500, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 90 },
  { output: 'templar_armor', qty: 1, materials: { mithril_ingot: 8, sun_orb: 8 }, gold: 4500, levelReq: 16, difficulty: 300, maxQuality: 1200, durability: 100 },
  { output: 'light_pendant', qty: 1, materials: { sun_orb: 4, magic_dust: 6 }, gold: 2500, levelReq: 16, difficulty: 200, maxQuality: 800, durability: 80 },

  { output: 'shadow_bow', qty: 1, materials: { ironwood: 6, voodoo_charm: 6 }, gold: 4000, levelReq: 18, difficulty: 280, maxQuality: 1100, durability: 90 },
  { output: 'void_tome', qty: 1, materials: { void_dust: 10, voodoo_charm: 8 }, gold: 6000, levelReq: 20, difficulty: 400, maxQuality: 1500, durability: 100 },
  { output: 'cultist_robe', qty: 1, materials: { silk_thread: 15, voodoo_charm: 6 }, gold: 3500, levelReq: 18, difficulty: 250, maxQuality: 1000, durability: 85 },
  { output: 'dark_amulet', qty: 1, materials: { void_dust: 6, voodoo_charm: 4 }, gold: 5000, levelReq: 20, difficulty: 350, maxQuality: 1200, durability: 90 },

  { output: 'obsidian_blade', qty: 1, materials: { obsidian: 15, iron_ingot: 10 }, gold: 3000, levelReq: 15, difficulty: 220, maxQuality: 900, durability: 120 },
  { output: 'obsidian_armor', qty: 1, materials: { obsidian: 25, iron_ingot: 15 }, gold: 4000, levelReq: 15, difficulty: 280, maxQuality: 1100, durability: 150 },
  { output: 'obsidian_ring', qty: 1, materials: { obsidian: 8, magic_dust: 5 }, gold: 2000, levelReq: 15, difficulty: 180, maxQuality: 700, durability: 100 },
  { output: 'ironwood_staff', qty: 1, materials: { ironwood: 8, magic_dust: 4 }, gold: 1800, levelReq: 13, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'ironwood_bow', qty: 1, materials: { ironwood: 8, sturdy_leather: 4 }, gold: 1800, levelReq: 13, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'shadow_tome', qty: 1, materials: { void_dust: 6, magic_dust: 4 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'world_tree_staff', qty: 1, materials: { ironwood: 12, mana_bloom: 10, magic_dust: 8 }, gold: 4500, levelReq: 20, difficulty: 280, maxQuality: 1000, durability: 80 },
  { output: 'star_orb', qty: 1, materials: { crystal: 20, sun_orb: 10, magic_dust: 12 }, gold: 8000, levelReq: 24, difficulty: 450, maxQuality: 2000, durability: 90 },
  { output: 'mana_ring', qty: 1, materials: { mana_bloom: 10, magic_dust: 6 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 700, durability: 60 },
  { output: 'cave_potion', qty: 1, materials: { cave_fish: 2, herb: 10 }, gold: 300, levelReq: 10, difficulty: 100, maxQuality: 350, durability: 40 },

  // ── Maîtrise & Bijoux ──
  { output: 'mithril_blade', qty: 1, materials: { mithril_ingot: 8, sturdy_leather: 6, magic_dust: 4 }, gold: 5000, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 80 },
  { output: 'crystal_charm', qty: 1, materials: { crystal: 12, mithril_ingot: 2, magic_dust: 6 }, gold: 3000, levelReq: 15, difficulty: 220, maxQuality: 900, durability: 70 },
  { output: 'lucky_coin', qty: 1, materials: { void_dust: 4, mithril_ingot: 3 }, gold: 1000, levelReq: 20, difficulty: 400, maxQuality: 1500, durability: 80 },
  { output: 'gambler_ring', qty: 1, materials: { void_dust: 6, magic_dust: 10, crystal: 5 }, gold: 3000, levelReq: 22, difficulty: 500, maxQuality: 1800, durability: 90 },
  { output: 'void_reaver', qty: 1, materials: { void_dust: 12, mithril_ingot: 10, magic_dust: 10 }, gold: 12000, levelReq: 25, difficulty: 800, maxQuality: 3000, durability: 100 },
];

export function missingFor(p: PlayerState, r: Recipe): { materials: Record<string, number>; gold: number } {
  const materials: Record<string, number> = {};
  for (const [id, need] of Object.entries(r.materials)) {
    const have = p.inventory[id] ?? 0;
    if (have < need) materials[id] = need - have;
  }
  return { materials, gold: Math.max(0, r.gold - p.gold) };
}

export function canCraft(p: PlayerState, r: Recipe): boolean {
  const m = missingFor(p, r);
  return Object.keys(m.materials).length === 0 && m.gold === 0;
}

/** Calcule le niveau d'artisanat selon l'XP. (Courbe très simple : 100 * lvl^1.5) */
export function getCraftLevel(xp: number): { level: number; into: number; need: number } {
  let lvl = 1;
  while (true) {
    const need = 100 * Math.pow(lvl, 1.5);
    if (xp >= need) {
      xp -= need;
      lvl++;
    } else {
      return { level: lvl, into: xp, need: need };
    }
  }
}

/** Consomme les matériaux au début du craft. */
export function consumeMaterials(p: PlayerState, r: Recipe): boolean {
  if (!canCraft(p, r)) return false;
  for (const [id, need] of Object.entries(r.materials)) removeItem(p, id, need);
  p.gold -= r.gold;
  return true;
}

/** Appelé à la fin du minijeu. qualityRatio = (0 à 1) de maxQuality. */
export function finishCraft(p: PlayerState, r: Recipe, qualityRatio: number, success: boolean): { id: string, qty: number } {
  if (!success) {
    addItem(p, 'craft_trash', 1);
    // XP consolatoire
    p.craftXp += Math.max(1, Math.floor(r.difficulty / 10));
    return { id: 'craft_trash', qty: 1 };
  }
  
  addQuestMetric(p, 'crafts', 1);
  
  // XP basée sur la difficulté et la qualité atteinte
  const xpGain = r.difficulty + Math.floor(r.difficulty * qualityRatio);
  p.craftXp += xpGain;
  
  // Générer un ID dynamique basé sur la qualité si celle-ci a un impact (équipements).
  // On considère que 100% quality = stats +50% -> q150
  // 0% quality = stats de base -> q100
  let outId = r.output;
  const outItem = item(r.output);
  let finalQty = r.qty;

  // Suffixe de qualité uniquement pour l'équipement
  if (outItem && ['weapon', 'armor', 'trinket'].includes(outItem.slot)) {
    const bonus = Math.round(qualityRatio * 50); // 0 à 50% de bonus
    if (bonus > 0) {
      outId = `${r.output}:q${100 + bonus}`;
    }
  } else if (outItem && ['material', 'consumable'].includes(outItem.slot)) {
    // Chance de doubler les quantités selon la qualité (max 50% de chance)
    if (Math.random() < qualityRatio * 0.5) {
      finalQty *= 2;
    }
  }
  
  addItem(p, outId, finalQty);
  return { id: outId, qty: finalQty };
}
