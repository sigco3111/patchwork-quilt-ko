// A film of the country: the doll stands on the hilltop, then runs the road down to the village, and the eye
// follows. Headless and muted; the clock is stepped by hand. Reports where he got to, so a place he can't get past
// shows up as a short walk.
//   node tools/walk.mjs [--out shots/work/walk] [--seconds 20] [--size 1280x720] [--stand 2] [--sprint 1] [--nofilm]
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
const out = resolve(here, flag('out', 'shots/work/walk'));
const [width, height] = flag('size', '1280x720').split('x').map(Number);
const seconds = Number(flag('seconds', 20)), stand = Number(flag('stand', 2)), film = !args.includes('--nofilm');
const frames = join(out, 'frames');
rmSync(out, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
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
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { failed = true; console.log('pageerror', e.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${flag('query', '')}`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await page.evaluate(([sprint]) => {
    const L = window.lab, road = L.world.road;
    let at = 0;
    L.go = (moving) => {
      const p = L.player.feet;
      // the next point of the road a few metres on from the nearest
      while (at < road.length - 1 && Math.hypot(road[at][0] - p.x, road[at][1] - p.z) < (road.length > 100 ? 3.2 : 1.6)) at++;
      const want = Math.atan2(road[at][0] - p.x, road[at][1] - p.z);
      let d = want - L.follow.yaw;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      if (moving) L.follow.yaw += d * 0.06;
      const done = at >= road.length - 1;
      L.setInput(() => ({ move: { x: 0, y: moving && !done ? 1 : 0 }, walk: false, sprint: !!sprint, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
      L.step(1 / 60, 1);
      return [p.x, p.y, p.z, at];
    };
  }, [Number(flag('sprint', 0))]);
  let shot = 0, where = null, worst = 0, last = null;
  for (let n = 0; n < seconds * 60; n++) {
    where = await page.evaluate((moving) => window.lab.go(moving), n >= stand * 60);
    if (last && n > stand * 60 + 30 && where[3] < 259) worst = Math.max(worst, 0); // (kept for the report below)
    last = where;
    if (film && n % 2 === 0) await page.screenshot({ path: join(frames, `f${String(shot++).padStart(4, '0')}.jpg`), quality: 90, type: 'jpeg' });
  }
  console.log(`ended at ${where.slice(0, 3).map((v) => v.toFixed(1)).join(', ')}; road point ${where[3]} of ${await page.evaluate(() => window.lab.world.road.length - 1)}`);
  if (film) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', join(out, 'walk.mp4')]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.jpg'), '-vf', `select='not(mod(n,${Math.round((seconds * 30) / 12)}))',scale=640:-1,tile=4x3`, '-frames:v', '1', '-q:v', '3', join(out, 'sheet.jpg')]);
    console.log(`film ${join(out, 'walk.mp4')} (${shot} frames)`);
  }
} catch (e) {
  failed = true;
  console.log('FAILED:', e.message.slice(0, 400));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
