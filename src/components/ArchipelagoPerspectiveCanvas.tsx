import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { getCharacterProfile } from '../data/characters';
import { retroAudio } from '../game/audio';
import { CharacterId, Island, MuseumPiece, MuseumThemeConfig } from '../types/museum';
import { MiniCompassHandle, MiniCompassRadar } from './MiniCompassRadar';

type CameraPreset = 'cerca' | 'media' | 'panoramica';

interface ArchipelagoPerspectiveCanvasProps {
  islands: Island[];
  piecesByIsland: Record<string, MuseumPiece[]>;
  characterId?: CharacterId;
  theme?: MuseumThemeConfig;
  controlsPaused: boolean;
  onSelectIsland: (islandId: string) => void;
  onOpenPiece: (piece: MuseumPiece) => void;
  onEnter2DMode: (islandId: string) => void;
  onOpenGuestbook?: () => void;
  onOpenSupport?: () => void;
}

const DECK_Y = 1.6;

const PRESET_CONFIG: Record<CameraPreset, { dist: number; height: number; lookAhead: number }> = {
  cerca: { dist: 7.4, height: 3.4, lookAhead: 2.0 },
  media: { dist: 13.2, height: 6.4, lookAhead: 2.2 },
  panoramica: { dist: 24.5, height: 13.8, lookAhead: 1.5 },
};

interface IslandData {
  island: Island;
  cx: number;
  cz: number;
  radius: number;
  toHubAngle: number;
}

interface BridgeData {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
  archHeight: number;
  length: number;
}

interface TriggerData {
  id: string;
  kind: 'island' | 'piece' | 'guestbook' | 'support';
  islandId: string;
  label: string;
  sublabel: string;
  x: number;
  z: number;
  radius: number;
  piece?: MuseumPiece;
}

interface ColliderData {
  x: number;
  z: number;
  radius: number;
}

interface Prop3D {
  kind: 'tree' | 'lantern' | 'landmark' | 'pedestal' | 'cactus' | 'crystal' | 'guideSign';
  x: number;
  y: number;
  z: number;
  biome?: Island['biome'];
  scale?: number;
  tint?: string;
  isIslandPortal?: boolean;
  label?: string;
}

interface ProjectedPoint {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export const ArchipelagoPerspectiveCanvas: React.FC<ArchipelagoPerspectiveCanvasProps> = ({
  islands,
  piecesByIsland,
  characterId = 'explorador',
  theme,
  controlsPaused,
  onSelectIsland,
  onOpenPiece,
  onEnter2DMode,
  onOpenGuestbook,
  onOpenSupport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarRef = useRef<MiniCompassHandle | null>(null);
  const controlsPausedRef = useRef(controlsPaused);
  controlsPausedRef.current = controlsPaused;
  const onSelectIslandRef = useRef(onSelectIsland);
  onSelectIslandRef.current = onSelectIsland;
  const onOpenPieceRef = useRef(onOpenPiece);
  onOpenPieceRef.current = onOpenPiece;
  const onOpenGuestbookRef = useRef(onOpenGuestbook);
  onOpenGuestbookRef.current = onOpenGuestbook;
  const onOpenSupportRef = useRef(onOpenSupport);
  onOpenSupportRef.current = onOpenSupport;
  const characterIdRef = useRef<CharacterId>(characterId);
  characterIdRef.current = characterId;
  const themeRef = useRef<MuseumThemeConfig | undefined>(theme);
  themeRef.current = theme;

  // Precompute deterministic layout matching the 3D world coordinates
  const world = useMemo(() => {
    const islandNodes: IslandData[] = islands.map((isl) => ({
      island: isl,
      cx: (isl.x - 50) * 1.38,
      cz: (isl.y - 52) * 1.12,
      radius: isl.biome === 'patio' ? 14.5 : 12.2,
      toHubAngle: Math.PI * 0.5,
    }));

    const hubNode =
      islandNodes.find((n) => n.island.id === 'patio' || n.island.biome === 'patio') ||
      islandNodes[0];

    const bridges: BridgeData[] = [];
    const colliders: ColliderData[] = [];
    const triggers: TriggerData[] = [];
    const props: Prop3D[] = [];

    for (const node of islandNodes) {
      if (hubNode && node !== hubNode) {
        node.toHubAngle = Math.atan2(hubNode.cx - node.cx, hubNode.cz - node.cz);
        const dx = node.cx - hubNode.cx;
        const dz = node.cz - hubNode.cz;
        const dist = Math.hypot(dx, dz);
        if (dist >= 1) {
          const ux = dx / dist;
          const uz = dz / dist;
          const ax = hubNode.cx + ux * (hubNode.radius - 1.2);
          const az = hubNode.cz + uz * (hubNode.radius - 1.2);
          const bx = node.cx - ux * (node.radius - 1.2);
          const bz = node.cz - uz * (node.radius - 1.2);
          const length = Math.hypot(bx - ax, bz - az);
          bridges.push({
            ax,
            az,
            bx,
            bz,
            halfWidth: 1.65,
            archHeight: Math.min(1.15, Math.max(0.45, length * 0.032)),
            length,
          });
        }
      }

      const backAngle = node.toHubAngle + Math.PI;
      const landX = node.island.biome === 'patio' ? node.cx : node.cx + Math.sin(backAngle) * 1.6;
      const landZ = node.island.biome === 'patio' ? node.cz : node.cz + Math.cos(backAngle) * 1.6;

      props.push({
        kind: 'landmark',
        x: landX,
        y: DECK_Y,
        z: landZ,
        biome: node.island.biome,
        label: node.island.mapLabel || node.island.title,
      });
      colliders.push({ x: landX, z: landZ, radius: 2.8 });

      // Decor props per biome
      if (node.island.biome === 'patio' || node.island.biome === 'forest' || node.island.biome === 'observatory') {
        const treeCoords =
          node.island.biome === 'patio'
            ? [
                [-7.8, -5.2, 1.3],
                [8.1, -4.6, 1.15],
                [-7.2, 6.8, 1.0],
              ]
            : [
                [-6.6, -4.8, 1.2],
                [6.9, -4.5, 1.3],
                [-6.8, 4.4, 1.05],
                [6.4, 5.1, 1.0],
              ];
        for (const [ox, oz, sc] of treeCoords) {
          props.push({
            kind: 'tree',
            x: node.cx + ox,
            y: DECK_Y,
            z: node.cz + oz,
            scale: sc,
            tint: node.island.biome === 'forest' ? '#2e6b43' : '#3b8050',
          });
          colliders.push({ x: node.cx + ox, z: node.cz + oz, radius: 0.55 * sc });
        }
      } else if (node.island.biome === 'desert') {
        for (const [ox, oz] of [
          [-6.5, -3.8],
          [6.9, -4.6],
          [6.1, 4.9],
        ]) {
          props.push({ kind: 'cactus', x: node.cx + ox, y: DECK_Y, z: node.cz + oz });
          colliders.push({ x: node.cx + ox, z: node.cz + oz, radius: 0.65 });
        }
      } else if (node.island.biome === 'ice') {
        for (const [ox, oz] of [
          [-6.8, -4.4],
          [6.8, -4.1],
          [-6.2, 5.2],
        ]) {
          props.push({ kind: 'crystal', x: node.cx + ox, y: DECK_Y, z: node.cz + oz });
          colliders.push({ x: node.cx + ox, z: node.cz + oz, radius: 0.85 });
        }
      } else if (node.island.biome === 'crypt') {
        const pillarCoords = [
          [-6.6, -4.2],
          [6.8, -4.5],
          [-6.4, 4.8],
          [6.5, 4.6],
        ];
        for (const [ox, oz] of pillarCoords) {
          props.push({ kind: 'tree', x: node.cx + ox, y: DECK_Y, z: node.cz + oz, scale: 0.9, tint: '#3e384d' });
          colliders.push({ x: node.cx + ox, z: node.cz + oz, radius: 0.55 });
        }
      } else if (node.island.biome === 'coral') {
        for (const [ox, oz] of [
          [-6.5, -4.2],
          [6.7, -4.0],
          [-5.8, 5.0],
        ]) {
          props.push({ kind: 'crystal', x: node.cx + ox, y: DECK_Y, z: node.cz + oz });
          colliders.push({ x: node.cx + ox, z: node.cz + oz, radius: 0.8 });
        }
      }

      // Bridge approach lanterns
      if (hubNode && node !== hubNode) {
        const shoreX = node.cx + Math.sin(node.toHubAngle) * (node.radius - 1.0);
        const shoreZ = node.cz + Math.cos(node.toHubAngle) * (node.radius - 1.0);
        const perpX = Math.cos(node.toHubAngle) * 1.9;
        const perpZ = -Math.sin(node.toHubAngle) * 1.9;
        props.push({
          kind: 'lantern',
          x: shoreX * 0.75 + node.cx * 0.25 + perpX,
          y: DECK_Y,
          z: shoreZ * 0.75 + node.cz * 0.25 + perpZ,
        });
        props.push({
          kind: 'lantern',
          x: shoreX * 0.75 + node.cx * 0.25 - perpX,
          y: DECK_Y,
          z: shoreZ * 0.75 + node.cz * 0.25 - perpZ,
        });

        // Directional wooden guide sign at Patio 404 radial bridge mouth
        const hubAng = Math.atan2(node.cx - hubNode.cx, node.cz - hubNode.cz);
        const gDist = hubNode.radius - 2.4;
        const gPerpX = Math.cos(hubAng) * 2.1;
        const gPerpZ = -Math.sin(hubAng) * 2.1;
        const gx = hubNode.cx + Math.sin(hubAng) * gDist + gPerpX;
        const gz = hubNode.cz + Math.cos(hubAng) * gDist + gPerpZ;
        props.push({
          kind: 'guideSign',
          x: gx,
          y: DECK_Y,
          z: gz,
          label: (node.island.mapLabel || node.island.title).slice(0, 18),
        });
        colliders.push({ x: gx, z: gz, radius: 0.4 });
      }

      // Main island portal pedestal
      const portalDist = node.island.biome === 'patio' ? 4.3 : 3.8;
      const px = node.cx + Math.sin(node.toHubAngle) * portalDist;
      const pz = node.cz + Math.cos(node.toHubAngle) * portalDist;
      props.push({
        kind: 'pedestal',
        x: px,
        y: DECK_Y,
        z: pz,
        isIslandPortal: true,
        label: node.island.mapLabel || node.island.title,
      });
      colliders.push({ x: px, z: pz, radius: 0.62 });
      triggers.push({
        id: `island-${node.island.id}`,
        kind: 'island',
        islandId: node.island.id,
        label: node.island.title,
        sublabel: 'Abrir colección y salas',
        x: px,
        z: pz,
        radius: 3.2,
      });

      if (node === hubNode) {
        const gbX = node.cx - 4.2;
        const gbZ = node.cz + 6.4;
        props.push({
          kind: 'pedestal',
          x: gbX,
          y: DECK_Y,
          z: gbZ,
          isIslandPortal: true,
          label: 'Visitas',
        });
        colliders.push({ x: gbX, z: gbZ, radius: 0.62 });
        triggers.push({
          id: `guestbook-${node.island.id}`,
          kind: 'guestbook',
          islandId: node.island.id,
          label: 'Libro de visitas · Recepción',
          sublabel: 'Deja una nota o firma para el museo',
          x: gbX,
          z: gbZ,
          radius: 2.65,
        });

        const spX = node.cx + 4.2;
        const spZ = node.cz + 6.4;
        props.push({
          kind: 'pedestal',
          x: spX,
          y: DECK_Y,
          z: spZ,
          isIslandPortal: false,
          label: 'Apoyar',
        });
        colliders.push({ x: spX, z: spZ, radius: 0.62 });
        triggers.push({
          id: `support-${node.island.id}`,
          kind: 'support',
          islandId: node.island.id,
          label: 'Apoyar al proyecto',
          sublabel: 'Donaciones y aporte comunitario',
          x: spX,
          z: spZ,
          radius: 2.65,
        });
      }

      // Up to 3 featured piece pedestals per island
      const featured = (piecesByIsland[node.island.id] || []).slice(0, 3);
      featured.forEach((piece, idx) => {
        const offsetAng = node.toHubAngle + (idx - 1) * 0.92 + (idx === 1 ? Math.PI * 0.55 : 0);
        const pedR = node.radius * 0.54;
        const fx = node.cx + Math.sin(offsetAng) * pedR;
        const fz = node.cz + Math.cos(offsetAng) * pedR;
        props.push({
          kind: 'pedestal',
          x: fx,
          y: DECK_Y,
          z: fz,
          isIslandPortal: false,
          label: piece.title,
        });
        colliders.push({ x: fx, z: fz, radius: 0.62 });
        triggers.push({
          id: piece.id,
          kind: 'piece',
          islandId: node.island.id,
          label: piece.title,
          sublabel: piece.subtitle || 'Pieza del archivo',
          x: fx,
          z: fz,
          radius: 2.65,
          piece,
        });
      });
    }

    const spawnHub = hubNode || { cx: 0, cz: 0, radius: 14 };
    const spawnPoint = {
      x: spawnHub.cx,
      y: DECK_Y,
      z: spawnHub.cz + Math.min(8.2, spawnHub.radius * 0.58),
    };

    function sampleWalkableHeight(x: number, z: number) {
      let bestY = -Infinity;
      let walkable = false;
      let islandId: string | null = null;
      let onBridge = false;

      for (const node of islandNodes) {
        if (Math.hypot(x - node.cx, z - node.cz) <= node.radius - 0.25) {
          walkable = true;
          if (DECK_Y > bestY) {
            bestY = DECK_Y;
            islandId = node.island.id;
          }
        }
      }

      for (const br of bridges) {
        const vx = br.bx - br.ax;
        const vz = br.bz - br.az;
        const lenSq = vx * vx + vz * vz;
        if (lenSq < 0.001) continue;
        const proj = ((x - br.ax) * vx + (z - br.az) * vz) / lenSq;
        if (proj >= -0.02 && proj <= 1.02) {
          const clampedT = Math.max(0, Math.min(1, proj));
          const closestX = br.ax + vx * clampedT;
          const closestZ = br.az + vz * clampedT;
          if (Math.hypot(x - closestX, z - closestZ) <= br.halfWidth - 0.18) {
            const bridgeY = DECK_Y + Math.sin(clampedT * Math.PI) * br.archHeight;
            walkable = true;
            onBridge = true;
            if (bridgeY > bestY) bestY = bridgeY;
          }
        }
      }

      return { walkable, groundY: walkable ? bestY : 0, islandId, onBridge };
    }

    return {
      islandNodes,
      hubNode,
      bridges,
      colliders,
      triggers,
      props,
      spawnPoint,
      sampleWalkableHeight,
    };
  }, [islands, piecesByIsland]);

  const worldRef = useRef(world);
  worldRef.current = world;

  const playerRef = useRef({
    x: world.spawnPoint.x,
    y: world.spawnPoint.y,
    z: world.spawnPoint.z,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: Math.PI,
    grounded: true,
    walkPhase: 0,
    safeX: world.spawnPoint.x,
    safeY: world.spawnPoint.y,
    safeZ: world.spawnPoint.z,
  });

  const cameraStateRef = useRef({
    yaw: 0,
    dist: PRESET_CONFIG.cerca.dist,
    height: PRESET_CONFIG.cerca.height,
    lookAhead: PRESET_CONFIG.cerca.lookAhead,
    targetDist: PRESET_CONFIG.cerca.dist,
    targetHeight: PRESET_CONFIG.cerca.height,
    targetLookAhead: PRESET_CONFIG.cerca.lookAhead,
  });

  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    camLeft: false,
    camRight: false,
    sprint: false,
    jumpQueued: false,
  });

  const activeTriggerRef = useRef<TriggerData | null>(null);
  const activeLocationRef = useRef<{ islandId: string | null; label: string }>({
    islandId: null,
    label: 'Patio 404',
  });

  const [camPreset, setCamPreset] = useState<CameraPreset>('cerca');
  const [dofEnabled, setDofEnabled] = useState(true);
  const dofEnabledRef = useRef(true);
  dofEnabledRef.current = dofEnabled;
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [nearbyTrigger, setNearbyTrigger] = useState<{
    id: string;
    kind: 'island' | 'piece' | 'guestbook' | 'support';
    islandId: string;
    label: string;
    sublabel: string;
  } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Patio 404');
  const [currentIslandId, setCurrentIslandId] = useState<string | null>('patio');

  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    setCamPreset(preset);
    const cfg = PRESET_CONFIG[preset];
    cameraStateRef.current.targetDist = cfg.dist;
    cameraStateRef.current.targetHeight = cfg.height;
    cameraStateRef.current.targetLookAhead = cfg.lookAhead;
  }, []);

  const recenterCamera = useCallback(() => {
    cameraStateRef.current.yaw = playerRef.current.yaw + Math.PI;
  }, []);

  const triggerInteract = useCallback(() => {
    const trig = activeTriggerRef.current;
    if (trig) {
      if (trig.kind === 'guestbook') {
        onOpenGuestbookRef.current?.();
      } else if (trig.kind === 'support') {
        onOpenSupportRef.current?.();
      } else if (trig.kind === 'piece' && trig.piece) {
        onOpenPieceRef.current(trig.piece);
      } else {
        onSelectIslandRef.current(trig.islandId);
      }
      return;
    }
    const loc = activeLocationRef.current;
    if (loc.islandId) {
      onSelectIslandRef.current(loc.islandId);
    }
  }, []);

  // Ensure explorer stays on valid terrain after museum edits
  useEffect(() => {
    const p = playerRef.current;
    if (!world.sampleWalkableHeight(p.x, p.z).walkable) {
      p.x = world.spawnPoint.x;
      p.y = world.spawnPoint.y;
      p.z = world.spawnPoint.z;
      p.safeX = p.x;
      p.safeY = p.y;
      p.safeZ = p.z;
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
    }
  }, [world]);

  // Clear held keys on modal pause
  useEffect(() => {
    if (controlsPaused) {
      keysRef.current = {
        up: false,
        down: false,
        left: false,
        right: false,
        camLeft: false,
        camRight: false,
        sprint: false,
        jumpQueued: false,
      };
    }
  }, [controlsPaused]);

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (controlsPausedRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const k = keysRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          k.up = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          k.down = true;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          k.left = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          k.right = true;
          e.preventDefault();
          break;
        case 'q':
        case 'Q':
          k.camLeft = true;
          break;
        case 'e':
        case 'E':
          k.camRight = true;
          break;
        case 'Shift':
          k.sprint = true;
          break;
        case ' ':
          k.jumpQueued = true;
          e.preventDefault();
          break;
        case 'r':
        case 'R':
          recenterCamera();
          break;
        case 'h':
        case 'H':
          setHudCollapsed((prev) => !prev);
          break;
        case 'b':
        case 'B':
          setDofEnabled((prev) => !prev);
          break;
        case 'Enter':
        case 'f':
        case 'F':
          e.preventDefault();
          triggerInteract();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          k.up = false;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          k.down = false;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          k.left = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          k.right = false;
          break;
        case 'q':
        case 'Q':
          k.camLeft = false;
          break;
        case 'e':
        case 'E':
          k.camRight = false;
          break;
        case 'Shift':
          k.sprint = false;
          break;
      }
    };

    const onBlur = () => {
      keysRef.current = {
        up: false,
        down: false,
        left: false,
        right: false,
        camLeft: false,
        camRight: false,
        sprint: false,
        jumpQueued: false,
      };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [recenterCamera, triggerInteract]);

  // Software 3D Perspective Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraStateRef.current.yaw -= dx * 0.0065;
      cameraStateRef.current.targetHeight = Math.max(
        2.1,
        Math.min(16.5, cameraStateRef.current.targetHeight + dy * 0.025)
      );
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (controlsPausedRef.current) return;
      e.preventDefault();
      const cs = cameraStateRef.current;
      cs.targetDist = Math.max(4.6, Math.min(28, cs.targetDist + e.deltaY * 0.012));
      cs.targetHeight = Math.max(2.2, Math.min(16, cs.targetHeight + e.deltaY * 0.0055));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');

    const resize = () => {
      const parent = canvas.parentElement;
      const rawW = parent?.clientWidth || window.innerWidth || 1;
      const rawH = parent?.clientHeight || window.innerHeight || 1;
      const w = Math.max(1, Math.round(rawW));
      const h = Math.max(1, Math.round(rawH));
      canvas.width = w;
      canvas.height = h;
      bgCanvas.width = Math.max(240, Math.round(w * 0.55));
      bgCanvas.height = Math.max(135, Math.round(h * 0.55));
    };
    resize();
    window.addEventListener('resize', resize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && canvas.parentElement
        ? new ResizeObserver(() => resize())
        : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const damp = (curr: number, target: number, lambda: number, dt: number) =>
      curr + (target - curr) * (1 - Math.exp(-lambda * dt));

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      const wWorld = worldRef.current;
      const p = playerRef.current;
      const k = keysRef.current;
      const cs = cameraStateRef.current;

      // Camera orbit
      if (!controlsPausedRef.current) {
        if (k.camLeft) cs.yaw += 1.9 * dt;
        if (k.camRight) cs.yaw -= 1.9 * dt;
      }

      // Camera-relative walking
      let moveX = 0;
      let moveZ = 0;
      let rawX = 0;
      let rawZ = 0;
      if (!controlsPausedRef.current) {
        rawX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        rawZ = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        if (rawX !== 0 || rawZ !== 0) {
          const len = Math.hypot(rawX, rawZ);
          const nx = rawX / len;
          const nz = rawZ / len;
          const cosY = Math.cos(cs.yaw);
          const sinY = Math.sin(cs.yaw);
          moveX = nx * cosY + nz * sinY;
          moveZ = -nx * sinY + nz * cosY;
        }
      }

      const maxSpeed = k.sprint ? 8.6 : 5.4;
      if (moveX !== 0 || moveZ !== 0) {
        const desiredYaw = Math.atan2(moveX, moveZ);
        p.yaw += shortestAngleDiff(p.yaw, desiredYaw) * (1 - Math.exp(-10.5 * dt));

        const fwdDirX = Math.sin(p.yaw);
        const fwdDirZ = Math.cos(p.yaw);
        const alignment = fwdDirX * moveX + fwdDirZ * moveZ;
        const turnFactor = Math.max(0.14, Math.pow(Math.max(0, (alignment + 0.35) / 1.35), 1.35));
        const targetSpeed = maxSpeed * turnFactor;
        p.vx = damp(p.vx, fwdDirX * targetSpeed, 10, dt);
        p.vz = damp(p.vz, fwdDirZ * targetSpeed, 10, dt);

        if (!dragging && !k.camLeft && !k.camRight && rawX !== 0 && rawZ <= 0) {
          const camDiff = shortestAngleDiff(cs.yaw, p.yaw + Math.PI);
          const followRate = rawZ === 0 ? 1.85 : 1.05;
          cs.yaw += camDiff * Math.min(1, followRate * dt);
        }
      } else {
        p.vx = damp(p.vx, 0, 12, dt);
        p.vz = damp(p.vz, 0, 12, dt);
      }

      let resolvedX = p.x + p.vx * dt;
      let resolvedZ = p.z + p.vz * dt;
      for (const col of wWorld.colliders) {
        const dx = resolvedX - col.x;
        const dz = resolvedZ - col.z;
        const d = Math.hypot(dx, dz);
        const minDist = col.radius + 0.45;
        if (d < minDist && d > 0.0001) {
          const push = (minDist - d) / d;
          resolvedX += dx * push;
          resolvedZ += dz * push;
        }
      }

      const surf = wWorld.sampleWalkableHeight(resolvedX, resolvedZ);
      const currSurf = wWorld.sampleWalkableHeight(p.x, p.z);
      if (!surf.walkable && currSurf.onBridge && p.grounded) {
        if (wWorld.sampleWalkableHeight(resolvedX, p.z).walkable) resolvedZ = p.z;
        else if (wWorld.sampleWalkableHeight(p.x, resolvedZ).walkable) resolvedX = p.x;
        else {
          resolvedX = p.x;
          resolvedZ = p.z;
        }
      }

      p.x = resolvedX;
      p.z = resolvedZ;
      const finalSurf = wWorld.sampleWalkableHeight(p.x, p.z);

      if (k.jumpQueued && !controlsPausedRef.current) {
        k.jumpQueued = false;
        if (p.grounded) {
          p.vy = 9.2;
          p.grounded = false;
          retroAudio.playJump();
        }
      } else {
        k.jumpQueued = false;
      }

      p.vy -= 25.0 * dt;
      p.y += p.vy * dt;

      if (finalSurf.walkable) {
        if (p.y <= finalSurf.groundY + 0.08 && p.vy <= 0.5) {
          if (!p.grounded && p.vy < -3.5) retroAudio.playStep();
          p.y = finalSurf.groundY;
          p.vy = 0;
          p.grounded = true;
          p.safeX = p.x;
          p.safeY = finalSurf.groundY;
          p.safeZ = p.z;
        } else if (p.y > finalSurf.groundY + 0.14) {
          p.grounded = false;
        }
      } else {
        p.grounded = false;
        if (p.y < 0.18) {
          p.x = p.safeX;
          p.y = p.safeY + 1.2;
          p.z = p.safeZ;
          p.vx = 0;
          p.vz = 0;
          p.vy = 2.0;
          retroAudio.playFountain();
        }
      }

      const horizSpeed = Math.hypot(p.vx, p.vz);
      if (horizSpeed > 0.25 && p.grounded) {
        p.walkPhase += dt * (8 + (horizSpeed / 5.4) * 4.5);
      }

      // Triggers & location plaque updates
      let closestTrig: TriggerData | null = null;
      let closestDist = Infinity;
      for (const trig of wWorld.triggers) {
        const d = Math.hypot(p.x - trig.x, p.z - trig.z);
        if (d <= trig.radius && d < closestDist) {
          closestDist = d;
          closestTrig = trig;
        }
      }
      if ((closestTrig?.id || null) !== (activeTriggerRef.current?.id || null)) {
        activeTriggerRef.current = closestTrig;
        setNearbyTrigger(closestTrig ? { ...closestTrig } : null);
      }

      const nextIslandId = finalSurf.islandId;
      let nextLabel = 'Puente del Archipiélago';
      if (nextIslandId) {
        const found = wWorld.islandNodes.find((n) => n.island.id === nextIslandId);
        if (found) nextLabel = found.island.title;
      } else if (!finalSurf.walkable) {
        nextLabel = 'Aguas del Archipiélago';
      }
      if (
        nextIslandId !== activeLocationRef.current.islandId ||
        nextLabel !== activeLocationRef.current.label
      ) {
        activeLocationRef.current = { islandId: nextIslandId, label: nextLabel };
        setCurrentIslandId(nextIslandId);
        setLocationLabel(nextLabel);
      }

      radarRef.current?.update(p.x, p.z, p.yaw, cs.yaw);

      // Smooth chase camera parameters
      cs.dist = damp(cs.dist, cs.targetDist, 8, dt);
      cs.height = damp(cs.height, cs.targetHeight, 8, dt);
      cs.lookAhead = damp(cs.lookAhead, cs.targetLookAhead, 8, dt);

      const camX = p.x + Math.sin(cs.yaw) * cs.dist;
      const camZ = p.z + Math.cos(cs.yaw) * cs.dist;
      const camY = Math.max(p.y, DECK_Y) + cs.height;

      const lookX = p.x - Math.sin(cs.yaw) * cs.lookAhead;
      const lookY = p.y + 1.45;
      const lookZ = p.z - Math.cos(cs.yaw) * cs.lookAhead;

      // Camera basis for true 3D perspective projection
      const fx = lookX - camX;
      const fy = lookY - camY;
      const fz = lookZ - camZ;
      const flen = Math.hypot(fx, fy, fz) || 1;
      const fwdX = fx / flen;
      const fwdY = fy / flen;
      const fwdZ = fz / flen;

      // Right = normalize(cross(fwd, up(0,1,0)))
      let rx = -fwdZ;
      let rz = fwdX;
      const rlen = Math.hypot(rx, rz) || 1;
      rx /= rlen;
      rz /= rlen;
      // Up = cross(right, fwd)
      const ux = -rz * fwdY;
      const uy = rz * fwdX - rx * fwdZ;
      const uz = rx * fwdY;

      const W = canvas.width;
      const H = canvas.height;
      if (W <= 0 || H <= 0) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      const fovPx = H * 0.95;

      const project = (wx: number, wy: number, wz: number): ProjectedPoint | null => {
        const dx = wx - camX;
        const dy = wy - camY;
        const dz = wz - camZ;
        const zCam = dx * fwdX + dy * fwdY + dz * fwdZ;
        if (zCam < 0.45) return null;
        const xCam = dx * rx + dz * rz;
        const yCam = dx * ux + dy * uy + dz * uz;
        const scale = fovPx / zCam;
        return {
          sx: W * 0.5 + xCam * scale,
          sy: H * 0.5 - yCam * scale,
          depth: zCam,
          scale,
        };
      };

      // Sky & Horizon Ocean Backdrop (reactive to museum theme)
      const activeTheme = themeRef.current;
      const horizonProj = project(camX + fwdX * 150, 0, camZ + fwdZ * 150);
      const horizonY = horizonProj ? Math.max(H * 0.16, Math.min(H * 0.65, horizonProj.sy)) : H * 0.38;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, activeTheme?.skyColor || '#4ca9bf');
      skyGrad.addColorStop(0.65, activeTheme?.skyColor || '#76d0df');
      skyGrad.addColorStop(1, '#bcecf1');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizonY + 2);

      const seaGrad = ctx.createLinearGradient(0, horizonY, 0, H);
      seaGrad.addColorStop(0, activeTheme?.oceanColor || '#5bc1d3');
      seaGrad.addColorStop(0.32, activeTheme?.oceanColor || '#2394ac');
      seaGrad.addColorStop(1, activeTheme?.surfaceColor || '#0d687d');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, horizonY, W, H - horizonY);

      // Animated pixel water shimmer lines
      ctx.fillStyle = 'rgba(176, 244, 248, 0.25)';
      for (let i = 0; i < 18; i++) {
        const t = ((i / 18) + (elapsed * 0.04) % 1) % 1;
        const wy = horizonY + Math.pow(t, 1.8) * (H - horizonY);
        const barW = 24 + t * 140;
        const waveX = ((i * 211 + Math.sin(elapsed + i) * 35) % (W + 120)) - 60;
        ctx.fillRect(waveX, wy, barW, Math.max(2, t * 4));
      }

      // Draw queue sorted back-to-front
      const drawQueue: { depth: number; draw: () => void }[] = [];

      // 1. Islands (base cliff + biome top + cobblestone plaza & caminitos)
      for (const node of wWorld.islandNodes) {
        const centerProj = project(node.cx, DECK_Y, node.cz);
        if (!centerProj && Math.hypot(node.cx - camX, node.cz - camZ) > 95) continue;

        const sides = 14;
        const topPts: ProjectedPoint[] = [];
        const botPts: ProjectedPoint[] = [];
        let allValid = true;
        for (let i = 0; i < sides; i++) {
          const ang = (i / sides) * Math.PI * 2;
          const vx = node.cx + Math.cos(ang) * node.radius;
          const vz = node.cz + Math.sin(ang) * node.radius;
          const tp = project(vx, DECK_Y, vz);
          const bp = project(
            node.cx + Math.cos(ang) * (node.radius * 0.84),
            0.05,
            node.cz + Math.sin(ang) * (node.radius * 0.84)
          );
          if (!tp || !bp) {
            // Skip clipping vertices smoothly below instead of discarding entire close island
          }
          if (tp) topPts.push(tp);
          if (bp) botPts.push(bp);
        }
        if (topPts.length < 4) allValid = false;
        if (!allValid) continue;

        const isDesert = node.island.biome === 'desert';
        const isIce = node.island.biome === 'ice';
        const isVolcano = node.island.biome === 'volcano';
        const isCrypt = node.island.biome === 'crypt';
        const isCoral = node.island.biome === 'coral';
        const turfColor = isDesert ? '#d8b46a' : isIce ? '#c3ecf3' : isVolcano ? '#382a2d' : isCrypt ? '#453e52' : isCoral ? '#1f6f78' : '#65ad72';
        const pathColor = isDesert ? '#e6c88a' : isIce ? '#e4f8fc' : isVolcano ? '#543d41' : isCrypt ? '#5c546b' : isCoral ? '#4ecdc4' : '#d8c593';
        const cliffColor = isVolcano ? '#21181c' : isCrypt ? '#2d2738' : isCoral ? '#14464c' : '#6d503b';

        const islDepth = Math.hypot(node.cx - camX, node.cz - camZ) + node.radius * 0.35;
        drawQueue.push({
          depth: islDepth,
          draw: () => {
            // Sea foam ring (or liminal mist halo for loaned islands)
            if (botPts.length >= 4) {
              ctx.fillStyle = node.island.loaned
                ? 'rgba(240, 248, 255, 0.58)'
                : 'rgba(188, 244, 248, 0.55)';
              ctx.beginPath();
              botPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy + 4) : ctx.lineTo(pt.sx, pt.sy + 4)));
              ctx.closePath();
              ctx.fill();
            }

            if (node.island.loaned && topPts.length >= 4) {
              const pulse = 0.24 + Math.sin(elapsed * 1.6) * 0.08;
              ctx.save();
              ctx.strokeStyle = `rgba(244, 250, 255, ${pulse.toFixed(2)})`;
              ctx.lineWidth = 10;
              ctx.beginPath();
              topPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
              ctx.closePath();
              ctx.stroke();
              ctx.restore();
            }

            // Cliff skirt
            ctx.fillStyle = cliffColor;
            ctx.beginPath();
            topPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
            [...botPts].reverse().forEach((pt) => ctx.lineTo(pt.sx, pt.sy));
            ctx.closePath();
            ctx.fill();

            // Biome turf top
            ctx.fillStyle = turfColor;
            ctx.strokeStyle = '#3d6f49';
            ctx.lineWidth = 2;
            ctx.beginPath();
            topPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Central cobblestone plaza
            const pPts: ProjectedPoint[] = [];
            for (let i = 0; i < 12; i++) {
              const ang = (i / 12) * Math.PI * 2;
              const pp = project(
                node.cx + Math.cos(ang) * (node.radius * 0.44),
                DECK_Y + 0.03,
                node.cz + Math.sin(ang) * (node.radius * 0.44)
              );
              if (pp) pPts.push(pp);
            }
            if (pPts.length >= 4) {
              ctx.fillStyle = pathColor;
              ctx.beginPath();
              pPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
              ctx.closePath();
              ctx.fill();
            }

            // Caminito path strip toward hub or out from hub
            const drawPathDir = (ang: number) => {
              const p1 = project(node.cx + Math.sin(ang) * 2.5 - Math.cos(ang) * 1.4, DECK_Y + 0.04, node.cz + Math.cos(ang) * 2.5 + Math.sin(ang) * 1.4);
              const p2 = project(node.cx + Math.sin(ang) * 2.5 + Math.cos(ang) * 1.4, DECK_Y + 0.04, node.cz + Math.cos(ang) * 2.5 - Math.sin(ang) * 1.4);
              const p3 = project(node.cx + Math.sin(ang) * (node.radius - 0.8) + Math.cos(ang) * 1.4, DECK_Y + 0.04, node.cz + Math.cos(ang) * (node.radius - 0.8) - Math.sin(ang) * 1.4);
              const p4 = project(node.cx + Math.sin(ang) * (node.radius - 0.8) - Math.cos(ang) * 1.4, DECK_Y + 0.04, node.cz + Math.cos(ang) * (node.radius - 0.8) + Math.sin(ang) * 1.4);
              if (p1 && p2 && p3 && p4) {
                ctx.fillStyle = pathColor;
                ctx.beginPath();
                ctx.moveTo(p1.sx, p1.sy);
                ctx.lineTo(p2.sx, p2.sy);
                ctx.lineTo(p3.sx, p3.sy);
                ctx.lineTo(p4.sx, p4.sy);
                ctx.closePath();
                ctx.fill();
              }
            };

            if (wWorld.hubNode && node !== wWorld.hubNode) {
              drawPathDir(node.toHubAngle);
            } else if (node === wWorld.hubNode) {
              for (const other of wWorld.islandNodes) {
                if (other === node) continue;
                drawPathDir(Math.atan2(other.cx - node.cx, other.cz - node.cz));
              }
            }
          },
        });
      }

      // 2. Arched Timber Bridge Segments & Guardrails
      for (const br of wWorld.bridges) {
        const dx = br.bx - br.ax;
        const dz = br.bz - br.az;
        const yaw = Math.atan2(dx, dz);
        const perpX = Math.cos(yaw) * br.halfWidth;
        const perpZ = -Math.sin(yaw) * br.halfWidth;
        const segments = Math.max(8, Math.round(br.length / 2.4));

        for (let i = 0; i < segments; i++) {
          const t0 = i / segments;
          const t1 = (i + 1) / segments;
          const y0 = DECK_Y + Math.sin(t0 * Math.PI) * br.archHeight;
          const y1 = DECK_Y + Math.sin(t1 * Math.PI) * br.archHeight;
          const x0 = br.ax + dx * t0;
          const z0 = br.az + dz * t0;
          const x1 = br.ax + dx * t1;
          const z1 = br.az + dz * t1;

          const c0 = project(x0 - perpX, y0, z0 - perpZ);
          const c1 = project(x0 + perpX, y0, z0 + perpZ);
          const c2 = project(x1 + perpX, y1, z1 + perpZ);
          const c3 = project(x1 - perpX, y1, z1 - perpZ);
          const postL = project(x0 - perpX * 0.92, y0 + 0.85, z0 - perpZ * 0.92);
          const postR = project(x0 + perpX * 0.92, y0 + 0.85, z0 + perpZ * 0.92);
          if (!c0 || !c1 || !c2 || !c3) continue;

          const segDepth = (c0.depth + c1.depth + c2.depth + c3.depth) * 0.25;
          drawQueue.push({
            depth: segDepth,
            draw: () => {
              ctx.fillStyle = i % 2 === 0 ? '#a96e3f' : '#975e33';
              ctx.strokeStyle = '#53321e';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(c0.sx, c0.sy);
              ctx.lineTo(c1.sx, c1.sy);
              ctx.lineTo(c2.sx, c2.sy);
              ctx.lineTo(c3.sx, c3.sy);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              // Wooden rail posts
              if (postL) {
                ctx.strokeStyle = '#5c3922';
                ctx.lineWidth = Math.max(2, postL.scale * 0.14);
                ctx.beginPath();
                ctx.moveTo(c0.sx, c0.sy);
                ctx.lineTo(postL.sx, postL.sy);
                ctx.stroke();
              }
              if (postR) {
                ctx.strokeStyle = '#5c3922';
                ctx.lineWidth = Math.max(2, postR.scale * 0.14);
                ctx.beginPath();
                ctx.moveTo(c1.sx, c1.sy);
                ctx.lineTo(postR.sx, postR.sy);
                ctx.stroke();
              }
            },
          });
        }
      }

      // 3. Props, Biome Landmarks & Pedestals
      for (const prop of wWorld.props) {
        const base = project(prop.x, prop.y, prop.z);
        if (!base) continue;

        drawQueue.push({
          depth: base.depth,
          draw: () => {
            const s = base.scale;
            if (prop.kind === 'tree') {
              const ts = (prop.scale || 1) * s;
              ctx.fillStyle = '#5c3922';
              ctx.fillRect(base.sx - 0.22 * ts, base.sy - 1.65 * ts, 0.44 * ts, 1.65 * ts);
              ctx.fillStyle = prop.tint || '#3b8050';
              ctx.beginPath();
              ctx.arc(base.sx, base.sy - 2.35 * ts, 1.05 * ts, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#62ad6b';
              ctx.beginPath();
              ctx.arc(base.sx - 0.2 * ts, base.sy - 2.85 * ts, 0.72 * ts, 0, Math.PI * 2);
              ctx.fill();
            } else if (prop.kind === 'lantern') {
              ctx.fillStyle = '#5c3922';
              ctx.fillRect(base.sx - 0.1 * s, base.sy - 1.8 * s, 0.2 * s, 1.8 * s);
              ctx.fillStyle = '#ffe494';
              ctx.fillRect(base.sx - 0.18 * s, base.sy - 2.0 * s, 0.36 * s, 0.38 * s);
            } else if (prop.kind === 'guideSign') {
              ctx.fillStyle = '#5c3922';
              ctx.fillRect(base.sx - 0.1 * s, base.sy - 1.55 * s, 0.2 * s, 1.55 * s);
              const bw = Math.max(46, 2.0 * s);
              const bh = Math.max(20, 0.72 * s);
              ctx.fillStyle = '#5b3921';
              ctx.fillRect(base.sx - bw * 0.5, base.sy - 1.75 * s - bh * 0.5, bw, bh);
              ctx.strokeStyle = '#e6c35a';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(base.sx - bw * 0.5, base.sy - 1.75 * s - bh * 0.5, bw, bh);
              if (base.depth < 24 && prop.label) {
                ctx.fillStyle = '#fff9e6';
                ctx.font = `bold ${Math.max(8, Math.min(12, Math.round(s * 0.28)))}px "Pixelify Sans", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(prop.label, base.sx, base.sy - 1.75 * s);
              }
            } else if (prop.kind === 'cactus') {
              ctx.fillStyle = '#3b8a57';
              ctx.fillRect(base.sx - 0.26 * s, base.sy - 2.1 * s, 0.52 * s, 2.1 * s);
              ctx.fillRect(base.sx + 0.26 * s, base.sy - 1.45 * s, 0.55 * s, 0.38 * s);
              ctx.fillRect(base.sx + 0.52 * s, base.sy - 1.85 * s, 0.32 * s, 0.75 * s);
            } else if (prop.kind === 'crystal') {
              ctx.fillStyle = '#6adcf0';
              ctx.beginPath();
              ctx.moveTo(base.sx, base.sy - 2.6 * s);
              ctx.lineTo(base.sx + 0.65 * s, base.sy - 1.1 * s);
              ctx.lineTo(base.sx + 0.38 * s, base.sy);
              ctx.lineTo(base.sx - 0.38 * s, base.sy);
              ctx.lineTo(base.sx - 0.65 * s, base.sy - 1.1 * s);
              ctx.closePath();
              ctx.fill();
            } else if (prop.kind === 'pedestal') {
              // Stone pedestal
              ctx.fillStyle = '#d2c4a0';
              ctx.fillRect(base.sx - 0.52 * s, base.sy - 0.26 * s, 1.04 * s, 0.26 * s);
              ctx.fillStyle = '#7b4d3b';
              ctx.fillRect(base.sx - 0.32 * s, base.sy - 1.05 * s, 0.64 * s, 0.8 * s);
              ctx.fillStyle = '#e6c35a';
              ctx.fillRect(base.sx - 0.44 * s, base.sy - 1.2 * s, 0.88 * s, 0.16 * s);

              // Floating spinning diamond beacon
              const bob = Math.sin(elapsed * 2.8 + prop.x) * 0.16 * s;
              const by = base.sy - 1.95 * s + bob;
              ctx.fillStyle = prop.isIslandPortal ? '#7df2ff' : '#ffdf76';
              ctx.beginPath();
              ctx.moveTo(base.sx, by - 0.36 * s);
              ctx.lineTo(base.sx + 0.28 * s, by);
              ctx.lineTo(base.sx, by + 0.36 * s);
              ctx.lineTo(base.sx - 0.28 * s, by);
              ctx.closePath();
              ctx.fill();
            } else if (prop.kind === 'landmark') {
              if (prop.biome === 'patio') {
                // Multi-tier Wish Fountain
                ctx.fillStyle = '#d2c4a0';
                ctx.fillRect(base.sx - 2.2 * s, base.sy - 0.6 * s, 4.4 * s, 0.6 * s);
                ctx.fillStyle = '#5be4f5';
                ctx.fillRect(base.sx - 1.9 * s, base.sy - 0.72 * s, 3.8 * s, 0.18 * s);
                ctx.fillStyle = '#d2c4a0';
                ctx.fillRect(base.sx - 0.48 * s, base.sy - 2.1 * s, 0.96 * s, 1.5 * s);
                ctx.fillStyle = '#8ef5ff';
                const jetH = (0.7 + Math.sin(elapsed * 6) * 0.15) * s;
                ctx.fillRect(base.sx - 0.2 * s, base.sy - 2.1 * s - jetH, 0.4 * s, jetH);
              } else if (prop.biome === 'observatory') {
                ctx.fillStyle = '#d2c4a0';
                ctx.fillRect(base.sx - 1.8 * s, base.sy - 4.2 * s, 3.6 * s, 4.2 * s);
                ctx.fillStyle = '#5c3e78';
                ctx.beginPath();
                ctx.arc(base.sx, base.sy - 4.2 * s, 1.9 * s, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#8ef5ff';
                ctx.fillRect(base.sx - 0.45 * s, base.sy - 1.7 * s, 0.9 * s, 1.7 * s);
              } else if (prop.biome === 'desert') {
                ctx.fillStyle = '#dba95c';
                ctx.fillRect(base.sx - 2.5 * s, base.sy - 1.0 * s, 5.0 * s, 1.0 * s);
                ctx.fillRect(base.sx - 1.9 * s, base.sy - 2.0 * s, 3.8 * s, 1.0 * s);
                ctx.fillRect(base.sx - 1.2 * s, base.sy - 3.0 * s, 2.4 * s, 1.0 * s);
                ctx.fillRect(base.sx - 0.6 * s, base.sy - 3.9 * s, 1.2 * s, 0.9 * s);
                ctx.fillStyle = '#ffe494';
                ctx.fillRect(base.sx - 0.45 * s, base.sy - 1.5 * s, 0.9 * s, 1.5 * s);
              } else if (prop.biome === 'ice') {
                ctx.fillStyle = '#c5eef7';
                ctx.fillRect(base.sx - 2.1 * s, base.sy - 3.1 * s, 4.2 * s, 3.1 * s);
                ctx.fillStyle = '#62b4cf';
                ctx.beginPath();
                ctx.moveTo(base.sx - 1.6 * s, base.sy - 3.1 * s);
                ctx.lineTo(base.sx - 1.1 * s, base.sy - 5.2 * s);
                ctx.lineTo(base.sx - 0.6 * s, base.sy - 3.1 * s);
                ctx.moveTo(base.sx + 0.6 * s, base.sy - 3.1 * s);
                ctx.lineTo(base.sx + 1.1 * s, base.sy - 5.2 * s);
                ctx.lineTo(base.sx + 1.6 * s, base.sy - 3.1 * s);
                ctx.fill();
              } else if (prop.biome === 'workshop') {
                ctx.fillStyle = '#8c5a44';
                ctx.fillRect(base.sx - 2.3 * s, base.sy - 2.9 * s, 4.6 * s, 2.9 * s);
                ctx.fillStyle = '#374c5b';
                ctx.fillRect(base.sx - 2.5 * s, base.sy - 3.3 * s, 5.0 * s, 0.45 * s);
                ctx.fillRect(base.sx - 1.7 * s, base.sy - 5.4 * s, 0.7 * s, 2.1 * s);
                ctx.fillStyle = '#8ef5ff';
                ctx.fillRect(base.sx - 1.4 * s, base.sy - 2.4 * s, 2.8 * s, 0.45 * s);
              } else if (prop.biome === 'volcano') {
                // Volcanic basalt cone with magma mouth
                ctx.fillStyle = '#2b1418';
                ctx.beginPath();
                ctx.moveTo(base.sx - 2.6 * s, base.sy);
                ctx.lineTo(base.sx - 1.2 * s, base.sy - 3.4 * s);
                ctx.lineTo(base.sx + 1.2 * s, base.sy - 3.4 * s);
                ctx.lineTo(base.sx + 2.6 * s, base.sy);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ff4d2e';
                ctx.fillRect(base.sx - 0.9 * s, base.sy - 3.4 * s, 1.8 * s, 0.4 * s);
                ctx.fillStyle = '#ff9f38';
                ctx.fillRect(base.sx - 0.45 * s, base.sy - 3.8 * s, 0.9 * s, 0.4 * s);
              } else if (prop.biome === 'crypt') {
                // Gothic arch mausoleum
                ctx.fillStyle = '#443c52';
                ctx.fillRect(base.sx - 2.0 * s, base.sy - 3.2 * s, 4.0 * s, 3.2 * s);
                ctx.fillStyle = '#2b2536';
                ctx.fillRect(base.sx - 0.65 * s, base.sy - 2.2 * s, 1.3 * s, 2.2 * s);
                ctx.fillStyle = '#655a7a';
                ctx.beginPath();
                ctx.moveTo(base.sx - 2.2 * s, base.sy - 3.2 * s);
                ctx.lineTo(base.sx, base.sy - 4.6 * s);
                ctx.lineTo(base.sx + 2.2 * s, base.sy - 3.2 * s);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#9df5e8';
                ctx.fillRect(base.sx - 0.25 * s, base.sy - 1.5 * s, 0.5 * s, 0.7 * s);
              } else if (prop.biome === 'coral') {
                // Coral cluster & tidal shrine
                ctx.fillStyle = '#e85d75';
                ctx.fillRect(base.sx - 1.8 * s, base.sy - 2.8 * s, 0.9 * s, 2.8 * s);
                ctx.fillStyle = '#eb6b56';
                ctx.fillRect(base.sx + 0.9 * s, base.sy - 2.6 * s, 0.9 * s, 2.6 * s);
                ctx.fillStyle = '#45b8ad';
                ctx.beginPath();
                ctx.arc(base.sx, base.sy - 1.8 * s, 1.4 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#bbf5eb';
                ctx.beginPath();
                ctx.arc(base.sx, base.sy - 1.8 * s, 0.65 * s, 0, Math.PI * 2);
                ctx.fill();
              } else {
                // Forest Stone Archive Gate
                ctx.fillStyle = '#d2c4a0';
                ctx.fillRect(base.sx - 1.8 * s, base.sy - 3.2 * s, 0.7 * s, 3.2 * s);
                ctx.fillRect(base.sx + 1.1 * s, base.sy - 3.2 * s, 0.7 * s, 3.2 * s);
                ctx.fillRect(base.sx - 2.1 * s, base.sy - 3.8 * s, 4.2 * s, 0.7 * s);
                ctx.fillStyle = '#8ef5ff';
                ctx.beginPath();
                ctx.arc(base.sx, base.sy - 1.9 * s, 0.55 * s, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          },
        });
      }

      // 4. Mario-64 Explorer Character (projected right on the caminito)
      const heroProj = project(p.x, p.y, p.z);
      if (heroProj) {
        const groundBelow = finalSurf.walkable ? finalSurf.groundY : 0;
        const shadowProj = project(p.x, groundBelow + 0.03, p.z);
        drawQueue.push({
          depth: heroProj.depth,
          draw: () => {
            const s = heroProj.scale;
            if (shadowProj) {
              const hDiff = Math.max(0, p.y - groundBelow);
              const shR = Math.max(0.24, 0.56 - hDiff * 0.08) * shadowProj.scale;
              ctx.fillStyle = 'rgba(3, 24, 35, 0.45)';
              ctx.beginPath();
              ctx.ellipse(shadowProj.sx, shadowProj.sy, shR, shR * 0.42, 0, 0, Math.PI * 2);
              ctx.fill();
            }

            const stride = !p.grounded ? 0.22 : Math.sin(p.walkPhase) * Math.min(1, horizSpeed / 6) * 0.22;
            const bob = !p.grounded ? 0 : Math.abs(Math.cos(p.walkPhase)) * Math.min(1, horizSpeed / 6) * 0.08;
            const hy = heroProj.sy - bob * s;
            const charProf = getCharacterProfile(characterIdRef.current);

            // Boots / Legs
            ctx.fillStyle = charProf.bootColor;
            ctx.fillRect(heroProj.sx - 0.22 * s, hy - (0.32 - stride) * s, 0.18 * s, 0.32 * s);
            ctx.fillRect(heroProj.sx + 0.04 * s, hy - (0.32 + stride) * s, 0.18 * s, 0.32 * s);

            // Tunic + belt + scarf
            ctx.fillStyle = charProf.tunicColor;
            ctx.fillRect(heroProj.sx - 0.28 * s, hy - 1.0 * s, 0.56 * s, 0.62 * s);
            ctx.fillStyle = '#5c361e';
            ctx.fillRect(heroProj.sx - 0.29 * s, hy - 0.55 * s, 0.58 * s, 0.1 * s);
            ctx.fillStyle = charProf.scarfColor;
            ctx.fillRect(heroProj.sx - 0.3 * s, hy - 1.05 * s, 0.6 * s, 0.13 * s);

            // Backpack & bedroll
            ctx.fillStyle = '#5c361e';
            ctx.fillRect(heroProj.sx - 0.2 * s, hy - 0.94 * s, 0.4 * s, 0.4 * s);
            ctx.fillStyle = charProf.trimColor;
            ctx.fillRect(heroProj.sx - 0.22 * s, hy - 1.02 * s, 0.44 * s, 0.1 * s);

            // Head & character hat style
            ctx.fillStyle = charProf.skinColor;
            ctx.fillRect(heroProj.sx - 0.22 * s, hy - 1.44 * s, 0.44 * s, 0.4 * s);

            if (charProf.hatStyle === 'robot') {
              ctx.fillStyle = charProf.trimColor;
              ctx.fillRect(heroProj.sx - 0.18 * s, hy - 1.3 * s, 0.36 * s, 0.12 * s);
              ctx.fillStyle = charProf.tunicColor;
              ctx.fillRect(heroProj.sx - 0.25 * s, hy - 1.54 * s, 0.5 * s, 0.12 * s);
              ctx.fillRect(heroProj.sx - 0.03 * s, hy - 1.75 * s, 0.06 * s, 0.21 * s);
              ctx.fillStyle = charProf.trimColor;
              ctx.fillRect(heroProj.sx - 0.07 * s, hy - 1.84 * s, 0.14 * s, 0.12 * s);
            } else if (charProf.hatStyle === 'chef') {
              ctx.fillStyle = charProf.trimColor;
              ctx.fillRect(heroProj.sx - 0.24 * s, hy - 1.52 * s, 0.48 * s, 0.1 * s);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(heroProj.sx - 0.22 * s, hy - 1.88 * s, 0.44 * s, 0.36 * s);
            } else if (charProf.hatStyle === 'headphones') {
              ctx.fillStyle = charProf.tunicColor;
              ctx.fillRect(heroProj.sx - 0.26 * s, hy - 1.52 * s, 0.52 * s, 0.12 * s);
              ctx.fillStyle = charProf.trimColor;
              ctx.fillRect(heroProj.sx - 0.28 * s, hy - 1.36 * s, 0.08 * s, 0.22 * s);
              ctx.fillRect(heroProj.sx + 0.2 * s, hy - 1.36 * s, 0.08 * s, 0.22 * s);
            } else if (charProf.hatStyle === 'wizard') {
              ctx.fillStyle = charProf.tunicColor;
              ctx.fillRect(heroProj.sx - 0.38 * s, hy - 1.52 * s, 0.76 * s, 0.1 * s);
              ctx.fillStyle = charProf.trimColor;
              ctx.fillRect(heroProj.sx - 0.24 * s, hy - 1.6 * s, 0.48 * s, 0.08 * s);
              ctx.fillStyle = charProf.tunicColor;
              ctx.beginPath();
              ctx.moveTo(heroProj.sx - 0.24 * s, hy - 1.6 * s);
              ctx.lineTo(heroProj.sx, hy - 2.15 * s);
              ctx.lineTo(heroProj.sx + 0.24 * s, hy - 1.6 * s);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillStyle = charProf.tunicColor;
              ctx.fillRect(heroProj.sx - 0.28 * s, hy - 1.52 * s, 0.56 * s, 0.1 * s);
              ctx.beginPath();
              ctx.moveTo(heroProj.sx - 0.24 * s, hy - 1.52 * s);
              ctx.lineTo(heroProj.sx, hy - 1.98 * s);
              ctx.lineTo(heroProj.sx + 0.24 * s, hy - 1.52 * s);
              ctx.closePath();
              ctx.fill();
            }
          },
        });
      }

      drawQueue.sort((a, b) => b.depth - a.depth);
      const focusDepth = heroProj ? heroProj.depth : cs.dist;
      const dofCutoff = focusDepth + Math.max(20, cs.dist * 1.9);

      // Draw distant background elements, softly blur via downsampled pass if DOF enabled
      if (
        dofEnabledRef.current &&
        bgCtx &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        bgCanvas.width > 0 &&
        bgCanvas.height > 0
      ) {
        for (const item of drawQueue) {
          if (item.depth > dofCutoff) {
            item.draw();
          }
        }
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.imageSmoothingEnabled = true;
        bgCtx.drawImage(canvas, 0, 0, bgCanvas.width, bgCanvas.height);

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bgCanvas, 0, 0, W, H);
        const hazeGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 110);
        hazeGrad.addColorStop(0, 'rgba(182, 236, 242, 0.24)');
        hazeGrad.addColorStop(0.5, 'rgba(155, 224, 234, 0.16)');
        hazeGrad.addColorStop(1, 'rgba(155, 224, 234, 0)');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, horizonY - 30, W, 140);
        ctx.restore();

        for (const item of drawQueue) {
          if (item.depth <= dofCutoff) {
            item.draw();
          }
        }
      } else {
        for (const item of drawQueue) {
          item.draw();
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
    };
  }, []);

  const holdKey = (key: 'up' | 'down' | 'left' | 'right' | 'camLeft' | 'camRight', active: boolean) => {
    keysRef.current[key] = active;
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />

      {/* Mini-brújula / radar circular con orientación y puntos cardinales */}
      {!controlsPaused && <MiniCompassRadar islands={islands} radarRef={radarRef} />}

      {/* Placa discreta del territorio actual */}
      <div className="pointer-events-none fixed left-1/2 top-[92px] z-10 -translate-x-1/2 sm:top-[74px]">
        <div className="pointer-events-auto flex items-center gap-2.5 border-2 border-[#e2c672]/80 bg-[#072634]/90 px-3.5 py-1.5 shadow-[0_6px_16px_rgba(3,22,32,0.45)]">
          <span className="font-pixel text-[9px] tracking-wider text-[#f8da7c]">
            {locationLabel.toUpperCase()}
          </span>
          {currentIslandId && (
            <button
              type="button"
              onClick={() => onEnter2DMode(currentIslandId)}
              className="font-pixel border border-[#72c6c1]/70 bg-[#144c58] px-2 py-0.5 text-[8px] text-[#e7fbf7] transition-colors hover:bg-[#1f6c7a]"
            >
              SALAS 2D
            </button>
          )}
        </div>
      </div>

      {/* Aviso flotante de interacción cercana */}
      {nearbyTrigger && !controlsPaused && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 w-[min(92vw,420px)] -translate-x-1/2 sm:bottom-20">
          <button
            type="button"
            onClick={triggerInteract}
            className="pointer-events-auto flex w-full items-center justify-between gap-3 border-2 border-[#f4d47d] bg-[#072634]/95 px-4 py-2.5 text-left shadow-[0_10px_25px_rgba(2,20,28,0.55)] transition-transform hover:-translate-y-0.5"
          >
            <div className="min-w-0">
              <p className="font-pixel truncate text-[9px] text-[#f4d47d]">
                {nearbyTrigger.kind === 'piece'
                  ? 'PIEZA CERCANA'
                  : nearbyTrigger.kind === 'guestbook'
                    ? 'LIBRO DE VISITAS'
                    : nearbyTrigger.kind === 'support'
                      ? 'APOYO AL PROYECTO'
                      : 'ENTRADA DE ISLA'}
              </p>
              <p className="mt-1 truncate text-base font-bold text-[#fff9e6]">
                {nearbyTrigger.label}
              </p>
              <p className="truncate text-xs text-[#b9ded5]">{nearbyTrigger.sublabel}</p>
            </div>
            <span className="font-pixel shrink-0 border border-[#f4d47d] bg-[#b25f37] px-2.5 py-1.5 text-[8px] text-[#fff9e6]">
              ENTER
            </span>
          </button>
        </div>
      )}

      {/* Dock inferior plegable de cámara y controles */}
      <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-3 sm:bottom-5 sm:left-6 sm:right-6">
        <div className="pointer-events-auto grid grid-cols-3 gap-1 md:hidden">
          <div />
          <button
            type="button"
            aria-label="Caminar adelante"
            onPointerDown={() => holdKey('up', true)}
            onPointerUp={() => holdKey('up', false)}
            onPointerLeave={() => holdKey('up', false)}
            onPointerCancel={() => holdKey('up', false)}
            className="flex h-10 w-10 items-center justify-center border-2 border-white/60 bg-[#072938]/90 text-[#fff8e2] active:bg-[#b25f37]"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Caminar izquierda"
            onPointerDown={() => holdKey('left', true)}
            onPointerUp={() => holdKey('left', false)}
            onPointerLeave={() => holdKey('left', false)}
            onPointerCancel={() => holdKey('left', false)}
            className="flex h-10 w-10 items-center justify-center border-2 border-white/60 bg-[#072938]/90 text-[#fff8e2] active:bg-[#b25f37]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Caminar atrás"
            onPointerDown={() => holdKey('down', true)}
            onPointerUp={() => holdKey('down', false)}
            onPointerLeave={() => holdKey('down', false)}
            onPointerCancel={() => holdKey('down', false)}
            className="flex h-10 w-10 items-center justify-center border-2 border-white/60 bg-[#072938]/90 text-[#fff8e2] active:bg-[#b25f37]"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Caminar derecha"
            onPointerDown={() => holdKey('right', true)}
            onPointerUp={() => holdKey('right', false)}
            onPointerLeave={() => holdKey('right', false)}
            onPointerCancel={() => holdKey('right', false)}
            className="flex h-10 w-10 items-center justify-center border-2 border-white/60 bg-[#072938]/90 text-[#fff8e2] active:bg-[#b25f37]"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="pointer-events-auto mx-auto hidden flex-col items-center md:flex">
          {hudCollapsed ? (
            <button
              type="button"
              onClick={() => setHudCollapsed(false)}
              className="font-pixel inline-flex items-center gap-1.5 border-2 border-[#e2c672]/75 bg-[#072634]/90 px-3 py-1.5 text-[8px] text-[#fff8e2]"
            >
              <ChevronUp className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>CONTROLES Y CÁMARA (H)</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-2 border-[#e2c672]/75 bg-[#072634]/90 px-3 py-2 shadow-[0_8px_20px_rgba(3,20,28,0.45)]">
              <span className="inline-flex items-center gap-1.5 text-xs text-[#d6ede3]">
                <Camera className="h-3.5 w-3.5 text-[#f4d47d]" />
                <span>Cámara:</span>
              </span>

              {(
                [
                  ['cerca', 'Cerca'],
                  ['media', 'Media'],
                  ['panoramica', 'Panorámica'],
                ] as [CameraPreset, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyCameraPreset(id)}
                  className={`font-pixel border px-2.5 py-1 text-[8px] transition-colors ${
                    camPreset === id
                      ? 'border-[#f4d47d] bg-[#b25f37] text-[#fff9e6]'
                      : 'border-white/30 bg-[#0b394b] text-[#d6ede3] hover:bg-[#14556a]'
                  }`}
                >
                  {label}
                </button>
              ))}

              <button
                type="button"
                onClick={recenterCamera}
                title="Centrar cámara detrás del personaje (R)"
                className="font-pixel inline-flex items-center gap-1 border border-white/35 bg-[#0b394b] px-2.5 py-1 text-[8px] text-[#fff9e6] hover:bg-[#14556a]"
              >
                <RotateCcw className="h-3 w-3 text-[#f4d47d]" />
                <span>Detrás (R)</span>
              </button>

              <button
                type="button"
                onClick={() => setDofEnabled((prev) => !prev)}
                title="Alternar profundidad de campo / desenfoque de distancias (B)"
                className={`font-pixel inline-flex items-center gap-1 border px-2.5 py-1 text-[8px] transition-colors ${
                  dofEnabled
                    ? 'border-[#f4d47d] bg-[#1a5f6d] text-[#fff9e6]'
                    : 'border-white/30 bg-[#0b394b] text-[#b8d8ce] hover:bg-[#14556a]'
                }`}
              >
                <Aperture className="h-3 w-3 text-[#f4d47d]" />
                <span>Enfoque</span>
              </button>

              <span className="mx-1 hidden h-4 w-px bg-white/20 lg:inline-block" />

              <span className="hidden text-xs text-[#b9ded5] lg:inline">
                WASD / Flechas caminar (Shift correr) · Q/E girar · Espacio saltar · Enter abrir
              </span>

              <button
                type="button"
                onClick={() => setHudCollapsed(true)}
                aria-label="Ocultar barra inferior"
                className="ml-1 border border-white/25 bg-black/25 p-1 text-[#d6ede3] hover:bg-[#14556a]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => {
              keysRef.current.jumpQueued = true;
            }}
            className="font-pixel border-2 border-white/65 bg-[#072938]/90 px-3 py-2.5 text-[9px] text-[#fff8e2] active:bg-[#1f6c7a]"
          >
            SALTAR
          </button>
          <button
            type="button"
            onClick={triggerInteract}
            className="font-pixel inline-flex items-center gap-1 border-2 border-[#f4d47d] bg-[#b25f37]/95 px-3 py-2.5 text-[9px] text-[#fff9e6]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>ABRIR</span>
          </button>
          <button
            type="button"
            onClick={recenterCamera}
            aria-label="Centrar cámara"
            className="border-2 border-white/60 bg-[#072938]/90 p-2.5 text-[#f4d47d]"
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
