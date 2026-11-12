// What Patch's test times: every frame from ready on. Loads the built page as a player gets it (headless, muted),
// clicks the middle, holds W, and prints the longest gaps between frames with when they came.
//   node tools/gaps.mjs [--seconds 9]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const root = resolve(fileURLToPath(import.meta.url), '..', '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__gaps = [];
    let last = 0, t0 = 0;
    const frame = (now) => { if (window.__block?.ready) { if (!t0) t0 = now; else if (now - last > 50) window.__gaps.push([Math.round(now - t0), Math.round(now - last)]); last = now; } requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  const t = Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/?nopad`);
  await page.waitForFunction(() => window.__block?.ready, null, { timeout: 90000, polling: 50 });
  const ready = Date.now() - t;
  await page.waitForTimeout(1000);
  await page.mouse.click(640, 360);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout((Number(flag('seconds', 9)) - 2.5) * 1000);
  console.log(JSON.stringify({ ready, gapsOver50ms: await page.evaluate(() => window.__gaps), timings: await page.evaluate(() => window.__block.timings), errors }));
} finally {
  await browser.close();
  server.close();
}
