import { COMMANDS, type CommandDef } from '../../game/commands';
import { useGame } from '../../store/gameStore';

const CATEGORIES: { id: CommandDef['category']; icon: string }[] = [
  { id: 'Jeu', icon: '🎮' },
  { id: 'Combat', icon: '⚔️' },
  { id: 'Récolte', icon: '🌿' },
  { id: 'Casino', icon: '🎰' },
  { id: 'Multijoueur', icon: '👥' },
  { id: 'Système', icon: '⚙️' },
];

export default function HelpCard() {
  const p = useGame((s) => s.player);
  const lvl = p?.level ?? 0;
  const ignoreReq = p?.ignoreRestrictions ?? false;

  return (
    <div className="space-y-3">
      {/* Astuce d'utilisation */}
      <div className="rounded-xl bg-black/25 p-3 text-xs text-slate-300">
        <div className="mb-1 font-semibold text-slate-200">Comment jouer</div>
        <p>Tape une commande dans la barre du bas (ou utilise le menu sur mobile).</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span><kbd className="rounded bg-black/40 px-1">Tab</kbd> complète</span>
          <span><kbd className="rounded bg-black/40 px-1">↑ / ↓</kbd> historique</span>
          <span><kbd className="rounded bg-black/40 px-1">Échap</kbd> ferme</span>
        </div>
      </div>

      {CATEGORIES.map(({ id: cat, icon }) => {
        const cmds = COMMANDS
          .filter((c) => c.category === cat && !c.hidden)
          .sort((a, b) => (a.reqLevel ?? 1) - (b.reqLevel ?? 1) || a.name.localeCompare(b.name));
        if (cmds.length === 0) return null;
        return (
          <div key={cat}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon} {cat}</div>
            <div className="space-y-1">
              {cmds.map((c) => {
                const locked = !ignoreReq && (c.reqLevel ?? 1) > lvl;
                const alias = c.aliases[0];
                return (
                  <div
                    key={c.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${locked ? 'bg-black/10 opacity-50' : 'bg-black/20'}`}
                  >
                    <span className={`w-24 shrink-0 font-mono text-[13px] font-semibold ${locked ? 'text-slate-400' : 'text-sky-300'}`}>
                      {locked && '🔒 '}{c.name}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-300">
                      {c.desc}
                      {alias && <span className="ml-1 text-[10px] text-slate-500">— alias : {alias}</span>}
                    </span>
                    {locked && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">Nv.{c.reqLevel}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] text-slate-500">
        🔒 = se débloque plus tard (le niveau requis est indiqué). Les fenêtres se ferment au
        rechargement de la page — ton état reste sauvegardé.
      </p>
    </div>
  );
}
