import { useState, useEffect } from 'react';
import { useGame } from '../../store/gameStore';
import { useFx } from '../../store/fxStore';

export default function SettingsCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);

  const [resetStep, setResetStep] = useState(0);
  const [resetText, setResetText] = useState('');

  // Default client settings
  const [settings, setSettings] = useState({
    muteSound: false,
    compactMode: false,
    disableAnimations: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rptext.settings');
      if (saved) setSettings({ ...settings, ...JSON.parse(saved) });
    } catch {}
  }, []);

  function updateSetting(key: keyof typeof settings, val: boolean) {
    const next = { ...settings, [key]: val };
    setSettings(next);
    localStorage.setItem('rptext.settings', JSON.stringify(next));
    if (key === 'disableAnimations') useFx.getState().setReduced(val);
    toast('Paramètre sauvegardé.', 'info');
  }

  function handleReset() {
    if (resetText !== 'Adieu mon personnage') {
      toast('Texte incorrect, annulation.', 'bad');
      setResetStep(0);
      setResetText('');
      return;
    }
    
    // Pour forcer le reset global, on met la date de création à 0
    // Le prochain chargement du joueur par playerService le considérera comme invalide et supprimera les données.
    mutate(d => { d.createdAt = 0; });
    toast('Personnage effacé... Rafraîchissement...', 'bad');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  if (!p) return null;

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-400">Paramètres client (sauvegardés sur cet appareil)</div>
      
      <div className="space-y-2 rounded-xl bg-black/25 p-4 text-sm">
        <label className="flex items-center justify-between hover:text-sky-300 cursor-pointer">
          <span>Couper les effets sonores (si applicable)</span>
          <input type="checkbox" checked={settings.muteSound} onChange={(e) => updateSetting('muteSound', e.target.checked)} className="h-4 w-4 rounded bg-black/40 accent-sky-500" />
        </label>
        
        <label className="flex items-start justify-between gap-3 hover:text-sky-300 cursor-pointer">
          <span>Réduire les animations <span className="block text-[10px] text-slate-500">Coupe le fond animé, les particules et les flous. Recommandé si le PC chauffe ou rame.</span></span>
          <input type="checkbox" checked={settings.disableAnimations} onChange={(e) => updateSetting('disableAnimations', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded bg-black/40 accent-sky-500" />
        </label>

        <label className="flex items-center justify-between hover:text-sky-300 cursor-pointer">
          <span>Mode Interface Compacte</span>
          <input type="checkbox" checked={settings.compactMode} onChange={(e) => updateSetting('compactMode', e.target.checked)} className="h-4 w-4 rounded bg-black/40 accent-sky-500" />
        </label>
      </div>

      <div className="mt-8 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
        <div className="mb-2 text-sm font-bold text-rose-400">Zone Dangereuse</div>
        <div className="text-xs text-slate-400 mb-4">
          Réinitialiser ton personnage effacera toutes tes statistiques, équipements, or, niveaux, etc. 
          Tu seras renvoyé à l'écran de sélection des classes.
        </div>
        
        {resetStep === 0 && (
          <button 
            onClick={() => setResetStep(1)} 
            className="w-full rounded bg-rose-600/30 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-600/50"
          >
            Réinitialiser mon personnage
          </button>
        )}
        
        {resetStep === 1 && (
          <div className="space-y-2 animate-floatIn">
            <div className="text-xs font-semibold text-rose-300">
              Pour confirmer, tape exactement : <span className="text-white select-all">Adieu mon personnage</span>
            </div>
            <input 
              type="text" 
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="Adieu mon personnage"
              className="w-full rounded bg-black/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex gap-2">
              <button 
                onClick={handleReset}
                className="flex-1 rounded bg-rose-600 py-2 text-sm font-bold shadow hover:bg-rose-500"
              >
                CONFIRMER LA SUPPRESSION
              </button>
              <button 
                onClick={() => { setResetStep(0); setResetText(''); }}
                className="flex-1 rounded bg-slate-700/50 py-2 text-sm hover:bg-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
