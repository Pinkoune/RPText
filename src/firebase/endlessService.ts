import { db, rtdb } from './config';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { ref, onValue, runTransaction, remove } from 'firebase/database';
import type { ClassId } from '../game/types';
import type { CombatMods } from '../game/talents';
import { getAllActiveSkills } from '../game/talents';
import { getElementMult, getDmgTypeMult } from '../game/combat';
import { generateEndlessMonster, getEndlessRewards } from '../game/endless';

export type EndlessMode = 'solo' | 'multi';

export interface EndlessScore {
  uid: string;
  name: string;
  floor: number;
  classId: string;
  date: number;
  mode?: EndlessMode;
  /** Multi seulement : noms des coéquipiers du run. */
  party?: string[];
}

function collectionFor(mode: EndlessMode) {
  return mode === 'multi' ? 'endlessScoresMulti' : 'endlessScores';
}

export async function saveEndlessScore(score: EndlessScore) {
  if (!db) return;
  const mode = score.mode ?? 'solo';
  try {
    const docRef = doc(db, collectionFor(mode), score.uid);
    await setDoc(docRef, { ...score, mode });
  } catch (err) {
    console.error('saveEndlessScore error', err);
  }
}

export async function getTopEndlessScores(mode: EndlessMode = 'solo'): Promise<EndlessScore[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, collectionFor(mode)), orderBy('floor', 'desc'), limit(50));
    const snap = await getDocs(q);
    // Comptes admin de service (nommés "admin") : masqués du classement.
    return snap.docs.map(d => d.data() as EndlessScore).filter(s => s.name.trim().toLowerCase() !== 'admin');
  } catch (err) {
    console.error('getTopEndlessScores error', err);
    return [];
  }
}

// ─── Abysses co-op (multijoueur, RTDB) ──────────────────────────────────────
// Modelé sur dungeonService mais infini : mêmes lobby/tour par tour, sauf que
// les étages s'enchaînent sans fin jusqu'au wipe. Les PV ne se régénèrent pas
// entre les étages (comme en solo).

export interface EndlessPlayer {
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
  skillCds: Record<string, number>;
  weaponElement?: string | null;
  weaponDmgType?: string | null;
  armorElement?: string | null;
}

export interface EndlessMonster {
  floor: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  name: string;
  emoji: string;
  isBoss: boolean;
}

export interface EndlessTurnEvent {
  text: string;
  side: 'info' | 'enemy' | 'you';
}

export interface EndlessSession {
  id: string;
  host: string;
  state: 'lobby' | 'combat' | 'over';
  players: Record<string, EndlessPlayer>;
  monster?: EndlessMonster;
  floor: number;           // étage en cours (le 1er = 1)
  clearedFloors: number;   // étages déjà vaincus
  turnOrder: string[];     // uids + 'monster'
  turnIdx: number;
  turnStartAt: number;
  roundCount: number;
  accGold: number;
  accXp: number;
  accGems: number;
  log: EndlessTurnEvent[];
  startedAt: number;
}

const ABILITY_CD_TURNS = 4;

function mkEndlessPlayer(uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number, ready: boolean): EndlessPlayer {
  return {
    uid, name, classId, level: pLevel, ready,
    hp: Math.floor(pStats.maxHp), maxHp: Math.floor(pStats.maxHp),
    atk: Math.floor(pStats.atk), def: Math.floor(pStats.def),
    isDead: false, mods: pMods, skillCds: {},
    weaponElement: pStats.weaponElement || null,
    weaponDmgType: pStats.weaponDmgType || null,
    armorElement: pStats.armorElement || null,
  };
}

/** Monstre d'étage mis à l'échelle du nombre de joueurs (plus de PV/DEF/ATK en groupe). */
function initEndlessMonster(floor: number, numPlayers: number): EndlessMonster {
  const base = generateEndlessMonster(floor);
  const hpMult = Math.pow(numPlayers, 1.35) * (1 + (numPlayers - 1) * 0.1);
  const atkMult = 1 + (numPlayers - 1) * 0.45;
  const defMult = 1 + (numPlayers - 1) * 0.2;
  const hp = Math.floor(base.hp * hpMult);
  return {
    floor,
    hp, maxHp: hp,
    atk: Math.floor(base.atk * atkMult),
    def: Math.floor(base.def * defMult),
    name: base.name, emoji: base.emoji, isBoss: base.isBoss,
  };
}

export function listenEndlessSession(id: string, cb: (s: EndlessSession | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, `endlessSessions/${id}`), (snap) => cb(snap.val() as EndlessSession | null));
}

export function listenAllEndlessSessions(cb: (sessions: EndlessSession[]) => void): () => void {
  if (!rtdb) { cb([]); return () => {}; }
  return onValue(ref(rtdb, 'endlessSessions'), (snap) => {
    const val = snap.val();
    cb(val ? Object.values(val) : []);
  });
}

export async function createEndlessLobby(uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number): Promise<string> {
  if (!rtdb) throw new Error('Firebase offline');
  const id = 'end-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), () => {
    const s: EndlessSession = {
      id, host: uid, state: 'lobby',
      players: { [uid]: mkEndlessPlayer(uid, name, classId, pStats, pMods, pLevel, true) },
      floor: 1, clearedFloors: 0, turnOrder: [], turnIdx: 0, turnStartAt: 0, roundCount: 1,
      accGold: 0, accXp: 0, accGems: 0, log: [], startedAt: 0,
    };
    return s;
  });
  return id;
}

export async function joinEndlessLobby(id: string, uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), (cur: EndlessSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (!cur.players[uid]) cur.players[uid] = mkEndlessPlayer(uid, name, classId, pStats, pMods, pLevel, false);
    return cur;
  });
}

export async function toggleEndlessReady(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), (cur: EndlessSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (cur.players[uid]) cur.players[uid].ready = !cur.players[uid].ready;
    return cur;
  });
}

export async function leaveEndless(id: string, uid: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), (cur: EndlessSession | null) => {
    if (!cur) return cur;
    delete cur.players[uid];
    if (Object.keys(cur.players).length === 0) return null;
    if (cur.host === uid) cur.host = Object.keys(cur.players)[0];
    return cur;
  });
}

export async function startEndless(id: string): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), (cur: EndlessSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (!Object.values(cur.players).every(p => p.ready)) return cur;

    const players = Object.values(cur.players);
    cur.state = 'combat';
    cur.startedAt = Date.now();
    cur.floor = 1;
    cur.clearedFloors = 0;
    cur.monster = initEndlessMonster(1, players.length);
    const uids = Object.keys(cur.players).sort(() => Math.random() - 0.5);
    cur.turnOrder = [...uids, 'monster'];
    cur.turnIdx = 0;
    cur.turnStartAt = Date.now();
    cur.roundCount = 1;
    cur.log = [{ text: `Descente en équipe ! ${cur.monster.name} apparaît.`, side: 'info' }];
    return cur;
  });
}

function advanceEndlessTurn(cur: EndlessSession) {
  cur.turnStartAt = Date.now();
  cur.roundCount = cur.roundCount || 1;
  let nextIdx = (cur.turnIdx + 1) % cur.turnOrder.length;
  if (nextIdx === 0) cur.roundCount++;

  let loops = 0;
  while (cur.turnOrder[nextIdx] !== 'monster' && cur.players[cur.turnOrder[nextIdx]]?.isDead && loops < 10) {
    nextIdx = (nextIdx + 1) % cur.turnOrder.length;
    if (nextIdx === 0) cur.roundCount++;
    loops++;
  }
  cur.turnIdx = nextIdx;
  if (cur.turnOrder[cur.turnIdx] === 'monster') executeEndlessMonsterTurn(cur);
}

function executeEndlessMonsterTurn(cur: EndlessSession) {
  const m = cur.monster!;
  const alive = Object.values(cur.players).filter(p => !p.isDead);
  if (alive.length === 0) { endEndless(cur); return; }

  // Enrage doux si le combat traîne, AoE périodique pour les boss.
  const enrageMult = cur.roundCount > 8 ? 1.35 : 1;
  const isAoE = m.isBoss && cur.roundCount % 4 === 0;
  const targets = isAoE ? alive : [alive[Math.floor(Math.random() * alive.length)]];

  if (isAoE) cur.log.push({ text: `⚠️ ${m.name} déchaîne une attaque de zone !`, side: 'enemy' });

  for (const t of targets) {
    const roll = m.atk - 2 + Math.random() * 4;
    const dmgRed = t.mods?.dmgReduction || 0;
    const dodge = t.mods?.dodge || 0;
    // Élément de l'armure vs élément du monstre (créatures abyssales = 'dark',
    // même logique que la chasse/donjon) — manquait ici aussi.
    const defMult = getElementMult('dark', t.armorElement || undefined);
    let dmg = Math.max(1, Math.round((roll - (t.def || 5) * 0.6) * defMult * enrageMult * (1 - dmgRed)));
    if (Math.random() < dodge) {
      cur.log.push({ text: `${t.name} esquive l'attaque de ${m.name} !`, side: 'info' });
      continue;
    }
    t.hp = (t.hp || 0) - dmg;
    cur.log.push({ text: `${m.name} frappe ${t.name} : ${dmg} dégâts.`, side: 'enemy' });
    // Épines : renvoie une partie des dégâts subis au monstre.
    if ((t.mods?.thorns || 0) > 0) {
      const reflect = Math.round(dmg * t.mods.thorns);
      if (reflect > 0) {
        m.hp = Math.max(0, m.hp - reflect);
        cur.log.push({ text: `🌿 ${t.name} renvoie ${reflect} dégâts (Épines).`, side: 'you' });
      }
    }
    if (t.hp <= 0) {
      t.hp = 0; t.isDead = true;
      cur.log.push({ text: `💀 ${t.name} est tombé !`, side: 'enemy' });
    }
  }

  // Le monstre peut mourir des épines pendant son propre tour.
  if (m.hp <= 0) {
    cur.log.push({ text: `🎉 ${m.name} succombe aux épines !`, side: 'info' });
    nextEndlessFloor(cur);
    return;
  }

  if (Object.values(cur.players).every(p => p.isDead)) endEndless(cur);
  else advanceEndlessTurn(cur);
}

function endEndless(cur: EndlessSession) {
  cur.state = 'over';
  cur.log.push({ text: `☠️ L'équipe a sombré à l'étage ${cur.floor}. Étages vaincus : ${cur.clearedFloors}.`, side: 'info' });
}

function nextEndlessFloor(cur: EndlessSession) {
  // Récompenses de l'étage vaincu, puis étage suivant (PV conservés).
  const rw = getEndlessRewards(cur.floor);
  cur.accGold += rw.gold;
  cur.accXp += rw.xp;
  cur.accGems += rw.gems;
  cur.clearedFloors = cur.floor;
  cur.floor += 1;
  cur.monster = initEndlessMonster(cur.floor, Object.keys(cur.players).length);
  cur.turnIdx = 0;
  cur.turnStartAt = Date.now();
  cur.roundCount = 1;
  cur.log.push({ text: `✅ Étage ${cur.clearedFloors} vaincu ! Étage ${cur.floor} : ${cur.monster.name}.`, side: 'info' });
}

export async function submitEndlessAction(id: string, uid: string, action: string, potionHeal?: number, targetUid?: string, reviveFrac?: number): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `endlessSessions/${id}`), (cur: EndlessSession | null) => {
    if (!cur || cur.state !== 'combat') return cur;

    if (action === 'flee') {
      cur.log.push({ text: `🏃 ${cur.players[uid]?.name ?? 'Un membre'} ordonne la retraite. Le groupe remonte.`, side: 'info' });
      cur.state = 'over';
      return cur;
    }

    // Seul le joueur dont c'est le tour agit (sauf timeout auto).
    if (cur.turnOrder[cur.turnIdx] !== uid && action !== 'timeout') return cur;
    if (action === 'timeout') {
      if (cur.turnOrder[cur.turnIdx] !== uid && Date.now() - cur.turnStartAt < 32000) return cur;
    }

    const p = cur.players[cur.turnOrder[cur.turnIdx]];
    const m = cur.monster!;
    if (!p) return cur;
    p.skillCds = p.skillCds || {};
    if (p.isDead) { advanceEndlessTurn(cur); return cur; }

    const pAtk = p.atk || 10;
    // Les créatures abyssales sont de l'ombre ; l'élément de l'arme joue.
    const elemMult = getElementMult(p.weaponElement || undefined, 'dark') * getDmgTypeMult(p.weaponDmgType || undefined, m as any);
    const finalAtk = pAtk * elemMult;

    if (action === 'timeout') {
      cur.log.push({ text: `⌛ Tour de ${p.name} passé (inactif).`, side: 'info' });
    } else if (action === 'revive' && targetUid && cur.players[targetUid]?.isDead) {
      const t = cur.players[targetUid];
      t.isDead = false;
      t.hp = Math.floor(t.maxHp * (reviveFrac ?? 0.5));
      cur.log.push({ text: `🪶 ${p.name} ressuscite ${t.name} !`, side: 'info' });
    } else if (action === 'potion') {
      const heal = potionHeal ?? 120;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      cur.log.push({ text: `${p.name} boit une potion (+${heal} PV).`, side: 'you' });
    } else if (action !== 'attack') {
      // Compétence active
      const skillId = action;
      if ((p.skillCds[skillId] || 0) > 0) return cur;
      const skill = getAllActiveSkills().find(s => s.id === skillId);
      if (skill) {
        p.skillCds[skillId] = ABILITY_CD_TURNS;
        if (skill.mult) {
          const effDef = (m.def || 0) * (1 - (p.mods?.armorPen || 0));
          const dmg = Math.max(1, Math.round(finalAtk * skill.mult - effDef));
          m.hp -= dmg;
          if ((p.mods?.lifesteal || 0) > 0) p.hp = Math.min(p.maxHp, p.hp + Math.round(dmg * p.mods.lifesteal));
          cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} : ${dmg} dégâts !`, side: 'you' });
        }
        if (skill.healFrac) {
          const heal = Math.round(pAtk * 1.0 + p.maxHp * skill.healFrac);
          if (p.classId === 'healer' || p.classId === 'dawn_priest' || p.classId === 'druid') {
            Object.values(cur.players).forEach(a => { if (!a.isDead) a.hp = Math.min(a.maxHp, a.hp + heal); });
            cur.log.push({ text: `✨ ${p.name} soigne tout le groupe (+${heal} PV) !`, side: 'info' });
          } else {
            p.hp = Math.min(p.maxHp, p.hp + heal);
            cur.log.push({ text: `✨ ${p.name} se soigne (+${heal} PV).`, side: 'info' });
          }
        }
        if (skill.shield) {
          const sh = Math.round(p.maxHp * skill.shield);
          p.hp += sh;
          cur.log.push({ text: `✨ ${p.name} gagne un bouclier (+${sh} PV).`, side: 'info' });
        }
      }
    } else {
      // Attaque de base (applique tous les mods de talents, comme en chasse).
      const md = p.mods || ({} as typeof p.mods);
      const effDef = (m.def || 0) * (1 - (md.armorPen || 0));
      const hits = 1 + (Math.random() < (md.doubleHit || 0) ? 1 : 0);
      let total = 0;
      let healed = 0;
      for (let h = 0; h < hits; h++) {
        let dmg = Math.max(1, (finalAtk - 2 + Math.random() * 4) - effDef) + (md.flatDmg || 0);
        if ((p.hp || 0) < p.maxHp * 0.3 && (md.berserkBonus || 0) > 0) dmg *= (1 + md.berserkBonus);
        if (m.maxHp > 0 && m.hp / m.maxHp < 0.2 && (md.execute || 0) > 0) dmg *= (1 + md.execute); // exécution
        if (Math.random() < (md.crit || 0)) dmg *= (2 + (md.critMult || 0));
        dmg = Math.round(dmg);
        total += dmg;
        m.hp -= dmg;
        if ((md.lifesteal || 0) > 0) healed += Math.round(dmg * md.lifesteal);
      }
      if (healed > 0) p.hp = Math.min(p.maxHp, p.hp + healed);
      cur.log.push({ text: `⚔️ ${p.name} attaque ${m.name} : ${total} dégâts${hits > 1 ? ' (double!)' : ''}${healed > 0 ? ` (+${healed} PV volés)` : ''}.`, side: 'you' });
    }

    if (action !== 'timeout') {
      for (const sId of Object.keys(p.skillCds)) if (p.skillCds[sId] > 0) p.skillCds[sId] -= 1;
    }
    if (p.mods?.regen > 0 && p.hp > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.mods.regen);

    if (cur.log.length > 40) cur.log = cur.log.slice(cur.log.length - 40);

    if (m.hp <= 0) {
      cur.log.push({ text: `🎉 ${m.name} vaincu !`, side: 'info' });
      nextEndlessFloor(cur);
    } else {
      advanceEndlessTurn(cur);
    }
    return cur;
  });
}

export async function cleanupEndless(id: string) {
  if (!rtdb) return;
  await remove(ref(rtdb, `endlessSessions/${id}`));
}
