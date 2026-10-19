// Closure hardware, seals, mirrors, badges, licence plates, labels and the
// panoramic roof.

import * as THREE from 'three';
import { skinAt, skinNormal, skinPath, findOnFace } from '../body.js';
import { region, SV, skinRibbon } from './exterior.js';
import { xOf } from '../profile.js';
import {
  V, group, named, rbox, box, cyl, beam, bar, tube, pipe, faceTo, mesh, quadPlate,
} from '../geom.js';

const SIDES = [
  { sd: 'L', sg: -1, ko: '좌', en: 'LH' },
  { sd: 'R', sg: 1, ko: '우', en: 'RH' },
];

function onFace(end, y, z, size, mat, offset = 0.004, axis = 'x') {
  const { p, n } = findOnFace(end, y, z, offset);
  const m = rbox(size, [0, 0, 0], mat, { r: Math.min(...size) / 3 });
  return faceTo(m, p, n, axis);
}

function loop(svs, sd, offset, r, mat) {
  return tube(skinPath(svs, sd, offset, 5), r, mat, { closed: false, radial: 6 });
}

export function buildClosures(reg) {
  // --- Hinges ----------------------------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    const xf = xOf(SV.frontDoor[0]) + 0.02;
    const xr = -0.295; // behind the B-pillar rear face (x -0.275), over the front of the rear door inner panel
    reg.add({
      id: `front-door-hinges-${sd}`, ko: `앞 도어 힌지 (${ko})`, en: `Front door hinges ${en}`, tags: `${sd}F`,
      groups: ['front-door-hinges-and-fittings'],
      // from the hinge pillar to the door inner panel, inboard of the door seal
      object: group(
        rbox([0.08, 0.05, 0.044], [xf - 0.02, 0.58, sg * 0.933], 'steel', { r: 0.008 }),
        rbox([0.08, 0.05, 0.044], [xf - 0.02, 0.86, sg * 0.933], 'steel', { r: 0.008 }),
      ),
    });
    reg.add({
      id: `rear-door-hinges-${sd}`, ko: `뒤 도어 힌지 (${ko})`, en: `Rear door hinges ${en}`, tags: `${sd}B`,
      groups: ['rear-door-hinges-and-fittings'],
      // bolted to the B-pillar rear face and to the front of the rear door inner panel, inboard of
      // the door seals
      object: group(
        rbox([0.05, 0.05, 0.036], [xr, 0.58, sg * 0.935], 'steel', { r: 0.008 }),
        rbox([0.05, 0.05, 0.036], [xr, 0.86, sg * 0.935], 'steel', { r: 0.008 }),
      ),
    });
    // The hood hinge (#6) sits on top of the rear end of the shotgun upper rail (front-inner-*, structure.js), at the
    // cowl side: plates following the rail top, built along the rail's own axis (A -> B) and its top-face normal
    const RA = new THREE.Vector3(1.85, 0.758, sg * 0.72);
    const RB = new THREE.Vector3(0.98, 0.863, sg * 0.785);
    const railQ = bar(RA, RB, 0.04, 0.07, 'steel').quaternion;
    const nTop = new THREE.Vector3(1, 0, 0).applyQuaternion(railQ);
    if (nTop.y < 0) nTop.negate();
    const onRail = (x, off) => RA.clone().lerp(RB, (1.85 - x) / 0.87).addScaledVector(nTop, off); // rail top face at off 0.02
    const railPlate = (x0, x1, off, t, w) => {
      const m = bar(onRail(x0, off), onRail(x1, off), t, w, 'steel'); // a plate along the rail, not a linear member
      delete m.userData.span;
      return m;
    };
    reg.add({
      id: `hood-hinge-${sd}`, ko: `후드 힌지·가스 스트럿 (${ko})`, en: `Hood hinge & gas strut ${en}`, tags: sd,
      groups: ['hood-hinges-and-fittings'],
      object: group(
        // body leaf: a horizontal flange on the rail top, bolted from above with 2 vertical M8 bolts (BLT HEX FLG
        // M8x20 #7) into the rail, nuts (NUT M8 #5) underneath; the side aprons (underhood trim #2/#3) have holes for it
        named('base', railPlate(1.12, 1.0, 0.023, 0.006, 0.045)),
        // hinge body on the leaf (its hood leaf reaches up to the hood underside), with the active hinge's large inboard
        // flange over the pedestrian protection actuator's plunger
        railPlate(1.125, 1.005, 0.046, 0.04, 0.03),
        box([0.04, 0.005, 0.078], [1.03, 0.8945, sg * 0.731], 'steel'),
        // gas strut (#1) from an inboard arm of the hinge forward, inboard of the rail and under the side apron, to its
        // body bracket (#2, BLT HF M6x15 #3) on the rear face of the shock tower
        box([0.02, 0.008, 0.045], [1.12, 0.869, sg * 0.7395], 'steel'),
        named('strut', beam([1.12, 0.862, sg * 0.722], [1.338, 0.818, sg * 0.615], 0.01, 'steel')),
        named('strutBracket', rbox([0.02, 0.04, 0.04], [1.345, 0.815, sg * 0.615], 'steel', { r: 0.004 })),
      ),
    });
    reg.add({
      id: `liftgate-hinge-${sd}`, ko: `리프트게이트 힌지·스트럿 (${ko})`, en: `Liftgate hinge & strut ${en}`, tags: sd,
      groups: ['liftgate-hinges-and-fittings'], match: /HINGE|STRUT|BALL STUD|WEDGE|BUMPER|ANTI PINCH|push clip|SEALER|BLT|NUT/,
      object: group(
        rbox([0.08, 0.04, 0.05], skinAt(3.24, 4.55, sd, -0.02).toArray(), 'steel', { r: 0.008 }), // hinge on the roof rear header
        tube([skinAt(3.9, 4.05, sd, -0.05), skinAt(4.15, 3.6, sd, -0.08), skinAt(4.35, 3.0, sd, -0.1)], 0.012, 'steel'),
        tube([skinAt(3.35, 4.06, sd, -0.025), skinAt(4.0, 4.06, sd, -0.025), skinAt(4.5, 4.03, sd, -0.025)], 0.005, 'rubber'), // anti-pinch sensor
      ),
    });
  }
  reg.add({
    id: 'liftgate-spoiler', ko: '리프트게이트 스포일러(카본, 옵션)', en: 'Liftgate spoiler (carbon fibre, option)', tags: 'B',
    groups: ['liftgate-hinges-and-fittings'], match: /SPOILER|ADHESIVE TAPE|PRIMER/,
    object: group(
      region([[4.585, 4.66, 4.1, 5]], { offset: 0.008, mat: 'carbon' }),
      region([[4.585, 4.66, 4.1, 5]], { offset: 0.001, mat: 'carbon', edges: false }), // underside on the adhesive tape
      // its rounded edges closing the shell between the two skins: front edge, outboard ends and trailing edge
      ...SIDES.map(({ sd }) => loop([[4.585, 5], [4.585, 4.1], [4.66, 4.1], [4.66, 5]], sd, 0.0045, 0.0035, 'carbon')),
    ),
  });

  // --- Glass regulators, handles, latches --------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    for (const [fr, range, frKo, frEn] of [['F', SV.frontDoor, '앞', 'front'], ['B', SV.rearDoor, '뒤', 'rear']]) {
      const sm = (range[0] + range[1]) / 2;
      const vTop = SV.vSill + 0.005; // the rail tops end just inside the glass clamp, under the inner belt seal
      // rail from the inner panel up along the outer skin (clear of the door harness) to the glass edge
      const rail = (d0, d1) => pipe([[1.0, -0.036], [1.6, -0.019], [2.1, -0.017], [2.5, -0.017], [vTop, -0.012]]
        .map(([v, o]) => skinAt(sm + d0 + (d1 - d0) * ((v - 1.0) / (vTop - 1.0)), v, sd, o)), 0.008, 'steel');
      reg.add({
        id: `regulator-${sd}${fr}`, ko: `${frKo} 도어 유리 레귤레이터 (${ko})`, en: `${frEn} door glass regulator ${en}`, tags: `${sd}${fr}`,
        groups: ['front-and-rear-door-glass-regulator'],
        // rails on the door inner panel, their carriers clamping the lower edge of the glass;
        // motor on the inboard face of the inner panel
        object: group(
          named('railF', rail(-0.12, -0.1)),
          named('railR', rail(0.1, 0.07)),
          named('motor', cyl(0.04, 0.03, 'z', skinAt(sm, 1.15, sd, -0.05).toArray(), 'darkMetal')),
        ),
      });
      // flush handle in the vertical side of the door just below the shoulder; its mechanism is bolted
      // to the inside of the outer skin round the handle pocket, in the door cavity between the outer
      // skin and the inner panel (offset -0.04), clear of the glass regulator rails
      const hs = fr === 'F' ? 2.47 : 3.33;
      const hv = 1.78;
      const hn = skinNormal(hs, hv);
      if (sd === 'R') hn.z = -hn.z;
      reg.add({
        id: `ext-handle-${sd}${fr}`, ko: `${frKo} 외부 도어 핸들(플러시) (${ko})`, en: `${frEn} exterior door handle (flush) ${en}`, tags: `${sd}${fr}`,
        groups: [fr === 'F' ? 'front-exterior-door-handle' : 'rear-exterior-door-handle'],
        object: group(
          faceTo(rbox([0.2, 0.03, 0.01], [0, 0, 0], 'chrome', { r: 0.004 }), skinAt(hs, hv, sd, 0.002), hn, 'z'),
          faceTo(rbox([0.17, 0.045, 0.024], [0, 0, 0], 'darkMetal', { r: 0.006 }), skinAt(hs, hv, sd, -0.0125), hn, 'z'),
        ),
      });
      // latch on the inner panel at the rear edge of the door, ahead of the B-pillar / lock pillar
      const ls = range[1] - (fr === 'F' ? 0.05 : 0.04);
      const latchGroups = fr === 'F'
        ? ['front-door-latch-and-striker', 'front-door-latch-and-interior-release']
        : ['rear-door-latch-and-striker', 'rear-door-latch-and-interior-release'];
      reg.add({
        id: `door-latch-${sd}${fr}`, ko: `${frKo} 도어 래치·실내 릴리스 (${ko})`, en: `${frEn} door latch & interior release ${en}`, tags: `${sd}${fr}`,
        groups: latchGroups,
        object: group(
          named('latch', rbox([0.05, 0.09, 0.05], skinAt(ls, 1.75, sd, -0.04).toArray(), 'darkMetal', { r: 0.008 })), // on the door inner panel
          named('striker', rbox([0.03, 0.03, 0.03], skinAt(range[1] + (fr === 'F' ? 0.01 : 0.03), 1.75, sd, -0.03).toArray(), 'steel', { r: 0.006 })), // on the B / lock pillar
          rbox([0.1, 0.03, 0.025], skinAt(range[1] - 0.25, 2.15, sd, -0.105).toArray(), 'chrome', { r: 0.008 }),
          tube([skinAt(ls, 1.75, sd, -0.05), skinAt(range[1] - 0.15, 2.0, sd, -0.08), skinAt(range[1] - 0.25, 2.15, sd, -0.1)], 0.003, 'steel'),
        ),
      });
    }
  }
  reg.add({
    id: 'hood-latch', ko: '후드 래치·릴리스 케이블', en: 'Hood latch & release cable',
    groups: ['dual-hood-latch-and-release', 'single-hood-latch-and-release'],
    object: group(
      // latch (#5) bolted to the front face of the carrier upper beam, striker (#3) above it
      named('latch', rbox([0.06, 0.08, 0.16], [2.155, 0.7, 0], 'darkMetal', { r: 0.01 })),
      rbox([0.04, 0.025, 0.05], [2.155, 0.752, 0], 'steel', { r: 0.006 }),
      // release cable (#2): over the carrier beam, outboard of the frunk tub and inboard of the LH
      // shock tower, then outboard behind the tower's rear wall (between it and the master cylinder,
      // under the brake hose bracket) and over the rear of the wheelhouse, through the firewall at
      // its outboard edge (outboard of the dash insulation, below the shotgun rail), into the open
      // front of the lower instrument panel and inside it along its LH end cover, above the kick
      // panel, down to the handle on the LH lower dash
      named('cable', pipe([[2.15, 0.725, -0.07], [2.1, 0.733, -0.12], [2.062, 0.725, -0.22], [2.06, 0.71, -0.4], [2.058, 0.705, -0.46], [1.98, 0.7, -0.472],
        [1.45, 0.7, -0.47], [1.336, 0.69, -0.475], [1.333, 0.68, -0.585], [1.23, 0.65, -0.63], [1.11, 0.625, -0.7], [0.99, 0.645, -0.727],
        [0.93, 0.635, -0.727], [0.85, 0.598, -0.727], [0.77, 0.575, -0.727], [0.712, 0.566, -0.729], [0.712, 0.545, -0.731], [0.712, 0.524, -0.738]], 0.004, 'steel', { bend: 0.02 })),
      // the cable's grommet in the notch of the LH dash panel corner (floor-pan#dashCorners)
      named('grommet', cyl(0.0065, 0.012, 'x', [0.985, 0.6444, -0.7264], 'rubber', { seg: 16 })),
      // on the LH end face of the lower instrument panel shell (z -0.74), facing the door opening
      named('handle', rbox([0.06, 0.03, 0.02], [0.7, 0.52, -0.745], 'blackPlastic', { r: 0.006 })),
    ),
  });
  reg.add({
    id: 'liftgate-latch', ko: '리프트게이트 래치·스트라이커', en: 'Liftgate latch & striker', tags: 'B',
    groups: ['liftgate-latch'],
    // latch inside the lower edge of the liftgate (between the outer panel and the trim); the
    // striker on the rear body panel reaches back into its jaw through the trim opening
    object: group(
      onFace('rear', 0.755, 0, [0.028, 0.09, 0.13], 'darkMetal', -0.025),
      onFace('rear', 0.745, 0, [0.04, 0.018, 0.05], 'steel', -0.055),
    ),
  });
  reg.add({
    id: 'liftgate-handle', ko: '리프트게이트 핸들·비상 해제', en: 'Liftgate handle & emergency release', tags: 'B',
    groups: ['liftgate-handle-and-emergency-release'],
    object: group(
      onFace('rear', 0.835, 0, [0.02, 0.03, 0.12], 'chrome', 0.0),
      // emergency release handle (#4) clipped on the inboard face of the liftgate latch, above the
      // rear body panel, reached from inside the trunk
      onFace('rear', 0.81, 0.04, [0.03, 0.03, 0.05], 'lensRed', -0.047),
    ),
  });
  for (const { sd, sg, ko, en } of SIDES) {
    reg.add({
      id: `liftgate-drain-${sd}`, ko: `리프트게이트(램프 하우징) 배수관 (${ko})`, en: `Liftgate (lamp housing) drain tube ${en}`, tags: sd,
      groups: ['liftgate-drain'],
      // funnel (#1) in the lamp housing gutter under the liftgate seal, straight down behind
      // the charge port inlet (LH) to the elbow (#2) at the lower body
      object: pipe([skinAt(4.618, 2.74, sd, -0.03), [-2.126, 0.9, sg * 0.835], [-2.126, 0.8, sg * 0.83], [-2.132, 0.55, sg * 0.845],
        skinAt(4.62, 0.0, sd, -0.04)], 0.006, 'rubber'),
    });
  }

  // --- Seals -------------------------------------------------------------------------
  // Body side primary seals round the door openings, and the margin seals that fill the shut lines just
  // under the skin: A-pillar margin (front door seals #6) between the fender / cowl and the front door,
  // B-pillar margin (rear door seals #5) between the front and the rear door, below the belt moulding.  The belt
  // seals close both sides of the door glass's lower edge: the inner belt seal (front #2 / rear #3 SEAL - DOOR FR/RR INR
  // BELT) from the trim pad's window-sill cap to the glass, the outer belt seal (front #3 / rear #4 OTR BELT) from the
  // bright belt moulding to the glass.
  for (const { sd, ko, en } of SIDES) {
    const f = SV.frontDoor;
    const r = SV.rearDoor;
    const margin = (s0, s1, v1) => region([[s0 - 0.0005, s1 + 0.0005, SV.vRockerTop, v1]], { side: sd, offset: -0.0015, mat: 'rubber', edges: false });
    reg.add({
      id: `front-door-seal-${sd}`, ko: `앞 도어 실 (${ko})`, en: `Front door seals ${en}`, tags: sd,
      groups: ['front-door-seals'],
      object: group(
        loop([[f[0] + 0.01, 0.32], [f[1] - 0.01, 0.32], [f[1] - 0.01, 3.9], [f[0] + 0.06, 3.9], [f[0] + 0.01, 3.0], [f[0] + 0.01, 0.32]], sd, -0.025, 0.007, 'rubber'),
        named('aPillarMargin', margin(SV.fenderRear, f[0], SV.vSill)),
        named('innerBelt', skinRibbon(sd, f[0] + 0.03, f[1] - 0.025, [3.02, -0.012], [3.03, -0.0045], 'rubber')),
        named('outerBelt', skinRibbon(sd, SV.frontGlass[0], SV.frontGlass[1], [SV.vSill, 0.002], [3.015, -0.0035], 'rubber')),
      ),
    });
    reg.add({
      id: `rear-door-seal-${sd}`, ko: `뒤 도어 실 (${ko})`, en: `Rear door seals ${en}`, tags: sd,
      groups: ['rear-door-seals'],
      object: group(
        loop([[r[0] + 0.01, 0.32], [r[1] - 0.01, 0.32], [r[1] - 0.01, 3.0], [r[1] - 0.06, 3.9], [r[0] + 0.01, 3.9], [r[0] + 0.01, 0.32]], sd, -0.025, 0.007, 'rubber'),
        named('bPillarMargin', margin(f[1], r[0], SV.vBelt)),
        named('innerBelt', skinRibbon(sd, r[0] + 0.02, SV.rearGlass[1] - 0.005, [3.02, -0.012], [3.03, -0.0045], 'rubber')),
        named('outerBelt', skinRibbon(sd, SV.rearGlass[0], SV.rearGlass[1], [SV.vSill, 0.002], [3.015, -0.0035], 'rubber')),
      ),
    });
  }
  // SEAL - HOOD (#1) is the closed loop on the frunk tub rim (frunk group #19); its rear
  // corners are cut where the shock-tower braces cross the tub.
  // SEAL - HOOD TO COWL (#2) runs across the cowl between the hood hinges.
  const rim = (x, z) => [x, 0.748 + ((2.04 - x) / 0.84) * 0.116, z];
  reg.add({
    id: 'hood-seal', ko: '후드 실(프렁크 림)', en: 'Hood seal (frunk rim)', tags: 'F',
    groups: ['hood-seals', 'front-luggage-storage-compartment'], match: /SEAL - HOOD(?! TO COWL)/,
    object: tube([rim(2.04, -0.44), rim(2.04, 0.44), rim(1.34, 0.44), rim(1.2, 0.368), rim(1.2, -0.368), rim(1.34, -0.44)], 0.008, 'rubber', { closed: true, tension: 0 }),
  });
  reg.add({
    id: 'hood-cowl-seal', ko: '후드-카울 실', en: 'Hood to cowl seal', tags: 'F',
    groups: ['hood-seals'], match: /HOOD TO COWL/,
    object: tube([[1.0, 0.89, -0.54], [1.0, 0.89, 0.54]], 0.008, 'rubber'),
  });
  // on the body opening flange, just inside the liftgate edge and above the rear door seals
  const lgOutline = [[3.3, 5], [3.3, 3.97], [4.61, 3.97], [4.61, 2.76], [4.95, 2.76], [4.95, 5]];
  reg.add({
    id: 'liftgate-seal', ko: '리프트게이트(트렁크) 실', en: 'Liftgate (trunk lid) seal', tags: 'B',
    groups: ['trunk-lid-seal'],
    object: group(loop(lgOutline, 'L', -0.024, 0.007, 'rubber'), loop(lgOutline, 'R', -0.024, 0.007, 'rubber')),
  });

  // --- Exterior mirrors -----------------------------------------------------------------
  for (const { sd, sg, ko, en } of SIDES) {
    const base = skinAt(1.74, 2.6, sd, 0.0);
    reg.add({
      id: `mirror-${sd}`, ko: `외부 미러 (${ko})`, en: `Exterior mirror ${en}`, tags: sd,
      groups: ['exterior-mirrors'],
      object: group(
        rbox([0.12, 0.05, 0.08], [base.x - 0.02, base.y + 0.02, base.z + sg * 0.03], 'paint', { r: 0.02 }),
        rbox([0.13, 0.12, 0.2], [base.x - 0.06, base.y + 0.07, base.z + sg * 0.13], 'paint', { r: 0.04 }),
        box([0.004, 0.1, 0.18], [base.x - 0.125, base.y + 0.07, base.z + sg * 0.13], 'chrome'),
      ),
    });
  }

  // --- Badges, appliques, licence plates ---------------------------------------------------
  reg.add({
    id: 'badges', ko: '배지(T 엠블럼·MODEL S·트림 배지)', en: 'Badges (T emblem, MODEL S, trim)',
    groups: ['badges', 'front-grille-and-applique'], match: /BADGE|LUDICROUS/,
    object: group(
      onFace('front', 0.645, 0, [0.006, 0.07, 0.07], 'chrome', 0.004),
      onFace('rear', 0.985, 0, [0.006, 0.07, 0.07], 'chrome', 0.004),
      onFace('rear', 0.93, 0.36, [0.006, 0.025, 0.16], 'chrome', 0.004),
      onFace('rear', 0.93, -0.38, [0.006, 0.025, 0.09], 'chrome', 0.004),
    ),
  });
  {
    // chrome strip across the liftgate between the inner ends of the liftgate tail lamps (|z| 0.3)
    const pts = [-0.285, -0.2, -0.1, 0, 0.1, 0.2, 0.285].map((z) => findOnFace('rear', 0.88, z, 0.004).p);
    reg.add({
      id: 'liftgate-applique', ko: '리프트게이트 크롬 아플리케', en: 'Liftgate chrome applique', tags: 'B',
      groups: ['exterior-trim-fittings'], match: /LIFTGATE APPLIQUE|Bracket for Applique|CLIP, (BRKT, )?LIFTGATE|APPLIQUE TAPE|LOCTITE/,
      object: tube(pts, 0.014, 'chrome', { radial: 6 }),
    });
  }
  const plateGroups = ['license-plate-mounting-north-america', 'license-plate-mounting-europe', 'license-plate-mounting-china', 'license-plate-mounting-japan-and-australia'];
  reg.add({
    id: 'license-plate-front', ko: '앞 번호판 브래킷', en: 'Front licence plate bracket', tags: 'F',
    groups: plateGroups, match: /FR |FRONT|BRKT|CLIP|RVT|E-CLIP/,
    object: onFace('front', 0.36, 0, [0.008, 0.16, 0.31], 'blackPlastic', 0.004), // screwed to the fascia
  });
  reg.add({
    id: 'license-plate-rear', ko: '뒤 번호판 프레임', en: 'Rear licence plate frame', tags: 'B',
    groups: plateGroups, match: /REAR|RR|FRAME|SCR|GROM|CAP|FLASHER|BAG/,
    object: group(
      onFace('rear', 0.74, 0, [0.008, 0.16, 0.31], 'paintDark', 0.006),
      onFace('rear', 0.83, 0, [0.006, 0.012, 0.08], 'lensClear', 0.006),
    ),
  });
  reg.add({
    id: 'chmsl', ko: '보조 제동등(CHMSL)', en: 'High-mount stop lamp (CHMSL)', tags: 'B',
    groups: ['tail-lights'], match: /CHMSL/,
    object: region([[3.27, 3.3, 4.7, 5]], { offset: -0.001, mat: 'lensRed', edges: false }), // on the liftgate top edge, under the glass
  });
  reg.add({
    id: 'license-lamp', ko: '번호판 램프', en: 'Licence plate lamp', tags: 'B',
    groups: ['tail-lights'], match: /LICENSE/,
    object: onFace('rear', 0.83, 0.1, [0.01, 0.015, 0.05], 'lensClear', 0.002),
  });

  // --- Labels ----------------------------------------------------------------------------
  reg.add({
    id: 'labels-b-pillar', ko: '라벨 - B필러(타이어·제조 인증)', en: 'Labels - B-pillar (tyre & certification)', tags: 'L',
    groups: ['labels'], match: /TIRE|MANUFACTURING|CERT|LOADING|Supplemental|Op\.Tires|AIRBAG WARNING|REGISTRATION|3RD ROW SEAT/i,
    // on the LH B-pillar's front (door shut) face (b-pillar-L#lower, x -0.205), seen with the driver's
    // door open
    object: group(
      box([0.002, 0.09, 0.034], [-0.204, 0.62, -0.933], 'paper'),
      box([0.002, 0.06, 0.034], [-0.204, 0.5, -0.933], 'paper'),
    ),
  });
  reg.add({
    id: 'labels-underhood', ko: '라벨 - 후드 아래(배출가스·냉매·구조대원)', en: 'Labels - under hood (emissions, refrigerant, first responder)', tags: 'F',
    groups: ['labels'], match: /EMISSION|REFRIGERANT|FIRST RESPONDER|FRONT INFO|VEHICLE|LBL/,
    object: group(
      // on the hood underside, above the frunk
      box([0.1, 0.002, 0.07], [1.95, 0.7985, 0.35], 'paper'),
      box([0.08, 0.002, 0.05], [1.95, 0.801, -0.35], 'paper'),
    ),
  });
  reg.add({
    id: 'labels-window', ko: '라벨 - 창문 스티커(먼로니)', en: 'Labels - window sticker (Monroney)', tags: 'LB',
    groups: ['labels'], match: /MONRONEY|ADHESIVE TAPE/,
    object: box([0.2, 0.25, 0.002], skinAt(3.15, 3.42, 'L', -0.012).toArray(), 'paper'),
  });

  // --- Panoramic roof ----------------------------------------------------------------------
  const R0 = 2.42;
  const RB = [2.745, 2.79];
  const R1 = 3.17;
  const VS = 4.22;
  reg.add({
    id: 'pano-glass-front', ko: '파노라믹 루프 무빙 글라스(앞)', en: 'Panoramic roof moving glass (front)',
    groups: ['roof-glass'], match: /MOVABLE|MOVING|GLASS FRAME|COVER, GLASS|SHLDR|ANTI-NOISE|Stop Bumper/i,
    object: region([[R0, RB[0], VS, 5]], { offset: 0.003, mat: 'tintedGlass', dv: 0.05 }),
  });
  reg.add({
    id: 'pano-glass-rear', ko: '파노라믹 루프 고정 글라스(뒤)', en: 'Panoramic roof fixed glass (rear)',
    groups: ['roof-glass'], match: /REAR GLASS|FIXED GLASS|DATUM|BetaSeal|PRIMER/i,
    object: region([[RB[1], R1, VS, 5]], { offset: 0.003, mat: 'tintedGlass', dv: 0.05 }),
  });
  reg.add({
    id: 'pano-cassette', ko: '파노라믹 루프 카세트(어셈블리)', en: 'Panoramic roof cassette (assembly)',
    groups: ['panoramic-roof-assembly'],
    object: region([[R0 - 0.03, R1 + 0.03, VS - 0.06, 4.32]], { offset: -0.022, mat: 'darkMetal', edges: false }),
  });
  // tracks (#22/#23) on the cassette side rails (cassette underside at offset -0.022); the roof motors
  // (#1/#2, on their motor blocks #3/#4) bolted under the front corners of the cassette at the front
  // ends of the tracks
  const tracks = [];
  for (const { sd } of SIDES) {
    tracks.push(tube(skinPath([[R0, VS - 0.02], [R1, VS - 0.02]], sd, -0.015, 8), 0.007, 'aluminum'));
    const n = skinNormal(R0 - 0.012, VS + 0.01);
    if (sd === 'R') n.z = -n.z;
    tracks.push(faceTo(rbox([0.07, 0.022, 0.05], [0, 0, 0], 'darkMetal', { r: 0.008 }), skinAt(R0 - 0.012, VS + 0.01, sd, -0.033), n, 'y'));
  }
  reg.add({
    id: 'pano-drive', ko: '루프 구동 모터·케이블·트랙', en: 'Roof drive motors, cables & tracks',
    groups: ['drive-motor-and-cable-mechanism'], object: group(tracks),
  });
  // Drain tubes from the cassette corner spouts, between the outer skin and the
  // pillar trims (outboard of the liftgate harness, clear of the ends of the curtain airbags): the front
  // ones down the A-pillar and the hinge pillar ahead of the door hinges, the rear ones down the C-pillar.  The rear ones stay
  // on the body: outboard over the rear header ahead of the liftgate harness, over the rear end of the
  // curtain airbag and under the harness where it turns onto the liftgate, down in front of the liftgate
  // opening seal (s 3.3), back along the roof rail between that seal (v 3.97) and the rear door seal
  // (v 3.9), and down the C-pillar behind the rear door opening.
  const drains = [];
  for (const { sd } of SIDES) {
    // (front: off the spout outboard under the headliner, then down the A-pillar inside its section the whole way, behind
    // the pillar trim: at v 4.03 on the windshield side of the headliner harness (LH, v 4.02 further in), round the
    // pillar root ahead of the harness, the tweeter pocket and the door seal's corner, across the sail under the harness
    // where it lies against the skin (s 1.625, v 3.74), on the door seal side of it down to the hinge pillar and down
    // inside the hinge pillar to its outlet; it no longer passes through the door opening)
    drains.push(named(`drainF${sd}`, tube([skinAt(R0 - 0.02, 4.17, sd, -0.022), skinAt(2.37, 4.095, sd, -0.016), skinAt(2.33, 4.04, sd, -0.01),
      skinAt(2.2, 4.035, sd, -0.009), skinAt(2.1, 4.03, sd, -0.011), ...[[1.95, 4.032, -0.0095], [1.8, 4.033, -0.0095], [1.7, 4.036, -0.0105],
        [1.65, 4.025, -0.013], [1.622, 3.98, -0.016], [1.615, 3.88, -0.019], [1.62, 3.78, -0.021], [1.63, 3.7, -0.021], [1.64, 3.6, -0.019],
        [1.632, 3.45, -0.016], [1.6, 3.3, -0.015]].map(([s, v, o]) => skinAt(s, v, sd, o)),
      skinAt(1.54, 2.7, sd, -0.015), skinAt(1.53, 2.0, sd, -0.02), skinAt(1.53, 1.5, sd, -0.02), skinAt(1.53, 0.9, sd, -0.02)], 0.005, 'rubber')));
    drains.push(named(`drainR${sd}`, pipe([[R1 + 0.02, 4.17, -0.022], [3.215, 4.1, -0.016], [3.225, 4.06, -0.012], [3.268, 4.06, -0.012],
      [3.268, 3.94, -0.008], [3.5, 3.94, -0.008], [3.58, 3.86, -0.015], [3.62, 3.5, -0.015], [3.64, 3.0, -0.015], [3.64, 2.4, -0.02],
      [3.64, 1.5, -0.02], [3.64, 0.8, -0.02]].map(([s, v, o]) => skinAt(s, v, sd, o)), 0.005, 'rubber', { bend: 0.02 })));
  }
  reg.add({
    id: 'pano-frame', ko: '루프 프레임·배수관', en: 'Roof frame & drain tubes',
    groups: ['panoramic-roof-frame-and-drain-tubes'],
    object: group(drains, region([[RB[0] - 0.01, RB[1] + 0.01, 4.04, 5]], { offset: -0.02, mat: 'aluminum', edges: false })),
  });
  reg.add({
    id: 'pano-finishers', ko: '루프 아플리케(앞·측면 마감재)', en: 'Roof appliques (front & side finishers)',
    groups: ['panoramic-roof-fittings-and-finishers'],
    object: group(
      region([[SV.roof[0], R0, SV.vRoof, 5]], { offset: 0.004, mat: 'blackPlastic' }),
      region([[R0, R1, SV.vRoof, VS]], { offset: 0.004, mat: 'blackPlastic', side: 'L' }),
      region([[R0, R1, SV.vRoof, VS]], { offset: 0.004, mat: 'blackPlastic', side: 'R' }),
    ),
  });
  // on the turned-down flange of the roof opening, under the glass edge and just below the roof
  // skin; the side runs sit inside the opening edge, inboard of the drive tracks
  const sealPts = [[R0, 5], [R0, VS + 0.025], [R1, VS + 0.025], [R1, 5]];
  reg.add({
    id: 'roof-seals', ko: '루프 실·끼임 방지 센서', en: 'Roof seals & anti-pinch sensors',
    groups: ['roof-seals-and-anti-pinch-sensors'],
    object: group(loop(sealPts, 'L', -0.006, 0.006, 'rubber'), loop(sealPts, 'R', -0.006, 0.006, 'rubber')),
  });
  reg.add({
    id: 'wind-deflector', ko: '윈드 디플렉터', en: 'Wind deflector',
    groups: ['shades-and-wind-deflector'],
    object: group(
      region([[R0 + 0.005, R0 + 0.04, 4.3, 5]], { offset: 0.012, mat: 'blackPlastic', edges: false }),
      // pivot arms down to the roof cassette frame
      ...SIDES.map(({ sd }) => named(`arm${sd}`, rbox([0.03, 0.034, 0.03], skinAt(R0 + 0.022, 4.31, sd, -0.006).toArray(), 'darkMetal', { r: 0.004 }))),
    ),
  });
  void V; void cyl; void mesh; void quadPlate; void THREE;
}
