import type { Phase } from './types';

/** Phase du cycle jour/nuit en fonction de l'heure réelle locale. */
export function phaseForHour(hour: number): Phase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

export function currentPhase(date = new Date()): Phase {
  return phaseForHour(date.getHours());
}

export const PHASE_LABEL: Record<Phase, string> = {
  dawn: 'Aube',
  day: 'Jour',
  dusk: 'Crépuscule',
  night: 'Nuit',
};

export const PHASE_EMOJI: Record<Phase, string> = {
  dawn: '🌅',
  day: '☀️',
  dusk: '🌇',
  night: '🌙',
};

/** Bonus globaux liés à la phase (multiplicateurs). */
export const PHASE_MODIFIERS: Record<Phase, { xp: number; gold: number; note: string }> = {
  dawn: { xp: 1.15, gold: 1.0, note: 'Les bêtes sont engourdies : +15% XP.' },
  day: { xp: 1.0, gold: 1.1, note: 'Marchés actifs : +10% or.' },
  dusk: { xp: 1.1, gold: 1.1, note: 'Heure dorée : +10% XP et or.' },
  night: { xp: 1.0, gold: 1.0, note: 'Créatures nocturnes rôdent. Loot rare plus probable.' },
};
