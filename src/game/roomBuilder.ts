import { Island, MuseumPiece, Room } from '../types/museum';

export const ROOM_WIDTH = 16;
export const ROOM_HEIGHT = 11;
export const TILE_SIZE = 16;

export interface RoomDoor {
  direction: 'north' | 'south' | 'east' | 'west';
  rect: { x: number; y: number; w: number; h: number };
  action: 'archipelago' | 'room';
  targetRoomId?: string;
  label: string;
}

export interface RoomInteractive {
  id: string;
  type: 'pedestal' | 'painting' | 'arcade' | 'sign' | 'fountain' | 'tree' | 'link_item' | 'guestbook';
  x: number;
  y: number;
  title: string;
  piece?: MuseumPiece;
  signText?: string;
  triggerRadius?: number;
}

export interface RoomNPC {
  id: string;
  type: 'receptionist' | 'shopkeeper';
  x: number;
  y: number;
  name: string;
  piece?: MuseumPiece;
}

export interface PlayableRoom {
  id: string;
  islandId: string;
  name: string;
  isOutdoor: boolean;
  layout: string[];
  tileMap: Record<string, string>;
  solidTiles: string[];
  doors: RoomDoor[];
  torches: { x: number; y: number }[];
  interactives: RoomInteractive[];
  npcs: RoomNPC[];
  defaultSpawn: { x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' };
}

function getBiomeTileStyles(island: Island): {
  wallChar: string;
  floorChar: string;
  tileMap: Record<string, string>;
  isOutdoor: boolean;
} {
  switch (island.biome) {
    case 'forest':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: true,
        tileMap: {
          W: 'bush',
          '.': 'grass',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
          T: 'tree_top_left',
        },
      };
    case 'ice':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: false,
        tileMap: {
          W: 'ice_wall',
          '.': 'ice_floor',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
    case 'desert':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: true,
        tileMap: {
          W: 'wall',
          '.': 'sand',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
    case 'patio':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: true,
        tileMap: {
          W: 'wall',
          '.': 'grass',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
          B: 'bush',
          F: 'fountain_center',
          T: 'tree_top_left',
          S: 'shelf',
        },
      };
    case 'coral':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: true,
        tileMap: {
          W: 'bush',
          '.': 'sand',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
    case 'volcano':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: true,
        tileMap: {
          W: 'wall',
          '.': 'dungeon_floor',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
    case 'crypt':
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: false,
        tileMap: {
          W: 'wall',
          '.': 'dungeon_floor',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
    case 'observatory':
    case 'workshop':
    default:
      return {
        wallChar: 'W',
        floorChar: '.',
        isOutdoor: false,
        tileMap: {
          W: 'wall',
          '.': 'dungeon_floor',
          C: 'path',
          D: 'door',
          X: 'exit_portal',
        },
      };
  }
}

export function buildPlayableRoom(
  island: Island,
  rooms: Room[],
  activeRoom: Room,
  pieces: MuseumPiece[]
): PlayableRoom {
  const roomIndex = Math.max(0, rooms.findIndex((r) => r.id === activeRoom.id));
  const prevRoom = roomIndex > 0 ? rooms[roomIndex - 1] : null;
  const nextRoom = roomIndex < rooms.length - 1 ? rooms[roomIndex + 1] : null;

  const { tileMap, isOutdoor } = getBiomeTileStyles(island);

  // Construimos cuadrícula base 16x11 con muros perimetrales
  const grid: string[][] = Array.from({ length: ROOM_HEIGHT }, (_, r) =>
    Array.from({ length: ROOM_WIDTH }, (_, c) => {
      if (r === 0 || r === ROOM_HEIGHT - 1 || c === 0 || c === ROOM_WIDTH - 1) {
        return 'W';
      }
      return '.';
    })
  );

  // Camino central de entrada
  for (let r = 1; r < ROOM_HEIGHT - 1; r++) {
    grid[r][7] = 'C';
    grid[r][8] = 'C';
  }

  const doors: RoomDoor[] = [];

  // Puerta Sur -> Salida al archipiélago
  grid[ROOM_HEIGHT - 1][7] = 'X';
  grid[ROOM_HEIGHT - 1][8] = 'X';
  doors.push({
    direction: 'south',
    rect: { x: 7 * TILE_SIZE, y: 10 * TILE_SIZE, w: 32, h: 16 },
    action: 'archipelago',
    label: 'Volver al archipiélago',
  });

  // Si hay sala siguiente -> Puerta Norte
  if (nextRoom) {
    grid[0][7] = 'D';
    grid[0][8] = 'D';
    doors.push({
      direction: 'north',
      rect: { x: 7 * TILE_SIZE, y: 0, w: 32, h: 16 },
      action: 'room',
      targetRoomId: nextRoom.id,
      label: nextRoom.name,
    });
  }

  // Si hay sala anterior -> Puerta Oeste
  if (prevRoom) {
    grid[5][0] = 'D';
    grid[6][0] = 'D';
    grid[5][1] = 'C';
    grid[6][1] = 'C';
    doors.push({
      direction: 'west',
      rect: { x: 0, y: 5 * TILE_SIZE, w: 16, h: 32 },
      action: 'room',
      targetRoomId: prevRoom.id,
      label: prevRoom.name,
    });
  }

  const interactives: RoomInteractive[] = [];
  const npcs: RoomNPC[] = [];

  // Placa informativa de la sala cerca de la entrada
  interactives.push({
    id: `sign_${activeRoom.id}`,
    type: 'sign',
    x: 5 * TILE_SIZE,
    y: 9 * TILE_SIZE,
    title: activeRoom.name,
    signText: `${island.title} · ${activeRoom.name}\n\n${activeRoom.description || island.description}\n\nPiezas en esta sala: ${pieces.length}. Camina al portal turquesa del sur para volver al archipiélago.`,
  });

  // Atril del Libro de Visitas de la sala junto al acceso principal
  interactives.push({
    id: `guestbook_${activeRoom.id}`,
    type: 'guestbook',
    x: 6 * TILE_SIZE,
    y: 8 * TILE_SIZE,
    title: `Libro de visitas · ${activeRoom.name}`,
    triggerRadius: 26,
  });

  // Caso especial icónico: Patio 404 sala principal
  let remainingPieces = [...pieces];
  if (island.id === 'patio' && activeRoom.id === 'main') {
    // Fuente en (9,2)..(10,3), Árbol en (2,2), Guía del Umbral, Tienda
    grid[2][10] = 'F';
    grid[2][2] = 'T';

    const guide = remainingPieces.find((p) => p.id === 'base-patio-guide');
    if (guide) {
      npcs.push({
        id: 'npc_guide',
        type: 'receptionist',
        x: 4 * TILE_SIZE,
        y: 3 * TILE_SIZE,
        name: guide.title,
        piece: guide,
      });
      remainingPieces = remainingPieces.filter((p) => p.id !== guide.id);
    }

    const fountain = remainingPieces.find((p) => p.id === 'base-patio-fountain');
    if (fountain) {
      interactives.push({
        id: fountain.id,
        type: 'fountain',
        x: 10 * TILE_SIZE,
        y: 2 * TILE_SIZE,
        title: fountain.title,
        piece: fountain,
        triggerRadius: 28,
      });
      remainingPieces = remainingPieces.filter((p) => p.id !== fountain.id);
    }

    const tree = remainingPieces.find((p) => p.id === 'base-patio-tree');
    if (tree) {
      interactives.push({
        id: tree.id,
        type: 'tree',
        x: 2 * TILE_SIZE,
        y: 2 * TILE_SIZE,
        title: tree.title,
        piece: tree,
        triggerRadius: 26,
      });
      remainingPieces = remainingPieces.filter((p) => p.id !== tree.id);
    }

    // Bibliotecario simbólico en el rincón oeste
    npcs.push({
      id: 'npc_shopkeeper',
      type: 'shopkeeper',
      x: 2 * TILE_SIZE,
      y: 6 * TILE_SIZE,
      name: 'Archivo de Recuerdos',
      piece: {
        id: 'shopkeeper-talk',
        islandId: 'patio',
        roomId: 'main',
        title: 'Archivo de Recuerdos',
        subtitle: 'Patio 404',
        kind: 'text',
        lines: [
          '«Bienvenido al Patio 404. Los pedestales de la sala guardan las postales y enlaces del museo.»',
          'Puedes acercarte a cualquiera y presionar Enter o Z para abrirlo.',
        ],
      },
    });
  }

  // Coordenadas seguras y caminables para colocar hasta 24 piezas en 2D sin bloquear puertas
  const slotCoords: { tx: number; ty: number }[] = [
    { tx: 2, ty: 2 }, { tx: 4, ty: 2 }, { tx: 6, ty: 2 },
    { tx: 9, ty: 2 }, { tx: 11, ty: 2 }, { tx: 13, ty: 2 },
    { tx: 2, ty: 4 }, { tx: 4, ty: 4 }, { tx: 6, ty: 4 },
    { tx: 9, ty: 4 }, { tx: 11, ty: 4 }, { tx: 13, ty: 4 },
    { tx: 2, ty: 6 }, { tx: 4, ty: 6 }, { tx: 6, ty: 6 },
    { tx: 9, ty: 6 }, { tx: 11, ty: 6 }, { tx: 13, ty: 6 },
    { tx: 2, ty: 8 }, { tx: 4, ty: 8 }, { tx: 9, ty: 8 },
    { tx: 11, ty: 8 }, { tx: 13, ty: 8 }, { tx: 13, ty: 9 },
  ];

  // Evitar chocar con elementos fijos del patio
  const occupied = new Set<string>([
    ...interactives.map((i) => `${Math.round(i.x / TILE_SIZE)},${Math.round(i.y / TILE_SIZE)}`),
    ...npcs.map((n) => `${Math.round(n.x / TILE_SIZE)},${Math.round(n.y / TILE_SIZE)}`),
  ]);

  let slotIdx = 0;
  for (const piece of remainingPieces) {
    while (
      slotIdx < slotCoords.length &&
      occupied.has(`${slotCoords[slotIdx].tx},${slotCoords[slotIdx].ty}`)
    ) {
      slotIdx++;
    }
    if (slotIdx >= slotCoords.length) break;

    const slot = slotCoords[slotIdx++];
    occupied.add(`${slot.tx},${slot.ty}`);

    const visualType: RoomInteractive['type'] =
      piece.kind === 'painting' || piece.kind === 'image'
        ? 'painting'
        : piece.kind === 'app'
          ? 'arcade'
          : piece.kind === 'link'
            ? 'link_item'
            : 'pedestal';

    interactives.push({
      id: piece.id,
      type: visualType,
      x: slot.tx * TILE_SIZE,
      y: slot.ty * TILE_SIZE,
      title: piece.title,
      piece,
    });
  }

  const torches = isOutdoor
    ? []
    : [
        { x: 2 * TILE_SIZE, y: 0 },
        { x: 13 * TILE_SIZE, y: 0 },
        { x: 0, y: 3 * TILE_SIZE },
        { x: 15 * TILE_SIZE, y: 3 * TILE_SIZE },
      ];

  return {
    id: activeRoom.id,
    islandId: island.id,
    name: activeRoom.name,
    isOutdoor,
    layout: grid.map((row) => row.join('')),
    tileMap,
    solidTiles: ['W', 'B', 'F', 'T', 'S'],
    doors,
    torches,
    interactives,
    npcs,
    defaultSpawn: { x: 7.5 * TILE_SIZE, y: 8.2 * TILE_SIZE, dir: 'up' },
  };
}
