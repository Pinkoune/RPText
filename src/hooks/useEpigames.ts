import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { ACHIEVEMENTS, isUnlocked } from '../game/achievements';

/**
 * Pont Epigames — relie RPText au portail quand le jeu est lancé depuis lui.
 *
 * Le SDK (chargé dans index.html depuis le portail) parle au portail en
 * postMessage : RPText n'écrit JAMAIS dans la base du portail, il lui envoie
 * un message et le portail écrit avec le compte du joueur déjà connecté
 * là-bas. Donc pas de SSO, pas de Firebase partagé, rien à configurer ici.
 *
 * Lancé hors du portail (URL directe), `Epigames.available` est false et tout
 * devient no-op : un seul build sert les deux cas.
 */

export interface EpigamesSession {
  user: { uid: string; displayName: string; avatar: string };
  achievements: { code: string; title: string; description: string; unlocked: boolean }[];
}

export interface EpigamesNotification {
  title: string;
  body?: string;
  icon?: string;
}

interface EpigamesApi {
  available: boolean;
  session: EpigamesSession | null;
  onReady(fn: (s: EpigamesSession) => void): void;
  onNotification(fn: (n: EpigamesNotification) => void): void;
  unlock(code: string): void;
  hasUnlocked(code: string): boolean;
  toast(title: string, body?: string): void;
}

declare global {
  interface Window {
    Epigames?: EpigamesApi;
  }
}

/** Le SDK peut manquer (jeu ouvert hors portail, ou portail injoignable). */
function sdk(): EpigamesApi | null {
  return typeof window !== 'undefined' && window.Epigames?.available
    ? window.Epigames
    : null;
}

export function useEpigames(): void {
  const player = useGame((s) => s.player);
  const toast = useGame((s) => s.toast);

  // ---- notifications du portail -> toasts RPText ----
  // Indispensable ici : RPText tourne dans SON onglet, donc les bulles du
  // portail (autre onglet) sont invisibles pour le joueur.
  const wired = useRef(false);
  useEffect(() => {
    const api = sdk();
    if (!api || wired.current) return;
    wired.current = true;

    api.onReady((s) => {
      toast(`Connecté au portail Epigames — salut ${s.user.displayName} !`, 'good');
    });

    api.onNotification((n) => {
      toast(`${n.icon ?? '🔔'} ${n.title}${n.body ? ` — ${n.body}` : ''}`, 'info');
    });
  }, [toast]);

  // ---- succès RPText -> succès du portail ----
  // On miroite l'état ATTEINT (value >= goal), pas le « réclamé » : le joueur
  // ne doit pas avoir à passer réclamer sa récompense pour que le portail
  // reflète son exploit. L'id du succès RPText EST le `code` côté portail.
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const api = sdk();
    if (!api || !player) return;
    for (const def of ACHIEVEMENTS) {
      if (sent.current.has(def.id)) continue;
      if (!isUnlocked(player, def)) continue;
      sent.current.add(def.id);
      api.unlock(def.id);
    }
  }, [player]);
}
