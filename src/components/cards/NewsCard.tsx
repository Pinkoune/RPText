import { useEffect, useState } from 'react';
import { PATCH_HISTORY, PATCH_KIND_META, type PatchKind } from '../../game/patchnotes';
import { markPatchSeen } from '../PatchNotesModal';

const FILTERS: { id: PatchKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'new', label: 'Nouveautés' },
  { id: 'content', label: 'Contenu' },
  { id: 'balance', label: 'Équilibrage' },
  { id: 'fix', label: 'Corrections' },
];

/** Historique complet des nouveautés, consultable à tout moment. */
export default function NewsCard() {
  const [filter, setFilter] = useState<PatchKind | 'all'>('all');

  // Ouvrir cette carte vaut lecture : c'est ce qui éteint la pastille de la
  // barre du haut, puisque la modale ne s'impose plus au démarrage.
  useEffect(() => { markPatchSeen(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              filter === f.id ? 'bg-sky-500/40 text-white' : 'bg-black/30 text-slate-400 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="max-h-[65vh] space-y-5 overflow-auto pr-1">
        {PATCH_HISTORY.map((release, i) => {
          const sections = release.sections.filter((s) => filter === 'all' || s.kind === filter);
          if (sections.length === 0) return null;
          return (
            <div key={release.version} className={i > 0 ? 'border-t border-white/10 pt-4' : ''}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-glow">
                  {i === 0 && '🆕 '}Version {release.version}
                </span>
                <span className="shrink-0 text-[11px] text-slate-500">{release.date}</span>
              </div>
              <div className="space-y-3">
                {sections.map((sec, j) => (
                  <div key={j}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
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
                      {sec.items.map((it, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="text-slate-600">•</span>
                          <span dangerouslySetInnerHTML={{ __html: it }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
