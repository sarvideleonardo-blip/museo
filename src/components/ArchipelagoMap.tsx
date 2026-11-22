import React, { useEffect, useMemo, useRef, useState } from 'react';
import { spriteRenderer } from '../game/spriteRenderer';
import { CharacterId, Island, MuseumThemeConfig } from '../types/museum';
import { IslandArtworkSvg, buildBridgePaths } from './IslandArtworkSvg';

interface ArchipelagoMapProps {
  islands: Island[];
  roomCounts: Record<string, number>;
  pieceCounts: Record<string, number>;
  selectedIslandId: string | null;
  characterId?: CharacterId;
  theme?: MuseumThemeConfig;
  controlsPaused: boolean;
  onSelectIsland: (islandId: string) => void;
  onOpenOriginMuseum?: (url: string, sourceMuseumId?: string) => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

export const ArchipelagoMap: React.FC<ArchipelagoMapProps> = ({
  islands,
  roomCounts,
  pieceCounts,
  selectedIslandId,
  characterId = 'explorador',
  theme,
  controlsPaused,
  onSelectIsland,
  onOpenOriginMuseum,
}) => {
  const [zoom, setZoom] = useState(1);
  const [nearbyIslandId, setNearbyIslandId] = useState<string | null>(null);
  const [avatarPos, setAvatarPos] = useState<{ x: number; y: number }>({ x: 50.5, y: 70 });

  const heldDirectionsRef = useRef<Set<Direction>>(new Set());
  const avatarPosRef = useRef<{ x: number; y: number }>({ x: 50.5, y: 70 });
  const targetPosRef = useRef<{ x: number; y: number } | null>(null);
  const directionRef = useRef<Direction>('down');
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTokenRef = useRef<string>('');
  const controlsPausedRef = useRef(controlsPaused);
  controlsPausedRef.current = controlsPaused;

  const nearbyRef = useRef<string | null>(null);
  const islandsRef = useRef(islands);
  islandsRef.current = islands;
  const characterIdRef = useRef<CharacterId>(characterId);
  characterIdRef.current = characterId;

  const bridges = useMemo(() => buildBridgePaths(islands), [islands]);

  const drawAvatar = (moving: boolean, now: number) => {
    const canvas = spriteCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frame = moving ? Math.floor(now / 135) % 2 : 0;
    const token = `${characterIdRef.current}:${directionRef.current}:${frame}`;
    if (token === lastTokenRef.current) return;
    lastTokenRef.current = token;
    ctx.clearRect(0, 0, 16, 16);
    spriteRenderer.renderPlayer(ctx, 0, 0, directionRef.current, frame, characterIdRef.current);
  };

  // Dibujar sprite inicial y redibujar al cambiar de personaje
  useEffect(() => {
    lastTokenRef.current = '';
    drawAvatar(false, 0);
  }, [characterId]);

  // Calcular isla cercana según distancia en pantalla
  const computeNearby = (pos: { x: number; y: number }) => {
    let nearest: string | null = null;
    let bestDist = Infinity;

    for (const isl of islandsRef.current) {
      const dx = ((pos.x - isl.x) * window.innerWidth) / 100;
      const dy = ((pos.y - isl.y) * window.innerHeight) / 100;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = isl.id;
      }
    }

    const found = bestDist < 105 ? nearest : null;
    if (nearbyRef.current !== found) {
      nearbyRef.current = found;
      setNearbyIslandId(found);
    }
  };

  useEffect(() => {
    computeNearby(avatarPosRef.current);
  }, [islands]);

  // Teclado del explorador del archipiélago
  useEffect(() => {
    const keyDirs: Record<string, Direction> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (controlsPausedRef.current || ['input', 'textarea', 'select'].includes(tag || '')) {
        return;
      }
      const dir = keyDirs[e.code];
      if (dir) {
        e.preventDefault();
        targetPosRef.current = null;
        heldDirectionsRef.current.add(dir);
      } else if (e.code === 'Enter' && nearbyRef.current) {
        e.preventDefault();
        onSelectIsland(nearbyRef.current);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyDirs[e.code];
      if (dir) {
        heldDirectionsRef.current.delete(dir);
      }
    };

    const onBlur = () => {
      heldDirectionsRef.current.clear();
      targetPosRef.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [onSelectIsland]);

  // Bucle de movimiento suave del avatar en el mapa
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, (now - lastTime) / 1000 || 0);
      lastTime = now;

      if (!controlsPausedRef.current) {
        const held = heldDirectionsRef.current;
        let dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
        let dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);

        if (dx === 0 && dy === 0 && targetPosRef.current) {
          const tx = targetPosRef.current.x - avatarPosRef.current.x;
          const ty = targetPosRef.current.y - avatarPosRef.current.y;
          const dist = Math.hypot(tx, ty);
          if (dist > 1.2) {
            dx = tx / dist;
            dy = ty / dist;
          } else {
            targetPosRef.current = null;
          }
        }

        if (dx !== 0 || dy !== 0) {
          const mag = Math.hypot(dx, dy);
          dx /= mag;
          dy /= mag;
          const speedPx = 165 * dt;
          const nextX = Math.max(
            4,
            Math.min(96, avatarPosRef.current.x + (dx * speedPx * 100) / Math.max(320, window.innerWidth))
          );
          const nextY = Math.max(
            12,
            Math.min(90, avatarPosRef.current.y + (dy * speedPx * 100) / Math.max(320, window.innerHeight))
          );

          avatarPosRef.current = { x: nextX, y: nextY };
          if (Math.abs(dx) > Math.abs(dy)) {
            directionRef.current = dx < 0 ? 'left' : 'right';
          } else {
            directionRef.current = dy < 0 ? 'up' : 'down';
          }
          setAvatarPos({ x: nextX, y: nextY });
          drawAvatar(true, now);
          computeNearby(avatarPosRef.current);
        } else {
          drawAvatar(false, now);
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const bindWalkButton = (dir: Direction) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      targetPosRef.current = null;
      heldDirectionsRef.current.add(dir);
    },
    onPointerUp: () => heldDirectionsRef.current.delete(dir),
    onPointerLeave: () => heldDirectionsRef.current.delete(dir),
    onPointerCancel: () => heldDirectionsRef.current.delete(dir),
  });

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    targetPosRef.current = {
      x: Math.max(4, Math.min(96, clickX)),
      y: Math.max(12, Math.min(90, clickY)),
    };
  };

  const nearbyIsland = islands.find((i) => i.id === nearbyIslandId) || null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Viñeta sutil atmosférica */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 52%, transparent 34%, rgba(1, 24, 39, 0.34) 100%)',
        }}
      />

      {/* Capa escalable con SVG del mundo, islas dinámicas y explorador */}
      <div
        onClick={handleMapClick}
        className="absolute inset-0 origin-center transition-transform duration-200 ease-out"
        style={{ transform: `scale(${zoom.toFixed(2)})` }}
      >
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="Archipiélago de islas flotantes conectadas por puentes"
          className="block h-full w-full"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={theme?.skyColor || '#83d4d6'} />
              <stop offset=".55" stopColor={theme?.oceanColor || '#3db5c4'} />
              <stop offset="1" stopColor={theme?.surfaceColor || '#087b9a'} />
            </linearGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={theme?.oceanColor || '#16a6bb'} />
              <stop offset="1" stopColor={theme?.surfaceColor || '#03425f'} />
            </linearGradient>
            <linearGradient id="grass" x1="0" y1="0" x2=".9" y2="1">
              <stop stopColor="#b7df8a" />
              <stop offset=".55" stopColor="#65b65d" />
              <stop offset="1" stopColor="#2a8056" />
            </linearGradient>
            <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#e2f7f5" />
              <stop offset="1" stopColor="#75c5dd" />
            </linearGradient>
            <linearGradient id="sand" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#f6d48c" />
              <stop offset="1" stopColor="#c88e55" />
            </linearGradient>
            <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#e29b70" />
              <stop offset="1" stopColor="#713e47" />
            </linearGradient>
            <linearGradient id="volcano" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#4a2522" />
              <stop offset="1" stopColor="#1e1014" />
            </linearGradient>
            <linearGradient id="crypt" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#443b4f" />
              <stop offset="1" stopColor="#252033" />
            </linearGradient>
            <linearGradient id="coral" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#6ee2cb" />
              <stop offset="1" stopColor="#248f88" />
            </linearGradient>
            <pattern id="pixelDots" width="18" height="18" patternUnits="userSpaceOnUse">
              <rect x="2" y="3" width="3" height="3" fill="#d9f5d0" opacity=".32" />
              <rect x="11" y="12" width="2" height="2" fill="#e8f5c2" opacity=".28" />
            </pattern>
            <filter id="islandShadow" x="-30%" y="-30%" width="170%" height="190%">
              <feGaussianBlur stdDeviation="13" />
            </filter>
            <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="1440" height="900" fill="url(#sky)" />
          <path
            d="M0 255 Q210 190 420 244 T840 230 T1440 225 L1440 900 L0 900Z"
            fill="url(#sea)"
            opacity=".65"
          />
          <path
            d="M0 345 Q230 280 455 336 T920 318 T1440 335"
            fill="none"
            stroke="#c1eef0"
            strokeWidth="4"
            opacity=".2"
          />
          <path
            d="M0 425 Q230 365 455 415 T920 395 T1440 415"
            fill="none"
            stroke="#8de0e0"
            strokeWidth="3"
            opacity=".22"
          />
          <path
            d="M0 590 Q220 540 450 584 T900 570 T1440 585"
            fill="none"
            stroke="#a7e7df"
            strokeWidth="3"
            opacity=".18"
          />

          {/* Nubes pixeladas */}
          <g opacity=".75" fill="#e7f2df">
            <g transform="translate(75 110)">
              <rect x="28" y="23" width="90" height="27" />
              <rect x="8" y="36" width="130" height="20" />
              <rect x="42" y="4" width="56" height="30" />
              <rect x="18" y="24" width="28" height="23" />
              <rect x="110" y="22" width="38" height="25" />
            </g>
            <g transform="translate(560 75) scale(1.15)">
              <rect x="28" y="23" width="90" height="27" />
              <rect x="8" y="36" width="130" height="20" />
              <rect x="42" y="4" width="56" height="30" />
              <rect x="18" y="24" width="28" height="23" />
              <rect x="110" y="22" width="38" height="25" />
            </g>
            <g transform="translate(1130 140) scale(.9)">
              <rect x="28" y="23" width="90" height="27" />
              <rect x="8" y="36" width="130" height="20" />
              <rect x="42" y="4" width="56" height="30" />
              <rect x="18" y="24" width="28" height="23" />
              <rect x="110" y="22" width="38" height="25" />
            </g>
          </g>

          {/* Puentes dinámicos entre islas */}
          <g fill="none" strokeLinejoin="round" strokeLinecap="square">
            {bridges.map((b) => (
              <React.Fragment key={b.key}>
                <path d={b.d} stroke="#443a3b" strokeWidth="32" />
                <path d={b.d} stroke="#c29560" strokeWidth="22" />
                <path d={b.d} stroke="#f4d89d" strokeWidth="3" strokeDasharray="5 12" />
              </React.Fragment>
            ))}
          </g>

          {/* Islas dinámicas renderizadas por bioma y coordenada */}
          {islands.map((island) => (
            <IslandArtworkSvg
              key={island.id}
              biome={island.biome}
              cx={island.x * 14.4}
              cy={island.y * 9}
              scale={island.isOriginal ? 1 : 0.86}
              islandStyle={theme?.islandStyle}
            />
          ))}

          {/* Boyas y partículas de agua */}
          <g fill="#f9e6a8">
            <path d="M465 760l12-6 12 6-12 6Z" />
            <path d="M877 345l10-5 11 5-11 6Z" />
            <path d="M1270 540l12-6 12 6-12 6Z" />
            <path d="M80 460l10-5 10 5-10 6Z" />
          </g>
          <g fill="#e7f8df" opacity=".7">
            <circle cx="480" cy="250" r="4" />
            <circle cx="930" cy="470" r="3" />
            <circle cx="850" cy="750" r="4" />
            <circle cx="370" cy="515" r="3" />
            <circle cx="1300" cy="430" r="4" />
          </g>
        </svg>

        {/* Botones interactivos sobre cada isla */}
        {islands.map((island) => {
          const isNearby = nearbyIslandId === island.id;
          const isSelected = selectedIslandId === island.id;
          const rCount = roomCounts[island.id] || 0;
          const pCount = pieceCounts[island.id] || 0;
          const loaned = island.loaned;
          const originHref =
            loaned?.sourceMuseumUrl ||
            (loaned?.sourceMuseumId ? `?museum=${encodeURIComponent(loaned.sourceMuseumId)}` : '#');
          const isExternalUrl = /^https?:\/\//i.test(originHref);

          return (
            <div
              key={island.id}
              style={{ left: `${island.x}%`, top: `${island.y}%` }}
              className={`absolute z-10 flex min-w-[116px] -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
                loaned ? 'isla-prestada' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectIsland(island.id)}
                aria-label={`Abrir isla ${island.title}`}
                aria-pressed={isSelected}
                className={`group relative z-[2] cursor-pointer border-0 bg-transparent p-0 text-center text-white transition-transform duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                  isNearby || isSelected ? 'scale-105' : ''
                }`}
              >
                <span
                  className={`font-pixel block whitespace-pre-line text-[10px] leading-[1.6] sm:text-xs ${
                    isNearby
                      ? 'text-[#ffe8a2] [text-shadow:0_0_8px_#fff,0_0_18px_#ffca53]'
                      : island.id === 'patio'
                        ? 'text-[#fff5cb] [text-shadow:0_2px_3px_#173f4b,0_0_8px_rgba(0,0,0,0.65)]'
                        : 'text-white [text-shadow:0_2px_3px_#173f4b,0_0_8px_rgba(0,0,0,0.65)]'
                  }`}
                >
                  {island.mapLabel || island.title}
                </span>
                <span className="mt-1.5 inline-block border border-white/55 bg-[#022635]/80 px-2 py-0.5 text-[11px] text-[#e6f5ea] tabular-nums">
                  {pCount} piezas · {rCount} {rCount === 1 ? 'sala' : 'salas'}
                </span>
              </button>

              {loaned && (
                <a
                  href={originHref}
                  target={isExternalUrl ? '_blank' : undefined}
                  rel={isExternalUrl ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (onOpenOriginMuseum && !isExternalUrl && (loaned.sourceMuseumId || originHref.startsWith('?museum='))) {
                      e.preventDefault();
                      onOpenOriginMuseum(originHref, loaned.sourceMuseumId);
                    }
                  }}
                  className="enlace-origen"
                >
                  → Ver en {loaned.sourceMuseumTitle}
                </a>
              )}
            </div>
          );
        })}

        {/* Personaje explorador en el mapa */}
        <div
          aria-label="Personaje explorador"
          style={{
            left: `${avatarPos.x}%`,
            top: `${avatarPos.y}%`,
            filter: 'drop-shadow(0 5px 3px rgba(0, 28, 42, 0.45))',
          }}
          className="pointer-events-none absolute z-20 h-14 w-14 -translate-x-1/2 -translate-y-[84%] sm:h-16 sm:w-16"
        >
          <span className="font-pixel absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap border border-white/75 bg-[#052a37]/90 px-2 py-1 text-[8px] text-[#fff3c6]">
            {nearbyIsland
              ? `ENTER · ${nearbyIsland.title.slice(0, 20).toUpperCase()}`
              : 'FLECHAS PARA CAMINAR'}
          </span>
          <canvas
            ref={spriteCanvasRef}
            width={16}
            height={16}
            aria-hidden="true"
            className="pixelated block h-full w-full"
          />
        </div>
      </div>

      {/* Herramientas inferiores del mapa: Zoom y D-Pad táctil */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between">
        <div className="pointer-events-auto flex items-end gap-3">
          <div className="flex items-center gap-1 border border-white/45 bg-[#052836]/80 p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.15).toFixed(2)))}
              aria-label="Alejar mapa"
              className="flex h-8 min-w-[32px] items-center justify-center border border-white/50 bg-[#07414f] text-base font-bold text-[#fff7df] hover:bg-[#b36b43]"
            >
              −
            </button>
            <span className="font-pixel min-w-[44px] text-center text-[8px] text-[#fff1c6] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.85, +(z + 0.15).toFixed(2)))}
              aria-label="Acercar mapa"
              className="flex h-8 min-w-[32px] items-center justify-center border border-white/50 bg-[#07414f] text-base font-bold text-[#fff7df] hover:bg-[#b36b43]"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              aria-label="Restablecer zoom"
              className="flex h-8 min-w-[32px] items-center justify-center border border-white/50 bg-[#07414f] text-sm font-bold text-[#fff7df] hover:bg-[#b36b43]"
            >
              ⟲
            </button>
          </div>

          {/* Cruceta táctil para móvil */}
          <div
            aria-label="Mover personaje"
            className="grid grid-cols-3 gap-1 border border-white/35 bg-[#052836]/75 p-1.5 md:hidden"
          >
            <span />
            <button
              type="button"
              {...bindWalkButton('up')}
              aria-label="Caminar arriba"
              className="flex h-8 w-8 items-center justify-center border border-white/50 bg-[#07414f] text-xs text-[#fff7df]"
            >
              ▲
            </button>
            <span />
            <button
              type="button"
              {...bindWalkButton('left')}
              aria-label="Caminar izquierda"
              className="flex h-8 w-8 items-center justify-center border border-white/50 bg-[#07414f] text-xs text-[#fff7df]"
            >
              ◀
            </button>
            <button
              type="button"
              {...bindWalkButton('down')}
              aria-label="Caminar abajo"
              className="flex h-8 w-8 items-center justify-center border border-white/50 bg-[#07414f] text-xs text-[#fff7df]"
            >
              ▼
            </button>
            <button
              type="button"
              {...bindWalkButton('right')}
              aria-label="Caminar derecha"
              className="flex h-8 w-8 items-center justify-center border border-white/50 bg-[#07414f] text-xs text-[#fff7df]"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="pointer-events-none hidden text-right text-shadow-sm lg:block">
          <p className="font-pixel text-[9px] text-[#ffe39a]">
            FLECHAS PARA CAMINAR · ENTER PARA ENTRAR
          </p>
          <p className="mt-1 text-xs text-[#e6f5ea]">
            Haz clic en cualquier isla o camina hasta ella para explorar sus salas 2D.
          </p>
        </div>
      </div>
    </div>
  );
};
