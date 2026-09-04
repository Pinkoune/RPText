// ─── Rituel de Prestige (« Affronter le Mal ») ───────────────────────────────
// Commande secrète débloquée au Nv.50 (max), lançable uniquement depuis les
// Abysses. Le joueur affronte un boss unique calibré sur un loadout PARFAIT
// (talents max + meilleure arme q150/5★/runes + armure + bijou + familier).
// Victoire = prestige (reset complet + bonus permanent + insigne). Échec = perte
// de niveaux selon les PV restants du boss, + cooldown avant nouvel essai.

import type { PlayerState, ClassId } from './types';
import { deriveStats, starterWeapon } from './player';
import { getTalentsForClass, type ActiveSkillDef } from './talents';
import { CLASSES } from './classes';
import { mintInstanceId, ITEMS } from './items';
import { prestigeStacks } from './prestige';

export const ASCENSION_FAIL_COOLDOWN = 8 * 60 * 60 * 1000; // 8h après un échec

/**
 * Le Néant DRAINE : tout le sustain régénératif du joueur (vol de vie,
 * régénération, soins de compétence, boucliers, procs de set) est ramené à 35%
 * pendant le rituel. Les potions, elles, sont intactes.
 *
 * Pourquoi : le boss était calibré sur les seules STATISTIQUES d'un joueur
 * idéal, or ce combat dure des centaines de tours. Mesuré en simulation, six
 * sous-classes sur seize (Berserker, Chevalier Noir, Cryomancien, Prêtre de
 * l'Aube, Moine, Oracle) le battaient à 100% SANS aucune progression de saison,
 * simplement parce qu'elles se soignent plus vite qu'il ne frappe — pendant que
 * d'autres échouaient à 0%. Un mur qui ne trie que par archétype n'est pas un
 * mur. Gonfler ses PV aurait aggravé les deux effets : plus le combat est long,
 * plus le sustain domine. C'est donc le sustain qu'on borne.
 *
 * Les potions restent pleines exprès : elles sont en nombre limité, donc elles
 * récompensent la préparation (en fabriquer, en emporter) sans jamais dériver
 * avec la durée du combat.
 */
export const ASCENSION_SUSTAIN_MULT = 0.60;

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

// ⚠️ Vivait dans `AscensionCard.tsx`, donc les harnais de simulation ne
// pouvaient PAS s'en servir : ils mesuraient le rituel avec des ultimes à 3s de
// cooldown là où le jeu les remet à 25-35s. Toutes les mesures du Néant étaient
// donc faites sur un joueur plus fort que le vrai. Déplacé ici (logique pure)
// pour que le harness et le jeu voient exactement les mêmes règles.
//
// Le Néant est calibré au millimètre contre un joueur "idéal" classique (voir
// `computeAscensionBoss`) — les ressources d'archétype (rage/combo/grâce/mana/
// sève/ferveur/tempo/surcharge) permettent de spammer des ultimes bien plus
// souvent que le cooldown d'origine (parfois 25-35s ramené à 3s), ce qui
// fausserait complètement cet équilibrage. Le Néant "annule" ces pouvoirs pour
// ce combat uniquement : chaque compétence concernée retrouve son cooldown et
// ses chiffres d'avant l'introduction des ressources, sans `resource`.
export const NEANT_LEGACY: Record<string, Partial<ActiveSkillDef>> = {
  skill_ber_execute: { cooldownMs: 30_000, resource: undefined },
  skill_dk_drain: { cooldownMs: 25_000, resource: undefined },
  skill_rog_assassinate: { cooldownMs: 3_000, mult: 2.5, resource: undefined },
  skill_mnk_dragon: { cooldownMs: 25_000, mult: 2.0, resource: undefined },
  skill_dp_nova: { cooldownMs: 30_000, resource: undefined },
  skill_pyro_inferno: { cooldownMs: 35_000, resource: undefined },
  skill_cryo_blizzard: { cooldownMs: 25_000, resource: undefined },
  skill_arc_time: { cooldownMs: 28_000, resource: undefined },
  skill_pal_smite: { cooldownMs: 20_000, resource: undefined },
  skill_brd_crescendo: { cooldownMs: 25_000, mult: 2.3, resource: undefined },
  skill_dru_wrath: { cooldownMs: 16_000, resource: undefined },
  skill_hnt_snipe: { cooldownMs: 28_000, resource: undefined },
  // Les quatre sous-classes ajoutées après coup (Sentinelle, Nécromancien,
  // Piégeur, Oracle) avaient été OUBLIÉES ici : leur finisher restait à 3s de
  // cooldown pendant le rituel alors que les douze autres remontaient à 20-35s.
  // Mesuré : le Piégeur battait le Néant à 60% sans aucune progression de
  // saison, contre 0-1% pour ses pairs.
  skill_sent_retribution: { cooldownMs: 22_000, resource: undefined },
  skill_necro_soulwave: { cooldownMs: 25_000, resource: undefined },
  skill_trp_ambush: { cooldownMs: 25_000, resource: undefined },
  skill_orc_judgment: { cooldownMs: 20_000, resource: undefined },
};

/**
 * Cooldown de repli pour une compétence à ressource qu'on aurait oublié
 * d'inscrire dans `NEANT_LEGACY`. C'est exactement ce qui s'est produit avec
 * les quatre dernières sous-classes. Désormais toute compétence portant une
 * `resource` est neutralisée, listée ou non : une classe future ne peut plus
 * passer au travers en gardant son ultime à 3s.
 */
const NEANT_DEFAULT_CD = 25_000;
export function neutralizeForNeant(skill: ActiveSkillDef): ActiveSkillDef {
  const override = NEANT_LEGACY[skill.id];
  if (override) return { ...skill, ...override };
  if (skill.resource) return { ...skill, cooldownMs: Math.max(skill.cooldownMs, NEANT_DEFAULT_CD), resource: undefined };
  return skill;
}

/**
 * Meilleur équipement atteignable, DÉRIVÉ du registre d'objets.
 *
 * C'était une table écrite en dur (`warrior: 'lava_blade', …`) figée sur le
 * palier volcanique niv.30-32. Le palier Nécropole (niv.34-36) est sorti sans
 * qu'on y touche, puis les paliers Abysse (40) et Primordial (46) : le « joueur
 * idéal » sur lequel se calibre le boss se battait donc avec une arme trois
 * paliers en retard, et le mur de fin de partie s'effondrait un peu plus à
 * chaque ajout de contenu. En le dérivant, tout nouvel objet met le boss à jour
 * tout seul.
 */
function bestGear(slot: 'weapon' | 'armor' | 'trinket', base: ClassId): string | null {
  let best: { id: string; score: number } | null = null;
  for (const it of Object.values(ITEMS)) {
    if (it.slot !== slot) continue;
    if (it.classes?.length && !it.classes.includes(base)) continue;
    // Score homogène avec le harness d'équilibrage : l'ATK prime sur l'arme, la
    // survie sur l'armure, et le bijou mélange les trois.
    const score = slot === 'weapon'
      ? (it.atk ?? 0) * 3 + (it.hp ?? 0) * 0.2
      : (it.atk ?? 0) * 3 + (it.def ?? 0) * 2 + (it.hp ?? 0);
    if (!best || score > best.score) best = { id: it.id, score };
  }
  return best?.id ?? null;
}

/**
 * Stats du boss, calibrées sur un joueur PARFAITEMENT optimisé de la classe du
 * joueur. On fabrique un faux joueur idéal et on lit `deriveStats` → le boss
 * suit exactement la puissance atteignable au max.
 */
export function computeAscensionBoss(p: PlayerState): AscensionBoss {
  const base = (CLASSES[p.classId]?.parent ?? p.classId) as ClassId;
  const weapon = bestGear('weapon', base) ?? 'lava_blade';
  const armor = bestGear('armor', base) ?? 'void_mantle';
  const trinket = bestGear('trinket', base) ?? 'primordial_crown';

  const fake: PlayerState = structuredClone(p);
  fake.level = 50;
  // Tous les talents de la classe au rang max.
  fake.talents = {};
  for (const t of getTalentsForClass(p.classId)) fake.talents[t.id] = t.maxRank;

  // Meilleur équipement : arme (q150 = +50% stats), armure, bijou — tous 5★ + runes.
  const wKey = mintInstanceId(`${weapon}:q150`);
  const aKey = mintInstanceId(`${armor}:q150`);
  const tKey = mintInstanceId(`${trinket}:q150`);
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
  // Coefficient de dégâts relevé de 1/6 à 1/4.6 sur les PV idéaux (+30%).
  // Balayé en simulation (`SWEEP=1` sur `balance-sim-turns.ts`) sur les 16
  // sous-classes × trois profils de progression. À l'ancienne valeur, la
  // médiane des classes gagnait à 71% SANS aucune progression de saison ; à
  // celle-ci, elle tombe à 3% sans saison, 66% avec artefact + Relique ★5, et
  // 86-100% une fois tout maxé. C'est le contrat de la feature : infranchissable
  // sans équipement à jour, franchissable par TOUTES les classes avec.
  const atk = Math.round(s.maxHp / 4.6 + s.def * 0.78);
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
