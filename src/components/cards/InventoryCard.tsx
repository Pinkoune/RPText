import { useGame } from '../../store/gameStore';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { deriveStats, removeItem } from '../../game/player';

export default function InventoryCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const entries = Object.entries(p.inventory).filter(([id, q]) => ITEMS[id] && q > 0);

  function equip(id: string) {
    const it = ITEMS[id];
    const slot = it.slot as 'weapon' | 'armor' | 'trinket';
    mutate((d) => {
      const prev = d.equipped[slot];
      d.equipped[slot] = id;
      removeItem(d, id);
      if (prev) d.inventory[prev] = (d.inventory[prev] ?? 0) + 1;
    });
    toast(`${it.name} équipé.`, 'good');
  }

  function use(id: string) {
    const it = ITEMS[id];
    mutate((d) => {
      const max = deriveStats(d).maxHp;
      removeItem(d, id);
      d.hp = Math.min(max, d.hp + (it.hp ?? 0));
    });
    toast(`${it.name} utilisé (+${it.hp} PV).`, 'good');
  }

  function sell(id: string) {
    const it = ITEMS[id];
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
      {entries.map(([id, qty]) => {
        const it = ITEMS[id];
        const equippable = it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'trinket';
        const isEquipped = Object.values(p.equipped).includes(id);
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg border-l-2 bg-black/25 p-2" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>
                  {it.icon} {it.name}
                </span>
                <span className="text-xs text-slate-500">×{qty}</span>
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {it.atk ? `ATK+${it.atk} ` : ''}{it.def ? `DEF+${it.def} ` : ''}{it.hp ? `PV+${it.hp} ` : ''}· {it.value}🪙
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              {it.slot === 'consumable' && (
                <button onClick={() => use(id)} className="rounded bg-emerald-500/30 px-2 py-1 text-xs hover:bg-emerald-500/50">
                  Utiliser
                </button>
              )}
              {equippable && !isEquipped && (
                <button onClick={() => equip(id)} className="rounded bg-sky-500/30 px-2 py-1 text-xs hover:bg-sky-500/50">
                  Équiper
                </button>
              )}
              <button onClick={() => sell(id)} className="rounded bg-amber-500/25 px-2 py-1 text-xs hover:bg-amber-500/45">
                Vendre
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
