import type { PlayerState } from './types';

// ─── Familiers ──────────────────────────────────────────────────────────────
// Bonus volontairement petit : un familier au niveau max ≈ une pièce d'équipement
// commune/peu rare, jamais un remplacement de gear ou de talent. Un seul stat
// par familier (thème), actif seulement si équipé.

export type FamiliarRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type FamiliarStat = 'atk' | 'def' | 'maxHp';

export interface FamiliarDef {
  id: string;
  name: string;
  emoji: string;
  rarity: FamiliarRarity;
  stat: FamiliarStat;
  /** Bonus au niveau 1. */
  base: number;
  /** Bonus ajouté par niveau au-delà du niveau 1. */
  growth: number;
  desc: string;
}

export const MAX_FAMILIAR_LEVEL = 10;

export const RARITY_COLOR: Record<FamiliarRarity, string> = {
  common: '#b8c0cf',
  rare: '#5aa6ff',
  epic: '#c46bff',
  legendary: '#ffae42',
};

export const RARITY_COST: Record<FamiliarRarity, number> = {
  common: 300,
  rare: 1500,
  epic: 6000,
  legendary: 0, // introuvable en boutique — drop rare de boss mondial
};

export const FAMILIARS: Record<string, FamiliarDef> = {
  // Communs
  ember_sprite: { id: 'ember_sprite', name: 'Braisillon', emoji: '🔥', rarity: 'common', stat: 'atk', base: 1, growth: 0.2, desc: 'Petite flamme espiègle.' },
  mossling: { id: 'mossling', name: 'Moussillon', emoji: '🐢', rarity: 'common', stat: 'def', base: 1, growth: 0.2, desc: 'Carapace tendre mais têtue.' },
  pup: { id: 'pup', name: 'Chiot des bois', emoji: '🐕', rarity: 'common', stat: 'maxHp', base: 8, growth: 1.3, desc: 'Fidèle et increvable.' },

  // Rares
  kit_fox: { id: 'kit_fox', name: 'Renardeau', emoji: '🦊', rarity: 'rare', stat: 'atk', base: 2, growth: 0.35, desc: 'Rapide et rusé.' },
  shell_crab: { id: 'shell_crab', name: 'Crabounet', emoji: '🦀', rarity: 'rare', stat: 'def', base: 2, growth: 0.35, desc: 'Une pince pour tout régler.' },
  plump_slime: { id: 'plump_slime', name: 'Slime dodu', emoji: '🟢', rarity: 'rare', stat: 'maxHp', base: 15, growth: 2.3, desc: 'Absorbe les coups en rebondissant.' },

  // Épiques
  hatchling: { id: 'hatchling', name: 'Bébé dragon', emoji: '🐲', rarity: 'epic', stat: 'atk', base: 3, growth: 0.5, desc: 'Un souffle prometteur.' },
  golem_shard: { id: 'golem_shard', name: 'Éclat de golem', emoji: '🗿', rarity: 'epic', stat: 'def', base: 3, growth: 0.5, desc: 'Fragment de pierre vivante.' },
  moonbear: { id: 'moonbear', name: 'Ourson-lune', emoji: '🐻', rarity: 'epic', stat: 'maxHp', base: 25, growth: 3.5, desc: 'Veille sur toi la nuit venue.' },

  // Légendaires (drop boss uniquement)
  starling: { id: 'starling', name: 'Étoile filante', emoji: '🌠', rarity: 'legendary', stat: 'atk', base: 4, growth: 0.65, desc: 'Tombée du ciel pour te guider.' },
  phoenixling: { id: 'phoenixling', name: 'Phénixeau', emoji: '🐣', rarity: 'legendary', stat: 'maxHp', base: 35, growth: 4.6, desc: 'Une étincelle de renaissance.' },
};

export const FAMILIAR_LIST = Object.values(FAMILIARS);

export function familiarsByRarity(r: FamiliarRarity): FamiliarDef[] {
  return FAMILIAR_LIST.filter((f) => f.rarity === r);
}

/** XP nécessaire pour passer du niveau n au niveau n+1 (plafonne à MAX_FAMILIAR_LEVEL). */
export function familiarXpToNext(level: number): number {
  return Math.floor(35 * Math.pow(level, 1.5)) + 40;
}

export function familiarProgress(xp: number): { level: number; into: number; need: number; maxed: boolean } {
  let level = 1;
  let acc = isNaN(xp) ? 0 : xp;
  let need = familiarXpToNext(level);
  while (acc >= need && level < MAX_FAMILIAR_LEVEL) {
    acc -= need;
    level += 1;
    need = familiarXpToNext(level);
  }
  const maxed = level >= MAX_FAMILIAR_LEVEL;
  return { level, into: maxed ? 0 : acc, need: maxed ? 0 : need, maxed };
}

/** Bonus de stats du familier actif (0 si aucun équipé). */
export function familiarBonus(p: PlayerState): { atk: number; def: number; maxHp: number } {
  const id = p.activeFamiliarId;
  const xp = id ? p.familiars?.[id] : undefined;
  const def = id ? FAMILIARS[id] : undefined;
  const out = { atk: 0, def: 0, maxHp: 0 };
  if (!id || xp == null || !def) return out;
  const lvl = familiarProgress(xp).level;
  const bonus = Math.round((def.base + def.growth * (lvl - 1)) * 10) / 10;
  out[def.stat] = def.stat === 'maxHp' ? Math.round(bonus) : bonus;
  return out;
}

/** Adopte un familier aléatoire non possédé de la rareté donnée (or non possédé du tout si complet). */
export function rollFamiliar(p: PlayerState, rarity: FamiliarRarity): string {
  const pool = familiarsByRarity(rarity);
  const unowned = pool.filter((f) => !(f.id in (p.familiars ?? {})));
  const list = unowned.length > 0 ? unowned : pool;
  return list[Math.floor(Math.random() * list.length)].id;
}

/** Vrai si le joueur possède déjà TOUS les familiers de cette rareté. */
export function ownsAllOfRarity(p: PlayerState, rarity: FamiliarRarity): boolean {
  const pool = familiarsByRarity(rarity);
  if (pool.length === 0) return true;
  return pool.every((f) => f.id in (p.familiars ?? {}));
}

// ─── Capacité de combat du familier ─────────────────────────────────────────
// Chaque familier a un petit passif qui se déclenche parfois en combat, selon
// son thème : attaque = frappe bonus, défense = bouclier (soin), PV = soin.
// Volontairement modeste et croissant avec le niveau/rareté du familier.

export type FamiliarAbilityKind = 'strike' | 'guard' | 'heal';

export interface FamiliarAbility {
  kind: FamiliarAbilityKind;
  /** Puissance (dégâts ou PV rendus). */
  power: number;
  /** Probabilité de déclenchement par tour. */
  chance: number;
  emoji: string;
  name: string;
  label: string;
}

const RARITY_ABILITY_MULT: Record<FamiliarRarity, number> = {
  common: 1, rare: 1.5, epic: 2.2, legendary: 3,
};

/** Capacité active du familier équipé, mise à l'échelle du niveau/rareté (null si aucun). */
export function familiarAbility(p: PlayerState): FamiliarAbility | null {
  const id = p.activeFamiliarId;
  const xp = id ? p.familiars?.[id] : undefined;
  const def = id ? FAMILIARS[id] : undefined;
  if (!id || xp == null || !def) return null;
  const lvl = familiarProgress(xp).level;
  const power = Math.round((2 + lvl * 1.2) * RARITY_ABILITY_MULT[def.rarity]);
  const chance = Math.min(0.35, 0.18 + lvl * 0.012);
  const kind: FamiliarAbilityKind = def.stat === 'atk' ? 'strike' : def.stat === 'def' ? 'guard' : 'heal';
  const label =
    kind === 'strike' ? `Frappe (+${power} dégâts, ${Math.round(chance * 100)}%/tour)`
    : kind === 'guard' ? `Protection (+${power} PV bloqués, ${Math.round(chance * 100)}%/tour)`
    : `Soin (+${power} PV, ${Math.round(chance * 100)}%/tour)`;
  return { kind, power, chance, emoji: def.emoji, name: def.name, label };
}

/** Ajoute de l'XP au familier actif (appelé après une victoire). Plafonne au niveau max. */
export function grantFamiliarXp(p: PlayerState, amount: number): void {
  const id = p.activeFamiliarId;
  if (!id || !p.familiars || !(id in p.familiars) || isNaN(amount)) return;
  if (isNaN(p.familiars[id])) p.familiars[id] = 0;
  const prog = familiarProgress(p.familiars[id]);
  if (prog.maxed) return;
  p.familiars[id] += amount;
}
