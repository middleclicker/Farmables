import * as THREE from 'three';

const HERD = [
  [-158, 75], [-169, 67], [-178, 83], [-155, 40], [-182, 26],
  [-161, 14], [-175, -5], [-148, -31], [-184, -44], [-164, -57],
];

function woolTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#e9e4d5';
  context.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73.73) % 128, y = (i * 47.19) % 128;
    context.fillStyle = i % 3 ? '#c8c1af' : '#faf5e8';
    context.beginPath();
    context.arc(x, y, 0.7 + (i % 5) * 0.21, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createAnimals(scene, heightAt) {
  const wool = new THREE.MeshStandardMaterial({ map: woolTexture(), roughness: 1 });
  const face = new THREE.MeshStandardMaterial({ color: 0x554c42, roughness: 1 });
  const hoof = new THREE.MeshStandardMaterial({ color: 0x393936, roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x161b18, roughness: 0.42 });
  const count = HERD.length;
  const parts = {
    bodies: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), wool, count),
    necks: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), wool, count),
    heads: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), face, count),
    ears: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), face, count * 2),
    eyes: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), eye, count * 2),
    legs: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 1, 7), face, count * 4),
    hooves: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), hoof, count * 4),
  };
  const all = Object.values(parts);
  all.forEach(mesh => { mesh.castShadow = true; mesh.frustumCulled = false; scene.add(mesh); });
  const dummy = new THREE.Object3D();
  const positions = HERD.map(([x, z]) => ({ x, z }));
  let lastUpdate = -1;

  function place(mesh, index, x, y, z, yaw, localX, localY, localZ, sx, sy, sz, pitch = 0) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    dummy.position.set(x + localX * c + localZ * s, y + localY, z - localX * s + localZ * c);
    dummy.rotation.set(pitch, yaw, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  for (let i = 0; i < count; i++) parts.bodies.setColorAt(i, new THREE.Color([0xffffff, 0xe5e0d5, 0xd4cabc, 0xf2eee4][i % 4]));
  parts.bodies.instanceColor.needsUpdate = true;

  return {
    mapPositions: positions,
    update(time, subject) {
      const nearby = Math.hypot(subject.x + 166, subject.z - 24) < 245;
      all.forEach(mesh => { mesh.visible = nearby; });
      if (!nearby || time - lastUpdate < 0.05) return;
      lastUpdate = time;
      HERD.forEach(([baseX, baseZ], i) => {
        const phase = i * 2.37;
        const cycle = time * (0.19 + i % 3 * 0.018) + phase;
        const x = baseX + Math.sin(cycle) * 2.1;
        const z = baseZ + Math.cos(cycle * 0.79) * 1.65;
        positions[i].x = x; positions[i].z = z;
        const dx = Math.cos(cycle) * 2.1;
        const dz = -Math.sin(cycle * 0.79) * 1.3;
        const yaw = Math.atan2(-dx, -dz);
        const ground = heightAt(x, z);
        const graze = Math.max(0, Math.sin(time * 0.9 + phase)) * 0.23;
        const step = Math.sin(time * 2.25 + phase) * 0.035;
        place(parts.bodies, i, x, ground, z, yaw, 0, 1.05, 0, 0.5, 0.53, 0.88);
        place(parts.necks, i, x, ground, z, yaw, 0, 1.31 - graze * 0.45, -0.54, 0.32, 0.38, 0.35);
        place(parts.heads, i, x, ground, z, yaw, 0, 1.27 - graze, -0.84, 0.26, 0.3, 0.29, graze * 0.28);
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          place(parts.ears, i * 2 + side, x, ground, z, yaw, sign * 0.29, 1.39 - graze, -0.79, 0.18, 0.075, 0.11);
          place(parts.eyes, i * 2 + side, x, ground, z, yaw, sign * 0.225, 1.34 - graze, -0.97, 0.025, 0.027, 0.025);
        }
        for (let leg = 0; leg < 4; leg++) {
          const side = leg % 2 ? 1 : -1;
          const fore = leg < 2 ? -1 : 1;
          const legZ = fore * 0.53 + (leg % 2 ? step : -step);
          place(parts.legs, i * 4 + leg, x, ground, z, yaw, side * 0.3, 0.44, legZ, 1, 0.76, 1);
          place(parts.hooves, i * 4 + leg, x, ground, z, yaw, side * 0.3, 0.11, legZ - 0.035, 0.18, 0.16, 0.23);
        }
      });
      all.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    },
    collides(x, z, radius = 0.42) {
      return positions.some(sheep => Math.hypot(sheep.x - x, sheep.z - z) < radius + 0.54);
    },
  };
}
