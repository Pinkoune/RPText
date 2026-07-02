import { useState, useMemo } from 'react';
import { useGame } from '../../store/gameStore';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { MONSTERS } from '../../game/monsters';
import type { ItemDef, MonsterDef } from '../../game/types';
import { RECIPES } from '../../game/crafting';
import { GATHER_SKILLS } from '../../game/gathering';

export default function WikiCard() {
  const p = useGame(s => s.player);
  const [tab, setTab] = useState<'items' | 'bestiary'>('items');
  const [search, setSearch] = useState('');

  const sourcesByItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    
    // Crafting
    for (const r of RECIPES) {
      if (!map[r.output]) map[r.output] = [];
      map[r.output].push(`Forge (nv. ${r.levelReq})`);
    }

    // Monsters
    for (const m of Object.values(MONSTERS)) {
      if (m.loot) {
        for (const drop of Object.keys(m.loot)) {
          if (!map[drop]) map[drop] = [];
          map[drop].push(`Drop: ${m.name}`);
        }
      }
    }

    // Gathering
    for (const skill of Object.values(GATHER_SKILLS)) {
      if (skill.byBiome) {
        for (const [biomeId, drops] of Object.entries(skill.byBiome)) {
          for (const drop of drops) {
            if (!map[drop.id]) map[drop.id] = [];
            map[drop.id].push(`Récolte: ${skill.name} (${biomeId})`);
          }
        }
      }
    }

    // Deduplicate
    for (const id in map) {
      map[id] = [...new Set(map[id])];
    }

    return map;
  }, []);

  const itemsList = useMemo(() => {
    const q = search.toLowerCase();
    return Object.values(ITEMS).filter(it => 
      it.name.toLowerCase().includes(q) || 
      it.desc.toLowerCase().includes(q)
    );
  }, [search]);

  const bestiaryList = useMemo(() => {
    const q = search.toLowerCase();
    return Object.values(MONSTERS).filter(m => 
      m.name.toLowerCase().includes(q)
    );
  }, [search]);

  if (!p) return null;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search and Tabs */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
          <button onClick={() => setTab('items')} className={`flex-1 rounded p-2 text-sm font-bold transition ${tab === 'items' ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>Objets</button>
          <button onClick={() => setTab('bestiary')} className={`flex-1 rounded p-2 text-sm font-bold transition ${tab === 'bestiary' ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>Bestiaire</button>
        </div>
        <input 
          type="text" 
          placeholder="Rechercher..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <div className="overflow-y-auto space-y-2 pr-1">
        {tab === 'items' && itemsList.map(it => (
          <div key={it.id} className="rounded-lg bg-black/25 p-3">
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: RARITY_COLOR[it.rarity] }}>
                {it.icon} {it.name}
              </span>
              {it.slot && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">{it.slot}</span>}
              <span className="text-xs text-amber-300 ml-auto">{it.value} Sol</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{it.desc}</p>
            {getStatsStr(it) && <div className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-200 mt-1 w-fit">{getStatsStr(it)}</div>}
            {sourcesByItem[it.id] && sourcesByItem[it.id].length > 0 && (
              <div className="mt-2 text-[10px] text-slate-400">
                <span className="font-semibold">Obtention :</span> {sourcesByItem[it.id].join(' · ')}
              </div>
            )}
          </div>
        ))}

        {tab === 'bestiary' && bestiaryList.map(m => {
          const enc = p.statistics.mobsEncountered?.[m.id] ?? 0;
          const k = p.statistics.mobsKilled?.[m.id] ?? 0;
          
          if (enc === 0) {
            return (
              <div key={m.id} className="rounded-lg bg-black/25 p-3 flex items-center justify-center opacity-50">
                <span className="font-bold text-slate-400">❓ Monstre inconnu</span>
              </div>
            );
          }

          return (
            <div key={m.id} className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{m.emoji || '👿'}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-rose-300">{m.name}</span>
                    <span className="text-[10px] text-slate-400">Vaincu : {k} fois</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">❤️ {m.hp}</div>
                  <div className="text-xs text-slate-300">🗡️ {m.atk} | 🛡️ {m.def}</div>
                </div>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-2">
                {m.element && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">Élément : {m.element}</span>}
                {m.weaknesses && m.weaknesses.length > 0 && (
                  <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1.5 rounded">Faiblesse : {m.weaknesses.join(', ')}</span>
                )}
                {m.resistances && m.resistances.length > 0 && (
                  <span className="text-[10px] bg-rose-900/40 text-rose-300 px-1.5 rounded">Résistance : {m.resistances.join(', ')}</span>
                )}
              </div>

              {k > 0 ? (
                <div className="mt-2 text-[10px]">
                  <span className="font-semibold text-slate-300">Butin possible :</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.loot && Object.entries(m.loot).map(([itemId, chance]) => {
                      const it = ITEMS[itemId];
                      return (
                        <span key={itemId} className="bg-black/40 px-1.5 py-0.5 rounded" style={{ color: it ? RARITY_COLOR[it.rarity] : 'white' }}>
                          {it ? `${it.icon} ${it.name}` : itemId} ({Math.round(chance * 100)}%)
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[10px] italic text-slate-500">
                  Éliminez ce monstre pour révéler son butin.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatsStr(it: ItemDef) {
  const parts = [];
  if (it.atk) parts.push(`🗡️+${it.atk}`);
  if (it.def) parts.push(`🛡️+${it.def}`);
  if (it.hp && it.slot === 'armor') parts.push(`❤️+${it.hp}`);
  if (it.hp && it.slot === 'consumable') parts.push(`🧪+${it.hp} PV`);
  if (it.maxCp) parts.push(`🔨+${it.maxCp} CP`);
  if (it.maxGp) parts.push(`🌾+${it.maxGp} GP`);
  
  if (it.element) {
    const eIcon: any = { fire: '🔥', water: '💧', earth: '🪨', wind: '🌪️', light: '✨', dark: '🌌', frost: '❄️' };
    parts.push(`${eIcon[it.element] || ''} ${it.element}`);
  }
  if (it.dmgType) parts.push(`(${it.dmgType === 'magical' ? 'Magique' : 'Physique'})`);
  if (it.maxDurability) parts.push(`🔧 ${it.maxDurability}`);
  if (it.setId) parts.push(`[Set: ${it.setId.replace('_set', '')}]`);
  
  return parts.length ? parts.join(' · ') : null;
}
