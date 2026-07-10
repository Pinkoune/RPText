/* eslint-disable */
import { xpToNext, MAX_LEVEL } from '../src/game/classes';
import { getCraftLevel, RECIPES } from '../src/game/crafting';
import { gatherXpToNext, GATHER_SKILLS } from '../src/game/gathering';
import { getConcoctionLevel } from '../src/game/concoction';
import { ITEMS } from '../src/game/items';
import type { ItemDef } from '../src/game/types';

const line=(s='')=>console.log(s);
const num=(n:number)=>n.toLocaleString('fr-FR');

// ── 1. XP GLOBAL ──
line('══════ 1. XP GLOBAL (courbe de niveau) ══════');
let cum=0; const cumById:number[]=[0];
for(let l=1;l<MAX_LEVEL;l++){cum+=xpToNext(l);cumById[l+1]=cum;}
const total=cum;
line(`XP total 1→50 : ${num(total)}`);
line('Niv | XP pour ce niv | XP cumulée | % du chemin | temps relatif de ce palier');
for(const l of [2,5,10,15,20,24,30,35,40,45,50]){
  const step=l<50?xpToNext(l):0;
  const pct=(cumById[l]/total*100).toFixed(1);
  const bandPct=(step/total*100).toFixed(1);
  line(`${String(l).padStart(3)} | ${num(step).padStart(12)} | ${num(cumById[l]).padStart(11)} | ${pct.padStart(5)}% atteint | ce niveau = ${bandPct}% du grind total`);
}
// part du grind par tranche
const band=(a:number,b:number)=>((cumById[b]-cumById[a])/total*100).toFixed(1);
line(`Répartition du temps : Nv1-20=${band(1,20)}%  Nv20-30=${band(20,30)}%  Nv30-40=${band(30,40)}%  Nv40-50=${band(40,50)}%`);

// ── 2. ARTISANAT ──
line(''); line('══════ 2. ARTISANAT (craft) ══════');
// XP cumulée pour atteindre chaque niveau de craft
function craftXpFor(lvl:number){let xp=0;for(let i=1;i<lvl;i++)xp+=Math.floor(45*Math.pow(i,1.4));return xp;}
line('Niv craft | XP cumulée');
for(const l of [5,10,15,20,25,30]) line(`${String(l).padStart(9)} | ${num(craftXpFor(l))}`);
// distribution des levelReq de recettes
const reqCount:Record<number,number>={};
for(const r of RECIPES){reqCount[r.levelReq]=(reqCount[r.levelReq]||0)+1;}
line('Recettes par niveau requis (levelReq) :');
line(Object.keys(reqCount).map(Number).sort((a,b)=>a-b).map(l=>`nv${l}:${reqCount[l]}`).join('  '));
// XP moyenne gagnée par craft (finishCraft: 20 + difficulty + difficulty*quality). À quality moyenne 0.5.
line('Gain XP par craft (à qualité 50%) vs difficulté :');
const diffs=[...new Set(RECIPES.map(r=>r.difficulty))].sort((a,b)=>a-b);
for(const d of [20,100,300,550,900]){const g=20+d+Math.floor(d*0.5);line(`  difficulté ${d} → ${g} XP/craft`);}
// combien de crafts pour passer un niveau de craft à différents paliers
line('Crafts nécessaires pour +1 niveau de craft (recette difficulté ~correspondante) :');
for(const cl of [3,8,15,20]){const need=Math.floor(45*Math.pow(cl,1.4));const typicalDiff=cl<5?25:cl<12?120:cl<18?300:550;const perCraft=20+typicalDiff+Math.floor(typicalDiff*0.5);line(`  niv ${cl}→${cl+1} : ${need} XP ÷ ${perCraft}/craft ≈ ${Math.ceil(need/perCraft)} crafts`);}

// ── 3. RÉCOLTE ──
line(''); line('══════ 3. RÉCOLTE (farm) ══════');
function farmXpFor(lvl:number){let xp=0;for(let i=1;i<lvl;i++)xp+=gatherXpToNext(i);return xp;}
line('Niv farm | XP cumulée');
for(const l of [5,10,15,20,25,30]) line(`${String(l).padStart(8)} | ${num(farmXpFor(l))}`);
// ressources gatées par niveau de farm (minLvl sur les drops)
const gateByLvl:Record<number,string[]>={};
for(const sk of Object.values(GATHER_SKILLS)){for(const drops of Object.values(sk.byBiome)){for(const d of (drops as any[])){if(d.minLvl){(gateByLvl[d.minLvl]=gateByLvl[d.minLvl]||[]).push(d.id);}}}}
line('Ressources débloquées par niveau de farm (minLvl) :');
for(const l of Object.keys(gateByLvl).map(Number).sort((a,b)=>a-b)) line(`  farm nv${l} : ${[...new Set(gateByLvl[l])].join(', ')}`);
// XP moyenne par récolte (extractResource : (8 + baseQty*2 + minLvl*5)*mult). baseQty ~2-4.
line('Gain XP par récolte : base ~8-20 selon ressource (minLvl×5 bonus).');
line('Récoltes pour +1 niveau farm :');
for(const fl of [5,10,20]){const need=farmXpFor(fl+1)-farmXpFor(fl);line(`  niv ${fl}→${fl+1} : ${need} XP ÷ ~15/récolte ≈ ${Math.ceil(need/15)} récoltes`);}

// ── 4. ITEMS : courbe de puissance vs reqLevel ──
line(''); line('══════ 4. ITEMS — puissance vs niveau requis ══════');
const all=Object.values(ITEMS) as ItemDef[];
function dump(slot:string,score:(i:ItemDef)=>number,label:string){
  const items=all.filter(i=>i.slot===slot&&score(i)>0&&i.reqLevel).sort((a,b)=>(a.reqLevel!-b.reqLevel!)||score(a)-score(b));
  line(`\n-- ${label} (par niveau requis) --`);
  let prevBest=0;
  const byLvl:Record<number,number>={};
  for(const it of items){const s=score(it);byLvl[it.reqLevel!]=Math.max(byLvl[it.reqLevel!]||0,s);}
  const lvls=Object.keys(byLvl).map(Number).sort((a,b)=>a-b);
  for(const l of lvls){const best=byLvl[l];const jump=prevBest?((best/prevBest-1)*100).toFixed(0)+'%':'—';line(`  nv${String(l).padStart(2)} : meilleur ${label}=${String(best).padStart(4)}  (Δ vs palier préc: ${jump})`);prevBest=best;}
}
dump('weapon',i=>i.atk??0,'ATK arme');
dump('armor',i=>(i.def??0)*2+(i.hp??0),'DEF×2+PV armure');
// value vs stats (cohérence de prix)
line('\n-- Cohérence prix (value) vs stats brutes (arme) --');
const w=all.filter(i=>i.slot==='weapon'&&i.atk&&i.value&&i.reqLevel).sort((a,b)=>a.reqLevel!-b.reqLevel!);
for(const it of w){const ratio=(it.value!/it.atk!).toFixed(0);line(`  nv${String(it.reqLevel).padStart(2)} ${it.name.padEnd(24)} ATK${String(it.atk).padStart(3)} prix${String(it.value).padStart(5)} → ${ratio} or/ATK`);}
