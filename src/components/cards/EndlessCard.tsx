import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { combatTurn, freshCombatState, type CombatState } from '../../game/combat';
import { deriveStats, grantXp, removeItem } from '../../game/player';
import { talentMods, getAllActiveSkills } from '../../game/talents';
import { CLASSES } from '../../game/classes';
import { item, HP_CONSUMABLES } from '../../game/items';
import { playSound } from '../../game/sound';
import { generateEndlessMonster, getEndlessRewards } from '../../game/endless';
import {
  saveEndlessScore, getTopEndlessScores, type EndlessScore, type EndlessMode,
  listenEndlessSession, listenAllEndlessSessions, createEndlessLobby, joinEndlessLobby,
  toggleEndlessReady, leaveEndless, startEndless, submitEndlessAction, type EndlessSession,
} from '../../firebase/endlessService';
import ItemIcon from '../ItemIcon';

const POTIONS = HP_CONSUMABLES;

function Bar({ current, max, color, blink }: { current: number; max: number; color: string; blink?: boolean }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/40">
      <div className={`h-full rounded-full transition-all duration-300 ${color} ${blink && pct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface RunState {
  floor: number;
  monster: ReturnType<typeof generateEndlessMonster>;
  combat: CombatState;
  php: number;
  mhp: number;
  logs: string[];
  accumulatedGold: number;
  accumulatedXp: number;
  accumulatedGems: number;
  skillCds: Record<string, number>;
}

export default function EndlessCard() {
  const { player, mutate, toast } = useGame();

  const [run, setRun] = useState<RunState | null>(null);
  const [mode, setMode] = useState<EndlessMode>('solo');
  const [lbTab, setLbTab] = useState<EndlessMode>('solo');
  const [soloScores, setSoloScores] = useState<EndlessScore[]>([]);
  const [multiScores, setMultiScores] = useState<EndlessScore[]>([]);
  const [loading, setLoading] = useState(false);

  // Multi (RTDB)
  const [session, setSession] = useState<EndlessSession | null>(null);
  const [allSessions, setAllSessions] = useState<EndlessSession[]>([]);
  const [showPotions, setShowPotions] = useState(false);
  const [showSoloPotions, setShowSoloPotions] = useState(false);
  const [, tick] = useState(0);
  const logEnd = useRef<HTMLDivElement>(null);
  const endingRunRef = useRef(false);

  useEffect(() => {
    loadLeaderboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => listenAllEndlessSessions(setAllSessions), []);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const isFighting = (mode === 'solo' && !!run) || (mode === 'multi' && session?.state === 'combat');
    useGame.getState().setInCombat(isFighting);
    return () => useGame.getState().setInCombat(false);
  }, [run, session?.state, mode]);

  // Écoute de ma session multi.
  useEffect(() => {
    if (!player?.endlessSessionId) { setSession(null); return; }
    return listenEndlessSession(player.endlessSessionId, (s) => {
      if (!s) { mutate(d => { d.endlessSessionId = null; }); setSession(null); return; }
      setSession(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.endlessSessionId]);

  // Encaissement de fin de run multi (une seule fois).
  useEffect(() => {
    if (!player || !session) return;
    if (session.state === 'over' && !player.settledEndless?.includes(session.id)) {
      const cleared = session.clearedFloors;
      const party = Object.values(session.players).filter(pl => pl.uid !== player.uid).map(pl => pl.name);
      mutate(d => {
        d.settledEndless = d.settledEndless || [];
        d.settledEndless.push(session.id);
        d.gold += session.accGold;
        d.gems += session.accGems;
        const me = session.players[player.uid];
        if (me?.isDead) { d.hp = Math.max(1, Math.floor(deriveStats(d).maxHp * 0.1)); d.deaths += 1; }
        if (cleared > (d.endlessBest || 0)) d.endlessBest = cleared;
      });
      const levels = grantXp(useGame.getState().player!, session.accXp);
      if (levels > 0) { playSound('levelup'); useGame.getState().celebrateLevelUp(); }
      if (cleared > 0) {
        toast(`Abysses co-op : ${cleared} étage(s). +${session.accGold} Or, +${session.accXp} XP`, 'gold');
        saveEndlessScore({
          uid: player.uid, name: player.name, floor: cleared,
          classId: player.classId, date: Date.now(), mode: 'multi', party,
        }).then(loadLeaderboards);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.state]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.log]);

  async function loadLeaderboards() {
    setLoading(true);
    const [solo, multi] = await Promise.all([
      getTopEndlessScores('solo'),
      getTopEndlessScores('multi'),
    ]);
    setSoloScores(solo);
    setMultiScores(multi);
    setLoading(false);
  }

  if (!player) return null;
  const stats = deriveStats(player);
  const mods = talentMods(player);

  // ── Solo ──
  const startRun = () => {
    const firstMonster = generateEndlessMonster(1);
    setRun({
      floor: 1, monster: firstMonster, combat: freshCombatState(),
      php: player.hp, mhp: firstMonster.hp,
      logs: ['Vous entrez dans les Abysses Infinis…'],
      accumulatedGold: 0, accumulatedXp: 0, accumulatedGems: 0,
      skillCds: {},
    });
  };

  const handleAction = (action: string, selectedPotionId?: string) => {
    if (!run) return;
    if (action === 'flee') { endRun('flee'); return; }

    let skill = undefined;
    if (action !== 'attack' && action !== 'potion' && action !== 'flee') {
      skill = getAllActiveSkills().find(s => s.id === action);
      if (skill && (run.skillCds[skill.id] || 0) > 0) return;
    }

    // Bug corrigé : la potion n'était jamais retirée de l'inventaire (spammable
    // à l'infini) et le soin était fixé à 50 quelle que soit la potion réelle.
    let potionHeal = 0;
    if (action === 'potion') {
      const potionId = selectedPotionId ?? POTIONS.find((id) => (player.inventory[id] ?? 0) > 0);
      if (!potionId) return;
      potionHeal = item(potionId)?.hp ?? 0;
      mutate((d) => removeItem(d, potionId, 1));
    }

    const res = combatTurn(stats, mods, run.monster, run.php, run.mhp, action, { potionHeal, activeSkill: skill }, run.combat);
    const newLogs = [...run.logs, ...res.events.map(l => l.text)];
    if (newLogs.length > 10) newLogs.splice(0, newLogs.length - 10);
    
    const nextCds = { ...run.skillCds };
    for (const id in nextCds) nextCds[id] = Math.max(0, nextCds[id] - 1);
    if (res.abilityUsed && skill) {
      nextCds[skill.id] = Math.ceil(skill.cooldownMs / 5000);
    }

    if (res.php <= 0) {
      setRun(prev => prev ? { ...prev, php: 0, mhp: res.mhp, logs: newLogs, combat: res.state, skillCds: nextCds } : null);
      setTimeout(() => endRun('death'), 1000);
      return;
    }
    if (res.mhp <= 0) {
      const isNewClear = run.floor > (player.endlessBest || 0);
      const rewards = isNewClear ? getEndlessRewards(run.floor) : { gold: 0, xp: 0, gems: 0 };
      const nextFloor = run.floor + 1;
      const nextMonster = generateEndlessMonster(nextFloor);
      setRun(prev => prev ? {
        ...prev, floor: nextFloor, monster: nextMonster, combat: freshCombatState(),
        php: res.php, mhp: nextMonster.hp,
        logs: [...newLogs, `Étage ${run.floor} terminé !`, `Monstre suivant : ${nextMonster.name}`],
        accumulatedGold: prev.accumulatedGold + rewards.gold,
        accumulatedXp: prev.accumulatedXp + rewards.xp,
        accumulatedGems: prev.accumulatedGems + rewards.gems,
        skillCds: nextCds,
      } : null);
      // endlessBest = étage RÉELLEMENT vaincu (run.floor), pas l'étage suivant
      // qu'on s'apprête juste à affronter — sinon un joueur qui meurt aussitôt
      // entré dans l'étage N se voit quand même crédité de l'étage N.
      if (run.floor > (player.endlessBest || 0)) mutate(p => { p.endlessBest = run.floor; });
      return;
    }
    setRun(prev => prev ? { ...prev, php: res.php, mhp: res.mhp, combat: res.state, logs: newLogs, skillCds: nextCds } : null);
  };

  const endRun = async (reason: 'death' | 'flee') => {
    if (!run || endingRunRef.current) return;
    endingRunRef.current = true;
    const finalFloor = run.floor - (reason === 'death' ? 1 : 0);
    const { accumulatedGold, accumulatedXp, accumulatedGems, php } = run;
    setRun(null); // libère immédiatement le bouton Fuir/écran → plus de double-déclenchement.
    let levels = 0;
    mutate(p => {
      const pStats = deriveStats(p);
      p.hp = reason === 'death' ? Math.max(1, Math.floor(pStats.maxHp * 0.1)) : Math.min(php, pStats.maxHp);
      p.gold += accumulatedGold;
      p.gems += accumulatedGems;
      if (reason === 'death') p.deaths += 1;
      if (finalFloor > (p.endlessBest || 0)) p.endlessBest = finalFloor;
      // grantXp (pas p.xp += direct) : sinon xp/level/talentPoints désynchronisent
      // et la détection de « carry » de migratePlayer rétrograde le niveau au reload.
      levels = grantXp(p, accumulatedXp);
    });
    if (levels > 0) { playSound('levelup'); useGame.getState().celebrateLevelUp(); }
    if (finalFloor > 0) {
      toast(`Fin du run (Étage ${finalFloor}). +${accumulatedGold} Or, +${accumulatedXp} XP`, 'info');
      await saveEndlessScore({ uid: player.uid, name: player.name, floor: finalFloor, classId: player.classId, date: Date.now(), mode: 'solo' });
      loadLeaderboards();
    } else {
      toast('Tu es mort au premier étage…', 'bad');
    }
    endingRunRef.current = false;
  };

  // ── Multi helpers ──
  async function createLobby() {
    if (player!.hp <= 0) return toast('Soigne-toi d\'abord.', 'bad');
    try {
      const id = await createEndlessLobby(player!.uid, player!.name, player!.classId, deriveStats(player!), talentMods(player!), player!.level);
      mutate(d => { d.endlessSessionId = id; });
    } catch (e: any) { toast(e.message, 'bad'); }
  }
  async function joinLobby(id: string) {
    if (player!.hp <= 0) return toast('Soigne-toi d\'abord.', 'bad');
    try {
      await joinEndlessLobby(id, player!.uid, player!.name, player!.classId, deriveStats(player!), talentMods(player!), player!.level);
      mutate(d => { d.endlessSessionId = id; });
    } catch (e: any) { toast(e.message, 'bad'); }
  }
  async function leaveLobby() {
    if (session) await leaveEndless(session.id, player!.uid);
    mutate(d => { d.endlessSessionId = null; });
    setSession(null);
  }
  async function multiAct(action: string, selectedPotionId?: string, targetUid?: string) {
    if (!session || session.state !== 'combat') return;
    let heal = 0;
    let reviveFrac: number | undefined;
    if (action === 'potion') {
      if (!selectedPotionId) return;
      heal = item(selectedPotionId)!.hp ?? 0;
      mutate(d => { d.inventory[selectedPotionId]--; });
    }
    if (action === 'revive') {
      const useFeather = (player!.inventory['phoenix_feather'] ?? 0) > 0;
      const reviveItem = useFeather ? 'phoenix_feather' : 'phoenix_elixir';
      if ((player!.inventory[reviveItem] ?? 0) <= 0) return toast('Aucun objet de résurrection.', 'bad');
      mutate(d => { d.inventory[reviveItem]--; if (d.inventory[reviveItem] <= 0) delete d.inventory[reviveItem]; });
      reviveFrac = useFeather ? 0.7 : 0.3;
    }
    await submitEndlessAction(session.id, player!.uid, action, heal, targetUid, reviveFrac);
  }

  // Timeout auto (30s/tour).
  if (session && session.state === 'combat' && session.turnOrder[session.turnIdx] === player.uid) {
    if (Date.now() - session.turnStartAt > 30000) submitEndlessAction(session.id, player.uid, 'timeout');
  }

  // ════════ Vues multi ════════
  if (session && session.state === 'lobby') {
    const amHost = session.host === player.uid;
    const allReady = Object.values(session.players).every(pl => pl.ready);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-rose-300">👥 Abysses co-op · Lobby</div>
          <button onClick={leaveLobby} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Quitter</button>
        </div>
        <div className="space-y-2">
          {Object.values(session.players).map(pl => (
            <div key={pl.uid} className="flex items-center justify-between rounded-lg bg-black/25 p-2 text-sm">
              <span>{pl.uid === session.host ? '👑 ' : ''}{pl.name} <span className="text-slate-400">({CLASSES[pl.classId]?.name ?? pl.classId})</span></span>
              <span className={pl.ready ? 'text-emerald-400' : 'text-amber-400'}>{pl.ready ? 'Prêt' : 'Attente…'}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => toggleEndlessReady(session.id, player.uid)} className="rounded-lg bg-sky-500/40 py-2 font-semibold hover:bg-sky-500/60">
            {session.players[player.uid]?.ready ? 'Pas prêt' : 'Prêt'}
          </button>
          {amHost && (
            <button onClick={() => startEndless(session.id)} disabled={!allReady} className="rounded-lg bg-emerald-500/40 py-2 font-semibold hover:bg-emerald-500/60 disabled:opacity-40">
              Lancer la descente
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400">Invite tes coéquipiers : ils ouvrent la carte Abysses (onglet Multi) et rejoignent ton groupe.</p>
      </div>
    );
  }

  if (session && session.state === 'combat') {
    const m = session.monster!;
    const myTurn = session.turnOrder[session.turnIdx] === player.uid;
    const me = session.players[player.uid];
    const timeLeft = Math.max(0, 30 - Math.floor((Date.now() - session.turnStartAt) / 1000));
    const potionCount = POTIONS.reduce((n, id) => n + (player.inventory[id] ?? 0), 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-semibold text-slate-300">🕳️ Étage {session.floor} <span className="text-slate-500">· tour {session.roundCount}</span></div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-amber-300">💰{session.accGold}</span>
            <span className="text-sky-300">⭐{session.accXp}</span>
            <span className="text-fuchsia-300">💎{session.accGems}</span>
          </div>
          <button onClick={() => { if (confirm('Fuir met fin à la descente pour toute l\'équipe. Continuer ?')) multiAct('flee'); }} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Fuir</button>
        </div>

        {/* Monstre */}
        <div className={`rounded-xl p-4 text-center ${m.isBoss ? 'bg-purple-500/10 ring-1 ring-purple-400/30' : 'bg-black/25'}`}>
          {m.isBoss && <div className="mb-1 text-[10px] uppercase tracking-widest text-purple-300">⚠ Seigneur Abyssal</div>}
          <div className={`mb-1 text-4xl ${m.isBoss ? 'animate-pulse' : ''}`}>{m.emoji}</div>
          <div className={`text-sm font-bold ${m.isBoss ? 'text-purple-200' : 'text-rose-200'}`}>{m.name}</div>
          <div className="mx-4 mt-2"><Bar current={m.hp} max={m.maxHp} color={m.isBoss ? 'bg-purple-500' : 'bg-rose-500'} /></div>
          <div className="mt-1 text-xs text-slate-400">{Math.round(m.hp)} / {m.maxHp}</div>
        </div>

        {/* Équipe */}
        <div className="grid grid-cols-2 gap-2">
          {Object.values(session.players).map(pl => {
            const isTurn = session.turnOrder[session.turnIdx] === pl.uid;
            const pct = Math.max(0, (pl.hp / pl.maxHp) * 100);
            return (
              <div key={pl.uid} className={`rounded-lg border p-2 text-xs ${isTurn ? 'border-sky-400/50 bg-sky-500/10' : 'border-transparent bg-black/20'}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`font-semibold flex items-center gap-1 ${pl.isDead ? 'text-slate-500 line-through' : ''}`}>
                    {pl.name}{isTurn && !pl.isDead && ' ⏳'}
                    {pl.isDead && myTurn && !me?.isDead && ((player.inventory['phoenix_feather'] ?? 0) > 0 || (player.inventory['phoenix_elixir'] ?? 0) > 0) && (
                      <button onClick={() => multiAct('revive', undefined, pl.uid)} className="text-[10px] bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 px-1.5 py-0.5 rounded ml-1 no-underline">
                        {(player.inventory['phoenix_feather'] ?? 0) > 0 ? '🪶 Réanimer' : '🧊 Réanimer'}
                      </button>
                    )}
                  </span>
                  <span className="tabular-nums text-slate-400">{Math.round(pl.hp)}/{pl.maxHp}</span>
                </div>
                <div className="h-1.5 rounded bg-black/40"><div className={`h-1.5 rounded transition-all ${pct < 30 ? 'bg-rose-500' : 'bg-emerald-400'} ${pct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>

        {/* Journal */}
        <div className="h-28 space-y-1 overflow-y-auto rounded-xl bg-black/25 p-2 text-xs">
          {session.log.map((e, i) => (
            <div key={i} className={e.side === 'you' ? 'text-sky-300' : e.side === 'enemy' ? 'text-rose-300' : 'text-slate-400'}>{e.text}</div>
          ))}
          <div ref={logEnd} />
        </div>

        {/* Actions */}
        {myTurn && !me?.isDead ? (
          showPotions ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Choisir un soin :</div>
              <div className="grid grid-cols-2 gap-2">
                {POTIONS.filter(id => (player.inventory[id] ?? 0) > 0).map(id => (
                  <button key={id} onClick={() => { setShowPotions(false); multiAct('potion', id); }} className="flex flex-col items-center gap-1 rounded-lg bg-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-500/50">
                    <span className="inline-flex items-center gap-1"><ItemIcon id={id} size={16} /> {item(id)!.name}</span>
                    <span className="text-[10px] font-normal text-slate-300">({player.inventory[id] ?? 0})</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => multiAct('attack')} className="rounded-lg bg-rose-500/40 py-2.5 text-sm font-bold hover:bg-rose-500/60">⚔️ Attaquer</button>
              {getAllActiveSkills().filter(s => player.equippedSkills.includes(s.id)).map(skill => {
                const cd = me?.skillCds?.[skill.id] || 0;
                return (
                  <button key={skill.id} onClick={() => multiAct(skill.id)} disabled={cd > 0} title={skill.desc} className="rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40">
                    {cd > 0 ? `${skill.icon} ${skill.name} (${cd})` : `${skill.icon} ${skill.name}`}
                  </button>
                );
              })}
              <button onClick={() => { const a = POTIONS.filter(id => (player.inventory[id] ?? 0) > 0); if (a.length === 1) multiAct('potion', a[0]); else setShowPotions(true); }} disabled={potionCount === 0} className="rounded-lg bg-emerald-500/30 py-2.5 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40">
                🧪 Potion ({potionCount})
              </button>
              <div className="flex items-center justify-center rounded-lg bg-black/20 font-mono text-xs text-amber-200">00:{timeLeft.toString().padStart(2, '0')}</div>
            </div>
          )
        ) : (
          <div className="py-2 text-center text-xs text-slate-500">{me?.isDead ? '💀 Tu es K.O. — l\'équipe continue.' : 'En attente des autres joueurs…'}</div>
        )}
      </div>
    );
  }

  if (session && session.state === 'over') {
    const cleared = session.clearedFloors;
    return (
      <div className="space-y-3">
        <div className={`rounded-xl border p-4 text-center ${cleared > 0 ? 'border-amber-400/40 bg-amber-500/15' : 'border-rose-400/40 bg-rose-500/15'}`}>
          <div className="mb-2 text-2xl">{cleared > 0 ? '🏁' : '💀'}</div>
          <div className={`font-bold ${cleared > 0 ? 'text-amber-300' : 'text-rose-300'}`}>Descente terminée</div>
          <div className="mt-2 text-sm text-slate-300">Étages vaincus en équipe : <span className="font-bold">{cleared}</span></div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px]">
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-200">+{session.accGold} 🪙</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-200">+{session.accXp} XP</span>
            {session.accGems > 0 && <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-fuchsia-200">+{session.accGems} 💎</span>}
          </div>
        </div>
        <button onClick={leaveLobby} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">Fermer</button>
      </div>
    );
  }

  // ── Vue combat solo ──
  if (run) {
    const isBoss = run.monster.isBoss;
    const soloPotionId = POTIONS.find((id) => (player.inventory[id] ?? 0) > 0);
    const soloPotionCount = POTIONS.reduce((n, id) => n + (player.inventory[id] ?? 0), 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2">
          <span className="text-sm font-semibold text-rose-300">🕳️ Étage {run.floor}</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-amber-300">💰 {run.accumulatedGold}</span>
            <span className="text-sky-300">⭐ {run.accumulatedXp}</span>
            <span className="text-fuchsia-300">💎 {run.accumulatedGems}</span>
          </div>
        </div>
        <div className={`rounded-xl p-4 ${isBoss ? 'bg-purple-500/10 ring-1 ring-purple-400/30' : 'bg-black/25'}`}>
          <div className="flex flex-col items-center">
            {isBoss && <div className="mb-1 text-[10px] uppercase tracking-widest text-purple-300">⚠ Seigneur Abyssal</div>}
            <div className={`mb-2 text-5xl ${isBoss ? 'animate-pulse' : ''}`}>{run.monster.emoji}</div>
            <div className={`text-center text-sm font-bold ${isBoss ? 'text-purple-200' : 'text-rose-200'}`}>{run.monster.name}</div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>PV</span><span className="tabular-nums">{run.mhp} / {run.monster.maxHp}</span></div>
            <Bar current={run.mhp} max={run.monster.maxHp} color={isBoss ? 'bg-purple-500' : 'bg-rose-500'} />
          </div>
        </div>
        <div className="rounded-xl bg-black/25 p-3">
          <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span className="font-semibold text-emerald-300">{player.name}</span><span className="tabular-nums">{run.php} / {stats.maxHp} PV</span></div>
          <Bar current={run.php} max={stats.maxHp} color="bg-emerald-500" blink />
        </div>
        <div className="h-28 space-y-1 overflow-y-auto rounded-xl bg-black/25 p-2 text-xs">
          {run.logs.map((l, i) => (<div key={i} className="opacity-80 last:font-medium last:opacity-100">{l}</div>))}
        </div>
        {showSoloPotions ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Choisir un soin :</div>
            <div className="grid grid-cols-2 gap-2">
              {POTIONS.filter(id => (player.inventory[id] ?? 0) > 0).map(id => (
                <button key={id} onClick={() => { setShowSoloPotions(false); handleAction('potion', id); }} className="flex flex-col items-center gap-1 rounded-lg bg-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-500/50">
                  <span className="inline-flex items-center gap-1"><ItemIcon id={id} size={16} /> {item(id)!.name}</span>
                  <span className="text-[10px] font-normal text-slate-300">({player.inventory[id] ?? 0})</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowSoloPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleAction('attack')} className="rounded-lg bg-rose-500/40 py-2.5 text-sm font-bold hover:bg-rose-500/60">⚔️ Attaquer</button>
            {getAllActiveSkills().filter(s => player.equippedSkills.includes(s.id)).map(skill => {
              const cd = run.skillCds[skill.id] || 0;
              return (
                <button key={skill.id} onClick={() => handleAction(skill.id)} disabled={cd > 0} title={skill.desc} className="rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40">
                  {cd > 0 ? `${skill.icon} ${skill.name} (${cd})` : `${skill.icon} ${skill.name}`}
                </button>
              );
            })}
            <button
              onClick={() => {
                const available = POTIONS.filter(id => (player.inventory[id] ?? 0) > 0);
                if (available.length === 1) handleAction('potion', available[0]);
                else setShowSoloPotions(true);
              }}
              disabled={soloPotionCount <= 0}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/30 py-2.5 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40"
            >
              <ItemIcon id={soloPotionId ?? 'potion'} size={16} /> ({soloPotionCount})
            </button>
            <button onClick={() => handleAction('flee')} className="rounded-lg bg-slate-500/30 py-2.5 text-sm font-bold hover:bg-slate-500/50">🏃 Fuir</button>
          </div>
        )}
      </div>
    );
  }

  // ── Vue accueil ──
  const boardScores = lbTab === 'solo' ? soloScores : multiScores;
  const openLobbies = allSessions.filter(s => s.state === 'lobby' && s.id !== player.endlessSessionId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-black/25 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold text-rose-300">🕳️ Les Abysses Infinis</div>
            <div className="text-[10px] text-slate-400">Descendez sans répit. Les PV ne se régénèrent pas entre les étages.</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-slate-400">Meilleur</div>
            <div className="text-lg font-bold text-amber-300">Ét. {player.endlessBest || 0}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode('solo')} className={`flex-1 rounded-lg p-2 text-sm font-bold transition ${mode === 'solo' ? 'bg-rose-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>🗡️ Solo</button>
        <button onClick={() => setMode('multi')} className={`flex-1 rounded-lg p-2 text-sm font-bold transition ${mode === 'multi' ? 'bg-purple-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>👥 Multi</button>
      </div>

      {mode === 'solo' ? (
        <button onClick={startRun} className="w-full rounded-xl bg-rose-500/30 py-3 text-sm font-bold text-rose-100 hover:bg-rose-500/50">Démarrer un run</button>
      ) : (
        <div className="space-y-2">
          <button onClick={createLobby} className="w-full rounded-xl bg-purple-500/30 py-3 text-sm font-bold text-purple-100 hover:bg-purple-500/50">Créer un groupe</button>
          {openLobbies.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-300">Groupes en attente</div>
              {openLobbies.map(s => {
                const host = s.players[s.host];
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-purple-500/40 bg-purple-500/15 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-purple-200">Groupe de {host?.name ?? 'Inconnu'}</div>
                      <div className="text-[11px] text-purple-200/70">{Object.keys(s.players).length} joueur(s)</div>
                    </div>
                    <button onClick={() => joinLobby(s.id)} className="shrink-0 rounded bg-purple-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-purple-400">Rejoindre</button>
                  </div>
                );
              })}
            </div>
          )}
          {openLobbies.length === 0 && <p className="text-[11px] text-slate-400">Aucun groupe ouvert. Crée le tien et invite tes amis à rejoindre.</p>}
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">🏆 Classement</div>
        <div className="mb-2 flex gap-2">
          <button onClick={() => setLbTab('solo')} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${lbTab === 'solo' ? 'bg-rose-500/40 text-white' : 'bg-black/25 text-slate-400 hover:bg-white/10'}`}>Solo</button>
          <button onClick={() => setLbTab('multi')} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${lbTab === 'multi' ? 'bg-purple-500/40 text-white' : 'bg-black/25 text-slate-400 hover:bg-white/10'}`}>Multi</button>
        </div>
        {loading ? (
          <div className="animate-pulse text-sm text-slate-500">Chargement…</div>
        ) : boardScores.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun score {lbTab === 'multi' ? 'multi ' : ''}enregistré.</p>
        ) : (
          <ol className="space-y-1">
            {boardScores.map((score, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${score.uid === player.uid ? 'bg-sky-500/20' : 'bg-black/20'}`}>
                <span className="w-6 shrink-0 text-center font-bold text-slate-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{score.name}</div>
                  {score.party && score.party.length > 0 && <div className="truncate text-[10px] text-purple-300/60">avec {score.party.join(', ')}</div>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">Étage {score.floor}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
