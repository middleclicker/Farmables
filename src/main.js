import * as THREE from 'three';
import { createWorld } from './world.js';
import { createJohn } from './john.js';
import './fonts.css';
import './style.css';
import './intro.css';

const sceneHost = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const error = document.querySelector('#error');
const hintText = document.querySelector('#hint-text');
const fullScreenButton = document.querySelector('#fullscreen');

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(59, window.innerWidth / window.innerHeight, 0.1, 1500);
  const world = createWorld(scene, renderer);
  const john = createJohn(scene);
  john.group.position.set(-64, world.heightAt(-64, 105), 105);
  john.group.rotation.y = -0.08;

  const keys = new Set();
  let cameraYaw = -0.08;
  let cameraPitch = 0.32;
  let cameraDistance = 10.5;
  let dragPointer = null;
  let lastPointer = { x: 0, y: 0 };
  let touchMove = { x: 0, y: 0 };
  let joystickPointer = null;
  const joystick = document.querySelector('#joystick');
  const joystickKnob = document.querySelector('#joystick-knob');

  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

  window.addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  renderer.domElement.addEventListener('pointerdown', event => {
    dragPointer = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    cameraYaw -= dx * 0.0045;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * 0.003, 0.17, 1.02);
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  const stopDrag = event => { if (event.pointerId === dragPointer) dragPointer = null; };
  renderer.domElement.addEventListener('pointerup', stopDrag);
  renderer.domElement.addEventListener('pointercancel', stopDrag);
  renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.012, 4.5, 17);
  }, { passive: false });

  const moveKnob = event => {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX, dy = event.clientY - centerY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const radius = Math.min(36, length);
    const x = dx / length * radius, y = dy / length * radius;
    joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
    touchMove = { x: x / 36, y: -y / 36 };
  };
  joystick.addEventListener('pointerdown', event => {
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveKnob(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId === joystickPointer) moveKnob(event);
  });
  const stopJoystick = event => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    touchMove = { x: 0, y: 0 };
    joystickKnob.style.transform = '';
  };
  joystick.addEventListener('pointerup', stopJoystick);
  joystick.addEventListener('pointercancel', stopJoystick);

  fullScreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const target = new THREE.Vector3(john.group.position.x, john.group.position.y + 1.7, john.group.position.z);
  const clock = new THREE.Clock();
  let elapsed = 0;
  let lastHint = '';
  let didLoad = false;

  function updateHint() {
    const { x, z } = john.group.position;
    let message = 'Walk around and explore the farm';
    if (x > world.field.minX && x < world.field.maxX && z > world.field.minZ && z < world.field.maxZ) {
      message = 'John’s first field · freshly sown';
    } else if (Math.abs(x - world.roadX(z)) < 9) {
      message = 'The road leads north to the village';
    } else if (z < -230) {
      message = 'The village is just ahead';
    } else if (x > 125 && z > 85 && z < 170) {
      message = 'The old barn · a place to begin';
    }
    if (message !== lastHint) {
      hintText.textContent = message;
      lastHint = message;
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;

    const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touchMove.y;
    const rightInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchMove.x;
    const inputLength = Math.hypot(forwardInput, rightInput);
    const moving = inputLength > 0.05;
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 10 : 5.1;
    if (moving) {
      document.body.classList.add('exploring');
      const forward = forwardInput / Math.max(1, inputLength);
      const right = rightInput / Math.max(1, inputLength);
      const dx = (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * right) * speed * delta;
      const dz = (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * right) * speed * delta;
      john.group.position.x = THREE.MathUtils.clamp(john.group.position.x + dx, -475, 475);
      john.group.position.z = THREE.MathUtils.clamp(john.group.position.z + dz, -475, 475);
      const direction = Math.atan2(-dx, -dz);
      let difference = direction - john.group.rotation.y;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      john.group.rotation.y += difference * Math.min(1, delta * 12);
    }
    john.group.position.y = world.heightAt(john.group.position.x, john.group.position.z);
    john.update(elapsed, moving ? speed : 0);

    const wantedTarget = new THREE.Vector3(john.group.position.x, john.group.position.y + 1.58, john.group.position.z);
    target.lerp(wantedTarget, 1 - Math.exp(-delta * 7));
    const horizontal = cameraDistance * Math.cos(cameraPitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(cameraYaw) * horizontal,
      target.y + cameraDistance * Math.sin(cameraPitch),
      target.z + Math.cos(cameraYaw) * horizontal,
    );
    desired.y = Math.max(desired.y, world.heightAt(desired.x, desired.z) + 1.4);
    camera.position.lerp(desired, 1 - Math.exp(-delta * 8));
    camera.lookAt(target);
    renderer.render(scene, camera);
    updateHint();
    if (!didLoad) {
      didLoad = true;
      john.ready.then(() => {
        loading.classList.add('done');
        setTimeout(() => loading.remove(), 750);
      });
    }
  }
  frame();
} catch (cause) {
  console.error('Farmables could not start', cause);
  loading.remove();
  error.hidden = false;
  error.textContent = 'Farmables needs a browser with WebGL support. Please try a current version of Chrome, Edge, Firefox, or Safari.';
}
