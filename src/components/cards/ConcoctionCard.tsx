import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { CONCOCTION_RECIPES, canConcoct, getConcoctionLevel, type ConcoctionRecipe } from '../../game/concoction';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats } from '../../game/player';
import ItemIcon from '../ItemIcon';

export default function ConcoctionCard() {
  const p = useGame(s => s.player);
  const mutate = useGame(s => s.mutate);
  const toast = useGame(s => s.toast);

  const [active, setActive] = useState<ConcoctionRecipe | null>(null);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(0);
  const [durability, setDurability] = useState(0);
  const [cp, setCp] = useState(0);

  if (!p) return null;

  const lvlData = getConcoctionLevel(p.concoctionXp ?? 0);
  const lvl = lvlData.level;
  
  const maxCp = 50 + lvl * 10 + (deriveStats(p).maxCp || 0);
  const progGain = Math.floor(10 + lvl * 1.5);
  const qualGain = Math.floor(15 + lvl * 2);
  const touchCost = Math.max(5, 15 - Math.floor(lvl / 2));

  function start(r: ConcoctionRecipe) {
    if (!canConcoct(p!, r)) {
      toast('Niveau ou ingrédients insuffisants.', 'bad');
      return;
    }
    
    // Consommer les ingrédients
    mutate(d => {
      for (const ing of r.ingredients) {
        d.inventory[ing.id] -= ing.qty;
        if (d.inventory[ing.id] <= 0) delete d.inventory[ing.id];
      }
    });
    
    setActive(r);
    setProgress(0);
    setQuality(0);
    setDurability(r.durability);
    setCp(maxCp);
  }

  function handleResult(r: ConcoctionRecipe, newProg: number, newDur: number, newQual: number) {
    if (newProg >= r.difficulty) {
      // Succès
      const ratio = Math.min(1, newQual / r.maxQuality);
      let qty = 1;
      
      // La qualité pour les concoctions donne une chance d'en fabriquer le double
      if (ratio > 0.8 || (ratio > 0.5 && Math.random() < 0.5)) {
        qty = 2;
      }
      
      mutate(d => {
        d.inventory[r.id] = (d.inventory[r.id] ?? 0) + qty;
        d.concoctionXp = (d.concoctionXp ?? 0) + r.xp;
      });
      toast(`Succès ! Tu as concocté : ${item(r.id)?.name} x${qty}`, 'good');
      setActive(null);
    } else if (newDur <= 0) {
      // Échec
      toast('La concoction a échoué... Les ingrédients sont perdus.', 'bad');
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
    if (!active || cp < touchCost) return;
    const newQual = quality + qualGain;
    const newDur = durability - 10;
    setQuality(newQual);
    setDurability(newDur);
    setCp(cp - touchCost);
    handleResult(active, progress, newDur, newQual);
  }

  function actRepair() {
    if (!active || cp < 30) return;
    setDurability(durability + 30);
    setCp(cp - 30);
  }

  if (active) {
    const out = item(active.id)!;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-300">Alchimie en cours...</p>
          <p className="flex items-center justify-center gap-1.5 text-lg" style={{ color: RARITY_COLOR[out.rarity] }}><ItemIcon id={active.id} size={22} /> {out.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-black/30 p-4 text-sm">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Avancement</span>
              <span>{Math.min(progress, active.difficulty)} / {active.difficulty}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (progress / active.difficulty) * 100)}%` }} />
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
          <button onClick={actTouch} disabled={cp < touchCost} className="rounded bg-purple-600/80 p-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-30 active:scale-95">
            Minutieux<br/><span className="text-[10px] font-normal">(-10 Sol, -{touchCost} CP)</span>
          </button>
          <button onClick={actRepair} disabled={cp < 30} className="rounded bg-emerald-600/80 p-2 text-xs font-bold hover:bg-emerald-500 disabled:opacity-30 active:scale-95">
            Réparation<br/><span className="text-[10px] font-normal">(+30 Sol, -30 CP)</span>
          </button>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 text-xs leading-relaxed text-slate-300">
          <p className="mb-1 font-bold text-sky-200">Comment ça marche</p>
          <p><span className="font-semibold text-sky-300">Synthèse</span> : monte l'Avancement. Remplis-le avant que la Solidité tombe à 0.</p>
          <p><span className="font-semibold text-purple-300">Minutieux</span> : monte la Qualité (donne une chance de fabriquer x2 !), consomme des CP.</p>
          <p><span className="font-semibold text-emerald-300">Réparation</span> : regagne de la Solidité contre beaucoup de CP.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-2xl">
          🧪
        </div>
        <div>
          <div className="font-semibold text-emerald-100">Laboratoire d'Alchimie</div>
          <div className="text-[11px] text-slate-400 leading-tight mt-1">
            Prépare des appâts spéciaux pour attirer des monstres spécifiques lors de tes chasses. 
            Les potions d'appât durent 10 minutes une fois bues depuis l'inventaire.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {CONCOCTION_RECIPES.map((r) => {
          const reqMet = lvl >= r.reqLevel;
          const ingMet = r.ingredients.every((ing) => (p.inventory[ing.id] ?? 0) >= ing.qty);
          const out = item(r.id)!;
          
          return (
            <div key={r.id} className="flex flex-col gap-2 rounded-xl bg-black/25 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-black/40 text-xl" style={{ color: RARITY_COLOR[out.rarity] }}>
                  <ItemIcon id={r.id} size={24} />
                </div>
                <div>
                  <div className="font-bold" style={{ color: RARITY_COLOR[out.rarity] }}>{out.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Niveau {r.reqLevel}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {r.ingredients.map((ing) => {
                    const have = p.inventory[ing.id] ?? 0;
                    const it = item(ing.id);
                    const hasEnougth = have >= ing.qty;
                    return (
                      <div key={ing.id} className={`flex items-center gap-1 whitespace-nowrap rounded bg-black/40 px-2 py-1 text-xs ${hasEnougth ? 'text-slate-300' : 'text-rose-400'}`}>
                        {it ? <ItemIcon id={ing.id} size={14} /> : null} {it?.name ?? ing.id} {have}/{ing.qty}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => start(r)}
                  disabled={!reqMet || !ingMet}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-30"
                >
                  Concocter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
