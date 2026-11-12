// Patchwork country: the whole valley, put together. A hill to stand on, a tape-measure road down it and across
// the fields to a village round a church, a farm, a windmill, a river of ribbon, woods of pom-poms and felt, and
// knitted mountains under a dyed sky with the sun low in it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng } from '../fabric.js';
import { createStitches } from '../sew.js';
import { FARM, MILL, Q, RIVER, ROAD, SITES, START, VILLAGE, away, ground, mound, onQuilt, site, toRiver, toRoad } from './land.js';
import { createFields } from './fields.js';
import { buildTiles, church, cottage, washing, windmill } from './buildings.js';
import { bales, buildCones, buildPoms, clouds, coneTree, flowers, grass, lump, mountain, pomTree, river, road, sewingThings, sheep, sky } from './nature.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Where the sun is, from anywhere in the valley: low, ahead and a little to the left as he looks out from the hill. */
const SUN = V(-0.37, 0.3, -0.88).normalize();

export async function createWorld({ fabrics, renderer, scene, say, turn }) {
  const group = new THREE.Group(), rand = rng(77001);
  const memo = (make) => { const made = new Map(); return (hex) => made.get(hex) ?? (made.set(hex, make(hex)), made.get(hex)); };
  const beads = [], knitted = fabrics.weaves.knit.clone();
  const twine = fabrics.weaves.cord.clone();
  twine.rotation = Math.PI / 2;
  twine.repeat.set(1, 14);
  const kit = {
    fabrics, group, rand, colliders: [], boxes: [], tiles: [], smokes: [], poms: [], cones: {}, trunks: [], onStep: [],
    mound, away, toRoad, toRiver, onQuilt,
    stitches: createStitches(fabrics.thread()),
    bead: (at, r, colour) => beads.push([at.x, at.y, at.z, r, colour]),
    felt: memo((hex) => fabrics.felt(hex)), feltTwo: memo((hex) => fabrics.felt(hex, { side: THREE.DoubleSide })),
    knit: memo((hex) => fabrics.wool(hex, { normalMap: knitted, normalScale: new THREE.Vector2(2.4, 2.4) })),
    lit: fabrics.felt('#f3c75a', { emissive: new THREE.Color('#ff9a2e'), emissiveIntensity: 1.25 }),
    cotton: new THREE.MeshPhysicalMaterial({ color: '#fbfaf5', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 1 }),
    stick: new THREE.MeshStandardMaterial({ color: '#8f6f48', roughness: 0.85, normalMap: twine, normalScale: new THREE.Vector2(1.6, 1.6) }),
  };

  // --- what is built (first: each presses the ground level where it stands, before the fields are cut) ---
  say('Building the village');
  await turn();
  const SLATE = ['#4f6278', '#5b6f86', '#6b819a', '#5b6f86', '#7b90a8'], THATCH = ['#b98a3a', '#c9a04a', '#d9b35a', '#b98a3a', '#a87a30', '#e3c06a'], RUST = ['#8e3a2a', '#b9482f', '#a23d2a', '#c8694a', '#b9482f', '#d9a43a'];
  const BUILT = [
    [cottage, { x: VILLAGE.x - 7.5, z: VILLAGE.z + 1.5, turn: 0.85, walls: '#efe2c4', roof: RUST }],
    [cottage, { x: VILLAGE.x + 7.5, z: VILLAGE.z + 2, turn: -0.8, walls: '#ecc8bf', roof: SLATE, wide: 3.0 }],
    [cottage, { x: VILLAGE.x - 6, z: VILLAGE.z - 6, turn: 0.4, walls: '#f0d9a0', roof: RUST, scale: 0.92 }],
    [cottage, { x: VILLAGE.x + 9.5, z: VILLAGE.z - 5.5, turn: -0.45, walls: '#cfdccb', roof: THATCH }],
    [cottage, { x: VILLAGE.x - 14, z: VILLAGE.z - 2.5, turn: 1.1, walls: '#c9d8e6', roof: RUST, scale: 0.88, heart: false }],
    [cottage, { x: VILLAGE.x + 15.5, z: VILLAGE.z + 4.5, turn: -1.2, walls: '#efe2c4', roof: THATCH, scale: 0.9, heart: false }],
    [church, { x: VILLAGE.x + 2.2, z: VILLAGE.z - 8.5, turn: 0.06 }],
    [cottage, { x: FARM.x, z: FARM.z, turn: 1.25, walls: '#efe2c4', roof: THATCH, wide: 3.2 }],
    [washing, { x: FARM.x + 4.5, z: FARM.z + 6.5, turn: 0.35 }],
    [windmill, { x: MILL.x, z: MILL.z, turn: 0.45 }],
    [cottage, { x: 41, z: 27, turn: -0.75, walls: '#ecc8bf', roof: RUST }],
    [cottage, { x: -24, z: -63, turn: 0.3, walls: '#efe2c4', roof: SLATE, heart: false }],
    [cottage, { x: 38, z: -68, turn: -0.3, walls: '#f0d9a0', roof: RUST, heart: false }],
    [cottage, { x: 47, z: -14, turn: -0.9, walls: '#cfdccb', roof: RUST, scale: 0.9, heart: false }],
  ];
  const room = new Map([[cottage, 3.6], [church, 5.2], [windmill, 4.5], [washing, 0]]);
  for (const [make, o] of BUILT) if (room.get(make)) site(o.x, o.z, room.get(make) * (o.scale ?? 1));
  for (const [make, o] of BUILT) make(kit, o);

  // --- the land ---
  say('Piecing the fields');
  await turn();
  const fields = createFields(fabrics);
  group.add(fields.group);
  await turn();
  river(kit, RIVER);
  road(kit, ROAD);

  // --- what grows ---
  say('Winding pom-poms');
  await turn();
  const AUTUMN = ['#d9762f', '#e3a53a', '#c2473d'], GOLD = ['#e3b54a', '#d9a43a', '#f0dc9c'], GREEN = ['#5d9a52', '#7fb060', '#3f6f4c'], ROSE = ['#c2473d', '#d9765f', '#e4a8a2'], LIME = ['#8fb15c', '#b9c96a', '#5d9a52'], PLUM = ['#8a5a8a', '#b07aa6', '#6f4a7a'];
  const FIRS = [['#3f6f4c', '#4f8a4a', '#5d9a52'], ['#4f8a4a', '#5d9a52', '#6f9150'], ['#2f5f44', '#3f6f4c', '#4f8a4a'], ['#3f6f4c', '#5d9a52', '#6f9150']];
  // on the hilltop, to either side of the view
  pomTree(kit, START.x + 6.2, START.z - 4.5, 1.4, 2.4, AUTUMN);
  coneTree(kit, START.x - 7.6, START.z - 5.5, 4.4, FIRS[0]);
  coneTree(kit, START.x - 10, START.z - 2.5, 3.4, FIRS[1]);
  coneTree(kit, START.x + 10.5, START.z - 0.5, 3.0, FIRS[2]);
  // down the road
  for (const [x, z, r, h, c] of [[9.5, 39, 1.05, 1.7, GOLD], [-12.5, 33, 1.15, 1.9, GREEN], [-2.5, 17.5, 1.0, 1.6, ROSE], [5.5, 10.5, 0.95, 1.5, LIME], [10.5, -3.5, 1.1, 1.8, AUTUMN], [0, -11, 0.9, 1.5, GREEN], [12.5, -15, 1.0, 1.7, GOLD], [VILLAGE.x + 0.5, VILLAGE.z + 4.5, 0.9, 1.5, PLUM]]) pomTree(kit, x, z, r, h, c);
  // an orchard
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) pomTree(kit, 20 + i * 2.6 + (j % 2) * 0.8, 13 + j * 2.5, 0.62, 1.0, j % 2 ? ROSE : ['#d9765f', '#e4a8a2', '#f0cf68'], 0.3);
  // and everywhere else, where a tree is a ball of colour on a stick: singly in the fields, in woods on the hills
  const free = (x, z, gap) => onQuilt(x, z) && toRoad(x, z) > gap && toRiver(x, z) > 3 && SITES.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) > r + 1) && Math.min(x - Q.x0, Q.x1 - x, z - Q.z0, Q.z1 - z) > 6;
  for (let i = 0, placed = 0; placed < 54 && i < 2000; i++) {
    const x = Q.x0 + rand() * (Q.x1 - Q.x0), z = Q.z0 + rand() * (Q.z1 - Q.z0);
    if (!free(x, z, 4) || away(x, z) < 12 || Math.hypot(x - START.x, z - START.z) < 16) continue;
    pomTree(kit, x, z, 1.0 + rand() * 0.9, 1.5 + rand() * 1.1, [AUTUMN, GOLD, GREEN, GREEN, LIME, ROSE, GREEN, PLUM][Math.floor(rand() * 8)], 0.2);
    placed++;
  }
  for (let i = 0, placed = 0; placed < 96 && i < 6000; i++) {
    const x = Q.x0 + rand() * (Q.x1 - Q.x0), z = Q.z0 + rand() * (Q.z1 - Q.z0);
    // firs like high ground, and each other
    if (!free(x, z, 5) || mound(x, z) < 4.6 + 3 * rand() || Math.hypot(x - START.x, z - START.z) < 13) continue;
    for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) {
      const tx = x + (rand() - 0.5) * 5, tz = z + (rand() - 0.5) * 5;
      if (free(tx, tz, 5)) { coneTree(kit, tx, tz, 2.6 + rand() * 2.4, FIRS[Math.floor(rand() * FIRS.length)]); placed++; }
    }
  }
  sheep(kit, 12, 21, 10, 5.5);
  sheep(kit, -27, 31, 8, 5);
  sheep(kit, 25, -9, 7, 5);
  bales(kit, FARM.x + 5, FARM.z - 8.5, 9, 4.5);
  const who = { value: V(0, -99, 0) }, sway = { value: 0 };
  const blades = grass(kit, [[2.4, 40.5, 6.2], [-8.3, 24.5, 5.6], [5.2, -4.5, 4.8]], who, sway);
  flowers(kit, Array.from({ length: 26 }, (_, i) => { const [x, z] = [[3.5, 52], [0, 46], [7, 43], [-3, 36], [-8, 30], [-11, 22], [-3, 13], [2, 6.5], [6, 0], [3, -8], [8, -13], [3, -19], [11, -21]][i % 13]; return [x + (rand() - 0.5) * 6, z + (rand() - 0.5) * 5, 5 + Math.floor(rand() * 6), 0.9]; }));

  // --- what stands round it ---
  say('Knitting the mountains');
  await turn();
  const { spool, pincushion } = sewingThings(kit);
  spool(FARM.x - 4, FARM.z - 3, '#c2473d', 3.6, true);
  spool(FARM.x - 6.2, FARM.z - 0.2, '#e3b54a', 2.8, true);
  spool(-118, -112, '#4a8a90', 13);
  spool(-104, -124, '#eadfc8', 10);
  spool(112, -118, '#d9765f', 12);
  pincushion(150, -104, 15);
  mountain(kit, -165, -190, 82, 50, '#6f7fa8', 1);
  mountain(kit, -62, -225, 92, 60, '#7d6f9a', 2);
  mountain(kit, 38, -215, 86, 54, '#5f86a0', 3);
  mountain(kit, 140, -200, 84, 48, '#8a7aa6', 4);
  mountain(kit, -250, -120, 76, 44, '#6a8a9a', 5);
  mountain(kit, 238, -130, 80, 46, '#7a86b0', 6);
  clouds(kit, [[-20, 41, -72, 4.2, 1], [30, 37, -84, 5.2, 2], [74, 30, -30, 3.6, 3], [-84, 36, -96, 5, 4], [-8, 43, -132, 6, 5], [52, 27, 20, 2.8, 6], [-40, 28, 14, 2.6, 7], [-124, 40, -150, 6.5, 8], [108, 41, -140, 7, 9], [8, 31, -30, 3, 10]]);
  sky(kit, SUN.clone().setY(0.125));

  // the table it all lies on
  {
    const wood = fabrics.canvasTexture(1024, (ctx, S) => {
      const r = rng(31);
      for (let p = 0; p < 4; p++) {
        const y0 = (p * S) / 4, tone = 150 + r() * 30;
        ctx.fillStyle = `rgb(${tone + 22},${tone - 28},${tone - 78})`;
        ctx.fillRect(0, y0, S, S / 4);
        for (let i = 0; i < 150; i++) {
          ctx.strokeStyle = `rgba(${r() < 0.6 ? '70,38,16' : '235,190,130'},${0.05 + r() * 0.16})`;
          ctx.lineWidth = 0.5 + r() * 2.2;
          const y = y0 + r() * (S / 4), wave = 2 + r() * 7, phase = r() * 6.28, freq = 0.004 + r() * 0.012;
          ctx.beginPath();
          for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin(x * freq + phase) * wave);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,20,8,0.75)';
        ctx.fillRect(0, y0, S, 2.5);
      }
    });
    wood.repeat.set(1100 / 60, 1100 / 60);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 }));
    top.position.y = -0.07;
    top.receiveShadow = true;
    group.add(top);
  }

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
    const p = ((i + n * 0.04) / 5 + spot.at.x * 0.37) % 1, s = (0.09 + 0.2 * p) * Math.min(1, (1 - p) * 5) * Math.min(1, p * 6 + 0.25) * spot.scale;
    m.position.set(spot.at.x + (0.3 * Math.sin(p * 5 + i) + 0.9 * p) * p, spot.at.y + p * 3.2, spot.at.z + 0.25 * Math.cos(p * 4 + i * 2) * p);
    m.scale.setScalar(s);
    m.rotation.set(i + n * 0.02, i * 2, 0);
  }));
  scene.add(group);

  // --- the light: the sun low and gold, the sky's blue in the shadows ---
  scene.background = new THREE.Color('#e8b878');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  // the air between here and the mountains is gold with it
  scene.fog = new THREE.FogExp2('#f2bd8a', 0.0019);
  const sun = new THREE.DirectionalLight('#ffbe7c', 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const HALF = 44;
  Object.assign(sun.shadow.camera, { left: -HALF, right: HALF, top: HALF, bottom: -HALF, near: 1, far: 520 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 3;
  sun.shadow.camera.updateProjectionMatrix();
  const fill = new THREE.HemisphereLight('#a8beff', '#f0c9a0', 0.72);
  scene.add(sun, sun.target, fill);
  // the shadows are kept where he is: a square of them that goes with him, moved a whole grain of the map at a
  // time so that their edges don't swim
  const side = new THREE.Vector3().crossVectors(V(0, 1, 0), SUN).normalize(), above = new THREE.Vector3().crossVectors(SUN, side), grain = (2 * HALF) / 4096, c = V(0, 0, 0);
  const shadows = (at, ahead) => {
    c.copy(at).addScaledVector(ahead, 22);
    const a = Math.round(c.dot(side) / grain) * grain, b = Math.round(c.dot(above) / grain) * grain, d = c.dot(SUN);
    sun.target.position.set(0, 0, 0).addScaledVector(side, a).addScaledVector(above, b).addScaledVector(SUN, d);
    sun.position.copy(sun.target.position).addScaledVector(SUN, 240);
    sun.target.updateMatrixWorld();
  };

  // walls he can't see at the edges of the quilt
  const mx = (Q.x0 + Q.x1) / 2, mz = (Q.z0 + Q.z1) / 2, hw = (Q.x1 - Q.x0) / 2, hd = (Q.z1 - Q.z0) / 2;
  for (const [x, z, hx, hz] of [[Q.x0 - 1, mz, 1, hd + 4], [Q.x1 + 1, mz, 1, hd + 4], [mx, Q.z0 - 1, hw + 4, 1], [mx, Q.z1 + 1, hw + 4, 1]]) kit.boxes.push({ x, y: 10, z, hx, hy: 40, hz, turn: 0 });

  const flat = V(0, 0, 0);
  return {
    ground,
    field: { cells: 512, size: 196, centre: [0, -10.4] },
    colliders: kit.colliders, boxes: kit.boxes,
    start: { x: START.x, z: START.z, yaw: Math.PI },
    road: ROAD,
    follow: { pitch: 0.17, want: 9.5, side: 1.15, lift: 1.25 },
    lens: { lens: 4.2, most: 12 },
    far: 1200,
    counts: { ...fields.counts, strands, blades, tiles: kit.tiles.length, sewn: kit.stitches.count },
    /** The parts that move do so a frame at a time, like everything in a film made by hand: n is the frame's number. */
    step(n) { for (const f of kit.onStep) f(n); sway.value = n * 0.21; },
    /** Every frame: where he is, and the camera that is looking. */
    update(dt, feet, camera) {
      who.value.copy(feet);
      camera.getWorldDirection(flat).setY(0).normalize();
      shadows(feet, flat);
    },
  };
}
