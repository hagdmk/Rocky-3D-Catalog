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
  J('brake-lines#junction', 'rear-subframe#sideR', 'rear junction block bolted to the subframe'),
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
  J('vacuum-booster#hose@start', 'vacuum-booster#booster', 'vacuum hose on the booster'),
  J('vacuum-booster#hose@end', 'vacuum-pump', 'vacuum hose to the vacuum pump'),

  // --- coolant loops (battery-cooling*, motor-cooling*)
  J('battery-coolant-loop#heaterToBattery@start', 'battery-coolant-loop#heater', 'HOSE (BATT) - HEATER TO BATTERY'),
  J('battery-coolant-loop#heaterToBattery@end', 'hv-battery', 'HOSE (BATT) - HEATER TO BATTERY'),
  J('battery-coolant-loop#batteryTo4wv@start', 'hv-battery', 'HOSE (BATT), BATTERY TO 4-WAY VLV'),
  J('battery-coolant-loop#batteryTo4wv@end', 'four-way-valve', 'HOSE (BATT), BATTERY TO 4-WAY VLV'),
  J('battery-coolant-loop#reservoirTo4wv@start', 'coolant-reservoir', 'HOSE RESERVOIR TO 4 WAY VALVE'),
  J('battery-coolant-loop#reservoirTo4wv@end', 'four-way-valve', 'HOSE RESERVOIR TO 4 WAY VALVE'),
  J('motor-coolant-loop#radToPump@start', 'radiator', 'radiator outlet to the powertrain pump'),
  J('motor-coolant-loop#radToPump@end', 'motor-coolant-loop#pump', 'radiator outlet to the powertrain pump'),
  J('motor-coolant-loop#valve3ToRad@start', 'motor-coolant-loop#valve3', 'HOSE (PT), 3WVLV TO RAD'),
  J('motor-coolant-loop#valve3ToRad@end', 'radiator', 'HOSE (PT), 3WVLV TO RAD'),
  J('motor-coolant-loop#valve3To4wv@start', 'motor-coolant-loop#valve3', 'HOSE (PT) - 3 WAY VLV TO 4 WAY VLV'),
  J('motor-coolant-loop#valve3To4wv@end', 'four-way-valve', 'HOSE (PT) - 3 WAY VLV TO 4 WAY VLV'),
  J('motor-coolant-loop#pumpToCharger@start', 'motor-coolant-loop#pump', 'HOSE (PT) - PUMP TO ROCKER'),
  J('motor-coolant-loop#pumpToCharger@end', 'charger-master', 'HOSE (PT) - ROCKER TO CHARGER'),
  J('motor-coolant-loop#chargerToDu@start', 'charger-master', 'HOSE (PT) - CHARGER TO MOTOR / RDU'),
  J('motor-coolant-loop#chargerToDu@end', 'rear-drive-unit-small', 'HOSE (PT) - CHARGER TO RDU'),
  J('motor-coolant-loop#chargerToDu@end', 'rear-drive-unit-large', 'HOSE (PT) - CHARGER TO MOTOR'),
  J('motor-coolant-loop#duTo3wv@start', 'rear-drive-unit-small', 'HOSE (PT) - INVERTER TO ROCKER'),
  J('motor-coolant-loop#duTo3wv@start', 'rear-drive-unit-large', 'HOSE (PT) - INVERTER TO ROCKER'),
  J('motor-coolant-loop#duTo3wv@end', 'motor-coolant-loop#valve3', 'HOSE (PT) - RKR TO BYPASS 3 WAY VLV'),
  J('hvac-drain-hose#hose@start', 'hvac-unit', 'HVAC DRAIN HOSE on the HVAC case'),

  // --- refrigerant
  J('ac-lines#discharge@start', 'ac-compressor', 'discharge line from the compressor'),
  J('ac-lines#discharge@end', 'ac-condenser', 'discharge line into the condenser'),
  J('ac-lines#liquid@start', 'ac-condenser', 'liquid line from the condenser'),
  J('ac-lines#liquid@end', 'hvac-unit', 'liquid line to the evaporator in the HVAC case'),
  J('ac-lines#suction@start', 'hvac-unit', 'suction line from the evaporator'),
  J('ac-lines#suction@end', 'ac-compressor', 'suction line to the compressor'),

  // --- high voltage
  ...['cableA', 'cableB'].flatMap((n) => [
    J(`hv-cable-battery#${n}@start`, 'hv-battery', 'HVBAT TO HVJB harness at the pack'),
    J(`hv-cable-battery#${n}@end`, 'rear-hvjb', 'HVBAT TO HVJB harness at the junction box'),
  ]),
  J('hv-cable-inverter#cable@start', 'rear-hvjb', 'DRIVE INVERTER TO REAR HVJB'),
  J('hv-cable-inverter#cable@end', 'rear-drive-unit-small', 'REAR HVJB TO SDU'),
  J('hv-cable-inverter#cable@end', 'rear-drive-unit-large', 'DRIVE INVERTER TO REAR HVJB'),
  J('hv-cable-chargeport#cable@start', 'charger-master', 'charge port cable at the charger'),
  J('hv-cable-chargeport#cable@end', 'charge-port-inlet', 'charge port cable at the inlet'),
  J('hv-cable-front#cable@start', 'rear-hvjb', 'HVJB TO DC/DC along the RH sill'),
  J('hv-cable-front#cable@end', 'dc-dc-converter', 'HVJB TO DC/DC along the RH sill'),
  J('hv-cable-front#toFjb@start', 'dc-dc-converter', 'feed to the front junction box'),
  J('hv-cable-front#toFjb@end', 'front-junction-box', 'feed to the front junction box'),
  J('hv-cable-front-du#cable@start', 'front-junction-box', 'FJB TO FR SDU'),
  J('hv-cable-front-du#cable@end', 'front-drive-unit', 'FJB TO FR SDU'),
  J('front-junction-box', 'front-drive-unit', 'front junction box on the front drive unit'),
  J('dcdc-12v-cable#cable@start', 'dc-dc-converter', '12 V cable from the DC-DC converter'),
  J('dcdc-12v-cable#cable@end', '12v-battery', '12 V cable to the 12 V battery'),
  J('dc-dc-converter#case', 'front-inner-R#rail', 'DC-DC converter bracket on the RH rail (BRKT DC-DC)'),
  ...['rear-hvjb', 'charger-master', 'charger-slave'].map((id) => J(id, 'hv-battery', 'mounted on the pack hump under the rear seat')),
  J('four-way-valve', 'motor-bay-absorber', 'valve bracket under the frunk tub'),
  J('ambient-temp-sensor', 'cooling-duct', 'ambient sensor clipped to the duct'),
  J('ambient-temp-sensor', 'radiator', 'ambient sensor at the radiator'),

  // --- body and closures
  // front structure and bumper systems
  ...each((s) => [
    J('front-crossmember#cmbr', `front-inner-${s}#towerBrace`, 'shock tower crossmember #12 bolted to the tower brace member #9/#10 (BLT M8x25 #11)'),
    J(`front-bumper-beam#can${s}`, `front-inner-${s}#rail`, 'bumper beam isolator bracket #8 bolted to the rail end (BOLT M10x25 #9)'),
    J(`front-bumper-carrier#railMount${s}`, `front-inner-${s}#rail`, 'carrier bolted to the front rail (energy absorber #23 SHIM, FRONT RAIL TO CARRIER)'),
    J(`front-ankle-catcher#arm${s}`, 'front-bumper-carrier#lower', 'ankle catcher #2B bolted to the carrier lower rail (BLT M6x30 #3)'),
  ]),
  J('front-ankle-catcher#armL', 'front-ankle-catcher#catcher', 'mounting arm moulded on the ankle catcher #2B'),
  J('front-ankle-catcher#armR', 'front-ankle-catcher#catcher', 'mounting arm moulded on the ankle catcher #2B'),
  J('front-undertray', 'front-bumper-carrier#lower', 'front aero shield #1 front edge on the carrier lower rail (BLT M6x18 #4)'),
  ...each((s) => [J(`front-bumper-carrier#condenserBrkt${s}`, 'ac-condenser', 'CONDENSER BRACKET (DM carrier #7 = condenser #8) holds the condenser module on the carrier')]),
  J('hood-latch#latch', 'front-bumper-carrier#upper', 'hood latch #5 bolted to the carrier upper beam (BLT M8x24 #4)'),
  J('hood-latch#cable@start', 'hood-latch#latch', 'release cable #2 hooked into the latch'),
  J('hood-latch#cable@end', 'hood-latch#handle', 'release cable #2 on the release handle #1'),
  J('hood-latch#handle', 'dash-panel', 'release handle #1 on the LH lower instrument panel'),
  J('hood-seal', 'frunk', 'SEAL - HOOD on the frunk tub rim (frunk #19 = hood seals #1)'),
  J('hood-cowl-seal', 'underhood-apron-rear', 'SEAL - HOOD TO COWL #2 on the rear underhood apron'),
  // rear structure and bumper
  ...each((s) => [
    J(`trunk-floor-ext-${s}`, 'trunk-floor#floor', 'trunk floor extension #2/#3 joined to the trunk floor #1'),
    J(`trunk-floor-ext-${s}`, `rear-quarter-inner-${s}#tower`, 'trunk floor extension (quarter inner #5/#6) joined to the shock tower'),
    J('rear-bumper-beam#beam', `rear-rail-${s}#rail`, 'rear bumper beam #1 bolted to the rail ends (NUT M10 #2)'),
    J('rear-bumper-beam#crossmember', `rear-rail-${s}#rail`, 'rear crossmember #3 bolted under the rail ends'),
  ]),
  ...each((s) => [J(`rear-quarter-inner-${s}#cPillar`, `body-side-${s}`, 'quarter inner C-pillar reinforcement bonded to the body side outer (REINF - RR LAMP HOUSING, body side #4 = quarter inner #15/#16)')]),
  J('trunk-floor#rearPanel', 'trunk-floor#floor', 'rear body panel #4 joined to the trunk floor #1'),
  J('trunk-floor#rearPanel', 'rear-bumper-beam#beam', 'rear body panel #4 lower edge on the bumper beam'),
  // cabin
  J('windshield-edge-seal', 'windshield', 'SEAL, WINDSHIELD EDGE (glass #2) along the windshield base'),
  J('windshield-edge-seal', 'dash-panel#topPad', 'SEAL, WINDSHIELD EDGE (dash panel #1) on the IP top pad'),
  J('dash-support-frame#beam', 'hvac-unit', 'HVAC case bolted to the cross-car beam (dash support frame #7 BLT M8x25)'),
  J('driver-airbag', 'steering-wheel#wheel', 'driver airbag module clipped into the steering wheel hub'),
  ...each((s) => [J(`driver-airbag#switchLead${s}`, 'switches', 'ASY, STEERING CONTROL SWITCH HARNESS (front airbags #2 = switches #1) plugged into the spoke switch')]),
  ...each((s) => [J(`sun-visor-${s}`, 'headliner', 'sun visor pivot clipped through the headliner to the roof header')]),
  // closures
  ...each((s) => [J(`liftgate-drain-${s}@start`, 'liftgate-seal', 'drain tube funnel #1 in the lamp housing gutter under the liftgate seal flange')]),
  J('liftgate-drain-L', 'charge-port-inlet', 'drain tube #1 (charge port group #*) clipped behind the charge port inlet'),
  // panoramic roof
  ...each((s) => [
    J(`pano-frame#drainF${s}@start`, 'pano-cassette', 'front drain tube on the cassette drain spout'),
    J(`pano-frame#drainR${s}@start`, 'pano-cassette', 'rear drain tube on the cassette drain spout'),
  ]),
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
