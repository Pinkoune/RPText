import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { deriveStats } from '../../game/player';
import { talentMods } from '../../game/talents';
import { auraColor } from '../../game/prestige';
import {
  listenGuilds, createGuild, applyGuild, acceptApplication, rejectApplication, leaveGuild, contributeGuild, guildLevel,
  attackGuildBoss, guildBossWeekId, getGuildBossCdMult, hasGuildBossLootBonus, getGuildBonus, GUILD_PERK_TIERS,
  socialEnabled, GUILD_MAX, GUILD_CREATE_COST, type Guild,
} from '../../firebase/groupsService';
import { item } from '../../game/items';

const GUILD_BOSS_CD = 30 * 60 * 1000; // 30 min entre deux attaques

export default function GuildCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => listenGuilds(setGuilds), []);
  if (!p) return null;
  const me = { uid: p.uid, name: p.name, level: p.level, aura: p.prestigeAura, auraColorOn: p.auraColorOn };
  const myGuild = guilds.find((g) => p.uid in (g.members ?? {}));

  async function attackBoss() {
    if (!myGuild) return;
    const last = p!.cooldowns['guildboss'] ?? 0;
    const cd = GUILD_BOSS_CD * getGuildBossCdMult(myGuild.id);
    const left = cd - (Date.now() - last);
    if (left > 0) return toast(`Attaque de boss en récupération (${Math.ceil(left / 60000)} min).`, 'bad');
    const stats = deriveStats(p!);
    const mods = talentMods(p!);
    // Dégâts = attaque effective, bonus de crit/dégâts plats inclus, un peu de variance.
    const dmg = Math.round((stats.atk + mods.flatDmg) * (1 + mods.crit) * (0.9 + Math.random() * 0.3) * 3);
    mutate((d) => { d.cooldowns['guildboss'] = Date.now(); });
    try {
      const res = await attackGuildBoss(myGuild.id, p!.uid, dmg);
      if (!res) return;
      if (res.justDefeated) toast(`💥 ${res.boss.emoji} ${res.boss.name} vaincu ! Réclame ta récompense.`, 'gold');
      else if (res.defeated) toast('Le boss est déjà vaincu cette semaine.', 'info');
      else toast(`Tu infliges ${res.dmg} dégâts au boss de guilde !`, 'good');
    } catch {
      mutate((d) => { d.cooldowns['guildboss'] = last; });
      toast('Échec de l\'attaque.', 'bad');
    }
  }

  function claimBossReward() {
    if (!myGuild?.boss) return;
    const boss = myGuild.boss;
    const wid = guildBossWeekId();
    if (boss.weekId !== wid || boss.hp > 0) return;
    const key = `${myGuild.id}:${wid}`;
    if ((p!.guildBossClaims ?? []).includes(key)) return toast('Récompense déjà réclamée.', 'bad');
    const contributed = (boss.contributors?.[p!.uid] ?? 0) > 0;
    if (!contributed) return toast('Tu n\'as pas participé à ce boss.', 'bad');
    mutate((d) => {
      if (!d.guildBossClaims) d.guildBossClaims = [];
      d.guildBossClaims.push(key);
      const gold = 800 + guildLevel(myGuild!.xp).level * 100;
      d.gold += gold;
      d.fateCoins += 8;
      d.gems += 1;
      let msg = `🏆 Butin de guilde : +${gold} 🪙, +8 🎲, +1 💎`;
      // Palier Nv.6 : slot de loot bonus (Âme de Boss supplémentaire).
      if (hasGuildBossLootBonus(myGuild!.id)) {
        d.inventory['boss_soul'] = (d.inventory['boss_soul'] ?? 0) + 1;
        msg += `, +1 ${item('boss_soul')!.name}`;
      }
      toast(msg, 'gold');
    });
    void contributeGuild(myGuild.id, 300); // la victoire fait aussi progresser la guilde
  }

  function claimGoalReward() {
    const goal = myGuild?.goal;
    const wid = guildBossWeekId();
    if (!goal || goal.weekId !== wid || goal.progress < goal.target) return;
    const key = `${myGuild!.id}:${wid}`;
    if ((p!.settledGuildGoals ?? []).includes(key)) return toast('Récompense déjà réclamée.', 'bad');
    if ((goal.contributors?.[p!.uid] ?? 0) <= 0) return toast('Tu n\'as pas participé à cet objectif.', 'bad');
    mutate((d) => {
      if (!d.settledGuildGoals) d.settledGuildGoals = [];
      d.settledGuildGoals.push(key);
      const gold = 1000 + guildLevel(myGuild!.xp).level * 120;
      d.gold += gold;
      d.fateCoins += 10;
      d.inventory['upgrade_matrix'] = (d.inventory['upgrade_matrix'] ?? 0) + 1;
      toast(`🎉 Objectif de guilde accompli ! +${gold} 🪙, +10 🎲, +1 ${item('upgrade_matrix')!.name}`, 'gold');
    });
    void contributeGuild(myGuild!.id, 400); // l'objectif fait progresser la guilde
  }

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
  function apply(g: Guild) {
    applyGuild(g.id, me).then(() => toast('Candidature envoyée !', 'good')).catch((e) => toast(`Impossible (${e.message}).`, 'bad'));
  }
  function leave() {
    if (!myGuild) return;
    if (!window.confirm(`Es-tu sûr de vouloir quitter la guilde « ${myGuild.name} » ?`)) return;
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
            <span className="text-[10px] tabular-nums text-slate-500">{lvl.capped ? 'Niveau max' : `${lvl.into}/${lvl.need}`}</span>
          </div>
          <div className="mt-1.5 h-2 rounded bg-black/40"><div className="h-2 rounded bg-amber-400" style={{ width: lvl.capped ? '100%' : `${(lvl.into / lvl.need) * 100}%` }} /></div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <span className={`rounded px-1.5 py-0.5 ${lvl.level >= 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/40 text-slate-500'}`}>+{Math.round((getGuildBonus(myGuild.id) - 1) * 100)}% XP</span>
            <span className={`rounded px-1.5 py-0.5 ${lvl.level >= GUILD_PERK_TIERS.gold ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/40 text-slate-500'}`}>Nv.{GUILD_PERK_TIERS.gold} : Or aussi bonus</span>
            <span className={`rounded px-1.5 py-0.5 ${lvl.level >= GUILD_PERK_TIERS.bossLoot ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/40 text-slate-500'}`}>Nv.{GUILD_PERK_TIERS.bossLoot} : Loot boss bonus</span>
            <span className={`rounded px-1.5 py-0.5 ${lvl.level >= GUILD_PERK_TIERS.bossCd ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/40 text-slate-500'}`}>Nv.{GUILD_PERK_TIERS.bossCd} : CD boss -33%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Contribuer :</span>
          {[100, 500, 1000].map((v) => (
            <button key={v} onClick={() => contribute(v)} className="rounded bg-amber-500/30 px-2 py-0.5 hover:bg-amber-500/50">{v} 🪙</button>
          ))}
        </div>

        {/* Boss de guilde hebdomadaire (objectif coopératif) */}
        {(() => {
          const wid = guildBossWeekId();
          const boss = myGuild.boss && myGuild.boss.weekId === wid ? myGuild.boss : null;
          const defeated = boss ? boss.hp <= 0 : false;
          const claimKey = `${myGuild.id}:${wid}`;
          const claimed = (p.guildBossClaims ?? []).includes(claimKey);
          const myDmg = boss?.contributors?.[p.uid] ?? 0;
          const cd = GUILD_BOSS_CD * getGuildBossCdMult(myGuild.id);
          const cdLeft = cd - (Date.now() - (p.cooldowns['guildboss'] ?? 0));
          return (
            <div className="rounded-xl bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">⚔️ Boss de guilde (hebdo)</span>
                {boss && !defeated && <span className="text-[10px] text-slate-500">tes dégâts : {myDmg}</span>}
              </div>
              {!boss ? (
                <p className="mt-1 text-sm text-slate-400">Aucun boss cette semaine. Frappe pour l'invoquer !</p>
              ) : (
                <>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-lg">{boss.emoji}</span>
                    <span className="font-medium">{boss.name}</span>
                    <span className="ml-auto text-[10px] tabular-nums text-slate-500">{Math.max(0, boss.hp)} / {boss.maxHp} PV</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded bg-black/40">
                    <div className="h-2 rounded bg-rose-500 transition-all" style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }} />
                  </div>
                </>
              )}
              <div className="mt-2 flex gap-2">
                {defeated ? (
                  <button
                    onClick={claimBossReward}
                    disabled={claimed || myDmg <= 0}
                    className="flex-1 rounded bg-amber-500/30 py-1.5 text-xs font-semibold hover:bg-amber-500/50 disabled:opacity-40"
                  >
                    {claimed ? 'Récompense réclamée ✅' : myDmg > 0 ? 'Réclamer la récompense 🏆' : 'Non participé'}
                  </button>
                ) : (
                  <button
                    onClick={attackBoss}
                    disabled={cdLeft > 0}
                    className="flex-1 rounded bg-rose-500/30 py-1.5 text-xs font-semibold hover:bg-rose-500/50 disabled:opacity-40"
                  >
                    {cdLeft > 0 ? `Attaque dans ${Math.ceil(cdLeft / 60000)} min` : 'Attaquer le boss ⚔️'}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Objectif collectif hebdomadaire (contribution de toute la guilde) */}
        {(() => {
          const wid = guildBossWeekId();
          const goal = myGuild.goal && myGuild.goal.weekId === wid ? myGuild.goal : null;
          const pct = goal ? Math.min(100, (goal.progress / goal.target) * 100) : 0;
          const done = goal ? goal.progress >= goal.target : false;
          const claimKey = `${myGuild.id}:${wid}`;
          const claimed = (p.settledGuildGoals ?? []).includes(claimKey);
          const myContrib = goal?.contributors?.[p.uid] ?? 0;
          return (
            <div className="rounded-xl bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">🎯 Objectif de guilde (hebdo)</span>
                {goal && <span className="text-[10px] text-slate-500">ta part : {myContrib}</span>}
              </div>
              {!goal ? (
                <p className="mt-1 text-sm text-slate-400">Chassez des monstres pour lancer l'objectif de la semaine !</p>
              ) : (
                <>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-lg">{goal.icon}</span>
                    <span className="font-medium">{goal.name}</span>
                    <span className="ml-auto text-[10px] tabular-nums text-slate-500">{Math.min(goal.progress, goal.target)} / {goal.target}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{goal.desc}</div>
                  <div className="mt-1.5 h-2 rounded bg-black/40">
                    <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    onClick={claimGoalReward}
                    disabled={!done || claimed || myContrib <= 0}
                    className="mt-2 w-full rounded bg-amber-500/30 py-1.5 text-xs font-semibold hover:bg-amber-500/50 disabled:opacity-40"
                  >
                    {claimed ? 'Récompense réclamée ✅' : done ? (myContrib > 0 ? 'Réclamer le coffre 🎁' : 'Non participé') : `Objectif en cours (${Math.round(pct)}%)`}
                  </button>
                </>
              )}
            </div>
          );
        })()}

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Membres · {members.length}/{GUILD_MAX}</div>
          <div className="space-y-1">
            {members.map(([uid, m]) => (
              <div key={uid} className="flex justify-between rounded-lg bg-black/25 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate">
                  {uid === myGuild.ownerUid ? '👑 ' : ''}{uid === p.uid ? '⭐ ' : ''}
                  <span style={{ color: auraColor(m.aura, m.auraColorOn ?? true) }}>{m.name}</span>
                  {m.title && <span className="ml-1.5 text-[10px] text-amber-300/80">« {m.title} »</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-400">Nv.{m.level}</span>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(myGuild.applications || {}).length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">Candidatures · {Object.keys(myGuild.applications || {}).length}</div>
            <div className="space-y-1">
              {Object.entries(myGuild.applications || {}).map(([uid, m]) => (
                <div key={uid} className="flex justify-between items-center rounded-lg bg-black/25 px-3 py-1.5 text-sm">
                  <span>{m.name} <span className="text-[10px] text-slate-400">Nv.{m.level}</span></span>
                  <div className="flex gap-1">
                    <button onClick={() => acceptApplication(myGuild.id, uid).catch(e => toast(e.message, 'bad'))} className="rounded bg-emerald-500/30 px-2 py-0.5 text-[10px] hover:bg-emerald-500/50">Accepter</button>
                    <button onClick={() => rejectApplication(myGuild.id, uid).catch(e => toast(e.message, 'bad'))} className="rounded bg-rose-500/30 px-2 py-0.5 text-[10px] hover:bg-rose-500/50">Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
      ) : ranked.map((g, i) => {
        const hasApplied = p.uid in (g.applications || {});
        return (
          <div key={g.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{i + 1}. [{g.tag}] {g.name} <span className="text-xs text-slate-400">Nv.{guildLevel(g.xp).level} · {Object.keys(g.members).length}/{GUILD_MAX}</span></span>
            {hasApplied ? (
              <span className="shrink-0 rounded bg-slate-500/30 px-3 py-1 text-xs font-semibold text-slate-300">En attente</span>
            ) : (
              <button onClick={() => apply(g)} className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50">Postuler</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
