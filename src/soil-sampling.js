import * as THREE from 'three';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function createSoilSampling(scene) {
  const rig = new THREE.Group();
  rig.visible = false;
  scene.add(rig);
  const steel = new THREE.MeshStandardMaterial({ color: 0x90948c, metalness: 0.7, roughness: 0.36 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x48514e, metalness: 0.6, roughness: 0.5 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x65513d, roughness: 1 });
  const bagPaper = new THREE.MeshStandardMaterial({ color: 0xc8b994, roughness: 1 });
  const label = new THREE.MeshStandardMaterial({ color: 0xe9e2c9, roughness: 1 });
  const probe = new THREE.Group();
  probe.position.set(0.34, 1.15, -0.8);
  rig.add(probe);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 1.3, 8), steel);
  shaft.position.y = 0;
  shaft.castShadow = true;
  probe.add(shaft);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), darkSteel);
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.69;
  handle.castShadow = true;
  probe.add(handle);
  const bit = new THREE.Mesh(new THREE.ConeGeometry(0.047, 0.15, 8), steel);
  bit.rotation.z = Math.PI;
  bit.position.y = -0.7;
  probe.add(bit);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.38, 7), soil);
  core.position.y = -0.56;
  core.visible = false;
  probe.add(core);

  const bag = new THREE.Group();
  bag.position.set(-0.4, 0.2, -0.74);
  bag.visible = false;
  rig.add(bag);
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.39, 0.15), bagPaper);
  pouch.castShadow = true;
  bag.add(pouch);
  const foldedTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.17), bagPaper);
  foldedTop.position.y = 0.2;
  bag.add(foldedTop);
  const writing = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.13), label);
  writing.position.set(0, 0.015, -0.078);
  bag.add(writing);
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.13), soil);
  fill.position.y = -0.15;
  bag.add(fill);

  let elapsed = 0;
  const duration = 3.4;
  let active = false;
  return {
    get active() { return active; },
    get progress() { return clamp01(elapsed / duration); },
    start(player) {
      if (active) return false;
      elapsed = 0;
      active = true;
      rig.visible = true;
      rig.position.copy(player.position);
      rig.rotation.y = player.rotation.y;
      probe.position.set(0.34, 1.15, -0.8);
      core.visible = false;
      bag.visible = false;
      return true;
    },
    update(delta, player) {
      if (!active) return false;
      elapsed = Math.min(duration, elapsed + delta);
      const t = elapsed / duration;
      rig.position.copy(player.position);
      rig.rotation.y = player.rotation.y;
      const down = smooth(t / 0.28);
      const up = smooth((t - 0.52) / 0.21);
      probe.position.y = 1.15 - 0.62 * down + 0.62 * up;
      probe.position.x = 0.34 - 0.74 * smooth((t - 0.73) / 0.18);
      probe.rotation.z = Math.sin(t * 28) * 0.035 * (1 - up);
      core.visible = t > 0.53 && t < 0.9;
      bag.visible = t > 0.65;
      if (t < 1) return false;
      rig.visible = false;
      active = false;
      return true;
    },
  };
}
