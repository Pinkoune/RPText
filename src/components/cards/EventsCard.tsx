import { useGame } from '../../store/gameStore';
import { useClock } from '../../hooks/useClock';
import { BIOMES } from '../../game/biomes';
import { currentGlobalEvent, currentBiomeEvent, nextRotationAt, type EventDef } from '../../game/events';

const KIND_STYLE: Record<EventDef['kind'], { color: string; label: string }> = {
  buff: { color: '#4ade80', label: 'Bonus' },
  debuff: { color: '#fb7185', label: 'Malus' },
  neutral: { color: '#94a3b8', label: 'Calme' },
  invasion: { color: '#c084fc', label: 'Invasion' },
};

function effectLine(e: EventDef): string {
  const parts: string[] = [];
  const f = e.effect;
  if (f.atkPct) parts.push(`${f.atkPct > 0 ? '+' : ''}${Math.round(f.atkPct * 100)}% ATK`);
  if (f.defPct) parts.push(`${f.defPct > 0 ? '+' : ''}${Math.round(f.defPct * 100)}% DEF`);
  if (f.hpPct) parts.push(`${f.hpPct > 0 ? '+' : ''}${Math.round(f.hpPct * 100)}% PV`);
  if (f.xpMult) parts.push(`${f.xpMult > 0 ? '+' : ''}${Math.round(f.xpMult * 100)}% XP`);
  if (f.goldMult) parts.push(`${f.goldMult > 0 ? '+' : ''}${Math.round(f.goldMult * 100)}% or`);
  return parts.join(' · ') || 'Aucun effet';
}

function EventBlock({ scope, e }: { scope: string; e: EventDef }) {
  const st = KIND_STYLE[e.kind];
  return (
    <div className="rounded-xl bg-black/25 p-3" style={{ boxShadow: `inset 3px 0 0 ${st.color}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{scope}</span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl leading-none">{e.icon}</span>
        <div>
          <div className="font-medium" style={{ color: st.color }}>{e.name}</div>
          <div className="text-[11px] text-slate-400">{e.desc}</div>
        </div>
      </div>
      <div className="mt-2 text-xs font-semibold text-amber-200">{effectLine(e)}</div>
    </div>
  );
}

export default function EventsCard() {
  const p = useGame((s) => s.player);
  const { now } = useClock();
  if (!p) return null;

  const ms = now.getTime();
  const global = currentGlobalEvent(ms);
  const regional = currentBiomeEvent(p.biome, ms);
  const biomeName = BIOMES[p.biome].name;

  const remain = Math.max(0, nextRotationAt(ms) - ms);
  const h = Math.floor(remain / 3_600_000);
  const m = Math.floor((remain % 3_600_000) / 60_000);

  return (
    <div className="space-y-3">
      <EventBlock scope="Monde entier" e={global} />
      <EventBlock scope={`Région : ${biomeName}`} e={regional} />
      <div className="text-center text-[11px] text-slate-500">
        Prochaine rotation dans <span className="tabular-nums text-slate-300">{h}h {m}min</span>
      </div>
    </div>
  );
}
