import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { combatTurn, freshCombatState, type CombatState } from '../../game/combat';
import { deriveStats } from '../../game/player';
import { talentMods, getAllActiveSkills } from '../../game/talents';
import { computeAscensionBoss, ascensionOutcome, applyAscensionResult, type AscensionBoss } from '../../game/ascension';
import { item, HP_CONSUMABLES } from '../../game/items';
import { playSound, stopAmbientMusic, setAmbient } from '../../game/sound';
import { currentPhase } from '../../game/daynight';
import ItemIcon from '../ItemIcon';

type Transition = 'enter' | 'none' | 'win' | 'dead';

const POTIONS = HP_CONSUMABLES;

type Phase = 'intro' | 'confirm' | 'fight' | 'result';

interface FightState {
  boss: AscensionBoss;
  combat: CombatState;
  php: number;
  bhp: number;
  logs: string[];
  skillCds: Record<string, number>;
}

// NOTE (workstream B / feel) : cette carte est FONCTIONNELLE mais volontairement
// sobre. À polir : plein écran noir sans interface (masquer Topbar+dock), gros
// trou noir animé au centre avec la barre de vie violette du boss dessous, barre
// PV joueur + compétences tout en bas, ambiance sonore, tremblement renforcé.
export default function AscensionCard() {
  const { player, mutate, toast } = useGame();
  const closeWindow = useUi((s) => s.close);
  const [phase, setPhase] = useState<Phase>('intro');
  const [fs, setFs] = useState<FightState | null>(null);
  const [result, setResult] = useState<{ won: boolean; message: string; levelsLost?: number } | null>(null);
  const [showPotions, setShowPotions] = useState(false);
  const [transition, setTransition] = useState<Transition>('none');
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useGame.getState().setInCombat(phase === 'fight');
    return () => useGame.getState().setInCombat(false);
  }, [phase]);

  // Ambiance : silence total pendant le rituel, restauré à la sortie.
  useEffect(() => {
    if (phase === 'fight') {
      stopAmbientMusic();
      setTransition('enter');
      const t = setTimeout(() => setTransition('none'), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);
  useEffect(() => () => { if (player) setAmbient(currentPhase(), player.biome); }, []);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [fs?.logs]);

  if (!player) return null;
  const stats = deriveStats(player);
  const mods = talentMods(player);
  const skills = getAllActiveSkills().filter((s) => player.equippedSkills.includes(s.id));

  function begin() {
    const boss = computeAscensionBoss(player!);
    setFs({ boss, combat: freshCombatState(), php: player!.hp, bhp: boss.hp, logs: ['Le Néant Originel émerge des ténèbres...'], skillCds: {} });
    setPhase('fight');
    playSound('lose');
  }

  function finish(won: boolean, bhpFraction: number) {
    const res = ascensionOutcome(bhpFraction, won);
    mutate((d) => applyAscensionResult(d, res));
    setResult({ won: res.won, message: res.message, levelsLost: res.won ? undefined : res.levelsLost });
    playSound(won ? 'levelup' : 'lose');
    if (won) useGame.getState().celebrateLevelUp();
    // Transition immersive (flash violet/blanc en victoire, aspiration rouge en mort)
    // avant de basculer sur l'écran de résultat.
    setTransition(won ? 'win' : 'dead');
    setTimeout(() => setPhase('result'), 1400);
  }

  function act(action: 'attack' | 'potion' | string, potionHeal?: number, potionId?: string) {
    if (!fs) return;
    let skill = undefined;
    if (action !== 'attack' && action !== 'potion') {
      skill = getAllActiveSkills().find((s) => s.id === action);
      if (skill && (fs.skillCds[skill.id] || 0) > 0) return;
    }
    const monster = { ...fs.boss, hp: fs.bhp };
    const res = combatTurn(stats, mods, monster, fs.php, fs.bhp, action, { potionHeal: action === 'potion' ? potionHeal : 0, activeSkill: skill }, fs.combat);
    if (action === 'potion' && potionId) mutate((d) => { d.inventory[potionId]--; });

    const logs = [...fs.logs, ...res.events.map((l) => l.text)];
    if (logs.length > 12) logs.splice(0, logs.length - 12);
    const nextCds = { ...fs.skillCds };
    for (const id in nextCds) nextCds[id] = Math.max(0, nextCds[id] - 1);
    if (res.abilityUsed && skill) nextCds[skill.id] = Math.ceil(skill.cooldownMs / 5000);

    if (res.mhp <= 0) { setFs({ ...fs, php: res.php, bhp: 0, combat: res.state, logs, skillCds: nextCds }); finish(true, 0); return; }
    if (res.php <= 0) { setFs({ ...fs, php: 0, bhp: res.mhp, combat: res.state, logs, skillCds: nextCds }); finish(false, res.mhp / fs.boss.maxHp); return; }
    setFs({ ...fs, php: res.php, bhp: res.mhp, combat: res.state, logs, skillCds: nextCds });
  }

  // ── Intro ──
  if (phase === 'intro') {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">🕳️</div>
        <p className="text-sm leading-relaxed text-slate-300">
          Tu te tiens au bord du <b className="text-purple-300">Néant Originel</b>, le pire ennemi de l'humanité.
          Il ne cède qu'aux âmes <b>parfaitement préparées</b> : tout ton potentiel doit être atteint.
        </p>
        <p className="text-xs text-rose-300/80">
          Si tu échoues, le Néant t'arrachera des années de vie (jusqu'à <b>3 niveaux</b>) et se refermera pour un temps.
          Si tu triomphes... tu renaîtras au commencement, marqué à jamais du <b className="text-amber-300">Prestige</b>.
        </p>
        <button onClick={() => setPhase('confirm')} className="w-full rounded-xl bg-purple-900/70 py-3 text-sm font-bold text-purple-100 ring-1 ring-purple-500/50 hover:bg-purple-800/70">
          Affronter le mal
        </button>
      </div>
    );
  }

  // ── Confirmation (bouton tremblant) ──
  if (phase === 'confirm') {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-sm text-slate-300">Es-tu <b>vraiment</b> sûr ? Il n'y a pas de retour en arrière une fois le regard du Néant posé sur toi.</p>
        <button onClick={begin} className="animate-shake-hard asc-danger-glow w-full rounded-xl bg-rose-900/80 py-4 text-lg font-black uppercase tracking-widest text-rose-100 ring-1 ring-rose-500/70 hover:bg-rose-800/80">
          Je suis paré !
        </button>
        <button onClick={() => setPhase('intro')} className="text-xs text-slate-500 hover:text-slate-300">Reculer</button>
      </div>
    );
  }

  // ── Résultat ──
  if (phase === 'result' && result) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">{result.won ? '🌅' : '🕳️'}</div>
        <div className={`text-lg font-bold ${result.won ? 'text-amber-300' : 'text-purple-300'}`}>
          {result.won ? 'PRESTIGE ATTEINT' : 'Le Néant te rejette'}
        </div>
        <p className="text-sm text-slate-300">{result.message}</p>
        {!result.won && (result.levelsLost ?? 0) > 0 && (
          <p className="text-xs text-rose-300">-{result.levelsLost} niveau(x). Reviens plus fort.</p>
        )}
        {result.won && <p className="text-xs text-amber-200/80">Tu renais au niveau 1 avec un bonus permanent de prestige. Ta collection de familiers est conservée. 🎫 Un <b>jeton de changement de classe</b> t'attend dans ton <b>Profil</b>.</p>}
        <button onClick={() => { const w = useUi.getState().windows.find((x) => x.kind === 'ascension'); if (w) closeWindow(w.id); }} className="w-full rounded-lg bg-white/10 py-2 text-sm hover:bg-white/20">
          Fermer
        </button>
      </div>
    );
  }

  // ── Combat : overlay plein écran (au-dessus de toute l'UI) ──
  if (!fs) return null;
  const bhpPct = Math.max(0, (fs.bhp / fs.boss.maxHp) * 100);
  const phpPct = Math.max(0, (fs.php / stats.maxHp) * 100);
  const potionCount = POTIONS.reduce((n, id) => n + (player.inventory[id] ?? 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-slate-100" style={{ background: '#05030a' }}>
      {/* Voile noir d'entrée qui s'estompe */}
      {transition === 'enter' && <div className="asc-fadein pointer-events-none absolute inset-0 z-30 bg-black" />}

      {/* Scène : trou noir + barre du boss */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5">
        {/* Trou noir des Abysses */}
        <div className="relative grid h-56 w-56 place-items-center sm:h-72 sm:w-72">
          <div
            className="asc-blackhole absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, #02000a 34%, #2e1065 64%, transparent 82%)', boxShadow: '0 0 90px 30px rgba(88,28,135,0.55)' }}
          />
          <div className="asc-ring absolute inset-4 rounded-full border border-purple-500/25" />
          <div className="asc-ring absolute inset-10 rounded-full border border-fuchsia-400/15" style={{ animationDirection: 'reverse', animationDuration: '32s' }} />
        </div>

        <div className="mt-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-purple-300/70">Le Néant Originel</div>
          <div className="mt-0.5 text-lg font-extrabold text-purple-100">{fs.boss.name}</div>
        </div>

        {/* Barre de vie violette du boss (grande, centrée) */}
        <div className="mt-3 w-full max-w-md">
          <div className="h-4 overflow-hidden rounded-full bg-black/60 ring-1 ring-purple-500/40">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-700 via-fuchsia-500 to-purple-400 transition-all duration-300" style={{ width: `${bhpPct}%`, boxShadow: '0 0 16px rgba(217,70,239,0.7)' }} />
          </div>
          <div className="mt-1 text-center text-[11px] tabular-nums text-purple-200/70">{Math.max(0, Math.round(fs.bhp)).toLocaleString()} / {fs.boss.maxHp.toLocaleString()}</div>
        </div>

        {/* Journal (compact, semi-transparent) */}
        <div className="mt-4 h-20 w-full max-w-md space-y-0.5 overflow-y-auto rounded-lg bg-black/30 p-2 text-center text-[11px] text-slate-400">
          {fs.logs.map((l, i) => <div key={i} className="last:font-medium last:text-slate-200">{l}</div>)}
          <div ref={logEnd} />
        </div>
      </div>

      {/* Dock d'actions collé en bas (barre PV joueur + compétences) */}
      <div className="relative z-20 border-t border-white/10 bg-black/50 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-md">
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-emerald-300">{player.name}</span>
            <span className="tabular-nums">{fs.php} / {stats.maxHp} PV</span>
          </div>
          <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-black/50">
            <div className={`h-full rounded-full transition-all ${phpPct < 30 ? 'bg-rose-500' : 'bg-emerald-500'} ${phpPct < 15 ? 'animate-pulse' : ''}`} style={{ width: `${phpPct}%` }} />
          </div>

          {showPotions ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {POTIONS.filter((id) => (player.inventory[id] ?? 0) > 0).map((id) => (
                  <button key={id} onClick={() => { setShowPotions(false); act('potion', item(id)!.hp ?? 0, id); }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-emerald-500/30 text-xs font-bold hover:bg-emerald-500/50">
                    <ItemIcon id={id} size={16} /> {item(id)!.name} ({player.inventory[id] ?? 0})
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPotions(false)} className="min-h-[44px] w-full rounded bg-slate-700/50 text-xs hover:bg-slate-700">Retour</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act('attack')} className="min-h-[44px] rounded-lg bg-rose-500/40 text-sm font-bold hover:bg-rose-500/60">⚔️ Attaquer</button>
              {skills.map((skill) => {
                const cd = fs.skillCds[skill.id] || 0;
                return (
                  <button key={skill.id} onClick={() => act(skill.id)} disabled={cd > 0} title={skill.desc} className="min-h-[44px] rounded-lg bg-purple-500/40 text-sm font-bold hover:bg-purple-500/60 disabled:opacity-40">
                    {cd > 0 ? `${skill.icon} ${skill.name} (${cd})` : `${skill.icon} ${skill.name}`}
                  </button>
                );
              })}
              <button onClick={() => { const a = POTIONS.filter((id) => (player.inventory[id] ?? 0) > 0); if (a.length === 1) act('potion', item(a[0])!.hp ?? 0, a[0]); else setShowPotions(true); }} disabled={potionCount === 0} className="min-h-[44px] rounded-lg bg-emerald-500/30 text-sm font-bold hover:bg-emerald-500/50 disabled:opacity-40">
                🧪 Potion ({potionCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transitions d'issue */}
      {transition === 'win' && (
        <div className="asc-flash-win pointer-events-none absolute inset-0 z-40" style={{ background: 'radial-gradient(circle, #ffffff 0%, #e9d5ff 40%, #a855f7 100%)' }} />
      )}
      {transition === 'dead' && (
        <div className="asc-vignette-dead pointer-events-none absolute inset-0 z-40" style={{ background: 'radial-gradient(circle, transparent 20%, rgba(120,0,0,0.55) 60%, rgba(20,0,0,0.95) 100%)' }} />
      )}
    </div>,
    document.body,
  );
}
