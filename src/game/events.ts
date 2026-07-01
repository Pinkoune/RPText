import type { BiomeId } from './types';

// ─── Événements du monde ────────────────────────────────────────────────────
// Un événement mondial (identique pour tous) + un événement régional (propre
// au biome du joueur) changent toutes les ROTATION_MS. Déterministe : calculé
// depuis l'horloge, donc réellement synchronisé pour tout le monde sans
// backend dédié — deux joueurs dans la même fenêtre de temps voient le même
// événement mondial, et le même événement régional s'ils sont dans le même
// biome.

export interface EventEffect {
  atkPct?: number;
  defPct?: number;
  hpPct?: number;
  goldMult?: number;
  xpMult?: number;
}

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  kind: 'buff' | 'debuff' | 'neutral';
  desc: string;
  effect: EventEffect;
}

export const ROTATION_MS = 3 * 60 * 60 * 1000; // 3h

// ── Mondiaux : touchent tous les joueurs, peu importe leur biome ──
export const GLOBAL_EVENTS: EventDef[] = [
  { id: 'g_calm', name: 'Accalmie', icon: '🕊️', kind: 'neutral', desc: 'Rien à signaler dans le monde.', effect: {} },
  { id: 'g_blessing', name: 'Bénédiction mondiale', icon: '✨', kind: 'buff', desc: '+8% or gagné, partout.', effect: { goldMult: 0.08 } },
  { id: 'g_harvest', name: 'Grande moisson', icon: '🌾', kind: 'buff', desc: '+10% XP gagnée, partout.', effect: { xpMult: 0.10 } },
  { id: 'g_eclipse', name: 'Éclipse', icon: '🌑', kind: 'debuff', desc: '-8% ATK, partout.', effect: { atkPct: -0.08 } },
  { id: 'g_storm', name: 'Tempête planétaire', icon: '⛈️', kind: 'debuff', desc: '-6% PV max, partout.', effect: { hpPct: -0.06 } },
];

// ── Régionaux : uniquement pour les joueurs présents dans ce biome ──
export const BIOME_EVENTS: Record<BiomeId, EventDef[]> = {
  forest: [
    { id: 'fo_calm', name: 'Sous-bois paisible', icon: '🌲', kind: 'neutral', desc: 'Rien de particulier en forêt.', effect: {} },
    { id: 'fo_bloom', name: 'Floraison', icon: '🌸', kind: 'buff', desc: '+10% XP en forêt.', effect: { xpMult: 0.10 } },
    { id: 'fo_fog', name: 'Brouillard dense', icon: '🌫️', kind: 'debuff', desc: '-8% DEF en forêt.', effect: { defPct: -0.08 } },
  ],
  plains: [
    { id: 'pl_calm', name: 'Vent léger', icon: '🌬️', kind: 'neutral', desc: 'Rien de particulier en plaine.', effect: {} },
    { id: 'pl_wind', name: 'Vent favorable', icon: '🍃', kind: 'buff', desc: '+8% ATK en plaine.', effect: { atkPct: 0.08 } },
    { id: 'pl_gale', name: 'Bourrasque', icon: '🌪️', kind: 'debuff', desc: '-8% or gagné en plaine.', effect: { goldMult: -0.08 } },
  ],
  mountains: [
    { id: 'mo_calm', name: 'Air pur', icon: '🏔️', kind: 'neutral', desc: 'Rien de particulier dans les pics.', effect: {} },
    { id: 'mo_echo', name: 'Écho des cimes', icon: '📯', kind: 'buff', desc: '+8% DEF dans les pics.', effect: { defPct: 0.08 } },
    { id: 'mo_avalanche', name: 'Risque d\'avalanche', icon: '🏔️', kind: 'debuff', desc: '-8% PV max dans les pics.', effect: { hpPct: -0.08 } },
  ],
  desert: [
    { id: 'de_calm', name: 'Chaleur stable', icon: '🏜️', kind: 'neutral', desc: 'Rien de particulier dans les dunes.', effect: {} },
    { id: 'de_mirage', name: 'Mirage doré', icon: '🌅', kind: 'buff', desc: '+10% or gagné dans les dunes.', effect: { goldMult: 0.10 } },
    { id: 'de_heatwave', name: 'Canicule', icon: '🥵', kind: 'debuff', desc: '-8% ATK dans les dunes.', effect: { atkPct: -0.08 } },
  ],
  swamp: [
    { id: 'sw_calm', name: 'Brume stagnante', icon: '🐸', kind: 'neutral', desc: 'Rien de particulier au marais.', effect: {} },
    { id: 'sw_bloom', name: 'Efflorescence', icon: '🍄', kind: 'buff', desc: '+10% XP au marais.', effect: { xpMult: 0.10 } },
    { id: 'sw_miasma', name: 'Miasmes toxiques', icon: '☠️', kind: 'debuff', desc: '-8% PV max au marais.', effect: { hpPct: -0.08 } },
  ],
  frozen: [
    { id: 'fr_calm', name: 'Silence glacé', icon: '❄️', kind: 'neutral', desc: 'Rien de particulier dans l\'Abysse.', effect: {} },
    { id: 'fr_aurora', name: 'Aurore boréale', icon: '🌌', kind: 'buff', desc: '+10% ATK dans l\'Abysse.', effect: { atkPct: 0.10 } },
    { id: 'fr_frostbite', name: 'Gelures', icon: '🥶', kind: 'debuff', desc: '-8% DEF dans l\'Abysse.', effect: { defPct: -0.08 } },
  ],
};

function pickDeterministic<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length];
}

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function rotationWindow(now: number): number {
  return Math.floor(now / ROTATION_MS);
}

export function currentGlobalEvent(now = Date.now()): EventDef {
  return pickDeterministic(GLOBAL_EVENTS, rotationWindow(now));
}

export function currentBiomeEvent(biome: BiomeId, now = Date.now()): EventDef {
  const list = BIOME_EVENTS[biome];
  return pickDeterministic(list, rotationWindow(now) + hashStr(biome));
}

/** Horodatage (ms) de la prochaine rotation d'événements. */
export function nextRotationAt(now = Date.now()): number {
  return (rotationWindow(now) + 1) * ROTATION_MS;
}

/** Effet combiné (mondial + régional) actif pour un biome donné, avec valeurs par défaut à 0. */
export function activeEventEffect(biome: BiomeId, now = Date.now()): Required<EventEffect> {
  const g = currentGlobalEvent(now).effect;
  const b = currentBiomeEvent(biome, now).effect;
  return {
    atkPct: (g.atkPct ?? 0) + (b.atkPct ?? 0),
    defPct: (g.defPct ?? 0) + (b.defPct ?? 0),
    hpPct: (g.hpPct ?? 0) + (b.hpPct ?? 0),
    goldMult: (g.goldMult ?? 0) + (b.goldMult ?? 0),
    xpMult: (g.xpMult ?? 0) + (b.xpMult ?? 0),
  };
}
