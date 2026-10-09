// One metre samples keep machinery edges continuous without storing a large
// canvas or a mesh per patch in the save file.
export const FIELD_BOUNDS = Object.freeze({ minX: -48, maxX: 108, minZ: -119, maxZ: 166 });
export const WORK_COLUMNS = FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX;
export const WORK_ROWS = FIELD_BOUNDS.maxZ - FIELD_BOUNDS.minZ;
export const WORK_SAMPLES = WORK_COLUMNS * WORK_ROWS;
export const WORK_TARGET = Math.ceil(WORK_SAMPLES * 0.93);

const bitsByFarm = new WeakMap();

function decode(encoded) {
  if (!encoded) return new Uint8Array(Math.ceil(WORK_SAMPLES / 8));
  try {
    const binary = typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('binary');
    if (binary.length !== Math.ceil(WORK_SAMPLES / 8)) throw new Error('Wrong work map size');
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch { return new Uint8Array(Math.ceil(WORK_SAMPLES / 8)); }
}

function encode(bits) {
  let binary = '';
  for (let offset = 0; offset < bits.length; offset += 8192) {
    binary += String.fromCharCode(...bits.subarray(offset, offset + 8192));
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export function workBits(farm) {
  if (!bitsByFarm.has(farm)) bitsByFarm.set(farm, decode(farm.workMask));
  return bitsByFarm.get(farm);
}

export function exportWorkMask(farm) {
  farm.workMask = encode(workBits(farm));
}

export function resetWork(farm) {
  bitsByFarm.set(farm, new Uint8Array(Math.ceil(WORK_SAMPLES / 8)));
  farm.workMask = '';
  farm.workCount = 0;
  farm.workRevision = (farm.workRevision || 0) + 1;
}

export function workedAt(farm, x, z) {
  const column = Math.floor(x - FIELD_BOUNDS.minX);
  const row = Math.floor(z - FIELD_BOUNDS.minZ);
  if (column < 0 || column >= WORK_COLUMNS || row < 0 || row >= WORK_ROWS) return false;
  const index = row * WORK_COLUMNS + column;
  return !!(workBits(farm)[index >> 3] & (1 << (index & 7)));
}

export function paintSwath(farm, fromX, fromZ, toX, toZ, width) {
  const halfWidth = width / 2;
  const x0 = Math.max(0, Math.floor(Math.min(fromX, toX) - halfWidth - FIELD_BOUNDS.minX));
  const x1 = Math.min(WORK_COLUMNS - 1, Math.ceil(Math.max(fromX, toX) + halfWidth - FIELD_BOUNDS.minX));
  const z0 = Math.max(0, Math.floor(Math.min(fromZ, toZ) - halfWidth - FIELD_BOUNDS.minZ));
  const z1 = Math.min(WORK_ROWS - 1, Math.ceil(Math.max(fromZ, toZ) + halfWidth - FIELD_BOUNDS.minZ));
  if (x0 > x1 || z0 > z1) return 0;
  const dx = toX - fromX, dz = toZ - fromZ;
  const lengthSquared = dx * dx + dz * dz;
  const bits = workBits(farm);
  let changed = 0;
  for (let row = z0; row <= z1; row++) for (let column = x0; column <= x1; column++) {
    const x = FIELD_BOUNDS.minX + column + 0.5;
    const z = FIELD_BOUNDS.minZ + row + 0.5;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - fromX) * dx + (z - fromZ) * dz) / lengthSquared)) : 0;
    if ((x - fromX - t * dx) ** 2 + (z - fromZ - t * dz) ** 2 > halfWidth ** 2) continue;
    const index = row * WORK_COLUMNS + column;
    const byte = index >> 3, flag = 1 << (index & 7);
    if (bits[byte] & flag) continue;
    bits[byte] |= flag;
    changed++;
  }
  if (changed) {
    farm.workCount = (farm.workCount || 0) + changed;
    farm.workRevision = (farm.workRevision || 0) + 1;
  }
  return changed;
}

export function workPercent(farm) {
  return Math.min(99, Math.floor((farm.workCount || 0) / WORK_TARGET * 100));
}
