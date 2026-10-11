// Exterior skin panels, glass, lamps and trims cut from the parametric body.

import { skinPatch } from '../body.js';
import { skinMesh, group } from '../geom.js';

const inRect = (s, v, r) => s >= r[0] && s <= r[1] && v >= r[2] && v <= r[3];

/** Build a skin region from include-rects minus exclude-rects. */
export function region(rects, { side = 'both', exclude = [], offset = 0, mat = 'paint', ds = 0.0125, dv = 0.06, edges = true } = {}) {
  const s0 = Math.min(...rects.map((r) => r[0]));
  const s1 = Math.max(...rects.map((r) => r[1]));
  const v0 = Math.min(...rects.map((r) => r[2]));
  const v1 = Math.max(...rects.map((r) => r[3]));
  const all = [...rects, ...exclude];
  const geo = skinPatch({
    s0, s1, v0, v1, side, offset, ds, dv, edges,
    sBreaks: all.flatMap((r) => [r[0], r[1]]),
    vBreaks: all.flatMap((r) => [r[2], r[3]]),
    include: (s, v) => rects.some((r) => inRect(s, v, r)) && !exclude.some((r) => inRect(s, v, r)),
  });
  return skinMesh(geo, mat);
}

// Key (s, v) landmarks of the panel layout.
export const SV = {
  fasciaEnd: 0.30,
  hoodFront: 0.30,
  hoodRear: 1.52,
  cowlRear: 1.60,
  fenderRear: 1.60,
  frontDoor: [1.615, 2.715],
  rearDoor: [2.735, 3.545],
  frontGlass: [1.67, 2.675],
  rearGlass: [2.785, 3.49],
  bPillar: [2.675, 2.785],
  roof: [2.33, 3.25],
  liftgateFront: 3.25,
  rocker: [1.36, 3.50],
  vRockerTop: 0.30,
  vBelt: 2.86,
  vSill: 3.0,
  vGlassTop: 3.85,
  vFrameTop: 3.93,
  vRoof: 4.04,
};

const HEADLAMP = [0.08, 0.44, 1.5, 2.72];
const FOG = [0.04, 0.16, 0.25, 0.85];
const REPEATER = [1.215, 1.275, 1.7, 1.95];
const TAIL_BODY = [4.42, 4.80, 1.75, 2.75];
const TAIL_GATE = [4.62, 4.87, 2.75, 3.75];
const CHARGE_DOOR = [4.50, 4.585, 1.92, 2.45];
const REFLEX = [4.86, 4.915, 0.55, 0.95];

export function buildExterior(reg) {
  const sides = [['L', 'LH', '좌'], ['R', 'RH', '우']];

  // --- Front fascia, grille, lamps -------------------------------------
  reg.add({
    id: 'front-fascia', ko: '프론트 범퍼 페시아', en: 'Front bumper fascia', shell: true,
    groups: ['front-bumper-fascia'],
    object: group(
      region([[0, SV.fasciaEnd, -1, 5], [SV.fasciaEnd, 0.56, -0.2, 1.35], [SV.fasciaEnd, 0.42, -1, -0.2]], {
        exclude: [HEADLAMP, FOG, [0, 0.085, 3.1, 5], [0, 0.05, -1, -0.15]],
      }),
      region([[0, 0.05, -1, -0.15]], { mat: 'blackPlastic', offset: -0.002 }),
    ),
  });
  reg.add({
    id: 'front-grille', ko: '노즈콘 / 프론트 그릴', en: 'Nose cone & grille applique', shell: true,
    groups: ['front-grille-and-applique'],
    object: region([[0, 0.085, 3.1, 5]], { mat: 'blackPlastic', offset: 0.001 }),
  });
  for (const [sd, en, ko] of sides) {
    reg.add({
      id: `headlamp-${sd}`, ko: `헤드램프 (${ko})`, en: `Headlamp ${en}`, shell: true, tags: `${sd}F`,
      groups: ['headlamps'],
      object: region([HEADLAMP], { side: sd, mat: 'lensClear', offset: 0.002 }),
    });
    reg.add({
      id: `fog-lamp-${sd}`, ko: `안개등 / 코너링 램프 (${ko})`, en: `Fog / cornering lamp ${en}`, shell: true, tags: `${sd}F`,
      groups: ['front-lights-excluding-headlamps'], match: /FOG|CORNER|PARK|SD\/REFLEX|LAMP ASY FRT/,
      object: region([FOG], { side: sd, mat: 'lensClear', offset: 0.002 }),
    });
    reg.add({
      id: `side-repeater-${sd}`, ko: `사이드 리피터 (${ko})`, en: `Side repeater ${en}`, shell: true, tags: `${sd}F`,
      groups: ['front-lights-excluding-headlamps'], match: /REPEATER/,
      object: region([REPEATER], { side: sd, mat: 'lensAmber', offset: 0.004 }),
    });
  }

  // --- Fenders, hood, cowl ----------------------------------------------
  for (const [sd, en, ko] of sides) {
    reg.add({
      id: `fender-${sd}`, ko: `프론트 펜더 (${ko})`, en: `Front fender ${en}`, shell: true, tags: `${sd}F`,
      groups: ['front-fenders'],
      object: region([[SV.fasciaEnd, SV.fenderRear, 0, 2.55]], {
        side: sd, exclude: [[SV.fasciaEnd, 0.56, -0.2, 1.35], HEADLAMP, REPEATER, [SV.rocker[0], SV.fenderRear, -1, SV.vRockerTop]],
      }),
    });
  }
  reg.add({
    id: 'hood', ko: '후드', en: 'Hood', shell: true, tags: 'F', match: /HOOD/,
    groups: ['closure-panels'],
    object: region([[SV.hoodFront, SV.hoodRear, 2.55, 5]], { exclude: [HEADLAMP] }),
  });
  reg.add({
    id: 'cowl-screen', ko: '카울 스크린', en: 'Cowl screen', shell: true, match: /COWL/,
    groups: ['underhood-trim'],
    object: region([[SV.hoodRear, SV.cowlRear, 2.55, 5]], { mat: 'blackPlastic' }),
  });

  // --- Glass ---------------------------------------------------------------
  reg.add({
    id: 'windshield', ko: '윈드실드', en: 'Windshield', shell: true, match: /WINDSHIELD|WSHLD|SEAL, WINDSHIELD|BetaSeal|primer/i,
    groups: ['windshield-and-liftgate-glass'],
    object: region([[SV.cowlRear, SV.roof[0], SV.vRoof, 5]], { mat: 'glass', dv: 0.05 }),
  });
  reg.add({
    id: 'backlite', ko: '리프트게이트 유리', en: 'Liftgate glass (backlite)', shell: true, match: /BACKLITE|REAR GLASS|BetaSeal|primer/i,
    groups: ['windshield-and-liftgate-glass'],
    object: region([[3.29, 4.42, 4.12, 5]], { mat: 'glass', offset: 0.004, dv: 0.05 }),
  });
  for (const [sd, en, ko] of sides) {
    reg.add({
      id: `door-glass-${sd}F`, ko: `앞 도어 유리 (${ko})`, en: `Front door glass ${en}`, shell: true, tags: `${sd}F`,
      groups: ['front-and-rear-door-glass'],
      object: region([[SV.frontGlass[0], SV.frontGlass[1], SV.vSill, SV.vGlassTop]], { side: sd, mat: 'tintedGlass', offset: -0.004 }),
    });
    reg.add({
      id: `door-glass-${sd}B`, ko: `뒤 도어 유리 (${ko})`, en: `Rear door glass ${en}`, shell: true, tags: `${sd}B`,
      groups: ['front-and-rear-door-glass'],
      object: region([[SV.rearGlass[0], SV.rearGlass[1], SV.vSill, SV.vGlassTop]], { side: sd, mat: 'tintedGlass', offset: -0.004 }),
    });
  }

  // --- Doors, body side, rocker -------------------------------------------
  for (const [sd, en, ko] of sides) {
    reg.add({
      id: `door-${sd}F`, ko: `앞 도어 (${ko})`, en: `Front door ${en}`, shell: true, tags: `${sd}F`, match: /DOOR/,
      groups: ['closure-panels'],
      object: region([[SV.frontDoor[0], SV.frontDoor[1], SV.vRockerTop, SV.vBelt]], { side: sd }),
    });
    reg.add({
      id: `door-${sd}B`, ko: `뒤 도어 (${ko})`, en: `Rear door ${en}`, shell: true, tags: `${sd}B`, match: /DOOR/,
      groups: ['closure-panels'],
      object: region([[SV.rearDoor[0], SV.rearDoor[1], SV.vRockerTop, SV.vBelt]], { side: sd }),
    });
    reg.add({
      id: `body-side-${sd}`, ko: `보디 사이드 아우터 (${ko})`, en: `Body side outer ${en}`, shell: true, tags: sd,
      groups: ['body-side-panels'],
      object: region([
        [SV.fenderRear, SV.frontGlass[0], SV.vSill, SV.vFrameTop],
        [SV.fenderRear, 3.72, SV.vFrameTop, SV.vRoof],
        [SV.rearGlass[1], 3.72, SV.vSill, SV.vFrameTop],
        [SV.rearDoor[1], 4.70, SV.vRockerTop, SV.vRoof],
        [SV.rearDoor[1], 4.62, 0.0, SV.vRockerTop],
      ], { side: sd, exclude: [TAIL_BODY, CHARGE_DOOR, [3.72, 4.70, SV.vRoof - 0.12, 5]] }),
    });
    reg.add({
      id: `rocker-${sd}`, ko: `로커 패널 트림 (${ko})`, en: `Rocker panel trim ${en}`, shell: true, tags: sd,
      groups: ['rocker-panel-trim'],
      object: region([[SV.rocker[0], SV.rocker[1], -0.35, SV.vRockerTop]], { side: sd, mat: 'paintDark' }),
    });
    reg.add({
      id: `belt-trim-${sd}`, ko: `벨트라인·윈도 크롬 몰딩 (${ko})`, en: `Bright belt & window moulding ${en}`, shell: true, tags: sd,
      groups: ['exterior-trim-fittings'], match: /BRIGHT MOLDING|RETENTION|FOAM TAPE|SCR DUAL|GROMMET - UPPER/,
      object: group(
        region([[SV.frontDoor[0], SV.rearDoor[1], SV.vBelt, SV.vSill]], { side: sd, mat: 'chrome', offset: 0.002 }),
        region([[SV.frontGlass[0] - 0.02, SV.rearGlass[1] + 0.02, SV.vGlassTop, SV.vFrameTop]], { side: sd, mat: 'chrome', offset: 0.002 }),
      ),
    });
    reg.add({
      id: `b-pillar-applique-${sd}`, ko: `B필러 아플리케 (${ko})`, en: `B-pillar applique ${en}`, shell: true, tags: sd,
      groups: ['exterior-trim-fittings'], match: /B PILLAR APPLIQUE|CLIP, TRIM|BLT,PFLG/,
      object: region([[SV.bPillar[0], SV.bPillar[1], SV.vSill, SV.vGlassTop]], { side: sd, mat: 'blackPlastic', offset: 0.001 }),
    });
  }

  // --- Roof, liftgate --------------------------------------------------------
  reg.add({
    id: 'roof-panel', ko: '루프 패널(헤더·보우·사이드 레일)', en: 'Roof panels (headers, bow, side rails)', shell: true,
    groups: ['roof-panels'],
    // Panoramic-roof body: front/rear headers, B-pillar bow and side rails.
    object: region([
      [SV.roof[0], 2.42, SV.vRoof, 5], [3.17, SV.liftgateFront, SV.vRoof, 5],
      [2.745, 2.79, SV.vRoof, 5], [2.42, 3.17, SV.vRoof, 4.22],
    ], {}),
  });
  reg.add({
    id: 'liftgate', ko: '리프트게이트', en: 'Liftgate', shell: true, tags: 'B', match: /LIFTGATE/,
    groups: ['closure-panels'],
    object: region([[SV.liftgateFront, 4.97, SV.vRoof - 0.12, 5], [4.62, 4.97, 2.75, 5]], {
      exclude: [TAIL_GATE, [3.29, 4.42, 4.12, 5]],
    }),
  });

  // --- Rear lamps / fascia -------------------------------------------------
  for (const [sd, en, ko] of sides) {
    reg.add({
      id: `tail-lamp-${sd}`, ko: `테일 램프 - 보디측 (${ko})`, en: `Tail lamp (body side) ${en}`, shell: true, tags: `${sd}B`,
      groups: ['tail-lights'], match: /STOP\/TAIL|FIXED DOOR|GASKET MAIN|GASKET STUD|BONDED|SCR, TORX/,
      object: region([TAIL_BODY], { side: sd, mat: 'lensRed', offset: 0.002, exclude: sd === 'L' ? [CHARGE_DOOR] : [] }),
    });
    reg.add({
      id: `tail-lamp-gate-${sd}`, ko: `테일 램프 - 리프트게이트측 (${ko})`, en: `Liftgate tail lamp ${en}`, shell: true, tags: `${sd}B`,
      groups: ['tail-lights'], match: /L\/GATE|LIFT GATE/,
      object: region([TAIL_GATE], { side: sd, mat: 'lensRed', offset: 0.002 }),
    });
    reg.add({
      id: `rear-reflex-${sd}`, ko: `리어 반사등 (${ko})`, en: `Rear reflex lamp ${en}`, shell: true, tags: `${sd}B`,
      groups: ['tail-lights', 'rear-bumper-fascia'], match: /REFLEX/,
      object: region([REFLEX], { side: sd, mat: 'lensRed', offset: 0.003 }),
    });
  }
  reg.add({
    id: 'charge-port-door', ko: '충전 포트 도어', en: 'Charge port door', shell: true, tags: 'LB',
    groups: ['charge-port'], match: /DOOR|ARMATURE|MCD|PIN/,
    object: region([CHARGE_DOOR], { side: 'L', mat: 'lensRed', offset: 0.003 }),
  });
  reg.add({
    id: 'rear-fascia', ko: '리어 범퍼 페시아', en: 'Rear bumper fascia', shell: true,
    groups: ['rear-bumper-fascia'],
    object: region([[4.62, 4.97, -1, 2.75], [4.40, 4.62, -0.5, 0.0]], { exclude: [REFLEX, TAIL_BODY] }),
  });
}
