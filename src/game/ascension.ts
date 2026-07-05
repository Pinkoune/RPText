// ─── Rituel de Prestige (« Affronter le Mal ») ───────────────────────────────
// Commande secrète débloquée au Nv.50 (max), lançable uniquement depuis les
// Abysses. Le joueur affronte un boss unique calibré sur un loadout PARFAIT
// (talents max + meilleure arme q150/5★/runes + armure + bijou + familier).
// Victoire = prestige (reset complet + bonus permanent + insigne). Échec = perte
// de niveaux selon les PV restants du boss, + cooldown avant nouvel essai.

import type { PlayerState, ClassId } from './types';
import { deriveStats, starterWeapon } from './player';
import { getTalentsForClass } from './talents';
import { CLASSES } from './classes';
import { mintInstanceId } from './items';

export const ASCENSION_FAIL_COOLDOWN = 8 * 60 * 60 * 1000; // 8h après un échec
export const PRESTIGE_BONUS_PER_LEVEL = 0.08;  // +8% ATK/DEF/PV par prestige
export const PRESTIGE_XPGOLD_PER_LEVEL = 0.10; // +10% XP/Or par prestige
export const MAX_PRESTIGE_STACK = 5;           // au-delà, le bonus plafonne

export interface AscensionBoss {
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  element: string;
  dmgType: 'physical' | 'magical';
}

/** Meilleure arme par classe de base (les recettes end-game). */
const BEST_WEAPON: Record<string, string> = {
  warrior: 'lava_blade', archer: 'infernal_bow', mage: 'magma_staff', healer: 'seraph_staff',
};

/** Bonus permanent de prestige (multiplicateur), plafonné. */
export function prestigeStatMult(p: PlayerState): number {
  const n = Math.min(p.prestigeLevel ?? 0, MAX_PRESTIGE_STACK);
  return 1 + n * PRESTIGE_BONUS_PER_LEVEL;
}
export function prestigeXpGoldMult(p: PlayerState): number {
  const n = Math.min(p.prestigeLevel ?? 0, MAX_PRESTIGE_STACK);
  return 1 + n * PRESTIGE_XPGOLD_PER_LEVEL;
}

/**
 * Stats du boss, calibrées sur un joueur PARFAITEMENT optimisé de la classe du
 * joueur. On fabrique un faux joueur idéal et on lit `deriveStats` → le boss
 * suit exactement la puissance atteignable au max.
 */
export function computeAscensionBoss(p: PlayerState): AscensionBoss {
  const base = (CLASSES[p.classId]?.parent ?? p.classId) as ClassId;
  const weapon = BEST_WEAPON[base] ?? 'lava_blade';

  const fake: PlayerState = structuredClone(p);
  fake.level = 50;
  // Tous les talents de la classe au rang max.
  fake.talents = {};
  for (const t of getTalentsForClass(p.classId)) fake.talents[t.id] = t.maxRank;

  // Meilleur équipement : arme (q150 = +50% stats), armure, bijou — tous 5★ + runes.
  const wKey = mintInstanceId(`${weapon}:q150`);
  const aKey = mintInstanceId('void_mantle:q150');
  const tKey = mintInstanceId('primordial_crown:q150');
  fake.equipped = { ...fake.equipped, weapon: wKey, armor: aKey, trinket: tKey };
  fake.gearStars = { [wKey]: 5, [aKey]: 5, [tKey]: 5 };
  fake.gearDurability = { [wKey]: 800, [aKey]: 1400, [tKey]: 500 };
  fake.enchants = {
    [wKey]: ['rune_atk_2', 'rune_atk_2'],
    [aKey]: ['rune_def_2', 'rune_hp_2'],
    [tKey]: ['rune_hp_2', 'rune_hp_2'],
  };
  // Familier légendaire maxé.
  fake.familiars = { ...(fake.familiars ?? {}), starling: 100000 };
  fake.activeFamiliarId = 'starling';
  fake.prestigeLevel = 0; // le boss ne compte pas les bonus de prestige déjà acquis

  const s = deriveStats(fake, true); // skipEquipCheck

  // Calibrage : vrai mur de fin de jeu. Beaucoup de PV (le combat s'éternise) et
  // des dégâts qui dépassent le sustain d'un moine/soigneur → il faut vraiment le
  // build idéal + une bonne gestion des soins pour l'emporter.
  const hp = Math.round(s.atk * 36);
  const atk = Math.round(s.maxHp / 6 + s.def * 0.6);
  const def = Math.round(s.atk * 0.15);

  return {
    name: 'Le Néant Originel',
    emoji: '🕳️',
    hp, maxHp: hp, atk, def,
    element: 'dark',
    dmgType: 'magical',
  };
}

export type AscensionResult =
  | { won: true; message: string }
  | { won: false; levelsLost: number; message: string };

/** Décide le résultat selon les PV restants du boss (0..1) et la victoire. */
export function ascensionOutcome(bossHpFraction: number, won: boolean): AscensionResult {
  if (won) {
    return { won: true, message: 'Tu terrasses le Néant. Le monde renaît autour de toi... et toi avec.' };
  }
  const frac = Math.max(0, Math.min(1, bossHpFraction));
  const drain = 'Le néant t\'aspire de l\'espérance de vie...';
  if (frac > 0.75) return { won: false, levelsLost: 3, message: drain };
  if (frac > 0.50) return { won: false, levelsLost: 2, message: drain };
  if (frac > 0.25) return { won: false, levelsLost: 1, message: drain };
  return { won: false, levelsLost: 0, message: 'Vous parvenez à ramper en dehors de cette horreur...' };
}

/**
 * Applique le résultat au joueur (à appeler dans `mutate`).
 * - Victoire : PRESTIGE — reset de la progression, prestigeLevel++, bonus permanent.
 *   On conserve l'identité, les familiers, les titres et le compteur de prestige.
 * - Échec : perte de niveaux + cooldown de 8h.
 */
export function applyAscensionResult(d: PlayerState, res: AscensionResult): void {
  if (res.won) {
    const keptFamiliars = d.familiars ?? {};
    const keptTitles = d.unlockedTitles ?? [];
    const newPrestige = (d.prestigeLevel ?? 0) + 1;

    d.prestigeLevel = newPrestige;
    // Jeton de changement de classe : le prestige rebat les cartes.
    d.classChangeTokens = (d.classChangeTokens ?? 0) + 1;
    d.level = 1;
    d.xp = 0;
    d.talents = {};
    d.talentPoints = 0;
    d.equippedSkills = [];
    // Arme de départ neuve (instanciée) + soin complet.
    const startKey = mintInstanceId(starterWeapon(d.classId));
    d.equipped = { weapon: startKey, armor: null, trinket: null, tool: null, profession_armor: null };
    d.gearDurability = {};
    d.inventory = { potion: 3 };
    d.hp = CLASSES[d.classId].base.maxHp;
    d.gearStars = {};
    d.gearDurability = {};
    d.enchants = {};
    d.gold = 100;
    d.biome = 'forest';
    d.unlockedBiomes = ['forest'];
    // Toute la progression de métiers repart de zéro, comme le niveau de combat.
    d.farmXp = 0;
    d.gatherXp = { chop: 0, mine: 0, fish: 0, forage: 0 };
    d.craftXp = 0;
    d.concoctionXp = 0;
    d.familiars = keptFamiliars;      // la collection de familiers est long-terme
    d.unlockedTitles = keptTitles;
    d.ascensionCooldownUntil = 0;
    // Un titre de prestige débloqué au passage.
    const title = `Prestige ${newPrestige}`;
    if (!d.unlockedTitles.includes(title)) d.unlockedTitles.push(title);
    d.title = title;
    // migratePlayer réequipera une arme de départ neuve (instanciée).
  } else {
    d.level = Math.max(1, 50 - res.levelsLost);
    d.xp = 0;
    d.ascensionCooldownUntil = Date.now() + ASCENSION_FAIL_COOLDOWN;
  }
}
