import type { PlayerState, BiomeId } from './types';
import { BIOMES } from './biomes';

// ─── Maîtrise des biomes ──────────────────────────────────────────────────────
// Chaque monstre tué dans un biome compte pour la maîtrise de CE biome. Franchir
// un palier donne un titre + un petit bonus permanent d'XP/Or DANS ce biome —
// un but concret au farm end-game (les niv.40-50 = ~81% du temps de jeu, sans
// nouvelle zone). Purement additif (aucun malus), lisible, sans risque d'équilibrage
// de combat (le bonus porte sur les gains, pas sur les stats).

export interface MasteryTier {
  kills: number;
  /** Bonus d'XP/Or dans ce biome à ce palier (cumulatif = valeur du palier atteint). */
  bonus: number;
  label: string;
}

export const MASTERY_TIERS: MasteryTier[] = [
  { kills: 0, bonus: 0, label: 'Novice' },
  { kills: 100, bonus: 0.05, label: 'Familier' },
  { kills: 500, bonus: 0.10, label: 'Vétéran' },
  { kills: 1500, bonus: 0.15, label: 'Maître' },
  { kills: 4000, bonus: 0.25, label: 'Légende' },
];

export function biomeKills(p: PlayerState, biome: BiomeId): number {
  return p.biomeKills?.[biome] ?? 0;
}

/** Palier de maîtrise atteint (index 0-4) pour un biome. */
export function masteryTier(kills: number): number {
  let t = 0;
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (kills >= MASTERY_TIERS[i].kills) { t = i; break; }
  }
  return t;
}

/** Progression vers le palier suivant : { tier, next, into, need }. */
export function masteryProgress(kills: number): { tier: number; label: string; bonus: number; next: number | null; into: number; need: number } {
  const t = masteryTier(kills);
  const cur = MASTERY_TIERS[t];
  const nextT = MASTERY_TIERS[t + 1];
  return {
    tier: t,
    label: cur.label,
    bonus: cur.bonus,
    next: nextT ? nextT.kills : null,
    into: kills - cur.kills,
    need: nextT ? nextT.kills - cur.kills : 0,
  };
}

/** Multiplicateur XP/Or de maîtrise pour le biome courant (1.0 + bonus du palier). */
export function masteryMult(p: PlayerState, biome: BiomeId): number {
  return 1 + MASTERY_TIERS[masteryTier(biomeKills(p, biome))].bonus;
}

/** Incrémente le compteur de kills du biome et renvoie true si un palier vient d'être franchi. */
export function addBiomeKill(p: PlayerState, biome: BiomeId): { leveledUp: boolean; newTier: number } {
  if (!p.biomeKills) p.biomeKills = {};
  const before = masteryTier(p.biomeKills[biome] ?? 0);
  p.biomeKills[biome] = (p.biomeKills[biome] ?? 0) + 1;
  const after = masteryTier(p.biomeKills[biome]);
  return { leveledUp: after > before, newTier: after };
}

/** Titre de maîtrise débloqué (ex : « Maître de la Caldeira de Braise »). */
export function masteryTitle(biome: BiomeId, tier: number): string {
  return `${MASTERY_TIERS[tier].label} · ${BIOMES[biome]?.name ?? biome}`;
}
