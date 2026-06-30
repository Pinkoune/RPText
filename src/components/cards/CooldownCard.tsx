import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { cooldownLeft } from '../../game/player';
import { HUNT_COOLDOWN, DAILY_COOLDOWN } from '../../game/commands';
import { GATHER_COOLDOWN } from '../../game/gathering';
import { DUNGEONS } from '../../game/dungeons';
import { BOSS_ATTACK_CD } from '../../firebase/bossService';

function fmt(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function CooldownCard() {
  const p = useGame((s) => s.player);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!p) return null;

  const entries: { icon: string; label: string; left: number }[] = [
    { icon: '⚔️', label: 'Chasse', left: cooldownLeft(p, 'hunt', HUNT_COOLDOWN) },
    { icon: '🎁', label: 'Récompense quotidienne', left: cooldownLeft(p, 'daily', DAILY_COOLDOWN) },
    { icon: '🐲', label: 'Attaque du boss', left: cooldownLeft(p, 'boss', BOSS_ATTACK_CD) },
    { icon: '🌾', label: 'Récolte', left: cooldownLeft(p, 'gather', GATHER_COOLDOWN) },
  ];
  for (const d of DUNGEONS) {
    entries.push({ icon: d.emoji, label: d.name, left: cooldownLeft(p, `dungeon:${d.id}`, d.cooldownMs) });
  }

  const active = entries.filter((e) => e.left > 0).sort((a, b) => a.left - b.left);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">Récupérations en cours.</p>
      {active.length === 0 ? (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">✅ Tout est prêt, aucune récupération en cours !</p>
      ) : (
        active.map((e, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
            <span>{e.icon} {e.label}</span>
            <span className="tabular-nums text-amber-300">{fmt(e.left)}</span>
          </div>
        ))
      )}
    </div>
  );
}
