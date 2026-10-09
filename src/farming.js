export const FIELD_COLUMNS = 9;
export const FIELD_ROWS = 15;
export const FIELD_CELLS = FIELD_COLUMNS * FIELD_ROWS;
export const COVERAGE_TARGET = Math.ceil(FIELD_CELLS * 0.68);

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
const EVENT_DAYS = [36, 102, 207, 281, 339];
const FIELD_PHASES = new Set(['mow', 'lime', 'cultivate', 'sow', 'harvest']);

export function newFarm() {
  return {
    version: 1,
    day: 0,
    seasonStartDay: 0,
    coins: 2150,
    phase: 'clear',
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
    harvestCount: 0,
    lastYield: 0,
    neighborJobs: [],
    positions: { john: [-64, 105], tractor: [-40, 181, 0], combine: [-55, 183, 0] },
  };
}

export function loadFarm(storage) {
  try {
    const stored = JSON.parse(storage.getItem('farmables-save-v1'));
    if (stored?.version !== 1 || !Array.isArray(stored.coverage) || stored.coverage.length !== FIELD_CELLS) return newFarm();
    if (!Number.isFinite(stored.coins) || !Number.isFinite(stored.day)) return newFarm();
    const farm = { ...newFarm(), ...stored, coverage: stored.coverage.map(Boolean) };
    if (!farm.positions || !['john', 'tractor', 'combine'].every(key =>
      Array.isArray(farm.positions[key]) && farm.positions[key].length >= 2 && farm.positions[key].every(Number.isFinite))) farm.positions = newFarm().positions;
    if (!Array.isArray(farm.neighborJobs)) farm.neighborJobs = [];
    return farm;
  } catch {
    return newFarm();
  }
}

export function saveFarm(state, storage) {
  storage.setItem('farmables-save-v1', JSON.stringify(state));
}

export function dateLabel(day) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(START + day * 86400000));
}

export function spend(state, amount) {
  if (state.coins < amount) return false;
  state.coins -= amount;
  return true;
}

export function clearAccess(state) {
  if (state.phase !== 'clear') return false;
  state.accessCleared++;
  if (state.accessCleared >= 3) state.phase = 'test';
  return true;
}

export function sampleSoil(state) {
  if (state.phase !== 'test' || !spend(state, PRICES.soilTest)) return false;
  state.phase = 'test_pending';
  return true;
}

export function acquireTractor(state, kind) {
  if (state.tractorOwned) return false;
  if (kind === 'buy' && spend(state, PRICES.tractorBuy)) {
    state.tractorOwned = true;
    state.tractorRented = false;
    return true;
  }
  if (kind === 'rent' && !state.tractorRented && spend(state, PRICES.tractorRent)) {
    state.tractorRented = true;
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
    return true;
  }
  if (!state.tractorOwned && !state.tractorRented) return false;
  if (tool === 'lime' && !state.limeBought) return false;
  if (tool === 'sow' && (!state.wheatSeedBought || state.day - state.seasonStartDay < 12 || state.day - state.seasonStartDay > 56)) return false;
  const cost = { mow: PRICES.mower, lime: PRICES.spreader, cultivate: PRICES.cultivator, sow: PRICES.drill }[tool];
  if (!spend(state, cost)) return false;
  state.tool = tool;
  return true;
}

export function workCell(state, index) {
  if (!FIELD_PHASES.has(state.phase) || state.tool !== state.phase || index < 0 || index >= FIELD_CELLS) return { changed: false, completed: false };
  if (state.coverage[index]) return { changed: false, completed: false };
  state.coverage[index] = true;
  const worked = state.coverage.reduce((count, covered) => count + Number(covered), 0);
  if (worked < COVERAGE_TARGET) return { changed: true, completed: false };
  state.coverage.fill(false);
  const previous = state.phase;
  state.tool = null;
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
    state.day = Math.max(state.day + 2, state.seasonStartDay + 2);
    state.phase = 'mow';
    return 'Soil report: pH 5.8. Lime before cultivating.';
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
    Object.assign(state, newFarm());
    state.harvestCount = harvestCount;
    state.coins = coins;
    state.tractorOwned = tractorOwned;
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
  if (!id.startsWith('cottage_') || state.neighborJobs.includes(id)) return false;
  state.neighborJobs.push(id);
  state.coins += 65;
  return true;
}

export function coveragePercent(state) {
  return Math.min(100, Math.round(state.coverage.filter(Boolean).length / COVERAGE_TARGET * 100));
}

export function phaseLabel(state) {
  return ({
    clear: 'CLEAR ACCESS', test: 'TEST SOIL', test_pending: 'SOIL REPORT',
    mow: 'MOW WEEDS', lime: 'SPREAD LIME', cultivate: 'CULTIVATE',
    ready_to_sow: 'SOWING WINDOW', sow: 'SOW WHEAT', growing: 'WINTER WHEAT',
    spring_care: 'SPRING CARE', harvest: 'HARVEST', harvested: 'CROP SOLD',
  })[state.phase] || 'THE FIELD';
}
