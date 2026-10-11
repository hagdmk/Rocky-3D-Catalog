// Assemble every component of the 3D map into one registry.

import { Registry } from './registry.js';
import { buildExterior } from './parts/exterior.js';
import { buildChassis, buildChassisSystems } from './parts/chassis.js';
import { buildStructure } from './parts/structure.js';
import { buildEnergy, buildThermal } from './parts/energy.js';
import { buildInterior } from './parts/interior.js';
import { buildElectrical, buildInfotainment } from './parts/electrical.js';
import { buildClosures } from './parts/closures.js';
import { buildOffVehicle } from './parts/offvehicle.js';

// Large panels that would hide the interior; drawn semi-transparent in X-ray.
const TRIM_IDS = /^(door-trim|pillar-trim|headliner|liftgate-trim|trunk-|cabin-carpet|sound-insulation|parcel-shelf|frunk|underhood-apron|arch-liner|motor-bay-absorber|front-undertray|rear-undertray|dash-panel|rear-quarter-inner|front-inner|sill-|pano-cassette|pano-frame)/;

export function buildScene() {
  const reg = new Registry();
  const builders = [
    buildExterior, buildChassis, buildChassisSystems, buildStructure, buildEnergy, buildThermal,
    buildInterior, buildElectrical, buildInfotainment, buildClosures, buildOffVehicle,
  ];
  for (const build of builders) build(reg);
  for (const it of reg.items) if (TRIM_IDS.test(it.id)) it.trim = true;
  return reg;
}
