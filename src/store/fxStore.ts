import { create } from 'zustand';

// ─── Effets visuels lourds (fond animé, particules, blur) ────────────────────
// Ces animations CSS tournent en continu et sollicitent le GPU en permanence
// (compositing/blur à chaque frame) — principale cause de chauffe du PC. Ce
// petit store expose un flag `reduced` piloté par le paramètre client
// `disableAnimations` ET par la préférence système `prefers-reduced-motion`.

function initialReduced(): boolean {
  try {
    const saved = localStorage.getItem('rptext.settings');
    if (saved && JSON.parse(saved).disableAnimations) return true;
  } catch { /* ignore */ }
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function initialCompact(): boolean {
  try {
    const saved = localStorage.getItem('rptext.settings');
    return !!(saved && JSON.parse(saved).compactMode);
  } catch {
    return false;
  }
}

/**
 * Les deux réglages doivent atteindre le CSS, pas seulement React : le plus
 * coûteux de tous — le `backdrop-filter` des fenêtres — vit dans une règle CSS
 * et aucun composant ne peut le désactiver depuis une prop. On reflète donc
 * l'état sur l'élément racine.
 */
function syncRoot(reduced: boolean, compact: boolean): void {
  try {
    const el = document.documentElement;
    el.classList.toggle('fx-reduced', reduced);
    el.classList.toggle('fx-compact', compact);
  } catch { /* SSR / environnement sans DOM */ }
}

interface FxState {
  /** Vrai = alléger/couper les effets de fond lourds. */
  reduced: boolean;
  /** Vrai = interface dense (moins de marges, textes plus serrés). */
  compact: boolean;
  setReduced: (v: boolean) => void;
  setCompact: (v: boolean) => void;
}

export const useFx = create<FxState>((set, get) => ({
  reduced: initialReduced(),
  compact: initialCompact(),
  setReduced: (reduced) => { set({ reduced }); syncRoot(reduced, get().compact); },
  setCompact: (compact) => { set({ compact }); syncRoot(get().reduced, compact); },
}));

// État initial appliqué dès le chargement du module.
syncRoot(useFx.getState().reduced, useFx.getState().compact);
