import { useEffect, useState } from 'react';
import { currentPhase } from '../game/daynight';
import type { Phase } from '../game/types';

/** Renvoie l'heure et la phase courante, mis à jour chaque minute. */
export function useClock(): { now: Date; phase: Phase } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return { now, phase: currentPhase(now) };
}
