import { useGame } from '../../store/gameStore';
import { CLASSES, xpToNext } from '../../game/classes';
import { BIOMES } from '../../game/biomes';
import { deriveStats } from '../../game/player';
import { ITEMS, RARITY_COLOR } from '../../game/items';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Gear({ slot, id }: { slot: string; id: string | null }) {
  const it = id ? ITEMS[id] : null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5 text-sm">
      <span className="text-slate-400">{slot}</span>
      <span style={{ color: it ? RARITY_COLOR[it.rarity] : '#64748b' }}>
        {it ? `${it.icon} ${it.name}` : '—'}
      </span>
    </div>
  );
}

export default function ProfileCard() {
  const p = useGame((s) => s.player);
  if (!p) return null;
  const cls = CLASSES[p.classId];
  const stats = deriveStats(p);
  const xpPct = Math.round((p.xp / xpToNext(p.level)) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-sky-500/20 text-3xl">{cls.emoji}</div>
        <div>
          <div className="text-xl font-bold">{p.name}</div>
          <div className="text-sm text-slate-300">Niveau {p.level} · {cls.name}</div>
          <div className="text-xs text-slate-400">{BIOMES[p.biome].emoji} {BIOMES[p.biome].name}</div>
        </div>
      </div>

      {(p.talentPoints ?? 0) > 0 && (
        <div className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs">
          🌟 {p.talentPoints} point{p.talentPoints > 1 ? 's' : ''} de talent à dépenser — tape « talents ».
        </div>
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>Expérience</span>
          <span>{p.xp} / {xpToNext(p.level)}</span>
        </div>
        <div className="h-2.5 rounded bg-black/40">
          <div className="h-2.5 rounded bg-emerald-400" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="PV" value={`${p.hp}/${stats.maxHp}`} />
        <Stat label="ATK" value={stats.atk} />
        <Stat label="DEF" value={stats.def} />
        <Stat label="Kills" value={p.kills} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="🪙 Or" value={p.gold} />
        <Stat label="🎲 Fate" value={p.fateCoins} />
        <Stat label="Bilan jeu" value={p.gambleNet} />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Équipement</div>
        <Gear slot="Arme" id={p.equipped.weapon} />
        <Gear slot="Armure" id={p.equipped.armor} />
        <Gear slot="Bijou" id={p.equipped.trinket} />
      </div>
    </div>
  );
}
