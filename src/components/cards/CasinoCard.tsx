import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  coinflip, slots, wheel, drawCard, handValue, isBlackjack, applyGamble, canGamble,
  type GambleResult, type Currency, type Card,
} from '../../game/gambling';
import { currentPhase, PHASE_LABEL } from '../../game/daynight';
import { playSound } from '../../game/sound';

type Game = 'coinflip' | 'blackjack' | 'slots' | 'wheel';

const TABS: { id: Game; label: string; cur: Currency }[] = [
  { id: 'coinflip', label: 'Pile/Face', cur: 'gold' },
  { id: 'blackjack', label: 'Blackjack', cur: 'gold' },
  { id: 'slots', label: 'Machine', cur: 'gold' },
  { id: 'wheel', label: 'Roue 🎲', cur: 'fateCoins' },
];

export default function CasinoCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [game, setGame] = useState<Game>('coinflip');
  const [bet, setBet] = useState(10);
  const [result, setResult] = useState<GambleResult | null>(null);
  const [rolling, setRolling] = useState(false);

  // État du blackjack
  const [bj, setBj] = useState<'idle' | 'player' | 'done'>('idle');
  const [pCards, setPCards] = useState<Card[]>([]);
  const [dCards, setDCards] = useState<Card[]>([]);
  const [reveal, setReveal] = useState(false);
  const [bjMsg, setBjMsg] = useState('');

  if (!p) return null;
  const tab = TABS.find((t) => t.id === game)!;
  const balance = p[tab.cur];

  function play(action: (pl: import('../../game/types').PlayerState) => GambleResult) {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    let r: GambleResult | null = null;
    mutate((d) => { r = action(d); });
    setTimeout(() => {
      setResult(r);
      setRolling(false);
      if (r) playSound(r.win ? 'coin' : 'lose');
      if (r && r.delta !== 0) {
        const unit = tab.cur === 'gold' ? '🪙' : '🎲';
        toast(`${r.win ? '+' : ''}${r.delta} ${unit} — ${r.detail}`, r.win ? 'gold' : 'bad');
      }
    }, 600);
  }

  // ── Blackjack ──
  function bjResolve(player: Card[], dealerStart: Card[]) {
    const dealer = [...dealerStart];
    while (handValue(dealer) < 17) dealer.push(drawCard());
    const pv = handValue(player);
    const dv = handValue(dealer);
    let delta = -bet;
    let msg = '';
    if (pv > 21) { delta = -bet; msg = `Tu dépasses 21 (${pv}). Perdu.`; }
    else if (isBlackjack(player) && !isBlackjack(dealerStart)) { delta = Math.floor(bet * 1.5); msg = `Blackjack ! +${delta} 🪙`; }
    else if (dv > 21) { delta = bet; msg = `Le croupier dépasse 21 (${dv}). Gagné !`; }
    else if (pv > dv) { delta = bet; msg = `${pv} contre ${dv} — Gagné !`; }
    else if (pv < dv) { delta = -bet; msg = `${pv} contre ${dv} — Perdu.`; }
    else { delta = 0; msg = `Égalité (${pv}). Mise rendue.`; }

    setDCards(dealer);
    setReveal(true);
    setBj('done');
    setBjMsg(msg);
    if (delta !== 0) mutate((d) => applyGamble(d, delta));
    playSound(delta > 0 ? 'coin' : delta < 0 ? 'lose' : 'click');
    if (delta !== 0) toast(`${delta > 0 ? '+' : ''}${delta} 🪙 — ${msg}`, delta > 0 ? 'gold' : 'bad');
  }

  function bjDeal() {
    if (!canGamble(p!, bet)) { toast('Mise invalide.', 'bad'); return; }
    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    setPCards(player); setDCards(dealer); setReveal(false); setBjMsg('');
    if (isBlackjack(player)) { bjResolve(player, dealer); return; }
    setBj('player');
  }
  function bjHit() {
    const player = [...pCards, drawCard()];
    setPCards(player);
    if (handValue(player) >= 21) bjResolve(player, dCards);
  }
  function bjStand() { bjResolve(pCards, dCards); }

  const cardChip = (c: Card, hidden = false) => (
    <span className={`inline-grid h-10 w-8 place-items-center rounded-md border text-sm font-bold ${hidden ? 'border-white/10 bg-slate-700/60 text-slate-500' : 'border-white/20 bg-white/90 text-slate-900'}`}>
      {hidden ? '?' : c.label}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setGame(t.id); setResult(null); setBj('idle'); }}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${game === t.id ? 'bg-purple-500/40' : 'bg-black/25 hover:bg-white/10'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>Solde : <b>{balance}</b> {tab.cur === 'gold' ? '🪙' : '🎲'}</span>
        <div className="flex items-center gap-1">
          {[10, 50, 100].map((v) => (
            <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-0.5 hover:bg-white/10">{v}</button>
          ))}
          <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded bg-black/30 px-2 py-0.5 text-right outline-none" />
        </div>
      </div>

      {game === 'blackjack' ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-black/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Croupier {reveal ? `(${handValue(dCards)})` : ''}</div>
            <div className="mt-1 flex gap-1.5">
              {dCards.length === 0 ? <span className="text-sm text-slate-500">—</span> :
                dCards.map((c, i) => <span key={i}>{cardChip(c, !reveal && i === 1)}</span>)}
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">Toi {pCards.length ? `(${handValue(pCards)})` : ''}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {pCards.length === 0 ? <span className="text-sm text-slate-500">—</span> :
                pCards.map((c, i) => <span key={i}>{cardChip(c)}</span>)}
            </div>
            {bjMsg && <div className={`mt-2 text-sm font-semibold ${bjMsg.includes('Gagné') || bjMsg.includes('Blackjack') ? 'text-emerald-300' : bjMsg.includes('Égalité') ? 'text-slate-300' : 'text-rose-300'}`}>{bjMsg}</div>}
          </div>
          {bj === 'idle' || bj === 'done' ? (
            <button onClick={bjDeal} className="w-full rounded-lg bg-purple-500/40 py-2.5 text-sm font-semibold hover:bg-purple-500/60">🃏 Distribuer ({bet} 🪙)</button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={bjHit} className="rounded-lg bg-sky-500/40 py-2.5 text-sm font-bold hover:bg-sky-500/60">Tirer</button>
              <button onClick={bjStand} className="rounded-lg bg-amber-500/40 py-2.5 text-sm font-bold hover:bg-amber-500/60">Rester</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid min-h-[70px] place-items-center rounded-xl bg-black/30 p-3 text-center">
            {rolling ? (
              <div className="animate-pulse text-2xl">🎲…</div>
            ) : result ? (
              <div className="animate-floatIn">
                {result.symbols && <div className="text-3xl tracking-widest">{result.symbols.join(' ')}</div>}
                {result.rollValue !== undefined && !result.symbols && <div className="text-3xl font-bold">{result.rollValue}</div>}
                <div className={`mt-1 text-sm font-semibold ${result.win ? 'text-emerald-300' : 'text-rose-300'}`}>{result.detail}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Place ta mise et tente le destin.</div>
            )}
          </div>

          {game === 'coinflip' && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => play((d) => coinflip(d, 'gold', bet, 'heads'))} className="rounded-lg bg-yellow-500/30 py-2 text-sm hover:bg-yellow-500/50">🟡 Pile</button>
              <button onClick={() => play((d) => coinflip(d, 'gold', bet, 'tails'))} className="rounded-lg bg-slate-400/30 py-2 text-sm hover:bg-slate-400/50">⚪ Face</button>
            </div>
          )}
          {game === 'slots' && (
            <button onClick={() => play((d) => slots(d, 'gold', bet))} className="w-full rounded-lg bg-purple-500/40 py-2.5 text-sm font-semibold hover:bg-purple-500/60">🎰 Lancer les rouleaux</button>
          )}
          {game === 'wheel' && (
            <div className="space-y-2">
              <p className="text-center text-xs text-slate-400">
                Roue payée en 🎲 Fate Coins. Phase : <b>{PHASE_LABEL[currentPhase()]}</b>
                {currentPhase() === 'night' ? ' — segments x10 possibles mais plus risqués !' : ''}
              </p>
              <button onClick={() => play((d) => wheel(d, bet))} className="w-full rounded-lg bg-fuchsia-500/40 py-2.5 text-sm font-semibold hover:bg-fuchsia-500/60">🎡 Tourner la Roue du Destin</button>
            </div>
          )}
        </>
      )}

      <p className="text-center text-[11px] text-slate-500">
        Bilan gambling total : <b className={p.gambleNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.gambleNet} 🪙</b>
      </p>
    </div>
  );
}
