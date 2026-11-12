// The doll's cape: a piece of thick felt gathered into the ribbon round his neck and pressed into three deep flutes,
// hanging down his back to the knee, behind his arms. It is a grid of points held together by threads of fixed length, pulled by its own weight and
// pushed by the air it moves through. Felt is stiff: its threads push back as hard as they pull, and across each
// row there are threads to the second, third and fourth point along as well, which is what holds the flutes it
// was pressed into. So it swings and bends down its length like a bell; it doesn't crumple.
//
// What it must never do is get in front of him or over his head, so besides the rounded sticks of his body that it
// can't enter there are three plain rules: nothing of it may pass forward of his back, nothing of it may pass
// forward of his hips, and no part of it may rise above a shallow cone hanging from the collar.
import * as THREE from 'three';

const COLS = 21, ROWS = 14;
const DROP = 0.074; // metres of felt from one row to the next
const STEP = 1 / 120;
const SPAN = 1.3; // the collar goes this far (radians) round each side of the neck from the middle of the back

export class Cape {
  constructor(bones) {
    this.bones = bones;
    this.cols = COLS; this.rows = ROWS;
    const n = COLS * ROWS;
    this.p = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.normals = new Float32Array(n * 3);
    this.pins = new Float32Array(COLS * 3);
    this.pinsBefore = new Float32Array(COLS * 3);
    this.hat = null; // the hat, if he wears one: the cape stays under its brim
    this.hatInverse = new THREE.Matrix4();
    this.started = false;
    this.time = 0;
    this.left = 0;

    // the felt as it was pressed: round a cone from the collar, in three flutes that deepen toward the hem. Thread
    // lengths come from this.
    const rest = new Float32Array(n * 3);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) rest.set(this.hung(i, j), (i + j * COLS) * 3);
    }
    const links = [];
    const link = (a, b, pull, push) => {
      const d = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
      links.push(a, b, d, pull, push);
    };
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = i + j * COLS;
        if (i + 1 < COLS) link(k, k + 1, 1, 0.5);
        if (j + 1 < ROWS) link(k, k + COLS, 1, 0.5);
        if (i + 1 < COLS && j + 1 < ROWS) { link(k, k + COLS + 1, 0.6, 0.3); link(k + 1, k + COLS, 0.6, 0.3); }
        if (i + 2 < COLS) link(k, k + 2, 0.55, 0.55);
        if (i + 3 < COLS) link(k, k + 3, 0.45, 0.45);
        if (i + 4 < COLS) link(k, k + 4, 0.35, 0.35);
        if (j + 2 < ROWS) link(k, k + 2 * COLS, 0.45, 0.45);
      }
    }
    this.links = new Float32Array(links);

    // the body the felt lies on: [bone, bone, radius]
    this.sticks = [
      ['pelvis', 'spine_03', 0.17], ['spine_03', 'neck_01', 0.15], ['upperarm_l', 'upperarm_r', 0.105], ['pelvis', 'pelvis', 0.2],
      ['upperarm_l', 'lowerarm_l', 0.095], ['lowerarm_l', 'hand_l', 0.085], ['upperarm_r', 'lowerarm_r', 0.095], ['lowerarm_r', 'hand_r', 0.085],
      ['thigh_l', 'calf_l', 0.135], ['calf_l', 'foot_l', 0.118], ['thigh_r', 'calf_r', 0.135], ['calf_r', 'foot_r', 0.118],
    ];
    this.ends = new Float32Array(this.sticks.length * 6);
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.c = new THREE.Vector3();
    this.X = new THREE.Vector3(); this.Y = new THREE.Vector3(); this.Z = new THREE.Vector3(); this.C = new THREE.Vector3();
    this.F = new THREE.Vector3(); this.hips = new THREE.Vector3();
    this.endsBefore = new Float32Array(this.sticks.length * 6);
  }

  /** Where column i sits round the collar: 0 at the middle of the back. */
  angle(i) { return ((i / (COLS - 1)) * 2 - 1) * SPAN; }

  /** The felt laid flat, near enough, for its weave: where point (i, j) is on the table. */
  cut(i, j) {
    const s = j / (ROWS - 1);
    return [((i / (COLS - 1)) - 0.5) * (0.3 + 0.5 * s), -j * DROP, 0];
  }

  /** The shape it was pressed into and is first hung in: round a cone from the collar, in three flutes (x to his left, y up, z forward). */
  hung(i, j) {
    const s = j / (ROWS - 1), t = this.angle(i) * (1 - 0.3 * s);
    const r = (0.108 + 0.235 * s) * (1 + 0.19 * s ** 0.8 * Math.cos(((i / (COLS - 1)) - 0.5) * Math.PI * 5));
    return [Math.sin(t) * r, -j * DROP * 0.96, -Math.cos(t) * r * 0.82];
  }

  /** One pass over the threads: each is brought toward its length. */
  pull() {
    const { p, links } = this;
    for (let l = 0; l < links.length; l += 5) {
      const a = links[l] * 3, b = links[l + 1] * 3, rest = links[l + 2];
      const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const k = ((d - rest) / d) * (d > rest ? links[l + 3] : links[l + 4]);
      const pa = a < COLS * 3, pb = b < COLS * 3;
      if (pa && pb) continue;
      const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
      p[a] += dx * k * wa; p[a + 1] += dy * k * wa; p[a + 2] += dz * k * wa;
      p[b] -= dx * k * wb; p[b + 1] -= dy * k * wb; p[b + 2] -= dz * k * wb;
    }
  }

  readBody() {
    const B = this.bones, { a, b, X, Y, Z, C, F } = this;
    this.pinsBefore.set(this.pins);
    this.endsBefore.set(this.ends);
    if (this.hat) this.hatInverse.copy(this.hat.matrixWorld).invert();
    B.upperarm_l.getWorldPosition(a); B.upperarm_r.getWorldPosition(b);
    X.subVectors(a, b).normalize();
    B.neck_01.getWorldPosition(a); B.spine_03.getWorldPosition(b);
    Y.subVectors(a, b).normalize();
    Z.crossVectors(X, Y).normalize();
    Y.crossVectors(Z, X);
    // the collar: round the back of the neck, where the ribbon is
    C.copy(a).addScaledVector(Y, -0.02).addScaledVector(Z, 0.015);
    for (let i = 0; i < COLS; i++) {
      const t = this.angle(i), sx = Math.sin(t) * 0.108, sz = -Math.cos(t) * 0.0886;
      this.pins[i * 3] = C.x + X.x * sx + Z.x * sz;
      this.pins[i * 3 + 1] = C.y + X.y * sx + Z.y * sz;
      this.pins[i * 3 + 2] = C.z + X.z * sx + Z.z * sz;
    }
    B.pelvis.getWorldPosition(this.hips);
    F.set(Z.x, 0, Z.z).normalize();
    this.sticks.forEach(([p, q], k) => {
      B[p].getWorldPosition(a); B[q].getWorldPosition(b);
      this.ends.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
    });
  }

  start() {
    this.readBody();
    const { X, Y, Z } = this;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = (i + j * COLS) * 3, [x, y, z] = this.hung(i, j), [x0, , z0] = this.hung(i, 0);
        const dx = x - x0, dz = z - z0 - 0.004 * j;
        this.p[k] = this.pins[i * 3] + X.x * dx + Z.x * dz;
        this.p[k + 1] = this.pins[i * 3 + 1] + y;
        this.p[k + 2] = this.pins[i * 3 + 2] + X.z * dx + Z.z * dz;
      }
    }
    this.pinsBefore.set(this.pins);
    this.endsBefore.set(this.ends);
    for (let it = 0; it < 60; it++) { this.pull(); this.collide(1, null); }
    this.prev.set(this.p);
    this.computeNormals();
    this.started = true;
  }

  /** Advance by dt. `air(x, y, z, out)` gives the wind there (m/s); `ground(x, z)` the height of the floor. */
  update(dt, air, ground) {
    if (!this.started) return this.start();
    this.readBody();
    // a jump of more than a couple of metres is a teleport: hang the felt afresh
    if (Math.hypot(this.pins[0] - this.pinsBefore[0], this.pins[1] - this.pinsBefore[1], this.pins[2] - this.pinsBefore[2]) > 2) { this.started = false; return this.start(); }
    this.left += Math.min(dt, 0.05);
    const steps = Math.min(6, Math.floor(this.left / STEP));
    if (steps <= 0) return;
    this.left -= steps * STEP;
    const { p, prev, normals, pins, pinsBefore } = this;
    const wind = this.c;
    for (let s = 0; s < steps; s++) {
      const u = (s + 1) / steps;
      this.time += STEP;
      this.computeNormals();
      for (let j = 1; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const k = (i + j * COLS) * 3;
          let vx = (p[k] - prev[k]) * 0.985, vy = (p[k + 1] - prev[k + 1]) * 0.985, vz = (p[k + 2] - prev[k + 2]) * 0.985;
          air(p[k], p[k + 1], p[k + 2], wind);
          // the air it meets: the wind less its own speed. Felt is heavy, so the air lifts it less than it would silk
          const rx = wind.x - vx / STEP, ry = wind.y - vy / STEP, rz = wind.z - vz / STEP;
          const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
          const speed = Math.hypot(rx, ry, rz);
          const flutter = Math.sin(this.time * 9 - j * 0.8 + i * 0.6) * 0.16 * speed * (j / ROWS);
          const ax = nx * flutter + rx * 1.0, ay = -9.8 + ny * flutter + ry * 0.4, az = nz * flutter + rz * 1.0;
          prev[k] = p[k]; prev[k + 1] = p[k + 1]; prev[k + 2] = p[k + 2];
          p[k] += vx + ax * STEP * STEP; p[k + 1] += vy + ay * STEP * STEP; p[k + 2] += vz + az * STEP * STEP;
        }
      }
      for (let i = 0; i < COLS * 3; i++) p[i] = pinsBefore[i] + (pins[i] - pinsBefore[i]) * u;
      for (let it = 0; it < 8; it++) {
        this.pull();
        if (it % 2 === 1) this.collide(u, ground);
      }
      this.collide(u, ground);
    }
    this.computeNormals();
  }

  collide(u, ground) {
    const { p, ends, endsBefore, sticks, pins, Y, Z, C, F, hips } = this;
    for (let k = COLS * 3; k < p.length; k += 3) {
      const row = Math.floor(k / 3 / COLS), col = (k / 3) % COLS;
      for (let s = 0; s < sticks.length; s++) {
        const e = s * 6, r = sticks[s][2] + 0.018;
        const ax = endsBefore[e] + (ends[e] - endsBefore[e]) * u, ay = endsBefore[e + 1] + (ends[e + 1] - endsBefore[e + 1]) * u, az = endsBefore[e + 2] + (ends[e + 2] - endsBefore[e + 2]) * u;
        const bx = endsBefore[e + 3] + (ends[e + 3] - endsBefore[e + 3]) * u, by = endsBefore[e + 4] + (ends[e + 4] - endsBefore[e + 4]) * u, bz = endsBefore[e + 5] + (ends[e + 5] - endsBefore[e + 5]) * u;
        const ex = bx - ax, ey = by - ay, ez = bz - az;
        const len2 = ex * ex + ey * ey + ez * ez;
        const t = len2 > 1e-8 ? Math.max(0, Math.min(1, ((p[k] - ax) * ex + (p[k + 1] - ay) * ey + (p[k + 2] - az) * ez) / len2)) : 0;
        const dx = p[k] - ax - ex * t, dy = p[k + 1] - ay - ey * t, dz = p[k + 2] - az - ez * t;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r && d2 > 1e-10) {
          const d = Math.sqrt(d2), f = (r - d) / d;
          p[k] += dx * f; p[k + 1] += dy * f; p[k + 2] += dz * f;
        }
      }
      if (this.hat) {
        // in the hat's own space the brim is a shallow cone: anything of the cape that rises into it is put back under
        const e = this.hatInverse.elements, m = this.hat.matrixWorld.elements;
        const x = p[k], y = p[k + 1], z = p[k + 2];
        const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
        const r = Math.hypot(lx, lz);
        if (r < 0.36) {
          const under = (r < 0.125 ? 0 : -(r - 0.125) * 0.5) - 0.05;
          if (ly > under && ly < under + 0.35) {
            const dy = under - ly;
            p[k] += m[4] * dy; p[k + 1] += m[5] * dy; p[k + 2] += m[6] * dy;
          }
        }
      }
      // never forward of his back (above the hips) nor of his hips (below them)
      if (p[k + 1] > hips.y) {
        const f = (p[k] - C.x) * Z.x + (p[k + 1] - C.y) * Z.y + (p[k + 2] - C.z) * Z.z + 0.02;
        if (f > 0) { p[k] -= Z.x * f; p[k + 1] -= Z.y * f; p[k + 2] -= Z.z * f; }
      } else {
        const f = (p[k] - hips.x) * F.x + (p[k + 2] - hips.z) * F.z + 0.03;
        if (f > 0) { p[k] -= F.x * f; p[k + 2] -= F.z * f; }
      }
      // never above a shallow cone hung from the collar: it can fly out behind him, not up over his head
      const top = pins[col * 3 + 1] - row * DROP * 0.24;
      if (p[k + 1] > top) p[k + 1] = top;
      if (ground) { const g = ground(p[k], p[k + 2]) + 0.04; if (p[k + 1] < g) p[k + 1] = g; }
    }
  }

  computeNormals() {
    const { p, normals } = this;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const k = (i + j * COLS) * 3;
        const l = (Math.max(i - 1, 0) + j * COLS) * 3, r = (Math.min(i + 1, COLS - 1) + j * COLS) * 3;
        const up = (i + Math.max(j - 1, 0) * COLS) * 3, dn = (i + Math.min(j + 1, ROWS - 1) * COLS) * 3;
        const ax = p[r] - p[l], ay = p[r + 1] - p[l + 1], az = p[r + 2] - p[l + 2];
        const bx = p[dn] - p[up], by = p[dn + 1] - p[up + 1], bz = p[dn + 2] - p[up + 2];
        // across x down points out of the back of the cape
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.hypot(nx, ny, nz) || 1;
        normals[k] = nx / len; normals[k + 1] = ny / len; normals[k + 2] = nz / len;
      }
    }
  }
}
