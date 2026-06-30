import type { PlayerState, MonsterDef } from './types';
import { deriveStats, grantXp, addItem } from './player';
import { ITEMS } from './items';
import { PHASE_MODIFIERS, currentPhase } from './daynight';
import { addQuestMetric } from './quests';
import { talentMods, emptyMods, type CombatMods } from './talents';

export interface CombatStats {
  atk: number;
  def: number;
  maxHp: number;
}

export interface SimResult {
  rounds: { text: string; playerHp: number; monsterHp: number }[];
  victory: boolean;
  endHp: number;
}

export interface CombatLog {
  monster: MonsterDef;
  playerMaxHp: number;
  monsterMaxHp: number;
  rounds: { text: string; playerHp: number; monsterHp: number }[];
  victory: boolean;
  fled: boolean;
  xp: number;
  gold: number;
  loot: string[];
  levelsGained: number;
}

function roll(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Cœur de combat au tour par tour, appliquant les talents (crit, esquive,
 * double frappe, régénération, furie, réduction de dégâts, dégâts plats).
 * Partagé entre la chasse et les donjons. Ne mute pas le joueur.
 */
export function simulateCombat(
  stats: CombatStats,
  startHp: number,
  monster: { hp: number; atk: number; def: number; name: string },
  mods: CombatMods = emptyMods(),
): SimResult {
  let php = startHp;
  let mhp = monster.hp;
  const maxHp = stats.maxHp;
  const rounds: SimResult['rounds'] = [];

  while (php > 0 && mhp > 0 && rounds.length < 80) {
    // Joueur frappe (1 ou 2 fois)
    const hits = 1 + (Math.random() < mods.doubleHit ? 1 : 0);
    for (let h = 0; h < hits && mhp > 0; h++) {
      let dmg = Math.max(1, roll(stats.atk - 2, stats.atk + 3) - monster.def) + mods.flatDmg;
      if (php < maxHp * 0.3 && mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + mods.berserkBonus));
      const crit = Math.random() < mods.crit;
      if (crit) dmg *= 2;
      mhp -= dmg;
      rounds.push({
        text: `${h > 0 ? 'Tir double ! ' : ''}Tu infliges ${dmg}${crit ? ' (CRIT !)' : ''} dégâts.`,
        playerHp: Math.max(0, php),
        monsterHp: Math.max(0, mhp),
      });
    }
    if (mhp <= 0) break;

    // Monstre riposte (esquive possible)
    if (Math.random() < mods.dodge) {
      rounds.push({ text: `Tu esquives l'attaque de ${monster.name} !`, playerHp: php, monsterHp: mhp });
    } else {
      let mdmg = Math.max(1, roll(monster.atk - 2, monster.atk + 2) - stats.def);
      mdmg = Math.max(1, Math.round(mdmg * (1 - mods.dmgReduction)));
      php -= mdmg;
      rounds.push({ text: `${monster.name} t'inflige ${mdmg} dégâts.`, playerHp: Math.max(0, php), monsterHp: mhp });
    }

    // Régénération de fin de tour
    if (mods.regen > 0 && php > 0 && php < maxHp) {
      php = Math.min(maxHp, php + mods.regen);
    }
  }

  return { rounds, victory: mhp <= 0 && php > 0, endHp: Math.max(0, php) };
}

/**
 * Combat automatique au tour par tour. Mute le joueur (hp, xp, or, loot).
 * La nuit double les chances de loot rare.
 */
export function fight(p: PlayerState, monster: MonsterDef): CombatLog {
  const phase = currentPhase();
  const mod = PHASE_MODIFIERS[phase];
  addQuestMetric(p, 'hunts', 1);
  const stats = deriveStats(p);
  const sim = simulateCombat(
    { atk: stats.atk, def: stats.def, maxHp: stats.maxHp },
    stats.hp,
    monster,
    talentMods(p),
  );
  const rounds = sim.rounds;
  const victory = sim.victory;
  p.hp = sim.endHp;

  const log: CombatLog = {
    monster,
    playerMaxHp: stats.maxHp,
    monsterMaxHp: monster.hp,
    rounds,
    victory,
    fled: false,
    xp: 0,
    gold: 0,
    loot: [],
    levelsGained: 0,
  };

  if (victory) {
    const xp = Math.round(monster.xp * mod.xp);
    const gold = Math.round(roll(monster.gold[0], monster.gold[1]) * mod.gold);
    log.xp = xp;
    log.gold = gold;
    p.gold += gold;
    p.kills += 1;
    addQuestMetric(p, 'kills', 1);
    addQuestMetric(p, 'goldEarned', gold);
    log.levelsGained = grantXp(p, xp);

    const lootMult = phase === 'night' ? 2 : 1;
    for (const [id, chance] of Object.entries(monster.loot)) {
      if (Math.random() < chance * lootMult && ITEMS[id]) {
        addItem(p, id, 1);
        log.loot.push(id);
      }
    }
    // Petite chance de Fate Coin
    if (Math.random() < 0.08) {
      p.fateCoins += 1;
      log.loot.push('__fate');
    }
  } else {
    p.deaths += 1;
    // Pénalité de mort : perte d'or partielle, ressuscite à 30% PV.
    const lost = Math.floor(p.gold * 0.1);
    p.gold -= lost;
    p.hp = Math.floor(deriveStats(p).maxHp * 0.3);
  }

  return log;
}
