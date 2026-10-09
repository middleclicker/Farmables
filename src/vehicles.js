import * as THREE from 'three';

const material = (color, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.46 : 0.83, metalness });
const green = material(0x4e6538, 0.18);
const greenDark = material(0x354c31, 0.12);
const yellow = material(0xc6a858, 0.15);
const tire = material(0x252824);
const rubber = material(0x3b3c32);
const steel = material(0x8b8f82, 0.35);
const glass = new THREE.MeshStandardMaterial({ color: 0x7eafb6, metalness: 0.08, roughness: 0.2, transparent: true, opacity: 0.65 });

function box(parent, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
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
  parent.add(group);
  return group;
}

function tractorModel() {
  const group = new THREE.Group();
  box(group, [2.35, 0.5, 4.25], [0, 1.1, 0], greenDark);
  box(group, [2.05, 1.05, 2.08], [0, 1.8, -1.1], green);
  box(group, [2.08, 0.2, 2.1], [0, 2.37, -1.1], greenDark);
  box(group, [1.9, 0.14, 0.16], [0, 1.7, -2.2], steel);
  for (const x of [-0.75, 0.75]) {
    box(group, [0.27, 0.26, 0.12], [x, 1.91, -2.21], yellow);
    box(group, [0.12, 1.55, 0.12], [x, 2.47, 0.78], greenDark);
  }
  box(group, [2.05, 1.62, 1.9], [0, 2.1, 0.97], glass);
  box(group, [2.26, 0.18, 2.15], [0, 3.03, 0.97], green);
  box(group, [0.18, 1.1, 0.18], [-0.7, 2.97, -0.92], tire);
  box(group, [0.35, 0.23, 0.35], [-0.7, 3.56, -0.92], rubber);
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
  box(group, [3.35, 1.5, 1.75], [0, 2.48, -1.72], glass);
  box(group, [3.5, 0.14, 1.9], [0, 3.28, -1.72], green);
  box(group, [5.8, 0.42, 0.72], [0, 0.78, -3.45], steel);
  box(group, [6.7, 0.1, 0.2], [0, 0.45, -3.7], yellow);
  for (let i = -5; i <= 5; i++) box(group, [0.08, 0.6, 0.08], [i * 0.57, 0.43, -3.75], steel);
  const wheels = [
    wheel(group, -2.2, -1.55, 1.2, 0.63), wheel(group, 2.2, -1.55, 1.2, 0.63),
    wheel(group, -2, 2.25, 0.82, 0.52), wheel(group, 2, 2.25, 0.82, 0.52),
  ];
  return { group, wheels };
}

function implement(tool) {
  const group = new THREE.Group();
  group.position.z = 3.35;
  if (tool === 'mow') {
    box(group, [5.8, 0.42, 1.85], [0, 0.58, 0], greenDark);
    box(group, [5.9, 0.1, 0.2], [0, 0.25, 0.9], steel);
  } else if (tool === 'lime') {
    box(group, [2.3, 1.3, 1.7], [0, 1.3, 0], yellow);
    box(group, [5.4, 0.13, 0.16], [0, 0.53, 0.8], steel);
    box(group, [1, 0.08, 1], [0, 0.34, 0.9], rubber);
  } else if (tool === 'cultivate') {
    box(group, [6.2, 0.2, 1.8], [0, 0.58, 0], greenDark);
    for (let i = -5; i <= 5; i++) box(group, [0.13, 0.52, 0.15], [i * 0.52, 0.23, 0.65], steel);
  } else if (tool === 'sow') {
    box(group, [5.7, 0.96, 1.3], [0, 1.03, 0], yellow);
    for (let i = -5; i <= 5; i++) box(group, [0.11, 0.5, 0.35], [i * 0.5, 0.3, 0.83], steel);
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
  let attachment = null;
  let driven = null;
  let speed = 0;

  function sync(state) {
    tractor.group.visible = state.tractorOwned || state.tractorRented;
    combine.group.visible = state.combineRented;
    if (attachment) {
      attachment.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
      attachment.removeFromParent();
    }
    attachment = state.tool && state.tool !== 'harvest' ? implement(state.tool) : null;
    if (attachment) tractor.group.add(attachment);
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
