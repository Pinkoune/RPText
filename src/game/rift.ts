// ─── La Faille de la semaine ─────────────────────────────────────────────────
//
// Le end-game manquait moins de LIEUX que de RAISONS d'y retourner : huit
// biomes, tous ouverts au Nv.38, et plus rien de neuf ensuite. La Faille rebat
// ce qui existe déjà — un biome et un monstre du jeu — avec un modificateur qui
// change chaque semaine, plutôt que d'ajouter une zone de plus.
//
// Aucun backend : la semaine, le biome et le modificateur se déduisent de
// l'horloge, exactement comme les événements (`events.ts`) et les fenêtres de
// raid (`raid.ts`). Deux joueurs qui ouvrent la Faille au même moment voient la
// même chose sans que rien ne soit synchronisé.

import type { PlayerState, MonsterDef, BiomeId, Element } from './types';
import { BIOME_LIST } from './biomes';
import { pickMonster } from './monsters';
import { currentPhase } from './daynight';
import { grantShards } from './relic';

export const RIFT_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Éclats accordés au premier passage de la semaine. */
export const RIFT_SHARDS = 2;

/**
 * Modificateur hebdomadaire. Chacun oblige à changer quelque chose : son build,
 * son arme, sa façon de jouer les tours. Un simple « +50% de stats » ne
 * demanderait rien d'autre que d'être plus fort, ce qui n'est pas un défi.
 */
export interface RiftModifier {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Transforme le monstre de base. Reçoit une copie, la mute librement. */
  apply: (m: MonsterDef) => void;
}

export const RIFT_MODIFIERS: RiftModifier[] = [
  {
    id: 'enrage', name: 'Enragé', icon: '💢',
    desc: 'Frappe deux fois plus fort, mais tombe bien plus vite. Course à la mort.',
    apply: (m) => { m.atk = Math.round(m.atk * 1.5); m.hp = Math.round(m.hp * 0.6); },
  },
  {
    id: 'colosse', name: 'Colossal', icon: '🗿',
    desc: 'Une montagne de points de vie. Il faut tenir la distance.',
    apply: (m) => { m.hp = Math.round(m.hp * 2.0); m.atk = Math.round(m.atk * 0.85); },
  },
  {
    id: 'carapace', name: 'Carapacé', icon: '🛡️',
    desc: 'Défense énorme : sans pénétration d\'armure, tes coups s\'écrasent.',
    apply: (m) => { m.def = Math.round(m.def * 2.5 + 15); m.hp = Math.round(m.hp * 0.8); },
  },
  {
    id: 'givre', name: 'Cœur de givre', icon: '❄️',
    desc: 'Élément glace, résistant au physique. Change d\'arme ou souffre.',
    apply: (m) => { m.element = 'frost' as Element; m.resistances = ['physical']; m.hp = Math.round(m.hp * 1.3); },
  },
  {
    id: 'ombre', name: 'Voile d\'ombre', icon: '🌑',
    desc: 'Élément ténèbres, résistant au magique. La lumière est ton amie.',
    apply: (m) => { m.element = 'dark' as Element; m.resistances = ['magical']; m.hp = Math.round(m.hp * 1.3); },
  },
  {
    id: 'fragile', name: 'Verre et lames', icon: '🔪',
    desc: 'Fragile comme du verre, mortel comme une lame. Deux erreurs et c\'est fini.',
    apply: (m) => { m.hp = Math.round(m.hp * 0.45); m.atk = Math.round(m.atk * 1.9); },
  },
];

export interface RiftInfo {
  /** Index de semaine — sert de graine et d'identifiant. */
  week: number;
  /** Clé stable stockée sur le joueur (`w2870`). */
  key: string;
  biome: BiomeId;
  modifier: RiftModifier;
  /** Fin de la semaine en cours (ms). */
  endsAt: number;
}

/**
 * Faille de la semaine courante.
 *
 * Le pas du modificateur (5) doit être PREMIER AVEC leur nombre (6), sinon la
 * suite ne parcourt qu'une partie de la liste : avec un pas de 3, `(w*3)%6` ne
 * vaut jamais que 0 ou 3 et quatre modificateurs sur six ne sortaient jamais.
 * Avec 5, les six défilent ; combiné aux 8 biomes (pas de 1), la paire ne se
 * répète qu'au bout de 24 semaines.
 */
export function currentRift(now: number = Date.now(), level = 50): RiftInfo {
  const week = Math.floor(now / RIFT_WEEK_MS);
  // Seuls les biomes déjà accessibles au joueur peuvent sortir : une Faille
  // dans une zone verrouillée serait un rendez-vous auquel il ne peut pas venir.
  const pool = BIOME_LIST.filter((b) => b.minLevel <= level);
  const biomes = pool.length > 0 ? pool : BIOME_LIST;
  const biome = biomes[week % biomes.length].id;
  const modifier = RIFT_MODIFIERS[(week * 5) % RIFT_MODIFIERS.length];
  return { week, key: `w${week}`, biome, modifier, endsAt: (week + 1) * RIFT_WEEK_MS };
}

/** Le joueur a-t-il déjà validé la Faille de cette semaine ? */
export function riftCleared(p: PlayerState, rift: RiftInfo): boolean {
  return p.riftClearedWeek === rift.key;
}

/**
 * Monstre de la Faille : un habitant du biome tiré, gonflé au niveau du joueur
 * puis passé au modificateur. On part de `pickMonster` pour que la Faille garde
 * l'identité de sa zone (nom, butin, faiblesses) au lieu d'être un sac de PV
 * générique de plus.
 */
export function buildRiftMonster(p: PlayerState, rift: RiftInfo): MonsterDef {
  const lvl = Math.max(1, p.level);
  const base = pickMonster(rift.biome, currentPhase(), lvl);
  const m: MonsterDef = {
    ...base,
    id: 'rift',
    name: `${base.name} de la Faille`,
    emoji: '🌀',
    // Calibré RELATIVEMENT au mini-boss (`base.hp*5 + lvl*180`,
    // `base.atk*1.6 + lvl*1.5`), qui est du contenu déjà en jeu et jugé
    // jouable. La Faille vise un cran en dessous en PV, et surtout reste sous
    // son ATK une fois le modificateur appliqué : le premier réglage montait à
    // 1716 d'attaque contre 553 pour le mini-boss, soit un one-shot garanti.
    hp: Math.round(base.hp * 2.6 + lvl * 70),
    atk: Math.round(base.atk * 1.15 + lvl * 0.6),
    def: Math.round(base.def * 1.1 + lvl * 0.3),
    xp: Math.round(base.xp * 5 + lvl * 70),
    gold: [base.gold[0] * 5 + lvl * 15, base.gold[1] * 5 + lvl * 30] as [number, number],
    loot: { ...(base.loot ?? {}), hi_potion: 0.5, upgrade_matrix: 0.15 },
  };
  rift.modifier.apply(m);
  // Un modificateur ne doit jamais produire un monstre inoffensif ou immortel.
  m.hp = Math.max(50, m.hp);
  m.atk = Math.max(1, m.atk);
  return m;
}

/** Récompense du PREMIER passage de la semaine (en plus du butin de combat). */
export function claimRift(p: PlayerState, rift: RiftInfo): boolean {
  if (riftCleared(p, rift)) return false;
  p.riftClearedWeek = rift.key;
  grantShards(p, RIFT_SHARDS);
  p.gold += 1500 + p.level * 60;
  return true;
}

/** Temps restant avant la prochaine Faille, formaté court. */
export function riftTimeLeft(rift: RiftInfo, now = Date.now()): string {
  const ms = Math.max(0, rift.endsAt - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}j ${h}h` : `${h}h`;
}
