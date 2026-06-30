// ─── Card-Jitsu (façon Club Penguin) ────────────────────────────────────────
// Feu bat Neige, Neige bat Eau, Eau bat Feu. À élément égal, la plus haute
// valeur l'emporte. On gagne en banquant 3 cartes du même élément OU une de
// chaque élément.

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


