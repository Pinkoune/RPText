import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { watchChat, sendChat, chatOnline, type ChatMessage, type ChatChannel } from '../../firebase/chatService';
import { trackPresence, type OnlinePlayer } from '../../firebase/socialService';
import { item, addItemToInventory } from '../../game/items';
import { auraColor } from '../../game/prestige';
import { fetchPublicProfile } from '../../firebase/socialService';
import PlayerProfileModal, { type ProfileSeed } from '../PlayerProfileModal';
import { COMMANDS } from '../../game/commands';

const TEAM_REQ_LEVEL = COMMANDS.find((c) => c.name === 'team')?.reqLevel ?? 1;
const GUILD_REQ_LEVEL = COMMANDS.find((c) => c.name === 'guild')?.reqLevel ?? 1;

const CHANNELS: { id: ChatChannel; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'team', label: 'Équipe' },
  { id: 'guild', label: 'Guilde' },
  { id: 'private', label: 'Privé' },
];

export default function ChatCard({ initialPayload }: { initialPayload?: { tab?: ChatChannel; dmPeer?: string } } = {}) {
  const p = useGame((s) => s.player);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<ChatChannel>(initialPayload?.dmPeer ? 'private' : initialPayload?.tab ?? 'global');
  const [dmPeer, setDmPeer] = useState<string | null>(initialPayload?.dmPeer ?? null); // conversation privée ouverte
  const [showNewDm, setShowNewDm] = useState(false);
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [viewingProfile, setViewingProfile] = useState<ProfileSeed | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useGame.getState().markChatRead();
    return () => useGame.getState().setActiveChatView(null);
  }, []);

  // Onglet/conversation actuellement affiché : sert à ne pas notifier une
  // conversation déjà sous les yeux (voir App.tsx watchNotifications).
  useEffect(() => {
    useGame.getState().setActiveChatView(
      activeTab === 'private' ? (dmPeer ? { tab: 'private' as const, dmPeer } : null) : { tab: activeTab }
    );
  }, [activeTab, dmPeer]);

  useEffect(() => {
    if (initialPayload?.dmPeer) { setActiveTab('private'); setDmPeer(initialPayload.dmPeer); }
    else if (initialPayload?.tab) { setActiveTab(initialPayload.tab); }
  }, [initialPayload]);

  useEffect(() => {
    if (!p) return;
    let targetId: string | undefined;
    if (activeTab === 'team') targetId = p.teamId ?? undefined;
    if (activeTab === 'guild') targetId = p.guildId ?? undefined;
    if (activeTab === 'private') targetId = p.name; // on écoute notre propre boîte de réception
    return watchChat(activeTab, targetId, setMsgs);
  }, [activeTab, p?.teamId, p?.guildId, p?.name]);

  // Joueurs en ligne (pour choisir un destinataire de DM).
  useEffect(() => {
    if (!p) return;
    return trackPresence({ uid: p.uid, name: p.name, level: p.level }, setOnline);
  }, [p?.uid, p?.name, p?.level]);

  // Fils de discussion privés dérivés de la boîte de réception.
  const threads = useMemo(() => {
    if (!p) return [] as { peer: string; peerUid?: string; last: ChatMessage }[];
    const map = new Map<string, ChatMessage>();
    for (const m of msgs) {
      const peer = m.name === p.name ? (m.targetId ?? '') : m.name;
      if (!peer) continue;
      const prev = map.get(peer);
      if (!prev || m.ts > prev.ts) map.set(peer, m);
    }
    return [...map.entries()]
      .map(([peer, last]) => {
        // uid du destinataire : cherché dans un message qu'il a lui-même envoyé,
        // sinon repli sur la liste des joueurs en ligne.
        const theirMsg = msgs.find((m) => m.name === peer);
        const peerUid = theirMsg?.uid ?? online.find((o) => o.name === peer)?.uid;
        return { peer, peerUid, last };
      })
      .sort((a, b) => b.last.ts - a.last.ts);
  }, [msgs, p?.name, online]);

  // Avatars des interlocuteurs privés (photo de profil au lieu de la 1ère lettre).
  useEffect(() => {
    for (const t of threads) {
      if (!t.peerUid || t.peerUid in avatars) continue;
      const uid = t.peerUid;
      setAvatars((a) => ({ ...a, [uid]: undefined as any })); // marque "en cours" pour ne pas re-fetch
      fetchPublicProfile(uid).then((full) => setAvatars((a) => ({ ...a, [uid]: full?.photoURL ?? null })));
    }
  }, [threads]);

  // Messages du fil ouvert.
  const dmMessages = useMemo(() => {
    if (!p || !dmPeer) return [] as ChatMessage[];
    return msgs.filter((m) => (m.name === p.name ? m.targetId === dmPeer : m.name === dmPeer));
  }, [msgs, dmPeer, p?.name]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, dmPeer, activeTab]);

  if (!p) return null;

  function openDm(name: string) {
    if (name === p!.name) return;
    setActiveTab('private');
    setDmPeer(name);
    setShowNewDm(false);
  }

  function send() {
    let t = text.trim();
    if (!t || !p) return;

    if (t === '/open') {
      if ((p.inventory['lootbox'] ?? 0) > 0) {
        useGame.getState().mutate((d) => {
          d.inventory['lootbox']--;
          const randomLoot = ['iron_ore', 'stone', 'wood', 'herb', 'potion', 'rusty_sword', 'cloth_robe', 'dungeon_key', 'repair_kit', 'upgrade_matrix'];
          const lootId = randomLoot[Math.floor(Math.random() * randomLoot.length)];
          addItemToInventory(d.inventory, lootId, 1);
          useGame.getState().toast(`Lootbox ouverte ! Obtenu : ${item(lootId)!.name}.`, 'good');
        });
      } else {
        useGame.getState().toast("Vous n'avez pas de lootbox.", 'bad');
      }
      setText('');
      return;
    }

    // Raccourci optionnel /w Nom Message (pour les habitués) — ouvre le fil ciblé.
    if (t.startsWith('/w ')) {
      const parts = t.split(' ');
      if (parts.length >= 3) {
        const targetName = parts[1];
        const msgText = parts.slice(2).join(' ');
        sendChat({ uid: p.uid, name: p.name, aura: p.prestigeAura, auraColorOn: p.auraColorOn }, msgText, 'private', targetName);
        setActiveTab('private');
        setDmPeer(targetName);
        setText('');
        return;
      }
    }

    // Onglet privé : on envoie directement à la personne du fil ouvert.
    if (activeTab === 'private') {
      if (!dmPeer) return useGame.getState().toast('Choisis un destinataire à gauche.', 'bad');
      sendChat({ uid: p.uid, name: p.name, aura: p.prestigeAura, auraColorOn: p.auraColorOn }, t, 'private', dmPeer);
      setText('');
      return;
    }

    let targetId: string | undefined;
    if (activeTab === 'team') {
      if (!p.teamId) return useGame.getState().toast("Tu n'es pas dans une équipe.", 'bad');
      targetId = p.teamId;
    } else if (activeTab === 'guild') {
      if (!p.guildId) return useGame.getState().toast("Tu n'es pas dans une guilde.", 'bad');
      targetId = p.guildId;
    }

    sendChat({ uid: p.uid, name: p.name, aura: p.prestigeAura, auraColorOn: p.auraColorOn }, t, activeTab, targetId);
    setText('');
  }

  const onlineOthers = online.filter((o) => o.name !== p.name);

  return (
    <div className="flex h-[55vh] max-h-[440px] flex-col">
      {/* Onglets de canaux */}
      <div className="mb-2 flex gap-1 overflow-x-auto border-b border-white/5 pb-2">
        {CHANNELS.map((c) => {
          let activeBg = 'bg-sky-500/40 text-white';
          if (c.id === 'team') activeBg = 'bg-emerald-900/60 border border-emerald-400/50 text-white';
          else if (c.id === 'guild') activeBg = 'bg-purple-900/60 border border-purple-400/50 text-white';
          else if (c.id === 'private') activeBg = 'bg-rose-900/60 border border-rose-400/50 text-white';
          const reqLevel = c.id === 'team' ? TEAM_REQ_LEVEL : c.id === 'guild' ? GUILD_REQ_LEVEL : 1;
          const locked = p.level < reqLevel;
          return (
            <button
              key={c.id}
              disabled={locked}
              onClick={() => { setActiveTab(c.id); if (c.id !== 'private') setShowNewDm(false); }}
              title={locked ? `Débloqué au niveau ${reqLevel}` : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${locked ? 'cursor-not-allowed bg-black/10 text-slate-600' : activeTab === c.id ? activeBg : 'bg-black/20 text-slate-400 hover:bg-white/10'}`}
            >
              {locked ? `🔒 ${c.label} Nv.${reqLevel}` : c.label}
            </button>
          );
        })}
      </div>

      {!chatOnline && (
        <p className="mb-2 rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">Mode local : messages visibles seulement sur cet appareil.</p>
      )}

      {/* ═══ Pas d'équipe/guilde : rien à écouter, on propose d'en rejoindre une ═══ */}
      {(activeTab === 'team' && !p.teamId) || (activeTab === 'guild' && !p.guildId) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-black/25 p-4 text-center">
          <p className="text-sm text-slate-400">
            {activeTab === 'team' ? "Tu n'es dans aucune équipe." : "Tu n'es dans aucune guilde."}
          </p>
          <button
            onClick={() => useUi.getState().open(activeTab === 'team' ? 'team' : 'guild', undefined, { singleton: true })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'team' ? 'bg-emerald-500/30 hover:bg-emerald-500/50' : 'bg-purple-500/30 hover:bg-purple-500/50'}`}
          >
            {activeTab === 'team' ? '👥 Rejoindre / créer une équipe' : '🏰 Rejoindre / créer une guilde'}
          </button>
        </div>
      ) : activeTab === 'private' ? (
        !dmPeer ? (
          // Liste des conversations + nouveau message
          <div className="flex-1 space-y-2 overflow-auto rounded-lg bg-black/25 p-2">
            <button onClick={() => setShowNewDm((v) => !v)} className="w-full rounded-lg bg-rose-500/30 py-2 text-sm font-semibold hover:bg-rose-500/50">
              ＋ Nouveau message
            </button>

            {showNewDm && (
              <div className="rounded-lg bg-black/30 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Joueurs en ligne</div>
                {onlineOthers.length === 0 ? (
                  <p className="text-xs text-slate-500">Personne d'autre en ligne.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {onlineOthers.map((o) => (
                      <button key={o.uid} onClick={() => openDm(o.name)} className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs hover:bg-rose-500/40">
                        💬 {o.name} <span className="text-slate-400">Nv.{o.level}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {threads.length === 0 ? (
              <p className="px-1 text-xs text-slate-500">Aucune conversation. Clique « Nouveau message » ou sur un pseudo dans le chat.</p>
            ) : (
              threads.map((th) => {
                const avatarUrl = th.peerUid ? avatars[th.peerUid] : null;
                return (
                  <button key={th.peer} onClick={() => openDm(th.peer)} className="flex w-full items-center gap-2 rounded-lg bg-black/30 p-2 text-left hover:bg-white/10">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/20 text-sm">{th.peer[0]?.toUpperCase() ?? '?'}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-rose-200">{th.peer}</div>
                      <div className="truncate text-[11px] text-slate-400">{th.last.name === p.name ? 'Toi : ' : ''}{th.last.text}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          // Fil de conversation ouvert
          <>
            <div className="mb-2 flex items-center gap-2">
              <button onClick={() => setDmPeer(null)} className="rounded bg-black/30 px-2 py-1 text-xs hover:bg-white/10">← Fils</button>
              <div className="text-sm font-semibold text-rose-200">💬 {dmPeer}</div>
              {onlineOthers.some((o) => o.name === dmPeer) && <span className="text-[10px] text-emerald-400">● en ligne</span>}
            </div>
            <div className="flex-1 space-y-1.5 overflow-auto rounded-lg bg-black/25 p-2">
              {dmMessages.length === 0 && <p className="text-xs text-slate-500">Début de ta conversation avec {dmPeer}.</p>}
              {dmMessages.map((m, i) => {
                const dateStr = new Date(m.ts).toLocaleDateString();
                const prevDateStr = i > 0 ? new Date(dmMessages[i - 1].ts).toLocaleDateString() : '';
                const showDate = dateStr !== prevDateStr;
                const mine = m.name === p.name;
                return (
                  <div key={i}>
                    {showDate && (
                      <div className="my-2 flex items-center justify-center gap-2">
                        <div className="h-px w-8 bg-white/20"></div>
                        <span className="text-[10px] uppercase text-slate-400">{dateStr}</span>
                        <div className="h-px w-8 bg-white/20"></div>
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-sky-500/30 rounded-br-sm' : 'bg-rose-500/20 rounded-bl-sm'}`}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          </>
        )
      ) : (
        /* ═══ Canaux publics ═══ */
        <div className="flex-1 space-y-1.5 overflow-auto rounded-lg bg-black/25 p-2">
          {msgs.length === 0 && <p className="text-xs text-slate-500">Aucun message ici. Dis bonjour 👋</p>}
          {msgs.map((m, i) => {
            const dateStr = new Date(m.ts).toLocaleDateString();
            const prevDateStr = i > 0 ? new Date(msgs[i - 1].ts).toLocaleDateString() : '';
            const showDate = dateStr !== prevDateStr;

            let bg = '';
            if (m.channel === 'guild') bg = 'bg-purple-900/40 border-l-2 border-purple-400 pl-2 py-1 rounded-r';
            else if (m.channel === 'team') bg = 'bg-emerald-900/40 border-l-2 border-emerald-400 pl-2 py-1 rounded-r';
            return (
              <div key={i}>
                {showDate && (
                  <div className="my-2 flex items-center justify-center gap-2">
                    <div className="h-px w-8 bg-white/20"></div>
                    <span className="text-[10px] uppercase text-slate-400">{dateStr}</span>
                    <div className="h-px w-8 bg-white/20"></div>
                  </div>
                )}
                {(m as any).system ? (
                  // Annonce système du monde
                  <div className="my-1 flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-amber-500/20"></div>
                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] text-amber-300 font-semibold">
                      {m.text}
                    </span>
                    <div className="h-px flex-1 bg-amber-500/20"></div>
                  </div>
                ) : (
                  <div className={`text-sm ${bg}`}>
                    <span
                      className={`cursor-pointer font-semibold hover:underline ${m.name === p.name ? 'text-sky-300' : 'text-emerald-300'}`}
                      style={{ color: auraColor(m.aura, m.auraColorOn ?? true) }}
                      onClick={() => m.name !== p.name && setViewingProfile({ uid: m.uid, name: m.name, prestigeAura: m.aura, auraColorOn: m.auraColorOn })}
                    >
                      {m.name}
                    </span>
                    <span className="text-slate-400"> : </span>
                    <span className="break-words">{m.text}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {/* Saisie — masquée dans la liste des fils privés et sans équipe/guilde (rien à envoyer) */}
      {!(activeTab === 'private' && !dmPeer) && !(activeTab === 'team' && !p.teamId) && !(activeTab === 'guild' && !p.guildId) && (
        <div className="mt-2 flex gap-2">
          <input
            data-keep-enter
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            maxLength={240}
            placeholder={activeTab === 'private' ? `Message à ${dmPeer}…` : 'Écris un message…'}
            className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-400/50"
          />
          <button onClick={send} className="rounded-lg bg-sky-500/40 px-3 text-sm font-semibold hover:bg-sky-500/60">Envoyer</button>
        </div>
      )}

      {viewingProfile && (
        <PlayerProfileModal
          row={viewingProfile}
          onClose={() => setViewingProfile(null)}
          onMessage={() => { openDm(viewingProfile.name); setViewingProfile(null); }}
        />
      )}
    </div>
  );
}
