import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

/**
 * Si Firebase n'est pas configuré (.env.local manquant), le jeu tourne en
 * mode LOCAL : auth simulée + sauvegarde dans le localStorage. Pratique pour
 * développer sans credentials. Dès que les clés sont présentes, tout bascule
 * automatiquement sur le vrai backend Firebase.
 */
export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let rtdbInstance: Database | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(cfg);
  authInstance = getAuth(app);
  // ⚠️ `ignoreUndefinedProperties` : SANS lui, un seul champ à `undefined` dans
  // le doc joueur fait LEVER `setDoc`, donc échouer TOUTE la sauvegarde — et
  // comme `gameStore` appelle `void savePlayer(p)`, l'échec est silencieux : le
  // joueur continue de jouer pendant que plus rien n'est persisté. C'est
  // exactement ce qui est arrivé avec `pendingCombat = undefined` (abandon de
  // combat) et, avant lui, avec `expeditionBiome = undefined`.
  // La règle reste d'écrire `delete p.champ` (voir `abandon.ts endCombat`) ;
  // ceci est le filet, pas la solution.
  dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (cfg.databaseURL) rtdbInstance = getDatabase(app);
}

export const auth = authInstance;
export const db = dbInstance;
export const rtdb = rtdbInstance;
