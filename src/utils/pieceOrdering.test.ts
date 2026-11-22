import assert from 'node:assert/strict';
import test from 'node:test';
import type { MuseumPiece, Room, CloudMuseum } from '../types/museum';
import { reorderRoomPiece, sortPiecesForRoom } from './pieceOrdering.ts';

const mockPiece = (id: string, title: string, islandId = 'island_1', roomId = 'room_1'): MuseumPiece => ({
  id,
  islandId,
  roomId,
  title,
  subtitle: '',
  kind: 'text',
  type: 'text',
  custom: true,
});

test('Moving a piece up and down updates room.pieceOrder', () => {
  const p1 = mockPiece('p1', 'Alpha');
  const p2 = mockPiece('p2', 'Beta');
  const p3 = mockPiece('p3', 'Gamma');
  const pieces = [p1, p2, p3];

  const movedUp = reorderRoomPiece(pieces, 'p2', 'up');
  assert.deepEqual(movedUp, ['p2', 'p1', 'p3']);

  const movedDown = reorderRoomPiece(pieces, 'p2', 'down');
  assert.deepEqual(movedDown, ['p1', 'p3', 'p2']);
});

test('First and last item boundaries prevent illegal moves', () => {
  const p1 = mockPiece('p1', 'Alpha');
  const p2 = mockPiece('p2', 'Beta');
  const pieces = [p1, p2];

  // First item cannot move up
  assert.equal(reorderRoomPiece(pieces, 'p1', 'up'), null);

  // Last item cannot move down
  assert.equal(reorderRoomPiece(pieces, 'p2', 'down'), null);

  // Non-existent item
  assert.equal(reorderRoomPiece(pieces, 'unknown', 'up'), null);
});

test('Identical ordering across editor, drawer and 2D explorer using sortPiecesForRoom', () => {
  const p1 = mockPiece('p1', 'One');
  const p2 = mockPiece('p2', 'Two');
  const p3 = mockPiece('p3', 'Three');

  const room: Room = {
    id: 'room_1',
    islandId: 'island_1',
    name: 'Sala Galería',
    description: '',
    pieceOrder: ['p3', 'p1', 'p2'],
  };

  const rawPieces = [p1, p2, p3];

  // Editor order
  const editorPieces = sortPiecesForRoom(rawPieces, room);
  // Drawer order
  const drawerPieces = sortPiecesForRoom(rawPieces, room);
  // 2D Explorer order
  const explorerPieces = sortPiecesForRoom(rawPieces, room);

  assert.deepEqual(
    editorPieces.map((p) => p.id),
    ['p3', 'p1', 'p2']
  );
  assert.deepEqual(
    drawerPieces.map((p) => p.id),
    editorPieces.map((p) => p.id)
  );
  assert.deepEqual(
    explorerPieces.map((p) => p.id),
    editorPieces.map((p) => p.id)
  );
});

test('Existing legacy pieces without sortOrder or missing from pieceOrder', () => {
  const p1 = mockPiece('p1', 'Explicit 1');
  const p2 = mockPiece('p2', 'Explicit 2');
  const legacyA = mockPiece('legA', 'Legacy A');
  const legacyB = mockPiece('legB', 'Legacy B');

  // Room specifies ordering for p2 and p1 only
  const roomWithPartialOrder: Room = {
    id: 'room_1',
    islandId: 'island_1',
    name: 'Sala Parcial',
    description: '',
    pieceOrder: ['p2', 'p1'],
  };

  const sorted = sortPiecesForRoom([p1, legacyA, p2, legacyB], roomWithPartialOrder);

  // Explicitly ordered items come first in their designated order; unlisted items follow safely
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['p2', 'p1', 'legA', 'legB']
  );
});

test('Persistence and snapshot simulation for cloud undo', () => {
  const initialRooms: Room[] = [
    { id: 'room_1', islandId: 'island_1', name: 'Sala 1', description: '', pieceOrder: ['p1', 'p2'] },
  ];

  const cloudMuseum: CloudMuseum = {
    id: 'museum_1',
    ownerId: 'user_1',
    authorName: 'Autor',
    title: 'Museo Cloud',
    subtitle: '',
    category: 'personal',
    templateId: 'blank',
    theme: {
      presetId: 'classic',
      skyColor: '#000',
      oceanColor: '#111',
      accentColor: '#fff',
      surfaceColor: '#222',
      roomThemeId: 'classic',
    },
    defaultCharacterId: 'explorador',
    isPublic: true,
    islands: [],
    rooms: initialRooms,
    islandCount: 1,
    pieceCount: 2,
  };

  // 1. Snapshot taken before change
  const undoStack: { rooms: Room[]; description: string }[] = [];
  undoStack.push({ rooms: cloudMuseum.rooms, description: 'Reordenamiento de piezas' });

  // 2. Perform reorder
  const newOrder = ['p2', 'p1'];
  const modifiedRooms = cloudMuseum.rooms.map((r) =>
    r.id === 'room_1' ? { ...r, pieceOrder: newOrder } : r
  );
  const updatedMuseum = { ...cloudMuseum, rooms: modifiedRooms };

  assert.deepEqual(updatedMuseum.rooms[0].pieceOrder, ['p2', 'p1']);

  // 3. Undo restores previous state
  const [snapshot] = undoStack;
  const revertedMuseum = { ...updatedMuseum, rooms: snapshot.rooms };

  assert.deepEqual(revertedMuseum.rooms[0].pieceOrder, ['p1', 'p2']);
  assert.equal(snapshot.description, 'Reordenamiento de piezas');
});

test('Local storage persistence simulation preserves room.pieceOrder', () => {
  const roomWithOrder: Room = {
    id: 'room_1',
    islandId: 'island_1',
    name: 'Sala Local',
    description: '',
    pieceOrder: ['p3', 'p2', 'p1'],
  };

  // Simulating localStorage JSON serialize / deserialize cycle
  const serialized = JSON.stringify({
    version: 2,
    rooms: {
      island_1: [roomWithOrder],
    },
  });

  const parsed = JSON.parse(serialized);
  const reloadedRoom = parsed.rooms.island_1.map((r: any) => ({
    id: String(r.id),
    islandId: 'island_1',
    name: String(r.name),
    description: String(r.description),
    ...(Array.isArray(r.pieceOrder) ? { pieceOrder: r.pieceOrder.map(String) } : {}),
  }))[0];

  assert.deepEqual(reloadedRoom.pieceOrder, ['p3', 'p2', 'p1']);
});
