import { useEffect, useState, useRef } from 'react';
import { useGame } from '../../store/gameStore';
import { skillsForBiome, extractResource, finishGatherSession, gatherCooldownLeft, farmProgress, type GatherSkill, GATHER_SKILLS } from '../../game/gathering';
import { BIOMES } from '../../game/biomes';
import { item } from '../../game/items';
import { playSound } from '../../game/sound';

export default function GatherCard({ initialSkillId }: { initialSkillId?: string }) {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [, tick] = useState(0);

  const [active, setActive] = useState<GatherSkill | null>(null);
  const [integrity, setIntegrity] = useState(0);
  const [gp, setGp] = useState(0);
  const [lootLog, setLootLog] = useState<{ id: string; qty: number; emoji: string }[]>([]);

  const didInit = useRef(false);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const farm = farmProgress(p!);
  const maxGp = 50 + farm.level * 5;

  // startGather logic definition needed before effect
  function startGather(skill: GatherSkill) {
    if (gatherCooldownLeft(p!) > 0) {
      toast(`Récolte en récupération (${Math.ceil(gatherCooldownLeft(p!) / 1000)}s).`, 'bad');
      return;
    }
    setActive(skill);
    setIntegrity(100);
    setGp(maxGp);
    setLootLog([]);
  }

  useEffect(() => {
    if (!didInit.current && initialSkillId) {
      didInit.current = true;
      const skill = GATHER_SKILLS[initialSkillId as keyof typeof GATHER_SKILLS];
      if (skill) {
        // verify it's available in biome
        if (skill.byBiome[p!.biome]) {
          startGather(skill);
        } else {
          toast(`${skill.name} indisponible ici.`, 'bad');
        }
      }
    }
  }, [initialSkillId, p, maxGp, toast]);

  if (!p) return null;
  const skills = skillsForBiome(p.biome);
  const cd = gatherCooldownLeft(p);

  function handleAction(chance: number, costInt: number, costGp: number, mult: number) {
    if (!active) return;
    
    setGp(Math.max(0, gp - costGp));
    const newInt = integrity - costInt;
    
    if (Math.random() < chance) {
      // Succès
      let resId = '';
      let resQty = 0;
      let leveled = false;
      let newLvl = 0;

      mutate((d) => {
        const r = extractResource(d, active.id, mult);
        if (r.ok && r.itemId) {
          resId = r.itemId;
          resQty = r.qty!;
          leveled = r.leveledUp || false;
          newLvl = r.level || 0;
        }
      });

      if (resId) {
        playSound(leveled ? 'levelup' : 'coin');
        setLootLog((prev) => [...prev, { id: resId, qty: resQty, emoji: item(resId)!.icon }]);
        if (leveled) toast(`⬆️ Niveau de farm ${newLvl} !`, 'gold');
      }
    } else {
      // Échec
      toast('Rien n\'a été extrait...', 'info');
    }

    if (newInt <= 0) {
      // Fin de la session
      setIntegrity(0);
      mutate((d) => finishGatherSession(d));
      setTimeout(() => {
        setActive(null);
      }, 1500); // Laisse le temps de voir le résultat
    } else {
      setIntegrity(newInt);
    }
  }

  function actStandard() {
    handleAction(0.60, 30, 0, 1);
  }

  function actCareful() {
    if (gp < 20) return;
    handleAction(0.90, 35, 20, 1);
  }

  function actForce() {
    handleAction(0.35, 40, 0, 2);
  }

  function actObserve() {
    if (gp < 40) return;
    setGp(gp - 40);
    setIntegrity(Math.min(100, integrity + 25));
  }

  if (active) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-300">Récolte en cours...</p>
          <p className="text-lg">{active.emoji} Filon de {active.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/30 p-4 text-sm">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Intégrité</span>
              <span>{Math.max(0, integrity)} / 100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.max(0, integrity)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>GP</span>
              <span>{gp} / {maxGp}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(gp / maxGp) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={actStandard} disabled={integrity <= 0} className="rounded bg-slate-600/80 p-2 text-xs font-bold hover:bg-slate-500 active:scale-95 disabled:opacity-30">
            Standard<br/><span className="text-[10px] font-normal">(-30 Int | 60%)</span>
          </button>
          <button onClick={actCareful} disabled={gp < 20 || integrity <= 0} className="rounded bg-sky-600/80 p-2 text-xs font-bold hover:bg-sky-500 disabled:opacity-30 active:scale-95">
            Minutieux<br/><span className="text-[10px] font-normal">(-35 Int, -20 GP | 90%)</span>
          </button>
          <button onClick={actForce} disabled={integrity <= 0} className="rounded bg-rose-600/80 p-2 text-xs font-bold hover:bg-rose-500 disabled:opacity-30 active:scale-95">
            En Force<br/><span className="text-[10px] font-normal">(-40 Int | 35%, x2)</span>
          </button>
          <button onClick={actObserve} disabled={gp < 40 || integrity <= 0} className="rounded bg-purple-600/80 p-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-30 active:scale-95">
            Observation<br/><span className="text-[10px] font-normal">(-40 GP | +25 Int)</span>
          </button>
        </div>

        {lootLog.length > 0 && (
          <div className="mt-4 rounded-lg bg-black/20 p-2 text-center text-sm">
            <p className="mb-1 text-slate-400 text-xs">Butin extrait :</p>
            <div className="flex flex-wrap justify-center gap-2">
              {lootLog.map((l, i) => (
                <span key={i} className="rounded bg-black/40 px-2 py-1">{l.emoji} +{l.qty}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
        Approche un filon pour commencer à l'exploiter. Attention, le nœud disparaît quand son intégrité atteint zéro ! {BIOMES[p.biome].emoji} {BIOMES[p.biome].name}
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
                  onClick={() => startGather(skill)}
                  disabled={cd > 0}
                  className="rounded-lg bg-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-40"
                >
                  {cd > 0 ? `⏳ ${Math.ceil(cd / 1000)}s` : 'Explorer'}
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
