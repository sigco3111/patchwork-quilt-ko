// The land is a quilt: a scrap quilt of squares and half-square triangles, laid over a heap of stuffing on the
// table so that it makes a hill, a lower knoll and slack edges. Nothing of it is a picture of a quilt. Every patch
// is its own small pillow of cloth, sewn to its neighbours along seams that are real valleys, puffed up between
// them, and quilted by hand: a line of running stitches a little way in from each seam, each stitch a piece of
// thread that pulls the cloth down where it goes through.
//
// sewQuilt() sews any quilt of that kind: `Q` is its size and how many patches, `mound(x, z)` the shape it lies in.
import * as THREE from 'three';
import { rng } from './fabric.js';
import { noise } from './noise.js';

export const Q = { w: 24.2, d: 17.6, s: 1.1, nx: 22, nz: 16 };
/** Where the cottage stands: the top of the hill, pressed level. */
export const HOUSE = { x: -3.2, z: -1.7, r: 2.7 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const stuffing = (x, z) => 3.1 * Math.exp(-(((x + 3.1) / 6.0) ** 2 + ((z + 1.6) / 4.8) ** 2))
  + 1.7 * Math.exp(-(((x - 6.6) / 3.3) ** 2 + ((z - 2.4) / 3.1) ** 2))
  + 0.8 * Math.exp(-(((x - 2.0) / 3.0) ** 2 + ((z + 5.6) / 2.4) ** 2))
  + 0.2 * noise(x / 3.1 + 4, z / 3.1);
const TERRACE = stuffing(HOUSE.x, HOUSE.z) - 0.12;

/** The height of the quilt's underside-to-top middle at (x, z): the shape of the hill, without the patches' own puff. */
export function mound(x, z) {
  const edge = Math.min(Q.w / 2 - Math.abs(x), Q.d / 2 - Math.abs(z));
  const e = sstep(0, 2.8, edge);
  let h = stuffing(x, z) * e;
  h += (TERRACE - h) * sstep(HOUSE.r, HOUSE.r * 0.5, Math.hypot(x - HOUSE.x, z - HOUSE.z));
  // where it lies slack on the table it ripples a little
  h += (1 - e) * sstep(0, 0.5, edge) * 0.055 * (Math.sin(x * 1.9 + 2 * noise(z / 2, 1)) + Math.sin(z * 2.3 + 2 * noise(x / 2, 7)));
  return 0.09 + Math.max(h, -0.04);
}
export const onQuilt = (x, z) => Math.abs(x) < Q.w / 2 && Math.abs(z) < Q.d / 2;

// --- one patch ---------------------------------------------------------------------------------------------------
const STEPS = [0, 0.05, 0.11, 0.19, 0.33, 0.5, 0.67, 0.81, 0.89, 0.95, 1]; // fine near a seam, where the cloth turns
const INSET = 0.13; // how far in from a seam the quilting stitches run
const puff = (d) => 0.17 * (1 - (1 - Math.min(d / 0.42, 1)) ** 2.4) - 0.045 * Math.exp(-(((d - INSET) / 0.045) ** 2));
function toEdge(x, z, corners) {
  let best = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % corners.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function createQuilt(fabrics) { return sewQuilt(fabrics, Q, mound); }

/**
 * Sews a quilt. `uneven`: no two patches are stuffed quite alike (some plump, some flat), as when it is done by
 * hand. `skip(x, z)`: true where a patch is left out (a corner not yet pieced). `unbound(x, z)`: true along the
 * part of the edge the binding hasn't reached.
 */
export function sewQuilt(fabrics, Q, mound, { seed = 20261111, uneven = false, skip = null, unbound = null } = {}) {
  const rand = rng(seed), other = rng(seed ^ 0x5bd1e995);
  // the cloth the patches are cut from, by family: [material, family]
  const F = (print, args, family) => ({ material: fabrics.cotton(print, args, { vertexColors: true }), family, pos: [], uv: [], col: [], index: [] });
  const scraps = [
    F('gingham', ['#4f8a4a'], 'green'), F('ditsy', ['#9fb88c'], 'green'), F('solid', ['#6f9150'], 'green'), F('dots', ['#3f6f4c'], 'green'), F('plaid', ['#7fa262', '#3f6f4c', '#e7d27a'], 'green'), F('stripes', ['#5d8f58', '#dfe8c8', 10], 'green'),
    F('solid', ['#d9a43a'], 'gold'), F('stripes', ['#d9a43a'], 'gold'), F('ditsy', ['#f0dc9c', ['#f6f1e6', '#d9765f', '#e8a23a']], 'gold'), F('dots', ['#e3b54a', '#fbf3dc', 7, 0.16], 'gold'),
    F('gingham', ['#c2473d'], 'red'), F('solid', ['#c8694a'], 'red'), F('ditsy', ['#e4a8a2', ['#f6f1e6', '#c2473d', '#f0cf68']], 'red'), F('stripes', ['#c2473d', '#f3ecdc', 12, 0.35], 'red'),
    F('gingham', ['#3f6f9a'], 'blue'), F('dots', ['#27405e'], 'blue'), F('solid', ['#4a8a90'], 'blue'), F('ditsy', ['#a9c6d6', ['#f6f1e6', '#27405e', '#f0cf68'], '#3f7f6a'], 'blue'),
    F('solid', ['#eadfc8'], 'cream'), F('ticking', ['#27405e'], 'cream'), F('ticking', ['#c2473d'], 'cream'),
  ];
  const families = { green: [], gold: [], red: [], blue: [], cream: [] };
  scraps.forEach((s, i) => families[s.family].push(i));
  /** Which cloth a patch at (x, z) is cut from: greens up on the hill, the warm ones lower, never its neighbours'. */
  const pick = (x, z, not) => {
    for (let tries = 0; ; tries++) {
      const high = sstep(0.5, 2.2, mound(x, z)), r = rand();
      const drift = noise(x / 4.2 + 9, z / 4.2 - 3);
      const family = r < 0.25 + 0.55 * high ? 'green' : r < 0.55 + 0.3 * high + 0.12 * drift ? 'gold' : r < 0.8 + 0.12 * high ? 'red' : r < 0.9 + 0.06 * high ? 'blue' : 'cream';
      const list = families[family], i = list[Math.floor(rand() * list.length)];
      if (!not.includes(i) || tries > 8) return i;
    }
  };

  // the corners the patches share: a grid, each corner a little out of true, as a hand cuts
  const corner = (i, j) => {
    const inner = i > 0 && i < Q.nx && j > 0 && j < Q.nz;
    const h = rng(i * 131 + j * 7919 + 5);
    return [-Q.w / 2 + i * Q.s + (inner ? (h() - 0.5) * 0.3 * Q.s : 0), -Q.d / 2 + j * Q.s + (inner ? (h() - 0.5) * 0.3 * Q.s : 0)];
  };

  const stitches = []; // [x, y, z, dx, dy, dz, length, colour]
  const THREADS = ['#e9dfc8', '#e9dfc8', '#e9dfc8', '#efe8d8', '#b8433a', '#27405e', '#d9a43a'];
  const cells = new Map(); // which patches were cut from each square of the grid, for surface()
  let laid = null;

  /** Cuts one patch: `corners` in order round it, and P(u, v) which sweeps the whole of it as u and v go 0..1. */
  function patch(fabric, corners, P) {
    const s = scraps[fabric], base = s.pos.length / 3;
    const turn = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.12, ox = rand() * 7, oz = rand() * 7;
    const c = Math.cos(turn), sn = Math.sin(turn);
    const plump = uneven ? 0.72 + 0.62 * other() : 1;
    const Y = (x, z) => mound(x, z) + plump * puff(toEdge(x, z, corners));
    laid?.push({ corners, plump });
    const n = STEPS.length;
    for (const v of STEPS) for (const u of STEPS) {
      const [x, z] = P(u, v), d = toEdge(x, z, corners);
      s.pos.push(x, mound(x, z) + plump * puff(d), z);
      s.uv.push(x * c - z * sn + ox, x * sn + z * c + oz);
      // the seam is in shadow, and so is the line the stitches pull down
      const shade = (0.6 + 0.4 * sstep(0, 0.1, d)) * (1 - 0.16 * Math.exp(-(((d - INSET) / 0.05) ** 2)));
      s.col.push(shade, shade, shade);
    }
    // faces up, whichever way round the corners were given
    const [a, b, d2] = [P(0.4, 0.4), P(0.6, 0.4), P(0.4, 0.6)];
    const up = (b[1] - a[1]) * (d2[0] - a[0]) - (b[0] - a[0]) * (d2[1] - a[1]) > 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const k = base + i + j * n;
      if (up) s.index.push(k, k + 1, k + n + 1, k, k + n + 1, k + n); else s.index.push(k, k + n + 1, k + 1, k, k + n, k + n + 1);
    }

    // the quilting: running stitches round the patch, a little way in from its seams
    const m = corners.length, cx = corners.reduce((t, p) => t + p[0], 0) / m, cz = corners.reduce((t, p) => t + p[1], 0) / m;
    const lines = corners.map((p, i) => {
      const q = corners[(i + 1) % m];
      let nx = -(q[1] - p[1]), nz = q[0] - p[0];
      const len = Math.hypot(nx, nz);
      nx /= len; nz /= len;
      if ((cx - p[0]) * nx + (cz - p[1]) * nz < 0) { nx = -nx; nz = -nz; }
      return { px: p[0] + nx * INSET, pz: p[1] + nz * INSET, dx: q[0] - p[0], dz: q[1] - p[1] };
    });
    const meet = (l1, l2) => {
      const det = l1.dx * l2.dz - l1.dz * l2.dx;
      if (Math.abs(det) < 1e-6) return [l2.px, l2.pz];
      const t = ((l2.px - l1.px) * l2.dz - (l2.pz - l1.pz) * l2.dx) / det;
      return [l1.px + l1.dx * t, l1.pz + l1.dz * t];
    };
    const colour = THREADS[Math.floor(rand() * THREADS.length)];
    for (let i = 0; i < m; i++) {
      const from = meet(lines[(i + m - 1) % m], lines[i]), to = meet(lines[i], lines[(i + 1) % m]);
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const count = Math.floor((len - 0.08) / 0.17);
      if (count < 1) continue;
      const ux = (to[0] - from[0]) / len, uz = (to[1] - from[1]) / len, start = (len - count * 0.17) / 2 + 0.035;
      for (let k = 0; k < count; k++) {
        const t0 = start + k * 0.17, long = 0.085 + 0.03 * rand(), wob = (rand() - 0.5) * 0.02;
        const x0 = from[0] + ux * t0 - uz * wob, z0 = from[1] + uz * t0 + ux * wob, x1 = x0 + ux * long, z1 = z0 + uz * long;
        const y0 = Y(x0, z0), y1 = Y(x1, z1);
        stitches.push((x0 + x1) / 2, (y0 + y1) / 2 + 0.006, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, long, colour);
      }
    }
  }

  // --- cut and lay them all ---
  const used = new Map();
  for (let j = 0; j < Q.nz; j++) for (let i = 0; i < Q.nx; i++) {
    const p00 = corner(i, j), p10 = corner(i + 1, j), p11 = corner(i + 1, j + 1), p01 = corner(i, j + 1);
    const mx = (p00[0] + p11[0]) / 2, mz = (p00[1] + p11[1]) / 2;
    if (skip?.(mx, mz)) continue;
    laid = [];
    cells.set(`${i},${j}`, laid);
    const near = [used.get(`${i - 1},${j}`), used.get(`${i},${j - 1}`)].flat().filter((v) => v != null);
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (rand() < 0.2) {
      // two triangles of different cloth, split on one slant or the other
      const flip = rand() < 0.5, f1 = pick(mx, mz, near), f2 = pick(mx, mz, [...near, f1]);
      const [A, B, C, D] = flip ? [p00, p10, p11, p01] : [p10, p11, p01, p00];
      patch(f1, [A, B, C], (u, v) => lerp(A, lerp(B, C, v), u));
      patch(f2, [A, C, D], (u, v) => lerp(A, lerp(C, D, v), u));
      used.set(`${i},${j}`, [f1, f2]);
    } else {
      const f = pick(mx, mz, near);
      patch(f, [p00, p10, p11, p01], (u, v) => lerp(lerp(p00, p10, u), lerp(p01, p11, u), v));
      used.set(`${i},${j}`, [f]);
    }
  }

  const group = new THREE.Group();
  let patches = 0;
  for (const s of scraps) {
    if (!s.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3));
    g.setIndex(s.index);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, s.material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    patches += s.pos.length / 3 / (STEPS.length * STEPS.length);
  }

  // the stitches: one short round piece of thread each
  const count = stitches.length / 8;
  const thread = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0115, 0.078, 2, 6), fabrics.thread(), count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const k = i * 8;
    dir.set(stitches[k + 3], stitches[k + 4], stitches[k + 5]).normalize();
    q.setFromUnitVectors(up, dir);
    M.compose(new THREE.Vector3(stitches[k], stitches[k + 1], stitches[k + 2]), q, new THREE.Vector3(1, stitches[k + 6] / 0.1, 1));
    thread.setMatrixAt(i, M);
    thread.setColorAt(i, col.set(stitches[k + 7]));
  }
  thread.castShadow = thread.receiveShadow = true;
  group.add(thread);

  // the binding: a strip of cloth folded over the raw edge all the way round
  {
    const pts = [], r = 0.5, hw = Q.w / 2 - 0.02, hd = Q.d / 2 - 0.02;
    const arc = (cx, cz, a0) => { for (let k = 0; k <= 5; k++) { const a = a0 + (k / 5) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
    const side = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5); for (let k = 1; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]); };
    arc(hw - r, hd - r, 0); side(hw - r, hd, -hw + r, hd);
    arc(-hw + r, hd - r, Math.PI / 2); side(-hw, hd - r, -hw, -hd + r);
    arc(-hw + r, -hd + r, Math.PI); side(-hw + r, -hd, hw - r, -hd);
    arc(hw - r, -hd + r, Math.PI * 1.5); side(hw, -hd + r, hw, hd - r);
    let ring = pts, closed = true;
    if (unbound) {
      // it begins where the bound edge begins and runs round to where it stops
      const keep = pts.map(([x, z]) => !unbound(x, z)), n = pts.length, first = keep.findIndex((k, i) => k && !keep[(i - 1 + n) % n]);
      if (first >= 0) { ring = []; closed = false; for (let k = 0; k < n && keep[(first + k) % n]; k++) ring.push(pts[(first + k) % n]); }
    }
    const curve = new THREE.CatmullRomCurve3(ring.map(([x, z]) => new THREE.Vector3(x, mound(x * 0.985, z * 0.985) + 0.02, z)), closed);
    const material = fabrics.cotton('stripes', ['#27405e', '#eadfc8', 6, 0.5], { size: 1 });
    material.map.repeat.set(curve.getLength() / 0.7, 1);
    const binding = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.round(curve.getLength() * 6.3), 0.125, 9, closed), material);
    binding.castShadow = binding.receiveShadow = true;
    group.add(binding);
  }

  const within = (x, z, c) => {
    let odd = false;
    for (let a = 0, b = c.length - 1; a < c.length; b = a++) if ((c[a][1] > z) !== (c[b][1] > z) && x < ((c[b][0] - c[a][0]) * (z - c[a][1])) / (c[b][1] - c[a][1]) + c[a][0]) odd = !odd;
    return odd;
  };
  /** The top of the cloth at (x, z): the land, and the puff of whichever patch is there. */
  const surface = (x, z) => {
    const i0 = Math.floor((x + Q.w / 2) / Q.s), j0 = Math.floor((z + Q.d / 2) / Q.s);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) for (const p of cells.get(`${i0 + di},${j0 + dj}`) ?? []) if (within(x, z, p.corners)) return mound(x, z) + p.plump * puff(toEdge(x, z, p.corners));
    return mound(x, z);
  };

  return { group, corner, surface, counts: { patches: Math.round(patches), stitches: count } };
}
