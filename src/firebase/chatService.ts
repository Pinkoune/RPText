import { ref, push, onValue, query, limitToLast } from 'firebase/database';
import { rtdb, isFirebaseConfigured } from './config';

export interface ChatMessage {
  uid: string;
  name: string;
  text: string;
  ts: number;
}

export const chatOnline = isFirebaseConfigured && !!rtdb;

const LOCAL_KEY = 'rptext.localChat';
let localMsgs: ChatMessage[] = [];
const localListeners = new Set<(m: ChatMessage[]) => void>();

function loadLocal(): ChatMessage[] {
  if (localMsgs.length) return localMsgs;
  const raw = localStorage.getItem(LOCAL_KEY);
  localMsgs = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  return localMsgs;
}

export function sendChat(me: { uid: string; name: string }, text: string): void {
  const clean = text.trim().slice(0, 240);
  if (!clean) return;
  const msg: ChatMessage = { uid: me.uid, name: me.name, text: clean, ts: Date.now() };
  if (!rtdb) {
    localMsgs = [...loadLocal(), msg].slice(-50);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localMsgs));
    localListeners.forEach((cb) => cb(localMsgs));
    return;
  }
  void push(ref(rtdb, 'chat'), msg);
}

export function watchChat(cb: (msgs: ChatMessage[]) => void): () => void {
  if (!rtdb) {
    cb(loadLocal());
    localListeners.add(cb);
    return () => localListeners.delete(cb);
  }
  const q = query(ref(rtdb, 'chat'), limitToLast(50));
  return onValue(q, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, ChatMessage>;
    cb(Object.values(val).sort((a, b) => a.ts - b.ts));
  });
}
