import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { applyGamble, canGamble } from '../../game/gambling';
import { playSound } from '../../game/sound';
import {
  drawCJCard, compareCJ, cjBankWin, cjCounts, aiPickCard, CJ_META, CJ_ELEMENTS,
  type CJCard,
} from '../../game/cardjitsu';

const HAND = 4;
const newHand = () => Array.from({ length: HAND }, drawCJCard);

function Chip({ card, big }: { card: CJCard; big?: boolean }) {
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

function BankRow({ label, bank, highlight }: { label: string; bank: CJCard[]; highlight?: boolean }) {
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

export default function CardJitsuCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [status, setStatus] = useState<'betting' | 'playing' | 'over'>('betting');
  const [bet, setBet] = useState(20);
  const [pHand, setPHand] = useState<CJCard[]>([]);
  const [aHand, setAHand] = useState<CJCard[]>([]);
  const [pBank, setPBank] = useState<CJCard[]>([]);
  const [aBank, setABank] = useState<CJCard[]>([]);
  const [round, setRound] = useState<{ p: CJCard; a: CJCard; w: 'p' | 'a' | 'tie' } | null>(null);
  const [msg, setMsg] = useState('');

  if (!p) return null;

  function start() {
    if (!canGamble(p!, bet)) { toast('Mise invalide.', 'bad'); return; }
    setPHand(newHand()); setAHand(newHand());
    setPBank([]); setABank([]); setRound(null); setMsg('');
    setStatus('playing');
  }

  function play(idx: number) {
    if (status !== 'playing') return;
    const pCard = pHand[idx];
    const aIdx = aiPickCard(aHand, aBank);
    const aCard = aHand[aIdx];

    const cmp = compareCJ(pCard, aCard);
    const w: 'p' | 'a' | 'tie' = cmp > 0 ? 'p' : cmp < 0 ? 'a' : 'tie';

    const nextP = [...pBank];
    const nextA = [...aBank];
    if (w === 'p') nextP.push(pCard);
    else if (w === 'a') nextA.push(aCard);

    // Nouvelles mains (on retire la carte jouée, on pioche une remplaçante).
    const ph = pHand.filter((_, i) => i !== idx); ph.push(drawCJCard());
    const ah = aHand.filter((_, i) => i !== aIdx); ah.push(drawCJCard());

    setPHand(ph); setAHand(ah); setPBank(nextP); setABank(nextA);
    setRound({ p: pCard, a: aCard, w });
    playSound(w === 'p' ? 'coin' : w === 'a' ? 'hit' : 'click');

    if (cjBankWin(nextP)) return finish('p');
    if (cjBankWin(nextA)) return finish('a');
  }

  function finish(winner: 'p' | 'a') {
    setStatus('over');
    if (winner === 'p') {
      mutate((d) => applyGamble(d, bet));
      setMsg(`Victoire ! +${bet} 🪙`);
      playSound('win');
      toast(`🥷 Card-Jitsu gagné ! +${bet} 🪙`, 'gold');
    } else {
      mutate((d) => applyGamble(d, -bet));
      setMsg(`Défaite… -${bet} 🪙`);
      playSound('lose');
      toast(`🥷 Card-Jitsu perdu… -${bet} 🪙`, 'bad');
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        🔥 bat ❄️ · ❄️ bat 💧 · 💧 bat 🔥. À élément égal, la plus haute valeur gagne.
        Banque <b>3 du même élément</b> ou <b>une de chaque</b> pour gagner.
      </p>

      {status === 'betting' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Mise : <b>{p.gold} 🪙</b> dispo</span>
            <div className="flex items-center gap-1">
              {[20, 50, 100].map((v) => (
                <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-0.5 hover:bg-white/10">{v}</button>
              ))}
              <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded bg-black/30 px-2 py-0.5 text-right outline-none" />
            </div>
          </div>
          <button onClick={start} className="w-full rounded-lg bg-fuchsia-500/40 py-2.5 text-sm font-semibold hover:bg-fuchsia-500/60">🥷 Affronter le ninja ({bet} 🪙)</button>
          <p className="text-center text-[11px] text-slate-500">Adversaire géré par l'IA (le PvP en temps réel viendra avec la mise en relation des joueurs).</p>
        </div>
      ) : (
        <>
          <BankRow label="🥷 Ninja" bank={aBank} />
          {/* Zone de révélation */}
          <div className="grid min-h-[80px] place-items-center rounded-xl bg-black/30 p-2">
            {round ? (
              <div className="flex items-center gap-4">
                <div className="text-center"><Chip card={round.p} big /><div className="mt-1 text-[10px] text-slate-400">toi</div></div>
                <div className={`text-sm font-bold ${round.w === 'p' ? 'text-emerald-300' : round.w === 'a' ? 'text-rose-300' : 'text-slate-400'}`}>
                  {round.w === 'p' ? 'gagné' : round.w === 'a' ? 'perdu' : 'égalité'}
                </div>
                <div className="text-center"><Chip card={round.a} big /><div className="mt-1 text-[10px] text-slate-400">ninja</div></div>
              </div>
            ) : (
              <span className="text-sm text-slate-500">Joue une carte pour lancer la manche.</span>
            )}
          </div>
          <BankRow label="🧙 Toi" bank={pBank} highlight />

          {status === 'over' ? (
            <div className="space-y-2">
              <div className={`rounded-lg p-2.5 text-center text-sm font-semibold ${msg.includes('Victoire') ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border border-rose-400/40 bg-rose-500/15 text-rose-300'}`}>{msg}</div>
              <button onClick={() => setStatus('betting')} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">Rejouer</button>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Ta main — clique une carte</div>
              <div className="flex justify-center gap-2">
                {pHand.map((c, i) => (
                  <button key={i} onClick={() => play(i)} className="transition hover:-translate-y-1">
                    <Chip card={c} big />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
