import test from 'node:test';
import assert from 'node:assert/strict';
import { mapArrowAngle, headingFromMovement } from '../src/navigation.js';

test('minimap arrow follows world travel in every cardinal direction', () => {
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const angle = mapArrowAngle(headingFromMovement(dx, dz));
    assert.ok(Math.abs(Math.sin(angle) - dx) < 1e-10);
    assert.ok(Math.abs(-Math.cos(angle) - dz) < 1e-10);
  }
});
