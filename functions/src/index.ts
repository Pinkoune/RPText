/**
 * Cloud Functions OPTIONNELLES (anti-triche).
 *
 * Le jeu fonctionne entièrement côté client (avec fallback localStorage). Pour
 * une version compétitive/production, on déplace les actions à enjeu côté serveur
 * afin qu'un joueur ne puisse pas falsifier son or, ses gains de gambling, etc.
 *
 * Déploiement (nécessite le plan Blaze) :
 *   cd functions && npm install && npm run deploy
 *
 * Ci-dessous : exemple de résolution sécurisée d'un duel PvP. Le tirage et le
 * transfert d'or sont faits par le serveur, pas par le client.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export const resolveDuel = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');

  const duelId = req.data?.duelId as string;
  if (!duelId) throw new HttpsError('invalid-argument', 'duelId manquant.');

  return db.runTransaction(async (tx) => {
    const duelRef = db.collection('duels').doc(duelId);
    const duelSnap = await tx.get(duelRef);
    if (!duelSnap.exists) throw new HttpsError('not-found', 'Duel introuvable.');

    const duel = duelSnap.data()!;
    if (duel.status !== 'open') throw new HttpsError('failed-precondition', 'Duel déjà résolu.');
    if (duel.hostUid === uid) throw new HttpsError('failed-precondition', 'Tu ne peux pas rejoindre ton propre duel.');

    const winnerUid = Math.random() < 0.5 ? duel.hostUid : uid;
    const loserUid = winnerUid === uid ? duel.hostUid : uid;
    const pot = duel.bet * 2;

    // Transfert d'or autoritatif côté serveur.
    tx.update(db.collection('players').doc(winnerUid), { gold: FieldValue.increment(pot - duel.bet) });
    tx.update(db.collection('players').doc(loserUid), { gold: FieldValue.increment(-duel.bet) });
    tx.update(duelRef, {
      status: 'resolved',
      guestUid: uid,
      winnerUid,
      flip: Math.random() < 0.5 ? 'heads' : 'tails',
      resolvedAt: Date.now(),
    });

    return { winnerUid };
  });
});

/**
 * Achat au marché côté serveur : vérifie le solde de l'acheteur, prélève la taxe,
 * crédite le vendeur et transfère l'objet — le tout de façon autoritative.
 * (Le client ne peut donc pas falsifier prix/taxe/inventaire.)
 */
const MARKET_TAX = 0.1;

export const buyMarketListing = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise.');
  const listingId = req.data?.listingId as string;
  if (!listingId) throw new HttpsError('invalid-argument', 'listingId manquant.');

  return db.runTransaction(async (tx) => {
    const lref = db.collection('market').doc(listingId);
    const lsnap = await tx.get(lref);
    if (!lsnap.exists) throw new HttpsError('not-found', 'Annonce introuvable.');
    const l = lsnap.data()!;
    if (l.status !== 'active') throw new HttpsError('failed-precondition', 'Annonce déjà vendue.');
    if (l.sellerUid === uid) throw new HttpsError('failed-precondition', 'Ta propre annonce.');

    const buyerRef = db.collection('players').doc(uid);
    const buyerSnap = await tx.get(buyerRef);
    const buyer = buyerSnap.data();
    if (!buyer || buyer.gold < l.price) throw new HttpsError('failed-precondition', 'Solde insuffisant.');

    const net = Math.round(l.price * (1 - MARKET_TAX));
    const inv = { ...(buyer.inventory ?? {}) };
    inv[l.itemId] = (inv[l.itemId] ?? 0) + 1;

    tx.update(buyerRef, { gold: buyer.gold - l.price, inventory: inv });
    tx.update(db.collection('players').doc(l.sellerUid), {
      gold: FieldValue.increment(net),
    });
    tx.update(lref, { status: 'sold', buyerUid: uid, soldAt: Date.now() });
    return { ok: true, net };
  });
});
