import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { PRESTIGE_AURAS } from '../../game/prestige';
import { applyRebirth } from '../../game/ascension';

export default function PrestigeCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [confirmRebirth, setConfirmRebirth] = useState(false);
  if (!p) return null;

  const current = p.prestigeAura ?? '';
  const colorOn = p.auraColorOn ?? true;
  const currentDef = PRESTIGE_AURAS.find((a) => a.emoji === current);
  const canRebirth = !!p.rebirthAvailable;

  function choose(emoji: string) {
    mutate((d) => { d.prestigeAura = d.prestigeAura === emoji ? undefined : emoji; });
    toast(current === emoji ? 'Aura retirée.' : `Aura ${emoji} équipée !`, 'good');
  }

  function toggleColor() {
    mutate((d) => { d.auraColorOn = !(d.auraColorOn ?? true); });
  }

  function doRebirth() {
    mutate((d) => applyRebirth(d));
    setConfirmRebirth(false);
    useGame.getState().celebrateLevelUp();
    toast('🔮 Tu renais. Prestige gagné — un jeton de changement de classe t\'attend dans ton Profil.', 'gold');
  }

  return (
    <div className="space-y-3">
      {/* Renaissance : proposée seulement après une victoire sur le Néant, et
          jamais imposée — vaincre le boss final ne remet plus rien à zéro. */}
      {canRebirth && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-950/30 p-3">
          <div className="text-sm font-semibold text-purple-200">🔮 Renaissance disponible</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Tu as vaincu le Néant. Tu peux repartir du <b>niveau 1</b> — en perdant niveau,
            équipement, or et métiers — pour gagner un niveau de <b className="text-amber-300">Prestige</b> :
            bonus permanent d'ATK/DEF/PV et d'XP/Or, plus un jeton de changement de classe.
            Familiers, titres et succès sont conservés. <b>Rien ne t'y oblige</b> — l'offre reste ouverte.
          </p>
          {!confirmRebirth ? (
            <button
              onClick={() => setConfirmRebirth(true)}
              className="mt-2 w-full rounded-lg bg-purple-600/40 py-2 text-sm font-bold text-purple-100 hover:bg-purple-600/60"
            >
              Renaître (Prestige {(p.prestigeLevel ?? 0) + 1})
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] font-bold text-rose-300">
                Confirmes-tu ? Ton personnage actuel (Nv.{p.level}, son équipement et ses métiers) sera remis à zéro.
              </p>
              <div className="flex gap-2">
                <button onClick={doRebirth} className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-bold hover:bg-purple-500">
                  Oui, je renais
                </button>
                <button onClick={() => setConfirmRebirth(false)} className="flex-1 rounded-lg bg-slate-700/60 py-2 text-sm hover:bg-slate-700">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl bg-black/30 p-3">
        <div className="text-sm font-semibold text-amber-200">✨ Aura de prestige</div>
        <div className="mt-1 text-[11px] text-slate-400">
          Symbole affiché à côté de ton nom au classement — <b className="text-amber-200">et petit bonus passif</b>. Une seule active.
        </div>
        <div className="mt-2 text-sm">Actuelle : <span className="text-lg">{current || '—'}</span></div>

        {current && (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={colorOn} onChange={toggleColor} className="accent-amber-400" />
            Colorer mon pseudo {currentDef && <span style={{ color: currentDef.color }} className="font-semibold">(exemple)</span>}
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        {PRESTIGE_AURAS.map((a) => {
          const active = current === a.emoji;
          return (
            <button
              key={a.emoji}
              onClick={() => choose(a.emoji)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${active ? 'bg-amber-500/25 ring-1 ring-amber-400' : 'bg-black/25 hover:bg-white/10'}`}
            >
              <span className="text-2xl leading-none">{a.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-200">{a.label}</div>
                <div className="text-[11px]" style={{ color: a.color }}>{a.desc}</div>
              </div>
              {active && <span className="text-[11px] font-bold text-amber-300">✓ actif</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
