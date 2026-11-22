import type { MuseumPiece, Room } from '../types/museum';

/**
 * Normalizes and sorts an array of pieces belonging to a specific room based on room.pieceOrder.
 * - Any piece whose ID appears in pieceOrder is ordered according to its index in pieceOrder.
 * - Any legacy piece or newly added piece not in pieceOrder is placed at the end, retaining its relative order.
 * - Does not mutate the original pieces array.
 */
export function sortPiecesForRoom(
  pieces: MuseumPiece[],
  room?: Room | null
): MuseumPiece[] {
  if (!pieces || pieces.length <= 1) return pieces ? [...pieces] : [];
  const orderList = room?.pieceOrder;
  if (!orderList || !Array.isArray(orderList) || orderList.length === 0) {
    return [...pieces];
  }

  const orderMap = new Map<string, number>();
  orderList.forEach((id, idx) => {
    orderMap.set(id, idx);
  });

  return [...pieces].sort((a, b) => {
    const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (idxA !== idxB) {
      return idxA - idxB;
    }
    return 0; // preserve relative order for items not in orderMap
  });
}

/**
 * Reorders a piece within a room by moving it 'up' (earlier in index) or 'down' (later in index).
 * Returns the updated string[] of piece IDs for room.pieceOrder, or null if no change was made
 * (e.g. already at boundaries, item not found, etc.).
 */
export function reorderRoomPiece(
  currentPiecesInRoom: MuseumPiece[],
  pieceId: string,
  direction: 'up' | 'down'
): string[] | null {
  if (!currentPiecesInRoom || currentPiecesInRoom.length <= 1) return null;

  const currentIndex = currentPiecesInRoom.findIndex((p) => p.id === pieceId);
  if (currentIndex === -1) return null;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= currentPiecesInRoom.length) {
    return null; // Already at boundary
  }

  const nextList = [...currentPiecesInRoom];
  const [removed] = nextList.splice(currentIndex, 1);
  nextList.splice(targetIndex, 0, removed);

  return nextList.map((p) => p.id);
}
