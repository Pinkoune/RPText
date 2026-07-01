import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  listenGuilds, createGuild, joinGuild, leaveGuild, contributeGuild, guildLevel,
  socialEnabled, GUILD_MAX, GUILD_CREATE_COST, type Guild,
} from '../../firebase/groupsService';

export default function GuildCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => listenGuilds(setGuilds), []);
  if (!p) return null;
  const me = { uid: p.uid, name: p.name, level: p.level };
  const myGuild = guilds.find((g) => p.uid in (g.members ?? {}));

  if (!socialEnabled) {
    return <p className="text-sm text-amber-200">Les guildes nécessitent Firebase (mode en ligne).</p>;
  }

  function create() {
    if (p!.gold < GUILD_CREATE_COST) return toast(`Créer une guilde coûte ${GUILD_CREATE_COST} 🪙.`, 'bad');
    mutate((d) => { d.gold -= GUILD_CREATE_COST; });
    createGuild(me, name.trim() || `Guilde de ${p!.name}`, tag.trim())
      .then((id) => { mutate((d) => { d.guildId = id; }); toast('Guilde fondée !', 'good'); })
      .catch(() => { mutate((d) => { d.gold += GUILD_CREATE_COST; }); toast('Échec.', 'bad'); });
  }
  function join(g: Guild) {
    joinGuild(g.id, me).then(() => mutate((d) => { d.guildId = g.id; })).catch((e) => toast(`Impossible (${e.message}).`, 'bad'));
  }
  function leave() {
    if (!myGuild) return;
    void leaveGuild(myGuild.id, p!.uid);
    mutate((d) => { d.guildId = null; });
  }
  function contribute(amount: number) {
    if (!myGuild) return;
    if (p!.gold < amount) return toast('Pas assez d\'or.', 'bad');
    mutate((d) => { d.gold -= amount; });
    void contributeGuild(myGuild.id, amount);
    toast(`+${amount} XP de guilde !`, 'good');
  }

  if (myGuild) {
    const lvl = guildLevel(myGuild.xp);
    const members = Object.entries(myGuild.members).sort((a, b) => b[1].level - a[1].level);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">🏰 [{myGuild.tag}] {myGuild.name}</span>
          <button onClick={leave} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Quitter</button>
        </div>
        <div className="rounded-xl bg-black/25 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Niveau de guilde <span className="text-amber-300">{lvl.level}</span></span>
            <span className="text-[10px] tabular-nums text-slate-500">{lvl.into}/{lvl.need}</span>
          </div>
          <div className="mt-1.5 h-2 rounded bg-black/40"><div className="h-2 rounded bg-amber-400" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Contribuer :</span>
          {[100, 500, 1000].map((v) => (
            <button key={v} onClick={() => contribute(v)} className="rounded bg-amber-500/30 px-2 py-0.5 hover:bg-amber-500/50">{v} 🪙</button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Membres · {members.length}/{GUILD_MAX}</div>
          <div className="space-y-1">
            {members.map(([uid, m]) => (
              <div key={uid} className="flex justify-between rounded-lg bg-black/25 px-3 py-1.5 text-sm">
                <span>{uid === myGuild.ownerUid ? '👑 ' : ''}{uid === p.uid ? '⭐ ' : ''}{m.name}</span>
                <span className="text-xs text-slate-400">Nv.{m.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ranked = [...guilds].sort((a, b) => b.xp - a.xp);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Nom de guilde" className="min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-400/60" />
        <input value={tag} onChange={(e) => setTag(e.target.value.slice(0, 4).toUpperCase())} placeholder="TAG" className="w-16 rounded-lg bg-black/40 px-2 py-1.5 text-center text-sm uppercase outline-none" />
      </div>
      <button onClick={create} className="w-full rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60">Fonder une guilde ({GUILD_CREATE_COST} 🪙)</button>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Guildes · {ranked.length}</div>
      {ranked.length === 0 ? (
        <p className="text-xs text-slate-500">Aucune guilde. Fonde la première !</p>
      ) : ranked.map((g, i) => (
        <div key={g.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{i + 1}. [{g.tag}] {g.name} <span className="text-xs text-slate-400">Nv.{guildLevel(g.xp).level} · {Object.keys(g.members).length}/{GUILD_MAX}</span></span>
          <button onClick={() => join(g)} className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50">Rejoindre</button>
        </div>
      ))}
    </div>
  );
}
