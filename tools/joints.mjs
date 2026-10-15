// Declarative connectivity rules for tools/check.mjs.
//
// Part references:
//   'componentId'                 the whole component
//   'componentId#name'            a mesh or group named with named() in src/scene
//   'componentId#name@start|@end' one end of a beam / bar / tube (within r + 3 mm)
//
// JOINTS   parts that are physically fastened together: their surfaces must
//          touch or overlap (gap <= max mm, default 2) in every vehicle
//          configuration where both are shown.  `variant` limits a row to some
//          configurations; `note` cites the catalog callout or part number.
// PASS_OK  linear members (beams, bars, tubes) may not run more than 10 mm of
//          their centre line through another part's solid unless the pair is a
//          joint or listed here with a reason.
// SHARED_OK part numbers listed in several groups that are deliberately drawn at
//          different places (class "same PN, different physical part").

const SIDES = [['L', -1], ['R', 1]];
const each = (fn) => SIDES.flatMap(([s, sg]) => fn(s, sg));

const FRONT = [['LF', 'L'], ['RF', 'R']];
const REAR = [['LB', 'L'], ['RB', 'R']];
const CORNERS = [...FRONT, ...REAR];
const front = (fn) => FRONT.flatMap(([k, s]) => fn(k, s));
const rear = (fn) => REAR.flatMap(([k, s]) => fn(k, s));
const corners = (fn) => CORNERS.flatMap(([k, s]) => fn(k, s));
const J = (a, b, note, opts = {}) => ({ a, b, note, ...opts });

export const JOINTS = [
  // --- steering: column -> upper I-shaft link -> lower link (shared by both groups) -> gear -> knuckles
  J('steering-wheel#column', 'dash-support-frame', 'column bolted to the dash support frame (upper #2/#3)'),
  J('steering-ishaft-upper#yoke', 'steering-wheel#column@end', 'upper link #6 U-joint on the column spline, bolt #7'),
  J('steering-ishaft-upper#sleeve', 'steering-ishaft#lowerLink@start', 'upper link sleeve on the lower link (upper #8/#9)'),
  J('steering-ishaft#dashSeal', 'sound-insulation', 'I-shaft dash seal in the firewall (lower #8 = upper #10)'),
  J('steering-ishaft#ujLower', 'steering-gear#inputShaft@end', 'lower U-joint on the pinion input shaft (lower #7 = upper #8)'),
  ...each((s) => [
    J(`steering-gear#boss${s}`, `front-subframe#rail${s}`, 'gear bolted to the subframe (lower #2 M14x78)'),
    J(`steering-gear#stud${s}`, `knuckle-${s}F#steerEye`, 'outer tie rod #3 ball stud in the knuckle steering arm, nut #5'),
  ]),

  // --- front corners
  ...front((k, s) => [
    J(`front-arms-${k}#ucaBushF`, `front-inner-${s}#tower`, 'upper arm #1 front bushing, BLT M10x100 #2'),
    J(`front-arms-${k}#ucaBushR`, `front-inner-${s}#tower`, 'upper arm #1 rear bushing, BLT M10x100 #2'),
    J(`front-arms-${k}#ucaBJ`, `knuckle-${k}#clamp`, 'upper ball joint in the knuckle clamp (#4/#5)'),
    J(`front-arms-${k}#foreBush`, `front-subframe#rail${s}`, 'fore link #6 bushing, cam bolt #7'),
    J(`front-arms-${k}#aftBush`, `front-subframe#rail${s}`, 'aft link #11 bushing, cam bolt #12'),
    J(`front-arms-${k}#foreBJ`, `knuckle-${k}#upright`, 'fore link ball joint, nut #10'),
    J(`front-arms-${k}#aftBJ`, `knuckle-${k}#upright`, 'aft link ball joint, nut #10'),
    J(`front-air-spring-${k}#clevisBolt`, `front-arms-${k}#damperBush`, 'strut clevis on the aft link (#3 M14x94)'),
    J(`front-coil-spring-${k}#clevisBolt`, `front-arms-${k}#damperBush`, 'strut clevis on the aft link (#3 M14x94)'),
    J(`front-air-spring-${k}#topMount`, `front-inner-${s}#tower`, 'strut top in the shock tower (3 studs, nuts #2)'),
    J(`front-coil-spring-${k}#topMount`, `front-inner-${s}#tower`, 'strut top in the shock tower (3 studs, nuts #2)'),
    J(`front-stabilizer#link${s}@end`, `front-arms-${k}#foreLink`, 'stabilizer link #5/#6 to the fore link, nuts #7'),
    J(`front-stabilizer#clamp${s}`, `front-subframe#rail${s}`, 'stabilizer bushing clamp, BOLT M10x30 #4'),
    J(`front-stabilizer#clamp${s}`, 'front-stabilizer#bar', 'bar held in the bushing clamp'),
    J(`front-height-sensor-${k}#body`, `front-subframe#rail${s}`, 'ride height sensor on the subframe'),
    J(`front-height-sensor-${k}#link@end`, `front-arms-${k}#aftLink`, 'height sensor link to the aft link'),
    J(`front-halfshaft-${s}#stub@end`, `knuckle-${k}#hub`, 'halfshaft stub through the hub, nut #5 M24'),
  ]),
  J('front-halfshaft-L#shaft@start', 'front-drive-unit', 'LH halfshaft #1 into the front drive unit'),
  J('front-halfshaft-R#jackshaft@start', 'front-drive-unit', 'jackshaft #3 flange on the front drive unit (#6 M10x25)'),
  J('front-halfshaft-R#shaft@start', 'front-halfshaft-R#jackshaft', 'RH halfshaft #2 on the jackshaft'),
  J('front-drive-unit#mount', 'front-subframe#railL', 'LHS motor mount #8/#9 (#10 M10x57)'),
  J('front-drive-unit#mount', 'front-drive-unit#inverter', 'LHS motor mount on the drive unit'),
  J('front-drive-unit#torqueArm', 'front-subframe#rearCross', 'torque reaction arm #13 (#14 M10x90)'),
  J('front-drive-unit#torqueArm', 'front-drive-unit#gearbox', 'torque reaction arm on the drive unit'),
  ...each((s) => [
    J(`front-subframe#post${s}@end`, `front-inner-${s}#rail`, 'front subframe mount in the body rail (#8 M14x50)'),
    J(`front-subframe#rearLeg${s}@end`, `front-inner-${s}#rail`, 'rear subframe mount at the rail end (#8 M14x50)'),
    J(`front-subframe#rearLeg${s}`, 'front-crossmember#torqueBox', 'rear subframe mount through the torque box'),
  ]),

  // --- rear corners
  ...rear((k, s) => [
    J(`rear-arms-${k}#lca`, `rear-subframe#side${s}`, 'lower control arm #1 inner bushings (#2 M12x100)'),
    J(`rear-arms-${k}#lca`, `knuckle-${k}#upright`, 'lower control arm outer bushing (#4 M14x102)'),
    J(`rear-arms-${k}#integral@start`, `rear-arms-${k}#lca`, 'integral link #6 to the lower arm (#7 M12x70)'),
    J(`rear-arms-${k}#integral@end`, `knuckle-${k}#upright`, 'integral link #6 to the knuckle (#7 M12x70)'),
    J(`rear-arms-${k}#toe@start`, `knuckle-${k}#upright`, 'toe link #8 outer end (#12/#14/#15)'),
    J(`rear-arms-${k}#toe@end`, `rear-subframe#side${s}`, 'toe link #8 inner end, cam bolt #9'),
    J(`rear-arms-${k}#upper@start`, `knuckle-${k}#gooseneck`, 'upper link #16 to the knuckle top (#13 M12x75)'),
    J(`rear-arms-${k}#upper@end`, `rear-subframe#tower${s}`, 'upper link #16 to the subframe tower (#7 + nut #3)'),
    J(`rear-air-spring-${k}#damper@start`, `rear-arms-${k}#lca`, 'strut bottom eye on the lower arm (#3 M14x84)'),
    J(`rear-coil-spring-${k}#damper@start`, `rear-arms-${k}#lca`, 'strut bottom eye on the lower arm (#3 M14x84)'),
    J(`rear-air-spring-${k}#topMount`, `rear-quarter-inner-${s}#tower`, 'strut top in the body shock tower (studs #5, nuts #2)'),
    J(`rear-coil-spring-${k}#damper@end`, `rear-quarter-inner-${s}#tower`, 'strut top in the body shock tower (studs #5, nuts #2)'),
    J(`rear-stabilizer#link${s}@end`, `rear-arms-${k}#lca`, 'stabilizer link #5 to the lower arm'),
    J(`rear-height-sensor-${k}#body`, `rear-subframe#side${s}`, 'ride height sensor on the subframe (M5 1003397)'),
    J(`rear-height-sensor-${k}#link@end`, `rear-arms-${k}#lca`, 'height sensor link to the lower arm'),
    J(`rear-halfshaft-${s}#stub@end`, `knuckle-${k}#hub`, 'halfshaft stub through the hub, nut #2 M24'),
    J(`rear-halfshaft-${s}#shaft@start`, 'rear-drive-unit-small', 'inner spline in the drive unit side gear'),
    J(`rear-halfshaft-${s}#shaft@start`, 'rear-drive-unit-large', 'inner spline in the drive unit side gear'),
    J(`rear-subframe#postF${s}@end`, `rear-rail-${s}#railFront`, 'front isolator stud #2 into the rail'),
    J(`rear-subframe#postB${s}@end`, `rear-rail-${s}#rail`, 'rear isolator bolt #3 into the rail'),
    J(`rear-rail-${s}#closeout`, `sill-${s}`, 'rear rail node tied to the sill'),
  ]),
  J('rear-stabilizer#bar', 'rear-subframe', 'stabilizer bar clamped to the subframe (#4)'),
  ...['rear-drive-unit-small', 'rear-drive-unit-large'].flatMap((du) => [
    J('rear-subframe#sideMount', du, 'side motor mount (subframe #8)'),
    J('rear-subframe#frontMount', du, 'front transmission mount (LDU group #20)'),
    J('rear-subframe#rearMount', du, 'rear transmission mount (LDU group #21)'),
  ]),
  J('rear-subframe#frontCross', 'hv-battery', 'shear plates #4/#5 tie the subframe to the pack (M5 1003397)'),

  // --- wheels and brakes
  ...corners((k) => [
    J(`brake-rotor-${k}#hat`, `knuckle-${k}#hub`, 'rotor hat on the hub flange'),
    J(`brake-rotor-${k}#hat`, `wheel-${k}#centre`, 'wheel mounting face on the rotor hat'),
    J(`brake-caliper-${k}#bracket@end`, `knuckle-${k}#upright`, 'caliper bracket bolted to the knuckle'),
    J(`brake-caliper-${k}#bracket@start`, `brake-caliper-${k}#caliper`, 'caliper on its bracket'),
    J(`wheel-speed-sensor-${k}#head`, `knuckle-${k}`, 'wheel speed sensor in the knuckle'),
    J(`jounce-hose-${k}#hose@start`, `brake-caliper-${k}`, 'brake hose banjo on the caliper'),
  ]),
  ...rear((k) => [
    J(`park-brake-${k}#bracket@end`, `knuckle-${k}#upright`, 'parking brake bracket on the knuckle (BLT M10x86 #2)'),
    J(`park-brake-${k}#bracket@start`, `park-brake-${k}#caliper`, 'parking brake caliper on its bracket'),
  ]),
  ...front((k, s) => [J(`jounce-hose-${k}#hose@end`, `front-inner-${s}#tower`, 'brake hose body bracket on the shock tower')]),
  ...rear((k, s) => [J(`jounce-hose-${k}#hose@end`, `rear-quarter-inner-${s}#tower`, 'brake hose body bracket on the shock tower')]),
  ...corners((k, s) => [J(`brake-lines#${k[1] === 'F' ? 'front' : 'rear'}${s}@end`, `jounce-hose-${k}#hose@end`, 'hard line to the brake hose at the body bracket')]),
  J('brake-lines#mcToAbs@start', 'master-cylinder', 'master cylinder to the ABS unit'),
  J('brake-lines#mcToAbs@end', 'abs-module', 'master cylinder to the ABS unit'),
  ...['frontL', 'frontR', 'toRear'].map((n) => J(`brake-lines#${n}@start`, 'abs-module', 'hard line out of the ABS unit')),
  J('brake-lines#junction', 'rear-subframe#sideL', 'rear junction block bolted to the subframe'),
  ...['toRear@end', 'rearL@start', 'rearR@start'].map((n) => J(`brake-lines#${n}`, 'brake-lines#junction', 'line at the rear junction block')),
  J('brake-pedal#pushrod@start', 'brake-pedal#arm', 'pushrod on the pedal arm'),
  J('brake-pedal#pushrod@end', 'vacuum-booster', 'PIN BOOSTER TO PEDAL (pedal #5 = booster group #8)'),
  J('brake-pedal#pushrod@end', 'ibooster', 'pushrod into the iBooster input'),

  // --- air suspension supply
  J('air-lines-front#toLF@start', 'air-compressor#valveBlock', 'front line out of the valve block'),
  J('air-lines-front#toRF@start', 'air-compressor#valveBlock', 'front line out of the valve block'),
  J('air-lines-front#toLF@end', 'front-air-spring-LF#bellows', 'line fitting on the LF air spring'),
  J('air-lines-front#toRF@end', 'front-air-spring-RF#bellows', 'line fitting on the RF air spring'),
  J('air-lines-front#toReservoir@start', 'air-compressor#valveBlock', 'AIR LINE VALVE TO RSVR (#4)'),
  J('air-lines-front#toReservoir@end', 'air-reservoir', 'AIR LINE VALVE TO RSVR (#4)'),
  J('air-lines-rear#main@start', 'air-compressor#valveBlock', 'primary bundle out of the valve block'),
  J('air-lines-rear#main@end', 'rear-air-spring-LB#sleeve', 'line fitting on the LB air spring'),
  J('air-lines-rear#toRB@end', 'rear-air-spring-RB#sleeve', 'line fitting on the RB air spring'),
  J('air-lines-rear#toRB@start', 'air-lines-rear#main', 'RH branch off the primary bundle'),
];

export const PASS_OK = [
  { a: 'front-air-spring-*#damper', b: 'front-halfshaft-*', reason: 'known limit of the simplified model: the catalog shows a plain clevis on the aft link, so the strut crosses the halfshaft' },
  { a: 'front-coil-spring-*#damper', b: 'front-halfshaft-*', reason: 'known limit of the simplified model: the catalog shows a plain clevis on the aft link, so the strut crosses the halfshaft' },
];

export const SHARED_OK = [
  { keys: ['PN:1014388-*', 'PN:1048473-*', 'PN:1014395-*'], reason: 'park-assist sensors and their retainer rings: front and rear bumpers use the same part numbers' },
  { keys: ['PN:1021114-00-E', 'PN:1008999-00-E', 'PN:1064744-00-B', 'PN:1063215-00-B', 'PN:1007730-00-B', 'PN:1008986-00-B', 'PN:1036480-00-B', 'PN:1036479-00-B', 'PN:1007729-00-D', 'PN:1008982-00-D', 'PN:1052476-00-A', 'PN:1052477-00-A', 'PN:1007750-00-C', 'PN:1017592-00-B', 'PN:1017736-00-B', 'PN:1008995-00-F', 'PN:1016009-00-E'], reason: 'exterior door handle parts: front and rear doors use the same part numbers' },
  { keys: ['PN:1007152-00-D', 'PN:1003749-00-B', 'PN:1002966-00-B', 'PN:1007941-00-B'], reason: 'door trim parts: front and rear door trim pads use the same part numbers' },
  { keys: ['PN:6008250-00-B'], reason: 'striker tapping plate: front and rear door latches use the same part number' },
  { keys: ['PN:1008246-00-B'], reason: 'Dual Lock fastener tape used at several places' },
  { keys: ['PN:1054797-00-A', 'PN:1054798-00-A'], reason: 'glass setting pads: listed with the glass and again with the shop supplies (owner information)' },
  { keys: ['PN:1007151-00-D'], reason: 'puddle lamp: one part number used in every door and in the liftgate and frunk trim' },
  { keys: ['PN:1006396-00-A'], reason: 'Dual Lock fastener tape used at several places' },
  { keys: ['PN:1038709-00-A'], reason: 'ferrite core clipped onto several separate harnesses' },
  { keys: ['PN:1021413-00-A'], reason: 'rear holder for HV connector: one at each HV connector' },
  { keys: ['PN:1027170-00-A'], reason: 'hub and bearing: same part number front and rear' },
  { keys: ['PN:6006618-00-A'], reason: 'door striker: same part number on front and rear doors' },
  { keys: ['PN:1018585-00-A'], reason: 'NVH cap used at several body openings' },
  { keys: ['PN:1009338-00-A'], reason: 'palnut used at several places' },
  { keys: ['PN:6007384-00-C'], reason: '3-way valve: two separate valves (chiller bypass on the battery loop, radiator bypass on the powertrain loop)' },
];
