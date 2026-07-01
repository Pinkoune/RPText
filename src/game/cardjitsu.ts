// ─── Card-Jitsu (façon Club Penguin) ────────────────────────────────────────
// Feu bat Neige, Neige bat Eau, Eau bat Feu. À élément égal, la plus haute
// valeur l'emporte. On gagne en banquant 3 cartes du même élément OU une de
// chaque élément.

// Ceintures (façon Club Penguin), débloquées par victoires PvP.
export interface CJBelt { name: string; color: string; wins: number; }
export const CJ_BELTS: CJBelt[] = [
  { name: 'Ceinture blanche', color: '#e5e7eb', wins: 0 },
  { name: 'Ceinture jaune', color: '#facc15', wins: 3 },
  { name: 'Ceinture orange', color: '#fb923c', wins: 8 },
  { name: 'Ceinture verte', color: '#4ade80', wins: 15 },
  { name: 'Ceinture bleue', color: '#60a5fa', wins: 25 },
  { name: 'Ceinture rouge', color: '#f87171', wins: 40 },
  { name: 'Ceinture violette', color: '#c084fc', wins: 60 },
  { name: 'Ceinture marron', color: '#a16207', wins: 85 },
  { name: 'Ceinture noire', color: '#111827', wins: 120 },
  { name: 'Maître Ninja', color: '#f59e0b', wins: 170 },
];

/** Ceinture actuelle + prochaine selon le nombre de victoires. */
export function cjBelt(wins: number): { current: CJBelt; next: CJBelt | null } {
  let idx = 0;
  for (let i = 0; i < CJ_BELTS.length; i++) if (wins >= CJ_BELTS[i].wins) idx = i;
  return { current: CJ_BELTS[idx], next: CJ_BELTS[idx + 1] ?? null };
}

export type CJElement = 'fire' | 'water' | 'snow';

export interface CJCard {
  element: CJElement;
  value: number;
}

export const CJ_META: Record<CJElement, { name: string; emoji: string; color: string; beats: CJElement }> = {
  fire: { name: 'Feu', emoji: '🔥', color: '#ff7043', beats: 'snow' },
  snow: { name: 'Neige', emoji: '❄️', color: '#7cc7ff', beats: 'water' },
  water: { name: 'Eau', emoji: '💧', color: '#5aa6ff', beats: 'fire' },
};

export const CJ_ELEMENTS: CJElement[] = ['fire', 'water', 'snow'];

export function drawCJCard(): CJCard {
  return {
    element: CJ_ELEMENTS[Math.floor(Math.random() * 3)],
    value: 1 + Math.floor(Math.random() * 9),
  };
}

/** 1 = a gagne, -1 = b gagne, 0 = égalité. */
export function compareCJ(a: CJCard, b: CJCard): number {
  if (a.element === b.element) return Math.sign(a.value - b.value);
  return CJ_META[a.element].beats === b.element ? 1 : -1;
}

export function cjCounts(bank: CJCard[]): Record<CJElement, number> {
  const c: Record<CJElement, number> = { fire: 0, water: 0, snow: 0 };
  for (const x of bank) c[x.element] += 1;
  return c;
}

/** Victoire si 3+ du même élément OU une de chaque élément. */
export function cjBankWin(bank: CJCard[]): boolean {
  const c = cjCounts(bank);
  if (c.fire >= 3 || c.water >= 3 || c.snow >= 3) return true;
  return c.fire >= 1 && c.water >= 1 && c.snow >= 1;
}

/** IA : vise à compléter sa banque (atteindre 3 d'un élément ou diversifier). */
export function aiPickCard(hand: CJCard[], bank: CJCard[]): number {
  const c = cjCounts(bank);
  let target: CJElement | null = null;
  for (const e of CJ_ELEMENTS) if (c[e] === 2) target = e; // proche d'un trio
  if (!target) {
    const miss = CJ_ELEMENTS.find((e) => c[e] === 0 && hand.some((h) => h.element === e));
    if (miss) target = miss; // complète "une de chaque"
  }
  let pool = target ? hand.map((h, i) => ({ h, i })).filter((x) => x.h.element === target) : [];
  if (pool.length === 0) pool = hand.map((h, i) => ({ h, i }));
  pool.sort((a, b) => b.h.value - a.h.value);
  return pool[0].i;
}
