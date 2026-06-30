import { COMMANDS, type CommandDef } from '../../game/commands';

const CATEGORIES: CommandDef['category'][] = ['Jeu', 'Combat', 'Récolte', 'Casino', 'Multijoueur', 'Système'];

export default function HelpCard() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Tape une commande dans la barre du bas. <kbd className="rounded bg-black/40 px-1">Tab</kbd> complète,
        <kbd className="ml-1 rounded bg-black/40 px-1">↑/↓</kbd> rappelle l'historique,
        <kbd className="ml-1 rounded bg-black/40 px-1">Échap</kbd> ferme les fenêtres.
      </p>
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</div>
          <div className="space-y-1">
            {COMMANDS.filter((c) => c.category === cat).map((c) => (
              <div key={c.name} className="flex gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-sm">
                <span className="w-24 shrink-0 font-semibold text-sky-300">{c.name}</span>
                <span className="min-w-0 flex-1 text-slate-300">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">
        Alias dispo : profil, chasse, carte, inv, pari… Les fenêtres se ferment au rechargement
        de la page (ton état reste sauvegardé).
      </p>
    </div>
  );
}
