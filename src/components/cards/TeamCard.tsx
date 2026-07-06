import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import {
  listenTeams, createTeam, joinTeam, leaveTeam,
  socialEnabled, TEAM_MAX, type Team,
} from '../../firebase/groupsService';
import { listenDungeon, joinDungeon, type DungeonSession } from '../../firebase/dungeonService';
import { watchChat, sendChat, type ChatMessage } from '../../firebase/chatService';
import { DUNGEONS } from '../../game/dungeons';
import { deriveStats } from '../../game/player';
import { talentMods } from '../../game/talents';
import { auraColor } from '../../game/prestige';

export default function TeamCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const openWindow = useUi((s) => s.open);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [teamDungeon, setTeamDungeon] = useState<DungeonSession | null>(null);
  const [teamMsgs, setTeamMsgs] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');

  useEffect(() => listenTeams(setTeams), []);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name, level: p.level, aura: p.prestigeAura, auraColorOn: p.auraColorOn };
  const myTeam = teams.find((t) => p.uid in (t.members ?? {}));

  // Écoute la session du donjon lancé par l'équipe (si un membre en a ouvert un).
  useEffect(() => {
    if (!myTeam?.dungeonId) { setTeamDungeon(null); return; }
    return listenDungeon(myTeam.dungeonId, setTeamDungeon);
  }, [myTeam?.dungeonId]);

  // Mini-chat d'équipe intégré (même canal 'team' que l'onglet Équipe du Chat).
  useEffect(() => {
    if (!myTeam?.id) { setTeamMsgs([]); return; }
    return watchChat('team', myTeam.id, setTeamMsgs);
  }, [myTeam?.id]);

  function sendTeamChat() {
    const t = chatText.trim();
    if (!t || !myTeam || !p) return;
    sendChat({ uid: p.uid, name: p.name, aura: p.prestigeAura, auraColorOn: p.auraColorOn }, t, 'team', myTeam.id);
    setChatText('');
  }

  if (!socialEnabled) {
    return <p className="text-sm text-amber-200">Les équipes nécessitent Firebase (mode en ligne). Configure-le pour jouer à plusieurs.</p>;
  }

  // Rejoindre en un clic le donjon lancé par un coéquipier (matche le max
  // 4 joueurs des donjons normaux = même limite que TEAM_MAX).
  async function joinTeamDungeon() {
    if (!teamDungeon || !p) return;
    if (p.hp <= 0) return toast('Soigne-toi d\'abord.', 'bad');
    const def = DUNGEONS.find((d) => d.id === teamDungeon.dungeonId);
    if (def && p.level < def.minLevel) return toast(`Niveau ${def.minLevel} requis pour ce donjon.`, 'bad');
    const stats = deriveStats(p);
    const mods = talentMods(p);
    try {
      await joinDungeon(teamDungeon.id, p.uid, p.name, p.classId, stats, mods, p.level, p.prestigeAura, p.auraColorOn);
      mutate((d) => { d.dungeonSessionId = teamDungeon.id; });
      openWindow('dungeon', undefined, { singleton: true });
    } catch (e: any) {
      toast(e.message, 'bad');
    }
  }

  function create() {
    createTeam(me, name.trim() || `Équipe de ${p!.name}`)
      .then((id) => { mutate((d) => { d.teamId = id; }); toast('Équipe créée.', 'good'); })
      .catch(() => toast('Échec de création.', 'bad'));
  }
  function join(t: Team) {
    joinTeam(t.id, me).then(() => mutate((d) => { d.teamId = t.id; })).catch((e) => toast(`Impossible (${e.message}).`, 'bad'));
  }
  function leave() {
    if (!myTeam) return;
    void leaveTeam(myTeam.id, p!.uid);
    mutate((d) => { d.teamId = null; });
  }
  if (myTeam) {
    const members = Object.entries(myTeam.members);
    const buff = members.length <= 1 ? 0 : members.length * 5;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">👥 {myTeam.name} <span className="text-xs text-slate-400">({members.length}/{TEAM_MAX})</span></span>
          <button onClick={leave} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Quitter</button>
        </div>
        <div className={`rounded border p-2 text-xs ${buff > 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'}`}>
          {buff > 0 ? <><strong>Bonus d'équipe actif :</strong> +{buff}% d'XP et d'Or gagné</> : 'Recrute au moins 1 coéquipier pour activer le bonus d\'XP/Or.'}
        </div>
        {teamDungeon && teamDungeon.state === 'lobby' && !(p.uid in teamDungeon.players) && (
          <div className="flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2">
            <span className="text-xs text-amber-200">
              ⚔️ {DUNGEONS.find((d) => d.id === teamDungeon.dungeonId)?.name ?? 'Donjon'} en attente ({Object.keys(teamDungeon.players).length}/4)
            </span>
            <button onClick={joinTeamDungeon} className="shrink-0 rounded bg-amber-500/40 px-3 py-1.5 text-xs font-bold hover:bg-amber-500/60">
              Rejoindre
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          {members.map(([uid, m]) => (
            <div key={uid} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
              <span>{uid === p.uid ? '⭐ ' : ''}<span style={{ color: auraColor(m.aura, m.auraColorOn ?? true) }}>{m.name}</span> <span className="text-xs text-slate-400">Nv.{m.level}</span></span>
            </div>
          ))}
        </div>

        {/* Mini-chat d'équipe (même canal que l'onglet Équipe de la carte Chat) */}
        <div className="rounded-lg bg-black/20 p-2">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">💬 Chat d'équipe</div>
          <div className="mb-2 max-h-28 space-y-1 overflow-y-auto rounded bg-black/25 p-1.5">
            {teamMsgs.length === 0 ? (
              <p className="px-1 text-xs text-slate-500">Aucun message. Dis bonjour à ton équipe 👋</p>
            ) : (
              teamMsgs.slice(-6).map((m, i) => (
                <div key={i} className="text-xs">
                  <span
                    className={m.name === p.name ? 'font-semibold text-sky-300' : 'font-semibold text-emerald-300'}
                    style={{ color: auraColor(m.aura, m.auraColorOn ?? true) }}
                  >
                    {m.name}
                  </span>
                  <span className="text-slate-400"> : </span>
                  <span className="break-words text-slate-200">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              data-keep-enter
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTeamChat()}
              maxLength={240}
              placeholder="Écris à ton équipe…"
              className="min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-400/50"
            />
            <button onClick={sendTeamChat} className="shrink-0 rounded-lg bg-sky-500/40 px-2.5 py-1.5 text-xs font-semibold hover:bg-sky-500/60">
              Envoyer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const open = teams.filter((t) => Object.keys(t.members ?? {}).length < TEAM_MAX);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Nom d'équipe" className="min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-400/60" />
        <button onClick={create} className="shrink-0 rounded-lg bg-sky-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-sky-500/60">Créer</button>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Équipes ouvertes · {open.length}</div>
      {open.length === 0 ? (
        <p className="text-xs text-slate-500">Aucune équipe. Crée la tienne !</p>
      ) : open.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {t.dungeonId && <span className="mr-2 animate-pulse text-amber-400" title="En donjon">⚔️</span>}
            {t.name} <span className="text-xs text-slate-400">{Object.keys(t.members).length}/{TEAM_MAX}</span>
          </span>
          <button onClick={() => join(t)} className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50">Rejoindre</button>
        </div>
      ))}
    </div>
  );
}
