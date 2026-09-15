import type { PlayerState } from './types';
import { RUNES, engravable, fusionTarget, FUSE_COUNT, type RuneDef, type RuneSlot } from './runes';
// `addItem`/`removeItem` vivent dans `player.ts`. Pas de cycle : rien dans
// `player.ts` ni `talents.ts` n'importe `enchant.ts`.
import { addItem, removeItem } from './player';

export const MAX_ENCHANTS_PER_SLOT = 2;
/**
 * Retirer une rune la REND au sac. Le coût baisse de 10 à 5 Gemmes : maintenant
 * qu'une sertissure est un choix (offensif/défensif/soutien, cf. `runes.ts`),
 * en changer fait partie du jeu — le facturer au prix fort revenait à figer le
 * premier essai.
 */
export const ENCHANT_REMOVAL_COST = 5;
/** Gravure d'une rune de rang I à la Table — le seul prix en Gemmes du système. */
export const ENGRAVE_COST = 5;

export { FUSE_COUNT };

/**
 * Runes du sac, éventuellement filtrées par emplacement.
 *
 * ⚠️ Le filtre par `slot` n'est pas cosmétique : une rune d'arme ne se sertit
 * que sur une arme. C'est ce qui empêche d'empiler six fois la même statistique
 * et rend la sertissure un arbitrage plutôt qu'une addition.
 */
export function getAvailableRunes(p: PlayerState, slot?: RuneSlot): { id: string; qty: number; def: RuneDef }[] {
  return Object.entries(p.inventory)
    .map(([id, qty]) => ({ id, qty, def: RUNES[id] }))
    .filter((r): r is { id: string; qty: number; def: RuneDef } =>
      !!r.def && r.qty > 0 && (!slot || r.def.slot === slot))
    .sort((a, b) => b.def.tier - a.def.tier || a.def.name.localeCompare(b.def.name));
}

// Les runes sont serties sur l'INSTANCE d'objet (clé d'inventaire de la pièce
// équipée), pas sur le slot : elles suivent l'objet (déséquipement, revente
// marché). L'UI passe toujours le slot ; on résout la clé d'instance ici.
export function equipEnchant(p: PlayerState, slot: RuneSlot, runeId: string) {
  const def = RUNES[runeId];
  if (!def) throw new Error('Rune inconnue.');
  if (def.slot !== slot) throw new Error(`Cette rune se sertit sur ${SLOT_LABEL[def.slot]}.`);
  const key = p.equipped[slot];
  if (!key) throw new Error("Aucun objet équipé dans cet emplacement.");
  if (!p.enchants) p.enchants = {};
  if (!p.enchants[key]) p.enchants[key] = [];
  if (p.enchants[key].length >= MAX_ENCHANTS_PER_SLOT) throw new Error("Plus de place pour de nouvelles runes.");
  // Une rune unique ne se double pas : deux Sursis sur la même armure ne
  // feraient qu'un seul sursis, et l'emplacement serait gâché sans le dire.
  if (def.unique && p.enchants[key].includes(runeId)) throw new Error(`${def.name} est déjà sertie ici.`);
  if ((p.inventory[runeId] || 0) <= 0) throw new Error("Tu ne possèdes pas cette rune.");

  p.inventory[runeId] -= 1;
  if (p.inventory[runeId] <= 0) delete p.inventory[runeId];
  p.enchants[key].push(runeId);
}

export function removeEnchant(p: PlayerState, slot: RuneSlot, index: number) {
  const key = p.equipped[slot];
  if (!key || !p.enchants || !p.enchants[key] || !p.enchants[key][index]) throw new Error("Aucune rune à cet emplacement.");
  if (p.gems < ENCHANT_REMOVAL_COST) throw new Error(`Il te faut ${ENCHANT_REMOVAL_COST} Gemmes pour retirer une rune.`);

  p.gems -= ENCHANT_REMOVAL_COST;
  const runeId = p.enchants[key][index];
  p.enchants[key].splice(index, 1);
  addItem(p, runeId, 1);
}

export const SLOT_LABEL: Record<RuneSlot, string> = {
  weapon: 'une arme',
  armor: 'une armure',
  trinket: 'un bijou',
};

/**
 * Table de gravure : dépense des Gemmes, rend une rune de rang I tirée au sort
 * parmi les quatre familles de l'emplacement choisi.
 *
 * C'est la source qui manquait complètement au système — et c'est celle que la
 * note de patch d'origine annonçait déjà (« les Gemmes gagnent une vraie
 * utilité »). Les Gemmes n'avaient jusqu'ici qu'un seul usage dans tout le jeu :
 * payer le retrait d'une rune que personne ne pouvait obtenir.
 */
export function engraveRune(p: PlayerState, slot: RuneSlot): RuneDef {
  if (p.gems < ENGRAVE_COST) throw new Error(`Il te faut ${ENGRAVE_COST} Gemmes.`);
  const pool = engravable(slot);
  if (!pool.length) throw new Error('Aucune rune à graver pour cet emplacement.');
  p.gems -= ENGRAVE_COST;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  addItem(p, picked.id, 1);
  return picked;
}

/**
 * Fusion : `FUSE_COUNT` exemplaires d'une même rune donnent le rang supérieur.
 * Un doublon n'est donc jamais perdu — c'est ce qui rend la table de gravure
 * supportable malgré son tirage aléatoire.
 */
export function fuseRunes(p: PlayerState, runeId: string): RuneDef {
  const target = fusionTarget(runeId);
  if (!target) throw new Error("Cette rune ne se fusionne pas.");
  if ((p.inventory[runeId] ?? 0) < FUSE_COUNT) throw new Error(`Il t'en faut ${FUSE_COUNT}.`);
  removeItem(p, runeId, FUSE_COUNT);
  addItem(p, target.id, 1);
  return target;
}

/** Runes du sac fusionnables tout de suite (≥ FUSE_COUNT exemplaires). */
export function fusableRunes(p: PlayerState): { id: string; qty: number; def: RuneDef; target: RuneDef }[] {
  const out: { id: string; qty: number; def: RuneDef; target: RuneDef }[] = [];
  for (const { id, qty, def } of getAvailableRunes(p)) {
    const target = fusionTarget(id);
    if (target && qty >= FUSE_COUNT) out.push({ id, qty, def, target });
  }
  return out;
}

/** Clé d'instance équipée pour un slot (helper UI). */
export function enchantsForEquipped(p: PlayerState, slot: RuneSlot): string[] {
  const key = p.equipped[slot];
  return (key && p.enchants?.[key]) || [];
}
