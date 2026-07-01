import type { ItemDef } from './types';

export const ITEMS: Record<string, ItemDef> = {
  // ── Matériaux (loot) ──
  wolf_pelt: { id: 'wolf_pelt', name: 'Peau de loup', icon: '🐾', rarity: 'common', slot: 'material', value: 4, desc: 'Fourrure rêche.' },
  slime_gel: { id: 'slime_gel', name: 'Gel de slime', icon: '🟢', rarity: 'common', slot: 'material', value: 3, desc: 'Visqueux et tiède.' },
  boar_tusk: { id: 'boar_tusk', name: 'Défense de sanglier', icon: '🦴', rarity: 'uncommon', slot: 'material', value: 9, desc: 'Solide et pointue.' },
  frost_shard: { id: 'frost_shard', name: 'Éclat de givre', icon: '🧊', rarity: 'rare', slot: 'material', value: 25, desc: 'Froid qui ne fond jamais.' },
  ember_core: { id: 'ember_core', name: 'Cœur de braise', icon: '🔥', rarity: 'rare', slot: 'material', value: 30, desc: 'Pulse d\'une chaleur ardente.' },
  void_dust: { id: 'void_dust', name: 'Poussière du vide', icon: '🌌', rarity: 'epic', slot: 'material', value: 80, desc: 'Aspire la lumière alentour.' },

  // ── Consommables & Divers ──
  herb_tea: { id: 'herb_tea', name: 'Thé aux herbes', icon: '🍵', rarity: 'common', slot: 'consumable', hp: 30, value: 5, desc: 'Rend 30 PV.' },
  potion: { id: 'potion', name: 'Potion de soin', icon: '🧪', rarity: 'common', slot: 'consumable', hp: 80, value: 15, desc: 'Rend 80 PV.' },
  hi_potion: { id: 'hi_potion', name: 'Hi-Potion', icon: '⚗️', rarity: 'uncommon', slot: 'consumable', hp: 400, value: 45, desc: 'Rend 400 PV.' },
  grilled_fish: { id: 'grilled_fish', name: 'Poisson grillé', icon: '🍢', rarity: 'common', slot: 'consumable', hp: 120, value: 30, desc: 'Rend 120 PV. Cuisiné.' },
  hearty_stew: { id: 'hearty_stew', name: 'Ragoût copieux', icon: '🍲', rarity: 'uncommon', slot: 'consumable', hp: 250, value: 70, desc: 'Rend 250 PV. Un vrai festin.' },
  dungeon_key: { id: 'dungeon_key', name: 'Clé de donjon', icon: '🗝️', rarity: 'rare', slot: 'consumable', value: 1000, desc: 'Ouvre les portes des donjons.' },
  lootbox: { id: 'lootbox', name: 'Lootbox', icon: '🎁', rarity: 'epic', slot: 'consumable', value: 100, desc: 'Ouvre pour obtenir des objets (utiliser la commande /open).' },

  // ── Armes de mêlée (Guerrier / Archer) ──
  wooden_club: { id: 'wooden_club', name: 'Gourdin en bois', icon: '🏏', rarity: 'common', slot: 'weapon', atk: 2, classes: ['warrior', 'archer'], value: 5, desc: 'Une simple branche épaisse.' },
  stone_axe: { id: 'stone_axe', name: 'Hache en pierre', icon: '🪓', rarity: 'common', slot: 'weapon', atk: 5, classes: ['warrior', 'archer'], value: 12, desc: 'Tranchant brut mais efficace.' },
  rusty_sword: { id: 'rusty_sword', name: 'Épée rouillée', icon: '🗡️', rarity: 'common', slot: 'weapon', atk: 4, classes: ['warrior', 'archer'], value: 10, desc: 'Mieux que rien.' },
  iron_blade: { id: 'iron_blade', name: 'Lame de fer', icon: '⚔️', rarity: 'uncommon', slot: 'weapon', atk: 10, classes: ['warrior', 'archer'], value: 60, desc: 'Tranchant fiable.' },
  frost_glaive: { id: 'frost_glaive', name: 'Glaive de givre', icon: '❄️', rarity: 'rare', slot: 'weapon', atk: 22, classes: ['warrior', 'archer'], value: 220, desc: 'Gèle les ennemis touchés.' },
  ember_axe: { id: 'ember_axe', name: 'Hache ardente', icon: '🪓', rarity: 'epic', slot: 'weapon', atk: 34, classes: ['warrior'], value: 500, desc: 'Brûle tout sur son passage.' },
  void_reaver: { id: 'void_reaver', name: 'Faucheuse du vide', icon: '💀', rarity: 'legendary', slot: 'weapon', atk: 55, classes: ['warrior'], value: 1500, desc: 'Murmure des promesses interdites. (Brisée - Impossible à équiper)' },

  // ── Bâtons & sceptres (Mage / Soigneur) ──
  apprentice_wand: { id: 'apprentice_wand', name: 'Baguette d\'apprenti', icon: '🪄', rarity: 'common', slot: 'weapon', atk: 4, classes: ['mage', 'healer'], value: 10, desc: 'Crépite d\'une faible magie.' },
  arcane_staff: { id: 'arcane_staff', name: 'Bâton arcanique', icon: '🪈', rarity: 'uncommon', slot: 'weapon', atk: 12, classes: ['mage', 'healer'], value: 70, desc: 'Canalise les flux magiques.' },
  frost_scepter: { id: 'frost_scepter', name: 'Sceptre de givre', icon: '🔱', rarity: 'rare', slot: 'weapon', atk: 24, classes: ['mage', 'healer'], value: 230, desc: 'Le froid obéit à son porteur.' },
  crystal_staff: { id: 'crystal_staff', name: 'Bâton de cristal', icon: '🔮', rarity: 'epic', slot: 'weapon', atk: 40, classes: ['mage', 'healer'], value: 820, desc: 'Vibre d\'une puissance pure.' },

  // ── Armures (Guerrier / Archer / Mage) ──
  woven_shirt: { id: 'woven_shirt', name: 'Chemise tissée', icon: '👕', rarity: 'common', slot: 'armor', def: 2, hp: 5, value: 8, desc: 'Tissée avec de la fibre végétale.' },
  cloth_robe: { id: 'cloth_robe', name: 'Robe de tissu', icon: '🧥', rarity: 'common', slot: 'armor', def: 3, hp: 10, value: 12, desc: 'Légère et confortable.' },
  iron_mail: { id: 'iron_mail', name: 'Cotte de fer', icon: '🛡️', rarity: 'uncommon', slot: 'armor', def: 9, hp: 30, value: 70, desc: 'Protection solide.' },
  frost_plate: { id: 'frost_plate', name: 'Plastron de givre', icon: '🥶', rarity: 'rare', slot: 'armor', def: 18, hp: 80, value: 260, desc: 'Repousse le froid mortel.' },

  // ── Trinkets ──
  lucky_coin: { id: 'lucky_coin', name: 'Pièce porte-bonheur', icon: '🍀', rarity: 'rare', slot: 'trinket', value: 150, desc: 'Améliore légèrement la chance au casino.' },
  gambler_ring: { id: 'gambler_ring', name: 'Anneau du parieur', icon: '💍', rarity: 'epic', slot: 'trinket', atk: 6, value: 400, desc: 'Le destin sourit aux audacieux.' },

  // ── Ressources de récolte ──
  wood: { id: 'wood', name: 'Bois', icon: '🪵', rarity: 'common', slot: 'material', value: 3, desc: 'Bûche tendre. Récoltée au bûcheronnage.' },
  hardwood: { id: 'hardwood', name: 'Bois dur', icon: '🪵', rarity: 'uncommon', slot: 'material', value: 14, desc: 'Bois noble, dense et résistant.' },
  stone: { id: 'stone', name: 'Pierre', icon: '🪨', rarity: 'common', slot: 'material', value: 3, desc: 'Roche brute extraite à la mine.' },
  iron_ore: { id: 'iron_ore', name: 'Minerai de fer', icon: '⛏️', rarity: 'uncommon', slot: 'material', value: 11, desc: 'À fondre pour forger.' },
  mithril_ore: { id: 'mithril_ore', name: 'Minerai de mithril', icon: '🪙', rarity: 'rare', slot: 'material', value: 55, desc: 'Métal légendaire des hauteurs gelées.' },
  fish: { id: 'fish', name: 'Poisson', icon: '🐟', rarity: 'common', slot: 'material', value: 6, desc: 'Pêché dans les eaux du biome.' },
  big_fish: { id: 'big_fish', name: 'Gros poisson', icon: '🐠', rarity: 'uncommon', slot: 'material', value: 22, desc: 'Une belle prise.' },
  herb: { id: 'herb', name: 'Herbe médicinale', icon: '🌿', rarity: 'common', slot: 'material', value: 5, desc: 'Cueillie au sol. Base des remèdes.' },
  crystal: { id: 'crystal', name: 'Cristal', icon: '🔮', rarity: 'rare', slot: 'material', value: 38, desc: 'Concentré d\'énergie pure.' },

  // ── Nourriture (craft) ──


  // ── Matériaux d'artisanat intermédiaires ──
  iron_ingot: { id: 'iron_ingot', name: 'Lingot de fer', icon: '🔩', rarity: 'uncommon', slot: 'material', value: 25, desc: 'Fer fondu et purifié.' },
  mithril_ingot: { id: 'mithril_ingot', name: 'Lingot de mithril', icon: '⚙️', rarity: 'rare', slot: 'material', value: 120, desc: 'Alliage magique très résistant.' },
  sturdy_leather: { id: 'sturdy_leather', name: 'Cuir robuste', icon: '📜', rarity: 'uncommon', slot: 'material', value: 15, desc: 'Peau tannée avec soin.' },
  refined_wood: { id: 'refined_wood', name: 'Bois raffiné', icon: '🪵', rarity: 'uncommon', slot: 'material', value: 30, desc: 'Planches poncées et traitées.' },
  magic_dust: { id: 'magic_dust', name: 'Poudre magique', icon: '✨', rarity: 'rare', slot: 'material', value: 60, desc: 'Résidu d\'enchantement.' },
  craft_trash: { id: 'craft_trash', name: 'Déchet', icon: '🗑️', rarity: 'common', slot: 'material', value: 1, desc: 'Restes d\'un craft raté.' },

  // ── Équipement craftable (ressources) ──
  iron_spear: { id: 'iron_spear', name: 'Lance de fer', icon: '🔱', rarity: 'uncommon', slot: 'weapon', atk: 16, classes: ['warrior', 'archer'], value: 140, desc: 'Allonge et puissance.' },
  steel_plate: { id: 'steel_plate', name: 'Harnois d\'acier', icon: '🛡️', rarity: 'rare', slot: 'armor', def: 16, hp: 70, value: 280, desc: 'Forgé à partir de minerai.' },
  mithril_blade: { id: 'mithril_blade', name: 'Lame de mithril', icon: '⚔️', rarity: 'epic', slot: 'weapon', atk: 40, classes: ['warrior', 'archer'], value: 800, desc: 'Tranchant qui ne s\'émousse jamais.' },
  crystal_charm: { id: 'crystal_charm', name: 'Charme de cristal', icon: '🔮', rarity: 'epic', slot: 'trinket', def: 8, hp: 40, value: 600, desc: 'Vibre d\'une énergie protectrice.' },
};

export const RARITY_COLOR: Record<ItemDef['rarity'], string> = {
  common: '#b8c0cf',
  uncommon: '#62d67a',
  rare: '#5aa6ff',
  epic: '#c46bff',
  legendary: '#ffae42',
};

/**
 * Récupère un objet par son ID.
 * Supporte les ID dynamiques avec suffixe de qualité, ex: "iron_blade:q120"
 * Le suffixe q120 signifie +20% sur les stats (ATK, DEF, HP).
 */
export function getItem(id: string): ItemDef | undefined {
  if (!id) return undefined;
  const [baseId, qualityTag] = id.split(':');
  const base = ITEMS[baseId];
  if (!base) return undefined;
  
  if (!qualityTag || !qualityTag.startsWith('q')) {
    return base;
  }
  
  const qStr = qualityTag.slice(1);
  const qVal = parseInt(qStr, 10);
  if (isNaN(qVal) || qVal === 100) return base;

  const mult = qVal / 100;
  
  return {
    ...base,
    id,
    name: `${base.name} ${qVal > 100 ? '+' + (qVal - 100) + '%' : '-' + (100 - qVal) + '%'}`,
    atk: base.atk ? Math.max(1, Math.round(base.atk * mult)) : undefined,
    def: base.def ? Math.max(1, Math.round(base.def * mult)) : undefined,
    hp: base.hp ? Math.max(1, Math.round(base.hp * mult)) : undefined,
    value: Math.max(1, Math.round(base.value * mult)),
    desc: base.desc.replace(' (Brisée - Impossible à équiper)', ''),
  };
}

export function item(id: string): ItemDef | undefined {
  return getItem(id);
}
