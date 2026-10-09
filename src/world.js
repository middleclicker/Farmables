import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import grassDiffuse from '../assets/leafy_grass_diff.webp';
import grassNormal from '../assets/leafy_grass_normal.webp';
import soilDiffuse from '../assets/farm_soil_diff.webp';
import soilNormal from '../assets/farm_soil_normal.webp';
import asphaltDiffuse from '../assets/worn_asphalt_diff.webp';
import asphaltNormal from '../assets/worn_asphalt_normal.webp';
import villageStoneDiffuse from '../assets/materials/plaster_stone_wall_02_diff.webp';
import villageStoneNormal from '../assets/materials/plaster_stone_wall_02_normal.webp';
import villageRoofDiffuse from '../assets/materials/roof_slates_02_diff.webp';
import villageRoofNormal from '../assets/materials/roof_slates_02_normal.webp';
import oakTreeUrl from '../assets/oak-tree.glb?url';
import birchTreeUrl from '../assets/birch-tree.glb?url';
import { FIELD_COLUMNS, FIELD_ROWS } from './farming.js';
import { FIELD_BOUNDS, WORK_COLUMNS, WORK_ROWS, workBits, workedAt } from './fieldwork.js';
import { BUILDING_SITES, createBuildings } from './buildings.js';
import { createVehicles } from './vehicles.js';
import { createAtmosphere } from './weather.js';

const FIELD = FIELD_BOUNDS;
const WORLD_SIZE = 1000;
const dummy = new THREE.Object3D();

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296);
}
const random = randomGenerator(748201);
const between = (a, b) => a + (b - a) * random();
const textureLoader = new THREE.TextureLoader();

function surfaceTexture(url, repeatX, repeatY, color = false) {
  const texture = textureLoader.load(url);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function rawHeightAt(x, z) {
  const rolling = 1.45 * Math.sin(x / 72) * Math.cos(z / 89)
    + 0.8 * Math.sin((x + z) / 48)
    + 0.42 * Math.sin(x / 24 + z / 39);
  const westHill = 12 * Math.exp(-((x + 360) ** 2 / 42000 + (z + 115) ** 2 / 130000));
  const eastHill = 14 * Math.exp(-((x - 360) ** 2 / 49000 + (z + 270) ** 2 / 125000));
  const farHill = 8 * Math.exp(-((z + 465) ** 2 / 42000)) * Math.sin(x / 105 + 1.8) ** 2;
  return rolling + westHill + eastHill + farHill;
}

export function heightAt(x, z) {
  const original = rawHeightAt(x, z);
  for (const site of BUILDING_SITES) {
    const halfWidth = site.width / 2 + 1;
    const halfDepth = site.depth / 2 + 1;
    const edge = Math.max((Math.abs(x - site.x) - halfWidth) / 6, (Math.abs(z - site.z) - halfDepth) / 6);
    if (edge >= 1) continue;
    const blend = THREE.MathUtils.smoothstep(Math.max(0, edge), 0, 1);
    return THREE.MathUtils.lerp(rawHeightAt(site.x, site.z), original, blend);
  }
  return original;
}

export function roadX(z) {
  return -110 + 9 * Math.sin(z / 165) + 4 * Math.sin(z / 73);
}

function terrain(scene) {
  const segments = 200;
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  const base = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    position.setY(i, heightAt(x, z));
    const dry = Math.sin(x * 0.063) * Math.cos(z * 0.057) * 0.5 + 0.5;
    const fleck = Math.sin(x * 0.47 + z * 0.34) * 0.03;
    base.setRGB(0.235 + dry * 0.07 + fleck, 0.335 + dry * 0.085 + fleck, 0.174 + dry * 0.042);
    colors.push(base.r, base.g, base.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: surfaceTexture(grassDiffuse, 110, 110, true),
    normalMap: surfaceTexture(grassNormal, 110, 110),
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xd2dfbc,
    roughness: 1,
  }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function makeNoiseTexture(colors, size = 256, seed = 12) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const noise = randomGenerator(seed);
  for (let i = 0; i < size * size; i++) {
    const shade = (noise() - 0.5) * colors.variation;
    image.data[i * 4] = colors.r + shade;
    image.data[i * 4 + 1] = colors.g + shade;
    image.data[i * 4 + 2] = colors.b + shade;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const r = randomGenerator(9024);
  ctx.fillStyle = '#66834d';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 580; i++) {
    const x = r() * 512, y = r() * 512;
    const radius = 7 + r() * 33;
    ctx.fillStyle = ['#78905916', '#a0a06a13', '#3d6e4018', '#b2a46c14'][i % 4];
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * (0.6 + r()), r() * 6.28, 0, 6.28);
    ctx.fill();
  }
  for (let i = 0; i < 26000; i++) {
    const x = r() * 512, y = r() * 512;
    ctx.strokeStyle = ['#d2bd7d38', '#355d3637', '#a7b87846', '#f0da9b24'][i % 4];
    ctx.lineWidth = 0.5 + r() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r() * 2 - 1, y - 1 - r() * 3);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function patchGeometry(x0, x1, z0, z1, xSegments, zSegments, offset = 0.08) {
  const geometry = new THREE.PlaneGeometry(x1 - x0, z1 - z0, xSegments, zSegments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)) + offset);
    uv.setXY(i, (position.getX(i) - x0) / 30, (position.getZ(i) - z0) / 30);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function stripAlongZ(scene, xAtZ, z0, z1, width, material, offset = 0.13, segments = 120) {
  const vertices = [], uvs = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const z = z0 + (z1 - z0) * i / segments;
    const x = xAtZ(z);
    for (const side of [-1, 1]) {
      const px = x + side * width / 2;
      vertices.push(px, heightAt(px, z) + offset, z);
      uvs.push(side < 0 ? 0 : 1, i / segments * (z1 - z0) / 35);
    }
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function road(scene) {
  const verge = new THREE.MeshStandardMaterial({ color: 0x668047, roughness: 1, side: THREE.DoubleSide });
  const asphalt = new THREE.MeshStandardMaterial({
    map: surfaceTexture(asphaltDiffuse, 4, 19, true),
    normalMap: surfaceTexture(asphaltNormal, 4, 19),
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0xc5c7be, roughness: 0.98, side: THREE.DoubleSide,
  });
  stripAlongZ(scene, roadX, -500, 500, 19, verge, 0.075);
  stripAlongZ(scene, roadX, -500, 500, 10.5, asphalt, 0.13);
  const edge = new THREE.MeshStandardMaterial({ color: 0xd7d3ae, roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    stripAlongZ(scene, z => roadX(z) + side * 4.8, -495, 495, 0.14, edge, 0.16, 100);
  }
  for (let z = -490; z < 490; z += 20) {
    stripAlongZ(scene, roadX, z, z + 6, 0.15, edge, 0.165, 3);
  }
}

function field(scene) {
  const cellWidth = (FIELD.maxX - FIELD.minX) / FIELD_COLUMNS;
  const cellDepth = (FIELD.maxZ - FIELD.minZ) / FIELD_ROWS;
  function maskTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = WORK_COLUMNS;
    canvas.height = WORK_ROWS;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { canvas, texture, context: canvas.getContext('2d') };
  }
  function limePowderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e0ddcd';
    context.fillRect(0, 0, 512, 512);
    const speckle = randomGenerator(91642);
    for (let i = 0; i < 65000; i++) {
      const tone = Math.floor(195 + speckle() * 55);
      context.fillStyle = `rgba(${tone},${tone - 2},${tone - 11},${0.18 + speckle() * 0.55})`;
      const size = 0.3 + speckle() * 1.15;
      context.fillRect(speckle() * 512, speckle() * 512, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 14);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }
  const masks = { mow: maskTexture(), lime: maskTexture(), cultivate: maskTexture(), sow: maskTexture() };
  const overlayGeometry = patchGeometry(FIELD.minX, FIELD.maxX, FIELD.minZ, FIELD.maxZ, 31, 57, 0.12);
  const uv = overlayGeometry.attributes.uv;
  const position = overlayGeometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    (position.getX(i) - FIELD.minX) / (FIELD.maxX - FIELD.minX),
    (position.getZ(i) - FIELD.minZ) / (FIELD.maxZ - FIELD.minZ));
  uv.needsUpdate = true;
  const makeOverlay = (name, material, lift) => {
    const mesh = new THREE.Mesh(overlayGeometry.clone(), material);
    const vertices = mesh.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) vertices.setY(i, vertices.getY(i) + lift);
    vertices.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  };
  const overlays = {
    mow: makeOverlay('mow', new THREE.MeshStandardMaterial({
      map: surfaceTexture(grassDiffuse, 6, 10, true), alphaMap: masks.mow.texture,
      color: 0x9d9a70, transparent: true, opacity: 0.72, depthWrite: false, roughness: 1, side: THREE.DoubleSide,
    }), 0),
    lime: makeOverlay('lime', new THREE.MeshStandardMaterial({
      map: limePowderTexture(), alphaMap: masks.lime.texture,
      color: 0xe2dfd1, transparent: true, opacity: 0.4,
      depthWrite: false, roughness: 1, side: THREE.DoubleSide,
    }), 0.016),
    cultivate: makeOverlay('cultivate', new THREE.MeshStandardMaterial({
      map: surfaceTexture(soilDiffuse, 5, 9, true), normalMap: surfaceTexture(soilNormal, 5, 9),
      alphaMap: masks.cultivate.texture, color: 0xb7a186, transparent: true,
      depthWrite: false, roughness: 1, side: THREE.DoubleSide,
    }), 0.032),
    sow: makeOverlay('sow', new THREE.MeshStandardMaterial({
      map: surfaceTexture(soilDiffuse, 5, 9, true), alphaMap: masks.sow.texture,
      color: 0x8d785e, transparent: true, opacity: 0.26, depthWrite: false, roughness: 1, side: THREE.DoubleSide,
    }), 0.048),
  };
  function paintMask(mask, state, full, speckled) {
    const image = mask.context.createImageData(WORK_COLUMNS, WORK_ROWS);
    const bits = full ? null : workBits(state);
    for (let row = 0; row < WORK_ROWS; row++) for (let column = 0; column < WORK_COLUMNS; column++) {
      const index = row * WORK_COLUMNS + column;
      const covered = full || !!(bits[index >> 3] & (1 << (index & 7)));
      const pixel = ((WORK_ROWS - 1 - row) * WORK_COLUMNS + column) * 4;
      const noise = ((column * 71 + row * 97 + column * row * 13) % 101) / 100;
      const value = covered ? (speckled ? 82 + Math.round(noise * 126) : 255) : 0;
      image.data[pixel] = image.data[pixel + 1] = image.data[pixel + 2] = value;
      image.data[pixel + 3] = 255;
    }
    mask.context.putImageData(image, 0, 0);
    mask.texture.needsUpdate = true;
  }

  const furrows = new THREE.Group();
  furrows.visible = false;
  scene.add(furrows);
  const ridgeMaterial = new THREE.MeshStandardMaterial({ map: surfaceTexture(soilDiffuse, 0.2, 6, true), color: 0xbda483, roughness: 1, side: THREE.DoubleSide });
  for (let x = FIELD.minX + 2.3; x < FIELD.maxX - 2; x += 3.4) {
    stripAlongZ(furrows, () => x, FIELD.minZ + 4, FIELD.maxZ - 4, 0.56, ridgeMaterial, 0.17, 44);
  }

  const cellFor = (x, z) => {
    if (x < FIELD.minX || x >= FIELD.maxX || z < FIELD.minZ || z >= FIELD.maxZ) return -1;
    const column = Math.floor((x - FIELD.minX) / cellWidth);
    const row = Math.floor((z - FIELD.minZ) / cellDepth);
    return row * FIELD_COLUMNS + column;
  };
  const weedPoints = [], cropPoints = [];
  for (let i = 0; i < 23000; i++) {
    const x = between(FIELD.minX + 1, FIELD.maxX - 1), z = between(FIELD.minZ + 1, FIELD.maxZ - 1);
    weedPoints.push({ x, y: heightAt(x, z) + 0.05, z, cell: cellFor(x, z), rotation: between(0, Math.PI * 2), scale: between(1.3, 3.15) });
  }
  for (let x = FIELD.minX + 1.2; x < FIELD.maxX - 1; x += 2) {
    for (let z = FIELD.minZ + 1.2; z < FIELD.maxZ - 1; z += 1.6) {
      const px = x + between(-0.25, 0.25), pz = z + between(-0.4, 0.4);
      cropPoints.push({ x: px, y: heightAt(px, pz) + 0.12, z: pz, cell: cellFor(px, pz), rotation: between(0, Math.PI * 2), scale: between(0.7, 1.16) });
    }
  }
  const weeds = new THREE.InstancedMesh(grassTuftGeometry(), new THREE.MeshStandardMaterial({ color: 0xd3d2a0, roughness: 1, side: THREE.DoubleSide }), weedPoints.length);
  const crops = new THREE.InstancedMesh(wheatPatchGeometry(), new THREE.MeshStandardMaterial({ map: wheatSilhouetteTexture(), color: 0xffffff, roughness: 1, side: THREE.DoubleSide, transparent: true, alphaTest: 0.2 }), cropPoints.length);
  weeds.frustumCulled = crops.frustumCulled = false;
  // The field's thousands of tiny blades are costly in the shadow pass.
  weeds.castShadow = false;
  scene.add(weeds, crops);
  const brambles = [103, 105].map((z, patch) => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: patch ? 0x4e6835 : 0x526d39, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const x = FIELD.minX + 0.4 + (i % 3) * 0.78;
      const pz = z - 0.55 + Math.floor(i / 3) * 0.88;
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material);
      tuft.position.set(x, heightAt(x, pz) + 0.43, pz);
      tuft.scale.set(1.05, 0.8, 0.95);
      tuft.castShadow = true;
      group.add(tuft);
    }
    scene.add(group);
    return group;
  });
  const color = new THREE.Color();
  let previousKey = '';
  let previousCropHeight = -1;
  let previousCropRipe = null;
  const weedVisibility = new Uint8Array(weedPoints.length);
  const cropVisibility = new Uint8Array(cropPoints.length);
  weedVisibility.fill(2);
  cropVisibility.fill(2);
  weedPoints.forEach((_, index) => {
    color.setHSL(0.20 + (index % 7) * 0.009, 0.25, 0.31 + (index % 5) * 0.025);
    weeds.setColorAt(index, color);
  });
  weeds.instanceColor.needsUpdate = true;

  function sync(state) {
    const key = `${state.phase}|${state.accessCleared}|${state.growthEvent}|${state.workRevision}`;
    if (key === previousKey) return;
    previousKey = key;
    const phase = state.phase;
    const isCultivated = ['ready_to_sow', 'sow', 'growing', 'spring_care', 'harvest', 'harvested'].includes(phase);
    const hasCrops = ['growing', 'spring_care', 'harvest'].includes(phase);
    const isWeedy = ['clear', 'test', 'test_collected', 'test_pending', 'mow'].includes(phase);
    weeds.visible = isWeedy;
    crops.visible = hasCrops;
    brambles.forEach((group, index) => { group.visible = isWeedy && state.accessCleared <= index; });
    overlays.mow.visible = ['lime', 'cultivate'].includes(phase) || phase === 'mow';
    overlays.lime.visible = phase === 'lime' || phase === 'cultivate';
    overlays.cultivate.visible = isCultivated || phase === 'cultivate';
    overlays.sow.visible = phase === 'sow';
    if (overlays.mow.visible) paintMask(masks.mow, state, phase !== 'mow', false);
    if (overlays.lime.visible) paintMask(masks.lime, state, phase !== 'lime', true);
    if (overlays.cultivate.visible) paintMask(masks.cultivate, state, phase !== 'cultivate', false);
    if (overlays.sow.visible) paintMask(masks.sow, state, false, false);
    furrows.visible = isCultivated;
    let weedsChanged = false;
    if (isWeedy) weedPoints.forEach((point, index) => {
      const gateStrip = point.x < FIELD.minX + 2.5 && point.z > 102 && point.z < 106;
      const gateCleared = gateStrip && state.accessCleared > Math.floor((point.z - 102) / 2);
      const visible = isWeedy && !gateCleared && !(phase === 'mow' && workedAt(state, point.x, point.z));
      if (weedVisibility[index] === Number(visible)) return;
      weedVisibility[index] = Number(visible);
      weedsChanged = true;
      dummy.position.set(point.x, point.y, point.z);
      dummy.rotation.set(0, point.rotation, 0);
      dummy.scale.setScalar(visible ? point.scale : 0.0001);
      dummy.updateMatrix();
      weeds.setMatrixAt(index, dummy.matrix);
    });
    if (weedsChanged) weeds.instanceMatrix.needsUpdate = true;
    const growth = state.growthEvent;
    const cropHeight = growth < 0 ? 0.24 : [0.43, 0.38, 0.66, 0.91, 1.0][Math.min(growth, 4)];
    const ripe = growth >= 3;
    const recolor = hasCrops && ripe !== previousCropRipe;
    let cropsChanged = false;
    if (hasCrops) cropPoints.forEach((point, index) => {
      const visible = hasCrops && !(phase === 'harvest' && workedAt(state, point.x, point.z));
      if (cropVisibility[index] !== Number(visible) || previousCropHeight !== cropHeight) {
        cropVisibility[index] = Number(visible);
        cropsChanged = true;
        dummy.position.set(point.x, point.y, point.z);
        dummy.rotation.set(0, point.rotation, 0);
        dummy.scale.set(point.scale, visible ? point.scale * cropHeight : 0.0001, point.scale);
        dummy.updateMatrix();
        crops.setMatrixAt(index, dummy.matrix);
      }
      if (recolor) {
        color.setHSL(ripe ? 0.125 + (index % 7) * 0.002 : 0.25 + (index % 7) * 0.004, ripe ? 0.66 : 0.42, ripe ? 0.45 + (index % 5) * 0.015 : 0.36 + (index % 5) * 0.018);
        crops.setColorAt(index, color);
      }
    });
    if (hasCrops) {
      if (cropsChanged) crops.instanceMatrix.needsUpdate = true;
      if (recolor) crops.instanceColor.needsUpdate = true;
      previousCropHeight = cropHeight;
      previousCropRipe = ripe;
    }
  }

  return { sync, cellFor };
}

function addInstanced(mesh, positions, colorFn) {
  const color = new THREE.Color();
  positions.forEach((item, i) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.rotation.set(0, item.rotation || 0, 0);
    dummy.scale.set(item.sx || 1, item.sy || 1, item.sz || 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colorFn) {
      color.set(colorFn(item, i));
      mesh.setColorAt(i, color);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (colorFn) mesh.instanceColor.needsUpdate = true;
}

function colliderGrid(cellSize = 12) {
  const cells = new Map();
  const key = (x, z) => `${x},${z}`;
  return {
    add(x, z, radius) {
      const ix = Math.floor(x / cellSize), iz = Math.floor(z / cellSize);
      const name = key(ix, iz);
      if (!cells.has(name)) cells.set(name, []);
      cells.get(name).push({ x, z, radius });
    },
    collides(x, z, radius = 0.42) {
      const ix = Math.floor(x / cellSize), iz = Math.floor(z / cellSize);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const obstacle of cells.get(key(ix + dx, iz + dz)) || []) {
          const limit = radius + obstacle.radius;
          if ((x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 < limit * limit) return true;
        }
      }
      return false;
    },
  };
}

function vegetation(scene) {
  const obstacles = colliderGrid();
  const treePositions = [];
  for (let i = 0; i < 2100 && treePositions.length < 480; i++) {
    const x = between(-480, 480), z = between(-470, 460);
    if (x > FIELD.minX - 32 && x < FIELD.maxX + 42 && z > FIELD.minZ - 42 && z < FIELD.maxZ + 38) continue;
    if (x > -95 && x < 95 && z > 180 && z < 252) continue;
    if (Math.abs(x - roadX(z)) < 20) continue;
    if (z < -235 && z > -425 && x > -195 && x < 175) continue;
    const woodland = x < -190 || x > 180 || z > 240 || z < -290;
    const density = woodland ? 0.42 : 0.12;
    if (random() > density) continue;
    treePositions.push({ x, z, y: heightAt(x, z), scale: between(0.75, 1.48), kind: random() });
  }
  treePositions.forEach(tree => obstacles.add(tree.x, tree.z, 0.57 * tree.scale));
  // Keep the cheap silhouettes at long range, where their shape is barely
  // visible. The nearby woodland uses the bundled textured tree models.
  const detailedTreePositions = treePositions.filter((tree, index) =>
    index % 2 === 0 && Math.hypot(tree.x, tree.z - 80) < 340);
  const detailedTreeSet = new Set(detailedTreePositions);
  const simpleTreePositions = treePositions.filter(tree => !detailedTreeSet.has(tree));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.44, 1, 6), new THREE.MeshStandardMaterial({ color: 0x756044, roughness: 1 }), simpleTreePositions.length);
  const crowns = [0, 1, 2].map(() => new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0e8d0, roughness: 1 }),
    simpleTreePositions.length,
  ));
  const trunkItems = simpleTreePositions.map(t => ({ x: t.x, y: t.y + 3.1 * t.scale, z: t.z, sx: 0.9 * t.scale, sy: 6.2 * t.scale, sz: 0.9 * t.scale, rotation: random() * 6.28 }));
  addInstanced(trunks, trunkItems, () => 0x776449);
  trunks.castShadow = true;
  scene.add(trunks);
  const palette = [0x61834e, 0x6e8d50, 0x7a9257, 0x54764b, 0x859554];
  crowns.forEach((mesh, lobe) => {
    const items = simpleTreePositions.map(t => {
      const angle = t.kind * 8 + lobe * 2.094;
      const spread = lobe === 0 ? 0 : 1.28 * t.scale;
      const radius = (lobe === 0 ? 3.2 : 2.65) * t.scale;
      return {
        x: t.x + Math.cos(angle) * spread,
        y: t.y + (lobe === 0 ? 7.5 : 6.7) * t.scale,
        z: t.z + Math.sin(angle) * spread,
        sx: radius * between(0.9, 1.06), sy: radius * between(0.85, 1.07), sz: radius * between(0.9, 1.08),
        rotation: random() * 6.28,
      };
    });
    addInstanced(mesh, items, (_, i) => palette[(i + lobe * 2) % palette.length]);
    mesh.castShadow = true;
    scene.add(mesh);
  });

  const bushes = [];
  for (let i = 0; i < 1700 && bushes.length < 570; i++) {
    const x = between(-470, 470), z = between(-460, 455);
    if (x > FIELD.minX - 10 && x < FIELD.maxX + 10 && z > FIELD.minZ - 10 && z < FIELD.maxZ + 10) continue;
    if (x > -95 && x < 95 && z > 180 && z < 252) continue;
    if (Math.abs(x - roadX(z)) < 9.6) continue;
    if (z < -240 && z > -410 && x > -190 && x < 155) continue;
    const s = between(0.5, 1.8);
    bushes.push({ x, y: heightAt(x, z) + s * 0.42, z, sx: s * 0.9, sy: s * 0.58, sz: s * 0.8, rotation: random() * 6.28 });
  }
  // A dense, trimmed hedgerow gives the cultivated field its clear boundary.
  for (let x = FIELD.minX - 2; x < FIELD.maxX + 3; x += 2.7) {
    for (const z of [FIELD.minZ - 1.5, FIELD.maxZ + 1.5]) {
      const sx = x + between(-0.5, 0.5), sz = z + between(-0.55, 0.55);
      if (z > FIELD.maxZ && sx > -50 && sx < -28) continue; // Machinery entrance from the yard.
      bushes.push({ x: sx, y: heightAt(sx, sz) + 0.55, z: sz, sx: between(1.2, 1.55), sy: between(0.6, 0.85), sz: between(1.2, 1.55), hedge: true });
    }
  }
  for (let z = FIELD.minZ; z < FIELD.maxZ; z += 2.7) {
    for (const x of [FIELD.minX - 1.5, FIELD.maxX + 1.5]) {
      if (x < 0 && z > 93 && z < 119) continue; // Gate near John's starting point.
      const sx = x + between(-0.5, 0.5), sz = z + between(-0.45, 0.45);
      bushes.push({ x: sx, y: heightAt(sx, sz) + 0.55, z: sz, sx: between(1.2, 1.55), sy: between(0.6, 0.85), sz: between(1.2, 1.55), hedge: true });
    }
  }
  const bushMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc8d6a2, roughness: 1 }), bushes.length);
  addInstanced(bushMesh, bushes, (_, i) => [0x719050, 0x839b58, 0x5e804c, 0x8fa35c][i % 4]);
  bushes.forEach(bush => obstacles.add(bush.x, bush.z, Math.min(bush.sx, bush.sz) * 0.66));
  bushMesh.castShadow = false;
  scene.add(bushMesh);
  detailedHedges(scene, bushes.filter(bush => bush.hedge));

  const grass = [];
  for (let i = 0; i < 18000; i++) {
    const x = between(-250, 250), z = between(-245, 280);
    if (x > FIELD.minX - 4 && x < FIELD.maxX + 4 && z > FIELD.minZ - 4 && z < FIELD.maxZ + 4) continue;
    if (x > -95 && x < 95 && z > 180 && z < 252) continue;
    if (Math.abs(x - roadX(z)) < 10) continue;
    const s = between(0.55, 1.2);
    grass.push({ x, y: heightAt(x, z), z, sx: s, sy: s, sz: s, rotation: random() * 6.28 });
  }
  const grassMesh = new THREE.InstancedMesh(grassTuftGeometry(), new THREE.MeshStandardMaterial({ color: 0xe4e9b8, roughness: 1, side: THREE.DoubleSide }), grass.length);
  addInstanced(grassMesh, grass, (_, i) => [0x769452, 0x8da65a, 0xa3ad66, 0x648749][i % 4]);
  scene.add(grassMesh);
  detailedRoadsideTrees(scene, obstacles, detailedTreePositions);
  return obstacles;
}

function detailedHedges(scene, bushes) {
  // Poly Haven's four low-poly shrub variants share one texture atlas. Cluster
  // them only on the field boundary; the rest of the countryside stays instanced.
  const alphaMap = textureLoader.load(`${import.meta.env.BASE_URL}models/shrub_03/textures/shrub_03_alpha_1k.png`);
  alphaMap.flipY = false;
  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/shrub_03/shrub_03_1k.gltf`, gltf => {
    const variants = [];
    gltf.scene.traverse(child => { if (child.isMesh) variants.push(child); });
    if (!variants.length) return;
    const clusters = new Map();
    const stemsPerBush = matchMedia('(pointer: coarse)').matches ? 1 : 2;
    bushes.forEach((bush, index) => {
      if (stemsPerBush === 1 && index % 2) return;
      for (let stem = 0; stem < stemsPerBush; stem++) {
        const angle = index * 2.37 + stem * 2.09;
        const variant = (index + stem) % variants.length;
        const key = `${Math.floor(bush.x / 80)},${Math.floor(bush.z / 80)},${variant}`;
        if (!clusters.has(key)) clusters.set(key, { variant, stems: [] });
        clusters.get(key).stems.push({
          x: bush.x + Math.cos(angle) * 0.52,
          z: bush.z + Math.sin(angle) * 0.52,
          scale: 4.2 + (index * 17 + stem * 13) % 19 * 0.085,
          rotation: angle,
        });
      }
    });
    for (const { variant, stems } of clusters.values()) {
      const geometry = variants[variant].geometry;
      const material = variants[variant].material;
      material.side = THREE.DoubleSide;
      material.roughness = 1;
      material.color.set(0xc7d7b4);
      material.alphaMap = alphaMap;
      material.alphaTest = 0.45;
      material.needsUpdate = true;
      const mesh = new THREE.InstancedMesh(geometry, material, stems.length);
      stems.forEach((stem, i) => {
        dummy.position.set(stem.x, heightAt(stem.x, stem.z) + 0.03, stem.z);
        dummy.rotation.set(0, stem.rotation, 0);
        dummy.scale.set(stem.scale * 1.9, stem.scale, stem.scale * 1.9);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = false;
      scene.add(mesh);
    }
  }, undefined, cause => console.warn('Hedge detail model unavailable', cause));
}

function detailedRoadsideTrees(scene, obstacles, woodlandTrees = []) {
  const loader = new GLTFLoader();
  const locations = [
    [-166, 195], [-146, 115], [-180, 35], [-148, -46], [-184, -127],
    [-139, -205], [-205, -238], [-218, 231], [-230, 75], [-230, -88],
    [160, 10], [179, -79], [167, -174], [204, -227], [213, 82], [230, 194],
  ];
  locations.forEach(([x, z]) => obstacles.add(x, z, 0.9));
  const modelLocations = [
    ...locations.map(([x, z], index) => ({ x, z, index, scale: 0.9 + (index % 4) * 0.12 })),
    ...woodlandTrees.map((tree, index) => ({ ...tree, index: index + locations.length, scale: tree.scale })),
  ];
  [[oakTreeUrl, 0], [birchTreeUrl, 1]].forEach(([url, kind]) => {
    loader.load(url, gltf => {
      const source = gltf.scene;
      source.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(source);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const normalized = 9.2 / Math.max(size.y, 0.01);
      modelLocations.forEach(({ x, z, index, scale: treeScale }) => {
        if (index % 2 !== kind) return;
        const tree = source.clone(true);
        const scale = normalized * treeScale;
        tree.scale.multiplyScalar(scale);
        tree.position.set(x, heightAt(x, z) - bounds.min.y * scale, z);
        tree.rotation.y = index * 1.91;
        tree.traverse(child => { if (child.isMesh) child.castShadow = index < locations.length || Math.hypot(x, z - 100) < 160; });
        scene.add(tree);
      });
    }, undefined, cause => console.warn('Roadside tree model unavailable', cause));
  });
}

function grassTuftGeometry() {
  const vertices = [];
  for (let blade = 0; blade < 8; blade++) {
    const angle = blade * Math.PI * 2 / 8;
    const x = Math.cos(angle) * 0.13, z = Math.sin(angle) * 0.13;
    const height = 0.28 + (blade % 4) * 0.08;
    const tipX = x + Math.cos(angle) * 0.19;
    const tipZ = z + Math.sin(angle) * 0.19;
    vertices.push(x - 0.045, 0, z, x + 0.045, 0, z, tipX, height, tipZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function wheatPatchGeometry() {
  const vertices = [], uvs = [];
  for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const x = Math.cos(angle) * 1.15, z = Math.sin(angle) * 1.15;
    vertices.push(-x, 0, -z, x, 0, z, -x, 1.18, -z, x, 0, z, x, 1.18, z, -x, 1.18, -z);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function wheatSilhouetteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const stalkRandom = randomGenerator(42017);
  context.strokeStyle = '#fff';
  context.fillStyle = '#fff';
  for (let stalk = 0; stalk < 39; stalk++) {
    const base = stalkRandom() * 280 - 12;
    const top = base + stalkRandom() * 18 - 9;
    const tipY = 18 + stalkRandom() * 75;
    context.lineWidth = 1 + stalkRandom() * 1.6;
    context.beginPath(); context.moveTo(base, 256); context.quadraticCurveTo(base + 8, 151, top, tipY + 19); context.stroke();
    context.beginPath(); context.ellipse(top, tipY + 10, 3.2 + stalkRandom() * 1.5, 13 + stalkRandom() * 8, 0, 0, Math.PI * 2); context.fill();
    for (const side of [-1, 1]) {
      context.lineWidth = 0.9;
      context.beginPath(); context.moveTo(top, tipY + 11); context.lineTo(top + side * 9, tipY - 6); context.stroke();
      context.beginPath(); context.moveTo(base + (top - base) * 0.58, 145); context.quadraticCurveTo(base + side * 18, 129, base + side * 27, 134); context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function box(parent, width, height, depth, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function gableRoof(width, depth, rise, material) {
  const geometry = new THREE.BufferGeometry();
  const w = width / 2 + 0.5, d = depth / 2 + 0.5;
  const vertices = new Float32Array([
    -w,0,-d, 0,rise,-d, -w,0,d,
    -w,0,d, 0,rise,-d, 0,rise,d,
    0,rise,-d, w,0,-d, 0,rise,d,
    0,rise,d, w,0,-d, w,0,d,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const uvs = [];
  for (let i = 0; i < vertices.length; i += 3) uvs.push((vertices[i] + w) / (2 * w) * 2, (vertices[i + 2] + d) / (2 * d) * 3);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const roof = new THREE.Mesh(geometry, material);
  roof.castShadow = true;
  roof.receiveShadow = true;
  return roof;
}

const villageStoneMap = surfaceTexture(villageStoneDiffuse, 1, 1, true);
const villageStoneNormalMap = surfaceTexture(villageStoneNormal, 1, 1);
const villageRoofMap = surfaceTexture(villageRoofDiffuse, 1, 1, true);
const villageRoofNormalMap = surfaceTexture(villageRoofNormal, 1, 1);

function house(scene, x, z, width, depth, height, paint, roofColor, rotation = 0, obstacles = null) {
  const group = new THREE.Group();
  group.position.set(x, heightAt(x, z), z);
  group.rotation.y = rotation;
  const wall = new THREE.MeshStandardMaterial({ map: villageStoneMap, normalMap: villageStoneNormalMap,
    color: new THREE.Color(paint).lerp(new THREE.Color(0xffffff), 0.55), roughness: 1 });
  const roofMat = new THREE.MeshStandardMaterial({ map: villageRoofMap, normalMap: villageRoofNormalMap,
    color: new THREE.Color(roofColor).lerp(new THREE.Color(0xffffff), 0.48), roughness: 0.98, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x506a70, roughness: 0.22, metalness: 0.13 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xe1ddc7, roughness: 1 });
  const door = new THREE.MeshStandardMaterial({ color: 0x514333, roughness: 1 });
  box(group, width, height, depth, 0, height / 2, 0, wall);
  const roof = gableRoof(width, depth, width * 0.27, roofMat);
  roof.position.y = height;
  group.add(roof);
  const chimney = box(group, 0.9, 2, 0.9, width * 0.23, height + width * 0.19, -depth * 0.17, new THREE.MeshStandardMaterial({ color: 0x9a745e }));
  chimney.rotation.y = 0.12;
  box(group, 1.25, 2.25, 0.1, 0, 1.12, depth / 2 + 0.06, door);
  const windows = width > 8 ? [-width * 0.29, width * 0.29] : [-width * 0.28, width * 0.28];
  for (const wx of windows) {
    for (const level of height > 7 ? [2.4, 5.4] : [2.6]) {
      box(group, 1.55, 1.65, 0.12, wx, level, depth / 2 + 0.08, frame);
      box(group, 1.31, 1.42, 0.13, wx, level, depth / 2 + 0.16, glass);
      box(group, 0.09, 1.43, 0.18, wx, level, depth / 2 + 0.22, frame);
      box(group, 1.35, 0.09, 0.18, wx, level, depth / 2 + 0.22, frame);
    }
  }
  scene.add(group);
  if (obstacles) for (let ox = -width / 2; ox <= width / 2; ox += 2) for (let oz = -depth / 2; oz <= depth / 2; oz += 2) {
    const px = x + ox * Math.cos(rotation) + oz * Math.sin(rotation);
    const pz = z - ox * Math.sin(rotation) + oz * Math.cos(rotation);
    obstacles.add(px, pz, 1.05);
  }
}

function town(scene, obstacles) {
  // Church tower and pale stone nave give the distant settlement a readable silhouette.
  const church = new THREE.Group();
  const x = 98, z = -350;
  church.position.set(x, heightAt(x, z), z);
  const stone = new THREE.MeshStandardMaterial({ map: villageStoneMap, normalMap: villageStoneNormalMap, color: 0xe2dccb, roughness: 1 });
  const slate = new THREE.MeshStandardMaterial({ map: villageRoofMap, normalMap: villageRoofNormalMap, color: 0xd0d5cf, roughness: 1 });
  box(church, 13, 9, 28, 0, 4.5, 0, stone);
  const roof = gableRoof(13, 28, 5, slate); roof.position.y = 9; church.add(roof);
  box(church, 8, 19, 8, 0, 9.5, 18, stone);
  const steeple = new THREE.Mesh(new THREE.ConeGeometry(6.2, 9, 4), slate);
  steeple.position.set(0, 23, 18); steeple.rotation.y = Math.PI / 4; steeple.castShadow = true; church.add(steeple);
  scene.add(church);
  for (let ox = -7; ox <= 7; ox += 2.2) for (let oz = -14; oz <= 22; oz += 2.2) obstacles.add(x + ox, z + oz, 1.2);

  // More homes continue the village beyond the enterable shops and cottages.
  const homes = [
    [-182, -402, 13, 14, 5.6, 0xb6ac91, 0x555955],
    [-42, -409, 14, 14, 5.7, 0xc9bca0, 0x675a50],
    [12, -432, 14, 15, 6.2, 0xbeb9a6, 0x5a645f],
    [72, -426, 15, 14, 5.9, 0xb5a88c, 0x666159],
    [-182, -210, 13, 14, 5.4, 0xc9c0a5, 0x5a665f],
    [12, -207, 14, 14, 5.8, 0xc3ad91, 0x66635a],
  ];
  homes.forEach(site => house(scene, ...site, 0, obstacles));

  // The settlement has its own surfaced lanes, pavements and pedestrian scale.
  const pavingTexture = makeNoiseTexture({ r: 169, g: 159, b: 140, variation: 25 }, 256, 90412);
  pavingTexture.repeat.set(3, 8);
  const paving = new THREE.MeshStandardMaterial({ map: pavingTexture, roughness: 1, side: THREE.DoubleSide });
  const street = new THREE.MeshStandardMaterial({
    map: surfaceTexture(asphaltDiffuse, 3, 2, true), color: 0xc4bfb0, roughness: 1, side: THREE.DoubleSide,
  });
  for (const [z0, z1, west, east] of [[-288, -280, -188, 72], [-329, -321, -187, 48], [-373, -365, -190, 52]]) {
    const lane = new THREE.Mesh(patchGeometry(west, east, z0, z1, 22, 2, 0.18), street);
    lane.receiveShadow = true; scene.add(lane);
    for (const edge of [z0 - 2.5, z1 + 2.5]) {
      const walk = new THREE.Mesh(patchGeometry(west, east, edge - 1.6, edge + 1.6, 22, 2, 0.2), paving);
      walk.receiveShadow = true; scene.add(walk);
    }
  }
  for (const side of [-1, 1]) {
    const walk = stripAlongZ(scene, z => roadX(z) + side * 7.1, -430, -205, 2.9, paving, 0.2, 42);
    walk.receiveShadow = true;
  }
  const streetIron = new THREE.MeshStandardMaterial({ color: 0x4e5552, metalness: 0.47, roughness: 0.47 });
  for (const z of [-409, -347, -296, -235]) for (const side of [-1, 1]) {
    const lx = roadX(z) + side * 9.4, ly = heightAt(lx, z);
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.6, 8), streetIron);
    lampPost.position.set(lx, ly + 2.8, z); lampPost.castShadow = true; scene.add(lampPost);
    box(scene, 1.3, 0.1, 0.1, lx - side * 0.6, ly + 5.45, z, streetIron);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe5af, emissive: 0xffd985, emissiveIntensity: 0.8 }));
    lantern.position.set(lx - side * 1.15, ly + 5.28, z); scene.add(lantern);
    obstacles.add(lx, z, 0.28);
  }
  const boxHedge = new THREE.MeshStandardMaterial({ color: 0x597847, roughness: 1 });
  for (const z of [-227, -254, -303, -339, -391, -416]) for (const x of [-206, -157, -17, 52]) {
    if (Math.abs(x - roadX(z)) < 17) continue;
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), boxHedge);
    shrub.scale.set(1.2, 0.72, 0.85);
    shrub.position.set(x, heightAt(x, z) + 0.78, z);
    scene.add(shrub); obstacles.add(x, z, 0.92);
  }

  const gravel = new THREE.MeshStandardMaterial({ color: 0xb8ad8d, roughness: 1, side: THREE.DoubleSide });
  const northPath = new THREE.Mesh(patchGeometry(-50, -45, -248, -204, 2, 12, 0.18), gravel);
  const crossPath = new THREE.Mesh(patchGeometry(-77, -17, -229, -224, 16, 2, 0.18), gravel);
  scene.add(northPath, crossPath);
  const parkWood = new THREE.MeshStandardMaterial({ color: 0x765b40, roughness: 0.95 });
  const benchIron = new THREE.MeshStandardMaterial({ color: 0x4b5551, metalness: 0.4, roughness: 0.6 });
  const parkLeaves = [0x6a8858, 0x79945a, 0x56794d].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  for (const [tx, tz, size] of [[-70, -211, 1.1], [-24, -211, 0.9], [-70, -241, 0.98], [-23, -241, 1.05], [-33, -233, 0.77]]) {
    const base = heightAt(tx, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.27 * size, 0.38 * size, 5 * size, 8), parkWood);
    trunk.position.set(tx, base + 2.5 * size, tz); trunk.castShadow = true; scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.15 * size, 1), parkLeaves[Math.abs(tx + tz) % 3]);
    crown.position.set(tx, base + 5.7 * size, tz); crown.castShadow = true; scene.add(crown);
    obstacles.add(tx, tz, 0.49 * size);
  }
  for (const [bx, bz] of [[-61, -217], [-33, -217], [-62, -238], [-32, -238]]) {
    const bench = new THREE.Group(); bench.position.set(bx, heightAt(bx, bz), bz);
    box(bench, 2.5, 0.13, 0.64, 0, 0.62, 0, parkWood);
    box(bench, 2.5, 0.58, 0.12, 0, 1.02, 0.31, parkWood);
    for (const side of [-1, 1]) box(bench, 0.14, 0.62, 0.55, side * 1.0, 0.33, 0, benchIron);
    scene.add(bench); obstacles.add(bx, bz, 1.38);
  }
  const flowerColors = [0xb5a154, 0xa87568, 0xdfcf84];
  const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.027, 0.28, 5), parkLeaves[0], 38);
  const flowerMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 38);
  for (let i = 0; i < 38; i++) {
    const fx = -73 + (i % 10) * 5.3, fz = -249 + Math.floor(i / 10) * 1.7;
    const base = heightAt(fx, fz);
    dummy.position.set(fx, base + 0.18, fz); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); stemMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = base + 0.34; dummy.updateMatrix(); flowerMesh.setMatrixAt(i, dummy.matrix);
    flowerMesh.setColorAt(i, new THREE.Color(flowerColors[i % 3]));
  }
  stemMesh.instanceMatrix.needsUpdate = true; flowerMesh.instanceMatrix.needsUpdate = true;
  scene.add(stemMesh, flowerMesh);

  const people = [];
  const coatColors = [0x596c48, 0x5b6877, 0x8a6954, 0x8a8064, 0x6e5b68, 0x485d60];
  const skin = new THREE.MeshStandardMaterial({ color: 0xc39b7d, roughness: 1 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x3f4745, roughness: 1 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x493d33, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const person = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: coatColors[i % coatColors.length], roughness: 1 });
    const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.39, 5, 10), coat);
    jacket.position.set(0, 1.28, 0); jacket.castShadow = true; person.add(jacket);
    box(person, 0.42, 0.12, 0.3, 0, 1.01, 0, trousers);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), skin);
    head.position.set(0, 1.84, 0); person.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.47), hair);
    cap.position.copy(head.position); person.add(cap);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), skin);
    nose.position.set(0, 1.81, -0.19); person.add(nose);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.15, 0.91, 0); person.add(leg);
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.74, 8), trousers);
      legMesh.position.y = -0.38; leg.add(legMesh);
      box(leg, 0.21, 0.13, 0.3, 0, -0.8, -0.05, hair);
      legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.35, 1.58, 0); person.add(arm);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 8), coat);
      sleeve.position.y = -0.32; arm.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
      hand.position.y = -0.65; arm.add(hand);
      arms.push(arm);
    }
    scene.add(person);
    people.push({ person, legs, arms, side: i % 2 ? 1 : -1, phase: i * 0.63, pace: 0.67 + i * 0.07, park: i >= 6 });
  }
  return {
    update(time, player) {
      people.forEach(({ person, legs, arms, side, phase, pace, park }, index) => {
        const cycle = time * pace + phase;
        const zPos = park ? -225 + Math.sin(cycle * 0.36) * 11 : -330 + Math.sin(cycle * 0.2) * 84;
        const xPos = park ? -47 + Math.cos(cycle * 0.36) * (index === 8 ? 9 : 15) : roadX(zPos) + side * 7.1;
        person.position.set(xPos, heightAt(xPos, zPos), zPos);
        person.rotation.y = park ? cycle * 0.36 + Math.PI / 2 : Math.cos(cycle * 0.2) > 0 ? 0 : Math.PI;
        person.visible = Math.hypot(player.x - xPos, player.z - zPos) < 260;
        const swing = Math.sin(cycle * 7.2) * 0.38;
        legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
        arms[0].rotation.x = -swing * 0.65; arms[1].rotation.x = swing * 0.65;
      });
    },
  };
}

function farmDetails(scene, obstacles) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8c7656, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9d8662, roughness: 1 });
  for (const x of [-55, -42]) {
    for (const z of [92, 121]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.4, 6), postMat);
      post.position.set(x, heightAt(x, z) + 1.2, z); post.castShadow = true; scene.add(post);
      obstacles.add(x, z, 0.23);
    }
  }
  for (const z of [92, 121]) {
    const rail = box(scene, 13, 0.15, 0.15, -48.5, heightAt(-48.5, z) + 1.35, z, railMat);
    rail.castShadow = true;
    for (let x = -54; x < -42; x += 1.6) obstacles.add(x, z, 0.25);
  }
  // Telegraph poles trace the road toward the village.
  const wood = new THREE.MeshStandardMaterial({ color: 0x77664e, roughness: 1 });
  for (let z = -470; z < 450; z += 64) {
    const x = roadX(z) - 11;
    box(scene, 0.4, 8.5, 0.4, x, heightAt(x, z) + 4.25, z, wood);
    box(scene, 3.8, 0.25, 0.25, x, heightAt(x, z) + 7.5, z, wood);
    obstacles.add(x, z, 0.36);
  }
}

function lightAndSky(scene, renderer) {
  scene.fog = new THREE.FogExp2(0xb5c5b8, 0.0012);
  const sky = new Sky();
  sky.scale.setScalar(10000);
  sky.material.uniforms.turbidity.value = 4;
  sky.material.uniforms.rayleigh.value = 1.45;
  sky.material.uniforms.mieCoefficient.value = 0.006;
  sky.material.uniforms.mieDirectionalG.value = 0.86;
  const sun = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - 0.48, Math.PI * 0.28);
  sky.material.uniforms.sunPosition.value.copy(sun);
  scene.add(sky);
  const hemisphere = new THREE.HemisphereLight(0xe7f1ff, 0x685f48, 1.2);
  scene.add(hemisphere);
  const fillLight = new THREE.DirectionalLight(0xf0f1e5, 0.62);
  fillLight.position.set(145, 95, 185);
  scene.add(fillLight);
  const sunlight = new THREE.DirectionalLight(0xffe8c5, 1.85);
  sunlight.position.set(-95, 180, -90);
  sunlight.castShadow = true;
  const shadowResolution = matchMedia('(pointer: coarse)').matches ? 1024 : 2048;
  sunlight.shadow.mapSize.set(shadowResolution, shadowResolution);
  sunlight.shadow.camera.left = -210;
  sunlight.shadow.camera.right = 210;
  sunlight.shadow.camera.top = 210;
  sunlight.shadow.camera.bottom = -210;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 450;
  sunlight.shadow.bias = -0.0003;
  sunlight.shadow.normalBias = 0.02;
  sunlight.target.position.set(-10, 0, -15);
  scene.add(sunlight.target, sunlight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return createAtmosphere(scene, renderer, sky, sunlight, hemisphere, fillLight);
}

export function createWorld(scene, renderer) {
  const atmosphere = lightAndSky(scene, renderer);
  terrain(scene);
  road(scene);
  const fieldVisual = field(scene);
  const vegetationObstacles = vegetation(scene);
  const village = town(scene, vegetationObstacles);
  farmDetails(scene, vegetationObstacles);
  const buildings = createBuildings(scene, heightAt);
  const vehicles = createVehicles(scene, heightAt);
  const collides = (x, z, radius = 0.42) => buildings.collides(x, z, radius) || vegetationObstacles.collides(x, z, radius);
  return { heightAt, roadX, field: FIELD, fieldVisual, buildings, vehicles, collides, atmosphere, village };
}
