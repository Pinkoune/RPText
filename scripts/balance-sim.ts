/* eslint-disable */
// Harness de simulation d'équilibrage — importe la LOGIQUE PURE du jeu.
// Bundlé par esbuild (import.meta.env stubé → pas d'init Firebase), exécuté par node.
import { ITEMS, item } from '../src/game/items';
import { MONSTERS } from '../src/game/monsters';
import { DUNGEONS } from '../src/game/dungeons';
import { generateEndlessMonster } from '../src/game/endless';
import { CLASSES, CLASS_LIST } from '../src/game/classes';
import { getTalentsForClass, talentMods } from '../src/game/talents';
import { deriveStats } from '../src/game/player';
import { simulateCombat, getElementMult } from '../src/game/combat';
import type { PlayerState, ClassId, ItemDef } from '../src/game/types';
import * as fs from 'fs';

const OUT = '/private/tmp/claude-501/-Users-jeremy-Projects-RPText/b80104e0-3060-4633-b23d-b3224ca13748/scratchpad';
const N = 2000; // combats par cellule

// ── Construction d'un faux joueur ────────────────────────────────────────────
function famZero(): any { return {}; }
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

// Un objet est-il portable par cette famille de classe ?
function fits(it: ItemDef, fam: ClassId): boolean {
  if (!it.classes || it.classes.length === 0) return true;
  return it.classes.includes(fam) || it.classes.includes(family(fam));
}

const ALL = Object.values(ITEMS) as ItemDef[];
function bestInSlot(slot: string, lvl: number, fam: ClassId, score: (it: ItemDef) => number): ItemDef | null {
  const cands = ALL.filter(it => it.slot === slot && (it.reqLevel ?? 1) <= lvl && fits(it, fam) && (it.atk || it.def || it.hp));
  if (!cands.length) return null;
  return cands.reduce((a, b) => (score(b) > score(a) ? b : a));
}

type Tier = 'starter' | 'crafted' | 'maxed';
// Équipe un joueur avec le meilleur set possible à son niveau. Tier = qualité/étoiles.
function outfit(p: PlayerState, tier: Tier, maxTalents: boolean) {
  const lvl = p.level; const fam = family(p.classId);
  const w = bestInSlot('weapon', lvl, fam, it => (it.atk ?? 0));
  const a = bestInSlot('armor', lvl, fam, it => (it.def ?? 0) * 2 + (it.hp ?? 0));
  const t = bestInSlot('trinket', lvl, fam, it => (it.atk ?? 0) * 3 + (it.def ?? 0) * 2 + (it.hp ?? 0));
  const q = tier === 'starter' ? '' : ':q150';
  const stars = tier === 'maxed' ? 5 : 0;
  const equip = (it: ItemDef | null, slot: 'weapon' | 'armor' | 'trinket') => {
    if (!it) return;
    const key = it.id + q;
    p.equipped[slot] = key;
    p.inventory[key] = 1;
    if (stars) p.gearStars![key] = stars;
    if (it.maxDurability) p.gearDurability![key] = it.maxDurability;
  };
  // starter = pièces bas niveau (t0), pas le BiS
  if (tier === 'starter') {
    const w0 = bestInSlot('weapon', Math.min(lvl, 3), fam, it => (it.atk ?? 0)) ?? w;
    const a0 = bestInSlot('armor', Math.min(lvl, 3), fam, it => (it.def ?? 0) * 2 + (it.hp ?? 0)) ?? a;
    equip(w0, 'weapon'); equip(a0, 'armor');
  } else {
    equip(w, 'weapon'); equip(a, 'armor'); equip(t, 'trinket');
  }
  if (maxTalents) {
    for (const td of getTalentsForClass(p.classId)) p.talents![td.id] = td.maxRank;
  }
}

// ── Monstres par activité ────────────────────────────────────────────────────
type Mon = { hp: number; atk: number; def: number; name: string; element?: string; weaknesses?: string[]; resistances?: string[] };

// Réplique le scaling de pickMonster (monsters.ts)
function scaleHunt(base: any, lvl: number): Mon {
  const pf = lvl >= 20 ? 2.0 : 1.5;
  const s = Math.pow(1 + Math.max(0, lvl - 1) / 30, pf);
  return { hp: Math.floor(base.hp * s), atk: Math.floor(base.atk * s), def: Math.floor(base.def * s),
    name: base.name, element: base.element, weaknesses: base.weaknesses, resistances: base.resistances };
}
// Réplique initMonster (dungeonService.ts) pour le boss final
function scaleDungeonBoss(def: any, numPlayers: number, avgLevel: number): Mon {
  const m = def.stages[def.stages.length - 1];
  const lvlMult = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.8 : 1.4);
  const hpMult = Math.pow(numPlayers, 1.4) * (1 + (numPlayers - 1) * 0.1) * lvlMult;
  const atkMult = (1 + (numPlayers - 1) * 0.5) * lvlMult;
  const defMult = (1 + (numPlayers - 1) * 0.25) * lvlMult;
  return { hp: Math.floor(m.hp * hpMult), atk: Math.floor(m.atk * atkMult), def: Math.floor(m.def * defMult),
    name: m.name, element: m.element, weaknesses: m.weaknesses, resistances: m.resistances };
}

// ── Simulation ────────────────────────────────────────────────────────────────
function runBatch(p: PlayerState, mon: Mon, n = N) {
  const stats = deriveStats(p, true);
  const mods = talentMods(p);
  let wins = 0, ttkSum = 0, endHpSum = 0, dmgDealtSum = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateCombat(stats as any, stats.maxHp, mon as any, mods);
    if (r.victory) { wins++; ttkSum += r.hitsDealt; endHpSum += r.endHp / stats.maxHp; }
  }
  return {
    winrate: wins / n,
    avgTTK: wins ? ttkSum / wins : NaN,
    avgEndHpPct: wins ? endHpSum / wins : 0,
    atk: stats.atk, def: stats.def, hp: stats.maxHp,
  };
}

// Cible étalon "sac de frappe" pour la VITESSE DE KILL (DPS).
function dummy(lvl: number): Mon {
  return { hp: Math.round(300 + lvl * 90), atk: Math.round(18 + lvl * 3.2), def: Math.round(6 + lvl * 1.1), name: 'Étalon', element: 'neutral' };
}
// Boss d'attrition : gros PV + grosse ATK pour forcer l'usure et révéler la SURVIE (spread de winrate).
function gauntlet(lvl: number): Mon {
  return { hp: Math.round(2500 + lvl * 260), atk: Math.round(60 + lvl * 8.5), def: Math.round(20 + lvl * 1.6), name: 'Gardien', element: 'neutral' };
}
// DPS effectif = PV cible fixe / TTK moyen. Cible tuable en <80 tours (cap du sim)
// et atk=1 (le joueur ne meurt jamais) → isole la puissance offensive pure.
const DPS_TARGET_HP = 6000;
function effDps(p: PlayerState): number {
  const stats = deriveStats(p, true); const mods = talentMods(p);
  const target = { hp: DPS_TARGET_HP, atk: 1, def: 90, name: 'dps', element: 'neutral' } as any;
  let ttk = 0; const n = 500;
  for (let i = 0; i < n; i++) { const r = simulateCombat(stats as any, stats.maxHp, target, mods); ttk += r.hitsDealt; }
  return DPS_TARGET_HP / (ttk / n);
}

// ══════════════════ ANALYSES ══════════════════
const results: any = {};

// 1) COMPARAISON DE CLASSES : chaque classe Nv.50, maxé (q150 5★), talents max.
//    - DPS effectif (auto-combat, hors skills actifs)
//    - Survie vs boss d'attrition (winrate + PV restants)
const classRows: any[] = [];
for (const c of CLASS_LIST) {
  const p = blankPlayer(c.id, 50); outfit(p, 'maxed', true);
  const st = deriveStats(p, true);
  const g = runBatch(p, gauntlet(50));
  classRows.push({
    classId: c.id, name: c.name, base: c.parent ?? c.id, isSub: !!c.parent,
    atk: st.atk, def: st.def, hp: st.maxHp,
    dps: Math.round(effDps(p)),
    survWinrate: g.winrate, survEndHpPct: g.avgEndHpPct, survTTK: g.avgTTK,
  });
}
results.classes = classRows;

// 2) COURBE DE PUISSANCE OFFENSIVE par classe & niveau (BiS crafted, talents max) = DPS effectif.
const levels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const curveRows: any[] = [];
for (const c of CLASS_LIST) {
  for (const lvl of levels) {
    if (c.parent && lvl < 20) continue; // sous-classes indisponibles <20
    const p = blankPlayer(c.id, lvl); outfit(p, 'crafted', true);
    const st = deriveStats(p, true);
    curveRows.push({ classId: c.id, name: c.name, level: lvl, atk: st.atk, def: st.def, hp: st.maxHp, dps: Math.round(effDps(p)) });
  }
}
results.powerCurve = curveRows;

// 3) IMPACT DU GEAR : 3 tiers × 4 familles, Nv.50, talents max — mesuré en DPS effectif.
const gearRows: any[] = [];
for (const tier of ['starter', 'crafted', 'maxed'] as Tier[]) {
  for (const cid of ['warrior', 'mage', 'archer', 'healer'] as ClassId[]) {
    const p = blankPlayer(cid, 50); outfit(p, tier, true);
    const st = deriveStats(p, true);
    gearRows.push({ tier, classId: cid, atk: st.atk, def: st.def, hp: st.maxHp, dps: Math.round(effDps(p)) });
  }
}
results.gear = gearRows;

// 4) COURBE DE DIFFICULTÉ DES ACTIVITÉS : joueur "référence" = archer BiS crafted, talents max, à chaque niveau
//    vs le contenu prévu pour ce niveau.
const activityRows: any[] = [];
function refPlayer(lvl: number): PlayerState { const p = blankPlayer('archer', lvl); outfit(p, 'crafted', true); return p; }
// 4a hunt : moyenne des monstres du biome dont le minLevel colle au niveau
const biomeMin: Record<string, number> = { forest: 1, plains: 3, mountains: 8, desert: 14, swamp: 20, volcano: 24, crypt: 30, frozen: 38 };
for (const lvl of levels) {
  const p = refPlayer(lvl);
  // biome adapté = plus haut minLevel <= lvl
  let biome = 'forest'; for (const [b, m] of Object.entries(biomeMin)) if (m <= lvl && m >= biomeMin[biome]) biome = b;
  const mobs = (MONSTERS as any[]).filter(m => m.biomes.includes(biome));
  let wr = 0, cnt = 0;
  for (const mb of mobs) { const r = runBatch(p, scaleHunt(mb, lvl), 800); wr += r.winrate; cnt++; }
  activityRows.push({ activity: 'Chasse', level: lvl, biome, winrate: cnt ? wr / cnt : NaN, refAtk: deriveStats(p, true).atk, refHp: deriveStats(p, true).maxHp });
}
// 4b dungeons : boss final. Modèle de GROUPE — N joueurs de référence combinent
// leur DPS vs le boss scalé pour N. Winrate = le groupe bat-il le boss avant wipe ?
// (approx : DPS combiné vs PV boss, chaque joueur encaisse ~1/N des coups.)
function groupBossWinrate(d: any, np: number, lvl: number, n = 400): { wr: number; bossHp: number } {
  const p = refPlayer(lvl);
  const stats = deriveStats(p, true); const mods = talentMods(p);
  const boss = scaleDungeonBoss(d, np, lvl);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    // Simule le combat vu par UN joueur mais le boss a PV/np (part attribuée) et
    // attaque une cible aléatoire (donc ~1/np des coups pour ce joueur).
    const share = { hp: Math.ceil(boss.hp / np), atk: boss.atk, def: boss.def, name: boss.name, element: boss.element, weaknesses: boss.weaknesses, resistances: boss.resistances } as any;
    // atténue les dégâts reçus par ~1/np (le boss répartit ses coups sur np joueurs)
    const soloAtk = Math.max(1, Math.round(boss.atk / Math.sqrt(np)));
    share.atk = soloAtk;
    const r = simulateCombat(stats as any, stats.maxHp, share, mods);
    if (r.victory) wins++;
  }
  return { wr: wins / n, bossHp: boss.hp };
}
for (const d of DUNGEONS) {
  if ((d as any).raid) continue;
  const lvl = (d as any).minLevel + 2;
  for (const np of [1, 2, 3, 4]) {
    const g = groupBossWinrate(d, np, lvl);
    activityRows.push({ activity: `Donjon:${(d as any).name}`, level: lvl, numPlayers: np, bossHp: g.bossHp, winrate: g.wr });
  }
}
// 4c endless : archer BiS Nv.50 maxed, par étage
{
  const p = blankPlayer('archer', 50); outfit(p, 'maxed', true);
  for (const floor of [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100]) {
    const m = generateEndlessMonster(floor);
    const r = runBatch(p, { hp: m.hp, atk: m.atk, def: m.def, name: m.name, element: 'dark' } as any, 800);
    activityRows.push({ activity: 'Abysses', level: 50, floor, mHp: m.hp, mAtk: m.atk, winrate: r.winrate });
  }
}
results.activities = activityRows;

// 5) MATRICE ÉLÉMENTAIRE : multiplicateur de dégâts déterministe (arme vs élément monstre).
const elems = ['fire', 'water', 'earth', 'wind', 'frost', 'light', 'dark', 'neutral'];
const elemRows: any[] = [];
for (const wElem of elems) {
  for (const mElem of elems) {
    elemRows.push({ weapon: wElem, monster: mElem, mult: getElementMult(wElem, mElem) });
  }
}
results.elements = elemRows;

// 6) IMPACT DES ÉTOILES : archer Nv.50 BiS, 0★ à 5★ — mesuré en DPS effectif.
const starRows: any[] = [];
for (let s = 0; s <= 5; s++) {
  const p = blankPlayer('archer', 50); outfit(p, 'crafted', true);
  for (const k of Object.keys(p.equipped)) { const key = (p.equipped as any)[k]; if (key) p.gearStars![key] = s; }
  const st = deriveStats(p, true);
  starRows.push({ stars: s, atk: st.atk, def: st.def, hp: st.maxHp, dps: Math.round(effDps(p)) });
}
results.stars = starRows;

// 7) POTENTIEL DES SKILLS ACTIFS (analytique — non capté par le sim passif).
//    Résume le kit actif de chaque classe : meilleur mult offensif, soin, ressource.
const skillRows: any[] = [];
for (const c of CLASS_LIST) {
  const talents = getTalentsForClass(c.id);
  const skills = talents.map(t => t.activeSkill).filter(Boolean) as any[];
  let bestMult = 0, bestHeal = 0, bestShield = 0, hasStun = false, hasCC = false;
  for (const s of skills) {
    if (s.mult && s.mult > bestMult) bestMult = s.mult;
    if (s.healFrac && s.healFrac > bestHeal) bestHeal = s.healFrac;
    if (s.shield && s.shield > bestShield) bestShield = s.shield;
    if (s.resource?.type === 'combo' && c.id === 'monk') hasStun = true;
    if (s.status && (s.status.type === 'chill' || s.status.type === 'stun')) hasCC = true;
  }
  skillRows.push({
    classId: c.id, name: c.name, resource: talents.find(t => t.activeSkill?.resource)?.activeSkill?.resource?.type ?? 'cooldown',
    bestAtkMult: bestMult, bestHealFrac: bestHeal, bestShield, hasStun, hasCC, nbSkills: skills.length,
  });
}
results.skills = skillRows;

fs.writeFileSync(`${OUT}/sim-results.json`, JSON.stringify(results, null, 2));
console.log('DONE. classes=%d curve=%d gear=%d activities=%d elems=%d stars=%d',
  classRows.length, curveRows.length, gearRows.length, activityRows.length, elemRows.length, starRows.length);
console.log('Classes Nv.50 maxé — DPS auto-combat & survie vs boss attrition:');
for (const r of [...classRows].sort((a, b) => b.dps - a.dps)) {
  console.log(`  ${r.name.padEnd(18)} DPS=${String(r.dps).padStart(5)}  survWR=${(r.survWinrate*100).toFixed(0).padStart(3)}%  endHP=${(r.survEndHpPct*100).toFixed(0).padStart(3)}%  ATK=${String(r.atk).padStart(4)} DEF=${String(r.def).padStart(3)} HP=${r.hp}`);
}
