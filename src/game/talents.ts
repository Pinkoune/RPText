import type { PlayerState, ClassId } from './types';

/** Modificateurs de combat agrégés depuis les talents. */
export interface CombatMods {
  crit: number; // proba de coup critique (x2)
  flatDmg: number; // dégâts plats ajoutés à chaque coup
  dmgReduction: number; // réduction des dégâts subis (0..1)
  dodge: number; // proba d'esquive totale
  doubleHit: number; // proba de frapper deux fois
  regen: number; // PV régénérés par tour
  berserkBonus: number; // bonus de dégâts sous 30% PV
}

export interface TalentDef {
  id: string;
  classId: ClassId;
  name: string;
  icon: string;
  desc: string;
  maxRank: number;
  /** Effet par rang. */
  perRank: Partial<CombatMods>;
}

export const TALENTS: TalentDef[] = [
  // Guerrier
  { id: 'w_crit', classId: 'warrior', name: 'Frappe brutale', icon: '💥', desc: '+6% coup critique par rang.', maxRank: 3, perRank: { crit: 0.06 } },
  { id: 'w_armor', classId: 'warrior', name: 'Peau de fer', icon: '🛡️', desc: '-6% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.06 } },
  { id: 'w_berserk', classId: 'warrior', name: 'Furie', icon: '😤', desc: '+12% dégâts sous 30% PV, par rang.', maxRank: 3, perRank: { berserkBonus: 0.12 } },
  // Mage
  { id: 'm_crit', classId: 'mage', name: 'Pyromancie', icon: '🔥', desc: '+8% coup critique par rang.', maxRank: 3, perRank: { crit: 0.08 } },
  { id: 'm_flat', classId: 'mage', name: 'Trait de feu', icon: '✨', desc: '+4 dégâts par coup et par rang.', maxRank: 3, perRank: { flatDmg: 4 } },
  { id: 'm_shield', classId: 'mage', name: 'Bouclier de mana', icon: '🔵', desc: '-5% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.05 } },
  // Archer
  { id: 'a_double', classId: 'archer', name: 'Tir double', icon: '🏹', desc: '+8% de frapper deux fois, par rang.', maxRank: 3, perRank: { doubleHit: 0.08 } },
  { id: 'a_dodge', classId: 'archer', name: 'Esquive', icon: '💨', desc: '+5% esquive par rang.', maxRank: 3, perRank: { dodge: 0.05 } },
  { id: 'a_crit', classId: 'archer', name: 'Visée', icon: '🎯', desc: '+6% coup critique par rang.', maxRank: 3, perRank: { crit: 0.06 } },
  // Soigneur
  { id: 'h_regen', classId: 'healer', name: 'Régénération', icon: '💚', desc: '+6 PV régénérés par tour et par rang.', maxRank: 3, perRank: { regen: 6 } },
  { id: 'h_armor', classId: 'healer', name: 'Bénédiction', icon: '🙏', desc: '-6% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.06 } },
  { id: 'h_smite', classId: 'healer', name: 'Châtiment', icon: '⚡', desc: '+3 dégâts par coup et par rang.', maxRank: 3, perRank: { flatDmg: 3 } },
];

export function talentsForClass(classId: ClassId): TalentDef[] {
  return TALENTS.filter((t) => t.classId === classId);
}

/** Capacité active de classe (utilisable manuellement contre le boss mondial). */
export interface ClassAbility {
  name: string;
  icon: string;
  desc: string;
  cooldownMs: number;
  /** Multiplicateur de dégâts appliqué à l'ATK. */
  mult: number;
  /** Fraction des PV max soignés (soigneur). */
  healFrac?: number;
}

export const ABILITIES: Record<ClassId, ClassAbility> = {
  warrior: { name: 'Coup héroïque', icon: '⚔️', desc: '×3 dégâts au boss.', cooldownMs: 20_000, mult: 3 },
  mage: { name: 'Météore', icon: '☄️', desc: '×4 dégâts au boss.', cooldownMs: 25_000, mult: 4 },
  archer: { name: 'Pluie de flèches', icon: '🏹', desc: '×3 dégâts au boss.', cooldownMs: 20_000, mult: 3 },
  healer: { name: 'Châtiment sacré', icon: '⚡', desc: '×2 dégâts + soigne 20% PV.', cooldownMs: 18_000, mult: 2, healFrac: 0.2 },
};

export function emptyMods(): CombatMods {
  return { crit: 0, flatDmg: 0, dmgReduction: 0, dodge: 0, doubleHit: 0, regen: 0, berserkBonus: 0 };
}

/** Agrège les effets des talents investis (uniquement ceux de la classe). */
export function talentMods(p: PlayerState): CombatMods {
  const mods = emptyMods();
  if (!p.talents) return mods;
  for (const def of talentsForClass(p.classId)) {
    const rank = p.talents[def.id] ?? 0;
    if (rank <= 0) continue;
    for (const key of Object.keys(def.perRank) as (keyof CombatMods)[]) {
      mods[key] += (def.perRank[key] ?? 0) * rank;
    }
  }
  // Garde-fous
  mods.dmgReduction = Math.min(0.6, mods.dmgReduction);
  mods.dodge = Math.min(0.5, mods.dodge);
  mods.crit = Math.min(0.75, mods.crit);
  mods.doubleHit = Math.min(0.6, mods.doubleHit);
  return mods;
}

/** Investit un point dans un talent. Retourne true si réussi. */
export function spendTalent(p: PlayerState, talentId: string): boolean {
  const def = TALENTS.find((t) => t.id === talentId);
  if (!def || def.classId !== p.classId) return false;
  const rank = p.talents[talentId] ?? 0;
  if ((p.talentPoints ?? 0) <= 0 || rank >= def.maxRank) return false;
  p.talents[talentId] = rank + 1;
  p.talentPoints -= 1;
  return true;
}
