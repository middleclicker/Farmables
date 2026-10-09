import * as THREE from 'three';

const palette = {
  stone: new THREE.MeshStandardMaterial({ color: 0xb8ad91, roughness: 1 }),
  paleStone: new THREE.MeshStandardMaterial({ color: 0xd1c5a6, roughness: 1 }),
  barn: new THREE.MeshStandardMaterial({ color: 0x8b7357, roughness: 1 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x5a4534, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9e7b53, roughness: 1 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xe0d6bb, roughness: 1 }),
  slate: new THREE.MeshStandardMaterial({ color: 0x59615d, roughness: 1, side: THREE.DoubleSide }),
  tile: new THREE.MeshStandardMaterial({ color: 0x765e4f, roughness: 1, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: 0x78939a, roughness: 0.23, metalness: 0.14, transparent: true, opacity: 0.72 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe6ddc6, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x726b55, roughness: 1 }),
};
const geometryCache = new Map();

function box(group, w, h, d, x, y, z, material, shadows = true) {
  const key = `${w}|${h}|${d}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geometryCache.get(key), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function roof(group, width, depth, baseHeight, rise, material) {
  const w = width / 2 + 0.6, d = depth / 2 + 0.6;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, -d, 0, rise, -d, -w, 0, d,
    -w, 0, d, 0, rise, -d, 0, rise, d,
    0, rise, -d, w, 0, -d, 0, rise, d,
    0, rise, d, w, 0, -d, w, 0, d,
  ], 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = baseHeight;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export const BUILDING_SITES = [
  { id: 'farmhouse', x: 38, z: 212, width: 17, depth: 18, height: 5.8, kind: 'home', wall: 'paleStone', roofType: 'tile' },
  { id: 'shed', x: -41, z: 212, width: 22, depth: 23, height: 6.2, kind: 'shed', wall: 'barn', roofType: 'slate' },
  { id: 'shop', x: -42, z: -265, width: 17, depth: 16, height: 6, kind: 'shop', wall: 'paleStone', roofType: 'tile', doorSide: 1 },
  { id: 'cottage_a', x: -182, z: -265, width: 13, depth: 14, height: 5.3, kind: 'home', wall: 'stone', roofType: 'slate', doorSide: 1 },
  { id: 'cottage_b', x: 11, z: -268, width: 14, depth: 13, height: 5.5, kind: 'home', wall: 'plaster', roofType: 'tile', doorSide: 1 },
  { id: 'cottage_c', x: 74, z: -300, width: 12, depth: 13, height: 5.2, kind: 'home', wall: 'stone', roofType: 'slate', doorSide: 1 },
  { id: 'cottage_d', x: -178, z: -352, width: 14, depth: 16, height: 5.5, kind: 'home', wall: 'paleStone', roofType: 'tile', doorSide: 1 },
  { id: 'cottage_e', x: -43, z: -350, width: 13, depth: 14, height: 5.2, kind: 'home', wall: 'plaster', roofType: 'slate', doorSide: 1 },
  { id: 'cottage_f', x: 30, z: -388, width: 15, depth: 13, height: 5.5, kind: 'home', wall: 'stone', roofType: 'tile', doorSide: 1 },
];

function furnishing(group, kind, width, depth) {
  const wood = palette.darkWood, pale = palette.cream;
  if (kind === 'shed') {
    box(group, width - 3, 0.18, 1.2, 0, 1.15, depth / 2 - 1.1, palette.wood);
    for (const x of [-width / 2 + 2, 0, width / 2 - 2]) {
      box(group, 0.18, 1.2, 0.18, x, 0.55, depth / 2 - 1.1, wood);
      box(group, 0.2, 2.5, 0.2, x, 2.35, depth / 2 - 1.05, palette.soil);
    }
    box(group, 4.2, 1.4, 2, width / 2 - 3.5, 0.7, 0.5, palette.barn);
  } else if (kind === 'shop') {
    box(group, width - 4, 1.2, 1.4, 0, 0.6, 0, wood);
    for (const side of [-1, 1]) {
      box(group, 1.1, 3.1, depth - 4, side * (width / 2 - 1.1), 1.6, 1, palette.wood);
      for (const level of [1.1, 2.1]) box(group, 1.7, 0.12, depth - 4, side * (width / 2 - 1.1), level, 1, pale);
    }
    for (let i = 0; i < 6; i++) box(group, 0.55, 0.65, 0.55, -width / 2 + 2 + i * 1.2, 1.7, depth / 2 - 2, palette.soil);
  } else {
    box(group, 3.6, 0.18, 2.2, 0, 1.3, 0, palette.wood);
    for (const x of [-1.45, 1.45]) for (const z of [-0.8, 0.8]) box(group, 0.18, 1.3, 0.18, x, 0.66, z, wood);
    box(group, 2.1, 0.7, 1.4, -width / 2 + 2.1, 0.38, depth / 2 - 2, palette.barn);
    box(group, 2.1, 0.13, 1.4, -width / 2 + 2.1, 0.78, depth / 2 - 2, pale);
    box(group, 1.8, 2.6, 0.8, width / 2 - 1.5, 1.3, depth / 2 - 1.3, wood);
    box(group, 0.9, 0.9, 0.8, width / 2 - 1.5, 3, depth / 2 - 1.3, palette.soil);
  }
}

function sign(group, label, z, height, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#304334';
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = '#d9c28b';
  context.lineWidth = 8;
  context.strokeRect(8, 8, 496, 112);
  context.fillStyle = '#f3e4bc';
  context.font = 'bold 44px Georgia, serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }));
  mesh.position.set(0, height, z + side * 0.39);
  if (side < 0) mesh.rotation.y = Math.PI;
  group.add(mesh);
}

function building(scene, groundHeight, options) {
  const { id, x, z, width: w, depth: d, height: h, kind, doorSide = -1, wall = 'stone', roofType = 'slate' } = options;
  const group = new THREE.Group();
  group.position.set(x, groundHeight(x, z) + 0.12, z);
  scene.add(group);
  const material = palette[wall];
  const wallThickness = 0.4;
  const doorWidth = kind === 'shed' ? 5.4 : 2.4;
  const doorHeight = kind === 'shed' ? 4.3 : 2.65;
  const frontZ = doorSide * d / 2;
  const backZ = -frontZ;
  const sideWallLength = (w - doorWidth) / 2;
  const collision = [];

  box(group, w + 0.5, 0.23, d + 0.5, 0, -0.04, 0, kind === 'shed' ? palette.soil : palette.wood, false);
  box(group, w, h, wallThickness, 0, h / 2, backZ, material);
  collision.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z + backZ - 0.23, maxZ: z + backZ + 0.23 });
  for (const side of [-1, 1]) {
    box(group, wallThickness, h, d, side * w / 2, h / 2, 0, material);
    collision.push({ minX: x + side * w / 2 - 0.23, maxX: x + side * w / 2 + 0.23, minZ: z - d / 2, maxZ: z + d / 2 });
    const segmentX = side * (doorWidth / 2 + sideWallLength / 2);
    box(group, sideWallLength, h, wallThickness, segmentX, h / 2, frontZ, material);
    collision.push({ minX: x + segmentX - sideWallLength / 2, maxX: x + segmentX + sideWallLength / 2, minZ: z + frontZ - 0.23, maxZ: z + frontZ + 0.23 });
  }
  box(group, doorWidth, h - doorHeight, wallThickness, 0, doorHeight + (h - doorHeight) / 2, frontZ, material);
  box(group, doorWidth + 0.35, 0.24, 0.55, 0, doorHeight + 0.13, frontZ, palette.cream);
  for (const side of [-1, 1]) {
    box(group, 0.22, doorHeight, 0.55, side * (doorWidth / 2 + 0.08), doorHeight / 2, frontZ, palette.cream);
  }
  if (kind !== 'shed') {
    const door = box(group, doorWidth / 2 - 0.14, doorHeight - 0.1, 0.14, -doorWidth / 2 + 0.1, doorHeight / 2, frontZ + doorSide * 0.7, palette.darkWood);
    door.rotation.y = doorSide * 0.6;
    for (const side of [-1, 1]) {
      const wx = side * (doorWidth / 2 + sideWallLength / 2);
      box(group, 1.85, 1.55, 0.14, wx, 2.65, frontZ + doorSide * 0.25, palette.cream);
      box(group, 1.52, 1.28, 0.15, wx, 2.65, frontZ + doorSide * 0.35, palette.glass);
      box(group, 0.1, 1.34, 0.18, wx, 2.65, frontZ + doorSide * 0.45, palette.cream);
      box(group, 1.65, 0.09, 0.18, wx, 2.65, frontZ + doorSide * 0.45, palette.cream);
      box(group, 2.08, 0.17, 0.55, wx, 1.82, frontZ + doorSide * 0.36, palette.cream);
    }
  }
  for (const side of [-1, 1]) {
    box(group, 1.5, 1.45, 0.14, side * (w / 2 + 0.13), 2.75, -d * 0.17, palette.cream);
    box(group, 1.23, 1.2, 0.15, side * (w / 2 + 0.22), 2.75, -d * 0.17, palette.glass);
  }
  const roofGroup = new THREE.Group();
  group.add(roofGroup);
  roof(roofGroup, w, d, h, w * 0.29, palette[roofType]);
  for (const end of [-1, 1]) {
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute('position', new THREE.Float32BufferAttribute([
      -w / 2, h, end * d / 2, w / 2, h, end * d / 2, 0, h + w * 0.29, end * d / 2,
    ], 3));
    triangle.computeVertexNormals();
    const gable = new THREE.Mesh(triangle, new THREE.MeshStandardMaterial({ color: material.color, roughness: 1, side: THREE.DoubleSide }));
    gable.castShadow = true;
    roofGroup.add(gable);
  }
  if (kind !== 'shed') {
    box(roofGroup, 0.9, 2.2, 0.9, w * 0.24, h + w * 0.22, -d * 0.2, material);
    box(group, 0.18, 0.17, 1.8, 0, 0.08, frontZ + doorSide * 0.92, palette.soil, false);
  }
  furnishing(group, kind, w, d);
  if (id === 'farmhouse') sign(group, "JOHN'S FARM", frontZ, h - 1.05, doorSide);
  if (id === 'shed') sign(group, 'EQUIPMENT', frontZ, h - 0.78, doorSide);
  if (id === 'shop') sign(group, 'VILLAGE STORES', frontZ, h - 1.05, doorSide);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf6dfac, emissive: 0xffd99d, emissiveIntensity: 1.5 }));
  bulb.position.set(0, h - 0.65, 0);
  group.add(bulb);
  const interiorLight = new THREE.PointLight(0xffe4b7, kind === 'shed' ? 85 : 60, Math.max(w, d) * 1.3, 2);
  interiorLight.position.set(0, h - 1.2, 0);
  interiorLight.visible = false;
  group.add(interiorLight);

  return {
    id, kind, x, z, width: w, depth: d, height: h, baseY: group.position.y, roof: roofGroup, interiorLight, collision,
    door: { x, z: z + frontZ + doorSide * 2.2 },
    interact: { x, z: z - doorSide * Math.min(3, d / 3) },
    contains(px, pz) { return Math.abs(px - x) < w / 2 - 0.35 && Math.abs(pz - z) < d / 2 - 0.35; },
  };
}

export function createBuildings(scene, heightAt) {
  const buildings = BUILDING_SITES.map(definition => building(scene, heightAt, definition));
  return {
    list: buildings,
    update(player) { buildings.forEach(item => {
      item.roof.visible = !item.contains(player.x, player.z);
      item.interiorLight.visible = Math.hypot(player.x - item.x, player.z - item.z) < 34;
    }); },
    inside(player) { return buildings.find(item => item.contains(player.x, player.z)) || null; },
    collides(x, z, radius = 0.42) {
      return buildings.some(item => item.collision.some(wall => x + radius > wall.minX && x - radius < wall.maxX && z + radius > wall.minZ && z - radius < wall.maxZ));
    },
    cameraFraction(from, to) {
      for (let step = 1; step <= 32; step++) {
        const fraction = step / 32;
        const x = from.x + (to.x - from.x) * fraction;
        const y = from.y + (to.y - from.y) * fraction;
        const z = from.z + (to.z - from.z) * fraction;
        if (buildings.some(item => y < item.baseY + item.height + 1.5 && (
          (!item.contains(from.x, from.z) && item.contains(x, z)) || item.collision.some(wall =>
            x + 0.15 > wall.minX && x - 0.15 < wall.maxX && z + 0.15 > wall.minZ && z - 0.15 < wall.maxZ)))) {
          return Math.max(0.12, (step - 2) / 32);
        }
      }
      return 1;
    },
  };
}
