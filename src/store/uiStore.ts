import { create } from 'zustand';

export type WindowKind =
  | 'profile'
  | 'hunt'
  | 'map'
  | 'inventory'
  | 'equipment'
  | 'cooldown'
  | 'experience'
  | 'casino'
  | 'shop'
  | 'craft'
  | 'gather'
  | 'market'
  | 'dungeon'
  | 'talents'
  | 'quests'
  | 'duel'
  | 'cardjitsu'
  | 'team'
  | 'guild'
  | 'familiar'
  | 'news'
  | 'boss'
  | 'chat'
  | 'leaderboard'
  | 'stats'
  | 'help'
  | 'wiki'
  | 'admin'
  | 'events'
  | 'achievements'
  | 'fateshop'
  | 'season'
  | 'enchant'
  | 'forgeron'
  | 'prestige'
  | 'ascension'
  | 'endless'
  | 'concoction'
  | 'settings'
  | 'tuto'
  | 'levelup'
  | 'veteran';

export interface GameWindow {
  id: string;
  kind: WindowKind;
  /** Données spécifiques passées à la fenêtre (ex: résultat de combat). */
  payload?: unknown;
  z: number;
  /** Disparition automatique après ce délai (ms) si défini. */
  ttl?: number;
  /** Override dynamique du titre/couleur de l'en-tête (ex: donjon → raid). */
  title?: string;
  accent?: string;
}

export interface WindowPref {
  x: number;
  y: number;
  minimized: boolean;
}

interface UiState {
  windows: GameWindow[];
  topZ: number;
  prefs: Partial<Record<WindowKind, WindowPref>>;
  open: (kind: WindowKind, payload?: unknown, opts?: { ttl?: number; singleton?: boolean }) => string;
  close: (id: string) => void;
  closeAll: () => void;
  focus: (id: string) => void;
  setChrome: (kind: WindowKind, chrome: { title?: string; accent?: string }) => void;
  savePref: (kind: WindowKind, pref: Partial<WindowPref>) => void;
  resetPrefs: () => void;
  saveLayout: () => void;
  loadLayout: () => void;
}

let counter = 0;

const PREFS_KEY = 'rptext.windowPrefs';
function loadPrefs(): Partial<Record<WindowKind, WindowPref>> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const useUi = create<UiState>((set, get) => ({
  windows: [],
  topZ: 10,
  prefs: loadPrefs(),
  open: (kind, payload, opts) => {
    const z = get().topZ + 1;
    // singleton : si une fenêtre du même type existe, on la remplace/focus.
    if (opts?.singleton) {
      const existing = get().windows.find((w) => w.kind === kind);
      if (existing) {
        set((s) => ({
          topZ: z,
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, payload, z } : w,
          ),
        }));
        return existing.id;
      }
    }
    const id = `w${++counter}`;
    set((s) => ({
      topZ: z,
      windows: [...s.windows, { id, kind, payload, z, ttl: opts?.ttl }],
    }));
    return id;
  },
  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),
  closeAll: () => set({ windows: [] }),
  focus: (id) => {
    const z = get().topZ + 1;
    set((s) => ({
      topZ: z,
      windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
    }));
  },
  setChrome: (kind, chrome) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.kind === kind ? { ...w, title: chrome.title, accent: chrome.accent } : w)),
    }));
  },
  savePref: (kind, pref) => {
    set((s) => {
      const newPrefs = { ...s.prefs, [kind]: { ...s.prefs[kind], ...pref } as WindowPref };
      localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
      return { prefs: newPrefs };
    });
  },
  resetPrefs: () => {
    localStorage.removeItem(PREFS_KEY);
    set({ prefs: {} });
  },
  saveLayout: () => {
    const s = get();
    // Ne sauvegarde que les fenêtres sans payload complexe pour éviter les soucis de sérialisation
    const layout = s.windows.filter(w => !w.payload).map(w => w.kind);
    localStorage.setItem('rptext.savedLayout', JSON.stringify(layout));
  },
  loadLayout: () => {
    try {
      const raw = localStorage.getItem('rptext.savedLayout');
      if (raw) {
        const layout: WindowKind[] = JSON.parse(raw);
        layout.forEach(kind => get().open(kind, undefined, { singleton: true }));
      }
    } catch {}
  }
}));
