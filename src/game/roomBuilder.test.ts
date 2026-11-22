import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Island, IslandBiome } from '../types/museum.ts';
import { buildPlayableRoom } from './roomBuilder.ts';

function createDummyIsland(biome: IslandBiome): Island {
  return {
    id: `isl-${biome}`,
    isOriginal: false,
    biome,
    x: 50,
    y: 52,
    mapLabel: biome.toUpperCase(),
    title: `Isla ${biome}`,
    eyebrow: 'ISLA TEST',
    description: `Descripción para bioma ${biome}`,
    footer: 'Pie test',
  };
}

describe('2D Playable Room Biome Mapping', () => {
  const ALL_BIOMES: IslandBiome[] = [
    'forest',
    'observatory',
    'ice',
    'patio',
    'desert',
    'workshop',
    'volcano',
    'crypt',
    'coral',
  ];

  for (const biome of ALL_BIOMES) {
    it(`generates a playable room with correct tileMap for biome "${biome}"`, () => {
      const island = createDummyIsland(biome);
      const room = {
        id: `room-${biome}`,
        islandId: island.id,
        name: `Sala ${biome}`,
        description: `Sala de prueba para ${biome}`,
      };

      const playable = buildPlayableRoom(island, [room], room, []);
      assert.ok(playable, 'Playable room created');
      assert.ok(playable.layout.length === 11, 'Layout has 11 rows');
      assert.ok(playable.layout[0].length === 16, 'Layout has 16 cols');
      assert.ok(playable.tileMap, 'TileMap is defined');
      assert.ok(playable.tileMap.W, 'Wall tile is defined');
      assert.ok(playable.tileMap['.'], 'Floor tile is defined');
      assert.ok(playable.tileMap.C, 'Path tile is defined');
      assert.ok(playable.tileMap.D, 'Door tile is defined');
      assert.ok(playable.tileMap.X, 'Exit portal is defined');

      // Verify specific floor tile expectations
      if (biome === 'coral') {
        assert.equal(playable.tileMap['.'], 'sand');
        assert.equal(playable.isOutdoor, true);
      } else if (biome === 'volcano') {
        assert.equal(playable.tileMap['.'], 'dungeon_floor');
        assert.equal(playable.isOutdoor, true);
      } else if (biome === 'crypt') {
        assert.equal(playable.tileMap['.'], 'dungeon_floor');
        assert.equal(playable.isOutdoor, false);
      } else if (biome === 'forest') {
        assert.equal(playable.tileMap['.'], 'grass');
        assert.equal(playable.isOutdoor, true);
      } else if (biome === 'ice') {
        assert.equal(playable.tileMap['.'], 'ice_floor');
        assert.equal(playable.isOutdoor, false);
      } else if (biome === 'desert') {
        assert.equal(playable.tileMap['.'], 'sand');
        assert.equal(playable.isOutdoor, true);
      }
    });
  }
});
