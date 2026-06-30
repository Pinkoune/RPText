import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { PlayerState } from '../game/types';

const localKey = (uid: string) => `rptext.player.${uid}`;

/** Charge le joueur (Firestore ou localStorage). null si inexistant. */
export async function loadPlayer(uid: string): Promise<PlayerState | null> {
  if (!isFirebaseConfigured || !db) {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? (JSON.parse(raw) as PlayerState) : null;
  }
  const snap = await getDoc(doc(db, 'players', uid));
  return snap.exists() ? (snap.data() as PlayerState) : null;
}

/** Sauvegarde le joueur. Met aussi à jour l'entrée de classement. */
export async function savePlayer(p: PlayerState): Promise<void> {
  p.lastSeen = Date.now();
  if (!isFirebaseConfigured || !db) {
    localStorage.setItem(localKey(p.uid), JSON.stringify(p));
    return;
  }
  await setDoc(doc(db, 'players', p.uid), p);
  await setDoc(doc(db, 'leaderboard', p.uid), {
    uid: p.uid,
    name: p.name,
    photoURL: p.photoURL,
    level: p.level,
    classId: p.classId,
    kills: p.kills,
    gold: p.gold,
    gambleNet: p.gambleNet,
    lastSeen: p.lastSeen,
  });
}
