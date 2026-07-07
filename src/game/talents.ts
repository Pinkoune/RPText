import type { PlayerState, ClassId } from './types';
import { CLASSES } from './classes';

export interface CombatMods {
  crit: number;
  critMult: number;
  flatDmg: number;
  dmgReduction: number;
  dodge: number;
  doubleHit: number;
  regen: number;
  berserkBonus: number;
  lifesteal: number;
  armorPen: number;
  execute: number;
  thorns: number;
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

const CAPS: Partial<Record<keyof CombatMods, number>> = {
  dmgReduction: 0.7, dodge: 0.6, crit: 0.85, doubleHit: 0.7,
  lifesteal: 0.4, armorPen: 0.6, execute: 0.6, thorns: 0.4,
  atkPct: 0.6, defPct: 0.6, hpPct: 0.6, regen: 100, critMult: 1.5,
};

export type StatusType = 'burn' | 'poison' | 'chill' | 'weaken' | 'armorBreak';

export interface ActiveSkillDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cooldownMs: number;
  type: 'attack' | 'heal' | 'buff' | 'shield';
  mult?: number;
  healFrac?: number;
  /** Bouclier réel = fraction des PV max, absorbe les dégâts entrants. */
  shield?: number;
  /** Altération d'état infligée au monstre. */
  status?: { type: StatusType; turns: number; /** Puissance (× ATK) pour brûlure/poison. */ pow?: number };
  /** Voleur : chaparde de l'or instantanément (× ATK), indépendant du butin de fin de combat. */
  goldSteal?: number;
  /** Arcaniste : distorsion temporelle — réduit de N tours les cooldowns des AUTRES compétences équipées. */
  haste?: number;
  /** Barde : buff d'ATK (%) permanent pour le reste du combat, sur soi (solo) ou toute l'équipe (donjon/endless multi). */
  teamAtkBuff?: number;
  /** Paladin : force l'aggro du monstre sur soi (donjon), même sans dégâts (ex : Rempart). */
  taunt?: boolean;
  /**
   * Ressource alternative au cooldown universel (pilote sur 4 archétypes) :
   * - rage (Berserker/Dark Knight) : coût fixe, se charge en encaissant des dégâts.
   * - combo (Voleur/Moine) : consomme TOUT le combo actuel (doit avoir au moins
   *   `cost` points), se charge de +1 par coup porté ; `scalePerPoint` ajoute un
   *   multiplicateur de DÉGÂTS par point consommé (remplace/complète `mult`).
   * - grace (Prêtre de l'Aube) : consomme TOUTE la Grâce actuelle (doit avoir au
   *   moins `cost`), se charge en soignant (soi ou l'équipe) ; `scalePerPoint`
   *   ajoute au taux de SOIN par point consommé (remplace/complète `healFrac`).
   * - mana (Pyromancien/Cryomancien/Arcaniste) : coût fixe, se régénère
   *   passivement à chaque tour (+15) quelle que soit l'action — gestion de
   *   ressource par patience plutôt que réactive comme la rage/le combo.
   * - sap/Sève (Druide) : consomme TOUTE la Sève (doit avoir au moins `cost`),
   *   se charge quand les Épines renvoient des dégâts au monstre — récompense
   *   un jeu défensif (encaisser pour riposter plus fort, pas juste survivre).
   * - zeal/Ferveur (Paladin) : coût fixe, se charge quand SON PROPRE bouclier
   *   (Rempart) absorbe un coup — récompense le fait de se protéger activement,
   *   pas juste d'encaisser (contrairement à la Rage brute).
   * - tempo (Barde) : coût fixe, se charge en ALTERNANT les actions (jouer une
   *   action différente du tour précédent) — récompense la variété plutôt que
   *   le bourrinage d'un seul bouton.
   * - overcharge (Arcaniste) : coût fixe, se charge à chaque compétence lancée
   *   (n'importe laquelle, pas l'attaque de base) — récompense le rythme rapide
   *   de sorts propre à l'archétype, contrairement au mana qui régénère seul.
   * - instinct (Chasseur) : coût fixe, se charge quand un coup CRIT — récompense
   *   l'investissement dans le critique (Concentration) plutôt que le simple
   *   fait de taper, façon "le tir parfait se prépare".
   * - corruption (Chevalier Noir) : coût fixe, se charge en infligeant des
   *   dégâts UNIQUEMENT sous 30% PV (même seuil que Douleur) — récompense le
   *   fait de frapper au bord de la mort plutôt que de simplement encaisser.
   */
  resource?: { type: 'rage' | 'combo' | 'grace' | 'mana' | 'sap' | 'zeal' | 'tempo' | 'overcharge' | 'instinct' | 'corruption'; cost: number; scalePerPoint?: number };
}

/** Type de ressource passive accumulée par archétype (pilote : Berserker = rage, Chevalier Noir = corruption, Voleur/Moine = combo, Prêtre de l'Aube = grâce, Pyro/Cryo = mana, Druide = sève, Paladin = ferveur, Barde = tempo, Arcaniste = surcharge, Chasseur = instinct). */
export function classResourceType(classId: ClassId): 'rage' | 'combo' | 'grace' | 'mana' | 'sap' | 'zeal' | 'tempo' | 'overcharge' | 'instinct' | 'corruption' | null {
  if (classId === 'berserker') return 'rage';
  if (classId === 'dark_knight') return 'corruption';
  if (classId === 'rogue' || classId === 'monk') return 'combo';
  if (classId === 'pyromancer' || classId === 'cryomancer') return 'mana';
  if (classId === 'druid') return 'sap';
  if (classId === 'paladin') return 'zeal';
  if (classId === 'bard') return 'tempo';
  if (classId === 'arcanist') return 'overcharge';
  if (classId === 'dawn_priest') return 'grace';
  if (classId === 'hunter') return 'instinct';
  return null;
}

/** Fiche descriptive de chaque ressource d'archétype (icône/nom/couleur/déclencheur), pour l'affichage (Wiki, HUD de combat). */
export const RESOURCE_INFO: Record<string, { icon: string; name: string; color: string; desc: string }> = {
  rage: { icon: '🔥', name: 'Rage', color: '#f97316', desc: 'Se charge en encaissant des coups.' },
  combo: { icon: '⚡', name: 'Combo', color: '#d946ef', desc: 'Se charge de +1 à chaque coup porté (max 5 points).' },
  grace: { icon: '✨', name: 'Grâce', color: '#38bdf8', desc: 'Se charge en soignant (soi ou l\'équipe).' },
  mana: { icon: '🔷', name: 'Mana', color: '#3b82f6', desc: 'Se régénère passivement chaque tour, quelle que soit l\'action.' },
  sap: { icon: '🌿', name: 'Sève', color: '#84cc16', desc: 'Se charge quand les Épines renvoient des dégâts au monstre.' },
  zeal: { icon: '🕊️', name: 'Ferveur', color: '#fbbf24', desc: 'Se charge uniquement quand ton propre bouclier (Rempart) absorbe un coup.' },
  tempo: { icon: '🎵', name: 'Tempo', color: '#ec4899', desc: 'Se charge en alternant tes actions (jouer autre chose que le tour précédent).' },
  overcharge: { icon: '🌌', name: 'Surcharge', color: '#6366f1', desc: 'Se charge à chaque compétence lancée (n\'importe laquelle).' },
  instinct: { icon: '🎯', name: 'Traque', color: '#22d3ee', desc: 'Se charge quand un coup CRIT.' },
  corruption: { icon: '💀', name: 'Corruption', color: '#7c3aed', desc: 'Se charge en infligeant des dégâts uniquement sous 30% PV.' },
};

export interface TalentDef {
  id: string;
  classId: ClassId;
  name: string;
  icon: string;
  desc: string;
  maxRank: number;
  requires?: string[];
  pos: { x: number; y: number };
  perRank?: Partial<CombatMods>;
  activeSkill?: ActiveSkillDef;
}

export const TALENTS: TalentDef[] = [
  // --- WARRIOR BASE ---
  { id: 'w_armor', classId: 'warrior', name: 'Peau de fer', icon: '🛡️', desc: '-5% dégâts subis par rang.', maxRank: 3, pos: { x: 0, y: 0 }, perRank: { dmgReduction: 0.05 } },
  { id: 'w_vigor', classId: 'warrior', name: 'Robustesse', icon: '❤️', desc: '+5% PV max par rang.', maxRank: 3, requires: ['w_armor'], pos: { x: -1, y: 1 }, perRank: { hpPct: 0.05 } },
  { id: 'w_crit', classId: 'warrior', name: 'Frappe brutale', icon: '💥', desc: '+5% critique par rang.', maxRank: 3, requires: ['w_armor'], pos: { x: 1, y: 1 }, perRank: { crit: 0.05 } },
  { id: 'w_skill_hero', classId: 'warrior', name: 'Coup héroïque', icon: '⚔️', desc: 'Compétence : Attaque lourde (×1.8).', maxRank: 1, requires: ['w_vigor', 'w_crit'], pos: { x: 0, y: 2 }, activeSkill: { id: 'skill_hero', name: 'Coup héroïque', icon: '⚔️', desc: 'Inflige ×1.8 dégâts.', cooldownMs: 15_000, type: 'attack', mult: 1.8 } },
  // Paladin
  { id: 'pal_shield', classId: 'paladin', name: 'Rempart', icon: '🔰', desc: 'Compétence : Bouclier sacré (+20% PV max) et provoque le monstre.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_pal_shield', name: 'Rempart', icon: '🔰', desc: 'Génère un bouclier (20% PV) et force l\'aggro sur toi (donjon).', cooldownMs: 25_000, type: 'shield', shield: 0.20, taunt: true } },
  { id: 'pal_regen', classId: 'paladin', name: 'Lumière', icon: '✨', desc: '+10 régén/tour par rang.', maxRank: 3, requires: ['pal_shield'], pos: { x: 0, y: 4 }, perRank: { regen: 10 } },
  { id: 'pal_skill_smite', classId: 'paladin', name: 'Châtiment', icon: '⚡', desc: 'Compétence : Dégâts sacrés (×2.0) et petit soin. Coûte 40 Ferveur (se charge quand Rempart absorbe un coup).', maxRank: 1, requires: ['pal_regen'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_pal_smite', name: 'Châtiment', icon: '⚡', desc: '×2.0 dégâts, +5% soin. Coûte 40 Ferveur.', cooldownMs: 3_000, type: 'attack', mult: 2.0, healFrac: 0.05, resource: { type: 'zeal', cost: 40 } } },
  // Berserker
  { id: 'ber_rage', classId: 'berserker', name: 'Fureur', icon: '😤', desc: 'Compétence : Frappe frénétique (×2.5).', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_ber_rage', name: 'Fureur', icon: '😤', desc: 'Inflige ×2.5 dégâts.', cooldownMs: 18_000, type: 'attack', mult: 2.5 } },
  { id: 'ber_life', classId: 'berserker', name: 'Soif de sang', icon: '🩸', desc: '+5% vol de vie par rang.', maxRank: 3, requires: ['ber_rage'], pos: { x: 0, y: 4 }, perRank: { lifesteal: 0.05 } },
  { id: 'ber_skill_execute', classId: 'berserker', name: 'Exécution', icon: '☠️', desc: 'Compétence : Frappe mortelle (×2.8). Coûte 50 Rage (se charge en encaissant des coups).', maxRank: 1, requires: ['ber_life'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_ber_execute', name: 'Exécution', icon: '☠️', desc: 'Inflige ×2.8 dégâts. Coûte 50 Rage.', cooldownMs: 3_000, type: 'attack', mult: 2.8, resource: { type: 'rage', cost: 50 } } },
  // Dark Knight
  { id: 'dk_shadow', classId: 'dark_knight', name: 'Ombre', icon: '🌑', desc: 'Compétence : Frappe ténébreuse (×2.2).', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_dk_shadow', name: 'Ombre', icon: '🌑', desc: 'Inflige ×2.2 dégâts.', cooldownMs: 16_000, type: 'attack', mult: 2.2 } },
  { id: 'dk_pain', classId: 'dark_knight', name: 'Douleur', icon: '💢', desc: '+10% dégâts sous 30% PV par rang.', maxRank: 3, requires: ['dk_shadow'], pos: { x: 0, y: 4 }, perRank: { berserkBonus: 0.10 } },
  { id: 'dk_skill_drain', classId: 'dark_knight', name: 'Drain Noir', icon: '🧛', desc: 'Compétence : ×2.0 dégâts + 15% soin. Coûte 45 Corruption (se charge en frappant sous 30% PV).', maxRank: 1, requires: ['dk_pain'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_dk_drain', name: 'Drain Noir', icon: '🧛', desc: '×2.0 dégâts, soigne 15%. Coûte 45 Corruption.', cooldownMs: 3_000, type: 'attack', mult: 2.0, healFrac: 0.15, resource: { type: 'corruption', cost: 45 } } },

  // --- MAGE BASE ---
  { id: 'm_focus', classId: 'mage', name: 'Focalisation', icon: '🧠', desc: '+5% ATK par rang.', maxRank: 3, pos: { x: 0, y: 0 }, perRank: { atkPct: 0.05 } },
  { id: 'm_crit', classId: 'mage', name: 'Pyromancie', icon: '🔥', desc: '+5% critique par rang.', maxRank: 3, requires: ['m_focus'], pos: { x: -1, y: 1 }, perRank: { crit: 0.05 } },
  { id: 'm_pen', classId: 'mage', name: 'Rupture', icon: '⚡', desc: '+6% pénétration d\'armure par rang.', maxRank: 3, requires: ['m_focus'], pos: { x: 1, y: 1 }, perRank: { armorPen: 0.06 } },
  { id: 'm_skill_meteor', classId: 'mage', name: 'Météore', icon: '☄️', desc: 'Compétence : ×2.2 dégâts.', maxRank: 1, requires: ['m_crit', 'm_pen'], pos: { x: 0, y: 2 }, activeSkill: { id: 'skill_meteor', name: 'Météore', icon: '☄️', desc: 'Inflige ×2.2 dégâts.', cooldownMs: 20_000, type: 'attack', mult: 2.2 } },
  // Pyromancer
  { id: 'pyro_fireball', classId: 'pyromancer', name: 'Boule de feu', icon: '🔥', desc: 'Compétence : ×2.5 dégâts.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_pyro_fb', name: 'Boule de feu', icon: '🔥', desc: '×2.5 dégâts + Brûlure (3 tours).', cooldownMs: 15_000, type: 'attack', mult: 2.5, status: { type: 'burn', turns: 3, pow: 0.4 } } },
  { id: 'pyro_burn', classId: 'pyromancer', name: 'Brûlure', icon: '🌋', desc: '+0.2 multiplicateur crit par rang.', maxRank: 3, requires: ['pyro_fireball'], pos: { x: 0, y: 4 }, perRank: { critMult: 0.2 } },
  { id: 'pyro_skill_inferno', classId: 'pyromancer', name: 'Enfer', icon: '🔥', desc: 'Compétence : ×3.2 dégâts. Coûte 40 Mana (régénère +15/tour).', maxRank: 1, requires: ['pyro_burn'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_pyro_inferno', name: 'Enfer', icon: '🔥', desc: '×3.2 dégâts + forte Brûlure (4 tours). Coûte 40 Mana.', cooldownMs: 3_000, type: 'attack', mult: 3.2, status: { type: 'burn', turns: 4, pow: 0.6 }, resource: { type: 'mana', cost: 40 } } },
  // Cryomancer
  { id: 'cryo_ice', classId: 'cryomancer', name: 'Éclat de glace', icon: '❄️', desc: 'Compétence : ×1.8 dégâts.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_cryo_ice', name: 'Éclat de glace', icon: '❄️', desc: '×1.8 dégâts + Gel (2 tours).', cooldownMs: 12_000, type: 'attack', mult: 1.8, status: { type: 'chill', turns: 2 } } },
  { id: 'cryo_shield', classId: 'cryomancer', name: 'Armure de givre', icon: '🛡️', desc: '-6% dégâts subis par rang.', maxRank: 3, requires: ['cryo_ice'], pos: { x: 0, y: 4 }, perRank: { dmgReduction: 0.06 } },
  { id: 'cryo_skill_blizzard', classId: 'cryomancer', name: 'Blizzard', icon: '🌨️', desc: 'Compétence : ×2.0 dégâts + 15% Bouclier. Coûte 40 Mana (régénère +15/tour).', maxRank: 1, requires: ['cryo_shield'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_cryo_blizzard', name: 'Blizzard', icon: '🌨️', desc: '×2.0 dégâts, Bouclier 15% + Gel (2 tours). Coûte 40 Mana.', cooldownMs: 3_000, type: 'attack', mult: 2.0, shield: 0.15, status: { type: 'chill', turns: 2 }, resource: { type: 'mana', cost: 40 } } },
  // Arcanist
  { id: 'arc_missile', classId: 'arcanist', name: 'Missile arcanique', icon: '✨', desc: 'Compétence : ×1.5 dégâts (faible cooldown).', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_arc_missile', name: 'Missile arcanique', icon: '✨', desc: 'Inflige ×1.5 dégâts.', cooldownMs: 8_000, type: 'attack', mult: 1.5 } },
  { id: 'arc_mind', classId: 'arcanist', name: 'Esprit clair', icon: '🧠', desc: '+6% ATK par rang.', maxRank: 3, requires: ['arc_missile'], pos: { x: 0, y: 4 }, perRank: { atkPct: 0.06 } },
  { id: 'arc_skill_time', classId: 'arcanist', name: 'Distorsion', icon: '⏳', desc: 'Compétence : ×2.0 dégâts + accélère le temps (-2 tours de recharge sur tes autres compétences). Coûte 50 Surcharge (se charge à chaque compétence lancée).', maxRank: 1, requires: ['arc_mind'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_arc_time', name: 'Distorsion', icon: '⏳', desc: '×2.0 dégâts, réduit les autres cooldowns de 2 tours. Coûte 50 Surcharge.', cooldownMs: 3_000, type: 'attack', mult: 2.0, haste: 2, resource: { type: 'overcharge', cost: 50 } } },

  // --- ARCHER BASE ---
  { id: 'a_aim', classId: 'archer', name: 'Visée', icon: '🎯', desc: '+5% critique par rang.', maxRank: 3, pos: { x: 0, y: 0 }, perRank: { crit: 0.05 } },
  { id: 'a_double', classId: 'archer', name: 'Tir double', icon: '🏹', desc: '+5% double frappe par rang.', maxRank: 3, requires: ['a_aim'], pos: { x: -1, y: 1 }, perRank: { doubleHit: 0.05 } },
  { id: 'a_step', classId: 'archer', name: 'Foulée', icon: '💨', desc: '+5% esquive par rang.', maxRank: 3, requires: ['a_aim'], pos: { x: 1, y: 1 }, perRank: { dodge: 0.05 } },
  { id: 'a_skill_rain', classId: 'archer', name: 'Pluie de flèches', icon: '🌧️', desc: 'Compétence : ×1.9 dégâts.', maxRank: 1, requires: ['a_double', 'a_step'], pos: { x: 0, y: 2 }, activeSkill: { id: 'skill_rain', name: 'Pluie de flèches', icon: '🌧️', desc: 'Inflige ×1.9 dégâts.', cooldownMs: 18_000, type: 'attack', mult: 1.9 } },
  // Rogue
  { id: 'rog_stab', classId: 'rogue', name: 'Poignard', icon: '🗡️', desc: 'Compétence : ×2.2 dégâts.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_rog_stab', name: 'Poignard', icon: '🗡️', desc: '×2.2 dégâts + Poison (2 tours).', cooldownMs: 14_000, type: 'attack', mult: 2.2, status: { type: 'poison', turns: 2, pow: 0.3 } } },
  { id: 'rog_evade', classId: 'rogue', name: 'Fantôme', icon: '👻', desc: '+5% esquive par rang.', maxRank: 3, requires: ['rog_stab'], pos: { x: 0, y: 4 }, perRank: { dodge: 0.05 } },
  { id: 'rog_skill_assassinate', classId: 'rogue', name: 'Assassinat', icon: '☠️', desc: 'Compétence : dégâts croissants avec le Combo (min. 3 points, consomme tout) + chapardage d\'or.', maxRank: 1, requires: ['rog_evade'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_rog_assassinate', name: 'Assassinat', icon: '☠️', desc: 'Consomme tout ton Combo (min. 3) : dégâts croissants + vole de l\'or à la cible.', cooldownMs: 3_000, type: 'attack', mult: 1.0, goldSteal: 0.6, resource: { type: 'combo', cost: 3, scalePerPoint: 0.4 } } },
  // Bard
  { id: 'brd_song', classId: 'bard', name: 'Chant', icon: '🎵', desc: 'Compétence : ×1.5 dégâts + Soin (10%).', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_brd_song', name: 'Chant', icon: '🎵', desc: '×1.5 dégâts, +10% soin.', cooldownMs: 18_000, type: 'attack', mult: 1.5, healFrac: 0.10 } },
  { id: 'brd_inspire', classId: 'bard', name: 'Inspiration', icon: '✨', desc: '+5% ATK/DEF par rang.', maxRank: 3, requires: ['brd_song'], pos: { x: 0, y: 4 }, perRank: { atkPct: 0.05, defPct: 0.05 } },
  { id: 'brd_skill_crescendo', classId: 'bard', name: 'Crescendo', icon: '🎶', desc: 'Compétence : ×2.3 dégâts + rallie l\'équipe (+15% ATK, tout le combat). Coûte 60 Tempo (se charge en alternant tes actions).', maxRank: 1, requires: ['brd_inspire'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_brd_crescendo', name: 'Crescendo', icon: '🎶', desc: '×2.3 dégâts, +15% ATK pour toi (et l\'équipe en donjon/abysses). Coûte 60 Tempo.', cooldownMs: 3_000, type: 'attack', mult: 2.3, teamAtkBuff: 0.15, resource: { type: 'tempo', cost: 60 } } },
  // Hunter
  { id: 'hnt_pet', classId: 'hunter', name: 'Morsure', icon: '🐺', desc: 'Compétence : ×2.0 dégâts + affaiblit la cible (-25% ATK, 3 tours).', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_hnt_pet', name: 'Morsure', icon: '🐺', desc: '×2.0 dégâts, la morsure de ton familier affaiblit (-25% ATK, 3 tours).', cooldownMs: 15_000, type: 'attack', mult: 2.0, status: { type: 'weaken', turns: 3, pow: 0.25 } } },
  { id: 'hnt_pierce', classId: 'hunter', name: 'Perce-cœur', icon: '💔', desc: '+7% pénétration d\'armure par rang.', maxRank: 3, requires: ['hnt_pet'], pos: { x: 0, y: 4 }, perRank: { armorPen: 0.07 } },
  { id: 'hnt_skill_snipe', classId: 'hunter', name: 'Tir de précision', icon: '🎯', desc: 'Compétence : ×2.5 dégâts. Coûte 60 Traque (se charge quand un coup CRIT).', maxRank: 1, requires: ['hnt_pierce'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_hnt_snipe', name: 'Tir de précision', icon: '🎯', desc: 'Inflige ×2.5 dégâts. Coûte 60 Traque.', cooldownMs: 3_000, type: 'attack', mult: 2.5, resource: { type: 'instinct', cost: 60 } } },

  // --- HEALER BASE ---
  { id: 'h_vitality', classId: 'healer', name: 'Vitalité', icon: '❤️‍🩹', desc: '+5% PV max par rang.', maxRank: 3, pos: { x: 0, y: 0 }, perRank: { hpPct: 0.05 } },
  { id: 'h_regen', classId: 'healer', name: 'Régénération', icon: '💚', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['h_vitality'], pos: { x: -1, y: 1 }, perRank: { regen: 4 } },
  { id: 'h_bless', classId: 'healer', name: 'Bénédiction', icon: '🙏', desc: '-5% dégâts subis par rang.', maxRank: 3, requires: ['h_vitality'], pos: { x: 1, y: 1 }, perRank: { dmgReduction: 0.05 } },
  { id: 'h_skill_smite', classId: 'healer', name: 'Châtiment', icon: '⚡', desc: 'Compétence : ×1.5 dégâts + Soin (10%).', maxRank: 1, requires: ['h_regen', 'h_bless'], pos: { x: 0, y: 2 }, activeSkill: { id: 'skill_h_smite', name: 'Châtiment', icon: '⚡', desc: '×1.5 dégâts, +10% soin.', cooldownMs: 18_000, type: 'attack', mult: 1.5, healFrac: 0.10 } },
  // Dawn Priest
  { id: 'dp_heal', classId: 'dawn_priest', name: 'Lumière sacrée', icon: '✨', desc: 'Compétence : Soigne 22% PV.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_dp_heal', name: 'Lumière sacrée', icon: '✨', desc: 'Soigne 22% PV.', cooldownMs: 20_000, type: 'heal', healFrac: 0.22 } },
  { id: 'dp_faith', classId: 'dawn_priest', name: 'Foi', icon: '✝️', desc: '+6% DEF par rang.', maxRank: 3, requires: ['dp_heal'], pos: { x: 0, y: 4 }, perRank: { defPct: 0.06 } },
  { id: 'dp_skill_nova', classId: 'dawn_priest', name: 'Nova sacrée', icon: '🌟', desc: 'Compétence : ×1.6 dégâts + soin croissant avec la Grâce (min. 30, consomme tout — jusqu\'à un vrai heal massif).', maxRank: 1, requires: ['dp_faith'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_dp_nova', name: 'Nova sacrée', icon: '🌟', desc: '×1.6 dégâts. Consomme toute ta Grâce (min. 30) : soin massif proportionnel.', cooldownMs: 3_000, type: 'attack', mult: 1.6, healFrac: 0.20, resource: { type: 'grace', cost: 30, scalePerPoint: 0.006 } } },
  // Druid
  { id: 'dru_thorns', classId: 'druid', name: 'Épines', icon: '🌿', desc: '+6% renvoi dégâts par rang.', maxRank: 3, pos: { x: 0, y: 3 }, perRank: { thorns: 0.06 } },
  { id: 'dru_skill_wrath', classId: 'druid', name: 'Colère', icon: '🌪️', desc: 'Compétence : ×2.0 dégâts + Poison. Coûte 40 Sève (se charge quand les Épines renvoient des dégâts).', maxRank: 1, requires: ['dru_thorns'], pos: { x: 0, y: 4 }, activeSkill: { id: 'skill_dru_wrath', name: 'Colère', icon: '🌪️', desc: '×2.0 dégâts + Poison (3 tours). Coûte 40 Sève.', cooldownMs: 3_000, type: 'attack', mult: 2.0, status: { type: 'poison', turns: 3, pow: 0.35 }, resource: { type: 'sap', cost: 40 } } },
  { id: 'dru_skill_bloom', classId: 'druid', name: 'Floraison', icon: '🌸', desc: 'Compétence : Soigne 25% PV.', maxRank: 1, requires: ['dru_skill_wrath'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_dru_bloom', name: 'Floraison', icon: '🌸', desc: 'Soigne 25% PV.', cooldownMs: 25_000, type: 'heal', healFrac: 0.25 } },
  // Monk
  { id: 'mnk_punch', classId: 'monk', name: 'Poing de fer', icon: '🥊', desc: 'Compétence : ×1.8 dégâts.', maxRank: 1, pos: { x: 0, y: 3 }, activeSkill: { id: 'skill_mnk_punch', name: 'Poing de fer', icon: '🥊', desc: 'Inflige ×1.8 dégâts.', cooldownMs: 14_000, type: 'attack', mult: 1.8 } },
  { id: 'mnk_chi', classId: 'monk', name: 'Chi', icon: '☯️', desc: '+5% vol de vie par rang.', maxRank: 3, requires: ['mnk_punch'], pos: { x: 0, y: 4 }, perRank: { lifesteal: 0.05 } },
  { id: 'mnk_skill_dragon', classId: 'monk', name: 'Coup du Dragon', icon: '🐉', desc: 'Compétence : dégâts croissants avec le Combo (min. 3 points, consomme tout).', maxRank: 1, requires: ['mnk_chi'], pos: { x: 0, y: 5 }, activeSkill: { id: 'skill_mnk_dragon', name: 'Coup du Dragon', icon: '🐉', desc: 'Consomme tout ton Combo (min. 3) : dégâts croissants.', cooldownMs: 3_000, type: 'attack', mult: 1.0, resource: { type: 'combo', cost: 3, scalePerPoint: 0.35 } } },

  // --- Extensions d'arbre de base (profondeur : forcent la spécialisation) ---
  { id: 'w_might', classId: 'warrior', name: 'Puissance', icon: '💪', desc: '+5% ATK par rang.', maxRank: 3, requires: ['w_armor'], pos: { x: 0, y: 1 }, perRank: { atkPct: 0.05 } },
  { id: 'w_bulwark', classId: 'warrior', name: 'Contre-attaque', icon: '🔩', desc: '+4% renvoi de dégâts par rang.', maxRank: 3, requires: ['w_vigor'], pos: { x: -2, y: 2 }, perRank: { thorns: 0.04 } },
  { id: 'm_ward', classId: 'mage', name: 'Ward', icon: '🔵', desc: '+4% PV max par rang.', maxRank: 3, requires: ['m_focus'], pos: { x: 0, y: 1 }, perRank: { hpPct: 0.04 } },
  { id: 'm_overload', classId: 'mage', name: 'Surcharge', icon: '💫', desc: '+0.15 multiplicateur de critique par rang.', maxRank: 3, requires: ['m_crit'], pos: { x: -2, y: 2 }, perRank: { critMult: 0.15 } },
  { id: 'a_hawk', classId: 'archer', name: 'Œil de faucon', icon: '🦅', desc: '+5% pénétration d\'armure par rang.', maxRank: 3, requires: ['a_aim'], pos: { x: 0, y: 1 }, perRank: { armorPen: 0.05 } },
  { id: 'a_lethal', classId: 'archer', name: 'Précision létale', icon: '🎯', desc: '+3 dégâts plats par rang.', maxRank: 3, requires: ['a_double'], pos: { x: -2, y: 2 }, perRank: { flatDmg: 3 } },
  { id: 'h_grace', classId: 'healer', name: 'Grâce', icon: '🕊️', desc: '+5% DEF par rang.', maxRank: 3, requires: ['h_vitality'], pos: { x: 0, y: 1 }, perRank: { defPct: 0.05 } },
  { id: 'h_zeal', classId: 'healer', name: 'Ferveur', icon: '🔆', desc: '+3 régén/tour par rang.', maxRank: 3, requires: ['h_bless'], pos: { x: -2, y: 2 }, perRank: { regen: 3 } },

  // --- Passifs de spécialisation (profondeur d'ascension) ---
  { id: 'pal_aegis', classId: 'paladin', name: 'Égide', icon: '🛡️', desc: '-5% dégâts subis par rang.', maxRank: 3, requires: ['pal_shield'], pos: { x: -2, y: 4 }, perRank: { dmgReduction: 0.05 } },
  { id: 'ber_frenzy', classId: 'berserker', name: 'Frénésie', icon: '💥', desc: '+5% critique par rang.', maxRank: 3, requires: ['ber_rage'], pos: { x: -2, y: 4 }, perRank: { crit: 0.05 } },
  { id: 'dk_dread', classId: 'dark_knight', name: 'Effroi', icon: '🧛', desc: '+5% vol de vie par rang.', maxRank: 3, requires: ['dk_shadow'], pos: { x: -2, y: 4 }, perRank: { lifesteal: 0.05 } },
  { id: 'pyro_heat', classId: 'pyromancer', name: 'Fournaise', icon: '🌡️', desc: '+5% ATK par rang.', maxRank: 3, requires: ['pyro_fireball'], pos: { x: -2, y: 4 }, perRank: { atkPct: 0.05 } },
  { id: 'cryo_frost', classId: 'cryomancer', name: 'Endurance glaciale', icon: '🧊', desc: '+5% PV max par rang.', maxRank: 3, requires: ['cryo_ice'], pos: { x: -2, y: 4 }, perRank: { hpPct: 0.05 } },
  { id: 'arc_flow', classId: 'arcanist', name: 'Flux', icon: '🌀', desc: '+5% double lancer par rang.', maxRank: 3, requires: ['arc_missile'], pos: { x: -2, y: 4 }, perRank: { doubleHit: 0.05 } },
  { id: 'rog_venom', classId: 'rogue', name: 'Venin', icon: '🐍', desc: '+6% pénétration d\'armure par rang.', maxRank: 3, requires: ['rog_stab'], pos: { x: -2, y: 4 }, perRank: { armorPen: 0.06 } },
  { id: 'brd_harmony', classId: 'bard', name: 'Harmonie', icon: '🎼', desc: '+5% PV max par rang.', maxRank: 3, requires: ['brd_song'], pos: { x: -2, y: 4 }, perRank: { hpPct: 0.05 } },
  { id: 'hnt_focus', classId: 'hunter', name: 'Concentration', icon: '🎯', desc: '+5% critique par rang.', maxRank: 3, requires: ['hnt_pet'], pos: { x: -2, y: 4 }, perRank: { crit: 0.05 } },
  { id: 'dp_ward', classId: 'dawn_priest', name: 'Sanctuaire', icon: '⛪', desc: '-5% dégâts subis par rang.', maxRank: 3, requires: ['dp_heal'], pos: { x: -2, y: 4 }, perRank: { dmgReduction: 0.05 } },
  { id: 'dru_growth', classId: 'druid', name: 'Croissance', icon: '🌱', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['dru_thorns'], pos: { x: -2, y: 4 }, perRank: { regen: 4 } },
  { id: 'mnk_flow', classId: 'monk', name: 'Souffle', icon: '💨', desc: '+5% esquive par rang.', maxRank: 3, requires: ['mnk_punch'], pos: { x: -2, y: 4 }, perRank: { dodge: 0.05 } },

  // --- 2e compétence de base par classe (accessible avant l'ascension) ---
  { id: 'w_skill_cleave', classId: 'warrior', name: 'Fendoir', icon: '🪓', desc: 'Compétence : ×1.7 dégâts + brise l\'armure (-20% DEF, 3 tours).', maxRank: 1, requires: ['w_might'], pos: { x: 2, y: 2 }, activeSkill: { id: 'skill_cleave', name: 'Fendoir', icon: '🪓', desc: '×1.7 dégâts, fend l\'armure de la cible (-20% DEF, 3 tours).', cooldownMs: 12_000, type: 'attack', mult: 1.7, status: { type: 'armorBreak', turns: 3, pow: 0.20 } } },
  { id: 'm_skill_frost', classId: 'mage', name: 'Trait de givre', icon: '❄️', desc: 'Compétence : ×1.6 dégâts + Gel (2 tours).', maxRank: 1, requires: ['m_ward'], pos: { x: 2, y: 2 }, activeSkill: { id: 'skill_frostbolt', name: 'Trait de givre', icon: '❄️', desc: '×1.6 dégâts + Gel (2 tours).', cooldownMs: 12_000, type: 'attack', mult: 1.6, status: { type: 'chill', turns: 2 } } },
  { id: 'a_skill_venom', classId: 'archer', name: 'Flèche empoisonnée', icon: '🏹', desc: 'Compétence : ×1.6 dégâts + Poison (3 tours).', maxRank: 1, requires: ['a_hawk'], pos: { x: 2, y: 2 }, activeSkill: { id: 'skill_venomshot', name: 'Flèche empoisonnée', icon: '🏹', desc: '×1.6 dégâts + Poison (3 tours).', cooldownMs: 14_000, type: 'attack', mult: 1.6, status: { type: 'poison', turns: 3, pow: 0.3 } } },
  { id: 'h_skill_heal', classId: 'healer', name: 'Soin', icon: '💗', desc: 'Compétence : soigne 20% des PV max.', maxRank: 1, requires: ['h_grace'], pos: { x: 2, y: 2 }, activeSkill: { id: 'skill_heal', name: 'Soin', icon: '💗', desc: 'Soigne 20% PV.', cooldownMs: 16_000, type: 'heal', healFrac: 0.20 } },

  // --- Passifs avancés (end-game, niv.30+) — permettent d'absorber les points en excès ---
  // Guerrier
  { id: 'w_endure', classId: 'warrior', name: 'Endurance', icon: '💪', desc: '+3% PV max par rang.', maxRank: 5, requires: ['w_might'], pos: { x: 2, y: 2 }, perRank: { hpPct: 0.03 } },
  { id: 'w_mastery', classId: 'warrior', name: 'Maîtrise guerrière', icon: '⚔️', desc: '+3% ATK par rang.', maxRank: 5, requires: ['w_bulwark'], pos: { x: -2, y: 3 }, perRank: { atkPct: 0.03 } },
  // Mage
  { id: 'm_arcana', classId: 'mage', name: 'Arcane profonde', icon: '✨', desc: '+3% ATK par rang.', maxRank: 5, requires: ['m_overload'], pos: { x: -2, y: 3 }, perRank: { atkPct: 0.03 } },
  { id: 'm_resilience', classId: 'mage', name: 'Résilience', icon: '🛡️', desc: '+3% PV max par rang.', maxRank: 5, requires: ['m_ward'], pos: { x: 2, y: 2 }, perRank: { hpPct: 0.03 } },
  // Archer
  { id: 'a_swiftness', classId: 'archer', name: 'Agilité', icon: '💨', desc: '+3% esquive par rang.', maxRank: 5, requires: ['a_lethal'], pos: { x: -2, y: 3 }, perRank: { dodge: 0.03 } },
  { id: 'a_sharpshoot', classId: 'archer', name: 'Tir maîtrisé', icon: '🎯', desc: '+3% critique par rang.', maxRank: 5, requires: ['a_hawk'], pos: { x: 2, y: 2 }, perRank: { crit: 0.03 } },
  // Soigneur
  { id: 'h_endurance', classId: 'healer', name: 'Endurance sacrée', icon: '💪', desc: '+3% PV max par rang.', maxRank: 5, requires: ['h_zeal'], pos: { x: -2, y: 3 }, perRank: { hpPct: 0.03 } },
  { id: 'h_devotion', classId: 'healer', name: 'Dévotion', icon: '💙', desc: '+3% DEF par rang.', maxRank: 5, requires: ['h_grace'], pos: { x: 2, y: 3 }, perRank: { defPct: 0.03 } },
  // Moine (passifs spécifiques end-game)
  { id: 'mnk_iron_skin', classId: 'monk', name: 'Peau de fer', icon: '🛡️', desc: '+3% DEF par rang.', maxRank: 5, requires: ['mnk_flow'], pos: { x: -2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'mnk_fury', classId: 'monk', name: 'Furie martiale', icon: '🥊', desc: '+3% ATK par rang.', maxRank: 5, requires: ['mnk_chi'], pos: { x: 2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'mnk_zen', classId: 'monk', name: 'Zenith', icon: '☯️', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['mnk_skill_dragon'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Druide
  { id: 'dru_bark', classId: 'druid', name: 'Écorce naturelle', icon: '🌳', desc: '+3% DEF par rang.', maxRank: 5, requires: ['dru_growth'], pos: { x: -2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'dru_venom', classId: 'druid', name: 'Venin amplifié', icon: '🧪', desc: '+0.1 multiplicateur de poison par rang.', maxRank: 3, requires: ['dru_skill_wrath'], pos: { x: 2, y: 5 }, perRank: { critMult: 0.10 } },
  // Prêtre de l'aube
  { id: 'dp_light', classId: 'dawn_priest', name: 'Lumière divine', icon: '☀️', desc: '+3% ATK par rang.', maxRank: 5, requires: ['dp_ward'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'dp_grace', classId: 'dawn_priest', name: 'Grâce divine', icon: '🌟', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['dp_faith'], pos: { x: 2, y: 5 }, perRank: { regen: 4 } },

  // --- Passifs avancés — sous-classes oubliées du premier passage d'équilibrage.
  // Paladin/Berserker/Dark Knight/Pyromancer/Cryomancer/Arcanist/Rogue/Bard/Hunter
  // n'avaient que 8 rangs de sous-classe (contre 16-21 pour Moine/Druide/Prêtre),
  // laissant ~14 points de talent inutilisables à Nv.50. Même gabarit que le
  // Moine : 2 passifs à 5 rangs + 1 passif à 3 rangs (+13 rangs par sous-classe).
  // Paladin
  { id: 'pal_bulwark', classId: 'paladin', name: 'Rempart de foi', icon: '🛡️', desc: '+3% DEF par rang.', maxRank: 5, requires: ['pal_regen'], pos: { x: -2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'pal_zeal', classId: 'paladin', name: 'Zèle', icon: '🔥', desc: '+3% ATK par rang.', maxRank: 5, requires: ['pal_aegis'], pos: { x: 2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'pal_light', classId: 'paladin', name: 'Lumière éternelle', icon: '✨', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['pal_skill_smite'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Berserker
  { id: 'ber_wrath', classId: 'berserker', name: 'Courroux', icon: '💢', desc: '+3% ATK par rang.', maxRank: 5, requires: ['ber_life'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'ber_bloodlust', classId: 'berserker', name: 'Soif ardente', icon: '🩸', desc: '+2% vol de vie par rang.', maxRank: 5, requires: ['ber_frenzy'], pos: { x: 2, y: 5 }, perRank: { lifesteal: 0.02 } },
  { id: 'ber_scars', classId: 'berserker', name: 'Cicatrices', icon: '❤️‍🩹', desc: '+3% PV max par rang.', maxRank: 3, requires: ['ber_skill_execute'], pos: { x: 0, y: 6 }, perRank: { hpPct: 0.03 } },
  // Dark Knight
  { id: 'dk_curse', classId: 'dark_knight', name: 'Malédiction', icon: '💀', desc: '+3% ATK par rang.', maxRank: 5, requires: ['dk_pain'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'dk_abyss', classId: 'dark_knight', name: 'Abysse', icon: '🕳️', desc: '+3% DEF par rang.', maxRank: 5, requires: ['dk_dread'], pos: { x: 2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'dk_void', classId: 'dark_knight', name: 'Néant', icon: '🌑', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['dk_skill_drain'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Pyromancer
  { id: 'pyro_ember', classId: 'pyromancer', name: 'Braise éternelle', icon: '🔥', desc: '+3% ATK par rang.', maxRank: 5, requires: ['pyro_burn'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'pyro_wildfire', classId: 'pyromancer', name: 'Feu de brousse', icon: '🌋', desc: '+3% PV max par rang.', maxRank: 5, requires: ['pyro_heat'], pos: { x: 2, y: 5 }, perRank: { hpPct: 0.03 } },
  { id: 'pyro_ash', classId: 'pyromancer', name: 'Cendres', icon: '🌫️', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['pyro_skill_inferno'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Cryomancer
  { id: 'cryo_glacier', classId: 'cryomancer', name: 'Glacier', icon: '🧊', desc: '+3% DEF par rang.', maxRank: 5, requires: ['cryo_shield'], pos: { x: -2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'cryo_permafrost', classId: 'cryomancer', name: 'Permafrost', icon: '❄️', desc: '+3% ATK par rang.', maxRank: 5, requires: ['cryo_frost'], pos: { x: 2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'cryo_absolute', classId: 'cryomancer', name: 'Zéro absolu', icon: '🌨️', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['cryo_skill_blizzard'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Arcanist
  { id: 'arc_insight', classId: 'arcanist', name: 'Clairvoyance', icon: '🔮', desc: '+3% ATK par rang.', maxRank: 5, requires: ['arc_mind'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'arc_singularity', classId: 'arcanist', name: 'Singularité', icon: '🌀', desc: '+3% pénétration d\'armure par rang.', maxRank: 5, requires: ['arc_flow'], pos: { x: 2, y: 5 }, perRank: { armorPen: 0.03 } },
  { id: 'arc_paradox', classId: 'arcanist', name: 'Paradoxe', icon: '⏳', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['arc_skill_time'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Rogue
  { id: 'rog_shadows', classId: 'rogue', name: 'Voile d\'ombre', icon: '👤', desc: '+3% esquive par rang.', maxRank: 5, requires: ['rog_evade'], pos: { x: -2, y: 5 }, perRank: { dodge: 0.03 } },
  { id: 'rog_toxin', classId: 'rogue', name: 'Toxine', icon: '🐍', desc: '+3% pénétration d\'armure par rang.', maxRank: 5, requires: ['rog_venom'], pos: { x: 2, y: 5 }, perRank: { armorPen: 0.03 } },
  { id: 'rog_finality', classId: 'rogue', name: 'Point final', icon: '☠️', desc: '+3% critique par rang.', maxRank: 3, requires: ['rog_skill_assassinate'], pos: { x: 0, y: 6 }, perRank: { crit: 0.03 } },
  // Bard
  { id: 'brd_ballad', classId: 'bard', name: 'Ballade', icon: '🎼', desc: '+3% ATK par rang.', maxRank: 5, requires: ['brd_inspire'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'brd_resonance', classId: 'bard', name: 'Résonance', icon: '🎶', desc: '+3% DEF par rang.', maxRank: 5, requires: ['brd_harmony'], pos: { x: 2, y: 5 }, perRank: { defPct: 0.03 } },
  { id: 'brd_encore', classId: 'bard', name: 'Rappel', icon: '👏', desc: '+4 régén/tour par rang.', maxRank: 3, requires: ['brd_skill_crescendo'], pos: { x: 0, y: 6 }, perRank: { regen: 4 } },
  // Hunter
  { id: 'hnt_predator', classId: 'hunter', name: 'Prédateur', icon: '🐾', desc: '+3% ATK par rang.', maxRank: 5, requires: ['hnt_pierce'], pos: { x: -2, y: 5 }, perRank: { atkPct: 0.03 } },
  { id: 'hnt_instinct', classId: 'hunter', name: 'Instinct', icon: '👁️', desc: '+3% esquive par rang.', maxRank: 5, requires: ['hnt_focus'], pos: { x: 2, y: 5 }, perRank: { dodge: 0.03 } },
  { id: 'hnt_kill', classId: 'hunter', name: 'Mise à mort', icon: '🎯', desc: '+3% critique par rang.', maxRank: 3, requires: ['hnt_skill_snipe'], pos: { x: 0, y: 6 }, perRank: { crit: 0.03 } },
];

export function getTalentsForClass(classId: ClassId): TalentDef[] {
  const baseId = CLASSES[classId]?.parent;
  return TALENTS.filter(t => t.classId === classId || t.classId === baseId);
}

export function getAllActiveSkills(): ActiveSkillDef[] {
  const skills: ActiveSkillDef[] = [];
  for (const t of TALENTS) {
    if (t.activeSkill) skills.push(t.activeSkill);
  }
  return skills;
}

export function talentMods(p: PlayerState): CombatMods {
  const mods = emptyMods();
  
  // Base innée selon la classe (on peut garder les bonus pour la V2)
  if (p.classId === 'warrior' || p.classId === 'paladin' || p.classId === 'berserker' || p.classId === 'dark_knight') mods.dmgReduction += 0.1;
  if (p.classId === 'mage' || p.classId === 'pyromancer' || p.classId === 'cryomancer' || p.classId === 'arcanist') mods.crit += 0.06;
  if (p.classId === 'archer' || p.classId === 'rogue' || p.classId === 'bard' || p.classId === 'hunter') mods.doubleHit += 0.06;
  if (p.classId === 'healer' || p.classId === 'dawn_priest' || p.classId === 'druid' || p.classId === 'monk') mods.regen += 5;

  if (p.talents) {
    for (const def of getTalentsForClass(p.classId)) {
      const rank = p.talents[def.id] ?? 0;
      if (rank <= 0 || !def.perRank) continue;
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

export function spendTalent(p: PlayerState, talentId: string): boolean | string {
  if (!p.talents) p.talents = {};
  const def = TALENTS.find((t) => t.id === talentId);
  if (!def) return 'Talent introuvable';
  
  // Vérif classe
  const baseId = CLASSES[p.classId]?.parent;
  if (def.classId !== p.classId && def.classId !== baseId) return 'Mauvaise classe';

  const rank = p.talents[talentId] ?? 0;
  if ((p.talentPoints ?? 0) <= 0) return 'Points insuffisants';
  if (rank >= def.maxRank) return 'Talent au niveau maximum';

  // Vérif dépendances : 1 point investi dans chaque parent suffit à débloquer.
  if (def.requires) {
    for (const reqId of def.requires) {
      if ((p.talents[reqId] ?? 0) < 1) {
        const reqDef = TALENTS.find((t) => t.id === reqId);
        return `Prérequis manquant : ${reqDef?.name ?? reqId}`;
      }
    }
  }

  p.talents[talentId] = rank + 1;
  p.talentPoints -= 1;
  return true;
}

export function resetTalents(p: PlayerState): boolean {
  if (p.gold < 10000) return false;
  p.gold -= 10000;

  // Reset de la sous-classe
  const baseId = CLASSES[p.classId]?.parent;
  if (baseId) {
    p.classId = baseId;
  }

  p.talents = {};
  p.equippedSkills = [];
  p.talentPoints = Math.max(0, p.level - 1);
  return true;
}
