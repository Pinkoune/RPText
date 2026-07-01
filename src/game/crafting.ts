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
  { output: 'magic_dust', qty: 1, materials: { crystal: 3, frost_shard: 3, ember_core: 3 }, gold: 300, levelReq: 8, difficulty: 60, maxQuality: 300, durability: 50 },
  { output: 'mithril_ingot', qty: 1, materials: { mithril_ore: 10, ember_core: 5 }, gold: 500, levelReq: 12, difficulty: 120, maxQuality: 500, durability: 60 },

  // ── Cuisine & Potions (Consommables) ──
  { output: 'herb_tea', qty: 1, materials: { herb: 6, wood: 3 }, gold: 5, levelReq: 1, difficulty: 10, maxQuality: 30, durability: 20 },
  { output: 'grilled_fish', qty: 1, materials: { fish: 6, herb: 3, wood: 3 }, gold: 20, levelReq: 1, difficulty: 15, maxQuality: 50, durability: 30 },
  { output: 'hi_potion', qty: 1, materials: { slime_gel: 4, herb: 12 }, gold: 50, levelReq: 3, difficulty: 40, maxQuality: 150, durability: 40 },
  { output: 'hearty_stew', qty: 1, materials: { big_fish: 3, fish: 6, herb: 10 }, gold: 100, levelReq: 4, difficulty: 35, maxQuality: 150, durability: 40 },

  // ── Équipement Basique (Débutant) ──
  { output: 'wooden_club', qty: 1, materials: { wood: 12 }, gold: 10, levelReq: 1, difficulty: 20, maxQuality: 50, durability: 30 },
  { output: 'stone_axe', qty: 1, materials: { wood: 6, stone: 10 }, gold: 20, levelReq: 1, difficulty: 30, maxQuality: 80, durability: 30 },
  { output: 'woven_shirt', qty: 1, materials: { herb: 15 }, gold: 15, levelReq: 1, difficulty: 25, maxQuality: 70, durability: 30 },

  // ── Forge (Équipements Avancés) ──
  { output: 'iron_blade', qty: 1, materials: { iron_ingot: 4, sturdy_leather: 2 }, gold: 400, levelReq: 3, difficulty: 40, maxQuality: 200, durability: 50 },
  { output: 'iron_mail', qty: 1, materials: { iron_ingot: 8, sturdy_leather: 4 }, gold: 500, levelReq: 4, difficulty: 50, maxQuality: 250, durability: 50 },
  { output: 'iron_spear', qty: 1, materials: { iron_ingot: 6, refined_wood: 4 }, gold: 900, levelReq: 6, difficulty: 70, maxQuality: 300, durability: 60 },
  { output: 'steel_plate', qty: 1, materials: { iron_ingot: 12, sturdy_leather: 6, refined_wood: 3 }, gold: 1600, levelReq: 9, difficulty: 100, maxQuality: 400, durability: 60 },
  
  { output: 'frost_glaive', qty: 1, materials: { iron_ingot: 6, frost_shard: 10, refined_wood: 4 }, gold: 800, levelReq: 10, difficulty: 120, maxQuality: 500, durability: 70 },
  { output: 'frost_plate', qty: 1, materials: { iron_ingot: 10, frost_shard: 12, sturdy_leather: 8 }, gold: 1200, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_axe', qty: 1, materials: { iron_ingot: 8, ember_core: 10, refined_wood: 6 }, gold: 2200, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  // ── Bâtons & sceptres (magie) ──
  { output: 'arcane_staff', qty: 1, materials: { refined_wood: 6, magic_dust: 3 }, gold: 500, levelReq: 5, difficulty: 60, maxQuality: 250, durability: 50 },
  { output: 'frost_scepter', qty: 1, materials: { refined_wood: 4, frost_shard: 10, magic_dust: 5 }, gold: 900, levelReq: 11, difficulty: 130, maxQuality: 500, durability: 60 },
  { output: 'crystal_staff', qty: 1, materials: { mithril_ingot: 4, crystal: 15, magic_dust: 8 }, gold: 5000, levelReq: 18, difficulty: 300, maxQuality: 1200, durability: 80 },

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
export function finishCraft(p: PlayerState, r: Recipe, qualityRatio: number, success: boolean): string {
  if (!success) {
    addItem(p, 'craft_trash', 1);
    // XP consolatoire
    p.craftXp += Math.max(1, Math.floor(r.difficulty / 10));
    return 'craft_trash';
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
  // Suffixe de qualité uniquement pour l'équipement
  if (outItem && ['weapon', 'armor', 'trinket'].includes(outItem.slot)) {
    const bonus = Math.round(qualityRatio * 50); // 0 à 50% de bonus
    if (bonus > 0) {
      outId = `${r.output}:q${100 + bonus}`;
    }
  }
  
  addItem(p, outId, r.qty);
  return outId;
}
