/* eslint-disable */
import { xpToNext, MAX_LEVEL } from '../src/game/classes';
import { artifactXpToNext, artifactGridCost, artifactPowerPct, ARTIFACT_MODS } from '../src/game/artifact';
import { RELIC_STAR_COST, RELIC_STAT_STARS, RELIC_MAX_STARS, relicStarCost, SHARDS_PER_ACHIEVEMENT } from '../src/game/relic';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { PASS_TIERS } from '../src/game/seasonpass';
import { PVP_ARTIFACT_XP } from '../src/game/season';

// XP cumulée du personnage pour atteindre le niveau L (courbe v5).
const charCum: number[] = [0];
for (let l = 1; l < MAX_LEVEL; l++) charCum[l] = charCum[l-1] + xpToNext(l);
// XP cumulée d'artefact pour atteindre le niveau A.
const artCum: number[] = [0];
for (let a = 0; a < 250; a++) artCum[a+1] = artCum[a] + artifactXpToNext(a);
const artLevelFor = (xp: number) => { let a = 0; while (a < 249 && artCum[a+1] <= xp) a++; return a; };

const grid = artifactGridCost();
console.log(`Grille d'artefact : ${ARTIFACT_MODS.length} mods, ${grid} points au total.`);
console.log(`Relique : ★1-5 coûtent ${relicStarCost(0)} Éclats chacune (${RELIC_STAT_STARS*relicStarCost(0)} au total), ★6-10 ${RELIC_STAR_COST.join('/')} (${RELIC_STAR_COST.reduce((a,b)=>a+b,0)}). Total ★10 = ${RELIC_STAT_STARS*relicStarCost(0)+RELIC_STAR_COST.reduce((a,b)=>a+b,0)} Éclats.`);
console.log(`Succès : ${ACHIEVEMENTS.length} × ${SHARDS_PER_ACHIEVEMENT} = ${ACHIEVEMENTS.length*SHARDS_PER_ACHIEVEMENT} Éclats si tous accomplis.`);
const passShards = PASS_TIERS.reduce((s:number,t:any)=>s+(t.shards??0),0);
console.log(`Passe de saison : ${passShards} Éclats par saison.\n`);

console.log('niv. perso | XP cumulée | artefact « attendu » (combat seul) | +% stats | Éclats de la queue');
for (const l of [10, 20, 30, 38, 42, 46, 50]) {
  const a = artLevelFor(charCum[l]);
  console.log(`  Nv.${String(l).padStart(2)}     | ${String(charCum[l]).padStart(10)} | artefact ${String(a).padStart(3)}` +
    `                        | +${(artifactPowerPct(a)*100).toFixed(0)}%      | ${Math.max(0, a - grid)}`);
}

console.log('\nXP d\'artefact nécessaire pour un niveau donné :');
for (const a of [20, 40, 62, 80, 90, 120]) {
  const l = (() => { let x = 1; while (x < MAX_LEVEL-1 && charCum[x] < artCum[a]) x++; return x; })();
  console.log(`  artefact ${String(a).padStart(3)} = ${String(artCum[a]).padStart(9)} XP  ≈ l'XP d'un perso Nv.${charCum[MAX_LEVEL-1] < artCum[a] ? '50+' : l}`);
}

// Débit par source, en XP d'artefact
console.log('\nDébit d\'artefact par action (hors combat) :');
console.log(`  récolte  : 8 + qty*2 + minLvl*5  → ~${8+4*2+30*5} XP par récolte en zone Nv.30 (cooldown 60s)`);
console.log(`  craft    : 20 + difficulty*(1..2) → ~200-300 XP par craft réussi (pas de cooldown)`);
console.log(`  duel PvP : ${PVP_ARTIFACT_XP.duelWin} × niveau → ${PVP_ARTIFACT_XP.duelWin*40} XP à Nv.40 (pas de cooldown)`);
console.log(`  Card-Jitsu : ${PVP_ARTIFACT_XP.cjWin} × niveau → ${PVP_ARTIFACT_XP.cjWin*40} XP à Nv.40`);

// ── Débit d'XP par heure et par activité ──
import { MONSTERS } from '../src/game/monsters';
import { BIOMES } from '../src/game/biomes';
import { currentRift, buildRiftMonster, riftRewardMult } from '../src/game/rift';
import { getEndlessRewards } from '../src/game/endless';

const fake: any = { level: 40, biome: 'frozen', kills: 0, statistics: {}, huntStreak: 0, talents: {}, artifact: null };
const frozen = (MONSTERS as any[]).filter(m => m.biomes.includes('frozen'));
const avgMobXp = frozen.reduce((s, m) => s + m.xp, 0) / frozen.length;
const bx = (BIOMES as any).frozen.xpMult;
const huntXp = avgMobXp * bx;
const rift = currentRift(Date.now(), 40);
const riftMob = buildRiftMonster({ ...fake } as any, rift);
const riftXp = riftMob.xp * ((BIOMES as any)[rift.biome]?.xpMult ?? 1);

console.log('\n=== Débit d\'XP par heure (personnage Nv.40) ===');
const rows: [string, number, number][] = [
  // [activité, XP par tentative, secondes par tentative]
  ['chasse (Abysse)', huntXp, 20 + 15 * 3],
  ['Faille de la semaine', riftXp, 20 * 3],
  ['récolte', 8 + 4 * 2 + 30 * 5, 60],
  ['craft', 260, 30],
  ['duel PvP gagné', 40 * 40, 120],
  ['Abysses : 10 étages', getEndlessRewards(50).xp, 10 * 20 * 3],
  ['camp (12h hors ligne)', 40 * 5 * 12, 12 * 3600],
];
for (const [name, xp, secs] of rows) {
  const perH = Math.round(xp * 3600 / secs);
  console.log(`  ${name.padEnd(24)} ${String(Math.round(xp)).padStart(7)} XP / ${String(secs).padStart(5)}s  →  ${perH.toLocaleString('fr-FR').padStart(10)} XP/h`);
}
console.log(`\n  (rappel : artefact 90 = 4 965 759 XP ; tout le trajet Nv.1→50 = ${charCum[MAX_LEVEL-1].toLocaleString('fr-FR')} XP)`);
for (const [name, xp, secs] of rows) {
  const h = 4965759 / (xp * 3600 / secs);
  console.log(`  artefact 90 en ne faisant que « ${name} » : ${h.toFixed(1)} h`);
}


console.log('\n=== Faille : débit après la décroissance des passages répétés ===');
let cum = 0, secs = 0;
for (let n = 0; n < 12; n++) {
  const xp = Math.round(riftXp * riftRewardMult(n));
  cum += xp; secs += 60;
  if (n < 5 || n === 11) console.log(`  passage ${String(n+1).padStart(2)} : ${String(xp).padStart(6)} XP (${Math.round(riftRewardMult(n)*100)}%)  | cumul ${Math.round(cum*3600/secs).toLocaleString('fr-FR')} XP/h`);
}
const steady = Math.round(riftXp * 0.15 * 60);
console.log(`  régime permanent : ${steady.toLocaleString('fr-FR')} XP/h (chasse = 105 600 XP/h)`);
console.log(`  artefact 90 en Faille pure : 7.4 h -> ${(4965759 / (riftXp*0.15*60)).toFixed(1)} h`);
