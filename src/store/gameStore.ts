import { create } from 'zustand';
import type { PlayerState, ClassId } from '../game/types';
import { createPlayer, migratePlayer } from '../game/player';
import { signInWithGoogle, signOut, watchAuth, type AppUser } from '../firebase/auth';
import { loadPlayer, savePlayer } from '../firebase/playerService';

export type Status = 'loading' | 'login' | 'create' | 'ready';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

interface GameState {
  user: AppUser | null;
  player: PlayerState | null;
  status: Status;
  toasts: Toast[];
  /** Compteur incrémenté à chaque montée de niveau (déclenche l'animation). */
  levelCelebration: number;
  celebrateLevelUp: () => void;
  initAuth: () => void;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  chooseClass: (cls: ClassId, name?: string) => Promise<void>;
  /** Mute le joueur via un brouillon puis sauvegarde (debounce). */
  mutate: (fn: (p: PlayerState) => void) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

export const useGame = create<GameState>((set, get) => ({
  user: null,
  player: null,
  status: 'loading',
  toasts: [],
  levelCelebration: 0,

  celebrateLevelUp: () => set((s) => ({ levelCelebration: s.levelCelebration + 1 })),

  initAuth: () => {
    watchAuth(async (user) => {
      if (!user) {
        set({ user: null, player: null, status: 'login' });
        return;
      }
      set({ user, status: 'loading' });
      const existing = await loadPlayer(user.uid);
      if (existing) {
        migratePlayer(existing);
        // Resync identité Google (avatar/nom peuvent changer).
        existing.name = existing.name || user.name;
        existing.photoURL = user.photoURL;
        set({ player: existing, status: 'ready' });
      } else {
        set({ status: 'create' });
      }
    });
  },

  signIn: async () => {
    set({ status: 'loading' });
    try {
      await signInWithGoogle();
      // En mode local, watchAuth ne se redéclenche pas : on relit.
      get().initAuth();
    } catch (e) {
      set({ status: 'login' });
      get().toast('Connexion annulée.', 'bad');
    }
  },

  logout: async () => {
    await signOut();
    set({ user: null, player: null, status: 'login' });
  },

  chooseClass: async (cls, name) => {
    const user = get().user;
    if (!user) return;
    const p = createPlayer(user.uid, name || user.name, user.photoURL, cls);
    await savePlayer(p);
    set({ player: p, status: 'ready' });
    get().toast(`Bienvenue, ${p.name} ! Ton aventure commence.`, 'good');
  },

  mutate: (fn) => {
    const cur = get().player;
    if (!cur) return;
    const draft: PlayerState = structuredClone(cur);
    fn(draft);
    set({ player: draft });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const p = get().player;
      if (p) void savePlayer(p);
    }, 800);
  },

  toast: (text, tone = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), 3800);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
