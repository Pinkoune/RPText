import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { addItem } from '../../game/player';
import { ensureQuestPeriods } from '../../game/quests';

// Boutique du Destin : seul l'or ne suffit pas ici. On y dépense les Fate Coins,
// gagnés en donjon/boss/quêtes/casino, contre des objets rares et utilitaires.
// Certaines offres sont limitées par semaine pour éviter l'accumulation triviale.
interface Offer {
  id: string;
  price: number;
  /** Limite d'achats par semaine (absent = illimité). */
  weekly?: number;
}

const OFFERS: Offer[] = [
  { id: 'upgrade_matrix', price: 25, weekly: 3 },
  { id: 'dungeon_key', price: 15, weekly: 5 },
  { id: 'lootbox', price: 8 },
  { id: 'phoenix_elixir', price: 12, weekly: 10 },
  { id: 'repair_kit', price: 3 },
];

export default function FateShopCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function buy(o: Offer) {
    let err: string | null = null;
    mutate((d) => {
      ensureQuestPeriods(d);
      const c = d.quests.weekly.counters;
      const key = `fateshop_${o.id}`;
      const bought = c[key] ?? 0;
      if (o.weekly !== undefined && bought >= o.weekly) { err = 'Limite hebdomadaire atteinte.'; return; }
      if (d.fateCoins < o.price) { err = 'Pas assez de Fate Coins.'; return; }
      d.fateCoins -= o.price;
      if (o.weekly !== undefined) c[key] = bought + 1;
      addItem(d, o.id, 1);
    });
    if (err) { toast(err, 'bad'); return; }
    toast(`Acheté : ${item(o.id)!.name}.`, 'good');
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Fate Coins : <b className="text-fuchsia-300">{p.fateCoins} 🎲</b>
        <span className="ml-2 opacity-70">Gagnés en donjon, boss, quêtes et casino.</span>
      </p>
      {OFFERS.map((o) => {
        const it = item(o.id)!;
        const bought = p.quests?.weekly?.counters[`fateshop_${o.id}`] ?? 0;
        const maxed = o.weekly !== undefined && bought >= o.weekly;
        return (
          <div key={o.id} className="flex items-center gap-2 rounded-lg border-l-2 bg-black/25 p-2.5" style={{ borderColor: RARITY_COLOR[it.rarity] }}>
            <span className="text-xl leading-none">{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</span>
                {o.weekly !== undefined && (
                  <span className={`shrink-0 rounded px-1.5 text-[10px] ${maxed ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'}`}>{bought}/{o.weekly} / sem.</span>
                )}
              </div>
              <div className="truncate text-[11px] text-slate-400">{it.desc}</div>
            </div>
            <button
              onClick={() => buy(o)}
              disabled={p.fateCoins < o.price || maxed}
              className="shrink-0 rounded bg-fuchsia-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-fuchsia-500/50 disabled:opacity-40"
            >
              {o.price} 🎲
            </button>
          </div>
        );
      })}
    </div>
  );
}
