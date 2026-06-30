import { useGame } from '../../store/gameStore';
import { talentsForClass, spendTalent, talentMods } from '../../game/talents';
import { CLASSES } from '../../game/classes';
import { playSound } from '../../game/sound';

export default function TalentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const cls = CLASSES[p.classId];
  const talents = talentsForClass(p.classId);
  const mods = talentMods(p);

  function learn(id: string, name: string) {
    if ((p!.talentPoints ?? 0) <= 0) {
      toast('Aucun point de talent. Monte de niveau !', 'bad');
      return;
    }
    let ok = false;
    mutate((d) => { ok = spendTalent(d, id); });
    if (ok) { playSound('coin'); toast(`${name} amélioré !`, 'good'); }
    else toast('Talent au rang maximum.', 'bad');
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">{cls.emoji} Talents — {cls.name}</span>
        <span className="rounded-full bg-sky-500/25 px-2.5 py-1 text-xs font-semibold">
          {p.talentPoints ?? 0} point{(p.talentPoints ?? 0) > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {talents.map((t) => {
          const rank = p.talents?.[t.id] ?? 0;
          const maxed = rank >= t.maxRank;
          return (
            <div key={t.id} className="rounded-xl bg-black/25 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t.icon} {t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{rank}/{t.maxRank}</span>
                  <button
                    onClick={() => learn(t.id, t.name)}
                    disabled={maxed || (p.talentPoints ?? 0) <= 0}
                    className="rounded bg-sky-500/30 px-2 py-1 text-xs font-semibold hover:bg-sky-500/50 disabled:opacity-40"
                  >
                    {maxed ? 'Max' : '＋'}
                  </button>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{t.desc}</div>
              <div className="mt-1.5 flex gap-1">
                {Array.from({ length: t.maxRank }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded ${i < rank ? 'bg-sky-400' : 'bg-black/40'}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Récapitulatif des effets actifs */}
      <div className="rounded-lg bg-black/25 px-3 py-2 text-[11px] text-slate-300">
        <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Effets en combat</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {mods.crit > 0 && <span>💥 Critique {pct(mods.crit)}</span>}
          {mods.dmgReduction > 0 && <span>🛡️ Réduction {pct(mods.dmgReduction)}</span>}
          {mods.dodge > 0 && <span>💨 Esquive {pct(mods.dodge)}</span>}
          {mods.doubleHit > 0 && <span>🏹 Double {pct(mods.doubleHit)}</span>}
          {mods.regen > 0 && <span>💚 Régén {mods.regen}/tour</span>}
          {mods.berserkBonus > 0 && <span>😤 Furie +{pct(mods.berserkBonus)}</span>}
          {mods.flatDmg > 0 && <span>✨ Dégâts +{mods.flatDmg}</span>}
          {mods.crit === 0 && mods.dmgReduction === 0 && mods.dodge === 0 && mods.doubleHit === 0 && mods.regen === 0 && mods.berserkBonus === 0 && mods.flatDmg === 0 && (
            <span className="text-slate-500">Aucun talent investi pour l'instant.</span>
          )}
        </div>
      </div>
    </div>
  );
}
