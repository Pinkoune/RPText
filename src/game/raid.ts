// Raid : deux fenêtres d'inscription par jour (heure locale) — 10h00→10h10 et
// 20h00→20h10. Le raid « commence » à :10 (fin des inscriptions). Fenêtres
// déterministes (comme events.ts) → pas besoin de backend pour la planification.

export const RAID_MIN_LEVEL = 22;
const SIGNUP_MINUTES = 10;
const RAID_HOURS = [10, 20];

export interface RaidWindow {
  /** Vrai si on est dans une fenêtre d'inscription. */
  open: boolean;
  /** Clé unique de la session du jour (partagée par tous les joueurs). */
  key: string;
  /** Timestamp de début du raid (fin des inscriptions, :10). */
  startsAt: number;
  /** ms restantes avant la fermeture des inscriptions (0 si fermé). */
  msLeft: number;
}

// Fenêtre forcée par un admin (debug / event), alimentée par un listener RTDB.
let forced: { key: string; startsAt: number } | null = null;
export function setForcedRaid(f: { key: string; startsAt: number } | null) {
  forced = f;
}

export function getRaidWindow(now: number = Date.now()): RaidWindow {
  // Une fenêtre admin encore en cours (avant :startsAt) prime.
  if (forced && now < forced.startsAt) {
    return { open: true, key: forced.key, startsAt: forced.startsAt, msLeft: Math.max(0, forced.startsAt - now) };
  }
  const d = new Date(now);
  const h = d.getHours();
  const m = d.getMinutes();
  const hour = RAID_HOURS.find((rh) => rh === h && m < SIGNUP_MINUTES);
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${h}`;
  if (hour === undefined) {
    return { open: false, key, startsAt: 0, msLeft: 0 };
  }
  const start = new Date(now);
  start.setHours(hour, SIGNUP_MINUTES, 0, 0);
  return { open: true, key, startsAt: start.getTime(), msLeft: Math.max(0, start.getTime() - now) };
}

/** Prochaine heure d'ouverture (pour l'affichage), en ms depuis maintenant. */
export function msToNextRaid(now: number = Date.now()): number {
  let best = Infinity;
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const rh of RAID_HOURS) {
      const t = new Date(now);
      t.setDate(t.getDate() + dayOffset);
      t.setHours(rh, 0, 0, 0);
      const diff = t.getTime() - now;
      if (diff > 0 && diff < best) best = diff;
    }
  }
  return best === Infinity ? 0 : best;
}
