import { ref, push, onValue, query, limitToLast, Unsubscribe } from 'firebase/database';
import { rtdb, isFirebaseConfigured } from './config';

export type ChatChannel = 'global' | 'team' | 'guild' | 'private';

export interface ChatMessage {
  uid: string;
  name: string;
  text: string;
  ts: number;
  channel?: ChatChannel;
  targetId?: string; // guildId, teamId, or recipient name
  system?: boolean; // annonce automatique du monde
  aura?: string;
  auraColorOn?: boolean;
}

export const chatOnline = isFirebaseConfigured && !!rtdb;

const LOCAL_KEY = 'rptext.localChat';
let localMsgs: ChatMessage[] = [];
const localListeners = new Set<(m: ChatMessage[]) => void>();

function loadLocal(channel?: ChatChannel): ChatMessage[] {
  if (localMsgs.length === 0) {
    const raw = localStorage.getItem(LOCAL_KEY);
    localMsgs = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  }
  return channel ? localMsgs.filter(m => m.channel === channel) : localMsgs;
}

export function sendChat(me: { uid: string; name: string; aura?: string; auraColorOn?: boolean }, text: string, channel: ChatChannel = 'global', targetId?: string): void {
  const clean = text.trim().slice(0, 240);
  if (!clean) return;
  const msg: ChatMessage = { uid: me.uid, name: me.name, text: clean, ts: Date.now(), channel };
  if (me.aura) msg.aura = me.aura;
  if (me.auraColorOn === false) msg.auraColorOn = false;
  if (targetId) msg.targetId = targetId;
  if (!rtdb) {
    localMsgs.push(msg);
    if (localMsgs.length > 50) localMsgs.shift();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localMsgs));
    localListeners.forEach((cb) => cb(localMsgs));
    return;
  }
  
  if (channel === 'team' && targetId) {
    void push(ref(rtdb, `chat/team/${targetId}`), msg);
  } else if (channel === 'guild' && targetId) {
    void push(ref(rtdb, `chat/guild/${targetId}`), msg);
  } else if (channel === 'private' && targetId) {
    // Send to recipient's inbox
    void push(ref(rtdb, `chat/inbox/${targetId}`), msg);
    // Send to my own inbox so I see what I sent
    if (targetId !== me.name) {
      void push(ref(rtdb, `chat/inbox/${me.name}`), { ...msg, targetId });
    }
  } else {
    void push(ref(rtdb, 'chat/global'), msg);
  }
}

/** Envoie une annonce système automatique dans le chat global (victoire notable, level-up...). */
export function sendAutoAnnounce(text: string): void {
  if (!rtdb) return;
  const msg = {
    uid: 'system',
    name: '\ud83c\udf0d Monde',
    text,
    ts: Date.now(),
    channel: 'global' as ChatChannel,
    system: true,
  };
  void push(ref(rtdb, 'chat/global'), msg);
}

export function watchChat(channel: ChatChannel, targetId: string | null | undefined, cb: (msgs: ChatMessage[]) => void): () => void {
  // Pas d'équipe/guilde : pas de canal à écouter, surtout pas un repli sur le
  // chat global (sinon les onglets Équipe/Guilde affichent le chat de tout le monde).
  if ((channel === 'team' || channel === 'guild') && !targetId) {
    cb([]);
    return () => {};
  }
  if (!rtdb) {
    const notifyLocal = () => cb(loadLocal(channel));
    notifyLocal();
    localListeners.add(notifyLocal);
    return () => localListeners.delete(notifyLocal);
  }
  
  let path = 'chat/global';
  if (channel === 'team' && targetId) path = `chat/team/${targetId}`;
  else if (channel === 'guild' && targetId) path = `chat/guild/${targetId}`;
  else if (channel === 'private' && targetId) path = `chat/inbox/${targetId}`; // For private, targetId is our own name

  const q = query(ref(rtdb, path), limitToLast(50));
  return onValue(q, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, ChatMessage>;
    cb(Object.values(val).sort((a, b) => a.ts - b.ts));
  });
}

/** 
 * A background watcher to get notifications for new messages across all relevant channels
 */
export function watchNotifications(
  myName: string,
  teamId: string | null | undefined,
  guildId: string | null | undefined,
  onNewMessage: (msg: ChatMessage) => void
): () => void {
  if (!rtdb) return () => {};

  const unsubs: Unsubscribe[] = [];
  let initialized = false;

  const bind = (path: string) => {
    const q = query(ref(rtdb!, path), limitToLast(1));
    let isFirst = true;
    const unsub = onValue(q, (snap) => {
      const val = snap.val() as Record<string, ChatMessage> | null;
      if (!val) return;
      const msgs = Object.values(val);
      if (msgs.length > 0) {
        const m = msgs[0];
        if (!isFirst && initialized && m.name !== myName) {
          onNewMessage(m);
        }
      }
      isFirst = false;
    });
    unsubs.push(unsub);
  };

  bind('chat/global');
  bind(`chat/inbox/${myName}`);
  if (teamId) bind(`chat/team/${teamId}`);
  if (guildId) bind(`chat/guild/${guildId}`);

  setTimeout(() => { initialized = true; }, 2000);

  return () => unsubs.forEach(u => u());
}
