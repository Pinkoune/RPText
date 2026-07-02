import { useState, useMemo } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats, removeItem, equipItem, canEquip } from '../../game/player';
import type { ItemSlot } from '../../game/types';

const GROUPS: { slot: ItemSlot | 'all'; label: string; icon: string }[] = [
  { slot: 'all', label: 'Tout', icon: '📋' },
  { slot: 'material', label: 'Ressources', icon: '🧱' },
  { slot: 'consumable', label: 'Consommables', icon: '🍲' },
  { slot: 'armor', label: 'Armures', icon: '🛡️' },
  { slot: 'weapon', label: 'Armes', icon: '⚔️' },
  { slot: 'trinket', label: 'Bijoux', icon: '💍' },
];

// Consommables « passifs » : utilisés automatiquement ou depuis une autre carte
// (forge/équipement), pas via un bouton Utiliser dans l'inventaire.
const NON_USABLE = new Set(['dungeon_key', 'repair_kit', 'upgrade_matrix']);

export default function InventoryCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [group, setGroup] = useState<ItemSlot | 'all'>('all');

  if (!p) return null;

  const entries = Object.entries(p.inventory).filter(([id, q]) => item(id)! && q > 0);

  const filteredEntries = useMemo(() => {
    if (group === 'all') return entries;
    return entries.filter(([id]) => item(id)?.slot === group);
  }, [entries, group]);

  const byGroupCount = useMemo(() => {
    const map: Record<string, number> = { all: entries.length };
    for (const [id] of entries) {
      const slot = item(id)?.slot ?? 'material';
      map[slot] = (map[slot] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  function equip(id: string) {
    const it = item(id)!;
    if (!canEquip(p!, it)) {
      toast(`Ta classe ne peut pas équiper ${it.name}.`, 'bad');
      return;
    }
    mutate((d) => { equipItem(d, id); });
    toast(`${it.name} équipé.`, 'good');
  }

  function use(id: string) {
    const it = item(id)!;
    mutate((d) => {
      removeItem(d, id);
      if (id === 'lootbox') {
        const randomLoot = ['iron_ore', 'stone', 'wood', 'herb', 'potion', 'rusty_sword', 'cloth_robe', 'dungeon_key', 'repair_kit', 'upgrade_matrix'];
        const lootId = randomLoot[Math.floor(Math.random() * randomLoot.length)];
        d.inventory[lootId] = (d.inventory[lootId] ?? 0) + 1;
        toast(`Lootbox ouverte ! Obtenu : ${item(lootId)!.name}.`, 'good');
      } else {
        const max = deriveStats(d).maxHp;
        d.hp = Math.min(max, d.hp + (it.hp ?? 0));
        toast(`${it.name} utilisé (+${it.hp} PV).`, 'good');
      }
    });
  }

  function sell(id: string) {
    const it = item(id)!;
    mutate((d) => {
      if (removeItem(d, id)) d.gold += it.value;
    });
    toast(`Vendu : ${it.name} (+${it.value} 🪙).`, 'gold');
  }

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">Ton sac est vide. Va chasser (hunt) !</p>;
  }

  return (
    <div className="space-y-2">
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
      <div className="space-y-2">
        {filteredEntries.map(([id, qty]) => {
          const it = item(id)!;
          const equippable = it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'trinket';
          const wrongClass = equippable && !canEquip(p, it);
          const isEquipped = Object.values(p.equipped).includes(id);
          return (
            <div key={id} className="flex items-center gap-2 rounded-lg border-l-2 bg-black/25 p-2" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>
                    {it.icon} {it.name}
                  </span>
                  <span className="text-xs font-bold text-slate-400">×{qty}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {it.atk ? `ATK+${it.atk} ` : ''}{it.def ? `DEF+${it.def} ` : ''}{it.hp ? `PV+${it.hp} ` : ''}· {it.value}🪙
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {it.slot === 'consumable' && !NON_USABLE.has(id) && (
                  <button onClick={() => use(id)} className="rounded bg-emerald-500/30 px-2 py-1 text-xs hover:bg-emerald-500/50">
                    Utiliser
                  </button>
                )}
                {equippable && !isEquipped && !wrongClass && (
                  <button onClick={() => equip(id)} className="rounded bg-sky-500/30 px-2 py-1 text-xs hover:bg-sky-500/50">
                    Équiper
                  </button>
                )}
                {wrongClass && (
                  <span className="rounded bg-black/30 px-2 py-1 text-[10px] text-slate-500">🔒 autre classe</span>
                )}
                <button onClick={() => sell(id)} className="rounded bg-amber-500/25 px-2 py-1 text-xs hover:bg-amber-500/45">
                  Vendre
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
