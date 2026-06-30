import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchBoss, ensureBoss, attackBoss, bossReward, bossOnline, BOSS_ATTACK_CD, type WorldBoss } from '../../firebase/bossService';
import { deriveStats, cooldownLeft } from '../../game/player';
import { addQuestMetric } from '../../game/quests';
import { playSound } from '../../game/sound';

function fmt(ms: number): string {
  const m = Math.ceil(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  return `${m}min`;
}

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
    const cd = setInterval(() => tick((n) => n + 1), 1000);
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
  const cdLeft = cooldownLeft(p, 'boss', BOSS_ATTACK_CD);

  function attack() {
    if (!boss || boss.hp <= 0) return;
    if (cooldownLeft(p!, 'boss', BOSS_ATTACK_CD) > 0) return;
    if (p!.hp <= 0) return toast('Tu es K.O. ! Soigne-toi avant de frapper.', 'bad');
    const atk = deriveStats(p!).atk;
    const dmg = Math.round(atk * (12 + Math.random() * 8));
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
        <div>
          <div className="text-lg font-bold">{boss.name}</div>
          <div className="text-xs text-slate-400">{dead ? 'Vaincu' : `Boss mondial · ${contribs.length} combattant${contribs.length > 1 ? 's' : ''}`}</div>
        </div>
      </div>

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
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-3 text-center text-sm">
          🎉 Le boss est tombé ! Butin partagé au prorata des dégâts. Un nouveau boss approche.
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
