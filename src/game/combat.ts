import type { PlayerState, MonsterDef } from './types';
import { deriveStats, grantXp, addItem, applyBonuses } from './player';
import { item } from './items';
import { PHASE_MODIFIERS, currentPhase } from './daynight';
import { addQuestMetric } from './quests';
import { emptyMods, type CombatMods } from './talents';
import { grantFamiliarXp } from './familiars';

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

  const monsterMaxHp = monster.hp;
  const effDef = monster.def * (1 - mods.armorPen);

  while (php > 0 && mhp > 0 && rounds.length < 80) {
    // Joueur frappe (1 ou 2 fois)
    const hits = 1 + (Math.random() < mods.doubleHit ? 1 : 0);
    for (let h = 0; h < hits && mhp > 0; h++) {
      let dmg = Math.max(1, roll(stats.atk - 2, stats.atk + 3) - effDef) + mods.flatDmg;
      if (php < maxHp * 0.3 && mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + mods.berserkBonus));
      if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
      const crit = Math.random() < mods.crit;
      if (crit) dmg = Math.round(dmg * (2 + mods.critMult));
      mhp -= dmg;
      if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
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
      if (mods.thorns > 0) mhp = Math.max(0, mhp - Math.round(mdmg * mods.thorns));
      rounds.push({ text: `${monster.name} t'inflige ${mdmg} dégâts.`, playerHp: Math.max(0, php), monsterHp: Math.max(0, mhp) });
    }

    // Régénération de fin de tour
    if (mods.regen > 0 && php > 0 && php < maxHp) {
      php = Math.min(maxHp, php + mods.regen);
    }
  }

  return { rounds, victory: mhp <= 0 && php > 0, endHp: Math.max(0, php) };
}

// ─── Combat interactif (chasse au tour par tour) ───────────────────────────

export type HuntAction = 'attack' | 'ability' | 'potion' | 'flee';

export interface TurnEvent {
  text: string;
  side: 'you' | 'enemy' | 'info';
}

export interface TurnResult {
  events: TurnEvent[];
  php: number;
  mhp: number;
  fled: boolean;
  abilityUsed: boolean;
}

export interface HuntEncounter {
  monster: MonsterDef;
  id: number;
  isAdventure?: boolean;
}

export interface HuntRewards {
  xp: number;
  gold: number;
  loot: string[];
  levelsGained: number;
}

/**
 * Résout UN tour de combat interactif (action du joueur puis riposte du monstre).
 * Fonction pure : ne mute pas le joueur (la carte applique le résultat).
 * Les monstres frappent plus fort qu'avant (la défense compte moins).
 */
export function combatTurn(
  stats: CombatStats,
  mods: CombatMods,
  monster: { name: string; atk: number; def: number; maxHp?: number },
  php0: number,
  mhp0: number,
  action: HuntAction,
  opts: { abilityMult?: number; abilityHealFrac?: number; potionHeal?: number } = {},
): TurnResult {
  let php = php0;
  let mhp = mhp0;
  const maxHp = stats.maxHp;
  const monsterMaxHp = monster.maxHp ?? mhp0;
  const effDef = monster.def * (1 - mods.armorPen);
  const events: TurnEvent[] = [];
  let fled = false;
  let abilityUsed = false;

  // ── Phase joueur ──
  if (action === 'flee') {
    if (Math.random() < 0.55) {
      events.push({ text: 'Tu prends la fuite !', side: 'info' });
      return { events, php, mhp, fled: true, abilityUsed };
    }
    events.push({ text: 'Fuite ratée ! Le monstre t\'attaque.', side: 'info' });
  } else if (action === 'potion') {
    php = Math.min(maxHp, php + (opts.potionHeal ?? 0));
    events.push({ text: `Tu te soignes (+${opts.potionHeal} PV).`, side: 'info' });
  } else if (action === 'ability') {
    let dmg = Math.max(1, Math.round(stats.atk * (opts.abilityMult ?? 1.6) * (0.9 + Math.random() * 0.3)) - effDef);
    if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
    mhp -= dmg;
    abilityUsed = true;
    if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
    events.push({ text: `Capacité : ${dmg} dégâts !`, side: 'you' });
    if (opts.abilityHealFrac) {
      php = Math.min(maxHp, php + Math.round(maxHp * opts.abilityHealFrac));
      events.push({ text: 'Tu canalises un soin.', side: 'info' });
    }
  } else {
    const hits = 1 + (Math.random() < mods.doubleHit ? 1 : 0);
    for (let h = 0; h < hits && mhp > 0; h++) {
      let dmg = Math.max(1, roll(stats.atk - 2, stats.atk + 3) - effDef) + mods.flatDmg;
      if (php < maxHp * 0.3 && mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + mods.berserkBonus));
      if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
      const crit = Math.random() < mods.crit;
      if (crit) dmg = Math.round(dmg * (2 + mods.critMult));
      mhp -= dmg;
      if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
      events.push({ text: `${h > 0 ? 'Tir double ! ' : ''}Tu infliges ${dmg}${crit ? ' (CRIT !)' : ''}.`, side: 'you' });
    }
  }

  if (mhp <= 0) return { events, php, mhp: 0, fled, abilityUsed };

  // ── Phase monstre (plus dangereux : la défense ne mitige qu'à 60%) ──
  if (Math.random() < mods.dodge) {
    events.push({ text: `Tu esquives l'attaque de ${monster.name} !`, side: 'info' });
  } else {
    let mdmg = Math.max(1, Math.round(roll(monster.atk, monster.atk + 4) - stats.def * 0.6));
    mdmg = Math.max(1, Math.round(mdmg * (1 - mods.dmgReduction)));
    php -= mdmg;
    if (mods.thorns > 0) mhp = Math.max(0, mhp - Math.round(mdmg * mods.thorns));
    events.push({ text: `${monster.name} t'inflige ${mdmg}.`, side: 'enemy' });
  }
  if (mods.regen > 0 && php > 0 && php < maxHp) php = Math.min(maxHp, php + mods.regen);

  return { events, php: Math.max(0, php), mhp: Math.max(0, mhp), fled, abilityUsed };
}

/** Récompenses de victoire (mute le joueur). */
export function grantMonsterRewards(p: PlayerState, monster: MonsterDef): HuntRewards {
  const phase = currentPhase();
  const mod = PHASE_MODIFIERS[phase];
  
  const base = {
    xp: Math.round(monster.xp * mod.xp),
    gold: Math.round(roll(monster.gold[0], monster.gold[1]) * mod.gold)
  };
  const { xp, gold } = applyBonuses(p, base);

  p.gold += gold;
  if (p.statistics) {
    p.statistics.goldEarned += gold;
    p.statistics.mobsKilled[monster.id] = (p.statistics.mobsKilled[monster.id] ?? 0) + 1;
  }
  p.kills += 1;
  addQuestMetric(p, 'kills', 1);
  addQuestMetric(p, 'goldEarned', gold);
  const levelsGained = grantXp(p, xp);
  grantFamiliarXp(p, Math.ceil(xp * 0.15));
  const loot: string[] = [];
  const lootMult = phase === 'night' ? 2 : 1;
  for (const [id, chance] of Object.entries(monster.loot)) {
    if (Math.random() < chance * lootMult && item(id)!) {
      addItem(p, id, 1);
      loot.push(id);
    }
  }
  if (Math.random() < 0.08) {
    p.fateCoins += 1;
    loot.push('__fate');
  }
  return { xp, gold, loot, levelsGained };
}

/** Pénalité de mort : perte de 10% d'or, résurrection à 30% PV. */
export function applyDeathPenalty(p: PlayerState) {
  p.deaths += 1;
  p.gold -= Math.floor(p.gold * 0.1);
  p.hp = Math.floor(deriveStats(p).maxHp * 0.3);
}
