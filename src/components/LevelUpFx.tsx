import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';

const COLORS = ['#ffd45a', '#7bd88f', '#5aa6ff', '#c46bff', '#ff7bd0', '#ff8a5a'];

/** Gerbe de confettis + bannière "NIVEAU SUPÉRIEUR" à chaque montée de niveau. */
export default function LevelUpFx() {
  const celebration = useGame((s) => s.levelCelebration);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (celebration === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 2400);
    return () => clearTimeout(t);
  }, [celebration]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 70 }, () => ({
        left: 50 + (Math.random() * 2 - 1) * 12,
        top: 42 + (Math.random() * 2 - 1) * 8,
        dx: (Math.random() * 2 - 1) * 60,
        dy: 30 + Math.random() * 50,
        rot: (Math.random() * 2 - 1) * 720,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        dur: 1.4 + Math.random() * 1,
        delay: Math.random() * 0.2,
      })),
    [celebration],
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-center"
        style={{ animation: 'lvlPop 2.4s ease-out forwards' }}
      >
        <div className="text-5xl">⬆️</div>
        <div className="mt-1 text-2xl font-extrabold tracking-wider text-amber-300 text-glow">
          NIVEAU SUPÉRIEUR&nbsp;!
        </div>
      </div>
      {confetti.map((c, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: c.size,
            height: c.size * 0.5,
            background: c.color,
            borderRadius: 2,
            animation: `confetti ${c.dur}s ease-in ${c.delay}s forwards`,
            // @ts-expect-error variables CSS custom
            '--dx': `${c.dx}vw`,
            '--dy': `${c.dy}vh`,
            '--rot': `${c.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}
