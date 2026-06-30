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
    desc: 'Tank robuste. Beaucoup de PV et de défense.',
    base: { maxHp: 120, atk: 12, def: 8 },
    growth: { maxHp: 18, atk: 3, def: 2 },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    desc: 'Dégâts magiques élevés, fragile.',
    base: { maxHp: 80, atk: 18, def: 3 },
    growth: { maxHp: 10, atk: 5, def: 1 },
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    emoji: '🏹',
    desc: 'Polyvalent, dégâts constants.',
    base: { maxHp: 95, atk: 15, def: 5 },
    growth: { maxHp: 13, atk: 4, def: 1 },
  },
  healer: {
    id: 'healer',
    name: 'Soigneur',
    emoji: '✨',
    desc: 'Régénère vite, survit longtemps.',
    base: { maxHp: 110, atk: 10, def: 6 },
    growth: { maxHp: 16, atk: 2, def: 2 },
  },
};

export const CLASS_LIST = Object.values(CLASSES);

/** XP nécessaire pour passer du niveau n au niveau n+1. */
export function xpToNext(level: number): number {
  // Courbe volontairement longue : la progression doit prendre du temps,
  // on ne finit pas le jeu en une soirée.
  return Math.floor(70 * Math.pow(level, 1.55)) + 70;
}
