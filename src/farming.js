import { FIELD_BOUNDS, WORK_TARGET, exportWorkMask, paintSwath, resetWork, workPercent } from './fieldwork.js';

export const FIELD_COLUMNS = 9;
export const FIELD_ROWS = 15;
export const FIELD_CELLS = FIELD_COLUMNS * FIELD_ROWS;
export const COVERAGE_TARGET = WORK_TARGET;

export const PRICES = Object.freeze({
  soilTest: 35,
  tractorRent: 240,
  tractorBuy: 920,
  mower: 75,
  spreader: 80,
  cultivator: 100,
  drill: 120,
  lime: 75,
  wheatSeed: 95,
  combine: 360,
  springFertilizer: 90,
});

const START = Date.UTC(2026, 7, 20);
const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const EVENT_DAYS = [36, 102, 207, 281, 339];
const FIELD_PHASES = new Set(['mow', 'lime', 'cultivate', 'sow', 'harvest']);

export function newFarm() {
  return {
    version: 3,
    day: 0,
    timeOfDay: 8.5,
    seasonStartDay: 0,
    coins: 2150,
    phase: 'clear',
    introSeen: false,
    accessCleared: 0,
    tractorOwned: false,
    tractorRented: false,
    combineRented: false,
    tool: null,
    limeBought: false,
    wheatSeedBought: false,
    fertilized: false,
    growthEvent: -1,
    coverage: Array(FIELD_CELLS).fill(false),
    workMask: '',
    workCount: 0,
    workRevision: 0,
    soilReportDay: null,
    soilSampleDay: null,
    documents: [],
    harvestCount: 0,
    lastYield: 0,
    neighborJobs: [],
    positions: { john: [-64, 105], bicycle: [-64, 112, 0.14], tractor: [-40, 181, 0], combine: [-55, 183, 0] },
  };
}

export function loadFarm(storage) {
  try {
    const stored = JSON.parse(storage.getItem('farmables-save-v1'));
    if (![1, 2, 3].includes(stored?.version) || !Array.isArray(stored.coverage) || stored.coverage.length !== FIELD_CELLS) return newFarm();
    if (!Number.isFinite(stored.coins) || !Number.isFinite(stored.day)) return newFarm();
    const farm = { ...newFarm(), ...stored, coverage: stored.coverage.map(Boolean) };
    if (!farm.positions || !['john', 'tractor', 'combine'].every(key =>
      Array.isArray(farm.positions[key]) && farm.positions[key].length >= 2 && farm.positions[key].every(Number.isFinite))) farm.positions = newFarm().positions;
    if (!Array.isArray(farm.positions.bicycle) || farm.positions.bicycle.length < 2 || !farm.positions.bicycle.every(Number.isFinite))
      farm.positions.bicycle = newFarm().positions.bicycle;
    if (!Array.isArray(farm.neighborJobs)) farm.neighborJobs = [];
    if (!Array.isArray(farm.documents)) farm.documents = [];
    if (stored.version === 1) {
      farm.workMask = '';
      farm.workCount = 0;
      const width = (FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX) / FIELD_COLUMNS;
      const depth = (FIELD_BOUNDS.maxZ - FIELD_BOUNDS.minZ) / FIELD_ROWS;
      stored.coverage.forEach((covered, index) => {
        if (!covered) return;
        const x = FIELD_BOUNDS.minX + (index % FIELD_COLUMNS + 0.5) * width;
        const z = FIELD_BOUNDS.minZ + (Math.floor(index / FIELD_COLUMNS) + 0.5) * depth;
        paintSwath(farm, x, z - depth / 2 + 1, x, z + depth / 2 - 1, width);
      });
    }
    if (!Number.isFinite(farm.timeOfDay) || farm.timeOfDay < 0 || farm.timeOfDay >= 24) farm.timeOfDay = 8.5;
    if (farm.phase === 'test_pending' && !Number.isFinite(farm.soilReportDay)) farm.soilReportDay = farm.day + 2;
    if (Number.isFinite(farm.soilReportDay) && !farm.documents.some(document => document.type === 'soil' && document.deliveredDay === farm.soilReportDay)) {
      farm.documents.push({ type: 'soil', id: `SOIL-${String(farm.harvestCount + 1).padStart(3, '0')}`, sampledDay: farm.soilReportDay - 2, deliveredDay: farm.soilReportDay, reviewed: farm.phase !== 'test_pending', ph: 5.8 });
    }
    farm.version = 3;
    if (farm.phase === 'clear' && farm.accessCleared >= 2) farm.phase = 'test';
    return farm;
  } catch {
    return newFarm();
  }
}

export function saveFarm(state, storage) {
  exportWorkMask(state);
  storage.setItem('farmables-save-v1', JSON.stringify(state));
}

export function dateLabel(day) {
  return DATE_FORMATTER.format(new Date(START + day * 86400000));
}

export function spend(state, amount) {
  if (state.coins < amount) return false;
  state.coins -= amount;
  return true;
}

export function clearAccess(state) {
  if (state.phase !== 'clear') return false;
  state.accessCleared++;
  if (state.accessCleared >= 2) state.phase = 'test';
  return true;
}

export function sampleSoil(state) {
  if (state.phase !== 'test') return false;
  state.phase = 'test_collected';
  return true;
}

export function sendSoilSample(state) {
  if (state.phase !== 'test_collected' || !spend(state, PRICES.soilTest)) return false;
  state.phase = 'test_pending';
  state.soilReportDay = state.day + 2;
  state.soilSampleDay = state.day;
  state.documents.push({ type: 'soil', id: `SOIL-${String(state.harvestCount + 1).padStart(3, '0')}`, sampledDay: state.day, deliveredDay: state.soilReportDay, reviewed: false, ph: 5.8 });
  return true;
}

export function readSoilReport(state) {
  if (state.phase !== 'test_pending' || state.day < state.soilReportDay) return false;
  const report = state.documents.find(document => document.type === 'soil' && document.deliveredDay === state.soilReportDay);
  if (report) report.reviewed = true;
  state.phase = 'mow';
  return true;
}

export function acquireTractor(state, kind) {
  if (state.tractorOwned) return false;
  if (kind === 'buy' && spend(state, PRICES.tractorBuy)) {
    state.tractorOwned = true;
    state.tractorRented = false;
    state.documents.push({ type: 'equipment', id: `EQ-${state.day}-${state.documents.length + 1}`, day: state.day, title: 'Tractor purchase', amount: PRICES.tractorBuy, terms: 'Owned by John’s Farm.' });
    return true;
  }
  if (kind === 'rent' && !state.tractorRented && spend(state, PRICES.tractorRent)) {
    state.tractorRented = true;
    state.documents.push({ type: 'equipment', id: `EQ-${state.day}-${state.documents.length + 1}`, day: state.day, title: 'Tractor hire', amount: PRICES.tractorRent, terms: 'Returned after sowing.' });
    return true;
  }
  return false;
}

export function buySupply(state, supply) {
  if (supply === 'lime' && !state.limeBought && spend(state, PRICES.lime)) {
    state.limeBought = true;
    return true;
  }
  if (supply === 'wheatSeed' && !state.wheatSeedBought && spend(state, PRICES.wheatSeed)) {
    state.wheatSeedBought = true;
    return true;
  }
  return false;
}

export function rentTool(state, tool) {
  if (!FIELD_PHASES.has(state.phase) || state.phase !== tool || state.tool === tool) return false;
  if (tool === 'harvest') {
    if (state.combineRented || !spend(state, PRICES.combine)) return false;
    state.combineRented = true;
    state.tool = tool;
    state.documents.push({ type: 'equipment', id: `EQ-${state.day}-${state.documents.length + 1}`, day: state.day, title: 'Combine hire', amount: PRICES.combine, terms: 'Returned after harvest.' });
    return true;
  }
  if (!state.tractorOwned && !state.tractorRented) return false;
  if (tool === 'lime' && !state.limeBought) return false;
  if (tool === 'sow' && !state.wheatSeedBought) return false;
  const cost = { mow: PRICES.mower, lime: PRICES.spreader, cultivate: PRICES.cultivator, sow: PRICES.drill }[tool];
  if (!spend(state, cost)) return false;
  state.tool = tool;
  state.documents.push({ type: 'equipment', id: `EQ-${state.day}-${state.documents.length + 1}`, day: state.day, title: `${{ mow: 'Mower', lime: 'Lime spreader', cultivate: 'Cultivator', sow: 'Seed drill' }[tool]} hire`, amount: cost, terms: 'Hired for the current field operation.' });
  return true;
}

export function workFieldSwath(state, fromX, fromZ, toX, toZ, width) {
  if (!FIELD_PHASES.has(state.phase) || state.tool !== state.phase) return { changed: false, completed: false };
  const changed = paintSwath(state, fromX, fromZ, toX, toZ, width);
  if (!changed) return { changed: false, completed: false };
  if (state.workCount < COVERAGE_TARGET) return { changed: true, completed: false };
  state.coverage.fill(false);
  const previous = state.phase;
  state.tool = null;
  resetWork(state);
  if (previous === 'mow') state.phase = 'lime';
  if (previous === 'lime') state.phase = 'cultivate';
  if (previous === 'cultivate') state.phase = 'ready_to_sow';
  if (previous === 'sow') {
    state.phase = 'growing';
    state.tractorRented = false;
    state.growthEvent = -1;
  }
  if (previous === 'harvest') {
    state.phase = 'harvested';
    state.combineRented = false;
    state.harvestCount++;
    state.lastYield = Math.round(1950 * (state.fertilized ? 1.2 : 0.88));
    state.coins += state.lastYield;
  }
  return { changed: true, completed: true, previous };
}

export function advanceToNextEvent(state) {
  if (state.phase === 'test_pending') {
    if (state.day >= state.soilReportDay) return null;
    state.day = state.soilReportDay;
    state.timeOfDay = 9;
    return 'The laboratory report has arrived at the farmhouse.';
  }
  if (state.phase === 'ready_to_sow') {
    state.day = Math.max(state.day, state.seasonStartDay + 16);
    state.phase = 'sow';
    return 'September sowing window is open.';
  }
  if (state.phase === 'growing') {
    const next = state.growthEvent + 1;
    if (next >= EVENT_DAYS.length) return null;
    state.day = Math.max(state.day, state.seasonStartDay + EVENT_DAYS[next]);
    state.growthEvent = next;
    if (next === 2) {
      state.phase = 'spring_care';
      return 'Spring growth has begun. Decide on fertilizer.';
    }
    if (next === 4) {
      state.phase = 'harvest';
      return 'Winter wheat is ripe. Rent a combine.';
    }
    return ['Autumn seedlings are established.', 'Winter dormancy. The crop is resting.', '', 'Wheat is flowering.'][next];
  }
  if (state.phase === 'spring_care') {
    state.phase = 'growing';
    state.day = Math.max(state.day, state.seasonStartDay + EVENT_DAYS[3]);
    state.growthEvent = 3;
    return 'Wheat is flowering.';
  }
  if (state.phase === 'harvested') {
    const harvestCount = state.harvestCount;
    const coins = state.coins;
    const tractorOwned = state.tractorOwned;
    const documents = state.documents;
    const introSeen = state.introSeen;
    Object.assign(state, newFarm());
    state.harvestCount = harvestCount;
    state.coins = coins;
    state.tractorOwned = tractorOwned;
    state.documents = documents;
    state.introSeen = introSeen;
    state.day = 365 * harvestCount;
    state.seasonStartDay = state.day;
    return 'A new farm year begins.';
  }
  return null;
}

export function decideFertilizer(state, useIt) {
  if (state.phase !== 'spring_care') return false;
  if (useIt && !spend(state, PRICES.springFertilizer)) return false;
  state.fertilized = useIt;
  state.phase = 'growing';
  return true;
}

export function helpNeighbor(state, id) {
  if (!(id.startsWith('cottage_') || ['bakery', 'cafe', 'pub'].includes(id)) || state.neighborJobs.includes(id)) return false;
  state.neighborJobs.push(id);
  state.coins += 65;
  return true;
}

export function coveragePercent(state) {
  return workPercent(state);
}

export function phaseLabel(state) {
  return ({
    clear: 'CLEAR ACCESS', test: 'TEST SOIL', test_collected: 'SOIL SAMPLE', test_pending: 'SOIL REPORT',
    mow: 'MOW WEEDS', lime: 'SPREAD LIME', cultivate: 'CULTIVATE',
    ready_to_sow: 'SOWING WINDOW', sow: 'SOW WHEAT', growing: 'WINTER WHEAT',
    spring_care: 'SPRING CARE', harvest: 'HARVEST', harvested: 'CROP SOLD',
  })[state.phase] || 'THE FIELD';
}
