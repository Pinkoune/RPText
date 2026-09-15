import type { ItemDef } from './types';
// ⚠️ Import de TYPE uniquement : `talents.ts` importe `applyRuneMods` d'ici à
// l'exécution. Un `import` normal créerait le cycle runes → talents → runes ;
// un `import type` est effacé à la compilation, donc il n'existe pas au runtime.
import type { CombatMods } from './talents';
import type { PlayerState } from './types';

export type RuneSlot = 'weapon' | 'armor' | 'trinket';

/**
 * Registre des runes.
 *
 * Refonte complète de l'ancien système, qui tenait en six objets `+5%/+10%
 * ATK/DEF/PV` — et surtout, qui n'avait **aucune source dans le jeu** : les six
 * ids n'apparaissaient que dans leur définition, dans le code qui les lisait, et
 * dans le joueur idéal sur lequel se calibre le boss du Rituel. Personne ne
 * pouvait en obtenir une, et pourtant le mur de fin de jeu était calé sur
 * quelqu'un qui les portait toutes.
 *
 * Trois principes tiennent la refonte :
 *  1. **une rune appartient à un emplacement** (arme = offensif, armure =
 *     défensif, bijou = soutien). On ne peut donc plus empiler six fois la même
 *     statistique : le plafond brut baisse et le choix devient réel ;
 *  2. **trois rangs, fusion 3 → 1** : un doublon n'est jamais perdu ;
 *  3. **les effets branchent sur des mécaniques qui existent déjà** en combat
 *     (critique, pénétration, ronces, esquive, Faille, Sursis…) plutôt que sur
 *     un multiplicateur de stat de plus.
 */
export interface RuneDef {
  id: string;
  /** Famille : c'est elle qui fusionne (3 rangs I → 1 rang II). */
  family: string;
  name: string;
  /** Emoji de repli ; l'icône réelle vit dans `icons.ts`. */
  icon: string;
  slot: RuneSlot;
  tier: 1 | 2 | 3;
  /** Rune unique : ni gravée à la table, ni fusionnable, ni obtenue en doublon. */
  unique?: boolean;
  /** Ancien système : encore lisible sur une sauvegarde, plus jamais distribuée. */
  legacy?: boolean;
  mods: Partial<CombatMods>;
  /** Effet hors `CombatMods` — `shift` inverse le type de dégâts de l'arme. */
  special?: 'shift';
  desc: string;
}

const ROMAN = ['', 'I', 'II', 'III'] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

interface Family {
  family: string;
  slot: RuneSlot;
  /** Nom sans le rang (« Tranchant » → « Rune de Tranchant II »). */
  label: string;
  icon: string;
  key: keyof CombatMods;
  /** Valeur au rang I, II, III. */
  steps: [number, number, number];
  /** Suffixe de description, après la valeur. */
  blurb: string;
  /** Valeur affichée en brut (régénération) plutôt qu'en pourcentage. */
  flat?: boolean;
}

/**
 * ⚠️ Répartition volontaire : **aucune rune d'arme ne donne de stat brute**
 * (`atkPct`/`defPct`/`hpPct`). Les seules qui en donnent sont Rempart (armure,
 * PV) et Puissance/Égide (bijou, ATK/DEF), et elles se disputent les mêmes deux
 * emplacements. Le plafond brut d'un joueur tout équipé passe donc de
 * `+20% ATK / +10% DEF / +30% PV` (ancien système) à `+20% ATK` **ou**
 * `+20% DEF`, plus `+20% PV`, et seulement en renonçant à toute l'utilité.
 */
const FAMILIES: Family[] = [
  // ── Arme : offensif ──
  { family: 'edge', slot: 'weapon', label: 'Tranchant', icon: '🗡️', key: 'crit', steps: [0.04, 0.07, 0.10], blurb: 'de chance de coup critique.' },
  { family: 'pierce', slot: 'weapon', label: 'Perforation', icon: '🔺', key: 'armorPen', steps: [0.05, 0.09, 0.13], blurb: 'de pénétration d\'armure.' },
  { family: 'echo', slot: 'weapon', label: 'Écho', icon: '🌀', key: 'doubleHit', steps: [0.04, 0.07, 0.10], blurb: 'de chance de frapper deux fois.' },
  { family: 'blight', slot: 'weapon', label: 'Corruption', icon: '🧪', key: 'statusPow', steps: [0.15, 0.28, 0.42], blurb: 'de dégâts de brûlure et de poison.' },
  // ── Armure : défensif ──
  { family: 'ward', slot: 'armor', label: 'Garde', icon: '🛡️', key: 'dmgReduction', steps: [0.03, 0.05, 0.08], blurb: 'de dégâts subis en moins.' },
  { family: 'bulwark', slot: 'armor', label: 'Rempart', icon: '❤️', key: 'hpPct', steps: [0.04, 0.07, 0.10], blurb: 'de PV max.' },
  { family: 'briar', slot: 'armor', label: 'Ronces', icon: '🌵', key: 'thorns', steps: [0.05, 0.09, 0.13], blurb: 'des dégâts subis renvoyés à l\'attaquant.' },
  { family: 'veil', slot: 'armor', label: 'Voile', icon: '💨', key: 'dodge', steps: [0.03, 0.05, 0.08], blurb: 'de chance d\'esquiver.' },
  // ── Bijou : soutien ──
  { family: 'might', slot: 'trinket', label: 'Puissance', icon: '🔴', key: 'atkPct', steps: [0.04, 0.07, 0.10], blurb: 'd\'ATK.' },
  { family: 'aegis', slot: 'trinket', label: 'Égide', icon: '🔵', key: 'defPct', steps: [0.04, 0.07, 0.10], blurb: 'de DEF.' },
  { family: 'leech', slot: 'trinket', label: 'Sangsue', icon: '🩸', key: 'lifesteal', steps: [0.03, 0.05, 0.08], blurb: 'des dégâts infligés rendus en PV.' },
  { family: 'mend', slot: 'trinket', label: 'Guérison', icon: '💚', key: 'regen', steps: [6, 11, 17], blurb: 'PV régénérés par tour.', flat: true },
];

/** Rareté et valeur marchande par rang. */
const TIER_RARITY = { 1: 'uncommon', 2: 'rare', 3: 'epic' } as const;
const TIER_VALUE = { 1: 120, 2: 400, 3: 1200 } as const;

function buildFamilies(): RuneDef[] {
  const out: RuneDef[] = [];
  for (const f of FAMILIES) {
    for (let t = 1 as 1 | 2 | 3; t <= 3; t = (t + 1) as 1 | 2 | 3) {
      const v = f.steps[t - 1];
      out.push({
        id: `rune_${f.family}_${t}`,
        family: f.family,
        name: `Rune de ${f.label} ${ROMAN[t]}`,
        icon: f.icon,
        slot: f.slot,
        tier: t,
        mods: { [f.key]: v } as Partial<CombatMods>,
        desc: `+${f.flat ? v : pct(v)} ${f.blurb}`,
      });
    }
  }
  return out;
}

/**
 * Runes uniques — une par emplacement, rang III, hors fusion. Elles portent les
 * trois effets de `CombatMods` qu'aucune famille ne donne, et qui changent la
 * façon de jouer plutôt que le montant des chiffres.
 */
const UNIQUES: RuneDef[] = [
  {
    id: 'rune_shift', family: 'shift', name: 'Rune de Transmutation', icon: '🌗',
    slot: 'weapon', tier: 3, unique: true, mods: {}, special: 'shift',
    desc: 'Inverse le type de dégâts de ton arme (physique ↔ magique) : contourne la résistance d\'un monstre.',
  },
  {
    id: 'rune_second_wind', family: 'second_wind', name: 'Rune de Sursis', icon: '⏳',
    slot: 'armor', tier: 3, unique: true, mods: { secondWind: 1 },
    desc: 'Une fois par combat, survis à un coup qui devait te tuer (1 PV restant).',
  },
  {
    id: 'rune_rift', family: 'rift', name: 'Rune de Faille', icon: '⚡',
    slot: 'trinket', tier: 3, unique: true, mods: { riftBonus: 0.5 },
    desc: 'Frapper un monstre gelé ou étourdi fait +50% de dégâts en plus du bonus de Faille.',
  },
];

/**
 * Les six runes de l'ancien système. Gardées **fonctionnelles** parce qu'un
 * admin a pu en distribuer, mais retirées de toute source : elles ne sortent ni
 * de la table de gravure, ni de la fusion. Inutile d'écrire une migration pour
 * des objets que la boucle de jeu ne pouvait pas produire.
 */
const LEGACY: RuneDef[] = [
  { id: 'rune_atk_1', family: 'might', name: 'Rune de Puissance Mineure', icon: '🔴', slot: 'trinket', tier: 1, legacy: true, mods: { atkPct: 0.05 }, desc: '+5% ATK.' },
  { id: 'rune_atk_2', family: 'might', name: 'Rune de Puissance Majeure', icon: '🔴', slot: 'trinket', tier: 2, legacy: true, mods: { atkPct: 0.10 }, desc: '+10% ATK.' },
  { id: 'rune_def_1', family: 'aegis', name: 'Rune de Garde Mineure', icon: '🔵', slot: 'trinket', tier: 1, legacy: true, mods: { defPct: 0.05 }, desc: '+5% DEF.' },
  { id: 'rune_def_2', family: 'aegis', name: 'Rune de Garde Majeure', icon: '🔵', slot: 'trinket', tier: 2, legacy: true, mods: { defPct: 0.10 }, desc: '+10% DEF.' },
  { id: 'rune_hp_1', family: 'bulwark', name: 'Rune de Vitalité Mineure', icon: '🟢', slot: 'armor', tier: 1, legacy: true, mods: { hpPct: 0.05 }, desc: '+5% PV max.' },
  { id: 'rune_hp_2', family: 'bulwark', name: 'Rune de Vitalité Majeure', icon: '🟢', slot: 'armor', tier: 2, legacy: true, mods: { hpPct: 0.10 }, desc: '+10% PV max.' },
];

export const RUNE_LIST: RuneDef[] = [...buildFamilies(), ...UNIQUES, ...LEGACY];
export const RUNES: Record<string, RuneDef> = Object.fromEntries(RUNE_LIST.map((r) => [r.id, r]));

export function rune(id: string): RuneDef | undefined {
  return RUNES[id];
}
export function isRuneId(id: string): boolean {
  return id in RUNES;
}

/** Les runes gravables à la table, par emplacement (rang I, ni uniques ni héritées). */
export function engravable(slot: RuneSlot): RuneDef[] {
  return RUNE_LIST.filter((r) => r.slot === slot && r.tier === 1 && !r.unique && !r.legacy);
}

export const FUSE_COUNT = 3;

/** Rune obtenue en fusionnant `FUSE_COUNT` exemplaires de `id`, ou null. */
export function fusionTarget(id: string): RuneDef | null {
  const r = RUNES[id];
  if (!r || r.unique || r.legacy || r.tier >= 3) return null;
  return RUNE_LIST.find((x) => x.family === r.family && x.tier === r.tier + 1 && !x.legacy) ?? null;
}

/** Entrées d'`ITEMS` dérivées du registre — un seul endroit décrit une rune. */
export function runeItemDefs(): Record<string, ItemDef> {
  const out: Record<string, ItemDef> = {};
  for (const r of RUNE_LIST) {
    out[r.id] = {
      id: r.id,
      name: r.name,
      icon: r.icon,
      rarity: r.unique ? 'legendary' : TIER_RARITY[r.tier],
      slot: 'material',
      value: r.unique ? 800 : TIER_VALUE[r.tier],
      desc: r.desc,
    };
  }
  return out;
}

/** Runes serties sur la pièce équipée dans ce slot (ignore celles d'un autre type). */
export function runesOnSlot(p: PlayerState, slot: RuneSlot): RuneDef[] {
  const key = p.equipped?.[slot];
  if (!key || !p.enchants?.[key]) return [];
  return p.enchants[key]
    .map((id) => RUNES[id])
    .filter((r): r is RuneDef => !!r && r.slot === slot);
}

/**
 * Verse les mods des runes serties dans `CombatMods`.
 *
 * ⚠️ Appelé depuis `talentMods`, et c'est délibéré : c'est le point de passage
 * unique des modificateurs passifs (12 sites d'appel — chasse, donjon, duel,
 * abysses…). L'ancien système lisait les runes dans `deriveStats` avec une
 * chaîne de six `if` qui ne savait faire que ATK/DEF/PV, et qui échappait au
 * plafonnement de `CAPS`. Ici elles sont plafonnées comme tout le reste.
 */
export function applyRuneMods(p: PlayerState, mods: CombatMods): void {
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    for (const r of runesOnSlot(p, slot)) {
      for (const key of Object.keys(r.mods) as (keyof CombatMods)[]) {
        mods[key] += r.mods[key] ?? 0;
      }
    }
  }
}

/**
 * Meilleure sertissure atteignable — deux runes de rang III par emplacement.
 * ⚠️ Sert à `computeAscensionBoss` : le boss du Rituel se calibre sur un joueur
 * idéal, donc sur un joueur qui porte ce qu'il est RÉELLEMENT possible de
 * porter. L'ancienne table écrite en dur y mettait des runes inobtenables.
 */
export function bestRuneLoadout(): Record<RuneSlot, string[]> {
  return {
    weapon: ['rune_edge_3', 'rune_pierce_3'],
    armor: ['rune_ward_3', 'rune_bulwark_3'],
    trinket: ['rune_might_3', 'rune_leech_3'],
  };
}
