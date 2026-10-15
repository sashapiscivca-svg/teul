// Turns data-driven item models (boxes with colour slots) into drawable isometric faces.

import { rotRect, type View } from './geometry';
import { project, Z_PER_CENTI } from './iso';
import type { ItemDef, PlacementView } from './types';

export type Box = [number, number, number, number, number, number];

/** A gradient in the same coordinates as the face points. `r` makes it radial (from 0 to r around x0,y0). */
export interface Grad {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r?: number;
  stops: [number, string][];
}

export interface Face {
  points: [number, number][];
  /** The flat colour of the face; with `grad` it is the colour the gradient is built around. */
  fill: string;
  kind: 'top' | 'left' | 'right';
  /** The colour slot this face belongs to and its material, so the renderer can add gloss or a pattern. */
  slot?: string;
  finish?: string;
  grad?: Grad;
  /** Highlight lines along lit edges. */
  edges?: [number, number][][];
}

export interface WorldBox {
  /** Position and size in tiles. */
  gx: number;
  gy: number;
  gw: number;
  gd: number;
  /** Base and height in hundredths of a tile. */
  z: number;
  h: number;
  slot: string;
  shape?: string;
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Rotates a box inside its footprint (W x D hundredths, before rotation) by `rot` quarter turns. */
export function rotateBox([x, y, z, w, d, h]: Box, W: number, D: number, rot: number): Box {
  switch (rot & 3) {
    case 0:
      return [x, y, z, w, d, h];
    case 1:
      return [D - (y + d), x, z, d, w, h];
    case 2:
      return [W - (x + w), D - (y + d), z, w, d, h];
    default:
      return [y, W - (x + w), z, d, w, h];
  }
}

export function footprintCells(def: ItemDef, rot: number): [number, number][] {
  const odd = (rot & 1) === 1;
  const w = odd ? def.footprint.d : def.footprint.w;
  const d = odd ? def.footprint.w : def.footprint.d;
  const out: [number, number][] = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) out.push([x, y]);
  return out;
}

/** Height of the tallest part of a model, in hundredths of a tile. */
export function topHeight(def: ItemDef): number {
  return def.model.reduce((top, p) => Math.max(top, p.box[2] + p.box[5]), 0);
}

const overhangs = new WeakMap<ItemDef, number>();

/** How far a model reaches past its footprint on any side (a crown over the cells round its trunk), in tiles. */
export function overhang(def: ItemDef): number {
  const known = overhangs.get(def);
  if (known !== undefined) return known;
  const W = def.footprint.w * 100;
  const D = def.footprint.d * 100;
  const out = def.model.reduce((m, p) => Math.max(m, -p.box[0], -p.box[1], p.box[0] + p.box[3] - W, p.box[1] + p.box[4] - D), 0);
  const n = Math.ceil(out / 100);
  overhangs.set(def, n);
  return n;
}

function num(props: Record<string, string> | undefined, key: string): number {
  const v = Number(props?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function worldBoxes(def: ItemDef, p: PlacementView, hostTop: number): WorldBox[] {
  const W = def.footprint.w * 100;
  const D = def.footprint.d * 100;
  const mirror = p.props?.mirror === '1';
  const nx = num(p.props, 'nudge_x') / 100;
  const ny = num(p.props, 'nudge_y') / 100;
  return def.model.map((prim) => {
    let [ox, oy, oz, ow, od, oh] = prim.box;
    if (def.layer === 'wall' && p.wall) {
      if (mirror) ox = W - (ox + ow);
      let box: WorldBox;
      switch (p.wall) {
        case 'north':
          box = { gx: p.x + ox / 100, gy: p.y + oy / 100, gw: ow / 100, gd: od / 100, z: oz, h: oh, slot: prim.slot, shape: prim.shape };
          break;
        case 'west':
          box = { gx: p.x + oy / 100, gy: p.y + ox / 100, gw: od / 100, gd: ow / 100, z: oz, h: oh, slot: prim.slot, shape: prim.shape };
          break;
        case 'south':
          box = { gx: p.x + ox / 100, gy: p.y + 1 - (oy + od) / 100, gw: ow / 100, gd: od / 100, z: oz, h: oh, slot: prim.slot, shape: prim.shape };
          break;
        default:
          box = { gx: p.x + 1 - (oy + od) / 100, gy: p.y + ox / 100, gw: od / 100, gd: ow / 100, z: oz, h: oh, slot: prim.slot, shape: prim.shape };
      }
      box.gx += nx;
      box.gy += ny;
      return box;
    }
    if (mirror) ox = W - (ox + ow);
    const [rx, ry, rz, rw, rd, rh] = rotateBox([ox, oy, oz, ow, od, oh], W, D, p.rot);
    const lift = def.layer === 'surface' ? hostTop : 0;
    return { gx: p.x + rx / 100 + nx, gy: p.y + ry / 100 + ny, gw: rw / 100, gd: rd / 100, z: rz + lift, h: rh, slot: prim.slot, shape: prim.shape };
  });
}

/** The same box seen from a rotated view. */
export function rotateWorldBox(b: WorldBox, view: View): WorldBox {
  if (view === 0) return b;
  const r = rotRect(view, b.gx, b.gy, b.gw, b.gd);
  return { ...b, gx: r.x, gy: r.y, gw: r.w, gd: r.d };
}

type P2 = [number, number];

function pt(x: number, y: number, z: number): P2 {
  const p = project(x, y, z);
  return [p.x, p.y];
}

const EDGE = 'rgba(255,255,255,0.26)';

/** A box lit from the upper left: lighter tops toward the back, sides darkening toward the floor, bright top edges. */
export function boxFaces(b: WorldBox, color: string, finish?: string, soft = false): Face[] {
  const x0 = b.gx;
  const x1 = b.gx + b.gw;
  const y0 = b.gy;
  const y1 = b.gy + b.gd;
  const z0 = b.z * Z_PER_CENTI;
  const z1 = (b.z + b.h) * Z_PER_CENTI;
  const right: P2[] = [pt(x1, y0, z0), pt(x1, y1, z0), pt(x1, y1, z1), pt(x1, y0, z1)];
  const left: P2[] = [pt(x0, y1, z0), pt(x1, y1, z0), pt(x1, y1, z1), pt(x0, y1, z1)];
  const top: P2[] = [pt(x0, y0, z1), pt(x1, y0, z1), pt(x1, y1, z1), pt(x0, y1, z1)];
  const tall = z1 - z0;
  const sideGrad = (pts: P2[], k: number): Grad | undefined => {
    if (tall < 2) return undefined;
    const yTop = Math.min(...pts.map((p) => p[1]));
    const yBot = Math.max(...pts.map((p) => p[1]));
    return { x0: 0, y0: yTop, x1: 0, y1: yBot, stops: [[0, shade(color, k * 1.06)], [0.72, shade(color, k)], [1, shade(color, k * 0.84)]] };
  };
  const topGrad: Grad = soft
    ? { x0: (top[0][0] + top[2][0]) / 2, y0: (top[0][1] + top[2][1]) / 2 - 1, x1: 0, y1: 0, r: Math.max(4, Math.hypot(top[1][0] - top[3][0], top[1][1] - top[3][1]) * 0.55), stops: [[0, shade(color, 1.14)], [0.75, shade(color, 1)], [1, shade(color, 0.9)]] }
    : { x0: top[0][0], y0: top[0][1], x1: top[2][0], y1: top[2][1], stops: [[0, shade(color, 1.1)], [1, shade(color, 0.96)]] };
  return [
    { kind: 'right', fill: shade(color, 0.66), slot: b.slot, finish, points: right, grad: sideGrad(right, 0.66) },
    { kind: 'left', fill: shade(color, 0.82), slot: b.slot, finish, points: left, grad: sideGrad(left, 0.84) },
    { kind: 'top', fill: color, slot: b.slot, finish, points: top, grad: topGrad, edges: [[top[3], top[2], top[1]]] },
  ];
}

function ellipse(cx: number, cy: number, rx: number, ry: number, z: number, from: number, to: number, steps: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push(pt(cx + rx * Math.cos(a), cy + ry * Math.sin(a), z));
  }
  return out;
}

/** An upright cylinder (or a cone narrowing to `k` of its radius at the top) inscribed in the box. */
function roundFaces(b: WorldBox, color: string, finish: string | undefined, k: number): Face[] {
  const cx = b.gx + b.gw / 2;
  const cy = b.gy + b.gd / 2;
  const rx = b.gw / 2;
  const ry = b.gd / 2;
  const z0 = b.z * Z_PER_CENTI;
  const z1 = (b.z + b.h) * Z_PER_CENTI;
  // the half facing the viewer (+x, +y) is the visible side
  const phi = Math.atan2(1 / Math.max(ry, 1e-3), 1 / Math.max(rx, 1e-3));
  const from = phi - Math.PI / 2;
  const to = phi + Math.PI / 2;
  const bottom = ellipse(cx, cy, rx, ry, z0, from, to, 16);
  const topArc = ellipse(cx, cy, rx * k, ry * k, z1, from, to, 16);
  const side: P2[] = [...bottom, ...topArc.reverse()];
  const xs = side.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ring = ellipse(cx, cy, rx * k, ry * k, z1, 0, Math.PI * 2, 24);
  const ys = ring.map((p) => p[1]);
  const faces: Face[] = [];
  if (z1 - z0 > 0.5) {
    faces.push({
      kind: 'left',
      fill: shade(color, 0.8),
      slot: b.slot,
      finish,
      points: side,
      grad: { x0: minX, y0: 0, x1: maxX, y1: 0, stops: [[0, shade(color, 0.78)], [0.3, shade(color, 0.95)], [0.62, shade(color, 0.8)], [1, shade(color, 0.56)]] },
    });
  }
  faces.push({
    kind: 'top',
    fill: color,
    slot: b.slot,
    finish,
    points: ring,
    grad: { x0: 0, y0: Math.min(...ys), x1: 0, y1: Math.max(...ys), stops: [[0, shade(color, 1.1)], [1, shade(color, 0.95)]] },
    edges: [ellipse(cx, cy, rx * k, ry * k, z1, from + 0.25, to - 0.25, 12)],
  });
  return faces;
}

/** An ellipsoid inscribed in the box, shaded like a soft ball lit from the upper left. */
function ballFaces(b: WorldBox, color: string, finish?: string): Face[] {
  const cx = b.gx + b.gw / 2;
  const cy = b.gy + b.gd / 2;
  const rx = b.gw / 2;
  const ry = b.gd / 2;
  const zc = (b.z + b.h / 2) * Z_PER_CENTI;
  const rz = (b.h / 2) * Z_PER_CENTI;
  const pts: P2[] = [];
  for (let i = 0; i < 18; i++) {
    const th = (i / 18) * Math.PI * 2;
    for (let j = -4; j <= 4; j++) {
      const ph = (j / 4) * (Math.PI / 2);
      pts.push(pt(cx + rx * Math.cos(th) * Math.cos(ph), cy + ry * Math.sin(th) * Math.cos(ph), zc + rz * Math.sin(ph)));
    }
  }
  const hull = convexHull(pts);
  const xs = hull.map((p) => p[0]);
  const ys = hull.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  return [
    {
      kind: 'top',
      fill: color,
      slot: b.slot,
      finish,
      points: hull,
      grad: { x0: minX + w * 0.36, y0: minY + h * 0.3, x1: 0, y1: 0, r: Math.max(w, h) * 0.85, stops: [[0, shade(color, 1.28)], [0.35, shade(color, 1.02)], [0.8, shade(color, 0.74)], [1, shade(color, 0.6)]] },
    },
  ];
}

export function convexHull(points: P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

export function shapeFaces(b: WorldBox, color: string, finish?: string): Face[] {
  switch (b.shape) {
    case 'cyl':
      return roundFaces(b, color, finish, 1);
    case 'cone':
      return roundFaces(b, color, finish, 0.55);
    case 'ball':
      return ballFaces(b, color, finish);
    case 'round':
      return boxFaces(b, color, finish, true);
    default:
      return boxFaces(b, color, finish);
  }
}

/** Boxes of one item in painting order: a box is drawn before any box in front of, beside or above it. */
export function paintOrder(boxes: WorldBox[]): WorldBox[] {
  const n = boxes.length;
  const before = (a: WorldBox, b: WorldBox) => a.gx + a.gw <= b.gx + 1e-6 || a.gy + a.gd <= b.gy + 1e-6 || a.z + a.h <= b.z + 1e-6;
  const indeg = new Array<number>(n).fill(0);
  const edges: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (before(boxes[i], boxes[j]) && !before(boxes[j], boxes[i])) {
        edges[i].push(j);
        indeg[j]++;
      }
    }
  const out: WorldBox[] = [];
  const done = new Array<boolean>(n).fill(false);
  for (let round = 0; round < n; round++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) { pick = i; break; }
    if (pick < 0) pick = done.indexOf(false); // a cycle (overlapping boxes): keep the authored order
    done[pick] = true;
    out.push(boxes[pick]);
    for (const j of edges[pick]) indeg[j]--;
  }
  return out;
}

export function modelFaces(def: ItemDef | undefined, p: PlacementView, hostTop: number, view: View = 0): Face[] {
  if (!def) return [];
  const faces: Face[] = [];
  const boxes = paintOrder(worldBoxes(def, p, hostTop).map((b) => rotateWorldBox(b, view)));
  for (const box of boxes) {
    const color = p.colors[box.slot] ?? def.slots[box.slot]?.default ?? '#888888';
    faces.push(...shapeFaces(box, color, p.props?.[`finish.${box.slot}`]));
  }
  return faces;
}

/** Fills a face with its gradient, material and highlights. `tint` replaces the colours (for invalid ghosts). */
export function paintFace(ctx: CanvasRenderingContext2D, f: Face, opts: { tint?: string; finish?: (f: Face) => void; lineScale?: number } = {}): void {
  ctx.beginPath();
  f.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  if (opts.tint) {
    ctx.fillStyle = shade(opts.tint, f.kind === 'top' ? 1 : f.kind === 'left' ? 0.82 : 0.66);
  } else if (f.grad) {
    const g = f.grad;
    const grad = g.r !== undefined ? ctx.createRadialGradient(g.x0, g.y0, 0, g.x0, g.y0, g.r) : ctx.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
    for (const [at, c] of g.stops) grad.addColorStop(at, c);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = f.fill;
  }
  if (f.slot === 'water' && !opts.tint) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fill();
  }
  if (!opts.tint && f.finish && opts.finish) opts.finish(f);
  const ls = opts.lineScale ?? 1;
  ctx.strokeStyle = 'rgba(20,14,30,0.22)';
  ctx.lineWidth = 0.55 * ls;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (f.edges && !opts.tint) {
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 0.7 * ls;
    ctx.lineCap = 'round';
    for (const line of f.edges) {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }
}
