import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { BASE_CLASSES, getAscensions } from '../game/classes';
import type { ClassId } from '../game/types';
import { isNameTaken } from '../firebase/playerService';

export default function ClassSelect() {
  const user = useGame((s) => s.user);
  const chooseClass = useGame((s) => s.chooseClass);
  const [name, setName] = useState(user?.name ?? '');
  const [sel, setSel] = useState<ClassId | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [autoRenamed, setAutoRenamed] = useState(false);

  // Si le pseudo par défaut (fourni par Google/GitHub/Microsoft) est déjà pris
  // par un autre joueur, on en propose un temporaire distinct plutôt que de
  // bloquer la connexion — l'utilisateur reste libre de le changer ensuite.
  useEffect(() => {
    if (!user?.name) return;
    let alive = true;
    isNameTaken(user.name, user.uid).then((taken) => {
      if (!alive || !taken) return;
      const temp = `${user.name.slice(0, 14)}${Math.floor(1000 + Math.random() * 9000)}`;
      setName(temp);
      setAutoRenamed(true);
    });
    return () => { alive = false; };
  }, [user?.name, user?.uid]);

  async function submit() {
    if (!sel) return;
    const clean = name.trim();
    if (!clean) return;
    setChecking(true);
    setNameError(null);
    try {
      const taken = await isNameTaken(clean, user?.uid);
      if (taken) { setNameError('Ce pseudo est déjà pris.'); return; }
      chooseClass(sel, clean);
    } finally {
      setChecking(false);
    }
  }

  const selClass = sel ? BASE_CLASSES.find((c) => c.id === sel) : null;
  const ascensions = sel ? getAscensions(sel) : [];

  return (
    <div className="grid h-full place-items-center overflow-auto bg-gradient-to-b from-[#0b1020] to-[#1a2b52] px-4 py-8">
      <div className="glass w-full max-w-3xl rounded-2xl p-6 animate-floatIn">
        <h1 className="text-2xl font-bold text-glow">Crée ton héros</h1>
        <p className="mt-1 text-sm text-slate-300">Choisis un nom, puis une classe. Clique une classe pour découvrir son style de jeu.</p>

        <input
          value={name}
          onChange={(e) => { setName(e.target.value.slice(0, 18)); setNameError(null); setAutoRenamed(false); }}
          placeholder="Nom du héros"
          className={`mt-4 w-full rounded-xl border bg-black/30 px-4 py-2.5 outline-none ${nameError ? 'border-rose-500/60 focus:border-rose-400' : 'border-white/10 focus:border-sky-400/60'}`}
        />
        {nameError && <p className="mt-1 text-xs text-rose-400">{nameError}</p>}
        {autoRenamed && !nameError && (
          <p className="mt-1 text-xs text-amber-300">Ce pseudo était déjà pris, un nom temporaire t'a été attribué — tu peux le changer.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BASE_CLASSES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                sel === c.id
                  ? 'border-sky-400 bg-sky-400/10 animate-pulseGlow'
                  : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              <span className="text-3xl leading-none">{c.emoji}</span>
              <span className="mt-1.5 text-sm font-semibold">{c.name}</span>
              <span className="mt-1 text-[10px] leading-tight text-slate-400">
                PV {c.base.maxHp} · ATK {c.base.atk} · DEF {c.base.def}
              </span>
            </button>
          ))}
        </div>

        {/* Panneau détaillé de la classe sélectionnée */}
        {selClass ? (
          <div className="mt-4 rounded-xl border border-sky-400/25 bg-black/25 p-4 animate-floatIn">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{selClass.emoji}</span>
              <span className="text-lg font-bold text-sky-300">{selClass.name}</span>
              <span className="ml-auto text-[10px] text-slate-500">
                ❤️ {selClass.base.maxHp} (+{selClass.growth.maxHp}/nv) · 🗡️ {selClass.base.atk} (+{selClass.growth.atk}/nv) · 🛡️ {selClass.base.def} (+{selClass.growth.def}/nv)
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-amber-200/90">{selClass.desc}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{selClass.playstyle}</p>

            {ascensions.length > 0 && (
              <div className="mt-3 rounded-lg bg-black/30 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-300">
                  <span>⭐ Ascensions</span>
                  <span className="rounded-full bg-purple-500/25 px-2 py-0.5 text-[10px] font-bold text-purple-100">Niveau 20</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Au niveau 20, tu choisiras l'une de ces 3 spécialisations pour affiner ton style :
                </p>
                <div className="mt-2 space-y-1.5">
                  {ascensions.map((sub) => (
                    <div key={sub.id} className="rounded-lg bg-black/25 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{sub.emoji}</span>
                        <span className="text-xs font-semibold text-emerald-300">{sub.name}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{sub.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-white/5 bg-black/15 p-4 text-center text-xs text-slate-500">
            Sélectionne une classe ci-dessus pour voir son style de jeu et ses spécialisations.
          </p>
        )}

        <button
          disabled={!sel || !name.trim() || checking}
          onClick={submit}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white transition enabled:hover:bg-sky-400 disabled:opacity-40"
        >
          {checking ? 'Vérification…' : "Commencer l'aventure"}
        </button>
      </div>
    </div>
  );
}
