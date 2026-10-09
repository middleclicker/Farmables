import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBicycle } from '../src/bicycle.js';

test('the bicycle accelerates, steers, stops at obstacles, and can be dismounted', () => {
  const bicycle = createBicycle(new THREE.Scene(), () => 0);
  bicycle.group.position.set(0, 0, 0);
  bicycle.enter();
  for (let i = 0; i < 60; i++) bicycle.update(1 / 60, { forward: 1, right: 0 }, () => false);
  assert.ok(bicycle.speed > 6);
  assert.ok(bicycle.pedalAngle < 0, 'pedals turn as the bike moves forward');
  assert.ok(bicycle.group.position.z < -4);
  for (let i = 0; i < 60; i++) bicycle.update(1 / 60, { forward: 1, right: 1 }, () => false);
  assert.ok(bicycle.group.position.x > 1);
  const blockedZ = bicycle.group.position.z;
  for (let i = 0; i < 60; i++) bicycle.update(1 / 60, { forward: 1, right: 0 }, (_, z) => z < blockedZ - 0.2);
  assert.ok(bicycle.group.position.z >= blockedZ - 0.2);
  const dismount = bicycle.exit(() => false);
  assert.equal(bicycle.riding, false);
  assert.ok(Math.hypot(dismount.x - bicycle.group.position.x, dismount.z - bicycle.group.position.z) > 1);
});

test('pedals hold their position when the bicycle is stationary', () => {
  const bicycle = createBicycle(new THREE.Scene(), () => 0);
  bicycle.enter();
  for (let i = 0; i < 60; i++) bicycle.update(1 / 60, { forward: 1, right: 0 }, () => false);
  for (let i = 0; i < 180; i++) bicycle.update(1 / 60, { forward: 0, right: 0 }, () => false);
  assert.equal(bicycle.speed, 0);
  const stoppedAngle = bicycle.pedalAngle;
  for (let i = 0; i < 60; i++) bicycle.update(1 / 60, { forward: 0, right: 0 }, () => false);
  assert.equal(bicycle.pedalAngle, stoppedAngle);
});
