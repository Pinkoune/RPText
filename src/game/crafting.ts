import { item } from './items';
import type { PlayerState } from './types';
import { addItem, removeItem, applyBonuses } from './player';
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
  { output: 'magic_dust', qty: 1, materials: { slime_gel: 5, herb: 8 }, gold: 60, levelReq: 2, difficulty: 30, maxQuality: 150, durability: 40 },
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
  { output: 'sunplate_leather', qty: 1, materials: { sun_shard: 10, iron_ingot: 8 }, gold: 1400, levelReq: 11, difficulty: 140, maxQuality: 550, durability: 70 },
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
  { output: 'hide_tunic', qty: 1, materials: { wood: 5, slime_gel: 1 }, gold: 15, levelReq: 1, difficulty: 15, maxQuality: 60, durability: 25 },
  { output: 'flower_crown', qty: 1, materials: { herb: 3, slime_gel: 1 }, gold: 10, levelReq: 1, difficulty: 10, maxQuality: 50, durability: 15 },
  { output: 'bone_necklace', qty: 1, materials: { boar_tusk: 2, wolf_pelt: 1 }, gold: 30, levelReq: 2, difficulty: 30, maxQuality: 80, durability: 40 },
  { output: 'slime_ring', qty: 1, materials: { slime_gel: 6, herb: 2 }, gold: 30, levelReq: 2, difficulty: 25, maxQuality: 70, durability: 40 },

  // ── Forge (Équipements Avancés) ──
  { output: 'iron_mail', qty: 1, materials: { iron_ingot: 8, sturdy_leather: 3 }, gold: 120, levelReq: 5, difficulty: 70, maxQuality: 250, durability: 50 },
  { output: 'iron_vest', qty: 1, materials: { iron_ingot: 8, sturdy_leather: 3 }, gold: 120, levelReq: 5, difficulty: 70, maxQuality: 250, durability: 50 },
  { output: 'iron_blade', qty: 1, materials: { iron_ingot: 4, sturdy_leather: 2 }, gold: 400, levelReq: 3, difficulty: 40, maxQuality: 200, durability: 50 },

  // Armes intermédiaires (comblent le vide entre le niveau 3 et le niveau 12).
  { output: 'bronze_blade', qty: 1, materials: { iron_ingot: 5, sturdy_leather: 2, stone: 6 }, gold: 250, levelReq: 4, difficulty: 50, maxQuality: 220, durability: 55 },
  { output: 'oak_bow', qty: 1, materials: { refined_wood: 3, sturdy_leather: 3, wood: 6 }, gold: 300, levelReq: 5, difficulty: 55, maxQuality: 240, durability: 55 },
  { output: 'acolyte_wand', qty: 1, materials: { refined_wood: 3, magic_dust: 2, slime_gel: 4 }, gold: 300, levelReq: 4, difficulty: 50, maxQuality: 220, durability: 55 },
  { output: 'soldier_sword', qty: 1, materials: { iron_ingot: 8, sturdy_leather: 4, refined_wood: 2 }, gold: 700, levelReq: 7, difficulty: 85, maxQuality: 320, durability: 60 },
  { output: 'ranger_bow', qty: 1, materials: { refined_wood: 6, sturdy_leather: 5, wildflower: 6 }, gold: 900, levelReq: 8, difficulty: 95, maxQuality: 360, durability: 60 },
  { output: 'adept_staff', qty: 1, materials: { refined_wood: 6, magic_dust: 4, mana_bloom: 4 }, gold: 900, levelReq: 8, difficulty: 95, maxQuality: 360, durability: 60 },

  { output: 'iron_spear', qty: 1, materials: { iron_ingot: 6, refined_wood: 4 }, gold: 900, levelReq: 6, difficulty: 70, maxQuality: 300, durability: 60 },

  // Armes de transition (mid-game, sans set) — comblent le palier avant les sets élémentaires.
  { output: 'tempered_greatblade', qty: 1, materials: { iron_ingot: 12, mithril_ingot: 2, magic_dust: 3 }, gold: 2000, levelReq: 13, difficulty: 170, maxQuality: 700, durability: 80 },
  { output: 'master_longbow', qty: 1, materials: { ironwood: 8, refined_wood: 6, magic_dust: 3 }, gold: 1800, levelReq: 13, difficulty: 160, maxQuality: 650, durability: 80 },
  { output: 'sage_staff', qty: 1, materials: { refined_wood: 8, magic_dust: 6, mana_bloom: 6 }, gold: 1900, levelReq: 13, difficulty: 165, maxQuality: 680, durability: 80 },
  // Bijoux avancés.
  { output: 'titan_seal', qty: 1, materials: { obsidian: 10, mithril_ingot: 3, stone: 20 }, gold: 2500, levelReq: 16, difficulty: 200, maxQuality: 800, durability: 70 },
  { output: 'berserker_fang', qty: 1, materials: { void_dust: 6, ember_core: 6, mithril_ingot: 2 }, gold: 3500, levelReq: 19, difficulty: 260, maxQuality: 1000, durability: 80 },
  { output: 'steel_plate', qty: 1, materials: { iron_ingot: 12, sturdy_leather: 6, refined_wood: 3 }, gold: 1600, levelReq: 9, difficulty: 100, maxQuality: 400, durability: 60 },
  
  { output: 'frost_glaive', qty: 1, materials: { iron_ingot: 6, frost_shard: 10, refined_wood: 4 }, gold: 800, levelReq: 10, difficulty: 120, maxQuality: 500, durability: 70 },
  { output: 'frost_plate', qty: 1, materials: { iron_ingot: 10, frost_shard: 12, sturdy_leather: 8 }, gold: 1200, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'frost_leather', qty: 1, materials: { iron_ingot: 10, frost_shard: 12, sturdy_leather: 8 }, gold: 1200, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'frost_robe', qty: 1, materials: { iron_ingot: 10, frost_shard: 12, sturdy_leather: 8 }, gold: 1200, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_axe', qty: 1, materials: { iron_ingot: 8, ember_core: 10, refined_wood: 6 }, gold: 2200, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  // ── Bâtons & sceptres (magie) ──
  { output: 'arcane_staff', qty: 1, materials: { refined_wood: 6, magic_dust: 3 }, gold: 500, levelReq: 5, difficulty: 60, maxQuality: 250, durability: 50 },
  { output: 'priest_crozier', qty: 1, materials: { iron_ingot: 4, magic_dust: 4, refined_wood: 4 }, gold: 600, levelReq: 8, difficulty: 80, maxQuality: 300, durability: 60 },
  { output: 'frost_scepter', qty: 1, materials: { refined_wood: 4, frost_shard: 10, magic_dust: 5 }, gold: 900, levelReq: 11, difficulty: 130, maxQuality: 500, durability: 60 },
  { output: 'moon_staff', qty: 1, materials: { mithril_ingot: 2, magic_dust: 8, star_fragment: 2 }, gold: 1300, levelReq: 11, difficulty: 150, maxQuality: 600, durability: 60 },
  { output: 'crystal_staff', qty: 1, materials: { mithril_ingot: 4, crystal: 15, magic_dust: 8 }, gold: 5000, levelReq: 20, difficulty: 300, maxQuality: 1200, durability: 80 },
  { output: 'divine_scepter', qty: 1, materials: { mithril_ingot: 10, sun_shard: 15, void_dust: 5, crystal: 5 }, gold: 5000, levelReq: 19, difficulty: 300, maxQuality: 1000, durability: 80 },
  // ── Sets d'Équipement ──
  { output: 'wind_blade', qty: 1, materials: { iron_ingot: 6, wildflower: 15 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_cloak', qty: 1, materials: { silk_thread: 10, sturdy_leather: 5 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_leather', qty: 1, materials: { silk_thread: 10, sturdy_leather: 5 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_robe', qty: 1, materials: { silk_thread: 10, sturdy_leather: 5 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_staff', qty: 1, materials: { refined_wood: 6, wildflower: 12 }, gold: 800, levelReq: 9, difficulty: 110, maxQuality: 400, durability: 60 },
  { output: 'wind_charm', qty: 1, materials: { wildflower: 8, magic_dust: 2 }, gold: 600, levelReq: 9, difficulty: 90, maxQuality: 350, durability: 50 },

  { output: 'earth_hammer', qty: 1, materials: { iron_ingot: 10, stone: 20 }, gold: 1100, levelReq: 11, difficulty: 140, maxQuality: 500, durability: 70 },
  { output: 'earth_plate', qty: 1, materials: { iron_ingot: 15, stone: 30 }, gold: 1300, levelReq: 11, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'earth_leather', qty: 1, materials: { iron_ingot: 15, stone: 30 }, gold: 1300, levelReq: 11, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'earth_robe', qty: 1, materials: { iron_ingot: 15, stone: 30 }, gold: 1300, levelReq: 11, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'earth_tome', qty: 1, materials: { ironwood: 6, dryad_leaf: 5 }, gold: 1100, levelReq: 11, difficulty: 140, maxQuality: 500, durability: 70 },
  { output: 'earth_talisman', qty: 1, materials: { stone: 15, magic_dust: 3 }, gold: 800, levelReq: 11, difficulty: 120, maxQuality: 400, durability: 60 },

  { output: 'ember_chest', qty: 1, materials: { iron_ingot: 15, ember_core: 12 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },
  { output: 'ember_leather', qty: 1, materials: { iron_ingot: 15, ember_core: 12 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },
  { output: 'ember_robe', qty: 1, materials: { iron_ingot: 15, ember_core: 12 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },
  { output: 'ember_ring', qty: 1, materials: { ember_core: 5, magic_dust: 4 }, gold: 1500, levelReq: 14, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_staff', qty: 1, materials: { refined_wood: 8, ember_core: 8 }, gold: 2200, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  { output: 'tide_spear', qty: 1, materials: { iron_ingot: 6, pure_water: 8 }, gold: 1200, levelReq: 12, difficulty: 130, maxQuality: 450, durability: 65 },
  { output: 'water_wand', qty: 1, materials: { refined_wood: 6, pure_water: 6 }, gold: 1200, levelReq: 12, difficulty: 130, maxQuality: 450, durability: 65 },
  { output: 'scale_mail', qty: 1, materials: { iron_ingot: 10, pure_water: 10, big_fish: 5 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 550, durability: 70 },
  { output: 'water_leather', qty: 1, materials: { iron_ingot: 10, pure_water: 10, big_fish: 5 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 550, durability: 70 },
  { output: 'water_robe', qty: 1, materials: { iron_ingot: 10, pure_water: 10, big_fish: 5 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 550, durability: 70 },
  { output: 'pearl_ring', qty: 1, materials: { pure_water: 5, magic_dust: 4 }, gold: 1000, levelReq: 12, difficulty: 110, maxQuality: 400, durability: 60 },

  { output: 'sun_blade', qty: 1, materials: { mithril_ingot: 4, sun_orb: 6 }, gold: 3500, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 90 },
  { output: 'radiant_staff', qty: 1, materials: { ironwood: 4, sun_orb: 6 }, gold: 3500, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 90 },
  { output: 'templar_armor', qty: 1, materials: { mithril_ingot: 8, sun_orb: 8 }, gold: 4500, levelReq: 16, difficulty: 300, maxQuality: 1200, durability: 100 },
  { output: 'light_leather', qty: 1, materials: { mithril_ingot: 8, sun_orb: 8 }, gold: 4500, levelReq: 16, difficulty: 300, maxQuality: 1200, durability: 100 },
  { output: 'light_robe', qty: 1, materials: { mithril_ingot: 8, sun_orb: 8 }, gold: 4500, levelReq: 16, difficulty: 300, maxQuality: 1200, durability: 100 },
  { output: 'light_pendant', qty: 1, materials: { sun_orb: 4, magic_dust: 6 }, gold: 2500, levelReq: 16, difficulty: 200, maxQuality: 800, durability: 80 },

  { output: 'shadow_bow', qty: 1, materials: { ironwood: 6, voodoo_charm: 6 }, gold: 4000, levelReq: 18, difficulty: 280, maxQuality: 1100, durability: 90 },
  { output: 'void_tome', qty: 1, materials: { void_dust: 10, voodoo_charm: 8 }, gold: 6000, levelReq: 23, difficulty: 400, maxQuality: 1500, durability: 100 },
  { output: 'cultist_robe', qty: 1, materials: { silk_thread: 15, voodoo_charm: 6 }, gold: 3500, levelReq: 18, difficulty: 250, maxQuality: 1000, durability: 85 },
  { output: 'shadow_plate', qty: 1, materials: { silk_thread: 15, voodoo_charm: 6 }, gold: 3500, levelReq: 18, difficulty: 250, maxQuality: 1000, durability: 85 },
  { output: 'shadow_leather', qty: 1, materials: { silk_thread: 15, voodoo_charm: 6 }, gold: 3500, levelReq: 18, difficulty: 250, maxQuality: 1000, durability: 85 },
  { output: 'dark_amulet', qty: 1, materials: { void_dust: 6, voodoo_charm: 4 }, gold: 5000, levelReq: 23, difficulty: 350, maxQuality: 1200, durability: 90 },

  { output: 'obsidian_blade', qty: 1, materials: { obsidian: 15, iron_ingot: 10 }, gold: 3000, levelReq: 15, difficulty: 220, maxQuality: 900, durability: 120 },
  { output: 'obsidian_armor', qty: 1, materials: { obsidian: 25, iron_ingot: 15 }, gold: 4000, levelReq: 15, difficulty: 280, maxQuality: 1100, durability: 150 },
  { output: 'obsidian_leather', qty: 1, materials: { obsidian: 25, iron_ingot: 15 }, gold: 4000, levelReq: 15, difficulty: 280, maxQuality: 1100, durability: 150 },
  { output: 'obsidian_robe', qty: 1, materials: { obsidian: 25, iron_ingot: 15 }, gold: 4000, levelReq: 15, difficulty: 280, maxQuality: 1100, durability: 150 },
  { output: 'obsidian_ring', qty: 1, materials: { obsidian: 8, magic_dust: 5 }, gold: 2000, levelReq: 15, difficulty: 180, maxQuality: 700, durability: 100 },
  { output: 'ironwood_staff', qty: 1, materials: { ironwood: 8, magic_dust: 4 }, gold: 1800, levelReq: 13, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'ironwood_bow', qty: 1, materials: { ironwood: 8, sturdy_leather: 4 }, gold: 1800, levelReq: 13, difficulty: 160, maxQuality: 600, durability: 70 },
  { output: 'shadow_tome', qty: 1, materials: { void_dust: 6, magic_dust: 4 }, gold: 1500, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'world_tree_staff', qty: 1, materials: { ironwood: 12, mana_bloom: 10, magic_dust: 8 }, gold: 4500, levelReq: 20, difficulty: 280, maxQuality: 1000, durability: 80 },
  { output: 'star_orb', qty: 1, materials: { crystal: 20, sun_orb: 10, magic_dust: 12 }, gold: 8000, levelReq: 27, difficulty: 450, maxQuality: 2000, durability: 90 },
  { output: 'mana_ring', qty: 1, materials: { mana_bloom: 10, magic_dust: 6 }, gold: 2000, levelReq: 14, difficulty: 180, maxQuality: 700, durability: 60 },
  { output: 'cave_potion', qty: 1, materials: { cave_fish: 2, herb: 10 }, gold: 300, levelReq: 10, difficulty: 100, maxQuality: 350, durability: 40 },

  // ── Maîtrise & Bijoux ──
  { output: 'mithril_blade', qty: 1, materials: { mithril_ingot: 8, sturdy_leather: 6, magic_dust: 4 }, gold: 5000, levelReq: 18, difficulty: 250, maxQuality: 1000, durability: 80 },
  { output: 'crystal_charm', qty: 1, materials: { crystal: 12, mithril_ingot: 2, magic_dust: 6 }, gold: 3000, levelReq: 15, difficulty: 220, maxQuality: 900, durability: 70 },
  { output: 'lucky_coin', qty: 1, materials: { void_dust: 4, mithril_ingot: 3 }, gold: 1000, levelReq: 24, difficulty: 400, maxQuality: 1500, durability: 80 },
  { output: 'gambler_ring', qty: 1, materials: { void_dust: 6, magic_dust: 10, crystal: 5 }, gold: 3000, levelReq: 25, difficulty: 500, maxQuality: 1800, durability: 90 },
  { output: 'void_reaver', qty: 1, materials: { void_dust: 12, mithril_ingot: 10, magic_dust: 10 }, gold: 12000, levelReq: 28, difficulty: 800, maxQuality: 3000, durability: 100 },
  // Recettes manquantes (items sans source de drop)
  { output: 'spirit_staff', qty: 1, materials: { refined_wood: 8, mana_bloom: 10, magic_dust: 4 }, gold: 2000, levelReq: 13, difficulty: 160, maxQuality: 650, durability: 70 },

  // ── Set de transition « Marais-Braise » (niv.22-24) : comble le trou de
  //    progression Nv20-30 (armes) / Nv15-32 (armures). Matériaux du marais +
  //    entrée du volcan, forgeables dès qu'on atteint le mur de difficulté.
  { output: 'warlord_axe', qty: 1, materials: { mithril_ingot: 3, bog_root: 8, iron_ingot: 6 }, gold: 1600, levelReq: 13, difficulty: 175, maxQuality: 700, durability: 70 },
  { output: 'swiftwind_bow', qty: 1, materials: { ironwood: 6, wildflower: 12, sturdy_leather: 5 }, gold: 1600, levelReq: 13, difficulty: 175, maxQuality: 700, durability: 65 },
  { output: 'emberflow_staff', qty: 1, materials: { ember_stone: 6, refined_wood: 6, magic_dust: 5 }, gold: 1650, levelReq: 13, difficulty: 175, maxQuality: 700, durability: 65 },
  { output: 'marsh_cane', qty: 1, materials: { bog_root: 10, mana_bloom: 6, magic_dust: 4 }, gold: 1650, levelReq: 13, difficulty: 175, maxQuality: 700, durability: 65 },
  { output: 'warplate', qty: 1, materials: { iron_ingot: 12, ember_stone: 4, sturdy_leather: 6 }, gold: 1500, levelReq: 14, difficulty: 185, maxQuality: 720, durability: 90 },
  { output: 'scout_leathers', qty: 1, materials: { sturdy_leather: 10, bog_root: 6, silk_thread: 6 }, gold: 1450, levelReq: 14, difficulty: 185, maxQuality: 700, durability: 80 },
  { output: 'mystic_garb', qty: 1, materials: { silk_thread: 12, mana_bloom: 5, magic_dust: 6 }, gold: 1450, levelReq: 14, difficulty: 185, maxQuality: 700, durability: 70 },

  // ── End-game (ressources volcaniques, niv.30-45) ──
  { output: 'lava_blade', qty: 1, materials: { lava_crystal: 8, mithril_ingot: 6, ember_stone: 4 }, gold: 6000, levelReq: 30, difficulty: 500, maxQuality: 2000, durability: 100 },
  { output: 'infernal_bow', qty: 1, materials: { lava_crystal: 6, ember_stone: 8, ironwood: 6 }, gold: 6000, levelReq: 30, difficulty: 500, maxQuality: 2000, durability: 100 },
  { output: 'magma_staff', qty: 1, materials: { infernal_shard: 4, lava_crystal: 10, magic_dust: 8 }, gold: 7000, levelReq: 32, difficulty: 550, maxQuality: 2200, durability: 100 },
  { output: 'seraph_staff', qty: 1, materials: { infernal_shard: 4, mana_bloom: 12, magic_dust: 8 }, gold: 7000, levelReq: 32, difficulty: 550, maxQuality: 2200, durability: 100 },
  { output: 'volcanic_armor', qty: 1, materials: { ember_stone: 10, iron_ingot: 8, lava_crystal: 6 }, gold: 7000, levelReq: 32, difficulty: 550, maxQuality: 2200, durability: 120 },
  { output: 'infernal_elixir', qty: 1, materials: { infernal_shard: 3, lava_crystal: 4, herb: 12 }, gold: 800, levelReq: 38, difficulty: 300, maxQuality: 1000, durability: 60 },
  { output: 'void_mantle', qty: 1, materials: { void_dust: 15, infernal_shard: 8, mithril_ingot: 6 }, gold: 12000, levelReq: 42, difficulty: 700, maxQuality: 2600, durability: 130 },
  { output: 'primordial_crown', qty: 1, materials: { boss_soul: 5, infernal_shard: 10, void_dust: 10 }, gold: 20000, levelReq: 45, difficulty: 900, maxQuality: 3200, durability: 100 },

  // ── End-game (ressources de la Nécropole de Cristal, niv.34-36) ──
  { output: 'crypt_edge', qty: 1, materials: { crypt_shard: 8, mithril_ingot: 6, bone_dust: 6 }, gold: 6500, levelReq: 34, difficulty: 520, maxQuality: 2100, durability: 100 },
  { output: 'crypt_bow', qty: 1, materials: { crypt_shard: 6, wraith_essence: 4, ironwood: 6 }, gold: 6500, levelReq: 34, difficulty: 520, maxQuality: 2100, durability: 100 },
  { output: 'crypt_scepter', qty: 1, materials: { wraith_essence: 6, crypt_shard: 8, magic_dust: 8 }, gold: 7200, levelReq: 36, difficulty: 560, maxQuality: 2250, durability: 100 },
  { output: 'crypt_rod', qty: 1, materials: { wraith_essence: 6, bone_dust: 10, magic_dust: 8 }, gold: 7200, levelReq: 36, difficulty: 560, maxQuality: 2250, durability: 100 },
  { output: 'crypt_plate', qty: 1, materials: { bone_dust: 14, crypt_shard: 10, iron_ingot: 10 }, gold: 7200, levelReq: 35, difficulty: 560, maxQuality: 2250, durability: 130 },
  { output: 'soul_ward', qty: 1, materials: { wraith_essence: 8, crypt_shard: 6, magic_dust: 6 }, gold: 6000, levelReq: 36, difficulty: 500, maxQuality: 2000, durability: 90 },
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

/**
 * Niveau d'artisanat selon l'XP. Courbe adoucie : les premiers niveaux montent
 * vite (quelques crafts suffisent), la pente devient plus raide ensuite.
 */
export function getCraftLevel(xp: number): { level: number; into: number; need: number } {
  let lvl = 1;
  while (true) {
    const need = Math.floor(45 * Math.pow(lvl, 1.4));
    if (xp >= need) {
      xp -= need;
      lvl++;
    } else {
      return { level: lvl, into: xp, need };
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
    // XP consolatoire (bénéficie aussi du bonus d'équipe/guilde)
    const { xp: consolXp } = applyBonuses(p, { xp: Math.max(1, Math.floor(r.difficulty / 10)), gold: 0 });
    p.craftXp += consolXp;
    return { id: 'craft_trash', qty: 1 };
  }

  addQuestMetric(p, 'crafts', 1);

  // XP basée sur la difficulté et la qualité atteinte, avec une base fixe pour
  // que même les crafts faciles fassent progresser correctement en début de jeu.
  // Bénéficie du bonus d'équipe/guilde comme le combat et la récolte.
  const { xp: xpGain } = applyBonuses(p, { xp: 20 + r.difficulty + Math.floor(r.difficulty * qualityRatio), gold: 0 });
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
    // Qualité maximale = x2 garanti ; en dessous, chance proportionnelle (max 50%).
    if (qualityRatio >= 1) {
      finalQty *= 2;
    } else if (Math.random() < qualityRatio * 0.5) {
      finalQty *= 2;
    }
  }

  // Recette « maîtrisée » (100% qualité atteinte au moins une fois) : débloque
  // le craft multiple rapide (voir `craftMultiple`).
  if (qualityRatio >= 1) {
    if (!p.masteredRecipes) p.masteredRecipes = [];
    if (!p.masteredRecipes.includes(r.output)) p.masteredRecipes.push(r.output);
  }

  addItem(p, outId, finalQty);
  return { id: outId, qty: finalQty };
}

/**
 * Craft rapide en série (façon « Synthèse Rapide » FF14) : réservé aux
 * recettes déjà maîtrisées (100% qualité obtenue au moins une fois via le
 * minijeu). Saute le minijeu — succès garanti, mais qualité TOUJOURS à 0%
 * (aucun bonus de stats, aucune chance de x2) : pure commodité, pas de gain
 * net par rapport à un craft manuel soigné. S'arrête dès que les matériaux
 * manquent (craft partiel, pas d'annulation des unités déjà produites).
 */
export function craftMultiple(p: PlayerState, r: Recipe, count: number): { id: string; totalQty: number; crafted: number } {
  let outId = r.output;
  let totalQty = 0;
  let crafted = 0;
  for (let i = 0; i < count; i++) {
    if (!consumeMaterials(p, r)) break;
    const res = finishCraft(p, r, 0, true);
    outId = res.id;
    totalQty += res.qty;
    crafted++;
  }
  return { id: outId, totalQty, crafted };
}
