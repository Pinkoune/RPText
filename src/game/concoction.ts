import type { PlayerState } from './types';
import { ITEMS } from './items';

export interface ConcoctionRecipe {
  id: string; // The item ID of the resulting bait
  name: string; // Used for UI
  icon: string;
  reqLevel: number;
  ingredients: { id: string; qty: number }[];
  xp: number;
  difficulty: number;
  durability: number;
  maxQuality: number;
}

export const CONCOCTION_RECIPES: ConcoctionRecipe[] = [
  {
    id: 'bait_slime',
    name: 'Appât pour Slime',
    icon: '🟢',
    reqLevel: 1,
    ingredients: [{ id: 'slime_gel', qty: 2 }, { id: 'herb', qty: 2 }],
    xp: 5,
    difficulty: 15, durability: 30, maxQuality: 40,
  },
  {
    id: 'bait_wolf',
    name: 'Appât pour Loup',
    icon: '🥩',
    reqLevel: 1,
    ingredients: [{ id: 'wildflower', qty: 2 }, { id: 'potion', qty: 1 }],
    xp: 10,
    difficulty: 20, durability: 40, maxQuality: 50,
  },
  {
    id: 'bait_yeti',
    name: 'Appât pour Yéti',
    icon: '🍖',
    reqLevel: 5,
    ingredients: [{ id: 'frost_shard', qty: 3 }, { id: 'hi_potion', qty: 1 }],
    xp: 25,
    difficulty: 40, durability: 50, maxQuality: 100,
  },
  {
    id: 'bait_efreet',
    name: 'Appât pour Éfrit',
    icon: '🔥',
    reqLevel: 10,
    ingredients: [{ id: 'ember_core', qty: 3 }, { id: 'sun_shard', qty: 2 }],
    xp: 50,
    difficulty: 80, durability: 60, maxQuality: 200,
  },
  {
    id: 'bait_voidling',
    name: 'Appât du Vide',
    icon: '🕳️',
    reqLevel: 15,
    ingredients: [{ id: 'void_dust', qty: 5 }, { id: 'phoenix_elixir', qty: 1 }],
    xp: 100,
    difficulty: 120, durability: 70, maxQuality: 300,
  },
];

export function getConcoctionLevel(xp: number): { level: number; currentXp: number; nextXp: number; totalXp: number } {
  let level = 1;
  let nextXp = 50;
  let total = xp;

  while (total >= nextXp && level < 50) {
    total -= nextXp;
    level++;
    nextXp = Math.floor(nextXp * 1.3);
  }

  return { level, currentXp: total, nextXp, totalXp: xp };
}

export function canConcoct(p: PlayerState, r: ConcoctionRecipe): boolean {
  const cLevel = getConcoctionLevel(p.concoctionXp ?? 0).level;
  if (cLevel < r.reqLevel) return false;
  for (const ing of r.ingredients) {
    if ((p.inventory[ing.id] ?? 0) < ing.qty) return false;
  }
  return true;
}
