import type { PlayerState } from './types';
import { addItemToInventory } from './items';

// ─── Récompense de connexion journalière ─────────────────────────────────────
// Cycle de 7 jours. La série (streak) monte d'un cran chaque jour consécutif,
// et retombe à 1 si un jour est manqué. Déterministe et purement local : aucune
// dépendance backend.

export interface DailyReward {
  /** Position dans le cycle 1..7. */
  day: number;
  /** Série totale de jours consécutifs. */
  streak: number;
  gold: number;
  gems?: number;
  fateCoins?: number;
  item?: { id: string; qty: number };
  label: string;
}

/** 7 récompenses du cycle (le 7e jour est le plus généreux). */
export const DAILY_CYCLE: Omit<DailyReward, 'day' | 'streak'>[] = [
  { gold: 100, label: '100 or' },
  { gold: 150, label: '150 or' },
  { gold: 0, item: { id: 'lootbox', qty: 1 }, label: '1 Lootbox 🎁' },
  { gold: 250, label: '250 or' },
  { gold: 0, fateCoins: 5, label: '5 Fate Coins 🎲' },
  { gold: 300, label: '300 or' },
  { gold: 500, gems: 1, label: '500 or + 1 gemme 💎' },
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function canClaimDailyLogin(p: PlayerState, now = Date.now()): boolean {
  return p.lastLoginDay !== dayKey(new Date(now));
}

/**
 * À appeler une fois au chargement. Si c'est un nouveau jour, incrémente la
 * série (ou la reset), crédite la récompense et la retourne (pour l'afficher).
 * Retourne null si la récompense du jour a déjà été prise.
 */
export function claimDailyLogin(p: PlayerState, now = Date.now()): DailyReward | null {
  const today = dayKey(new Date(now));
  if (p.lastLoginDay === today) return null;

  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = dayKey(yd);

  p.loginStreak = p.lastLoginDay === yesterday ? (p.loginStreak ?? 0) + 1 : 1;
  p.lastLoginDay = today;

  const idx = (p.loginStreak - 1) % DAILY_CYCLE.length;
  const r = DAILY_CYCLE[idx];
  p.gold += r.gold;
  if (r.gems) p.gems += r.gems;
  if (r.fateCoins) p.fateCoins += r.fateCoins;
  if (r.item) addItemToInventory(p.inventory, r.item.id, r.item.qty);

  return { day: idx + 1, streak: p.loginStreak, ...r };
}
