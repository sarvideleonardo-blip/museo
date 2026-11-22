import {
  User,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
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
  writeBatch,
} from 'firebase/firestore';
import { MUSEUM_TEMPLATES } from '../data/museumTemplates';
import { DEFAULT_MUSEUM_THEME } from '../data/themes';
import { makeId } from '../storage/museumStore';
import {
  CharacterId,
  CloudMuseum,
  CuratedFromMeta,
  DonationConfig,
  FrameStyle,
  Island,
  IslandShapeStyle,
  MuseumCategory,
  MuseumPiece,
  MuseumThemeConfig,
  PieceKind,
  PieceType,
  Room,
  SaleStatus,
} from '../types/museum';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from './client';
import { sanitizeDonationConfig } from './interactions';

function clampStr(val: unknown, max: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : fallback;
  return s.slice(0, max);
}

function cleanId(val: string, fallbackPrefix = 'id'): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned || makeId(fallbackPrefix);
}

function sanitizeTheme(theme?: Partial<MuseumThemeConfig>): MuseumThemeConfig {
  const roomTheme =
    theme?.roomThemeId && ['classic', 'night', 'twilight', 'gameboy'].includes(theme.roomThemeId)
      ? theme.roomThemeId
      : DEFAULT_MUSEUM_THEME.roomThemeId;
  const islandStyle: IslandShapeStyle | undefined =
    theme?.islandStyle && ['cliffs', 'terraced', 'floating'].includes(theme.islandStyle)
      ? theme.islandStyle
      : DEFAULT_MUSEUM_THEME.islandStyle;
  const frameStyle: FrameStyle | undefined =
    theme?.frameStyle && ['archival', 'ornate', 'minimal'].includes(theme.frameStyle)
      ? theme.frameStyle
      : DEFAULT_MUSEUM_THEME.frameStyle;

  return {
    presetId: clampStr(theme?.presetId || DEFAULT_MUSEUM_THEME.presetId, 32) || 'custom',
    skyColor: clampStr(theme?.skyColor || DEFAULT_MUSEUM_THEME.skyColor, 16) || '#6ec9da',
    oceanColor: clampStr(theme?.oceanColor || DEFAULT_MUSEUM_THEME.oceanColor, 16) || '#2caac0',
    accentColor: clampStr(theme?.accentColor || DEFAULT_MUSEUM_THEME.accentColor, 16) || '#f4d47d',
    surfaceColor: clampStr(theme?.surfaceColor || DEFAULT_MUSEUM_THEME.surfaceColor, 16) || '#072634',
    roomThemeId: roomTheme,
    ...(islandStyle ? { islandStyle } : {}),
    ...(frameStyle ? { frameStyle } : {}),
  };
}

function sanitizeIslands(islands: Island[]): Island[] {
  return islands.slice(0, 20).map((isl) => ({
    id: cleanId(isl.id, 'isl'),
    isOriginal: Boolean(isl.isOriginal),
    biome: isl.biome || 'forest',
    x: Math.max(10, Math.min(90, Number(isl.x) || 50)),
    y: Math.max(18, Math.min(86, Number(isl.y) || 52)),
    mapLabel: clampStr(isl.mapLabel || isl.title || 'ISLA', 40),
    title: clampStr(isl.title || 'Isla', 80),
    eyebrow: clampStr(isl.eyebrow || '', 60),
    description: clampStr(isl.description || '', 400),
    footer: clampStr(isl.footer || '', 120),
  }));
}

function sanitizeRooms(rooms: Room[]): Room[] {
  return rooms.slice(0, 60).map((r) => {
    const sanitized: Room = {
      id: cleanId(r.id, 'room'),
      islandId: cleanId(r.islandId, 'isl'),
      name: clampStr(r.name || 'Sala', 80),
      description: clampStr(r.description || '', 300),
    };
    if (Array.isArray(r.pieceOrder)) {
      sanitized.pieceOrder = r.pieceOrder
        .slice(0, 100)
        .map((pId) => cleanId(String(pId), 'piece'));
    }
    return sanitized;
  });
}

function sanitizeCuratedFrom(c: CuratedFromMeta): CuratedFromMeta {
  return {
    sourceMuseumId: clampStr(c.sourceMuseumId || 'museo404', 128) || 'museo404',
    sourceMuseumTitle: clampStr(c.sourceMuseumTitle || 'Museo', 100) || 'Museo',
    sourceAuthorName: clampStr(c.sourceAuthorName || 'Creador', 80) || 'Creador',
    sourcePieceId: clampStr(c.sourcePieceId || 'piece', 128) || 'piece',
    sourcePieceTitle: clampStr(c.sourcePieceTitle || 'Obra', 120) || 'Obra',
  };
}

function mapMuseumDoc(id: string, data: Record<string, any>): CloudMuseum {
  let donationConfig: DonationConfig | undefined;
  if (data.donationConfig && typeof data.donationConfig === 'object') {
    try {
      donationConfig = sanitizeDonationConfig(data.donationConfig as Partial<DonationConfig>);
    } catch {
      donationConfig = undefined;
    }
  }

  return {
    id,
    ownerId: String(data.ownerId || ''),
    authorName: String(data.authorName || 'Creador'),
    title: String(data.title || 'Museo sin título'),
    subtitle: String(data.subtitle || ''),
    category: (data.category as MuseumCategory) || 'personal',
    templateId: String(data.templateId || 'blank'),
    theme: sanitizeTheme(data.theme),
    defaultCharacterId: (data.defaultCharacterId as CharacterId) || 'explorador',
    isPublic: Boolean(data.isPublic),
    islands: Array.isArray(data.islands) ? data.islands : [],
    rooms: Array.isArray(data.rooms) ? data.rooms : [],
    islandCount: Number(data.islandCount || (Array.isArray(data.islands) ? data.islands.length : 0)),
    pieceCount: Number(data.pieceCount || 0),
    ...(donationConfig ? { donationConfig } : {}),
  };
}

function mapPieceDoc(id: string, data: Record<string, any>): MuseumPiece {
  const rawSale = String(data.saleStatus || 'not_for_sale');
  const saleStatus: SaleStatus =
    rawSale === 'for_sale' || rawSale === 'reserved' || rawSale === 'sold'
      ? rawSale
      : 'not_for_sale';

  const piece: MuseumPiece = {
    id,
    islandId: String(data.islandId || ''),
    roomId: String(data.roomId || ''),
    title: String(data.title || 'Pieza'),
    subtitle: String(data.subtitle || ''),
    body: String(data.body || ''),
    kind: (data.kind as PieceKind) || 'text',
    type: (data.type as PieceType) || 'text',
    url: String(data.url || ''),
    mediaDataUrl: typeof data.mediaDataUrl === 'string' && data.mediaDataUrl ? data.mediaDataUrl : null,
    custom: true,
    saleStatus,
    priceLabel: typeof data.priceLabel === 'string' ? data.priceLabel : '',
    mediumOrSize: typeof data.mediumOrSize === 'string' ? data.mediumOrSize : '',
    paymentUrl: typeof data.paymentUrl === 'string' ? data.paymentUrl : '',
  };
  if (data.curatedFrom && typeof data.curatedFrom === 'object') {
    piece.curatedFrom = sanitizeCuratedFrom(data.curatedFrom as CuratedFromMeta);
  }
  if (typeof data.loanInviteId === 'string' && data.loanInviteId) {
    piece.loanInviteId = data.loanInviteId;
  }
  return piece;
}

export async function signInWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function signOutCreator(): Promise<void> {
  await signOut(auth);
}

export async function loadUserCharacterPreference(uid: string): Promise<CharacterId | null> {
  const path = `users/${uid}/private/profile`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'profile'));
    if (!snap.exists()) return null;
    const ch = snap.data()?.characterId;
    if (['explorador', 'melomano', 'chef', 'astronomo', 'robot404'].includes(ch)) {
      return ch as CharacterId;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncUserPrivateProfile(user: User, characterId: CharacterId): Promise<void> {
  const path = `users/${user.uid}/private/profile`;
  try {
    const ref = doc(db, 'users', user.uid, 'private', 'profile');
    await setDoc(
      ref,
      {
        uid: user.uid,
        displayName: clampStr(user.displayName || 'Creador', 80) || 'Creador',
        email: clampStr(user.email || '', 160),
        characterId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPublicMuseums(): Promise<CloudMuseum[]> {
  const path = 'museums';
  try {
    const q = query(collection(db, 'museums'), where('isPublic', '==', true), limit(60));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapMuseumDoc(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchMyMuseums(uid: string): Promise<CloudMuseum[]> {
  const path = 'museums';
  try {
    const q = query(collection(db, 'museums'), where('ownerId', '==', uid), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapMuseumDoc(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchMuseumById(museumId: string): Promise<CloudMuseum | null> {
  const path = `museums/${museumId}`;
  try {
    const snap = await getDoc(doc(db, 'museums', museumId));
    if (!snap.exists()) return null;
    return mapMuseumDoc(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchMuseumPieces(
  museumId: string,
  ownerUid?: string | null,
  isPublic = true
): Promise<MuseumPiece[]> {
  const path = `museums/${museumId}/pieces`;
  try {
    const colRef = collection(db, 'museums', museumId, 'pieces');
    if (isPublic) {
      const q = query(colRef, where('isPublic', '==', true), limit(250));
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapPieceDoc(d.id, d.data()));
    }
    const uid = auth.currentUser?.uid;
    if (ownerUid && uid === ownerUid) {
      const q = query(colRef, where('ownerId', '==', ownerUid), limit(250));
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapPieceDoc(d.id, d.data()));
    }
    if (uid) {
      const q = query(colRef, where('ownerId', '==', uid), limit(250));
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapPieceDoc(d.id, d.data()));
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createCloudMuseum(
  user: User,
  input: {
    title: string;
    subtitle: string;
    authorName: string;
    category: MuseumCategory;
    templateId: string;
    theme: MuseumThemeConfig;
    defaultCharacterId: CharacterId;
    isPublic: boolean;
  }
): Promise<{ museum: CloudMuseum; pieces: MuseumPiece[] }> {
  const tpl = MUSEUM_TEMPLATES.find((t) => t.id === input.templateId) || MUSEUM_TEMPLATES[0];
  const museumId = makeId('museum');
  const islands = sanitizeIslands(tpl.islands);
  const rooms = sanitizeRooms(tpl.rooms);
  const theme = sanitizeTheme(input.theme);
  const title = clampStr(input.title.trim() || 'Mi Museo 404', 100);
  const subtitle = clampStr(input.subtitle.trim() || tpl.defaultSubtitle, 180);
  const authorName = clampStr(
    input.authorName.trim() || user.displayName || 'Creador',
    80
  );

  const museumPath = `museums/${museumId}`;
  try {
    await setDoc(doc(db, 'museums', museumId), {
      ownerId: user.uid,
      authorName,
      title,
      subtitle,
      category: input.category,
      templateId: clampStr(tpl.id, 40),
      theme,
      defaultCharacterId: input.defaultCharacterId,
      isPublic: Boolean(input.isPublic),
      islands,
      rooms,
      islandCount: islands.length,
      pieceCount: tpl.pieces.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, museumPath);
  }

  const createdPieces: MuseumPiece[] = [];
  if (tpl.pieces.length > 0) {
    const piecesPath = `museums/${museumId}/pieces`;
    try {
      const batch = writeBatch(db);
      for (const seed of tpl.pieces) {
        const pieceId = makeId('piece');
        const pieceRef = doc(db, 'museums', museumId, 'pieces', pieceId);
        const piecePayload = {
          museumId,
          ownerId: user.uid,
          islandId: cleanId(seed.islandId, 'isl'),
          roomId: cleanId(seed.roomId, 'room'),
          title: clampStr(seed.title, 120),
          subtitle: clampStr(seed.subtitle, 140),
          body: clampStr(seed.body, 12000),
          kind: seed.kind,
          type: seed.type,
          url: clampStr(seed.url || '', 1000),
          mediaDataUrl: '',
          isPublic: Boolean(input.isPublic),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(pieceRef, piecePayload);
        createdPieces.push({
          id: pieceId,
          islandId: piecePayload.islandId,
          roomId: piecePayload.roomId,
          title: piecePayload.title,
          subtitle: piecePayload.subtitle,
          body: piecePayload.body,
          kind: piecePayload.kind,
          type: piecePayload.type,
          url: piecePayload.url,
          mediaDataUrl: null,
          custom: true,
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, piecesPath);
    }
  }

  return {
    museum: {
      id: museumId,
      ownerId: user.uid,
      authorName,
      title,
      subtitle,
      category: input.category,
      templateId: tpl.id,
      theme,
      defaultCharacterId: input.defaultCharacterId,
      isPublic: Boolean(input.isPublic),
      islands,
      rooms,
      islandCount: islands.length,
      pieceCount: createdPieces.length,
    },
    pieces: createdPieces,
  };
}

export async function updateCloudMuseumMetadata(
  museum: CloudMuseum,
  patch: {
    authorName: string;
    title: string;
    subtitle: string;
    category: MuseumCategory;
    theme: MuseumThemeConfig;
    defaultCharacterId: CharacterId;
    isPublic: boolean;
    donationConfig?: DonationConfig;
  }
): Promise<CloudMuseum> {
  const path = `museums/${museum.id}`;
  const cleanTheme = sanitizeTheme(patch.theme);
  const authorName = clampStr(patch.authorName.trim() || museum.authorName, 80);
  const title = clampStr(patch.title.trim() || museum.title, 100);
  const subtitle = clampStr(patch.subtitle.trim(), 180);
  const cleanDonation = patch.donationConfig
    ? sanitizeDonationConfig(patch.donationConfig)
    : undefined;

  const payload: Record<string, unknown> = {
    authorName,
    title,
    subtitle,
    category: patch.category,
    theme: cleanTheme,
    defaultCharacterId: patch.defaultCharacterId,
    isPublic: Boolean(patch.isPublic),
    updatedAt: serverTimestamp(),
  };
  if (cleanDonation) {
    payload.donationConfig = cleanDonation;
  }

  try {
    await updateDoc(doc(db, 'museums', museum.id), payload);

    if (patch.isPublic !== museum.isPublic) {
      const piecesCol = collection(db, 'museums', museum.id, 'pieces');
      const piecesQuery = museum.isPublic
        ? query(piecesCol, where('isPublic', '==', true), limit(250))
        : query(piecesCol, where('ownerId', '==', museum.ownerId), limit(250));
      const piecesSnap = await getDocs(piecesQuery);
      if (!piecesSnap.empty) {
        const batch = writeBatch(db);
        piecesSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            isPublic: Boolean(patch.isPublic),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...museum,
    authorName,
    title,
    subtitle,
    category: patch.category,
    theme: cleanTheme,
    defaultCharacterId: patch.defaultCharacterId,
    isPublic: Boolean(patch.isPublic),
    ...(cleanDonation ? { donationConfig: cleanDonation } : {}),
  };
}

export async function updateCloudMuseumStructure(
  museum: CloudMuseum,
  nextIslands: Island[],
  nextRooms: Room[],
  nextPieceCount: number
): Promise<CloudMuseum> {
  const path = `museums/${museum.id}`;
  const islands = sanitizeIslands(nextIslands);
  const rooms = sanitizeRooms(nextRooms);
  const pieceCount = Math.max(0, Math.min(500, Math.round(nextPieceCount)));

  try {
    await updateDoc(doc(db, 'museums', museum.id), {
      islands,
      rooms,
      islandCount: islands.length,
      pieceCount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    ...museum,
    islands,
    rooms,
    islandCount: islands.length,
    pieceCount,
  };
}

export async function saveCloudPiece(
  museum: CloudMuseum,
  input: {
    id?: string;
    islandId: string;
    roomId: string;
    title: string;
    subtitle: string;
    body: string;
    type: PieceType;
    url: string;
    mediaDataUrl?: string | null;
    curatedFrom?: CuratedFromMeta;
    loanInviteId?: string;
    saleStatus?: SaleStatus;
    priceLabel?: string;
    mediumOrSize?: string;
    paymentUrl?: string;
  },
  currentTotalPieces: number
): Promise<{ piece: MuseumPiece; nextPieceCount: number }> {
  const isNew = !input.id;
  const pieceId = input.id ? cleanId(input.id, 'piece') : makeId('piece');
  const path = `museums/${museum.id}/pieces/${pieceId}`;
  const currentUid = auth.currentUser?.uid || museum.ownerId;
  const isMuseumOwner = currentUid === museum.ownerId;
  const loanInviteId = input.loanInviteId ? cleanId(input.loanInviteId, 'inv') : undefined;
  if (!isMuseumOwner && !loanInviteId) {
    throw new Error('No tienes permiso para guardar piezas en este museo.');
  }

  const kind: PieceKind =
    input.type === 'image'
      ? 'image'
      : input.type === 'audio'
        ? 'audio'
        : input.type === 'video'
          ? 'video'
          : input.type === 'link'
            ? 'link'
            : 'text';
  const rawMediaDataUrl = clampStr(input.mediaDataUrl || '', 180000).trim();
  if (rawMediaDataUrl && !/^data:image\//i.test(rawMediaDataUrl)) {
    throw new Error('Las imágenes guardadas en la nube deben tener formato data:image/.');
  }
  const mediaDataUrl = rawMediaDataUrl;
  const title = clampStr(input.title.trim() || 'Pieza', 120);
  const subtitle = clampStr(input.subtitle.trim(), 140);
  const body = clampStr(input.body || '', 12000);
  const url = clampStr(input.url.trim(), 1000);
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('Los enlaces externos deben comenzar con https:// o http://.');
  }
  const islandId = cleanId(input.islandId, 'isl');
  const roomId = cleanId(input.roomId, 'room');

  const saleStatus: SaleStatus =
    input.saleStatus && ['not_for_sale', 'for_sale', 'reserved', 'sold'].includes(input.saleStatus)
      ? input.saleStatus
      : 'not_for_sale';
  const priceLabel = clampStr(input.priceLabel?.trim() || '', 40);
  const mediumOrSize = clampStr(input.mediumOrSize?.trim() || '', 120);
  const paymentUrl = clampStr(input.paymentUrl?.trim() || '', 1000);
  if (paymentUrl && !/^https?:\/\//i.test(paymentUrl)) {
    throw new Error('El enlace de pago directo debe comenzar con https:// o http://.');
  }

  try {
    if (isNew) {
      const nextPieceCount = Math.min(500, currentTotalPieces + 1);
      const payload: Record<string, unknown> = {
        museumId: museum.id,
        ownerId: currentUid,
        islandId,
        roomId,
        title,
        subtitle,
        body,
        kind,
        type: input.type,
        url,
        mediaDataUrl,
        saleStatus,
        priceLabel,
        mediumOrSize,
        paymentUrl,
        isPublic: museum.isPublic,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.curatedFrom) {
        payload.curatedFrom = sanitizeCuratedFrom(input.curatedFrom);
      }
      if (loanInviteId) {
        payload.loanInviteId = loanInviteId;
      }

      if (isMuseumOwner) {
        const batch = writeBatch(db);
        batch.set(doc(db, 'museums', museum.id, 'pieces', pieceId), payload);
        batch.update(doc(db, 'museums', museum.id), {
          pieceCount: nextPieceCount,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        await setDoc(doc(db, 'museums', museum.id, 'pieces', pieceId), payload);
      }

      return {
        piece: {
          id: pieceId,
          islandId,
          roomId,
          title,
          subtitle,
          body,
          kind,
          type: input.type,
          url,
          mediaDataUrl: mediaDataUrl || null,
          custom: true,
          ...(input.curatedFrom ? { curatedFrom: sanitizeCuratedFrom(input.curatedFrom) } : {}),
          ...(loanInviteId ? { loanInviteId } : {}),
          saleStatus,
          priceLabel,
          mediumOrSize,
          paymentUrl,
        },
        nextPieceCount: isMuseumOwner ? nextPieceCount : currentTotalPieces,
      };
    }

    const updatePayload: Record<string, unknown> = {
      roomId,
      title,
      subtitle,
      body,
      kind,
      type: input.type,
      url,
      mediaDataUrl,
      saleStatus,
      priceLabel,
      mediumOrSize,
      paymentUrl,
      updatedAt: serverTimestamp(),
    };
    if (isMuseumOwner) {
      updatePayload.islandId = islandId;
    }

    await updateDoc(doc(db, 'museums', museum.id, 'pieces', pieceId), updatePayload);

    return {
      piece: {
        id: pieceId,
        islandId,
        roomId,
        title,
        subtitle,
        body,
        kind,
        type: input.type,
        url,
        mediaDataUrl: mediaDataUrl || null,
        custom: true,
        ...(input.curatedFrom ? { curatedFrom: input.curatedFrom } : {}),
        ...(loanInviteId ? { loanInviteId } : {}),
        saleStatus,
        priceLabel,
        mediumOrSize,
        paymentUrl,
      },
      nextPieceCount: currentTotalPieces,
    };
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCloudPiece(
  museumId: string,
  pieceId: string,
  currentTotalPieces: number,
  isMuseumOwner = true
): Promise<number> {
  const path = `museums/${museumId}/pieces/${pieceId}`;
  const nextPieceCount = Math.max(0, currentTotalPieces - 1);
  try {
    if (isMuseumOwner) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'museums', museumId, 'pieces', pieceId));
      batch.update(doc(db, 'museums', museumId), {
        pieceCount: nextPieceCount,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return nextPieceCount;
    }
    await deleteDoc(doc(db, 'museums', museumId, 'pieces', pieceId));
    return currentTotalPieces;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteCloudPiecesInIds(
  museumId: string,
  pieceIds: string[],
  nextPieceCount: number,
  nextIslands: Island[],
  nextRooms: Room[]
): Promise<void> {
  const path = `museums/${museumId}`;
  try {
    const batch = writeBatch(db);
    for (const pid of pieceIds.slice(0, 200)) {
      batch.delete(doc(db, 'museums', museumId, 'pieces', pid));
    }
    batch.update(doc(db, 'museums', museumId), {
      islands: sanitizeIslands(nextIslands),
      rooms: sanitizeRooms(nextRooms),
      islandCount: Math.min(20, nextIslands.length),
      pieceCount: Math.max(0, Math.min(500, nextPieceCount)),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteCloudMuseum(museumId: string, ownerUid: string): Promise<void> {
  const path = `museums/${museumId}`;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'museums', museumId, 'pieces'),
        where('ownerId', '==', ownerUid),
        limit(250)
      )
    );
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'museums', museumId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function curatePieceIntoMuseum(params: {
  targetMuseum: CloudMuseum;
  targetIslandId: string;
  targetRoomId: string;
  sourcePiece: MuseumPiece;
  sourceMuseumId: string;
  sourceMuseumTitle: string;
  sourceAuthorName: string;
  curatorialNote?: string;
}): Promise<{ piece: MuseumPiece; nextPieceCount: number }> {
  const {
    targetMuseum,
    targetIslandId,
    targetRoomId,
    sourcePiece,
    sourceMuseumId,
    sourceMuseumTitle,
    sourceAuthorName,
    curatorialNote,
  } = params;

  const baseBody =
    sourcePiece.body ||
    sourcePiece.lines?.join('\n\n') ||
    sourcePiece.painting?.desc ||
    sourcePiece.app?.desc ||
    '';

  const finalBody = curatorialNote?.trim()
    ? `${curatorialNote.trim()}\n\n—\n${baseBody}`.trim()
    : baseBody;

  const inferredType: PieceType =
    sourcePiece.type ||
    (sourcePiece.kind === 'link'
      ? 'link'
      : sourcePiece.kind === 'audio'
        ? 'audio'
        : sourcePiece.kind === 'video'
          ? 'video'
          : sourcePiece.mediaDataUrl
            ? 'image'
            : 'text');

  return saveCloudPiece(
    targetMuseum,
    {
      islandId: targetIslandId,
      roomId: targetRoomId,
      title: sourcePiece.title,
      subtitle: sourcePiece.subtitle || `De «${sourceMuseumTitle}»`,
      body: finalBody,
      type: inferredType,
      url: sourcePiece.url || '',
      mediaDataUrl: sourcePiece.mediaDataUrl || '',
      curatedFrom: {
        sourceMuseumId,
        sourceMuseumTitle,
        sourceAuthorName,
        sourcePieceId: sourcePiece.id,
        sourcePieceTitle: sourcePiece.title,
      },
    },
    targetMuseum.pieceCount
  );
}
