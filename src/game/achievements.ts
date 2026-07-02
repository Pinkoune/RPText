import type { PlayerState } from './types';
import { getCraftLevel } from './crafting';
import { farmLevel } from './gathering';

// ─── Succès ──────────────────────────────────────────────────────────────────
// Objectifs long terme calculés à partir des statistiques déjà suivies sur le
// joueur. Chaque succès atteint peut être réclamé une fois pour sa récompense.

export interface AchievementReward {
  gold?: number;
  gems?: number;
  fateCoins?: number;
  item?: { id: string; qty: number };
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  goal: number;
  /** Valeur de progression actuelle du joueur. */
  value: (p: PlayerState) => number;
  reward: AchievementReward;
  rewardLabel: string;
}

const sum = (o: Record<string, number> | undefined) =>
  o ? Object.values(o).reduce((s, v) => s + (v || 0), 0) : 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'lvl_10', name: 'Aventurier confirmé', icon: '⭐', desc: 'Atteins le niveau 10.', goal: 10, value: (p) => p.level, reward: { gold: 500 }, rewardLabel: '500 or' },
  { id: 'lvl_25', name: 'Vétéran', icon: '🌟', desc: 'Atteins le niveau 25.', goal: 25, value: (p) => p.level, reward: { gems: 2, gold: 1000 }, rewardLabel: '1000 or + 2 💎' },
  { id: 'kills_100', name: 'Chasseur', icon: '⚔️', desc: 'Vaincs 100 monstres.', goal: 100, value: (p) => p.kills, reward: { gold: 400 }, rewardLabel: '400 or' },
  { id: 'kills_1000', name: 'Fléau des monstres', icon: '💀', desc: 'Vaincs 1000 monstres.', goal: 1000, value: (p) => p.kills, reward: { gems: 3 }, rewardLabel: '3 💎' },
  { id: 'craft_10', name: 'Apprenti forgeron', icon: '🔨', desc: 'Atteins le niveau 10 d\'artisanat.', goal: 10, value: (p) => getCraftLevel(p.craftXp).level, reward: { item: { id: 'upgrade_matrix', qty: 1 } }, rewardLabel: '1 Matrice ✨' },
  { id: 'farm_10', name: 'Maître récolteur', icon: '🌾', desc: 'Atteins le niveau 10 de récolte.', goal: 10, value: (p) => farmLevel(p), reward: { item: { id: 'lootbox', qty: 2 } }, rewardLabel: '2 Lootbox 🎁' },
  { id: 'dungeon_10', name: 'Explorateur', icon: '🏰', desc: 'Termine 10 donjons.', goal: 10, value: (p) => sum(p.dungeonClears), reward: { item: { id: 'dungeon_key', qty: 3 } }, rewardLabel: '3 Clés 🗝️' },
  { id: 'cj_10', name: 'Ninja', icon: '🥷', desc: 'Gagne 10 duels Card-Jitsu.', goal: 10, value: (p) => p.cjWins, reward: { fateCoins: 10 }, rewardLabel: '10 🎲' },
  { id: 'gamble_50', name: 'Flambeur', icon: '🎰', desc: 'Gagne 50 paris au casino.', goal: 50, value: (p) => p.statistics?.gamblesWon ?? 0, reward: { fateCoins: 15 }, rewardLabel: '15 🎲' },
  { id: 'gold_50k', name: 'Fortune', icon: '🪙', desc: 'Gagne 50 000 or au total.', goal: 50000, value: (p) => p.statistics?.goldEarned ?? 0, reward: { gems: 2 }, rewardLabel: '2 💎' },
  { id: 'biomes_all', name: 'Globe-trotteur', icon: '🗺️', desc: 'Débloque les 6 biomes.', goal: 6, value: (p) => p.unlockedBiomes?.length ?? 1, reward: { gold: 1500 }, rewardLabel: '1500 or' },
  { id: 'star_5', name: 'Légendaire', icon: '🏆', desc: 'Amène un équipement à 5 étoiles.', goal: 5, value: (p) => Math.max(0, ...Object.values(p.gearStars ?? {})), reward: { gems: 5 }, rewardLabel: '5 💎' },
  { id: 'familiars_3', name: 'Ami des bêtes', icon: '🐾', desc: 'Possède 3 familiers.', goal: 3, value: (p) => Object.keys(p.familiars ?? {}).length, reward: { gold: 800 }, rewardLabel: '800 or' },
];

export function isUnlocked(p: PlayerState, def: AchievementDef): boolean {
  return def.value(p) >= def.goal;
}

export function isClaimed(p: PlayerState, id: string): boolean {
  return (p.claimedAchievements ?? []).includes(id);
}

/** Réclame la récompense d'un succès (mute le joueur). Retourne false si impossible. */
export function claimAchievement(p: PlayerState, id: string): boolean {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def || !isUnlocked(p, def) || isClaimed(p, id)) return false;
  if (!p.claimedAchievements) p.claimedAchievements = [];
  p.claimedAchievements.push(id);
  const r = def.reward;
  if (r.gold) p.gold += r.gold;
  if (r.gems) p.gems += r.gems;
  if (r.fateCoins) p.fateCoins += r.fateCoins;
  if (r.item) p.inventory[r.item.id] = (p.inventory[r.item.id] ?? 0) + r.item.qty;
  return true;
}

/** Nombre de succès réclamables non encore pris (pour un badge de notification). */
export function claimableCount(p: PlayerState): number {
  return ACHIEVEMENTS.filter((a) => isUnlocked(p, a) && !isClaimed(p, a.id)).length;
}
