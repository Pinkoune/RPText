import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import { getAvailableRunes, equipEnchant, removeEnchant, MAX_ENCHANTS_PER_SLOT, ENCHANT_REMOVAL_COST } from '../../game/enchant';
import ItemIcon from '../ItemIcon';

type Slot = 'weapon' | 'armor' | 'trinket';
const SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️' },
  { slot: 'armor', label: 'Armure', icon: '🛡️' },
  { slot: 'trinket', label: 'Bijou', icon: '💍' },
];

export default function EnchantCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [picker, setPicker] = useState<{ slot: Slot; index: number } | null>(null);
  if (!p) return null;

  const runes = getAvailableRunes(p);

  function equip(slot: Slot, runeId: string) {
    try { mutate((d) => equipEnchant(d, slot, runeId)); toast('Rune sertie !', 'good'); setPicker(null); }
    catch (e: any) { toast(e.message, 'bad'); }
  }
  function remove(slot: Slot, index: number) {
    if (!confirm(`Retirer cette rune coûte ${ENCHANT_REMOVAL_COST} 💎. Continuer ?`)) return;
    try { mutate((d) => removeEnchant(d, slot, index)); toast('Rune retirée.', 'good'); }
    catch (e: any) { toast(e.message, 'bad'); }
  }

  const anyGear = SLOTS.some(({ slot }) => p.equipped[slot]);

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between rounded-xl bg-black/30 p-3">
        <div className="text-sm">
          <div className="font-semibold text-purple-200">✦ Enchantement</div>
          <div className="text-[10px] text-slate-400">Sertis des runes dans ton équipement (max {MAX_ENCHANTS_PER_SLOT}/objet).</div>
        </div>
        <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-sm font-bold text-fuchsia-200">{p.gems} 💎</span>
      </div>

      {!anyGear && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Équipe une arme, une armure ou un bijou pour l'enchanter.</p>
      )}

      {/* Un bloc par emplacement équipé */}
      {SLOTS.map(({ slot, label, icon }) => {
        const eqId = p.equipped[slot];
        if (!eqId) return null;
        const eq = item(eqId);
        if (!eq) return null;
        const list = p.enchants?.[eqId] ?? [];
        return (
          <div key={slot} className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{icon} {label}</span>
              <span className="ml-1 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: RARITY_COLOR[eq.rarity] }}>
                <ItemIcon id={eqId} size={18} /> {eq.name}
              </span>
            </div>

            {/* Emplacements de runes */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Array.from({ length: MAX_ENCHANTS_PER_SLOT }).map((_, i) => {
                const runeId = list[i];
                if (runeId) {
                  const rd = item(runeId);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 p-2">
                      <ItemIcon id={runeId} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-purple-100">{rd?.name}</div>
                        <div className="text-[10px] text-emerald-300">{rd?.desc}</div>
                      </div>
                      <button onClick={() => remove(slot, i)} title={`Retirer (${ENCHANT_REMOVAL_COST} 💎)`} className="shrink-0 rounded bg-rose-500/25 px-1.5 py-0.5 text-[10px] hover:bg-rose-500/45">✕</button>
                    </div>
                  );
                }
                const active = picker?.slot === slot && picker.index === i;
                return (
                  <button
                    key={i}
                    onClick={() => setPicker(active ? null : { slot, index: i })}
                    className={`flex h-14 items-center justify-center rounded-lg border border-dashed text-xs transition ${active ? 'border-purple-400 bg-purple-500/15 text-purple-200' : 'border-slate-700 bg-black/20 text-slate-500 hover:bg-white/5'}`}
                  >
                    {active ? 'Choisis une rune ▼' : '＋ Sertir une rune'}
                  </button>
                );
              })}
            </div>

            {/* Sélecteur de runes (sous le bloc concerné) */}
            {picker?.slot === slot && (
              <div className="mt-2 rounded-lg bg-black/40 p-2">
                {runes.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Aucune rune dans ton sac. Les runes s'obtiennent en jeu (drops / craft).</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {runes.map((r) => {
                      const rd = item(r.id)!;
                      return (
                        <button key={r.id} onClick={() => equip(slot, r.id)} className="flex items-center gap-1.5 rounded bg-black/30 px-2 py-1.5 text-left text-xs hover:bg-purple-500/20">
                          <ItemIcon id={r.id} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate" style={{ color: RARITY_COLOR[rd.rarity] }}>{rd.name}</span>
                            <span className="block text-[9px] text-emerald-300">{rd.desc}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-500">×{r.qty}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
