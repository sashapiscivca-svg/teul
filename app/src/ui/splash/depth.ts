// Глибина: the town at the top, and under its street everything that holds it up: pipes and cables, a cellar
// with a lamp and jars, the roots of the trees, a mole's tunnel, clay, stone with fossils and a forgotten chest,
// groundwater, a cave with crystals, glow-worms and a still lake, bedrock veined with gold, and at the very
// bottom the rift itself, a glowing fissure. A crack runs from a split in the pavement all the way down to it, and
// motes of light rise along it to the surface, where they fly off into the town's sky as fireflies.
// Drag up to go down (it glides); touch the crystals and they ring, the lake ripples, the chest opens, the mole
// looks out, the cellar lamp switches, the fossils shine. Going in, the light runs back up the crack.

import type { Env, Splash } from './index';
import { PAD, Town, disc, glow, hash, line, mix, rect, soft } from './town';

interface Crystal {
  x: number;
  y: number;
  h: number;
  c: string;
  flash: number;
  step: number;
}
interface Mote {
  x: number;
  y: number;
  life: number;
  free: boolean;
  vx: number;
  vy: number;
}
interface Ripple {
  x: number;
  y: number;
  at: number;
}

export function depth(env: Env): Splash {
  const { W, H } = env;
  const look = env.look;
  const town = new Town(W, H, { seed: 31, church: 0.12, hall: 0.76 });
  const D = Math.round(H * 3.2);
  const worldH = H + D;
  const caveTop = Math.round(D * 0.36);
  const caveBot = caveTop + Math.round(H * 0.72);
  const ct = (x: number) => Math.round(caveTop + 6 * Math.sin(x / 13) + 3 * Math.sin(x / 5 + 1));
  const cb = (x: number) => Math.round(caveBot - 5 * Math.sin(x / 17 + 1) - 2 * Math.sin(x / 6));
  const lake = { a: Math.round(W * 0.34), b: Math.round(W * 0.7) };
  // still water lies flat: one level, filling whatever of the floor is below it
  let lakeLevel = 0;
  for (let x = lake.a; x < lake.b; x++) lakeLevel += cb(x);
  lakeLevel = Math.round(lakeLevel / (lake.b - lake.a)) - 2;
  const lakeY = (_x: number) => lakeLevel;
  const cellar = { x: Math.round(W * 0.26), y: 7, w: 36, h: 22 };
  const mole = { x: Math.round(W * 0.62), y: 24, out: -10 };
  const chest = { x: Math.round(W * 0.84), y: caveTop - 22, open: -1 };
  const fossils = [
    { x: Math.round(W * 0.16), y: Math.round(caveTop * 0.62), kind: 'shell', lit: -10 },
    { x: Math.round(W * 0.52), y: Math.round(caveTop * 0.78), kind: 'fish', lit: -10 },
    { x: Math.round(W * 0.74), y: Math.round(caveTop * 0.5), kind: 'bone', lit: -10 },
  ];
  let cellarLamp = true;

  // the crack: straight runs between kinks, from the pavement to the bottom, wider the deeper it goes
  const crackX: number[] = new Array(D + 1).fill(0);
  {
    let y = 0;
    let x = Math.round(W * 0.47);
    let k = 0;
    while (y <= D) {
      const run = 6 + Math.floor(hash(k, 13) * 12);
      const nx = Math.max(W * 0.3, Math.min(W * 0.66, x + Math.round((hash(k, 14) - 0.5) * 14)));
      for (let i = 0; i < run && y + i <= D; i++) crackX[y + i] = Math.round(x + ((nx - x) * i) / run);
      y += run;
      x = nx;
      k++;
    }
  }
  const crackW = (y: number) => 1 + Math.floor((y / D) * 5);
  const inCave = (x: number, y: number) => y > ct(x) && y < cb(x);

  // crystals on the cave's walls and floor
  const crystals: Crystal[] = [];
  for (let i = 0; i < 16; i++) {
    const x = Math.round(W * (0.04 + hash(i, 70) * 0.92));
    if (x > lake.a - 4 && x < lake.b + 4) continue;
    const up = hash(i, 71) < 0.6;
    crystals.push({ x, y: up ? cb(x) : ct(x), h: (up ? -1 : 1) * (5 + Math.floor(hash(i, 72) * 7)), c: ['#9a6ad0', '#4fd1b8', '#e86aa0', '#6ab0f0'][i % 4], flash: -10, step: i });
  }
  const worms = Array.from({ length: 40 }, (_, i) => {
    const x = Math.floor(hash(i, 80) * W);
    return { x, y: ct(x) + 1 + Math.floor(hash(i, 81) * 3), p: hash(i, 82) * 10 };
  });

  // ---- what never changes, painted once ------------------------------------------------------------------
  const under = document.createElement('canvas');
  under.width = W;
  under.height = D;
  {
    const g = under.getContext('2d') as CanvasRenderingContext2D;
    const band = (x: number, y: number) => y + Math.round(Math.sin(x / 9 + y) * 1.5);
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        const yy = band(x, y);
        let c: string;
        if (yy < 4) c = hash(x, y) < 0.5 ? '#4a4650' : '#3e3a44';
        else if (yy < 36) c = hash(x, y) < 0.08 ? '#3a261c' : hash(x, y) > 0.95 ? '#6a4a36' : '#4a3226';
        else if (yy < 66) c = Math.floor(yy / 5) % 3 === 0 ? '#7a4e2c' : hash(x, y) < 0.05 ? '#6a4224' : '#8a5a32';
        else if (yy < caveTop - 34) c = hash(Math.floor(x / 5), Math.floor(y / 4)) < 0.3 ? '#3e3c4c' : hash(x, y) < 0.06 ? '#5a5868' : '#4a4858';
        else if (yy < caveTop - 26) c = ((x + y) & 1) === 0 ? '#2a4a6a' : '#3a4858';
        else c = hash(Math.floor(x / 4), Math.floor(y / 3)) < 0.25 ? '#2a2638' : '#25223a';
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
    // nuggets of gold ore in the bedrock
    for (let i = 0; i < 22; i++) {
      const x = Math.round(hash(i, 90) * (W - 6)) + 3;
      const y = Math.round(caveBot + 14 + hash(i, 91) * (D - caveBot - 70));
      const n = 3 + Math.floor(hash(i, 95) * 4);
      for (let k = 0; k < n; k++) {
        const ox = Math.round((hash(i, k + 96) - 0.5) * 5);
        const oy = Math.round((hash(i, k + 120) - 0.5) * 3);
        rect(g, x + ox - 1, y + oy - 1, 3, 3, '#1a1626');
      }
      for (let k = 0; k < n; k++) {
        const ox = Math.round((hash(i, k + 96) - 0.5) * 5);
        const oy = Math.round((hash(i, k + 120) - 0.5) * 3);
        rect(g, x + ox, y + oy, 1, 1, k === 0 ? '#ffe08a' : '#c9a050');
      }
    }
    // pebbles in the clay and stone
    for (let i = 0; i < W * 0.35; i++) {
      const x = Math.round(hash(i, 92) * W);
      const y = Math.round(36 + hash(i, 93) * (caveTop - 70));
      const light = hash(i, 94) < 0.5;
      rect(g, x, y, 3, 2, light ? '#6a6878' : '#7a6a58');
      rect(g, x + 1, y - 1, 1, 1, light ? '#6a6878' : '#7a6a58');
      rect(g, x, y, 1, 1, light ? '#8a8898' : '#9a8a70');
      rect(g, x + 1, y + 2, 2, 1, '#2a2632');
    }
    // the roots of the trees above
    for (const t of town.trees) {
      const tx = t.x - PAD;
      for (let r = 0; r < 4; r++) {
        let x = tx;
        let y = 0;
        for (let s = 0; s < 18 + r * 4; s++) {
          x += (hash(t.x * 7 + r, s) - 0.5) * 2 + (r - 1.5) * 0.4;
          y += 1;
          rect(g, x, y, 1, 1, s < 6 ? '#6a4a32' : '#5a3e2a');
        }
      }
    }
    // pipes and a cable under the street
    for (let x = 0; x < W; x++) {
      rect(g, x, 9, 1, 3, '#c9a83a');
      rect(g, x, 9, 1, 1, '#ead070');
      rect(g, x, 15, 1, 3, '#4a7aa0');
      rect(g, x, 15, 1, 1, '#7aaad0');
      rect(g, x, 20, 1, 1, '#1a1a22');
    }
    for (let x = 6; x < W; x += 30) {
      rect(g, x, 8, 2, 5, '#a8882a');
      rect(g, x + 13, 14, 2, 5, '#3a6a90');
    }
    // the mole's tunnel
    for (let x = mole.x - 30; x < mole.x; x++) rect(g, x, mole.y + Math.round(Math.sin(x / 6) * 2), 1, 3, '#2a1a12');
    // the cellar: stone walls, shelves with jars, a barrel, steps up
    const c0 = cellar;
    rect(g, c0.x, c0.y, c0.w, c0.h, '#4a4458');
    for (let y = c0.y; y < c0.y + c0.h; y += 3) for (let x = c0.x + ((y / 3) % 2) * 3; x < c0.x + c0.w; x += 6) rect(g, x, y, 1, 3, '#3a3448');
    for (let y = c0.y; y < c0.y + c0.h; y += 3) rect(g, c0.x, y, c0.w, 1, '#3a3448');
    rect(g, c0.x, c0.y + c0.h - 2, c0.w, 2, '#3a2c24');
    for (const sy of [c0.y + 6, c0.y + 12]) {
      rect(g, c0.x + 14, sy, 18, 1, '#6a4a32');
      for (let j = 0; j < 5; j++) {
        const jc = ['#d9534f', '#e8a23a', '#5aa469', '#c86aa0', '#f4d35e'][(j + sy) % 5];
        rect(g, c0.x + 15 + j * 3, sy - 3, 2, 3, jc);
        rect(g, c0.x + 15 + j * 3, sy - 4, 2, 1, '#e8e0c8');
      }
    }
    rect(g, c0.x + 4, c0.y + c0.h - 9, 7, 7, '#7a5232');
    rect(g, c0.x + 4, c0.y + c0.h - 7, 7, 1, '#4a3424');
    rect(g, c0.x + 4, c0.y + c0.h - 4, 7, 1, '#4a3424');
    for (let i = 0; i < 5; i++) rect(g, c0.x - 2 - i * 2, c0.y + c0.h - 2 - i * 4, 4, 2, '#5a4a3a');
    // the cave: hollow, its back wall, stalactites and stalagmites, the lake bed
    for (let x = 0; x < W; x++) {
      const a = ct(x);
      const b = cb(x);
      for (let y = a; y < b; y++) rect(g, x, y, 1, 1, ((x + y) & 3) === 0 ? '#1a1630' : '#130f22');
      rect(g, x, a, 1, 1, '#4a4660');
      rect(g, x, b, 1, 1, '#3a3650');
    }
    for (let i = 0; i < W / 6; i++) {
      const x = Math.floor(hash(i, 100) * W);
      const len = 3 + Math.floor(hash(i, 101) * 9);
      for (let k = 0; k < len; k++) rect(g, x - Math.floor((len - k) / 4), ct(x) + k, 1 + Math.floor((len - k) / 4) * 2, 1, k === 0 ? '#4a4660' : '#3a3650');
      rect(g, x, ct(x) + len - 1, 1, 1, '#6a6888');
      const mx = Math.floor(hash(i, 102) * W);
      if (mx > lake.a - 2 && mx < lake.b + 2) continue;
      const ml = 2 + Math.floor(hash(i, 103) * 6);
      for (let k = 0; k < ml; k++) rect(g, mx - Math.floor(k / 3), cb(mx) - ml + k, 1 + Math.floor(k / 3) * 2, 1, '#3a3650');
    }
  }

  // ---- the living part ----------------------------------------------------------------------------------
  let camY = 0;
  let vel = 0;
  let drag: { y: number; cam: number; lastY: number; lastT: number } | null = null;
  let enterAt = -1;
  let motes: Mote[] = [];
  const ripples: Ripple[] = [];
  let surge = -10;
  const start = performance.now() / 1000;

  function crack(g: CanvasRenderingContext2D, t: number): void {
    for (let y = 0; y < D; y++) {
      const wy = H + y;
      if (wy < camY - 2 || wy > camY + H + 2) continue;
      const x = crackX[y];
      if (inCave(x, y)) {
        // through the cave the crack is a thin falling shaft of light
        if ((y + Math.floor(t * 20)) % 4 === 0) {
          g.globalAlpha = 0.35;
          rect(g, x, wy, 1, 1, '#ffe7a0');
          g.globalAlpha = 1;
        }
        continue;
      }
      const w = crackW(y);
      const pulse = 0.5 + 0.5 * Math.sin(y / 18 - t * 2.4);
      const run = surge > 0 ? Math.max(0, 1 - Math.abs((D - y) / D - (t - surge) / 1.2) * 6) : 0;
      rect(g, x - Math.floor(w / 2), wy, w, 1, '#120c10');
      g.globalAlpha = 0.45 + pulse * 0.4 + run;
      rect(g, x - Math.floor((w - 1) / 2), wy, Math.max(1, w - 1), 1, w > 3 ? '#f6b347' : '#c87a2a');
      if (w > 2) rect(g, x, wy, 1, 1, '#fff3c4');
      g.globalAlpha = 1;
    }
    // the fissure at the bottom: and inside it, another sky
    const fh = 44;
    const fy = H + D - fh;
    if (fy < camY + H + 30) {
      soft(g, crackX[D - 10], fy + fh / 2, 54, '#f6b347', 0.05, 6);
      for (let y = 0; y < fh; y++) {
        const k = y / fh;
        const w = Math.round(4 + Math.sin(k * Math.PI * 0.9) * 46 + k * 10);
        const x = crackX[D - fh + y] - Math.floor(w / 2);
        rect(g, x - 2, fy + y, w + 4, 1, '#c87a2a');
        rect(g, x - 1, fy + y, w + 2, 1, '#f6b347');
        if (w > 4) rect(g, x + 1, fy + y, w - 2, 1, mix('#0d0f24', '#2a2455', k));
        // stars of that other sky, twinkling
        for (let i = 0; i < w - 4; i++) {
          const hx = hash(x + i, fy + y);
          if (hx < 0.035 && Math.sin(t * (1 + hx * 30) + i) > -0.3) rect(g, x + 2 + i, fy + y, 1, 1, hx < 0.01 ? '#ffe7b0' : '#c9cdf0');
        }
      }
      // its lips glitter
      for (let i = 0; i < 8; i++) {
        const y = Math.floor(hash(i, Math.floor(t * 3)) * fh);
        const k = y / fh;
        const w = Math.round(4 + Math.sin(k * Math.PI * 0.9) * 46 + k * 10);
        rect(g, crackX[D - fh + y] + (i % 2 ? 1 : -1) * Math.floor(w / 2 + 1), fy + y, 1, 1, '#fff3c4');
      }
    }
  }

  function cave(g: CanvasRenderingContext2D, t: number): void {
    const base = H;
    if (base + caveBot < camY || base + caveTop > camY + H) return;
    for (const w of worms) if (Math.sin(t * 1.5 + w.p * 3) > -0.2) rect(g, w.x, base + w.y, 1, 1, Math.sin(t + w.p) > 0.6 ? '#bff0ff' : '#5ab0d0');
    // the lake, with its shimmer and ripples
    for (let x = lake.a; x < lake.b; x++) {
      const top = lakeY(x);
      const bot = cb(x) + 1;
      if (bot <= top) continue;
      for (let y = top; y < bot; y++) rect(g, x, base + y, 1, 1, y === top ? '#3a6a9a' : mix('#1e3a5a', '#10203a', (y - top) / 9));
      if (Math.sin(x * 0.7 + t * 2) > 0.85) rect(g, x, base + top, 1, 1, '#9ad0f0');
    }
    for (const r of ripples) {
      const k = t - r.at;
      if (k > 1.6) continue;
      const rad = Math.round(k * 12);
      g.globalAlpha = 1 - k / 1.6;
      rect(g, r.x - rad, base + r.y, 2, 1, '#bfe6ff');
      rect(g, r.x + rad - 1, base + r.y, 2, 1, '#bfe6ff');
      g.globalAlpha = 1;
    }
    // crystals glowing, brighter when rung
    for (const c of crystals) {
      const f = Math.max(0, 1 - (t - c.flash) / 1.2);
      const k = 0.5 + 0.2 * Math.sin(t * 1.2 + c.step) + f * 0.5;
      soft(g, c.x, base + c.y + c.h / 2, 6 + Math.round(f * 8), c.c, 0.08 + f * 0.12, 3);
      const dir = Math.sign(c.h);
      // a cluster: a tall prism and two leaning smaller ones, lit on one face
      for (const [ox, kh] of [[-3, 0.55], [3, 0.7], [0, 1]] as const) {
        const len = Math.max(2, Math.round(Math.abs(c.h) * kh));
        for (let i = 0; i < len; i++) {
          const w = i >= len - 2 ? 1 : 3;
          const y = base + c.y + dir * i;
          const x = c.x + ox + (ox !== 0 ? Math.round((Math.sign(ox) * i) / 4) : 0) - Math.floor(w / 2);
          rect(g, x, y, w, 1, mix(c.c, '#ffffff', i >= len - 2 ? 0.7 : k * 0.25));
          if (w === 3) rect(g, x + 2, y, 1, 1, mix(c.c, '#000000', 0.25));
        }
      }
    }
    // a drop now and then from the ceiling into the lake
    const drip = Math.floor(t / 2.6);
    const dx = lake.a + Math.floor(hash(drip, 5) * (lake.b - lake.a));
    const dk = (t % 2.6) / 2.6;
    if (dk < 0.5) rect(g, dx, base + ct(dx) + Math.round(dk * 2 * (lakeY(dx) - ct(dx))), 1, 2, '#9ad0f0');
  }

  function details(g: CanvasRenderingContext2D, t: number): void {
    const base = H;
    // the cellar lamp
    const lx = cellar.x + 11;
    const ly = base + cellar.y + 4;
    rect(g, lx, ly - 4, 1, 3, '#2a2030');
    rect(g, lx - 1, ly - 1, 3, 2, cellarLamp ? '#ffe7a0' : '#5a5040');
    if (cellarLamp) soft(g, lx, ly + 2, 16, '#f6b347', 0.06, 4);
    // the mole
    const mo = t - mole.out < 3 ? 1 : 0;
    if (mo) {
      rect(g, mole.x, base + mole.y - 1, 5, 4, '#3a3038');
      rect(g, mole.x + 4, base + mole.y, 2, 2, '#e88a9a');
      rect(g, mole.x + 2, base + mole.y, 1, 1, '#0a0a0a');
    } else rect(g, mole.x, base + mole.y + 1, 2, 2, '#3a3038');
    // the chest
    const cx = chest.x;
    const cy = base + chest.y;
    rect(g, cx - 1, cy - 1, 12, 10, '#2a2638');
    rect(g, cx, cy + 3, 10, 6, '#7a4a2a');
    rect(g, cx, cy + 5, 10, 1, '#c9a050');
    if (chest.open > 0) {
      rect(g, cx, cy - 1, 10, 2, '#7a4a2a');
      rect(g, cx + 1, cy + 2, 8, 1, '#f4d35e');
      const k = t - chest.open;
      if (k < 2) for (let i = 0; i < 5; i++) rect(g, cx + 2 + i * 2, cy - 2 - Math.round(k * 6 * hash(i, 9)), 1, 1, '#ffe08a');
    } else {
      rect(g, cx, cy, 10, 3, '#8a5a32');
      rect(g, cx + 4, cy + 2, 2, 2, '#c9a050');
    }
    // the fossils, shining a while when touched
    for (const f of fossils) {
      const y = base + f.y;
      const lit = Math.max(0, 1 - (t - f.lit) / 2);
      const c = mix('#c8bca4', '#fff3c4', lit);
      if (f.kind === 'shell') {
        disc(g, f.x, y, 4, '#5a5868');
        for (let a = 0; a < 14; a++) {
          const r = 4 - a * 0.25;
          rect(g, f.x + Math.round(Math.cos(a * 0.9) * r), y + Math.round(Math.sin(a * 0.9) * r), 1, 1, c);
        }
      } else if (f.kind === 'fish') {
        line(g, f.x - 6, y, f.x + 4, y, c);
        for (let i = -4; i <= 2; i += 2) {
          rect(g, f.x + i, y - 2, 1, 2, c);
          rect(g, f.x + i, y + 1, 1, 2, c);
        }
        rect(g, f.x + 4, y - 1, 3, 3, c);
        line(g, f.x - 6, y, f.x - 9, y - 3, c);
        line(g, f.x - 6, y, f.x - 9, y + 3, c);
      } else {
        line(g, f.x - 5, y + 2, f.x + 5, y - 2, c);
        disc(g, f.x - 5, y + 2, 1, c);
        disc(g, f.x + 5, y - 2, 1, c);
      }
      if (lit > 0) soft(g, f.x, y, 8, '#fff3c4', lit * 0.12, 3);
    }
  }

  function motesFrame(g: CanvasRenderingContext2D, t: number, dt: number): void {
    if (enterAt < 0 && Math.random() < dt * 4) motes.push({ x: crackX[D - 4], y: worldH - 6, life: 0, free: false, vx: 0, vy: 0 });
    motes = motes.filter((m) => m.life < 12);
    for (const m of motes) {
      m.life += dt;
      if (!m.free) {
        m.y -= dt * (18 + (enterAt >= 0 ? 160 : 0));
        const ly = Math.round(m.y - H);
        if (ly >= 0 && ly <= D) m.x = crackX[ly] + Math.sin(t * 3 + m.life) * 1.5;
        if (m.y < H + 1) {
          m.free = true;
          m.vx = (Math.random() - 0.5) * 16;
          m.vy = -10 - Math.random() * 8;
          m.life = 8;
        }
      } else {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx += Math.sin(t + m.y) * dt * 6;
        m.vy *= 0.985;
      }
      if (m.y < camY - 4 || m.y > camY + H + 4) continue;
      g.globalAlpha = m.free ? Math.max(0, (12 - m.life) / 4) : 1;
      glow(g, m.x, m.y, 2, '#f6b347', 0.25);
      rect(g, m.x, m.y, 1, 1, '#fff3c4');
      g.globalAlpha = 1;
    }
  }

  function meter(g: CanvasRenderingContext2D): void {
    const x = W - 7;
    const top = 16;
    const bot = H - 46;
    rect(g, x, top, 1, bot - top, '#ffffff33');
    for (let i = 0; i <= 8; i++) rect(g, x - 1, Math.round(top + ((bot - top) * i) / 8), i % 4 === 0 ? 3 : 2, 1, '#ffffff55');
    const k = camY / (worldH - H);
    const y = Math.round(top + (bot - top) * k);
    rect(g, x - 3, y - 1, 3, 3, '#f6b347');
    rect(g, x - 4, y, 1, 1, '#f6b347');
    // the rift at the bottom of the gauge
    rect(g, x - 2, bot + 3, 5, 1, '#f6b347');
    rect(g, x - 1, bot + 4, 3, 1, '#fff3c4');
  }

  return {
    frame(g, t, dt) {
      // a small nod downward at the start: there is more below
      const since = t - start;
      if (!drag && enterAt < 0) {
        camY += vel * dt;
        vel *= Math.pow(0.04, dt);
        if (since > 1.2 && since < 3.6 && camY < 30) camY += (Math.sin(((since - 1.2) / 2.4) * Math.PI) * 26 - camY) * Math.min(1, dt * 4);
      }
      if (enterAt >= 0) camY += (0 - camY) * Math.min(1, dt * 3);
      camY = Math.max(0, Math.min(worldH - H, camY));
      g.save();
      g.translate(0, -Math.round(camY));
      if (camY < H) town.draw(g, look, t, dt, env.par);
      if (camY + H > H) g.drawImage(under, 0, H);
      details(g, t);
      cave(g, t);
      crack(g, t);
      motesFrame(g, t, dt);
      g.restore();
      meter(g);
    },
    veil() {
      return Math.min(1, camY / (H * 0.45));
    },
    down(_x, y, t) {
      if (enterAt >= 0) return;
      drag = { y, cam: camY, lastY: y, lastT: t };
      vel = 0;
    },
    move(_x, y, t) {
      if (!drag) return;
      camY = drag.cam - (y - drag.y);
      const dtm = Math.max(0.001, t - drag.lastT);
      vel = Math.max(-H * 3, Math.min(H * 3, (-(y - drag.lastY) / dtm) * 0.8));
      drag.lastY = y;
      drag.lastT = t;
    },
    up(_x, _y, t) {
      // a finger that stopped before letting go does not throw the view
      if (drag && t - drag.lastT > 0.08) vel = 0;
      drag = null;
    },
    tap(x, y, t) {
      if (enterAt >= 0) return;
      vel = 0;
      const wy = y + camY;
      if (wy < H) {
        const hit = town.poke(x, wy, t);
        if (hit === 'birds') env.chimes.chirp();
        else if (hit === 'cat') env.chimes.meow();
        else if (hit === 'window') env.chimes.bell(2, 0.1);
        return;
      }
      const ly = wy - H;
      for (const c of crystals) {
        const cy = c.y + c.h / 2;
        if (Math.abs(x - c.x) < 6 && Math.abs(ly - cy) < Math.abs(c.h) / 2 + 5) {
          c.flash = t;
          env.chimes.bell(c.step + Math.round((1 - Math.abs(c.h) / 12) * 4), 0.2);
          return;
        }
      }
      if (x > lake.a && x < lake.b && ly > lakeY(x) - 6 && ly < cb(x)) {
        ripples.push({ x, y: lakeY(x), at: t });
        if (ripples.length > 6) ripples.shift();
        env.chimes.drip();
        return;
      }
      if (Math.abs(x - chest.x - 5) < 8 && Math.abs(ly - chest.y - 4) < 8) {
        chest.open = chest.open > 0 ? -1 : t;
        if (chest.open > 0) env.chimes.chord([0, 2, 4, 7, 9], 0.14);
        else env.chimes.click();
        return;
      }
      if (Math.abs(x - mole.x - 2) < 9 && Math.abs(ly - mole.y) < 7) {
        mole.out = t;
        env.chimes.chirp();
        return;
      }
      if (x > cellar.x - 4 && x < cellar.x + cellar.w && ly > cellar.y - 2 && ly < cellar.y + cellar.h) {
        cellarLamp = !cellarLamp;
        env.chimes.click();
        return;
      }
      for (const f of fossils) {
        if (Math.abs(x - f.x) < 9 && Math.abs(ly - f.y) < 7) {
          f.lit = t;
          env.chimes.bell(4, 0.12);
          return;
        }
      }
      if (ly <= D && Math.abs(x - crackX[Math.round(ly)]) < 6) {
        surge = t;
        for (let i = 0; i < 6; i++) motes.push({ x: crackX[Math.round(ly)], y: wy + i * 4, life: 0, free: false, vx: 0, vy: 0 });
        env.chimes.whoosh(0.1, 1);
        env.chimes.bell(0, 0.1);
      }
    },
    enter(t) {
      enterAt = t;
      surge = t;
      env.chimes.whoosh(0.2, 1.6);
      window.setTimeout(() => env.chimes.chord([0, 2, 4, 7], 0.12), 400);
      return 1.4 + Math.min(1, camY / (H * 2));
    },
  };
}
