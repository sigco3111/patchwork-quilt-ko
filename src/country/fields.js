// The fields. Seen from a hill, farmland is a patchwork; here it is one. The quilt is pieced in big blocks, their
// corners pulled a little out of true and following the lie of the land, and each block is one field, or cut into
// two or four, or into triangles: small fields near the road and the village, big ones out on the hills. Every
// field is its own pillow of cloth sewn to its neighbours along seams that are real valleys: wheat is gold
// cotton, plough is brown corduroy with its wales for furrows, pasture is green felt and gingham, and here and
// there one is poppies, lavender or flax. Near where he walks every one is quilted by hand, stitch by stitch.
// Along some of the seams runs a hedge: a length of bobble trim, green.
import * as THREE from 'three';
import { rng } from '../fabric.js';
import { noise } from '../noise.js';
import { Q, SITES, START, away, mound, toRiver, toRoad } from './land.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FINE = [0, 0.04, 0.09, 0.16, 0.3, 0.5, 0.7, 0.84, 0.91, 0.96, 1]; // fine near a seam, where the cloth turns
const COARSE = [0, 0.07, 0.18, 0.5, 0.82, 0.93, 1];
const INSET = 0.2; // how far in from a seam the quilting stitches run
/** How a field of that size (metres across) is puffed: d is how far in from its nearest seam. */
const puffOf = (size) => {
  const H = 0.15 * Math.sqrt(size), W = 0.3 * size ** 0.9;
  return (d) => H * (1 - (1 - Math.min(d / W, 1)) ** 2.4) - 0.05 * Math.exp(-(((d - INSET) / 0.06) ** 2));
};
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
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function createFields(fabrics) {
  const rand = rng(20261112);
  const cloth = (material, family) => ({ material, family, pos: [], uv: [], col: [], index: [] });
  const F = (print, args, family, size = 2.3) => cloth(fabrics.cotton(print, args, { vertexColors: true, size }), family);
  const scraps = [
    // pasture and green crops
    F('gingham', ['#4f8a4a'], 'green'), F('solid', ['#6f9150'], 'green'), F('dots', ['#3f6f4c'], 'green'), F('plaid', ['#7fa262', '#3f6f4c', '#e7d27a'], 'green'), F('stripes', ['#5d8f58', '#b9d08c', 10], 'green'),
    F('solid', ['#8aa85a'], 'green'), F('ditsy', ['#86a868', ['#f6f1e6', '#f0cf68', '#e9b8b0'], '#4f7a3f'], 'green'), F('gingham', ['#7fa262', '#e3ecc6'], 'green'),
    cloth(fabrics.felt('#5f9148', { vertexColors: true }), 'green'), cloth(fabrics.felt('#7aa353', { vertexColors: true }), 'green'), cloth(fabrics.corduroy('#55803f', { vertexColors: true }), 'green'),
    // wheat, barley, stubble, rape
    F('solid', ['#d9a43a'], 'gold'), F('stripes', ['#d9a43a', '#f0d68a', 12], 'gold'), F('ticking', ['#c98f2e', '#f0dc9c'], 'gold'), F('dots', ['#e3b54a', '#fbf3dc', 7, 0.16], 'gold'), F('solid', ['#ecc94f'], 'gold'),
    cloth(fabrics.corduroy('#d8a640', { vertexColors: true, wale: 1.4 }), 'gold'), F('plaid', ['#e6c263', '#c98f2e', '#f6e9b8'], 'gold'),
    // plough
    cloth(fabrics.corduroy('#8a5a38', { vertexColors: true }), 'brown'), cloth(fabrics.corduroy('#a06a42', { vertexColors: true, wale: 2.6 }), 'brown'), cloth(fabrics.corduroy('#6f4a32', { vertexColors: true, wale: 1.6 }), 'brown'),
    // and the odd field of something else
    F('ditsy', ['#c9584a', ['#e83f2e', '#f2684f', '#f6f1e6'], '#4f7a3f'], 'red'), F('gingham', ['#c2473d'], 'red'),
    F('dots', ['#8a6fb0', '#d9c8ee', 9, 0.14], 'lilac'), F('stripes', ['#7d63a6', '#a890c8', 14], 'lilac'),
    F('ditsy', ['#a9c6d6', ['#f6f1e6', '#3f6f9a', '#f0cf68'], '#3f7f6a'], 'blue'), F('gingham', ['#3f6f9a'], 'blue'),
    F('solid', ['#eadfc8'], 'cream'), F('ticking', ['#5d8f58'], 'cream'), F('ditsy', ['#f3d9d4', ['#f6f1e6', '#e58f86', '#f0cf68']], 'cream'),
  ];
  const families = {};
  scraps.forEach((s, i) => (families[s.family] ??= []).push(i));
  /** Which cloth a field at (x, z) is cut from: more pasture on the hills, more corn in the valley; never its neighbours'. */
  const pick = (x, z, not) => {
    for (let tries = 0; ; tries++) {
      const high = sstep(2, 8, mound(x, z)), drift = noise(x / 31 + 9, z / 31 - 3), r = rand();
      const green = 0.4 + 0.26 * high, gold = green + 0.27 - 0.12 * high + 0.1 * drift, brown = gold + 0.12, red = brown + 0.05, lilac = red + 0.028, blue = lilac + 0.035;
      const family = r < green ? 'green' : r < gold ? 'gold' : r < brown ? 'brown' : r < red ? 'red' : r < lilac ? 'lilac' : r < blue ? 'blue' : 'cream';
      const list = families[family], i = list[Math.floor(rand() * list.length)];
      if (!not.includes(i) || tries > 10) return i;
    }
  };

  // the corners the blocks share: a grid that follows the land, each corner a little out of true
  const corner = (i, j) => {
    const x = Q.x0 + i * Q.block, z = Q.z0 + j * Q.block;
    if (i === 0 || i === Q.nx || j === 0 || j === Q.nz) return [x, z];
    const h = rng(i * 131 + j * 7919 + 5), hold = Math.min(1, Math.min(i, Q.nx - i, j, Q.nz - j) / 3);
    return [x + hold * (2.3 * noise(x / 37 + 1, z / 37) + (h() - 0.5) * 0.26 * Q.block), z + hold * (2.3 * noise(x / 37 + 7, z / 37 + 5) + (h() - 0.5) * 0.26 * Q.block)];
  };

  const near = [], far = []; // stitches: [x, y, z, dx, dy, dz, length, colour]
  const THREADS = ['#e9dfc8', '#e9dfc8', '#e9dfc8', '#efe8d8', '#b8433a', '#27405e', '#d9a43a', '#f3ecdc'];
  let count = 0;

  /** Cuts one field: `corners` in order round it, and P(u, v) which sweeps the whole of it as u and v go 0..1. */
  function patch(fabric, corners, P) {
    const s = scraps[fabric], base = s.pos.length / 3, m = corners.length;
    const cx = corners.reduce((t, p) => t + p[0], 0) / m, cz = corners.reduce((t, p) => t + p[1], 0) / m;
    let area = 0;
    for (let i = 0; i < m; i++) { const a = corners[i], b = corners[(i + 1) % m]; area += a[0] * b[1] - b[0] * a[1]; }
    const size = Math.sqrt(Math.abs(area) / 2) * (m === 3 ? 0.8 : 1), puff = puffOf(size), reach = away(cx, cz);
    const STEPS = reach < 52 ? FINE : COARSE, n = STEPS.length;
    // the print runs with one side of the field, as a crop is sown along its hedge
    const turn = Math.atan2(corners[1][1] - corners[0][1], corners[1][0] - corners[0][0]) + Math.floor(rand() * 4) * (Math.PI / 2), ox = rand() * 7, oz = rand() * 7;
    const c = Math.cos(turn), sn = Math.sin(turn);
    const Y = (x, z) => mound(x, z) + puff(toEdge(x, z, corners));
    for (const v of STEPS) for (const u of STEPS) {
      const [x, z] = P(u, v), d = toEdge(x, z, corners);
      s.pos.push(x, mound(x, z) + puff(d), z);
      s.uv.push(x * c + z * sn + ox, -x * sn + z * c + oz);
      // the seam is in shadow, and so is the line the stitches pull down
      const shade = (0.58 + 0.42 * sstep(0, 0.16, d)) * (1 - 0.16 * Math.exp(-(((d - INSET) / 0.07) ** 2)));
      s.col.push(shade, shade, shade);
    }
    // faces up, whichever way round the corners were given
    const [a, b, d2] = [P(0.4, 0.4), P(0.6, 0.4), P(0.4, 0.6)];
    const up = (b[1] - a[1]) * (d2[0] - a[0]) - (b[0] - a[0]) * (d2[1] - a[1]) > 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const k = base + i + j * n;
      if (up) s.index.push(k, k + 1, k + n + 1, k, k + n + 1, k + n); else s.index.push(k, k + n + 1, k + 1, k, k + n, k + n + 1);
    }
    count++;
    if (reach > 62) return;

    // the quilting: running stitches round the field, a little way in from its seams
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
    const close = reach < 24, colour = THREADS[Math.floor(rand() * THREADS.length)], out = close ? near : far, every = close ? 0.27 : 0.42;
    for (let i = 0; i < m; i++) {
      const from = meet(lines[(i + m - 1) % m], lines[i]), to = meet(lines[i], lines[(i + 1) % m]);
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const stitches = Math.floor((len - 0.1) / every);
      if (stitches < 1) continue;
      const ux = (to[0] - from[0]) / len, uz = (to[1] - from[1]) / len, start = (len - stitches * every) / 2 + 0.05;
      for (let k = 0; k < stitches; k++) {
        const t0 = start + k * every, long = (close ? 0.13 : 0.2) + 0.04 * rand(), wob = (rand() - 0.5) * 0.03;
        const x0 = from[0] + ux * t0 - uz * wob, z0 = from[1] + uz * t0 + ux * wob, x1 = x0 + ux * long, z1 = z0 + uz * long;
        const y0 = Y(x0, z0), y1 = Y(x1, z1);
        out.push((x0 + x1) / 2, (y0 + y1) / 2 + 0.008, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, long, colour);
      }
    }
  }

  // --- cut and lay them all ---
  const used = new Map(), recent = [];
  const field = (A, B, C, D, not) => {
    const mx = (A[0] + B[0] + C[0] + D[0]) / 4, mz = (A[1] + B[1] + C[1] + D[1]) / 4, picked = [];
    if (rand() < 0.11) {
      const flip = rand() < 0.5, [a, b, c, d] = flip ? [A, B, C, D] : [B, C, D, A];
      const f1 = pick(mx, mz, [...not, ...recent]), f2 = pick(mx, mz, [...not, ...recent, f1]);
      patch(f1, [a, b, c], (u, v) => lerp(a, lerp(b, c, v), u));
      patch(f2, [a, c, d], (u, v) => lerp(a, lerp(c, d, v), u));
      picked.push(f1, f2);
    } else {
      const f = pick(mx, mz, [...not, ...recent]);
      patch(f, [A, B, C, D], (u, v) => lerp(lerp(A, B, u), lerp(D, C, u), v));
      picked.push(f);
    }
    recent.push(...picked);
    while (recent.length > 5) recent.shift();
    return picked;
  };
  for (let j = 0; j < Q.nz; j++) for (let i = 0; i < Q.nx; i++) {
    const A = corner(i, j), B = corner(i + 1, j), C = corner(i + 1, j + 1), D = corner(i, j + 1);
    const reach = away((A[0] + C[0]) / 2, (A[1] + C[1]) / 2), r = rand();
    const cut = reach < 16 ? (r < 0.72 ? 4 : 2) : reach < 42 ? (r < 0.28 ? 4 : r < 0.82 ? 2 : 1) : r < 0.32 ? 2 : 1;
    const not = [used.get(`${i - 1},${j}`), used.get(`${i},${j - 1}`)].flat().filter((v) => v != null), mine = [];
    const t = () => 0.42 + 0.16 * rand();
    if (cut === 1) mine.push(...field(A, B, C, D, not));
    else if (cut === 2) {
      if (rand() < 0.5) { const E = lerp(A, B, t()), G = lerp(D, C, t()); mine.push(...field(A, E, G, D, not), ...field(E, B, C, G, not)); }
      else { const E = lerp(A, D, t()), G = lerp(B, C, t()); mine.push(...field(A, B, G, E, not), ...field(E, G, C, D, not)); }
    } else {
      const E = lerp(A, B, t()), G = lerp(D, C, t()), L = lerp(A, D, t()), R = lerp(B, C, t()), M = lerp(E, G, t());
      mine.push(...field(A, E, M, L, not), ...field(E, B, R, M, not), ...field(M, R, C, G, not), ...field(L, M, G, D, not));
    }
    used.set(`${i},${j}`, mine);
  }

  const group = new THREE.Group();
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
  }

  // the stitches: one short piece of thread each. Round ones where he walks; further off, where a stitch is a
  // speck, fewer and plainer
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), col = new THREE.Color();
  for (const [list, geometry] of [[near, new THREE.CapsuleGeometry(0.017, 0.066, 2, 6)], [far, new THREE.CylinderGeometry(0.024, 0.024, 0.1, 4, 1, true)]]) {
    const thread = new THREE.InstancedMesh(geometry, fabrics.thread(), list.length / 8);
    for (let i = 0; i < list.length / 8; i++) {
      const k = i * 8;
      dir.set(list[k + 3], list[k + 4], list[k + 5]).normalize();
      q.setFromUnitVectors(up, dir);
      thread.setMatrixAt(i, M.compose(new THREE.Vector3(list[k], list[k + 1], list[k + 2]), q, new THREE.Vector3(1, list[k + 6] / 0.1, 1)));
      thread.setColorAt(i, col.set(list[k + 7]));
    }
    thread.receiveShadow = true;
    group.add(thread);
  }

  // hedges: bobble trim sewn into some of the seams between blocks
  const bobbles = [];
  const GREENS = ['#3f6f4c', '#4f8a4a', '#5d9a52', '#3a6b3f', '#6f9150', '#2f5f44', '#7fa262', '#b98a3a'];
  const clear = (x, z) => toRoad(x, z) > 2 && toRiver(x, z) > 2.6 && Math.hypot(x - START.x, z - START.z) > 5 && SITES.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) > r * 0.8);
  const hedge = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(len / 0.52), tone = GREENS[Math.floor(rand() * rand() * GREENS.length)];
    for (let k = 0; k <= n; k++) {
      const [x, z] = lerp(a, b, (k + 0.5 * rand()) / (n + 1));
      if (!clear(x, z)) continue;
      const r = 0.2 + 0.11 * rand();
      bobbles.push(x, mound(x, z) + r * 0.72, z, r, rand() < 0.8 ? tone : GREENS[Math.floor(rand() * GREENS.length)]);
    }
  };
  for (let j = 1; j < Q.nz; j++) for (let i = 1; i < Q.nx; i++) {
    if (rand() < 0.2) hedge(corner(i, j), corner(i + 1, j));
    if (rand() < 0.2) hedge(corner(i, j), corner(i, j + 1));
  }
  {
    const ball = new THREE.IcosahedronGeometry(1, 1);
    ball.deleteAttribute('normal');
    ball.setAttribute('normal', ball.attributes.position.clone()); // a ball: lit as round, however few its faces
    const fuzz = fabrics.weaves.felt.clone();
    fuzz.repeat.set(3, 3);
    const mesh = new THREE.InstancedMesh(ball, new THREE.MeshPhysicalMaterial({ roughness: 1, normalMap: fuzz, normalScale: new THREE.Vector2(2, 2), sheen: 1, sheenColor: new THREE.Color(0.45, 0.55, 0.35), sheenRoughness: 0.8 }), bobbles.length / 5);
    const e = new THREE.Euler();
    for (let i = 0; i < bobbles.length / 5; i++) {
      const k = i * 5, r = bobbles[k + 3];
      q.setFromEuler(e.set(rand() * 6, rand() * 6, 0));
      mesh.setMatrixAt(i, M.compose(new THREE.Vector3(bobbles[k], bobbles[k + 1], bobbles[k + 2]), q, new THREE.Vector3(r, r * (0.85 + 0.25 * rand()), r)));
      mesh.setColorAt(i, col.set(bobbles[k + 4]).multiplyScalar(0.8 + 0.4 * rand()));
    }
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // the binding: a strip of cloth folded over the raw edge all the way round
  {
    const pts = [], r = 1.2, hw = (Q.x1 - Q.x0) / 2 - 0.05, hd = (Q.z1 - Q.z0) / 2 - 0.05, mx = (Q.x0 + Q.x1) / 2, mz = (Q.z0 + Q.z1) / 2;
    const arc = (cx, cz, a0) => { for (let k = 0; k <= 5; k++) { const a = a0 + (k / 5) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
    const side = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 2); for (let k = 1; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]); };
    arc(hw - r, hd - r, 0); side(hw - r, hd, -hw + r, hd);
    arc(-hw + r, hd - r, Math.PI / 2); side(-hw, hd - r, -hw, -hd + r);
    arc(-hw + r, -hd + r, Math.PI); side(-hw + r, -hd, hw - r, -hd);
    arc(hw - r, -hd + r, Math.PI * 1.5); side(hw, -hd + r, hw, hd - r);
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x + mx, 0.12, z + mz)), true);
    const material = fabrics.cotton('stripes', ['#27405e', '#eadfc8', 6, 0.5], { size: 1 });
    material.map.repeat.set(curve.getLength() / 1.4, 1);
    const binding = new THREE.Mesh(new THREE.TubeGeometry(curve, 900, 0.26, 9, true), material);
    binding.castShadow = binding.receiveShadow = true;
    group.add(binding);
  }

  return { group, counts: { fields: count, stitches: (near.length + far.length) / 8, bobbles: bobbles.length / 5 } };
}
