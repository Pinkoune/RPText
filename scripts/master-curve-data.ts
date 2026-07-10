/* eslint-disable */
// Génère les données de la COURBE MAÎTRESSE : puissance joueur par couche
// (classe / +gear / +talents) vs difficulté du contenu, sur toute la montée Nv1-50.
import { ITEMS } from '../src/game/items';
import { MONSTERS } from '../src/game/monsters';
import { CLASSES } from '../src/game/classes';
import { getTalentsForClass, talentMods } from '../src/game/talents';
import { deriveStats } from '../src/game/player';
import { simulateCombat } from '../src/game/combat';
import { xpToNext, MAX_LEVEL } from '../src/game/classes';
import type { PlayerState, ClassId, ItemDef } from '../src/game/types';
import * as fs from 'fs';
const OUT='/private/tmp/claude-501/-Users-jeremy-Projects-RPText/b80104e0-3060-4633-b23d-b3224ca13748/scratchpad';

function bp(c:ClassId,l:number):PlayerState{return {uid:'s',name:'S',photoURL:null,classId:c,level:l,xp:0,hp:9e5,inventory:{},equipped:{weapon:null,armor:null,trinket:null,tool:null,profession_armor:null},talents:{},equippedSkills:[],gearStars:{},gearDurability:{},enchants:{},prestigeLevel:0,gold:0,fateCoins:0,gems:0,familiars:{},activeFamiliarId:null,biome:'forest',cooldowns:{},statistics:{goldEarned:0,gamblesPlayed:0,gamblesWon:0,mobsKilled:{},mobsEncountered:{}} as any} as any;}
function fam(c:ClassId){return (CLASSES[c].parent??c) as ClassId;}
function fits(it:ItemDef,f:ClassId){if(!it.classes||!it.classes.length)return true;return it.classes.includes(f)||it.classes.includes(fam(f));}
const ALL=Object.values(ITEMS) as ItemDef[];
function best(s:string,l:number,f:ClassId,sc:(i:ItemDef)=>number){const c=ALL.filter(it=>it.slot===s&&(it.reqLevel??1)<=l&&fits(it,f)&&(it.atk||it.def||it.hp));return c.length?c.reduce((a,b)=>sc(b)>sc(a)?b:a):null;}
function gearUp(p:PlayerState){const l=p.level,f=fam(p.classId);const eq=(it:ItemDef|null,s:any)=>{if(!it)return;const k=it.id+':q150';p.equipped[s]=k;p.inventory[k]=1;if(it.maxDurability)p.gearDurability![k]=it.maxDurability;};eq(best('weapon',l,f,i=>i.atk??0),'weapon');eq(best('armor',l,f,i=>(i.def??0)*2+(i.hp??0)),'armor');eq(best('trinket',l,f,i=>(i.atk??0)*3),'trinket');}
function talentUp(p:PlayerState){for(const t of getTalentsForClass(p.classId))p.talents![t.id]=t.maxRank;}
// puissance = dégâts/tour en auto-combat sur cible fixe (def modérée) → offense pure
function power(p:PlayerState,useTalents:boolean):number{const st=deriveStats(p,true) as any;const mods=useTalents?talentMods(p):{crit:0,critMult:0,flatDmg:0,dmgReduction:0,dodge:0,doubleHit:0,regen:0,berserkBonus:0,lifesteal:0,armorPen:0,execute:0,thorns:0,atkPct:0,defPct:0,hpPct:0};const target={hp:100000,atk:1,def:Math.round(4+p.level*1.4),name:'t',element:'neutral'} as any;let hits=0,n=120;for(let i=0;i<n;i++){const r=simulateCombat(st,st.maxHp,target,mods);hits+=r.hitsDealt;}// dmg/tour = (dégâts sur 80 tours cappés)/tours. cible intuable → hits≈tours. approx dmg/tour via 1 combat court:
 // mieux : cible tuable
 const t2={hp:3000,atk:1,def:Math.round(4+p.level*1.4),name:'t',element:'neutral'} as any;let ttk=0;for(let i=0;i<n;i++){ttk+=simulateCombat(st,st.maxHp,t2,mods).hitsDealt;}return Math.round(3000/(ttk/n));}
// survie = PV effectifs (maxHp × (1 + réductions))
function tank(p:PlayerState,useTalents:boolean):number{const st=deriveStats(p,true) as any;const mods=useTalents?talentMods(p):null;const dr=mods?mods.dmgReduction:0;return Math.round(st.maxHp*(1+dr));}
// contenu : menace du monstre du biome au niveau = atk_scalé (indexé)
function contentThreat(lvl:number):number{const pf=1.75;const s=Math.pow(1+Math.max(0,lvl-1)/30,pf);const bm:any={forest:1,plains:3,mountains:8,desert:14,swamp:20,volcano:24,crypt:30,frozen:38};let biome='forest';for(const b in bm)if(bm[b]<=lvl&&bm[b]>=bm[biome])biome=b;const mobs=(MONSTERS as any[]).filter(m=>m.biomes.includes(biome));const avgHp=mobs.reduce((a,m)=>a+m.hp,0)/mobs.length;const avgAtk=mobs.reduce((a,m)=>a+m.atk,0)/mobs.length;return Math.round((avgAtk*s)+ (avgHp*s)*0.08);} // menace = atk + part des PV (temps à tuer)

const REF:ClassId='archer';
const rows:any[]=[];
for(let l=1;l<=50;l++){
  const pC=bp(REF,l); // classe seule
  const pG=bp(REF,l); gearUp(pG); // +gear
  const pF=bp(REF,l); gearUp(pF); talentUp(pF); // +gear +talents (au moins Nv... talents dès Nv2)
  rows.push({lvl:l,
    powClass:power(pC,false), powGear:power(pG,false), powFull:power(pF,true),
    tankClass:tank(pC,false), tankFull:tank(pF,true),
    content:contentThreat(l)});
}
// XP cumulée
let cum=0;const cumXp:number[]=[0];for(let l=1;l<MAX_LEVEL;l++){cum+=xpToNext(l);cumXp.push(cum);}
const total=cum;
const xp=[];for(let l=1;l<=50;l++)xp.push({lvl:l,cumPct:Math.round((cumXp[l-1]/total)*1000)/10,step:l<50?xpToNext(l):0});

// sous-classes : puissance à Nv50 (offense) pour l'éventail
const subPow:any[]=[];
for(const c of Object.values(CLASSES)){const p=bp(c.id,50);gearUp(p);talentUp(p);subPow.push({name:c.name,base:c.parent??c.id,isSub:!!c.parent,dps:power(p,true),tank:tank(p,true)});}

fs.writeFileSync(`${OUT}/master-data.json`,JSON.stringify({rows,xp,subPow,total}));
console.log('rows',rows.length,'| Nv1 powClass',rows[0].powClass,'Nv50 powFull',rows[49].powFull,'content Nv50',rows[49].content);
console.log('gap (powFull-content) échantillon:',[1,20,24,30,40,50].map(l=>l+':'+ (rows[l-1].powFull-rows[l-1].content)).join(' '));
