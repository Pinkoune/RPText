import { useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats, equipItem, unequipItem, canEquip } from '../../game/player';
import { RECIPES, getCraftLevel } from '../../game/crafting';
import type { ItemDef, ItemSlot } from '../../game/types';
import ItemIcon from '../ItemIcon';

const SLOTS: { slot: 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor'; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
  { slot: 'tool', label: 'Outil', icon: '🪓' },
  { slot: 'profession_armor', label: 'Tenue de Métier', icon: '🎽' },
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

/** Petit chip jaune "+X" : bonus de stat apporté par les étoiles d'amélioration. */
function starBonusChip(bonus: number) {
  if (bonus <= 0) return null;
  return <span className="ml-1 rounded bg-yellow-400 px-1 text-[9px] font-bold text-black" title={`+${bonus} grâce aux étoiles d'amélioration`}>+{bonus}</span>;
}

/** Badges de stats/type d'un objet (icône + mot, fond coloré) — même langage visuel que la forge.
 *  `stars` (0-5) affiche en plus le bonus d'amélioration (+10%/étoile) via un chip jaune. */
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

/** Badges "type" : élément + type de dégâts. */
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

const UPGRADE_CHANCE = ['100%', '90%', '75%', '60%', '40%'];

type SlotKey = 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor';

export default function EquipmentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [openBag, setOpenBag] = useState<SlotKey | null>(null);
  if (!p) return null;

  const stats = deriveStats(p);

  function equip(id: string) {
    mutate((d) => { equipItem(d, id); });
    toast(`${item(id)!.name} équipé.`, 'good');
  }
  function unequip(slot: 'weapon' | 'armor' | 'trinket' | 'tool' | 'profession_armor') {
    mutate((d) => { unequipItem(d, slot); });
  }
  function repair(id: string, max: number) {
    if ((p!.inventory['repair_kit'] || 0) < 1) {
      toast("Tu n'as pas de kit de réparation.", 'bad');
      return;
    }
    mutate((d) => {
      d.inventory['repair_kit'] -= 1;
      if (!d.gearDurability) d.gearDurability = {};
      d.gearDurability[id] = max;
    });
    toast('Équipement réparé !', 'good');
  }
  function upgrade(id: string) {
    if ((p!.inventory['upgrade_matrix'] || 0) < 1) {
      toast("Tu n'as pas de matrice d'amélioration.", 'bad');
      return;
    }
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

  // Objets équipables possédés, par slot.
  const owned = (slot: ItemSlot) =>
    Object.entries(p.inventory).filter(([id, q]) => item(id) && item(id)!.slot === slot && q > 0);

  const setIdsCount: Record<string, number> = {};
  for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
    const eqId = p.equipped[slot];
    const it = eqId ? item(eqId) : null;
    if (it && it.setId && eqId && (p.gearDurability?.[eqId] ?? 1) > 0) {
      setIdsCount[it.setId] = (setIdsCount[it.setId] || 0) + 1;
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats résultantes */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-lg bg-emerald-500/10 py-3"><div className="text-[10px] text-emerald-300/80">❤️ PV</div><div className="mt-0.5 text-lg font-bold text-emerald-200">{stats.maxHp}</div></div>
        <div className="rounded-lg bg-rose-500/10 py-3"><div className="text-[10px] text-rose-300/80">🗡️ ATK</div><div className="mt-0.5 text-lg font-bold text-rose-200">{stats.atk}</div></div>
        <div className="rounded-lg bg-sky-500/10 py-3"><div className="text-[10px] text-sky-300/80">🛡️ DEF</div><div className="mt-0.5 text-lg font-bold text-sky-200">{stats.def}</div></div>
      </div>

      {SLOTS.map(({ slot, label, icon }) => {
        const equippedId = p.equipped[slot];
        const eq = equippedId ? item(equippedId)! : null;
        const candidates = owned(slot).filter(([id]) => id !== equippedId && canEquip(p, item(id)!));
        const stars = equippedId ? (p.gearStars?.[equippedId] || 0) : 0;
        const dur = equippedId ? (p.gearDurability?.[equippedId] ?? eq?.maxDurability ?? 0) : 0;
        const durMax = eq?.maxDurability ?? 0;
        const durRatio = durMax ? dur / durMax : 1;
        const durColor = durRatio <= 0 ? '#ef4444' : durRatio < 0.25 ? '#f97316' : durRatio < 0.6 ? '#eab308' : '#22c55e';
        const badges = [...statBadges(eq, stars), ...typeBadges(eq)];
        return (
          <div key={slot} className="rounded-xl bg-black/25 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{icon} {label}</span>
              {eq && (
                <button onClick={() => unequip(slot)} className="rounded bg-rose-500/25 px-2 py-0.5 text-[11px] hover:bg-rose-500/45">Retirer</button>
              )}
            </div>

            {eq ? (
              <>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium" style={{ color: RARITY_COLOR[eq.rarity] }}>
                  <ItemIcon id={equippedId!} size={24} />
                  <span className="truncate">{eq.name}</span>
                  {stars > 0 && <span className="text-yellow-400 text-xs">{'★'.repeat(stars)}</span>}
                </div>

                {badges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    {badges.map((bd, i) => (
                      <span key={i} className={`rounded px-2 py-1 ${bd.cls}`}>{bd.txt}</span>
                    ))}
                  </div>
                )}

                {/* Durabilité */}
                {durMax > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className={dur === 0 ? 'text-red-400 font-bold' : ''}>🔧 Durabilité {dur} / {durMax}</span>
                      {dur < durMax && (
                        <button onClick={() => repair(equippedId!, durMax)} className="rounded bg-orange-500/25 px-2 py-0.5 hover:bg-orange-500/45">
                          Réparer 🛠️{p.inventory['repair_kit'] || 0}
                        </button>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, durRatio * 100)}%`, background: durColor }} />
                    </div>
                  </div>
                )}

                {/* Amélioration (étoiles) */}
                {durMax > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-purple-500/10 px-3 py-2">
                    <span className="text-[11px] text-purple-200">
                      Étoiles <span className="text-yellow-400">{'★'.repeat(stars)}</span><span className="text-slate-600">{'★'.repeat(5 - stars)}</span>
                      <span className="ml-1 text-slate-400">(+{stars * 10}% stats)</span>
                    </span>
                    {stars < 5 ? (
                      <button onClick={() => upgrade(equippedId!)} className="inline-flex items-center gap-1 rounded bg-purple-500/30 px-2 py-0.5 text-[11px] hover:bg-purple-500/50">
                        Améliorer {UPGRADE_CHANCE[stars]} <ItemIcon id="upgrade_matrix" size={13} />{p.inventory['upgrade_matrix'] || 0}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-yellow-400">MAX</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1 text-sm italic text-slate-500">— vide —</div>
            )}

            {candidates.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <button
                  onClick={() => setOpenBag(openBag === slot ? null : slot)}
                  className="flex w-full items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-black/40"
                >
                  <span className="uppercase tracking-wide text-slate-400">🎒 Dans l'inventaire ({candidates.length})</span>
                  <span className="text-slate-500">{openBag === slot ? '▲ Masquer' : '▼ Changer'}</span>
                </button>
                {openBag === slot && candidates.map(([id, q]) => {
                  const it = item(id)!;
                  const cb = statBadges(it, p.gearStars?.[id] || 0);
                  
                  let reqReason: string | null = null;
                  const craftLvl = getCraftLevel(p.craftXp).level;
                  const recipe = RECIPES.find(x => x.output === it.id);
                  if (recipe && craftLvl < recipe.levelReq) {
                    reqReason = `Artis. Niv ${recipe.levelReq} requis`;
                  } else if (!recipe && it.reqLevel && p.level < it.reqLevel) {
                    reqReason = `Niv ${it.reqLevel} requis`;
                  }

                  return (
                    <div key={id} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${reqReason ? 'bg-red-950/40 opacity-75' : 'bg-black/30'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <ItemIcon id={id} size={20} className={reqReason ? 'grayscale' : ''} />
                          <span className="truncate" style={{ color: reqReason ? '#7f1d1d' : RARITY_COLOR[it.rarity] }}>{it.name}</span>
                          {(p.gearStars?.[id] || 0) > 0 && <span className="text-[10px] leading-none text-yellow-400" title={`${p.gearStars![id]}★`}>{'★'.repeat(p.gearStars![id])}</span>}
                          {q > 1 && <span className="text-[10px] text-slate-500">×{q}</span>}
                        </div>
                        {cb.length > 0 && (
                          <div className={`mt-1 flex flex-wrap gap-1.5 text-[10px] ${reqReason ? 'opacity-50' : ''}`}>
                            {cb.map((bd, i) => (
                              <span key={i} className={`rounded px-2 py-1 ${bd.cls}`}>{bd.txt}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {reqReason ? (
                        <div className="shrink-0 text-[10px] font-bold text-red-400 max-w-[80px] text-right">
                          {reqReason}
                        </div>
                      ) : (
                        <button onClick={() => equip(id)} className="shrink-0 rounded bg-sky-500/30 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500/50">Équiper</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bonus de Sets Actifs */}
      <div className="rounded-xl bg-black/25 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">✦ Bonus de Sets (3 pièces)</h3>
        {Object.entries(SET_BONUSES).map(([setId, info]) => {
          const count = setIdsCount[setId] || 0;
          if (count === 0) return null;
          const isActive = count >= 3;
          return (
            <div key={setId} className="mb-2.5">
              <div className={`flex justify-between text-sm ${isActive ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                <span>{isActive ? '✅ ' : ''}{info.name} ({count}/3)</span>
                <span className="text-[11px]">{info.desc}</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-500'}`} style={{ width: `${Math.min(100, (count / 3) * 100)}%` }} />
              </div>
            </div>
          );
        })}
        {Object.keys(setIdsCount).length === 0 && (
          <div className="text-sm text-slate-500 italic">Aucun set équipé.</div>
        )}
      </div>
    </div>
  );
}
