import * as THREE from 'three';
import { createWorld } from './world.js';
import { createJohn } from './john.js';
import {
  FIELD_COLUMNS, FIELD_ROWS, COVERAGE_TARGET, PRICES, newFarm, loadFarm, saveFarm,
  dateLabel, phaseLabel, coveragePercent, clearAccess, sampleSoil,
  acquireTractor, buySupply, rentTool, workCell, advanceToNextEvent,
  decideFertilizer, helpNeighbor,
} from './farming.js';
import './fonts.css';
import './style.css';

const $ = selector => document.querySelector(selector);
const loading = $('#loading');
const error = $('#error');

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  $('#scene').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, 0.1, 1500);
  const world = createWorld(scene, renderer);
  const john = createJohn(scene);
  const farm = loadFarm(localStorage);
  const restoreVehicle = (group, coordinates) => {
    group.position.set(coordinates[0], world.heightAt(coordinates[0], coordinates[1]), coordinates[1]);
    group.rotation.y = coordinates[2] || 0;
  };
  const onFootCollides = (x, z) => world.collides(x, z) ||
    [world.vehicles.tractor, world.vehicles.combine].some(vehicle => vehicle.group.visible &&
      Math.hypot(x - vehicle.group.position.x, z - vehicle.group.position.z) < (vehicle === world.vehicles.combine ? 3.3 : 2.45));
  restoreVehicle(world.vehicles.tractor.group, farm.positions.tractor);
  restoreVehicle(world.vehicles.combine.group, farm.positions.combine);
  world.fieldVisual.sync(farm);
  world.vehicles.sync(farm);
  john.group.position.set(farm.positions.john[0], world.heightAt(...farm.positions.john), farm.positions.john[1]);
  john.group.rotation.y = -0.08;

  const keys = new Set();
  const panel = $('#panel');
  const options = $('#panel-options');
  const map = $('#minimap');
  const mapContext = map.getContext('2d');
  let panelKind = null;
  let action = null;
  let cameraYaw = -0.08;
  let cameraPitch = 0.32;
  let cameraDistance = 10.5;
  let lastCameraDrag = 0;
  let dragPointer = null;
  let lastPointer = { x: 0, y: 0 };
  let touchMove = { x: 0, y: 0 };
  let joystickPointer = null;
  let elapsed = 0;
  let mapTimer = 0;
  let saveTimer = 0;
  let toastTimer = 0;
  let sprintToggled = false;
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const joystick = $('#joystick');
  const joystickKnob = $('#joystick-knob');

  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 3800);
  }

  function capturePositions() {
    const active = world.vehicles.activeGroup;
    farm.positions.john = active ? [active.position.x + 4, active.position.z] : [john.group.position.x, john.group.position.z];
    for (const kind of ['tractor', 'combine']) {
      const group = world.vehicles[kind].group;
      farm.positions[kind] = [group.position.x, group.position.z, group.rotation.y];
    }
  }

  function persist() {
    capturePositions();
    try { saveFarm(farm, localStorage); } catch (cause) { console.warn('Farm save unavailable', cause); }
  }

  function sync(message = '') {
    if (world.vehicles.driven && ((world.vehicles.driven === 'tractor' && !farm.tractorOwned && !farm.tractorRented) ||
      (world.vehicles.driven === 'combine' && !farm.combineRented))) {
      world.vehicles.exit(john.group.position);
      john.group.visible = true;
    }
    if (!farm.tractorOwned && !farm.tractorRented) restoreVehicle(world.vehicles.tractor.group, [-40, 181, 0]);
    if (!farm.combineRented) restoreVehicle(world.vehicles.combine.group, [-55, 183, 0]);
    world.fieldVisual.sync(farm);
    world.vehicles.sync(farm);
    persist();
    renderHud();
    if (panelKind) renderPanel();
    if (message) toast(message);
  }

  function objective() {
    const tractor = farm.tractorOwned || farm.tractorRented;
    switch (farm.phase) {
      case 'clear': return 'Cut the brambles blocking the field gate.';
      case 'test': return `Take a soil sample at the gate · ◈ ${PRICES.soilTest}`;
      case 'test_pending': return 'Collect the soil report at the farmhouse.';
      case 'mow': return !tractor ? 'Rent or buy a tractor at the shed.' : !farm.tool ? 'Rent a mower at the shed.' : 'Drive the mower through the field.';
      case 'lime': return !farm.limeBought ? 'Buy lime at the shop or shed.' : !farm.tool ? 'Rent a spreader at the shed.' : 'Spread lime across the field.';
      case 'cultivate': return !farm.tool ? 'Rent a cultivator at the shed.' : 'Cultivate the field.';
      case 'ready_to_sow': return 'Visit the farmhouse for September sowing.';
      case 'sow': return !farm.wheatSeedBought ? 'Buy winter wheat seed.' : !farm.tool ? 'Rent a seed drill at the shed.' : 'Drill winter wheat across the field.';
      case 'growing': return 'Visit the farmhouse to advance to the next crop event.';
      case 'spring_care': return 'Choose spring fertilizer at the farmhouse.';
      case 'harvest': return !farm.combineRented ? 'Rent a combine at the shed.' : 'Harvest the ripe winter wheat.';
      case 'harvested': return `Wheat sold · ◈ ${farm.lastYield.toLocaleString()}. Begin another season at home.`;
      default: return '';
    }
  }

  function renderHud() {
    $('#date').textContent = dateLabel(farm.day).toUpperCase();
    $('#coins').textContent = farm.coins.toLocaleString();
    $('#phase').textContent = phaseLabel(farm);
    $('#objective').textContent = objective();
    const fieldWork = ['mow', 'lime', 'cultivate', 'sow', 'harvest'].includes(farm.phase);
    const percent = fieldWork ? coveragePercent(farm) : farm.phase === 'clear' ? farm.accessCleared / 2 * 100 :
      ['growing', 'spring_care'].includes(farm.phase) ? (farm.growthEvent + 1) / 5 * 100 :
      farm.phase === 'harvested' ? 100 : 0;
    $('#progress').textContent = fieldWork ? `${Math.min(COVERAGE_TARGET, farm.coverage.filter(Boolean).length)} / ${COVERAGE_TARGET}` :
      farm.phase === 'clear' ? `${farm.accessCleared} / 2` :
      ['growing', 'spring_care'].includes(farm.phase) ? `${Math.max(0, farm.growthEvent + 1)} / 5` : '';
    $('#progress-fill').style.width = `${percent}%`;
    $('#drive-hud').hidden = !world.vehicles.driven;
    $('#sprint-toggle').hidden = !!world.vehicles.driven;
    $('#vehicle-name').textContent = world.vehicles.driven === 'combine' ? 'COMBINE' : 'TRACTOR';
    $('#drive-progress').textContent = farm.tool ? `${phaseLabel(farm)} · ${coveragePercent(farm)}%` : 'E · EXIT';
  }

  function closePanel() {
    panelKind = null;
    panel.hidden = true;
    keys.clear();
  }

  function addOption(label, detail, fn, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-option';
    button.disabled = disabled;
    const labelNode = document.createElement('strong');
    labelNode.textContent = label;
    const detailNode = document.createElement('span');
    detailNode.textContent = detail;
    button.append(labelNode, detailNode);
    button.addEventListener('click', fn);
    options.appendChild(button);
  }

  function perform(operation, success) {
    if (operation()) sync(success);
    else toast('Not available yet, or you need more coins.');
  }

  function renderPanel() {
    options.replaceChildren();
    const kind = panelKind;
    if (!kind) return;
    $('#panel-kicker').textContent = `${dateLabel(farm.day)} · ◈ ${farm.coins.toLocaleString()}`;
    if (kind === 'farmhouse') {
      $('#panel-title').textContent = 'Farmhouse';
      if (farm.phase === 'spring_care') {
        addOption(`Apply spring fertilizer · ◈ ${PRICES.springFertilizer}`, 'Improves grain yield at harvest.', () => perform(() => decideFertilizer(farm, true), 'Fertilizer applied. Spring growth continues.'), farm.coins < PRICES.springFertilizer);
        addOption('Leave the crop untreated', 'The wheat continues growing with a smaller yield.', () => perform(() => decideFertilizer(farm, false), 'The wheat continues growing.'));
      } else if (['test_pending', 'ready_to_sow', 'growing', 'harvested'].includes(farm.phase)) {
        const label = farm.phase === 'test_pending' ? 'Read soil report' : farm.phase === 'ready_to_sow' ? 'Advance to sowing window' : farm.phase === 'harvested' ? 'Begin next farm year' : 'Advance to next event';
        addOption(label, farm.phase === 'harvested' ? 'Keep your coins and any tractor you bought.' : 'The calendar moves past quiet days.', () => {
          const message = advanceToNextEvent(farm);
          if (message) sync(message);
        });
      } else {
        addOption(phaseLabel(farm), objective(), () => closePanel(), true);
      }
    } else if (kind === 'shed') {
      $('#panel-title').textContent = 'Equipment shed';
      if (!farm.tractorOwned && !farm.tractorRented) {
        addOption(`Rent tractor · ◈ ${PRICES.tractorRent}`, 'Returned after sowing.', () => perform(() => acquireTractor(farm, 'rent'), 'Tractor ready outside.'), farm.coins < PRICES.tractorRent);
        addOption(`Buy tractor · ◈ ${PRICES.tractorBuy}`, 'Yours to keep for later seasons.', () => perform(() => acquireTractor(farm, 'buy'), 'Tractor purchased.'), farm.coins < PRICES.tractorBuy);
      } else if (farm.tractorRented && !farm.tractorOwned) {
        addOption('Tractor rented', 'Available through sowing.', () => {}, true);
      } else {
        addOption('Tractor owned', 'Your tractor is parked outside.', () => {}, true);
      }
      const toolNames = { mow: 'mower', lime: 'lime spreader', cultivate: 'cultivator', sow: 'seed drill', harvest: 'combine' };
      const toolCost = { mow: PRICES.mower, lime: PRICES.spreader, cultivate: PRICES.cultivator, sow: PRICES.drill, harvest: PRICES.combine };
      if (toolNames[farm.phase]) {
        const phase = farm.phase;
        if (phase === 'lime' && !farm.limeBought) addOption(`Buy lime · ◈ ${PRICES.lime}`, 'For acidic soil.', () => perform(() => buySupply(farm, 'lime'), 'Lime delivered.'), farm.coins < PRICES.lime);
        if (phase === 'sow' && !farm.wheatSeedBought) addOption(`Buy winter wheat seed · ◈ ${PRICES.wheatSeed}`, 'Ready for the drill.', () => perform(() => buySupply(farm, 'wheatSeed'), 'Winter wheat seed delivered.'), farm.coins < PRICES.wheatSeed);
        if (farm.tool === phase) addOption(`${toolNames[phase][0].toUpperCase()}${toolNames[phase].slice(1)} attached`, 'Drive across the field to work it.', () => closePanel());
        else addOption(`Rent ${toolNames[phase]} · ◈ ${toolCost[phase]}`, phase === 'harvest' ? 'Combine parked outside.' : 'Attached to the tractor outside.', () => perform(() => rentTool(farm, phase), `${toolNames[phase]} ready outside.`),
          farm.coins < toolCost[phase] || (phase !== 'harvest' && !farm.tractorOwned && !farm.tractorRented) || (phase === 'lime' && !farm.limeBought) || (phase === 'sow' && !farm.wheatSeedBought));
      }
    } else if (kind === 'shop') {
      $('#panel-title').textContent = 'Village supplies';
      addOption(farm.limeBought ? 'Lime purchased' : `Buy lime · ◈ ${PRICES.lime}`, 'Ground limestone for the field.', () => perform(() => buySupply(farm, 'lime'), 'Lime purchased.'), farm.limeBought || farm.coins < PRICES.lime);
      addOption(farm.wheatSeedBought ? 'Winter wheat purchased' : `Buy winter wheat seed · ◈ ${PRICES.wheatSeed}`, 'Seed for September drilling.', () => perform(() => buySupply(farm, 'wheatSeed'), 'Winter wheat seed purchased.'), farm.wheatSeedBought || farm.coins < PRICES.wheatSeed);
    } else if (kind === 'reset') {
      $('#panel-title').textContent = 'Start a new farm?';
      addOption('Start again', 'Current local progress will be replaced.', () => {
        if (world.vehicles.driven) world.vehicles.exit(john.group.position);
        john.group.visible = true;
        Object.assign(farm, newFarm());
        john.group.position.set(-64, world.heightAt(-64, 105), 105);
        restoreVehicle(world.vehicles.tractor.group, farm.positions.tractor);
        restoreVehicle(world.vehicles.combine.group, farm.positions.combine);
        closePanel();
        sync('A new farm begins.');
      });
      addOption('Keep playing', 'Return to the farm.', closePanel);
    } else {
      $('#panel-title').textContent = 'Village cottage';
      const completed = farm.neighborJobs?.includes(kind);
      addOption(completed ? 'Garden work complete' : 'Help with the garden · +◈ 65', 'A small local job while the farm develops.', () => perform(() => helpNeighbor(farm, kind), 'Garden work complete · +◈ 65.'), completed);
    }
  }

  function openPanel(kind) {
    panelKind = kind;
    panel.hidden = false;
    keys.clear();
    renderPanel();
  }

  function nearbyAction() {
    if (world.vehicles.driven) return { label: 'Exit vehicle', run: () => {
      world.vehicles.exit(john.group.position);
      john.group.visible = true;
      renderHud();
    } };
    const player = john.group.position;
    if (Math.hypot(player.x + 55, player.z - 105) < 10) {
      if (farm.phase === 'clear') return { label: 'Cut brambles', run: () => perform(() => clearAccess(farm), farm.accessCleared === 1 ? 'Gate cleared. Soil is accessible.' : 'One patch cleared.') };
      if (farm.phase === 'test') return { label: `Test soil · ◈ ${PRICES.soilTest}`, run: () => perform(() => sampleSoil(farm), 'Soil sample sent. Check the farmhouse report.') };
    }
    const vehicle = world.vehicles.near(player);
    if (vehicle) return { label: vehicle === world.vehicles.tractor ? 'Drive tractor' : 'Drive combine', run: () => {
      if (world.vehicles.enter(player)) {
        john.group.visible = false;
        renderHud();
      }
    } };
    const building = world.buildings.list.find(item =>
      Math.hypot(player.x - item.door.x, player.z - item.door.z) < 7 ||
      (item.contains(player.x, player.z) && Math.hypot(player.x - item.interact.x, player.z - item.interact.z) < 8));
    if (building) {
      const label = building.id === 'farmhouse' ? 'Farm calendar' : building.id === 'shed' ? 'Equipment shed' : building.id === 'shop' ? 'Village supplies' : 'Visit cottage';
      return { label, run: () => openPanel(building.id) };
    }
    return null;
  }

  function useAction() {
    if (panelKind) { closePanel(); return; }
    nearbyAction()?.run();
  }

  function toggleSprint() {
    sprintToggled = !sprintToggled;
    const button = $('#sprint-toggle');
    button.setAttribute('aria-pressed', String(sprintToggled));
    button.textContent = sprintToggled ? 'SPRINT' : 'WALK';
  }

  window.addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (event.repeat) return;
    if (event.code === 'KeyC') toggleSprint();
    if (event.code === 'KeyE') useAction();
    if (event.code === 'Escape') { closePanel(); $('#help').hidden = true; }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('pagehide', persist);
  $('#interact').addEventListener('click', useAction);
  $('#panel-close').addEventListener('click', closePanel);
  $('#help-toggle').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });
  $('#sprint-toggle').addEventListener('click', toggleSprint);
  $('#reset-farm').addEventListener('click', () => { $('#help').hidden = true; openPanel('reset'); });
  $('#fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  renderer.domElement.addEventListener('pointerdown', event => {
    dragPointer = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer) return;
    cameraYaw -= (event.clientX - lastPointer.x) * 0.0045;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - lastPointer.y) * 0.003, 0.17, 1.02);
    lastPointer = { x: event.clientX, y: event.clientY };
    lastCameraDrag = performance.now();
  });
  const endDrag = event => { if (event.pointerId === dragPointer) dragPointer = null; };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);
  renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.012, 4.5, 18);
  }, { passive: false });

  function moveKnob(event) {
    const rect = joystick.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.max(1, Math.hypot(dx, dy));
    const radius = Math.min(36, length);
    const x = dx / length * radius, y = dy / length * radius;
    joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
    touchMove = { x: x / 36, y: -y / 36 };
  }
  joystick.addEventListener('pointerdown', event => {
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveKnob(event);
  });
  joystick.addEventListener('pointermove', event => { if (event.pointerId === joystickPointer) moveKnob(event); });
  const endJoystick = event => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    touchMove = { x: 0, y: 0 };
    joystickKnob.style.transform = '';
  };
  joystick.addEventListener('pointerup', endJoystick);
  joystick.addEventListener('pointercancel', endJoystick);
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function workField(vehicle) {
    if (!farm.tool || farm.tool !== farm.phase || Math.abs(vehicle.speed) < 1.5) return;
    if ((farm.phase === 'harvest') !== (vehicle.kind === 'combine')) return;
    const { minX, maxX, minZ, maxZ } = world.field;
    const width = (maxX - minX) / FIELD_COLUMNS;
    const depth = (maxZ - minZ) / FIELD_ROWS;
    let changed = false;
    let completion = null;
    for (let row = 0; row < FIELD_ROWS && !completion; row++) {
      for (let column = 0; column < FIELD_COLUMNS; column++) {
        const x = minX + (column + 0.5) * width;
        const z = minZ + (row + 0.5) * depth;
        if (Math.abs(x - vehicle.x) > 23 || Math.abs(z - vehicle.z) > 16) continue;
        const outcome = workCell(farm, row * FIELD_COLUMNS + column);
        changed ||= outcome.changed;
        if (outcome.completed) { completion = outcome; break; }
      }
    }
    if (completion) {
      const messages = {
        mow: 'Weeds mown. The soil needs lime.',
        lime: 'Lime spread. Cultivate the field next.',
        cultivate: 'Seedbed ready. Wait for September sowing.',
        sow: 'Winter wheat sown. Watch the calendar.',
        harvest: `Harvest sold · +◈ ${farm.lastYield.toLocaleString()}.`,
      };
      sync(messages[completion.previous]);
    } else if (changed) sync();
  }

  function drawMap(subject) {
    const context = mapContext;
    const scale = 180 / 310;
    const px = x => 90 + (x - subject.x) * scale;
    const pz = z => 90 + (z - subject.z) * scale;
    context.clearRect(0, 0, 180, 180);
    context.fillStyle = '#1b3025'; context.fillRect(0, 0, 180, 180);
    const { minX, maxX, minZ, maxZ } = world.field;
    const cellWidth = (maxX - minX) / FIELD_COLUMNS;
    const cellDepth = (maxZ - minZ) / FIELD_ROWS;
    const colors = {
      overgrown: '#526c3d', mown: '#8b945a', limed: '#b5b296', cultivated: '#6c5742',
      seeded: '#645344', growing: '#78914d', ripe: '#c6a85b', harvested: '#987a50',
    };
    const stage = farm.phase;
    for (let row = 0; row < FIELD_ROWS; row++) for (let column = 0; column < FIELD_COLUMNS; column++) {
      const index = row * FIELD_COLUMNS + column;
      const worked = !!farm.coverage[index];
      let surface = 'overgrown';
      if (stage === 'mow') surface = worked ? 'mown' : 'overgrown';
      else if (stage === 'lime') surface = worked ? 'limed' : 'mown';
      else if (stage === 'cultivate') surface = worked ? 'cultivated' : 'limed';
      else if (stage === 'ready_to_sow') surface = 'cultivated';
      else if (stage === 'sow') surface = worked ? 'seeded' : 'cultivated';
      else if (stage === 'growing' || stage === 'spring_care') surface = farm.growthEvent >= 3 ? 'ripe' : 'growing';
      else if (stage === 'harvest') surface = worked ? 'harvested' : 'ripe';
      else if (stage === 'harvested') surface = 'harvested';
      const x = px(minX + column * cellWidth), z = pz(minZ + row * cellDepth);
      const w = cellWidth * scale + 0.4, d = cellDepth * scale + 0.4;
      context.fillStyle = colors[surface];
      context.fillRect(x, z, w, d);
      if (surface === 'overgrown') {
        context.fillStyle = '#a1a77070';
        context.fillRect(x + (index % 3) * 2 + 2, z + (index % 4) * 2 + 2, 2, 2);
      } else if (surface === 'cultivated' || surface === 'seeded' || surface === 'harvested') {
        context.strokeStyle = surface === 'seeded' ? '#b99d7280' : '#312b2055';
        context.lineWidth = 0.6;
        for (let offset = 2; offset < w; offset += 3) {
          context.beginPath(); context.moveTo(x + offset, z); context.lineTo(x + offset, z + d); context.stroke();
        }
      }
    }
    if (['clear', 'test', 'test_pending', 'mow'].includes(stage)) {
      for (let patch = 0; patch < farm.accessCleared; patch++) {
        context.fillStyle = '#c7ba7b';
        context.fillRect(px(minX + 0.3), pz(102 + patch * 2), 3.3, 2.5);
      }
    }
    context.strokeStyle = '#d9d7b38c'; context.lineWidth = 2;
    context.strokeRect(px(minX), pz(minZ), (maxX - minX) * scale, (maxZ - minZ) * scale);
    context.beginPath();
    for (let z = -500; z <= 500; z += 18) {
      const x = px(world.roadX(z)), y = pz(z);
      if (z === -500) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = '#8c9183'; context.lineWidth = 6; context.stroke();
    for (const building of world.buildings.list) {
      context.fillStyle = building.id === 'farmhouse' ? '#e7c881' : building.id === 'shed' ? '#b8b0a0' : '#d3c7a7';
      context.fillRect(px(building.x) - 2.5, pz(building.z) - 2.5, 5, 5);
    }
    for (const vehicle of [world.vehicles.tractor, world.vehicles.combine]) {
      if (!vehicle.group.visible) continue;
      context.fillStyle = '#d8bc69';
      context.beginPath(); context.arc(px(vehicle.group.position.x), pz(vehicle.group.position.z), 3.5, 0, Math.PI * 2); context.fill();
    }
    const destination = ['clear', 'test'].includes(farm.phase) ? { x: -55, z: 105 } :
      ['test_pending', 'ready_to_sow', 'growing', 'spring_care', 'harvested'].includes(farm.phase) ? { x: 38, z: 201 } :
      !farm.tool ? { x: -41, z: 198 } : { x: 30, z: 20 };
    const markerX = THREE.MathUtils.clamp(px(destination.x), 9, 171);
    const markerY = THREE.MathUtils.clamp(pz(destination.z), 9, 171);
    context.strokeStyle = '#f5d777'; context.lineWidth = 2.5;
    context.beginPath(); context.arc(markerX, markerY, 6, 0, Math.PI * 2); context.stroke();
    if (['clear', 'test', 'test_pending'].includes(farm.phase) && farm.accessCleared > 0) {
      context.strokeStyle = '#bfe0a3'; context.lineWidth = 2.5;
      context.beginPath(); context.arc(markerX, markerY, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * farm.accessCleared); context.stroke();
    }
    context.save(); context.translate(90, 90);
    context.rotate(world.vehicles.driven ? world.vehicles.activeGroup.rotation.y : john.group.rotation.y);
    context.fillStyle = '#fff3c6'; context.beginPath(); context.moveTo(0, -7); context.lineTo(5, 5); context.lineTo(-5, 5); context.closePath(); context.fill();
    context.restore();
  }

  function frame() {
    requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + touchMove.y;
    const rightInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + touchMove.x;
    let subject = john.group.position;
    let subjectHeight = 1.58;
    let distance = cameraDistance;
    if (world.vehicles.driven) {
      const vehicle = world.vehicles.update(delta, { forward: panelKind ? 0 : THREE.MathUtils.clamp(forwardInput, -1, 1), right: panelKind ? 0 : THREE.MathUtils.clamp(rightInput, -1, 1) }, world.collides);
      workField(vehicle);
      if (world.vehicles.driven && vehicle) {
        subject = world.vehicles.activeGroup.position;
        subjectHeight = vehicle.kind === 'combine' ? 3.1 : 2.1;
        distance = Math.max(cameraDistance, vehicle.kind === 'combine' ? 16 : 13);
        $('#vehicle-speed').textContent = `${Math.round(Math.abs(vehicle.speed) * 3.6)} km/h`;
        if (performance.now() - lastCameraDrag > 2600) {
          let difference = vehicle.heading - cameraYaw;
          difference = Math.atan2(Math.sin(difference), Math.cos(difference));
          cameraYaw += difference * Math.min(1, delta * 1.4);
        }
      }
      john.update(elapsed, 0);
    } else {
      const length = Math.hypot(forwardInput, rightInput);
      const moving = !panelKind && length > 0.05;
      const speed = sprintToggled || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.9 : 2.7;
      if (moving) {
        const forward = forwardInput / Math.max(1, length);
        const right = rightInput / Math.max(1, length);
        const dx = (-Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * right) * speed * delta;
        const dz = (-Math.cos(cameraYaw) * forward - Math.sin(cameraYaw) * right) * speed * delta;
        const nextX = THREE.MathUtils.clamp(john.group.position.x + dx, -475, 475);
        const nextZ = THREE.MathUtils.clamp(john.group.position.z + dz, -475, 475);
        if (!onFootCollides(nextX, john.group.position.z)) john.group.position.x = nextX;
        if (!onFootCollides(john.group.position.x, nextZ)) john.group.position.z = nextZ;
        const direction = Math.atan2(-dx, -dz);
        let difference = direction - john.group.rotation.y;
        difference = Math.atan2(Math.sin(difference), Math.cos(difference));
        john.group.rotation.y += difference * Math.min(1, delta * 12);
      }
      john.group.position.y = world.heightAt(john.group.position.x, john.group.position.z);
      john.update(elapsed, moving ? speed : 0);
      const inside = world.buildings.inside(john.group.position);
      if (inside) distance = Math.min(distance, 6.5);
      if (!moving && !inside && performance.now() - lastCameraDrag > 2500) {
        const doorway = world.buildings.list.find(item => Math.hypot(subject.x - item.door.x, subject.z - item.door.z) < 12);
        if (doorway) {
          const outward = doorway.door.z < doorway.z ? Math.PI : 0;
          const turn = Math.atan2(Math.sin(outward - cameraYaw), Math.cos(outward - cameraYaw));
          cameraYaw += turn * Math.min(1, delta * 2.2);
        }
      }
    }
    world.buildings.update(subject);
    target.lerp(desired.set(subject.x, subject.y + subjectHeight, subject.z), 1 - Math.exp(-delta * 7));
    const horizontal = distance * Math.cos(cameraPitch);
    desired.set(target.x + Math.sin(cameraYaw) * horizontal, target.y + distance * Math.sin(cameraPitch), target.z + Math.cos(cameraYaw) * horizontal);
    desired.y = Math.max(desired.y, world.heightAt(desired.x, desired.z) + 1.35);
    const cameraFraction = world.buildings.cameraFraction(target, desired);
    if (cameraFraction < 1) {
      desired.lerpVectors(target, desired, cameraFraction);
      camera.position.copy(desired);
    } else camera.position.lerp(desired, 1 - Math.exp(-delta * 8));
    camera.lookAt(target);
    renderer.render(scene, camera);

    const nextAction = panelKind ? null : nearbyAction();
    if (nextAction?.label !== action?.label) {
      action = nextAction;
      $('#interact').hidden = !action;
      if (action) $('#interact-text').textContent = action.label;
    } else action = nextAction;
    mapTimer += delta;
    if (mapTimer > 0.1) { mapTimer = 0; drawMap(subject); }
    saveTimer += delta;
    if (saveTimer > 3) { saveTimer = 0; persist(); }
  }

  renderHud();
  const clock = new THREE.Clock();
  frame();
  john.ready.then(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
  });
} catch (cause) {
  console.error('Farmables could not start', cause);
  loading.remove();
  error.hidden = false;
  error.textContent = 'Farmables needs a browser with WebGL support. Try a current version of Chrome, Edge, Firefox, or Safari.';
}
