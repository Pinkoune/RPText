import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { listenDuels, createDuel, joinDuel, cancelDuel, duelsEnabled, type Duel } from '../../firebase/duelService';

export default function DuelCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [bet, setBet] = useState(20);

  useEffect(() => listenDuels(setDuels), []);

  // Encaissement automatique des duels résolus/annulés me concernant.
  useEffect(() => {
    if (!p) return;
    for (const dl of duels) {
      const mine = dl.hostUid === p.uid || dl.guestUid === p.uid;
      if (dl.status === 'resolved' && mine && !p.settledDuels.includes(dl.id)) {
        const won = dl.winnerUid === p.uid;
        mutate((d) => {
          if (won) d.gold += dl.bet * 2;
          d.settledDuels.push(dl.id);
        });
        toast(won ? `⚔️ Duel gagné ! +${dl.bet} 🪙 net` : `Duel perdu… -${dl.bet} 🪙`, won ? 'gold' : 'bad');
      } else if (dl.status === 'cancelled' && dl.hostUid === p.uid && !p.settledDuels.includes(dl.id)) {
        mutate((d) => {
          d.gold += dl.bet;
          d.settledDuels.push(dl.id);
        });
      }
    }
  }, [duels, p?.uid]);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name };

  function create() {
    if (p!.gold < bet) return toast('Pas assez d\'or.', 'bad');
    if (!duelsEnabled) {
      // Mode local : duel contre un adversaire fantôme.
      const won = Math.random() < 0.5;
      mutate((d) => { d.gold += won ? bet : -bet; });
      toast(won ? `👻 Tu bats l'adversaire fantôme ! +${bet} 🪙` : `👻 L'adversaire fantôme l'emporte. -${bet} 🪙`, won ? 'gold' : 'bad');
      return;
    }
    mutate((d) => { d.gold -= bet; });
    createDuel(me, bet)
      .then(() => toast('Défi créé. En attente d\'un adversaire…', 'info'))
      .catch(() => { mutate((d) => { d.gold += bet; }); toast('Échec de création.', 'bad'); });
  }

  function join(dl: Duel) {
    if (p!.gold < dl.bet) return toast('Pas assez d\'or pour ce duel.', 'bad');
    mutate((d) => { d.gold -= dl.bet; });
    joinDuel(dl, me).catch((e) => {
      mutate((d) => { d.gold += dl.bet; });
      toast(`Duel indisponible (${e.message}).`, 'bad');
    });
  }

  const myOpen = duels.filter((d) => d.hostUid === p.uid && d.status === 'open');
  const lobby = duels.filter((d) => d.status === 'open' && d.hostUid !== p.uid);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Pile ou face en <b>PvP</b> : le gagnant rafle la mise des deux joueurs. Or : <b>{p.gold} 🪙</b>
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm">Mise</span>
        {[20, 50, 100].map((v) => (
          <button key={v} onClick={() => setBet(v)} className="rounded bg-black/30 px-2 py-1 text-xs hover:bg-white/10">{v}</button>
        ))}
        <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded bg-black/30 px-2 py-1 text-right text-sm outline-none" />
        <button onClick={create} className="ml-auto rounded-lg bg-fuchsia-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-fuchsia-500/60">
          Créer un défi
        </button>
      </div>

      {!duelsEnabled && (
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : tu affrontes un adversaire fantôme. Configure Firebase pour défier de vrais joueurs.
        </p>
      )}

      {myOpen.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Mes défis en attente</div>
          {myOpen.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
              <span>Mise {d.bet} 🪙</span>
              <button onClick={() => cancelDuel(d.id)} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Annuler</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Défis ouverts · {lobby.length}</div>
        {lobby.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun défi pour l'instant. Crée le tien !</p>
        ) : (
          <div className="space-y-1.5">
            {lobby.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{d.hostName} · <b>{d.bet} 🪙</b></span>
                <button onClick={() => join(d)} className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50">Relever</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
