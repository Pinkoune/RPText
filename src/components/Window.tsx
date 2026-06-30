import { useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useUi, type GameWindow } from '../store/uiStore';

interface Props {
  win: GameWindow;
  index: number;
  title: string;
  accent?: string;
  children: React.ReactNode;
}

/** Chrome d'une fenêtre flottante : drag par l'en-tête, focus, fermeture, TTL. */
export default function Window({ win, index, title, accent, children }: Props) {
  const close = useUi((s) => s.close);
  const focus = useUi((s) => s.focus);
  const controls = useDragControls();

  useEffect(() => {
    if (win.ttl && win.ttl > 0) {
      const t = setTimeout(() => close(win.id), win.ttl);
      return () => clearTimeout(t);
    }
  }, [win.id, win.ttl, close]);

  // Cascade : léger décalage par fenêtre pour les distinguer.
  const offset = index * 22;

  return (
    // Conteneur de centrage : Framer Motion pilote `transform` sur la fenêtre,
    // donc on centre via ce wrapper (grid) plutôt qu'avec translate.
    <div
      className="pointer-events-none fixed inset-0 grid place-items-center p-3"
      style={{ zIndex: win.z }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        drag
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        dragElastic={0.08}
        onPointerDown={() => focus(win.id)}
        style={{ marginLeft: offset, marginTop: offset }}
        className="pointer-events-auto flex max-h-[82vh] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl glass"
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-white/10 px-4 py-2.5 active:cursor-grabbing"
          style={{ background: accent ? `${accent}22` : undefined }}
        >
          <span className="text-sm font-semibold" style={{ color: accent }}>
            {title}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => close(win.id)}
            className="grid h-6 w-6 place-items-center rounded-md text-slate-300 hover:bg-rose-500/40"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </motion.div>
    </div>
  );
}
