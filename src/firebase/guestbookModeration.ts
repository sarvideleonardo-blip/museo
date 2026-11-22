import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { GuestbookEntry } from '../types/museum';
import { OperationType, db, handleFirestoreError } from './client';

function formatFirestoreDate(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value) {
    return value;
  }
  return new Date(0).toISOString();
}

function mapGuestbookEntry(id: string, data: Record<string, unknown>): GuestbookEntry {
  return {
    id,
    museumId: String(data.museumId || 'museo404'),
    islandId: String(data.islandId || 'patio'),
    roomId: String(data.roomId || 'reception'),
    scopeLabel: String(data.scopeLabel || 'Recepción'),
    nickname: String(data.nickname || 'Visitante'),
    message: String(data.message || ''),
    authorUid: typeof data.authorUid === 'string' && data.authorUid ? data.authorUid : null,
    isVisible: data.isVisible !== false,
    createdAt: formatFirestoreDate(data.createdAt),
  };
}

/**
 * Loads hidden entries for moderator views. Firestore rules independently verify
 * that the current user owns the museum (or is the flagship administrator).
 */
export async function fetchHiddenGuestbookEntries(params: {
  museumId: string;
  roomId?: string | null;
  maxItems?: number;
}): Promise<GuestbookEntry[]> {
  const { museumId, roomId, maxItems = 50 } = params;
  const constraints = [
    where('isVisible', '==', false),
    where('museumId', '==', museumId),
    ...(roomId ? [where('roomId', '==', roomId)] : []),
  ];

  try {
    const snapshot = await getDocs(
      query(collection(db, 'guestbook'), ...constraints, orderBy('createdAt', 'desc'), limit(maxItems))
    );
    return snapshot.docs.map((entry) => mapGuestbookEntry(entry.id, entry.data()));
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: string }).code : '';
    const message = error instanceof Error ? error.message : '';
    if (code === 'failed-precondition' || message.includes('requires an index')) {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'guestbook'), ...constraints, limit(maxItems))
        );
        return snapshot.docs
          .map((entry) => mapGuestbookEntry(entry.id, entry.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (fallbackError) {
        handleFirestoreError(fallbackError, OperationType.LIST, 'guestbook');
      }
    }
    handleFirestoreError(error, OperationType.LIST, 'guestbook');
  }
}

export async function restoreGuestbookEntry(entryId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'guestbook', entryId), { isVisible: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `guestbook/${entryId}`);
  }
}
