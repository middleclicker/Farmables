import * as THREE from 'three';

export function weatherForDay(day) {
  if (day === 0) return { name: 'PARTLY CLOUDY', icon: '◑', cloud: 0.4, rain: 0, fog: 0.0013 };
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
  const dayFog = new THREE.Color(0xb5c5b8);
  const nightFog = new THREE.Color(0x26353b);
  const sunDay = new THREE.Color(0xffecd1);
  const sunEvening = new THREE.Color(0xeaa880);
  const moon = new THREE.Color(0x8295b5);
  const sunDirection = new THREE.Vector3();
  let lastWeather = '';

  return {
    update(farm, delta, subject) {
      const weather = weatherForDay(farm.day);
      const changed = weather.name !== lastWeather;
      lastWeather = weather.name;
      const hour = farm.timeOfDay;
      const solarAngle = (hour - 6) / 12 * Math.PI;
      const altitude = Math.sin(solarAngle);
      const daylight = THREE.MathUtils.smoothstep(altitude, -0.15, 0.25);
      const warmth = 1 - THREE.MathUtils.smoothstep(altitude, 0.1, 0.58);
      const brightness = daylight * (1 - weather.cloud * 0.42);
      sunDirection.set(Math.cos(solarAngle) * 0.72, altitude, -0.55).normalize();
      sky.material.uniforms.sunPosition.value.copy(sunDirection);
      sunlight.position.copy(sunDirection).multiplyScalar(205);
      sunlight.position.y = Math.max(18, sunlight.position.y);
      sunlight.color.copy(sunDay).lerp(sunEvening, warmth * daylight).lerp(moon, 1 - daylight);
      sunlight.intensity = 0.36 + brightness * 1.52;
      hemisphere.intensity = 0.62 + brightness * 0.62;
      fillLight.intensity = 0.16 + brightness * 0.38;
      renderer.toneMappingExposure = 0.76 + brightness * 0.24;
      scene.fog.density = weather.fog * (1 + (1 - daylight) * 0.18);
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight * (1 - weather.cloud * 0.22));
      if (changed) {
        sky.material.uniforms.turbidity.value = 4 + weather.cloud * 8;
        sky.material.uniforms.rayleigh.value = 1.45 - weather.cloud * 0.32;
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
