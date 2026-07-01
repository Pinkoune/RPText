import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { addItem, canEquip } from '../../game/player';

// Stock de la boutique : id -> prix d'achat (≈ 2.2× la valeur de revente).
const STOCK: Record<string, number> = {
  // Consommables
  potion: 30,
  hi_potion: 100,
  
  // Matériaux de base & Artisanat
  wood: 10,
  stone: 10,
  iron_ore: 25,
  herb: 15,
  iron_ingot: 60,
  sturdy_leather: 40,
  refined_wood: 70,

  // Armes
  iron_blade: 130, // mêlée
  arcane_staff: 150, // magie
  iron_spear: 200, // mêlée
  frost_glaive: 480, // mêlée
  frost_scepter: 500, // magie
  
  // Armures & Bijoux
  cloth_robe: 30,
  iron_mail: 150,
  steel_plate: 400,
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
    toast(`Acheté : ${item(id)!.name}.`, 'good');
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Or disponible : <b>{p.gold} 🪙</b></p>
      {Object.entries(STOCK).filter(([id]) => item(id)!.slot !== 'weapon' || canEquip(p, item(id)!)).map(([id, price]) => {
        const it = item(id)!;
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
