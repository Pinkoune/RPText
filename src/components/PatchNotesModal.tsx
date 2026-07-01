import { useEffect, useState } from 'react';
import { PATCH_VERSION, PATCH_NOTES } from '../game/patchnotes';

const KEY = 'rptext.seenPatch';

/** Petite affiche des nouveautés, montrée une fois par version vue. */
export default function PatchNotesModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (PATCH_NOTES.length === 0) return;
    if (localStorage.getItem(KEY) !== PATCH_VERSION) setShow(true);
  }, []);

  if (!show) return null;

  function close() {
    localStorage.setItem(KEY, PATCH_VERSION);
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={close}>
      <div
        className="glass w-full max-w-md animate-floatIn rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-lg font-bold text-glow">📰 Quoi de neuf ?</div>
        <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
          {PATCH_NOTES.map((sec, i) => (
            <div key={i}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">{sec.title}</div>
              <ul className="space-y-1 text-sm text-slate-200">
                {sec.items.map((it, j) => (
                  <li key={j}>• {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          onClick={close}
          className="mt-4 w-full rounded-lg bg-sky-500/40 py-2 text-sm font-semibold hover:bg-sky-500/60"
        >
          Compris !
        </button>
      </div>
    </div>
  );
}
