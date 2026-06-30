import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { coinflip, dice, slots, wheel, type GambleResult, type Currency } from '../../game/gambling';
import { currentPhase, PHASE_LABEL } from '../../game/daynight';
import { playSound } from '../../game/sound';

type Game = 'coinflip' | 'dice' | 'slots' | 'wheel';

const TABS: { id: Game; label: string; cur: Currency }[] = [
  { id: 'coinflip', label: 'Pile/Face', cur: 'gold' },
  { id: 'dice', label: 'Dés', cur: 'gold' },
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
  if (!p) return null;

  const tab = TABS.find((t) => t.id === game)!;
  const balance = p[tab.cur];

  function play(action: (p: import('../../game/types').PlayerState) => GambleResult) {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    let r: GambleResult | null = null;
    mutate((d) => {
      r = action(d);
    });
    // Petite latence pour l'effet de suspense.
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

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setGame(t.id); setResult(null); }}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              game === t.id ? 'bg-purple-500/40' : 'bg-black/25 hover:bg-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>Solde : <b>{balance}</b> {tab.cur === 'gold' ? '🪙' : '🎲'}</span>
        <div className="flex items-center gap-1">
          {[10, 50, 100].map((v) => (
            <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-0.5 hover:bg-white/10">
              {v}
            </button>
          ))}
          <input
            type="number"
            min={1}
            value={bet}
            onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded bg-black/30 px-2 py-0.5 text-right outline-none"
          />
        </div>
      </div>

      {/* Zone de résultat */}
      <div className="grid min-h-[70px] place-items-center rounded-xl bg-black/30 p-3 text-center">
        {rolling ? (
          <div className="animate-pulse text-2xl">🎲…</div>
        ) : result ? (
          <div className="animate-floatIn">
            {result.symbols && <div className="text-3xl tracking-widest">{result.symbols.join(' ')}</div>}
            {result.rollValue !== undefined && !result.symbols && (
              <div className="text-3xl font-bold">{result.rollValue}</div>
            )}
            <div className={`mt-1 text-sm font-semibold ${result.win ? 'text-emerald-300' : 'text-rose-300'}`}>
              {result.detail}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Place ta mise et tente le destin.</div>
        )}
      </div>

      {/* Actions par jeu */}
      {game === 'coinflip' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => play((d) => coinflip(d, 'gold', bet, 'heads'))} className="rounded-lg bg-yellow-500/30 py-2 text-sm hover:bg-yellow-500/50">🟡 Pile</button>
          <button onClick={() => play((d) => coinflip(d, 'gold', bet, 'tails'))} className="rounded-lg bg-slate-400/30 py-2 text-sm hover:bg-slate-400/50">⚪ Face</button>
        </div>
      )}
      {game === 'dice' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => play((d) => dice(d, 'gold', bet, 'high'))} className="rounded-lg bg-rose-500/30 py-2 text-sm hover:bg-rose-500/50">⬆ Haut (4-6)</button>
          <button onClick={() => play((d) => dice(d, 'gold', bet, 'low'))} className="rounded-lg bg-sky-500/30 py-2 text-sm hover:bg-sky-500/50">⬇ Bas (1-3)</button>
        </div>
      )}
      {game === 'slots' && (
        <button onClick={() => play((d) => slots(d, 'gold', bet))} className="w-full rounded-lg bg-purple-500/40 py-2.5 text-sm font-semibold hover:bg-purple-500/60">
          🎰 Lancer les rouleaux
        </button>
      )}
      {game === 'wheel' && (
        <div className="space-y-2">
          <p className="text-center text-xs text-slate-400">
            Roue payée en 🎲 Fate Coins. Phase : <b>{PHASE_LABEL[currentPhase()]}</b>
            {currentPhase() === 'night' ? ' — segments x10 possibles mais plus risqués !' : ''}
          </p>
          <button onClick={() => play((d) => wheel(d, bet))} className="w-full rounded-lg bg-fuchsia-500/40 py-2.5 text-sm font-semibold hover:bg-fuchsia-500/60">
            🎡 Tourner la Roue du Destin
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-slate-500">
        Bilan gambling total : <b className={p.gambleNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.gambleNet} 🪙</b>
      </p>
    </div>
  );
}
