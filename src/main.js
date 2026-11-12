// Patchwork: worlds sewn from scraps, and a rag doll to walk about in them, filmed the way a puppet film is: he
// goes where the player sends him at once, but his pose is taken a set number of times a second and held between.
// P changes how many (15, 24, every frame, 12).
//   ?scene=table   the first scene, a small quilt on a sewing table
//   ?scene=country the big valley under a painted sky
//   (otherwise: the country quilt, a small country sewn into one quilt on the table it is being made on)
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?fps=15        how many poses a second (0: every frame)
//   ?lens=0        no blur away from the plane of focus, for looking at the making
//   ?ao=0          no shading of the creases (1: as dark as it goes)
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../recipe.json';
import RAPIER from './figure/rapier/rapier.mjs';
import { createFabrics } from './fabric.js';
import { createDoll } from './doll.js';
import { createPost } from './post.js';
import { Animator } from './figure/animator.js';
import { Player } from './figure/player.js';
import { Input } from './figure/input.js';
import { Follow } from './figure/camera.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };
const loading = document.getElementById('loading');
// Patch's page talks to the demo through this. There are no controls; it carries loading, ready and hiding.
let shown = true, loaded = false, told = 0.02;
const block = patchBlock({ ...recipe.block, onSet() {}, onTrigger() {}, onVisible(visible) { shown = visible; if (loaded) run(); } });
const say = (text) => { told = Math.min(0.95, told + 0.11); if (loading) loading.textContent = text; block.progress(told, text); };
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('view').appendChild(renderer.domElement);
// Listened for from the start, not once loaded: the page may go fullscreen while the quilt is still being sewn.
// The camera and the finishing passes join in once they exist.
const fitting = [];
function fitView() {
  const now = renderer.getSize(new THREE.Vector2());
  if (now.x !== innerWidth || now.y !== innerHeight) renderer.setSize(innerWidth, innerHeight);
  for (const fit of fitting) fit();
}
addEventListener('resize', fitView);

const scene = new THREE.Scene();
lap('start');

say('Cutting cloth');
await turn();
const fabrics = createFabrics();
lap('cloth');
const dollComing = createDoll(fabrics, () => {});
const which = q.get('scene');
const { createWorld } = await (which === 'table' ? import('./table-world.js') : which === 'country' ? import('./country/world.js') : import('./making/world.js'));
const world = await createWorld({ fabrics, renderer, scene, say, turn });
const ground = world.ground;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, world.far);
fitting.push(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
lap('world');

await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const { cells, size, centre: [cx, cz] } = world.field, heights = new Float32Array((cells + 1) * (cells + 1));
  for (let col = 0; col <= cells; col++) for (let row = 0; row <= cells; row++) heights[row + col * (cells + 1)] = ground(cx - size / 2 + (col / cells) * size, cz - size / 2 + (row / cells) * size);
  physics.createCollider(RAPIER.ColliderDesc.heightfield(cells, cells, heights, { x: size, y: 1, z: size }).setTranslation(cx, 0, cz));
  for (const c of world.colliders) physics.createCollider(RAPIER.ColliderDesc.cylinder(c.h / 2, c.r).setTranslation(c.x, ground(c.x, c.z) + c.h / 2, c.z));
  for (const b of world.boxes) physics.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(b.x, b.y, b.z).setRotation({ x: 0, y: Math.sin(b.turn / 2), z: 0, w: Math.cos(b.turn / 2) }));
}
lap('physics');

say('Stuffing the doll');
const doll = await dollComing;
const { man } = doll;
scene.add(doll.group);
const animator = new Animator(man);
const START = world.start;
const spawn = new THREE.Vector3(START.x, ground(START.x, START.z), START.z);
const player = new Player({ RAPIER, world: physics, man, animator, spawn, yaw: START.yaw });
const follow = new Follow(camera);
Object.assign(follow, { yaw: START.yaw, ...world.follow, distance: world.follow.want });
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
physics.step();
lap('doll');

const post = createPost(renderer);
fitting.push(() => post.resize());
Object.assign(post, world.lens);
world.attach?.(post);
if (q.has('lens')) post.lens = +q.get('lens');
if (q.has('ao')) post.deep = +q.get('ao');

// the air: nearly still
const air = (x, y, z, out) => out.set(0.12 * Math.sin(time * 0.7 + z), 0, 0.1 * Math.cos(time * 0.5 + x));
let time = 0, film = 1, frame = 0, held = 1;
// how many times a second the doll is posed. 0: on every frame
const RATES = [15, 24, 0, 12];
let rate = q.has('fps') ? +q.get('fps') : RATES[0];

function place(x, z, yaw) {
  const y = ground(x, z), half = player.halfHeight();
  player.body.setTranslation({ x, y: y + player.t.radius + half + 0.05, z }, true);
  physics.propagateModifiedBodyPositionsToColliders();
  player.feet.set(x, y, z); player.prevFeet.copy(player.feet); player.visualY = y;
  player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move'; player.grounded = true;
  player.yaw = player.lastYaw = yaw;
  animator.lock = null; animator.lockOff = null;
  animator.enter(animator.locoState({ strafe: false }), 0.05);
}

const lab = { focus: null };
const chest = new THREE.Vector3();
function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  player.update(dt, inp, follow.yaw);
  if (player.feet.y < -6) place(spawn.x, spawn.z, START.yaw); // off the edge of the table
  const root = player.visualRoot(dt);
  man.object.position.copy(root);
  man.object.rotation.set(0, player.yaw, 0);
  man.object.updateMatrixWorld(true);
  const local = player.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);
  animator.update(dt, { speed: player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: player.grounded });
  animator.relaxHands(player.speed);
  animator.uprightTrunk(dt, player.speed, player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3);
  const lookW = player.mode === 'move' || player.mode === 'idleExtra' ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
  animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW);
  animator.armClearance(dt);
  if (player.mode === 'move' && !player.strafe) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
  else animator.leanInto(dt, 0, 0, 0);
  const onGround = player.grounded && player.mode !== 'jump' && player.mode !== 'air';
  animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), root.y, onGround ? 1 : 0);
  man.object.updateMatrixWorld(true);
  // (the cape asks where the ground is thousands of times a frame: it is told the slope he is standing on, once)
  const g0 = ground(root.x, root.z), gx = (ground(root.x + 0.7, root.z) - ground(root.x - 0.7, root.z)) / 1.4, gz = (ground(root.x, root.z + 0.7) - ground(root.x, root.z - 0.7)) / 1.4;
  doll.simulate(dt, air, (x, z) => g0 + gx * (x - root.x) + gz * (z - root.z));

  // he is where the player has sent him on every frame; his pose is taken from the bones only so many times a second
  doll.follow();
  held += dt;
  if (!rate || held >= 1 / rate) { held = rate ? held % (1 / rate) : 0; doll.pose(); }
  // the film: twelve frames a second. On each, whatever moves in the world is moved on, and the light is never
  // quite as bright as it was
  film += dt;
  if (film >= 1 / 12) {
    film %= 1 / 12;
    frame++;
    world.step(frame);
    post.develop.uExposure.value = 1 + 0.012 * Math.sin(frame * 12.9898) * Math.cos(frame * 4.1414);
  }

  follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => {
    const hit = player.castRay(o, d, max);
    return hit != null && o.y + d.y * hit - ground(o.x + d.x * hit, o.z + d.z * hit) > 0.5 ? hit : null;
  }, (x, z) => ground(x, z) + 0.15);
  camera.updateMatrixWorld(true);
  world.update(dt, root, camera);
  post.develop.uTime.value = frame;
  chest.set(root.x, root.y + 1.25, root.z);
  post.render(scene, camera, lab.focus ?? (follow.free ? follow.free.position.distanceTo(follow.free.target) : camera.position.distanceTo(chest)));
}

window.lab = Object.assign(lab, {
  THREE, player, follow, camera, input, animator, doll, post, renderer, scene, timings, ground, world,
  counts: world.counts,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  setInput(fn) { input.override = fn; },
  /** How many times a second he is posed (0: every frame). */
  setRate(n) { rate = n; held = 1; },
  /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
  teleport(x, z, fx, fz) {
    place(x, z, Math.atan2(fx - x, fz - z));
    follow.yaw = player.yaw; follow.pivot.set(0, 0, 0);
    held = 1;
    tick(1 / 60);
  },
  /** A fixed view for stills: eye and what it looks at (and focuses on). Call with nothing to follow him again. */
  view(eye, target) { follow.free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
});

say('Threading the needle');
await turn();
if (!capture) await renderer.compileAsync(scene, camera);
lap('shaders');
// The first frames are drawn before Patch is told the demo is ready, and each is waited for: the card builds a
// good deal the first time it draws a thing, after JavaScript has gone on, and that must not land after ready.
function gpuDone() {
  const gl = renderer.getContext(), sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 4);
      gl.deleteSync(sync);
      resolve();
    };
    poll();
  });
}
timings.warm = [];
for (let i = 0; i < (capture ? 3 : 6); i++) {
  const t = performance.now();
  tick(1 / 60);
  if (!capture) { await gpuDone(); say('Threading the needle'); await turn(); }
  timings.warm.push(Math.round(performance.now() - t));
}
lap('first frames');

let last = performance.now();
function run() {
  last = performance.now();
  renderer.setAnimationLoop(shown && !capture ? () => { const now = performance.now(); tick((now - last) / 1000); last = now; if ((timings.live ??= []).length < 6) timings.live.push(Math.round(performance.now() - now)); } : null);
}
fitView();
loaded = true;
run();
if (!capture) {
  const hint = document.getElementById('hint');
  const mode = document.getElementById('mode');
  let fade = 0;
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') hint.classList.toggle('off');
    if (e.code === 'KeyP') {
      rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
      held = 1;
      mode.textContent = rate ? `${rate} poses a second` : 'Smooth';
      mode.classList.remove('faded');
      clearTimeout(fade);
      fade = setTimeout(() => mode.classList.add('faded'), 1800);
    }
  });
  setTimeout(() => hint.classList.add('faded'), 9000);
} else document.getElementById('hint')?.remove();
loading?.remove();
block.ready();
lab.ready = true;
// for the measuring tools
window.__block = { ready: true, block, timings, set() {} };
