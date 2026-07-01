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
  { output: 'iron_ingot', qty: 1, materials: { iron_ore: 3, wood: 1 }, gold: 5, levelReq: 1, difficulty: 20, maxQuality: 100, durability: 40 },
  { output: 'sturdy_leather', qty: 1, materials: { wolf_pelt: 3, herb: 1 }, gold: 5, levelReq: 2, difficulty: 25, maxQuality: 100, durability: 40 },
  { output: 'refined_wood', qty: 1, materials: { hardwood: 2, slime_gel: 1 }, gold: 10, levelReq: 3, difficulty: 30, maxQuality: 150, durability: 40 },
  { output: 'magic_dust', qty: 1, materials: { crystal: 1, frost_shard: 1, ember_core: 1 }, gold: 30, levelReq: 8, difficulty: 60, maxQuality: 300, durability: 50 },
  { output: 'mithril_ingot', qty: 1, materials: { mithril_ore: 3, ember_core: 2 }, gold: 50, levelReq: 12, difficulty: 120, maxQuality: 500, durability: 60 },

  // ── Cuisine (ressources de récolte) ──
  { output: 'grilled_fish', qty: 1, materials: { fish: 2, herb: 1, wood: 1 }, gold: 0, levelReq: 1, difficulty: 15, maxQuality: 50, durability: 30 },
  { output: 'hearty_stew', qty: 1, materials: { big_fish: 1, fish: 2, herb: 3 }, gold: 10, levelReq: 4, difficulty: 35, maxQuality: 150, durability: 40 },
  { output: 'hi_potion', qty: 1, materials: { slime_gel: 3, herb: 3, magic_dust: 1 }, gold: 20, levelReq: 6, difficulty: 50, maxQuality: 200, durability: 40 },

  // ── Forge (Équipements) ──
  { output: 'iron_blade', qty: 1, materials: { iron_ingot: 2, sturdy_leather: 1 }, gold: 40, levelReq: 3, difficulty: 40, maxQuality: 200, durability: 50 },
  { output: 'iron_mail', qty: 1, materials: { iron_ingot: 4, sturdy_leather: 2 }, gold: 50, levelReq: 4, difficulty: 50, maxQuality: 250, durability: 50 },
  { output: 'iron_spear', qty: 1, materials: { iron_ingot: 3, refined_wood: 2 }, gold: 90, levelReq: 6, difficulty: 70, maxQuality: 300, durability: 60 },
  { output: 'steel_plate', qty: 1, materials: { iron_ingot: 6, sturdy_leather: 3, refined_wood: 1 }, gold: 160, levelReq: 9, difficulty: 100, maxQuality: 400, durability: 60 },
  
  { output: 'frost_glaive', qty: 1, materials: { iron_ingot: 3, frost_shard: 4, refined_wood: 2 }, gold: 80, levelReq: 10, difficulty: 120, maxQuality: 500, durability: 70 },
  { output: 'frost_plate', qty: 1, materials: { iron_ingot: 5, frost_shard: 5, sturdy_leather: 4 }, gold: 120, levelReq: 12, difficulty: 150, maxQuality: 600, durability: 70 },
  { output: 'ember_axe', qty: 1, materials: { iron_ingot: 4, ember_core: 4, refined_wood: 3 }, gold: 220, levelReq: 14, difficulty: 180, maxQuality: 800, durability: 80 },

  // ── Bâtons & sceptres (magie) ──
  { output: 'arcane_staff', qty: 1, materials: { refined_wood: 3, magic_dust: 1 }, gold: 50, levelReq: 5, difficulty: 60, maxQuality: 250, durability: 50 },
  { output: 'frost_scepter', qty: 1, materials: { refined_wood: 2, frost_shard: 4, magic_dust: 2 }, gold: 90, levelReq: 11, difficulty: 130, maxQuality: 500, durability: 60 },
  { output: 'crystal_staff', qty: 1, materials: { mithril_ingot: 2, crystal: 6, magic_dust: 4 }, gold: 500, levelReq: 18, difficulty: 300, maxQuality: 1200, durability: 80 },

  // ── Maîtrise & Bijoux ──
  { output: 'mithril_blade', qty: 1, materials: { mithril_ingot: 4, sturdy_leather: 3, magic_dust: 2 }, gold: 500, levelReq: 16, difficulty: 250, maxQuality: 1000, durability: 80 },
  { output: 'crystal_charm', qty: 1, materials: { crystal: 5, mithril_ingot: 1, magic_dust: 3 }, gold: 300, levelReq: 15, difficulty: 220, maxQuality: 900, durability: 70 },
  { output: 'lucky_coin', qty: 1, materials: { void_dust: 2, mithril_ingot: 1 }, gold: 100, levelReq: 20, difficulty: 400, maxQuality: 1500, durability: 80 },
  { output: 'gambler_ring', qty: 1, materials: { void_dust: 3, magic_dust: 5, crystal: 2 }, gold: 300, levelReq: 22, difficulty: 500, maxQuality: 1800, durability: 90 },
  { output: 'void_reaver', qty: 1, materials: { void_dust: 6, mithril_ingot: 5, magic_dust: 5 }, gold: 1200, levelReq: 25, difficulty: 800, maxQuality: 3000, durability: 100 },
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
export function getCraftLevel(xp: number): number {
  let lvl = 1;
  while (xp >= 100 * Math.pow(lvl, 1.5)) {
    xp -= 100 * Math.pow(lvl, 1.5);
    lvl++;
  }
  return lvl;
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
  // Ne s'applique pas aux consos ou matériaux, seulement aux armes/armures/bijoux.
  // On va dire que si c'est stackable on ne met pas de suffixe. Mais c'est géré par items.ts (les consos n'ont pas de stats à up).
  // En fait items.ts modifie hp, atk, def. Si on met q150 sur une potion, elle rendra plus de PV ! C'est cool.
  const bonus = Math.round(qualityRatio * 50); // 0 à 50% de bonus
  if (bonus > 0) {
    outId = `${r.output}:q${100 + bonus}`;
  }
  
  addItem(p, outId, r.qty);
  return outId;
}
