/**
 * Fait défiler un journal de combat jusqu'en bas — SANS emporter la carte avec.
 *
 * Les six cartes à journal (Chasse, Donjon, Abysses, Duel, Rituel, Chat)
 * faisaient toutes `logEnd.current?.scrollIntoView()`. Or `scrollIntoView`
 * défile **tous les conteneurs ancêtres**, pas seulement le cadre du journal :
 * sur mobile, où la fenêtre occupe tout l'écran et défile elle-même, chaque
 * nouvelle ligne de log poussait donc le HUD du monstre (et sa barre de vie)
 * au-dessus de la zone visible. Mesuré sur un écran 390×844 : `scrollTop` du
 * conteneur de carte à 228px, premier bloc hors champ.
 *
 * On remonte donc jusqu'au premier ancêtre réellement défilant, et on s'arrête
 * NET à la limite marquée `data-window-scroll` (posée par `Window.tsx` sur la
 * zone de contenu de la fenêtre) : le journal défile, la carte ne bouge pas.
 */
export function scrollLogToEnd(sentinel: HTMLElement | null): void {
  let box = sentinel?.parentElement ?? null;
  while (box) {
    // Limite de la fenêtre : au-delà, on défilerait la carte entière.
    if (box.hasAttribute('data-window-scroll')) return;
    if (box.scrollHeight > box.clientHeight) {
      box.scrollTop = box.scrollHeight;
      return;
    }
    box = box.parentElement;
  }
}
