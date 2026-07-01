import { useGame } from '../../store/gameStore';
import { xpToNext, CLASSES } from '../../game/classes';
import { farmProgress } from '../../game/gathering';

function Bar({ label, level, into, need, color, sub }: { label: string; level: number; into: number; need: number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label} <span style={{ color }}>Nv.{level}</span></span>
        <span className="text-[10px] tabular-nums text-slate-500">{Math.floor(into)} / {need} XP</span>
      </div>
      <div className="mt-1.5 h-2.5 rounded bg-black/40">
        <div className="h-2.5 rounded" style={{ width: `${Math.min(100, (into / need) * 100)}%`, background: color }} />
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

import { getCraftLevel } from '../../game/crafting';

export default function ExperienceCard() {
  const p = useGame((s) => s.player);
  if (!p) return null;
  const cls = CLASSES[p.classId];
  const farm = farmProgress(p);
  
  // Logic for craft xp
  const cLevel = getCraftLevel(p.craftXp);
  const basePrev = 100 * Math.pow(cLevel - 1, 1.5);
  const baseNext = 100 * Math.pow(cLevel, 1.5);
  
  const cInto = Math.floor(p.craftXp - basePrev);
  const cNeed = Math.floor(baseNext - basePrev);

  return (
    <div className="space-y-3">
      <Bar
        label={`${cls.emoji} Aventure`}
        level={p.level}
        into={p.xp}
        need={xpToNext(p.level)}
        color="#62d67a"
        sub={`${cls.name} · ${p.kills} monstres vaincus`}
      />
      <Bar
        label="🌾 Farm"
        level={farm.level}
        into={farm.into}
        need={farm.need}
        color="#e6d27a"
        sub={`XP de farm total : ${p.farmXp}`}
      />
      <Bar
        label="🔨 Artisanat"
        level={cLevel}
        into={Math.max(0, cInto)}
        need={Math.max(1, cNeed)}
        color="#d8a26a"
        sub={`XP d'artisanat total : ${Math.floor(p.craftXp)}`}
      />
      <p className="text-center text-[11px] text-slate-500">
        L'aventure (combat) et le farm (récolte) montent séparément.
      </p>
    </div>
  );
}
