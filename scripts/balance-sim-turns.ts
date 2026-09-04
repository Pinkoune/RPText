/* eslint-disable */
// Harness TOUR-PAR-TOUR : combat réel avec compétences actives, ressources,
// potions, altérations d'état. Pilote de décision "bon joueur".
// Bundlé esbuild (import.meta.env stubé), exécuté node. La vérité pour équilibrer.
import { ITEMS } from '../src/game/items';
import { MONSTERS } from '../src/game/monsters';
import { DUNGEONS } from '../src/game/dungeons';
import { generateEndlessMonster } from '../src/game/endless';
import { CLASSES, CLASS_LIST } from '../src/game/classes';
import { getTalentsForClass, talentMods, classResourceType, type ActiveSkillDef } from '../src/game/talents';
import { deriveStats } from '../src/game/player';
import { combatTurn, freshCombatState } from '../src/game/combat';
import { activeSetProc } from '../src/game/sets';
import { ARTIFACT_MODS } from '../src/game/artifact';
import { RELIC_STAT_STARS, RELIC_MAX_STARS, effectsForStar } from '../src/game/relic';
import { computeAscensionBoss, ASCENSION_SUSTAIN_MULT } from '../src/game/ascension';
import type { PlayerState, ClassId, ItemDef } from '../src/game/types';
import * as fs from 'fs';

/**
 * Dossier de sortie. C'ÉTAIT un chemin absolu vers le scratchpad d'une session
 * qui n'existe plus : les trois harnais plantaient (`ENOENT`) sur toute autre
 * machine que celle d'origine. Relatif au repo, créé au besoin, surchargeable
 * par `BALANCE_OUT`.
 */
const OUT = process.env.BALANCE_OUT ?? 'scripts/balance-output';
fs.mkdirSync(OUT, { recursive: true });
const N = 1500;

// ── fake player + outfit (identique au harness passif) ──
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
type Tier = 'starter' | 'crafted' | 'maxed';
function outfit(p: PlayerState, tier: Tier) {
  const lvl = p.level, fam = family(p.classId);
  const q = tier === 'starter' ? '' : ':q150', stars = tier === 'maxed' ? 5 : 0;
  const eq = (it: ItemDef | null, slot: 'weapon' | 'armor' | 'trinket') => { if (!it) return; const k = it.id + q; p.equipped[slot] = k; p.inventory[k] = 1; if (stars) p.gearStars![k] = stars; if (it.maxDurability) p.gearDurability![k] = it.maxDurability; };
  if (tier === 'starter') {
    eq(bestInSlot('weapon', Math.min(lvl, 3), fam, it => it.atk ?? 0), 'weapon');
    eq(bestInSlot('armor', Math.min(lvl, 3), fam, it => (it.def ?? 0) * 2 + (it.hp ?? 0)), 'armor');
  } else {
    eq(bestInSlot('weapon', lvl, fam, it => it.atk ?? 0), 'weapon');
    eq(bestInSlot('armor', lvl, fam, it => (it.def ?? 0) * 2 + (it.hp ?? 0)), 'armor');
    eq(bestInSlot('trinket', lvl, fam, it => (it.atk ?? 0) * 3 + (it.def ?? 0) * 2 + (it.hp ?? 0)), 'trinket');
  }
  for (const td of getTalentsForClass(p.classId)) p.talents![td.id] = td.maxRank;
  // équipe toutes les compétences actives de la classe (cap 4, ≤3 dispo)
  const skills = getTalentsForClass(p.classId).map(t => t.activeSkill).filter(Boolean) as ActiveSkillDef[];
  p.equippedSkills = skills.slice(0, 4).map(s => s.id);
}

/**
 * Empile les axes de SAISON sur un joueur déjà habillé.
 *
 * Ils manquaient entièrement au harness : tout ce qui était mesuré jusqu'ici
 * décrivait un joueur sans artefact, sans Relique et sans prestige, c'est-à-dire
 * personne au-delà de la première semaine d'une saison. Or ces trois axes
 * multiplient ATK/DEF/PV (`presMult * artMult * relMult` dans `deriveStats`) et
 * versent des `CombatMods` — c'est le plus gros levier de puissance du jeu.
 *
 * `artifact` = niveau de la grille complète (tous les mods achetés).
 * `relic`    = étoiles, avec un effet par palier ≥6 (le premier de chaque).
 */
type Stack = { artifact?: number; relicStars?: number; prestige?: number };
function season(p: PlayerState, s: Stack) {
  if (s.artifact) p.artifact = { season: 1, xp: 0, level: s.artifact, mods: ARTIFACT_MODS.map(m => m.id) };
  if (s.relicStars) {
    const effects: string[] = [];
    for (let star = RELIC_STAT_STARS + 1; star <= Math.min(s.relicStars, RELIC_MAX_STARS); star++) {
      const choices = effectsForStar(star);
      if (choices.length) effects.push(choices[0].id);
    }
    p.relic = { stars: s.relicStars, effects };
  }
  if (s.prestige) p.prestigeLevel = s.prestige;
  return p;
}

/** Classe réellement jouée à ce niveau : on ascensionne au Nv.20, comme un joueur. */
function played(base: ClassId, sub: ClassId, level: number): ClassId { return level >= 20 ? sub : base; }

type Mon = { hp: number; atk: number; def: number; name: string; element?: string; weaknesses?: string[]; resistances?: string[] };

// ── PILOTE DE COMBAT tour-par-tour ──
function fight(p: PlayerState, mon: Mon, opts: { potions?: number; potionHeal?: number; maxTurns?: number; sustainMult?: number } = {}): { win: boolean; turns: number; endHpPct: number } {
  const stats = deriveStats(p, true) as any;
  const mods = talentMods(p);
  const setProc = activeSetProc(p);
  const resourceType = classResourceType(p.classId);
  const skillDefs = getTalentsForClass(p.classId).map(t => t.activeSkill).filter(Boolean) as ActiveSkillDef[];
  const equipped = skillDefs.filter(s => p.equippedSkills.includes(s.id));
  const dmgSkills = equipped.filter(s => s.mult && (s.type === 'attack')).sort((a, b) => (b.mult ?? 0) - (a.mult ?? 0));
  const healSkills = equipped.filter(s => (s.healFrac ?? 0) > 0 || s.type === 'heal').sort((a, b) => (b.healFrac ?? 0) - (a.healFrac ?? 0));

  let php = stats.maxHp, mhp = mon.hp;
  let pool = resourceType === 'mana' ? 0 : 0;
  const poolMax = resourceType === 'combo' ? 5 : 100;
  const cd: Record<string, number> = {};
  let state = freshCombatState();
  let potions = opts.potions ?? 6;
  const potionHeal = opts.potionHeal ?? Math.round(stats.maxHp * 0.35);
  const maxTurns = opts.maxTurns ?? 120;
  let lastAction = '';

  const affordable = (s: ActiveSkillDef) => {
    if (!s.resource) return true;
    if (s.resource.type === 'combo') return pool >= s.resource.cost;
    return pool >= s.resource.cost;
  };
  const ready = (s: ActiveSkillDef) => (cd[s.id] ?? 0) <= 0 && affordable(s);

  // `turn` vit HORS de la boucle : le retour renvoyait `turns: maxTurns` en dur,
  // donc la colonne « turns » affichait 120 pour tout le monde quelle que soit
  // la durée réelle du combat — une colonne qui ne pouvait rien dire d'autre.
  let turn = 0;
  for (; turn < maxTurns && php > 0 && mhp > 0; turn++) {
    for (const k in cd) if (cd[k] > 0) cd[k]--;
    // décision
    let action = 'attack';
    let skill: ActiveSkillDef | undefined;
    const lowHp = php < stats.maxHp * 0.38;
    const healReady = healSkills.find(ready);
    if (lowHp && healReady) { action = healReady.id; skill = healReady; }
    else if (lowHp && potions > 0 && php < stats.maxHp * 0.3) { action = 'potion'; }
    else {
      const dmgReady = dmgSkills.find(ready);
      if (dmgReady) { action = dmgReady.id; skill = dmgReady; }
    }
    const r = combatTurn(stats, mods, { ...mon, maxHp: mon.hp } as any, php, mhp, action, {
      activeSkill: skill, potionHeal: action === 'potion' ? potionHeal : 0, setProc: setProc ?? undefined,
      resourceAmount: pool, resourceType, sustainMult: opts.sustainMult,
    }, state);
    php = r.php; mhp = r.mhp; state = r.state;
    if (action === 'potion') potions--;
    // ressources
    let gained = r.resourceGained;
    if (resourceType === 'tempo') gained = action !== lastAction ? 25 : 0;
    if (resourceType === 'overcharge') gained = skill ? 25 : 0;
    pool = Math.max(0, Math.min(poolMax, pool + gained - r.resourceSpent));
    if (r.abilityUsed && skill) cd[skill.id] = Math.max(1, Math.ceil(skill.cooldownMs / 5000));
    lastAction = action;
    if (r.fled) return { win: false, turns: turn + 1, endHpPct: php / stats.maxHp };
  }
  return { win: mhp <= 0 && php > 0, turns: turn, endHpPct: Math.max(0, php) / stats.maxHp };
}

function batch(p: PlayerState, mon: Mon, n = N, opts = {}) {
  let wins = 0, endHp = 0, turns = 0;
  for (let i = 0; i < n; i++) { const r = fight(p, mon, opts); if (r.win) { wins++; endHp += r.endHpPct; turns += r.turns; } }
  return { winrate: wins / n, endHpPct: wins ? endHp / wins : 0, avgTurns: wins ? turns / wins : NaN };
}

// scaling
function scaleHunt(base: any, lvl: number): Mon { const pf = 1.75; const s = Math.pow(1 + Math.max(0, lvl - 1) / 30, pf); return { hp: Math.floor(base.hp * s), atk: Math.floor(base.atk * s), def: Math.floor(base.def * s), name: base.name, element: base.element, weaknesses: base.weaknesses, resistances: base.resistances }; }
function dungeonBoss(def: any, np: number, avgLevel: number): Mon { const m = def.stages[def.stages.length - 1]; const lm = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.6 : 1.4); const hp = Math.pow(np, 1.4) * (1 + (np - 1) * 0.1) * lm, at = (1 + (np - 1) * 0.5) * lm, de = (1 + (np - 1) * 0.25) * lm; return { hp: Math.floor(m.hp * hp), atk: Math.floor(m.atk * at), def: Math.floor(m.def * de), name: m.name, element: m.element, weaknesses: m.weaknesses, resistances: m.resistances }; }
// Réplique le scaling initMonster (dungeonService.ts). PARAMÉTRABLE pour tester
// de nouvelles courbes avant de les porter dans le jeu.
// MIROIR de initMonster (dungeonService.ts) — scaling quasi-linéaire (post-fix).
function dungeonScale(np: number, avgLevel: number) {
  const lm = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.6 : 1.4);
  return {
    hpMult: np * (1 + (np - 1) * 0.12) * lm,
    atkMult: (1 + (np - 1) * 0.28) * lm, // ⚠️ miroir de dungeonService.initMonster
    defMult: (1 + (np - 1) * 0.20) * Math.sqrt(lm),
  };
}
// État d'un combattant dans un combat de groupe.
interface Fighter { p: PlayerState; stats: any; mods: any; setProc: any; resType: any; dmg: ActiveSkillDef[]; heal: ActiveSkillDef[]; php: number; pool: number; poolMax: number; cd: Record<string, number>; state: any; lastAction: string; potions: number; alive: boolean; }
function mkFighter(p: PlayerState, potions: number): Fighter {
  const stats = deriveStats(p, true) as any;
  const equipped = (getTalentsForClass(p.classId).map(t => t.activeSkill).filter(Boolean) as ActiveSkillDef[]).filter(s => p.equippedSkills.includes(s.id));
  const resType = classResourceType(p.classId);
  return { p, stats, mods: talentMods(p), setProc: activeSetProc(p), resType,
    dmg: equipped.filter(s => s.mult && s.type === 'attack').sort((a, b) => (b.mult ?? 0) - (a.mult ?? 0)),
    heal: equipped.filter(s => (s.healFrac ?? 0) > 0 || s.type === 'heal').sort((a, b) => (b.healFrac ?? 0) - (a.healFrac ?? 0)),
    php: stats.maxHp, pool: 0, poolMax: resType === 'combo' ? 5 : 100, cd: {}, state: freshCombatState(), lastAction: '', potions, alive: true };
}
import { getElementMult, getDmgTypeMult } from '../src/game/combat';
// VRAI combat co-op N joueurs : chaque joueur tape le boss (atk:0 → pas d'auto-
// riposte), puis le boss frappe UN joueur vivant au hasard (formule répliquée).
function dungeonRunGroup(players: PlayerState[], def: any, np: number, avgLevel: number, potions = 8, scaleFn = dungeonScale): boolean {
  const F = players.map(p => mkFighter(p, potions));
  for (let si = 0; si < def.stages.length; si++) {
    const m0 = def.stages[si]; const sc = scaleFn(np, avgLevel);
    const boss = { hp: Math.floor(m0.hp * sc.hpMult), atk: Math.floor(m0.atk * sc.atkMult), def: Math.floor(m0.def * sc.defMult), name: m0.name, element: m0.element, weaknesses: m0.weaknesses, resistances: m0.resistances };
    let bhp = boss.hp;
    for (let round = 0; round < 400 && bhp > 0 && F.some(f => f.alive); round++) {
      // — tours des joueurs —
      for (const f of F) {
        if (!f.alive || bhp <= 0) continue;
        for (const k in f.cd) if (f.cd[k] > 0) f.cd[k]--;
        const ready = (s: ActiveSkillDef) => (f.cd[s.id] ?? 0) <= 0 && (!s.resource || f.pool >= s.resource.cost);
        let action = 'attack'; let skill: ActiveSkillDef | undefined;
        const low = f.php < f.stats.maxHp * 0.4; const hr = f.heal.find(ready);
        if (low && hr) { action = hr.id; skill = hr; }
        else if (low && f.potions > 0 && f.php < f.stats.maxHp * 0.32) action = 'potion';
        else { const dr = f.dmg.find(ready); if (dr) { action = dr.id; skill = dr; } }
        // atk:0 → pas de riposte pendant le tour joueur
        const poolBefore = f.pool;
        const r = combatTurn(f.stats, f.mods, { ...boss, atk: 0, maxHp: boss.hp } as any, f.php, bhp, action, { activeSkill: skill, potionHeal: action === 'potion' ? Math.round(f.stats.maxHp * 0.35) : 0, setProc: f.setProc ?? undefined, resourceAmount: f.pool, resourceType: f.resType }, f.state);
        bhp = r.mhp; f.php = r.php; f.state = r.state; if (action === 'potion') f.potions--;
        // SOIN DE GROUPE : les soigneurs (healer/dawn_priest/druid) soignent TOUT
        // le groupe en donjon (dungeonService : heal = atk + maxHp*healFrac appliqué
        // à tous les alliés vivants). combatTurn n'a soigné que le lanceur → on
        // propage le heal aux autres alliés vivants.
        if (skill && (f.p.classId === 'healer' || f.p.classId === 'dawn_priest' || f.p.classId === 'druid') && ((skill.healFrac ?? 0) > 0 || skill.type === 'heal')) {
          let effHeal = skill.healFrac ?? 0;
          if (skill.resource?.type === 'grace') effHeal += (skill.resource.scalePerPoint ?? 0) * poolBefore;
          const healAmt = Math.round(f.stats.atk * 1.0 + f.stats.maxHp * effHeal);
          for (const g2 of F) { if (g2 !== f && g2.alive) g2.php = Math.min(g2.stats.maxHp, g2.php + healAmt); }
        }
        let g = r.resourceGained; if (f.resType === 'tempo') g = action !== f.lastAction ? 25 : 0; if (f.resType === 'overcharge') g = skill ? 25 : 0;
        f.pool = Math.max(0, Math.min(f.poolMax, f.pool + g - r.resourceSpent)); if (r.abilityUsed && skill) f.cd[skill.id] = Math.max(1, Math.ceil(skill.cooldownMs / 5000)); f.lastAction = action;
      }
      if (bhp <= 0) break;
      // — tour du boss : frappe UN joueur vivant au hasard —
      const alive = F.filter(f => f.alive); if (!alive.length) break;
      const t = alive[Math.floor(Math.random() * alive.length)];
      const defMult = getElementMult(boss.element, t.stats.armorElement) * 1;
      let mdmg = Math.max(1, Math.round((boss.atk + Math.random() * 4) - t.stats.def * 0.8));
      mdmg = Math.round(mdmg * defMult); mdmg = Math.max(1, Math.round(mdmg * (1 - (t.mods.dmgReduction || 0))));
      if (t.state.chill > 0) mdmg = Math.max(1, Math.round(mdmg * 0.6));
      if (t.state.shield > 0) { const ab = Math.min(t.state.shield, mdmg); t.state.shield -= ab; mdmg -= ab; }
      t.php -= mdmg; if (t.php <= 0) t.alive = false;
    }
    if (!F.some(f => f.alive)) return false;
    for (const f of F) if (f.alive) f.php = Math.min(f.stats.maxHp, f.php + Math.round(f.stats.maxHp * 0.06));
  }
  return F.some(f => f.alive);
}
function dungeonWinrate(mkParty: () => PlayerState[], def: any, np: number, avgLevel: number, n = 500, potions = 8, scaleFn = dungeonScale) {
  let w = 0; for (let i = 0; i < n; i++) if (dungeonRunGroup(mkParty(), def, np, avgLevel, potions, scaleFn)) w++; return w / n;
}

// ══════════ ANALYSES (avec skills) ══════════
const results: any = {};
const levels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
function gauntlet(lvl: number): Mon { return { hp: Math.round(2500 + lvl * 260), atk: Math.round(60 + lvl * 8.5), def: Math.round(20 + lvl * 1.6), name: 'Gardien', element: 'neutral' }; }

// 1) Classes Nv.50 maxé vs boss d'attrition — AVEC skills+potions
const classRows: any[] = [];
for (const c of CLASS_LIST) {
  const p = blankPlayer(c.id, 50); outfit(p, 'maxed');
  const st = deriveStats(p, true);
  const g = batch(p, gauntlet(50), 1200, { potions: 6 });
  classRows.push({ classId: c.id, name: c.name, isSub: !!c.parent, atk: st.atk, def: st.def, hp: st.maxHp, winrate: g.winrate, endHpPct: g.endHpPct, avgTurns: g.avgTurns });
}
results.classes = classRows;

// 2) Chasse : référence archer craft, par niveau (AVEC skills)
const biomeMin: Record<string, number> = { forest: 1, plains: 3, mountains: 8, desert: 14, swamp: 20, volcano: 24, crypt: 30, frozen: 38 };
// ⚠️ La référence ascensionne au Nv.20 (`played`). Avant, elle restait Archer de
// BASE jusqu'au Nv.50 — or la base Archer est la classe la plus faible du jeu à
// 50 (WR 1% contre le boss d'attrition, cf. tableau des classes) parce que
// personne n'est censé y rester. Les taux de chasse Nv.30+ mesuraient donc un
// personnage que plus aucun joueur ne joue, et sous-estimaient tout le end-game.
const huntRows: any[] = [];
for (const lvl of levels) {
  const p = blankPlayer(played('archer', 'hunter', lvl), lvl); outfit(p, 'crafted');
  let biome = 'forest'; for (const [b, m] of Object.entries(biomeMin)) if (m <= lvl && m >= biomeMin[biome]) biome = b;
  const mobs = (MONSTERS as any[]).filter(m => m.biomes.includes(biome));
  let wr = 0, c = 0; for (const mb of mobs) { wr += batch(p, scaleHunt(mb, lvl), 400, { potions: 4 }).winrate; c++; }
  huntRows.push({ level: lvl, biome, winrate: c ? wr / c : NaN });
}
results.hunt = huntRows;

// 3) DONJONS : run co-op complet, solo→4p. Party MIXTE réaliste (guerrier/mage/
//    archer/soigneur en rotation), gear craft au niveau du donjon.
//    Compare le scaling ACTUEL vs une courbe quasi-linéaire PROPOSÉE.
// ⚠️ La composition doit être CUMULATIVE, sinon la colonne ne mesure pas la
// taille du groupe. Avec l'ancienne rotation `[guerrier, mage, soigneur, archer]`
// il n'y avait de soigneur qu'à partir de 3 joueurs : la Forge Infernale sortait
// 0% / 6% / 100% / 33%, une courbe qui suivait la PRÉSENCE DU SOIGNEUR et pas
// l'effectif. Un groupe réel prend un soigneur en deuxième.
const PARTY_CLASSES: ClassId[] = ['warrior', 'healer', 'mage', 'archer'];
function makeParty(np: number, lvl: number): PlayerState[] {
  const arr: PlayerState[] = [];
  for (let i = 0; i < np; i++) { const p = blankPlayer(PARTY_CLASSES[i % PARTY_CLASSES.length], lvl); outfit(p, 'crafted'); arr.push(p); }
  return arr;
}
// Courbe PROPOSÉE : quasi-linéaire (les groupes ne sont plus punis par joueur).
function proposedScale(np: number, avgLevel: number) {
  const lm = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.6 : 1.4);
  return {
    hpMult: np * (1 + (np - 1) * 0.12) * lm,   // ~linéaire (+12%/membre au lieu de ^1.4)
    atkMult: (1 + (np - 1) * Number(process.env.ATKPER ?? 0.28)) * lm,
    defMult: (1 + (np - 1) * 0.2) * Math.sqrt(lm),        // 0.25→0.20
  };
}
const dungRows: any[] = [];
for (const d of DUNGEONS) {
  if ((d as any).raid) continue;
  const lvl = (d as any).minLevel + 2;
  for (const np of [1, 2, 3, 4]) {
    const cur = dungeonWinrate(() => makeParty(np, lvl), d, np, lvl, 400, 8, dungeonScale);
    const pro = dungeonWinrate(() => makeParty(np, lvl), d, np, lvl, 400, 8, proposedScale);
    dungRows.push({ dungeon: (d as any).name, level: lvl, numPlayers: np, winrateCurrent: cur, winrateProposed: pro });
  }
}
results.dungeons = dungRows;

// 4) Endless (archer maxed) avec skills
const endRows: any[] = [];
{
  const p = blankPlayer('archer', 50); outfit(p, 'maxed');
  for (const floor of [10, 20, 30, 40, 50, 60, 75, 100, 125, 150]) {
    const m = generateEndlessMonster(floor);
    endRows.push({ floor, hp: m.hp, winrate: batch(p, { hp: m.hp, atk: m.atk, def: m.def, name: m.name, element: 'dark' } as any, 400, { potions: 6 }).winrate });
  }
}
results.endless = endRows;

// 4bis) DONJONS DE FIN, groupe RÉELLEMENT équipé : gear maxé (q150 5★) + artefact
//    de grille + Relique ★5, au Nv.50. La grille au-dessus mesure un groupe en
//    gear de craft nu au niveau minimum du donjon — utile pour la porte d'entrée,
//    inutile pour dire si le contenu final est FAISABLE par ceux qui y vont.
function makeEndParty(np: number): PlayerState[] {
  const arr: PlayerState[] = [];
  for (let i = 0; i < np; i++) {
    const p = season(blankPlayer(PARTY_CLASSES[i % PARTY_CLASSES.length], 50), { artifact: 62, relicStars: 5 });
    outfit(p, 'maxed'); arr.push(p);
  }
  return arr;
}
const endDungRows: any[] = [];
for (const d of DUNGEONS) {
  if ((d as any).raid || (d as any).minLevel < 30) continue;
  for (const np of [1, 2, 3, 4]) {
    endDungRows.push({ dungeon: (d as any).name, numPlayers: np, winrate: dungeonWinrate(() => makeEndParty(np), d, np, 50, 300, 8, dungeonScale) });
  }
}
results.endgameDungeons = endDungRows;

// 5) EMPILEMENT DE SAISON : ce que l'artefact, la Relique et le prestige
//    achètent réellement, mesuré contre le contenu le plus dur du jeu (Abysses
//    Nv.50). Jusqu'ici la doc citait un facteur de stats calculé à la main
//    (×2.08) sans jamais le confronter à un monstre.
const STACKS: { label: string; stack: Stack }[] = [
  { label: 'nu (saison 1, semaine 1)', stack: {} },
  { label: 'artefact grille (Nv.62)', stack: { artifact: 62 } },
  { label: '+ Relique ★5', stack: { artifact: 62, relicStars: 5 } },
  { label: '+ Relique ★10', stack: { artifact: 62, relicStars: 10 } },
  { label: '+ prestige 5 (tout maxé)', stack: { artifact: 62, relicStars: 10, prestige: 5 } },
  { label: 'artefact Nv.300 (fin de saison)', stack: { artifact: 300, relicStars: 10, prestige: 5 } },
];
const frozenMobs = (MONSTERS as any[]).filter(m => m.biomes.includes('frozen'));
const stackRows: any[] = [];
for (const { label, stack } of STACKS) {
  const p = season(blankPlayer('hunter', 50), stack); outfit(p, 'maxed');
  const st = deriveStats(p, true);
  let wr = 0; for (const mb of frozenMobs) wr += batch(p, scaleHunt(mb, 50), 400, { potions: 6 }).winrate;
  const g = batch(p, gauntlet(50), 600, { potions: 6 });
  stackRows.push({ label, atk: st.atk, def: st.def, hp: st.maxHp, frozenWinrate: wr / frozenMobs.length, gauntletEndHp: g.endHpPct });
}
results.stack = stackRows;

// 6) RITUEL DU NÉANT : le boss de prestige, jamais simulé jusqu'ici. Il est
//    calibré sur un joueur IDÉAL (`computeAscensionBoss`), donc un joueur réel
//    doit perdre s'il n'est pas optimisé — c'est le contrat de la feature.
//    On le mesure sur trois profils pour vérifier qu'il discrimine bien.
// Balayage du multiplicateur de sustain : on cherche la valeur qui rend le mur
// infranchissable sans saison ET franchissable par TOUTES les classes une fois
// tout maxé — y compris les soigneurs, dont le kit EST du sustain.
if (process.env.SWEEP) {
  for (const sm of [0.4, 0.5, 0.6]) {
    for (const atkScale of [1.0, 1.15, 1.3, 1.45]) {
      const line: string[] = [];
      for (const { label, stack } of [
        { label: 'nu', stack: {} as Stack },
        { label: 'art+*5', stack: { artifact: 62, relicStars: 5 } as Stack },
        { label: 'maxe', stack: { artifact: 62, relicStars: 10, prestige: 5 } as Stack },
      ]) {
        const wrs = CLASS_LIST.filter(c => c.parent).map(c => {
          const p = season(blankPlayer(c.id, 50), stack); outfit(p, 'maxed');
          const b = computeAscensionBoss(p) as any;
          return batch(p, { hp: b.hp, atk: Math.round(b.atk * atkScale), def: b.def, name: b.name, element: 'dark' } as any, 150, { potions: 6, maxTurns: 200, sustainMult: sm }).winrate;
        }).sort((a, b) => a - b);
        const med = wrs[Math.floor(wrs.length / 2)];
        line.push(`${label} ${(wrs[0] * 100).toFixed(0)}/${(med * 100).toFixed(0)}/${(wrs[wrs.length - 1] * 100).toFixed(0)}`);
      }
      console.log(`sustain=${sm.toFixed(2)} atk*${atkScale.toFixed(2)}  min/med/max  ${line.join('   ')}`);
    }
  }
}

const voidRows: any[] = [];
for (const c of CLASS_LIST.filter(c => c.parent)) {
  for (const { label, stack } of [
    { label: 'sans saison', stack: {} as Stack },
    { label: 'artefact+★5', stack: { artifact: 62, relicStars: 5 } as Stack },
    { label: 'tout maxé', stack: { artifact: 62, relicStars: 10, prestige: 5 } as Stack },
  ]) {
    const p = season(blankPlayer(c.id, 50), stack); outfit(p, 'maxed');
    const boss = computeAscensionBoss(p) as any;
    const r = batch(p, { hp: boss.hp, atk: boss.atk, def: boss.def, name: boss.name, element: 'dark' } as any, 300, { potions: 6, maxTurns: 200, sustainMult: ASCENSION_SUSTAIN_MULT });
    voidRows.push({ classId: c.id, name: c.name, profile: label, winrate: r.winrate, bossHp: boss.hp, bossAtk: boss.atk });
  }
}
results.voidRitual = voidRows;

fs.writeFileSync(`${OUT}/sim-turns.json`, JSON.stringify(results, null, 2));
console.log('=== CLASSES Nv.50 (skills+potions) vs boss attrition — winrate / endHP / turns ===');
for (const r of [...classRows].sort((a, b) => b.winrate - a.winrate))
  console.log(`  ${r.name.padEnd(18)} WR=${(r.winrate * 100).toFixed(0).padStart(3)}%  endHP=${(r.endHpPct * 100).toFixed(0).padStart(3)}%  turns=${isNaN(r.avgTurns) ? '—' : r.avgTurns.toFixed(0)}  ATK=${r.atk} DEF=${r.def} HP=${r.hp}`);
console.log('=== HUNT winrate (archer craft, avec skills) ===');
for (const r of huntRows) console.log(`  Nv${r.level} ${r.biome.padEnd(10)} ${(r.winrate * 100).toFixed(0)}%`);
console.log('=== DUNGEON co-op (party mixte) — ACTUEL vs PROPOSÉ, 1p→4p ===');
for (const d of [...new Set(dungRows.map(r => r.dungeon))]) {
  const cur = [1, 2, 3, 4].map(np => (dungRows.find(r => r.dungeon === d && r.numPlayers === np)!.winrateCurrent * 100).toFixed(0).padStart(3) + '%');
  const pro = [1, 2, 3, 4].map(np => (dungRows.find(r => r.dungeon === d && r.numPlayers === np)!.winrateProposed * 100).toFixed(0).padStart(3) + '%');
  console.log(`  ${d.padEnd(22)} actuel[${cur.join(' ')}]  proposé[${pro.join(' ')}]`);
}
console.log('=== ENDLESS (archer maxed, skills) ===');
for (const r of endRows) console.log(`  floor${r.floor} ${(r.winrate * 100).toFixed(0)}%`);
console.log('=== EMPILEMENT DE SAISON (Chasseur Nv.50 maxé) — stats / Abysses / endHP ===');
for (const r of stackRows)
  console.log(`  ${r.label.padEnd(32)} ATK=${String(r.atk).padStart(5)} DEF=${String(r.def).padStart(4)} HP=${String(r.hp).padStart(5)}  abysses=${(r.frozenWinrate * 100).toFixed(0).padStart(3)}%  endHP=${(r.gauntletEndHp * 100).toFixed(0).padStart(3)}%`);
console.log('=== RITUEL DU NÉANT (winrate par sous-classe et profil) ===');
for (const c of [...new Set(voidRows.map(r => r.classId))]) {
  const rows = voidRows.filter(r => r.classId === c);
  console.log(`  ${rows[0].name.padEnd(18)} ${rows.map(r => `${r.profile}=${(r.winrate * 100).toFixed(0).padStart(3)}%`).join('  ')}`);
}
console.log('=== DONJONS DE FIN, groupe équipé (Nv.50 maxé + artefact + ★5), 1p→4p ===');
for (const d of [...new Set(endDungRows.map(r => r.dungeon))])
  console.log(`  ${d.padEnd(22)} [${[1, 2, 3, 4].map(np => (endDungRows.find(r => r.dungeon === d && r.numPlayers === np)!.winrate * 100).toFixed(0).padStart(3) + '%').join(' ')}]`);
