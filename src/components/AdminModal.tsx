import React, { useEffect, useState, useMemo } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { WindowFrame } from './WindowFrame';
import type { PlayerState } from '../game/types';
import { getAllPlayers, updatePlayerAdmin } from '../firebase/adminService';

export function AdminModal() {
  const { player, toast } = useGame();
  const { activeWindows, toggleWindow } = useUi();
  const win = activeWindows.find(w => w.kind === 'admin');
  
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<PlayerState | null>(null);

  // Stats to edit
  const [editLevel, setEditLevel] = useState(1);
  const [editXp, setEditXp] = useState(0);
  const [editGold, setEditGold] = useState(0);
  const [editGems, setEditGems] = useState(0);
  const [editFate, setEditFate] = useState(0);
  const [editKills, setEditKills] = useState(0);

  useEffect(() => {
    if (!win) return;
    loadPlayers();
  }, [win]);

  async function loadPlayers() {
    setLoading(true);
    try {
      const list = await getAllPlayers();
      setPlayers(list);
    } catch (e: any) {
      toast('Erreur chargement joueurs: ' + e.message, 'bad');
    }
    setLoading(false);
  }

  const filteredPlayers = useMemo(() => {
    const s = search.toLowerCase();
    return players
      .filter(p => p.name.toLowerCase().includes(s) || p.uid.toLowerCase().includes(s))
      .sort((a, b) => b.level - a.level);
  }, [players, search]);

  if (!win || !player?.isAdmin) return null;

  function handleEditClick(p: PlayerState) {
    setEditingPlayer(p);
    setEditLevel(p.level);
    setEditXp(p.xp);
    setEditGold(p.gold);
    setEditGems(p.gems ?? 0);
    setEditFate(p.fateCoins ?? 0);
    setEditKills(p.kills ?? 0);
  }

  async function handleSave() {
    if (!editingPlayer) return;
    try {
      await updatePlayerAdmin(editingPlayer.uid, {
        level: editLevel,
        xp: editXp,
        gold: editGold,
        gems: editGems,
        fateCoins: editFate,
        kills: editKills,
      });
      toast(`Joueur ${editingPlayer.name} mis à jour.`, 'good');
      setEditingPlayer(null);
      loadPlayers(); // Refresh list
    } catch (e: any) {
      toast('Erreur sauvegarde: ' + e.message, 'bad');
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-green-400 font-mono text-sm p-4 overflow-hidden">
      
      {editingPlayer ? (
        <div className="flex flex-col h-full bg-black/50 p-4 border border-green-500/30 rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl text-green-300 font-bold">Édition: {editingPlayer.name}</h2>
            <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded" onClick={() => setEditingPlayer(null)}>Retour</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2">
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Niveau</span>
              <input type="number" value={editLevel} onChange={e => setEditLevel(Number(e.target.value) || 1)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">XP</span>
              <input type="number" value={editXp} onChange={e => setEditXp(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Or (🪙)</span>
              <input type="number" value={editGold} onChange={e => setEditGold(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Gemmes (💎)</span>
              <input type="number" value={editGems} onChange={e => setEditGems(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Fate Coins (🎲)</span>
              <input type="number" value={editFate} onChange={e => setEditFate(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Kills (☠️)</span>
              <input type="number" value={editKills} onChange={e => setEditKills(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
          </div>
          
          <button className="mt-4 w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-colors"
            onClick={handleSave}>
            SAUVEGARDER LES MODIFICATIONS
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Rechercher un joueur..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-gray-900 border border-green-500/50 p-2 text-white rounded outline-none focus:border-green-400"
            />
            <button className="px-4 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded border border-green-500/30 transition-colors" onClick={loadPlayers}>
              Actualiser
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto border border-green-500/20 rounded bg-black/40">
            {loading ? (
              <div className="p-8 text-center text-green-500/70 animate-pulse">Chargement de la base de données...</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-900 border-b border-green-500/30">
                  <tr>
                    <th className="p-2 font-bold text-green-400">Nom</th>
                    <th className="p-2 font-bold text-green-400">Niv</th>
                    <th className="p-2 font-bold text-green-400">Or</th>
                    <th className="p-2 font-bold text-green-400">Kills</th>
                    <th className="p-2 font-bold text-green-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map(p => (
                    <tr key={p.uid} className="border-b border-green-500/10 hover:bg-green-900/20">
                      <td className="p-2 text-white">{p.name} <span className="text-gray-500 text-xs">({p.uid.slice(0, 5)}...)</span></td>
                      <td className="p-2 text-blue-300">Nv.{p.level}</td>
                      <td className="p-2 text-yellow-400">{p.gold}🪙</td>
                      <td className="p-2 text-red-400">{p.kills}☠️</td>
                      <td className="p-2 text-right">
                        <button 
                          className="px-3 py-1 bg-green-700/50 hover:bg-green-600/50 text-green-100 text-xs rounded border border-green-500/30"
                          onClick={() => handleEditClick(p)}>
                          ÉDITER
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && filteredPlayers.length === 0 && (
              <div className="p-8 text-center text-gray-500">Aucun joueur trouvé.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
