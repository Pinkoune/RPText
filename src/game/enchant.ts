import type { PlayerState } from './types';
import { item } from './items';

export const MAX_ENCHANTS_PER_SLOT = 2;
export const ENCHANT_REMOVAL_COST = 10; // Gems cost to remove

export function getAvailableRunes(p: PlayerState): { id: string; qty: number }[] {
  return Object.entries(p.inventory)
    .filter(([id, qty]) => {
      const def = item(id);
      return def && def.id.startsWith('rune_') && qty > 0;
    })
    .map(([id, qty]) => ({ id, qty }));
}

// Les runes sont désormais serties sur l'INSTANCE d'objet (clé d'inventaire de
// la pièce équipée), pas sur le slot : elles suivent l'objet (déséquipement,
// revente marché). L'UI passe toujours le slot ; on résout la clé d'instance ici.
export function equipEnchant(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket', runeId: string) {
  const key = p.equipped[slot];
  if (!key) throw new Error("Aucun objet équipé dans cet emplacement.");
  if (!p.enchants) p.enchants = {};
  if (!p.enchants[key]) p.enchants[key] = [];
  if (p.enchants[key].length >= MAX_ENCHANTS_PER_SLOT) throw new Error("Plus de place pour de nouvelles runes.");
  if ((p.inventory[runeId] || 0) <= 0) throw new Error("Tu ne possèdes pas cette rune.");

  p.inventory[runeId] -= 1;
  p.enchants[key].push(runeId);
}

export function removeEnchant(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket', index: number) {
  const key = p.equipped[slot];
  if (!key || !p.enchants || !p.enchants[key] || !p.enchants[key][index]) throw new Error("Aucune rune à cet emplacement.");
  if (p.gems < ENCHANT_REMOVAL_COST) throw new Error(`Il te faut ${ENCHANT_REMOVAL_COST} Gemmes pour retirer une rune.`);

  p.gems -= ENCHANT_REMOVAL_COST;
  const runeId = p.enchants[key][index];
  p.enchants[key].splice(index, 1);
  p.inventory[runeId] = (p.inventory[runeId] || 0) + 1;
}

/** Clé d'instance équipée pour un slot (helper UI). */
export function enchantsForEquipped(p: PlayerState, slot: 'weapon' | 'armor' | 'trinket'): string[] {
  const key = p.equipped[slot];
  return (key && p.enchants?.[key]) || [];
}
