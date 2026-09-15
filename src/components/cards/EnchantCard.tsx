import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { item, RARITY_COLOR } from '../../game/items';
import {
  getAvailableRunes, equipEnchant, removeEnchant, engraveRune, fuseRunes, fusableRunes,
  MAX_ENCHANTS_PER_SLOT, ENCHANT_REMOVAL_COST, ENGRAVE_COST, FUSE_COUNT,
} from '../../game/enchant';
import { RUNES, engravable, type RuneSlot } from '../../game/runes';
import ItemIcon from '../ItemIcon';

const SLOTS: { slot: RuneSlot; label: string; icon: string; role: string }[] = [
  { slot: 'weapon', label: 'Arme', icon: '⚔️', role: 'offensif' },
  { slot: 'armor', label: 'Armure', icon: '🛡️', role: 'défensif' },
  { slot: 'trinket', label: 'Bijou', icon: '💍', role: 'soutien' },
];

type Tab = 'sertir' | 'graver';

export default function EnchantCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [tab, setTab] = useState<Tab>('sertir');
  const [picker, setPicker] = useState<{ slot: RuneSlot; index: number } | null>(null);
  if (!p) return null;

  function equip(slot: RuneSlot, runeId: string) {
    try { mutate((d) => equipEnchant(d, slot, runeId)); toast('Rune sertie !', 'good'); setPicker(null); }
    catch (e: any) { toast(e.message, 'bad'); }
  }
  function remove(slot: RuneSlot, index: number) {
    if (!confirm(`Retirer cette rune coûte ${ENCHANT_REMOVAL_COST} 💎. Elle retourne dans ton sac. Continuer ?`)) return;
    try { mutate((d) => removeEnchant(d, slot, index)); toast('Rune retirée.', 'good'); }
    catch (e: any) { toast(e.message, 'bad'); }
  }
  function engrave(slot: RuneSlot) {
    try {
      let got = '';
      mutate((d) => { got = engraveRune(d, slot).name; });
      toast(`Gravure réussie : ${got} !`, 'good');
    } catch (e: any) { toast(e.message, 'bad'); }
  }
  function fuse(runeId: string) {
    try {
      let got = '';
      mutate((d) => { got = fuseRunes(d, runeId).name; });
      toast(`Fusion : ${got} !`, 'good');
    } catch (e: any) { toast(e.message, 'bad'); }
  }

  const anyGear = SLOTS.some(({ slot }) => p.equipped[slot]);
  const fusable = fusableRunes(p);

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between rounded-xl bg-black/30 p-3">
        <div className="text-sm">
          <div className="font-semibold text-purple-200">✦ Runes</div>
          {/* La règle qui structure tout le système, dite en une ligne : une rune
              appartient à un emplacement. Sans ça le joueur essaie de mettre sa
              rune de critique sur son armure et croit à un bug. */}
          <div className="text-[10px] text-slate-400">
            Arme = offensif · Armure = défensif · Bijou = soutien. {MAX_ENCHANTS_PER_SLOT} runes par pièce.
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-3 py-1 text-sm font-bold text-fuchsia-200">{p.gems} 💎</span>
      </div>

      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        {([['sertir', '✦ Sertir'], ['graver', '⚒️ Table de gravure']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === id ? 'bg-purple-500/25 text-purple-100' : 'text-slate-400 hover:bg-white/5'}`}
          >
            {label}
            {id === 'graver' && fusable.length > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-500/30 px-1.5 text-[9px] text-emerald-200">{fusable.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'sertir' && (
        <>
          {!anyGear && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Équipe une arme, une armure ou un bijou pour la sertir.</p>
          )}

          {SLOTS.map(({ slot, label, icon, role }) => {
            const eqId = p.equipped[slot];
            if (!eqId) return null;
            const eq = item(eqId);
            if (!eq) return null;
            const list = p.enchants?.[eqId] ?? [];
            const pool = getAvailableRunes(p, slot);
            return (
              <div key={slot} className="rounded-xl bg-black/25 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{icon} {label} · {role}</span>
                  <span className="ml-1 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: RARITY_COLOR[eq.rarity] }}>
                    <ItemIcon id={eqId} size={18} /> {eq.name}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Array.from({ length: MAX_ENCHANTS_PER_SLOT }).map((_, i) => {
                    const runeId = list[i];
                    if (runeId) {
                      const rd = RUNES[runeId];
                      return (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-purple-400/30 bg-purple-500/10 p-2">
                          <ItemIcon id={runeId} size={22} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-purple-100">{rd?.name ?? runeId}</div>
                            <div className="text-[10px] leading-snug text-emerald-300">{rd?.desc}</div>
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

                {picker?.slot === slot && (
                  <div className="mt-2 rounded-lg bg-black/40 p-2">
                    {pool.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Aucune rune de {label.toLowerCase()} dans ton sac. Grave-en une à la Table, ou fouille les donjons de fin.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {pool.map(({ id, qty, def }) => (
                          <button key={id} onClick={() => equip(slot, id)} className="flex items-center gap-1.5 rounded bg-black/30 px-2 py-1.5 text-left text-xs hover:bg-purple-500/20">
                            <ItemIcon id={id} size={18} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate" style={{ color: RARITY_COLOR[item(id)!.rarity] }}>{def.name}</span>
                              <span className="block text-[9px] leading-snug text-emerald-300">{def.desc}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-500">×{qty}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'graver' && (
        <>
          {/* Gravure : la source qui manquait au système. */}
          <div className="rounded-xl bg-black/25 p-3">
            <div className="text-xs font-semibold text-slate-200">Graver une rune — {ENGRAVE_COST} 💎</div>
            <p className="mt-0.5 text-[11px] text-slate-400">Rang I tiré au sort parmi les quatre familles de l'emplacement.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {SLOTS.map(({ slot, label, icon, role }) => (
                <div key={slot} className="rounded-lg bg-black/30 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{icon} {label} · {role}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {engravable(slot).map((r) => (
                      <span key={r.id} title={r.desc} className="inline-flex items-center gap-1 rounded bg-black/40 px-1 py-0.5 text-[9px] text-slate-400">
                        <ItemIcon id={r.id} size={12} /> {r.name.replace(/^Rune de /, '').replace(/ I$/, '')}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => engrave(slot)}
                    disabled={p.gems < ENGRAVE_COST}
                    className="mt-2 w-full rounded-lg bg-fuchsia-500/30 py-1.5 text-xs font-bold hover:bg-fuchsia-500/50 disabled:opacity-35"
                  >
                    Graver ({ENGRAVE_COST} 💎)
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Fusion : ce qui rend le tirage aléatoire supportable. */}
          <div className="rounded-xl bg-black/25 p-3">
            <div className="text-xs font-semibold text-slate-200">Fusionner — {FUSE_COUNT} identiques → rang supérieur</div>
            {fusable.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Aucune fusion possible. Il te faut {FUSE_COUNT} exemplaires de la même rune : un doublon n'est jamais perdu.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {fusable.map(({ id, qty, def, target }) => (
                  <div key={id} className="flex items-center gap-2 rounded-lg bg-black/30 p-2">
                    <ItemIcon id={id} size={20} />
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block truncate text-slate-200">{def.name} <span className="text-slate-500">×{qty}</span></span>
                      <span className="block truncate text-[10px] text-emerald-300">→ {target.name} : {target.desc}</span>
                    </span>
                    <button onClick={() => fuse(id)} className="shrink-0 rounded bg-emerald-500/30 px-2 py-1 text-[11px] font-bold hover:bg-emerald-500/50">
                      Fusionner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-slate-500">
            Les trois runes <b>uniques</b> (Transmutation, Sursis, Faille) ne se gravent ni ne se fusionnent :
            Boutique du Destin, ou butin des derniers donjons.
          </p>
        </>
      )}
    </div>
  );
}
