/**
 * Contrôle de la disposition des arbres de talents, pour les 20 arbres du jeu
 * (4 classes de base + 16 sous-classes).
 *
 * Vérifie trois choses qu'un coup d'œil sur une seule capture ne peut pas
 * garantir :
 *  - aucune superposition (deux nœuds sur la même case) ;
 *  - aucun croisement de liens de prérequis ;
 *  - largeur raisonnable (l'arbre doit tenir dans la fenêtre sans défilement
 *    horizontal, soit ~7 colonnes pour une fenêtre de 680px).
 *
 * Lancer : npx esbuild --bundle ... (voir scripts/README-balance.md), ou
 *   npx tsx scripts/check-talent-layout.ts
 */
import { CLASS_LIST } from '../src/game/classes';
import { getTalentsForClass, type TalentDef } from '../src/game/talents';
import { layoutTree } from '../src/components/cards/talentLayout';

const MAX_COLS = 7;

/** Deux segments se croisent-ils (hors extrémités partagées) ? */
function crosses(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  const d = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

let problems = 0;
for (const cls of CLASS_LIST) {
  const all = getTalentsForClass(cls.id);
  const branches: [string, TalentDef[]][] = [
    ['base', all.filter((t) => t.classId === (cls.parent ?? cls.id))],
    ['spé', all.filter((t) => t.classId === cls.id && cls.parent)],
  ];
  for (const [label, nodes] of branches) {
    if (nodes.length === 0) continue;
    const { col, row, rows } = layoutTree(nodes);
    const tag = `${cls.name} (${label})`;

    // 1. Superpositions
    const seen = new Map<string, string>();
    for (const t of nodes) {
      const key = `${row.get(t.id)}|${col.get(t.id)!.toFixed(3)}`;
      const prev = seen.get(key);
      if (prev) { console.log(`❌ ${tag} : ${prev} et ${t.name} se superposent`); problems++; }
      seen.set(key, t.name);
    }

    // 2. Croisements de liens
    const byId = new Map(nodes.map((t) => [t.id, t]));
    const segs: { x1: number; y1: number; x2: number; y2: number; label: string; a: string; b: string }[] = [];
    for (const t of nodes) {
      for (const r of t.requires ?? []) {
        const from = byId.get(r);
        if (!from) continue;
        segs.push({
          x1: col.get(from.id)!, y1: row.get(from.id)!,
          x2: col.get(t.id)!,    y2: row.get(t.id)!,
          label: `${from.name}→${t.name}`, a: from.id, b: t.id,
        });
      }
    }
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        // Deux liens d'une même chaîne partagent un nœud : ils se touchent,
        // ils ne se croisent pas.
        const shared = segs[i].a === segs[j].a || segs[i].a === segs[j].b
          || segs[i].b === segs[j].a || segs[i].b === segs[j].b;
        if (!shared && crosses(segs[i], segs[j])) {
          console.log(`❌ ${tag} : liens croisés ${segs[i].label} × ${segs[j].label}`);
          problems++;
        }
      }
    }

    // 3. Largeur
    const cols = [...col.values()];
    const width = Math.max(...cols) - Math.min(...cols) + 1;
    if (width > MAX_COLS) { console.log(`❌ ${tag} : ${width.toFixed(1)} colonnes (max ${MAX_COLS})`); problems++; }
    console.log(`   ${tag.padEnd(34)} ${nodes.length} nœuds · ${rows} paliers · ${width.toFixed(1)} col.`);
  }
}
console.log(problems === 0 ? '\n✅ Aucun problème de disposition.' : `\n❌ ${problems} problème(s).`);
