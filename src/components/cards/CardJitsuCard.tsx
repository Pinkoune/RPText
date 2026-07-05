import { useEffect, useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { playSound } from '../../game/sound';
import { addSeasonPoints, SEASON_POINTS } from '../../game/season';
import { addQuestMetric } from '../../game/quests';
import {
  listenCJDuels,
  createCJDuel,
  joinCJDuel,
  playCJCard,
  resolveCJTurn,
  forfeitCJDuel,
  cjEnabled,
  type CJDuel,
} from '../../firebase/cardjitsuService';
import {
  compareCJ,
  cjBankWin,
  cjCounts,
  CJ_META,
  CJ_ELEMENTS,
  cjBelt,
  type CJCard,
  drawCJCard,
  aiPickCard,
} from '../../game/cardjitsu';

// ─── Composants UI génériques ───

function Chip({ card, big, hidden, empty }: { card?: CJCard; big?: boolean; hidden?: boolean; empty?: boolean }) {
  if (empty) {
    return (
      <span className={`inline-grid place-items-center rounded-lg border border-dashed border-white/20 bg-transparent ${big ? 'h-16 w-12 text-lg' : 'h-12 w-9 text-sm'}`} />
    );
  }
  if (hidden || !card) {
    return (
      <span className={`inline-grid place-items-center rounded-lg border border-slate-600 bg-slate-800 text-slate-500 font-bold ${big ? 'h-16 w-12 text-lg' : 'h-12 w-9 text-sm'}`}>
        ?
      </span>
    );
  }
  const m = CJ_META[card.element];
  return (
    <span
      className={`inline-grid place-items-center rounded-lg border font-bold ${big ? 'h-16 w-12 text-lg' : 'h-12 w-9 text-sm'}`}
      style={{ borderColor: m.color, background: `${m.color}22`, color: m.color }}
    >
      <span>{m.emoji}</span>
      <span>{card.value}</span>
    </span>
  );
}

function BankRow({ label, bank, highlight }: { label: ReactNode; bank: CJCard[]; highlight?: boolean }) {
  const c = cjCounts(bank);
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${highlight ? 'bg-sky-500/15' : 'bg-black/25'}`}>
      <span className="text-slate-300">{label}</span>
      <span className="flex gap-2">
        {CJ_ELEMENTS.map((e) => (
          <span key={e} className={c[e] >= 2 ? 'font-bold' : 'text-slate-400'} style={{ color: c[e] >= 2 ? CJ_META[e].color : undefined }}>
            {CJ_META[e].emoji}{c[e]}
          </span>
        ))}
      </span>
    </div>
  );
}

const HAND_SIZE = 4;
const newHand = () => Array.from({ length: HAND_SIZE }, drawCJCard);

export default function CardJitsuCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [duels, setDuels] = useState<CJDuel[]>([]);
  const [resolving, setResolving] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // ─── État Solo (Bot) ───
  const [soloStatus, setSoloStatus] = useState<'playing' | 'over' | null>(null);
  const [sPHand, setSPHand] = useState<CJCard[]>([]);
  const [sAHand, setSAHand] = useState<CJCard[]>([]);
  const [sPBank, setSPBank] = useState<CJCard[]>([]);
  const [sABank, setSABank] = useState<CJCard[]>([]);
  const [sRound, setSRound] = useState<{ p: CJCard; a: CJCard; w: 'p' | 'a' | 'tie' } | null>(null);
  const [sMsg, setSMsg] = useState('');
  const [sTurnStartTime, setSTurnStartTime] = useState<number>(0);

  useEffect(() => listenCJDuels(setDuels), []);

  // ─── GESTION DU TIMER (Solo & PvP) ───
  useEffect(() => {
    const timer = setInterval(() => {
      if (soloStatus === 'playing') {
        const diff = 20 - Math.floor((Date.now() - sTurnStartTime) / 1000);
        setTimeLeft(Math.max(0, diff));
        if (diff <= 0) {
          // Auto-pick solo
          playSolo(Math.floor(Math.random() * sPHand.length));
        }
      } else {
        const myGame = duels.find((d) => (d.hostUid === p?.uid || d.guestUid === p?.uid) && d.status === 'playing');
        if (myGame && myGame.turnStartTime) {
          const diff = 20 - Math.floor((Date.now() - myGame.turnStartTime) / 1000);
          setTimeLeft(Math.max(0, diff));
          if (diff <= 0) {
            const isHost = myGame.hostUid === p?.uid;
            const myPickIdx = isHost ? myGame.hostPick : myGame.guestPick;
            const myHand = isHost ? myGame.hostHand : myGame.guestHand;
            if (myPickIdx == null && !resolving) {
              playCJCard(myGame.id, isHost, Math.floor(Math.random() * myHand.length));
            }
          }
        } else {
          setTimeLeft(null);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  });

  // ─── GESTION DES RÉSULTATS PVP ───
  useEffect(() => {
    if (!p) return;
    for (const dl of duels) {
      const mine = dl.hostUid === p.uid || dl.guestUid === p.uid;
      if (dl.status === 'resolved' && mine && !p.settledCJDuels.includes(dl.id)) {
        const won = dl.winnerUid === p.uid;
        mutate((d) => {
          if (won) { d.cjWins = (d.cjWins ?? 0) + 1; addSeasonPoints(d, SEASON_POINTS.cjWin); addQuestMetric(d, 'pvpWins', 1); }
          d.settledCJDuels.push(dl.id);
        });
        if (won) {
          const before = cjBelt(p.cjWins ?? 0).current.name;
          const after = cjBelt((p.cjWins ?? 0) + 1);
          toast(`🥷 Card-Jitsu gagné ! (${(p.cjWins ?? 0) + 1} victoires)`, 'gold');
          if (after.current.name !== before) toast(`🎉 Nouvelle ceinture : ${after.current.name} !`, 'gold');
          playSound('win');
        } else if (dl.winnerUid !== 'tie') {
          toast('Card-Jitsu perdu…', 'bad');
          playSound('lose');
        }
      } else if (dl.status === 'cancelled' && dl.hostUid === p.uid && !p.settledCJDuels.includes(dl.id)) {
        mutate((d) => { d.settledCJDuels.push(dl.id); });
      }
    }
  }, [duels, p?.uid]);

  // ─── RÉSOLUTION PVP ───
  useEffect(() => {
    if (!p) return;
    const active = duels.find((d) => (d.hostUid === p.uid || d.guestUid === p.uid) && d.status === 'playing');
    if (active && active.hostUid === p.uid && active.hostPick != null && active.guestPick != null && !resolving) {
      setResolving(true);
      setTimeout(() => {
        const hCard = active.hostHand[active.hostPick!];
        const gCard = active.guestHand[active.guestPick!];
        const cmp = compareCJ(hCard, gCard);

        const nextHBank = [...active.hostBank];
        const nextGBank = [...active.guestBank];
        if (cmp > 0) nextHBank.push(hCard);
        else if (cmp < 0) nextGBank.push(gCard);

        const nextHHand = active.hostHand.filter((_, i) => i !== active.hostPick);
        nextHHand.push(drawCJCard());
        const nextGHand = active.guestHand.filter((_, i) => i !== active.guestPick);
        nextGHand.push(drawCJCard());

        let winnerUid: string | undefined;
        if (cjBankWin(nextHBank)) winnerUid = active.hostUid;
        if (cjBankWin(nextGBank)) winnerUid = active.guestUid!;

        resolveCJTurn(active.id, nextHHand, nextGHand, nextHBank, nextGBank, winnerUid).finally(() =>
          setResolving(false)
        );
      }, 1500);
    }
  }, [duels, p?.uid, resolving]);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name, wins: p.cjWins ?? 0 };
  const myGame = duels.find((d) => (d.hostUid === p.uid || d.guestUid === p.uid) && d.status !== 'cancelled' && d.status !== 'resolved' && !p.settledCJDuels.includes(d.id));

  // ─── ACTIONS SOLO ───
  function startSolo() {
    setSPHand(newHand());
    setSAHand(newHand());
    setSPBank([]);
    setSABank([]);
    setSRound(null);
    setSMsg('');
    setSTurnStartTime(Date.now());
    setSoloStatus('playing');
  }

  function playSolo(idx: number) {
    if (soloStatus !== 'playing') return;
    const pCard = sPHand[idx];
    const aIdx = aiPickCard(sAHand, sABank);
    const aCard = sAHand[aIdx];

    const cmp = compareCJ(pCard, aCard);
    const w: 'p' | 'a' | 'tie' = cmp > 0 ? 'p' : cmp < 0 ? 'a' : 'tie';

    const nextP = [...sPBank];
    const nextA = [...sABank];
    if (w === 'p') nextP.push(pCard);
    else if (w === 'a') nextA.push(aCard);

    const ph = sPHand.filter((_, i) => i !== idx); ph.push(drawCJCard());
    const ah = sAHand.filter((_, i) => i !== aIdx); ah.push(drawCJCard());

    setSPHand(ph);
    setSAHand(ah);
    setSPBank(nextP);
    setSABank(nextA);
    setSRound({ p: pCard, a: aCard, w });
    playSound(w === 'p' ? 'coin' : w === 'a' ? 'hit' : 'click');
    setSTurnStartTime(Date.now()); // Reset chrono pour prochain tour

    if (cjBankWin(nextP)) return finishSolo('p');
    if (cjBankWin(nextA)) return finishSolo('a');
  }

  function finishSolo(winner: 'p' | 'a') {
    setSoloStatus('over');
    setTimeLeft(null);
    if (winner === 'p') {
      setSMsg(`Victoire ! (Entraînement)`);
      playSound('win');
    } else {
      setSMsg(`Défaite… (Entraînement)`);
      playSound('lose');
    }
  }

  // ─── ACTIONS PVP ───
  function create() {
    createCJDuel(me, 0)
      .then(() => toast('Salon créé. En attente d\'un adversaire…', 'info'))
      .catch(() => toast('Échec.', 'bad'));
  }

  function join(dl: CJDuel) {
    joinCJDuel(dl.id, me).catch((e) => toast(`Défi indisponible (${e.message}).`, 'bad'));
  }

  // Rendu des Règles (intégré dans le flux pour éviter les bugs de clic)
  const rulesOverlay = (
    <div className="mb-4 rounded-xl border border-sky-500/30 bg-slate-900/80 p-4 text-sm text-slate-300">
      <h3 className="mb-3 font-bold text-white text-base">Règles du Card-Jitsu</h3>
      <ul className="mb-4 space-y-2 list-disc pl-4 text-[13px]">
        <li><strong>Le Triangle</strong> : 🔥 Feu bat Neige, Neige bat Eau, Eau bat Feu.</li>
        <li><strong>Égalité</strong> : Si même élément, la plus haute valeur gagne.</li>
        <li><strong>Victoire</strong> : 3 cartes du même élément OU 1 carte de chaque.</li>
        <li><strong>Timer</strong> : 20s par tour. Ensuite, une carte aléatoire est jouée.</li>
      </ul>
      <button onClick={() => setShowRules(false)} className="w-full rounded-lg bg-sky-500 py-1.5 font-semibold text-white hover:bg-sky-400">Masquer les règles</button>
    </div>
  );

  // ─── RENDER SOLO BOARD ───
  if (soloStatus) {
    return (
      <div className="space-y-4 relative">
        {showRules && rulesOverlay}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Entraînement Solo (Bot)</span>
          <div className="flex items-center gap-3">
            {soloStatus === 'playing' && <span className={`font-mono text-sm ${timeLeft! <= 5 ? 'text-rose-400 font-bold' : ''}`}>⏱️ {timeLeft}s</span>}
            <button onClick={() => setShowRules(true)} className="text-sky-400 hover:underline">[?] Règles</button>
          </div>
        </div>

        <BankRow label="🤖 Sensei (Bot)" bank={sABank} />

        <div className="grid min-h-[80px] place-items-center rounded-xl bg-black/30 p-2">
          {sRound ? (
            <div className="flex w-full items-center justify-around">
              <div className="text-center"><Chip card={sRound.p} big /><div className="mt-1 text-[10px] text-slate-400">toi</div></div>
              <div className={`text-sm font-bold ${sRound.w === 'p' ? 'text-emerald-300' : sRound.w === 'a' ? 'text-rose-300' : 'text-slate-400'}`}>
                {sRound.w === 'p' ? 'gagné' : sRound.w === 'a' ? 'perdu' : 'égalité'}
              </div>
              <div className="text-center"><Chip card={sRound.a} big /><div className="mt-1 text-[10px] text-slate-400">bot</div></div>
            </div>
          ) : (
            <span className="text-sm text-slate-500">Joue une carte pour commencer.</span>
          )}
        </div>

        <BankRow label="🧙 Toi" bank={sPBank} highlight />

        {soloStatus === 'over' ? (
          <div className="space-y-2 mt-4">
            <div className={`rounded-lg p-2.5 text-center text-sm font-semibold ${sMsg.includes('Victoire') ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border border-rose-400/40 bg-rose-500/15 text-rose-300'}`}>{sMsg}</div>
            <button onClick={() => setSoloStatus(null)} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">Quitter l'entraînement</button>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Ta main</div>
            <div className="flex justify-center gap-2">
              {sPHand.map((c, i) => (
                <button key={i} onClick={() => playSolo(i)} className="transition hover:-translate-y-1"><Chip card={c} big /></button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER PVP BOARD ───
  if (myGame) {
    const isHost = myGame.hostUid === p.uid;
    const isPlaying = myGame.status === 'playing';
    const myHand = isHost ? myGame.hostHand : myGame.guestHand;
    const myBank = isHost ? myGame.hostBank : myGame.guestBank;
    const opBank = isHost ? myGame.guestBank : myGame.hostBank;
    const opName = isHost ? myGame.guestName || 'En attente...' : myGame.hostName;
    const myPickIdx = isHost ? myGame.hostPick : myGame.guestPick;
    const opPickIdx = isHost ? myGame.guestPick : myGame.hostPick;
    const opHand = isHost ? myGame.guestHand : myGame.hostHand;

    const opHasPicked = opPickIdx != null;
    const opCard = opHasPicked && opHand ? opHand[opPickIdx!] : undefined;
    const myCard = myPickIdx != null ? myHand[myPickIdx] : undefined;

    const opWins = isHost ? myGame.guestWins ?? 0 : myGame.hostWins ?? 0;
    const opBelt = cjBelt(opWins).current;
    const reveal = myPickIdx != null && opPickIdx != null;

    return (
      <div className="space-y-4 relative">
        {showRules && rulesOverlay}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Match Card-Jitsu</span>
          <div className="flex items-center gap-3">
            {isPlaying && <span className={`font-mono text-sm ${timeLeft! <= 5 ? 'text-rose-400 font-bold' : ''}`}>⏱️ {timeLeft ?? '--'}s</span>}
            <button onClick={() => setShowRules(true)} className="text-sky-400 hover:underline">[?] Règles</button>
            <button onClick={() => forfeitCJDuel(myGame.id, isHost, myGame.hostUid, myGame.guestUid)} className="text-rose-400 hover:underline">Forfait</button>
          </div>
        </div>

        <BankRow label={<span>🥋 <span style={{ color: opBelt.color }}>{opBelt.name}</span> · {opName}</span>} bank={opBank} />

        <div className="grid min-h-[80px] place-items-center rounded-xl bg-black/30 p-2">
          {isPlaying ? (
            <div className="flex w-full items-center justify-around">
              <div className="text-center">
                <Chip card={myCard} big hidden={false} empty={myPickIdx == null} />
                <div className="mt-1 text-[10px] text-emerald-400">{myPickIdx != null ? 'Prêt' : 'À toi'}</div>
              </div>
              <div className="text-xl text-slate-500">VS</div>
              <div className="text-center">
                <Chip card={opCard} big hidden={!reveal} empty={!opHasPicked} />
                <div className="mt-1 text-[10px] text-rose-400">{opHasPicked ? 'Prêt' : 'Réfléchit...'}</div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-500 animate-pulse">En attente d'un adversaire...</span>
          )}
        </div>

        <BankRow label="🧙 Toi" bank={myBank} highlight />

        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Ta main</div>
          <div className="flex justify-center gap-2">
            {myHand.map((c, i) => (
              <button
                key={i}
                disabled={!isPlaying || myPickIdx != null}
                onClick={() => { playSound('click'); playCJCard(myGame.id, isHost, i); }}
                className={`transition ${!isPlaying || myPickIdx != null ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1'}`}
              >
                <Chip card={c} big />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER LOBBY ───
  const lobby = duels.filter((d) => d.status === 'open' && d.hostUid !== p.uid);

  return (
    <div className="space-y-4 relative">
      {showRules && rulesOverlay}
      {/* Ceinture (façon Club Penguin) */}
      {(() => {
        const belt = cjBelt(p.cjWins ?? 0);
        const prev = belt.current.wins;
        const goal = belt.next?.wins ?? belt.current.wins;
        const pct = belt.next ? Math.min(100, (((p.cjWins ?? 0) - prev) / (goal - prev)) * 100) : 100;
        return (
          <div className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">🥋 <span style={{ color: belt.current.color }}>{belt.current.name}</span></span>
              <span className="text-[11px] text-slate-400">{p.cjWins ?? 0} victoire{(p.cjWins ?? 0) > 1 ? 's' : ''}</span>
            </div>
            <div className="mt-1.5 h-2 rounded bg-black/40"><div className="h-2 rounded" style={{ width: `${pct}%`, background: belt.current.color }} /></div>
            {belt.next && <div className="mt-1 text-[10px] text-slate-500">Prochaine : {belt.next.name} à {belt.next.wins} victoires</div>}
          </div>
        );
      })()}

      <div className="flex gap-2">
        <button onClick={create} className="flex-1 rounded-lg bg-fuchsia-500/40 px-3 py-2 text-sm font-semibold hover:bg-fuchsia-500/60">
          Créer un salon PvP
        </button>
        <button onClick={startSolo} className="flex-1 rounded-lg bg-emerald-500/30 px-3 py-2 text-sm font-semibold hover:bg-emerald-500/50">
          S'entraîner (Solo)
        </button>
      </div>
      
      <div className="flex justify-end">
        <button onClick={() => setShowRules(true)} className="text-xs text-sky-400 hover:underline flex items-center gap-1">
          <span>[?]</span> Règles du jeu
        </button>
      </div>

      {!cjEnabled && (
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Configure Firebase pour défier d'autres joueurs en ligne !
        </p>
      )}

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Salons ouverts · {lobby.length}</div>
        {lobby.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun défi ouvert.</p>
        ) : (
          <div className="space-y-1.5">
            {lobby.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">🥋 <span style={{ color: cjBelt(d.hostWins ?? 0).current.color }}>{cjBelt(d.hostWins ?? 0).current.name}</span> · {d.hostName}</span>
                <button onClick={() => join(d)} className="shrink-0 rounded bg-fuchsia-500/30 px-3 py-1 text-xs font-semibold hover:bg-fuchsia-500/50">Rejoindre</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
