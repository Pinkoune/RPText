import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { trackPresence, touchPresence, type OnlinePlayer } from '../firebase/socialService';
import { listenTeams, leaveTeam, transferTeamHost, type Team } from '../firebase/groupsService';

const ACTIVITY_THROTTLE_MS = 20_000;

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

  // Activité "réelle" (clic/touche/scroll), indépendante des mutations d'état :
  // avant, seul `mutate()` rafraîchissait la présence, donc naviguer l'inventaire,
  // lire le wiki ou jouer un minijeu (craft/récolte, qui ne mute qu'au tout début
  // et à la toute fin) faisait passer le joueur "🟡 Inactif" au bout de 5 min
  // alors qu'il était bien devant l'écran. Throttled pour ne pas spammer la RTDB.
  const lastTouch = useRef(0);
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch.current < ACTIVITY_THROTTLE_MS) return;
      lastTouch.current = now;
      touchPresence();
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, onActivity));
  }, [status, player?.uid]);

  // Notif quand un coéquipier quitte l'équipe — visible partout (pas seulement
  // en ayant la carte Équipe ouverte), plus longue que les notifs de chat (5s)
  // pour bien la remarquer.
  const prevTeamMembers = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!player) return;
    const myTeam = teams.find((t) => player.uid in (t.members ?? {}));
    const prev = prevTeamMembers.current;
    if (myTeam) {
      for (const [uid, name] of Object.entries(prev)) {
        if (uid !== player.uid && !(uid in myTeam.members)) {
          useGame.getState().toast(`👋 ${name} a quitté l'équipe.`, 'good', 7000);
        }
      }
      prevTeamMembers.current = Object.fromEntries(Object.entries(myTeam.members).map(([uid, m]) => [uid, m.name]));
    } else {
      prevTeamMembers.current = {};
    }
  }, [teams, player?.uid]);

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
