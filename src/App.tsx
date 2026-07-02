import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { useClock } from './hooks/useClock';
import { watchNotifications } from './firebase/chatService';
import Background from './components/Background';
import Login from './components/Login';
import ClassSelect from './components/ClassSelect';
import Topbar from './components/Topbar';
import CommandBar from './components/CommandBar';
import WindowManager from './components/WindowManager';
import Toasts from './components/Toasts';
import ChatNotifs from './components/ChatNotifs';
import LevelUpFx from './components/LevelUpFx';
import PatchNotesModal from './components/PatchNotesModal';
import DailyRewardModal from './components/DailyRewardModal';
import SeasonRewardModal from './components/SeasonRewardModal';
import { setAmbient, stopAmbientMusic } from './game/sound';

import PresenceTracker from './components/PresenceTracker';

export default function App() {
  const status = useGame((s) => s.status);
  const player = useGame((s) => s.player);
  const initAuth = useGame((s) => s.initAuth);
  const { phase } = useClock();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Musique d'ambiance : suit le biome et la phase une fois en jeu.
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    setAmbient(phase, player.biome);
  }, [status, phase, player?.biome]);

  useEffect(() => () => stopAmbientMusic(), []);

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
      <CommandBar />
      <Toasts />
      <ChatNotifs />
      <LevelUpFx />
      <PatchNotesModal />
      <DailyRewardModal />
      <SeasonRewardModal />
    </div>
  );
}
