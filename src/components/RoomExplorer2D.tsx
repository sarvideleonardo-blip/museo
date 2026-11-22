import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Sun, Palette, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { retroAudio } from '../game/audio';
import {
  PlayableRoom,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  RoomInteractive,
  RoomNPC,
  TILE_SIZE,
  buildPlayableRoom,
} from '../game/roomBuilder';
import { PALETTE, spriteRenderer } from '../game/spriteRenderer';
import { CharacterId, Island, LightMode, MuseumPiece, MuseumThemeConfig, Room, ThemeId } from '../types/museum';

interface RoomExplorer2DProps {
  island: Island;
  rooms: Room[];
  initialRoomId: string;
  piecesByRoom: Record<string, MuseumPiece[]>;
  characterId?: CharacterId;
  theme?: MuseumThemeConfig;
  discoveredCount: number;
  totalMuseumPieces: number;
  isModalOpen: boolean;
  onOpenPiece: (piece: MuseumPiece) => void;
  onOpenSign: (title: string, content: string) => void;
  onOpenGuestbook?: (island: Island, room: Room) => void;
  onOpenOriginMuseum?: (url: string, sourceMuseumId?: string) => void;
  onExitToArchipelago: () => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface NearbyTarget {
  kind: 'npc' | 'interactive';
  x: number;
  y: number;
  npc?: RoomNPC;
  interactive?: RoomInteractive;
}

const CANVAS_W = 256;
const CANVAS_H = 224;
const HUD_H = 48;
const PLAY_H = 176;

export const RoomExplorer2D: React.FC<RoomExplorer2DProps> = ({
  island,
  rooms,
  initialRoomId,
  piecesByRoom,
  characterId = 'explorador',
  theme,
  discoveredCount,
  totalMuseumPieces,
  isModalOpen,
  onOpenPiece,
  onOpenSign,
  onOpenGuestbook,
  onOpenOriginMuseum,
  onExitToArchipelago,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState(initialRoomId);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (theme?.roomThemeId) {
      spriteRenderer.setTheme(theme.roomThemeId);
      return theme.roomThemeId;
    }
    return spriteRenderer.currentThemeName;
  });
  const [lightMode, setLightMode] = useState<LightMode>(spriteRenderer.lightMode);
  const [isMuted, setIsMuted] = useState<boolean>(retroAudio.muted);
  const [visitedRoomIds, setVisitedRoomIds] = useState<Set<string>>(() => new Set([initialRoomId]));
  const characterIdRef = useRef<CharacterId>(characterId);
  characterIdRef.current = characterId;

  useEffect(() => {
    if (theme?.roomThemeId) {
      spriteRenderer.setTheme(theme.roomThemeId);
      setThemeId(theme.roomThemeId);
    }
  }, [theme?.roomThemeId]);

  // Estado mutable en refs para el bucle a 60fps sin re-montar
  const keysRef = useRef<Record<string, boolean>>({});
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  const playableRoomRef = useRef<PlayableRoom | null>(null);
  const playerRef = useRef({
    x: 7.5 * TILE_SIZE,
    y: 8.2 * TILE_SIZE,
    dir: 'up' as Direction,
    walkFrame: 0,
    walkTimer: 0,
    targetPos: null as { x: number; y: number } | null,
    nearby: null as NearbyTarget | null,
  });

  const transitionRef = useRef<{
    active: boolean;
    dir: 'north' | 'south' | 'east' | 'west';
    progress: number;
    duration: number;
    fromRoom: PlayableRoom | null;
    toRoom: PlayableRoom | null;
    targetRoomId: string;
    spawn: { x: number; y: number; dir: Direction };
  }>({
    active: false,
    dir: 'north',
    progress: 0,
    duration: 22,
    fromRoom: null,
    toRoom: null,
    targetRoomId: '',
    spawn: { x: 120, y: 120, dir: 'up' },
  });

  const bannerRef = useRef({ text: '', timer: 0 });

  // Construir la sala jugable cada vez que cambie la sala, piezas o isla
  useEffect(() => {
    const activeRoom = rooms.find((r) => r.id === currentRoomId) || rooms[0];
    if (!activeRoom) return;
    const pieces = piecesByRoom[activeRoom.id] || [];
    const built = buildPlayableRoom(island, rooms, activeRoom, pieces);
    playableRoomRef.current = built;
    bannerRef.current = { text: activeRoom.name.toUpperCase(), timer: 140 };
    setVisitedRoomIds((prev) => new Set(prev).add(activeRoom.id));
  }, [island, rooms, currentRoomId, piecesByRoom]);

  // Posición inicial del jugador al entrar al modo 2D
  useEffect(() => {
    const built = playableRoomRef.current;
    if (built) {
      playerRef.current.x = built.defaultSpawn.x;
      playerRef.current.y = built.defaultSpawn.y;
      playerRef.current.dir = built.defaultSpawn.dir;
      playerRef.current.targetPos = null;
    }
  }, []);

  const showRoomHelp = () => {
    onOpenSign(
      `EXPLORACIÓN 2D · ${island.title}`,
      `Camina con las flechas o WASD (o tocando el suelo).\nAcércate a un pedestal, cuadro, máquina o personaje y pulsa [Enter], [Z] o [Espacio] para abrir la obra.\n\nAtajos:\n• [L] Alternar iluminación de antorchas\n• [P] Cambiar paleta retro\n• Portal turquesa del sur: volver al archipiélago`
    );
  };

  const triggerInteraction = () => {
    const target = playerRef.current.nearby;
    if (!target) return;

    if (target.kind === 'npc' && target.npc?.piece) {
      retroAudio.playInteract();
      onOpenPiece(target.npc.piece);
      return;
    }

    if (target.kind === 'interactive' && target.interactive) {
      const item = target.interactive;
      if (item.type === 'guestbook') {
        retroAudio.playInteract();
        const activeRoomObj = rooms.find((r) => r.id === currentRoomId) || rooms[0];
        if (activeRoomObj) {
          onOpenGuestbook?.(island, activeRoomObj);
        }
      } else if (item.type === 'sign' && item.signText) {
        retroAudio.playInteract();
        onOpenSign(item.title, item.signText);
      } else if (item.piece) {
        if (item.type === 'fountain') retroAudio.playFountain();
        else retroAudio.playInteract();
        onOpenPiece(item.piece);
      }
    }
  };

  const switchRoomImmediate = (targetRoomId: string) => {
    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    if (!targetRoom) return;
    retroAudio.playDoor();
    setCurrentRoomId(targetRoomId);
    playerRef.current.x = 7.5 * TILE_SIZE;
    playerRef.current.y = 8.2 * TILE_SIZE;
    playerRef.current.dir = 'up';
    playerRef.current.targetPos = null;
  };

  // Eventos de teclado en modo 2D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpenRef.current) return;

      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;

      if (e.code === 'KeyL') {
        const nextLight = spriteRenderer.toggleLighting();
        setLightMode(nextLight);
        const label =
          nextLight === 'auto' ? 'AUTOMÁTICA' : nextLight === 'on' ? 'ENCENDIDA' : 'APAGADA';
        bannerRef.current = { text: `LUZ: ${label}`, timer: 110 };
        retroAudio.playTone(660, 'triangle', 0.08, 0.14);
      } else if (e.code === 'KeyP') {
        const nextT = spriteRenderer.nextTheme();
        setThemeId(nextT);
        bannerRef.current = { text: `TEMA: ${nextT.toUpperCase()}`, timer: 110 };
        retroAudio.playTone(880, 'triangle', 0.08, 0.16);
      } else if (e.code === 'KeyM') {
        setIsMuted(retroAudio.toggleMute());
      } else if (e.code === 'KeyB') {
        showRoomHelp();
      } else if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'Space') {
        triggerInteraction();
      } else if (e.code === 'Escape') {
        onExitToArchipelago();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  });

  // Bucle principal de 60 FPS
  useEffect(() => {
    let rafId = 0;
    let animTick = 0;

    const checkCollision = (nx: number, ny: number, room: PlayableRoom): boolean => {
      const left = nx + 3;
      const right = left + 10;
      const top = ny + 6;
      const bottom = top + 9;

      for (const door of room.doors) {
        if (
          right > door.rect.x &&
          left < door.rect.x + door.rect.w &&
          bottom > door.rect.y &&
          top < door.rect.y + door.rect.h
        ) {
          return false;
        }
      }

      if (left < 0 || right > ROOM_WIDTH * TILE_SIZE || top < 0 || bottom > ROOM_HEIGHT * TILE_SIZE) {
        return true;
      }

      const startX = Math.floor(left / TILE_SIZE);
      const endX = Math.floor(right / TILE_SIZE);
      const startY = Math.floor(top / TILE_SIZE);
      const endY = Math.floor(bottom / TILE_SIZE);

      for (let ty = startY; ty <= endY; ty++) {
        for (let tx = startX; tx <= endX; tx++) {
          const ch = room.layout[ty]?.[tx];
          if (ch && room.solidTiles.includes(ch)) return true;
        }
      }

      for (const npc of room.npcs) {
        if (
          right > npc.x + 2 &&
          left < npc.x + 14 &&
          bottom > npc.y + 2 &&
          top < npc.y + 15
        ) {
          return true;
        }
      }

      for (const item of room.interactives) {
        if (
          right > item.x + 2 &&
          left < item.x + 14 &&
          bottom > item.y + 4 &&
          top < item.y + 15
        ) {
          return true;
        }
      }

      return false;
    };

    const renderSingleRoom = (
      ctx: CanvasRenderingContext2D,
      room: PlayableRoom,
      tick: number,
      nearby: NearbyTarget | null
    ) => {
      const ui = spriteRenderer.getUiPalette();
      ctx.fillStyle = room.isOutdoor ? spriteRenderer.palette.cesped[0] : ui.TEAL_OSCURO;
      ctx.fillRect(0, 0, CANVAS_W, PLAY_H);

      for (let row = 0; row < ROOM_HEIGHT; row++) {
        const line = room.layout[row];
        if (!line) continue;
        for (let col = 0; col < ROOM_WIDTH; col++) {
          const ch = line[col];
          const tileType = room.tileMap[ch] || 'dungeon_floor';
          spriteRenderer.renderTile(ctx, tileType, col * TILE_SIZE, row * TILE_SIZE, tick);
        }
      }

      spriteRenderer.renderTorches(ctx, room.torches, tick);

      for (const npc of room.npcs) {
        spriteRenderer.renderNPC(ctx, npc.x, npc.y, npc.type);
        if (nearby?.kind === 'npc' && nearby.npc?.id === npc.id) {
          spriteRenderer.renderSparkle(ctx, npc.x, npc.y - 6, tick);
        }
      }

      for (const item of room.interactives) {
        if (item.type === 'pedestal' || item.type === 'link_item') {
          spriteRenderer.drawVoxelPedestal(ctx, item.x, item.y, tick);
        } else if (item.type === 'painting') {
          spriteRenderer.drawVoxelPainting(ctx, item.x, item.y);
        } else if (item.type === 'arcade') {
          spriteRenderer.drawVoxelArcade(ctx, item.x, item.y, tick);
        } else if (item.type === 'sign') {
          spriteRenderer.drawVoxelSign(ctx, item.x, item.y);
        } else if (item.type === 'guestbook') {
          spriteRenderer.drawVoxelGuestbook(ctx, item.x, item.y, tick);
        }
        if (nearby?.kind === 'interactive' && nearby.interactive?.id === item.id) {
          spriteRenderer.renderSparkle(ctx, item.x, item.y - 6, tick);
        }
      }

      spriteRenderer.particles.render(ctx);
    };

    const renderHUD = (
      ctx: CanvasRenderingContext2D,
      room: PlayableRoom,
      nearby: NearbyTarget | null,
      tick: number
    ) => {
      const blinkOn = Math.floor(tick / 16) % 2 === 0;
      ctx.fillStyle = PALETTE.NEGRO;
      ctx.fillRect(0, 0, CANVAS_W, HUD_H);
      ctx.fillStyle = PALETTE.TEAL_OSCURO;
      ctx.fillRect(0, HUD_H - 2, CANVAS_W, 2);

      // Minimapa de salas de la isla actual
      ctx.fillStyle = '#141c22';
      ctx.fillRect(6, 5, 56, 36);
      ctx.strokeStyle = PALETTE.TEAL;
      ctx.lineWidth = 1;
      ctx.strokeRect(5.5, 4.5, 57, 37);

      const cols = Math.min(4, Math.max(1, rooms.length));
      rooms.slice(0, 8).forEach((r, idx) => {
        const gx = idx % 4;
        const gy = Math.floor(idx / 4);
        const rx = 10 + gx * 12;
        const ry = 10 + gy * 14;
        const isCurrent = r.id === room.id;
        const isVisited = visitedRoomIds.has(r.id);

        if (isCurrent) {
          ctx.fillStyle = blinkOn ? PALETTE.BLANCO : PALETTE.TEAL_CLARO;
        } else if (isVisited) {
          ctx.fillStyle = PALETTE.TEAL;
        } else {
          ctx.fillStyle = '#2a3338';
        }
        ctx.fillRect(rx, ry, cols === 1 ? 18 : 10, 10);
      });

      // Botón B (Info)
      ctx.fillStyle = PALETTE.NEGRO;
      ctx.fillRect(70, 8, 32, 30);
      ctx.strokeStyle = PALETTE.ROPA_AZUL;
      ctx.strokeRect(70.5, 8.5, 31, 29);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.BLANCO;
      ctx.textAlign = 'center';
      ctx.fillText('B', 86, 20);
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.GRIS;
      ctx.fillText('INFO', 86, 32);

      // Botón A (Contextual)
      let aLabel = '---';
      if (nearby) {
        if (nearby.kind === 'npc') aLabel = 'HABLAR';
        else if (nearby.interactive?.type === 'fountain') aLabel = 'AGUA';
        else if (nearby.interactive?.type === 'painting') aLabel = 'VER';
        else if (nearby.interactive?.type === 'arcade') aLabel = 'JUGAR';
        else if (nearby.interactive?.type === 'link_item') aLabel = 'LINK';
        else if (nearby.interactive?.type === 'guestbook') aLabel = 'FIRMAR';
        else aLabel = 'LEER';
      }
      ctx.fillStyle = PALETTE.NEGRO;
      ctx.fillRect(108, 8, 34, 30);
      ctx.strokeStyle = nearby ? PALETTE.DORADO : PALETTE.ROPA_AZUL;
      ctx.strokeRect(108.5, 8.5, 33, 29);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = nearby ? PALETTE.DORADO : PALETTE.BLANCO;
      ctx.fillText('A', 125, 20);
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = nearby ? PALETTE.BLANCO : PALETTE.GRIS;
      ctx.fillText(aLabel, 125, 32);

      // -VIDA- y corazones
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.CORAZON;
      ctx.textAlign = 'left';
      ctx.fillText('-VIDA-', 152, 14);
      for (let i = 0; i < 3; i++) {
        spriteRenderer.renderHeart(ctx, 152 + i * 10, 18, true);
      }

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.DORADO;
      ctx.fillText(`OBRAS ${discoveredCount}/${totalMuseumPieces}`, 152, 38);

      // Estado de audio
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(212, 4, 38, 14);
      ctx.strokeStyle = isMuted ? '#E83838' : '#3CBCFC';
      ctx.strokeRect(212.5, 4.5, 37, 13);
      ctx.font = '6px monospace';
      ctx.fillStyle = isMuted ? '#E83838' : '#3CBCFC';
      ctx.textAlign = 'center';
      ctx.fillText(isMuted ? 'VOL:OFF' : 'VOL:ON', 231, 13);
    };

    const tickLoop = () => {
      animTick += 1;
      if (bannerRef.current.timer > 0) bannerRef.current.timer -= 1;

      const room = playableRoomRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (room && ctx) {
        ctx.imageSmoothingEnabled = false;

        if (transitionRef.current.active) {
          transitionRef.current.progress += 1;
          if (transitionRef.current.progress >= transitionRef.current.duration) {
            const { targetRoomId, spawn } = transitionRef.current;
            transitionRef.current.active = false;
            setCurrentRoomId(targetRoomId);
            playerRef.current.x = spawn.x;
            playerRef.current.y = spawn.y;
            playerRef.current.dir = spawn.dir;
            playerRef.current.targetPos = null;
            spriteRenderer.particles.reset();
          }
        } else if (!isModalOpenRef.current) {
          // Movimiento del jugador
          const p = playerRef.current;
          const keys = keysRef.current;
          let dx = 0;
          let dy = 0;

          if (keys.ArrowUp || keys.KeyW) {
            dy -= 1;
            p.dir = 'up';
            p.targetPos = null;
          } else if (keys.ArrowDown || keys.KeyS) {
            dy += 1;
            p.dir = 'down';
            p.targetPos = null;
          } else if (keys.ArrowLeft || keys.KeyA) {
            dx -= 1;
            p.dir = 'left';
            p.targetPos = null;
          } else if (keys.ArrowRight || keys.KeyD) {
            dx += 1;
            p.dir = 'right';
            p.targetPos = null;
          }

          if (p.targetPos && dx === 0 && dy === 0) {
            const distX = p.targetPos.x - (p.x + 8);
            const distY = p.targetPos.y - (p.y + 12);
            const dist = Math.hypot(distX, distY);
            if (dist > 3) {
              if (Math.abs(distX) > Math.abs(distY)) {
                dx = Math.sign(distX);
                p.dir = dx > 0 ? 'right' : 'left';
              } else {
                dy = Math.sign(distY);
                p.dir = dy > 0 ? 'down' : 'up';
              }
            } else {
              p.targetPos = null;
            }
          }

          if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
          }

          if (dx !== 0 || dy !== 0) {
            const speed = 1.65;
            const nx = p.x + dx * speed;
            const ny = p.y + dy * speed;
            if (!checkCollision(nx, p.y, room)) p.x = nx;
            if (!checkCollision(p.x, ny, room)) p.y = ny;

            p.walkTimer += 1;
            if (p.walkTimer >= 8) {
              p.walkFrame = p.walkFrame === 0 ? 1 : 0;
              p.walkTimer = 0;
              if (p.walkFrame === 0) retroAudio.playStep();
            }
          } else {
            p.walkFrame = 0;
            p.walkTimer = 0;
          }

          // Detectar proximidad a interactivos / NPCs
          const cx = p.x + 8;
          const cy = p.y + 8;
          let closestDist = 28;
          let nearby: NearbyTarget | null = null;

          for (const npc of room.npcs) {
            const d = Math.hypot(cx - (npc.x + 8), cy - (npc.y + 8));
            if (d < closestDist) {
              closestDist = d;
              nearby = { kind: 'npc', x: npc.x, y: npc.y, npc };
            }
          }

          for (const item of room.interactives) {
            const radius = item.triggerRadius || 25;
            const d = Math.hypot(cx - (item.x + 8), cy - (item.y + 8));
            if (d < radius && d < closestDist) {
              closestDist = d;
              nearby = { kind: 'interactive', x: item.x, y: item.y, interactive: item };
            }
          }
          p.nearby = nearby;

          // Verificar puertas
          const footX = p.x + 8;
          const footY = p.y + 12;
          for (const door of room.doors) {
            if (
              footX >= door.rect.x &&
              footX <= door.rect.x + door.rect.w &&
              footY >= door.rect.y &&
              footY <= door.rect.y + door.rect.h
            ) {
              if (door.action === 'archipelago') {
                retroAudio.playDoor();
                onExitToArchipelago();
                return;
              } else if (door.action === 'room' && door.targetRoomId) {
                const targetRoomObj = rooms.find((r) => r.id === door.targetRoomId);
                if (targetRoomObj) {
                  retroAudio.playDoor();
                  const nextBuilt = buildPlayableRoom(
                    island,
                    rooms,
                    targetRoomObj,
                    piecesByRoom[targetRoomObj.id] || []
                  );
                  transitionRef.current = {
                    active: true,
                    dir: door.direction,
                    progress: 0,
                    duration: 22,
                    fromRoom: room,
                    toRoom: nextBuilt,
                    targetRoomId: targetRoomObj.id,
                    spawn:
                      door.direction === 'north'
                        ? { x: 1.5 * TILE_SIZE, y: 5.5 * TILE_SIZE, dir: 'right' }
                        : { x: 7.5 * TILE_SIZE, y: 1.5 * TILE_SIZE, dir: 'down' },
                  };
                }
              }
              break;
            }
          }

          // Actualizar partículas ambientales
          spriteRenderer.particles.update(room, room.torches, spriteRenderer.palette);
        }

        // Renderizado completo
        ctx.fillStyle = PALETTE.NEGRO;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, HUD_H, CANVAS_W, PLAY_H);
        ctx.clip();

        if (transitionRef.current.active && transitionRef.current.fromRoom && transitionRef.current.toRoom) {
          const t = transitionRef.current.progress / transitionRef.current.duration;
          const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          let ox = 0;
          let oy = 0;
          if (transitionRef.current.dir === 'north') oy = ease * PLAY_H;
          if (transitionRef.current.dir === 'south') oy = -ease * PLAY_H;
          if (transitionRef.current.dir === 'west') ox = ease * CANVAS_W;
          if (transitionRef.current.dir === 'east') ox = -ease * CANVAS_W;

          ctx.save();
          ctx.translate(ox, HUD_H + oy);
          renderSingleRoom(ctx, transitionRef.current.fromRoom, animTick, null);
          ctx.restore();

          ctx.save();
          let tx = ox;
          let ty = oy;
          if (transitionRef.current.dir === 'north') ty -= PLAY_H;
          if (transitionRef.current.dir === 'south') ty += PLAY_H;
          if (transitionRef.current.dir === 'west') tx -= CANVAS_W;
          if (transitionRef.current.dir === 'east') tx += CANVAS_W;
          ctx.translate(tx, HUD_H + ty);
          renderSingleRoom(ctx, transitionRef.current.toRoom, animTick, null);
          ctx.restore();
        } else {
          ctx.translate(0, HUD_H);
          renderSingleRoom(ctx, room, animTick, playerRef.current.nearby);
          spriteRenderer.renderPlayer(
            ctx,
            playerRef.current.x,
            playerRef.current.y,
            playerRef.current.dir,
            playerRef.current.walkFrame,
            characterIdRef.current
          );
          spriteRenderer.renderLighting(
            ctx,
            CANVAS_W,
            PLAY_H,
            playerRef.current,
            room,
            room.torches,
            animTick
          );

          // Bocadillo de interacción
          if (playerRef.current.nearby && !isModalOpenRef.current) {
            const t = playerRef.current.nearby;
            const px = Math.floor(t.x + 8);
            const py = Math.floor(t.y - 8);
            const ui = spriteRenderer.getUiPalette();
            ctx.fillStyle = ui.NEGRO;
            ctx.fillRect(px - 15, py - 4, 30, 10);
            ctx.strokeStyle = ui.BLANCO;
            ctx.strokeRect(px - 14.5, py - 3.5, 29, 9);
            ctx.font = '5px "Press Start 2P", monospace';
            ctx.fillStyle = ui.DORADO;
            ctx.textAlign = 'center';
            ctx.fillText('▼ [Z]', px, py + 3.5);
          }

          // Banner temporal del nombre de sala
          if (bannerRef.current.timer > 0 && bannerRef.current.text) {
            const alpha = bannerRef.current.timer < 25 ? bannerRef.current.timer / 25 : 1;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = PALETTE.NEGRO;
            ctx.fillRect(0, 0, CANVAS_W, 20);
            ctx.fillStyle = PALETTE.TEAL;
            ctx.fillRect(0, 18, CANVAS_W, 2);
            ctx.fillStyle = PALETTE.DORADO;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillText(bannerRef.current.text.slice(0, 28), CANVAS_W / 2, 10);
            ctx.restore();
          }
          ctx.translate(0, -HUD_H);
        }

        ctx.restore();

        renderHUD(ctx, room, playerRef.current.nearby, animTick);
      }

      rafId = window.requestAnimationFrame(tickLoop);
    };

    rafId = window.requestAnimationFrame(tickLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, [rooms, island, piecesByRoom, discoveredCount, totalMuseumPieces, isMuted, visitedRoomIds, onExitToArchipelago]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    if (cy < HUD_H) {
      if (cx >= 70 && cx <= 102) showRoomHelp();
      else if (cx >= 108 && cx <= 142) triggerInteraction();
      else if (cx >= 212 && cx <= 250) setIsMuted(retroAudio.toggleMute());
      return;
    }

    const playY = cy - HUD_H;
    const nearby = playerRef.current.nearby;
    if (nearby && Math.hypot(cx - (nearby.x + 8), playY - (nearby.y + 8)) < 24) {
      triggerInteraction();
      return;
    }

    playerRef.current.targetPos = { x: cx, y: playY };
  };

  const bindVirtualKey = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      keysRef.current[code] = true;
    },
    onPointerUp: () => {
      keysRef.current[code] = false;
    },
    onPointerLeave: () => {
      keysRef.current[code] = false;
    },
    onPointerCancel: () => {
      keysRef.current[code] = false;
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#031c29] text-[#f8f4dd]">
      {/* Barra superior del modo 2D */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1c875]/30 bg-[#062433] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitToArchipelago}
            className="font-pixel inline-flex min-h-[44px] items-center gap-2 border-2 border-[#e1c875] bg-[#174d58] px-3 py-2 text-[9px] text-[#fff9e6] transition-colors hover:bg-[#b25f37] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>ARCHIPIÉLAGO</span>
          </button>
          <div className="min-w-0">
            <p className="font-pixel truncate text-[9px] text-[#f4d47d]">{island.title.toUpperCase()}</p>
            <p className="truncate text-sm text-[#cfe5dc]">
              {rooms.find((r) => r.id === currentRoomId)?.name || 'Sala'}
            </p>
          </div>
        </div>

        {/* Selector rápido de salas si la isla tiene varias */}
        {rooms.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => switchRoomImmediate(room.id)}
                className={`whitespace-nowrap shrink-0 border px-2.5 py-1 text-xs transition-colors ${
                  room.id === currentRoomId
                    ? 'border-[#f2d17b] bg-[#d6b85d] font-bold text-[#15313b]'
                    : 'border-white/25 bg-white/5 text-[#d7ebe2] hover:bg-white/15'
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {onOpenGuestbook && (
            <button
              type="button"
              onClick={() => {
                const activeRoomObj = rooms.find((r) => r.id === currentRoomId) || rooms[0];
                if (activeRoomObj) onOpenGuestbook(island, activeRoomObj);
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 border border-[#f2d17b] bg-[#b25f37] px-2.5 py-1.5 text-xs font-semibold text-[#fff9e6] hover:bg-[#174d58] whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#f4d47d]" />
              <span>Visitas</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const nextL = spriteRenderer.toggleLighting();
              setLightMode(nextL);
            }}
            title="Alternar luz [L]"
            className="inline-flex min-h-[44px] items-center gap-1.5 border border-white/40 bg-[#0d3545] px-2.5 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58] whitespace-nowrap"
          >
            <Sun className="h-3.5 w-3.5 text-[#f4d47d]" />
            <span>Luz: {lightMode}</span>
          </button>
          <button
            type="button"
            onClick={() => setThemeId(spriteRenderer.nextTheme())}
            title="Cambiar paleta [P]"
            className="inline-flex min-h-[44px] items-center gap-1.5 border border-white/40 bg-[#0d3545] px-2.5 py-1.5 text-xs text-[#fff5d7] hover:bg-[#174d58] whitespace-nowrap"
          >
            <Palette className="h-3.5 w-3.5 text-[#75e4dc]" />
            <span className="hidden sm:inline">{themeId}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMuted(retroAudio.toggleMute())}
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/40 bg-[#0d3545] p-1.5 text-[#fff5d7] hover:bg-[#174d58]"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-[#e87967]" /> : <Volume2 className="h-4 w-4 text-[#75e4dc]" />}
          </button>
          <button
            type="button"
            onClick={showRoomHelp}
            aria-label="Ayuda de controles"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/40 bg-[#0d3545] p-1.5 text-[#fff5d7] hover:bg-[#174d58]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Banner fijo superior si es una Isla Prestada */}
      {island.loaned && (() => {
        const originHref =
          island.loaned.sourceMuseumUrl ||
          (island.loaned.sourceMuseumId
            ? `?museum=${encodeURIComponent(island.loaned.sourceMuseumId)}`
            : '#');
        const isExternal = /^https?:\/\//i.test(originHref);
        return (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-white/25 bg-[#0b3140]/95 px-4 py-1.5 text-xs text-[#edf5f7]">
            <span>
              Sala prestada por{' '}
              <strong className="text-[#fff9e6]">{island.loaned.sourceMuseumTitle}</strong>
              {island.loaned.sourceAuthorName ? ` (${island.loaned.sourceAuthorName})` : ''}
            </span>
            <a
              href={originHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              onClick={(e) => {
                if (
                  onOpenOriginMuseum &&
                  !isExternal &&
                  (island.loaned?.sourceMuseumId || originHref.startsWith('?museum='))
                ) {
                  e.preventDefault();
                  onOpenOriginMuseum(originHref, island.loaned?.sourceMuseumId);
                }
              }}
              className="border border-white/55 bg-white/10 px-2.5 py-0.5 font-semibold text-[#f4d47d] transition-colors hover:border-[#f4d47d] hover:bg-white/20"
            >
              → Visitar museo original
            </a>
          </div>
        );
      })()}

      {/* Lienzo central 2D */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
        <div
          className={`relative aspect-[256/224] h-full max-h-[calc(100vh-140px)] w-auto max-w-full border-4 border-[#e1c875] bg-black shadow-[0_24px_65px_rgba(0,0,0,0.75)] ${
            island.loaned ? 'isla-prestada-sala' : ''
          }`}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={handleCanvasPointerDown}
            className="pixelated block h-full w-full cursor-pointer touch-none"
          />
        </div>

        {/* Controles táctiles para móvil */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between md:hidden">
          <div className="pointer-events-auto grid grid-cols-3 gap-1 bg-[#052836]/80 p-1.5 border border-white/30">
            <span />
            <button
              type="button"
              {...bindVirtualKey('ArrowUp')}
              aria-label="Subir"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/45 bg-[#07414f] text-base font-bold text-white touch-manipulation"
            >
              ▲
            </button>
            <span />
            <button
              type="button"
              {...bindVirtualKey('ArrowLeft')}
              aria-label="Izquierda"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/45 bg-[#07414f] text-base font-bold text-white touch-manipulation"
            >
              ◀
            </button>
            <button
              type="button"
              {...bindVirtualKey('ArrowDown')}
              aria-label="Bajar"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/45 bg-[#07414f] text-base font-bold text-white touch-manipulation"
            >
              ▼
            </button>
            <button
              type="button"
              {...bindVirtualKey('ArrowRight')}
              aria-label="Derecha"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/45 bg-[#07414f] text-base font-bold text-white touch-manipulation"
            >
              ▶
            </button>
          </div>

          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              onClick={showRoomHelp}
              aria-label="Información de sala (B)"
              className="font-pixel flex min-h-[44px] min-w-[44px] h-12 w-12 items-center justify-center rounded-full border-2 border-white/60 bg-[#07414f]/90 text-xs text-white touch-manipulation"
            >
              B
            </button>
            <button
              type="button"
              onClick={triggerInteraction}
              aria-label="Interactuar o examinar obra (A)"
              className="font-pixel flex min-h-[44px] min-w-[44px] h-12 w-12 items-center justify-center rounded-full border-2 border-[#f2d17b] bg-[#b25f37]/90 text-xs text-white touch-manipulation"
            >
              A
            </button>
          </div>
        </div>
      </div>

      {/* Pie discreto con instrucciones reales */}
      <footer className="hidden items-center justify-center gap-4 border-t border-white/10 bg-[#051d29] px-4 py-2 text-xs text-[#9dc4ba] sm:flex">
        <span>Flechas o WASD para caminar</span>
        <span aria-hidden="true">·</span>
        <span>Enter / Z o clic para inspeccionar obras</span>
        <span aria-hidden="true">·</span>
        <span>Camina al portal turquesa inferior para volver al archipiélago</span>
      </footer>
    </div>
  );
};
