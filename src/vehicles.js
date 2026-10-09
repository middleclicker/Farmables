import * as THREE from 'three';

const material = (color, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.46 : 0.83, metalness });
const green = material(0x4e6538, 0.18);
const greenDark = material(0x354c31, 0.12);
const yellow = material(0xc6a858, 0.15);
const tire = material(0x252824);
const rubber = material(0x3b3c32);
const steel = material(0x8b8f82, 0.35);
const darkSteel = material(0x475456, 0.55);
const lamp = new THREE.MeshStandardMaterial({ color: 0xfff0c5, emissive: 0xffd48a, emissiveIntensity: 0.5 });
const glass = new THREE.MeshStandardMaterial({ color: 0x7eafb6, metalness: 0.08, roughness: 0.2, transparent: true, opacity: 0.65 });
const unitBox = new THREE.BoxGeometry(1, 1, 1);

function box(parent, size, position, mat) {
  const mesh = new THREE.Mesh(unitBox, mat);
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, mat, sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function beam(parent, from, to, radius, mat) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const mesh = cylinder(parent, radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(0.5).toArray(), mat, 8);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return mesh;
}

function wheel(parent, x, z, radius, width) {
  const group = new THREE.Group();
  group.position.set(x, radius + 0.13, z);
  const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tire);
  tireMesh.rotation.z = Math.PI / 2;
  tireMesh.castShadow = true;
  group.add(tireMesh);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.49, radius * 0.49, width + 0.025, 12), steel);
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, width + 0.04, 12), greenDark);
  cap.rotation.z = Math.PI / 2;
  group.add(cap);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const tread = box(group, [width + 0.045, radius * 0.13, radius * 0.34],
      [0, Math.sin(angle) * radius * 0.94, Math.cos(angle) * radius * 0.94], tire);
    tread.rotation.x = angle;
    tread.castShadow = false;
  }
  parent.add(group);
  return group;
}

function tractorModel() {
  const group = new THREE.Group();
  box(group, [2.35, 0.5, 4.25], [0, 1.1, 0], greenDark);
  box(group, [2.05, 1.05, 2.08], [0, 1.8, -1.1], green);
  box(group, [2.08, 0.2, 2.1], [0, 2.37, -1.1], greenDark);
  box(group, [1.9, 0.7, 0.47], [0, 1.57, -2.34], green);
  box(group, [1.9, 0.14, 0.16], [0, 1.08, -2.58], steel);
  for (let i = 0; i < 7; i++) box(group, [0.045, 0.38, 0.04], [-0.73 + i * 0.24, 1.61, -2.59], darkSteel);
  for (const x of [-0.75, 0.75]) {
    box(group, [0.29, 0.26, 0.12], [x, 1.94, -2.59], lamp);
    box(group, [0.12, 1.64, 0.12], [x, 2.31, -0.04], darkSteel);
    box(group, [0.12, 1.64, 0.12], [x, 2.31, 1.92], darkSteel);
    box(group, [0.12, 0.12, 1.95], [x, 3.15, 0.93], darkSteel);
    box(group, [0.46, 0.13, 1.35], [x * 1.37, 0.9, 0.7], steel);
    box(group, [0.42, 0.15, 0.33], [x * 1.5, 2.52, -0.26], darkSteel);
    box(group, [0.13, 0.67, 1.63], [x * 1.38, 2.26, 0.9], glass);
  }
  box(group, [1.84, 1.5, 0.07], [0, 2.3, -0.04], glass);
  box(group, [1.84, 1.5, 0.07], [0, 2.3, 1.91], glass);
  box(group, [2.26, 0.18, 2.15], [0, 3.03, 0.97], green);
  cylinder(group, 0.13, 1.1, [-0.7, 2.97, -0.92], tire);
  cylinder(group, 0.21, 0.22, [-0.7, 3.56, -0.92], rubber);
  box(group, [0.56, 0.82, 0.52], [0, 1.55, 1.14], tire);
  cylinder(group, 0.25, 0.06, [0, 2.06, 0.46], tire).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    box(group, [0.64, 0.11, 1.45], [side * 1.11, 2.09, 1.32], green);
    beam(group, [side * 0.62, 1.06, 2.15], [0, 0.59, 2.82], 0.085, darkSteel);
  }
  box(group, [1.7, 0.35, 0.37], [0, 0.97, 2.12], steel);
  const wheels = [
    wheel(group, -1.42, -1.45, 0.78, 0.42), wheel(group, 1.42, -1.45, 0.78, 0.42),
    wheel(group, -1.55, 1.48, 1.16, 0.55), wheel(group, 1.55, 1.48, 1.16, 0.55),
  ];
  return { group, wheels };
}

function combineModel() {
  const group = new THREE.Group();
  box(group, [3.7, 1.2, 6.1], [0, 1.65, 0], green);
  box(group, [3.6, 0.7, 3.4], [0, 2.65, 1.1], greenDark);
  box(group, [3.2, 0.12, 2.72], [0, 3.07, 1.38], steel);
  for (const side of [-1, 1]) {
    box(group, [0.1, 0.48, 3.12], [side * 1.67, 3.29, 1.3], green);
    box(group, [0.14, 0.11, 4.5], [side * 1.8, 1.88, 0.1], yellow);
    box(group, [0.07, 1.49, 1.65], [side * 1.66, 2.48, -1.72], glass);
    beam(group, [side * 1.69, 1.7, -2.54], [side * 1.69, 3.25, -2.54], 0.07, darkSteel);
    box(group, [0.36, 0.23, 0.12], [side * 1.38, 2.9, -2.6], lamp);
    box(group, [0.48, 0.12, 0.54], [side * 1.97, 2.62, -2.05], darkSteel);
  }
  box(group, [3.22, 1.5, 0.07], [0, 2.48, -2.56], glass);
  box(group, [3.5, 0.14, 1.9], [0, 3.28, -1.72], green);
  cylinder(group, 0.2, 5.6, [3.12, 3.04, 1.13], steel).rotation.z = Math.PI / 2;
  cylinder(group, 0.32, 1.06, [5.8, 3.04, 1.13], darkSteel).rotation.z = Math.PI / 2;
  box(group, [5.8, 0.42, 0.72], [0, 0.78, -3.45], steel);
  box(group, [6.7, 0.1, 0.2], [0, 0.45, -3.7], yellow);
  cylinder(group, 0.29, 6.1, [0, 1.11, -3.65], yellow).rotation.z = Math.PI / 2;
  for (let i = -5; i <= 5; i++) {
    box(group, [0.08, 0.6, 0.08], [i * 0.57, 0.76, -3.75], steel);
    box(group, [0.12, 0.07, 0.75], [i * 0.57, 0.4, -4.08], darkSteel);
  }
  const wheels = [
    wheel(group, -2.2, -1.55, 1.2, 0.63), wheel(group, 2.2, -1.55, 1.2, 0.63),
    wheel(group, -2, 2.25, 0.82, 0.52), wheel(group, 2, 2.25, 0.82, 0.52),
  ];
  return { group, wheels };
}

function implement(tool) {
  const group = new THREE.Group();
  group.position.z = 3.35;
  beam(group, [0, 0.65, -0.8], [0, 0.65, 0.35], 0.1, steel);
  for (const side of [-1, 1]) beam(group, [0, 0.65, -0.7], [side * 0.9, 0.65, 0.2], 0.08, darkSteel);
  if (tool === 'mow') {
    for (const side of [-1, 0, 1]) {
      const deck = box(group, [1.92, 0.25, 1.85], [side * 1.92, 0.59, 0.54], side ? green : greenDark);
      deck.rotation.z = side * 0.025;
      box(group, [1.85, 0.1, 0.14], [side * 1.92, 0.31, 1.46], yellow);
      cylinder(group, 0.32, 0.07, [side * 1.92, 0.4, 0.62], darkSteel);
    }
    for (const side of [-1, 1]) wheel(group, side * 2.66, 1.23, 0.29, 0.18);
    box(group, [5.9, 0.1, 0.16], [0, 0.25, 1.46], steel);
  } else if (tool === 'lime') {
    box(group, [2.32, 0.18, 1.7], [0, 0.8, 0.37], darkSteel);
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.48, 1.3, 4), yellow);
    hopper.rotation.y = Math.PI / 4; hopper.position.set(0, 1.52, 0.37); hopper.castShadow = true; group.add(hopper);
    box(group, [2.29, 0.1, 1.76], [0, 2.17, 0.37], darkSteel);
    box(group, [0.48, 0.52, 0.47], [0, 0.62, 1.13], steel);
    for (const side of [-1, 1]) {
      cylinder(group, 0.58, 0.06, [side * 0.57, 0.33, 1.34], darkSteel, 16);
      box(group, [2.4, 0.09, 0.14], [side * 1.85, 0.51, 1.34], steel);
      wheel(group, side * 1.37, 0.4, 0.42, 0.28);
    }
  } else if (tool === 'cultivate') {
    for (const z of [0.2, 1.48]) box(group, [5.78, 0.17, 0.16], [0, 0.75, z], greenDark);
    for (const side of [-1, 1]) {
      beam(group, [0, 0.75, 0.2], [side * 2.77, 0.75, 1.48], 0.08, steel);
      wheel(group, side * 2.67, 0.97, 0.36, 0.2);
    }
    for (let row = 0; row < 2; row++) for (let i = -5; i <= 5; i++) {
      const x = i * 0.52 + (row ? 0.24 : 0), z = row ? 1.47 : 0.25;
      beam(group, [x, 0.72, z], [x + 0.07, 0.2, z + 0.27], 0.05, steel);
      box(group, [0.34, 0.06, 0.26], [x + 0.07, 0.21, z + 0.3], darkSteel);
    }
  } else if (tool === 'sow') {
    box(group, [5.74, 0.16, 1.3], [0, 0.68, 0.45], greenDark);
    box(group, [5.38, 0.88, 0.98], [0, 1.27, 0.44], yellow);
    box(group, [5.44, 0.11, 1.04], [0, 1.75, 0.44], darkSteel);
    for (const side of [-1, 1]) wheel(group, side * 2.73, 0.52, 0.39, 0.24);
    for (let i = -5; i <= 5; i++) {
      const x = i * 0.5;
      beam(group, [x, 0.94, 0.68], [x, 0.28, 1.25], 0.04, rubber);
      const disc = cylinder(group, 0.18, 0.04, [x, 0.28, 1.25], steel, 10); disc.rotation.z = Math.PI / 2;
      box(group, [0.2, 0.16, 0.2], [x, 0.29, 1.46], tire);
    }
  }
  return group;
}

export function createVehicles(scene, heightAt) {
  const tractor = tractorModel();
  const combine = combineModel();
  tractor.group.position.set(-40, heightAt(-40, 181), 181);
  combine.group.position.set(-55, heightAt(-55, 183), 183);
  tractor.group.rotation.y = combine.group.rotation.y = 0;
  scene.add(tractor.group, combine.group);
  tractor.group.visible = combine.group.visible = false;
  const attachments = Object.fromEntries(['mow', 'lime', 'cultivate', 'sow'].map(tool => [tool, implement(tool)]));
  Object.values(attachments).forEach(attachment => { attachment.visible = false; tractor.group.add(attachment); });
  let driven = null;
  let speed = 0;

  function sync(state) {
    tractor.group.visible = state.tractorOwned || state.tractorRented;
    combine.group.visible = state.combineRented;
    Object.entries(attachments).forEach(([name, attachment]) => { attachment.visible = state.tool === name; });
    if (driven === 'combine' && !combine.group.visible) driven = null;
    if (driven === 'tractor' && !tractor.group.visible) driven = null;
  }

  function near(player) {
    const candidates = [tractor, combine].filter(item => item.group.visible);
    return candidates.find(item => Math.hypot(item.group.position.x - player.x, item.group.position.z - player.z) < 5.8) || null;
  }

  function enter(player) {
    const candidate = near(player);
    if (!candidate) return false;
    driven = candidate === tractor ? 'tractor' : 'combine';
    speed = 0;
    return true;
  }

  function exit(player) {
    if (!driven) return false;
    const group = driven === 'tractor' ? tractor.group : combine.group;
    const side = group.rotation.y + Math.PI / 2;
    player.x = group.position.x + Math.sin(side) * 4.2;
    player.z = group.position.z + Math.cos(side) * 4.2;
    player.y = heightAt(player.x, player.z);
    driven = null;
    speed = 0;
    return true;
  }

  function update(dt, input, collides) {
    if (!driven) return null;
    const vehicle = driven === 'tractor' ? tractor : combine;
    const maximum = driven === 'tractor' ? 12 : 8.5;
    const wanted = input.forward * maximum;
    speed += (wanted - speed) * Math.min(1, dt * (input.forward ? 2.3 : 4.5));
    if (Math.abs(speed) < 0.03) speed = 0;
    const steering = input.right * Math.min(1, Math.abs(speed) / 3.5);
    vehicle.group.rotation.y -= steering * dt * 0.68 * Math.sign(speed || 1);
    const x = vehicle.group.position.x - Math.sin(vehicle.group.rotation.y) * speed * dt;
    const z = vehicle.group.position.z - Math.cos(vehicle.group.rotation.y) * speed * dt;
    if (!collides?.(x, z, driven === 'tractor' ? 2.15 : 3.15)) {
      vehicle.group.position.x = THREE.MathUtils.clamp(x, -470, 470);
      vehicle.group.position.z = THREE.MathUtils.clamp(z, -470, 470);
    } else speed = 0;
    vehicle.group.position.y = heightAt(vehicle.group.position.x, vehicle.group.position.z);
    vehicle.wheels.forEach(wheelGroup => { wheelGroup.rotation.x += speed * dt * 0.4; });
    return { x: vehicle.group.position.x, z: vehicle.group.position.z, speed, kind: driven, heading: vehicle.group.rotation.y };
  }

  return {
    tractor, combine, sync, near, enter, exit, update,
    get driven() { return driven; },
    get activeGroup() { return driven === 'tractor' ? tractor.group : driven === 'combine' ? combine.group : null; },
  };
}
