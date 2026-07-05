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
