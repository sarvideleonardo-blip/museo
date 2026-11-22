import * as THREE from 'three';
import { Island, MuseumPiece, MuseumThemeConfig } from '../types/museum';
import { ProceduralTextures } from './textures';

export const DECK_Y = 1.6;

export interface IslandNode3D {
  island: Island;
  cx: number;
  cz: number;
  radius: number;
  deckY: number;
  /** Coordenada del punto interactivo principal (monumento / entrada) */
  portalX: number;
  portalZ: number;
}

export interface BridgeCorridor {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
  archHeight: number;
  length: number;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface ExhibitTrigger {
  id: string;
  kind: 'island' | 'piece' | 'guestbook' | 'support';
  islandId: string;
  label: string;
  sublabel: string;
  x: number;
  z: number;
  y: number;
  radius: number;
  piece?: MuseumPiece;
  beaconMesh: THREE.Mesh;
}

export interface AnimatedWorldRefs {
  fountainRing?: THREE.Mesh;
  fountainJet?: THREE.Mesh;
  telescopePivot?: THREE.Group;
  beaconMeshes: THREE.Mesh[];
  steamPuffs: { mesh: THREE.Mesh; baseY: number; phase: number }[];
  oceanMesh: THREE.Mesh;
}

export interface ArchipelagoWorld3D {
  group: THREE.Group;
  islandNodes: IslandNode3D[];
  bridges: BridgeCorridor[];
  colliders: CircleCollider[];
  triggers: ExhibitTrigger[];
  animated: AnimatedWorldRefs;
  spawnPoint: { x: number; y: number; z: number };
  sampleWalkableHeight: (
    x: number,
    z: number
  ) => { walkable: boolean; groundY: number; islandId: string | null; onBridge: boolean };
  dispose: () => void;
}

function mapIslandPosition(island: Island): { cx: number; cz: number } {
  return {
    cx: (island.x - 50) * 1.38,
    cz: (island.y - 52) * 1.12,
  };
}

function makeSignTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#092d3c';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#e5c96e';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 88);

    ctx.fillStyle = '#f8e6a2';
    ctx.font = 'bold 21px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.slice(0, 22), 128, 42);

    ctx.fillStyle = '#a7dce0';
    ctx.font = '15px "Pixelify Sans", sans-serif';
    ctx.fillText(subtitle.slice(0, 28), 128, 70);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBridgeGuideTexture(destination: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 88;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#5b3921';
    ctx.fillRect(0, 0, 256, 88);
    ctx.strokeStyle = '#e6c35a';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 248, 80);

    ctx.fillStyle = '#f6d87b';
    ctx.font = 'bold 14px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PUENTE HACIA ↑', 128, 28);

    ctx.fillStyle = '#fff9e6';
    ctx.font = 'bold 20px "Pixelify Sans", sans-serif';
    ctx.fillText(destination.slice(0, 20), 128, 60);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildArchipelagoWorld3D(
  islands: Island[],
  piecesByIsland: Record<string, MuseumPiece[]>,
  textures: ProceduralTextures,
  theme?: MuseumThemeConfig
): ArchipelagoWorld3D {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const extraTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Large ocean surface fading naturally into horizon fog
  const oceanGeo = trackGeo(new THREE.PlaneGeometry(520, 520, 1, 1));
  const oceanMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.water,
      color: theme?.oceanColor || 0x2caac0,
      roughness: 0.34,
      metalness: 0.14,
    })
  );
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = 0;
  oceanMesh.receiveShadow = true;
  group.add(oceanMesh);

  // Shared materials
  const cliffMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.cliffRock,
      roughness: 0.88,
      metalness: 0.04,
    })
  );
  const stoneTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd2c4a0,
      roughness: 0.72,
      metalness: 0.06,
    })
  );
  const darkWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c3922,
      roughness: 0.8,
      metalness: 0.04,
    })
  );
  const bridgePlankMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlank,
      roughness: 0.76,
      metalness: 0.05,
    })
  );
  const lanternGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe494,
      emissive: 0xffbe55,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
    })
  );
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8ef5ff,
      emissive: 0x3ed4e8,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.18,
    })
  );
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6c35a,
      roughness: 0.3,
      metalness: 0.65,
    })
  );
  const beaconMatBase = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffdf76,
      emissive: 0xf4b63f,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.45,
    })
  );
  const guestbookGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa4f5d2,
      emissive: 0x3ec48f,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.35,
    })
  );
  const supportGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffa67a,
      emissive: 0xe3623e,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.35,
    })
  );

  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.82, metalness: 0.02 })
  );
  const cobbleMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.cobblePath, roughness: 0.78, metalness: 0.04 })
  );
  const sandMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.88, metalness: 0.02 })
  );
  const desertPathMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.desertPath, roughness: 0.75, metalness: 0.04 })
  );
  const iceMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.ice, roughness: 0.28, metalness: 0.12 })
  );
  const icePathMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.icePath, roughness: 0.25, metalness: 0.16 })
  );
  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.74, metalness: 0.08 })
  );
  const foamRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbcf4f8,
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
    })
  );
  const liminalMistMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeaf4fa,
      emissive: 0xc8dce8,
      emissiveIntensity: 0.42,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.42,
    })
  );
  const liminalMistOuterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdcebf4,
      emissive: 0xaec8d9,
      emissiveIntensity: 0.25,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.22,
    })
  );

  const colliders: CircleCollider[] = [];
  const triggers: ExhibitTrigger[] = [];
  const animated: AnimatedWorldRefs = {
    beaconMeshes: [],
    steamPuffs: [],
    oceanMesh,
  };

  const islandNodes: IslandNode3D[] = islands.map((isl) => {
    const { cx, cz } = mapIslandPosition(isl);
    const radius = isl.biome === 'patio' ? 14.5 : 12.2;
    return {
      island: isl,
      cx,
      cz,
      radius,
      deckY: DECK_Y,
      portalX: cx,
      portalZ: cz + 3.2,
    };
  });

  // Hub node for connecting bridges (Patio 404 preferred, else first island)
  const hubNode =
    islandNodes.find((n) => n.island.id === 'patio' || n.island.biome === 'patio') ||
    islandNodes[0];

  const bridges: BridgeCorridor[] = [];
  if (hubNode) {
    for (const node of islandNodes) {
      if (node === hubNode) continue;
      const dx = node.cx - hubNode.cx;
      const dz = node.cz - hubNode.cz;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) continue;
      const ux = dx / dist;
      const uz = dz / dist;

      // Bridge starts just inside hub island rim and ends inside target island rim
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

  // Helper: add lantern post along a path
  function addLanternPost(x: number, y: number, z: number) {
    const post = new THREE.Group();
    post.position.set(x, y, z);

    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 1.9, 6)), darkWoodMat);
    pole.position.y = 0.95;
    pole.castShadow = true;

    const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.32, 0.22, 4)), darkWoodMat);
    cap.position.y = 2.02;
    cap.rotation.y = Math.PI / 4;

    const bulb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.34, 0.28)), lanternGlowMat);
    bulb.position.y = 1.75;

    post.add(pole, cap, bulb);
    group.add(post);
    colliders.push({ x, z, radius: 0.32 });
  }

  // Helper: add stepping cobblestone path strip between two points on an island
  function addPathStrip(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    width: number,
    mat: THREE.Material
  ) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const angle = Math.atan2(dx, dz);
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width, 0.08, len)), mat);
    strip.position.set((x1 + x2) * 0.5, DECK_Y + 0.03, (z1 + z2) * 0.5);
    strip.rotation.y = angle;
    strip.receiveShadow = true;
    group.add(strip);
  }

  // Helper: add pixel tree
  function addTree(x: number, z: number, scale = 1, tint = 0x3b7d4e) {
    const tree = new THREE.Group();
    tree.position.set(x, DECK_Y, z);

    const trunk = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, 1.8 * scale, 6)),
      darkWoodMat
    );
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafMat = trackMat(
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.78, metalness: 0.02 })
    );
    const c1 = new THREE.Mesh(
      trackGeo(new THREE.DodecahedronGeometry(1.15 * scale, 0)),
      leafMat
    );
    c1.position.y = 2.25 * scale;
    c1.castShadow = true;
    const c2 = new THREE.Mesh(
      trackGeo(new THREE.DodecahedronGeometry(0.85 * scale, 0)),
      leafMat
    );
    c2.position.set(0.35 * scale, 3.05 * scale, -0.2 * scale);
    c2.castShadow = true;

    tree.add(c1, c2);
    group.add(tree);
    colliders.push({ x, z, radius: 0.55 * scale });
  }

  // Helper: create interactive exhibit pedestal with floating diamond beacon
  function addPedestal(
    x: number,
    z: number,
    label: string,
    sublabel: string,
    islandId: string,
    kind: ExhibitTrigger['kind'],
    piece?: MuseumPiece
  ) {
    const ped = new THREE.Group();
    ped.position.set(x, DECK_Y, z);

    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.26, 1.15)), stoneTrimMat);
    base.position.y = 0.13;
    base.receiveShadow = true;
    base.castShadow = true;

    const column = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.85, 0.68)), brickMat);
    column.position.y = 0.68;
    column.castShadow = true;

    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.16, 0.92)), goldMat);
    cap.position.y = 1.16;

    const beaconMat =
      kind === 'island'
        ? cyanGlowMat
        : kind === 'guestbook'
          ? guestbookGlowMat
          : kind === 'support'
            ? supportGlowMat
            : beaconMatBase;

    const beacon = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.36, 0)), beaconMat);
    beacon.position.y = 1.95;
    beacon.castShadow = true;

    ped.add(base, column, cap, beacon);
    group.add(ped);
    animated.beaconMeshes.push(beacon);
    colliders.push({ x, z, radius: 0.62 });

    triggers.push({
      id: piece ? piece.id : `${kind}-${islandId}`,
      kind,
      islandId,
      label,
      sublabel,
      x,
      z,
      y: DECK_Y + 2.4,
      radius: kind === 'island' ? 3.2 : 2.65,
      piece,
      beaconMesh: beacon,
    });
  }

  const islandStyle = theme?.islandStyle || 'cliffs';

  // Build each island terrain, caminitos, architecture, and pedestals
  for (const node of islandNodes) {
    const { island, cx, cz, radius } = node;
    const isDesert = island.biome === 'desert';
    const isIce = island.biome === 'ice';
    const isWorkshop = island.biome === 'workshop';
    const isVolcano = island.biome === 'volcano';
    const isCrypt = island.biome === 'crypt';
    const isCoral = island.biome === 'coral';

    const topMat = isDesert || isCoral
      ? sandMat
      : isIce
        ? iceMat
        : isVolcano
          ? brickMat
          : isCrypt
            ? stoneTrimMat
            : grassMat;
    const pathMat = isDesert || isCoral
      ? desertPathMat
      : isIce
        ? icePathMat
        : cobbleMat;

    if (islandStyle === 'floating') {
      // Levitating stone shelf + inverted tapered underside spire + cyan energy halo
      const upperCliff = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(radius, radius * 0.88, 1.15, 10)),
        cliffMat
      );
      upperCliff.position.set(cx, DECK_Y - 0.58, cz);
      upperCliff.receiveShadow = true;
      upperCliff.castShadow = true;
      group.add(upperCliff);

      const underSpire = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(radius * 0.82, 2.8, 8)),
        cliffMat
      );
      underSpire.rotation.x = Math.PI;
      underSpire.position.set(cx, DECK_Y - 2.55, cz);
      underSpire.castShadow = true;
      group.add(underSpire);

      const halo = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(radius * 0.9, 0.14, 6, 24)),
        cyanGlowMat
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(cx, 0.38, cz);
      group.add(halo);
    } else {
      // Island cliff body + sea foam collar
      const cliff = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(radius, radius * 0.78, DECK_Y + 1.8, 12)),
        cliffMat
      );
      cliff.position.set(cx, (DECK_Y - 1.8) * 0.5, cz);
      cliff.receiveShadow = true;
      cliff.castShadow = true;
      group.add(cliff);

      if (islandStyle === 'terraced') {
        const terrace1 = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(radius * 1.07, radius * 1.05, 0.55, 12)),
          stoneTrimMat
        );
        terrace1.position.set(cx, DECK_Y - 0.62, cz);
        terrace1.receiveShadow = true;
        group.add(terrace1);

        const terrace2 = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(radius * 1.15, radius * 1.12, 0.62, 12)),
          cliffMat
        );
        terrace2.position.set(cx, DECK_Y - 1.2, cz);
        terrace2.receiveShadow = true;
        group.add(terrace2);
      }

      const foam = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(radius * 0.84, radius * 1.06, 20)),
        foamRingMat
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(cx, 0.05, cz);
      group.add(foam);
    }

    // Top turf deck
    const topDeck = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius + 0.15, radius, 0.34, 12)),
      topMat
    );
    topDeck.position.set(cx, DECK_Y - 0.17, cz);
    topDeck.receiveShadow = true;
    group.add(topDeck);

    // Niebla liminal cuando la isla es prestada por otro museo
    if (island.loaned) {
      const innerMist = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(radius * 0.96, radius * 1.18, 28)),
        liminalMistMat
      );
      innerMist.rotation.x = -Math.PI / 2;
      innerMist.position.set(cx, DECK_Y + 0.06, cz);
      group.add(innerMist);

      const outerMist = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(radius * 1.12, radius * 1.42, 28)),
        liminalMistOuterMat
      );
      outerMist.rotation.x = -Math.PI / 2;
      outerMist.position.set(cx, 0.28, cz);
      group.add(outerMist);
    }

    // Central plaza path ring
    const plaza = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(radius * 0.44, radius * 0.46, 0.08, 12)),
      pathMat
    );
    plaza.position.set(cx, DECK_Y + 0.02, cz);
    plaza.receiveShadow = true;
    group.add(plaza);

    // Direction toward hub so paths align cleanly with incoming bridge
    let toHubAngle = Math.PI * 0.5;
    if (hubNode && node !== hubNode) {
      toHubAngle = Math.atan2(hubNode.cx - cx, hubNode.cz - cz);
      const shoreX = cx + Math.sin(toHubAngle) * (radius - 1.0);
      const shoreZ = cz + Math.cos(toHubAngle) * (radius - 1.0);
      addPathStrip(cx, cz, shoreX, shoreZ, 3.0, pathMat);

      // Pair of welcoming lanterns near the bridge landing
      const perpX = Math.cos(toHubAngle) * 1.9;
      const perpZ = -Math.sin(toHubAngle) * 1.9;
      addLanternPost(shoreX * 0.75 + cx * 0.25 + perpX, DECK_Y, shoreX * 0.75 + cz * 0.25 + perpZ);
      addLanternPost(shoreX * 0.75 + cx * 0.25 - perpX, DECK_Y, shoreX * 0.75 + cz * 0.25 - perpZ);

      // Island wooden nameplate sign beside path
      const signTex = makeSignTexture(island.mapLabel || island.title, island.eyebrow || 'ISLA');
      extraTextures.push(signTex);
      const signMat = trackMat(
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45, metalness: 0.05 })
      );
      const signPost = new THREE.Group();
      const sOffX = cx + Math.sin(toHubAngle) * (radius * 0.56) + perpX * 1.05;
      const sOffZ = cz + Math.cos(toHubAngle) * (radius * 0.56) + perpZ * 1.05;
      signPost.position.set(sOffX, DECK_Y, sOffZ);
      signPost.lookAt(cx + Math.sin(toHubAngle) * radius, DECK_Y, cz + Math.cos(toHubAngle) * radius);

      const sLeg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 1.5, 0.18)), darkWoodMat);
      sLeg.position.y = 0.75;
      const sBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.7, 1.05, 0.16)), signMat);
      sBoard.position.y = 1.55;
      sBoard.castShadow = true;
      signPost.add(sLeg, sBoard);
      group.add(signPost);
      colliders.push({ x: sOffX, z: sOffZ, radius: 0.45 });
    } else if (node === hubNode) {
      // Radiate cobblestone caminitos toward every connected island + bridge-mouth guide signposts!
      for (const other of islandNodes) {
        if (other === hubNode) continue;
        const ang = Math.atan2(other.cx - cx, other.cz - cz);
        const rimX = cx + Math.sin(ang) * (radius - 0.8);
        const rimZ = cz + Math.cos(ang) * (radius - 0.8);
        addPathStrip(cx, cz, rimX, rimZ, 2.8, pathMat);

        // Wooden guide signpost right beside the Patio 404 bridge mouth facing inward toward the plaza
        const guideDist = radius - 2.4;
        const perpX = Math.cos(ang) * 2.1;
        const perpZ = -Math.sin(ang) * 2.1;
        const gx = cx + Math.sin(ang) * guideDist + perpX;
        const gz = cz + Math.cos(ang) * guideDist + perpZ;

        const guideTex = makeBridgeGuideTexture(other.island.mapLabel || other.island.title);
        extraTextures.push(guideTex);
        const guideMat = trackMat(
          new THREE.MeshStandardMaterial({ map: guideTex, roughness: 0.48, metalness: 0.04 })
        );

        const guidePost = new THREE.Group();
        guidePost.position.set(gx, DECK_Y, gz);
        // Face inward toward Patio 404 fountain so explorers approaching the bridge can read it clearly
        guidePost.lookAt(cx + perpX * 0.35, DECK_Y, cz + perpZ * 0.35);

        const gPole = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 1.45, 6)),
          darkWoodMat
        );
        gPole.position.y = 0.72;
        gPole.castShadow = true;

        const gBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 0.78, 0.14)), guideMat);
        gBoard.position.y = 1.48;
        gBoard.castShadow = true;

        const gFinial = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 0.24, 4)), goldMat);
        gFinial.position.y = 2.0;
        gFinial.rotation.y = Math.PI / 4;

        guidePost.add(gPole, gBoard, gFinial);
        group.add(guidePost);
        colliders.push({ x: gx, z: gz, radius: 0.4 });
      }
    }

    // Centerpiece landmark offset slightly back from incoming bridge so player walks right up to it
    const backAngle = toHubAngle + Math.PI;
    const landX = cx + Math.sin(backAngle) * 1.6;
    const landZ = cz + Math.cos(backAngle) * 1.6;

    if (island.biome === 'patio') {
      // Multi-tier Wish Fountain in the center + Root Tree + lantern perimeter
      const fBase = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(2.6, 2.85, 0.55, 8)),
        stoneTrimMat
      );
      fBase.position.set(cx, DECK_Y + 0.27, cz);
      fBase.castShadow = true;
      fBase.receiveShadow = true;

      const fWater = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(2.2, 2.2, 0.14, 12)),
        cyanGlowMat
      );
      fWater.position.set(cx, DECK_Y + 0.52, cz);

      const fSpire = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.45, 0.65, 1.9, 8)),
        stoneTrimMat
      );
      fSpire.position.set(cx, DECK_Y + 1.15, cz);
      fSpire.castShadow = true;

      const fBowl = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(1.15, 0.65, 0.35, 8)),
        stoneTrimMat
      );
      fBowl.position.set(cx, DECK_Y + 1.75, cz);

      const fJet = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.18, 0.32, 0.85, 8)),
        cyanGlowMat
      );
      fJet.position.set(cx, DECK_Y + 2.35, cz);

      const fRing = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(1.35, 0.08, 6, 16)),
        cyanGlowMat
      );
      fRing.rotation.x = Math.PI / 2;
      fRing.position.set(cx, DECK_Y + 0.62, cz);

      group.add(fBase, fWater, fSpire, fBowl, fJet, fRing);
      animated.fountainRing = fRing;
      animated.fountainJet = fJet;
      colliders.push({ x: cx, z: cz, radius: 2.9 });

      // Patio Root Tree & greenery
      addTree(cx - 7.8, cz - 5.2, 1.35, 0x3b8050);
      addTree(cx + 8.1, cz - 4.6, 1.15, 0x4b9358);
      addTree(cx - 7.2, cz + 6.8, 1.0, 0x529b5e);
      addLanternPost(cx + 4.4, DECK_Y, cz + 4.4);
      addLanternPost(cx - 4.4, DECK_Y, cz + 4.4);

      if (node === hubNode) {
        addPathStrip(cx, cz + 6.4, cx - 4.2, cz + 6.4, 1.35, pathMat);
        addPathStrip(cx, cz + 6.4, cx + 4.2, cz + 6.4, 1.35, pathMat);
        addPedestal(
          cx - 4.2,
          cz + 6.4,
          'Libro de visitas · Recepción',
          'Deja una nota o firma para el museo',
          island.id,
          'guestbook'
        );
        addPedestal(
          cx + 4.2,
          cz + 6.4,
          'Apoyar al proyecto',
          'Donaciones y aporte comunitario',
          island.id,
          'support'
        );
      }
    } else if (island.biome === 'forest') {
      // Bosque Lingüinal: Ancient stone archive shrine + dense trees framing the path
      const shrine = new THREE.Group();
      shrine.position.set(landX, DECK_Y, landZ);
      const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.5, 3.6)), stoneTrimMat);
      plinth.position.y = 0.25;
      plinth.castShadow = true;
      const leftPillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 3.2, 0.75)), stoneTrimMat);
      leftPillar.position.set(-1.3, 1.8, 0);
      leftPillar.castShadow = true;
      const rightPillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 3.2, 0.75)), stoneTrimMat);
      rightPillar.position.set(1.3, 1.8, 0);
      rightPillar.castShadow = true;
      const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.75, 1.15)), stoneTrimMat);
      lintel.position.set(0, 3.55, 0);
      lintel.castShadow = true;
      const coreOrb = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.65, 0)), cyanGlowMat);
      coreOrb.position.set(0, 2.0, 0);
      shrine.add(plinth, leftPillar, rightPillar, lintel, coreOrb);
      group.add(shrine);
      colliders.push({ x: landX, z: landZ, radius: 2.3 });

      addTree(cx - 6.6, cz - 4.8, 1.25, 0x2e6b43);
      addTree(cx + 6.9, cz - 4.5, 1.35, 0x3b7d4e);
      addTree(cx - 7.1, cz + 4.4, 1.1, 0x4b9358);
      addTree(cx + 6.4, cz + 5.1, 1.05, 0x347548);
    } else if (island.biome === 'observatory') {
      // Nucuria: Astronomical tower + brass telescope dome
      const tower = new THREE.Group();
      tower.position.set(landX, DECK_Y, landZ);
      const body = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(2.35, 2.75, 4.6, 8)),
        stoneTrimMat
      );
      body.position.y = 2.3;
      body.castShadow = true;
      body.receiveShadow = true;

      const domeMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x5c3e78, roughness: 0.42, metalness: 0.35 })
      );
      const dome = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(2.45, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        domeMat
      );
      dome.position.y = 4.5;
      dome.castShadow = true;

      const telescopePivot = new THREE.Group();
      telescopePivot.position.set(0, 5.2, 0);
      const scope = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.46, 3.2, 8)), goldMat);
      scope.rotation.x = Math.PI / 3;
      scope.position.set(0, 0.5, 1.35);
      scope.castShadow = true;
      telescopePivot.add(scope);
      animated.telescopePivot = telescopePivot;

      const door = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.9, 0.35)), cyanGlowMat);
      door.position.set(0, 0.95, 2.55);

      tower.add(body, dome, telescopePivot, door);
      group.add(tower);
      colliders.push({ x: landX, z: landZ, radius: 2.9 });

      addTree(cx - 7.2, cz - 3.5, 1.0, 0x3f7b65);
      addTree(cx + 7.1, cz + 2.8, 0.95, 0x458b70);
    } else if (island.biome === 'ice') {
      // Galería de Hielo: Crystalline twin-spire gallery keep
      const castle = new THREE.Group();
      castle.position.set(landX, DECK_Y, landZ);
      const hall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 3.4, 3.6)), iceMat);
      hall.position.y = 1.7;
      hall.castShadow = true;

      const spireMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x62b4cf, roughness: 0.22, metalness: 0.25 })
      );
      const spireL = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.95, 2.8, 6)), spireMat);
      spireL.position.set(-1.95, 4.7, 0);
      const spireR = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.95, 2.8, 6)), spireMat);
      spireR.position.set(1.95, 4.7, 0);
      const centerRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.65, 2.6, 4)), spireMat);
      centerRoof.rotation.y = Math.PI / 4;
      centerRoof.position.set(0, 4.7, 0);

      const archDoor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 2.1, 0.4)), cyanGlowMat);
      archDoor.position.set(0, 1.05, 1.75);

      castle.add(hall, spireL, spireR, centerRoof, archDoor);
      group.add(castle);
      colliders.push({ x: landX, z: landZ, radius: 2.8 });

      // Crystal pillars around edges
      for (const [ox, oz] of [
        [-6.8, -4.4],
        [6.8, -4.1],
        [-6.2, 5.2],
      ]) {
        const crys = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.95, 0)), cyanGlowMat);
        crys.scale.set(0.75, 1.85, 0.75);
        crys.position.set(cx + ox, DECK_Y + 1.35, cz + oz);
        crys.castShadow = true;
        group.add(crys);
        colliders.push({ x: cx + ox, z: cz + oz, radius: 0.85 });
      }
    } else if (island.biome === 'desert') {
      // Desierto Filosófico: Stepped sandstone pyramid + cacti
      const pyr = new THREE.Group();
      pyr.position.set(landX, DECK_Y, landZ);
      const sandstoneMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0xdba95c, roughness: 0.85, metalness: 0.04 })
      );
      const tiers = [
        { s: 5.4, h: 1.0, y: 0.5 },
        { s: 4.1, h: 1.0, y: 1.5 },
        { s: 2.8, h: 1.0, y: 2.5 },
        { s: 1.5, h: 1.0, y: 3.5 },
      ];
      for (const t of tiers) {
        const block = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(t.s, t.h, t.s)), sandstoneMat);
        block.position.y = t.y;
        block.castShadow = true;
        block.receiveShadow = true;
        pyr.add(block);
      }
      const capstone = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.75, 0)), goldMat);
      capstone.position.y = 4.65;
      pyr.add(capstone);

      const doorway = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 1.7, 0.5)), lanternGlowMat);
      doorway.position.set(0, 0.85, 2.55);
      pyr.add(doorway);
      group.add(pyr);
      colliders.push({ x: landX, z: landZ, radius: 3.0 });

      const cactusMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x3b8a57, roughness: 0.78, metalness: 0.02 })
      );
      for (const [ox, oz] of [
        [-6.5, -3.8],
        [6.9, -4.6],
        [6.1, 4.9],
      ]) {
        const cac = new THREE.Group();
        cac.position.set(cx + ox, DECK_Y, cz + oz);
        const stem = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 2.3, 0.55)), cactusMat);
        stem.position.y = 1.15;
        stem.castShadow = true;
        const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 0.42, 0.42)), cactusMat);
        arm.position.set(0.45, 1.35, 0);
        cac.add(stem, arm);
        group.add(cac);
        colliders.push({ x: cx + ox, z: cz + oz, radius: 0.65 });
      }
    } else if (isWorkshop) {
      // Taller de Juegos: Brick studio + smokestack + neon marquee
      const shop = new THREE.Group();
      shop.position.set(landX, DECK_Y, landZ);
      const hall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 3.1, 3.8)), brickMat);
      hall.position.y = 1.55;
      hall.castShadow = true;

      const roofMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x374c5b, roughness: 0.45, metalness: 0.48 })
      );
      const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 0.45, 4.2)), roofMat);
      roof.position.y = 3.25;
      roof.castShadow = true;

      const stack = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.55, 2.8, 8)), roofMat);
      stack.position.set(-1.7, 4.2, -0.8);
      stack.castShadow = true;

      const neonSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.65, 0.25)), cyanGlowMat);
      neonSign.position.set(0, 2.55, 1.98);

      const gate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 2.0, 0.3)), lanternGlowMat);
      gate.position.set(0, 1.0, 1.85);

      shop.add(hall, roof, stack, neonSign, gate);
      group.add(shop);
      colliders.push({ x: landX, z: landZ, radius: 2.95 });

      // Gentle steam puffs rising from smokestack
      for (let i = 0; i < 3; i++) {
        const puffMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xeaf6f7,
            roughness: 0.9,
            transparent: true,
            opacity: 0.55,
          })
        );
        const puff = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.42, 0)), puffMat);
        puff.position.set(landX - 1.7, DECK_Y + 5.9 + i * 0.9, landZ - 0.8);
        group.add(puff);
        animated.steamPuffs.push({ mesh: puff, baseY: DECK_Y + 5.8, phase: i * 2.1 });
      }
    } else if (isVolcano) {
      // Caldera Volcánica: Stepped basalt caldera cone with glowing lava core
      const volcano = new THREE.Group();
      volcano.position.set(landX, DECK_Y, landZ);
      const basaltMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x221316, roughness: 0.92, metalness: 0.12 })
      );
      const lavaMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xff3b1f,
          emissive: 0xff4d2e,
          emissiveIntensity: 0.85,
          roughness: 0.35,
          metalness: 0.1,
        })
      );
      const outerCone = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(2.4, 4.4, 3.6, 8)),
        basaltMat
      );
      outerCone.position.y = 1.8;
      outerCone.castShadow = true;
      outerCone.receiveShadow = true;

      const innerLava = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(1.7, 1.2, 0.4, 8)),
        lavaMat
      );
      innerLava.position.y = 3.45;

      const vent = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(0.55, 0)),
        lavaMat
      );
      vent.position.y = 3.9;

      volcano.add(outerCone, innerLava, vent);
      group.add(volcano);
      colliders.push({ x: landX, z: landZ, radius: 3.2 });

      // Lava rocks / basalt pillars around rim
      for (const [ox, oz] of [
        [-6.5, -3.8],
        [6.6, -4.2],
        [-6.1, 4.6],
        [6.3, 4.8],
      ]) {
        const rock = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.95, 0)), basaltMat);
        rock.position.set(cx + ox, DECK_Y + 0.65, cz + oz);
        rock.castShadow = true;
        group.add(rock);
        colliders.push({ x: cx + ox, z: cz + oz, radius: 0.75 });
      }
    } else if (isCrypt) {
      // Cripta y Ruinas: Weathered stone mausoleum with gothic spires and spectral glow
      const crypt = new THREE.Group();
      crypt.position.set(landX, DECK_Y, landZ);
      const cryptStoneMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x484054, roughness: 0.82, metalness: 0.08 })
      );
      const spectralGlowMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x8ef5e4,
          emissive: 0x5be4cf,
          emissiveIntensity: 0.65,
          roughness: 0.25,
          metalness: 0.2,
        })
      );

      const baseHall = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(4.6, 3.2, 3.8)),
        cryptStoneMat
      );
      baseHall.position.y = 1.6;
      baseHall.castShadow = true;

      const pediment = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(2.4, 1.8, 4)),
        cryptStoneMat
      );
      pediment.rotation.y = Math.PI / 4;
      pediment.position.y = 4.1;
      pediment.castShadow = true;

      const portalArch = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.2, 2.0, 0.4)),
        spectralGlowMat
      );
      portalArch.position.set(0, 1.0, 1.85);

      crypt.add(baseHall, pediment, portalArch);
      group.add(crypt);
      colliders.push({ x: landX, z: landZ, radius: 2.85 });

      // Ruined obelisks framing path
      for (const [ox, oz] of [
        [-6.4, -4.2],
        [6.5, -4.0],
        [-6.2, 4.8],
        [6.4, 4.7],
      ]) {
        const pillar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.75, 2.8, 0.75)),
          cryptStoneMat
        );
        pillar.position.set(cx + ox, DECK_Y + 1.4, cz + oz);
        pillar.castShadow = true;
        group.add(pillar);
        colliders.push({ x: cx + ox, z: cz + oz, radius: 0.65 });
      }
    } else if (isCoral) {
      // Arrecife de Coral: Sea reef spire with teal crystal formations and anemone blooms
      const reef = new THREE.Group();
      reef.position.set(landX, DECK_Y, landZ);
      const coralPinkMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0xe85d75, roughness: 0.55, metalness: 0.05 })
      );
      const coralTealMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38e8cb,
          emissive: 0x22bda4,
          emissiveIntensity: 0.45,
          roughness: 0.35,
          metalness: 0.15,
        })
      );
      const centralSpire = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(1.6, 4.4, 6)),
        coralPinkMat
      );
      centralSpire.position.y = 2.2;
      centralSpire.castShadow = true;

      const sideBranchL = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.35, 0.55, 2.2, 6)),
        coralTealMat
      );
      sideBranchL.rotation.z = Math.PI / 6;
      sideBranchL.position.set(-1.2, 2.0, 0);

      const sideBranchR = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.35, 0.55, 2.4, 6)),
        coralTealMat
      );
      sideBranchR.rotation.z = -Math.PI / 6;
      sideBranchR.position.set(1.2, 2.1, 0);

      const pearlOrb = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.55, 8, 8)),
        cyanGlowMat
      );
      pearlOrb.position.set(0, 4.5, 0);

      reef.add(centralSpire, sideBranchL, sideBranchR, pearlOrb);
      group.add(reef);
      colliders.push({ x: landX, z: landZ, radius: 2.8 });

      // Outlier coral formations
      for (const [ox, oz] of [
        [-6.6, -4.1],
        [6.8, -4.3],
        [-6.0, 4.9],
      ]) {
        const cluster = new THREE.Mesh(
          trackGeo(new THREE.OctahedronGeometry(0.85, 0)),
          coralPinkMat
        );
        cluster.scale.set(0.85, 1.6, 0.85);
        cluster.position.set(cx + ox, DECK_Y + 1.0, cz + oz);
        cluster.castShadow = true;
        group.add(cluster);
        colliders.push({ x: cx + ox, z: cz + oz, radius: 0.7 });
      }
    }

    // Main island portal pedestal right in front of the landmark along the walkway
    const portalDist = island.biome === 'patio' ? 4.3 : 3.8;
    const px = cx + Math.sin(toHubAngle) * portalDist;
    const pz = cz + Math.cos(toHubAngle) * portalDist;
    node.portalX = px;
    node.portalZ = pz;
    addPedestal(
      px,
      pz,
      island.title,
      island.loaned
        ? `Prestada por ${island.loaned.sourceMuseumTitle}`
        : 'Abrir colección y salas',
      island.id,
      'island'
    );

    // Up to 3 featured piece pedestals positioned cleanly along the plaza rim
    const islandPieces = piecesByIsland[island.id] || [];
    const featured = islandPieces.slice(0, 3);
    featured.forEach((piece, idx) => {
      const offsetAng = toHubAngle + (idx - 1) * 0.92 + (idx === 1 ? Math.PI * 0.55 : 0);
      const pedR = radius * 0.54;
      const fx = cx + Math.sin(offsetAng) * pedR;
      const fz = cz + Math.cos(offsetAng) * pedR;
      addPathStrip(cx, cz, fx, fz, 1.45, pathMat);
      addPedestal(
        fx,
        fz,
        piece.title,
        piece.subtitle || 'Pieza del archivo',
        island.id,
        'piece',
        piece
      );
    });
  }

  // Build arched 3D timber bridges with guardrails between islands
  for (const br of bridges) {
    const dx = br.bx - br.ax;
    const dz = br.bz - br.az;
    const yaw = Math.atan2(dx, dz);
    const segments = Math.max(8, Math.round(br.length / 2.2));
    const segLen = br.length / segments + 0.14;

    for (let i = 0; i < segments; i++) {
      const t = (i + 0.5) / segments;
      const mx = br.ax + dx * t;
      const mz = br.az + dz * t;
      const archY = DECK_Y + Math.sin(t * Math.PI) * br.archHeight;

      const plank = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(br.halfWidth * 2, 0.28, segLen)),
        bridgePlankMat
      );
      plank.position.set(mx, archY - 0.14, mz);
      plank.rotation.y = yaw;
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(plank);

      // Guardrail posts every 2 segments
      if (i % 2 === 0 || i === segments - 1) {
        const perpX = Math.cos(yaw) * (br.halfWidth - 0.12);
        const perpZ = -Math.sin(yaw) * (br.halfWidth - 0.12);
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.18, 0.95, 0.18)),
            darkWoodMat
          );
          post.position.set(mx + perpX * side, archY + 0.45, mz + perpZ * side);
          post.castShadow = true;
          group.add(post);
        }
      }
    }

    // Continuous side rails following the bridge chord
    for (const side of [-1, 1]) {
      const perpX = Math.cos(yaw) * (br.halfWidth - 0.12) * side;
      const perpZ = -Math.sin(yaw) * (br.halfWidth - 0.12) * side;
      const rail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.12, br.length)),
        darkWoodMat
      );
      rail.position.set(
        (br.ax + br.bx) * 0.5 + perpX,
        DECK_Y + br.archHeight * 0.55 + 0.85,
        (br.az + br.bz) * 0.5 + perpZ
      );
      rail.rotation.y = yaw;
      group.add(rail);
    }
  }

  // Spawn right on Patio 404's southern caminito facing the fountain!
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
      const d = Math.hypot(x - node.cx, z - node.cz);
      if (d <= node.radius - 0.25) {
        walkable = true;
        if (node.deckY > bestY) {
          bestY = node.deckY;
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
        const perpDist = Math.hypot(x - closestX, z - closestZ);
        if (perpDist <= br.halfWidth - 0.18) {
          const bridgeY = DECK_Y + Math.sin(clampedT * Math.PI) * br.archHeight;
          walkable = true;
          onBridge = true;
          if (bridgeY > bestY) {
            bestY = bridgeY;
          }
        }
      }
    }

    return {
      walkable,
      groundY: walkable ? bestY : 0,
      islandId,
      onBridge,
    };
  }

  return {
    group,
    islandNodes,
    bridges,
    colliders,
    triggers,
    animated,
    spawnPoint,
    sampleWalkableHeight,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of extraTextures) t.dispose();
    },
  };
}
