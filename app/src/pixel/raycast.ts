// Pixel sprites of furniture by ray casting: for every art pixel a ray goes into the scene along the iso view and
// the nearest surface of the model's parts decides the pixel. Light picks a tone from the part's ramp (dithered on
// curved surfaces), then a selective outline, crease lines and lit top edges are added.

import { proj, TH, ZPX } from './iso';
import { bayer, hexToRgb, ramp, toneAt, type RGB } from './palette';

/** A model part in world space: x, y and sizes in tiles, z and height in hundredths of a tile. */
export interface RPrim {
  gx: number;
  gy: number;
  gw: number;
  gd: number;
  z: number;
  h: number;
  shape?: string;
  color: string;
  /** Material: gloss, pattern names (stripes, checker, dots, grain). */
  finish?: string;
  /** Light of its own (flames, bulbs, screens, sky in a window): drawn bright and unlit by the scene. */
  glow?: string;
  /** See-through (water, glass in cabinets): blended over what lies behind. */
  alpha?: number;
  /** What it is made of, for the texture drawn on every face (wood, fabric, siding, shingle, stone, leaf, metal). */
  material?: string;
  /** Snow lies on its upward faces. */
  snow?: boolean;
}

const SNOW = ramp('#eef4fa');

const MATERIALS: [string, RegExp][] = [
  ['shingle', /^roof/],
  ['siding', /^wall$/],
  ['stone', /^(stone|column|plinth|chimney)/],
  ['fabric', /^(cushion|sheet|blanket|pillow|fabric|curtain|awn_|can_|rug|mat|cover|quilt|canvas)/],
  ['leaf', /^(leaf|leafy|crown|bush|hedge|lav|bloom)/],
  ['metal', /^(metal|knob|tap|handle|tube|bucket|pole_metal)/],
  ['wood', /^(legs|frame|top|door|panel|inset|shelf|trunk|log|deck|plank|cart|counter|wood|post|board|sign|stand|rail|oar|hull|inside|cut|wheel|bench|lid|box|stem_wood|arch|seat|keys_case|case)/],
];

/** The material a model's slot is made of, from its name. */
export function materialOf(slot: string): string | undefined {
  for (const [m, re] of MATERIALS) if (re.test(slot)) return m;
  return undefined;
}

function hash3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Texture of a material at a point of a face: a tone shift of -1, 0 or +1. Continuous across faces and sides. */
function materialShift(material: string | undefined, X: number, Y: number, Z: number, n: [number, number, number], px: number, py: number): number {
  if (!material) return 0;
  const vertical = n[2] < 0.5;
  // along the face: across x for faces looking along y, across y for faces looking along x
  const u = Math.abs(n[0]) > 0.5 ? Y : X;
  switch (material) {
    case 'wood': {
      // long, calm grain lines and a knot now and then
      const grain = Math.sin((vertical ? Z / 5 : (X + Y) * 7) + Math.sin(u * 5 + Z / 14) * 0.9);
      if (hash3(Math.floor(u * 5), Math.floor(Z / 14), 3) > 0.99) return -1;
      return grain > 0.92 ? -1 : 0;
    }
    case 'fabric':
      return (px + py * 2) % 4 === 0 ? -1 : (px * 3 + py) % 7 === 0 ? 1 : 0;
    case 'siding': {
      if (!vertical) return 0;
      const row = Z / 16;
      return row - Math.floor(row) < 0.12 ? -1 : 0;
    }
    case 'shingle': {
      const row = Math.floor(Z / 6);
      if (Z / 6 - row < 0.18) return -1;
      const across = u * 5 + (row % 2) * 0.5;
      return across - Math.floor(across) < 0.1 ? -1 : hash3(Math.floor(across), row, 7) > 0.8 ? 1 : 0;
    }
    case 'stone': {
      if (!vertical) return hash3(Math.floor(X * 6), Math.floor(Y * 6), 1) > 0.85 ? -1 : 0;
      const row = Math.floor(Z / 10);
      if (Z / 10 - row < 0.14) return 1;
      const across = u * 4 + (row % 2) * 0.5;
      return across - Math.floor(across) < 0.08 ? 1 : hash3(Math.floor(across), row, 5) > 0.75 ? -1 : 0;
    }
    case 'leaf': {
      const h = hash3(Math.floor((X + Y) * 14), Math.floor((X - Y) * 14), Math.floor(Z / 5));
      return h > 0.78 ? 1 : h < 0.2 ? -1 : 0;
    }
    case 'metal':
      return (px + py) % 9 === 0 ? 1 : 0;
    default:
      return 0;
  }
}

export interface Raster {
  /** Position of the top-left pixel in art space. */
  x: number;
  y: number;
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
  /** For each pixel: 0 empty, part index + 1, or 255 for the outline. */
  mask: Uint8Array;
}

/** Height units climbed per step of t along the view ray (x and y both grow by 1 per step). */
const K = TH / ZPX;

interface Part {
  prim: number;
  kind: 'box' | 'cyl' | 'ball';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Breaks shapes into parts the ray caster knows: soft boxes are a cross of boxes plus corner cylinders, cones are stacked rings. */
function partsOf(prims: RPrim[]): Part[] {
  const out: Part[] = [];
  prims.forEach((p, i) => {
    const x0 = p.gx;
    const x1 = p.gx + p.gw;
    const y0 = p.gy;
    const y1 = p.gy + p.gd;
    const z0 = p.z;
    const z1 = p.z + p.h;
    if (p.gw <= 0 || p.gd <= 0 || p.h <= 0) return;
    switch (p.shape) {
      case 'cyl':
        out.push({ prim: i, kind: 'cyl', x0, x1, y0, y1, z0, z1 });
        break;
      case 'ball':
        out.push({ prim: i, kind: 'ball', x0, x1, y0, y1, z0, z1 });
        break;
      case 'cone': {
        const n = Math.max(2, Math.min(8, Math.round(p.h / 6)));
        for (let k = 0; k < n; k++) {
          const s = 1 - 0.45 * ((k + 0.5) / n);
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const rx = (p.gw / 2) * s;
          const ry = (p.gd / 2) * s;
          out.push({ prim: i, kind: 'cyl', x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry, z0: z0 + (p.h * k) / n, z1: z0 + (p.h * (k + 1)) / n });
        }
        break;
      }
      case 'gable': {
        // A pitched roof with its ridge along x: slabs narrowing toward the ridge, which read as rows of shingles.
        const n = Math.max(3, Math.min(14, Math.round(p.h / 5)));
        const cy = (y0 + y1) / 2;
        for (let k = 0; k < n; k++) {
          const ry = (p.gd / 2) * (1 - k / n);
          out.push({ prim: i, kind: 'box', x0, x1, y0: cy - ry, y1: cy + ry, z0: z0 + (p.h * k) / n, z1: z0 + (p.h * (k + 1)) / n });
        }
        break;
      }
      case 'gable_y': {
        const n = Math.max(3, Math.min(14, Math.round(p.h / 5)));
        const cx = (x0 + x1) / 2;
        for (let k = 0; k < n; k++) {
          const rx = (p.gw / 2) * (1 - k / n);
          out.push({ prim: i, kind: 'box', x0: cx - rx, x1: cx + rx, y0, y1, z0: z0 + (p.h * k) / n, z1: z0 + (p.h * (k + 1)) / n });
        }
        break;
      }
      case 'round': {
        const r = Math.min(p.gw, p.gd) * 0.22;
        out.push({ prim: i, kind: 'box', x0: x0 + r, x1: x1 - r, y0, y1, z0, z1 });
        out.push({ prim: i, kind: 'box', x0, x1, y0: y0 + r, y1: y1 - r, z0, z1 });
        for (const [cx, cy] of [[x0 + r, y0 + r], [x1 - r, y0 + r], [x0 + r, y1 - r], [x1 - r, y1 - r]]) {
          out.push({ prim: i, kind: 'cyl', x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r, z0, z1 });
        }
        break;
      }
      default:
        out.push({ prim: i, kind: 'box', x0, x1, y0, y1, z0, z1 });
    }
  });
  return out;
}

/** Where the ray leaves a part (the side facing the viewer), and the surface normal there. */
function exitOf(p: Part, X: number, Y: number): { t: number; n: [number, number, number] } | null {
  const tz0 = p.z0 / K;
  const tz1 = p.z1 / K;
  if (p.kind === 'box') {
    const ax = p.x0 - X;
    const bx = p.x1 - X;
    const ay = p.y0 - Y;
    const by = p.y1 - Y;
    const enter = Math.max(ax, ay, tz0);
    const exit = Math.min(bx, by, tz1);
    if (enter >= exit) return null;
    if (exit === tz1) return { t: exit, n: [0, 0, 1] };
    if (exit === by) return { t: exit, n: [0, 1, 0] };
    return { t: exit, n: [1, 0, 0] };
  }
  const cx = (p.x0 + p.x1) / 2;
  const cy = (p.y0 + p.y1) / 2;
  const rx = Math.max(1e-4, (p.x1 - p.x0) / 2);
  const ry = Math.max(1e-4, (p.y1 - p.y0) / 2);
  const dx = X - cx;
  const dy = Y - cy;
  if (p.kind === 'cyl') {
    const a = 1 / (rx * rx) + 1 / (ry * ry);
    const b = 2 * (dx / (rx * rx) + dy / (ry * ry));
    const c = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    const enter = Math.max(t1, tz0);
    const exit = Math.min(t2, tz1);
    if (enter >= exit) return null;
    if (exit === tz1) return { t: exit, n: [0, 0, 1] };
    const nx = (dx + exit) / (rx * rx);
    const ny = (dy + exit) / (ry * ry);
    const l = Math.hypot(nx, ny) || 1;
    return { t: exit, n: [nx / l, ny / l, 0] };
  }
  // ellipsoid: z in hundredths along the ray is K * t
  const cz = (p.z0 + p.z1) / 2;
  const rz = Math.max(1e-4, (p.z1 - p.z0) / 2);
  const a = 1 / (rx * rx) + 1 / (ry * ry) + (K * K) / (rz * rz);
  const b = 2 * (dx / (rx * rx) + dy / (ry * ry) - (K * cz) / (rz * rz));
  const c = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (cz * cz) / (rz * rz) - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  const nx = (dx + t) / (rx * rx);
  const ny = (dy + t) / (ry * ry);
  const nz = ((K * t - cz) / (rz * rz)) * 100;
  const l = Math.hypot(nx, ny, nz) || 1;
  return { t, n: [nx / l, ny / l, nz / l] };
}

/** Light from the upper left: tops brightest, the left (south) face in between, the right (east) face darkest. */
export function brightness([nx, ny, nz]: [number, number, number]): number {
  return Math.max(0, Math.min(1.1, 0.62 + 0.38 * nz + 0.12 * ny - 0.12 * nx));
}

function patternShift(finish: string | undefined, X: number, Y: number, Z: number, n: [number, number, number], px: number, py: number): number {
  switch (finish) {
    case 'stripes':
      return Math.floor((n[2] > 0.5 ? X - Y : X + Y + Z / 26) * 6) % 2 === 0 ? -1 : 0;
    case 'checker':
      return (Math.floor(X * 5) + Math.floor(Y * 5) + Math.floor(Z / 20)) % 2 === 0 ? -1 : 0;
    case 'dots':
      return (px % 4 === 1 && py % 4 === 1) || (px % 4 === 3 && py % 4 === 3) ? 1 : 0;
    case 'grain':
      return Math.sin(Z / 3 + Math.sin(X * 9 + Y * 7) * 2) > 0.75 ? -1 : 0;
    case 'gloss':
      return (px + py) % 11 === 0 || (px + py) % 11 === 1 ? 1 : 0;
    default:
      return 0;
  }
}

function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Square of pixels the parts are sorted into: a pixel's ray only meets the parts whose picture covers its square. */
const BIN = 8;

/** Ray casts parts into an RGBA raster with a mask of which part every pixel shows. `everyPart` tests every part
 * for every pixel (the slow way, for tests to compare with). */
export function rasterize(prims: RPrim[], everyPart = false): Raster {
  const parts = partsOf(prims);
  if (parts.length === 0) return { x: 0, y: 0, w: 0, h: 0, rgba: new Uint8ClampedArray(0), mask: new Uint8Array(0) };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  // each part's picture on screen: a ray through a pixel projects to that very pixel, so a part (a box, or a round
  // thing inside its box) can only be met by rays through the box round its eight corners
  const boxes = new Float64Array(parts.length * 4);
  parts.forEach((p, k) => {
    let a = Infinity;
    let b = -Infinity;
    let c = Infinity;
    let d = -Infinity;
    for (const [x, y, z] of [[p.x0, p.y0, p.z0], [p.x1, p.y0, p.z0], [p.x0, p.y1, p.z0], [p.x1, p.y1, p.z0], [p.x0, p.y0, p.z1], [p.x1, p.y0, p.z1], [p.x0, p.y1, p.z1], [p.x1, p.y1, p.z1]]) {
      const q = proj(x, y, z);
      a = Math.min(a, q.x);
      b = Math.max(b, q.x);
      c = Math.min(c, q.y);
      d = Math.max(d, q.y);
    }
    boxes.set([a, b, c, d], k * 4);
    minX = Math.min(minX, a);
    maxX = Math.max(maxX, b);
    minY = Math.min(minY, c);
    maxY = Math.max(maxY, d);
  });
  const ox = Math.floor(minX) - 1;
  const oy = Math.floor(minY) - 1;
  const w = Math.ceil(maxX) - ox + 2;
  const h = Math.ceil(maxY) - oy + 2;
  const n = w * h;
  // the parts each square of pixels may show, in their own order (later parts win ties, as before)
  const bw = Math.ceil(w / BIN);
  const bh = Math.ceil(h / BIN);
  const bins: Part[][] = Array.from({ length: bw * bh }, () => []);
  parts.forEach((p, k) => {
    // a pixel's centre is at ox + px + 0.5; a pixel of margin either way keeps rounding on the safe side
    const x0 = everyPart ? 0 : Math.max(0, Math.floor((boxes[k * 4] - ox - 1.5) / BIN));
    const x1 = everyPart ? bw - 1 : Math.min(bw - 1, Math.floor((boxes[k * 4 + 1] - ox + 0.5) / BIN));
    const y0 = everyPart ? 0 : Math.max(0, Math.floor((boxes[k * 4 + 2] - oy - 1.5) / BIN));
    const y1 = everyPart ? bh - 1 : Math.min(bh - 1, Math.floor((boxes[k * 4 + 3] - oy + 0.5) / BIN));
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) bins[by * bw + bx].push(p);
  });
  const tone = new Int8Array(n).fill(-1);
  const depth = new Float32Array(n).fill(-Infinity);
  const owner = new Uint8Array(n);
  const top = new Uint8Array(n);
  const rgb = new Float32Array(n * 3);
  const ramps = prims.map((p) => ramp(p.color));
  const glows = prims.map((p) => (p.glow ? ramp(p.glow) : null));

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sx = ox + px + 0.5;
      const sy = oy + py + 0.5;
      const a = sx / 16;
      const b = sy / 8;
      const X = (a + b) / 2;
      const Y = (b - a) / 2;
      let best = -Infinity;
      let bestN: [number, number, number] = [0, 0, 1];
      let bestPrim = -1;
      let glass = -Infinity;
      let glassPrim = -1;
      for (const part of bins[((py / BIN) | 0) * bw + ((px / BIN) | 0)]) {
        const hit = exitOf(part, X, Y);
        if (!hit) continue;
        const pr = prims[part.prim];
        if (pr.alpha !== undefined && pr.alpha < 1) {
          if (hit.t > glass) {
            glass = hit.t;
            glassPrim = part.prim;
          }
          continue;
        }
        // later parts win ties, so details flush with a face (doors, drawers, screens) show on it
        if (hit.t > best + 1e-7 || (Math.abs(hit.t - best) <= 1e-7 && part.prim > bestPrim)) {
          best = hit.t;
          bestN = hit.n;
          bestPrim = part.prim;
        }
      }
      const i = py * w + px;
      let col: RGB | null = null;
      if (bestPrim >= 0) {
        const pr = prims[bestPrim];
        const g = glows[bestPrim];
        let level: number;
        if (g) {
          level = 3 - (bestN[2] > 0.5 ? 0 : 0.6) + (bayer(px, py) > 0.8 ? 1 : 0);
          const ti = toneAt(level, px, py);
          col = g[ti];
          tone[i] = ti;
        } else {
          const curved = pr.shape === 'cyl' || pr.shape === 'ball' || pr.shape === 'cone';
          level = brightness(bestN) * 4 - 1;
          const Z = best * K;
          level += pr.finish ? patternShift(pr.finish, X + best, Y + best, Z, bestN, px, py) : materialShift(pr.material, X + best, Y + best, Z, bestN, px, py);
          const ti = curved ? toneAt(level, px, py) : Math.max(0, Math.min(4, Math.round(level)));
          // snow settles on what faces up (and a little over the edge of curved crowns)
          col = pr.snow && (bestN[2] > 0.5 || (curved && bestN[2] > 0.15 && bayer(px, py) > 0.4)) ? SNOW[Math.min(4, ti + 1)] : ramps[bestPrim][ti];
          tone[i] = ti;
        }
        depth[i] = best;
        owner[i] = bestPrim + 1;
        top[i] = bestN[2] > 0.9 ? 1 : 0;
      }
      if (glassPrim >= 0 && glass > best) {
        const pr = prims[glassPrim];
        const tint = (pr.glow ? ramp(pr.glow) : ramps[glassPrim])[(px + py) % 9 < 2 ? 4 : 3];
        col = col ? mix(col, tint, pr.alpha ?? 0.5) : tint;
        if (bestPrim < 0) {
          owner[i] = glassPrim + 1;
          depth[i] = glass;
          tone[i] = 3;
        }
      }
      if (col) {
        rgb[i * 3] = col[0];
        rgb[i * 3 + 1] = col[1];
        rgb[i * 3 + 2] = col[2];
      }
    }
  }

  // creases between parts and lit top edges
  const shift = new Int8Array(n);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (!owner[i]) continue;
      for (let side = 0; side < 2; side++) {
        const j = side === 0 ? (px + 1 < w ? i + 1 : -1) : py + 1 < h ? i + w : -1;
        if (j < 0 || !owner[j] || owner[j] === owner[i]) continue;
        if (Math.abs(depth[i] - depth[j]) < 0.04) {
          // a detail lying flush on a face gets a thin line around it
          if (owner[i] > owner[j]) shift[i] = -1;
          else shift[j] = -1;
          continue;
        }
        if (depth[i] < depth[j]) shift[i] = -1;
        else shift[j] = -1;
      }
      if (top[i] && !glows[owner[i] - 1] && (py === 0 || !owner[i - w] || (owner[i - w] !== owner[i] && depth[i - w] < depth[i]))) shift[i] = Math.max(shift[i], 1);
    }
  }
  const rgba = new Uint8ClampedArray(n * 4);
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!owner[i]) continue;
    const pr = owner[i] - 1;
    if (shift[i] !== 0 && tone[i] >= 0 && !glows[pr]) {
      const col = ramps[pr][Math.max(0, Math.min(4, tone[i] + shift[i]))];
      rgba[i * 4] = col[0];
      rgba[i * 4 + 1] = col[1];
      rgba[i * 4 + 2] = col[2];
    } else {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
    }
    rgba[i * 4 + 3] = 255;
    mask[i] = owner[i];
  }
  // selective outline: the empty pixels around the silhouette take the deepest tone of the part they touch
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (owner[i]) continue;
      let near = -1;
      let nearDepth = -Infinity;
      for (let side = 0; side < 4; side++) {
        const qx = side === 0 ? px - 1 : side === 1 ? px + 1 : px;
        const qy = side === 2 ? py - 1 : side === 3 ? py + 1 : py;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const j = qy * w + qx;
        if (owner[j] && depth[j] > nearDepth) {
          nearDepth = depth[j];
          near = owner[j] - 1;
        }
      }
      if (near < 0) continue;
      const deep = ramps[near][0];
      rgba[i * 4] = deep[0] * 0.62;
      rgba[i * 4 + 1] = deep[1] * 0.58;
      rgba[i * 4 + 2] = deep[2] * 0.7;
      rgba[i * 4 + 3] = 255;
      mask[i] = 255;
    }
  }
  return { x: ox, y: oy, w, h, rgba, mask };
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  mask: Uint8Array;
}

export function toSprite(r: Raster): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, r.w);
  canvas.height = Math.max(1, r.h);
  if (r.w > 0 && r.h > 0) {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.putImageData(new ImageData(r.rgba as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
  }
  return { canvas, x: r.x, y: r.y, w: r.w, h: r.h, mask: r.mask };
}

export { hexToRgb };
