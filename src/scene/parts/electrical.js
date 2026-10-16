// 12 V system, controllers, harnesses, sensors, cameras, lighting,
// wipers/washers, horns and infotainment hardware.

import * as THREE from 'three';
import { skinAt, findOnFace } from '../body.js';
import { SV } from './exterior.js';
import { SEAT } from './interior.js';
import {
  V, group, named, rbox, box, cyl, beam, bar, tube, pipe, disc, faceTo, mesh,
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
    // on the shared park brake / liftgate ECU bracket (#4) behind the RH trunk side trim, a plate
    // standing on the top of the wheelhouse
    object: group(
      named('ecu', rbox([0.15, 0.1, 0.035], [-1.545, 0.855, 0.8975], 'darkMetal', { r: 0.008 })),
      rbox([0.12, 0.08, 0.035], [-1.4, 0.86, 0.8975], 'darkMetal', { r: 0.008 }),
      named('bracket', box([0.3, 0.13, 0.006], [-1.48, 0.835, 0.918], 'steel')),
    ),
  });
  reg.add({
    id: 'park-assist-ecu', ko: '주차 보조 ECU', en: 'Park assist ECU', tags: 'RB',
    groups: ['module-park-assist'],
    // on its bracket (#3) next to the liftgate ECU, behind the RH trunk side trim, down to the
    // wheelhouse
    object: group(
      named('ecu', rbox([0.13, 0.09, 0.035], [-1.7, 0.845, 0.8975], 'darkMetal', { r: 0.008 })),
      named('bracket', box([0.1, 0.18, 0.006], [-1.7, 0.78, 0.918], 'steel')),
    ),
  });

  // --- Harnesses ----------------------------------------------------------------------
  // Main (lower dash) harness: across the footwells just ahead of the firewall, from the body
  // controller (LH) to the cabin fuse box (RH).  The body, motor bay and console harnesses
  // plug into it; they start on its control points (a Catmull-Rom tube passes through them).
  const LD = [[0.84, 0.562, -0.66], [0.89, 0.5, -0.6], [0.9, 0.47, -0.45], [0.9, 0.465, 0], [0.9, 0.47, 0.45], [0.88, 0.49, 0.6], [0.82, 0.52, 0.655]];
  for (const { sd, sg, ko, en } of SIDES) {
    // off the main harness, down to the sill, along it, up in front of the rear wheelhouse and over
    // it to the trunk-side modules behind the side trim (LH: air suspension ECU, where the rear bumper
    // harness plugs in; RH: liftgate ECU and park assist ECU)
    const rear = sg < 0 ? [[-1.6, 0.83, -0.847], [-1.9, 0.8, -0.847]] : [[-1.45, 0.85, 0.846], [-1.7, 0.845, 0.847]];
    reg.add({
      id: `cabin-harness-${sd}`, ko: `캐빈(보디) 하네스 (${ko})`, en: `Cabin (body) harness ${en}`, tags: sd,
      groups: ['cabin-harness'],
      object: named('lead', tube([sg < 0 ? LD[1] : LD[5], [0.92, 0.39, sg * 0.66], [0.84, 0.352, sg * 0.765], [-0.55, 0.345, sg * 0.765],
        [-0.85, 0.42, sg * 0.79], [-0.97, 0.66, sg * 0.82], [-1.22, 0.84, sg * 0.835], ...rear], W, 'wire')),
    });
    // through the bulkhead grommet (plates A/B) and along the top of the front rail; the RH one
    // passes inboard of the DC-DC converter.  Both end on the front-end module harness.
    const rail = sg < 0
      ? [[1.5, 0.493, -0.462], [1.95, 0.512, -0.462]]
      : [[1.5, 0.493, 0.462], [1.6, 0.52, 0.434], [1.94, 0.52, 0.434], [2.0, 0.55, 0.452]];
    reg.add({
      id: `motor-bay-harness-${sd}`, ko: `모터룸(프론트 레일) 하네스 (${ko})`, en: `Motor bay (front rail) harness ${en}`, tags: sd,
      groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /FRONT (LEFT|RIGHT)|FR,(LT|RT)|RAIL FR|BODY, FRONT|BRACKET, CONNECTORS/,
      object: named('lead', tube([sg < 0 ? LD[2] : LD[4], [0.985, 0.49, sg * 0.45], [1.1, 0.477, sg * 0.462], ...rail,
        [2.06, 0.645, sg * 0.455]], W, 'wire')),
    });
  }
  reg.add({
    id: 'lower-dash-harness', ko: '메인(하부 대시) 하네스', en: 'Main (lower dash) harness',
    groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /LOWER ?DASH|DASH LWR|FIRST RESPONDER|Body Main|CABLE TIE|CBL TIE|CLIP/,
    object: named('trunk', tube(LD, W * 1.3, 'wire')),
  });
  reg.add({
    id: 'dcdc-pigtail', ko: 'DC-DC 컨버터 저전압 피그테일', en: 'DC-DC converter LV pigtail', tags: 'R',
    groups: ['dc-dc-converter-1st-generation', 'main-lower-dash-and-motor-bay-harnesses'], match: /PGTL/,
    // from the signal connector on top of the converter, down its inboard face to the RH front body harness
    object: named('lead', tube([[1.69, 0.584, 0.51], [1.69, 0.585, 0.46], [1.69, 0.56, 0.436], [1.69, 0.532, 0.434]], 0.006, 'wire')),
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
      // case and forward to the USB media hub
      named('console', tube([[0.75, 0.88, -0.05], [0.875, 0.82, -0.05], [0.875, 0.56, -0.055], [0.882, 0.47, -0.05],
        [0.79, 0.395, -0.055], [0.6, 0.372, -0.055], [0.45, 0.38, -0.04], [0.41, 0.392, -0.02]], W, 'wire')),
    ),
  });
  // Door harnesses with grommet: from the IP harness near the A-pillar (front) or the body harness
  // at the foot of the B-pillar (rear), through the pillar between the two hinges into the door,
  // then along the door to the door controller (front) or the latch (rear).
  for (const { sd, sg, ko, en } of SIDES) {
    const [r0, r1] = SV.rearDoor;
    reg.add({
      id: `door-harness-${sd}F`, ko: `앞 도어 하네스 (${ko})`, en: `Front door harness ${en}`, tags: `${sd}F`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|MIRROR|GSM|Wi-Fi/,
      object: named('lead', pipe([[0.8, 0.855, sg * 0.76], [0.875, 0.77, sg * 0.845], [0.885, 0.72, sg * 0.9], [0.8, 0.69, sg * 0.935],
        [0.55, 0.6, sg * 0.935], [0.38, 0.52, sg * 0.9], [0.33, 0.5, sg * 0.872]], 0.008, 'wire', { bend: 0.04 })),
    });
    reg.add({
      id: `door-harness-${sd}B`, ko: `뒤 도어 하네스 (${ko})`, en: `Rear door harness ${en}`, tags: `${sd}B`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|EDGE CLIP/,
      object: named('lead', pipe([[-0.31, 0.352, sg * 0.768], [-0.31, 0.5, sg * 0.835], [-0.27, 0.72, sg * 0.87], [-0.235, 0.72, sg * 0.925],
        skinAt(r0 + 0.12, 1.45, sd, -0.05), skinAt((r0 + r1) / 2, 1.6, sd, -0.05), skinAt(r1 - 0.07, 1.75, sd, -0.04)], 0.008, 'wire', { bend: 0.04 })),
    });
    // liftgate harnesses: from the headliner harness T at the rear header, inboard of the liftgate
    // hinge, past the AM/FM amplifier and down the liftgate to the rear camera (LH) or the latch (RH)
    const lg = [skinAt(3.24, 4.65, sd, -0.045), skinAt(3.33, 4.65, sd, -0.045), skinAt(3.39, 4.4, sd, -0.027), skinAt(3.46, 4.33, sd, -0.03),
      skinAt(3.6, 4.3, sd, -0.04)];
    for (const s of [3.8, 4.1, 4.4, 4.7, 4.85]) lg.push(skinAt(s, 4.15, sd, -0.04));
    if (sg < 0) lg.push(skinAt(4.85, 4.6, sd, -0.035), V(-2.343, 0.857, -0.06), V(-2.349, 0.85, -0.004));
    else lg.push(V(-2.345, 0.84, 0.3), V(-2.37, 0.795, 0.15), V(-2.378, 0.782, 0.06));
    reg.add({
      id: `liftgate-harness-${sd}`, ko: `리프트게이트 하네스 (${ko})`, en: `Liftgate harness ${en}`, tags: sd,
      groups: ['doors-and-liftgate-harnesses'], match: /LIFTGATE/,
      object: named('lead', tube(lg, 0.008, 'wire')),
    });
  }
  reg.add({
    id: 'front-end-harness', ko: '프론트 엔드·앞 범퍼 하네스', en: 'Front end & front bumper harness',
    groups: ['front-end-and-front-bumper-harness'], match: /HRN|HARN|FEM|BUMP/,
    object: group(
      // front bumper harness: off the module harness outboard of the LH carrier post, down to the
      // LH horn, behind the six park assist sensors to the RH horn
      named('bumper', tube([[2.1, 0.665, -0.69], [2.18, 0.52, -0.7], [2.26, 0.405, -0.65], [2.386, 0.431, -0.69], [2.445, 0.434, -0.457],
        [2.449, 0.436, -0.172], [2.449, 0.436, 0.172], [2.445, 0.434, 0.457], [2.386, 0.431, 0.69], [2.26, 0.405, 0.65]], 0.008, 'wire')),
      // front-end module harness: headlamp to headlamp behind the bumper carrier top bar; the motor
      // bay harnesses plug into it
      named('module', tube([[2.208, 0.74, -0.832], [2.1, 0.68, -0.72], [2.06, 0.66, -0.62], [2.06, 0.66, 0], [2.06, 0.66, 0.62],
        [2.1, 0.68, 0.72], [2.208, 0.74, 0.832]], 0.009, 'wire')),
    ),
  });
  // headliner harness: up the LH A-pillar from the IP harness, outboard of the sun visor to the roof,
  // inboard just behind the visor, then a spine back along the roof to the rear dome light, with a
  // lead to the overhead console and the T at the rear header where the liftgate harnesses plug in
  reg.add({
    id: 'roof-harness', ko: '파노라믹 루프·헤드라이닝 하네스', en: 'Panoramic roof & headlining harness',
    groups: ['panoramic-roof-and-head-lining-harness'],
    object: group(
      named('header', pipe([[0.875, 0.83, -0.84], skinAt(1.62, 4.02, 'L', -0.035), skinAt(1.9, 4.02, 'L', -0.035),
        skinAt(2.2, 4.02, 'L', -0.035), skinAt(2.34, 4.0, 'L', -0.035), [0.03, 1.366, -0.56], [0.03, 1.366, -0.16],
        skinAt(2.6, 4.75, 'L', -0.026), skinAt(3.0, 4.75, 'L', -0.028), skinAt(3.2, 4.75, 'L', -0.045),
        skinAt(3.3, 4.755, 'L', -0.045)], 0.008, 'wire', { bend: 0.05 })),
      named('consoleLead', tube([[0.03, 1.366, -0.2], [0.045, 1.37, -0.14], [0.065, 1.373, -0.1]], 0.006, 'wire')),
      named('rearT', tube([skinAt(3.24, 4.65, 'L', -0.045), skinAt(3.24, 5, 'L', -0.045), skinAt(3.24, 4.65, 'R', -0.045)], 0.008, 'wire')),
    ),
  });
  reg.add({
    id: 'rear-bumper-harness', ko: '뒤 범퍼 하네스', en: 'Rear bumper harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /BUMP|BUMPER|PKA|SENSOR/,
    // from the LH body harness at the trunk side, down past the charge port to the bumper and
    // just behind the six park assist sensors
    object: named('lead', tube([[-1.9, 0.8, -0.847], [-1.98, 0.72, -0.82], [-2.15, 0.56, -0.765], [-2.3, 0.475, -0.725], [-2.376, 0.47, -0.71],
      [-2.446, 0.478, -0.454], [-2.45, 0.477, -0.169], [-2.45, 0.477, 0.169], [-2.446, 0.478, 0.454], [-2.376, 0.47, 0.71]], 0.008, 'wire')),
  });
  reg.add({
    id: 'rear-subframe-harness', ko: '리어 서브프레임 하네스', en: 'Rear subframe harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /SUBFRAME|FEP/,
    // from the RH body harness over the wheelhouse, down behind the shock tower and inboard of the
    // rail to the subframe, across on top of the rear cross member behind the drive unit
    object: named('lead', tube([[-1.45, 0.85, 0.846], [-1.53, 0.82, 0.78], [-1.63, 0.76, 0.66], [-1.68, 0.64, 0.57], [-1.7, 0.5, 0.478],
      [-1.72, 0.321, 0.42], [-1.73, 0.345, 0], [-1.74, 0.321, -0.42]], 0.009, 'wire')),
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
    object: rbox([0.06, 0.04, 0.08], skinAt(2.27, 5, 'L', -0.0265).toArray(), 'blackPlastic', { r: 0.008 }), // on its windshield bracket
  });
  {
    const { p, n } = findOnFace('rear', 0.865, 0, -0.012);
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
    object: rbox([0.08, 0.02, 0.3], skinAt(3.3, 5, 'L', -0.04).toArray(), 'lensClear', { r: 0.008 }),
  });
  reg.add({
    id: 'switches', ko: '비상등·글로브박스 스위치, 스티어링 스위치', en: 'Hazard, glove box & steering switches',
    groups: ['switches'],
    object: group(
      rbox([0.02, 0.025, 0.05], [0.45, 0.6, 0.0], 'blackPlastic', { r: 0.004 }),
      rbox([0.02, 0.025, 0.05], [0.45, 0.6, 0.07], 'blackPlastic', { r: 0.004 }),
      // steering control switch harness (#1 = front air bags #2): scroll wheels clipped into the
      // spokes against the edge of the driver airbag, wired along the spokes to the hub behind it
      named('scrollL', disc(0.015, 0.01, 'x', [0.381, 0.87, -0.456], 'chrome')),
      named('scrollR', disc(0.015, 0.01, 'x', [0.381, 0.87, -0.284], 'chrome')),
      named('steeringHarness', tube([[0.385, 0.868, -0.456], [0.41, 0.857, -0.43], [0.402, 0.861, -0.395]], 0.004, 'wire')),
      tube([[0.385, 0.868, -0.284], [0.41, 0.857, -0.31], [0.402, 0.861, -0.345]], 0.004, 'wire'),
    ),
  });
  reg.add({
    id: 'key-fob', ko: '키 포브', en: 'Key fob',
    groups: ['key-fob'],
    object: group(
      rbox([0.085, 0.022, 0.04], [0.2, 0.455, 0], 'paintDark', { r: 0.01 }),
    ),
  });
  reg.add({
    id: 'passive-entry', ko: '패시브 엔트리 안테나(콘솔·뒤 범퍼)', en: 'Passive entry antennas (console, rear bumper)',
    groups: ['remote-and-passive-entry'],
    object: group(
      rbox([0.12, 0.025, 0.04], [0.32, 0.33, 0], 'blackPlastic', { r: 0.006 }),
      rbox([0.12, 0.025, 0.04], [-0.48, 0.33, 0], 'blackPlastic', { r: 0.006 }),
      rbox([0.04, 0.025, 0.14], [-2.33, 0.56, 0], 'blackPlastic', { r: 0.006 }),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `horn-${sd}`, ko: `경음기 (${ko})`, en: `Horn ${en}`, tags: sd,
      groups: ['horns'], match: sg < 0 ? /HI TONE|510 Hz|BLT|NUT|CLIP|SEAL/ : /LOW TONE|410 Hz|SIREN|BBS|BLT|NUT|CLIP|SEAL/,
      // integral bracket bolted (#3) under the front energy absorber crush can
      object: group(
        named('horn', disc(0.05, 0.03, 'x', [2.26, 0.38, sg * 0.6], 'blackPlastic')),
        named('bracket', box([0.03, 0.006, 0.08], [2.27, 0.428, sg * 0.555], 'steel')),
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
    // hose from the pump up past the rail to the cowl, across under the hood with a stub to each nozzle
    object: group(
      rbox([0.03, 0.015, 0.03], skinAt(1.46, 4.3, 'L', 0.006).toArray(), 'blackPlastic', { r: 0.005 }),
      rbox([0.03, 0.015, 0.03], skinAt(1.46, 4.3, 'R', 0.006).toArray(), 'blackPlastic', { r: 0.005 }),
      named('hose', pipe([[2.03, 0.37, 0.735], [2.045, 0.5, 0.715], [2.02, 0.64, 0.6], [1.9, 0.7, 0.475], [1.3, 0.7, 0.47],
        [1.1, 0.72, 0.47], [1.045, 0.86, 0.43], skinAt(1.46, 4.3, 'R', -0.02), skinAt(1.46, 4.75, 'R', -0.02),
        skinAt(1.46, 4.75, 'L', -0.02), skinAt(1.46, 4.3, 'L', -0.02)], 0.004, 'rubber', { bend: 0.04 })),
      ...SIDES.map(({ sd }) => beam(skinAt(1.46, 4.3, sd, -0.02), skinAt(1.46, 4.3, sd, 0), 0.004, 'rubber')),
    ),
  });
  {
    const bladeL = [skinAt(1.66, 3.95, 'L', 0.02), skinAt(1.64, 4.6, 'L', 0.02), skinAt(1.63, 5, 'L', 0.02)];
    const bladeR = [skinAt(1.63, 4.85, 'R', 0.02), skinAt(1.64, 4.3, 'R', 0.02), skinAt(1.66, 3.98, 'R', 0.02)];
    reg.add({
      id: 'wipers', ko: '와이퍼 암·블레이드·모터', en: 'Wiper arms, blades & motor', tags: 'F',
      groups: ['windshield-wipers-and-motor'],
      object: group(
        tube(bladeL, 0.007, 'rubber'),
        tube(bladeR, 0.007, 'rubber'),
        rbox([0.1, 0.08, 0.14], [0.9, 0.84, -0.22], 'darkMetal', { r: 0.012 }),
        beam([0.9, 0.86, -0.22], [0.9, 0.86, 0.3], 0.008, 'steel'),
      ),
    });
  }
}

export function buildInfotainment(reg) {
  reg.add({
    id: 'radio-tuner', ko: '라디오 튜너', en: 'Radio tuner',
    groups: ['radio'],
    object: rbox([0.16, 0.05, 0.18], [0.74, 0.5, 0.3], 'darkMetal', { r: 0.008 }),
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
    object: rbox([0.07, 0.02, 0.07], skinAt(3.3, 5, 'L', -0.035).toArray(), 'blackPlastic', { r: 0.006 }),
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
      object: disc(0.085, 0.05, 'z', [0.55, 0.45, sg * 0.93], 'darkMetal'), // in the door, behind the trim pad grille
    });
    reg.add({
      id: `speaker-door-${sd}B`, ko: `뒤 도어 스피커 (${ko})`, en: `Rear door speaker ${en}`, tags: `${sd}B`,
      groups: spk, match: /WOOFER|160MM|GROM|SCR/,
      object: disc(0.075, 0.05, 'z', [-0.66, 0.45, sg * 0.93], 'darkMetal'), // in the door, behind the trim pad grille, clear of the regulator
    });
    reg.add({
      id: `speaker-dash-${sd}`, ko: `대시 미드레인지 스피커 (${ko})`, en: `Dash mid-range speaker ${en}`, tags: sd,
      groups: spk, match: /MID RANGE|80MM/,
      object: disc(0.04, 0.03, 'y', [0.6, 0.93, sg * 0.6], 'darkMetal'),
    });
    reg.add({
      id: `tweeter-${sd}`, ko: `트위터 (A필러 ${ko})`, en: `Tweeter (A-pillar ${en})`, tags: sd,
      groups: ['audio-speakers-premium'], match: /TWEETER/,
      object: disc(0.018, 0.02, 'x', skinAt(1.75, 3.95, sd, -0.05).toArray(), 'darkMetal'),
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
    object: rbox([0.22, 0.05, 0.16], [0.72, 0.44, 0.32], 'darkMetal', { r: 0.008 }),
  });
  reg.add({
    id: 'usb-hub', ko: 'USB 허브', en: 'USB media hub',
    groups: ['usb-hubs-and-brackets'],
    object: rbox([0.03, 0.04, 0.12], [0.41, 0.42, 0], 'blackPlastic', { r: 0.006 }),
  });
  void V; void bar; void SEAT;
}
