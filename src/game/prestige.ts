// Auras de prestige (Nv.30+). En plus du cosmétique affiché au classement,
// chaque aura confère un petit bonus passif thématique → le choix a un sens.

export interface PrestigeAura {
  emoji: string;
  label: string;
  desc: string;
  /** Couleur du pseudo quand l'aura est équipée (voir auraColor / auraColorOn). */
  color: string;
  bonus: Partial<{ atkPct: number; defPct: number; hpPct: number; xpPct: number; goldPct: number }>;
}

export const PRESTIGE_AURAS: PrestigeAura[] = [
  { emoji: '★',  label: 'Érudit',       desc: '+4% XP',                 color: '#7dd3fc', bonus: { xpPct: 0.04 } },
  { emoji: '💫', label: 'Fortune',       desc: '+4% Or',                 color: '#facc15', bonus: { goldPct: 0.04 } },
  { emoji: '👑', label: 'Souverain',     desc: '+2% ATK / DEF / PV',     color: '#e9d5ff', bonus: { atkPct: 0.02, defPct: 0.02, hpPct: 0.02 } },
  { emoji: '🔥', label: 'Ardent',        desc: '+5% ATK',                color: '#fb923c', bonus: { atkPct: 0.05 } },
  { emoji: '❄️', label: 'Givré',         desc: '+5% DEF',                color: '#93c5fd', bonus: { defPct: 0.05 } },
  { emoji: '🌟', label: 'Prospère',      desc: '+3% XP et Or',           color: '#fde047', bonus: { xpPct: 0.03, goldPct: 0.03 } },
  { emoji: '⚡', label: 'Fulgurant',     desc: '+3% ATK, +2% PV',        color: '#fef08a', bonus: { atkPct: 0.03, hpPct: 0.02 } },
  { emoji: '🌙', label: 'Nocturne',      desc: '+6% PV',                 color: '#c4b5fd', bonus: { hpPct: 0.06 } },
  { emoji: '🩸', label: 'Sanguinaire',   desc: '+5% ATK, -1% DEF',       color: '#f87171', bonus: { atkPct: 0.05, defPct: -0.01 } },
  { emoji: '🐉', label: 'Draconique',    desc: '+2% ATK/DEF, +3% PV',    color: '#4ade80', bonus: { atkPct: 0.02, defPct: 0.02, hpPct: 0.03 } },
];

/** Couleur du pseudo pour une aura donnée, ou undefined si aucune/désactivée. */
export function auraColor(aura?: string | null, colorOn: boolean = true): string | undefined {
  if (!aura || !colorOn) return undefined;
  return PRESTIGE_AURAS.find((a) => a.emoji === aura)?.color;
}

const EMPTY = { atkPct: 0, defPct: 0, hpPct: 0, xpPct: 0, goldPct: 0 };

/** Bonus cumulé de l'aura de prestige équipée (0 partout si aucune). */
export function prestigeBonus(aura?: string): typeof EMPTY {
  const a = PRESTIGE_AURAS.find((x) => x.emoji === aura);
  if (!a) return EMPTY;
  return { ...EMPTY, ...a.bonus };
}
