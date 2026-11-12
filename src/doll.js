// The wanderer as a rag doll. Underneath he is the same figure as ever (Patch's starter man: his bones, his clips,
// his way of moving), but nothing of that body is drawn. What is drawn is a doll sewn in pieces and hung on those
// bones: stuffed limbs that swell between their joints, dungarees with their gold topstitching over a striped
// shirt, low felt boots, mitten hands, a round linen head with button eyes, wool hair, a felt hat and a felt cape.
//
// He is filmed like a puppet, but only as far as it is a pleasure to watch. Where he is and which way he faces
// follow the player on every frame, so he never lags; what steps is his pose, which is taken from the bones a set
// number of times a second (`pose()`) and held between, as a puppet's is between the frames of a film.
import * as THREE from 'three';
import { loadMan } from './figure/man.js';
import { Cape } from './cape.js';
import { rng } from './fabric.js';
import { cast, createStitches, fuzz } from './sew.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), FWD = V(0, 0, 1), TAU = Math.PI * 2;
const GOLD = '#dba53e', CREAM = '#f3ecdc';

/** A curve through evenly spaced values, at t in 0..1. */
function through(values, t) {
  const n = values.length - 1, x = Math.min(Math.max(t, 0), 1) * n, i = Math.min(Math.floor(x), n - 1), f = x - i;
  const a = values[Math.max(i - 1, 0)], b = values[i], c = values[i + 1], d = values[Math.min(i + 2, n)];
  return 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f ** 3);
}

/**
 * A stuffed length of cloth: round, along +Y from 0 to len, as thick at each height as `radii` says (evenly spaced
 * from bottom to top), closed with a rounded end (caps: how round, 0 flat), then pressed to sx by sz. `period`:
 * the repeat of the cloth's print, so that a whole number of repeats goes round and the seam doesn't show.
 */
function stuffed(len, radii, material, { sx = 1, sz = 1, caps = [1, 1], around = 24, along = 14, period = 0, turn = 0 } = {}) {
  const R = (y) => through(radii, y / len);
  const pts = [], r0 = radii[0], r1 = radii[radii.length - 1];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(r0 * Math.sin(a), 1e-4), -r0 * caps[0] * Math.cos(a))); }
  // (each end is a round of cloth of its own, sewn on: its print runs straight across it, not in to a point)
  pts.push(new THREE.Vector2(r0, -0.0004));
  for (let i = 0; i <= along; i++) pts.push(new THREE.Vector2(R((len * i) / along), (len * i) / along));
  pts.push(new THREE.Vector2(r1, len + 0.0004));
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(r1 * Math.cos(a), 1e-4), len + r1 * caps[1] * Math.sin(a))); }
  const run = [0];
  for (let i = 1; i < pts.length; i++) run.push(run[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const g = new THREE.LatheGeometry(pts, around), uv = g.attributes.uv;
  const circ = TAU * (radii.reduce((a, b) => a + b, 0) / radii.length) * (sx + sz) / 2;
  const round = period ? Math.max(1, Math.round(circ / period)) * period : circ;
  if (turn) g.rotateY(turn);
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const j = i % pts.length;
    if (j < 6 || j >= pts.length - 6) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, uv.getX(i) * round, run[j]);
  }
  g.scale(sx, 1, sz);
  const group = new THREE.Group();
  group.add(cast(new THREE.Mesh(g, material)));
  return {
    group, len, R,
    /** The point on its surface at angle phi (0 is +Z, toward +X) and height y, lifted `lift` off it; and the way out. */
    at(phi, y, lift = 0) {
      const r = R(y), slope = (R(y + 0.004) - R(y - 0.004)) / 0.008;
      const n = V(Math.sin(phi) / sx, -slope, Math.cos(phi) / sz).normalize();
      return { p: V(r * Math.sin(phi) * sx, y, r * Math.cos(phi) * sz).addScaledVector(n, lift), n };
    },
  };
}

/** A piece of cloth sewn flat onto a stuffed part: centred at (phi, y), `wide` round it and `high` up it, a little puffed. */
function patchOn(part, phi, y, wide, high, material, lift = 0.009, n = 9) {
  const r = Math.hypot(part.at(phi, y).p.x, part.at(phi, y).p.z);
  const point = (a, b, extra = 0) => part.at(phi + (a * wide) / 2 / r, y + (b * high) / 2, extra + lift * Math.sqrt((1 - a ** 6) * (1 - b ** 6))).p;
  const pos = [], uv = [], index = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 - 1, b = (j / n) * 2 - 1, p = point(a, b, 0.0015);
    pos.push(p.x, p.y, p.z); uv.push((a * wide) / 2, (b * high) / 2);
    if (i < n && j < n) { const k = i + j * (n + 1); index.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  part.group.add(cast(new THREE.Mesh(g, material)));
  return { point };
}

/** A flat band of cloth along a line on a surface. line(t) gives { p, n } for t in 0..1. */
function band(line, wide, thick, material, samples = 40) {
  const pos = [], uv = [], index = [], t3 = new THREE.Vector3(), side = new THREE.Vector3();
  let run = 0, before = null;
  for (let k = 0; k <= samples; k++) {
    const { p, n } = line(k / samples), a = line(Math.max(0, (k - 1) / samples)).p, b = line(Math.min(1, (k + 1) / samples)).p;
    t3.subVectors(b, a).normalize();
    side.crossVectors(n, t3).normalize();
    if (before) run += p.distanceTo(before);
    before = p;
    for (const [s, up] of [[1, thick], [-1, thick], [1, 0], [-1, 0]]) {
      pos.push(p.x + side.x * s * wide / 2 + n.x * up, p.y + side.y * s * wide / 2 + n.y * up, p.z + side.z * s * wide / 2 + n.z * up);
      uv.push(s * wide / 2 + (up ? 0 : s * thick), run);
    }
    if (k > 0) { const c = k * 4, d = c - 4; index.push(d, d + 1, c, d + 1, c + 1, c, d, c, d + 2, c, c + 2, d + 2, d + 1, d + 3, c + 1, c + 1, d + 3, c + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return cast(new THREE.Mesh(g, material));
}

/** A row of stitches along a line. line(t) gives a point for t in 0..1. */
function sew(stitches, line, { every = 0.034, long = 0.021, colour = CREAM, thick = 1 } = {}) {
  const n = 160, d = new THREE.Vector3();
  let a = line(0), since = every / 2;
  for (let k = 1; k <= n; k++) {
    const b = line(k / n);
    since += a.distanceTo(b);
    if (since >= every) { since -= every; stitches.add(b, d.subVectors(b, a), long, colour, thick); }
    a = b;
  }
}

export async function createDoll(fabrics, onProgress) {
  const man = await loadMan({ base: './figure/', onProgress });
  for (const mesh of man.meshes) mesh.visible = false;
  man.object.updateMatrixWorld(true);
  const B = man.bones, rand = rng(404);
  const at = (name) => new THREE.Vector3().setFromMatrixPosition(B[name].matrixWorld);

  // everything drawn is kept in his own space (as it was at the last pose) and the group is put where he is
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  const parts = []; // [what is drawn, the anchor on the skeleton it is put at]
  /** Hangs `object` on a bone, where and how it stands now (he is in the pose he was made in). */
  const hang = (object, bone, position, quaternion = new THREE.Quaternion(), scale = 1) => {
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    anchor.quaternion.copy(quaternion);
    anchor.scale.setScalar(scale);
    anchor.updateMatrix();
    B[bone].attach(anchor);
    object.matrixAutoUpdate = false;
    group.add(object);
    parts.push([object, anchor]);
    return anchor;
  };
  /** A stuffed limb from one joint to the next. `part.phi(direction)` is the angle round it that faces that way. */
  const limb = (from, to, radii, material, o = {}) => {
    const a = at(from), b = typeof to === 'string' ? at(to) : to;
    const d = new THREE.Vector3().subVectors(b, a), len = d.length() + (o.extend ?? 0);
    d.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d), back = q.clone().invert();
    const part = stuffed(len, radii, material, o);
    part.phi = (direction) => { const l = direction.clone().applyQuaternion(back); return Math.atan2(l.x, l.z); };
    hang(part.group, from, a, q);
    return part;
  };
  const two = { side: THREE.DoubleSide };

  const shirt = fabrics.cotton('stripes', ['#c2473d', CREAM, 10, 0.5], { size: 0.5 });
  const denim = fabrics.denim('#3d5a80'), denimOn = fabrics.denim('#3d5a80', two), turnUp = fabrics.denim('#93a9c4');
  const skin = fabrics.linen('#ecc9a4', { normalMap: fabrics.weaves.plain, normalScale: new THREE.Vector2(0.7, 0.7) });
  const leather = fabrics.felt('#6b4226'), sole = fabrics.felt('#3a2617');
  const cuffCloth = fabrics.cotton('solid', [CREAM], { size: 1 });
  const ribbon = fabrics.satin('#c2473d');
  const thread = fabrics.thread();
  const button = new THREE.MeshPhysicalMaterial({ color: '#f1e7cf', roughness: 0.3, clearcoat: 0.8 });
  const stitched = (part, radius = 0.004) => {
    const s = createStitches(thread, radius);
    part.finish = () => part.group.add(s.build());
    return s;
  };

  // --- the trunk, in two pieces as a rag doll's is: his dungarees up to the waist, and his chest in its shirt ---
  const hipsAt = at('pelvis').add(V(0, -0.09, 0.035));
  const hips = stuffed(0.33, [0.13, 0.185, 0.196, 0.19, 0.178], denim, { sx: 1.02, sz: 0.8, caps: [0.45, 0.25], turn: Math.PI });
  hang(hips.group, 'pelvis', hipsAt);
  {
    const s = stitched(hips);
    hips.group.add(band((t) => hips.at(t * TAU, 0.295), 0.05, 0.007, denimOn, 60));
    for (const y of [0.277, 0.313]) sew(s, (t) => hips.at(t * TAU, y, 0.009).p, { colour: GOLD });
    for (const side of [-1, 1]) {
      // a pocket on the seat, and the seam down his side
      const pocket = patchOn(hips, Math.PI + side * 0.62, 0.15, 0.105, 0.115, denimOn, 0.006);
      for (const [a0, b0, a1, b1] of [[-0.82, 0.8, -0.82, -0.8], [-0.82, -0.8, 0.82, -0.8], [0.82, -0.8, 0.82, 0.8], [-0.82, 0.8, 0.82, 0.8]]) sew(s, (t) => pocket.point(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 0.004), { colour: GOLD, every: 0.026, long: 0.017 });
      sew(s, (t) => hips.at(side * Math.PI / 2, 0.03 + 0.24 * t, 0.003).p, { colour: GOLD });
    }
    hips.finish();
  }
  const chestAt = at('spine_03').add(V(0, -0.26, 0.015));
  const chest = stuffed(0.45, [0.15, 0.166, 0.186, 0.186, 0.15, 0.078], shirt, { sx: 1.08, sz: 0.74, caps: [0.2, 0.55], period: 0.05, turn: Math.PI });
  hang(chest.group, 'spine_03', chestAt);
  {
    const s = stitched(chest);
    // the bib of his dungarees, its pocket, and the straps that go over his shoulders from its two buttons
    const bib = patchOn(chest, 0, 0.195, 0.215, 0.18, denimOn, 0.008, 11);
    for (const [a0, b0, a1, b1] of [[-0.9, 0.86, 0.9, 0.86], [-0.9, -1, -0.9, 0.86], [0.9, -1, 0.9, 0.86]]) sew(s, (t) => bib.point(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 0.004), { colour: GOLD, every: 0.026, long: 0.017 });
    for (const [a0, b0, a1, b1] of [[-0.42, 0.2, -0.42, -0.5], [-0.42, -0.5, 0.42, -0.5], [0.42, -0.5, 0.42, 0.2], [-0.42, 0.2, 0.42, 0.2]]) sew(s, (t) => bib.point(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, 0.004), { colour: GOLD, every: 0.022, long: 0.014 });
    const x0 = 0.125, yTop = (() => { let y = 0.3; while (y < 0.45 && chest.R(y) * 1.08 > x0 / 0.97) y += 0.002; return y; })();
    for (const side of [-1, 1]) {
      const over = (t) => {
        const front = t < 0.5, y = front ? 0.25 + (yTop - 0.25) * (t / 0.5) : yTop - (yTop - 0.03) * ((t - 0.5) / 0.5);
        // from the corner of the bib out to the middle of the shoulder, then in toward the small of his back
        const x = front ? 0.095 + (x0 - 0.095) * (t / 0.5) : x0 - (x0 - 0.07) * ((t - 0.5) / 0.5);
        const phi = Math.asin(Math.min(1, x / (chest.R(y) * 1.08)));
        return chest.at(side * (front ? phi : Math.PI - phi), y, 0.002);
      };
      chest.group.add(band(over, 0.05, 0.008, denimOn, 60));
      for (const off of [-0.017, 0.017]) sew(s, (t) => { const { p, n } = over(t); return p.addScaledVector(n, 0.011).add(V(off, 0, 0)); }, { colour: GOLD, every: 0.024, long: 0.015 });
      const b = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.009, 16).rotateX(Math.PI / 2), button));
      const { p, n } = over(0.035);
      b.position.copy(p).addScaledVector(n, 0.013);
      b.lookAt(b.position.clone().add(n));
      chest.group.add(b);
      s.add(b.position.clone().addScaledVector(n, 0.006), V(1, 1, 0), 0.016, '#b8433a', 0.8);
      s.add(b.position.clone().addScaledVector(n, 0.006), V(1, -1, 0), 0.016, '#b8433a', 0.8);
    }
    chest.finish();
    // the ribbon his cape is gathered into, tied in a bow under his chin
    const tie = new THREE.Group();
    const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 36).rotateX(Math.PI / 2), ribbon));
    ring.scale.set(1.1, 1.5, 0.84);
    tie.add(ring);
    for (const side of [-1, 1]) {
      const loop = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ribbon));
      loop.scale.set(0.05, 0.03, 0.017);
      loop.position.set(side * 0.052, 0.002, 0.094);
      loop.rotation.set(0, side * 0.45, side * 0.3);
      const tail = cast(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.006), ribbon));
      tail.position.set(side * 0.022, -0.06, 0.1);
      tail.rotation.set(-0.25, 0, side * 0.3);
      tie.add(loop, tail);
    }
    const knot = cast(new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), ribbon));
    knot.position.set(0, -0.004, 0.1);
    tie.add(knot);
    hang(tie, 'spine_03', at('neck_01').add(V(0, -0.02, 0.015)));
  }

  for (const s of ['l', 'r']) {
    const out = V(s === 'l' ? 1 : -1, 0, 0);
    // --- a leg: thigh and calf of the dungarees, the hem turned up, and a low felt boot ---
    const thigh = limb(`thigh_${s}`, `calf_${s}`, [0.118, 0.131, 0.121, 0.11], denim);
    const calf = limb(`calf_${s}`, `foot_${s}`, [0.11, 0.113, 0.108, 0.108], denim, { extend: -0.03 });
    for (const part of [thigh, calf]) {
      const st = stitched(part), phi = part.phi(out);
      for (const off of [-0.1, 0.1]) sew(st, (t) => part.at(phi + off, 0.02 + (part.len - 0.04) * t, 0.003).p, { colour: GOLD });
    }
    if (s === 'l') {
      // the knee he has been through, patched with a scrap
      const front = thigh.phi(FWD), scrap = patchOn(thigh, front, thigh.len - 0.1, 0.125, 0.13, fabrics.cotton('gingham', ['#c2473d'], { size: 0.35, ...two }), 0.007);
      const st = createStitches(thread, 0.0048);
      for (let i = 0; i < 16; i++) {
        const t = i / 16, a = t < 0.25 ? -1 + 8 * t : t < 0.5 ? 1 : t < 0.75 ? 1 - 8 * (t - 0.5) : -1, b = t < 0.25 ? 1 : t < 0.5 ? 1 - 8 * (t - 0.25) : t < 0.75 ? -1 : -1 + 8 * (t - 0.75);
        const p = scrap.point(a * 0.93, b * 0.93, 0.003), inward = scrap.point(a * 0.6, b * 0.6, 0.003).sub(p);
        st.add(p, inward, 0.026, CREAM, 1.1);
      }
      thigh.group.add(st.build());
    }
    thigh.finish();
    const turned = stuffed(0.075, [0.118, 0.121, 0.119], turnUp, { caps: [0.12, 0.12] });
    turned.group.position.y = calf.len - 0.085;
    calf.group.add(turned.group);
    calf.finish();
    {
      const boot = new THREE.Group();
      const BIG = 1.2, foot = at(`foot_${s}`), toes = at(`ball_${s}`).sub(foot).setY(0).normalize(), floor = -foot.y / BIG;
      const shaft = stuffed(0.11, [0.09, 0.087, 0.091], leather, { caps: [0.3, 0.2] });
      shaft.group.position.set(0, -0.055, -0.005);
      const body = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), leather));
      body.scale.set(0.088, 0.058, 0.152);
      body.position.set(0, floor + 0.064, 0.068);
      const toe = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), leather));
      toe.scale.set(0.086, 0.062, 0.085);
      toe.position.set(0, floor + 0.07, 0.145);
      const under = cast(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.024, 26), sole));
      under.scale.set(0.094, 1, 0.162);
      under.position.set(0, floor + 0.014, 0.068);
      const collar = cast(new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.012, 8, 24).rotateX(Math.PI / 2), leather));
      collar.position.set(0, 0.05, -0.005);
      boot.add(shaft.group, body, toe, under, collar);
      const st = createStitches(thread, 0.0048);
      // sewn to its sole all the way round, and laced over the instep
      for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; st.add(V(Math.sin(a) * 0.09, floor + 0.034, 0.068 + Math.cos(a) * 0.155), V(Math.cos(a) * 0.09, 0, -Math.sin(a) * 0.155), 0.022, CREAM, 1); }
      for (let i = 0; i < 3; i++) {
        const z = 0.045 + i * 0.034, y = floor + 0.064 + 0.058 * Math.sqrt(Math.max(0, 1 - ((z - 0.068) / 0.152) ** 2)) + 0.004 + (i === 2 ? 0.006 : 0);
        st.add(V(0, y, z), V(1, 0, 0.55), 0.05, CREAM, 1.1);
        st.add(V(0, y, z), V(1, 0, -0.55), 0.05, CREAM, 1.1);
      }
      boot.add(st.build());
      hang(boot, `foot_${s}`, foot, new THREE.Quaternion().setFromUnitVectors(FWD, toes), BIG);
    }

    // --- an arm: the shirt's sleeve in two lengths, a cuff with its button, and a mitten of a hand ---
    limb(`upperarm_${s}`, `lowerarm_${s}`, [0.097, 0.096, 0.087, 0.073], shirt, { period: 0.05 });
    const fore = limb(`lowerarm_${s}`, `hand_${s}`, [0.074, 0.082, 0.071, 0.06], shirt, { period: 0.05 });
    const cuff = stuffed(0.045, [0.066, 0.068, 0.066], cuffCloth, { caps: [0.15, 0.15] });
    cuff.group.position.y = fore.len - 0.04;
    const stud = cast(new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), button));
    stud.position.copy(cuff.at(fore.phi(out), 0.022, 0.004).p);
    cuff.group.add(stud);
    fore.group.add(cuff.group);
    {
      const hand = at(`hand_${s}`), reach = new THREE.Vector3().subVectors(hand, at(`lowerarm_${s}`)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, reach), back = q.clone().invert();
      const thumbWay = FWD.clone().applyQuaternion(back).setY(0).normalize(), flat = V(thumbWay.z, 0, -thumbWay.x);
      const mitt = new THREE.Group();
      const palm = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skin));
      palm.scale.set(0.066, 0.086, 0.066);
      palm.position.y = 0.075;
      // pressed flat across the palm, whichever way the hand was made
      palm.quaternion.setFromUnitVectors(V(0, 0, 1), flat);
      palm.scale.z = 0.05;
      const thumb = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skin));
      thumb.scale.set(0.026, 0.044, 0.026);
      thumb.position.copy(thumbWay).multiplyScalar(0.058).add(V(0, 0.062, 0));
      thumb.quaternion.setFromUnitVectors(UP, V(thumbWay.x * 0.6, 0.8, thumbWay.z * 0.6).normalize());
      mitt.add(palm, thumb);
      const st = createStitches(thread, 0.004);
      for (const face of [-1, 1]) for (const k of [-1, 0, 1]) {
        // the three stitches that stand for his fingers
        const across = thumbWay.clone().multiplyScalar(k * 0.022), y = 0.128 - Math.abs(k) * 0.006;
        const depth = 0.05 * Math.sqrt(Math.max(0, 1 - ((y - 0.075) / 0.086) ** 2 - (k * 0.022 / 0.066) ** 2));
        st.add(across.add(V(0, y, 0)).addScaledVector(flat, face * (depth + 0.002)), V(0, 1, 0).addScaledVector(flat, -face * 0.45), 0.036, '#c9a37f', 1);
      }
      mitt.add(st.build());
      hang(mitt, `hand_${s}`, hand, q, 1.12);
    }
  }

  // --- the head: stuffed linen, button eyes, a stitched smile, felt cheeks, wool hair ---
  const head = new THREE.Group();
  const R = 0.19;
  const ball = cast(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), skin));
  ball.scale.set(1, 0.96, 0.94);
  head.add(ball);
  const face = createStitches(thread, 0.007);
  const on = (x, y) => V(x, y, Math.sqrt(Math.max(0, R * R - x * x - y * y)) * 0.94);
  for (const s of [-1, 1]) {
    const eye = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#1c1a17', roughness: 0.25, clearcoat: 1 })));
    eye.position.copy(on(s * 0.068, 0.012)).add(V(0, 0, 0.004));
    eye.lookAt(eye.position.clone().multiplyScalar(2));
    head.add(eye);
    face.add(eye.position.clone().add(V(0, 0, 0.008)), V(1, 1, 0), 0.03, CREAM, 0.9);
    face.add(eye.position.clone().add(V(0, 0, 0.008)), V(1, -1, 0), 0.03, CREAM, 0.9);
    const cheek = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 14).rotateX(Math.PI / 2), fabrics.felt('#e58f86')));
    cheek.position.copy(on(s * 0.112, -0.05));
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    head.add(cheek);
  }
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6 - 0.5, x = t * 0.13, y = -0.075 + 0.11 * t * t * 4 * 0.25;
    face.add(on(x, y).add(V(0, 0, 0.004)), V(1, 0.9 * t, 0), 0.022, '#b8433a', 1);
  }
  head.add(face.build());
  {
    // hair: lengths of brown wool sewn on round the back and sides, hanging from under the hat
    const strand = new THREE.CylinderGeometry(0.013, 0.013, 1, 5).translate(0, -0.5, 0);
    const n = 150, hair = new THREE.InstancedMesh(strand, new THREE.MeshPhysicalMaterial({ roughness: 1, sheen: 1, sheenColor: new THREE.Color(0.4, 0.3, 0.2) }), n);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.32 + 1.36 * (i / (n - 1))) + (rand() - 0.5) * 0.08; // from in front of one ear, round the back, to the other
      const out = V(Math.sin(a), 0, Math.cos(a)), start = out.clone().multiplyScalar(R * 0.93).add(V(0, 0.07, 0));
      q.setFromUnitVectors(UP, V(-out.x * 0.28, 1, -out.z * 0.28).normalize());
      hair.setMatrixAt(i, M.compose(start, q, V(1 + rand() * 0.6, 0.2 + 0.1 * rand(), 1 + rand() * 0.6)));
      hair.setColorAt(i, c.set(rand() < 0.5 ? '#6b4226' : '#7d5230').multiplyScalar(0.8 + 0.4 * rand()));
    }
    head.add(cast(hair));
  }
  // a rag doll's head is big for him
  const BIG = 1.13;
  hang(head, 'Head', at('Head').add(V(0, 0.128, 0.012)), new THREE.Quaternion(), BIG);

  // --- the hat: felt, with a ribbon round the crown and a blanket-stitched brim ---
  const hat = new THREE.Group();
  const profile = [[0, 0.15], [0.05, 0.143], [0.095, 0.11], [0.118, 0.05], [0.125, 0.0], [0.19, -0.03], [0.255, -0.062], [0.31, -0.09]].map(([r, y]) => new THREE.Vector2(r, y));
  const crown = new THREE.LatheGeometry(profile, 30), cuv = crown.attributes.uv, cp = crown.attributes.position;
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 1.6, Math.hypot(cp.getX(i), cp.getZ(i)) + cp.getY(i));
  hat.add(cast(new THREE.Mesh(crown, fabrics.felt('#7b5a2e', two))));
  hat.add(fuzz(crown, 2600, { long: 0.022, colour: '#8a6838', thick: 0.55, lean: 0.7 }));
  const bandRibbon = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.127, 0.131, 0.035, 26, 1, true), ribbon));
  bandRibbon.position.y = 0.02;
  hat.add(bandRibbon);
  const brim = createStitches(thread, 0.006);
  for (let i = 0; i < 44; i++) { const a = (i / 44) * TAU; brim.add(V(Math.cos(a) * 0.294, -0.08, Math.sin(a) * 0.294), V(Math.cos(a), -0.5, Math.sin(a)), 0.03, '#efe6d2', 1); }
  hat.add(brim.build());
  // it sits on the back of his head, tipped up at the front so that his face shows
  const hatAnchor = hang(hat, 'Head', at('Head').add(V(0, 0.128 + R * BIG * 0.6, -0.034)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0, 0)), 1.5);

  // --- the cape: thick blue felt, drawn with both its faces and its cut edge, blanket stitched in cream ---
  const cape = new Cape(B);
  cape.hat = hatAnchor;
  const { cols, rows } = cape, count = cols * rows, THICK = 0.0075;
  const rim = []; // [point on the edge, its neighbour inward], going round
  for (let i = 0; i < cols; i++) rim.push([i, i + cols]);
  for (let j = 1; j < rows; j++) rim.push([cols - 1 + j * cols, cols - 2 + j * cols]);
  for (let i = cols - 2; i >= 0; i--) rim.push([i + (rows - 1) * cols, i + (rows - 2) * cols]);
  for (let j = rows - 2; j >= 1; j--) rim.push([j * cols, 1 + j * cols]);
  const edge = rim.length, total = 2 * count + 2 * edge;
  const shown = new Float32Array(total * 3), shownNormals = new Float32Array(total * 3), local = new Float32Array(count * 3), localNormals = new Float32Array(count * 3);
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.BufferAttribute(shown, 3).setUsage(THREE.DynamicDrawUsage));
  cloth.setAttribute('normal', new THREE.BufferAttribute(shownNormals, 3).setUsage(THREE.DynamicDrawUsage));
  {
    const uv = new Float32Array(total * 2), index = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = i + j * cols, [u, v] = cape.cut(i, j).map((x) => x * 1.8);
      uv.set([u, v], k * 2); uv.set([u, v], (k + count) * 2);
      if (i + 1 < cols && j + 1 < rows) index.push(k, k + 1, k + cols, k + 1, k + cols + 1, k + cols, k + count, k + count + cols, k + count + 1, k + count + 1, k + count + cols, k + count + cols + 1);
    }
    rim.forEach(([k], e) => {
      const [u, v] = cape.cut(k % cols, Math.floor(k / cols)).map((x) => x * 1.8);
      uv.set([u, v], (2 * count + e) * 2); uv.set([u + 0.015, v + 0.015], (2 * count + edge + e) * 2);
      const a = 2 * count + e, b = 2 * count + ((e + 1) % edge);
      index.push(a, b, a + edge, b, b + edge, a + edge);
    });
    cloth.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    cloth.setIndex(index);
  }
  const capeMesh = cast(new THREE.Mesh(cloth, fabrics.felt('#2f62a6', { ...two, normalScale: new THREE.Vector2(0.45, 0.45) })));
  capeMesh.frustumCulled = false;
  group.add(capeMesh);
  const hemmed = edge - (cols - 1), hemCount = hemmed * 2;
  const hem = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0045, 0.03, 2, 6), fabrics.thread('#efe6d2'), hemCount);
  hem.frustumCulled = false;
  hem.castShadow = true;
  group.add(hem);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3(), one = V(1, 1, 1);
  const inverse = new THREE.Matrix4(), turnBack = new THREE.Matrix3();

  function drawCape() {
    const e = inverse.elements, r = turnBack.elements, p = cape.p, nn = cape.normals;
    for (let k = 0; k < count * 3; k += 3) {
      const x = p[k], y = p[k + 1], z = p[k + 2], nx = nn[k], ny = nn[k + 1], nz = nn[k + 2];
      local[k] = e[0] * x + e[4] * y + e[8] * z + e[12]; local[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; local[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const lx = r[0] * nx + r[3] * ny + r[6] * nz, ly = r[1] * nx + r[4] * ny + r[7] * nz, lz = r[2] * nx + r[5] * ny + r[8] * nz;
      localNormals[k] = lx; localNormals[k + 1] = ly; localNormals[k + 2] = lz;
      const o = k + count * 3;
      shown[k] = local[k] + lx * THICK; shown[k + 1] = local[k + 1] + ly * THICK; shown[k + 2] = local[k + 2] + lz * THICK;
      shown[o] = local[k] - lx * THICK; shown[o + 1] = local[k + 1] - ly * THICK; shown[o + 2] = local[k + 2] - lz * THICK;
      shownNormals[k] = lx; shownNormals[k + 1] = ly; shownNormals[k + 2] = lz;
      shownNormals[o] = -lx; shownNormals[o + 1] = -ly; shownNormals[o + 2] = -lz;
    }
    // the cut edge faces the way the felt runs out
    rim.forEach(([k, inward], i) => {
      const o = (2 * count + i) * 3, u = (2 * count + edge + i) * 3;
      d.set(local[k * 3] - local[inward * 3], local[k * 3 + 1] - local[inward * 3 + 1], local[k * 3 + 2] - local[inward * 3 + 2]).normalize();
      for (let c = 0; c < 3; c++) {
        shown[o + c] = shown[k * 3 + c]; shown[u + c] = shown[(k + count) * 3 + c];
        shownNormals[o + c] = shownNormals[u + c] = d.getComponent(c);
      }
    });
    cloth.attributes.position.needsUpdate = true;
    cloth.attributes.normal.needsUpdate = true;
    for (let i = 0; i < hemCount; i++) {
      const f = cols - 1 + (i + 0.5) / 2, e0 = Math.floor(f), t = f - e0, [k0, in0] = rim[e0 % edge], [k1, in1] = rim[(e0 + 1) % edge];
      a.set(local[k0 * 3] + (local[k1 * 3] - local[k0 * 3]) * t, local[k0 * 3 + 1] + (local[k1 * 3 + 1] - local[k0 * 3 + 1]) * t, local[k0 * 3 + 2] + (local[k1 * 3 + 2] - local[k0 * 3 + 2]) * t);
      d.set(local[in0 * 3] + (local[in1 * 3] - local[in0 * 3]) * t, local[in0 * 3 + 1] + (local[in1 * 3 + 1] - local[in0 * 3 + 1]) * t, local[in0 * 3 + 2] + (local[in1 * 3 + 2] - local[in0 * 3 + 2]) * t).sub(a).normalize();
      n.set(localNormals[k0 * 3], localNormals[k0 * 3 + 1], localNormals[k0 * 3 + 2]);
      q.setFromUnitVectors(UP, d);
      hem.setMatrixAt(i, M.compose(a.addScaledVector(d, 0.018).addScaledVector(n, THICK + 0.003), q, one));
    }
    hem.instanceMatrix.needsUpdate = true;
  }

  return {
    man, group, cape,
    /** Moves the felt, every frame. */
    simulate(dt, air, ground) { cape.update(dt, air, ground); },
    /** Puts the doll where he is. Every frame, so that he never lags behind the player. */
    follow() { group.matrix.copy(man.object.matrixWorld); group.matrixWorldNeedsUpdate = true; },
    /** Takes his pose from the bones as they are now. Called as often as the film has frames. */
    pose() {
      inverse.copy(man.object.matrixWorld).invert();
      turnBack.setFromMatrix4(inverse);
      for (const [object, anchor] of parts) { object.matrix.multiplyMatrices(inverse, anchor.matrixWorld); object.matrixWorldNeedsUpdate = true; }
      if (cape.started) drawCape();
    },
  };
}
