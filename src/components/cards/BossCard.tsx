import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchBoss, ensureBoss, attackBoss, bossReward, bossOnline, type WorldBoss } from '../../firebase/bossService';
import { deriveStats, cooldownLeft } from '../../game/player';
import { addQuestMetric } from '../../game/quests';
import { ABILITIES } from '../../game/talents';
import { playSound } from '../../game/sound';

const ATTACK_CD = 5_000;

export default function BossCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [boss, setBoss] = useState<WorldBoss | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const unsub = watchBoss(setBoss);
    void ensureBoss();
    const respawn = setInterval(() => void ensureBoss(), 8_000);
    const cd = setInterval(() => tick((n) => n + 1), 1000); // rafraîchit le cooldown
    return () => { unsub(); clearInterval(respawn); clearInterval(cd); };
  }, []);

  // Récompense automatique à la mort du boss.
  useEffect(() => {
    if (!p || !boss || !boss.defeatedAt) return;
    if (!boss.contributors?.[p.uid] || p.bossClaims.includes(boss.id)) return;
    const r = bossReward(boss, p.uid);
    mutate((d) => {
      d.gold += r.gold;
      d.fateCoins += r.fateCoins;
      d.bossClaims.push(boss.id);
    });
    toast(`🏆 Boss vaincu ! Part du butin : +${r.gold} 🪙, +${r.fateCoins} 🎲`, 'gold');
  }, [boss?.id, boss?.defeatedAt, p?.uid]);

  if (!p) return null;
  const cdLeft = cooldownLeft(p, 'boss', ATTACK_CD);
  const ability = ABILITIES[p.classId];
  const abilityCd = cooldownLeft(p, 'bossAbility', ability.cooldownMs);

  function attack() {
    if (!boss || boss.hp <= 0) return;
    if (cooldownLeft(p!, 'boss', ATTACK_CD) > 0) return;
    if (p!.hp <= 0) return toast('Tu es K.O. ! Soigne-toi.', 'bad');
    const atk = deriveStats(p!).atk;
    const dmg = Math.round(atk * (8 + Math.random() * 7));
    mutate((d) => {
      d.cooldowns.boss = Date.now();
      addQuestMetric(d, 'bossHits', dmg);
    });
    playSound('hit');
    void attackBoss({ uid: p!.uid, name: p!.name }, dmg);
    toast(`Tu infliges ${dmg} dégâts au boss !`, 'info');
  }

  function useAbility() {
    const ability = ABILITIES[p!.classId];
    if (!boss || boss.hp <= 0) return;
    if (cooldownLeft(p!, 'bossAbility', ability.cooldownMs) > 0) return;
    if (p!.hp <= 0) return toast('Tu es K.O. ! Soigne-toi.', 'bad');
    const stats = deriveStats(p!);
    const dmg = Math.round(stats.atk * ability.mult * (1.6 + Math.random()));
    mutate((d) => {
      d.cooldowns.bossAbility = Date.now();
      addQuestMetric(d, 'bossHits', dmg);
      if (ability.healFrac) d.hp = Math.min(stats.maxHp, d.hp + Math.round(stats.maxHp * ability.healFrac));
    });
    playSound('win');
    void attackBoss({ uid: p!.uid, name: p!.name }, dmg);
    toast(`${ability.icon} ${ability.name} : ${dmg} dégâts !`, 'gold');
  }

  if (!boss) {
    return <p className="text-sm text-slate-400">Invocation du boss… patiente un instant.</p>;
  }

  const hpPct = Math.round((boss.hp / boss.maxHp) * 100);
  const contributors = Object.entries(boss.contributors ?? {})
    .sort((a, b) => b[1].dmg - a[1].dmg)
    .slice(0, 8);
  const dead = boss.hp <= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-5xl">{boss.emoji}</div>
        <div>
          <div className="text-lg font-bold">{boss.name}</div>
          <div className="text-xs text-slate-400">{dead ? 'Vaincu' : 'Boss mondial — combat partagé'}</div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-300">
          <span>PV</span>
          <span className="tabular-nums">{boss.hp.toLocaleString()} / {boss.maxHp.toLocaleString()}</span>
        </div>
        <div className="h-4 overflow-hidden rounded bg-black/40">
          <div className="h-4 rounded bg-gradient-to-r from-rose-600 to-red-400 transition-all" style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {!dead ? (
        <div className="space-y-2">
          <button
            onClick={attack}
            disabled={cdLeft > 0 || p.hp <= 0}
            className="w-full rounded-xl bg-red-500/40 py-3 text-sm font-bold transition hover:bg-red-500/60 disabled:opacity-40"
          >
            {cdLeft > 0 ? `⚔️ Récupération… ${Math.ceil(cdLeft / 1000)}s` : '⚔️ Attaquer le boss'}
          </button>
          <button
            onClick={useAbility}
            disabled={abilityCd > 0 || p.hp <= 0}
            title={ability.desc}
            className="w-full rounded-xl bg-purple-500/40 py-2.5 text-sm font-bold transition hover:bg-purple-500/60 disabled:opacity-40"
          >
            {abilityCd > 0 ? `${ability.icon} ${ability.name} — ${Math.ceil(abilityCd / 1000)}s` : `${ability.icon} ${ability.name} (${ability.desc})`}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-3 text-center text-sm">
          🎉 Le boss est tombé ! Le butin a été partagé entre les combattants. Un nouveau boss arrive bientôt.
        </div>
      )}

      {!bossOnline && (
        <p className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : boss solo. Configure Firebase (Realtime Database) pour un vrai boss partagé.
        </p>
      )}

      {contributors.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Meilleurs assaillants</div>
          <div className="space-y-1">
            {contributors.map(([uid, c]) => (
              <div key={uid} className={`flex justify-between rounded px-2 py-1 text-sm ${uid === p.uid ? 'bg-sky-500/20' : 'bg-black/20'}`}>
                <span className="truncate">{c.name}</span>
                <span className="tabular-nums text-slate-300">{c.dmg.toLocaleString()} dmg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
