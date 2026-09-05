import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { previewCamp, collectCamp, campReady, CAMP_MAX_MS, CAMP_MIN_LEVEL } from '../game/camp';
import { item } from '../game/items';
import { seasonTheme } from '../game/artifact';
import ItemIcon from './ItemIcon';

/** Seuil d'absence à partir duquel on considère qu'il y a un « retour ». */
const AWAY_MS = 12 * 60 * 60 * 1000;

function fmtAway(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h} heures`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'une journée' : `${d} jours`;
}

/**
 * Écran « pendant ton absence ».
 *
 * Revenir sur un écran identique à celui qu'on a quitté ne donne aucune raison
 * de rester. Ce résumé transforme l'absence en récit : ce que le camp a produit,
 * ce qu'on a manqué, où on en est. Il ne s'affiche qu'après une vraie absence
 * (12h+), pour ne pas devenir un mur de plus à fermer à chaque session.
 */
export default function WelcomeBackModal() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const awayMs = useGame((s) => s.awayMs);
  const clearAway = useGame((s) => s.clearAway);
  const [away, setAway] = useState<number | null>(null);
  const [collected, setCollected] = useState<{ gold: number; xp: number; resourceId: string; qty: number } | null>(null);

  useEffect(() => {
    if (awayMs >= AWAY_MS) setAway(awayMs);
  }, [awayMs]);

  function dismiss() {
    setAway(null);
    clearAway();
  }

  if (!p || away === null) return null;

  const theme = seasonTheme(p.artifact?.season);
  const canCamp = p.level >= CAMP_MIN_LEVEL && campReady(p);
  const preview = canCamp ? previewCamp(p) : null;
  const capped = campReady(p) && Date.now() - (p.campCollectedAt ?? 0) >= CAMP_MAX_MS;

  function claim() {
    const y = previewCamp(p!);
    mutate((d) => { collectCamp(d); });
    setCollected({ gold: y.gold, xp: y.xp, resourceId: y.resourceId, qty: y.resourceQty });
    toast('🏕️ Camp récolté !', 'good');
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={dismiss}>
      <div className="glass w-full max-w-sm animate-floatIn rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold text-glow">👋 Content de te revoir</div>
        <p className="mt-1 text-sm text-slate-400">
          Tu as été absent pendant <b className="text-slate-200">{fmtAway(away)}</b>.
        </p>

        <div className="mt-4 space-y-2">
          {/* Camp */}
          {p.level < CAMP_MIN_LEVEL ? (
            <div className="rounded-lg bg-black/25 p-3 text-[11px] text-slate-500">
              🏕️ Ton camp s'ouvrira au niveau {CAMP_MIN_LEVEL} — il produira alors pendant tes absences.
            </div>
          ) : collected ? (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-3">
              <div className="text-xs font-bold text-emerald-300">🏕️ Camp récolté</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-100">
                {collected.gold > 0 && <span>+{collected.gold.toLocaleString('fr-FR')} 🪙</span>}
                {collected.xp > 0 && <span>+{collected.xp.toLocaleString('fr-FR')} XP</span>}
                {collected.qty > 0 && (
                  <span className="inline-flex items-center gap-1">
                    +{collected.qty} <ItemIcon id={collected.resourceId} size={16} /> {item(collected.resourceId)?.name}
                  </span>
                )}
              </div>
            </div>
          ) : preview ? (
            <div className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200">🏕️ Ton camp a produit</span>
                {capped && <span className="text-[10px] text-slate-500">(plafond atteint)</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                {preview.gold > 0 && <span>+{preview.gold.toLocaleString('fr-FR')} 🪙</span>}
                {preview.xp > 0 && <span>+{preview.xp.toLocaleString('fr-FR')} XP</span>}
                {preview.resourceQty > 0 && (
                  <span className="inline-flex items-center gap-1">
                    +{preview.resourceQty} <ItemIcon id={preview.resourceId} size={16} />
                  </span>
                )}
              </div>
              <button onClick={claim} className="mt-2 w-full rounded-lg bg-emerald-500/40 py-2 text-sm font-bold hover:bg-emerald-500/60">
                Récolter
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-black/25 p-3 text-[11px] text-slate-500">
              🏕️ Ton camp n'a rien produit depuis ta dernière récolte.
            </div>
          )}

          {/* Où en est le monde */}
          <div className="rounded-lg bg-black/25 p-3 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>{theme.emoji} Saison en cours</span>
              <span className="text-slate-300">{theme.name} · artefact Nv.{p.artifact?.level ?? 0}</span>
            </div>
            {(p.huntStreak ?? 0) > 0 && (
              <div className="mt-1 flex justify-between">
                <span>🔥 Série de chasse</span>
                <span className="text-slate-300">{p.huntStreak} kills — toujours en cours</span>
              </div>
            )}
            <div className="mt-1 flex justify-between">
              <span>🎁 Série de connexion</span>
              <span className="text-slate-300">{p.loginStreak ?? 0} jour{(p.loginStreak ?? 0) > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <button onClick={dismiss} className="mt-4 w-full rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60">
          Reprendre l'aventure
        </button>
      </div>
    </div>
  );
}
