import type { PlayerState } from './types';
import { currentPhase } from './daynight';
import { addQuestMetric } from './quests';

export type Currency = 'gold' | 'fateCoins';

export interface GambleResult {
  win: boolean;
  delta: number; // variation nette de la mise (gain net ou -mise)
  detail: string;
  symbols?: string[];
  rollValue?: number;
}

/** Bonus de chance si le joueur porte un trinket "chanceux". */
function luck(p: PlayerState): number {
  if (p.equipped.trinket === 'lucky_coin') return 0.04;
  if (p.equipped.trinket === 'gambler_ring') return 0.07;
  return 0;
}

function canBet(p: PlayerState, cur: Currency, bet: number): boolean {
  return bet > 0 && p[cur] >= bet;
}

function settle(p: PlayerState, cur: Currency, delta: number) {
  p[cur] += delta;
  if (p.statistics) {
    p.statistics.gamblesPlayed += 1;
    if (delta > 0) p.statistics.gamblesWon += 1;
    if (cur === 'gold' && delta > 0) p.statistics.goldEarned += delta;
  }
  if (cur === 'gold') p.gambleNet += delta;
  if (delta > 0) addQuestMetric(p, 'gambleWins', 1);
}

/** Pile ou face : x2 sur victoire. */
export function coinflip(p: PlayerState, cur: Currency, bet: number, pick: 'heads' | 'tails'): GambleResult {
  if (!canBet(p, cur, bet)) return { win: false, delta: 0, detail: 'Mise invalide.' };
  // Le casino a l'avantage (45% de base)
  const flip = Math.random() < 0.45 + luck(p) ? pick : pick === 'heads' ? 'tails' : 'heads';
  const win = flip === pick;
  const delta = win ? bet : -bet;
  settle(p, cur, delta);
  return {
    win,
    delta,
    detail: `La pièce tombe sur ${flip === 'heads' ? 'PILE' : 'FACE'}.`,
    symbols: [flip === 'heads' ? '🟡' : '⚪'],
  };
}

// ─── Blackjack ──────────────────────────────────────────────────────────────
export interface Card {
  label: string;
  value: number;
}

const RANKS: Card[] = [
  { label: 'A', value: 11 },
  { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 },
  { label: '5', value: 5 }, { label: '6', value: 6 }, { label: '7', value: 7 },
  { label: '8', value: 8 }, { label: '9', value: 9 }, { label: '10', value: 10 },
  { label: 'J', value: 10 }, { label: 'Q', value: 10 }, { label: 'K', value: 10 },
];

export function drawCard(): Card {
  return RANKS[Math.floor(Math.random() * RANKS.length)];
}

/** Valeur d'une main (les As comptent 1 si nécessaire). */
export function handValue(cards: Card[]): number {
  let v = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter((c) => c.value === 11).length;
  while (v > 21 && aces > 0) { v -= 10; aces -= 1; }
  return v;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

/** Applique un gain/perte d'or de gambling (or + bilan + métrique quête). */
export function applyGamble(p: PlayerState, delta: number): void {
  settle(p, 'gold', delta);
}

export function canGamble(p: PlayerState, bet: number): boolean {
  return canBet(p, 'gold', bet);
}

const SLOT_SYMBOLS = ['🍒', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_PAYOUT: Record<string, number> = { '🍒': 2, '🔔': 7, '⭐': 9, '💎': 12, '7️⃣': 30 };

/** Machine à sous : 3 rouleaux. 3 identiques = jackpot, 2 identiques = remboursement partiel. */
export function slots(p: PlayerState, cur: Currency, bet: number): GambleResult {
  if (!canBet(p, cur, bet)) return { win: false, delta: 0, detail: 'Mise invalide.' };
  const l = luck(p);
  const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  let reels = [pick(), pick(), pick()];
  // La chance offre une seconde chance rare
  const aligned = (r: string[]) => r[0] === r[1] || r[1] === r[2] || r[0] === r[2];
  if (!aligned(reels) && Math.random() < l * 4) reels = [pick(), pick(), pick()];
  let delta = -bet;
  let detail = 'Perdu...';
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    delta = bet * SLOT_PAYOUT[reels[0]];
    detail = `JACKPOT ! Gains x${SLOT_PAYOUT[reels[0]] + 1}`;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    // 2 symboles = on perd la moitié de la mise (EV négatif)
    delta = -Math.ceil(bet * 0.5);
    detail = 'Deux symboles : mise partiellement perdue.';
  }
  settle(p, cur, delta);
  return { win: delta > 0, delta, detail, symbols: reels };
}

/**
 * Roue de la Fortune liée au cycle jour/nuit. La nuit, segments plus risqués
 * mais plus payants. Coûte des Fate Coins.
 */
export function wheel(p: PlayerState, bet: number): GambleResult {
  if (!canBet(p, 'fateCoins', bet)) return { win: false, delta: 0, detail: 'Pas assez de Fate Coins.' };
  const night = currentPhase() === 'night';
  // Segments : multiplicateur de la mise (0 = perte totale).
  // La roue est truquée (EV négatif).
  const segments = night ? [0, 0, 0, 0, 0, 5, 10] : [0, 0, 0, 0, 1, 2, 3];
  const seg = segments[Math.floor(Math.random() * segments.length)];
  const delta = seg === 0 ? -bet : bet * seg - bet;
  settle(p, 'fateCoins', delta);
  return {
    win: delta > 0,
    delta,
    detail: seg === 0 ? 'La roue retombe sur le vide.' : `La roue s'arrête sur x${seg} !`,
    rollValue: seg,
  };
}
