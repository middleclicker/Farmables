import * as THREE from 'three';

export function weatherForDay(day) {
  if (day === 0) return { name: 'PARTLY CLOUDY', icon: '◑', cloud: 0.22, rain: 0, fog: 0.0011 };
  let hash = (day + 41713) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  const value = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  if (value < 0.09) return { name: 'RAIN', icon: '☂', cloud: 1, rain: 1, fog: 0.0026 };
  if (value < 0.25) return { name: 'SHOWERS', icon: '☂', cloud: 0.7, rain: 0.55, fog: 0.0019 };
  if (value < 0.47) return { name: 'OVERCAST', icon: '☁', cloud: 0.9, rain: 0, fog: 0.0018 };
  if (value < 0.56) return { name: 'MIST', icon: '≋', cloud: 0.65, rain: 0, fog: 0.0032 };
  if (value < 0.76) return { name: 'PARTLY CLOUDY', icon: '◑', cloud: 0.4, rain: 0, fog: 0.0013 };
  return { name: 'CLEAR', icon: '☀', cloud: 0, rain: 0, fog: 0.0011 };
}

export function advanceClock(farm, delta) {
  farm.timeOfDay += delta / 19;
  if (farm.timeOfDay < 24) return false;
  farm.timeOfDay %= 24;
  farm.day++;
  return true;
}

export function timeLabel(hour) {
  const h = Math.floor(hour) % 24;
  return `${String(h).padStart(2, '0')}:${String(Math.floor((hour - Math.floor(hour)) * 60)).padStart(2, '0')}`;
}

export function createAtmosphere(scene, renderer, sky, sunlight, hemisphere, fillLight) {
  const rainCount = matchMedia('(pointer: coarse)').matches ? 150 : 300;
  const positions = new Float32Array(rainCount * 6);
  const speeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const x = Math.sin(i * 78.233) * 23;
    const z = Math.cos(i * 37.719) * 23;
    const y = (i * 17.47 % 16) + 2;
    const offset = i * 6;
    positions.set([x, y, z, x + 0.22, y - 0.65, z + 0.14], offset);
    speeds[i] = 13 + (i % 7) * 1.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xc7d8df, transparent: true, opacity: 0.42, depthWrite: false,
  }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const dayFog = new THREE.Color(0xb9c8c3);
  const nightFog = new THREE.Color(0x354450);
  const duskFog = new THREE.Color(0xaab3b5);
  const sunDay = new THREE.Color(0xfff2d9);
  const sunEvening = new THREE.Color(0xffba82);
  const moon = new THREE.Color(0xa5b9ce);
  const daySkyFill = new THREE.Color(0xc2d2df);
  const duskSkyFill = new THREE.Color(0xa8b8cd);
  const nightSkyFill = new THREE.Color(0x8399b5);
  const dayGroundFill = new THREE.Color(0x777a70);
  const duskGroundFill = new THREE.Color(0x777174);
  const nightGroundFill = new THREE.Color(0x596879);
  const dayFill = new THREE.Color(0xd5e0e6);
  const duskFoliageTint = new THREE.Color(0xb8bdb3);
  const foliage = new Map();
  const foliageTint = new THREE.Color();
  const sunDirection = new THREE.Vector3();
  const skySunDirection = new THREE.Vector3();
  let lastWeather = '';

  return {
    registerFoliage(material) {
      if (material?.color && !foliage.has(material)) foliage.set(material, material.color.clone());
    },
    update(farm, delta, subject) {
      const weather = weatherForDay(farm.day);
      const changed = weather.name !== lastWeather;
      lastWeather = weather.name;
      const hour = farm.timeOfDay;
      const solarAngle = (hour - 6) / 12 * Math.PI;
      const altitude = Math.sin(solarAngle) * 0.77;
      const daylight = THREE.MathUtils.smoothstep(altitude, -0.16, 0.24);
      const twilight = (1 - THREE.MathUtils.smoothstep(Math.abs(altitude), 0.04, 0.58)) * (1 - weather.cloud * 0.2);
      const lowSun = 1 - THREE.MathUtils.smoothstep(altitude, 0.04, 0.43);
      const direct = daylight * (1 - weather.cloud * 0.4);
      sunDirection.set(Math.cos(solarAngle) * 0.84, altitude, -0.53).normalize();
      skySunDirection.copy(sunDirection);
      skySunDirection.y = THREE.MathUtils.lerp(altitude, Math.max(altitude, 0.015), THREE.MathUtils.smoothstep(altitude, -0.35, -0.13));
      sky.material.uniforms.sunPosition.value.copy(skySunDirection.normalize());
      sunlight.target.position.set(subject.x, subject.y, subject.z);
      sunlight.position.copy(sunDirection).multiplyScalar(170).add(sunlight.target.position);
      sunlight.position.y = Math.max(subject.y + 18, sunlight.position.y);
      sunlight.target.updateMatrixWorld();
      sunlight.color.copy(sunDay).lerp(sunEvening, lowSun * (0.65 + twilight * 0.35)).lerp(moon, 1 - Math.max(daylight, twilight * 0.95));
      sunlight.intensity = 0.17 + direct * 2.5 + twilight * 0.85;
      sunlight.shadow.intensity = 0.43 + daylight * (0.23 - weather.cloud * 0.08);
      hemisphere.intensity = 0.48 + daylight * 0.34 + twilight * 0.65;
      hemisphere.color.copy(daySkyFill).lerp(nightSkyFill, 1 - daylight).lerp(duskSkyFill, twilight * 0.7);
      hemisphere.groundColor.copy(dayGroundFill).lerp(nightGroundFill, 1 - daylight).lerp(duskGroundFill, twilight * 0.7);
      fillLight.color.copy(dayFill).lerp(duskSkyFill, twilight * 0.55);
      fillLight.intensity = 0.17 + twilight * 0.3 + (1 - daylight) * 0.11;
      renderer.toneMappingExposure = 1.25 + (1 - daylight) * 0.18 + twilight * 0.12;
      scene.fog.density = weather.fog * (1.65 + (1 - daylight) * 0.18);
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight * (1 - weather.cloud * 0.16)).lerp(duskFog, twilight * 0.66);
      foliageTint.setRGB(1, 1, 1).lerp(duskFoliageTint, twilight * 0.45);
      for (const [material, original] of foliage) material.color.copy(original).multiply(foliageTint);
      if (changed) {
        sky.material.uniforms.turbidity.value = 2.9 + weather.cloud * 3.6;
        sky.material.uniforms.rayleigh.value = 1.75 - weather.cloud * 0.2;
      }
      rain.visible = weather.rain > 0;
      if (rain.visible) {
        rain.position.set(subject.x, subject.y + 1, subject.z);
        rain.material.opacity = 0.2 + weather.rain * 0.31;
        const attribute = rain.geometry.attributes.position;
        for (let i = 0; i < rainCount; i++) {
          const offset = i * 6;
          const oldY = positions[offset + 1];
          const y = ((oldY - delta * speeds[i] + 16) % 16 + 16) % 16 + 1;
          positions[offset + 1] = y;
          positions[offset + 4] = y - 0.65;
        }
        attribute.needsUpdate = true;
      }
      return weather;
    },
  };
}
