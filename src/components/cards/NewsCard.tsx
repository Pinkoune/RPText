import { PATCH_HISTORY } from '../../game/patchnotes';

/** Historique complet des nouveautés, consultable à tout moment. */
export default function NewsCard() {
  return (
    <div className="max-h-[70vh] space-y-5 overflow-auto pr-1">
      {PATCH_HISTORY.map((release, i) => (
        <div key={release.version} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-glow">
              {i === 0 && '🆕 '}Version {release.version}
            </span>
            <span className="text-[11px] text-slate-500">{release.date}</span>
          </div>
          <div className="space-y-3">
            {release.sections.map((sec, j) => (
              <div key={j}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">{sec.title}</div>
                <ul className="space-y-1 text-sm text-slate-200">
                  {sec.items.map((it, k) => (
                    <li key={k}>• {it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
