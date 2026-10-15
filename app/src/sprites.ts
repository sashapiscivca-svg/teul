// Procedural 32x32 figures. Everything is derived from a name (hash) so nothing is stored: a symmetric
// body around a fixed core, random choices only around it, then an automatic outline and shadow.

export interface Layer {
  color: string;
  /** SVG path made of unit-high runs: `M x y h w v1 h-w z`. */
  path: string;
}

export type Accessory = 'none' | 'glasses' | 'scarf' | 'hat' | 'cap' | 'apron' | 'cane';

export interface HumanSpec {
  seed: string;
  hair?: number;
  acc?: Accessory;
  elder?: boolean;
}

export interface CatSpec {
  seed: string;
}

const SKIN = ['#f6d3b3', '#e8b98f', '#c98f65', '#9c6a46', '#6e4630'];
const HAIR = ['#2b2230', '#5a3a28', '#8a5a2e', '#c9a050', '#d86a3a', '#9aa0b0', '#e8e8f0', '#3a5a8a'];
const CLOTH = ['#d9534f', '#e8a23a', '#5aa469', '#4a8fd0', '#8a63c9', '#d86aa0', '#3fb8b0', '#e8e0c8'];
const PANTS = ['#2f3a5a', '#4a3a30', '#3a4a40', '#5a4a6a', '#6a6a72'];
const FUR = ['#d98a3a', '#8a8a96', '#2e2a36', '#e8e0d0', '#b0763a'];
const INK = '#17131f';
const SHADOW = '#0000004d';

export function seedOf(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngOf(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

function pick<T>(r: () => number, items: T[]): T {
  return items[Math.floor(r() * items.length)];
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}

type Grid = (string | null)[][];

function makeGrid() {
  const g: Grid = Array.from({ length: 32 }, () => Array<string | null>(32).fill(null));
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && i < 32 && j >= 0 && j < 32) g[j][i] = c;
  };
  /** Draws a rectangle and its mirror image. */
  const m = (x: number, y: number, w: number, h: number, c: string) => {
    r(x, y, w, h, c);
    r(32 - x - w, y, w, h, c);
  };
  return { g, r, m };
}

function finish(g: Grid): Grid {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (g[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx]);
      if (near) out[y][x] = INK;
    }
  }
  for (let x = 9; x < 23; x++) if (!out[31][x]) out[31][x] = SHADOW;
  return out;
}

function layersOf(grid: Grid): Layer[] {
  const by = new Map<string, string>();
  for (let y = 0; y < 32; y++) {
    let x = 0;
    while (x < 32) {
      const c = grid[y][x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < 32 && grid[y][x + w] === c) w++;
      by.set(c, (by.get(c) ?? '') + `M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  }
  return [...by.entries()].map(([color, path]) => ({ color, path }));
}

export function makeHuman(spec: HumanSpec): Layer[] {
  const r = rngOf(seedOf(spec.seed));
  const skin = pick(r, SKIN);
  const hair = spec.elder ? '#e8e8f0' : pick(r, HAIR);
  const shirt = pick(r, CLOTH);
  const pants = pick(r, PANTS);
  const style = spec.hair ?? Math.floor(r() * 4);
  const pattern = Math.floor(r() * 3);
  const accent = pick(r, CLOTH);
  const { g, r: R, m: M } = makeGrid();
  const dark = shade(skin, 0.78);

  M(12, 23, 3, 6, pants);
  M(11, 29, 4, 2, shade(pants, 0.55));
  R(10, 14, 12, 9, shirt);
  if (pattern === 1) for (const y of [16, 18, 20]) R(10, y, 12, 1, shade(shirt, 0.82));
  if (pattern === 2) M(12, 18, 2, 2, shade(shirt, 0.8));
  M(7, 14, 3, 8, shirt);
  M(7, 22, 3, 2, skin);
  R(10, 22, 12, 1, shade(pants, 0.7));
  R(14, 13, 4, 1, dark);
  R(11, 3, 10, 10, skin);
  for (const [x, y] of [[11, 3], [20, 3], [11, 12], [20, 12]]) g[y][x] = null;
  M(10, 7, 1, 2, skin);
  M(13, 7, 2, 2, '#241c2e');
  M(14, 7, 1, 1, '#ffffff');
  M(12, 10, 2, 1, shade(skin, 0.9));
  R(15, 9, 2, 1, dark);
  R(15, 11, 2, 1, '#a8505a');

  if (style === 0) {
    R(11, 2, 10, 3, hair);
    M(10, 3, 1, 4, hair);
    M(11, 5, 3, 1, hair);
  } else if (style === 1) {
    R(11, 2, 10, 3, hair);
    M(9, 4, 2, 11, hair);
    M(11, 5, 3, 1, hair);
  } else if (style === 2) {
    R(11, 2, 10, 3, hair);
    M(10, 3, 1, 4, hair);
    R(14, 0, 4, 3, hair);
    M(11, 5, 2, 1, hair);
  } else {
    R(10, 1, 12, 5, hair);
    M(9, 3, 1, 5, hair);
    for (const [x, y] of [[10, 1], [21, 1]]) g[y][x] = null;
    M(12, 5, 2, 1, skin);
  }

  switch (spec.acc ?? 'none') {
    case 'glasses':
      M(12, 6, 4, 1, '#2a2438');
      M(12, 9, 4, 1, '#2a2438');
      M(12, 7, 1, 2, '#2a2438');
      M(15, 7, 1, 2, '#2a2438');
      break;
    case 'scarf':
      R(10, 13, 12, 2, accent);
      M(10, 15, 2, 4, accent);
      break;
    case 'hat':
      R(7, 3, 18, 1, '#e0c070');
      R(11, 0, 10, 3, '#e0c070');
      R(11, 2, 10, 1, accent);
      break;
    case 'cap':
      R(10, 2, 12, 3, accent);
      R(10, 4, 12, 1, shade(accent, 0.7));
      R(8, 4, 3, 1, shade(accent, 0.7));
      break;
    case 'apron':
      R(11, 16, 10, 7, '#f2efe6');
      M(12, 14, 1, 2, '#f2efe6');
      R(13, 19, 6, 1, '#d8d2c0');
      break;
    case 'cane':
      R(25, 17, 1, 13, '#8a5a2e');
      R(24, 17, 2, 1, '#8a5a2e');
      break;
    default:
      break;
  }
  return layersOf(finish(g));
}

export function makeCat(spec: CatSpec): Layer[] {
  const r = rngOf(seedOf(spec.seed));
  const fur = pick(r, FUR);
  const light = shade(fur, 1.2);
  const { g, r: R, m: M } = makeGrid();
  R(9, 21, 14, 8, fur);
  M(10, 28, 4, 2, fur);
  R(24, 22, 2, 7, fur);
  R(25, 19, 2, 4, fur);
  R(11, 14, 10, 8, fur);
  for (const [x, y] of [[11, 14], [20, 14]]) g[y][x] = null;
  M(11, 11, 3, 3, fur);
  M(12, 12, 1, 2, '#e8a0a8');
  M(13, 16, 2, 2, '#7ad06a');
  M(14, 16, 1, 2, INK);
  R(15, 19, 2, 1, '#e8a0a8');
  M(9, 18, 2, 1, light);
  if (r() < 0.6) {
    M(13, 22, 1, 4, shade(fur, 0.75));
    R(15, 22, 2, 5, shade(fur, 0.75));
  }
  R(12, 24, 8, 4, light);
  return layersOf(finish(g));
}
