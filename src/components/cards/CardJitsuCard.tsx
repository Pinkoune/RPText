import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { playSound } from '../../game/sound';
import {
  listenCJDuels,
  createCJDuel,
  joinCJDuel,
  cancelCJDuel,
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
  type CJCard,
  drawCJCard,
} from '../../game/cardjitsu';

function Chip({ card, big, hidden }: { card?: CJCard; big?: boolean; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <span
        className={`inline-grid place-items-center rounded-lg border border-slate-600 bg-slate-800 text-slate-500 font-bold ${
          big ? 'h-16 w-12 text-lg' : 'h-12 w-9 text-sm'
        }`}
      >
        ?
      </span>
    );
  }
  const m = CJ_META[card.element];
  return (
    <span
      className={`inline-grid place-items-center rounded-lg border font-bold ${
        big ? 'h-16 w-12 text-lg' : 'h-12 w-9 text-sm'
      }`}
      style={{ borderColor: m.color, background: `${m.color}22`, color: m.color }}
    >
      <span>{m.emoji}</span>
      <span>{card.value}</span>
    </span>
  );
}

function BankRow({ label, bank, highlight }: { label: string; bank: CJCard[]; highlight?: boolean }) {
  const c = cjCounts(bank);
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
        highlight ? 'bg-sky-500/15' : 'bg-black/25'
      }`}
    >
      <span className="text-slate-300">{label}</span>
      <span className="flex gap-2">
        {CJ_ELEMENTS.map((e) => (
          <span
            key={e}
            className={c[e] >= 2 ? 'font-bold' : 'text-slate-400'}
            style={{ color: c[e] >= 2 ? CJ_META[e].color : undefined }}
          >
            {CJ_META[e].emoji}
            {c[e]}
          </span>
        ))}
      </span>
    </div>
  );
}

export default function CardJitsuCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [duels, setDuels] = useState<CJDuel[]>([]);
  const [bet, setBet] = useState(1);
  const [resolving, setResolving] = useState(false); // Empêche de jouer pendant l'animation

  useEffect(() => listenCJDuels(setDuels), []);

  // Encaissement automatique des duels résolus/annulés
  useEffect(() => {
    if (!p) return;
    for (const dl of duels) {
      const mine = dl.hostUid === p.uid || dl.guestUid === p.uid;
      if (dl.status === 'resolved' && mine && !p.settledCJDuels.includes(dl.id)) {
        const won = dl.winnerUid === p.uid;
        const tie = dl.winnerUid === 'tie';
        mutate((d) => {
          if (won) d.fateCoins += dl.bet * 2;
          if (tie) d.fateCoins += dl.bet; // remboursement
          d.settledCJDuels.push(dl.id);
        });
        if (won) {
          toast(`🥷 Card-Jitsu gagné ! +${dl.bet} Fate Coins`, 'gold');
          playSound('win');
        } else if (tie) {
          toast(`Partie annulée, mise remboursée.`, 'info');
        } else {
          toast(`Card-Jitsu perdu… -${dl.bet} Fate Coins`, 'bad');
          playSound('lose');
        }
      } else if (dl.status === 'cancelled' && dl.hostUid === p.uid && !p.settledCJDuels.includes(dl.id)) {
        mutate((d) => {
          d.fateCoins += dl.bet;
          d.settledCJDuels.push(dl.id);
        });
      }
    }
  }, [duels, p?.uid]);

  // Résolution automatique par l'hôte quand les deux joueurs ont joué
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
      }, 1500); // Petit délai pour laisser voir les cartes jouées
    }
  }, [duels, p?.uid, resolving]);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name };

  const myGame = duels.find((d) => (d.hostUid === p.uid || d.guestUid === p.uid) && d.status !== 'cancelled' && d.status !== 'resolved' && !p.settledCJDuels.includes(d.id));

  function create() {
    if (p!.fateCoins < bet) return toast('Pas assez de Fate Coins.', 'bad');
    mutate((d) => { d.fateCoins -= bet; });
    createCJDuel(me, bet)
      .then(() => toast('Défi créé. En attente…', 'info'))
      .catch(() => { mutate((d) => { d.fateCoins += bet; }); toast('Échec.', 'bad'); });
  }

  function join(dl: CJDuel) {
    if (p!.fateCoins < dl.bet) return toast('Pas assez de Fate Coins.', 'bad');
    mutate((d) => { d.fateCoins -= dl.bet; });
    joinCJDuel(dl.id, me).catch((e) => {
      mutate((d) => { d.fateCoins += dl.bet; });
      toast(`Défi indisponible (${e.message}).`, 'bad');
    });
  }

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

    // Révélation complète seulement quand les deux ont joué
    const reveal = myPickIdx != null && opPickIdx != null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Match : {myGame.bet} 🪙 Fate Coins</span>
          <button onClick={() => forfeitCJDuel(myGame.id, isHost, myGame.hostUid, myGame.guestUid)} className="text-rose-400 hover:underline">Forfait / Abandonner</button>
        </div>

        <BankRow label={`🥷 ${opName}`} bank={opBank} />

        <div className="grid min-h-[80px] place-items-center rounded-xl bg-black/30 p-2">
          {isPlaying ? (
            <div className="flex w-full items-center justify-around">
              <div className="text-center">
                <Chip card={myCard} big hidden={myPickIdx == null} />
                <div className="mt-1 text-[10px] text-emerald-400">{myPickIdx != null ? 'Prêt' : 'À toi'}</div>
              </div>
              <div className="text-xl text-slate-500">VS</div>
              <div className="text-center">
                <Chip card={opCard} big hidden={!reveal} />
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

  // Lobby view
  const lobby = duels.filter((d) => d.status === 'open' && d.hostUid !== p.uid);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        🔥 bat ❄️ · ❄️ bat 💧 · 💧 bat 🔥. Valeur la plus haute l'emporte.
        Banque <b>3 du même élément</b> ou <b>une de chaque</b> pour gagner en PvP.
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm">Fate Coins : <b>{p.fateCoins}</b></span>
        <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="ml-auto w-16 rounded bg-black/30 px-2 py-1 text-right text-sm outline-none" />
        <button onClick={create} className="rounded-lg bg-fuchsia-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-fuchsia-500/60">
          Créer un salon
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
                <span className="min-w-0 truncate">{d.hostName} · <b>{d.bet} 🪙</b></span>
                <button onClick={() => join(d)} className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50">Rejoindre</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
