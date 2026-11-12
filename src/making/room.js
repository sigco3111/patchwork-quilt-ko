// The table the country is being made on, and the room round it. What a sewer has to hand lies about the quilt at
// the size it really is, which is what says how small the country is: a cutting mat, spools, shears, a thimble, a
// pincushion, a tape measure, loose buttons, a needle still threaded. And the room stands in for everything a
// landscape has that a quilt hasn't: the desk lamp is the sun, three bobble hats are the mountains with snow on
// them, the cotton-wool clouds hang from threads, and far off, never in focus, are the sewing machine, bolts of
// cloth, balls of wool and a string of small lights along the wall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../fabric.js';
import { cast, fuzz, ribbon, tapeTexture } from '../sew.js';
import { mountain } from '../country/nature.js';
import { PATH, Q, TABLE, TAPE, ground, mound, onQuilt } from './land.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), TAU = Math.PI * 2;
const tinted = (geometry, r, g, b) => {
  const n = geometry.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([r, g, b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geometry;
};

/** `lamp`: where the lamp's head is, and `aim` what it is turned on. */
export function createRoom(kit, { lamp, aim }) {
  const { fabrics, group } = kit, rand = rng(8081);

  // --- the table top: planks of oiled wood ---
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
  wood.repeat.set((2 * TABLE.hw) / 30, (2 * TABLE.hd) / 30);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * TABLE.hw, 2 * TABLE.hd).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 }));
  top.position.y = -0.07;
  top.receiveShadow = true;
  group.add(top);

  // --- the cutting mat: green, with its grid ---
  const grid = fabrics.canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#2c6a58'; ctx.fillRect(0, 0, S, S);
    const r = rng(77);
    for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.035})`; ctx.fillRect(r() * S, r() * S, 2 + r() * 6, 1 + r() * 2); }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i === 0 ? 'rgba(236,236,214,0.85)' : i === 5 ? 'rgba(236,236,214,0.5)' : 'rgba(236,236,214,0.2)';
      const w = i === 0 ? 3 : 1.5, at = (i * S) / 10;
      ctx.fillRect(at - w / 2, 0, w, S); ctx.fillRect(0, at - w / 2, S, w);
    }
  });
  grid.repeat.set((2 * TABLE.mat.hw) / 1.45, (2 * TABLE.mat.hd) / 1.45); // one tile is ten centimetres
  const mat = new THREE.Mesh(new THREE.BoxGeometry(2 * TABLE.mat.hw, 0.07, 2 * TABLE.mat.hd), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial(i === 2 ? { map: grid, roughness: 0.82 } : { color: '#1f4a3e', roughness: 0.85 })));
  mat.position.set(TABLE.mat.x, -0.035, TABLE.mat.z);
  group.add(cast(mat));

  // --- buttons: stepping stones up to the village, and loose ones on the table ---
  const dish = tinted(new THREE.LatheGeometry([[0, 0.07], [0.52, 0.07], [0.68, 0.11], [0.9, 0.13], [1, 0.09], [1, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 28), 1, 1, 1);
  const parts = [dish];
  for (const [hx, hz] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) parts.push(tinted(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 10).translate(hx, 0.075, hz), 0.08, 0.08, 0.08));
  for (const a of [Math.PI / 4, -Math.PI / 4]) parts.push(tinted(new THREE.CapsuleGeometry(0.045, 0.5, 2, 6).rotateZ(Math.PI / 2).rotateY(a).translate(0, 0.1, 0), 1.7, 1.6, 1.4));
  const buttonGeometry = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  const buttons = [], BUTTONS = ['#c2473d', '#e3b54a', '#3f6f9a', '#eadfc8', '#4a8a90', '#d9765f', '#f3ecdc', '#27405e', '#7a4a2b', '#e4a8a2'];
  let gone = 0, before = PATH[0];
  PATH.forEach((p, i) => {
    gone += Math.hypot(p[0] - before[0], p[1] - before[1]);
    before = p;
    if (i && gone < 1.12) return;
    gone = 0;
    buttons.push({ x: p[0] + (rand() - 0.5) * 0.25, z: p[1] + (rand() - 0.5) * 0.25, r: 0.27 + 0.06 * rand(), colour: BUTTONS[(buttons.length * 3) % BUTTONS.length] });
  });
  for (let i = 0; i < 46; i++) {
    const side = rand() < 0.5 ? -1 : 1, x = side * (Q.w / 2 + 1.4 + rand() * 12), z = -Q.d / 2 + rand() * (Q.d + 8);
    buttons.push({ x, z, r: 0.14 + 0.16 * rand(), colour: BUTTONS[Math.floor(rand() * BUTTONS.length)] });
  }
  for (let i = 0; i < 12; i++) buttons.push({ x: -18 + rand() * 30, z: Q.d / 2 + 1.2 + rand() * 4.5, r: 0.14 + 0.14 * rand(), colour: BUTTONS[Math.floor(rand() * BUTTONS.length)] });
  const buttonMesh = new THREE.InstancedMesh(buttonGeometry, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }), buttons.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), n = new THREE.Vector3();
  buttons.forEach((b, i) => {
    // it lies on the slope it is sewn to
    const y = ground(b.x, b.z), k = 0.3;
    n.set(ground(b.x - k, b.z) - ground(b.x + k, b.z), 2 * k, ground(b.x, b.z - k) - ground(b.x, b.z + k)).normalize();
    q.setFromUnitVectors(UP, n).multiply(new THREE.Quaternion().setFromEuler(e.set(0, rand() * 6.28, 0)));
    buttonMesh.setMatrixAt(i, M.compose(V(b.x, y - 0.01 + (onQuilt(b.x, b.z) ? 0.075 : 0), b.z), q, V(b.r, b.r, b.r)));
    buttonMesh.setColorAt(i, c.set(b.colour));
  });
  group.add(cast(buttonMesh));

  // --- a thimble ---
  {
    const g = new THREE.LatheGeometry([[0.2, 0], [0.215, 0.03], [0.19, 0.3], [0.16, 0.38], [0.08, 0.42], [0, 0.43]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const dimples = fabrics.weaves.knit.clone();
    dimples.repeat.set(5, 3);
    const thimble = cast(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 1, roughness: 0.28, normalMap: dimples, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide })));
    thimble.scale.setScalar(1.6);
    thimble.position.set(-23.6, 0, 17.6);
    group.add(thimble);
    kit.colliders.push({ x: -23.6, z: 17.6, r: 0.38, h: 0.7 });
  }

  // --- the tape measure, run out across the table, up over the edge of the mat and onto the corner of the quilt ---
  {
    const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const matEdge = TABLE.mat.x - TABLE.mat.hw;
    // it lies on whatever is under it, and where that steps up (the mat's edge, the quilt's) it climbs in a slope
    const lie = (x, z) => {
      const low = -0.07 + 0.07 * ss(matEdge - 0.7, matEdge - 0.02, x);
      return low + (mound(x, z) + 0.085 - low) * ss(-0.55, 0, Math.min(Q.w / 2 - Math.abs(x), Q.d / 2 - Math.abs(z)));
    };
    const pts = new THREE.CatmullRomCurve3(TAPE.map(([x, z]) => V(x, 0, z))).getPoints(260);
    group.add(cast(new THREE.Mesh(ribbon(pts, 0.36, lie, { across: 3, lift: 0.012 }), new THREE.MeshPhysicalMaterial({ map: tapeTexture(29), roughness: 0.45, clearcoat: 0.3, side: THREE.DoubleSide }))));
  }

  // --- the shears ---
  {
    const shears = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#d5d8dc', metalness: 1, roughness: 0.2 });
    const grip = new THREE.MeshPhysicalMaterial({ color: '#d9762f', roughness: 0.35, clearcoat: 0.6 });
    for (const s of [-1, 1]) {
      const half = new THREE.Group();
      const blade = new THREE.BoxGeometry(0.62, 0.07, 5.2, 1, 1, 8), p = blade.attributes.position;
      // it tapers to its point, and one edge is ground
      for (let i = 0; i < p.count; i++) { const t = (p.getZ(i) + 2.6) / 5.2; p.setX(i, p.getX(i) * (1 - 0.82 * t ** 1.6) + 0.1 * t); p.setY(i, p.getY(i) * (1 - 0.5 * t)); }
      blade.computeVertexNormals();
      const b = cast(new THREE.Mesh(blade, steel));
      b.position.set(0, 0.04 + (s > 0 ? 0.075 : 0), 2.5);
      const shank = cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 1.9), grip));
      shank.position.set(-0.35, 0.07 + (s > 0 ? 0.075 : 0), -0.95);
      shank.rotation.y = 0.32;
      const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(s > 0 ? 1.05 : 0.78, 0.2, 10, 30).rotateX(Math.PI / 2), grip));
      ring.scale.z = s > 0 ? 1.45 : 1;
      ring.position.set(-0.95, 0.2, -2.9 - (s > 0 ? 0.4 : 0));
      half.add(b, shank, ring);
      half.scale.x = s;
      half.rotation.y = s * 0.17;
      shears.add(half);
    }
    const pin = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 14), steel));
    pin.position.y = 0.13;
    shears.add(pin);
    shears.position.set(-12.5, 0, 20.4);
    shears.rotation.y = 1.9;
    group.add(shears);
    kit.colliders.push({ x: -12.5, z: 20.4, r: 1.1, h: 0.5 }, { x: -15.3, z: 21.3, r: 1.4, h: 0.5 }, { x: -10, z: 19.6, r: 0.7, h: 0.4 });
  }

  // --- the mountains: three bobble hats, standing behind the quilt ---
  for (const [x, z, r, h, hex, seed] of [[-13, -27.5, 8.2, 9.2, '#7d6f9a', 2], [3.5, -31, 9.4, 11, '#5f86a0', 3], [28.5, -21, 6.4, 7.2, '#6f9a8a', 5]]) {
    mountain(kit, x, z, r, h, hex, seed, 0.42, true);
    const brim = cast(new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.5, 12, 64).rotateX(Math.PI / 2), kit.ribbed(hex)));
    brim.scale.y = 2.2;
    brim.position.set(x, 1.0, z);
    const bobble = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 3), kit.cotton));
    bobble.position.set(x, h + 0.9, z);
    bobble.add(fuzz(bobble.geometry, 620, { long: 0.42, colour: '#fbfaf5', thick: 2.6, seed }));
    group.add(brim, bobble);
    kit.colliders.push({ x, z, r: r * 0.95, h: 6 });
  }

  // --- the desk lamp: the sun of this country ---
  {
    const enamel = new THREE.MeshPhysicalMaterial({ color: '#b8433a', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a45a', metalness: 1, roughness: 0.3 });
    const way = aim.clone().sub(lamp).normalize(), foot = V(lamp.x + 9.5, 0, lamp.z - 5.5), elbow = V(lamp.x + 11.5, lamp.y * 0.62, lamp.z - 3.5), neck = lamp.clone().addScaledVector(way, -4.6);
    const base = cast(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.9, 40), enamel));
    base.position.set(foot.x, 0.38, foot.z);
    group.add(base);
    const rod = (a, b, r) => { const d = b.clone().sub(a), m = cast(new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), brass)); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); group.add(m); };
    rod(V(foot.x, 0.8, foot.z), elbow, 0.34);
    rod(elbow, neck, 0.3);
    for (const p of [elbow, neck]) { const knuckle = cast(new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), brass)); knuckle.position.copy(p); group.add(knuckle); }
    // the shade: a cone, open toward what it lights, bright inside
    const head = new THREE.Group();
    head.position.copy(neck);
    head.quaternion.setFromUnitVectors(UP, way);
    head.add(cast(new THREE.Mesh(new THREE.LatheGeometry([[0.7, -0.6], [1.1, 0], [1.5, 0.9], [4.3, 5.0], [4.5, 5.3]].map(([r, y]) => new THREE.Vector2(r, y)), 44), enamel)));
    const inside = new THREE.Mesh(new THREE.LatheGeometry([[1.3, 0.75], [4.2, 5.0]].map(([r, y]) => new THREE.Vector2(r, y)), 44), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.85), side: THREE.BackSide }));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(15, 10.5, 5.5) }));
    bulb.position.y = 3.3;
    head.add(inside, bulb);
    group.add(head);
    kit.colliders.push({ x: foot.x, z: foot.z, r: 4.5, h: 1.6 });
  }

  // --- the room behind, never in focus ---
  const wall = fabrics.canvasTexture(256, (ctx, S) => {
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#2a2420'); g.addColorStop(0.55, '#4a3a30'); g.addColorStop(1, '#241c18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const glow = ctx.createRadialGradient(S * 0.7, S * 0.45, 0, S * 0.7, S * 0.45, S * 0.5);
    glow.addColorStop(0, 'rgba(255,196,120,0.55)'); glow.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
  });
  wall.wrapS = wall.wrapT = THREE.ClampToEdgeWrapping;
  for (const [x, z, turn, w] of [[0, -100, 0, 380], [-160, -10, Math.PI / 2, 300], [160, -10, -Math.PI / 2, 300], [0, 110, Math.PI, 380]]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(w, 130), new THREE.MeshBasicMaterial({ map: wall, color: new THREE.Color(1.5, 1.4, 1.3) }));
    side.position.set(x, 44, z);
    side.rotation.y = turn;
    group.add(side);
  }
  // the sewing machine, at the back of the table: all it will ever be is a soft shape
  {
    const machine = new THREE.Group();
    const body = new THREE.MeshPhysicalMaterial({ color: '#cfe0d6', roughness: 0.3, clearcoat: 0.7 }), steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 });
    const block = (w, h, d, x, y, z, m = body) => { const b = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 2, 2), m)); b.position.set(x, y, z); machine.add(b); return b; };
    block(34, 2.2, 13, 0, 1.1, 0);
    block(7, 15, 9.5, 12.5, 9.5, 0);
    block(27, 6, 8.5, 1, 17, 0);
    block(6, 9.5, 8.5, -10.5, 10.5, 0);
    const bar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 8), steel));
    bar.position.set(-10.5, 3.9, 1.5);
    const wheel = cast(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.3, 36).rotateZ(Math.PI / 2), steel));
    wheel.position.set(16.7, 15.5, 0);
    const plate = block(8, 0.2, 6, -10.5, 2.3, 1.5, steel);
    void plate;
    machine.add(bar, wheel);
    machine.position.set(-44, 0, -30);
    machine.rotation.y = 0.55;
    group.add(machine);
    kit.boxes.push({ x: -44, y: 6, z: -30, hx: 17, hy: 12, hz: 7, turn: 0.55 });
  }
  // bolts of cloth and balls of wool
  {
    const bolt = new THREE.BoxGeometry(14, 1.9, 4.2, 1, 1, 1), uv = bolt.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 4.2);
    const cloths = [fabrics.cotton('gingham', ['#c2473d'], { size: 3 }), fabrics.cotton('solid', ['#d9a43a'], { size: 3 }), fabrics.cotton('dots', ['#27405e'], { size: 3 }), fabrics.cotton('stripes', ['#4f8a4a'], { size: 3 }), fabrics.cotton('ditsy', ['#e4a8a2'], { size: 3 }), fabrics.cotton('solid', ['#4a8a90'], { size: 3 })];
    [[40, 0, -30, -0.35, 3], [40.8, 1.9, -29.5, -0.2, 5], [39.5, 3.8, -30.4, -0.45, 0], [40.3, 5.7, -29.8, -0.3, 1], [-34, 0, 14, 1.3, 2], [-33.4, 1.9, 14.6, 1.15, 4]].forEach(([x, y, z, turn, k]) => {
      const b = cast(new THREE.Mesh(bolt, cloths[k]));
      b.position.set(x, y + 0.9, z); b.rotation.y = turn;
      group.add(b);
    });
    kit.boxes.push({ x: 40, y: 3.5, z: -30, hx: 7.6, hy: 4.5, hz: 3, turn: -0.3 }, { x: -34, y: 2, z: 14, hx: 7.6, hy: 3, hz: 3, turn: 1.25 });
    const windings = fabrics.weaves.cord.clone();
    windings.repeat.set(9, 9); windings.rotation = 0.6;
    [[35.5, -11.5, 2.9, '#c8694a'], [38.5, -6.5, 2.2, '#e3b54a'], [-27, -21, 3.2, '#4a8a90'], [-32.5, -17.5, 2.3, '#e4a8a2'], [-25.5, -14.8, 1.7, '#5d9a52'], [29.5, 16, 2.4, '#8a6fb0']].forEach(([x, z, r2, colour], i) => {
      const ball = cast(new THREE.Mesh(new THREE.SphereGeometry(r2, 36, 24), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 1, normalMap: windings, normalScale: new THREE.Vector2(1.5, 1.5), sheen: 1, sheenColor: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.5), sheenRoughness: 0.7 })));
      ball.position.set(x, r2 - 0.1, z); ball.rotation.set(rand() * 3, rand() * 3, 0);
      ball.add(fuzz(ball.geometry, 60, { long: 0.3, colour, thick: 2.2, seed: 40 + i }));
      group.add(ball);
      kit.colliders.push({ x, z, r: r2 * 0.9, h: r2 * 2 });
    });
  }
  // a string of small lamps along the far wall: all they will ever be is soft discs of light
  const lights = [];
  for (let i = 0; i < 44; i++) {
    const t = i / 43, x = -90 + t * 180, sag = Math.sin(t * Math.PI * 4) ** 2;
    lights.push(x + (rand() - 0.5) * 1.5, 30 - sag * 7 + (rand() - 0.5), -78 + (rand() - 0.5) * 6);
  }
  const lightMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.2, 2.2) }), lights.length / 3);
  for (let i = 0; i < lights.length / 3; i++) lightMesh.setMatrixAt(i, M.makeTranslation(lights[i * 3], lights[i * 3 + 1], lights[i * 3 + 2]));
  group.add(lightMesh);
}
