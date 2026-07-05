import type { ClassId } from './types';

export interface ClassDef {
  id: ClassId;
  name: string;
  emoji: string;
  desc: string;
  base: { maxHp: number; atk: number; def: number };
  /** Gain de stats par niveau. */
  growth: { maxHp: number; atk: number; def: number };
  /** Classe parente (si ascension) */
  parent?: ClassId;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  // ── Guerrier ──
  warrior: {
    id: 'warrior',
    name: 'Guerrier',
    emoji: '⚔️',
    desc: 'Tank : gros PV/DEF et -10% de dégâts subis (inné).',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 18, atk: 3, def: 3 }, // DEF +2→+3 (tank principal)
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    emoji: '🛡️',
    desc: 'Protecteur de la lumière : -15% dégâts subis et Soins améliorés.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 22, atk: 4, def: 3 },
    parent: 'warrior',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    emoji: '🪓',
    desc: 'Rage pure : +15% dégâts, mais plus vulnérable.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 20, atk: 6, def: 1 },
    parent: 'warrior',
  },
  dark_knight: {
    id: 'dark_knight',
    name: 'Chevalier Noir',
    emoji: '🗡️',
    desc: 'Puissance sacrificielle : dégâts massifs basés sur les PV manquants.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 25, atk: 5, def: 2 },
    parent: 'warrior',
  },

  // ── Mage ──
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    desc: 'Burst magique : ATK élevée et +6% critique (inné), mais fragile.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 11, atk: 4, def: 1 },
  },
  pyromancer: {
    id: 'pyromancer',
    name: 'Pyromancien',
    emoji: '🔥',
    desc: 'Destruction : ATK colossale et brûlures critiques.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 12, atk: 7, def: 1 },
    parent: 'mage',
  },
  cryomancer: {
    id: 'cryomancer',
    name: 'Cryomancien',
    emoji: '❄️',
    desc: 'Contrôle absolu : très résistant pour un mage, sorts de gel.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 15, atk: 5, def: 2 },
    parent: 'mage',
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcaniste',
    emoji: '🌌',
    desc: 'Maître du temps : compétences à faible coût et dégâts explosifs.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 13, atk: 6, def: 1 },
    parent: 'mage',
  },

  // ── Archer ──
  archer: {
    id: 'archer',
    name: 'Archer',
    emoji: '🏹',
    desc: 'Polyvalent : dégâts réguliers et +6% de double frappe (inné).',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 14, atk: 4, def: 1 },
  },
  rogue: {
    id: 'rogue',
    name: 'Voleur',
    emoji: '🗡️',
    desc: 'Ombre mortelle : esquive élevée et dégâts critiques extrêmes.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 15, atk: 6, def: 1 },
    parent: 'archer',
  },
  bard: {
    id: 'bard',
    name: 'Barde',
    emoji: '🎵',
    desc: 'Soutien musical : buffs passifs pour toute l\'équipe.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 16, atk: 4, def: 2 },
    parent: 'archer',
  },
  hunter: {
    id: 'hunter',
    name: 'Chasseur',
    emoji: '🐺',
    desc: 'Tireur d\'élite : dégâts stables, ignore l\'armure ennemie.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 17, atk: 5, def: 2 },
    parent: 'archer',
  },

  // ── Soigneur ──
  healer: {
    id: 'healer',
    name: 'Soigneur',
    emoji: '✨',
    desc: 'Sustain : +5 PV régénérés par tour (inné), increvable.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 18, atk: 3, def: 1 }, // DEF +2→+1, HP +16→+18 (compensation)
  },
  dawn_priest: {
    id: 'dawn_priest',
    name: 'Prêtre de l\'Aube',
    emoji: '🌅',
    desc: 'Soigneur pur : boucliers divins et régénération absolue.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 22, atk: 4, def: 1 }, // DEF +3→+1 (était plus défensif que le warrior !), HP +20→+22
    parent: 'healer',
  },
  druid: {
    id: 'druid',
    name: 'Druide',
    emoji: '🌿',
    desc: 'Force de la nature : renvoi de dégâts et épines.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 22, atk: 5, def: 1 }, // DEF +2→+1
    parent: 'healer',
  },
  monk: {
    id: 'monk',
    name: 'Moine',
    emoji: '📿',
    desc: 'Art martial : inflige des dégâts au corps à corps pour se soigner.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 18, atk: 6, def: 1 }, // DEF +2→+1 (moine = DPS soigneur, pas tank)
    parent: 'healer',
  },
};

export const CLASS_LIST = Object.values(CLASSES);

/** Classes de base disponibles à la création du personnage. */
export const BASE_CLASSES = CLASS_LIST.filter(c => !c.parent);

/** Renvoie les ascensions possibles pour une classe donnée. */
export function getAscensions(classId: ClassId): ClassDef[] {
  return CLASS_LIST.filter(c => c.parent === classId);
}

/** Niveau max */
export const MAX_LEVEL = 50;

/** Ancienne courbe (plafond 30) — conservée pour la migration des niveaux. */
export function xpToNextV3(currentLevel: number): number {
  if (currentLevel >= 30) return Infinity;
  return Math.floor(100 * Math.pow(1.32, currentLevel - 1));
}

const XP_AT_15 = 100 * Math.pow(1.25, 14);
const XP_AT_30 = XP_AT_15 * Math.pow(1.20, 15);

/**
 * XP pour passer du niveau n au n+1 (courbe v4, deux phases + end-game jusqu'à 50).
 * Early (≤15) douce, mid (16-30) plateau confortable, end (31-50) étirement maîtrisé.
 */
export function xpToNext(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return Infinity;
  if (currentLevel <= 15) return Math.floor(100 * Math.pow(1.25, currentLevel - 1));
  if (currentLevel <= 30) return Math.floor(XP_AT_15 * Math.pow(1.20, currentLevel - 15));
  return Math.floor(XP_AT_30 * Math.pow(1.18, currentLevel - 30));
}

/** Retourne l'arme par défaut (T0) selon la classe (ou sa classe parente). */
export function starterWeapon(classId: ClassId): string {
  const baseId = CLASSES[classId].parent || classId;
  if (baseId === 'warrior') return 'rusty_sword';
  if (baseId === 'mage') return 'apprentice_wand';
  if (baseId === 'archer') return 'hunter_bow';
  if (baseId === 'healer') return 'apprentice_wand';
  return 'rusty_sword'; // fallback
}
