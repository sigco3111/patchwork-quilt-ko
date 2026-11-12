// What stands on the quilt: a felt cottage on the hilltop, trees of two kinds (a wool pom-pom on a stick, and cones
// of felt with pinked hems), a satin ribbon for a stream, and cotton-wool clouds hung on threads. Every one is a
// thing somebody could cut, stuff and sew, and each is stitched where it would have to be.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './fabric.js';
import { noise } from './noise.js';
import { cast, clothUV, createStitches, strip, stuffedBox } from './sew.js';
import { HOUSE, mound, onQuilt } from './quilt.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** A lump of cotton wool: a ball that is nowhere quite round. */
function lump(seed, detail = 4) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  // (its corners are joined up first, so that it is lit as one soft thing and not as facets)
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.2 * noise(x * 1.7 + seed, y * 1.7 + z * 1.3) + 0.07 * noise(x * 4.1 + z * 3.3, y * 4.1 + seed) + 0.03 * noise(x * 9.0 + y * 7.0, z * 9.0 + seed);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function createScenery(fabrics) {
  const group = new THREE.Group();
  const rand = rng(5150);
  const colliders = [];
  const stitches = createStitches(fabrics.thread());
  const cotton = new THREE.MeshPhysicalMaterial({ color: '#fbfaf5', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 1 });
  const beads = []; // [x, y, z, radius, colour]
  const bead = (at, r, colour) => beads.push([at.x, at.y, at.z, r, colour]);

  // ================= the cottage =================
  const W = 2.7, H = 1.7, D = 2.2, RISE = 1.3;
  const house = new THREE.Group();
  house.position.set(HOUSE.x, mound(HOUSE.x, HOUSE.z) + 0.1, HOUSE.z);
  house.rotation.y = 0.32;
  house.updateMatrixWorld(true);
  const inHouse = (x, y, z) => V(x, y, z).applyMatrix4(house.matrixWorld);
  const turned = (x, y, z) => V(x, y, z).applyQuaternion(house.quaternion);
  const cream = fabrics.felt('#efe2c4');
  const walls = cast(new THREE.Mesh(stuffedBox(W, H, D, 0.08), cream));
  walls.position.y = H / 2;
  house.add(walls);
  {
    // the gable ends, cut in one with the walls
    const g = new THREE.BufferGeometry();
    const p = [], n = [], uv = [];
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.02);
      const tri = s > 0 ? [[x, H - 0.05, D / 2], [x, H - 0.05, -D / 2], [x, H + RISE - 0.12, 0]] : [[x, H - 0.05, -D / 2], [x, H - 0.05, D / 2], [x, H + RISE - 0.12, 0]];
      for (const v of tri) { p.push(...v); n.push(s, 0, 0); uv.push(v[2], v[1]); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const gables = cast(new THREE.Mesh(g, fabrics.felt('#efe2c4', { side: THREE.DoubleSide })));
    house.add(gables);
  }
  // blanket stitch down every corner, and a running stitch round the foot of the walls
  const RED = '#b8433a';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let y = 0.14; y < H - 0.08; y += 0.17) {
      stitches.add(inHouse(sx * (W / 2 + 0.014), y, sz * (D / 2 - 0.07)), turned(0, 0, 1), 0.13, RED, 1.15);
      stitches.add(inHouse(sx * (W / 2 - 0.07), y, sz * (D / 2 + 0.014)), turned(1, 0, 0), 0.13, RED, 1.15);
    }
  }
  for (const sz of [-1, 1]) stitches.run(inHouse(-W / 2 + 0.2, 0.13, sz * (D / 2 + 0.04)), inHouse(W / 2 - 0.2, 0.13, sz * (D / 2 + 0.04)), { colour: RED, every: 0.2, long: 0.11, lift: 0 });
  for (const sx of [-1, 1]) stitches.run(inHouse(sx * (W / 2 + 0.04), 0.13, -D / 2 + 0.2), inHouse(sx * (W / 2 + 0.04), 0.13, D / 2 - 0.2), { colour: RED, every: 0.2, long: 0.11, lift: 0 });

  // the roof: two slabs of felt, and row over row of scalloped felt tiles
  const EAVE = D / 2 + 0.3, slopeRise = RISE + 0.12, slopeLen = Math.hypot(slopeRise, EAVE), pitch = Math.atan2(slopeRise, EAVE);
  const tile = new THREE.CylinderGeometry(0.23, 0.23, 0.035, 14, 1, false, -Math.PI / 2, Math.PI);
  clothUV(tile);
  const tiles = [];
  const TILE = ['#b9482f', '#a23d2a', '#c8694a', '#b9482f', '#8e3a2a', '#d9a43a'];
  for (const s of [1, -1]) {
    const slab = cast(new THREE.Mesh(stuffedBox(W + 0.5, 0.1, slopeLen + 0.1, 0.015, 4), fabrics.felt('#8e3a2a')));
    slab.position.set(0, H - 0.12 + slopeRise / 2, (s * EAVE) / 2);
    slab.rotation.x = s * pitch;
    house.add(slab);
    const X = V(s, 0, 0), N = V(0, Math.cos(pitch), s * Math.sin(pitch)), DOWN = new THREE.Vector3().crossVectors(X, N);
    const eave = V(0, H - 0.12, s * EAVE);
    for (let row = 0; row < 8; row++) {
      const upSlope = 0.2 + row * 0.245, n = 8, step = (W + 0.5) / n;
      for (let i = 0; i < n + (row % 2); i++) {
        const x = -(W + 0.5) / 2 + (i + (row % 2 ? 0 : 0.5)) * step;
        if (Math.abs(x) > (W + 0.5) / 2 + 0.02) continue;
        const at = eave.clone().addScaledVector(DOWN, -upSlope).addScaledVector(N, 0.07 + row * 0.004).add(V(x + (rand() - 0.5) * 0.03, 0, 0));
        tiles.push({ at, X, N, DOWN, scale: 0.9 + 0.18 * rand(), colour: TILE[Math.floor(rand() * TILE.length)], lift: (rand() - 0.5) * 0.12 });
      }
    }
  }
  const tileMesh = new THREE.InstancedMesh(tile, fabrics.felt('#ffffff', { side: THREE.DoubleSide }), tiles.length);
  {
    const M = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Matrix4();
    tiles.forEach((t, i) => {
      M.makeBasis(t.X, t.N, t.DOWN);
      q.setFromRotationMatrix(M).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.1 + t.lift * 0.4)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), t.lift));
      tileMesh.setMatrixAt(i, e.compose(t.at, q, V(t.scale, 1, t.scale)));
      tileMesh.setColorAt(i, c.set(t.colour));
    });
  }
  house.add(cast(tileMesh));
  const ridge = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, W + 0.45, 4, 10).rotateZ(Math.PI / 2), fabrics.felt('#8e3a2a')));
  ridge.position.y = H + RISE + 0.02;
  house.add(ridge);
  for (let x = -W / 2 - 0.1; x < W / 2 + 0.15; x += 0.19) stitches.add(inHouse(x, H + RISE + 0.125, 0), turned(0, 0, 1), 0.12, '#efe6d2', 1.1);

  // the door, with a button for a knob, and a heart over it
  const FRONT = D / 2 + 0.085, doorX = -0.3;
  const brown = fabrics.felt('#7a4a2b');
  const door = cast(new THREE.Mesh(mergeGeometries([stuffedBox(0.64, 1.0, 0.05, 0.012, 3), clothUV(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.5, 0))]), brown));
  door.position.set(doorX, 0.56, FRONT + 0.02);
  house.add(door);
  for (const sx of [-1, 1]) stitches.run(inHouse(doorX + sx * 0.26, 0.12, FRONT + 0.05), inHouse(doorX + sx * 0.26, 1.06, FRONT + 0.05), { colour: '#efe6d2', every: 0.14, long: 0.08, lift: 0, thick: 0.8 });
  for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI; stitches.add(inHouse(doorX + Math.cos(a) * 0.26, 1.06 + Math.sin(a) * 0.26, FRONT + 0.05), turned(-Math.sin(a), Math.cos(a), 0), 0.08, '#efe6d2', 0.8); }
  bead(inHouse(doorX + 0.18, 0.6, FRONT + 0.075), 0.055, '#e3b54a');
  {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5); s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3); s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
    const heart = cast(new THREE.Mesh(clothUV(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 10 }).scale(0.26, 0.26, 0.26)), fabrics.felt('#c2473d')));
    heart.position.set(doorX, 1.5, FRONT - 0.005);
    house.add(heart);
  }
  // windows: a square of yellow felt with the lamp on behind it, barred with floss
  const lit = fabrics.felt('#f3c75a', { emissive: new THREE.Color('#ff9a2e'), emissiveIntensity: 0.55 });
  const windowAt = (x, y, z, turn) => {
    const w = new THREE.Group();
    w.add(cast(new THREE.Mesh(stuffedBox(0.6, 0.6, 0.04, 0.01, 3), lit)));
    for (const [sx, sy] of [[0.6, 0.055], [0.055, 0.6]]) { const bar = cast(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.03), brown)); bar.position.z = 0.03; w.add(bar); }
    w.position.set(x, y, z); w.rotation.y = turn;
    house.add(w);
    w.updateMatrixWorld(true);
    const at = (a, b) => V(a, b, 0.035).applyMatrix4(w.matrixWorld), way = (a, b) => V(a, b, 0).applyQuaternion(house.quaternion).applyAxisAngle(V(0, 1, 0), 0).applyAxisAngle(V(0, 1, 0), 0);
    for (const s of [-1, 1]) {
      stitches.run(at(-0.33, s * 0.33), at(0.33, s * 0.33), { colour: '#7a4a2b', every: 0.13, long: 0.08, lift: 0, thick: 0.85 });
      stitches.run(at(s * 0.33, -0.33), at(s * 0.33, 0.33), { colour: '#7a4a2b', every: 0.13, long: 0.08, lift: 0, thick: 0.85 });
    }
    void way;
  };
  windowAt(0.72, 0.98, FRONT + 0.012, 0);
  windowAt(W / 2 + 0.097, 0.98, 0.1, Math.PI / 2);
  windowAt(-W / 2 - 0.097, 0.98, -0.1, -Math.PI / 2);
  // the chimney
  const chimney = cast(new THREE.Mesh(stuffedBox(0.46, 1.0, 0.46, 0.03, 4), fabrics.felt('#a8543a')));
  chimney.position.set(0.72, H + RISE - 0.12, -0.52);
  house.add(chimney);
  const band = cast(new THREE.Mesh(stuffedBox(0.54, 0.14, 0.54, 0.02, 3), cream));
  band.position.set(0.72, H + RISE + 0.36, -0.52);
  house.add(band);
  group.add(house);
  const chimneyTop = inHouse(0.72, H + RISE + 0.5, -0.52);

  // smoke: tufts of cotton going up, moved a little each frame of the film
  const tuft = lump(3.3, 3);
  const smoke = Array.from({ length: 5 }, () => { const m = cast(new THREE.Mesh(tuft, cotton)); group.add(m); return m; });

  // ================= trees =================
  const twine = fabrics.weaves.cord.clone();
  twine.rotation = Math.PI / 2;
  twine.repeat.set(1, 14);
  const stick = new THREE.MeshStandardMaterial({ color: '#8f6f48', roughness: 0.85, normalMap: twine, normalScale: new THREE.Vector2(1.6, 1.6) });
  const strand = new THREE.CylinderGeometry(0.02, 0.03, 1, 5, 1, false).translate(0, 0.5, 0);
  const wool = new THREE.MeshPhysicalMaterial({ roughness: 1, sheen: 1, sheenColor: new THREE.Color(0.5, 0.5, 0.5), sheenRoughness: 0.9 });
  let strands = 0;
  function pomTree(x, z, r, h, colours) {
    const y0 = mound(x, z) + 0.08;
    const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, h, 10).translate(0, h / 2, 0), stick));
    trunk.position.set(x, y0, z);
    trunk.rotation.set((rand() - 0.5) * 0.08, rand() * 6, (rand() - 0.5) * 0.08);
    group.add(trunk);
    const centre = V(x, y0 + h + r * 0.72, z);
    const core = cast(new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 16, 12), fabrics.felt(colours[0])));
    core.position.copy(centre);
    group.add(core);
    const n = Math.round(3300 * r * r), mesh = new THREE.InstancedMesh(strand, wool, n);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), d = V(0, 0, 0), c = new THREE.Color(), white = new THREE.Color('#ffffff');
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u);
      d.set(Math.cos(a) * s, u, Math.sin(a) * s);
      const lean = d.clone().add(V(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3)).normalize();
      q.setFromUnitVectors(up, lean);
      const thick = 1 + rand() * 0.9;
      mesh.setMatrixAt(i, M.compose(centre.clone().addScaledVector(d, r * 0.3), q, V(thick, r * (0.66 + 0.12 * rand()), thick)));
      mesh.setColorAt(i, c.set(colours[Math.floor(rand() * rand() * colours.length)]).lerp(white, rand() * 0.16).multiplyScalar(0.8 + 0.3 * rand()));
    }
    group.add(cast(mesh));
    strands += n;
    colliders.push({ x, z, r: 0.3, h: h + 1 });
  }
  pomTree(6.9, 2.0, 1.05, 1.7, ['#d9762f', '#e3a53a', '#c2473d']);
  pomTree(8.5, 4.1, 0.8, 1.2, ['#e3b54a', '#d9a43a', '#f0dc9c']);
  pomTree(2.3, -5.7, 0.95, 1.5, ['#5d9a52', '#7fb060', '#3f6f4c']);
  pomTree(-8.9, 4.6, 0.85, 1.3, ['#c2473d', '#d9765f', '#e4a8a2']);
  pomTree(10.0, -4.6, 0.9, 1.4, ['#5d9a52', '#9fb88c', '#3f6f4c']);

  function coneTree(x, z, h, greens) {
    const y0 = mound(x, z) + 0.08, base = h * 0.3;
    const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 10).translate(0, 0.27, 0), new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.7 })));
    trunk.position.set(x, y0, z);
    group.add(trunk);
    for (let t = 0; t < 3; t++) {
      const R = base * (1 - t * 0.25), tall = h * 0.44, y = y0 + 0.4 + t * h * 0.25;
      const g = new THREE.CylinderGeometry(0.015, R, tall, 28, 5, true), p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        // the hem is cut with pinking shears
        if (p.getY(i) < -tall / 2 + 1e-4) { const k = Math.round((Math.atan2(p.getZ(i), p.getX(i)) / TAU) * 28); if (((k % 2) + 2) % 2) p.setY(i, p.getY(i) + 0.1); }
        uv.setXY(i, uv.getX(i) * TAU * R * 0.6, uv.getY(i) * tall);
      }
      g.translate(0, tall / 2, 0);
      g.computeVertexNormals();
      const cone = cast(new THREE.Mesh(g, fabrics.felt(greens[t % greens.length], { side: THREE.DoubleSide })));
      cone.position.set(x, y, z);
      cone.rotation.y = rand() * 6;
      group.add(cone);
      const at = 0.2, ring = R * (1 - at / tall) + 0.012, count = Math.round((TAU * ring) / 0.2), slope = V(R / tall, 0, 0);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        stitches.add(V(x + Math.cos(a) * ring, y + at, z + Math.sin(a) * ring), V(-Math.sin(a), 0, Math.cos(a)), 0.11, '#f3ecdc');
        if (i % 3 === 0 && t < 3) bead(V(x + Math.cos(a + 0.3) * (ring - 0.12 * slope.x * 2), y + at + 0.24, z + Math.sin(a + 0.3) * (ring - 0.12 * slope.x * 2)), 0.045, ['#e3b54a', '#c2473d', '#f3ecdc'][i % 9 / 3 | 0]);
      }
    }
    bead(V(x, y0 + 0.4 + 2 * h * 0.25 + h * 0.44 + 0.07, z), 0.11, '#e3b54a');
    colliders.push({ x, z, r: base * 0.8, h });
  }
  coneTree(-8.2, -3.6, 3.6, ['#3f6f4c', '#4f8a4a', '#5d9a52']);
  coneTree(-9.6, -1.2, 2.7, ['#4f8a4a', '#5d9a52', '#6f9150']);
  coneTree(-6.4, -5.6, 2.9, ['#2f5f44', '#3f6f4c', '#4f8a4a']);
  coneTree(4.6, -2.6, 3.1, ['#3f6f4c', '#5d9a52', '#6f9150']);
  coneTree(-5.0, 4.9, 2.3, ['#4f8a4a', '#6f9150', '#7fa262']);
  coneTree(-0.4, -6.9, 2.5, ['#2f5f44', '#4f8a4a', '#5d9a52']);

  // ================= the stream: a blue satin ribbon, laid down the valley and off the edge of the quilt =================
  {
    const lie = (x, z) => (onQuilt(x, z) ? mound(x, z) + 0.2 : 0.012);
    const pts = new THREE.CatmullRomCurve3([[1.6, -10.4], [2.6, -8.6], [3.3, -6.4], [2.3, -3.9], [3.5, -1.2], [2.6, 1.5], [3.9, 4.0], [3.0, 6.5], [3.7, 8.6], [4.6, 10.4], [7.0, 12.2], [10.5, 12.9]].map(([x, z]) => V(x, 0, z))).getPoints(260);
    const ribbon = cast(new THREE.Mesh(strip(pts, 0.86, lie, 0), fabrics.satin('#3f86c4')));
    group.add(ribbon);
    const sequins = [];
    pts.forEach((p, i) => {
      if (i === 0 || i === pts.length - 1) return;
      const t = V(pts[i + 1].x - pts[i - 1].x, 0, pts[i + 1].z - pts[i - 1].z).normalize(), side = V(-t.z, 0, t.x);
      for (const s of [-1, 1]) {
        const e = p.clone().addScaledVector(side, s * 0.37);
        if (i % 3 === 0 && onQuilt(e.x, e.z)) stitches.add(V(e.x, lie(e.x, e.z) + 0.012, e.z), t, 0.09, '#e6f0f7', 0.75);
      }
      if (i % 4 === 0) { const o = (rand() - 0.5) * 0.5, e = p.clone().addScaledVector(side, o); sequins.push(e.x, lie(e.x, e.z) + 0.016, e.z); }
    });
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 12), new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.2 }), sequins.length / 3);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < sequins.length / 3; i++) {
      q.setFromEuler(e.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5));
      mesh.setMatrixAt(i, M.compose(V(sequins[i * 3], sequins[i * 3 + 1], sequins[i * 3 + 2]), q, V(1, 1, 1).multiplyScalar(0.7 + 0.6 * rand())));
      mesh.setColorAt(i, c.set(['#dfe9f2', '#a9d0ee', '#ffffff', '#8fc0e8'][Math.floor(rand() * 4)]));
    }
    group.add(cast(mesh));
  }

  // ================= clouds of cotton wool, each hung on a thread =================
  const clouds = [];
  const wisp = new THREE.CylinderGeometry(0.004, 0.009, 1, 4).translate(0, 0.5, 0);
  const wispy = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  for (const [x, y, z, s, seed] of [[-7.5, 9.6, -5.5, 1.5, 1], [3.8, 11.2, -8, 1.9, 2], [11.5, 9.0, -3.5, 1.3, 3], [-12.5, 8.6, 1.5, 1.2, 4], [0.5, 9.4, -1.6, 0.9, 5]]) {
    const r = rng(seed * 91), parts = [];
    for (let i = 0; i < 6; i++) {
      const g = lump(seed * 10 + i);
      const k = 0.55 + 0.5 * r();
      g.scale(k * 1.15, k * 0.8, k);
      g.translate((i - 2.5) * 0.62 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.35 + (i === 2 || i === 3 ? 0.3 : 0), (r() - 0.5) * 0.6);
      parts.push(g);
    }
    const cloud = new THREE.Group();
    const body = mergeGeometries(parts);
    cloud.add(cast(new THREE.Mesh(body, cotton)));
    {
      // cotton wool is never a clean edge: fibres stand off it all over
      const bp = body.attributes.position, bn = body.attributes.normal, count = 2200, wisps = new THREE.InstancedMesh(wisp, wispy, count);
      const M = new THREE.Matrix4(), q2 = new THREE.Quaternion(), up = V(0, 1, 0);
      for (let i = 0; i < count; i++) {
        const k = Math.floor(r() * bp.count);
        const out = V(bn.getX(k), bn.getY(k), bn.getZ(k)).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.1)).normalize();
        q2.setFromUnitVectors(up, out);
        wisps.setMatrixAt(i, M.compose(V(bp.getX(k), bp.getY(k), bp.getZ(k)), q2, V(1, 0.05 + 0.1 * r() * r(), 1)));
      }
      cloud.add(wisps);
    }
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 40, 5).translate(0, 20.4, 0), fabrics.thread('#d8d2c4'));
    cloud.add(hang);
    cloud.scale.setScalar(s);
    cloud.position.set(x, y, z);
    cloud.userData = { y, seed };
    group.add(cloud);
    clouds.push(cloud);
  }

  // beads: knobs, baubles, the tops of trees
  {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6 }), beads.length);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    beads.forEach(([x, y, z, r, colour], i) => { mesh.setMatrixAt(i, M.makeScale(r, r, r).setPosition(x, y, z)); mesh.setColorAt(i, c.set(colour)); });
    group.add(cast(mesh));
  }
  group.add(stitches.build());

  // the cottage, for walking into: a box turned as it is
  const box = { x: house.position.x, y: house.position.y + H / 2, z: house.position.z, hx: W / 2 + 0.1, hy: H / 2 + 0.6, hz: D / 2 + 0.1, turn: house.rotation.y };

  return {
    group, colliders, box, counts: { strands, stitches: stitches.count },
    /** The parts that move do so a frame at a time, like everything in a film made by hand: n is the frame's number. */
    step(n) {
      smoke.forEach((m, i) => {
        const p = ((i + n * 0.045) / smoke.length) % 1, s = (0.16 + 0.34 * p) * Math.min(1, (1 - p) * 5) * Math.min(1, p * 6 + 0.25);
        m.position.set(chimneyTop.x + 0.3 * Math.sin(p * 5 + i) * p, chimneyTop.y + p * 2.7, chimneyTop.z + 0.25 * Math.cos(p * 4 + i * 2) * p);
        m.scale.setScalar(s);
        m.rotation.set(i + n * 0.02, i * 2, 0);
      });
      clouds.forEach((c) => {
        c.position.y = c.userData.y + 0.1 * Math.sin(n * 0.05 + c.userData.seed * 2);
        c.rotation.y = 0.12 * Math.sin(n * 0.03 + c.userData.seed);
      });
    },
  };
}
