import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

test.before(async () => {
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: 'museo-404-rules-test',
    firestore: { rules },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'museums', 'museum_alice_pub'), {
      ownerId: 'alice',
      isPublic: true,
    });
    await setDoc(doc(adminDb, 'guestbook', 'gb_alice_hidden'), {
      museumId: 'museum_alice_pub',
      islandId: 'patio',
      roomId: 'reception',
      scopeLabel: 'Recepción',
      nickname: 'Visitante',
      message: 'Entrada oculta de Alice',
      authorUid: null,
      isVisible: false,
      createdAt: new Date('2026-11-22T10:00:00Z'),
    });
    await setDoc(doc(adminDb, 'guestbook', 'gb_flagship_hidden'), {
      museumId: 'museo404',
      islandId: 'patio',
      roomId: 'reception',
      scopeLabel: 'Recepción',
      nickname: 'Visitante',
      message: 'Entrada oculta del museo insignia',
      authorUid: null,
      isVisible: false,
      createdAt: new Date('2026-11-22T10:00:00Z'),
    });
  });
});

test('only the museum owner or flagship admin can list hidden guestbook entries', async () => {
  const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();
  const adminDb = testEnv
    .authenticatedContext('flagship-admin', {
      email: 'sarvideleonardo@gmail.com',
      email_verified: true,
    })
    .firestore();
  const anonymousDb = testEnv.unauthenticatedContext().firestore();

  const aliceEntries = await assertSucceeds(
    getDocs(
      query(
        collection(aliceDb, 'guestbook'),
        where('museumId', '==', 'museum_alice_pub'),
        where('isVisible', '==', false),
        limit(50)
      )
    )
  );
  assert.equal(aliceEntries.size, 1);
  assert.equal(aliceEntries.docs[0].id, 'gb_alice_hidden');

  await assertFails(
    getDocs(
      query(
        collection(bobDb, 'guestbook'),
        where('museumId', '==', 'museum_alice_pub'),
        where('isVisible', '==', false),
        limit(50)
      )
    )
  );

  const flagshipEntries = await assertSucceeds(
    getDocs(
      query(
        collection(adminDb, 'guestbook'),
        where('museumId', '==', 'museo404'),
        where('isVisible', '==', false),
        limit(50)
      )
    )
  );
  assert.equal(flagshipEntries.size, 1);

  await assertFails(
    getDocs(
      query(
        collection(anonymousDb, 'guestbook'),
        where('museumId', '==', 'museum_alice_pub'),
        where('isVisible', '==', false),
        limit(50)
      )
    )
  );
});

test('a moderator can restore a hidden entry, but a non-owner cannot', async () => {
  const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();

  await assertFails(
    updateDoc(doc(bobDb, 'guestbook', 'gb_alice_hidden'), { isVisible: true })
  );
  await assertSucceeds(
    updateDoc(doc(aliceDb, 'guestbook', 'gb_alice_hidden'), { isVisible: true })
  );

  const restored = await assertSucceeds(
    getDocs(
      query(
        collection(aliceDb, 'guestbook'),
        where('museumId', '==', 'museum_alice_pub'),
        where('isVisible', '==', true),
        limit(50)
      )
    )
  );
  assert.equal(restored.size, 1);
});
