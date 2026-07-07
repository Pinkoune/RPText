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
  /** Paragraphe détaillé (style de jeu, arbre de talents) affiché dans le Wiki. */
  playstyle: string;
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
    playstyle: 'Tank pur, sans détour. Meilleure DEF innée du jeu (-10% dégâts subis dès la création) et la plus grosse réserve de PV. Son arbre mélange réduction de dégâts, PV max et un peu de critique, avec Coup héroïque (×1.8) pour le gros coup et Fendoir (×1.7) qui fend l\'armure de la cible (-20% DEF, 3 tours) — un vrai affaiblissement offensif, pas juste des dégâts. Pas de soin, pas de contrôle exotique : il encaisse, tape régulièrement, et dure.',
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    emoji: '🛡️',
    desc: 'Protecteur de la lumière : -15% dégâts subis et Soins améliorés.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 22, atk: 4, def: 3 },
    parent: 'warrior',
    playstyle: 'Le tank le plus increvable du jeu, et le seul avec un vrai bouton de tank actif : Rempart pose un bouclier (+20% PV max en absorption) ET force l\'aggro du monstre sur lui en donjon (utile même s\'il n\'a pas tapé), Lumière ajoute une grosse régénération passive, et Châtiment (×2.0 + petit soin) lui permet de tenir indéfiniment sans potion. Aucun burst impressionnant, mais une durabilité quasi infinie et un vrai rôle de protecteur d\'équipe.',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    emoji: '🪓',
    desc: 'Rage pure : +15% dégâts, mais plus vulnérable.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 20, atk: 6, def: 1 },
    parent: 'warrior',
    playstyle: 'Tank offensif qui sacrifie la DEF pour la puissance brute. Fureur (×2.5) puis Exécution (×2.8, 30s de CD) sont parmi les plus gros multiplicateurs du jeu, et le vol de vie (jusqu\'à +15%) compense l\'absence de vraie défense. Pas de contrôle ni de soin externe : sa survie vient entièrement des dégâts qu\'il inflige, pas de ceux qu\'il évite.',
  },
  dark_knight: {
    id: 'dark_knight',
    name: 'Chevalier Noir',
    emoji: '🗡️',
    desc: 'Puissance sacrificielle : dégâts massifs basés sur les PV manquants.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 25, atk: 5, def: 2 },
    parent: 'warrior',
    playstyle: 'Tank à risque croissant : Douleur donne jusqu\'à +30% dégâts quand il passe sous 30% PV, donc il devient plus dangereux à l\'agonie. Drain Noir (×2.0 + 15% soin) et le vol de vie passif lui permettent de se maintenir juste assez pour rester dans cette zone dangereuse volontairement. Un style "plus je saigne, plus je frappe fort" — demande de bien gérer sa santé au lieu de la maximiser.',
  },

  // ── Mage ──
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    desc: 'Burst magique : ATK élevée et +6% critique (inné), mais fragile.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 11, atk: 4, def: 1 },
    playstyle: 'DPS magique pur, le plus fragile du jeu (le moins de PV base). Compense par une ATK élevée, +6% critique inné et de la pénétration d\'armure, avec Météore (×2.2) comme finisher. Aucune capacité défensive ou de soin dans son tronc de base : c\'est du glass cannon classique, tout dans les dégâts, rien dans la survie.',
  },
  pyromancer: {
    id: 'pyromancer',
    name: 'Pyromancien',
    emoji: '🔥',
    desc: 'Destruction : ATK colossale et brûlures critiques.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 12, atk: 7, def: 1 },
    parent: 'mage',
    playstyle: 'Le mage offensif par excellence, plus fragile encore que le mage de base mais avec la plus forte croissance d\'ATK du jeu. Boule de feu (×2.5 + brûlure 3 tours) puis Enfer (×3.2 + brûlure renforcée 4 tours) empilent les dégâts sur la durée en plus du burst direct. Dégâts sur la durée + nuke, zéro défense : il doit tuer avant de se faire tuer.',
  },
  cryomancer: {
    id: 'cryomancer',
    name: 'Cryomancien',
    emoji: '❄️',
    desc: 'Contrôle absolu : très résistant pour un mage, sorts de gel.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 15, atk: 5, def: 2 },
    parent: 'mage',
    playstyle: 'Le mage le plus solide, un vrai hybride contrôle/tank pour l\'archétype. Éclat de glace et Blizzard infligent du Gel (ralentit/désavantage l\'ennemi) tout en offrant Armure de givre (réduction de dégâts) et un bouclier (15% PV sur Blizzard) — des outils défensifs rares chez un mage. Moins de burst pur qu\'un Pyromancien, mais bien plus difficile à tuer.',
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcaniste',
    emoji: '🌌',
    desc: 'Maître du temps : compétences à faible coût et dégâts explosifs.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 13, atk: 6, def: 1 },
    parent: 'mage',
    playstyle: 'Le mage au tempo le plus rapide : Missile arcanique n\'a que 8s de recharge (le plus court de toutes les compétences du jeu), ce qui permet de spammer bien plus souvent qu\'ailleurs. Distorsion (×2.0) manipule vraiment le temps : elle réduit de 2 tours le cooldown de toutes ses AUTRES compétences équipées, un vrai effet « accélérateur » plutôt qu\'un simple gros coup. Moins de dégâts par coup individuel, mais une cadence largement supérieure — DPS constant plutôt que pics de burst.',
  },

  // ── Archer ──
  archer: {
    id: 'archer',
    name: 'Archer',
    emoji: '🏹',
    desc: 'Polyvalent : dégâts réguliers et +6% de double frappe (inné).',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 14, atk: 4, def: 1 },
    playstyle: 'Le DPS physique équilibré : stats pile au milieu (ni tanky comme le guerrier, ni fragile comme le mage), +6% de double frappe inné qui double occasionnellement les dégâts d\'un coup normal. Son arbre mélange critique, double frappe et esquive — Pluie de flèches (×1.9) comme finisher. Pas de spécialité extrême, juste une bonne polyvalence offensive/défensive.',
  },
  rogue: {
    id: 'rogue',
    name: 'Voleur',
    emoji: '🗡️',
    desc: 'Ombre mortelle : esquive élevée et dégâts critiques extrêmes.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 15, atk: 6, def: 1 },
    parent: 'archer',
    playstyle: 'Assassin évasif et cupide : Poignard (×2.2 + poison 2 tours) empoisonne avant le vrai finisher, Assassinat (×2.5) vole en plus de l\'or instantanément à la cible en plein combat — indépendant du butin de fin de combat, une vraie mécanique de vol plutôt qu\'un simple gros coup. L\'esquive est sa seule vraie défense (jusqu\'à +18% via Fantôme/Voile d\'ombre), pas de PV ni DEF particuliers — il compte sur le fait de ne pas se faire toucher plutôt que d\'encaisser.',
  },
  bard: {
    id: 'bard',
    name: 'Barde',
    emoji: '🎵',
    desc: 'Soutien musical : buffs passifs pour toute l\'équipe.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 16, atk: 4, def: 2 },
    parent: 'archer',
    playstyle: 'DPS hybride et vrai soutien : Chant (×1.5 + 10% soin) le maintient en vie tout en tapant, Inspiration ajoute de l\'ATK ET de la DEF à la fois (rare de cumuler les deux), Crescendo (×2.3) galvanise en plus tout le groupe (+15% ATK pour le reste du combat) en donjon/abysses coop — en solo le buff profite juste à lui-même. Le seul finisher du jeu qui rend toute l\'équipe plus forte, pas juste lui.',
  },
  hunter: {
    id: 'hunter',
    name: 'Chasseur',
    emoji: '🐺',
    desc: 'Tireur d\'élite : dégâts stables, ignore l\'armure ennemie.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 17, atk: 5, def: 2 },
    parent: 'archer',
    playstyle: 'DPS régulier spécialisé en pénétration d\'armure : Perce-cœur et Concentration cumulent jusqu\'à +21% de pénétration, et Morsure (×2.0) laisse en plus son familier affaiblir la cible (-25% ATK, 3 tours) — un vrai debuff défensif pour l\'équipe, pas juste des dégâts. Tir de précision (×2.5) reste le finisher pur. Sa force est de rester efficace même face aux monstres résistants là où les autres archers perdent en dégâts, tout en protégeant le groupe.',
  },

  // ── Soigneur ──
  healer: {
    id: 'healer',
    name: 'Soigneur',
    emoji: '✨',
    desc: 'Sustain : +5 PV régénérés par tour (inné), increvable.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 18, atk: 3, def: 1 }, // DEF +2→+1, HP +16→+18 (compensation)
    playstyle: 'Le sustain le plus simple et le plus fiable : +5 PV régénérés par tour rien qu\'en existant, plus PV max, DEF et réduction de dégâts en talents. Châtiment (×1.5 + 10% soin) et Soin (20% PV instantané) donnent un peu d\'offense et un vrai bouton de soin d\'urgence. Pas de gimmick particulier — juste très difficile à tuer, tour après tour.',
  },
  dawn_priest: {
    id: 'dawn_priest',
    name: 'Prêtre de l\'Aube',
    emoji: '🌅',
    desc: 'Soigneur pur : boucliers divins et régénération absolue.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 22, atk: 4, def: 1 }, // DEF +3→+1 (était plus défensif que le warrior !), HP +20→+22
    parent: 'healer',
    playstyle: 'Le vrai healer de la famille Soigneur, celui avec les plus gros chiffres de soin : Lumière sacrée (22% PV instantané) puis Nova sacrée (×1.6 + 20% soin) — deux fois plus de soin actif que le Soigneur de base. Défense complémentaire via Foi et Sanctuaire (+DEF et réduction de dégâts). Le moins offensif des quatre sous-classes Soigneur, mais celui qui se soigne (et encaisse) le mieux.',
  },
  druid: {
    id: 'druid',
    name: 'Druide',
    emoji: '🌿',
    desc: 'Force de la nature : renvoi de dégâts et épines.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 22, atk: 5, def: 1 }, // DEF +2→+1
    parent: 'healer',
    playstyle: 'Hybride tank/DoT autosuffisant, pas un vrai soigneur de groupe. Épines renvoie une partie des dégâts subis (passif), Colère (×2.0 + poison 3 tours) saigne l\'ennemi sur la durée plutôt qu\'en un coup, et Floraison est son unique soin : un gros heal instantané (25% PV) plutôt qu\'un soin continu. Plus d\'ATK que le Soigneur de base au prix d\'un peu de sustain passif — pense "combattant de la nature qui encaisse et empoisonne" plutôt que "prêtre qui soigne en continu".',
  },
  monk: {
    id: 'monk',
    name: 'Moine',
    emoji: '📿',
    desc: 'Art martial : inflige des dégâts au corps à corps pour se soigner.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 18, atk: 6, def: 1 }, // DEF +2→+1 (moine = DPS soigneur, pas tank)
    parent: 'healer',
    playstyle: 'Le plus offensif des Soigneurs, un vrai DPS déguisé. Chi donne du vol de vie (se soigne en tapant, pas via un sort), Poing de fer (×1.8) puis Coup du Dragon (×2.0) enchaînent les coups, et Zenith ajoute encore de la régén passive en fin d\'arbre. Pas de bouton de soin dédié comme les autres Soigneurs — sa survie vient entièrement de l\'agressivité (vol de vie + régén), pas d\'un sort de soin.',
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
