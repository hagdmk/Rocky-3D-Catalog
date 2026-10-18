// Cabin: instrument panel, displays, console, floor, trims, seats,
// restraints and safety sensors.

import * as THREE from 'three';
import { skinPath, skinAt } from '../body.js';
import { xOf, sOf } from '../profile.js';
import { region, SV } from './exterior.js';
import {
  V, group, named, hollow, rbox, box, cyl, beam, bar, tube, pipe, quadPlate, disc, mesh,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

export const SEAT = { x: -0.05, z: 0.37, y: 0.5 };
export const REAR_SEAT = { x: -0.95 };

// --- Instrument panel shell ---------------------------------------------------------
// Side-view (x, y) outlines.  The top pad and the face run across the cabin; below the face the
// driver and passenger footwell covers (dash panel #17/#22) close the shell over each footwell, and
// over the tunnel the shell is open (the HVAC case and the console closeouts close it there).
const IP_TOP = [[0.9, 0.925], [0.54, 0.94], [0.47, 0.905], [0.463, 0.88], [0.44, 0.8], [0.4475, 0.72], [0.46, 0.64]];
const IP_COLUMN = { z0: -0.43, z1: -0.31, j0: 3, j1: 5 }; // column opening in the face, y 0.72-0.88
// LH: at the kick panel the cover carries the hood release handle; over the body controller hung from the
// beam it rises above the controller; inboard it runs above the pedal box, under the column U-joint and
// the steering I-shaft
const IP_LH_KICK = [[0.49, 0.47], [0.6, 0.53], [0.7, 0.537], [0.8, 0.56], [0.92, 0.6]];
const IP_LH_OUT = [[0.49, 0.47], [0.6, 0.62], [0.66, 0.752], [0.75, 0.765], [0.92, 0.765]];
const IP_LH_IN = [[0.5, 0.44], [0.62, 0.5], [0.72, 0.535], [0.8, 0.545], [0.92, 0.51]];
// RH: inboard under the blower and the radio tuner, outboard over the cabin fuse box
const IP_RH_IN = [[0.515, 0.44], [0.62, 0.443], [0.72, 0.445], [0.83, 0.448], [0.92, 0.6]];
const IP_RH_OUT = [[0.515, 0.44], [0.62, 0.52], [0.7, 0.585], [0.75, 0.625], [0.92, 0.7]];
const IP_CTR_B = [0.48, 0.45]; // lower edge of the centre face (screen frame and centre bin)

/** Surface lofted along z through side-view polylines with the same number of points (skip(i, j): leave a quad out). */
function loftZ(stations, mat, skip = () => false) {
  const n = stations[0].pts.length;
  const pos = [];
  const idx = [];
  for (const { z, pts } of stations) for (const [x, y] of pts) pos.push(x, y, z);
  for (let i = 0; i + 1 < stations.length; i++) {
    for (let j = 0; j + 1 < n; j++) {
      if (skip(i, j)) continue;
      const a = i * n + j;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
}

/** Flat side-view polygon at a given z. */
function capZ(pts, z, mat) {
  const tris = THREE.ShapeUtils.triangulateShape(pts.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, y, z]), 3));
  g.setIndex(tris.flat());
  g.computeVertexNormals();
  return mesh(g, mat);
}

function dashShell() {
  const face = (b) => [...IP_TOP, b];
  const faceSt = [
    [-0.735, IP_LH_OUT[0]], [-0.61, IP_LH_OUT[0]], [-0.6, IP_LH_IN[0]], [IP_COLUMN.z0, IP_LH_IN[0]], [IP_COLUMN.z1, IP_LH_IN[0]],
    [-0.28, IP_LH_IN[0]], [-0.27, IP_CTR_B], [0.21, IP_CTR_B], [0.22, IP_RH_IN[0]], [0.735, IP_RH_OUT[0]],
  ].map(([z, b]) => ({ z, pts: face(b) }));
  const lh = [[-0.735, IP_LH_KICK], [-0.7, IP_LH_KICK], [-0.69, IP_LH_OUT], [-0.61, IP_LH_OUT], [-0.6, IP_LH_IN], [-0.28, IP_LH_IN]]
    .map(([z, pts]) => ({ z, pts }));
  const rh = [[0.22, IP_RH_IN], [0.53, IP_RH_IN], [0.575, IP_RH_OUT], [0.735, IP_RH_OUT]].map(([z, pts]) => ({ z, pts }));
  return group(
    // the steering column and its covers pass through the opening in the face
    loftZ(faceSt, 'leather', (i, j) => faceSt[i].z === IP_COLUMN.z0 && j >= IP_COLUMN.j0 && j < IP_COLUMN.j1),
    loftZ(lh, 'leather'),
    loftZ(rh, 'leather'),
    // IP side covers (#15/#16)
    capZ([...IP_TOP, ...IP_LH_KICK], -0.735, 'leather'),
    capZ([...IP_TOP, ...IP_RH_OUT], 0.735, 'leather'),
  );
}

function frontSeat(sg) {
  const z = sg * SEAT.z;
  const x = SEAT.x;
  return group(
    rbox([0.5, 0.11, 0.5], [x + 0.03, 0.445, z], 'leather', { r: 0.04, rot: [0, 0, 0.08] }),
    rbox([0.44, 0.07, 0.07], [x + 0.03, 0.5, z - 0.22], 'leather', { r: 0.03, rot: [0, 0, 0.08] }),
    rbox([0.44, 0.07, 0.07], [x + 0.03, 0.5, z + 0.22], 'leather', { r: 0.03, rot: [0, 0, 0.08] }),
    named('back', rbox([0.12, 0.64, 0.5], [x - 0.32, 0.8, z], 'leather', { r: 0.05, rot: [0, 0, 0.24] })),
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
      // moulded shell, drawn as its surfaces (open towards the bulkhead and over the tunnel, with the column
      // opening in the face): the cross-car beam, the face ducts, the airbag modules and the IP harness lie
      // inside it; the brake pedal arm (footwell cover cut-out) and the IP and headliner harnesses (at the
      // A-pillar side covers) pass through it (PASS_OK in src/scene/joints.js)
      dashShell(),
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
  // glove box bin with its door flush with the IP face (lower right)
  reg.add({
    id: 'glove-box', ko: '글로브 박스', en: 'Glove box', tags: 'R',
    groups: ['dash-panel'], match: /GLOVE/,
    object: hollow(rbox([0.06, 0.17, 0.4], [0.503, 0.593, 0.4], 'leather', { r: 0.015, rot: [0, 0, 0.282] })), // bin: the owner's manual is kept inside
  });
  reg.add({
    id: 'dash-support-frame', ko: '대시 지지 프레임(크로스카 빔)', en: 'Dash support frame (cross-car beam)',
    groups: ['dash-support-frame'],
    object: group(
      named('beam', cyl(0.03, 1.52, 'z', [0.72, 0.72, 0], 'steel')),
      // down channel to the toe board (#6 DOWN CHANNEL BOTTOM): forward over the HVAC case top and down
      // in front of the case, between the evaporator pipes and the console harness
      named('downChannel', group(
        bar([0.735, 0.745, 0], [0.868, 0.745, 0], 0.03, 0.04, 'steel'),
        bar([0.868, 0.76, 0], [0.868, 0.39, 0], 0.03, 0.04, 'steel'),
        box([0.06, 0.02, 0.06], [0.86, 0.371, 0], 'steel', [0, 0, 0.4277]), // bottom bracket on the toe board
      )),
      // end brackets bolted to the hinge pillars
      ...SIDES.map(({ sd, sg }) => named(`end${sd}`, box([0.2, 0.04, 0.06], [0.79, 0.72, sg * 0.77], 'steel'))),
      box([0.06, 0.02, 0.1], [0.72, 0.68, 0.28], 'steel'),
      box([0.004, 0.025, 0.07], [0.82, 0.94, -0.6], 'aluminum'),
    ),
  });
  // Every duct starts on an outlet of the HVAC case (energy.js): the face ducts leave its top front
  // ahead of the cross-car beam, climb over the beam and run out to the outer vents; the centre ducts
  // leave the two ears beside the touchscreen; the rear footwell ducts and the centre console duct
  // leave its floor, pass under the HVAC controller and run along the floor.
  const duct = (name, pts, r) => named(name, pipe(pts, r, 'blackPlastic', { bend: 0.03 }));
  const vents = [];
  for (const [z, w, name] of [[-0.62, 0.16, 'ventL'], [-0.168, 0.1, 'ventCL'], [0.168, 0.1, 'ventCR'], [0.62, 0.16, 'ventR']]) {
    vents.push(named(name, rbox([0.03, 0.05, w], [0.444, 0.79, z], 'blackPlastic', { r: 0.008 })));
  }
  reg.add({
    id: 'interior-ducts', ko: '실내 덕트·송풍구', en: 'Interior ducts & vents',
    groups: ['interior-ducting-and-vents'],
    object: group(
      vents,
      ...SIDES.map(({ sd, sg }) => duct(`face${sd}`, [[0.8, 0.69, sg * 0.15], [0.8, 0.8, sg * 0.15], [0.75, 0.8, sg * 0.18],
        [0.75, 0.8, sg * 0.53], [0.69, 0.82, sg * 0.58], [0.6, 0.81, sg * 0.6], [0.455, 0.79, sg * 0.62]], 0.025)),
      ...SIDES.map(({ sd, sg }) => duct(`centre${sd}`, [[0.565, 0.715, sg * 0.145], [0.5, 0.77, sg * 0.158], [0.455, 0.79, sg * 0.168]], 0.02)),
      ...SIDES.map(({ sd, sg }) => duct(`floor${sd}`, [[0.7, 0.445, sg * 0.14], [0.7, 0.4, sg * 0.15], [0.62, 0.345, sg * 0.18],
        [0.45, 0.338, sg * 0.22], [-0.45, 0.338, sg * 0.29], [-0.65, 0.34, sg * 0.3]], 0.022)),
      duct('console', [[0.65, 0.45, 0.035], [0.63, 0.4, 0.035], [0.5, 0.365, 0.04], [0.43, 0.367, 0.04], [-0.32, 0.37, 0.04],
        [-0.36, 0.42, 0.035], [-0.393, 0.47, 0.035]], 0.022),
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
      // dash insulator on the bulkhead, cut out at its top corners round the hood hinge mounts
      quadPlate([[0.985, 0.4, -0.72], [0.985, 0.4, 0.72], [0.985, 0.8, 0.72], [0.985, 0.8, -0.72]], 0.02, 'foam'),
      quadPlate([[0.985, 0.8, -0.54], [0.985, 0.8, 0.54], [0.985, 0.86, 0.54], [0.985, 0.86, -0.54]], 0.02, 'foam'),
      // upper dash insulator under the cowl, up to the IP carrier's front edge (NVH, IP CARRIER: dash panel #12 = insulation #4)
      quadPlate([[0.99, 0.86, -0.54], [0.99, 0.86, 0.54], [0.9, 0.921, 0.54], [0.9, 0.921, -0.54]], 0.012, 'foam'),
      // trunk rear wall pad between the rear body panel and the trunk sill trim
      quadPlate([[-2.34, 0.64, -0.55], [-2.34, 0.64, 0.55], [-2.34, 0.75, 0.55], [-2.34, 0.75, -0.55]], 0.02, 'foam'),
    ),
  });

  // --- Door trims, pillars, headliner ------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    // Lower part (map pocket, speaker grille) on the door inner panel; the upper part (armrest bolster,
    // window-sill cap) stands further inboard, so the latch release cable runs behind it to the interior
    // handle mounted in it.  Both stop short of the latch on the shut face and above the sill.
    const doorTrim = (s0, s1) => [
      region([[s0, s1, 0.75, 1.62]], { side: sd, offset: -0.07, mat: 'leather', edges: false }),
      region([[s0, s1, 1.58, 2.95]], { side: sd, offset: -0.113, mat: 'leather', edges: false }),
    ];
    reg.add({
      id: `door-trim-${sd}F`, ko: `앞 도어 트림 패드 (${ko})`, en: `Front door trim pad ${en}`, tags: `${sd}F`,
      groups: ['front-door-trim-pad'],
      object: group(
        doorTrim(SV.frontDoor[0] + 0.03, SV.frontDoor[1] - 0.075),
        rbox([0.26, 0.04, 0.06], [0.0, 0.67, skinAt(sOf(0.0), 1.33, sd, -0.1).z], 'leather', { r: 0.015 }),
      ),
    });
    reg.add({
      id: `door-trim-${sd}B`, ko: `뒤 도어 트림 패드 (${ko})`, en: `Rear door trim pad ${en}`, tags: `${sd}B`,
      groups: ['rear-door-trim-pad'],
      object: group(
        doorTrim(SV.rearDoor[0] + 0.02, SV.rearDoor[1] - 0.075),
        rbox([0.22, 0.04, 0.06], [-0.85, 0.68, skinAt(sOf(-0.85), 1.35, sd, -0.1).z], 'leather', { r: 0.015 }),
      ),
    });
    // B-pillar trim: the lower part covers the belt retractor and the webbing running up behind it; the upper
    // part follows the window frame, with the webbing slot under the belt guide
    const [b0, b1] = SV.bPillar;
    const bm = (b0 + b1) / 2;
    reg.add({
      id: `pillar-trim-${sd}`, ko: `A·B·C 필러 실내 트림 (${ko})`, en: `A/B/C pillar interior trim ${en}`, tags: sd,
      groups: ['a-b-and-c-post-interior-trim'],
      object: group(
        named('aPillar', region([[SV.cowlRear + 0.02, SV.roof[0], 3.86, 4.07]], { side: sd, offset: -0.03, mat: 'fabric', edges: false })),
        named('bPillar', group(
          region([[b0, b1, 0.95, 1.85]], { side: sd, offset: -0.13, mat: 'greyPlastic', edges: false }),
          region([[b0, b1, 2.85, 4.0]], { side: sd, offset: -0.1, exclude: [[bm - 0.03, bm + 0.03, 3.27, 3.45]], mat: 'greyPlastic', edges: false }),
        )),
        // C-pillar trim, ending ahead of the C-pillar reinforcement where it climbs inboard to the roof rail
        named('cPillar', region([[SV.rearGlass[1], 3.67, 2.95, 4.05]], { side: sd, offset: -0.045, mat: 'fabric', edges: false })),
      ),
    });
    reg.add({
      id: `trunk-side-trim-${sd}`, ko: `트렁크 사이드 트림 (${ko})`, en: `Trunk side finisher ${en}`, tags: sd,
      groups: ['trunk-carpet-and-side-finishers'], match: /SIDE TRIM|BRKT|COVER,STRUT|COVER, STRUT|CHARGE PORT COVER/,
      object: group(
        named('panel', region([[3.95, 4.5, 1.25, 2.95]], { side: sd, offset: -0.11, mat: 'carpet', edges: false })),
        // trunk bracket #6 (LH) / #7 (RH): stands on the wheelhouse and carries the finisher's lower edge
        named('bracket', bar([-1.838, 0.676, sg * 0.864], [-1.765, 0.614, sg * 0.864], 0.025, 0.04, 'steel')),
      ),
    });
    reg.add({
      id: `trunk-c-pillar-trim-${sd}`, ko: `트렁크 C필러 리어 트림 (${ko})`, en: `Trunk C-pillar rear trim ${en}`, tags: sd,
      groups: ['interior-trunk-trim-panels'], match: /C-PILLAR|C-PI|GARNISH|LIFTGATE SWITCH|BRKT|TROUGH|STOP, LIFTGATE|MAGNET/,
      object: region([[3.78, 4.42, 3.0, 4.0]], { side: sd, offset: -0.045, mat: 'greyPlastic', edges: false }),
    });
  }
  // the headliner dips under the two pano roof drive motors at the front of the roof opening
  const panoMotors = [2.35, 2.445, 4.38, 4.53];
  reg.add({
    id: 'headliner', ko: '헤드라이닝', en: 'Headliner',
    groups: ['headlining'],
    object: group(
      region([[SV.roof[0] - 0.02, 3.72, 3.95, 5]], { offset: -0.035, exclude: [panoMotors], mat: 'fabric', edges: false }),
      region([panoMotors], { offset: -0.055, mat: 'fabric', edges: false }),
    ),
  });
  reg.add({
    id: 'liftgate-trim', ko: '리프트게이트 실내 트림', en: 'Liftgate interior trim',
    groups: ['liftgate-interior-trim'],
    // cut out round the latch at the bottom edge
    object: region([[4.42, 4.93, 3.1, 5], [3.3, 4.42, 4.04, 4.12]], { offset: -0.035, exclude: [[4.865, 4.93, 4.76, 5]], mat: 'greyPlastic', edges: false }),
  });
  reg.add({
    id: 'trunk-sill-trim', ko: '트렁크 실(문턱) 트림', en: 'Trunk sill trim',
    groups: ['interior-trunk-trim-panels'], match: /SILL|STRIKER|CLIP|COVER, SILL/,
    // on the load floor against the rear wall pad, below the latch striker
    object: rbox([0.08, 0.12, 1.1], [-2.29, 0.705, 0], 'greyPlastic', { r: 0.015 }),
  });
  reg.add({
    id: 'trunk-carpet', ko: '트렁크 카펫·로드플로어', en: 'Trunk carpet & load floor',
    groups: ['trunk-carpet-and-side-finishers'], match: /LOADFLOOR|FLOOR TRIM|TRUNK FLOOR|FOOTWELL|REAR WALL|BRKT, TRUNK, REAR|PUDDLE/,
    object: box([0.86, 0.02, 1.1], [-1.9, 0.635, 0], 'carpet'),
  });
  // parcel shelf with the two belt slots in its front edge (2nd row outboard webbing)
  const shelfAt = (x, z) => [x, 1.0 + (x + 1.42) * (0.02 / 0.7), z];
  const shelf = (z0, z1, xf, taper) => quadPlate([shelfAt(xf, z0), shelfAt(xf, z1), shelfAt(-2.12, z1 + taper[1]), shelfAt(-2.12, z0 + taper[0])], 0.012, 'carpet');
  reg.add({
    id: 'parcel-shelf', ko: '파셀 선반(러기지 커버)', en: 'Parcel shelf (luggage cover)',
    groups: ['parcel-shelf'],
    object: group(
      shelf(-0.6, -0.56, -1.42, [0.02, 0]), shelf(-0.56, -0.5, -1.48, [0, 0]), shelf(-0.5, 0.5, -1.42, [0, 0]),
      shelf(0.5, 0.56, -1.48, [0, 0]), shelf(0.56, 0.6, -1.42, [0, -0.02]),
    ),
  });
  // mirror base on the button bonded to the windshield
  reg.add({
    id: 'rearview-mirror', ko: '룸미러·레인/라이트 센서', en: 'Rear-view mirror & rain/light sensor',
    groups: ['rearview-mirror'],
    object: group(
      rbox([0.035, 0.07, 0.25], [0.2, 1.29, 0], 'blackPlastic', { r: 0.015 }),
      beam([0.22, 1.32, 0], [0.26, 1.362, 0], 0.01, 'blackPlastic'),
      rbox([0.05, 0.03, 0.12], [0.2643, 1.3647, 0], 'blackPlastic', { r: 0.01, rot: [0, 0, -0.4223] }),
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
        // motor and gearbox on the rails, under the cushion pan
        cyl(0.02, 0.12, 'z', [0.05, 0.365, z], 'darkMetal'),
        rbox([0.1, 0.03, 0.08], [-0.15, 0.36, z + sg * 0.1], 'blackPlastic', { r: 0.008 }),
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
      box([0.38, 0.006, 0.36], [SEAT.x + 0.03 - 0.052 * Math.sin(0.08), 0.445 + 0.052 * Math.cos(0.08), SEAT.z], 'foam', [0, 0, 0.08]), // mat under the cushion cover
      rbox([0.08, 0.03, 0.06], [SEAT.x - 0.15, 0.355, SEAT.z], 'darkMetal', { r: 0.006 }),
    ),
  });
  const rearGroups = [
    '2nd-row-seat-assemblies-base-trim', '2nd-row-seat-assemblies-performance-trim',
    '2nd-row-seat-assemblies-premium-trim', '2nd-row-seat-assemblies-signature-trim', '2nd-row-seat-frame',
  ];
  const rx = REAR_SEAT.x;
  // 2nd-row seat back: 0.54 tall, reclined 0.3 rad, its top and the head restraints under the backlite
  const RB = { x: rx - 0.35, y: 0.84, rot: 0.3, t: 0.12 };
  const tr = Math.tan(RB.rot);
  const axisX = (y) => RB.x - (y - RB.y) * tr; // seat back mid-plane at height y
  // point d metres in front of the seat back's front face at height y
  const backFront = (y, d, z) => {
    const c = Math.cos(RB.rot);
    const s = Math.sin(RB.rot);
    const fy = RB.y + (RB.t / 2) * s;
    const fx = RB.x + (RB.t / 2) * c - (y - fy) * tr;
    return [fx + d * c, y + d * s, z];
  };
  // point on the seat back's rear face at height y
  const backRear = (y, z) => {
    const fy = RB.y - (RB.t / 2) * Math.sin(RB.rot);
    return [RB.x - (RB.t / 2) * Math.cos(RB.rot) - (y - fy) * tr, y, z];
  };
  reg.add({
    id: 'rear-seat-cushion', ko: '2열 시트 쿠션', en: '2nd row seat cushion',
    groups: rearGroups, match: /CUSHION|BOLSTER|HEATER|SBR|REMINDER|PATCH HARNESS|ADAPTOR|RSC/,
    object: group(
      named('cushion', rbox([0.48, 0.13, 1.14], [rx, 0.535, 0], 'leather', { r: 0.045, rot: [0, 0, 0.06] })), // between the rear rail nodes
      // cushion frame wire hooks (part of cushion assy #4) clipped to the rear edge of the floor pan
      named('hooks', group(...[-0.5, 0.5].map((z) => bar([-0.735, 0.5, z], [-0.69, 0.3, z], 0.012, 0.012, 'steel')))),
    ),
  });
  reg.add({
    id: 'rear-seat-back-60', ko: '2열 시트 등받이 60% (좌)', en: '2nd row seat back 60% (LH)', tags: 'L',
    groups: rearGroups, match: /BACK|60|PIVOT|LATCH|HEADREST|HRST|GROMMET|SLEEVE|BRACKET|BRKT|STRIKER|ESCUTCHEON|PUSH ROD|CIRCLIP/,
    object: group(
      rbox([RB.t, 0.54, 0.695], [RB.x, RB.y, -0.2075], 'leather', { r: 0.045, rot: [0, 0, RB.rot] }),
      rbox([0.08, 0.1, 0.24], [axisX(1.13), 1.13, -0.36], 'leather', { r: 0.035, rot: [0, 0, RB.rot] }),
      rbox([0.08, 0.09, 0.2], [axisX(1.125), 1.125, 0.0], 'leather', { r: 0.035, rot: [0, 0, RB.rot] }),
    ),
  });
  reg.add({
    id: 'rear-seat-back-40', ko: '2열 시트 등받이 40% (우)', en: '2nd row seat back 40% (RH)', tags: 'R',
    groups: rearGroups, match: /BACK|40|PIVOT|LATCH|HEADREST|HRST|GROMMET|BRACKET|BRKT|STRIKER|ESCUTCHEON|PUSH ROD|CIRCLIP/,
    object: group(
      rbox([RB.t, 0.54, 0.415], [RB.x, RB.y, 0.3475], 'leather', { r: 0.045, rot: [0, 0, RB.rot] }),
      rbox([0.08, 0.1, 0.24], [axisX(1.13), 1.13, 0.36], 'leather', { r: 0.035, rot: [0, 0, RB.rot] }),
    ),
  });
  reg.add({
    id: 'third-row-seats', ko: '3열 시트(후방 주시형)', en: '3rd row seats (rear-facing)',
    groups: ['3rd-row-seats'],
    // shown stowed, the seat back folded flat over the cushion: the parcel shelf can only be fitted with the
    // 3rd row folded
    object: group(
      rbox([0.36, 0.08, 0.9], [-1.86, 0.69, 0], 'leather', { r: 0.03 }),
      rbox([0.42, 0.07, 0.9], [-1.875, 0.766, 0], 'leather', { r: 0.03 }),
      rbox([0.12, 0.05, 0.18], [-2.02, 0.826, -0.2], 'leather', { r: 0.02 }),
      rbox([0.12, 0.05, 0.18], [-2.02, 0.826, 0.2], 'leather', { r: 0.02 }),
    ),
  });

  // --- Seat belts, pretensioners ----------------------------------------------------
  const [b0, b1] = SV.bPillar;
  const bm = (b0 + b1) / 2;
  for (const { sd, sg, ko, en } of SIDES) {
    const rz = sg * 0.885;
    const rxB = xOf(bm);
    const dRing = skinAt(bm, 3.37, sd, -0.12);
    reg.add({
      id: `front-belt-${sd}`, ko: `앞좌석 안전벨트·버클 (${ko})`, en: `Front seat belt & buckle ${en}`, tags: sd,
      groups: ['front-seat-belts'],
      object: group(
        // retractor on the sill at the foot of the B-pillar, behind the lower B-pillar trim
        rbox([0.07, 0.09, 0.04], [rxB, 0.41, rz], 'blackPlastic', { r: 0.008 }),
        // webbing up between the B-pillar and its trim, out through the trim slot to the webbing guide (#5)
        named('webbing', pipe([[rxB, 0.45, rz], skinAt(bm, 1.0, sd, -0.1), skinAt(bm, 1.8, sd, -0.1), skinAt(bm, 2.8, sd, -0.075),
          skinAt(bm, 3.0, sd, -0.075), skinAt(bm, 3.22, sd, -0.075), dRing], 0.006, 'fabric', { bend: 0.02 })),
        rbox([0.06, 0.035, 0.016], skinAt(bm, 3.37, sd, -0.108).toArray(), 'blackPlastic', { r: 0.005 }),
        tube([dRing, [SEAT.x - 0.22, 1.0, sg * (SEAT.z + 0.1)], [SEAT.x - 0.05, 0.8, sg * SEAT.z],
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
  // 2nd row: outboard retractors on the inner faces of the rear quarter panels under the parcel shelf, the
  // webbing up through the shelf slots and over the seat back shoulders; centre retractor in the 60% back
  reg.add({
    id: 'rear-belts', ko: '2열 안전벨트·버클', en: '2nd row seat belts & buckles',
    groups: ['2nd-row-seat-belts'],
    object: group(
      ...[-1, 1].map((sg) => rbox([0.07, 0.06, 0.06], [-1.47, 0.935, sg * 0.53], 'blackPlastic', { r: 0.01 })),
      named('centreRetractor', rbox([0.06, 0.06, 0.07], backRear(0.92, 0), 'blackPlastic', { r: 0.01, rot: [0, 0, RB.rot] })), // on the seat back frame
      ...[-1, 1].map((sg) => pipe([[-1.465, 0.96, sg * 0.53], [-1.462, 1.04, sg * 0.53], [-1.445, 1.14, sg * 0.52], [-1.315, 1.145, sg * 0.51],
        backFront(1.06, 0.012, sg * 0.49), backFront(0.85, 0.012, sg * 0.42), backFront(0.66, 0.012, sg * 0.35)], 0.007, 'fabric', { bend: 0.03 })),
      // buckles (#4) at the crease between the cushion and the seat back
      ...[-0.24, -0.08, 0.08, 0.24].map((z) => rbox([0.04, 0.09, 0.03], [-1.13, 0.64, z], 'blackPlastic', { r: 0.008 })),
    ),
  });
  // 3rd row harness belts anchored on the (folded) seat back
  reg.add({
    id: 'third-row-belts', ko: '3열 안전벨트', en: '3rd row seat belts',
    groups: ['3rd-row-seat-belts'],
    object: group(
      rbox([0.06, 0.04, 0.06], [-2.05, 0.82, -0.4], 'blackPlastic', { r: 0.01 }),
      rbox([0.06, 0.04, 0.06], [-2.05, 0.82, 0.4], 'blackPlastic', { r: 0.01 }),
      tube([[-2.04, 0.808, -0.4], [-1.87, 0.808, -0.34], [-1.7, 0.808, -0.12]], 0.006, 'fabric'),
      tube([[-2.04, 0.808, 0.4], [-1.87, 0.808, 0.34], [-1.7, 0.808, 0.12]], 0.006, 'fabric'),
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
  for (const { sd, ko, en } of SIDES) {
    reg.add({
      id: `knee-airbag-${sd}`, ko: `무릎 에어백 (${ko})`, en: `Knee airbag ${en}`, tags: sd,
      groups: ['front-air-bags'], match: /KNEE|KAB/,
      // on a bracket from the cross-car beam, inside the lower IP: LH behind the knee bolster under the
      // steering column, RH under the glove box
      object: sd === 'L'
        ? group(
          rbox([0.06, 0.1, 0.22], [0.515, 0.537, -0.455], 'fabric', { r: 0.012, rot: [0, 0, 0.197] }),
          named('bracket', beam([0.535, 0.575, -0.455], [0.7, 0.705, -0.455], 0.008, 'steel')),
        )
        : group(
          rbox([0.045, 0.045, 0.22], [0.54, 0.4775, 0.45], 'fabric', { r: 0.012 }),
          named('bracket', beam([0.545, 0.495, 0.55], [0.704, 0.7, 0.55], 0.008, 'steel')),
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
      object: rbox([0.05, 0.05, 0.03], [xOf(bm), 0.385, sg * 0.8], 'darkMetal', { r: 0.006 }), // on the sill top at the foot of the B-pillar
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
    object: group(
      rbox([0.14, 0.05, 0.1], [0.05, 0.337, -0.075], 'darkMetal', { r: 0.008 }), // on the floor tunnel under the console
      named('feet', group([-0.005, 0.105].map((x) => box([0.02, 0.014, 0.1], [x, 0.305, -0.075], 'steel')))), // through the carpet
    ),
  });
  reg.add({
    id: 'pedestrian-protection', ko: '보행자 보호 센서·후드 액추에이터(EU/APAC)', en: 'Pedestrian protection sensors & hood actuators (EU/APAC)',
    groups: ['impact-and-acceleration-sensors-eu-and-apac'], match: /PEDESTRIAN|PED-PRO|SCREW PF/,
    object: group(
      tube([[2.37, 0.53, -0.6], [2.42, 0.53, -0.3], [2.43, 0.53, 0], [2.42, 0.53, 0.3], [2.37, 0.53, 0.6]], 0.008, 'darkMetal'),
      // hood actuators (#7) under the rear of the hood hinges, which they lift
      named('actuatorL', cyl(0.02, 0.05, 'y', [1.11, 0.797, -0.592], 'darkMetal')),
      named('actuatorR', cyl(0.02, 0.05, 'y', [1.11, 0.797, 0.592], 'darkMetal')),
    ),
  });
  void bar; void beam; void V;
}
