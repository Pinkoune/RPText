/* eslint-disable */
// Impact du système de runes sur le Rituel du Néant.
//
// Deux modes :
//   node rune-impact.cjs              → table 16 sous-classes × 3 profils,
//                                        sans runes vs runes rang III
//   ISOLATE=1 node rune-impact.cjs    → contribution d'UNE paire de runes à la
//                                        fois (c'est ce mode qui a montré qu'au
//                                        Rituel un mod défensif vaut ~20× un mod
//                                        offensif)
//   KA=1.35 KH=1.05 node ...          → balayage du calibrage du boss (facteurs
//                                        sur son ATK et ses PV), pour retrouver
//                                        les coefficients d'`ascension.ts`
// Bundlé esbuild comme les autres harnais, voir README-balance.md.
// sans runes / runes rang III, sur trois profils de saison.
import { ITEMS } from '../src/game/items';
import { CLASSES, CLASS_LIST } from '../src/game/classes';
import { getTalentsForClass, budgetedBuild, talentMods, classResourceType, type ActiveSkillDef } from '../src/game/talents';
import { deriveStats } from '../src/game/player';
import { combatTurn, freshCombatState } from '../src/game/combat';
import { activeSetProc } from '../src/game/sets';
import { ARTIFACT_MODS } from '../src/game/artifact';
import { RELIC_STAT_STARS, RELIC_MAX_STARS, effectsForStar } from '../src/game/relic';
import { computeAscensionBoss, neutralizeForNeant, ASCENSION_SUSTAIN_MULT } from '../src/game/ascension';
import { bestRuneLoadout } from '../src/game/runes';
import type { PlayerState, ClassId, ItemDef } from '../src/game/types';

function blank(classId: ClassId, level: number): PlayerState {
  return { uid:'s',name:'S',photoURL:null,classId,level,xp:0,gold:0,fateCoins:0,gems:0,hp:999999,inventory:{},
    equipped:{weapon:null,armor:null,trinket:null,tool:null,profession_armor:null},biome:'forest',unlockedBiomes:['forest'],
    cooldowns:{},kills:0,deaths:0,gambleNet:0,statistics:{goldEarned:0,gamblesPlayed:0,gamblesWon:0,mobsKilled:{},mobsEncountered:{}},
    quests:{daily:{start:0,counters:{},claimed:[]},weekly:{start:0,counters:{},claimed:[]}},settledDuels:[],settledCJDuels:[],
    settledDungeons:[],cjWins:0,bossClaims:[],settledSales:[],teamId:null,guildId:null,settledGifts:[],
    gatherXp:{chop:0,mine:0,fish:0,forage:0},farmXp:0,craftXp:0,dungeonClears:{},talentPoints:0,talents:{},equippedSkills:[],
    familiars:{},activeFamiliarId:null,claimedAchievements:[],loginStreak:0,seasonId:null,seasonPoints:0,gearDurability:{},
    gearStars:{},createdAt:0,lastSeen:0,enchants:{},settledEndless:[],settledPvpDuels:[],prestigeLevel:0 } as unknown as PlayerState;
}
const fam = (c: ClassId) => (CLASSES[c].parent ?? c) as ClassId;
const ALL = Object.values(ITEMS) as ItemDef[];
const fits = (it: ItemDef, f: ClassId) => !it.classes?.length || it.classes.includes(f);
function best(slot: string, lvl: number, f: ClassId, score: (i: ItemDef) => number) {
  const c = ALL.filter(it => it.slot === slot && (it.reqLevel ?? 1) <= lvl && fits(it, f) && (it.atk || it.def || it.hp));
  return c.length ? c.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
}
function outfit(p: PlayerState, runes: boolean) {
  const lvl = p.level, f = fam(p.classId); const k: any = {};
  const eq = (it: ItemDef | null, s: 'weapon'|'armor'|'trinket') => { if (!it) return; const key = it.id+':q150';
    p.equipped[s]=key; p.inventory[key]=1; p.gearStars![key]=5; if (it.maxDurability) p.gearDurability![key]=it.maxDurability; k[s]=key; };
  eq(best('weapon', lvl, f, i => i.atk ?? 0), 'weapon');
  eq(best('armor', lvl, f, i => (i.def??0)*2+(i.hp??0)), 'armor');
  eq(best('trinket', lvl, f, i => (i.atk??0)*3+(i.def??0)*2+(i.hp??0)), 'trinket');
  if (runes) { const L = bestRuneLoadout(); p.enchants = { [k.weapon]: L.weapon, [k.armor]: L.armor, [k.trinket]: L.trinket } as any; }
  (p as any).__keys = k;
  p.talents = budgetedBuild(p.classId, Math.max(0, p.level - 1));
  const sk = getTalentsForClass(p.classId).map(t => t.activeSkill).filter(Boolean) as ActiveSkillDef[];
  p.equippedSkills = sk.slice(0, 4).map(s => s.id);
}
type Stack = { artifact?: number; relicStars?: number; prestige?: number };
function season(p: PlayerState, s: Stack) {
  if (s.artifact) p.artifact = { season:1, xp:0, level:s.artifact, mods: ARTIFACT_MODS.map(m=>m.id) } as any;
  if (s.relicStars) { const e: string[] = [];
    for (let st = RELIC_STAT_STARS+1; st <= Math.min(s.relicStars, RELIC_MAX_STARS); st++) { const c = effectsForStar(st); if (c.length) e.push(c[0].id); }
    p.relic = { stars: s.relicStars, effects: e } as any; }
  if (s.prestige) p.prestigeLevel = s.prestige;
  return p;
}
type Mon = { hp:number; atk:number; def:number; name:string; element?:string; resistances?:string[] };
function fight(p: PlayerState, mon: Mon, o: { potions?:number; maxTurns?:number; sustainMult?:number; neant?:boolean }) {
  const stats = deriveStats(p, true) as any, mods = talentMods(p), setProc = activeSetProc(p);
  const rt = classResourceType(p.classId);
  const defs = getTalentsForClass(p.classId).map(t=>t.activeSkill).filter(Boolean) as ActiveSkillDef[];
  const eq = defs.filter(s=>p.equippedSkills.includes(s.id)).map(s => o.neant ? neutralizeForNeant(s) : s);
  const dmg = eq.filter(s=>s.mult && s.type==='attack').sort((a,b)=>(b.mult??0)-(a.mult??0));
  const heal = eq.filter(s=>(s.healFrac??0)>0||s.type==='heal').sort((a,b)=>(b.healFrac??0)-(a.healFrac??0));
  let php = stats.maxHp, mhp = mon.hp, pool = 0;
  const poolMax = rt==='combo'?5:100; const cd: Record<string,number> = {}; let state = freshCombatState();
  let pot = o.potions ?? 6; const ph = Math.round(stats.maxHp*0.35); const maxT = o.maxTurns ?? 200; let last='';
  const ready = (s: ActiveSkillDef) => (cd[s.id]??0)<=0 && (!s.resource || pool>=s.resource.cost);
  for (let t=0; t<maxT && php>0 && mhp>0; t++) {
    for (const k in cd) if (cd[k]>0) cd[k]--;
    let a='attack'; let sk: ActiveSkillDef|undefined;
    const low = php < stats.maxHp*0.38; const hr = heal.find(ready);
    if (low && hr) { a=hr.id; sk=hr; } else if (low && pot>0 && php<stats.maxHp*0.3) a='potion';
    else { const d = dmg.find(ready); if (d) { a=d.id; sk=d; } }
    const r = combatTurn(stats, mods, {...mon, maxHp: mon.hp} as any, php, mhp, a,
      { activeSkill: sk, potionHeal: a==='potion'?ph:0, setProc: setProc ?? undefined, resourceAmount: pool, resourceType: rt, sustainMult: o.sustainMult }, state);
    php=r.php; mhp=r.mhp; state=r.state; if (a==='potion') pot--;
    let g=r.resourceGained; if (rt==='tempo') g = a!==last?25:0; if (rt==='overcharge') g = sk?25:0;
    pool = Math.max(0, Math.min(poolMax, pool+g-r.resourceSpent));
    if (r.abilityUsed && sk) cd[sk.id] = Math.max(1, Math.ceil(sk.cooldownMs/5000));
    last=a;
  }
  return mhp<=0 && php>0;
}
const KA = Number(process.env.KA ?? 1); // facteur sur l'ATK du boss
const KH = Number(process.env.KH ?? 1); // facteur sur ses PV
function neant(c: ClassId, st: Stack, runes: boolean, n=300) {
  const p = season(blank(c,50), st); outfit(p, runes);
  const b0 = computeAscensionBoss(p) as any;
  const b = { ...b0, hp: Math.round(b0.hp*KH), atk: Math.round(b0.atk*KA) };
  let w=0; for (let i=0;i<n;i++) if (fight(p, {hp:b.hp,atk:b.atk,def:b.def,name:b.name,element:'dark'}, {potions:6,maxTurns:200,sustainMult:ASCENSION_SUSTAIN_MULT,neant:true})) w++;
  return { wr: w/n, boss: b };
}
const STACKS: [string, Stack][] = [
  ['sans saison', {}],
  ['art+★5', { artifact: 62, relicStars: 5 }],
  ['tout maxé', { artifact: 62, relicStars: 10, prestige: 5 }],
];
const b0 = computeAscensionBoss(season(blank('monk',50), {}) as any) as any;
console.log(`Boss du Rituel (famille soigneur) : ${b0.hp} PV / ${b0.atk} ATK\n`);
console.log('=== RITUEL — sans runes -> runes rang III ===');
const rows: any[] = [];
for (const c of CLASS_LIST.filter(c => c.parent)) {
  const line: any = { name: c.name };
  for (const [lab, st] of STACKS) { line[lab] = [neant(c.id as ClassId, st, false).wr, neant(c.id as ClassId, st, true).wr]; }
  rows.push(line);
  console.log('  ' + c.name.padEnd(18) + STACKS.map(([lab]) =>
    `${lab} ${(line[lab][0]*100).toFixed(0).padStart(3)}%→${(line[lab][1]*100).toFixed(0).padStart(3)}%`).join('  '));
}
for (const [lab] of STACKS) {
  const a = rows.map(r=>r[lab][0]).sort((x,y)=>x-y), b = rows.map(r=>r[lab][1]).sort((x,y)=>x-y);
  const med = (v:number[]) => v[Math.floor(v.length/2)];
  console.log(`  >> ${lab.padEnd(12)} médiane ${(med(a)*100).toFixed(0)}% → ${(med(b)*100).toFixed(0)}%   min ${(a[0]*100).toFixed(0)}% → ${(b[0]*100).toFixed(0)}%   max ${(a[a.length-1]*100).toFixed(0)}% → ${(b[b.length-1]*100).toFixed(0)}%`);
}


// ── Contribution isolée de chaque famille de rune (une paire, un seul slot) ──
if (process.env.ISOLATE) {
  const PAIRS: [string, 'weapon'|'armor'|'trinket', string][] = [
    ['aucune', 'weapon', ''],
    ['edge III ×2 (crit)', 'weapon', 'rune_edge_3'],
    ['pierce III ×2 (armorPen)', 'weapon', 'rune_pierce_3'],
    ['echo III ×2 (doubleHit)', 'weapon', 'rune_echo_3'],
    ['ward III ×2 (dmgReduction)', 'armor', 'rune_ward_3'],
    ['bulwark III ×2 (PV%)', 'armor', 'rune_bulwark_3'],
    ['briar III ×2 (thorns)', 'armor', 'rune_briar_3'],
    ['veil III ×2 (esquive)', 'armor', 'rune_veil_3'],
    ['might III ×2 (ATK%)', 'trinket', 'rune_might_3'],
    ['aegis III ×2 (DEF%)', 'trinket', 'rune_aegis_3'],
    ['leech III ×2 (vol de vie)', 'trinket', 'rune_leech_3'],
    ['mend III ×2 (régén)', 'trinket', 'rune_mend_3'],
  ];
  for (const cls of ['monk','berserker','druid'] as ClassId[]) {
    console.log(`\n=== ${CLASSES[cls].name} — Rituel sans saison, une paire de runes à la fois ===`);
    for (const [lab, slot, id] of PAIRS) {
      const p = blank(cls, 50); outfit(p, false);
      const k = (p as any).__keys;
      if (id) p.enchants = { [k[slot]]: [id, id] } as any;
      const b = computeAscensionBoss(p) as any;
      let w = 0; const n = 300;
      for (let i=0;i<n;i++) if (fight(p, {hp:b.hp,atk:b.atk,def:b.def,name:b.name,element:'dark'}, {potions:6,maxTurns:200,sustainMult:ASCENSION_SUSTAIN_MULT,neant:true})) w++;
      console.log('  ' + lab.padEnd(28) + (w/n*100).toFixed(0).padStart(4) + '%');
    }
  }
}
