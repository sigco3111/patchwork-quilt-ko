// Puts the doll through his paces (stand, walk, run, sprint, sharp turns, a jump, a stop) on the built page, headless
// and muted, and reports what the cape did: how deep any of it got into his body, whether any of it got in front of
// his back or above his collar. Saves a film and a sheet of frames to look at.
//   node tools/act.mjs [--out shots/work/act] [--dist 5.5] [--fps 15] [--size 1280x720] [--nofilm]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = resolve(here, flag('out', 'shots/work/act'));
const [width, height] = flag('size', '1280x720').split('x').map(Number);
const film = !args.includes('--nofilm');
const frames = join(out, 'frames'), tiles = join(out, 'tiles');
rmSync(out, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
mkdirSync(tiles, { recursive: true });
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

// [seconds, what he is told to do]
const ACT = [
  [1.0, {}], [1.3, { y: 1, walk: true }], [1.0, { y: 1 }], [0.6, { y: 1, sprint: true }], [0.7, { x: -1, sprint: true }], [1.0, { y: -1 }],
  [0.15, { x: 1, jump: true }], [1.0, { x: 1 }], [0.5, { x: -1, y: 1, sprint: true }], [0.15, { y: 1, jump: true, sprint: true }], [0.5, { y: 1, sprint: true }], [0.8, { x: 1, y: -1, sprint: true }], [1.6, {}],
];
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { failed = true; console.log('pageerror', e.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&fps=${flag('fps', 15)}`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await page.evaluate((dist) => {
    const L = window.lab;
    L.teleport(1.3, 8.4, 1.3, 0);
    L.follow.want = L.follow.distance = dist;
    L.worst = { depth: 0, deep: 0, front: 0, above: 0, frames: 0, where: '' };
    L.check = (label) => {
      const c = L.doll.cape, p = c.p, w = L.worst;
      w.frames++;
      for (let k = c.cols * 3; k < p.length; k += 3) {
        for (let s = 0; s < c.sticks.length; s++) {
          const e = s * 6, r = c.sticks[s][2];
          const ax = c.ends[e], ay = c.ends[e + 1], az = c.ends[e + 2], ex = c.ends[e + 3] - ax, ey = c.ends[e + 4] - ay, ez = c.ends[e + 5] - az;
          const len2 = ex * ex + ey * ey + ez * ez;
          const t = len2 > 1e-8 ? Math.max(0, Math.min(1, ((p[k] - ax) * ex + (p[k + 1] - ay) * ey + (p[k + 2] - az) * ez) / len2)) : 0;
          const d = r - Math.hypot(p[k] - ax - ex * t, p[k + 1] - ay - ey * t, p[k + 2] - az - ez * t);
          // (the rows under the collar lie on his shoulders by the way they are pinned)
          if (k < c.cols * 9) continue;
          if (d > 0.012) w.deep++;
          if (d > w.depth) { w.depth = d; w.where = `${label} ${c.sticks[s][0]}-${c.sticks[s][1]} row ${Math.floor(k / 3 / c.cols)}`; }
        }
        const f = (p[k] - c.C.x) * c.Z.x + (p[k + 1] - c.C.y) * c.Z.y + (p[k + 2] - c.C.z) * c.Z.z;
        if (p[k + 1] > c.hips.y && f > 0.001) w.front++;
        if (p[k + 1] > c.pins[((k / 3) % c.cols) * 3 + 1] + 0.001) w.above++;
      }
    };
  }, Number(flag('dist', 5.5)));
  let n = 0, shot = 0, tile = 0;
  for (const [seconds, order] of ACT) {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++, n++) {
      await page.evaluate(([o, label]) => {
        const L = window.lab;
        L.setInput(() => ({ move: { x: o.x ?? 0, y: o.y ?? 0 }, walk: !!o.walk, sprint: !!o.sprint, strafe: false, jump: !!o.jump, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
        L.step(1 / 60, 1);
        L.check(label);
      }, [order, JSON.stringify(order)]);
      if (film && n % 18 === 9) {
        // a close look at him, wherever he is in the picture
        const [cx, cy] = await page.evaluate(() => { const L = window.lab, v = new L.THREE.Vector3().copy(L.player.feet); v.y += 1; v.project(L.camera); return [v.x, v.y]; });
        const w = 300, h = 380, x = Math.round(Math.min(Math.max((cx * 0.5 + 0.5) * width - w / 2, 0), width - w)), y = Math.round(Math.min(Math.max((0.5 - cy * 0.5) * height - h / 2, 0), height - h));
        await page.screenshot({ path: join(tiles, `t${String(tile++).padStart(3, '0')}.jpg`), quality: 90, type: 'jpeg', clip: { x, y, width: w, height: h } });
      }
      if (film && n % 2 === 0) await page.screenshot({ path: join(frames, `f${String(shot++).padStart(4, '0')}.jpg`), quality: 88, type: 'jpeg' });
    }
  }
  console.log('cape:', JSON.stringify(await page.evaluate(() => { const w = window.lab.worst; return { ...w, depth: +w.depth.toFixed(3) }; })));
  if (film) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(out, 'act.mp4')]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(tiles, 't%03d.jpg'), '-vf', `tile=${Math.ceil(tile / 4)}x4`, '-frames:v', '1', '-q:v', '3', join(out, 'sheet.jpg')]);
    console.log(`film ${join(out, 'act.mp4')} (${shot} frames)`);
  }
} catch (e) {
  failed = true;
  console.log('FAILED:', e.message.slice(0, 400));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
