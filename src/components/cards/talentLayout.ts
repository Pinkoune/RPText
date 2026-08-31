import type { TalentDef } from '../../game/talents';

/**
 * Disposition d'un arbre de talents, CALCULÉE à partir du graphe de prérequis.
 *
 * Les `pos.x` de `talents.ts` sont écrits à la main et ne décrivent pas la
 * structure : chez le mage par exemple, `m_ward` (x:0) a ses deux enfants à
 * x:2 et x:3 pendant que `m_pen` (x:+1) n'a qu'un enfant à x:0 — les liens se
 * croisaient et l'arbre paraissait en désordre. Corriger ~150 coordonnées à la
 * main aurait réglé le symptôme une fois ; les déduire du graphe règle les 20
 * arbres d'un coup et garde n'importe quel nœud futur bien placé.
 *
 * C'est un Sugiyama réduit, en deux temps :
 *
 *  1. ORDRE dans chaque rangée — balayages barycentre alternés (haut→bas puis
 *     bas→haut, répétés) : chaque nœud se rapproche de la moyenne des rangs de
 *     ses voisins de la rangée adjacente. C'est ce qui défait les croisements.
 *     Une seule passe descendante ne suffit pas : chez le mage elle laissait
 *     `Ward` coincé entre `Pyromancie` et `Rupture` alors que ses enfants sont
 *     tous à droite, donc ses liens traversaient ceux de `Météore`.
 *  2. POSITION — chaque nœud vise la moyenne des positions de ses prérequis,
 *     avec un écart minimal d'une colonne dans l'ordre fixé à l'étape 1 (ce qui
 *     rend toute superposition impossible), puis chaque parent se recentre sur
 *     ses enfants sans franchir ses voisins.
 *
 * `pos.x` ne sert plus que d'ordre initial et de départage. `pos.y` reste le
 * palier, mais les rangées sont compactées : un arbre de spécialisation qui
 * commence à y:3 ne traîne plus trois rangées vides.
 *
 * Vérifié sur les 20 arbres par `scripts/check-talent-layout.ts` (aucune
 * superposition, aucun croisement).
 */
export function layoutTree(nodes: TalentDef[]): {
  col: Map<string, number>;
  row: Map<string, number>;
  rows: number;
} {
  const byId = new Map(nodes.map((t) => [t.id, t]));
  // Un prérequis peut vivre dans l'AUTRE arbre (un nœud de spécialisation qui
  // dépend de la base) : il est alors absent d'ici et le nœud compte comme
  // racine, ce qui est le comportement voulu.
  const parentsOf = (t: TalentDef) =>
    (t.requires ?? []).map((r) => byId.get(r)).filter((x): x is TalentDef => !!x);
  const kidsOf = new Map<string, TalentDef[]>();
  for (const t of nodes) {
    for (const pp of parentsOf(t)) {
      const arr = kidsOf.get(pp.id) ?? [];
      arr.push(t);
      kidsOf.set(pp.id, arr);
    }
  }

  // Palier DÉDUIT du graphe : un nœud tombe une rangée sous son prérequis le
  // plus profond. Les `pos.y` écrits à la main sautent des paliers — chez le
  // soigneur `h_devotion` (y:3) dépend de `h_grace` (y:1), et ce lien long
  // traversait forcément la rangée intermédiaire, donc croisait ce qui s'y
  // trouvait. En le déduisant, aucun lien ne saute plus de rangée : les
  // croisements de ce type disparaissent par construction, sans avoir à
  // introduire des nœuds fantômes pour router les liens longs.
  const tierOf = new Map<string, number>();
  const computeTier = (t: TalentDef, seen: Set<string>): number => {
    const cached = tierOf.get(t.id);
    if (cached !== undefined) return cached;
    if (seen.has(t.id)) return 0; // garde-fou : cycle dans les données
    seen.add(t.id);
    const ps = parentsOf(t);
    const v = ps.length === 0 ? 0 : Math.max(...ps.map((pp) => computeTier(pp, seen))) + 1;
    tierOf.set(t.id, v);
    return v;
  };
  for (const t of nodes) computeTier(t, new Set());

  const byTier = new Map<number, TalentDef[]>();
  for (const t of nodes) {
    const y = tierOf.get(t.id)!;
    const arr = byTier.get(y) ?? [];
    arr.push(t);
    byTier.set(y, arr);
  }
  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  const layers = tiers.map((y) => [...byTier.get(y)!].sort((a, b) => a.pos.x - b.pos.x || a.id.localeCompare(b.id)));

  const row = new Map<string, number>();
  layers.forEach((line, i) => line.forEach((t) => row.set(t.id, i)));

  // ── 1. Ordre : balayages barycentre ──
  const indexIn = (line: TalentDef[]) => new Map(line.map((t, i) => [t.id, i]));
  const sweep = (line: TalentDef[], neighbours: (t: TalentDef) => TalentDef[], ref: Map<string, number>) => {
    const here = indexIn(line);
    const bary = new Map<string, number>();
    for (const t of line) {
      const ns = neighbours(t).filter((n) => ref.has(n.id));
      // Sans voisin dans la rangée de référence, le nœud garde sa place :
      // le rapprocher de 0 le ferait sauter d'un bord à l'autre sans raison.
      bary.set(t.id, ns.length ? ns.reduce((s, n) => s + ref.get(n.id)!, 0) / ns.length : here.get(t.id)!);
    }
    line.sort((a, b) => (bary.get(a.id)! - bary.get(b.id)!) || (here.get(a.id)! - here.get(b.id)!));
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < layers.length; i++) sweep(layers[i], parentsOf, indexIn(layers[i - 1]));
    for (let i = layers.length - 2; i >= 0; i--) {
      sweep(layers[i], (t) => kidsOf.get(t.id) ?? [], indexIn(layers[i + 1]));
    }
  }

  // ── 2. Position ──
  const col = new Map<string, number>();
  for (const line of layers) {
    let prev = -Infinity;
    for (const t of line) {
      const ps = parentsOf(t).filter((pp) => col.has(pp.id));
      const want = ps.length ? ps.reduce((s, pp) => s + col.get(pp.id)!, 0) / ps.length : t.pos.x;
      const v = Math.max(want, prev + 1);
      col.set(t.id, v);
      prev = v;
    }
  }
  // Remontée : un parent se recentre sur ses enfants, sans franchir ses voisins.
  for (let i = layers.length - 1; i >= 0; i--) {
    const line = layers[i];
    line.forEach((t, j) => {
      const kids = kidsOf.get(t.id) ?? [];
      if (kids.length === 0) return;
      const mid = kids.reduce((s, k) => s + col.get(k.id)!, 0) / kids.length;
      const lo = j > 0 ? col.get(line[j - 1].id)! + 1 : -Infinity;
      const hi = j < line.length - 1 ? col.get(line[j + 1].id)! - 1 : Infinity;
      col.set(t.id, Math.min(hi, Math.max(lo, mid)));
    });
  }

  return { col, row, rows: layers.length };
}
