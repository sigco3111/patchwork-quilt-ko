// The quilt isn't finished. In its near left corner the top has not been pieced yet: the wadding shows, white and
// soft, ruled with tailor's chalk where the patches are to go; some patches are laid in their places and pinned,
// lifting at the corners; the needle is in the last seam, its thread running back to the spool; the binding stops
// short and the rest of it lies in a coil; and beside it on the mat are the squares still to come, in a stack,
// and the chalk. All over the rest of the quilt, here and there, a thread end has been left uncut.
// And in the lamp's light the dust of the room drifts, as it does over anything left out on a table.
import * as THREE from 'three';
import { rng } from '../fabric.js';
import { noise } from '../noise.js';
import { cast } from '../sew.js';
import { Q, SITES, mound, onQuilt, toRiver, toTape, unsewn } from './land.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), TAU = Math.PI * 2;

export function createWork(kit, quilt, { lamp, aim }) {
  const { fabrics, group } = kit, rand = rng(1907);
  const cell = (i, j) => [-Q.w / 2 + (i + 0.5) * Q.s, -Q.d / 2 + (j + 0.5) * Q.s];
  const open = [];
  for (let j = 0; j < Q.nz; j++) for (let i = 0; i < Q.nx; i++) { const [x, z] = cell(i, j); if (unsewn(x, z)) open.push([i, j, x, z]); }
  const wadded = (x, z) => mound(x, z) + 0.05 + 0.007 * noise(x * 2.7, z * 2.7 + 5);

  // --- the wadding ---
  {
    const pos = [], index = [], N = 5;
    for (const [, , cx, cz] of open) {
      const base = pos.length / 3;
      for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) { const x = cx + (a / N - 0.5) * Q.s, z = cz + (b / N - 0.5) * Q.s; pos.push(x, wadded(x, z), z); }
      for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) { const k = base + a + b * (N + 1); index.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const wadding = cast(new THREE.Mesh(g, kit.cotton));
    group.add(wadding);
    kit.fuzz(wadding, 520, { colour: '#fbfaf5', long: 0.06, thick: 1.2, seed: 91 });
  }

  // --- chalk: the lines the patches are to be laid to ---
  {
    const dashes = [];
    for (const [i, j] of open) {
      for (const [x0, z0, x1, z1] of [[0, 0, 1, 0], [0, 0, 0, 1]]) {
        const ax = -Q.w / 2 + (i + x0) * Q.s, az = -Q.d / 2 + (j + z0) * Q.s, bx = -Q.w / 2 + (i + x1) * Q.s, bz = -Q.d / 2 + (j + z1) * Q.s;
        for (let k = 0; k < 5; k++) { const t = (k + 0.5) / 5, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (onQuilt(x, z)) dashes.push(x + (rand() - 0.5) * 0.02, wadded(x, z) + 0.012, z + (rand() - 0.5) * 0.02, Math.atan2(bx - ax, bz - az) + (rand() - 0.5) * 0.08); }
      }
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.006, 0.15), new THREE.MeshStandardMaterial({ color: '#8fbbe6', roughness: 1 }), dashes.length / 4);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < dashes.length / 4; i++) mesh.setMatrixAt(i, M.compose(V(dashes[i * 4], dashes[i * 4 + 1], dashes[i * 4 + 2]), q.setFromAxisAngle(UP, dashes[i * 4 + 3]), V(1, 1, 0.7 + 0.5 * rand())));
    group.add(mesh);
  }

  // --- patches laid in place and pinned, and the squares still to come ---
  const cloths = [fabrics.cotton('gingham', ['#c2473d'], { size: 1.9 }), fabrics.cotton('dots', ['#3f6f4c'], { size: 1.9 }), fabrics.cotton('stripes', ['#d9a43a'], { size: 1.9 }), fabrics.cotton('ditsy', ['#a9c6d6', ['#f6f1e6', '#27405e', '#f0cf68'], '#3f7f6a'], { size: 1.9 }), fabrics.cotton('plaid', ['#7fa262', '#3f6f4c', '#e7d27a'], { size: 1.9 }), fabrics.cotton('ticking', ['#c2473d'], { size: 1.9 }), fabrics.cotton('solid', ['#eadfc8'], { size: 1.9 })];
  for (const m of cloths) m.side = THREE.DoubleSide;
  /** A cut square of cloth: nearly flat, its corners lifting as cut cotton does. `curl`: how much. */
  const square = (curl) => {
    const g = new THREE.PlaneGeometry(0.98, 0.98, 7, 7).rotateX(-Math.PI / 2), p = g.attributes.position, uv = g.attributes.uv, lift = [rand(), rand(), rand(), rand()], ox = rand() * 5, oz = rand() * 5;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 0.49, z = p.getZ(i) / 0.49, k = lift[(x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)];
      p.setY(i, curl * k * (Math.abs(x) * Math.abs(z)) ** 3 + 0.006 * Math.sin(x * 3 + ox) * Math.cos(z * 2.6 + oz));
      uv.setXY(i, p.getX(i) + ox, p.getZ(i) + oz);
    }
    g.computeVertexNormals();
    return g;
  };
  const pins = [];
  const HEADS = ['#f3ecdc', '#e3b54a', '#c2473d', '#a9c6d6', '#f0cf68', '#e4a8a2'];
  const n = V(0, 0, 0), q = new THREE.Quaternion();
  for (const [i, j, cx, cz] of open) {
    // those next to what is already sewn are the ones laid ready
    const [nx, nz] = cell(i + 1, j), [bx, bz] = cell(i, j - 1), next = !unsewn(nx, nz) || !unsewn(bx, bz);
    if (toTape(cx, cz) < 0.85 || rand() > (next ? 0.9 : 0.34)) continue;
    const x = cx + (rand() - 0.5) * 0.12, z = cz + (rand() - 0.5) * 0.12, y = wadded(x, z) + 0.038, k = 0.3;
    const patch = cast(new THREE.Mesh(square(0.05 + 0.1 * rand()), cloths[Math.floor(rand() * cloths.length)]));
    n.set(mound(x - k, z) - mound(x + k, z), 2 * k, mound(x, z - k) - mound(x, z + k)).normalize();
    patch.quaternion.setFromUnitVectors(UP, n).multiply(q.setFromAxisAngle(UP, (rand() - 0.5) * 0.22));
    patch.position.set(x, y, z);
    group.add(patch);
    // a pin through it: nearly flat, in and out of the cloth
    const a = rand() * TAU, dir = V(Math.cos(a), 0.2, Math.sin(a)).normalize();
    pins.push({ at: V(x - dir.x * 0.22 + (rand() - 0.5) * 0.3, y + 0.01, z - dir.z * 0.22 + (rand() - 0.5) * 0.3), dir, colour: HEADS[Math.floor(rand() * HEADS.length)] });
  }
  {
    const shafts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.5, 5).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 }), pins.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.062, 12, 9), new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }), pins.length);
    const M = new THREE.Matrix4(), c = new THREE.Color(), one = V(1, 1, 1);
    pins.forEach((p, i) => {
      q.setFromUnitVectors(UP, p.dir);
      shafts.setMatrixAt(i, M.compose(p.at, q, one));
      heads.setMatrixAt(i, M.compose(p.at.clone().addScaledVector(p.dir, 0.5), q, one));
      heads.setColorAt(i, c.set(p.colour));
    });
    group.add(cast(shafts), cast(heads));
  }
  // the stack of squares, on the mat beside the corner
  for (let k = 0; k < 16; k++) {
    const s = cast(new THREE.Mesh(square(k === 15 ? 0.12 : 0.012), cloths[(k * 3 + 1) % cloths.length]));
    s.position.set(-24.6 + (rand() - 0.5) * 0.08, 0.012 + k * 0.021, 14.6 + (rand() - 0.5) * 0.08);
    s.rotation.y = 0.3 + (rand() - 0.5) * 0.24;
    group.add(s);
  }
  for (let k = 0; k < 6; k++) {
    const s = cast(new THREE.Mesh(square(0.03), cloths[(k * 2) % cloths.length]));
    s.position.set(-22.9 + (rand() - 0.5) * 0.06, 0.012 + k * 0.021, 15.9 + (rand() - 0.5) * 0.06);
    s.rotation.y = -0.5 + (rand() - 0.5) * 0.3;
    group.add(s);
  }
  kit.colliders.push({ x: -24.6, z: 14.6, r: 0.6, h: 0.5 });
  // the chalk: a worn blue triangle of it
  {
    const chalk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.09, 3, 1), new THREE.MeshStandardMaterial({ color: '#7fb0e2', roughness: 1 })));
    chalk.position.set(-22.4, 0.05, 12.3);
    chalk.rotation.y = 0.7;
    group.add(chalk);
  }
  // what is left of the binding: a coil of it, and its end
  {
    const striped = fabrics.cotton('stripes', ['#27405e', '#eadfc8', 6, 0.5], { size: 1 });
    striped.map = striped.map.clone();
    striped.map.repeat.set(9, 1);
    const coil = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.26, 36, 1), striped));
    coil.position.set(-16.2, 0.14, 17.4);
    const core = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16, 1), new THREE.MeshStandardMaterial({ color: '#d8c7a0', roughness: 0.8 })));
    core.position.copy(coil.position);
    const tail = new THREE.CatmullRomCurve3([V(-15.5, 0.14, 17.55), V(-14.6, 0.1, 17.2), V(-13.6, 0.08, 16.5), V(-12.9, 0.08, 15.9), V(-12.4, 0.1, 15.45)]);
    const end = cast(new THREE.Mesh(new THREE.TubeGeometry(tail, 30, 0.125, 9, false), striped));
    end.scale.y = 0.6;
    group.add(coil, core, end);
    kit.colliders.push({ x: -16.2, z: 17.4, r: 0.72, h: 0.4 });
  }

  // --- the needle, in the last seam, and its thread back to the red spool ---
  {
    const at = [-12.75, 9.75], from = V(at[0], mound(...at) + 0.14, at[1]), lean = V(-0.5, 0.75, 0.42).normalize();
    const needle = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.004, 1.15, 7).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 1, roughness: 0.22 })));
    needle.position.copy(from);
    needle.quaternion.setFromUnitVectors(UP, lean);
    group.add(needle);
    const eye = from.clone().addScaledVector(lean, 0.84);
    const lie = (x, z, up = 0.03) => V(x, (onQuilt(x, z) ? wadded(x, z) : 0) + up, z);
    const line = new THREE.CatmullRomCurve3([eye, lie(-14.3, 10.4, 0.5), lie(-15.8, 10.2, 0.05), lie(-17.6, 11.4), lie(-19.4, 10.6), lie(-21.4, 11.5), lie(-23.2, 11.1), lie(-24.5, 11.5, 0.2), V(-25.05, 0.6, 11.6), V(-25.2, 1.0, 11.6)]);
    group.add(cast(new THREE.Mesh(new THREE.TubeGeometry(line, 140, 0.014, 5), fabrics.thread('#c2473d'))));
  }

  // --- thread ends left uncut, all over the finished part ---
  {
    const curl = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.02, 0.05, 0.01), V(0.07, 0.085, 0.0), V(0.13, 0.07, -0.03), V(0.17, 0.02, -0.02), V(0.2, 0.012, 0.03), V(0.19, 0.012, 0.08)]), 14, 0.008, 5);
    const ends = [];
    for (let k = 0; k < 4000 && ends.length < 260; k++) {
      const i = 1 + Math.floor(rand() * (Q.nx - 1)), j = 1 + Math.floor(rand() * (Q.nz - 1)), [cx, cz] = quilt.corner(i, j);
      const x = cx + (rand() < 0.5 ? -0.14 : 0.14), z = cz + (rand() < 0.5 ? -0.14 : 0.14);
      if (unsewn(x, z) || toRiver(x, z) < 0.7 || SITES.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r * 0.7)) continue;
      ends.push([x, mound(x, z) + 0.075, z]);
    }
    const mesh = new THREE.InstancedMesh(curl, fabrics.thread(), ends.length);
    const M = new THREE.Matrix4(), c = new THREE.Color(), e = new THREE.Euler();
    const THREADS = ['#e9dfc8', '#e9dfc8', '#efe8d8', '#b8433a', '#27405e', '#d9a43a'];
    ends.forEach(([x, y, z], i) => {
      const s = 0.8 + 1.1 * rand();
      mesh.setMatrixAt(i, M.compose(V(x, y, z), q.setFromEuler(e.set((rand() - 0.5) * 0.5, rand() * TAU, (rand() - 0.5) * 0.5)), V(s, 0.7 + 0.8 * rand(), s * (rand() < 0.5 ? -1 : 1))));
      mesh.setColorAt(i, c.set(THREADS[Math.floor(rand() * THREADS.length)]));
    });
    group.add(cast(mesh));
  }

  // --- dust in the lamp's light ---
  const dust = { value: 0 }, grain = { value: 1 }, depth = { value: null }, air = new THREE.Scene();
  {
    const COUNT = 620, pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT * 4), way = aim.clone().sub(lamp).normalize(), p = V(0, 0, 0);
    for (let i = 0; i < COUNT; i++) {
      // most of it where the lamp's beam is, some anywhere over the quilt
      if (rand() < 0.6) { const t = 4 + rand() * 20, r = 0.3 * t * Math.sqrt(rand()), a = rand() * TAU; p.copy(lamp).addScaledVector(way, t).add(V(Math.cos(a) * r, (rand() - 0.5) * r, Math.sin(a) * r)); }
      else p.set((rand() - 0.5) * 44, 0.6 + rand() * 9, -16 + rand() * 36);
      if (p.y < 0.5) p.y = 0.5 + rand() * 3;
      pos.set([p.x, p.y, p.z], i * 3);
      const off = p.clone().sub(lamp), along = off.dot(way), out = off.addScaledVector(way, -along).length();
      seed.set([rand(), rand(), rand(), (0.25 + 0.75 * rand()) * (along > 0 && out < 0.36 * along ? 1 : 0.3)], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const motes = new THREE.Points(g, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uTime: dust, uGrain: grain, tDepth: depth },
      vertexShader: /* glsl */ `
        in vec4 seed; uniform float uTime; uniform float uGrain; out float vGlow;
        void main() {
          vec3 p = position;
          float t = uTime;
          p.x += 0.7 * sin(t * (0.05 + 0.08 * seed.x) + seed.y * 6.28) + 0.2 * sin(t * 0.31 + seed.z * 6.28);
          p.y += 0.5 * sin(t * (0.04 + 0.07 * seed.z) + seed.x * 6.28) + 0.15 * cos(t * 0.27 + seed.y * 6.28);
          p.z += 0.7 * cos(t * (0.05 + 0.07 * seed.y) + seed.z * 6.28);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = uGrain * (0.014 + 0.03 * seed.x * seed.x) / -mv.z;
          gl_PointSize = clamp(size, 1.5, 30.0);
          // a mote close to the glass is a wide faint disc; one far off is a bright speck
          vGlow = seed.w * (0.55 + 0.45 * sin(t * (0.6 + seed.y) + seed.x * 40.0)) * min(1.0, 14.0 / (size * size + 1.0)) * 2.2;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDepth;
        in float vGlow; layout(location = 0) out vec4 outC;
        void main() {
          // it is drawn over the finished picture, so it has to ask for itself whether something is in front of it
          if (gl_FragCoord.z > texture(tDepth, gl_FragCoord.xy / vec2(textureSize(tDepth, 0))).r) discard;
          float d = length(gl_PointCoord - 0.5);
          outC = vec4(vec3(1.0, 0.86, 0.62) * vGlow * smoothstep(0.5, 0.2, d), 1.0);
        }`,
    }));
    motes.frustumCulled = false;
    air.add(motes);
  }
  return {
    /** The dust is drawn after the picture has been focused (or the blur of the far wall would swallow it): hand it to the camera. */
    attach(post) { depth.value = post.depth; post.overlay = air; },
    /** Every frame: the dust drifts on (it isn't part of the film; it is in the room). */
    update(dt, camera, height) { dust.value += dt; grain.value = camera.projectionMatrix.elements[5] * height * 0.5; },
  };
}
