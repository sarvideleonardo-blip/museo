import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  BookOpen,
  Box,
  Compass,
  Heart,
  HelpCircle,
  LogIn,
  LogOut,
  Map as MapIcon,
  Pencil,
  Plus,
  Sparkles,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AboutGuideModal } from './components/AboutGuideModal';
import { Archipelago3D } from './components/Archipelago3D';
import { ArchipelagoMap } from './components/ArchipelagoMap';
import { CharacterSelectorModal } from './components/CharacterSelectorModal';
import { ContentModal, ModalPayload } from './components/ContentModal';
import { CreateMuseumModal } from './components/CreateMuseumModal';
import { GuestbookModal } from './components/GuestbookModal';
import { IslandDrawer } from './components/IslandDrawer';
import { LoanInviteModal } from './components/LoanInviteModal';
import { MuseumDirectoryModal } from './components/MuseumDirectoryModal';
import { EditorSource, MuseumEditor } from './components/MuseumEditor';
import { RoomExplorer2D } from './components/RoomExplorer2D';
import { SharePieceModal } from './components/SharePieceModal';
import { SupportProjectModal } from './components/SupportProjectModal';
import { getCharacterProfile } from './data/characters';
import { FOUNTAIN_QUOTES } from './data/initialContent';
import { CATEGORY_META, DEFAULT_MUSEUM_THEME } from './data/themes';
import { auth } from './firebase/client';
import {
  fetchAcceptedLoansForMuseum,
  fetchFlagshipCloudConfig,
  inviteToLoanedMeta,
  isFlagshipAdminUser,
  saveFlagshipCloudConfig,
} from './firebase/interactions';
import {
  fetchMuseumById,
  fetchMuseumPieces,
  fetchMyMuseums,
  fetchPublicMuseums,
  loadUserCharacterPreference,
  signInWithGoogle,
  signOutCreator,
  syncUserPrivateProfile,
} from './firebase/museumNetwork';
import { retroAudio } from './game/audio';
import {
  getPiecesCountForIsland,
  getPiecesForRoom,
  getResolvedIslands,
  getRoomsForIsland,
  loadMuseumState,
  saveMuseumState,
} from './storage/museumStore';
import {
  CharacterId,
  CloudMuseum,
  FlagshipConfig,
  Island,
  IslandInvite,
  MuseumPiece,
  MuseumState,
  MuseumThemeConfig,
  Room,
} from './types/museum';
import { sortPiecesForRoom } from './utils/pieceOrdering';

type ActiveMuseum =
  | { kind: 'flagship' }
  | { kind: 'cloud'; museum: CloudMuseum; pieces: MuseumPiece[] };

const CHAR_STORAGE_KEY = 'museo404_character_id';
const CHAR_PICKED_KEY = 'museo404_character_picked';
const FLAGSHIP_THEME_KEY = 'museo404_flagship_theme_v1';
const FLAGSHIP_CONFIG_KEY = 'museo404_flagship_config_v1';

function loadInitialCharacter(): CharacterId {
  try {
    const saved = localStorage.getItem(CHAR_STORAGE_KEY);
    if (
      saved &&
      ['explorador', 'melomano', 'chef', 'astronomo', 'robot404'].includes(saved)
    ) {
      return saved as CharacterId;
    }
  } catch {
    // ignorar
  }
  return 'explorador';
}

function loadInitialFlagshipTheme(): MuseumThemeConfig {
  try {
    const raw = localStorage.getItem(FLAGSHIP_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.skyColor === 'string') {
        return { ...DEFAULT_MUSEUM_THEME, ...parsed };
      }
    }
  } catch {
    // ignorar
  }
  return DEFAULT_MUSEUM_THEME;
}

function loadInitialFlagshipConfig(): FlagshipConfig {
  try {
    const rawCfg = localStorage.getItem(FLAGSHIP_CONFIG_KEY);
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg) as Partial<FlagshipConfig>;
      if (parsed && parsed.theme && typeof parsed.theme.skyColor === 'string') {
        return {
          ...parsed,
          theme: { ...DEFAULT_MUSEUM_THEME, ...parsed.theme },
        };
      }
    }
  } catch {
    // ignorar
  }
  return { theme: loadInitialFlagshipTheme() };
}

export default function App() {
  const [museumState, setMuseumState] = useState<MuseumState>(() => loadMuseumState());
  const [flagshipConfig, setFlagshipConfig] = useState<FlagshipConfig>(() =>
    loadInitialFlagshipConfig()
  );
  const flagshipTheme = flagshipConfig.theme;

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [publicMuseums, setPublicMuseums] = useState<CloudMuseum[]>([]);
  const [myMuseums, setMyMuseums] = useState<CloudMuseum[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [activeMuseum, setActiveMuseum] = useState<ActiveMuseum>({ kind: 'flagship' });
  const [activeMuseumLoans, setActiveMuseumLoans] = useState<IslandInvite[]>([]);
  const [cloudDiscoveredIds, setCloudDiscoveredIds] = useState<string[]>([]);
  const [characterId, setCharacterId] = useState<CharacterId>(() => loadInitialCharacter());

  const [worldView, setWorldView] = useState<'3d' | 'map'>('3d');
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [mode2D, setMode2D] = useState<{ islandId: string; roomId: string } | null>(null);

  const [editorSource, setEditorSource] = useState<EditorSource | null>(null);
  const [editorInitialViewMode, setEditorInitialViewMode] = useState<
    'appearance' | 'inquiries' | undefined
  >(undefined);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [createMuseumOpen, setCreateMuseumOpen] = useState(false);
  const [characterModalOpen, setCharacterModalOpen] = useState(false);
  const [shareTargetPiece, setShareTargetPiece] = useState<MuseumPiece | null>(null);
  const [modalPayload, setModalPayload] = useState<ModalPayload | null>(null);
  const [guestbookContext, setGuestbookContext] = useState<{
    islandId: string;
    roomId: string;
    scopeLabel: string;
  } | null>(null);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [initialInviteId, setInitialInviteId] = useState<string | null>(null);
  const deepLinkHandledRef = useRef(false);

  const [bgmActive, setBgmActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);

  const showToast = useCallback(
    (msg: string, action?: { label: string; onClick: () => void }) => {
      setToastMessage(msg);
      setToastAction(action || null);
    },
    []
  );

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => {
      setToastMessage(null);
      setToastAction(null);
    }, 5200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const updateState = useCallback((next: MuseumState) => {
    setMuseumState(next);
    saveMuseumState(next);
  }, []);

  const persistLocalFlagshipConfig = useCallback((next: FlagshipConfig) => {
    setFlagshipConfig(next);
    try {
      localStorage.setItem(FLAGSHIP_CONFIG_KEY, JSON.stringify(next));
      localStorage.setItem(FLAGSHIP_THEME_KEY, JSON.stringify(next.theme));
    } catch {
      // ignorar
    }
  }, []);

  const updateFlagshipTheme = useCallback(
    (nextTheme: MuseumThemeConfig) => {
      persistLocalFlagshipConfig({ ...flagshipConfig, theme: nextTheme });
    },
    [flagshipConfig, persistLocalFlagshipConfig]
  );

  const handleSaveFlagshipConfig = useCallback(
    async (next: FlagshipConfig) => {
      const saved = await saveFlagshipCloudConfig(next);
      persistLocalFlagshipConfig(saved);
      setEditorSource((prev) =>
        prev && prev.kind === 'local'
          ? { ...prev, theme: saved.theme, flagshipConfig: saved }
          : prev
      );
    },
    [persistLocalFlagshipConfig]
  );

  const refreshDirectory = useCallback(async (userOverride?: User | null) => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const pub = await fetchPublicMuseums();
      setPublicMuseums(pub);
      const currentUser = userOverride !== undefined ? userOverride : auth.currentUser;
      if (currentUser) {
        const mine = await fetchMyMuseums(currentUser.uid);
        setMyMuseums(mine);
      } else {
        setMyMuseums([]);
      }
    } catch (err) {
      setDirectoryError(
        err instanceof Error ? err.message : 'No se pudo cargar la red de museos.'
      );
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDirectory(null);
    fetchFlagshipCloudConfig().then((remote) => {
      if (remote) {
        persistLocalFlagshipConfig(remote);
      }
    });
  }, [refreshDirectory, persistLocalFlagshipConfig]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const [mine, savedChar] = await Promise.all([
            fetchMyMuseums(user.uid),
            loadUserCharacterPreference(user.uid),
          ]);
          setMyMuseums(mine);
          if (savedChar) {
            setCharacterId(savedChar);
            try {
              localStorage.setItem(CHAR_STORAGE_KEY, savedChar);
              localStorage.setItem(CHAR_PICKED_KEY, '1');
            } catch {
              // ignorar
            }
          } else {
            await syncUserPrivateProfile(user, characterId);
          }
        } catch {
          // Errores capturados internamente o ignorables en arranque
        }
      } else {
        setMyMuseums([]);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      const user = await signInWithGoogle();
      showToast(`Bienvenido, ${user.displayName || 'Creador'}.`);
      refreshDirectory(user);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    }
  }, [refreshDirectory, showToast]);

  const handleSelectCharacter = useCallback(
    async (id: CharacterId) => {
      setCharacterId(id);
      try {
        localStorage.setItem(CHAR_STORAGE_KEY, id);
        localStorage.setItem(CHAR_PICKED_KEY, '1');
      } catch {
        // ignorar
      }
      if (authUser) {
        try {
          await syncUserPrivateProfile(authUser, id);
        } catch {
          // silenciar si falló sync puntual
        }
      }
    },
    [authUser]
  );

  const openFlagshipMuseum = useCallback(() => {
    setActiveMuseum({ kind: 'flagship' });
    setActiveMuseumLoans([]);
    setSelectedIslandId(null);
    setSelectedRoomId(null);
    setMode2D(null);
    setDirectoryOpen(false);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('museum');
      window.history.replaceState(null, '', u.toString());
    } catch {
      // ignorar
    }
  }, []);

  const openCloudMuseum = useCallback(
    async (museum: CloudMuseum) => {
      try {
        const [pieces, loans] = await Promise.all([
          fetchMuseumPieces(museum.id, museum.ownerId, museum.isPublic),
          fetchAcceptedLoansForMuseum(museum.id).catch(() => [] as IslandInvite[]),
        ]);
        setActiveMuseum({ kind: 'cloud', museum, pieces });
        setActiveMuseumLoans(loans);
        setCloudDiscoveredIds([]);
        setSelectedIslandId(null);
        setSelectedRoomId(null);
        setMode2D(null);
        setDirectoryOpen(false);
        const userAlreadyPicked = localStorage.getItem(CHAR_PICKED_KEY) === '1';
        if (!userAlreadyPicked && museum.defaultCharacterId) {
          setCharacterId(museum.defaultCharacterId);
        }
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('museum', museum.id);
          window.history.replaceState(null, '', u.toString());
        } catch {
          // ignorar
        }
        showToast(`Entraste a «${museum.title}»`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'No se pudo abrir este museo.');
      }
    },
    [showToast]
  );

  const openMuseumById = useCallback(
    async (museumId: string) => {
      if (museumId === 'museo404' || museumId === 'flagship') {
        openFlagshipMuseum();
        return;
      }
      try {
        const found = await fetchMuseumById(museumId);
        if (!found) {
          showToast('Ese museo ya no está disponible.');
          return;
        }
        await openCloudMuseum(found);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'No se pudo abrir el museo.');
      }
    },
    [openCloudMuseum, openFlagshipMuseum, showToast]
  );

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite')?.trim();
    const museumParam = params.get('museum')?.trim();
    if (inviteParam) {
      setInitialInviteId(inviteParam);
      setInviteModalOpen(true);
    }
    if (museumParam && museumParam !== 'museo404' && museumParam !== 'flagship') {
      openMuseumById(museumParam);
    }
  }, [openMuseumById]);

  const handleOpenOriginMuseum = useCallback(
    (url: string, sourceMuseumId?: string) => {
      if (sourceMuseumId) {
        openMuseumById(sourceMuseumId);
        return;
      }
      const match = url.match(/[?&]museum=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        openMuseumById(match[1]);
      }
    },
    [openMuseumById]
  );

  const activeTheme: MuseumThemeConfig =
    activeMuseum.kind === 'cloud' ? activeMuseum.museum.theme : flagshipTheme;

  const islands: Island[] = useMemo(() => {
    if (activeMuseum.kind === 'cloud') {
      if (activeMuseumLoans.length === 0) {
        return activeMuseum.museum.islands;
      }
      const loanByIsland = new Map<string, IslandInvite>();
      for (const loan of activeMuseumLoans) {
        if (!loanByIsland.has(loan.islandId)) {
          loanByIsland.set(loan.islandId, loan);
        }
      }
      return activeMuseum.museum.islands.map((isl) => {
        const inv = loanByIsland.get(isl.id);
        return inv ? { ...isl, loaned: inviteToLoanedMeta(inv) } : isl;
      });
    }
    return getResolvedIslands(museumState, false);
  }, [activeMuseum, activeMuseumLoans, museumState]);

  const getActiveRoomsForIsland = useCallback(
    (islandId: string): Room[] => {
      if (activeMuseum.kind === 'cloud') {
        return activeMuseum.museum.rooms.filter((r) => r.islandId === islandId);
      }
      return getRoomsForIsland(museumState, islandId);
    },
    [activeMuseum, museumState]
  );

  const mergeFlagshipPieceCommerce = useCallback(
    (piece: MuseumPiece): MuseumPiece => {
      const remoteComm = flagshipConfig.pieceCommerce?.[piece.id];
      if (!remoteComm) return piece;
      const localOv = museumState.overrides[piece.id];
      return {
        ...piece,
        saleStatus: localOv?.saleStatus ?? remoteComm.saleStatus,
        priceLabel: localOv?.priceLabel ?? remoteComm.priceLabel,
        mediumOrSize: localOv?.mediumOrSize ?? remoteComm.mediumOrSize,
        paymentUrl: localOv?.paymentUrl ?? remoteComm.paymentUrl,
      };
    },
    [flagshipConfig.pieceCommerce, museumState.overrides]
  );

  const getActivePiecesForRoom = useCallback(
    (islandId: string, roomId: string): MuseumPiece[] => {
      const room = getActiveRoomsForIsland(islandId).find((r) => r.id === roomId);
      if (activeMuseum.kind === 'cloud') {
        const rawPieces = activeMuseum.pieces.filter(
          (p) => p.islandId === islandId && p.roomId === roomId
        );
        return sortPiecesForRoom(rawPieces, room);
      }
      const rawLocal = getPiecesForRoom(museumState, islandId, roomId).map(mergeFlagshipPieceCommerce);
      return sortPiecesForRoom(rawLocal, room);
    },
    [activeMuseum, getActiveRoomsForIsland, museumState, mergeFlagshipPieceCommerce]
  );

  const roomCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const isl of islands) {
      map[isl.id] = getActiveRoomsForIsland(isl.id).length;
    }
    return map;
  }, [islands, getActiveRoomsForIsland]);

  const pieceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const isl of islands) {
      if (activeMuseum.kind === 'cloud') {
        map[isl.id] = activeMuseum.pieces.filter((p) => p.islandId === isl.id).length;
      } else {
        map[isl.id] = getPiecesCountForIsland(museumState, isl.id);
      }
    }
    return map;
  }, [islands, activeMuseum, museumState]);

  const totalMuseumPieces = useMemo(
    () => Object.values(pieceCounts).reduce((a, b) => a + b, 0),
    [pieceCounts]
  );

  const piecesByIsland = useMemo(() => {
    const out: Record<string, MuseumPiece[]> = {};
    for (const isl of islands) {
      if (activeMuseum.kind === 'cloud') {
        out[isl.id] = activeMuseum.pieces.filter((p) => p.islandId === isl.id);
      } else {
        const rooms = getRoomsForIsland(museumState, isl.id);
        const list: MuseumPiece[] = [];
        for (const r of rooms) {
          list.push(...getPiecesForRoom(museumState, isl.id, r.id).map(mergeFlagshipPieceCommerce));
        }
        out[isl.id] = list;
      }
    }
    return out;
  }, [islands, activeMuseum, museumState, mergeFlagshipPieceCommerce]);

  useEffect(() => {
    if (selectedIslandId && !islands.some((i) => i.id === selectedIslandId)) {
      setSelectedIslandId(null);
      setSelectedRoomId(null);
    }
    if (mode2D && !islands.some((i) => i.id === mode2D.islandId)) {
      setMode2D(null);
    }
  }, [islands, selectedIslandId, mode2D]);

  const markDiscovered = useCallback(
    (pieceId: string) => {
      if (activeMuseum.kind === 'cloud') {
        setCloudDiscoveredIds((prev) => {
          if (prev.includes(pieceId)) return prev;
          retroAudio.playDiscovery();
          return [...prev, pieceId];
        });
        return;
      }

      setMuseumState((prev) => {
        if (prev.discoveredIds.includes(pieceId)) return prev;
        retroAudio.playDiscovery();
        const next = { ...prev, discoveredIds: [...prev.discoveredIds, pieceId] };
        saveMuseumState(next);
        return next;
      });
    },
    [activeMuseum.kind]
  );

  const handleOpenPiece = useCallback(
    (piece: MuseumPiece) => {
      markDiscovered(piece.id);

      if (piece.id === 'base-patio-fountain') {
        const quote = FOUNTAIN_QUOTES[Math.floor(Math.random() * FOUNTAIN_QUOTES.length)];
        retroAudio.playFountain();
        setModalPayload({
          kind: 'dialogue',
          title: piece.title,
          subtitle: 'Patio 404',
          lines: [quote],
        });
        return;
      }

      if (
        piece.mediaDataUrl ||
        piece.mediaKey ||
        piece.type === 'audio' ||
        piece.type === 'video' ||
        piece.kind === 'image' ||
        piece.type === 'image'
      ) {
        if (piece.painting && !piece.mediaKey && !piece.mediaDataUrl) {
          setModalPayload({ kind: 'painting', piece, painting: piece.painting });
        } else {
          setModalPayload({ kind: 'media', piece });
        }
        return;
      }

      if (piece.app) {
        setModalPayload({ kind: 'app', app: piece.app, piece });
        return;
      }

      if (piece.painting) {
        setModalPayload({ kind: 'painting', piece, painting: piece.painting });
        return;
      }

      if (piece.kind === 'link' || piece.type === 'link') {
        setModalPayload({
          kind: 'link',
          title: piece.title,
          description: piece.subtitle || piece.body || '',
          url: piece.url || '#',
          piece,
        });
        return;
      }

      setModalPayload({
        kind: 'dialogue',
        title: piece.title,
        subtitle: piece.subtitle,
        lines: piece.lines && piece.lines.length > 0 ? piece.lines : [piece.body || ''],
        piece,
      });
    },
    [markDiscovered]
  );

  const handleSelectIsland = useCallback((islandId: string) => {
    setSelectedIslandId(islandId);
    setSelectedRoomId(null);
    if (!retroAudio.muted) retroAudio.playInteract();
  }, []);

  const anyOverlayOpen = Boolean(
    editorSource ||
      modalPayload ||
      mode2D ||
      directoryOpen ||
      createMuseumOpen ||
      characterModalOpen ||
      shareTargetPiece ||
      guestbookContext ||
      supportModalOpen ||
      aboutModalOpen ||
      inviteModalOpen
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !anyOverlayOpen) {
        setSelectedIslandId(null);
        setSelectedRoomId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyOverlayOpen]);

  const selectedIsland = islands.find((i) => i.id === selectedIslandId) || null;
  const selectedIslandRooms = selectedIsland ? getActiveRoomsForIsland(selectedIsland.id) : [];
  const selectedPiecesByRoom = useMemo(() => {
    if (!selectedIsland) return {};
    const out: Record<string, MuseumPiece[]> = {};
    for (const r of selectedIslandRooms) {
      out[r.id] = getActivePiecesForRoom(selectedIsland.id, r.id);
    }
    return out;
  }, [selectedIsland, selectedIslandRooms, getActivePiecesForRoom]);

  const active2DIsland = mode2D ? islands.find((i) => i.id === mode2D.islandId) || null : null;
  const active2DRooms = active2DIsland ? getActiveRoomsForIsland(active2DIsland.id) : [];
  const active2DPiecesByRoom = useMemo(() => {
    if (!active2DIsland) return {};
    const out: Record<string, MuseumPiece[]> = {};
    for (const r of active2DRooms) {
      out[r.id] = getActivePiecesForRoom(active2DIsland.id, r.id);
    }
    return out;
  }, [active2DIsland, active2DRooms, getActivePiecesForRoom]);

  const isFlagshipAdmin = isFlagshipAdminUser(authUser);
  const isOwnerOfActiveCloud =
    activeMuseum.kind === 'cloud' && authUser?.uid === activeMuseum.museum.ownerId;
  const activeGuestLoan = useMemo(() => {
    if (activeMuseum.kind !== 'cloud' || !authUser || isOwnerOfActiveCloud) return null;
    return (
      activeMuseumLoans.find(
        (l) => l.status === 'accepted' && l.guestUid === authUser.uid
      ) || null
    );
  }, [activeMuseum.kind, authUser, isOwnerOfActiveCloud, activeMuseumLoans]);
  const canEditActiveMuseum = activeMuseum.kind === 'flagship' || isOwnerOfActiveCloud;
  const canModerateActiveGuestbook =
    activeMuseum.kind === 'flagship' ? isFlagshipAdmin : isOwnerOfActiveCloud;

  const activeMuseumId = activeMuseum.kind === 'cloud' ? activeMuseum.museum.id : 'museo404';
  const activeMuseumTitle =
    activeMuseum.kind === 'cloud' ? activeMuseum.museum.title : 'MUSEO 404 · siNOMBRE';
  const activeMuseumAuthor =
    activeMuseum.kind === 'cloud' ? activeMuseum.museum.authorName : 'Colección Original';
  const activeMuseumIsPublic =
    activeMuseum.kind === 'cloud' ? activeMuseum.museum.isPublic : true;
  const activeMuseumOwnerId =
    activeMuseum.kind === 'cloud' ? activeMuseum.museum.ownerId : 'museo404';

  const currentCharProfile = getCharacterProfile(characterId);

  const openGuestEditorForLoan = () => {
    if (activeMuseum.kind !== 'cloud' || !activeGuestLoan) return;
    setSelectedIslandId(null);
    setEditorInitialViewMode(undefined);
    setEditorSource({
      kind: 'cloud',
      museum: activeMuseum.museum,
      pieces: activeMuseum.pieces,
      authUser,
      guestAccess: {
        inviteId: activeGuestLoan.id,
        allowedIslandId: activeGuestLoan.islandId,
        museumTitle: activeGuestLoan.museumTitle,
      },
      onSyncMuseum: (nextMuseum, nextPieces) => {
        setActiveMuseum({ kind: 'cloud', museum: nextMuseum, pieces: nextPieces });
        setEditorSource((prev) =>
          prev && prev.kind === 'cloud'
            ? { ...prev, museum: nextMuseum, pieces: nextPieces }
            : prev
        );
      },
      onDeletedMuseum: () => {
        setEditorSource(null);
      },
    });
  };

  const openEditorForCurrentMuseum = (initialView?: 'appearance' | 'inquiries') => {
    setSelectedIslandId(null);
    setEditorInitialViewMode(initialView);
    if (activeMuseum.kind === 'flagship') {
      setEditorSource({
        kind: 'local',
        state: museumState,
        onUpdateState: updateState,
        theme: flagshipTheme,
        onUpdateTheme: updateFlagshipTheme,
        flagshipConfig,
        onSaveFlagshipConfig: handleSaveFlagshipConfig,
        isFlagshipAdmin,
        authUser,
      });
    } else if (isOwnerOfActiveCloud) {
      setEditorSource({
        kind: 'cloud',
        museum: activeMuseum.museum,
        pieces: activeMuseum.pieces,
        authUser,
        onSyncMuseum: (nextMuseum, nextPieces) => {
          setActiveMuseum({ kind: 'cloud', museum: nextMuseum, pieces: nextPieces });
          setEditorSource((prev) =>
            prev && prev.kind === 'cloud'
              ? { ...prev, museum: nextMuseum, pieces: nextPieces }
              : prev
          );
          setMyMuseums((prev) => prev.map((m) => (m.id === nextMuseum.id ? nextMuseum : m)));
          refreshDirectory();
        },
        onDeletedMuseum: (deletedId) => {
          setEditorSource(null);
          setMyMuseums((prev) => prev.filter((m) => m.id !== deletedId));
          openFlagshipMuseum();
          refreshDirectory();
          showToast('Museo eliminado.');
        },
      });
    }
  };

  return (
    <main
      aria-label="Museo 404 siNOMBRE, archipiélago interactivo"
      style={{ backgroundColor: activeTheme.surfaceColor }}
      className="relative h-screen w-screen overflow-hidden text-[#f8f4dd]"
    >
      {/* Barra superior del Archipiélago */}
      <header className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3 sm:left-8 sm:right-8 sm:top-6">
        <div className="pointer-events-auto [text-shadow:0_3px_0_rgba(4,35,49,0.4)]">
          <p
            className="font-pixel text-[9px] tracking-wider sm:text-[10px]"
            style={{ color: activeTheme.accentColor }}
          >
            {activeMuseum.kind === 'cloud'
              ? `${CATEGORY_META[activeMuseum.museum.category]?.badge || 'MUSEO'} · POR ${activeMuseum.museum.authorName.toUpperCase()}`
              : 'MUSEO 404 · siNOMBRE'}
          </p>
          <h1 className="mt-1.5 text-xl font-bold leading-tight text-[#fff9e6] sm:text-3xl">
            {activeMuseum.kind === 'cloud' ? activeMuseum.museum.title : 'Un archipiélago de ideas'}
          </h1>
          <p className="mt-1 hidden text-sm text-[#e1f4e9] sm:block">
            {activeMuseum.kind === 'cloud'
              ? activeMuseum.museum.subtitle
              : 'Cada isla conserva una forma distinta de perderse.'}
          </p>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              refreshDirectory();
              setDirectoryOpen(true);
            }}
            style={{ borderColor: activeTheme.accentColor }}
            className="font-pixel inline-flex items-center gap-1.5 border-2 bg-[#0b4757]/90 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#136578] whitespace-nowrap"
          >
            <Compass className="h-3.5 w-3.5" style={{ color: activeTheme.accentColor }} />
            <span>MUSEOS</span>
          </button>

          <button
            type="button"
            onClick={() => setCharacterModalOpen(true)}
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-white/65 bg-[#053143]/85 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#084d5b] whitespace-nowrap"
            title={`Personaje actual: ${currentCharProfile.name}`}
          >
            <UserIcon className="h-3.5 w-3.5" style={{ color: activeTheme.accentColor }} />
            <span className="hidden sm:inline">{currentCharProfile.name.split(' ')[0].toUpperCase()}</span>
            <span className="sm:hidden">AVATAR</span>
          </button>

          <button
            type="button"
            onClick={() => setWorldView((prev) => (prev === '3d' ? 'map' : '3d'))}
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#7fd6cc] bg-[#0c4a59]/90 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#136578] whitespace-nowrap"
          >
            {worldView === '3d' ? (
              <>
                <MapIcon className="h-3.5 w-3.5 text-[#f4d47d]" />
                <span>MAPA 2D</span>
              </>
            ) : (
              <>
                <Box className="h-3.5 w-3.5 text-[#f4d47d]" />
                <span>CAMINAR 3D</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setBgmActive(retroAudio.toggleBgm())}
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-white/65 bg-[#053143]/80 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#084d5b] whitespace-nowrap"
          >
            {bgmActive ? <Volume2 className="h-3.5 w-3.5 text-[#f4d47d]" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{bgmActive ? 'SONIDO: ON' : 'SONIDO'}</span>
          </button>

          <button
            type="button"
            onClick={() => setAboutModalOpen(true)}
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#f2d17b]/80 bg-[#053143]/85 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#084d5b] whitespace-nowrap"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[#f4d47d]" />
            <span className="hidden md:inline">MANIFIESTO</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setGuestbookContext({
                islandId: 'patio',
                roomId: 'reception',
                scopeLabel: 'Recepción · Patio 404',
              })
            }
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#7fd6cc] bg-[#053143]/85 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#084d5b] whitespace-nowrap"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#f4d47d]" />
            <span className="hidden sm:inline">VISITAS</span>
          </button>

          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#f2d17b] bg-[#8f432b]/90 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#b25f37] whitespace-nowrap"
          >
            <Heart className="h-3.5 w-3.5 text-[#ffe19c]" />
            <span className="hidden sm:inline">APOYAR</span>
          </button>

          {canEditActiveMuseum ? (
            <button
              type="button"
              onClick={() => openEditorForCurrentMuseum()}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#f2d17b] bg-[#724527]/95 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#8d5531] whitespace-nowrap"
            >
              <Pencil className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>EDITAR MUSEO</span>
            </button>
          ) : activeGuestLoan ? (
            <button
              type="button"
              onClick={openGuestEditorForLoan}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#7fd6cc] bg-[#145869]/95 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#1c7388] whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>EDITAR ISLA PRESTADA</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCreateMuseumOpen(true)}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#f2d17b] bg-[#724527]/95 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#8d5531] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>CREAR MI MUSEO</span>
            </button>
          )}

          {authUser ? (
            <button
              type="button"
              onClick={async () => {
                await signOutCreator();
                showToast('Sesión cerrada.');
              }}
              title={`Conectado como ${authUser.displayName || 'Creador'}. Clic para cerrar sesión.`}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-white/55 bg-[#053143]/85 px-2.5 py-2.5 text-[9px] text-[#d0e6da] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#603d3d] hover:text-white whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">SALIR</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#7fd6cc] bg-[#145869]/90 px-3 py-2.5 text-[9px] text-[#fff9e6] shadow-[0_4px_0_rgba(3,35,48,0.36)] transition-transform hover:-translate-y-0.5 hover:bg-[#1c7388] whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>ENTRAR</span>
            </button>
          )}
        </div>
      </header>

      {/* Vista 3D de cerca estilo Mario 64 o Mapa Isométrico 2D */}
      {worldView === '3d' ? (
        <Archipelago3D
          islands={islands}
          piecesByIsland={piecesByIsland}
          characterId={characterId}
          theme={activeTheme}
          controlsPaused={anyOverlayOpen}
          onSelectIsland={handleSelectIsland}
          onOpenPiece={handleOpenPiece}
          onOpenGuestbook={() =>
            setGuestbookContext({
              islandId: 'patio',
              roomId: 'reception',
              scopeLabel: 'Recepción · Patio 404',
            })
          }
          onOpenSupport={() => setSupportModalOpen(true)}
          onEnter2DMode={(islandId) => {
            const islandRooms = getActiveRoomsForIsland(islandId);
            if (islandRooms.length > 0) {
              setSelectedIslandId(null);
              setMode2D({ islandId, roomId: islandRooms[0].id });
            } else {
              handleSelectIsland(islandId);
            }
          }}
        />
      ) : (
        <ArchipelagoMap
          islands={islands}
          roomCounts={roomCounts}
          pieceCounts={pieceCounts}
          selectedIslandId={selectedIslandId}
          characterId={characterId}
          theme={activeTheme}
          controlsPaused={anyOverlayOpen}
          onSelectIsland={handleSelectIsland}
          onOpenOriginMuseum={handleOpenOriginMuseum}
        />
      )}

      {/* Panel lateral de colección de la isla */}
      {!mode2D && (
        <IslandDrawer
          island={selectedIsland}
          rooms={selectedIslandRooms}
          selectedRoomId={selectedRoomId}
          piecesByRoom={selectedPiecesByRoom}
          theme={activeTheme}
          onSelectRoom={setSelectedRoomId}
          onOpenPiece={handleOpenPiece}
          onOpenGuestbook={(isl, room) =>
            setGuestbookContext({
              islandId: isl.id,
              roomId: room ? room.id : 'reception',
              scopeLabel: room ? `${isl.title} · ${room.name}` : isl.title,
            })
          }
          onEnter2DMode={(islandId, roomId) => {
            setSelectedIslandId(null);
            setMode2D({ islandId, roomId });
          }}
          onOpenOriginMuseum={handleOpenOriginMuseum}
          onClose={() => {
            setSelectedIslandId(null);
            setSelectedRoomId(null);
          }}
        />
      )}

      {/* Modo de Exploración Interior 2D */}
      {mode2D && active2DIsland && (
        <RoomExplorer2D
          island={active2DIsland}
          rooms={active2DRooms}
          initialRoomId={mode2D.roomId}
          piecesByRoom={active2DPiecesByRoom}
          characterId={characterId}
          theme={activeTheme}
          discoveredCount={
            activeMuseum.kind === 'cloud'
              ? cloudDiscoveredIds.length
              : museumState.discoveredIds.length
          }
          totalMuseumPieces={totalMuseumPieces}
          isModalOpen={Boolean(
            modalPayload ||
              editorSource ||
              shareTargetPiece ||
              characterModalOpen ||
              guestbookContext ||
              supportModalOpen ||
              aboutModalOpen ||
              inviteModalOpen
          )}
          onOpenPiece={handleOpenPiece}
          onOpenSign={(title, content) =>
            setModalPayload({ kind: 'dialogue', title, lines: [content] })
          }
          onOpenGuestbook={(isl, room) =>
            setGuestbookContext({
              islandId: isl.id,
              roomId: room.id,
              scopeLabel: `${isl.title} · ${room.name}`,
            })
          }
          onOpenOriginMuseum={handleOpenOriginMuseum}
          onExitToArchipelago={() => setMode2D(null)}
        />
      )}

      {/* Directorio de Museos */}
      <MuseumDirectoryModal
        isOpen={directoryOpen}
        authUser={authUser}
        publicMuseums={publicMuseums}
        myMuseums={myMuseums}
        activeMuseumId={activeMuseum.kind === 'cloud' ? activeMuseum.museum.id : 'flagship'}
        loading={directoryLoading}
        error={directoryError}
        onRefresh={() => refreshDirectory()}
        onOpenFlagship={openFlagshipMuseum}
        onOpenCloudMuseum={openCloudMuseum}
        onOpenMuseumById={openMuseumById}
        onOpenEditorForMuseum={async (museum) => {
          try {
            const [pieces, loans] = await Promise.all([
              fetchMuseumPieces(museum.id, museum.ownerId, museum.isPublic),
              fetchAcceptedLoansForMuseum(museum.id).catch(() => [] as IslandInvite[]),
            ]);
            setDirectoryOpen(false);
            setEditorInitialViewMode(undefined);
            setActiveMuseum({ kind: 'cloud', museum, pieces });
            setActiveMuseumLoans(loans);
            setEditorSource({
              kind: 'cloud',
              museum,
              pieces,
              authUser,
              onSyncMuseum: (nextMuseum, nextPieces) => {
                setActiveMuseum({ kind: 'cloud', museum: nextMuseum, pieces: nextPieces });
                setEditorSource((prev) =>
                  prev && prev.kind === 'cloud'
                    ? { ...prev, museum: nextMuseum, pieces: nextPieces }
                    : prev
                );
                setMyMuseums((prev) =>
                  prev.map((m) => (m.id === nextMuseum.id ? nextMuseum : m))
                );
                refreshDirectory();
              },
              onDeletedMuseum: (deletedId) => {
                setEditorSource(null);
                setMyMuseums((prev) => prev.filter((m) => m.id !== deletedId));
                openFlagshipMuseum();
                refreshDirectory();
                showToast('Museo eliminado.');
              },
            });
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'No se pudo abrir el editor.');
          }
        }}
        onOpenCreateMuseum={() => {
          setDirectoryOpen(false);
          setCreateMuseumOpen(true);
        }}
        onOpenInviteModal={() => {
          setInitialInviteId(null);
          setInviteModalOpen(true);
        }}
        onOpenGuide={() => setAboutModalOpen(true)}
        onCopyMuseumLink={async (museum) => {
          const shareUrl = `${window.location.origin}${window.location.pathname}?museum=${encodeURIComponent(museum.id)}`;
          try {
            await navigator.clipboard?.writeText(shareUrl);
            showToast(`Enlace directo de «${museum.title}» copiado.`);
          } catch {
            showToast(`Enlace: ?museum=${museum.id}`);
          }
        }}
        onSignIn={handleSignIn}
        onClose={() => setDirectoryOpen(false)}
      />

      {/* Crear Nuevo Museo */}
      <CreateMuseumModal
        isOpen={createMuseumOpen}
        authUser={authUser}
        onSignIn={handleSignIn}
        onCreated={({ museum, pieces }) => {
          setCreateMuseumOpen(false);
          setMyMuseums((prev) => [museum, ...prev]);
          setActiveMuseum({ kind: 'cloud', museum, pieces });
          setActiveMuseumLoans([]);
          setCloudDiscoveredIds([]);
          setSelectedIslandId(null);
          setSelectedRoomId(null);
          setMode2D(null);
          refreshDirectory();
          showToast(`¡Museo «${museum.title}» creado!`, {
            label: 'ABRIR TALLER',
            onClick: () => {
              setEditorInitialViewMode(undefined);
              setEditorSource({
                kind: 'cloud',
                museum,
                pieces,
                authUser,
                onSyncMuseum: (nextMuseum, nextPieces) => {
                  setActiveMuseum({ kind: 'cloud', museum: nextMuseum, pieces: nextPieces });
                  setEditorSource((prev) =>
                    prev && prev.kind === 'cloud'
                      ? { ...prev, museum: nextMuseum, pieces: nextPieces }
                      : prev
                  );
                  setMyMuseums((prev) =>
                    prev.map((m) => (m.id === nextMuseum.id ? nextMuseum : m))
                  );
                  refreshDirectory();
                },
                onDeletedMuseum: (deletedId) => {
                  setEditorSource(null);
                  setMyMuseums((prev) => prev.filter((m) => m.id !== deletedId));
                  openFlagshipMuseum();
                  refreshDirectory();
                  showToast('Museo eliminado.');
                },
              });
            },
          });
        }}
        onClose={() => setCreateMuseumOpen(false)}
      />

      {/* Selector de Personaje */}
      <CharacterSelectorModal
        isOpen={characterModalOpen}
        selectedCharacterId={characterId}
        onSelectCharacter={handleSelectCharacter}
        onClose={() => setCharacterModalOpen(false)}
      />

      {/* Compartir obra en mi museo */}
      <SharePieceModal
        piece={shareTargetPiece}
        sourceMuseumId={activeMuseumId}
        sourceMuseumTitle={activeMuseumTitle}
        sourceAuthorName={activeMuseumAuthor}
        authUser={authUser}
        myMuseums={myMuseums}
        onSignIn={handleSignIn}
        onOpenCreateMuseum={() => setCreateMuseumOpen(true)}
        onCurated={(targetMuseumId, createdPiece) => {
          setMyMuseums((prev) =>
            prev.map((m) =>
              m.id === targetMuseumId ? { ...m, pieceCount: m.pieceCount + 1 } : m
            )
          );
          if (activeMuseum.kind === 'cloud' && activeMuseum.museum.id === targetMuseumId) {
            setActiveMuseum({
              kind: 'cloud',
              museum: {
                ...activeMuseum.museum,
                pieceCount: activeMuseum.museum.pieceCount + 1,
              },
              pieces: [...activeMuseum.pieces, createdPiece],
            });
          }
          refreshDirectory();
          showToast(`Obra compartida en tu museo correctamente.`);
        }}
        onClose={() => setShareTargetPiece(null)}
      />

      {/* Libro de Visitas */}
      <GuestbookModal
        isOpen={Boolean(guestbookContext)}
        museumId={activeMuseumId}
        museumTitle={activeMuseumTitle}
        museumIsPublic={activeMuseumIsPublic}
        islandId={guestbookContext?.islandId || 'patio'}
        roomId={guestbookContext?.roomId || 'reception'}
        scopeLabel={guestbookContext?.scopeLabel || 'Recepción'}
        authUser={authUser}
        canModerate={canModerateActiveGuestbook}
        onToast={showToast}
        onClose={() => setGuestbookContext(null)}
      />

      {/* Donaciones y Aportar al Proyecto */}
      <SupportProjectModal
        isOpen={supportModalOpen}
        activeMuseumId={activeMuseumId}
        activeMuseumTitle={activeMuseumTitle}
        activeMuseumAuthor={activeMuseumAuthor}
        activeDonation={
          activeMuseum.kind === 'cloud'
            ? activeMuseum.museum.donationConfig
            : flagshipConfig.donationConfig
        }
        flagshipDonation={flagshipConfig.donationConfig}
        canEditActiveMuseum={
          activeMuseum.kind === 'flagship' ? isFlagshipAdmin : isOwnerOfActiveCloud
        }
        onOpenEditorAppearance={() => openEditorForCurrentMuseum('appearance')}
        onOpenGuide={() => setAboutModalOpen(true)}
        onClose={() => setSupportModalOpen(false)}
      />

      {/* Acerca de y Guía de Uso */}
      <AboutGuideModal
        isOpen={aboutModalOpen}
        canEditActiveMuseum={canEditActiveMuseum}
        onOpenDirectory={() => {
          refreshDirectory();
          setDirectoryOpen(true);
        }}
        onOpenInviteModal={() => {
          setInitialInviteId(null);
          setInviteModalOpen(true);
        }}
        onOpenEditor={() => openEditorForCurrentMuseum()}
        onOpenCreateMuseum={() => setCreateMuseumOpen(true)}
        onOpenSupport={() => setSupportModalOpen(true)}
        onClose={() => setAboutModalOpen(false)}
      />

      {/* Invitaciones a Islas Prestadas */}
      <LoanInviteModal
        isOpen={inviteModalOpen}
        initialInviteId={initialInviteId}
        authUser={authUser}
        myMuseums={myMuseums}
        onSignIn={handleSignIn}
        onAccepted={(acceptedInvite) => {
          if (
            activeMuseum.kind === 'cloud' &&
            activeMuseum.museum.id === acceptedInvite.museumId
          ) {
            setActiveMuseumLoans((prev) => [
              acceptedInvite,
              ...prev.filter((l) => l.id !== acceptedInvite.id),
            ]);
          }
          showToast(
            `¡Isla prestada aceptada! Ya puedes editar tus piezas en «${acceptedInvite.islandTitle}».`
          );
        }}
        onOpenMuseumById={openMuseumById}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Editor del Museo (Local o en la Nube) */}
      {editorSource && (
        <MuseumEditor
          source={editorSource}
          initialViewMode={editorInitialViewMode}
          onClose={() => {
            setEditorSource(null);
            setEditorInitialViewMode(undefined);
          }}
        />
      )}

      {/* Visor unificado de diálogos, pinturas, multimedia y mini-apps */}
      <ContentModal
        payload={modalPayload}
        frameStyle={activeTheme.frameStyle || 'archival'}
        museumId={activeMuseumId}
        museumOwnerId={activeMuseumOwnerId}
        museumIsPublic={activeMuseumIsPublic}
        onSharePiece={(piece) => setShareTargetPiece(piece)}
        onVisitSourceMuseum={(sourceId) => openMuseumById(sourceId)}
        onToast={showToast}
        onClose={() => setModalPayload(null)}
      />

      {/* Aviso breve no intrusivo */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border-2 border-[#e1c875] bg-[#072634] px-4 py-2 text-xs font-semibold text-[#fff9e6] shadow-xl"
        >
          <span>{toastMessage}</span>
          {toastAction && (
            <button
              type="button"
              onClick={() => {
                const act = toastAction;
                setToastMessage(null);
                setToastAction(null);
                act.onClick();
              }}
              className="font-pixel border border-[#f2d17b] bg-[#bd7544] px-2.5 py-1 text-[8px] text-[#fff9e8] hover:bg-[#a24d2e] whitespace-nowrap"
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
