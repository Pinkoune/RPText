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
import { item, RARITY_COLOR } from '../../game/items';
import { addItem, removeItem } from '../../game/player';
import ItemIcon from '../ItemIcon';

export default function MarketCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [listings, setListings] = useState<Listing[]>([]);
  // Objets vendables, triés par ordre alphabétique.
  const sellable = useMemo(
    () => (p ? Object.entries(p.inventory)
      .filter(([id, q]) => item(id) && q > 0)
      .sort((a, b) => item(a[0])!.name.localeCompare(item(b[0])!.name)) : []),
    [p?.inventory],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [markup, setMarkup] = useState(1.5);

  useEffect(() => listenMarket(setListings), []);

  // Encaissement auto des ventes (vendeur) + remboursement des annulations.
  useEffect(() => {
    if (!p) return;
    for (const l of listings) {
      if (l.sellerUid !== p.uid || p.settledSales.includes(l.id)) continue;
      if (l.status === 'sold') {
        const net = Math.round(l.price * (1 - MARKET_TAX));
        mutate((d) => { d.gold += net; d.settledSales.push(l.id); });
        toast(`💰 Vendu : ${item(l.itemId)?.name} (+${net} 🪙, taxe ${Math.round(MARKET_TAX * 100)}%)`, 'gold');
      } else if (l.status === 'cancelled') {
        mutate((d) => {
          addItem(d, l.itemId, 1);
          if (l.stars !== undefined) d.gearStars[l.itemId] = l.stars;
          if (l.durability !== undefined) d.gearDurability[l.itemId] = l.durability;
          if (l.enchants?.length) { if (!d.enchants) d.enchants = {}; d.enchants[l.itemId] = l.enchants; }
          d.settledSales.push(l.id);
        });
      }
    }
  }, [listings, p?.uid]);

  if (!p) return null;
  const me = { uid: p.uid, name: p.name };
  const myActive = listings.filter((l) => l.sellerUid === p.uid && l.status === 'active');
  const others = listings.filter((l) => l.status === 'active' && l.sellerUid !== p.uid);
  const slotsLeft = Math.max(0, MAX_LISTINGS - myActive.length);

  function toggle(id: string) {
    if (selected === id) {
      setSelected(null);
      setSellQty(1);
    } else {
      setSelected(id);
      setSellQty(1);
    }
  }

  function sell() {
    if (!marketEnabled) return toast('Marché indisponible en mode local.', 'bad');
    if (p!.level < MARKET_MIN_LEVEL) return toast(`Niveau ${MARKET_MIN_LEVEL} requis pour vendre.`, 'bad');
    if (!selected) return toast('Choisis un objet.', 'bad');
    const have = p!.inventory[selected] ?? 0;
    if (have < sellQty || sellQty <= 0) return toast('Quantité invalide.', 'bad');
    if (slotsLeft < sellQty) return toast(`Maximum ${MAX_LISTINGS} annonces actives. Tu ne peux en faire que ${slotsLeft} autres.`, 'bad');
    
    if (p!.lockedItems?.includes(selected)) return toast('Objet verrouillé 🔒 — déverrouille-le pour le vendre.', 'bad');
    const it = item(selected)!;
    const price = Math.max(it.value, Math.round(it.value * markup));
    // Instance d'équipement : on capture étoiles/durabilité pour les transmettre
    // à l'acheteur, puis on les retire côté vendeur.
    const stars = p!.gearStars?.[selected];
    const durability = p!.gearDurability?.[selected];
    const enchants = p!.enchants?.[selected];
    mutate((d) => {
      removeItem(d, selected, sellQty);
      delete d.gearStars[selected];
      delete d.gearDurability[selected];
      if (d.enchants) delete d.enchants[selected];
    });

    // Créer une annonce pour chaque quantité (car le marché actuel vend à l'unité)
    for (let i = 0; i < sellQty; i++) {
      listItem(me, selected, price, { stars, durability, enchants })
        .then(() => {})
        .catch(() => { mutate((d) => addItem(d, selected, 1)); toast(`Échec pour 1x ${it.name}.`, 'bad'); });
    }

    toast(`${sellQty}x ${it.name} mis en vente (×${markup} valeur).`, 'good');
    setSelected(null);
    setSellQty(1);
  }

  function buy(l: Listing) {
    if (p!.gold < l.price) return toast('Pas assez d\'or.', 'bad');
    mutate((d) => {
      d.gold -= l.price;
      addItem(d, l.itemId, 1); // clé déjà instanciée → conservée telle quelle
      if (l.stars !== undefined) d.gearStars[l.itemId] = l.stars;
      if (l.durability !== undefined) d.gearDurability[l.itemId] = l.durability;
      if (l.enchants?.length) { if (!d.enchants) d.enchants = {}; d.enchants[l.itemId] = l.enchants; }
    });
    buyListing(l, p!.uid).catch((e) => {
      mutate((d) => {
        d.gold += l.price;
        removeItem(d, l.itemId, 1);
        delete d.gearStars[l.itemId];
        delete d.gearDurability[l.itemId];
        if (d.enchants) delete d.enchants[l.itemId];
      });
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

      {/* Vendre (multi-sélection) */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vendre</span>
          <span className="text-[10px] text-slate-500">{slotsLeft} emplacement(s) libre(s)</span>
        </div>
        {sellable.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun objet à vendre dans ton sac.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-lg bg-black/20 p-1.5">
            <div className="grid grid-cols-2 gap-1">
              {sellable.map(([id, q]) => {
                const it = item(id)!;
                const on = selected === id;
                return (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    title={`Valeur ${it.value} 🪙`}
                    className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition ${on ? 'bg-amber-500/30 ring-1 ring-amber-400/60' : 'bg-black/30 hover:bg-white/10'}`}
                  >
                    <ItemIcon id={id} size={18} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</span>
                    <span className="shrink-0 text-slate-500">×{q}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Qté :</span>
          <input
            type="number" min={1} max={selected ? (p!.inventory[selected] ?? 1) : 1} step={1}
            value={sellQty}
            onChange={(e) => setSellQty(Math.max(1, Math.min(Number(e.target.value) || 1, selected ? (p!.inventory[selected] ?? 1) : 1)))}
            className="w-14 rounded-lg bg-black/40 px-2 py-1 text-right outline-none"
            disabled={!selected}
          />
          <span className="text-slate-400 ml-2">Prix = val. ×</span>
          <input
            type="number" min={1} step={0.5}
            value={markup}
            onChange={(e) => setMarkup(Math.max(1, Number(e.target.value) || 1))}
            className="w-14 rounded-lg bg-black/40 px-2 py-1 text-right outline-none"
          />
          <button
            onClick={sell}
            disabled={!selected || sellQty > slotsLeft}
            className="ml-auto rounded-lg bg-amber-500/30 px-3 py-1.5 font-semibold hover:bg-amber-500/50 disabled:opacity-40"
          >
            Vendre {selected ? `(${sellQty})` : ''}
          </button>
        </div>
      </div>

      {/* Mes annonces */}
      {myActive.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Mes annonces</div>
          {myActive.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5" style={{ color: RARITY_COLOR[item(l.itemId)!.rarity] }}><ItemIcon id={l.itemId} size={18} /> {item(l.itemId)!.name}{l.stars ? <span className="text-yellow-400">{'★'.repeat(l.stars)}</span> : null}</span>
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
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <ItemIcon id={l.itemId} size={18} />
                  <span style={{ color: RARITY_COLOR[item(l.itemId)!.rarity] }}>{item(l.itemId)!.name}{l.stars ? <span className="text-yellow-400">{'★'.repeat(l.stars)}</span> : null}</span>
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
