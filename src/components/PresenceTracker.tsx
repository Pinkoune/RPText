import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { trackPresence, type OnlinePlayer } from '../firebase/socialService';
import { listenTeams, leaveTeam, transferTeamHost, type Team } from '../firebase/groupsService';

export default function PresenceTracker() {
  const status = useGame((s) => s.status);
  const player = useGame((s) => s.player);

  const [teams, setTeams] = useState<Team[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const unsub = listenTeams(setTeams);
    return () => unsub();
  }, [status, player?.uid]);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    
    const unsub = trackPresence(
      { uid: player.uid, name: player.name, level: player.level },
      setOnlinePlayers
    );
    return () => unsub();
  }, [status, player?.uid, player?.level, player?.name]);

  // Nettoyage automatique des équipes en fonction de la présence
  useEffect(() => {
    if (!player || teams.length === 0 || onlinePlayers.length === 0) return;
    const myTeam = teams.find(t => player.uid in (t.members ?? {}));
    if (!myTeam) return;

    const hostOnline = onlinePlayers.some(p => p.uid === myTeam.hostUid);
    
    if (myTeam.hostUid === player.uid) {
      // Je suis le chef, j'expulse les membres hors ligne
      const offlineMembers = Object.keys(myTeam.members).filter(
        uid => uid !== player.uid && !onlinePlayers.some(p => p.uid === uid)
      );
      for (const m of offlineMembers) {
        leaveTeam(myTeam.id, m);
      }
    } else {
      // Je suis membre, le chef est déconnecté
      if (!hostOnline) {
        const onlineMembers = Object.keys(myTeam.members).filter(uid => onlinePlayers.some(p => p.uid === uid));
        onlineMembers.sort(); // Tri par ordre alphabétique pour désigner un "successeur" unique
        if (onlineMembers.length > 0 && onlineMembers[0] === player.uid) {
          // C'est moi le nouveau chef !
          transferTeamHost(myTeam.id, myTeam.hostUid, player.uid);
        } else if (onlineMembers.length === 0) {
          leaveTeam(myTeam.id, player.uid);
        }
      }
    }
  }, [teams, onlinePlayers, player]);

  return null;
}
