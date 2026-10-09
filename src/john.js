import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import johnModelUrl from '../assets/john-farmer.glb?url';

const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

function part(parent, geometry, mat, x, y, z, shadows = true) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  parent.add(mesh);
  return mesh;
}

export function createJohn(scene) {
  const john = new THREE.Group();
  const placeholder = new THREE.Group();
  john.add(placeholder);
  const denim = material(0x384e5c);
  const jacket = material(0x6e7e49);
  const jacketDark = material(0x4f6139);
  const shirt = material(0xc6ae85);
  const skin = material(0xc69270);
  const boot = material(0x493a30);
  const cap = material(0x706a4e);
  const hair = material(0x4b392e);

  const body = new THREE.Group();
  placeholder.add(body);
  part(body, new THREE.BoxGeometry(0.79, 0.84, 0.42), jacket, 0, 1.4, 0);
  part(body, new THREE.BoxGeometry(0.2, 0.67, 0.045), shirt, 0, 1.4, -0.238);
  part(body, new THREE.BoxGeometry(0.86, 0.12, 0.47), jacketDark, 0, 1.06, 0);
  part(body, new THREE.CylinderGeometry(0.125, 0.125, 0.2, 9), skin, 0, 1.86, 0);
  part(body, new THREE.SphereGeometry(0.31, 12, 10), skin, 0, 2.17, -0.02);
  part(body, new THREE.SphereGeometry(0.313, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.49), hair, 0, 2.18, -0.015);
  part(body, new THREE.CylinderGeometry(0.32, 0.32, 0.17, 14), cap, 0, 2.46, -0.01);
  const visor = part(body, new THREE.BoxGeometry(0.55, 0.055, 0.31), cap, 0, 2.4, -0.27);
  visor.rotation.x = -0.1;
  const eyes = material(0x2b2a24);
  for (const x of [-0.12, 0.12]) part(body, new THREE.SphereGeometry(0.027, 6, 5), eyes, x, 2.2, -0.298, false);

  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  leftArm.position.set(-0.49, 1.73, 0);
  rightArm.position.set(0.49, 1.73, 0);
  body.add(leftArm, rightArm);
  for (const [arm, sign] of [[leftArm, -1], [rightArm, 1]]) {
    part(arm, new THREE.CylinderGeometry(0.155, 0.135, 0.64, 8), jacket, sign * 0.035, -0.33, 0);
    part(arm, new THREE.SphereGeometry(0.13, 8, 6), skin, sign * 0.04, -0.7, 0);
  }

  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  leftLeg.position.set(-0.22, 1.02, 0);
  rightLeg.position.set(0.22, 1.02, 0);
  placeholder.add(leftLeg, rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    part(leg, new THREE.CylinderGeometry(0.16, 0.14, 0.74, 8), denim, 0, -0.39, 0);
    part(leg, new THREE.BoxGeometry(0.29, 0.24, 0.43), boot, 0, -0.87, -0.09);
  }

  scene.add(john);

  let mixer = null;
  let walkAction = null;
  let runAction = null;
  let lastTime = 0;
  const ready = new Promise(resolve => {
    new GLTFLoader().load(johnModelUrl, gltf => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      if (size.y > 0) model.scale.multiplyScalar(2.05 / size.y);
      model.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      model.position.y = -scaledBounds.min.y;
      model.rotation.y = Math.PI;
      model.traverse(object => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      placeholder.removeFromParent();
      john.add(model);
      mixer = new THREE.AnimationMixer(model);
      const walk = gltf.animations.find(clip => clip.name.toLowerCase().includes('walk'));
      const run = gltf.animations.find(clip => clip.name.toLowerCase().includes('run'));
      if (walk) {
        walkAction = mixer.clipAction(walk);
        walkAction.play();
        walkAction.time = 0;
        walkAction.setEffectiveWeight(0);
        mixer.update(0);
      }
      if (run) {
        runAction = mixer.clipAction(run);
        runAction.play();
        runAction.setEffectiveWeight(0);
      }
      resolve();
    }, undefined, cause => {
      console.warn('Using John fallback model', cause);
      resolve();
    });
  });

  return {
    group: john,
    ready,
    update(time, speed) {
      if (mixer) {
        const delta = Math.max(0, Math.min(time - lastTime, 0.06));
        const running = speed > 7;
        walkAction?.setEffectiveWeight(speed > 0 && !running ? 0.34 : 0);
        runAction?.setEffectiveWeight(speed > 0 && running ? 0.42 : 0);
        walkAction?.setEffectiveTimeScale(0.72);
        runAction?.setEffectiveTimeScale(0.7);
        mixer.update(delta);
        lastTime = time;
        return;
      }
      const gait = Math.min(1, speed / 5.2);
      const stride = Math.sin(time * (speed > 6 ? 12 : 8.5)) * gait;
      leftLeg.rotation.x = stride * 0.42;
      rightLeg.rotation.x = -stride * 0.42;
      leftArm.rotation.x = -stride * 0.31;
      rightArm.rotation.x = stride * 0.31;
      body.position.y = Math.abs(stride) * 0.035;
      body.rotation.z = -stride * 0.012;
    },
  };
}
