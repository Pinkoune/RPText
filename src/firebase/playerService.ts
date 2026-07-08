import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { PlayerState } from '../game/types';
import { syncGuildMember } from './groupsService';

const localKey = (uid: string) => `rptext.player.${uid}`;

/** Signature du dernier sync de guilde par joueur (évite les écritures Firestore redondantes). */
const lastGuildSyncSig = new Map<string, string>();

/** Vrai si un autre joueur porte déjà ce pseudo (exact, sensible à la casse). */
export async function isNameTaken(name: string, excludeUid?: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;
  if (!isFirebaseConfigured || !db) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('rptext.player.')) continue;
      const uid = key.slice('rptext.player.'.length);
      if (uid === excludeUid) continue;
      try {
        const other = JSON.parse(localStorage.getItem(key)!) as PlayerState;
        if (other.name === clean) return true;
      } catch { /* ignore */ }
    }
    return false;
  }
  const q = query(collection(db, 'leaderboard'), where('name', '==', clean), limit(2));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeUid);
}

/**
 * Détecte un reset global déclenché PENDANT la session en cours (écoute live
 * `system/config.lastWipe`). Sans ça, un client déjà ouvert au moment du wipe
 * continue de sauvegarder ses anciennes données (`savePlayer` n'a aucun check
 * de wipe, seul `loadPlayer` au chargement le fait) et peut réapparaître dans
 * le classement fraîchement vidé. `onWipe` doit forcer un rechargement complet
 * pour couper court à toute sauvegarde ultérieure.
 */
export function watchGlobalWipe(onWipe: () => void): () => void {
  if (!isFirebaseConfigured || !db) return () => {};
  const since = Date.now();
  return onSnapshot(doc(db, 'system', 'config'), (snap) => {
    const lastWipe = snap.exists() ? (snap.data().lastWipe ?? 0) : 0;
    if (lastWipe > since) onWipe();
  });
}

/** Charge le joueur (Firestore ou localStorage). null si inexistant. */
export async function loadPlayer(uid: string): Promise<PlayerState | null> {
  if (!isFirebaseConfigured || !db) {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? (JSON.parse(raw) as PlayerState) : null;
  }
  const snap = await getDoc(doc(db, 'players', uid));
  if (!snap.exists()) return null;
  const p = snap.data() as PlayerState;

  // Check for global wipe
  try {
    const sysSnap = await getDoc(doc(db, 'system', 'config'));
    if (sysSnap.exists()) {
      const lastWipe = sysSnap.data().lastWipe ?? 0;
      if (p.createdAt && p.createdAt < lastWipe) {
        // The player was created before the wipe, so they must start over.
        localStorage.setItem(`rptext.legacy.${uid}`, 'true');
        localStorage.setItem(`rptext.legacyCreatedAt.${uid}`, p.createdAt.toString());
        if (p.isAdmin) {
          localStorage.setItem(`rptext.wasAdmin.${uid}`, 'true');
        }
        return null;
      }
      
      // If we made it here, they survive the wipe (or are already new)
      if (p.isLegacy) {
        localStorage.setItem(`rptext.legacy.${uid}`, 'true');
      }
    }
  } catch (e) {
    console.error('Failed to check system config for wipe:', e);
  }

  return p;
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
    xp: p.xp,
    classId: p.classId,
    kills: p.kills,
    gold: p.gold,
    gambleNet: p.gambleNet,
    lastSeen: p.lastSeen,
    title: p.title ?? null,
    seasonId: p.seasonId ?? null,
    seasonPoints: p.seasonPoints ?? 0,
    prestigeAura: p.prestigeAura ?? null,
    prestigeLevel: p.prestigeLevel ?? 0,
    auraColorOn: p.auraColorOn ?? true,
  });
  // Garde la fiche membre de guilde à jour (niveau/titre figés sinon depuis l'entrée dans la guilde).
  // `savePlayer` est appelé très souvent (mutate débounced à 800ms) : ne réécrit
  // le doc guilde que si quelque chose de pertinent a réellement changé, pour
  // ne pas tripler le volume d'écritures Firestore à chaque sauvegarde (quota).
  if (p.guildId) {
    const sig = `${p.guildId}:${p.level}:${p.title ?? ''}:${p.name}:${p.prestigeAura ?? ''}:${p.auraColorOn ?? true}`;
    if (lastGuildSyncSig.get(p.uid) !== sig) {
      // Ne marque le sync "fait" qu'APRÈS succès — avant, la signature était posée
      // avant même l'écriture (fire-and-forget), donc un échec silencieux (offline,
      // race sur le doc guilde...) figeait le membre pour de bon : plus aucune
      // relance tant que level/titre/nom/aura ne rechangeaient pas, alors que le
      // classement (setDoc inconditionnel juste au-dessus) restait toujours à jour.
      void syncGuildMember(p.guildId, p.uid, {
        name: p.name,
        level: p.level,
        title: p.title ?? null,
        aura: p.prestigeAura ?? null,
        auraColorOn: p.auraColorOn ?? true,
      }).then(() => { lastGuildSyncSig.set(p.uid, sig); });
    }
  }
}
