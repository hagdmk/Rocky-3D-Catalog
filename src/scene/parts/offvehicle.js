// Items that are not mounted on the car: charging equipment, workshop
// consumables and owner information (kept in the glove box).

import {
  group, named, rbox, box, cyl, tube,
} from '../geom.js';

export function buildOffVehicle(reg) {
  reg.add({
    id: 'wall-connector', ko: '월 커넥터·모바일 커넥터·어댑터 (차량 외부)', en: 'Wall connector, mobile connector & adapters (off vehicle)',
    groups: ['external-charging-systems'],
    object: group(
      cyl(0.03, 1.0, 'y', [-3.35, 0.5, -1.95], 'steel'),
      box([0.3, 0.02, 0.3], [-3.35, 0.01, -1.95], 'steel'),
      rbox([0.09, 0.38, 0.26], [-3.3, 1.08, -1.95], 'paint', { r: 0.04 }),
      // cable to the connector handle, plugged into the charge port inlet
      named('cable', tube([[-3.27, 0.95, -1.9], [-3.1, 0.3, -1.75], [-2.8, 0.04, -1.5], [-2.4, 0.05, -1.25], [-2.15, 0.45, -1.02], [-2.08, 0.82, -0.92],
        [-2.072, 0.828, -0.9]], 0.012, 'rubber')),
      rbox([0.34, 0.12, 0.24], [-2.75, 0.06, -1.05], 'blackPlastic', { r: 0.03 }),
      rbox([0.08, 0.05, 0.05], [-2.55, 0.025, -1.32], 'darkMetal', { r: 0.01 }),
      rbox([0.08, 0.05, 0.05], [-2.45, 0.025, -1.4], 'darkMetal', { r: 0.01 }),
    ),
  });
  reg.add({
    id: 'repair-consumables', ko: '구조 수리 소모품(리벳·접착제·용접 와이어, 차량 외부)', en: 'Structural repair consumables (off vehicle)',
    groups: ['structural-repair-consumables'],
    object: group(
      rbox([0.42, 0.22, 0.3], [2.85, 0.11, -1.75], 'greyPlastic', { r: 0.02 }),
      cyl(0.03, 0.24, 'y', [2.7, 0.34, -1.8], 'paper'),
      cyl(0.03, 0.24, 'y', [2.78, 0.34, -1.8], 'paper'),
      cyl(0.09, 0.08, 'y', [3.0, 0.26, -1.7], 'copper', { seg: 24 }),
    ),
  });
  reg.add({
    id: 'owner-info', ko: '차량 비치 자료(퀵 가이드·터치업 펜, 글로브박스)', en: 'In-car information (quick guide, touch-up pens - glove box)', tags: 'R',
    groups: ['in-car-information'],
    object: group(
      box([0.06, 0.012, 0.18], [0.5, 0.56, 0.4], 'paper'),
      cyl(0.006, 0.12, 'z', [0.5, 0.575, 0.36], 'paint'),
    ),
  });
}
