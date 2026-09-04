/* eslint-disable */
// Tests des règles Realtime Database contre l'ÉMULATEUR.
//
//   npx firebase emulators:exec --only database --project rptext-test \
//     "node scripts/rtdb-rules.test.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, push, remove } from 'firebase/database';
import { readFileSync } from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'rptext-test',
  database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message?.split('\n')[0]}`); fail++; }
}

const ALICE = 'alice', BOB = 'bob', ADMIN = 'admin';
const as = (uid) => env.authenticatedContext(uid).database();
const msg = (uid, name, text) => ({ uid, name, text, ts: Date.now() });

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.database();
  await set(ref(db, 'admins/' + ADMIN), true);
  await set(ref(db, `chat/inbox/${ALICE}/m1`), msg(BOB, 'Bob', 'coucou alice'));
  await set(ref(db, 'chat/global/m1'), msg(ALICE, 'Alice', 'salut'));
  await set(ref(db, 'world/raid'), { until: 0 });
});

console.log('\n── Messagerie privée ──');
await t("je lis MA boîte", () =>
  assertSucceeds(get(ref(as(ALICE), `chat/inbox/${ALICE}`))));
await t("je ne peux PAS lire la boîte d'un autre", () =>
  assertFails(get(ref(as(BOB), `chat/inbox/${ALICE}`))));
await t("je ne peux pas lire TOUT chat/inbox d'un coup", () =>
  assertFails(get(ref(as(BOB), 'chat/inbox'))));
await t("je peux déposer un message chez quelqu'un", () =>
  assertSucceeds(push(ref(as(BOB), `chat/inbox/${ALICE}`), msg(BOB, 'Bob', 'nouveau'))));
await t("je ne peux PAS effacer un message dans la boîte d'un autre", () =>
  assertFails(remove(ref(as(BOB), `chat/inbox/${ALICE}/m1`))));
await t("je peux effacer un message de MA boîte", () =>
  assertSucceeds(remove(ref(as(ALICE), `chat/inbox/${ALICE}/m1`))));
await t("mon perso slot 1 (uid__1) lit bien sa boîte", () =>
  assertSucceeds(get(ref(as(ALICE), `chat/inbox/${ALICE}__1`))));
await t("un message trop long est refusé (240 car.)", () =>
  assertFails(push(ref(as(BOB), `chat/inbox/${ALICE}`), msg(BOB, 'Bob', 'x'.repeat(241)))));

console.log('\n── Chat public : plus de vandalisme ──');
await t("j'écris un message global", () =>
  assertSucceeds(push(ref(as(BOB), 'chat/global'), msg(BOB, 'Bob', 'hello'))));
await t("je ne peux PAS réécrire le message d'un autre", () =>
  assertFails(set(ref(as(BOB), 'chat/global/m1'), msg(BOB, 'Bob', 'piraté'))));
await t("je ne peux PAS vider le chat global", () =>
  assertFails(remove(ref(as(BOB), 'chat/global'))));
await t("je ne peux PAS vider TOUT le chat", () =>
  assertFails(remove(ref(as(BOB), 'chat'))));
await t("un admin PEUT effacer un message", () =>
  assertSucceeds(set(ref(as(ADMIN), 'chat/global/m1'), null)));

console.log('\n── Événements mondiaux ──');
await t("un joueur ne peut PAS déclencher une fenêtre de raid", () =>
  assertFails(set(ref(as(BOB), 'world/raid'), { until: Date.now() + 600000 })));
await t("un admin le peut", () =>
  assertSucceeds(set(ref(as(ADMIN), 'world/raid'), { until: Date.now() + 600000 })));
await t("tout le monde peut LIRE l'événement mondial", () =>
  assertSucceeds(get(ref(as(BOB), 'world/raid'))));

console.log('\n── Présence ──');
await t("je déclare ma propre présence", () =>
  assertSucceeds(set(ref(as(BOB), `presence/${BOB}`), { uid: BOB, name: 'Bob', level: 1 })));
await t("je ne peux PAS déclarer celle d'un autre", () =>
  assertFails(set(ref(as(BOB), `presence/${ALICE}`), { uid: ALICE, name: 'Alice', level: 99 })));

console.log('\n── `admins` : pas d\'auto-promotion ──');
await t("un joueur ne peut PAS s'ajouter aux admins", () =>
  assertFails(set(ref(as(BOB), 'admins/' + BOB), true)));
await t("un admin non plus (console Firebase uniquement)", () =>
  assertFails(set(ref(as(ADMIN), 'admins/' + BOB), true)));

await env.cleanup();
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
