import { useState, useMemo } from 'react';
import { useGame } from '../../store/gameStore';
import { ITEMS, RARITY_COLOR } from '../../game/items';
import { MONSTERS } from '../../game/monsters';
import type { ItemDef, MonsterDef } from '../../game/types';
import { RECIPES } from '../../game/crafting';
import { GATHER_SKILLS } from '../../game/gathering';
import { DUNGEONS } from '../../game/dungeons';
import { BIOMES } from '../../game/biomes';
import { PHASE_LABEL } from '../../game/daynight';
import { BASE_CLASSES, getAscensions } from '../../game/classes';
import { setProcDesc } from '../../game/sets';
import ItemIcon from '../ItemIcon';
import MonsterIcon from '../MonsterIcon';

export default function WikiCard() {
  const p = useGame(s => s.player);
  const [tab, setTab] = useState<'items' | 'bestiary' | 'classes'>('items');
  const [bestiarySub, setBestiarySub] = useState<'world' | 'dungeon'>('world');
  const [showElementInfo, setShowElementInfo] = useState(false);
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
        for (const [drop, chance] of Object.entries(m.loot)) {
          if (!map[drop]) map[drop] = [];
          const pct = Math.round(chance * 1000) / 10;
          map[drop].push(`Drop: ${m.name} (${pct}%)`);
        }
      }
    }

    // Récolte : taux calculé sur le poids relatif du pool du biome (celui
    // réellement utilisé par extractResource/pickDrop).
    for (const skill of Object.values(GATHER_SKILLS)) {
      if (skill.byBiome) {
        for (const [biomeId, drops] of Object.entries(skill.byBiome)) {
          const total = drops.reduce((s, d) => s + d.weight, 0);
          const biomeName = BIOMES[biomeId as keyof typeof BIOMES]?.name ?? biomeId;
          for (const drop of drops) {
            if (!map[drop.id]) map[drop.id] = [];
            const pct = Math.round((drop.weight / total) * 1000) / 10;
            const lvlTag = drop.minLvl ? ` · récolte nv.${drop.minLvl}+` : '';
            map[drop.id].push(`Récolte: ${skill.name} — ${biomeName} (${pct}%${lvlTag})`);
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

  const dungeonBestiaryList = useMemo(() => {
    const q = search.toLowerCase();
    const list: (MonsterDef & { dungeonName: string; dungeonId: string })[] = [];
    for (const d of DUNGEONS) {
      for (const m of d.stages) {
        if (m.name.toLowerCase().includes(q)) list.push({ ...m, dungeonName: d.name, dungeonId: d.id });
      }
    }
    return list;
  }, [search]);

  if (!p) return null;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search and Tabs */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
          <button onClick={() => setTab('items')} className={`flex-1 rounded p-2 text-sm font-bold transition ${tab === 'items' ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>Objets</button>
          <button onClick={() => setTab('bestiary')} className={`flex-1 rounded p-2 text-sm font-bold transition ${tab === 'bestiary' ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>Bestiaire</button>
          <button onClick={() => setTab('classes')} className={`flex-1 rounded p-2 text-sm font-bold transition ${tab === 'classes' ? 'bg-sky-500/40 text-white' : 'bg-black/25 text-slate-300 hover:bg-white/10'}`}>Classes</button>
        </div>
        {tab === 'bestiary' && (
          <div className="flex gap-2">
            <button onClick={() => setBestiarySub('world')} className={`flex-1 rounded p-1.5 text-xs font-semibold transition ${bestiarySub === 'world' ? 'bg-rose-500/40 text-white' : 'bg-black/20 text-slate-400 hover:bg-white/10'}`}>🌍 Monde ouvert</button>
            <button onClick={() => setBestiarySub('dungeon')} className={`flex-1 rounded p-1.5 text-xs font-semibold transition ${bestiarySub === 'dungeon' ? 'bg-rose-500/40 text-white' : 'bg-black/20 text-slate-400 hover:bg-white/10'}`}>🏰 Donjons</button>
          </div>
        )}
        {tab === 'bestiary' && (
          <button onClick={() => setShowElementInfo(v => !v)} className="text-left text-[11px] text-sky-300 hover:text-sky-200">
            {showElementInfo ? '▲ Masquer' : 'ℹ️ Comment marchent éléments/faiblesses/résistances ?'}
          </button>
        )}
        {tab === 'bestiary' && showElementInfo && (
          <div className="rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300 space-y-2">
            <div>
              <span className="font-semibold text-amber-300">Faiblesse / Résistance</span> (indépendant de l'élément) : chaque monstre peut avoir une faiblesse et/ou une résistance au type de dégâts de ton <b>arme</b> (⚔️ Physique ou 🔮 Magique, voir sa fiche). Faiblesse = ×1.5 dégâts. Résistance = ×0.5 dégâts. Les deux se cumulent si présents (ex: ×0.75).
            </div>
            <div>
              <span className="font-semibold text-amber-300">Éléments</span> (arme vs élément du monstre, ×1.5 ou ×0.7, se cumule aussi avec ce qui précède) :
              <ul className="mt-1 ml-3 list-disc space-y-0.5">
                <li>🌊 Eau <b className="text-emerald-300">bat</b> 🔥 Feu <b className="text-emerald-300">bat</b> 🌪️ Vent <b className="text-emerald-300">bat</b> 🪨 Terre <b className="text-emerald-300">bat</b> 🌊 Eau (cycle : fort contre le suivant, faible contre le précédent)</li>
                <li>❄️ Givre <b className="text-emerald-300">bat</b> 🌊 Eau et 🪨 Terre</li>
                <li>🔥 Feu <b className="text-emerald-300">bat</b> ❄️ Givre</li>
                <li>✨ Lumière ⇄ 🌌 Ténèbres : fortes l'une contre l'autre</li>
                <li>⚪ Neutre : jamais de bonus ni malus</li>
              </ul>
            </div>
            <div className="text-slate-400">Astuce : la <b>Rune de Transmutation</b> (Boutique du Destin) inverse le type de dégâts de ton arme (Physique ↔ Magique) — utile contre un monstre qui résiste au tien.</div>
          </div>
        )}
        {tab !== 'classes' && (
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-500"
          />
        )}
      </div>

      <div className="overflow-y-auto space-y-2 pr-1">
        {tab === 'items' && itemsList.map(it => (
          <div key={it.id} className="rounded-lg bg-black/25 p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: RARITY_COLOR[it.rarity] }}>
                <ItemIcon id={it.id} size={18} /> {it.name}
              </span>
              {it.slot && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">{it.slot}</span>}
              <span className="text-xs text-amber-300 ml-auto">{it.value} Sol</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{it.desc}</p>
            {getStatsStr(it) && <div className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-200 mt-1 w-fit">{getStatsStr(it)}</div>}
            {it.setId && setProcDesc(it.setId) && (
              <p className="text-[10px] text-purple-300 mt-1">⚔️ Bonus 3 pièces ({it.setId.replace('_set', '')}) : {setProcDesc(it.setId)}</p>
            )}
            {sourcesByItem[it.id] && sourcesByItem[it.id].length > 0 && (
              <div className="mt-2 text-[10px] text-slate-400">
                <span className="font-semibold">Obtention :</span> {sourcesByItem[it.id].join(' · ')}
              </div>
            )}
          </div>
        ))}

        {tab === 'bestiary' && bestiarySub === 'world' && bestiaryList.map(m => {
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
                  <MonsterIcon id={m.id} emoji={m.emoji} size={28} title={m.name} />
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

              <div className="mt-2 text-[10px] text-slate-400">
                <span className="font-semibold">Provenance :</span>{' '}
                {m.biomes.length > 0 ? m.biomes.map((b) => BIOMES[b]?.name ?? b).join(', ') : 'Inconnue'}
                {m.phases && m.phases.length > 0 && (
                  <> · <span className="font-semibold">Uniquement :</span> {m.phases.map((ph) => PHASE_LABEL[ph]).join(', ')}</>
                )}
              </div>

              {k > 0 ? (
                <div className="mt-2 text-[10px]">
                  <span className="font-semibold text-slate-300">Butin possible :</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.loot && Object.entries(m.loot).map(([itemId, chance]) => {
                      const it = ITEMS[itemId];
                      return (
                        <span key={itemId} className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded" style={{ color: it ? RARITY_COLOR[it.rarity] : 'white' }}>
                          {it ? <><ItemIcon id={itemId} size={14} /> {it.name}</> : itemId} ({Math.round(chance * 100)}%)
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

        {tab === 'bestiary' && bestiarySub === 'dungeon' && dungeonBestiaryList.map((m, i) => {
          const cleared = (p.dungeonClears?.[m.dungeonId] ?? 0) > 0;

          if (!cleared) {
            return (
              <div key={`${m.dungeonId}-${m.id}-${i}`} className="rounded-lg bg-black/25 p-3 flex items-center justify-center opacity-50">
                <span className="font-bold text-slate-400">❓ Termine « {m.dungeonName} » pour révéler ce monstre</span>
              </div>
            );
          }

          return (
            <div key={`${m.dungeonId}-${m.id}-${i}`} className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MonsterIcon id={m.id} emoji={m.emoji} size={28} title={m.name} />
                  <div className="flex flex-col">
                    <span className="font-bold text-rose-300">{m.name}</span>
                    <span className="text-[10px] text-slate-400">🏰 {m.dungeonName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">❤️ {m.hp}</div>
                  <div className="text-xs text-slate-300">🗡️ {m.atk} | 🛡️ {m.def}</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {m.element && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">Élément : {m.element}</span>}
                {m.dmgType && <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-300">Dégâts : {m.dmgType === 'magical' ? 'Magique' : 'Physique'}</span>}
                {m.weaknesses && m.weaknesses.length > 0 && (
                  <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-1.5 rounded">Faiblesse : {m.weaknesses.join(', ')}</span>
                )}
                {m.resistances && m.resistances.length > 0 && (
                  <span className="text-[10px] bg-rose-900/40 text-rose-300 px-1.5 rounded">Résistance : {m.resistances.join(', ')}</span>
                )}
              </div>
            </div>
          );
        })}

        {tab === 'classes' && BASE_CLASSES.map((base) => (
          <div key={base.id} className="space-y-2">
            <div className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{base.emoji}</span>
                <span className="font-bold text-sky-300">{base.name}</span>
                <span className="text-[10px] text-slate-500 ml-auto">
                  ❤️ {base.base.maxHp}+{base.growth.maxHp}/nv · 🗡️ {base.base.atk}+{base.growth.atk}/nv · 🛡️ {base.base.def}+{base.growth.def}/nv
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-1">{base.desc}</p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{base.playstyle}</p>
            </div>
            {getAscensions(base.id).map((sub) => (
              <div key={sub.id} className="rounded-lg bg-black/15 p-3 ml-3 border-l-2 border-sky-500/30">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{sub.emoji}</span>
                  <span className="font-bold text-emerald-300">{sub.name}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    ❤️ {sub.base.maxHp}+{sub.growth.maxHp}/nv · 🗡️ {sub.base.atk}+{sub.growth.atk}/nv · 🛡️ {sub.base.def}+{sub.growth.def}/nv
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1">{sub.desc}</p>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{sub.playstyle}</p>
              </div>
            ))}
          </div>
        ))}
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
