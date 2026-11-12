// The table the little world is made on, and what a sewer leaves lying about: a cutting mat, spools of thread,
// loose buttons, a thimble, a pincushion, a tape measure, a needle still threaded. They are the size they really
// are, which is what says how small the rest is. Behind, out of focus, the room: a wall and a string of lights.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './fabric.js';
import { cast, strip, tapeTexture } from './sew.js';
import { mound, onQuilt, Q } from './quilt.js';

export const TABLE = { hw: 46, hd: 34, mat: { x: 2.5, z: 1.5, hw: 21, hd: 15 } };
/** The top of whatever is underfoot at (x, z): the quilt, the mat or the bare table. */
export function ground(x, z) {
  if (onQuilt(x, z)) return mound(x, z) + 0.13;
  return Math.abs(x - TABLE.mat.x) < TABLE.mat.hw && Math.abs(z - TABLE.mat.z) < TABLE.mat.hd ? 0 : -0.07;
}

const tinted = (geometry, r, g, b) => {
  const n = geometry.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([r, g, b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geometry;
};

export function createTable(fabrics) {
  const group = new THREE.Group();
  const rand = rng(8080);
  const colliders = []; // { x, z, r, h } upright cylinders to walk into

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
  wood.repeat.set(2 * TABLE.hw / 30, 2 * TABLE.hd / 30);
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
  mat.receiveShadow = true;
  group.add(cast(mat));

  // --- spools of thread ---
  const wound = fabrics.weaves.cord.clone();
  wound.rotation = Math.PI / 2;
  wound.repeat.set(1, 26);
  const spoolWood = new THREE.MeshStandardMaterial({ color: '#d2a56c', roughness: 0.6 });
  const profile = [[0, 0], [0.36, 0], [0.38, 0.03], [0.36, 0.07], [0.2, 0.1], [0.2, 0.9], [0.36, 0.93], [0.38, 0.97], [0.36, 1], [0.1, 1], [0.1, 0.96], [0, 0.96]].map(([r, y]) => new THREE.Vector2(r, y));
  const spoolGeometry = new THREE.LatheGeometry(profile, 28);
  const threadGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.78, 28, 1, true).translate(0, 0.5, 0);
  const spool = (x, z, colour, { lying = 0, turn = 0, scale = 1 } = {}) => {
    const g = new THREE.Group();
    g.add(cast(new THREE.Mesh(spoolGeometry, spoolWood)));
    g.add(cast(new THREE.Mesh(threadGeometry, new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.55, normalMap: wound, normalScale: new THREE.Vector2(1.4, 1.4), sheen: 1, sheenColor: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.5), sheenRoughness: 0.35 }))));
    g.scale.setScalar(scale);
    const y = ground(x, z);
    if (lying) { g.rotation.set(0, turn, Math.PI / 2); g.position.set(x, y + 0.38 * scale, z); } else { g.rotation.y = turn; g.position.set(x, y, z); }
    group.add(g);
    colliders.push({ x, z, r: (lying ? 0.55 : 0.4) * scale, h: lying ? 0.8 : 1.1 });
    return g;
  };
  spool(15.6, 4.2, '#c2473d', { scale: 1.25 });
  spool(17.1, 5.9, '#e3b54a', { scale: 1.05, turn: 1 });
  spool(16.4, 7.4, '#3f6f9a', { lying: 1, turn: 0.5, scale: 1.1 });
  spool(-15.2, 6.5, '#4f8a4a', { scale: 1.3 });
  spool(-16.8, 4.4, '#eadfc8', { lying: 1, turn: -0.4, scale: 1.1 });
  spool(-14.9, -6.2, '#7a4a8a', { scale: 1.15 });
  spool(13.8, -10.4, '#d9765f', { scale: 1.2 });

  // --- buttons: on the table, and sewn to the quilt as stepping stones up to the door ---
  const dish = tinted(new THREE.LatheGeometry([[0, 0.07], [0.52, 0.07], [0.68, 0.11], [0.9, 0.13], [1, 0.09], [1, 0], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 28), 1, 1, 1);
  const parts = [dish];
  for (const [hx, hz] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) parts.push(tinted(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 10).translate(hx, 0.075, hz), 0.08, 0.08, 0.08));
  for (const a of [Math.PI / 4, -Math.PI / 4]) parts.push(tinted(new THREE.CapsuleGeometry(0.045, 0.5, 2, 6).rotateZ(Math.PI / 2).rotateY(a).translate(0, 0.1, 0), 1.7, 1.6, 1.4));
  const buttonGeometry = mergeGeometries(parts.map((g) => { const c = g.index ? g.toNonIndexed() : g; return c; }));
  const buttons = [];
  const button = (x, z, r, colour, tilt = 0) => buttons.push({ x, z, r, colour, tilt });
  const BUTTONS = ['#c2473d', '#e3b54a', '#3f6f9a', '#eadfc8', '#4a8a90', '#d9765f', '#f3ecdc', '#27405e', '#7a4a2b', '#e4a8a2'];
  // the stepping stones: from the front of the quilt up the hill to the cottage door
  const PATH = [[0.9, 7.6], [0.5, 6.5], [-0.3, 5.5], [-0.6, 4.4], [-1.5, 3.5], [-1.9, 2.5], [-2.4, 1.6], [-2.5, 0.75]];
  PATH.forEach(([x, z], i) => button(x, z, 0.27 + 0.05 * rand(), BUTTONS[(i * 3) % BUTTONS.length]));
  for (let i = 0; i < 26; i++) {
    const side = rand() < 0.5 ? -1 : 1, x = side * (13.2 + rand() * 9), z = -9 + rand() * 20;
    button(x, z, 0.14 + 0.16 * rand(), BUTTONS[Math.floor(rand() * BUTTONS.length)]);
  }
  for (const [x, z] of [[4.5, 10.6], [6.2, 11.5], [-3, 10.9], [-6.5, 10.2], [8.5, 10.3]]) button(x, z, 0.16 + 0.12 * rand(), BUTTONS[Math.floor(rand() * BUTTONS.length)]);
  const buttonMesh = new THREE.InstancedMesh(buttonGeometry, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }), buttons.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
  buttons.forEach((b, i) => {
    // it lies on the slope it is sewn to
    const y = ground(b.x, b.z), k = 0.3;
    n.set(ground(b.x - k, b.z) - ground(b.x + k, b.z), 2 * k, ground(b.x, b.z - k) - ground(b.x, b.z + k)).normalize();
    q.setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromEuler(e.set(0, rand() * 6.28, 0)));
    buttonMesh.setMatrixAt(i, M.compose(new THREE.Vector3(b.x, y - 0.01 + (onQuilt(b.x, b.z) ? 0.075 : 0), b.z), q, new THREE.Vector3(b.r, b.r, b.r)));
    buttonMesh.setColorAt(i, c.set(b.colour));
  });
  group.add(cast(buttonMesh));

  // --- pins with glass heads, stuck in the quilt like flowers, and in a pincushion ---
  const pins = [];
  const pin = (x, y, z, dir, len, colour) => pins.push({ x, y, z, dir: dir.clone().normalize(), len, colour });
  const HEADS = ['#f3ecdc', '#e3b54a', '#c2473d', '#e4a8a2', '#f6f1e6', '#f0cf68', '#d9765f', '#a9c6d6'];
  for (const [cx, cz, count] of [[-0.8, 2.2, 6], [-5.6, 0.8, 5], [-4.6, 2.6, 4], [1.2, -3.6, 6], [5.2, 4.4, 5], [8.6, 3.4, 4], [-8.2, 3.6, 6], [-7.0, -5.2, 5], [0.2, 6.2, 4], [7.4, -3.8, 6], [-1.2, -6.4, 4], [10.2, -1.2, 5]]) {
    for (let i = 0; i < count; i++) {
      const x = cx + (rand() - 0.5) * 1.3, z = cz + (rand() - 0.5) * 1.3;
      pin(x, mound(x, z) + 0.1, z, new THREE.Vector3((rand() - 0.5) * 0.5, 1, (rand() - 0.5) * 0.5), 0.34 + 0.22 * rand(), HEADS[Math.floor(rand() * HEADS.length)]);
    }
  }
  // the pincushion: a red tomato of felt, drawn in by six threads
  {
    const at = new THREE.Vector3(-14.6, 0, 9.4), R = 1.25;
    const body = new THREE.SphereGeometry(R, 40, 24);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), pinch = 1 - 0.07 * Math.abs(Math.cos(a * 3)) ** 8;
      p.setXYZ(i, p.getX(i) * pinch, p.getY(i) * 0.62, p.getZ(i) * pinch);
    }
    body.computeVertexNormals();
    const cushion = cast(new THREE.Mesh(body, fabrics.felt('#c2473d')));
    cushion.position.set(at.x, R * 0.62 - 0.03, at.z);
    group.add(cushion);
    const leaf = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 5), fabrics.felt('#4f8a4a')));
    leaf.position.set(at.x, R * 1.24 - 0.04, at.z);
    group.add(leaf);
    for (let i = 0; i < 16; i++) {
      const a = rand() * 6.28, lift = 0.35 + rand() * 0.9, d = new THREE.Vector3(Math.cos(a) * Math.cos(lift), Math.sin(lift), Math.sin(a) * Math.cos(lift));
      pin(at.x + d.x * R * 0.95, R * 0.62 + d.y * R * 0.58, at.z + d.z * R * 0.95, d, 0.3 + 0.3 * rand(), HEADS[Math.floor(rand() * HEADS.length)]);
    }
    colliders.push({ x: at.x, z: at.z, r: R * 0.95, h: 1.6 });
  }
  const shafts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 }), pins.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.062, 12, 9), new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }), pins.length);
  pins.forEach((p, i) => {
    q.setFromUnitVectors(up, p.dir);
    shafts.setMatrixAt(i, M.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, p.len, 1)));
    heads.setMatrixAt(i, M.compose(new THREE.Vector3(p.x, p.y, p.z).addScaledVector(p.dir, p.len), q, new THREE.Vector3(1, 1, 1)));
    heads.setColorAt(i, c.set(p.colour));
  });
  group.add(cast(shafts), cast(heads));

  // --- a thimble ---
  {
    const g = new THREE.LatheGeometry([[0.2, 0], [0.215, 0.03], [0.19, 0.3], [0.16, 0.38], [0.08, 0.42], [0, 0.43]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const dimples = fabrics.weaves.knit.clone();
    dimples.repeat.set(5, 3);
    const thimble = cast(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 1, roughness: 0.28, normalMap: dimples, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide })));
    thimble.scale.setScalar(1.5);
    thimble.position.set(12.9, 0, 8.9);
    group.add(thimble);
    colliders.push({ x: 12.9, z: 8.9, r: 0.36, h: 0.7 });
  }

  // --- the tape measure, run out across the table and up onto the quilt ---
  {
    const numbers = tapeTexture(29);
    const pts = new THREE.CatmullRomCurve3([[-21, 12.5], [-16, 12.9], [-11.5, 11.9], [-8.6, 10.2], [-7.6, 8.4], [-7.2, 6.6], [-6.4, 5.2]].map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(120);
    const tape = cast(new THREE.Mesh(strip(pts, 0.36, ground, 0.012), new THREE.MeshPhysicalMaterial({ map: numbers, roughness: 0.45, clearcoat: 0.3, side: THREE.DoubleSide })));
    group.add(tape);
  }

  // --- a needle left in the quilt, its thread running back to the red spool ---
  {
    const from = new THREE.Vector3(9.4, mound(9.4, 5.6) + 0.12, 5.6), lean = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    const needle = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.004, 1.15, 7).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 1, roughness: 0.22 })));
    needle.position.copy(from);
    needle.quaternion.setFromUnitVectors(up, lean);
    group.add(needle);
    const eye = from.clone().addScaledVector(lean, 0.84);
    const line = new THREE.CatmullRomCurve3([eye, new THREE.Vector3(10.6, 0.55, 6.3), new THREE.Vector3(11.8, 0.12, 6.0), new THREE.Vector3(13.2, 0.03, 4.9), new THREE.Vector3(14.6, 0.03, 4.9), new THREE.Vector3(15.25, 0.4, 4.45), new THREE.Vector3(15.3, 0.9, 4.3)]);
    group.add(cast(new THREE.Mesh(new THREE.TubeGeometry(line, 90, 0.014, 5), fabrics.thread('#c2473d'))));
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
  for (const [x, z, turn, w] of [[0, -70, 0, 260], [-110, -10, Math.PI / 2, 200], [110, -10, -Math.PI / 2, 200], [0, 80, Math.PI, 260]]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(w, 90), new THREE.MeshBasicMaterial({ map: wall, color: new THREE.Color(1.5, 1.4, 1.3) }));
    side.position.set(x, 30, z);
    side.rotation.y = turn;
    group.add(side);
  }
  // things at the back of the table, which will only ever be soft shapes of colour: bolts of cloth, balls of wool
  {
    const bolt = new THREE.BoxGeometry(11, 1.5, 3.4, 1, 1, 1);
    const uv = bolt.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 11, uv.getY(i) * 3.4);
    const cloths = [fabrics.cotton('gingham', ['#c2473d'], { size: 3 }), fabrics.cotton('solid', ['#d9a43a'], { size: 3 }), fabrics.cotton('dots', ['#27405e'], { size: 3 }), fabrics.cotton('stripes', ['#4f8a4a'], { size: 3 }), fabrics.cotton('ditsy', ['#e4a8a2'], { size: 3 }), fabrics.cotton('solid', ['#4a8a90'], { size: 3 })];
    [[-27, 0, -22, 0.3, 0], [-26.4, 1.5, -21.6, 0.18, 1], [-27.3, 3.0, -22.2, 0.42, 2], [-26.6, 4.5, -21.8, 0.25, 4], [25, 0, -24, -0.35, 3], [25.6, 1.5, -23.6, -0.2, 5], [24.6, 3.0, -24.2, -0.45, 0]].forEach(([x, y, z, turn2, k]) => {
      const b = cast(new THREE.Mesh(bolt, cloths[k]));
      b.position.set(x, y + 0.7, z); b.rotation.y = turn2;
      group.add(b);
    });
    const windings = fabrics.weaves.cord.clone();
    windings.repeat.set(9, 9); windings.rotation = 0.6;
    [[9, -24, 2.6, '#c8694a'], [13.5, -21.5, 2.0, '#e3b54a'], [-8, -25, 2.9, '#4a8a90'], [-13, -22.5, 2.1, '#e4a8a2'], [1, -27, 3.1, '#5d9a52']].forEach(([x, z, r2, colour]) => {
      const ball = cast(new THREE.Mesh(new THREE.SphereGeometry(r2, 32, 22), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 1, normalMap: windings, normalScale: new THREE.Vector2(1.5, 1.5), sheen: 1, sheenColor: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.5), sheenRoughness: 0.7 })));
      ball.position.set(x, r2 - 0.1, z); ball.rotation.set(rand() * 3, rand() * 3, 0);
      group.add(ball);
      colliders.push({ x, z, r: r2 * 0.9, h: r2 * 2 });
    });
  }
  // a string of small lamps along the far wall: all they will ever be is soft discs of light
  const lamps = [];
  for (let i = 0; i < 34; i++) {
    const t = i / 33, x = -62 + t * 124, sag = Math.sin(t * Math.PI * 3) ** 2;
    lamps.push(x + (rand() - 0.5) * 1.5, 19 - sag * 5.5 + (rand() - 0.5), -52 + (rand() - 0.5) * 6);
  }
  const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.2, 2.2) }), lamps.length / 3);
  for (let i = 0; i < lamps.length / 3; i++) lampMesh.setMatrixAt(i, M.makeTranslation(lamps[i * 3], lamps[i * 3 + 1], lamps[i * 3 + 2]));
  group.add(lampMesh);

  return { group, colliders, PATH };
}
