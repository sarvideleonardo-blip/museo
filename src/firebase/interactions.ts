import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { DEFAULT_MUSEUM_THEME } from '../data/themes';
import { makeId } from '../storage/museumStore';
import {
  CloudMuseum,
  DonationConfig,
  FlagshipConfig,
  FrameStyle,
  GuestbookEntry,
  InquiryStatus,
  Island,
  IslandInvite,
  IslandInviteStatus,
  IslandShapeStyle,
  LoanedIslandMeta,
  MuseumThemeConfig,
  PieceCommerceOverride,
  PurchaseInquiry,
  SaleStatus,
} from '../types/museum';
import { OperationType, auth, db, handleFirestoreError } from './client';

export const FLAGSHIP_ADMIN_EMAIL = 'sarvideleonardo@gmail.com';

export function isFlagshipAdminUser(user: User | null | undefined): boolean {
  return Boolean(user && user.emailVerified && user.email === FLAGSHIP_ADMIN_EMAIL);
}

function clampStr(val: unknown, max: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : fallback;
  return s.slice(0, max);
}

function cleanId(val: string, fallbackPrefix = 'id'): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return cleaned || makeId(fallbackPrefix);
}

function formatFirestoreDate(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof val === 'object' && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date(0).toISOString();
}

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code || '';
  const msg = (error as { message?: string }).message || '';
  return code === 'failed-precondition' || msg.includes('requires an index');
}

export function sanitizeDonationConfig(raw?: Partial<DonationConfig> | null): DonationConfig {
  const url = clampStr(raw?.url?.trim() || '', 1000);
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('El enlace de donación debe comenzar con https:// o http://.');
  }
  return {
    enabled: Boolean(raw?.enabled && url),
    url,
    platformLabel: clampStr(raw?.platformLabel?.trim() || 'PayPal', 40) || 'PayPal',
    note: clampStr(raw?.note?.trim() || '', 200),
  };
}

function sanitizeThemeForFlagship(theme?: Partial<MuseumThemeConfig>): MuseumThemeConfig {
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

function sanitizePieceCommerceMap(
  raw?: Record<string, Partial<PieceCommerceOverride>> | null
): Record<string, PieceCommerceOverride> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw).slice(0, 40);
  const out: Record<string, PieceCommerceOverride> = {};
  for (const [pieceId, val] of entries) {
    if (!val || typeof val !== 'object') continue;
    const saleStatus: SaleStatus =
      val.saleStatus && ['not_for_sale', 'for_sale', 'reserved', 'sold'].includes(val.saleStatus)
        ? val.saleStatus
        : 'not_for_sale';
    const paymentUrl = clampStr(val.paymentUrl?.trim() || '', 1000);
    if (paymentUrl && !/^https?:\/\//i.test(paymentUrl)) {
      throw new Error('El enlace de pago directo debe comenzar con https:// o http://.');
    }
    out[cleanId(pieceId, 'piece')] = {
      saleStatus,
      priceLabel: clampStr(val.priceLabel?.trim() || '', 40),
      mediumOrSize: clampStr(val.mediumOrSize?.trim() || '', 120),
      paymentUrl,
    };
  }
  return out;
}

// ============================================================
// LIBRO DE VISITAS (Guestbook abierto con apodo libre)
// ============================================================

function mapGuestbookDoc(id: string, data: Record<string, unknown>): GuestbookEntry {
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

export async function fetchGuestbookEntries(params: {
  museumId: string;
  roomId?: string | null;
  maxItems?: number;
}): Promise<GuestbookEntry[]> {
  const { museumId, roomId, maxItems = 50 } = params;
  const path = 'guestbook';
  const colRef = collection(db, 'guestbook');

  const constraints = [
    where('isVisible', '==', true),
    where('museumId', '==', museumId),
    ...(roomId ? [where('roomId', '==', roomId)] : []),
  ];

  try {
    const q = query(colRef, ...constraints, orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapGuestbookDoc(d.id, d.data()));
  } catch (error) {
    if (isMissingIndexError(error)) {
      try {
        const fallbackQ = query(colRef, ...constraints, limit(maxItems));
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => mapGuestbookDoc(d.id, d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (fallbackErr) {
        handleFirestoreError(fallbackErr, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createGuestbookEntry(input: {
  museumId: string;
  islandId: string;
  roomId: string;
  scopeLabel: string;
  nickname: string;
  message: string;
}): Promise<GuestbookEntry> {
  const entryId = makeId('gb');
  const path = `guestbook/${entryId}`;

  const nickname = clampStr(input.nickname.trim(), 40);
  const message = clampStr(input.message.trim(), 400);
  if (!nickname) {
    throw new Error('Escribe un apodo o nombre para firmar el libro de visitas.');
  }
  if (!message) {
    throw new Error('Escribe un mensaje antes de enviar tu firma.');
  }

  const museumId = cleanId(input.museumId, 'museo404');
  const islandId = clampStr(input.islandId.trim() || 'patio', 80) || 'patio';
  const roomId = clampStr(input.roomId.trim() || 'reception', 80) || 'reception';
  const scopeLabel = clampStr(input.scopeLabel.trim() || 'Recepción', 80) || 'Recepción';
  const verifiedUid =
    auth.currentUser && auth.currentUser.emailVerified ? auth.currentUser.uid : null;

  try {
    await setDoc(doc(db, 'guestbook', entryId), {
      museumId,
      islandId,
      roomId,
      scopeLabel,
      nickname,
      message,
      authorUid: verifiedUid,
      isVisible: true,
      createdAt: serverTimestamp(),
    });

    return {
      id: entryId,
      museumId,
      islandId,
      roomId,
      scopeLabel,
      nickname,
      message,
      authorUid: verifiedUid,
      isVisible: true,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function hideGuestbookEntry(entryId: string): Promise<void> {
  const path = `guestbook/${entryId}`;
  try {
    await updateDoc(doc(db, 'guestbook', entryId), {
      isVisible: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGuestbookEntry(entryId: string): Promise<void> {
  const path = `guestbook/${entryId}`;
  try {
    await deleteDoc(doc(db, 'guestbook', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================
// SOLICITUDES DE COMPRA (PII aislada por dueño / admin)
// ============================================================

function mapInquiryDoc(id: string, data: Record<string, unknown>): PurchaseInquiry {
  const rawStatus = String(data.status || 'pending');
  const status: InquiryStatus =
    rawStatus === 'contacted' || rawStatus === 'closed' ? rawStatus : 'pending';
  return {
    id,
    museumId: String(data.museumId || 'museo404'),
    museumOwnerId: String(data.museumOwnerId || 'museo404'),
    pieceId: String(data.pieceId || ''),
    pieceTitle: String(data.pieceTitle || 'Obra'),
    priceLabel: String(data.priceLabel || 'Consultar'),
    buyerName: String(data.buyerName || ''),
    buyerContact: String(data.buyerContact || ''),
    shippingLocation: String(data.shippingLocation || ''),
    message: String(data.message || ''),
    status,
    createdAt: formatFirestoreDate(data.createdAt),
    updatedAt: formatFirestoreDate(data.updatedAt),
  };
}

export async function createPurchaseInquiry(input: {
  museumId: string;
  museumOwnerId: string;
  pieceId: string;
  pieceTitle: string;
  priceLabel: string;
  buyerName: string;
  buyerContact: string;
  shippingLocation: string;
  message: string;
}): Promise<PurchaseInquiry> {
  const inquiryId = makeId('inq');
  const path = `purchaseInquiries/${inquiryId}`;

  const buyerName = clampStr(input.buyerName.trim(), 80);
  const buyerContact = clampStr(input.buyerContact.trim(), 120);
  const shippingLocation = clampStr(input.shippingLocation.trim(), 120);
  const message = clampStr(input.message.trim(), 500);

  if (!buyerName) {
    throw new Error('Escribe tu nombre para enviar la solicitud.');
  }
  if (buyerContact.length < 3) {
    throw new Error('Proporciona un correo o WhatsApp de contacto válido.');
  }

  const museumId = cleanId(input.museumId, 'museo404');
  const museumOwnerId =
    museumId === 'museo404' ? 'museo404' : cleanId(input.museumOwnerId, 'owner');
  const pieceId = clampStr(input.pieceId.trim() || 'piece', 128) || 'piece';
  const pieceTitle = clampStr(input.pieceTitle.trim() || 'Obra', 120) || 'Obra';
  const priceLabel = clampStr(input.priceLabel.trim() || 'Consultar', 40) || 'Consultar';

  try {
    await setDoc(doc(db, 'purchaseInquiries', inquiryId), {
      museumId,
      museumOwnerId,
      pieceId,
      pieceTitle,
      priceLabel,
      buyerName,
      buyerContact,
      shippingLocation,
      message,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nowIso = new Date().toISOString();
    return {
      id: inquiryId,
      museumId,
      museumOwnerId,
      pieceId,
      pieceTitle,
      priceLabel,
      buyerName,
      buyerContact,
      shippingLocation,
      message,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchOwnerInquiries(params: {
  museumId: string;
  ownerUid: string;
  isFlagshipAdmin: boolean;
}): Promise<PurchaseInquiry[]> {
  const { museumId, ownerUid, isFlagshipAdmin } = params;
  const path = 'purchaseInquiries';
  const colRef = collection(db, 'purchaseInquiries');

  const filterConstraint =
    museumId === 'museo404' && isFlagshipAdmin
      ? where('museumId', '==', 'museo404')
      : where('museumOwnerId', '==', ownerUid);

  try {
    const q = query(colRef, filterConstraint, orderBy('createdAt', 'desc'), limit(80));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapInquiryDoc(d.id, d.data()))
      .filter((item) => item.museumId === museumId);
  } catch (error) {
    if (isMissingIndexError(error)) {
      try {
        const fallbackQ = query(colRef, filterConstraint, limit(80));
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => mapInquiryDoc(d.id, d.data()))
          .filter((item) => item.museumId === museumId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (fallbackErr) {
        handleFirestoreError(fallbackErr, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateInquiryStatus(
  inquiryId: string,
  status: InquiryStatus
): Promise<void> {
  const path = `purchaseInquiries/${inquiryId}`;
  try {
    await updateDoc(doc(db, 'purchaseInquiries', inquiryId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePurchaseInquiry(inquiryId: string): Promise<void> {
  const path = `purchaseInquiries/${inquiryId}`;
  try {
    await deleteDoc(doc(db, 'purchaseInquiries', inquiryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================
// CONFIGURACIÓN DEL MUSEO INSIGNIA (Flagship /flagship/config)
// ============================================================

export async function fetchFlagshipCloudConfig(): Promise<FlagshipConfig | null> {
  const path = 'flagship/config';
  try {
    const snap = await getDoc(doc(db, 'flagship', 'config'));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const theme = sanitizeThemeForFlagship(data.theme as Partial<MuseumThemeConfig>);
    const donationConfig =
      data.donationConfig && typeof data.donationConfig === 'object'
        ? sanitizeDonationConfig(data.donationConfig as Partial<DonationConfig>)
        : undefined;
    const pieceCommerce =
      data.pieceCommerce && typeof data.pieceCommerce === 'object'
        ? sanitizePieceCommerceMap(
            data.pieceCommerce as Record<string, Partial<PieceCommerceOverride>>
          )
        : undefined;

    return {
      theme,
      ...(donationConfig ? { donationConfig } : {}),
      ...(pieceCommerce ? { pieceCommerce } : {}),
    };
  } catch (error) {
    // Si aún no existe o falla conexión inicial, se usa respaldo local
    console.warn('No se pudo leer flagship/config:', error);
    return null;
  }
}

export async function saveFlagshipCloudConfig(config: FlagshipConfig): Promise<FlagshipConfig> {
  const path = 'flagship/config';
  const theme = sanitizeThemeForFlagship(config.theme);
  const donationConfig = config.donationConfig
    ? sanitizeDonationConfig(config.donationConfig)
    : undefined;
  const pieceCommerce = config.pieceCommerce
    ? sanitizePieceCommerceMap(config.pieceCommerce)
    : undefined;

  const payload: Record<string, unknown> = {
    theme,
    updatedAt: serverTimestamp(),
  };
  if (donationConfig) {
    payload.donationConfig = donationConfig;
  }
  if (pieceCommerce) {
    payload.pieceCommerce = pieceCommerce;
  }

  try {
    await setDoc(doc(db, 'flagship', 'config'), payload, { merge: false });
    return {
      theme,
      ...(donationConfig ? { donationConfig } : {}),
      ...(pieceCommerce ? { pieceCommerce } : {}),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================
// ISLAS PRESTADAS — INVITACIONES MÁGICAS (/islandInvites)
// ============================================================

function mapIslandInviteDoc(id: string, data: Record<string, unknown>): IslandInvite {
  const rawStatus = String(data.status || 'pending');
  const status: IslandInviteStatus =
    rawStatus === 'accepted' || rawStatus === 'revoked' ? rawStatus : 'pending';
  return {
    id,
    museumId: String(data.museumId || ''),
    museumTitle: String(data.museumTitle || 'Museo'),
    hostUid: String(data.hostUid || ''),
    hostName: String(data.hostName || 'Creador'),
    islandId: String(data.islandId || ''),
    islandTitle: String(data.islandTitle || 'Isla'),
    status,
    guestUid: typeof data.guestUid === 'string' && data.guestUid ? data.guestUid : null,
    guestName: String(data.guestName || ''),
    sourceMuseumId: String(data.sourceMuseumId || ''),
    sourceMuseumTitle: String(data.sourceMuseumTitle || ''),
    sourceMuseumUrl: String(data.sourceMuseumUrl || ''),
    createdAt: formatFirestoreDate(data.createdAt),
    updatedAt: formatFirestoreDate(data.updatedAt),
  };
}

export function inviteToLoanedMeta(invite: IslandInvite): LoanedIslandMeta {
  return {
    loanId: invite.id,
    sourceMuseumId: invite.sourceMuseumId || '',
    sourceMuseumTitle: invite.sourceMuseumTitle || invite.guestName || 'Museo invitado',
    sourceAuthorName: invite.guestName || 'Creador invitado',
    sourceMuseumUrl:
      invite.sourceMuseumUrl ||
      (invite.sourceMuseumId ? `?museum=${encodeURIComponent(invite.sourceMuseumId)}` : ''),
    sourceIslandId: invite.islandId,
    guestUid: invite.guestUid,
    guestName: invite.guestName,
    loanedAt: invite.updatedAt || invite.createdAt,
  };
}

export function isValidSourceMuseumUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /^(\?museum=[a-zA-Z0-9_-]+|https?:\/\/.+)$/i.test(trimmed);
}

export async function createIslandInvite(params: {
  museum: CloudMuseum;
  island: Island;
  hostUser: User;
}): Promise<IslandInvite> {
  const { museum, island, hostUser } = params;
  const inviteId = makeId('inv');
  const path = `islandInvites/${inviteId}`;
  const museumId = cleanId(museum.id, 'museum');
  const museumTitle = clampStr(museum.title.trim() || 'Mi Museo', 100);
  const hostName = clampStr(museum.authorName.trim() || hostUser.displayName || 'Creador', 80);
  const islandId = clampStr(island.id, 80);
  const islandTitle = clampStr(island.title.trim() || island.mapLabel || 'Isla prestada', 80);

  try {
    await setDoc(doc(db, 'islandInvites', inviteId), {
      museumId,
      museumTitle,
      hostUid: hostUser.uid,
      hostName,
      islandId,
      islandTitle,
      status: 'pending',
      guestUid: null,
      guestName: '',
      sourceMuseumId: '',
      sourceMuseumTitle: '',
      sourceMuseumUrl: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const nowIso = new Date().toISOString();
    return {
      id: inviteId,
      museumId,
      museumTitle,
      hostUid: hostUser.uid,
      hostName,
      islandId,
      islandTitle,
      status: 'pending',
      guestUid: null,
      guestName: '',
      sourceMuseumId: '',
      sourceMuseumTitle: '',
      sourceMuseumUrl: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchIslandInvite(inviteId: string): Promise<IslandInvite | null> {
  const cleaned = inviteId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) return null;
  const path = `islandInvites/${cleaned}`;
  try {
    const snap = await getDoc(doc(db, 'islandInvites', cleaned));
    if (!snap.exists()) return null;
    return mapIslandInviteDoc(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAcceptedLoansForMuseum(museumId: string): Promise<IslandInvite[]> {
  const path = 'islandInvites';
  try {
    const q = query(
      collection(db, 'islandInvites'),
      where('museumId', '==', museumId),
      where('status', '==', 'accepted'),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapIslandInviteDoc(d.id, d.data()));
  } catch (error) {
    if (isMissingIndexError(error)) {
      try {
        const fallbackQ = query(
          collection(db, 'islandInvites'),
          where('status', '==', 'accepted'),
          limit(80)
        );
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => mapIslandInviteDoc(d.id, d.data()))
          .filter((i) => i.museumId === museumId);
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetches all accepted loans across the network.
 * Used by MuseumDirectoryModal to accurately identify museums with active loaned islands
 * in a single bounded query rather than per-museum N+1 queries.
 */
export async function fetchAllAcceptedLoans(maxLimit = 150): Promise<IslandInvite[]> {
  const path = 'islandInvites';
  try {
    const q = query(
      collection(db, 'islandInvites'),
      where('status', '==', 'accepted'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapIslandInviteDoc(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchHostInvitesForMuseum(
  museumId: string,
  hostUid: string
): Promise<IslandInvite[]> {
  const path = 'islandInvites';
  try {
    const q = query(
      collection(db, 'islandInvites'),
      where('hostUid', '==', hostUid),
      where('museumId', '==', museumId),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapIslandInviteDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if (isMissingIndexError(error)) {
      try {
        const fallbackQ = query(
          collection(db, 'islandInvites'),
          where('hostUid', '==', hostUid),
          limit(60)
        );
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => mapIslandInviteDoc(d.id, d.data()))
          .filter((i) => i.museumId === museumId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchMyGuestLoans(guestUid: string): Promise<IslandInvite[]> {
  const path = 'islandInvites';
  try {
    const q = query(
      collection(db, 'islandInvites'),
      where('guestUid', '==', guestUid),
      where('status', '==', 'accepted'),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapIslandInviteDoc(d.id, d.data()));
  } catch (error) {
    if (isMissingIndexError(error)) {
      try {
        const fallbackQ = query(
          collection(db, 'islandInvites'),
          where('guestUid', '==', guestUid),
          limit(40)
        );
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => mapIslandInviteDoc(d.id, d.data()))
          .filter((i) => i.status === 'accepted');
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, path);
      }
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function acceptIslandInvite(params: {
  inviteId: string;
  user: User;
  guestName: string;
  sourceMuseumId: string;
  sourceMuseumTitle: string;
  sourceMuseumUrl: string;
}): Promise<IslandInvite> {
  const inviteId = params.inviteId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `islandInvites/${inviteId}`;
  const guestName = clampStr(params.guestName.trim(), 80);
  const sourceMuseumTitle = clampStr(params.sourceMuseumTitle.trim(), 100);
  const sourceMuseumId = clampStr(params.sourceMuseumId.trim(), 128);
  const sourceMuseumUrl = clampStr(params.sourceMuseumUrl.trim(), 1000);

  if (!guestName) {
    throw new Error('Escribe tu nombre o apodo de creador.');
  }
  if (!sourceMuseumTitle) {
    throw new Error('Escribe el nombre de tu museo o proyecto de origen.');
  }
  if (!isValidSourceMuseumUrl(sourceMuseumUrl)) {
    throw new Error('El enlace de origen debe ser https://... o ?museum=ID.');
  }

  try {
    await updateDoc(doc(db, 'islandInvites', inviteId), {
      status: 'accepted',
      guestUid: params.user.uid,
      guestName,
      sourceMuseumId,
      sourceMuseumTitle,
      sourceMuseumUrl,
      updatedAt: serverTimestamp(),
    });
    const refreshed = await fetchIslandInvite(inviteId);
    if (!refreshed) {
      throw new Error('No se pudo leer la invitación actualizada.');
    }
    return refreshed;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function revokeIslandInvite(inviteId: string): Promise<void> {
  const path = `islandInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'islandInvites', inviteId), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteIslandInvite(inviteId: string): Promise<void> {
  const path = `islandInvites/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'islandInvites', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
