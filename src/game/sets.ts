import type { PlayerState } from './types';
import { item } from './items';

// ─── Effets de set en combat ─────────────────────────────────────────────────
// En plus des bonus de stats passifs (voir deriveStats), porter 3 pièces d'un
// même set débloque un PROC actif qui se déclenche parfois en combat. Réutilise
// le système d'états (brûlure/gel/bouclier) déjà en place.

export type SetProcKind = 'burn' | 'chill' | 'heal' | 'shield' | 'extra';

export interface SetProc {
  setId: string;
  name: string;
  icon: string;
  color: string;
  /** Probabilité de déclenchement par attaque. */
  chance: number;
  kind: SetProcKind;
  /** Fraction (soin/bouclier = ×PV max ; extra/burn = ×ATK). */
  power: number;
}

export const SET_PROCS: Record<string, Omit<SetProc, 'setId'>> = {
  fire_set:     { name: 'Embrasement',            icon: '🔥', color: '#ff8a4a', chance: 0.35, kind: 'burn',   power: 0.35 },
  frost_set:    { name: 'Gel runique',            icon: '❄️', color: '#7ad0ff', chance: 0.35, kind: 'chill',  power: 0 },
  water_set:    { name: 'Ressac vital',           icon: '🌊', color: '#5aa6ff', chance: 0.30, kind: 'heal',   power: 0.08 },
  earth_set:    { name: 'Carapace tellurique',    icon: '🪨', color: '#c9a36a', chance: 0.30, kind: 'shield', power: 0.10 },
  wind_set:     { name: 'Rafale',                 icon: '🌪️', color: '#8fe6c8', chance: 0.32, kind: 'extra',  power: 0.8 },
  light_set:    { name: 'Bénédiction',            icon: '✨', color: '#ffe27a', chance: 0.30, kind: 'heal',   power: 0.06 },
  dark_set:     { name: "Morsure d'ombre",        icon: '👁️', color: '#c46bff', chance: 0.35, kind: 'extra',  power: 1.0 },
  obsidian_set: { name: "Rempart d'obsidienne",   icon: '⬛', color: '#b0b8c8', chance: 0.30, kind: 'shield', power: 0.12 },
};

/** Nombre de pièces équipées (non cassées) par set. */
export function equippedSetCounts(p: PlayerState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const id = p.equipped[slot];
    if (!id) continue;
    const it = item(id);
    if (!it?.setId) continue;
    const dur = p.gearDurability ? (p.gearDurability[id] ?? it.maxDurability ?? 1) : 1;
    if (dur <= 0) continue; // objet cassé : ne compte pas
    counts[it.setId] = (counts[it.setId] ?? 0) + 1;
  }
  return counts;
}

/** Description lisible de l'effet 3-pièces d'un set (pour Wiki/Forge). */
export function setProcDesc(setId: string): string | null {
  const proc = SET_PROCS[setId];
  if (!proc) return null;
  const pct = Math.round(proc.chance * 100);
  switch (proc.kind) {
    case 'burn': return `${pct}% de chance d'infliger Brûlure (${Math.round(proc.power * 100)}% ATK/tour) à chaque attaque.`;
    case 'chill': return `${pct}% de chance de Geler l'ennemi (rate son tour) à chaque attaque.`;
    case 'heal': return `${pct}% de chance de se soigner de ${Math.round(proc.power * 100)}% des PV max à chaque attaque.`;
    case 'shield': return `${pct}% de chance de gagner un bouclier (${Math.round(proc.power * 100)}% des PV max) à chaque attaque.`;
    case 'extra': return `${pct}% de chance d'infliger un coup supplémentaire (${Math.round(proc.power * 100)}% ATK) à chaque attaque.`;
    default: return null;
  }
}

/** Proc de set actif (le premier set complet à 3 pièces), ou null. */
export function activeSetProc(p: PlayerState): SetProc | null {
  const counts = equippedSetCounts(p);
  for (const [setId, n] of Object.entries(counts)) {
    if (n >= 3 && SET_PROCS[setId]) return { setId, ...SET_PROCS[setId] };
  }
  return null;
}
