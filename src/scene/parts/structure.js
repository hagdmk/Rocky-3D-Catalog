// Body structure, bumper systems, under-hood trim, aero shields, frunk.

import * as THREE from 'three';
import {
  X_FRONT_AXLE as XF, X_REAR_AXLE as XR, WHEEL_Y as WY, ARCH_RADIUS, topY, sOf,
} from '../profile.js';
import {
  V, group, named, hollow, rbox, box, cyl, beam, bar, tube, mesh, quadPlate, faceTo, plates,
} from '../geom.js';
import { skinAt, skinNormal } from '../body.js';
import { region } from './exterior.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

/** Half-cylinder wheelhouse shell around an axle. */
function wheelhouse(x, sg, rIn, z0, z1, mat, a0 = -0.15, a1 = Math.PI + 0.15, seg = 36) {
  // Angles a0..a1 are measured in the side view from +x (forward), CCW.
  // CylinderGeometry places theta=0 on +z; after rotateX(90deg) that maps to
  // the angle a = theta - 90deg in the x/y plane.
  const g = new THREE.CylinderGeometry(rIn, rIn, Math.abs(z1 - z0), seg, 1, true, a0 + Math.PI / 2, a1 - a0);
  g.rotateX(Math.PI / 2);
  const m = mesh(g, mat);
  m.position.set(x, WY, sg * (Math.abs(z0) + Math.abs(z1)) / 2);
  return m;
}

// The rear rail node (rear-rail-*#node) fills the front lower corner of the rear wheelhouse
// inboard of z = NODE_Z1; the arch there starts on the node top (y 0.55), angle NODE_A at the
// wheelhouse radius and NODE_A_LINER at the arch liner radius.
const NODE_Z1 = 0.72;
const NODE_TOP = 0.55;
const NODE_A = Math.asin((NODE_TOP - WY) / (ARCH_RADIUS + 0.035));
const NODE_A_LINER = Math.asin((NODE_TOP - WY) / (ARCH_RADIUS + 0.012));

// The rear shock tower (x XR-0.16 .. XR+0.04, |z| 0.56 .. 0.68) stands in an opening of the
// wheelhouse and of the arch liner, through which the strut rises into it.
const TOWER_Z1 = 0.68;
const towerA = (r) => [Math.acos(0.04 / r), Math.acos(-0.16 / r)];

// Rear wheelhouse arch (inside radius of the band) and the top of the rear rail beneath it.
const RW = ARCH_RADIUS + 0.035;
const archTop = (x) => WY + Math.sqrt(Math.max(0, RW * RW - (x - XR) ** 2));
const arcPts = (x0, x1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const x = x0 + ((x1 - x0) * i) / n;
  return [x, archTop(x)];
});
const railTop = (x) => 0.425 + ((x + 1.25) / -1.05) * 0.025 + 0.045;
// Trunk floor extension: outboard edge on the wheelhouse inner wall (|z| 0.6) at this height, and
// the shelf from there over the low rear part of the arch.
const SHELF_Y = 0.676;
const SHELF_X0 = XR - Math.sqrt(RW * RW - (SHELF_Y - WY) ** 2); // where the arch drops below the shelf

/** Flat sheet in the plane z through the side-view outline pts [[x, y], ...]. */
function zPlate(z, pts, mat) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  g.translate(0, 0, z);
  return mesh(g, mat);
}

/**
 * Wheelhouse strip made of the angle ranges [[aS, aE], ...] of the full strip a0..a1: the facets
 * stay on the 36-segment grid of the full strip (short facets at the cut ends).
 */
function archStrip(x, sg, rIn, z0, z1, mat, a0, a1, ranges) {
  const d = (a1 - a0) / 36;
  const out = [];
  for (const [aS, aE] of ranges) {
    const ks = Math.ceil((aS - a0) / d - 1e-9);
    const ke = Math.floor((aE - a0) / d + 1e-9);
    if (ke <= ks) { out.push(wheelhouse(x, sg, rIn, z0, z1, mat, aS, aE, 1)); continue; }
    const gs = a0 + ks * d;
    const ge = a0 + ke * d;
    if (gs - aS > 1e-3) out.push(wheelhouse(x, sg, rIn, z0, z1, mat, aS, gs, 1));
    out.push(wheelhouse(x, sg, rIn, z0, z1, mat, gs, ge, ke - ks));
    if (aE - ge > 1e-3) out.push(wheelhouse(x, sg, rIn, z0, z1, mat, ge, aE, 1));
  }
  return out;
}

/** Rear wheelhouse or arch liner: inboard strips trimmed at the node and open under the tower. */
function rearArch(sg, rIn, zIn, zOut, mat, a0, a1, aNode) {
  const [aF, aR] = towerA(rIn);
  return [
    ...archStrip(XR, sg, rIn, zIn, TOWER_Z1, mat, a0, a1, [[aNode, aF], [aR, a1]]),
    ...archStrip(XR, sg, rIn, TOWER_Z1, NODE_Z1, mat, a0, a1, [[aNode, a1]]),
    wheelhouse(XR, sg, rIn, NODE_Z1, zOut, mat, a0, a1),
  ];
}

// C-pillar reinforcement (quarter inner #23/#24): a 50 x 22 mm section bonded to the inside of the body
// side outer (its outer face 2.5 mm inside the skin, 4 mm round the tight shoulder), from the top of the
// wheelhouse arch up the quarter, round the shoulder and up the C-pillar to the roof rail; (s, v) skin
// stations of its centre line and its inset.
const C_PILLAR_SV = [[3.895, 0.45], [3.87, 1.0], [3.845, 1.5], [3.83, 1.85], [3.83, 1.98, 0.015], [3.83, 2.12, 0.015],
  [3.83, 2.26, 0.015], [3.83, 2.4, 0.015], [3.826, 2.65], [3.805, 2.9], [3.784, 3.1], [3.763, 3.3], [3.746, 3.45],
  [3.728, 3.6], [3.711, 3.73], [3.695, 3.86]];
function cPillarReinf(sd) {
  const P = C_PILLAR_SV.map(([s, v, d = 0.0135]) => skinAt(s, v, sd, -d));
  const N = C_PILLAR_SV.map(([s, v]) => {
    const n = skinNormal(s, v);
    if (sd === 'R') n.z = -n.z;
    return n;
  });
  // each segment square to the skin: its thickness along the mean normal of its two stations
  return group(...P.slice(1).map((p, i) => {
    const m = bar(P[i], p, 0.05, 0.022, 'aluminum');
    const y = new THREE.Vector3().subVectors(p, P[i]).normalize();
    const n = N[i].clone().add(N[i + 1]);
    const z = n.addScaledVector(y, -n.dot(y)).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
    return m;
  }));
}

/** Skin parameter v on the body side (v 0..3) where the outer skin at station s is at height y. */
function vAtY(s, y) {
  let lo = 0;
  let hi = 3;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (skinAt(s, m).y < y) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Weld flange of an inner panel that lies `depth` inside the body side outer: a strip square to the
 * skin from the panel edge out to the skin, along the edge polyline [[s, y], ...] (outer-skin heights).
 */
function skinFlange(sd, path, depth, mat, step = 0.02) {
  const pts = [];
  for (let k = 0; k < path.length - 1; k++) {
    const [sa, ya] = path[k];
    const [sb, yb] = path[k + 1];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(sb - sa), Math.abs(yb - ya)) / step));
    for (let i = k ? 1 : 0; i <= n; i++) pts.push([sa + ((sb - sa) * i) / n, ya + ((yb - ya) * i) / n]);
  }
  const pos = [];
  for (const [ps, py] of pts) {
    const v = vAtY(ps, py);
    pos.push(...skinAt(ps, v, sd, -depth).toArray(), ...skinAt(ps, v, sd, 0).toArray());
  }
  const idx = [];
  for (let i = 0; i < pts.length - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 3, 2 * i, 2 * i + 3, 2 * i + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
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
      // The shotgun, the tower extension and the tower brace all run under the side and rear
      // underhood aprons (the shock tower cover sits on the tower top); the shotgun and the
      // extension pass above the wheel arch liner.
      object: group(
        named('rail', bar([2.26, 0.47, sg * 0.5], [1.02, 0.42, sg * 0.5], 0.08, 0.12, 'aluminum')),
        // shock tower casting: top, inboard, front and rear walls (6 mm plates); open below and toward
        // the wheel, where the strut, the knuckle neck and the upper arm enter it.  The brake hose,
        // the hood strut and the hood release cable stay outside the walls (hose and strut brackets
        // on the rear face, cable inboard of and behind the tower).
        named('tower', group(
          box([0.26, 0.006, 0.2], [XF - 0.05, 0.847, sg * 0.6], 'aluminum'),
          box([0.26, 0.3, 0.006], [XF - 0.05, 0.7, sg * 0.503], 'aluminum'),
          ...[XF + 0.077, XF - 0.177].map((x) => box([0.006, 0.3, 0.2], [x, 0.7, sg * 0.6], 'aluminum')),
        )),
        // shotgun upper #3/#4: from the front of the wheelhouse up to the hinge pillar front face
        bar([1.85, 0.758, sg * 0.72], [0.98, 0.863, sg * 0.785], 0.04, 0.07, 'aluminum'),
        // shock tower extension #7/#8: from the front face of the tower to the front of the shotgun
        bar([XF + 0.08, 0.79, sg * 0.69], [1.85, 0.758, sg * 0.72], 0.04, 0.05, 'aluminum'),
        // tower brace member #9/#10: from the rear face of the tower top to the shock tower crossmember
        named('towerBrace', bar([XF - 0.18, 0.812, sg * 0.51], [1.02, 0.835, sg * 0.32], 0.05, 0.04, 'aluminum')),
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
      // ends at the front face of the rear wheelhouse (the node closeout ties it to the rear rail)
      object: bar([1.12, 0.3, sg * 0.86], [-0.985, 0.3, sg * 0.86], 0.12, 0.17, 'aluminum'),
    });
  }

  // --- Pillars and floor (body side panels) ------------------------------------------
  // Inner closed sections behind the body side outer skin: the door hinges, strikers and
  // seals sit on them.  Hinge pillar (#5, with the cowl side #6) from the sill up to the
  // shotgun rail; B-pillar (A/B pillar comp #13, belt mount #12) on the sill between the doors.
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `hinge-pillar-${sd}`, ko: `힌지 필러·카울 사이드 (${ko})`, en: `Hinge pillar & cowl side ${en}`, tags: sd,
      groups: ['body-side-panels'], match: /HINGE PILLAR|COWL SIDE/,
      // closed section: the door harness and the roof drain run inside it.  Its top stays under
      // the fender / cowl skin; at the rear inboard corner it rises into the A-pillar root,
      // under the body side outer A-pillar (#7).
      object: hollow(group(
        rbox([0.11, 0.598, 0.16], [0.93, 0.629, sg * 0.87], 'aluminum', { r: 0.015 }),
        rbox([0.025, 0.04, 0.07], [0.8875, 0.935, sg * 0.83], 'aluminum', { r: 0.006 }),
      )),
    });
    reg.add({
      id: `b-pillar-${sd}`, ko: `B필러 (${ko})`, en: `B-pillar ${en}`, tags: sd,
      groups: ['body-side-panels'], match: /A \/ B PILLAR|SEAT BELT ATTACH|CARRIER, BODY SIDE B-PILLAR/,
      object: group(
        // closed section between the door shut faces (x -0.205 / -0.275): the front door inner panel
        // ends at its front face, the rear door hinges are bolted to its rear face, and the rear door
        // harness runs through it (PASS_OK in src/scene/joints.js)
        named('lower', rbox([0.07, 0.62, 0.042], [-0.24, 0.65, sg * 0.933], 'aluminum', { r: 0.008 })),
        named('upper', region([[2.69, 2.76, 2.0, 3.75]], { side: sd, offset: -0.05, mat: 'aluminum', edges: false })),
        // applique carriers (#10 front upper, #11 rear upper), between the two door seals
        named('carriers', group([3.2, 3.5].map((v) => {
          const n = skinNormal(2.728, v);
          if (sd === 'R') n.z = -n.z;
          return faceTo(rbox([0.012, 0.05, 0.05], [0, 0, 0], 'blackPlastic', { r: 0.004 }), skinAt(2.728, v, sd, -0.0245), n, 'z');
        }))),
      ),
    });
  }
  // Body in white between the sides: the floor pan between the sills (the seat tracks bolt to it)
  // and the cowl plenum panel between the cowl sides, the cowl top ahead of the windshield base on
  // top of the upper dash insulator, under the wiper module and the cowl screen (behind the hood
  // hinges, its front edge under the rear underhood apron).
  const plenumN = new THREE.Vector2(0.061, 0.09).normalize(); // upper dash insulator plane normal
  const plenumAt = (x, z, off = 0.0085) => {
    const t = (0.99 - x) / 0.09; // along the insulator from (0.99, 0.86) to (0.9, 0.921)
    return [0.99 - 0.09 * t + plenumN.x * off, 0.86 + 0.061 * t + plenumN.y * off, z];
  };
  // The pan and the toe board end at the sills' inner faces (|z| 0.775), where their flanges are welded to
  // the sill inner walls.
  reg.add({
    id: 'floor-pan', ko: '차체(BIW): 플로어 팬·카울 플레넘', en: 'Body in white: floor pan & cowl plenum',
    groups: ['body-side-panels'], match: /BODY IN WHITE/,
    object: group(
      quadPlate([[0.72, 0.296, -0.775], [0.72, 0.296, 0.775], [-0.7, 0.296, 0.775], [-0.7, 0.296, -0.775]], 0.004, 'aluminum'),
      named('toeBoard', quadPlate([[0.97, 0.41, -0.775], [0.97, 0.41, 0.775], [0.72, 0.296, 0.775], [0.72, 0.296, -0.775]], 0.004, 'aluminum')),
      // dash panel corners: the bulkhead outboard of the dash insulator (|z| 0.72) out to the hinge pillars
      // (|z| 0.79), from the toe board up under the shotgun rail ends and the plenum.  LH: notched at its
      // inboard edge for the hood release cable grommet (hood-latch#grommet)
      named('dashCorners', (() => {
        const P = (sg, y0, y1, z0, z1) => quadPlate([[0.985, y0, sg * z0], [0.985, y0, sg * z1], [0.985, y1, sg * z1], [0.985, y1, sg * z0]], 0.004, 'aluminum');
        return plates(SIDES.flatMap(({ sd, sg }) => [
          ...(sd === 'L'
            ? [P(sg, 0.4, 0.6379, 0.72, 0.79), P(sg, 0.6379, 0.6509, 0.733, 0.79), P(sg, 0.6509, 0.843, 0.72, 0.79)]
            : [P(sg, 0.4, 0.843, 0.72, 0.79)]),
          P(sg, 0.843, 0.868, 0.72, 0.75),
        ]), 'aluminum');
      })()),
      // dash panel upper edge (cowl front wall) in front of the dash insulator, under the plenum front edge,
      // outboard of the insulator's upper strip (|z| 0.54) to the shotgun rail ends: the hood hinges are
      // bolted to it (hood-hinge-*#base)
      named('cowlFront', plates(SIDES.map(({ sg }) => quadPlate([[0.997, 0.8, sg * 0.54], [0.997, 0.8, sg * 0.75], [0.997, 0.867, sg * 0.75], [0.997, 0.867, sg * 0.54]], 0.004, 'aluminum')), 'aluminum')),
      // between the hinge pillars (|z| 0.79); its outboard front corners stop short of the shotgun
      // rail ends (x 0.975, |z| 0.75-0.82)
      // rear floor under the 2nd-row seat: a heel kick up from the floor pan's rear edge to the seat floor on the
      // battery pack's rear hump (y 0.375), on which the chargers and the HV junction box stand and into which the
      // cushion frame hooks clip, back to the rear rail nodes, inboard of the body harnesses along the sills (under the
      // carpeted corner closeouts); holes where the RH HV cable to the front and the LH coolant hose to the charger
      // come up through it
      named('rearFloor', (() => {
        const Y = 0.376;
        const R = (x0, x1, z0, z1) => quadPlate([[x0, Y, z0], [x0, Y, z1], [x1, Y, z1], [x1, Y, z0]], 0.002, 'aluminum');
        return plates([
          quadPlate([[-0.703, 0.294, -0.745], [-0.703, 0.294, 0.745], [-0.703, Y + 0.001, 0.745], [-0.703, Y + 0.001, -0.745]], 0.003, 'aluminum'),
          R(-0.703, -0.98, -0.48, 0.48),
          // LH outboard part, round the coolant hose (pumpToCharger) at (-0.86, -0.525)
          R(-0.703, -0.84, -0.745, -0.48), R(-0.84, -0.88, -0.745, -0.555), R(-0.84, -0.88, -0.5, -0.48), R(-0.88, -0.973, -0.745, -0.48),
          // RH outboard part, round the HV cable to the front (hv-cable-front) at (-0.747, 0.613)
          R(-0.703, -0.722, 0.48, 0.745), R(-0.722, -0.772, 0.48, 0.58), R(-0.722, -0.772, 0.648, 0.745), R(-0.772, -0.973, 0.48, 0.745),
        ], 'aluminum');
      })()),
      // rear seat crossmember across the rear rail fronts (on their tops), under the rear edge of the cushion and
      // above the HV cables and hoses to the rear drive unit: the 2nd-row buckles are bolted to it
      named('seatCrossmember', quadPlate([[-1.085, 0.4285, -0.55], [-1.085, 0.4285, 0.55], [-1.15, 0.4455, 0.55], [-1.15, 0.4455, -0.55]], 0.004, 'aluminum')),
      named('plenum', plates([
        quadPlate([plenumAt(0.99, -0.74), plenumAt(0.99, 0.74), plenumAt(0.905, 0.74), plenumAt(0.905, -0.74)], 0.003, 'aluminum'),
        ...SIDES.map(({ sg }) => quadPlate([plenumAt(0.965, sg * 0.74), plenumAt(0.965, sg * 0.79), plenumAt(0.905, sg * 0.79), plenumAt(0.905, sg * 0.74)], 0.003, 'aluminum')),
      ], 'aluminum')),
    ),
  });

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
        // node closeout panel (#8/#11): node to the sill end, in front of the wheelhouse and behind
        // the coolant hose that turns inboard there
        named('closeout', rbox([0.022, 0.08, 0.07], [-0.979, 0.33, sg * 0.755], 'aluminum', { r: 0.006 })),
      ),
    });
    reg.add({
      id: `rear-quarter-inner-${sd}`, ko: `리어 휠하우스·쿼터 인너 (${ko})`, en: `Rear wheelhouse & quarter inner ${en}`, tags: sd,
      groups: ['rear-quarter-inner-panels'], match: /^(?!.*EXTENSION RR TRUNK FLOOR)/,
      object: group(
        // wheelhouse: inboard of the closeout its front lower corner is the rear rail node
        // (rear-rail-*#node), so that strip of the arch starts on top of the node; the shock
        // tower stands in its opening
        ...rearArch(sg, ARCH_RADIUS + 0.035, 0.6, 0.95, 'aluminum', -0.15, Math.PI + 0.15, NODE_A),
        // shock tower: top and four walls (6 mm plates), open below where the strut rises into it
        named('tower', group(
          box([0.2, 0.006, 0.12], [XR - 0.06, 0.977, sg * 0.62], 'aluminum'),
          ...[0.563, 0.677].map((z) => box([0.2, 0.32, 0.006], [XR - 0.06, 0.82, sg * z], 'aluminum')),
          ...[XR + 0.037, XR - 0.157].map((x) => box([0.006, 0.32, 0.12], [x, 0.82, sg * 0.62], 'aluminum')),
        )),
        // wheelhouse inner wall (trunk side of the REAR WHEELHOUSE ASSY, rear end panels #20/#21; quarter
        // inner #1/#2 are the outer arch panels) under the arch band at |z| 0.6,
        // ahead of and behind the shock tower: on the rail node in front (stepped up over the upper
        // link and the air line behind the node) and on the rail behind; open only under the tower
        named('innerWall', plates([
          zPlate(sg * 0.6, [...arcPts(-1.032, XR + 0.04), [XR + 0.04, 0.6], [-1.335, 0.6], [-1.29, 0.545], [-1.032, 0.545]], 'aluminum'),
          zPlate(sg * 0.6, [...arcPts(XR - 0.16, -1.845), ...[-1.845, -1.7, XR - 0.16].map((x) => [x, railTop(x) - 0.003])], 'aluminum'),
        ], 'aluminum')),
        // rear quarter inner panel (#13/#14 ASSY - RR QTR INR) behind the trunk side trim, 30 mm inside
        // the body side outer: from the wheelhouse arch band, on which its lower edge stands (y 0.62
        // behind the arch), up to the C-pillar trim, below the tail lamp pocket at the rear; welded to
        // the body side outer by flanges along its upper and rear edges
        named('quarterInner', plates([
          region([[4.04, 4.45, 0, 1.85]], {
            side: sd, offset: -0.03, mat: 'aluminum', edges: false,
            // the arch edge is taken on the panel itself (the inward offset lifts it off the skin height),
            // its flange lapped 5 mm over the arch band
            field: (q, s, v) => {
              const p = skinAt(s, v, 'L', -0.03);
              return Math.max(archTop(p.x) - 0.005 - p.y, 0.62 - q.y, q.y - 0.955, Math.min(s - 4.39, q.y - 0.868));
            },
          }),
          skinFlange(sd, [[4.04, 0.955], [4.39, 0.955], [4.39, 0.868], [4.45, 0.868], [4.45, 0.62]], 0.03, 'aluminum'),
        ], 'aluminum')),
        // C-pillar reinforcement (#23/#24): just inside the body side outer, outboard of the C-pillar and
        // trunk side trims, from the wheelhouse up behind the rear door opening to the roof rail
        named('cPillar', cPillarReinf(sd)),
        // rear lamp housing reinforcement (#15/#16 = body side #4): bonded behind the body side
        // outer along the lower edge of the tail lamp pocket
        named('lampHousing', (() => {
          const n = skinNormal(4.45, 1.6);
          if (sd === 'R') n.z = -n.z;
          return faceTo(rbox([0.01, 0.03, 0.12], [0, 0, 0], 'aluminum', { r: 0.003 }), skinAt(4.45, 1.6, sd, -0.0065), n, 'x');
        })()),
        // lock pillar behind the rear door: carries the rear door striker
        named('lockPillar', rbox([0.06, 0.38, 0.043], [-1.095, 0.81, sg * 0.9335], 'aluminum', { r: 0.008 })),
      ),
    });
  }
  reg.add({
    id: 'trunk-floor', ko: '트렁크 플로어·리어 바디 패널', en: 'Trunk floor & rear body panel',
    groups: ['rear-end-panels'], match: /TRUNK FLOOR(?! PNL)|DIFFUSER|REAR BODY|BRKT/,
    object: group(
      named('floor', box([0.86, 0.01, 1.08], [-1.98, 0.615, 0], 'aluminum')),
      // front section of the trunk floor assembly (#1) over the drive unit and the upper links, under the load
      // floor carpet up to the 2nd-row seat back; beside the seat back its flanges reach out to the wheelhouse
      // inner walls (|z| 0.6)
      named('frontFloor', group(
        box([0.25, 0.01, 1.08], [-1.425, 0.615, 0], 'aluminum'),
        ...[-1, 1].map((sg) => box([0.085, 0.01, 0.06], [-1.3425, 0.615, sg * 0.57], 'aluminum')),
      )),
      // rear body panel (#4): its lower edge sits on the bumper beam
      named('rearPanel', box([0.02, 0.225, 1.3], [-2.36, 0.6575, 0], 'aluminum')),
    ),
  });
  // Trunk floor extension panels (#2/#3, also quarter inner #5/#6): the sloped side flanges that
  // join the trunk floor to the wheelhouse inner wall and the shock tower, and behind them the shelf
  // that closes the trunk over the low rear part of the wheelhouse, out to the trunk side trim.
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `trunk-floor-ext-${sd}`, ko: `트렁크 플로어 익스텐션 (${ko})`, en: `Trunk floor extension panel ${en}`, tags: sd,
      groups: ['rear-end-panels', 'rear-quarter-inner-panels'], match: /EXTENSION RR TRUNK FLOOR/,
      object: group(
        quadPlate([[-1.95, 0.615, sg * 0.535], [-1.56, 0.615, sg * 0.535], [-1.56, SHELF_Y, sg * 0.6], [-1.95, SHELF_Y, sg * 0.6]], 0.006, 'aluminum'),
        named('shelf', group(
          quadPlate([[SHELF_X0, SHELF_Y, sg * 0.6], [-1.95, SHELF_Y, sg * 0.6], [-1.95, SHELF_Y, sg * 0.84], [SHELF_X0, SHELF_Y, sg * 0.84]], 0.004, 'aluminum'),
          // RH: flange out under the trunk side finisher behind its bracket, with the rear subframe harness grommet
          ...(sd === 'R' ? [quadPlate([[-1.845, SHELF_Y, 0.84], [-1.95, SHELF_Y, 0.84], [-1.95, SHELF_Y, 0.91], [-1.845, SHELF_Y, 0.91]], 0.004, 'aluminum')] : []),
        )),
        // behind the wheelhouse the extension closes the trunk's rear corner back to the rear body panel,
        // inboard of the liftgate drain tube; on the RH side it leaves room for the subwoofer enclosure,
        // which stands on the load floor in front of the corner
        named('rearCorner', group(...(() => {
          const xf = sd === 'R' ? -2.18 : -1.95; // front end of the sloped flange
          const zi = sd === 'R' ? 0.625 : 0.6; // inner edge of the corner shelf
          return [
            quadPlate([[-2.35, 0.615, sg * 0.535], [xf, 0.615, sg * 0.535], [xf, SHELF_Y, sg * 0.6], [-2.35, SHELF_Y, sg * 0.6]], 0.006, 'aluminum'),
            quadPlate([[-1.95, SHELF_Y, sg * zi], [-2.35, SHELF_Y, sg * zi], [-2.35, SHELF_Y, sg * 0.815], [-1.95, SHELF_Y, sg * 0.815]], 0.004, 'aluminum'),
          ];
        })())),
      ),
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
      // behind the lower lip of the fascia, which curls back under the nose at the centre
      named('catcher', tube([[2.29, 0.25, -0.55], [2.355, 0.25, -0.25], [2.34, 0.25, 0], [2.355, 0.25, 0.25], [2.29, 0.25, 0.55]], 0.025, 'foam', { radial: 6 })),
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
      quadPlate([[-2.09, 0.205, -0.6], [-2.09, 0.205, 0.6], [-2.44, 0.33, 0.6], [-2.44, 0.33, -0.6]], 0.008, 'blackPlastic'), // front edge over the mid aero shield
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
      // stand-off brackets up to the rear subframe side members (#8 BLT HF M6x18)
      ...SIDES.map(({ sd, sg }) => named(`mount${sd}`, box([0.04, 0.052, 0.04], [-1.72, 0.21, sg * 0.42], 'blackPlastic'))),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    for (const [fr, x, frKo] of [['F', XF, '앞'], ['B', XR, '뒤']]) {
      reg.add({
        id: `arch-liner-${sd}${fr}`, ko: `휠 아치 라이너 (${frKo} ${ko})`, en: `Wheel arch liner ${fr === 'F' ? 'front' : 'rear'} ${en}`,
        tags: `${sd}${fr}`, groups: ['wheel-arch-liners'], match: /LINER|LOUVRE|LOUVER|FLANGE|USP|COVER/,
        object: fr === 'F'
          ? wheelhouse(x, sg, ARCH_RADIUS + 0.012, 0.64, 0.965, 'blackPlastic', -0.25, Math.PI + 0.25)
          // rear: inboard strip trimmed above the rear rail node and cut out under the shock tower,
          // as the wheelhouse (the group keeps the component's name, so the liner reads as one part)
          : named(`arch-liner-${sd}${fr}`, group(
            ...rearArch(sg, ARCH_RADIUS + 0.012, 0.64, 0.965, 'blackPlastic', -0.25, Math.PI + 0.25, NODE_A_LINER),
          )),
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
  const topAt = (x) => top0 + ((fx0 - x) / (fx0 - fx1)) * (top1 - top0);
  // The rear corners of the tub are chamfered (x 1.34 -> 1.2, half width 0.44 -> 0.368, as the
  // hood seal on its rim): the shock tower braces pass outboard of the chamfers.
  const fxc = 1.34;
  const fzr = 0.368;
  const tub = [];
  for (const sg of [-1, 1]) {
    tub.push(quadPlate([[fx0, fy, sg * fz], [fx0, top0, sg * fz], [fxc, topAt(fxc), sg * fz], [fxc, fy, sg * fz]], 0.006, 'blackPlastic'));
    tub.push(quadPlate([[fxc, fy, sg * fz], [fxc, topAt(fxc), sg * fz], [fx1, top1, sg * fzr], [fx1, fy, sg * fzr]], 0.006, 'blackPlastic'));
  }
  reg.add({
    id: 'frunk', ko: '프렁크(앞 적재함)', en: 'Front trunk (frunk) tub',
    groups: ['front-luggage-storage-compartment'], match: /^(?!.*SEAL - HOOD)/, // the hood seal on the rim is hood-seal
    object: group(
      quadPlate([[fx0, fy, -fz], [fx0, fy, fz], [fxc, fy, fz], [fxc, fy, -fz]], 0.006, 'blackPlastic'),
      quadPlate([[fxc, fy, -fz], [fxc, fy, fz], [fx1, fy, fzr], [fx1, fy, -fzr]], 0.006, 'blackPlastic'),
      ...tub,
      quadPlate([[fx0, fy, -fz], [fx0, fy, fz], [fx0, top0, fz], [fx0, top0, -fz]], 0.006, 'blackPlastic'),
      quadPlate([[fx1, fy, -fzr], [fx1, fy, fzr], [fx1, top1, fzr], [fx1, top1, -fzr]], 0.006, 'blackPlastic'),
    ),
  });
  // carpet: 8 mm inside the side walls and chamfers, 20 mm short of the tub corners on the floor
  const cA = [fxc + 0.0037, fz - 0.0071]; // chamfer line offset 8 mm into the tub
  const cB = [fx1 + 0.0037, fzr - 0.0071];
  const cX = fx1 + 0.02;
  const cZ = cA[1] + ((cA[0] - cX) / (cA[0] - cB[0])) * (cB[1] - cA[1]);
  const carpet = [];
  for (const sg of [-1, 1]) {
    carpet.push(quadPlate([[fx0 - 0.02, fy + 0.02, sg * (fz - 0.008)], [fx0 - 0.02, top0 - 0.02, sg * (fz - 0.008)],
      [cA[0], topAt(cA[0]) - 0.02, sg * (fz - 0.008)], [cA[0], fy + 0.02, sg * (fz - 0.008)]], 0.008, 'carpet'));
    carpet.push(quadPlate([[cA[0], fy + 0.02, sg * cA[1]], [cA[0], topAt(cA[0]) - 0.02, sg * cA[1]],
      [cX, topAt(cX) - 0.02, sg * cZ], [cX, fy + 0.02, sg * cZ]], 0.008, 'carpet'));
  }
  reg.add({
    id: 'frunk-carpet', ko: '프렁크 카펫 라이닝', en: 'Frunk carpet lining',
    groups: ['front-luggage-storage-compartment-carpet-lining'],
    object: group(
      quadPlate([[fx0 - 0.02, fy + 0.008, -fz + 0.02], [fx0 - 0.02, fy + 0.008, fz - 0.02], [fxc, fy + 0.008, fz - 0.02], [fxc, fy + 0.008, -fz + 0.02]], 0.01, 'carpet'),
      quadPlate([[fxc, fy + 0.008, -fz + 0.02], [fxc, fy + 0.008, fz - 0.02], [cX, fy + 0.008, cZ - 0.012], [cX, fy + 0.008, -cZ + 0.012]], 0.01, 'carpet'),
      ...carpet,
    ),
  });

  // --- Under-hood aprons -----------------------------------------------------------
  const ay = (x) => hoodY(x, 0.035);
  // Side apron: a plate from the frunk tub to the fender with an opening over the shock tower,
  // closed by the shock tower cover (#4/#5), a raised cap that sits on the tower top (y 0.85)
  // over the strut top mount, under the hood.
  const sideApron = (sg) => {
    const zi = fz + 0.005; // inboard edge (frunk tub side)
    const zo = (x) => 0.76 + ((2.1 - x) / 0.95) * 0.04; // outboard edge (fender side)
    const [hx0, hx1, hz0, hz1] = [1.35, 1.62, 0.495, 0.705]; // opening = tower footprint + 5 mm
    const cy = 0.855;
    const P = (x, z, y = ay(x)) => [x, y, sg * z];
    const t = 0.008;
    return group(
      quadPlate([P(2.1, zi), P(2.1, zo(2.1)), P(hx1, zo(hx1)), P(hx1, zi)], t, 'blackPlastic'),
      // behind the tower its inner edge follows the frunk tub's rear chamfer (5 mm outboard of the hood seal)
      quadPlate([P(hx0, zi), P(hx0, zo(hx0)), P(1.15, zo(1.15)), P(1.15, fzr + 0.005 - ((1.2 - 1.15) / (fxc - fx1)) * (fz - fzr))], t, 'blackPlastic'),
      quadPlate([P(hx1, zi), P(hx1, hz0), P(hx0, hz0), P(hx0, zi)], t, 'blackPlastic'),
      quadPlate([P(hx1, hz1), P(hx1, zo(hx1)), P(hx0, zo(hx0)), P(hx0, hz1)], t, 'blackPlastic'),
      // shock tower cover: cap and its front / side walls down to the apron opening
      quadPlate([P(hx1 + 0.005, hz0 - 0.005, cy), P(hx1 + 0.005, hz1 + 0.005, cy), P(hx0 - 0.005, hz1 + 0.005, cy), P(hx0 - 0.005, hz0 - 0.005, cy)], 0.006, 'blackPlastic'),
      quadPlate([P(hx1, hz0), P(hx1, hz1), P(hx1, hz1, cy), P(hx1, hz0, cy)], 0.004, 'blackPlastic'),
      ...[hz0, hz1].map((z) => quadPlate([P(hx1, z), P(hx1, z, cy), P(hx0, z, cy), P(hx0, z)], 0.004, 'blackPlastic')),
    );
  };
  reg.add({
    id: 'underhood-apron-front', ko: '프론트 언더후드 에이프런', en: 'Front underhood apron',
    groups: ['underhood-trim'], match: /APRON FR|FRONT UNDERHOOD|SCUFF|TAPE, DBL/,
    object: quadPlate([[2.2, ay(2.2), -0.5], [2.2, ay(2.2), 0.5], [fx0, ay(fx0), 0.5], [fx0, ay(fx0), -0.5]], 0.008, 'blackPlastic'),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `underhood-apron-${sd}`, ko: `사이드 언더후드 에이프런·쇼크타워 커버 (${ko})`, en: `Side underhood apron & shock tower cover ${en}`,
      tags: sd, groups: ['underhood-trim'], match: /APRON, (LH|RH)|SUB ASY, UNDERHOOD|Shock Tower Cover|SPACER, FRUNK|CLIP, UNDERHOOD/i,
      object: sideApron(sg),
    });
  }
  // its front edge laps 12 mm over the frunk tub's rear wall, resting on the hood seal there
  reg.add({
    id: 'underhood-apron-rear', ko: '리어 언더후드 에이프런(냉각수 캡 접근)', en: 'Rear underhood apron',
    groups: ['underhood-trim'], match: /APRON, RR|U.HOOD APRON RR|DM ASY-UNDERHOOD APRON, RR|SEAL - HOOD TO COWL/,
    object: quadPlate([[1.212, ay(1.2) - 0.0012, -0.62], [1.212, ay(1.2) - 0.0012, 0.62], [0.98, ay(0.98) - 0.005, 0.62], [0.98, ay(0.98) - 0.005, -0.62]], 0.008, 'blackPlastic'),
  });

  // --- NVH plugs and patches (floor pan plugs, door inner panel tapes) ----------------
  const plugs = [];
  for (const x of [0.6, 0.1, -0.4, -0.9]) {
    for (const z of [-0.55, 0.55]) plugs.push(cyl(0.022, 0.008, 'y', [x, 0.3, z], 'rubber', { seg: 14 })); // in the floor pan
  }
  reg.add({
    id: 'nvh-plugs', ko: 'NVH 댐핑 패치·바디 플러그 (여러 위치)', en: 'NVH damping patches & body plugs (various)',
    groups: ['nvh-damping-and-paint-armor'], match: /^(?!.*TAPE, DOOR)/, // the door tapes are door-tape-*
    object: group(plugs),
  });
  // door tape patches (TAPE, DOOR, D44 #9) over access holes on the cabin side of each door inner
  // panel, behind the trim pad: one component per door, so they travel with their doors in the exploded
  // view (explodeWith names the door whose exploded-view offset they share)
  for (const { sd, ko, en } of SIDES) {
    for (const [fr, s, v, frKo, frEn] of [['F', 2.435, 1.0, '앞', 'front'], ['B', 2.905, 0.9, '뒤', 'rear']]) {
      const n = skinNormal(s, v);
      if (sd === 'R') n.z = -n.z;
      reg.add({
        id: `door-tape-${sd}${fr}`, ko: `${frKo} 도어 NVH 테이프 (${ko})`, en: `${frEn} door NVH tape ${en}`, tags: `${sd}${fr}`,
        groups: ['nvh-damping-and-paint-armor'], match: /TAPE, DOOR/, explodeWith: `door-${sd}${fr}`,
        object: faceTo(cyl(0.022, 0.002, 'y', [0, 0, 0], 'rubber', { seg: 20 }), skinAt(s, v, sd, -0.041), n, 'y'),
      });
    }
  }
}
