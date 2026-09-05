import type { PlayerState } from './types';
import { grantShards } from './relic';
import type { CombatMods } from './talents';

// ─── Artefact de saison ──────────────────────────────────────────────────────
// Axe de progression SANS FIN, qui prend le relais du niveau une fois le
// plafond (50) atteint. C'est lui — et non le niveau — qui porte le end-game :
// une seule jauge qui monte quoi que tu fasses (chasse, donjon, récolte, craft,
// PvP, Abysses), et des points à dépenser dans une grille de mods.
//
// Il se remet à zéro à chaque changement de saison : c'est ce qui rend les
// records d'Abysses de nouveau contestables, sans jamais toucher au personnage.

/** Saison en cours, alimentée par `system/season` (voir seasonService). */
let currentSeason = 1;

export function getCurrentSeason(): number {
  return currentSeason;
}

export function setCurrentSeason(n: number): void {
  if (Number.isFinite(n) && n >= 1) currentSeason = Math.floor(n);
}

/** Thème d'une saison — calé sur l'année scolaire, qui est le vrai repère ici. */
export interface SeasonTheme {
  name: string;
  emoji: string;
  color: string;
  /** Nom de l'artefact de la saison. */
  artifactName: string;
}

export const SEASON_THEMES: SeasonTheme[] = [
  { name: 'Automne', emoji: '🍂', color: '#e2913f', artifactName: 'Relique des Feuilles Mortes' },
  { name: 'Hiver', emoji: '❄️', color: '#8cd0ff', artifactName: 'Relique de Givre' },
  { name: 'Printemps', emoji: '🌸', color: '#f39ac7', artifactName: 'Relique de Sève' },
  { name: 'Été', emoji: '☀️', color: '#ffd45a', artifactName: 'Relique de Braise' },
];

export function seasonTheme(season = currentSeason): SeasonTheme {
  return SEASON_THEMES[(Math.max(1, season) - 1) % SEASON_THEMES.length];
}

/**
 * Plus petit numéro > `from` qui donne le thème voulu.
 *
 * Le thème est dérivé du numéro (`(n-1) % 4`), donc choisir un thème revient à
 * choisir un numéro. L'admin raisonne en « je veux passer à l'Hiver », pas en
 * « je veux la saison 6 » : cette fonction fait la traduction, en n'allant
 * jamais en arrière (un numéro qui recule ferait réapparaître des saisons déjà
 * archivées chez les joueurs).
 */
export function nextSeasonWithTheme(themeIndex: number, from: number): number {
  const t = ((themeIndex % SEASON_THEMES.length) + SEASON_THEMES.length) % SEASON_THEMES.length;
  for (let n = from + 1; n < from + 1 + SEASON_THEMES.length; n++) {
    if ((Math.max(1, n) - 1) % SEASON_THEMES.length === t) return n;
  }
  return from + 1;
}

// ─── Courbe de l'artefact ────────────────────────────────────────────────────

/**
 * XP nécessaire pour passer au niveau d'artefact suivant. Volontairement
 * polynomiale douce : la jauge doit toujours avancer de façon visible, même
 * après des centaines de niveaux, puisque c'est le seul axe infini du jeu.
 */
export function artifactXpToNext(level: number): number {
  return Math.floor(400 + 300 * Math.pow(Math.max(0, level), 1.35));
}

/**
 * Bonus de puissance de l'artefact (fraction appliquée à ATK/DEF/PV).
 * Logarithmique et SANS plafond : l'écart entre un joueur à 50 et un joueur à
 * 500 reste jouable, mais la montée ne s'arrête jamais.
 *   Nv.10 ≈ +10%   Nv.30 ≈ +21%   Nv.50 ≈ +27%   Nv.100 ≈ +36%   Nv.500 ≈ +60%
 *
 * Le « /10 » est essentiel : sans lui (log10(1+level) seul), les tout premiers
 * niveaux — qui s'enchaînent en quelques combats — offraient déjà +27%, ce qui
 * banalisait complètement le début de partie.
 */
export function artifactPowerPct(level: number): number {
  if (level <= 0) return 0;
  return 0.35 * Math.log10(1 + level / 10);
}

export interface ArtifactState {
  /** Saison à laquelle cet artefact appartient (sert à détecter la rotation). */
  season: number;
  xp: number;
  level: number;
  /** Ids des mods débloqués. */
  mods: string[];
}

export function freshArtifact(season = currentSeason): ArtifactState {
  return { season, xp: 0, level: 0, mods: [] };
}

export function getArtifact(p: PlayerState): ArtifactState {
  if (!p.artifact) p.artifact = freshArtifact();
  return p.artifact;
}

// ─── Grille de mods ──────────────────────────────────────────────────────────

/**
 * Effets qui ne se réduisent pas à un `CombatMods` et sont lus ailleurs dans le
 * jeu. Volontairement peu nombreux, mais chacun réellement câblé.
 */
export type ArtifactFlag =
  | 'spread'      // brûlures et poisons frappent plus fort (combat.ts)
  | 'rift'        // la Faille est amplifiée (combat.ts)
  | 'secondWind'  // survit une fois par combat (combat.ts)
  | 'thrifty'     // le craft peut ne rien consommer (crafting.ts)
  | 'harvest';    // récolte plus rapide (gathering.ts)

export interface ArtifactModDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Colonne 0..4 : elle s'ouvre à partir d'un total de points dépensés. */
  column: number;
  cost: number;
  mods?: Partial<CombatMods>;
  flag?: ArtifactFlag;
}

/**
 * Points cumulés nécessaires pour ouvrir chaque colonne.
 * Calibré pour que la grille complète (58 points) se remplisse à peu près au
 * moment où le personnage atteint le plafond de niveau — et non bien avant.
 */
export const COLUMN_UNLOCK = [0, 4, 12, 24, 42];

/**
 * Coût total de la grille. Au-delà de ce niveau, les points d'artefact n'ont
 * plus rien à acheter : ils deviennent des Éclats de Relique. Sans ça, la
 * « progression infinie » de l'artefact se résumait à +0,1% de puissance par
 * niveau, soit une jauge qui monte pour rien.
 */
export function artifactGridCost(): number {
  return ARTIFACT_MODS.reduce((sum, m) => sum + m.cost, 0);
}

export const ARTIFACT_MODS: ArtifactModDef[] = [
  // ── Colonne I — fondations ──
  { id: 'art_edge', name: 'Tranchant', icon: '🗡️', desc: '+6% ATK.', column: 0, cost: 1, mods: { atkPct: 0.06 } },
  { id: 'art_ward', name: 'Égide', icon: '🛡️', desc: '+6% DEF.', column: 0, cost: 1, mods: { defPct: 0.06 } },
  { id: 'art_vigor', name: 'Vigueur', icon: '❤️', desc: '+8% PV max.', column: 0, cost: 1, mods: { hpPct: 0.08 } },
  { id: 'art_focus', name: 'Acuité', icon: '🎯', desc: '+5% de coup critique.', column: 0, cost: 1, mods: { crit: 0.05 } },

  // ── Colonne II — spécialisation ──
  { id: 'art_pierce', name: 'Perce-armure', icon: '⚡', desc: "+10% de pénétration d'armure.", column: 1, cost: 2, mods: { armorPen: 0.10 } },
  { id: 'art_swift', name: 'Célérité', icon: '🏹', desc: '+8% de chance de frapper deux fois.', column: 1, cost: 2, mods: { doubleHit: 0.08 } },
  { id: 'art_leech', name: 'Sangsue', icon: '🩸', desc: '+6% de vol de vie.', column: 1, cost: 2, mods: { lifesteal: 0.06 } },
  { id: 'art_bramble', name: 'Ronces', icon: '🌵', desc: '+8% de dégâts renvoyés.', column: 1, cost: 2, mods: { thorns: 0.08 } },

  // ── Colonne III — mécaniques ──
  { id: 'art_spread', name: 'Propagation', icon: '☠️', desc: 'Tes brûlures et poisons infligent 50% de dégâts en plus.', column: 2, cost: 4, flag: 'spread', mods: { statusPow: 0.5 } },
  { id: 'art_harvest', name: 'Moisson', icon: '🌾', desc: '-20% de temps de récupération sur la récolte.', column: 2, cost: 4, flag: 'harvest' },
  { id: 'art_thrifty', name: 'Forge économe', icon: '🔨', desc: '20% de chance de ne consommer aucun matériau au craft.', column: 2, cost: 4, flag: 'thrifty' },
  { id: 'art_mend', name: 'Récupération', icon: '💫', desc: '+12 points de vie régénérés par tour.', column: 2, cost: 4, mods: { regen: 12 } },

  // ── Colonne IV — mécaniques fortes ──
  { id: 'art_rift', name: 'Écho de Faille', icon: '⚡', desc: 'La Faille passe de ×1.5 à ×1.9 sur une cible gelée ou étourdie.', column: 3, cost: 6, flag: 'rift', mods: { riftBonus: 0.4 } },
  { id: 'art_wind', name: 'Sursis', icon: '🕊️', desc: 'Une fois par combat, un coup fatal te laisse à 30% de tes PV.', column: 3, cost: 6, flag: 'secondWind', mods: { secondWind: 1 } },
  { id: 'art_brutal', name: 'Brutalité', icon: '💥', desc: '+30% de dégâts critiques.', column: 3, cost: 6, mods: { critMult: 0.3 } },

  // ── Colonne V — apogée ──
  { id: 'art_execute', name: 'Sentence', icon: '☠️', desc: '+15% de chance d\'exécuter une cible affaiblie.', column: 4, cost: 8, mods: { execute: 0.15 } },
  { id: 'art_apex', name: 'Apogée', icon: '👑', desc: '+10% ATK, DEF et PV.', column: 4, cost: 8, mods: { atkPct: 0.10, defPct: 0.10, hpPct: 0.10 } },
];

export function artifactMod(id: string): ArtifactModDef | undefined {
  return ARTIFACT_MODS.find((m) => m.id === id);
}

/** Total de points dépensés dans les mods débloqués. */
export function pointsSpent(p: PlayerState): number {
  const a = getArtifact(p);
  return a.mods.reduce((n, id) => n + (artifactMod(id)?.cost ?? 0), 0);
}

/** Points encore disponibles (1 point par niveau d'artefact). */
export function pointsAvailable(p: PlayerState): number {
  return Math.max(0, getArtifact(p).level - pointsSpent(p));
}

/** Une colonne est ouverte dès que le joueur a dépensé assez de points. */
export function columnUnlocked(p: PlayerState, column: number): boolean {
  return pointsSpent(p) >= (COLUMN_UNLOCK[column] ?? 0);
}

export function hasArtifactMod(p: PlayerState, id: string): boolean {
  return !!p.artifact?.mods.includes(id);
}

export function hasFlag(p: PlayerState, flag: ArtifactFlag): boolean {
  const a = p.artifact;
  if (!a) return false;
  return a.mods.some((id) => artifactMod(id)?.flag === flag);
}

/** Débloque un mod. Retourne un message d'erreur, ou null si c'est bon. */
export function unlockArtifactMod(p: PlayerState, id: string): string | null {
  const def = artifactMod(id);
  if (!def) return 'Mod inconnu.';
  const a = getArtifact(p);
  if (a.mods.includes(id)) return 'Déjà débloqué.';
  if (!columnUnlocked(p, def.column)) {
    return `Colonne verrouillée (${COLUMN_UNLOCK[def.column]} points dépensés requis).`;
  }
  if (pointsAvailable(p) < def.cost) return 'Pas assez de points.';
  a.mods.push(id);
  return null;
}

/** Applique les mods de combat de l'artefact (mutation en place). */
export function applyArtifactMods(p: PlayerState, mods: CombatMods): void {
  const a = p.artifact;
  if (!a) return;
  for (const id of a.mods) {
    const def = artifactMod(id);
    if (!def?.mods) continue;
    for (const key of Object.keys(def.mods) as (keyof CombatMods)[]) {
      mods[key] += def.mods[key] ?? 0;
    }
  }
}

/**
 * Crédite de l'XP d'artefact et fait monter les niveaux. Appelé partout où le
 * joueur gagne de l'XP (combat, récolte, craft) : une seule jauge qui avance
 * quoi que le joueur fasse. Retourne le nombre de niveaux gagnés.
 */
export function grantArtifactXp(p: PlayerState, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const a = getArtifact(p);
  const grid = artifactGridCost();
  a.xp += Math.floor(amount);
  let gained = 0;
  // Garde-fou : une récompense aberrante ne doit pas boucler indéfiniment.
  while (a.xp >= artifactXpToNext(a.level) && gained < 1000) {
    a.xp -= artifactXpToNext(a.level);
    a.level += 1;
    gained += 1;
    // Une fois la grille payable en entier, les niveaux suivants n'ont plus
    // rien à acheter : ils deviennent des Éclats de Relique. C'est ce qui donne
    // enfin une raison de continuer à faire monter l'artefact.
    if (a.level > grid) grantShards(p, 1);
  }
  return gained;
}

/**
 * Rotation de saison : si l'artefact appartient à une saison révolue, on archive
 * le résultat et on repart de zéro. Le PERSONNAGE, lui, n'est jamais touché —
 * seul l'artefact (et donc les classements qui en dépendent) redémarre.
 * Retourne l'archive créée, ou null s'il n'y avait rien à faire.
 */
export function rotateSeason(p: PlayerState, season = currentSeason): { season: number; artifactLevel: number } | null {
  const a = getArtifact(p);
  if (a.season === season) return null;
  const archive = { season: a.season, artifactLevel: a.level };
  if (a.level > 0) {
    if (!p.seasonHistory) p.seasonHistory = [];
    p.seasonHistory.push({ ...archive, level: p.level, at: Date.now() });
    // On garde les 12 dernières saisons : de quoi remplir un Panthéon lisible.
    if (p.seasonHistory.length > 12) p.seasonHistory.shift();
  }
  p.artifact = freshArtifact(season);
  return a.level > 0 ? archive : null;
}
