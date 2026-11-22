import {
  INITIAL_ROOM_META,
  ORIGINAL_ISLANDS,
  getBasePiecesForIsland,
} from '../data/initialContent';
import {
  Island,
  IslandBiome,
  MuseumPiece,
  MuseumState,
  Room,
} from '../types/museum';
import {
  blobToDataURL,
  dataURLToBlob,
  deleteMedia,
  getMedia,
  putMedia,
} from './mediaDb';

const STORE_KEY_V2 = 'museo404_archipielago_v2';
const STORE_KEY_V1 = 'museo404_archipielago_editor_v1';

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultState(): MuseumState {
  const rooms: Record<string, Room[]> = {};
  for (const island of ORIGINAL_ISLANDS) {
    const metaList = INITIAL_ROOM_META[island.id] || [
      { id: 'main', name: island.title, description: island.description },
    ];
    rooms[island.id] = metaList.map((r) => ({
      id: r.id,
      islandId: island.id,
      name: r.name,
      description: r.description,
    }));
  }

  return {
    version: 2,
    customIslands: [],
    islandMeta: {},
    hiddenIslands: [],
    rooms,
    customItems: [],
    overrides: {},
    hidden: [],
    discoveredIds: [],
  };
}

export function loadMuseumState(): MuseumState {
  const defaults = createDefaultState();
  try {
    const rawV2 = localStorage.getItem(STORE_KEY_V2);
    const rawV1 = localStorage.getItem(STORE_KEY_V1);
    const raw = rawV2 || rawV1;
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const mergedRooms: Record<string, Room[]> = { ...defaults.rooms };
    if (parsed.rooms && typeof parsed.rooms === 'object') {
      for (const [islandId, roomArr] of Object.entries(parsed.rooms)) {
        if (Array.isArray(roomArr)) {
          mergedRooms[islandId] = roomArr.map((r: any) => ({
            id: String(r.id),
            islandId,
            name: String(r.name || 'Sala'),
            description: String(r.description || ''),
            ...(Array.isArray(r.pieceOrder)
              ? { pieceOrder: r.pieceOrder.map(String) }
              : {}),
          }));
        }
      }
    }

    // Asegurar que la sala "Historias encontradas" exista si venía de V1 donde sala5 solo tenía 'main'
    if (
      mergedRooms.sala5 &&
      !mergedRooms.sala5.some((r) => r.id === 'historias') &&
      defaults.rooms.sala5.some((r) => r.id === 'historias')
    ) {
      const historiasDefault = defaults.rooms.sala5.find((r) => r.id === 'historias');
      if (historiasDefault) mergedRooms.sala5.push(historiasDefault);
    }

    return {
      version: 2,
      customIslands: Array.isArray(parsed.customIslands) ? parsed.customIslands : [],
      islandMeta: parsed.islandMeta && typeof parsed.islandMeta === 'object' ? parsed.islandMeta : {},
      hiddenIslands: Array.isArray(parsed.hiddenIslands) ? parsed.hiddenIslands : [],
      rooms: mergedRooms,
      customItems: Array.isArray(parsed.customItems) ? parsed.customItems : [],
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      discoveredIds: Array.isArray(parsed.discoveredIds) ? parsed.discoveredIds : [],
      islasPrestadas: Array.isArray(parsed.islasPrestadas) ? parsed.islasPrestadas : [],
    };
  } catch {
    return defaults;
  }
}

export function saveMuseumState(state: MuseumState): boolean {
  try {
    localStorage.setItem(STORE_KEY_V2, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getResolvedIslands(state: MuseumState, includeHidden = false): Island[] {
  const originals = ORIGINAL_ISLANDS.filter(
    (isl) => includeHidden || !state.hiddenIslands.includes(isl.id)
  ).map((isl) => ({
    ...isl,
    ...(state.islandMeta[isl.id] || {}),
    id: isl.id,
    isOriginal: true,
  }));

  const customs = state.customIslands.map((isl) => ({
    ...isl,
    ...(state.islandMeta[isl.id] || {}),
    id: isl.id,
    isOriginal: false,
  }));

  return [...originals, ...customs];
}

export function getIslandById(state: MuseumState, islandId: string): Island | undefined {
  return getResolvedIslands(state, true).find((i) => i.id === islandId);
}

export function getRoomsForIsland(state: MuseumState, islandId: string): Room[] {
  return state.rooms[islandId] || [];
}

export function getPiecesForRoom(
  state: MuseumState,
  islandId: string,
  roomId: string
): MuseumPiece[] {
  const base = getBasePiecesForIsland(islandId)
    .filter((item) => item.roomId === roomId && !state.hidden.includes(item.id))
    .map((item) => {
      const ov = state.overrides[item.id];
      if (!ov) return item;
      return {
        ...item,
        ...ov,
        kind: ov.mediaKey ? ('image' as const) : item.kind,
      };
    });

  const custom = state.customItems.filter(
    (item) => item.islandId === islandId && item.roomId === roomId
  );

  return [...base, ...custom];
}

export function getPiecesCountForIsland(state: MuseumState, islandId: string): number {
  return getRoomsForIsland(state, islandId).reduce(
    (acc, r) => acc + getPiecesForRoom(state, islandId, r.id).length,
    0
  );
}

export function suggestIslandPosition(existing: Island[]): { x: number; y: number } {
  // Candidatos equilibrados alrededor del archipiélago sin tapar el título ni bordes
  const candidates = [
    { x: 34, y: 27 },
    { x: 67, y: 26 },
    { x: 14, y: 60 },
    { x: 86, y: 59 },
    { x: 37, y: 84 },
    { x: 64, y: 84 },
    { x: 36, y: 50 },
    { x: 65, y: 51 },
    { x: 16, y: 25 },
    { x: 84, y: 25 },
  ];

  let best = candidates[0];
  let bestMinDist = -1;

  for (const c of candidates) {
    let minD = Infinity;
    for (const isl of existing) {
      const d = Math.hypot(c.x - isl.x, c.y - isl.y);
      if (d < minD) minD = d;
    }
    if (minD > bestMinDist) {
      bestMinDist = minD;
      best = c;
    }
  }

  return best;
}

export function createNewIsland(
  state: MuseumState,
  input: {
    title: string;
    mapLabel?: string;
    biome: IslandBiome;
    description: string;
    eyebrow?: string;
    footer?: string;
    x?: number;
    y?: number;
    loaned?: Island['loaned'];
  }
): { nextState: MuseumState; newIsland: Island; initialRoom: Room } {
  const existing = getResolvedIslands(state, false);
  const pos =
    typeof input.x === 'number' && typeof input.y === 'number'
      ? { x: input.x, y: input.y }
      : suggestIslandPosition(existing);

  const id = makeId('island');
  const title = input.title.trim() || 'Isla sin nombre';
  const mapLabel = (input.mapLabel || title).trim().toUpperCase();

  const newIsland: Island = {
    id,
    isOriginal: false,
    biome: input.biome,
    x: pos.x,
    y: pos.y,
    mapLabel,
    title,
    eyebrow: input.eyebrow?.trim() || (input.loaned ? 'ISLA PRESTADA' : 'NUEVA ISLA DEL ARCHIPIÉLAGO'),
    description: input.description.trim() || 'Un territorio recién emergido del océano de ideas.',
    footer: input.footer?.trim() || 'Colección insular',
    ...(input.loaned ? { loaned: input.loaned } : {}),
  };

  const initialRoom: Room = {
    id: makeId('room'),
    islandId: id,
    name: `Sala principal · ${title}`,
    description: newIsland.description,
  };

  const nextState: MuseumState = {
    ...state,
    customIslands: [...state.customIslands, newIsland],
    rooms: {
      ...state.rooms,
      [id]: [initialRoom],
    },
    ...(input.loaned
      ? { islasPrestadas: [...(state.islasPrestadas || []), input.loaned] }
      : {}),
  };

  return { nextState, newIsland, initialRoom };
}

export async function deleteCompleteIsland(
  state: MuseumState,
  islandId: string
): Promise<MuseumState> {
  const isCustom = state.customIslands.some((i) => i.id === islandId);
  const rooms = getRoomsForIsland(state, islandId);

  // Limpiar archivos multimedia en IndexedDB de todas sus salas
  for (const room of rooms) {
    const pieces = getPiecesForRoom(state, islandId, room.id);
    for (const piece of pieces) {
      if (piece.mediaKey) {
        await deleteMedia(piece.mediaKey);
      }
    }
  }

  const nextRooms = { ...state.rooms };
  if (isCustom) {
    delete nextRooms[islandId];
  }

  const nextMeta = { ...state.islandMeta };
  if (isCustom) {
    delete nextMeta[islandId];
  }

  const nextOverrides = { ...state.overrides };
  if (isCustom) {
    // Nada en overrides para custom, pero limpiamos customItems
  } else {
    for (const basePiece of getBasePiecesForIsland(islandId)) {
      if (nextOverrides[basePiece.id]?.mediaKey) {
        await deleteMedia(nextOverrides[basePiece.id].mediaKey!);
      }
      delete nextOverrides[basePiece.id];
    }
  }

  return {
    ...state,
    customIslands: isCustom
      ? state.customIslands.filter((i) => i.id !== islandId)
      : state.customIslands,
    hiddenIslands: isCustom
      ? state.hiddenIslands
      : Array.from(new Set([...state.hiddenIslands, islandId])),
    islandMeta: nextMeta,
    rooms: nextRooms,
    customItems: state.customItems.filter((item) => item.islandId !== islandId),
    overrides: nextOverrides,
  };
}

export async function exportMuseumBackup(state: MuseumState): Promise<void> {
  const media: Record<string, string> = {};
  const keys = new Set<string>();

  for (const item of state.customItems) {
    if (item.mediaKey) keys.add(item.mediaKey);
  }
  for (const ov of Object.values(state.overrides)) {
    if (ov.mediaKey) keys.add(ov.mediaKey);
  }

  for (const key of keys) {
    const blob = await getMedia(key);
    if (blob) {
      media[key] = await blobToDataURL(blob);
    }
  }

  const resolvedLoaned = getResolvedIslands(state, false)
    .map((isl) => isl.loaned)
    .filter((l): l is NonNullable<Island['loaned']> => Boolean(l));

  const payload = {
    format: 'museo404-backup-v2',
    exportedAt: new Date().toISOString(),
    state: {
      ...state,
      islasPrestadas: resolvedLoaned,
    },
    media,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `museo-404-copia-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importMuseumBackup(file: File): Promise<MuseumState> {
  const text = await file.text();
  const payload = JSON.parse(text);

  if (
    !payload ||
    (payload.format !== 'museo404-backup-v1' && payload.format !== 'museo404-backup-v2') ||
    !payload.state
  ) {
    throw new Error('Formato de copia de seguridad no reconocido.');
  }

  for (const [key, dataUrl] of Object.entries(payload.media || {})) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      await putMedia(key, dataURLToBlob(dataUrl));
    }
  }

  const defaults = createDefaultState();
  const raw = payload.state;

  const mergedRooms: Record<string, Room[]> = { ...defaults.rooms };
  if (raw.rooms && typeof raw.rooms === 'object') {
    for (const [islandId, roomArr] of Object.entries(raw.rooms)) {
      if (Array.isArray(roomArr)) {
        mergedRooms[islandId] = (roomArr as any[]).map((r) => ({
          id: String(r.id),
          islandId,
          name: String(r.name || 'Sala'),
          description: String(r.description || ''),
          ...(Array.isArray(r.pieceOrder)
            ? { pieceOrder: r.pieceOrder.map(String) }
            : {}),
        }));
      }
    }
  }

  const importedState: MuseumState = {
    version: 2,
    customIslands: Array.isArray(raw.customIslands) ? raw.customIslands : [],
    islandMeta: raw.islandMeta || {},
    hiddenIslands: Array.isArray(raw.hiddenIslands) ? raw.hiddenIslands : [],
    rooms: mergedRooms,
    customItems: Array.isArray(raw.customItems) ? raw.customItems : [],
    overrides: raw.overrides || {},
    hidden: Array.isArray(raw.hidden) ? raw.hidden : [],
    discoveredIds: Array.isArray(raw.discoveredIds) ? raw.discoveredIds : [],
    islasPrestadas: Array.isArray(raw.islasPrestadas) ? raw.islasPrestadas : [],
  };

  saveMuseumState(importedState);
  return importedState;
}
