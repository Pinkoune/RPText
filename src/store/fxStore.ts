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

interface FxState {
  /** Vrai = alléger/couper les effets de fond lourds. */
  reduced: boolean;
  setReduced: (v: boolean) => void;
}

export const useFx = create<FxState>((set) => ({
  reduced: initialReduced(),
  setReduced: (reduced) => set({ reduced }),
}));
