// 12 V system, controllers, harnesses, sensors, cameras, lighting,
// wipers/washers, horns and infotainment hardware.

import * as THREE from 'three';
import { skinAt, findOnFace } from '../body.js';
import { SV } from './exterior.js';
import { SEAT } from './interior.js';
import {
  V, group, rbox, box, cyl, beam, bar, tube, disc, faceTo, mesh,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

const W = 0.011; // harness bundle radius

function sensorOnFace(end, y, z) {
  const { p, n } = findOnFace(end, y, z, -0.004);
  const m = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.025, 16), 'paintDark');
  faceTo(m, p, n, 'y');
  return m;
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
      rbox([0.16, 0.08, 0.2], [1.07, 0.72, 0.08], 'blackPlastic', { r: 0.012 }),
      box([0.14, 0.01, 0.18], [1.07, 0.765, 0.08], 'greyPlastic'),
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
    object: group(
      rbox([0.02, 0.2, 0.07], [0.72, 0.42, -0.24], 'blackPlastic', { r: 0.008, rot: [0, 0, -0.5] }),
      rbox([0.04, 0.06, 0.06], [0.8, 0.52, -0.24], 'darkMetal', { r: 0.008 }),
    ),
  });
  reg.add({
    id: 'body-controller', ko: '보디 컨트롤러·홈링크 모듈(운전석 풋웰)', en: 'Body controller & HomeLink (driver footwell)', tags: 'L',
    groups: ['body-controllers'],
    object: group(
      rbox([0.16, 0.12, 0.04], [0.8, 0.48, -0.66], 'darkMetal', { r: 0.008 }),
      rbox([0.1, 0.07, 0.03], [0.78, 0.6, -0.65], 'darkMetal', { r: 0.008 }),
    ),
  });

  // --- Door / liftgate controllers --------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `door-controller-${sd}`, ko: `도어 컨트롤러 (${ko})`, en: `Door controller ${en}`, tags: sd,
      groups: ['door-controllers-and-sensors'], match: /DOOR CONTROLLER|BOLT,TPG,TORXPLUS/,
      object: rbox([0.14, 0.1, 0.03], [0.3, 0.46, sg * 0.86], 'darkMetal', { r: 0.008 }),
    });
  }
  reg.add({
    id: 'liftgate-ecu', ko: '파워 리프트게이트·전자식 주차브레이크 ECU', en: 'Power liftgate & EPB controller', tags: 'RB',
    groups: ['door-controllers-and-sensors', 'park-brake-calipers-and-pads'], match: /LIFT ?GATE|ECU|PARK BRAKE CONTROLLER|CHIME|NUT|BLT/,
    object: group(
      rbox([0.15, 0.1, 0.035], [-1.98, 0.86, 0.72], 'darkMetal', { r: 0.008 }),
      rbox([0.12, 0.08, 0.035], [-1.98, 0.74, 0.72], 'darkMetal', { r: 0.008 }),
    ),
  });
  reg.add({
    id: 'park-assist-ecu', ko: '주차 보조 ECU', en: 'Park assist ECU', tags: 'RB',
    groups: ['module-park-assist'],
    object: rbox([0.13, 0.09, 0.035], [-1.78, 0.8, 0.74], 'darkMetal', { r: 0.008 }),
  });

  // --- Harnesses ----------------------------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `cabin-harness-${sd}`, ko: `캐빈(보디) 하네스 (${ko})`, en: `Cabin (body) harness ${en}`, tags: sd,
      groups: ['cabin-harness'],
      object: tube([[0.9, 0.5, sg * 0.75], [0.7, 0.34, sg * 0.77], [-0.7, 0.34, sg * 0.77], [-1.1, 0.5, sg * 0.74], [-1.3, 0.8, sg * 0.72]], W, 'wire'),
    });
    reg.add({
      id: `motor-bay-harness-${sd}`, ko: `모터룸(프론트 레일) 하네스 (${ko})`, en: `Motor bay (front rail) harness ${en}`, tags: sd,
      groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /FRONT (LEFT|RIGHT)|FR,(LT|RT)|RAIL FR|BODY, FRONT|BRACKET, CONNECTORS/,
      object: tube([[0.98, 0.58, sg * 0.5], [1.3, 0.56, sg * 0.53], [1.8, 0.58, sg * 0.55], [2.15, 0.56, sg * 0.5], [2.2, 0.5, 0]], W, 'wire'),
    });
  }
  reg.add({
    id: 'lower-dash-harness', ko: '메인(하부 대시) 하네스', en: 'Main (lower dash) harness',
    groups: ['main-lower-dash-and-motor-bay-harnesses'], match: /LOWER ?DASH|DASH LWR|FIRST RESPONDER|PGTL|Body Main|CABLE TIE|CBL TIE|CLIP/,
    object: tube([[0.86, 0.46, -0.72], [0.82, 0.44, -0.3], [0.82, 0.44, 0.3], [0.86, 0.46, 0.72]], W * 1.3, 'wire'),
  });
  reg.add({
    id: 'dash-harness', ko: '대시·콘솔 하네스', en: 'Dash & console harness',
    groups: ['dash-and-console-harnesses'],
    object: group(
      tube([[0.66, 0.84, -0.72], [0.64, 0.82, 0], [0.66, 0.84, 0.72]], W, 'wire'),
      tube([[0.64, 0.82, 0], [0.55, 0.55, 0.05], [0.3, 0.36, 0.08], [-0.4, 0.36, 0.08]], W, 'wire'),
    ),
  });
  const doorHarness = (s0, s1, sd) => tube([skinAt(s0 - 0.02, 2.0, sd, -0.04), skinAt(s0 + 0.08, 2.1, sd, -0.05),
    skinAt((s0 + s1) / 2, 2.2, sd, -0.05), skinAt(s1 - 0.08, 1.6, sd, -0.05)], 0.008, 'wire');
  for (const { sd, ko, en } of SIDES) {
    reg.add({
      id: `door-harness-${sd}F`, ko: `앞 도어 하네스 (${ko})`, en: `Front door harness ${en}`, tags: `${sd}F`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|MIRROR|GSM|Wi-Fi/,
      object: doorHarness(SV.frontDoor[0], SV.frontDoor[1], sd),
    });
    reg.add({
      id: `door-harness-${sd}B`, ko: `뒤 도어 하네스 (${ko})`, en: `Rear door harness ${en}`, tags: `${sd}B`,
      groups: ['doors-and-liftgate-harnesses'], match: /DOOR|EDGE CLIP/,
      object: doorHarness(SV.rearDoor[0], SV.rearDoor[1], sd),
    });
    const lg = [];
    for (let s = 3.3; s <= 4.85; s += 0.2) lg.push(skinAt(s, 4.06, sd, -0.04));
    reg.add({
      id: `liftgate-harness-${sd}`, ko: `리프트게이트 하네스 (${ko})`, en: `Liftgate harness ${en}`, tags: sd,
      groups: ['doors-and-liftgate-harnesses'], match: /LIFTGATE/,
      object: tube(lg, 0.008, 'wire'),
    });
  }
  reg.add({
    id: 'front-end-harness', ko: '프론트 엔드·앞 범퍼 하네스', en: 'Front end & front bumper harness',
    groups: ['front-end-and-front-bumper-harness'], match: /HRN|HARN|FEM|BUMP/,
    object: group(
      tube([[2.3, 0.4, -0.72], [2.37, 0.4, -0.3], [2.38, 0.4, 0.3], [2.3, 0.4, 0.72]], 0.008, 'wire'),
      tube([[2.12, 0.66, -0.6], [2.12, 0.66, 0.6]], 0.009, 'wire'),
    ),
  });
  reg.add({
    id: 'roof-harness', ko: '파노라믹 루프·헤드라이닝 하네스', en: 'Panoramic roof & headlining harness',
    groups: ['panoramic-roof-and-head-lining-harness'],
    object: tube([skinAt(2.32, 4.6, 'L', -0.045), skinAt(2.34, 5, 'L', -0.045), skinAt(2.9, 5, 'L', -0.045), skinAt(3.4, 4.8, 'L', -0.05)], 0.008, 'wire'),
  });
  reg.add({
    id: 'rear-bumper-harness', ko: '뒤 범퍼 하네스', en: 'Rear bumper harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /BUMP|BUMPER|PKA|SENSOR/,
    object: tube([[-2.3, 0.44, -0.72], [-2.38, 0.44, -0.3], [-2.39, 0.44, 0.3], [-2.3, 0.44, 0.72]], 0.008, 'wire'),
  });
  reg.add({
    id: 'rear-subframe-harness', ko: '리어 서브프레임 하네스', en: 'Rear subframe harness',
    groups: ['rear-bumper-and-subframe-harness'], match: /SUBFRAME|FEP/,
    object: tube([[-1.15, 0.36, 0.6], [-1.15, 0.3, 0.3], [-1.45, 0.3, 0.2], [-1.75, 0.3, -0.2], [-1.6, 0.3, -0.5]], 0.009, 'wire'),
  });

  // --- Parking sensors, radar, cameras ---------------------------------------------------
  const sensorGroupsF = ['parking-sensors-park-assist', 'parking-sensors-driver-assist', 'front-end-and-front-bumper-harness'];
  const sensorGroupsR = ['parking-sensors-park-assist', 'parking-sensors-driver-assist', 'rear-bumper-and-subframe-harness'];
  reg.add({
    id: 'park-sensors-front', ko: '주차 센서 - 앞 범퍼 (6개)', en: 'Parking sensors - front bumper (6)', tags: 'F',
    groups: sensorGroupsF, match: /SENSOR|RETAINER/,
    object: group([-0.7, -0.46, -0.17, 0.17, 0.46, 0.7].map((z) => sensorOnFace('front', 0.43, z))),
  });
  reg.add({
    id: 'park-sensors-rear', ko: '주차 센서 - 뒤 범퍼 (6개)', en: 'Parking sensors - rear bumper (6)', tags: 'B',
    groups: sensorGroupsR, match: /SENSOR|RETAINER/,
    object: group([-0.72, -0.46, -0.17, 0.17, 0.46, 0.72].map((z) => sensorOnFace('rear', 0.47, z))),
  });
  {
    const { p, n } = findOnFace('front', 0.36, 0.22, -0.05);
    const radar = rbox([0.07, 0.07, 0.1], [0, 0, 0], 'blackPlastic', { r: 0.01 });
    faceTo(radar, p, n, 'x');
    reg.add({
      id: 'radar', ko: '전방 레이더', en: 'Forward radar',
      groups: ['radar-sensors'], object: radar,
    });
  }
  reg.add({
    id: 'forward-camera', ko: '전방 카메라(모노캠)', en: 'Forward-facing camera (monocam)',
    groups: ['forward-facing-camera'],
    object: rbox([0.06, 0.04, 0.08], skinAt(2.27, 5, 'L', -0.03).toArray(), 'blackPlastic', { r: 0.008 }),
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
      disc(0.015, 0.01, 'x', [0.37, 0.87, -0.47], 'chrome'),
      disc(0.015, 0.01, 'x', [0.37, 0.87, -0.27], 'chrome'),
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
      object: group(
        disc(0.05, 0.03, 'x', [2.26, 0.38, sg * 0.6], 'blackPlastic'),
        box([0.03, 0.06, 0.01], [2.24, 0.42, sg * 0.6], 'steel'),
      ),
    });
  }
  reg.add({
    id: 'washer-bottle', ko: '워셔액 탱크·펌프', en: 'Washer fluid bottle & pump', tags: 'RF',
    groups: ['windshield-washer-bottle-and-pump'],
    object: group(
      rbox([0.2, 0.18, 0.14], [1.92, 0.42, 0.66], 'lensClear', { r: 0.03 }),
      cyl(0.022, 0.05, 'y', [1.98, 0.535, 0.66], 'blackPlastic'),
      cyl(0.016, 0.05, 'z', [1.86, 0.35, 0.73], 'blackPlastic'),
    ),
  });
  reg.add({
    id: 'washer-nozzles', ko: '워셔 노즐·튜브', en: 'Washer nozzles & tubing', tags: 'F',
    groups: ['windshield-washer-nozzle-and-tubing'],
    object: group(
      rbox([0.03, 0.015, 0.03], skinAt(1.46, 4.3, 'L', 0.006).toArray(), 'blackPlastic', { r: 0.005 }),
      rbox([0.03, 0.015, 0.03], skinAt(1.46, 4.3, 'R', 0.006).toArray(), 'blackPlastic', { r: 0.005 }),
      tube([[1.86, 0.5, 0.7], [1.6, 0.8, 0.5], skinAt(1.46, 4.3, 'R', -0.02), skinAt(1.46, 5, 'L', -0.02), skinAt(1.46, 4.3, 'L', -0.02)], 0.004, 'rubber'),
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
  for (const { sd, ko, en } of SIDES) {
    reg.add({
      id: `amfm-amp-${sd}`, ko: `AM/FM 안테나 앰프 (리프트게이트 ${ko})`, en: `AM/FM antenna amplifier (liftgate ${en})`, tags: sd,
      groups: ['am-fm-antennas-and-amplifiers'], match: sd === 'L' ? /AM\/FM1|RF FILTER, LHS|SCR/ : /FM2|RF FILTER, RHS|SCR/,
      object: rbox([0.08, 0.02, 0.06], skinAt(3.36, 4.35, sd, -0.04).toArray(), 'blackPlastic', { r: 0.006 }),
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
      object: disc(0.085, 0.05, 'z', [0.55, 0.43, sg * 0.83], 'darkMetal'),
    });
    reg.add({
      id: `speaker-door-${sd}B`, ko: `뒤 도어 스피커 (${ko})`, en: `Rear door speaker ${en}`, tags: `${sd}B`,
      groups: spk, match: /WOOFER|160MM|GROM|SCR/,
      object: disc(0.075, 0.05, 'z', [-0.55, 0.46, sg * 0.83], 'darkMetal'),
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
    object: group(
      cyl(0.12, 0.14, 'z', [-1.95, 0.76, 0.64], 'blackPlastic', { seg: 28 }),
      disc(0.1, 0.01, 'z', [-1.95, 0.76, 0.565], 'darkMetal'),
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
