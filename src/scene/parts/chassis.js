// Wheels, tyres, brakes, suspension, steering, subframes and drive units.

import * as THREE from 'three';
import {
  X_FRONT_AXLE as XF, X_REAR_AXLE as XR, WHEEL_Y as WY, TRACK_FRONT, TRACK_REAR, TIRE_RADIUS, TIRE_WIDTH,
} from '../profile.js';
import {
  V, group, rbox, box, cyl, beam, bar, tube, torus, lathe, disc, helix, mesh,
} from '../geom.js';

const ZF = TRACK_FRONT / 2;
const ZR = TRACK_REAR / 2;

export const CORNERS = [
  { key: 'LF', x: XF, z: -ZF, sg: -1, front: true, ko: '앞 좌', en: 'front LH' },
  { key: 'RF', x: XF, z: ZF, sg: 1, front: true, ko: '앞 우', en: 'front RH' },
  { key: 'LB', x: XR, z: -ZR, sg: -1, front: false, ko: '뒤 좌', en: 'rear LH' },
  { key: 'RB', x: XR, z: ZR, sg: 1, front: false, ko: '뒤 우', en: 'rear RH' },
];

function tireMesh(c) {
  const hw = TIRE_WIDTH / 2;
  const R = TIRE_RADIUS;
  const prof = [
    [0.243, -hw + 0.012], [0.29, -hw], [0.325, -hw + 0.004], [0.343, -hw + 0.02], [R, -hw + 0.05],
    [R, hw - 0.05], [0.343, hw - 0.02], [0.325, hw - 0.004], [0.29, hw], [0.243, hw - 0.012],
  ];
  const m = lathe(prof, 'z', [c.x, WY, c.z], 'rubber', { seg: 56 });
  m.rotation.set(Math.PI / 2, 0, 0);
  return m;
}

function wheelMesh(c) {
  const parts = [];
  const sg = c.sg;
  const faceZ = c.z + sg * 0.07; // outer face plane
  // rim barrel
  const barrel = cyl(0.236, 0.215, 'z', [c.x, WY, c.z], 'aluminum', { seg: 48, open: true });
  parts.push(barrel);
  // outer lip
  parts.push(torus(0.236, 0.008, 'z', [c.x, WY, faceZ + sg * 0.035], 'aluminum', { seg: 48 }));
  // ten spokes (five twin spokes)
  for (let i = 0; i < 10; i++) {
    const a = (i / 5) * Math.PI + (i % 2 ? 0.17 : -0.17) / 2 + Math.floor(i / 2) * 0;
    const ang = Math.floor(i / 2) * ((2 * Math.PI) / 5) + (i % 2 ? 0.16 : -0.16);
    const r0 = 0.07;
    const r1 = 0.228;
    const p0 = V(c.x + Math.cos(ang) * r0, WY + Math.sin(ang) * r0, faceZ + sg * 0.012);
    const p1 = V(c.x + Math.cos(ang) * r1, WY + Math.sin(ang) * r1, faceZ + sg * 0.03);
    parts.push(bar(p0, p1, 0.026, 0.02, 'aluminum'));
    void a;
  }
  parts.push(disc(0.075, 0.03, 'z', [c.x, WY, faceZ + sg * 0.01], 'aluminum'));
  parts.push(disc(0.035, 0.012, 'z', [c.x, WY, faceZ + sg * 0.03], 'paintDark'));
  return group(parts);
}

function rotorMesh(c) {
  const r = c.front ? 0.178 : 0.183;
  const zc = c.z - c.sg * 0.035;
  return group(
    disc(r, 0.03, 'z', [c.x, WY, zc], 'steel', 40),
    cyl(0.085, 0.05, 'z', [c.x, WY, zc + c.sg * 0.03], 'darkMetal', { seg: 28 }),
  );
}

function caliperMesh(c, scale = 1, angle = 2.6, matKey = 'paintDark') {
  const r = (c.front ? 0.15 : 0.155);
  const x = c.x + Math.cos(angle) * r;
  const y = WY + Math.sin(angle) * r;
  const zc = c.z - c.sg * 0.035;
  const m = rbox([0.07 * scale, 0.17 * scale, 0.085 * scale], [x, y, zc], matKey, { r: 0.012 });
  m.rotation.z = angle - Math.PI / 2;
  return m;
}

function knuckleMesh(c) {
  const zi = c.z - c.sg * 0.11;
  return group(
    cyl(0.07, 0.07, 'z', [c.x, WY, c.z - c.sg * 0.07], 'steel', { seg: 24 }),
    rbox([0.09, 0.36, 0.06], [c.x - 0.01, WY + 0.02, zi], 'aluminum', { r: 0.02 }),
    beam([c.x - 0.01, WY + 0.17, zi], [c.x - 0.02, WY + 0.27, zi + c.sg * 0.05], 0.022, 'aluminum'),
  );
}

export function buildChassis(reg) {
  for (const c of CORNERS) {
    const fr = c.front ? 'F' : 'B';
    const side = c.sg < 0 ? 'L' : 'R';
    reg.add({
      id: `tire-${c.key}`, ko: `타이어 (${c.ko})`, en: `Tire ${c.en}`, tags: `${side}${fr}`,
      groups: ['tires'], object: tireMesh(c),
    });
    reg.add({
      id: `wheel-${c.key}`, ko: `휠 (${c.ko})`, en: `Wheel ${c.en}`, tags: `${side}${fr}`,
      groups: ['wheels'], object: wheelMesh(c),
    });
    reg.add({
      id: `tpms-${c.key}`, ko: `TPMS 센서 (${c.ko})`, en: `TPMS sensor ${c.en}`, tags: `${side}${fr}`,
      groups: ['tire-pressure-monitoring-system-tpms'],
      object: group(
        rbox([0.04, 0.025, 0.03], [c.x + 0.05, WY + 0.225, c.z + c.sg * 0.06], 'darkMetal', { r: 0.006 }),
        cyl(0.004, 0.04, 'z', [c.x + 0.05, WY + 0.225, c.z + c.sg * 0.09], 'chrome'),
      ),
    });
    const brakeGroup = c.front ? 'front-brake-rotors-calipers-and-pads' : 'rear-brake-rotors-calipers-and-pads';
    reg.add({
      id: `brake-rotor-${c.key}`, ko: `브레이크 로터 (${c.ko})`, en: `Brake rotor ${c.en}`, tags: `${side}${fr}`,
      groups: [brakeGroup], match: /ROTOR|DISC|SHIELD|BLT CSK/,
      object: group(
        rotorMesh(c),
        disc(0.19, 0.004, 'z', [c.x, WY, c.z - c.sg * 0.075], 'steel', 40),
      ),
    });
    reg.add({
      id: `brake-caliper-${c.key}`, ko: `브레이크 캘리퍼·패드 (${c.ko})`, en: `Brake caliper & pads ${c.en}`, tags: `${side}${fr}`,
      groups: [brakeGroup], match: /CALIPER|PAD|BLEED|BOOT|GREASE|BOLT HF M12/,
      object: caliperMesh(c, 1, c.front ? Math.PI * 0.82 : Math.PI * 0.8, 'paintDark'),
    });
    if (!c.front) {
      reg.add({
        id: `park-brake-${c.key}`, ko: `주차 브레이크 캘리퍼 (${c.ko})`, en: `Parking brake caliper ${c.en}`, tags: `${side}B`,
        groups: ['park-brake-calipers-and-pads'], match: /CALIPER|PAD|SPRING|BLT H|EPB CONNECTOR/,
        object: caliperMesh(c, 0.62, Math.PI * 1.2, 'darkMetal'),
      });
    }
    reg.add({
      id: `knuckle-${c.key}`, ko: `너클·허브·베어링 (${c.ko})`, en: `Knuckle, hub & bearing ${c.en}`, tags: `${side}${fr}`,
      groups: [c.front ? 'front-knuckle-hub-and-bearing' : 'rear-knuckle-hub-and-bearing'],
      object: knuckleMesh(c),
    });
    reg.add({
      id: `wheel-speed-sensor-${c.key}`, ko: `휠 속도 센서 (${c.ko})`, en: `Wheel speed sensor ${c.en}`, tags: `${side}${fr}`,
      groups: ['wheel-speed-sensors'],
      object: group(
        cyl(0.009, 0.06, 'z', [c.x + 0.07, WY - 0.05, c.z - c.sg * 0.13], 'blackPlastic'),
        tube([[c.x + 0.07, WY - 0.05, c.z - c.sg * 0.16], [c.x + 0.1, WY + 0.15, c.z - c.sg * 0.2],
          [c.x + 0.05, WY + 0.38, c.z - c.sg * 0.24]], 0.004, 'wire'),
      ),
    });
    // jounce (flexible brake) hose: from body bracket to caliper
    const calX = c.x + Math.cos(Math.PI * 0.82) * 0.15;
    reg.add({
      id: `jounce-hose-${c.key}`, ko: `브레이크 호스 (${c.ko})`, en: `Brake jounce hose ${c.en}`, tags: `${side}${fr}`,
      groups: ['jounce-hoses'],
      object: tube([[calX, WY + 0.11, c.z - c.sg * 0.07], [calX - 0.03, WY + 0.2, c.z - c.sg * 0.15],
        [calX + 0.02, WY + 0.3, c.z - c.sg * 0.24], [calX + 0.06, WY + 0.36, c.z - c.sg * 0.3]], 0.006, 'rubber'),
    });
  }

  // --- Front suspension -------------------------------------------------------
  for (const c of CORNERS.filter((k) => k.front)) {
    const side = c.sg < 0 ? 'L' : 'R';
    const sg = c.sg;
    const kz = c.z - sg * 0.11;
    reg.add({
      id: `front-arms-${c.key}`, ko: `프론트 서스펜션 암 (${c.ko})`, en: `Front suspension arms ${c.en}`, tags: `${side}F`,
      groups: ['front-suspension-arms'],
      object: group(
        // upper control arm (A-arm)
        beam([c.x - 0.01, WY + 0.27, kz + sg * 0.05], [c.x + 0.11, WY + 0.3, sg * 0.46], 0.016, 'aluminum'),
        beam([c.x - 0.01, WY + 0.27, kz + sg * 0.05], [c.x - 0.14, WY + 0.3, sg * 0.46], 0.016, 'aluminum'),
        // fore link and lateral link
        beam([c.x + 0.0, WY - 0.16, kz], [c.x + 0.34, WY - 0.13, sg * 0.34], 0.02, 'aluminum'),
        beam([c.x - 0.01, WY - 0.16, kz], [c.x - 0.06, WY - 0.15, sg * 0.32], 0.02, 'aluminum'),
      ),
    });
    const strutTop = [c.x - 0.05, WY + 0.46, sg * 0.6];
    const strutBot = [c.x - 0.03, WY - 0.12, sg * 0.66];
    reg.add({
      id: `front-air-spring-${c.key}`, ko: `프론트 에어 스프링 모듈 (${c.ko})`, en: `Front air spring module ${c.en}`, tags: `${side}F`,
      groups: ['front-air-spring'], variant: { susp: 'air' },
      object: group(
        beam(strutBot, strutTop, 0.024, 'steel'),
        beam([strutTop[0], WY + 0.12, strutTop[2] + sg * 0.01], [strutTop[0], WY + 0.38, strutTop[2]], 0.065, 'rubber'),
        cyl(0.06, 0.03, 'y', [strutTop[0], strutTop[1] - 0.02, strutTop[2]], 'aluminum'),
      ),
    });
    reg.add({
      id: `front-coil-spring-${c.key}`, ko: `프론트 코일 스프링·댐퍼 (${c.ko})`, en: `Front coil spring & damper ${c.en}`, tags: `${side}F`,
      groups: ['front-coil-spring-and-damper'], variant: { susp: 'coil' },
      object: group(
        beam(strutBot, strutTop, 0.024, 'steel'),
        helix(0.06, 0.26, 5.5, 0.009, [strutTop[0], WY + 0.27, strutTop[2] - sg * 0.004], 'paintDark'),
        cyl(0.07, 0.012, 'y', [strutTop[0], WY + 0.135, strutTop[2]], 'steel'),
        cyl(0.07, 0.012, 'y', [strutTop[0], WY + 0.405, strutTop[2]], 'steel'),
      ),
    });
    reg.add({
      id: `front-height-sensor-${c.key}`, ko: `프론트 차고 센서 (${c.ko})`, en: `Front ride height sensor ${c.en}`, tags: `${side}F`,
      groups: ['height-sensors'], variant: { susp: 'air' },
      object: group(
        rbox([0.05, 0.04, 0.03], [c.x - 0.12, WY - 0.02, sg * 0.42], 'blackPlastic', { r: 0.006 }),
        beam([c.x - 0.12, WY - 0.03, sg * 0.42], [c.x - 0.06, WY - 0.13, sg * 0.5], 0.004, 'steel'),
      ),
    });
  }
  reg.add({
    id: 'front-stabilizer', ko: '프론트 스태빌라이저 바·링크', en: 'Front stabilizer bar & links',
    groups: ['front-stabilizer-bar-and-links'],
    object: group(
      tube([[XF + 0.06, WY - 0.06, -0.62], [XF + 0.2, WY - 0.08, -0.5], [XF + 0.24, WY - 0.08, -0.25],
        [XF + 0.24, WY - 0.08, 0.25], [XF + 0.2, WY - 0.08, 0.5], [XF + 0.06, WY - 0.06, 0.62]], 0.013, 'steel'),
      beam([XF + 0.06, WY - 0.06, -0.62], [XF + 0.06, WY - 0.15, -0.62], 0.007, 'steel'),
      beam([XF + 0.06, WY - 0.06, 0.62], [XF + 0.06, WY - 0.15, 0.62], 0.007, 'steel'),
    ),
  });

  // --- Rear suspension -------------------------------------------------------
  for (const c of CORNERS.filter((k) => !k.front)) {
    const side = c.sg < 0 ? 'L' : 'R';
    const sg = c.sg;
    const kz = c.z - sg * 0.11;
    reg.add({
      id: `rear-arms-${c.key}`, ko: `리어 서스펜션 암 (${c.ko})`, en: `Rear suspension arms ${c.en}`, tags: `${side}B`,
      groups: ['rear-suspension-arms'],
      object: group(
        // lower control arm (large casting)
        rbox([0.16, 0.04, 0.42], [c.x + 0.02, WY - 0.15, sg * 0.5], 'aluminum', { r: 0.015 }),
        // integral, toe and upper links
        beam([c.x - 0.1, WY - 0.12, kz], [c.x - 0.12, WY - 0.08, sg * 0.36], 0.013, 'steel'),
        beam([c.x + 0.13, WY - 0.05, kz], [c.x + 0.16, WY - 0.04, sg * 0.36], 0.013, 'steel'),
        beam([c.x + 0.02, WY + 0.25, kz + sg * 0.03], [c.x + 0.16, WY + 0.25, sg * 0.42], 0.014, 'aluminum'),
        beam([c.x - 0.02, WY + 0.25, kz + sg * 0.03], [c.x - 0.14, WY + 0.26, sg * 0.42], 0.014, 'aluminum'),
      ),
    });
    const top = [c.x - 0.06, WY + 0.44, sg * 0.6];
    const bot = [c.x - 0.04, WY - 0.12, sg * 0.64];
    reg.add({
      id: `rear-air-spring-${c.key}`, ko: `리어 에어 스프링 모듈 (${c.ko})`, en: `Rear air spring module ${c.en}`, tags: `${side}B`,
      groups: ['rear-air-spring'], variant: { susp: 'air' },
      object: group(
        beam(bot, top, 0.024, 'steel'),
        beam([top[0], WY + 0.1, top[2]], [top[0], WY + 0.36, top[2]], 0.07, 'rubber'),
        cyl(0.065, 0.03, 'y', [top[0], top[1] - 0.02, top[2]], 'aluminum'),
      ),
    });
    reg.add({
      id: `rear-coil-spring-${c.key}`, ko: `리어 코일 스프링·댐퍼 (${c.ko})`, en: `Rear coil spring & damper ${c.en}`, tags: `${side}B`,
      groups: ['rear-coil-spring-and-damper'], variant: { susp: 'coil' },
      object: group(
        beam(bot, top, 0.024, 'steel'),
        helix(0.065, 0.24, 5, 0.01, [top[0], WY + 0.24, top[2]], 'paintDark'),
      ),
    });
    reg.add({
      id: `rear-height-sensor-${c.key}`, ko: `리어 차고 센서 (${c.ko})`, en: `Rear ride height sensor ${c.en}`, tags: `${side}B`,
      groups: ['height-sensors'], variant: { susp: 'air' },
      object: group(
        rbox([0.05, 0.04, 0.03], [c.x + 0.16, WY - 0.0, sg * 0.4], 'blackPlastic', { r: 0.006 }),
        beam([c.x + 0.16, WY - 0.01, sg * 0.4], [c.x + 0.1, WY - 0.13, sg * 0.48], 0.004, 'steel'),
      ),
    });
  }
  reg.add({
    id: 'rear-stabilizer', ko: '리어 스태빌라이저 바·링크', en: 'Rear stabilizer bar & links',
    groups: ['rear-stabilizer-bar-and-links'],
    object: group(
      tube([[XR - 0.12, WY - 0.05, -0.58], [XR - 0.22, WY - 0.09, -0.45], [XR - 0.25, WY - 0.09, 0],
        [XR - 0.22, WY - 0.09, 0.45], [XR - 0.12, WY - 0.05, 0.58]], 0.011, 'steel'),
      beam([XR - 0.12, WY - 0.05, -0.58], [XR - 0.1, WY - 0.15, -0.6], 0.006, 'steel'),
      beam([XR - 0.12, WY - 0.05, 0.58], [XR - 0.1, WY - 0.15, 0.6], 0.006, 'steel'),
    ),
  });

  // --- Steering -----------------------------------------------------------------
  const rackX = XF - 0.15;
  const rackY = WY - 0.02;
  reg.add({
    id: 'steering-gear', ko: '스티어링 기어(EPS 랙)·하부 칼럼', en: 'Steering gear (EPS rack) & lower column',
    groups: ['steering-gear-and-lower-column'],
    object: group(
      cyl(0.03, 0.72, 'z', [rackX, rackY, 0], 'aluminum'),
      cyl(0.055, 0.18, 'z', [rackX, rackY + 0.01, 0.16], 'darkMetal'),
      rbox([0.09, 0.09, 0.12], [rackX + 0.02, rackY + 0.06, -0.2], 'darkMetal', { r: 0.01 }),
      beam([rackX, rackY, -0.36], [XF - 0.14, WY + 0.02, -0.7], 0.011, 'steel'),
      beam([rackX, rackY, 0.36], [XF - 0.14, WY + 0.02, 0.7], 0.011, 'steel'),
      beam([rackX + 0.02, rackY + 0.08, -0.22], [0.98, 0.55, -0.37], 0.014, 'steel'),
    ),
  });
  // Column and wheel (LHD: driver on the left, -z)
  const swC = V(0.4, 0.86, -0.37);
  const tilt = 0.42; // rad from vertical, top tilted rearward
  const swGroup = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(0.185, 0.019, 12, 48), 'leather');
  rim.scale.set(1, 0.92, 1);
  const hub = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.06, 28), 'leather');
  hub.rotation.x = Math.PI / 2;
  const spokes = [
    bar([0, 0, 0], [0.17, -0.02, 0], 0.028, 0.02, 'leather'),
    bar([0, 0, 0], [-0.17, -0.02, 0], 0.028, 0.02, 'leather'),
    bar([0, 0, 0], [0, -0.17, 0], 0.03, 0.02, 'leather'),
  ];
  swGroup.add(rim, hub, ...spokes);
  // ring lies in local XY; rotate so its normal points rearward/up toward the driver
  swGroup.rotation.set(0, Math.PI / 2, 0);
  swGroup.rotateX(tilt);
  swGroup.position.copy(swC);
  reg.add({
    id: 'steering-wheel', ko: '스티어링 휠·칼럼', en: 'Steering wheel & column',
    groups: ['steering-column-and-wheel'],
    object: group(
      swGroup,
      beam([0.43, 0.84, -0.37], [0.82, 0.66, -0.37], 0.03, 'blackPlastic'),
      rbox([0.16, 0.09, 0.1], [0.55, 0.78, -0.37], 'blackPlastic', { r: 0.02, rot: [0, 0, 0.45] }),
    ),
  });

  // --- Subframes -------------------------------------------------------------------
  const fy = WY - 0.13;
  reg.add({
    id: 'front-subframe', ko: '프론트 서브프레임', en: 'Front subframe',
    groups: ['front-subframe', 'front-subframe-dual-motor'],
    object: group(
      bar([XF + 0.42, fy, -0.34], [XF - 0.3, fy, -0.34], 0.07, 0.06, 'aluminum'),
      bar([XF + 0.42, fy, 0.34], [XF - 0.3, fy, 0.34], 0.07, 0.06, 'aluminum'),
      bar([XF + 0.42, fy, -0.34], [XF + 0.42, fy, 0.34], 0.06, 0.06, 'aluminum'),
      bar([XF - 0.3, fy, -0.34], [XF - 0.3, fy, 0.34], 0.06, 0.06, 'aluminum'),
      bar([XF - 0.3, fy, -0.34], [XF - 0.52, fy + 0.03, -0.5], 0.04, 0.04, 'aluminum'),
      bar([XF - 0.3, fy, 0.34], [XF - 0.52, fy + 0.03, 0.5], 0.04, 0.04, 'aluminum'),
      box([0.6, 0.006, 0.62], [XF + 0.05, fy - 0.05, 0], 'aluminum'),
    ),
  });
  const ry = WY - 0.08;
  reg.add({
    id: 'rear-subframe', ko: '리어 서브프레임', en: 'Rear subframe',
    groups: ['rear-subframe'],
    object: group(
      bar([XR + 0.4, ry, -0.42], [XR - 0.36, ry, -0.42], 0.08, 0.07, 'aluminum'),
      bar([XR + 0.4, ry, 0.42], [XR - 0.36, ry, 0.42], 0.08, 0.07, 'aluminum'),
      bar([XR + 0.4, ry, -0.42], [XR + 0.4, ry, 0.42], 0.07, 0.07, 'aluminum'),
      bar([XR - 0.36, ry, -0.42], [XR - 0.36, ry, 0.42], 0.07, 0.07, 'aluminum'),
      bar([XR + 0.4, ry, -0.42], [XR + 0.4, ry + 0.25, -0.5], 0.05, 0.05, 'aluminum'),
      bar([XR + 0.4, ry, 0.42], [XR + 0.4, ry + 0.25, 0.5], 0.05, 0.05, 'aluminum'),
    ),
  });

  // --- Drive units ------------------------------------------------------------------
  const dy = WY - 0.01;
  reg.add({
    id: 'rear-drive-unit-large', ko: '대형 리어 구동 유닛 (LDU)', en: 'Large rear drive unit (LDU)',
    groups: ['motor-large-rear-drive-unit'], variant: { drive: ['rwd', 'pdm'] },
    object: group(
      cyl(0.135, 0.4, 'z', [XR + 0.14, dy + 0.02, 0.27], 'aluminum', { seg: 32 }),
      rbox([0.42, 0.3, 0.2], [XR + 0.02, dy, 0.0], 'aluminum', { r: 0.04 }),
      cyl(0.14, 0.3, 'z', [XR + 0.12, dy + 0.02, -0.26], 'darkMetal', { seg: 32 }),
      rbox([0.26, 0.12, 0.3], [XR + 0.14, dy + 0.2, -0.24], 'darkMetal', { r: 0.02 }),
    ),
  });
  reg.add({
    id: 'rear-drive-unit-small', ko: '소형 리어 구동 유닛 (SDU)', en: 'Small rear drive unit (SDU)',
    groups: ['motor-small-rear-drive-unit'], variant: { drive: 'dm' },
    object: group(
      cyl(0.11, 0.3, 'z', [XR + 0.13, dy + 0.02, 0.22], 'aluminum', { seg: 32 }),
      rbox([0.34, 0.26, 0.18], [XR + 0.02, dy, 0.0], 'aluminum', { r: 0.04 }),
      rbox([0.24, 0.2, 0.22], [XR + 0.1, dy + 0.02, -0.2], 'darkMetal', { r: 0.03 }),
    ),
  });
  reg.add({
    id: 'front-drive-unit', ko: '프론트 구동 유닛', en: 'Front drive unit',
    groups: ['front-drive-unit-motor'], variant: { drive: ['dm', 'pdm'] },
    object: group(
      cyl(0.11, 0.3, 'z', [XF - 0.12, WY + 0.02, 0.2], 'aluminum', { seg: 32 }),
      rbox([0.34, 0.26, 0.18], [XF - 0.02, WY, 0.0], 'aluminum', { r: 0.04 }),
      rbox([0.24, 0.2, 0.22], [XF - 0.1, WY + 0.02, -0.2], 'darkMetal', { r: 0.03 }),
      rbox([0.12, 0.16, 0.08], [XF + 0.12, WY + 0.0, -0.28], 'rubber', { r: 0.02 }),
    ),
  });
  const shaft = (x, z0, z1, mat = 'steel') => group(
    beam([x, WY, z0], [x, WY, z1], 0.017, mat),
    cyl(0.045, 0.09, 'z', [x, WY, z0 + Math.sign(z1 - z0) * 0.05], 'rubber', { r2: 0.03 }),
    cyl(0.045, 0.09, 'z', [x, WY, z1 - Math.sign(z1 - z0) * 0.05], 'rubber', { r2: 0.03 }),
  );
  for (const sd of [-1, 1]) {
    const side = sd < 0 ? 'L' : 'R';
    const ko = sd < 0 ? '좌' : '우';
    reg.add({
      id: `rear-halfshaft-${side}`, ko: `리어 하프샤프트 (${ko})`, en: `Rear halfshaft ${side}H`, tags: `${side}B`,
      groups: ['rear-drive-unit-halfshafts'],
      object: shaft(XR, sd * 0.12, sd * (ZR - 0.13)),
    });
    reg.add({
      id: `front-halfshaft-${side}`, ko: `프론트 하프샤프트 (${ko})`, en: `Front halfshaft ${side}H`, tags: `${side}F`,
      groups: ['front-drive-unit-halfshafts'], variant: { drive: ['dm', 'pdm'] },
      object: shaft(XF, sd * 0.12, sd * (ZF - 0.13)),
    });
  }
}

// Brake hydraulics, boosters, pedal and the air-suspension supply.
export function buildChassisSystems(reg) {
  const bz = -0.52; // booster / master cylinder line (LHD, driver side)
  reg.add({
    id: 'brake-pedal', ko: '브레이크 페달', en: 'Brake pedal', tags: 'L',
    groups: ['brake-pedal'],
    object: group(
      rbox([0.02, 0.06, 0.1], [0.7, 0.4, -0.42], 'rubber', { r: 0.008, rot: [0, 0, -0.4] }),
      beam([0.71, 0.42, -0.42], [0.86, 0.7, -0.42], 0.01, 'steel'),
      beam([0.86, 0.66, -0.42], [0.98, 0.66, bz], 0.008, 'steel'),
    ),
  });
  reg.add({
    id: 'vacuum-booster', ko: '진공 브레이크 부스터', en: 'Vacuum brake booster', tags: 'L',
    groups: ['brake-vacuum-pump-and-booster'], variant: { booster: 'vacuum' },
    match: /BOOSTER|PIN|CLIP|NUT|Sensor - Vacuum|HOSE/i,
    object: group(
      cyl(0.12, 0.15, 'x', [1.07, 0.66, bz], 'darkMetal', { seg: 32 }),
      tube([[1.07, 0.78, bz], [1.3, 0.62, -0.6], [1.7, 0.42, -0.58]], 0.008, 'rubber'),
    ),
  });
  reg.add({
    id: 'ibooster', ko: '전기기계식 부스터 (iBooster)', en: 'Electromechanical booster (iBooster)', tags: 'L',
    groups: ['electromechanical-brake-booster'], variant: { booster: 'ibooster' },
    object: group(
      cyl(0.08, 0.16, 'x', [1.06, 0.66, bz], 'aluminum', { seg: 28 }),
      rbox([0.1, 0.12, 0.1], [1.06, 0.66, bz - 0.11], 'darkMetal', { r: 0.012 }),
    ),
  });
  reg.add({
    id: 'master-cylinder', ko: '브레이크 마스터 실린더·리저버', en: 'Brake master cylinder & reservoir', tags: 'L',
    groups: ['brake-master-cylinder', 'brake-vacuum-pump-and-booster'], match: /MASTER|Reservoir|Fluid|Cap|Nut - Master|BRAKE FLUID/i,
    object: group(
      cyl(0.033, 0.17, 'x', [1.225, 0.66, bz], 'aluminum'),
      rbox([0.09, 0.06, 0.07], [1.2, 0.73, bz], 'lensClear', { r: 0.012 }),
      cyl(0.022, 0.02, 'y', [1.2, 0.77, bz], 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'vacuum-pump', ko: '브레이크 진공 펌프', en: 'Brake vacuum pump',
    groups: ['brake-vacuum-pump-and-booster'], variant: { booster: 'vacuum' },
    match: /PUMP|BRKT|ISOLATOR|DOWEL|CABLE TIE|SPACER|BLT M6/,
    object: group(
      cyl(0.045, 0.14, 'z', [1.72, 0.42, -0.58], 'darkMetal'),
      rbox([0.08, 0.02, 0.16], [1.72, 0.37, -0.58], 'steel', { r: 0.004 }),
    ),
  });
  reg.add({
    id: 'abs-module', ko: 'ABS/ESC 유압 제어 유닛(HCU)', en: 'ABS / ESC hydraulic control unit (HCU)', tags: 'R',
    groups: ['abs-module-and-esc-sensor'], match: /HCU|HYDRAULIC|Isolator/i,
    object: group(
      rbox([0.13, 0.11, 0.13], [1.2, 0.62, 0.6], 'aluminum', { r: 0.012 }),
      cyl(0.035, 0.07, 'y', [1.2, 0.71, 0.6], 'darkMetal'),
    ),
  });
  reg.add({
    id: 'esc-sensor', ko: 'ESC 센서 클러스터(요레이트)', en: 'ESC sensor cluster (yaw rate)',
    groups: ['abs-module-and-esc-sensor'], match: /ESC SENSOR|NUT,LCK/,
    object: rbox([0.07, 0.03, 0.06], [-0.1, 0.32, 0.12], 'darkMetal', { r: 0.006 }),
  });
  const absOut = [1.18, 0.56, 0.6];
  reg.add({
    id: 'brake-lines', ko: '브레이크 라인(하드 파이프)', en: 'Brake lines (hard pipes)',
    groups: ['brake-lines'],
    object: group(
      tube([[1.31, 0.64, bz], [1.35, 0.6, -0.2], [1.3, 0.6, 0.3], absOut], 0.005, 'steel'),
      tube([absOut, [1.4, 0.5, 0.4], [XF - 0.1, 0.62, -0.1], [XF - 0.1, 0.55, -0.5], [XF + 0.02, 0.62, -0.68]], 0.004, 'steel'),
      tube([absOut, [1.4, 0.52, 0.62], [XF + 0.02, 0.62, 0.68]], 0.004, 'steel'),
      tube([absOut, [1.1, 0.4, 0.5], [0.9, 0.29, 0.25], [-1.0, 0.29, 0.25], [-1.25, 0.32, 0.0]], 0.004, 'steel'),
      tube([[-1.25, 0.32, 0.0], [XR + 0.1, 0.4, -0.4], [XR - 0.02, 0.62, -0.7]], 0.004, 'steel'),
      tube([[-1.25, 0.32, 0.0], [XR + 0.1, 0.4, 0.4], [XR - 0.02, 0.62, 0.7]], 0.004, 'steel'),
    ),
  });

  // Air suspension supply
  reg.add({
    id: 'air-compressor', ko: '에어 서스펜션 컴프레서·밸브 블록', en: 'Air suspension compressor & valve block',
    groups: ['air-suspension-compressor-and-reservoir'], variant: { susp: 'air' },
    match: /COMPRESSOR|SOLENOID|INTAKE|SOL TO|COMP TO|VOSS|BLT - TRX|BLT M6/i,
    object: group(
      cyl(0.055, 0.2, 'x', [1.95, 0.3, -0.56], 'darkMetal', { seg: 24 }),
      rbox([0.08, 0.07, 0.08], [1.82, 0.31, -0.56], 'aluminum', { r: 0.01 }),
    ),
  });
  reg.add({
    id: 'air-reservoir', ko: '에어 서스펜션 리저버', en: 'Air suspension reservoir',
    groups: ['air-suspension-compressor-and-reservoir'], variant: { susp: 'air' },
    match: /RESERVOIR|RSVR|RESVR|FILL VALVE/i,
    object: cyl(0.065, 0.32, 'z', [1.95, 0.25, 0.32], 'aluminum', { seg: 24 }),
  });
  reg.add({
    id: 'air-lines-front', ko: '프론트 에어 라인', en: 'Front air suspension lines', tags: 'F',
    groups: ['front-air-suspension-pressure-lines'], variant: { susp: 'air' },
    object: group(
      tube([[1.82, 0.32, -0.6], [XF + 0.05, 0.6, -0.62], [XF - 0.05, WY + 0.4, -0.6]], 0.004, 'blackPlastic'),
      tube([[1.82, 0.32, -0.52], [1.9, 0.35, 0.0], [XF + 0.05, 0.6, 0.62], [XF - 0.05, WY + 0.4, 0.6]], 0.004, 'blackPlastic'),
      tube([[1.82, 0.3, -0.5], [1.95, 0.25, 0.15]], 0.004, 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'air-lines-rear', ko: '리어 에어 라인(좌측 실 경유)', en: 'Rear air suspension lines (via LH sill)', tags: 'B',
    groups: ['rear-air-suspension-pressure-lines'], variant: { susp: 'air' },
    object: group(
      tube([[1.82, 0.3, -0.62], [1.2, 0.27, -0.68], [-0.9, 0.27, -0.68], [XR + 0.1, 0.45, -0.62], [XR - 0.06, WY + 0.38, -0.6]], 0.004, 'blackPlastic'),
      tube([[-0.9, 0.27, -0.68], [-1.15, 0.3, 0.0], [XR + 0.1, 0.45, 0.62], [XR - 0.06, WY + 0.38, 0.6]], 0.004, 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'air-suspension-ecu', ko: '에어 서스펜션 ECU', en: 'Air suspension ECU', tags: 'LB',
    groups: ['module-air-suspension'], variant: { susp: 'air' },
    object: rbox([0.13, 0.09, 0.035], [-1.98, 0.82, -0.72], 'darkMetal', { r: 0.008 }),
  });
}
