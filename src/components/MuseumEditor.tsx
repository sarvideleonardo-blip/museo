import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Heart,
  KeyRound,
  Link2,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CHARACTER_PROFILES } from '../data/characters';
import { BIOME_LABELS, ORIGINAL_ISLANDS, getBasePiecesForIsland } from '../data/initialContent';
import { CATEGORY_META, DEFAULT_MUSEUM_THEME, MUSEUM_THEME_PRESETS } from '../data/themes';
import {
  evaluateInviteExpiration,
  formatElapsedTime,
  formatReadableDate,
} from '../utils/inviteHelpers';
import {
  createIslandInvite,
  deleteIslandInvite,
  deletePurchaseInquiry,
  fetchHostInvitesForMuseum,
  fetchOwnerInquiries,
  isValidSourceMuseumUrl,
  revokeIslandInvite,
  sanitizeDonationConfig,
  updateInquiryStatus,
} from '../firebase/interactions';
import {
  deleteCloudMuseum,
  deleteCloudPiece,
  deleteCloudPiecesInIds,
  saveCloudPiece,
  updateCloudMuseumMetadata,
  updateCloudMuseumStructure,
} from '../firebase/museumNetwork';
import { compactImage, compactImageToDataUrl, deleteMedia, getMedia, putMedia } from '../storage/mediaDb';
import {
  createNewIsland,
  deleteCompleteIsland,
  exportMuseumBackup,
  getPiecesCountForIsland,
  getPiecesForRoom,
  getResolvedIslands,
  getRoomsForIsland,
  importMuseumBackup,
  makeId,
  suggestIslandPosition,
} from '../storage/museumStore';
import {
  CharacterId,
  CloudMuseum,
  DonationConfig,
  FlagshipConfig,
  FrameStyle,
  InquiryStatus,
  Island,
  IslandBiome,
  IslandInvite,
  IslandShapeStyle,
  LoanedIslandMeta,
  MuseumCategory,
  MuseumPiece,
  MuseumState,
  MuseumThemeConfig,
  PieceType,
  PurchaseInquiry,
  Room,
  SaleStatus,
  ThemeId,
} from '../types/museum';

export type EditorSource =
  | {
      kind: 'local';
      state: MuseumState;
      onUpdateState: (next: MuseumState) => void;
      theme?: MuseumThemeConfig;
      onUpdateTheme?: (next: MuseumThemeConfig) => void;
      flagshipConfig?: FlagshipConfig;
      onSaveFlagshipConfig?: (next: FlagshipConfig) => Promise<void> | void;
      isFlagshipAdmin?: boolean;
      authUser?: User | null;
    }
  | {
      kind: 'cloud';
      museum: CloudMuseum;
      pieces: MuseumPiece[];
      onSyncMuseum: (nextMuseum: CloudMuseum, nextPieces: MuseumPiece[]) => void;
      onDeletedMuseum: (deletedMuseumId: string) => void;
      authUser?: User | null;
      guestAccess?: {
        inviteId: string;
        allowedIslandId: string;
        museumTitle: string;
      };
    };

interface MuseumEditorProps {
  source: EditorSource;
  initialViewMode?: 'appearance' | 'inquiries';
  onClose: () => void;
}

type EditorView =
  | { mode: 'appearance' }
  | { mode: 'inquiries' }
  | { mode: 'island'; islandId: string }
  | { mode: 'new-island' }
  | { mode: 'room'; islandId: string; roomId: string }
  | { mode: 'piece'; islandId: string; roomId: string; pieceId: string | null };

const DEFAULT_DONATION_STATE: DonationConfig = {
  enabled: false,
  url: '',
  platformLabel: 'PayPal',
  note: '',
};

const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  not_for_sale: 'No está a la venta (solo archivo)',
  for_sale: 'En venta (disponible)',
  reserved: 'Reservada',
  sold: 'Vendida',
};

const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  closed: 'Cerrada',
};

export const MuseumEditor: React.FC<MuseumEditorProps> = ({
  source,
  initialViewMode,
  onClose,
}) => {
  const isCloud = source.kind === 'cloud';
  const esInvitado = Boolean(source.kind === 'cloud' && source.guestAccess);
  const guestAccess = source.kind === 'cloud' ? source.guestAccess : undefined;
  const isFlagshipAdmin = source.kind === 'local' && Boolean(source.isFlagshipAdmin);
  const canManageDonations = (isCloud && !esInvitado) || isFlagshipAdmin;
  const canManageInquiries = (isCloud && !esInvitado && Boolean(source.authUser?.uid)) || isFlagshipAdmin;

  const allIslands: Island[] = isCloud
    ? source.museum.islands
    : getResolvedIslands(source.state, false);
  const visibleIslands: Island[] =
    esInvitado && guestAccess
      ? allIslands.filter((i) => i.id === guestAccess.allowedIslandId)
      : allIslands;

  const hiddenOriginals = isCloud
    ? []
    : ORIGINAL_ISLANDS.filter((i) => source.state.hiddenIslands.includes(i.id));

  const getRooms = (islandId: string): Room[] =>
    isCloud
      ? source.museum.rooms.filter((r) => r.islandId === islandId)
      : getRoomsForIsland(source.state, islandId);

  const getPieces = (islandId: string, roomId: string): MuseumPiece[] => {
    if (isCloud) {
      return source.pieces.filter((p) => p.islandId === islandId && p.roomId === roomId);
    }
    const base = getPiecesForRoom(source.state, islandId, roomId);
    const commerceMap = source.flagshipConfig?.pieceCommerce;
    if (!commerceMap) return base;
    return base.map((p) => {
      const ov = source.state.overrides[p.id];
      const cloudComm = commerceMap[p.id];
      if (!cloudComm) return p;
      return {
        ...p,
        saleStatus: ov?.saleStatus ?? cloudComm.saleStatus,
        priceLabel: ov?.priceLabel ?? cloudComm.priceLabel,
        mediumOrSize: ov?.mediumOrSize ?? cloudComm.mediumOrSize,
        paymentUrl: ov?.paymentUrl ?? cloudComm.paymentUrl,
      };
    });
  };

  const getIslandPiecesCount = (islandId: string): number =>
    isCloud
      ? source.pieces.filter((p) => p.islandId === islandId).length
      : getPiecesCountForIsland(source.state, islandId);

  const [view, setView] = useState<EditorView>(() => {
    if (esInvitado && guestAccess) {
      return { mode: 'island', islandId: guestAccess.allowedIslandId };
    }
    if (initialViewMode === 'appearance') return { mode: 'appearance' };
    if (initialViewMode === 'inquiries' && canManageInquiries) return { mode: 'inquiries' };
    return {
      mode: 'island',
      islandId: visibleIslands[0]?.id || 'patio',
    };
  });
  const [notice, setNotice] = useState<string>(
    esInvitado
      ? 'Modo Invitado: solo puedes agregar, editar y borrar tus piezas en esta isla prestada.'
      : isCloud
        ? 'Este museo se guarda en la nube y puede visitarse desde el directorio.'
        : isFlagshipAdmin
          ? 'Editando como curador principal de Museo 404.'
          : 'Los cambios se guardan automáticamente en este navegador.'
  );
  const [confirmState, setConfirmState] = useState<{
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Estado de Apariencia / Metadatos del museo
  const [metaTitle, setMetaTitle] = useState(isCloud ? source.museum.title : 'MUSEO 404 · siNOMBRE');
  const [metaSubtitle, setMetaSubtitle] = useState(
    isCloud ? source.museum.subtitle : 'Un archipiélago de ideas'
  );
  const [metaAuthor, setMetaAuthor] = useState(isCloud ? source.museum.authorName : '');
  const [metaCategory, setMetaCategory] = useState<MuseumCategory>(
    isCloud ? source.museum.category : 'personal'
  );
  const [metaIsPublic, setMetaIsPublic] = useState<boolean>(isCloud ? source.museum.isPublic : false);
  const [metaCharacter, setMetaCharacter] = useState<CharacterId>(
    isCloud ? source.museum.defaultCharacterId : 'explorador'
  );
  const [metaTheme, setMetaTheme] = useState<MuseumThemeConfig>(
    isCloud
      ? { ...DEFAULT_MUSEUM_THEME, ...source.museum.theme }
      : { ...DEFAULT_MUSEUM_THEME, ...(source.theme || source.flagshipConfig?.theme || {}) }
  );
  const initialDonation = isCloud
    ? source.museum.donationConfig
    : source.flagshipConfig?.donationConfig;
  const [donationEnabled, setDonationEnabled] = useState<boolean>(Boolean(initialDonation?.enabled));
  const [donationPlatform, setDonationPlatform] = useState<string>(
    initialDonation?.platformLabel || DEFAULT_DONATION_STATE.platformLabel
  );
  const [donationUrl, setDonationUrl] = useState<string>(initialDonation?.url || '');
  const [donationNote, setDonationNote] = useState<string>(initialDonation?.note || '');
  const [savingMeta, setSavingMeta] = useState(false);

  // Estado de Solicitudes de Compra
  const [inquiries, setInquiries] = useState<PurchaseInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);

  // Formulario inline para nueva sala
  const [creatingRoomName, setCreatingRoomName] = useState('');
  const [showNewRoomForm, setShowNewRoomForm] = useState(false);

  // Formulario de nueva isla
  const suggestedPos = suggestIslandPosition(visibleIslands);
  const [newIslTitle, setNewIslTitle] = useState('');
  const [newIslLabel, setNewIslLabel] = useState('');
  const [newIslBiome, setNewIslBiome] = useState<IslandBiome>('forest');
  const [newIslEyebrow, setNewIslEyebrow] = useState('NUEVA ISLA DEL ARCHIPIÉLAGO');
  const [newIslDesc, setNewIslDesc] = useState('');
  const [newIslFooter, setNewIslFooter] = useState('Colección insular');
  const [newIslX, setNewIslX] = useState<number>(suggestedPos.x);
  const [newIslY, setNewIslY] = useState<number>(suggestedPos.y);

  const activeIsland =
    view.mode !== 'new-island' && view.mode !== 'appearance' && view.mode !== 'inquiries'
      ? visibleIslands.find((i) => i.id === view.islandId) || visibleIslands[0]
      : null;

  const [islTitle, setIslTitle] = useState(activeIsland?.title || '');
  const [islLabel, setIslLabel] = useState(activeIsland?.mapLabel || '');
  const [islEyebrow, setIslEyebrow] = useState(activeIsland?.eyebrow || '');
  const [islDesc, setIslDesc] = useState(activeIsland?.description || '');
  const [islFooter, setIslFooter] = useState(activeIsland?.footer || '');
  const [islBiome, setIslBiome] = useState<IslandBiome>(activeIsland?.biome || 'forest');
  const [islX, setIslX] = useState<number>(activeIsland?.x || 50);
  const [islY, setIslY] = useState<number>(activeIsland?.y || 50);
  const [localLoanEnabled, setLocalLoanEnabled] = useState<boolean>(Boolean(activeIsland?.loaned));
  const [localLoanMuseumTitle, setLocalLoanMuseumTitle] = useState<string>(
    activeIsland?.loaned?.sourceMuseumTitle || ''
  );
  const [localLoanAuthor, setLocalLoanAuthor] = useState<string>(
    activeIsland?.loaned?.sourceAuthorName || ''
  );
  const [localLoanUrl, setLocalLoanUrl] = useState<string>(
    activeIsland?.loaned?.sourceMuseumUrl || ''
  );

  // Invitaciones mágicas de Isla Prestada (anfitrión en la nube)
  const [islandInvites, setIslandInvites] = useState<IslandInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');

  const [pieceTitle, setPieceTitle] = useState('');
  const [pieceSubtitle, setPieceSubtitle] = useState('');
  const [pieceType, setPieceType] = useState<PieceType>('text');
  const [pieceBody, setPieceBody] = useState('');
  const [pieceUrl, setPieceUrl] = useState('');
  const [pieceSaleStatus, setPieceSaleStatus] = useState<SaleStatus>('not_for_sale');
  const [piecePriceLabel, setPiecePriceLabel] = useState('');
  const [pieceMediumOrSize, setPieceMediumOrSize] = useState('');
  const [piecePaymentUrl, setPiecePaymentUrl] = useState('');
  const [pieceFile, setPieceFile] = useState<File | null>(null);
  const [pieceClearMedia, setPieceClearMedia] = useState(false);
  const [piecePreviewSrc, setPiecePreviewSrc] = useState<string | null>(null);
  const [piecePreviewKind, setPiecePreviewKind] = useState<'image' | 'audio' | 'video' | null>(null);
  const [piecePreviewLabel, setPiecePreviewLabel] = useState<string>('');
  const [savingPiece, setSavingPiece] = useState(false);

  // Pila básica de deshacer para ediciones locales del Taller Interno
  const [localUndoStack, setLocalUndoStack] = useState<MuseumState[]>([]);

  const commitLocalState = useCallback(
    (nextState: MuseumState) => {
      if (source.kind !== 'local') return;
      setLocalUndoStack((prev) => [source.state, ...prev].slice(0, 10));
      source.onUpdateState(nextState);
    },
    [source]
  );

  const handleUndoLocal = useCallback(() => {
    if (source.kind !== 'local' || localUndoStack.length === 0) return;
    const [previous, ...rest] = localUndoStack;
    setLocalUndoStack(rest);
    source.onUpdateState(previous);
    setNotice('Se deshizo el último cambio local.');
  }, [localUndoStack, source]);

  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const loadHostInvites = useCallback(async () => {
    if (source.kind !== 'cloud' || esInvitado) return;
    const hostUid = source.authUser?.uid || source.museum.ownerId;
    if (!hostUid) return;
    setLoadingInvites(true);
    try {
      const list = await fetchHostInvitesForMuseum(source.museum.id, hostUid);
      setIslandInvites(list);
    } catch {
      // no bloquear edición si falla lectura puntual
    } finally {
      setLoadingInvites(false);
    }
  }, [esInvitado, source]);

  const loadInquiriesList = useCallback(async () => {
    if (!canManageInquiries) return;
    const ownerUid =
      source.kind === 'cloud'
        ? source.authUser?.uid || source.museum.ownerId
        : source.authUser?.uid || '';
    const museumId = source.kind === 'cloud' ? source.museum.id : 'museo404';
    if (!ownerUid) return;

    setInquiriesLoading(true);
    setInquiriesError(null);
    try {
      const list = await fetchOwnerInquiries({
        museumId,
        ownerUid,
        isFlagshipAdmin,
      });
      setInquiries(list);
    } catch (err) {
      setInquiriesError(
        err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes de compra.'
      );
    } finally {
      setInquiriesLoading(false);
    }
  }, [canManageInquiries, isFlagshipAdmin, source]);

  useEffect(() => {
    if (view.mode === 'inquiries') {
      loadInquiriesList();
    }
  }, [view.mode, loadInquiriesList]);

  useEffect(() => {
    if (source.kind === 'cloud' && !esInvitado && view.mode === 'island') {
      loadHostInvites();
    }
  }, [source.kind, esInvitado, view.mode, loadHostInvites]);

  useEffect(() => {
    if (view.mode !== 'piece') {
      setPiecePreviewSrc(null);
      setPiecePreviewKind(null);
      setPiecePreviewLabel('');
      return;
    }

    let cancelled = false;
    let revokeUrl: string | null = null;

    if (pieceFile) {
      const objectUrl = URL.createObjectURL(pieceFile);
      revokeUrl = objectUrl;
      const detectedKind: 'image' | 'audio' | 'video' | null = pieceFile.type.startsWith('image/')
        ? 'image'
        : pieceFile.type.startsWith('audio/')
          ? 'audio'
          : pieceFile.type.startsWith('video/')
            ? 'video'
            : null;
      const sizeKb = Math.max(1, Math.round(pieceFile.size / 1024));
      const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
      setPiecePreviewSrc(objectUrl);
      setPiecePreviewKind(detectedKind);
      setPiecePreviewLabel(`${pieceFile.name} · ${sizeLabel}`);
      return () => {
        if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      };
    }

    if (pieceClearMedia) {
      setPiecePreviewSrc(null);
      setPiecePreviewKind(null);
      setPiecePreviewLabel('');
      return;
    }

    const existing = view.pieceId
      ? getPieces(view.islandId, view.roomId).find((p) => p.id === view.pieceId) || null
      : null;

    if (existing?.mediaDataUrl) {
      setPiecePreviewSrc(existing.mediaDataUrl);
      setPiecePreviewKind('image');
      setPiecePreviewLabel('Imagen actual guardada en la nube');
      return;
    }

    if (existing?.mediaKey) {
      getMedia(existing.mediaKey).then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setPiecePreviewSrc(null);
          setPiecePreviewKind(null);
          setPiecePreviewLabel('');
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revokeUrl = objectUrl;
        const blobKind: 'image' | 'audio' | 'video' | null = blob.type.startsWith('audio/')
          ? 'audio'
          : blob.type.startsWith('video/')
            ? 'video'
            : 'image';
        setPiecePreviewSrc(objectUrl);
        setPiecePreviewKind(blobKind);
        setPiecePreviewLabel('Archivo actual guardado en este navegador');
      });
      return () => {
        cancelled = true;
        if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      };
    }

    setPiecePreviewSrc(null);
    setPiecePreviewKind(null);
    setPiecePreviewLabel('');
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pieceFile, pieceClearMedia]);

  const selectIsland = (islandId: string) => {
    const found = visibleIslands.find((i) => i.id === islandId);
    if (!found) return;
    setIslTitle(found.title);
    setIslLabel(found.mapLabel);
    setIslEyebrow(found.eyebrow);
    setIslDesc(found.description);
    setIslFooter(found.footer);
    setIslBiome(found.biome);
    setIslX(found.x);
    setIslY(found.y);
    setLocalLoanEnabled(Boolean(found.loaned));
    setLocalLoanMuseumTitle(found.loaned?.sourceMuseumTitle || '');
    setLocalLoanAuthor(found.loaned?.sourceAuthorName || '');
    setLocalLoanUrl(found.loaned?.sourceMuseumUrl || '');
    setShowNewRoomForm(false);
    setView({ mode: 'island', islandId });
  };

  const openRoom = (islandId: string, roomId: string) => {
    const room = getRooms(islandId).find((r) => r.id === roomId);
    if (!room) return;
    setRoomName(room.name);
    setRoomDesc(room.description);
    setView({ mode: 'room', islandId, roomId });
  };

  const openPieceForm = (islandId: string, roomId: string, pieceId: string | null) => {
    const existing = pieceId
      ? getPieces(islandId, roomId).find((p) => p.id === pieceId) || null
      : null;

    setPieceTitle(existing?.title || '');
    setPieceSubtitle(existing?.subtitle || '');
    const inferredType: PieceType = existing
      ? existing.type ||
        (existing.kind === 'painting' || existing.kind === 'image'
          ? 'image'
          : existing.kind === 'link'
            ? 'link'
            : existing.kind === 'audio'
              ? 'audio'
              : existing.kind === 'video'
                ? 'video'
                : 'text')
      : 'text';
    setPieceType(inferredType);
    setPieceBody(existing?.body || existing?.lines?.join('\n\n') || '');
    setPieceUrl(existing?.url || '');
    setPieceSaleStatus(existing?.saleStatus || 'not_for_sale');
    setPiecePriceLabel(existing?.priceLabel || '');
    setPieceMediumOrSize(existing?.mediumOrSize || '');
    setPiecePaymentUrl(existing?.paymentUrl || '');
    setPieceFile(null);
    setPieceClearMedia(false);
    setView({ mode: 'piece', islandId, roomId, pieceId });
  };

  const handleSaveAppearance = async () => {
    let cleanDonation: DonationConfig | undefined;
    if (canManageDonations) {
      try {
        cleanDonation = sanitizeDonationConfig({
          enabled: donationEnabled,
          url: donationUrl,
          platformLabel: donationPlatform,
          note: donationNote,
        });
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Enlace de donación inválido.');
        return;
      }
    }

    if (source.kind === 'local') {
      source.onUpdateTheme?.(metaTheme);
      if (isFlagshipAdmin && source.onSaveFlagshipConfig) {
        setSavingMeta(true);
        try {
          await source.onSaveFlagshipConfig({
            theme: metaTheme,
            ...(cleanDonation ? { donationConfig: cleanDonation } : {}),
            ...(source.flagshipConfig?.pieceCommerce
              ? { pieceCommerce: source.flagshipConfig.pieceCommerce }
              : {}),
          });
          setNotice('Apariencia, arquitectura y enlace de donación guardados en la nube.');
        } catch (err) {
          setNotice(err instanceof Error ? err.message : 'No se pudo guardar en /flagship/config.');
        } finally {
          setSavingMeta(false);
        }
        return;
      }
      setNotice('Colores, siluetas y marcos del museo actualizados.');
      return;
    }

    setSavingMeta(true);
    try {
      const updated = await updateCloudMuseumMetadata(source.museum, {
        title: metaTitle,
        subtitle: metaSubtitle,
        authorName: metaAuthor,
        category: metaCategory,
        theme: metaTheme,
        defaultCharacterId: metaCharacter,
        isPublic: metaIsPublic,
        ...(cleanDonation ? { donationConfig: cleanDonation } : {}),
      });
      source.onSyncMuseum(updated, source.pieces);
      setNotice('Apariencia, donaciones e identidad del museo guardados en la nube.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo guardar la apariencia.');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleUpdateInquiry = async (inquiry: PurchaseInquiry, nextStatus: InquiryStatus) => {
    if (inquiry.status === 'closed') return;
    setUpdatingInquiryId(inquiry.id);
    try {
      await updateInquiryStatus(inquiry.id, nextStatus);
      setInquiries((prev) =>
        prev.map((it) => (it.id === inquiry.id ? { ...it, status: nextStatus } : it))
      );
      setNotice(`Solicitud de «${inquiry.pieceTitle}» marcada como ${INQUIRY_STATUS_LABELS[nextStatus].toLowerCase()}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo actualizar la solicitud.');
    } finally {
      setUpdatingInquiryId(null);
    }
  };

  const handleDeleteInquiry = (inquiry: PurchaseInquiry) => {
    setConfirmState({
      message: `¿Eliminar la solicitud de compra de ${inquiry.buyerName} por «${inquiry.pieceTitle}»?`,
      confirmLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await deletePurchaseInquiry(inquiry.id);
        setInquiries((prev) => prev.filter((it) => it.id !== inquiry.id));
        setNotice('Solicitud eliminada.');
      },
    });
  };

  const handleDeleteEntireCloudMuseum = () => {
    if (source.kind !== 'cloud') return;
    setConfirmState({
      message: `¿Eliminar por completo el museo «${source.museum.title}» y todas sus piezas publicadas? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar museo',
      onConfirm: async () => {
        await deleteCloudMuseum(source.museum.id, source.museum.ownerId);
        source.onDeletedMuseum(source.museum.id);
      },
    });
  };

  const handleSaveIsland = async () => {
    if (!activeIsland) return;
    if (source.kind === 'local' && localLoanEnabled) {
      if (!localLoanMuseumTitle.trim()) {
        setNotice('Escribe el nombre del museo de origen para la Isla Prestada.');
        return;
      }
      if (!isValidSourceMuseumUrl(localLoanUrl)) {
        setNotice('El enlace de origen debe comenzar con https://, http:// o ?museum=ID.');
        return;
      }
    }

    const nextLoaned: LoanedIslandMeta | undefined =
      source.kind === 'local' && localLoanEnabled
        ? {
            loanId: activeIsland.loaned?.loanId || makeId('loan'),
            sourceMuseumId: activeIsland.loaned?.sourceMuseumId || '',
            sourceMuseumTitle: localLoanMuseumTitle.trim(),
            sourceAuthorName: localLoanAuthor.trim() || undefined,
            sourceMuseumUrl: localLoanUrl.trim(),
            sourceIslandId: activeIsland.id,
            loanedAt: activeIsland.loaned?.loanedAt || new Date().toISOString(),
          }
        : undefined;

    const updatedMeta: Partial<Island> = {
      mapLabel: islLabel.trim() || activeIsland.mapLabel,
      title: islTitle.trim() || activeIsland.title,
      eyebrow: islEyebrow.trim(),
      description: islDesc,
      footer: islFooter,
      biome: islBiome,
      x: Math.max(10, Math.min(90, Number(islX) || activeIsland.x)),
      y: Math.max(18, Math.min(86, Number(islY) || activeIsland.y)),
      loaned: nextLoaned,
    };

    if (source.kind === 'local') {
      const nextCustomIslands = activeIsland.isOriginal
        ? source.state.customIslands
        : source.state.customIslands.map((ci) => {
            if (ci.id !== activeIsland.id) return ci;
            const merged = { ...ci, ...updatedMeta };
            if (!nextLoaned) delete merged.loaned;
            return merged;
          });
      const nextIslandMeta = {
        ...source.state.islandMeta,
        [activeIsland.id]: updatedMeta,
      };
      if (!nextLoaned) {
        delete nextIslandMeta[activeIsland.id].loaned;
      }
      const nextStateDraft: MuseumState = {
        ...source.state,
        customIslands: nextCustomIslands,
        islandMeta: nextIslandMeta,
      };
      const resolvedLoaned = getResolvedIslands(nextStateDraft, false)
        .map((isl) => isl.loaned)
        .filter((l): l is LoanedIslandMeta => Boolean(l));

      commitLocalState({
        ...nextStateDraft,
        islasPrestadas: resolvedLoaned,
      });
      setNotice(`Isla «${updatedMeta.title}» actualizada.`);
    } else {
      try {
        const nextIslands = source.museum.islands.map((isl) =>
          isl.id === activeIsland.id ? { ...isl, ...updatedMeta } : isl
        );
        const updatedMuseum = await updateCloudMuseumStructure(
          source.museum,
          nextIslands,
          source.museum.rooms,
          source.pieces.length
        );
        source.onSyncMuseum(updatedMuseum, source.pieces);
        setNotice(`Isla «${updatedMeta.title}» guardada en la nube.`);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'No se pudo actualizar la isla.');
      }
    }
  };

  const handleCreateNewIsland = async () => {
    if (!newIslTitle.trim()) {
      setNotice('Escribe un nombre para la nueva isla.');
      return;
    }

    if (source.kind === 'local') {
      const { nextState, newIsland } = createNewIsland(source.state, {
        title: newIslTitle,
        mapLabel: newIslLabel || newIslTitle,
        biome: newIslBiome,
        eyebrow: newIslEyebrow,
        description: newIslDesc,
        footer: newIslFooter,
        x: newIslX,
        y: newIslY,
      });
      commitLocalState(nextState);
      setNotice(`Isla «${newIsland.title}» creada en el archipiélago.`);

      setNewIslTitle('');
      setNewIslLabel('');
      setNewIslDesc('');
      setIslTitle(newIsland.title);
      setIslLabel(newIsland.mapLabel);
      setIslEyebrow(newIsland.eyebrow);
      setIslDesc(newIsland.description);
      setIslFooter(newIsland.footer);
      setIslBiome(newIsland.biome);
      setIslX(newIsland.x);
      setIslY(newIsland.y);
      setView({ mode: 'island', islandId: newIsland.id });
      return;
    }

    if (source.museum.islands.length >= 20) {
      setNotice('El museo en la nube admite un máximo de 20 islas.');
      return;
    }
    if (source.museum.rooms.length >= 60) {
      setNotice('El museo alcanzó el límite de 60 salas.');
      return;
    }

    const newIslandId = makeId('isl');
    const newIsland: Island = {
      id: newIslandId,
      isOriginal: false,
      biome: newIslBiome,
      x: Math.max(10, Math.min(90, Number(newIslX) || 50)),
      y: Math.max(18, Math.min(86, Number(newIslY) || 50)),
      mapLabel: (newIslLabel || newIslTitle).trim().toUpperCase(),
      title: newIslTitle.trim(),
      eyebrow: newIslEyebrow.trim() || 'NUEVA ISLA',
      description: newIslDesc.trim(),
      footer: newIslFooter.trim() || 'Colección insular',
    };
    const defaultRoom: Room = {
      id: makeId('room'),
      islandId: newIslandId,
      name: `Sala de ${newIsland.title}`,
      description: 'Espacio inicial de exhibición.',
    };

    try {
      const nextIslands = [...source.museum.islands, newIsland];
      const nextRooms = [...source.museum.rooms, defaultRoom];
      const updatedMuseum = await updateCloudMuseumStructure(
        source.museum,
        nextIslands,
        nextRooms,
        source.pieces.length
      );
      source.onSyncMuseum(updatedMuseum, source.pieces);
      setNotice(`Isla «${newIsland.title}» creada en la nube.`);
      setNewIslTitle('');
      setNewIslLabel('');
      setNewIslDesc('');
      setIslTitle(newIsland.title);
      setIslLabel(newIsland.mapLabel);
      setIslEyebrow(newIsland.eyebrow);
      setIslDesc(newIsland.description);
      setIslFooter(newIsland.footer);
      setIslBiome(newIsland.biome);
      setIslX(newIsland.x);
      setIslY(newIsland.y);
      setView({ mode: 'island', islandId: newIsland.id });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo crear la isla.');
    }
  };

  const handleDeleteIsland = (islandId: string) => {
    const target = visibleIslands.find((i) => i.id === islandId);
    if (!target) return;
    if (visibleIslands.length <= 1) {
      setNotice('El archipiélago necesita al menos una isla visible.');
      return;
    }

    const message = target.isOriginal
      ? `¿Quitar «${target.title}» del mapa? Podrás restaurar esta isla original más adelante desde el Editor.`
      : `¿Eliminar por completo la isla «${target.title}» y todas sus salas y piezas? Esta acción no se puede deshacer.`;

    setConfirmState({
      message,
      confirmLabel: target.isOriginal ? 'Quitar del mapa' : 'Sí, eliminar isla',
      onConfirm: async () => {
        if (source.kind === 'local') {
          const nextState = await deleteCompleteIsland(source.state, islandId);
          commitLocalState(nextState);
          const remaining = getResolvedIslands(nextState, false);
          const nextFirst = remaining[0];
          if (nextFirst) {
            setIslTitle(nextFirst.title);
            setIslLabel(nextFirst.mapLabel);
            setIslEyebrow(nextFirst.eyebrow);
            setIslDesc(nextFirst.description);
            setIslFooter(nextFirst.footer);
            setIslBiome(nextFirst.biome);
            setIslX(nextFirst.x);
            setIslY(nextFirst.y);
            setView({ mode: 'island', islandId: nextFirst.id });
          }
          setNotice(`Isla «${target.title}» eliminada del mapa.`);
          return;
        }

        const nextIslands = source.museum.islands.filter((i) => i.id !== islandId);
        const nextRooms = source.museum.rooms.filter((r) => r.islandId !== islandId);
        const piecesToRemove = source.pieces
          .filter((p) => p.islandId === islandId)
          .map((p) => p.id);
        const remainingPieces = source.pieces.filter((p) => p.islandId !== islandId);

        await deleteCloudPiecesInIds(
          source.museum.id,
          piecesToRemove,
          remainingPieces.length,
          nextIslands,
          nextRooms
        );
        source.onSyncMuseum(
          {
            ...source.museum,
            islands: nextIslands,
            rooms: nextRooms,
            islandCount: nextIslands.length,
            pieceCount: remainingPieces.length,
          },
          remainingPieces
        );
        const nextFirst = nextIslands[0];
        if (nextFirst) {
          setIslTitle(nextFirst.title);
          setIslLabel(nextFirst.mapLabel);
          setIslEyebrow(nextFirst.eyebrow);
          setIslDesc(nextFirst.description);
          setIslFooter(nextFirst.footer);
          setIslBiome(nextFirst.biome);
          setIslX(nextFirst.x);
          setIslY(nextFirst.y);
          setView({ mode: 'island', islandId: nextFirst.id });
        }
        setNotice(`Isla «${target.title}» eliminada.`);
      },
    });
  };

  const handleRestoreOriginalIsland = (islandId: string) => {
    if (source.kind !== 'local') return;
    const nextState: MuseumState = {
      ...source.state,
      hiddenIslands: source.state.hiddenIslands.filter((id) => id !== islandId),
    };
    commitLocalState(nextState);
    setNotice('Isla original restaurada en el archipiélago.');
  };

  const handleCreateRoom = async () => {
    if (!activeIsland) return;
    const trimmed = creatingRoomName.trim();
    if (!trimmed) {
      setNotice('Escribe un nombre para la sala.');
      return;
    }

    const newRoom: Room = {
      id: makeId('room'),
      islandId: activeIsland.id,
      name: trimmed,
      description: '',
    };

    if (source.kind === 'local') {
      const nextState: MuseumState = {
        ...source.state,
        rooms: {
          ...source.state.rooms,
          [activeIsland.id]: [...getRoomsForIsland(source.state, activeIsland.id), newRoom],
        },
      };
      commitLocalState(nextState);
      setCreatingRoomName('');
      setShowNewRoomForm(false);
      setNotice(`Sala «${trimmed}» creada.`);
      return;
    }

    if (source.museum.rooms.length >= 60) {
      setNotice('Has alcanzado el máximo de 60 salas en este museo.');
      return;
    }

    try {
      const nextRooms = [...source.museum.rooms, newRoom];
      const updatedMuseum = await updateCloudMuseumStructure(
        source.museum,
        source.museum.islands,
        nextRooms,
        source.pieces.length
      );
      source.onSyncMuseum(updatedMuseum, source.pieces);
      setCreatingRoomName('');
      setShowNewRoomForm(false);
      setNotice(`Sala «${trimmed}» creada.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo crear la sala.');
    }
  };

  const handleDeleteRoom = (islandId: string, roomId: string) => {
    const rooms = getRooms(islandId);
    if (rooms.length <= 1) {
      setNotice('Cada isla debe conservar al menos una sala.');
      return;
    }
    const pieces = getPieces(islandId, roomId);
    setConfirmState({
      message: `¿Eliminar esta sala y sus ${pieces.length} piezas?`,
      confirmLabel: 'Sí, eliminar sala',
      onConfirm: async () => {
        if (source.kind === 'local') {
          for (const p of pieces) {
            if (p.mediaKey) await deleteMedia(p.mediaKey);
          }
          const nextHidden = [...source.state.hidden];
          const nextOverrides = { ...source.state.overrides };
          for (const p of pieces) {
            if (!p.custom) {
              if (!nextHidden.includes(p.id)) nextHidden.push(p.id);
              delete nextOverrides[p.id];
            }
          }
          const nextState: MuseumState = {
            ...source.state,
            rooms: {
              ...source.state.rooms,
              [islandId]: rooms.filter((r) => r.id !== roomId),
            },
            customItems: source.state.customItems.filter(
              (i) => !(i.islandId === islandId && i.roomId === roomId)
            ),
            hidden: nextHidden,
            overrides: nextOverrides,
          };
          commitLocalState(nextState);
          setView({ mode: 'island', islandId });
          setNotice('Sala eliminada.');
          return;
        }

        const nextRooms = source.museum.rooms.filter((r) => r.id !== roomId);
        const removeIds = pieces.map((p) => p.id);
        const remainingPieces = source.pieces.filter(
          (p) => !(p.islandId === islandId && p.roomId === roomId)
        );
        await deleteCloudPiecesInIds(
          source.museum.id,
          removeIds,
          remainingPieces.length,
          source.museum.islands,
          nextRooms
        );
        source.onSyncMuseum(
          {
            ...source.museum,
            rooms: nextRooms,
            pieceCount: remainingPieces.length,
          },
          remainingPieces
        );
        setView({ mode: 'island', islandId });
        setNotice('Sala eliminada.');
      },
    });
  };

  const handleSaveRoom = async () => {
    if (view.mode !== 'room') return;

    if (source.kind === 'local') {
      const rooms = getRoomsForIsland(source.state, view.islandId).map((r) =>
        r.id === view.roomId
          ? { ...r, name: roomName.trim() || r.name, description: roomDesc }
          : r
      );
      commitLocalState({
        ...source.state,
        rooms: { ...source.state.rooms, [view.islandId]: rooms },
      });
      setNotice('Sala guardada.');
      return;
    }

    try {
      const nextRooms = source.museum.rooms.map((r) =>
        r.id === view.roomId
          ? { ...r, name: roomName.trim() || r.name, description: roomDesc }
          : r
      );
      const updatedMuseum = await updateCloudMuseumStructure(
        source.museum,
        source.museum.islands,
        nextRooms,
        source.pieces.length
      );
      source.onSyncMuseum(updatedMuseum, source.pieces);
      setNotice('Sala guardada en la nube.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo guardar la sala.');
    }
  };

  const handleSavePiece = async () => {
    if (view.mode !== 'piece') return;
    const title = pieceTitle.trim();
    if (!title) {
      setNotice('Escribe un título para la pieza.');
      return;
    }

    const cleanPaymentUrl = piecePaymentUrl.trim();
    if (cleanPaymentUrl && !/^https?:\/\//i.test(cleanPaymentUrl)) {
      setNotice('El enlace de pago directo debe comenzar con https:// o http://.');
      return;
    }

    const cleanPriceLabel = piecePriceLabel.trim().slice(0, 40);
    const cleanMediumOrSize = pieceMediumOrSize.trim().slice(0, 120);

    setSavingPiece(true);
    try {
      const existing = view.pieceId
        ? getPieces(view.islandId, view.roomId).find((p) => p.id === view.pieceId) || null
        : null;

      if (source.kind === 'local') {
        const isCustom = existing ? Boolean(existing.custom) : true;
        let mediaKey = existing?.mediaKey || null;

        if (pieceClearMedia && !pieceFile) {
          if (existing?.mediaKey) {
            await deleteMedia(existing.mediaKey);
          }
          mediaKey = null;
        }

        if (pieceFile) {
          const nextMediaKey = makeId('media');
          const uploadBlob =
            pieceType === 'image' || pieceFile.type.startsWith('image/')
              ? await compactImage(pieceFile)
              : pieceFile;
          await putMedia(nextMediaKey, uploadBlob);
          if (existing?.mediaKey && existing.mediaKey !== nextMediaKey) {
            await deleteMedia(existing.mediaKey);
          }
          mediaKey = nextMediaKey;
        }

        const savedPieceId = existing?.id || makeId('piece');

        if (isCustom) {
          const newPiece: MuseumPiece = {
            id: savedPieceId,
            islandId: view.islandId,
            roomId: view.roomId,
            title,
            subtitle: pieceSubtitle.trim(),
            body: pieceBody,
            kind:
              pieceType === 'image'
                ? 'image'
                : pieceType === 'audio'
                  ? 'audio'
                  : pieceType === 'video'
                    ? 'video'
                    : pieceType === 'link'
                      ? 'link'
                      : 'text',
            type: pieceType,
            url: pieceUrl.trim(),
            mediaKey,
            custom: true,
            saleStatus: pieceSaleStatus,
            priceLabel: cleanPriceLabel,
            mediumOrSize: cleanMediumOrSize,
            paymentUrl: cleanPaymentUrl,
          };

          const nextCustomItems = existing
            ? source.state.customItems.map((i) => (i.id === existing.id ? newPiece : i))
            : [...source.state.customItems, newPiece];

          commitLocalState({ ...source.state, customItems: nextCustomItems });
        } else if (existing) {
          commitLocalState({
            ...source.state,
            overrides: {
              ...source.state.overrides,
              [existing.id]: {
                ...(source.state.overrides[existing.id] || {}),
                title,
                subtitle: pieceSubtitle.trim(),
                body: pieceBody,
                ...(pieceFile || pieceClearMedia ? { type: pieceType, mediaKey } : {}),
                saleStatus: pieceSaleStatus,
                priceLabel: cleanPriceLabel,
                mediumOrSize: cleanMediumOrSize,
                paymentUrl: cleanPaymentUrl,
              },
            },
          });
        }

        if (isFlagshipAdmin && source.onSaveFlagshipConfig) {
          const currentCommerce = { ...(source.flagshipConfig?.pieceCommerce || {}) };
          currentCommerce[savedPieceId] = {
            saleStatus: pieceSaleStatus,
            priceLabel: cleanPriceLabel,
            mediumOrSize: cleanMediumOrSize,
            paymentUrl: cleanPaymentUrl,
          };
          await source.onSaveFlagshipConfig({
            theme: source.flagshipConfig?.theme || metaTheme,
            ...(source.flagshipConfig?.donationConfig
              ? { donationConfig: source.flagshipConfig.donationConfig }
              : {}),
            pieceCommerce: currentCommerce,
          });
        }

        setNotice(
          isFlagshipAdmin
            ? `Pieza «${title}» guardada y estado de venta publicado.`
            : `Pieza «${title}» guardada.`
        );
        openRoom(view.islandId, view.roomId);
        return;
      }

      // Modo nube (Firestore)
      let mediaDataUrl = pieceClearMedia ? '' : existing?.mediaDataUrl || '';
      if (pieceFile) {
        if (!pieceFile.type.startsWith('image/')) {
          setNotice(
            'Para audio o vídeo en museos en la nube pega un enlace directo (MP3, MP4, YouTube, etc.) en el campo URL.'
          );
          setSavingPiece(false);
          return;
        }
        mediaDataUrl = await compactImageToDataUrl(pieceFile, 155000);
      }

      const effectiveLoanInviteId =
        esInvitado && guestAccess ? guestAccess.inviteId : existing?.loanInviteId;

      const { piece: savedPiece, nextPieceCount } = await saveCloudPiece(
        source.museum,
        {
          id: existing?.id,
          islandId: view.islandId,
          roomId: view.roomId,
          title,
          subtitle: pieceSubtitle.trim(),
          body: pieceBody,
          type: pieceType,
          url: pieceUrl.trim(),
          mediaDataUrl,
          curatedFrom: existing?.curatedFrom,
          ...(effectiveLoanInviteId ? { loanInviteId: effectiveLoanInviteId } : {}),
          saleStatus: pieceSaleStatus,
          priceLabel: cleanPriceLabel,
          mediumOrSize: cleanMediumOrSize,
          paymentUrl: cleanPaymentUrl,
        },
        source.pieces.length
      );

      const nextPieces = existing
        ? source.pieces.map((p) => (p.id === savedPiece.id ? savedPiece : p))
        : [...source.pieces, savedPiece];
      source.onSyncMuseum({ ...source.museum, pieceCount: nextPieceCount }, nextPieces);
      setNotice(`Pieza «${title}» guardada en la nube.`);
      openRoom(view.islandId, view.roomId);
    } catch (error) {
      setNotice(
        'No se pudo guardar la pieza: ' +
          (error instanceof Error ? error.message : 'verifica el tamaño o los permisos.')
      );
    } finally {
      setSavingPiece(false);
    }
  };

  const handleRemovePiece = (islandId: string, roomId: string, piece: MuseumPiece) => {
    setConfirmState({
      message:
        isCloud || piece.custom
          ? `¿Eliminar la pieza «${piece.title}»?`
          : `¿Ocultar la pieza original «${piece.title}»? Podrás restaurarla después en esta sala.`,
      confirmLabel: isCloud || piece.custom ? 'Sí, eliminar' : 'Sí, ocultar',
      onConfirm: async () => {
        if (source.kind === 'local') {
          if (piece.mediaKey) await deleteMedia(piece.mediaKey);
          if (piece.custom) {
            commitLocalState({
              ...source.state,
              customItems: source.state.customItems.filter((i) => i.id !== piece.id),
            });
          } else {
            const nextOverrides = { ...source.state.overrides };
            delete nextOverrides[piece.id];
            commitLocalState({
              ...source.state,
              hidden: Array.from(new Set([...source.state.hidden, piece.id])),
              overrides: nextOverrides,
            });
          }
          setNotice(piece.custom ? 'Pieza eliminada.' : 'Pieza original ocultada.');
          return;
        }

        const nextPieceCount = await deleteCloudPiece(
          source.museum.id,
          piece.id,
          source.pieces.length,
          !esInvitado
        );
        const nextPieces = source.pieces.filter((p) => p.id !== piece.id);
        source.onSyncMuseum({ ...source.museum, pieceCount: nextPieceCount }, nextPieces);
        setNotice('Pieza eliminada de la sala.');
      },
    });
  };

  const handleRestoreRoomHiddenPieces = (islandId: string, roomId: string) => {
    if (source.kind !== 'local') return;
    const baseInRoom = getBasePiecesForIsland(islandId)
      .filter((p) => p.roomId === roomId)
      .map((p) => p.id);
    commitLocalState({
      ...source.state,
      hidden: source.state.hidden.filter((id) => !baseInRoom.includes(id)),
    });
    setNotice('Piezas originales restauradas en esta sala.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor del museo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02111a]/85 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="relative flex h-[92vh] max-h-[860px] w-full max-w-[1140px] flex-col overflow-hidden border-[3px] border-[#e1c875] bg-[#0b2b39] text-[#f8f4df] shadow-[0_24px_80px_rgba(0,0,0,0.55),8px_8px_0_rgba(0,0,0,0.22)]">
        {/* Cabecera del Editor */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f3d889]/30 bg-gradient-to-r from-[#164e59] to-[#092b3b] px-5 py-4">
          <div>
            <p className="font-pixel text-[9px] text-[#f4d47d]">
              {source.kind === 'cloud'
                ? esInvitado
                  ? `${source.museum.title.toUpperCase()} · ISLA PRESTADA (INVITADO)`
                  : `${source.museum.title.toUpperCase()} · EN LA NUBE`
                : 'MUSEO 404 · TALLER INTERNO'}
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-[#fff9e8]">
              {esInvitado ? 'Tu isla prestada' : 'Editor del museo'}
            </h2>
            <p className="text-sm text-[#c4ded2]">
              {esInvitado
                ? 'Sube y gestiona tus obras en esta isla prestada. El resto del museo permanece en modo solo lectura.'
                : 'Personaliza colores, crea islas y salas, presta espacios a otros creadores y sube obras.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {source.kind === 'local' && (
              <>
                <button
                  type="button"
                  disabled={localUndoStack.length === 0}
                  onClick={handleUndoLocal}
                  title="Deshacer el último cambio local"
                  className="inline-flex min-h-[38px] items-center gap-1.5 border border-[#d8c47b] bg-[#062230] px-3 py-2 text-xs font-semibold text-[#fff5d7] hover:bg-[#174d58] disabled:opacity-45 tabular-nums"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Deshacer{localUndoStack.length > 0 ? ` (${localUndoStack.length})` : ''}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await exportMuseumBackup(source.state);
                    setNotice('Copia de seguridad exportada.');
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 border border-[#d8c47b] bg-[#062230] px-3 py-2 text-xs font-semibold text-[#fff5d7] hover:bg-[#174d58]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar copia
                </button>
                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 border border-[#d8c47b] bg-[#062230] px-3 py-2 text-xs font-semibold text-[#fff5d7] hover:bg-[#174d58]"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importar copia
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imported = await importMuseumBackup(file);
                      source.onUpdateState(imported);
                      const first = getResolvedIslands(imported, false)[0];
                      if (first) selectIsland(first.id);
                      setNotice('Copia importada correctamente.');
                    } catch (err) {
                      setNotice(
                        'No se pudo importar: ' +
                          (err instanceof Error ? err.message : 'archivo inválido')
                      );
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar editor"
              className="flex h-9 w-9 items-center justify-center border border-[#d8c47b] bg-[#174d58] text-white hover:bg-[#b25f37]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Cuerpo: Sidebar de islas + panel principal */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[245px_minmax(0,1fr)]">
          <nav
            aria-label="Islas del museo"
            className="museum-scroll flex flex-row gap-2 overflow-x-auto border-b border-[#f3d889]/20 bg-[#082532] p-3 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r"
          >
            {!esInvitado && (
              <button
                type="button"
                onClick={() => setView({ mode: 'appearance' })}
                className={`flex shrink-0 items-center justify-center gap-2 border px-3 py-2.5 text-sm font-bold transition-colors ${
                  view.mode === 'appearance'
                    ? 'border-[#f1d17c] bg-[#1d6873] text-[#fff9e8]'
                    : 'border-[#f1d17c]/45 bg-[#0f3644] text-[#f4d47d] hover:bg-[#174d58]'
                }`}
              >
                <Palette className="h-4 w-4" />
                <span>Colores y diseño</span>
              </button>
            )}

            {canManageInquiries && !esInvitado && (
              <button
                type="button"
                onClick={() => setView({ mode: 'inquiries' })}
                className={`flex shrink-0 items-center justify-center gap-2 border px-3 py-2.5 text-sm font-bold transition-colors ${
                  view.mode === 'inquiries'
                    ? 'border-[#f1d17c] bg-[#b25f37] text-[#fff9e8]'
                    : 'border-[#f1d17c]/45 bg-[#0f3644] text-[#f4d47d] hover:bg-[#174d58]'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Solicitudes</span>
              </button>
            )}

            {!esInvitado && (
              <button
                type="button"
                onClick={() => {
                  const nextPos = suggestIslandPosition(visibleIslands);
                  setNewIslX(nextPos.x);
                  setNewIslY(nextPos.y);
                  setView({ mode: 'new-island' });
                }}
                className={`flex shrink-0 items-center justify-center gap-2 border border-dashed px-3 py-2.5 text-sm font-bold transition-colors ${
                  view.mode === 'new-island'
                    ? 'border-[#f1d17c] bg-[#bd7544] text-[#fff9e8]'
                    : 'border-[#f1d17c]/70 bg-[#174d58]/50 text-[#f4d47d] hover:bg-[#174d58]'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>Nueva isla</span>
              </button>
            )}

            {visibleIslands.map((isl) => {
              const isSelected =
                view.mode !== 'new-island' &&
                view.mode !== 'appearance' &&
                view.mode !== 'inquiries' &&
                view.islandId === isl.id;
              const rCount = getRooms(isl.id).length;
              const pCount = getIslandPiecesCount(isl.id);
              return (
                <button
                  key={isl.id}
                  type="button"
                  onClick={() => selectIsland(isl.id)}
                  className={`min-w-[155px] shrink-0 border p-3 text-left transition-colors md:min-w-0 md:w-full ${
                    isSelected
                      ? 'border-[#f1d17c] bg-[#dbb85c]/15'
                      : 'border-[#e0d7a5]/20 bg-white/[0.04] hover:bg-white/[0.08]'
                  }`}
                >
                  <strong className="block truncate text-base font-semibold text-[#fff9e8]">
                    {isl.title}
                  </strong>
                  <span className="mt-1 block text-xs text-[#9fc4b8] tabular-nums">
                    {rCount} salas · {pCount} piezas {!isl.isOriginal ? '· Propia' : ''}
                  </span>
                </button>
              );
            })}

            {hiddenOriginals.length > 0 && (
              <div className="mt-2 hidden border-t border-white/10 pt-3 md:block">
                <p className="mb-2 text-xs text-[#9fc4b8]">Islas originales ocultas</p>
                {hiddenOriginals.map((isl) => (
                  <button
                    key={isl.id}
                    type="button"
                    onClick={() => handleRestoreOriginalIsland(isl.id)}
                    className="mb-1.5 flex w-full items-center justify-between border border-white/15 bg-white/5 px-2.5 py-2 text-xs text-[#d7ebe2] hover:bg-white/15"
                  >
                    <span className="truncate">{isl.title}</span>
                    <RotateCcw className="h-3.5 w-3.5 shrink-0 text-[#f4d47d]" />
                  </button>
                ))}
              </div>
            )}
          </nav>

          {/* Contenido del Editor */}
          <div className="museum-scroll min-w-0 overflow-y-auto p-5 sm:p-6">
            {view.mode === 'appearance' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-pixel text-[10px] leading-relaxed text-[#f4d47d]">
                    COLORES, DISEÑO E IDENTIDAD DEL MUSEO
                  </h3>
                  {isCloud && (
                    <button
                      type="button"
                      onClick={handleDeleteEntireCloudMuseum}
                      className="inline-flex items-center gap-1.5 border border-[#bd7967] bg-[#603d3d] px-3 py-1.5 text-xs text-[#ffd5c7] hover:bg-[#7b4949]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar museo
                    </button>
                  )}
                </div>

                {isCloud && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">Título del museo</label>
                      <input
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">Nombre de autor o proyecto</label>
                      <input
                        value={metaAuthor}
                        onChange={(e) => setMetaAuthor(e.target.value)}
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">Subtítulo</label>
                      <input
                        value={metaSubtitle}
                        onChange={(e) => setMetaSubtitle(e.target.value)}
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">Categoría</label>
                      <select
                        value={metaCategory}
                        onChange={(e) => setMetaCategory(e.target.value as MuseumCategory)}
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      >
                        {(Object.entries(CATEGORY_META) as [MuseumCategory, { label: string }][]).map(
                          ([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">Personaje sugerido</label>
                      <select
                        value={metaCharacter}
                        onChange={(e) => setMetaCharacter(e.target.value as CharacterId)}
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      >
                        {CHARACTER_PROFILES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-3 border border-white/15 bg-white/[0.04] p-3 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={metaIsPublic}
                        onChange={(e) => setMetaIsPublic(e.target.checked)}
                        className="h-4 w-4 accent-[#f4d47d]"
                      />
                      <span>Visible en el directorio público de museos</span>
                    </label>
                  </div>
                )}

                <div>
                  <p className="mb-2.5 text-xs font-semibold text-[#c7ded2]">Paletas listas</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {MUSEUM_THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setMetaTheme(preset.config)}
                        className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs ${
                          metaTheme.presetId === preset.id
                            ? 'border-[#f4d47d] bg-[#175160] text-[#fff9e8]'
                            : 'border-[#e0d7a5]/25 bg-white/[0.04] text-[#c4ded2] hover:bg-white/[0.08]'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 border border-black/40"
                          style={{ backgroundColor: preset.config.skyColor }}
                        />
                        <span
                          className="h-3.5 w-3.5 border border-black/40"
                          style={{ backgroundColor: preset.config.oceanColor }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                      <span className="mb-1.5 block text-[#c7ded2]">Cielo / Niebla</span>
                      <input
                        type="color"
                        value={metaTheme.skyColor}
                        onChange={(e) =>
                          setMetaTheme((t) => ({ ...t, presetId: 'custom', skyColor: e.target.value }))
                        }
                        className="h-8 w-full cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                    <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                      <span className="mb-1.5 block text-[#c7ded2]">Océano</span>
                      <input
                        type="color"
                        value={metaTheme.oceanColor}
                        onChange={(e) =>
                          setMetaTheme((t) => ({ ...t, presetId: 'custom', oceanColor: e.target.value }))
                        }
                        className="h-8 w-full cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                    <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                      <span className="mb-1.5 block text-[#c7ded2]">Acento dorado</span>
                      <input
                        type="color"
                        value={metaTheme.accentColor}
                        onChange={(e) =>
                          setMetaTheme((t) => ({ ...t, presetId: 'custom', accentColor: e.target.value }))
                        }
                        className="h-8 w-full cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                    <label className="border border-white/15 bg-white/[0.04] p-2.5 text-xs">
                      <span className="mb-1.5 block text-[#c7ded2]">Paneles</span>
                      <input
                        type="color"
                        value={metaTheme.surfaceColor}
                        onChange={(e) =>
                          setMetaTheme((t) => ({ ...t, presetId: 'custom', surfaceColor: e.target.value }))
                        }
                        className="h-8 w-full cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                    <div className="col-span-2 border border-white/15 bg-white/[0.04] p-2.5 text-xs sm:col-span-1">
                      <span className="mb-1.5 block text-[#c7ded2]">Luz de salas 2D</span>
                      <select
                        value={metaTheme.roomThemeId}
                        onChange={(e) =>
                          setMetaTheme((t) => ({ ...t, roomThemeId: e.target.value as ThemeId }))
                        }
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-2 py-1 text-xs text-[#183b42]"
                      >
                        <option value="classic">Clásico</option>
                        <option value="night">Nocturno</option>
                        <option value="twilight">Crepúsculo</option>
                        <option value="gameboy">Consola 89</option>
                      </select>
                    </div>
                  </div>

                  {/* Personalización expresiva: Siluetas y Marcos */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="border border-white/15 bg-white/[0.04] p-3.5">
                      <label className="mb-1.5 block text-xs font-semibold text-[#c7ded2]">
                        Arquitectura de las islas (3D y Mapa)
                      </label>
                      <select
                        value={metaTheme.islandStyle || 'cliffs'}
                        onChange={(e) =>
                          setMetaTheme((t) => ({
                            ...t,
                            islandStyle: e.target.value as IslandShapeStyle,
                          }))
                        }
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                      >
                        <option value="cliffs">Acantilado clásico</option>
                        <option value="terraced">Terrazas escalonadas</option>
                        <option value="floating">Islas flotantes con aura</option>
                      </select>
                    </div>
                    <div className="border border-white/15 bg-white/[0.04] p-3.5">
                      <label className="mb-1.5 block text-xs font-semibold text-[#c7ded2]">
                        Estilo de marcos expositivos
                      </label>
                      <select
                        value={metaTheme.frameStyle || 'archival'}
                        onChange={(e) =>
                          setMetaTheme((t) => ({
                            ...t,
                            frameStyle: e.target.value as FrameStyle,
                          }))
                        }
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                      >
                        <option value="archival">Archivo clásico (turquesa y oro)</option>
                        <option value="ornate">Marco de galería dorado</option>
                        <option value="minimal">Contemporáneo mínimo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Donaciones por enlace directo propio */}
                {canManageDonations && (
                  <div className="border border-[#f1d17c]/35 bg-[#07222d] p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-[#f4d47d]" />
                        <h4 className="font-pixel text-[10px] text-[#f4d47d]">
                          DONACIONES Y APOYO DIRECTO
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#e1f4e9]">
                        <input
                          type="checkbox"
                          checked={donationEnabled}
                          onChange={(e) => setDonationEnabled(e.target.checked)}
                          className="h-4 w-4 accent-[#f4d47d]"
                        />
                        <span>Mostrar botón de donación en este museo</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Plataforma
                        </label>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {['PayPal', 'Ko-fi', 'Mercado Pago', 'Otro'].map((plat) => (
                            <button
                              key={plat}
                              type="button"
                              onClick={() => setDonationPlatform(plat)}
                              className={`border px-2.5 py-1 text-xs ${
                                donationPlatform === plat
                                  ? 'border-[#f4d47d] bg-[#bd7544] font-semibold text-[#fff9e8]'
                                  : 'border-white/20 bg-white/5 text-[#cfe5dc] hover:bg-white/10'
                              }`}
                            >
                              {plat}
                            </button>
                          ))}
                        </div>
                        <input
                          value={donationPlatform}
                          maxLength={40}
                          onChange={(e) => setDonationPlatform(e.target.value)}
                          placeholder="PayPal, Ko-fi, Mercado Pago..."
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Enlace directo (https://...)
                        </label>
                        <input
                          type="url"
                          value={donationUrl}
                          maxLength={1000}
                          onChange={(e) => setDonationUrl(e.target.value)}
                          placeholder="https://paypal.me/tuusuario o https://ko-fi.com/..."
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Nota breve de agradecimiento ({donationNote.length}/200)
                        </label>
                        <textarea
                          rows={2}
                          maxLength={200}
                          value={donationNote}
                          onChange={(e) => setDonationNote(e.target.value)}
                          placeholder="Ej. Tu aporte ayuda a mantener este museo gratuito y financiar nuevas exposiciones."
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    disabled={savingMeta}
                    onClick={handleSaveAppearance}
                    className="border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e] disabled:opacity-60"
                  >
                    {savingMeta ? 'Guardando...' : 'Guardar colores y diseño'}
                  </button>
                </div>
              </div>
            )}

            {view.mode === 'inquiries' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-pixel text-[10px] leading-relaxed text-[#f4d47d]">
                      SOLICITUDES DE COMPRA Y RESERVA
                    </h3>
                    <p className="mt-1 text-sm text-[#a9c7bc]">
                      Solo tú puedes leer los datos de contacto enviados desde tus obras en venta.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={inquiriesLoading}
                    onClick={loadInquiriesList}
                    className="inline-flex items-center gap-1.5 border border-[#6e9a91] bg-[#174653] px-3 py-1.5 text-xs text-[#eff4dd] hover:bg-[#246975] disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${inquiriesLoading ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>

                {inquiriesError && (
                  <p className="border border-[#bd7967] bg-[#603d3d]/60 px-3 py-2 text-xs text-[#ffd5c7]">
                    {inquiriesError}
                  </p>
                )}

                {inquiriesLoading && inquiries.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#a9c7bc]">
                    Cargando solicitudes de compra...
                  </p>
                ) : inquiries.length === 0 ? (
                  <div className="border border-white/15 bg-white/[0.04] p-6 text-center text-sm text-[#b9d6cc]">
                    Aún no hay solicitudes de compra registradas para este museo. Marca tus pinturas u obras como «En venta» desde cada sala para activar el formulario de adquisición.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inquiries.map((inq) => {
                      const isClosed = inq.status === 'closed';
                      const isUpdating = updatingInquiryId === inq.id;
                      return (
                        <article
                          key={inq.id}
                          className="border border-[#e0d7a5]/25 bg-[#07222d] p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                                    inq.status === 'pending'
                                      ? 'border-[#f4d47d] bg-[#6d451f] text-[#fff3c7]'
                                      : inq.status === 'contacted'
                                        ? 'border-[#72c6c1] bg-[#144c58] text-[#e7fbf7]'
                                        : 'border-white/25 bg-white/10 text-[#c7ded2]'
                                  }`}
                                >
                                  {INQUIRY_STATUS_LABELS[inq.status]}
                                </span>
                                <strong className="text-base font-bold text-[#fff9e8]">
                                  {inq.pieceTitle}
                                </strong>
                                <span className="text-xs font-semibold text-[#f4d47d] tabular-nums">
                                  ({inq.priceLabel})
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#a8c8bc] tabular-nums">
                                {new Date(inq.createdAt).toLocaleString('es-MX', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteInquiry(inq)}
                              className="inline-flex items-center gap-1 border border-[#bd7967] bg-[#533b3a] px-2.5 py-1 text-xs text-[#ffd5c7] hover:bg-[#6a4846]"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-2 border-y border-white/10 py-2.5 text-sm sm:grid-cols-3">
                            <div>
                              <span className="block text-[11px] uppercase tracking-wider text-[#8cb5ab]">
                                Solicitante
                              </span>
                              <span className="font-semibold text-[#fff9e8]">{inq.buyerName}</span>
                            </div>
                            <div>
                              <span className="block text-[11px] uppercase tracking-wider text-[#8cb5ab]">
                                Contacto directo
                              </span>
                              <span className="font-semibold text-[#75e4dc] break-all">
                                {inq.buyerContact}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] uppercase tracking-wider text-[#8cb5ab]">
                                Ciudad / Envío
                              </span>
                              <span className="text-[#e1f4e9]">
                                {inq.shippingLocation || 'No especificado'}
                              </span>
                            </div>
                          </div>

                          {inq.message && (
                            <p className="whitespace-pre-line text-sm leading-relaxed text-[#dbece4]">
                              “{inq.message}”
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-xs text-[#9fc4b8]">Estado:</span>
                            {(['pending', 'contacted', 'closed'] as InquiryStatus[]).map((st) => (
                              <button
                                key={st}
                                type="button"
                                disabled={isClosed || isUpdating || inq.status === st}
                                onClick={() => handleUpdateInquiry(inq, st)}
                                className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs transition-colors ${
                                  inq.status === st
                                    ? 'border-[#f4d47d] bg-[#1d6873] font-bold text-[#fff9e8]'
                                    : 'border-white/25 bg-white/5 text-[#d7ebe2] hover:bg-white/15 disabled:opacity-45'
                                }`}
                              >
                                {inq.status === st && <CheckCircle2 className="h-3 w-3" />}
                                <span>{INQUIRY_STATUS_LABELS[st]}</span>
                              </button>
                            ))}
                            {isClosed && (
                              <span className="text-[11px] text-[#9fc4b8]">
                                Solicitud cerrada (bloqueada ante cambios).
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {view.mode === 'new-island' && (
              <div>
                <h3 className="font-pixel mb-4 text-[10px] leading-relaxed text-[#f4d47d]">
                  CREAR NUEVA ISLA EN EL ARCHIPIÉLAGO
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">Nombre de la isla</label>
                    <input
                      value={newIslTitle}
                      onChange={(e) => setNewIslTitle(e.target.value)}
                      placeholder="Ej. Archivo del Viento"
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Rótulo visible en el mapa
                    </label>
                    <input
                      value={newIslLabel}
                      onChange={(e) => setNewIslLabel(e.target.value)}
                      placeholder="Ej. ARCHIVO DEL VIENTO"
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Bioma y arquitectura
                    </label>
                    <select
                      value={newIslBiome}
                      onChange={(e) => setNewIslBiome(e.target.value as IslandBiome)}
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    >
                      {Object.entries(BIOME_LABELS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">Rótulo superior</label>
                    <input
                      value={newIslEyebrow}
                      onChange={(e) => setNewIslEyebrow(e.target.value)}
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">Descripción</label>
                    <textarea
                      rows={3}
                      value={newIslDesc}
                      onChange={(e) => setNewIslDesc(e.target.value)}
                      placeholder="Describe qué habita en este nuevo territorio..."
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Posición horizontal en mapa ({newIslX}%)
                    </label>
                    <input
                      type="range"
                      min={12}
                      max={88}
                      value={newIslX}
                      onChange={(e) => setNewIslX(Number(e.target.value))}
                      className="w-full accent-[#e1c875]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Posición vertical en mapa ({newIslY}%)
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={85}
                      value={newIslY}
                      onChange={(e) => setNewIslY(Number(e.target.value))}
                      className="w-full accent-[#e1c875]"
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#a9c7bc]">
                  {BIOME_LABELS[newIslBiome].desc}. Se conectará automáticamente mediante un puente al Patio central y contará con una sala inicial lista para explorar en 2D.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateNewIsland}
                    className="border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                  >
                    Crear isla en el mapa
                  </button>
                  <button
                    type="button"
                    onClick={() => visibleIslands[0] && selectIsland(visibleIslands[0].id)}
                    className="border border-[#d8c47b]/60 bg-[#062230] px-4 py-2 text-sm text-[#fff5d7]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {view.mode === 'island' && activeIsland && (
              <div>
                {esInvitado ? (
                  <div className="mb-5 border-2 border-[#7fd6cc]/60 bg-[#07222d] p-4">
                    <p className="font-pixel flex items-center gap-2 text-[9px] text-[#7fd6cc]">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>ISLA PRESTADA · MODO INVITADO</span>
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#fff9e8]">{activeIsland.title}</h3>
                    <p className="mt-1 text-sm text-[#c4ded2]">
                      El anfitrión te prestó esta isla para mostrar tu obra. Abre cualquier sala de abajo para cargar, editar o eliminar tus piezas. La arquitectura, colores y el resto del museo están protegidos en solo lectura.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-pixel text-[10px] leading-relaxed text-[#f4d47d]">
                        CONFIGURAR ISLA
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleDeleteIsland(activeIsland.id)}
                        className="inline-flex items-center gap-1.5 border border-[#bd7967] bg-[#603d3d] px-3 py-1.5 text-xs text-[#ffd5c7] hover:bg-[#7b4949]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {activeIsland.isOriginal ? 'Quitar del mapa' : 'Eliminar isla'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Nombre visible en el mapa
                        </label>
                        <input
                          value={islLabel}
                          onChange={(e) => setIslLabel(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">Nombre de la isla</label>
                        <input
                          value={islTitle}
                          onChange={(e) => setIslTitle(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">Bioma visual</label>
                        <select
                          value={islBiome}
                          onChange={(e) => setIslBiome(e.target.value as IslandBiome)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        >
                          {Object.entries(BIOME_LABELS).map(([key, val]) => (
                            <option key={key} value={key}>
                              {val.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">Rótulo superior</label>
                        <input
                          value={islEyebrow}
                          onChange={(e) => setIslEyebrow(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Descripción de la isla
                        </label>
                        <textarea
                          rows={3}
                          value={islDesc}
                          onChange={(e) => setIslDesc(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Posición X ({islX}%)
                        </label>
                        <input
                          type="range"
                          min={10}
                          max={90}
                          step={0.5}
                          value={islX}
                          onChange={(e) => setIslX(Number(e.target.value))}
                          className="w-full accent-[#e1c875]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Posición Y ({islY}%)
                        </label>
                        <input
                          type="range"
                          min={18}
                          max={86}
                          step={0.5}
                          value={islY}
                          onChange={(e) => setIslY(Number(e.target.value))}
                          className="w-full accent-[#e1c875]"
                        />
                      </div>
                    </div>

                    {source.kind === 'local' && (
                      <div className="mt-4 border border-[#7fd6cc]/35 bg-[#07222d] p-4 space-y-3">
                        <label className="flex items-center gap-2.5 text-sm font-semibold text-[#e1f4e9]">
                          <input
                            type="checkbox"
                            checked={localLoanEnabled}
                            onChange={(e) => setLocalLoanEnabled(e.target.checked)}
                            className="h-4 w-4 accent-[#7fd6cc]"
                          />
                          <span>Marcar como Isla Prestada (niebla liminal + enlace al museo origen)</span>
                        </label>
                        {localLoanEnabled && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs text-[#c7ded2]">
                                Nombre del museo de origen *
                              </label>
                              <input
                                value={localLoanMuseumTitle}
                                onChange={(e) => setLocalLoanMuseumTitle(e.target.value)}
                                placeholder="Ej. Archivo Sonoro Sur"
                                className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-1.5 text-sm text-[#183b42]"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[#c7ded2]">
                                Creador / invitado
                              </label>
                              <input
                                value={localLoanAuthor}
                                onChange={(e) => setLocalLoanAuthor(e.target.value)}
                                placeholder="Ej. Lucía M."
                                className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-1.5 text-sm text-[#183b42]"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[#c7ded2]">
                                Enlace del museo origen
                              </label>
                              <input
                                value={localLoanUrl}
                                onChange={(e) => setLocalLoanUrl(e.target.value)}
                                placeholder="?museum=... o https://..."
                                className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-1.5 text-sm text-[#183b42]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleSaveIsland}
                        className="border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                      >
                        Guardar cambios de isla
                      </button>
                    </div>

                    {/* Sección Anfitrión en la Nube: Prestar esta isla (invitación mágica) */}
                    {isCloud && (
                      <div className="mt-6 border border-[#7fd6cc]/40 bg-[#07222d] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="font-pixel flex items-center gap-2 text-[10px] text-[#7fd6cc]">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>PRESTAR ESTA ISLA (ISLA PRESTADA)</span>
                            </h4>
                            <p className="mt-1 text-xs text-[#b9d6cc]">
                              Genera un enlace mágico para invitar a otro creador a montar su exposición aquí, con niebla liminal y enlace permanente a su museo origen.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={creatingInvite || !source.authUser}
                            onClick={async () => {
                              if (!source.authUser) {
                                setNotice('Inicia sesión para generar invitaciones.');
                                return;
                              }
                              setCreatingInvite(true);
                              try {
                                const created = await createIslandInvite({
                                  museum: source.museum,
                                  island: activeIsland,
                                  hostUser: source.authUser,
                                });
                                setIslandInvites((prev) => [created, ...prev]);
                                setNotice(`Invitación mágica generada para «${activeIsland.title}».`);
                              } catch (err) {
                                setNotice(
                                  err instanceof Error ? err.message : 'No se pudo generar la invitación.'
                                );
                              } finally {
                                setCreatingInvite(false);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 border border-[#f2d17b] bg-[#1d6873] px-3 py-2 text-xs font-bold text-[#fff9e8] hover:bg-[#b25f37] disabled:opacity-55"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-[#f4d47d]" />
                            <span>{creatingInvite ? 'Generando...' : 'Generar invitación mágica'}</span>
                          </button>
                        </div>

                        {loadingInvites ? (
                          <p className="text-xs text-[#9fc4b8]">Consultando invitaciones...</p>
                        ) : (
                          (() => {
                            const forThisIsland = islandInvites.filter(
                              (inv) => inv.islandId === activeIsland.id
                            );
                            const hasActiveLoan = forThisIsland.some((i) => i.status === 'accepted');
                            const pendingCount = forThisIsland.filter((i) => i.status === 'pending').length;

                            if (forThisIsland.length === 0) {
                              return (
                                <p className="text-xs text-[#9fc4b8]">
                                  Aún no hay invitaciones generadas para esta isla.
                                </p>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                {hasActiveLoan && (
                                  <div className="flex items-center gap-2 border border-[#f4d47d]/60 bg-[#422d14]/80 px-3 py-2 text-xs text-[#ffebb3]">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#f4d47d]" />
                                    <span>
                                      <strong>Cupo completo:</strong> Esta isla ya tiene un préstamo activo. Nuevas invitaciones no podrán ser aceptadas simultáneamente hasta revocar el préstamo actual.
                                    </span>
                                  </div>
                                )}
                                {!hasActiveLoan && pendingCount > 1 && (
                                  <div className="flex items-center gap-2 border border-[#7fd6cc]/40 bg-[#0b333c]/70 px-3 py-2 text-xs text-[#d2f3eb]">
                                    <Clock className="h-4 w-4 shrink-0 text-[#7fd6cc]" />
                                    <span>
                                      Hay {pendingCount} invitaciones pendientes. La primera persona que la acepte ocupará la isla (límite de 1 creador invitado por isla).
                                    </span>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  {forThisIsland.map((inv) => {
                                    const magicUrl = `${window.location.origin}${window.location.pathname}?museum=${encodeURIComponent(source.museum.id)}&invite=${encodeURIComponent(inv.id)}`;
                                    const evalExp = evaluateInviteExpiration(inv);
                                    const readableCreatedAt = formatReadableDate(inv.createdAt);
                                    const elapsed = formatElapsedTime(inv.createdAt);

                                    return (
                                      <div
                                        key={inv.id}
                                        className="space-y-2 border border-white/15 bg-white/[0.04] p-3 text-xs"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span
                                                className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                  inv.status === 'pending'
                                                    ? 'border-[#f4d47d] bg-[#6d451f] text-[#fff3c7]'
                                                    : inv.status === 'accepted'
                                                      ? 'border-[#7fd6cc] bg-[#144c58] text-[#e7fbf7]'
                                                      : 'border-[#bd7967] bg-[#533b3a] text-[#ffd5c7]'
                                                }`}
                                              >
                                                {inv.status === 'pending'
                                                  ? 'Pendiente'
                                                  : inv.status === 'accepted'
                                                    ? 'Prestada'
                                                    : 'Revocada'}
                                              </span>
                                              <code className="bg-black/30 px-1.5 py-0.5 text-[#f4d47d]">
                                                {inv.id}
                                              </code>
                                              {inv.status === 'accepted' && (
                                                <span className="text-[#e1f4e9]">
                                                  → <strong>{inv.guestName}</strong> ({inv.sourceMuseumTitle})
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {inv.status === 'pending' && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    try {
                                                      await navigator.clipboard?.writeText(magicUrl);
                                                      setNotice('Enlace mágico copiado al portapapeles.');
                                                    } catch {
                                                      setNotice(`Enlace: ${magicUrl}`);
                                                    }
                                                  }}
                                                  className="inline-flex items-center gap-1 border border-[#7fd6cc]/60 bg-[#0d3a46] px-2.5 py-1 text-xs text-[#e7fbf7] hover:bg-[#175b6e]"
                                                >
                                                  <Copy className="h-3 w-3" />
                                                  <span>Copiar enlace</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    try {
                                                      await navigator.clipboard?.writeText(inv.id);
                                                      setNotice(`Código corto ${inv.id} copiado al portapapeles.`);
                                                    } catch {
                                                      setNotice(`Código: ${inv.id}`);
                                                    }
                                                  }}
                                                  className="inline-flex items-center gap-1 border border-[#f4d47d]/60 bg-[#422d14] px-2 py-1 text-xs text-[#ffebb3] hover:bg-[#5a3f1d]"
                                                >
                                                  <KeyRound className="h-3 w-3" />
                                                  <span>Copiar código</span>
                                                </button>
                                              </>
                                            )}
                                            {inv.status !== 'revoked' && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  try {
                                                    await revokeIslandInvite(inv.id);
                                                    setIslandInvites((prev) =>
                                                      prev.map((it) =>
                                                        it.id === inv.id ? { ...it, status: 'revoked' } : it
                                                      )
                                                    );
                                                    setNotice('Préstamo revocado.');
                                                  } catch (err) {
                                                    setNotice(
                                                      err instanceof Error
                                                        ? err.message
                                                        : 'No se pudo revocar.'
                                                    );
                                                  }
                                                }}
                                                className="border border-[#d8c47b]/50 bg-[#062230] px-2.5 py-1 text-xs text-[#f4d47d] hover:bg-[#4b3527]"
                                              >
                                                Revocar
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  await deleteIslandInvite(inv.id);
                                                  setIslandInvites((prev) =>
                                                    prev.filter((it) => it.id !== inv.id)
                                                  );
                                                  setNotice('Invitación eliminada.');
                                                } catch (err) {
                                                  setNotice(
                                                    err instanceof Error
                                                      ? err.message
                                                      : 'No se pudo eliminar.'
                                                  );
                                                }
                                              }}
                                              className="border border-[#bd7967] bg-[#533b3a] px-2 py-1 text-xs text-[#ffd5c7] hover:bg-[#6a4846]"
                                            >
                                              Eliminar
                                            </button>
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#9fc4b8] border-t border-white/10 pt-2">
                                          <span className="inline-flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-[#d8c47b]" />
                                            <span>Creada: {readableCreatedAt} {elapsed && `(${elapsed})`}</span>
                                          </span>
                                          {inv.status === 'pending' && (
                                            <>
                                              {evalExp.enforcedExpirationStr ? (
                                                <span className={`inline-flex items-center gap-1 ${evalExp.isEnforcedExpired ? 'text-[#ffb4a2]' : 'text-[#c4ded2]'}`}>
                                                  <Clock className="h-3 w-3" />
                                                  <span>
                                                    {evalExp.isEnforcedExpired ? 'Expirada:' : 'Vence:'} {evalExp.enforcedExpirationStr}
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[#c4ded2]">
                                                  <Clock className="h-3 w-3" />
                                                  <span>
                                                    Fecha sugerida de revisión: {evalExp.suggestedReview.suggestedDateStr}
                                                    {evalExp.suggestedReview.isPastSuggestedWindow
                                                      ? ' (revisión sugerida cumplida)'
                                                      : ` (${evalExp.suggestedReview.daysRemaining}d restantes)`}
                                                  </span>
                                                </span>
                                              )}
                                            </>
                                          )}
                                          {inv.status === 'accepted' && (
                                            <span className="inline-flex items-center gap-1 text-[#8ae6dc]">
                                              <CheckCircle2 className="h-3 w-3" />
                                              <span>Ocupada actualmente por {inv.guestName}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}

                    <hr className="my-6 border-[#f3d889]/20" />
                  </>
                )}

                <h3 className="font-pixel mb-2 text-[10px] leading-relaxed text-[#f4d47d]">
                  SALAS DE ESTA ISLA
                </h3>
                <p className="mb-3 text-sm text-[#a9c7bc]">
                  Cada sala se recorre en modo 2D y reúne su propia colección de piezas.
                </p>

                <div className="space-y-2">
                  {getRooms(activeIsland.id).map((room) => (
                    <div
                      key={room.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-[#e0d7a5]/20 bg-white/[0.045] px-4 py-3"
                    >
                      <div>
                        <strong className="block text-base font-semibold text-[#fff9e8]">
                          {room.name}
                        </strong>
                        <small className="text-xs text-[#a8c8bc] tabular-nums">
                          {getPieces(activeIsland.id, room.id).length} piezas
                        </small>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openRoom(activeIsland.id, room.id)}
                          className="border border-[#6e9a91] bg-[#174653] px-3 py-1.5 text-xs text-[#eff4dd] hover:bg-[#246975]"
                        >
                          Abrir sala
                        </button>
                        {!esInvitado && getRooms(activeIsland.id).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(activeIsland.id, room.id)}
                            className="border border-[#a66e61] bg-[#533b3a] px-3 py-1.5 text-xs text-[#ffd5c7] hover:bg-[#6a4846]"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!esInvitado && (
                  showNewRoomForm ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border border-[#e1c875]/40 bg-[#062230] p-3">
                      <input
                        value={creatingRoomName}
                        onChange={(e) => setCreatingRoomName(e.target.value)}
                        placeholder="Nombre de la nueva sala..."
                        className="min-w-[220px] flex-1 border border-[#537c79] bg-[#f0eedc] px-3 py-1.5 text-sm text-[#183b42]"
                      />
                      <button
                        type="button"
                        onClick={handleCreateRoom}
                        className="border border-[#f2d17b] bg-[#bd7544] px-3 py-1.5 text-xs font-semibold text-[#fff9e8]"
                      >
                        Crear sala
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewRoomForm(false)}
                        className="border border-white/30 bg-transparent px-3 py-1.5 text-xs text-[#d0e6da]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewRoomForm(true)}
                      className="mt-4 inline-flex items-center gap-1.5 border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                    >
                      <Plus className="h-4 w-4" />
                      Crear sala
                    </button>
                  )
                )}
              </div>
            )}

            {view.mode === 'room' && (
              <div>
                <button
                  type="button"
                  onClick={() => selectIsland(view.islandId)}
                  className="inline-flex items-center gap-1.5 border border-[#d8c47b]/60 bg-[#062230] px-3 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver a la isla
                </button>

                {esInvitado ? (
                  <div className="mt-4 border border-[#7fd6cc]/40 bg-[#07222d] p-4">
                    <p className="font-pixel text-[9px] text-[#7fd6cc]">SALA DE EXHIBICIÓN</p>
                    <h3 className="mt-1 text-xl font-bold text-[#fff9e8]">{roomName}</h3>
                    {roomDesc && <p className="mt-1 text-sm text-[#c4ded2]">{roomDesc}</p>}
                  </div>
                ) : (
                  <>
                    <h3 className="font-pixel mt-5 mb-3 text-[10px] text-[#f4d47d]">EDITAR SALA</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">Nombre de la sala</label>
                        <input
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Descripción de la sala
                        </label>
                        <textarea
                          rows={3}
                          value={roomDesc}
                          onChange={(e) => setRoomDesc(e.target.value)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveRoom}
                        className="border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                      >
                        Guardar sala
                      </button>
                    </div>
                  </>
                )}

                <hr className="my-6 border-[#f3d889]/20" />

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-pixel text-[10px] text-[#f4d47d]">PIEZAS DE ESTA SALA</h3>
                  <button
                    type="button"
                    onClick={() => openPieceForm(view.islandId, view.roomId, null)}
                    className="inline-flex items-center gap-1.5 border border-[#f2d17b] bg-[#bd7544] px-3 py-1.5 text-xs font-semibold text-[#fff9e8] hover:bg-[#a24d2e]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Cargar pieza
                  </button>
                </div>

                <div className="space-y-2">
                  {getPieces(view.islandId, view.roomId).map((item) => {
                    const canModifyPiece =
                      !esInvitado || Boolean(guestAccess && item.loanInviteId === guestAccess.inviteId);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-[#e0d7a5]/20 bg-white/[0.045] px-4 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="truncate text-base font-semibold text-[#fff9e8]">
                              {item.title}
                            </strong>
                            {item.loanInviteId && (
                              <span className="inline-flex items-center gap-1 border border-[#7fd6cc]/60 bg-[#0d3a46] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#b7f2eb]">
                                <Link2 className="h-2.5 w-2.5" />
                                Invitado
                              </span>
                            )}
                            {item.saleStatus && item.saleStatus !== 'not_for_sale' && (
                              <span
                                className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums ${
                                  item.saleStatus === 'for_sale'
                                    ? 'border-[#72c6c1] bg-[#174653] text-[#e7fbf7]'
                                    : item.saleStatus === 'reserved'
                                      ? 'border-[#f4d47d] bg-[#6d451f] text-[#fff3c7]'
                                      : 'border-white/30 bg-white/10 text-[#d0e6da]'
                                }`}
                              >
                                {item.saleStatus === 'for_sale'
                                  ? item.priceLabel
                                    ? `EN VENTA · ${item.priceLabel}`
                                    : 'EN VENTA'
                                  : item.saleStatus === 'reserved'
                                    ? 'RESERVADA'
                                    : 'VENDIDA'}
                              </span>
                            )}
                          </div>
                          <small className="block truncate text-xs text-[#a8c8bc]">
                            {item.subtitle || item.kind}
                            {item.curatedFrom
                              ? ` · de «${item.curatedFrom.sourceMuseumTitle}»`
                              : isCloud
                                ? ' · en la nube'
                                : item.custom
                                  ? ' · añadida por ti'
                                  : ' · colección original'}
                          </small>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {canModifyPiece ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openPieceForm(view.islandId, view.roomId, item.id)}
                                className="border border-[#6e9a91] bg-[#174653] px-3 py-1.5 text-xs text-[#eff4dd] hover:bg-[#246975]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePiece(view.islandId, view.roomId, item)}
                                className="border border-[#bd7967] bg-[#533b3a] px-3 py-1.5 text-xs text-[#ffd5c7] hover:bg-[#6a4846]"
                              >
                                {isCloud || item.custom ? 'Eliminar' : 'Ocultar'}
                              </button>
                            </>
                          ) : (
                            <span className="border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-[#9fc4b8]">
                              Del anfitrión
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {source.kind === 'local' &&
                  getBasePiecesForIsland(view.islandId).some(
                    (p) => p.roomId === view.roomId && source.state.hidden.includes(p.id)
                  ) && (
                    <button
                      type="button"
                      onClick={() => handleRestoreRoomHiddenPieces(view.islandId, view.roomId)}
                      className="mt-4 inline-flex items-center gap-1.5 border border-[#d8c47b]/60 bg-[#062230] px-3 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar piezas originales ocultas
                    </button>
                  )}
              </div>
            )}

            {view.mode === 'piece' && (
              <div>
                <button
                  type="button"
                  onClick={() => openRoom(view.islandId, view.roomId)}
                  className="inline-flex items-center gap-1.5 border border-[#d8c47b]/60 bg-[#062230] px-3 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver a piezas
                </button>

                <h3 className="font-pixel mt-5 mb-4 text-[10px] text-[#f4d47d]">
                  {view.pieceId ? 'EDITAR PIEZA' : 'NUEVA PIEZA'}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">Título</label>
                    <input
                      value={pieceTitle}
                      onChange={(e) => setPieceTitle(e.target.value)}
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Subtítulo, precio o categoría
                    </label>
                    <input
                      value={pieceSubtitle}
                      onChange={(e) => setPieceSubtitle(e.target.value)}
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">Tipo de contenido</label>
                    <select
                      value={pieceType}
                      onChange={(e) => setPieceType(e.target.value as PieceType)}
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    >
                      <option value="text">Texto / poema / plato de menú</option>
                      <option value="image">Imagen / fotografía / portada</option>
                      <option value="audio">Audio / pista musical</option>
                      <option value="video">Vídeo</option>
                      <option value="link">Enlace web / playlist</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      {isCloud ? 'Subir imagen (se optimiza automáticamente)' : 'Archivo multimedia (opcional)'}
                    </label>
                    <input
                      type="file"
                      accept={
                        isCloud
                          ? 'image/*'
                          : pieceType === 'audio'
                            ? 'audio/*'
                            : pieceType === 'video'
                              ? 'video/*'
                              : 'image/*,audio/*,video/*'
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPieceFile(file);
                        if (file) {
                          setPieceClearMedia(false);
                        }
                      }}
                      className="w-full border border-[#537c79] bg-[#e5e3cf] p-2 text-xs text-[#183b42]"
                    />
                  </div>

                  {(piecePreviewSrc || pieceFile) && (
                    <div className="sm:col-span-2 border border-[#7fd6cc]/40 bg-[#07222d] p-3.5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#b7f2eb]">
                          Vista previa · {piecePreviewLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPieceFile(null);
                            setPieceClearMedia(true);
                          }}
                          className="inline-flex min-h-[34px] items-center gap-1 border border-[#bd7967] bg-[#533b3a] px-2.5 py-1 text-xs text-[#ffd5c7] hover:bg-[#6a4846]"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Quitar archivo</span>
                        </button>
                      </div>
                      {piecePreviewSrc && piecePreviewKind === 'image' && (
                        <img
                          src={piecePreviewSrc}
                          alt={pieceTitle || 'Vista previa de obra'}
                          className="max-h-52 w-auto border border-[#e1c875]/50 object-contain bg-[#041821]"
                        />
                      )}
                      {piecePreviewSrc && piecePreviewKind === 'audio' && (
                        <audio controls src={piecePreviewSrc} className="w-full" />
                      )}
                      {piecePreviewSrc && piecePreviewKind === 'video' && (
                        <video
                          controls
                          src={piecePreviewSrc}
                          className="max-h-56 w-full border border-[#e1c875]/40 bg-black"
                        />
                      )}
                    </div>
                  )}

                  {(pieceType === 'link' || pieceType === 'audio' || pieceType === 'video') && (
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs text-[#c7ded2]">
                        {pieceType === 'link'
                          ? 'Dirección web (URL)'
                          : 'URL del archivo o enlace (Spotify, Bandcamp, MP3, MP4...)'}
                      </label>
                      <input
                        type="url"
                        value={pieceUrl}
                        onChange={(e) => setPieceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs text-[#c7ded2]">
                      Texto, reseña o descripción
                    </label>
                    <textarea
                      rows={5}
                      value={pieceBody}
                      onChange={(e) => setPieceBody(e.target.value)}
                      placeholder="Escribe o pega aquí el contenido de la pieza..."
                      className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-[#183b42]"
                    />
                  </div>

                  {/* Venta de obra / Disponibilidad */}
                  <div className="sm:col-span-2 border border-[#f1d17c]/30 bg-[#07222d] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-[#f4d47d]" />
                      <h4 className="font-pixel text-[10px] text-[#f4d47d]">
                        VENTA DE OBRA / DISPONIBILIDAD
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Estado comercial
                        </label>
                        <select
                          value={pieceSaleStatus}
                          onChange={(e) => setPieceSaleStatus(e.target.value as SaleStatus)}
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        >
                          {(Object.entries(SALE_STATUS_LABELS) as [SaleStatus, string][]).map(
                            ([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Precio visible (máx. 40 caracteres)
                        </label>
                        <input
                          value={piecePriceLabel}
                          maxLength={40}
                          onChange={(e) => setPiecePriceLabel(e.target.value)}
                          placeholder="Ej. $3,200 MXN o $180 USD"
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Técnica, formato o medidas
                        </label>
                        <input
                          value={pieceMediumOrSize}
                          maxLength={120}
                          onChange={(e) => setPieceMediumOrSize(e.target.value)}
                          placeholder="Ej. Óleo sobre tela · 80 × 100 cm"
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#c7ded2]">
                          Enlace de pago directo (opcional, https://...)
                        </label>
                        <input
                          type="url"
                          value={piecePaymentUrl}
                          maxLength={1000}
                          onChange={(e) => setPiecePaymentUrl(e.target.value)}
                          placeholder="https://mpago.la/... o PayPal / Stripe"
                          className="w-full border border-[#537c79] bg-[#f0eedc] px-3 py-2 text-sm text-[#183b42]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingPiece}
                    onClick={handleSavePiece}
                    className="border border-[#f2d17b] bg-[#bd7544] px-4 py-2 text-sm font-semibold text-[#fff9e8] hover:bg-[#a24d2e] disabled:opacity-60"
                  >
                    {savingPiece ? 'Guardando...' : 'Guardar pieza'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openRoom(view.islandId, view.roomId)}
                    className="border border-[#d8c47b]/60 bg-[#062230] px-4 py-2 text-sm text-[#fff5d7]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f3d889]/20 px-5 py-2.5 text-xs text-[#99b9af]">
          <span>{notice}</span>
          <span>
            {esInvitado
              ? 'Modo Invitado · Tus cambios se guardan solo en esta isla prestada.'
              : isCloud
                ? 'Sincronizado en Firestore con atribución entre museos.'
                : 'Las copias de seguridad incluyen islas, salas, textos, archivos multimedia e islasPrestadas.'}
          </span>
        </footer>

        {/* Diálogo de confirmación interno (sin window.confirm) */}
        {confirmState && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md border-[3px] border-[#e1c875] bg-[#0b2b39] p-6 shadow-2xl">
              <h4 className="font-pixel text-[10px] leading-relaxed text-[#f4d47d]">
                CONFIRMAR ACCIÓN
              </h4>
              <p className="mt-3 text-base leading-relaxed text-[#f8f4df]">
                {confirmState.message}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  className="border border-[#d8c47b]/60 bg-[#062230] px-3.5 py-2 text-xs text-[#fff5d7]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmState.onConfirm;
                    setConfirmState(null);
                    await action();
                  }}
                  className="border border-[#bd7967] bg-[#603d3d] px-3.5 py-2 text-xs font-semibold text-[#ffd5c7] hover:bg-[#7b4949]"
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
