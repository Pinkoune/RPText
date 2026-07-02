// ─── Types de base du jeu ────────────────────────────────────────────────

export type ClassId = 'warrior' | 'mage' | 'archer' | 'healer';

export type BiomeId =
  | 'forest'
  | 'plains'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'frozen';

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemSlot = 'weapon' | 'armor' | 'trinket' | 'consumable' | 'material';
export type Element = 'fire' | 'earth' | 'water' | 'wind' | 'frost' | 'light' | 'dark' | 'neutral';
export type DamageType = 'physical' | 'magical';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  rarity: ItemRarity;
  slot: ItemSlot;
  atk?: number;
  def?: number;
  hp?: number;
  /** Classes autorisées à équiper (armes). Absent = toutes. */
  classes?: ClassId[];
  /** Valeur de revente en or. */
  value: number;
  desc: string;
  
  // -- Nouveautés V2 Équipement --
  element?: Element;
  dmgType?: DamageType;
  /** Identifiant du set pour les bonus de set. */
  setId?: string;
  /** Passif de l'objet, informatif ou géré manuellement. */
  passive?: string;
  /** Durabilité maximale de l'équipement (0 = incassable). */
  maxDurability?: number;
  maxCp?: number;
  maxGp?: number;
}

export interface Stats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  maxCp: number;
  maxGp: number;
  weaponElement?: string;
  weaponDmgType?: string;
  armorElement?: string;
  trinketId?: string;
}

export interface EquippedGear {
  weapon: string | null;
  armor: string | null;
  trinket: string | null;
}

export interface PlayerState {
  uid: string;
  name: string;
  /** Titre/devise personnalisable affiché sous le nom. */
  title: string;
  photoURL: string | null;
  classId: ClassId;
  level: number;
  xp: number;
  gold: number;
  /** Monnaie de gambling premium. */
  fateCoins: number;
  gems: number;
  hp: number;
  /** id de l'objet -> quantité */
  inventory: Record<string, number>;
  equipped: EquippedGear;
  
  // -- V2 Equipement --
  /** Durabilité actuelle des équipements (0 à maxDurability). Si 0, l'équipement est cassé. */
  gearDurability: Record<ItemSlot, number>;
  /** Nombre d'étoiles (0 à 5) pour les équipements. Chaque étoile augmente les stats de base de l'objet. */
  gearStars: Record<ItemSlot, number>;

  biome: BiomeId;
  /** Biomes débloqués. */
  unlockedBiomes: BiomeId[];
  /** Timestamps (ms) des derniers usages, pour les cooldowns. */
  cooldowns: Record<string, number>;
  /** Statistiques de jeu. */
  kills: number;
  deaths: number;
  /** Bilan net du gambling (peut être négatif). */
  gambleNet: number;
  /** Statistiques globales du joueur. */
  statistics: {
    goldEarned: number;
    gamblesPlayed: number;
    gamblesWon: number;
    mobsKilled: Record<string, number>;
    mobsEncountered: Record<string, number>;
  };
  /** Progression des quêtes (journalières/hebdomadaires). */
  quests: QuestState;
  /** Duels PvP déjà encaissés (anti double-crédit). */
  settledDuels: string[];
  /** Récompenses de boss mondiaux déjà réclamées. */
  bossClaims: string[];
  /** Ventes au marché déjà encaissées (anti double-crédit). */
  settledSales: string[];
  /** Duels Card-Jitsu déjà encaissés. */
  settledCJDuels: string[];
  /** Victoires Card-Jitsu (détermine la ceinture). */
  cjWins: number;
  /** Équipe et guilde actuelles (ids Firestore, ou null). */
  teamId: string | null;
  guildId: string | null;
  /** Donjons (Multijoueur) */
  dungeonSessionId?: string | null;
  settledDungeons?: string[];
  /** Dons de ressources déjà encaissés (anti double-crédit). */
  settledGifts: string[];
  /** XP par métier de récolte (legacy, fusionné dans farmXp). */
  gatherXp: Record<string, number>;
  /** XP de farm global (niveau de récolte unique). */
  farmXp: number;
  /** XP d'artisanat. */
  craftXp: number;
  /** Nombre de clears par donjon. */
  dungeonClears: Record<string, number>;
  /** Points de talent non dépensés. */
  talentPoints: number;
  /** Rang investi par talent (id -> rang). */
  talents: Record<string, number>;
  /** Version de la courbe d'XP appliquée (recalcul des niveaux à la migration). */
  curveVersion?: number;
  /** Version du dernier reset forcé des talents (bug : points conservés après le rework). */
  talentResetVersion?: number;
  /** Restauration one-time de l'XP perdue par le bug NaN (1 = déjà réclamée). */
  restoredXpV1?: number;
  /** Familiers possédés : id de définition -> XP accumulée. */
  familiars: Record<string, number>;
  /** Familier actuellement équipé (donne son bonus de stat). */
  activeFamiliarId: string | null;
  /** Connexion journalière : nombre de jours consécutifs. */
  loginStreak?: number;
  /** Dernier jour de connexion réclamé (clé locale AAAA-M-J). */
  lastLoginDay?: string;
  /** Succès dont la récompense a été réclamée. */
  claimedAchievements?: string[];
  /** Cadeau Mathieu (Heartsteel) déjà réclamé ? */
  claimedMathieuKdo?: boolean;
  createdAt: number;
  lastSeen: number;
}

export interface QuestPeriodState {
  /** Début de la période courante (ms). */
  start: number;
  /** Compteurs de métriques accumulés sur la période. */
  counters: Record<string, number>;
  /** Ids des quêtes dont la récompense a été réclamée. */
  claimed: string[];
}

export interface QuestState {
  daily: QuestPeriodState;
  weekly: QuestPeriodState;
}

/** Métriques suivies par les quêtes. */
export type QuestMetric = 'kills' | 'hunts' | 'gambleWins' | 'goldEarned' | 'bossHits' | 'crafts' | 'gathers';

export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: [number, number];
  biomes: BiomeId[];
  
  // -- V2 Combat --
  element: Element;
  /** Dégâts que le monstre inflige (physique/magique) */
  dmgType: DamageType;
  /** Faiblesses aux types de dégâts (reçoit 1.5x) */
  weaknesses?: DamageType[];
  /** Résistances aux types de dégâts (reçoit 0.5x) */
  resistances?: DamageType[];
  /** Apparait seulement à ces phases (vide = toutes). */
  phases?: Phase[];
  /** Table de butin : id objet -> probabilité 0..1 */
  loot: Record<string, number>;
  emoji: string;
}
