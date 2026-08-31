import { useEffect, useRef, useState } from 'react';
import { item, RARITY_COLOR, HP_CONSUMABLES } from '../../game/items';
import { playSound } from '../../game/sound';
import ItemIcon from '../ItemIcon';
import MonsterIcon from '../MonsterIcon';
import { useGame } from '../../store/gameStore';
import { deriveStats, removeItem, reduceDurability } from '../../game/player';
import { talentMods, getAllActiveSkills, classResourceType } from '../../game/talents';
import { activeSetProc } from '../../game/sets';
import { addQuestMetric } from '../../game/quests';
import { sendAutoAnnounce } from '../../firebase/chatService';
import {
  combatTurn,
  grantMonsterRewards,
  applyDeathPenalty,
  freshCombatState,
  INTENT_INFO,
  huntStreakMult,
  HUNT_STREAK_CAP,
  breakHuntStreak,
  getElementMult,
  getDmgTypeMult,
  type CombatState,
  type HuntAction,
  type TurnEvent,
  type HuntEncounter,
  type HuntRewards,
} from '../../game/combat';
import { masteryProgress, biomeKills } from '../../game/mastery';
import { BIOMES } from '../../game/biomes';

import { useUi } from '../../store/uiStore';

const POTIONS = HP_CONSUMABLES;
const RESOURCE_META: Record<string, { label: string; color: string }> = {
  rage: { label: '🔥 Rage', color: 'bg-orange-500' },
  combo: { label: '⚡ Combo', color: 'bg-fuchsia-500' },
  grace: { label: '✨ Grâce', color: 'bg-sky-400' },
  mana: { label: '🔷 Mana', color: 'bg-blue-500' },
  sap: { label: '🌿 Sève', color: 'bg-lime-500' },
  zeal: { label: '🕊️ Ferveur', color: 'bg-amber-400' },
  tempo: { label: '🎵 Tempo', color: 'bg-pink-500' },
  overcharge: { label: '🌌 Surcharge', color: 'bg-indigo-500' },
  instinct: { label: '🎯 Traque', color: 'bg-cyan-400' },
  corruption: { label: '💀 Corruption', color: 'bg-violet-600' },
  vindicte: { label: '🌵 Vindicte', color: 'bg-lime-600' },
  souls: { label: '👻 Âmes', color: 'bg-violet-400' },
  traps: { label: '🪤 Pièges', color: 'bg-orange-600' },
  presage: { label: '🔮 Présage', color: 'bg-cyan-600' },
};

const ABILITY_TURNS = 5;

// Thème d'arène par type de boss (id du monstre synthétisé dans commands.ts).
interface BossTheme { label: string; sub: string; grad: string; ring: string; bar: string; text: string }
const BOSS_THEME: Record<string, BossTheme> = {
  miniboss:   { label: '☠ MINI-BOSS ☠', sub: 'Un colosse surgit des profondeurs.', grad: 'from-fuchsia-900/70 via-purple-800/50 to-indigo-950/70', ring: 'ring-fuchsia-500/50', bar: 'from-fuchsia-600 to-purple-400', text: 'text-fuchsia-200' },
  mercenaire: { label: '🎯 CONTRAT MERCENAIRE', sub: 'Élimine la cible pour toucher la prime.', grad: 'from-amber-900/70 via-red-800/50 to-rose-950/70', ring: 'ring-amber-500/50', bar: 'from-amber-500 to-red-400', text: 'text-amber-200' },
  sanctuaire: { label: '🏛️ ÉPREUVE DU SANCTUAIRE', sub: 'Le Gardien des Anciens juge ta valeur.', grad: 'from-yellow-800/60 via-amber-700/40 to-yellow-950/70', ring: 'ring-yellow-400/50', bar: 'from-yellow-300 to-amber-400', text: 'text-yellow-200' },
  default:    { label: '☠ COMBAT DE BOSS ☠', sub: 'Un adversaire redoutable te défie.', grad: 'from-rose-900/60 via-red-800/40 to-amber-900/50', ring: 'ring-rose-500/50', bar: 'from-rose-600 to-red-400', text: 'text-rose-200' },
};

type Status = 'fighting' | 'won' | 'lost' | 'fled';

/** Nombre volant au-dessus d'une barre de PV. `side` désigne la barre visée. */
interface Floater {
  id: number;
  side: 'you' | 'enemy';
  text: string;
  color: string;
  big?: boolean;
}

/**
 * Nombres volants au-dessus d'une barre de PV.
 *
 * Plusieurs peuvent partir du même tour (dégâts + parade + riposte) : ils sont
 * décalés en X ET dans le temps, sinon ils se superposent et deviennent
 * illisibles au moment précis où ils devraient informer.
 */
function Floaters({ items }: { items: Floater[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 h-0">
      {items.map((f, i) => (
        <span
          key={f.id}
          className={`hit-float absolute left-1/2 whitespace-nowrap font-black tabular-nums drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] ${f.big ? 'text-xl' : 'text-base'}`}
          style={{
            color: f.color,
            animationDelay: `${i * 130}ms`,
            marginLeft: `${(i - (items.length - 1) / 2) * 46}px`,
          }}
        >
          {f.text}
        </span>
      ))}
    </div>
  );
}

export default function HuntCard({ encounter }: { encounter: HuntEncounter }) {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const m = encounter.monster;

  const [monsterHp, setMonsterHp] = useState(m.hp);
  const [log, setLog] = useState<TurnEvent[]>([]);
  const [status, setStatus] = useState<Status>('fighting');
  const [skillCds, setSkillCds] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<HuntRewards | null>(null);
  const [showPotions, setShowPotions] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const [bonusAtk, setBonusAtk] = useState(0);
  const [bonusMaxHp, setBonusMaxHp] = useState(0);
  const [combatHits, setCombatHits] = useState(0);
  const [cstate, setCstate] = useState<CombatState>(freshCombatState());
  const [resourcePool, setResourcePool] = useState(0);
  const lastActionType = useRef<string | null>(null);

  // ── Punch visuel ──
  // `fx` du tour → nombres qui s'envolent, secousse, voile coloré. Purement
  // décoratif : le journal reste la source de vérité, ces états n'influencent
  // jamais le combat.
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [jolt, setJolt] = useState(false);
  const [punch, setPunch] = useState(false);
  const floaterId = useRef(0);

  function pushFloaters(items: Omit<Floater, 'id'>[]) {
    if (items.length === 0) return;
    const withIds = items.map((f) => ({ ...f, id: ++floaterId.current }));
    setFloaters((cur) => [...cur, ...withIds]);
    const ids = new Set(withIds.map((f) => f.id));
    setTimeout(() => setFloaters((cur) => cur.filter((f) => !ids.has(f.id))), 1000);
  }

  // Réinitialise quand une nouvelle rencontre arrive (relance de hunt).
  useEffect(() => {
    setMonsterHp(m.hp);
    setLog([]);
    setStatus('fighting');
    setResourcePool(0);
    lastActionType.current = null;

    const pl = useGame.getState().player;
    if (pl && Date.now() - (pl.lastCombatAt ?? 0) < 60000) {
      setSkillCds(pl.combatCooldowns ?? {});
    } else {
      setSkillCds({});
    }

    setOutcome(null);
    setBonusAtk(0);
    setBonusMaxHp(0);
    setCombatHits(0);
    setCstate(freshCombatState());
  }, [encounter.id]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  // En-tête de fenêtre thématisé pour les combats de boss.
  useEffect(() => {
    const t = encounter.isMiniboss ? (BOSS_THEME[encounter.monster.id] ?? BOSS_THEME.default) : null;
    if (t) useUi.getState().setChrome('hunt', { title: `${encounter.monster.emoji} ${encounter.monster.name}`, accent: '#f87171' });
    return () => useUi.getState().setChrome('hunt', {});
  }, [encounter.id]);

  useEffect(() => {
    const isFighting = status === 'fighting';
    setTimeout(() => useGame.getState().setInCombat(isFighting), 0);
    return () => { setTimeout(() => useGame.getState().setInCombat(false), 0); };
  }, [status]);

  if (!p) return null;
  const stats = deriveStats(p);
  const setProc = activeSetProc(p);
  const activeSkills = getAllActiveSkills().filter(s => p.equippedSkills.includes(s.id));
  const potionId = POTIONS.find((id) => (p.inventory[id] ?? 0) > 0);
  const potionCount = POTIONS.reduce((n, id) => n + (p.inventory[id] ?? 0), 0);
  const resourceType = classResourceType(p.classId);
  const resourceMax = resourceType === 'combo' ? 5 : 100;

  function act(action: HuntAction, selectedPotionId?: string) {
    if (status !== 'fighting') return;
    const player = useGame.getState().player;
    if (!player) return;

    // (Détection anti-macro retirée : elle bloquait le spam-clic légitime.)

    let skill = undefined;
    if (action !== 'attack' && action !== 'potion' && action !== 'flee') {
      skill = activeSkills.find(s => s.id === action);
      if (skill && (skillCds[skill.id] || 0) > 0) return;
      if (skill?.resource && resourcePool < skill.resource.cost) {
        const label = RESOURCE_META[skill.resource.type]?.label.split(' ')[1] ?? 'Ressource';
        toast(`Pas assez de ${label} (${resourcePool}/${skill.resource.cost} requis).`, 'bad');
        return;
      }
    }

    let potHeal = 0;
    let potUse: string | undefined;
    if (action === 'potion') {
      potUse = selectedPotionId;
      if (!potUse) { toast('Aucune potion sélectionnée.', 'bad'); return; }
      potHeal = item(potUse)!.hp ?? 0;
    }

    const s = deriveStats(player);
    s.atk += bonusAtk;
    s.maxHp += bonusMaxHp;
    const mods = talentMods(player);
    const res = combatTurn(s, mods, { ...m, maxHp: m.hp }, player.hp, monsterHp, action, {
      activeSkill: skill,
      potionHeal: potHeal,
      setProc: setProc ?? undefined,
      resourceAmount: resourcePool,
      resourceType,
    }, { ...cstate });

    // Tempo (Barde) et Surcharge (Arcaniste) : calculés ici plutôt que dans
    // combat.ts, car ils dépendent de signaux hors de la portée d'un seul tour
    // pur (variété d'action d'un tour à l'autre, nombre de compétences lancées).
    let resourceGained = res.resourceGained;
    if (resourceType === 'tempo' && action !== 'flee') {
      resourceGained = lastActionType.current !== null && lastActionType.current !== action ? 30 : 0;
    } else if (resourceType === 'overcharge' && res.abilityUsed) {
      resourceGained = 25;
    }
    if (action !== 'flee') lastActionType.current = action;

    const newResourcePool = Math.max(0, Math.min(resourceMax, resourcePool - res.resourceSpent + resourceGained));

    let newBonusAtk = bonusAtk;
    let newBonusMaxHp = bonusMaxHp;
    let newCombatHits = combatHits + res.hitsDealt;

    if (s.trinketId === 'heartsteel') {
      const triggersBefore = Math.floor(combatHits / 3);
      const triggersAfter = Math.floor(newCombatHits / 3);
      const diff = triggersAfter - triggersBefore;
      if (diff > 0) {
        newBonusAtk += diff * 3;
        newBonusMaxHp += diff * 20;
        res.php += diff * 20; // Heal by the same amount
        res.events.push({ text: `💥 Coeuracier proc ! (+${diff * 3} ATK, +${diff * 20} PV max)`, side: 'you' });
      }
    }

    // Barde : Crescendo buff l'ATK pour le reste du combat (solo = juste soi).
    if (res.abilityUsed && skill?.teamAtkBuff) {
      newBonusAtk += Math.round(s.atk * skill.teamAtkBuff);
    }

    let newStatus: Status = 'fighting';
    let lostStreak = 0;
    if (res.fled) newStatus = 'fled';
    else if (res.mhp <= 0) newStatus = 'won';
    else if (res.php <= 0) newStatus = 'lost';

    const captured: { rewards: HuntRewards | null } = { rewards: null };
    mutate((d) => {
      d.hp = res.php;
      if (potUse) removeItem(d, potUse, 1);
      if (res.goldStolen) d.gold += res.goldStolen;

      // Reduce durability based on hits
      reduceDurability(d, res.hitsTaken, res.hitsDealt);

      if (newStatus === 'won') {
        captured.rewards = grantMonsterRewards(d, m);
        // Tracking mini-boss
        if (encounter.isMiniboss) {
          const prev = (d as any).minibossKills ?? 0;
          (d as any).minibossKills = prev + 1;
          addQuestMetric(d, 'minibossKills', 1);
          if (prev === 0) {
            sendAutoAnnounce(`🐹 ${d.name} vient de vaincre le Colosse des Abysses pour la première fois !`);
          }
        }
      }
      if (newStatus === 'lost') {
        applyDeathPenalty(d);
        // La série de chasse ne survit pas à la mort : c'est tout l'enjeu du
        // « je continue ou je vais me soigner » quand elle est haute.
        lostStreak = breakHuntStreak(d);
        if (encounter.isAdventure && d.cooldowns.adventure) {
          d.cooldowns.adventure = Date.now() - 10 * 60 * 1000; // CD devient 5 min
        }
      }
      if (newStatus === 'fled') {
        if (encounter.isAdventure && d.cooldowns.adventure) {
          d.cooldowns.adventure = Date.now() - 5 * 60 * 1000; // CD devient 10 min
        }
      }
    });

    setMonsterHp(res.mhp);
    setLog((l) => [...l, ...res.events].slice(-40));
    const nextCds = { ...skillCds };
    for (const id in nextCds) nextCds[id] = Math.max(0, nextCds[id] - 1);
    if (res.abilityUsed && skill) {
      nextCds[skill.id] = Math.ceil(skill.cooldownMs / 5000); // 1 turn = ~5s
    }
    // Arcaniste : Distorsion accélère aussi les autres compétences.
    if (res.abilityUsed && skill?.haste) {
      for (const id in nextCds) {
        if (id !== skill!.id) nextCds[id] = Math.max(0, nextCds[id] - skill!.haste!);
      }
    }
    setSkillCds(nextCds);
    mutate((d) => {
      d.combatCooldowns = nextCds;
      d.lastCombatAt = Date.now();
    });
    setStatus(newStatus);
    setBonusAtk(newBonusAtk);
    setBonusMaxHp(newBonusMaxHp);
    setCombatHits(newCombatHits);
    setCstate(res.state);
    setResourcePool(newResourcePool);

    // ── Retour visuel du tour ──
    const fx = res.fx;
    const flying: Omit<Floater, 'id'>[] = [];
    if (fx.dealt > 0) {
      flying.push({
        side: 'enemy',
        text: `-${fx.dealt}${fx.crit ? ' CRIT !' : ''}`,
        color: fx.crit ? '#fbbf24' : '#fca5a5',
        big: fx.crit || fx.dealt > monsterHp * 0.25,
      });
      setPunch(false); setTimeout(() => setPunch(true), 0); setTimeout(() => setPunch(false), 400);
    }
    if (fx.interrupted) flying.push({ side: 'enemy', text: 'INTERROMPU', color: '#fbbf24' });
    if (fx.parried > 0) flying.push({ side: 'you', text: `paré -${fx.parried}`, color: '#7dd3fc' });
    if (fx.taken > 0) {
      flying.push({
        side: 'you',
        text: `-${fx.taken}`,
        color: fx.heavy || fx.exposed ? '#fb7185' : '#f8a4b4',
        big: fx.heavy || fx.exposed,
      });
    }
    pushFloaters(flying);
    if (fx.heavy || fx.exposed) { setJolt(true); setTimeout(() => setJolt(false), 470); }
    const flashColor = fx.exposed
      ? 'rgba(244,63,94,0.85)'
      : fx.interrupted
        ? 'rgba(251,191,36,0.8)'
        : fx.parried > 0
          ? 'rgba(56,189,248,0.75)'
          : fx.heavy
            ? 'rgba(244,63,94,0.7)'
            : null;
    if (flashColor) {
      setFlash(flashColor);
      setTimeout(() => setFlash(null), 500);
    }

    if (action === 'attack' || action === 'ability') playSound('hit');
    if (action === 'parry' || action === 'interrupt') playSound('hit');
    if (newStatus === 'won') {
      setOutcome(captured.rewards);
      if (captured.rewards?.masteryUp) {
        const mu = captured.rewards.masteryUp;
        toast(`🏅 Maîtrise ${BIOMES[mu.biome as keyof typeof BIOMES]?.name ?? mu.biome} : palier atteint ! Titre « ${mu.title} » débloqué.`, 'gold');
      }
      if (captured.rewards && captured.rewards.levelsGained > 0) {
        playSound('levelup');
        useGame.getState().celebrateLevelUp();
      } else playSound('win');
    } else if (newStatus === 'lost') {
      playSound('lose');
      if (lostStreak >= 3) toast(`💔 Série de ${lostStreak} kills perdue.`, 'bad');
    }
  }

  const phpPct = Math.max(0, (p.hp / stats.maxHp) * 100);
  const mhpPct = Math.max(0, (monsterHp / m.hp) * 100);
  const fighting = status === 'fighting';
  const boss = !!encounter.isMiniboss;
  const theme = boss ? (BOSS_THEME[m.id] ?? BOSS_THEME.default) : null;
  const statusBadges = (
    <>
      {cstate.burn > 0 && <span title={`Brûlure (${cstate.burn})`}>🔥{cstate.burn}</span>}
      {cstate.poison > 0 && <span title={`Poison (${cstate.poison})`}>🧪{cstate.poison}</span>}
      {cstate.chill > 0 && <span title={`Gelé (${cstate.chill})`}>❄️{cstate.chill}</span>}
    </>
  );
  // Efficacité de l'arme vs ce monstre (élément + type de dégâts) — rend le
  // système phys/mag lisible : le joueur voit s'il tape fort/faible AVANT d'agir.
  const effMultVsMonster = getElementMult(stats.weaponElement, (m as any).element) * getDmgTypeMult(stats.weaponDmgType, m);
  const effBadge = effMultVsMonster >= 1.15
    ? { txt: '🟢 Arme efficace', cls: 'bg-emerald-500/20 text-emerald-200', tip: `×${effMultVsMonster.toFixed(2)} dégâts` }
    : effMultVsMonster <= 0.85
      ? { txt: '🔴 Arme peu efficace', cls: 'bg-rose-500/20 text-rose-200', tip: `×${effMultVsMonster.toFixed(2)} dégâts — change d'arme/élément ?` }
      : { txt: '⚪ Arme neutre', cls: 'bg-white/10 text-slate-300', tip: `×${effMultVsMonster.toFixed(2)} dégâts` };
  // « Faille » : le monstre est sous contrôle → prochains coups amplifiés.
  const vulnActive = cstate.chill > 0 || cstate.stun > 0;
  const intent = cstate.intent;
  // Maîtrise du biome courant (progression vers le palier suivant).
  const mastery = masteryProgress(biomeKills(p, p.biome));

  return (
    <div className={`relative space-y-3 ${jolt ? 'hit-jolt' : ''}`}>
      {/* Voile coloré du tour : bleu = parade, ambre = interruption réussie,
          rouge = coup pris de plein fouet. */}
      {flash && (
        <div
          className="hit-flash pointer-events-none absolute -inset-3 z-20 rounded-2xl"
          style={{ background: `radial-gradient(ellipse at center, transparent 35%, ${flash} 100%)` }}
        />
      )}
      {theme ? (
        <>
          {/* Arène de boss (dédiée, thématisée) */}
          <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${theme.grad} p-4 text-center ring-1 ${theme.ring}`}>
            <div className={`animate-pulse text-[11px] font-black uppercase tracking-[0.28em] ${theme.text}`}>{theme.label}</div>
            <div className="relative mt-2 grid place-items-center">
              <Floaters items={floaters.filter((f) => f.side === 'enemy')} />
              <div className={`grid h-20 w-20 place-items-center rounded-full bg-black/40 text-5xl ring-2 ${theme.ring} ${punch ? 'hit-punch' : phpPct > 0 && fighting ? 'animate-pulseGlow' : ''}`}>
                {m.emoji}
              </div>
            </div>
            <div className="mt-2 text-lg font-extrabold text-white drop-shadow">{m.name}</div>
            <div className="text-[11px] italic text-white/70">{theme.sub}</div>

            {/* Barre de PV du boss (grande, thématisée) */}
            <div className="mx-auto mt-3 max-w-xs">
              <div className="mb-1 flex items-center justify-between text-[11px] text-white/80">
                <span className="inline-flex items-center gap-1.5">PV du boss {statusBadges}</span>
                <span className="tabular-nums">{Math.max(0, Math.round(monsterHp)).toLocaleString()} / {m.hp.toLocaleString()}</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                <div className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-300`} style={{ width: `${mhpPct}%` }} />
              </div>
            </div>
          </div>

          {/* Barre du joueur (pleine largeur sous l'arène) */}
          <div className="relative rounded-lg bg-black/25 p-2">
            <Floaters items={floaters.filter((f) => f.side === 'you')} />
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">
                ⚔️ Toi
                {cstate.shield > 0 && <span className="ml-1 text-sky-300">🛡️{cstate.shield}</span>}
                {setProc && <span className="ml-1" style={{ color: setProc.color }} title={setProc.name}>{setProc.icon}</span>}
              </span>
              <span className="tabular-nums text-slate-400">{Math.round(p.hp)}/{stats.maxHp}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-black/40">
              <div className={`h-2 rounded transition-all duration-300 ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-400'} ${phpPct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${phpPct}%` }} />
            </div>
            {resourceType && (
              <>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span>{RESOURCE_META[resourceType]?.label}</span>
                  <span className="tabular-nums text-slate-400">{resourcePool}/{resourceMax}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-black/40">
                  <div className={`h-1.5 rounded transition-all duration-300 ${RESOURCE_META[resourceType]?.color}`} style={{ width: `${(resourcePool / resourceMax) * 100}%` }} />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* HUD classique de chasse */
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1 rounded-lg bg-black/25 p-2">
            <Floaters items={floaters.filter((f) => f.side === 'you')} />
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">
                ⚔️ Toi
                {cstate.shield > 0 && <span className="ml-1 text-sky-300">🛡️{cstate.shield}</span>}
                {setProc && <span className="ml-1" title={`Set actif : ${setProc.name} (${Math.round(setProc.chance * 100)}%/attaque)`} style={{ color: setProc.color }}>{setProc.icon}</span>}
              </span>
              <span className="tabular-nums text-slate-400">{Math.round(p.hp)}/{stats.maxHp}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-black/40">
              <div className={`h-2 rounded transition-all duration-300 ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-400'} ${phpPct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${phpPct}%` }} />
            </div>
            {resourceType && (
              <>
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span>{RESOURCE_META[resourceType]?.label}</span>
                  <span className="tabular-nums text-slate-400">{resourcePool}/{resourceMax}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-black/40">
                  <div className={`h-1.5 rounded transition-all duration-300 ${RESOURCE_META[resourceType]?.color}`} style={{ width: `${(resourcePool / resourceMax) * 100}%` }} />
                </div>
              </>
            )}
          </div>
          <div className="grid place-items-center text-xs text-slate-500">VS</div>
          <div className="relative flex-1 rounded-lg bg-black/25 p-2">
            <Floaters items={floaters.filter((f) => f.side === 'enemy')} />
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-semibold">
                <span className={punch ? 'hit-punch inline-flex' : 'inline-flex'}>
                  <MonsterIcon id={m.id} emoji={m.emoji} size={16} title={m.name} />
                </span> {m.name} {statusBadges}
              </span>
              <span className="tabular-nums text-slate-400">{Math.max(0, Math.round(monsterHp))}/{m.hp}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-black/40">
              <div className="h-2 rounded bg-orange-400 transition-all duration-300" style={{ width: `${mhpPct}%` }} />
            </div>
            {/* Télégraphe : ce que le monstre prépare. Logé sous SA barre plutôt
                qu'en bandeau séparé — c'est son information, pas la tienne. */}
            {intent && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: INTENT_INFO[intent].color }}>
                <span className={intent === 'heavy' ? 'animate-pulse' : ''}>{INTENT_INFO[intent].icon}</span>
                {INTENT_INFO[intent].label}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Une seule ligne d'état : série, arme, faille, maîtrise. Trois bandeaux
          séparés surchargeaient l'écran pour une information de coin d'œil. */}
      {fighting && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {(p.huntStreak ?? 0) > 0 && (
            <span
              className="font-bold"
              style={{ color: '#e2913f' }}
              title={`Série de ${p.huntStreak} kills sans mourir — XP et or multipliés (+${Math.round((huntStreakMult(p) - 1) * 100)}%). Perdue à la mort.`}
            >
              🔥 ×{p.huntStreak}{(p.huntStreak ?? 0) >= HUNT_STREAK_CAP ? ' MAX' : ''}
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 ${effBadge.cls}`} title={effBadge.tip}>{effBadge.txt}</span>
          {vulnActive && <span className="rounded bg-amber-400 px-1.5 py-0.5 font-bold text-black animate-pulse" title="Monstre sous contrôle : tes coups infligent +50% de dégâts">⚡ FAILLE</span>}
          <span className="ml-auto inline-flex items-center gap-1.5 text-slate-500" title={mastery.next ? `${mastery.into}/${mastery.need} vers le palier suivant` : 'Maîtrise maximale'}>
            🏅 {mastery.label}
            {mastery.bonus > 0 && <span className="text-emerald-300">+{Math.round(mastery.bonus * 100)}%</span>}
            {mastery.next != null && (
              <span className="inline-block h-1.5 w-10 overflow-hidden rounded bg-black/40 align-middle">
                <span className="block h-full rounded bg-amber-400" style={{ width: `${Math.min(100, (mastery.into / mastery.need) * 100)}%` }} />
              </span>
            )}
          </span>
        </div>
      )}

      {/* Journal de combat */}
      <div className="h-32 space-y-1 overflow-auto rounded-lg bg-black/30 p-2 text-sm">
        {log.length === 0 && <div className="text-xs text-slate-500">{boss ? `${m.name} se dresse devant toi. Prépare-toi à un combat acharné !` : `Un ${m.name} surgit ! À toi de jouer.`}</div>}
        {log.map((e, i) => (
          <div key={i} className={e.side === 'you' ? 'text-sky-300' : e.side === 'enemy' ? 'text-rose-300' : 'text-slate-400'}>
            {e.text}
          </div>
        ))}
        <div ref={logEnd} />
      </div>

      {/* Actions */}
      {fighting ? (
        <div className="grid grid-cols-2 gap-2">
          {showPotions ? (
            <div className="col-span-2 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Choisir un soin :</div>
              <div className="grid grid-cols-2 gap-2">
                {POTIONS.filter(id => (p.inventory[id] ?? 0) > 0).map(id => (
                  <button
                    key={id}
                    onClick={() => { setShowPotions(false); act('potion', id); }}
                    className="rounded-lg bg-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-500/50 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="inline-flex items-center gap-1"><ItemIcon id={id} size={16} /> {item(id)!.name}</span>
                    <span className="text-[10px] font-normal text-slate-300">({(p.inventory[id] ?? 0)} en stock)</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <>
              <button onClick={() => act('attack')} className="col-span-2 rounded-lg bg-red-500/40 py-2.5 text-sm font-bold hover:bg-red-500/60">⚔️ Attaquer</button>
              {/* Réponses au télégraphe. Chacune porte SON effet en sous-titre :
                  sans ça les deux se ressemblaient, et rien ne disait que
                  l'interruption est un pari (elle punit si le monstre ne
                  préparait rien) là où la parade ne peut jamais mal tourner.
                  La parade s'allume sur un coup lourd (gros blocage = grosse
                  riposte), l'interruption sur tout ce qui est annoncé. */}
              <button
                onClick={() => act('parry')}
                title="Tu ne frappes pas, tu n'encaisses qu'un quart des dégâts et tu renvoies 70% de ce que tu as bloqué. Sans risque."
                className={`col-span-1 flex flex-col items-center rounded-lg py-1.5 leading-tight transition ${intent === 'heavy' ? 'bg-sky-500/60 text-white ring-1 ring-sky-300 hover:bg-sky-500/80' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                <span className="text-xs font-semibold">🛡️ Parer</span>
                <span className="text-[9px] opacity-70">encaisse ¼ · riposte</span>
              </button>
              <button
                onClick={() => act('interrupt')}
                title="Annule le coup annoncé et étourdit (ouvre la Faille). Mais s'il ne préparait rien, tu te découvres et prends 50% de dégâts en plus."
                className={`col-span-1 flex flex-col items-center rounded-lg py-1.5 leading-tight transition ${intent === 'heavy' || intent === 'special' ? 'bg-amber-500/60 text-white ring-1 ring-amber-300 hover:bg-amber-500/80' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                <span className="text-xs font-semibold">⚡ Interrompre</span>
                <span className="text-[9px] opacity-70">annule · risqué</span>
              </button>
              {activeSkills.map(skill => {
                const onCd = (skillCds[skill.id] || 0) > 0;
                const lacksResource = !!skill.resource && resourcePool < skill.resource.cost;
                let label = `${skill.icon} ${skill.name}`;
                if (onCd) label += ` (${skillCds[skill.id]})`;
                else if (skill.resource) label += ` (${RESOURCE_META[skill.resource.type]?.label.split(' ')[0]}${skill.resource.cost})`;
                return (
                  <button
                    key={skill.id}
                    onClick={() => act(skill.id)}
                    disabled={onCd || lacksResource}
                    title={skill.desc}
                    className="col-span-1 rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40"
                  >
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  const available = POTIONS.filter(id => (p.inventory[id] ?? 0) > 0);
                  if (available.length === 1) {
                    act('potion', available[0]);
                  } else {
                    setShowPotions(true);
                  }
                }}
                disabled={potionCount <= 0}
                className="rounded-lg bg-emerald-500/30 py-2.5 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40"
              >
                🧪 Potion ({potionCount})
              </button>
              <button onClick={() => act('flee')} className="rounded-lg bg-slate-500/30 py-2.5 text-sm font-bold hover:bg-slate-500/50">🏃 Fuir</button>
              {activeSkills.length === 0 && (
                <button
                  onClick={() => useUi.getState().open('talents', undefined, { singleton: true })}
                  className="col-span-2 rounded-lg border border-dashed border-white/15 py-1.5 text-[11px] text-slate-500 hover:border-sky-400/40 hover:text-sky-300"
                >
                  Aucune compétence équipée — ouvrir l'arbre de talents
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="animate-floatIn space-y-2">
          {status === 'won' && outcome && (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 p-3">
              <div className="font-bold text-emerald-300">Victoire ! 🎉</div>
              <div className="mt-1 text-sm">
                +{outcome.xp} XP · +{outcome.gold} 🪙
                {outcome.levelsGained > 0 && <span className="ml-2 font-bold text-amber-300">⬆ Niveau +{outcome.levelsGained} !</span>}
              </div>
              {outcome.loot.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {outcome.loot.map((id, i) =>
                    id === '__fate' ? (
                      <span key={i} className="rounded bg-purple-500/25 px-2 py-0.5 text-xs">🎲 +1 Fate Coin</span>
                    ) : (
                      <span key={i} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs" style={{ background: `${RARITY_COLOR[item(id)!.rarity]}22`, color: RARITY_COLOR[item(id)!.rarity] }}>
                        <ItemIcon id={id} size={14} /> {item(id)!.name}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
          {status === 'lost' && (
            <div className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-3 text-sm">
              <div className="font-bold text-rose-300">Défaite… 💀</div>
              <div className="mt-1 text-slate-300">Tu perds 10% de ton or et reviens à 30% PV. Soigne-toi avant de repartir.</div>
            </div>
          )}
          {status === 'fled' && (
            <div className="rounded-lg border border-slate-400/40 bg-slate-500/15 p-3 text-sm text-slate-300">Tu as fui le combat. Aucune récompense.</div>
          )}
          <div className="text-center text-xs text-slate-500">Tape « hunt » ou « adventure » pour repartir.</div>
        </div>
      )}
    </div>
  );
}
