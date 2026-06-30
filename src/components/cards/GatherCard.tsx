import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { skillsForBiome, gather, gatherCooldownLeft, gatherProgress, type GatherSkill } from '../../game/gathering';
import { BIOMES } from '../../game/biomes';
import { ITEMS } from '../../game/items';
import { playSound } from '../../game/sound';

export default function GatherCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!p) return null;
  const skills = skillsForBiome(p.biome);

  function doGather(skill: GatherSkill) {
    const left = gatherCooldownLeft(p!, skill.id);
    if (left > 0) {
      toast(`${skill.name} : encore ${Math.ceil(left / 1000)}s.`, 'bad');
      return;
    }
    mutate((d) => {
      const r = gather(d, skill.id);
      if (r.ok && r.itemId) {
        playSound(r.leveledUp ? 'levelup' : 'coin');
        toast(`${skill.emoji} +${r.qty} ${ITEMS[r.itemId].icon} ${ITEMS[r.itemId].name}`, 'good');
        if (r.leveledUp) toast(`⬆️ ${skill.name} niveau ${r.level} !`, 'gold');
      } else {
        toast(r.reason ?? 'Échec.', 'bad');
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Récolte les ressources de {BIOMES[p.biome].emoji} {BIOMES[p.biome].name}. Monte tes
        métiers pour débloquer les ressources rares et augmenter le rendement.
      </p>

      {skills.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune ressource à récolter dans ce biome.</p>
      ) : (
        skills.map((skill) => {
          const left = gatherCooldownLeft(p, skill.id);
          const drops = skill.byBiome[p.biome]!;
          const prog = gatherProgress(p.gatherXp?.[skill.id] ?? 0);
          return (
            <div key={skill.id} className="rounded-xl bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{skill.emoji} {skill.name} <span className="text-xs text-slate-400">Nv.{prog.level}</span></span>
                <button
                  onClick={() => doGather(skill)}
                  disabled={left > 0}
                  className="rounded-lg bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-40"
                >
                  {left > 0 ? `⏳ ${Math.ceil(left / 1000)}s` : 'Récolter'}
                </button>
              </div>

              {/* Barre d'XP de métier */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded bg-black/40">
                  <div className="h-1.5 rounded bg-emerald-400" style={{ width: `${(prog.into / prog.need) * 100}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-slate-500">{prog.into}/{prog.need}</span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                {drops.map((d) => {
                  const locked = d.minLvl != null && prog.level < d.minLvl;
                  return (
                    <span key={d.id} className={`rounded px-1.5 py-0.5 ${locked ? 'bg-black/40 text-slate-600' : 'bg-black/30 text-slate-300'}`}>
                      {locked ? '🔒' : ITEMS[d.id].icon} {ITEMS[d.id].name}{locked ? ` (Nv.${d.minLvl})` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
