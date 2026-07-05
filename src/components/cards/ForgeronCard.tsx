import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { addItem } from '../../game/player';
import { enchantsForEquipped } from '../../game/enchant';
import { isBlacksmithOpen, msToBlacksmithClose, msToBlacksmithOpen } from '../../game/blacksmith';
import ItemIcon from '../ItemIcon';

function fmtMs(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

type Slot = 'weapon' | 'armor' | 'trinket';
const SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
];

// Le forgeron utilise 1 matrice + de l'or pour un renforcement garanti.
// Sans matrice = utiliser l'interface Équipement (risque d'échec, matrice seule).
const REINFORCE_MATRIX_GOLD = [1500, 3000, 6000, 12000, 25000]; // [0→1★, 1→2★, ...]
const REPAIR_PER_POINT = 20; // Réparation à l'or (sans kit) : plus chère qu'un kit
const PURIFY_GOLD = 300;

export default function ForgeronCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!p) return null;

  const open = isBlacksmithOpen() || p.ignoreRestrictions;
  if (!open) {
    return (
      <div className="space-y-3 text-center">
        <div className="rounded-xl bg-black/30 p-4">
          <span className="text-3xl">🔒</span>
          <div className="mt-2 text-sm font-bold text-amber-200">Renold est absent</div>
          <p className="mt-1 text-xs text-slate-400">
            « Je ne forge que le week-end, du <b>vendredi 21h</b> au <b>dimanche 21h</b>. Reviens plus tard ! »
          </p>
          <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Ouverture dans {fmtMs(msToBlacksmithOpen())}
          </div>
        </div>
      </div>
    );
  }

  // Réparation : consomme 1 kit de réparation si disponible, sinon or (×2 prix)
  function repair(id: string, max: number) {
    const dur = p!.gearDurability?.[id] ?? max;
    const missing = Math.max(0, max - dur);
    if (missing === 0) return toast('Déjà en parfait état.', 'info');
    const hasKit = (p!.inventory['repair_kit'] ?? 0) >= 1;
    const goldCost = missing * REPAIR_PER_POINT;
    if (!hasKit && p!.gold < goldCost) {
      return toast(`Il faut 1 kit de réparation ou ${goldCost.toLocaleString()} 🪙.`, 'bad');
    }
    mutate((d) => {
      if (!d.gearDurability) d.gearDurability = {};
      d.gearDurability[id] = max;
      if (hasKit) {
        d.inventory['repair_kit'] = (d.inventory['repair_kit'] ?? 1) - 1;
        toast('Réparé grâce à ton kit de réparation !', 'good');
      } else {
        d.gold -= goldCost;
        toast(`Réparé pour ${goldCost.toLocaleString()} 🪙.`, 'good');
      }
    });
  }

  // Renforcement garanti : coûte 1 matrice + de l'or. Sans échec possible.
  function reinforce(id: string, stars: number) {
    if (stars >= 5) return;
    const matrices = p!.inventory['upgrade_matrix'] ?? 0;
    const goldCost = REINFORCE_MATRIX_GOLD[stars];
    if (matrices < 1) return toast("Il te faut au moins 1 matrice d'amélioration ✨.", 'bad');
    if (p!.gold < goldCost) return toast(`Il faut ${goldCost.toLocaleString()} 🪙.`, 'bad');
    mutate((d) => {
      d.gold -= goldCost;
      d.inventory['upgrade_matrix'] = (d.inventory['upgrade_matrix'] ?? 1) - 1;
      if (!d.gearStars) d.gearStars = {};
      d.gearStars[id] = (d.gearStars[id] || 0) + 1;
    });
    toast(stars + 1 === 5 ? '⭐ Légendaire ! 5 étoiles atteintes !' : `✦ Renforcement garanti ! ${stars + 1}★`, 'good');
  }

  function purify(slot: Slot, id: string) {
    const runes = enchantsForEquipped(p!, slot);
    if (runes.length === 0) return toast('Aucune rune à retirer.', 'bad');
    if (p!.gold < PURIFY_GOLD) return toast(`Il faut ${PURIFY_GOLD} 🪙.`, 'bad');
    let refunded = 0;
    mutate((d) => {
      d.gold -= PURIFY_GOLD;
      for (const runeId of runes) {
        if (Math.random() < 0.5) { addItem(d, runeId, 1); refunded++; }
      }
      if (d.enchants) d.enchants[id] = [];
    });
    toast(`Purifié ! ${refunded}/${runes.length} rune(s) récupérée(s).`, refunded > 0 ? 'good' : 'info');
  }

  const anyGear = SLOTS.some(({ slot }) => p.equipped[slot]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-black/30 p-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧔‍♂️</span>
          <div>
            <div className="text-sm font-bold text-amber-200">Renold, Forgeron des Anciens</div>
            <div className="text-[11px] text-slate-400">« Je garantis le succès, mais cela a un prix — et une matrice. »</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          <span>Or : <b className="text-amber-200">{p.gold.toLocaleString()} 🪙</b></span>
          <span className="inline-flex items-center gap-1">Matrices : <b className="inline-flex items-center gap-1 text-violet-300">{p.inventory['upgrade_matrix'] ?? 0} <ItemIcon id="upgrade_matrix" size={14} /></b></span>
          <span className="inline-flex items-center gap-1">Kits : <b className="inline-flex items-center gap-1 text-orange-300">{p.inventory['repair_kit'] ?? 0} <ItemIcon id="repair_kit" size={14} /></b></span>
        </div>
        <div className="mt-2 rounded-lg bg-amber-900/20 px-3 py-1.5 text-[11px] text-amber-200/70">
          💡 Renforcement <b>garanti</b> (1 matrice + or). Via l'équipement : <b>risqué</b> (matrice seule, peut échouer).
        </div>
        {!p.ignoreRestrictions && (
          <div className="mt-1.5 text-[10px] text-slate-500">🕒 Ferme dans {fmtMs(msToBlacksmithClose())} (ouvert ven. 21h → dim. 21h)</div>
        )}
      </div>

      {!anyGear && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Équipe une arme, une armure ou un bijou pour utiliser ses services.</p>
      )}

      {SLOTS.map(({ slot, label, icon }) => {
        const id = p.equipped[slot];
        if (!id) return null;
        const it = item(id);
        if (!it) return null;
        const stars = p.gearStars?.[id] ?? 0;
        const dur = p.gearDurability?.[id] ?? it.maxDurability ?? 0;
        const max = it.maxDurability ?? 0;
        const missing = Math.max(0, max - dur);
        const hasKit = (p.inventory['repair_kit'] ?? 0) >= 1;
        const repairGoldCost = missing * REPAIR_PER_POINT;
        const reinforceCost = stars < 5 ? REINFORCE_MATRIX_GOLD[stars] : 0;
        const hasMatrix = (p.inventory['upgrade_matrix'] ?? 0) >= 1;
        const runeCount = enchantsForEquipped(p, slot).length;

        return (
          <div key={slot} className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{icon} {label}</span>
              <span className="ml-1 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: RARITY_COLOR[it.rarity] }}>
                <ItemIcon id={id} size={18} /> {it.name}
              </span>
              {stars > 0 && <span className="text-xs text-amber-400">{'★'.repeat(stars)}</span>}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-400">
              {max > 0 && <span>🔧 {dur}/{max}</span>}
              <span>Étoiles : {stars}/5 (+{stars * 10}% stats)</span>
              {runeCount > 0 && <span>✦ {runeCount} rune(s)</span>}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <button
                onClick={() => repair(id, max)}
                disabled={max === 0 || dur >= max || (!hasKit && p.gold < repairGoldCost)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500/25 px-2 py-1.5 text-xs font-semibold hover:bg-orange-500/45 disabled:opacity-40"
                title={hasKit ? 'Utilise 1 kit de réparation' : `Coûte ${repairGoldCost.toLocaleString()} 🪙 (sans kit)`}
              >
                🔧 Réparer {hasKit ? <>(Kit <ItemIcon id="repair_kit" size={13} />)</> : missing > 0 ? `(${repairGoldCost.toLocaleString()} 🪙)` : ''}
              </button>
              <button
                onClick={() => reinforce(id, stars)}
                disabled={stars >= 5 || !hasMatrix || p.gold < reinforceCost}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-purple-500/25 px-2 py-1.5 text-xs font-semibold hover:bg-purple-500/45 disabled:opacity-40"
                title="Garanti (sans risque) : nécessite 1 matrice + or"
              >
                {stars >= 5 ? '★ Max' : <>✦ Garanti (<ItemIcon id="upgrade_matrix" size={13} /> + {reinforceCost.toLocaleString()} 🪙)</>}
              </button>
              <button
                onClick={() => purify(slot, id)}
                disabled={runeCount === 0 || p.gold < PURIFY_GOLD}
                className="rounded-lg bg-sky-500/25 px-2 py-1.5 text-xs font-semibold hover:bg-sky-500/45 disabled:opacity-40"
                title="Retire les runes, en rembourse ~50%"
              >
                💧 Purifier ({PURIFY_GOLD} 🪙)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
