import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchLeaderboard, trackPresence, type LeaderRow, type OnlinePlayer } from '../../firebase/socialService';
import { isFirebaseConfigured } from '../../firebase/config';
import { CLASSES } from '../../game/classes';

export default function LeaderboardCard() {
  const p = useGame((s) => s.player);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Masque les inactifs depuis > 30 min ; marque en jaune ceux > 5 min.
  const visibleOnline = online.filter((o) => o.lastActive == null || Date.now() - o.lastActive < 30 * 60 * 1000);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          En ligne · {visibleOnline.length}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const visible = visibleOnline;
            if (visible.length === 0) return <span className="text-xs text-slate-500">Personne pour l'instant.</span>;
            return visible.map((o) => {
              const idle = o.lastActive != null && Date.now() - o.lastActive >= 5 * 60 * 1000;
              return (
                <span
                  key={o.uid}
                  className={`rounded-full px-2 py-0.5 text-xs ${idle ? 'bg-yellow-500/20 text-yellow-300' : 'bg-emerald-500/20'}`}
                  title={idle ? 'Inactif depuis plus de 5 min' : 'Actif'}
                >
                  {idle ? '🟡' : '🟢'} {o.name} <span className={idle ? 'text-yellow-500/70' : 'text-slate-400'}>Nv.{o.level}</span>
                </span>
              );
            });
          })()}
        </div>
      </div>

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
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 text-xs text-slate-400">Nv.{r.level} · {r.kills}☠</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
