import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats, equipItem, unequipItem, canEquip } from '../../game/player';
import type { ItemSlot } from '../../game/types';

const SLOTS: { slot: 'weapon' | 'armor' | 'trinket'; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
];

const SET_BONUSES: Record<string, { name: string; desc: string }> = {
  wind_set: { name: 'Set du Vent', desc: '+10% ATK, +10% PV' },
  earth_set: { name: 'Set de Terre', desc: '+20% PV' },
  fire_set: { name: 'Set de Feu', desc: '+20% ATK' },
  frost_set: { name: 'Set de Givre', desc: '+20% DEF' },
  water_set: { name: 'Set d\'Eau', desc: '+10% PV, +10% DEF' },
  light_set: { name: 'Set de Lumière', desc: '+10% ATK, +10% DEF' },
  dark_set: { name: 'Set des Ténèbres', desc: '+25% ATK, -10% PV' },
  obsidian_set: { name: 'Set d\'Obsidienne', desc: '+25% DEF, +10% PV' },
};

function statLine(id: string | null): string {
  const it = id ? item(id)! : null;
  if (!it) return '—';
  const parts = [];
  if (it.atk) parts.push(`ATK+${it.atk}`);
  if (it.def) parts.push(`DEF+${it.def}`);
  if (it.hp) parts.push(`PV+${it.hp}`);
  return parts.join(' · ') || 'aucun bonus';
}

export default function EquipmentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const stats = deriveStats(p);

  function equip(id: string) {
    mutate((d) => { equipItem(d, id); });
    toast(`${item(id)!.name} équipé.`, 'good');
  }
  function unequip(slot: 'weapon' | 'armor' | 'trinket') {
    mutate((d) => { unequipItem(d, slot); });
  }

  // Objets équipables possédés, par slot.
  const owned = (slot: ItemSlot) =>
    Object.entries(p.inventory).filter(([id, q]) => item(id)! && item(id)!.slot === slot && q > 0);

  const setIdsCount: Record<string, number> = {};
  for (const slot of ['weapon', 'armor', 'trinket'] as const) {
    const eqId = p.equipped[slot];
    const it = eqId ? item(eqId) : null;
    if (it && it.setId && (p.gearDurability?.[slot] ?? 1) > 0) {
      setIdsCount[it.setId] = (setIdsCount[it.setId] || 0) + 1;
    }
  }

  return (
    <div className="space-y-3">
      {/* Stats résultantes */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-black/25 py-1.5"><div className="text-[10px] text-slate-400">PV</div><div className="font-bold">{stats.maxHp}</div></div>
        <div className="rounded-lg bg-black/25 py-1.5"><div className="text-[10px] text-slate-400">ATK</div><div className="font-bold">{stats.atk}</div></div>
        <div className="rounded-lg bg-black/25 py-1.5"><div className="text-[10px] text-slate-400">DEF</div><div className="font-bold">{stats.def}</div></div>
      </div>

      {SLOTS.map(({ slot, label, icon }) => {
        const equippedId = p.equipped[slot];
        const eq = equippedId ? item(equippedId)! : null;
        const candidates = owned(slot).filter(([id]) => id !== equippedId && canEquip(p, item(id)!));
        return (
          <div key={slot} className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{icon} {label}</span>
              {eq && (
                <button onClick={() => unequip(slot)} className="rounded bg-rose-500/25 px-2 py-0.5 text-[11px] hover:bg-rose-500/45">Retirer</button>
              )}
            </div>
            <div className="mt-1 text-sm" style={{ color: eq ? RARITY_COLOR[eq.rarity] : '#64748b' }}>
              {eq ? (
                <>
                  {eq.icon} {eq.name}
                  {p.gearStars?.[slot] ? <span className="ml-1 text-yellow-400">{'★'.repeat(p.gearStars[slot])}</span> : null}
                </>
              ) : '— vide —'}
            </div>
            {eq && (
              <div className="text-[11px] text-slate-400 flex flex-col gap-1 mt-1">
                <div>{statLine(equippedId)}</div>
                
                {/* Durability */}
                {eq.maxDurability && (
                  <div className="flex items-center gap-2">
                    <span className={p.gearDurability?.[slot] === 0 ? 'text-red-500 font-bold' : ''}>
                      Durabilité : {p.gearDurability?.[slot] ?? eq.maxDurability} / {eq.maxDurability}
                    </span>
                    {(p.gearDurability?.[slot] ?? eq.maxDurability) < eq.maxDurability && (
                      <button 
                        onClick={() => {
                          const cost = 1;
                          if ((p.inventory['repair_kit'] || 0) >= cost) {
                            mutate(d => {
                              d.inventory['repair_kit'] -= cost;
                              if (!d.gearDurability) d.gearDurability = { weapon:0, armor:0, trinket:0, consumable:0, material:0 };
                              d.gearDurability[slot] = eq.maxDurability!;
                            });
                            toast('Équipement réparé !', 'good');
                          } else {
                            toast("Tu n'as pas de kit de réparation.", 'bad');
                          }
                        }}
                        className="rounded bg-orange-500/25 px-2 py-0.5 hover:bg-orange-500/45"
                      >
                        Réparer
                      </button>
                    )}
                  </div>
                )}

                {/* Stars Upgrade */}
                {eq.maxDurability && (p.gearStars?.[slot] || 0) < 5 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const cost = 1;
                        if ((p.inventory['upgrade_matrix'] || 0) >= cost) {
                          mutate(d => {
                            d.inventory['upgrade_matrix'] -= cost;
                            if (!d.gearStars) d.gearStars = { weapon:0, armor:0, trinket:0, consumable:0, material:0 };
                            const currentStars = d.gearStars[slot] || 0;
                            // Chances: 100%, 90%, 75%, 60%, 40%
                            const chances = [1, 0.9, 0.75, 0.6, 0.4];
                            if (Math.random() <= chances[currentStars]) {
                              d.gearStars[slot] = currentStars + 1;
                              toast(`Amélioration réussie ! (${d.gearStars[slot]}★)`, 'good');
                              if (d.gearStars[slot] === 5) {
                                // Simulate global announce (locally or let backend handle it, we'll just toast for now since sendChat is async)
                                toast(`Légendaire ! Ton objet a atteint 5 étoiles !`, 'good');
                              }
                            } else {
                              toast("L'amélioration a échoué...", 'bad');
                            }
                          });
                        } else {
                          toast("Tu n'as pas de matrice d'amélioration.", 'bad');
                        }
                      }}
                      className="rounded bg-purple-500/25 px-2 py-0.5 hover:bg-purple-500/45"
                    >
                      Améliorer ({(p.gearStars?.[slot] || 0) === 0 ? '100%' : (p.gearStars?.[slot] || 0) === 1 ? '90%' : (p.gearStars?.[slot] || 0) === 2 ? '75%' : (p.gearStars?.[slot] || 0) === 3 ? '60%' : '40%'})
                    </button>
                  </div>
                )}
                
                {/* Element & Type */}
                <div className="flex gap-2">
                  {eq.element && <span>Élément: {eq.element}</span>}
                  {eq.dmgType && <span>Dégâts: {eq.dmgType}</span>}
                </div>
                {eq.setId && <span>Set: {eq.setId.replace('_set', '')}</span>}
              </div>
            )}

            {candidates.length > 0 && (
              <div className="mt-2 space-y-1">
                {candidates.map(([id, q]) => {
                  const it = item(id)!;
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-2 py-1.5">
                      <div className="min-w-0">
                        <span className="truncate text-sm" style={{ color: RARITY_COLOR[it.rarity] }}>{it.icon} {it.name}</span>
                        <span className="ml-1 text-[10px] text-slate-500">×{q} · {statLine(id)}</span>
                      </div>
                      <button onClick={() => equip(id)} className="shrink-0 rounded bg-sky-500/30 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500/50">Équiper</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bonus de Sets Actifs */}
      <div className="rounded-xl bg-black/25 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bonus de Sets (3 pièces)</h3>
        {Object.entries(SET_BONUSES).map(([setId, info]) => {
          const count = setIdsCount[setId] || 0;
          if (count === 0) return null;
          const isActive = count >= 3;
          return (
            <div key={setId} className={`flex justify-between text-sm ${isActive ? 'text-green-400 font-bold' : 'text-slate-500'}`}>
              <span>{info.name} ({count}/3)</span>
              <span>{info.desc}</span>
            </div>
          );
        })}
        {Object.keys(setIdsCount).length === 0 && (
          <div className="text-sm text-slate-500 italic">Aucun set équipé.</div>
        )}
      </div>
    </div>
  );
}
