import { ref, onValue, runTransaction, remove, set } from 'firebase/database';
import { rtdb } from './config';
import type { ClassId } from '../game/types';
import type { CombatMods } from '../game/talents';
import { getAllActiveSkills, classResourceType } from '../game/talents';
import { DUNGEONS, type DungeonDef } from '../game/dungeons';
import { getElementMult, getDmgTypeMult } from '../game/combat';
import type { SetProc } from '../game/sets';

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
  skillCds: Record<string, number>;
  weaponElement?: string | null;
  weaponDmgType?: string | null;
  armorElement?: string | null;
  aura?: string | null;
  auraColorOn?: boolean;
  /** Proc de set (3 pièces équipées), calculé côté client à l'entrée en donjon. */
  setProc?: SetProc | null;
  /** Bouclier temporaire posé par un proc de set (absorbe les dégâts avant les PV). */
  shield?: number;
  /** Ressource d'archétype (rage/combo/mana/...), voir `classResourceType`. Manquait totalement
   *  en donjon avant : les compétences à ressource (ex: Enfer du Pyromancien) n'étaient gatées
   *  QUE par le cooldown (~1 tour vu le plancher anti-spam de 3s), donc castables en illimité. */
  resourcePool?: number;
  /** Dernière action jouée (Barde : Tempo se charge en alternant les actions). */
  lastActionType?: string | null;
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
  /** Brûlure/gel/poison posés par un proc de set ou une compétence (affectent le monstre). */
  burn?: number;
  burnPow?: number;
  chill?: number;
  poison?: number;
  poisonPow?: number;
  /** Auteur de la brûlure/poison en cours — sert au combo élémentaire (2 joueurs différents). */
  burnBy?: string;
  poisonBy?: string;
  /** Affaiblissement (Chasseur : Morsure) — réduit l'ATK du monstre le temps que ça dure. */
  weaken?: number;
  weakenPow?: number;
  /** Bris d'armure (Guerrier : Fendoir) — réduit la DEF du monstre le temps que ça dure. */
  armorBreak?: number;
  armorBreakPow?: number;
  /** Le boss (dernier stage) charge une attaque dévastatrice : un tour de préavis avant
   *  qu'elle tombe, annulée si le boss encaisse un gros coup entre-temps (interruption). */
  chargingHeavy?: boolean;
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
  /** Raid : timestamp de démarrage automatique (fin des inscriptions, :10). */
  raidStartsAt?: number;
}

const ABILITY_CD = 4;

export function listenDungeon(id: string, cb: (ds: DungeonSession | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, `dungeons/${id}`), (snap) => cb(snap.val() as DungeonSession | null));
}

export interface DungeonOpenBroadcast {
  id: string;
  hostUid: string;
  hostName: string;
  dungeonName: string;
  /** Niveau requis du donjon — la notif n'est affichée qu'aux joueurs qui l'atteignent. */
  minLevel: number;
  ts: number;
}

/** Diffuse l'ouverture d'un groupe de donjon (hors raid, déjà couvert par sa propre bannière). */
export async function broadcastDungeonOpen(hostUid: string, hostName: string, dungeonName: string, minLevel: number): Promise<void> {
  if (!rtdb) return;
  const b: DungeonOpenBroadcast = { id: `${hostUid}-${Date.now()}`, hostUid, hostName, dungeonName, minLevel, ts: Date.now() };
  await set(ref(rtdb, 'world/dungeonOpen'), b);
}

/** Écoute la diffusion d'ouverture de groupe de donjon (notification globale). */
export function listenDungeonOpenBroadcast(cb: (b: DungeonOpenBroadcast | null) => void): () => void {
  if (!rtdb) { cb(null); return () => {}; }
  return onValue(ref(rtdb, 'world/dungeonOpen'), (snap) => cb((snap.val() as DungeonOpenBroadcast | null) ?? null));
}

export async function createDungeonLobby(hostUid: string, hostName: string, hostClass: ClassId, dungeonId: string, pStats: any, pMods: any, pLevel: number, aura?: string | null, auraColorOn?: boolean, setProc?: SetProc | null): Promise<string> {
  if (!rtdb) throw new Error('Firebase offline');
  const id = 'dgn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await runTransaction(ref(rtdb, `dungeons/${id}`), () => {
    const def = DUNGEONS.find(d => d.id === dungeonId);
    const ratio = (def && pLevel > def.minLevel) ? Math.pow(def.minLevel / pLevel, 0.4) : 1;
    const ds: DungeonSession = {
      id, host: hostUid, dungeonId, state: 'lobby',
      players: {
        [hostUid]: {
          uid: hostUid, name: hostName, classId: hostClass, ready: true, level: pLevel,
          hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio),
          atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
          isDead: false, mods: pMods, skillCds: {},
          weaponElement: pStats.weaponElement || null,
          weaponDmgType: pStats.weaponDmgType || null,
          armorElement: pStats.armorElement || null,
          aura: aura || null, auraColorOn: auraColorOn ?? true,
          setProc: setProc || null,
        }
      },
      turnOrder: [], turnIdx: 0, turnStartAt: 0, roundCount: 1, log: [], startedAt: 0
    };
    return ds;
  });
  return id;
}

/**
 * Rejoint (ou crée si absente) la session de raid partagée du jour à un id
 * déterministe (`raid-<key>`), afin que tous les inscrits tombent dans le même
 * lobby. Le 1er arrivé devient hôte. Illimité en joueurs (def raid).
 */
export async function joinOrCreateRaid(sessionId: string, dungeonId: string, startsAt: number, uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number, aura?: string | null, auraColorOn?: boolean, setProc?: SetProc | null): Promise<void> {
  if (!rtdb) throw new Error('Firebase offline');
  await runTransaction(ref(rtdb, `dungeons/${sessionId}`), (cur: DungeonSession | null) => {
    const def = DUNGEONS.find(d => d.id === dungeonId);
    const ratio = (def && pLevel > def.minLevel) ? Math.pow(def.minLevel / pLevel, 0.4) : 1;
    const player = {
      uid, name, classId, ready: false, level: pLevel,
      hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio),
      atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
      isDead: false, mods: pMods, skillCds: {},
      weaponElement: pStats.weaponElement || null,
      weaponDmgType: pStats.weaponDmgType || null,
      armorElement: pStats.armorElement || null,
      aura: aura || null, auraColorOn: auraColorOn ?? true,
      setProc: setProc || null,
    };
    if (!cur) {
      return {
        id: sessionId, host: uid, dungeonId, state: 'lobby',
        players: { [uid]: { ...player, ready: true } },
        turnOrder: [], turnIdx: 0, turnStartAt: 0, roundCount: 1, log: [], startedAt: 0,
        raidStartsAt: startsAt,
      } as DungeonSession;
    }
    if (cur.state === 'lobby' && !cur.players[uid]) cur.players[uid] = player;
    return cur;
  });
}

export async function joinDungeon(id: string, uid: string, name: string, classId: ClassId, pStats: any, pMods: any, pLevel: number, aura?: string | null, auraColorOn?: boolean, setProc?: SetProc | null): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    if (!cur.players[uid]) {
      const def = DUNGEONS.find(d => d.id === cur.dungeonId);
      // Limite de 4 joueurs pour les donjons ; illimité pour les raids.
      const limit = def?.raid ? Infinity : 4;
      if (Object.keys(cur.players).length >= limit) return cur;
      const ratio = (def && pLevel > def.minLevel) ? Math.pow(def.minLevel / pLevel, 0.4) : 1;
      cur.players[uid] = {
        uid, name, classId, ready: false, level: pLevel,
        hp: Math.floor(pStats.maxHp * ratio), maxHp: Math.floor(pStats.maxHp * ratio),
        atk: Math.floor(pStats.atk * ratio), def: Math.floor(pStats.def * ratio),
        isDead: false, mods: pMods, skillCds: {},
        weaponElement: pStats.weaponElement || null,
        weaponDmgType: pStats.weaponDmgType || null,
        armorElement: pStats.armorElement || null,
        aura: aura || null, auraColorOn: auraColorOn ?? true,
        setProc: setProc || null,
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
  
  // Scaling renforcé : les monstres résistent mieux aux groupes nombreux
  const lvlMult = Math.pow(1 + Math.max(0, avgLevel - 1) / 30, avgLevel >= 20 ? 1.8 : 1.4);
  const hpMult  = Math.pow(numPlayers, 1.4) * (1 + (numPlayers - 1) * 0.1) * lvlMult; // HP +
  const atkMult = (1 + (numPlayers - 1) * 0.5) * lvlMult; // ATK 0.3→0.5
  const defMult = (1 + (numPlayers - 1) * 0.25) * lvlMult; // DEF 0.15→0.25 

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

export async function startDungeon(id: string, force = false): Promise<void> {
  if (!rtdb) return;
  await runTransaction(ref(rtdb, `dungeons/${id}`), (cur: DungeonSession | null) => {
    if (!cur || cur.state !== 'lobby') return cur;
    const def = DUNGEONS.find(d => d.id === cur.dungeonId);
    if (!def) return cur;
    // Raids ou démarrage forcé (auto-start à :10) : on ignore le « tous prêts ».
    const allReady = force || def.raid || Object.values(cur.players).every(p => p.ready);
    if (!allReady) return cur; // Can't start

    cur.state = 'combat';
    cur.startedAt = Date.now();
    const playersArr = Object.values(cur.players);
    const avgLevel = playersArr.reduce((sum, p) => sum + (p.level || 1), 0) / Math.max(1, playersArr.length);
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

  // Réaction d'un joueur qui encaisse un coup (dégâts finaux, post-bouclier) :
  // charge Rage (Berserker)/Ferveur (Paladin, sur absorption) et applique les
  // Épines (Druide) — manquaient totalement en donjon, `mods.thorns` n'était
  // jamais lu ici (le passif ne faisait donc rien en multijoueur).
  function reactToHit(target: DungeonPlayer, dmg: number, absorbed: number) {
    const rt = classResourceType(target.classId);
    if (rt === 'rage' && dmg > 0) {
      const gain = Math.min(25, Math.round((dmg / (target.maxHp || 1)) * 100 * 0.4));
      target.resourcePool = Math.min(100, (target.resourcePool ?? 0) + gain);
    } else if (rt === 'zeal' && absorbed > 0) {
      target.resourcePool = Math.min(100, (target.resourcePool ?? 0) + 20);
    }
    if ((target.mods?.thorns || 0) > 0 && dmg > 0) {
      const thornsDmg = Math.max(1, Math.round(dmg * target.mods.thorns));
      m.hp = Math.max(0, (m.hp || 0) - thornsDmg);
      cur.log.push({ text: `🌿 Épines : ${m.name} subit ${thornsDmg} dégâts en retour !`, side: 'you' });
      if (rt === 'sap') target.resourcePool = Math.min(100, (target.resourcePool ?? 0) + 20);
    }
  }

  if (m.staggered) {
    m.staggered = false;
    cur.log.push({ text: `🌀 ${m.name} est étourdi et passe son tour !`, side: 'info' });
    advanceTurn(cur);
    return;
  }

  // Enrage remis à zéro par ennemi (voir transition de stage) : seuil normal à
  // 15 tours, repoussé à 20 pour le boss final (dernier stage) pour lui laisser
  // plus de marge avant de punir un combat qui traîne.
  const bossDef = DUNGEONS.find(d => d.id === cur.dungeonId);
  const isBossStage = bossDef ? m.idx === bossDef.stages.length - 1 : false;
  const enrageThreshold = isBossStage ? 20 : 15;
  const isEnraged = cur.roundCount > enrageThreshold;
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

  // ── Boss final uniquement : attaque dévastatrice télégraphiée ──
  // Un tour de préavis (le boss ne frappe pas ce tour-là) avant l'impact, pour
  // laisser au groupe le temps de soigner/bouclier — sauf si interrompue par un
  // gros coup encaissé entre-temps (voir `submitDungeonAction`).
  if (m.chargingHeavy) {
    m.chargingHeavy = false;
    cur.log.push({ text: `💥 ${m.name} libère son attaque DÉVASTATRICE !`, side: 'enemy' });
    for (const target of alive) {
      const tDef = target.def || 5;
      const dmgRed = target.mods?.dmgReduction || 0;
      let dmg = Math.max(1, Math.round(m.atk * 2.3 - tDef * 0.6));
      dmg = Math.max(1, Math.round(dmg * (1 - dmgRed)));
      let absorbed = 0;
      if ((target.shield || 0) > 0) {
        absorbed = Math.min(target.shield!, dmg);
        target.shield = target.shield! - absorbed;
        dmg -= absorbed;
        if (absorbed > 0) cur.log.push({ text: `🛡️ Le bouclier de ${target.name} absorbe ${absorbed} dégâts.`, side: 'info' });
      }
      reactToHit(target, dmg, absorbed);
      target.hp = (target.hp || 0) - dmg;
      if (dmg > 0) cur.log.push({ text: `${m.name} écrase ${target.name} pour ${dmg} dégâts !`, side: 'enemy' });
      if (target.hp <= 0) { target.hp = 0; target.isDead = true; cur.log.push({ text: `💀 ${target.name} est K.O. !`, side: 'enemy' }); }
    }
    if (Object.values(cur.players).every(p => p.isDead)) {
      cur.state = 'defeat';
      cur.log.push({ text: `Toute l'équipe a été vaincue... Échec du donjon.`, side: 'enemy' });
      return;
    }
    advanceTurn(cur);
    return;
  }
  if (isBossStage && cur.roundCount >= 4 && cur.roundCount % 6 === 0) {
    m.chargingHeavy = true;
    cur.log.push({ text: `⚠️⚠️ ${m.name} charge une attaque DÉVASTATRICE ! Protégez-vous au prochain tour !`, side: 'enemy' });
    advanceTurn(cur);
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
  const chilled = (m.chill || 0) > 0;
  const weakened = (m.weaken || 0) > 0;
  const effMAtk = weakened ? m.atk * (1 - (m.weakenPow || 0)) : m.atk;

  for (const target of targets) {
    const roll = effMAtk - 2 + Math.random() * 4;
    const tDef = target.def || 5;
    const dmgRed = target.mods?.dmgReduction || 0;
    const dodge = target.mods?.dodge || 0;
    // Élément de l'armure vs élément du monstre (même logique qu'en chasse,
    // combat.ts `defMult`) — manquait ici : une armure d'eau ne réduisait
    // jamais les dégâts d'un boss de feu en donjon.
    const defMult = getElementMult(m.element, target.armorElement || undefined);

    let dmg = Math.max(1, Math.round(roll - tDef * 0.6));
    dmg = Math.max(1, Math.round(dmg * defMult));
    dmg = Math.max(1, Math.round(dmg * enrageMult * (1 - dmgRed)));
    if (m.affix === 'agile' && Math.random() < 0.2) dmg = Math.round(dmg * 1.2);
    if (chilled) dmg = Math.max(1, Math.round(dmg * 0.6)); // gel (proc de set) : dégâts réduits

    if (Math.random() < dodge) {
      cur.log.push({ text: `L'attaque de ${m.name} sur ${target.name} échoue (Esquive) !`, side: 'info' });
    } else {
      // Bouclier posé par un proc de set : absorbe avant les PV.
      let absorbed = 0;
      if ((target.shield || 0) > 0) {
        absorbed = Math.min(target.shield!, dmg);
        target.shield = target.shield! - absorbed;
        dmg -= absorbed;
        if (absorbed > 0) cur.log.push({ text: `🛡️ Le bouclier de ${target.name} absorbe ${absorbed} dégâts.`, side: 'info' });
      }
      reactToHit(target, dmg, absorbed);
      target.hp = (target.hp || 0) - dmg;
      if (m.affix === 'vampiric') totalHeal += Math.round(dmg * 0.2);
      if (dmg > 0) cur.log.push({ text: `${m.name} attaque ${target.name} et inflige ${dmg} dégâts !`, side: 'enemy' });

      if (target.hp <= 0) {
        target.hp = 0;
        target.isDead = true;
        cur.log.push({ text: `💀 ${target.name} est K.O. !`, side: 'enemy' });
      }
    }
  }

  if (chilled) m.chill = (m.chill || 0) - 1;
  if (weakened) m.weaken = (m.weaken || 0) - 1;

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

export async function submitDungeonAction(id: string, uid: string, action: string, potionHeal?: number, targetUid?: string, reviveFrac?: number): Promise<void> {
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
    
    p.skillCds = p.skillCds || {};
    p.resourcePool = p.resourcePool ?? 0;
    const resourceType = classResourceType(p.classId);
    const resourceMax = resourceType === 'combo' ? 5 : 100;
    let dealtHit = false;
    let critLanded = false;
    let healedAmount = 0;
    let abilityUsed = false;

    if (p.isDead) {
      advanceTurn(cur);
      return cur;
    }

    const isLastHope = Date.now() - cur.startedAt > 18 * 60 * 1000;
    const hopeMult = isLastHope ? 1.5 : 1.0;
    
    const pAtk = p.atk || 10;
    const elemMult = getElementMult(p.weaponElement || undefined, m.element) * getDmgTypeMult(p.weaponDmgType || undefined, m as any);
    // elemMult (résistance/faiblesse) appliqué APRÈS soustraction de la DEF, comme en
    // chasse (combat.ts) — avant : appliqué avant, donc un attaquant faible face à un
    // boss à double résistance (physique+magique, cas de la Liche) voyait son ATK déjà
    // divisé par 2 avant même de soustraire la DEF (scalée par niveau/groupe), et
    // retombait à 1 dégât garanti à chaque coup quel que soit son arme.
    const finalAtk = pAtk * hopeMult;
    // Fendoir (Guerrier) : DEF du monstre réduite tant que le bris d'armure dure.
    const effMDef = (m.armorBreak || 0) > 0 ? (m.def || 0) * (1 - (m.armorBreakPow || 0)) : (m.def || 0);
    // L'attaque encaissée pendant la charge d'un boss interrompt son coup dévastateur.
    const interruptThreshold = m.maxHp * 0.15;
    function maybeInterrupt(dmg: number) {
      if (m.chargingHeavy && dmg >= interruptThreshold) {
        m.chargingHeavy = false;
        cur!.log.push({ text: `⚡ ${p.name} interrompt la charge de ${m.name} !`, side: 'you' });
      }
    }

    if (action === 'timeout') {
      cur.log.push({ text: `⌛ Le tour de ${p.name} est passé (inactif).`, side: 'info' });
    } else if (action === 'revive' && targetUid && cur.players[targetUid]?.isDead) {
      const t = cur.players[targetUid];
      t.isDead = false;
      t.hp = Math.floor(t.maxHp * (reviveFrac ?? 0.5));
      cur.log.push({ text: `🪶 ${p.name} ressuscite ${t.name} !`, side: 'info' });
    } else if (action === 'potion') {
      const heal = potionHeal ?? 180;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      cur.log.push({ text: `${p.name} boit une potion (+${heal} PV).`, side: 'you' });
    } else if (action !== 'attack' && action !== 'timeout' && action !== 'flee' && action !== 'potion' && action !== 'revive') {
      // Action is a skill ID
      const skillId = action;
      if ((p.skillCds[skillId] || 0) > 0) return cur; // Skill is on cooldown

      const skill = getAllActiveSkills().find(s => s.id === skillId);
      // Ressource d'archétype : sans ça, une compétence comme Enfer (Pyromancien) n'était
      // gatée QUE par le cooldown (~1 tour vu le plancher anti-spam de 3s) → castable
      // à chaque tour. Même logique de coût/scaling qu'en chasse (combat.ts).
      if (skill?.resource && (p.resourcePool ?? 0) < skill.resource.cost) return cur;

      if (skill) {
        p.skillCds[skillId] = Math.max(1, Math.ceil(skill.cooldownMs / 4000));
        abilityUsed = true;
        let effMult = skill.mult ?? 0;
        let effHealFrac = skill.healFrac ?? 0;
        if (skill.resource) {
          const pool = p.resourcePool ?? 0;
          let resourceSpent = skill.resource.cost;
          if (skill.resource.type === 'combo') {
            effMult = (skill.mult ?? 0) + (skill.resource.scalePerPoint ?? 0) * pool;
            resourceSpent = pool;
          } else if (skill.resource.type === 'grace') {
            effHealFrac = (skill.healFrac ?? 0) + (skill.resource.scalePerPoint ?? 0) * pool;
            resourceSpent = pool;
          }
          p.resourcePool = Math.max(0, pool - resourceSpent);
        }
        if (skill.type === 'attack' || skill.type === 'shield' || skill.type === 'heal' || skill.type === 'buff') {
          if (effMult) {
            const dmg = Math.round(Math.max(1, finalAtk * effMult - effMDef) * elemMult);
            m.hp = (m.hp || 0) - dmg;
            maybeInterrupt(dmg);
            dealtHit = true;
            if (p.classId === 'warrior' || p.classId === 'paladin') {
              m.provokedBy = p.uid;
              m.provokeTurns = 2;
            }
            cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} : ${dmg} dégâts !`, side: 'you' });
          }
          if (effHealFrac) {
            const pMaxHp = p.maxHp || 100;
            const heal = Math.round(pAtk * 1.0 + pMaxHp * effHealFrac);
            healedAmount += heal;
            // AoE Heal for Healer/Dawn Priest/Druid
            if (p.classId === 'healer' || p.classId === 'dawn_priest' || p.classId === 'druid') {
              Object.values(cur.players).forEach(ally => {
                const allyMaxHp = ally.maxHp || 100;
                if (!ally.isDead) ally.hp = Math.min(allyMaxHp, (ally.hp || 0) + heal);
              });
              cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} et soigne tout le groupe (+${heal} PV) !`, side: 'info' });
            } else {
              p.hp = Math.min(pMaxHp, (p.hp || 0) + heal);
              cur.log.push({ text: `✨ ${p.name} utilise ${skill.name} et se soigne (+${heal} PV).`, side: 'info' });
            }
          }
          if (skill.shield) {
            const heal = Math.round(p.maxHp * skill.shield);
            p.hp = p.hp + heal; // Temp overheal for dungeon
            cur.log.push({ text: `✨ ${p.name} gagne un bouclier via ${skill.name} (+${heal} PV).`, side: 'info' });
          }
          // Statuts de compétence (brûlure/poison/gel) : jusqu'ici seuls les procs de
          // set les posaient en donjon, `skill.status` (ex: flèche empoisonnée) était
          // lu en chasse (combat.ts) mais jamais ici. Même formule que combat.ts.
          if (skill.status && (m.hp || 0) > 0) {
            const st = skill.status;
            const pow = st.pow ? Math.max(1, Math.round(finalAtk * st.pow)) : 0;
            if (st.type === 'burn') {
              m.burn = Math.max(m.burn || 0, st.turns);
              m.burnPow = Math.max(m.burnPow || 0, pow);
              m.burnBy = p.uid;
              cur.log.push({ text: `🔥 ${m.name} prend feu !`, side: 'you' });
              // Combo élémentaire : un autre joueur a déjà posé le poison → explosion bonus.
              if ((m.poison || 0) > 0 && m.poisonBy && m.poisonBy !== p.uid) {
                const boom = Math.max(1, Math.round(m.maxHp * 0.08));
                m.hp = Math.max(0, (m.hp || 0) - boom);
                maybeInterrupt(boom);
                cur.log.push({ text: `💥 Combo élémentaire ! Brûlure + Poison se combinent : ${boom} dégâts bonus !`, side: 'you' });
              }
            } else if (st.type === 'poison') {
              m.poison = Math.max(m.poison || 0, st.turns);
              m.poisonPow = Math.max(m.poisonPow || 0, pow);
              m.poisonBy = p.uid;
              cur.log.push({ text: `🧪 ${m.name} est empoisonné !`, side: 'you' });
              if ((m.burn || 0) > 0 && m.burnBy && m.burnBy !== p.uid) {
                const boom = Math.max(1, Math.round(m.maxHp * 0.08));
                m.hp = Math.max(0, (m.hp || 0) - boom);
                maybeInterrupt(boom);
                cur.log.push({ text: `💥 Combo élémentaire ! Poison + Brûlure se combinent : ${boom} dégâts bonus !`, side: 'you' });
              }
            } else if (st.type === 'chill') {
              m.chill = Math.max(m.chill || 0, st.turns);
              cur.log.push({ text: `❄️ ${m.name} est gelé (frappe affaiblie) !`, side: 'you' });
            } else if (st.type === 'weaken') {
              m.weaken = Math.max(m.weaken || 0, st.turns);
              m.weakenPow = Math.max(m.weakenPow || 0, st.pow || 0);
              cur.log.push({ text: `🐺 ${m.name} est affaibli (ATK réduite) !`, side: 'you' });
            } else if (st.type === 'armorBreak') {
              m.armorBreak = Math.max(m.armorBreak || 0, st.turns);
              m.armorBreakPow = Math.max(m.armorBreakPow || 0, st.pow || 0);
              cur.log.push({ text: `🪓 L'armure de ${m.name} est brisée (DEF réduite) !`, side: 'you' });
            }
          }
          // Arcaniste : Distorsion accélère les autres compétences équipées.
          if (skill.haste) {
            for (const sId of Object.keys(p.skillCds)) {
              if (sId !== skillId) p.skillCds[sId] = Math.max(0, p.skillCds[sId] - skill.haste);
            }
          }
          // Paladin : Rempart force l'aggro même s'il ne fait pas de dégâts.
          if (skill.taunt) {
            m.provokedBy = p.uid;
            m.provokeTurns = Math.max(m.provokeTurns, 3);
            cur.log.push({ text: `🛡️ ${p.name} provoque ${m.name} !`, side: 'info' });
          }
          // Barde : Crescendo buff l'ATK pour le reste du combat, toute l'équipe en donjon.
          if (skill.teamAtkBuff) {
            const bonus = Math.round(pAtk * skill.teamAtkBuff);
            Object.values(cur.players).forEach(ally => {
              if (!ally.isDead) ally.atk = (ally.atk || 0) + bonus;
            });
            cur.log.push({ text: `🎶 ${p.name} galvanise le groupe (+${bonus} ATK pour tous) !`, side: 'info' });
          }
        }
      } else {
        cur.log.push({ text: `Compétence inconnue utilisée par ${p.name}.`, side: 'info' });
      }
    } else {
      // Basic Attack
      const doubleHit = p.mods?.doubleHit || 0;
      const hits = 1 + (Math.random() < doubleHit ? 1 : 0);
      let totalDmg = 0;
      for (let h = 0; h < hits; h++) {
        const flatDmg = p.mods?.flatDmg || 0;
        const berserkBonus = p.mods?.berserkBonus || 0;
        const crit = p.mods?.crit || 0;

        let dmg = Math.round(Math.max(1, (finalAtk - 2 + Math.random() * 4) - effMDef) * elemMult) + flatDmg;
        const pMaxHp = p.maxHp || 100;
        if ((p.hp || 0) < pMaxHp * 0.3 && berserkBonus > 0) dmg = Math.round(dmg * (1 + berserkBonus));
        if (Math.random() < crit) { dmg *= 2; critLanded = true; }
        dmg = Math.round(dmg);
        totalDmg += dmg;
        m.hp = (m.hp || 0) - dmg;
        maybeInterrupt(dmg);
        dealtHit = true;
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

    if (action !== 'timeout') {
      for (const sId of Object.keys(p.skillCds)) {
        if (p.skillCds[sId] > 0) p.skillCds[sId] -= 1;
      }
    }

    // Gain de ressource d'archétype (même formule qu'en chasse, combat.ts).
    if (action !== 'timeout' && !p.isDead) {
      let resourceGain = 0;
      if (resourceType === 'combo' && dealtHit) resourceGain = 1;
      else if (resourceType === 'mana') resourceGain = 15;
      else if (resourceType === 'instinct' && critLanded) resourceGain = 30;
      else if (resourceType === 'corruption' && dealtHit && (p.hp || 0) < (p.maxHp || 1) * 0.3) resourceGain = 35;
      else if (resourceType === 'overcharge' && abilityUsed) resourceGain = 25;
      else if (resourceType === 'grace' && healedAmount > 0) resourceGain = Math.round(healedAmount * 0.15);
      else if (resourceType === 'tempo' && p.lastActionType != null && p.lastActionType !== action) resourceGain = 30;
      p.resourcePool = Math.max(0, Math.min(resourceMax, (p.resourcePool ?? 0) + resourceGain));
      p.lastActionType = action;
    }

    if (p.mods.regen > 0 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.mods.regen);
    }

    // ── Proc de set (3 pièces équipées) : se déclenche sur une action offensive ──
    const offensive = action !== 'timeout' && action !== 'flee' && action !== 'potion' && action !== 'revive';
    if (p.setProc && offensive && !p.isDead && (m.hp || 0) > 0 && Math.random() < p.setProc.chance) {
      const sp = p.setProc;
      if (sp.kind === 'burn') {
        m.burn = Math.max(m.burn || 0, 2);
        m.burnPow = Math.max(m.burnPow || 0, Math.max(1, Math.round(p.atk * sp.power)));
        cur.log.push({ text: `${sp.icon} ${sp.name} : ${m.name} prend feu !`, side: 'you' });
      } else if (sp.kind === 'chill') {
        m.chill = Math.max(m.chill || 0, 2);
        cur.log.push({ text: `${sp.icon} ${sp.name} : ${m.name} est gelé !`, side: 'you' });
      } else if (sp.kind === 'heal') {
        const heal = Math.max(1, Math.round(p.maxHp * sp.power));
        p.hp = Math.min(p.maxHp, p.hp + heal);
        cur.log.push({ text: `${sp.icon} ${sp.name} : ${p.name} +${heal} PV.`, side: 'info' });
      } else if (sp.kind === 'shield') {
        const amt = Math.max(1, Math.round(p.maxHp * sp.power));
        p.shield = (p.shield || 0) + amt;
        cur.log.push({ text: `${sp.icon} ${sp.name} : bouclier +${amt} PV pour ${p.name}.`, side: 'info' });
      } else if (sp.kind === 'extra') {
        const dmg = Math.max(1, Math.round(p.atk * sp.power));
        m.hp = Math.max(0, (m.hp || 0) - dmg);
        cur.log.push({ text: `${sp.icon} ${sp.name} : +${dmg} dégâts !`, side: 'you' });
      }
    }

    // Brûlure/poison en cours sur le monstre : tick de fin de tour.
    if ((m.hp || 0) > 0 && (m.burn || 0) > 0 && (m.burnPow || 0) > 0) {
      m.hp = Math.max(0, (m.hp || 0) - m.burnPow!);
      cur.log.push({ text: `🔥 Brûlure : ${m.name} perd ${m.burnPow} PV.`, side: 'you' });
    }
    if ((m.burn || 0) > 0) m.burn = (m.burn || 0) - 1;
    if ((m.hp || 0) > 0 && (m.poison || 0) > 0 && (m.poisonPow || 0) > 0) {
      m.hp = Math.max(0, (m.hp || 0) - m.poisonPow!);
      cur.log.push({ text: `🧪 Poison : ${m.name} perd ${m.poisonPow} PV.`, side: 'you' });
    }
    if ((m.poison || 0) > 0) m.poison = (m.poison || 0) - 1;
    if ((m.armorBreak || 0) > 0) m.armorBreak = (m.armorBreak || 0) - 1;

    if (cur.log.length > 40) cur.log = cur.log.slice(cur.log.length - 40);

    if (m.hp <= 0) {
      cur.log.push({ text: `🎉 ${m.name} est vaincu !`, side: 'info' });
      const def = DUNGEONS.find(d => d.id === cur.dungeonId);
      if (def && m.idx + 1 < def.stages.length) {
        const playersArr = Object.values(cur.players);
        const avgLevel = playersArr.reduce((sum, p) => sum + (p.level || 1), 0) / Math.max(1, playersArr.length);
        cur.monster = initMonster(def, m.idx + 1, playersArr.length, avgLevel);
        cur.log.push({ text: `Un nouvel ennemi approche : ${cur.monster.name} !`, side: 'info' });
        cur.turnIdx = 0;
        cur.turnStartAt = Date.now();
        cur.roundCount = 1; // Enrage remis à zéro pour chaque nouvel ennemi (ne s'accumule plus sur tout le donjon).
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
