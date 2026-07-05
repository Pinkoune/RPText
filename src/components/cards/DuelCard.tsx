import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { deriveStats } from '../../game/player';
import { talentMods, getAllActiveSkills } from '../../game/talents';
import { simulateDuel } from '../../game/pvp';
import { addSeasonPoints, SEASON_POINTS } from '../../game/season';
import { item, RARITY_COLOR } from '../../game/items';
import { auraColor } from '../../game/prestige';
import { sendChat } from '../../firebase/chatService';
import ItemIcon from '../ItemIcon';
import {
  pvpDuelsEnabled, listenPvpDuel, listenAllPvpDuels, createPvpDuel, joinPvpDuel,
  togglePvpReady, leavePvpDuel, startPvpDuel, submitPvpAction,
  type PvpDuelSession, type DuelMode, type DuelSide,
} from '../../firebase/pvpDuelService';

const POTIONS = ['herb_tea', 'potion', 'hi_potion', 'grilled_fish', 'hearty_stew'];

export default function DuelCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [bet, setBet] = useState(20);
  const [mode, setMode] = useState<DuelMode>('1v1');
  const [combatLog, setCombatLog] = useState<{ won: boolean; log: string[] } | null>(null);

  // Multi (RTDB)
  const [session, setSession] = useState<PvpDuelSession | null>(null);
  const [allSessions, setAllSessions] = useState<PvpDuelSession[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [showPotions, setShowPotions] = useState(false);
  const [, tick] = useState(0);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { if (pvpDuelsEnabled) return listenAllPvpDuels(setAllSessions); }, []);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!p?.pvpDuelSessionId) { setSession(null); return; }
    return listenPvpDuel(p.pvpDuelSessionId, setSession);
  }, [p?.pvpDuelSessionId]);

  useEffect(() => {
    useGame.getState().setInCombat(session?.state === 'combat');
    return () => useGame.getState().setInCombat(false);
  }, [session?.state]);

  // Encaissement une seule fois à la fin du duel.
  useEffect(() => {
    if (!p || !session || session.state !== 'over') return;
    if (p.settledPvpDuels?.includes(session.id)) return;
    const me = session.fighters[p.uid];
    const won = !!me && me.side === session.winnerSide;
    mutate((d) => {
      d.settledPvpDuels = d.settledPvpDuels || [];
      d.settledPvpDuels.push(session.id);
      if (won) {
        d.gold += session.bet * 2;
        addSeasonPoints(d, SEASON_POINTS.duelWin);
      }
    });
    toast(won ? `⚔️ Duel gagné ! +${session.bet * 2} 🪙 · +${SEASON_POINTS.duelWin} pts saison` : `Duel perdu… -${session.bet} 🪙`, won ? 'gold' : 'bad');
  }, [session?.state]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.log]);

  if (!p) return null;
  const stats = deriveStats(p);
  const mods = talentMods(p);
  const mySkills = getAllActiveSkills().filter((s) => p.equippedSkills.includes(s.id));
  const myFighterInput = () => ({ uid: p.uid, name: p.name, classId: p.classId, stats, mods, equippedSkills: p.equippedSkills, aura: p.prestigeAura, auraColorOn: p.auraColorOn });

  function closeSession() {
    mutate((d) => { d.pvpDuelSessionId = null; });
    setSession(null);
  }

  // ── Mode local (Firebase non configuré) : combat instantané contre un fantôme ──
  if (!pvpDuelsEnabled) {
    const myFighter = { name: p.name, atk: stats.atk, def: stats.def, maxHp: stats.maxHp };
    function createGhost() {
      if (p!.gold < bet) return toast('Pas assez d\'or.', 'bad');
      const ghost = { name: 'Fantôme', atk: Math.round(myFighter.atk * (0.85 + Math.random() * 0.3)), def: Math.round(myFighter.def * (0.85 + Math.random() * 0.3)), maxHp: Math.round(myFighter.maxHp * (0.85 + Math.random() * 0.3)) };
      const sim = simulateDuel(myFighter, ghost);
      const won = sim.winner === 'host';
      mutate((d) => { d.gold += won ? bet : -bet; });
      setCombatLog({ won, log: sim.log });
      toast(won ? `👻 Tu bats le Fantôme ! +${bet} 🪙` : `👻 Le Fantôme l'emporte. -${bet} 🪙`, won ? 'gold' : 'bad');
    }
    return (
      <div className="space-y-3">
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : tu affrontes un adversaire fantôme. Configure Firebase pour des duels en temps réel contre de vrais joueurs.
        </p>
        {combatLog && (
          <div className="rounded-lg bg-black/30 p-2">
            <div className={`mb-1 text-xs font-semibold ${combatLog.won ? 'text-emerald-300' : 'text-rose-300'}`}>
              {combatLog.won ? '⚔️ Victoire !' : '💀 Défaite…'}
              <button onClick={() => setCombatLog(null)} className="float-right text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <div className="max-h-24 space-y-0.5 overflow-auto text-[11px] text-slate-400">
              {combatLog.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm">Mise</span>
          {[20, 50, 100].map((v) => (
            <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-1 text-xs hover:bg-white/10">{v}</button>
          ))}
          <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded bg-black/30 px-2 py-1 text-right text-sm outline-none" />
          <button onClick={createGhost} className="ml-auto rounded-lg bg-fuchsia-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-fuchsia-500/60">Défier</button>
        </div>
      </div>
    );
  }

  // ── Lobby : je crée ou rejoins un défi ──
  async function create() {
    if (p!.gold < bet) return toast('Pas assez d\'or.', 'bad');
    mutate((d) => { d.gold -= bet; });
    try {
      const id = await createPvpDuel(mode, bet, myFighterInput());
      mutate((d) => { d.pvpDuelSessionId = id; });
    } catch (e: any) {
      mutate((d) => { d.gold += bet; });
      toast(e.message, 'bad');
    }
  }
  async function join(dl: PvpDuelSession, side: DuelSide) {
    if (p!.gold < dl.bet) return toast('Pas assez d\'or pour ce duel.', 'bad');
    mutate((d) => { d.gold -= dl.bet; });
    try {
      await joinPvpDuel(dl.id, side, myFighterInput());
      mutate((d) => { d.pvpDuelSessionId = dl.id; });
    } catch (e: any) {
      mutate((d) => { d.gold += dl.bet; });
      toast(`Impossible (${e.message}).`, 'bad');
    }
  }
  async function leave() {
    if (!session) return;
    const wasIn = !!session.fighters[p!.uid];
    await leavePvpDuel(session.id, p!.uid);
    if (wasIn && session.state === 'lobby') mutate((d) => { d.gold += session.bet; });
    closeSession();
  }
  async function ready() {
    if (!session) return;
    await togglePvpReady(session.id, p!.uid);
  }
  async function start() {
    if (!session) return;
    await startPvpDuel(session.id);
  }
  async function act(action: string, potionHeal?: number) {
    if (!session) return;
    await submitPvpAction(session.id, p!.uid, action, { targetUid: target ?? undefined, potionHeal });
  }

  // Timeout auto.
  if (session && session.state === 'combat' && session.turnOrder[session.turnIdx] === p.uid) {
    if (Date.now() - session.turnStartAt > 30000) submitPvpAction(session.id, p.uid, 'timeout');
  }

  // ── Vue Lobby (mon duel) ──
  if (session && session.state === 'lobby') {
    const cap = session.mode === '2v2' ? 2 : 1;
    const sideA = Object.values(session.fighters).filter((f) => f.side === 'A');
    const sideB = Object.values(session.fighters).filter((f) => f.side === 'B');
    const amHost = session.hostUid === p.uid;
    const full = sideA.length === cap && sideB.length === cap;
    const allReady = Object.values(session.fighters).every((f) => f.ready);
    const mySide: DuelSide | undefined = session.fighters[p.uid]?.side;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">⚔️ Duel {session.mode} <span className="text-sm text-slate-400">(Lobby · mise {session.bet} 🪙)</span></div>
          <button onClick={leave} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Quitter</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['A', 'B'] as DuelSide[]).map((s) => {
            const list = s === 'A' ? sideA : sideB;
            return (
              <div key={s} className={`rounded-lg p-2 ${s === 'A' ? 'bg-sky-500/10 border border-sky-400/30' : 'bg-rose-500/10 border border-rose-400/30'}`}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Camp {s} ({list.length}/{cap})</div>
                {list.map((f) => (
                  <div key={f.uid} className="flex items-center justify-between text-xs py-0.5">
                    <span style={{ color: auraColor(f.aura, f.auraColorOn ?? true) }}>{f.name}</span>
                    <span className={f.ready ? 'text-emerald-400' : 'text-amber-400'}>{f.ready ? 'Prêt' : '…'}</span>
                  </div>
                ))}
                {list.length < cap && !mySide && (
                  <button onClick={() => join(session, s)} className="mt-1 w-full rounded bg-black/30 px-2 py-1 text-[11px] hover:bg-white/10">Rejoindre</button>
                )}
              </div>
            );
          })}
        </div>

        {p.teamId && session.mode === '2v2' && (
          <button
            onClick={() => { sendChat({ uid: p.uid, name: p.name }, `⚔️ Rejoins mon duel 2v2 ! (Duels PvP)`, 'team', p.teamId!); toast('Équipe prévenue dans le chat.', 'good'); }}
            className="w-full rounded bg-black/30 px-2 py-1.5 text-xs hover:bg-white/10"
          >
            📣 Inviter mon équipe (chat)
          </button>
        )}

        {mySide && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={ready} className="rounded-lg bg-sky-500/40 py-2 font-semibold hover:bg-sky-500/60">
              {session.fighters[p.uid]?.ready ? 'Pas prêt' : 'Prêt'}
            </button>
            {amHost && (
              <button onClick={start} disabled={!full || !allReady} className="rounded-lg bg-emerald-500/40 py-2 font-semibold hover:bg-emerald-500/60 disabled:opacity-40">
                Lancer le duel
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Vue Combat ──
  if (session && session.state === 'combat') {
    const me = session.fighters[p.uid];
    const myTurn = session.turnOrder[session.turnIdx] === p.uid;
    const opponents = Object.values(session.fighters).filter((f) => f.side !== me?.side && !f.isDead);
    const timeLeft = Math.max(0, 30 - Math.floor((Date.now() - session.turnStartAt) / 1000));
    const potionCount = POTIONS.reduce((n, id) => n + (p.inventory[id] ?? 0), 0);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-semibold text-slate-300">⚔️ Duel {session.mode} <span className="text-slate-500">· tour {session.roundCount}</span></span>
          <span className="font-mono text-amber-200">00:{timeLeft.toString().padStart(2, '0')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['A', 'B'] as DuelSide[]).map((s) => (
            <div key={s} className={`space-y-1.5 rounded-lg p-2 ${s === 'A' ? 'bg-sky-500/10' : 'bg-rose-500/10'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Camp {s}</div>
              {Object.values(session.fighters).filter((f) => f.side === s).map((f) => {
                const isTurn = session.turnOrder[session.turnIdx] === f.uid;
                const pct = Math.max(0, (f.hp / f.maxHp) * 100);
                const selectable = f.side !== me?.side && !f.isDead && myTurn;
                return (
                  <button
                    key={f.uid}
                    onClick={() => selectable && setTarget(f.uid)}
                    disabled={!selectable}
                    className={`w-full rounded-lg border p-1.5 text-left text-xs ${isTurn ? 'border-amber-400/60 bg-amber-500/10' : 'border-transparent bg-black/20'} ${target === f.uid ? 'ring-1 ring-rose-400' : ''} ${f.isDead ? 'opacity-40' : ''}`}
                  >
                    <div className="flex justify-between">
                      <span className={f.isDead ? 'line-through' : ''} style={{ color: f.isDead ? undefined : auraColor(f.aura, f.auraColorOn ?? true) }}>{f.name}{isTurn && !f.isDead && ' ⏳'}</span>
                      <span className="tabular-nums text-slate-400">{Math.round(f.hp)}/{f.maxHp}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded bg-black/40"><div className={`h-1.5 rounded ${pct < 30 ? 'bg-rose-500' : 'bg-emerald-400'} ${pct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }} /></div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {session.mode === '2v2' && opponents.length > 1 && myTurn && (
          <p className="text-center text-[10px] text-slate-500">Clique un adversaire ci-dessus pour cibler ({opponents.find((o) => o.uid === target)?.name ?? opponents[0].name} par défaut).</p>
        )}

        <div className="h-24 space-y-1 overflow-y-auto rounded-lg bg-black/25 p-2 text-xs">
          {session.log.map((e, i) => (
            <div key={i} className={e.side === 'you' ? 'text-sky-300' : e.side === 'enemy' ? 'text-rose-300' : 'text-slate-400'}>{e.text}</div>
          ))}
          <div ref={logEnd} />
        </div>

        {myTurn && !me?.isDead ? (
          showPotions ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Choisir un soin :</div>
              <div className="grid grid-cols-2 gap-2">
                {POTIONS.filter((id) => (p.inventory[id] ?? 0) > 0).map((id) => (
                  <button key={id} onClick={() => { setShowPotions(false); act('potion', item(id)!.hp ?? 0); mutate((d) => { d.inventory[id]--; }); }} className="flex flex-col items-center gap-1 rounded-lg bg-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-500/50">
                    <span className="inline-flex items-center gap-1"><ItemIcon id={id} size={16} /> {item(id)!.name}</span>
                    <span className="text-[10px] font-normal text-slate-300">({p.inventory[id] ?? 0})</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act('attack')} className="rounded-lg bg-rose-500/40 py-2.5 text-sm font-bold hover:bg-rose-500/60">⚔️ Attaquer</button>
              {mySkills.map((skill) => {
                const cd = me?.skillCds?.[skill.id] || 0;
                return (
                  <button key={skill.id} onClick={() => act(skill.id)} disabled={cd > 0} title={skill.desc} className="rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40">
                    {cd > 0 ? `${skill.icon} ${skill.name} (${cd})` : `${skill.icon} ${skill.name}`}
                  </button>
                );
              })}
              <button onClick={() => { const a = POTIONS.filter((id) => (p.inventory[id] ?? 0) > 0); if (a.length === 1) { act('potion', item(a[0])!.hp ?? 0); mutate((d) => { d.inventory[a[0]]--; }); } else setShowPotions(true); }} disabled={potionCount === 0} className="rounded-lg bg-emerald-500/30 py-2.5 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40">
                🧪 Potion ({potionCount})
              </button>
            </div>
          )
        ) : (
          <div className="py-2 text-center text-xs text-slate-500">{me?.isDead ? '💀 Tu es K.O. — ton camp continue.' : 'En attente de ton adversaire…'}</div>
        )}
      </div>
    );
  }

  // ── Vue Fin ──
  if (session && session.state === 'over') {
    const me = session.fighters[p.uid];
    const won = !!me && me.side === session.winnerSide;
    return (
      <div className="space-y-3">
        <div className={`rounded-xl border p-4 text-center ${won ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-rose-400/40 bg-rose-500/15'}`}>
          <div className="mb-2 text-2xl">{won ? '🏆' : '💀'}</div>
          <div className={`font-bold ${won ? 'text-emerald-300' : 'text-rose-300'}`}>{won ? 'Victoire !' : 'Défaite…'}</div>
          {won && <div className="mt-2 text-sm">+{session.bet * 2} 🪙 · +{SEASON_POINTS.duelWin} pts saison</div>}
        </div>
        <button onClick={closeSession} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">Fermer</button>
      </div>
    );
  }

  // ── Vue accueil / lobby global ──
  const openDuels = allSessions.filter((s) => s.state === 'lobby' && !s.fighters[p.uid]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        <b>Duel PvP temps réel</b> : tour par tour avec tes compétences équipées, comme en chasse. Le camp K.O. perd sa mise. Or : <b>{p.gold} 🪙</b>
      </p>

      <div className="flex gap-2">
        <button onClick={() => setMode('1v1')} className={`flex-1 rounded-lg p-2 text-sm font-bold transition ${mode === '1v1' ? 'bg-fuchsia-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>🗡️ 1v1</button>
        <button onClick={() => setMode('2v2')} className={`flex-1 rounded-lg p-2 text-sm font-bold transition ${mode === '2v2' ? 'bg-fuchsia-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>👥 2v2</button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm">Mise</span>
        {[20, 50, 100].map((v) => (
          <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-1 text-xs hover:bg-white/10">{v}</button>
        ))}
        <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded bg-black/30 px-2 py-1 text-right text-sm outline-none" />
        <button onClick={create} className="ml-auto rounded-lg bg-fuchsia-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-fuchsia-500/60">Créer un défi</button>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Défis ouverts · {openDuels.length}</div>
        {openDuels.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun défi pour l'instant. Crée le tien !</p>
        ) : (
          <div className="space-y-1.5">
            {openDuels.map((dl) => {
              const cap = dl.mode === '2v2' ? 2 : 1;
              const sideA = Object.values(dl.fighters).filter((f) => f.side === 'A');
              const sideB = Object.values(dl.fighters).filter((f) => f.side === 'B');
              const host = sideA[0];
              return (
                <div key={dl.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {dl.mode === '2v2' ? '👥' : '🗡️'} {host?.name} · <b>{dl.bet} 🪙</b> <span className="text-[10px] text-slate-500">(A {sideA.length}/{cap} · B {sideB.length}/{cap})</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {sideA.length < cap && <button onClick={() => join(dl, 'A')} className="rounded bg-sky-500/30 px-2 py-1 text-xs font-semibold hover:bg-sky-500/50">+ Camp A</button>}
                    {sideB.length < cap && <button onClick={() => join(dl, 'B')} className="rounded bg-rose-500/30 px-2 py-1 text-xs font-semibold hover:bg-rose-500/50">+ Camp B</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

