import { useGame } from '../../store/gameStore';
import { talentsForClass, spendTalent, talentMods, pointsSpentInClass, type TalentTier } from '../../game/talents';
import { CLASSES } from '../../game/classes';
import { playSound } from '../../game/sound';

const TIER_LABEL: Record<TalentTier, string> = {
  1: 'Palier I',
  2: 'Palier II — 5 points investis requis',
  3: 'Palier III — 10 points investis requis',
};

export default function TalentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const cls = CLASSES[p.classId];
  const talents = talentsForClass(p.classId);
  const mods = talentMods(p);
  const spent = pointsSpentInClass(p, p.classId);

  function learn(id: string, name: string) {
    if ((p!.talentPoints ?? 0) <= 0) {
      toast('Aucun point de talent. Monte de niveau !', 'bad');
      return;
    }
    let ok = false;
    mutate((d) => { ok = spendTalent(d, id); });
    if (ok) { playSound('coin'); toast(`${name} amélioré !`, 'good'); }
    else toast('Palier verrouillé ou talent au rang maximum.', 'bad');
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const tiers: TalentTier[] = [1, 2, 3];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">{cls.emoji} Talents — {cls.name}</span>
        <span className="rounded-full bg-sky-500/25 px-2.5 py-1 text-xs font-semibold">
          {p.talentPoints ?? 0} point{(p.talentPoints ?? 0) > 1 ? 's' : ''} · {spent} investis
        </span>
      </div>

      {tiers.map((tier) => {
        const tierTalents = talents.filter((t) => t.tier === tier);
        const unlocked = spent >= tierTalents[0]?.reqPoints;
        return (
          <div key={tier} className={`space-y-2 rounded-xl p-2 ${unlocked ? '' : 'opacity-50'}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {!unlocked && <span>🔒</span>}
              {TIER_LABEL[tier]}
            </div>
            {tierTalents.map((t) => {
              const rank = p.talents?.[t.id] ?? 0;
              const maxed = rank >= t.maxRank;
              return (
                <div
                  key={t.id}
                  className={`rounded-xl p-3 ${t.capstone ? 'border border-amber-400/40 bg-amber-500/10' : 'bg-black/25'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t.capstone && '⭐ '}{t.icon} {t.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{rank}/{t.maxRank}</span>
                      <button
                        onClick={() => learn(t.id, t.name)}
                        disabled={!unlocked || maxed || (p.talentPoints ?? 0) <= 0}
                        className="rounded bg-sky-500/30 px-2 py-1 text-xs font-semibold hover:bg-sky-500/50 disabled:opacity-40"
                      >
                        {maxed ? 'Max' : '＋'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{t.desc}</div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: t.maxRank }, (_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded ${i < rank ? (t.capstone ? 'bg-amber-400' : 'bg-sky-400') : 'bg-black/40'}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Récapitulatif des effets actifs */}
      <div className="rounded-lg bg-black/25 px-3 py-2 text-[11px] text-slate-300">
        <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Effets actifs</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {mods.crit > 0 && <span>💥 Critique {pct(mods.crit)}</span>}
          {mods.critMult > 0 && <span>💢 Mult. crit +{mods.critMult.toFixed(2)}</span>}
          {mods.dmgReduction > 0 && <span>🛡️ Réduction {pct(mods.dmgReduction)}</span>}
          {mods.dodge > 0 && <span>💨 Esquive {pct(mods.dodge)}</span>}
          {mods.doubleHit > 0 && <span>🏹 Double {pct(mods.doubleHit)}</span>}
          {mods.regen > 0 && <span>💚 Régén {mods.regen}/tour</span>}
          {mods.berserkBonus > 0 && <span>😤 Furie +{pct(mods.berserkBonus)}</span>}
          {mods.flatDmg > 0 && <span>✨ Dégâts +{mods.flatDmg}</span>}
          {mods.lifesteal > 0 && <span>🩸 Vol de vie {pct(mods.lifesteal)}</span>}
          {mods.armorPen > 0 && <span>🗡️ Perce-armure {pct(mods.armorPen)}</span>}
          {mods.execute > 0 && <span>☠️ Exécution +{pct(mods.execute)}</span>}
          {mods.thorns > 0 && <span>🔩 Épines {pct(mods.thorns)}</span>}
          {mods.atkPct > 0 && <span>⚔️ ATK +{pct(mods.atkPct)}</span>}
          {mods.defPct > 0 && <span>🛡️ DEF +{pct(mods.defPct)}</span>}
          {mods.hpPct > 0 && <span>❤️ PV +{pct(mods.hpPct)}</span>}
        </div>
      </div>
    </div>
  );
}
