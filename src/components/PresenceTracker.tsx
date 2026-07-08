import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { trackPresence, touchPresence, updatePresencePlaytime, type OnlinePlayer } from '../firebase/socialService';
import { listenTeams, leaveTeam, transferTeamHost, listenGuilds, type Team, type Guild } from '../firebase/groupsService';
import { listenDungeonOpenBroadcast } from '../firebase/dungeonService';

const ACTIVITY_THROTTLE_MS = 20_000;

export default function PresenceTracker() {
  const status = useGame((s) => s.status);
  const player = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);

  const [teams, setTeams] = useState<Team[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const unsub = listenTeams(setTeams);
    return () => unsub();
  }, [status, player?.uid]);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const unsub = listenGuilds(setGuilds);
    return () => unsub();
  }, [status, player?.uid]);

  // Auto-répare `p.guildId` : seul `createGuild` le pose (`GuildCard.tsx`), pas
  // `acceptApplication` (côté guilde, jamais renvoyé au client du candidat) →
  // un joueur qui rejoint une guilde existante (au lieu de la fonder) reste avec
  // `guildId: null` en local, alors qu'il est bien listé dans `guild.members`.
  // GuildCard s'en sort (vérifie l'appartenance réelle via `guilds`), mais
  // ChatCard/bonus de guilde ne lisent que `p.guildId` → toujours « pas de
  // guilde » pour ces joueurs. Toujours monté (contrairement à GuildCard), donc
  // corrige même si le joueur n'ouvre jamais la fenêtre Guilde.
  useEffect(() => {
    if (status !== 'ready' || !player || guilds.length === 0) return;
    const real = guilds.find((g) => player.uid in (g.members ?? {}));
    const realId = real ? real.id : null;
    if (player.guildId !== realId) mutate((d) => { d.guildId = realId; });
  }, [guilds, status, player?.uid, player?.guildId]);

  useEffect(() => {
    if (status !== 'ready' || !player) return;
    
    const unsub = trackPresence(
      { uid: player.uid, name: player.name, level: player.level, playtimeMs: player.playtimeMs ?? 0 },
      setOnlinePlayers
    );
    return () => unsub();
  }, [status, player?.uid, player?.level, player?.name]);

  // Temps de jeu : accumulé seulement onglet visible (comme la pause d'animations,
  // #50), diffusé via la présence toutes les 30s pour que les autres joueurs le
  // voient en ligne (LeaderboardCard/ChatCard écoutent déjà `presence/`).
  const playtimeTick = useRef(Date.now());
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    playtimeTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - playtimeTick.current;
      playtimeTick.current = now;
      if (document.hidden || delta <= 0 || delta > 120_000) return;
      mutate((d) => { d.playtimeMs = (d.playtimeMs ?? 0) + delta; });
      updatePresencePlaytime(useGame.getState().player?.playtimeMs ?? 0);
    }, 30_000);
    return () => clearInterval(id);
  }, [status, player?.uid]);

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

  // Notification globale quand un joueur ouvre un groupe de donjon (hors raid,
  // qui a déjà sa propre bannière). Diffusée 10s après la création par l'hôte
  // (annulable côté DungeonCard), et affichée seulement aux joueurs qui ont le
  // niveau requis pour ce donjon précis.
  // Skip le tout premier snapshot (rediffusion de l'ancienne ouverture au chargement),
  // et n'affiche rien pour l'hôte lui-même (déjà dans son propre lobby).
  const lastDungeonOpenId = useRef<string | null>(null);
  const firstDungeonOpenSnap = useRef(true);
  useEffect(() => {
    if (status !== 'ready' || !player) return;
    const unsub = listenDungeonOpenBroadcast((b) => {
      if (!b) return;
      if (firstDungeonOpenSnap.current) {
        firstDungeonOpenSnap.current = false;
        lastDungeonOpenId.current = b.id;
        return;
      }
      if (b.id === lastDungeonOpenId.current) return;
      lastDungeonOpenId.current = b.id;
      if (b.hostUid === player.uid) return;
      const me = useGame.getState().player;
      if (!me || me.level < b.minLevel) return;
      useGame.getState().toast(`🏰 ${b.hostName} a ouvert un groupe : ${b.dungeonName} !`, 'good', 6000);
    });
    return () => unsub();
  }, [status, player?.uid]);

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
