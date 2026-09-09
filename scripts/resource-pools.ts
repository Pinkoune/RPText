/* eslint-disable */
// Mesure ISOLÉE des jauges d'archétype : à quelle cadence chaque sous-classe
// lance son finisher, et à combien tourne sa jauge en moyenne.
// Lancer : voir scripts/README-balance.md.
// Sac de frappe à 200 000 PV pour que le combat dure (200 tours), joueur
// maintenu à PV pleins : on mesure la RESSOURCE, pas la survie.
import { CLASSES, CLASS_LIST } from '../src/game/classes';
import { getTalentsForClass, budgetedBuild, talentMods, classResourceType, type ActiveSkillDef } from '../src/game/talents';
import { deriveStats } from '../src/game/player';
import { combatTurn, freshCombatState } from '../src/game/combat';
import { ITEMS } from '../src/game/items';
import type { PlayerState, ClassId, ItemDef } from '../src/game/types';

function blankPlayer(classId: ClassId, level: number): PlayerState {
  return {
    uid: 'sim', name: 'Sim', photoURL: null, classId, level, xp: 0, gold: 0, fateCoins: 0, gems: 0,
    hp: 999999, inventory: {}, equipped: { weapon: null, armor: null, trinket: null, tool: null, profession_armor: null },
    biome: 'forest', unlockedBiomes: ['forest'], cooldowns: {}, kills: 0, deaths: 0, gambleNet: 0,
    statistics: { goldEarned: 0, gamblesPlayed: 0, gamblesWon: 0, mobsKilled: {}, mobsEncountered: {} },
    quests: { daily: { start: 0, counters: {}, claimed: [] }, weekly: { start: 0, counters: {}, claimed: [] } },
    settledDuels: [], settledCJDuels: [], settledDungeons: [], cjWins: 0, bossClaims: [], settledSales: [],
    teamId: null, guildId: null, settledGifts: [], gatherXp: { chop: 0, mine: 0, fish: 0, forage: 0 }, farmXp: 0,
    craftXp: 0, dungeonClears: {}, talentPoints: 0, talents: {}, equippedSkills: [], familiars: {}, activeFamiliarId: null,
    claimedAchievements: [], loginStreak: 0, seasonId: null, seasonPoints: 0, gearDurability: {}, gearStars: {},
    createdAt: 0, lastSeen: 0, enchants: {}, settledEndless: [], settledPvpDuels: [], prestigeLevel: 0,
  } as unknown as PlayerState;
}
function family(classId: ClassId): ClassId { return (CLASSES[classId].parent ?? classId) as ClassId; }
function fits(it: ItemDef, fam: ClassId): boolean { if (!it.classes || !it.classes.length) return true; return it.classes.includes(fam) || it.classes.includes(family(fam)); }
const ALL = Object.values(ITEMS) as ItemDef[];
function bestInSlot(slot: string, lvl: number, fam: ClassId, score: (it: ItemDef) => number): ItemDef | null {
  const c = ALL.filter(it => it.slot === slot && (it.reqLevel ?? 1) <= lvl && fits(it, fam) && (it.atk || it.def || it.hp));
  return c.length ? c.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
}
function maxed(p: PlayerState) {
  const lvl = p.level, fam = family(p.classId);
  const eq = (it: ItemDef | null, slot: 'weapon' | 'armor' | 'trinket') => { if (!it) return; const k = it.id + ':q150'; p.equipped[slot] = k; p.inventory[k] = 1; p.gearStars![k] = 5; if (it.maxDurability) p.gearDurability![k] = it.maxDurability; };
  eq(bestInSlot('weapon', lvl, fam, it => it.atk ?? 0), 'weapon');
  eq(bestInSlot('armor', lvl, fam, it => (it.def ?? 0) * 2 + (it.hp ?? 0)), 'armor');
  eq(bestInSlot('trinket', lvl, fam, it => (it.atk ?? 0) * 2 + (it.def ?? 0) * 2 + (it.hp ?? 0) * 0.1), 'trinket');
  // arbre max + toutes les compétences équipées
  const tree = getTalentsForClass(p.classId);
  p.talents = budgetedBuild(p.classId, Math.max(0, p.level - 1));
  p.equippedSkills = tree.filter(t => t.activeSkill).map(t => t.activeSkill!.id);
}

const TURNS = 200;
type Row = { name: string; res: string; cost: number; casts: number; turns: number; avgPool: number };

function measure(classId: ClassId): Row | null {
  const p = blankPlayer(classId, 50);
  maxed(p);
  const stats = deriveStats(p, true) as any;
  const mods = talentMods(p);
  const resourceType = classResourceType(classId);
  if (!resourceType) return null;
  const skillDefs = getTalentsForClass(classId).map(t => t.activeSkill).filter(Boolean) as ActiveSkillDef[];
  const spender = skillDefs.find(s => s.resource && s.resource.type === resourceType);
  if (!spender) return null;
  const dmg = skillDefs.filter(s => s.mult && s.type === 'attack').sort((a, b) => (b.mult ?? 0) - (a.mult ?? 0));

  const mon = { hp: 200_000, maxHp: 200_000, atk: Math.round(stats.maxHp * 0.03), def: 0, name: 'Mannequin', element: 'neutral' };
  let mhp = mon.hp;
  let pool = 0;
  const poolMax = resourceType === 'combo' ? 5 : 100;
  const cd: Record<string, number> = {};
  let state = freshCombatState();
  let casts = 0, poolSum = 0, turn = 0;
  const ready = (s: ActiveSkillDef) => (cd[s.id] ?? 0) <= 0 && (!s.resource || pool >= s.resource.cost);

  for (; turn < TURNS && mhp > 0; turn++) {
    for (const k in cd) if (cd[k] > 0) cd[k]--;
    const pick = dmg.find(ready);
    const action = pick ? pick.id : 'attack';
    const r = combatTurn(stats, mods, mon as any, stats.maxHp, mhp, action, {
      activeSkill: pick, potionHeal: 0, resourceAmount: pool, resourceType,
    }, state);
    mhp = r.mhp; state = r.state;
    if (pick && pick.id === spender.id && r.abilityUsed) casts++;
    let gained = r.resourceGained;
    if (resourceType === 'tempo') gained = 25;
    if (resourceType === 'overcharge') gained = pick ? 25 : 0;
    pool = Math.max(0, Math.min(poolMax, pool + gained - r.resourceSpent));
    poolSum += pool;
    if (r.abilityUsed && pick) cd[pick.id] = Math.max(1, Math.ceil(pick.cooldownMs / 5000));
  }
  return {
    name: CLASSES[classId].name, res: resourceType, cost: spender.resource!.cost,
    casts, turns: turn, avgPool: Math.round(poolSum / Math.max(1, turn)),
  };
}

const rows: Row[] = [];
for (const c of CLASS_LIST) { const r = measure(c.id as ClassId); if (r) rows.push(r); }
rows.sort((a, b) => a.casts / a.turns > b.casts / b.turns ? -1 : 1);
console.log('classe             | jauge    | coût | casts | tours | 1 cast tous les | jauge moy.');
for (const r of rows) {
  const every = r.casts ? (r.turns / r.casts).toFixed(1) : '—';
  console.log(
    r.name.padEnd(18) + ' | ' + r.res.padEnd(8) + ' | ' + String(r.cost).padStart(4) + ' | ' +
    String(r.casts).padStart(5) + ' | ' + String(r.turns).padStart(5) + ' | ' +
    (every + ' tours').padStart(15) + ' | ' + String(r.avgPool).padStart(10));
}
