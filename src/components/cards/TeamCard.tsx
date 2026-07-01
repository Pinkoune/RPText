import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  listenTeams, createTeam, joinTeam, leaveTeam,
  socialEnabled, TEAM_MAX, type Team,
} from '../../firebase/groupsService';

export default function TeamCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');

  useEffect(() => listenTeams(setTeams), []);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name, level: p.level };
  const myTeam = teams.find((t) => p.uid in (t.members ?? {}));

  if (!socialEnabled) {
    return <p className="text-sm text-amber-200">Les équipes nécessitent Firebase (mode en ligne). Configure-le pour jouer à plusieurs.</p>;
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
    const buff = (members.length * 5);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">👥 {myTeam.name} <span className="text-xs text-slate-400">({members.length}/{TEAM_MAX})</span></span>
          <button onClick={leave} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Quitter</button>
        </div>
        <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
          <strong>Bonus d'équipe actif :</strong> +{buff}% d'XP et d'Or gagné
        </div>
        <div className="space-y-1.5">
          {members.map(([uid, m]) => (
            <div key={uid} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
              <span>{uid === p.uid ? '⭐ ' : ''}{m.name} <span className="text-xs text-slate-400">Nv.{m.level}</span></span>
            </div>
          ))}
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
