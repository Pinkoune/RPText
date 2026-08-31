import type { PlayerState } from './types';
import { item } from './items';
import { addItem, applyBonuses, grantXp } from './player';

// ─── Camp — accumulation hors-ligne ──────────────────────────────────────────
// La seule mécanique d'accumulation hors-ligne du jeu était l'expédition de
// familier… verrouillée au Nv.35, très au-delà de l'endroit où les joueurs
// décrochent. Le camp descend l'idée au Nv.5 et la rend automatique : il
// produit tout seul pendant l'absence, et il suffit de revenir pour récolter.
//
// Volontairement calé sur une journée de cours : le plafond de 12h fait qu'on
// récolte le midi et le soir sans jamais être puni d'avoir dormi.

export const CAMP_MIN_LEVEL = 5;
export const CAMP_MAX_MS = 12 * 60 * 60 * 1000;
/** En dessous, ça ne vaut pas le clic — on affiche « rien à récolter ». */
const CAMP_MIN_MS = 15 * 60 * 1000;

/** Ressource représentative de chaque biome (comme l'expédition). */
const BIOME_RES: Record<string, string> = {
  forest: 'dryad_leaf', plains: 'wildflower', mountains: 'iron_ore',
  desert: 'sun_shard', swamp: 'bog_root', volcano: 'lava_crystal',
  crypt: 'crypt_shard', frozen: 'crystal',
};

export interface CampYield {
  /** Durée effectivement productive (ms, plafonnée). */
  elapsedMs: number;
  gold: number;
  xp: number;
  resourceId: string;
  resourceQty: number;
}

/** Temps productif accumulé depuis la dernière récolte (plafonné). */
export function campElapsed(p: PlayerState, now = Date.now()): number {
  const since = p.campCollectedAt ?? p.createdAt ?? now;
  return Math.max(0, Math.min(CAMP_MAX_MS, now - since));
}

export function campReady(p: PlayerState, now = Date.now()): boolean {
  return p.level >= CAMP_MIN_LEVEL && campElapsed(p, now) >= CAMP_MIN_MS;
}

/** Ce que le camp a produit, sans rien appliquer (sert aussi à l'affichage). */
export function previewCamp(p: PlayerState, now = Date.now()): CampYield {
  const elapsedMs = campElapsed(p, now);
  const hours = elapsedMs / 3_600_000;
  // Volontairement moins rentable qu'une session active : le camp comble
  // l'absence, il ne remplace pas le fait de jouer.
  const base = {
    gold: Math.floor(p.level * 8 * hours),
    xp: Math.floor(p.level * 5 * hours),
  };
  const bonused = applyBonuses(p, base);
  return {
    elapsedMs,
    gold: bonused.gold,
    xp: bonused.xp,
    resourceId: BIOME_RES[p.biome] ?? 'herb',
    resourceQty: Math.floor(hours / 3),
  };
}

/**
 * Récolte le camp (mutation). Retourne ce qui a été gagné, ou null s'il n'y
 * avait pas encore de quoi récolter.
 */
export function collectCamp(p: PlayerState, now = Date.now()): CampYield | null {
  if (!campReady(p, now)) return null;
  const y = previewCamp(p, now);
  p.gold += y.gold;
  // Passe par grantXp : le camp fait donc aussi monter l'artefact de saison,
  // comme toute autre source d'XP.
  if (y.xp > 0) grantXp(p, y.xp);
  if (y.resourceQty > 0) addItem(p, y.resourceId, y.resourceQty);
  p.campCollectedAt = now;
  return y;
}

/** Libellé court du contenu du camp, pour les toasts et l'écran de retour. */
export function campSummary(y: CampYield): string {
  const parts: string[] = [];
  if (y.gold > 0) parts.push(`+${y.gold} 🪙`);
  if (y.xp > 0) parts.push(`+${y.xp} XP`);
  if (y.resourceQty > 0) parts.push(`+${y.resourceQty} ${item(y.resourceId)?.name ?? y.resourceId}`);
  return parts.join(', ') || 'rien';
}
