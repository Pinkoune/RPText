import { useMemo } from 'react';
import type { BiomeId, Phase } from '../game/types';
import { BIOMES } from '../game/biomes';
import Scenery from './Scenery';

interface Props {
  biome: BiomeId;
  phase: Phase;
}

/** Fond d'écran animé : dégradé du biome modulé par la phase jour/nuit. */
export default function Background({ biome, phase }: Props) {
  const [c1, c2, c3] = BIOMES[biome].bg[phase];
  const night = phase === 'night';
  const dusk = phase === 'dusk';

  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 60,
        s: Math.random() * 2 + 1,
        d: Math.random() * 3,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden transition-colors duration-[2000ms]">
      <div
        className="absolute inset-0 transition-all duration-[2000ms]"
        style={{ background: `linear-gradient(180deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)` }}
      />

      {/* Astre : soleil le jour, lune la nuit */}
      <div
        className="absolute rounded-full transition-all duration-[2000ms]"
        style={{
          width: 120,
          height: 120,
          left: phase === 'dawn' ? '12%' : phase === 'day' ? '70%' : dusk ? '78%' : '20%',
          top: phase === 'day' ? '12%' : dusk || phase === 'dawn' ? '34%' : '16%',
          background: night
            ? 'radial-gradient(circle at 38% 38%, #f4f6ff, #c6cee0 60%, transparent 72%)'
            : dusk
            ? 'radial-gradient(circle, #ffd28a, #ff9a5a 60%, transparent 72%)'
            : 'radial-gradient(circle, #fff7d6, #ffe08a 55%, transparent 72%)',
          boxShadow: night ? '0 0 60px 10px rgba(200,210,255,0.25)' : '0 0 90px 30px rgba(255,220,140,0.35)',
          filter: 'blur(0.5px)',
        }}
      />

      {/* Étoiles la nuit */}
      {night &&
        stars.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${st.x}%`,
              top: `${st.y}%`,
              width: st.s,
              height: st.s,
              opacity: 0.7,
              animation: `pulseGlow ${2 + st.d}s ease-in-out ${st.d}s infinite`,
            }}
          />
        ))}

      {/* Décor du biome : silhouettes + particules */}
      <Scenery biome={biome} phase={phase} />

      {/* Voile sombre pour la lisibilité du texte */}
      <div
        className="absolute inset-0 transition-opacity duration-[2000ms]"
        style={{ background: 'radial-gradient(120% 120% at 50% 40%, transparent 30%, rgba(5,8,18,0.6) 100%)' }}
      />
    </div>
  );
}
