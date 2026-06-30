import type { PlayerState } from './types';
import { addItem, removeItem } from './player';
import { addQuestMetric } from './quests';

export interface Recipe {
  output: string;
  qty: number;
  /** id matériau -> quantité requise */
  materials: Record<string, number>;
  gold: number;
}

export const RECIPES: Recipe[] = [
  // ── Cuisine (ressources de récolte) ──
  { output: 'grilled_fish', qty: 1, materials: { fish: 2, herb: 1, wood: 1 }, gold: 0 },
  { output: 'hearty_stew', qty: 1, materials: { big_fish: 1, fish: 2, herb: 3 }, gold: 10 },

  // ── Remèdes ──
  { output: 'hi_potion', qty: 1, materials: { slime_gel: 2, herb: 2 }, gold: 20 },

  // ── Forge (bois + minerai) ──
  { output: 'iron_blade', qty: 1, materials: { iron_ore: 4, wood: 3 }, gold: 40 },
  { output: 'iron_mail', qty: 1, materials: { iron_ore: 5, wolf_pelt: 2 }, gold: 50 },
  { output: 'iron_spear', qty: 1, materials: { iron_ore: 6, hardwood: 3, wood: 4 }, gold: 90 },
  { output: 'steel_plate', qty: 1, materials: { iron_ore: 10, stone: 6, hardwood: 2 }, gold: 160 },
  { output: 'frost_glaive', qty: 1, materials: { frost_shard: 3, iron_ore: 4 }, gold: 80 },
  { output: 'frost_plate', qty: 1, materials: { frost_shard: 4, stone: 6 }, gold: 120 },
  { output: 'ember_axe', qty: 1, materials: { ember_core: 3, frost_shard: 1, hardwood: 4 }, gold: 220 },

  // ── Maîtrise (mithril / cristal) ──
  { output: 'mithril_blade', qty: 1, materials: { mithril_ore: 8, hardwood: 4, crystal: 2 }, gold: 500 },
  { output: 'crystal_charm', qty: 1, materials: { crystal: 5, mithril_ore: 2 }, gold: 300 },

  // ── Bijoux & légendaire ──
  { output: 'lucky_coin', qty: 1, materials: { void_dust: 2, crystal: 1 }, gold: 100 },
  { output: 'gambler_ring', qty: 1, materials: { void_dust: 3, ember_core: 1, crystal: 2 }, gold: 300 },
  { output: 'void_reaver', qty: 1, materials: { void_dust: 6, ember_core: 2, mithril_ore: 4 }, gold: 1200 },
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

/** Forge l'objet : consomme matériaux + or, ajoute le résultat. */
export function craft(p: PlayerState, r: Recipe): boolean {
  if (!canCraft(p, r)) return false;
  for (const [id, need] of Object.entries(r.materials)) removeItem(p, id, need);
  p.gold -= r.gold;
  addItem(p, r.output, r.qty);
  addQuestMetric(p, 'crafts', 1);
  return true;
}
