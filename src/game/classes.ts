import type { ClassId } from './types';

export interface ClassDef {
  id: ClassId;
  name: string;
  emoji: string;
  desc: string;
  base: { maxHp: number; atk: number; def: number };
  /** Gain de stats par niveau. */
  growth: { maxHp: number; atk: number; def: number };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Guerrier',
    emoji: '⚔️',
    desc: 'Tank : gros PV/DEF et -10% de dégâts subis (inné).',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 18, atk: 3, def: 2 },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    desc: 'Burst magique : ATK élevée et +6% critique (inné), mais fragile.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 11, atk: 4, def: 1 },
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    emoji: '🏹',
    desc: 'Polyvalent : dégâts réguliers et +6% de double frappe (inné).',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 14, atk: 4, def: 1 },
  },
  healer: {
    id: 'healer',
    name: 'Soigneur',
    emoji: '✨',
    desc: 'Sustain : +5 PV régénérés par tour (inné), increvable.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 16, atk: 3, def: 2 },
  },
};

export const CLASS_LIST = Object.values(CLASSES);

/** XP nécessaire pour passer du niveau n au niveau n+1 (courbe v2, dure). */
export function xpToNext(level: number): number {
  // Exposant 1.95 : chaque niveau coûte de plus en plus, la fin de jeu est longue.
  return Math.floor(110 * Math.pow(level, 1.95)) + 90;
}

/** Ancienne courbe (v1) — sert au recalcul des niveaux lors de la migration. */
export function xpToNextV1(level: number): number {
  return Math.floor(70 * Math.pow(level, 1.55)) + 70;
}
