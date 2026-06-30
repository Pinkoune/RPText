import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';

export interface AppUser {
  uid: string;
  name: string;
  photoURL: string | null;
}

const LOCAL_KEY = 'rptext.localUser';

function toAppUser(u: User): AppUser {
  return {
    uid: u.uid,
    name: u.displayName ?? 'Aventurier',
    photoURL: u.photoURL,
  };
}

/** Connexion Google (ou utilisateur local simulé si Firebase non configuré). */
export async function signInWithGoogle(): Promise<AppUser> {
  if (!isFirebaseConfigured || !auth) {
    const local: AppUser = {
      uid: 'local-' + Math.random().toString(36).slice(2, 10),
      name: 'Aventurier (local)',
      photoURL: null,
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
    return local;
  }
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return toAppUser(res.user);
}

export async function signOut(): Promise<void> {
  if (!isFirebaseConfigured || !auth) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }
  await fbSignOut(auth);
}

/** Observe l'état d'authentification. Retourne une fonction de désinscription. */
export function watchAuth(cb: (user: AppUser | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    const raw = localStorage.getItem(LOCAL_KEY);
    cb(raw ? (JSON.parse(raw) as AppUser) : null);
    // Pas de listener temps réel en mode local.
    return () => {};
  }
  return onAuthStateChanged(auth, (u) => cb(u ? toAppUser(u) : null));
}
