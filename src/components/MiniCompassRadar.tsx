import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { Island } from '../types/museum';

export interface MiniCompassHandle {
  update: (playerX: number, playerZ: number, playerYaw: number, cameraYaw: number) => void;
}

interface MiniCompassRadarProps {
  islands: Island[];
  radarRef: React.Ref<MiniCompassHandle>;
}

const BIOME_COLORS: Record<Island['biome'], string> = {
  patio: '#f4d47d',
  forest: '#6fd189',
  observatory: '#b48ef2',
  ice: '#8ef5ff',
  desert: '#e6a855',
  workshop: '#f07c59',
  volcano: '#ff6b4a',
  crypt: '#9d8ec2',
  coral: '#38e8cb',
};

export const MiniCompassRadar: React.FC<MiniCompassRadarProps> = ({ islands, radarRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    px: 0,
    pz: 7.5,
    pyaw: Math.PI,
    cyaw: 0,
  });

  const nodesRef = useRef<{ id: string; label: string; color: string; x: number; z: number; isHub: boolean }[]>([]);
  nodesRef.current = islands.map((isl) => ({
    id: isl.id,
    label: (isl.mapLabel || isl.title).replace(/^El\s+|^La\s+/i, '').slice(0, 10),
    color: BIOME_COLORS[isl.biome] || '#a7e8dc',
    x: (isl.x - 50) * 1.38,
    z: (isl.y - 52) * 1.12,
    isHub: isl.id === 'patio' || isl.biome === 'patio',
  }));

  const drawRadar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 128;
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const rOuter = size * 0.5 - 3;
    const rInner = rOuter - 12;

    const { px, pz, pyaw, cyaw } = stateRef.current;

    // Radar background disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 31, 43, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e5c96e';
    ctx.stroke();

    // Inner range ring
    ctx.beginPath();
    ctx.arc(cx, cy, rInner * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(130, 210, 200, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rotate relative to camera heading (up = camera forward (-sin(cyaw), -cos(cyaw)))
    const cosC = Math.cos(cyaw);
    const sinC = Math.sin(cyaw);
    const radarScale = 0.72; // px per 3D world unit

    const toRadar = (wx: number, wz: number) => {
      const dx = (wx - px) * radarScale;
      const dz = (wz - pz) * radarScale;
      const rx = dx * cosC - dz * sinC;
      const ry = dx * sinC + dz * cosC;
      return { rx, ry };
    };

    // Draw bridge spokes between hub and other islands
    const hub = nodesRef.current.find((n) => n.isHub) || nodesRef.current[0];
    if (hub) {
      const hubPos = toRadar(hub.x, hub.z);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rInner + 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = 'rgba(229, 201, 110, 0.35)';
      ctx.lineWidth = 1.5;
      for (const n of nodesRef.current) {
        if (n === hub) continue;
        const p2 = toRadar(n.x, n.z);
        ctx.beginPath();
        ctx.moveTo(cx + hubPos.rx, cy + hubPos.ry);
        ctx.lineTo(cx + p2.rx, cy + p2.ry);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw island dots & short labels (clamped to radar edge if outside range)
    ctx.font = 'bold 8px "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const n of nodesRef.current) {
      let { rx, ry } = toRadar(n.x, n.z);
      const dist = Math.hypot(rx, ry);
      const clamped = dist > rInner;
      if (clamped && dist > 0.001) {
        rx = (rx / dist) * rInner;
        ry = (ry / dist) * rInner;
      }

      const sx = cx + rx;
      const sy = cy + ry;

      ctx.beginPath();
      ctx.arc(sx, sy, n.isHub ? 4.2 : clamped ? 3.5 : 4.0, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#041a24';
      ctx.stroke();

      // Label shifted subtly inward when clamped to rim so it stays inside the dial
      const labelDist = Math.hypot(rx, ry);
      const lx = labelDist > 12 ? sx - (rx / labelDist) * 11 : sx;
      const ly = labelDist > 12 ? sy - (ry / labelDist) * 9 : sy + 9;
      ctx.fillStyle = 'rgba(4, 24, 34, 0.85)';
      ctx.fillText(n.label, lx + 0.8, ly + 0.8);
      ctx.fillStyle = '#f8f2d8';
      ctx.fillText(n.label, lx, ly);
    }

    // Cardinal N / E / S / O markers rotating around outer compass ring
    const cardinals: [string, number, number, string][] = [
      ['N', 0, -1, '#ffcf6b'],
      ['S', 0, 1, '#a9d5cc'],
      ['E', 1, 0, '#a9d5cc'],
      ['O', -1, 0, '#a9d5cc'],
    ];
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    for (const [letter, vx, vz, color] of cardinals) {
      const rx = vx * cosC - vz * sinC;
      const ry = vx * sinC + vz * cosC;
      const tx = cx + rx * (rOuter - 6);
      const ty = cy + ry * (rOuter - 6);
      ctx.fillStyle = '#041a24';
      ctx.fillText(letter, tx + 0.7, ty + 0.7);
      ctx.fillStyle = color;
      ctx.fillText(letter, tx, ty);
    }

    // Center explorer facing cone & arrow
    // Character yaw=0 faces +Z (0, +1); yaw=PI faces -Z (0, -1).
    const fwdX = Math.sin(pyaw);
    const fwdZ = Math.cos(pyaw);
    const relX = fwdX * cosC - fwdZ * sinC;
    const relY = fwdX * sinC + fwdZ * cosC;
    const arrowAngle = Math.atan2(relY, relX);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(arrowAngle);

    // Subtle field-of-view cone
    ctx.fillStyle = 'rgba(125, 242, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 18, -0.45, 0.45);
    ctx.closePath();
    ctx.fill();

    // Explorer directional arrowhead
    ctx.fillStyle = '#f8da7c';
    ctx.strokeStyle = '#062431';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8.5, 0);
    ctx.lineTo(-5.5, -5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  };

  useImperativeHandle(
    radarRef,
    () => ({
      update(playerX: number, playerZ: number, playerYaw: number, cameraYaw: number) {
        stateRef.current.px = playerX;
        stateRef.current.pz = playerZ;
        stateRef.current.pyaw = playerYaw;
        stateRef.current.cyaw = cameraYaw;
        drawRadar();
      },
    }),
    []
  );

  useEffect(() => {
    drawRadar();
  }, [islands]);

  return (
    <div
      aria-label="Brújula y radar de islas"
      className="pointer-events-none fixed left-3 top-[108px] z-10 sm:left-8 sm:top-[116px]"
    >
      <canvas ref={canvasRef} className="h-[116px] w-[116px] sm:h-[128px] sm:w-[128px]" />
    </div>
  );
};
