// Le Forgeron Renold n'ouvre boutique que le week-end : du vendredi 21h au
// dimanche 21h (heure locale). Déterministe, pas de backend nécessaire.

const OPEN_DAY = 5;  // vendredi
const OPEN_HOUR = 21;
const CLOSE_DAY = 0; // dimanche
const CLOSE_HOUR = 21;

export function isBlacksmithOpen(now: number = Date.now()): boolean {
  const d = new Date(now);
  const day = d.getDay(); // 0=dim..6=sam
  const hour = d.getHours();

  if (day === OPEN_DAY) return hour >= OPEN_HOUR;
  if (day === 6) return true; // samedi : ouvert toute la journée
  if (day === CLOSE_DAY) return hour < CLOSE_HOUR;
  return false;
}

/** Prochaine ouverture (vendredi 21h), en ms depuis maintenant. 0 si déjà ouvert. */
export function msToBlacksmithOpen(now: number = Date.now()): number {
  if (isBlacksmithOpen(now)) return 0;
  const d = new Date(now);
  const next = new Date(now);
  let daysUntilFriday = (OPEN_DAY - d.getDay() + 7) % 7;
  if (daysUntilFriday === 0 && d.getHours() >= OPEN_HOUR) daysUntilFriday = 7;
  next.setDate(d.getDate() + daysUntilFriday);
  next.setHours(OPEN_HOUR, 0, 0, 0);
  return Math.max(0, next.getTime() - now);
}

/** Prochaine fermeture (dimanche 21h), en ms depuis maintenant. 0 si déjà fermé. */
export function msToBlacksmithClose(now: number = Date.now()): number {
  if (!isBlacksmithOpen(now)) return 0;
  const d = new Date(now);
  const next = new Date(now);
  let daysUntilSunday = (CLOSE_DAY - d.getDay() + 7) % 7;
  if (daysUntilSunday === 0 && d.getHours() >= CLOSE_HOUR) daysUntilSunday = 7;
  next.setDate(d.getDate() + daysUntilSunday);
  next.setHours(CLOSE_HOUR, 0, 0, 0);
  return Math.max(0, next.getTime() - now);
}
