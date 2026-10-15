// Cabin: instrument panel, displays, console, floor, trims, seats,
// restraints and safety sensors.

import * as THREE from 'three';
import { skinPath, skinAt } from '../body.js';
import { region, SV } from './exterior.js';
import {
  V, group, named, hollow, rbox, box, cyl, beam, bar, tube, extrude, quadPlate, disc, mesh,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

export const SEAT = { x: -0.05, z: 0.37, y: 0.5 };
export const REAR_SEAT = { x: -0.95 };

// Instrument panel side profile (x, y) extruded across the cabin.
const DASH_PROFILE = [
  [0.97, 0.42], [0.97, 0.86], [0.9, 0.925], [0.54, 0.94], [0.47, 0.905], [0.44, 0.8],
  [0.46, 0.64], [0.58, 0.47], [0.8, 0.42],
];

function frontSeat(sg) {
  const z = sg * SEAT.z;
  const x = SEAT.x;
  return group(
    rbox([0.5, 0.11, 0.5], [x + 0.03, 0.445, z], 'leather', { r: 0.04, rot: [0, 0, 0.08] }),
    rbox([0.44, 0.07, 0.07], [x + 0.03, 0.5, z - 0.22], 'leather', { r: 0.03, rot: [0, 0, 0.08] }),
    rbox([0.44, 0.07, 0.07], [x + 0.03, 0.5, z + 0.22], 'leather', { r: 0.03, rot: [0, 0, 0.08] }),
    rbox([0.12, 0.64, 0.5], [x - 0.32, 0.8, z], 'leather', { r: 0.05, rot: [0, 0, 0.24] }),
    rbox([0.09, 0.17, 0.26], [x - 0.45, 1.2, z], 'leather', { r: 0.04, rot: [0, 0, 0.2] }),
    cyl(0.008, 0.08, 'y', [x - 0.43, 1.1, z - 0.07], 'chrome'),
    cyl(0.008, 0.08, 'y', [x - 0.43, 1.1, z + 0.07], 'chrome'),
  );
}

export function buildInterior(reg) {
  // --- Instrument panel ---------------------------------------------------------
  reg.add({
    id: 'dash-panel', ko: '대시 패널(인스트루먼트 패널)', en: 'Dash panel (instrument panel)',
    groups: ['dash-panel'], match: /^(?!.*(GLOVE|WINDSHIELD EDGE))/,
    object: group(
      hollow(extrude(DASH_PROFILE, 1.46, 'xy', [0, 0, 0], 'leather', { bevel: 0.01 })), // moulded shell: ducts, column and wiring run inside
      named('topPad', box([0.3, 0.004, 1.2], [0.75, 0.946, 0], 'blackPlastic')),
    ),
  });
  // SEAL, WINDSHIELD EDGE: one part, listed with the glass (#2) and the dash panel (#1).
  // It runs along the windshield base and closes the gap to the IP top pad.
  reg.add({
    id: 'windshield-edge-seal', ko: '윈드실드 엣지 실', en: 'Windshield edge seal',
    groups: ['windshield-and-liftgate-glass', 'dash-panel'], match: /WINDSHIELD EDGE/,
    object: tube([...skinPath([[1.6, 4.12], [1.6, 5]], 'L', -0.008, 6), ...skinPath([[1.6, 5], [1.6, 4.12]], 'R', -0.008, 6).slice(1)], 0.008, 'rubber'),
  });
  reg.add({
    id: 'glove-box', ko: '글로브 박스', en: 'Glove box', tags: 'R',
    groups: ['dash-panel'], match: /GLOVE/,
    object: rbox([0.08, 0.17, 0.42], [0.465, 0.6, 0.39], 'leather', { r: 0.02, rot: [0, 0, -0.35] }),
  });
  reg.add({
    id: 'dash-support-frame', ko: '대시 지지 프레임(크로스카 빔)', en: 'Dash support frame (cross-car beam)',
    groups: ['dash-support-frame'],
    object: group(
      named('beam', cyl(0.03, 1.52, 'z', [0.72, 0.72, 0], 'steel')),
      // tunnel braces down to the toe board
      named('braceL', beam([0.72, 0.72, -0.1], [0.75, 0.31, -0.12], 0.016, 'steel')),
      named('braceR', beam([0.72, 0.72, 0.1], [0.75, 0.31, 0.12], 0.016, 'steel')),
      // end brackets bolted to the hinge pillars
      ...SIDES.map(({ sd, sg }) => named(`end${sd}`, box([0.2, 0.04, 0.06], [0.79, 0.72, sg * 0.77], 'steel'))),
      box([0.06, 0.02, 0.1], [0.72, 0.68, 0.28], 'steel'),
      box([0.004, 0.025, 0.07], [0.82, 0.94, -0.6], 'aluminum'),
    ),
  });
  // Every duct starts on an outlet of the HVAC case (energy.js): the outer face-level ducts leave
  // its top (the LH one climbs over the steering column, under the cluster), the centre ones its
  // front face beside the touchscreen; the rear footwell ducts and the centre console duct leave its
  // floor outlet and run along the tunnel, clear of the HVAC controller and the USB hub.
  // (names set inline, as named() does, so the shared import list of this file stays as it is)
  const duct = (name, pts, r) => Object.assign(tube(pts, r, 'blackPlastic', { tension: 0.2 }), { name });
  const vents = [];
  for (const [z, name] of [[-0.62, 'ventL'], [-0.13, 'ventCL'], [0.13, 'ventCR'], [0.62, 'ventR']]) {
    vents.push(Object.assign(rbox([0.03, 0.05, 0.16], [0.444, 0.79, z], 'blackPlastic', { r: 0.008 }), { name }));
  }
  reg.add({
    id: 'interior-ducts', ko: '실내 덕트·송풍구', en: 'Interior ducts & vents',
    groups: ['interior-ducting-and-vents'],
    object: group(
      vents,
      duct('faceL', [[0.63, 0.745, -0.2], [0.63, 0.79, -0.2], [0.66, 0.82, -0.31], [0.66, 0.82, -0.44], [0.57, 0.77, -0.53],
        [0.55, 0.77, -0.55], [0.455, 0.79, -0.62]], 0.03),
      duct('faceR', [[0.63, 0.745, 0.2], [0.63, 0.79, 0.2], [0.475, 0.79, 0.62], [0.455, 0.79, 0.62]], 0.03),
      duct('centreL', [[0.555, 0.72, -0.135], [0.5, 0.77, -0.135], [0.455, 0.79, -0.135]], 0.02),
      duct('centreR', [[0.555, 0.72, 0.135], [0.5, 0.77, 0.135], [0.455, 0.79, 0.135]], 0.02),
      duct('floorL', [[0.64, 0.455, -0.2], [0.64, 0.44, -0.2], [0.57, 0.4, -0.23], [0.3, 0.335, -0.28], [-0.45, 0.32, -0.3],
        [-0.65, 0.33, -0.3]], 0.025),
      duct('floorR', [[0.64, 0.455, 0.2], [0.59, 0.42, 0.21], [0.57, 0.4, 0.23], [0.3, 0.335, 0.28], [-0.45, 0.32, 0.3],
        [-0.65, 0.33, 0.3]], 0.025),
      duct('console', [[0.6, 0.455, 0.035], [0.6, 0.42, 0.035], [0.43, 0.37, 0.04], [-0.32, 0.42, 0.04], [-0.36, 0.45, 0.035],
        [-0.393, 0.47, 0.035]], 0.022),
    ),
  });
  reg.add({
    id: 'instrument-cluster', ko: '계기판(12.3" 인스트루먼트 클러스터)', en: 'Instrument cluster (12.3")',
    groups: ['instrument-cluster'],
    object: group(
      rbox([0.035, 0.13, 0.33], [0.53, 0.87, -0.37], 'screen', { r: 0.008, rot: [0, 0, 0.2] }),
      rbox([0.09, 0.03, 0.36], [0.55, 0.95, -0.37], 'leather', { r: 0.012 }),
      // mounting brackets from the cluster housing to the cross-car beam, either side of the column
      ...[-0.48, -0.215].map((z, i) => named(`bracket${i}`, beam([0.552, 0.86, z], [0.716, 0.753, z], 0.008, 'steel'))),
    ),
  });
  reg.add({
    id: 'touchscreen', ko: '17" 터치스크린(MCU)', en: '17" touchscreen (MCU)',
    groups: ['touchscreen'],
    object: group(
      rbox([0.03, 0.3, 0.22], [0.42, 0.74, 0], 'screen', { r: 0.008, rot: [0, 0, 0.3] }),
      rbox([0.12, 0.22, 0.18], [0.52, 0.76, 0], 'darkMetal', { r: 0.01, rot: [0, 0, 0.3] }),
    ),
  });

  // --- Console, floor, insulation -------------------------------------------------
  reg.add({
    id: 'center-console', ko: '센터 콘솔(터널 트림)', en: 'Center console (tunnel trim)',
    groups: ['center-tunnel-trim'],
    object: group(
      hollow(rbox([0.82, 0.12, 0.26], [0.0, 0.37, 0], 'leather', { r: 0.03 })), // tunnel trim shell over ducts and wiring
      rbox([0.3, 0.08, 0.2], [-0.32, 0.6, 0], 'leather', { r: 0.03 }),
      rbox([0.06, 0.18, 0.2], [-0.42, 0.48, 0], 'leather', { r: 0.02 }),
    ),
  });
  reg.add({
    id: 'premium-console', ko: '프리미엄 콘솔 인서트', en: 'Premium console insert',
    groups: ['premium-console-insert'],
    object: group(
      rbox([0.42, 0.1, 0.24], [0.15, 0.48, 0], 'wood', { r: 0.02 }),
      box([0.38, 0.006, 0.2], [0.15, 0.533, 0], 'chrome'),
    ),
  });
  reg.add({
    id: 'cabin-carpet', ko: '실내 카펫·플로어 매트', en: 'Passenger compartment carpet & mats',
    groups: ['passenger-compartment-carpet'],
    object: group(
      quadPlate([[0.95, 0.42, -0.74], [0.95, 0.42, 0.74], [0.72, 0.305, 0.76], [0.72, 0.305, -0.76]], 0.012, 'carpet'),
      quadPlate([[0.72, 0.305, -0.76], [0.72, 0.305, 0.76], [-0.68, 0.305, 0.76], [-0.68, 0.305, -0.76]], 0.012, 'carpet'),
      quadPlate([[-0.68, 0.305, -0.62], [-0.68, 0.305, 0.62], [-0.68, 0.46, 0.62], [-0.68, 0.46, -0.62]], 0.01, 'carpet'),
    ),
  });
  reg.add({
    id: 'sound-insulation', ko: '실내 방음재(대시·휠하우스·트렁크)', en: 'Sound insulation (dash, wheelhouse, trunk)',
    groups: ['interior-sound-insulation'],
    object: group(
      quadPlate([[0.985, 0.4, -0.72], [0.985, 0.4, 0.72], [0.985, 0.86, 0.72], [0.985, 0.86, -0.72]], 0.02, 'foam'),
      quadPlate([[0.99, 0.86, -0.62], [0.99, 0.86, 0.62], [0.92, 0.9, 0.62], [0.92, 0.9, -0.62]], 0.012, 'foam'),
      quadPlate([[-2.3, 0.64, -0.55], [-2.3, 0.64, 0.55], [-2.3, 0.75, 0.55], [-2.3, 0.75, -0.55]], 0.02, 'foam'),
    ),
  });

  // --- Door trims, pillars, headliner ------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `door-trim-${sd}F`, ko: `앞 도어 트림 패드 (${ko})`, en: `Front door trim pad ${en}`, tags: `${sd}F`,
      groups: ['front-door-trim-pad'],
      object: group(
        region([[SV.frontDoor[0] + 0.03, SV.frontDoor[1] - 0.02, 0.45, 2.95]], { side: sd, offset: -0.07, mat: 'leather', edges: false }),
        rbox([0.26, 0.04, 0.06], [0.0, 0.67, sg * 0.79], 'leather', { r: 0.015 }),
      ),
    });
    reg.add({
      id: `door-trim-${sd}B`, ko: `뒤 도어 트림 패드 (${ko})`, en: `Rear door trim pad ${en}`, tags: `${sd}B`,
      groups: ['rear-door-trim-pad'],
      object: group(
        region([[SV.rearDoor[0] + 0.02, SV.rearDoor[1] - 0.03, 0.45, 2.95]], { side: sd, offset: -0.07, mat: 'leather', edges: false }),
        rbox([0.22, 0.04, 0.06], [-0.85, 0.68, sg * 0.79], 'leather', { r: 0.015 }),
      ),
    });
    reg.add({
      id: `pillar-trim-${sd}`, ko: `A·B·C 필러 실내 트림 (${ko})`, en: `A/B/C pillar interior trim ${en}`, tags: sd,
      groups: ['a-b-and-c-post-interior-trim'],
      object: group(
        region([[SV.cowlRear + 0.02, SV.roof[0], 3.86, 4.07]], { side: sd, offset: -0.03, mat: 'fabric', edges: false }),
        region([[SV.bPillar[0], SV.bPillar[1], 1.0, 4.0]], { side: sd, offset: -0.075, mat: 'greyPlastic', edges: false }),
        region([[SV.rearGlass[1], 3.78, 2.95, 4.05]], { side: sd, offset: -0.045, mat: 'fabric', edges: false }),
      ),
    });
    reg.add({
      id: `trunk-side-trim-${sd}`, ko: `트렁크 사이드 트림 (${ko})`, en: `Trunk side finisher ${en}`, tags: sd,
      groups: ['trunk-carpet-and-side-finishers'], match: /SIDE TRIM|BRKT|COVER,STRUT|COVER, STRUT|CHARGE PORT COVER/,
      object: region([[3.95, 4.5, 1.25, 2.95]], { side: sd, offset: -0.11, mat: 'carpet', edges: false }),
    });
    reg.add({
      id: `trunk-c-pillar-trim-${sd}`, ko: `트렁크 C필러 리어 트림 (${ko})`, en: `Trunk C-pillar rear trim ${en}`, tags: sd,
      groups: ['interior-trunk-trim-panels'], match: /C-PILLAR|C-PI|GARNISH|LIFTGATE SWITCH|BRKT|TROUGH|STOP, LIFTGATE|MAGNET/,
      object: region([[3.78, 4.42, 3.0, 4.0]], { side: sd, offset: -0.045, mat: 'greyPlastic', edges: false }),
    });
  }
  reg.add({
    id: 'headliner', ko: '헤드라이닝', en: 'Headliner',
    groups: ['headlining'],
    object: region([[SV.roof[0] - 0.02, 3.72, 3.95, 5]], { offset: -0.035, mat: 'fabric', edges: false }),
  });
  reg.add({
    id: 'liftgate-trim', ko: '리프트게이트 실내 트림', en: 'Liftgate interior trim',
    groups: ['liftgate-interior-trim'],
    object: region([[4.42, 4.93, 3.1, 5], [3.3, 4.42, 4.04, 4.12]], { offset: -0.035, mat: 'greyPlastic', edges: false }),
  });
  reg.add({
    id: 'trunk-sill-trim', ko: '트렁크 실(문턱) 트림', en: 'Trunk sill trim',
    groups: ['interior-trunk-trim-panels'], match: /SILL|STRIKER|CLIP|COVER, SILL/,
    object: rbox([0.08, 0.07, 1.1], [-2.33, 0.68, 0], 'greyPlastic', { r: 0.015 }),
  });
  reg.add({
    id: 'trunk-carpet', ko: '트렁크 카펫·로드플로어', en: 'Trunk carpet & load floor',
    groups: ['trunk-carpet-and-side-finishers'], match: /LOADFLOOR|FLOOR TRIM|TRUNK FLOOR|FOOTWELL|REAR WALL|BRKT, TRUNK, REAR|PUDDLE/,
    object: box([0.86, 0.02, 1.1], [-1.9, 0.635, 0], 'carpet'),
  });
  reg.add({
    id: 'parcel-shelf', ko: '파셀 선반(러기지 커버)', en: 'Parcel shelf (luggage cover)',
    groups: ['parcel-shelf'],
    object: quadPlate([[-1.42, 1.0, -0.6], [-1.42, 1.0, 0.6], [-2.12, 0.98, 0.58], [-2.12, 0.98, -0.58]], 0.012, 'carpet'),
  });
  reg.add({
    id: 'rearview-mirror', ko: '룸미러·레인/라이트 센서', en: 'Rear-view mirror & rain/light sensor',
    groups: ['rearview-mirror'],
    object: group(
      rbox([0.035, 0.07, 0.25], [0.2, 1.29, 0], 'blackPlastic', { r: 0.015 }),
      beam([0.22, 1.32, 0], [0.26, 1.37, 0], 0.01, 'blackPlastic'),
      rbox([0.05, 0.03, 0.12], [0.27, 1.385, 0], 'blackPlastic', { r: 0.01 }),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `sun-visor-${sd}`, ko: `선바이저 (${ko})`, en: `Sun visor ${en}`, tags: sd,
      groups: ['sun-visor'],
      object: rbox([0.17, 0.02, 0.34], [0.07, 1.318, sg * 0.35], 'fabric', { r: 0.008, rot: [0, 0, 0.55] }),
    });
  }

  // --- Seats -------------------------------------------------------------------------
  const frontSeatGroups = [
    'front-seat-assemblies-base-trim', 'front-seat-assemblies-performance-trim', 'front-seat-assemblies-premium-trim',
    'front-seat-assemblies-signature-trim', 'front-seat-covers-and-pads-base-trim', 'front-seat-covers-and-pads-next-generation-trim',
    'front-seat-covers-and-pads-performance-trim', 'front-seat-covers-and-pads-premium-trim', 'front-seat-covers-and-pads-signature-trim',
  ];
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `front-seat-${sd}`, ko: `앞좌석 (${ko})`, en: `Front seat ${en}`, tags: sd,
      groups: frontSeatGroups, object: frontSeat(sg),
    });
    const z = sg * SEAT.z;
    reg.add({
      id: `front-seat-track-${sd}`, ko: `앞좌석 레일·모터 (${ko})`, en: `Front seat tracks & motors ${en}`, tags: sd,
      groups: ['front-seat-slides-motors-and-controllers'],
      object: group(
        bar([0.28, 0.33, z - 0.19], [-0.32, 0.33, z - 0.19], 0.04, 0.03, 'steel'),
        bar([0.28, 0.33, z + 0.19], [-0.32, 0.33, z + 0.19], 0.04, 0.03, 'steel'),
        cyl(0.025, 0.12, 'z', [0.05, 0.37, z], 'darkMetal'),
        rbox([0.1, 0.04, 0.08], [-0.15, 0.37, z + sg * 0.1], 'blackPlastic', { r: 0.008 }),
        // track feet bolted through the carpet to the floor pan (M10 / M8 bolts)
        named('feet', group([0.25, -0.29].flatMap((x) => [-0.19, 0.19].map((dz) => box([0.05, 0.018, 0.04], [x, 0.303, z + dz], 'steel'))))),
      ),
    });
    reg.add({
      id: `front-seat-switch-${sd}`, ko: `앞좌석 조절 스위치 (${ko})`, en: `Front seat control switches ${en}`, tags: sd,
      groups: ['front-seat-control-switches'],
      object: group(
        rbox([0.16, 0.05, 0.012], [SEAT.x + 0.05, 0.42, z + sg * 0.256], 'chrome', { r: 0.004 }),
        disc(0.018, 0.012, 'z', [SEAT.x - 0.1, 0.44, z + sg * 0.256], 'chrome'),
      ),
    });
    reg.add({
      id: `side-airbag-${sd}`, ko: `사이드 에어백(앞좌석 등받이) (${ko})`, en: `Seat side airbag ${en}`, tags: sd,
      groups: ['side-air-bags'], match: /SIDE AIRBAG/,
      object: rbox([0.07, 0.3, 0.04], [SEAT.x - 0.33, 0.82, z + sg * 0.235], 'fabric', { r: 0.012, rot: [0, 0, 0.24] }),
    });
  }
  reg.add({
    id: 'pods', ko: '탑승자 감지 매트(PODS, 조수석)', en: 'Passenger occupant detection (PODS)', tags: 'R',
    groups: ['passenger-presence-detection'],
    object: group(
      box([0.38, 0.006, 0.36], [SEAT.x + 0.03, 0.505, SEAT.z], 'foam'),
      rbox([0.08, 0.03, 0.06], [SEAT.x - 0.15, 0.37, SEAT.z], 'darkMetal', { r: 0.006 }),
    ),
  });
  const rearGroups = [
    '2nd-row-seat-assemblies-base-trim', '2nd-row-seat-assemblies-performance-trim',
    '2nd-row-seat-assemblies-premium-trim', '2nd-row-seat-assemblies-signature-trim', '2nd-row-seat-frame',
  ];
  const rx = REAR_SEAT.x;
  reg.add({
    id: 'rear-seat-cushion', ko: '2열 시트 쿠션', en: '2nd row seat cushion',
    groups: rearGroups, match: /CUSHION|BOLSTER|HEATER|SBR|REMINDER|PATCH HARNESS|ADAPTOR|RSC/,
    object: rbox([0.48, 0.13, 1.2], [rx, 0.535, 0], 'leather', { r: 0.045, rot: [0, 0, 0.06] }),
  });
  reg.add({
    id: 'rear-seat-back-60', ko: '2열 시트 등받이 60% (좌)', en: '2nd row seat back 60% (LH)', tags: 'L',
    groups: rearGroups, match: /BACK|60|PIVOT|LATCH|HEADREST|HRST|GROMMET|SLEEVE|BRACKET|BRKT|STRIKER|ESCUTCHEON|PUSH ROD|CIRCLIP/,
    object: group(
      hollow(rbox([0.12, 0.6, 0.72], [rx - 0.34, 0.87, -0.22], 'leather', { r: 0.045, rot: [0, 0, 0.3] })), // upholstered frame
      rbox([0.08, 0.14, 0.24], [rx - 0.47, 1.22, -0.36], 'leather', { r: 0.035, rot: [0, 0, 0.3] }),
      rbox([0.08, 0.12, 0.2], [rx - 0.47, 1.21, 0.0], 'leather', { r: 0.035, rot: [0, 0, 0.3] }),
    ),
  });
  reg.add({
    id: 'rear-seat-back-40', ko: '2열 시트 등받이 40% (우)', en: '2nd row seat back 40% (RH)', tags: 'R',
    groups: rearGroups, match: /BACK|40|PIVOT|LATCH|HEADREST|HRST|GROMMET|BRACKET|BRKT|STRIKER|ESCUTCHEON|PUSH ROD|CIRCLIP/,
    object: group(
      hollow(rbox([0.12, 0.6, 0.47], [rx - 0.34, 0.87, 0.375], 'leather', { r: 0.045, rot: [0, 0, 0.3] })),
      rbox([0.08, 0.14, 0.24], [rx - 0.47, 1.22, 0.36], 'leather', { r: 0.035, rot: [0, 0, 0.3] }),
    ),
  });
  reg.add({
    id: 'third-row-seats', ko: '3열 시트(후방 주시형)', en: '3rd row seats (rear-facing)',
    groups: ['3rd-row-seats'],
    object: group(
      rbox([0.36, 0.08, 0.9], [-1.86, 0.69, 0], 'leather', { r: 0.03 }),
      hollow(rbox([0.08, 0.42, 0.9], [-1.66, 0.88, 0], 'leather', { r: 0.03, rot: [0, 0, -0.32] })),
      rbox([0.06, 0.1, 0.18], [-1.6, 1.12, -0.24], 'leather', { r: 0.02, rot: [0, 0, -0.32] }),
      rbox([0.06, 0.1, 0.18], [-1.6, 1.12, 0.24], 'leather', { r: 0.02, rot: [0, 0, -0.32] }),
    ),
  });

  // --- Seat belts, pretensioners ----------------------------------------------------
  const bx = (SV.bPillar[0] + SV.bPillar[1]) / 2;
  for (const { sd, sg, ko, en } of SIDES) {
    const pz = sg * 0.79;
    const retr = V(2.485 - bx - 0.0, 0.42, pz);
    reg.add({
      id: `front-belt-${sd}`, ko: `앞좌석 안전벨트·버클 (${ko})`, en: `Front seat belt & buckle ${en}`, tags: sd,
      groups: ['front-seat-belts'],
      object: group(
        rbox([0.08, 0.12, 0.06], [retr.x, retr.y, retr.z], 'blackPlastic', { r: 0.01 }),
        tube([[retr.x, retr.y + 0.06, pz], [retr.x + 0.01, 0.8, pz + -sg * 0.0], [retr.x + 0.01, 1.14, pz - sg * 0.02]], 0.008, 'fabric'),
        tube([[retr.x + 0.01, 1.14, pz - sg * 0.04], [SEAT.x - 0.22, 1.0, sg * (SEAT.z + 0.1)], [SEAT.x - 0.05, 0.8, sg * SEAT.z],
          [SEAT.x - 0.18, 0.52, sg * (SEAT.z - 0.2)]], 0.007, 'fabric'),
        rbox([0.05, 0.12, 0.03], [SEAT.x - 0.2, 0.5, sg * (SEAT.z - 0.27)], 'blackPlastic', { r: 0.008 }),
      ),
    });
    reg.add({
      id: `pretensioner-${sd}`, ko: `아웃보드 랩 프리텐셔너 (${ko})`, en: `Outboard lap pretensioner ${en}`, tags: sd,
      groups: ['pre-tensioners'],
      object: group(
        cyl(0.02, 0.2, 'x', [SEAT.x - 0.25, 0.36, sg * 0.66], 'darkMetal'),
        box([0.05, 0.03, 0.03], [SEAT.x - 0.36, 0.37, sg * 0.66], 'steel'),
        named('anchor', box([0.04, 0.015, 0.14], [SEAT.x - 0.36, 0.352, sg * 0.71], 'steel')), // bolted to the sill inner face
      ),
    });
  }
  const rbx = rx - 0.5;
  reg.add({
    id: 'rear-belts', ko: '2열 안전벨트·버클', en: '2nd row seat belts & buckles',
    groups: ['2nd-row-seat-belts'],
    object: group(
      ...[-0.5, 0, 0.5].map((z) => rbox([0.1, 0.05, 0.08], [rbx - 0.02, 1.0, z], 'blackPlastic', { r: 0.01 })),
      ...[-0.5, 0.5].map((z) => tube([[rbx, 1.0, z], [rx - 0.33, 0.95, z * 0.9], [rx - 0.15, 0.62, z * 0.7]], 0.007, 'fabric')),
      ...[-0.42, -0.08, 0.2, 0.46].map((z) => rbox([0.04, 0.09, 0.03], [rx - 0.24, 0.6, z], 'blackPlastic', { r: 0.008 })),
    ),
  });
  reg.add({
    id: 'third-row-belts', ko: '3열 안전벨트', en: '3rd row seat belts',
    groups: ['3rd-row-seat-belts'],
    object: group(
      rbox([0.08, 0.06, 0.08], [-1.62, 1.06, -0.45], 'blackPlastic', { r: 0.01 }),
      rbox([0.08, 0.06, 0.08], [-1.62, 1.06, 0.45], 'blackPlastic', { r: 0.01 }),
      tube([[-1.62, 1.06, -0.45], [-1.75, 0.9, -0.3], [-1.86, 0.74, -0.15]], 0.006, 'fabric'),
      tube([[-1.62, 1.06, 0.45], [-1.75, 0.9, 0.3], [-1.86, 0.74, 0.15]], 0.006, 'fabric'),
    ),
  });

  // --- Airbags ---------------------------------------------------------------------
  reg.add({
    id: 'driver-airbag', ko: '운전석 에어백(스티어링 휠)', en: 'Driver airbag (steering wheel)', tags: 'L',
    groups: ['front-air-bags'], match: /DRIVER AIRBAG|DAB|STEERING CONTROL|CONNECTOR/,
    object: (() => {
      const m = mesh(new THREE.CylinderGeometry(0.07, 0.074, 0.03, 28), 'leather');
      const tilt = 0.44;
      m.rotation.set(0, 0, Math.PI / 2 - tilt);
      m.position.set(0.385, 0.865, -0.37);
      return m;
    })(),
  });
  reg.add({
    id: 'passenger-airbag', ko: '조수석 에어백', en: 'Passenger airbag', tags: 'R',
    groups: ['front-air-bags'], match: /PASSENGER AIR BAG|BOLT HF|CLIP/,
    object: group(
      rbox([0.2, 0.08, 0.3], [0.62, 0.89, 0.38], 'fabric', { r: 0.02 }),
      // module brackets bolted to the cross-car beam (BOLT HF)
      ...[0.32, 0.46].map((z, i) => named(`bracket${i}`, beam([0.68, 0.86, z], [0.712, 0.75, z], 0.008, 'steel'))),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `knee-airbag-${sd}`, ko: `무릎 에어백 (${ko})`, en: `Knee airbag ${en}`, tags: sd,
      groups: ['front-air-bags'], match: /KNEE|KAB/,
      // on a bracket from the cross-car beam: LH under the steering column, outboard of the
      // HVAC case; RH behind the glove box door, beside the blower
      object: sd === 'L'
        ? group(
          rbox([0.08, 0.1, 0.24], [0.55, 0.5, -0.455], 'fabric', { r: 0.015, rot: [0, 0, -0.6] }),
          named('bracket', beam([0.565, 0.54, -0.455], [0.705, 0.705, -0.455], 0.008, 'steel')),
        )
        : group(
          rbox([0.045, 0.12, 0.26], [0.556, 0.58, 0.43], 'fabric', { r: 0.012 }),
          named('bracket', beam([0.556, 0.63, 0.55], [0.705, 0.712, 0.55], 0.008, 'steel')),
        ),
    });
    const pts = [];
    for (let s = 1.75; s <= 3.72; s += 0.18) pts.push(skinAt(s, 3.9, sd, -0.06));
    reg.add({
      id: `curtain-airbag-${sd}`, ko: `커튼 에어백 (${ko})`, en: `Curtain airbag ${en}`, tags: sd,
      groups: ['side-air-bags'], match: /CURTAIN/,
      object: tube(pts, 0.022, 'fabric'),
    });
  }

  // --- Impact / acceleration sensors and restraint controller --------------------------
  const sensorGroups = ['impact-and-acceleration-sensors-na', 'impact-and-acceleration-sensors-eu-and-apac'];
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `impact-sensor-b-${sd}`, ko: `충돌 센서 - B필러 (${ko})`, en: `Impact sensor (B-pillar) ${en}`, tags: sd,
      groups: sensorGroups, match: /ACCEL IMPACT SENSOR|BLT TRX/,
      object: rbox([0.05, 0.05, 0.03], [2.485 - bx, 0.3, sg * 0.84], 'darkMetal', { r: 0.006 }),
    });
    reg.add({
      id: `impact-sensor-c-${sd}`, ko: `충돌 센서 - C필러 (${ko})`, en: `Impact sensor (C-pillar) ${en}`, tags: sd,
      groups: sensorGroups, match: /C- PILLAR|C-PILLAR/,
      object: rbox([0.05, 0.05, 0.03], [-1.25, 0.78, sg * 0.76], 'darkMetal', { r: 0.006 }),
    });
    reg.add({
      id: `door-pressure-sensor-${sd}`, ko: `앞 도어 압력 센서 (${ko})`, en: `Front door pressure sensor ${en}`, tags: sd,
      groups: sensorGroups, match: /DOOR PRESSURE|PRESSURE SENSOR FASTENER/,
      object: rbox([0.05, 0.04, 0.025], skinAt(2.235, 1.15, sd, -0.04).toArray(), 'darkMetal', { r: 0.006 }), // on the door inner panel
    });
  }
  reg.add({
    id: 'restraint-controller', ko: '에어백 제어 모듈(PSRCM)', en: 'Restraint control module (PSRCM)',
    groups: ['impact-and-acceleration-sensors-na'], match: /PSRCM|RCM/,
    object: rbox([0.14, 0.05, 0.1], [0.05, 0.323, -0.075], 'darkMetal', { r: 0.008 }), // on the floor tunnel under the console
  });
  reg.add({
    id: 'pedestrian-protection', ko: '보행자 보호 센서·후드 액추에이터(EU/APAC)', en: 'Pedestrian protection sensors & hood actuators (EU/APAC)',
    groups: ['impact-and-acceleration-sensors-eu-and-apac'], match: /PEDESTRIAN|PED-PRO|SCREW PF/,
    object: group(
      tube([[2.37, 0.53, -0.6], [2.42, 0.53, -0.3], [2.43, 0.53, 0], [2.42, 0.53, 0.3], [2.37, 0.53, 0.6]], 0.008, 'darkMetal'),
      cyl(0.02, 0.1, 'y', [1.0, 0.86, -0.58], 'darkMetal'),
      cyl(0.02, 0.1, 'y', [1.0, 0.86, 0.58], 'darkMetal'),
    ),
  });
  void bar; void beam;
}
