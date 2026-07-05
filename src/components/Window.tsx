import { useEffect } from 'react';
import { motion, useDragControls, useMotionValue, animate } from 'framer-motion';
import { useUi, type GameWindow } from '../store/uiStore';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  win: GameWindow;
  index: number;
  title: string;
  accent?: string;
  /** Fenêtre plus large (ex: changelog complet). */
  wide?: boolean;
  /** Fenêtre intermédiaire (ex: classement). */
  medium?: boolean;
  short?: boolean;
  children: React.ReactNode;
}

const SNAP_THRESHOLD = 20;

/** Chrome d'une fenêtre flottante : drag par l'en-tête, focus, fermeture, TTL, snap, réduction. */
export default function Window({ win, index, title, accent, wide, medium, short, children }: Props) {
  const close = useUi((s) => s.close);
  const focus = useUi((s) => s.focus);
  const savePref = useUi((s) => s.savePref);
  const pref = useUi((s) => s.prefs[win.kind]);
  const controls = useDragControls();
  const isMobile = useIsMobile();

  // Cascade : léger décalage par fenêtre si pas de position sauvegardée.
  const offset = index * 22;

  // On initialise les motion values avec les préférences ou la cascade par défaut.
  const x = useMotionValue(pref?.x ?? offset);
  const y = useMotionValue(pref?.y ?? offset);
  const minimized = pref?.minimized ?? false;

  useEffect(() => {
    if (win.ttl && win.ttl > 0) {
      const t = setTimeout(() => close(win.id), win.ttl);
      return () => clearTimeout(t);
    }
  }, [win.id, win.ttl, close]);

  // Si on reset, les préférences disparaissent, on veut donc remettre au centre (offset)
  useEffect(() => {
    if (!pref) {
      animate(x, offset, { type: 'spring', stiffness: 300, damping: 30 });
      animate(y, offset, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [pref, offset, x, y]);

  function handleMinimize(e: React.PointerEvent) {
    e.stopPropagation();
    savePref(win.kind, { minimized: !minimized });
  }

  function handleDragEnd() {
    // Current window rect
    const el = document.getElementById(win.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    
    // Find all other windows
    const others = Array.from(document.querySelectorAll('.window-card')).filter(e => e.id !== win.id);
    
    let bestDx = 0;
    let bestDy = 0;
    let minDiffX = Infinity;
    let minDiffY = Infinity;

    // Check snapping against all other windows
    for (const other of others) {
      const oRect = other.getBoundingClientRect();
      
      // We can snap Left-to-Right, Right-to-Left, Left-to-Left, Right-to-Right, etc.
      const xSnaps = [
        oRect.left - rect.right, // Snap Right edge to Left edge
        oRect.right - rect.left, // Snap Left edge to Right edge
        oRect.left - rect.left,  // Align Left edges
        oRect.right - rect.right // Align Right edges
      ];
      
      const ySnaps = [
        oRect.top - rect.bottom, // Snap Bottom edge to Top edge
        oRect.bottom - rect.top, // Snap Top edge to Bottom edge
        oRect.top - rect.top,    // Align Top edges
        oRect.bottom - rect.bottom // Align Bottom edges
      ];

      for (const dx of xSnaps) {
        if (Math.abs(dx) < Math.abs(minDiffX) && Math.abs(dx) < SNAP_THRESHOLD) minDiffX = dx;
      }
      for (const dy of ySnaps) {
        if (Math.abs(dy) < Math.abs(minDiffY) && Math.abs(dy) < SNAP_THRESHOLD) minDiffY = dy;
      }
    }

    // Apply snap if found
    let finalX = x.get();
    let finalY = y.get();

    if (Math.abs(minDiffX) < SNAP_THRESHOLD) {
      finalX += minDiffX;
      animate(x, finalX, { type: 'spring', stiffness: 400, damping: 30 });
    }
    if (Math.abs(minDiffY) < SNAP_THRESHOLD) {
      finalY += minDiffY;
      animate(y, finalY, { type: 'spring', stiffness: 400, damping: 30 });
    }

    // Save final position
    savePref(win.kind, { x: finalX, y: finalY });
  }

  // ── Mobile : plein écran, sans drag ni cascade. La fenêtre au z le plus
  // élevé s'affiche par-dessus ; le dock bas sert à naviguer entre elles.
  if (isMobile) {
    return (
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: win.z }}>
        {/* Démarre sous la Topbar (gap déterministe, pas de chevauchement) et
            au-dessus du dock (le contenu réserve pb pour le dock). */}
        <motion.div
          id={win.id}
          className="window-card glass pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl"
          style={{ top: 'calc(var(--topbar-h, 76px) + 0.5rem)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onPointerDown={() => focus(win.id)}
        >
          <div
            className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3"
            style={{ background: accent ? `${accent}22` : undefined }}
          >
            <span className="text-base font-semibold" style={{ color: accent }}>{title}</span>
            <button
              onClick={() => close(win.id)}
              className="grid h-11 w-11 place-items-center rounded-lg text-lg text-slate-200 hover:bg-rose-500/40 active:bg-rose-500/50"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 pb-28">{children}</div>
        </motion.div>
      </div>
    );
  }

  return (
    // Conteneur : flex items-start permet que la fenêtre réduise sa taille
    // vers le haut (la barre reste fixe) plutôt que vers le centre.
    <div
      className="pointer-events-none fixed inset-0 flex justify-center items-start pt-[8vh] p-3"
      style={{ zIndex: win.z }}
    >
      <motion.div
        id={win.id}
        className={`window-card pointer-events-auto flex flex-col overflow-hidden rounded-2xl glass ${wide ? 'w-[min(94vw,680px)]' : medium ? 'w-[min(94vw,540px)]' : 'w-[min(94vw,440px)]'} ${minimized ? 'h-fit' : short ? 'max-h-[70vh]' : 'max-h-[82vh]'}`}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={{ x, y }}
        drag
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        dragElastic={0}
        onDragEnd={handleDragEnd}
        onPointerDown={() => focus(win.id)}
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-white/10 px-4 py-2.5 active:cursor-grabbing"
          style={{ background: accent ? `${accent}22` : undefined }}
        >
          <span className="text-sm font-semibold" style={{ color: accent }}>
            {title}
          </span>
          <div className="flex gap-2">
            <button
              onPointerDown={handleMinimize}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-300 hover:bg-white/10"
            >
              {minimized ? '＋' : '─'}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => close(win.id)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-300 hover:bg-rose-500/40"
            >
              ✕
            </button>
          </div>
        </div>
        <div className={`overflow-auto p-4 ${minimized ? 'hidden' : ''}`}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
