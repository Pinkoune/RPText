import { useMemo } from 'react';
import type { BiomeId, Phase } from '../game/types';
import { BIOMES } from '../game/biomes';
import { useFx } from '../store/fxStore';

interface Props {
  biome: BiomeId;
  phase: Phase;
}

type Anim = 'fall' | 'riseUp' | 'drift' | 'twinkle';

interface PFX {
  anim: Anim;
  count: number;
  color: string;
  min: number; // taille min px
  max: number; // taille max px
  durMin: number;
  durMax: number;
}

/** Configuration des particules selon biome + phase. */
function particleFx(biome: BiomeId, phase: Phase): PFX | null {
  const night = phase === 'night';
  switch (biome) {
    case 'forest':
      return night
        ? { anim: 'twinkle', count: 26, color: '#cdff7a', min: 2, max: 4, durMin: 2, durMax: 5 } // lucioles
        : { anim: 'riseUp', count: 18, color: '#dff0b0', min: 2, max: 4, durMin: 9, durMax: 16 }; // pollen
    case 'plains':
      return { anim: 'drift', count: 16, color: '#f0e6a0', min: 2, max: 5, durMin: 8, durMax: 15 }; // graines
    case 'mountains':
      return { anim: 'fall', count: 40, color: '#ffffff', min: 2, max: 5, durMin: 5, durMax: 11 }; // neige
    case 'frozen':
      return null; // Abysses du Vide : le trou noir absorbe la lumière, pas d'étoiles au premier plan
    case 'desert':
      return night
        ? { anim: 'riseUp', count: 20, color: '#ff9a4a', min: 2, max: 4, durMin: 6, durMax: 12 } // braises
        : { anim: 'drift', count: 22, color: '#e8c98a', min: 1, max: 3, durMin: 5, durMax: 10 }; // sable
    case 'swamp':
      return { anim: 'riseUp', count: 18, color: '#9fd0a0', min: 3, max: 7, durMin: 7, durMax: 14 }; // bulles
    case 'volcano':
      return { anim: 'riseUp', count: 34, color: '#ff5a1a', min: 2, max: 5, durMin: 4, durMax: 9 }; // cendres et braises
    case 'crypt':
      return { anim: 'twinkle', count: 24, color: '#7dd3c8', min: 2, max: 4, durMin: 3, durMax: 7 }; // feux follets
    default:
      return null;
  }
}

function Particles({ biome, phase }: Props) {
  const reduced = useFx((s) => s.reduced);
  const fx = particleFx(biome, phase);
  // Mode réduit : ~40% des particules (arrondi), sinon le plein. Ces particules
  // animées en boucle sont un gros contributeur à la charge GPU permanente.
  const count = fx ? (reduced ? Math.ceil(fx.count * 0.4) : fx.count) : 0;
  const items = useMemo(() => {
    if (!fx || count === 0) return [];
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: fx.min + Math.random() * (fx.max - fx.min),
      dur: fx.durMin + Math.random() * (fx.durMax - fx.durMin),
      delay: -Math.random() * fx.durMax,
      drift: (Math.random() * 2 - 1) * 8,
    }));
  }, [fx?.anim, count, biome, phase]);

  if (!fx || count === 0) return null;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {items.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${p.left}%`,
            top: fx.anim === 'twinkle' ? `${p.top}%` : undefined,
            width: p.size,
            height: p.size,
            background: fx.color,
            boxShadow: fx.anim === 'twinkle' || fx.color.startsWith('#ff') ? `0 0 6px ${fx.color}` : undefined,
            animation: `${fx.anim} ${p.dur}s linear ${p.delay}s infinite`,
            // @ts-expect-error variables CSS custom
            '--drift': `${p.drift}vw`,
            '--rise': `${-Math.abs(p.drift)}vh`,
          }}
        />
      ))}
    </div>
  );
}

/** Silhouettes du décor au sol, selon le biome. Teintées par la phase. */
function Silhouettes({ biome, phase }: Props) {
  const b = BIOMES[biome];
  const near = b.fg ? b.fg[phase][0] : b.bg[phase][0]; // couleur la plus sombre du dégradé (premier plan)
  const far = b.fg ? b.fg[phase][1] : b.bg[phase][1]; // second plan
  const night = phase === 'night';
  const snow = night ? 'rgba(220,235,255,0.5)' : 'rgba(255,255,255,0.9)';

  const common = {
    className: 'absolute inset-x-0 bottom-0 h-[48vh] w-full',
    preserveAspectRatio: 'none' as const,
    viewBox: '0 0 1440 400',
  };

  // Les attributs SVG ne s'animent pas ; on passe par style.fill pour un fondu CSS.
  const T = 'fill 1.6s ease, stroke 1.6s ease';
  const sFar = { fill: far, transition: T };
  const sNear = { fill: near, transition: T };
  const sSnow = { fill: snow, transition: T };

  let shapes: JSX.Element;
  switch (biome) {
    case 'mountains':
      shapes = (
        <>
          <path style={sFar} d="M0 400 L0 230 L220 90 L420 240 L640 110 L860 250 L1080 120 L1300 250 L1440 180 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 300 L260 160 L520 320 L760 180 L1020 330 L1280 200 L1440 320 L1440 400 Z" />
          {/* neige sur les sommets */}
          <path style={sSnow} d="M260 160 L300 200 L220 200 Z M760 180 L800 222 L720 222 Z M1280 200 L1318 240 L1242 240 Z" />
          <path style={sSnow} opacity={0.7} d="M220 90 L250 130 L190 130 Z M640 110 L672 152 L608 152 Z M1080 120 L1112 162 L1048 162 Z" />
        </>
      );
      break;
    case 'volcano': {
      const lava = night ? '#ff5a1a' : '#ff7a2a';
      const glow = { fill: lava, filter: 'blur(2px)', transition: T };
      shapes = (
        <>
          {/* Sol de roche volcanique */}
          <path style={sFar} d="M0 400 L0 300 Q360 260 720 300 T1440 290 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 350 Q360 320 720 350 T1440 340 L1440 400 Z" />
          {/* Cônes volcaniques (loin) avec cratère lumineux */}
          <path style={sFar} d="M180 300 L260 130 L340 300 Z" />
          <circle cx={260} cy={132} r={7} style={glow} opacity={0.8} />
          <path style={sFar} d="M980 300 L1050 160 L1120 300 Z" />
          <circle cx={1050} cy={162} r={6} style={glow} opacity={0.7} />
          {/* Volcan principal (premier plan) */}
          <path style={sNear} d="M560 350 L700 90 L840 350 Z" />
          <circle cx={700} cy={94} r={12} style={glow} />
          <circle cx={700} cy={94} r={22} style={glow} opacity={0.35} />
          {/* Fissures de lave incandescentes descendant les pentes */}
          <g style={{ stroke: lava, transition: T }} strokeWidth={3} fill="none" opacity={0.85}>
            <path d="M700 110 L660 220 L680 350" />
            <path d="M700 110 L745 240 L720 350" />
            <path d="M260 145 L245 280" />
          </g>
          {/* Coulée de lave au sol */}
          <path style={{ fill: lava, transition: T }} opacity={0.5} d="M620 350 Q700 330 780 350 L800 400 L600 400 Z" />
        </>
      );
      break;
    }
    case 'crypt': {
      const glow = { fill: '#7dd3c8', filter: 'blur(2px)', transition: T };
      shapes = (
        <>
          {/* Sol de pierre effondrée */}
          <path style={sFar} d="M0 400 L0 310 Q360 280 720 310 T1440 300 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 350 Q360 330 720 350 T1440 340 L1440 400 Z" />
          {/* Pierres tombales et croix brisées */}
          <g style={sNear}>
            <path d="M160 350 L160 260 Q160 240 180 240 Q200 240 200 260 L200 350 Z" />
            <path d="M1220 350 L1220 270 Q1220 250 1245 250 Q1270 250 1270 270 L1270 350 Z" />
            <rect x={640} y={310} width={16} height={40} />
            <rect x={624} y={324} width={48} height={12} />
          </g>
          {/* Cristaux noirs luminescents émergeant du sol */}
          <path style={sFar} d="M320 350 L345 220 L370 350 Z" />
          <circle cx={345} cy={224} r={6} style={glow} opacity={0.75} />
          <path style={sNear} d="M980 360 L1015 200 L1050 360 Z" />
          <circle cx={1015} cy={204} r={9} style={glow} />
          <path style={sFar} d="M760 340 L780 260 L800 340 Z" />
          <circle cx={780} cy={264} r={5} style={glow} opacity={0.6} />
        </>
      );
      break;
    }
    case 'frozen':
      shapes = (
        <>
          {/* Horizon distordu */}
          <path style={sFar} d="M0 400 L0 340 Q360 280 720 340 T1440 320 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 360 Q400 390 800 350 T1440 370 L1440 400 Z" />
          {/* Obélisques géants ou cristaux du néant */}
          <path style={sFar} d="M300 350 L340 150 L380 350 Z" />
          <path style={sNear} d="M1100 380 L1150 180 L1200 380 Z" />
          <path style={sFar} d="M700 330 L730 200 L760 330 Z" />
          {/* Roches flottantes */}
          <path style={sNear} d="M150 150 L180 120 L220 140 L190 180 Z" />
          <path style={sFar} d="M900 120 L940 90 L980 130 L930 160 Z" />
        </>
      );
      break;
    case 'desert':
      shapes = (
        <>
          <path style={sFar} d="M0 400 L0 300 Q360 250 720 300 T1440 300 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 340 Q300 300 600 340 T1200 340 T1440 350 L1440 400 Z" />
          {/* pyramides */}
          <path style={sNear} d="M980 340 L1080 200 L1180 340 Z" />
          <path style={sFar} d="M1120 340 L1190 240 L1260 340 Z" />
        </>
      );
      break;
    case 'swamp':
      shapes = (
        <>
          <path style={sFar} d="M0 400 L0 320 Q360 300 720 320 T1440 320 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 350 Q360 335 720 350 T1440 350 L1440 400 Z" />
          {/* arbres morts */}
          <g style={{ stroke: near, transition: T }} strokeWidth={6} fill="none">
            <path d="M180 350 L180 200 M180 250 L140 220 M180 240 L225 205 M180 215 L150 185" />
            <path d="M1080 350 L1080 190 M1080 240 L1040 210 M1080 250 L1130 215 M1080 210 L1055 175" />
          </g>
        </>
      );
      break;
    case 'plains':
      shapes = (
        <>
          <path style={sFar} d="M0 400 L0 320 Q360 270 720 310 T1440 300 L1440 400 Z" />
          <path style={sNear} d="M0 400 L0 350 Q400 320 800 345 T1440 345 L1440 400 Z" />
        </>
      );
      break;
    case 'forest':
    default:
      shapes = (
        <>
          <path style={sFar} d="M0 400 L0 320 Q300 280 600 310 T1200 305 T1440 310 L1440 400 Z" />
          {/* rangée de pins */}
          <g style={sNear}>
            {Array.from({ length: 13 }, (_, i) => {
              const x = i * 120 + 20;
              const h = 150 + ((i * 53) % 70);
              return <path key={i} d={`M${x} 400 L${x - 46} 400 L${x} ${400 - h} L${x + 46} 400 Z`} />;
            })}
          </g>
          <rect x={0} y={360} width={1440} height={40} style={sNear} />
        </>
      );
  }

  return (
    <svg {...common} aria-hidden>
      {shapes}
    </svg>
  );
}

/** Décor d'arrière-plan : silhouettes + particules d'ambiance. */
export default function Scenery({ biome, phase }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Silhouettes biome={biome} phase={phase} />
      <Particles biome={biome} phase={phase} />
    </div>
  );
}
