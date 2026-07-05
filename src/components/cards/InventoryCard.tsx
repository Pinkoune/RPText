import { useState, useMemo } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats, removeItem, equipItem, getEquipError, addItem } from '../../game/player';
import type { ItemSlot } from '../../game/types';
import ItemIcon from '../ItemIcon';

type Group = ItemSlot | 'all' | 'profession';

const GROUPS: { slot: Group; label: string; icon: string }[] = [
  { slot: 'all', label: 'Tout', icon: '📋' },
  { slot: 'material', label: 'Ressources', icon: '🧱' },
  { slot: 'consumable', label: 'Consommables', icon: '🍲' },
  { slot: 'armor', label: 'Armures', icon: '🛡️' },
  { slot: 'weapon', label: 'Armes', icon: '⚔️' },
  { slot: 'trinket', label: 'Bijoux', icon: '💍' },
  { slot: 'profession', label: 'Métier', icon: '🧰' },
];

// Consommables « passifs » : utilisés automatiquement ou depuis une autre carte
// (forge/équipement), pas via un bouton Utiliser dans l'inventaire.
const NON_USABLE = new Set(['dungeon_key', 'repair_kit', 'upgrade_matrix']);

export default function InventoryCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const windows = useUi((s) => s.windows);

  const [group, setGroup] = useState<Group>('all');
  const [sellTarget, setSellTarget] = useState<{ id: string; max: number } | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'value' | 'qty'>('rarity');

  if (!p) return null;

  const entries = Object.entries(p.inventory).filter(([id, q]) => item(id)! && q > 0);

  const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  const filteredEntries = useMemo(() => {
    let list = entries;
    if (group === 'profession') list = entries.filter(([id]) => { const s = item(id)?.slot; return s === 'tool' || s === 'profession_armor'; });
    else if (group !== 'all') list = entries.filter(([id]) => item(id)?.slot === group);

    const q = search.trim().toLowerCase();
    if (q) list = list.filter(([id]) => item(id)!.name.toLowerCase().includes(q));

    const sorted = [...list];
    sorted.sort((a, b) => {
      const ia = item(a[0])!, ib = item(b[0])!;
      if (sortBy === 'name') return ia.name.localeCompare(ib.name);
      if (sortBy === 'value') return ib.value - ia.value;
      if (sortBy === 'qty') return b[1] - a[1];
      // rareté (défaut) puis nom
      const r = (RARITY_ORDER[ia.rarity] ?? 9) - (RARITY_ORDER[ib.rarity] ?? 9);
      return r !== 0 ? r : ia.name.localeCompare(ib.name);
    });
    return sorted;
  }, [entries, group, search, sortBy]);

  const byGroupCount = useMemo(() => {
    const map: Record<string, number> = { all: entries.length, profession: 0 };
    for (const [id] of entries) {
      const slot = item(id)?.slot ?? 'material';
      map[slot] = (map[slot] ?? 0) + 1;
      if (slot === 'tool' || slot === 'profession_armor') map.profession++;
    }
    return map;
  }, [entries]);

  function equip(id: string) {
    const it = item(id)!;
    const err = getEquipError(p!, it);
    if (err) {
      toast(err, 'bad');
      return;
    }
    mutate((d) => { equipItem(d, id); });
    toast(`${it.name} équipé.`, 'good');
  }

  function use(id: string) {
    const inCombat = useGame.getState().inCombat;
    if (inCombat) {
      toast("Impossible d'utiliser des objets depuis l'inventaire pendant un combat !", "bad");
      return;
    }
    const it = item(id)!;
    mutate((d) => {
      removeItem(d, id);
      if (id === 'lootbox') {
        const randomLoot = ['iron_ore', 'stone', 'wood', 'herb', 'potion', 'rusty_sword', 'cloth_robe', 'dungeon_key', 'repair_kit', 'upgrade_matrix'];
        const lootId = randomLoot[Math.floor(Math.random() * randomLoot.length)];
        addItem(d, lootId, 1);
        toast(`Lootbox ouverte ! Obtenu : ${item(lootId)!.name}.`, 'good');
      } else if (id.startsWith('bait_')) {
        if (!d.activeBuffs) d.activeBuffs = [];
        // Remove existing bait buff if any
        d.activeBuffs = d.activeBuffs.filter(b => !b.id.startsWith('bait_'));
        // Add new bait for 10 minutes
        d.activeBuffs.push({ id, expiresAt: Date.now() + 10 * 60 * 1000 });
        toast(`${it.name} utilisé ! Attire des monstres spécifiques pendant 10min.`, 'good');
      } else {
        const max = deriveStats(d).maxHp;
        d.hp = Math.min(max, d.hp + (it.hp ?? 0));
        toast(`${it.name} utilisé (+${it.hp} PV).`, 'good');
      }
    });
  }

  const isLocked = (id: string) => p!.lockedItems?.includes(id) ?? false;
  function toggleLock(id: string) {
    mutate((d) => {
      if (!d.lockedItems) d.lockedItems = [];
      const i = d.lockedItems.indexOf(id);
      if (i >= 0) d.lockedItems.splice(i, 1);
      else d.lockedItems.push(id);
    });
  }

  function openSell(id: string, max: number) {
    if (isLocked(id)) { toast('Objet verrouillé 🔒 — déverrouille-le pour le vendre.', 'bad'); return; }
    setSellTarget({ id, max });
    setSellQty(1);
  }

  function confirmSell() {
    if (!sellTarget) return;
    const { id } = sellTarget;
    const it = item(id)!;
    const n = Math.max(1, Math.min(sellQty, sellTarget.max));
    const gain = it.value * n;
    mutate((d) => {
      if (removeItem(d, id, n)) {
        d.gold += gain;
        // L'exemplaire est détruit : on purge ses stats/runes d'instance.
        delete d.gearStars[id];
        delete d.gearDurability[id];
        if (d.enchants) delete d.enchants[id];
      }
    });
    toast(`Vendu : ${it.name} ×${n} (+${gain} 🪙).`, 'gold');
    setSellTarget(null);
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">Ton sac est vide. Va chasser (hunt) !</p>;
  }

  return (
    <div className="space-y-2">
      {/* Recherche + tri */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sky-400/50"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="shrink-0 rounded-lg bg-black/30 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-400/50"
        >
          <option value="rarity">Rareté</option>
          <option value="value">Valeur</option>
          <option value="qty">Quantité</option>
          <option value="name">A→Z</option>
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {GROUPS.map((g) => {
          const count = byGroupCount[g.slot] ?? 0;
          if (count === 0 && g.slot !== 'all') return null;
          return (
            <button
              key={g.slot}
              onClick={() => setGroup(g.slot)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                group === g.slot ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'
              }`}
            >
              {g.icon} {g.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {filteredEntries.map(([id, qty]) => {
          const it = item(id)!;
          const equippable = it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'trinket' || it.slot === 'tool' || it.slot === 'profession_armor';
          const equipErr = equippable ? getEquipError(p, it) : null;
          const isEquipped = Object.values(p.equipped).includes(id);
          const stars = p.gearStars?.[id] ?? 0;
          return (
            <div key={id} className="flex flex-col gap-2 rounded-lg border-l-2 bg-black/25 p-2" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
              <div className="flex gap-2">
                <ItemIcon id={id} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-sm leading-tight" style={{ color: RARITY_COLOR[it.rarity] }}>
                      {it.name}
                    </span>
                    {stars > 0 && <span className="text-[11px] leading-none text-yellow-400" title={`${stars}★ (+${stars * 10}% stats)`}>{'★'.repeat(stars)}</span>}
                    {qty > 1 && <span className="text-xs font-bold text-slate-400">×{qty}</span>}
                    <span className="text-[10px] font-medium text-amber-200 bg-amber-500/20 px-1 rounded flex items-center">
                      {it.value} 🪙
                    </span>
                  </div>
                  {(it.atk || it.def || it.hp) && (
                    <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {it.atk ? `ATK+${it.atk} ` : ''}{it.def ? `DEF+${it.def} ` : ''}{it.hp ? `PV+${it.hp} ` : ''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleLock(id)}
                  title={isLocked(id) ? 'Déverrouiller' : 'Verrouiller (anti-vente)'}
                  className="shrink-0 text-xs self-start opacity-70 hover:opacity-100"
                >
                  {isLocked(id) ? '🔒' : '🔓'}
                </button>
              </div>

              {equipErr && (
                <div className="text-[10px] text-red-400 leading-tight">({equipErr})</div>
              )}

              <div className="flex flex-wrap gap-1 mt-auto">
                {it.slot === 'consumable' && !NON_USABLE.has(id) && (
                  <button onClick={() => use(id)} className="flex-1 rounded bg-emerald-500/30 px-2 py-1.5 text-[11px] font-semibold hover:bg-emerald-500/50">
                    Utiliser
                  </button>
                )}
                {equippable && !isEquipped && !equipErr && (
                  <button onClick={() => equip(id)} className="flex-1 rounded bg-sky-500/30 px-2 py-1.5 text-[11px] font-semibold hover:bg-sky-500/50">
                    Équiper
                  </button>
                )}
                {!isLocked(id) && (
                  <button onClick={() => openSell(id, qty)} className="flex-1 rounded bg-amber-500/25 px-2 py-1.5 text-[11px] font-semibold hover:bg-amber-500/45">
                    Vendre
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale de vente : quantité si >1, simple validation si 1 */}
      {sellTarget && (() => {
        const it = item(sellTarget.id)!;
        const n = Math.max(1, Math.min(sellQty, sellTarget.max));
        const total = it.value * n;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSellTarget(null)}>
            <div className="w-full max-w-xs rounded-2xl glass p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center gap-2">
                <ItemIcon id={sellTarget.id} size={28} />
                <div className="min-w-0">
                  <div className="truncate font-semibold" style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</div>
                  <div className="text-[11px] text-slate-400">{it.value} 🪙 l'unité{sellTarget.max > 1 ? ` · ${sellTarget.max} en stock` : ''}</div>
                </div>
              </div>

              {sellTarget.max > 1 ? (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSellQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-lg bg-black/40 text-lg hover:bg-white/10">−</button>
                    <input
                      type="range" min={1} max={sellTarget.max} value={n}
                      onChange={(e) => setSellQty(Number(e.target.value))}
                      className="flex-1 accent-amber-400"
                    />
                    <button onClick={() => setSellQty((q) => Math.min(sellTarget.max, q + 1))} className="grid h-10 w-10 place-items-center rounded-lg bg-black/40 text-lg hover:bg-white/10">+</button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <button onClick={() => setSellQty(sellTarget.max)} className="rounded bg-black/40 px-2 py-1 text-xs hover:bg-white/10">Tout ({sellTarget.max})</button>
                    <span className="font-bold tabular-nums">Vendre {n} → <span className="text-amber-300">+{total} 🪙</span></span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-300">Vendre cet objet pour <span className="font-bold text-amber-300">+{total} 🪙</span> ?</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setSellTarget(null)} className="rounded-lg bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/20">Annuler</button>
                <button onClick={confirmSell} className="rounded-lg bg-amber-500/40 py-2.5 text-sm font-bold hover:bg-amber-500/60">Vendre</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
