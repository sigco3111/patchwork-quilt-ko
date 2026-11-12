// Cloth, made in code. A fabric is two things: what is printed on it (a picture drawn on a canvas: gingham, a
// stripe, small flowers) and what it is woven from (a height of threads, kept as a normal map, so the light finds
// every thread). Felt has no weave: it is matted fibre. Everything tiles, and one unit of a mesh's UV is one unit
// of the world, so a print is the same size on whatever it is sewn into.
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const TAU = Math.PI * 2;

/** A tiling height field (0..1, N by N) as a normal map, with the height kept in alpha. */
function normalsOf(h, N, strength) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const l = h[((x - 1 + N) % N) + y * N], r = h[((x + 1) % N) + y * N];
      const d = h[x + ((y - 1 + N) % N) * N], u = h[x + ((y + 1) % N) * N];
      const nx = (l - r) * strength, ny = (d - u) * strength, k = 1 / Math.hypot(nx, ny, 1);
      const i = (x + y * N) * 4;
      data[i] = Math.round((nx * k * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * k * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((k * 0.5 + 0.5) * 255);
      data[i + 3] = Math.round(Math.min(1, Math.max(0, h[x + y * N])) * 255);
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** The weaves: how high the threads stand, over one tile. */
function weave(kind, N = 256) {
  const h = new Float32Array(N * N), rand = rng(kind.length * 977 + 13);
  if (kind === 'plain' || kind === 'linen') {
    // warp over weft over warp: each thread is round across and dips where it goes under
    const threads = kind === 'linen' ? 20 : 32, p = N / threads;
    const fat = Array.from({ length: threads * 2 }, () => (kind === 'linen' ? 0.7 + 0.6 * rand() : 0.9 + 0.2 * rand()));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / p, v = y / p, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      const over = (i + j) % 2 === 0;
      const across = over ? fu : fv, along = over ? fv : fu, f = fat[over ? i : threads + j];
      h[x + y * N] = Math.cos((across - 0.5) * Math.PI) * (0.7 + 0.3 * Math.cos((along - 0.5) * TAU)) * f;
    }
  } else if (kind === 'twill') {
    // denim: the ridges run on the slant
    const p = N / 40;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = ((x + y) / p) % 1, a = ((x - y + N) / (p * 2)) % 1;
      h[x + y * N] = Math.cos((d - 0.5) * Math.PI) * (0.75 + 0.25 * Math.cos((a - 0.5) * TAU));
    }
  } else if (kind === 'cord') {
    // corduroy, and thread wound on a spool: ridges one way
    const p = N / 16;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[x + y * N] = Math.pow(Math.abs(Math.cos(((x / p) % 1 - 0.5) * Math.PI)), 0.7) * (0.92 + 0.08 * Math.sin(y * 0.9));
  } else if (kind === 'knit') {
    // stocking stitch: rows of little Vs
    const cols = 16, rows = 12, w = N / cols, r = N / rows;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x / w) % 1, v = (y / r) % 1;
      const leg = Math.abs(Math.abs(u - 0.5) - 0.36 * v - 0.06);
      h[x + y * N] = Math.max(0, 1 - leg / 0.17) * (0.8 + 0.2 * Math.sin(v * Math.PI));
    }
  } else {
    // felt: fibres lying every way, pressed flat
    for (let i = 0; i < 9000; i++) {
      let x = rand() * N, y = rand() * N;
      const a = rand() * TAU, len = 5 + rand() * 16, amp = 0.25 + 0.75 * rand(), bend = (rand() - 0.5) * 0.12;
      let dx = Math.cos(a), dy = Math.sin(a);
      for (let s = 0; s < len; s++) {
        const k = ((Math.round(x) % N) + N) % N + (((Math.round(y) % N) + N) % N) * N;
        h[k] = Math.min(1, h[k] + amp * 0.45);
        x += dx; y += dy;
        const c = Math.cos(bend), sn = Math.sin(bend);
        [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
      }
    }
    const soft = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let sum = 0;
      for (let b = -1; b <= 1; b++) for (let a2 = -1; a2 <= 1; a2++) sum += h[((x + a2 + N) % N) + ((y + b + N) % N) * N];
      soft[x + y * N] = sum / 9;
    }
    h.set(soft);
  }
  return normalsOf(h, N, kind === 'felt' ? 1.6 : kind === 'knit' ? 3.2 : 2.4);
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/** Slubs: no dyed cloth is one flat colour. Thin streaks along both ways of the weave. */
function slub(ctx, S, rand, amount = 0.06) {
  for (let i = 0; i < S; i += 2) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * amount})`;
    ctx.fillRect(0, i, S, 1 + rand() * 3);
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * amount})`;
    ctx.fillRect(i, 0, 1 + rand() * 3, S);
  }
}
const PRINTS = {
  solid: (ctx, S, rand, [a]) => { ctx.fillStyle = a; ctx.fillRect(0, 0, S, S); slub(ctx, S, rand, 0.1); },
  gingham: (ctx, S, rand, [a, bg = '#f3ecdc']) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    const n = 8, w = S / n;
    ctx.globalAlpha = 0.55; ctx.fillStyle = a;
    for (let i = 0; i < n; i += 2) { ctx.fillRect(i * w, 0, w, S); ctx.fillRect(0, i * w, S, w); }
    ctx.globalAlpha = 1; slub(ctx, S, rand);
  },
  stripes: (ctx, S, rand, [a, bg = '#f3ecdc', n = 8, share = 0.5]) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = a;
    for (let i = 0; i < n; i++) ctx.fillRect((i * S) / n, 0, (S / n) * share, S);
    slub(ctx, S, rand);
  },
  ticking: (ctx, S, rand, [a, bg = '#efe6d2']) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = a;
    for (let i = 0; i < 6; i++) { const x = (i * S) / 6; ctx.fillRect(x, 0, S / 60, S); ctx.fillRect(x + S / 26, 0, S / 24, S); ctx.fillRect(x + S / 10, 0, S / 60, S); }
    slub(ctx, S, rand);
  },
  dots: (ctx, S, rand, [bg, fg = '#f3ecdc', n = 6, r = 0.2]) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = fg;
    const w = S / n;
    for (let j = 0; j < n * 2; j++) for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc((i + (j % 2 ? 0.5 : 0) + 0.25) * w, (j + 0.5) * w * 0.5, w * r, 0, TAU); ctx.fill(); }
    slub(ctx, S, rand);
  },
  ditsy: (ctx, S, rand, [bg, petals = ['#f6f1e6', '#e9b8b0', '#f0cf68'], leaf = '#6f8f4f']) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    const n = 5, w = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.3 + 0.4 * rand()) * w, y = (j + 0.3 + 0.4 * rand()) * w, r = w * (0.09 + 0.05 * rand()), turn = rand() * TAU;
      ctx.fillStyle = leaf;
      for (let k = 0; k < 2; k++) { const a = turn + 1 + k * 2.6; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 2.3, y + Math.sin(a) * r * 2.3, r * 1.1, r * 0.5, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = petals[Math.floor(rand() * petals.length)];
      for (let k = 0; k < 5; k++) { const a = turn + (k / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#d99a2b'; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
    }
    slub(ctx, S, rand);
  },
  plaid: (ctx, S, rand, [bg, a, b]) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    for (const [col, at, wide, alpha] of [[a, 0.12, 0.22, 0.5], [a, 0.62, 0.22, 0.5], [b, 0.44, 0.03, 0.9], [b, 0.94, 0.03, 0.9], ['#f3ecdc', 0.22, 0.012, 0.8], ['#f3ecdc', 0.72, 0.012, 0.8]]) {
      ctx.globalAlpha = alpha; ctx.fillStyle = col;
      ctx.fillRect(at * S, 0, wide * S, S); ctx.fillRect(0, at * S, S, wide * S);
    }
    ctx.globalAlpha = 1; slub(ctx, S, rand);
  },
};

/**
 * Makes the weaves, and hands out materials. cotton(print, colours) is printed quilting cotton; felt(colour),
 * wool(colour) (knitted), denim(colour) and linen(colour) are plain dyed cloth, tinted from one shared picture.
 */
export function createFabrics() {
  const weaves = { plain: weave('plain'), linen: weave('linen'), twill: weave('twill'), cord: weave('cord'), knit: weave('knit'), felt: weave('felt') };
  weaves.plain.repeat.set(1 / 0.5, 1 / 0.5);
  weaves.linen.repeat.set(1 / 0.62, 1 / 0.62);
  weaves.twill.repeat.set(1 / 0.5, 1 / 0.5);
  weaves.cord.repeat.set(1 / 0.5, 1 / 0.5);
  weaves.knit.repeat.set(1 / 0.6, 1 / 0.6);
  weaves.felt.repeat.set(1 / 1.3, 1 / 1.3);
  let seed = 100;
  // the pale picture that dyed cloth is tinted from: mottled, never one flat tone
  const pale = (flecks) => canvasTexture(256, (ctx, S) => {
    const rand = rng(seed++);
    ctx.fillStyle = '#e9e9e9'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < flecks; i++) {
      ctx.strokeStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '90,90,90'},${0.05 + rand() * 0.12})`;
      ctx.lineWidth = 0.6 + rand();
      const x = rand() * S, y = rand() * S, a = rand() * TAU, len = 4 + rand() * 14;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
  });
  const feltMap = pale(2600), plainMap = pale(500);
  feltMap.repeat.set(1 / 1.3, 1 / 1.3);
  plainMap.repeat.set(1 / 1.7, 1 / 1.7);
  const lighter = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k);
  const cloth = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.94, metalness: 0, sheen: 1, sheenRoughness: 0.6, ...o });

  return {
    weaves,
    /** Printed cotton: PRINTS has the kinds; `args` are its colours. `size` is how many units one repeat of the print covers. */
    cotton(print, args, { size = 1.9, vertexColors = false } = {}) {
      const map = canvasTexture(512, (ctx, S) => PRINTS[print](ctx, S, rng(seed++), args));
      map.repeat.set(1 / size, 1 / size);
      return cloth({ map, normalMap: weaves.plain, normalScale: new THREE.Vector2(0.85, 0.85), sheenColor: new THREE.Color(0.32, 0.32, 0.32), vertexColors });
    },
    felt(hex, o = {}) {
      return cloth({ color: new THREE.Color(hex), map: feltMap, normalMap: weaves.felt, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, sheenColor: lighter(hex, 0.45).multiplyScalar(0.75), sheenRoughness: 0.85, ...o });
    },
    wool(hex, o = {}) {
      return cloth({ color: new THREE.Color(hex), map: feltMap, normalMap: weaves.knit, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 1, sheenColor: lighter(hex, 0.4).multiplyScalar(0.7), sheenRoughness: 0.8, ...o });
    },
    denim(hex, o = {}) {
      return cloth({ color: new THREE.Color(hex), map: plainMap, normalMap: weaves.twill, normalScale: new THREE.Vector2(1.1, 1.1), sheenColor: lighter(hex, 0.5).multiplyScalar(0.4), ...o });
    },
    /** Corduroy: wales one way. `wale`: how many units sixteen of them cover. */
    corduroy(hex, { wale = 2, ...o } = {}) {
      const ridges = weaves.cord.clone();
      ridges.repeat.set(1 / wale, 1 / wale);
      return cloth({ color: new THREE.Color(hex), map: plainMap, normalMap: ridges, normalScale: new THREE.Vector2(2.4, 2.4), sheenColor: lighter(hex, 0.5).multiplyScalar(0.5), ...o });
    },
    linen(hex, o = {}) {
      return cloth({ color: new THREE.Color(hex), map: plainMap, normalMap: weaves.linen, normalScale: new THREE.Vector2(1.1, 1.1), sheenColor: lighter(hex, 0.5).multiplyScalar(0.35), ...o });
    },
    /** Satin ribbon: smooth, with a long soft shine across the weave. */
    satin(hex, o = {}) {
      return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.34, metalness: 0, anisotropy: 0.75, normalMap: weaves.cord, normalScale: new THREE.Vector2(0.18, 0.18), sheen: 0.6, sheenColor: lighter(hex, 0.6), sheenRoughness: 0.3, side: THREE.DoubleSide, ...o });
    },
    /** Sewing thread and embroidery floss. */
    thread(hex = '#ffffff', o = {}) {
      return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.7, ...o });
    },
    canvasTexture,
  };
}
