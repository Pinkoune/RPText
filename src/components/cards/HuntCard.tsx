import { useEffect, useRef, useState } from 'react';
import { item, RARITY_COLOR } from '../../game/items';
import { playSound } from '../../game/sound';
import { useGame } from '../../store/gameStore';
import { deriveStats, removeItem, reduceDurability } from '../../game/player';
import { talentMods } from '../../game/talents';
import { ABILITIES } from '../../game/talents';
import {
  combatTurn,
  grantMonsterRewards,
  applyDeathPenalty,
  type HuntAction,
  type TurnEvent,
  type HuntEncounter,
  type HuntRewards,
} from '../../game/combat';

const POTIONS = ['herb_tea', 'potion', 'hi_potion', 'grilled_fish', 'hearty_stew'];
const ABILITY_TURNS = 5;

type Status = 'fighting' | 'won' | 'lost' | 'fled';

export default function HuntCard({ encounter }: { encounter: HuntEncounter }) {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const m = encounter.monster;

  const [monsterHp, setMonsterHp] = useState(m.hp);
  const [log, setLog] = useState<TurnEvent[]>([]);
  const [status, setStatus] = useState<Status>('fighting');
  const [abilityCd, setAbilityCd] = useState(0);
  const [outcome, setOutcome] = useState<HuntRewards | null>(null);
  const [showPotions, setShowPotions] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  // Réinitialise quand une nouvelle rencontre arrive (relance de hunt).
  useEffect(() => {
    setMonsterHp(m.hp);
    setLog([]);
    setStatus('fighting');
    setAbilityCd(0);
    setOutcome(null);
  }, [encounter.id]);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  if (!p) return null;
  const stats = deriveStats(p);
  const ability = ABILITIES[p.classId];
  const potionId = POTIONS.find((id) => (p.inventory[id] ?? 0) > 0);
  const potionCount = POTIONS.reduce((n, id) => n + (p.inventory[id] ?? 0), 0);

  function act(action: HuntAction, selectedPotionId?: string) {
    if (status !== 'fighting') return;
    const player = useGame.getState().player;
    if (!player) return;
    if (action === 'ability' && abilityCd > 0) return;

    let potHeal = 0;
    let potUse: string | undefined;
    if (action === 'potion') {
      potUse = selectedPotionId;
      if (!potUse) { toast('Aucune potion sélectionnée.', 'bad'); return; }
      potHeal = item(potUse)!.hp ?? 0;
    }

    const s = deriveStats(player);
    const mods = talentMods(player);
    const res = combatTurn(s, mods, { ...m, maxHp: m.hp }, player.hp, monsterHp, action, {
      abilityMult: ability.mult,
      abilityHealFrac: ability.healFrac,
      potionHeal: potHeal,
    });

    let newStatus: Status = 'fighting';
    if (res.fled) newStatus = 'fled';
    else if (res.mhp <= 0) newStatus = 'won';
    else if (res.php <= 0) newStatus = 'lost';

    const captured: { rewards: HuntRewards | null } = { rewards: null };
    mutate((d) => {
      d.hp = res.php;
      if (potUse) removeItem(d, potUse, 1);
      
      // Reduce durability based on hits
      reduceDurability(d, res.hitsTaken, res.hitsDealt);

      if (newStatus === 'won') captured.rewards = grantMonsterRewards(d, m);
      if (newStatus === 'lost') {
        applyDeathPenalty(d);
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
    setAbilityCd((c) => (res.abilityUsed ? ABILITY_TURNS : Math.max(0, c - 1)));
    setStatus(newStatus);

    if (action === 'attack' || action === 'ability') playSound('hit');
    if (newStatus === 'won') {
      setOutcome(captured.rewards);
      if (captured.rewards && captured.rewards.levelsGained > 0) {
        playSound('levelup');
        useGame.getState().celebrateLevelUp();
      } else playSound('win');
    } else if (newStatus === 'lost') playSound('lose');
  }

  const phpPct = Math.max(0, (p.hp / stats.maxHp) * 100);
  const mhpPct = Math.max(0, (monsterHp / m.hp) * 100);
  const fighting = status === 'fighting';

  return (
    <div className="space-y-3">
      {/* HUD */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded-lg bg-black/25 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">⚔️ Toi</span>
            <span className="tabular-nums text-slate-400">{Math.round(p.hp)}/{stats.maxHp}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-black/40">
            <div className={`h-2 rounded transition-all duration-300 ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${phpPct}%` }} />
          </div>
        </div>
        <div className="grid place-items-center text-xs text-slate-500">VS</div>
        <div className="flex-1 rounded-lg bg-black/25 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">{m.emoji} {m.name}</span>
            <span className="tabular-nums text-slate-400">{Math.max(0, Math.round(monsterHp))}/{m.hp}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-black/40">
            <div className="h-2 rounded bg-orange-400 transition-all duration-300" style={{ width: `${mhpPct}%` }} />
          </div>
        </div>
      </div>

      {/* Journal de combat */}
      <div className="h-32 space-y-1 overflow-auto rounded-lg bg-black/30 p-2 text-sm">
        {log.length === 0 && <div className="text-xs text-slate-500">Un {m.name} surgit ! À toi de jouer.</div>}
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
                    <span>{item(id)!.icon} {item(id)!.name}</span>
                    <span className="text-[10px] font-normal text-slate-300">({(p.inventory[id] ?? 0)} en stock)</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="w-full rounded bg-slate-700/50 py-1.5 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <>
              <button onClick={() => act('attack')} className="rounded-lg bg-red-500/40 py-2.5 text-sm font-bold hover:bg-red-500/60">⚔️ Attaquer</button>
              <button
                onClick={() => act('ability')}
                disabled={abilityCd > 0}
                title={ability.desc}
                className="rounded-lg bg-purple-500/40 py-2.5 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40"
              >
                {abilityCd > 0 ? `${ability.icon} ${ability.name} (${abilityCd})` : `${ability.icon} ${ability.name}`}
              </button>
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
                      <span key={i} className="rounded px-2 py-0.5 text-xs" style={{ background: `${RARITY_COLOR[item(id)!.rarity]}22`, color: RARITY_COLOR[item(id)!.rarity] }}>
                        {item(id)!.icon} {item(id)!.name}
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
