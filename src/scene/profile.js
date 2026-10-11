// Dimensions and profile curves of the procedural Model S (2012-2016) body.
//
// World axes: +x = forward, +y = up, +z = vehicle right (RH), -z = left (LH).
// Longitudinal profile functions use `s` = distance from the front tip in
// metres (0 … LENGTH); convert with xOf(s) / sOf(x).

export const LENGTH = 4.970;
export const WIDTH = 1.964;
export const HEIGHT = 1.445;
export const WHEELBASE = 2.960;
export const FRONT_OVERHANG = 0.950;

export const S_FRONT_AXLE = FRONT_OVERHANG;
export const S_REAR_AXLE = FRONT_OVERHANG + WHEELBASE;

export const xOf = (s) => LENGTH / 2 - s;
export const sOf = (x) => LENGTH / 2 - x;

export const X_FRONT_AXLE = xOf(S_FRONT_AXLE); //  1.535
export const X_REAR_AXLE = xOf(S_REAR_AXLE); // -1.425

export const TIRE_RADIUS = 0.352; // 245/45R19
export const TIRE_WIDTH = 0.245;
export const WHEEL_Y = TIRE_RADIUS;
export const TRACK_FRONT = 1.662;
export const TRACK_REAR = 1.700;
export const ARCH_RADIUS = 0.405;

// Monotone cubic (Fritsch–Carlson) interpolation through [s, value] pairs.
export function monotone(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    let hi = n - 1;
    while (hi - i > 1) {
      const mid = (i + hi) >> 1;
      if (xs[mid] > x) hi = mid; else i = mid;
    }
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Centerline top surface (hood, windshield, roof, backlite, liftgate).
export const topY = monotone([
  [0.000, 0.500], [0.030, 0.600], [0.100, 0.680], [0.220, 0.745], [0.320, 0.772],
  [0.600, 0.815], [0.950, 0.862], [1.300, 0.912], [1.520, 0.948], [1.600, 0.985],
  [1.800, 1.115], [2.050, 1.295], [2.300, 1.412], [2.550, 1.441], [2.800, 1.445],
  [3.050, 1.432], [3.250, 1.406], [3.600, 1.322], [4.000, 1.192], [4.350, 1.082],
  [4.550, 1.047], [4.660, 1.036], [4.740, 1.002], [4.840, 0.905], [4.920, 0.730],
  [4.970, 0.540],
]);

// Shoulder / beltline height.
export const beltY = monotone([
  [0.000, 0.500], [0.050, 0.585], [0.150, 0.662], [0.250, 0.716], [0.600, 0.786],
  [0.950, 0.842], [1.300, 0.893], [1.600, 0.927], [2.200, 0.962], [2.800, 0.984],
  [3.400, 0.998], [3.900, 1.008], [4.300, 1.004], [4.550, 0.986], [4.700, 0.957],
  [4.840, 0.865], [4.920, 0.700], [4.970, 0.540],
]);

// Lower edge of the side skin (before wheel-arch cut-outs).
export const bottomY = monotone([
  [0.000, 0.500], [0.030, 0.360], [0.080, 0.272], [0.180, 0.222], [0.500, 0.200],
  [1.200, 0.186], [1.500, 0.176], [3.500, 0.176], [3.800, 0.190], [4.400, 0.238],
  [4.650, 0.272], [4.850, 0.330], [4.930, 0.400], [4.970, 0.520],
]);

// Maximum body half width.
export const halfWidth = monotone([
  [0.000, 0.000], [0.004, 0.300], [0.020, 0.500], [0.060, 0.660], [0.150, 0.800],
  [0.300, 0.893], [0.550, 0.944], [0.950, 0.970], [1.400, 0.976], [2.000, 0.982],
  [3.600, 0.982], [3.950, 0.980], [4.300, 0.966], [4.550, 0.937], [4.720, 0.882],
  [4.850, 0.782], [4.930, 0.600], [4.962, 0.380], [4.970, 0.000],
]);

// Half width of the roof edge / hood crown control point (P4).
export const roofHalfWidth = monotone([
  [0.000, 0.000], [0.020, 0.250], [0.150, 0.420], [0.300, 0.490], [0.900, 0.520],
  [1.450, 0.560], [1.600, 0.700], [1.900, 0.665], [2.300, 0.612], [2.800, 0.600],
  [3.250, 0.602], [3.800, 0.622], [4.300, 0.660], [4.550, 0.662], [4.720, 0.622],
  [4.850, 0.560], [4.930, 0.430], [4.970, 0.000],
]);

// How far the roof edge (P4) sits below the centerline.
export const roofDrop = monotone([
  [0.000, 0.000], [0.300, 0.012], [1.450, 0.015], [1.650, 0.032], [2.300, 0.066],
  [3.250, 0.066], [4.300, 0.050], [4.600, 0.030], [4.970, 0.000],
]);

// Window-sill (P3) half width as a fraction of the body half width.
export const sillFraction = monotone([
  [0.000, 0.900], [1.450, 0.905], [1.700, 0.918], [3.600, 0.918], [4.300, 0.905], [4.970, 0.900],
]);

function archLift(s, center) {
  const d = s - center;
  if (Math.abs(d) >= ARCH_RADIUS) return 0;
  return WHEEL_Y + Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - d * d);
}

// Lower edge of the side skin including the wheel arches.
export function sideBottomY(s) {
  return Math.max(bottomY(s), archLift(s, S_FRONT_AXLE), archLift(s, S_REAR_AXLE));
}

export function isInArch(s) {
  return Math.abs(s - S_FRONT_AXLE) < ARCH_RADIUS || Math.abs(s - S_REAR_AXLE) < ARCH_RADIUS;
}
