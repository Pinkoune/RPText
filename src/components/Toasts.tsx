import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/gameStore';

const TONE: Record<string, string> = {
  info: 'border-sky-400/40 bg-sky-500/15',
  good: 'border-emerald-400/40 bg-emerald-500/15',
  bad: 'border-rose-400/40 bg-rose-500/15',
  gold: 'border-amber-400/50 bg-amber-500/15',
};

export default function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer rounded-xl border px-4 py-2.5 text-sm backdrop-blur ${TONE[t.tone]}`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
