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
  const dayFog = new THREE.Color(0xc4d1c6);
  const nightFog = new THREE.Color(0x334753);
  const sunDay = new THREE.Color(0xfff4e9);
  const sunEvening = new THREE.Color(0xffc18b);
  const moon = new THREE.Color(0xa1b7d3);
  const nightFill = new THREE.Color(0x8ca8c4);
  const duskSkyFill = new THREE.Color(0xffd3a3);
  const duskGroundFill = new THREE.Color(0x927d65);
  const duskFog = new THREE.Color(0xb9a595);
  const dayGroundFill = new THREE.Color(0x777b68);
  const nightGroundFill = new THREE.Color(0x566575);
  const dayFill = new THREE.Color(0xd9e5ef);
  const duskFoliageTint = new THREE.Color(0x898b7e);
  const foliage = new Map();
  const foliageTint = new THREE.Color();
  const sunDirection = new THREE.Vector3();
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
      const altitude = Math.sin(solarAngle);
      const daylight = THREE.MathUtils.smoothstep(altitude, -0.15, 0.25);
      const warmth = 1 - THREE.MathUtils.smoothstep(altitude, 0.1, 0.58);
      const brightness = daylight * (1 - weather.cloud * 0.32);
      const twilight = (1 - THREE.MathUtils.smoothstep(Math.abs(altitude), 0.02, 0.48)) * (1 - weather.cloud * 0.32);
      sunDirection.set(Math.cos(solarAngle) * 0.72, altitude, -0.55).normalize();
      sky.material.uniforms.sunPosition.value.copy(sunDirection);
      sunlight.target.position.set(subject.x, subject.y, subject.z);
      sunlight.position.copy(sunDirection).multiplyScalar(170).add(sunlight.target.position);
      sunlight.position.y = Math.max(subject.y + 24, sunlight.position.y);
      sunlight.target.updateMatrixWorld();
      sunlight.color.copy(sunDay).lerp(sunEvening, warmth * daylight).lerp(moon, 1 - daylight).lerp(sunEvening, twilight * 0.78);
      sunlight.intensity = 0.36 + brightness * 1.9 + twilight * 0.36;
      sunlight.shadow.intensity = 0.44 - weather.cloud * 0.1 + daylight * 0.1;
      hemisphere.intensity = 0.9 + daylight * 0.3 + twilight * 0.33;
      hemisphere.color.set(0xdbe6e9).lerp(nightFill, 1 - daylight).lerp(duskSkyFill, twilight * 0.7);
      hemisphere.groundColor.copy(dayGroundFill).lerp(nightGroundFill, 1 - daylight).lerp(duskGroundFill, twilight * 0.8);
      fillLight.color.copy(dayFill).lerp(duskSkyFill, twilight * 0.65);
      fillLight.intensity = 0.4 + brightness * 0.1 + twilight * 0.22;
      renderer.toneMappingExposure = 1.5 - daylight * 0.26 + twilight * 0.12;
      scene.fog.density = weather.fog * (1 + (1 - daylight) * 0.12);
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight * (1 - weather.cloud * 0.22)).lerp(duskFog, twilight * 0.72);
      foliageTint.setRGB(1, 1, 1).lerp(duskFoliageTint, twilight * 0.9);
      for (const [material, original] of foliage) material.color.copy(original).multiply(foliageTint);
      if (changed) {
        sky.material.uniforms.turbidity.value = 2.4 + weather.cloud * 5.5;
        sky.material.uniforms.rayleigh.value = 2.1 - weather.cloud * 0.35;
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
