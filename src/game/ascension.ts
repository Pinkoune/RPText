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
import { prestigeStacks } from './prestige';

export const ASCENSION_FAIL_COOLDOWN = 8 * 60 * 60 * 1000; // 8h après un échec

// Les constantes et multiplicateurs de prestige vivent désormais dans
// `prestige.ts` (module sans dépendance, donc lisible aussi par l'interface).
// Ré-exportés ici pour ne rien casser chez les appelants existants.
export {
  PRESTIGE_BONUS_PER_LEVEL,
  PRESTIGE_XPGOLD_PER_LEVEL,
  MAX_PRESTIGE_STACK,
  prestigeStatMult,
  prestigeXpGoldMult,
} from './prestige';

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
  // Le boss compte la MOITIÉ du prestige du joueur.
  //
  // À 0 (l'ancien comportement), les bonus de renaissance ne rencontraient
  // aucune résistance : mesuré en simulation, un archer passait de 0% à 97% de
  // victoire entre prestige 0 et 5 sans rien changer à son jeu — le mur de fin
  // de partie cessait d'en être un pour ceux qui y revenaient.
  // À plein, l'inverse : le boss annulerait exactement le gain, et enchaîner
  // les renaissances ne se sentirait plus du tout.
  // La moitié garde le mur debout à tous les niveaux tout en laissant chaque
  // prestige valoir quelque chose (~+4% net par renaissance).
  // Valeur fractionnaire assumée : `deriveStats` multiplie simplement.
  fake.prestigeLevel = prestigeStacks(p.prestigeLevel ?? 0) / 2;

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
    return { won: true, message: 'Tu terrasses le Néant Originel. Le monde respire — et tu es toujours debout.' };
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
 *
 * - Victoire : TRIOMPHE, sans aucune perte. On crédite la victoire, le titre et
 *   l'accès à la Renaissance — mais on ne touche NI au niveau, NI à l'équipement,
 *   NI aux métiers. Auparavant la victoire déclenchait un wipe complet : vaincre
 *   le boss ultime et se réveiller nu au Nv.1 dans la forêt de départ était une
 *   gifle au moment exact du triomphe. Le reset existe toujours, mais il est
 *   devenu un choix explicite du joueur (voir `applyRebirth`).
 * - Échec : perte de niveaux + cooldown de 8h (inchangé).
 */
export function applyAscensionResult(d: PlayerState, res: AscensionResult): void {
  if (res.won) {
    d.neantVictories = (d.neantVictories ?? 0) + 1;
    d.rebirthAvailable = true;
    d.ascensionCooldownUntil = 0;
    if (!d.unlockedTitles) d.unlockedTitles = [];
    const title = 'Vainqueur du Néant';
    if (!d.unlockedTitles.includes(title)) d.unlockedTitles.push(title);
    d.title = title;
  } else {
    d.level = Math.max(1, 50 - res.levelsLost);
    d.xp = 0;
    d.ascensionCooldownUntil = Date.now() + ASCENSION_FAIL_COOLDOWN;
  }
}

/**
 * RENAISSANCE (ex-prestige automatique) — désormais déclenchée uniquement si le
 * joueur la demande, après avoir vaincu le Néant. Remet la progression à zéro en
 * échange d'un niveau de prestige et de ses bonus permanents. On conserve
 * l'identité, les familiers, les titres et le compteur de prestige.
 */
export function applyRebirth(d: PlayerState): void {
  const keptFamiliars = d.familiars ?? {};
  const keptTitles = d.unlockedTitles ?? [];
  const newPrestige = (d.prestigeLevel ?? 0) + 1;

  // Retour à la classe de BASE. Sans ça, un Berserker renaissait « Berserker
  // niveau 1 » — un état impossible : l'ascension exige le Nv.20. Le garde-fou
  // de `migratePlayer` le corrigeait bien, mais seulement au chargement SUIVANT,
  // donc le joueur se retrouvait Guerrier du jour au lendemain, arbre remis à
  // zéro, sans la moindre explication. On le fait ici, franchement : on repart
  // de sa famille et on ré-ascensionne au Nv.20 (c'est tout l'intérêt du jeton
  // de changement de classe accordé juste en dessous).
  d.classId = CLASSES[d.classId]?.parent ?? d.classId;

  d.prestigeLevel = newPrestige;
  // Jeton de changement de classe : la renaissance rebat les cartes.
  d.classChangeTokens = (d.classChangeTokens ?? 0) + 1;
  d.rebirthAvailable = false;
  d.level = 1;
  d.xp = 0;
  d.talents = {};
  d.talentPoints = 0;
  d.equippedSkills = [];
  // Arme de départ neuve (instanciée) + soin complet.
  const startKey = mintInstanceId(starterWeapon(d.classId));
  d.equipped = { weapon: startKey, armor: null, trinket: null, tool: null, profession_armor: null };
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
}
