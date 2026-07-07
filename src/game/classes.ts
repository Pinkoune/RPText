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
    playstyle: 'Le tank le plus increvable du jeu, et le seul avec un vrai bouton de tank actif : Rempart pose un bouclier (+20% PV max en absorption) ET force l\'aggro du monstre sur lui en donjon (utile même s\'il n\'a pas tapé), Lumière ajoute une grosse régénération passive. Ressource unique — la Ferveur : elle ne se charge PAS en encaissant n\'importe quel coup, mais uniquement quand son PROPRE bouclier absorbe une attaque — récompense la protection active, pas l\'encaissement passif. Châtiment (×2.0 + petit soin) coûte 40 Ferveur. Aucun burst impressionnant, mais une durabilité quasi infinie et un vrai rôle de protecteur d\'équipe.',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    emoji: '🪓',
    desc: 'Rage pure : +15% dégâts, mais plus vulnérable.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 20, atk: 6, def: 1 },
    parent: 'warrior',
    playstyle: 'Tank offensif qui sacrifie la DEF pour la puissance brute. Fureur (×2.5) charge la Rage en encaissant des coups, dépensée sur Exécution (×2.8) qui coûte 50 Rage au lieu d\'un long cooldown — encaisser devient une ressource à gérer, pas juste une contrainte. Le vol de vie (jusqu\'à +15%) compense l\'absence de vraie défense. Pas de contrôle ni de soin externe : sa survie vient entièrement des dégâts qu\'il inflige, pas de ceux qu\'il évite.',
  },
  dark_knight: {
    id: 'dark_knight',
    name: 'Chevalier Noir',
    emoji: '🗡️',
    desc: 'Puissance sacrificielle : dégâts massifs basés sur les PV manquants.',
    base: { maxHp: 130, atk: 13, def: 9 },
    growth: { maxHp: 25, atk: 5, def: 2 },
    parent: 'warrior',
    playstyle: 'Tank à risque croissant : Douleur donne jusqu\'à +30% dégâts quand il passe sous 30% PV, donc il devient plus dangereux à l\'agonie. Ressource unique — la Corruption : contrairement à la Rage (encaisser suffit), elle ne se charge QUE si tu INFLIGES des dégâts sous 30% PV — même seuil que Douleur, les deux se nourrissent ensemble. Drain Noir (×2.0 + 15% soin) coûte 45 Corruption. Un style "plus je saigne en frappant, plus je deviens fort" — demande de rester agressif au bord de la mort, pas juste survivre.',
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
    playstyle: 'Le mage offensif par excellence, plus fragile encore que le mage de base mais avec la plus forte croissance d\'ATK du jeu. Premier mage à jouer sur du Mana (max 100, +15/tour peu importe l\'action) plutôt qu\'un cooldown : Boule de feu (×2.5 + brûlure 3 tours) charge sans contrainte, Enfer (×3.2 + brûlure renforcée) coûte 40 Mana — gestion par patience, pas par réaction comme la rage/le combo. Dégâts sur la durée + nuke, zéro défense : il doit tuer avant de se faire tuer.',
  },
  cryomancer: {
    id: 'cryomancer',
    name: 'Cryomancien',
    emoji: '❄️',
    desc: 'Contrôle absolu : très résistant pour un mage, sorts de gel.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 15, atk: 5, def: 2 },
    parent: 'mage',
    playstyle: 'Le mage le plus solide, un vrai hybride contrôle/tank pour l\'archétype. Comme le Pyromancien, joue sur du Mana (max 100, +15/tour) plutôt qu\'un cooldown pour son ultime : Éclat de glace charge librement, Blizzard (40 Mana) inflige du Gel (ralentit/désavantage l\'ennemi) et offre un bouclier (15% PV) en plus d\'Armure de givre (réduction de dégâts) — des outils défensifs rares chez un mage. Moins de burst pur qu\'un Pyromancien, mais bien plus difficile à tuer.',
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcaniste',
    emoji: '🌌',
    desc: 'Maître du temps : compétences à faible coût et dégâts explosifs.',
    base: { maxHp: 85, atk: 17, def: 3 },
    growth: { maxHp: 13, atk: 6, def: 1 },
    parent: 'mage',
    playstyle: 'Le mage au tempo le plus rapide : Missile arcanique n\'a que 8s de recharge (le plus court de toutes les compétences du jeu), ce qui permet de spammer bien plus souvent qu\'ailleurs. Ressource unique — la Surcharge : elle se charge à chaque compétence lancée (n\'importe laquelle), pas passivement comme le Mana des autres mages — récompense directement le rythme de sorts rapide propre à l\'archétype. Distorsion (×2.0, 50 Surcharge) manipule vraiment le temps en réduisant de 2 tours le cooldown de toutes ses AUTRES compétences équipées. Moins de dégâts par coup individuel, mais une cadence largement supérieure — DPS constant plutôt que pics de burst.',
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
    playstyle: 'Assassin évasif et cupide, seule classe à jouer sur du Combo plutôt que le cooldown universel : chaque coup porté (Poignard ×2.2 + poison inclus) charge 1 point de Combo (max 5), et Assassinat consomme tout le combo accumulé (min. 3) pour des dégâts croissants + vole l\'or de la cible en plein combat. Enchaîner les frappes avant de lâcher le finisher devient un vrai choix de rythme, pas juste attendre un chrono. L\'esquive est sa seule vraie défense (jusqu\'à +18% via Fantôme/Voile d\'ombre), pas de PV ni DEF particuliers.',
  },
  bard: {
    id: 'bard',
    name: 'Barde',
    emoji: '🎵',
    desc: 'Soutien musical : buffs passifs pour toute l\'équipe.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 16, atk: 4, def: 2 },
    parent: 'archer',
    playstyle: 'DPS hybride et vrai soutien. Ressource unique — le Tempo : il ne se charge PAS en tapant ou en encaissant, mais en ALTERNANT ses actions (jouer autre chose que le tour précédent) — récompense la variété plutôt que le bourrinage d\'un seul bouton, littéralement "garder le rythme". Crescendo (×2.3, 60 Tempo) galvanise en plus tout le groupe (+15% ATK pour le reste du combat) en donjon/abysses coop — en solo le buff profite juste à lui-même. Le seul finisher du jeu qui rend toute l\'équipe plus forte, pas juste lui. Inspiration ajoute de l\'ATK ET de la DEF à la fois (rare de cumuler les deux).',
  },
  hunter: {
    id: 'hunter',
    name: 'Chasseur',
    emoji: '🐺',
    desc: 'Tireur d\'élite : dégâts stables, ignore l\'armure ennemie.',
    base: { maxHp: 100, atk: 15, def: 5 },
    growth: { maxHp: 17, atk: 5, def: 2 },
    parent: 'archer',
    playstyle: 'DPS régulier spécialisé en pénétration d\'armure : Perce-cœur cumule jusqu\'à +21% de pénétration, et Morsure (×2.0) laisse en plus son familier affaiblir la cible (-25% ATK, 3 tours) — un vrai debuff défensif pour l\'équipe, pas juste des dégâts. Ressource unique — la Traque : se charge quand un tir CRIT, ce qui crée une vraie synergie avec Concentration et Mise à mort (jusqu\'à +24% crit cumulé sur l\'arbre) — plus tu investis dans le critique, plus Tir de précision (×2.5, 60 Traque) revient vite. Sa force est de rester efficace même face aux monstres résistants là où les autres archers perdent en dégâts, tout en protégeant le groupe.',
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
    playstyle: 'Le vrai healer de la famille Soigneur, et le seul à jouer sur une ressource dédiée au soin plutôt qu\'un cooldown : chaque soin lancé (Lumière sacrée, 22% PV) charge de la Grâce (max 100). Nova sacrée consomme toute la Grâce accumulée (min. 30) pour un soin qui grandit avec elle — jusqu\'à un vrai heal massif si tu as beaucoup soigné avant de la lâcher, en plus de ×1.6 dégâts fixes. Défense complémentaire via Foi et Sanctuaire (+DEF et réduction de dégâts). Le moins offensif des quatre sous-classes Soigneur, mais celui qui se soigne (et encaisse) le mieux.',
  },
  druid: {
    id: 'druid',
    name: 'Druide',
    emoji: '🌿',
    desc: 'Force de la nature : renvoi de dégâts et épines.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 22, atk: 5, def: 1 }, // DEF +2→+1
    parent: 'healer',
    playstyle: 'Hybride tank/DoT autosuffisant, pas un vrai soigneur de groupe, et seule classe sur une ressource unique : la Sève. Épines renvoie une partie des dégâts subis (passif) ET charge la Sève à chaque riposte — Colère (×2.0 + poison 3 tours) coûte 40 Sève, récompensant directement le fait d\'encaisser des coups plutôt que de les éviter. Floraison est son unique soin : un gros heal instantané (25% PV) plutôt qu\'un soin continu. Plus d\'ATK que le Soigneur de base au prix d\'un peu de sustain passif — pense "combattant de la nature qui encaisse pour mieux frapper" plutôt que "prêtre qui soigne en continu".',
  },
  monk: {
    id: 'monk',
    name: 'Moine',
    emoji: '📿',
    desc: 'Art martial : inflige des dégâts au corps à corps pour se soigner.',
    base: { maxHp: 120, atk: 12, def: 7 },
    growth: { maxHp: 18, atk: 6, def: 1 }, // DEF +2→+1 (moine = DPS soigneur, pas tank)
    parent: 'healer',
    playstyle: 'Le plus offensif des Soigneurs, un vrai DPS déguisé, et le second à jouer sur du Combo plutôt qu\'un cooldown : chaque coup de Poing de fer (×1.8) charge 1 point de Combo (max 5), Coup du Dragon consomme tout le combo (min. 3) pour des dégâts croissants. Chi donne du vol de vie (se soigne en tapant, pas via un sort), et Zenith ajoute encore de la régén passive en fin d\'arbre. Pas de bouton de soin dédié comme les autres Soigneurs — sa survie vient entièrement de l\'agressivité (vol de vie + régén), pas d\'un sort de soin.',
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
