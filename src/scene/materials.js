import * as THREE from 'three';

// One colour per catalog system (ids come from data/catalog.json).
export const SYSTEM_COLORS = {
  'battery-system': '#f4d03f',
  body: '#a7b9cc',
  brakes: '#ff5252',
  chassis: '#c08a5b',
  'closures-components': '#2ec4b6',
  electrical: '#ffb020',
  'exterior-fittings': '#b388ff',
  'external-charging-systems': '#c6e85a',
  'front-drive-unit': '#4d7dff',
  'high-voltage-system': '#ff7a2f',
  infotainment: '#00e1ff',
  'instrument-panel': '#ff8fb3',
  'interior-trim': '#d8b48a',
  labels: '#f0f0f0',
  'owner-information': '#d9d39b',
  'rear-drive-unit': '#8a63ff',
  roof: '#9fd8ff',
  'safety-and-restraint': '#ff3d81',
  seats: '#d36ad6',
  steering: '#7dffb8',
  suspension: '#3fd16f',
  'thermal-management': '#3cb4ff',
  'wheels-and-tires': '#7d8794',
};

// Realistic material presets.  `tint` modulates the system colour in the
// colour-coded mode so sub-parts (tyre vs rim, lens vs housing) stay readable.
export const MATS = {
  paint: { color: '#e9ecf0', metalness: 0.35, roughness: 0.32, tint: 1.0 },
  paintDark: { color: '#3a3f46', metalness: 0.4, roughness: 0.4, tint: 0.85 },
  glass: { color: '#5d7a92', metalness: 0.1, roughness: 0.05, opacity: 0.35, tint: 1.25, glass: true },
  tintedGlass: { color: '#26323c', metalness: 0.1, roughness: 0.05, opacity: 0.55, tint: 1.15, glass: true },
  chrome: { color: '#e6e9ee', metalness: 1.0, roughness: 0.16, tint: 1.25 },
  blackPlastic: { color: '#1c1e22', metalness: 0.0, roughness: 0.6, tint: 0.7 },
  greyPlastic: { color: '#55595f', metalness: 0.0, roughness: 0.65, tint: 0.85 },
  rubber: { color: '#121314', metalness: 0.0, roughness: 0.9, tint: 0.45 },
  aluminum: { color: '#b9bfc6', metalness: 0.85, roughness: 0.38, tint: 1.05 },
  steel: { color: '#7c838c', metalness: 0.8, roughness: 0.45, tint: 0.9 },
  darkMetal: { color: '#3d434b', metalness: 0.7, roughness: 0.5, tint: 0.75 },
  ecoat: { color: '#5b636e', metalness: 0.3, roughness: 0.6, tint: 0.9 },
  leather: { color: '#24252a', metalness: 0.0, roughness: 0.7, tint: 0.95 },
  fabric: { color: '#cfc8bd', metalness: 0.0, roughness: 0.95, tint: 1.05 },
  carpet: { color: '#2b2c30', metalness: 0.0, roughness: 1.0, tint: 0.75 },
  hv: { color: '#ff6a00', metalness: 0.0, roughness: 0.55, tint: 1.0 },
  copper: { color: '#c47a3a', metalness: 0.9, roughness: 0.35, tint: 1.0 },
  lensRed: { color: '#b3121f', metalness: 0.1, roughness: 0.15, opacity: 0.85, tint: 1.1 },
  lensAmber: { color: '#ff9a1f', metalness: 0.1, roughness: 0.15, opacity: 0.85, tint: 1.1 },
  lensClear: { color: '#dfe8f0', metalness: 0.2, roughness: 0.05, opacity: 0.6, tint: 1.3 },
  screen: { color: '#0b0e13', metalness: 0.2, roughness: 0.15, emissive: '#18324a', tint: 0.7 },
  foam: { color: '#3a3a3a', metalness: 0.0, roughness: 1.0, tint: 0.8 },
  paper: { color: '#f2f0e8', metalness: 0.0, roughness: 0.9, tint: 1.2 },
  battery: { color: '#2c3036', metalness: 0.5, roughness: 0.5, tint: 1.0 },
  coolant: { color: '#2f8f5b', metalness: 0.0, roughness: 0.5, tint: 1.0 },
  wire: { color: '#2a2a2a', metalness: 0.0, roughness: 0.6, tint: 0.95 },
  carbon: { color: '#202227', metalness: 0.3, roughness: 0.35, tint: 0.8 },
  wood: { color: '#6d4a2c', metalness: 0.0, roughness: 0.5, tint: 1.0 },
};

const _c = new THREE.Color();

export function makeMaterial(matKey, systemId, mode) {
  const preset = MATS[matKey] || MATS.greyPlastic;
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  if (mode === 'system') {
    _c.set(SYSTEM_COLORS[systemId] || '#cccccc');
    const t = preset.tint ?? 1;
    const hsl = {};
    _c.getHSL(hsl);
    _c.setHSL(hsl.h, Math.min(1, hsl.s * (t < 1 ? 0.9 : 1)), Math.min(0.92, hsl.l * t));
    m.color.copy(_c);
    m.metalness = Math.min(preset.metalness, 0.3);
    m.roughness = Math.max(preset.roughness, 0.45);
  } else {
    m.color.set(preset.color);
    m.metalness = preset.metalness;
    m.roughness = preset.roughness;
    if (preset.emissive) m.emissive.set(preset.emissive);
  }
  m.userData.baseOpacity = preset.opacity ?? 1;
  m.userData.glass = !!preset.glass;
  m.userData.baseEmissive = m.emissive.clone();
  m.userData.baseColor = m.color.clone();
  m.opacity = m.userData.baseOpacity;
  m.transparent = m.opacity < 1;
  return m;
}
