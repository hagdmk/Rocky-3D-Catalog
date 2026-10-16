// HV battery, high-voltage system and thermal management.

import {
  X_FRONT_AXLE as XF, X_REAR_AXLE as XR, WHEEL_Y as WY,
} from '../profile.js';
import {
  group, named, rbox, box, cyl, beam, bar, tube, pipe, quadPlate, extrude,
} from '../geom.js';

// x0: the pack ends behind the front wheel-arch liners; x1: at the front cross member of the rear subframe (shear
// plates).  Its outboard rear corners (|z| > zc) stop at xc, ahead of the rear wheel-arch liners and the rear rail
// closeouts.  z leaves a channel along each sill for the rocker coolant hoses and the HV cable to the front.
export const PACK = { x0: 1.08, x1: -1.04, xc: -1.005, zc: 0.63, y0: 0.158, y1: 0.285, z: 0.715 };

export function buildEnergy(reg) {
  // --- HV battery -----------------------------------------------------------------
  const px = (PACK.x0 + PACK.x1) / 2;
  const pxc = (PACK.x0 + PACK.xc) / 2;
  const py = (PACK.y0 + PACK.y1) / 2;
  const ph = PACK.y1 - PACK.y0;
  reg.add({
    id: 'hv-battery', ko: '고전압 배터리 팩', en: 'High-voltage battery pack',
    groups: ['high-voltage-battery-assembly'], match: /HV BATT|BATTERY|COVER|BLANKET|SEAL|SCR|BOLT|RETROFIT|FUSE/,
    object: group(
      rbox([PACK.x0 - PACK.x1, ph, PACK.zc * 2], [px, py, 0], 'battery', { r: 0.02 }),
      ...[-1, 1].map((sg) => rbox([PACK.x0 - PACK.xc, ph, PACK.z - PACK.zc + 0.02], [pxc, py, (sg * (PACK.z + PACK.zc - 0.02)) / 2], 'battery', { r: 0.02 })),
      // rear hump under the 2nd-row seat (x -1.02..-0.71), between the rear rails, behind the rear edge of the floor pan
      rbox([0.31, 0.1, 0.96], [-0.865, PACK.y1 + 0.04, 0], 'battery', { r: 0.02 }),
      ...[0.9, 0.5, 0.1, -0.3, -0.7].map((x) => box([0.006, 0.004, PACK.z * 1.9], [x, PACK.y1 + 0.002, 0], 'darkMetal')),
    ),
  });
  for (const [sd, sg, ko, en] of [['L', -1, '좌', 'LH'], ['R', 1, '우', 'RH']]) {
    reg.add({
      id: `battery-side-ski-${sd}`, ko: `배터리 사이드 스키(레일) (${ko})`, en: `Battery side ski rail ${en}`, tags: sd,
      groups: ['high-voltage-battery-assembly'], match: /SKI|SIDE RAIL|PLUG,SIDE|VENT COVER|VENTCOVER|RIVNUT/,
      object: bar([PACK.x0 - 0.04, 0.2, sg * (PACK.z + 0.03)], [PACK.x1 + 0.04, 0.2, sg * (PACK.z + 0.03)], 0.04, 0.07, 'aluminum'),
    });
  }
  reg.add({
    id: 'labels-hv-battery', ko: '고전압 배터리 라벨', en: 'HV battery labels',
    groups: ['labels-hv-battery'],
    object: group(
      box([0.12, 0.002, 0.08], [0.95, PACK.y1 + 0.004, -0.35], 'paper'),
      box([0.08, 0.002, 0.06], [0.95, PACK.y1 + 0.004, 0.35], 'paper'),
    ),
  });

  // --- Charging & HV distribution (rear, under the 2nd-row seat) -------------------------
  // on the pack hump, below the seat cushion
  const cy = 0.41;
  reg.add({
    id: 'rear-hvjb', ko: '리어 고전압 정션박스 (HVJB)', en: 'Rear HV junction box (HVJB)',
    groups: ['onboard-charger', 'high-voltage-cables-1st-generation', 'high-voltage-cables-2nd-generation'],
    match: /HVJB|JNCTN|JUNCTION|LID|BLOCK OFF|INSULATOR,LID|RELAY BOX/,
    object: rbox([0.24, 0.08, 0.22], [-0.89, cy + 0.005, 0], 'aluminum', { r: 0.015 }),
  });
  reg.add({
    id: 'charger-master', ko: '온보드 충전기 - 마스터', en: 'Onboard charger (master)', tags: 'L',
    groups: ['onboard-charger'], match: /CHRGR|(?<!SLAVE )CHARGER|MASTER|MSTR|MAST ER|GROUND STRAP|UPGRD/,
    object: group(
      rbox([0.34, 0.07, 0.33], [-0.89, cy, -0.305], 'aluminum', { r: 0.015 }),
      box([0.2, 0.004, 0.14], [-0.89, cy + 0.036, -0.305], 'darkMetal'),
    ),
  });
  reg.add({
    id: 'charger-slave', ko: '온보드 충전기 - 슬레이브(옵션)', en: 'Onboard charger (slave, optional)', tags: 'R',
    groups: ['onboard-charger'], match: /CHRGR|SLAVE|SLV|DUAL CHG|UPGRD|GROUND STRAP/,
    object: group(
      rbox([0.34, 0.07, 0.33], [-0.89, cy, 0.305], 'aluminum', { r: 0.015 }),
      box([0.2, 0.004, 0.14], [-0.89, cy + 0.036, 0.305], 'darkMetal'),
    ),
  });
  reg.add({
    id: 'charge-port-inlet', ko: '충전 인렛(차지 포트 어셈블리)', en: 'Charge port inlet assembly', tags: 'LB',
    groups: ['charge-port'], match: /CHARGE ?PORT|INLET|LATCH|SEAL|SHIM|GASKET|TRIM|COVER|LUG|FERRITE|CABLE TIE|TAPE|SCR|BLT|DRAIN|ELBOW|PLUG/,
    object: group(
      rbox([0.1, 0.11, 0.09], [-2.07, 0.83, -0.82], 'blackPlastic', { r: 0.015 }),
      cyl(0.03, 0.05, 'z', [-2.07, 0.83, -0.88], 'darkMetal'),
    ),
  });
  const hvGroups = ['high-voltage-cables-1st-generation', 'high-voltage-cables-2nd-generation'];
  reg.add({
    id: 'hv-cable-battery', ko: '고전압 케이블: 배터리 → HVJB', en: 'HV cable: battery to HVJB',
    groups: hvGroups, match: /HVBAT TO|HVBAT,|HVBAT TO HVJB|TERM|BAND,SHIELD|SEAL,RSNBRGR/,
    object: group(
      named('cableA', pipe([[-1, 0.33, -0.02], [-1.04, 0.35, -0.02], [-1.045, 0.4, -0.02], [-0.99, 0.415, -0.02]], 0.016, 'hv')),
      named('cableB', pipe([[-1, 0.33, 0.03], [-1.04, 0.35, 0.03], [-1.045, 0.4, 0.03], [-0.99, 0.415, 0.03]], 0.016, 'hv')),
    ),
  });
  reg.add({
    id: 'hv-cable-chargeport', ko: '고전압 케이블: HVJB → 충전 포트', en: 'HV cable: HVJB to charge port',
    groups: hvGroups, match: /CHRG PORT|CP|CHARGE|INLET|DATA-GND/,
    // from the master charger, under the trunk floor, up to the inlet in the LH quarter
    object: named('cable', pipe([[-1.04, 0.41, -0.42], [-1.19, 0.43, -0.44], [-1.22, 0.46, -0.47], [-1.29, 0.48, -0.47], [-1.37, 0.5, -0.49], [-1.41, 0.52, -0.52], [-1.44, 0.53, -0.53], [-1.57, 0.53, -0.53], [-1.8, 0.59, -0.58], [-2.05, 0.83, -0.81]], 0.014, 'hv')),
  });
  reg.add({
    id: 'hv-cable-inverter', ko: '고전압 케이블: HVJB → 리어 인버터', en: 'HV cable: HVJB to rear drive inverter',
    groups: hvGroups, match: /DRV INV|RR SDU|REAR HVJB TO SDU|INVERTER/,
    object: named('cable', pipe([[-0.99, 0.415, -0.075], [-1.17, 0.4, -0.2], [-1.245, 0.4, -0.2]], 0.016, 'hv')),
  });
  reg.add({
    id: 'hv-cable-front', ko: '고전압 케이블: HVJB → 프론트(DC-DC/FJB, 사이드 실 경유)', en: 'HV cable: HVJB to front (DC-DC / FJB, along sill)',
    groups: hvGroups, match: /DC\/DC|DCDC|FJB|FRONT SILL|HVIL ONLY/,
    // along the RH sill, beside the battery pack, to the DC-DC converter, with a branch to the front junction box
    object: group(
      named('cable', pipe([[-0.79, 0.415, 0.08], [-0.76, 0.465, 0.135], [-0.76, 0.465, 0.52], [-0.735, 0.3, 0.725], [-0.735, 0.272, 0.745], [1.04, 0.272, 0.745], [1.1, 0.272, 0.745], [1.1, 0.275, 0.6], [1.38, 0.48, 0.58], [1.4, 0.5, 0.56], [1.645, 0.52, 0.5]], 0.013, 'hv')),
      named('toFjb', pipe([[1.7, 0.5, 0.46], [1.65, 0.45, 0.36], [1.65, 0.44, 0.24]], 0.013, 'hv')),
    ),
  });
  reg.add({
    id: 'hv-cable-front-du', ko: '고전압 케이블: FJB → 프론트 구동 유닛', en: 'HV cable: FJB to front drive unit',
    groups: ['high-voltage-cables-2nd-generation'], variant: { drive: ['dm', 'pdm'] }, match: /FR SDU|FUSED|INLINE/,
    // out of the front face of the FJB, across in front of the gearbox, back to the inverter connector on its front face
    object: named('cable', pipe([[1.685, 0.43, 0.17], [1.69, 0.41, 0.14], [1.71, 0.39, 0.09], [1.71, 0.39, -0.1], [1.7, 0.4, -0.11], [1.55, 0.43, -0.12]], 0.014, 'hv')),
  });

  // --- DC-DC converter and front junction box (front right, under the frunk) --------------
  reg.add({
    id: 'dc-dc-converter', ko: 'DC-DC 컨버터', en: 'DC-DC converter',
    groups: ['dc-dc-converter-1st-generation', 'dc-dc-converter-2nd-generation'],
    match: /DC-DC|DCDC|WASHER|NUT|SCR|SCREW|COVER|HEADER|CLIP|BRKT|STRAP|WSHR|BOLT|BLT/,
    // on top of the RH front rail, ahead of the shock tower
    object: group(
      named('case', rbox([0.3, 0.09, 0.135], [1.78, 0.535, 0.5175], 'aluminum', { r: 0.015 })),
      ...[0, 1, 2, 3, 4].map((i) => box([0.004, 0.02, 0.125], [1.66 + i * 0.06, 0.59, 0.5175], 'aluminum')),
    ),
  });
  reg.add({
    id: 'front-junction-box', ko: '프론트 정션박스 (FJB, 2세대)', en: 'Front HV junction box (FJB, gen 2)',
    groups: ['dc-dc-converter-2nd-generation', 'high-voltage-cables-2nd-generation'], match: /FRONT JUNCTION|FJB|LID ASSY_FRNT|FUSE,|20A HV/,
    object: rbox([0.14, 0.07, 0.16], [1.62, 0.435, 0.17], 'blackPlastic', { r: 0.012 }), // bolted to the side of the front drive unit
  });
  reg.add({
    id: 'dcdc-12v-cable', ko: '12V 케이블: DC-DC → 12V 배터리', en: '12 V cable: DC-DC to 12 V battery',
    groups: ['dc-dc-converter-1st-generation', 'dc-dc-converter-2nd-generation'], match: /CABLE|CBL|POSITIVE|BATT/,
    object: named('cable', pipe([[1.66, 0.55, 0.47], [1.62, 0.51, 0.47], [1.61, 0.5, 0.46], [1.57, 0.5, 0.42], [1.53, 0.46, 0.38], [1.5, 0.47, 0.35], [1.47, 0.5, 0.32], [1.18, 0.5, 0.09], [1.12, 0.57, 0.02], [1.12, 0.62, -0.02]], 0.009, 'wire')),
  });
}

export function buildThermal(reg) {
  // --- Front-end cooling module -------------------------------------------------
  // Between the front rails (inner faces at z +-0.44) behind the bumper beam: the condenser core in front, the
  // radiator behind it and the two condenser fan shrouds at the back.  The radiator is narrower than the
  // condenser so the A/C lines reach the condenser's LH end tank past the radiator side tank.
  const tilt = (x, yb, yt, z, lean = 0.05) => [[x, yb, -z], [x, yb, z], [x - lean, yt, z], [x - lean, yt, -z]];
  reg.add({
    id: 'ac-condenser', ko: '에어컨 콘덴서·팬 모듈', en: 'A/C condenser & fan module',
    groups: ['air-conditioning-condenser'],
    object: group(
      named('core', quadPlate(tilt(2.245, 0.24, 0.56, 0.43), 0.02, 'aluminum')),
      // fan shrouds (#5/#6): their lower isolators (#7) sit on the condenser brackets (#8) of the bumper carrier
      cyl(0.15, 0.04, 'x', [2.125, 0.4, -0.235], 'blackPlastic', { seg: 28 }),
      cyl(0.15, 0.04, 'x', [2.125, 0.4, 0.235], 'blackPlastic', { seg: 28 }),
      rbox([0.04, 0.06, 0.08], [2.085, 0.31, 0.3], 'blackPlastic', { r: 0.008 }), // fan PWM controller (#10) on the RH shroud
    ),
  });
  reg.add({
    id: 'radiator', ko: '라디에이터 (파워트레인)', en: 'Radiator (powertrain)',
    groups: ['radiator', 'motor-cooling-rwd', 'motor-cooling-dual-motor-large-rear-drive-unit', 'motor-cooling-dual-motor-small-rear-drive-unit'],
    match: /RADIATOR|ISOLATOR - RAD|AMBIENT|RAD ASSY/,
    object: quadPlate(tilt(2.205, 0.25, 0.55, 0.385), 0.03, 'aluminum'),
  });
  // FRONT END FRONT DUCTING (#1): seals the grille opening below the bumper beam to the condenser face, between
  // the rails; the lower panel lies behind the ankle catcher (the radar structure bracket is screwed to it),
  // the upper panel behind the beam
  reg.add({
    id: 'cooling-duct', ko: '프론트 엔드 냉각 덕트', en: 'Front-end cooling air ducting',
    groups: ['cooling-system-air-ducting'], match: /DUCTING|RADAR|BRKT|CLIP|BLT|SCREW|ASY, ACTIVE|SENSOR|AMBIENT/,
    object: group(
      named('lower', group(
        quadPlate([[2.316, 0.252, -0.26], [2.316, 0.252, 0.26], [2.256, 0.247, 0.26], [2.256, 0.247, -0.26]], 0.006, 'blackPlastic'),
        ...[-1, 1].map((sg) => quadPlate([[2.28, 0.252, sg * 0.26], [2.28, 0.252, sg * 0.43], [2.256, 0.247, sg * 0.43], [2.256, 0.247, sg * 0.26]], 0.006, 'blackPlastic')),
      )),
      named('upper', quadPlate([[2.3, 0.535, -0.43], [2.3, 0.535, 0.43], [2.206, 0.562, 0.43], [2.206, 0.562, -0.43]], 0.006, 'blackPlastic')),
    ),
  });
  // one sensor, listed with the air ducting (#11) and with the radiator (#2): clipped under the lower front
  // ducting panel, behind the lower grille
  reg.add({
    id: 'ambient-temp-sensor', ko: '외기 온도 센서', en: 'Ambient air temperature sensor', tags: 'R',
    groups: ['cooling-system-air-ducting', 'radiator'], match: /AMBIENT/,
    object: rbox([0.04, 0.03, 0.03], [2.278, 0.234, 0.33], 'blackPlastic', { r: 0.004 }),
  });
  // active louvres (#2/#3) in the grille opening between the bumper beam and the ankle catcher
  for (const [sd, sg, ko, en] of [['L', -1, '좌', 'LH'], ['R', 1, '우', 'RH']]) {
    const louvres = [];
    for (let i = 0; i < 4; i++) louvres.push(box([0.004, 0.022, 0.24], [2.33, 0.317 + i * 0.025, sg * 0.3], 'blackPlastic', [0, 0, 0.5]));
    reg.add({
      id: `active-louvre-${sd}`, ko: `액티브 루버 (${ko})`, en: `Active grille louvre ${en}`, tags: sd,
      groups: ['cooling-system-air-ducting'], match: /LOUVRE|LOUVER/,
      object: group(louvres, rbox([0.03, 0.11, 0.27], [2.335, 0.352, sg * 0.3], 'darkMetal', { r: 0.005 })),
    });
  }

  // --- Coolant circuits -----------------------------------------------------------
  reg.add({
    id: 'coolant-reservoir', ko: '냉각수 리저버', en: 'Coolant reservoir',
    groups: ['coolant-reservoir', 'battery-cooling', 'battery-cooling-2nd-generation', 'battery-cooling-dual-motor', 'motor-cooling-rwd',
      'motor-cooling-dual-motor-large-rear-drive-unit', 'motor-cooling-dual-motor-small-rear-drive-unit'],
    match: /RESERV|PRESSURE CAP|COOLANT LEVEL|COOLANT BOTTLE|COOLANT, ETHYLENE|BRKT - RESERVOIR/,
    object: group(
      rbox([0.16, 0.14, 0.13], [1.1, 0.74, 0.3], 'lensClear', { r: 0.03 }),
      cyl(0.03, 0.03, 'y', [1.1, 0.825, 0.3], 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'battery-coolant-loop', ko: '배터리 냉각 회로(밸브·히터·호스)', en: 'Battery coolant loop (valve, heater, hoses)',
    groups: ['battery-cooling', 'battery-cooling-2nd-generation', 'battery-cooling-dual-motor'],
    match: /^(?!.*(VALVE 4-WAY|4 WAY VALVE))(?=.*(HOSE|VALVE|HEATER|CLAMP|PLATE|CX|CAGE|PIN|BRKT|CHILLER|BATT|PUMP|ISOLATOR|SENSOR|STOPPER))/,
    object: group(
      named('heater', rbox([0.09, 0.07, 0.16], [1.245, 0.42, 0.17], 'aluminum', { r: 0.015 })), // battery coolant heater, above the steering gear
      named('heaterToBattery', pipe([[1.215, 0.4, 0.1], [1.22, 0.32, 0.06], [1.15, 0.25, 0.05], [1.075, 0.25, 0.05]], 0.012, 'coolant')),
      named('batteryTo4wv', pipe([[1.075, 0.24, 0.4], [1.18, 0.25, 0.42], [1.44, 0.26, 0.42], [1.62, 0.33, 0.27], [1.7, 0.38, 0.19], [1.76, 0.44, 0.13]], 0.012, 'coolant')),
      named('reservoirTo4wv', pipe([[1.1, 0.69, 0.3], [1.17, 0.51, 0.35], [1.19, 0.49, 0.37], [1.55, 0.49, 0.37], [1.7, 0.49, 0.23], [1.8, 0.46, 0.14]], 0.011, 'coolant')),
    ),
  });
  reg.add({
    id: 'motor-coolant-loop', ko: '파워트레인 냉각 회로(펌프·호스, 좌측 로커 경유)', en: 'Powertrain coolant loop (pump & hoses via LH rocker)',
    groups: ['motor-cooling-rwd', 'motor-cooling-dual-motor-large-rear-drive-unit', 'motor-cooling-dual-motor-small-rear-drive-unit'],
    match: /^(?!.*(VALVE 4-WAY|4 WAY VALVE))(?=.*(HOSE|PUMP|VALVE|CLAMP|ROCKER|CHARGER|ISOLATOR|BRKT|TAPE|RING|FITTING))/,
    object: group(
      named('pump', cyl(0.045, 0.12, 'z', [1.72, 0.33, -0.22], 'blackPlastic')),
      named('valve3', rbox([0.08, 0.08, 0.08], [1.8, 0.36, -0.05], 'blackPlastic', { r: 0.015 })), // 3-way valve (radiator bypass)
      // pump inlet from the coolant reservoir (#2 RESERVOIR TO PUMP)
      named('reservoirToPump', pipe([[1.06, 0.675, 0.26], [1.18, 0.49, 0.32], [1.34, 0.43, 0.38], [1.51, 0.43, 0.38], [1.53, 0.43, 0.36], [1.54, 0.42, 0.35], [1.65, 0.33, 0.16], [1.71, 0.33, 0.1], [1.72, 0.33, -0.165]], 0.013, 'coolant')),
      // 3-way valve (#16): radiator outlet in (#22 3WVLV TO RAD), bypass in (#20), out to the 4-way valve (#21)
      named('valve3ToRad', pipe([[1.83, 0.395, -0.075], [1.84, 0.46, -0.01], [1.85, 0.47, 0], [2.01, 0.49, 0.27], [2.11, 0.51, 0.37], [2.152, 0.51, 0.365]], 0.013, 'coolant')),
      named('valve3To4wv', pipe([[1.8, 0.395, -0.05], [1.76, 0.42, -0.01], [1.76, 0.4, 0.07], [1.78, 0.43, 0.11]], 0.013, 'coolant')),
      // pump -> rocker LH (#7 PUMP TO ROCKER, #8 ROCKER LEFT SIDE, beside the battery pack) -> charger (#9)
      named('pumpToCharger', pipe([[1.72, 0.33, -0.275], [1.68, 0.35, -0.31], [1.58, 0.34, -0.41], [1.55, 0.31, -0.44], [1.1, 0.25, -0.6], [1.105, 0.252, -0.745], [1.04, 0.255, -0.745], [-0.9, 0.255, -0.745], [-0.9, 0.29, -0.74], [-0.9, 0.31, -0.72], [-0.85, 0.41, -0.465]], 0.013, 'coolant')),
      // charger -> drive unit (#12 CHARGER TO MOTOR / RDU)
      named('chargerToDu', pipe([[-1.05, 0.4, -0.3], [-1.12, 0.37, -0.17], [-1.17, 0.37, -0.03], [-1.2, 0.36, 0], [-1.24, 0.36, 0]], 0.013, 'coolant')),
      // drive unit inverter -> rocker RH (#13 INVERTER TO ROCKER, #14 ROCKER RIGHT SIDE) -> radiator inlet
      named('rockerR', pipe([[-1.2, 0.38, 0.33], [-1.2, 0.38, 0.4], [-1.135, 0.345, 0.465], [-1.075, 0.306, 0.51], [-1.055, 0.306, 0.53], [-0.97, 0.306, 0.56], [-0.95, 0.31, 0.58], [-0.93, 0.31, 0.645], [-0.91, 0.31, 0.745], [-0.88, 0.238, 0.745], [1.04, 0.238, 0.745], [1.105, 0.24, 0.745], [1.105, 0.245, 0.6], [1.8, 0.31, 0.44], [2.1, 0.31, 0.44], [2.186, 0.29, 0.365]], 0.012, 'coolant')),
      // bypass off the RH rocker hose to the 3-way valve (#20 RKR TO BYPASS 3 WAY VLV)
      named('bypass', pipe([[1.95, 0.31, 0.432], [1.91, 0.37, 0.44], [1.9, 0.39, 0.42], [1.8, 0.36, -0.015]], 0.012, 'coolant')),
    ),
  });

  // The 4-way valve couples the battery and powertrain coolant loops, so both loops list it.
  reg.add({
    id: 'four-way-valve', ko: '4방향 냉각수 밸브(배터리·파워트레인 연결)', en: '4-way coolant valve (battery / powertrain)',
    groups: ['battery-cooling', 'battery-cooling-2nd-generation', 'battery-cooling-dual-motor', 'motor-cooling-rwd',
      'motor-cooling-dual-motor-large-rear-drive-unit', 'motor-cooling-dual-motor-small-rear-drive-unit'],
    match: /VALVE 4-WAY|4 WAY VALVE|4 WAY VLV|4WVLV/,
    object: group(
      named('valve', rbox([0.09, 0.09, 0.09], [1.78, 0.47, 0.12], 'blackPlastic', { r: 0.015 })),
      // BRKT - 4 WAY VALVE (battery cooling #13, motor cooling #24): a plate bolted (BLT M6x20 #14) to the underside
      // of the frunk tub through the motor bay absorber pad; the valve hangs below it
      named('bracket', box([0.13, 0.012, 0.11], [1.78, 0.521, 0.12], 'steel')),
    ),
  });

  // --- Cabin HVAC (behind the dash) --------------------------------------------------
  // The case sits inside the instrument panel shell over the tunnel, between the accelerator pedal and the
  // passenger footwell modules (z +-0.19): its floor follows the IP lower edge (floor and console outlets), it is
  // bolted under the cross-car beam, its top front carries the face outlets and two "ears" either side of the
  // touchscreen carry the centre vent outlets.  The evaporator pipes run forward through the dash insulator to
  // the expansion valve (TXV) on the motor-bay side of the bulkhead.
  const caseSide = [[0.59, 0.4617], [0.7, 0.437], [0.8, 0.437], [0.85, 0.465], [0.85, 0.695], [0.685, 0.695],
    [0.685, 0.75], [0.62, 0.75], [0.62, 0.655], [0.59, 0.655]];
  reg.add({
    id: 'hvac-unit', ko: 'HVAC 유닛(공조 케이스)', en: 'HVAC unit (heater/evaporator case)',
    groups: ['heater-assembly-and-pollen-filter'], match: /HVAC|Ionizer|SENSOR|HARNESS|DRAIN|NVH|TAPE|SCR|NUT/,
    object: group(
      named('case', group(
        extrude(caseSide, 0.38, 'xy', [0, 0, 0], 'blackPlastic', { bevel: 0 }),
        ...[-1, 1].map((sg) => rbox([0.065, 0.085, 0.09], [0.5875, 0.7075, sg * 0.145], 'blackPlastic', { r: 0.01 })),
      )),
      named('evapPipes', group(
        pipe([[0.84, 0.645, 0.045], [1.015, 0.645, 0.045]], 0.008, 'aluminum'),
        pipe([[0.84, 0.615, 0.095], [1.015, 0.615, 0.095]], 0.01, 'aluminum'),
      )),
    ),
  });
  // drain hose from the case floor out through its grommet (#6) in the bulkhead, ending above the front
  // crossmember ahead of the battery (listed with the heater and with battery cooling)
  reg.add({
    id: 'hvac-drain-hose', ko: 'HVAC 드레인 호스', en: 'HVAC drain hose',
    groups: ['heater-assembly-and-pollen-filter', 'battery-cooling-2nd-generation'], match: /DRAIN HOSE|DRAIN TUBE/,
    object: group(
      named('hose', pipe([[0.8, 0.445, 0.15], [0.83, 0.437, 0.16], [1.0, 0.437, 0.17], [1.06, 0.37, 0.2]], 0.006, 'rubber')),
      named('grommet', cyl(0.011, 0.024, 'x', [0.985, 0.437, 0.168], 'rubber')),
    ),
  });
  reg.add({
    id: 'hvac-filter', ko: '실내 공기 필터 하우징', en: 'Cabin air (pollen) filter housing',
    groups: ['heater-assembly-and-pollen-filter'], match: /FILTER|Carbon|BLT HF/,
    object: rbox([0.16, 0.08, 0.26], [0.86, 0.79, 0.36], 'greyPlastic', { r: 0.015 }),
  });
  reg.add({
    id: 'hvac-blower', ko: '블로어 모터', en: 'Blower motor',
    groups: ['blower-motor'],
    object: group(
      cyl(0.095, 0.13, 'y', [0.68, 0.55, 0.43], 'blackPlastic', { seg: 28 }),
      rbox([0.06, 0.04, 0.06], [0.6, 0.47, 0.43], 'aluminum', { r: 0.006 }),
      named('outlet', rbox([0.1, 0.08, 0.16], [0.64, 0.62, 0.27], 'blackPlastic', { r: 0.01 })), // scroll outlet into the RH side of the HVAC case
    ),
  });
  reg.add({
    id: 'ptc-heater', ko: 'PTC 히터 코어', en: 'PTC heater core',
    groups: ['heater-core'],
    object: rbox([0.14, 0.1, 0.05], [0.77, 0.63, -0.19], 'copper', { r: 0.01 }), // in the heater core slot on the LH side of the case
  });
  reg.add({
    id: 'hvac-actuators', ko: '공조 액추에이터(모드·온도·내외기)', en: 'HVAC actuators (mode, temp, defrost, inlet)',
    groups: ['heating-and-ventilation-actuators-motors'],
    object: group(
      // on the sides and the top of the HVAC case
      rbox([0.05, 0.06, 0.03], [0.645, 0.66, -0.205], 'blackPlastic', { r: 0.006 }),
      rbox([0.05, 0.06, 0.03], [0.65, 0.53, -0.205], 'blackPlastic', { r: 0.006 }),
      rbox([0.05, 0.06, 0.03], [0.645, 0.7, 0.205], 'blackPlastic', { r: 0.006 }),
      rbox([0.05, 0.06, 0.03], [0.76, 0.6, 0.205], 'blackPlastic', { r: 0.006 }),
      rbox([0.05, 0.03, 0.06], [0.8, 0.71, 0], 'blackPlastic', { r: 0.006 }),
    ),
  });
  reg.add({
    id: 'hvac-controller', ko: '공조 컨트롤러·실내 온습도 센서', en: 'HVAC controller & cabin temp/humidity sensor',
    groups: ['heating-and-ventilation-controllers'],
    object: group(
      rbox([0.12, 0.03, 0.1], [0.58, 0.42, -0.12], 'darkMetal', { r: 0.008 }),
      rbox([0.03, 0.02, 0.04], [0.47, 0.9, 0.12], 'blackPlastic', { r: 0.005 }),
    ),
  });

  // --- Refrigerant circuit ------------------------------------------------------------
  reg.add({
    id: 'ac-compressor', ko: '전동 에어컨 컴프레서', en: 'Electric A/C compressor',
    groups: ['compressor'],
    object: group(
      named('body', cyl(0.075, 0.26, 'z', [1.92, 0.339, -0.13], 'aluminum', { seg: 28 })),
      named('head', rbox([0.12, 0.1, 0.1], [1.92, 0.399, 0.04], 'darkMetal', { r: 0.012 })), // inverter head with the HV and refrigerant ports
      // BRKT AC COMP TO AC BRKT (#2) on the AC BRKT-TO-CHASSIS SUPPORT (#3): on top of the front subframe cross member
      named('bracket', box([0.05, 0.012, 0.24], [1.94, 0.258, -0.13], 'steel')),
    ),
  });
  reg.add({
    id: 'ac-lines', ko: '에어컨 파이프·호스', en: 'A/C pipes & hoses',
    groups: ['air-conditioning-pipes-and-hoses'],
    object: group(
      // compressor to the condenser's LH end tank, behind the LH fan shroud and past the radiator side tank
      named('discharge', pipe([[1.95, 0.44, 0], [2.09, 0.48, -0.37], [2.1, 0.48, -0.38], [2.14, 0.48, -0.4], [2.2, 0.48, -0.41]], 0.008, 'aluminum')),
      // expansion valve on the motor-bay face of the bulkhead, on the evaporator pipes
      named('txv', box([0.04, 0.07, 0.1], [1.015, 0.63, 0.07], 'aluminum')),
      named('liquid', pipe([[2.228, 0.3, -0.412], [2.1, 0.3, -0.38], [1.55, 0.49, -0.17], [1.19, 0.5, -0.04], [1.15, 0.51, -0.01], [1.12, 0.54, 0.02], [1.11, 0.55, 0.02], [1.035, 0.615, 0.095]], 0.008, 'aluminum')),  // condenser to evaporator, through the firewall
      named('suction', pipe([[1.035, 0.645, 0.045], [1.06, 0.61, 0.02], [1.07, 0.55, 0.02], [1.09, 0.53, 0.02], [1.12, 0.5, -0.01], [1.15, 0.49, -0.04], [1.17, 0.49, -0.06], [1.26, 0.49, -0.1], [1.54, 0.49, -0.2], [1.56, 0.49, -0.2], [1.57, 0.48, -0.21], [1.6, 0.45, -0.21], [1.61, 0.44, -0.2], [1.73, 0.44, -0.08], [1.865, 0.42, 0.06]], 0.011, 'aluminum')),  // evaporator to compressor
    ),
  });
  void bar; void beam;
}
