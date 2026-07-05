import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { runCommand } from '../game/commands';
import { getRaidWindow, RAID_MIN_LEVEL } from '../game/raid';

/**
 * Grosse notification affichée pendant les fenêtres d'inscription au raid
 * (10h00→10h10, 20h00→20h10) pour les joueurs niveau 25+. Clic = inscription.
 */
export default function RaidBanner() {
  const player = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const open = useUi((s) => s.open);
  const [win, setWin] = useState(() => getRaidWindow());
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setWin(getRaidWindow()), 5000);
    return () => clearInterval(t);
  }, []);

  if (!player || player.level < RAID_MIN_LEVEL) return null;
  if (!win.open || dismissed === win.key) return null;
  // Déjà inscrit à la session du jour → pas de bannière.
  if (player.dungeonSessionId === `raid-${win.key}`) return null;

  const min = Math.floor(win.msLeft / 60000);
  const sec = Math.floor((win.msLeft % 60000) / 1000);

  function join() {
    runCommand('raid', { getPlayer: () => useGame.getState().player, mutate, open, toast });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h,76px)+0.5rem)] z-40 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-lg animate-floatIn rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-900/80 to-rose-900/80 p-3 shadow-[0_0_25px_rgba(251,191,36,0.35)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔱</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-amber-200">LE RAID EST OUVERT !</div>
            <div className="text-[11px] text-amber-100/80">
              3 donjons enchaînés · illimité en joueurs. Inscriptions : {min}:{sec.toString().padStart(2, '0')} restantes.
            </div>
          </div>
          <button onClick={join} className="shrink-0 rounded-lg bg-amber-500/80 px-3 py-2 text-sm font-bold text-black hover:bg-amber-400">
            Rejoindre
          </button>
          <button onClick={() => setDismissed(win.key)} className="shrink-0 rounded-lg px-2 py-2 text-amber-200/70 hover:bg-white/10" aria-label="Masquer">✕</button>
        </div>
      </div>
    </div>
  );
}
