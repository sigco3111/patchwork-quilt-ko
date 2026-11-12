// The country quilt: a small country sewn into one quilt, on the table it is being made on. A village round a
// church on its hill, a windmill, a river of ribbon, sheep, trees and washing, at the scale of the first small
// quilt: a patch is half as high as he is, and every stitch can be seen. The room is its sky (see room.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng } from '../fabric.js';
import { createStitches, fuzz, fuzzFrame } from '../sew.js';
import { sewQuilt } from '../quilt.js';
import { buildTiles, church, cottage, washing, windmill } from '../country/buildings.js';
import { bales, buildCones, buildPoms, clouds, coneTree, flowers, grass, lump, pomTree, river, sewingThings, sheep } from '../country/nature.js';
import { MILL, PATH, Q, RIVER, SITES, START, TABLE, ground, mound, onQuilt, site, toPath, toRiver, unsewn } from './land.js';
import { createRoom } from './room.js';
import { createWork } from './work.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function createWorld({ fabrics, renderer, scene, say, turn }) {
  const group = new THREE.Group(), rand = rng(4242);
  const memo = (make) => { const made = new Map(); return (hex) => made.get(hex) ?? (made.set(hex, make(hex)), made.get(hex)); };
  const beads = [], knitted = fabrics.weaves.knit.clone(), ribs = fabrics.weaves.cord.clone();
  ribs.repeat.set(26, 1);
  const twine = fabrics.weaves.cord.clone();
  twine.rotation = Math.PI / 2;
  twine.repeat.set(1, 14);
  const kit = {
    fabrics, group, rand, colliders: [], boxes: [], tiles: [], smokes: [], poms: [], cones: {}, trunks: [], onStep: [],
    mound, onQuilt, toRiver, toRoad: toPath, away: () => 0,
    stitches: createStitches(fabrics.thread()),
    bead: (at, r, colour) => beads.push([at.x, at.y, at.z, r, colour]),
    fuzz: (mesh, density, o) => mesh.add(fuzz(mesh.geometry, density, o)),
    felt: memo((hex) => fabrics.felt(hex)), feltTwo: memo((hex) => fabrics.felt(hex, { side: THREE.DoubleSide })),
    knit: memo((hex) => fabrics.wool(hex, { normalMap: knitted, normalScale: new THREE.Vector2(2.4, 2.4) })),
    ribbed: memo((hex) => fabrics.wool(hex, { normalMap: ribs, normalScale: new THREE.Vector2(2.6, 2.6) })),
    lit: fabrics.felt('#f3c75a', { emissive: new THREE.Color('#ff9a2e'), emissiveIntensity: 0.6 }),
    cotton: new THREE.MeshPhysicalMaterial({ color: '#fbfaf5', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 1 }),
    stick: new THREE.MeshStandardMaterial({ color: '#8f6f48', roughness: 0.85, normalMap: twine, normalScale: new THREE.Vector2(1.6, 1.6) }),
  };

  // --- what is built (each presses the quilt level where it stands, so every site is marked before anything is sewn) ---
  say('Building the village');
  await turn();
  const SLATE = ['#4f6278', '#5b6f86', '#6b819a', '#5b6f86', '#7b90a8'], THATCH = ['#b98a3a', '#c9a04a', '#d9b35a', '#b98a3a', '#a87a30', '#e3c06a'], RUST = ['#8e3a2a', '#b9482f', '#a23d2a', '#c8694a', '#b9482f', '#d9a43a'];
  const BUILT = [
    [church, { x: -2.6, z: -8.8, turn: 0.1 }],
    [cottage, { x: -9.6, z: -4.4, turn: 0.5, walls: '#efe2c4', roof: RUST }],
    [cottage, { x: 1.8, z: -4.9, turn: -0.45, walls: '#ecc8bf', roof: SLATE }],
    [cottage, { x: -4.4, z: -1.9, turn: 0.08, walls: '#f0d9a0', roof: THATCH, scale: 0.88 }],
    [windmill, { x: MILL.x, z: MILL.z, turn: -0.65 }],
    [washing, { x: -11, z: 1.6, turn: 0.25, length: 5 }],
  ];
  const room = new Map([[cottage, 3.0], [church, 4.4], [windmill, 3.2], [washing, 0]]);
  for (const [make, o] of BUILT) if (room.get(make)) site(o.x, o.z, room.get(make) * (o.scale ?? 1));
  for (const [make, o] of BUILT) make(kit, o);

  // --- the quilt ---
  say('Sewing the quilt');
  await turn();
  const quilt = sewQuilt(fabrics, Q, mound, { seed: 20261113, uneven: true, skip: unsewn, unbound: (x, z) => (z > 15 && x < -11.9) || (x < -20.5 && z > 7.6) });
  group.add(quilt.group);
  kit.surface = quilt.surface;
  // the binding stands up round the edge: whatever is laid across it rides over
  kit.rim = (x, z) => { const t = Math.min(1, Math.max(0, (Math.abs(Math.min(Q.w / 2 - Math.abs(x), Q.d / 2 - Math.abs(z))) - 0.16) / 0.5)); return 0.33 * (1 - t * t * (3 - 2 * t)); };
  await turn();
  river(kit, RIVER, 0.9, 0.2);

  // hedges: lengths of bobble trim sewn into a seam here and there
  {
    const bobbles = [], GREENS = ['#3f6f4c', '#4f8a4a', '#5d9a52', '#3a6b3f', '#6f9150', '#2f5f44', '#7fa262'];
    const clear = (x, z) => !unsewn(x, z) && !unsewn(x - 0.6, z + 0.6) && toPath(x, z) > 0.9 && toRiver(x, z) > 1 && Math.hypot(x - START.x, z - START.z) > 2 && SITES.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) > r * 0.85);
    const hedge = (a, b) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(len / 0.3), tone = GREENS[Math.floor(rand() * GREENS.length)];
      for (let k = 0; k <= n; k++) {
        const t = (k + 0.4 * rand()) / (n + 1), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, r = 0.13 + 0.07 * rand();
        if (clear(x, z)) bobbles.push(x, mound(x, z) + r * 0.7, z, r, tone);
      }
    };
    for (let j = 2; j < Q.nz - 1; j++) for (let i = 2; i < Q.nx - 1; i++) {
      // a hedge runs on for a few patches once it has begun
      if (rand() < 0.035) for (let k = 0, n = 2 + Math.floor(rand() * 3); k < n && i + k < Q.nx - 1; k++) hedge(quilt.corner(i + k, j), quilt.corner(i + k + 1, j));
      if (rand() < 0.035) for (let k = 0, n = 2 + Math.floor(rand() * 3); k < n && j + k < Q.nz - 1; k++) hedge(quilt.corner(i, j + k), quilt.corner(i, j + k + 1));
    }
    const ball = new THREE.IcosahedronGeometry(1, 2);
    ball.deleteAttribute('normal');
    ball.setAttribute('normal', ball.attributes.position.clone());
    const nap = fabrics.weaves.felt.clone();
    nap.repeat.set(3, 3);
    const mesh = new THREE.InstancedMesh(ball, new THREE.MeshPhysicalMaterial({ roughness: 1, normalMap: nap, normalScale: new THREE.Vector2(2, 2), sheen: 1, sheenColor: new THREE.Color(0.45, 0.55, 0.35), sheenRoughness: 0.8 }), bobbles.length / 5);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < bobbles.length / 5; i++) {
      const k = i * 5, r = bobbles[k + 3];
      q.setFromEuler(e.set(rand() * 6, rand() * 6, 0));
      mesh.setMatrixAt(i, M.compose(V(bobbles[k], bobbles[k + 1], bobbles[k + 2]), q, V(r, r * (0.85 + 0.25 * rand()), r)));
      mesh.setColorAt(i, c.set(bobbles[k + 4]).multiplyScalar(0.8 + 0.4 * rand()));
    }
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- what grows and grazes ---
  say('Winding pom-poms');
  await turn();
  const AUTUMN = ['#d9762f', '#e3a53a', '#c2473d'], GOLD = ['#e3b54a', '#d9a43a', '#f0dc9c'], GREEN = ['#5d9a52', '#7fb060', '#3f6f4c'], ROSE = ['#c2473d', '#d9765f', '#e4a8a2'], PLUM = ['#8a5a8a', '#b07aa6', '#6f4a7a'];
  for (const [x, z, r, h, c] of [[9.6, 9.4, 1.05, 1.7, AUTUMN], [-13.6, 8.4, 0.9, 1.5, GOLD], [-14.2, -7.6, 1.0, 1.6, GREEN], [8, -13.2, 0.85, 1.4, ROSE], [16.8, -2.6, 0.95, 1.5, GREEN], [-5.2, 11.8, 0.7, 1.1, ROSE], [17.6, 11.2, 0.8, 1.3, GOLD], [-18.2, -11.6, 0.9, 1.5, AUTUMN], [-0.4, -13, 0.8, 1.3, PLUM]]) pomTree(kit, x, z, r, h, c);
  const FIRS = [['#3f6f4c', '#4f8a4a', '#5d9a52'], ['#4f8a4a', '#5d9a52', '#6f9150'], ['#2f5f44', '#3f6f4c', '#4f8a4a'], ['#3f6f4c', '#5d9a52', '#6f9150']];
  [[-17.6, -4.8, 3.4], [-19, -2.2, 2.5], [-8.2, -12.9, 3.0], [-10.6, -13.6, 2.4], [17.9, -9.6, 3.1], [15.6, -12.4, 2.5], [18.6, 3.2, 2.7], [-10.2, 13.4, 2.4], [12.2, 12.9, 2.3], [-15.8, 5.6, 2.1]].forEach(([x, z, h], i) => coneTree(kit, x, z, h, FIRS[i % FIRS.length]));
  sheep(kit, -15.6, 1.4, 5, 2.2);
  sheep(kit, 13.6, 6.6, 4, 1.9);
  bales(kit, 10.4, 0.6, 4, 1.5, 0.62);
  const who = { value: V(0, -99, 0) }, sway = { value: 0 };
  const blades = grass(kit, [[-7.4, 8.2, 2.4], [8.6, -3.4, 1.8]], who, sway);
  flowers(kit, [[3, 9.4, 6, 0.8], [-1, 4.4, 5, 0.7], [-6.2, 6.2, 5, 0.7], [2.6, 2.4, 6, 0.8], [-12, -1.2, 5, 0.7], [7.4, 6.4, 6, 0.8], [11.5, -3.6, 5, 0.7], [-7.4, -9.6, 4, 0.6], [15, 9, 5, 0.7], [-11.2, 10.4, 5, 0.7], [1.4, -10.8, 4, 0.6], [18, -5.8, 5, 0.7], [-8.6, 12.6, 5, 0.7]]);
  clouds(kit, [[-10.5, 9.6, -12, 1.5, 1], [6.5, 10.6, -14.5, 1.8, 2], [16.5, 8.4, -9, 1.2, 3], [-17.5, 8.2, -4, 1.1, 4], [-1.5, 11.4, -9, 1.0, 5]], 0, 0.3, 0.45);

  // --- the table, the room, and what lies about ---
  say('Tidying the table');
  await turn();
  const LAMP = V(13.5, 12.6, -21), AIM = V(0, 1, -3);
  createRoom(kit, { lamp: LAMP, aim: AIM });
  const work = createWork(kit, quilt, { lamp: LAMP, aim: AIM });
  const drawn = new THREE.Vector2();
  const { spool, pincushion } = sewingThings(kit);
  spool(-25.2, 11.6, '#c2473d', 1.3);
  spool(-27, 13.8, '#e3b54a', 1.05);
  spool(25.2, 13.4, '#4f8a4a', 1.3);
  spool(27.2, 11, '#eadfc8', 1.1);
  spool(-25.4, -11.8, '#7a4a8a', 1.2);
  spool(24.6, -6.4, '#3f6f9a', 1.15);
  pincushion(-26.2, 3.4, 1.7);

  // --- gather up what was collected on the way ---
  buildTiles(kit);
  const strands = buildPoms(kit);
  buildCones(kit);
  {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6 }), beads.length);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    beads.forEach(([x, y, z, r, colour], i) => { mesh.setMatrixAt(i, M.makeScale(r, r, r).setPosition(x, y, z)); mesh.setColorAt(i, c.set(colour)); });
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.add(kit.stitches.build());
  // smoke from every chimney: tufts of cotton going up
  const tuft = lump(3.3, 3), smoke = [];
  for (const spot of kit.smokes) for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(tuft, kit.cotton); m.castShadow = true; group.add(m); smoke.push({ m, spot, i }); }
  kit.onStep.push((n) => smoke.forEach(({ m, spot, i }) => {
    const p = ((i + n * 0.045) / 5 + spot.at.x * 0.37) % 1, s = (0.14 + 0.3 * p) * Math.min(1, (1 - p) * 5) * Math.min(1, p * 6 + 0.25) * spot.scale;
    m.position.set(spot.at.x + 0.3 * Math.sin(p * 5 + i) * p, spot.at.y + p * 2.7, spot.at.z + 0.25 * Math.cos(p * 4 + i * 2) * p);
    m.scale.setScalar(s);
    m.rotation.set(i + n * 0.02, i * 2, 0);
  }));
  scene.add(group);

  // --- the light. A photograph of a small thing: one big soft lamp out of the picture in front and to the right,
  // which makes the shadows; the desk lamp in the picture, behind, which puts a warm edge on everything; and the
  // room's own light from all round ---
  scene.background = new THREE.Color('#1c1714');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight('#ffdcae', 3.5);
  key.position.set(15, 24, 13).normalize().multiplyScalar(70);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -34, right: 34, top: 27, bottom: -27, near: 5, far: 150 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  const edge = new THREE.DirectionalLight('#ffc48a', 1.5);
  edge.position.copy(LAMP).sub(AIM).normalize().multiplyScalar(60);
  const cool = new THREE.DirectionalLight('#a8c0ff', 0.45);
  cool.position.set(-18, 10, 6);
  scene.add(key, key.target, edge, cool);

  return {
    ground: (x, z) => (Math.abs(x) > TABLE.hw || Math.abs(z) > TABLE.hd ? -30 : ground(x, z)),
    field: { cells: 512, size: 136, centre: [0, 0] },
    colliders: kit.colliders, boxes: kit.boxes,
    start: { x: START.x, z: START.z, yaw: Math.PI },
    road: PATH,
    follow: { pitch: 0.13, want: 9.5, side: 1.15, lift: 1.0 },
    lens: { lens: 12, most: 15, reach: 0.5, deep: 0.75 },
    far: 500,
    counts: { ...quilt.counts, strands, blades, tiles: kit.tiles.length, sewn: kit.stitches.count },
    /** The parts that move do so a frame at a time, like everything in a film made by hand: n is the frame's number. */
    attach(post) { work.attach(post); },
    step(n) { for (const f of kit.onStep) f(n); sway.value = n * 0.21; fuzzFrame.value = Math.floor(n / 2); },
    update(dt, feet, camera) { who.value.copy(feet); work.update(dt, camera, renderer.getDrawingBufferSize(drawn).y); },
  };
}
