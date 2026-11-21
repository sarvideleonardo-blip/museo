/**
 * Security Rules Verification Suite (Firestore Emulator + Phase 0 TDD Contract)
 *
 * Run against the Firebase Emulator Suite (requires Java):
 *   npx firebase emulators:exec --only firestore "node --experimental-strip-types --test firestore.rules.test.ts"
 */

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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Museum Create',
    collectionPath: '/museums/museum_alice_1',
    operation: 'create',
    authUid: 'alice',
    emailVerified: true,
    payload: { ownerId: 'bob', title: 'Spoofed Museum' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Ghost / Shadow Field Injection',
    collectionPath: '/museums/museum_alice_2',
    operation: 'create',
    authUid: 'alice',
    emailVerified: true,
    payload: { ownerId: 'alice', title: 'Valid', isAdminVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    collectionPath: '/museums/museum_unverified',
    operation: 'create',
    authUid: 'carol',
    emailVerified: false,
    payload: { ownerId: 'carol', title: 'Unverified' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Scrape Private Museums via List',
    collectionPath: '/museums',
    operation: 'list',
    authUid: 'bob',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned Piece Without Existing Parent Museum',
    collectionPath: '/museums/missing_museum/pieces/piece_1',
    operation: 'create',
    authUid: 'alice',
    emailVerified: true,
    payload: { museumId: 'missing_museum', ownerId: 'alice', title: 'Orphan' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Foreign Piece Insertion Into Alice Museum',
    collectionPath: '/museums/museum_alice_1/pieces/piece_hack',
    operation: 'create',
    authUid: 'bob',
    emailVerified: true,
    payload: { museumId: 'museum_alice_1', ownerId: 'bob', title: 'Hijack' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable ownerId / createdAt Modification',
    collectionPath: '/museums/museum_alice_1',
    operation: 'update',
    authUid: 'alice',
    emailVerified: true,
    payload: { ownerId: 'bob' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Value Poisoning / Mixed Disjoint Update Keys',
    collectionPath: '/museums/museum_alice_1',
    operation: 'update',
    authUid: 'alice',
    emailVerified: true,
    payload: { title: 'x'.repeat(180) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Array Flood (> 20 Islands)',
    collectionPath: '/museums/museum_alice_1',
    operation: 'update',
    authUid: 'alice',
    emailVerified: true,
    payload: { islands: Array.from({ length: 25 }, (_, i) => ({ id: `i_${i}` })) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid MIME mediaDataUrl or javascript: URL',
    collectionPath: '/museums/museum_alice_1/pieces/piece_xss',
    operation: 'create',
    authUid: 'alice',
    emailVerified: true,
    payload: { mediaDataUrl: 'data:text/html,<script>alert(1)</script>', url: 'javascript:alert(1)' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning',
    collectionPath: '/museums/bad$id!poison',
    operation: 'create',
    authUid: 'alice',
    emailVerified: true,
    payload: { ownerId: 'alice', title: 'Bad ID' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'PII Leak on User Private Profile',
    collectionPath: '/users/alice/private/profile',
    operation: 'get',
    authUid: 'bob',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'CuratedFrom Source Attribution Spoofing',
    collectionPath: '/museums/museum_bob_1/pieces/piece_spoof_curated',
    operation: 'create',
    authUid: 'bob',
    emailVerified: true,
    payload: {
      curatedFrom: {
        sourceMuseumId: 'museum_alice_pub',
        sourceMuseumTitle: 'Falsified Title',
        sourceAuthorName: 'Alice',
        sourcePieceId: 'piece_1',
        sourcePieceTitle: 'Original Work',
      },
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'PII Leak on Purchase Inquiries (Non-Owner List/Get)',
    collectionPath: '/purchaseInquiries',
    operation: 'list',
    authUid: 'bob',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Purchase Inquiry Status Shortcutting or Owner Spoofing',
    collectionPath: '/purchaseInquiries/inq_bad',
    operation: 'create',
    authUid: null,
    emailVerified: false,
    payload: {
      museumId: 'museum_alice_pub',
      museumOwnerId: 'bob',
      status: 'contacted',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 16,
    name: 'Guestbook Hidden Create / Oversized Nickname / Foreign Delete',
    collectionPath: '/guestbook/gb_bad',
    operation: 'create',
    authUid: null,
    emailVerified: false,
    payload: {
      museumId: 'museum_alice_pub',
      nickname: 'x'.repeat(60),
      isVisible: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 17,
    name: 'Loaned Island Cross-Island Escalation / Invite Hijack',
    collectionPath: '/museums/museum_alice_pub/pieces/piece_guest_escape',
    operation: 'create',
    authUid: 'bob',
    emailVerified: true,
    payload: {
      museumId: 'museum_alice_pub',
      islandId: 'other_island_not_loaned',
      loanInviteId: 'inv_bob_patio',
    },
    expected: 'PERMISSION_DENIED',
  },
];

function validMuseumDoc(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    authorName: ownerId === 'alice' ? 'Alice Studio' : 'Bob Kitchen',
    title: ownerId === 'alice' ? 'Galería Alice' : 'Bistró Bob',
    subtitle: 'Colección de prueba',
    category: 'arte',
    templateId: 'arte',
    theme: {
      presetId: 'archipielago',
      skyColor: '#6ec9da',
      oceanColor: '#2caac0',
      accentColor: '#f4d47d',
      surfaceColor: '#072634',
      roomThemeId: 'classic',
    },
    defaultCharacterId: 'explorador',
    isPublic: true,
    islands: [{ id: 'patio', title: 'Patio' }],
    rooms: [{ id: 'sala1', islandId: 'patio', name: 'Sala 1' }],
    islandCount: 1,
    pieceCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validPieceDoc(museumId: string, ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    museumId,
    ownerId,
    islandId: 'patio',
    roomId: 'sala1',
    title: 'Obra válida',
    subtitle: 'Nota',
    body: 'Contenido expositivo.',
    kind: 'text',
    type: 'text',
    url: '',
    mediaDataUrl: '',
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (emulatorHost) {
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
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, 'museums', 'museum_alice_pub'), {
        ...validMuseumDoc('alice', { isPublic: true }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      await setDoc(doc(adminDb, 'museums', 'museum_alice_priv'), {
        ...validMuseumDoc('alice', { title: 'Privado Alice', isPublic: false }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      await setDoc(doc(adminDb, 'museums', 'museum_bob_1'), {
        ...validMuseumDoc('bob', { isPublic: true }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      await setDoc(doc(adminDb, 'museums', 'museum_alice_pub', 'pieces', 'p_pub'), {
        ...validPieceDoc('museum_alice_pub', 'alice', { isPublic: true }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      await setDoc(doc(adminDb, 'museums', 'museum_alice_priv', 'pieces', 'p_priv'), {
        ...validPieceDoc('museum_alice_priv', 'alice', { isPublic: false }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
    });
  });

  test('Frontend list queries match security rules (public directory, my museums, pieces)', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();

    // 1. Directorio público: where('isPublic', '==', true)
    const pubSnap = await assertSucceeds(
      getDocs(query(collection(anonDb, 'museums'), where('isPublic', '==', true), limit(60)))
    );
    assert.equal(pubSnap.size, 2);

    // 2. Mis museos: where('ownerId', '==', uid)
    const mySnap = await assertSucceeds(
      getDocs(query(collection(aliceDb, 'museums'), where('ownerId', '==', 'alice'), limit(30)))
    );
    assert.equal(mySnap.size, 2);

    // Bob querying Alice's museums (including private) must fail
    await assertFails(
      getDocs(query(collection(bobDb, 'museums'), where('ownerId', '==', 'alice'), limit(30)))
    );

    // Unfiltered list on /museums must fail
    await assertFails(getDocs(query(collection(bobDb, 'museums'), limit(60))));

    // 3. Listado de piezas públicas de un museo: where('isPublic', '==', true)
    const pubPiecesSnap = await assertSucceeds(
      getDocs(
        query(
          collection(anonDb, 'museums', 'museum_alice_pub', 'pieces'),
          where('isPublic', '==', true),
          limit(250)
        )
      )
    );
    assert.equal(pubPiecesSnap.size, 1);

    // Owner querying own private museum pieces: where('ownerId', '==', uid)
    const ownerPiecesSnap = await assertSucceeds(
      getDocs(
        query(
          collection(aliceDb, 'museums', 'museum_alice_priv', 'pieces'),
          where('ownerId', '==', 'alice'),
          limit(250)
        )
      )
    );
    assert.equal(ownerPiecesSnap.size, 1);

    // Unfiltered list on pieces must fail
    await assertFails(
      getDocs(query(collection(bobDb, 'museums', 'museum_alice_priv', 'pieces'), limit(250)))
    );
  });

  test('CuratedFrom attribution verification, URL/image regexes, and disjoint updates', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();

    // Valid curation matching Alice's real museum title and authorName
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_curated_ok'),
        validPieceDoc('museum_bob_1', 'bob', {
          curatedFrom: {
            sourceMuseumId: 'museum_alice_pub',
            sourceMuseumTitle: 'Galería Alice',
            sourceAuthorName: 'Alice Studio',
            sourcePieceId: 'p_pub',
            sourcePieceTitle: 'Obra válida',
          },
        })
      )
    );

    // Valid curation from canonical flagship museo404
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_curated_flagship'),
        validPieceDoc('museum_bob_1', 'bob', {
          curatedFrom: {
            sourceMuseumId: 'museo404',
            sourceMuseumTitle: 'MUSEO 404 · siNOMBRE',
            sourceAuthorName: 'Colección Original',
            sourcePieceId: 'base-1',
            sourcePieceTitle: 'Obra base',
          },
        })
      )
    );

    // Spoofed curatedFrom title must fail
    await assertFails(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_curated_spoof'),
        validPieceDoc('museum_bob_1', 'bob', {
          curatedFrom: {
            sourceMuseumId: 'museum_alice_pub',
            sourceMuseumTitle: 'Falso Museo',
            sourceAuthorName: 'Alice Studio',
            sourcePieceId: 'p_pub',
            sourcePieceTitle: 'Obra válida',
          },
        })
      )
    );

    // Spoofed url & mediaDataUrl must fail
    await assertFails(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_bad_url'),
        validPieceDoc('museum_bob_1', 'bob', { url: 'javascript:alert(1)' })
      )
    );
    await assertFails(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_bad_img'),
        validPieceDoc('museum_bob_1', 'bob', { mediaDataUrl: 'data:text/html,<script></script>' })
      )
    );

    // Valid https url & data:image/ must succeed
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'museums', 'museum_bob_1', 'pieces', 'p_good_media'),
        validPieceDoc('museum_bob_1', 'bob', {
          type: 'image',
          kind: 'image',
          url: 'https://example.com/obra',
          mediaDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        })
      )
    );

    // Disjoint museum updates succeed separately, fail if mixed
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'museums', 'museum_alice_pub'), {
        title: 'Galería Renovada',
        donationConfig: {
          enabled: true,
          url: 'https://ko-fi.com/alice',
          platformLabel: 'Ko-fi',
          note: 'Apoya la galería',
        },
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'museums', 'museum_alice_pub'), {
        donationConfig: {
          enabled: true,
          url: 'javascript:alert(1)',
          platformLabel: 'Ko-fi',
          note: 'Malicioso',
        },
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'museums', 'museum_alice_pub'), {
        islands: [{ id: 'patio', title: 'Patio' }],
        rooms: [{ id: 'sala1', islandId: 'patio', name: 'Sala 1' }],
        islandCount: 1,
        pieceCount: 1,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'museums', 'museum_alice_pub'), {
        title: 'Mezcla Inválida',
        islandCount: 2,
        updatedAt: serverTimestamp(),
      })
    );

    // Valid delete on own piece
    await assertSucceeds(deleteDoc(doc(aliceDb, 'museums', 'museum_alice_pub', 'pieces', 'p_pub')));
    // Foreign get on private museum fails
    await assertFails(getDoc(doc(bobDb, 'museums', 'museum_alice_priv')));
  });

  test('Guestbook open nickname writes, moderation, and PurchaseInquiries PII isolation', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();

    // Open visitor can sign guestbook on flagship museo404 and public museum
    await assertSucceeds(
      setDoc(doc(anonDb, 'guestbook', 'gb_anon_1'), {
        museumId: 'museo404',
        islandId: 'patio',
        roomId: 'reception',
        scopeLabel: 'Recepción · Patio 404',
        nickname: 'Viajero Nocturno',
        message: 'Qué bonito lugar para perderse.',
        authorUid: null,
        isVisible: true,
        createdAt: serverTimestamp(),
      })
    );

    await assertSucceeds(
      getDocs(
        query(
          collection(anonDb, 'guestbook'),
          where('isVisible', '==', true),
          where('museumId', '==', 'museo404'),
          limit(50)
        )
      )
    );

    // Non-owner Bob cannot delete anon entry; author or owner cannot be spoofed
    await assertFails(deleteDoc(doc(bobDb, 'guestbook', 'gb_anon_1')));

    // Anonymous visitor can create purchase inquiry for Alice's public museum
    await assertSucceeds(
      setDoc(doc(anonDb, 'purchaseInquiries', 'inq_1'), {
        museumId: 'museum_alice_pub',
        museumOwnerId: 'alice',
        pieceId: 'p_pub',
        pieceTitle: 'Obra válida',
        priceLabel: '$2,500 MXN',
        buyerName: 'María',
        buyerContact: 'maria@example.com',
        shippingLocation: 'CDMX',
        message: '¿Sigue disponible?',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // PII Isolation: Neither anon nor Bob can read or list Alice's inquiries
    await assertFails(getDoc(doc(anonDb, 'purchaseInquiries', 'inq_1')));
    await assertFails(getDoc(doc(bobDb, 'purchaseInquiries', 'inq_1')));
    await assertFails(
      getDocs(
        query(collection(bobDb, 'purchaseInquiries'), where('museumOwnerId', '==', 'alice'), limit(50))
      )
    );

    // Alice can list and update status of her own inquiries
    const aliceInq = await assertSucceeds(
      getDocs(
        query(
          collection(aliceDb, 'purchaseInquiries'),
          where('museumOwnerId', '==', 'alice'),
          limit(50)
        )
      )
    );
    assert.equal(aliceInq.size, 1);

    await assertSucceeds(
      updateDoc(doc(aliceDb, 'purchaseInquiries', 'inq_1'), {
        status: 'contacted',
        updatedAt: serverTimestamp(),
      })
    );
  });

  test('Isla Prestada invites & scoped guest permissions (only allowed island)', async () => {
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();

    // Non-owner Bob cannot create an invite for Alice's museum
    await assertFails(
      setDoc(doc(bobDb, 'islandInvites', 'inv_spoof'), {
        museumId: 'museum_alice_pub',
        museumTitle: 'Galería Alice',
        hostUid: 'bob',
        hostName: 'Bob',
        islandId: 'patio',
        islandTitle: 'Patio',
        status: 'pending',
        guestUid: null,
        guestName: '',
        sourceMuseumId: '',
        sourceMuseumTitle: '',
        sourceMuseumUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Owner Alice creates a valid pending invite
    await assertSucceeds(
      setDoc(doc(aliceDb, 'islandInvites', 'inv_patio_1'), {
        museumId: 'museum_alice_pub',
        museumTitle: 'Galería Alice',
        hostUid: 'alice',
        hostName: 'Alice Studio',
        islandId: 'patio',
        islandTitle: 'Patio',
        status: 'pending',
        guestUid: null,
        guestName: '',
        sourceMuseumId: '',
        sourceMuseumTitle: '',
        sourceMuseumUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Bob accepts the invite with his origin museum link
    await assertSucceeds(
      updateDoc(doc(bobDb, 'islandInvites', 'inv_patio_1'), {
        status: 'accepted',
        guestUid: 'bob',
        guestName: 'Bob Kitchen',
        sourceMuseumId: 'museum_bob_1',
        sourceMuseumTitle: 'Bistró Bob',
        sourceMuseumUrl: '?museum=museum_bob_1',
        updatedAt: serverTimestamp(),
      })
    );

    // Bob can add a piece inside the loaned island ('patio') with loanInviteId
    await assertSucceeds(
      setDoc(
        doc(bobDb, 'museums', 'museum_alice_pub', 'pieces', 'p_guest_1'),
        validPieceDoc('museum_alice_pub', 'bob', {
          islandId: 'patio',
          loanInviteId: 'inv_patio_1',
          isPublic: true,
        })
      )
    );

    // Bob CANNOT add a piece to a different island in Alice's museum
    await assertFails(
      setDoc(
        doc(bobDb, 'museums', 'museum_alice_pub', 'pieces', 'p_guest_escape'),
        validPieceDoc('museum_alice_pub', 'bob', {
          islandId: 'other_island',
          loanInviteId: 'inv_patio_1',
          isPublic: true,
        })
      )
    );

    // Bob can update and delete his own piece on the loaned island
    await assertSucceeds(
      updateDoc(doc(bobDb, 'museums', 'museum_alice_pub', 'pieces', 'p_guest_1'), {
        title: 'Obra invitada editada',
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      deleteDoc(doc(bobDb, 'museums', 'museum_alice_pub', 'pieces', 'p_guest_1'))
    );
  });
} else {
  test('Dirty Dozen & query contract registry present (set FIRESTORE_EMULATOR_HOST to execute live)', () => {
    assert.equal(DIRTY_DOZEN_CASES.length, 17);
  });
}
