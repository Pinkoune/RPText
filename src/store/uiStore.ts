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
  | 'boss'
  | 'chat'
  | 'leaderboard'
  | 'stats'
  | 'help';

export interface GameWindow {
  id: string;
  kind: WindowKind;
  /** Données spécifiques passées à la fenêtre (ex: résultat de combat). */
  payload?: unknown;
  z: number;
  /** Disparition automatique après ce délai (ms) si défini. */
  ttl?: number;
}

interface UiState {
  windows: GameWindow[];
  topZ: number;
  open: (kind: WindowKind, payload?: unknown, opts?: { ttl?: number; singleton?: boolean }) => string;
  close: (id: string) => void;
  closeAll: () => void;
  focus: (id: string) => void;
}

let counter = 0;

export const useUi = create<UiState>((set, get) => ({
  windows: [],
  topZ: 10,
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
}));
