import { useGame } from '../../store/gameStore';
import { RECIPES, canCraft, craft, type Recipe } from '../../game/crafting';
import { ITEMS, RARITY_COLOR } from '../../game/items';

export default function CraftCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  function forge(r: Recipe) {
    if (!canCraft(p!, r)) {
      toast('Matériaux ou or insuffisants.', 'bad');
      return;
    }
    mutate((d) => { craft(d, r); });
    toast(`Forgé : ${ITEMS[r.output].name} !`, 'good');
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Transforme tes matériaux de chasse en équipement. Or : <b>{p.gold} 🪙</b>
      </p>
      {RECIPES.map((r) => {
        const out = ITEMS[r.output];
        const ok = canCraft(p, r);
        return (
          <div key={r.output} className="rounded-lg bg-black/25 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium" style={{ color: RARITY_COLOR[out.rarity] }}>{out.icon} {out.name}</span>
              <button
                onClick={() => forge(r)}
                disabled={!ok}
                className="shrink-0 rounded bg-sky-500/30 px-3 py-1 text-xs font-semibold hover:bg-sky-500/50 disabled:opacity-40"
              >
                Forger
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(r.materials).map(([id, need]) => {
                const have = p.inventory[id] ?? 0;
                return (
                  <span key={id} className={`rounded px-1.5 py-0.5 ${have >= need ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                    {ITEMS[id].icon} {ITEMS[id].name} {have}/{need}
                  </span>
                );
              })}
              <span className={`rounded px-1.5 py-0.5 ${p.gold >= r.gold ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>
                {r.gold} 🪙
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
