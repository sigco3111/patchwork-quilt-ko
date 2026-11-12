// Loads the built page as a player gets it (its own clock, no capture), headless and muted, lets it run, presses P
// to change how often the doll is posed, and prints any error with what the page said.
//   node tools/live.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
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
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?nopad`);
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const said = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyP'); said.push(await page.evaluate(() => document.getElementById('mode').textContent)); await page.waitForTimeout(300); }
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  const feet = await page.evaluate(() => { const p = window.lab.player.feet; return [p.x, p.y, p.z].map((v) => +v.toFixed(2)); });
  console.log(JSON.stringify({ said, feet, errors }));
} finally {
  await browser.close();
  server.close();
}
