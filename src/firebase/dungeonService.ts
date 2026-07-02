import { ref, onValue, runTransaction, remove } from 'firebase/database';
import { rtdb } from './config';
import type { ClassId } from '../game/types';
import type { CombatMods } from '../game/talents';
import { getAllActiveSkills } from '../game/talents';
import { DUNGEONS, type DungeonDef } from '../game/dungeons';
import { getElementMult, getDmgTypeMult } from '../game/combat';

export interface DungeonPlayer {
  uid: string;
  name: string;
  classId: ClassId;
  level: number;
  ready: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  isDead: boolean;
  mods: CombatMods;
  abilityCd: number;
  weaponElement?: string;
  weaponDmgType?: string;
  armorElement?: string;
}

export type DungeonAffix = 'vampiric' | 'armored' | 'agile' | 'none';

export interface DungeonMonster {
  idx: number; // Index in stages
  hp: number;
  maxHp: number;
  def: number;
  atk: number;
  name: string;
  emoji: string;
  provokedBy: string | null;
  provokeTurns: number;
  element?: string;
  weaknesses?: string[];
  resistances?: string[];
  staggerHits: number;
  staggered: boolean;
  affix: DungeonAffix;
}

export interface TurnEvent {
  text: string;
  side: 'info' | 'enemy' | 'you';
}

export interface DungeonSession {
  id: string;
  host: string;
  dungeonId: string;
  state: 'lobby' | 'combat' | 'victory' | 'defeat';
  players: Record<string, DungeonPlayer>;
  monster?: DungeonMonster;
  turnOrder: string[]; // uids and 'monster'
  turnIdx: number;
  turnStartAt: number;
  roundCount: number;
  log: TurnEvent[];
  startedAt: number;
}

const ABILITY_CD = 4;

export function listenDungeon(id: string, cb: (ds: DungeonSession | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, `dungeons/${id}`), (snap) => cb(snap.val() as DungeonSession | null));
}

export async function createDungeonLobby(hostUid: string, hostName: string, hostClass: ClassId, dungeonId: string, pStats: any, pMods: any, pLevel: number): Promise<string> {
  if (!rtdb) throw new Error('Firebase offline');
  const id = 'dgn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await runTransaction(ref(rtdb, `dungeons/${id}`), () => {
    const def = DUNGEONS.find(d => d.id === dungeonId);
    const ratio = def ? Math.pow(def.minLevel / Math.max(1, pLevel), 0.85) : 1;
    const ds: DungeonSession = {
      id, host: hostUid, dungeonId, state: 'lobby',
      players: {
        [hostUid]: {
          uid: hostUid, name: hostName, classId: hostClass, ready: true, level: pLevel,
          hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio), 
          atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
          isDead: false, mods: pMods, abilityCd: 0,
          weaponElement: pStats.weaponElement,
          weaponDmgType: pStats.weaponDmgType,
          armorElement: pStats.armorElement
        }
      },
      turnOrder: [], turnIdx: 0, turnStartAt: 0, roundCount: 1, log: [], startedAt: 0
    };
    return ds;
  });
  return id;
}

export async function joinDungeon(id: string, uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (!cur.players[uid]) {
      const def = DUNGEONS.find(d => d.id === cur.dungeonId);
      const ratio = def ? Math.pow(def.minLevel / Math.max(1, pLevel), 0.85) : 1;
      cur.players[uid] = {
        uid, name, classId, ready: false, level: pLevel,
        hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio), 
        atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
        isDead: false, mods: pMods, abilityCd: 0,
        weaponElement: pStats.weaponElement,
        weaponDmgType: pStats.weaponDmgType,
        armorElement: pStats.armorElement
      };
    }
    return cur;
  });
}

export async function toggleReady(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (cur.players[uid]) cur.players[uid].ready = !cur.players[uid].ready;
    return cur;
  });
}

export async function leaveDungeon(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur) return cur;
    delete cur.players[uid];
    if (Object.keys(cur.players).length === 0) return null; // delete dungeon if empty
    if (cur.host === uid) cur.host = Object.keys(cur.players)[0]; // reassign host
    return cur;
  });
}

function initMonster(def: DungeonDef, idx: number, numPlayers: number = 1, avgLevel: number = 1): DungeonMonster {
  const m = def.stages[idx];
  
  // NOUVEAU SCALING : PV montent vite, ATK modéré, DEF léger
  // Ajustement pour les joueurs haut niveau
  const lvlMult = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.8 : 1.4);
  const hpMult = Math.pow(numPlayers, 1.2) * (1 + (numPlayers - 1) * 0.1) * lvlMult; 
  const atkMult = (1 + (numPlayers - 1) * 0.3) * lvlMult; 
  const defMult = (1 + (numPlayers - 1) * 0.15) * lvlMult; 

  const hp = Math.floor(m.hp * hpMult);
  const atk = Math.floor(m.atk * atkMult);
  const defense = Math.floor(m.def * defMult);

  const affixes: DungeonAffix[] = ['vampiric', 'armored', 'agile', 'none', 'none'];
  let affix = affixes[Math.floor(Math.random() * affixes.length)];
  if (idx < def.stages.length - 1 && Math.random() < 0.5) affix = 'none'; // Bosses have higher chance

  return {
    idx, hp, maxHp: hp, def: defense, atk,
    name: m.name, emoji: m.emoji, provokedBy: null, provokeTurns: 0,
    element: m.element ?? 'neutral', weaknesses: m.weaknesses ?? [], resistances: m.resistances ?? [],
    staggerHits: 0, staggered: false, affix
  };
}

export async function startDungeon(id: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    const allReady = Object.values(cur.players).every(p => p.ready);
    if (!allReady) return cur; // Can't start
    
    const def = DUNGEONS.find(d => d.id === cur.dungeonId);
    if (!def) return cur;

    cur.state = 'combat';
    cur.startedAt = Date.now();
    const playersArr = Object.values(cur.players);
    const avgLevel = playersArr.reduce((sum, p) => sum + p.level, 0) / Math.max(1, playersArr.length);
    cur.monster = initMonster(def, 0, playersArr.length, avgLevel);
    
    // Create turn order: randomly shuffle players, then add monster
    const uids = Object.keys(cur.players).sort(() => Math.random() - 0.5);
    cur.turnOrder = [...uids, 'monster'];
    cur.turnIdx = 0;
    cur.turnStartAt = Date.now();
    cur.log = [{ text: `Le donjon commence ! ${cur.monster.name} (x${playersArr.length} joueurs) apparaît.`, side: 'info' }];

    return cur;
  });
}

function advanceTurn(cur: DungeonSession) {
  cur.turnStartAt = Date.now();
  cur.roundCount = cur.roundCount || 1;
  let nextIdx = (cur.turnIdx + 1) % cur.turnOrder.length;
  if (nextIdx === 0) cur.roundCount++;

  let loops = 0;
  // Skip dead players
  while (cur.turnOrder[nextIdx] !== 'monster' && cur.players[cur.turnOrder[nextIdx]].isDead && loops < 10) {
    nextIdx = (nextIdx + 1) % cur.turnOrder.length;
    if (nextIdx === 0) cur.roundCount++;
    loops++;
  }
  cur.turnIdx = nextIdx;

  if (cur.turnOrder[cur.turnIdx] === 'monster') {
    executeMonsterTurn(cur);
  }
}

function executeMonsterTurn(cur: DungeonSession) {
  const m = cur.monster!;

  if (m.staggered) {
    m.staggered = false;
    cur.log.push({ text: `🌀 ${m.name} est étourdi et passe son tour !`, side: 'info' });
    advanceTurn(cur);
    return;
  }

  const isEnraged = cur.roundCount > 15;
  const enrageMult = isEnraged ? 1.5 : 1;
  const isAoE = cur.roundCount > 0 && cur.roundCount % 4 === 0;

  // Decrease provoke
  if (m.provokeTurns > 0) m.provokeTurns--;

  let targetUid = m.provokeTurns > 0 ? m.provokedBy : null;
  const alive = Object.values(cur.players).filter(p => !p.isDead);
  
  if (targetUid && (!cur.players[targetUid] || cur.players[targetUid].isDead)) {
    targetUid = null;
    m.provokedBy = null;
    m.provokeTurns = 0;
  }

  if (alive.length === 0) {
    cur.state = 'defeat';
    cur.log.push({ text: `Toute l'équipe a été vaincue... Échec du donjon.`, side: 'enemy' });
    return;
  }

  // Si on AoE et qu'il n'y a PAS de provocation, on cible tout le monde
  const targets = (isAoE && !targetUid) ? alive : [targetUid ? cur.players[targetUid] : alive[Math.floor(Math.random() * alive.length)]];

  if (isEnraged && !m.staggered && targets.length > 0) {
    cur.log.push({ text: `😡 ${m.name} est ENRAGÉ ! (+50% Dégâts)`, side: 'enemy' });
  }

  if (isAoE && !targetUid) {
    cur.log.push({ text: `⚠️ ${m.name} prépare une ATTAQUE DE ZONE !`, side: 'enemy' });
  }

  let totalHeal = 0;

  for (const target of targets) {
    const roll = m.atk - 2 + Math.random() * 4;
    let dmg = Math.max(1, Math.round(roll - target.def * 0.6));
    dmg = Math.max(1, Math.round(dmg * enrageMult * (1 - target.mods.dmgReduction)));
    if (m.affix === 'agile' && Math.random() < 0.2) dmg = Math.round(dmg * 1.2);

    if (Math.random() < target.mods.dodge) {
      cur.log.push({ text: `L'attaque de ${m.name} sur ${target.name} échoue (Esquive) !`, side: 'info' });
    } else {
      target.hp -= dmg;
      if (m.affix === 'vampiric') totalHeal += Math.round(dmg * 0.2);
      cur.log.push({ text: `${m.name} attaque ${target.name} et inflige ${dmg} dégâts !`, side: 'enemy' });
      
      if (target.hp <= 0) {
        target.hp = 0;
        target.isDead = true;
        cur.log.push({ text: `💀 ${target.name} est K.O. !`, side: 'enemy' });
      }
    }
  }

  if (totalHeal > 0) {
    m.hp = Math.min(m.maxHp, m.hp + totalHeal);
    cur.log.push({ text: `🩸 ${m.name} draine ${totalHeal} PV (Vampirique) !`, side: 'enemy' });
  }

  if (m.provokeTurns <= 0) m.provokedBy = null;

  const allDead = Object.values(cur.players).every(p => p.isDead);
  if (allDead) {
    cur.state = 'defeat';
    cur.log.push({ text: `Toute l'équipe a été vaincue... Échec du donjon.`, side: 'enemy' });
  } else {
    advanceTurn(cur);
  }
}

export async function submitDungeonAction(id: string, uid: string, action: string, potionHeal?: number, targetUid?: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'combat') return cur;

    if (action === 'dungeon_timeout') {
      cur.state = 'defeat';
      cur.log.push({ text: `⌛ Temps écoulé (20 minutes). Le donjon s'effondre !`, side: 'info' });
      return cur;
    }
    
    if (action === 'flee') {
      cur.state = 'defeat';
      cur.log.push({ text: `🏃 ${cur.players[uid].name} a pris la fuite. Le groupe s'éparpille !`, side: 'info' });
      return cur;
    }

    if (cur.turnOrder[cur.turnIdx] !== uid && action !== 'timeout') return cur;
    if (action === 'timeout' && cur.turnOrder[cur.turnIdx] !== uid) {
      if (Date.now() - cur.turnStartAt < 32000) return cur;
    }

    const pUid = cur.turnOrder[cur.turnIdx];
    const p = cur.players[pUid];
    const m = cur.monster!;

    if (p.isDead) {
      advanceTurn(cur);
      return cur;
    }

    const isLastHope = Date.now() - cur.startedAt > 18 * 60 * 1000;
    const hopeMult = isLastHope ? 1.5 : 1.0;
    
    const elemMult = getElementMult(p.weaponElement, m.element) * getDmgTypeMult(p.weaponDmgType, m as any);
    const finalAtk = p.atk * hopeMult * elemMult;

    if (action === 'timeout') {
      cur.log.push({ text: `⌛ Le tour de ${p.name} est passé (inactif).`, side: 'info' });
    } else if (action === 'revive' && targetUid && cur.players[targetUid]?.isDead) {
      const t = cur.players[targetUid];
      t.isDead = false;
      t.hp = Math.floor(t.maxHp * 0.5);
      cur.log.push({ text: `🪶 ${p.name} ressuscite ${t.name} !`, side: 'info' });
    } else if (action === 'potion') {
      const heal = potionHeal ?? 180;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      cur.log.push({ text: `${p.name} boit une potion (+${heal} PV).`, side: 'you' });
    } else if (action !== 'attack' && action !== 'timeout' && action !== 'flee' && action !== 'potion' && action !== 'revive' && p.abilityCd <= 0) {
      // Action is a skill ID
      p.abilityCd = ABILITY_CD;
      const skill = getAllActiveSkills().find(s => s.id === action);
      if (skill) {
        if (skill.type === 'attack' || skill.type === 'shield' || skill.type === 'heal' || skill.type === 'buff') {
          if (skill.mult) {
            const dmg = Math.max(1, Math.round(finalAtk * skill.mult - m.def));
            m.hp -= dmg;
            if (p.classId === 'warrior' || p.classId === 'paladin') {
              m.provokedBy = p.uid;
              m.provokeTurns = 2;
            }
            cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} : ${dmg} dégâts !`, side: 'you' });
          }
          if (skill.healFrac) {
            const heal = Math.round(p.atk * 2.0 + p.maxHp * skill.healFrac);
            // AoE Heal for Healer/Dawn Priest/Druid
            if (p.classId === 'healer' || p.classId === 'dawn_priest' || p.classId === 'druid') {
              Object.values(cur.players).forEach(ally => {
                if (!ally.isDead) ally.hp = Math.min(ally.maxHp, ally.hp + heal);
              });
              cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} et soigne tout le groupe (+${heal} PV) !`, side: 'info' });
            } else {
              p.hp = Math.min(p.maxHp, p.hp + heal);
              cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} et se soigne (+${heal} PV).`, side: 'info' });
            }
          }
          if (skill.shield) {
            const heal = Math.round(p.maxHp * skill.shield);
            p.hp = p.hp + heal; // Temp overheal for dungeon
            cur.log.push({ text: `✨ ${p.name} gagne un bouclier via ${skill.name} (+${heal} PV).`, side: 'info' });
          }
        }
      } else {
        cur.log.push({ text: `Compétence inconnue utilisée par ${p.name}.`, side: 'info' });
      }
    } else {
      // Basic Attack
      const hits = 1 + (Math.random() < p.mods.doubleHit ? 1 : 0);
      let totalDmg = 0;
      for (let h = 0; h < hits; h++) {
        let dmg = Math.max(1, (finalAtk - 2 + Math.random() * 4) - m.def) + p.mods.flatDmg;
        if (p.hp < p.maxHp * 0.3 && p.mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + p.mods.berserkBonus));
        if (Math.random() < p.mods.crit) dmg *= 2;
        dmg = Math.round(dmg);
        totalDmg += dmg;
        m.hp -= dmg;
      }
      cur.log.push({ text: `⚔️ ${p.name} attaque ${m.name} pour ${totalDmg} dégâts${hits > 1 ? ' (Tir double!)' : ''}.`, side: 'you' });
      
      // Stagger logic on weakness
      if (elemMult > 1) {
        m.staggerHits++;
        if (m.staggerHits >= 3) {
          m.staggered = true;
          m.staggerHits = 0;
          cur.log.push({ text: `⚡ FAIBLESSE EXPLOITÉE ! ${m.name} est BRISÉ (Stagger) !`, side: 'info' });
        }
      }
    }

    if (action !== 'timeout' && p.abilityCd > 0 && action !== 'ability') {
      p.abilityCd -= 1;
    }

    if (p.mods.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.mods.regen);
    }

    if (cur.log.length > 40) cur.log = cur.log.slice(cur.log.length - 40);

    if (m.hp <= 0) {
      cur.log.push({ text: `🎉 ${m.name} est vaincu !`, side: 'info' });
      const def = DUNGEONS.find(d => d.id === cur.dungeonId);
      if (def && m.idx + 1 < def.stages.length) {
        const playersArr = Object.values(cur.players);
        const avgLevel = playersArr.reduce((sum, p) => sum + p.level, 0) / Math.max(1, playersArr.length);
        cur.monster = initMonster(def, m.idx + 1, playersArr.length, avgLevel);
        cur.log.push({ text: `Un nouvel ennemi approche : ${cur.monster.name} !`, side: 'info' });
        cur.turnIdx = 0; 
        cur.turnStartAt = Date.now();
      } else {
        cur.state = 'victory';
        cur.log.push({ text: `🏆 Donjon terminé avec succès !`, side: 'info' });
      }
    } else {
      advanceTurn(cur);
    }

    return cur;
  });
}

export async function cleanupDungeon(id: string) {
  if (!rtdb) return;
  await remove(ref(rtdb, `dungeons/${id}`));
}

export function listenAllDungeons(cb: (sessions: DungeonSession[]) => void): () => void {
  if (!rtdb) { cb([]); return () => {}; }
  return onValue(ref(rtdb, 'dungeons'), (snap) => {
    const val = snap.val();
    if (!val) { cb([]); return; }
    cb(Object.values(val));
  });
}
