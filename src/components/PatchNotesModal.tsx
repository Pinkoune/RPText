import { useEffect, useState } from 'react';
import { PATCH_HISTORY, PATCH_KIND_META, type PatchSection } from '../game/patchnotes';
import { useUi } from '../store/uiStore';

const KEY = 'rptext.seenPatch';
const SETTINGS_KEY = 'rptext.settings';

/** Version des nouveautés déjà vue sur cet appareil. */
export function seenPatchVersion(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Y a-t-il une version non lue ? (pilote la pastille de la Topbar) */
export function hasUnreadPatch(): boolean {
  const latest = PATCH_HISTORY[0];
  return !!latest && seenPatchVersion() !== latest.version;
}

/** Marque la dernière version comme lue (appelé à l'ouverture de la carte News). */
export function markPatchSeen(): void {
  const latest = PATCH_HISTORY[0];
  if (!latest) return;
  try { localStorage.setItem(KEY, latest.version); } catch { /* ignore */ }
  window.dispatchEvent(new Event('rptext:patch-seen'));
}

/** L'affichage automatique est désactivé par défaut (réactivable dans les Paramètres). */
function autoShowEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw).showPatchModal === true : false;
  } catch {
    return false;
  }
}

/**
 * Annonce des nouveautés.
 *
 * Ne s'ouvre PLUS d'elle-même par défaut : arriver dans le jeu et devoir fermer
 * un mur de texte avant de pouvoir jouer était pénible, surtout pour un joueur
 * qui revient. À la place, une pastille discrète apparaît sur l'icône 📰 de la
 * barre du haut, et l'historique reste consultable à tout moment. Ceux qui
 * préfèrent l'ancien comportement peuvent le réactiver dans les Paramètres.
 */
export default function PatchNotesModal() {
  const [show, setShow] = useState(false);
  const open = useUi((s) => s.open);

  const latestPatch = PATCH_HISTORY[0];

  useEffect(() => {
    if (!latestPatch) return;
    if (autoShowEnabled() && hasUnreadPatch()) setShow(true);
  }, [latestPatch]);

  if (!show || !latestPatch) return null;

  function close() {
    markPatchSeen();
    setShow(false);
  }

  function openHistory() {
    close();
    open('news', undefined, { singleton: true });
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={close}>
      <div
        className="glass w-full max-w-md animate-floatIn rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-lg font-bold text-glow">📰 Quoi de neuf ?</div>
        <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
          {latestPatch.sections.map((sec: PatchSection, i: number) => (
            <div key={i}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-300">{sec.title}</span>
                {sec.kind && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: `${PATCH_KIND_META[sec.kind].color}22`, color: PATCH_KIND_META[sec.kind].color }}
                  >
                    {PATCH_KIND_META[sec.kind].label}
                  </span>
                )}
              </div>
              <ul className="space-y-1 text-sm text-slate-200">
                {sec.items.map((it: string, j: number) => (
                  <li key={j} className="flex gap-2">
                    <span>•</span>
                    <span dangerouslySetInnerHTML={{ __html: it }} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={openHistory}
            className="rounded-lg bg-black/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Historique complet
          </button>
          <button
            onClick={close}
            className="flex-1 rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60"
          >
            Compris !
          </button>
        </div>
      </div>
    </div>
  );
}
