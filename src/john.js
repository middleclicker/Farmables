import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import johnModelUrl from '../assets/john-farmer-neutral.glb?url';

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
  let idleAction = null;
  let walkAction = null;
  let runAction = null;
  let idleWeight = 1;
  let walkWeight = 0;
  let runWeight = 0;
  let lastTime = 0;
  const cycleBones = new Map();
  const cyclingBaseRotations = new Map();
  const cycleRotation = new THREE.Quaternion();
  const cycleEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  let cyclingApplied = false;
  // Quarter-turn poses place the boots over opposite pedals on this rig.
  const legFrames = {
    Left: [[-0.012, 1.357], [-0.716, 2.186], [-1.059, 1.651], [-0.263, 0.959]],
    Right: [[0.084, 1.103], [-0.577, 1.937], [-0.959, 1.423], [-0.171, 0.705]],
  };
  function cycleValue(frames, phase, component) {
    const position = THREE.MathUtils.euclideanModulo(phase, 1) * 4;
    const i = Math.floor(position), t = position - i;
    const a = frames[(i + 3) % 4][component], b = frames[i][component];
    const c = frames[(i + 1) % 4][component], d = frames[(i + 2) % 4][component];
    return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  }
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
        if (object.isBone) cycleBones.set(object.name, object);
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
        // Blend opposing gait frames into a balanced, planted standing pose.
        // The model's unanimated bind pose has its arms held straight out.
        const tracks = walk.tracks.map(track => {
          const interpolant = track.createInterpolant();
          const first = Array.from(interpolant.evaluate(walk.duration * 0.14));
          const opposite = Array.from(interpolant.evaluate(walk.duration * 0.64));
          let values;
          if (track.name.endsWith('.quaternion')) {
            const a = new THREE.Quaternion(...first);
            const b = new THREE.Quaternion(...opposite);
            a.slerp(b, 0.5);
            values = a.toArray();
          } else values = first.map((value, index) => (value + opposite[index]) * 0.5);
          return new track.constructor(track.name, [0], values, track.getInterpolation());
        });
        idleAction = mixer.clipAction(new THREE.AnimationClip('standing', 1, tracks));
        idleAction.play();
        idleAction.setEffectiveWeight(1);
        walkAction = mixer.clipAction(walk);
        walkAction.play();
        walkAction.setEffectiveWeight(0);
      }
      if (run) {
        runAction = mixer.clipAction(run);
        runAction.play();
        runAction.setEffectiveWeight(0);
      }
      mixer.update(0);
      // A one-frame standing clip may skip redundant writes. Always apply the
      // riding pose from this saved base so its rotations cannot accumulate.
      for (const [name, bone] of cycleBones) cyclingBaseRotations.set(name, bone.quaternion.clone());
      resolve();
    }, undefined, cause => {
      console.warn('Using John fallback model', cause);
      resolve();
    });
  });

  return {
    group: john,
    ready,
    updateCycling(time, pedalAngle) {
      this.update(time, 0);
      const pose = (name, x, z = 0) => {
        const bone = cycleBones.get(name);
        if (bone) bone.quaternion.copy(cyclingBaseRotations.get(name)).multiply(cycleRotation.setFromEuler(cycleEuler.set(x, 0, z)));
      };
      const phase = -pedalAngle / (Math.PI * 2);
      pose('Spine', -0.17);
      pose('LeftArm', -1.13, -0.45);
      pose('RightArm', -1.15, 0.11);
      pose('LeftForeArm', 0.61);
      pose('RightForeArm', 0.55);
      for (const side of ['Left', 'Right']) {
        const localPhase = phase + (side === 'Right' ? 0.5 : 0);
        const thigh = cycleValue(legFrames[side], localPhase, 0);
        const calf = cycleValue(legFrames[side], localPhase, 1);
        pose(`${side}UpLeg`, thigh);
        pose(`${side}Leg`, calf);
        pose(`${side}Foot`, -(thigh + calf) * 0.8);
      }
      cyclingApplied = true;
      if (!mixer) {
        leftLeg.rotation.x = cycleValue(legFrames.Left, phase, 0);
        rightLeg.rotation.x = cycleValue(legFrames.Right, phase + 0.5, 0);
        leftArm.rotation.x = -1.13;
        rightArm.rotation.x = -1.15;
        body.rotation.x = -0.17;
      }
    },
    update(time, speed) {
      if (mixer) {
        if (cyclingApplied) {
          for (const [name, bone] of cycleBones) bone.quaternion.copy(cyclingBaseRotations.get(name));
          cyclingApplied = false;
        }
        const delta = Math.max(0, Math.min(time - lastTime, 0.06));
        const running = speed > 4.5 && !!runAction;
        const smoothing = 1 - Math.exp(-delta * (speed < 0.1 ? 17 : 11));
        idleWeight += ((speed < 0.1 ? 1 : 0.08) - idleWeight) * smoothing;
        walkWeight += ((speed >= 0.1 && !running ? 0.92 : 0) - walkWeight) * smoothing;
        runWeight += ((speed >= 0.1 && running ? 0.92 : 0) - runWeight) * smoothing;
        idleAction?.setEffectiveWeight(idleWeight);
        walkAction?.setEffectiveWeight(walkWeight);
        runAction?.setEffectiveWeight(runWeight);
        walkAction?.setEffectiveTimeScale(1.25);
        runAction?.setEffectiveTimeScale(1.35);
        mixer.update(delta);
        lastTime = time;
        return;
      }
      const gait = Math.min(1, speed / 5.2);
      const stride = Math.sin(time * (speed > 4.5 ? 13 : 10)) * gait;
      leftLeg.rotation.x = stride * 0.42;
      rightLeg.rotation.x = -stride * 0.42;
      leftArm.rotation.x = -stride * 0.31;
      rightArm.rotation.x = stride * 0.31;
      body.position.y = Math.abs(stride) * 0.035;
      body.rotation.x = 0;
      body.rotation.z = -stride * 0.012;
    },
  };
}
