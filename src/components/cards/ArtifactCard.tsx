import { useGame } from '../../store/gameStore';
import {
  ARTIFACT_MODS, COLUMN_UNLOCK, artifactXpToNext, artifactPowerPct,
  pointsAvailable, pointsSpent, columnUnlocked, hasArtifactMod,
  unlockArtifactMod, seasonTheme, getCurrentSeason, type ArtifactModDef,
} from '../../game/artifact';

const COLUMN_NAMES = ['Fondations', 'Spécialisation', 'Mécaniques', 'Puissance', 'Apogée'];

export default function ArtifactCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const a = p.artifact ?? { season: getCurrentSeason(), xp: 0, level: 0, mods: [] };
  const theme = seasonTheme(a.season);
  const need = artifactXpToNext(a.level);
  const pct = Math.max(0, Math.min(100, (a.xp / need) * 100));
  const avail = pointsAvailable(p);
  const spent = pointsSpent(p);
  const power = Math.round(artifactPowerPct(a.level) * 100);

  function unlock(def: ArtifactModDef) {
    let err: string | null = null;
    mutate((d) => { err = unlockArtifactMod(d, def.id); });
    if (err) toast(err, 'bad');
    else toast(`${def.icon} ${def.name} débloqué !`, 'good');
  }

  const byColumn = COLUMN_NAMES.map((_, c) => ARTIFACT_MODS.filter((m) => m.column === c));

  return (
    <div className="space-y-4">
      {/* En-tête : saison, niveau, jauge */}
      <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${theme.color}22, transparent 70%)` }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.color }}>
            {theme.emoji} Saison {a.season} · {theme.name}
          </div>
          <div className="text-[11px] text-slate-400">Niveau d'artefact</div>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-100">{theme.artifactName}</div>
            <div className="text-[11px] text-slate-400">
              Puissance : <b style={{ color: theme.color }}>+{power}%</b> ATK / DEF / PV
            </div>
          </div>
          <div className="shrink-0 text-3xl font-bold tabular-nums" style={{ color: theme.color }}>{a.level}</div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: theme.color }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-500">
          <span>{a.xp.toLocaleString('fr-FR')} / {need.toLocaleString('fr-FR')} XP</span>
          <span>Progression sans fin — elle monte sur toutes tes activités</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
        <span className="text-slate-300">Points disponibles</span>
        <span className="font-bold tabular-nums" style={{ color: avail > 0 ? theme.color : '#64748b' }}>
          {avail} <span className="text-[11px] font-normal text-slate-500">({spent} dépensés)</span>
        </span>
      </div>

      {/* Grille de mods, colonne par colonne */}
      {byColumn.map((mods, c) => {
        const open = columnUnlocked(p, c);
        return (
          <div key={c} className={`rounded-xl bg-black/25 p-3 ${open ? '' : 'opacity-60'}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {open ? '' : '🔒 '}{COLUMN_NAMES[c]}
              </span>
              {!open && (
                <span className="text-[10px] text-slate-500">{COLUMN_UNLOCK[c]} points dépensés requis</span>
              )}
            </div>
            <div className="space-y-1.5">
              {mods.map((m) => {
                const owned = hasArtifactMod(p, m.id);
                const affordable = open && !owned && avail >= m.cost;
                return (
                  <button
                    key={m.id}
                    onClick={() => affordable && unlock(m)}
                    disabled={!affordable}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      owned
                        ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40'
                        : affordable
                          ? 'bg-black/30 hover:bg-white/10'
                          : 'cursor-not-allowed bg-black/20'
                    }`}
                  >
                    <span className="text-xl leading-none">{m.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${owned ? 'text-emerald-200' : 'text-slate-200'}`}>{m.name}</div>
                      <div className="text-[11px] leading-snug text-slate-400">{m.desc}</div>
                    </div>
                    {owned ? (
                      <span className="shrink-0 text-[11px] font-bold text-emerald-300">✓</span>
                    ) : (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${affordable ? 'bg-white/10 text-slate-200' : 'text-slate-600'}`}>
                        {m.cost} pt{m.cost > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Panthéon personnel */}
      {(p.seasonHistory?.length ?? 0) > 0 && (
        <div className="rounded-xl bg-black/25 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">🏛️ Saisons passées</div>
          <div className="space-y-1">
            {[...(p.seasonHistory ?? [])].reverse().map((h) => {
              const t = seasonTheme(h.season);
              return (
                <div key={h.season} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{t.emoji} Saison {h.season} · {t.name}</span>
                  <span className="tabular-nums text-slate-300">artefact <b>{h.artifactLevel}</b> · Nv.{h.level}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        L'artefact repart de zéro à chaque saison — c'est ce qui remet les records des
        Abysses en jeu. Ton personnage, lui, n'est jamais touché : niveau, équipement et
        métiers sont conservés.
      </p>
    </div>
  );
}
