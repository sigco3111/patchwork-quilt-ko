// The lie of the country: one big quilt thrown over heaps of stuffing so that it makes a hill to stand on, a wide
// valley with a river through it, a rise for the village, a knoll for the windmill and high ground all round. This
// file is only its shape and where things are; fields.js sews it and the others stand things on it.
import * as THREE from 'three';
import { noise } from '../noise.js';

/** The quilt: 31 by 35 blocks of 5.2. */
export const Q = { x0: -80.6, x1: 80.6, z0: -101.4, z1: 80.6, block: 5.2, nx: 31, nz: 35 };
export const START = { x: 0.5, z: 60 };
export const VILLAGE = { x: 9, z: -26 };
export const FARM = { x: -17, z: 19 };
export const MILL = { x: -30, z: -6 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const curve = (pts, n) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(n).map((p) => [p.x, p.z]);
/** The road: a tape measure run out from the hilltop down across the valley to the village green. */
export const ROAD = curve([[0.5, 63], [2.2, 55], [5.5, 47], [1.5, 39], [-5.5, 31.5], [-8.5, 22], [-5, 13.5], [-1.5, 6.5], [3, -1], [6.5, -8], [4.5, -15], [7, -21], [9, -24.5]], 260);
/** The river: a ribbon laid along the bottom of the valley, from one side of the quilt to the other. */
export const RIVER = curve([[-92, -22], [-72, -11], [-54, 1], [-37, 8], [-21, 3], [-6, 7.5], [10, 4], [26, 9], [42, 3.5], [58, 9], [74, 16], [94, 12]], 420);

const thin = (line, every) => line.filter((_, i) => i % every === 0 || i === line.length - 1);
const ROAD_C = thin(ROAD, 5), RIVER_C = thin(RIVER, 8);
function toLine(line, x, z) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i][0], az = line[i][1], dx = line[i + 1][0] - ax, dz = line[i + 1][1] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
export const toRoad = (x, z) => toLine(ROAD_C, x, z);
export const toRiver = (x, z) => toLine(RIVER_C, x, z);

// heaps of stuffing: [x, z, height, how far it spreads in x, in z]
const HILLS = [
  [0, 63, 13, 28, 24], [-60, 12, 11, 22, 42], [MILL.x, MILL.z, 5.5, 10, 10], [62, 22, 9, 22, 36], [VILLAGE.x + 1, VILLAGE.z - 1, 3.2, 20, 13],
  [-28, -74, 12, 30, 17], [32, -82, 15, 34, 19], [72, -56, 10, 20, 24], [-72, -52, 9, 18, 22], [36, 52, 4.5, 16, 14], [-36, 58, 5.5, 17, 14],
];
function raw(x, z) {
  let h = 0;
  for (const [cx, cz, hh, rx, rz] of HILLS) h += hh * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  h += 0.8 * noise(x / 19 + 3, z / 19) + 0.3 * noise(x / 7, z / 7 + 9);
  // the river has worn its valley through whatever was in its way
  const r = toRiver(x, z);
  h *= 1 - 0.88 * Math.exp(-((r / 10) ** 2));
  return Math.max(0.25, 1.1 + h - 0.55 * Math.exp(-((r / 4) ** 2)));
}
/** Where something stands, the ground has been pressed level: [x, z, how far out]. */
export const SITES = [];
export function site(x, z, r) { SITES.push([x, z, r, raw(x, z)]); }

/** The height of the quilt at (x, z): the shape of the country, without the patches' own puff. */
export function mound(x, z) {
  let h = raw(x, z);
  for (const [sx, sz, r, level] of SITES) {
    const d = Math.hypot(x - sx, z - sz);
    if (d < r) h += (level - h) * (1 - sstep(r * 0.55, r, d));
  }
  const edge = Math.min(x - Q.x0, Q.x1 - x, z - Q.z0, Q.z1 - z);
  return 0.09 + Math.max(h * sstep(0, 8, edge), -0.02);
}
export const onQuilt = (x, z) => x > Q.x0 && x < Q.x1 && z > Q.z0 && z < Q.z1;
/** The top of whatever is underfoot: the quilt (the road lies a little proud of it) or the bare table. */
export function ground(x, z) {
  if (!onQuilt(x, z)) return 0;
  return mound(x, z) + 0.2 + 0.15 * (1 - sstep(0.4, 0.75, toRoad(x, z)));
}
/** How far (x, z) is from anywhere he is likely to walk: the road, the farm, the village. Decides how finely things are made. */
export const away = (x, z) => Math.min(toRoad(x, z), Math.hypot(x - FARM.x, z - FARM.z) - 6, Math.hypot(x - VILLAGE.x, z - VILLAGE.z) - 10);
