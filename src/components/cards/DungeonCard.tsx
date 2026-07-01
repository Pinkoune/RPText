import { useEffect, useState, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { DUNGEONS, dungeonCooldownLeft, type DungeonDef } from '../../game/dungeons';
import { item, RARITY_COLOR } from '../../game/items';
import { playSound } from '../../game/sound';
import { deriveStats, applyBonuses, grantXp, addItem } from '../../game/player';
import { talentMods } from '../../game/talents';
import { listenTeams, setTeamDungeon, type Team } from '../../firebase/groupsService';
import {
  listenDungeon, createDungeonLobby, joinDungeon, toggleReady, leaveDungeon,
  startDungeon, submitDungeonAction, cleanupDungeon, type DungeonSession
} from '../../firebase/dungeonService';

const POTIONS = ['herb_tea', 'potion', 'hi_potion', 'grilled_fish', 'hearty_stew'];

function fmt(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m}min`;
}

export default function DungeonCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [session, setSession] = useState<DungeonSession | null>(null);
  const [showPotions, setShowPotions] = useState(false);
  const [, tick] = useState(0);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => listenTeams(setTeams), []);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Sync session
  useEffect(() => {
    if (!p?.dungeonSessionId) {
      setSession(null);
      return;
    }
    return listenDungeon(p.dungeonSessionId, (ds) => {
      if (!ds) {
        mutate(d => { d.dungeonSessionId = null; });
        setSession(null);
        return;
      }
      setSession(ds);

      if (ds.state === 'combat' && ds.startedAt) {
        const cdKey = `dungeon:${ds.dungeonId}`;
        const currentCd = useGame.getState().player?.cooldowns[cdKey] || 0;
        if (ds.startedAt > currentCd) {
          mutate(d => { d.cooldowns[cdKey] = ds.startedAt; });
        }
      }
    });
  }, [p?.dungeonSessionId]);

  // Handle victory/defeat processing once
  useEffect(() => {
    if (!p || !session) return;
    if (session.state === 'victory' && !p.settledDungeons?.includes(session.id)) {
      const def = DUNGEONS.find(d => d.id === session.dungeonId);
      if (def) {
        let totalXp = 0;
        for (const m of def.stages) totalXp += m.xp;
        
        const numPlayers = Object.keys(session.players).length;
        const xpMult = Math.pow(numPlayers, 1.2);
        const goldMult = Math.pow(numPlayers, 1.2);
        
        const baseReward = { 
          xp: Math.floor(totalXp * xpMult), 
          gold: Math.floor(def.reward.gold * goldMult) 
        };
        const { xp, gold } = applyBonuses(p, baseReward);

        mutate(d => {
          d.settledDungeons = d.settledDungeons || [];
          d.settledDungeons.push(session.id);
          d.kills += def.stages.length;
          d.gold += gold;
          d.fateCoins += def.reward.fateCoins;
          d.gems += def.reward.gems;
          if (def.reward.fateCoins) toast(`+${def.reward.fateCoins} 🎲`, 'gold');
          if (def.reward.gems) toast(`+${def.reward.gems} 💎`, 'gold');
          d.dungeonClears[def.id] = (d.dungeonClears[def.id] ?? 0) + 1;
        });
        const levels = grantXp(useGame.getState().player!, xp);
        if (levels > 0) {
          playSound('levelup');
          useGame.getState().celebrateLevelUp();
        } else {
          playSound('win');
        }
      }
    } else if (session.state === 'defeat' && !p.settledDungeons?.includes(session.id)) {
      mutate(d => {
        d.settledDungeons = d.settledDungeons || [];
        d.settledDungeons.push(session.id);
      });
      playSound('lose');
    }
  }, [session?.state]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.log]);

  if (!p) return null;

  const myTeam = teams.find(t => p.uid in (t.members ?? {}));

  async function createLobby(def: DungeonDef) {
    if (p!.hp <= 0) return toast('Soigne-toi d\'abord.', 'bad');
    const stats = deriveStats(p!);
    const mods = talentMods(p!);
    try {
      const id = await createDungeonLobby(p!.uid, p!.name, p!.classId, def.id, stats, mods, p!.level);
      mutate(d => { d.dungeonSessionId = id; });
      if (myTeam) await setTeamDungeon(myTeam.id, id);
    } catch (e: any) {
      toast(e.message, 'bad');
    }
  }

  async function joinLobby(id: string) {
    if (p!.hp <= 0) return toast('Soigne-toi d\'abord.', 'bad');
    const stats = deriveStats(p!);
    const mods = talentMods(p!);
    try {
      await joinDungeon(id, p!.uid, p!.name, p!.classId, stats, mods, p!.level);
      mutate(d => { d.dungeonSessionId = id; });
    } catch (e: any) {
      toast(e.message, 'bad');
    }
  }

  async function leave() {
    if (session) {
      await leaveDungeon(session.id, p!.uid);
      if (myTeam && session.host === p!.uid) await setTeamDungeon(myTeam.id, null);
    }
    mutate(d => { d.dungeonSessionId = null; });
  }

  async function act(action: 'attack' | 'ability' | 'potion', selectedPotionId?: string) {
    if (!session || session.state !== 'combat') return;
    if (action === 'potion' && !selectedPotionId) {
      return toast('Aucune potion sélectionnée.', 'bad');
    }
    let potHeal = 0;
    if (action === 'potion') {
      const potUse = selectedPotionId!;
      potHeal = item(potUse)!.hp ?? 0;
      mutate(d => { d.inventory[potUse]--; });
    }
    await submitDungeonAction(session.id, p!.uid, action, potHeal);
  }

  // Timeout check
  if (session && session.state === 'combat' && session.turnOrder[session.turnIdx] === p.uid) {
    if (Date.now() - session.turnStartAt > 30000) {
      submitDungeonAction(session.id, p.uid, 'timeout');
    }
  }

  // ── Vue Lobby ──
  if (session && session.state === 'lobby') {
    const def = DUNGEONS.find(d => d.id === session.dungeonId);
    const amHost = session.host === p.uid;
    const allReady = Object.values(session.players).every(pl => pl.ready);
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-lg font-bold">{def?.emoji} {def?.name} (Lobby)</div>
          <button onClick={leave} className="bg-rose-500/30 hover:bg-rose-500/50 rounded px-2 py-1 text-xs">Quitter</button>
        </div>
        <div className="space-y-2">
          {Object.values(session.players).map(pl => (
            <div key={pl.uid} className="flex justify-between items-center bg-black/25 p-2 rounded-lg text-sm">
              <span>{pl.uid === session.host ? '👑 ' : ''}{pl.name} ({pl.classId})</span>
              <span className={pl.ready ? 'text-emerald-400' : 'text-amber-400'}>{pl.ready ? 'Prêt' : 'Attente...'}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button 
            onClick={() => toggleReady(session.id, p.uid)} 
            className="rounded-lg bg-sky-500/40 py-2 hover:bg-sky-500/60 font-semibold"
          >
            {session.players[p.uid]?.ready ? 'Pas Prêt' : 'Prêt'}
          </button>
          {amHost && (
            <button 
              onClick={() => startDungeon(session.id)}
              disabled={!allReady}
              className="rounded-lg bg-emerald-500/40 py-2 hover:bg-emerald-500/60 font-semibold disabled:opacity-40"
            >
              Lancer le Donjon
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Vue Combat ──
  if (session && session.state === 'combat') {
    const m = session.monster!;
    const def = DUNGEONS.find(d => d.id === session.dungeonId)!;
    const mhpPct = Math.max(0, (m.hp / m.maxHp) * 100);
    const myTurn = session.turnOrder[session.turnIdx] === p.uid;
    const timeLeft = Math.max(0, 30 - Math.floor((Date.now() - session.turnStartAt) / 1000));
    const me = session.players[p.uid];

    return (
      <div className="space-y-3">
        {/* Monster HUD */}
        <div className="rounded-lg bg-black/25 p-3 text-center relative overflow-hidden">
          <div className="text-4xl mb-1">{m.emoji}</div>
          <div className="font-bold">{m.name} <span className="text-xs text-slate-400">(Étape {m.idx + 1}/{def.stages.length})</span></div>
          {m.provokedBy && <div className="text-[10px] text-rose-400 font-bold tracking-wide uppercase">💢 Provoqué par {session.players[m.provokedBy]?.name}</div>}
          <div className="h-2 rounded bg-black/40 mt-2 mx-4">
            <div className="h-2 rounded bg-orange-400 transition-all duration-300" style={{ width: `${mhpPct}%` }} />
          </div>
          <div className="text-xs text-slate-400 mt-1">{Math.round(m.hp)} / {m.maxHp}</div>
        </div>

        {/* Players List */}
        <div className="grid grid-cols-2 gap-2">
          {Object.values(session.players).map(pl => {
            const isTurn = session.turnOrder[session.turnIdx] === pl.uid;
            const phpPct = Math.max(0, (pl.hp / pl.maxHp) * 100);
            return (
              <div key={pl.uid} className={`rounded-lg p-2 text-xs border ${isTurn ? 'border-sky-400/50 bg-sky-500/10' : 'border-transparent bg-black/20'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-semibold ${pl.isDead ? 'text-slate-500 line-through' : ''}`}>
                    {pl.name} {isTurn && !pl.isDead && <span className="animate-pulse">⏳</span>}
                  </span>
                  <span className="tabular-nums text-slate-400">{Math.round(pl.hp)}/{pl.maxHp}</span>
                </div>
                <div className="h-1.5 rounded bg-black/40">
                  <div className={`h-1.5 rounded transition-all duration-300 ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${phpPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Combat Log */}
        <div className="h-32 overflow-auto rounded-lg bg-black/30 p-2 text-sm space-y-1">
          {session.log.map((e, i) => (
            <div key={i} className={e.side === 'you' ? 'text-sky-300' : e.side === 'enemy' ? 'text-rose-300' : 'text-slate-400'}>
              {e.text}
            </div>
          ))}
          <div ref={logEnd} />
        </div>

      {/* Actions */}
      {myTurn && !me.isDead ? (
        <div className="grid grid-cols-2 gap-2">
          {showPotions ? (
            <div className="col-span-2 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Choisir un soin :</div>
              <div className="grid grid-cols-2 gap-2">
                {POTIONS.filter(id => (p.inventory[id] ?? 0) > 0).map(id => (
                  <button
                    key={id}
                    onClick={() => { setShowPotions(false); act('potion', id); }}
                    className="rounded-lg bg-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-500/50 flex flex-col items-center justify-center gap-1"
                  >
                    <span>{item(id)!.icon} {item(id)!.name}</span>
                    <span className="text-[10px] font-normal text-slate-300">({(p.inventory[id] ?? 0)} en stock)</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <>
              <button onClick={() => act('attack')} className="rounded-lg bg-red-500/40 py-2.5 text-sm font-bold hover:bg-red-500/60">⚔️ Attaquer</button>
              <button
                onClick={() => act('ability')}
                disabled={me.abilityCd > 0}
                className="rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40"
              >
                {me.abilityCd > 0 ? `✨ Compétence (${me.abilityCd})` : `✨ Compétence`}
              </button>
              <button
                onClick={() => {
                  const available = POTIONS.filter(id => (p.inventory[id] ?? 0) > 0);
                  if (available.length === 1) act('potion', available[0]);
                  else setShowPotions(true);
                }}
                disabled={POTIONS.filter(id => (p.inventory[id] ?? 0) > 0).length === 0}
                className="rounded-lg bg-emerald-500/30 py-2.5 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40"
              >
                🧪 Potion ({POTIONS.reduce((n, id) => n + (p.inventory[id] ?? 0), 0)})
              </button>
              <div className="flex items-center justify-center rounded-lg bg-black/20 text-xs font-mono text-amber-200">
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            </>
          )}
        </div>
        ) : (
          <div className="text-center text-xs text-slate-500 py-2">
            {me.isDead ? '💀 Tu es K.O.' : 'En attente des autres joueurs...'}
          </div>
        )}
      </div>
    );
  }

  // ── Vue Fin ──
  if (session && (session.state === 'victory' || session.state === 'defeat')) {
    const def = DUNGEONS.find(d => d.id === session.dungeonId)!;
    return (
      <div className="space-y-3">
        {session.state === 'victory' ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 text-center">
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-bold text-amber-300">Donjon conquis !</div>
            <div className="text-sm mt-2">L'équipe a triomphé de {def.name}. Les récompenses ont été ajoutées.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/15 p-4 text-center">
            <div className="text-2xl mb-2">💀</div>
            <div className="font-bold text-rose-300">Échec...</div>
            <div className="text-sm mt-2 text-slate-300">Toute l'équipe a péri dans le donjon.</div>
          </div>
        )}
        <button onClick={leave} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">Fermer</button>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Donjons multijoueurs : créez un groupe ou jouez en solo. Les combats se déroulent au tour par tour !
      </p>

      {/* Si l'équipe a un donjon actif, bouton pour rejoindre */}
      {myTeam?.dungeonId && (
        <div className="rounded-lg bg-sky-500/20 p-3 flex justify-between items-center border border-sky-500/40">
          <div className="text-sm text-sky-200 font-semibold">Le chef a créé un donjon !</div>
          <button onClick={() => joinLobby(myTeam.dungeonId!)} className="bg-sky-500 hover:bg-sky-400 text-black px-3 py-1.5 rounded font-bold text-xs">Rejoindre</button>
        </div>
      )}

      {DUNGEONS.map((def) => {
        const locked = p.level < def.minLevel;
        const left = dungeonCooldownLeft(p, def);
        const clears = p.dungeonClears?.[def.id] ?? 0;
        return (
          <div key={def.id} className="rounded-xl bg-black/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{def.emoji} {def.name}</div>
                <div className="text-[11px] text-slate-400">{def.desc}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {def.stages.length} salles · Nv.{def.minLevel}+ · récup. {fmt(def.cooldownMs)}{clears > 0 ? ` · ${clears} clear${clears > 1 ? 's' : ''}` : ''}
                </div>
              </div>
              <button
                onClick={() => createLobby(def)}
                disabled={locked || left > 0 || !!myTeam?.dungeonId}
                className="shrink-0 rounded-lg bg-purple-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-purple-500/60 disabled:opacity-40"
              >
                {locked ? `🔒 Nv.${def.minLevel}` : left > 0 ? `⏳ ${fmt(left)}` : 'Créer un groupe'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
