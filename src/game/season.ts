import type { PlayerState } from './types';
import { addItemToInventory } from './items';
import { getCurrentSeason } from './artifact';

// ─── Saisons ─────────────────────────────────────────────────────────────────
//
// Il y avait DEUX systèmes appelés « saison », qui ne se parlaient pas : celui
// d'ici (ladder PvP, mois calendaire, rotation automatique) et celui de
// l'artefact (numéro dans `system/season`, thème été/automne/hiver/printemps,
// rotation déclenchée par l'admin). Deux compteurs, deux dates, deux resets —
// d'où l'impression qu'une saison « ne se sentait pas ».
//
// Il n'y en a plus qu'une : la Saison N de l'artefact fait autorité, et le
// ladder PvP suit. Une rotation remet donc au même instant l'artefact, les
// points PvP, les classements d'Abysses et la passe — c'est ce qui lui donne
// enfin du poids.

/**
 * XP D'ARTEFACT accordée par une victoire PvP, en multiple du niveau du joueur.
 *
 * Le PvP alimentait un compteur `seasonPoints` séparé, alors que TOUT le reste
 * du jeu alimentait l'artefact : deux jauges de saison qui ne se parlaient pas,
 * et une saison qui ne récompensait qu'une seule activité. Le PvP verse
 * désormais dans la même jauge que la chasse, la récolte ou la forge.
 *
 * Calibré à quelques kills de chasse : le PvP est plus lent et plus risqué,
 * mais il ne doit pas devenir la voie rapide non plus.
 */
export const PVP_ARTIFACT_XP = {
  duelWin: 40,
  cjWin: 30,
};

export interface RankTier {
  name: string;
  icon: string;
  min: number;
  color: string;
}

/**
 * Rangs de saison, indexés sur le NIVEAU D'ARTEFACT.
 *
 * Les seuils étaient exprimés en points de saison PvP (0/100/300/600/1000/1800).
 * Ils suivent maintenant l'artefact, donc l'ensemble des activités, et sont
 * calés sur les paliers de la passe pour que les deux progressent de concert.
 */
export const TIERS: RankTier[] = [
  { name: 'Bronze', icon: '🥉', min: 0, color: '#cd7f32' },
  { name: 'Argent', icon: '🥈', min: 8, color: '#c0c0c0' },
  { name: 'Or', icon: '🥇', min: 20, color: '#ffd45a' },
  { name: 'Platine', icon: '💠', min: 35, color: '#6ee7d0' },
  { name: 'Diamant', icon: '💎', min: 55, color: '#7ad0ff' },
  { name: 'Maître', icon: '👑', min: 85, color: '#c084fc' },
];

/** Niveau d'artefact du joueur = sa progression de saison. */
export function seasonProgress(p: PlayerState): number {
  return p.artifact?.level ?? 0;
}

/**
 * Identifiant de la saison courante — le numéro de saison de l'artefact.
 *
 * Le paramètre `now` est conservé pour ne rien casser chez les appelants, mais
 * il n'est plus utilisé : une saison ne se termine plus toute seule à minuit le
 * 1er du mois, elle se termine quand l'admin la fait tourner.
 */
export function seasonId(_now = Date.now()): string {
  return `s${getCurrentSeason()}`;
}

export interface SeasonReward {
  gold: number;
  fateCoins: number;
  gems?: number;
  /** id objet -> quantité. */
  items?: Record<string, number>;
}

/** Récompense de fin de saison selon le rang atteint (le plus haut palier franchi). */
export const TIER_REWARDS: Record<string, SeasonReward> = {
  Bronze: { gold: 500, fateCoins: 5 },
  Argent: { gold: 1200, fateCoins: 10, items: { repair_kit: 2 } },
  Or: { gold: 2500, fateCoins: 18, items: { repair_kit: 3, dungeon_key: 1 } },
  Platine: { gold: 4000, fateCoins: 28, gems: 1, items: { upgrade_matrix: 1, dungeon_key: 2 } },
  Diamant: { gold: 7000, fateCoins: 45, gems: 3, items: { upgrade_matrix: 2, dungeon_key: 3 } },
  Maître: { gold: 14000, fateCoins: 70, gems: 6, items: { upgrade_matrix: 4, dungeon_key: 5 } },
};

export function seasonRewardFor(artifactLevel: number): { tierName: string; reward: SeasonReward } {
  const { tier } = tierFor(artifactLevel);
  return { tierName: tier.name, reward: TIER_REWARDS[tier.name] };
}

export function tierFor(artifactLevel: number): { tier: RankTier; next: RankTier | null; into: number; span: number } {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (artifactLevel >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  const into = artifactLevel - tier.min;
  const span = next ? next.min - tier.min : 1;
  return { tier, next, into, span };
}

/** Crédite une récompense de saison au joueur (mutation directe). */
export function grantSeasonReward(p: PlayerState, reward: SeasonReward): void {
  p.gold += reward.gold;
  p.fateCoins += reward.fateCoins;
  if (reward.gems) p.gems += reward.gems;
  if (reward.items) {
    for (const [id, qty] of Object.entries(reward.items)) {
      addItemToInventory(p.inventory, id, qty);
    }
  }
}

/**
 * Met à jour l'identifiant de saison du joueur.
 *
 * La récompense de fin de saison n'est PLUS calculée ici : le rang dépend
 * désormais du niveau d'artefact, et `rotateSeason` (artifact.ts) est le seul
 * endroit qui connaisse encore ce niveau avant de le remettre à zéro. C'est
 * donc `migratePlayer` qui crédite, à partir de l'archive que la rotation rend.
 */
export function ensureSeason(p: PlayerState, now = Date.now()): void {
  const sid = seasonId(now);
  if (p.seasonId !== sid) p.seasonId = sid;
}

/** Crédite la récompense de rang d'une saison écoulée (appelé après rotation). */
export function grantEndOfSeason(p: PlayerState, season: string, artifactLevel: number): void {
  if (artifactLevel <= 0) return;
  const { tierName, reward } = seasonRewardFor(artifactLevel);
  grantSeasonReward(p, reward);
  p.lastSeasonReward = { season, tierName, reward };
}
