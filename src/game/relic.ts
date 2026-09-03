// ─── La Relique ──────────────────────────────────────────────────────────────
//
// L'axe de progression PERMANENT du jeu. C'est la réponse à deux constats :
//
//  1. À Nv.50 tout est plafonné — niveau (50), étoiles (5★), prestige (bonus
//     plafonnés à 5), maîtrises (4000 kills × 8 biomes). Seul l'artefact était
//     censé être infini, mais sa grille se remplit en ~77% du trajet 1→50 et sa
//     courbe s'aplatit ensuite au point d'être morte (Nv.62→100 = une fois et
//     demie le jeu entier pour +6 points de %).
//  2. Un joueur qui renaît résume le prestige à « le stuff qui est reset, ça
//     fait mal ». Il lui manque une chose à lui, qui traverse les remises à zéro.
//
// La Relique traverse TOUT : la renaissance ET la rotation de saison. C'est
// délibérément la seule chose du jeu dans ce cas.
//
// Pourquoi elle n'occupe pas d'emplacement d'équipement, alors que l'idée de
// départ était « une armure spéciale » : une pièce portée serait détruite par
// `applyRebirth` (qui vide l'équipement), entrerait en concurrence directe avec
// le stuff qu'on farme chaque saison, et obligerait à la rendre meilleure que
// `void_mantle` pour être portée — donc à réequilibrer tout le end-game. En
// entité autonome, comme l'artefact, elle cumule sans rien casser.

import type { PlayerState } from './types';
import type { CombatMods } from './talents';

/** Étoiles obtenues « à l'ancienne » : elles donnent des statistiques. */
export const RELIC_STAT_STARS = 5;
/** Au-delà, chaque étoile donne un EFFET au choix, jamais des stats brutes. */
export const RELIC_MAX_STARS = 10;

/**
 * Gain de stats par étoile sur les cinq premières.
 *
 * Volontairement modeste (+2%/étoile, soit +10% à ★5). Le plan initial parlait
 * de +10% par étoile, mais il supposait une pièce d'équipement qui en
 * REMPLACE une autre — le gain net aurait été nul. En entité autonome, ces
 * pourcentages s'ajoutent à l'artefact (+30% grille pleine) et au prestige
 * (+40% au plafond) : à +10%/étoile la Relique seule aurait valu +50% et fait
 * exploser un équilibrage simulé sans elle.
 */
export const RELIC_STAT_PER_STAR = 0.02;

export interface RelicState {
  stars: number;
  /** Ids des effets choisis aux étoiles 6 à 10 (un par étoile). */
  effects: string[];
}

export function freshRelic(): RelicState {
  return { stars: 0, effects: [] };
}

export function getRelic(p: PlayerState): RelicState {
  if (!p.relic) p.relic = freshRelic();
  return p.relic;
}

// ─── Coût en Éclats ──────────────────────────────────────────────────────────
//
// Calibré sur les sources réellement disponibles (voir `RELIC_SHARD_SOURCES`) :
// les succès portent l'essentiel du parcours, la passe de saison entretient le
// rythme d'une saison à l'autre, et la queue de l'artefact fait la traîne
// longue. Un total de 100 met ★10 hors de portée d'une seule saison sans le
// rendre inatteignable.
export const RELIC_STAR_COST = [8, 14, 20, 26, 32];

/** Éclats nécessaires pour passer de `stars` à `stars + 1` (0 si déjà au max). */
export function relicStarCost(stars: number): number {
  if (stars >= RELIC_MAX_STARS) return 0;
  if (stars < RELIC_STAT_STARS) return RELIC_STAR_COST[0] ?? 8;
  return RELIC_STAR_COST[stars - RELIC_STAT_STARS] ?? 32;
}

/** Récapitulatif honnête des sources, pour l'affichage. */
export const RELIC_SHARD_SOURCES = [
  { icon: '🏆', label: 'Chaque succès accompli', value: '+3' },
  { icon: '🎟️', label: 'Paliers de la passe de saison', value: '+2 à +6' },
  { icon: '🔮', label: 'Niveau d\'artefact au-delà de la grille', value: '+1' },
] as const;

/** Éclats donnés par un succès réclamé. */
export const SHARDS_PER_ACHIEVEMENT = 3;

// ─── Paliers visuels ─────────────────────────────────────────────────────────
// « Qui évolue » : le nom, l'icône et la couleur changent, c'est ce qu'on montre
// aux copains. Trois paliers seulement — un changement à chaque étoile diluerait
// complètement l'effet.
export interface RelicTier {
  minStars: number;
  name: string;
  icon: string;
  color: string;
}

export const RELIC_TIERS: RelicTier[] = [
  { minStars: 0,  name: 'Éclat sans nom',      icon: '🪨', color: '#8b98ad' },
  { minStars: 3,  name: 'Fragment éveillé',    icon: '💠', color: '#6ee7d0' },
  { minStars: 6,  name: 'Relique ascendante',  icon: '🔷', color: '#8cb4ff' },
  { minStars: 8,  name: 'Relique souveraine',  icon: '👁️', color: '#b088ff' },
  { minStars: 10, name: 'Relique primordiale', icon: '🌌', color: '#f0b543' },
];

export function relicTier(stars: number): RelicTier {
  let t = RELIC_TIERS[0];
  for (const r of RELIC_TIERS) if (stars >= r.minStars) t = r;
  return t;
}

// ─── Effets des étoiles 6 à 10 ───────────────────────────────────────────────
//
// Trois choix par palier, exclusifs. C'est ce qui fait que deux Reliques ★10
// ne jouent pas pareil — l'intérêt tient à l'identité de build, pas à un
// pourcentage de plus.
export interface RelicEffectDef {
  id: string;
  /** Étoile à laquelle ce choix est proposé (6..10). */
  star: number;
  name: string;
  icon: string;
  desc: string;
  mods: Partial<CombatMods>;
}

export const RELIC_EFFECTS: RelicEffectDef[] = [
  // ★6 — comment tu frappes
  { id: 'r6_crit',  star: 6, name: 'Œil affûté',    icon: '🎯', desc: '+8% de chance de critique.',        mods: { crit: 0.08 } },
  { id: 'r6_pen',   star: 6, name: 'Fendoir',       icon: '🗡️', desc: '+12% de pénétration d\'armure.',    mods: { armorPen: 0.12 } },
  { id: 'r6_double',star: 6, name: 'Second souffle',icon: '🌀', desc: '+10% de chance de frapper deux fois.', mods: { doubleHit: 0.10 } },
  // ★7 — comment tu encaisses
  { id: 'r7_armor', star: 7, name: 'Carapace',      icon: '🛡️', desc: '-8% de dégâts subis.',              mods: { dmgReduction: 0.08 } },
  { id: 'r7_dodge', star: 7, name: 'Ombre fuyante', icon: '💨', desc: '+8% d\'esquive.',                   mods: { dodge: 0.08 } },
  { id: 'r7_thorns',star: 7, name: 'Ronces',        icon: '🌵', desc: 'Renvoie 20% des dégâts encaissés.', mods: { thorns: 0.20 } },
  // ★8 — comment tu tiens dans la durée
  { id: 'r8_steal', star: 8, name: 'Soif',          icon: '🩸', desc: '+8% de vol de vie.',                mods: { lifesteal: 0.08 } },
  { id: 'r8_regen', star: 8, name: 'Sève ancienne', icon: '💚', desc: '+8 points de régénération par tour.', mods: { regen: 8 } },
  { id: 'r8_wind',  star: 8, name: 'Sursis',        icon: '🕊️', desc: 'Survis une fois par combat à un coup fatal.', mods: { secondWind: 1 } },
  // ★9 — ta spécialité
  { id: 'r9_status',star: 9, name: 'Propagation',   icon: '☣️', desc: 'Brûlures et poisons rongent 40% plus fort.', mods: { statusPow: 0.40 } },
  { id: 'r9_rift',  star: 9, name: 'Écho de Faille',icon: '⚡', desc: 'La Faille amplifie encore +0,4 les dégâts.', mods: { riftBonus: 0.40 } },
  { id: 'r9_exec',  star: 9, name: 'Mise à mort',   icon: '☠️', desc: '+25% de dégâts sous 20% de PV ennemis.', mods: { execute: 0.25 } },
  // ★10 — l'accomplissement
  { id: 'r10_atk',  star: 10, name: 'Colère du monde', icon: '🔥', desc: '+10% d\'ATK.',            mods: { atkPct: 0.10 } },
  { id: 'r10_hp',   star: 10, name: 'Racines du monde',icon: '🌳', desc: '+12% de PV max.',         mods: { hpPct: 0.12 } },
  { id: 'r10_crit', star: 10, name: 'Jugement',        icon: '💥', desc: '+0,5 au multiplicateur de critique.', mods: { critMult: 0.5 } },
];

/** Les trois choix proposés à une étoile donnée. */
export function effectsForStar(star: number): RelicEffectDef[] {
  return RELIC_EFFECTS.filter((e) => e.star === star);
}

export function relicEffect(id: string): RelicEffectDef | undefined {
  return RELIC_EFFECTS.find((e) => e.id === id);
}

/** Multiplicateur de statistiques de la Relique (étoiles 1 à 5 uniquement). */
export function relicStatMult(p: PlayerState): number {
  const stars = Math.min(p.relic?.stars ?? 0, RELIC_STAT_STARS);
  return 1 + stars * RELIC_STAT_PER_STAR;
}

/** Verse les effets choisis dans les mods de combat (appelé par `talentMods`). */
export function applyRelicMods(p: PlayerState, mods: CombatMods): void {
  for (const id of p.relic?.effects ?? []) {
    const def = relicEffect(id);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.mods) as [keyof CombatMods, number][]) {
      mods[k] = (mods[k] ?? 0) + v;
    }
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Grave une étoile de plus. Renvoie `true`, ou un message d'erreur.
 * Aux étoiles 6+, `effectId` est obligatoire et doit appartenir au palier visé.
 */
export function upgradeRelic(p: PlayerState, effectId?: string): true | string {
  const r = getRelic(p);
  if (r.stars >= RELIC_MAX_STARS) return 'Ta Relique est déjà primordiale.';
  const cost = relicStarCost(r.stars);
  if ((p.relicShards ?? 0) < cost) return `Il te faut ${cost} Éclats (tu en as ${p.relicShards ?? 0}).`;

  const nextStar = r.stars + 1;
  if (nextStar > RELIC_STAT_STARS) {
    const choices = effectsForStar(nextStar);
    if (!effectId) return 'Choisis un effet.';
    if (!choices.some((c) => c.id === effectId)) return 'Cet effet n\'appartient pas à ce palier.';
    r.effects.push(effectId);
  }
  p.relicShards = (p.relicShards ?? 0) - cost;
  r.stars = nextStar;
  return true;
}

/** Ajoute des Éclats (source quelconque). */
export function grantShards(p: PlayerState, n: number): void {
  if (!Number.isFinite(n) || n <= 0) return;
  p.relicShards = (p.relicShards ?? 0) + Math.floor(n);
}
