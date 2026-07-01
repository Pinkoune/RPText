import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { skillsForBiome, gather, gatherCooldownLeft, farmProgress, type GatherSkill } from '../../game/gathering';
import { BIOMES } from '../../game/biomes';
import { item } from '../../game/items';
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
  const farm = farmProgress(p);
  const cd = gatherCooldownLeft(p);

  function doGather(skill: GatherSkill) {
    if (gatherCooldownLeft(p!) > 0) {
      toast(`Récolte en récupération (${Math.ceil(gatherCooldownLeft(p!) / 1000)}s).`, 'bad');
      return;
    }
    mutate((d) => {
      const r = gather(d, skill.id);
      if (r.ok && r.itemId) {
        playSound(r.leveledUp ? 'levelup' : 'coin');
        toast(`${skill.emoji} +${r.qty} ${item(r.itemId)!.icon} ${item(r.itemId)!.name} (+${r.xpGain} XP farm)`, 'good');
        if (r.leveledUp) toast(`⬆️ Niveau de farm ${r.level} !`, 'gold');
      } else {
        toast(r.reason ?? 'Échec.', 'bad');
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Niveau de farm global */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">🌾 Niveau de farm <span className="text-emerald-300">{farm.level}</span></span>
          <span className="text-[10px] tabular-nums text-slate-500">{farm.into}/{farm.need} XP</span>
        </div>
        <div className="mt-1.5 h-2 rounded bg-black/40">
          <div className="h-2 rounded bg-emerald-400" style={{ width: `${(farm.into / farm.need) * 100}%` }} />
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Une seule récolte à la fois (cooldown partagé). {BIOMES[p.biome].emoji} {BIOMES[p.biome].name} —
        monte ton niveau de farm pour les ressources rares et un meilleur rendement.
      </p>

      {skills.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune ressource à récolter dans ce biome.</p>
      ) : (
        skills.map((skill) => {
          const drops = skill.byBiome[p.biome]!;
          return (
            <div key={skill.id} className="rounded-xl bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{skill.emoji} {skill.name}</span>
                <button
                  onClick={() => doGather(skill)}
                  disabled={cd > 0}
                  className="rounded-lg bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-40"
                >
                  {cd > 0 ? `⏳ ${Math.ceil(cd / 1000)}s` : 'Récolter'}
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                {drops.map((d) => {
                  const locked = d.minLvl != null && farm.level < d.minLvl;
                  return (
                    <span key={d.id} className={`rounded px-1.5 py-0.5 ${locked ? 'bg-black/40 text-slate-600' : 'bg-black/30 text-slate-300'}`}>
                      {locked ? '🔒' : item(d.id)!.icon} {item(d.id)!.name}{locked ? ` (farm ${d.minLvl})` : ''}
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
