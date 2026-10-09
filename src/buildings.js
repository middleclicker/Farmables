import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import stoneDiff from '../assets/materials/plaster_stone_wall_02_diff.webp';
import stoneNormal from '../assets/materials/plaster_stone_wall_02_normal.webp';
import plasterDiff from '../assets/materials/rough_plaster_03_diff.webp';
import plasterNormal from '../assets/materials/rough_plaster_03_normal.webp';
import sidingDiff from '../assets/materials/weathered_plank_siding_diff.webp';
import sidingNormal from '../assets/materials/weathered_plank_siding_normal.webp';
import slateDiff from '../assets/materials/roof_slates_02_diff.webp';
import slateNormal from '../assets/materials/roof_slates_02_normal.webp';
import tileDiff from '../assets/materials/roof_3_diff.webp';
import tileNormal from '../assets/materials/roof_3_normal.webp';
import concreteDiff from '../assets/materials/hangar_concrete_floor_diff.webp';
import concreteNormal from '../assets/materials/hangar_concrete_floor_normal.webp';
import floorDiff from '../assets/materials/old_wooden_floor_01_diff.webp';
import floorNormal from '../assets/materials/old_wooden_floor_01_normal.webp';
import woodDiff from '../assets/materials/wood_plank_wall_diff.webp';
import woodNormal from '../assets/materials/wood_plank_wall_normal.webp';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
const textureReady = [];
function buildingTexture(url, color) {
  if (textureCache.has(url)) return textureCache.get(url);
  let markReady;
  textureReady.push(new Promise(resolve => { markReady = resolve; }));
  const texture = textureLoader.load(url, markReady, undefined, markReady);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, texture);
  return texture;
}
export async function prewarmBuildingTextures(renderer) {
  await Promise.all(textureReady);
  for (const texture of textureCache.values()) if (texture.image?.width) renderer.initTexture(texture);
}
function mapped(diffuse, normal, tint = 0xffffff, side = THREE.FrontSide) {
  const map = buildingTexture(diffuse, true);
  const normalMap = buildingTexture(normal, false);
  return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.48, 0.48), color: tint, roughness: 0.95, side });
}

const palette = {
  stone: mapped(stoneDiff, stoneNormal, 0xe1d3b9),
  paleStone: mapped(stoneDiff, stoneNormal, 0xfff5db),
  barn: mapped(sidingDiff, sidingNormal),
  darkWood: mapped(woodDiff, woodNormal, 0x84694c),
  wood: mapped(woodDiff, woodNormal, 0xc6a17c),
  plaster: mapped(plasterDiff, plasterNormal, 0xf2ead9),
  slate: mapped(slateDiff, slateNormal, 0xb7bdbd, THREE.DoubleSide),
  tile: mapped(tileDiff, tileNormal, 0xc4a891, THREE.DoubleSide),
  concrete: mapped(concreteDiff, concreteNormal, 0xddd5c2),
  floor: mapped(floorDiff, floorNormal, 0xb99a76),
  glass: new THREE.MeshStandardMaterial({ color: 0x78939a, roughness: 0.23, metalness: 0.14, transparent: true, opacity: 0.72 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe6ddc6, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x726b55, roughness: 1 }),
};
palette.concrete.emissive.set(0xffffff);
palette.concrete.emissiveMap = palette.concrete.map;
palette.concrete.emissiveIntensity = 1.05;
const geometryCache = new Map();

function box(group, w, h, d, x, y, z, material, shadows = true) {
  const key = `${w}|${h}|${d}`;
  if (!geometryCache.has(key)) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    const scales = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let face = 0; face < 6; face++) for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner;
      uv.setXY(index, uv.getX(index) * scales[face][0] / 2.1, uv.getY(index) * scales[face][1] / 2.1);
    }
    geometryCache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometryCache.get(key), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function batchBuildingBoxes(group) {
  const batches = new Map();
  for (const mesh of group.children) {
    if (!mesh.isMesh || mesh.children.length || mesh.geometry.type !== 'BoxGeometry' || mesh.material.transparent) continue;
    const key = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  }
  for (const meshes of batches.values()) {
    if (meshes.length < 3) continue;
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(item => item.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, meshes[0].material);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach(mesh => group.remove(mesh));
    group.add(merged);
  }
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
  const positions = geometry.attributes.position;
  const uvs = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    uvs.push(Math.abs(x) * Math.hypot(w, rise) / w / 2.1, (z + d) / 2.1);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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

const product = {
  lime: new THREE.MeshStandardMaterial({ color: 0xdedcc9, roughness: 1 }),
  seed: new THREE.MeshStandardMaterial({ color: 0xbea169, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x685f49, roughness: 1 }),
  green: new THREE.MeshStandardMaterial({ color: 0x47633e, roughness: 0.75 }),
  red: new THREE.MeshStandardMaterial({ color: 0x99533d, roughness: 0.72 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x59605e, metalness: 0.62, roughness: 0.45 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x282a29, roughness: 0.9 }),
  straw: new THREE.MeshStandardMaterial({ color: 0xbf9c60, roughness: 1 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc6a669, metalness: 0.72, roughness: 0.34 }),
  light: new THREE.MeshStandardMaterial({ color: 0xfff1d3, emissive: 0xffe7ad, emissiveIntensity: 1.25, roughness: 0.55 }),
};
const wheelGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.28, 12);
function wheel(group, x, y, z) {
  const tire = new THREE.Mesh(wheelGeometry, product.rubber);
  tire.position.set(x, y, z);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), product.metal);
  hub.position.set(x, y, z);
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
}

function furnishing(group, kind, width, depth) {
  const obstacles = [];
  const block = (x, z, w, d) => obstacles.push({ x, z, w, d });
  const wood = palette.darkWood;
  if (kind === 'shed') {
    const back = depth / 2 - 1.45;
    box(group, width - 3.4, 0.18, 1.55, 0, 1.04, back, palette.wood);
    box(group, width - 3.4, 2.5, 0.12, 0, 2.6, depth / 2 - 0.6, palette.darkWood);
    for (const x of [-width / 2 + 2, 0, width / 2 - 2]) {
      box(group, 0.2, 0.97, 0.2, x, 0.5, back, wood);
      box(group, 0.08, 1.4, 0.08, x, 2.9, depth / 2 - 0.44, product.metal);
      box(group, 0.45, 0.15, 0.1, x, 2.3, depth / 2 - 0.4, product.metal);
    }
    block(0, back, width - 3.4, 1.55);
    // A parked mower, cultivator, and drill make the rental shed legible at a glance.
    box(group, 3.5, 0.36, 1.75, -6.6, 0.52, 1.4, product.green);
    box(group, 3.75, 0.11, 0.18, -6.6, 0.78, 0.7, product.metal);
    for (const x of [-8.3, -4.9]) wheel(group, x, 0.56, 1.4);
    block(-6.6, 1.4, 4.2, 2.6);
    for (const z of [-2.8, -1.4, 0]) box(group, 3.5, 0.15, 0.16, 6.7, 0.75, z, product.red);
    for (const x of [5.3, 6.7, 8.1]) for (const z of [-2.8, -1.4, 0]) {
      box(group, 0.09, 0.76, 0.1, x, 0.4, z, product.metal);
    }
    wheel(group, 4.8, 0.53, -1.4); wheel(group, 8.6, 0.53, -1.4);
    block(6.7, -1.4, 4.5, 3.7);
    box(group, 3.8, 0.8, 1.25, 6.7, 1.1, 4.0, product.green);
    box(group, 4.2, 0.16, 2.1, 6.7, 0.52, 4.0, product.metal);
    for (const x of [5.1, 6.2, 7.3, 8.4]) box(group, 0.08, 0.45, 0.08, x, 0.35, 3.25, product.metal);
    wheel(group, 4.55, 0.58, 4); wheel(group, 8.85, 0.58, 4);
    block(6.7, 4, 4.6, 2.8);
    for (let i = 0; i < 5; i++) {
      const x = -width / 2 + 1.7 + (i % 2) * 1.15, z = 5.3 + Math.floor(i / 2) * 1.5;
      box(group, 1.0, 0.65, 1.25, x, 0.36, z, product.straw);
      box(group, 1.03, 0.06, 1.28, x, 0.69, z, palette.wood);
    }
    block(-width / 2 + 2.2, 6.8, 3.4, 4.4);
    for (const x of [-width / 2 + 1.5, width / 2 - 1.5]) {
      for (const y of [1.2, 2.4, 3.6]) box(group, 1.3, 0.12, 4.4, x, y, -5.2, product.metal);
      for (const z of [-7.2, -3.2]) box(group, 0.1, 3.7, 0.1, x, 1.9, z, product.metal);
      block(x, -5.2, 1.5, 4.6);
    }
    for (let i = 0; i < 5; i++) box(group, 0.72, 0.82, 0.56, -width / 2 + 1.5, 1.7, -7.1 + i * 0.9, i % 2 ? product.seed : product.lime);
    for (let i = 0; i < 4; i++) box(group, 0.75, 0.75, 0.75, width / 2 - 1.5, 1.68, -7 + i * 0.95, product.soil);
    sign(group, 'WORKSHOP  •  EQUIPMENT HIRE', depth / 2 - 1.05, 4.65, -1);
  } else if (kind === 'shop') {
    const counterZ = -depth / 2 + 2.1;
    box(group, width - 4.2, 1.15, 1.35, 0, 0.59, counterZ, wood);
    box(group, width - 4.1, 0.13, 1.55, 0, 1.2, counterZ, palette.wood);
    box(group, 0.72, 0.35, 0.48, width / 2 - 3.15, 1.47, counterZ, product.metal);
    block(0, counterZ, width - 4.2, 1.6);
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 1.2);
      for (const y of [0.92, 1.85, 2.78]) box(group, 1.6, 0.13, 9.8, x, y, 0.8, palette.wood);
      for (const z of [-3.8, 5.2]) box(group, 0.12, 3.1, 0.12, x, 1.55, z, wood);
      block(x, 0.8, 1.8, 10);
      for (let i = 0; i < 10; i++) {
        const z = -3.25 + i * 0.84;
        box(group, 0.62, 0.66, 0.52, x, 1.32, z, side < 0 ? product.seed : product.lime);
        box(group, 0.62, 0.66, 0.52, x, 2.24, z, i % 3 ? product.soil : product.seed);
        box(group, 0.53, 0.45, 0.47, x, 3.07, z, i % 2 ? product.green : product.red);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = -2.8 + i * 1.35;
      box(group, 0.8, 0.95, 0.52, x, 1.73, counterZ, i % 2 ? product.lime : product.seed);
      box(group, 0.72, 0.17, 0.53, x, 2.12, counterZ, product.green);
    }
    sign(group, 'SEED  •  SOIL  •  SUPPLIES', -depth / 2 + 0.5, 4.8, 1);
    box(group, 3.3, 0.07, 2.6, 0, 0.05, 3.5, product.red, false);
    box(group, 2.3, 0.18, 1.25, 3.25, 0.9, 1.8, palette.wood);
    for (const x of [2.3, 4.2]) for (const z of [1.35, 2.25]) box(group, 0.12, 0.85, 0.12, x, 0.44, z, wood);
    for (let i = 0; i < 6; i++) box(group, 0.52, 0.6, 0.48, 2.38 + (i % 3) * 0.83, 1.27, 1.44 + Math.floor(i / 3) * 0.68, i % 2 ? product.seed : product.lime);
    block(3.25, 1.8, 2.45, 1.4);
    for (let i = 0; i < 4; i++) box(group, 0.77, 0.67, 0.65, -3.25 + (i % 2) * 0.84, 0.37 + Math.floor(i / 2) * 0.66, 2.2, product.soil);
    block(-2.85, 2.2, 1.8, 0.9);
  } else {
    const tableX = kind === 'home' ? -width / 2 + 3.4 : -width / 2 + 2.8;
    box(group, 3.4, 0.17, 2.1, tableX, 1.25, 0, palette.wood);
    for (const x of [tableX - 1.35, tableX + 1.35]) for (const z of [-0.82, 0.82]) box(group, 0.16, 1.2, 0.16, x, 0.62, z, wood);
    block(tableX, 0, 3.5, 2.2);
    box(group, 1.45, 0.85, 0.8, width / 2 - 2, 0.44, depth / 2 - 2.2, product.green);
    box(group, 1.45, 1.15, 0.17, width / 2 - 2, 1.15, depth / 2 - 2.54, product.green);
    box(group, 1.8, 2.7, 0.65, width / 2 - 1.4, 1.4, -depth / 2 + 2.4, wood);
    for (const y of [0.8, 1.5, 2.2]) box(group, 1.6, 0.1, 0.8, width / 2 - 1.4, y, -depth / 2 + 2.4, palette.wood);
    block(width / 2 - 1.5, -depth / 2 + 2.4, 1.8, 1);
    if (width > 16) {
      box(group, 2.6, 1.05, 0.75, -width / 2 + 2.4, 0.55, depth / 2 - 2.1, palette.darkWood);
      box(group, 2.65, 0.1, 0.92, -width / 2 + 2.4, 1.1, depth / 2 - 2.1, palette.wood);
      box(group, 1.8, 1.3, 0.08, -width / 2 + 2.4, 2.25, depth / 2 - 0.55, product.straw);
      sign(group, 'FARM CALENDAR', depth / 2 - 0.8, 4.5, -1);
      block(-width / 2 + 2.4, depth / 2 - 2.1, 2.7, 1.2);
    }
  }
  return obstacles;
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
  context.fillText(label, 256, 66, 470);
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

  box(group, w + 0.5, 0.23, d + 0.5, 0, -0.04, 0, kind === 'shed' ? palette.concrete : palette.floor, false);
  box(group, w, h, wallThickness, 0, h / 2, backZ, material);
  collision.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z + backZ - 0.23, maxZ: z + backZ + 0.23 });
  for (const side of [-1, 1]) {
    if (kind === 'shed') box(group, wallThickness, h, d, side * w / 2, h / 2, 0, material);
    else {
      const windowZ = -d * 0.17, windowWidth = 1.5, windowBottom = 2.05, windowTop = 3.5;
      const start = -d / 2, end = d / 2;
      const before = windowZ - windowWidth / 2 - start, after = end - (windowZ + windowWidth / 2);
      box(group, wallThickness, h, before, side * w / 2, h / 2, start + before / 2, material);
      box(group, wallThickness, h, after, side * w / 2, h / 2, end - after / 2, material);
      box(group, wallThickness, windowBottom, windowWidth, side * w / 2, windowBottom / 2, windowZ, material);
      box(group, wallThickness, h - windowTop, windowWidth, side * w / 2, windowTop + (h - windowTop) / 2, windowZ, material);
    }
    collision.push({ minX: x + side * w / 2 - 0.23, maxX: x + side * w / 2 + 0.23, minZ: z - d / 2, maxZ: z + d / 2 });
    const segmentX = side * (doorWidth / 2 + sideWallLength / 2);
    if (kind === 'shed') box(group, sideWallLength, h, wallThickness, segmentX, h / 2, frontZ, material);
    else {
      const windowWidth = 1.85, windowBottom = 1.88, windowTop = 3.43;
      const remaining = (sideWallLength - windowWidth) / 2;
      box(group, remaining, h, wallThickness, segmentX - (sideWallLength + windowWidth) / 4, h / 2, frontZ, material);
      box(group, remaining, h, wallThickness, segmentX + (sideWallLength + windowWidth) / 4, h / 2, frontZ, material);
      box(group, windowWidth, windowBottom, wallThickness, segmentX, windowBottom / 2, frontZ, material);
      box(group, windowWidth, h - windowTop, wallThickness, segmentX, windowTop + (h - windowTop) / 2, frontZ, material);
    }
    collision.push({ minX: x + segmentX - sideWallLength / 2, maxX: x + segmentX + sideWallLength / 2, minZ: z + frontZ - 0.23, maxZ: z + frontZ + 0.23 });
  }
  box(group, doorWidth, h - doorHeight, wallThickness, 0, doorHeight + (h - doorHeight) / 2, frontZ, material);
  box(group, doorWidth + 0.35, 0.24, 0.55, 0, doorHeight + 0.13, frontZ, palette.cream);
  for (const side of [-1, 1]) {
    box(group, 0.22, doorHeight, 0.55, side * (doorWidth / 2 + 0.08), doorHeight / 2, frontZ, palette.cream);
  }
  if (kind !== 'shed') {
    const door = box(group, doorWidth / 2 - 0.14, doorHeight - 0.1, 0.14, -doorWidth / 2 + 0.1, doorHeight / 2, frontZ + doorSide * 0.7, product.green);
    door.rotation.y = doorSide * 0.6;
    for (const y of [-0.57, 0.56]) {
      box(door, 0.76, 0.79, 0.035, 0, y, doorSide * 0.09, palette.darkWood);
      box(door, 0.65, 0.68, 0.04, 0, y, doorSide * 0.12, product.green);
    }
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), product.brass);
    handle.position.set(0.37, -0.03, doorSide * 0.13);
    door.add(handle);
    for (const side of [-1, 1]) {
      const wx = side * (doorWidth / 2 + sideWallLength / 2);
      box(group, 1.52, 1.28, 0.15, wx, 2.65, frontZ + doorSide * 0.35, palette.glass);
      box(group, 1.85, 0.12, 0.21, wx, 3.46, frontZ + doorSide * 0.37, palette.cream);
      box(group, 1.85, 0.12, 0.21, wx, 1.85, frontZ + doorSide * 0.37, palette.cream);
      for (const sideOfWindow of [-1, 1]) box(group, 0.12, 1.55, 0.21, wx + sideOfWindow * 0.87, 2.65, frontZ + doorSide * 0.37, palette.cream);
      box(group, 0.1, 1.34, 0.18, wx, 2.65, frontZ + doorSide * 0.45, palette.cream);
      box(group, 1.65, 0.09, 0.18, wx, 2.65, frontZ + doorSide * 0.45, palette.cream);
      box(group, 2.08, 0.17, 0.55, wx, 1.82, frontZ + doorSide * 0.36, palette.cream);
    }
  }
  if (kind === 'shed') {
    box(group, 10.5, 0.17, 0.3, 0, doorHeight + 0.38, frontZ + doorSide * 0.47, product.metal);
    for (const side of [-1, 1]) {
      const panelX = side * (doorWidth / 2 + 1.52);
      box(group, 2.75, doorHeight - 0.16, 0.16, panelX, doorHeight / 2, frontZ + doorSide * 0.5, palette.barn);
      const brace = box(group, 0.18, 4.3, 0.2, panelX, doorHeight / 2, frontZ + doorSide * 0.63, palette.wood);
      brace.rotation.z = side * 0.57;
      box(group, 2.82, 0.16, 0.22, panelX, 0.42, frontZ + doorSide * 0.63, palette.wood);
    }
  }
  box(group, w - 0.5, 0.16, d - 0.5, 0, h - 0.18, 0, kind === 'shed' ? palette.wood : palette.cream, false);
  if (kind === 'shed') for (let z = -d / 2 + 3; z < d / 2; z += 5) {
    box(group, w - 0.5, 0.26, 0.24, 0, h - 0.45, z, palette.darkWood);
  }
  for (const z of kind === 'shed' ? [-5, 3, 8] : [-d / 3, d / 3]) {
    box(group, 2.8, 0.07, 0.46, 0, h - 0.32, z, product.metal, false);
    box(group, 2.46, 0.045, 0.27, 0, h - 0.37, z, product.light, false);
  }
  for (const side of [-1, 1]) {
    if (kind === 'shed') continue;
    box(group, 1.23, 1.2, 0.15, side * (w / 2 + 0.22), 2.75, -d * 0.17, palette.glass);
    for (const y of [2.03, 3.48]) box(group, 0.18, 0.12, 1.6, side * (w / 2 + 0.25), y, -d * 0.17, palette.cream);
    for (const dz of [-0.78, 0.78]) box(group, 0.18, 1.5, 0.12, side * (w / 2 + 0.25), 2.75, -d * 0.17 + dz, palette.cream);
  }
  const roofGroup = new THREE.Group();
  group.add(roofGroup);
  roof(roofGroup, w, d, h, w * 0.29, palette[roofType]);
  for (const end of [-1, 1]) {
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute('position', new THREE.Float32BufferAttribute([
      -w / 2, h, end * d / 2, w / 2, h, end * d / 2, 0, h + w * 0.29, end * d / 2,
    ], 3));
    triangle.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w / 2.1, 0, w / 4.2, w * 0.29 / 2.1], 2));
    triangle.computeVertexNormals();
    const gableMaterial = material.clone();
    gableMaterial.side = THREE.DoubleSide;
    const gable = new THREE.Mesh(triangle, gableMaterial);
    gable.castShadow = true;
    roofGroup.add(gable);
  }
  if (kind !== 'shed') {
    box(roofGroup, 0.9, 2.2, 0.9, w * 0.24, h + w * 0.22, -d * 0.2, material);
    box(group, 0.18, 0.17, 1.8, 0, 0.08, frontZ + doorSide * 0.92, palette.soil, false);
    box(group, 4.05, 0.16, 1.25, 0, 3.08, frontZ + doorSide * 0.64, palette[roofType]);
  }
  box(group, kind === 'shed' ? doorWidth + 2 : doorWidth + 1.2, 0.08, kind === 'shed' ? 3.5 : 2.65,
    0, 0.025, frontZ + doorSide * (kind === 'shed' ? 2 : 1.7), kind === 'shed' ? palette.concrete : palette.soil, false);
  const furniture = furnishing(group, kind, w, d);
  for (const item of furniture) collision.push({
    minX: x + item.x - item.w / 2, maxX: x + item.x + item.w / 2,
    minZ: z + item.z - item.d / 2, maxZ: z + item.z + item.d / 2,
  });
  if (id === 'farmhouse') sign(group, "JOHN'S FARM", frontZ, h - 1.05, doorSide);
  if (id === 'shed') sign(group, 'EQUIPMENT', frontZ, h - 0.78, doorSide);
  if (id === 'shop') sign(group, 'FARM SUPPLIES', frontZ, h - 1.05, doorSide);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf6dfac, emissive: 0xffd99d, emissiveIntensity: 1.5 }));
  bulb.position.set(0, h - 0.65, 0);
  group.add(bulb);
  batchBuildingBoxes(group);
  return {
    id, kind, x, z, width: w, depth: d, height: h, baseY: group.position.y, roof: roofGroup, collision,
    door: { x, z: z + frontZ + doorSide * 2.2 },
    interact: { x, z: z - doorSide * Math.min(3, d / 3) },
    contains(px, pz) { return Math.abs(px - x) < w / 2 - 0.35 && Math.abs(pz - z) < d / 2 - 0.35; },
  };
}

export function createBuildings(scene, heightAt) {
  const buildings = BUILDING_SITES.map(definition => building(scene, heightAt, definition));
  // One always-present light avoids compiling a different material/light
  // combination the first time John approaches each furnished interior.
  const interiorLight = new THREE.PointLight(0xffe9cf, 0, 31, 2);
  scene.add(interiorLight);
  return {
    list: buildings,
    update(player) {
      let closest = null, distance = Infinity;
      buildings.forEach(item => {
        item.roof.visible = !item.contains(player.x, player.z);
        const candidate = Math.hypot(player.x - item.x, player.z - item.z);
        if (candidate < distance) { closest = item; distance = candidate; }
      });
      if (closest) {
        interiorLight.position.set(closest.x, closest.baseY + closest.height - 1.2, closest.z);
        interiorLight.intensity = (closest.kind === 'shed' ? 105 : 78) * (1 - THREE.MathUtils.smoothstep(distance, 19, 36));
      }
    },
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
