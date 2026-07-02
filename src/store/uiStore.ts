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
  | 'events'
  | 'achievements'
  | 'fateshop';

export interface GameWindow {
  id: string;
  kind: WindowKind;
  /** Données spécifiques passées à la fenêtre (ex: résultat de combat). */
  payload?: unknown;
  z: number;
  /** Disparition automatique après ce délai (ms) si défini. */
  ttl?: number;
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
  savePref: (kind: WindowKind, pref: Partial<WindowPref>) => void;
  resetPrefs: () => void;
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
  }
}));
