import { useUi } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';

export default function VeteranCard() {
  const close = useUi((s) => s.close);
  const open = useUi((s) => s.open);

  return (
    <div className="flex flex-col items-center p-4 text-center space-y-4">
      <h2 className="text-2xl font-bold text-emerald-400">Merci, Vétéran ! 🎉</h2>
      
      <p className="text-sm text-slate-300">
        Le jeu a subi une refonte majeure (reset global) pour équilibrer l'économie, les combats et introduire de nouvelles mécaniques.
      </p>

      <p className="text-sm text-slate-300">
        Merci d'avoir participé à l'alpha et d'avoir aidé à équilibrer le jeu ! En guise de remerciement, tu as reçu un lot de récompenses pour bien démarrer cette nouvelle aventure.
      </p>

      <div className="bg-black/30 p-3 rounded-lg w-full">
        <h3 className="font-semibold text-amber-300 mb-2">Tes récompenses de vétéran :</h3>
        <ul className="text-left text-sm text-slate-300 space-y-1 list-disc list-inside">
          <li><strong className="text-amber-400">1000 Pièces d'or</strong> 🪙</li>
          <li><strong className="text-fuchsia-400">1 Médaillon de l'Ancien Monde</strong> 🎖️ (Bijou exclusif)</li>
          <li>Le titre exclusif <strong className="text-emerald-300">Vétéran de l'Ancien Monde</strong></li>
        </ul>
      </div>

      <button
        onClick={() => {
          close('veteran');
          open('tuto', undefined, { singleton: true });
        }}
        className="mt-2 rounded-lg bg-emerald-500 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-emerald-400 hover:scale-105 active:scale-95"
      >
        Continuer vers le Tutoriel ➔
      </button>
    </div>
  );
}
