import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { watchLeaderboard, trackPresence, type LeaderRow, type OnlinePlayer } from '../../firebase/socialService';
import { isFirebaseConfigured } from '../../firebase/config';
import { CLASSES } from '../../game/classes';
import { auraColor } from '../../game/prestige';
import PlayerProfileModal from '../PlayerProfileModal';

export default function LeaderboardCard() {
  const p = useGame((s) => s.player);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<LeaderRow | null>(null);

  useEffect(() => {
    let unsubLeader = () => {};
    let unsubOnline = () => {};
    
    unsubLeader = watchLeaderboard(15, (data) => {
      setRows(data);
      setLoading(false);
    });

    if (p) {
      unsubOnline = trackPresence({ uid: p.uid, name: p.name, level: p.level }, setOnline);
    }
    
    return () => {
      unsubLeader();
      unsubOnline();
    };
  }, [p?.uid, p?.level]);

  // Actifs (< 5 min), inactifs (5-30 min), le reste (> 30 min) masqué.
  const now = Date.now();
  const idleMs = (o: OnlinePlayer) => (o.lastActive == null ? 0 : now - o.lastActive);
  const activePlayers = online.filter((o) => idleMs(o) < 5 * 60 * 1000);
  const idlePlayers = online.filter((o) => idleMs(o) >= 5 * 60 * 1000 && idleMs(o) < 30 * 60 * 1000);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-400/80">
          🟢 En ligne · {activePlayers.length}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activePlayers.length === 0
            ? <span className="text-xs text-slate-500">Personne pour l'instant.</span>
            : activePlayers.map((o) => (
                <span key={o.uid} className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs">
                  🟢 {o.name} <span className="text-slate-400">Nv.{o.level}</span>
                </span>
              ))}
        </div>
      </div>

      {idlePlayers.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-500/70">
            🟡 Inactif · {idlePlayers.length}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {idlePlayers.map((o) => (
              <span key={o.uid} className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300/90" title="Inactif depuis plus de 5 min">
                🟡 {o.name} <span className="text-yellow-500/60">Nv.{o.level}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Top aventuriers</div>
        {loading ? (
          <div className="animate-pulse text-sm text-slate-500">Chargement…</div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-500">
            {isFirebaseConfigured
              ? 'Aucun joueur classé pour le moment.'
              : 'Classement indisponible en mode local. Configure Firebase pour le multijoueur.'}
          </p>
        ) : (
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li
                key={r.uid}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  r.uid === p?.uid ? 'bg-sky-500/20' : 'bg-black/20'
                }`}
              >
                <span className="w-6 shrink-0 text-center font-bold text-slate-400">{i + 1}</span>
                <span className="shrink-0">{CLASSES[r.classId]?.emoji ?? '🧑'}</span>
                <button onClick={() => setViewing(r)} className="min-w-0 flex-1 truncate text-left hover:text-sky-300 hover:underline">
                  {(r.prestigeLevel ?? 0) > 0 && (
                    <span className="mr-1 font-bold text-purple-300" title={`Prestige ${r.prestigeLevel}`}>✦{r.prestigeLevel}</span>
                  )}
                  {r.prestigeAura && <span className="mr-1">{r.prestigeAura}</span>}
                  {r.title && <span className="font-semibold text-amber-300 mr-1">[{r.title}]</span>}
                  <span style={{ color: auraColor(r.prestigeAura, r.auraColorOn ?? true) }}>{r.name}</span>
                </button>
                <span className="shrink-0 text-xs text-slate-400">Nv.{r.level} · {r.kills}☠</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {viewing && (
        <PlayerProfileModal
          row={viewing}
          onClose={() => setViewing(null)}
          onMessage={viewing.uid === p?.uid ? undefined : () => { useUi.getState().open('chat', { dmPeer: viewing.name }, { singleton: true }); setViewing(null); }}
        />
      )}
    </div>
  );
}
