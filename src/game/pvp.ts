// ─── Duel PvP simulé ─────────────────────────────────────────────────────────
// Combat équilibré entre deux joueurs à partir de leurs stats effectives. Le plus
// fort est favorisé, mais la variance laisse une vraie chance à l'outsider. Pur :
// pas de dépendance Firebase, exécuté une fois dans la transaction du duel.

export interface DuelFighter {
  name: string;
  atk: number;
  def: number;
  maxHp: number;
}

export interface DuelSim {
  winner: 'host' | 'guest';
  log: string[];
}

function hit(atk: number, def: number): number {
  const base = atk - def * 0.5;
  const varied = base * (0.8 + Math.random() * 0.4);
  return Math.max(1, Math.round(varied));
}

/** Simule un duel au tour par tour. Renvoie le vainqueur et un court journal. */
export function simulateDuel(host: DuelFighter, guest: DuelFighter): DuelSim {
  let hHp = Math.max(1, host.maxHp);
  let gHp = Math.max(1, guest.maxHp);
  const log: string[] = [];
  let turn: 'host' | 'guest' = Math.random() < 0.5 ? 'host' : 'guest';
  let rounds = 0;

  while (hHp > 0 && gHp > 0 && rounds < 60) {
    rounds++;
    if (turn === 'host') {
      const d = hit(host.atk, guest.def);
      gHp -= d;
      log.push(`${host.name} inflige ${d} à ${guest.name}. (${Math.max(0, Math.round(gHp))} PV)`);
      turn = 'guest';
    } else {
      const d = hit(guest.atk, host.def);
      hHp -= d;
      log.push(`${guest.name} inflige ${d} à ${host.name}. (${Math.max(0, Math.round(hHp))} PV)`);
      turn = 'host';
    }
  }

  // Vainqueur : dernier debout, ou plus grande part de PV restante si temps écoulé.
  let winner: 'host' | 'guest';
  if (hHp <= 0 && gHp <= 0) winner = Math.random() < 0.5 ? 'host' : 'guest';
  else if (gHp <= 0) winner = 'host';
  else if (hHp <= 0) winner = 'guest';
  else winner = hHp / host.maxHp >= gHp / guest.maxHp ? 'host' : 'guest';

  return { winner, log: log.slice(-12) };
}
