// Cabin: instrument panel, displays, console, floor, trims, seats,
// restraints and safety sensors.

import * as THREE from 'three';
import { skinPath, skinAt } from '../body.js';
import { xOf, sOf } from '../profile.js';
import { region, SV } from './exterior.js';
import { STEER } from './chassis.js';
import {
  V, group, named, hollow, rbox, box, cyl, beam, bar, tube, pipe, quadPlate, disc, mesh, faceTo, plates,
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
// instrument cluster opening in the top rear edge and the upper face, y 0.80-0.94, over the column
const IP_CLUSTER = { z0: -0.537, z1: -0.203, j0: 1, j1: 4 };
// cluster recess walls in the IP cluster frame: from the edge of the opening back to the screen's front face
const CLUSTER_CHEEK = [[0.54, 0.94], [0.47, 0.905], [0.463, 0.88], [0.44, 0.8], [0.525, 0.825], [0.51, 0.946]];
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

/** Smooth surface strip between two lines on the skin, (v0, offset o0) and (v1, o1), over s0..s1. */
function skinStrip(sd, s0, s1, [v0, o0], [v1, o1], mat) {
  const k = Math.max(2, Math.ceil((s1 - s0) / 0.04));
  const pos = [];
  const idx = [];
  for (let i = 0; i <= k; i++) {
    const a = s0 + ((s1 - s0) * i) / k;
    for (const p of [skinAt(a, v0, sd, o0), skinAt(a, v1, sd, o1)]) pos.push(p.x, p.y, p.z);
    if (i < k) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
}
/** Smooth surface strip across the skin at one s, between offsets o0 and o1, over v0..v1. */
function vStrip(sd, s, v0, v1, o0, o1, mat) {
  const k = Math.max(2, Math.ceil((v1 - v0) / 0.05));
  const pos = [];
  const idx = [];
  for (let i = 0; i <= k; i++) {
    const v = v0 + ((v1 - v0) * i) / k;
    for (const p of [skinAt(s, v, sd, o0), skinAt(s, v, sd, o1)]) pos.push(p.x, p.y, p.z);
    if (i < k) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
}
/** Trim clip tower square to the skin at (s, v), from offset o0 out to o1 (radius r). */
function skinClip(sd, s, v, o0, o1, mat = 'blackPlastic', r = 0.008) {
  const a = skinAt(s, v, sd, o0);
  const b = skinAt(s, v, sd, o1);
  return faceTo(cyl(r, a.distanceTo(b), 'y', [0, 0, 0], mat), a.clone().add(b).multiplyScalar(0.5), b.clone().sub(a), 'y');
}

function dashShell() {
  const face = (b) => [...IP_TOP, b];
  const faceSt = [
    [-0.735, IP_LH_OUT[0]], [-0.61, IP_LH_OUT[0]], [-0.6, IP_LH_IN[0]], [IP_CLUSTER.z0, IP_LH_IN[0]], [IP_COLUMN.z0, IP_LH_IN[0]],
    [IP_COLUMN.z1, IP_LH_IN[0]], [-0.28, IP_LH_IN[0]], [-0.27, IP_CTR_B], [IP_CLUSTER.z1, IP_CTR_B], [0.21, IP_CTR_B],
    [0.22, IP_RH_IN[0]], [0.735, IP_RH_OUT[0]],
  ].map(([z, b]) => ({ z, pts: face(b) }));
  const opening = (i, j) => (faceSt[i].z === IP_COLUMN.z0 && j >= IP_COLUMN.j0 && j < IP_COLUMN.j1)
    || (faceSt[i].z >= IP_CLUSTER.z0 && faceSt[i + 1].z <= IP_CLUSTER.z1 && j >= IP_CLUSTER.j0 && j < IP_CLUSTER.j1);
  const lh = [[-0.735, IP_LH_KICK], [-0.7, IP_LH_KICK], [-0.69, IP_LH_OUT], [-0.61, IP_LH_OUT], [-0.6, IP_LH_IN], [-0.28, IP_LH_IN]]
    .map(([z, pts]) => ({ z, pts }));
  const rh = [[0.22, IP_RH_IN], [0.53, IP_RH_IN], [0.575, IP_RH_OUT], [0.735, IP_RH_OUT]].map(([z, pts]) => ({ z, pts }));
  return group(
    // the steering column and its covers pass through the opening in the face; above it the cluster shows
    // through its opening under the cluster hood
    loftZ(faceSt, 'leather', opening),
    // cluster frame (#28): recess side walls and, beside the column, its floor under the screen
    plates([
      capZ(CLUSTER_CHEEK, IP_CLUSTER.z0, 'blackPlastic'),
      capZ(CLUSTER_CHEEK, IP_CLUSTER.z1, 'blackPlastic'),
      ...[[IP_CLUSTER.z0, IP_COLUMN.z0], [IP_COLUMN.z1, IP_CLUSTER.z1]].map(([z0, z1]) => quadPlate(
        [[0.44, 0.8, z0], [0.44, 0.8, z1], [0.525, 0.825, z1], [0.525, 0.825, z0]], 0.003, 'blackPlastic')),
    ], 'blackPlastic'),
    loftZ(lh, 'leather'),
    loftZ(rh, 'leather'),
    // IP side covers (#15/#16)
    plates([capZ([...IP_TOP, ...IP_LH_KICK], -0.735, 'leather'), capZ([...IP_TOP, ...IP_RH_OUT], 0.735, 'leather')], 'leather'),
    // and the side covers step out to the door trim, forward to the hinge pillar
    ...SIDES.map(({ sd, sg }) => named(`end${sd}`, ipEnd(sg, sd === 'L' ? IP_LH_KICK : IP_RH_OUT))),
  );
}

/**
 * IP end (side cover #15/#16), from the shell end at |z| 0.735 out to the door trim (0.838), under the top pad's
 * outer edge, over the face and the lower edge, back to the door trim's front edge, then forward of it out to 0.855 and on to the hinge pillar,
 * with a grommet notch for the front door harness at the pillar.  The cross-car beam end bracket and the IP harness end
 * lie inside it.
 */
function ipEnd(sg, low) {
  const [ZI, ZO, ZC, XD, XH, YT] = [0.735, 0.838, 0.855, 0.842, 0.876, 0.926];
  const lerp = (x) => {
    for (let i = 0; i + 1 < low.length; i++) {
      const [[x0, y0], [x1, y1]] = [low[i], low[i + 1]];
      if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return low[low.length - 1][1];
  };
  const bottom = [...low.filter(([x]) => x < XD), [XD, lerp(XD)]];
  const face = IP_TOP.filter(([x]) => x < XD);
  const prof = [[XD, YT], ...face, ...bottom];
  const q = (pts) => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'leather');
  const yb = lerp(XH);
  return group(
    loftZ([{ z: sg * ZI, pts: prof }, { z: sg * ZO, pts: prof }], 'leather'),
    plates([
      capZ([...face, ...bottom, [XD, YT]], sg * ZO, 'leather'),
      // step out at the door trim's front edge, and the closeout on to the hinge pillar
      q([[XD, lerp(XD), ZO], [XD, lerp(XD), ZC], [XD, YT, ZC], [XD, YT, ZO]]),
      q([[XD, lerp(XD), ZC], [XH, yb, ZC], [XH, 0.735, ZC], [XD, 0.735, ZC]]),
      q([[XD, 0.735, ZC], [0.86, 0.735, ZC], [0.86, 0.8, ZC], [XD, 0.8, ZC]]),
      q([[XD, 0.8, ZC], [XH, 0.8, ZC], [XH, YT, ZC], [XD, YT, ZC]]),
      q([[XD, YT, ZO], [XD, YT, ZC], [XH, YT, ZC], [XH, YT, ZI]]),
      q([[XD, YT, ZI], [XD, YT, ZO], [XH, YT, ZI], [XH, YT, ZI]]),
    ], 'leather'),
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
      // AMP AND TUNER bracket (#5): a sheet-steel cage hung from the front of the beam (tabs bolted round it),
      // its side walls either side of the radio tuner and, below it, the premium amplifier, which rests on
      // the cage floor
      named('ampTunerBracket', group(
        ...[[0.212, 0.636], [0.398, 0.627]].flatMap(([z, y0]) => [
          box([0.2, 0.74 - y0, 0.004], [0.85, (0.74 + y0) / 2, z], 'steel'),
          box([0.046, 0.078, 0.004], [0.728, 0.701, z], 'steel'), // tab round the beam
        ]),
        box([0.17, 0.004, 0.19], [0.875, 0.628, 0.305], 'steel'),
      )),
      box([0.004, 0.025, 0.07], [0.82, 0.94, -0.6], 'aluminum'),
    ),
  });
  // Every duct starts on an outlet of the HVAC case (energy.js): the face ducts leave its top front
  // ahead of the cross-car beam, climb over the beam and run out to the outer vents; the centre ducts
  // leave the two ears beside the touchscreen; the rear footwell ducts and the centre console duct
  // leave its floor and pass under the HVAC controller, behind the console front closeouts.  The floor
  // ducts (#17 LH / #18 RH) then run back under the console carrier (over the restraint controller and
  // the ESC sensor) to outlets in the base of its side walls under the front seat cushions, which blow
  // out under the seats into the rear footwells.
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
      ...SIDES.map(({ sd, sg }) => duct(`floor${sd}`, [[0.7, 0.445, sg * 0.14], [0.7, 0.41, sg * 0.135], [0.62, 0.345, sg * 0.11],
        [0.47, 0.33, sg * 0.1], [0.3, 0.33, sg * 0.1], [0.17, 0.384, sg * 0.09], [-0.15, 0.384, sg * 0.09], [-0.212, 0.338, sg * 0.1],
        [-0.25, 0.335, sg * 0.102], [-0.256, 0.335, sg * 0.112], [-0.256, 0.335, sg * 0.1325]], 0.017)), // end square into the floor outlet
      // their outlets in the base of the console side walls, under the front seat cushions
      ...SIDES.map(({ sd, sg }) => named(`floorOutlet${sd}`, rbox([0.046, 0.04, 0.004], [-0.256, 0.335, sg * 0.1335], 'blackPlastic', { r: 0.0015 }))),
      duct('console', [[0.65, 0.45, 0.035], [0.63, 0.4, 0.035], [0.5, 0.365, 0.04], [0.43, 0.367, 0.04], [-0.32, 0.37, 0.04],
        [-0.36, 0.42, 0.035], [-0.393, 0.47, 0.035]], 0.022),
    ),
  });
  reg.add({
    id: 'instrument-cluster', ko: '계기판(12.3" 인스트루먼트 클러스터)', en: 'Instrument cluster (12.3")',
    groups: ['instrument-cluster'],
    object: group(
      rbox([0.035, 0.12, 0.33], [0.53, 0.887, -0.37], 'screen', { r: 0.008, rot: [0, 0, 0.2] }),
      // hood over the screen, overhanging the opening in the IP
      rbox([0.11, 0.026, 0.37], [0.54, 0.959, -0.37], 'leather', { r: 0.011 }),
      // mounting brackets from the cluster housing to the cross-car beam, either side of the column
      ...[-0.48, -0.215].map((z, i) => named(`bracket${i}`, beam([0.552, 0.872, z], [0.716, 0.753, z], 0.008, 'steel'))),
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
      // front closeouts (#3 LH / #4 RH): from the console sides forward under the IP to the toe board, flush
      // under the IP face and the HVAC case, outboard of the HVAC controller; behind them the floor and
      // console ducts come down from the HVAC case
      ...SIDES.map(({ sd, sg }) => named(`closeout${sd}`, group(
        quadPlate([[0.4, 0.311, sg * 0.13], [0.5, 0.311, sg * 0.175], [0.5, 0.452, sg * 0.175], [0.4, 0.43, sg * 0.13]], 0.004, 'blackPlastic'),
        quadPlate([[0.5, 0.311, sg * 0.175], [0.72, 0.311, sg * 0.175], [0.72, 0.442, sg * 0.175], [0.5, 0.452, sg * 0.175]], 0.004, 'blackPlastic'),
      ))),
      // front closeout panel (#14) from the front of the console top up to the lower edge of the IP centre face
      named('closeoutFront', quadPlate([[0.395, 0.43, -0.175], [0.395, 0.43, 0.175], [0.49, 0.452, 0.175], [0.49, 0.452, -0.175]], 0.004, 'blackPlastic')),
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
    object: group(plates([
      quadPlate([[0.95, 0.42, -0.74], [0.95, 0.42, 0.74], [0.72, 0.305, 0.76], [0.72, 0.305, -0.76]], 0.012, 'carpet'),
      quadPlate([[0.72, 0.305, -0.76], [0.72, 0.305, 0.76], [-0.68, 0.305, 0.76], [-0.68, 0.305, -0.76]], 0.012, 'carpet'),
      // riser at the rear edge of the floor up in front of the 2nd-row cushion, to above its front underside
      quadPlate([[-0.68, 0.305, -0.57], [-0.68, 0.305, 0.57], [-0.68, 0.5, 0.57], [-0.68, 0.5, -0.57]], 0.01, 'carpet'),
      // and turned back under the cushion's front edge, closing the gap to it
      quadPlate([[-0.675, 0.502, -0.565], [-0.675, 0.502, 0.565], [-0.708, 0.502, 0.565], [-0.708, 0.502, -0.565]], 0.004, 'carpet'),
    ], 'carpet'),
      // rear footwell outboard corners, beside the cushion: the riser continues out to the sill and a carpeted
      // closeout (heel-kick shelf) runs back from it at y 0.465 to the rear rail node and the wheelhouse, with
      // a return down to the sill top; the HV cable and coolant hose risers stay below it (energy.js)
      ...SIDES.map(({ sd, sg }) => named(`corner${sd}`, plates([
        // (notched at the sill for the cabin harness, which runs on under the scuff plate and this closeout)
        quadPlate([[-0.68, 0.305, sg * 0.57], [-0.68, 0.305, sg * 0.74], [-0.68, 0.465, sg * 0.74], [-0.68, 0.465, sg * 0.57]], 0.01, 'carpet'),
        quadPlate([[-0.68, 0.34, sg * 0.74], [-0.68, 0.34, sg * 0.772], [-0.68, 0.465, sg * 0.772], [-0.68, 0.465, sg * 0.74]], 0.01, 'carpet'),
        quadPlate([[-0.675, 0.465, sg * 0.565], [-0.935, 0.465, sg * 0.565], [-0.935, 0.465, sg * 0.772], [-0.675, 0.465, sg * 0.772]], 0.01, 'carpet'),
        // inner lip tucked against the cushion side, return down past the sill top
        quadPlate([[-0.675, 0.465, sg * 0.566], [-0.975, 0.465, sg * 0.566], [-0.975, 0.5, sg * 0.566], [-0.675, 0.5, sg * 0.566]], 0.004, 'carpet'),
        // beside the cushion, under the foot of the lower C-pillar trim, on to the rear rail node
        quadPlate([[-0.935, 0.465, sg * 0.565], [-0.975, 0.465, sg * 0.565], [-0.975, 0.465, sg * 0.6], [-0.935, 0.465, sg * 0.6]], 0.01, 'carpet'),
        quadPlate([[-0.675, 0.35, sg * 0.772], [-0.935, 0.35, sg * 0.772], [-0.935, 0.465, sg * 0.772], [-0.675, 0.465, sg * 0.772]], 0.004, 'carpet'),
      ], 'carpet'))),
    ),
  });
  reg.add({
    id: 'sound-insulation', ko: '실내 방음재(대시·휠하우스·트렁크)', en: 'Sound insulation (dash, wheelhouse, trunk)',
    groups: ['interior-sound-insulation'],
    object: group(
      named('dash', group(
        // dash insulator (#1 RH / #2 LH) on the bulkhead, up to the cowl
        quadPlate([[0.985, 0.4, -0.72], [0.985, 0.4, 0.72], [0.985, 0.8, 0.72], [0.985, 0.8, -0.72]], 0.02, 'foam'),
        quadPlate([[0.985, 0.8, -0.72], [0.985, 0.8, 0.72], [0.985, 0.86, 0.72], [0.985, 0.86, -0.72]], 0.02, 'foam'),
        // upper dash insulator under the cowl, up to the IP carrier's front edge (NVH, IP CARRIER: dash panel #12 = insulation #4)
        quadPlate([[0.99, 0.86, -0.54], [0.99, 0.86, 0.54], [0.9, 0.921, 0.54], [0.9, 0.921, -0.54]], 0.012, 'foam'),
      )),
      // trunk rear wall pad between the rear body panel and the trunk sill trim
      quadPlate([[-2.34, 0.64, -0.55], [-2.34, 0.64, 0.55], [-2.34, 0.75, 0.55], [-2.34, 0.75, -0.55]], 0.02, 'foam'),
    ),
  });

  // --- Door trims, pillars, headliner ------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    // Lower part (map pocket, speaker grille) on the door inner panel; the upper part (armrest bolster,
    // window-sill cap) stands further inboard, so the latch release cable runs behind it to the interior
    // handle mounted in it.  They cover the whole inner panel: from just above the sill (over the speaker
    // basket) up to the window sill and back over the latch to the shut face; the front door trim starts at
    // the IP end
    const doorTrim = (s0, s1, capEnd = s1) => [
      region([[s0, s1, 0.66, 1.62]], { side: sd, offset: -0.07, mat: 'leather', edges: false }),
      region([[s0, s1, 1.58, 2.99]], { side: sd, offset: -0.113, mat: 'leather', edges: false }),
      // window-sill cap from the top of the bolster out to the glass, over the top of the inner panel (rear doors: up
      // to the C-pillar trim behind the glass)
      skinStrip(sd, s0, capEnd, [2.99, -0.113], [3.02, -0.012], 'leather'),
    ];
    reg.add({
      id: `door-trim-${sd}F`, ko: `앞 도어 트림 패드 (${ko})`, en: `Front door trim pad ${en}`, tags: `${sd}F`,
      groups: ['front-door-trim-pad'],
      object: group(
        doorTrim(SV.frontDoor[0] + 0.03, SV.frontDoor[1] - 0.025),
        rbox([0.26, 0.04, 0.06], [0.0, 0.67, skinAt(sOf(0.0), 1.33, sd, -0.1).z], 'leather', { r: 0.015 }),
      ),
    });
    reg.add({
      id: `door-trim-${sd}B`, ko: `뒤 도어 트림 패드 (${ko})`, en: `Rear door trim pad ${en}`, tags: `${sd}B`,
      groups: ['rear-door-trim-pad'],
      object: group(
        doorTrim(SV.rearDoor[0] + 0.02, SV.rearDoor[1] - 0.025, SV.rearGlass[1] - 0.005),
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
        // (its outer edge ends behind the door seal on the door opening pinch flange, body-side-*#pinchFlange). Its foot
        // widens outboard down to the door seal's A-pillar run and turns down at its front edge onto the IP top / IP
        // end top (y 0.925), closing the A-pillar root above the IP end (hinge pillar top, drain tube, harness)
        named('aPillar', group(
          // (its door-side edge ends just under the door seal's top run, on the pinch flange)
          region([[SV.cowlRear + 0.02, SV.roof[0], 3.905, 4.07]], { side: sd, offset: -0.03, mat: 'fabric', edges: false }),
          // glass-side lip turned out to the windshield, closing the pillar section (drain tube, harness) from the cabin
          skinStrip(sd, SV.cowlRear + 0.02, SV.roof[0], [4.07, -0.03], [4.072, -0.006], 'fabric'),
          region([[SV.cowlRear + 0.02, 1.675, 3.0, 3.905]], {
            side: sd, offset: -0.03, mat: 'fabric', edges: false,
            field: (q, s, v) => 3.0 + (s - (SV.frontDoor[0] + 0.01)) * 18 + 0.02 - v, // edge tucked behind the door seal's A-pillar run
          }),
          (() => {
            const k = 12;
            const pos = [];
            const idx = [];
            for (let i = 0; i <= k; i++) {
              const p = skinAt(SV.cowlRear + 0.02, 3.0 + (1.07 * i) / k, sd, -0.03);
              pos.push(p.x, p.y, p.z, p.x, 0.925, p.z);
              if (i < k) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setIndex(idx);
            g.computeVertexNormals();
            return mesh(g, 'fabric');
          })(),
        )),
        named('bPillar', group(
          region([[b0, b1, 0.95, 1.85]], { side: sd, offset: -0.13, mat: 'greyPlastic', edges: false }),
          region([[b0, b1, 2.85, 4.0]], { side: sd, offset: -0.1, exclude: [[bm - 0.03, bm + 0.03, 3.27, 3.45]], mat: 'greyPlastic', edges: false }),
          // front and rear return flanges out to the door trims / door seals, so the trim wraps the pillar as a U
          // section (the belt webbing runs inside it): below, out to just short of the door trims' lower parts;
          // above the window-sill caps, out towards the door seals
          ...[b0, b1].flatMap((sx) => [
            vStrip(sd, sx, 0.95, 1.55, -0.13, -0.077, 'greyPlastic'),
            vStrip(sd, sx, 3.03, 3.95, -0.1, -0.035, 'greyPlastic'),
          ]),
          // foot of the lower trim down onto the scuff plate and the sill: covers the belt retractor, the pillar
          // impact sensor and the rear door harness rising from under the scuff plate into the pillar
          plates([
            [[-0.19, 0.337, 0.752], [-0.315, 0.337, 0.752], [-0.315, 0.483, 0.752], [-0.19, 0.483, 0.752]],
            // top, with the slot the belt webbing leaves the retractor through
            [[-0.19, 0.483, 0.752], [-0.315, 0.483, 0.752], [-0.315, 0.483, 0.872], [-0.19, 0.483, 0.872]],
            [[-0.19, 0.483, 0.872], [-0.235, 0.483, 0.872], [-0.235, 0.483, 0.898], [-0.19, 0.483, 0.898]],
            [[-0.257, 0.483, 0.872], [-0.315, 0.483, 0.872], [-0.315, 0.483, 0.898], [-0.257, 0.483, 0.898]],
            [[-0.19, 0.483, 0.898], [-0.315, 0.483, 0.898], [-0.315, 0.483, 0.908], [-0.19, 0.483, 0.908]],
            ...[-0.19, -0.315].flatMap((x) => [
              [[x, 0.337, 0.752], [x, 0.375, 0.772], [x, 0.483, 0.772], [x, 0.483, 0.752]],
              [[x, 0.362, 0.772], [x, 0.362, 0.908], [x, 0.483, 0.908], [x, 0.483, 0.772]],
            ]),
            // outboard face down onto the sill, just inside the pillar and the door trims, closing the foot round the
            // belt retractor and the pillar impact sensor; notched at its top for the rear door harness going into the
            // pillar
            [[-0.19, 0.362, 0.908], [-0.315, 0.362, 0.908], [-0.315, 0.455, 0.908], [-0.19, 0.455, 0.908]],
            [[-0.19, 0.455, 0.908], [-0.25, 0.455, 0.908], [-0.25, 0.483, 0.908], [-0.19, 0.483, 0.908]],
            [[-0.28, 0.455, 0.908], [-0.315, 0.455, 0.908], [-0.315, 0.483, 0.908], [-0.28, 0.483, 0.908]],
          ].map((c) => quadPlate(c.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'greyPlastic')), 'greyPlastic'),
        )),
        // ASY, A PILLAR TRIM LOWER (#8): kick panel on the outboard side of the front footwell, from the scuff plate
        // to the toe board corner and up to the lower edge of the IP side cover (LH: the hood release cable runs
        // inside the IP above it), over the cabin harness running down the toe board edge; its front flange is
        // clipped to the hinge pillar
        named('kickPanel', (() => {
          const xs = [0.75, 0.8, 0.85, 0.9, 0.928];
          const lerp = (pts, x) => {
            for (let i = 0; i + 1 < pts.length; i++) {
              const [x0, y0] = pts[i];
              const [x1, y1] = pts[i + 1];
              if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
            }
            return pts[pts.length - 1][1];
          };
          const bot = (x) => 0.305 + (x - 0.72) * 0.5 + 0.009; // on the toe board carpet
          const top = (x) => lerp(sd === 'L' ? IP_LH_KICK : IP_RH_OUT, x) - 0.003;
          const z = sg * 0.745;
          const list = [];
          for (let i = 0; i + 1 < xs.length; i++) {
            const [x0, x1] = [xs[i], xs[i + 1]];
            list.push(quadPlate([[x0, bot(x0), z], [x1, bot(x1), z], [x1, top(x1), z], [x0, top(x0), z]], 0.004, 'greyPlastic'));
          }
          // front flange against the hinge pillar, down to its foot
          list.push(quadPlate([[0.928, 0.47, z], [0.928, 0.4, sg * 0.79], [0.928, top(0.928), sg * 0.79], [0.928, top(0.928), z]], 0.004, 'greyPlastic'));
          // and its foot turned out over the harness down onto the sill top (no gap to see the harness through from the
          // door opening), continuing the scuff plate forward
          list.push(quadPlate([[0.75, 0.44, z], [0.928, 0.47, z], [0.928, 0.4, sg * 0.79], [0.75, 0.362, sg * 0.79]], 0.004, 'greyPlastic'));
          // front closeout from the flange forward to the edge of the dash insulator, closing the footwell corner in
          // front of the trim; the cabin harness passes it through a grommet-sized hole on its way from the dash
          // harness to behind the trim
          const cz = (x) => sg * (0.745 - ((x - 0.928) / 0.045) * 0.023);
          const [h0, h1] = [0.462, 0.497];
          list.push(quadPlate([[0.928, bot(0.928), cz(0.928)], [0.973, bot(0.973), cz(0.973)], [0.973, h0, cz(0.973)], [0.928, h0, cz(0.928)]], 0.004, 'greyPlastic'));
          list.push(quadPlate([[0.928, h1, cz(0.928)], [0.973, h1, cz(0.973)], [0.973, top(0.973), cz(0.973)], [0.928, top(0.928), cz(0.928)]], 0.004, 'greyPlastic'));
          return plates(list, 'greyPlastic');
        })()),
        // RH: removable fuse box cover of the footwell side trim, round the cabin fuse box (fusebox-cabin) under the IP
        // lower edge, from the trim's front back over the box and under it; open towards the bulkhead, where the lower
        // dash harness comes in to the box and the cabin harness leaves it
        ...(sd === 'R' ? [named('fuseCover', (() => {
          const [x0, x1, zi, zo, yb] = [0.748, 0.875, 0.572, 0.747, 0.425];
          const yt = (x) => {
            for (let i = 0; i + 1 < IP_RH_OUT.length; i++) {
              const [[a, ya], [b, yb2]] = [IP_RH_OUT[i], IP_RH_OUT[i + 1]];
              if (x <= b) return ya + ((x - a) / (b - a)) * (yb2 - ya) - 0.003;
            }
            return 0.7;
          };
          const xs = [x0, 0.8, x1];
          const q = (pts) => quadPlate(pts, 0.004, 'greyPlastic');
          return plates([
            ...xs.slice(0, -1).map((a, i) => q([[a, yb, zi], [xs[i + 1], yb, zi], [xs[i + 1], yt(xs[i + 1]), zi], [a, yt(a), zi]])),
            q([[x0, yb, zi], [x0, yb, zo], [x0, yt(x0), zo], [x0, yt(x0), zi]]),
            q([[x0, yb, zi], [x1, yb, zi], [x1, yb, zo], [x0, yb, zo]]),
          ], 'greyPlastic');
        })())] : []),
        // C-pillar trim behind the rear door glass, and behind it the ASY C-PILLAR TRIM MID (#22) on to the
        // trunk C-pillar trim, over the C-pillar reinforcement (which lies against the body side outer)
        // (their lower edges come down over the top of the lower C-pillar trim)
        named('cPillar', region([[SV.rearGlass[1], 3.67, 2.7, 4.05]], { side: sd, offset: -0.045, mat: 'fabric', edges: false })),
        named('cPillarMid', region([[3.67, 3.78, 2.7, 4.05]], { side: sd, offset: -0.045, mat: 'fabric', edges: false })),
        // trim clips (TRIM CLIP #11) on towers from their back faces to the C-pillar reinforcement: two under the mid
        // trim, and a bracket from the rear edge of the upper trim
        named('cPillarClips', group(
          skinClip(sd, 3.735, 3.55, -0.022, -0.0445),
          skinClip(sd, 3.775, 3.15, -0.022, -0.0445),
          ...[3.648, 3.664, 3.68, 3.696].map((cs) => skinClip(sd, cs, 3.8, -0.022, -0.0445, 'blackPlastic', 0.006)),
        )),
        // ASY C-PILLAR TRIM LWR (#19): covers the wheelhouse top beside the 2nd-row seat back, from the rear
        // door opening (behind the lock pillar and the cabin harness climbing against it) back to the shock
        // tower, up to the upper C-pillar trim and the parcel shelf.  Front face over the node and the rear
        // footwell closeout, inner face against the wheelhouse inner wall, top under the upper trim; the
        // C-pillar impact sensor is inside it, the C-pillar reinforcement outboard of it against the body side
        named('cPillarLower', (() => {
          const q = (pts) => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'greyPlastic');
          return plates([
            // front face just behind the rear door trim's armrest, on the footwell closeout and the sill top
            q([[-0.935, 0.465, 0.597], [-0.935, 0.465, 0.772], [-0.935, 0.975, 0.772], [-0.935, 0.975, 0.597]]),
            q([[-0.935, 0.36, 0.772], [-0.935, 0.36, 0.86], [-0.935, 0.81, 0.86], [-0.935, 0.81, 0.772]]),
            q([[-0.935, 0.81, 0.772], [-0.935, 0.81, 0.845], [-0.935, 0.975, 0.845], [-0.935, 0.975, 0.772]]),
            // outboard return to the shut face over the front of the wheelhouse arch, past the door armrest's
            // rear end and back to the rear door seal at the lock pillar; the cabin harness climbs over the arch
            // behind it
            q([[-0.935, 0.36, 0.86], [-0.99, 0.36, 0.905], [-0.99, 0.81, 0.905], [-0.935, 0.81, 0.86]]),
            ...[-0.99, -1.02, -1.06, -1.09].map((x0, i, a) => {
              const x1 = a[i + 1] ?? -1.12;
              const ay = (x) => 0.359 + Math.sqrt(Math.max(0, 0.44 ** 2 - (x + 1.425) ** 2));
              return q([[x0, ay(x0), 0.905], [x1, ay(x1), 0.905], [x1, 0.81, 0.905], [x0, 0.81, 0.905]]);
            }),
            // inner face against the wheelhouse inner wall, beside the seat back
            q([[-0.935, 0.555, 0.597], [-1.275, 0.555, 0.597], [-1.275, 0.975, 0.597], [-0.935, 0.975, 0.597]]),
            q([[-1.275, 0.625, 0.597], [-1.385, 0.625, 0.597], [-1.385, 0.975, 0.597], [-1.275, 0.975, 0.597]]),
            // top under the upper C-pillar trims back to the shock tower (where the trunk strut cover carries on), and
            // the rear end at the tower
            q([[-0.935, 0.975, 0.597], [-1.385, 0.975, 0.597], [-1.385, 0.975, 0.885], [-0.935, 0.975, 0.885]]),
            // its outer edge turned up behind the lower edges of the upper C-pillar trims
            q([[-0.99, 0.975, 0.884], [-1.385, 0.975, 0.884], [-1.385, 0.986, 0.884], [-0.99, 0.986, 0.884]]),
            q([[-1.385, 0.792, 0.735], [-1.385, 0.792, 0.885], [-1.385, 0.975, 0.885], [-1.385, 0.975, 0.735]]),
            // and between the seat back's side and the inner face, closing the slot in front of the shock tower
            q([[-1.382, 0.64, 0.558], [-1.382, 0.64, 0.597], [-1.382, 0.975, 0.597], [-1.382, 0.975, 0.558]]),
            // foot on the rail node top, out to the side of the cushion
            q([[-0.935, 0.553, 0.568], [-1.19, 0.553, 0.568], [-1.19, 0.553, 0.597], [-0.935, 0.553, 0.597]]),
          ], 'greyPlastic');
        })()),
      ),
    });
    reg.add({
      id: `trunk-side-trim-${sd}`, ko: `트렁크 사이드 트림 (${ko})`, en: `Trunk side finisher ${en}`, tags: sd,
      // the CHARGE PORT COVER (untagged row) is drawn on the LH finisher only, where the charge port is
      groups: ['trunk-carpet-and-side-finishers'],
      match: sd === 'L' ? /SIDE TRIM|BRKT|COVER,STRUT|COVER, STRUT|CHARGE PORT COVER/ : /SIDE TRIM|BRKT|COVER,STRUT|COVER, STRUT/,
      object: (() => {
        // the finisher wall stands at |z| ZP, inboard of the harnesses, ECUs and the charge cable behind it, from the
        // shock tower back to the liftgate opening (behind the liftgate drain); it comes down onto the wheelhouse
        // arch (covered by its hump) and the shelf behind it, and up to the parcel shelf (the RH rear subframe
        // harness drops behind it to its grommet in the shelf's outboard flange)
        const ZP = 0.868;
        const q = (pts, mat = 'carpet') => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, mat);
        const archY = (x) => 0.352 + Math.sqrt(0.44 ** 2 - (x + 1.425) ** 2);
        const st = [];
        for (const x of [-1.39, -1.45, -1.5, -1.55, -1.6, -1.65, -1.7]) st.push([x, archY(x) + 0.008]);
        st.push([-1.723, 0.684]);
        st.push([-1.95, 0.684], [-1.987, 0.675], [-2.115, 0.675]);
        // LH: cut out above for the charge port cover; behind the strut cover up to the lower edge of the trunk C-pillar trim
        const top = (x) => (sd === 'L' && x < -1.987 + 1e-6 ? 0.795 : (x < -1.6 && x > -2.05 ? 0.986 : 0.96));
        const wall = [];
        for (let i = 0; i + 1 < st.length; i++) {
          const [x0, y0] = st[i];
          const [x1, y1] = st[i + 1];
          if (x0 === x1) continue;
          const t = top((x0 + x1) / 2);
          wall.push(q([[x0, y0, ZP], [x1, y1, ZP], [x1, t, ZP], [x0, t, ZP]]));
        }
        // hump over the wheelhouse arch, outboard of the shock tower and behind it
        const hump = [];
        const hx = [-1.435, -1.5, -1.55, -1.585, -1.585, -1.65, -1.7, -1.723];
        for (let i = 0; i + 1 < hx.length; i++) {
          const [x0, x1] = [hx[i], hx[i + 1]];
          if (x0 === x1) continue;
          const zi = x0 > -1.585 ? 0.685 : 0.605;
          hump.push(q([[x0, archY(x0) + 0.012, zi], [x1, archY(x1) + 0.012, zi], [x1, archY(x1) + 0.012, ZP], [x0, archY(x0) + 0.012, ZP]]));
        }
        // lower edge onto the edge of the shelf over the back of the wheelhouse and of the rear corner shelf
        // behind it (trunk floor extension)
        const edge = [
          q([[-1.723, 0.679, 0.836], [-1.95, 0.679, 0.836], [-1.95, 0.682, ZP], [-1.723, 0.682, ZP]]),
          q([[-1.95, 0.679, 0.81], [-2.115, 0.679, 0.81], [-2.115, 0.677, ZP], [-1.95, 0.682, ZP]]),
        ];
        // rear end: returned inboard of the liftgate drain and closed to the quarter
        const rear = [
          q([[-2.115, 0.675, ZP], [-2.115, 0.675, 0.815], [-2.115, top(-2.1), 0.815], [-2.115, top(-2.1), ZP]]),
          q([[-2.115, 0.675, 0.815], [-2.14, 0.675, 0.81], [-2.14, top(-2.1), 0.81], [-2.115, top(-2.1), 0.815]]),
          q([[-2.14, 0.675, 0.81], [-2.14, 0.675, 0.915], [-2.14, top(-2.1), 0.915], [-2.14, top(-2.1), 0.81]]),
        ];
        // COVER,STRUT, TRUNK TRIM LH (#8) / RH (#9): carpeted box over the shock tower beside the seat back, from the
        // C-pillar lower trim back past the tower and from the load floor out to the finisher wall, just under the
        // parcel shelf; it houses the 2nd-row belt retractor on the tower's inner face in a bulge, whose top has
        // the webbing slot under the parcel shelf's belt notch
        const T = 0.9835;
        const [bf, br] = [-1.42, -1.515]; // retractor bulge front / rear
        const [sf, sr, si, so] = [-1.451, -1.477, 0.517, 0.543]; // webbing slot
        const strutCover = plates([
          // top, its front edge over the rear end of the C-pillar lower trim's top and turned down onto it
          q([[-1.37, T, 0.56], [bf, T, 0.56], [bf, T, 0.885], [-1.37, T, 0.885]]),
          q([[-1.37, 0.977, 0.56], [-1.37, 0.977, 0.885], [-1.37, T, 0.885], [-1.37, T, 0.56]]),
          q([[bf, T, 0.553], [-1.6, T, 0.553], [-1.6, T, 0.885], [bf, T, 0.885]]),
          ...[[bf, sf, 0.49, 0.553], [sr, br, 0.49, 0.553], [sf, sr, 0.49, si], [sf, sr, so, 0.553]]
            .map(([x0, x1, z0, z1]) => q([[x0, T, z0], [x1, T, z0], [x1, T, z1], [x0, T, z1]])),
          // inner face on the load floor, and the bulge round the retractor
          q([[-1.385, 0.625, 0.553], [-1.6, 0.625, 0.553], [-1.6, 0.86, 0.553], [-1.385, 0.86, 0.553]]),
          q([[bf, 0.86, 0.553], [-1.6, 0.86, 0.553], [-1.6, 0.89, 0.553], [bf, 0.89, 0.553]]),
          q([[-1.385, 0.86, 0.553], [bf, 0.86, 0.553], [bf, 0.86, 0.56], [-1.385, 0.86, 0.56]]),
          q([[br, 0.89, 0.553], [-1.6, 0.89, 0.553], [-1.6, T, 0.553], [br, T, 0.553]]),
          q([[bf, 0.89, 0.49], [br, 0.89, 0.49], [br, T, 0.49], [bf, T, 0.49]]),
          q([[bf, 0.89, 0.49], [br, 0.89, 0.49], [br, 0.89, 0.553], [bf, 0.89, 0.553]]),
          ...[bf, br].map((x) => q([[x, 0.89, 0.49], [x, 0.89, 0.553], [x, T, 0.553], [x, T, 0.49]])),
          // rear face behind the tower, down onto the load floor and the floor extension inboard of the wheelhouse
          // inner wall, and onto the arch hump outboard of it
          q([[-1.6, 0.645, 0.553], [-1.6, 0.68, 0.6], [-1.6, T, 0.6], [-1.6, T, 0.553]]),
          q([[-1.6, 0.77, 0.6], [-1.6, 0.77, 0.872], [-1.6, T, 0.872], [-1.6, T, 0.6]]),
          q([[-1.6, 0.958, 0.872], [-1.6, 0.958, 0.885], [-1.6, T, 0.885], [-1.6, T, 0.872]]),
          // outer lip down onto the top of the finisher wall
          q([[-1.385, 0.958, 0.872], [-1.6, 0.958, 0.872], [-1.6, T, 0.872], [-1.385, T, 0.872]]),
        ], 'carpet');
        return group(
          named('strutCover', strutCover),
          named('panel', plates([...wall, ...hump, ...rear], 'carpet')),
          // trunk bracket #6 (LH) / #7 (RH): stands on the wheelhouse and carries the finisher's lower edge
          named('bracket', bar([-1.838, 0.676, sg * 0.864], [-1.765, 0.614, sg * 0.864], 0.025, 0.04, 'steel')),
          named('lowerEdge', plates(edge, 'carpet')),
          // CHARGE PORT COVER: bulges inboard over the back of the charge port inlet and the cable's loop into it,
          // back to the rear closeout (the liftgate drain runs down inside it)
          ...(sd === 'L' ? [named('chargePortCover', plates([
            q([[-1.987, 0.795, 0.73], [-2.14, 0.795, 0.73], [-2.14, 0.97, 0.73], [-1.987, 0.97, 0.73]]),
            q([[-1.987, 0.795, 0.73], [-1.987, 0.795, ZP], [-1.987, 0.97, ZP], [-1.987, 0.97, 0.73]]),
            q([[-1.987, 0.97, 0.73], [-2.118, 0.97, 0.73], [-2.118, 0.97, ZP], [-1.987, 0.97, ZP]]),
            q([[-2.118, 0.97, 0.73], [-2.14, 0.97, 0.73], [-2.14, 0.97, 0.842], [-2.118, 0.97, 0.842]]),
            q([[-1.987, 0.795, 0.73], [-2.115, 0.795, 0.73], [-2.115, 0.795, ZP], [-1.987, 0.795, ZP]]),
            q([[-2.115, 0.795, 0.73], [-2.14, 0.795, 0.73], [-2.14, 0.795, 0.81], [-2.115, 0.795, 0.815]]),
            q([[-2.14, 0.795, 0.73], [-2.14, 0.795, 0.915], [-2.14, 0.96, 0.915], [-2.14, 0.96, 0.73]]),
          ], 'carpet'))] : []),
        );
      })(),
    });
    reg.add({
      id: `trunk-c-pillar-trim-${sd}`, ko: `트렁크 C필러 리어 트림 (${ko})`, en: `Trunk C-pillar rear trim ${en}`, tags: sd,
      groups: ['interior-trunk-trim-panels'], match: /C-PILLAR|C-PI|GARNISH|LIFTGATE SWITCH|BRKT|TROUGH|STOP, LIFTGATE|MAGNET/,
      object: group(
        // (its front edge down over the rear end of the lower C-pillar trim)
        region([[3.78, 4.42, 3.0, 4.0], [3.78, 3.85, 2.75, 3.0]], { side: sd, offset: -0.045, mat: 'greyPlastic', edges: false }),
        // on its BRKT C-PILLAR (#9 LH / #10 RH) and trim clip (#16) to the C-pillar reinforcement at its front edge
        named('clip', skinClip(sd, 3.8, 3.04, -0.022, -0.0445)),
      ),
    });
  }
  // the headliner dips under the two pano roof drive motors at the front of the roof opening
  // (the dip sits under the motor blocks bolted under the roof cassette, pano-drive, with side walls back up to the
  // headliner)
  const panoMotors = [2.36, 2.455, 4.165, 4.295];
  const pocketWalls = SIDES.flatMap(({ sd }) => {
    const [s0, s1, v0, v1] = panoMotors;
    return [
      ...[v0, v1].map((v) => skinStrip(sd, s0, s1, [v, -0.035], [v, -0.055], 'fabric')),
      ...[s0, s1].map((sx) => vStrip(sd, sx, v0, v1, -0.035, -0.055, 'fabric')),
    ];
  });
  reg.add({
    id: 'headliner', ko: '헤드라이닝', en: 'Headliner',
    groups: ['headlining'],
    object: group(
      // down behind the inner lips of the door seals over the door openings (closing the roof rails, with the curtain
      // airbags on them, from the cabin and the door openings);
      // over the roof it ends at the rear header, at the liftgate opening seal, and behind that it covers only the
      // C-pillar tops up over the liftgate seal
      region([[SV.roof[0] - 0.02, 3.3, 3.888, 5], [3.3, 3.72, 3.888, 3.995]], { offset: -0.035, exclude: [panoMotors], mat: 'fabric', edges: false }),
      region([panoMotors], { offset: -0.055, mat: 'fabric', edges: false }),
      ...pocketWalls,
      // (the rail between its edge and the body side skin is closed by the door opening pinch flange under the door
      // seals, body-side-*#pinchFlange)
    ),
  });
  reg.add({
    id: 'liftgate-trim', ko: '리프트게이트 실내 트림', en: 'Liftgate interior trim',
    groups: ['liftgate-interior-trim'],
    // cut out round the latch at the bottom edge; its side bands (side trims #13/#14) run from the headliner's C-pillar
    // top strip up to the glass edge, where a lip turns out to the glass and closes the frame from the cabin (the
    // liftgate harness runs behind it)
    object: group(
      region([[4.42, 4.93, 3.1, 5], [3.3, 4.42, 3.995, 4.12]], { offset: -0.035, exclude: [[4.865, 4.93, 4.76, 5]], mat: 'greyPlastic', edges: false }),
      named('lip', group(...SIDES.map(({ sd }) => skinStrip(sd, 3.305, 4.42, [4.118, -0.035], [4.118, -0.006], 'greyPlastic')))),
    ),
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
    // load floor carpet on the trunk floor, cut out round the folded 3rd-row seat (whose carpeted back lies
    // flush in the opening), and run forward to the foot of the 2nd-row seat back
    object: group(
      box([0.24, 0.02, 1.1], [-2.21, 0.635, 0], 'carpet'),
      box([0.354, 0.02, 1.1], [-1.483, 0.635, 0], 'carpet'),
      ...[-1, 1].map((sg) => box([0.44, 0.02, 0.095], [-1.875, 0.635, sg * 0.5025], 'carpet')),
      // beside the foot of the seat back out to the C-pillar lower trims, in front of the strut covers
      ...[-1, 1].map((sg) => box([0.12, 0.02, 0.045], [-1.36, 0.635, sg * 0.5725], 'carpet')),
      // side edges of the floor trim (#5): up the sloped flanges of the trunk floor extensions behind the strut
      // covers, turned up against the wheelhouse inner wall under the finisher's arch hump, and over the shelves
      // behind the wheelhouse and in the rear corners out to the finisher's lower edge (RH: round the subwoofer)
      ...[-1, 1].map((sg) => {
        const q = (pts) => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'carpet');
        const slope = (x0, x1) => q([[x0, 0.645, 0.55], [x1, 0.645, 0.55], [x1, 0.6835, 0.6], [x0, 0.6835, 0.6]]);
        const flat = (x0, x1, z0, z1) => q([[x0, 0.682, z0], [x1, 0.682, z0], [x1, 0.682, z1], [x0, 0.682, z1]]);
        const archY = (x) => 0.352 + Math.sqrt(0.44 ** 2 - (x + 1.425) ** 2) + 0.0135;
        const upturn = [[-1.6, -1.65], [-1.65, -1.7], [-1.7, -1.723]].flatMap(([x0, x1]) => [
          q([[x0, 0.681, 0.597], [x1, 0.681, 0.597], [x1, archY(x1), 0.597], [x0, archY(x0), 0.597]]),
          q([[x0, archY(x0), 0.595], [x1, archY(x1), 0.595], [x1, archY(x1), 0.604], [x0, archY(x0), 0.604]]),
        ]);
        return plates(sg < 0
          ? [slope(-1.6, -2.345), ...upturn, flat(-1.723, -1.95, 0.6, 0.834), flat(-1.95, -2.345, 0.6, 0.81)]
          : [slope(-1.6, -1.925), slope(-2.18, -2.345), ...upturn, flat(-1.723, -1.95, 0.6, 0.834),
            flat(-1.95, -2.18, 0.621, 0.81), flat(-2.18, -2.345, 0.6, 0.81)], 'carpet');
      }),
    ),
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
        // slide motor (#5) between the rails on its bracket (#19/#20), its flex drives (#6-#8) out to the
        // gearbox housings (#23) on the inner faces of the two rails
        named('slideMotor', group(
          cyl(0.02, 0.12, 'z', [0.05, 0.335, z], 'darkMetal'),
          ...[-1, 1].map((k) => cyl(0.005, 0.116, 'z', [0.05, 0.335, z + k * 0.1175], 'darkMetal')),
          ...[-1, 1].map((k) => box([0.03, 0.03, 0.012], [0.05, 0.335, z + k * 0.169], 'blackPlastic')),
        )),
        // lift / tilt motor (#14-#17) under the cushion pan
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
      // inside the outboard bolster of the seat back (side face at |z| SEAT.z + 0.25), not standing proud of it
      object: rbox([0.07, 0.3, 0.04], [SEAT.x - 0.33, 0.82, z + sg * 0.225], 'fabric', { r: 0.012, rot: [0, 0, 0.24] }),
    });
  }
  reg.add({
    id: 'pods', ko: '탑승자 감지 매트(PODS, 조수석)', en: 'Passenger occupant detection (PODS)', tags: 'R',
    groups: ['passenger-presence-detection'],
    object: group(
      box([0.38, 0.006, 0.36], [SEAT.x + 0.03 - 0.0485 * Math.sin(0.08), 0.445 + 0.0485 * Math.cos(0.08), SEAT.z], 'foam', [0, 0, 0.08]), // mat in the cushion foam 3.5 mm under the cover
      // PODS unit (#1) screwed (trim studs #2) under the cushion pan, flush with the cushion's underside
      (() => {
        const [c, s] = [Math.cos(0.08), Math.sin(0.08)];
        const [lx, ly] = [-0.16, -0.055 - 0.015 + 0.001];
        return rbox([0.08, 0.03, 0.06], [SEAT.x + 0.03 + lx * c - ly * s, 0.445 + lx * s + ly * c, SEAT.z], 'darkMetal', { r: 0.006, rot: [0, 0, 0.08] });
      })(),
    ),
  });
  const rearGroups = [
    '2nd-row-seat-assemblies-base-trim', '2nd-row-seat-assemblies-performance-trim',
    '2nd-row-seat-assemblies-premium-trim', '2nd-row-seat-assemblies-signature-trim', '2nd-row-seat-frame',
  ];
  const rx = REAR_SEAT.x;
  const REAR_BUCKLES = [-0.19, 0.165, 0.215]; // 2nd-row buckle positions (z)
  // underside of the cushion structure's pan (tilted 0.06 with the cushion), less a flange thickness
  const panUnder = (x) => 0.535 + (x - rx) * Math.tan(0.06) - 0.0665 / Math.cos(0.06) - 0.004;
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
      // pan of the cushion structure (ASY - CUSHION STRUCTURE 2nd SEAT, 2nd row seat frame #1) under the foam, from
      // just ahead of its front edge (under the carpet's turned-back lip) back over the chargers: closes the space under
      // the seat from above
      named('pan', (() => {
        const [c, s] = [Math.cos(0.06), Math.sin(0.06)];
        const at = (lx, ly, z) => [rx + lx * c - ly * s, 0.535 + lx * s + ly * c, z];
        return quadPlate([at(0.245, -0.0665, -0.49), at(0.245, -0.0665, 0.49), at(-0.2, -0.0665, 0.49), at(-0.2, -0.0665, -0.49)], 0.004, 'darkMetal');
      })()),
      // the cushion structure stands on two leg brackets at its outboard ends, bolted to the rear floor (BLT M10x22 /
      // M8x16) behind the coolant hose and HV cable holes: foot flange on the floor, upright web, top flange under the
      // pan's outboard edge
      named('legs', plates([-1, 1].flatMap((sg) => {
        const q = (pts) => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'steel');
        return [
          q([[-0.97, 0.379, 0.5], [-0.89, 0.379, 0.5], [-0.89, 0.379, 0.55], [-0.97, 0.379, 0.55]]),
          q([[-0.97, 0.377, 0.5], [-0.89, 0.377, 0.5], [-0.89, panUnder(-0.89), 0.5], [-0.97, panUnder(-0.97), 0.5]]),
          q([[-0.97, panUnder(-0.97), 0.45], [-0.89, panUnder(-0.89), 0.45], [-0.89, panUnder(-0.89), 0.502], [-0.97, panUnder(-0.97), 0.502]]),
        ];
      }), 'steel')),
      // and its rear tube's end brackets on the rear seat crossmember over the rail fronts: top flange under the pan, web,
      // foot on the crossmember
      ...SIDES.map(({ sd, sg }) => named(`rearBracket${sd}`, (() => {
        const q = (pts) => quadPlate(pts.map(([x, y, z]) => [x, y, sg * z]), 0.004, 'steel');
        const railY = (x) => 0.437 - (x + 1.116) * 0.263 + 0.001;
        return plates([
          q([[-1.14, panUnder(-1.14), 0.47], [-1.1, panUnder(-1.1), 0.47], [-1.1, panUnder(-1.1), 0.494], [-1.14, panUnder(-1.14), 0.494]]),
          q([[-1.14, railY(-1.14), 0.492], [-1.1, railY(-1.1), 0.492], [-1.1, panUnder(-1.1), 0.492], [-1.14, panUnder(-1.14), 0.492]]),
          q([[-1.14, railY(-1.14), 0.49], [-1.1, railY(-1.1), 0.49], [-1.1, railY(-1.1), 0.52], [-1.14, railY(-1.14), 0.52]]),
        ], 'steel');
      })())),
      // buckle brackets on the rear tube (the nut brackets the 2nd-row buckles are bolted to), rising from the pan's
      // rear edge to the buckle eyes inside the cushion
      named('buckleBrackets', plates(REAR_BUCKLES.map((z) => quadPlate([[-1.13, 0.4575, z - 0.012], [-1.13, 0.4575, z + 0.012],
        [-1.13, 0.546, z + 0.012], [-1.13, 0.546, z - 0.012]], 0.004, 'steel')), 'steel')),
      // the cushion cover's rear flap rises back under the seat backs' lower edge and is pinched against it, out to the
      // lower C-pillar trims, closing the crease from below (the body kick-up between the seat crossmember and the
      // trunk front floor is not drawn: the large rear drive unit's inverter and motor fill that space up to 13 mm
      // under the flap)
      named('rearFlap', quadPlate([[-1.165, 0.561, -0.567], [-1.165, 0.561, 0.567], [-1.258, 0.574, 0.567], [-1.258, 0.574, -0.567]], 0.004, 'carpet')),
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
    // shown stowed, folded flat (the parcel shelf can only be fitted with the 3rd row folded): the seat back
    // folded down over the cushion, its carpeted back panel flush with the load floor in the trunk carpet's
    // cut-out and the head restraints folded flat on it; drawn without the floor well the real seat folds into, as
    // a slab lying on the trunk floor, its pivot brackets (bolted to the floor, #6/#5) not drawn separately but inside it
    object: group(
      named('seat', rbox([0.42, 0.024, 0.9], [-1.875, 0.632, 0], 'carpet', { r: 0.006 })),
      ...[-0.2, 0.2].map((z) => rbox([0.12, 0.012, 0.18], [-2.02, 0.647, z], 'leather', { r: 0.005 })),
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
        // buckle switch (#3 LH / #4 RH) on its short stalk strap, bolted to the inboard side of the seat cushion frame
        named('buckle', group(
          rbox([0.05, 0.12, 0.03], [SEAT.x - 0.2, 0.5, sg * (SEAT.z - 0.27)], 'blackPlastic', { r: 0.008 }),
          quadPlate([[SEAT.x - 0.212, 0.446, sg * 0.1], [SEAT.x - 0.188, 0.446, sg * 0.1],
            [SEAT.x - 0.168, 0.425, sg * 0.1215], [SEAT.x - 0.192, 0.425, sg * 0.1215]], 0.004, 'blackPlastic'),
        )),
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
      // the three buckles (#4, each bolted with its #5): a single one LH outboard and a pair (centre and RH outboard),
      // each a compact head with its bolt eye at the base on a bracket of the cushion structure's rear tube, standing
      // up through the two slots at the rear edge of the cushion cover
      ...REAR_BUCKLES.map((z, i) => named(`buckle${i}`, rbox([0.04, 0.1, 0.03], [-1.13, 0.59, z], 'blackPlastic', { r: 0.008 }))),
    ),
  });
  // 3rd row harness belts anchored on the (folded) seat back, stowed flat on it
  reg.add({
    id: 'third-row-belts', ko: '3열 안전벨트', en: '3rd row seat belts',
    groups: ['3rd-row-seat-belts'],
    object: group(
      ...[-1, 1].flatMap((sg) => [
        rbox([0.06, 0.012, 0.05], [-2.05, 0.65, sg * 0.4], 'blackPlastic', { r: 0.004 }),
        tube([[-2.04, 0.65, sg * 0.4], [-1.87, 0.65, sg * 0.34], [-1.7, 0.65, sg * 0.12]], 0.006, 'fabric'),
      ]),
    ),
  });

  // --- Airbags ---------------------------------------------------------------------
  reg.add({
    id: 'driver-airbag', ko: '운전석 에어백(스티어링 휠)', en: 'Driver airbag (steering wheel)', tags: 'L',
    groups: ['front-air-bags'], match: /DRIVER AIRBAG|DAB|STEERING CONTROL|CONNECTOR/,
    // in the hub cavity on the driver's side, square to the wheel and its column (STEER, chassis.js)
    object: (() => {
      const m = mesh(new THREE.CylinderGeometry(0.07, 0.074, 0.03, 28), 'leather');
      m.rotation.set(0, 0, Math.PI / 2 - STEER.tilt);
      m.position.set(...STEER.at(0, 0, -0.016));
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
    // CURTAIN AIRBAG ASSY (#1 LH / #2 RH): the folded bag (24 mm) runs along the roof rail above both door
    // openings, against the body side inner (clipped to the rail, CLIP M6 #*), hidden behind the headliner, whose
    // edge comes down behind the door seals and folds over the rail flange above them. Its narrower front end
    // (16 mm) runs down the A-pillar behind the pillar trim, between the door seal and the headliner harness (LH),
    // and its front tether strap carries on down the pillar, beside the drain tube (v 4.03), to above the tweeter pocket. Its
    // thin rear end (8 mm) drops behind the headliner, between the rear door seal and the liftgate opening seal,
    // and ends at the rear edge of the rear door glass.
    const bagPts = [[2.38, 4.0], [2.49, 4.0], [2.6, 4.0], [2.75, 4.0], [2.9, 4.0], [3.05, 4.0], [3.15, 3.998], [3.24, 3.993]]
      .map(([s, v]) => skinAt(s, v, sd, -0.0145));
    // (its first point pressed outboard onto the pillar: the tether's top is sewn under the bag's front end)
    const frontPts = [[2.06, 3.98, -0.0095], [2.14, 3.98], [2.22, 3.98], [2.3, 3.982], [2.36, 3.99], [2.42, 4.0]].map(([s, v, o = -0.012]) => skinAt(s, v, sd, o));
    const rearPts = [[3.17, 3.995, -0.0145], [3.22, 3.975, -0.022], [3.26, 3.945, -0.029], [3.3, 3.93, -0.03], [3.4, 3.93, -0.03], [3.48, 3.93, -0.03]]
      .map(([s, v, o]) => skinAt(s, v, sd, o));
    reg.add({
      id: `curtain-airbag-${sd}`, ko: `커튼 에어백 (${ko})`, en: `Curtain airbag ${en}`, tags: sd,
      groups: ['side-air-bags'], match: /CURTAIN/,
      object: group(
        named('bag', group(
          tube(bagPts, 0.012, 'fabric'), tube(frontPts, 0.008, 'fabric'), tube(rearPts, 0.004, 'fabric'),
          // mounting tabs on the M6 clips in the roof rail
          ...[[2.27, 3.982], [2.5, 4.0], [2.68, 4.0], [2.92, 4.0], [3.12, 3.994]].map(([s, v]) => {
            const p = skinAt(s, v, sd, -0.0065);
            return faceTo(cyl(0.007, 0.01, 'y', [0, 0, 0], 'blackPlastic'), p, skinAt(s, v, sd, 0).sub(p), 'y');
          }),
        )),
        named('tether', region([[1.75, 2.08, 3.955, 3.99]], { side: sd, offset: -0.0015, mat: 'fabric', edges: false })),
      ),
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
      // sensing system (#9): its tube clipped along the front edge of the bumper beam, in the energy absorber
      named('sensor', tube([[2.39, 0.47, -0.6], [2.425, 0.47, -0.3], [2.432, 0.47, 0], [2.425, 0.47, 0.3], [2.39, 0.47, 0.6]], 0.008, 'darkMetal')),
      // hood actuators (#7) under the rear of the hood hinges, which they lift: the cylinder stands just inboard of the
      // shotgun rail's inner face, its plunger under the hinge's inboard flange, and its own horizontal flange (no
      // bracket) lies on the rail top beside the hinge's body leaf, bolted from above with 2 vertical bolts (#8 BLT HF M6x20)
      ...SIDES.map(({ sd, sg }) => named(`actuator${sd}`, group(
        cyl(0.02, 0.06, 'y', [1.03, 0.862, sg * 0.715], 'darkMetal'),
        named(`flange${sd}`, box([0.03, 0.004, 0.044], [1.03, 0.879, sg * 0.735], 'steel')),
      ))),
    ),
  });
  void bar; void beam; void V;
}
