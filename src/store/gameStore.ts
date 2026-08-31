import { create } from 'zustand';
import type { PlayerState, ClassId } from '../game/types';
import { createPlayer, migratePlayer, deriveStats, charKey } from '../game/player';
import { claimDailyLogin, type DailyReward } from '../game/daily';
import type { SeasonReward } from '../game/season';
import { signInWithProvider, signOut, watchAuth, type AppUser, type AuthProviderType } from '../firebase/auth';
import { loadPlayer, savePlayer, watchGlobalWipe, listCharacters, deleteCharacter, type CharacterSlot } from '../firebase/playerService';
import { touchPresence } from '../firebase/socialService';
import { isFirebaseConfigured } from '../firebase/config';
import { sendAutoAnnounce } from '../firebase/chatService';
import { leaveTeam } from '../firebase/groupsService';
import { fetchSeason, watchSeason } from '../firebase/seasonService';
import { getCurrentSeason } from '../game/artifact';

export type Status = 'loading' | 'login' | 'select' | 'create' | 'ready';

/** Dernier emplacement joué, pour le reproposer en tête à la reconnexion. */
const lastSlotKey = (accountUid: string) => `rptext.lastSlot.${accountUid}`;

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
  /**
   * Durée d'absence depuis la dernière session (ms), capturée AU CHARGEMENT.
   * Indispensable : `savePlayer` écrase `lastSeen` avec l'heure courante dès
   * l'entrée en jeu, donc la lire plus tard donnerait toujours zéro.
   */
  awayMs: number;
  clearAway: () => void;
  /** Récompense de fin de saison PvP à afficher (null = rien). */
  seasonReward: { tierName: string; reward: SeasonReward } | null;
  clearSeasonReward: () => void;
  initAuth: () => () => void;
  signIn: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  chooseClass: (cls: ClassId, name?: string) => Promise<void>;
  /** Emplacements de personnage du compte (écran de sélection). */
  characters: CharacterSlot[];
  /** Emplacement visé par la création en cours. */
  pendingSlot: number;
  /** Recharge la liste des personnages depuis la base. */
  refreshCharacters: () => Promise<void>;
  /** Entre en jeu avec le personnage de cet emplacement. */
  selectCharacter: (slot: number) => Promise<void>;
  /** Ouvre la création de personnage sur un emplacement vide. */
  startCreateCharacter: (slot: number) => void;
  /** Supprime définitivement le personnage d'un emplacement. */
  removeCharacter: (slot: number) => Promise<void>;
  /** Revient à l'écran de sélection depuis la partie en cours. */
  backToSelect: () => Promise<void>;
  /** Mute le joueur via un brouillon puis sauvegarde (debounce). */
  mutate: (fn: (p: PlayerState) => void) => void;
  toast: (text: string, tone?: Toast['tone'], durationMs?: number) => void;
  dismissToast: (id: number) => void;
  /** Notifications de chat (haut-droite, colorées par canal). */
  chatNotifs: ChatNotif[];
  pushChatNotif: (n: Omit<ChatNotif, 'id'>) => void;
  dismissChatNotif: (id: number) => void;
  /** Pastille rouge persistante tant que le chat n'a pas été ouvert (les toasts s'effacent trop vite pour être fiables). */
  hasUnreadChat: boolean;
  markChatRead: () => void;
  /** Onglet/conversation actuellement affiché dans ChatCard (si ouvert) — évite de notifier une conversation déjà sous les yeux. */
  activeChatView: { tab: ChatChannelKind; dmPeer?: string } | null;
  setActiveChatView: (v: { tab: ChatChannelKind; dmPeer?: string } | null) => void;
  inCombat: boolean;
  setInCombat: (val: boolean) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let wipeUnsub: (() => void) | null = null;
let seasonUnsub: (() => void) | null = null;
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
  awayMs: 0,
  clearAway: () => set({ awayMs: 0 }),
  inCombat: false,
  setInCombat: (val) => set({ inCombat: val }),

  celebrateLevelUp: () => set((s) => ({ levelCelebration: s.levelCelebration + 1 })),
  setDailyReward: (dailyReward) => set({ dailyReward }),
  clearDailyReward: () => set({ dailyReward: null }),
  clearSeasonReward: () => set({ seasonReward: null }),

  initAuth: () => {
    return watchAuth(async (user) => {
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
        // La saison doit être connue AVANT de charger un personnage : c'est
        // `migratePlayer` qui fait tourner l'artefact, et il lui faut le bon
        // numéro sous peine de remettre l'artefact à zéro à tort.
        await fetchSeason();
        seasonUnsub?.();
        seasonUnsub = watchSeason((info) => {
          if (info.number === getCurrentSeason()) return;
          get().toast(`Une nouvelle saison commence ! Rechargement…`, 'gold');
          setTimeout(() => window.location.reload(), 1500);
        });
        const slots = await listCharacters(user.uid);
        const existing = slots.filter((s) => s.player);
        set({ characters: slots });
        if (existing.length === 0) {
          // Aucun personnage : on va droit à la création du premier.
          set({ status: 'create', pendingSlot: 0 });
        } else {
          // Au moins un personnage : écran de sélection. Un clic de plus, mais
          // c'est ce qui rend le roster visible et permet d'en changer.
          set({ status: 'select' });
        }
      } catch (err) {
        console.error("Erreur de chargement Firebase:", err);
        set({ status: 'login' });
        get().toast("Erreur de base de données. As-tu bien activé Firestore ?", "bad");
      }
    });
  },

  characters: [],
  pendingSlot: 0,

  refreshCharacters: async () => {
    const user = get().user;
    if (!user) return;
    set({ characters: await listCharacters(user.uid) });
  },

  selectCharacter: async (slot) => {
    const user = get().user;
    if (!user) return;
    set({ status: 'loading' });
    try {
      const existing = await loadPlayer(charKey(user.uid, slot));
      if (!existing) {
        set({ status: 'create', pendingSlot: slot });
        return;
      }
      // Capturé AVANT toute sauvegarde : savePlayer met `lastSeen` à l'heure
      // courante, ce qui effacerait la trace de l'absence.
      const awayMs = Math.max(0, Date.now() - (existing.lastSeen ?? Date.now()));
      migratePlayer(existing);
      // Resync identité Google (l'avatar peut changer ; le nom, lui, appartient
      // au personnage — deux persos du même compte ont des pseudos distincts).
      existing.photoURL = user.photoURL;
      // Récompense de connexion journalière : créditée automatiquement à
      // l'entrée en jeu (nouveau jour). La modale s'affiche pour la montrer ; le
      // bouton de l'onglet Quêtes sert seulement à la ré-afficher ensuite.
      const reward = claimDailyLogin(existing);
      // Récompense de fin de saison (créditée par migratePlayer si rotation).
      let seasonReward: { tierName: string; reward: SeasonReward } | null = null;
      if (existing.lastSeasonReward) {
        seasonReward = { tierName: existing.lastSeasonReward.tierName, reward: existing.lastSeasonReward.reward };
        delete existing.lastSeasonReward;
      }
      try { localStorage.setItem(lastSlotKey(user.uid), String(slot)); } catch { /* ignore */ }
      set({ player: existing, status: 'ready', dailyReward: reward, seasonReward, awayMs });
      // La migration peut avoir changé le personnage (courbe d'XP, defaults) :
      // on persiste dans tous les cas, pas seulement s'il y a une récompense.
      void savePlayer(existing);
    } catch (err) {
      console.error('Erreur de chargement du personnage:', err);
      set({ status: 'select' });
      get().toast('Impossible de charger ce personnage.', 'bad');
    }
  },

  startCreateCharacter: (slot) => set({ status: 'create', pendingSlot: slot }),

  removeCharacter: async (slot) => {
    const user = get().user;
    if (!user) return;
    try {
      await deleteCharacter(charKey(user.uid, slot));
      await get().refreshCharacters();
      get().toast('Personnage supprimé.', 'info');
    } catch (e) {
      console.error('Suppression impossible:', e);
      get().toast('Suppression impossible.', 'bad');
    }
  },

  backToSelect: async () => {
    // On quitte proprement l'équipe : sinon le personnage laissé derrière reste
    // listé comme membre alors qu'il n'est plus en ligne.
    const cur = get().player;
    if (cur?.teamId) { try { await leaveTeam(cur.teamId, cur.uid); } catch { /* ignore */ } }
    set({ player: null, status: 'loading' });
    await get().refreshCharacters();
    set({ status: 'select' });
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
    set({ user: null, player: null, status: 'login', characters: [], pendingSlot: 0 });
  },

  chooseClass: async (cls, name) => {
    const user = get().user;
    if (!user) return;
    const slot = get().pendingSlot;
    const p = createPlayer(user.uid, name || user.name, user.photoURL, cls, slot);
    // Le statut Vétéran/Admin est rattaché au COMPTE, pas au personnage : il ne
    // se transfère donc qu'au premier personnage créé (slot 0), pour éviter de
    // dupliquer la médaille de pionnier sur chaque nouvel emplacement.
    const isLegacy = slot === 0 && localStorage.getItem(`rptext.legacy.${user.uid}`) === 'true';
    const legacyCreatedAtStr = localStorage.getItem(`rptext.legacyCreatedAt.${user.uid}`);
    const wasAdmin = slot === 0 && localStorage.getItem(`rptext.wasAdmin.${user.uid}`) === 'true';
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
    try { localStorage.setItem(lastSlotKey(user.uid), String(slot)); } catch { /* ignore */ }
    set({ player: p, status: 'ready' });
    void get().refreshCharacters();

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

  toast: (text, tone = 'info', durationMs = 3800) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), durationMs);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  chatNotifs: [],
  pushChatNotif: (n) => {
    const id = ++chatNotifId;
    set((s) => ({ chatNotifs: [...s.chatNotifs, { id, ...n }], hasUnreadChat: true }));
    setTimeout(() => get().dismissChatNotif(id), 5000);
  },
  dismissChatNotif: (id) => set((s) => ({ chatNotifs: s.chatNotifs.filter((n) => n.id !== id) })),

  hasUnreadChat: false,
  markChatRead: () => set({ hasUnreadChat: false }),

  activeChatView: null,
  setActiveChatView: (v) => set({ activeChatView: v }),
}));
