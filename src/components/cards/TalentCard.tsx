import { getTalentsForClass, spendTalent, resetTalents, talentMods, type TalentDef } from '../../game/talents';
import { useGame } from '../../store/gameStore';
import { CLASSES } from '../../game/classes';
import { ascendPlayer } from '../../game/player';
import { playSound } from '../../game/sound';
import type { ClassId } from '../../game/types';
import ItemIcon from '../ItemIcon';

export default function TalentCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const cls = CLASSES[p.classId];
  const baseId = cls.parent ?? p.classId;
  const isBaseClass = !cls.parent;
  const talents = getTalentsForClass(p.classId);
  const mods = talentMods(p);
  const points = p.talentPoints ?? 0;

  const rankOf = (id: string) => p.talents?.[id] ?? 0;
  const spent = talents.reduce((s, t) => s + rankOf(t.id), 0);
  const total = talents.reduce((s, t) => s + t.maxRank, 0);

  const baseTree = talents.filter((t) => t.classId === baseId);
  const specTree = talents.filter((t) => t.classId === p.classId && p.classId !== baseId);
  const unlockedSkills = talents.filter((t) => t.activeSkill && rankOf(t.id) > 0).map((t) => t.activeSkill!);
  const equipped = p.equippedSkills ?? [];

  const reqMet = (t: TalentDef) =>
    !t.requires || t.requires.every((r) => rankOf(r) >= 1);

  const learn = (t: TalentDef) => {
    let res: boolean | string = false;
    mutate((d) => { res = spendTalent(d, t.id); });
    const result = res as boolean | string;
    if (result === true) { playSound('coin'); } else if (typeof result === 'string') { toast(result, 'bad'); } else { toast('Erreur inconnue', 'bad'); }
  };
  const reset = () => {
    if (p.gold < 10000) return toast("Pas assez d'or (10 000 requis).", 'bad');
    if (!confirm('Réinitialiser tous tes talents pour 10 000 or ?')) return;
    let ok = false;
    mutate((d) => { ok = resetTalents(d); });
    if (ok) { playSound('coin'); toast('Arbre réinitialisé !', 'good'); }
  };
  const ascend = (id: ClassId) => {
    if (p.level < 20) return toast('Niveau 20 requis.', 'bad');
    if ((p.inventory['boss_soul'] ?? 0) < 1) return toast('Il te faut 1 Âme de Boss 💀.', 'bad');
    if (!confirm(`Ascension vers ${CLASSES[id].name} ? Tes talents seront réinitialisés (points rendus).`)) return;
    mutate((d) => {
      d.inventory['boss_soul'] -= 1;
      if (d.inventory['boss_soul'] <= 0) delete d.inventory['boss_soul'];
      ascendPlayer(d, id);
    });
    playSound('levelup');
    toast(`Ascension ! Tu es désormais ${CLASSES[id].name} !`, 'good');
  };
  const toggleSkill = (skillId: string) => {
    mutate((d) => {
      if (!d.equippedSkills) d.equippedSkills = [];
      if (d.equippedSkills.includes(skillId)) d.equippedSkills = d.equippedSkills.filter((s) => s !== skillId);
      else if (d.equippedSkills.length >= 4) useGame.getState().toast('4 compétences max.', 'bad');
      else d.equippedSkills.push(skillId);
    });
  };

  const ascensions = Object.entries(CLASSES).filter(([, c]) => c.parent === p.classId) as [ClassId, typeof cls][];

  /**
   * Aperçu du gain réel : « 7% → 12% » plutôt que « +5% par rang ».
   * Le joueur voit ce que le point ACHÈTE, pas seulement ce qu'il coûte.
   */
  const FLAT_KEYS = new Set(['regen', 'flatDmg']);
  function gainPreview(t: TalentDef, rank: number): string | null {
    if (!t.perRank) return null;
    const [key, per] = Object.entries(t.perRank)[0] ?? [];
    if (!key || typeof per !== 'number') return null;
    const cur = per * rank;
    const next = per * (rank + 1);
    const f = (v: number) => (FLAT_KEYS.has(key) ? `${Math.round(v)}` : `${Math.round(v * 100)}%`);
    return `${f(cur)} → ${f(next)}`;
  }

  const renderNode = (t: TalentDef) => {
    const rank = rankOf(t.id);
    const maxed = rank >= t.maxRank;
    const ok = reqMet(t);
    const isSkill = !!t.activeSkill;
    const canLearn = ok && !maxed && points > 0;
    return (
      <div
        key={t.id}
        className={`flex h-[136px] w-[150px] shrink-0 flex-col rounded-xl border p-2.5 transition-all ${
          maxed ? 'border-sky-400/60 bg-sky-500/10'
          : rank > 0 ? 'border-sky-500/30 bg-black/40'
          : ok ? 'border-slate-700 bg-black/30'
          : 'border-slate-800 bg-black/20 opacity-55'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{t.icon}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold" title={t.name}>{t.name}</span>
          {isSkill && <span className="rounded bg-purple-500/25 px-1 text-[9px] text-purple-200">SKILL</span>}
        </div>

        {/* Pips de rang */}
        <div className="mt-1.5 flex items-center gap-1">
          {Array.from({ length: t.maxRank }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < rank ? 'bg-sky-400' : 'bg-slate-700'}`} />
          ))}
          <span className="ml-1 text-[9px] tabular-nums text-slate-400">{rank}/{t.maxRank}</span>
        </div>

        <div className="mt-1 h-8 overflow-hidden text-[10px] leading-tight text-slate-400">{t.desc}</div>
        {/* Ce que le prochain point achete concretement. */}
        <div className="mb-1 h-3 text-[9px] font-semibold tabular-nums text-sky-300/80">
          {!maxed && gainPreview(t, rank)}
        </div>
        <div className="mt-auto" />

        {maxed ? (
          isSkill ? (
            <button
              onPointerDown={() => toggleSkill(t.activeSkill!.id)}
              className={`w-full rounded py-1 text-[10px] font-bold ${equipped.includes(t.activeSkill!.id) ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-600'}`}
            >
              {equipped.includes(t.activeSkill!.id) ? '✓ Équipé' : 'Équiper'}
            </button>
          ) : (
            <div className="rounded bg-sky-500/15 py-1 text-center text-[10px] font-bold text-sky-300">Maîtrisé</div>
          )
        ) : (
          <button
            onPointerDown={(e) => { e.stopPropagation(); learn(t); }}
            disabled={!canLearn}
            className="w-full rounded bg-sky-500/30 py-1 text-[10px] font-bold hover:bg-sky-500/50 disabled:opacity-40"
          >
            {!ok ? '🔒 Prérequis' : points <= 0 ? 'Aucun point' : '＋ Investir'}
          </button>
        )}
        {isSkill && rank > 0 && !maxed && (
          <button
            onPointerDown={() => toggleSkill(t.activeSkill!.id)}
            className={`mt-1 w-full rounded py-1 text-[10px] font-bold ${equipped.includes(t.activeSkill!.id) ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-600'}`}
          >
            {equipped.includes(t.activeSkill!.id) ? '✓ Équipé' : 'Équiper'}
          </button>
        )}
      </div>
    );
  };

  // Grille de l'arbre : les nœuds portent déjà des coordonnées (pos.x ∈ -2..2,
  // pos.y = palier), on les positionne donc réellement plutôt que d'empiler des
  // rangées. C'est ce qui permet de TRACER les liens de prérequis — auparavant
  // un simple trait vertical décoratif suggérait un enchaînement qui n'existait
  // pas visuellement, et rien ne disait quel nœud débloquait quel autre.
  const NODE_W = 150;
  const NODE_H = 136;
  const GAP_X = 14;
  const GAP_Y = 40;
  const CELL_W = NODE_W + GAP_X;
  const CELL_H = NODE_H + GAP_Y;

  function Tree({ nodes }: { nodes: TalentDef[] }) {
    if (nodes.length === 0) return null;
    const xs = nodes.map((t) => t.pos.x);
    const ys = nodes.map((t) => t.pos.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const width = cols * CELL_W - GAP_X;
    const height = rows * CELL_H - GAP_Y;

    const left = (t: TalentDef) => (t.pos.x - minX) * CELL_W;
    const top = (t: TalentDef) => (t.pos.y - minY) * CELL_H;
    const cx = (t: TalentDef) => left(t) + NODE_W / 2;

    const byId = new Map(nodes.map((t) => [t.id, t]));

    return (
      <div className="overflow-x-auto pb-1">
        <div className="relative mx-auto" style={{ width, height }}>
          {/* Liens de prérequis, sous les nœuds. Un lien s'allume dès que son
              prérequis est investi : on voit d'un coup d'œil les chemins ouverts. */}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
            {nodes.flatMap((t) =>
              (t.requires ?? []).map((reqId) => {
                const from = byId.get(reqId);
                if (!from) return null;
                const active = rankOf(reqId) >= 1;
                return (
                  <line
                    key={`${reqId}->${t.id}`}
                    x1={cx(from)} y1={top(from) + NODE_H}
                    x2={cx(t)} y2={top(t)}
                    stroke={active ? '#38bdf8' : '#334155'}
                    strokeWidth={active ? 2 : 1.5}
                    strokeDasharray={active ? undefined : '4 4'}
                  />
                );
              }),
            )}
          </svg>
          {nodes.map((t) => (
            <div key={t.id} className="absolute" style={{ left: left(t), top: top(t) }}>
              {renderNode(t)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-3">
      {/* En-tête : classe + points */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/30 p-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cls.emoji}</span>
          <div>
            <div className="text-sm font-bold">{cls.name}</div>
            <div className="text-[10px] text-slate-400">Investi {spent}/{total} de l'arbre</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${points > 0 ? 'bg-emerald-500/25 text-emerald-200' : 'bg-slate-700/50 text-slate-400'}`}>
            🎯 {points} point{points > 1 ? 's' : ''}
          </span>
          <button onClick={reset} className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/40">
            🔄 Reset (10k 🪙)
          </button>
        </div>
      </div>

      {/* Note : l'arbre est plus grand que les points → on se spécialise. */}
      {total > 0 && (
        <p className="px-1 text-[11px] text-slate-500">
          L'arbre compte <b className="text-slate-300">{total} points</b> à investir : impossible de tout prendre, choisis ta voie (le reset permet de re-tester).
        </p>
      )}

      {/* Barre de compétences équipées (4 slots) */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Compétences en combat · {equipped.length}/4</div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const sid = equipped[i];
            const sk = sid ? unlockedSkills.find((s) => s.id === sid) : null;
            return (
              <button
                key={i}
                onClick={() => sk && toggleSkill(sk.id)}
                title={sk ? `${sk.name} — ${sk.desc}` : 'Emplacement libre'}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-center ${sk ? 'border-purple-400/40 bg-purple-500/15' : 'border-dashed border-slate-700 bg-black/20'}`}
              >
                <span className="text-lg leading-none">{sk ? sk.icon : '＋'}</span>
                <span className="max-w-full truncate px-1 text-[9px] text-slate-300">{sk ? sk.name : 'Vide'}</span>
              </button>
            );
          })}
        </div>
        {unlockedSkills.length === 0 && (
          <p className="mt-2 text-[10px] text-slate-500">Débloque des compétences (nœuds « SKILL ») dans l'arbre ci-dessous, puis équipe-les ici.</p>
        )}
      </div>

      {/* Ascension */}
      {isBaseClass && ascensions.length > 0 && (
        <div className={`rounded-xl border p-3 ${p.level >= 20 ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-black/20'}`}>
          <div className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-300">
            🌟 Ascension {p.level >= 20 ? (
              <span className="inline-flex items-center gap-1">(1 <ItemIcon id="boss_soul" size={14} /> Âme de Boss requise)</span>
            ) : `(niveau 20 requis — tu es niv.${p.level})`}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ascensions.map(([id, c]) => (
              <button
                key={id}
                onClick={() => ascend(id)}
                disabled={p.level < 20}
                className="rounded-lg border border-amber-500/20 bg-black/40 p-2 text-left transition-all hover:border-amber-500/50 hover:bg-black/60 disabled:opacity-40"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xl">{c.emoji}</span>
                  <span className="text-sm font-bold text-amber-200">{c.name}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-amber-200/70">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Arbre : base + spécialisation */}
      <div className="max-h-[52vh] space-y-4 overflow-y-auto rounded-xl bg-black/25 p-3">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Classe de base — {CLASSES[baseId].name}</div>
          <Tree nodes={baseTree} />
        </div>
        {specTree.length > 0 && (
          <div className="border-t border-slate-800 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-300/80">Spécialisation — {cls.name}</div>
            <Tree nodes={specTree} />
          </div>
        )}
      </div>

      {/* Effets actifs */}
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
