import type { ItemDef } from './types';

export const ITEMS: Record<string, ItemDef> = {
  // ── Matériaux (loot monstres) ──
  wolf_pelt: { id: 'wolf_pelt', name: 'Peau de loup', icon: '🐾', rarity: 'common', slot: 'material', value: 4, desc: 'Fourrure rêche.' },
  slime_gel: { id: 'slime_gel', name: 'Gel de slime', icon: '🟢', rarity: 'common', slot: 'material', value: 3, desc: 'Visqueux et tiède.' },
  boar_tusk: { id: 'boar_tusk', name: 'Défense de sanglier', icon: '🦴', rarity: 'uncommon', slot: 'material', value: 9, desc: 'Solide et pointue.' },
  frost_shard: { id: 'frost_shard', name: 'Éclat de givre', icon: '🧊', rarity: 'rare', slot: 'material', value: 25, desc: 'Froid qui ne fond jamais.' },
  ember_core: { id: 'ember_core', name: 'Cœur de braise', icon: '🔥', rarity: 'rare', slot: 'material', value: 30, desc: 'Pulse d\'une chaleur ardente.' },
  void_dust: { id: 'void_dust', name: 'Poussière du vide', icon: '🌌', rarity: 'epic', slot: 'material', value: 80, desc: 'Aspire la lumière alentour.' },
  dryad_leaf: { id: 'dryad_leaf', name: 'Feuille de dryade', icon: '🍂', rarity: 'uncommon', slot: 'material', value: 12, desc: 'Pleine de sève magique.' },
  pure_water: { id: 'pure_water', name: 'Eau pure', icon: '💧', rarity: 'uncommon', slot: 'material', value: 15, desc: 'Une eau qui ne se corrompt jamais.' },
  sun_orb: { id: 'sun_orb', name: 'Orbe solaire', icon: '☀️', rarity: 'rare', slot: 'material', value: 35, desc: 'Chaude au toucher, brille dans le noir.' },
  voodoo_charm: { id: 'voodoo_charm', name: 'Charme vaudou', icon: '🪆', rarity: 'epic', slot: 'material', value: 65, desc: 'Émane une aura sombre.' },

  // ── Ressources de récolte (Forage/Mine/Chop/Fish) ──
  wood: { id: 'wood', name: 'Bois', icon: '🪵', rarity: 'common', slot: 'material', value: 3, desc: 'Bûche tendre. Récoltée au bûcheronnage.' },
  hardwood: { id: 'hardwood', name: 'Bois dur', icon: '🪵', rarity: 'uncommon', slot: 'material', value: 14, desc: 'Bois noble, dense et résistant.' },
  ironwood: { id: 'ironwood', name: 'Bois de fer', icon: '🌳', rarity: 'rare', slot: 'material', value: 45, desc: 'Un bois aussi robuste que le métal.' },
  stone: { id: 'stone', name: 'Pierre', icon: '🪨', rarity: 'common', slot: 'material', value: 3, desc: 'Roche brute extraite à la mine.' },
  iron_ore: { id: 'iron_ore', name: 'Minerai de fer', icon: '⛏️', rarity: 'uncommon', slot: 'material', value: 11, desc: 'À fondre pour forger.' },
  mithril_ore: { id: 'mithril_ore', name: 'Minerai de mithril', icon: '🪙', rarity: 'rare', slot: 'material', value: 55, desc: 'Métal légendaire des hauteurs gelées.' },
  obsidian: { id: 'obsidian', name: 'Obsidienne', icon: '⬛', rarity: 'epic', slot: 'material', value: 90, desc: 'Verre volcanique extrêmement coupant et résistant.' },
  fish: { id: 'fish', name: 'Poisson', icon: '🐟', rarity: 'common', slot: 'material', value: 6, desc: 'Pêché dans les eaux du biome.' },
  big_fish: { id: 'big_fish', name: 'Gros poisson', icon: '🐠', rarity: 'uncommon', slot: 'material', value: 22, desc: 'Une belle prise.' },
  cave_fish: { id: 'cave_fish', name: 'Poisson des cavernes', icon: '🐟', rarity: 'rare', slot: 'material', value: 50, desc: 'Poisson aveugle pêché dans les profondeurs.' },
  herb: { id: 'herb', name: 'Herbe médicinale', icon: '🌿', rarity: 'common', slot: 'material', value: 5, desc: 'Cueillie au sol. Base des remèdes.' },
  mana_bloom: { id: 'mana_bloom', name: 'Fleur de mana', icon: '🌸', rarity: 'uncommon', slot: 'material', value: 18, desc: 'Ses pétales regorgent de magie pure.' },
  crystal: { id: 'crystal', name: 'Cristal', icon: '🔮', rarity: 'rare', slot: 'material', value: 38, desc: 'Concentré d\'énergie pure. Introuvable hors de l\'Abysse Gelé.' },

  // ── Consommables & Divers ──
  herb_tea: { id: 'herb_tea', name: 'Thé aux herbes', icon: '🍵', rarity: 'common', slot: 'consumable', hp: 30, value: 5, desc: 'Rend 30 PV.' },
  potion: { id: 'potion', name: 'Potion de soin', icon: '🧪', rarity: 'common', slot: 'consumable', hp: 80, value: 15, desc: 'Rend 80 PV.' },
  hi_potion: { id: 'hi_potion', name: 'Hi-Potion', icon: '⚗️', rarity: 'uncommon', slot: 'consumable', hp: 400, value: 45, desc: 'Rend 400 PV.' },
  cave_potion: { id: 'cave_potion', name: 'Potion des cavernes', icon: '🧪', rarity: 'rare', slot: 'consumable', hp: 800, value: 120, desc: 'Rend 800 PV. Préparée dans le noir absolu.' },
  grilled_fish: { id: 'grilled_fish', name: 'Poisson grillé', icon: '🍢', rarity: 'common', slot: 'consumable', hp: 120, value: 30, desc: 'Rend 120 PV. Cuisiné.' },
  hearty_stew: { id: 'hearty_stew', name: 'Ragoût copieux', icon: '🍲', rarity: 'uncommon', slot: 'consumable', hp: 250, value: 70, desc: 'Rend 250 PV. Un vrai festin.' },
  dungeon_key: { id: 'dungeon_key', name: 'Clé de donjon', icon: '🗝️', rarity: 'rare', slot: 'consumable', value: 1000, desc: 'Double les récompenses d\'un donjon réussi (consommée automatiquement à la victoire si tu en possèdes une).' },
  lootbox: { id: 'lootbox', name: 'Lootbox', icon: '🎁', rarity: 'epic', slot: 'consumable', value: 100, desc: 'Ouvre pour obtenir des objets (utiliser la commande /open).' },
  repair_kit: { id: 'repair_kit', name: 'Kit de réparation', icon: '🛠️', rarity: 'uncommon', slot: 'consumable', value: 50, desc: 'Permet de restaurer la durabilité d\'un équipement dans la forge.' },
  upgrade_matrix: { id: 'upgrade_matrix', name: 'Matrice d\'amélioration', icon: '✨', rarity: 'legendary', slot: 'consumable', value: 2000, desc: 'Un artefact puissant capable d\'améliorer un équipement d\'une étoile.' },

  // ── Trinkets ──
  heartsteel: { id: 'heartsteel', name: 'Coeuracier', icon: '❤️‍🔥', rarity: 'legendary', slot: 'trinket', hp: 100, value: 0, desc: 'Tous les 3 coups portés, augmente la santé et l\'attaque pour le reste du combat.', element: 'neutral', maxDurability: 0 },
  flower_crown: { id: 'flower_crown', name: 'Couronne de fleurs', icon: '🌸', rarity: 'common', slot: 'trinket', hp: 15, value: 8, desc: 'Tressée à la main.', element: 'earth', maxDurability: 300 },
  bone_necklace: { id: 'bone_necklace', name: 'Collier d\'os', icon: '🦴', rarity: 'uncommon', slot: 'trinket', atk: 2, hp: 10, value: 35, desc: 'Trophée de chasse.', element: 'earth', maxDurability: 300 },
  slime_ring: { id: 'slime_ring', name: 'Anneau gluant', icon: '🟢', rarity: 'common', slot: 'trinket', hp: 25, value: 20, desc: 'Toujours humide.', element: 'water', maxDurability: 300 },
  lucky_coin: { id: 'lucky_coin', name: 'Pièce porte-bonheur', icon: '🍀', rarity: 'rare', slot: 'trinket', value: 150, desc: 'Améliore légèrement la chance au casino.', element: 'light', maxDurability: 300 },
  gambler_ring: { id: 'gambler_ring', name: 'Anneau du parieur', icon: '💍', rarity: 'epic', slot: 'trinket', atk: 6, value: 400, desc: 'Le destin sourit aux audacieux.', element: 'dark', maxDurability: 300 },
  frost_amulet: { id: 'frost_amulet', name: 'Amulette de givre', icon: '❄️', rarity: 'rare', slot: 'trinket', def: 5, hp: 40, value: 200, desc: 'Glace le sang.', element: 'frost', maxDurability: 300, setId: 'frost_set' },
  ember_ring: { id: 'ember_ring', name: 'Anneau ardent', icon: '🔥', rarity: 'epic', slot: 'trinket', atk: 10, hp: 50, value: 450, desc: 'Conserve une chaleur éternelle.', element: 'fire', maxDurability: 300, setId: 'fire_set' },
  wind_charm: { id: 'wind_charm', name: 'Charme du Vent', icon: '🎐', rarity: 'rare', slot: 'trinket', def: 5, hp: 20, value: 200, desc: 'Tinte avec le vent.', element: 'wind', maxDurability: 300, setId: 'wind_set' },
  earth_talisman: { id: 'earth_talisman', name: 'Talisman Terrestre', icon: '🪨', rarity: 'epic', slot: 'trinket', def: 12, hp: 60, value: 480, desc: 'Lourd mais protecteur.', element: 'earth', maxDurability: 300, setId: 'earth_set' },
  pearl_ring: { id: 'pearl_ring', name: 'Anneau de perle', icon: '💍', rarity: 'rare', slot: 'trinket', hp: 50, atk: 4, value: 280, desc: 'Brille sous l\'eau.', element: 'water', maxDurability: 300, setId: 'water_set' },
  light_pendant: { id: 'light_pendant', name: 'Pendentif de Lumière', icon: '✨', rarity: 'epic', slot: 'trinket', atk: 8, def: 8, hp: 40, value: 650, desc: 'Chasse les cauchemars.', element: 'light', maxDurability: 300, setId: 'light_set' },
  dark_amulet: { id: 'dark_amulet', name: 'Amulette Sombre', icon: '👁️', rarity: 'legendary', slot: 'trinket', atk: 20, hp: -20, value: 1500, desc: 'Sacrifie la santé pour la puissance.', element: 'dark', maxDurability: 300, setId: 'dark_set' },
  obsidian_ring: { id: 'obsidian_ring', name: 'Anneau d\'Obsidienne', icon: '⬛', rarity: 'epic', slot: 'trinket', def: 15, value: 600, desc: 'Dure comme le roc.', element: 'earth', maxDurability: 300, setId: 'obsidian_set' },
  mana_ring: { id: 'mana_ring', name: 'Anneau de Mana', icon: '🌸', rarity: 'rare', slot: 'trinket', atk: 8, hp: 100, value: 450, desc: 'Infusé de pure magie.', element: 'light', maxDurability: 300 },
  titan_seal: { id: 'titan_seal', name: 'Sceau du Titan', icon: '🛡️', rarity: 'epic', slot: 'trinket', def: 16, hp: 120, value: 900, desc: 'La robustesse d\'un titan condensée en un sceau.', element: 'earth', maxDurability: 400 },
  berserker_fang: { id: 'berserker_fang', name: 'Croc du Berserker', icon: '🩸', rarity: 'legendary', slot: 'trinket', atk: 22, hp: -15, value: 1600, desc: 'Sacrifie un peu de vitalité pour une rage dévastatrice.', element: 'dark', maxDurability: 400 },

  // ── Ressources exclusives à un biome ──
  wildflower: { id: 'wildflower', name: 'Fleur des plaines', icon: '🌼', rarity: 'common', slot: 'material', value: 7, desc: 'Ne pousse que dans les plaines venteuses.' },
  silk_thread: { id: 'silk_thread', name: 'Fil de soie', icon: '🕸️', rarity: 'uncommon', slot: 'material', value: 12, desc: 'Tissé par les araignées des sous-bois de Sylvebois.' },
  sun_shard: { id: 'sun_shard', name: 'Éclat solaire', icon: '☀️', rarity: 'rare', slot: 'material', value: 40, desc: 'Sable durci par des générations de soleil du désert.' },
  cactus_pulp: { id: 'cactus_pulp', name: 'Pulpe de cactus', icon: '🌵', rarity: 'common', slot: 'material', value: 6, desc: 'Gorgée d\'eau, elle ne pousse que dans les dunes.' },
  bog_root: { id: 'bog_root', name: 'Racine des tourbières', icon: '🪱', rarity: 'uncommon', slot: 'material', value: 13, desc: 'S\'enfonce profondément dans la vase du marais.' },
  mudfish: { id: 'mudfish', name: 'Poisson des vases', icon: '🐡', rarity: 'uncommon', slot: 'material', value: 18, desc: 'Ne vit que dans les eaux troubles du marais.' },
  frost_lotus: { id: 'frost_lotus', name: 'Lotus des glaces', icon: '🪷', rarity: 'rare', slot: 'material', value: 45, desc: 'Fleurit une fois par saison, uniquement dans l\'Abysse Gelé.' },

  // ── Nourriture (craft) ──
  honey_mead: { id: 'honey_mead', name: 'Hydromel des plaines', icon: '🍯', rarity: 'common', slot: 'consumable', hp: 150, value: 25, desc: 'Rend 150 PV. Doux et réconfortant.' },
  cactus_water: { id: 'cactus_water', name: 'Eau de cactus', icon: '🥤', rarity: 'common', slot: 'consumable', hp: 60, value: 10, desc: 'Rend 60 PV. Fraîche malgré la chaleur.' },
  phoenix_elixir: { id: 'phoenix_elixir', name: 'Élixir du phénix', icon: '🧊', rarity: 'epic', slot: 'consumable', hp: 600, value: 200, desc: 'Rend 600 PV. Le remède le plus puissant du monde connu.' },
  phoenix_feather: { id: 'phoenix_feather', name: 'Plume de Phénix', icon: '🪶', rarity: 'legendary', slot: 'consumable', value: 1000, desc: 'Peut être utilisée en combat de donjon pour ramener un allié à la vie.' },


  // ── Matériaux d'artisanat intermédiaires ──
  iron_ingot: { id: 'iron_ingot', name: 'Lingot de fer', icon: '🔩', rarity: 'uncommon', slot: 'material', value: 25, desc: 'Fer fondu et purifié.' },
  mithril_ingot: { id: 'mithril_ingot', name: 'Lingot de mithril', icon: '⚙️', rarity: 'rare', slot: 'material', value: 120, desc: 'Alliage magique très résistant.' },
  sturdy_leather: { id: 'sturdy_leather', name: 'Cuir robuste', icon: '📜', rarity: 'uncommon', slot: 'material', value: 15, desc: 'Peau tannée avec soin.' },
  refined_wood: { id: 'refined_wood', name: 'Bois raffiné', icon: '🪵', rarity: 'uncommon', slot: 'material', value: 30, desc: 'Planches poncées et traitées.' },
  magic_dust: { id: 'magic_dust', name: 'Poudre magique', icon: '✨', rarity: 'rare', slot: 'material', value: 60, desc: 'Résidu d\'enchantement.' },
  craft_trash: { id: 'craft_trash', name: 'Déchet', icon: '🗑️', rarity: 'common', slot: 'material', value: 1, desc: 'Restes d\'un craft raté.' },

  // ── Armes de mêlée (Guerrier / Archer) ──
  wooden_club: { id: 'wooden_club', name: 'Gourdin en bois', icon: '🏏', rarity: 'common', slot: 'weapon', atk: 2, classes: ['warrior', 'archer'], value: 5, desc: 'Une simple branche épaisse.', element: 'earth', dmgType: 'physical', maxDurability: 500 },
  stone_axe: { id: 'stone_axe', name: 'Hache en pierre', icon: '🪓', rarity: 'common', slot: 'weapon', atk: 5, classes: ['warrior', 'archer'], value: 12, desc: 'Tranchant brut mais efficace.', element: 'earth', dmgType: 'physical', maxDurability: 500 },
  rusty_sword: { id: 'rusty_sword', name: 'Épée rouillée', icon: '🗡️', rarity: 'common', slot: 'weapon', atk: 4, classes: ['warrior', 'archer'], value: 10, desc: 'Mieux que rien.', element: 'neutral', dmgType: 'physical', maxDurability: 500 },
  hunter_bow: { id: 'hunter_bow', name: 'Arc de chasseur', icon: '🏹', rarity: 'uncommon', slot: 'weapon', atk: 6, classes: ['archer'], value: 20, desc: 'Idéal pour chasser le petit gibier.', element: 'neutral', dmgType: 'physical', maxDurability: 500 },
  iron_blade: { id: 'iron_blade', name: 'Lame de fer', icon: '⚔️', rarity: 'uncommon', slot: 'weapon', atk: 10, classes: ['warrior', 'archer'], value: 60, desc: 'Tranchant fiable.', element: 'neutral', dmgType: 'physical', maxDurability: 500 },
  frost_glaive: { id: 'frost_glaive', name: 'Glaive de givre', icon: '❄️', rarity: 'rare', slot: 'weapon', atk: 22, classes: ['warrior', 'archer'], value: 220, desc: 'Gèle les ennemis touchés.', element: 'frost', dmgType: 'physical', maxDurability: 500, setId: 'frost_set' },
  ember_axe: { id: 'ember_axe', name: 'Hache ardente', icon: '🪓', rarity: 'epic', slot: 'weapon', atk: 34, classes: ['warrior'], value: 500, desc: 'Brûle tout sur son passage.', element: 'fire', dmgType: 'physical', maxDurability: 500, setId: 'fire_set' },
  void_reaver: { id: 'void_reaver', name: 'Faucheuse du vide', icon: '💀', rarity: 'legendary', slot: 'weapon', atk: 55, classes: ['warrior'], value: 1500, desc: 'Murmure des promesses interdites. (Brisée - Impossible à équiper)', element: 'dark', dmgType: 'physical', maxDurability: 500 },
  wind_blade: { id: 'wind_blade', name: 'Lame des vents', icon: '🌪️', rarity: 'rare', slot: 'weapon', atk: 18, classes: ['warrior', 'archer'], value: 200, desc: 'Tranche avec la force du vent.', element: 'wind', dmgType: 'physical', maxDurability: 500, setId: 'wind_set' },
  earth_hammer: { id: 'earth_hammer', name: 'Marteau sismique', icon: '🔨', rarity: 'epic', slot: 'weapon', atk: 38, classes: ['warrior'], value: 600, desc: 'Fait trembler la terre.', element: 'earth', dmgType: 'physical', maxDurability: 500, setId: 'earth_set' },
  tide_spear: { id: 'tide_spear', name: 'Lance des Marées', icon: '🔱', rarity: 'rare', slot: 'weapon', atk: 24, classes: ['warrior', 'archer'], value: 250, desc: 'Fluide et perçante.', element: 'water', dmgType: 'physical', maxDurability: 500, setId: 'water_set' },
  sun_blade: { id: 'sun_blade', name: 'Lame Solaire', icon: '🗡️', rarity: 'epic', slot: 'weapon', atk: 42, classes: ['warrior'], value: 850, desc: 'Rayonne d\'une lumière intense.', element: 'light', dmgType: 'physical', maxDurability: 500, setId: 'light_set' },
  shadow_bow: { id: 'shadow_bow', name: 'Arc des Ombres', icon: '🏹', rarity: 'legendary', slot: 'weapon', atk: 60, classes: ['archer'], value: 1800, desc: 'Tire des flèches invisibles.', element: 'dark', dmgType: 'physical', maxDurability: 500, setId: 'dark_set' },
  obsidian_blade: { id: 'obsidian_blade', name: 'Lame d\'Obsidienne', icon: '🗡️', rarity: 'epic', slot: 'weapon', atk: 35, classes: ['warrior'], value: 700, desc: 'Tranchant terrifiant, très lourde.', element: 'earth', dmgType: 'physical', maxDurability: 500, setId: 'obsidian_set' },
  ironwood_bow: { id: 'ironwood_bow', name: 'Arc en Bois de Fer', icon: '🏹', rarity: 'rare', slot: 'weapon', atk: 28, classes: ['archer'], value: 380, desc: 'Nécessite une force surhumaine pour le bander.', element: 'neutral', dmgType: 'physical', maxDurability: 500 },

  // ── Armes intermédiaires (craft, niveaux 4-8) ──
  bronze_blade: { id: 'bronze_blade', name: 'Lame de bronze', icon: '🗡️', rarity: 'uncommon', slot: 'weapon', atk: 13, classes: ['warrior', 'archer'], value: 90, desc: 'Un cran au-dessus du fer brut.', element: 'neutral', dmgType: 'physical', maxDurability: 550 },
  oak_bow: { id: 'oak_bow', name: 'Arc de chêne', icon: '🏹', rarity: 'uncommon', slot: 'weapon', atk: 15, classes: ['archer'], value: 110, desc: 'Souple et fiable pour le chasseur aguerri.', element: 'neutral', dmgType: 'physical', maxDurability: 550 },
  soldier_sword: { id: 'soldier_sword', name: 'Épée de soldat', icon: '⚔️', rarity: 'rare', slot: 'weapon', atk: 20, classes: ['warrior', 'archer'], value: 240, desc: 'L\'arme réglementaire des vétérans.', element: 'neutral', dmgType: 'physical', maxDurability: 600 },
  ranger_bow: { id: 'ranger_bow', name: 'Arc de rôdeur', icon: '🏹', rarity: 'rare', slot: 'weapon', atk: 24, classes: ['archer'], value: 300, desc: 'Précis à longue portée.', element: 'wind', dmgType: 'physical', maxDurability: 600 },

  // ── Armes de transition (mid-game, non liées à un set, niveaux 13-15) ──
  tempered_greatblade: { id: 'tempered_greatblade', name: 'Grande lame trempée', icon: '⚔️', rarity: 'epic', slot: 'weapon', atk: 44, classes: ['warrior'], value: 1400, desc: 'Acier replié mille fois, tranchant redoutable.', element: 'neutral', dmgType: 'physical', maxDurability: 800 },
  master_longbow: { id: 'master_longbow', name: 'Arc long de maître', icon: '🏹', rarity: 'epic', slot: 'weapon', atk: 40, classes: ['archer'], value: 1300, desc: 'Portée et précision au sommet de l\'artisanat.', element: 'neutral', dmgType: 'physical', maxDurability: 800 },
  sage_staff: { id: 'sage_staff', name: 'Bâton du sage', icon: '🪄', rarity: 'epic', slot: 'weapon', atk: 42, classes: ['mage', 'healer'], value: 1350, desc: 'Concentre une magie stable et puissante.', element: 'neutral', dmgType: 'magical', maxDurability: 800 },

  // ── Bâtons & sceptres (Mage / Soigneur) ──
  apprentice_wand: { id: 'apprentice_wand', name: 'Baguette d\'apprenti', icon: '🪄', rarity: 'common', slot: 'weapon', atk: 4, classes: ['mage', 'healer'], value: 10, desc: 'Crépite d\'une faible magie.', element: 'light', dmgType: 'magical', maxDurability: 500 },
  arcane_staff: { id: 'arcane_staff', name: 'Bâton arcanique', icon: '🪈', rarity: 'uncommon', slot: 'weapon', atk: 12, classes: ['mage', 'healer'], value: 70, desc: 'Canalise les flux magiques.', element: 'neutral', dmgType: 'magical', maxDurability: 500 },
  acolyte_wand: { id: 'acolyte_wand', name: 'Baguette d\'acolyte', icon: '🪄', rarity: 'uncommon', slot: 'weapon', atk: 14, classes: ['mage', 'healer'], value: 95, desc: 'Un pas de plus vers la maîtrise arcanique.', element: 'light', dmgType: 'magical', maxDurability: 550 },
  adept_staff: { id: 'adept_staff', name: 'Bâton d\'adepte', icon: '🪈', rarity: 'rare', slot: 'weapon', atk: 24, classes: ['mage', 'healer'], value: 290, desc: 'Canalise des sorts plus puissants.', element: 'neutral', dmgType: 'magical', maxDurability: 600 },
  frost_scepter: { id: 'frost_scepter', name: 'Sceptre de givre', icon: '🔱', rarity: 'rare', slot: 'weapon', atk: 24, classes: ['mage', 'healer'], value: 230, desc: 'Le froid obéit à son porteur.', element: 'frost', dmgType: 'magical', maxDurability: 500, setId: 'frost_set' },
  crystal_staff: { id: 'crystal_staff', name: 'Bâton de cristal', icon: '🔮', rarity: 'epic', slot: 'weapon', atk: 40, classes: ['mage', 'healer'], value: 820, desc: 'Vibre d\'une puissance pure.', element: 'light', dmgType: 'magical', maxDurability: 500 },
  wind_staff: { id: 'wind_staff', name: 'Bâton du Vent', icon: '🌪️', rarity: 'rare', slot: 'weapon', atk: 20, classes: ['mage', 'healer'], value: 210, desc: 'Invoque des rafales coupantes.', element: 'wind', dmgType: 'magical', maxDurability: 500, setId: 'wind_set' },
  earth_tome: { id: 'earth_tome', name: 'Grimoire Terrestre', icon: '📖', rarity: 'epic', slot: 'weapon', atk: 35, classes: ['mage', 'healer'], value: 580, desc: 'Ses pages sont faites d\'écorce de fer.', element: 'earth', dmgType: 'magical', maxDurability: 500, setId: 'earth_set' },
  ember_staff: { id: 'ember_staff', name: 'Bâton Ardent', icon: '🔥', rarity: 'epic', slot: 'weapon', atk: 38, classes: ['mage', 'healer'], value: 650, desc: 'Canalise les feux de l\'enfer.', element: 'fire', dmgType: 'magical', maxDurability: 500, setId: 'fire_set' },
  water_wand: { id: 'water_wand', name: 'Baguette Océanique', icon: '💧', rarity: 'rare', slot: 'weapon', atk: 26, classes: ['mage', 'healer'], value: 280, desc: 'Purifie et frappe avec l\'eau.', element: 'water', dmgType: 'magical', maxDurability: 500, setId: 'water_set' },
  radiant_staff: { id: 'radiant_staff', name: 'Bâton Radiant', icon: '✨', rarity: 'epic', slot: 'weapon', atk: 45, classes: ['mage', 'healer'], value: 900, desc: 'Illumine les ténèbres.', element: 'light', dmgType: 'magical', maxDurability: 500, setId: 'light_set' },
  void_tome: { id: 'void_tome', name: 'Tome du Vide', icon: '📓', rarity: 'legendary', slot: 'weapon', atk: 65, classes: ['mage', 'healer'], value: 2000, desc: 'Dévore l\'âme de celui qui le lit.', element: 'dark', dmgType: 'magical', maxDurability: 500, setId: 'dark_set' },
  ironwood_staff: { id: 'ironwood_staff', name: 'Bâton en Bois de Fer', icon: '🦯', rarity: 'rare', slot: 'weapon', atk: 30, classes: ['mage', 'healer'], value: 350, desc: 'Extrêmement lourd pour un bâton magique.', element: 'neutral', dmgType: 'magical', maxDurability: 500 },
  shadow_tome: { id: 'shadow_tome', name: 'Grimoire des Ombres', icon: '📓', rarity: 'rare', slot: 'weapon', atk: 28, hp: 20, classes: ['mage', 'healer'], value: 300, desc: 'Ses pages sont écrites avec du sang.', element: 'dark', dmgType: 'magical', maxDurability: 500 },
  world_tree_staff: { id: 'world_tree_staff', name: 'Bâton de l\'Arbre-Monde', icon: '🌿', rarity: 'epic', slot: 'weapon', atk: 45, hp: 150, classes: ['mage', 'healer'], value: 1200, desc: 'Palpite d\'une vie éternelle.', element: 'earth', dmgType: 'magical', maxDurability: 500 },
  star_orb: { id: 'star_orb', name: 'Orbe Stellaire', icon: '💫', rarity: 'legendary', slot: 'weapon', atk: 60, classes: ['mage', 'healer'], value: 1800, desc: 'Contient une constellation entière.', element: 'light', dmgType: 'magical', maxDurability: 500 },
  // ── Armures (Guerrier / Archer / Mage) ──
  woven_shirt: { id: 'woven_shirt', name: 'Chemise tissée', icon: '👕', rarity: 'common', slot: 'armor', def: 2, hp: 5, value: 8, desc: 'Tissée avec de la fibre végétale.', element: 'earth', maxDurability: 1000 },
  leather_boots: { id: 'leather_boots', name: 'Bottes en cuir', icon: '🥾', rarity: 'common', slot: 'armor', def: 3, hp: 10, value: 15, desc: 'Protège les pieds des ronces.', element: 'neutral', maxDurability: 1000 },
  wooden_shield: { id: 'wooden_shield', name: 'Bouclier en bois', icon: '🛡️', rarity: 'common', slot: 'armor', def: 4, hp: 15, value: 12, desc: 'Un couvercle de tonneau reconverti.', element: 'earth', maxDurability: 1000 },
  mage_hat: { id: 'mage_hat', name: 'Chapeau pointu', icon: '🧙', rarity: 'uncommon', slot: 'armor', def: 1, hp: 15, value: 25, desc: 'Le couvre-chef classique des mages.', element: 'light', maxDurability: 1000 },
  cloth_robe: { id: 'cloth_robe', name: 'Robe de tissu', icon: '🧥', rarity: 'common', slot: 'armor', def: 3, hp: 10, value: 12, desc: 'Légère et confortable.', element: 'neutral', maxDurability: 1000 },
  iron_mail: { id: 'iron_mail', name: 'Cotte de fer', icon: '🛡️', rarity: 'uncommon', slot: 'armor', def: 9, hp: 30, value: 70, desc: 'Protection solide.', element: 'neutral', maxDurability: 1000 },
  frost_plate: { id: 'frost_plate', name: 'Plastron de givre', icon: '🥶', rarity: 'rare', slot: 'armor', def: 18, hp: 80, value: 260, desc: 'Repousse le froid mortel.', element: 'frost', maxDurability: 1000, setId: 'frost_set' },
  ember_chest: { id: 'ember_chest', name: 'Cuirasse ardente', icon: '🌋', rarity: 'epic', slot: 'armor', def: 25, hp: 150, value: 500, desc: 'Brûle ceux qui la touchent.', element: 'fire', maxDurability: 1000, setId: 'fire_set' },
  wind_cloak: { id: 'wind_cloak', name: 'Cape des vents', icon: '🌪️', rarity: 'rare', slot: 'armor', def: 15, hp: 60, value: 220, desc: 'Allège son porteur.', element: 'wind', maxDurability: 1000, setId: 'wind_set' },
  earth_plate: { id: 'earth_plate', name: 'Armure de terre', icon: '⛰️', rarity: 'epic', slot: 'armor', def: 35, hp: 100, value: 600, desc: 'Aussi dure que la roche.', element: 'earth', maxDurability: 1000, setId: 'earth_set' },
  scale_mail: { id: 'scale_mail', name: 'Cotte d\'écailles', icon: '🧜', rarity: 'rare', slot: 'armor', def: 18, hp: 60, value: 250, desc: 'Écailles miroitantes.', element: 'water', maxDurability: 1000, setId: 'water_set' },
  templar_armor: { id: 'templar_armor', name: 'Armure de Templier', icon: '🛡️', rarity: 'epic', slot: 'armor', def: 30, hp: 120, value: 800, desc: 'Bénie par les prêtres.', element: 'light', maxDurability: 1000, setId: 'light_set' },
  cultist_robe: { id: 'cultist_robe', name: 'Robe de Cultiste', icon: '🧥', rarity: 'epic', slot: 'armor', def: 20, hp: 50, value: 650, desc: 'Imbriquée de magie noire.', element: 'dark', maxDurability: 1000, setId: 'dark_set' },
  obsidian_armor: { id: 'obsidian_armor', name: 'Armure d\'Obsidienne', icon: '⬛', rarity: 'epic', slot: 'armor', def: 45, hp: 200, value: 1000, desc: 'Presque impénétrable.', element: 'earth', maxDurability: 1000, setId: 'obsidian_set' },

  // ── Équipement craftable (ressources) ──
  iron_spear: { id: 'iron_spear', name: 'Lance de fer', icon: '🔱', rarity: 'uncommon', slot: 'weapon', atk: 16, classes: ['warrior', 'archer'], value: 140, desc: 'Allonge et puissance.' },
  steel_plate: { id: 'steel_plate', name: 'Harnois d\'acier', icon: '🛡️', rarity: 'rare', slot: 'armor', def: 16, hp: 70, value: 280, desc: 'Forgé à partir de minerai.' },
  mithril_blade: { id: 'mithril_blade', name: 'Lame de mithril', icon: '⚔️', rarity: 'epic', slot: 'weapon', atk: 40, classes: ['warrior', 'archer'], value: 800, desc: 'Tranchant qui ne s\'émousse jamais.' },
  crystal_charm: { id: 'crystal_charm', name: 'Charme de cristal', icon: '🔮', rarity: 'epic', slot: 'trinket', def: 8, hp: 40, value: 600, desc: 'Vibre d\'une énergie protectrice.' },

  // ── Équipement régional (ressources exclusives à un biome) ──
  silk_robe: { id: 'silk_robe', name: 'Robe de soie', icon: '🥻', rarity: 'uncommon', slot: 'armor', def: 6, hp: 25, value: 90, desc: 'Tissée avec la soie des araignées de Sylvebois.' },
  sunplate_armor: { id: 'sunplate_armor', name: 'Cuirasse solaire', icon: '🌞', rarity: 'rare', slot: 'armor', def: 20, hp: 60, value: 340, desc: 'Forgée dans le sable durci du désert.' },
  venom_fang: { id: 'venom_fang', name: 'Croc venimeux', icon: '🦷', rarity: 'rare', slot: 'trinket', atk: 10, value: 260, desc: 'Extrait des tourbières du marais, encore toxique.' },

  // ── Équipements de Métier ──
  smith_apron: { id: 'smith_apron', name: 'Tablier de Forgeron', icon: '🎽', rarity: 'uncommon', slot: 'armor', def: 5, maxCp: 30, maxDurability: 500, value: 50, desc: 'Améliore la concentration pour l\'artisanat.' },
  master_hammer: { id: 'master_hammer', name: 'Marteau de Maître', icon: '🔨', rarity: 'rare', slot: 'weapon', atk: 5, maxCp: 50, maxDurability: 500, value: 120, desc: 'Outil de précision pour la forge.' },
  craft_goggles: { id: 'craft_goggles', name: 'Lunettes d\'Artisan', icon: '🥽', rarity: 'uncommon', slot: 'trinket', hp: 20, maxCp: 20, maxDurability: 300, value: 80, desc: 'Permet de voir les moindres détails.' },

  farmer_boots: { id: 'farmer_boots', name: 'Bottes de Fermier', icon: '👢', rarity: 'uncommon', slot: 'armor', def: 5, maxGp: 20, maxDurability: 500, value: 50, desc: 'Bottes confortables pour les longues récoltes.' },
  golden_sickle: { id: 'golden_sickle', name: 'Faucille en or', icon: '🌾', rarity: 'rare', slot: 'weapon', atk: 5, maxGp: 30, maxDurability: 500, value: 120, desc: 'Lame parfaite pour récolter sans abîmer.' },
  gather_gloves: { id: 'gather_gloves', name: 'Gants de Récolte', icon: '🧤', rarity: 'uncommon', slot: 'trinket', hp: 20, maxGp: 15, maxDurability: 300, value: 80, desc: 'Protègent les mains et évitent la fatigue.' },
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
