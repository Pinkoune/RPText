import { useGame } from '../../store/gameStore';
import {
  FAMILIARS, familiarsByRarity, familiarProgress, rollFamiliar, familiarAbility,
  RARITY_COLOR, RARITY_COST, MAX_FAMILIAR_LEVEL,
  type FamiliarRarity,
} from '../../game/familiars';
import { playSound } from '../../game/sound';

const RARITIES: FamiliarRarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_LABEL: Record<FamiliarRarity, string> = {
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire',
};

export default function FamiliarCard() {
  const p = useGame((s) => s.player);
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  if (!p) return null;

  const owned = Object.entries(p.familiars ?? {});

  function adopt(rarity: FamiliarRarity) {
    const cost = RARITY_COST[rarity];
    if (cost <= 0) {
      toast('Les familiers légendaires ne s\'achètent pas — ils tombent (rarement) du boss mondial.', 'info');
      return;
    }
    if (p!.gold < cost) { toast(`Il te faut ${cost} 🪙.`, 'bad'); return; }
    const id = rollFamiliar(p!, rarity);
    mutate((d) => {
      d.gold -= cost;
      d.familiars[id] = (d.familiars[id] ?? 0) + 0;
      if (!d.activeFamiliarId) d.activeFamiliarId = id;
    });
    playSound('coin');
    toast(`${FAMILIARS[id].emoji} ${FAMILIARS[id].name} rejoint ton équipe !`, 'gold');
  }

  function equip(id: string) {
    mutate((d) => { d.activeFamiliarId = id; });
    playSound('click');
    toast(`${FAMILIARS[id].name} équipé.`, 'good');
  }
  function unequip() {
    mutate((d) => { d.activeFamiliarId = null; });
    playSound('click');
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Un familier équipé donne un petit bonus de stat qui grandit avec ses victoires à tes côtés.
        Plafonné niveau {MAX_FAMILIAR_LEVEL} — un compagnon, pas une arme.
      </p>

      {/* Familier actif */}
      <div className="rounded-xl bg-black/25 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Familier équipé</div>
        {p.activeFamiliarId && FAMILIARS[p.activeFamiliarId] ? (
          (() => {
            const def = FAMILIARS[p.activeFamiliarId!];
            const prog = familiarProgress(p.familiars[p.activeFamiliarId!] ?? 0);
            return (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: RARITY_COLOR[def.rarity] }}>
                    {def.emoji} {def.name} <span className="text-slate-400">Nv.{prog.level} <span className="text-emerald-400">(+{def.stat === 'maxHp' ? Math.round(def.base + def.growth * (prog.level - 1)) : Math.round((def.base + def.growth * (prog.level - 1)) * 10) / 10} {def.stat === 'maxHp' ? 'PV' : def.stat.toUpperCase()})</span></span>
                  </span>
                  <button onClick={unequip} className="rounded bg-rose-500/25 px-2 py-0.5 text-[11px] hover:bg-rose-500/45">Retirer</button>
                </div>
                <div className="mt-1.5 h-1.5 rounded bg-black/40">
                  <div className="h-1.5 rounded bg-amber-400" style={{ width: prog.maxed ? '100%' : `${(prog.into / prog.need) * 100}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {prog.maxed ? 'Niveau maximum atteint.' : `${prog.into}/${prog.need} XP`} · {def.desc}
                </div>
                {(() => {
                  const ab = familiarAbility(p);
                  return ab ? (
                    <div className="mt-1.5 rounded bg-purple-500/10 px-2 py-1 text-[11px] text-purple-200">
                      ✨ Capacité : {ab.label}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })()
        ) : (
          <p className="mt-1 text-sm text-slate-500">Aucun familier équipé.</p>
        )}
      </div>

      {/* Adoption */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Adopter (or : {p.gold} 🪙)</div>
        <div className="grid grid-cols-3 gap-2">
          {(['common', 'rare', 'epic'] as FamiliarRarity[]).map((r) => (
            <button
              key={r}
              onClick={() => adopt(r)}
              disabled={p.gold < RARITY_COST[r]}
              className="rounded-lg px-2 py-2 text-xs font-semibold hover:brightness-125 disabled:opacity-40"
              style={{ background: `${RARITY_COLOR[r]}22`, color: RARITY_COLOR[r] }}
            >
              {RARITY_LABEL[r]}<br /><span className="text-[10px] opacity-80">{RARITY_COST[r]} 🪙</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">🌠 Légendaire : chance rare au butin du boss mondial, pas en boutique.</p>
      </div>

      {/* Collection */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ta collection · {owned.length}/{Object.keys(FAMILIARS).length}</div>
        {owned.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun familier pour l'instant.</p>
        ) : (
          <div className="space-y-1.5">
            {owned.map(([id, xp]) => {
              const def = FAMILIARS[id];
              if (!def) return null;
              const prog = familiarProgress(xp);
              const active = id === p.activeFamiliarId;
              const statVal = def.stat === 'maxHp' ? Math.round(def.base + def.growth * (prog.level - 1)) : Math.round((def.base + def.growth * (prog.level - 1)) * 10) / 10;
              return (
                <div key={id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-sky-500/15' : 'bg-black/20'}`}>
                  <span style={{ color: RARITY_COLOR[def.rarity] }}>
                    {def.emoji} {def.name} <span className="text-xs text-slate-400">Nv.{prog.level} <span className="text-emerald-400">(+{statVal} {def.stat === 'maxHp' ? 'PV' : def.stat.toUpperCase()})</span></span>
                  </span>
                  {active ? (
                    <span className="text-[11px] text-sky-300">équipé</span>
                  ) : (
                    <button onClick={() => equip(id)} className="rounded bg-sky-500/30 px-2 py-1 text-xs hover:bg-sky-500/50">Équiper</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bestiaire (aperçu de ce qui reste à trouver) */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Bestiaire</div>
        <div className="space-y-2">
          {RARITIES.map((r) => (
            <div key={r} className="flex flex-wrap gap-1.5">
              {familiarsByRarity(r).map((f) => {
                const has = f.id in (p.familiars ?? {});
                return (
                  <span
                    key={f.id}
                    title={has ? f.name : '???'}
                    className={`rounded px-1.5 py-0.5 text-[11px]`}
                    style={{ background: has ? `${RARITY_COLOR[r]}22` : 'rgba(0,0,0,0.3)', color: RARITY_COLOR[r], opacity: has ? 1 : 0.5 }}
                  >
                    {has ? `${f.emoji} ${f.name}` : '❔ ???'}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
