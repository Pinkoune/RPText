import { ref, onValue, runTransaction, remove } from 'firebase/database';
import { rtdb } from './config';
import type { ClassId } from '../game/types';
import type { CombatMods } from '../game/talents';
import { DUNGEONS, type DungeonDef } from '../game/dungeons';

export interface DungeonPlayer {
  uid: string;
  name: string;
  classId: ClassId;
  ready: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  isDead: boolean;
  mods: CombatMods;
  abilityCd: number;
}

export interface DungeonMonster {
  idx: number; // Index in stages
  hp: number;
  maxHp: number;
  def: number;
  atk: number;
  name: string;
  emoji: string;
  provokedBy: string | null;
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
          uid: hostUid, name: hostName, classId: hostClass, ready: true,
          hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio), 
          atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
          isDead: false, mods: pMods, abilityCd: 0
        }
      },
      turnOrder: [], turnIdx: 0, turnStartAt: 0, log: [], startedAt: 0
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
        uid, name, classId, ready: false,
        hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio), 
        atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
        isDead: false, mods: pMods, abilityCd: 0
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

function initMonster(def: DungeonDef, idx: number, numPlayers: number = 1): DungeonMonster {
  const m = def.stages[idx];
  
  // Scaling exponentiel de la difficulté en fonction du nombre de joueurs
  const hpMult = Math.pow(numPlayers, 1.4); // 1->1, 2->2.6, 3->4.6, 4->6.9
  const atkMult = Math.pow(numPlayers, 1.25); // 1->1, 2->2.3, 3->3.9, 4->5.6
  const defMult = Math.pow(numPlayers, 1.15); // 1->1, 2->2.2, 3->3.5, 4->4.9

  const hp = Math.floor(m.hp * hpMult);
  const atk = Math.floor(m.atk * atkMult);
  const defense = Math.floor(m.def * defMult);

  return {
    idx, hp, maxHp: hp, def: defense, atk,
    name: m.name, emoji: m.emoji, provokedBy: null
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
    const numPlayers = Object.keys(cur.players).length;
    cur.monster = initMonster(def, 0, numPlayers);
    
    // Create turn order: randomly shuffle players, then add monster
    const uids = Object.keys(cur.players).sort(() => Math.random() - 0.5);
    cur.turnOrder = [...uids, 'monster'];
    cur.turnIdx = 0;
    cur.turnStartAt = Date.now();
    cur.log = [{ text: `Le donjon commence ! ${cur.monster.name} (x${numPlayers} joueurs) apparaît.`, side: 'info' }];

    return cur;
  });
}

function advanceTurn(cur: DungeonSession) {
  cur.turnStartAt = Date.now();
  let nextIdx = (cur.turnIdx + 1) % cur.turnOrder.length;
  let loops = 0;
  
  // Skip dead players
  while (cur.turnOrder[nextIdx] !== 'monster' && cur.players[cur.turnOrder[nextIdx]].isDead && loops < 10) {
    nextIdx = (nextIdx + 1) % cur.turnOrder.length;
    loops++;
  }
  cur.turnIdx = nextIdx;

  if (cur.turnOrder[cur.turnIdx] === 'monster') {
    executeMonsterTurn(cur);
  }
}

function executeMonsterTurn(cur: DungeonSession) {
  const m = cur.monster!;
  let targetUid = m.provokedBy;
  if (!targetUid || !cur.players[targetUid] || cur.players[targetUid].isDead) {
    const alive = Object.values(cur.players).filter(p => !p.isDead);
    if (alive.length > 0) {
      targetUid = alive[Math.floor(Math.random() * alive.length)].uid;
    } else {
      targetUid = null;
    }
  }

  if (targetUid) {
    const target = cur.players[targetUid];
    // Monster attacks!
    const roll = m.atk - 2 + Math.random() * 4;
    let dmg = Math.max(1, Math.round(roll - target.def * 0.6));
    dmg = Math.max(1, Math.round(dmg * (1 - target.mods.dmgReduction)));
    
    if (Math.random() < target.mods.dodge) {
      cur.log.push({ text: `L'attaque de ${m.name} sur ${target.name} échoue (Esquive) !`, side: 'info' });
    } else {
      target.hp -= dmg;
      cur.log.push({ text: `${m.name} attaque ${target.name} et inflige ${dmg} dégâts !`, side: 'enemy' });
      if (target.hp <= 0) {
        target.hp = 0;
        target.isDead = true;
        cur.log.push({ text: `💀 ${target.name} est K.O. !`, side: 'enemy' });
      }
    }
  }

  m.provokedBy = null; // Provoke wears off after attack

  const allDead = Object.values(cur.players).every(p => p.isDead);
  if (allDead) {
    cur.state = 'defeat';
    cur.log.push({ text: `Toute l'équipe a été vaincue... Échec du donjon.`, side: 'enemy' });
  } else {
    advanceTurn(cur); // Move back to player turn
  }
}

export async function submitDungeonAction(id: string, uid: string, action: 'attack' | 'ability' | 'potion' | 'timeout', potionHeal?: number): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'combat') return cur;
    if (cur.turnOrder[cur.turnIdx] !== uid && action !== 'timeout') return cur; // Not their turn
    if (action === 'timeout' && cur.turnOrder[cur.turnIdx] !== uid) {
      // Allow host or others to trigger timeout if the actual turn player took too long (>32s)
      if (Date.now() - cur.turnStartAt < 32000) return cur;
    }

    const pUid = cur.turnOrder[cur.turnIdx];
    const p = cur.players[pUid]; // Current player whose turn it is
    const m = cur.monster!;

    if (p.isDead) {
      advanceTurn(cur);
      return cur;
    }

    if (action === 'timeout') {
      cur.log.push({ text: `⌛ Le tour de ${p.name} est passé (inactif).`, side: 'info' });
    } else if (action === 'potion') {
      const heal = potionHeal ?? 180;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      cur.log.push({ text: `${p.name} boit une potion (+${heal} PV).`, side: 'you' });
    } else if (action === 'ability' && p.abilityCd <= 0) {
      p.abilityCd = ABILITY_CD;
      if (p.classId === 'warrior') {
        const dmg = Math.max(1, Math.round(p.atk * 1.5 - m.def));
        m.hp -= dmg;
        m.provokedBy = p.uid;
        cur.log.push({ text: `🛡️ ${p.name} provoque ${m.name} et lui inflige ${dmg} dégâts !`, side: 'you' });
      } else if (p.classId === 'healer') {
        const heal = Math.round(p.maxHp * 0.4);
        Object.values(cur.players).forEach(ally => {
          if (!ally.isDead) ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        });
        cur.log.push({ text: `✨ ${p.name} lance une vague de soin ! Toute l'équipe récupère des PV.`, side: 'info' });
      } else {
        const dmg = Math.max(1, Math.round(p.atk * 2.5 - m.def));
        m.hp -= dmg;
        cur.log.push({ text: `🔥 ${p.name} déclenche une attaque surpuissante : ${dmg} dégâts !`, side: 'you' });
      }
    } else {
      // Basic Attack
      const hits = 1 + (Math.random() < p.mods.doubleHit ? 1 : 0);
      let totalDmg = 0;
      for (let h = 0; h < hits; h++) {
        let dmg = Math.max(1, (p.atk - 2 + Math.random() * 4) - m.def) + p.mods.flatDmg;
        if (p.hp < p.maxHp * 0.3 && p.mods.berserkBonus > 0) dmg = Math.round(dmg * (1 + p.mods.berserkBonus));
        if (Math.random() < p.mods.crit) dmg *= 2;
        dmg = Math.round(dmg);
        totalDmg += dmg;
        m.hp -= dmg;
      }
      cur.log.push({ text: `⚔️ ${p.name} attaque ${m.name} pour ${totalDmg} dégâts${hits > 1 ? ' (Tir double!)' : ''}.`, side: 'you' });
    }

    if (action !== 'timeout' && p.abilityCd > 0 && action !== 'ability') {
      p.abilityCd -= 1;
    }

    // Regen
    if (p.mods.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.mods.regen);
    }

    // Keep only last 40 logs
    if (cur.log.length > 40) cur.log = cur.log.slice(cur.log.length - 40);

    if (m.hp <= 0) {
      cur.log.push({ text: `🎉 ${m.name} est vaincu !`, side: 'info' });
      const def = DUNGEONS.find(d => d.id === cur.dungeonId);
      if (def && m.idx + 1 < def.stages.length) {
        // Next stage
        const numPlayers = Object.keys(cur.players).length;
        cur.monster = initMonster(def, m.idx + 1, numPlayers);
        cur.log.push({ text: `Un nouvel ennemi approche : ${cur.monster.name} !`, side: 'info' });
        // Reset turn index to player 1
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
