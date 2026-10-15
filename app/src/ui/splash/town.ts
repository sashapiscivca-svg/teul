// A small town painted in pixels for the title screens: a street of houses with tiled roofs, a church and a town
// hall whose clock tells the real time, hills with windmills, wires with birds, lamps, smoke, people walking, a cat
// on a roof, the season's weather. Any light (day, dusk, night) and any season; the static parts are drawn once
// per look and kept, the living parts each frame. Everything is seeded, so the same screen gets the same town.

import { drawPlant, type PlantOnHorizon } from '../../pixel/plant';

export type Light = 'day' | 'dusk' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export interface Look {
  light: Light;
  season: Season;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(a: number, b: number): number {
  let x = (a * 2654435761) ^ (b * 40503);
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

export function mix(a: string, b: string, k: number): string {
  const p = parseInt(a.slice(1), 16);
  const q = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

/** A colour as it looks in a light: dusk warms and darkens it, night sinks it into blue. */
export function tone(c: string, light: Light): string {
  return light === 'day' ? c : light === 'dusk' ? mix(c, '#6e3a5e', 0.32) : mix(c, '#141634', 0.62);
}

type G = CanvasRenderingContext2D;

export function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Small pictures drawn once and stamped after (a disc, a glow): one copy instead of hundreds of pixel fills, every
 * frame. */
const stamps = new Map<string, HTMLCanvasElement>();

function stamp(key: string, size: number, paint: (g: G) => void): HTMLCanvasElement {
  let c = stamps.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    paint(c.getContext('2d') as G);
    if (stamps.size > 600) stamps.clear();
    stamps.set(key, c);
  }
  return c;
}

function discRows(g: G, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.4);
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export function disc(g: G, cx: number, cy: number, r: number, c: string): void {
  if (r <= 0) {
    rect(g, cx, cy, 1, 1, c);
    return;
  }
  const s = stamp(`d${r}${c}`, r * 2 + 1, (q) => {
    q.fillStyle = c;
    discRows(q, r, r, r);
  });
  g.drawImage(s, Math.round(cx) - r, Math.round(cy) - r);
}

/** Soft light in a few hard rings, brightest in the middle (pixel-art posterized glow). */
export function soft(g: G, cx: number, cy: number, r: number, c: string, alpha: number, rings = 4): void {
  if (r <= 0) return;
  // the rings laid one over another once, at their own strength; then the whole stamped at full
  const s = stamp(`s${r}${c}${alpha}${rings}`, r * 2 + 1, (q) => {
    q.fillStyle = c;
    q.globalAlpha = alpha;
    for (let i = 0; i < rings; i++) discRows(q, r, r, Math.round(r * (1 - i / rings)));
  });
  g.globalAlpha = 1;
  g.drawImage(s, Math.round(cx) - r, Math.round(cy) - r);
}

/** A checkered (dithered) disc: soft light in hard pixels. */
export function glow(g: G, cx: number, cy: number, r: number, c: string, alpha = 1): void {
  r = Math.max(0, Math.round(r));
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  // the checker keeps to the screen's own: two stamps, for odd and even places
  const odd = (x0 + y0) & 1;
  const s = stamp(`g${r}${c}${odd}`, r * 2 + 1, (q) => {
    q.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dy * dy;
        if (d > r * r) continue;
        const inner = d < (r * r) / 4;
        if (inner || ((odd + dx + dy) & 1) === 0) q.fillRect(r + dx, r + dy, 1, 1);
      }
    }
  });
  g.globalAlpha = alpha;
  g.drawImage(s, x0 - r, y0 - r);
  g.globalAlpha = 1;
}

export function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string): void {
  g.fillStyle = c;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// ---- palettes ----------------------------------------------------------------------------------------------

export const SKY: Record<Light, string[]> = {
  day: ['#3f86cc', '#4b91d3', '#589cd9', '#67a7de', '#78b3e3', '#8cbfe8', '#a3cbec', '#bcd9ef'],
  dusk: ['#232452', '#36295e', '#4f3167', '#6e3b6c', '#94486b', '#bc5a64', '#de7a5a', '#f0a45e'],
  night: ['#080a1c', '#0c0f27', '#101330', '#141739', '#191b42', '#1f1f4a', '#28244f', '#332a55'],
};
const WALLS = ['#e9cda4', '#dc8f6b', '#f1e3c4', '#a9c6da', '#caa9c9', '#e9d98a', '#b9d1a9', '#e2b2a2', '#d9d1c9', '#9fbfb0'];
const ROOFS = ['#a9473a', '#8b3a3c', '#5b4b6b', '#4b5b7b', '#7b5b3b', '#3b4b5b', '#9a5a3a'];
const AWNINGS: [string, string][] = [['#d9534f', '#f4eedf'], ['#3fb8b0', '#f4eedf'], ['#e8a23a', '#7a3a2a'], ['#5aa469', '#f4eedf']];
const CLOTHES = ['#d9534f', '#e8a23a', '#3fb8b0', '#4a8fd0', '#8a63c9', '#d86aa0', '#5aa469', '#2f3a5a', '#e8e0c8'];
const SKINS = ['#f1c9a5', '#e0a97c', '#c98f65', '#a06b47', '#fbe0c8', '#6e4630'];

interface Seasonal {
  hillFar: string;
  hillNear: string;
  crown: string[];
  pine: string;
  snow: boolean;
}
const SEASON: Record<Season, Seasonal> = {
  spring: { hillFar: '#9fd08a', hillNear: '#7cc06a', crown: ['#f6c8dc', '#8ccc6a', '#fbf2f6'], pine: '#3e7a52', snow: false },
  summer: { hillFar: '#86b878', hillNear: '#5f9f58', crown: ['#4f9a4a', '#6ab45a', '#3f8a44'], pine: '#2f6a46', snow: false },
  autumn: { hillFar: '#c2a85a', hillNear: '#a8894a', crown: ['#d9662e', '#e8a23a', '#c8423a', '#d4a72c'], pine: '#355e44', snow: false },
  winter: { hillFar: '#e6edf4', hillNear: '#cfdbe7', crown: [], pine: '#2e5244', snow: true },
};

// ---- the town's plan ---------------------------------------------------------------------------------------

type Kind = 'house' | 'tall' | 'shop' | 'church' | 'hall';
interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its own chance of a light on at night. */
  r: number;
  /** Lit by a touch until this time (seconds), with someone at it. */
  until: number;
  stained?: boolean;
}
interface Building {
  kind: Kind;
  x: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  roofH: number;
  chimney: number | null;
  door: number;
  shutters: string | null;
  flowers: boolean;
  awning: [string, string] | null;
  windows: Win[];
}
interface Tree {
  x: number;
  r: number;
  shade: number;
}
interface Bird {
  x: number;
  y: number;
  /** Flying since (seconds) or -1 sitting. */
  flying: number;
  vx: number;
  vy: number;
  home: [number, number];
}
interface Walker {
  x: number;
  dir: number;
  speed: number;
  shirt: string;
  skin: string;
  hair: string;
  lantern: boolean;
  phase: number;
}
interface Puff {
  x: number;
  y: number;
  r: number;
  life: number;
}
interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  phase: number;
}

export const PAD = 10;

export interface TownOptions {
  seed?: number;
  /** Where the church and the town hall stand, as parts of the width. */
  church?: number;
  hall?: number;
  /** Space at the bottom kept for the street. */
  street?: number;
  /** The plant being built beyond the hills (see nppdates.ts), if its building has begun. */
  plant?: PlantOnHorizon | null;
}

export class Town {
  readonly ground: number;
  readonly buildings: Building[] = [];
  readonly back: { x: number; w: number; h: number; roof: number }[] = [];
  readonly trees: Tree[] = [];
  readonly lamps: number[] = [];
  readonly poles: number[] = [];
  readonly birds: Bird[] = [];
  readonly walkers: Walker[] = [];
  readonly mills: { x: number; y: number; h: number; speed: number }[] = [];
  readonly stars: { x: number; y: number; s: number; tw: number }[] = [];
  private puffs: Puff[] = [];
  private flakes: Flake[] = [];
  private cache = new Map<string, HTMLCanvasElement[]>();
  /** The street's horizontal shift this frame (parallax), to map screen points to the town. */
  dx = 0;
  cat: { b: number; x: number } | null = null;

  private readonly plant: PlantOnHorizon | null;

  constructor(readonly W: number, readonly H: number, opts: TownOptions = {}) {
    this.plant = opts.plant ?? null;
    const rand = rng(opts.seed ?? 7);
    this.ground = H - (opts.street ?? 20);
    const LW = W + PAD * 2;
    const churchAt = (opts.church ?? 0.18) * W + PAD;
    const hallAt = (opts.hall ?? 0.7) * W + PAD;
    let x = -2;
    let k = 0;
    while (x < LW) {
      let kind: Kind;
      if (!this.buildings.some((b) => b.kind === 'church') && x + 34 > churchAt) kind = 'church';
      else if (!this.buildings.some((b) => b.kind === 'hall') && x + 40 > hallAt) kind = 'hall';
      else kind = rand() < 0.22 ? 'shop' : rand() < 0.3 ? 'tall' : 'house';
      const b = this.makeBuilding(kind, x, rand, k++);
      this.buildings.push(b);
      x += b.w;
      // a gap with a tree now and then, otherwise the houses stand wall to wall
      if (rand() < 0.3 && kind !== 'hall') {
        const gap = 9 + Math.floor(rand() * 5);
        this.trees.push({ x: x + Math.floor(gap / 2), r: 5 + Math.floor(rand() * 3), shade: Math.floor(rand() * 4) });
        x += gap;
      } else x += rand() < 0.5 ? 0 : 1;
    }
    // a second row behind, taller and paler, so the street is a town and not a fence
    for (let bx = -4; bx < LW; ) {
      const w = 12 + Math.floor(rand() * 14);
      this.back.push({ x: bx, w, h: 26 + Math.floor(rand() * 22), roof: rand() < 0.6 ? 3 + Math.floor(rand() * 5) : 0 });
      bx += w + Math.floor(rand() * 3);
    }
    for (let lx = 14 + Math.floor(rand() * 10); lx < LW; lx += 42 + Math.floor(rand() * 14)) this.lamps.push(lx);
    for (let px = 8 + Math.floor(rand() * 20); px < LW; px += 64 + Math.floor(rand() * 20)) this.poles.push(px);
    // birds on the wires
    for (let i = 0; i + 1 < this.poles.length; i++) {
      const n = Math.floor(rand() * 4);
      for (let j = 0; j < n; j++) {
        const t = 0.2 + rand() * 0.6;
        const bx = this.poles[i] + (this.poles[i + 1] - this.poles[i]) * t;
        const by = this.wireY(i, bx) - 2;
        this.birds.push({ x: bx, y: by, flying: -1, vx: 0, vy: 0, home: [bx, by] });
      }
    }
    for (let i = 0; i < Math.max(3, Math.floor(W / 40)); i++) {
      this.walkers.push({
        x: rand() * LW,
        dir: rand() < 0.5 ? -1 : 1,
        speed: 5 + rand() * 7,
        shirt: CLOTHES[Math.floor(rand() * CLOTHES.length)],
        skin: SKINS[Math.floor(rand() * SKINS.length)],
        hair: ['#1f1a26', '#4a2f27', '#c9a050', '#7a4a2a', '#9aa0b0'][Math.floor(rand() * 5)],
        lantern: rand() < 0.4,
        phase: rand() * 10,
      });
    }
    for (let i = 0; i < 3; i++) this.mills.push({ x: Math.floor(W * (0.52 + i * 0.13 + rand() * 0.05)), y: this.ground - 44 - Math.floor(rand() * 6), h: 16 + Math.floor(rand() * 5), speed: 0.8 + rand() * 0.6 });
    for (let i = 0; i < Math.floor(W * H * 0.006); i++) this.stars.push({ x: Math.floor(rand() * W), y: Math.floor(rand() * (this.ground - 40)), s: rand(), tw: 0.5 + rand() * 2 });
    const houses = this.buildings.filter((b) => b.kind === 'house' || b.kind === 'tall');
    if (houses.length > 0) {
      const b = houses[Math.floor(rand() * houses.length)];
      this.cat = { b: this.buildings.indexOf(b), x: 3 + Math.floor(rand() * Math.max(1, b.w - 8)) };
    }
  }

  private makeBuilding(kind: Kind, x: number, rand: () => number, k: number): Building {
    const pick = <T,>(l: T[]) => l[Math.floor(rand() * l.length)];
    const wins: Win[] = [];
    const g = this.ground;
    if (kind === 'church') {
      const w = 30;
      const h = 30;
      for (const wx of [4, 22]) wins.push({ x: x + wx, y: g - 22, w: 4, h: 11, r: 0.9, until: 0, stained: true });
      return { kind, x, w, h, wall: '#e4dccb', roof: '#5b4b6b', roofH: 10, chimney: null, door: x + 12, shutters: null, flowers: false, awning: null, windows: wins };
    }
    if (kind === 'hall') {
      const w = 40;
      const h = 34;
      for (let f = 0; f < 2; f++) for (let c = 0; c < 4; c++) if (!(f === 0 && (c === 1 || c === 2))) wins.push({ x: x + 4 + c * 9, y: g - 13 - f * 13, w: 5, h: 8, r: 0.5 + rand() * 0.3, until: 0 });
      return { kind, x, w, h, wall: '#efe3c8', roof: '#4b5b7b', roofH: 0, chimney: null, door: x + 17, shutters: null, flowers: true, awning: null, windows: wins };
    }
    const floors = kind === 'tall' ? 3 : kind === 'shop' ? 2 : 1 + (rand() < 0.65 ? 1 : 0);
    const w = kind === 'tall' ? 16 + Math.floor(rand() * 6) : 15 + Math.floor(rand() * 10);
    const h = floors * 11 + 3;
    const cols = Math.max(1, Math.floor((w - 3) / 6));
    const left = x + Math.floor((w - (cols * 6 - 1)) / 2);
    const door = x + (rand() < 0.5 ? 2 : w - 7);
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = left + c * 6;
        if (f === 0 && (kind === 'shop' || (wx < door + 6 && wx + 5 > door))) continue;
        wins.push({ x: wx, y: g - 10 - f * 11, w: 5, h: 6, r: rand(), until: 0 });
      }
    }
    if (kind === 'shop') {
      const sx = door < x + w / 2 ? door + 7 : x + 2;
      wins.push({ x: sx, y: g - 9, w: w - 9, h: 7, r: 0.95, until: 0 });
    }
    return {
      kind,
      x,
      w,
      h,
      wall: WALLS[(k * 7 + Math.floor(rand() * WALLS.length)) % WALLS.length],
      roof: pick(ROOFS),
      roofH: kind === 'tall' ? 0 : Math.min(9, Math.floor(w / 3) + 2),
      chimney: rand() < 0.6 ? x + 3 + Math.floor(rand() * (w - 7)) : null,
      door,
      shutters: rand() < 0.35 ? pick(['#5aa469', '#4a8fd0', '#d9534f', '#8a5a2e']) : null,
      flowers: rand() < 0.5,
      awning: kind === 'shop' ? pick(AWNINGS) : null,
      windows: wins,
    };
  }

  wireY(i: number, x: number): number {
    const a = this.poles[i];
    const b = this.poles[i + 1];
    const t = (x - a) / (b - a);
    return this.ground - 40 + Math.round(4 * t * (1 - t) * 6);
  }

  // ---- static layers, kept per look ------------------------------------------------------------------------

  private layers(look: Look): HTMLCanvasElement[] {
    const key = `${look.light}|${look.season}`;
    const have = this.cache.get(key);
    if (have) return have;
    const make = (w: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = this.H;
      return c;
    };
    const sky = make(this.W);
    const hills = make(this.W + PAD * 2);
    const street = make(this.W + PAD * 2);
    this.paintSky(sky.getContext('2d')!, look);
    this.paintHills(hills.getContext('2d')!, look);
    this.paintStreet(street.getContext('2d')!, look);
    const out = [sky, hills, street];
    if (this.cache.size > 6) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }

  private paintSky(g: G, look: Look): void {
    const bands = SKY[look.light];
    const h = this.ground - 6;
    for (let i = 0; i < bands.length; i++) {
      const y0 = Math.floor((i / bands.length) * h);
      const y1 = Math.floor(((i + 1) / bands.length) * h);
      rect(g, 0, y0, this.W, y1 - y0 + 1, bands[i]);
      // a dithered seam between bands
      if (i > 0) {
        g.fillStyle = bands[i - 1];
        for (let x = (i & 1); x < this.W; x += 2) g.fillRect(x, y0, 1, 1);
      }
    }
    rect(g, 0, h, this.W, this.H - h, bands[bands.length - 1]);
    if (look.light === 'dusk') {
      // the sun going down behind the hills
      const sx = Math.floor(this.W * 0.3);
      glow(g, sx, this.ground - 30, 22, '#ffd27a', 0.25);
      disc(g, sx, this.ground - 30, 11, '#ffcf6a');
      disc(g, sx, this.ground - 30, 9, '#ffe2a0');
    }
  }

  private paintHills(g: G, look: Look): void {
    const s = SEASON[look.season];
    const far = tone(s.hillFar, look.light);
    const near = tone(s.hillNear, look.light);
    const W = this.W + PAD * 2;
    const g0 = this.ground;
    for (let x = 0; x < W; x++) {
      const y = Math.floor(g0 - 46 - Math.sin(x / 31) * 7 - Math.sin(x / 13 + 2) * 2);
      rect(g, x, y, 1, g0 - y, far);
      if (s.snow) rect(g, x, y, 1, 1, tone('#ffffff', look.light));
    }
    // the plant far off beyond the hills, rising year by year
    if (this.plant) drawPlant(g, W, g0 - 40, this.plant, { sky: tone('#c8d8e8', look.light), tint: '#000000', tintAlpha: 0, dark: look.light === 'night' ? 0.8 : look.light === 'dusk' ? 0.35 : 0 }, 0, 0.36);
    // a forest edge on the near hills
    const pine = tone(s.pine, look.light);
    for (let x = 0; x < W; x++) {
      const y = Math.floor(g0 - 30 - Math.sin(x / 22 + 1) * 6 - Math.sin(x / 7) * 1.5);
      rect(g, x, y, 1, g0 - y, near);
      if (hash(x, 3) < 0.16) {
        const ph = 6 + Math.floor(hash(x, 4) * 6);
        for (let i = 0; i < ph; i++) rect(g, x - Math.floor(i / 3), y - ph + i, Math.floor(i / 3) * 2 + 1, 1, pine);
        if (s.snow) rect(g, x, y - ph, 1, 2, tone('#f4f8fc', look.light));
      }
    }
  }

  private paintStreet(g: G, look: Look): void {
    const L = look.light;
    const s = SEASON[look.season];
    const W = this.W + PAD * 2;
    const g0 = this.ground;
    // the back row of houses, paled by the air between
    const air = SKY[look.light][SKY[look.light].length - 2];
    const wall = mix(tone('#9aa4b8', look.light), air, 0.35);
    const roof = mix(tone('#5a5a7a', look.light), air, 0.3);
    const backWin = look.light === 'day' ? mix(tone('#8ab8d8', 'day'), air, 0.4) : look.light === 'dusk' ? '#4a3a5a' : '#1c1d38';
    for (const b of this.back) {
      const top = g0 - b.h;
      rect(g, b.x, top, b.w, b.h, wall);
      // a gable: narrow at the ridge, the full width at the eaves
      for (let i = 0; i < b.roof; i++) {
        const inset = Math.round(((b.roof - 1 - i) * (b.w / 2 - 1)) / b.roof);
        rect(g, b.x + inset, top - b.roof + i, b.w - inset * 2, 1, roof);
      }
      if (!b.roof) rect(g, b.x - 1, top - 1, b.w + 2, 1, roof);
      if (s.snow) rect(g, b.x + (b.roof ? Math.round(b.w / 2) - 2 : 0), top - b.roof - 1, b.roof ? 4 : b.w, 1, tone('#f4f8fc', look.light));
      // a few windows, some lit at night: a street behind the street
      for (let y = top + 4; y < g0 - 26; y += 7) {
        for (let x = b.x + 2; x < b.x + b.w - 3; x += 5) {
          const lit = look.light !== 'day' && hash(x, y) < (look.light === 'night' ? 0.35 : 0.2);
          rect(g, x, y, 2, 3, lit ? mix('#f6c85a', air, 0.35) : backWin);
        }
      }
    }
    for (const b of this.buildings) this.paintBuilding(g, b, look);
    // trees in the gaps
    for (const t of this.trees) {
      rect(g, t.x - 1, g0 - 9, 2, 9, tone('#5e4a3a', L));
      const cy = g0 - 9 - t.r + 2;
      if (look.season === 'winter') {
        const tw = tone('#5e4a3a', L);
        line(g, t.x, g0 - 9, t.x - 4, cy - 3, tw);
        line(g, t.x, g0 - 9, t.x + 4, cy - 4, tw);
        line(g, t.x, g0 - 9, t.x, cy - t.r, tw);
        rect(g, t.x - 5, cy - 4, 2, 1, tone('#f4f8fc', L));
        rect(g, t.x + 3, cy - 5, 2, 1, tone('#f4f8fc', L));
        rect(g, t.x - 1, cy - t.r - 1, 2, 1, tone('#f4f8fc', L));
      } else {
        const cs = s.crown;
        disc(g, t.x, cy, t.r, tone(mix(cs[t.shade % cs.length], '#1a2a2a', 0.25), L));
        disc(g, t.x - 1, cy - 1, t.r - 1, tone(cs[t.shade % cs.length], L));
        disc(g, t.x - 2, cy - 2, Math.max(1, t.r - 3), tone(mix(cs[t.shade % cs.length], '#ffffff', 0.25), L));
        if (look.season === 'spring') for (let i = 0; i < 6; i++) rect(g, t.x - t.r + Math.floor(hash(t.x, i) * t.r * 2), cy - t.r + Math.floor(hash(i, t.x) * t.r * 2), 1, 1, tone('#fbf2f6', L));
      }
    }
    // utility poles and their wires
    for (let i = 0; i < this.poles.length; i++) {
      const px = this.poles[i];
      rect(g, px, g0 - 44, 1, 44, tone('#4a3a32', L));
      rect(g, px - 3, g0 - 42, 7, 1, tone('#4a3a32', L));
      if (i + 1 < this.poles.length) for (let x = px; x <= this.poles[i + 1]; x++) rect(g, x, this.wireY(i, x), 1, 1, tone('#2a2630', L));
    }
    // the pavement and the cobbled road
    rect(g, 0, g0, W, 5, tone('#b9b4ac', L));
    for (let x = 0; x < W; x += 6) rect(g, x, g0 + 1, 1, 4, tone('#a19c94', L));
    rect(g, 0, g0, W, 1, tone('#d6d0c6', L));
    rect(g, 0, g0 + 5, W, 1, tone('#7a756e', L));
    rect(g, 0, g0 + 6, W, this.H - g0 - 6, tone('#6a6670', L));
    for (let y = g0 + 7; y < this.H; y += 3) {
      const off = ((y - g0) / 3) & 1 ? 2 : 0;
      for (let x = off; x < W; x += 4) {
        rect(g, x, y, 3, 2, tone(hash(x, y) < 0.5 ? '#77737c' : '#716d76', L));
      }
    }
    if (s.snow) {
      rect(g, 0, g0 - 1, W, 2, tone('#f4f8fc', L));
      for (let x = 0; x < W; x++) if (hash(x, 9) < 0.3) rect(g, x, g0 + 6 + Math.floor(hash(x, 8) * (this.H - g0 - 7)), 2, 1, tone('#e6edf4', L));
    }
    if (look.season === 'autumn') for (let x = 0; x < W; x++) if (hash(x, 11) < 0.12) rect(g, x, g0 + 1 + Math.floor(hash(x, 12) * 4), 1, 1, tone(['#d9662e', '#e8a23a', '#c8423a'][x % 3], L));
    // lamp posts (their light is drawn live)
    for (const lx of this.lamps) {
      rect(g, lx, g0 - 15, 1, 15, tone('#2d3160', L));
      rect(g, lx - 1, g0 - 1, 3, 1, tone('#2d3160', L));
      rect(g, lx - 1, g0 - 18, 3, 3, tone('#2d3160', L));
      rect(g, lx - 2, g0 - 19, 5, 1, tone('#2d3160', L));
    }
  }

  private paintBuilding(g: G, b: Building, look: Look): void {
    const L = look.light;
    const g0 = this.ground;
    const top = g0 - b.h;
    const wall = tone(b.wall, L);
    const wallD = tone(mix(b.wall, '#2a1a2a', 0.22), L);
    const wallL = tone(mix(b.wall, '#ffffff', 0.25), L);
    const snow = SEASON[look.season].snow;
    const snowC = tone('#f4f8fc', L);
    if (b.kind === 'church') {
      const cx = b.x + 15;
      rect(g, b.x, top, b.w, b.h, wall);
      rect(g, b.x, top, 1, b.h, wallL);
      rect(g, b.x + b.w - 1, top, 1, b.h, wallD);
      // the nave's roof
      const roof = tone(b.roof, L);
      for (let i = 0; i < 8; i++) rect(g, b.x - 1 + i * 2, top - 8 + i, b.w + 2 - i * 4, 1, i % 2 ? tone(mix(b.roof, '#000000', 0.15), L) : roof);
      // the tower and its spire, with the cross
      const tw = 10;
      const tTop = top - 26;
      rect(g, cx - tw / 2, tTop, tw, 26, wall);
      rect(g, cx - tw / 2, tTop, 1, 26, wallL);
      rect(g, cx + tw / 2 - 1, tTop, 1, 26, wallD);
      rect(g, cx - 2, tTop + 4, 4, 6, tone('#2a2440', L));
      rect(g, cx - 1, tTop + 5, 2, 2, tone('#c9a050', L));
      for (let i = 0; i < 20; i++) {
        const half = Math.floor((i * 6) / 20);
        rect(g, cx - half, tTop - 20 + i, half * 2, 1, i % 3 === 0 ? tone(mix(b.roof, '#000000', 0.2), L) : roof);
      }
      rect(g, cx - 1, tTop - 27, 1, 7, tone('#d9b45a', L));
      rect(g, cx - 3, tTop - 25, 5, 1, tone('#d9b45a', L));
      if (snow) {
        rect(g, cx - 5, tTop - 1, 10, 1, snowC);
        for (let i = 0; i < 8; i++) rect(g, b.x - 1 + i * 2, top - 8 + i, 2, 1, snowC);
      }
      // the rose window and the arched door
      disc(g, cx, top + 7, 3, tone('#2a2440', L));
      // the arched door
      rect(g, cx - 3, g0 - 10, 6, 10, tone('#5a3a2a', L));
      rect(g, cx - 2, g0 - 11, 4, 1, tone('#5a3a2a', L));
      rect(g, cx, g0 - 10, 1, 10, tone('#3a2418', L));
      rect(g, cx - 4, g0 - 1, 8, 1, tone('#b9b4ac', L));
      return;
    }
    if (b.kind === 'hall') {
      rect(g, b.x, top, b.w, b.h, wall);
      rect(g, b.x, top, 1, b.h, wallL);
      rect(g, b.x + b.w - 1, top, 1, b.h, wallD);
      rect(g, b.x - 1, top - 2, b.w + 2, 2, tone('#c8bca4', L));
      rect(g, b.x, g0 - 15, b.w, 1, tone('#c8bca4', L));
      // columns round the door
      for (const cx of [b.x + 12, b.x + 26]) rect(g, cx, g0 - 13, 2, 13, tone('#fbf4e4', L));
      // the clock tower
      const cx = b.x + 20;
      const tTop = top - 18;
      rect(g, cx - 6, tTop, 13, 18, wall);
      rect(g, cx - 6, tTop, 1, 18, wallL);
      rect(g, cx + 6, tTop, 1, 18, wallD);
      for (let i = 0; i < 6; i++) rect(g, cx - 6 + i, tTop - 6 + i, 12 - i * 2, 1, tone(b.roof, L));
      rect(g, cx, tTop - 12, 1, 6, tone('#3a3a44', L));
      if (snow) {
        rect(g, b.x - 1, top - 3, b.w + 2, 1, snowC);
        rect(g, cx - 3, tTop - 4, 6, 1, snowC);
      }
      // the door
      rect(g, b.door, g0 - 11, 6, 11, tone('#6a3a2a', L));
      rect(g, b.door + 3, g0 - 11, 1, 11, tone('#4a2418', L));
      rect(g, b.door - 2, g0 - 1, 10, 1, tone('#d6d0c6', L));
      this.paintWindowsFrames(g, b, look);
      return;
    }
    // ordinary houses, tall houses and shops
    rect(g, b.x, top, b.w, b.h, wall);
    rect(g, b.x, top, 1, b.h, wallL);
    rect(g, b.x + b.w - 1, top, 1, b.h, wallD);
    // plaster grain and a line between the floors
    for (let i = 0; i < b.w * b.h * 0.04; i++) rect(g, b.x + 1 + Math.floor(hash(b.x, i) * (b.w - 2)), top + Math.floor(hash(i, b.x) * b.h), 1, 1, wallD);
    for (let f = 1; f * 11 < b.h - 3; f++) rect(g, b.x, g0 - f * 11 - 1, b.w, 1, wallD);
    rect(g, b.x, g0 - 2, b.w, 2, tone(mix(b.wall, '#3a3030', 0.4), L));
    // roof: a tiled gable or a flat roof with a cornice
    const roof = tone(b.roof, L);
    const roofD = tone(mix(b.roof, '#000000', 0.2), L);
    const roofL = tone(mix(b.roof, '#ffffff', 0.2), L);
    if (b.roofH > 0) {
      if (b.chimney !== null) {
        rect(g, b.chimney, top - b.roofH - 2, 3, b.roofH, tone('#8a5a4a', L));
        rect(g, b.chimney - 1, top - b.roofH - 3, 5, 1, tone('#6a4a3a', L));
        if (snow) rect(g, b.chimney - 1, top - b.roofH - 4, 5, 1, snowC);
      }
      for (let i = 0; i < b.roofH; i++) {
        const inset = Math.round((i * (b.w / 2 - 2)) / b.roofH);
        const y = top - b.roofH + i;
        const xL = b.x - 1 + (b.roofH - 1 - i === 0 ? 0 : 0) + (b.w / 2 - 2 - inset);
        const w = b.w + 2 - (b.w / 2 - 2 - inset) * 2;
        rect(g, xL, y, w, 1, i % 2 ? roofD : roof);
        for (let x = Math.ceil(xL) + (i % 2) * 2; x < xL + w - 1; x += 4) rect(g, x, y, 1, 1, i % 2 ? roof : roofD);
        rect(g, xL, y, 1, 1, roofL);
      }
      rect(g, b.x - 1, top - 1, b.w + 2, 1, roofD);
      if (snow) {
        for (let i = 0; i < b.roofH; i += 2) {
          const inset = Math.round((i * (b.w / 2 - 2)) / b.roofH);
          const xL = b.x - 1 + (b.w / 2 - 2 - inset);
          rect(g, xL, top - b.roofH + i, b.w + 2 - (b.w / 2 - 2 - inset) * 2, 1, snowC);
        }
      }
    } else {
      rect(g, b.x - 1, top - 2, b.w + 2, 2, roof);
      rect(g, b.x - 1, top - 2, b.w + 2, 1, roofL);
      if (hash(b.x, 1) < 0.5) {
        rect(g, b.x + 3, top - 7, 5, 5, tone('#8a8a96', L));
        rect(g, b.x + 3, top - 7, 5, 1, tone('#a8a8b4', L));
      } else {
        rect(g, b.x + b.w - 4, top - 9, 1, 7, tone('#3a3a44', L));
        rect(g, b.x + b.w - 6, top - 8, 5, 1, tone('#3a3a44', L));
      }
      if (snow) rect(g, b.x - 1, top - 3, b.w + 2, 1, snowC);
    }
    // the door and its step
    const door = tone(['#6a3a2a', '#3a5a7a', '#5a7a4a', '#8a3a3a'][Math.floor(hash(b.x, 5) * 4)], L);
    rect(g, b.door, g0 - 9, 5, 9, door);
    rect(g, b.door, g0 - 9, 5, 1, tone('#2a1a1a', L));
    rect(g, b.door + 3, g0 - 5, 1, 1, tone('#e8c060', L));
    rect(g, b.door - 1, g0 - 1, 7, 1, tone('#d6d0c6', L));
    // a shop: its big window, an awning and a sign
    if (b.kind === 'shop' && b.awning) {
      const sx = b.door < b.x + b.w / 2 ? b.door + 7 : b.x + 2;
      const sw = b.w - 9;
      rect(g, sx - 1, g0 - 10, sw + 2, 9, tone('#3a3030', L));
      const [a1, a2] = b.awning;
      for (let x = 0; x < b.w + 2; x++) {
        const c = tone(Math.floor(x / 2) % 2 ? a1 : a2, L);
        rect(g, b.x - 1 + x, g0 - 13, 1, 2, c);
        if (x % 2 === 0) rect(g, b.x - 1 + x, g0 - 11, 1, 1, c);
      }
      rect(g, b.x + 3, g0 - 20, b.w - 6, 5, tone('#3a2a20', L));
      for (let x = b.x + 5; x < b.x + b.w - 5; x += 2) rect(g, x, g0 - 18, 1, 1 + (x % 3 === 0 ? 1 : 0), tone('#f4d35e', L));
    }
    this.paintWindowsFrames(g, b, look);
  }

  private paintWindowsFrames(g: G, b: Building, look: Look): void {
    const L = look.light;
    const frame = tone('#efe8da', L);
    for (const w of b.windows) {
      if (b.kind === 'shop' && w.w > 6) continue;
      rect(g, w.x - 1, w.y - 1, w.w + 2, w.h + 2, frame);
      rect(g, w.x - 1, w.y + w.h + 1, w.w + 2, 1, tone('#c8c0b0', L));
      if (b.shutters) {
        rect(g, w.x - 3, w.y - 1, 2, w.h + 2, tone(b.shutters, L));
        rect(g, w.x + w.w + 1, w.y - 1, 2, w.h + 2, tone(b.shutters, L));
      }
      if (b.flowers && look.season !== 'winter' && w.y > this.ground - 30) {
        rect(g, w.x - 1, w.y + w.h + 1, w.w + 2, 2, tone('#8a5a2e', L));
        for (let i = 0; i < w.w + 2; i += 2) rect(g, w.x - 1 + i, w.y + w.h, 1, 1, tone(['#d9534f', '#f4d35e', '#d86aa0', '#f4eedf'][(i + w.x) % 4], L));
      }
    }
  }

  // ---- the living part, every frame ------------------------------------------------------------------------

  /** Whether a window has its light on at time `t`. */
  lit(w: Win, look: Look, t: number): boolean {
    if (w.until > t) return true;
    if (look.light === 'day') return false;
    const slot = Math.floor(t / (9 + w.r * 17));
    const chance = look.light === 'dusk' ? 0.35 : 0.55;
    return hash(Math.floor(w.x * 13 + w.y), slot) * 0.6 + w.r * 0.4 < chance;
  }

  /** Draws the whole town; `par` (-1..1) shifts the layers apart for depth. */
  draw(g: G, look: Look, t: number, dt: number, par = 0, wind = 1): void {
    const [sky, hills, street] = this.layers(look);
    g.imageSmoothingEnabled = false;
    g.drawImage(sky, 0, 0);
    this.drawSky(g, look, t);
    g.drawImage(hills, Math.round(-PAD + par * 3), 0);
    this.drawMills(g, look, t, Math.round(-PAD + par * 3) + PAD);
    this.dx = Math.round(-PAD + par * 7);
    g.drawImage(street, this.dx, 0);
    g.save();
    g.translate(this.dx, 0);
    this.drawWindows(g, look, t);
    this.drawClock(g, look);
    this.drawSmoke(g, look, dt, wind);
    this.drawLamps(g, look, t);
    this.drawCat(g, look, t);
    this.drawWalkers(g, look, t, dt);
    this.drawBirds(g, look, t, dt);
    g.restore();
    this.drawWeather(g, look, t, dt, wind);
  }

  private drawSky(g: G, look: Look, t: number): void {
    if (look.light === 'night' || look.light === 'dusk') {
      for (const s of this.stars) {
        if (look.light === 'dusk' && s.y > this.ground * 0.35) continue;
        const on = Math.sin(t * s.tw + s.x) > -0.5;
        if (!on) continue;
        g.fillStyle = s.s > 0.85 ? '#ffe7b0' : s.s > 0.6 ? '#c9cdf0' : '#8a90c0';
        g.fillRect(s.x, s.y, 1, 1);
        if (s.s > 0.96) {
          g.globalAlpha = 0.45;
          g.fillRect(s.x - 1, s.y, 3, 1);
          g.fillRect(s.x, s.y - 1, 1, 3);
          g.globalAlpha = 1;
        }
      }
    }
    if (look.light === 'night') {
      const mx = Math.floor(this.W * 0.82);
      glow(g, mx, 18, 11, '#c9cdf0', 0.12);
      disc(g, mx, 18, 6, '#f4eedf');
      disc(g, mx + 3, 16, 5, SKY.night[1]);
      rect(g, mx - 3, 19, 1, 1, '#d8d0bc');
    }
    if (look.light === 'day') {
      const sx = Math.floor(this.W * 0.84);
      glow(g, sx, 16, 13, '#fff6d0', 0.35);
      disc(g, sx, 16, 7, '#fff2b8');
      disc(g, sx, 16, 5, '#fffbe6');
    }
    // clouds drift by
    const cc = look.light === 'day' ? ['#f4f8fc', '#d6e2ee'] : look.light === 'dusk' ? ['#f0a890', '#b86a7a'] : ['#232650', '#1a1c40'];
    for (let i = 0; i < 4; i++) {
      const w = this.W + 60;
      const x = ((hash(i, 21) * w + t * (1.5 + i * 0.6)) % w) - 30;
      const y = 10 + Math.floor(hash(i, 22) * (this.ground * 0.35));
      const r = 4 + Math.floor(hash(i, 23) * 3);
      disc(g, x, y + 1, r, cc[1]);
      disc(g, x + r, y + 2, r - 1, cc[1]);
      disc(g, x - r, y + 2, r - 2, cc[1]);
      disc(g, x, y, r, cc[0]);
      disc(g, x + r, y + 1, r - 1, cc[0]);
      disc(g, x - r, y + 1, r - 2, cc[0]);
      rect(g, x - r * 2, y + r - 1, r * 4, 2, cc[1]);
    }
  }

  private drawMills(g: G, look: Look, t: number, ox: number): void {
    const c = tone('#f0f0f4', look.light);
    for (const m of this.mills) {
      const x = m.x + ox - PAD;
      rect(g, x, m.y, 1, m.h, c);
      const a0 = t * m.speed;
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k * Math.PI * 2) / 3;
        line(g, x, m.y, x + Math.cos(a) * 7, m.y + Math.sin(a) * 7, c);
      }
      if (look.light === 'night' && Math.floor(t * 1.2 + m.x) % 2 === 0) rect(g, x, m.y - 1, 1, 1, '#ff5a4a');
    }
  }

  private drawWindows(g: G, look: Look, t: number): void {
    const day = look.light === 'day';
    for (const b of this.buildings) {
      for (const w of b.windows) {
        const on = this.lit(w, look, t);
        if (w.stained) {
          // a tall arched window of coloured glass in lead: dark by day, glowing at night when lit
          const glass = day ? ['#3a4a6a', '#5a3a4a', '#4a5a3a', '#6a5a2a'] : on ? ['#d9534f', '#4a8fd0', '#f4d35e', '#5aa469'] : ['#24203a', '#2a2440'];
          for (let y = 0; y < w.h; y++) {
            for (let x = 0; x < w.w; x++) {
              if (y === 0 && (x === 0 || x === w.w - 1)) continue;
              const lead = x === Math.floor(w.w / 2) || y % 4 === 3;
              rect(g, w.x + x, w.y + y, 1, 1, lead ? tone('#2a2630', look.light) : glass[(Math.floor(y / 4) + x) % glass.length]);
            }
          }
          if (on && !day) soft(g, w.x + w.w / 2, w.y + w.h / 2, 5, '#f6b347', 0.08, 2);
          continue;
        }
        if (on) {
          rect(g, w.x, w.y, w.w, w.h, '#f6c85a');
          rect(g, w.x + 1, w.y + 1, w.w - 2, w.h - 2, '#ffe2a0');
          if (!day) glow(g, w.x + w.w / 2, w.y + w.h / 2, 3, '#f6b347', 0.12);
          if (w.until > t) {
            // someone at the window, looking out
            const sx = w.x + Math.floor(w.w / 2) - 1;
            rect(g, sx, w.y + 1, 2, 2, '#3a2a30');
            rect(g, sx - 1, w.y + 3, 4, w.h - 3, '#3a2a30');
          }
        } else if (day) {
          rect(g, w.x, w.y, w.w, w.h, '#8ab8d8');
          rect(g, w.x, w.y, 1, w.h, '#c8e2f0');
          rect(g, w.x + 1, w.y, 1, 1, '#e8f4fa');
        } else {
          rect(g, w.x, w.y, w.w, w.h, look.light === 'dusk' ? '#3a3858' : '#16182e');
          if (look.light === 'dusk') rect(g, w.x, w.y, 1, 1, '#c87a6a');
        }
        if (w.w <= 6) rect(g, w.x, w.y + Math.floor(w.h / 2), w.w, 1, tone('#efe8da', look.light));
      }
    }
  }

  private drawClock(g: G, look: Look): void {
    const hall = this.buildings.find((b) => b.kind === 'hall');
    if (!hall) return;
    const cx = hall.x + 20;
    const cy = this.ground - hall.h - 10;
    disc(g, cx, cy, 5, tone('#3a3a44', look.light));
    disc(g, cx, cy, 4, look.light === 'day' ? '#fbf4e4' : '#ffe8b0');
    const tick = tone('#8a8070', look.light === 'day' ? 'day' : 'dusk');
    rect(g, cx, cy - 4, 1, 1, tick);
    rect(g, cx, cy + 4, 1, 1, tick);
    rect(g, cx - 4, cy, 1, 1, tick);
    rect(g, cx + 4, cy, 1, 1, tick);
    const d = new Date();
    const hA = ((d.getHours() % 12) + d.getMinutes() / 60) * (Math.PI / 6) - Math.PI / 2;
    const mA = d.getMinutes() * (Math.PI / 30) - Math.PI / 2;
    line(g, cx, cy, cx + Math.round(Math.cos(hA) * 2), cy + Math.round(Math.sin(hA) * 2), '#2a2030');
    line(g, cx, cy, cx + Math.round(Math.cos(mA) * 3.4), cy + Math.round(Math.sin(mA) * 3.4), '#2a2030');
    // the flag on the tower
    const fx = cx;
    const fy = this.ground - hall.h - 30;
    const wave = Math.floor(Date.now() / 250) % 2;
    rect(g, fx + 1, fy, 5, 2, '#4a8fd0');
    rect(g, fx + 1, fy + 2, 5, 2, '#f4d35e');
    if (wave) rect(g, fx + 5, fy, 1, 4, look.light === 'day' ? '#bcd9ef' : SKY[look.light][3]);
  }

  private drawSmoke(g: G, look: Look, dt: number, wind: number): void {
    for (const b of this.buildings) {
      if (b.chimney === null) continue;
      if (Math.random() < dt * 1.6) this.puffs.push({ x: b.chimney + 1, y: this.ground - b.h - b.roofH - 4, r: 1, life: 0 });
    }
    const c = look.light === 'day' ? '#eef2f6' : look.light === 'dusk' ? '#c8a0a8' : '#3c4068';
    this.puffs = this.puffs.filter((p) => p.life < 4);
    for (const p of this.puffs) {
      p.life += dt;
      p.y -= dt * 4;
      p.x += dt * (2 + p.life) * wind;
      p.r = 1 + Math.floor(p.life * 0.8);
      g.globalAlpha = Math.max(0, 0.7 - p.life * 0.17);
      disc(g, p.x, p.y, p.r, c);
    }
    g.globalAlpha = 1;
  }

  private drawLamps(g: G, look: Look, t: number): void {
    const on = look.light !== 'day';
    for (const lx of this.lamps) {
      const flick = Math.sin(t * 13 + lx) > 0.97 ? 0.7 : 1;
      rect(g, lx, this.ground - 17, 1, 1, on ? '#ffe7a0' : tone('#bcc8d0', look.light));
      if (!on) continue;
      glow(g, lx, this.ground - 16, 9, '#f6b347', 0.13 * flick);
      glow(g, lx, this.ground + 2, 6, '#f6b347', 0.12 * flick);
    }
  }

  private drawCat(g: G, look: Look, t: number): void {
    if (!this.cat) return;
    const b = this.buildings[this.cat.b];
    // on the ridge of a gabled roof, or anywhere along a flat one
    if (b.roofH > 0) this.drawCatAt(g, b.x + Math.floor(b.w / 2) - 2, this.ground - b.h - b.roofH + 1, look, t);
    else this.drawCatAt(g, b.x + this.cat.x, this.ground - b.h - 2, look, t);
  }

  private drawCatAt(g: G, x: number, y: number, look: Look, t: number): void {
    const c = look.light === 'day' ? '#2e2a36' : '#141420';
    rect(g, x, y - 3, 3, 3, c);
    rect(g, x, y - 4, 1, 1, c);
    rect(g, x + 2, y - 4, 1, 1, c);
    rect(g, x + 1, y - 1, 4, 1, c);
    const tail = Math.floor(t * 1.5) % 3;
    rect(g, x + 4, y - 2 - tail, 1, 1 + tail, c);
    if (look.light !== 'day' && Math.floor(t * 0.4) % 7 !== 0) {
      rect(g, x, y - 2, 1, 1, '#c8f060');
      rect(g, x + 2, y - 2, 1, 1, '#c8f060');
    }
  }

  private drawWalkers(g: G, look: Look, t: number, dt: number): void {
    const W = this.W + PAD * 2;
    for (const w of this.walkers) {
      w.x += w.dir * w.speed * dt;
      if (w.x < -6) w.x = W + 4;
      if (w.x > W + 6) w.x = -4;
      const x = Math.round(w.x);
      const y = this.ground + 3;
      const step = Math.floor(t * w.speed * 0.6 + w.phase) % 2;
      const L = look.light;
      rect(g, x, y - 10, 2, 2, tone(w.skin, L));
      rect(g, x, y - 11, 2, 1, tone(w.hair, L));
      rect(g, x - (w.dir < 0 ? 0 : 0), y - 8, 2, 4, tone(w.shirt, L));
      rect(g, x + (w.dir > 0 ? -1 : 2), y - 7, 1, 2, tone(w.skin, L));
      rect(g, x + (step ? 0 : 1), y - 4, 1, 3, tone('#2f3a5a', L));
      rect(g, x + (step ? 1 : 0), y - 4, 1, 2, tone('#2f3a5a', L));
      if (w.lantern && L !== 'day') {
        const lx = x + (w.dir > 0 ? 3 : -2);
        rect(g, lx, y - 6, 1, 2, '#ffe7a0');
        glow(g, lx, y - 5, 4, '#f6b347', 0.15);
      }
    }
  }

  private drawBirds(g: G, look: Look, t: number, dt: number): void {
    const c = look.light === 'day' ? '#2a2630' : '#0e0e1a';
    for (const b of this.birds) {
      if (b.flying >= 0) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += dt * 2;
        const flap = Math.floor((t - b.flying) * 10) % 2;
        rect(g, b.x - 1, b.y - flap, 1, 1, c);
        rect(g, b.x, b.y, 1, 1, c);
        rect(g, b.x + 1, b.y - flap, 1, 1, c);
        // they come back after a while
        if (t - b.flying > 7) {
          b.flying = -1;
          [b.x, b.y] = b.home;
        }
      } else {
        rect(g, b.x, b.y, 2, 2, c);
        if (Math.floor(t * 0.7 + b.x) % 5 === 0) rect(g, b.x + (b.x % 2 ? 2 : -1), b.y, 1, 1, c);
      }
    }
  }

  private drawWeather(g: G, look: Look, t: number, dt: number, wind: number): void {
    const want = look.season === 'winter' ? Math.floor(this.W * 0.5) : look.season === 'autumn' ? Math.floor(this.W * 0.06) : look.season === 'spring' ? Math.floor(this.W * 0.05) : look.light !== 'day' ? Math.floor(this.W * 0.06) : 0;
    while (this.flakes.length < want) {
      const kind = look.season;
      const c = kind === 'winter' ? '#f4f8fc' : kind === 'autumn' ? ['#d9662e', '#e8a23a', '#c8423a'][this.flakes.length % 3] : kind === 'spring' ? '#f6c8dc' : '#e8f070';
      this.flakes.push({ x: Math.random() * this.W, y: Math.random() * this.H, vx: 0, vy: kind === 'summer' ? 0 : 6 + Math.random() * 10, c, phase: Math.random() * 10 });
    }
    if (this.flakes.length > want) this.flakes.length = want;
    for (const f of this.flakes) {
      if (look.season === 'summer') {
        // fireflies wander and blink near the ground
        f.x += Math.sin(t * 0.7 + f.phase) * dt * 5;
        f.y = this.ground - 4 - ((f.phase * 37) % 40) + Math.sin(t + f.phase) * 3;
        if (Math.sin(t * 2 + f.phase * 3) > 0.3) {
          glow(g, f.x, f.y, 2, '#e8f070', 0.25);
          rect(g, f.x, f.y, 1, 1, f.c);
        }
        continue;
      }
      f.y += f.vy * dt;
      f.x += (Math.sin(t * 1.3 + f.phase) * 4 + wind * 4) * dt;
      if (f.y > this.H) {
        f.y = -2;
        f.x = Math.random() * this.W;
      }
      if (f.x > this.W) f.x -= this.W;
      if (f.x < 0) f.x += this.W;
      const big = look.season === 'winter' && f.phase > 7;
      rect(g, f.x, f.y, big ? 2 : 1, big ? 2 : 1, f.c);
      if (look.season === 'autumn' && Math.floor(t * 4 + f.phase) % 2) rect(g, f.x + 1, f.y, 1, 1, f.c);
    }
  }

  // ---- touches -----------------------------------------------------------------------------------------------

  /** A touch at a screen point: birds fly off, a window lights up and someone looks out. Returns what it hit. */
  poke(sx: number, sy: number, t: number): 'birds' | 'window' | 'cat' | null {
    const x = sx - this.dx;
    let hit: 'birds' | 'window' | 'cat' | null = null;
    for (const b of this.birds) {
      if (b.flying < 0 && Math.abs(b.x - x) < 14 && Math.abs(b.y - sy) < 10) {
        b.flying = t;
        b.vx = (b.x < x ? -1 : 1) * (14 + Math.random() * 10);
        b.vy = -14 - Math.random() * 8;
        hit = 'birds';
      }
    }
    if (hit) return hit;
    if (this.cat) {
      const b = this.buildings[this.cat.b];
      if (Math.abs(b.x + b.w / 2 - x) < b.w / 2 + 2 && sy < this.ground - b.h + 2 && sy > this.ground - b.h - b.roofH - 8) return 'cat';
    }
    let best: Win | null = null;
    let bestD = 64;
    for (const b of this.buildings) for (const w of b.windows) {
      const d = (w.x + w.w / 2 - x) ** 2 + (w.y + w.h / 2 - sy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best) {
      best.until = t + 6 + Math.random() * 4;
      return 'window';
    }
    return null;
  }

  /** Lights every window within `r` of a screen point for a while (a light passing by). */
  lightAround(sx: number, sy: number, r: number, t: number): number {
    const x = sx - this.dx;
    let n = 0;
    for (const b of this.buildings) for (const w of b.windows) {
      if ((w.x + w.w / 2 - x) ** 2 + (w.y + w.h / 2 - sy) ** 2 < r * r && w.until < t) {
        w.until = t + 5 + Math.random() * 6;
        n++;
      }
    }
    return n;
  }
}
