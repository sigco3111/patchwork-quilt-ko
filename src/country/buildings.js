// What people have built in the valley: felt cottages with scalloped felt tiles and lamps lit behind their
// windows, a church with a felt cap to its tower, a windmill with gingham sails, and a line of washing. Every one is a
// thing somebody could cut, stuff and sew, and each is stitched where it would have to be.
//
// Each maker takes the `kit` that world.js hands round: { fabrics, group, rand, stitches, bead(), colliders, boxes,
// tiles, smokes, felt(hex), feltTwo(hex), onStep, and the land it is on: mound(x, z), away(x, z), toRoad, toRiver, onQuilt }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cast, clothUV, stuffedBox } from '../sew.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const CREAM = '#efe6d2', RED = '#b8433a';
let DOOR = null;

/** Walls, gables and a tiled roof: the shell of anything with a pitched roof. */
function shell(kit, { x, z, turn = 0, W, H, D, RISE, walls, roof, seam = RED, scale = 1 }) {
  const { stitches, rand } = kit;
  const house = new THREE.Group();
  house.position.set(x, kit.mound(x, z) + 0.13, z);
  house.rotation.y = turn;
  house.scale.setScalar(scale);
  house.updateMatrixWorld(true);
  const inHouse = (a, b, c) => V(a, b, c).applyMatrix4(house.matrixWorld);
  const turned = (a, b, c) => V(a, b, c).applyQuaternion(house.quaternion);
  const body = cast(new THREE.Mesh(stuffedBox(W, H, D, 0.08), kit.felt(walls)));
  body.position.y = H / 2;
  house.add(body);
  kit.fuzz?.(body, 230, { colour: walls, long: 0.065 });
  {
    // the gable ends, cut in one with the walls
    const g = new THREE.BufferGeometry(), p = [], n = [], uv = [];
    for (const s of [-1, 1]) {
      const gx = s * (W / 2 + 0.02);
      const tri = s > 0 ? [[gx, H - 0.05, D / 2], [gx, H - 0.05, -D / 2], [gx, H + RISE - 0.12, 0]] : [[gx, H - 0.05, -D / 2], [gx, H - 0.05, D / 2], [gx, H + RISE - 0.12, 0]];
      for (const v of tri) { p.push(...v); n.push(s, 0, 0); uv.push(v[2], v[1]); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    house.add(cast(new THREE.Mesh(g, kit.feltTwo(walls))));
  }
  // blanket stitch down every corner, and a running stitch round the foot of the walls
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let y = 0.14; y < H - 0.08; y += 0.17) {
      stitches.add(inHouse(sx * (W / 2 + 0.014), y, sz * (D / 2 - 0.07)), turned(0, 0, 1), 0.13, seam, 1.15);
      stitches.add(inHouse(sx * (W / 2 - 0.07), y, sz * (D / 2 + 0.014)), turned(1, 0, 0), 0.13, seam, 1.15);
    }
  }
  for (const sz of [-1, 1]) stitches.run(inHouse(-W / 2 + 0.2, 0.13, sz * (D / 2 + 0.04)), inHouse(W / 2 - 0.2, 0.13, sz * (D / 2 + 0.04)), { colour: seam, every: 0.2, long: 0.11, lift: 0 });
  for (const sx of [-1, 1]) stitches.run(inHouse(sx * (W / 2 + 0.04), 0.13, -D / 2 + 0.2), inHouse(sx * (W / 2 + 0.04), 0.13, D / 2 - 0.2), { colour: seam, every: 0.2, long: 0.11, lift: 0 });

  // the roof: two slabs of felt, and row over row of scalloped felt tiles
  const EAVE = D / 2 + 0.3, slopeRise = RISE + 0.12, slopeLen = Math.hypot(slopeRise, EAVE), pitch = Math.atan2(slopeRise, EAVE);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Matrix4();
  for (const s of [1, -1]) {
    const slab = cast(new THREE.Mesh(stuffedBox(W + 0.5, 0.1, slopeLen + 0.1, 0.015, 4), kit.felt(roof[0])));
    slab.position.set(0, H - 0.12 + slopeRise / 2, (s * EAVE) / 2);
    slab.rotation.x = s * pitch;
    house.add(slab);
    const X = V(s, 0, 0), N = V(0, Math.cos(pitch), s * Math.sin(pitch)), DOWN = new THREE.Vector3().crossVectors(X, N);
    const eave = V(0, H - 0.12, s * EAVE), rows = Math.floor((slopeLen - 0.12) / 0.245), across = Math.round((W + 0.5) / 0.4), step = (W + 0.5) / across;
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < across + (row % 2); i++) {
        const tx = -(W + 0.5) / 2 + (i + (row % 2 ? 0 : 0.5)) * step;
        if (Math.abs(tx) > (W + 0.5) / 2 + 0.02) continue;
        const at = eave.clone().addScaledVector(DOWN, -(0.2 + row * 0.245)).addScaledVector(N, 0.07 + row * 0.004).add(V(tx + (rand() - 0.5) * 0.03, 0, 0));
        const lift = (rand() - 0.5) * 0.12, size = 0.9 + 0.18 * rand();
        M.makeBasis(X, N, DOWN);
        q.setFromRotationMatrix(M).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.1 + lift * 0.4)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), lift));
        kit.tiles.push({ m: house.matrixWorld.clone().multiply(e.compose(at, q, V(size, 1, size))), colour: roof[Math.floor(rand() * roof.length)] });
      }
    }
  }
  const ridge = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, W + 0.45, 4, 10).rotateZ(Math.PI / 2), kit.felt(roof[0])));
  ridge.position.y = H + RISE + 0.02;
  house.add(ridge);
  for (let rx = -W / 2 - 0.1; rx < W / 2 + 0.15; rx += 0.19) stitches.add(inHouse(rx, H + RISE + 0.125, 0), turned(0, 0, 1), 0.12, CREAM, 1.1);
  kit.group.add(house);
  kit.boxes.push({ x, y: house.position.y + (H * scale) / 2, z, hx: (W / 2 + 0.1) * scale, hy: (H / 2 + 0.8) * scale, hz: (D / 2 + 0.1) * scale, turn });
  return { house, inHouse, turned, FRONT: D / 2 + 0.085 };
}

/** A square of yellow felt with the lamp on behind it, barred with floss. */
function windowOn(kit, { house }, x, y, z, turn, w = 0.6, h = 0.6) {
  const g = new THREE.Group();
  g.add(cast(new THREE.Mesh(stuffedBox(w, h, 0.04, 0.01, 3), kit.lit)));
  for (const [sx, sy] of [[w, 0.055], [0.055, h]]) { const bar = cast(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.03), kit.felt('#7a4a2b'))); bar.position.z = 0.03; g.add(bar); }
  g.position.set(x, y, z);
  g.rotation.y = turn;
  house.add(g);
  g.updateMatrixWorld(true);
  const at = (a, b) => V(a, b, 0.035).applyMatrix4(g.matrixWorld);
  for (const s of [-1, 1]) {
    kit.stitches.run(at(-w / 2 - 0.03, s * (h / 2 + 0.03)), at(w / 2 + 0.03, s * (h / 2 + 0.03)), { colour: '#7a4a2b', every: 0.13, long: 0.08, lift: 0, thick: 0.85 });
    kit.stitches.run(at(s * (w / 2 + 0.03), -h / 2 - 0.03), at(s * (w / 2 + 0.03), h / 2 + 0.03), { colour: '#7a4a2b', every: 0.13, long: 0.08, lift: 0, thick: 0.85 });
  }
}

/** A door with a round top, a bead for its knob, and stitching round it. */
function doorOn(kit, { house, inHouse, turned }, x, z, colour = '#7a4a2b') {
  DOOR ??= mergeGeometries([stuffedBox(0.64, 1.0, 0.05, 0.012, 3), clothUV(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.5, 0))]);
  const door = cast(new THREE.Mesh(DOOR, kit.felt(colour)));
  door.position.set(x, 0.56, z + 0.02);
  house.add(door);
  for (const sx of [-1, 1]) kit.stitches.run(inHouse(x + sx * 0.26, 0.12, z + 0.05), inHouse(x + sx * 0.26, 1.06, z + 0.05), { colour: CREAM, every: 0.14, long: 0.08, lift: 0, thick: 0.8 });
  for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI; kit.stitches.add(inHouse(x + Math.cos(a) * 0.26, 1.06 + Math.sin(a) * 0.26, z + 0.05), turned(-Math.sin(a), Math.cos(a), 0), 0.08, CREAM, 0.8); }
  kit.bead(inHouse(x + 0.18, 0.6, z + 0.075), 0.055, '#e3b54a');
}

/** A felt cottage. `walls`: its colour; `roof`: the felts its tiles are cut from (the first is the roof under them). */
export function cottage(kit, { x, z, turn = 0, walls = '#efe2c4', roof = ['#8e3a2a', '#b9482f', '#a23d2a', '#c8694a', '#b9482f', '#d9a43a'], scale = 1, heart = true, wide = 2.7 }) {
  const W = wide, H = 1.7, D = 2.2, RISE = 1.3;
  const s = shell(kit, { x, z, turn, W, H, D, RISE, walls, roof, scale });
  const { house, inHouse, FRONT } = s, doorX = -0.3;
  doorOn(kit, s, doorX, FRONT);
  if (heart) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.5); shape.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3); shape.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
    const felt = cast(new THREE.Mesh(clothUV(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 10 }).scale(0.26, 0.26, 0.26)), kit.felt('#c2473d')));
    felt.position.set(doorX, 1.5, FRONT - 0.005);
    house.add(felt);
  }
  windowOn(kit, s, 0.72, 0.98, FRONT + 0.012, 0);
  windowOn(kit, s, W / 2 + 0.097, 0.98, 0.1, Math.PI / 2);
  windowOn(kit, s, -W / 2 - 0.097, 0.98, -0.1, -Math.PI / 2);
  windowOn(kit, s, -0.5, 0.98, -FRONT - 0.012, Math.PI);
  const chimney = cast(new THREE.Mesh(stuffedBox(0.46, 1.0, 0.46, 0.03, 4), kit.felt('#a8543a')));
  chimney.position.set(0.72, H + RISE - 0.12, -0.52);
  const band = cast(new THREE.Mesh(stuffedBox(0.54, 0.14, 0.54, 0.02, 3), kit.felt('#efe2c4')));
  band.position.set(0.72, H + RISE + 0.36, -0.52);
  house.add(chimney, band);
  kit.smokes.push({ at: inHouse(0.72, H + RISE + 0.5, -0.52), scale });
}

/** The church: a long nave, a tower at one end with a button for its clock, and a four-sided felt cap on the tower. */
export function church(kit, { x, z, turn = 0 }) {
  const W = 4.4, H = 2.2, D = 2.6, RISE = 1.6, TOWER = 5.6;
  const roof = ['#4f6278', '#5b6f86', '#6b819a', '#5b6f86', '#7b90a8', '#42566b'];
  const s = shell(kit, { x, z, turn, W, H, D, RISE, walls: '#e6dfcd', roof, seam: '#27405e' });
  const { house, inHouse, turned, FRONT } = s;
  for (const wx of [-0.2, 1.1]) windowOn(kit, s, wx, 1.15, FRONT + 0.012, 0, 0.5, 1.1);
  for (const wx of [-0.9, 0.4, 1.5]) windowOn(kit, s, wx, 1.15, -FRONT - 0.012, Math.PI, 0.5, 1.1);
  const tx = -W / 2 - 0.5;
  const tower = cast(new THREE.Mesh(stuffedBox(1.8, TOWER, 1.8, 0.06, 8), kit.felt('#e6dfcd')));
  tower.position.set(tx, TOWER / 2, 0);
  house.add(tower);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let y = 0.14; y < TOWER - 0.1; y += 0.17) {
      kit.stitches.add(inHouse(tx + sx * 0.914, y, sz * 0.83), turned(0, 0, 1), 0.13, '#27405e', 1.15);
      kit.stitches.add(inHouse(tx + sx * 0.83, y, sz * 0.914), turned(1, 0, 0), 0.13, '#27405e', 1.15);
    }
  }
  doorOn(kit, s, tx, 0.98, '#5a3a22');
  windowOn(kit, s, tx, 2.5, 0.99, 0, 0.42, 0.8);
  // the clock: a button, with two stitches for hands
  const face = cast(new THREE.Mesh(new THREE.LatheGeometry([[0, 0.05], [0.36, 0.05], [0.47, 0.085], [0.5, 0.05], [0.5, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 26).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#f1e7cf', roughness: 0.3, clearcoat: 0.8 })));
  face.position.set(tx, 4.3, 0.98);
  house.add(face);
  kit.stitches.add(inHouse(tx + 0.07, 4.4, 1.05), turned(0.55, 0.85, 0), 0.26, '#27405e', 1.3);
  kit.stitches.add(inHouse(tx - 0.07, 4.33, 1.05), turned(-0.9, 0.4, 0), 0.18, '#27405e', 1.3);
  // its cap: felt, the slate of the roof, four-sided like the tower it is pulled down over, drawing in to a bead
  const CAP = 1.97, HIGH = 2.1, taper = (t) => 1 - 0.9 * t ** 1.7;
  const capShape = new THREE.BoxGeometry(CAP, HIGH, CAP, 10, 14, 10).translate(0, HIGH / 2, 0), cp = capShape.attributes.position;
  for (let i = 0; i < cp.count; i++) { const k = taper(cp.getY(i) / HIGH); cp.setX(i, cp.getX(i) * k); cp.setZ(i, cp.getZ(i) * k); }
  capShape.computeVertexNormals();
  clothUV(capShape);
  const spire = cast(new THREE.Mesh(capShape, kit.felt(roof[0])));
  spire.position.set(tx, TOWER - 0.14, 0);
  house.add(spire);
  kit.fuzz?.(spire, 230, { colour: roof[0], long: 0.065 });
  // sewn on all round its hem
  const hem = (CAP / 2) * taper(0.22 / HIGH) + 0.014;
  for (let u = -0.8; u <= 0.81; u += 0.2) for (const s of [-1, 1]) {
    kit.stitches.add(inHouse(tx + u, TOWER + 0.08, s * hem), V(0, 1, 0), 0.15, CREAM, 1.15);
    kit.stitches.add(inHouse(tx + s * hem, TOWER + 0.08, u), V(0, 1, 0), 0.15, CREAM, 1.15);
  }
  kit.bead(inHouse(tx, TOWER - 0.14 + HIGH + 0.07, 0), 0.13, '#e3b54a');
  const c = Math.cos(turn), sn = Math.sin(turn);
  kit.colliders.push({ x: x + tx * c, z: z - tx * sn, r: 1.1, h: 7 });
}

/** The windmill: a tapering felt tower, a felt cap, and four sails of sticks and gingham that go round. */
export function windmill(kit, { x, z, turn = 0 }) {
  const mill = new THREE.Group();
  mill.position.set(x, kit.mound(x, z) + 0.13, z);
  mill.rotation.y = turn;
  mill.updateMatrixWorld(true);
  const world = (a, b, c) => V(a, b, c).applyMatrix4(mill.matrixWorld), way = (a, b, c) => V(a, b, c).applyQuaternion(mill.quaternion);
  const TALL = 6.4, R0 = 1.6, R1 = 0.98, radius = (y) => R0 + (R1 - R0) * (y / TALL);
  const tower = new THREE.LatheGeometry([[0, 0], [R0, 0], [R1, TALL], [0, TALL]].map(([r, y]) => new THREE.Vector2(r, y)), 36), uv = tower.attributes.uv, p = tower.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, p.getY(i));
  const stack = cast(new THREE.Mesh(tower, kit.felt('#efe6d2')));
  mill.add(stack);
  kit.fuzz?.(stack, 200, { colour: '#efe6d2', long: 0.065 });
  // sewn up the back, and blanket stitched round the foot and under the cap
  for (let y = 0.2; y < TALL - 0.1; y += 0.2) kit.stitches.add(world(0, y, -radius(y) - 0.012), way(1, 0, 0), 0.16, RED, 1.2);
  for (const [y, n] of [[0.18, 44], [TALL - 0.2, 28]]) for (let i = 0; i < n; i++) { const a = (i / n) * TAU; kit.stitches.add(world(Math.sin(a) * (radius(y) + 0.014), y, Math.cos(a) * (radius(y) + 0.014)), V(0, 1, 0), 0.14, RED, 1.15); }
  const cap = cast(new THREE.Mesh(clothUV(new THREE.SphereGeometry(1.12, 28, 14, 0, TAU, 0, Math.PI / 2)), kit.felt('#a8543a')));
  cap.scale.y = 0.95;
  cap.position.y = TALL - 0.05;
  mill.add(cap);
  const brim = cast(new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 8, 36).rotateX(Math.PI / 2), kit.felt('#8e3a2a')));
  brim.position.y = TALL;
  mill.add(brim);
  // a door and two lit windows, one above the other
  const flat = (mesh, y, a) => { const r = radius(y) + 0.02; mesh.position.set(Math.sin(a) * r, y, Math.cos(a) * r); mesh.rotation.set(-Math.atan2(R0 - R1, TALL), a, 0, 'YXZ'); mill.add(mesh); return mesh; };
  DOOR ??= mergeGeometries([stuffedBox(0.64, 1.0, 0.05, 0.012, 3), clothUV(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.5, 0))]);
  flat(cast(new THREE.Mesh(DOOR, kit.felt('#7a4a2b'))), 0.56, 0.5);
  for (const [y, a] of [[2.6, -0.35], [4.3, 0.35], [3.3, 2.4]]) flat(cast(new THREE.Mesh(stuffedBox(0.5, 0.6, 0.04, 0.01, 3), kit.lit)), y, a);

  // the sails: four arms of stick from a button at the hub, a frame on each, gingham stretched over it
  // (they turn well clear of the tower, and lean back a little at the top as a real mill's do, because the tower
  // is wider at its foot than under its cap)
  const sails = new THREE.Group(), rotor = new THREE.Group();
  rotor.position.set(0, TALL + 0.35, 1.58);
  rotor.rotation.x = -0.1;
  rotor.add(sails);
  const stick = new THREE.MeshStandardMaterial({ color: '#c9a36c', roughness: 0.7 });
  const cloths = [kit.fabrics.cotton('stripes', ['#c2473d', '#f3ecdc', 6, 0.6], { size: 1.3 }), kit.fabrics.cotton('gingham', ['#c2473d'], { size: 1.4 })];
  const ARM = 4.5, WIDE = 1.2;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * TAU;
    arm.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, ARM, 8).translate(0, ARM / 2, 0), stick)));
    const sail = cast(new THREE.Mesh(clothUV(new THREE.BoxGeometry(WIDE, ARM - 1.1, 0.025)), cloths[i % 2]));
    sail.position.set(WIDE / 2 + 0.03, 1.0 + (ARM - 1.1) / 2, -0.03);
    sail.rotation.y = 0.16;
    arm.add(sail);
    for (let k = 0; k < 5; k++) { const bar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, WIDE + 0.06, 6).rotateZ(Math.PI / 2), stick)); bar.position.set(WIDE / 2, 1.0 + (k / 4) * (ARM - 1.1), 0.01); arm.add(bar); }
    const edge = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, ARM - 1.1, 6), stick));
    edge.position.set(WIDE + 0.03, 1.0 + (ARM - 1.1) / 2, -0.1);
    arm.add(edge);
    sails.add(arm);
  }
  const hub = cast(new THREE.Mesh(new THREE.LatheGeometry([[0, 0.1], [0.2, 0.1], [0.3, 0.14], [0.34, 0.08], [0.34, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 22).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#c2473d', roughness: 0.3, clearcoat: 0.8 })));
  sails.add(hub);
  const axle = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8).rotateX(Math.PI / 2), stick));
  axle.position.set(0, TALL + 0.35, 1.0);
  mill.add(axle, rotor);
  kit.group.add(mill);
  kit.onStep.push((n) => { sails.rotation.z = -n * 0.07; });
  kit.colliders.push({ x, z, r: R0 + 0.1, h: 7 });
}

/** All the roof tiles of every building, as one mesh. */
export function buildTiles(kit) {
  const tile = clothUV(new THREE.CylinderGeometry(0.23, 0.23, 0.035, 12, 1, false, -Math.PI / 2, Math.PI));
  const mesh = new THREE.InstancedMesh(tile, kit.fabrics.felt('#ffffff', { side: THREE.DoubleSide }), kit.tiles.length);
  const c = new THREE.Color();
  kit.tiles.forEach((t, i) => { mesh.setMatrixAt(i, t.m); mesh.setColorAt(i, c.set(t.colour)); });
  kit.group.add(cast(mesh));
}

const outline = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const WASHING = [
  [[[-0.35, 0], [-0.62, -0.12], [-0.54, -0.32], [-0.3, -0.22], [-0.3, -0.78], [0.3, -0.78], [0.3, -0.22], [0.54, -0.32], [0.62, -0.12], [0.35, 0], [0.12, -0.07], [-0.12, -0.07]], (f) => f.cotton('stripes', ['#3f6f9a', '#f3ecdc', 10, 0.5], { size: 0.5 })],
  [[[-0.28, 0], [0.28, 0], [0.33, -0.9], [0.06, -0.9], [0, -0.32], [-0.06, -0.9], [-0.33, -0.9]], (f) => f.denim('#3d5a80')],
  [[[-0.42, 0], [0.42, 0], [0.42, -0.62], [-0.42, -0.62]], (f) => f.cotton('gingham', ['#c2473d'], { size: 0.6 })],
  [[[-0.1, 0], [0.1, 0], [0.1, -0.4], [0.28, -0.5], [0.28, -0.63], [-0.02, -0.63], [-0.1, -0.5]], (f) => f.wool('#d9a43a')],
  [[[-0.16, 0], [0.16, 0], [0.42, -0.8], [-0.42, -0.8]], (f) => f.cotton('ditsy', ['#e4a8a2', ['#f6f1e6', '#c2473d', '#f0cf68']], { size: 0.6 })],
  [[[-0.1, 0], [0.1, 0], [0.1, -0.4], [0.28, -0.5], [0.28, -0.63], [-0.02, -0.63], [-0.1, -0.5]], (f) => f.wool('#c2473d')],
  [[[-0.35, 0], [-0.62, -0.12], [-0.54, -0.32], [-0.3, -0.22], [-0.3, -0.78], [0.3, -0.78], [0.3, -0.22], [0.54, -0.32], [0.62, -0.12], [0.35, 0], [0.12, -0.07], [-0.12, -0.07]], (f) => f.cotton('dots', ['#4f8a4a'], { size: 0.5 })],
];
/**
 * A line of washing between two posts: small clothes cut from scraps, pegged up side by side with a gap between
 * each (made smaller, all alike, if the line is short), swinging a frame at a time. The line is tied round the top
 * of each post.
 */
export function washing(kit, { x, z, turn = 0, length = 7 }) {
  const line = new THREE.Group();
  line.position.set(x, kit.mound(x, z) + 0.15, z);
  line.rotation.y = turn;
  const stick = new THREE.MeshStandardMaterial({ color: '#c9a36c', roughness: 0.7 }), cord = kit.fabrics.thread('#efe6d2');
  // the posts lean out a little, as posts with a line pulled between them do; the line goes from one's top to the other's
  const TALL = 2.5, LEAN = 0.05, TIE = 0.95, half = length / 2 + TALL * TIE * Math.sin(LEAN), top = TALL * TIE * Math.cos(LEAN);
  const rope = (t) => V((t * 2 - 1) * half, top - 0.3 * (1 - (2 * t - 1) ** 2), 0);
  for (const s of [-1, 1]) {
    const post = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, TALL, 8).translate(0, TALL / 2, 0), stick));
    post.position.x = (s * length) / 2;
    post.rotation.z = -s * LEAN;
    line.add(post);
    for (const up of [-0.022, 0.012]) {
      const loop = cast(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 16).rotateX(Math.PI / 2), cord));
      loop.position.set(s * half, top + up, 0);
      loop.rotation.z = -s * LEAN;
      line.add(loop);
    }
    const c = Math.cos(turn), sn = Math.sin(turn);
    kit.colliders.push({ x: x + ((s * length) / 2) * c, z: z - ((s * length) / 2) * sn, r: 0.12, h: TALL });
  }
  line.add(cast(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => rope(i / 16))), 64, 0.014, 5), cord)));
  // how wide each thing is, and so how big they can all be and still hang clear of one another
  const GAP = 0.14, items = WASHING.map(([pts, cloth]) => {
    const xs = pts.map((p) => p[0]), tops = pts.filter((p) => p[1] === 0).map((p) => p[0]);
    return { pts, cloth, min: Math.min(...xs), max: Math.max(...xs), from: Math.min(...tops), to: Math.max(...tops) };
  });
  const sum = items.reduce((t, it) => t + it.max - it.min, 0) + GAP * (items.length - 1), k = Math.min(1, (length - 0.7) / sum), hung = [];
  let at = (-k * sum) / 2;
  for (const it of items) {
    const item = new THREE.Group();
    item.add(cast(new THREE.Mesh(clothUV(new THREE.ExtrudeGeometry(outline(it.pts), { depth: 0.035, bevelEnabled: false }).translate(0, 0, -0.0175)), it.cloth(kit.fabrics))));
    const span = it.to - it.from;
    for (const px of span > 0.3 ? [it.from + span * 0.2, it.to - span * 0.2] : [(it.from + it.to) / 2]) { const peg = cast(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.06), stick)); peg.position.set(px, 0, 0); item.add(peg); }
    const middle = at + (k * (it.max - it.min)) / 2;
    item.scale.setScalar(k);
    item.position.set(at - k * it.min, rope((middle / half + 1) / 2).y - 0.02, 0);
    at += k * (it.max - it.min + GAP);
    line.add(item);
    hung.push(item);
  }
  kit.group.add(line);
  // they swing from the line, forward and back: never sideways into each other
  kit.onStep.push((n) => hung.forEach((item, i) => { item.rotation.x = 0.07 + 0.13 * Math.sin(n * 0.21 + i * 1.3) + 0.05 * Math.sin(n * 0.53 + i * 2.1); }));
}
