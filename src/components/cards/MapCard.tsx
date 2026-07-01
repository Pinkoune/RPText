import { useGame } from '../../store/gameStore';
import { BIOMES } from '../../game/biomes';
import type { BiomeId } from '../../game/types';
import { currentGlobalEvent, currentBiomeEvent } from '../../game/events';

// Position de chaque biome sur la carte (% du conteneur), dans l'ordre de progression.
const POS: Record<BiomeId, { x: number; y: number }> = {
  forest: { x: 20, y: 86 },
  plains: { x: 72, y: 77 },
  mountains: { x: 36, y: 60 },
  desert: { x: 82, y: 45 },
  swamp: { x: 30, y: 30 },
  frozen: { x: 70, y: 13 },
};

const ORDER: BiomeId[] = ['forest', 'plains', 'mountains', 'desert', 'swamp', 'frozen'];

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

  const linePoints = ORDER.map((id) => `${POS[id].x},${POS[id].y}`).join(' ');

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Carte du monde — clique une région pour y voyager.</p>

      <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#0e1630] to-[#0a1020]">
        {/* Chemin reliant les régions */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={linePoints}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.6}
            strokeDasharray="2 2"
          />
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
                } ${locked ? 'opacity-50 grayscale' : 'hover:scale-110'}`}
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${c[2]}, ${c[1]} 60%, ${c[0]})`,
                  borderColor: here ? b.accent : 'rgba(255,255,255,0.25)',
                }}
              >
                {locked ? '🔒' : b.emoji}
              </span>
              <span className="mt-1 max-w-[80px] truncate text-[10px] font-medium" style={{ color: here ? b.accent : '#cbd5e1' }}>
                {b.name.split(' ')[0]}
              </span>
              <span className="text-[9px] text-slate-400">{here ? '• ici' : `Nv.${b.minLevel}`}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-black/25 px-3 py-2 text-xs">
        <span className="text-slate-400">Position : </span>
        <span style={{ color: BIOMES[p.biome].accent }}>{BIOMES[p.biome].emoji} {BIOMES[p.biome].name}</span>
        <div className="mt-0.5 text-[11px] text-slate-400">{BIOMES[p.biome].desc}</div>
      </div>

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
    </div>
  );
}
