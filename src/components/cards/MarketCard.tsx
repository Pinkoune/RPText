import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  listenMarket,
  listItem,
  buyListing,
  cancelListing,
  marketEnabled,
  MARKET_TAX,
  MAX_LISTINGS,
  MARKET_MIN_LEVEL,
  type Listing,
} from '../../firebase/marketService';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { addItem, removeItem } from '../../game/player';

export default function MarketCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [listings, setListings] = useState<Listing[]>([]);
  const sellable = useMemo(
    () => (p ? Object.entries(p.inventory).filter(([id, q]) => ITEMS[id] && q > 0) : []),
    [p?.inventory],
  );
  const [sel, setSel] = useState('');
  const [price, setPrice] = useState(0);

  useEffect(() => listenMarket(setListings), []);

  // Encaissement auto des ventes (vendeur) + remboursement des annulations.
  useEffect(() => {
    if (!p) return;
    for (const l of listings) {
      if (l.sellerUid !== p.uid || p.settledSales.includes(l.id)) continue;
      if (l.status === 'sold') {
        const net = Math.round(l.price * (1 - MARKET_TAX));
        mutate((d) => { d.gold += net; d.settledSales.push(l.id); });
        toast(`💰 Vendu : ${ITEMS[l.itemId]?.name} (+${net} 🪙, taxe ${Math.round(MARKET_TAX * 100)}%)`, 'gold');
      } else if (l.status === 'cancelled') {
        mutate((d) => { addItem(d, l.itemId, 1); d.settledSales.push(l.id); });
      }
    }
  }, [listings, p?.uid]);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name };
  const myActive = listings.filter((l) => l.sellerUid === p.uid && l.status === 'active');
  const others = listings.filter((l) => l.status === 'active' && l.sellerUid !== p.uid);
  const selItem = sel && ITEMS[sel] ? ITEMS[sel] : null;
  const minPrice = selItem ? selItem.value : 1;

  function sell() {
    if (!marketEnabled) return toast('Marché indisponible en mode local.', 'bad');
    if (p!.level < MARKET_MIN_LEVEL) return toast(`Niveau ${MARKET_MIN_LEVEL} requis pour vendre.`, 'bad');
    if (!selItem) return toast('Choisis un objet.', 'bad');
    if ((p!.inventory[sel] ?? 0) < 1) return toast('Tu ne possèdes plus cet objet.', 'bad');
    if (myActive.length >= MAX_LISTINGS) return toast(`Maximum ${MAX_LISTINGS} annonces actives.`, 'bad');
    if (price < minPrice) return toast(`Prix minimum : ${minPrice} 🪙 (valeur de l'objet).`, 'bad');
    mutate((d) => { removeItem(d, sel, 1); });
    listItem(me, sel, price)
      .then(() => toast('Objet mis en vente.', 'good'))
      .catch(() => { mutate((d) => addItem(d, sel, 1)); toast('Échec de la mise en vente.', 'bad'); });
  }

  function buy(l: Listing) {
    if (p!.gold < l.price) return toast('Pas assez d\'or.', 'bad');
    mutate((d) => { d.gold -= l.price; addItem(d, l.itemId, 1); });
    buyListing(l, p!.uid).catch((e) => {
      mutate((d) => { d.gold += l.price; removeItem(d, l.itemId, 1); });
      toast(`Achat impossible (${e.message}).`, 'bad');
    });
  }

  return (
    <div className="space-y-3">
      <p className="rounded bg-black/25 px-2 py-1.5 text-[11px] text-slate-300">
        Marché entre joueurs. Taxe de <b>{Math.round(MARKET_TAX * 100)}%</b> à la vente,
        max <b>{MAX_LISTINGS}</b> annonces, niveau <b>{MARKET_MIN_LEVEL}</b>+. Or : <b>{p.gold} 🪙</b>
      </p>

      {!marketEnabled && (
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : configure Firebase pour commercer avec de vrais joueurs.
        </p>
      )}

      {/* Vendre */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Vendre un objet</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sel}
            onChange={(e) => { setSel(e.target.value); const it = ITEMS[e.target.value]; if (it) setPrice(it.value); }}
            className="min-w-0 flex-1 rounded-lg bg-black/40 px-2 py-1.5 text-sm outline-none"
          >
            <option value="">— objet —</option>
            {sellable.map(([id, q]) => (
              <option key={id} value={id}>{ITEMS[id].name} ×{q}</option>
            ))}
          </select>
          <input
            type="number"
            min={minPrice}
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 rounded-lg bg-black/40 px-2 py-1.5 text-right text-sm outline-none"
          />
          <button onClick={sell} className="rounded-lg bg-amber-500/30 px-3 py-1.5 text-sm font-semibold hover:bg-amber-500/50">
            Vendre
          </button>
        </div>
        {selItem && <div className="mt-1 text-[11px] text-slate-500">Prix minimum : {minPrice} 🪙</div>}
      </div>

      {/* Mes annonces */}
      {myActive.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Mes annonces</div>
          {myActive.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
              <span style={{ color: RARITY_COLOR[ITEMS[l.itemId].rarity] }}>{ITEMS[l.itemId].icon} {ITEMS[l.itemId].name}</span>
              <span className="flex items-center gap-2">
                <span className="text-slate-300">{l.price} 🪙</span>
                <button onClick={() => cancelListing(l.id)} className="rounded bg-rose-500/30 px-2 py-1 text-xs hover:bg-rose-500/50">Retirer</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Annonces des autres */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">À vendre · {others.length}</div>
        {others.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune offre pour l'instant.</p>
        ) : (
          <div className="space-y-1.5">
            {others.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span style={{ color: RARITY_COLOR[ITEMS[l.itemId].rarity] }}>{ITEMS[l.itemId].icon} {ITEMS[l.itemId].name}</span>
                  <span className="ml-1 text-[11px] text-slate-500">par {l.sellerName}</span>
                </span>
                <button
                  onClick={() => buy(l)}
                  disabled={p.gold < l.price}
                  className="shrink-0 rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-40"
                >
                  {l.price} 🪙
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
