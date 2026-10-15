// Body structure, bumper systems, under-hood trim, aero shields, frunk.

import * as THREE from 'three';
import {
  X_FRONT_AXLE as XF, X_REAR_AXLE as XR, WHEEL_Y as WY, ARCH_RADIUS, topY, sOf,
} from '../profile.js';
import {
  V, group, named, hollow, rbox, box, cyl, beam, bar, tube, mesh, quadPlate,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

/** Half-cylinder wheelhouse shell around an axle. */
function wheelhouse(x, sg, rIn, z0, z1, mat, a0 = -0.15, a1 = Math.PI + 0.15) {
  // Angles a0..a1 are measured in the side view from +x (forward), CCW.
  // CylinderGeometry places theta=0 on +z; after rotateX(90deg) that maps to
  // the angle a = theta - 90deg in the x/y plane.
  const g = new THREE.CylinderGeometry(rIn, rIn, Math.abs(z1 - z0), 36, 1, true, a0 + Math.PI / 2, a1 - a0);
  g.rotateX(Math.PI / 2);
  const m = mesh(g, mat);
  m.position.set(x, WY, sg * (Math.abs(z0) + Math.abs(z1)) / 2);
  return m;
}

function hoodY(x, inset = 0.04) {
  return topY(sOf(x)) - inset;
}

export function buildStructure(reg) {
  // --- Front inner structure: rails, shock towers, shotgun rails -------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `front-inner-${sd}`, ko: `프론트 레일·쇼크타워 (${ko})`, en: `Front rail & shock tower ${en}`, tags: sd,
      groups: ['front-inner-panels-dual-motor', 'front-inner-panels-rear-wheel-drive'],
      match: /SHOCK TOWER|SHOTGUN|RAIL|EXTN|EXTENSION|TORQUE BOX|REINF/,
      object: group(
        named('rail', bar([2.26, 0.47, sg * 0.5], [1.02, 0.42, sg * 0.5], 0.08, 0.12, 'aluminum')),
        named('tower', hollow(rbox([0.26, 0.3, 0.2], [XF - 0.05, 0.7, sg * 0.6], 'aluminum', { r: 0.03 }))),
        bar([1.85, 0.8, sg * 0.72], [0.95, 0.86, sg * 0.76], 0.06, 0.07, 'aluminum'),
        bar([XF - 0.05, 0.8, sg * 0.62], [1.85, 0.8, sg * 0.72], 0.05, 0.05, 'aluminum'),
        named('towerBrace', bar([XF - 0.05, 0.84, sg * 0.56], [1.02, 0.86, sg * 0.32], 0.05, 0.04, 'aluminum')),
      ),
    });
  }
  reg.add({
    id: 'front-crossmember', ko: '쇼크타워 크로스멤버·토크박스', en: 'Shock-tower crossmember & torque box',
    groups: ['front-inner-panels-dual-motor', 'front-inner-panels-rear-wheel-drive'],
    match: /CMBR|PLATE|BRKT DC-DC|MOTOR MOUNT|SHOCK TOWER REINFORCEMENT|BRACKET, MOTOR/,
    object: group(
      named('cmbr', bar([1.02, 0.86, -0.34], [1.02, 0.86, 0.34], 0.05, 0.05, 'aluminum')),
      named('torqueBox', box([0.3, 0.012, 0.9], [1.05, 0.33, 0], 'aluminum')),
    ),
  });

  // --- Sills (structural) ------------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `sill-${sd}`, ko: `사이드 실 (${ko})`, en: `Side sill ${en}`, tags: sd,
      groups: ['sill-components'],
      object: bar([1.12, 0.3, sg * 0.86], [-1.06, 0.3, sg * 0.86], 0.12, 0.17, 'aluminum'),
    });
  }

  // --- Rear structure -------------------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `rear-rail-${sd}`, ko: `리어 레일·노드 (${ko})`, en: `Rear rail & node ${en}`, tags: sd,
      groups: ['rear-end-panels'], match: /RAIL|NODE|RETRACTOR|REINF|WHL ARCH|QTR INR|WHEELHOUSE/,
      object: group(
        // kicks up over the rear axle so the halfshafts and struts pass beneath it
        named('railFront', bar([-1.0, 0.36, sg * 0.55], [-1.25, 0.425, sg * 0.55], 0.09, 0.11, 'aluminum')),
        named('rail', bar([-1.25, 0.425, sg * 0.55], [-2.3, 0.45, sg * 0.55], 0.09, 0.11, 'aluminum')),
        named('node', rbox([0.3, 0.26, 0.14], [XR + 0.3, 0.42, sg * 0.65], 'aluminum', { r: 0.03 })),
        named('closeout', rbox([0.085, 0.1, 0.07], [-1.0175, 0.32, sg * 0.755], 'aluminum', { r: 0.01 })), // node to sill
      ),
    });
    reg.add({
      id: `rear-quarter-inner-${sd}`, ko: `리어 휠하우스·쿼터 인너 (${ko})`, en: `Rear wheelhouse & quarter inner ${en}`, tags: sd,
      groups: ['rear-quarter-inner-panels'], match: /^(?!.*EXTENSION RR TRUNK FLOOR)/,
      object: group(
        wheelhouse(XR, sg, ARCH_RADIUS + 0.035, 0.6, 0.95, 'aluminum'),
        named('tower', hollow(rbox([0.2, 0.32, 0.12], [XR - 0.06, 0.82, sg * 0.62], 'aluminum', { r: 0.02 }))),
        // C-pillar reinforcement: from the wheelhouse up behind the rear door opening to the roof rail
        named('cPillar', bar([XR + 0.02, 0.8, sg * 0.71], [-1.21, 1.19, sg * 0.653], 0.04, 0.03, 'aluminum')),
      ),
    });
  }
  reg.add({
    id: 'trunk-floor', ko: '트렁크 플로어·리어 바디 패널', en: 'Trunk floor & rear body panel',
    groups: ['rear-end-panels'], match: /TRUNK FLOOR(?! PNL)|DIFFUSER|REAR BODY|BRKT/,
    object: group(
      named('floor', box([0.86, 0.01, 1.08], [-1.98, 0.615, 0], 'aluminum')),
      // rear body panel (#4): its lower edge sits on the bumper beam
      named('rearPanel', box([0.02, 0.225, 1.3], [-2.36, 0.6575, 0], 'aluminum')),
    ),
  });
  // Trunk floor extension panels (#2/#3, also quarter inner #5/#6): the sloped side
  // flanges that join the trunk floor to the wheelhouse and shock tower.
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `trunk-floor-ext-${sd}`, ko: `트렁크 플로어 익스텐션 (${ko})`, en: `Trunk floor extension panel ${en}`, tags: sd,
      groups: ['rear-end-panels', 'rear-quarter-inner-panels'], match: /EXTENSION RR TRUNK FLOOR/,
      object: quadPlate([[-1.95, 0.615, sg * 0.535], [-1.56, 0.615, sg * 0.535], [-1.56, 0.7, sg * 0.625], [-1.95, 0.7, sg * 0.625]], 0.006, 'aluminum'),
    });
  }

  // --- Bumper systems --------------------------------------------------------------
  // The ankle catcher (#2B) and the aero-shield access plugs (single-motor #11)
  // are listed with the carrier but drawn by their own components.
  const yLow = 0.218; // carrier lower rail centre: it carries the aero shield's front edge
  reg.add({
    id: 'front-bumper-carrier', ko: '프론트 범퍼 캐리어', en: 'Front bumper (fascia) carrier',
    groups: ['front-bumper-fascia-carrier-single-motor', 'front-bumper-fascia-carrier-dual-motor'],
    match: /^(?!.*(ANKLE|ACCESS PLUG))/i,
    object: group(
      bar([2.13, yLow, -0.62], [2.1, 0.7, -0.62], 0.04, 0.06, 'blackPlastic'),
      bar([2.13, yLow, 0.62], [2.1, 0.7, 0.62], 0.04, 0.06, 'blackPlastic'),
      named('upper', bar([2.1, 0.7, -0.62], [2.1, 0.7, 0.62], 0.05, 0.04, 'blackPlastic')),
      named('lower', bar([2.13, yLow, -0.62], [2.13, yLow, 0.62], 0.05, 0.04, 'blackPlastic')),
      beam([2.1, 0.7, -0.62], [1.85, 0.79, -0.82], 0.008, 'steel'),
      beam([2.1, 0.7, 0.62], [1.85, 0.79, 0.82], 0.008, 'steel'),
      // mounting brackets from the carrier side members to the outboard faces of the front rails
      ...SIDES.map(({ sd, sg }) => named(`railMount${sd}`, bar([2.115, 0.464, sg * 0.61], [2.115, 0.464, sg * 0.545], 0.05, 0.04, 'blackPlastic'))),
      // condenser brackets (#7) on the lower rail under the condenser fan shrouds
      ...SIDES.map(({ sd, sg }) => named(`condenserBrkt${sd}`, box([0.03, 0.02, 0.06], [2.145, 0.246, sg * 0.27], 'blackPlastic'))),
    ),
  });
  reg.add({
    id: 'front-bumper-beam', ko: '프론트 범퍼 빔(충격 흡수재)', en: 'Front bumper beam (energy absorber)',
    groups: ['front-energy-absorber'], match: /BUMPER SYSTEM|ISOLATOR|BOLT|NUT|SHIM|12V JUMP|CAP|AMP|SCR/,
    object: group(
      named('beam', tube([[2.31, 0.47, -0.72], [2.36, 0.47, -0.4], [2.375, 0.47, 0], [2.36, 0.47, 0.4], [2.31, 0.47, 0.72]], 0.05, 'aluminum', { radial: 4 })),
      // crash cans on the isolator brackets (#8), bolted into the rail ends (#9)
      named('canL', bar([2.33, 0.47, -0.5], [2.24, 0.47, -0.5], 0.09, 0.11, 'aluminum')),
      named('canR', bar([2.33, 0.47, 0.5], [2.24, 0.47, 0.5], 0.09, 0.11, 'aluminum')),
    ),
  });
  reg.add({
    id: 'front-ankle-catcher', ko: '앵클 캐처(하부 충격 흡수)', en: 'Ankle catcher (lower absorber)',
    groups: ['front-energy-absorber', 'front-bumper-fascia', 'front-bumper-fascia-carrier-dual-motor', 'front-bumper-fascia-carrier-single-motor'],
    match: /ANKLE|FOAM|NIFCO|Push/i,
    object: group(
      named('catcher', tube([[2.29, 0.25, -0.55], [2.36, 0.24, -0.25], [2.38, 0.24, 0], [2.36, 0.24, 0.25], [2.29, 0.25, 0.55]], 0.035, 'foam', { radial: 6 })),
      // mounting arms bolted to the carrier lower rail (#3/#4 M6x30)
      ...SIDES.map(({ sd, sg }) => named(`arm${sd}`, bar([2.135, 0.235, sg * 0.5], [2.31, 0.24, sg * 0.5], 0.04, 0.05, 'blackPlastic'))),
    ),
  });
  reg.add({
    id: 'rear-bumper-beam', ko: '리어 범퍼 빔·크로스멤버', en: 'Rear bumper beam & crossmember',
    groups: ['rear-energy-absorber'],
    object: group(
      named('beam', tube([[-2.33, 0.5, -0.68], [-2.385, 0.5, -0.35], [-2.395, 0.5, 0], [-2.385, 0.5, 0.35], [-2.33, 0.5, 0.68]], 0.045, 'aluminum', { radial: 4 })),
      // rear crossmember (#3) bolted under the rear rail ends
      named('crossmember', bar([-2.3, 0.385, -0.62], [-2.3, 0.385, 0.62], 0.05, 0.05, 'aluminum')),
    ),
  });
  reg.add({
    id: 'rear-diffuser', ko: '리어 디퓨저·에어 익스트랙터', en: 'Rear diffuser & air extractors',
    groups: ['rear-bumper-fascia'], match: /DIFFUSER|AIR EXTRACTOR|APPLIQUE|TRIM/,
    object: group(
      quadPlate([[-2.12, 0.205, -0.6], [-2.12, 0.205, 0.6], [-2.44, 0.33, 0.6], [-2.44, 0.33, -0.6]], 0.008, 'blackPlastic'),
      ...[-0.42, -0.14, 0.14, 0.42].map((z) => quadPlate([[-2.14, 0.21, z], [-2.42, 0.33, z], [-2.42, 0.26, z], [-2.14, 0.17, z]], 0.006, 'blackPlastic')),
    ),
  });

  // --- Aero shields and liners -------------------------------------------------------
  reg.add({
    id: 'front-undertray', ko: '프론트 언더트레이(에어로 실드)', en: 'Front undertray (aero shield)',
    groups: ['front-undertray', 'front-bumper-fascia-carrier-single-motor'], match: /ACCESS PLUG|AERO ?SHIELD/i,
    object: quadPlate([[2.3, 0.2, -0.6], [2.3, 0.2, 0.6], [1.05, 0.158, 0.66], [1.05, 0.158, -0.66]], 0.008, 'blackPlastic'),
  });
  reg.add({
    id: 'rear-undertray', ko: '리어 언더트레이(미드 에어로 실드·스트레이크)', en: 'Rear undertray (mid aero shield & strakes)',
    groups: ['rear-undertray-and-diffuser'],
    object: group(
      quadPlate([[-1.18, 0.165, -0.66], [-1.18, 0.165, 0.66], [-2.1, 0.2, 0.62], [-2.1, 0.2, -0.62]], 0.008, 'blackPlastic'),
      ...[-0.56, -0.3, 0.3, 0.56].map((z) => quadPlate([[-1.6, 0.17, z], [-2.08, 0.2, z], [-2.08, 0.14, z], [-1.7, 0.155, z]], 0.006, 'blackPlastic')),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    for (const [fr, x, frKo] of [['F', XF, '앞'], ['B', XR, '뒤']]) {
      reg.add({
        id: `arch-liner-${sd}${fr}`, ko: `휠 아치 라이너 (${frKo} ${ko})`, en: `Wheel arch liner ${fr === 'F' ? 'front' : 'rear'} ${en}`,
        tags: `${sd}${fr}`, groups: ['wheel-arch-liners'], match: /LINER|LOUVRE|LOUVER|FLANGE|USP|COVER/,
        object: wheelhouse(x, sg, ARCH_RADIUS + 0.012, 0.64, 0.965, 'blackPlastic', -0.25, Math.PI + 0.25),
      });
    }
  }
  reg.add({
    id: 'motor-bay-absorber', ko: '모터룸 흡음재', en: 'Motor bay absorber',
    groups: ['motor-bay-absorber'],
    object: box([0.82, 0.012, 0.82], [1.6, 0.521, 0], 'foam'), // pad on the underside of the frunk tub
  });

  // --- Frunk ----------------------------------------------------------------------
  const fx0 = 2.04;
  const fx1 = 1.2;
  const fy = 0.53;
  const fz = 0.44;
  const top0 = hoodY(fx0, 0.05);
  const top1 = hoodY(fx1, 0.05);
  reg.add({
    id: 'frunk', ko: '프렁크(앞 적재함)', en: 'Front trunk (frunk) tub',
    groups: ['front-luggage-storage-compartment'], match: /^(?!.*SEAL - HOOD)/, // the hood seal on the rim is hood-seal
    object: group(
      quadPlate([[fx0, fy, -fz], [fx0, fy, fz], [fx1, fy, fz], [fx1, fy, -fz]], 0.006, 'blackPlastic'),
      quadPlate([[fx0, fy, -fz], [fx0, top0, -fz], [fx1, top1, -fz], [fx1, fy, -fz]], 0.006, 'blackPlastic'),
      quadPlate([[fx0, fy, fz], [fx0, top0, fz], [fx1, top1, fz], [fx1, fy, fz]], 0.006, 'blackPlastic'),
      quadPlate([[fx0, fy, -fz], [fx0, fy, fz], [fx0, top0, fz], [fx0, top0, -fz]], 0.006, 'blackPlastic'),
      quadPlate([[fx1, fy, -fz], [fx1, fy, fz], [fx1, top1, fz], [fx1, top1, -fz]], 0.006, 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'frunk-carpet', ko: '프렁크 카펫 라이닝', en: 'Frunk carpet lining',
    groups: ['front-luggage-storage-compartment-carpet-lining'],
    object: group(
      quadPlate([[fx0 - 0.02, fy + 0.012, -fz + 0.02], [fx0 - 0.02, fy + 0.012, fz - 0.02], [fx1 + 0.02, fy + 0.012, fz - 0.02], [fx1 + 0.02, fy + 0.012, -fz + 0.02]], 0.01, 'carpet'),
      quadPlate([[fx0 - 0.02, fy + 0.02, -fz + 0.012], [fx0 - 0.02, top0 - 0.02, -fz + 0.012], [fx1 + 0.02, top1 - 0.02, -fz + 0.012], [fx1 + 0.02, fy + 0.02, -fz + 0.012]], 0.008, 'carpet'),
      quadPlate([[fx0 - 0.02, fy + 0.02, fz - 0.012], [fx0 - 0.02, top0 - 0.02, fz - 0.012], [fx1 + 0.02, top1 - 0.02, fz - 0.012], [fx1 + 0.02, fy + 0.02, fz - 0.012]], 0.008, 'carpet'),
    ),
  });

  // --- Under-hood aprons -----------------------------------------------------------
  const ay = (x) => hoodY(x, 0.035);
  reg.add({
    id: 'underhood-apron-front', ko: '프론트 언더후드 에이프런', en: 'Front underhood apron',
    groups: ['underhood-trim'], match: /APRON FR|FRONT UNDERHOOD|SCUFF|TAPE, DBL/,
    object: quadPlate([[2.2, ay(2.2), -0.5], [2.2, ay(2.2), 0.5], [fx0, ay(fx0), 0.5], [fx0, ay(fx0), -0.5]], 0.008, 'blackPlastic'),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `underhood-apron-${sd}`, ko: `사이드 언더후드 에이프런·쇼크타워 커버 (${ko})`, en: `Side underhood apron & shock tower cover ${en}`,
      tags: sd, groups: ['underhood-trim'], match: /APRON, (LH|RH)|SUB ASY, UNDERHOOD|Shock Tower Cover|SPACER, FRUNK|CLIP, UNDERHOOD/i,
      object: quadPlate([[2.1, ay(2.1), sg * (fz + 0.005)], [2.1, ay(2.1), sg * 0.76], [1.15, ay(1.15), sg * 0.8], [1.15, ay(1.15), sg * (fz + 0.005)]], 0.008, 'blackPlastic'),
    });
  }
  reg.add({
    id: 'underhood-apron-rear', ko: '리어 언더후드 에이프런(냉각수 캡 접근)', en: 'Rear underhood apron',
    groups: ['underhood-trim'], match: /APRON, RR|U.HOOD APRON RR|DM ASY-UNDERHOOD APRON, RR|SEAL - HOOD TO COWL/,
    object: quadPlate([[1.2, ay(1.2), -0.62], [1.2, ay(1.2), 0.62], [0.98, ay(0.98) - 0.005, 0.62], [0.98, ay(0.98) - 0.005, -0.62]], 0.008, 'blackPlastic'),
  });

  // --- NVH plugs and patches (spread over the floor pan) -------------------------------
  const plugs = [];
  for (const x of [0.6, 0.1, -0.4, -0.9]) {
    for (const z of [-0.55, 0.55]) plugs.push(cyl(0.022, 0.008, 'y', [x, 0.305, z], 'rubber', { seg: 14 }));
  }
  for (const { sg } of SIDES) {
    plugs.push(box([0.004, 0.06, 0.06], [0.45, 0.55, sg * 0.83], 'foam'));
    plugs.push(box([0.004, 0.06, 0.06], [-0.55, 0.55, sg * 0.83], 'foam'));
  }
  reg.add({
    id: 'nvh-plugs', ko: 'NVH 댐핑 패치·바디 플러그 (여러 위치)', en: 'NVH damping patches & body plugs (various)',
    groups: ['nvh-damping-and-paint-armor'],
    object: group(plugs),
  });
}
