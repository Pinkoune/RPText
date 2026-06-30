import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { watchChat, sendChat, chatOnline, type ChatMessage } from '../../firebase/chatService';

export default function ChatCard() {
  const p = useGame((s) => s.player);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchChat(setMsgs), []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  if (!p) return null;

  function send() {
    if (!text.trim()) return;
    sendChat({ uid: p!.uid, name: p!.name }, text);
    setText('');
  }

  return (
    <div className="flex h-[55vh] max-h-[440px] flex-col">
      {!chatOnline && (
        <p className="mb-2 rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
          Mode local : messages visibles seulement sur cet appareil.
        </p>
      )}
      <div className="flex-1 space-y-1.5 overflow-auto rounded-lg bg-black/25 p-2">
        {msgs.length === 0 && <p className="text-xs text-slate-500">Aucun message. Dis bonjour 👋</p>}
        {msgs.map((m, i) => (
          <div key={i} className="text-sm">
            <span className={`font-semibold ${m.uid === p.uid ? 'text-sky-300' : 'text-emerald-300'}`}>
              {m.name}
            </span>
            <span className="text-slate-400"> : </span>
            <span className="break-words">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          maxLength={240}
          placeholder="Écris un message…"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-400/50"
        />
        <button onClick={send} className="rounded-lg bg-sky-500/40 px-3 text-sm font-semibold hover:bg-sky-500/60">
          Envoyer
        </button>
      </div>
    </div>
  );
}
