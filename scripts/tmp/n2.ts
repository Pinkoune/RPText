import { CLASSES } from '../../src/game/classes';
import { deriveStats, createPlayer } from '../../src/game/player';
import { getTalentsForClass, talentMods } from '../../src/game/talents';
import { computeAscensionBoss } from '../../src/game/ascension';
import { simulateCombat } from '../../src/game/combat';
import { mintInstanceId } from '../../src/game/items';
import type { PlayerState, ClassId } from '../../src/game/types';
const BEST: Record<string,string> = { warrior:'lava_blade', archer:'infernal_bow', mage:'magma_staff', healer:'seraph_staff' };
function ideal(classId: ClassId, pres: number): PlayerState {
  const p = createPlayer('u','X',null,classId);
  p.level = 50; p.talents = {};
  for (const t of getTalentsForClass(classId)) p.talents[t.id] = t.maxRank;
  const base = (CLASSES[classId].parent ?? classId) as string;
  const w = mintInstanceId(`${BEST[base]}:q150`), a = mintInstanceId('void_mantle:q150'), t = mintInstanceId('primordial_crown:q150');
  p.equipped = { ...p.equipped, weapon: w, armor: a, trinket: t };
  p.gearStars = { [w]:5, [a]:5, [t]:5 };
  p.gearDurability = { [w]:800, [a]:1400, [t]:500 };
  p.enchants = { [w]:['rune_atk_2','rune_atk_2'], [a]:['rune_def_2','rune_hp_2'], [t]:['rune_hp_2','rune_hp_2'] };
  p.familiars = { starling: 100000 }; p.activeFamiliarId = 'starling';
  p.prestigeLevel = pres;
  return p;
}
function run(p: PlayerState, runs = 400) {
  const boss = computeAscensionBoss(p); const mods = talentMods(p);
  let w = 0, hp = 0;
  for (let i = 0; i < runs; i++) {
    const s = deriveStats(p, true);
    const r = simulateCombat(s, s.maxHp, { hp: boss.hp, atk: boss.atk, def: boss.def, name: boss.name, element: boss.element }, mods);
    if (r.victory) w++; hp += r.endHp / s.maxHp;
  }
  return { wr: w/runs*100, hp: hp/runs*100 };
}
console.log('Winrate du joueur PARFAIT contre le Néant, par niveau de prestige');
console.log('(simulation passive : les taux absolus sont pessimistes, c\'est l\'ÉCART qui compte)\n');
console.log('classe          P0     P1     P2     P3     P4     P5');
for (const c of ['warrior','mage','archer','healer'] as ClassId[]) {
  const row = [0,1,2,3,4,5].map(n => run(ideal(c, n)).wr.toFixed(0).padStart(4) + '%');
  console.log(CLASSES[c].name.padEnd(14), row.join(' '));
}
