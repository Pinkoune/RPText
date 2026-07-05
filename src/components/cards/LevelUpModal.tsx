import { useUi } from '../../store/uiStore';
import { COMMANDS } from '../../game/commands';

export default function LevelUpModal({ win }: { win: any }) {
  const close = useUi((s) => s.close);
  const { newLevel, unlockedFeatures } = win.payload as { newLevel: number, unlockedFeatures: string[] };

  return (
    <div className="space-y-4 p-2 text-center text-slate-300">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-emerald-400 mb-1">Niveau {newLevel} ! 🎉</h2>
        <p className="text-sm text-emerald-200/70">Tu as gagné en puissance.</p>
      </div>

      {unlockedFeatures.length > 0 ? (
        <div className="space-y-3 rounded-xl bg-black/20 p-4 text-left">
          <h3 className="font-semibold text-amber-400">Nouvelles fonctionnalités débloquées :</h3>
          <div className="space-y-2 mt-2">
            {unlockedFeatures.map(feat => {
              const cmd = COMMANDS.find(c => c.name === feat);
              return (
                <div key={feat} className="flex gap-2 text-sm">
                  <span className="shrink-0 font-mono text-sky-300 w-20">{feat}</span>
                  <span className="text-slate-300">{cmd?.desc || ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-black/20 p-4 text-sm text-slate-400">
          Continue ton aventure pour débloquer de nouvelles choses au prochain niveau !
        </div>
      )}

      <button
        onClick={() => close(win.id)}
        className="mt-4 w-full rounded-xl bg-emerald-500/20 py-2.5 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 active:scale-[0.98]"
      >
        Super !
      </button>
    </div>
  );
}
