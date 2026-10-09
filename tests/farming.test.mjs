import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFarm, FIELD_CELLS, COVERAGE_TARGET, clearAccess, sampleSoil,
  acquireTractor, buySupply, rentTool, workCell, advanceToNextEvent,
  decideFertilizer, helpNeighbor, loadFarm, saveFarm, dateLabel,
} from '../src/farming.js';

function coverField(farm) {
  for (let cell = 0; cell < COVERAGE_TARGET; cell++) {
    const outcome = workCell(farm, cell);
    assert.equal(outcome.changed, true);
    assert.equal(outcome.completed, cell === COVERAGE_TARGET - 1);
  }
}

test('winter wheat progresses from neglected field through harvest and a new year', () => {
  const farm = newFarm();
  assert.equal(farm.coverage.length, FIELD_CELLS);
  assert.equal(dateLabel(farm.day), '20 Aug 2026');
  assert.equal(sampleSoil(farm), false);
  for (let i = 0; i < 3; i++) assert.equal(clearAccess(farm), true);
  assert.equal(farm.phase, 'test');
  assert.equal(sampleSoil(farm), true);
  assert.match(advanceToNextEvent(farm), /pH 5.8/);
  assert.equal(farm.phase, 'mow');
  assert.equal(acquireTractor(farm, 'rent'), true);
  assert.equal(rentTool(farm, 'mow'), true);
  assert.equal(workCell(farm, 0).changed, true);
  assert.equal(workCell(farm, 0).changed, false);
  for (let cell = 1; cell < COVERAGE_TARGET; cell++) workCell(farm, cell);
  assert.equal(farm.phase, 'lime');
  assert.equal(rentTool(farm, 'lime'), false);
  assert.equal(buySupply(farm, 'lime'), true);
  assert.equal(rentTool(farm, 'lime'), true);
  coverField(farm);
  assert.equal(farm.phase, 'cultivate');
  assert.equal(rentTool(farm, 'cultivate'), true);
  coverField(farm);
  assert.equal(farm.phase, 'ready_to_sow');
  assert.match(advanceToNextEvent(farm), /September/);
  assert.equal(farm.phase, 'sow');
  assert.equal(buySupply(farm, 'wheatSeed'), true);
  assert.equal(rentTool(farm, 'sow'), true);
  coverField(farm);
  assert.equal(farm.phase, 'growing');
  assert.equal(farm.tractorRented, false);
  assert.match(advanceToNextEvent(farm), /Autumn/);
  assert.match(advanceToNextEvent(farm), /Winter/);
  assert.match(advanceToNextEvent(farm), /Spring/);
  assert.equal(farm.phase, 'spring_care');
  assert.equal(decideFertilizer(farm, true), true);
  assert.match(advanceToNextEvent(farm), /flowering/);
  assert.match(advanceToNextEvent(farm), /ripe/);
  assert.equal(farm.phase, 'harvest');
  assert.equal(rentTool(farm, 'harvest'), true);
  const beforeHarvest = farm.coins;
  coverField(farm);
  assert.equal(farm.phase, 'harvested');
  assert.equal(farm.coins, beforeHarvest + farm.lastYield);
  assert.equal(farm.combineRented, false);
  assert.equal(farm.harvestCount, 1);
  const total = farm.coins;
  advanceToNextEvent(farm);
  assert.equal(farm.phase, 'clear');
  assert.equal(farm.coins, total);
  assert.equal(farm.day, 365);
});

test('buying equipment, village jobs, and save restore remain consistent', () => {
  const farm = newFarm();
  assert.equal(acquireTractor(farm, 'buy'), true);
  assert.equal(acquireTractor(farm, 'rent'), false);
  assert.equal(helpNeighbor(farm, 'cottage_a'), true);
  assert.equal(helpNeighbor(farm, 'cottage_a'), false);
  const storage = new Map();
  const adapter = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  saveFarm(farm, adapter);
  const restored = loadFarm(adapter);
  assert.equal(restored.coins, farm.coins);
  assert.equal(restored.tractorOwned, true);
  assert.deepEqual(restored.neighborJobs, ['cottage_a']);
});
