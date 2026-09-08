import { collection, getDocs, query, orderBy, limit, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, onValue, onDisconnect, set, remove, serverTimestamp } from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from './config';
import type { ClassId, PlayerState } from '../game/types';
import { fallbackPower, powerScore } from '../game/power';

/**
 * Retrouve l'UID d'un personnage depuis son pseudo, via le classement (qui
 * porte `uid` et `name`). Sert au raccourci `/w Nom` : les messages privés sont
 * rangés par UID, donc il faut résoudre le pseudo — y compris pour quelqu'un de
 * déconnecté, absent de la liste de présence.
 *
 * ⚠️ Les pseudos ne sont pas uniques (chacun choisit le sien dans le Profil) :
 * en cas d'homonymie on prend la première ligne trouvée. C'est le raccourci de
 * confort ; le chemin fiable reste de cliquer sur la personne.
 */
export async function findUidByName(name: string): Promise<string | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), where('name', '==', name), limit(1)));
    return snap.empty ? null : (snap.docs[0].data() as { uid?: string }).uid ?? snap.docs[0].id;
  } catch {
    return null;
  }
}

/** Lit le profil public d'un joueur (best-effort). Null si indisponible. */
export async function fetchPublicProfile(uid: string): Promise<Partial<PlayerState> | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'players', uid));
    return snap.exists() ? (snap.data() as Partial<PlayerState>) : null;
  } catch {
    return null;
  }
}

export interface LeaderRow {
  uid: string;
  name: string;
  photoURL: string | null;
  level: number;
  xp?: number;
  classId: ClassId;
  kills: number;
  gold: number;
  gambleNet: number;
  lastSeen?: number;
  title?: string;
  seasonId?: string | null;
  seasonPoints?: number;
  prestigeAura?: string;
  prestigeLevel?: number;
  auraColorOn?: boolean;
  /** Cote de Puissance (voir game/power.ts). Absente sur les lignes d'anciens clients. */
  power?: number;
  /** Niveau d'artefact = progression de saison (voir game/season.ts). */
  artifactLevel?: number;
}

export interface OnlinePlayer {
  uid: string;
  name: string;
  level: number;
  /** Dernière activité (ms côté client). Sert à repérer les inactifs. */
  lastActive?: number;
  /** Temps de jeu cumulé (ms) — diffusé via la présence, donc visible seulement en ligne. */
  playtimeMs?: number;
}

/**
 * Puissance reconstruite depuis le doc joueur, pour les lignes écrites avant
 * l'arrivée du champ `power`. Clé = uid de personnage, valeur = score complet.
 *
 * Pourquoi ce détour : le repli `fallbackPower` ne dispose que de ce que la
 * LIGNE transporte (niveau, kills, prestige), et surtout pas de l'artefact —
 * `power` et `artifactLevel` ayant été ajoutés à la ligne dans la même
 * livraison, une ligne sans `power` n'a jamais d'`artifactLevel`. Le classement
 * mélangeait donc deux échelles : les joueurs reconnectés depuis affichaient
 * leur score complet (artefact, Relique, maîtrises, étoiles…), les autres un
 * niveau + racine de kills. D'où des inversions visibles en jeu — un Nv.45 à
 * 1 418 kills classé sous un Nv.20 actif — et le constat « la Puissance ne
 * compte pas l'artefact », exact pour ces lignes-là.
 *
 * Le doc `players/<uid>` est lisible par tout compte connecté (règle
 * `match /players/{charId}: allow read`), donc on peut y calculer le vrai
 * `powerScore`. Une seule lecture par joueur et par session (`tried` empêche
 * de rejouer un échec ou un doc absent), et seulement pour les lignes qui n'ont
 * pas déjà `power` — le nombre de lectures tend vers zéro à mesure que les
 * joueurs se reconnectent.
 */
const hydratedPower = new Map<string, number>();
const triedPower = new Set<string>();

/** Plafond de lectures par instantané, pour ne pas exploser le quota Firestore. */
const HYDRATE_MAX = 40;

/**
 * Complète les lignes sans `power`. Renvoie `true` si au moins une valeur a été
 * récupérée, donc s'il faut reclasser.
 */
async function hydratePower(rows: LeaderRow[]): Promise<boolean> {
  const todo = rows.filter((r) => r.power == null && r.uid && !triedPower.has(r.uid)).slice(0, HYDRATE_MAX);
  if (todo.length === 0) return false;
  for (const r of todo) triedPower.add(r.uid);
  const got = await Promise.all(
    todo.map(async (r) => {
      const doc = await fetchPublicProfile(r.uid);
      return [r.uid, doc ? powerScore(doc as PlayerState).total : null] as const;
    }),
  );
  let any = false;
  for (const [uid, total] of got) {
    if (total != null) { hydratedPower.set(uid, total); any = true; }
  }
  return any;
}

/** Puissance d'une ligne : la vraie, sinon celle reconstruite, sinon le repli. */
export function rowPower(r: LeaderRow): number {
  return r.power ?? hydratedPower.get(r.uid) ?? fallbackPower(r);
}

/**
 * Classement par Puissance, puis niveau, puis XP brute.
 *
 * Le tri se fait ICI plutôt que dans la requête Firestore : un `orderBy('power')`
 * exclurait purement et simplement les documents qui ne portent pas encore le
 * champ (les lignes écrites par un client plus ancien disparaîtraient du
 * tableau jusqu'à la prochaine connexion de leur propriétaire).
 *
 * Départage à Puissance égale par l'XP brute : comme le seuil pour passer au
 * niveau suivant ne dépend que du niveau (pas du joueur), comparer l'XP brute
 * entre deux joueurs du même niveau revient à comparer leur % de progression.
 */
function byPower(a: LeaderRow, b: LeaderRow): number {
  const d = rowPower(b) - rowPower(a);
  if (d !== 0) return d;
  if (b.level !== a.level) return b.level - a.level;
  return (b.xp ?? 0) - (a.xp ?? 0);
}

/** Comptes admin de service (nommés "admin") : masqués de tous les classements/recherches publics. */
function isHiddenName(name: string | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'admin';
}

/**
 * Facteur de sur-échantillonnage.
 *
 * La requête doit trier sur `level` (seul champ présent sur TOUTES les lignes,
 * y compris celles d'anciens clients), mais le classement affiché est celui de
 * la Puissance. Sans marge, `limit` couperait sur le mauvais critère : un joueur
 * qui vient de renaître est au Nv.1 tout en pesant très lourd en Puissance, et
 * il serait purement et simplement absent du tableau. On rapatrie donc large,
 * on trie, puis on tranche.
 */
const OVERFETCH = 4;

function rank(rows: LeaderRow[], max: number): LeaderRow[] {
  return rows.filter((r) => !isHiddenName(r.name)).sort(byPower).slice(0, max);
}

/** Top joueurs par Puissance. Vide en mode local. */
export async function fetchLeaderboard(max = 20): Promise<LeaderRow[]> {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max * OVERFETCH));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => d.data() as LeaderRow);
  await hydratePower(rows);
  return rank(rows, max);
}

export function watchLeaderboard(max: number, onChange: (rows: LeaderRow[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max * OVERFETCH));
  let stopped = false;
  const unsub = onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => d.data() as LeaderRow);
    // Affiche tout de suite avec ce qu'on a, puis reclasse si la reconstruction
    // rapporte quelque chose — sinon le classement attendrait un aller-retour
    // réseau par joueur à chaque ouverture de la carte.
    onChange(rank(rows, max));
    void hydratePower(rows).then((any) => { if (any && !stopped) onChange(rank(rows, max)); });
  });
  return () => { stopped = true; unsub(); };
}

/**
 * Ladder de la saison courante : top joueurs par points de saison.
 * On trie côté serveur par seasonPoints puis on filtre la saison courante
 * côté client (évite un index composite Firestore).
 */
export function watchSeasonLadder(currentSeasonId: string, max: number, onChange: (rows: LeaderRow[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onChange([]);
    return () => {};
  }
  // Même précaution que pour la Puissance : trier côté serveur sur un champ que
  // toutes les lignes ne portent pas encore exclurait les anciennes. On trie sur
  // `level`, présent partout, puis on classe côté client sur l'artefact.
  const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), limit(max * 4));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => d.data() as LeaderRow)
      .filter((r) => r.seasonId === currentSeasonId && (r.artifactLevel ?? 0) > 0 && !isHiddenName(r.name))
      .sort((a, b) => (b.artifactLevel ?? 0) - (a.artifactLevel ?? 0))
      .slice(0, max);
    onChange(rows);
  });
}

/**
 * Déclare le joueur en ligne et écoute la liste des présents.
 * Utilise la Realtime Database (présence fiable via onDisconnect).
 */
/**
 * Au-delà de ce délai sans activité, une entrée de présence est considérée
 * comme un fantôme et n'est plus servie. Calé sur le seuil au-delà duquel
 * LeaderboardCard masquait déjà les joueurs (30 min) : les blocs « En ligne »
 * (<5 min) et « Inactif » (5-30 min) sont donc inchangés.
 */
const PRESENCE_STALE_MS = 30 * 60 * 1000;

// Référence de présence du joueur courant, pour rafraîchir son activité.
let myPresenceRef: ReturnType<typeof ref> | null = null;
let myPresenceData: { uid: string; name: string; level: number; playtimeMs?: number } | null = null;

export function trackPresence(
  me: { uid: string; name: string; level: number; playtimeMs?: number },
  onChange: (players: OnlinePlayer[]) => void,
): () => void {
  if (!isFirebaseConfigured || !rtdb) {
    onChange([{ ...me, lastActive: Date.now() }]);
    return () => {};
  }
  const meRef = ref(rtdb, `presence/${me.uid}`);
  myPresenceRef = meRef;
  myPresenceData = me;
  set(meRef, { ...me, ts: serverTimestamp(), lastActive: Date.now() });
  onDisconnect(meRef).remove();

  const listRef = ref(rtdb, 'presence');
  const unsub = onValue(listRef, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, OnlinePlayer>;
    const now = Date.now();
    onChange(
      Object.values(val)
        .filter((o) => !isHiddenName(o.name))
        // Nœuds fantômes : `onDisconnect` ne se déclenche qu'à la coupure de la
        // CONNEXION. Un onglet tué, un mobile mis en veille, un réseau qui
        // tombe mal — et l'entrée reste « en ligne » indéfiniment. On filtre
        // donc sur l'activité réelle, comme le fait déjà LeaderboardCard.
        // ⚠️ `lastActive` absent = vieille entrée d'un client d'avant ce champ :
        // on la traite comme périmée, et surtout PAS comme active (c'était le
        // cas avant — `idleMs` renvoyait 0, donc « en ligne » pour toujours).
        .filter((o) => o.lastActive != null && now - o.lastActive < PRESENCE_STALE_MS),
    );
  });
  return () => {
    // Ne PAS se contenter de couper l'écoute : sans ce retrait, changer de
    // personnage ou se déconnecter laissait le nœud derrière soi jusqu'à la
    // coupure de la connexion. Le joueur voyait alors « 1 autre joueur en
    // ligne » — son propre personnage précédent. Remonté en bêta par un joueur
    // pourtant seul sur le serveur.
    onDisconnect(meRef).cancel().catch(() => { /* connexion déjà perdue */ });
    remove(meRef).catch(() => { /* idem */ });
    myPresenceRef = null;
    myPresenceData = null;
    unsub();
  };
}

/**
 * Retire explicitement le joueur de la liste des présents.
 *
 * Le nettoyage de `trackPresence` suffit au changement de personnage, mais PAS
 * à la déconnexion : `logout` attend `signOut()` avant de vider le store, donc
 * le nettoyage React ne partirait qu'une fois désauthentifié — et la règle RTDB
 * (`auth.uid === $uid`) refuserait le retrait. Il faut donc l'appeler AVANT de
 * se déconnecter, tant qu'on en a encore le droit.
 */
export async function clearPresence(): Promise<void> {
  const meRef = myPresenceRef;
  myPresenceRef = null;
  myPresenceData = null;
  if (!meRef) return;
  try {
    await onDisconnect(meRef).cancel();
    await remove(meRef);
  } catch { /* déjà parti, ou connexion perdue */ }
}

/** Rafraîchit l'horodatage d'activité du joueur (appelé à chaque action). */
export function touchPresence(): void {
  if (!myPresenceRef || !myPresenceData || !rtdb) return;
  set(myPresenceRef, { ...myPresenceData, ts: serverTimestamp(), lastActive: Date.now() });
}

/** Met à jour le temps de jeu diffusé en présence (PresenceTracker, toutes les 30s). */
export function updatePresencePlaytime(playtimeMs: number): void {
  if (!myPresenceRef || !myPresenceData || !rtdb) return;
  myPresenceData = { ...myPresenceData, playtimeMs };
  set(myPresenceRef, { ...myPresenceData, ts: serverTimestamp(), lastActive: Date.now() });
}
