import { useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { RECIPES, canCraft, consumeMaterials, finishCraft, getCraftLevel, type Recipe } from '../../game/crafting';
import { item, RARITY_COLOR } from '../../game/items';
import type { ItemSlot } from '../../game/types';
import { deriveStats } from '../../game/player';
import { setProcDesc } from '../../game/sets';
import ItemIcon from '../ItemIcon';

type Group = ItemSlot | 'all' | 'profession';

const GROUPS: { slot: Group; label: string; icon: string }[] = [
  { slot: 'all', label: 'Tout', icon: '📋' },
  { slot: 'weapon', label: 'Armes', icon: '⚔️' },
  { slot: 'armor', label: 'Armures', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijoux', icon: '💍' },
  { slot: 'profession', label: 'Métier', icon: '🧰' },
  { slot: 'material', label: 'Ressources', icon: '🧱' },
  { slot: 'consumable', label: 'Consommables', icon: '🍲' },
];

type ClassFilter = 'all' | 'warrior' | 'archer' | 'mage' | 'healer';
const CLASS_FILTERS: { id: ClassFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'Toutes', icon: '👥' },
  { id: 'warrior', label: 'Guerrier', icon: '⚔️' },
  { id: 'archer', label: 'Archer', icon: '🏹' },
  { id: 'mage', label: 'Mage', icon: '🔮' },
  { id: 'healer', label: 'Soigneur', icon: '✨' },
];

const CLASS_LABEL: Record<string, string> = { warrior: 'Guerrier', archer: 'Archer', mage: 'Mage', healer: 'Soigneur' };

/** Poids d'armure déduit des classes autorisées (badge tissu/cuir/plate). */
function armorWeight(it: { slot: string; classes?: string[] }): { label: string; cls: string } | null {
  if (it.slot !== 'armor') return null;
  const c = it.classes;
  if (!c || c.length >= 4) return { label: 'Universel', cls: 'bg-slate-600/40 text-slate-200' };
  if (c.includes('mage') || c.includes('healer')) return { label: 'Tissu', cls: 'bg-sky-500/20 text-sky-200' };
  if (c.includes('archer')) return { label: 'Cuir', cls: 'bg-amber-600/25 text-amber-200' };
  if (c.includes('warrior')) return { label: 'Plate', cls: 'bg-slate-400/25 text-slate-100' };
  return null;
}

/** Identité visuelle de chaque set d'équipement, pour regrouper les objets qui vont ensemble. */
const SET_INFO: Record<string, { name: string; icon: string; color: string }> = {
  frost_set: { name: 'Givre', icon: '❄️', color: '#7ad0ff' },
  fire_set: { name: 'Braise', icon: '🔥', color: '#ff8a4a' },
  wind_set: { name: 'Vent', icon: '🌪️', color: '#8fe6c8' },
  earth_set: { name: 'Terre', icon: '🪨', color: '#c9a36a' },
  water_set: { name: 'Marée', icon: '🌊', color: '#5aa6ff' },
  light_set: { name: 'Lumière', icon: '✨', color: '#ffe27a' },
  dark_set: { name: 'Ombre', icon: '👁️', color: '#c46bff' },
  obsidian_set: { name: 'Obsidienne', icon: '⬛', color: '#b0b8c8' },
};

/** Objets d'artisan/récolteur : boostent CP (artisanat) ou GP (récolte) au lieu du combat. */
function isProfessionGear(it: { maxCp?: number; maxGp?: number }) {
  return !!(it.maxCp || it.maxGp);
}

export default function CraftCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [active, setActive] = useState<Recipe | null>(null);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(0);
  const [durability, setDurability] = useState(0);
  const [cp, setCp] = useState(0);
  const [group, setGroup] = useState<Group>('all');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');

  const byGroup = useMemo(() => {
    const map: Record<Group, Recipe[]> = { all: [], material: [], consumable: [], armor: [], weapon: [], trinket: [], tool: [], profession_armor: [], profession: [] };

    // Trier par set (regroupe visuellement les objets qui vont ensemble), puis niveau, puis difficulté.
    const sortedRecipes = [...RECIPES].sort((a, b) => {
      const ia = item(a.output), ib = item(b.output);
      const sa = ia?.setId ?? '', sb = ib?.setId ?? '';
      if (sa !== sb) return sa.localeCompare(sb);
      if (a.levelReq !== b.levelReq) return a.levelReq - b.levelReq;
      return a.difficulty - b.difficulty;
    });

    for (const r of sortedRecipes) {
      const out = item(r.output);
      const slot = out?.slot ?? 'material';
      (map[slot as ItemSlot] ??= []).push(r);
      map.all.push(r);
      if (out && isProfessionGear(out)) map.profession.push(r);
    }
    return map;
  }, []);

  if (!p) return null;

  const craftLvlData = getCraftLevel(p.craftXp);
  const craftLvl = craftLvlData.level;
  const gearStats = deriveStats(p);
  const maxCp = 50 + craftLvl * 10 + (gearStats.maxCp || 0);
  const progGain = Math.floor(10 + craftLvl * 1.5);
  const qualGain = Math.floor(15 + craftLvl * 2);
  const touchCost = Math.max(5, 15 - Math.floor(craftLvl / 2));

  function startCraft(r: Recipe) {
    if (!canCraft(p!, r)) {
      toast('Matériaux ou or insuffisants.', 'bad');
      return;
    }
    const lockedMat = Object.keys(r.materials).find((id) => p!.lockedItems?.includes(id));
    if (lockedMat) {
      toast(`${item(lockedMat)?.name ?? 'Un matériau'} est verrouillé 🔒 — déverrouille-le pour craft.`, 'bad');
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
      let outQty = 0;
      mutate((d) => {
        const res = finishCraft(d, r, ratio, true);
        outId = res.id;
        outQty = res.qty;
      });
      toast(`Succès ! Tu as fabriqué : ${item(outId)!.name} x${outQty} ${ratio > 0 && ['weapon', 'armor', 'trinket'].includes(item(outId)!.slot) ? `(Qualité ${Math.round(ratio * 100)}%)` : ''}`, 'good');
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

  const ELEMENTS: Record<string, { icon: string; label: string }> = {
    fire: { icon: '🔥', label: 'Feu' },
    water: { icon: '💧', label: 'Eau' },
    earth: { icon: '🪨', label: 'Terre' },
    wind: { icon: '🌪️', label: 'Vent' },
    light: { icon: '✨', label: 'Lumière' },
    dark: { icon: '🌌', label: 'Ténèbres' },
    frost: { icon: '❄️', label: 'Givre' },
  };

  /** Badges de stats/type d'un objet : chaque badge a une icône ET un mot pour rester clair. */
  function statBadges(it: any): { txt: string; cls: string }[] {
    const b: { txt: string; cls: string }[] = [];
    if (it.atk) b.push({ txt: `🗡️ ${it.atk} ATK`, cls: 'bg-rose-500/15 text-rose-200' });
    if (it.def) b.push({ txt: `🛡️ ${it.def} DEF`, cls: 'bg-sky-500/15 text-sky-200' });
    if (it.hp && it.slot === 'armor') b.push({ txt: `❤️ ${it.hp} PV`, cls: 'bg-emerald-500/15 text-emerald-200' });
    if (it.hp && it.slot === 'consumable') b.push({ txt: `🧪 +${it.hp} PV`, cls: 'bg-emerald-500/15 text-emerald-200' });
    if (it.maxCp) b.push({ txt: `🧠 +${it.maxCp} CP`, cls: 'bg-indigo-500/15 text-indigo-200' });
    if (it.maxGp) b.push({ txt: `🌾 +${it.maxGp} GP`, cls: 'bg-lime-500/15 text-lime-200' });
    if (it.element && it.slot !== 'material' && it.slot !== 'consumable' && ELEMENTS[it.element]) {
      const e = ELEMENTS[it.element];
      b.push({ txt: `${e.icon} ${e.label}`, cls: 'bg-white/5 text-slate-300' });
    }
    return b;
  }

  if (active) {
    const out = item(active.output)!;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm font-bold text-sky-300">Artisanat en cours...</p>
          <p className="flex items-center justify-center gap-1.5 text-lg" style={{ color: RARITY_COLOR[out.rarity] }}><ItemIcon id={active.output} size={22} /> {out.name}</p>
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
          <button onClick={actTouch} disabled={cp < touchCost} className="rounded bg-purple-600/80 p-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-30 active:scale-95">
            Minutieux<br/><span className="text-[10px] font-normal">(-10 Sol, -{touchCost} CP)</span>
          </button>
          <button onClick={actRepair} disabled={cp < 30} className="rounded bg-emerald-600/80 p-2 text-xs font-bold hover:bg-emerald-500 disabled:opacity-30 active:scale-95">
            Réparation<br/><span className="text-[10px] font-normal">(+30 Sol, -30 CP)</span>
          </button>
        </div>

        {/* Tuto affiché ici, pendant le craft (là où c'est utile). */}
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] leading-relaxed text-slate-300 space-y-1">
          <p className="font-semibold text-blue-300">Comment ça marche</p>
          <p><b className="text-sky-300">Synthèse</b> : monte l'<b>Avancement</b>. Remplis-le avant que la Solidité tombe à 0.</p>
          <p><b className="text-purple-300">Minutieux</b> : monte la <b>Qualité</b> (= meilleures stats de l'objet), consomme des CP.</p>
          <p><b className="text-emerald-300">Réparation</b> : regagne de la Solidité contre beaucoup de CP.</p>
        </div>
      </div>
    );
  }

  const showClassFilter = group === 'weapon' || group === 'armor';
  const list = (byGroup[group] ?? []).filter((r) => {
    if (!showClassFilter || classFilter === 'all') return true;
    const cls = item(r.output)?.classes;
    if (!cls) return true; // universel (aucune restriction)
    return cls.includes(classFilter);
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {GROUPS.map((g) => {
          const count = byGroup[g.slot]?.length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={g.slot}
              onClick={() => { setGroup(g.slot); setClassFilter('all'); }}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                group === g.slot ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'
              }`}
            >
              {g.icon} {g.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      {showClassFilter && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CLASS_FILTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => setClassFilter(c.id)}
              className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                classFilter === c.id ? 'bg-purple-500/40 text-white' : 'bg-black/20 text-slate-400 hover:bg-white/10'
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}
      {group === 'profession' && (
        <p className="text-[11px] text-slate-400 px-0.5">
          🧠 CP = concentration (artisanat) &nbsp;·&nbsp; 🌾 GP = endurance (récolte). Ces objets ne boostent pas le combat.
        </p>
      )}
      {group === 'armor' && (
        <p className="text-[11px] text-slate-400 px-0.5 mt-1 leading-tight">
          <b className="text-slate-300">Guerriers</b> : Armures en Plaque et Boucliers.<br/>
          <b className="text-amber-300">Archers</b> : Armures en Cuir.<br/>
          <b className="text-sky-300">Mages & Soigneurs</b> : Armures en Tissu.
        </p>
      )}

      <div className="max-h-[62vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2">
          {(() => {
            let lastSetId: string | undefined;
            const nodes: ReactNode[] = [];
            for (const r of list) {
              const out = item(r.output)!;
              const ok = canCraft(p, r);
              const levelOk = craftLvl >= r.levelReq;
              const badges = statBadges(out);
              const classLabel = out.classes && out.classes.length < 4
                ? out.classes.map((c) => CLASS_LABEL[c] ?? c).join(' / ')
                : null;
              const weight = armorWeight(out);
              const setInfo = out.setId ? SET_INFO[out.setId] : undefined;
              if (out.setId && out.setId !== lastSetId && setInfo) {
                nodes.push(
                  <div key={`h-${out.setId}`} className="col-span-2 flex items-center gap-1.5 px-1 pt-2 pb-0.5 text-[11px] font-semibold" style={{ color: setInfo.color }}>
                    <span>{setInfo.icon}</span>
                    <span>Ensemble {setInfo.name}</span>
                    <span className="h-px flex-1 opacity-30" style={{ background: setInfo.color }} />
                    {out.setId && setProcDesc(out.setId) && (
                      <span className="group relative shrink-0">
                        <span className="cursor-help rounded-full bg-black/30 px-1.5 text-[10px] font-normal text-slate-300">ⓘ</span>
                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-lg border border-white/10 bg-slate-900 p-2 text-[10px] font-normal normal-case leading-snug text-slate-200 shadow-xl group-hover:block">
                          Bonus 3 pièces : {setProcDesc(out.setId)}
                        </div>
                      </span>
                    )}
                  </div>,
                );
              }
              lastSetId = out.setId;
              nodes.push(
                <div
                  key={r.output}
                  className={`flex flex-col rounded-lg p-2 ${levelOk ? 'bg-black/25' : 'bg-black/40 opacity-70'}`}
                  style={setInfo ? { boxShadow: `inset 3px 0 0 ${setInfo.color}` } : undefined}
                >
                  <div className="flex items-start gap-2">
                    <ItemIcon id={r.output} size={26} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{ color: RARITY_COLOR[out.rarity] }} title={out.name}>
                        {out.name}{r.qty > 1 ? ` x${r.qty}` : ''}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 flex-wrap text-[10px]">
                        {badges.map((bd, i) => (
                          <span key={i} className={`rounded px-1 py-0.5 ${bd.cls}`}>{bd.txt}</span>
                        ))}
                        {classLabel && (
                          <span className="rounded px-1 py-0.5 bg-slate-700/50 text-slate-300">{classLabel}</span>
                        )}
                        {weight && (
                          <span className={`rounded px-1 py-0.5 ${weight.cls}`}>{weight.label}</span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                        {Object.entries(r.materials).map(([id, need]) => {
                          const have = p.inventory[id] ?? 0;
                          return (
                            <span
                              key={id}
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 ${have >= need ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}
                            >
                              <ItemIcon id={id} size={14} /> {item(id)!.name} {have}/{need}
                            </span>
                          );
                        })}
                        {r.gold > 0 && (
                          <span
                            title={`Or : ${r.gold}`}
                            className={`rounded px-1 py-0.5 ${p.gold >= r.gold ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}
                          >
                            🪙 {r.gold}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => startCraft(r)}
                        disabled={!ok || !levelOk}
                        className="mt-2 w-full rounded bg-sky-500/30 py-1 text-xs font-semibold hover:bg-sky-500/50 disabled:opacity-40"
                      >
                        {levelOk ? 'Forger' : `Niveau ${r.levelReq} requis`}
                      </button>
                    </div>
                  </div>
                </div>,
              );
            }
            return nodes;
          })()}
        </div>
      </div>
    </div>
  );
}
