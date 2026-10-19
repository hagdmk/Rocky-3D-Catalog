// Declarative connectivity rules: checked by tools/check.mjs, and used by the viewer to
// draw the hidden mounting partners of visible parts.
//
// Part references:
//   'componentId'                 the whole component
//   'componentId#name'            a mesh or group named with named() in src/scene
//   'componentId#name@start|@end' one end of a beam / bar / tube (within r + 3 mm)
//
// JOINTS   parts that are physically fastened together: their surfaces must
//          touch or overlap (gap <= max mm, default 2) in every vehicle
//          configuration where both are shown.  `variant` limits a row to some
//          configurations; `note` cites the catalog callout or part number; `inset` gives the
//          reason when one part is set into the other over a whole face (heater core in its slot).
// PASS_OK  linear members (beams, bars, tubes) may not run more than 10 mm of
//          their centre line through another part's solid unless the pair is a
//          joint or listed here with a reason.
// SHARED_OK part numbers listed in several groups that are deliberately drawn at
//          different places (class "same PN, different physical part").
// FLOAT_OK components that may touch nothing (all others must touch another part).

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
  J('steering-wheel#columnBracket', 'dash-support-frame#beam', 'column mounting bracket bolted under the cross-car beam (upper #2 M8x40 / #3 M8x65)'),
  J('steering-wheel#columnBracket', 'steering-wheel#column', 'mounting bracket on the column tube (STEERING COLUMN ASSY #1)'),
  J('steering-ishaft-upper#yoke', 'steering-wheel#column@end', 'upper link #6 U-joint on the column spline, bolt #7'),
  J('steering-ishaft-upper#sleeve', 'steering-ishaft#lowerLink@start', 'upper link sleeve on the lower link (upper #8/#9)'),
  J('steering-ishaft#couplingBolt', 'steering-ishaft-upper#sleeve', 'BOLT H M10x35 (upper #8) with NUT HF M10 (upper #9) through the sleeve pinch'),
  J('steering-ishaft#dashSeal', 'sound-insulation#dash', 'I-shaft dash seal in the firewall (lower #8 = upper #10)'),
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
    J(`front-arms-${k}#foreLink@start`, `front-arms-${k}#foreBJ`, 'fore link #6 outer end in its ball joint housing'),
    J(`front-arms-${k}#aftBJ`, `knuckle-${k}#upright`, 'aft link ball joint, nut #10'),
    J(`front-air-spring-${k}#clevisBolt`, `front-arms-${k}#damperBush`, 'strut clevis on the aft link (#3 M14x94)'),
    J(`front-coil-spring-${k}#clevisBolt`, `front-arms-${k}#damperBush`, 'strut clevis on the aft link (#3 M14x94)'),
    J(`front-air-spring-${k}#clevisBolt`, `front-arms-${k}#aftLink`, 'clevis bolt #3 M14x94 through the damper eye of the aft link #11'),
    J(`front-coil-spring-${k}#clevisBolt`, `front-arms-${k}#aftLink`, 'clevis bolt #3 M14x94 through the damper eye of the aft link #11'),
    J(`front-air-spring-${k}#topMount`, `front-inner-${s}#tower`, 'strut top in the shock tower (3 studs, nuts #2)'),
    J(`front-coil-spring-${k}#topMount`, `front-inner-${s}#tower`, 'strut top in the shock tower (3 studs, nuts #2)'),
    J(`front-stabilizer#link${s}@end`, `front-arms-${k}#foreLink`, 'stabilizer link #5/#6 to the fore link, nuts #7'),
    J(`front-stabilizer#clamp${s}`, `front-subframe#rail${s}`, 'stabilizer bushing clamp, BOLT M10x30 #4'),
    J(`front-stabilizer#clamp${s}`, 'front-stabilizer#bar', 'bar held in the bushing clamp'),
    J(`front-height-sensor-${k}#body`, `front-subframe#rail${s}`, 'ride height sensor on the subframe'),
    J(`front-height-sensor-${k}#link@end`, `front-arms-${k}#aftLink`, 'height sensor link to the aft link'),
    J(`front-halfshaft-${s}#stub@end`, `knuckle-${k}`, 'outer CV stub splined through the hub bearing in the knuckle, nut #5 M24'),
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
    J(`rear-coil-spring-${k}#topMount`, `rear-quarter-inner-${s}#tower`, 'strut top in the body shock tower (studs #5, nuts #2)'),
    J(`rear-coil-spring-${k}#seat`, `rear-coil-spring-${k}#damper`, 'lower spring seat on the damper body (coil spring module #1)'),
    J(`rear-coil-spring-${k}#seat`, `rear-coil-spring-${k}#spring`, 'coil spring on its lower seat'),
    J(`rear-coil-spring-${k}#upperSeat`, `rear-coil-spring-${k}#spring`, 'coil spring under its upper seat'),
    J(`rear-stabilizer#link${s}@end`, `rear-arms-${k}#lca`, 'stabilizer link #5 to the lower arm'),
    J(`rear-height-sensor-${k}#body`, `rear-subframe#side${s}`, 'ride height sensor on the subframe (M5 1003397)'),
    J(`rear-height-sensor-${k}#link@end`, `rear-arms-${k}#lca`, 'height sensor link to the lower arm'),
    J(`rear-halfshaft-${s}#stub@end`, `knuckle-${k}`, 'outer CV stub splined through the hub bearing in the knuckle, nut #2 M24'),
    J(`rear-halfshaft-${s}#shaft@start`, 'rear-drive-unit-small', 'inner spline in the drive unit side gear'),
    J(`rear-halfshaft-${s}#shaft@start`, 'rear-drive-unit-large', 'inner spline in the drive unit side gear'),
    J(`rear-subframe#studF${s}`, `rear-rail-${s}#railFront`, 'front isolator stud #2 M14-M10x100 into the rail'),
    J(`rear-subframe#isoF${s}`, `rear-rail-${s}#railFront`, 'front isolator clamped under the rail by stud #2'),
    J(`rear-subframe#shearPlate${s}`, `rear-subframe#studF${s}`, 'shear plate #4 LH / #5 RH on the front isolator stud #2, nut #6'),
    J(`rear-subframe#shearPlate${s}`, 'hv-battery', 'shear plate #4/#5 screwed to the battery pack rear edge with BOLT M5x15 #7 (1003397, qty 6; also HV battery assembly #10, qty 4, pg 9, no use given; the pg 13 row of #10 is for the aeroshield support tab); plate PN per pack version 1.5 / 2.0. Simplification: the catalog shows the plate as the lowest layer with the M5 bolts up from below into the pack; the pack has no rear tab drawn under the isolator, so the plate front end is drawn resting on the pack top edge'),
    J(`rear-stabilizer#clamp${s}`, `rear-subframe#side${s}`, 'stabilizer bar bushing clamp under the side member, BOLT HF M10x25 #4'),
    J(`rear-stabilizer#clamp${s}`, 'rear-stabilizer#bar', 'bar held in the bushing clamp'),
    J(`rear-subframe#postB${s}@end`, `rear-rail-${s}#rail`, 'rear isolator bolt #3 into the rail'),
    J(`rear-rail-${s}#closeout`, `sill-${s}`, 'rear rail node tied to the sill'),
  ]),
  ...['rear-drive-unit-small', 'rear-drive-unit-large'].flatMap((du) => [
    J('rear-subframe#sideMount', du, 'side motor mount (subframe #8)'),
    J('rear-subframe#frontMount', du, 'front transmission mount (LDU group #20)'),
    J('rear-subframe#rearMount', du, 'rear transmission mount (LDU group #21)'),
  ]),

  // --- wheels and brakes
  ...corners((k) => [
    J(`brake-rotor-${k}#hat`, `knuckle-${k}#hub`, 'rotor hat on the hub flange'),
    J(`brake-rotor-${k}#hat`, `wheel-${k}#centre`, 'wheel mounting face on the rotor hat'),
    J(`brake-rotor-${k}#shield`, `knuckle-${k}#upright`, 'dust shield #6 screwed to the knuckle (BOLT TRX BTNHD M6x16 #7)'),
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
  J('vacuum-pump#bracket', 'front-inner-L#rail', 'BRKT - BRAKE VACUUM PUMP (#2) bolted under the LH front rail (BLT HF M6x18 #4)'),
  J('vacuum-pump#bracket', 'vacuum-pump#pump', 'pump and isolators (#1) on the bracket (BLT M6x16 #3)'),
  J('air-compressor#bracket', 'front-inner-L#rail', 'AIR SUSP COMPRESSOR BRKT (#8) bolted under the LH front rail (BLT M6x50 #9)'),
  J('air-compressor#isolators', 'air-compressor#bracket', 'compressor isolators (spring washers #10, spring seats #11, springs #12) on the bracket'),
  J('air-compressor#isolators', 'air-compressor#compressor', 'compressor (#7) hung on its three isolators'),
  J('air-reservoir', 'front-subframe#frontCross', 'reservoir mount assemblies #2 (base #28, strap #29, cradle #30) on the subframe front cross member'),
  J('air-suspension-ecu#bracket', 'rear-quarter-inner-L#quarterInner', 'BRACKET - ECU - AIR SUSPENSION (#1) bolted (BLT HF M6x20 #2) to the LH rear quarter inner (ASSY - RR QTR INR, quarter inner #13) behind the trunk side trim'),
  J('air-suspension-ecu#bracket', 'air-suspension-ecu#ecu', 'ACTIVE SUSP ECU PROCESSOR (#3) screwed to its bracket (SCR M6x16 #4)'),

  // --- coolant loops (battery-cooling*, motor-cooling*)
  J('battery-coolant-loop#heaterToBattery@start', 'battery-coolant-loop#heater', 'HOSE (BATT) - HEATER TO BATTERY'),
  J('battery-coolant-loop#heaterToBattery@end', 'hv-battery', 'HOSE (BATT) - HEATER TO BATTERY'),
  J('battery-coolant-loop#batteryTo4wv@start', 'hv-battery', 'HOSE (BATT), BATTERY TO 4-WAY VLV'),
  J('battery-coolant-loop#batteryTo4wv@end', 'four-way-valve', 'HOSE (BATT), BATTERY TO 4-WAY VLV'),
  J('battery-coolant-loop#reservoirTo4wv@start', 'coolant-reservoir', 'HOSE RESERVOIR TO 4 WAY VALVE'),
  J('battery-coolant-loop#reservoirTo4wv@end', 'four-way-valve', 'HOSE RESERVOIR TO 4 WAY VALVE'),
  J('motor-coolant-loop#reservoirToPump@start', 'coolant-reservoir', 'ASY - HOSE (PT) - RESERVOIR TO PUMP (motor cooling #2)'),
  J('motor-coolant-loop#reservoirToPump@end', 'motor-coolant-loop#pump', 'ASY - HOSE (PT) - RESERVOIR TO PUMP (motor cooling #2) on the coolant pump #5'),
  J('motor-coolant-loop#valve3ToRad@start', 'motor-coolant-loop#valve3', 'HOSE (PT), 3WVLV TO RAD'),
  J('motor-coolant-loop#valve3ToRad@end', 'radiator', 'HOSE (PT), 3WVLV TO RAD'),
  J('motor-coolant-loop#valve3To4wv@start', 'motor-coolant-loop#valve3', 'HOSE (PT) - 3 WAY VLV TO 4 WAY VLV'),
  J('motor-coolant-loop#valve3To4wv@end', 'four-way-valve', 'HOSE (PT) - 3 WAY VLV TO 4 WAY VLV'),
  J('motor-coolant-loop#pumpToCharger@start', 'motor-coolant-loop#pump', 'HOSE (PT) - PUMP TO ROCKER'),
  J('motor-coolant-loop#pumpToCharger@end', 'charger-master', 'HOSE (PT) - ROCKER TO CHARGER'),
  J('motor-coolant-loop#chargerToDu@start', 'charger-master', 'HOSE (PT) - CHARGER TO MOTOR / RDU'),
  J('motor-coolant-loop#chargerToDu@end', 'rear-drive-unit-small', 'HOSE (PT) - CHARGER TO RDU'),
  J('motor-coolant-loop#chargerToDu@end', 'rear-drive-unit-large', 'HOSE (PT) - CHARGER TO MOTOR'),
  J('motor-coolant-loop#rockerR@start', 'rear-drive-unit-small', 'ASY - HOSE(PT) - INVERTER TO ROCKER (motor cooling #13)'),
  J('motor-coolant-loop#rockerR@start', 'rear-drive-unit-large', 'ASY - HOSE(PT) - INVERTER TO ROCKER (motor cooling #13)'),
  J('motor-coolant-loop#rockerR@end', 'radiator', 'HOSE (PT) ROCKER RIGHT SIDE (motor cooling #14) on the radiator inlet'),
  J('motor-coolant-loop#bypass@start', 'motor-coolant-loop#rockerR', 'ASY - HOSE (PT) - RKR TO BYPASS 3 WAY VLV (motor cooling #20) teed off the RH rocker hose'),
  J('motor-coolant-loop#bypass@end', 'motor-coolant-loop#valve3', 'ASY - HOSE (PT) - RKR TO BYPASS 3 WAY VLV (motor cooling #20) on the 3-way valve'),
  J('hvac-drain-hose#hose@start', 'hvac-unit', 'HVAC DRAIN HOSE on the HVAC case'),
  J('hvac-drain-hose#grommet', 'sound-insulation#dash', 'GROMMET, HVAC DRAIN TUBE (heater assembly #6) in the dash insulator'),
  J('ptc-heater', 'hvac-unit#case', 'CORE COMPLETE ASSY - PTC AIR HEATER (heater core #1) in the heater core slot of the HVAC UNIT - NO PTC HEATER (heater assembly #1)', { inset: 'the heater core slides into its slot in the HVAC case' }),
  J('hvac-blower#outlet', 'hvac-unit#case', 'blower scroll outlet bolted to the RH side of the HVAC case'),

  // --- refrigerant
  J('ac-lines#discharge@start', 'ac-compressor', 'discharge line from the compressor'),
  J('ac-lines#discharge@end', 'ac-condenser', 'discharge line into the condenser'),
  J('ac-lines#liquid@start', 'ac-condenser', 'liquid line from the condenser'),
  J('ac-lines#liquid@end', 'ac-lines#txv', 'ASY AC LINE SUCTION LIQUID WITH TXV (#1): liquid line into the TXV'),
  J('ac-lines#suction@start', 'ac-lines#txv', 'ASY AC LINE SUCTION LIQUID WITH TXV (#1): suction line out of the TXV'),
  J('ac-lines#txv', 'hvac-unit#evapPipes', 'VALVE ASY - TXV - EVAPORATOR (#11) bolted to the evaporator pipes (BLT M6x60 #12)'),
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
  J('hv-cable-front-du#cable@end', 'front-drive-unit#inverter', 'ASY, HV HARN, FR SDU, FUSED (#11) at the front drive inverter connector'),
  J('front-junction-box', 'front-drive-unit', 'front junction box on the front drive unit'),
  J('dcdc-12v-cable#cable@start', 'dc-dc-converter', '12 V cable from the DC-DC converter'),
  J('dcdc-12v-cable#cable@end', '12v-battery', '12 V cable to the 12 V battery'),
  J('dc-dc-converter#case', 'front-inner-R#rail', 'DC-DC converter bracket on the RH rail (BRKT DC-DC)'),
  ...['rear-hvjb', 'charger-master', 'charger-slave'].map((id) => J(id, 'hv-battery', 'mounted on the pack hump under the rear seat')),
  J('four-way-valve#bracket', 'frunk', 'BRKT - 4 WAY VALVE (battery cooling #13 = motor cooling #24) bolted under the frunk tub (BLT M6x20 #14)'),
  J('four-way-valve#valve', 'four-way-valve#bracket', 'VALVE 4-WAY (battery cooling #12 = motor cooling #23) on its bracket'),
  J('ambient-temp-sensor', 'cooling-duct', 'SENSOR ASSEMBLY AMBIENT AIR TEMPERATURE (ducting #11 = radiator #2) clipped under the front ducting'),
  ...each((s) => [J(`active-louvre-${s}#tabs`, 'front-fascia', s === 'L'
    ? 'ASY - ACTIVE LOUVRE #2 bolted to the fascia (U NUT M6 LH LOUVER TO FASCIA)'
    : 'ASY - ACTIVE LOUVRE #3 bolted to the fascia (U-nut: LH part number listed, RH not separately listed)')]),
  J('hvac-filter', 'hvac-blower', 'HVAC FILTER HOUSING #2 (BLT HF M6x18 #4) on the blower inlet of the HVAC unit'),
  J('ac-compressor#bracket', 'front-subframe#frontCross', 'BRKT - AC BRKT-TO-CHASSIS SUPPORT (compressor #3) bolted to the front subframe (NUT M8 #4A/#4B)'),
  J('ac-compressor#bracket', 'ac-compressor#body', 'BRKT AC COMP TO AC BRKT (compressor #2) with the diagonal isolators #5/#7 (BLT M8x100 #6)'),

  // --- electrical: harness network (where harnesses plug into each other and into modules)
  J('lower-dash-harness#trunk@start', 'body-controller#controller', 'LOWER DASH harness (#1A) connectors at the body controller'),
  J('lower-dash-harness#trunk@end', 'fusebox-cabin', 'LOWER DASH harness (#1A) to the cabin fuse box'),
  ...each((s) => [
    J(`cabin-harness-${s}#lead@start`, 'lower-dash-harness#trunk', 'LEFT/RIGHT BODY HARNESS (cabin #1/#2A) plugs into the lower dash harness'),
    J(`motor-bay-harness-${s}#dashLead@start`, 'lower-dash-harness#trunk', 'FRONT LEFT/RIGHT BODY HARNESS (#2/#3) through the bulkhead grommet to the lower dash harness'),
    J(`motor-bay-harness-${s}#${s === 'R' ? 'frontLead' : 'lead'}@end`, 'front-end-harness#module', 'front body harness to the FRONT END MODULE HARNESS (#2)'),
    J(`front-end-harness#module@${s === 'L' ? 'start' : 'end'}`, `headlamp-${s}`, 'FRONT END MODULE HARNESS (#2) at the headlamp connector'),
    J(`horn-${s}#horn`, 'front-end-harness#bumper', 'FRONT BUMPER HARNESS (#1) at the horn connector'),
    J(`door-harness-${s}F#lead@start`, 'dash-harness#ip', 'front door harness with grommet (#1/#3) to the IP harness at the A-pillar'),
    J(`door-harness-${s}F#lead@end`, `door-controller-${s}`, 'front door harness at the DOOR CONTROLLER'),
    J(`door-harness-${s}B#lead@start`, `cabin-harness-${s}#lead@end`, 'rear door harness with grommet (#2/#4) to the body harness at the B-pillar foot'),
    J(`door-harness-${s}B#lead@end`, `door-latch-${s}B`, 'rear door harness at the rear door latch'),
    J(`liftgate-harness-${s}#lead@start`, 'roof-harness#rearT', 'liftgate harness to the headliner harness at the rear header'),
  ]),
  ...[1, 2, 3, 4, 5, 6].map((i) => J(`park-sensors-front#S${i}`, 'front-end-harness#bumper', 'FRONT BUMPER HARNESS (#1) at the park assist sensor (#3)')),
  ...[7, 8, 9, 10, 11, 12].map((i) => J(`park-sensors-rear#S${i}`, 'rear-bumper-harness#lead', 'REAR BUMPER HARNESS - PARK ASSIST (#1) at the sensor (#3)')),
  J('cabin-harness-L#rearLead@end', 'air-suspension-ecu', 'LH body harness at the air suspension ECU behind the LH trunk side trim'),
  J('cabin-harness-R#trunkLead@end', 'park-assist-ecu#ecu', 'RH body harness at the park assist ECU'),
  J('cabin-harness-R#ecuLead@end', 'liftgate-ecu#ecu', 'RH body harness branch into its connector on the power liftgate / park brake ECU'),
  J('rear-bumper-harness#lead@start', 'cabin-harness-L#rearLead@end', 'rear bumper harness (#1) plugs into the LH body harness at the trunk side'),
  J('rear-subframe-harness#lead@start', 'cabin-harness-R#rearLead@end', 'REAR SUBFRAME HARNESS (#2) plugs into the RH body harness above the wheelhouse'),
  J('rear-subframe-harness#grommet', 'trunk-floor-ext-R#shelf', 'rear subframe harness grommet in the outboard flange of the trunk floor extension shelf, under the trunk side finisher (grommet not listed in the catalog)'),
  J('rear-subframe-harness#lead@end', 'rear-subframe#sideL', 'rear subframe harness clipped to the LH subframe side member'),
  J('dcdc-pigtail#lead@start', 'dc-dc-converter#case', 'ASY,HRN,PGTL (DC-DC group *) at the converter signal connector'),
  J('dcdc-pigtail#lead@end', 'motor-bay-harness-R#frontLead', 'ASY,HRN,PGTL (harness group *) into the RH front body harness'),
  J('dash-harness#console', 'lower-dash-harness#trunk', 'dash and console harness to the main harness behind the HVAC case'),
  J('dash-harness#console@end', 'usb-hub', 'console harness at the USB media hub'),
  J('roof-harness#header@start', 'dash-harness#ip', 'headliner harness down the LH A-pillar to the IP harness'),
  J('roof-harness#header@end', 'dome-light-rear', 'headliner harness at the rear dome light'),
  J('roof-harness#consoleLead@end', 'overhead-console', 'headliner harness lead to the overhead console'),
  J('liftgate-harness-L#lead@end', 'rear-camera', 'LH liftgate harness at the rear camera'),
  J('liftgate-harness-R#lead@end', 'liftgate-latch', 'RH liftgate harness at the liftgate latch'),

  // --- electrical: modules on their mounts
  J('body-controller#mount', 'dash-support-frame#beam', 'MOUNT - ELECTRONICS - FOOTWELL (#6) under the cross-car beam'),
  ...each((s) => [J(`passive-entry#ipAntenna${s}`, `dash-panel#end${s}`, 'ANTENNA PASSIVE ENTRY (#4, rectangular) screwed (SCR M4 #9, 2 per antenna) inside the IP end cap')]),
  J('body-controller#mount', 'body-controller#controller', 'body controller (#3) on the footwell electronics mount'),
  J('liftgate-ecu#bracket', 'rear-quarter-inner-R#quarterInner', 'BRACKET - ECU - PARK BRAKE AND PWR LIFTGATE (#4) bolted to the RH rear quarter inner panel'),
  J('liftgate-ecu#bracket', 'liftgate-ecu#ecu', 'power liftgate control module (#3) on its bracket'),
  J('park-assist-ecu#bracket', 'rear-quarter-inner-R#quarterInner', 'BRACKET, PARK ASSIST/BLINDSPOT ECU (#3) bolted to the RH rear quarter inner panel'),
  J('park-assist-ecu#bracket', 'park-assist-ecu#ecu', 'park assist ECU (#1) on its bracket'),
  ...each((s) => [
    J(`horn-${s}#bracket`, 'front-bumper-carrier', 'RC horn (#1/#2, the version located on the front end module): integral bracket bolted to the fascia carrier (FEM) side post'),
    J(`horn-${s}#bracket`, `horn-${s}#horn`, 'horn on its integral bracket'),
  ]),
  J('radar#bracket', 'radar#sensor', 'Sub-Asm of Forward Radar Brackets (#2) on the radar'),
  J('radar#bracket', 'cooling-duct', 'BRKT, RADAR STRUCTURE (radar #3 = ducting #1) on the front ducting'),
  J('switches#scrollL', 'steering-wheel#wheel', 'steering control switch (#1) clipped into the LH spoke'),
  J('switches#scrollR', 'steering-wheel#wheel', 'steering control switch (#1) clipped into the RH spoke'),
  J('switches#steeringHarness@end', 'driver-airbag', 'STEERING CONTROL SWITCH HARNESS (#1/#2) at the hub behind the driver airbag'),
  J('washer-bottle#bottle', 'front-inner-R#rail', 'WASHER BOTTLE ASY (#1) bolted to the RH front rail (M6 nut washers #9)'),
  J('washer-bottle#pump', 'washer-bottle#bottle', 'WASHER PUMP (#2) in its grommet (#3) on the bottle'),
  J('washer-nozzles#hose@start', 'washer-bottle#pump', 'washer hose on the pump outlet'),
  ...each((s) => [
    J(`amfm-amp-${s}`, 'backlite', 'ANTENNA AMPLIFIER AM/FM1 / FM2 (#1/#2) at the antenna grid in the backlite'),
    J(`liftgate-harness-${s}#ampLead@end`, `amfm-amp-${s}`, 'liftgate harness lead at the AM/FM antenna amplifier'),
  ]),
  J('forward-camera', 'windshield', 'forward camera on its windshield bracket'),
  J('rear-camera', 'liftgate-applique', 'ASSY - CAMERA - REAR VIEW (#1) set in the centre of the liftgate applique, bolted (TORX M5 *)'),
  J('subwoofer#mount', 'trunk-floor#floor', 'subwoofer enclosure bolted (BLT HEX M6x25 #10) to the trunk floor'),
  J('subwoofer#mount', 'subwoofer#enclosure', 'subwoofer enclosure on its mount'),
  ...each((s) => ['F', 'B'].map((fr) => J(`speaker-door-${s}${fr}#basket`, `door-${s}${fr}#inner`, 'MID WOOFER (base #1 / premium #1-#4) screwed (SCR M5x16 into GROM) to the door inner panel, behind the trim pad grille'))),
  ...each((s) => [J(`tweeter-${s}`, `pillar-trim-${s}#aPillar`, 'AUDIO, SPEAKER, TWEETER, 30MM (premium #6, use on A-Pillar) in a pocket in the A-pillar trim')]),
  ...each((s) => [J(`door-controller-${s}`, `door-${s}F#inner`, 'DOOR CONTROLLER (#1) screwed (BOLT TPG TORXPLUS #2) to the front door inner panel, behind the trim pad')]),
  J('wipers#footL', 'floor-pan#plenum', 'WIPER MODULE (#1) bolted (BOLT M6x25 #2) to the cowl plenum at the LH pivot end'),
  J('wipers#motor', 'floor-pan#plenum', 'WIPER MODULE (#1) bolted (BOLT M6x25 #2) to the cowl plenum under the motor crank housing'),
  J('wipers#bracket', 'floor-pan#plenum', 'WIPER MOTOR BRACKET (#3, WIPER MOUNTING BRACKET COWL PLENUM) bolted (BOLT M6x25 #2) to the cowl plenum'),
  J('wipers#bracket', 'wipers#motor', 'WIPER MOTOR BRACKET (#3) on the motor end of the module'),
  J('wipers#motor', 'wipers#frame', 'module frame tube into the motor crank housing (WIPER MODULE #1)'),
  J('wipers#footL', 'wipers#frame', 'LH mounting foot on the module frame (WIPER MODULE #1)'),
  ...each((s) => [
    J(`wipers#arm${s}`, `wipers#pivot${s}`, `ARM ASY - WIPER ${s}H (#${s === 'L' ? 6 : 7}) on its pivot spindle, HEX NUT - WIPER ARM (#8)`),
    J(`wipers#arm${s}`, `wipers#blade${s}`, `BLADE ASY-WIPER (#${s === 'L' ? 4 : 5}) clipped to the arm (#${s === 'L' ? 6 : 7})`),
  ]),
  ...each((s) => [J(`washer-nozzles#nozzle${s}`, 'hood', 'WASHER NOZZLE (#1) clipped into the hood from below')]),
  J('radio-tuner', 'dash-support-frame#ampTunerBracket', 'RADIO (#1, TORX M5 #2) screwed into the AMP AND TUNER bracket (dash support frame #5) hung from the cross-car beam'),
  J('audio-amplifier', 'dash-support-frame#ampTunerBracket', 'AUDIO, AMPLIFIER, EXTERNAL, PREMIUM screwed into the floor of the AMP AND TUNER bracket (dash support frame #5), below the radio'),

  // --- interior ducts: HVAC case outlets to the vents
  ...['faceL', 'faceR', 'centreL', 'centreR', 'floorL', 'floorR', 'console'].map((d) => J(`interior-ducts#${d}@start`, 'hvac-unit', 'duct on the HVAC case outlet')),
  J('interior-ducts#faceL@end', 'interior-ducts#ventL', 'LH face duct to the AIR OUTLET LH'),
  J('interior-ducts#faceR@end', 'interior-ducts#ventR', 'RH face duct to the AIR OUTLET RH'),
  J('interior-ducts#centreL@end', 'interior-ducts#ventCL', 'centre duct to the AIR OUTLET CENTER L (#5)'),
  J('interior-ducts#centreR@end', 'interior-ducts#ventCR', 'centre duct to the AIR OUTLET CENTER R (#7)'),
  J('interior-ducts#console@end', 'center-console', 'CENTER CONSOLE AIR DUCT (#13-#15) to the rear console outlet'),
  ...['ventL', 'ventCL', 'ventCR', 'ventR'].map((v) => J(`interior-ducts#${v}`, 'dash-panel', 'air outlet clipped into the instrument panel')),
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
  J('hood-latch#grommet', 'floor-pan#dashCorners', 'release cable #2 through the bulkhead in its grommet, seated in the LH dash panel corner'),
  J('hood-latch#handle', 'dash-panel', 'release handle #1 on the LH lower instrument panel'),
  J('hood-seal', 'frunk', 'SEAL - HOOD on the frunk tub rim (frunk #19 = hood seals #1)'),
  J('hood-cowl-seal', 'underhood-apron-rear', 'SEAL - HOOD TO COWL #2 on the rear underhood apron'),
  ...each((s) => [
    J(`hood-hinge-${s}#strutBracket`, `hood-hinge-${s}#strut@end`, 'GAS STRUT - HOOD (#1) end fitting on the ball stud of its body bracket BRKT-GAS PROP BODY (#2)'),
    J(`hood-hinge-${s}#strutBracket`, `front-inner-${s}#tower`, 'BRKT-GAS PROP LH/RH BODY (hood hinges #2) bolted (BLT HF M6x15 #3) to the rear face of the shock tower'),
    J(`hood-hinge-${s}#base`, 'floor-pan#cowlFront', 'HOOD HINGE (#6) body leaf bolted (BLT HEX FLG M8x20 #7, NUT M8 #5) to the cowl front wall of the body'),
  ]),
  // rear structure and bumper
  ...each((s) => [
    J(`trunk-floor-ext-${s}`, 'trunk-floor#floor', 'trunk floor extension #2/#3 joined to the trunk floor #1'),
    J(`trunk-floor-ext-${s}`, `rear-quarter-inner-${s}#tower`, 'trunk floor extension (quarter inner #5/#6) joined to the shock tower'),
    J(`trunk-floor-ext-${s}`, `rear-quarter-inner-${s}#innerWall`, 'trunk floor extension (quarter inner #5/#6) outboard flange joined to the wheelhouse inner wall'),
    J('trunk-floor#frontFloor', `rear-quarter-inner-${s}#innerWall`, 'ASY - RR TRUNK FLOOR (#1) front section: its flange beside the 2nd-row seat back joined to the wheelhouse inner wall (rear wheelhouse assy #20/#21)'),
    J('rear-bumper-beam#beam', `rear-rail-${s}#rail`, 'rear bumper beam #1 bolted to the rail ends (NUT M10 #2)'),
    J('rear-bumper-beam#crossmember', `rear-rail-${s}#rail`, 'rear crossmember #3 bolted under the rail ends'),
  ]),
  ...each((s) => [
    J(`rear-quarter-inner-${s}#cPillar`, `body-side-${s}`, 'ASY REINF C-PILLAR (quarter inner #23/#24, 1014652/1014648) bonded to the body side outer C-pillar (#9)'),
    J(`rear-quarter-inner-${s}#lampHousing`, `body-side-${s}`, 'REINF - RR LAMP HOUSING (quarter inner #15/#16 = body side #4, 1003096/1003097) bonded behind the body side outer at the tail lamp pocket'),
    J(`rear-quarter-inner-${s}#quarterInner`, `body-side-${s}`, 'ASSY - RR QTR INR (#13/#14) joined (riveted and bonded) to the body side outer by its upper and rear flanges'),
  ]),
  // pillars and floor
  ...each((s) => [
    J(`hinge-pillar-${s}`, `sill-${s}`, 'hinge pillar #5 joined to the front of the side sill', { inset: 'the hinge pillar foot is welded into the front of the sill section' }),
    J(`hinge-pillar-${s}`, `front-inner-${s}`, 'cowl side #6 joined to the upper (shotgun) rail'),
    J(`hinge-pillar-${s}`, `body-side-${s}`, 'body side outer A-pillar #7 bonded over the hinge pillar'),
    J(`b-pillar-${s}#lower`, `sill-${s}`, 'A / B pillar comp #13 joined to the side sill'),
    J('floor-pan', `sill-${s}`, 'floor pan joined between the side sills (ECOAT BODY IN WHITE): its flanges welded to the sill inner walls'),
  ]),
  J('nvh-plugs', 'floor-pan', 'body plugs in the floor pan openings'),
  ...corners((k) => [J(`door-tape-${k}`, `door-${k}#inner`, 'TAPE, DOOR, D44 (NVH damping #9) over an access hole in the door inner panel, behind the trim pad')]),
  ...each((s) => [
    J(`rocker-${s}#brackets`, `sill-${s}`, 'rocker moulding brackets #7/#8 bolted to the sill (BLT HF M8x20 #11)'),
    J(`rocker-${s}#scuff`, `sill-${s}`, 'SCUFF PLATE, PLASTIC (rocker panel trim #6) taped (TAPE, DBL SIDED ADHESIVE, SCUFF PLATE #16) on the sill inner top edge'),
    J(`b-pillar-applique-${s}`, `b-pillar-${s}#carriers`, 'B-pillar applique clipped on the body side carriers #10/#11'),
  ]),
  J('frunk-carpet', 'frunk', 'carpet lining laid in the frunk tub'),
  ...each((s) => [J(`rear-undertray#mount${s}`, `rear-subframe#side${s}`, 'mid aero shield #1 bolted to the rear subframe (BLT HF M6x18 #8)')]),
  J('rear-diffuser', 'rear-undertray', 'diffuser front edge screwed over the mid aero shield (SCR HEX HEAD M6x20 #7)'),
  J('trunk-floor#rearPanel', 'trunk-floor#floor', 'rear body panel #4 joined to the trunk floor #1'),
  J('trunk-floor#rearPanel', 'rear-bumper-beam#beam', 'rear body panel #4 lower edge on the bumper beam'),
  // cabin
  J('windshield-edge-seal', 'windshield', 'SEAL, WINDSHIELD EDGE (glass #2) along the windshield base'),
  J('windshield-edge-seal', 'dash-panel#topPad', 'SEAL, WINDSHIELD EDGE (dash panel #1) on the IP top pad'),
  J('dash-support-frame#beam', 'hvac-unit', 'HVAC case bolted to the cross-car beam (dash support frame #7 BLT M8x25)'),
  J('driver-airbag', 'steering-wheel#wheel', 'driver airbag module clipped into the steering wheel hub', { inset: 'the airbag module sits in the hub cavity of the wheel' }),
  ...each((s) => [J(`sun-visor-${s}`, 'headliner', 'sun visor pivot clipped through the headliner to the roof header')]),
  // closures
  ...each((s) => [J(`liftgate-drain-${s}@start`, 'liftgate-seal', 'drain tube funnel #1 in the lamp housing gutter under the liftgate seal flange')]),
  J('liftgate-drain-L', 'charge-port-inlet', 'drain tube #1 (charge port group #*) clipped behind the charge port inlet'),
  // side doors: hinges, latches, glass regulators
  ...front((k, s) => [
    J(`front-door-hinges-${s}`, `hinge-pillar-${s}`, 'upper #4 / lower #9 hinge bolted to the hinge pillar (BLT M8x21 #6)'),
    J(`front-door-hinges-${s}`, `door-${k}#inner`, 'hinges bolted to the door inner panel (BLT M8x26 #7)'),
    J(`door-latch-${k}#striker`, `b-pillar-${s}#lower`, 'front door striker on the B-pillar (striker tapping plate)'),
    J(`door-pressure-sensor-${s}`, `door-${k}#inner`, 'door pressure sensor on the door inner panel (PRESSURE SENSOR FASTENER)'),
  ]),
  ...rear((k, s) => [
    J(`rear-door-hinges-${s}`, `b-pillar-${s}#lower`, 'upper #2 / lower #4 hinge bolted to the B-pillar (BLT M8x21 #7)'),
    J(`rear-door-hinges-${s}`, `door-${k}#inner`, 'hinges bolted to the door inner panel (BLT M8x26 #5)'),
    J(`door-latch-${k}#striker`, `rear-quarter-inner-${s}#lockPillar`, 'rear door striker on the lock pillar'),
  ]),
  ...corners((k) => [
    J(`door-latch-${k}#latch`, `door-${k}#inner`, 'door latch screwed to the door inner panel'),
    ...['railF', 'railR', 'motor'].map((n) => J(`regulator-${k}#${n}`, `door-${k}#inner`, 'glass regulator bolted to the door inner panel')),
    ...['railF', 'railR'].map((n) => J(`regulator-${k}#${n}`, `door-glass-${k}`, 'regulator carrier clamped on the lower edge of the door glass')),
  ]),
  // lamps, plates and other fittings
  ...each((s) => [
    J(`headlamp-${s}#housing`, 'front-bumper-carrier', 'headlamp housing bolted to the fascia carrier (BLT HEX WSHR M6x25 #3)'),
    J(`side-repeater-${s}#housing`, `fender-${s}`, 'side repeater #6/#7 clipped into the fender opening'),
    J(`wind-deflector#arm${s}`, 'pano-cassette', 'wind deflector arm pivot on the roof cassette frame'),
  ]),
  J('chmsl', 'liftgate', 'CHMSL #8 on the liftgate top edge, under the glass'),
  ...each((s) => [J(`liftgate-hinge-${s}`, 'roof-panel', 'liftgate hinge bolted to the roof rear header')]),
  J('roof-seals', 'roof-panel', 'SEAL-MAIN #10 and outer trim seals #2-#5 on the pano roof opening flange'),
  ...each((s) => [
    J(`trunk-side-trim-${s}#bracket`, `rear-quarter-inner-${s}`, 'trunk bracket #6 LH / #7 RH screwed to the wheelhouse'),
    J(`trunk-side-trim-${s}#bracket`, `trunk-side-trim-${s}#panel`, 'finisher lower edge clipped on the trunk bracket'),
    J(`trunk-side-trim-${s}#strutCover`, `rear-quarter-inner-${s}#tower`, 'COVER,STRUT, TRUNK TRIM LH #8 / RH #9 (1012354 / 1012353) clipped over the shock tower top'),
  ]),
  J('liftgate-spoiler', 'liftgate', 'spoiler bonded to the liftgate (ADHESIVE TAPE, PRIMER)'),
  J('license-plate-front', 'front-fascia', 'front plate bracket screwed to the fascia (SCR, RVT)'),
  J('labels-underhood', 'hood', 'emission / refrigerant / first responder labels on the hood underside'),
  // seats, restraints, instrument panel
  ...each((s) => [
    J(`front-seat-track-${s}#feet`, 'floor-pan', 'seat tracks bolted to the floor (BLT M10x28.4 / M8x27)'),
    J(`front-belt-${s}#buckle`, `front-seat-${s}`, 'BUCKLE SWITCH ASY, 1ST ROW (front seat belts #3 LH / #4 RH) on its stalk bolted to the inboard side of the seat cushion frame'),
    J(`pretensioner-${s}#anchor`, `sill-${s}`, 'outboard lap pretensioner anchor bolted to the sill'),
    J(`front-seat-switch-${s}`, `front-seat-${s}`, 'seat switch bezel on the cushion side shield'),
    J(`curtain-airbag-${s}#bag`, `body-side-${s}`, 'CURTAIN AIRBAG ASSY (side air bags #1 LH / #2 RH) clipped (CLIP M6 BUR100015) to the roof rail of the body side'),
    J(`side-airbag-${s}`, `front-seat-${s}#back`, 'SIDE AIRBAG ASSY (side air bags #3/#4) bolted to the seat back frame in the outboard bolster', { inset: 'the airbag module is inside the seat back bolster' }),
  ]),
  J('rear-belts#centreRetractor', 'rear-seat-back-60', '2nd row centre seatbelt retractor (#3) bolted in the 60% seat back frame (#9 BOLT, 2ND ROW CENTER RETRACTOR)', { inset: 'the retractor is inside the seat back' }),
  J('third-row-belts', 'third-row-seats', '3rd row seatbelt assembly (#1) anchored on the seat back frame (ASY - THIRD ROW SEAT #8)'),
  J('third-row-seats#seat', 'trunk-floor#floor', 'ASY - THIRD ROW SEAT (#8) bolted to the trunk floor by its pivot brackets under the folded seat (BLT M10x28.4 #6, BARREL NUT M10 #5)'),
  ...each((s) => [
    J(`pillar-trim-${s}#kickPanel`, `hinge-pillar-${s}`, 'ASY, A PILLAR TRIM LOWER (A/B/C post trim #8) clipped (TRIM CLIP #11) to the hinge pillar'),
    J(`pillar-trim-${s}#cPillarLower`, `rear-quarter-inner-${s}#innerWall`, 'ASY C-PILLAR TRIM LWR (A/B/C post trim #19) clipped to the wheelhouse inner wall'),
    J(`pillar-trim-${s}#cPillarClips`, `rear-quarter-inner-${s}#cPillar`, 'C-pillar upper trim and ASY C-PILLAR TRIM MID (A/B/C post trim #22) clipped (TRIM CLIP #11) to the C-pillar reinforcement'),
    J(`pillar-trim-${s}#cPillarClips`, `pillar-trim-${s}#cPillarMid`, 'trim clips in the back of the C-pillar trims'),
    J(`trunk-c-pillar-trim-${s}#clip`, `rear-quarter-inner-${s}#cPillar`, 'ASY C-PILLAR REAR (interior trunk trim #11/#13) on its BRKT C-PILLAR (#9/#10), clipped (TRIM CLIP #16) to the C-pillar reinforcement'),
  ]),
  J('touchscreen', 'dash-panel', 'MCU in the CENTER SCREEN FRAME (touchscreen #2 = dash panel #35), BLT M5x25 (#3)'),
  J('instrument-cluster', 'dash-panel', 'cluster in the IP cluster frame and bezel (ASY FRAME INSTRUMENT CLUSTER / CLUSTER BEZEL, dash panel #28)'),
  J('glove-box', 'dash-panel', 'ASY GLOVE BOX COMP (dash panel #24) hinged in the lower right IP'),
  J('dash-panel', 'dash-support-frame#beam', 'IP carrier (#10) bolted to the cross-car beam (BLT HEX FL M8x25, dash panel #45 = dash support frame #7)'),
  J('rearview-mirror', 'windshield', 'mirror base on its button bonded to the windshield'),
  J('rear-seat-cushion#hooks', 'floor-pan#rearFloor', 'rear cushion frame wire hooks (cushion assy #4) clipped into the rear floor'),
  J('rear-seat-cushion#hooks', 'rear-seat-cushion#pan', 'hooks on the cushion frame pan'),
  ...[0, 1, 2, 3].map((i) => J(`rear-belts#buckle${i}`, 'floor-pan#seatCrossmember', 'BUCKLE ASY, 2ND ROW (2nd row seat belts #4) bolted (#5) to the rear seat crossmember')),
  ...each((s) => [J('floor-pan#seatCrossmember', `rear-rail-${s}#railFront`, 'rear seat crossmember of the body in white (ECOAT BODY IN WHITE) welded across the rear rail fronts (rear end panels #5/#6)')]),
  ...each((s) => [
    J(`pedestrian-protection#actuator${s}`, `front-inner-${s}`, 'PEDESTRIAN PROTECTION ACTUATOR #7 bracket bolted (BLT HF M6x20 #8) to the shotgun rail beside the hood hinge'),
  ]),
  J('pedestrian-protection#sensor', 'front-bumper-beam#beam', 'PEDESTRIAN PROTECTION SENSING SYSTEM (#9) clipped along the front face of the bumper beam'),
  ...['bracket0', 'bracket1'].map((n) => J(`instrument-cluster#${n}`, 'dash-support-frame#beam', 'cluster bracket bolted to the cross-car beam')),
  ...['bracket0', 'bracket1'].map((n) => J(`passenger-airbag#${n}`, 'dash-support-frame#beam', 'passenger airbag module bracket bolted to the cross-car beam (BOLT HF)')),
  ...each((s) => [J(`knee-airbag-${s}#bracket`, 'dash-support-frame#beam', 'knee airbag bracket bolted to the cross-car beam')]),
  J('restraint-controller#feet', 'floor-pan', 'PSRCM bolted through the carpet to the floor tunnel under the console'),
  ...each((s) => [
    J(`dash-support-frame#end${s}`, `hinge-pillar-${s}`, 'cross-car beam end bracket bolted to the hinge pillar'),
  ]),
  J('dash-support-frame#downChannel', 'floor-pan#toeBoard', 'ASY - BRKT - DOWN CHANNEL BOTTOM (dash support frame #6) bolted to the toe board (BLT HEX FL M8x25 #7)'),
  // panoramic roof
  ...each((s) => [
    J(`pano-frame#drainF${s}@start`, 'pano-cassette', 'front drain tube on the cassette drain spout'),
    J(`pano-frame#drainR${s}@start`, 'pano-cassette', 'rear drain tube on the cassette drain spout'),
  ]),
];

export const PASS_OK = [
  { a: 'brake-rotor-*#disc', b: 'brake-caliper-*', reason: 'the caliper is drawn as a solid block: the disc runs in the slot between its pads' },
  { a: 'brake-rotor-*#disc', b: 'park-brake-*', reason: 'the parking brake caliper is drawn as a solid block: the disc runs in the slot between its pads' },
  { a: 'steering-ishaft#lowerLink', b: 'sound-insulation', reason: 'the dash insulation is drawn without its I-shaft opening; the lower link passes through the dash seal (#8) there' },
  { a: 'brake-pedal#pushrod', b: 'sound-insulation', reason: 'the dash insulation is drawn without the booster opening; the pushrod passes through it to the booster' },
  { a: 'switches#steeringHarness', b: 'steering-wheel', reason: 'the steering wheel is drawn as solid spokes and hub; the switch harness (#1) runs inside the LH spoke trim to the hub cavity behind the driver airbag' },
  { a: 'switches#steeringHarnessR', b: 'steering-wheel', reason: 'the steering wheel is drawn as solid spokes and hub; the switch harness (#1) runs inside the RH spoke trim to the hub cavity behind the driver airbag' },
  { a: 'interior-ducts#console', b: 'center-console', reason: 'CENTER CONSOLE AIR DUCT (#13-#15) enters the console carrier (center tunnel trim #1) through the opening in its front face, below the front closeout panel (#14), runs inside it and rises out of its top at the rear into the rear console outlet (#19); the carrier is drawn as a closed shell' },
  { a: 'brake-pedal#arm', b: 'dash-panel', reason: 'the pedal arm passes the cut-out in the LH footwell cover of the instrument panel' },
  { a: 'dash-harness#ip', b: 'dash-panel', reason: 'the IP harness leaves the instrument panel through the side cover openings at the A-pillars' },
  ...['L', 'R'].map((s) => ({ a: `door-harness-${s}B#lead`, b: `b-pillar-${s}`, reason: 'the lower B-pillar is a closed section drawn as a solid block: the rear door harness enters it through a grommeted hole in its inboard wall and leaves through the rear door harness grommet (#2/#4) in its rear face below the lower hinge' })),
  { a: 'hvac-drain-hose#hose', b: 'sound-insulation', reason: 'the dash insulator is drawn without the hole for the drain tube grommet (heater assembly #6); the drain tube passes through the grommet there' },
  { a: 'hvac-unit#evapPipes', b: 'sound-insulation', reason: 'the dash insulator is drawn without its opening for the evaporator pipes, which pass through the bulkhead to the TXV (A/C pipes #11) on the motor-bay side' },
  ...[['floorL', 'LH (#17)'], ['floorR', 'RH (#18)']].map(([d, n]) => ({ a: `interior-ducts#${d}`, b: 'center-console', reason: `FLOOR AIR DUCT ${n} enters the console carrier (center tunnel trim #1) through the opening in its front face, below the front closeout panel (#14), and runs inside it to its outlet in the carrier's side wall; the carrier is drawn as a closed shell` })),
  { a: 'rear-subframe-harness#lead', b: 'trunk-floor-ext-R', reason: 'the outboard flange of the trunk floor extension shelf is drawn without its harness hole: the rear subframe harness passes down through it in its grommet (rear-subframe-harness#grommet), under the trunk side finisher' },
  { a: 'hood-latch#cable', b: 'dash-panel', reason: 'the lower instrument panel is drawn without the opening for the hood release handle (#1) in its LH lower edge: the release cable (#2) runs inside the panel along its LH end cover and reaches the handle through that opening' },
  ...[0, 1, 2, 3].map((i) => ({ a: `rear-belts#buckle${i}`, b: 'rear-seat-cushion', reason: 'the 2nd-row cushion and its frame pan are drawn solid, without the slots the buckle stalks (2nd row seat belts #4) pass down through to their anchor bolts (#5) on the rear seat crossmember' })),
];

// FLOAT_OK: components allowed to touch nothing (drawn off the vehicle).
export const FLOAT_OK = [
  { id: 'repair-consumables', why: 'structural repair consumables (rivets, adhesive, weld wire) are not fitted to the car; drawn beside it' },
  { id: 'wall-connector', why: 'charging equipment is not fitted to the car: the wall connector stands beside it with the connector handle hung in its holster (the charge port door is drawn closed)' },
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
