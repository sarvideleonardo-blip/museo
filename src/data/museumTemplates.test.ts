import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MUSEUM_TEMPLATES } from './museumTemplates.ts';
import { BIOME_LABELS, ORIGINAL_ISLANDS } from './initialContent.ts';
import type { IslandBiome } from '../types/museum.ts';

describe('Museum Templates Architecture', () => {
  it('registers all required templates including Fanzine and Fotografía', () => {
    const templateIds = MUSEUM_TEMPLATES.map((t) => t.id);
    assert.ok(templateIds.includes('musica'), 'musica template exists');
    assert.ok(templateIds.includes('gastronomia'), 'gastronomia template exists');
    assert.ok(templateIds.includes('arte'), 'arte template exists');
    assert.ok(templateIds.includes('blank'), 'blank template exists');
    assert.ok(templateIds.includes('fanzine'), 'fanzine template exists');
    assert.ok(templateIds.includes('fotografia'), 'fotografia template exists');
  });

  it('verifies fanzine template structure and valid room/island relationships', () => {
    const fanzine = MUSEUM_TEMPLATES.find((t) => t.id === 'fanzine');
    assert.ok(fanzine, 'fanzine template must be found');
    assert.equal(fanzine.category, 'literatura');
    assert.ok(fanzine.islands.length >= 3, 'fanzine should have at least 3 islands');
    assert.ok(fanzine.rooms.length >= 3, 'fanzine should have at least 3 rooms');
    assert.ok(fanzine.pieces.length >= 3, 'fanzine should have at least 3 curated seed pieces');

    const islandIds = new Set(fanzine.islands.map((i) => i.id));
    for (const room of fanzine.rooms) {
      assert.ok(
        islandIds.has(room.islandId),
        `Room ${room.id} references invalid island ${room.islandId}`
      );
    }

    const roomIds = new Set(fanzine.rooms.map((r) => r.id));
    for (const piece of fanzine.pieces) {
      assert.ok(
        islandIds.has(piece.islandId),
        `Piece "${piece.title}" references invalid island ${piece.islandId}`
      );
      assert.ok(
        roomIds.has(piece.roomId),
        `Piece "${piece.title}" references invalid room ${piece.roomId}`
      );
      assert.ok(piece.title.trim().length > 0, 'Piece has non-empty title');
      assert.ok(piece.body.trim().length > 0, 'Piece has non-empty body');
    }
  });

  it('verifies fotografia template structure and valid room/island relationships', () => {
    const foto = MUSEUM_TEMPLATES.find((t) => t.id === 'fotografia');
    assert.ok(foto, 'fotografia template must be found');
    assert.equal(foto.category, 'arte');
    assert.ok(foto.islands.length >= 3, 'fotografia should have at least 3 islands');
    assert.ok(foto.rooms.length >= 3, 'fotografia should have at least 3 rooms');
    assert.ok(foto.pieces.length >= 3, 'fotografia should have at least 3 curated seed pieces');

    const islandIds = new Set(foto.islands.map((i) => i.id));
    for (const room of foto.rooms) {
      assert.ok(
        islandIds.has(room.islandId),
        `Room ${room.id} references invalid island ${room.islandId}`
      );
    }

    const roomIds = new Set(foto.rooms.map((r) => r.id));
    for (const piece of foto.pieces) {
      assert.ok(
        islandIds.has(piece.islandId),
        `Piece "${piece.title}" references invalid island ${piece.islandId}`
      );
      assert.ok(
        roomIds.has(piece.roomId),
        `Piece "${piece.title}" references invalid room ${piece.roomId}`
      );
      assert.ok(piece.title.trim().length > 0, 'Piece has non-empty title');
      assert.ok(piece.body.trim().length > 0, 'Piece has non-empty body');
    }
  });

  it('ensures all templates in MUSEUM_TEMPLATES have valid island coordinates and non-empty pieces', () => {
    for (const tpl of MUSEUM_TEMPLATES) {
      assert.ok(tpl.id.length > 0, 'Template has valid id');
      assert.ok(tpl.name.length > 0, `Template ${tpl.id} has name`);
      assert.ok(tpl.defaultSubtitle.length > 0, `Template ${tpl.id} has defaultSubtitle`);
      assert.ok(tpl.theme.presetId.length > 0, `Template ${tpl.id} has theme`);

      for (const isl of tpl.islands) {
        assert.ok(isl.x >= 10 && isl.x <= 90, `Island ${isl.id} in ${tpl.id} x out of range: ${isl.x}`);
        assert.ok(isl.y >= 18 && isl.y <= 86, `Island ${isl.id} in ${tpl.id} y out of range: ${isl.y}`);
        assert.ok(isl.biome in BIOME_LABELS, `Island ${isl.id} in ${tpl.id} has unknown biome: ${isl.biome}`);
      }
    }
  });
});

describe('Pixel Biomes Registration and Compatibility', () => {
  const REQUIRED_BIOMES: IslandBiome[] = [
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

  it('verifies all 9 biomes are documented in BIOME_LABELS with valid names and descriptions', () => {
    for (const biome of REQUIRED_BIOMES) {
      assert.ok(BIOME_LABELS[biome], `Biome ${biome} must exist in BIOME_LABELS`);
      assert.ok(BIOME_LABELS[biome].name.length > 0, `Biome ${biome} has valid name`);
      assert.ok(BIOME_LABELS[biome].desc.length > 0, `Biome ${biome} has valid desc`);
    }
  });

  it('checks the 3 new biomes (volcano, crypt, coral) specifically', () => {
    assert.equal(BIOME_LABELS.volcano.name, 'Caldera volcánica');
    assert.equal(BIOME_LABELS.crypt.name, 'Cripta y ruinas');
    assert.equal(BIOME_LABELS.coral.name, 'Arrecife de coral');
  });

  it('confirms existing original islands maintain valid biome references', () => {
    for (const isl of ORIGINAL_ISLANDS) {
      assert.ok(
        REQUIRED_BIOMES.includes(isl.biome),
        `Original island ${isl.id} has unknown biome: ${isl.biome}`
      );
    }
  });
});
