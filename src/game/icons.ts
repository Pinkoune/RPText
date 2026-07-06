import type { IconType } from 'react-icons';
import {
  // Matériaux
  GiWolfHead, GiSlime, GiBoarTusks, GiSnowflake1, GiFire, GiVortex, GiCrownedSkull,
  GiFallingLeaf, GiWaterDrop, GiSun, GiVoodooDoll, GiWoodPile, GiWoodBeam, GiLogging,
  GiStoneBlock, GiOre, GiMinerals, GiCrystalize, GiFishingHook, GiFishScales, GiFishbone,
  GiFishEggs, GiHerbsBundle, GiFlowerPot, GiCrystalGrowth, GiMetalBar, GiSparkles,
  GiTrashCan, GiDaisy, GiSpiderWeb, GiSandsOfTime, GiCactus, GiTreeRoots, GiLotus, GiWool,
  // Consommables
  GiTeapot, GiHealthPotion, GiPotionBall, GiCauldron, GiFishCooked, GiMeal, GiKey,
  GiPresent, GiHammerNails, GiUpgrade, GiHoneyJar, GiWaterFlask, GiFireDash, GiFeather,
  GiMeat, GiHamShank,
  // Trinkets
  GiHeartInside, GiFlowerEmblem, GiPrimitiveNecklace, GiRing, GiClover, GiDiceSixFacesFive,
  GiNecklace, GiGemChain, GiRock, GiPearlNecklace, GiLightBulb, GiEyeShield, GiCheckedShield,
  GiFangs, GiCrystalShine, GiSnakeTongue, GiMagnifyingGlass, GiGloves,
  // Armes de mêlée
  GiWoodClub, GiBattleAxe, GiPointySword, GiBowArrow, GiBroadsword, GiSpearHook, GiTrident,
  GiSwordWound, GiSwordBrandish, GiWarhammer,
  // Armes magiques
  GiMagicPalm, GiWizardStaff, GiBookCover, GiSpellBook, GiOrbital,
  // Armures
  GiClothes, GiLeatherBoot, GiShield, GiPointyHat, GiRobe, GiChestArmor, GiBreastplate,
  GiCape, GiSpikedArmor, GiScaleMail, GiHoodedFigure, GiSickle,
  // Volcanique + end-game
  GiStonePile, GiFireAxe, GiFlameSpin, GiAbdominalArmor, GiFireBottle, GiCrenelCrown, GiAngelWings,
  // Nécropole de Cristal (crypt, niv.30) + end-game
  GiCrystalCluster, GiBoneKnife, GiDeadHead, GiCrystalWand, GiRibcage,
} from 'react-icons/gi';

// Registre id d'objet -> icône Game Icons (react-icons/gi). Les objets non mappés
// retombent sur leur emoji (voir <ItemIcon>). Migration progressive, sûre.
export const ITEM_ICONS: Record<string, IconType> = {
  // ── Matériaux ──
  wolf_pelt: GiWolfHead, slime_gel: GiSlime, boar_tusk: GiBoarTusks, frost_shard: GiSnowflake1,
  ember_core: GiFire, void_dust: GiVortex, boss_soul: GiCrownedSkull, dryad_leaf: GiFallingLeaf,
  pure_water: GiWaterDrop, sun_orb: GiSun, voodoo_charm: GiVoodooDoll,
  wood: GiWoodPile, hardwood: GiWoodBeam, ironwood: GiLogging, stone: GiStoneBlock,
  iron_ore: GiOre, mithril_ore: GiMinerals, obsidian: GiCrystalize,
  fish: GiFishingHook, big_fish: GiFishScales, cave_fish: GiFishbone, mudfish: GiFishEggs,
  herb: GiHerbsBundle, mana_bloom: GiFlowerPot, crystal: GiCrystalGrowth,
  iron_ingot: GiMetalBar, mithril_ingot: GiMetalBar, sturdy_leather: GiWool,
  refined_wood: GiWoodBeam, magic_dust: GiSparkles, craft_trash: GiTrashCan,
  wildflower: GiDaisy, silk_thread: GiSpiderWeb, sun_shard: GiSandsOfTime,
  cactus_pulp: GiCactus, bog_root: GiTreeRoots, frost_lotus: GiLotus,

  // ── Consommables ──
  herb_tea: GiTeapot, potion: GiHealthPotion, hi_potion: GiPotionBall, cave_potion: GiCauldron,
  grilled_fish: GiFishCooked, hearty_stew: GiMeal, dungeon_key: GiKey, lootbox: GiPresent,
  repair_kit: GiHammerNails, upgrade_matrix: GiUpgrade, honey_mead: GiHoneyJar,
  cactus_water: GiWaterFlask, phoenix_elixir: GiFireDash, phoenix_feather: GiFeather,
  bait_wolf: GiMeat, bait_yeti: GiHamShank, bait_efreet: GiFire, bait_voidling: GiVortex,

  // ── Trinkets ──
  heartsteel: GiHeartInside, flower_crown: GiFlowerEmblem, bone_necklace: GiPrimitiveNecklace,
  slime_ring: GiRing, lucky_coin: GiClover, gambler_ring: GiDiceSixFacesFive,
  frost_amulet: GiNecklace, ember_ring: GiRing, wind_charm: GiGemChain, earth_talisman: GiRock,
  pearl_ring: GiPearlNecklace, light_pendant: GiLightBulb, dark_amulet: GiEyeShield,
  obsidian_ring: GiRing, mana_ring: GiGemChain, titan_seal: GiCheckedShield,
  berserker_fang: GiFangs, crystal_charm: GiCrystalShine, venom_fang: GiSnakeTongue,
  craft_goggles: GiMagnifyingGlass, gather_gloves: GiGloves,

  // ── Armes de mêlée ──
  wooden_club: GiWoodClub, stone_axe: GiBattleAxe, rusty_sword: GiPointySword,
  hunter_bow: GiBowArrow, iron_blade: GiBroadsword, frost_glaive: GiSpearHook,
  ember_axe: GiBattleAxe, void_reaver: GiSwordWound, wind_blade: GiSwordBrandish,
  earth_hammer: GiWarhammer, tide_spear: GiTrident, sun_blade: GiBroadsword,
  shadow_bow: GiBowArrow, obsidian_blade: GiBroadsword, ironwood_bow: GiBowArrow,
  bronze_blade: GiPointySword, oak_bow: GiBowArrow, soldier_sword: GiBroadsword,
  ranger_bow: GiBowArrow, tempered_greatblade: GiBroadsword, master_longbow: GiBowArrow,
  iron_spear: GiSpearHook,

  // ── Armes magiques ──
  apprentice_wand: GiMagicPalm, arcane_staff: GiWizardStaff, acolyte_wand: GiMagicPalm,
  adept_staff: GiWizardStaff, frost_scepter: GiWizardStaff, crystal_staff: GiCrystalShine,
  wind_staff: GiWizardStaff, earth_tome: GiBookCover, ember_staff: GiWizardStaff,
  water_wand: GiMagicPalm, radiant_staff: GiWizardStaff, void_tome: GiSpellBook,
  ironwood_staff: GiWizardStaff, shadow_tome: GiSpellBook, world_tree_staff: GiWizardStaff,
  star_orb: GiOrbital, sage_staff: GiWizardStaff,

  // ── Armures ──
  woven_shirt: GiClothes, leather_boots: GiLeatherBoot, wooden_shield: GiShield,
  mage_hat: GiPointyHat, cloth_robe: GiRobe, iron_mail: GiChestArmor, frost_plate: GiBreastplate,
  ember_chest: GiBreastplate, wind_cloak: GiCape, earth_plate: GiSpikedArmor,
  scale_mail: GiScaleMail, templar_armor: GiChestArmor, cultist_robe: GiHoodedFigure,
  obsidian_armor: GiSpikedArmor, steel_plate: GiBreastplate, silk_robe: GiRobe,
  sunplate_armor: GiBreastplate, smith_apron: GiClothes, farmer_boots: GiLeatherBoot,
  golden_sickle: GiSickle, master_hammer: GiHammerNails,

  // ── Compléments (derniers objets non mappés) ──
  battle_axe: GiBattleAxe, halberd: GiTrident, mithril_blade: GiBroadsword,
  healing_wand: GiMagicPalm, spirit_staff: GiWizardStaff,
  sacred_robe: GiRobe, ranger_vest: GiChestArmor, guardian_mantle: GiCape,
  pioneer_medallion: GiNecklace,
  // Volcanique + end-game
  lava_crystal: GiCrystalize, ember_stone: GiStonePile, infernal_shard: GiCrystalShine,
  lava_blade: GiFireAxe, infernal_bow: GiFlameSpin, magma_staff: GiFireDash,
  volcanic_armor: GiAbdominalArmor, infernal_elixir: GiFireBottle, void_mantle: GiCape,
  primordial_crown: GiCrenelCrown, seraph_staff: GiAngelWings,
  // Nécropole de Cristal (crypt, niv.30) + end-game
  crypt_shard: GiCrystalCluster, bone_dust: GiBoneKnife, wraith_essence: GiDeadHead,
  crypt_edge: GiSwordWound, crypt_bow: GiBowArrow, crypt_scepter: GiWizardStaff,
  crypt_rod: GiMagicPalm, crypt_plate: GiRibcage, soul_ward: GiCrystalWand,
};

export function hasItemIcon(id: string): boolean {
  return !!ITEM_ICONS[id.split(':')[0]];
}
