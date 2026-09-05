import { useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { CLASSES } from '../../game/classes';
import { deriveStats, equipItem, unequipItem, canEquip, saveEquipmentBuild, applyEquipmentBuild, updateEquipmentBuild, deleteEquipmentBuild, MAX_BUILD_SLOTS } from '../../game/player';
import { RECIPES, getCraftLevel } from '../../game/crafting';
import type { ItemDef, ItemSlot } from '../../game/types';
import ItemIcon from '../ItemIcon';

// ─── Carte Équipement ────────────────────────────────────────────────────────
// Trois blocs, et rien d'autre : QUI je suis (classe, stats, sets), CE QUE je
// porte (les cinq emplacements d'un coup d'œil), et LE DÉTAIL de l'emplacement
// choisi (avec son sac). L'ancienne carte empilait cinq encadrés identiques
// qu'il fallait déplier un par un : on ne voyait jamais sa panoplie entière, et
// comparer deux pièces obligeait à faire défiler.

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
  fire: { icon: '🔥', label: 'Feu' }, water: { icon: '💧', label: 'Eau' },
  earth: { icon: '🪨', label: 'Terre' }, wind: { icon: '🌪️', label: 'Vent' },
  light: { icon: '✨', label: 'Lumière' }, dark: { icon: '🌌', label: 'Ténèbres' },
  frost: { icon: '❄️', label: 'Givre' }, neutral: { icon: '⚪', label: 'Neutre' },
};

const UPGRADE_CHANCE = ['100%', '90%', '75%', '60%', '40%'];
const BUILD_ICONS = ['⚔️', '🛡️', '🏹', '🔮', '❤️', '💀', '🔥', '❄️', '🌪️', '🪨', '✨', '🌌', '🎯', '🧪', '👑', '💰'];
const BUILD_SLOTS: SlotKey[] = ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'];

function starBonusChip(bonus: number) {
  if (bonus <= 0) return null;
  return <span className="ml-1 rounded bg-yellow-400 px-1 text-[9px] font-bold text-black" title={`+${bonus} grâce aux étoiles`}>+{bonus}</span>;
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
  if (it.element && ELEMENTS[it.element]) b.push({ txt: `${ELEMENTS[it.element].icon} ${ELEMENTS[it.element].label}`, cls: 'bg-white/5 text-slate-300' });
  if (it.dmgType) b.push({ txt: it.dmgType === 'magical' ? '🔮 Magique' : '⚔️ Physique', cls: 'bg-white/5 text-slate-300' });
  return b;
}

function buildOutdated(equipped: Partial<Record<SlotKey, string | null | undefined>>, gear: Partial<Record<SlotKey, string | null | undefined>>): boolean {
  return BUILD_SLOTS.some((slot) => (equipped[slot] ?? undefined) !== (gear[slot] ?? undefined));
}

/** Stat effective d'une pièce, étoiles comprises (base de la comparaison). */
function effStat(it: ItemDef | null, stars: number, key: 'atk' | 'def' | 'hp'): number {
  if (!it) return 0;
  const base = it[key] ?? 0;
  return base + Math.floor(base * stars * 0.1);
}

function durColor(ratio: number): string {
  return ratio <= 0 ? '#ef4444' : ratio < 0.25 ? '#f97316' : ratio < 0.6 ? '#eab308' : '#22c55e';
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
    const L: Record<string, string> = { weapon: 'arme', armor: 'armure', trinket: 'bijou', tool: 'outil', profession_armor: 'tenue' };
    if (res.skipped.length > 0) toast(`"${name}" appliqué (${res.applied}) — manquant : ${res.skipped.map((x) => L[x] ?? x).join(', ')}.`, res.applied > 0 ? 'good' : 'bad');
    else toast(`Build "${name}" appliqué (${res.applied} pièce(s)).`, 'good');
  }
  function equip(id: string) {
    mutate((d) => { equipItem(d, id); });
    toast(`${item(id)!.name} équipé.`, 'good');
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
      if (Math.random() <= [1, 0.9, 0.75, 0.6, 0.4][cur]) {
        d.gearStars[id] = cur + 1;
        toast(d.gearStars[id] === 5 ? 'Légendaire ! 5 étoiles !' : `Amélioration réussie ! (${d.gearStars[id]}★)`, 'good');
      } else toast("L'amélioration a échoué...", 'bad');
    });
  }

  const owned = (slot: ItemSlot) =>
    Object.entries(p.inventory).filter(([id, q]) => item(id) && item(id)!.slot === slot && q > 0);

  // Sets actifs (pièces équipées non cassées).
  const setCount: Record<string, number> = {};
  for (const { slot } of SLOTS) {
    const id = p.equipped[slot];
    const it = id ? item(id) : null;
    if (it?.setId && id && (p.gearDurability?.[id] ?? 1) > 0) setCount[it.setId] = (setCount[it.setId] || 0) + 1;
  }
  const activeSets = Object.entries(setCount).sort((a, b) => b[1] - a[1]);

  // ── Emplacement sélectionné ──
  const selDef = SLOTS.find((s) => s.slot === selected)!;
  const eqId = p.equipped[selected];
  const eq = eqId ? item(eqId)! : null;
  const stars = eqId ? (p.gearStars?.[eqId] || 0) : 0;
  const durMax = eq?.maxDurability ?? 0;
  const dur = eqId ? (p.gearDurability?.[eqId] ?? durMax) : 0;
  const candidates = owned(selected).filter(([id]) => id !== eqId && canEquip(p, item(id)!));

  return (
    <div className="space-y-3">
      {/* ── 1. Identité : qui je suis, ce que ça donne ── */}
      <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-transparent p-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{cls?.emoji ?? '🧍'}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-100">{p.name}</div>
            <div className="text-[11px] text-slate-400">Niveau {p.level} · {cls?.name ?? p.classId}</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-black/30 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-emerald-300/70">PV</div>
            <div className="text-base font-bold tabular-nums text-emerald-200">{stats.maxHp}</div>
          </div>
          <div className="rounded-lg bg-black/30 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-rose-300/70">ATK</div>
            <div className="text-base font-bold tabular-nums text-rose-200">{stats.atk}</div>
          </div>
          <div className="rounded-lg bg-black/30 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-sky-300/70">DEF</div>
            <div className="text-base font-bold tabular-nums text-sky-200">{stats.def}</div>
          </div>
        </div>
        {/* Les sets vivent ici, avec l'identité — plus dans un bloc perdu en bas. */}
        {activeSets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeSets.map(([id, n]) => {
              const info = SET_BONUSES[id];
              if (!info) return null;
              const done = n >= 3;
              return (
                <span
                  key={id}
                  title={info.desc}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? 'bg-emerald-500/25 text-emerald-200' : 'bg-black/30 text-slate-400'}`}
                >
                  {done ? '✅ ' : ''}{info.name} {n}/3
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. Panoplie : les cinq emplacements d'un seul coup d'œil ── */}
      <div className="grid grid-cols-5 gap-1.5">
        {SLOTS.map(({ slot, label, icon }) => {
          const id = p.equipped[slot];
          const it = id ? item(id) : null;
          const st = id ? (p.gearStars?.[id] || 0) : 0;
          const dMax = it?.maxDurability ?? 0;
          const d = id ? (p.gearDurability?.[id] ?? dMax) : 0;
          const ratio = dMax ? d / dMax : 1;
          const broken = dMax > 0 && d <= 0;
          const active = selected === slot;
          const tint = it ? RARITY_COLOR[it.rarity] : '#475569';
          return (
            <button
              key={slot}
              onClick={() => setSelected(slot)}
              title={it ? it.name : `${label} — vide`}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                active ? 'border-sky-400/70 bg-sky-500/10' : 'border-white/10 bg-black/25 hover:border-white/25'
              }`}
            >
              <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-black/40" style={{ boxShadow: it ? `inset 0 0 0 1px ${tint}66` : undefined }}>
                {it && id ? <ItemIcon id={id} size={22} className={broken ? 'grayscale' : ''} /> : <span className="text-base opacity-25">{icon}</span>}
                {st > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-yellow-400 px-1 text-[8px] font-bold text-black">{st}</span>
                )}
              </span>
              <span className="w-full truncate text-center text-[9px] uppercase tracking-wide text-slate-500">{label}</span>
              {dMax > 0 && (
                <span className="h-[3px] w-full overflow-hidden rounded-full bg-black/50">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(0, ratio * 100)}%`, background: durColor(ratio) }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 3. Détail de l'emplacement choisi, sac compris ── */}
      <div className="rounded-xl bg-black/25 p-3">
        {eq ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ItemIcon id={eqId!} size={26} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold" style={{ color: RARITY_COLOR[eq.rarity] }}>{eq.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    {selDef.label}
                    {stars > 0 && <span className="ml-1 text-yellow-400">{'★'.repeat(stars)}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => mutate((d) => { unequipItem(d, selected); })} className="shrink-0 rounded bg-rose-500/25 px-2 py-1 text-[11px] hover:bg-rose-500/45">
                Retirer
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {statBadges(eq, stars).map((b, i) => <span key={i} className={`rounded px-2 py-1 ${b.cls}`}>{b.txt}</span>)}
            </div>

            {durMax > 0 && (
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px]">
                  <span className={dur <= 0 ? 'font-bold text-red-400' : 'text-slate-400'}>🔧 {dur}/{durMax}</span>
                  <button
                    onClick={() => repair(eqId!, durMax)}
                    disabled={dur >= durMax}
                    className="rounded bg-orange-500/25 px-2 py-0.5 hover:bg-orange-500/45 disabled:opacity-30"
                  >
                    Réparer 🛠️{p.inventory['repair_kit'] || 0}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px]">
                  <span className="text-purple-200">
                    <span className="text-yellow-400">{'★'.repeat(stars)}</span><span className="text-slate-600">{'☆'.repeat(5 - stars)}</span>
                    <span className="ml-1 text-slate-500">+{stars * 10}%</span>
                  </span>
                  {stars < 5 ? (
                    <button onClick={() => upgrade(eqId!)} className="inline-flex items-center gap-1 rounded bg-purple-500/30 px-2 py-0.5 hover:bg-purple-500/50">
                      {UPGRADE_CHANCE[stars]} <ItemIcon id="upgrade_matrix" size={12} />{p.inventory['upgrade_matrix'] || 0}
                    </button>
                  ) : (
                    <span className="font-bold text-yellow-400">MAX</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-sm italic text-slate-500">
            {selDef.icon} Aucune {selDef.label.toLowerCase()} équipée
          </div>
        )}

        {/* Sac du slot : la comparaison est affichée d'office, pas au survol —
            elle doit fonctionner au doigt sur mobile. */}
        <div className="mt-3 border-t border-white/10 pt-2.5">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            🎒 Dans le sac · {candidates.length}
          </div>
          {candidates.length === 0 ? (
            <div className="text-[11px] italic text-slate-600">Rien d'autre à équiper ici.</div>
          ) : (
            <div className="space-y-1">
              {candidates.map(([id, q]) => {
                const it = item(id)!;
                const cs = p.gearStars?.[id] || 0;
                let block: string | null = null;
                const craftLvl = getCraftLevel(p.craftXp).level;
                const recipe = RECIPES.find((x) => x.output === it.id);
                if (recipe && craftLvl < recipe.levelReq) block = `Artis. ${recipe.levelReq}`;
                else if (!recipe && it.reqLevel && p.level < it.reqLevel) block = `Nv.${it.reqLevel}`;

                const deltas: [number, string][] = [
                  [effStat(it, cs, 'atk') - effStat(eq, stars, 'atk'), 'ATK'],
                  [effStat(it, cs, 'def') - effStat(eq, stars, 'def'), 'DEF'],
                  [effStat(it, cs, 'hp') - effStat(eq, stars, 'hp'), 'PV'],
                ];

                return (
                  <div key={id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${block ? 'bg-red-950/30 opacity-70' : 'bg-black/30'}`}>
                    <ItemIcon id={id} size={18} className={block ? 'grayscale' : ''} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="truncate" style={{ color: block ? '#9a5b5b' : RARITY_COLOR[it.rarity] }}>{it.name}</span>
                        {cs > 0 && <span className="shrink-0 text-[9px] text-yellow-400">{'★'.repeat(cs)}</span>}
                        {q > 1 && <span className="shrink-0 text-[9px] text-slate-600">×{q}</span>}
                      </div>
                      {!block && (
                        <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                          {deltas.filter(([v]) => v !== 0).map(([v, label]) => (
                            <span key={label} className={v > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {v > 0 ? '+' : '−'}{Math.abs(v)} {label}
                            </span>
                          ))}
                          {deltas.every(([v]) => v === 0) && <span className="text-slate-600">stats identiques</span>}
                        </div>
                      )}
                    </div>
                    {block ? (
                      <span className="shrink-0 text-[10px] font-bold text-red-400">🔒 {block}</span>
                    ) : (
                      <button onClick={() => equip(id)} className="shrink-0 rounded bg-sky-500/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-sky-500/50">
                        Équiper
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Builds : rangée compacte en pied de carte ── */}
      <div className="rounded-xl bg-black/25 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-500">💾 Builds</span>
          {(p.buildSlots ?? []).map((b) => (
            <div key={b.id} className="flex items-center gap-1 rounded-lg bg-indigo-500/20 py-1 pl-2 pr-1 text-xs hover:bg-indigo-500/35">
              <button onClick={() => applyBuild(b.id, b.name)} className="flex items-center gap-1">
                <span className="leading-none">{b.icon}</span>
                <span className="max-w-[7rem] truncate font-medium">{b.name}</span>
              </button>
              {buildOutdated(p.equipped, b.gear) && (
                <button onClick={() => { if (confirm(`Remplacer "${b.name}" par l'équipement actuel ?`)) { mutate((d) => { updateEquipmentBuild(d, b.id); }); toast('Build mis à jour.', 'good'); } }} className="rounded px-0.5 text-slate-400 hover:text-sky-200" title="Mettre à jour">🔄</button>
              )}
              <button onClick={() => { if (confirm(`Supprimer "${b.name}" ?`)) mutate((d) => { deleteEquipmentBuild(d, b.id); }); }} className="rounded px-0.5 text-slate-500 hover:text-rose-300" title="Supprimer">✕</button>
            </div>
          ))}
          {(p.buildSlots ?? []).length < MAX_BUILD_SLOTS && !showAddBuild && (
            <button onClick={() => setShowAddBuild(true)} className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-400 hover:bg-white/10">
              + Nouveau
            </button>
          )}
          <span className="ml-auto text-[10px] text-slate-600">{(p.buildSlots ?? []).length}/{MAX_BUILD_SLOTS}</span>
        </div>
        {showAddBuild && (
          <div className="mt-2 space-y-2 rounded-lg bg-black/30 p-2">
            <div className="flex flex-wrap gap-1">
              {BUILD_ICONS.map((ic) => (
                <button key={ic} onClick={() => setBuildIcon(ic)} className={`rounded px-1.5 py-1 text-sm leading-none ${buildIcon === ic ? 'bg-indigo-500/50 ring-1 ring-indigo-300' : 'bg-black/30 hover:bg-white/10'}`}>{ic}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={buildName}
                onChange={(e) => setBuildName(e.target.value.slice(0, 20))}
                placeholder="Nom du build (ex: DPS, Tank...)"
                className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-400/60"
              />
              <button onClick={saveBuild} className="shrink-0 rounded bg-indigo-500/40 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500/60">OK</button>
              <button onClick={() => { setShowAddBuild(false); setBuildName(''); }} className="shrink-0 rounded bg-slate-700/50 px-2 py-1.5 text-sm hover:bg-slate-700">✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
