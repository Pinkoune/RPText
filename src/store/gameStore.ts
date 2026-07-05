import { create } from 'zustand';
import type { PlayerState, ClassId } from '../game/types';
import { createPlayer, migratePlayer, deriveStats } from '../game/player';
import { claimDailyLogin, type DailyReward } from '../game/daily';
import type { SeasonReward } from '../game/season';
import { signInWithProvider, signOut, watchAuth, type AppUser, type AuthProviderType } from '../firebase/auth';
import { loadPlayer, savePlayer, watchGlobalWipe } from '../firebase/playerService';
import { touchPresence } from '../firebase/socialService';
import { isFirebaseConfigured } from '../firebase/config';
import { sendAutoAnnounce } from '../firebase/chatService';
import { leaveTeam } from '../firebase/groupsService';

export type Status = 'loading' | 'login' | 'create' | 'ready';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'gold';
}

export type ChatChannelKind = 'global' | 'team' | 'guild' | 'private';

export interface ChatNotif {
  id: number;
  channel: ChatChannelKind;
  name: string;
  text: string;
}

interface GameState {
  user: AppUser | null;
  player: PlayerState | null;
  status: Status;
  toasts: Toast[];
  /** Compteur incrémenté à chaque montée de niveau (déclenche l'animation). */
  levelCelebration: number;
  celebrateLevelUp: () => void;
  /** Récompense de connexion journalière à afficher (null = rien). */
  dailyReward: DailyReward | null;
  setDailyReward: (reward: DailyReward) => void;
  clearDailyReward: () => void;
  /** Récompense de fin de saison PvP à afficher (null = rien). */
  seasonReward: { tierName: string; reward: SeasonReward } | null;
  clearSeasonReward: () => void;
  initAuth: () => void;
  signIn: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  chooseClass: (cls: ClassId, name?: string) => Promise<void>;
  /** Mute le joueur via un brouillon puis sauvegarde (debounce). */
  mutate: (fn: (p: PlayerState) => void) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  /** Notifications de chat (haut-droite, colorées par canal). */
  chatNotifs: ChatNotif[];
  pushChatNotif: (n: Omit<ChatNotif, 'id'>) => void;
  dismissChatNotif: (id: number) => void;
  inCombat: boolean;
  setInCombat: (val: boolean) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let wipeUnsub: (() => void) | null = null;
let toastId = 0;
let chatNotifId = 0;

import { useUi } from './uiStore';
import { COMMANDS } from '../game/commands';

export const useGame = create<GameState>((set, get) => ({
  user: null,
  player: null,
  status: 'loading',
  toasts: [],
  levelCelebration: 0,
  dailyReward: null,
  seasonReward: null,
  inCombat: false,
  setInCombat: (val) => set({ inCombat: val }),

  celebrateLevelUp: () => set((s) => ({ levelCelebration: s.levelCelebration + 1 })),
  setDailyReward: (dailyReward) => set({ dailyReward }),
  clearDailyReward: () => set({ dailyReward: null }),
  clearSeasonReward: () => set({ seasonReward: null }),

  initAuth: () => {
    watchAuth(async (user) => {
      wipeUnsub?.();
      wipeUnsub = null;
      if (!user) {
        set({ user: null, player: null, status: 'login' });
        return;
      }
      set({ user, status: 'loading' });
      // Reset global déclenché pendant que cet onglet est ouvert : on force un
      // rechargement complet pour couper toute sauvegarde périmée et repasser
      // par loadPlayer() (qui, lui, vérifie bien le wipe).
      wipeUnsub = watchGlobalWipe(() => {
        get().toast('Le monde a été réinitialisé par un admin. Rechargement...', 'info');
        setTimeout(() => window.location.reload(), 1200);
      });
      try {
        const existing = await loadPlayer(user.uid);
        if (existing) {
          migratePlayer(existing);
          // Resync identité Google (avatar/nom peuvent changer).
          existing.name = existing.name || user.name;
          existing.photoURL = user.photoURL;
          // Récompense de connexion journalière : n'est plus automatique.
          // Le joueur doit la réclamer via l'onglet Quêtes.
          const reward = null;
          // Récompense de fin de saison (créditée par migratePlayer si rotation).
          let seasonReward: { tierName: string; reward: SeasonReward } | null = null;
          if (existing.lastSeasonReward) {
            seasonReward = { tierName: existing.lastSeasonReward.tierName, reward: existing.lastSeasonReward.reward };
            delete existing.lastSeasonReward;
          }
          set({ player: existing, status: 'ready', dailyReward: reward, seasonReward });
          if (reward || seasonReward) void savePlayer(existing);
        } else {
          set({ status: 'create' });
        }
      } catch (err) {
        console.error("Erreur de chargement Firebase:", err);
        set({ status: 'login' });
        get().toast("Erreur de base de données. As-tu bien activé Firestore ?", "bad");
      }
    });
  },

  signIn: async (provider: AuthProviderType) => {
    set({ status: 'loading' });
    try {
      await signInWithProvider(provider);
      // En mode local, watchAuth ne se redéclenche pas : on relit.
      if (!isFirebaseConfigured) {
        get().initAuth();
      }
    } catch (e) {
      set({ status: 'login' });
      get().toast('Connexion annulée.', 'bad');
    }
  },

  logout: async () => {
    // Déconnexion propre : on quitte l'équipe (si dernier membre, elle est
    // dissoute par leaveTeam). Le kick des membres hors ligne restants est géré
    // par PresenceTracker chez les autres joueurs en ligne.
    const cur = get().player;
    if (cur?.teamId) { try { await leaveTeam(cur.teamId, cur.uid); } catch { /* ignore */ } }
    await signOut();
    set({ user: null, player: null, status: 'login' });
  },

  chooseClass: async (cls, name) => {
    const user = get().user;
    if (!user) return;
    const p = createPlayer(user.uid, name || user.name, user.photoURL, cls);
    const isLegacy = localStorage.getItem(`rptext.legacy.${user.uid}`) === 'true';
    const legacyCreatedAtStr = localStorage.getItem(`rptext.legacyCreatedAt.${user.uid}`);
    const wasAdmin = localStorage.getItem(`rptext.wasAdmin.${user.uid}`) === 'true';
    if (isLegacy) {
      p.gold = (p.gold || 0) + 1000;
      p.inventory['pioneer_medallion'] = (p.inventory['pioneer_medallion'] || 0) + 1;
      p.title = "Vétéran de l'Ancien Monde";
      p.unlockedTitles = [...(p.unlockedTitles || []), "Vétéran de l'Ancien Monde"];
      if (legacyCreatedAtStr) {
        p.legacyCreatedAt = parseInt(legacyCreatedAtStr, 10);
      }
      p.isLegacy = true;
      localStorage.removeItem(`rptext.legacy.${user.uid}`);
      localStorage.removeItem(`rptext.legacyCreatedAt.${user.uid}`);
    }
    if (wasAdmin) {
      p.isAdmin = true;
      localStorage.removeItem(`rptext.wasAdmin.${user.uid}`);
    }
    
    await savePlayer(p);
    set({ player: p, status: 'ready' });
    
    if (isLegacy) {
      useUi.getState().open('veteran', undefined, { singleton: true });
    } else {
      useUi.getState().open('tuto', undefined, { singleton: true });
    }
    get().toast(`Bienvenue, ${p.name} ! Ton aventure commence.`, 'good');
  },

  mutate: (fn) => {
    const cur = get().player;
    if (!cur) return;
    const draft: PlayerState = structuredClone(cur);
    fn(draft);

    const draftMaxHp = deriveStats(draft).maxHp;
    if (draft.hp > draftMaxHp) {
      draft.hp = draftMaxHp;
    }

    if (draft.level > cur.level) {
      get().celebrateLevelUp();
      const unlocked = COMMANDS.filter(c => c.reqLevel && c.reqLevel > cur.level && c.reqLevel <= draft.level).map(c => c.name);
      useUi.getState().open('levelup', { newLevel: draft.level, unlockedFeatures: unlocked }, { singleton: true });
      // Annonces de palier dans le chat mondial
      const ANNOUNCE_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40];
      if (ANNOUNCE_LEVELS.includes(draft.level)) {
        sendAutoAnnounce(`⭐ ${draft.name} vient d'atteindre le niveau ${draft.level} !`);
      }
    }

    // Annonce Endless si l'étage dépasse un palier notable
    const ENDLESS_MILESTONES = [10, 25, 50, 100];
    if ((draft.endlessBest ?? 0) > (cur.endlessBest ?? 0)) {
      const newBest = draft.endlessBest ?? 0;
      const milestone = ENDLESS_MILESTONES.find(m => m <= newBest && m > (cur.endlessBest ?? 0));
      if (milestone) {
        sendAutoAnnounce(`🔥 ${draft.name} a atteint l'étage ${milestone} dans les Abysses !`);
      }
    }

    set({ player: draft });
    touchPresence(); // toute action compte comme activité (présence "en ligne")
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

  chatNotifs: [],
  pushChatNotif: (n) => {
    const id = ++chatNotifId;
    set((s) => ({ chatNotifs: [...s.chatNotifs, { id, ...n }] }));
    setTimeout(() => get().dismissChatNotif(id), 5000);
  },
  dismissChatNotif: (id) => set((s) => ({ chatNotifs: s.chatNotifs.filter((n) => n.id !== id) })),
}));
