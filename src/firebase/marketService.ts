import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

export interface Listing {
  id: string;
  sellerUid: string;
  sellerName: string;
  itemId: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  buyerUid?: string;
  createdAt: number;
  soldAt?: number;
}

// ── Garde-fous anti-abus ─────────────────────────────────────────────────
export const MARKET_TAX = 0.1; // 10% prélevés au vendeur (puits d'or)
export const MAX_LISTINGS = 5; // annonces actives max par joueur
export const MARKET_MIN_LEVEL = 5; // niveau requis pour commercer

export const marketEnabled = isFirebaseConfigured && !!db;

/** Met un objet en vente (l'objet a déjà été mis en séquestre côté joueur). */
export async function listItem(
  seller: { uid: string; name: string },
  itemId: string,
  price: number,
): Promise<void> {
  if (!db) throw new Error('offline');
  await addDoc(collection(db, 'market'), {
    sellerUid: seller.uid,
    sellerName: seller.name,
    itemId,
    price,
    status: 'active',
    createdAt: Date.now(),
  });
}

export function listenMarket(cb: (listings: Listing[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'market'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) })));
  });
}

/** Achète une annonce de façon atomique. L'acheteur règle ensuite côté joueur. */
export async function buyListing(listing: Listing, buyerUid: string): Promise<void> {
  if (!db) throw new Error('offline');
  const ref = doc(db, 'market', listing.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('introuvable');
    const data = snap.data() as Omit<Listing, 'id'>;
    if (data.status !== 'active') throw new Error('déjà vendu');
    if (data.sellerUid === buyerUid) throw new Error('ta propre annonce');
    tx.update(ref, { status: 'sold', buyerUid, soldAt: Date.now() });
  });
}

/** Annule une annonce active (vendeur). L'objet est remboursé côté joueur. */
export async function cancelListing(id: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'market', id), { status: 'cancelled' });
}
