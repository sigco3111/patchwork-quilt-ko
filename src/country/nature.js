// What grows, grazes and flows in the valley, and what stands round it: pom-pom trees and cones of felt, sheep of
// cotton wool, bales of corduroy, a field of felt fringe that parts round him, pins with glass heads for flowers,
// the satin river with its sequins, the tape-measure road, clouds on threads, and at the back the mountains, which
// are knitted, with white wool for snow, in front of a sky that is a dyed sheet with the sun going down in it.
//
// Each maker takes the `kit` that world.js hands round (see buildings.js).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../fabric.js';
import { noise } from '../noise.js';
import { cast, ribbon, strip } from '../sew.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2, UP = V(0, 1, 0);

/** A lump of cotton wool: a ball that is nowhere quite round. */
export function lump(seed, detail = 4) {
  let g = new THREE.IcosahedronGeometry(1, detail);
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

// ================= trees =================
/** A pom-pom of wool on a stick. `thick`: 1 for one he may walk under; less for one that is only ever seen from afar. */
export function pomTree(kit, x, z, r, h, colours, thick = 1) {
  const y0 = kit.mound(x, z) + 0.1, { rand } = kit;
  const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1 * (0.6 + r * 0.4), 0.14 * (0.6 + r * 0.4), h, 9).translate(0, h / 2, 0), kit.stick));
  trunk.position.set(x, y0, z);
  trunk.rotation.set((rand() - 0.5) * 0.08, rand() * 6, (rand() - 0.5) * 0.08);
  kit.group.add(trunk);
  const centre = V(x, y0 + h + r * 0.72, z);
  const core = cast(new THREE.Mesh(new THREE.SphereGeometry(r * (thick < 1 ? 0.84 : 0.6), 18, 12), kit.felt(colours[0])));
  core.position.copy(centre);
  kit.group.add(core);
  kit.poms.push({ centre, r, colours, n: Math.round(3300 * r * r * (thick < 1 ? 0.09 : 1)), fat: thick < 1 ? 3 : 1 });
  kit.colliders.push({ x, z, r: 0.3, h: h + 1 });
}
/** All the strands of all the pom-poms, as one mesh. */
export function buildPoms(kit) {
  const { rand } = kit, wool = new THREE.MeshPhysicalMaterial({ roughness: 1, sheen: 1, sheenColor: new THREE.Color(0.5, 0.5, 0.5), sheenRoughness: 0.9 });
  const strand = new THREE.CylinderGeometry(0.02, 0.03, 1, 5, 1, false).translate(0, 0.5, 0);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), d = V(0, 0, 0), c = new THREE.Color(), white = new THREE.Color('#ffffff');
  let total = 0;
  // (the ones he walks under throw each strand's shadow; the far ones' shadows are their cores')
  for (const close of [true, false]) {
    const list = kit.poms.filter((p) => (p.fat === 1) === close), count = list.reduce((t, p) => t + p.n, 0);
    const mesh = new THREE.InstancedMesh(strand, wool, count);
    let k = 0;
    for (const { centre, r, colours, n, fat } of list) {
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - u * u);
      d.set(Math.cos(a) * s, u, Math.sin(a) * s);
      q.setFromUnitVectors(UP, d.clone().add(V(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3)).normalize());
      const thick = (1 + rand() * 0.9) * fat;
      mesh.setMatrixAt(k, M.compose(centre.clone().addScaledVector(d, r * (fat > 1 ? 0.5 : 0.3)), q, V(thick, r * (fat > 1 ? 0.5 : 0.66 + 0.12 * rand()), thick)));
      mesh.setColorAt(k++, c.set(colours[Math.floor(rand() * rand() * colours.length)]).lerp(white, rand() * 0.16).multiplyScalar(0.8 + 0.3 * rand()));
    }
    }
    mesh.castShadow = close;
    mesh.receiveShadow = true;
    kit.group.add(mesh);
    total += count;
  }
  return total;
}

/** A tree of three cones of felt, their hems cut with pinking shears. Its cloth goes into the kit's heaps, by colour. */
export function coneTree(kit, x, z, h, greens) {
  const y0 = kit.mound(x, z) + 0.1, base = h * 0.3, { rand } = kit, close = kit.away(x, z) < 34;
  kit.trunks.push(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 8).translate(x, y0 + 0.27, z));
  for (let t = 0; t < 3; t++) {
    const R = base * (1 - t * 0.25), tall = h * 0.44, y = y0 + 0.4 + t * h * 0.25, around = close ? 28 : 16;
    const g = new THREE.CylinderGeometry(0.015, R, tall, around, close ? 5 : 2, true), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < -tall / 2 + 1e-4) { const k = Math.round((Math.atan2(p.getZ(i), p.getX(i)) / TAU) * around); if (((k % 2) + 2) % 2) p.setY(i, p.getY(i) + 0.1); }
      uv.setXY(i, uv.getX(i) * TAU * R * 0.6, uv.getY(i) * tall);
    }
    g.rotateY(rand() * 6).translate(x, y + tall / 2, z);
    g.computeVertexNormals();
    (kit.cones[greens[t % greens.length]] ??= []).push(g);
    if (!close) continue;
    const at = 0.2, ring = R * (1 - at / tall) + 0.012, count = Math.round((TAU * ring) / 0.2);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      kit.stitches.add(V(x + Math.cos(a) * ring, y + at, z + Math.sin(a) * ring), V(-Math.sin(a), 0, Math.cos(a)), 0.11, '#f3ecdc');
      if (i % 3 === 0) kit.bead(V(x + Math.cos(a + 0.3) * (ring - 0.24 * (R / tall)), y + at + 0.24, z + Math.sin(a + 0.3) * (ring - 0.24 * (R / tall))), 0.045, ['#e3b54a', '#c2473d', '#f3ecdc'][((i % 9) / 3) | 0]);
    }
  }
  if (close) kit.bead(V(x, y0 + 0.4 + 2 * h * 0.25 + h * 0.44 + 0.07, z), 0.11, '#e3b54a');
  kit.colliders.push({ x, z, r: base * 0.8, h });
}
export function buildCones(kit) {
  for (const [hex, list] of Object.entries(kit.cones)) {
    const mesh = cast(new THREE.Mesh(mergeGeometries(list), kit.feltTwo(hex)));
    kit.group.add(mesh);
    kit.fuzz?.(mesh, 170, { colour: hex, long: 0.075 });
  }
  if (kit.trunks.length) kit.group.add(cast(new THREE.Mesh(mergeGeometries(kit.trunks), new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.7 }))));
}

// ================= animals and crops =================
/** A flock: cotton-wool bodies, black felt faces, stick legs. They shuffle about a frame at a time. */
export function sheep(kit, x, z, count, spread) {
  const { rand } = kit;
  const body = lump(7.7, 3).scale(0.58, 0.44, 0.42);
  const dark = mergeGeometries([
    new THREE.SphereGeometry(1, 12, 9).scale(0.15, 0.17, 0.21).rotateX(0.5).translate(0, 0.12, 0.52),
    new THREE.SphereGeometry(1, 8, 6).scale(0.09, 0.035, 0.05).rotateZ(0.5).translate(0.17, 0.2, 0.46), new THREE.SphereGeometry(1, 8, 6).scale(0.09, 0.035, 0.05).rotateZ(-0.5).translate(-0.17, 0.2, 0.46),
    ...[[0.2, 0.26], [-0.2, 0.26], [0.2, -0.26], [-0.2, -0.26]].map(([lx, lz]) => new THREE.CylinderGeometry(0.035, 0.03, 0.42, 6).translate(lx, -0.5, lz)),
  ]);
  const flock = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * spread, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    if (kit.toRoad(sx, sz) < 1.6 || kit.toRiver(sx, sz) < 2.2) continue;
    const one = new THREE.Group(), k = 0.85 + 0.4 * rand();
    const fleece = cast(new THREE.Mesh(body, kit.cotton));
    one.add(fleece, cast(new THREE.Mesh(dark, kit.felt('#2b2622'))));
    kit.fuzz?.(fleece, 330, { colour: '#fbfaf5', long: 0.1, thick: 1.3, seed: 60 + i });
    one.scale.setScalar(k);
    one.position.set(sx, kit.mound(sx, sz) + 0.2 + 0.7 * k, sz);
    one.rotation.y = rand() * TAU;
    one.userData = { y: one.position.y, turn: one.rotation.y, i };
    kit.group.add(one);
    flock.push(one);
    kit.colliders.push({ x: sx, z: sz, r: 0.42 * k, h: 1 });
  }
  kit.onStep.push((n) => flock.forEach((s) => {
    const { y, turn, i } = s.userData, beat = (n + i * 11) % 46;
    s.position.y = y + (beat < 2 ? 0.05 : 0);
    s.rotation.x = beat > 20 && beat < 38 ? 0.16 : 0; // head down to the grass
    s.rotation.y = turn + 0.3 * Math.round(2 * Math.sin((n + i * 31) * 0.011 + i));
  }));
}

/** Bales: short rolls of gold corduroy left about a field. */
export function bales(kit, x, z, count, spread, size = 1) {
  const { rand } = kit, g = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 22, 1).rotateZ(Math.PI / 2), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 0.8, uv.getX(i) * 3.14);
  const mesh = new THREE.InstancedMesh(g, kit.fabrics.corduroy('#d9a640', { wale: 0.9 }), count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const bx = x + (rand() - 0.5) * spread * 2, bz = z + (rand() - 0.5) * spread * 2;
    q.setFromAxisAngle(UP, rand() * 6);
    mesh.setMatrixAt(i, M.compose(V(bx, kit.mound(bx, bz) + 0.12 + 0.5 * size, bz), q, V(size, size, size)));
    kit.colliders.push({ x: bx, z: bz, r: 0.5 * size, h: size });
  }
  kit.group.add(cast(mesh));
}

/**
 * Long grass: felt fringe. Strips of green felt snipped into tongues, as anyone would cut them with scissors, and
 * sewn down in rows: every blade of a row is the one felt and near enough the one height, each a flat piece with a
 * cut point and the felt's own thickness. It leans away from him as he goes through and closes behind. `who` is
 * { value: Vector3 } (where he is); `sway` { value } moves it.
 */
export function grass(kit, patches, who, sway) {
  const { rand } = kit, blades = [], FELTS = ['#6f9a4e', '#7aa353', '#5f9148'], ROW = 0.2, WIDE = 0.125;
  const foot = kit.surface ?? ((x, z) => kit.mound(x, z) + 0.15);
  for (const [cx, cz, r] of patches) {
    let row = 0;
    for (let z = cz - r * 0.85; z <= cz + r * 0.85; z += ROW, row++) {
      const half = r * 1.25 * Math.sqrt(Math.max(0, 1 - ((z - cz) / (r * 0.85)) ** 2)), tall = 0.56 + 0.14 * rand(), felt = (row + Math.floor(rand() * 2)) % FELTS.length, wob = rand() * 6;
      for (let x = cx - half + (row % 2) * WIDE * 0.5; x <= cx + half; x += WIDE) {
        const bz = z + 0.03 * Math.sin(x * 1.3 + wob);
        if (kit.toRoad(x, bz) < 0.85) continue;
        blades.push(x, foot(x, bz) - 0.03, bz, tall * (0.95 + 0.1 * rand()), felt);
        // each row is sewn down along its foot
        if (kit.surface && Math.round(x / WIDE) % 2 === 0) kit.stitches.add(V(x, foot(x, bz + 0.05) + 0.012, bz + 0.05), V(1, 0, 0.08), 0.075, '#e9dfc8', 0.85);
      }
    }
  }
  // one tongue of the fringe: a long blade snipped to a blunt point, as thick as felt is
  const blade = new THREE.BoxGeometry(WIDE * 0.88, 1, 0.022, 1, 3, 1).translate(0, 0.5, 0), p = blade.attributes.position, uv = blade.attributes.uv;
  for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * [1, 0.92, 0.66, 0.2][Math.round(p.getY(i) * 3)]); uv.setXY(i, p.getX(i) + p.getZ(i), p.getY(i) * 0.55); }
  blade.computeVertexNormals();
  // (seen from as close as he gets to it, felt's fibres have to be fine: this felt is drawn four times as finely
  // as the felt of a wall)
  const material = kit.fabrics.felt('#ffffff', { normalScale: new THREE.Vector2(1.5, 1.5) });
  for (const key of ['map', 'normalMap']) { material[key] = material[key].clone(); material[key].repeat.set(1 / 0.32, 1 / 0.32); }
  material.onBeforeCompile = (s) => {
    s.uniforms.uWho = who; s.uniforms.uSway = sway;
    s.vertexShader = 'uniform vec3 uWho; uniform float uSway;\n' + s.vertexShader.replace('#include <project_vertex>', /* glsl */ `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec2 foot = instanceMatrix[3].xz;
        float tall = length(instanceMatrix[1].xyz), up = position.y * position.y;
        vec2 from = foot - uWho.xz;
        float push = (1.0 - smoothstep(0.3, 1.3, length(from))) * step(abs(instanceMatrix[3].y - uWho.y), 1.6);
        vec2 lean = normalize(from + 1e-4) * push * 0.6 + vec2(sin(uSway + foot.x * 0.7 + foot.y * 0.3), cos(uSway * 0.8 + foot.y * 0.6)) * 0.04;
        mvPosition.xz += lean * up * tall;
        mvPosition.y -= push * 0.35 * up * tall;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const STRIDE = 5, mesh = new THREE.InstancedMesh(blade, material, blades.length / STRIDE);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (let i = 0; i < blades.length / STRIDE; i++) {
    const k = i * STRIDE;
    // they stand as they were sewn: all one way, none quite upright
    q.setFromEuler(e.set((rand() - 0.5) * 0.22, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.12));
    mesh.setMatrixAt(i, M.compose(V(blades[k], blades[k + 1], blades[k + 2]), q, V(1, blades[k + 3], 1)));
    mesh.setColorAt(i, c.set(FELTS[blades[k + 4]]).multiplyScalar(0.97 + 0.06 * rand()));
  }
  // (lit evenly: among so many small pieces the lamp's shadows are only noise. The creases between them are shaded
  // by the camera, like everything else)
  mesh.frustumCulled = false;
  kit.group.add(mesh);
  return blades.length / STRIDE;
}

/** Flowers: pins with glass heads, stuck in the quilt in drifts beside the road. */
export function flowers(kit, drifts) {
  const { rand } = kit, pins = [];
  const HEADS = ['#f3ecdc', '#e3b54a', '#c2473d', '#e4a8a2', '#f6f1e6', '#f0cf68', '#d9765f', '#a9c6d6', '#b79ad6'];
  for (const [cx, cz, count, r] of drifts) {
    const tone = HEADS[Math.floor(rand() * HEADS.length)];
    for (let i = 0; i < count; i++) {
      const x = cx + (rand() - 0.5) * r * 2, z = cz + (rand() - 0.5) * r * 2;
      if (kit.toRoad(x, z) < 0.8) continue;
      pins.push({ x, y: kit.mound(x, z) + 0.14, z, dir: V((rand() - 0.5) * 0.5, 1, (rand() - 0.5) * 0.5).normalize(), len: 0.36 + 0.3 * rand(), colour: rand() < 0.7 ? tone : HEADS[Math.floor(rand() * HEADS.length)] });
    }
  }
  const shafts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 }), pins.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.066, 12, 9), new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }), pins.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pins.forEach((p, i) => {
    q.setFromUnitVectors(UP, p.dir);
    shafts.setMatrixAt(i, M.compose(V(p.x, p.y, p.z), q, V(1, p.len, 1)));
    heads.setMatrixAt(i, M.compose(V(p.x, p.y, p.z).addScaledVector(p.dir, p.len), q, V(1, 1, 1)));
    heads.setColorAt(i, c.set(p.colour));
  });
  kit.group.add(cast(shafts), cast(heads));
}

// ================= the river and the road =================
/** The river: a blue satin ribbon sewn down along the valley, with sequins on it that catch the light. */
export function river(kit, line, wide = 2.7, lift = 0.29) {
  const { rand } = kit, S = kit.surface, R = 0.17, D = R * 0.7;
  // (on a quilt that knows its own surface the ribbon lies over the patches' puff, bridging their seams, and rides
  // over the binding at the edge; elsewhere it is held clear of the land)
  const top = S ? (x, z) => Math.max(S(x, z), S(x + R, z), S(x - R, z), S(x, z + R), S(x, z - R), S(x + D, z + D), S(x - D, z + D), S(x + D, z - D), S(x - D, z - D)) + 0.02 : (x, z) => kit.mound(x, z) + lift;
  const lie = (x, z) => Math.max(kit.onQuilt(x, z) ? top(x, z) : 0.02, kit.rim?.(x, z) ?? 0);
  const pts = line.map(([x, z]) => V(x, 0, z));
  kit.group.add(cast(new THREE.Mesh(S ? ribbon(pts, wide, lie, { across: 8, sub: 2 }) : strip(pts, wide, lie, 0), kit.fabrics.satin('#2c7bd0', { roughness: 0.42, sheen: 0.25 }))));
  const STRIDE = 8, sequins = [], n = V(0, 0, 0); // [x, y, z, size, turn, and the way the ribbon faces there]
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1 || !kit.onQuilt(p.x, p.z)) return;
    const t = V(pts[i + 1].x - pts[i - 1].x, 0, pts[i + 1].z - pts[i - 1].z).normalize(), side = V(-t.z, 0, t.x);
    if (i % 2 === 0 && kit.away(p.x, p.z) < 45) for (const s of [-1, 1]) { const e = p.clone().addScaledVector(side, s * (wide / 2 - 0.13)); kit.stitches.add(V(e.x, lie(e.x, e.z) + 0.014, e.z), t, 0.14 * Math.min(1, wide / 2), '#e6f0f7', 1.1); }
    for (let k = 0; k < 2; k++) {
      const e = p.clone().addScaledVector(side, (rand() - 0.5) * (wide - 0.5)).addScaledVector(t, rand() * 0.4), h = 0.12;
      n.set(lie(e.x - h, e.z) - lie(e.x + h, e.z), 2 * h, lie(e.x, e.z - h) - lie(e.x, e.z + h)).normalize();
      sequins.push(e.x, lie(e.x, e.z) + 0.016, e.z, (0.7 + 0.7 * rand()) * Math.min(1, wide / 2), rand() * 6, n.x, n.y, n.z);
    }
  });
  const count = sequins.length / STRIDE;
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 10), new THREE.MeshPhysicalMaterial({ metalness: 0.35, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6, emissive: new THREE.Color('#9cc8ff'), emissiveIntensity: 0.3 }), count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), tip = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const lay = (i, f) => {
    const k = i * STRIDE, h = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453, r1 = h - Math.floor(h), r2 = (r1 * 57.31) % 1;
    // it lies flat on the ribbon, tipped a very little: a different little on each frame of the film, which is what
    // makes water of it
    q.setFromUnitVectors(UP, n.set(sequins[k + 5], sequins[k + 6], sequins[k + 7])).multiply(tip.setFromEuler(e.set((r1 - 0.5) * 0.3, sequins[k + 4], (r2 - 0.5) * 0.3)));
    mesh.setMatrixAt(i, M.compose(V(sequins[k], sequins[k + 1], sequins[k + 2]), q, V(sequins[k + 3], 1, sequins[k + 3])));
  };
  for (let i = 0; i < count; i++) { lay(i, 0); mesh.setColorAt(i, c.set(['#eef5fb', '#cfe6f8', '#ffffff', '#b9dcf5', '#fff3d0'][Math.floor(rand() * 5)])); }
  mesh.receiveShadow = true;
  kit.group.add(mesh);
  // the water moves: a third of the sequins are tipped a new way on each frame of the film
  kit.onStep.push((f) => { for (let i = f % 3; i < count; i += 3) lay(i, f); mesh.instanceMatrix.needsUpdate = true; });
}

/** The road: a yellow tape measure, run out from the hilltop to the village and sewn down along both edges. */
export function road(kit, line) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 8192;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = rng(4);
  ctx.fillStyle = '#f0c12e'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '120,80,0' : '255,240,170'},${r() * 0.07})`; ctx.fillRect(0, r() * H, W, 1 + r() * 3); }
  ctx.fillStyle = '#1c1a17';
  ctx.font = 'bold 104px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // the picture is one tape's width across and a hundred metres of it down: two hundred centimetres of tape
  for (let cm = 0; cm < 200; cm++) {
    const y = (cm / 200) * H, long = cm % 10 === 0 ? 0.34 : cm % 5 === 0 ? 0.24 : 0.14;
    ctx.fillRect(0, y - 1.5, W * long, 3.2);
    ctx.fillRect(W * (1 - long * 0.5), y - 1.5, W * long * 0.5, 3.2);
    if (cm % 10 === 5) { ctx.save(); ctx.translate(W * 0.57, y); ctx.rotate(Math.PI / 2); ctx.scale(0.42, 1); ctx.fillText(String(cm + 5), 0, 0); ctx.restore(); }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;
  map.repeat.set(1, 1 / 100);
  const lie = (x, z) => kit.mound(x, z) + 0.345;
  const pts = line.map(([x, z]) => V(x, 0, z));
  const tape = cast(new THREE.Mesh(strip(pts, 1.0, lie, 0), new THREE.MeshPhysicalMaterial({ map, roughness: 0.8, normalMap: kit.fabrics.weaves.plain, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide })));
  kit.group.add(tape);
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1 || i % 2) return;
    const t = V(pts[i + 1].x - pts[i - 1].x, 0, pts[i + 1].z - pts[i - 1].z).normalize(), side = V(-t.z, 0, t.x);
    for (const s of [-1, 1]) { const e = p.clone().addScaledVector(side, s * 0.44); kit.stitches.add(V(e.x, lie(e.x, e.z) + 0.012, e.z), t, 0.13, '#b8433a', 1); }
  });
}

// ================= the sky and what stands against it =================
/** Clouds of cotton wool, each hung on a thread. */
export function clouds(kit, list, glow = 0.5, drift = 1.2, fine = 1) {
  const wisp = new THREE.CylinderGeometry(0.004, 0.009, 1, 4).translate(0, 0.5, 0);
  // (lit from behind by a low sun, a cloud still glows: cotton wool lets the light through)
  const wispy = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: new THREE.Color('#ffd2b0'), emissiveIntensity: glow });
  const cottony = new THREE.MeshPhysicalMaterial({ color: '#fbfaf5', roughness: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 1, emissive: new THREE.Color('#ffc9a6'), emissiveIntensity: glow });
  const all = [];
  for (const [x, y, z, s, seed] of list) {
    const r = rng(seed * 91), parts = [], n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const g = lump(seed * 10 + i, 3), k = 0.55 + 0.5 * r();
      g.scale(k * 1.15, k * 0.8, k);
      g.translate((i - (n - 1) / 2) * 0.62 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.35 + (Math.abs(i - (n - 1) / 2) < 1 ? 0.3 : 0), (r() - 0.5) * 0.6);
      parts.push(g);
    }
    const cloud = new THREE.Group(), body = mergeGeometries(parts);
    cloud.add(cast(new THREE.Mesh(body, cottony), false));
    const bp = body.attributes.position, bn = body.attributes.normal, count = Math.round(1300 / fine), wisps = new THREE.InstancedMesh(wisp, wispy, count);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const k = Math.floor(r() * bp.count);
      q.setFromUnitVectors(UP, V(bn.getX(k), bn.getY(k), bn.getZ(k)).add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.1)).normalize());
      wisps.setMatrixAt(i, M.compose(V(bp.getX(k), bp.getY(k), bp.getZ(k)), q, V(fine, (0.05 + 0.1 * r() * r()) * fine, fine)));
    }
    cloud.add(wisps);
    cloud.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 60, 5).translate(0, 30.4, 0), kit.fabrics.thread('#d8d2c4')));
    if (glow === 0) cloud.children[0].castShadow = true;
    cloud.scale.setScalar(s);
    cloud.position.set(x, y, z);
    cloud.userData = { x, y, seed };
    kit.group.add(cloud);
    all.push(cloud);
  }
  kit.onStep.push((n) => all.forEach((c) => {
    c.position.y = c.userData.y + 0.25 * drift * Math.sin(n * 0.05 + c.userData.seed * 2);
    c.position.x = c.userData.x + drift * Math.sin(n * 0.012 + c.userData.seed);
    c.rotation.y = 0.12 * Math.sin(n * 0.03 + c.userData.seed);
  }));
}

/** A mountain: a great cone of knitting, pulled into ridges, with a cap of white wool that comes down in points. */
export function mountain(kit, x, z, r, h, hex, seed, STITCH = 2.1, hat = false) {
  const AROUND = 120, RINGS = 46;
  // (a mountain is hollow-sided and rough; a hat is the same knitting, full-sided and even)
  const rise = hat ? (t) => (1 - t ** 1.7) ** 0.85 + 0.012 : (t) => (1 - t) ** 1.25 + 0.012, rough = hat ? 0.3 : 1;
  const shape = (a, t) => r * rise(t) * (1 + rough * (0.2 * noise(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + t * 1.5) + 0.07 * noise(Math.cos(a) * 5 + seed, Math.sin(a) * 5 + t * 4)) * (1 - 0.6 * t));
  const knit = (from, swell, material, wavy) => {
    const pos = [], uv = [], index = [], across = Math.round((TAU * r) / (16 * STITCH));
    for (let j = 0; j <= RINGS; j++) for (let i = 0; i <= AROUND; i++) {
      const a = (i / AROUND) * TAU, low = wavy ? from + 0.05 * Math.sin(a * 7 + seed) + (i % 2 ? 0.035 : 0) : from;
      const t = low + (1 - low) * (j / RINGS), rad = shape(a, t) + swell * (1 - 0.5 * t);
      pos.push(x + Math.sin(a) * rad, h * t - (j === 0 ? 0.05 : 0), z - Math.cos(a) * rad);
      uv.push((i / AROUND) * across, (t * Math.hypot(h, r)) / (12 * STITCH * 0.8));
      if (i < AROUND && j < RINGS) { const k = i + j * (AROUND + 1); index.push(k, k + AROUND + 1, k + 1, k + 1, k + AROUND + 1, k + AROUND + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.receiveShadow = true;
    kit.group.add(mesh);
  };
  knit(0, 0, kit.knit(hex), false);
  knit(0.6 + 0.06 * Math.sin(seed), 0.9 * (STITCH / 2.1), kit.knit('#f4f1ea'), true);
}

/** The sky: a great sheet dyed from blue down to gold and hung in soft folds all round, and the sun low in it. */
export function sky(kit, sun) {
  const sheet = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 24), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: sun.clone().normalize() } },
    vertexShader: /* glsl */ `out vec3 vWay; void main() { vWay = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uSun; in vec3 vWay;
      layout(location = 0) out vec4 outC;
      void main() {
        vec3 d = normalize(vWay);
        // gold where it meets the land, rose above that, then blue, deeper the higher
        vec3 c = mix(vec3(1.3, 0.72, 0.3), vec3(0.95, 0.6, 0.55), smoothstep(-0.01, 0.1, d.y));
        c = mix(c, vec3(0.34, 0.5, 0.86), smoothstep(0.06, 0.26, d.y));
        c = mix(c, vec3(0.1, 0.24, 0.62), smoothstep(0.22, 0.8, d.y));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.5, 0.7, 0.2) * (0.45 * pow(s, 6.0) + 1.3 * pow(s, 48.0));
        // the folds it hangs in
        float a = atan(d.x, d.z);
        c *= 1.0 + 0.04 * sin(a * 52.0 + 2.2 * sin(a * 9.0)) * smoothstep(0.6, 0.0, d.y);
        outC = vec4(c, 1.0);
      }`,
  }));
  sheet.frustumCulled = false;
  kit.group.add(sheet);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 3.0, 0.62), fog: false }));
  disc.position.copy(sun).normalize().multiplyScalar(480);
  kit.group.add(disc);
}

/** What lies about on the table beyond the quilt: the size they really are, which is what says how small the rest is. */
export function sewingThings(kit) {
  const { fabrics } = kit;
  const wound = fabrics.weaves.cord.clone();
  wound.rotation = Math.PI / 2;
  wound.repeat.set(1, 26);
  const wood = new THREE.MeshStandardMaterial({ color: '#d2a56c', roughness: 0.6 });
  const profile = [[0, 0], [0.36, 0], [0.38, 0.03], [0.36, 0.07], [0.2, 0.1], [0.2, 0.9], [0.36, 0.93], [0.38, 0.97], [0.36, 1], [0.1, 1], [0.1, 0.96], [0, 0.96]].map(([r, y]) => new THREE.Vector2(r, y));
  const spoolGeometry = new THREE.LatheGeometry(profile, 32), threadGeometry = new THREE.CylinderGeometry(0.31, 0.31, 0.78, 32, 1, true).translate(0, 0.5, 0);
  /** A spool of thread: on the quilt it is a silo, off it a tower. */
  const spool = (x, z, colour, scale, onLand = false) => {
    const g = new THREE.Group();
    g.add(cast(new THREE.Mesh(spoolGeometry, wood)), cast(new THREE.Mesh(threadGeometry, new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.55, normalMap: wound, normalScale: new THREE.Vector2(1.4, 1.4), sheen: 1, sheenColor: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.5), sheenRoughness: 0.35 }))));
    g.scale.setScalar(scale);
    g.position.set(x, onLand ? kit.mound(x, z) + 0.1 : -0.05, z);
    g.rotation.y = x;
    kit.group.add(g);
    kit.colliders.push({ x, z, r: 0.4 * scale, h: scale * 1.1 });
  };
  // the tomato pincushion, far off, bigger than the church
  const pincushion = (x, z, R) => {
    const body = new THREE.SphereGeometry(R, 44, 26), p = body.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), pinch = 1 - 0.07 * Math.abs(Math.cos(a * 3)) ** 8; p.setXYZ(i, p.getX(i) * pinch, p.getY(i) * 0.62, p.getZ(i) * pinch); }
    body.computeVertexNormals();
    const cushion = cast(new THREE.Mesh(body, kit.felt('#c2473d')));
    cushion.position.set(x, R * 0.6, z);
    kit.group.add(cushion);
    kit.fuzz?.(cushion, 150, { colour: '#c2473d', long: 0.07 });
    kit.colliders.push({ x, z, r: R * 0.95, h: R * 1.2 });
    const r = rng(9), shaft = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.3 });
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, lift = 0.5 + r() * 0.9, d = V(Math.cos(a) * Math.cos(lift), Math.sin(lift), Math.sin(a) * Math.cos(lift)), len = R * (0.5 + 0.4 * r());
      const pin = cast(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.012, R * 0.012, len, 6).translate(0, len / 2, 0), shaft));
      pin.position.set(x + d.x * R * 0.95, R * 0.6 + d.y * R * 0.58, z + d.z * R * 0.95);
      pin.quaternion.setFromUnitVectors(UP, d);
      const head = cast(new THREE.Mesh(new THREE.SphereGeometry(R * 0.075, 14, 10), new THREE.MeshPhysicalMaterial({ color: ['#f3ecdc', '#e3b54a', '#a9c6d6', '#f0cf68'][i % 4], roughness: 0.18, clearcoat: 1 })));
      head.position.copy(pin.position).addScaledVector(d, len);
      kit.group.add(pin, head);
    }
  };
  return { spool, pincushion };
}

