import { useState } from 'react';
import { useUi } from '../../store/uiStore';
import { COMMANDS } from '../../game/commands';

export default function TutorialCard({ win }: { win: any }) {
  const close = useUi((s) => s.close);
  const [page, setPage] = useState(0);

  return (
    <div className="space-y-4 p-1 text-sm text-slate-300">
      <div className="mb-2 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Bienvenue dans RPText ! 👋</h2>
        <p className="text-slate-400">Prépare-toi pour une aventure textuelle épique.</p>
      </div>

      {page === 0 ? (
        <>
          <div className="space-y-3 rounded-xl bg-black/20 p-3">
            <h3 className="font-semibold text-sky-400">🎮 Comment jouer ?</h3>
            <p>Le jeu fonctionne grâce à des <strong>commandes</strong>. Tape une commande dans la barre en bas et appuie sur <kbd className="rounded bg-black/40 px-1 text-xs">Entrée</kbd>.</p>
            
            <div className="flex gap-2">
              <span className="w-16 shrink-0 font-mono text-xs text-sky-300">hunt</span>
              <span>Pars chasser pour gagner de l'expérience et de l'or.</span>
            </div>
            
            <div className="flex gap-2">
              <span className="w-16 shrink-0 font-mono text-xs text-sky-300">heal</span>
              <span>Bois une potion pour récupérer de la vie.</span>
            </div>

            <div className="flex gap-2">
              <span className="w-16 shrink-0 font-mono text-xs text-sky-300">profile</span>
              <span>Regarde tes statistiques et ton niveau.</span>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-black/20 p-3">
            <h3 className="font-semibold text-emerald-400">🌟 Progression</h3>
            <p>
              Au fur et à mesure que tu montes de niveau, tu débloqueras de nouvelles fonctionnalités (Quêtes, Récolte, Forge, Donjons, Boss...). 
              Un message t'avertira à chaque nouveauté !
            </p>
          </div>

          <div className="space-y-3 rounded-xl bg-black/20 p-3">
            <h3 className="font-semibold text-amber-400">💡 Astuces</h3>
            <ul className="list-inside list-disc space-y-1 text-slate-400">
              <li>Tape <strong className="text-white">help</strong> pour voir toutes les commandes débloquées.</li>
              <li>Tape <strong className="text-white">wiki</strong> pour consulter l'encyclopédie du jeu.</li>
              <li>Utilise la touche <kbd className="rounded bg-black/40 px-1 text-xs">Tab</kbd> pour auto-compléter une commande.</li>
            </ul>
          </div>

          <button
            onClick={() => setPage(1)}
            className="mt-4 w-full rounded-xl bg-sky-500/20 py-2.5 font-semibold text-sky-300 transition-colors hover:bg-sky-500/30 active:scale-[0.98]"
          >
            Suivant
          </button>
        </>
      ) : (
        <>
          <div className="space-y-3 rounded-xl bg-black/20 p-3">
            <h3 className="font-semibold text-emerald-400">🔓 Tableau des Déblocages</h3>
            <p className="mb-2">Voici ce qui t'attend lors de tes montées en niveau :</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 22, 50].map(lvl => {
                const cmds = COMMANDS.filter(c => c.reqLevel === lvl);
                if (cmds.length === 0) return null;
                return (
                  <div key={lvl} className="border-l-2 border-emerald-500/50 pl-2">
                    <span className="font-bold text-emerald-300">Niveau {lvl}</span>
                    <div className="mt-1 space-y-1">
                      {cmds.map(c => (
                        <div key={c.name} className="flex gap-2">
                          {/* Commande secrète : on la teasse en « ??? » sans rien révéler. */}
                          <span className="w-20 shrink-0 font-mono text-xs text-purple-300">{c.hidden ? '???' : c.name}</span>
                          <span className="text-xs text-slate-400">{c.hidden ? 'Un mal ancien t\'attend au bout du chemin...' : c.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setPage(0)}
              className="flex-1 rounded-xl bg-slate-500/20 py-2.5 font-semibold text-slate-300 transition-colors hover:bg-slate-500/30 active:scale-[0.98]"
            >
              Précédent
            </button>
            <button
              onClick={() => close(win.id)}
              className="flex-1 rounded-xl bg-sky-500/20 py-2.5 font-semibold text-sky-300 transition-colors hover:bg-sky-500/30 active:scale-[0.98]"
            >
              Commencer l'aventure !
            </button>
          </div>
        </>
      )}
    </div>
  );
}
