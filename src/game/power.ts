// Cote de Puissance — le classement du end-game.
//
// Le classement triait sur `level`. Tant que les joueurs montent, ça marche ;
// le jour où tout le monde atteint le Nv.50 (plafond dur), il se fige et tout le
// monde est ex æquo. Pour un jeu fait pour une classe de copains, c'est le pire
// moment possible pour arrêter de bouger.
//
// La Puissance additionne tous les axes de progression du jeu dans une seule
// unité : **1 point ≈ un niveau de personnage d'effort**. En début de partie le
// niveau domine (les autres axes sont à zéro), donc le classement ressemble à
// celui d'aujourd'hui ; à 50, ce sont les autres axes qui départagent. Un seul
// ladder, qui ne se fige jamais et ne demande aucun onglet supplémentaire.
//
// Règle de conception importante : **une renaissance ne doit pas faire chuter au
// fond du classement**, sinon le prestige devient une punition sociale. D'où le
// poids de 50 par prestige : refaire le jeu en entier, c'est exactement ce que
// vaut le trajet 1→50 qu'on abandonne.

import type { PlayerState } from './types';
import { BIOME_LIST } from './biomes';
import { biomeKills, masteryTier, MASTERY_TIERS } from './mastery';

/** Poids de chaque axe, en « niveaux de personnage » équivalents. */
export const POWER_WEIGHTS = {
  /** Le niveau lui-même. */
  level: 1,
  /** Une renaissance = refaire tout le trajet 1→50. */
  prestige: 50,
  /** L'artefact monte sur la même XP que le personnage : parité naturelle. */
  artifact: 1,
  /** Étoiles de l'équipement porté (5 emplacements × 5 étoiles au plus). */
  star: 1,
  /** Palier de maîtrise, par biome (0-4 sur 8 biomes). */
  mastery: 1,
  /** Meilleur étage d'Abysses — deux étages valent un point. */
  endless: 0.5,
} as const;

export interface PowerBreakdown {
  level: number;
  prestige: number;
  artifact: number;
  stars: number;
  mastery: number;
  endless: number;
  total: number;
}

/** Somme des étoiles de l'équipement PORTÉ (pas du sac : c'est la puissance actuelle). */
export function equippedStars(p: PlayerState): number {
  const stars = p.gearStars ?? {};
  let n = 0;
  for (const key of Object.values(p.equipped ?? {})) {
    if (key) n += stars[key] ?? 0;
  }
  return n;
}

/** Somme des paliers de maîtrise atteints, tous biomes confondus. */
export function masterySum(p: PlayerState): number {
  let n = 0;
  for (const b of BIOME_LIST) n += masteryTier(biomeKills(p, b.id));
  return n;
}

/** Total maximum théorique de maîtrise, pour afficher « x / max ». */
export const MASTERY_MAX = BIOME_LIST.length * (MASTERY_TIERS.length - 1);

/** Cote de Puissance détaillée. Fonction pure — aucune écriture sur le joueur. */
export function powerScore(p: PlayerState): PowerBreakdown {
  const w = POWER_WEIGHTS;
  const level = Math.max(0, p.level ?? 0) * w.level;
  // Le prestige n'est PAS plafonné ici, contrairement à ses bonus de stats :
  // un 6e prestige ne rend pas plus fort, mais il reste une performance et doit
  // continuer de compter au classement.
  const prestige = Math.max(0, p.prestigeLevel ?? 0) * w.prestige;
  const artifact = Math.max(0, p.artifact?.level ?? 0) * w.artifact;
  const stars = equippedStars(p) * w.star;
  const mastery = masterySum(p) * w.mastery;
  const endless = Math.max(0, p.endlessBest ?? 0) * w.endless;
  const total = Math.round(level + prestige + artifact + stars + mastery + endless);
  return { level, prestige, artifact, stars, mastery, endless, total };
}

/**
 * Repli pour une ligne de classement écrite par un client plus ancien, qui ne
 * porte pas encore de `power`. On reconstruit ce qu'on peut depuis les champs
 * déjà présents : le joueur garde une place cohérente en attendant sa prochaine
 * connexion, au lieu de tomber en bas du tableau.
 */
export function fallbackPower(row: { level?: number; prestigeLevel?: number }): number {
  return Math.round(
    Math.max(0, row.level ?? 0) * POWER_WEIGHTS.level
    + Math.max(0, row.prestigeLevel ?? 0) * POWER_WEIGHTS.prestige,
  );
}
