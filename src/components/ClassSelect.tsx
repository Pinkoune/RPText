import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { BASE_CLASSES } from '../game/classes';
import type { ClassId } from '../game/types';

export default function ClassSelect() {
  const user = useGame((s) => s.user);
  const chooseClass = useGame((s) => s.chooseClass);
  const [name, setName] = useState(user?.name ?? '');
  const [sel, setSel] = useState<ClassId | null>(null);

  return (
    <div className="grid h-full place-items-center overflow-auto bg-gradient-to-b from-[#0b1020] to-[#1a2b52] px-4 py-8">
      <div className="glass w-full max-w-2xl rounded-2xl p-6 animate-floatIn">
        <h1 className="text-2xl font-bold text-glow">Crée ton héros</h1>
        <p className="mt-1 text-sm text-slate-300">Choisis un nom et une classe.</p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 18))}
          placeholder="Nom du héros"
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none focus:border-sky-400/60"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BASE_CLASSES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              className={`rounded-xl border p-4 text-left transition ${
                sel === c.id
                  ? 'border-sky-400 bg-sky-400/10 animate-pulseGlow'
                  : 'border-white/10 bg-black/20 hover:border-white/30'
              }`}
            >
              <div className="text-lg font-semibold">
                {c.emoji} {c.name}
              </div>
              <div className="mt-1 text-xs text-slate-300">{c.desc}</div>
              <div className="mt-2 text-xs text-slate-400">
                PV {c.base.maxHp} · ATK {c.base.atk} · DEF {c.base.def}
              </div>
            </button>
          ))}
        </div>

        <button
          disabled={!sel || !name.trim()}
          onClick={() => sel && chooseClass(sel, name.trim())}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white transition enabled:hover:bg-sky-400 disabled:opacity-40"
        >
          Commencer l'aventure
        </button>
      </div>
    </div>
  );
}
