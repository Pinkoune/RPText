import { useState } from 'react';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'tree' | 'skills' | 'ascend'>('tree');
  const [branch, setBranch] = useState<'base' | 'spec'>('spec');
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

  /** Tuile compacte : icône + rang. Le détail vit dans un panneau dédié. */
  const renderNode = (t: TalentDef) => {
    const rank = rankOf(t.id);
    const maxed = rank >= t.maxRank;
    const ok = reqMet(t);
    const isSkill = !!t.activeSkill;
    const isSel = selectedId === t.id;
    return (
      <button
        key={t.id}
        onClick={() => setSelectedId(t.id)}
        title={t.name}
        className={`relative grid h-[56px] w-[56px] place-items-center rounded-xl border transition ${
          isSel ? 'border-sky-300 ring-2 ring-sky-400/50'
          : maxed ? 'border-sky-400/60'
          : rank > 0 ? 'border-sky-500/40'
          : ok ? 'border-slate-700 hover:border-slate-500'
          : 'border-slate-800'
        } ${
          maxed ? 'bg-sky-500/20' : rank > 0 ? 'bg-sky-500/10' : ok ? 'bg-black/35' : 'bg-black/20 opacity-50'
        }`}
      >
        <span className="text-2xl leading-none">{t.icon}</span>
        {/* Rang en pastille : l'information la plus utile en un coup d'œil. */}
        <span
          className={`absolute -bottom-1 right-1 rounded px-1 text-[9px] font-bold tabular-nums ${
            maxed ? 'bg-sky-400 text-black' : rank > 0 ? 'bg-sky-500/70 text-white' : 'bg-black/70 text-slate-400'
          }`}
        >
          {rank}/{t.maxRank}
        </span>
        {isSkill && <span className="absolute -top-1 -left-1 rounded bg-purple-500 px-1 text-[8px] font-bold text-white">S</span>}
      </button>
    );
  };

  /** Panneau de détail du nœud sélectionné — remplace le texte dans chaque tuile. */
  function NodeDetail({ t }: { t: TalentDef }) {
    const rank = rankOf(t.id);
    const maxed = rank >= t.maxRank;
    const ok = reqMet(t);
    const isSkill = !!t.activeSkill;
    const canLearn = ok && !maxed && points > 0;
    const missing = (t.requires ?? []).filter((r) => rankOf(r) < 1)
      .map((r) => talents.find((x) => x.id === r)?.name ?? r);
    return (
      <div className="rounded-xl bg-black/35 p-3">
        <div className="flex items-start gap-2.5">
          <span className="text-2xl leading-none">{t.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-100">{t.name}</span>
              {isSkill && <span className="shrink-0 rounded bg-purple-500/25 px-1.5 text-[9px] font-bold text-purple-200">COMPÉTENCE</span>}
              <span className="ml-auto shrink-0 text-[11px] font-bold tabular-nums text-sky-300">{rank}/{t.maxRank}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.desc}</p>
            {!maxed && gainPreview(t, rank) && (
              <p className="mt-1 text-[11px] font-semibold tabular-nums text-sky-300">{gainPreview(t, rank)}</p>
            )}
            {missing.length > 0 && (
              <p className="mt-1 text-[11px] text-rose-300">🔒 Requiert : {missing.join(', ')}</p>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex gap-2">
          {!maxed && (
            <button
              onClick={() => learn(t)}
              disabled={!canLearn}
              className="flex-1 rounded-lg bg-sky-500/35 py-2 text-xs font-bold hover:bg-sky-500/55 disabled:opacity-35"
            >
              {!ok ? '🔒 Prérequis manquants' : points <= 0 ? 'Aucun point disponible' : `＋ Investir (${points} restants)`}
            </button>
          )}
          {maxed && !isSkill && (
            <div className="flex-1 rounded-lg bg-sky-500/15 py-2 text-center text-xs font-bold text-sky-300">Maîtrisé</div>
          )}
          {isSkill && rank > 0 && (
            <button
              onClick={() => toggleSkill(t.activeSkill!.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${equipped.includes(t.activeSkill!.id) ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/60 text-slate-200 hover:bg-slate-600'}`}
            >
              {equipped.includes(t.activeSkill!.id) ? '✓ Équipée' : 'Équiper en combat'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grille de l'arbre : les nœuds portent déjà des coordonnées (pos.x ∈ -2..2,
  // pos.y = palier), on les positionne donc réellement plutôt que d'empiler des
  // rangées. C'est ce qui permet de TRACER les liens de prérequis — auparavant
  // un simple trait vertical décoratif suggérait un enchaînement qui n'existait
  // pas visuellement, et rien ne disait quel nœud débloquait quel autre.
  const NODE_W = 56;
  const NODE_H = 56;
  const GAP_X = 30;
  const GAP_Y = 20;
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
    const rows = maxY - minY + 1;
    const height = rows * CELL_H - GAP_Y;

    // Garde-fou anti-superposition. Les coordonnées sont écrites à la main dans
    // talents.ts, et 12 sous-classes sur 16 avaient deux nœuds sur la MÊME case
    // — invisible tant que l'affichage empilait des rangées, mais superposé dès
    // qu'on positionne vraiment. Les données sont corrigées, et ici on décale en
    // plus tout doublon vers la colonne libre la plus proche : une erreur de
    // saisie future rendra l'arbre un peu asymétrique, jamais illisible.
    const colOf = new Map<string, number>();
    const takenByRow = new Map<number, Set<number>>();
    for (const t of [...nodes].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)) {
      const taken = takenByRow.get(t.pos.y) ?? new Set<number>();
      let col = t.pos.x;
      for (let d = 1; taken.has(col); d++) col = taken.has(t.pos.x + d) ? t.pos.x - d : t.pos.x + d;
      taken.add(col);
      takenByRow.set(t.pos.y, taken);
      colOf.set(t.id, col);
    }
    const allCols = [...colOf.values()];
    const gridMinX = Math.min(minX, ...allCols);
    const gridMaxX = Math.max(maxX, ...allCols);

    const left = (t: TalentDef) => ((colOf.get(t.id) ?? t.pos.x) - gridMinX) * CELL_W;
    const top = (t: TalentDef) => (t.pos.y - minY) * CELL_H;
    const cx = (t: TalentDef) => left(t) + NODE_W / 2;

    const byId = new Map(nodes.map((t) => [t.id, t]));
    const width = (gridMaxX - gridMinX + 1) * CELL_W - GAP_X;

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

  // La spécialisation est l'arbre qu'on consulte le plus une fois ascensionné ;
  // sans elle on retombe sur la base.
  const shownTree = specTree.length > 0 && branch === 'spec' ? specTree : baseTree;
  const selectedNode = talents.find((t) => t.id === selectedId) ?? shownTree[0] ?? talents[0] ?? null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const activeMods: string[] = [];
  if (mods.crit > 0) activeMods.push(`💥 Critique ${pct(mods.crit)}`);
  if (mods.critMult > 0) activeMods.push(`💢 Mult. crit +${mods.critMult.toFixed(2)}`);
  if (mods.dmgReduction > 0) activeMods.push(`🛡️ Réduction ${pct(mods.dmgReduction)}`);
  if (mods.dodge > 0) activeMods.push(`💨 Esquive ${pct(mods.dodge)}`);
  if (mods.doubleHit > 0) activeMods.push(`🏹 Double ${pct(mods.doubleHit)}`);
  if (mods.regen > 0) activeMods.push(`💚 Régén ${mods.regen}/tour`);
  if (mods.berserkBonus > 0) activeMods.push(`😤 Furie +${pct(mods.berserkBonus)}`);
  if (mods.flatDmg > 0) activeMods.push(`✨ Dégâts +${mods.flatDmg}`);
  if (mods.lifesteal > 0) activeMods.push(`🩸 Vol de vie ${pct(mods.lifesteal)}`);
  if (mods.armorPen > 0) activeMods.push(`🗡️ Perce-armure ${pct(mods.armorPen)}`);
  if (mods.execute > 0) activeMods.push(`☠️ Exécution +${pct(mods.execute)}`);
  if (mods.thorns > 0) activeMods.push(`🔩 Épines ${pct(mods.thorns)}`);
  if (mods.atkPct > 0) activeMods.push(`⚔️ ATK +${pct(mods.atkPct)}`);
  if (mods.defPct > 0) activeMods.push(`🛡️ DEF +${pct(mods.defPct)}`);
  if (mods.hpPct > 0) activeMods.push(`❤️ PV +${pct(mods.hpPct)}`);

  const showAscendTab = isBaseClass && ascensions.length > 0;
  const TABS = [
    { id: 'tree' as const, label: '🌳 Arbre' },
    { id: 'skills' as const, label: `⚔️ Compétences ${equipped.length}/4` },
    ...(showAscendTab ? [{ id: 'ascend' as const, label: '🌟 Ascension' }] : []),
  ];

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

      {/* Onglets : l'arbre, la barre de compétences et l'ascension s'empilaient
          verticalement — il fallait traverser tout le reste avant de voir un
          seul nœud. Séparés, chaque vue tient dans un écran. */}
      <div className="flex gap-1 rounded-xl bg-black/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition ${
              tab === t.id ? 'bg-sky-500/30 text-sky-100' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tree' && (
        <>
          {/* Bascule base / spécialisation : les deux arbres bout à bout
              doublaient la hauteur à parcourir. */}
          {specTree.length > 0 && (
            <div className="flex gap-1 text-[11px]">
              <button
                onClick={() => { setBranch('spec'); setSelectedId(null); }}
                className={`flex-1 rounded-lg py-1.5 font-semibold transition ${branch === 'spec' ? 'bg-amber-500/25 text-amber-200' : 'bg-black/25 text-slate-400 hover:bg-white/5'}`}
              >
                {cls.emoji} {cls.name}
              </button>
              <button
                onClick={() => { setBranch('base'); setSelectedId(null); }}
                className={`flex-1 rounded-lg py-1.5 font-semibold transition ${branch === 'base' ? 'bg-sky-500/25 text-sky-200' : 'bg-black/25 text-slate-400 hover:bg-white/5'}`}
              >
                {CLASSES[baseId].emoji} {CLASSES[baseId].name}
              </button>
            </div>
          )}

          {/* Détail du nœud sélectionné — au-dessus de l'arbre pour rester
              visible pendant qu'on parcourt les tuiles. Les tuiles ne portent
              plus que l'icône et le rang : l'arbre tient en largeur, il ne reste
              qu'un défilement vertical au lieu de quatre directions. */}
          {selectedNode && <NodeDetail t={selectedNode} />}

          <div className="max-h-[52vh] overflow-y-auto rounded-xl bg-black/25 p-3">
            <Tree nodes={shownTree} />
          </div>

          {activeMods.length > 0 && (
            <div className="rounded-lg bg-black/25 px-3 py-2 text-[11px] text-slate-300">
              <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Effets actifs</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {activeMods.map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'skills' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-black/25 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Équipées · {equipped.length}/4</div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => {
                const sid = equipped[i];
                const sk = sid ? unlockedSkills.find((s) => s.id === sid) : null;
                return (
                  <button
                    key={i}
                    onClick={() => sk && toggleSkill(sk.id)}
                    title={sk ? `${sk.name} — ${sk.desc}` : 'Emplacement libre'}
                    className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border text-center ${sk ? 'border-purple-400/40 bg-purple-500/15' : 'border-dashed border-slate-700 bg-black/20'}`}
                  >
                    <span className="text-xl leading-none">{sk ? sk.icon : '＋'}</span>
                    <span className="max-w-full truncate px-1 text-[9px] text-slate-300">{sk ? sk.name : 'Vide'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto">
            {unlockedSkills.length === 0 ? (
              <button
                onClick={() => setTab('tree')}
                className="w-full rounded-xl bg-black/25 py-8 text-center text-sm text-slate-500 hover:bg-white/5"
              >
                Aucune compétence débloquée — ouvre l'arbre ›
              </button>
            ) : (
              unlockedSkills.map((sk) => {
                const on = equipped.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    onClick={() => toggleSkill(sk.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-slate-800 bg-black/25 hover:bg-white/5'}`}
                  >
                    <span className="text-2xl leading-none">{sk.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-100">{sk.name}</div>
                      <div className="text-[11px] leading-snug text-slate-400">{sk.desc}</div>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${on ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700/60 text-slate-300'}`}>
                      {on ? '✓ Équipée' : 'Équiper'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'ascend' && showAscendTab && (
        <div className={`rounded-xl border p-3 ${p.level >= 20 ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-black/20'}`}>
          <div className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-300">
            🌟 Ascension {p.level >= 20 ? (
              <span className="inline-flex items-center gap-1">(1 <ItemIcon id="boss_soul" size={14} /> Âme de Boss requise)</span>
            ) : `(niveau 20 requis — tu es niv.${p.level})`}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
    </div>
  );
}
