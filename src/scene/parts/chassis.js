// Wheels, tyres, brakes, suspension, steering, subframes and drive units.

import * as THREE from 'three';
import {
  X_FRONT_AXLE as XF, X_REAR_AXLE as XR, WHEEL_Y as WY, TRACK_FRONT, TRACK_REAR, TIRE_RADIUS, TIRE_WIDTH,
} from '../profile.js';
import {
  V, group, named, rbox, box, cyl, beam, bar, tube, pipe, torus, lathe, disc, helix, mesh, extrude,
} from '../geom.js';

const ZF = TRACK_FRONT / 2;
const ZR = TRACK_REAR / 2;

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** Point on segment a-b where coordinate `axis` (0 x, 1 y, 2 z) equals v. */
const at = (a, b, axis, v) => lerp(a, b, (v - a[axis]) / (b[axis] - a[axis]));

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
  parts.push(named('centre', disc(0.075, 0.03, 'z', [c.x, WY, faceZ + sg * 0.01], 'aluminum'))); // mounting face on the rotor hat
  parts.push(disc(0.035, 0.012, 'z', [c.x, WY, faceZ + sg * 0.03], 'paintDark'));
  return group(parts);
}

const CAL_ANGLE = (c) => (c.front ? Math.PI * 0.82 : Math.PI * 0.8);
const PARK_ANGLE = Math.PI * 1.2;

function rotorMesh(c) {
  const r = c.front ? 0.178 : 0.183;
  const zc = c.z - c.sg * 0.035;
  const t = 0.015;
  return group(
    // friction ring (an annulus: the hub runs through its centre), joined to the hat
    named('disc', lathe([[0.085, -t], [r, -t], [r, t], [0.085, t], [0.085, -t]], 'z', [c.x, WY, zc], 'steel', { seg: 48 })),
    // hat from the hub flange out to the wheel mounting face
    named('hat', cyl(0.085, 0.1, 'z', [c.x, WY, zc + c.sg * 0.05], 'darkMetal', { seg: 28 })),
  );
}

/**
 * Dust shield (#6): an annulus behind the disc with a cut-out where the caliper and its
 * bracket sit (`cut` = centre angle, `half` = half width) and optional notches from the rim
 * down to radius `r` (the parking brake bracket).
 */
function shieldMesh(c, cut, half, notches = []) {
  const R = 0.17;
  const ri = 0.075;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const a0 = cut + half;
  const a1 = cut - half + Math.PI * 2;
  const n = 96;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const q = notches.find((k) => Math.abs(wrap(a - k.a)) < k.half);
    const rr = q ? q.r : R;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([Math.cos(a) * ri, Math.sin(a) * ri]);
  }
  return named('shield', extrude(pts, 0.003, 'xy', [c.x, WY, c.z - c.sg * 0.075], 'steel', { bevel: 0 }));
}

function caliperMesh(c, scale = 1, angle = 2.6, matKey = 'paintDark') {
  const r = (c.front ? 0.15 : 0.155);
  const x = c.x + Math.cos(angle) * r;
  const y = WY + Math.sin(angle) * r;
  const zc = c.z - c.sg * 0.035;
  // radial depth 0.07, long side (0.17) along the disc rim, straddling the disc
  const m = rbox([0.07 * scale, 0.17 * scale, 0.085 * scale], [x, y, zc], matKey, { r: 0.012 });
  m.rotation.z = angle;
  return named('caliper', m);
}

/** Caliper mounting bracket from the caliper body to the knuckle upright. */
function caliperBracket(c, angle) {
  const r = (c.front ? 0.15 : 0.155) - 0.02;
  const y = WY + Math.sin(angle) * r;
  return named('bracket', beam([c.x + Math.cos(angle) * r, y, c.z - c.sg * 0.06], [c.x - 0.04, y, c.z - c.sg * 0.11], 0.012, 'paintDark'));
}

/**
 * Brake hose body bracket on the rear face of the shock tower, clear of the spring; at the rear
 * in the wheelhouse above the edge of the trunk floor extension.
 */
export const hoseBodyEnd = (c) => (c.front ? [1.35, 0.7, c.sg * 0.58] : [-1.591, 0.72, c.sg * 0.632]);

function knuckleMesh(c) {
  const sg = c.sg;
  const zi = c.z - sg * 0.11;
  const parts = [
    named('hub', cyl(0.07, 0.07, 'z', [c.x, WY, c.z - sg * 0.07], 'steel', { seg: 24 })),
    named('upright', rbox([0.09, 0.36, 0.06], [c.x - 0.01, WY + 0.02, zi], 'aluminum', { r: 0.02 })),
  ];
  if (c.front) {
    const armA = [c.x - 0.045, WY + 0.02, zi];
    const eye = [c.x - 0.14, WY + 0.02, c.z - sg * 0.13];
    parts.push(
      // leans inboard so the upper ball joint sits clear of the tyre; ends in the clamp
      named('gooseneck', beam([c.x - 0.01, WY + 0.17, zi], [c.x - 0.02, WY + 0.238, zi - sg * 0.031], 0.022, 'aluminum')),
      // pinch clamp around the upper-arm ball stud (bolt #4 / nut #5 of the arm group)
      named('clamp', rbox([0.05, 0.035, 0.05], [c.x - 0.02, WY + 0.253, zi - sg * 0.031], 'aluminum', { r: 0.006 })),
      // steering arm, ending in its eye; the outer tie-rod ball stud comes up through the eye
      named('steerArm', beam(armA, lerp(armA, eye, 0.85), 0.016, 'aluminum')),
      named('steerEye', cyl(0.02, 0.02, 'y', eye, 'aluminum')),
    );
  } else {
    // turned inboard, clear of the tyre, to take the upper link
    parts.push(named('gooseneck', beam([c.x - 0.01, WY + 0.17, zi], [c.x + 0.02, WY + 0.25, zi - sg * 0.04], 0.022, 'aluminum')));
  }
  return group(parts);
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
        shieldMesh(c, CAL_ANGLE(c), 0.72, c.front ? [] : [{ a: PARK_ANGLE + 0.065, half: 0.22, r: 0.1 }]),
      ),
    });
    reg.add({
      id: `brake-caliper-${c.key}`, ko: `브레이크 캘리퍼·패드 (${c.ko})`, en: `Brake caliper & pads ${c.en}`, tags: `${side}${fr}`,
      groups: [brakeGroup], match: /CALIPER|PAD|BLEED|BOOT|GREASE|BOLT HF M12/,
      object: group(
        caliperMesh(c, 1, CAL_ANGLE(c), 'paintDark'),
        caliperBracket(c, CAL_ANGLE(c)),
      ),
    });
    if (!c.front) {
      reg.add({
        id: `park-brake-${c.key}`, ko: `주차 브레이크 캘리퍼 (${c.ko})`, en: `Parking brake caliper ${c.en}`, tags: `${side}B`,
        groups: ['park-brake-calipers-and-pads'], match: /CALIPER|PAD|SPRING|BLT H|EPB CONNECTOR/,
        object: group(
          caliperMesh(c, 0.62, PARK_ANGLE, 'darkMetal'),
          // bracket to the knuckle (BLT M10x86 #2)
          named('bracket', beam([c.x + Math.cos(PARK_ANGLE) * 0.14, WY + Math.sin(PARK_ANGLE) * 0.14, c.z - c.sg * 0.06],
            [c.x - 0.05, WY - 0.07, c.z - c.sg * 0.11], 0.01, 'steel')),
        ),
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
        // sensor head pushed into the knuckle, lead up to the wheelhouse
        named('head', cyl(0.009, 0.06, 'z', [c.x + 0.04, WY - 0.05, c.z - c.sg * 0.13], 'blackPlastic')),
        named('lead', tube(c.front
          ? [[c.x + 0.04, WY - 0.05, c.z - c.sg * 0.13], [1.62, 0.32, c.sg * 0.66], [1.64, 0.5, c.sg * 0.63], [1.625, 0.62, c.sg * 0.62]]
          : [[c.x + 0.04, WY - 0.05, c.z - c.sg * 0.16], [c.x + 0.09, WY + 0.15, c.z - c.sg * 0.2], [c.x + 0.05, WY + 0.38, c.z - c.sg * 0.24]],
        0.004, 'wire')),
      ),
    });
    // jounce (flexible brake) hose: from the caliper up to the body bracket on the shock tower,
    // routed behind the spring
    const calX = c.x + Math.cos(Math.PI * 0.82) * 0.15;
    const hb = hoseBodyEnd(c);
    const hosePath = c.front
      ? [[calX, WY + 0.11, c.z - c.sg * 0.07], [calX - 0.03, WY + 0.2, c.z - c.sg * 0.15], [1.345, 0.64, c.sg * 0.63], hb]
      : [[calX, WY + 0.11, c.z - c.sg * 0.07], [-1.588, 0.55, c.sg * 0.712], [-1.598, 0.66, c.sg * 0.665], hb];
    reg.add({
      id: `jounce-hose-${c.key}`, ko: `브레이크 호스 (${c.ko})`, en: `Brake jounce hose ${c.en}`, tags: `${side}${fr}`,
      groups: ['jounce-hoses'],
      object: named('hose', tube(hosePath, 0.006, 'rubber')),
    });
  }

  // --- Front suspension -------------------------------------------------------
  // Upper control arm on the body shock tower, fore and aft lower links on the
  // subframe, strut clevis bolted through the aft link (catalog front-suspension-arms,
  // front-air-spring, front-coil-spring-and-damper).
  const frontPts = (c) => {
    const sg = c.sg;
    // aft link runs well behind the axle so the strut on it clears the halfshaft
    const BJA = [c.x - 0.055, WY - 0.137, sg * 0.716];
    const BA = [c.x - 0.13, WY - 0.14, sg * 0.395];
    return {
      BJU: [c.x - 0.01, WY + 0.288, sg * 0.69], // upper ball joint housing, on top of the knuckle clamp
      PF: [c.x + 0.065, WY + 0.3, sg * 0.52], // upper-arm pivots inside the shock tower
      PR: [c.x - 0.155, WY + 0.3, sg * 0.52],
      BJF: [c.x + 0.025, WY - 0.137, sg * 0.716], // fore link: knuckle ball joint -> subframe bushing
      BF: [c.x + 0.265, WY - 0.13, sg * 0.395],
      BJA, BA, // aft link
      E: at(BJA, BA, 2, sg * 0.66), // damper bushing in the aft link
      // strut top mount under the shock tower top plate (y 0.85), forward of the tower brace
      // member and inboard of the forward bar, both of which start at the tower centre
      TOP: [c.x - 0.005, 0.845, sg * 0.575],
    };
  };
  const KNUCKLE_IN = (c) => Math.abs(c.z) - 0.14; // |z| of the knuckle upright's inboard face
  const ballJoint = (name, q) => named(name, group(
    cyl(0.021, 0.03, 'y', q, 'steel'),
    cyl(0.008, 0.045, 'y', [q[0], q[1] - 0.035, q[2]], 'steel'), // stud pointing down into the knuckle
    cyl(0.013, 0.004, 'y', [q[0], q[1] - 0.026, q[2]], 'steel'), // Nordlock washer #14
    cyl(0.012, 0.012, 'y', [q[0], q[1] - 0.035, q[2]], 'steel'), // nut #10
  ));
  for (const c of CORNERS.filter((k) => k.front)) {
    const side = c.sg < 0 ? 'L' : 'R';
    const sg = c.sg;
    const P = frontPts(c);
    // the links start at the knuckle face; their ball joints (foreBJ / aftBJ) sit in the knuckle
    const kin = sg * (KNUCKLE_IN(c) + 0.006);
    reg.add({
      id: `front-arms-${c.key}`, ko: `프론트 서스펜션 암 (${c.ko})`, en: `Front suspension arms ${c.en}`, tags: `${side}F`,
      groups: ['front-suspension-arms'],
      object: group(
        // upper control arm #1: two legs, bushings and BLT M10x100 #2 / nut #3 in the tower
        named('ucaFront', beam(P.BJU, P.PF, 0.016, 'aluminum')),
        named('ucaRear', beam(P.BJU, P.PR, 0.016, 'aluminum')),
        named('ucaBushF', cyl(0.018, 0.04, 'x', P.PF, 'rubber')),
        named('ucaBushR', cyl(0.018, 0.04, 'x', P.PR, 'rubber')),
        cyl(0.006, 0.1, 'x', P.PF, 'steel'),
        cyl(0.006, 0.1, 'x', P.PR, 'steel'),
        // ball joint housing on the knuckle clamp; button-head M10x57 #4 through the clamp, nut #5
        named('ucaBJ', group(
          cyl(0.017, 0.035, 'y', P.BJU, 'steel'),
          cyl(0.005, 0.057, 'x', [c.x - 0.02, WY + 0.246, P.BJU[2]], 'steel'),
          cyl(0.009, 0.008, 'x', [c.x - 0.053, WY + 0.246, P.BJU[2]], 'steel'),
        )),
        // fore link #6: vertical cam bolt #7 in the subframe bushing
        named('foreLink', beam(at(P.BJF, P.BF, 2, kin), P.BF, 0.02, 'aluminum')),
        named('foreBush', cyl(0.032, 0.05, 'y', P.BF, 'rubber')),
        cyl(0.007, 0.114, 'y', P.BF, 'steel'),
        ballJoint('foreBJ', P.BJF),
        // aft link #11: horizontal cam bolt #12, damper bushing near the outer end
        named('aftLink', beam(at(P.BJA, P.BA, 2, kin), P.BA, 0.02, 'aluminum')),
        named('aftBush', cyl(0.028, 0.06, 'x', P.BA, 'rubber')),
        cyl(0.007, 0.114, 'x', P.BA, 'steel'),
        named('damperBush', cyl(0.022, 0.05, 'x', P.E, 'rubber')),
        ballJoint('aftBJ', P.BJA),
      ),
    });
    // strut: two-lug clevis bolted through the aft-link damper bushing (#3 M14x94 + nut #4),
    // damper rod up into the shock tower (3 studs, nuts #2); spring sits above the upper arm
    const strut = () => {
      const { E, TOP } = P;
      const SB = [E[0], E[1] + 0.045, E[2]];
      const ROD = at(SB, TOP, 1, 0.77); // damper body ends below the tower top; piston rod up to the mount
      return [
        named('damper', beam(SB, ROD, 0.024, 'steel')),
        named('rod', beam(ROD, TOP, 0.0095, 'chrome')),
        rbox([0.068, 0.012, 0.04], SB, 'steel', { r: 0.004 }),
        rbox([0.008, 0.06, 0.04], [E[0] - 0.03, SB[1] - 0.03, E[2]], 'steel', { r: 0.003 }),
        rbox([0.008, 0.06, 0.04], [E[0] + 0.03, SB[1] - 0.03, E[2]], 'steel', { r: 0.003 }),
        named('clevisBolt', cyl(0.007, 0.094, 'x', E, 'steel')),
      ];
    };
    const T = P.TOP;
    // point on the damper axis at height y (spring / bellows sit on the axis)
    const SB0 = [P.E[0], P.E[1] + 0.045, P.E[2]];
    const ax = (y) => at(SB0, T, 1, y);
    reg.add({
      id: `front-air-spring-${c.key}`, ko: `프론트 에어 스프링 모듈 (${c.ko})`, en: `Front air spring module ${c.en}`, tags: `${side}F`,
      groups: ['front-air-spring'], variant: { susp: 'air' },
      object: group(
        ...strut(),
        named('bellows', beam(ax(WY + 0.332), ax(WY + 0.418), 0.06, 'rubber')),
        // top mount under the tower top plate (3 studs, nuts #2)
        named('topMount', cyl(0.045, 0.01, 'y', T, 'aluminum')),
      ),
    });
    reg.add({
      id: `front-coil-spring-${c.key}`, ko: `프론트 코일 스프링·댐퍼 (${c.ko})`, en: `Front coil spring & damper ${c.en}`, tags: `${side}F`,
      groups: ['front-coil-spring-and-damper'], variant: { susp: 'coil' },
      object: group(
        ...strut(),
        named('spring', helix(0.055, 0.08, 3, 0.009, ax(WY + 0.373), 'paintDark')),
        named('seat', cyl(0.062, 0.012, 'y', ax(WY + 0.328), 'steel')),
        named('upperSeat', cyl(0.062, 0.012, 'y', ax(WY + 0.418), 'steel')),
        // top mount under the tower top plate (3 studs, nuts #2)
        named('topMount', cyl(0.045, 0.01, 'y', T, 'steel')),
      ),
    });
    const hs = at(P.BJA, P.BA, 2, sg * 0.45);
    reg.add({
      id: `front-height-sensor-${c.key}`, ko: `프론트 차고 센서 (${c.ko})`, en: `Front ride height sensor ${c.en}`, tags: `${side}F`,
      groups: ['height-sensors'], variant: { susp: 'air' },
      object: group(
        named('body', rbox([0.05, 0.04, 0.03], [c.x - 0.12, WY - 0.076, sg * 0.37], 'blackPlastic', { r: 0.006 })),
        named('link', beam([c.x - 0.12, WY - 0.086, sg * 0.37], [hs[0], WY - 0.147, sg * 0.45], 0.004, 'steel')),
      ),
    });
  }
  {
    const eye = (sg) => [XF + 0.06, WY - 0.06, sg * 0.62];
    const low = (sg) => {
      const P = frontPts(CORNERS.find((k) => k.front && k.sg === sg));
      const q = at(P.BJF, P.BF, 0, XF + 0.06);
      return [q[0], q[1] + 0.02, q[2]];
    };
    const parts = [named('bar', tube([eye(-1), [XF + 0.2, WY - 0.08, -0.5], [XF + 0.24, WY - 0.08, -0.25],
      [XF + 0.24, WY - 0.08, 0.25], [XF + 0.2, WY - 0.08, 0.5], eye(1)], 0.013, 'steel'))];
    for (const [sd, sg] of [['L', -1], ['R', 1]]) {
      parts.push(named(`link${sd}`, beam(eye(sg), low(sg), 0.007, 'steel'))); // links #5 / #6, nuts #7
      // bushing clamp on the subframe rail, BOLT M10x30 #4
      parts.push(named(`clamp${sd}`, rbox([0.05, 0.03, 0.045], [XF + 0.228, WY - 0.08, sg * 0.34], 'rubber', { r: 0.006 })));
      parts.push(cyl(0.005, 0.03, 'y', [XF + 0.228, WY - 0.087, sg * 0.322], 'steel'));
    }
    reg.add({
      id: 'front-stabilizer', ko: '프론트 스태빌라이저 바·링크', en: 'Front stabilizer bar & links',
      groups: ['front-stabilizer-bar-and-links'],
      object: group(parts),
    });
  }

  // --- Rear suspension -------------------------------------------------------
  // Per side (catalog rear-suspension-arms, qty 2 = one each side): lower control
  // arm #1 on the subframe side member, short integral link #6 from the LCA to the
  // knuckle, toe link #8 from the knuckle to the side member, and one upper link
  // #16 from the knuckle top to a tower on the subframe.
  for (const c of CORNERS.filter((k) => !k.front)) {
    const side = c.sg < 0 ? 'L' : 'R';
    const sg = c.sg;
    const kz = c.z - sg * 0.11;
    reg.add({
      id: `rear-arms-${c.key}`, ko: `리어 서스펜션 암 (${c.ko})`, en: `Rear suspension arms ${c.en}`, tags: `${side}B`,
      groups: ['rear-suspension-arms'],
      object: group(
        named('lca', rbox([0.2, 0.04, 0.34], [c.x, WY - 0.135, sg * 0.54], 'aluminum', { r: 0.015 })),
        named('integral', beam([c.x - 0.045, WY - 0.13, sg * 0.69], [c.x - 0.045, WY - 0.1, sg * 0.735], 0.013, 'steel')),
        // toe link #8: inner end on the side member behind the side motor mount
        named('toe', beam([c.x + 0.025, WY - 0.09, kz], [c.x + 0.07, WY - 0.085, sg * 0.39], 0.013, 'steel')),
        named('upper', beam([c.x + 0.02, WY + 0.25, kz - sg * 0.04], [c.x + 0.17, WY + 0.15, sg * 0.43], 0.014, 'aluminum')),
      ),
    });
    // bottom eye bolted to the LCA (#3 M14x84 + nut #4), top mount under the top plate of the
    // body shock tower (y 0.98; studs #5, nuts #2), outboard of the rear rail
    const top = [c.x - 0.06, 0.971, sg * 0.62];
    const bot = [c.x - 0.08, WY - 0.13, sg * 0.66];
    const ax = (y) => at(bot, top, 1, y);
    reg.add({
      id: `rear-air-spring-${c.key}`, ko: `리어 에어 스프링 모듈 (${c.ko})`, en: `Rear air spring module ${c.en}`, tags: `${side}B`,
      groups: ['rear-air-spring'], variant: { susp: 'air' },
      object: group(
        named('damper', beam(bot, top, 0.024, 'steel')),
        // air sleeve, below the tower
        named('sleeve', beam(ax(WY + 0.135), ax(0.652), 0.07, 'rubber')),
        named('topMount', cyl(0.048, 0.018, 'y', top, 'aluminum')),
      ),
    });
    reg.add({
      id: `rear-coil-spring-${c.key}`, ko: `리어 코일 스프링·댐퍼 (${c.ko})`, en: `Rear coil spring & damper ${c.en}`, tags: `${side}B`,
      groups: ['rear-coil-spring-and-damper'], variant: { susp: 'coil' },
      object: group(
        named('damper', beam(bot, top, 0.024, 'steel')),
        // spring between the lower seat on the damper body and the upper seat below the tower
        named('seat', cyl(0.077, 0.012, 'y', ax(0.486), 'steel')),
        named('spring', helix(0.065, 0.148, 4, 0.01, ax(0.576), 'paintDark')),
        named('upperSeat', cyl(0.077, 0.012, 'y', ax(0.656), 'steel')),
        named('topMount', cyl(0.048, 0.018, 'y', top, 'steel')),
      ),
    });
    // sensor (#7) on its bracket (#8 / #9) on the outboard face of the subframe side member,
    // short link down to the lower control arm
    const hsx = c.x + 0.105;
    reg.add({
      id: `rear-height-sensor-${c.key}`, ko: `리어 차고 센서 (${c.ko})`, en: `Rear ride height sensor ${c.en}`, tags: `${side}B`,
      groups: ['height-sensors'], variant: { susp: 'air' },
      object: group(
        named('body', rbox([0.05, 0.04, 0.03], [hsx, WY - 0.06, sg * 0.47], 'blackPlastic', { r: 0.006 })),
        named('link', beam([hsx, WY - 0.08, sg * 0.475], [hsx - 0.015, WY - 0.114, sg * 0.5], 0.004, 'steel')),
      ),
    });
  }
  // bar under the subframe side members in bushing clamps (BOLT HF M10x25 #4), links #5 (nuts #6)
  // from the bar ends down to the lower control arms
  const sbY = WY - 0.137;
  const sbX = XR - 0.225;
  reg.add({
    id: 'rear-stabilizer', ko: '리어 스태빌라이저 바·링크', en: 'Rear stabilizer bar & links',
    groups: ['rear-stabilizer-bar-and-links'],
    object: group(
      named('bar', pipe([[XR - 0.12, WY - 0.05, -0.58], [XR - 0.17, sbY, -0.5], [sbX, sbY, -0.4], [sbX, sbY, 0.4],
        [XR - 0.17, sbY, 0.5], [XR - 0.12, WY - 0.05, 0.58]], 0.011, 'steel', { bend: 0.05 })),
      named('linkL', beam([XR - 0.12, WY - 0.05, -0.58], [XR - 0.09, WY - 0.13, -0.6], 0.006, 'steel')),
      named('linkR', beam([XR - 0.12, WY - 0.05, 0.58], [XR - 0.09, WY - 0.13, 0.6], 0.006, 'steel')),
      ...[['L', -1], ['R', 1]].flatMap(([sd, sg]) => [
        named(`clamp${sd}`, rbox([0.045, 0.035, 0.05], [sbX, sbY + 0.0025, sg * 0.42], 'rubber', { r: 0.006 })),
        cyl(0.005, 0.03, 'y', [sbX + 0.016, sbY + 0.004, sg * 0.42], 'steel'),
      ]),
    ),
  });

  // --- Steering -----------------------------------------------------------------
  // Column (upper group) -> upper I-shaft link #6 -> lower I-shaft link through the
  // dash seal -> pinion input shaft of the EPS gear, which sits on the front
  // subframe behind the front drive unit.  The lower link, its M10 bolt and the
  // dash seal are listed in both steering groups (lower #6/#7/#8 = upper #11/#8/#10)
  // and are drawn once, as the shared component 'steering-ishaft'.
  const rackX = XF - 0.265;
  const rackY = WY - 0.065;
  const pinion = [rackX - 0.02, rackY + 0.06, -0.2];
  const pinionShaft = [rackX - 0.02, rackY + 0.08, -0.22];
  // column output spline: the column (wheel hub at y 0.86) drops at 33 deg so it passes under the
  // cross-car beam (y 0.72) and below the instrument cluster
  const COL_K = 0.655;
  const colEnd = [0.82, 0.86 - COL_K * 0.42, -0.37];
  const ujLower = lerp(pinionShaft, [0.985, 0.548, -0.37], 0.4); // lower U-joint on the pinion input shaft
  const dashSeal = at(ujLower, colEnd, 0, 0.99); // the shaft is straight between its two U-joints
  const coupling = at(ujLower, colEnd, 0, 0.955); // upper-link sleeve on the lower-link spline, cabin side
  const tieRod = (sd, sg) => {
    const c = CORNERS.find((k) => k.front && k.sg === sg);
    const I = [rackX, rackY, sg * 0.36];
    const T = [c.x - 0.14, WY - 0.01, c.z - sg * 0.13]; // ball-joint housing under the knuckle steering-arm eye
    const jn = lerp(I, T, 0.72);
    return [
      beam(I, lerp(I, T, 0.32), 0.022, 'rubber', { r2: 0.014 }), // bellows boot
      beam(I, jn, 0.009, 'steel'), // inner tie rod
      beam(jn, lerp(I, T, 0.75), 0.014, 'steel'), // jam nut #4
      named(`tieRod${sd}`, beam(jn, T, 0.012, 'steel')), // outer tie rod #3
      cyl(0.02, 0.03, 'y', T, 'steel'),
      named(`stud${sd}`, cyl(0.008, 0.05, 'y', [T[0], T[1] + 0.025, T[2]], 'steel')),
      cyl(0.013, 0.012, 'y', [T[0], T[1] + 0.046, T[2]], 'steel'), // NUT M14x2 #5 on top of the eye
    ];
  };
  reg.add({
    id: 'steering-gear', ko: '스티어링 기어(EPS 랙)', en: 'Steering gear (EPS rack)',
    groups: ['steering-gear-and-lower-column'], match: /^(?!.*(I-SHAFT|DASH SEAL|M10X1\.50X35))/i,
    object: group(
      named('rack', cyl(0.03, 0.72, 'z', [rackX, rackY, 0], 'aluminum')),
      named('eps', cyl(0.05, 0.18, 'z', [rackX, rackY + 0.01, 0.175], 'darkMetal')),
      named('pinion', rbox([0.09, 0.09, 0.12], pinion, 'darkMetal', { r: 0.01 })),
      named('inputShaft', beam(pinionShaft, ujLower, 0.012, 'steel')),
      // mounting bosses on the subframe rails, BOLT HF M14x78 #2
      ...[['L', -1], ['R', 1]].map(([sd, sg]) => named(`boss${sd}`, group(
        rbox([0.06, 0.03, 0.045], [rackX, rackY - 0.025, sg * 0.325], 'aluminum', { r: 0.006 }),
        cyl(0.007, 0.078, 'y', [rackX, rackY - 0.035, sg * 0.325], 'steel'), // bolt down into the rail
      ))),
      ...tieRod('L', -1),
      ...tieRod('R', 1),
    ),
  });
  reg.add({
    id: 'steering-ishaft', ko: '스티어링 I-샤프트 하부 링크·대시 실', en: 'Steering I-shaft lower link & dash seal',
    groups: ['steering-gear-and-lower-column', 'steering-column-and-wheel'], match: /LOWER|DASH SEAL|M10X1\.50X35/i,
    object: group(
      named('lowerLink', beam(coupling, ujLower, 0.012, 'steel')),
      named('dashSeal', cyl(0.04, 0.03, 'x', dashSeal, 'rubber')),
      named('ujLower', rbox([0.045, 0.045, 0.045], ujLower, 'steel', { r: 0.006 })),
      cyl(0.006, 0.06, 'z', ujLower, 'steel'), // BOLT H M10x35 at the pinion
      named('couplingBolt', cyl(0.006, 0.05, 'z', coupling, 'steel')), // BOLT H M10x35 at the coupling
    ),
  });
  reg.add({
    id: 'steering-ishaft-upper', ko: '스티어링 I-샤프트 상부 링크', en: 'Steering I-shaft upper link',
    groups: ['steering-column-and-wheel'], match: /LINK UPPER|M8X1\.25X35|NUT HF M10X1\.5/i,
    object: group(
      named('yoke', rbox([0.045, 0.045, 0.045], colEnd, 'steel', { r: 0.006 })), // U-joint on the column spline
      cyl(0.005, 0.06, 'z', colEnd, 'steel'), // pinch bolt M8x35 #7
      named('link', beam(colEnd, coupling, 0.016, 'steel')),
      named('sleeve', rbox([0.04, 0.04, 0.04], coupling, 'steel', { r: 0.006 })),
      cyl(0.009, 0.008, 'z', [coupling[0], coupling[1], coupling[2] + 0.024], 'steel'), // NUT HF M10 #9 on the sleeve face
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
    groups: ['steering-column-and-wheel'], match: /^(?!.*(I-SHAFT|M8X1\.25X35|M10X1\.50X35|NUT HF M10X1\.5))/i,
    object: group(
      named('wheel', swGroup),
      named('column', beam([swC.x, swC.y, swC.z], colEnd, 0.03, 'blackPlastic')),
      named('shroud', rbox([0.12, 0.066, 0.1], [0.47, 0.86 - COL_K * 0.07, -0.37], 'blackPlastic', { r: 0.015, rot: [0, 0, -Math.atan(COL_K)] })),
      // column mounting bracket under the cross-car beam (bolts #2 / #3)
      named('columnBracket', rbox([0.06, 0.02, 0.08], [0.72, 0.683, -0.37], 'steel', { r: 0.004 })),
    ),
  });

  // --- Subframes -------------------------------------------------------------------
  const fy = WY - 0.13;
  reg.add({
    id: 'front-subframe', ko: '프론트 서브프레임', en: 'Front subframe',
    groups: ['front-subframe', 'front-subframe-dual-motor'],
    object: group(
      named('railL', bar([XF + 0.42, fy, -0.34], [XF - 0.3, fy, -0.34], 0.07, 0.06, 'aluminum')),
      named('railR', bar([XF + 0.42, fy, 0.34], [XF - 0.3, fy, 0.34], 0.07, 0.06, 'aluminum')),
      named('frontCross', bar([XF + 0.42, fy, -0.34], [XF + 0.42, fy, 0.34], 0.06, 0.06, 'aluminum')),
      named('rearCross', bar([XF - 0.3, fy, -0.34], [XF - 0.3, fy, 0.34], 0.06, 0.06, 'aluminum')),
      // four body mounts (BOLT M14x50 #8): rear legs to the rail ends at the torque boxes, front posts up into the rails
      named('rearLegL', bar([XF - 0.3, fy, -0.34], [1.03, 0.39, -0.5], 0.04, 0.04, 'aluminum')),
      named('rearLegR', bar([XF - 0.3, fy, 0.34], [1.03, 0.39, 0.5], 0.04, 0.04, 'aluminum')),
      named('postL', bar([XF + 0.315, fy + 0.035, -0.34], [XF + 0.315, 0.425, -0.47], 0.05, 0.05, 'aluminum')),
      named('postR', bar([XF + 0.315, fy + 0.035, 0.34], [XF + 0.315, 0.425, 0.47], 0.05, 0.05, 'aluminum')),
      box([0.6, 0.006, 0.62], [XF + 0.05, fy - 0.05, 0], 'aluminum'),
    ),
  });
  const ry = WY - 0.08;
  // rear rail centre height along x (the rail kicks up over the axle, structure.js) and its underside
  const railY = (x) => (x >= -1.25 ? 0.36 + 0.065 * ((-1.0 - x) / 0.25) : 0.425 + 0.025 * ((-1.25 - x) / 1.05));
  const railBot = (x) => railY(x) - 0.0465;
  const xFC = -1.09; // front cross member, clear of the rear edge of the battery pack (x -1.04)
  const xFI = -1.2; // front isolators, behind the powertrain coolant hose that runs outboard of the RH side member
  const yFI = railBot(xFI) - 0.025; // isolator centre, its top against the rail
  // shear plate #4 / #5 under the front isolator: stud #2 and nut #6 through its rear end, front end
  // screwed to the top of the battery pack rear flange (BOLT M5x15 #7; the plates differ by pack version)
  const shearPlate = (sg) => {
    const a = [xFI - 0.035, yFI - 0.0275, sg * 0.5425];
    const b = [-0.99, 0.2875, sg * 0.5425];
    return group(
      bar(a, b, 0.005, 0.065, 'aluminum'), // 5 mm plate, 65 mm wide
      ...[[-1.005, 0.525], [-1.005, 0.56], [-1.03, 0.5425]].map(([x, z]) => cyl(0.004, 0.012, 'y', [x, 0.284, sg * z], 'steel')),
    );
  };
  reg.add({
    id: 'rear-subframe', ko: '리어 서브프레임', en: 'Rear subframe',
    groups: ['rear-subframe'],
    object: group(
      named('sideL', bar([xFC, ry, -0.42], [XR - 0.36, ry, -0.42], 0.08, 0.07, 'aluminum')),
      named('sideR', bar([xFC, ry, 0.42], [XR - 0.36, ry, 0.42], 0.08, 0.07, 'aluminum')),
      named('frontCross', bar([xFC, ry, -0.42], [xFC, ry, 0.42], 0.07, 0.07, 'aluminum')),
      named('rearCross', bar([XR - 0.36, ry, -0.42], [XR - 0.36, ry, 0.42], 0.07, 0.07, 'aluminum')),
      // front isolators: arm out to the isolator bushing under the rail, stud #2 up into the rail,
      // shear plate #4 / #5 and nut #6 below; rear pair bolt #3 M14x120 through the posts
      ...[['L', -1], ['R', 1]].flatMap(([sd, sg]) => [
        named(`postF${sd}`, bar([xFI, ry, sg * 0.42], [xFI, yFI - 0.01, sg * 0.535], 0.05, 0.05, 'aluminum')),
        named(`isoF${sd}`, cyl(0.032, 0.05, 'y', [xFI, yFI, sg * 0.545], 'rubber')),
        named(`studF${sd}`, cyl(0.007, 0.1, 'y', [xFI, yFI + 0.005, sg * 0.545], 'steel')),
        cyl(0.012, 0.012, 'y', [xFI, yFI - 0.036, sg * 0.545], 'steel'), // nut #6
        named(`shearPlate${sd}`, shearPlate(sg)),
      ]),
      named('postBL', bar([XR - 0.36, ry, -0.42], [XR - 0.36, railY(XR - 0.36), -0.55], 0.05, 0.05, 'aluminum')),
      named('postBR', bar([XR - 0.36, ry, 0.42], [XR - 0.36, railY(XR - 0.36), 0.55], 0.05, 0.05, 'aluminum')),
      // upper-link towers on the side members
      named('towerL', bar([XR + 0.17, ry + 0.03, -0.42], [XR + 0.17, WY + 0.165, -0.42], 0.06, 0.05, 'aluminum')),
      named('towerR', bar([XR + 0.17, ry + 0.03, 0.42], [XR + 0.17, WY + 0.165, 0.42], 0.06, 0.05, 'aluminum')),
      // drive-unit mounts: side motor mount #8 on the inboard face of the RH side member and the
      // front / rear transmission mount brackets (LDU group #20 / #21)
      named('sideMount', rbox([0.1, 0.06, 0.075], [XR + 0.13, WY - 0.06, 0.3825], 'rubber', { r: 0.01 })),
      named('frontMount', bar([XR + 0.175, WY - 0.08, 0], [xFC, WY - 0.08, 0], 0.05, 0.06, 'aluminum')),
      named('rearMount', bar([XR - 0.16, WY - 0.042, 0], [XR - 0.345, WY - 0.042, 0], 0.05, 0.06, 'aluminum')),
    ),
  });

  // --- Drive units ------------------------------------------------------------------
  // The halfshafts plug into the side faces of the drive units (z -0.36 / +0.345..0.35).
  const dy = WY - 0.01;
  reg.add({
    id: 'rear-drive-unit-large', ko: '대형 리어 구동 유닛 (LDU)', en: 'Large rear drive unit (LDU)',
    groups: ['motor-large-rear-drive-unit'], variant: { drive: ['rwd', 'pdm'] },
    object: group(
      named('motor', cyl(0.135, 0.275, 'z', [XR + 0.14, dy + 0.02, 0.2075], 'aluminum', { seg: 32 })),
      named('gearbox', rbox([0.395, 0.3, 0.2], [XR + 0.0075, dy, 0.0], 'aluminum', { r: 0.04 })),
      named('inverterEnd', cyl(0.14, 0.25, 'z', [XR + 0.075, dy + 0.02, -0.235], 'darkMetal', { seg: 32 })),
      // inverter cover on top of the inverter end, below the 2nd-row seat
      named('inverter', rbox([0.21, 0.085, 0.3], [XR + 0.105, 0.5125, -0.24], 'darkMetal', { r: 0.02 })),
    ),
  });
  reg.add({
    id: 'rear-drive-unit-small', ko: '소형 리어 구동 유닛 (SDU)', en: 'Small rear drive unit (SDU)',
    groups: ['motor-small-rear-drive-unit'], variant: { drive: 'dm' },
    object: group(
      named('motor', cyl(0.11, 0.28, 'z', [XR + 0.12, dy + 0.02, 0.21], 'aluminum', { seg: 32 })),
      named('gearbox', rbox([0.355, 0.26, 0.18], [XR + 0.0125, dy, 0.0], 'aluminum', { r: 0.04 })),
      named('inverter', rbox([0.205, 0.2, 0.27], [XR + 0.0825, dy + 0.02, -0.225], 'darkMetal', { r: 0.03 })),
    ),
  });
  reg.add({
    id: 'front-drive-unit', ko: '프론트 구동 유닛', en: 'Front drive unit',
    groups: ['front-drive-unit-motor'], variant: { drive: ['dm', 'pdm'] },
    object: group(
      named('motor', cyl(0.11, 0.3, 'z', [XF - 0.125, WY + 0.02, 0.2], 'aluminum', { seg: 32 })),
      named('gearbox', rbox([0.34, 0.26, 0.18], [XF - 0.02, WY, 0.0], 'aluminum', { r: 0.04 })),
      named('inverter', rbox([0.24, 0.2, 0.22], [XF - 0.1, WY + 0.02, -0.2], 'darkMetal', { r: 0.03 })),
      // LHS motor mount #8/#9 on the left subframe rail, torque reaction arm #13 to the rear cross member
      named('mount', rbox([0.155, 0.09, 0.07], [XF + 0.0875, WY - 0.075, -0.31], 'rubber', { r: 0.02 })),
      named('torqueArm', bar([XF - 0.17, WY - 0.12, 0.05], [XF - 0.3, WY - 0.12, 0.05], 0.035, 0.05, 'aluminum')),
    ),
  });
  // Halfshafts: inner spline in the drive unit side face, outer stub splined through the hub
  // bearing in the knuckle (nut M24).  The shaft ends at the knuckle's inboard face; the stub
  // runs from just inside it to the hub flange.
  const shaft = (x, z0, kin, extra = []) => {
    const sd = Math.sign(z0);
    const z1 = sd * (kin + 0.004);
    return group(
      named('shaft', beam([x, WY, z0], [x, WY, z1], 0.017, 'steel')),
      cyl(0.045, 0.06, 'z', [x, WY, z0 + sd * 0.035], 'rubber', { r2: 0.03 }), // inner CV boot at the drive unit face
      cyl(0.045, 0.09, 'z', [x, WY, z1 - sd * 0.05], 'rubber', { r2: 0.03 }),
      named('stub', beam([x, WY, sd * (kin + 0.017)], [x, WY, sd * (kin + 0.085)], 0.012, 'steel')),
      ...extra,
    );
  };
  for (const sd of [-1, 1]) {
    const side = sd < 0 ? 'L' : 'R';
    const ko = sd < 0 ? '좌' : '우';
    const kr = CORNERS.find((k) => !k.front && k.sg === sd);
    const kf = CORNERS.find((k) => k.front && k.sg === sd);
    reg.add({
      id: `rear-halfshaft-${side}`, ko: `리어 하프샤프트 (${ko})`, en: `Rear halfshaft ${side}H`, tags: `${side}B`,
      groups: ['rear-drive-unit-halfshafts'],
      object: shaft(XR, sd < 0 ? -0.35 : 0.34, KNUCKLE_IN(kr)),
    });
    // RH front shaft: jackshaft #3 from the drive unit, flange bolted with #6 M10x25; its support
    // bearing bracket sits against the motor end face
    const jack = sd > 0 ? [
      named('jackshaft', beam([XF, WY, 0.09], [XF, WY, 0.38], 0.02, 'steel')),
      rbox([0.06, 0.06, 0.03], [XF - 0.02, WY, 0.365], 'aluminum', { r: 0.005 }),
    ] : [];
    reg.add({
      id: `front-halfshaft-${side}`, ko: `프론트 하프샤프트 (${ko})`, en: `Front halfshaft ${side}H`, tags: `${side}F`,
      groups: ['front-drive-unit-halfshafts'], variant: { drive: ['dm', 'pdm'] },
      object: shaft(XF, sd > 0 ? 0.38 : -0.30, KNUCKLE_IN(kf), jack),
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
      named('arm', beam([0.71, 0.42, -0.42], [0.86, 0.7, -0.42], 0.01, 'steel')),
      // pushrod to the booster input, PIN BOOSTER TO PEDAL #5 (also in the booster group)
      named('pushrod', beam([0.84, 0.66, -0.42], [1.0, 0.66, bz], 0.008, 'steel')),
    ),
  });
  reg.add({
    id: 'vacuum-booster', ko: '진공 브레이크 부스터', en: 'Vacuum brake booster', tags: 'L',
    groups: ['brake-vacuum-pump-and-booster'], variant: { booster: 'vacuum' },
    match: /BOOSTER|PIN|CLIP|NUT|Sensor - Vacuum|HOSE/i,
    object: group(
      named('booster', cyl(0.12, 0.15, 'x', [1.07, 0.66, bz], 'darkMetal', { seg: 32 })),
      // to the vacuum pump under the LH rail, below the shock tower and inboard of the strut
      named('hose', pipe([[1.07, 0.785, bz], [1.15, 0.71, -0.57], [1.55, 0.4, -0.58], [1.64, 0.36, -0.53], [1.672, 0.36, -0.52]], 0.008, 'rubber', { bend: 0.04 })),
    ),
  });
  reg.add({
    id: 'ibooster', ko: '전기기계식 부스터 (iBooster)', en: 'Electromechanical booster (iBooster)', tags: 'L',
    groups: ['electromechanical-brake-booster'], variant: { booster: 'ibooster' },
    object: group(
      // on the front face of the dash insulation, master cylinder bolted to its front
      cyl(0.08, 0.145, 'x', [1.0675, 0.66, bz], 'aluminum', { seg: 28 }),
      rbox([0.1, 0.12, 0.1], [1.075, 0.66, bz - 0.11], 'darkMetal', { r: 0.012 }),
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
    // pump (#1) hung on its bracket (#2) under the LH front rail
    object: group(
      named('pump', cyl(0.045, 0.11, 'z', [1.72, 0.3555, -0.52], 'darkMetal')),
      named('bracket', rbox([0.09, 0.008, 0.1], [1.72, 0.4045, -0.52], 'steel', { r: 0.003 })),
    ),
  });
  reg.add({
    id: 'abs-module', ko: 'ABS/ESC 유압 제어 유닛(HCU)', en: 'ABS / ESC hydraulic control unit (HCU)', tags: 'R',
    groups: ['abs-module-and-esc-sensor'], match: /HCU|HYDRAULIC|Isolator/i,
    object: group(
      // inboard of the RH wheel arch liner
      rbox([0.13, 0.11, 0.13], [1.2, 0.62, 0.565], 'aluminum', { r: 0.012 }),
      cyl(0.035, 0.07, 'y', [1.2, 0.71, 0.565], 'darkMetal'),
    ),
  });
  reg.add({
    id: 'esc-sensor', ko: 'ESC 센서 클러스터(요레이트)', en: 'ESC sensor cluster (yaw rate)',
    groups: ['abs-module-and-esc-sensor'], match: /ESC SENSOR|NUT,LCK/,
    // on the floor tunnel inside the centre console (lock nuts #4)
    object: rbox([0.07, 0.03, 0.06], [-0.1, 0.331, 0.09], 'darkMetal', { r: 0.006 }),
  });
  // Rear lines split at a junction block bolted to the top of the RH rear-subframe side member;
  // the front-to-rear line runs along the RH sill beside the battery pack, the LH rear line
  // crosses under the drive unit.
  reg.add({
    id: 'brake-lines', ko: '브레이크 라인(하드 파이프)', en: 'Brake lines (hard pipes)',
    groups: ['brake-lines'],
    object: group(
      // master cylinder to the inboard face of the HCU; lines out of its inboard, front and bottom faces
      named('mcToAbs', pipe([[1.31, 0.64, -0.52], [1.2, 0.6, -0.46], [1.18, 0.58, -0.44], [1.18, 0.58, 0.49], [1.18, 0.585, 0.505]], 0.005, 'steel')),
      named('frontL', pipe([[1.185, 0.64, 0.505], [1.183, 0.64, 0.49], [1.18, 0.64, -0.44], [1.22, 0.68, -0.48], [1.25, 0.69, -0.49], [1.27, 0.71, -0.51], [1.35, 0.7, -0.58]], 0.004, 'steel')),
      named('frontR', pipe([[1.26, 0.64, 0.6], [1.35, 0.7, 0.58]], 0.004, 'steel')),
      named('toRear', pipe([[1.18, 0.57, 0.6], [1.15, 0.27, 0.76], [1.13, 0.228, 0.757], [-1.02, 0.228, 0.757], [-1.058, 0.228, 0.74], [-1.06, 0.228, 0.52], [-1.11, 0.28, 0.47], [-1.12, 0.31, 0.47], [-1.13, 0.32, 0.46], [-1.15, 0.322, 0.425]], 0.004, 'steel')),
      // from the junction under the drive unit to the LH wheelhouse, and outboard to the RH one, then up
      // behind the strut to the hose bracket
      named('rearL', pipe([[-1.15, 0.325, 0.42], [-1.15, 0.31, 0.37], [-1.16, 0.235, 0.25], [-1.16, 0.235, -0.25], [-1.25, 0.25, -0.36], [-1.31, 0.31, -0.37], [-1.32, 0.32, -0.38], [-1.39, 0.32, -0.46], [-1.615, 0.34, -0.655], [-1.591, 0.72, -0.632]], 0.004, 'steel')),
      named('rearR', pipe([[-1.15, 0.325, 0.42], [-1.48, 0.32, 0.6], [-1.615, 0.34, 0.655], [-1.591, 0.72, 0.632]], 0.004, 'steel')),
      named('junction', rbox([0.04, 0.02, 0.03], [-1.15, 0.322, 0.42], 'steel', { r: 0.003 })),
    ),
  });

  // Air suspension supply
  reg.add({
    id: 'air-compressor', ko: '에어 서스펜션 컴프레서·밸브 블록', en: 'Air suspension compressor & valve block',
    groups: ['air-suspension-compressor-and-reservoir'], variant: { susp: 'air' },
    match: /COMPRESSOR|SOLENOID|INTAKE|SOL TO|COMP TO|VOSS|BLT - TRX|BLT M6/i,
    object: group(
      named('compressor', cyl(0.055, 0.2, 'x', [1.95, 0.3, -0.56], 'darkMetal', { seg: 24 })),
      named('valveBlock', rbox([0.08, 0.07, 0.08], [1.82, 0.31, -0.56], 'aluminum', { r: 0.01 })),
      // compressor bracket (#8) bolted under the LH front rail (#9), compressor hung from it on
      // three isolators (spring washer #10, spring seat #11, spring #12)
      named('bracket', rbox([0.14, 0.008, 0.1], [1.955, 0.4135, -0.52], 'steel', { r: 0.003 })),
      named('isolators', group([1.9, 1.955, 2.01].map((x) => cyl(0.012, 0.056, 'y', [x, 0.382, -0.56], 'rubber')))),
    ),
  });
  reg.add({
    id: 'air-reservoir', ko: '에어 서스펜션 리저버', en: 'Air suspension reservoir',
    groups: ['air-suspension-compressor-and-reservoir'], variant: { susp: 'air' },
    match: /RESERVOIR|RSVR|RESVR|FILL VALVE/i,
    object: cyl(0.065, 0.26, 'z', [1.95, 0.318, 0.29], 'aluminum', { seg: 24 }), // strapped on the subframe front cross member
  });
  reg.add({
    id: 'air-lines-front', ko: '프론트 에어 라인', en: 'Front air suspension lines', tags: 'F',
    groups: ['front-air-suspension-pressure-lines'], variant: { susp: 'air' },
    object: group(
      // up into the open underside of the shock tower, in front of the strut, to the bellows fitting
      named('toLF', pipe([[1.82, 0.32, -0.59], [1.79, 0.33, -0.59], [1.6, 0.52, -0.6], [1.592, 0.6, -0.597], [1.58, 0.735, -0.594]], 0.004, 'blackPlastic')),
      named('toRF', pipe([[1.79, 0.33, -0.53], [1.74, 0.38, -0.26], [1.74, 0.38, 0.28], [1.72, 0.4, 0.56], [1.69, 0.43, 0.59], [1.6, 0.52, 0.6],
        [1.592, 0.6, 0.597], [1.58, 0.735, 0.594]], 0.004, 'blackPlastic')),
      named('toReservoir', pipe([[1.82, 0.3, -0.55], [1.81, 0.3, -0.28], [1.83, 0.3, 0.04], [1.88, 0.3, 0.09], [1.95, 0.318, 0.165]], 0.004, 'blackPlastic')),  // valve block to reservoir (#4)
    ),
  });
  reg.add({
    id: 'air-lines-rear', ko: '리어 에어 라인(좌측 실 경유)', en: 'Rear air suspension lines (via LH sill)', tags: 'B',
    groups: ['rear-air-suspension-pressure-lines'], variant: { susp: 'air' },
    object: group(
      named('main', pipe([[1.82, 0.316, -0.592], [1.58, 0.26, -0.62], [1.29, 0.25, -0.63], [1.14, 0.23, -0.76], [1.13, 0.232, -0.757], [-0.95, 0.232, -0.757], [-1.05, 0.23, -0.76], [-1.13, 0.28, -0.71], [-1.18, 0.28, -0.72], [-1.19, 0.29, -0.73], [-1.35, 0.45, -0.73], [-1.4, 0.53, -0.69], [-1.43, 0.56, -0.69], [-1.448, 0.6, -0.686]], 0.004, 'blackPlastic')),  // along the LH sill beside the battery pack
      named('toRB', pipe([[-0.96, 0.232, -0.757], [-1.02, 0.23, -0.757], [-1.058, 0.23, -0.74], [-1.06, 0.22, -0.55], [-1.18, 0.21, -0.3], [-1.18, 0.21, 0.3], [-1.18, 0.28, 0.37], [-1.18, 0.31, 0.37], [-1.18, 0.39, 0.4], [-1.18, 0.4, 0.41],
        [-1.23, 0.46, 0.47], [-1.25, 0.48, 0.49], [-1.37, 0.54, 0.61], [-1.448, 0.6, 0.686]], 0.004, 'blackPlastic')),  // crosses under the drive unit
    ),
  });
  reg.add({
    id: 'air-suspension-ecu', ko: '에어 서스펜션 ECU', en: 'Air suspension ECU', tags: 'LB',
    groups: ['module-air-suspension'], variant: { susp: 'air' },
    // ECU (#3) screwed (#4) to its bracket (#1), which is bolted (#2) to the LH body side behind
    // (outboard of) the trunk side trim
    object: group(
      named('ecu', rbox([0.13, 0.09, 0.035], [-1.9, 0.82, -0.915], 'darkMetal', { r: 0.008 })),
      named('bracket', rbox([0.06, 0.07, 0.043], [-1.9, 0.82, -0.954], 'steel', { r: 0.004 })),
    ),
  });
}
