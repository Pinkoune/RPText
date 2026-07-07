import type { PlayerState, MonsterDef } from './types';
import { deriveStats, grantXp, addItem, applyBonuses, luckyDropMult } from './player';
import { BIOMES } from './biomes';
import { item } from './items';
import { PHASE_MODIFIERS, currentPhase } from './daynight';
import { addQuestMetric } from './quests';
import { emptyMods, type CombatMods, type ActiveSkillDef } from './talents';
import { grantFamiliarXp } from './familiars';

/** Probabilité que la régénération se déclenche à un tour donné (passif). */
const REGEN_CHANCE = 0.3;

export interface CombatStats {
  level: number;
  atk: number;
  def: number;
  maxHp: number;
  weaponElement?: string;
  weaponDmgType?: string;
  armorElement?: string;
  trinketId?: string;
  familiar?: { kind: 'strike' | 'guard' | 'heal'; power: number; chance: number; emoji: string; name: string; label: string };
}

export interface SimResult {
  rounds: { text: string; playerHp: number; monsterHp: number }[];
  victory: boolean;
  endHp: number;
  hitsDealt: number;
  hitsTaken: number;
}

function roll(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getElementMult(attackerElem: string | undefined, defenderElem: string | undefined): number {
  if (!attackerElem || !defenderElem) return 1.0;
  if (attackerElem === 'water' && defenderElem === 'fire') return 1.5;
  if (attackerElem === 'fire' && defenderElem === 'wind') return 1.5;
  if (attackerElem === 'wind' && defenderElem === 'earth') return 1.5;
  if (attackerElem === 'earth' && defenderElem === 'water') return 1.5;
  if (attackerElem === 'light' && defenderElem === 'dark') return 1.5;
  if (attackerElem === 'dark' && defenderElem === 'light') return 1.5;
  if (attackerElem === 'frost' && (defenderElem === 'water' || defenderElem === 'earth')) return 1.5;
  if (attackerElem === 'fire' && defenderElem === 'frost') return 1.5;
  
  if (defenderElem === 'water' && attackerElem === 'fire') return 0.7;
  if (defenderElem === 'fire' && attackerElem === 'wind') return 0.7;
  if (defenderElem === 'wind' && attackerElem === 'earth') return 0.7;
  if (defenderElem === 'earth' && attackerElem === 'water') return 0.7;
  if (defenderElem === 'frost' && attackerElem === 'water') return 0.7;
  return 1.0;
}

export function getDmgTypeMult(dmgType: string | undefined, monster: any): number {
  if (!dmgType || !monster) return 1.0;
  let mult = 1.0;
  if (monster.weaknesses?.includes(dmgType)) mult *= 1.5;
  if (monster.resistances?.includes(dmgType)) mult *= 0.5;
  return mult;
}

/**
 * Cœur de combat au tour par tour, appliquant les talents (crit, esquive,
 * double frappe, régénération, furie, réduction de dégâts, dégâts plats).
 * Partagé entre la chasse et les donjons. Ne mute pas le joueur.
 */
export function simulateCombat(
  stats: CombatStats,
  startHp: number,
  monster: { hp: number; atk: number; def: number; name: string; element?: string; weaknesses?: string[]; resistances?: string[] },
  mods: CombatMods = emptyMods(),
): SimResult {
  let php = startHp;
  let mhp = monster.hp;
  let maxHp = stats.maxHp;
  const rounds: SimResult['rounds'] = [];

  const monsterMaxHp = monster.hp;
  const effDef = monster.def * (1 - mods.armorPen);
  
  const atkMult = getElementMult(stats.weaponElement, monster.element) * getDmgTypeMult(stats.weaponDmgType, monster);
  const defMult = getElementMult(monster.element, stats.armorElement);

  let hitsDealt = 0;
  let hitsTaken = 0;

  while (php > 0 && mhp > 0 && rounds.length < 80) {
    // Joueur frappe (1 ou 2 fois)
    const hits = 1 + (Math.random() < mods.doubleHit ? 1 : 0);
    for (let h = 0; h < hits && mhp > 0; h++) {
      hitsDealt++;
      let dmg = Math.max(1, roll(stats.atk - 2, stats.atk + 3) - effDef) + mods.flatDmg;
      dmg = Math.round(dmg * atkMult);
      if (php < maxHp * 0.3 && mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + mods.berserkBonus));
      if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
      const crit = Math.random() < mods.crit;
      if (crit) dmg = Math.round(dmg * (2 + mods.critMult));
      mhp -= dmg;
      if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
      
      let bonusText = '';
      if (stats.trinketId === 'heartsteel' && hitsDealt % 3 === 0) {
        // Coeuracier trigger!
        stats.atk += 3;
        const hpBonus = 20;
        php += hpBonus;
        maxHp += hpBonus; // Increase local maxHp to allow keeping the extra health
        bonusText = ' 💥 Coeuracier proc (+ATK, +PV max) !';
      }

      rounds.push({
        text: `${h > 0 ? 'Tir double ! ' : ''}Tu infliges ${dmg}${crit ? ' (CRIT !)' : ''} dégâts.${bonusText}`,
        playerHp: Math.max(0, php),
        monsterHp: Math.max(0, mhp),
      });
    }
    if (mhp <= 0) break;

    // Monstre riposte (esquive possible)
    if (Math.random() < mods.dodge) {
      rounds.push({ text: `Tu esquives l'attaque de ${monster.name} !`, playerHp: Math.max(0, php), monsterHp: Math.max(0, mhp) });
    } else {
      hitsTaken++;
      let mdmg = Math.max(1, roll(monster.atk - 2, monster.atk + 2) - stats.def);
      mdmg = Math.round(mdmg * defMult);
      mdmg = Math.max(1, Math.round(mdmg * (1 - mods.dmgReduction)));
      php -= mdmg;
      if (mods.thorns > 0) mhp = Math.max(0, mhp - Math.round(mdmg * mods.thorns));
      rounds.push({ text: `${monster.name} t'inflige ${mdmg} dégâts.`, playerHp: Math.max(0, php), monsterHp: Math.max(0, mhp) });
    }

    // Régénération : passif à déclenchement aléatoire (pas chaque tour).
    if (mods.regen > 0 && php < maxHp && php > 0 && Math.random() < REGEN_CHANCE) {
      const reg = Math.round(mods.regen / 3 + stats.level * 0.5);
      php = Math.min(maxHp, php + reg);
      rounds.push({ text: `Régénération ! +${reg} PV.`, playerHp: php, monsterHp: mhp });
    }

    // Familier : capacité passive (frappe / soin / protection).
    if (stats.familiar && php > 0 && mhp > 0 && Math.random() < stats.familiar.chance) {
      const f = stats.familiar;
      if (f.kind === 'strike') {
        mhp = Math.max(0, mhp - f.power);
        rounds.push({ text: `${f.emoji} ${f.name} frappe (+${f.power} dégâts) !`, playerHp: Math.max(0, php), monsterHp: mhp });
      } else if (php < maxHp) {
        php = Math.min(maxHp, php + f.power);
        rounds.push({ text: `${f.emoji} ${f.name} te ${f.kind === 'guard' ? 'protège' : 'soigne'} (+${f.power} PV) !`, playerHp: php, monsterHp: mhp });
      }
    }
  }

  return { rounds, victory: mhp <= 0 && php > 0, endHp: Math.max(0, php), hitsDealt, hitsTaken };
}

// ─── Combat interactif (chasse au tour par tour) ───────────────────────────

export type HuntAction = 'attack' | 'potion' | 'flee' | string;

export interface TurnEvent {
  text: string;
  side: 'you' | 'enemy' | 'info';
}

/** État persistant d'un combat (bouclier du joueur + altérations sur le monstre). */
export interface CombatState {
  /** PV de bouclier absorbant les dégâts entrants. */
  shield: number;
  /** Tours restants et dégâts/tour de brûlure sur le monstre. */
  burn: number;
  burnPow: number;
  /** Tours restants et dégâts/tour de poison. */
  poison: number;
  poisonPow: number;
  /** Tours de gel : le monstre frappe plus faiblement. */
  chill: number;
}

export function freshCombatState(): CombatState {
  return { shield: 0, burn: 0, burnPow: 0, poison: 0, poisonPow: 0, chill: 0 };
}

export interface TurnResult {
  events: TurnEvent[];
  php: number;
  mhp: number;
  fled: boolean;
  abilityUsed: boolean;
  hitsDealt: number;
  hitsTaken: number;
  state: CombatState;
  /** Or chapardé instantanément (Voleur : Assassinat), à ajouter par l'appelant. */
  goldStolen: number;
  /** Ressource d'archétype (rage/combo) gagnée ce tour, à ajouter par l'appelant. */
  resourceGained: number;
  /** Ressource dépensée pour la compétence utilisée ce tour (0 si aucune), à retirer par l'appelant. */
  resourceSpent: number;
}

export interface HuntEncounter {
  monster: MonsterDef;
  id: number;
  isAdventure?: boolean;
  isMiniboss?: boolean;
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
  monster: { name: string; atk: number; def: number; maxHp?: number; element?: string; weaknesses?: string[]; resistances?: string[] },
  php0: number,
  mhp0: number,
  action: HuntAction,
  opts: {
    activeSkill?: ActiveSkillDef;
    potionHeal?: number;
    setProc?: { setId: string; name: string; icon: string; chance: number; kind: 'burn' | 'chill' | 'heal' | 'shield' | 'extra'; power: number };
    /** Ressource d'archétype actuellement en réserve (Berserker/DK: rage 0-100 ; Voleur/Moine: combo 0-5). */
    resourceAmount?: number;
    /** Type de ressource passive de la classe du joueur (voir `classResourceType`). */
    resourceType?: 'rage' | 'combo' | 'grace' | 'mana' | 'sap' | 'zeal' | 'tempo' | 'overcharge' | 'instinct' | 'corruption' | null;
  } = {},
  state: CombatState = freshCombatState(),
): TurnResult {
  let php = php0;
  let mhp = mhp0;
  const maxHp = stats.maxHp;
  const monsterMaxHp = monster.maxHp ?? mhp0;
  const effDef = monster.def * (1 - mods.armorPen);
  const events: TurnEvent[] = [];
  let fled = false;
  let abilityUsed = false;
  let hitsDealt = 0;
  let hitsTaken = 0;
  let goldStolen = 0;
  let resourceSpent = 0;
  let healDone = 0;
  let critLanded = false;

  const atkMult = getElementMult(stats.weaponElement, monster.element) * getDmgTypeMult(stats.weaponDmgType, monster);
  const defMult = getElementMult(monster.element, stats.armorElement);

  // ── Phase joueur ──
  if (action === 'flee') {
    if (Math.random() < 0.55) {
      events.push({ text: 'Tu prends la fuite !', side: 'info' });
      return { events, php, mhp, fled: true, abilityUsed: false, hitsDealt, hitsTaken, state, goldStolen, resourceGained: 0, resourceSpent };
    }
    events.push({ text: 'Fuite ratée ! Le monstre t\'attaque.', side: 'info' });
  } else if (action === 'potion') {
    php = Math.min(maxHp, php + (opts.potionHeal ?? 0));
    events.push({ text: `Tu te soignes (+${opts.potionHeal} PV).`, side: 'info' });
  } else if (action !== 'attack') {
    // action est l'ID de la compétence (ex: 'skill_meteor')
    const skill = opts.activeSkill;
    if (skill) {
      abilityUsed = true; // On signale qu'une compétence a été utilisée (pour le cooldown global ou anim)
      
      // Ressource d'archétype : coût fixe pour la rage, consomme tout le pool
      // pour combo (scale les dégâts) et grace (scale le soin).
      let effMult = skill.mult ?? 0;
      let effHealFrac = skill.healFrac ?? 0;
      if (skill.resource) {
        const pool = opts.resourceAmount ?? 0;
        if (skill.resource.type === 'combo') {
          effMult = (skill.mult ?? 0) + (skill.resource.scalePerPoint ?? 0) * pool;
          resourceSpent = pool;
        } else if (skill.resource.type === 'grace') {
          effHealFrac = (skill.healFrac ?? 0) + (skill.resource.scalePerPoint ?? 0) * pool;
          resourceSpent = pool;
        } else {
          resourceSpent = skill.resource.cost;
        }
      }
      if (skill.type === 'attack' || skill.type === 'shield' || skill.type === 'heal' || skill.type === 'buff') {
        if (effMult) {
          hitsDealt++;
          let dmg = Math.max(1, Math.round(stats.atk * effMult * (0.9 + Math.random() * 0.3)) - effDef);
          dmg = Math.round(dmg * atkMult);
          if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
          mhp -= dmg;
          if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
          events.push({ text: `${skill.name} : ${dmg} dégâts !`, side: 'you' });
        }
        if (effHealFrac) {
          const heal = Math.round(maxHp * effHealFrac);
          php = Math.min(maxHp, php + heal);
          healDone += heal;
          events.push({ text: `${skill.name} te rend ${heal} PV.`, side: 'info' });
        }
        if (skill.shield) {
          // Vrai bouclier : PV qui absorbent les prochains dégâts entrants.
          const amount = Math.round(maxHp * skill.shield);
          state.shield += amount;
          events.push({ text: `🛡️ ${skill.name} t'accorde un bouclier de ${amount} PV.`, side: 'info' });
        }
        if (skill.status && mhp > 0) {
          const st = skill.status;
          const pow = st.pow ? Math.max(1, Math.round(stats.atk * st.pow)) : 0;
          if (st.type === 'burn') { state.burn = Math.max(state.burn, st.turns); state.burnPow = Math.max(state.burnPow, pow); events.push({ text: `🔥 ${monster.name} prend feu !`, side: 'you' }); }
          else if (st.type === 'poison') { state.poison = Math.max(state.poison, st.turns); state.poisonPow = Math.max(state.poisonPow, pow); events.push({ text: `🧪 ${monster.name} est empoisonné !`, side: 'you' }); }
          else if (st.type === 'chill') { state.chill = Math.max(state.chill, st.turns); events.push({ text: `❄️ ${monster.name} est gelé (frappe affaiblie) !`, side: 'you' }); }
        }
        if (skill.goldSteal) {
          goldStolen = Math.max(1, Math.round(stats.atk * skill.goldSteal));
          events.push({ text: `💰 ${skill.name} : tu chapardes ${goldStolen} Or !`, side: 'you' });
        }
      }
    }
  } else {
    const hits = 1 + (Math.random() < mods.doubleHit ? 1 : 0);
    for (let h = 0; h < hits && mhp > 0; h++) {
      hitsDealt++;
      let dmg = Math.max(1, roll(stats.atk - 2, stats.atk + 3) - effDef) + mods.flatDmg;
      dmg = Math.round(dmg * atkMult);
      if (php < maxHp * 0.3 && mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + mods.berserkBonus));
      if (mhp / monsterMaxHp < 0.2 && mods.execute > 0) dmg = Math.round(dmg * (1 + mods.execute));
      const crit = Math.random() < mods.crit;
      if (crit) { dmg = Math.round(dmg * (2 + mods.critMult)); critLanded = true; }
      mhp -= dmg;
      if (mods.lifesteal > 0) php = Math.min(maxHp, php + Math.round(dmg * mods.lifesteal));
      events.push({ text: `${h > 0 ? 'Tir double ! ' : ''}Tu infliges ${dmg}${crit ? ' (CRIT !)' : ''}.`, side: 'you' });
    }
  }

  // ── Proc de set (3 pièces équipées) : se déclenche sur une action offensive ──
  if (opts.setProc && action !== 'flee' && action !== 'potion' && Math.random() < opts.setProc.chance) {
    const sp = opts.setProc;
    if (sp.kind === 'burn') {
      state.burn = Math.max(state.burn, 2);
      state.burnPow = Math.max(state.burnPow, Math.max(1, Math.round(stats.atk * sp.power)));
      if (mhp > 0) events.push({ text: `${sp.icon} ${sp.name} : ${monster.name} prend feu !`, side: 'you' });
    } else if (sp.kind === 'chill') {
      state.chill = Math.max(state.chill, 2);
      if (mhp > 0) events.push({ text: `${sp.icon} ${sp.name} : ${monster.name} est gelé !`, side: 'you' });
    } else if (sp.kind === 'heal') {
      const heal = Math.max(1, Math.round(maxHp * sp.power));
      php = Math.min(maxHp, php + heal);
      events.push({ text: `${sp.icon} ${sp.name} : +${heal} PV.`, side: 'info' });
    } else if (sp.kind === 'shield') {
      const amt = Math.max(1, Math.round(maxHp * sp.power));
      state.shield += amt;
      events.push({ text: `${sp.icon} ${sp.name} : bouclier +${amt} PV.`, side: 'info' });
    } else if (sp.kind === 'extra' && mhp > 0) {
      const dmg = Math.max(1, Math.round(stats.atk * sp.power));
      mhp = Math.max(0, mhp - dmg);
      events.push({ text: `${sp.icon} ${sp.name} : +${dmg} dégâts !`, side: 'you' });
    }
  }

  if (mhp <= 0) {
    let resourceGained = 0;
    if (opts.resourceType === 'combo' && hitsDealt > 0) resourceGained = 1;
    else if (opts.resourceType === 'grace') resourceGained = Math.round(healDone * 0.15);
    else if (opts.resourceType === 'mana') resourceGained = 15;
    else if (opts.resourceType === 'instinct' && critLanded) resourceGained = 30;
    else if (opts.resourceType === 'corruption' && hitsDealt > 0 && php < maxHp * 0.3) resourceGained = 35;
    return { events, php, mhp: 0, fled, abilityUsed, hitsDealt, hitsTaken, state, goldStolen, resourceGained, resourceSpent };
  }

  // ── Phase monstre (plus dangereux : la défense ne mitige qu'à 80%) ──
  let dmgTakenThisTurn = 0;
  let thornsProced = false;
  let shieldAbsorbed = false;
  if (Math.random() < mods.dodge) {
    events.push({ text: `Tu esquives l'attaque de ${monster.name} !`, side: 'info' });
  } else {
    hitsTaken++;
    let mdmg = Math.max(1, Math.round(roll(monster.atk, monster.atk + 4) - stats.def * 0.8));
    mdmg = Math.round(mdmg * defMult);
    mdmg = Math.max(1, Math.round(mdmg * (1 - mods.dmgReduction)));
    if (state.chill > 0) mdmg = Math.max(1, Math.round(mdmg * 0.6)); // gel : dégâts réduits
    // Absorption par le bouclier avant les PV.
    if (state.shield > 0) {
      const absorbed = Math.min(state.shield, mdmg);
      state.shield -= absorbed;
      mdmg -= absorbed;
      if (absorbed > 0) { events.push({ text: `🛡️ Ton bouclier absorbe ${absorbed} dégâts.`, side: 'info' }); shieldAbsorbed = true; }
    }
    if (mdmg > 0) php -= mdmg;
    dmgTakenThisTurn = Math.max(0, mdmg);
    if (mods.thorns > 0) { mhp = Math.max(0, mhp - Math.round((mdmg || 1) * mods.thorns)); thornsProced = true; }
    events.push({ text: `${monster.name} t'inflige ${mdmg}.`, side: 'enemy' });
  }

  // Régénération : passif (Healer) 100% chance qui scale avec le niveau, mais dont la base est divisée pour compenser le déclenchement garanti
  if (action === 'attack' && mods.regen > 0 && php < maxHp && php > 0) {
    const reg = Math.max(1, Math.round(mods.regen / 3 + stats.level * 0.5));
    php = Math.min(maxHp, php + reg);
    events.push({ text: `Régénération ! +${reg} PV.`, side: 'info' });
  }

  // Familier : capacité passive (frappe / soin / protection), hors fuite.
  if (action !== 'flee' && stats.familiar && php > 0 && mhp > 0 && Math.random() < stats.familiar.chance) {
    const f = stats.familiar;
    if (f.kind === 'strike') {
      mhp = Math.max(0, mhp - f.power);
      events.push({ text: `${f.emoji} ${f.name} frappe (+${f.power} dégâts) !`, side: 'you' });
    } else if (php < maxHp) {
      php = Math.min(maxHp, php + f.power);
      events.push({ text: `${f.emoji} ${f.name} te ${f.kind === 'guard' ? 'protège' : 'soigne'} (+${f.power} PV) !`, side: 'info' });
    }
  }

  // ── Altérations de fin de tour (brûlure / poison sur le monstre) ──
  if (mhp > 0) {
    if (state.burn > 0 && state.burnPow > 0) {
      mhp = Math.max(0, mhp - state.burnPow);
      events.push({ text: `🔥 Brûlure : ${monster.name} perd ${state.burnPow} PV.`, side: 'you' });
    }
    if (state.poison > 0 && state.poisonPow > 0) {
      mhp = Math.max(0, mhp - state.poisonPow);
      events.push({ text: `🧪 Poison : ${monster.name} perd ${state.poisonPow} PV.`, side: 'you' });
    }
  }
  // Décrémente la durée des altérations.
  if (state.burn > 0) state.burn -= 1;
  if (state.poison > 0) state.poison -= 1;
  if (state.chill > 0) state.chill -= 1;

  // Ressource d'archétype passive : rage se charge en encaissant, combo en touchant.
  let resourceGained = 0;
  // Gain normalisé en % des PV max encaissés (pas en dégâts bruts, qui explosent
  // avec le niveau) ET plafonné par tour : en contenu difficile un seul coup
  // peut représenter 40-60% des PV max (constaté : ~690 dégâts pour un DK dont
  // les soins tournent à 1200), donc même en % ça remplissait la jauge (100 max,
  // coût 50) en un seul coup. Le plafond par tour force plusieurs tours pour
  // reconstituer la Rage après avoir dépensé l'ultime, quelle que soit la
  // brutalité du combat.
  if (opts.resourceType === 'rage') resourceGained = Math.min(25, Math.round((dmgTakenThisTurn / maxHp) * 100 * 0.4));
  else if (opts.resourceType === 'combo' && hitsDealt > 0) resourceGained = 1;
  else if (opts.resourceType === 'grace') resourceGained = Math.round(healDone * 0.15);
  // Mana : régen passive fixe à chaque tour, quelle que soit l'action (gestion
  // par patience plutôt que réactive comme la rage/le combo).
  else if (opts.resourceType === 'mana') resourceGained = 15;
  // Sève (Druide) : se charge quand les Épines renvoient des dégâts au monstre
  // — récompense d'encaisser des coups en ayant investi dans les Épines.
  else if (opts.resourceType === 'sap' && thornsProced) resourceGained = 20;
  // Ferveur (Paladin) : se charge quand SON PROPRE bouclier (Rempart) absorbe
  // un coup — récompense la protection active, pas l'encaissement brut.
  else if (opts.resourceType === 'zeal' && shieldAbsorbed) resourceGained = 20;
  // Instinct (Chasseur) : se charge quand un coup CRIT — récompense
  // l'investissement dans le critique plutôt que le simple fait de taper.
  else if (opts.resourceType === 'instinct' && critLanded) resourceGained = 30;
  // Corruption (Chevalier Noir) : se charge en infligeant des dégâts UNIQUEMENT
  // sous 30% PV (même seuil que Douleur) — frapper au bord de la mort, pas
  // juste encaisser passivement comme la Rage.
  else if (opts.resourceType === 'corruption' && hitsDealt > 0 && php < maxHp * 0.3) resourceGained = 35;
  // Tempo (Barde) et Surcharge (Arcaniste) : calculés par l'appelant (HuntCard),
  // pas ici — l'un dépend de l'action du tour précédent (variété), l'autre du
  // nombre de compétences lancées, deux signaux hors du périmètre de ce combat.

  return { events, php: Math.max(0, php), mhp: Math.max(0, mhp), fled, abilityUsed, hitsDealt, hitsTaken, state, goldStolen, resourceGained, resourceSpent };
}

/** Récompenses de victoire (mute le joueur). */
export function grantMonsterRewards(p: PlayerState, monster: MonsterDef): HuntRewards {
  const phase = currentPhase();
  const mod = PHASE_MODIFIERS[phase];
  
  const biome = BIOMES[p.biome];
  const biomeXpMult = biome?.xpMult ?? 1.0;
  const base = {
    xp: Math.round(monster.xp * mod.xp * biomeXpMult),
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
  const lootMult = (phase === 'night' ? 2 : 1) * luckyDropMult(p);
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
