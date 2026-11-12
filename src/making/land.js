// The lie of the country quilt: one quilt, the size a table takes, heaped into a small country: a hill with the
// village on it, a knoll for the windmill, a rise at the front to look out from, two more hills, and the dip the
// river runs down, off the front of the quilt and away across the table.
import * as THREE from 'three';
import { noise } from '../noise.js';

/** The quilt: 38 by 28 patches of 1.1, the same size of patch as the first small quilt. */
export const Q = { w: 41.8, d: 30.8, s: 1.1, nx: 38, nz: 28 };
export const TABLE = { hw: 66, hd: 50, mat: { x: 3, z: 2.5, hw: 31, hd: 23 } };
export const START = { x: 0.6, z: 12.7 };
export const VILLAGE = { x: -4, z: -5.5 };
export const MILL = { x: 12, z: -8 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const curve = (pts, n) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(n).map((p) => [p.x, p.z]);
/** The river: a narrow ribbon from the back of the quilt, between the two hills, off the front and over the table. */
export const RIVER = curve([[5.5, -18.5], [4.6, -14.5], [6, -11], [4.4, -7.5], [5.6, -4], [3.9, -0.5], [5.4, 3], [4.4, 6.5], [6.2, 10], [7.8, 13.5], [10.5, 17], [15, 20], [21, 21.5], [28, 21]], 240);
/** The way up: buttons for stepping stones, from where he starts to the lowest cottage's door. */
export const PATH = curve([[0.5, 11.5], [-0.7, 9.4], [-2.1, 7.3], [-2.7, 5.1], [-2.4, 2.9], [-3.3, 0.9], [-4.4, -0.4]], 60);

function toLine(line, x, z) {
  let best = Infinity;
  const step = line.length > 20 ? 2 : 1;
  for (let i = 0; i < line.length - 1; i += step) {
    const j = Math.min(i + step, line.length - 1), ax = line[i][0], az = line[i][1], dx = line[j][0] - ax, dz = line[j][1] - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
/** The tape measure: across the table and onto the unpieced corner. */
export const TAPE = [[-37, 23.8], [-31, 23.1], [-25.6, 20.7], [-22.3, 17.5], [-20.5, 14.9], [-19.3, 12.7]];
export const toTape = (x, z) => toLine(TAPE, x, z);
export const toRiver = (x, z) => toLine(RIVER, x, z);
export const toPath = (x, z) => toLine(PATH, x, z);

// heaps of stuffing: [x, z, height, how far it spreads in x, in z]
const HILLS = [[VILLAGE.x, VILLAGE.z, 3.5, 8.2, 6.2], [MILL.x, MILL.z, 2.7, 4.6, 4.2], [0.2, 12, 1.25, 5.5, 3.4], [13.5, 6.5, 2.0, 5, 4.4], [-15.5, 1, 2.1, 4.4, 6], [-13, -12, 1.5, 5, 3.2], [16, -13, 1.2, 4, 2.6]];
function raw(x, z) {
  let h = 0;
  for (const [cx, cz, hh, rx, rz] of HILLS) h += hh * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  h += 0.2 * noise(x / 3.1 + 4, z / 3.1);
  const r = toRiver(x, z);
  h *= 1 - 0.62 * Math.exp(-((r / 2.6) ** 2));
  return h - 0.1 * Math.exp(-((r / 1.1) ** 2));
}
/** Where something stands, the quilt has been pressed level: [x, z, how far out, the level]. */
export const SITES = [];
export function site(x, z, r) { SITES.push([x, z, r, raw(x, z) - 0.08]); }

/** The height of the quilt at (x, z): the shape of the country, without the patches' own puff. */
export function mound(x, z) {
  const edge = Math.min(Q.w / 2 - Math.abs(x), Q.d / 2 - Math.abs(z)), e = sstep(0, 2.8, edge);
  let h = raw(x, z) * e;
  for (const [sx, sz, r, level] of SITES) {
    const d = Math.hypot(x - sx, z - sz);
    if (d < r) h += (level - h) * (1 - sstep(r * 0.5, r, d));
  }
  // where it lies slack on the table it ripples a little
  h += (1 - e) * sstep(0, 0.5, edge) * 0.055 * (Math.sin(x * 1.9 + 2 * noise(z / 2, 1)) + Math.sin(z * 2.3 + 2 * noise(x / 2, 7)));
  return 0.09 + Math.max(h, -0.04);
}
export const onQuilt = (x, z) => Math.abs(x) < Q.w / 2 && Math.abs(z) < Q.d / 2;
/** The near left corner, where the top has not been pieced yet: a ragged stair of patches still to come. */
const STAIR = [2, 4, 5, 6, 6, 7, 7];
export function unsewn(x, z) {
  if (!onQuilt(x, z)) return false;
  const i = Math.floor((x + Q.w / 2) / Q.s), j = Math.floor((z + Q.d / 2) / Q.s) - (Q.nz - STAIR.length);
  return j >= 0 && i <= STAIR[Math.min(j, STAIR.length - 1)];
}
/** The top of whatever is underfoot at (x, z): the quilt, the cutting mat or the bare table. */
export function ground(x, z) {
  if (onQuilt(x, z)) return mound(x, z) + (unsewn(x, z) ? 0.06 : 0.13);
  return Math.abs(x - TABLE.mat.x) < TABLE.mat.hw && Math.abs(z - TABLE.mat.z) < TABLE.mat.hd ? 0 : -0.07;
}
