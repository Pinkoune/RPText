import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { addItem, canEquip } from '../../game/player';
import type { ItemDef } from '../../game/types';
import { ensureQuestPeriods } from '../../game/quests';

// Stock de la boutique simplifié (façon EPIC RPG)
const STOCK: Record<string, number> = {
  // Consommables & Divers
  potion: 30,
  hi_potion: 100,
  dungeon_key: 5000,
  lootbox: 500,
  
  // Matériaux de base
  wood: 10,
  stone: 10,
  herb: 15,

  // Stuffs de base (Tier 1)
  rusty_sword: 30,
  apprentice_wand: 30,
  cloth_robe: 30,
};

const LIMITS: Record<string, number> = {
  wood: 10,
  stone: 10,
  herb: 10,
  lootbox: 2,
};

export default function ShopCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function buy(id: string, price: number) {
    const limit = LIMITS[id];
    let ok = true;
    mutate((d) => {
      ensureQuestPeriods(d);
      const c = d.quests.daily.counters;
      const bought = c[`shop_buy_${id}`] ?? 0;
      if (limit !== undefined && bought >= limit) {
        ok = false;
        return;
      }
      if (d.gold < price) {
        ok = false;
        return;
      }
      d.gold -= price;
      if (limit !== undefined) {
        c[`shop_buy_${id}`] = bought + 1;
      }
      addItem(d, id, 1);
    });
    if (!ok) {
      if (p!.gold < price) toast('Pas assez d\'or.', 'bad');
      else toast('Limite journalière atteinte.', 'bad');
      return;
    }
    toast(`Acheté : ${item(id)!.name}.`, 'good');
  }

  function getStatsStr(it: ItemDef) {
    const parts = [];
    if (it.atk) parts.push(`🗡️+${it.atk}`);
    if (it.def) parts.push(`🛡️+${it.def}`);
    if (it.hp && it.slot === 'armor') parts.push(`❤️+${it.hp}`);
    if (it.hp && it.slot === 'consumable') parts.push(`🧪+${it.hp} PV`);
    return parts.length ? parts.join(' ') : null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Or disponible : <b>{p.gold} 🪙</b></p>
      {Object.entries(STOCK).filter(([id]) => item(id)!.slot !== 'weapon' || canEquip(p, item(id)!)).map(([id, price]) => {
        const it = item(id)!;
        const statsStr = getStatsStr(it);
        const limit = LIMITS[id];
        const bought = p.quests?.daily?.counters[`shop_buy_${id}`] ?? 0;
        const maxReached = limit !== undefined && bought >= limit;

        return (
          <div key={id} className="flex items-center gap-2 rounded-lg border-l-2 bg-black/25 p-2" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>{it.icon} {it.name}</span>
                {limit !== undefined && (
                  <span className={`text-[10px] px-1.5 rounded ${maxReached ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'}`}>
                    {bought}/{limit}
                  </span>
                )}
                {statsStr && <span className="text-[10px] bg-black/40 px-1.5 rounded text-amber-200">{statsStr}</span>}
                {it.classes && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">{it.classes.join(', ')}</span>}
              </div>
              <div className="truncate text-[11px] text-slate-400">{it.desc}</div>
            </div>
            <button
              onClick={() => buy(id, price)}
              disabled={p.gold < price || maxReached}
              className="shrink-0 rounded bg-amber-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/50 disabled:opacity-40"
            >
              {price} 🪙
            </button>
          </div>
        );
      })}
    </div>
  );
}
