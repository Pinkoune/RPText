import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchBoss, watchLastBoss, ensureBoss, attackBoss, bossReward, bossOnline, BOSS_ATTACK_CD, type WorldBoss } from '../../firebase/bossService';
import { deriveStats, cooldownLeft } from '../../game/player';
import { addQuestMetric } from '../../game/quests';
import { playSound } from '../../game/sound';

function fmt(ms: number): string {
  const m = Math.ceil(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  return `${m}min`;
}

import { contributeGuild } from '../../firebase/groupsService';
import { rollFamiliar, FAMILIARS } from '../../game/familiars';

// Chance qu'un contributeur reçoive un familier légendaire à la mort du boss.
const LEGENDARY_DROP_CHANCE = 0.05;

export default function BossCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [boss, setBoss] = useState<WorldBoss | null>(null);
  const [lastBoss, setLastBoss] = useState<WorldBoss | null>(null);
  const [showLoot, setShowLoot] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const unsub = watchBoss(setBoss);
    const unsubLast = watchLastBoss(setLastBoss);
    void ensureBoss();
    const respawn = setInterval(() => void ensureBoss(), 8_000);
    const cd = setInterval(() => tick((n) => n + 1), 1000);
    return () => { unsub(); unsubLast(); clearInterval(respawn); clearInterval(cd); };
  }, []);

  function claimReward(target: WorldBoss) {
    if (!target.defeatedAt) return;
    if (!target.contributors?.[p!.uid]) return toast('Tu n\'as pas participé à ce boss.', 'bad');
    if (p!.bossClaims.includes(target.id)) return toast('Butin déjà réclamé.', 'bad');
    const r = bossReward(target, p!.uid);
    const wonFamiliar = Math.random() < LEGENDARY_DROP_CHANCE;
    let familiarId = '';
    mutate((d) => {
      d.gold += r.gold;
      d.fateCoins += r.fateCoins;
      d.inventory['boss_soul'] = (d.inventory['boss_soul'] ?? 0) + 1; // sert à l'ascension de classe
      d.bossClaims.push(target.id);
      if (wonFamiliar) {
        familiarId = rollFamiliar(d, 'legendary');
        d.familiars[familiarId] = (d.familiars[familiarId] ?? 0) + 0;
        if (!d.activeFamiliarId) d.activeFamiliarId = familiarId;
      }
    });
    if (p!.guildId) void contributeGuild(p!.guildId, r.guildXp);
    playSound('win');
    toast(`🏆 Butin réclamé : +${r.gold} 🪙, +${r.fateCoins} 🎲, +1 💎 Âme de Boss, +${r.guildXp} XP Guilde`, 'gold');
    if (wonFamiliar && familiarId) {
      toast(`🌠 Butin rare ! ${FAMILIARS[familiarId].emoji} ${FAMILIARS[familiarId].name} rejoint ton équipe !`, 'gold');
    }
  }

  if (!p) return null;

  // Butin d'un boss précédent pas encore réclamé (fenêtre de respawn ratée) :
  // seulement pertinent si un nouveau boss est déjà là (sinon le bloc "dead"
  // ci-dessous gère déjà la réclamation du boss courant).
  const missedLast = lastBoss && boss && lastBoss.id !== boss.id
    && (lastBoss.contributors?.[p.uid]?.dmg ?? 0) > 0
    && !p.bossClaims.includes(lastBoss.id)
    ? lastBoss : null;


  const cdLeft = cooldownLeft(p, 'boss', BOSS_ATTACK_CD);

  function attack() {
    if (!boss || boss.hp <= 0) return;
    if (cooldownLeft(p!, 'boss', BOSS_ATTACK_CD) > 0) return;
    if (p!.hp <= 0) return toast('Tu es K.O. ! Soigne-toi avant de frapper.', 'bad');
    // Boss mondial = effort communautaire : dégâts quasi-plats pour que tout le
    // monde participe équitablement. Le niveau/ATK ne donne qu'un léger avantage.
    const atk = deriveStats(p!).atk;
    const dmg = Math.round((150 + p!.level * 3 + atk * 0.05) * (0.85 + Math.random() * 0.3));
    mutate((d) => {
      d.cooldowns.boss = Date.now();
      addQuestMetric(d, 'bossHits', dmg);
    });
    playSound('win');
    void attackBoss({ uid: p!.uid, name: p!.name }, dmg);
    toast(`💥 Assaut ! Tu infliges ${dmg} dégâts au boss.`, 'gold');
  }

  if (!boss) return <p className="text-sm text-slate-400">Invocation du boss… patiente un instant.</p>;

  const hpPct = Math.round((boss.hp / boss.maxHp) * 100);
  const contribs = Object.entries(boss.contributors ?? {}).sort((a, b) => b[1].dmg - a[1].dmg);
  const myDmg = boss.contributors?.[p.uid]?.dmg ?? 0;
  const dead = boss.hp <= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-5xl">{boss.emoji}</div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold">{boss.name}</span>
            <button
              onClick={() => setShowLoot((v) => !v)}
              title="Table de butin"
              className="grid h-5 w-5 place-items-center rounded-full bg-black/30 text-[11px] text-slate-300 hover:bg-white/10"
            >
              ℹ️
            </button>
          </div>
          <div className="text-xs text-slate-400">{dead ? 'Vaincu' : `Boss mondial · ${contribs.length} combattant${contribs.length > 1 ? 's' : ''}`}</div>
        </div>
      </div>

      {showLoot && (
        <div className="space-y-1 rounded-lg bg-black/25 p-3 text-xs text-slate-300">
          <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Butin (au prorata des dégâts infligés)</div>
          <div>🪙 Or — pool total : <b className="text-amber-300">{boss.goldPool.toLocaleString()}</b></div>
          <div>🎲 Fate Coins — pool total : <b className="text-fuchsia-300">{boss.fatePool.toLocaleString()}</b> (min. 1 si tu as participé)</div>
          <div>🏰 XP de guilde — pool total : <b className="text-sky-300">{boss.guildXpPool.toLocaleString()}</b> (versée à ta guilde si tu en as une)</div>
          <div>💎 Âme de Boss — garanti pour tout participant</div>
          <div>🌠 Familier légendaire — {Math.round(LEGENDARY_DROP_CHANCE * 100)}% de chance à la réclamation</div>
        </div>
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-300">
          <span>PV</span>
          <span className="tabular-nums">{Math.max(0, boss.hp).toLocaleString()} / {boss.maxHp.toLocaleString()} ({hpPct}%)</span>
        </div>
        <div className="h-4 overflow-hidden rounded bg-black/40">
          <div className="h-4 rounded bg-gradient-to-r from-rose-600 to-red-400 transition-all" style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {!dead ? (
        <>
          <button
            onClick={attack}
            disabled={cdLeft > 0 || p.hp <= 0}
            className="w-full rounded-xl bg-red-500/40 py-3 text-sm font-bold transition hover:bg-red-500/60 disabled:opacity-40"
          >
            {cdLeft > 0 ? `⏳ Prochaine attaque dans ${fmt(cdLeft)}` : '💥 Attaquer (1× toutes les 2h)'}
          </button>
          <p className="text-center text-[11px] text-slate-500">
            Une attaque puissante toutes les 2h. Tes dégâts cumulés : <b className="text-sky-300">{myDmg.toLocaleString()}</b>
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-3 text-center text-sm space-y-2">
          <div>🎉 Le boss est tombé ! Butin partagé au prorata des dégâts.</div>
          {myDmg > 0 ? (
            p.bossClaims.includes(boss.id) ? (
              <div className="text-xs text-emerald-300">✅ Butin réclamé.</div>
            ) : (
              <button
                onClick={() => claimReward(boss)}
                className="w-full rounded-lg bg-amber-500/40 py-2 text-sm font-bold hover:bg-amber-500/60"
              >
                🏆 Réclamer le butin
              </button>
            )
          ) : (
            <div className="text-xs text-slate-400">Tu n'as pas participé à ce boss.</div>
          )}
        </div>
      )}

      {missedLast && (
        <div className="rounded-xl border border-sky-400/40 bg-sky-500/15 p-3 text-center text-sm space-y-2">
          <div className="text-xs text-sky-200">Un nouveau boss est déjà apparu, mais tu n'as pas réclamé ton butin du précédent ({missedLast.emoji} {missedLast.name}).</div>
          <button
            onClick={() => claimReward(missedLast)}
            className="w-full rounded-lg bg-sky-500/40 py-2 text-sm font-bold hover:bg-sky-500/60"
          >
            🏆 Réclamer le butin du dernier boss
          </button>
        </div>
      )}

      {!bossOnline && (
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : boss solo. Configure Firebase (Realtime Database) pour un boss mondial partagé.
        </p>
      )}

      {contribs.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Meilleurs assaillants</div>
          <div className="space-y-1">
            {contribs.slice(0, 8).map(([uid, c], i) => (
              <div key={uid} className={`flex justify-between rounded px-2 py-1 text-sm ${uid === p.uid ? 'bg-sky-500/20' : 'bg-black/20'}`}>
                <span className="truncate">{i + 1}. {c.name}</span>
                <span className="tabular-nums text-slate-300">{c.dmg.toLocaleString()} dmg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
