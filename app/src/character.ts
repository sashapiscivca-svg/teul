// The player's figure and the pet: procedural 32x32 pixel art in four directions with walk, idle and sit
// poses. Everything is drawn from a `Look` (read from the room's `look.*` settings), so a new look is
// just new numbers and nothing is stored as an image.

import { ramp, rgbToHex } from './pixel/palette';
import type { Layer } from './sprites';
import { t } from './i18n';

export type Dir = 'down' | 'up' | 'left' | 'right';
/** Holding an instrument and playing it (the frame moves the hands, the bow, the bellows). */
export type HoldName = 'piano' | 'guitar' | 'accordion' | 'violin' | 'bandura' | 'sopilka';
export const HOLDS: readonly HoldName[] = ['piano', 'guitar', 'accordion', 'violin', 'bandura', 'sopilka'];
/** `pedal`: on a bicycle (the frame turns the pedals). */
export type PoseName = 'idle' | 'walk' | 'sit' | 'wash' | 'work' | 'eat' | 'pray' | 'lotus' | 'ground' | 'crouch' | 'pedal' | HoldName;

export interface Look {
  skin: string;
  eye: string;
  hair: string;
  hairStyle: number;
  face: number;
  top: string;
  top2: string;
  topStyle: number;
  bottom: string;
  bottomStyle: number;
  shoes: string;
  acc: number;
  accColor: string;
  /** 0 trainers, 1 boots, 2 sandals. */
  shoeStyle: number;
  /** 0 none, 1 stubble, 2 moustache, 3 beard (in the hair colour). */
  beard: number;
  /** 0 a light blush, 1 freckles, 2 rosy cheeks. */
  cheeks: number;
  /** How the face looks this moment (a smile, a frown…); none is the face as it is. */
  expr?: Expression;
  /** On the hands: 0 bare, 1 mittens, 2 gloves. */
  mitt?: number;
  mittColor?: string;
  /** The hero's build (people/hero.ts): 0 a woman's, 1 a man's; when unset, guessed from the hair and the beard. */
  build?: number;
}

/** What the weather does to a figure (drawn over the pose): arms hugging the body and a shiver in the cold, a
 * puff of breath in the frost, a drop of sweat and screwed-up eyes in the heat, the glide of skates on the ice. */
export interface Fx {
  hug?: boolean;
  breath?: boolean;
  sweat?: boolean;
  skate?: boolean;
}

/** Faces people make: drawn over the eyes and the mouth, the same few pixels whatever the face. */
export type Expression = 'smile' | 'grin' | 'sad' | 'angry' | 'sleepy' | 'surprised' | 'love';

const MOUTH = '#a8505a';
const OPEN_MOUTH = '#6a2a38';
const LOVE = '#e0607a';

export const HAIR_STYLES = 14;
export const TOP_STYLES = 18;
export const BOTTOM_STYLES = 7;
export const ACCESSORIES = 15;
export const FACES = 4;
export const SHOE_STYLES = 4;
export const MITTS = 3;
export const BEARDS = 4;
export const CHEEKS = 3;
export const BUILDS = 2;

export const DEFAULT_LOOK: Look = {
  skin: '#f1c9a5',
  eye: '#2a2035',
  hair: '#5a3a28',
  hairStyle: 1,
  face: 0,
  top: '#3fb8b0',
  top2: '#e8e0c8',
  topStyle: 2,
  bottom: '#2f3a5a',
  bottomStyle: 0,
  shoes: '#e8e0c8',
  acc: 1,
  accColor: '#d9534f',
  shoeStyle: 0,
  beard: 0,
  cheeks: 0,
};

export const SKIN_TONES = ['#fbe0c8', '#f1c9a5', '#e0a97c', '#c98f65', '#a06b47', '#6e4630'];
export const HAIR_COLORS = ['#1f1a26', '#4a2f27', '#7a4a2a', '#c9a050', '#e8d9a0', '#d86a3a', '#9aa0b0', '#f0f0f8', '#3a5a8a', '#8a63c9', '#d86aa0', '#3fb8b0'];
export const CLOTH_COLORS = ['#d9534f', '#e8a23a', '#f4d35e', '#5aa469', '#3fb8b0', '#4a8fd0', '#8a63c9', '#d86aa0', '#e8e0c8', '#2f3a5a', '#3a3a44', '#8a5a2e'];
export const EYE_COLORS = ['#2a2035', '#4a2f27', '#2f6b4a', '#3a6aa0', '#7a5a9a', '#a04a3a'];

const INK = '#17131f';
const SHADOW = '#0000004d';

function num(v: string | undefined, max: number, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max - 1, Math.round(n))) : fallback;
}

function hex(v: string | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

/** The look described by a room's `look.*` settings; anything missing falls back to the default. */
export function lookFromSettings(s: Record<string, string>): Look {
  const d = DEFAULT_LOOK;
  return {
    skin: hex(s['look.skin_color'], d.skin),
    eye: hex(s['look.eye_color'], d.eye),
    hair: hex(s['look.hair_color'], d.hair),
    hairStyle: num(s['look.hair'], HAIR_STYLES, d.hairStyle),
    face: num(s['look.face'], FACES, d.face),
    top: hex(s['look.top_color'], d.top),
    top2: hex(s['look.top2_color'], d.top2),
    topStyle: num(s['look.top'], TOP_STYLES, d.topStyle),
    bottom: hex(s['look.bottom_color'], d.bottom),
    bottomStyle: num(s['look.bottom'], BOTTOM_STYLES, d.bottomStyle),
    shoes: hex(s['look.shoes_color'], d.shoes),
    acc: num(s['look.acc'], ACCESSORIES, d.acc),
    accColor: hex(s['look.acc_color'], d.accColor),
    shoeStyle: num(s['look.shoe'], SHOE_STYLES, d.shoeStyle),
    beard: num(s['look.beard'], BEARDS, d.beard),
    cheeks: num(s['look.cheeks'], CHEEKS, d.cheeks),
    // mittens or gloves only when worn (a look without them stays as it was)
    ...(num(s['look.mitt'], MITTS, 0) ? { mitt: num(s['look.mitt'], MITTS, 0), mittColor: hex(s['look.mitt_color'], '#d9534f') } : {}),
    // the build only when chosen (an older hero's is guessed from the hair and the beard)
    ...(s['look.build'] ? { build: num(s['look.build'], BUILDS, 0) } : {}),
  };
}

export function shade(color: string, k: number): string {
  const n = parseInt(color.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}

/** Two colours mixed, `k` of the second. */
export function mix(a: string, b: string, k: number): string {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

export type Grid = (string | null)[][];

export class Canvas {
  readonly g: Grid;
  /** A square grid `n` pixels a side (32 for the figures of Lypove and the players). */
  constructor(readonly n = 32) {
    this.g = Array.from({ length: n }, () => Array<string | null>(n).fill(null));
  }
  r(x: number, y: number, w: number, h: number, c: string): void {
    const n = this.n;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && i < n && j >= 0 && j < n) this.g[j][i] = c;
  }
  /** A rectangle and its mirror image around the middle (front and back views). */
  m(x: number, y: number, w: number, h: number, c: string): void {
    this.r(x, y, w, h, c);
    this.r(this.n - x - w, y, w, h, c);
  }
  p(x: number, y: number, c: string | null): void {
    if (x >= 0 && x < this.n && y >= 0 && y < this.n) this.g[y][x] = c;
  }
  flip(): void {
    for (const row of this.g) row.reverse();
  }
}

/**
 * Gives flat colour areas form, pixel-art style: light comes from the upper left, so a region's top row gets a
 * highlight and its right column a shade (only where the region is wide enough), and the silhouette is outlined
 * with a deep tone of the colour it touches instead of plain black. `keep` colours (eyes, mouth) stay as drawn.
 */
export function finish(g: Grid, shadow = true, keep: Set<string> = new Set()): Grid {
  const out = g.map((row) => row.slice());
  const N = g.length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? null : g[y][x]);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const c = g[y][x];
      if (!c || keep.has(c) || c.length !== 7) continue;
      const r = ramp(c);
      const left = at(x - 1, y) === c;
      const right = at(x + 1, y) === c;
      const up = at(x, y - 1) === c;
      const down = at(x, y + 1) === c;
      if (!right && left) out[y][x] = rgbToHex(r[1]);
      else if (!up && down && left && right) out[y][x] = rgbToHex(r[3]);
      else if (!down && up && left && right && y > (N * 3) / 4) out[y][x] = rgbToHex(r[1]);
    }
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      let near: string | null = null;
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
        const n = at(x + dx, y + dy);
        if (n && n.length === 7) {
          near = n;
          break;
        }
      }
      if (!near && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) near = INK;
      if (!near) continue;
      const deep = near === INK ? [23, 19, 31] : ramp(near)[0];
      out[y][x] = rgbToHex([deep[0] * 0.55, deep[1] * 0.5, deep[2] * 0.62]);
    }
  }
  if (shadow) for (let x = Math.round((N * 9) / 32); x < Math.round((N * 23) / 32); x++) if (!out[N - 1][x]) out[N - 1][x] = SHADOW;
  return out;
}

export function layersOf(grid: Grid): Layer[] {
  const by = new Map<string, string>();
  const N = grid.length;
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const c = grid[y][x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < N && grid[y][x + w] === c) w++;
      by.set(c, (by.get(c) ?? '') + `M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  }
  return [...by.entries()].map(([color, path]) => ({ color, path }));
}

interface Pose {
  /** Pixels the head and body are raised (a bounce) or lowered (sitting). */
  dy: number;
  /** Walk phase 0..3, or -1 when standing. */
  step: number;
  sit: boolean;
  /** Hands held out together in front (washing them under a tap). */
  wash?: boolean;
  /** Playing an instrument, and the moment of its movement. */
  hold?: HoldName;
  f?: number;
  /** A hammer raised in the near hand (0 up, 1 striking): someone at work on a building. */
  work?: number;
  /** An ice cream held up by the face in the near hand. */
  eat?: boolean;
  /** The palms pressed together before the chest (a prayer, a bow, a quiet moment). */
  pray?: boolean;
  /** Sitting on the floor itself, cross-legged (on a cushion, a mat, the grass). */
  floor?: boolean;
}

/** Instruments played sitting (on a stool drawn with the figure). */
const SEATED_HOLDS = new Set<HoldName>(['piano', 'bandura']);

function poseOf(name: PoseName, frame: number): Pose {
  if (name === 'sit') return { dy: 4, step: -1, sit: true };
  // squatting on one's heels: the knees bent as on a chair, the feet on the ground
  if (name === 'crouch') return { dy: 4, step: -1, sit: true };
  if (name === 'wash') return { dy: frame % 2, step: -1, sit: false, wash: true };
  if ((HOLDS as readonly string[]).includes(name)) {
    const hold = name as HoldName;
    const f = ((frame % 4) + 4) % 4;
    const seated = SEATED_HOLDS.has(hold);
    // a sway with the music: the accordion player and the fiddler move the most
    const dy = seated ? 4 : hold === 'accordion' || hold === 'violin' ? (f === 1 || f === 2 ? 1 : 0) : f === 2 ? 1 : 0;
    return { dy, step: -1, sit: seated, hold, f };
  }
  if (name === 'work') return { dy: 0, step: -1, sit: false, work: frame % 2 };
  if (name === 'pray') return { dy: 0, step: -1, sit: false, pray: true };
  if (name === 'lotus') return { dy: 6, step: -1, sit: true, floor: true, pray: true };
  // on the grass, the sand, a step: cross-legged, hands on the knees
  if (name === 'ground') return { dy: 6, step: -1, sit: true, floor: true };
  if (name === 'eat') return { dy: frame % 2 === 1 ? 1 : 0, step: -1, sit: false, eat: true };
  if (name === 'walk') {
    const step = ((frame % 4) + 4) % 4;
    return { dy: step % 2 === 1 ? -1 : 0, step, sit: false };
  }
  return { dy: frame % 2 === 1 ? 1 : 0, step: -1, sit: false };
}

// ---- hair ---------------------------------------------------------------------------------------------------

function hairFront(c: Canvas, style: number, hair: string, dy: number): void {
  const t = 2 + dy;
  const dark = shade(hair, 0.82);
  switch (style) {
    case 0:
      c.r(11, t, 10, 3, hair);
      c.m(10, t + 1, 1, 4, hair);
      c.m(11, t + 3, 3, 1, hair);
      break;
    case 1:
      c.r(11, t, 10, 3, hair);
      c.m(9, t + 2, 2, 12, hair);
      c.m(11, t + 3, 3, 1, hair);
      c.m(9, t + 7, 1, 4, dark);
      break;
    case 2:
      c.r(11, t, 10, 3, hair);
      c.m(10, t + 1, 1, 4, hair);
      c.r(14, t - 3, 4, 3, hair);
      c.r(15, t - 3, 2, 1, dark);
      c.m(11, t + 3, 2, 1, hair);
      break;
    case 3:
      c.r(10, t - 1, 12, 5, hair);
      c.m(9, t + 1, 1, 7, hair);
      c.m(12, t + 4, 2, 1, hair);
      c.p(10, t - 1, null);
      c.p(21, t - 1, null);
      c.m(10, t + 1, 1, 1, dark);
      break;
    case 4:
      c.r(11, t + 1, 10, 2, hair);
      break;
    case 5:
      c.r(11, t, 10, 3, hair);
      c.m(9, t + 2, 2, 9, hair);
      c.m(11, t + 3, 4, 1, hair);
      break;
    case 6:
      c.r(11, t, 10, 3, hair);
      for (const x of [11, 14, 17, 20]) c.r(x, t - 2, 2, 2, hair);
      c.m(10, t + 1, 1, 3, hair);
      break;
    case 7:
      break;
    case 9: // two braids
      c.r(11, t, 10, 3, hair);
      c.m(10, t + 1, 1, 4, hair);
      c.m(11, t + 3, 2, 1, hair);
      braid(c, 9, t + 5, 9, hair);
      braid(c, 21, t + 5, 9, hair);
      break;
    case 10: // a big round afro
      afroFront(c, t, hair);
      break;
    case 11: // a mohawk over shaved sides
      c.r(11, t + 1, 3, 2, shaved(hair));
      c.r(18, t + 1, 3, 2, shaved(hair));
      c.r(14, t - 3, 4, 5, hair);
      c.r(15, t - 4, 2, 1, hair);
      c.r(14, t - 3, 1, 4, shade(hair, 1.2));
      break;
    case 12: // long waves swept to one side
      c.r(11, t, 10, 3, hair);
      c.r(11, t + 3, 6, 1, hair);
      c.r(11, t + 4, 3, 1, hair);
      for (let i = 0; i < 14; i++) {
        const w = i % 4 < 2 ? 0 : 1;
        c.r(9 - w, t + 2 + i, 2, 1, hair);
        c.r(21 + w, t + 2 + i, 2, 1, hair);
      }
      c.m(10, t + 1, 1, 4, hair);
      c.m(9, t + 9, 1, 3, dark);
      break;
    case 13: // two buns
      c.r(11, t, 10, 3, hair);
      c.m(10, t + 1, 1, 4, hair);
      c.m(11, t + 3, 3, 1, hair);
      c.m(8, t - 2, 4, 4, hair);
      c.p(8, t - 2, null);
      c.p(23, t - 2, null);
      c.m(9, t + 1, 2, 1, dark);
      break;
    default:
      c.r(11, t, 10, 3, hair);
      c.m(10, t + 1, 1, 4, hair);
      c.m(8, t + 6, 2, 6, hair);
      c.m(8, t + 5, 2, 1, shade(hair, 1.3));
  }
}

/** Close-cropped hair over skin. */
function shaved(hair: string): string {
  return mix('#e8b890', hair, 0.6);
}

/** A plait: two-pixel strands crossing every row, tied at the end. */
function braid(c: Canvas, x: number, y: number, len: number, hair: string): void {
  const dark = shade(hair, 0.78);
  for (let i = 0; i < len; i++) {
    c.r(x, y + i, 2, 1, hair);
    c.p(x + (i % 2), y + i, dark);
  }
  c.r(x, y + len, 2, 1, shade(hair, 1.35));
}

/** The front of an afro: a round cloud over the head with a textured edge. */
function afroFront(c: Canvas, t: number, hair: string): void {
  afroCloud(c, t, hair, 2);
  // the hairline: an uneven edge of curls over the forehead, and sides down past the ears
  c.r(11, t + 3, 3, 1, hair);
  c.r(18, t + 3, 3, 1, hair);
  c.p(14, t + 3, hair);
  c.m(8, t + 3, 3, 4, hair);
  c.m(9, t + 7, 2, 1, hair);
  curls(c, t, hair);
}

/** A round cloud of hair, `bottom` rows below t. */
function afroCloud(c: Canvas, t: number, hair: string, bottom: number): void {
  c.r(12, t - 2, 8, 1, hair);
  c.r(10, t - 1, 12, 1, hair);
  c.r(9, t, 14, 1, hair);
  c.r(8, t + 1, 16, Math.min(bottom, 3), hair);
  if (bottom > 3) c.r(8, t + 4, 16, bottom - 4, hair);
  if (bottom > 3) c.r(9, t + bottom, 14, 1, hair);
}

/** Curl texture: a scatter of darker and lighter pixels. */
function curls(c: Canvas, t: number, hair: string): void {
  const dark = shade(hair, 0.78);
  const light = shade(hair, 1.2);
  for (const [x, y] of [[11, t - 1], [15, t - 2], [19, t - 1], [9, t + 1], [13, t], [17, t + 1], [21, t], [22, t + 2], [12, t + 2], [16, t - 1], [9, t + 4], [22, t + 5]]) c.p(x, y, dark);
  for (const [x, y] of [[12, t - 1], [14, t], [10, t + 1], [18, t]]) c.p(x, y, light);
}

function hairBack(c: Canvas, style: number, hair: string, dy: number): void {
  const t = 2 + dy;
  switch (style) {
    case 0:
    case 6:
      c.r(11, t, 10, 8, hair);
      c.m(10, t + 1, 1, 5, hair);
      if (style === 6) for (const x of [11, 14, 17, 20]) c.r(x, t - 2, 2, 2, hair);
      break;
    case 1:
      c.r(10, t, 12, 14, hair);
      c.r(10, t + 11, 12, 1, shade(hair, 0.82));
      break;
    case 2:
      c.r(11, t, 10, 8, hair);
      c.m(10, t + 1, 1, 5, hair);
      c.r(14, t - 3, 4, 3, hair);
      break;
    case 3:
      c.r(9, t - 1, 14, 11, hair);
      break;
    case 4:
      c.r(11, t + 1, 10, 3, hair);
      break;
    case 5:
      c.r(10, t, 12, 11, hair);
      break;
    case 7:
      break;
    case 9:
      c.r(11, t, 10, 8, hair);
      c.m(10, t + 1, 1, 5, hair);
      c.r(15, t + 2, 2, 6, shade(hair, 0.82));
      braid(c, 9, t + 5, 9, hair);
      braid(c, 21, t + 5, 9, hair);
      break;
    case 10:
      afroCloud(c, t, hair, 9);
      curls(c, t, hair);
      for (const [x, y] of [[13, t + 5], [18, t + 6], [11, t + 7], [20, t + 8]]) c.p(x, y, shade(hair, 0.78));
      break;
    case 11:
      c.r(11, t + 1, 10, 7, shaved(hair));
      c.r(14, t - 4, 4, 11, hair);
      c.r(15, t - 4, 2, 11, shade(hair, 1.15));
      break;
    case 12:
      c.r(10, t, 12, 9, hair);
      for (let i = 0; i < 7; i++) {
        const w = i % 4 < 2 ? 0 : 1;
        c.r(9 - w, t + 9 + i, 14 + w * 2, 1, hair);
      }
      c.r(13, t + 4, 1, 10, shade(hair, 0.82));
      c.r(18, t + 6, 1, 8, shade(hair, 0.82));
      break;
    case 13:
      c.r(11, t, 10, 8, hair);
      c.m(10, t + 1, 1, 5, hair);
      c.m(8, t - 2, 4, 4, hair);
      c.p(8, t - 2, null);
      c.p(23, t - 2, null);
      break;
    default:
      c.r(11, t, 10, 8, hair);
      c.m(10, t + 1, 1, 5, hair);
      c.m(8, t + 6, 2, 6, hair);
  }
}

function hairSide(c: Canvas, style: number, hair: string, dy: number): void {
  const t = 2 + dy;
  const dark = shade(hair, 0.82);
  switch (style) {
    case 0:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 6, hair);
      break;
    case 1:
      c.r(11, t, 10, 3, hair);
      c.r(9, t + 1, 6, 14, hair);
      c.r(9, t + 11, 6, 1, dark);
      c.r(19, t + 2, 2, 2, hair);
      break;
    case 2:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 6, hair);
      c.r(11, t - 3, 4, 3, hair);
      break;
    case 3:
      c.r(10, t - 1, 12, 5, hair);
      c.r(9, t + 1, 6, 8, hair);
      c.r(18, t + 3, 3, 1, hair);
      break;
    case 4:
      c.r(11, t + 1, 10, 2, hair);
      break;
    case 5:
      c.r(11, t, 10, 3, hair);
      c.r(9, t + 1, 7, 10, hair);
      break;
    case 6:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 5, hair);
      for (const x of [11, 14, 17]) c.r(x, t - 2, 2, 2, hair);
      break;
    case 7:
      break;
    case 9:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 6, hair);
      braid(c, 10, t + 7, 8, hair);
      break;
    case 10:
      afroCloud(c, t, hair, 2);
      c.r(8, t + 3, 8, 5, hair);
      c.r(9, t + 8, 6, 1, hair);
      c.r(16, t + 3, 5, 1, hair);
      c.p(21, t + 3, null);
      curls(c, t, hair);
      for (const [x, y] of [[10, t + 5], [13, t + 7], [9, t + 3]]) c.p(x, y, shade(hair, 0.78));
      break;
    case 11:
      c.r(12, t + 1, 6, 2, shaved(hair));
      c.r(11, t + 2, 3, 4, shaved(hair));
      for (const x of [11, 14, 17]) {
        c.r(x, t - 3, 3, 4, hair);
        c.p(x + 2, t - 3, null);
      }
      c.r(20, t - 1, 2, 2, hair);
      break;
    case 12:
      c.r(11, t, 10, 3, hair);
      c.r(18, t + 3, 3, 1, hair);
      for (let i = 0; i < 15; i++) {
        const w = i % 4 < 2 ? 0 : 1;
        c.r(9 - w, t + 1 + i, 6, 1, hair);
      }
      c.r(11, t + 6, 1, 8, shade(hair, 0.82));
      break;
    case 13:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 6, hair);
      c.r(9, t - 2, 4, 4, hair);
      c.p(9, t - 2, null);
      c.r(16, t - 3, 4, 3, hair);
      c.p(19, t - 3, null);
      break;
    default:
      c.r(11, t, 10, 3, hair);
      c.r(10, t + 1, 5, 5, hair);
      c.r(8, t + 6, 3, 6, hair);
  }
}

// ---- the figure ----------------------------------------------------------------------------------------------

/** A face that shows a feeling, front view; true when drawn. */
function exprFront(c: Canvas, look: Look, y: number): boolean {
  const e = look.eye;
  const brow = shade(look.hair, 0.75);
  const blush = shade(look.skin, 0.88);
  switch (look.expr) {
    case 'smile':
      c.m(13, y, 2, 2, e);
      c.m(13, y, 1, 1, '#ffffff');
      c.r(15, y + 3, 2, 1, MOUTH);
      c.p(14, y + 2, MOUTH);
      c.p(17, y + 2, MOUTH);
      c.m(12, y + 3, 1, 1, blush);
      return true;
    case 'grin':
      // eyes squeezed into happy arcs, a wide open smile
      c.m(12, y + 1, 1, 1, e);
      c.m(13, y, 1, 1, e);
      c.m(14, y + 1, 1, 1, e);
      c.r(14, y + 3, 4, 1, OPEN_MOUTH);
      c.r(15, y + 4, 2, 1, OPEN_MOUTH);
      c.p(13, y + 2, MOUTH);
      c.p(18, y + 2, MOUTH);
      c.m(11, y + 3, 2, 1, mix(look.skin, ROSY, 0.35));
      return true;
    case 'sad':
      // drooping eyes, brows up in the middle, the corners of the mouth down
      c.m(13, y + 1, 2, 1, e);
      c.m(14, y - 1, 1, 1, brow);
      c.m(12, y, 1, 1, brow);
      c.r(15, y + 3, 2, 1, MOUTH);
      c.p(14, y + 4, MOUTH);
      c.p(17, y + 4, MOUTH);
      return true;
    case 'angry':
      // brows down to the nose, narrowed eyes, a tight mouth
      c.m(12, y - 2, 1, 1, brow);
      c.m(13, y - 1, 2, 1, brow);
      c.m(13, y, 2, 1, e);
      c.r(14, y + 4, 4, 1, MOUTH);
      c.m(11, y + 2, 2, 1, mix(look.skin, '#d04040', 0.3));
      return true;
    case 'sleepy':
      c.m(13, y + 1, 2, 1, e);
      c.r(15, y + 4, 2, 1, MOUTH);
      return true;
    case 'surprised':
      c.m(13, y - 1, 2, 3, e);
      c.m(13, y - 1, 1, 1, '#ffffff');
      c.m(13, y - 3, 2, 1, brow);
      c.r(15, y + 3, 2, 2, OPEN_MOUTH);
      return true;
    case 'love':
      // little hearts for eyes, a smile, warm cheeks
      c.m(12, y, 1, 1, LOVE);
      c.m(14, y, 1, 1, LOVE);
      c.m(12, y + 1, 3, 1, LOVE);
      c.m(13, y + 2, 1, 1, LOVE);
      c.r(15, y + 4, 2, 1, MOUTH);
      c.p(14, y + 3, MOUTH);
      c.p(17, y + 3, MOUTH);
      c.m(11, y + 3, 1, 1, mix(look.skin, ROSY, 0.5));
      return true;
    default:
      return false;
  }
}

/** The same in profile (looking right). */
function exprSide(c: Canvas, look: Look, y: number): boolean {
  const e = look.eye;
  const brow = shade(look.hair, 0.75);
  switch (look.expr) {
    case 'smile':
      c.r(18, y, 2, 2, e);
      c.p(18, y, '#ffffff');
      c.r(19, y + 4, 2, 1, MOUTH);
      c.p(21, y + 3, MOUTH);
      return true;
    case 'grin':
      c.p(18, y + 1, e);
      c.p(19, y, e);
      c.p(20, y + 1, e);
      c.r(19, y + 4, 3, 1, OPEN_MOUTH);
      c.p(21, y + 3, MOUTH);
      return true;
    case 'sad':
      c.r(18, y + 1, 2, 1, e);
      c.p(18, y - 1, brow);
      c.r(19, y + 4, 2, 1, MOUTH);
      c.p(21, y + 5, MOUTH);
      return true;
    case 'angry':
      c.r(18, y - 2, 1, 1, brow);
      c.r(19, y - 1, 2, 1, brow);
      c.r(18, y, 2, 1, e);
      c.r(19, y + 4, 3, 1, MOUTH);
      return true;
    case 'sleepy':
      c.r(18, y + 1, 2, 1, e);
      c.r(19, y + 4, 2, 1, MOUTH);
      return true;
    case 'surprised':
      c.r(18, y - 1, 2, 3, e);
      c.p(18, y - 1, '#ffffff');
      c.r(18, y - 3, 2, 1, brow);
      c.r(19, y + 4, 2, 2, OPEN_MOUTH);
      return true;
    case 'love':
      c.p(18, y, LOVE);
      c.p(20, y, LOVE);
      c.r(18, y + 1, 3, 1, LOVE);
      c.p(19, y + 2, LOVE);
      c.r(19, y + 4, 2, 1, MOUTH);
      c.p(21, y + 3, MOUTH);
      return true;
    default:
      return false;
  }
}

function faceFront(c: Canvas, look: Look, dy: number): void {
  const e = look.eye;
  const y = 7 + dy;
  if (look.face !== -1 && exprFront(c, look, y)) return;
  if (look.face === -1) {
    // eyes closed for a blink
    c.m(13, y + 1, 2, 1, e);
    c.r(15, y + 3, 2, 1, '#a8505a');
    return;
  }
  if (look.acc === 1 && (look.face === 0 || look.face === 1)) {
    // behind glasses: a light lens with one dark pupil, so the frame does not merge with the eye
    c.m(13, y, 1, 2, '#dff3ff');
    c.m(14, y, 1, 2, e);
    c.r(15, y + 3, 2, 1, '#a8505a');
    c.m(12, y + 3, 1, 1, shade(look.skin, 0.88));
    return;
  }
  switch (look.face) {
    case 1:
      c.m(12, y - 1, 2, 3, e);
      c.m(12, y - 1, 1, 1, '#ffffff');
      c.r(15, y + 3, 2, 1, '#a8505a');
      break;
    case 2:
      c.m(12, y, 1, 1, e);
      c.m(13, y - 1, 1, 1, e);
      c.m(14, y, 1, 1, e);
      c.r(14, y + 3, 4, 1, '#a8505a');
      c.p(13, y + 3, '#a8505a');
      c.p(18, y + 3, '#a8505a');
      break;
    case 3:
      c.m(12, y + 1, 3, 1, e);
      c.r(15, y + 4, 2, 1, '#a8505a');
      break;
    default:
      c.m(13, y, 2, 2, e);
      c.m(13, y, 1, 1, '#ffffff');
      c.r(15, y + 3, 2, 1, '#a8505a');
  }
  const blush = shade(look.skin, 0.88);
  c.m(12, y + 3, 1, 1, blush);
}

const FRECKLE_K = 0.72;
const ROSY = '#e0607a';

/** Cheeks and facial hair, over the face (front) or its profile (side). */
function faceExtras(c: Canvas, look: Look, dy: number, side: boolean): void {
  const y = 7 + dy;
  const { skin, hair } = look;
  if (look.cheeks === 1) {
    const f = shade(skin, FRECKLE_K);
    if (side) for (const [x, yy] of [[17, y + 2], [18, y + 3], [16, y + 3]]) c.p(x, yy, f);
    else for (const [x, yy] of [[12, y + 2], [13, y + 3], [11, y + 4]]) {
      c.p(x, yy, f);
      c.p(31 - x, yy, f);
    }
  } else if (look.cheeks === 2) {
    const r = mix(skin, ROSY, 0.4);
    if (side) c.r(17, y + 2, 2, 2, r);
    else c.m(12, y + 2, 2, 2, r);
  }
  const mouth = () => (side ? c.r(19, y + 4, 2, 1, '#a8505a') : c.r(15, y + 3, 2, 1, '#a8505a'));
  if (look.beard === 1) {
    const st = mix(skin, hair, 0.35);
    if (side) c.r(16, y + 3, 6, 3, st);
    else c.r(12, y + 3, 8, 3, st);
    mouth();
  } else if (look.beard === 2) {
    if (side) c.r(19, y + 3, 3, 1, hair);
    else {
      // over the lip, curling down at the ends; the mouth shows under it
      c.r(14, y + 3, 4, 1, hair);
      c.m(13, y + 4, 1, 1, hair);
      c.r(15, y + 4, 2, 1, '#a8505a');
    }
  } else if (look.beard === 3) {
    if (side) {
      c.r(15, y + 2, 7, 4, hair);
      c.r(17, y + 6, 4, 1, hair);
      c.r(19, y + 3, 3, 1, shade(hair, 0.85));
    } else {
      c.m(11, y + 1, 1, 4, hair);
      c.r(12, y + 3, 8, 3, hair);
      c.r(13, y + 6, 6, 1, hair);
      c.r(14, y + 2, 4, 1, shade(hair, 0.85));
    }
    mouth();
  }
}

/** A foot: trainers (as ever), boots up the shin, or sandals with a strap. `lx` is the leg it is under. */
function shoe(c: Canvas, look: Look, sx: number, lx: number, y: number, tint = 1): void {
  const shoes = shade(look.shoes, tint);
  const sole = shade(look.shoes, 0.7 * tint);
  if (look.shoeStyle === 3) {
    // felt boots: tall and soft, up to the knee, the felt flecked lighter
    c.r(lx, y - 5, 3, 5, shoes);
    c.r(lx, y - 5, 3, 1, shade(look.shoes, 1.15 * tint));
    c.p(lx + 1, y - 3, shade(look.shoes, 1.22 * tint));
    c.r(sx, y, 4, 2, shoes);
    c.r(sx, y + 1, 4, 1, shade(look.shoes, 0.82 * tint));
  } else if (look.shoeStyle === 1) {
    c.r(lx, y - 3, 3, 3, shoes);
    c.r(lx, y - 3, 3, 1, shade(look.shoes, 1.18 * tint));
    c.r(sx, y, 4, 2, shoes);
    c.r(sx, y + 1, 4, 1, sole);
  } else if (look.shoeStyle === 2) {
    c.r(sx, y, 4, 1, shade(look.skin, tint));
    c.r(sx + 1, y, 2, 1, shoes);
    c.r(sx, y + 1, 4, 1, sole);
  } else {
    c.r(sx, y, 4, 2, shoes);
    c.r(sx, y + 1, 4, 1, sole);
  }
}

const LONG_SLEEVES = new Set([1, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14]);
/** A coat (9), a raincoat (10), a down coat (11), a sheepskin (12), a trench (13): long, over the hips. */
const COATS = new Set([9, 10, 11, 12, 13]);
/** No sleeves at all: the waistcoat, the sundress, the swimsuit. */
const BARE_ARMS = new Set([5, 15, 16]);
const isDress = (look: Look) => look.topStyle === 3 || look.topStyle === 15;

/** The extra tops, over the plain torso: overalls, a patterned jumper, an open jacket. */
function topDetail(c: Canvas, look: Look, x0: number, w: number, y0: number, view: 'front' | 'back' | 'side'): void {
  const { top, top2, bottom } = look;
  const x1 = x0 + w - 1;
  if (look.topStyle === 6) {
    if (view === 'side') {
      c.r(x0 + 1, y0 + 3, w - 2, 5, bottom);
      c.r(x0 + w - 3, y0, 1, 3, bottom);
      return;
    }
    c.r(x0 + 2, y0 + (view === 'back' ? 5 : 3), w - 4, view === 'back' ? 3 : 5, bottom);
    c.r(x0 + 2, y0, 1, view === 'back' ? 5 : 3, bottom);
    c.r(x1 - 2, y0, 1, view === 'back' ? 5 : 3, bottom);
    if (view === 'front') {
      c.p(x0 + 2, y0 + 3, top2);
      c.p(x1 - 2, y0 + 3, top2);
      c.r(x0 + 4, y0 + 5, w - 8, 1, shade(bottom, 0.8));
    }
  } else if (look.topStyle === 7) {
    for (let x = x0; x <= x1; x++) c.p(x, y0 + 2 + ((x - x0) % 2), top2);
    for (let x = x0; x <= x1; x += 3) c.p(x, y0 + 5, top2);
    c.r(x0, y0 + 7, w, 1, shade(top, 0.82));
    if (view === 'front') c.r(x0 + 3, y0, w - 6, 1, shade(top, 0.8));
  } else if (look.topStyle === 8) {
    if (view === 'front') {
      c.r(x0 + 4, y0, w - 8, 8, top2);
      c.r(x0 + 3, y0, 1, 3, shade(top, 0.72));
      c.r(x1 - 3, y0, 1, 3, shade(top, 0.72));
      c.r(x0 + 1, y0 + 5, 2, 1, shade(top, 0.8));
      c.r(x1 - 2, y0 + 5, 2, 1, shade(top, 0.8));
    } else if (view === 'side') {
      c.r(x1, y0, 1, 7, top2);
      c.r(x0 + 3, y0 - 1, 4, 1, shade(top, 0.8));
    } else {
      c.r(x0 + 1, y0 - 1, w - 2, 1, shade(top, 0.8));
    }
    c.r(x0, y0 + 8, w, 1, top);
  } else if (look.topStyle === 14) {
    // a windbreaker: a zip down the front, a drawstring hood folded at the neck, a band at the waist
    if (view === 'front') {
      c.r(x0 + w / 2, y0, 1, 8, top2);
      c.p(x0 + w / 2 - 2, y0 + 1, top2);
      c.p(x0 + w / 2 + 2, y0 + 1, top2);
    } else if (view === 'side') c.r(x1 - 1, y0, 1, 8, top2);
    c.r(x0 + 1, y0 - 1, w - 2, 1, shade(top, 0.82));
    c.r(x0, y0 + 7, w, 1, shade(top, 0.75));
  } else if (look.topStyle === 15) {
    // a sundress: thin straps over bare shoulders, a print on the cloth
    const skin = look.skin;
    c.r(x0, y0, w, 2, skin);
    if (view !== 'side') {
      c.r(x0 + 2, y0, 1, 2, top);
      c.r(x1 - 2, y0, 1, 2, top);
    } else c.r(x0 + 3, y0, 1, 2, top);
    for (let x = x0 + 1; x < x1; x += 3) c.p(x, y0 + 4 + ((x - x0) % 2), top2);
  } else if (look.topStyle === 16) {
    // a swimsuit: bare from the shoulders, the suit from the chest to the hips, spotted
    c.r(x0, y0, w, 3, look.skin);
    if (view !== 'side') {
      c.p(x0 + 3, y0 + 1, top);
      c.p(x1 - 3, y0 + 1, top);
    }
    for (let x = x0 + 1; x < x1; x += 3) c.p(x, y0 + 5, top2);
  }
}

/** The long part of a coat seen from the front or the back: over the hips, a row of buttons, a collar, a belt. */
function coatFront(c: Canvas, look: Look, y0: number, back: boolean, sit: boolean): void {
  const { top, top2 } = look;
  if (look.topStyle === 11) return pufferFront(c, look, y0, back, sit);
  const hem = sit ? 2 : 4;
  c.r(9, y0 + 8, 14, hem, top);
  c.r(9, y0 + 8 + hem - 1, 14, 1, shade(top, 0.78));
  c.r(9, y0 + 2, 1, 6 + hem, shade(top, 0.86));
  c.r(22, y0 + 2, 1, 6 + hem, shade(top, 0.86));
  if (!back) {
    // the opening and its buttons, the collar turned down
    c.r(15, y0 + 1, 2, 7 + hem, shade(top, 0.82));
    for (let y = y0 + 2; y < y0 + 8 + hem; y += 3) c.p(17, y, top2);
    c.r(12, y0 - 1, 3, 2, shade(top, 1.12));
    c.r(17, y0 - 1, 3, 2, shade(top, 1.12));
    c.r(10, y0 + 6, 12, 1, shade(top, 0.7));
  } else {
    c.r(15, y0 + 6, 2, 2 + hem, shade(top, 0.8));
    c.r(10, y0 + 6, 12, 1, shade(top, 0.7));
  }
  if (look.topStyle === 10) {
    // the raincoat: a hood (behind the head seen from the front, over the back seen from behind) and a shine
    if (back) {
      c.r(11, y0 - 3, 10, 4, top);
      c.r(12, y0 - 3, 8, 1, shade(top, 1.15));
    } else {
      c.r(10, y0 - 2, 2, 3, shade(top, 0.9));
      c.r(20, y0 - 2, 2, 3, shade(top, 0.9));
    }
    c.r(11, y0 + 1, 1, 5, shade(top, 1.28));
    c.r(20, y0 + 9, 1, hem - 1, shade(top, 1.2));
  }
  if (look.topStyle === 12) {
    // a sheepskin: the fleece shows at the collar, down the opening, at the hem and the cuffs
    c.r(11, y0 - 1, 10, 2, top2);
    if (!back) c.r(14, y0 + 1, 1, 7 + hem, top2);
    c.r(9, y0 + 8 + hem - 1, 14, 1, top2);
  }
  if (look.topStyle === 13) {
    // a trench: lapels, two rows of buttons, a belt with a buckle
    if (!back) {
      for (let y = y0 + 2; y < y0 + 8; y += 2) c.p(13, y, top2);
      c.r(12, y0, 2, 2, shade(top, 1.15));
      c.r(18, y0, 2, 2, shade(top, 1.15));
      c.r(15, y0 + 6, 2, 1, top2);
    }
    c.r(9, y0 + 6, 14, 1, shade(top, 0.62));
  }
}

/** A down coat: puffed out a pixel each side, quilted in bands, a hood with a fur trim, to the hips. */
function pufferFront(c: Canvas, look: Look, y0: number, back: boolean, sit: boolean): void {
  const { top, top2 } = look;
  const hem = sit ? 1 : 2;
  c.r(9, y0, 14, 8 + hem, top);
  for (let y = y0 + 2; y < y0 + 8 + hem; y += 3) c.r(9, y, 14, 1, shade(top, 0.8));
  // the hood lying on the shoulders, trimmed with fur
  c.r(10, y0 - 1, 12, 2, back ? top : shade(top, 1.1));
  c.r(10, y0 - 2, 12, 1, top2);
  if (back) c.r(11, y0 - 3, 10, 2, top);
  else c.r(15, y0 + 1, 2, 7 + hem, shade(top, 0.86));
  if (!back) c.r(15, y0 + 1, 1, 7 + hem, top2);
}

/** A down coat from the side. */
function pufferSide(c: Canvas, look: Look, y0: number, sit: boolean): void {
  const { top, top2 } = look;
  const hem = sit ? 1 : 2;
  c.r(11, y0, 10, 8 + hem, top);
  for (let y = y0 + 2; y < y0 + 8 + hem; y += 3) c.r(11, y, 10, 1, shade(top, 0.8));
  c.r(10, y0 - 3, 4, 4, top);
  c.r(10, y0 - 3, 4, 1, top2);
  c.r(13, y0 - 1, 6, 1, top2);
}

/** The long part of a coat seen from the side. */
function coatSide(c: Canvas, look: Look, y0: number, sit: boolean): void {
  const { top, top2 } = look;
  if (look.topStyle === 11) return pufferSide(c, look, y0, sit);
  const hem = sit ? 2 : 4;
  if (sit) c.r(15, y0 + 8, 8, 2, top);
  else c.r(11, y0 + 8, 10, hem, top);
  c.r(11, y0 + 8 + hem - 1, sit ? 0 : 10, 1, shade(top, 0.78));
  c.r(19, y0, 1, 8 + (sit ? 0 : hem), shade(top, 0.82));
  for (let y = y0 + 2; y < y0 + 8 + (sit ? 0 : hem); y += 3) c.p(19, y, top2);
  c.r(12, y0 + 6, 8, 1, shade(top, 0.7));
  c.r(13, y0 - 1, 4, 1, shade(top, 1.12));
  if (look.topStyle === 10) {
    c.r(10, y0 - 3, 4, 4, top);
    c.r(10, y0 - 3, 4, 1, shade(top, 1.15));
    c.r(13, y0 + 1, 1, 5, shade(top, 1.28));
  }
  if (look.topStyle === 12) {
    c.r(13, y0 - 1, 6, 2, top2);
    c.r(19, y0, 1, 8 + (sit ? 0 : hem), top2);
    if (!sit) c.r(11, y0 + 8 + hem - 1, 10, 1, top2);
  }
  if (look.topStyle === 13) {
    c.r(11, y0 + 6, 10, 1, shade(top, 0.62));
    c.p(18, y0 + 2, top2);
    c.p(18, y0 + 4, top2);
  }
}

function drawFront(c: Canvas, look: Look, pose: Pose, back: boolean, fx: Fx = {}): void {
  const dy = pose.dy;
  const { skin, top, top2, bottom, shoes } = look;
  const skinDark = shade(skin, 0.8);
  const legTop = 23;
  const legBottom = pose.sit ? 27 : 28;
  const lift = (side: 'l' | 'r') => (pose.step === 1 && side === 'l') || (pose.step === 3 && side === 'r') ? 1 : 0;
  const dress = isDress(look);
  const handC = look.mitt ? (look.mittColor ?? '#d9534f') : look.skin;

  // sitting, seen from the front: thighs towards the viewer, round knees, shins down, hands on the knees
  if (pose.sit && pose.floor) {
    // cross-legged on the floor: the knees out to the sides, the shins crossed in front, the soles showing
    const cloth = dress || look.bottomStyle === 2 || look.bottomStyle === 1 || look.bottomStyle === 5 ? skin : bottom;
    const lap = dress ? top : look.bottomStyle === 4 ? bottom : cloth;
    c.r(8, 26, 16, 3, lap);
    c.r(8, 28, 16, 1, shade(lap, 0.8));
    c.r(10, 27, 12, 2, shade(cloth, 0.9));
    c.r(15, 27, 2, 2, shade(cloth, 0.75));
    c.r(9, 28, 3, 1, look.shoeStyle === 2 ? skin : shade(shoes, 0.9));
    c.r(20, 28, 3, 1, look.shoeStyle === 2 ? skin : shade(shoes, 0.9));
  } else if (pose.sit) {
    for (const side of ['l', 'r'] as const) {
      const x = side === 'l' ? 11 : 17;
      const cloth = dress || look.bottomStyle === 2 ? skin : bottom;
      c.r(x, 23, 4, 2, cloth);
      c.r(x, 25, 4, 1, shade(cloth, 1.12));
      const shin = look.shoeStyle === 1 ? shoes : (look.bottomStyle === 0 || look.bottomStyle === 3) && !dress ? bottom : skin;
      c.r(x, 26, 4, 2, shade(shin, 0.82));
      c.r(x, 28, 4, 1, look.shoeStyle === 2 ? skin : shoes);
      if (look.shoeStyle === 2) c.r(x + 1, 28, 2, 1, shoes);
      c.r(x, 29, 4, 1, shade(shoes, 0.7));
    }
  }
  // legs
  for (const side of pose.sit ? ([] as ('l' | 'r')[]) : (['l', 'r'] as const)) {
    const x = side === 'l' ? (fx.skate ? 11 : 12) : fx.skate ? 18 : 17;
    const l = fx.skate ? 0 : lift(side);
    const h = legBottom - legTop + 1 - l;
    const b = look.bottomStyle;
    const naked = dress || (b !== 0 && b !== 3);
    const pantsH = (b === 1 || b === 5) && !dress ? (b === 5 ? 2 : 3) : dress || b === 4 ? 0 : h;
    if (naked) c.r(x, legTop, 3, h, skin);
    if (pantsH > 0 && b === 3 && !dress) {
      // wide trousers: a leg a pixel wider, flaring at the hem
      c.r(side === 'l' ? 11 : 17, legTop, 4, h, bottom);
      c.r(side === 'l' ? 11 : 17, legTop + h - 1, 4, 1, shade(bottom, 0.85));
    } else if (pantsH > 0) c.r(x, legTop, 3, Math.min(h, pantsH), bottom);
    shoe(c, look, x - (side === 'l' ? 1 : 0), x, legBottom + 1 - l);
    if (fx.skate) c.r(x - (side === 'l' ? 1 : 0), 31, 4, 1, '#cfd8e4');
    if (look.bottomStyle === 1 && !dress) c.r(x, legTop + 3, 3, 1, shade(skin, 0.9));
    // cargo trousers: a pocket on the outer thigh
    if (look.bottomStyle === 6 && !dress) c.r(side === 'l' ? x : x + 2, legTop + 1, 1, 2, shade(bottom, 0.8));
  }

  const y0 = 14 + dy;
  // torso
  c.r(10, y0, 12, 8, top);
  if (dress) {
    c.r(9, y0 + 8, 14, 5, top);
    c.r(9, y0 + 12, 14, 1, shade(top, 0.8));
  } else if (look.bottomStyle === 2) {
    c.r(9, y0 + 8, 14, 3, bottom);
    c.r(9, y0 + 10, 14, 1, shade(bottom, 0.75));
  } else if (look.bottomStyle === 4 && !pose.sit) {
    // a long skirt down to the ankles
    c.r(10, y0 + 8, 12, 2, bottom);
    c.r(9, y0 + 10, 14, 4, bottom);
    c.r(9, y0 + 13, 14, 1, shade(bottom, 0.75));
    c.r(13, y0 + 10, 1, 3, shade(bottom, 0.85));
    c.r(18, y0 + 10, 1, 3, shade(bottom, 0.85));
  } else if (look.bottomStyle === 4) {
    c.r(9, y0 + 8, 14, 5, bottom);
    c.r(9, y0 + 12, 14, 1, shade(bottom, 0.75));
  } else {
    c.r(10, y0 + 8, 12, 1, shade(bottom, 0.7));
  }
  if (look.topStyle === 4) for (const y of [y0 + 1, y0 + 3, y0 + 5]) c.r(10, y, 12, 1, top2);
  if (look.topStyle === 5) {
    c.r(10, y0, 12, 8, top2);
    c.r(11, y0, 10, 8, top);
    c.r(15, y0, 2, 8, shade(top, 0.85));
  }
  if (look.topStyle === 2) {
    if (!back) {
      c.r(13, y0 + 5, 6, 2, shade(top, 0.85));
      c.r(14, y0 + 1, 1, 3, top2);
      c.r(17, y0 + 1, 1, 3, top2);
    }
    c.r(11, y0 - 1, 10, 1, shade(top, 0.8));
  }
  topDetail(c, look, 10, 12, y0, back ? 'back' : 'front');
  if (COATS.has(look.topStyle)) coatFront(c, look, y0, back, pose.sit);
  // arms: swing opposite to the legs
  const swing = pose.step === 1 ? 1 : pose.step === 3 ? -1 : 0;
  const longSleeve = LONG_SLEEVES.has(look.topStyle);
  for (const side of ['l', 'r'] as const) {
    const x = side === 'l' ? 7 : 22;
    const s = side === 'l' ? swing : -swing;
    const ay = y0 + (pose.sit ? 1 : 0) + s;
    const sleeve = longSleeve ? 7 : BARE_ARMS.has(look.topStyle) ? 0 : 3;
    const cloth = sleeve > 0 ? top : skin;
    if (pose.hold) continue;
    if (fx.hug && !pose.sit && !pose.wash) {
      // hugging oneself against the cold: the upper arm down, the forearm across the chest, the hand on the far arm
      c.r(x, y0, 3, 5, cloth);
      c.r(side === 'l' ? 10 : 12, y0 + (side === 'l' ? 4 : 5), 10, 2, longSleeve ? top : skin);
      c.r(side === 'l' ? 20 : 9, y0 + (side === 'l' ? 3 : 4), 3, 2, handC);
      continue;
    }
    if (fx.skate && !pose.sit && !pose.wash) {
      // arms out for balance
      c.r(side === 'l' ? 3 : 22, y0 + 1, 7, 2, sleeve >= 3 ? top : skin);
      if (sleeve === 3) c.r(side === 'l' ? 3 : 25, y0 + 1, 4, 2, skin);
      c.r(side === 'l' ? 1 : 29, y0 + 1, 2, 2, handC);
      continue;
    }
    if (pose.pray) {
      // the upper arms down by the body, the forearms up and in: the palms meet before the chest
      c.r(side === 'l' ? x + 1 : x - 1, ay, 3, 4, cloth);
      if (back) continue;
      c.r(side === 'l' ? 11 : 17, ay + 3, 4, 2, longSleeve ? top : skin);
      c.r(side === 'l' ? 14 : 16, ay, 2, 4, handC);
      if (side === 'r') c.r(15, ay - 1, 2, 1, shade(handC, 0.9));
      continue;
    }
    if (pose.wash) {
      // upper arms down, forearms forward and in: the hands meet in front of the body
      c.r(x, y0, 3, 5, longSleeve ? top : skin);
      if (sleeve > 0) c.r(x, y0, 3, Math.min(sleeve, 3), top);
      const hx = side === 'l' ? 10 : 18;
      c.r(hx, y0 + 5, 4, 2, longSleeve ? top : skin);
      c.r(side === 'l' ? 13 : 16, y0 + 6 + (pose.dy ? 0 : 1), 3, 2, handC);
      continue;
    }
    if (pose.work !== undefined && side === 'r') {
      // the hammer up, then down on the nail
      const up = pose.work ? 2 : 0;
      c.r(x, y0 - 5 + up, 3, 6, longSleeve ? top : skin);
      if (sleeve > 0) c.r(x, y0 - 1 + up, 3, 2, top);
      c.r(x, y0 - 7 + up, 3, 2, skin);
      c.r(x + 1, y0 - 11 + up, 1, 4, '#8a5a2e');
      c.r(x - 1, y0 - 12 + up, 4, 2, '#6a6470');
      continue;
    }
    if (pose.eat && side === 'r') {
      // the cone held up by the face
      c.r(x, y0, 3, 3, longSleeve ? top : skin);
      c.r(x - 1, y0 - 3, 3, 3, longSleeve ? top : skin);
      c.r(x - 1, y0 - 5, 3, 2, skin);
      c.r(x - 1, y0 - 8, 2, 3, '#e8a23a');
      c.r(x - 2, y0 - 11, 4, 3, '#f4b6c8');
      c.p(x - 1, y0 - 11, '#ffffff');
      continue;
    }
    if (pose.sit) {
      // hands resting on the knees
      c.r(x + (side === 'l' ? 1 : -1), ay, 3, 7, skin);
      if (sleeve > 0) c.r(x + (side === 'l' ? 1 : -1), ay, 3, Math.min(sleeve, 6), top);
      c.r(side === 'l' ? 10 : 19, ay + 7, 3, 2, handC);
      continue;
    }
    c.r(x, ay, 3, 8, skin);
    if (sleeve > 0) c.r(x, ay, 3, sleeve, top);
    if (look.topStyle === 4 && sleeve > 0) c.r(x, ay + 1, 3, 1, top2);
    if (look.topStyle === 7) c.r(x, ay + 6, 3, 1, top2);
    if (look.mitt) c.r(x, ay + 7, 3, 2, handC);
    else c.r(x, ay + 8, 3, 1, skinDark);
  }
  // neck and head
  c.r(14, 13 + dy, 4, 1, skinDark);
  c.r(11, 3 + dy, 10, 10, skin);
  for (const [x, y] of [[11, 3], [20, 3], [11, 12], [20, 12]]) c.p(x, y + dy, null);
  c.m(10, 7 + dy, 1, 2, skin);
  if (!back) {
    faceFront(c, look, dy);
    faceExtras(c, look, dy, false);
  }
  if (back) hairBack(c, look.hairStyle, look.hair, dy);
  else hairFront(c, look.hairStyle, look.hair, dy);
  accessory(c, look, back ? 'up' : 'down', dy);
  if (pose.hold) holdFront(c, look, pose, back);
}

function drawSide(c: Canvas, look: Look, pose: Pose, fx: Fx = {}): void {
  const dy = pose.dy;
  const { skin, top, top2, bottom, shoes } = look;
  const skinDark = shade(skin, 0.8);
  const dress = isDress(look);
  const handC = look.mitt ? (look.mittColor ?? '#d9534f') : look.skin;
  const legTop = 23;
  const swing = fx.skate ? (pose.dy ? 3 : -3) : pose.step === 1 ? 2 : pose.step === 3 ? -2 : 0;
  const legBottom = pose.sit ? 27 : 28;

  const leg = (x: number, tint: number, front: boolean) => {
    const sx = x + (front ? swing : -swing);
    const b = look.bottomStyle;
    if (pose.sit && pose.floor) {
      // folded under: the thigh forward along the floor, the shin tucked back beneath it
      c.r(front ? 13 : 12, 27, 10, 2, shade(dress || b === 2 ? skin : bottom, tint));
      c.r(front ? 13 : 12, 29, 9, 1, shade(dress || b === 2 ? skin : bottom, 0.78 * tint));
      c.r(front ? 22 : 21, 28, 2, 2, shade(look.shoeStyle === 2 ? skin : shoes, tint));
      return;
    }
    if (pose.sit) {
      c.r(front ? 16 : 15, 26, 9, 3, shade(dress || b === 2 ? skin : bottom, tint));
      c.r(front ? 24 : 23, 26, 3, 5, shade(look.shoeStyle === 2 ? skin : shoes, tint));
      if (look.shoeStyle === 2) c.r(front ? 24 : 23, 28, 3, 1, shade(shoes, tint));
      if (look.shoeStyle === 2) c.r(front ? 24 : 23, 30, 3, 1, shade(shoes, 0.7 * tint));
      return;
    }
    const h = legBottom - legTop + 1;
    const naked = dress || (b !== 0 && b !== 3);
    if (naked) c.r(sx, legTop, 3, h, shade(skin, tint));
    const pantsH = dress ? 0 : b === 1 ? 3 : b === 5 ? 2 : b === 2 || b === 4 ? 0 : h;
    if (pantsH > 0 && b === 3) {
      c.r(sx, legTop, 4, h, shade(bottom, tint));
      c.r(sx - 1, legTop + h - 1, 5, 1, shade(bottom, 0.85 * tint));
    } else if (pantsH > 0) c.r(sx, legTop, 3, pantsH, shade(bottom, tint));
    shoe(c, look, sx, sx, legBottom + 1, tint);
    if (fx.skate) c.r(sx - 1, 31, 6, 1, shade('#cfd8e4', tint));
  };
  leg(13, 0.78, false);

  const y0 = 14 + dy;
  // backpack goes behind the body
  if (look.acc === 7) {
    c.r(8, y0 + 1, 5, 8, look.accColor);
    c.r(8, y0 + 8, 5, 1, shade(look.accColor, 0.7));
  }
  // far arm
  const armY = y0 + (pose.sit ? 1 : 0);
  const longSleeve = LONG_SLEEVES.has(look.topStyle);
  const arm = (ax: number, tint: number) => {
    const sleeve = longSleeve ? 7 : BARE_ARMS.has(look.topStyle) ? 0 : 3;
    if (fx.hug && !pose.sit) {
      // the arm folded to the chest
      c.r(15, armY, 3, 4, shade(sleeve > 0 ? top : skin, tint));
      c.r(16, armY + 3, 5, 2, shade(longSleeve ? top : skin, tint));
      c.r(20, armY + 2, 2, 2, shade(handC, tint));
      return;
    }
    if (fx.skate && !pose.sit) {
      // out to the side, forward and back
      const fwd = tint === 1;
      c.r(fwd ? 17 : 6, armY + 1, 8, 2, shade(sleeve >= 3 ? top : skin, tint));
      c.r(fwd ? 25 : 4, armY + 1, 2, 2, shade(handC, tint));
      return;
    }
    c.r(ax, armY, 3, 8, shade(skin, tint));
    if (sleeve > 0) c.r(ax, armY, 3, sleeve, shade(top, tint));
    if (look.topStyle === 7) c.r(ax, armY + 6, 3, 1, shade(look.top2, tint));
    if (look.mitt) c.r(ax, armY + 7, 3, 2, shade(handC, tint));
    else c.r(ax, armY + 8, 3, 1, shade(skinDark, tint));
  };
  if (pose.pray) c.r(14, armY, 3, 4, shade(longSleeve || !BARE_ARMS.has(look.topStyle) ? top : skin, 0.78));
  else if (!pose.hold) arm(14 - swing, 0.78);
  else if (SEATED_HOLDS.has(pose.hold)) stoolSide(c);

  // torso
  c.r(12, y0, 8, 8, top);
  if (dress) {
    c.r(11, y0 + 8, 10, 5, top);
    c.r(11, y0 + 12, 10, 1, shade(top, 0.8));
  } else if (look.bottomStyle === 2) {
    c.r(11, y0 + 8, 10, 3, bottom);
  } else if (look.bottomStyle === 4 && !pose.sit) {
    c.r(12, y0 + 8, 8, 2, bottom);
    c.r(11, y0 + 10, 10, 4, bottom);
    c.r(11, y0 + 13, 10, 1, shade(bottom, 0.75));
    c.r(15, y0 + 10, 1, 3, shade(bottom, 0.85));
  } else if (look.bottomStyle === 4) {
    c.r(11, y0 + 8, 10, 3, bottom);
  } else {
    c.r(12, y0 + 8, 8, 1, shade(bottom, 0.7));
  }
  if (look.topStyle === 4) for (const y of [y0 + 1, y0 + 3, y0 + 5]) c.r(12, y, 8, 1, top2);
  if (look.topStyle === 5) {
    c.r(12, y0, 8, 8, top2);
    c.r(13, y0, 6, 8, top);
  }
  if (look.topStyle === 2) {
    c.r(10, y0 - 2, 5, 4, shade(top, 0.8));
    c.r(15, y0 + 5, 4, 2, shade(top, 0.85));
  }
  topDetail(c, look, 12, 8, y0, 'side');
  if (COATS.has(look.topStyle)) coatSide(c, look, y0, pose.sit);
  leg(16, 1, true);
  if (pose.wash) {
    // the near arm reaches forward to the tap
    c.r(15, armY, 3, 4, longSleeve ? top : skin);
    c.r(16, armY + 4, 7, 3, longSleeve ? top : skin);
    c.r(22, armY + 4 + (pose.dy ? 0 : 1), 3, 3, handC);
  } else if (pose.work !== undefined) {
    // the near arm raised with the hammer, striking
    const up = pose.work ? 2 : 0;
    c.r(15, armY - 3 + up, 3, 5, longSleeve ? top : skin);
    c.r(17, armY - 5 + up, 3, 3, skin);
    c.r(19, armY - 9 + up, 1, 5, '#8a5a2e');
    c.r(18, armY - 10 + up, 4, 2, '#6a6470');
  } else if (pose.pray) {
    // the near arm bent up: both palms together before the chest
    c.r(15, armY, 3, 4, longSleeve ? top : skin);
    c.r(17, armY + 2, 3, 2, longSleeve ? top : skin);
    c.r(20, armY - 1, 2, 4, handC);
    c.p(20, armY - 2, shade(handC, 0.9));
  } else if (pose.eat) {
    // the cone up by the face
    c.r(15, armY, 3, 4, longSleeve ? top : skin);
    c.r(17, armY - 2, 4, 3, longSleeve ? top : skin);
    c.r(21, armY - 3, 2, 2, skin);
    c.r(22, armY - 6, 2, 3, '#e8a23a');
    c.r(21, armY - 9, 4, 3, '#f4b6c8');
  } else if (!pose.hold) arm(15 + swing, 1);

  // neck, head, face
  c.r(14, 13 + dy, 4, 1, skinDark);
  c.r(12, 3 + dy, 10, 10, skin);
  for (const [x, y] of [[12, 3], [21, 3], [12, 12], [21, 12]]) c.p(x, y + dy, null);
  c.p(22, 8 + dy, skin);
  c.p(22, 9 + dy, skin);
  const y = 7 + dy;
  const e = look.eye;
  if (look.face !== -1 && exprSide(c, look, y)) {
    c.p(17, y + 3, shade(look.skin, 0.88));
    faceExtras(c, look, dy, true);
    hairSide(c, look.hairStyle, look.hair, dy);
    accessory(c, look, 'right', dy);
    return;
  }
  if (look.face === -1) {
    c.r(18, y + 1, 2, 1, e);
    c.r(19, y + 4, 2, 1, '#a8505a');
    c.p(17, y + 3, shade(look.skin, 0.88));
    faceExtras(c, look, dy, true);
    hairSide(c, look.hairStyle, look.hair, dy);
    accessory(c, look, 'right', dy);
    if (pose.hold) holdSide(c, look, pose);
    return;
  }
  switch (look.face) {
    case 1:
      c.r(18, y - 1, 2, 3, e);
      c.p(18, y - 1, '#ffffff');
      break;
    case 2:
      c.p(18, y, e);
      c.p(19, y - 1, e);
      c.p(20, y, e);
      break;
    case 3:
      c.r(18, y + 1, 3, 1, e);
      break;
    default:
      c.r(18, y, 2, 2, e);
      c.p(18, y, '#ffffff');
  }
  c.r(19, y + 4, 2, 1, '#a8505a');
  c.p(17, y + 3, shade(skin, 0.88));
  faceExtras(c, look, dy, true);
  hairSide(c, look.hairStyle, look.hair, dy);
  accessory(c, look, 'right', dy);
  if (pose.hold) holdSide(c, look, pose);
}

// ---- instruments in the hands ---------------------------------------------------------------------------------

const WOOD = '#9a6230';
const WOOD_DARK = '#5e3b1c';
const WOOD_LIGHT = '#d8a868';
const STRING = '#e8e0c8';
const IVORY = '#f4f0e6';
const EBONY = '#2a2438';
const ACC_RED = '#c0392b';

/** A sleeve-or-skin arm segment. */
function limb(c: Canvas, look: Look, x: number, y: number, w: number, h: number, sleeve = true): void {
  c.r(x, y, w, h, sleeve && LONG_SLEEVES.has(look.topStyle) ? look.top : look.skin);
}

function stoolFront(c: Canvas): void {
  c.r(9, 27, 14, 2, WOOD);
  c.r(10, 29, 2, 3, WOOD_DARK);
  c.r(20, 29, 2, 3, WOOD_DARK);
}

function stoolSide(c: Canvas): void {
  c.r(12, 27, 11, 2, WOOD);
  c.r(13, 29, 2, 3, WOOD_DARK);
  c.r(20, 29, 2, 3, WOOD_DARK);
}

/** Facing the viewer (or turned away, `back`): the instrument in front of the body and the hands on it. */
function holdFront(c: Canvas, look: Look, pose: Pose, back: boolean): void {
  const y0 = 14 + pose.dy;
  const f = pose.f ?? 0;
  const skin = look.skin;
  const alt = f % 2;
  switch (pose.hold) {
    case 'piano': {
      // at the keys: elbows out, forearms forward, the hands taking turns on the keys
      if (!back) stoolFront(c);
      limb(c, look, 7, y0 + 1, 3, 5);
      limb(c, look, 22, y0 + 1, 3, 5);
      if (back) {
        limb(c, look, 9, y0 + 5, 4, 2);
        limb(c, look, 19, y0 + 5, 4, 2);
        c.r(11, y0 + 4 + alt, 3, 2, skin);
        c.r(18, y0 + 5 - alt, 3, 2, skin);
      } else {
        limb(c, look, 9, y0 + 5, 3, 2);
        limb(c, look, 20, y0 + 5, 3, 2);
        c.r(11, y0 + 6 + alt, 3, 2, skin);
        c.r(18, y0 + 7 - alt, 3, 2, skin);
      }
      if (back) stoolFront(c);
      break;
    }
    case 'guitar': {
      if (back) {
        // only the neck shows past the shoulder, the strumming elbow on the other side
        c.r(4, y0 - 2, 5, 2, WOOD_DARK);
        c.r(3, y0 - 3, 2, 2, WOOD_DARK);
        limb(c, look, 7, y0, 3, 4);
        limb(c, look, 22, y0 + 1, 3, 6);
        c.r(22, y0 + 7 + alt, 3, 2, skin);
        break;
      }
      // the body across the belly, the neck up to the left, the left hand on the frets, the right one strumming
      c.r(14, y0 + 3, 9, 6, WOOD);
      c.r(15, y0 + 2, 7, 8, WOOD);
      c.r(13, y0 + 4, 1, 4, WOOD);
      c.r(16, y0 + 3, 5, 1, WOOD_LIGHT);
      c.r(17, y0 + 5, 2, 2, WOOD_DARK);
      for (let i = 0; i < 9; i++) c.r(13 - i, y0 + 4 - Math.floor(i * 0.6), 2, 1, WOOD_DARK);
      c.r(3, y0 - 2, 2, 2, WOOD_DARK);
      for (let i = 0; i < 6; i++) c.p(12 - i, y0 + 4 - Math.floor(i * 0.6), STRING);
      limb(c, look, 7, y0, 3, 3);
      c.r(5, y0 + 1 + (f === 3 ? 1 : 0), 3, 2, skin);
      limb(c, look, 22, y0 + 1, 3, 4);
      limb(c, look, 19, y0 + 4, 3, 2);
      c.r(17, y0 + 4 + (alt ? 2 : 0), 3, 2, skin);
      break;
    }
    case 'accordion': {
      // a red box on the chest: the keys on one side, the buttons on the other, the bellows opening and closing
      const open = f === 1 || f === 2 ? 2 : 0;
      const x0 = 10 - open / 2;
      if (back) {
        c.r(x0 - 1, y0 + 1, 2, 7, ACC_RED);
        c.r(x0 + 12 + open, y0 + 1, 2, 7, ACC_RED);
        c.r(11, y0 - 1, 1, 4, EBONY);
        c.r(20, y0 - 1, 1, 4, EBONY);
        break;
      }
      c.r(x0, y0 + 1, 4, 8, ACC_RED);
      c.r(x0 + 1, y0 + 2, 2, 6, IVORY);
      for (let y = y0 + 2; y < y0 + 8; y += 2) c.p(x0 + 2, y, EBONY);
      const bw = 5 + open;
      for (let i = 0; i < bw; i++) c.r(x0 + 4 + i, y0 + 1 + (i % 2), 1, 8 - (i % 2) * 2 + 1, i % 2 ? '#3a3a44' : IVORY);
      c.r(x0 + 4 + bw, y0 + 1, 4, 8, ACC_RED);
      for (const [dx, dy] of [[1, 2], [2, 4], [1, 6]]) c.p(x0 + 4 + bw + dx, y0 + dy, IVORY);
      c.r(11, y0 - 1, 1, 3, EBONY);
      c.r(20, y0 - 1, 1, 3, EBONY);
      limb(c, look, x0 - 2, y0 + 1, 2, 5);
      c.r(x0 - 1, y0 + 4 + alt, 2, 2, skin);
      limb(c, look, x0 + 8 + bw, y0 + 1, 2, 5);
      c.r(x0 + 7 + bw, y0 + 5 - alt, 2, 2, skin);
      break;
    }
    case 'violin': {
      // under the chin on the left shoulder, the bow across, going one way and back
      const bow = [0, 2, 4, 2][f];
      if (back) {
        c.r(4, y0 - 1, 6, 2, '#8a3a1a');
        c.r(2, y0 - 2, 2, 1, WOOD_DARK);
        limb(c, look, 22, y0, 3, 4);
        c.r(18 - bow, y0 + 3, 12, 1, WOOD_LIGHT);
        break;
      }
      c.r(17, y0 - 2, 6, 4, '#8a3a1a');
      c.r(18, y0 - 3, 4, 6, '#8a3a1a');
      c.r(19, y0 - 1, 1, 2, EBONY);
      c.r(23, y0 - 2, 5, 2, EBONY);
      c.r(28, y0 - 3, 2, 2, WOOD_DARK);
      limb(c, look, 22, y0, 3, 3);
      c.r(25, y0 - 1, 3, 2, skin);
      limb(c, look, 7, y0 + 1, 3, 4);
      c.r(8 + bow, y0 + 3, 3, 2, skin);
      c.r(5 + bow, y0, 14, 1, WOOD_LIGHT);
      c.r(5 + bow, y0 + 1, 14, 1, '#f0ecd8');
      break;
    }
    case 'bandura': {
      // on the lap, round and wide, the neck up by the left shoulder, both hands plucking
      if (!back) stoolFront(c);
      if (back) {
        c.r(5, y0 - 6, 3, 8, WOOD_LIGHT);
        limb(c, look, 7, y0 + 1, 3, 5);
        limb(c, look, 22, y0 + 1, 3, 5);
        stoolFront(c);
        break;
      }
      c.r(9, y0 + 2, 14, 9, WOOD_LIGHT);
      c.r(10, y0 + 1, 12, 11, WOOD_LIGHT);
      c.r(11, y0 + 11, 10, 1, WOOD);
      c.r(14, y0 + 5, 3, 3, WOOD_DARK);
      for (let x = 11; x < 22; x += 2) c.r(x, y0 + 1, 1, 10, STRING);
      c.r(6, y0 - 6, 4, 9, WOOD_LIGHT);
      c.r(7, y0 - 7, 2, 1, WOOD);
      for (let y = y0 - 5; y < y0 + 2; y += 2) c.p(8, y, STRING);
      limb(c, look, 7, y0 + 2, 3, 4);
      c.r(10, y0 + 4 + alt, 3, 2, skin);
      limb(c, look, 22, y0 + 2, 3, 4);
      c.r(19, y0 + 6 - alt, 3, 2, skin);
      break;
    }
    case 'sopilka': {
      // a wooden pipe from the lips down, fingers lifting in turn
      if (back) {
        limb(c, look, 9, y0, 3, 5);
        limb(c, look, 20, y0, 3, 5);
        break;
      }
      c.r(15, 11 + pose.dy, 2, y0 - 11 - pose.dy + 8, '#c9a050');
      c.r(15, y0 + 8, 2, 1, WOOD);
      for (const y of [y0 + 1, y0 + 3, y0 + 5]) c.p(16, y, WOOD_DARK);
      limb(c, look, 9, y0, 3, 4);
      limb(c, look, 12, y0 + 3, 3, 2);
      c.r(14, y0 + 1 + (alt ? 1 : 0), 4, 2, skin);
      limb(c, look, 20, y0, 3, 4);
      limb(c, look, 17, y0 + 5, 3, 2);
      c.r(14, y0 + 5 - (alt ? 1 : 0), 4, 2, skin);
      break;
    }
  }
}

/** Seen from the side (facing right; mirrored for left). */
function holdSide(c: Canvas, look: Look, pose: Pose): void {
  const y0 = 14 + pose.dy;
  const f = pose.f ?? 0;
  const skin = look.skin;
  const alt = f % 2;
  switch (pose.hold) {
    case 'piano':
      // both forearms forward at the height of the keys
      limb(c, look, 15, y0, 3, 5);
      limb(c, look, 17, y0 + 4, 7, 2);
      c.r(24, y0 + 4 + alt, 3, 2, skin);
      c.r(23, y0 + 5 - alt, 2, 1, shade(skin, 0.85));
      break;
    case 'guitar':
      c.r(16, y0 + 3, 6, 7, WOOD);
      c.r(17, y0 + 2, 4, 9, WOOD);
      c.r(18, y0 + 5, 2, 2, WOOD_DARK);
      for (let i = 0; i < 8; i++) c.r(21 + i, y0 + 3 - Math.floor(i * 0.5), 1, 2, WOOD_DARK);
      c.r(29, y0 - 2, 2, 2, WOOD_DARK);
      limb(c, look, 15, y0, 3, 4);
      c.r(17, y0 + 4 + (alt ? 2 : 0), 3, 2, skin);
      limb(c, look, 18, y0, 4, 2);
      c.r(25, y0 + (f === 3 ? 1 : 0), 3, 2, skin);
      break;
    case 'accordion': {
      const open = f === 1 || f === 2 ? 1 : 0;
      c.r(17, y0 + 1, 3, 8, ACC_RED);
      for (let i = 0; i < 2 + open; i++) c.r(20 + i, y0 + 1, 1, 8, i % 2 ? '#3a3a44' : IVORY);
      c.r(22 + open, y0 + 1, 3, 8, ACC_RED);
      c.r(23 + open, y0 + 2, 1, 6, IVORY);
      limb(c, look, 15, y0, 3, 5);
      c.r(16, y0 + 5 - alt, 2, 2, skin);
      c.r(25 + open, y0 + 3 + alt, 2, 2, skin);
      break;
    }
    case 'violin': {
      const bow = [0, 3, 6, 3][f];
      c.r(17, y0 - 3, 9, 3, '#8a3a1a');
      c.r(26, y0 - 3, 3, 1, EBONY);
      c.r(29, y0 - 4, 1, 2, WOOD_DARK);
      limb(c, look, 18, y0 - 1, 6, 2);
      c.r(26, y0 - 2, 2, 2, skin);
      limb(c, look, 15, y0, 3, 4);
      c.r(16, y0 + 3 - (bow > 3 ? 1 : 0), 3, 2, skin);
      for (let i = 0; i < 9; i++) c.p(14 + i + bow, y0 + 3 - i, WOOD_LIGHT);
      break;
    }
    case 'bandura':
      c.r(16, y0 + 2, 7, 9, WOOD_LIGHT);
      c.r(17, y0 + 1, 5, 11, WOOD_LIGHT);
      for (let y = y0 + 2; y < y0 + 11; y += 2) c.r(17, y, 5, 1, STRING);
      c.r(14, y0 - 6, 3, 9, WOOD_LIGHT);
      limb(c, look, 15, y0, 3, 4);
      c.r(18, y0 + 4 + alt, 3, 2, skin);
      c.r(20, y0 + 7 - alt, 3, 2, skin);
      break;
    case 'sopilka':
      for (let i = 0; i < 9; i++) c.r(20 + Math.floor(i / 2), 11 + pose.dy + i, 2, 1, '#c9a050');
      limb(c, look, 15, y0, 3, 3);
      limb(c, look, 17, y0 + 2, 5, 2);
      c.r(21, y0 + 1 + alt, 3, 2, skin);
      c.r(23, y0 + 4 - alt, 3, 2, skin);
      break;
  }
}

function accessory(c: Canvas, look: Look, dir: Dir, dy: number): void {
  const col = look.accColor;
  const dark = shade(col, 0.7);
  const front = dir === 'down';
  const back = dir === 'up';
  switch (look.acc) {
    case 1: // glasses
      if (front) {
        c.m(12, 6 + dy, 4, 1, col);
        c.m(12, 9 + dy, 4, 1, col);
        c.m(12, 7 + dy, 1, 2, col);
        c.m(15, 7 + dy, 1, 2, col);
        c.r(16, 7 + dy, 1, 1, col);
      } else if (!back) {
        c.r(17, 6 + dy, 5, 1, col);
        c.r(17, 9 + dy, 4, 1, col);
        c.r(17, 7 + dy, 1, 2, col);
        c.r(21, 7 + dy, 1, 2, col);
        c.r(12, 7 + dy, 5, 1, col);
      }
      break;
    case 2: // scarf
      if (front || back) {
        c.r(10, 13 + dy, 12, 2, col);
        if (front) c.m(10, 15 + dy, 2, 4, col);
        c.r(10, 14 + dy, 12, 1, dark);
      } else {
        c.r(11, 13 + dy, 9, 2, col);
        c.r(11, 15 + dy, 2, 5, col);
      }
      break;
    case 3: // sun hat
      c.r(7, 3 + dy, 18, 1, '#e0c070');
      c.r(11, 0 + dy, 10, 3, '#e0c070');
      c.r(11, 2 + dy, 10, 1, col);
      break;
    case 4: // cap
      c.r(10, 1 + dy, 12, 4, col);
      c.r(10, 4 + dy, 12, 1, dark);
      if (front) c.r(10, 4 + dy, 12, 2, dark);
      else if (!back) c.r(19, 4 + dy, 5, 1, dark);
      break;
    case 5: // headphones
      if (front || back) {
        c.r(10, 2 + dy, 12, 1, '#2a2438');
        c.m(9, 6 + dy, 2, 4, col);
        c.m(9, 6 + dy, 2, 1, dark);
      } else {
        c.r(11, 2 + dy, 10, 1, '#2a2438');
        c.r(14, 6 + dy, 4, 4, col);
        c.r(14, 6 + dy, 4, 1, dark);
      }
      break;
    case 6: // bow
      if (front || back) {
        c.r(17, 2 + dy, 5, 3, col);
        c.r(19, 3 + dy, 1, 1, dark);
      } else {
        c.r(12, 1 + dy, 5, 3, col);
      }
      break;
    case 8: // a knitted beanie with a pompom
      if (front || back) {
        c.r(11, 1 + dy, 10, 1, col);
        c.r(10, 2 + dy, 12, 2, col);
        c.r(10, 4 + dy, 12, 2, dark);
        for (const x of [11, 13, 15, 17, 19]) c.p(x, 5 + dy, col);
      } else {
        c.r(12, 1 + dy, 9, 1, col);
        c.r(11, 2 + dy, 11, 2, col);
        c.r(11, 4 + dy, 11, 2, dark);
      }
      c.r(15, dy - 1, 2, 2, '#f4f0e6');
      break;
    case 9: // a flower behind the ear
      {
        const fx = front ? 19 : back ? 12 : 13;
        const fy = 3 + dy;
        for (const [x, y] of [[fx - 1, fy], [fx + 1, fy], [fx, fy - 1], [fx, fy + 1]]) c.p(x, y, col);
        c.p(fx, fy, '#f4d35e');
        if (front) c.p(fx - 1, fy + 1, '#5aa469');
      }
      break;
    case 10: // earrings
      if (front || back) c.m(10, 9 + dy, 1, 2, col);
      else c.r(15, 10 + dy, 1, 2, col);
      break;
    case 11: // dark glasses against the sun
      if (front) {
        c.m(12, 7 + dy, 4, 2, col);
        c.r(16, 7 + dy, 1, 1, col);
      } else if (!back) {
        c.r(17, 7 + dy, 5, 2, col);
        c.r(12, 7 + dy, 5, 1, col);
      }
      break;
    case 12: // an umbrella held over the head
      {
        const sx = front || back ? 0 : 2;
        c.r(9 + sx, 0, 14, 1, col);
        c.r(6 + sx, 1, 20, 2, col);
        for (let x = 6 + sx; x < 26 + sx; x += 2) c.p(x, 3, dark);
        c.r(15 + sx, 0, 2, 1, dark);
        const hx = front || back ? 23 : 17;
        c.r(hx, 3, 1, front || back ? 13 : 12, '#5a3a28');
      }
      break;
    case 13: // a panama
      if (front || back) {
        c.r(11, 0 + dy, 10, 3, col);
        c.r(11, 2 + dy, 10, 1, dark);
        c.r(9, 3 + dy, 14, 1, col);
        c.m(8, 4 + dy, 2, 1, col);
      } else {
        c.r(12, 0 + dy, 9, 3, col);
        c.r(12, 2 + dy, 9, 1, dark);
        c.r(10, 3 + dy, 13, 1, col);
      }
      break;
    case 15: // a helmet (armour worn; not one of the looks to choose)
      {
        const shine = shade(col, 1.35);
        if (front || back) {
          c.r(11, 0 + dy, 10, 1, col);
          c.r(10, 1 + dy, 12, 4, col);
          c.r(10, 5 + dy, 12, 1, dark);
          c.r(12, 1 + dy, 3, 1, shine);
          if (front) c.r(15, 6 + dy, 2, 2, dark);
        } else {
          c.r(12, 0 + dy, 9, 1, col);
          c.r(11, 1 + dy, 11, 4, col);
          c.r(11, 5 + dy, 11, 1, dark);
          c.r(13, 1 + dy, 3, 1, shine);
        }
      }
      break;
    case 14: // a fur hat with ear flaps
      {
        const fur = shade(col, 1.45);
        if (front || back) {
          c.r(10, 0 + dy, 12, 4, col);
          c.r(10, 3 + dy, 12, 1, fur);
          c.m(9, 4 + dy, 2, 5, fur);
        } else {
          c.r(11, 0 + dy, 11, 4, col);
          c.r(11, 3 + dy, 11, 1, fur);
          c.r(13, 4 + dy, 3, 5, fur);
        }
      }
      break;
    case 7: // backpack (side is drawn with the body)
      if (back) {
        c.r(11, 15 + dy, 10, 8, col);
        c.r(11, 21 + dy, 10, 1, dark);
        c.r(14, 17 + dy, 4, 1, dark);
      } else if (front) {
        c.m(11, 14 + dy, 1, 6, dark);
      }
      break;
    default:
      break;
  }
}

function figureGrid(look: Look, dir: Dir, pose: Pose, fx: Fx = {}, frame = 0): Grid {
  const c = new Canvas();
  // screwed-up eyes in the heat
  const drawn = fx.sweat && look.face >= 0 ? { ...look, face: 3 } : look;
  if (dir === 'down') drawFront(c, drawn, pose, false, fx);
  else if (dir === 'up') drawFront(c, drawn, pose, true, fx);
  else {
    drawSide(c, drawn, pose, fx);
    if (dir === 'left') c.flip();
  }
  const g = finish(c.g, true, new Set([look.eye, '#ffffff', '#a8505a', '#dff3ff', shade(look.skin, 0.88), shade(look.skin, FRECKLE_K), '#f4d35e', OPEN_MOUTH, LOVE, shade(look.hair, 0.75)]));
  const side = dir === 'left' || dir === 'right';
  const mx = (x: number) => (dir === 'left' ? 31 - x : x);
  const put = (x: number, y: number, col: string) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) g[y][mx(x)] = col;
  };
  const dy = pose.dy;
  // a puff of breath in the frost, now and then (soft, no outline)
  if (fx.breath && frame % 2 === 0) {
    const pts: [number, number][] = side ? [[23, 10], [24, 10], [24, 9], [25, 9], [25, 10], [26, 9]] : dir === 'down' ? [[19, 12], [20, 12], [20, 11], [21, 11], [22, 11]] : [[22, 4], [23, 4], [23, 3], [24, 3]];
    for (const [x, y] of pts) put(x, y + dy, '#f2f6fbc0');
  }
  // a drop of sweat at the temple
  if (fx.sweat && dir !== 'up') {
    put(side ? 13 : 21, 5 + dy, '#bfe6ff');
    put(side ? 13 : 21, 6 + dy, '#8fcff5');
  }
  // the shiver: a pixel to the side and back
  if (fx.hug && frame % 2 === 1) for (const row of g) row.unshift(row.pop() ?? null);
  return g;
}

// ---- pets ---------------------------------------------------------------------------------------------------

export interface PetLook {
  /** 0 cat, 1 dog, 2 bunny, 3 none. */
  kind: number;
  fur: string;
  /** 0 plain, 1 stripes (cat) or saddle (dog) or spots (bunny), 2 patches, 3 white chest and paws. */
  pattern: number;
}

export const PET_KINDS = 4;
export const PET_NAMES = [t('character.cat'), t('character.dog'), t('character.rabbit'), t('character.noPet')];
export const DEFAULT_PET: PetLook = { kind: 0, fur: '#d98a3a', pattern: 1 };
export const PET_PATTERNS = 4;
export const PET_FURS = ['#d98a3a', '#8a8a96', '#2e2a36', '#e8e0d0', '#b0763a', '#c9a050', '#6a5a4a', '#f2efe6'];

export function petFromSettings(s: Record<string, string>): PetLook {
  return {
    kind: num(s['look.pet'], PET_KINDS, DEFAULT_PET.kind),
    fur: hex(s['look.cat_color'], DEFAULT_PET.fur),
    pattern: num(s['look.cat_pattern'], PET_PATTERNS, DEFAULT_PET.pattern),
  };
}

export type PetPose = 'sit' | 'walk' | 'sleep' | 'eat' | 'play';

/** The animals that come later (pets.rs): their look is their own. */
export const PET_TURTLE = 4;
export const PET_FOX = 5;
export const PET_ROBOT = 6;
export const PET_DRAGON = 7;
const KIND_FUR: Record<number, string> = { 4: '#6f8a3c', 5: '#d9692a', 6: '#9aa6b4', 7: '#3fae7a' };

/** The look of an animal of one's own by its kind (the first day's cat, dog or rabbit keep the chosen fur). */
export function petLookOf(kind: number, chosen: PetLook): PetLook {
  if (kind <= 2) return { ...chosen, kind };
  return { kind, fur: KIND_FUR[kind] ?? chosen.fur, pattern: 0 };
}

const NOSE = '#d9707e';
const WHITE = '#f4f0e6';

/** Four legs that step in turn while walking: back pair at bx, front pair at fx. */
function legs(c: Canvas, fur: string, back: number, front: number, top: number, bottom: number, frame: number, walk: boolean): void {
  const far = shade(fur, 0.78);
  const step = walk ? [0, 1, 0, -1][frame % 4] : 0;
  const lift = (n: number) => (walk && (frame % 4 === n) ? 1 : 0);
  c.r(back + 2 - step, top, 2, bottom - top - lift(1), far);
  c.r(front + 2 + step, top, 2, bottom - top - lift(3), far);
  c.r(back + step, top, 2, bottom - top + 1 - lift(3), fur);
  c.r(front - step, top, 2, bottom - top + 1 - lift(1), fur);
}

function catGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const fur = look.fur;
  const dark = shade(fur, 0.68);
  const belly = look.pattern === 3 ? WHITE : shade(fur, 1.18);
  const eye = '#8ad85a';
  if (pose === 'sleep') {
    const br = frame % 2;
    c.r(8, 21 - br, 16, 8 + br, fur);
    c.r(10, 20 - br, 12, 1, fur);
    c.r(7, 23, 1, 5, fur);
    c.r(10, 27, 12, 2, belly);
    c.r(19, 18, 7, 7, fur);
    c.r(19, 16, 2, 2, fur);
    c.r(24, 16, 2, 2, fur);
    c.r(21, 21, 3, 1, '#2a2035');
    c.p(25, 22, NOSE);
    c.r(6, 26, 12, 2, dark);
    if (look.pattern === 1) for (const x of [11, 14, 17]) c.r(x, 21 - br, 1, 3, dark);
    if (look.pattern === 2) c.r(12, 21, 4, 3, shade(fur, 0.55));
    return c;
  }
  if (pose === 'sit') {
    const wag = frame % 2;
    c.r(10, 17, 9, 11, fur); // body
    c.r(9, 21, 3, 7, fur); // haunch
    c.r(13, 19, 5, 9, belly);
    c.r(16, 21, 2, 7, fur); // front legs
    c.r(18, 21, 2, 7, shade(fur, 0.9));
    c.r(15, 8, 9, 9, fur); // head
    c.p(15, 8, null);
    c.p(23, 8, null);
    c.r(15, 6, 2, 2, fur);
    c.r(22, 6, 2, 2, fur);
    c.p(16, 7, NOSE);
    c.p(22, 7, NOSE);
    c.r(18, 11, 1, 2, eye);
    c.r(21, 11, 1, 2, eye);
    c.p(18, 11, '#2a2035');
    c.p(21, 11, '#2a2035');
    c.p(20, 13, NOSE);
    c.r(16, 14, 7, 2, belly);
    c.r(4, 26, 7, 2, fur); // tail on the floor
    c.r(3, 24 - wag, 2, 3 + wag, fur);
    if (look.pattern === 1) for (const y of [18, 21, 24]) c.r(10, y, 3, 1, dark);
    if (look.pattern === 1) c.r(18, 8, 3, 1, dark);
    if (look.pattern === 2) c.r(15, 8, 4, 3, shade(fur, 0.55));
    return c;
  }
  const bob = frame % 2;
  legs(c, fur, 9, 19, 25, 28, frame, true);
  c.r(8, 18 - bob, 15, 7, fur);
  c.r(9, 17 - bob, 12, 1, fur);
  c.r(10, 23 - bob, 11, 2, belly);
  c.r(19, 11 - bob, 9, 8, fur);
  c.p(19, 11 - bob, null);
  c.r(20, 9 - bob, 2, 2, fur);
  c.r(25, 9 - bob, 2, 2, fur);
  c.p(21, 10 - bob, NOSE);
  c.p(25, 10 - bob, NOSE);
  c.r(24, 13 - bob, 1, 2, eye);
  c.p(24, 13 - bob, '#2a2035');
  c.p(27, 15 - bob, NOSE);
  c.r(22, 16 - bob, 5, 2, belly);
  c.r(5, 17 - bob, 3, 2, fur); // tail up
  c.r(4, 13 - bob, 2, 4, fur);
  c.p(4, 12 - bob, fur);
  if (look.pattern === 1) for (const x of [11, 14, 17]) c.r(x, 18 - bob, 1, 3, dark);
  if (look.pattern === 2) c.r(12, 18 - bob, 5, 3, shade(fur, 0.55));
  return c;
}

function dogGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const fur = look.fur;
  const ear = shade(fur, 0.62);
  const muzzle = look.pattern === 3 ? WHITE : shade(fur, 1.25);
  const back = look.pattern === 1 ? shade(fur, 0.55) : fur;
  const collar = '#d9534f';
  if (pose === 'sleep') {
    const br = frame % 2;
    c.r(6, 22 - br, 18, 7 + br, fur);
    c.r(7, 21 - br, 15, 1, back);
    c.r(8, 27, 14, 2, muzzle);
    c.r(19, 19, 9, 7, fur);
    c.r(25, 22, 5, 4, muzzle);
    c.p(29, 22, '#1e1a24');
    c.r(19, 19, 3, 6, ear);
    c.r(23, 21, 3, 1, '#2a2035');
    c.r(3, 25, 4, 2, fur);
    return c;
  }
  if (pose === 'sit') {
    const wag = frame % 2;
    c.r(9, 16, 10, 12, fur);
    c.r(10, 15, 7, 2, back);
    c.r(14, 18, 4, 10, muzzle);
    c.r(16, 21, 2, 8, fur);
    c.r(18, 21, 2, 8, shade(fur, 0.9));
    c.r(8, 22, 4, 6, fur);
    c.r(14, 6, 10, 9, fur);
    c.r(21, 10, 6, 5, muzzle);
    c.r(26, 10, 1, 2, '#1e1a24');
    c.r(14, 6, 3, 7, ear);
    c.r(20, 8, 1, 2, '#2a2035');
    c.r(22, 13, 3, 1, '#b04a5a');
    c.r(15, 15, 6, 1, collar);
    c.r(5 - wag, 12, 2, 6, fur); // tail up, wagging
    c.r(6, 17, 3, 2, fur);
    return c;
  }
  const bob = frame % 2;
  legs(c, fur, 8, 18, 24, 28, frame, true);
  c.r(7, 17 - bob, 15, 7, fur);
  c.r(8, 16 - bob, 12, 2, back);
  c.r(9, 22 - bob, 11, 2, muzzle);
  c.r(18, 9 - bob, 9, 9, fur);
  c.r(24, 13 - bob, 6, 4, muzzle);
  c.r(29, 13 - bob, 1, 2, '#1e1a24');
  c.r(18, 9 - bob, 3, 7, ear);
  c.r(24, 11 - bob, 1, 2, '#2a2035');
  c.r(19, 17 - bob, 4, 1, collar);
  c.r(4, 10 - bob + (frame % 2), 2, 6, fur);
  c.r(5, 15 - bob, 3, 2, fur);
  return c;
}

function bunnyGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const fur = look.fur;
  const inner = '#e8a0b0';
  const belly = look.pattern === 3 ? WHITE : shade(fur, 1.2);
  const spot = shade(fur, 0.6);
  const hop = pose === 'walk' ? [0, -2, -3, -1][frame % 4] : 0;
  if (pose === 'sleep') {
    c.r(9, 21, 14, 8, fur);
    c.r(10, 20, 11, 1, fur);
    c.r(18, 19, 7, 7, fur);
    c.r(10, 18, 9, 2, fur); // ears lying back
    c.r(11, 18, 7, 1, inner);
    c.r(21, 22, 2, 1, '#2a2035');
    c.p(24, 23, NOSE);
    c.r(7, 22, 3, 3, WHITE);
    c.r(11, 27, 10, 2, belly);
    return c;
  }
  const y = 0 + hop;
  c.r(10, 18 + y, 11, 9, fur); // round body
  c.r(11, 17 + y, 9, 1, fur);
  c.r(11, 27 + y, 9, 1, fur);
  c.r(7, 19 + y, 3, 3, WHITE); // cotton tail
  c.r(17, 12 + y, 8, 8, fur); // head
  c.p(17, 12 + y, null);
  c.r(18, 3 + y, 2, 10, fur); // ears
  c.r(21, 2 + y, 2, 11, fur);
  c.r(21, 4 + y, 1, 7, inner);
  c.r(22, 15 + y, 1, 2, '#2a2035');
  c.p(24, 17 + y, NOSE);
  c.r(13, 22 + y, 7, 4, belly);
  c.r(11, 27 + y + (hop ? 0 : 1), 6, 2, fur); // long back foot
  c.r(19, 25 + y, 2, 3 + (hop ? 0 : 1), fur);
  if (look.pattern === 1) {
    c.r(12, 19 + y, 3, 2, spot);
    c.r(16, 24 + y, 2, 2, spot);
  }
  if (look.pattern === 2) c.r(17, 12 + y, 4, 4, spot);
  return c;
}

// ---- the animals that come later ------------------------------------------------------------------------------

const SPARK = ['#ffd166', '#ff8c42', '#fff3b0'];
const SCREEN = '#5ee6e0';
const LED_ON = '#ff5d5d';
const LED_GO = '#7dff8a';

/** A turtle: the shell a low dome with plates, the head out on its neck, stubby legs; asleep, all of it inside. */
function turtleGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const shell = look.fur;
  const plate = shade(shell, 0.7);
  const rim = '#c9b37a';
  const skin = '#8fae6a';
  const step = pose === 'walk' ? frame % 4 : 0;
  // the shell
  c.r(9, 18, 14, 7, shell);
  c.r(11, 16, 10, 2, shell);
  c.r(8, 24, 16, 2, rim);
  for (const [x, y] of [[11, 19], [16, 18], [20, 20], [13, 22]] as [number, number][]) c.r(x, y, 3, 2, plate);
  if (pose === 'sleep') {
    c.r(22, 23, 2, 2, skin);
    return c;
  }
  // legs (back and front), stepping in turn
  const lift = (n: number) => (pose === 'walk' && step === n ? 1 : 0);
  c.r(10, 26 - lift(0), 3, 2, skin);
  c.r(19, 26 - lift(2), 3, 2, skin);
  c.r(7, 24, 2, 2, skin); // the tail
  // the neck and the head
  const hy = pose === 'eat' ? 24 : pose === 'play' ? 15 - (frame % 2) : 19;
  c.r(23, hy + 1, 3, 3, skin);
  c.r(25, hy - 1, 5, 4, skin);
  c.p(28, hy, '#2a2035');
  if (pose === 'eat' && frame % 2 === 0) c.r(29, hy + 3, 2, 1, '#7cc35a');
  return c;
}

/** A fox: slim, the long bushy tail with a white tip, a white chest, black stockings, tall pointed ears. */
function foxGrid(look: PetLook, pose: PetPose, frame: number, carry = false): Canvas {
  const c = new Canvas();
  const fur = look.fur;
  const white = '#f4ead8';
  const sock = '#2e2430';
  const ear = shade(fur, 0.6);
  if (pose === 'sleep') {
    const br = frame % 2;
    c.r(9, 21 - br, 15, 7 + br, fur);
    c.r(5, 22, 6, 6, fur); // the tail wrapped round
    c.r(5, 26, 3, 2, white);
    c.r(19, 19, 7, 6, fur);
    c.r(19, 17, 2, 2, ear);
    c.r(24, 17, 2, 2, ear);
    c.r(21, 22, 3, 1, '#2a2035');
    c.r(25, 23, 3, 2, white);
    return c;
  }
  const bob = pose === 'walk' || pose === 'play' ? frame % 2 : 0;
  const hop = pose === 'play' ? [0, -2, -3, -1][frame % 4] : 0;
  const y0 = -bob + hop;
  if (pose === 'walk' || pose === 'play') legs(c, sock, 10, 19, 24 + hop, 28 + hop, frame, true);
  else {
    c.r(17, 22, 2, 6, sock);
    c.r(19, 22, 2, 6, shade(sock, 1.3));
    c.r(10, 23, 4, 5, fur);
  }
  c.r(9, 17 + y0, 14, 7, fur); // body
  c.r(14, 21 + y0, 7, 3, white);
  // the tail, long and low, its tip white
  const sw = frame % 2;
  c.r(2, 17 + y0 + sw, 8, 4, fur);
  c.r(1, 18 + y0 + sw, 3, 3, white);
  // the head: a pointed snout and tall ears
  const hy = pose === 'eat' ? 17 : 10;
  c.r(19, hy + y0, 8, 7, fur);
  c.r(26, hy + 3 + y0, 4, 3, fur);
  c.r(25, hy + 5 + y0, 5, 2, white);
  c.p(29, hy + 3 + y0, '#1e1a24');
  c.r(19, hy - 3 + y0, 2, 3, fur);
  c.r(24, hy - 3 + y0, 2, 3, fur);
  c.p(19, hy - 3 + y0, ear);
  c.p(24, hy - 3 + y0, ear);
  c.r(23, hy + 2 + y0, 1, 2, '#2a2035');
  // something small in its teeth: somebody's striped sock
  if (carry) {
    c.r(28, hy + 6 + y0, 3, 4, '#e8e0d0');
    c.r(28, hy + 7 + y0, 3, 1, '#d9534f');
    c.r(29, hy + 9 + y0, 3, 1, '#e8e0d0');
  }
  return c;
}

/** A little robot: a box body on treads, a round head with a screen face, an antenna with a light. */
function robotGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const body = look.fur;
  const dark = shade(body, 0.62);
  const tread = '#3a3a48';
  const roll = pose === 'walk' ? frame % 2 : 0;
  c.r(9, 25, 14, 4, tread);
  for (let x = 10 + roll; x < 22; x += 3) c.p(x, 27, '#6a6a7a');
  c.r(10, 16, 12, 9, body); // body
  c.r(12, 18, 8, 4, dark);
  c.p(13, 19, pose === 'eat' ? '#ffd166' : '#7dd3ff');
  // arms: up when playing, out when charging
  if (pose === 'play') {
    c.r(7, 12 - (frame % 2), 2, 6, dark);
    c.r(23, 12 + (frame % 2), 2, 6, dark);
  } else {
    c.r(8, 18, 2, 5, dark);
    c.r(22, 18, 2, 5, dark);
  }
  // the head and its screen
  c.r(11, 8, 11, 8, body);
  c.r(13, 10, 7, 4, '#1e2430');
  const asleep = pose === 'sleep';
  if (asleep) c.r(14, 12, 5, 1, '#4a5868');
  else {
    c.r(14, 11, 2, 2, SCREEN);
    c.r(18, 11, 2, 2, SCREEN);
    if (pose === 'play') c.r(15, 13, 4, 1, SCREEN);
  }
  // the antenna, its light blinking (slowly asleep, green while charging)
  c.r(16, 4, 1, 4, dark);
  const blink = asleep ? frame % 4 === 0 : frame % 2 === 0;
  c.r(15, 2, 3, 2, pose === 'eat' ? LED_GO : blink ? LED_ON : shade(LED_ON, 0.5));
  if (pose === 'eat' && frame % 2 === 0) {
    // a little bolt beside it: charging
    c.p(25, 12, '#ffd166');
    c.p(26, 13, '#ffd166');
    c.p(25, 14, '#ffd166');
  }
  return c;
}

/** A little dragon: a round body, folded wings, a tail with a spade, small horns; sparks from the nose now and then. */
function dragonGrid(look: PetLook, pose: PetPose, frame: number): Canvas {
  const c = new Canvas();
  const scale = look.fur;
  const belly = '#e8d48a';
  const wing = shade(scale, 0.7);
  const horn = '#f2efe6';
  if (pose === 'sleep') {
    const br = frame % 2;
    c.r(9, 20 - br, 15, 8 + br, scale);
    c.r(11, 26, 11, 2, belly);
    c.r(5, 24, 5, 3, scale); // tail round
    c.r(4, 23, 2, 2, wing);
    c.r(12, 17 - br, 8, 4, wing); // a wing over it like a blanket
    c.r(20, 19, 7, 6, scale);
    c.r(21, 17, 1, 2, horn);
    c.r(24, 17, 1, 2, horn);
    c.r(22, 22, 3, 1, '#2a2035');
    // a slow puff of warm smoke
    if (frame % 2 === 0) c.p(28, 18, '#c8c0b8');
    return c;
  }
  const hop = pose === 'play' ? [0, -3, -4, -1][frame % 4] : 0;
  const bob = pose === 'walk' ? frame % 2 : 0;
  const y0 = hop - bob;
  if (pose === 'walk' || pose === 'play') legs(c, shade(scale, 0.85), 11, 18, 24 + hop, 28 + hop, frame, true);
  else {
    c.r(11, 23, 4, 5, scale);
    c.r(18, 23, 3, 5, scale);
  }
  c.r(9, 15 + y0, 14, 9, scale);
  c.r(12, 19 + y0, 9, 5, belly);
  // the tail with its spade
  c.r(3, 20 + y0, 7, 3, scale);
  c.r(1, 18 + y0, 3, 4, wing);
  // wings: folded, or spread when playing
  if (pose === 'play') {
    c.r(8, 6 + y0 + (frame % 2), 6, 8, wing);
    c.r(10, 4 + y0 + (frame % 2), 3, 2, wing);
  } else c.r(10, 12 + y0, 7, 5, wing);
  // the head with horns
  const hy = pose === 'eat' ? 15 : 8;
  c.r(19, hy + y0, 9, 8, scale);
  c.r(26, hy + 3 + y0, 3, 4, scale);
  c.r(20, hy - 2 + y0, 1, 2, horn);
  c.r(25, hy - 2 + y0, 1, 2, horn);
  c.r(23, hy + 2 + y0, 2, 2, '#ffd166');
  c.p(24, hy + 2 + y0, '#2a2035');
  c.p(28, hy + 4 + y0, '#1e1a24');
  // sparks from the nose: a few warm specks, never fire
  if ((pose === 'play' || pose === 'sit') && frame % 4 === 1) {
    c.p(30, hy + 3 + y0, SPARK[0]);
    c.p(31, hy + 2 + y0, SPARK[1]);
    c.p(30, hy + 1 + y0, SPARK[2]);
  }
  return c;
}

function petGrid(look: PetLook, dir: 'left' | 'right', pose: PetPose, frame: number, carry = false): Grid {
  // the first day's animals eat sitting and play walking (with a hop)
  const old = look.kind <= 2;
  const p: PetPose = old && pose === 'eat' ? 'sit' : old && pose === 'play' ? 'walk' : pose;
  const c =
    look.kind === 1 ? dogGrid(look, p, frame)
    : look.kind === 2 ? bunnyGrid(look, p, frame)
    : look.kind === PET_TURTLE ? turtleGrid(look, p, frame)
    : look.kind === PET_FOX ? foxGrid(look, p, frame, carry)
    : look.kind === PET_ROBOT ? robotGrid(look, p, frame)
    : look.kind === PET_DRAGON ? dragonGrid(look, p, frame)
    : catGrid(look, p, frame);
  if (old && pose === 'play' && frame % 2 === 1) {
    // a little jump
    c.g.push(c.g.shift() ?? []);
    c.g.push(c.g.shift() ?? []);
  }
  if (dir === 'left') c.flip();
  return finish(c.g, true, new Set(['#2a2035', '#8ad85a', '#1e1a24', NOSE, '#b04a5a', SCREEN, LED_ON, LED_GO, '#ffd166', ...SPARK, '#c8c0b8']));
}

// ---- cache --------------------------------------------------------------------------------------------------

const cache = new Map<string, Layer[]>();

export function remember(key: string, make: () => Layer[]): Layer[] {
  let v = cache.get(key);
  if (!v) {
    if (cache.size > 600) cache.clear();
    v = make();
    cache.set(key, v);
  }
  return v;
}

/** Something drawn beside a figure (a wheelchair, a pram, a cane) in the same pixel style: outlined, lit from the
 * upper left, no shadow of its own. `draw` paints on a 32x32 grid; the result is cached under `key`. */
export function propLayers(key: string, draw: (c: { r: Canvas['r']; p: Canvas['p'] }) => void, flip = false): Layer[] {
  return remember(`a|${key}|${flip}`, () => {
    const c = new Canvas();
    draw({ r: c.r.bind(c), p: c.p.bind(c) });
    if (flip) c.flip();
    return layersOf(finish(c.g, false));
  });
}

export function figureLayers(look: Look, dir: Dir, pose: PoseName, frame: number, blink = false, fx: Fx = {}): Layer[] {
  const p = poseOf(pose, frame);
  const f = (fx.hug ? 1 : 0) | (fx.breath ? 2 : 0) | (fx.sweat ? 4 : 0) | (fx.skate ? 8 : 0);
  return remember(`h|${JSON.stringify(look)}|${dir}|${pose}|${p.step}|${p.dy}|${p.f ?? ''}|${p.work ?? ''}|${blink}|${f}|${f ? frame % 2 : 0}`, () => layersOf(figureGrid(blink ? { ...look, face: -1 } : look, dir, p, fx, frame)));
}

export function petLayers(look: PetLook, dir: 'left' | 'right', pose: PetPose, frame: number, carry = false): Layer[] {
  if (look.kind === 3) return [];
  const f = pose === 'walk' || pose === 'play' ? frame % 4 : look.kind >= 6 ? frame % 4 : frame % 2;
  return remember(`p|${look.kind}|${look.fur}${look.pattern}|${dir}|${pose}|${f}|${carry}`, () => layersOf(petGrid(look, dir, pose, f, carry)));
}

/** The screen direction of a push vector (screen space, y down). */
export function dirOf(vx: number, vy: number, previous: Dir): Dir {
  if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return previous;
  if (Math.abs(vy) > Math.abs(vx) * 1.2) return vy > 0 ? 'down' : 'up';
  return vx > 0 ? 'right' : 'left';
}
