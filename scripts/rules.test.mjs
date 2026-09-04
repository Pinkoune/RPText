/* eslint-disable */
// Tests des règles Firestore contre l'ÉMULATEUR (pas une relecture à l'œil).
//
//   npx firebase emulators:exec --only firestore --project rptext-test \
//     "node scripts/rules.test.mjs"
//
// Chaque test dit ce qu'il protège. Un échec ici = un trou de sécurité réel.
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'rptext-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message?.split('\n')[0]}`); fail++; }
}

/** Doc de personnage minimal mais réaliste. */
const player = (uid, over = {}) => ({
  uid, name: 'Sim', photoURL: null, classId: 'warrior', level: 10, xp: 120,
  gold: 500, gems: 3, fateCoins: 2, kills: 40, deaths: 1, prestigeLevel: 0,
  relicShards: 0, createdAt: 1700000000000, lastSeen: 1700000000000,
  inventory: {}, equipped: {}, talents: {}, artifact: { season: 1, xp: 0, level: 5, mods: [] },
  ...over,
});
const row = (uid, over = {}) => ({
  uid, name: 'Sim', level: 10, kills: 40, prestigeLevel: 0, artifactLevel: 5, power: 60, ...over,
});

const ALICE = 'alice', BOB = 'bob', ADMIN = 'admin';
const as = (uid) => env.authenticatedContext(uid).firestore();

// Semences écrites en contournant les règles.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'players', ALICE), player(ALICE));
  await setDoc(doc(db, 'players', BOB), player(BOB));
  await setDoc(doc(db, 'players', ADMIN), { ...player(ADMIN), isAdmin: true });
  await setDoc(doc(db, 'leaderboard', ALICE), row(ALICE));
  await setDoc(doc(db, 'market', 'L1'), { sellerUid: ALICE, itemId: 'potion', price: 100, status: 'active' });
  await setDoc(doc(db, 'teams', 'T1'), { hostUid: ALICE, members: {} });
  await setDoc(doc(db, 'guilds', 'G1'), { ownerUid: ALICE, members: {}, xp: 0 });
});

console.log('\n── Escalade de privilèges ──');
await t("un joueur ne peut PAS se déclarer admin", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { isAdmin: true }))));
await t("un joueur ne peut PAS écrire le doc d'un autre", () =>
  assertFails(setDoc(doc(as(BOB), 'players', ALICE), player(ALICE))));
await t("un admin peut écrire n'importe quel doc", () =>
  assertSucceeds(setDoc(doc(as(ADMIN), 'players', ALICE), player(ALICE, { gold: 777 }))));
await t("système : écriture refusée aux non-admins", () =>
  assertFails(setDoc(doc(as(ALICE), 'system', 'config'), { lastWipe: 1 })));
await t("système : écriture autorisée à l'admin", () =>
  assertSucceeds(setDoc(doc(as(ADMIN), 'system', 'config'), { lastWipe: 1 })));
// Régression : `isAdminUser()` lisait `.data.isAdmin` en direct, ce qui LÈVE une
// erreur d'évaluation quand le champ est absent (le cas de tous les joueurs
// normaux) au lieu de renvoyer false. Ça marchait par court-circuit du `||` ;
// ça aurait cassé le jour où `isAdminUser()` passe en second opérande.
await t("isAdminUser() sur un doc SANS champ isAdmin renvoie false, sans erreur", () =>
  assertFails(setDoc(doc(as(BOB), 'system', 'config'), { lastWipe: 2 })));

console.log('\n── Bornes de vraisemblance (anti-triche serveur) ──');
await t("sauvegarde normale acceptée", () =>
  assertSucceeds(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { gold: 900, kills: 55 }))));
await t("niveau 9999 REFUSÉ (plafond 50)", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { level: 9999 }))));
await t("niveau 50 accepté", () =>
  assertSucceeds(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { level: 50, kills: 55 }))));
await t("or négatif REFUSÉ", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { gold: -5 }))));
await t("or absurde (1e12) REFUSÉ", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { gold: 1e12 }))));
await t("kills qui RECULENT refusés (monotone)", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { kills: 1 }))));
await t("prestige qui recule refusé", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), 'players', ALICE), player(ALICE, { kills: 55, prestigeLevel: 3 })));
  await assertFails(setDoc(doc(as(ALICE), 'players', ALICE), player(ALICE, { kills: 55, prestigeLevel: 0 })));
});
await t("createdAt réécrit REFUSÉ (contournement du wipe global)", () =>
  assertFails(setDoc(doc(as(ALICE), 'players', ALICE),
    player(ALICE, { kills: 55, prestigeLevel: 3, createdAt: Date.now() }))));
await t("l'or PEUT chuter (renaissance : gold = 100)", () =>
  assertSucceeds(setDoc(doc(as(ALICE), 'players', ALICE),
    player(ALICE, { kills: 55, prestigeLevel: 3, gold: 100, level: 1 }))));

console.log('\n── Classement : la ligne doit refléter le personnage ──');
await t("ligne conforme acceptée", () =>
  assertSucceeds(setDoc(doc(as(ALICE), 'leaderboard', ALICE),
    row(ALICE, { level: 1, kills: 55, prestigeLevel: 3 }))));
await t("niveau mensonger REFUSÉ", () =>
  assertFails(setDoc(doc(as(ALICE), 'leaderboard', ALICE),
    row(ALICE, { level: 50, kills: 55, prestigeLevel: 3 }))));
await t("kills mensongers REFUSÉS", () =>
  assertFails(setDoc(doc(as(ALICE), 'leaderboard', ALICE),
    row(ALICE, { level: 1, kills: 999999, prestigeLevel: 3 }))));
await t("puissance à 1e9 REFUSÉE", () =>
  assertFails(setDoc(doc(as(ALICE), 'leaderboard', ALICE),
    row(ALICE, { level: 1, kills: 55, prestigeLevel: 3, power: 1e9 }))));
await t("écrire la ligne d'un AUTRE joueur refusé", () =>
  assertFails(setDoc(doc(as(BOB), 'leaderboard', ALICE), row(ALICE))));

console.log('\n── Marché : plus de sabotage des annonces d\'autrui ──');
await t("un tiers ne peut PAS annuler l'annonce d'un autre", () =>
  assertFails(updateDoc(doc(as(BOB), 'market', 'L1'), { status: 'cancelled' })));
await t("le vendeur peut annuler la sienne", () =>
  assertSucceeds(updateDoc(doc(as(ALICE), 'market', 'L1'), { status: 'cancelled' })));
await t("un acheteur peut acheter (statut + buyerUid seulement)", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), 'market', 'L2'), { sellerUid: ALICE, itemId: 'potion', price: 100, status: 'active' }));
  await assertSucceeds(updateDoc(doc(as(BOB), 'market', 'L2'),
    { status: 'sold', buyerUid: BOB, soldAt: Date.now() }));
});
await t("un acheteur ne peut PAS baisser le prix en achetant", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    setDoc(doc(c.firestore(), 'market', 'L3'), { sellerUid: ALICE, itemId: 'potion', price: 9999, status: 'active' }));
  await assertFails(updateDoc(doc(as(BOB), 'market', 'L3'),
    { status: 'sold', buyerUid: BOB, soldAt: Date.now(), price: 1 }));
});

console.log('\n── Équipes / guildes : l\'hôte ne peut plus être détourné ──');
await t("un tiers ne peut PAS se déclarer hôte d'une équipe", () =>
  assertFails(updateDoc(doc(as(BOB), 'teams', 'T1'), { hostUid: BOB })));
await t("un membre peut rejoindre (hôte inchangé)", () =>
  assertSucceeds(updateDoc(doc(as(BOB), 'teams', 'T1'), { hostUid: ALICE, members: { bob: true } })));
await t("un tiers ne peut PAS s'approprier une guilde", () =>
  assertFails(updateDoc(doc(as(BOB), 'guilds', 'G1'), { ownerUid: BOB })));
await t("un membre peut contribuer (owner inchangé)", () =>
  assertSucceeds(updateDoc(doc(as(BOB), 'guilds', 'G1'), { ownerUid: ALICE, xp: 50 })));
await t("un tiers ne peut PAS supprimer une guilde", () =>
  assertFails(deleteDoc(doc(as(BOB), 'guilds', 'G1'))));

console.log('\n── Collections mortes retirées ──');
await t("`gifts` n'est plus écrivable", () =>
  assertFails(setDoc(doc(as(BOB), 'gifts', 'X'), { fromUid: BOB })));
await t("`duels` n'est plus écrivable", () =>
  assertFails(setDoc(doc(as(BOB), 'duels', 'X'), { hostUid: BOB })));

console.log('\n── Multi-personnages ──');
await t("le slot 1 (uid__1) est bien reconnu comme sien", () =>
  assertSucceeds(setDoc(doc(as(ALICE), 'players', ALICE + '__1'), player(ALICE + '__1'))));
await t("le perso d'un autre compte reste interdit", () =>
  assertFails(setDoc(doc(as(BOB), 'players', ALICE + '__1'), player(ALICE + '__1'))));

await env.cleanup();
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
