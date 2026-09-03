// ─── Passe de saison (gratuite) ──────────────────────────────────────────────
//
// Une saison ne se sentait pas : elle remettait l'artefact à zéro et c'était
// tout. La passe lui donne un contenu — une piste de paliers à parcourir, qui
// se vide et se recharge à chaque rotation.
//
// Elle se remplit sur le NIVEAU D'ARTEFACT plutôt que sur un compteur dédié.
// L'artefact monte déjà sur tout ce que fait le joueur (chasse, donjon, récolte,
// forge, camp) et repart à zéro à chaque saison : c'est exactement la forme
// d'une piste saisonnière, il aurait été absurde d'en ajouter une deuxième à
// côté.
//
// Tout est gratuit — il n'y a pas de piste payante et il n'y en aura pas.
// Les récompenses sont volontairement de trois natures :
//  - des Éclats de Relique, la seule source RÉPÉTABLE d'une saison à l'autre
//    (les succès sont à usage unique, la queue d'artefact est très lente) ;
//  - du cosmétique permanent (titres, fonds de profil) qui survit à la saison
//    et se collectionne ;
//  - un peu de consommable, pour que les premiers paliers servent tout de suite.

import type { PlayerState } from './types';
import { addItemToInventory, item } from './items';
import { grantShards } from './relic';
import { getCurrentSeason, seasonTheme } from './artifact';

/** Fond de profil — cosmétique permanent, débloqué par la passe. */
export interface ProfileBg {
  id: string;
  name: string;
  /** Dégradé CSS appliqué derrière la fiche de profil. */
  css: string;
}

export const PROFILE_BGS: ProfileBg[] = [
  { id: 'aube',       name: 'Aube',        css: 'linear-gradient(150deg, rgba(244,147,105,.30), rgba(120,80,160,.22))' },
  { id: 'braise',     name: 'Braise',      css: 'linear-gradient(150deg, rgba(226,105,63,.32), rgba(90,20,20,.28))' },
  { id: 'abysse',     name: 'Abysse',      css: 'linear-gradient(150deg, rgba(60,90,190,.32), rgba(10,15,45,.35))' },
  { id: 'verdoyant',  name: 'Verdoyant',   css: 'linear-gradient(150deg, rgba(70,180,130,.28), rgba(20,60,50,.30))' },
  { id: 'primordial', name: 'Primordial',  css: 'linear-gradient(150deg, rgba(240,181,67,.30), rgba(176,136,255,.26), rgba(20,20,50,.30))' },
];

export function profileBg(id?: string): ProfileBg | undefined {
  return PROFILE_BGS.find((b) => b.id === id);
}

export interface PassTier {
  /** Niveau d'artefact à atteindre. */
  level: number;
  shards?: number;
  gold?: number;
  fateCoins?: number;
  gems?: number;
  items?: Record<string, number>;
  /** Fond de profil débloqué (permanent). */
  bg?: string;
  /** Titre saisonnier : le libellé dépend du thème, voir `tierTitle`. */
  title?: 'champion' | 'legende';
}

/**
 * Dix paliers étalés sur la vie d'une saison. Les premiers tombent vite (le
 * joueur doit voir la piste bouger dès le premier soir), les derniers demandent
 * d'aller bien au-delà de la grille de mods.
 */
export const PASS_TIERS: PassTier[] = [
  { level: 3,   shards: 2, gold: 500 },
  { level: 8,   bg: 'aube', gold: 1000 },
  { level: 15,  shards: 3, fateCoins: 10 },
  { level: 25,  title: 'champion', items: { repair_kit: 3 } },
  { level: 35,  shards: 4, items: { upgrade_matrix: 1 } },
  { level: 45,  bg: 'braise', items: { dungeon_key: 2 } },
  { level: 55,  shards: 5, fateCoins: 20 },
  { level: 65,  bg: 'abysse', items: { upgrade_matrix: 2 } },
  { level: 80,  shards: 6, title: 'legende' },
  { level: 100, bg: 'primordial', shards: 6, gems: 3 },
];

/** Titre saisonnier, nommé d'après le thème — donc collectionnable par saison. */
export function tierTitle(kind: 'champion' | 'legende', season = getCurrentSeason()): string {
  const t = seasonTheme(season);
  return kind === 'champion' ? `Champion · ${t.name}` : `Légende · ${t.name}`;
}

export interface PassState {
  season: number;
  claimed: number[];
}

export function freshPass(season = getCurrentSeason()): PassState {
  return { season, claimed: [] };
}

/**
 * Remet la passe à zéro si la saison a tourné. Les récompenses déjà réclamées
 * restent acquises (titres et fonds sont permanents) : seule la piste se vide.
 */
export function ensureSeasonPass(p: PlayerState, season = getCurrentSeason()): void {
  if (!p.seasonPass || p.seasonPass.season !== season) p.seasonPass = freshPass(season);
}

export function isTierClaimed(p: PlayerState, index: number): boolean {
  return !!p.seasonPass?.claimed.includes(index);
}

/** Un palier est atteint dès que le niveau d'artefact le permet. */
export function isTierReached(p: PlayerState, index: number): boolean {
  const t = PASS_TIERS[index];
  return !!t && (p.artifact?.level ?? 0) >= t.level;
}

/** Nombre de paliers réclamables — pilote la pastille de la carte Saison. */
export function claimablePassTiers(p: PlayerState): number {
  return PASS_TIERS.reduce(
    (n, _t, i) => n + (isTierReached(p, i) && !isTierClaimed(p, i) ? 1 : 0),
    0,
  );
}

/** Réclame un palier. Renvoie `true`, ou un message d'erreur. */
export function claimPassTier(p: PlayerState, index: number, season = getCurrentSeason()): true | string {
  ensureSeasonPass(p, season);
  const t = PASS_TIERS[index];
  if (!t) return 'Palier inconnu.';
  if (isTierClaimed(p, index)) return 'Palier déjà réclamé.';
  if (!isTierReached(p, index)) return `Artefact niveau ${t.level} requis.`;

  if (t.gold) p.gold += t.gold;
  if (t.fateCoins) p.fateCoins += t.fateCoins;
  if (t.gems) p.gems += t.gems;
  if (t.shards) grantShards(p, t.shards);
  if (t.items) for (const [id, q] of Object.entries(t.items)) addItemToInventory(p.inventory, id, q);
  if (t.bg) {
    if (!p.unlockedBgs) p.unlockedBgs = [];
    if (!p.unlockedBgs.includes(t.bg)) p.unlockedBgs.push(t.bg);
  }
  if (t.title) {
    const name = tierTitle(t.title, season);
    if (!p.unlockedTitles) p.unlockedTitles = [];
    if (!p.unlockedTitles.includes(name)) p.unlockedTitles.push(name);
  }
  p.seasonPass!.claimed.push(index);
  return true;
}

/** Libellé lisible des récompenses d'un palier. */
export function tierRewardLabels(t: PassTier, season = getCurrentSeason()): string[] {
  const out: string[] = [];
  if (t.shards) out.push(`${t.shards} ✧ Éclats`);
  if (t.gold) out.push(`${t.gold.toLocaleString()} 🪙`);
  if (t.fateCoins) out.push(`${t.fateCoins} 🎲`);
  if (t.gems) out.push(`${t.gems} 💎`);
  if (t.items) for (const [id, q] of Object.entries(t.items)) out.push(`${item(id)?.name ?? id} ×${q}`);
  if (t.bg) out.push(`Fond « ${profileBg(t.bg)?.name ?? t.bg} »`);
  if (t.title) out.push(`Titre « ${tierTitle(t.title, season)} »`);
  return out;
}
