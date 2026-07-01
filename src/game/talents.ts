import type { PlayerState, ClassId } from './types';

/** Modificateurs agrégés depuis les traits de classe + talents investis. */
export interface CombatMods {
  crit: number; // proba de coup critique
  critMult: number; // multiplicateur de dégâts additionnel sur crit (base x2 + ceci)
  flatDmg: number; // dégâts plats ajoutés à chaque coup
  dmgReduction: number; // réduction des dégâts subis (0..1)
  dodge: number; // proba d'esquive totale
  doubleHit: number; // proba de frapper deux fois
  regen: number; // PV régénérés par tour
  berserkBonus: number; // bonus de dégâts sous 30% PV (soi-même)
  lifesteal: number; // fraction des dégâts infligés rendue en PV
  armorPen: number; // réduction de la DEF ennemie prise en compte (0..1)
  execute: number; // bonus de dégâts si l'ennemi est sous 20% PV
  thorns: number; // fraction des dégâts subis renvoyée à l'attaquant
  // Mods de stats permanentes (appliquées dans deriveStats, pas en combat).
  atkPct: number;
  defPct: number;
  hpPct: number;
}

export function emptyMods(): CombatMods {
  return {
    crit: 0, critMult: 0, flatDmg: 0, dmgReduction: 0, dodge: 0, doubleHit: 0,
    regen: 0, berserkBonus: 0, lifesteal: 0, armorPen: 0, execute: 0, thorns: 0,
    atkPct: 0, defPct: 0, hpPct: 0,
  };
}

/** Plafonds globaux, indépendants du nombre de talents investis. */
const CAPS: Partial<Record<keyof CombatMods, number>> = {
  dmgReduction: 0.6, dodge: 0.5, crit: 0.75, doubleHit: 0.6,
  lifesteal: 0.3, armorPen: 0.5, execute: 0.5, thorns: 0.3,
  atkPct: 0.4, defPct: 0.4, hpPct: 0.4, regen: 45, critMult: 1.2,
};

export type TalentTier = 1 | 2 | 3;

export interface TalentDef {
  id: string;
  classId: ClassId;
  tier: TalentTier;
  /** Points investis dans les talents de la classe requis pour débloquer ce palier. */
  reqPoints: number;
  name: string;
  icon: string;
  desc: string;
  maxRank: number;
  capstone?: boolean;
  /** Effet par rang. */
  perRank: Partial<CombatMods>;
}

// ─── Arbres de talents ──────────────────────────────────────────────────────
// 3 paliers par classe : T1 (0 pt requis), T2 (5 pts investis dans la classe),
// T3 (10 pts investis). Chaque palier a 2-3 talents multi-rangs + un capstone
// à rang unique en fin de T3. Coût total pour tout maxer : 23 points (~niveau
// 24), volontairement long — voir GAME_DESIGN pour la logique d'équilibrage.

export const TALENTS: TalentDef[] = [
  // ── Guerrier : tank/bruiser ──
  { id: 'w_crit', classId: 'warrior', tier: 1, reqPoints: 0, name: 'Frappe brutale', icon: '💥', desc: '+5% critique par rang.', maxRank: 3, perRank: { crit: 0.05 } },
  { id: 'w_armor', classId: 'warrior', tier: 1, reqPoints: 0, name: 'Peau de fer', icon: '🛡️', desc: '-5% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.05 } },
  { id: 'w_vigor', classId: 'warrior', tier: 1, reqPoints: 0, name: 'Robustesse', icon: '❤️', desc: '+4% PV max par rang.', maxRank: 3, perRank: { hpPct: 0.04 } },
  { id: 'w_berserk', classId: 'warrior', tier: 2, reqPoints: 5, name: 'Furie', icon: '😤', desc: '+10% dégâts sous 30% PV, par rang.', maxRank: 3, perRank: { berserkBonus: 0.10 } },
  { id: 'w_thorns', classId: 'warrior', tier: 2, reqPoints: 5, name: 'Riposte', icon: '🔩', desc: '+5% des dégâts subis renvoyés, par rang.', maxRank: 3, perRank: { thorns: 0.05 } },
  { id: 'w_pen', classId: 'warrior', tier: 2, reqPoints: 5, name: 'Perce-armure', icon: '🗡️', desc: '+6% DEF ennemie ignorée par rang.', maxRank: 3, perRank: { armorPen: 0.06 } },
  { id: 'w_lifesteal', classId: 'warrior', tier: 3, reqPoints: 10, name: 'Rage sanguinaire', icon: '🩸', desc: '+5% vol de vie par rang.', maxRank: 2, perRank: { lifesteal: 0.05 } },
  { id: 'w_shield', classId: 'warrior', tier: 3, reqPoints: 10, name: 'Bouclier de fer', icon: '🔰', desc: '+8% dégâts subis en moins, par rang.', maxRank: 2, perRank: { dmgReduction: 0.08 } },
  { id: 'w_colossus', classId: 'warrior', tier: 3, reqPoints: 10, name: 'Colosse', icon: '🗿', desc: 'Capstone : +10% ATK, +15% PV max.', maxRank: 1, capstone: true, perRank: { atkPct: 0.10, hpPct: 0.15 } },

  // ── Mage : glass cannon ──
  { id: 'm_crit', classId: 'mage', tier: 1, reqPoints: 0, name: 'Pyromancie', icon: '🔥', desc: '+6% critique par rang.', maxRank: 3, perRank: { crit: 0.06 } },
  { id: 'm_flat', classId: 'mage', tier: 1, reqPoints: 0, name: 'Trait de feu', icon: '✨', desc: '+4 dégâts par coup et par rang.', maxRank: 3, perRank: { flatDmg: 4 } },
  { id: 'm_focus', classId: 'mage', tier: 1, reqPoints: 0, name: 'Focalisation', icon: '🧠', desc: '+4% ATK par rang.', maxRank: 3, perRank: { atkPct: 0.04 } },
  { id: 'm_overload', classId: 'mage', tier: 2, reqPoints: 5, name: 'Surcharge', icon: '⚡', desc: '+0.15 multiplicateur de critique par rang.', maxRank: 3, perRank: { critMult: 0.15 } },
  { id: 'm_shield', classId: 'mage', tier: 2, reqPoints: 5, name: 'Bouclier de mana', icon: '🔵', desc: '-5% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.05 } },
  { id: 'm_rupture', classId: 'mage', tier: 2, reqPoints: 5, name: 'Rupture', icon: '💢', desc: '+6% DEF ennemie ignorée par rang.', maxRank: 3, perRank: { armorPen: 0.06 } },
  { id: 'm_execute', classId: 'mage', tier: 3, reqPoints: 10, name: 'Combustion', icon: '☄️', desc: '+10% dégâts si l\'ennemi est sous 20% PV, par rang.', maxRank: 2, perRank: { execute: 0.10 } },
  { id: 'm_drain', classId: 'mage', tier: 3, reqPoints: 10, name: 'Vol de vie arcanique', icon: '🌀', desc: '+4% vol de vie par rang.', maxRank: 2, perRank: { lifesteal: 0.04 } },
  { id: 'm_singularity', classId: 'mage', tier: 3, reqPoints: 10, name: 'Singularité', icon: '🌌', desc: 'Capstone : +15% critique, +0.3 multiplicateur de critique.', maxRank: 1, capstone: true, perRank: { crit: 0.15, critMult: 0.3 } },

  // ── Archer : vitesse/crit ──
  { id: 'a_double', classId: 'archer', tier: 1, reqPoints: 0, name: 'Tir double', icon: '🏹', desc: '+6% de frapper deux fois, par rang.', maxRank: 3, perRank: { doubleHit: 0.06 } },
  { id: 'a_aim', classId: 'archer', tier: 1, reqPoints: 0, name: 'Visée', icon: '🎯', desc: '+5% critique par rang.', maxRank: 3, perRank: { crit: 0.05 } },
  { id: 'a_step', classId: 'archer', tier: 1, reqPoints: 0, name: 'Foulée légère', icon: '💨', desc: '+4% esquive par rang.', maxRank: 3, perRank: { dodge: 0.04 } },
  { id: 'a_pierce', classId: 'archer', tier: 2, reqPoints: 5, name: 'Flèches perçantes', icon: '🪶', desc: '+7% DEF ennemie ignorée par rang.', maxRank: 3, perRank: { armorPen: 0.07 } },
  { id: 'a_instinct', classId: 'archer', tier: 2, reqPoints: 5, name: 'Instinct', icon: '👁️', desc: '+4% ATK par rang.', maxRank: 3, perRank: { atkPct: 0.04 } },
  { id: 'a_evade', classId: 'archer', tier: 2, reqPoints: 5, name: 'Esquive avancée', icon: '🌪️', desc: '+5% esquive par rang.', maxRank: 3, perRank: { dodge: 0.05 } },
  { id: 'a_kill', classId: 'archer', tier: 3, reqPoints: 10, name: 'Coup fatal', icon: '☠️', desc: '+12% dégâts si l\'ennemi est sous 20% PV, par rang.', maxRank: 2, perRank: { execute: 0.12 } },
  { id: 'a_reflex', classId: 'archer', tier: 3, reqPoints: 10, name: 'Réflexes', icon: '🔁', desc: '+4% des dégâts subis renvoyés, par rang.', maxRank: 2, perRank: { thorns: 0.04 } },
  { id: 'a_storm', classId: 'archer', tier: 3, reqPoints: 10, name: 'Tempête de flèches', icon: '🌩️', desc: 'Capstone : +15% double frappe, +10% critique.', maxRank: 1, capstone: true, perRank: { doubleHit: 0.15, crit: 0.10 } },

  // ── Soigneur : sustain/support ──
  { id: 'h_regen', classId: 'healer', tier: 1, reqPoints: 0, name: 'Régénération', icon: '💚', desc: '+5 PV régénérés par tour et par rang.', maxRank: 3, perRank: { regen: 5 } },
  { id: 'h_bless', classId: 'healer', tier: 1, reqPoints: 0, name: 'Bénédiction', icon: '🙏', desc: '-5% dégâts subis par rang.', maxRank: 3, perRank: { dmgReduction: 0.05 } },
  { id: 'h_vitality', classId: 'healer', tier: 1, reqPoints: 0, name: 'Vitalité', icon: '❤️‍🩹', desc: '+5% PV max par rang.', maxRank: 3, perRank: { hpPct: 0.05 } },
  { id: 'h_smite', classId: 'healer', tier: 2, reqPoints: 5, name: 'Châtiment', icon: '⚡', desc: '+3 dégâts par coup et par rang.', maxRank: 3, perRank: { flatDmg: 3 } },
  { id: 'h_symbiosis', classId: 'healer', tier: 2, reqPoints: 5, name: 'Symbiose', icon: '🔗', desc: '+5% vol de vie par rang.', maxRank: 3, perRank: { lifesteal: 0.05 } },
  { id: 'h_faith', classId: 'healer', tier: 2, reqPoints: 5, name: 'Foi', icon: '✝️', desc: '+4% DEF par rang.', maxRank: 3, perRank: { defPct: 0.04 } },
  { id: 'h_rebirth', classId: 'healer', tier: 3, reqPoints: 10, name: 'Renaissance', icon: '🌅', desc: '+8 PV régénérés par tour et par rang.', maxRank: 2, perRank: { regen: 8 } },
  { id: 'h_purify', classId: 'healer', tier: 3, reqPoints: 10, name: 'Purification', icon: '🕊️', desc: '+6% dégâts subis en moins, par rang.', maxRank: 2, perRank: { dmgReduction: 0.06 } },
  { id: 'h_divine', classId: 'healer', tier: 3, reqPoints: 10, name: 'Bénédiction divine', icon: '👼', desc: 'Capstone : -10% dégâts subis, +10 régén/tour, +10% PV max.', maxRank: 1, capstone: true, perRank: { dmgReduction: 0.10, regen: 10, hpPct: 0.10 } },
];

export function talentsForClass(classId: ClassId): TalentDef[] {
  return TALENTS.filter((t) => t.classId === classId);
}

/** Total de points investis dans les talents d'une classe (toutes classes confondues dans p.talents, filtré). */
export function pointsSpentInClass(p: PlayerState, classId: ClassId): number {
  let sum = 0;
  for (const t of talentsForClass(classId)) sum += p.talents?.[t.id] ?? 0;
  return sum;
}

/** Palier le plus haut actuellement débloqué pour la classe du joueur. */
export function highestUnlockedTier(p: PlayerState): TalentTier {
  const spent = pointsSpentInClass(p, p.classId);
  if (spent >= 10) return 3;
  if (spent >= 5) return 2;
  return 1;
}

/** Capacité active de classe (utilisable manuellement en combat). */
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
  warrior: { name: 'Coup héroïque', icon: '⚔️', desc: '×1.8 dégâts.', cooldownMs: 20_000, mult: 1.8 },
  mage: { name: 'Météore', icon: '☄️', desc: '×2.2 dégâts.', cooldownMs: 25_000, mult: 2.2 },
  archer: { name: 'Pluie de flèches', icon: '🏹', desc: '×1.9 dégâts.', cooldownMs: 20_000, mult: 1.9 },
  healer: { name: 'Châtiment sacré', icon: '⚡', desc: '×1.5 dégâts + soigne 12% PV.', cooldownMs: 18_000, mult: 1.5, healFrac: 0.12 },
};

/** Traits innés de classe (actifs même sans talent investi). */
export const CLASS_BASE_MODS: Record<ClassId, Partial<CombatMods>> = {
  warrior: { dmgReduction: 0.1 }, // encaisseur
  mage: { crit: 0.06 }, // sorts critiques
  archer: { doubleHit: 0.06 }, // tirs rapides
  healer: { regen: 5 }, // régénération constante
};

/** Agrège traits innés de classe + talents investis, plafonnés. */
export function talentMods(p: PlayerState): CombatMods {
  const mods = emptyMods();
  for (const [key, val] of Object.entries(CLASS_BASE_MODS[p.classId] ?? {})) {
    mods[key as keyof CombatMods] += val as number;
  }
  if (p.talents) {
    for (const def of talentsForClass(p.classId)) {
      const rank = p.talents[def.id] ?? 0;
      if (rank <= 0) continue;
      for (const key of Object.keys(def.perRank) as (keyof CombatMods)[]) {
        mods[key] += (def.perRank[key] ?? 0) * rank;
      }
    }
  }
  for (const [key, cap] of Object.entries(CAPS) as [keyof CombatMods, number][]) {
    mods[key] = Math.min(mods[key], cap);
  }
  return mods;
}

/** Investit un point dans un talent (respecte le palier débloqué). Retourne true si réussi. */
export function spendTalent(p: PlayerState, talentId: string): boolean {
  const def = TALENTS.find((t) => t.id === talentId);
  if (!def || def.classId !== p.classId) return false;
  const rank = p.talents[talentId] ?? 0;
  if ((p.talentPoints ?? 0) <= 0 || rank >= def.maxRank) return false;
  if (pointsSpentInClass(p, p.classId) < def.reqPoints) return false;
  p.talents[talentId] = rank + 1;
  p.talentPoints -= 1;
  return true;
}
