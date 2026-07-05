import { useGame } from '../../store/gameStore';
import { BIOMES } from '../../game/biomes';
import type { BiomeId } from '../../game/types';
import { currentGlobalEvent, currentBiomeEvent } from '../../game/events';

// Serpentin harmonieux du bas (Forêt niv.1) vers le haut (Abysses niv.38).
const POS: Record<BiomeId, { x: number; y: number }> = {
  forest: { x: 20, y: 92 },
  plains: { x: 60, y: 82 },
  mountains: { x: 84, y: 68 },
  desert: { x: 56, y: 58 },
  swamp: { x: 18, y: 47 },
  volcano: { x: 48, y: 36 },
  crypt: { x: 82, y: 24 },
  frozen: { x: 54, y: 12 },
};

const ORDER: BiomeId[] = ['forest', 'plains', 'mountains', 'desert', 'swamp', 'volcano', 'crypt', 'frozen'];

/** Chemin lissé (spline Catmull-Rom → Bézier) passant par CHAQUE région. */
function smoothPath(ids: BiomeId[]): string {
  const pts = ids.map((id) => POS[id]);
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function MapCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function travel(id: BiomeId) {
    const b = BIOMES[id];
    if (p!.level < b.minLevel) {
      toast(`Niveau ${b.minLevel} requis pour ${b.name}.`, 'bad');
      return;
    }
    if (p!.biome === id) return;
    mutate((d) => {
      d.biome = id;
      if (!d.unlockedBiomes.includes(id)) d.unlockedBiomes.push(id);
    });
    toast(`Tu voyages vers ${b.name}.`, 'good');
  }

  // Progression : segments parcourables (les deux extrémités débloquées par le niveau).
  const reachedIdx = ORDER.reduce((max, id, i) => (p.level >= BIOMES[id].minLevel ? i : max), 0);
  const fullPath = smoothPath(ORDER);
  const donePath = smoothPath(ORDER.slice(0, reachedIdx + 1));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Carte du monde — clique une région pour y voyager.</p>

      <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(120%_90%_at_70%_0%,#1a2350_0%,#0e1630_45%,#080d1c_100%)]">
        {/* Étoiles décoratives */}
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(1px 1px at 20% 18%, #fff, transparent), radial-gradient(1px 1px at 68% 10%, #fff, transparent), radial-gradient(1px 1px at 40% 35%, #cbd5e1, transparent), radial-gradient(1px 1px at 85% 40%, #fff, transparent), radial-gradient(1px 1px at 12% 60%, #cbd5e1, transparent)' }} />

        {/* Chemins */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={fullPath} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={0.9} strokeDasharray="2.5 2.5" strokeLinecap="round" />
          <path d={donePath} fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth={1.1} strokeLinecap="round" />
        </svg>

        {/* Régions */}
        {ORDER.map((id) => {
          const b = BIOMES[id];
          const locked = p.level < b.minLevel;
          const here = p.biome === id;
          const c = b.bg.day;
          return (
            <button
              key={id}
              onClick={() => travel(id)}
              title={`${b.name} — Nv.${b.minLevel}+`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none"
              style={{ left: `${POS[id].x}%`, top: `${POS[id].y}%` }}
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-full border-2 text-xl transition sm:h-14 sm:w-14 sm:text-2xl ${
                  here ? 'animate-pulseGlow' : ''
                } ${locked ? 'opacity-45 grayscale' : 'hover:scale-110'}`}
                style={{
                  background: `radial-gradient(circle at 35% 28%, ${c[2]}, ${c[1]} 58%, ${c[0]})`,
                  borderColor: here ? b.accent : 'rgba(255,255,255,0.22)',
                  boxShadow: here ? `0 0 16px ${b.accent}` : '0 4px 10px rgba(0,0,0,0.45)',
                }}
              >
                {locked ? '🔒' : b.emoji}
              </span>
              <span className="mt-1 max-w-[86px] truncate text-[10px] font-semibold drop-shadow" style={{ color: here ? b.accent : '#e2e8f0' }}>
                {b.name.split(' ')[0]}
              </span>
              <span className={`text-[9px] ${here ? 'text-emerald-300' : locked ? 'text-rose-300/70' : 'text-slate-400'}`}>{here ? '• vous êtes ici' : `Nv.${b.minLevel}`}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-black/25 px-3 py-2 text-xs">
        <span className="text-slate-400">Position : </span>
        <span style={{ color: BIOMES[p.biome].accent }}>{BIOMES[p.biome].emoji} {BIOMES[p.biome].name}</span>
        <div className="mt-0.5 text-[11px] text-slate-400">{BIOMES[p.biome].desc}</div>
      </div>

      {p.level >= 3 && (
      <div className="rounded-lg bg-black/25 px-3 py-2 text-xs space-y-2">
        <div className="font-semibold text-sky-300">Événements en cours</div>

        {(() => {
          const global = currentGlobalEvent();
          const regional = currentBiomeEvent(p.biome);
          return (
            <>
              <div className="flex gap-2 items-start">
                <span className="text-lg leading-none">{global.icon}</span>
                <div>
                  <span className="font-bold text-slate-200">Monde : {global.name}</span>
                  <div className={`text-[11px] ${global.kind === 'buff' ? 'text-emerald-400' : global.kind === 'debuff' ? 'text-rose-400' : 'text-slate-400'}`}>{global.desc}</div>
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-lg leading-none">{regional.icon}</span>
                <div>
                  <span className="font-bold text-slate-200" style={{ color: BIOMES[p.biome].accent }}>Région ({BIOMES[p.biome].name}) : {regional.name}</span>
                  <div className={`text-[11px] ${regional.kind === 'buff' ? 'text-emerald-400' : regional.kind === 'debuff' ? 'text-rose-400' : 'text-slate-400'}`}>{regional.desc}</div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
      )}
    </div>
  );
}
