// Floor tiles and wall pieces as pixel sprites, one per style, side and variant, generated from the style's
// colours and pattern and cached.

import { proj, TH, TW, ZPX } from './iso';
import { bayer, hexToRgb, ramp, type RGB } from './palette';

export const WALL_UNITS = 210; // hundredths of a tile
export const WALL_PX = Math.round(WALL_UNITS * ZPX);
export const FLOOR_DROP = 4;

function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function canvasOf(w: number, h: number, paint: (img: ImageData) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  paint(img);
  ctx.putImageData(img, 0, 0);
  return c;
}

function put(img: ImageData, x: number, y: number, c: RGB, a = 255): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
  img.data[i + 3] = a;
}

export interface FloorStyle {
  color: string;
  alt?: string;
  pattern?: string;
}

const floorCache = new Map<string, HTMLCanvasElement>();

/**
 * A floor cell: a 32×16 diamond whose top corner is at (16, 0). `cx, cy` is the cell, so patterns continue
 * across cells (planks run on, tiles line up) and boards vary from cell to cell.
 */
export function floorTile(style: FloorStyle, cx: number, cy: number): HTMLCanvasElement {
  // the patterns take the fraction of a coordinate (`% 1`): a cell left of or above the map (the land round it) has
  // negative ones, whose fractions are negative, and its tile — shared by every cell of its kind — came out all joint
  cx = ((cx % 1024) + 1024) % 1024;
  cy = ((cy % 1024) + 1024) % 1024;
  const pattern = style.pattern ?? 'plain';
  const variant = pattern === 'checker' ? ((cx + cy) & 1) : pattern === 'plain' || pattern === 'marble' || pattern === 'carpet' ? Math.floor(hash(cx, cy) * 4) : (cx & 3) * 4 + (cy & 3);
  const key = `${style.color}|${style.alt}|${pattern}|${variant}`;
  let c = floorCache.get(key);
  if (c) return c;
  const a = ramp(style.color);
  const b = ramp(style.alt ?? style.color);
  c = canvasOf(TW, TH, (img) => {
    for (let py = 0; py < TH; py++) {
      for (let px = 0; px < TW; px++) {
        const sx = px - TW / 2 + 0.5;
        const sy = py + 0.5;
        const u = (sx / (TW / 2) + sy / (TH / 2)) / 2;
        const v = (sy / (TH / 2) - sx / (TW / 2)) / 2;
        if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
        const wx = cx + u;
        const wy = cy + v;
        let col: RGB = a[2];
        const d = bayer(px, py);
        switch (pattern) {
          case 'planks': {
            const board = Math.floor(wy * 4);
            const len = 1.5 + hash(board, 7) * 1.5;
            const off = hash(board, 3) * len;
            const end = (wx + off) % len < 0.06;
            const seam = wy * 4 - board < 0.12;
            const tone = hash(board, Math.floor((wx + off) / len)) > 0.5 ? 2 : 3;
            col = seam || end ? a[1] : a[tone];
            if (!seam && Math.sin(wx * 23 + board) > 0.93) col = a[1];
            break;
          }
          case 'tiles': {
            const gu = (wx * 2) % 1;
            const gv = (wy * 2) % 1;
            col = gu < 0.07 || gv < 0.07 ? b[1] : (Math.floor(wx * 2) + Math.floor(wy * 2)) % 2 ? a[2] : a[3];
            break;
          }
          case 'checker':
            col = (Math.floor(wx * 2) + Math.floor(wy * 2)) % 2 ? a[2] : b[2];
            break;
          case 'herringbone': {
            const i = Math.floor(wx * 4);
            const j = Math.floor((wy * 4 + (i % 2) * 0.5) * 1);
            const along = (i + j) % 2 === 0;
            const f = along ? (wx * 4) % 1 : (wy * 4 + (i % 2) * 0.5) % 1;
            col = f < 0.1 ? a[1] : (i + j) % 3 === 0 ? a[3] : a[2];
            break;
          }
          case 'marble': {
            const vein = Math.sin(wx * 7 + Math.sin(wy * 5) * 3 + wy * 2);
            col = vein > 0.92 ? b[1] : vein > 0.8 && d > 0.5 ? b[2] : d > 0.85 ? a[3] : a[2];
            break;
          }
          case 'grass':
          case 'meadow': {
            const blade = hash(Math.floor(wx * 16), Math.floor(wy * 16), 5);
            col = blade > 0.82 ? a[3] : blade < 0.18 ? a[1] : a[2];
            if (pattern === 'meadow' && hash(Math.floor(wx * 8), Math.floor(wy * 8), 9) > 0.93) col = b[3];
            if (pattern === 'meadow' && hash(Math.floor(wx * 8), Math.floor(wy * 8), 11) > 0.96) col = [244, 244, 236];
            break;
          }
          case 'stones': {
            const sx2 = wx * 3 + (Math.floor(wy * 3) % 2) * 0.5;
            const fu = sx2 % 1;
            const fv = (wy * 3) % 1;
            const joint = fu < 0.1 || fv < 0.12;
            col = joint ? b[0] : hash(Math.floor(sx2), Math.floor(wy * 3)) > 0.5 ? a[3] : a[2];
            break;
          }
          case 'gravel':
            col = d > 0.8 ? b[1] : d < 0.25 ? a[3] : hash(px, py, 13) > 0.7 ? b[2] : a[2];
            break;
          case 'soil': {
            // tilled earth: soft clods, a few darker furrows and light pebbles
            const clod = hash(Math.floor(wx * 10), Math.floor(wy * 10), 3);
            col = clod > 0.75 ? a[3] : clod < 0.2 ? a[1] : a[2];
            if ((wx * 2 + wy * 2) % 1 < 0.06) col = b[1];
            if (hash(px, py, 21) > 0.985) col = [196, 186, 168];
            break;
          }
          case 'carpet':
            col = d > 0.7 ? a[3] : d < 0.2 ? a[1] : a[2];
            break;
          case 'water': {
            // still water: soft horizontal ripples with a few glints
            const ripple = Math.sin(wy * 9 + Math.sin(wx * 3) * 1.6);
            col = ripple > 0.86 ? b[3] : ripple < -0.7 ? a[1] : a[2];
            if (hash(Math.floor(wx * 12), Math.floor(wy * 12), 17) > 0.985) col = [244, 250, 255];
            break;
          }
          case 'ice': {
            // a lake frozen over: smooth pale ice, drifts of snow lying on it, long thin cracks and the scratches
            // of skates (every wave repeats over four cells, as the tiles are shared by cells four apart)
            const q = Math.PI / 2;
            const drift = Math.sin(wx * q + Math.sin(wy * q) * 1.3) + Math.sin(wy * q * 2 - wx * q + 0.7) * 0.8;
            col = drift > 1.35 ? b[3] : drift > 1.15 && d > 0.45 ? b[2] : d > 0.9 ? a[3] : a[2];
            const crack = Math.abs(Math.sin(wx * q * 2 + wy * q * 3 + Math.sin(wy * q) * 2));
            if (crack < 0.03 && drift < 1.1) col = a[0];
            else if (crack < 0.065 && drift < 1.1 && d > 0.3) col = a[1];
            const scratch = Math.abs(Math.sin(wx * q * 5 - wy * q * 2 + Math.sin(wx * q) * 3));
            if (scratch < 0.03 && drift < 0.9) col = b[3];
            if (drift < 0.6 && hash(px, py, 23) > 0.992) col = [255, 255, 255];
            break;
          }
          case 'sand':
            col = d > 0.9 ? b[2] : hash(px, py, 19) > 0.94 ? a[1] : a[2];
            break;
          case 'flat':
            // one even colour (the dark round a room)
            break;
          default:
            col = hash(px, py, variant) > 0.93 ? a[3] : a[2];
        }
        put(img, px, py, col);
      }
    }
  });
  if (floorCache.size > 600) floorCache.clear();
  floorCache.set(key, c);
  return c;
}

export interface WallStyle {
  color: string;
  right?: string;
  pattern?: string;
}

const wallCache = new Map<string, HTMLCanvasElement>();

/**
 * One wall piece standing on a cell edge, seen from inside the room. `dir` is the screen slope of its base:
 * 'left' runs down to the left (a wall along y, like the west wall), 'right' down to the right (along x).
 * The canvas is 16 wide and WALL_PX + 8 tall; its base starts at (0, WALL_PX) for 'right' and (0, WALL_PX + 8)
 * for 'left'.
 */
export function wallPiece(style: WallStyle, dir: 'left' | 'right', along: number, height = WALL_PX): HTMLCanvasElement {
  const pattern = style.pattern ?? 'plain';
  const key = `${style.color}|${style.right}|${pattern}|${dir}|${along & 7}|${height}`;
  let c = wallCache.get(key);
  if (c) return c;
  const base = dir === 'right' ? style.color : (style.right ?? style.color);
  const r = ramp(base);
  const lit = dir === 'right' ? 2 : 1;
  c = canvasOf(TW / 2, height + TH / 2, (img) => {
    for (let px = 0; px < TW / 2; px++) {
      const baseY = dir === 'right' ? height + px / 2 : height + TH / 2 - px / 2;
      const t = (along + (px + 0.5) / (TW / 2)) % 8;
      for (let py = 0; py < img.height; py++) {
        const z = baseY - (py + 0.5);
        if (z < 0 || z > height) continue;
        const zz = z / height;
        let tone = lit;
        const d = bayer(px, py);
        switch (pattern) {
          case 'stripes':
            tone = Math.floor(t * 4) % 2 === 0 ? lit : lit + 1;
            break;
          case 'panels':
          case 'wainscot': {
            const low = zz < 0.42;
            if (pattern === 'wainscot' && !low) tone = lit + 1;
            else if (low) tone = (px % 16 === 1 || Math.abs(zz - 0.4) < 0.02 || zz < 0.06) ? lit - 1 : lit;
            else tone = Math.abs(zz - 0.7) < 0.015 ? lit - 1 : lit;
            break;
          }
          case 'brick': {
            const row = Math.floor(z / 4);
            const off = (row % 2) * 4;
            const mortar = Math.floor(z) % 4 === 0 || (px + off) % 8 === 0;
            tone = mortar ? lit - 1 : hash(row, Math.floor((px + off + along * 16) / 8)) > 0.6 ? lit + 1 : lit;
            break;
          }
          case 'glass': {
            // panes in a white frame: posts every 8 px, a transom, a sill; light streaks across the glass
            const post = px % 8 === 0;
            const rail = Math.abs(zz - 0.62) < 0.02 || zz > 0.96 || zz < 0.1;
            if (post || rail) tone = 4;
            else tone = ((px + Math.floor(z)) % 13 < 2) ? lit + 2 : lit + 1;
            break;
          }
          case 'dots':
            tone = (Math.floor(z) % 6 === 2 && (px + Math.floor(z / 6) * 3) % 6 === 2) ? lit + 2 : lit;
            break;
          default:
            tone = lit;
        }
        if (z < 3) tone = lit - 1; // skirting board
        if (z > height - 2) tone = 4;
        put(img, px, py, r[Math.max(0, Math.min(4, tone))]);
      }
    }
  });
  if (wallCache.size > 800) wallCache.clear();
  wallCache.set(key, c);
  return c;
}

/**
 * What the side of a rise of the land is made of: dressed stone under paving, earth under turf, bare rock, sand.
 */
export interface FaceStyle {
  kind: 'masonry' | 'earth' | 'rock' | 'sand';
  /** The colour of the floor on top (the paving's stone, the turf's green, the snow on it in winter). */
  color: string;
}

const faceCache = new Map<string, HTMLCanvasElement>();

/** A colour of a ramp at a fractional level (0 darkest … 4 lightest), dithered between whole tones. */
function level(r: RGB[], v: number, px: number, py: number): RGB {
  const c = Math.max(0, Math.min(4, v));
  const lo = Math.floor(c);
  return r[c - lo > bayer(px, py) ? Math.min(4, lo + 1) : lo];
}

function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const WET: RGB = [38, 74, 96];

/**
 * The side of a raised cell facing the viewer, from its top edge down to the land in front of it: `drop` rows in
 * every column of one half of the cell (`left`: the half under the tile's lower-left edge, else the lower-right
 * one). The picture is 16 wide and drop + 8 tall, drawn at the half's first column and halfway down the tile. Each
 * column starts on the row right under the tile's own last pixel there and ends on the row right over the first
 * pixel of the tile in front (`drop` = how much lower that tile is drawn), so the side meets both without a gap.
 * Courses and seams are counted from the top edge and repeat every 8 columns: the sides of a row of cells run on as
 * one wall. `wet`: water at its foot.
 */
export function slopeFace(style: FaceStyle, left: boolean, drop: number, wet: boolean, variant: number): HTMLCanvasElement {
  const key = `${style.kind}|${style.color}|${left ? 'l' : 'r'}|${drop}|${wet ? 1 : 0}|${variant & 3}`;
  let c = faceCache.get(key);
  if (c) return c;
  const top = ramp(style.color);
  const earth = ramp(style.kind === 'sand' ? '#c4a46c' : '#7a5838');
  const stone = ramp(style.kind === 'masonry' ? style.color : '#7e786e');
  // the light comes from the left: the side under the lower-left edge is lit, the other in shade
  const side = left ? 0 : -0.75;
  c = canvasOf(TW / 2, drop + TH / 2, (img) => {
    for (let i = 0; i < TW / 2; i++) {
      const t = left ? Math.ceil(i / 2) : TH / 2 - Math.ceil(i / 2);
      const gx = left ? i : i + TW / 2;
      // a tuft of turf hangs a little lower here and there
      const tuft = 2 + Math.floor(hash(i, variant, 5) * 2.4);
      for (let k = 0; k < drop; k++) {
        const py = t + k;
        // rows from the foot: it lies in the shadow of the ground in front
        const fb = drop - 1 - k;
        const foot = fb === 0 ? -0.9 : fb === 1 ? -0.5 : fb === 2 && drop > 4 ? -0.2 : 0;
        let col: RGB;
        if (style.kind === 'masonry') {
          // a coping on top (its lit edge, its face, the shadow under it), then courses of blocks, joints staggered
          // (a step of a stair is only a few rows: its lit nosing, its riser, the shadow at its foot)
          let v: number;
          if (k === 0) v = 4;
          else if (drop <= 6) v = 1.5 - k * 0.12;
          else if (k === 1) v = 3.1;
          else if (k === 2) v = 0.6;
          else {
            const kk = k - 3;
            const course = Math.floor(kk / 5);
            const r = kk % 5;
            const off = (course % 2) * 4;
            const joint = r === 4 || (i + off) % 8 === 0;
            v = joint ? 0.7 : 2.1 + (hash(Math.floor((i + off) / 8), course, variant) - 0.5) * 0.8 + (r === 0 ? 0.5 : 0);
          }
          col = level(stone, v + side + foot, gx, py);
        } else if (style.kind === 'rock') {
          // bare rock: a worn lip, then facets and cracks
          let v: number;
          if (k === 0) v = 3.4;
          else if (k === 1) v = 2.6;
          else {
            const facet = hash(Math.floor((i + (Math.floor(k / 4) % 2) * 2) / 4), Math.floor(k / 4), variant);
            v = 1.7 + facet * 0.9 + (hash(i, k, variant + 9) > 0.92 ? -0.9 : 0) + (k % 4 === 0 ? 0.3 : 0);
          }
          col = level(stone, v + side + foot, gx, py);
        } else {
          // turf (or the sand's crust) over the lip, earth in layers under it, stone deep down a high bank
          const lip = style.kind === 'sand' ? 1 : Math.min(tuft, Math.max(1, drop - 2));
          if (k < lip) col = level(top, (k === 0 ? 2.7 : k === lip - 1 ? 1.3 : 1.9) + side, gx, py);
          else if (drop > 14 && k > drop * 0.62 + hash(i, variant, 3) * 3) col = level(stone, 1.9 + (hash(Math.floor(i / 3), Math.floor(k / 3), variant) - 0.5) * 0.8 + side + foot, gx, py);
          else {
            const seam = (k + Math.floor(i / 4) + variant) % 6 === 0;
            const pebble = hash(i, k, variant + 1) > 0.94;
            const v = seam ? 1.1 : pebble ? 3.0 : 2.0 + (k === lip ? -0.6 : 0);
            col = pebble && !seam ? level(stone, v + side, gx, py) : level(earth, v + side + foot, gx, py);
          }
        }
        // water at the foot: the stone goes on under it, wet and dark
        if (wet && fb < 3) col = mix(col, WET, 0.55 - fb * 0.15);
        put(img, i, py, [Math.round(col[0]), Math.round(col[1]), Math.round(col[2])]);
      }
    }
  });
  if (faceCache.size > 1200) faceCache.clear();
  faceCache.set(key, c);
  return c;
}

/** Corner positions of a floor cell's diamond, in art pixels. */
export function cellTop(x: number, y: number): { x: number; y: number } {
  const p = proj(x, y);
  return { x: p.x - TW / 2, y: p.y };
}

/**
 * The two sides towards the viewer of a block `h` pixels high standing on a cell (rock round a cave, the dark round a
 * house): one picture, its corner at the cell's tile raised by `h`, cached by colours and height. A map with tens of
 * thousands of such cells keeps one drawing of each, not thirty-two strokes.
 */
const blockCache = new Map<string, HTMLCanvasElement>();
export function blockSides(left: string | null, right: string | null, h: number): HTMLCanvasElement {
  const key = `${left}|${right}|${h}`;
  let c = blockCache.get(key);
  if (c) return c;
  const l = left ? hexToRgb(left) : null;
  const r = right ? hexToRgb(right) : null;
  c = canvasOf(TW, TH + h + 1, (img) => {
    for (let i = 0; i < TW / 2; i++) {
      if (l) for (let y = TH / 2 + Math.floor(i / 2); y <= TH / 2 + Math.floor(i / 2) + h; y++) put(img, i, y, l);
      if (r) for (let y = TH - Math.floor(i / 2) - 1; y <= TH - Math.floor(i / 2) - 1 + h; y++) put(img, TW / 2 + i, y, r);
    }
  });
  if (blockCache.size > 400) blockCache.clear();
  blockCache.set(key, c);
  return c;
}

/**
 * The dithered shade along the foot of a back wall, from its left end (`dir`: which way the wall's edge runs down),
 * for a wall whose left end stands at `px`, `py` (the dither keeps to the screen's grid, so it is cached by where in
 * the 4×4 pattern it starts).
 */
const footCache = new Map<string, HTMLCanvasElement>();
export function wallFoot(dir: 'left' | 'right', px: number, py: number, rise: number): HTMLCanvasElement {
  const key = `${dir}|${px & 3}|${py & 3}|${rise}`;
  let c = footCache.get(key);
  if (c) return c;
  const steps = TW / 2;
  const top = Math.min(0, rise);
  c = canvasOf(steps, Math.abs(rise) + 4, (img) => {
    for (let i = 0; i < steps; i++) {
      const by = Math.round((rise * i) / steps);
      for (let k = 1; k <= 3; k++) {
        if ((4 - k) / 4 > bayer(px + i, py + by + k)) put(img, i, by + k - top - 1, [14, 10, 30], Math.round(0.28 * 255));
      }
    }
  });
  footCache.set(key, c);
  return c;
}

/**
 * The dark round a light in the hands: a picture `2·rx` by `2·ry`, dark at its rim and clear in the middle, with two
 * dithered steps between (the screen round it is filled with the same dark). Cached by size, so a flicker between a
 * few sizes costs nothing.
 */
const holeCache = new Map<string, HTMLCanvasElement>();
export const DARK_RGB: RGB = [6, 5, 10];
export const DARK_ALPHA = 0.99;
export function darkHole(rx: number, ry: number): HTMLCanvasElement {
  const key = `${rx}|${ry}`;
  let c = holeCache.get(key);
  if (c) return c;
  const a = Math.round(DARK_ALPHA * 255);
  c = canvasOf(2 * rx, 2 * ry, (img) => {
    for (let y = 0; y < 2 * ry; y++) {
      for (let x = 0; x < 2 * rx; x++) {
        const d = Math.hypot((x + 0.5 - rx) / rx, (y + 0.5 - ry) / ry);
        // clear inside, then a ring of light dark, a ring of deeper dark (both dithered), then the dark itself
        const k = d < 0.55 ? 0 : d < 0.72 ? 0.25 : d < 0.88 ? 0.6 : d < 1 ? 0.85 : 1;
        const dith = k === 0 || k === 1 ? k : k > bayer(x, y) ? Math.min(1, k + 0.2) : Math.max(0, k - 0.2);
        if (dith > 0) put(img, x, y, DARK_RGB, Math.round(a * dith));
      }
    }
  });
  if (holeCache.size > 40) holeCache.clear();
  holeCache.set(key, c);
  return c;
}

/** A soft dithered shadow on the floor, sized in tiles. */
const shadowCache = new Map<string, HTMLCanvasElement>();
export function shadowSprite(w: number, d: number, strength: number): HTMLCanvasElement {
  const key = `${w}|${d}|${strength.toFixed(2)}`;
  let c = shadowCache.get(key);
  if (c) return c;
  const pw = Math.ceil((w + d) * (TW / 2)) + 4;
  const ph = Math.ceil((w + d) * (TH / 2)) + 4;
  c = canvasOf(pw, ph, (img) => {
    for (let py = 0; py < ph; py++) {
      for (let px = 0; px < pw; px++) {
        const sx = px - d * (TW / 2) - 2 + 0.5;
        const sy = py - 2 + 0.5;
        const u = (sx / (TW / 2) + sy / (TH / 2)) / 2;
        const v = (sy / (TH / 2) - sx / (TW / 2)) / 2;
        const du = Math.max(0, -u, u - w);
        const dv = Math.max(0, -v, v - d);
        const out = Math.hypot(du, dv);
        const k = Math.max(0, 1 - out / 0.22) * strength;
        if (k > bayer(px, py)) put(img, px, py, [12, 8, 26], 120);
      }
    }
  });
  if (shadowCache.size > 200) shadowCache.clear();
  shadowCache.set(key, c);
  return c;
}

/** A dithered round light, drawn additively. */
const glowCache = new Map<string, HTMLCanvasElement>();
export function glowSprite(color: string, radius: number, squash = 1): HTMLCanvasElement {
  const key = `${color}|${radius}|${squash}`;
  let c = glowCache.get(key);
  if (c) return c;
  const r = ramp(color)[3];
  const w = radius * 2;
  const h = Math.ceil(radius * 2 * squash);
  c = canvasOf(w, h, (img) => {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (px + 0.5 - radius) / radius;
        const dy = (py + 0.5 - h / 2) / (h / 2);
        const dd = Math.hypot(dx, dy);
        if (dd >= 1) continue;
        const k = (1 - dd) * (1 - dd);
        const level = k * 3;
        const step = Math.floor(level + bayer(px, py));
        if (step <= 0) continue;
        put(img, px, py, r, Math.min(255, step * 46));
      }
    }
  });
  if (glowCache.size > 100) glowCache.clear();
  glowCache.set(key, c);
  return c;
}
