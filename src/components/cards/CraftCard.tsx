import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { RECIPES, canCraft, consumeMaterials, finishCraft, getCraftLevel, type Recipe } from '../../game/crafting';
import { item, RARITY_COLOR } from '../../game/items';

export default function CraftCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [active, setActive] = useState<Recipe | null>(null);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(0);
  const [durability, setDurability] = useState(0);
  const [cp, setCp] = useState(0);

  if (!p) return null;

  const craftLvl = getCraftLevel(p.craftXp);
  const maxCp = 50 + craftLvl * 10;
  const progGain = Math.floor(10 + craftLvl * 1.5);
  const qualGain = Math.floor(15 + craftLvl * 2);

  function startCraft(r: Recipe) {
    if (!canCraft(p!, r)) {
      toast('Matériaux ou or insuffisants.', 'bad');
      return;
    }
    let success = false;
    mutate((d) => {
      success = consumeMaterials(d, r);
    });
    if (success) {
      setActive(r);
      setProgress(0);
      setQuality(0);
      setDurability(r.durability);
      setCp(maxCp);
    }
  }

  function handleResult(r: Recipe, newProg: number, newDur: number, newQual: number) {
    if (newProg >= r.difficulty) {
      // Succès
      const ratio = Math.min(1, newQual / r.maxQuality);
      let outId = '';
      mutate((d) => {
        outId = finishCraft(d, r, ratio, true);
      });
      toast(`Succès ! Tu as fabriqué : ${item(outId)!.name} ${ratio > 0 ? `(Qualité ${Math.round(ratio * 100)}%)` : ''}`, 'good');
      setActive(null);
    } else if (newDur <= 0) {
      // Échec
      mutate((d) => {
        finishCraft(d, r, 0, false);
      });
      toast(`Le craft a échoué... Les matériaux sont perdus.`, 'bad');
      setActive(null);
    }
  }

  function actSynthesis() {
    if (!active) return;
    const newProg = progress + progGain;
    const newDur = durability - 10;
    setProgress(newProg);
    setDurability(newDur);
    handleResult(active, newProg, newDur, quality);
  }

  function actTouch() {
    if (!active || cp < 15) return;
    const newQual = quality + qualGain;
    const newDur = durability - 10;
    setQuality(newQual);
    setDurability(newDur);
    setCp(cp - 15);
    handleResult(active, progress, newDur, newQual);
  }

  function actRepair() {
    if (!active || cp < 30) return;
    setDurability(durability + 30);
    setCp(cp - 30);
  }

  if (active) {
    const out = item(active.output)!;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm font-bold text-sky-300">Artisanat en cours...</p>
          <p className="text-lg" style={{ color: RARITY_COLOR[out.rarity] }}>{out.icon} {out.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/30 p-4 text-sm">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Avancement</span>
              <span>{Math.min(progress, active.difficulty)} / {active.difficulty}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (progress / active.difficulty) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Qualité</span>
              <span>{Math.min(quality, active.maxQuality)} / {active.maxQuality}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min(100, (quality / active.maxQuality) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Solidité</span>
              <span>{Math.max(0, durability)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, durability))}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>CP</span>
              <span>{cp} / {maxCp}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${(cp / maxCp) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={actSynthesis} className="rounded bg-sky-600/80 p-2 text-xs font-bold hover:bg-sky-500 active:scale-95">
            Synthèse<br/><span className="text-[10px] font-normal">(-10 Sol)</span>
          </button>
          <button onClick={actTouch} disabled={cp < 15} className="rounded bg-purple-600/80 p-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-30 active:scale-95">
            Minutieux<br/><span className="text-[10px] font-normal">(-10 Sol, -15 CP)</span>
          </button>
          <button onClick={actRepair} disabled={cp < 30} className="rounded bg-emerald-600/80 p-2 text-xs font-bold hover:bg-emerald-500 disabled:opacity-30 active:scale-95">
            Réparation<br/><span className="text-[10px] font-normal">(+30 Sol, -30 CP)</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 flex items-center justify-between">
        <span>Niveau d'artisanat : <b>{craftLvl}</b> ({Math.floor(p.craftXp)} XP)</span>
        <span>Or : <b>{p.gold} 🪙</b></span>
      </p>
      <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
        {RECIPES.map((r) => {
          const out = item(r.output)!;
          const ok = canCraft(p, r);
          const levelOk = craftLvl >= r.levelReq;
          return (
            <div key={r.output} className={`rounded-lg p-2.5 ${levelOk ? 'bg-black/25' : 'bg-black/40 opacity-75'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium" style={{ color: RARITY_COLOR[out.rarity] }}>
                  {out.icon} {out.name} {r.qty > 1 ? `x${r.qty}` : ''}
                </span>
                <button
                  onClick={() => startCraft(r)}
                  disabled={!ok || !levelOk}
                  className="shrink-0 rounded bg-sky-500/30 px-3 py-1 text-xs font-semibold hover:bg-sky-500/50 disabled:opacity-40"
                >
                  {levelOk ? 'Forger' : `Niv. ${r.levelReq}`}
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                {Object.entries(r.materials).map(([id, need]) => {
                  const have = p.inventory[id] ?? 0;
                  return (
                    <span key={id} className={`rounded px-1.5 py-0.5 ${have >= need ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                      {item(id)!.icon} {item(id)!.name} {have}/{need}
                    </span>
                  );
                })}
                {r.gold > 0 && (
                  <span className={`rounded px-1.5 py-0.5 ${p.gold >= r.gold ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>
                    {r.gold} 🪙
                  </span>
                )}
                <span className="rounded px-1.5 py-0.5 bg-slate-500/20 text-slate-300">
                  Diff: {r.difficulty}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
