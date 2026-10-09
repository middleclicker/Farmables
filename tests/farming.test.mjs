import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newFarm, clearAccess, sampleSoil, sendSoilSample, readSoilReport,
  acquireTractor, buySupply, rentTool, workFieldSwath, advanceToNextEvent,
  decideFertilizer, helpNeighbor, loadFarm, saveFarm, dateLabel, coveragePercent,
} from '../src/farming.js';
import { FIELD_BOUNDS, workedAt } from '../src/fieldwork.js';
import { advanceClock, timeLabel, weatherForDay } from '../src/weather.js';

const adapter = () => {
  const storage = new Map();
  return { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
};

function coverField(farm) {
  const phase = farm.phase;
  for (let x = FIELD_BOUNDS.minX + 3; x < FIELD_BOUNDS.maxX; x += 5) {
    workFieldSwath(farm, x, FIELD_BOUNDS.minZ + 3, x, FIELD_BOUNDS.maxZ - 3, 6);
    if (farm.phase !== phase) return;
  }
  assert.fail(`Driving overlapping full-length swaths did not finish ${phase}`);
}

test('winter wheat progresses through sample delivery, metre-scale field passes, and harvest', () => {
  const farm = newFarm();
  assert.equal(dateLabel(farm.day), '20 Aug 2026');
  assert.equal(sampleSoil(farm), false);
  clearAccess(farm); clearAccess(farm);
  assert.equal(farm.phase, 'test');
  assert.equal(sampleSoil(farm), true);
  assert.equal(farm.phase, 'test_collected');
  assert.equal(farm.coins, 2150);
  assert.equal(sendSoilSample(farm), true);
  assert.equal(readSoilReport(farm), false);
  assert.match(advanceToNextEvent(farm), /laboratory report/);
  assert.equal(farm.phase, 'test_pending');
  assert.equal(readSoilReport(farm), true);
  assert.equal(farm.phase, 'mow');
  assert.equal(acquireTractor(farm, 'rent'), true);
  assert.equal(rentTool(farm, 'mow'), true);
  const first = workFieldSwath(farm, -20, 0, -20, 12, 6);
  assert.equal(first.changed, true);
  assert.equal(workedAt(farm, -20, 6), true);
  assert.equal(workedAt(farm, 0, 6), false);
  assert.ok(farm.workCount > 0);
  coverField(farm);
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
  assert.equal(buySupply(farm, 'wheatSeed'), true);
  assert.equal(rentTool(farm, 'sow'), true);
  coverField(farm);
  assert.equal(farm.phase, 'growing');
  assert.equal(farm.tractorRented, false);
  assert.match(advanceToNextEvent(farm), /Autumn/);
  assert.match(advanceToNextEvent(farm), /Winter/);
  assert.match(advanceToNextEvent(farm), /Spring/);
  assert.equal(decideFertilizer(farm, true), true);
  assert.match(advanceToNextEvent(farm), /flowering/);
  assert.match(advanceToNextEvent(farm), /ripe/);
  assert.equal(rentTool(farm, 'harvest'), true);
  const beforeHarvest = farm.coins;
  coverField(farm);
  assert.equal(farm.phase, 'harvested');
  assert.equal(farm.coins, beforeHarvest + farm.lastYield);
  advanceToNextEvent(farm);
  assert.equal(farm.phase, 'clear');
});

test('work mask survives save and old cell saves migrate', () => {
  const farm = newFarm();
  farm.phase = 'mow'; farm.tool = 'mow';
  workFieldSwath(farm, -10, 0, -10, 20, 5);
  const storage = adapter();
  saveFarm(farm, storage);
  const restored = loadFarm(storage);
  assert.equal(restored.workCount, farm.workCount);
  assert.equal(workedAt(restored, -10, 10), true);
  assert.equal(workedAt(restored, 10, 10), false);
  const old = newFarm();
  old.version = 1; old.coverage[5] = true;
  const oldStorage = { getItem: () => JSON.stringify(old) };
  assert.ok(loadFarm(oldStorage).workCount > 0);
});

test('equipment, jobs, weather and accelerated clock remain consistent', () => {
  const farm = newFarm();
  assert.equal(acquireTractor(farm, 'buy'), true);
  assert.equal(acquireTractor(farm, 'rent'), false);
  assert.equal(helpNeighbor(farm, 'cottage_a'), true);
  assert.equal(helpNeighbor(farm, 'cottage_a'), false);
  const storage = adapter();
  saveFarm(farm, storage);
  assert.deepEqual(loadFarm(storage).neighborJobs, ['cottage_a']);
  farm.timeOfDay = 23.99;
  assert.equal(advanceClock(farm, 1), true);
  assert.equal(farm.day, 1);
  assert.match(timeLabel(farm.timeOfDay), /^00:/);
  assert.deepEqual(weatherForDay(9), weatherForDay(9));
});

test('an older save with two cleared gate patches resumes at soil sampling', () => {
  const previousSave = newFarm();
  previousSave.version = 1;
  previousSave.accessCleared = 2;
  const storage = { getItem: () => JSON.stringify(previousSave) };
  assert.equal(loadFarm(storage).phase, 'test');
});
