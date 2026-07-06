import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { useClock } from './hooks/useClock';
import { watchNotifications } from './firebase/chatService';
import Background from './components/Background';
import Login from './components/Login';
import ClassSelect from './components/ClassSelect';
import Topbar from './components/Topbar';
import CommandBar from './components/CommandBar';
import MobileNav from './components/MobileNav';
import WindowManager from './components/WindowManager';
import { useIsMobile } from './hooks/useIsMobile';
import Toasts from './components/Toasts';
import ChatNotifs from './components/ChatNotifs';
import LevelUpFx from './components/LevelUpFx';
import PatchNotesModal from './components/PatchNotesModal';
import DailyRewardModal from './components/DailyRewardModal';
import SeasonRewardModal from './components/SeasonRewardModal';
import { setAmbient, stopAmbientMusic } from './game/sound';
import { deriveStats } from './game/player';
import { listenRaidBroadcast } from './firebase/raidService';
import { setForcedRaid } from './game/raid';

import PresenceTracker from './components/PresenceTracker';
import BaitTimer from './components/BaitTimer';
import RaidBanner from './components/RaidBanner';

export default function App() {
  const status = useGame((s) => s.status);
  const player = useGame((s) => s.player);
  const initAuth = useGame((s) => s.initAuth);
  const { phase } = useClock();
  const isMobile = useIsMobile();

  useEffect(() => {
    // initAuth() renvoie le désabonnement onAuthStateChanged : sans ce cleanup,
    // React.StrictMode (dev) monte l'effet deux fois et laisse DEUX listeners
    // actifs en permanence, qui se marchent dessus sur l'état partagé (ex: le
    // watchGlobalWipe de gameStore, l'un annulant l'abonnement de l'autre).
    return initAuth();
  }, [initAuth]);

  // Musique d'ambiance : suit le biome et la phase une fois en jeu.
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    setAmbient(phase, player.biome);
  }, [status, phase, player?.biome]);

  useEffect(() => () => stopAmbientMusic(), []);

  // Gèle les animations CSS quand l'onglet passe en arrière-plan (voir index.css
  // .tab-hidden) : évite de chauffer le PC pour un fond animé que personne ne voit.
  useEffect(() => {
    const onVis = () => document.body.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Régén passive hors-combat pour les débutants (Nv.<15) : +15% PV max / 60s,
  // sans bouton ni interaction. Tick à 60s (pas 10s) : chaque tick redéclenche
  // une sauvegarde Firestore via mutate() — à 10s, un joueur bas-niveau qui
  // laisse l'onglet ouvert (même sans carte ouverte) spamme des écritures en
  // continu et peut épuiser le quota Firestore. Même total de soin/minute
  // (2.5%×6 = 15%), juste moins de sauvegardes.
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const REGEN_LEVEL_CAP = 15;
    const REGEN_PCT = 0.15;
    const id = setInterval(() => {
      const cur = useGame.getState().player;
      if (!cur || cur.level >= REGEN_LEVEL_CAP || cur.hp <= 0) return;
      if (useGame.getState().inCombat) return;
      const maxHp = deriveStats(cur).maxHp;
      if (cur.hp >= maxHp) return;
      useGame.getState().mutate((d) => {
        d.hp = Math.min(maxHp, d.hp + Math.max(1, Math.ceil(maxHp * REGEN_PCT)));
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [status, player?.uid]);

  // Fenêtre de raid forcée par un admin (debug / event).
  useEffect(() => listenRaidBroadcast((b) => setForcedRaid(b)), []);

  // Notifications de chat multi-canaux
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const unsub = watchNotifications(
      player.name,
      player.teamId,
      player.guildId,
      (msg) => {
        const channel = (msg.channel ?? 'global') as 'global' | 'team' | 'guild' | 'private';
        // Pas de notif pour le chat global (trop bruyant) — seulement équipe/guilde/privé.
        if (channel === 'global') return;
        // Pas de notif si on a déjà cette conversation sous les yeux (Chat ouvert sur le bon onglet/DM).
        const view = useGame.getState().activeChatView;
        const alreadyViewing = view && (
          (channel === 'private' && view.tab === 'private' && view.dmPeer === msg.name) ||
          (channel !== 'private' && view.tab === channel)
        );
        if (alreadyViewing) return;
        useGame.getState().pushChatNotif({ channel, name: msg.name, text: msg.text });
      }
    );
    return unsub;
  }, [status, player?.name, player?.teamId, player?.guildId]);

  if (status === 'loading') {
    return (
      <div className="grid h-full place-items-center bg-[#0b1020] text-slate-300">
        <div className="animate-pulse text-glow">Chargement de RPText…</div>
      </div>
    );
  }

  if (status === 'login') return <Login />;
  if (status === 'create') return <ClassSelect />;

  // status === 'ready'
  return (
    <div className="relative h-full w-full">
      <PresenceTracker />
      <Background biome={player?.biome ?? 'forest'} phase={phase} />
      <Topbar />
      <WindowManager />
      {isMobile ? <MobileNav /> : <CommandBar />}
      <Toasts />
      <ChatNotifs />
      <LevelUpFx />
      <PatchNotesModal />
      <DailyRewardModal />
      <SeasonRewardModal />
      <BaitTimer />
      <RaidBanner />
    </div>
  );
}
