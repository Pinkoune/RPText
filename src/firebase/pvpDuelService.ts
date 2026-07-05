import { ref, onValue, runTransaction, remove } from 'firebase/database';
import { rtdb } from './config';
import type { ClassId } from '../game/types';
import type { CombatMods } from '../game/talents';
import { getAllActiveSkills } from '../game/talents';
import { getElementMult, getDmgTypeMult } from '../game/combat';

// ─── Duels PvP temps réel (1v1 / 2v2, avec compétences) ─────────────────────
// Calqué sur dungeonService/endlessService : session RTDB, lobby/prêt/tour par
// tour. Symétrique : deux "camps" (A/B) au lieu d'un groupe vs monstre. Le
// camp entièrement K.O. perd ; le vainqueur rafle la mise (bet × nb combattants).

export type DuelMode = '1v1' | '2v2';
export type DuelSide = 'A' | 'B';

const ABILITY_CD_TURNS = 4;
const TURN_TIMEOUT_MS = 30_000;

export interface PvpFighter {
  uid: string;
  name: string;
  classId: ClassId;
  side: DuelSide;
  ready: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  isDead: boolean;
  mods: CombatMods;
  skillCds: Record<string, number>;
  equippedSkills: string[];
  weaponElement?: string | null;
  weaponDmgType?: string | null;
  armorElement?: string | null;
  aura?: string | null;
  auraColorOn?: boolean;
}

export interface PvpTurnEvent {
  text: string;
  side: 'info' | 'you' | 'enemy';
}

export interface PvpDuelSession {
  id: string;
  hostUid: string;
  mode: DuelMode;
  bet: number; // mise par combattant
  state: 'lobby' | 'combat' | 'over';
  fighters: Record<string, PvpFighter>;
  turnOrder: string[];
  turnIdx: number;
  turnStartAt: number;
  roundCount: number;
  log: PvpTurnEvent[];
  startedAt: number;
  winnerSide?: DuelSide;
}

export const pvpDuelsEnabled = !!rtdb;

function sideCapacity(mode: DuelMode): number {
  return mode === '2v2' ? 2 : 1;
}

function mkFighter(input: {
  uid: string; name: string; classId: ClassId; side: DuelSide;
  stats: any; mods: CombatMods; equippedSkills: string[];
  aura?: string | null; auraColorOn?: boolean;
}, ready: boolean): PvpFighter {
  return {
    uid: input.uid, name: input.name, classId: input.classId, side: input.side, ready,
    hp: Math.floor(input.stats.maxHp), maxHp: Math.floor(input.stats.maxHp),
    atk: Math.floor(input.stats.atk), def: Math.floor(input.stats.def),
    isDead: false, mods: input.mods, skillCds: {}, equippedSkills: input.equippedSkills,
    weaponElement: input.stats.weaponElement || null,
    weaponDmgType: input.stats.weaponDmgType || null,
    armorElement: input.stats.armorElement || null,
    aura: input.aura || null, auraColorOn: input.auraColorOn ?? true,
  };
}

export function listenPvpDuel(id: string, cb: (s: PvpDuelSession | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, `pvpDuels/${id}`), (snap) => cb(snap.val() as PvpDuelSession | null));
}

export function listenAllPvpDuels(cb: (sessions: PvpDuelSession[]) => void): () => void {
  if (!rtdb) { cb([]); return () => {}; }
  return onValue(ref(rtdb, 'pvpDuels'), (snap) => {
    const val = snap.val();
    cb(val ? Object.values(val) : []);
  });
}

export async function createPvpDuel(
  mode: DuelMode, bet: number,
  host: { uid: string; name: string; classId: ClassId; stats: any; mods: CombatMods; equippedSkills: string[]; aura?: string | null; auraColorOn?: boolean },
): Promise<string> {
  if (!rtdb) throw new Error('Firebase offline');
  const id = 'pvp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), () => {
    const s: PvpDuelSession = {
      id, hostUid: host.uid, mode, bet, state: 'lobby',
      fighters: { [host.uid]: mkFighter({ ...host, side: 'A' }, true) },
      turnOrder: [], turnIdx: 0, turnStartAt: 0, roundCount: 1, log: [], startedAt: 0,
    };
    return s;
  });
  return id;
}

export async function joinPvpDuel(
  id: string, side: DuelSide,
  guest: { uid: string; name: string; classId: ClassId; stats: any; mods: CombatMods; equippedSkills: string[]; aura?: string | null; auraColorOn?: boolean },
): Promise<void> {
  if (!rtdb) throw new Error('Firebase offline');
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), (cur: PvpDuelSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (cur.fighters[guest.uid]) return cur;
    const onSide = Object.values(cur.fighters).filter((f) => f.side === side).length;
    if (onSide >= sideCapacity(cur.mode)) return cur;
    cur.fighters[guest.uid] = mkFighter({ ...guest, side }, false);
    return cur;
  });
}

export async function togglePvpReady(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), (cur: PvpDuelSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (cur.fighters[uid]) cur.fighters[uid].ready = !cur.fighters[uid].ready;
    return cur;
  });
}

export async function leavePvpDuel(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), (cur: PvpDuelSession | null) => {
    if (!cur) return cur;
    if (cur.state !== 'lobby') return cur; // on ne quitte pas un combat engagé (mise en jeu)
    delete cur.fighters[uid];
    if (Object.keys(cur.fighters).length === 0) return null;
    if (cur.hostUid === uid) cur.hostUid = Object.keys(cur.fighters)[0];
    return cur;
  });
}

export async function startPvpDuel(id: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), (cur: PvpDuelSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    const cap = sideCapacity(cur.mode);
    const a = Object.values(cur.fighters).filter((f) => f.side === 'A');
    const b = Object.values(cur.fighters).filter((f) => f.side === 'B');
    if (a.length !== cap || b.length !== cap) return cur; // camps incomplets
    if (!Object.values(cur.fighters).every((f) => f.ready)) return cur;

    cur.state = 'combat';
    cur.startedAt = Date.now();
    cur.turnOrder = Object.keys(cur.fighters).sort(() => Math.random() - 0.5);
    cur.turnIdx = 0;
    cur.turnStartAt = Date.now();
    cur.roundCount = 1;
    cur.log = [{ text: cur.mode === '2v2' ? 'Le duel 2v2 commence !' : 'Le duel commence !', side: 'info' }];
    return cur;
  });
}

function advanceTurn(cur: PvpDuelSession) {
  cur.turnStartAt = Date.now();
  let nextIdx = (cur.turnIdx + 1) % cur.turnOrder.length;
  if (nextIdx === 0) cur.roundCount++;
  let loops = 0;
  while (cur.fighters[cur.turnOrder[nextIdx]]?.isDead && loops < 10) {
    nextIdx = (nextIdx + 1) % cur.turnOrder.length;
    if (nextIdx === 0) cur.roundCount++;
    loops++;
  }
  cur.turnIdx = nextIdx;
}

function livingOpponents(cur: PvpDuelSession, actor: PvpFighter): PvpFighter[] {
  return Object.values(cur.fighters).filter((f) => f.side !== actor.side && !f.isDead);
}

function checkVictory(cur: PvpDuelSession): boolean {
  const aAlive = Object.values(cur.fighters).some((f) => f.side === 'A' && !f.isDead);
  const bAlive = Object.values(cur.fighters).some((f) => f.side === 'B' && !f.isDead);
  if (aAlive && bAlive) return false;
  cur.state = 'over';
  cur.winnerSide = aAlive ? 'A' : 'B';
  cur.log.push({ text: aAlive ? '🏆 Le camp A remporte le duel !' : '🏆 Le camp B remporte le duel !', side: 'info' });
  return true;
}

export async function submitPvpAction(
  id: string, uid: string, action: string, opts: { targetUid?: string; potionHeal?: number } = {},
): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `pvpDuels/${id}`), (cur: PvpDuelSession | null) => {
    if (!cur || cur.state !== 'combat') return cur;

    const actingUid = cur.turnOrder[cur.turnIdx];
    if (actingUid !== uid && action !== 'timeout') return cur;
    if (action === 'timeout') {
      if (actingUid !== uid && Date.now() - cur.turnStartAt < TURN_TIMEOUT_MS + 2000) return cur;
    }

    const actor = cur.fighters[actingUid];
    if (!actor) return cur;
    actor.skillCds = actor.skillCds || {};
    if (actor.isDead) { advanceTurn(cur); return cur; }

    const opponents = livingOpponents(cur, actor);
    let target = opts.targetUid ? cur.fighters[opts.targetUid] : undefined;
    if (!target || target.side === actor.side || target.isDead) {
      target = opponents[Math.floor(Math.random() * opponents.length)];
    }

    const elemMult = target
      ? getElementMult(actor.weaponElement || undefined, target.armorElement || undefined) * getDmgTypeMult(actor.weaponDmgType || undefined, target as any)
      : 1;
    const finalAtk = (actor.atk || 10) * elemMult;

    if (action === 'timeout') {
      cur.log.push({ text: `⌛ Tour de ${actor.name} passé (inactif).`, side: 'info' });
    } else if (action === 'potion') {
      const heal = opts.potionHeal ?? 100;
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
      cur.log.push({ text: `${actor.name} boit une potion (+${heal} PV).`, side: 'you' });
    } else if (action !== 'attack' && target) {
      const skillId = action;
      if ((actor.skillCds[skillId] || 0) > 0) return cur;
      const skill = getAllActiveSkills().find((s) => s.id === skillId);
      if (skill) {
        actor.skillCds[skillId] = ABILITY_CD_TURNS;
        if (skill.mult) {
          const dmg = Math.max(1, Math.round(finalAtk * skill.mult - (target.def || 0)));
          target.hp = Math.max(0, target.hp - dmg);
          if (target.hp <= 0) target.isDead = true;
          cur.log.push({ text: `✨ ${actor.name} utilise ${skill.name} sur ${target.name} : ${dmg} dégâts !`, side: 'you' });
        }
        if (skill.healFrac) {
          const heal = Math.round((actor.atk || 10) * 1.0 + actor.maxHp * skill.healFrac);
          if (actor.classId === 'healer' || actor.classId === 'dawn_priest' || actor.classId === 'druid') {
            Object.values(cur.fighters).forEach((f) => { if (f.side === actor.side && !f.isDead) f.hp = Math.min(f.maxHp, f.hp + heal); });
            cur.log.push({ text: `✨ ${actor.name} soigne son camp (+${heal} PV) !`, side: 'info' });
          } else {
            actor.hp = Math.min(actor.maxHp, actor.hp + heal);
            cur.log.push({ text: `✨ ${actor.name} se soigne (+${heal} PV).`, side: 'info' });
          }
        }
        if (skill.shield) {
          const sh = Math.round(actor.maxHp * skill.shield);
          actor.hp += sh;
          cur.log.push({ text: `✨ ${actor.name} gagne un bouclier (+${sh} PV).`, side: 'info' });
        }
      }
    } else if (target) {
      // Attaque de base — mêmes mods de talents qu'en chasse/donjon/endless.
      const md = actor.mods || ({} as CombatMods);
      const effDef = (target.def || 0) * (1 - (md.armorPen || 0));
      const hits = 1 + (Math.random() < (md.doubleHit || 0) ? 1 : 0);
      let total = 0;
      let healed = 0;
      for (let h = 0; h < hits && !target.isDead; h++) {
        let dmg = Math.max(1, (finalAtk - 2 + Math.random() * 4) - effDef) + (md.flatDmg || 0);
        if ((actor.hp || 0) < actor.maxHp * 0.3 && (md.berserkBonus || 0) > 0) dmg *= (1 + md.berserkBonus);
        if (target.maxHp > 0 && target.hp / target.maxHp < 0.2 && (md.execute || 0) > 0) dmg *= (1 + md.execute);
        if (Math.random() < (md.crit || 0)) dmg *= (2 + (md.critMult || 0));
        dmg = Math.round(dmg);
        total += dmg;
        target.hp = Math.max(0, target.hp - dmg);
        if (target.hp <= 0) target.isDead = true;
        if ((md.lifesteal || 0) > 0) healed += Math.round(dmg * md.lifesteal);
      }
      if (healed > 0) actor.hp = Math.min(actor.maxHp, actor.hp + healed);
      cur.log.push({ text: `⚔️ ${actor.name} attaque ${target.name} : ${total} dégâts${hits > 1 ? ' (double!)' : ''}${healed > 0 ? ` (+${healed} PV volés)` : ''}.`, side: 'you' });
    }

    if (action !== 'timeout') {
      for (const sId of Object.keys(actor.skillCds)) if (actor.skillCds[sId] > 0) actor.skillCds[sId] -= 1;
    }
    if ((actor.mods?.regen || 0) > 0 && actor.hp > 0 && actor.hp < actor.maxHp) actor.hp = Math.min(actor.maxHp, actor.hp + actor.mods.regen);

    if (cur.log.length > 40) cur.log = cur.log.slice(cur.log.length - 40);

    if (!checkVictory(cur)) advanceTurn(cur);
    return cur;
  });
}

export async function cleanupPvpDuel(id: string): Promise<void> {
  if (!rtdb) return;
  await remove(ref(rtdb, `pvpDuels/${id}`));
}
