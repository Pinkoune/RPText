import { useGame } from '../../store/gameStore';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { addItem } from '../../game/player';

// Stock de la boutique : id -> prix d'achat (≈ 2.2× la valeur de revente).
const STOCK: Record<string, number> = {
  potion: 30,
  hi_potion: 100,
  iron_blade: 130,
  iron_mail: 150,
  frost_glaive: 480,
  frost_plate: 560,
  lucky_coin: 320,
};

export default function ShopCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function buy(id: string, price: number) {
    if (p!.gold < price) {
      toast('Pas assez d\'or.', 'bad');
      return;
    }
    mutate((d) => {
      d.gold -= price;
      addItem(d, id, 1);
    });
    toast(`Acheté : ${ITEMS[id].name}.`, 'good');
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Or disponible : <b>{p.gold} 🪙</b></p>
      {Object.entries(STOCK).map(([id, price]) => {
        const it = ITEMS[id];
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg border-l-2 bg-black/25 p-2" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>{it.icon} {it.name}</div>
              <div className="truncate text-[11px] text-slate-400">{it.desc}</div>
            </div>
            <button
              onClick={() => buy(id, price)}
              disabled={p.gold < price}
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
