// Small things every sewn object needs: stitches, cloth cut in a strip, and UVs laid in world units so that a
// fabric's weave is the same size on everything.
import * as THREE from 'three';

/** Collects stitches (short round pieces of thread lying on a surface) and makes one mesh of them. */
export function createStitches(material, radius = 0.012) {
  const list = [];
  const up = new THREE.Vector3(0, 1, 0);
  return {
    /** at: its middle; along: the way it runs; length; colour; thick: times the usual thickness. */
    add(at, along, length, colour = '#efe6d2', thick = 1) { list.push({ at: at.clone(), along: along.clone().normalize(), length, colour, thick }); },
    /** A row of running stitches from a to b (points on the surface), lifted `lift` off it. */
    run(a, b, { every = 0.17, long = 0.1, colour, thick = 1, lift = 0.01, normal = up } = {}) {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length(), n = Math.max(1, Math.floor(len / every));
      d.normalize();
      for (let i = 0; i < n; i++) this.add(new THREE.Vector3().copy(a).addScaledVector(d, (i + 0.5) * (len / n)).addScaledVector(normal, lift), d, long, colour, thick);
    },
    build() {
      const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(radius, 0.1 - radius * 2, 2, 6), material, list.length);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      list.forEach((s, i) => {
        q.setFromUnitVectors(up, s.along);
        mesh.setMatrixAt(i, M.compose(s.at, q, new THREE.Vector3(s.thick, s.length / 0.1, s.thick)));
        mesh.setColorAt(i, c.set(s.colour));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      return mesh;
    },
    get count() { return list.length; },
  };
}

/** UVs in the units of the model, taken from whichever way each face looks. */
export function clothUV(geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.set([p.getZ(i), p.getY(i)], i * 2);
    else if (ay >= az) uv.set([p.getX(i), p.getZ(i)], i * 2);
    else uv.set([p.getX(i), p.getY(i)], i * 2);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** A box that has been stuffed: every face bulges like a small cushion. */
export function stuffedBox(w, h, d, bulge = 0.08, seg = 10) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal;
  const pillow = (a, b) => (1 - a ** 4) * (1 - b ** 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2), z = p.getZ(i) / (d / 2);
    const k = bulge * (Math.abs(n.getX(i)) > 0.5 ? pillow(y, z) : Math.abs(n.getY(i)) > 0.5 ? pillow(x, z) : pillow(x, y));
    p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k);
  }
  clothUV(g);
  g.computeVertexNormals();
  return g;
}

/**
 * A strip of cloth (a ribbon, a tape) along a line of points. width; height(x, z) gives the surface it lies on.
 * UV: u across 0..1, v along in units.
 */
export function strip(points, width, height, lift = 0.02) {
  const pos = [], uv = [], index = [];
  let run = 0;
  const t = new THREE.Vector3();
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    t.set(b.x - a.x, 0, b.z - a.z).normalize();
    if (i > 0) run += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    for (const side of [-1, 1]) {
      const x = p.x - t.z * side * width / 2, z = p.z + t.x * side * width / 2;
      pos.push(x, (p.y ?? 0) + height(x, z) + lift, z);
      uv.push(side * 0.5 + 0.5, run);
    }
    if (i > 0) { const k = i * 2; index.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A ribbon or a tape lying along a line of points on whatever is under it: like strip(), but with `across` panels
 * over its width (and each length cut in `sub`), every corner asking height(x, z) for itself, so that it follows a
 * lumpy quilt and doesn't cut through it. UV: u across 0..1, v along in units.
 */
export function ribbon(points, width, height, { across = 6, sub = 1, lift = 0 } = {}) {
  const line = [];
  points.forEach((p, i) => { if (i) for (let k = 1; k < sub; k++) line.push(new THREE.Vector3().lerpVectors(points[i - 1], p, k / sub)); line.push(p); });
  const pos = [], uv = [], index = [], t = new THREE.Vector3(), n = across + 1;
  let run = 0;
  line.forEach((p, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    t.set(b.x - a.x, 0, b.z - a.z).normalize();
    if (i > 0) run += Math.hypot(p.x - line[i - 1].x, p.z - line[i - 1].z);
    for (let k = 0; k <= across; k++) {
      const s = k / across - 0.5, x = p.x - t.z * s * width, z = p.z + t.x * s * width;
      pos.push(x, height(x, z) + lift, z);
      uv.push(k / across, run);
    }
    if (i > 0) for (let k = 0; k < across; k++) { const c = i * n + k, d = c - n; index.push(d, d + 1, c, d + 1, c + 1, c); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * What is printed on a tape measure: two hundred centimetres of it, to lie along `length` units of a strip whose
 * v runs in units. The picture is long and narrow like the tape, so that the marks and figures stay sharp.
 * `squeeze`: how much narrower a figure is drawn so that it comes out the right shape (a pixel is longer along
 * the tape than across it).
 */
export function tapeTexture(length, squeeze = 0.4) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 8192;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  let seed = 4;
  const r = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = '#f0c12e'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '120,80,0' : '255,240,170'},${r() * 0.07})`; ctx.fillRect(0, r() * H, W, 1 + r() * 3); }
  ctx.fillStyle = '#1c1a17';
  ctx.font = 'bold 108px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let cm = 0; cm < 200; cm++) {
    const y = (cm / 200) * H, long = cm % 10 === 0 ? 0.34 : cm % 5 === 0 ? 0.24 : 0.14;
    ctx.fillRect(0, y - 1.5, W * long, 3.2);
    if (cm % 10 === 5) { ctx.save(); ctx.translate(W * 0.62, y); ctx.rotate(Math.PI / 2); ctx.scale(squeeze, 1); ctx.fillText(String(cm + 5), 0, 0); ctx.restore(); }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;
  map.repeat.set(1, 1 / length);
  return map;
}

export const cast = (mesh, receive = true) => { mesh.castShadow = true; mesh.receiveShadow = receive; return mesh; };

let FIBRE = null, FIBRES = null;
/** Fuzz is never still from one frame of a film to the next: set this to the frame's number and every fibre lies a little differently. */
export const fuzzFrame = { value: 0 };
/**
 * Fuzz: felt and wool are never a clean edge, fibres stand off them all over. Scatters `density` short fibres to
 * the square unit over a geometry's faces, each leaning its own way from the way the face looks, and returns them
 * as one mesh in the geometry's own space (add it to whatever the geometry is drawn by).
 */
export function fuzz(geometry, density, { long = 0.05, colour = '#ffffff', lean = 0.9, seed = 7, thick = 1 } = {}) {
  FIBRE ??= new THREE.CylinderGeometry(0.0012, 0.0032, 1, 3, 1, true).translate(0, 0.5, 0);
  if (!FIBRES) {
    FIBRES = new THREE.MeshStandardMaterial({ roughness: 1 });
    FIBRES.onBeforeCompile = (s) => {
      s.uniforms.uBoil = fuzzFrame;
      s.vertexShader = 'uniform float uBoil;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 root = instanceMatrix[3].xyz;
          vec2 jig = fract(sin(vec2(dot(root, vec3(127.1, 311.7, 74.7)) + uBoil * 17.0, dot(root, vec3(269.5, 183.3, 246.1)) + uBoil * 29.0)) * 43758.5453) - 0.5;
          transformed.xz += jig * 0.55 * position.y * length(instanceMatrix[1].xyz) / max(length(instanceMatrix[0].xyz), 1e-4);
        #endif`);
    };
  }
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, index = geometry.index;
  const tris = (index ? index.count : pos.count) / 3, corner = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const sums = new Float32Array(tris);
  let area = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, corner(t, 0)); b.fromBufferAttribute(pos, corner(t, 1)); c.fromBufferAttribute(pos, corner(t, 2));
    area += b.sub(a).cross(c.sub(a)).length() / 2;
    sums[t] = area;
  }
  const count = Math.round(area * density), mesh = new THREE.InstancedMesh(FIBRE, FIBRES, count);
  let s = seed >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), tone = new THREE.Color(), base = new THREE.Color(colour), white = new THREE.Color('#ffffff');
  for (let i = 0; i < count; i++) {
    const want = rand() * area;
    let lo = 0, hi = tris - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sums[mid] < want) lo = mid + 1; else hi = mid; }
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const i0 = corner(lo, 0), i1 = corner(lo, 1), i2 = corner(lo, 2);
    a.fromBufferAttribute(pos, i0).multiplyScalar(1 - u - v).addScaledVector(b.fromBufferAttribute(pos, i1), u).addScaledVector(c.fromBufferAttribute(pos, i2), v);
    n.fromBufferAttribute(nor, i0).multiplyScalar(1 - u - v).addScaledVector(b.fromBufferAttribute(nor, i1), u).addScaledVector(c.fromBufferAttribute(nor, i2), v);
    n.x += (rand() - 0.5) * 2 * lean; n.y += (rand() - 0.5) * 2 * lean; n.z += (rand() - 0.5) * 2 * lean;
    q.setFromUnitVectors(up, n.normalize());
    mesh.setMatrixAt(i, M.compose(a, q, b.set(thick * (0.7 + 0.9 * rand()), long * (0.35 + 0.9 * rand() * rand()), thick)));
    mesh.setColorAt(i, tone.copy(base).lerp(white, 0.1 + 0.3 * rand()).multiplyScalar(0.85 + 0.35 * rand()));
  }
  mesh.frustumCulled = false;
  return mesh;
}
