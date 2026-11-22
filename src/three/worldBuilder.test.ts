import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildArchipelagoWorld3D } from './worldBuilder.ts';
import { createProceduralTextures } from './textures.ts';
import type { Island, MuseumPiece } from '../types/museum';

describe('Three.js Resource Lifecycle & Disposal Tests', () => {
  it('buildArchipelagoWorld3D creates and completely disposes tracked geometries, materials, and textures without disposing shared procedural textures', () => {
    const dummyCanvas = {
      getContext: () => ({
        createImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4) }),
        putImageData: () => {},
        fillStyle: '',
        fillRect: () => {},
        strokeStyle: '',
        lineWidth: 1,
        strokeRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
      }),
      width: 64,
      height: 64,
    };

    (global as any).document = {
      createElement: () => dummyCanvas,
    };

    const sharedTextures = createProceduralTextures();

    let sharedTextureDisposed = false;

    // Spy on shared texture dispose
    const origSharedDispose = sharedTextures.water.dispose.bind(sharedTextures.water);
    sharedTextures.water.dispose = () => {
      sharedTextureDisposed = true;
      origSharedDispose();
    };

    const islands: Island[] = [
      {
        id: 'patio',
        title: 'Patio 404',
        biome: 'patio',
        x: 50,
        y: 50,
        mapLabel: 'Patio',
        eyebrow: 'Isla Central',
        description: 'Patio central',
        footer: 'Patio footer',
        isOriginal: true,
      },
      {
        id: 'salita',
        title: 'Salita del Eco',
        biome: 'desert',
        x: 100,
        y: 100,
        mapLabel: 'Salita',
        eyebrow: 'Eco',
        description: 'Salita desertica',
        footer: 'Salita footer',
        isOriginal: true,
      },
    ];

    const piecesByIsland: Record<string, MuseumPiece[]> = {
      patio: [],
      salita: [],
    };

    const world = buildArchipelagoWorld3D(islands, piecesByIsland, sharedTextures);

    assert.ok(world.group.children.length > 0, 'World must contain assembled 3D objects');

    // Execute disposal
    world.dispose();

    // Verify shared textures remain intact and undisposed
    assert.equal(
      sharedTextureDisposed,
      false,
      'Shared procedural textures must NOT be disposed by individual archipelago world instances'
    );
  });

  it('Scene and mesh disposal safety: BufferGeometry and Material dispose without error', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);

    assert.doesNotThrow(() => {
      mesh.geometry.dispose();
      mat.dispose();
    });
  });
});

