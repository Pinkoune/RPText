import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { deriveStats, equipItem, unequipItem, canEquip } from '../../game/player';
import type { ItemSlot } from '../../game/types';

const SLOTS: { slot: 'weapon' | 'armor' | 'trinket'; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
];

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
              {eq ? `${eq.icon} ${eq.name}` : '— vide —'}
            </div>
            {eq && <div className="text-[11px] text-slate-400">{statLine(equippedId)}</div>}

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
    </div>
  );
}
