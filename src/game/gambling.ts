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
  if (cur === 'gold') p.gambleNet += delta;
  if (delta > 0) addQuestMetric(p, 'gambleWins', 1);
}

/** Pile ou face : x2 sur victoire. */
export function coinflip(p: PlayerState, cur: Currency, bet: number, pick: 'heads' | 'tails'): GambleResult {
  if (!canBet(p, cur, bet)) return { win: false, delta: 0, detail: 'Mise invalide.' };
  const flip = Math.random() < 0.5 + luck(p) ? pick : pick === 'heads' ? 'tails' : 'heads';
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

/** Dés : devine plus haut/plus bas que 3.5 (2d6 simplifié à 1d6). */
export function dice(p: PlayerState, cur: Currency, bet: number, pick: 'high' | 'low'): GambleResult {
  if (!canBet(p, cur, bet)) return { win: false, delta: 0, detail: 'Mise invalide.' };
  const r = 1 + Math.floor(Math.random() * 6);
  const isHigh = r >= 4;
  const win = (pick === 'high' && isHigh) || (pick === 'low' && !isHigh);
  const delta = win ? bet : -bet;
  settle(p, cur, delta);
  return { win, delta, detail: `Le dé affiche ${r}.`, rollValue: r };
}

const SLOT_SYMBOLS = ['🍒', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_PAYOUT: Record<string, number> = { '🍒': 3, '🔔': 5, '⭐': 8, '💎': 15, '7️⃣': 40 };

/** Machine à sous : 3 rouleaux. 3 identiques = jackpot, 2 identiques = x1.5. */
export function slots(p: PlayerState, cur: Currency, bet: number): GambleResult {
  if (!canBet(p, cur, bet)) return { win: false, delta: 0, detail: 'Mise invalide.' };
  const l = luck(p);
  const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  let reels = [pick(), pick(), pick()];
  // La chance offre une seconde chance : si rien ne s'aligne, on relance une fois.
  const aligned = (r: string[]) => r[0] === r[1] || r[1] === r[2] || r[0] === r[2];
  if (!aligned(reels) && Math.random() < l * 6) reels = [pick(), pick(), pick()];
  let delta = -bet;
  let detail = 'Perdu...';
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    delta = bet * SLOT_PAYOUT[reels[0]];
    detail = `JACKPOT ! x${SLOT_PAYOUT[reels[0]]}`;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    delta = Math.floor(bet * 0.5);
    detail = 'Deux symboles : mise partiellement remboursée.';
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
  const segments = night ? [0, 0, 0, 2, 3, 10] : [0, 0, 1, 2, 3, 5];
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
