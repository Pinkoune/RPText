import type { PlayerState } from './types';

// ─── Saisons PvP / Ladder ────────────────────────────────────────────────────
// Une saison = un mois calendaire. Les points de saison se gagnent en PvP
// (duels, Card-Jitsu) et déterminent un rang. Tout se réinitialise au changement
// de mois, calculé depuis l'horloge (aucun backend dédié).

export const SEASON_POINTS = {
  duelWin: 25,
  cjWin: 20,
};

export interface RankTier {
  name: string;
  icon: string;
  min: number;
  color: string;
}

export const TIERS: RankTier[] = [
  { name: 'Bronze', icon: '🥉', min: 0, color: '#cd7f32' },
  { name: 'Argent', icon: '🥈', min: 100, color: '#c0c0c0' },
  { name: 'Or', icon: '🥇', min: 300, color: '#ffd45a' },
  { name: 'Platine', icon: '💠', min: 600, color: '#6ee7d0' },
  { name: 'Diamant', icon: '💎', min: 1000, color: '#7ad0ff' },
  { name: 'Maître', icon: '👑', min: 1800, color: '#c084fc' },
];

/** Identifiant de la saison courante (mois calendaire). */
export function seasonId(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

/** Horodatage du début du mois suivant (fin de saison). */
export function nextSeasonAt(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
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

export function seasonRewardFor(points: number): { tierName: string; reward: SeasonReward } {
  const { tier } = tierFor(points);
  return { tierName: tier.name, reward: TIER_REWARDS[tier.name] };
}

export function tierFor(points: number): { tier: RankTier; next: RankTier | null; into: number; span: number } {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  const into = points - tier.min;
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
      p.inventory[id] = (p.inventory[id] ?? 0) + qty;
    }
  }
}

/**
 * Réinitialise les points si la saison a changé. Si le joueur avait marqué des
 * points la saison précédente, sa récompense de rang est créditée et stockée
 * dans `lastSeasonReward` (pour l'affichage). À appeler à la migration/au gain.
 */
export function ensureSeason(p: PlayerState, now = Date.now()): void {
  const sid = seasonId(now);
  if (p.seasonId && p.seasonId !== sid && (p.seasonPoints ?? 0) > 0) {
    const { tierName, reward } = seasonRewardFor(p.seasonPoints!);
    grantSeasonReward(p, reward);
    p.lastSeasonReward = { season: p.seasonId, tierName, reward };
  }
  if (p.seasonId !== sid) {
    p.seasonId = sid;
    p.seasonPoints = 0;
  }
  if (!Number.isFinite(p.seasonPoints)) p.seasonPoints = 0;
}

/** Ajoute des points de saison (garde la saison à jour). */
export function addSeasonPoints(p: PlayerState, n: number): void {
  ensureSeason(p);
  p.seasonPoints = (p.seasonPoints ?? 0) + n;
}
