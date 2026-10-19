// 12 V system, controllers, harnesses, sensors, cameras, lighting,
// wipers/washers, horns and infotainment hardware.

import * as THREE from 'three';
import { skinAt, skinNormal, skinPath, findOnFace } from '../body.js';
import { SV } from './exterior.js';
import { SEAT } from './interior.js';
import { STEER } from './chassis.js';
import {
  V, group, named, rbox, box, cyl, beam, bar, tube, pipe, disc, torus, faceTo, mesh,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

const W = 0.011; // harness bundle radius

function sensorOnFace(end, y, z, name) {
  const { p, n } = findOnFace(end, y, z, -0.004);
  const m = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.025, 16), 'paintDark');
  faceTo(m, p, n, 'y');
  return named(name, m);
}

export function buildElectrical(reg) {
  // --- 12 V battery, fuses ---------------------------------------------------------
  reg.add({
    id: '12v-battery', ko: '12V 배터리·트레이·배터리 센서', en: '12 V battery, tray & battery sensor',
    groups: ['12v-battery-and-fittings'], match: /^(?!.*FUSE ?BOX)/,
    object: group(
      rbox([0.14, 0.18, 0.24], [1.07, 0.65, -0.13], 'battery', { r: 0.01 }),
      box([0.16, 0.02, 0.26], [1.07, 0.55, -0.13], 'steel'),
      cyl(0.012, 0.02, 'y', [1.07, 0.75, -0.2], 'copper'),
      cyl(0.012, 0.02, 'y', [1.07, 0.75, -0.06], 'steel'),
      rbox([0.05, 0.04, 0.05], [1.11, 0.76, -0.24], 'darkMetal', { r: 0.006 }),
    ),
  });
  reg.add({
    id: 'fusebox-front', ko: '프론트(프렁크) 12V 퓨즈박스', en: 'Front (frunk) 12 V fuse box',
    groups: ['relays-and-fuses', '12v-battery-and-fittings'], match: /FUSE|RELAY|FUSEBOX|LUG|NUT/,
    object: group(
      // beside the 12 V battery (not overlapping its case)
      rbox([0.16, 0.08, 0.2], [1.07, 0.72, 0.092], 'blackPlastic', { r: 0.012 }),
      box([0.14, 0.01, 0.18], [1.07, 0.765, 0.092], 'greyPlastic'),
    ),
  });
  reg.add({
    id: 'fusebox-cabin', ko: '캐빈(조수석 풋웰) 퓨즈박스', en: 'Cabin fuse box (passenger footwell)', tags: 'R',
    groups: ['relays-and-fuses', '12v-battery-and-fittings'], match: /FUSE|RELAY|CABIN/,
    object: rbox([0.06, 0.18, 0.16], [0.78, 0.52, 0.66], 'blackPlastic', { r: 0.012 }),
  });
  reg.add({
    id: 'accelerator-pedal', ko: '가속 페달', en: 'Accelerator pedal', tags: 'L',
    groups: ['accelerator-pedal'],
    // hanging pedal: the module (#1, sensor housing on its mounting plate) on two studs / M6 nuts
    // (#3) low on the bulkhead below the HVAC case, the arm down under the main harness and back to
    // the pad (#2) above the toe board
    object: group(
      named('module', group(
        box([0.008, 0.11, 0.07], [0.971, 0.48, -0.24], 'steel'),
        rbox([0.03, 0.07, 0.06], [0.952, 0.47, -0.24], 'blackPlastic', { r: 0.008 }),
      )),
      named('arm', pipe([[0.945, 0.445, -0.24], [0.93, 0.433, -0.24], [0.81, 0.432, -0.24]], 0.006, 'darkMetal', { bend: 0.02 })),
      named('pad', rbox([0.015, 0.12, 0.07], [0.775, 0.385, -0.24], 'blackPlastic', { r: 0.006, rot: [0, 0, -0.5] })),
    ),
  });
  reg.add({
    id: 'body-controller', ko: '보디 컨트롤러·홈링크 모듈(운전석 풋웰)', en: 'Body controller & HomeLink (driver footwell)', tags: 'L',
    groups: ['body-controllers'],
    // hung from the footwell electronics mount (#6) under the cross-car beam, above the hood release handle
    object: group(
      named('mount', box([0.18, 0.006, 0.06], [0.79, 0.698, -0.66], 'steel')),
      named('controller', rbox([0.16, 0.12, 0.04], [0.8, 0.635, -0.66], 'darkMetal', { r: 0.008 })),
      rbox([0.1, 0.07, 0.03], [0.83, 0.655, -0.625], 'darkMetal', { r: 0.008 }),
    ),
  });

  // --- Door / liftgate controllers --------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `door-controller-${sd}`, ko: `도어 컨트롤러 (${ko})`, en: `Door controller ${en}`, tags: sd,
      groups: ['door-controllers-and-sensors'], match: /DOOR CONTROLLER|BOLT,TPG,TORXPLUS/,
      // in the front door, screwed (#2) to the inner panel behind the trim pad
      object: rbox([0.14, 0.1, 0.018], [0.3, 0.46, sg * 0.932], 'darkMetal', { r: 0.006 }),
    });
  }
  reg.add({
    id: 'liftgate-ecu', ko: '파워 리프트게이트·전자식 주차브레이크 ECU', en: 'Power liftgate & EPB controller', tags: 'RB',
    groups: ['door-controllers-and-sensors', 'park-brake-calipers-and-pads'], match: /LIFT ?GATE|ECU|PARK BRAKE CONTROLLER|CHIME|NUT|BLT/,
    // the power liftgate module (#3) and the park brake controller side by side on their shared bracket
    // (#4), bolted to the RH rear quarter inner panel above the wheelhouse, behind the trunk side trim
    object: group(
      named('ecu', rbox([0.15, 0.1, 0.025], [-1.64, 0.885, 0.9275], 'darkMetal', { r: 0.006 })),
      rbox([0.12, 0.08, 0.025], [-1.795, 0.885, 0.9275], 'darkMetal', { r: 0.006 }),
      named('bracket', box([0.3, 0.11, 0.006], [-1.71, 0.885, 0.943], 'steel')),
    ),
  });
  reg.add({
    id: 'park-assist-ecu', ko: '주차 보조 ECU', en: 'Park assist ECU', tags: 'RB',
    groups: ['module-park-assist'],
    // on its bracket (#3) on the RH rear quarter inner panel, below the park brake controller, behind
    // the trunk side trim
    object: group(
      named('ecu', rbox([0.13, 0.08, 0.025], [-1.795, 0.78, 0.9275], 'darkMetal', { r: 0.006 })),
      named('bracket', box([0.1, 0.1, 0.006], [-1.795, 0.78, 0.943], 'steel')),
    ),
  });

  // --- Harnesses ----------------------------------------------------------------------
  // Main (lower dash) harness: across the footwells just ahead of the firewall, from the body
  // controller (LH) to the cabin fuse box (RH).  The body, motor bay and console harnesses
  // plug into it; they start on its control points (a Catmull-Rom tube passes through them).
  const LD = [[0.84, 0.562, -0.66], [0.89, 0.5, -0.6], [0.9, 0.47, -0.45], [0.9, 0.465, 0], [0.9, 0.47, 0.45], [0.88, 0.49, 0.6], [0.82, 0.52, 0.655]];
  const toe = (x) => 0.2975 + (x - 0.72) * 0.456 + W + 0.0045; // harness centre lying on the toe board
  for (const { sd, sg, ko, en } of SIDES) {
    // #lead: off the main harness forward to the dash insulator, outboard along it through the hole in the
    // kick panel's front closeout (y 0.462-0.497) and down between the insulator and the front flange of the
    // A-pillar lower trim (pillar-trim-*#kickPanel),
    // back along the outboard edge of the toe board behind that trim, then along the sill under the scuff
    // plate (rocker-*#scuff), outboard of the carpet edge, to the B-pillar foot, where the rear door
    // harness plugs in.
    // #rearLead: on under the scuff plate and the rear footwell corner, up the front of the rear
    // wheelhouse just behind the rear door (inboard of its seal), against the lock pillar and over the
    // wheelhouse near the body side, behind the C-pillar lower trim and the trunk side trim: LH to the
    // air suspension ECU (the rear bumper harness plugs in there); RH to the junction above the
    // wheelhouse where the rear subframe harness plugs in, and #trunkLead on under the liftgate / park
    // brake ECU to the park assist ECU.
    const zs = sg * 0.765;
    const floor = [sg < 0 ? LD[1] : LD[5], [0.958, 0.495, sg * 0.665], [0.958, 0.481, sg * 0.768], [0.952, toe(0.952), sg * 0.772], [0.84, toe(0.84), sg * 0.767],
      [0.76, toe(0.76), sg * 0.766], [0.7, 0.312, zs], [0.2, 0.312, zs], [-0.32, 0.312, zs]];
    // (the climb is clipped to the top of the wheelhouse arch at |z| 0.835, 0.452 from the wheel centre, well
    // inboard of the C-pillar lower trim's outboard return and the lock pillar; it turns outboard to the body
    // side only behind the lock pillar)
    const climb = [[-0.32, 0.312, zs], [-0.7, 0.312, zs], [-0.9, 0.318, sg * 0.766], [-0.945, 0.335, sg * 0.766],
      [-0.952, 0.392, sg * 0.767], [-0.968, 0.432, sg * 0.8], [-0.986, 0.461, sg * 0.835], [-1.015, 0.543, sg * 0.835],
      [-1.064, 0.624, sg * 0.835], [-1.123, 0.688, sg * 0.84], [-1.2, 0.752, sg * 0.88], [-1.32, 0.806, sg * 0.915], [-1.48, 0.815, sg * 0.915]];
    const toAirEcu = [[-1.62, 0.822, -0.915], [-1.76, 0.812, -0.915], [-1.834, 0.8, -0.915]];
    reg.add({
      id: `cabin-harness-${sd}`, ko: `캐빈(보디) 하네스 (${ko})`, en: `Cabin (body) harness ${en}`, tags: sd,
      groups: ['cabin-harness'],
      object: group(
        named('lead', pipe(floor, W, 'wire', { bend: 0.04 })),
        named('rearLead', pipe(sg < 0 ? [...climb, ...toAirEcu] : climb, W, 'wire', { bend: 0.04 })),
        ...(sg > 0 ? [named('trunkLead', pipe([[-1.48, 0.815, 0.915], [-1.6, 0.826, 0.915], [-1.69, 0.8, 0.915], [-1.729, 0.785, 0.915]],
          W, 'wire', { bend: 0.03 })),
        // branch up into the connector on the lower face of the power liftgate module
        named('ecuLead', pipe([[-1.585, 0.826, 0.917], [-1.592, 0.829, 0.924], [-1.595, 0.8375, 0.9275]], 0.005, 'wire', { bend: 0.004 })),
        rbox([0.03, 0.012, 0.022], [-1.595, 0.829, 0.9275], 'blackPlastic', { r: 0.003 })] : []),
      ),
    });
    // through the bulkhead grommet (ASY, PLATE A / PLATE B, BULKHEAD GROMMET) and along the top of
    // the front rail; the RH one runs along the inboard top edge of the rail, under the frunk tub
    // flange and inboard of the DC-DC converter.  Both end on the front-end module harness.
    const rail = sg < 0
      ? [[1.5, 0.493, -0.462], [1.95, 0.512, -0.462]]
      : [[1.5, 0.493, 0.462], [1.6, 0.519, 0.432], [1.97, 0.519, 0.432], [2.053, 0.522, 0.452]];
    reg.add({
      id: `motor-bay-harness-${sd}`, ko: `모터룸(프론트 레일) 하네스 (${ko})`, en: `Motor bay (front rail) harness ${en}`, tags: sd,
      groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /FRONT (LEFT|RIGHT)|FR,(LT|RT)|RAIL FR|BODY, FRONT|BRACKET, CONNECTORS|BULKHEAD GROMMET/,
      object: group(
        // cabin side: from the main harness to the grommet
        named('dashLead', tube([sg < 0 ? LD[2] : LD[4], [0.94, 0.48, sg * 0.45], [0.973, 0.49, sg * 0.45]], W, 'wire')),
        // the grommet fills the hole through the bulkhead and its dash insulation
        named('grommet', cyl(0.02, 0.024, 'x', [0.986, 0.49, sg * 0.45], 'rubber')),
        // RH: #lead ends on the rail top ahead of the DC-DC converter and #frontLead carries on, so the
        // converter's LV pigtail plugs into a short piece
        ...(sg < 0
          ? [named('lead', pipe([[0.999, 0.49, sg * 0.45], [1.1, 0.477, sg * 0.462], ...rail, [2.06, 0.652, sg * 0.455]],
            W, 'wire', { bend: 0.05 }))]
          : [named('lead', pipe([[0.999, 0.49, sg * 0.45], [1.1, 0.477, sg * 0.462], ...rail.slice(0, 2), [1.88, 0.519, 0.432]],
            W, 'wire', { bend: 0.05 })),
            named('frontLead', pipe([[1.88, 0.519, 0.432], ...rail.slice(2), [2.06, 0.652, sg * 0.455]], W, 'wire', { bend: 0.05 }))]),
      ),
    });
  }
  reg.add({
    id: 'lower-dash-harness', ko: '메인(하부 대시) 하네스', en: 'Main (lower dash) harness',
    groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /LOWER ?DASH|DASH LWR|FIRST RESPONDER|Body Main|CABLE TIE|CBL TIE|CLIP/,
    object: group(
      // up into its connector on the lower face of the body controller
      named('trunk', tube([[0.84, 0.578, -0.66], ...LD], W * 1.3, 'wire')),
      named('connector', rbox([0.045, 0.02, 0.036], [0.84, 0.565, -0.66], 'blackPlastic', { r: 0.004 })),
    ),
  });
  reg.add({
    id: 'dcdc-pigtail', ko: 'DC-DC 컨버터 저전압 피그테일', en: 'DC-DC converter LV pigtail', tags: 'R',
    groups: ['dc-dc-converter-1st-generation', 'main-lower-dash-and-motor-bay-harnesses'], match: /PGTL/,
    // from the signal connector on the front end of the converter, round its front inboard corner
    // below the frunk tub flange to the RH front body harness
    object: named('lead', tube([[1.928, 0.55, 0.48], [1.945, 0.548, 0.475], [1.945, 0.522, 0.448], [1.945, 0.519, 0.436]], 0.006, 'wire')),
  });
  reg.add({
    id: 'dash-harness', ko: '대시·콘솔 하네스', en: 'Dash & console harness',
    groups: ['dash-and-console-harnesses'],
    object: group(
      // instrument panel harness: inside the dash above the HVAC case, out to both A-pillars
      // (front door and headliner harnesses)
      named('ip', tube([[0.875, 0.83, -0.84], [0.8, 0.855, -0.76], [0.75, 0.88, -0.6], [0.75, 0.88, 0], [0.75, 0.88, 0.6],
        [0.8, 0.855, 0.76], [0.875, 0.83, 0.84]], W, 'wire')),
      // centre console harness: down behind the HVAC case past the main harness connector, under the
      // case and forward to the USB media hub on the front face of the console
      named('console', tube([[0.75, 0.88, -0.05], [0.875, 0.82, -0.05], [0.875, 0.56, -0.055], [0.882, 0.47, -0.05],
        [0.79, 0.395, -0.055], [0.6, 0.372, -0.055], [0.47, 0.37, -0.05], [0.4115, 0.37, -0.05]], W, 'wire')),
    ),
  });
  // Door harnesses with grommet.  Front: from the IP harness near the A-pillar through the hinge
  // pillar between the two hinges into the door, then between the door inner panel and the trim pad
  // to the door controller.  Rear: from the end of the body harness under the scuff plate, up behind
  // the belt retractor into the foot of the B-pillar below its trim, out of the pillar below the lower
  // hinge into the rear door, then between the inner panel and the trim pad to the latch.
  for (const { sd, sg, ko, en } of SIDES) {
    const [r0, r1] = SV.rearDoor;
    reg.add({
      id: `door-harness-${sd}F`, ko: `앞 도어 하네스 (${ko})`, en: `Front door harness ${en}`, tags: `${sd}F`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|MIRROR|GSM|Wi-Fi/,
      object: named('lead', pipe([[0.8, 0.855, sg * 0.76], [0.875, 0.77, sg * 0.845], [0.885, 0.72, sg * 0.9], [0.85, 0.7, sg * 0.937],
        [0.8, 0.69, sg * 0.939], [0.55, 0.6, sg * 0.935], [0.4, 0.52, sg * 0.928], [0.36, 0.48, sg * 0.93]], 0.008, 'wire', { bend: 0.04 })),
    });
    reg.add({
      id: `door-harness-${sd}B`, ko: `뒤 도어 하네스 (${ko})`, en: `Rear door harness ${en}`, tags: `${sd}B`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|EDGE CLIP/,
      object: named('lead', pipe([[-0.305, 0.312, sg * 0.765], [-0.303, 0.372, sg * 0.767], [-0.295, 0.43, sg * 0.8], [-0.278, 0.466, sg * 0.845],
        [-0.265, 0.468, sg * 0.86], [-0.262, 0.468, sg * 0.928],
        [-0.3, 0.5, sg * 0.928], [-0.4, 0.62, sg * 0.932], skinAt(r0 + 0.12, 1.45, sd, -0.05), skinAt((r0 + r1) / 2, 1.6, sd, -0.05),
        [-0.95, 0.89, sg * 0.946], [-0.99, 0.905, sg * 0.946], skinAt(r1 - 0.04, 1.75, sd, -0.03)], 0.008, 'wire', { bend: 0.04 })), // its connector into the latch
    });
    // liftgate harnesses: from the headliner harness T at the rear header (above the headliner), in front
    // of the liftgate hinge and outboard along the header between the pano cassette's rear corner and the
    // opening seal, under the rear roof drain tube, then over the seal where it turns down the side
    // (between the seal and the liftgate panel) onto the liftgate and down its side frame in the band
    // behind the liftgate trim, outboard of the glass (under the drain tube again where it crosses the
    // band), to the rear camera (LH) or the latch (RH); offsets are along the skin normal (skin 0, trim and
    // headliner -0.035)
    const lgPts = [[3.24, 4.65, -0.018], [3.205, 4.635, -0.022], [3.185, 4.59, -0.022], [3.185, 4.49, -0.022], [3.24, 4.42, -0.022],
      [3.25, 4.24, -0.024], [3.255, 4.16, -0.029], [3.265, 4.1, -0.022], [3.3, 4.09, -0.0085], [3.33, 4.095, -0.02],
      [3.37, 4.095, -0.028], [3.43, 4.095, -0.022], [3.6, 4.095, -0.02], [3.9, 4.095, -0.02], [4.2, 4.095, -0.02], [4.4, 4.095, -0.02],
      [4.7, 4.15, -0.02], [4.85, 4.15, -0.02]];
    const lg = lgPts.map(([s, v, o]) => skinAt(s, v, sd, o));
    if (sg < 0) lg.push(skinAt(4.85, 4.6, sd, -0.02), findOnFace('rear', 0.86, -0.06, -0.022).p, findOnFace('rear', 0.864, -0.004, -0.024).p);
    else lg.push(findOnFace('rear', 0.84, 0.3, -0.022).p, findOnFace('rear', 0.795, 0.15, -0.022).p, findOnFace('rear', 0.782, 0.06, -0.022).p);
    reg.add({
      id: `liftgate-harness-${sd}`, ko: `리프트게이트 하네스 (${ko})`, en: `Liftgate harness ${en}`, tags: sd,
      groups: ['doors-and-liftgate-harnesses'], match: /LIFTGATE/,
      object: group(
        named('lead', pipe(lg, 0.006, 'wire', { bend: 0.03 })),
        // connector lead off it on the header, over the seal to the AM/FM antenna amplifier on the liftgate
        named('ampLead', pipe([[3.245, 4.36, -0.022], [3.275, 4.355, -0.011], [3.3, 4.355, -0.0075], [3.335, 4.355, -0.012]]
          .map(([s, v, o]) => skinAt(s, v, sd, o)), 0.005, 'wire', { bend: 0.01 })),
      ),
    });
  }
  reg.add({
    id: 'front-end-harness', ko: '프론트 엔드·앞 범퍼 하네스', en: 'Front end & front bumper harness',
    groups: ['front-end-and-front-bumper-harness'], match: /HRN|HARN|FEM|BUMP/,
    object: group(
      // front bumper harness: off the module harness outboard of the LH carrier post, below the
      // headlamp housing down to the LH horn, behind the six park assist sensors to the RH horn
      named('bumper', tube([[2.07, 0.655, -0.675], [2.075, 0.585, -0.685], [2.18, 0.52, -0.7], [2.26, 0.405, -0.65], [2.386, 0.431, -0.69],
        [2.445, 0.434, -0.457], [2.449, 0.436, -0.172], [2.449, 0.436, 0.172], [2.445, 0.434, 0.457], [2.386, 0.431, 0.69], [2.26, 0.405, 0.65]], 0.008, 'wire')),
      // front-end module harness: from the connector on the back of one headlamp housing to the
      // other, behind the bumper carrier top bar; the motor bay harnesses plug into it
      named('module', pipe([[2.106, 0.66, -0.72], [2.07, 0.66, -0.69], [2.06, 0.66, -0.6], [2.06, 0.66, 0.6], [2.07, 0.66, 0.69],
        [2.106, 0.66, 0.72]], 0.009, 'wire', { bend: 0.03 })),
    ),
  });
  // headliner harness, between the roof and the headliner: up the LH A-pillar behind its trim from
  // the IP harness, inboard along the front header (over the front roof drain) and a spine back
  // along the roof to the rear dome light, with a lead along the front header to the overhead
  // console and the T at the rear header where the liftgate harnesses plug in
  reg.add({
    id: 'roof-harness', ko: '파노라믹 루프·헤드라이닝 하네스', en: 'Panoramic roof & headlining harness',
    groups: ['panoramic-roof-and-head-lining-harness'],
    object: group(
      // (from the IP harness end inside the IP side cover up inside the hinge pillar's closed section into the
      // A-pillar root under the body side outer, over the tweeter pocket behind the pillar trim; then in short
      // chords that follow the skin: up the A-pillar 1 mm outboard of the pillar trim at offset -0.03, beside the
      // front roof drain tube (which runs on its windshield side and crosses under it at the pillar root,
      // s 1.625 v 3.74); along the roof between
      // the pano frame at -0.02 and the headliner at -0.035)
      named('header', pipe([[0.875, 0.83, -0.84], [0.89, 0.87, -0.83], [0.889, 0.945, -0.8], [0.862, 0.958, -0.76], skinAt(1.645, 3.88, 'L', -0.01),
        skinAt(1.675, 3.96, 'L', -0.016), ...skinPath([[1.7, 4.02], [2.34, 4.02]], 'L', -0.024, 11),
        skinAt(2.345, 4.2, 'L', -0.012), skinAt(2.35, 4.5, 'L', -0.018),
        skinAt(2.4, 4.75, 'L', -0.024), ...skinPath([[2.5, 4.75], [3.2, 4.75]], 'L', -0.026, 10),
        skinAt(3.25, 4.85, 'L', -0.026)], 0.005, 'wire', { bend: 0.05 })),
      named('consoleLead', pipe([skinAt(2.35, 4.5, 'L', -0.018), skinAt(2.3, 4.55, 'L', -0.018), skinAt(2.298, 4.8, 'L', -0.022),
        skinAt(2.298, 4.85, 'L', -0.04)], 0.006, 'wire', { bend: 0.03 })),
      named('rearT', tube([skinAt(3.24, 4.65, 'L', -0.018), skinAt(3.24, 5, 'L', -0.018), skinAt(3.24, 4.65, 'R', -0.018)], 0.008, 'wire')),
    ),
  });
  reg.add({
    id: 'rear-bumper-harness', ko: '뒤 범퍼 하네스', en: 'Rear bumper harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /BUMP|BUMPER|PKA|SENSOR/,
    // from the LH body harness at the front face of the air suspension ECU, down behind (outboard of)
    // the trunk side trim and inboard of the charge-port cable, past the charge port to the bumper and
    // just behind the six park assist sensors
    object: named('lead', tube([[-1.834, 0.8, -0.915], [-1.83, 0.765, -0.905], [-1.86, 0.715, -0.886], [-1.95, 0.66, -0.883],
      [-2.05, 0.6, -0.86], [-2.15, 0.56, -0.79], [-2.3, 0.475, -0.725], [-2.376, 0.47, -0.71],
      [-2.446, 0.478, -0.454], [-2.45, 0.477, -0.169], [-2.45, 0.477, 0.169], [-2.446, 0.478, 0.454], [-2.376, 0.47, 0.71]], 0.008, 'wire')),
  });
  reg.add({
    id: 'rear-subframe-harness', ko: '리어 서브프레임 하네스', en: 'Rear subframe harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /SUBFRAME|FEP/,
    // from the RH body harness junction above the wheelhouse, down over the back of the wheelhouse
    // behind the trunk side trim, below the park assist ECU, back outboard of the finisher wall (|z| 0.868)
    // behind the trunk bracket and down through a grommet in the outboard flange of the trunk floor
    // extension shelf under the finisher, then inboard and forward under the shelf and over the wheelhouse
    // inner wall, down inboard of the rail to the subframe, across on top of the rear cross member behind
    // the drive unit
    object: group(
      named('lead', pipe([[-1.4815, 0.805, 0.908], [-1.58, 0.785, 0.905], [-1.68, 0.745, 0.905], [-1.75, 0.715, 0.9],
        [-1.84, 0.712, 0.895], [-1.87, 0.7, 0.895], [-1.87, 0.645, 0.895], [-1.85, 0.638, 0.82], [-1.8, 0.632, 0.72],
        [-1.785, 0.632, 0.61], [-1.78, 0.62, 0.58], [-1.76, 0.49, 0.48], [-1.72, 0.33, 0.42], [-1.73, 0.345, 0], [-1.74, 0.321, -0.42]],
      0.009, 'wire', { bend: 0.03 })),
      named('grommet', cyl(0.015, 0.014, 'y', [-1.87, 0.676, 0.895], 'rubber')),
    ),
  });
  // --- Parking sensors, radar, cameras ---------------------------------------------------
  const sensorGroupsF = ['parking-sensors-park-assist', 'parking-sensors-driver-assist', 'front-end-and-front-bumper-harness'];
  const sensorGroupsR = ['parking-sensors-park-assist', 'parking-sensors-driver-assist', 'rear-bumper-and-subframe-harness'];
  // retainers S1-S6 (front) and S7-S12 (rear), numbered from the LH side
  reg.add({
    id: 'park-sensors-front', ko: '주차 센서 - 앞 범퍼 (6개)', en: 'Parking sensors - front bumper (6)', tags: 'F',
    groups: sensorGroupsF, match: /SENSOR|RETAINER/,
    object: group([-0.7, -0.46, -0.17, 0.17, 0.46, 0.7].map((z, i) => sensorOnFace('front', 0.43, z, `S${i + 1}`))),
  });
  reg.add({
    id: 'park-sensors-rear', ko: '주차 센서 - 뒤 범퍼 (6개)', en: 'Parking sensors - rear bumper (6)', tags: 'B',
    groups: sensorGroupsR, match: /SENSOR|RETAINER/,
    object: group([-0.72, -0.46, -0.17, 0.17, 0.46, 0.72].map((z, i) => sensorOnFace('rear', 0.47, z, `S${i + 7}`))),
  });
  {
    const { p, n } = findOnFace('front', 0.36, 0.22, -0.05);
    const radar = rbox([0.07, 0.07, 0.1], [0, 0, 0], 'blackPlastic', { r: 0.01 });
    faceTo(radar, p, n, 'x');
    reg.add({
      id: 'radar', ko: '전방 레이더·브래킷', en: 'Forward radar & brackets',
      groups: ['radar-sensors', 'cooling-system-air-ducting'], match: /FORWARD RADAR|BRKT, RADAR/i,
      // the radar bracket sub-assembly (#2) and the structure bracket (#3) hold it on the front
      // ducting: a tab on the inboard face of the radar and a strap back to the lower duct, clear of
      // the ankle catcher and the RH active louvre
      object: group(
        named('sensor', radar),
        named('bracket', group(
          box([0.02, 0.07, 0.035], [2.385, 0.335, 0.1625], 'steel'),
          bar([2.385, 0.305, 0.155], [2.306, 0.252, 0.155], 0.006, 0.016, 'steel'),
        )),
      ),
    });
  }
  reg.add({
    id: 'forward-camera', ko: '전방 카메라(모노캠)', en: 'Forward-facing camera (monocam)',
    groups: ['forward-facing-camera'],
    // on its windshield bracket, between the overhead console and the rear-view mirror base
    object: rbox([0.05, 0.04, 0.08], skinAt(2.26, 5, 'L', -0.0265).toArray(), 'blackPlastic', { r: 0.008 }),
  });
  {
    const { p, n } = findOnFace('rear', 0.865, 0, -0.012); // set in the liftgate applique, above the handle
    const cam = cyl(0.014, 0.03, 'x', [0, 0, 0], 'blackPlastic');
    faceTo(cam, p, n, 'y');
    reg.add({ id: 'rear-camera', ko: '후방 카메라', en: 'Rear-view camera', tags: 'B', groups: ['rear-view-camera'], object: cam });
  }

  // --- Lighting / switches / misc --------------------------------------------------------
  reg.add({
    id: 'dome-light-front', ko: '앞 실내등(맵 라이트)', en: 'Front dome / map light', tags: 'F',
    groups: ['dome-lights'], match: /FRT|FRONT/,
    object: rbox([0.08, 0.02, 0.2], skinAt(2.42, 5, 'L', -0.04).toArray(), 'lensClear', { r: 0.008 }),
  });
  reg.add({
    id: 'dome-light-rear', ko: '뒤 실내등', en: 'Rear dome light', tags: 'B',
    groups: ['dome-lights'], match: /REAR|RR/,
    // set in the headliner opening (its back above the headliner, where the harness plugs in)
    // between the pano roof cassette and the liftgate opening seal
    object: rbox([0.06, 0.02, 0.3], skinAt(3.24, 5, 'L', -0.032).toArray(), 'lensClear', { r: 0.008 }),
  });
  reg.add({
    id: 'switches', ko: '비상등·글로브박스 스위치, 스티어링 스위치', en: 'Hazard, glove box & steering switches',
    groups: ['switches'],
    object: group(
      // hazard (#2) and glove box (#3) switches in the touchscreen surround, under its bottom edge
      named('hazard', rbox([0.02, 0.025, 0.05], [0.468, 0.581, 0.0], 'blackPlastic', { r: 0.004 })),
      named('gloveBox', rbox([0.02, 0.025, 0.05], [0.468, 0.581, 0.07], 'blackPlastic', { r: 0.004 })),
      // steering control switch harness (#1 = front air bags #2): scroll wheels clipped into the
      // spokes against the edge of the driver airbag, wired inside the spokes outboard of the airbag
      // module, then in behind its back face to the hub (placed in the steering wheel frame, STEER in
      // chassis.js: u across, w along the column; the airbag spans w -0.031 .. -0.001, radius 0.074)
      ...[['L', 1], ['R', -1]].flatMap(([sd, u]) => [
        named(`scroll${sd}`, cyl(0.015, 0.01, 'x', STEER.at(u * 0.086, 0.0014, -0.0214), 'chrome', { seg: 32, rot: [0, 0, Math.PI / 2 - STEER.tilt] })),
        named(sd === 'L' ? 'steeringHarness' : 'steeringHarnessR', pipe([STEER.at(u * 0.086, 0.0012, -0.017),
          STEER.at(u * 0.085, 0.0012, 0.006), STEER.at(u * 0.03, 0.0015, 0.004)], 0.004, 'wire', { bend: 0.008 })),
      ]),
    ),
  });
  reg.add({
    id: 'key-fob', ko: '키 포브', en: 'Key fob',
    groups: ['key-fob'],
    object: group(
      rbox([0.085, 0.022, 0.04], [0.2, 0.547, 0], 'paintDark', { r: 0.01 }), // lying on the console insert
    ),
  });
  reg.add({
    id: 'passive-entry', ko: '패시브 엔트리 안테나(콘솔·IP 엔드캡·뒤 범퍼)', en: 'Passive entry antennas (console, IP end caps, rear bumper)',
    groups: ['remote-and-passive-entry'],
    object: group(
      // LF coils (#1, ring-shaped, qty 5) lying on the carpeted tunnel floor inside the centre console shell: the
      // front one in the dead key fob bracket (#10, push-pull rivets #11); the rear one stands for one of the
      // coils whose location the catalog does not give, drawn in the console's rear end
      named('consoleCoil', torus(0.022, 0.007, 'y', [0.32, 0.3177, 0], 'blackPlastic')),
      named('rearCoil', torus(0.022, 0.007, 'y', [-0.33, 0.3177, 0], 'blackPlastic')),
      // rectangular antennas (#4): two fore-aft against the inside of the IP end caps' outer walls (SCR M4 #9), set
      // 1 mm (the moulded wall thickness; the cap wall at |z| 0.838 is drawn as a bare surface) inboard of it; the third in
      // the rear bumper
      ...SIDES.map(({ sd, sg }) => named(`ipAntenna${sd}`, rbox([0.14, 0.025, 0.012], [0.62, 0.85, sg * 0.831], 'blackPlastic', { r: 0.003 }))),
      rbox([0.04, 0.025, 0.14], [-2.33, 0.56, 0], 'blackPlastic', { r: 0.006 }),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `horn-${sd}`, ko: `경음기 (${ko})`, en: `Horn ${en}`, tags: sd,
      groups: ['horns'], match: sg < 0 ? /HI TONE|510 Hz|BLT|NUT|CLIP|SEAL/ : /LOW TONE|410 Hz|SIREN|BBS|BLT|NUT|CLIP|SEAL/,
      // RC horn (#1/#2, located on the front end module): its integral bracket, a strap from the back of
      // the horn whose end is bent down into a tab lying flat on the front face of the fascia carrier's side post
      // (which leans back 3.6 deg) and bolted through it (the later 510/410 Hz horns bolt to the centre active louver
      // with BLT M6x20 #3 instead)
      object: group(
        named('horn', disc(0.05, 0.03, 'x', [2.26, 0.38, sg * 0.6], 'blackPlastic')),
        named('bracket', box([0.1025, 0.005, 0.04], [2.19375, 0.4, sg * 0.615], 'steel')),
        named('tab', (() => {
          const P = (y) => new THREE.Vector3(2.13 - 0.03 * (y - 0.218) / 0.482, y, sg * 0.615); // post axis (structure.js)
          const n = new THREE.Vector3(0.482, 0.03, 0).normalize(); // post front-face normal; the face is 20 mm off the axis
          const m = bar(P(0.38).addScaledVector(n, 0.022), P(0.42).addScaledVector(n, 0.022), 0.004, 0.04, 'steel');
          delete m.userData.span; // a 40 x 40 mm tab, not a linear member
          return m;
        })()),
      ),
    });
  }
  reg.add({
    id: 'washer-bottle', ko: '워셔액 탱크·펌프', en: 'Washer fluid bottle & pump', tags: 'RF',
    groups: ['windshield-washer-bottle-and-pump'],
    // bolted (M6 nut washers #9) to the outboard face of the RH front rail, ahead of the wheel arch;
    // pump (#2) low on the outboard face
    object: group(
      named('bottle', rbox([0.12, 0.2, 0.14], [2.015, 0.43, 0.628], 'lensClear', { r: 0.03 })),
      cyl(0.022, 0.05, 'y', [2.015, 0.555, 0.628], 'blackPlastic'),
      named('pump', cyl(0.016, 0.04, 'z', [2.03, 0.37, 0.715], 'blackPlastic')),
    ),
  });
  reg.add({
    id: 'washer-nozzles', ko: '워셔 노즐·튜브', en: 'Washer nozzles & tubing', tags: 'F',
    groups: ['windshield-washer-nozzle-and-tubing'],
    // hose from the pump up over the bottle, along the outboard side of the frunk to the RH hood
    // hinge, up outboard of the hinge to the hood (jumper hose #3) and across under the hood (hood section #2) to the
    // two nozzles (#1), which clip into the hood from below with their jets in its surface
    object: group(
      named('hose', pipe([[2.03, 0.37, 0.735], [2.045, 0.56, 0.725], [2.02, 0.64, 0.6], [1.9, 0.7, 0.475], [1.3, 0.7, 0.47],
        [1.1, 0.72, 0.5], [1.05, 0.82, 0.61], [1.04, 0.9, 0.63], [1.03, 0.925, 0.62], skinAt(1.46, 4.3, 'R', -0.02),
        skinAt(1.46, 4.75, 'R', -0.02), skinAt(1.46, 4.75, 'L', -0.02), skinAt(1.46, 4.3, 'L', -0.02)], 0.004, 'rubber', { bend: 0.04 })),
      ...SIDES.map(({ sd }) => named(`nozzle${sd}`, group(
        rbox([0.03, 0.015, 0.03], skinAt(1.46, 4.3, sd, -0.008).toArray(), 'blackPlastic', { r: 0.005 }),
        beam(skinAt(1.46, 4.3, sd, -0.02), skinAt(1.46, 4.3, sd, -0.012), 0.004, 'rubber'),
      ))),
    ),
  });
  {
    // Wiper module (#1) in the cowl plenum (floor-pan#plenum) under the cowl screen: its tube frame
    // runs from the LH pivot to the motor crank housing at the RH (inboard) pivot, with the drive link
    // to the LH pivot.  Three BOLT M6x25 (#2) hold it on the plenum: at the LH pivot end, under the
    // motor crank housing and through the WIPER MOUNTING BRACKET COWL PLENUM (#3) at the motor end.
    // The pivot spindles rise through the cowl screen openings; on each the arm (#6 LH, #7 RH) is held
    // by its cap nut (#8) and runs over the windshield base to the clip in the middle of its blade
    // (#4 LH, #5 RH), which rests on the glass.
    const pn = new THREE.Vector3(0.061, 0.09, 0).normalize(); // plenum (upper dash insulator) normal
    const PLANE = -0.5955; // plenum slope about z
    const above = (p) => pn.dot(V(p[0] - 0.99, p[1] - 0.86, 0)) - 0.01; // height over the plenum top along its normal
    // a pad on the plenum top under a point, `top` along the normal (rotated with the plenum)
    const pad = (p, top, w, d, mat = 'steel') => {
      const base = V(...p).addScaledVector(pn, -above(p));
      return box([w, top, d], base.addScaledVector(pn, top / 2).toArray(), mat, [0, 0, PLANE]);
    };
    const onPlenum = (x, z, h) => { // centre of a body standing h along the normal at plenum point (x, z)
      const p = V(x, 0.86 + (0.99 - x) * (0.061 / 0.09), z).addScaledVector(pn, 0.01 + h);
      return p.toArray();
    };
    const fr = [0.947, 0.924]; // frame tube axis
    const mc = [0.955, 0.924]; // motor axis
    const blade = (sd, pts) => tube(pts.map(([s, v]) => skinAt(s, v, sd, 0.009)), 0.007, 'rubber');
    const arm = (zp, sd, s1, v1, s2, v2) => group(
      cyl(0.011, 0.012, 'y', [0.947, 0.968, zp], 'blackPlastic'), // arm head with the cap nut (#8) on the spindle top
      pipe([[0.947, 0.97, zp], skinAt(s1, v1, sd, 0.024), skinAt(s2, v2, sd, 0.019)], 0.005, 'paintDark', { bend: 0.03 }),
    );
    // module pivot housing with its spindle rising through the cowl screen (WIPER MODULE #1)
    const pivot = (zp) => group(
      cyl(0.013, 0.026, 'y', [0.947, 0.937, zp], 'darkMetal'),
      cyl(0.006, 0.016, 'y', [0.947, 0.956, zp], 'darkMetal'),
    );
    reg.add({
      id: 'wipers', ko: '와이퍼 암·블레이드·모터', en: 'Wiper arms, blades & motor', tags: 'F',
      groups: ['windshield-wipers-and-motor'],
      object: group(
        named('bladeL', blade('L', [[1.66, 3.95], [1.645, 4.55], [1.63, 5]])),
        named('bladeR', blade('R', [[1.63, 4.85], [1.645, 4.45], [1.66, 3.98]])),
        named('armL', arm(-0.6, 'L', 1.6, 4.18, 1.645, 4.55)),
        named('armR', arm(0.06, 'R', 1.6, 4.86, 1.645, 4.45)),
        named('frame', beam([...fr, -0.632], [...fr, 0.11], 0.009, 'steel')),
        named('footL', pad([...fr, -0.618], above(fr) - 0.009 + 0.003, 0.035, 0.03)),
        named('pivotL', pivot(-0.6)),
        named('pivotR', pivot(0.06)),
        named('link', beam([0.935, 0.938, 0.06], [0.935, 0.938, -0.6], 0.004, 'steel')),
        // crank housing standing on the plenum (bolt #2 from below), the motor along the plenum
        named('motor', group(
          box([0.04, 0.026, 0.08], onPlenum(0.948, 0.13, 0.014), 'darkMetal', [0, 0, PLANE]),
          cyl(0.018, 0.1, 'z', [...mc, 0.22], 'darkMetal'),
        )),
        named('bracket', group(
          pad([...mc, 0.295], 0.004, 0.04, 0.04),
          box([0.03, 0.024, 0.004], onPlenum(0.952, 0.273, 0.016), 'steel', [0, 0, PLANE]),
        )),
      ),
    });
  }
}

export function buildInfotainment(reg) {
  reg.add({
    id: 'radio-tuner', ko: '라디오 튜너', en: 'Radio tuner',
    groups: ['radio'],
    // bolted (#2) to the AMP AND TUNER bracket (dash support frame #5) under the cross-car beam,
    // above the premium amplifier
    object: rbox([0.16, 0.05, 0.18], [0.83, 0.705, 0.305], 'darkMetal', { r: 0.008 }),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `amfm-amp-${sd}`, ko: `AM/FM 안테나 앰프 (리프트게이트 ${ko})`, en: `AM/FM antenna amplifier (liftgate ${en})`, tags: sd,
      groups: ['am-fm-antennas-and-amplifiers'], match: sd === 'L' ? /AM\/FM1|RF FILTER, LHS|SCR/ : /FM2|RF FILTER, RHS|SCR/,
      // screwed (#5) to the top of the liftgate, against the backlite where the antenna grid ends
      object: rbox([0.08, 0.02, 0.06], skinAt(3.375, 4.35, sd, -0.008).toArray(), 'blackPlastic', { r: 0.006, rot: [sg * 0.137, 0, 0.237] }),
    });
  }
  reg.add({
    id: 'gps-antenna', ko: 'GPS 안테나', en: 'GPS antenna',
    groups: ['gps-antenna'],
    object: rbox([0.07, 0.015, 0.07], [0.82, 0.955, 0.18], 'blackPlastic', { r: 0.006 }),
  });
  reg.add({
    id: 'gsm-antenna', ko: 'GSM(3G) 안테나', en: 'GSM (3G) antenna', tags: 'L',
    groups: ['gsm-antenna'],
    object: rbox([0.1, 0.012, 0.05], [0.78, 0.952, -0.55], 'blackPlastic', { r: 0.004 }),
  });
  reg.add({
    id: 'wifi-antenna', ko: 'Wi-Fi 안테나', en: 'Wi-Fi antenna', tags: 'R',
    groups: ['wi-fi-antenna'],
    object: rbox([0.1, 0.012, 0.05], [0.78, 0.952, 0.55], 'blackPlastic', { r: 0.004 }),
  });
  reg.add({
    id: 'xm-antenna', ko: '위성 라디오(XM) 안테나', en: 'Satellite radio (XM) antenna', tags: 'B',
    groups: ['satellite-radio-antenna'],
    // under the roof rear header, between the roof panel and the headliner: behind the pano roof's rear
    // seal, ahead of the headliner harness T and RH of the rear dome light
    object: (() => {
      const n = skinNormal(3.2, 4.7);
      n.z = -n.z;
      return faceTo(rbox([0.04, 0.016, 0.06], [0, 0, 0], 'blackPlastic', { r: 0.004 }), skinAt(3.2, 4.7, 'R', -0.009), n, 'y');
    })(),
  });
  reg.add({
    id: 'overhead-console', ko: '오버헤드 콘솔(블루투스·마이크)', en: 'Overhead console (Bluetooth & mics)',
    groups: ['bluetooth-and-microphones'],
    object: rbox([0.14, 0.025, 0.24], skinAt(2.36, 5, 'L', -0.05).toArray(), 'blackPlastic', { r: 0.01 }),
  });
  const spk = ['audio-speakers-base', 'audio-speakers-premium'];
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `speaker-door-${sd}F`, ko: `앞 도어 우퍼 스피커 (${ko})`, en: `Front door woofer ${en}`, tags: `${sd}F`,
      groups: spk, match: /WOOFER|200MM|160MM|SPACER|GROM|SCR/,
      // screwed to the door inner panel just behind the trim pad grille, magnet in the door
      object: group(
        named('basket', cyl(0.085, 0.026, 'z', [0.55, 0.45, sg * 0.93], 'darkMetal')),
        named('magnet', cyl(0.04, 0.03, 'z', [0.55, 0.45, sg * 0.958], 'darkMetal')),
      ),
    });
    reg.add({
      id: `speaker-door-${sd}B`, ko: `뒤 도어 스피커 (${ko})`, en: `Rear door speaker ${en}`, tags: `${sd}B`,
      groups: spk, match: /WOOFER|160MM|GROM|SCR/,
      // screwed to the door inner panel just behind the trim pad grille, clear of the regulator
      object: group(
        named('basket', cyl(0.075, 0.026, 'z', [-0.66, 0.45, sg * 0.93], 'darkMetal')),
        named('magnet', cyl(0.035, 0.03, 'z', [-0.66, 0.45, sg * 0.958], 'darkMetal')),
      ),
    });
    reg.add({
      id: `speaker-dash-${sd}`, ko: `대시 미드레인지 스피커 (${ko})`, en: `Dash mid-range speaker ${en}`, tags: sd,
      groups: spk, match: /MID RANGE|80MM/,
      object: disc(0.04, 0.03, 'y', [0.6, 0.93, sg * 0.6], 'darkMetal'),
    });
    // 30 mm tweeter ('use on A-Pillar') in a pocket at the foot of the A-pillar trim, ahead of the end of
    // the curtain airbag: the speaker set into the trim face (the door seal and, LH, the headliner
    // harness run behind it), its grille in the face, aimed into the cabin
    const tw = (off) => skinAt(1.645, 3.9, sd, off);
    const twN = tw(-0.05).sub(tw(-0.03)).normalize();
    reg.add({
      id: `tweeter-${sd}`, ko: `트위터 (A필러 ${ko})`, en: `Tweeter (A-pillar ${en})`, tags: sd,
      groups: ['audio-speakers-premium'], match: /TWEETER/,
      object: group(
        faceTo(cyl(0.014, 0.012, 'y', [0, 0, 0], 'darkMetal'), tw(-0.024), twN, 'y'),
        faceTo(cyl(0.016, 0.002, 'y', [0, 0, 0], 'blackPlastic'), tw(-0.031), twN, 'y'),
      ),
    });
  }
  reg.add({
    id: 'subwoofer', ko: '서브우퍼(트렁크 우측)', en: 'Subwoofer (trunk RH)', tags: 'RB',
    groups: ['audio-speakers-premium'], match: /SUB ?WOOFER|ENCLOSURE|BLT HEX/,
    // enclosure on the RH side of the load floor, bolted (#10) through it to the trunk floor
    object: group(
      named('enclosure', cyl(0.12, 0.14, 'z', [-2.05, 0.765, 0.55], 'blackPlastic', { seg: 28 })),
      disc(0.1, 0.01, 'z', [-2.05, 0.765, 0.475], 'darkMetal'),
      named('mount', box([0.05, 0.032, 0.03], [-2.05, 0.633, 0.52], 'steel')),
    ),
  });
  reg.add({
    id: 'audio-amplifier', ko: '프리미엄 오디오 앰프', en: 'Premium audio amplifier',
    groups: ['audio-speakers-premium'], match: /AMPLIFIER/,
    // on the AMP AND TUNER bracket (dash support frame #5) below the radio tuner
    object: rbox([0.22, 0.05, 0.16], [0.86, 0.655, 0.315], 'darkMetal', { r: 0.008 }),
  });
  reg.add({
    id: 'usb-hub', ko: 'USB 허브', en: 'USB media hub',
    groups: ['usb-hubs-and-brackets'],
    // on the front face of the centre console, LH of the console air duct
    object: rbox([0.03, 0.04, 0.09], [0.426, 0.37, -0.05], 'blackPlastic', { r: 0.006 }),
  });
  void V; void bar; void SEAT;
}
