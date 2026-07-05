import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import ItemIcon from './ItemIcon';

export default function BaitTimer() {
  const p = useGame((s) => s.player);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [baitId, setBaitId] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;

    const update = () => {
      const now = Date.now();
      const activeBait = p.activeBuffs?.find(b => b.id.startsWith('bait_') && b.expiresAt > now);

      if (activeBait) {
        setTimeLeft(Math.ceil((activeBait.expiresAt - now) / 1000));
        setBaitId(activeBait.id);
      } else {
        setTimeLeft(null);
        setBaitId(null);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [p]);

  if (timeLeft === null) return null;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;

  // Au-dessus du dock sur mobile (< 640px), coin bas-droit sur desktop.
  return (
    <div className="pointer-events-none fixed right-3 z-[40] bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] sm:bottom-4 sm:right-4">
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-900/60 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg backdrop-blur-md animate-floatIn">
        {baitId ? <ItemIcon id={baitId} size={18} /> : <span>🧪</span>}
        <span className="hidden sm:inline">Appât Actif</span>
        <span className="font-mono text-emerald-400">
          {m}:{s.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
