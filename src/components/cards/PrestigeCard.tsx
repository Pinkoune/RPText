import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  PRESTIGE_AURAS,
  PRESTIGE_BONUS_PER_LEVEL,
  PRESTIGE_XPGOLD_PER_LEVEL,
  MAX_PRESTIGE_STACK,
  prestigeStacks,
} from '../../game/prestige';
import { CLASSES } from '../../game/classes';
import { applyRebirth } from '../../game/ascension';

const pct = (v: number) => `${Math.round(v * 100)}%`;

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

  // Chiffres réels du prestige. Ils existaient dans le code mais n'étaient
  // affichés nulle part de façon lisible : un joueur venait de renaître et
  // demandait encore ce que ça lui rapportait « à part le flex ».
  const level = p.prestigeLevel ?? 0;
  const stacks = prestigeStacks(level);
  const nextStacks = prestigeStacks(level + 1);
  const tokens = p.classChangeTokens ?? 0;
  const capped = level >= MAX_PRESTIGE_STACK;
  // La renaissance ramène à la classe de base : on nomme laquelle, plutôt que
  // de laisser le joueur le découvrir après coup.
  const baseName = CLASSES[CLASSES[p.classId]?.parent ?? p.classId]?.name ?? '—';
  const isSubclass = !!CLASSES[p.classId]?.parent;

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
    // Toast chiffré : c'est le seul moment où le joueur regarde vraiment, et
    // « bonus permanent » sans nombre se lit comme de la décoration.
    toast(
      `🔮 Prestige ${level + 1} ! Bonus permanent : +${pct(nextStacks * PRESTIGE_BONUS_PER_LEVEL)} ATK/DEF/PV et `
      + `+${pct(nextStacks * PRESTIGE_XPGOLD_PER_LEVEL)} XP/Or. +1 jeton de changement de classe.`,
      'gold',
    );
  }

  return (
    <div className="space-y-3">
      {/* Ce que le prestige rapporte, en chiffres et en permanence. */}
      {level > 0 && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/25 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-purple-200">✦ Prestige {level}</span>
            {capped && <span className="text-[10px] text-slate-500">bonus plafonné à {MAX_PRESTIGE_STACK}</span>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-black/30 py-2">
              <div className="text-sm font-bold tabular-nums text-rose-300">+{pct(stacks * PRESTIGE_BONUS_PER_LEVEL)}</div>
              <div className="text-[10px] text-slate-400">ATK / DEF / PV</div>
            </div>
            <div className="rounded-lg bg-black/30 py-2">
              <div className="text-sm font-bold tabular-nums text-emerald-300">+{pct(stacks * PRESTIGE_XPGOLD_PER_LEVEL)}</div>
              <div className="text-[10px] text-slate-400">XP et Or</div>
            </div>
            <div className="rounded-lg bg-black/30 py-2">
              <div className="text-sm font-bold tabular-nums text-amber-300">{tokens}</div>
              <div className="text-[10px] text-slate-400">jeton{tokens > 1 ? 's' : ''} de classe</div>
            </div>
          </div>
        </div>
      )}

      {/* Renaissance : proposée seulement après une victoire sur le Néant, et
          jamais imposée — vaincre le boss final ne remet plus rien à zéro. */}
      {canRebirth && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-950/30 p-3">
          <div className="text-sm font-semibold text-purple-200">🔮 Renaissance disponible</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Tu as vaincu le Néant. Repartir du niveau 1 t'accorde le <b className="text-amber-300">Prestige {level + 1}</b>.
          </p>

          {/* Le marché, terme à terme. Un « bonus permanent » sans chiffre se lit
              comme du décor : ici on donne les deux colonnes en toutes lettres. */}
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-rose-950/30 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-rose-300">Tu perds</div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                <li>Ton niveau (retour au Nv.1)</li>
                <li>Équipement, or et sac</li>
                <li>Arbre de talents et métiers</li>
                {isSubclass && <li className="text-rose-200">Ta spécialisation — retour {baseName}, ré-ascension au Nv.20</li>}
              </ul>
            </div>
            <div className="rounded-lg bg-emerald-950/25 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Tu gagnes, définitivement</div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                <li>
                  <b className="tabular-nums text-slate-200">+{pct(nextStacks * PRESTIGE_BONUS_PER_LEVEL)}</b> ATK / DEF / PV
                  {stacks > 0 && <span className="text-slate-500"> (au lieu de {pct(stacks * PRESTIGE_BONUS_PER_LEVEL)})</span>}
                </li>
                <li>
                  <b className="tabular-nums text-slate-200">+{pct(nextStacks * PRESTIGE_XPGOLD_PER_LEVEL)}</b> XP et Or
                  {stacks > 0 && <span className="text-slate-500"> (au lieu de {pct(stacks * PRESTIGE_XPGOLD_PER_LEVEL)})</span>}
                </li>
                <li><b className="text-slate-200">1 jeton</b> de changement de classe</li>
                <li>Le titre « Prestige {level + 1} »</li>
              </ul>
            </div>
          </div>

          {/* Ce qui traverse la renaissance : c'est la réponse au « le stuff qui
              est reset, ça fait mal » — mieux vaut le dire AVANT. */}
          <p className="mt-2 text-[11px] text-slate-400">
            <b className="text-slate-300">Conservés :</b> familiers, titres, succès, artefact de saison
            et maîtrises de biome. <b>Rien ne t'y oblige</b> — l'offre reste ouverte.
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
          Colore ton pseudo au classement et donne le bonus passif indiqué. Une seule active.
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
