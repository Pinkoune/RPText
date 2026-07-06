import React, { useEffect, useState, useMemo } from 'react';
import { useGame } from '../store/gameStore';
import type { PlayerState } from '../game/types';
import { getAllPlayers, updatePlayerAdmin, wipeAllChats, wipeEndlessScores, resetPvpSeason, triggerFullWipe, cleanupOrphanedPlayers } from '../firebase/adminService';
import { broadcastRaid } from '../firebase/raidService';
import { ITEMS, getItem } from '../game/items';
import { farmProgress } from '../game/gathering';
import { getCraftLevel } from '../game/crafting';
import { deriveStats } from '../game/player';
import { CLASSES } from '../game/classes';
import type { ClassId } from '../game/types';

export function AdminModal() {
  const { player, toast, mutate } = useGame();
  
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<PlayerState | null>(null);

  // Stats to edit
  const [editLevel, setEditLevel] = useState(1);
  const [editFarmLevel, setEditFarmLevel] = useState(1);
  const [editCraftLevel, setEditCraftLevel] = useState(1);
  const [editXp, setEditXp] = useState(0);
  const [editGold, setEditGold] = useState(0);
  const [editGems, setEditGems] = useState(0);
  const [editFate, setEditFate] = useState(0);
  const [editKills, setEditKills] = useState(0);
  const [editIgnoreRestrictions, setEditIgnoreRestrictions] = useState(false);

  function getFarmXpForLevel(lvl: number) {
    let xp = 0;
    for (let i = 1; i < lvl; i++) {
      xp += Math.floor(50 * Math.pow(i, 1.4)) + 50;
    }
    return xp;
  }

  function getCraftXpForLevel(lvl: number) {
    let xp = 0;
    for (let i = 1; i < lvl; i++) {
      xp += Math.floor(45 * Math.pow(i, 1.4));
    }
    return xp;
  }

  // Give item state
  const [giveItemId, setGiveItemId] = useState('potion');
  const [giveItemQty, setGiveItemQty] = useState(1);
  const [pickClassId, setPickClassId] = useState<ClassId>('warrior');

  const sortedItems = useMemo(() => {
    return Object.values(ITEMS).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  useEffect(() => {
    loadPlayers();
  }, []);

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

  if (!player?.isAdmin) return null;

  function handleEditClick(p: PlayerState) {
    setEditingPlayer(p);
    setEditLevel(p.level);
    setEditFarmLevel(farmProgress(p).level);
    setEditCraftLevel(getCraftLevel(p.craftXp || 0).level);
    setEditXp(p.xp);
    setEditGold(p.gold);
    setEditGems(p.gems ?? 0);
    setEditFate(p.fateCoins ?? 0);
    setEditKills(p.kills ?? 0);
    setEditIgnoreRestrictions(p.ignoreRestrictions ?? false);
  }

  /**
   * Écrit un patch sur le doc Firestore du joueur édité ET, si c'est le joueur
   * actuellement connecté (cas fréquent : un admin qui s'auto-teste), applique
   * le même patch à sa session locale via `mutate`. Sans ça, l'admin ne voyait
   * son propre changement qu'après un rechargement complet de la page (le
   * `player` du store n'est pas branché en live sur Firestore).
   */
  async function write(patch: Partial<PlayerState>) {
    if (!editingPlayer) return;
    await updatePlayerAdmin(editingPlayer.uid, patch);
    if (player && editingPlayer.uid === player.uid) {
      mutate((d) => { Object.assign(d, patch); });
    }
    setEditingPlayer((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  /** Change la classe du joueur édité : reset l'arbre de talents et déséquipe tout (rendu au sac). */
  async function changeClass(newClassId: ClassId) {
    if (!editingPlayer) return;
    if (!confirm(`Changer la classe de ${editingPlayer.name} en ${CLASSES[newClassId].name} ? Réinitialise les talents et déséquipe tout son matériel.`)) return;
    const newInv = { ...editingPlayer.inventory };
    for (const slot of ['weapon', 'armor', 'trinket', 'tool', 'profession_armor'] as const) {
      const id = editingPlayer.equipped[slot];
      if (id) newInv[id] = (newInv[id] ?? 0) + 1;
    }
    await write({
      classId: newClassId,
      talents: {},
      talentPoints: Math.max(0, editingPlayer.level - 1),
      equippedSkills: [],
      equipped: { weapon: null, armor: null, trinket: null, tool: null, profession_armor: null },
      inventory: newInv,
    });
    toast(`Classe changée en ${CLASSES[newClassId].name}.`, 'good');
  }

  async function handleSave() {
    if (!editingPlayer) return;
    try {
      const updates: any = {
        level: editLevel,
        xp: editXp,
        gold: editGold,
        gems: editGems,
        fateCoins: editFate,
        kills: editKills,
        ignoreRestrictions: editIgnoreRestrictions,
      };

      if (editFarmLevel !== farmProgress(editingPlayer).level) {
        updates.farmXp = getFarmXpForLevel(editFarmLevel);
      }
      if (editCraftLevel !== getCraftLevel(editingPlayer.craftXp || 0).level) {
        updates.craftXp = getCraftXpForLevel(editCraftLevel);
      }

      // Un niveau plus bas réduit les PV max : on clampe les PV stockés pour
      // éviter un joueur avec ex. 999999/209 PV (barre qui déborde, combats faussés).
      const newMaxHp = deriveStats({ ...editingPlayer, level: editLevel, xp: editXp }).maxHp;
      updates.hp = Math.max(1, Math.min(editingPlayer.hp, newMaxHp));

      await write(updates);
      toast(`Joueur ${editingPlayer.name} mis à jour.`, 'good');
      setEditingPlayer(null);
      loadPlayers(); // Refresh list
    } catch (e: any) {
      toast('Erreur sauvegarde: ' + e.message, 'bad');
    }
  }

  async function handleAction(action: string) {
    if (!editingPlayer) return;
    try {
      if (action === 'wipe_inventory') {
        if (!window.confirm('Vider tout l\'inventaire ?')) return;
        await write({ inventory: {} });
        toast('Inventaire vidé.', 'good');
      } else if (action === 'reset_talents') {
        if (!window.confirm('Réinitialiser les talents ?')) return;
        await write({ talents: {}, talentPoints: editingPlayer.level - 1, equippedSkills: [] });
        toast('Talents réinitialisés.', 'good');
      } else if (action === 'give_item') {
        if (giveItemQty <= 0) return;
        const newInv = { ...editingPlayer.inventory, [giveItemId]: (editingPlayer.inventory[giveItemId] || 0) + giveItemQty };
        await write({ inventory: newInv });
        toast(`Donné ${giveItemQty}x ${ITEMS[giveItemId]?.name || giveItemId}.`, 'good');
      } else if (action === 'remove_item') {
        if (giveItemQty <= 0) return;
        const current = editingPlayer.inventory[giveItemId] || 0;
        const next = Math.max(0, current - giveItemQty);
        const newInv = { ...editingPlayer.inventory };
        if (next === 0) delete newInv[giveItemId]; else newInv[giveItemId] = next;
        await write({ inventory: newInv });
        toast(`Retiré ${Math.min(giveItemQty, current)}x ${ITEMS[giveItemId]?.name || giveItemId}.`, 'good');
      } else if (action === 'full_heal') {
        const maxHp = deriveStats(editingPlayer).maxHp;
        await write({ hp: maxHp });
        toast('Joueur soigné et ressuscité.', 'good');
      } else if (action === 'level_up') {
        await write({ level: editingPlayer.level + 1 });
        toast('Niveau augmenté !', 'good');
      } else if (action === 'add_gold') {
        await write({ gold: editingPlayer.gold + 1000 });
        toast('1000 Or ajoutés !', 'good');
      } else if (action === 'reset_cooldowns') {
        // Reset complet : cooldowns "en tours" (donjon) + cooldown d'échec du
        // rituel de prestige (sinon celui-ci survivait au reset général).
        await write({ cooldowns: {}, combatCooldowns: {}, ascensionCooldownUntil: 0 });
        toast('Cooldowns réinitialisés !', 'good');
      } else if (action === 'level_up_farm') {
        const pFarm = farmProgress(editingPlayer);
        await write({ farmXp: (editingPlayer.farmXp || 0) + pFarm.need });
        toast('Niveau de récolte augmenté !', 'good');
      } else if (action === 'level_up_craft') {
        const pCraft = getCraftLevel(editingPlayer.craftXp || 0);
        await write({ craftXp: (editingPlayer.craftXp || 0) + pCraft.need });
        toast('Niveau d\'artisanat augmenté !', 'good');
      }
      loadPlayers();
    } catch (e: any) {
      toast('Erreur action: ' + e.message, 'bad');
    }
  }

  async function handleUnequip(slot: string, itemId: string) {
    if (!editingPlayer) return;
    try {
      const newEquipped = { ...(editingPlayer.equipped || {}), [slot]: null };
      const newInv = { ...(editingPlayer.inventory || {}), [itemId]: (editingPlayer.inventory[itemId] || 0) + 1 };
      await write({ equipped: newEquipped, inventory: newInv });
      toast(`Équipement ${slot} retiré.`, 'good');
      loadPlayers();
    } catch (e: any) {
      toast('Erreur déséquipement: ' + e.message, 'bad');
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
              <span className="text-gray-400">Niveau global</span>
              <input type="number" min="1" value={editLevel} onChange={e => setEditLevel(Number(e.target.value) || 1)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Niveau (Récolte)</span>
              <input type="number" min="1" value={editFarmLevel} onChange={e => setEditFarmLevel(Number(e.target.value) || 1)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Niveau (Artisanat)</span>
              <input type="number" min="1" value={editCraftLevel} onChange={e => setEditCraftLevel(Number(e.target.value) || 1)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">XP globale</span>
              <input type="number" min="0" value={editXp} onChange={e => setEditXp(Number(e.target.value) || 0)} className="bg-gray-900 border border-green-500/30 p-2 text-white rounded" />
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
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-400">Bypass restrictions (équipement + niveaux requis)</span>
              <button
                className={`py-2 rounded font-bold border transition-colors ${editIgnoreRestrictions ? 'bg-red-900/50 text-red-200 border-red-500/50 hover:bg-red-800' : 'bg-green-900/50 text-green-200 border-green-500/50 hover:bg-green-800'}`}
                onClick={() => setEditIgnoreRestrictions(!editIgnoreRestrictions)}
              >
                {editIgnoreRestrictions ? '⚠️ BYPASS ACTIF (équipe tout + ignore niveaux)' : '✅ NORMAL (restrictions actives)'}
              </button>
            </label>
          </div>
          
          <button className="mt-4 w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-colors"
            onClick={handleSave}>
            SAUVEGARDER LES MODIFICATIONS
          </button>
          
          <div className="mt-6 border-t border-green-500/30 pt-4">
            <h3 className="text-green-300 font-bold mb-2">Donner un objet</h3>
            <div className="flex gap-2 mb-4">
              <select 
                value={giveItemId} 
                onChange={e => setGiveItemId(e.target.value)}
                className="flex-1 bg-gray-900 border border-green-500/50 p-2 text-white rounded"
              >
                {sortedItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.icon} {item.name} ({item.id})
                  </option>
                ))}
              </select>
              <input 
                type="number" 
                min="1"
                value={giveItemQty} 
                onChange={e => setGiveItemQty(Number(e.target.value) || 1)}
                className="w-20 bg-gray-900 border border-green-500/50 p-2 text-white rounded"
              />
              <button
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded"
                onClick={() => handleAction('give_item')}
              >
                Donner
              </button>
              <button
                className="px-4 py-2 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded"
                onClick={() => handleAction('remove_item')}
              >
                Retirer
              </button>
            </div>

            <h3 className="text-green-300 font-bold mb-2">Actions Rapides</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button className="py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded" onClick={() => handleAction('full_heal')}>💖 Soigner (Max HP)</button>
              <button className="py-2 bg-teal-900 hover:bg-teal-800 text-teal-100 rounded" onClick={() => handleAction('reset_cooldowns')}>⏳ Reset Cooldowns</button>
              <button className="py-2 bg-yellow-700 hover:bg-yellow-600 text-yellow-100 rounded" onClick={() => handleAction('add_gold')}>🪙 +1000 Or</button>
              <button className="py-2 bg-yellow-900 hover:bg-yellow-800 text-yellow-100 rounded" onClick={() => handleAction('reset_talents')}>🔄 Reset Talents</button>
              <button className="py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded col-span-2" onClick={() => handleAction('wipe_inventory')}>🗑️ Vider Inventaire</button>
              <button className="py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded col-span-2 sm:col-span-3" onClick={async () => {
                try { await broadcastRaid(); toast('🔱 Fenêtre de raid ouverte pour tous (10 min d\'inscription).', 'good'); }
                catch { toast('Impossible (hors ligne ?).', 'bad'); }
              }}>🔱 Ouvrir une fenêtre de Raid</button>
            </div>

            <div className="mt-6 border-t border-green-500/30 pt-4">
              <h3 className="text-green-300 font-bold mb-2">Changer de classe</h3>
              <p className="text-[11px] text-gray-500 mb-2">Réinitialise l'arbre de talents et déséquipe tout le matériel (rendu au sac). Sous-classes bloquées sous le niveau 20 (`migratePlayer` renvoie de force à la classe de base sinon).</p>
              <div className="flex gap-2">
                <select
                  value={pickClassId}
                  onChange={(e) => setPickClassId(e.target.value as ClassId)}
                  className="flex-1 bg-gray-900 border border-green-500/30 p-2 text-white rounded"
                >
                  <optgroup label="Classes de base">
                    {Object.entries(CLASSES).filter(([, c]) => !c.parent).map(([id, c]) => (
                      <option key={id} value={id}>{c.emoji} {c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Sous-classes (Nv.20+)">
                    {Object.entries(CLASSES).filter(([, c]) => c.parent).map(([id, c]) => (
                      <option key={id} value={id}>{c.emoji} {c.name}</option>
                    ))}
                  </optgroup>
                </select>
                <button className="px-3 py-2 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded whitespace-nowrap" onClick={() => changeClass(pickClassId)}>
                  Changer
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-green-500/30 pt-4">
              <h3 className="text-green-300 font-bold mb-2">Équipement Actuel</h3>
              <div className="grid grid-cols-2 gap-2 text-gray-300 bg-black/40 p-2 rounded border border-green-500/20">
                {Object.entries(editingPlayer.equipped || {}).map(([slot, itemId]) => {
                  const it = getItem(itemId as string);
                  if (!it) return null;
                  return (
                    <div key={slot} className="flex justify-between items-center border-b border-gray-800 pb-1">
                      <div className="flex flex-col">
                        <span className="text-gray-500 capitalize text-xs">{slot}</span>
                        <span className="text-blue-300">{it.icon} {it.name}</span>
                      </div>
                      <button 
                        className="px-2 py-1 bg-red-900/50 hover:bg-red-800/80 text-red-200 text-xs rounded border border-red-500/30 transition-colors"
                        onClick={() => handleUnequip(slot, itemId as string)}
                        title="Déséquiper"
                      >
                        Retirer
                      </button>
                    </div>
                  );
                })}
                {Object.values(editingPlayer.equipped || {}).every(v => !v) && (
                  <span className="text-gray-500 italic">Aucun équipement</span>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-green-500/30 pt-4">
              <h3 className="text-green-300 font-bold mb-2">Inventaire</h3>
              <div className="grid grid-cols-2 gap-2 text-gray-300 max-h-40 overflow-y-auto bg-black/40 p-2 rounded border border-green-500/20">
                {Object.entries(editingPlayer.inventory || {}).map(([itemId, qty]) => {
                  if (qty <= 0) return null;
                  const it = getItem(itemId);
                  return (
                    <div key={itemId} className="flex justify-between border-b border-gray-800 pb-1">
                      <span className="text-gray-400">{it ? `${it.icon} ${it.name}` : itemId}</span>
                      <span className="text-green-400 font-bold">x{qty}</span>
                    </div>
                  );
                })}
                {Object.keys(editingPlayer.inventory || {}).length === 0 && (
                  <span className="text-gray-500 italic">Inventaire vide</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-red-500/30 bg-red-900/10 flex justify-end gap-2 mb-4">
            <button
              onClick={async () => {
                if (window.confirm("Vider tous les chats (global, équipes, guildes, messagerie privée) ? Irréversible.")) {
                  try {
                    await wipeAllChats();
                    toast("Chats vidés.", "good");
                  } catch (e: any) {
                    toast("Erreur nettoyage chat: " + e.message, "bad");
                  }
                }
              }}
              className="px-3 py-1 bg-red-700/50 hover:bg-red-600/80 text-red-100 text-xs font-bold rounded border border-red-500/50"
            >
              🧹 VIDER LES CHATS
            </button>
            <button
              onClick={async () => {
                if (window.confirm("Vider le classement des Abysses Infinis (solo + multi) ? Irréversible.")) {
                  try {
                    await wipeEndlessScores();
                    toast("Classement Abysses vidé.", "good");
                  } catch (e: any) {
                    toast("Erreur nettoyage Abysses: " + e.message, "bad");
                  }
                }
              }}
              className="px-3 py-1 bg-red-700/50 hover:bg-red-600/80 text-red-100 text-xs font-bold rounded border border-red-500/50"
            >
              🌌 VIDER CLASSEMENT ABYSSES
            </button>
            <button
              onClick={async () => {
                if (window.confirm("Remettre à 0 les points de saison PvP de TOUS les joueurs (le ladder repart de zéro immédiatement, la saison en cours continue) ? Irréversible.")) {
                  try {
                    const n = await resetPvpSeason();
                    toast(`Saison PvP réinitialisée (${n} joueur(s)).`, "good");
                  } catch (e: any) {
                    toast("Erreur reset saison: " + e.message, "bad");
                  }
                }
              }}
              className="px-3 py-1 bg-red-700/50 hover:bg-red-600/80 text-red-100 text-xs font-bold rounded border border-red-500/50"
            >
              🏆 RESET SAISON PVP
            </button>
            <button
              onClick={async () => {
                if (window.confirm("DANGER : WIPE COMPLET —\n• Tous les joueurs renvoyés à la sélection de classe\n• Chat (global/équipe/guilde/privé) vidé\n• Classement (& saison PvP) vidé\n• Classement Abysses (solo+multi) vidé\n• Guildes supprimées\n• Stats/succès des joueurs repartent à zéro (nouveaux persos)\n\nEs-tu ABSOLUMENT certain ?") && window.confirm("C'EST LA PURGE FINALE. Confirmer ?")) {
                  try {
                    await triggerFullWipe();
                    toast("Wipe TOTAL déclenché avec succès. Tout est purgé.", "good");
                  } catch (e: any) {
                    toast("Erreur wipe total: " + e.message, "bad");
                  }
                }
              }}
              className="px-3 py-1 bg-red-900 hover:bg-red-700 text-red-100 text-xs font-black rounded border border-red-500 shadow-lg"
            >
              🔥 WIPE TOTAL (TOUT PURGER)
            </button>
            <button
              onClick={async () => {
                if (window.confirm("Purge des comptes fantômes : supprime les comptes joueurs qui NE SE SONT PAS reconnectés depuis le dernier wipe global (donc pas encore recréés).\n\n⚠️ N'utilise ceci qu'après avoir laissé un vrai délai de grâce (plusieurs jours/semaines) — tout joueur (y compris toi en tant qu'admin) qui ne s'est pas encore reconnecté perdra son statut Vétéran/Admin s'il revient APRÈS cette purge.\n\nContinuer ?")) {
                  try {
                    const n = await cleanupOrphanedPlayers();
                    toast(n > 0 ? `🧹 ${n} compte(s) fantôme(s) supprimé(s).` : "Aucun compte fantôme à nettoyer (ou pas de wipe en cours).", "good");
                  } catch (e: any) {
                    toast("Erreur nettoyage: " + e.message, "bad");
                  }
                }
              }}
              className="px-3 py-1 bg-red-950 hover:bg-red-800 text-red-200 text-xs font-bold rounded border border-red-700/60"
            >
              🧹 Purger comptes fantômes (post-wipe)
            </button>
          </div>
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
            {player && (
              <button 
                className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded border border-purple-500/30 transition-colors" 
                onClick={() => {
                  const levels = [1, 5, 10, 15, 20, 30];
                  console.log("=== SIMULATION DE COURBE DE STATS ===");
                  const getBestStat = (slot: string, lvl: number, stat: 'atk' | 'def' | 'hp'): number => {
                    const valid = Object.values(ITEMS)
                      .filter((i: any) => i.slot === slot && (i.reqLevel || 1) <= lvl);
                    return valid.reduce((max: number, i: any) => Math.max(max, i[stat] || 0), 0);
                  };
                  for (const lvl of levels) {
                    const wp = getBestStat('weapon', lvl, 'atk');
                    const am = getBestStat('armor', lvl, 'def');
                    const ah = getBestStat('armor', lvl, 'hp');
                    const tkA = getBestStat('trinket', lvl, 'atk');
                    const tkD = getBestStat('trinket', lvl, 'def');
                    const tkH = getBestStat('trinket', lvl, 'hp');
                    
                    const maxHpBase = 100 + (lvl - 1) * 20;
                    const atkBase = 5 + (lvl - 1) * 2;
                    const defBase = 5 + (lvl - 1) * 1;
                    
                    const hpStars = (ah + tkH) * 1.5;
                    const atkStars = (wp + tkA) * 1.5;
                    const defStars = (am + tkD) * 1.5;
                    
                    console.log(`Lvl ${lvl} | Base: HP=${maxHpBase} ATK=${atkBase} DEF=${defBase} | Gear (Max+Etoiles): HP=${Math.round(hpStars)} ATK=${Math.round(atkStars)} DEF=${Math.round(defStars)}`);
                  }
                  toast('Simulation terminée. Vérifiez la console (F12).', 'good');
                }}
              >
                📊 Simuler Courbe (Console)
              </button>
            )}
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
