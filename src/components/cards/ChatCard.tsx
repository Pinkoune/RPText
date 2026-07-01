import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchChat, sendChat, chatOnline, type ChatMessage, type ChatChannel } from '../../firebase/chatService';
import { item } from '../../game/items';

const CHANNELS: { id: ChatChannel; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'team', label: 'Équipe' },
  { id: 'guild', label: 'Guilde' },
  { id: 'private', label: 'Privé' },
];

export default function ChatCard() {
  const p = useGame((s) => s.player);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<ChatChannel>('global');
  const [privateTarget, setPrivateTarget] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p) return;
    let targetId: string | undefined;
    if (activeTab === 'team') targetId = p.teamId ?? undefined;
    if (activeTab === 'guild') targetId = p.guildId ?? undefined;
    if (activeTab === 'private') targetId = p.name; // For private, we watch our own inbox
    
    return watchChat(activeTab, targetId, setMsgs);
  }, [activeTab, p?.teamId, p?.guildId, p?.name]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!p) return null;

  function send() {
    let t = text.trim();
    if (!t || !p) return;
    
    if (t === '/open') {
      if ((p.inventory['lootbox'] ?? 0) > 0) {
        useGame.getState().mutate((d) => {
          d.inventory['lootbox']--;
          const randomLoot = ['iron_ore', 'stone', 'wood', 'herb', 'potion', 'rusty_sword', 'cloth_robe', 'dungeon_key', 'repair_kit', 'upgrade_matrix'];
          const lootId = randomLoot[Math.floor(Math.random() * randomLoot.length)];
          d.inventory[lootId] = (d.inventory[lootId] ?? 0) + 1;
          useGame.getState().toast(`Lootbox ouverte ! Obtenu : ${item(lootId)!.name}.`, 'good');
        });
      } else {
        useGame.getState().toast("Vous n'avez pas de lootbox.", 'bad');
      }
      setText('');
      return;
    }

    // Whisper override
    if (t.startsWith('/w ')) {
      const parts = t.split(' ');
      if (parts.length >= 3) {
        const targetName = parts[1];
        const msgText = parts.slice(2).join(' ');
        sendChat({ uid: p.uid, name: p.name }, msgText, 'private', targetName);
        setText('');
        return;
      }
    }

    let targetId: string | undefined;
    if (activeTab === 'team') {
      if (!p.teamId) return useGame.getState().toast("Tu n'es pas dans une équipe.", 'bad');
      targetId = p.teamId;
    } else if (activeTab === 'guild') {
      if (!p.guildId) return useGame.getState().toast("Tu n'es pas dans une guilde.", 'bad');
      targetId = p.guildId;
    } else if (activeTab === 'private') {
      if (!privateTarget.trim()) return useGame.getState().toast("Utilise /w [Nom] [Message] ou clique sur un joueur.", 'bad');
      targetId = privateTarget.trim();
    }

    sendChat({ uid: p.uid, name: p.name }, t, activeTab, targetId);
    setText('');
  }

  function handlePlayerClick(name: string) {
    if (!p || name === p.name) return;
    setActiveTab('private');
    setPrivateTarget(name);
    setText(`/w ${name} `);
  }

  return (
    <div className="flex h-[55vh] max-h-[440px] flex-col">
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-white/5 mb-2">
        {CHANNELS.map(c => {
          let activeBg = 'bg-sky-500/40 text-white';
          if (c.id === 'team') activeBg = 'bg-emerald-900/60 border border-emerald-400/50 text-white';
          else if (c.id === 'guild') activeBg = 'bg-purple-900/60 border border-purple-400/50 text-white';
          else if (c.id === 'private') activeBg = 'bg-rose-900/60 border border-rose-400/50 text-white';
          
          return (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === c.id ? activeBg : 'bg-black/20 text-slate-400 hover:bg-white/10'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {!chatOnline && (
        <p className="mb-2 rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : messages visibles seulement sur cet appareil.
        </p>
      )}
      
      <div className="flex-1 space-y-1.5 overflow-auto rounded-lg bg-black/25 p-2">
        {msgs.length === 0 && <p className="text-xs text-slate-500">Aucun message ici. Dis bonjour 👋</p>}
        {msgs.map((m, i) => {
          let bg = '';
          if (m.channel === 'guild') bg = 'bg-purple-900/40 border-l-2 border-purple-400 pl-2 py-1 rounded-r';
          else if (m.channel === 'team') bg = 'bg-emerald-900/40 border-l-2 border-emerald-400 pl-2 py-1 rounded-r';
          else if (m.channel === 'private') bg = 'bg-rose-900/40 border-l-2 border-rose-400 pl-2 py-1 rounded-r';

          return (
            <div key={i} className={`text-sm ${bg}`}>
              {m.channel === 'private' && (
                <span className="text-[10px] text-rose-300 uppercase font-bold mr-1 block">
                  {m.name === p.name ? `À ${m.targetId}` : `De ${m.name}`}
                </span>
              )}
              <span 
                className={`font-semibold cursor-pointer hover:underline ${m.name === p.name ? 'text-sky-300' : 'text-emerald-300'}`}
                onClick={() => handlePlayerClick(m.name)}
              >
                {m.name}
              </span>
              <span className="text-slate-400"> : </span>
              <span className="break-words">{m.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={240}
          placeholder={activeTab === 'private' ? "Utilise /w Nom Message..." : "Écris un message…"}
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-400/50"
        />
        <button onClick={send} className="rounded-lg bg-sky-500/40 px-3 text-sm font-semibold hover:bg-sky-500/60">
          Envoyer
        </button>
      </div>
    </div>
  );
}
