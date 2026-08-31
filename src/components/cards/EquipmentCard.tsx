import { useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { CLASSES } from '../../game/classes';
import { deriveStats, equipItem, unequipItem, canEquip, saveEquipmentBuild, applyEquipmentBuild, updateEquipmentBuild, deleteEquipmentBuild, MAX_BUILD_SLOTS } from '../../game/player';
import { RECIPES, getCraftLevel } from '../../game/crafting';
import type { ItemDef, ItemSlot } from '../../game/types';
import ItemIcon from '../ItemIcon';

type SlotKey = 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor';

const SLOTS: { slot: SlotKey; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
  { slot: 'tool', label: 'Outil', icon: '🪓' },
  { slot: 'profession_armor', label: 'Tenue', icon: '🎽' },
];

const SET_BONUSES: Record<string, { name: string; desc: string }> = {
  wind_set: { name: 'Set du Vent', desc: '+10% ATK, +10% PV' },
  earth_set: { name: 'Set de Terre', desc: '+20% PV' },
  fire_set: { name: 'Set de Feu', desc: '+20% ATK' },
  frost_set: { name: 'Set de Givre', desc: '+20% DEF' },
  water_set: { name: 'Set d\'Eau', desc: '+10% PV, +10% DEF' },
  light_set: { name: 'Set de Lumière', desc: '+10% ATK, +10% DEF' },
  dark_set: { name: 'Set des Ténèbres', desc: '+25% ATK, -10% PV' },
  obsidian_set: { name: 'Set d\'Obsidienne', desc: '+25% DEF, +10% PV' },
};

const ELEMENTS: Record<string, { icon: string; label: string }> = {
  fire: { icon: '🔥', label: 'Feu' },
  water: { icon: '💧', label: 'Eau' },
  earth: { icon: '🪨', label: 'Terre' },
  wind: { icon: '🌪️', label: 'Vent' },
  light: { icon: '✨', label: 'Lumière' },
  dark: { icon: '🌌', label: 'Ténèbres' },
  frost: { icon: '❄️', label: 'Givre' },
  neutral: { icon: '⚪', label: 'Neutre' },
};

const UPGRADE_CHANCE = ['100%', '90%', '75%', '60%', '40%'];
const BUILD_ICONS = ['⚔️', '🛡️', '🏹', '🔮', '❤️', '💀', '🔥', '❄️', '🌪️', '🪨', '✨', '🌌', '🎯', '🧪', '👑', '💰'];
const BUILD_SLOTS: SlotKey[] = ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'];

/** Petit chip jaune "+X" : bonus de stat apporté par les étoiles d'amélioration. */
function starBonusChip(bonus: number) {
  if (bonus <= 0) return null;
  return <span className="ml-1 rounded bg-yellow-400 px-1 text-[9px] font-bold text-black" title={`+${bonus} grâce aux étoiles d'amélioration`}>+{bonus}</span>;
}

function statBadges(it: ItemDef | null, stars = 0): { txt: ReactNode; cls: string }[] {
  if (!it) return [];
  const b: { txt: ReactNode; cls: string }[] = [];
  const bonus = (base: number) => Math.floor(base * stars * 0.1);
  if (it.atk) b.push({ txt: <>🗡️ {it.atk} ATK{starBonusChip(bonus(it.atk))}</>, cls: 'bg-rose-500/15 text-rose-200' });
  if (it.def) b.push({ txt: <>🛡️ {it.def} DEF{starBonusChip(bonus(it.def))}</>, cls: 'bg-sky-500/15 text-sky-200' });
  if (it.hp) b.push({ txt: <>{it.hp > 0 ? '❤️' : '💔'} {it.hp > 0 ? '+' : ''}{it.hp} PV{it.hp > 0 && starBonusChip(bonus(it.hp))}</>, cls: it.hp > 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200' });
  if (it.maxCp) b.push({ txt: <>🧠 +{it.maxCp} CP{starBonusChip(bonus(it.maxCp))}</>, cls: 'bg-indigo-500/15 text-indigo-200' });
  if (it.maxGp) b.push({ txt: <>🌾 +{it.maxGp} GP{starBonusChip(bonus(it.maxGp))}</>, cls: 'bg-lime-500/15 text-lime-200' });
  return b;
}

function typeBadges(it: ItemDef | null): { txt: string; cls: string }[] {
  if (!it) return [];
  const b: { txt: string; cls: string }[] = [];
  if (it.element && ELEMENTS[it.element]) {
    const e = ELEMENTS[it.element];
    b.push({ txt: `${e.icon} ${e.label}`, cls: 'bg-white/5 text-slate-300' });
  }
  if (it.dmgType) b.push({ txt: it.dmgType === 'magical' ? '🔮 Magique' : '⚔️ Physique', cls: 'bg-white/5 text-slate-300' });
  return b;
}

function buildOutdated(equipped: Partial<Record<SlotKey, string | null | undefined>>, gear: Partial<Record<SlotKey, string | null | undefined>>): boolean {
  return BUILD_SLOTS.some((slot) => (equipped[slot] ?? undefined) !== (gear[slot] ?? undefined));
}

/** Stat effective d'une pièce, étoiles comprises (sert à la comparaison). */
function effStat(it: ItemDef | null, stars: number, key: 'atk' | 'def' | 'hp'): number {
  if (!it) return 0;
  const base = it[key] ?? 0;
  return base + Math.floor(base * stars * 0.1);
}

/** Chip de comparaison « +12 ATK » / « −4 DEF » face à la pièce déjà portée. */
function DeltaChip({ delta, label }: { delta: number; label: string }) {
  if (delta === 0) return null;
  const good = delta > 0;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${good ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
      {good ? '+' : '−'}{Math.abs(delta)} {label}
    </span>
  );
}

export default function EquipmentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [selected, setSelected] = useState<SlotKey>('weapon');
  const [showAddBuild, setShowAddBuild] = useState(false);
  const [buildName, setBuildName] = useState('');
  const [buildIcon, setBuildIcon] = useState(BUILD_ICONS[0]);
  if (!p) return null;

  const stats = deriveStats(p);
  const cls = CLASSES[p.classId];

  function saveBuild() {
    if (!buildName.trim()) return toast('Donne un nom au build.', 'bad');
    let ok = false;
    mutate((d) => { ok = saveEquipmentBuild(d, buildName, buildIcon); });
    if (!ok) return toast(`Maximum ${MAX_BUILD_SLOTS} builds sauvegardés.`, 'bad');
    toast(`Build "${buildName}" enregistré.`, 'good');
    setShowAddBuild(false); setBuildName(''); setBuildIcon(BUILD_ICONS[0]);
  }
  function applyBuild(id: string, name: string) {
    let res = { applied: 0, skipped: [] as string[] };
    mutate((d) => { res = applyEquipmentBuild(d, id); });
    const SLOT_LABEL: Record<string, string> = { weapon: 'arme', armor: 'armure', trinket: 'bijou', tool: 'outil', profession_armor: 'tenue de métier' };
    if (res.skipped.length > 0) {
      toast(`Build "${name}" appliqué (${res.applied} pièce(s)) — manquant(es) : ${res.skipped.map((s) => SLOT_LABEL[s] ?? s).join(', ')}.`, res.applied > 0 ? 'good' : 'bad');
    } else {
      toast(`Build "${name}" appliqué (${res.applied} pièce(s)).`, 'good');
    }
  }
  function deleteBuild(id: string, name: string) {
    if (!confirm(`Supprimer le build "${name}" ?`)) return;
    mutate((d) => { deleteEquipmentBuild(d, id); });
  }
  function updateBuild(id: string, name: string) {
    if (!confirm(`Remplacer "${name}" par l'équipement actuel ?`)) return;
    mutate((d) => { updateEquipmentBuild(d, id); });
    toast(`Build "${name}" mis à jour.`, 'good');
  }
  function equip(id: string) {
    mutate((d) => { equipItem(d, id); });
    toast(`${item(id)!.name} équipé.`, 'good');
  }
  function unequip(slot: SlotKey) {
    mutate((d) => { unequipItem(d, slot); });
  }
  function repair(id: string, max: number) {
    if ((p!.inventory['repair_kit'] || 0) < 1) return toast("Tu n'as pas de kit de réparation.", 'bad');
    mutate((d) => {
      d.inventory['repair_kit'] -= 1;
      if (!d.gearDurability) d.gearDurability = {};
      d.gearDurability[id] = max;
    });
    toast('Équipement réparé !', 'good');
  }
  function upgrade(id: string) {
    if ((p!.inventory['upgrade_matrix'] || 0) < 1) return toast("Tu n'as pas de matrice d'amélioration.", 'bad');
    mutate((d) => {
      d.inventory['upgrade_matrix'] -= 1;
      if (!d.gearStars) d.gearStars = {};
      const cur = d.gearStars[id] || 0;
      const chances = [1, 0.9, 0.75, 0.6, 0.4];
      if (Math.random() <= chances[cur]) {
        d.gearStars[id] = cur + 1;
        toast(d.gearStars[id] === 5 ? 'Légendaire ! Ton objet a atteint 5 étoiles !' : `Amélioration réussie ! (${d.gearStars[id]}★)`, 'good');
      } else {
        toast("L'amélioration a échoué...", 'bad');
      }
    });
  }

  const owned = (slot: ItemSlot) =>
    Object.entries(p.inventory).filter(([id, q]) => item(id) && item(id)!.slot === slot && q > 0);

  // Sets actifs (pièces équipées non cassées).
  const setIdsCount: Record<string, number> = {};
  for (const { slot } of SLOTS) {
    const eqId = p.equipped[slot];
    const it = eqId ? item(eqId) : null;
    if (it && it.setId && eqId && (p.gearDurability?.[eqId] ?? 1) > 0) {
      setIdsCount[it.setId] = (setIdsCount[it.setId] || 0) + 1;
    }
  }
  const bestSet = Object.entries(setIdsCount).sort((a, b) => b[1] - a[1])[0];
  const setPct = bestSet ? Math.min(100, (bestSet[1] / 3) * 100) : 0;
  const setComplete = !!bestSet && bestSet[1] >= 3;

  /** Tuile d'emplacement : icône, rareté, étoiles, usure. */
  function SlotTile({ slot, label, icon }: { slot: SlotKey; label: string; icon: string }) {
    const eqId = p!.equipped[slot];
    const eq = eqId ? item(eqId) : null;
    const stars = eqId ? (p!.gearStars?.[eqId] || 0) : 0;
    const durMax = eq?.maxDurability ?? 0;
    const dur = eqId ? (p!.gearDurability?.[eqId] ?? durMax) : 0;
    const ratio = durMax ? dur / durMax : 1;
    const broken = durMax > 0 && dur <= 0;
    const active = selected === slot;
    const tint = eq ? RARITY_COLOR[eq.rarity] : '#475569';

    return (
      <button
        onClick={() => setSelected(slot)}
        title={eq ? eq.name : `${label} — vide`}
        className={`group relative flex w-full items-center gap-2 rounded-xl border p-2 text-left transition ${
          active ? 'border-sky-400/70 bg-sky-500/10' : 'border-white/10 bg-black/25 hover:border-white/25 hover:bg-black/35'
        }`}
      >
        <div
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/40"
          style={{ boxShadow: eq ? `inset 0 0 0 1px ${tint}55` : undefined }}
        >
          {eq && eqId ? <ItemIcon id={eqId} size={26} className={broken ? 'grayscale' : ''} /> : <span className="text-lg opacity-30">{icon}</span>}
          {/* Usure : liseré en bas de l'icône plutôt qu'une barre de plus. */}
          {durMax > 0 && (
            <span className="absolute inset-x-1 bottom-1 h-[3px] overflow-hidden rounded-full bg-black/60">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(0, ratio * 100)}%`, background: ratio <= 0 ? '#ef4444' : ratio < 0.25 ? '#f97316' : ratio < 0.6 ? '#eab308' : '#22c55e' }}
              />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
          {eq ? (
            <div className="truncate text-xs font-medium" style={{ color: tint }}>
              {eq.name}
              {stars > 0 && <span className="ml-1 text-[10px] text-yellow-400">{'★'.repeat(stars)}</span>}
            </div>
          ) : (
            <div className="text-xs italic text-slate-600">vide</div>
          )}
          {broken && <div className="text-[10px] font-bold text-red-400">cassé</div>}
        </div>
      </button>
    );
  }

  // ── Détail de l'emplacement sélectionné ──
  const selDef = SLOTS.find((s) => s.slot === selected)!;
  const eqId = p.equipped[selected];
  const eq = eqId ? item(eqId)! : null;
  const stars = eqId ? (p.gearStars?.[eqId] || 0) : 0;
  const durMax = eq?.maxDurability ?? 0;
  const dur = eqId ? (p.gearDurability?.[eqId] ?? durMax) : 0;
  const badges = [...statBadges(eq, stars), ...typeBadges(eq)];
  const candidates = owned(selected).filter(([id]) => id !== eqId && canEquip(p, item(id)!));

  return (
    <div className="space-y-4">
      {/* ── Paperdoll : la silhouette au centre, les emplacements autour ── */}
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_minmax(0,7rem)_1fr]">
        <div className="order-2 space-y-2 sm:order-1">
          <SlotTile {...SLOTS[0]} />
          <SlotTile {...SLOTS[1]} />
        </div>

        <div className="order-1 col-span-2 flex flex-col items-center sm:order-2 sm:col-span-1">
          <div className="relative grid h-24 w-24 place-items-center">
            {/* Anneau de set : se referme à mesure que les pièces s'assemblent. */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              {bestSet && (
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={setComplete ? '#4ade80' : '#8cb4ff'} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(setPct / 100) * 283} 283`}
                />
              )}
            </svg>
            <span className="text-4xl">{cls?.emoji ?? '🧍'}</span>
          </div>
          <div className="mt-1 text-center">
            <div className="text-xs font-semibold text-slate-300">{cls?.name ?? p.classId}</div>
            {bestSet ? (
              <div className={`text-[10px] ${setComplete ? 'text-emerald-300' : 'text-slate-500'}`}>
                {SET_BONUSES[bestSet[0]]?.name ?? bestSet[0]} {bestSet[1]}/3
              </div>
            ) : (
              <div className="text-[10px] text-slate-600">aucun set</div>
            )}
          </div>
        </div>

        <div className="order-3 space-y-2">
          <SlotTile {...SLOTS[2]} />
          <SlotTile {...SLOTS[3]} />
        </div>

        <div className="order-4 col-span-2 sm:col-span-3">
          <SlotTile {...SLOTS[4]} />
        </div>
      </div>

      {/* Stats résultantes */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/10 py-2"><div className="text-[10px] text-emerald-300/80">❤️ PV</div><div className="text-base font-bold tabular-nums text-emerald-200">{stats.maxHp}</div></div>
        <div className="rounded-lg bg-rose-500/10 py-2"><div className="text-[10px] text-rose-300/80">🗡️ ATK</div><div className="text-base font-bold tabular-nums text-rose-200">{stats.atk}</div></div>
        <div className="rounded-lg bg-sky-500/10 py-2"><div className="text-[10px] text-sky-300/80">🛡️ DEF</div><div className="text-base font-bold tabular-nums text-sky-200">{stats.def}</div></div>
      </div>

      {/* ── Panneau de l'emplacement sélectionné ── */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selDef.icon} {selDef.label}</span>
          {eq && (
            <button onClick={() => unequip(selected)} className="rounded bg-rose-500/25 px-2 py-0.5 text-[11px] hover:bg-rose-500/45">Retirer</button>
          )}
        </div>

        {eq ? (
          <>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium" style={{ color: RARITY_COLOR[eq.rarity] }}>
              <ItemIcon id={eqId!} size={22} />
              <span className="truncate">{eq.name}</span>
              {stars > 0 && <span className="text-xs text-yellow-400">{'★'.repeat(stars)}</span>}
            </div>
            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {badges.map((bd, i) => <span key={i} className={`rounded px-2 py-1 ${bd.cls}`}>{bd.txt}</span>)}
              </div>
            )}

            {durMax > 0 && (
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className={dur === 0 ? 'font-bold text-red-400' : 'text-slate-400'}>🔧 {dur} / {durMax}</span>
                {dur < durMax && (
                  <button onClick={() => repair(eqId!, durMax)} className="rounded bg-orange-500/25 px-2 py-0.5 hover:bg-orange-500/45">
                    Réparer 🛠️{p.inventory['repair_kit'] || 0}
                  </button>
                )}
              </div>
            )}

            {durMax > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-purple-500/10 px-3 py-2">
                <span className="text-[11px] text-purple-200">
                  <span className="text-yellow-400">{'★'.repeat(stars)}</span><span className="text-slate-600">{'☆'.repeat(5 - stars)}</span>
                  <span className="ml-1 text-slate-400">(+{stars * 10}% stats)</span>
                </span>
                {stars < 5 ? (
                  <button onClick={() => upgrade(eqId!)} className="inline-flex items-center gap-1 rounded bg-purple-500/30 px-2 py-0.5 text-[11px] hover:bg-purple-500/50">
                    Améliorer {UPGRADE_CHANCE[stars]} <ItemIcon id="upgrade_matrix" size={13} />{p.inventory['upgrade_matrix'] || 0}
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-yellow-400">MAX</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="mt-1 text-sm italic text-slate-500">— aucune pièce équipée —</div>
        )}

        {/* Sac : uniquement les pièces de cet emplacement, avec la comparaison */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
            🎒 Dans le sac ({candidates.length})
          </div>
          {candidates.length === 0 ? (
            <div className="text-[11px] italic text-slate-600">Rien d'autre à équiper ici.</div>
          ) : (
            <div className="space-y-1.5">
              {candidates.map(([id, q]) => {
                const it = item(id)!;
                const candStars = p.gearStars?.[id] || 0;
                let reqReason: string | null = null;
                const craftLvl = getCraftLevel(p.craftXp).level;
                const recipe = RECIPES.find((x) => x.output === it.id);
                if (recipe && craftLvl < recipe.levelReq) reqReason = `Artis. Niv ${recipe.levelReq} requis`;
                else if (!recipe && it.reqLevel && p.level < it.reqLevel) reqReason = `Niv ${it.reqLevel} requis`;

                // Comparaison directe avec la pièce portée : le joueur voit ce
                // qu'il gagne ou perd avant de cliquer.
                const dAtk = effStat(it, candStars, 'atk') - effStat(eq, stars, 'atk');
                const dDef = effStat(it, candStars, 'def') - effStat(eq, stars, 'def');
                const dHp = effStat(it, candStars, 'hp') - effStat(eq, stars, 'hp');

                return (
                  <div key={id} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${reqReason ? 'bg-red-950/40 opacity-75' : 'bg-black/30'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <ItemIcon id={id} size={18} className={reqReason ? 'grayscale' : ''} />
                        <span className="truncate" style={{ color: reqReason ? '#7f1d1d' : RARITY_COLOR[it.rarity] }}>{it.name}</span>
                        {candStars > 0 && <span className="text-[10px] leading-none text-yellow-400">{'★'.repeat(candStars)}</span>}
                        {q > 1 && <span className="text-[10px] text-slate-500">×{q}</span>}
                      </div>
                      {!reqReason && (dAtk || dDef || dHp) ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <DeltaChip delta={dAtk} label="ATK" />
                          <DeltaChip delta={dDef} label="DEF" />
                          <DeltaChip delta={dHp} label="PV" />
                        </div>
                      ) : null}
                    </div>
                    {reqReason ? (
                      <div className="max-w-[80px] shrink-0 text-right text-[10px] font-bold text-red-400">{reqReason}</div>
                    ) : (
                      <button onClick={() => equip(id)} className="shrink-0 rounded bg-sky-500/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-sky-500/50">Équiper</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Builds ── */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">💾 Builds</span>
          <span className="text-[10px] text-slate-500">{(p.buildSlots ?? []).length}/{MAX_BUILD_SLOTS}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(p.buildSlots ?? []).map((b) => (
            <div key={b.id} className="group relative flex items-center gap-1.5 rounded-lg bg-indigo-500/20 py-1.5 pl-2.5 pr-1.5 text-sm hover:bg-indigo-500/35">
              <button onClick={() => applyBuild(b.id, b.name)} className="flex items-center gap-1.5">
                <span className="text-base leading-none">{b.icon}</span>
                <span className="max-w-[9rem] truncate font-medium">{b.name}</span>
              </button>
              {buildOutdated(p.equipped, b.gear) && (
                <button onClick={() => updateBuild(b.id, b.name)} className="rounded px-1 text-slate-400 hover:bg-sky-500/40 hover:text-sky-200" title="Mettre à jour avec l'équipement actuel">🔄</button>
              )}
              <button onClick={() => deleteBuild(b.id, b.name)} className="rounded px-1 text-slate-400 hover:bg-rose-500/40 hover:text-rose-200" title="Supprimer">✕</button>
            </div>
          ))}
          {(p.buildSlots ?? []).length < MAX_BUILD_SLOTS && !showAddBuild && (
            <button onClick={() => setShowAddBuild(true)} className="rounded-lg bg-black/30 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10">+ Nouveau build</button>
          )}
        </div>
        {showAddBuild && (
          <div className="mt-2 space-y-2 rounded-lg bg-black/30 p-2.5">
            <div className="flex flex-wrap gap-1">
              {BUILD_ICONS.map((ic) => (
                <button key={ic} onClick={() => setBuildIcon(ic)} className={`rounded px-1.5 py-1 text-base leading-none ${buildIcon === ic ? 'bg-indigo-500/50 ring-1 ring-indigo-300' : 'bg-black/30 hover:bg-white/10'}`}>{ic}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={buildName}
                onChange={(e) => setBuildName(e.target.value.slice(0, 20))}
                placeholder="Nom du build (ex: DPS, Tank...)"
                className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-400/60"
              />
              <button onClick={saveBuild} className="shrink-0 rounded bg-indigo-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500/60">Enregistrer</button>
              <button onClick={() => { setShowAddBuild(false); setBuildName(''); }} className="shrink-0 rounded bg-slate-700/50 px-2 py-1.5 text-sm hover:bg-slate-700">✕</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sets actifs ── */}
      {Object.keys(setIdsCount).length > 0 && (
        <div className="rounded-xl bg-black/25 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">✦ Bonus de sets (3 pièces)</h3>
          {Object.entries(setIdsCount).map(([setId, count]) => {
            const info = SET_BONUSES[setId];
            if (!info) return null;
            const isActive = count >= 3;
            return (
              <div key={setId} className="mb-2">
                <div className={`flex justify-between text-xs ${isActive ? 'font-bold text-green-400' : 'text-slate-400'}`}>
                  <span>{isActive ? '✅ ' : ''}{info.name} ({count}/3)</span>
                  <span className="text-[11px]">{info.desc}</span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(100, (count / 3) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
