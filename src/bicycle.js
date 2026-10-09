import * as THREE from 'three';

const paint = new THREE.MeshStandardMaterial({ color: 0x435c5d, metalness: 0.46, roughness: 0.38 });
const steel = new THREE.MeshStandardMaterial({ color: 0x8c9691, metalness: 0.7, roughness: 0.3 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x252a27, roughness: 0.94 });
const leather = new THREE.MeshStandardMaterial({ color: 0x514137, roughness: 0.92 });
const amber = new THREE.MeshStandardMaterial({ color: 0xd9944c, emissive: 0x9b4b1f, emissiveIntensity: 0.18 });

function tube(parent, a, b, radius, material, sides = 9) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), sides), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function wheel(parent, z) {
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.43, z);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.045, 8, 28), rubber);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.011, 5, 28), steel);
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    tube(wheel, [0, 0, 0], [0, Math.sin(angle) * 0.35, Math.cos(angle) * 0.35], 0.003, steel, 4).castShadow = false;
  }
  tube(wheel, [-0.09, 0, 0], [0.09, 0, 0], 0.028, steel);
  parent.add(wheel);
  return wheel;
}

export function createBicycle(scene, heightAt) {
  const group = new THREE.Group();
  const rear = wheel(group, 0.76);
  const front = wheel(group, -0.82);
  const crank = [0, 0.5, 0.1];
  const saddle = [0, 1.16, 0.34];
  const stem = [0, 1.06, -0.52];
  tube(group, crank, saddle, 0.033, paint);
  tube(group, saddle, stem, 0.033, paint);
  tube(group, stem, crank, 0.032, paint);
  tube(group, saddle, [0, 0.43, 0.76], 0.029, paint);
  tube(group, crank, [0, 0.43, 0.76], 0.033, paint);
  tube(group, stem, [0, 0.43, -0.82], 0.035, steel);
  tube(group, [0, 0.43, -0.82], [0, 1.2, -0.61], 0.025, steel);
  tube(group, [-0.37, 1.2, -0.61], [0.37, 1.2, -0.61], 0.023, steel);
  for (const side of [-1, 1]) {
    tube(group, [side * 0.29, 1.2, -0.61], [side * 0.37, 1.2, -0.61], 0.033, leather);
    tube(group, [0, 0.5, 0.1], [side * 0.15, 0.5, 0.1], 0.028, steel);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.065, 0.29), leather);
  seat.position.set(0, 1.19, 0.37);
  seat.castShadow = true;
  group.add(seat);
  tube(group, [-0.23, 0.48, 0.1], [0.23, 0.48, 0.1], 0.022, steel);
  const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.035), amber);
  reflector.position.set(0, 0.86, 0.83);
  group.add(reflector);
  const stand = tube(group, [-0.09, 0.48, 0.2], [-0.27, 0.12, 0.38], 0.016, steel);
  scene.add(group);
  let speed = 0;
  let riding = false;
  return {
    group,
    get speed() { return speed; },
    get riding() { return riding; },
    get heading() { return group.rotation.y; },
    enter() { riding = true; stand.visible = false; },
    exit(collides) {
      riding = false;
      speed = 0;
      stand.visible = true;
      const side = new THREE.Vector3(Math.cos(group.rotation.y) * 1.05, 0, -Math.sin(group.rotation.y) * 1.05);
      let x = group.position.x + side.x, z = group.position.z + side.z;
      if (collides(x, z)) { x = group.position.x - side.x; z = group.position.z - side.z; }
      return { x, y: heightAt(x, z), z };
    },
    update(delta, input, collides) {
      const desired = input.forward > 0.05 ? 7.6 * input.forward : input.forward < -0.05 ? -1.4 * -input.forward : 0;
      speed += (desired - speed) * Math.min(1, delta * (input.forward < 0 && speed > 0 ? 4 : 2.3));
      if (Math.abs(speed) < 0.035) speed = 0;
      group.rotation.y -= input.right * Math.min(1, Math.abs(speed) / 3) * delta * 1.25 * Math.sign(speed || 1);
      const dx = -Math.sin(group.rotation.y) * speed * delta;
      const dz = -Math.cos(group.rotation.y) * speed * delta;
      const nextX = THREE.MathUtils.clamp(group.position.x + dx, -475, 475);
      const nextZ = THREE.MathUtils.clamp(group.position.z + dz, -475, 475);
      if (!collides(nextX, group.position.z, 0.65)) group.position.x = nextX;
      else speed = 0;
      if (!collides(group.position.x, nextZ, 0.65)) group.position.z = nextZ;
      else speed = 0;
      group.position.y = heightAt(group.position.x, group.position.z);
      rear.rotation.x -= speed * delta / 0.39;
      front.rotation.x -= speed * delta / 0.39;
      return { speed, heading: group.rotation.y };
    },
  };
}
