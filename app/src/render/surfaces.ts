// Procedural floors, walls and item finishes. Everything is derived from a few style parameters.

import { shade } from '../models';
import type { Pt } from '../iso';

/** A stable pseudo-random number in [0, 1) from two integers and a salt. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface SurfaceParams {
  color: string;
  alt?: string;
  pattern?: string;
}

function path(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Draws one floor cell. `p` are the four corners in order: back, right, front, left. */
export function drawFloorCell(ctx: CanvasRenderingContext2D, p: Pt[], cx: number, cy: number, params: SurfaceParams, detail: boolean): void {
  const base = params.color;
  const alt = params.alt ?? shade(base, 0.92);
  const pattern = params.pattern ?? 'plain';
  // A little variation per cell makes a floor look made of parts.
  const jitter = 0.965 + hash2(cx, cy, 1) * 0.07;
  let fill = pattern === 'checker' ? ((cx + cy) % 2 === 0 ? base : alt) : shade(base, jitter);
  if (pattern === 'plain') fill = base;
  path(ctx, p);
  ctx.fillStyle = fill;
  ctx.fill();
  if (!detail) return;
  ctx.save();
  path(ctx, p);
  ctx.clip();
  const dark = 'rgba(0,0,0,0.16)';
  const light = 'rgba(255,255,255,0.07)';
  if (pattern === 'planks') {
    // Planks run along the x edge: lines between back-left and front-right.
    for (let i = 1; i < 4; i++) {
      const a = lerpPt(p[0], p[3], i / 4);
      const b = lerpPt(p[1], p[2], i / 4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      // a staggered butt joint on each plank
      const t = 0.2 + hash2(cx, cy, 10 + i) * 0.6;
      const j0 = lerpPt(a, b, t);
      const j1 = lerpPt(lerpPt(p[0], p[3], (i - 1) / 4), lerpPt(p[1], p[2], (i - 1) / 4), t);
      ctx.beginPath();
      ctx.moveTo(j0.x, j0.y);
      ctx.lineTo(j1.x, j1.y);
      ctx.stroke();
    }
  } else if (pattern === 'tiles') {
    path(ctx, p);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    const m0 = lerpPt(p[0], p[1], 0.5);
    const m1 = lerpPt(p[3], p[2], 0.5);
    const n0 = lerpPt(p[0], p[3], 0.5);
    const n1 = lerpPt(p[1], p[2], 0.5);
    ctx.beginPath();
    ctx.moveTo(m0.x, m0.y);
    ctx.lineTo(m1.x, m1.y);
    ctx.moveTo(n0.x, n0.y);
    ctx.lineTo(n1.x, n1.y);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  } else if (pattern === 'herringbone') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.7;
    const flip = (cx + cy) % 2 === 0;
    for (let i = 1; i < 6; i++) {
      const a = lerpPt(flip ? p[0] : p[1], flip ? p[3] : p[2], i / 6);
      const b = lerpPt(flip ? p[1] : p[0], flip ? p[2] : p[3], i / 6);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  } else if (pattern === 'marble') {
    for (let i = 0; i < 5; i++) {
      const a = lerpPt(p[0], p[2], hash2(cx, cy, 20 + i));
      ctx.fillStyle = hash2(cx, cy, 30 + i) > 0.5 ? light : 'rgba(0,0,0,0.05)';
      ctx.fillRect(a.x - 3, a.y - 1, 6 + hash2(cx, cy, 40 + i) * 6, 1.4);
    }
  } else if (pattern === 'carpet') {
    const mid = lerpPt(p[0], p[2], 0.5);
    ctx.fillStyle = light;
    for (let i = 0; i < 7; i++) {
      const q = lerpPt(lerpPt(p[0], p[1], hash2(cx, cy, 50 + i)), lerpPt(p[3], p[2], hash2(cx, cy, 60 + i)), hash2(cx, cy, 70 + i));
      ctx.fillRect(q.x, q.y, 1.4, 1.4);
    }
    void mid;
  }
  // soft sheen on the top-left of every cell
  const g = ctx.createLinearGradient(p[0].x, p[0].y, p[2].x, p[2].y);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = g;
  path(ctx, p);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws one wall face. `q` are the corners: bottom-a, bottom-b, top-b, top-a (a to b runs along the wall).
 * `u` is the position along the wall in tiles, used to keep patterns continuous from face to face.
 */
export function drawWallFace(ctx: CanvasRenderingContext2D, q: Pt[], u: number, params: SurfaceParams, shadeK: number, detail: boolean, heightPx: number): void {
  const base = shade(params.color, shadeK);
  const g = ctx.createLinearGradient(0, q[3].y, 0, q[0].y);
  g.addColorStop(0, shade(base, 1.1));
  g.addColorStop(1, shade(base, 0.86));
  path(ctx, q);
  ctx.fillStyle = g;
  ctx.fill();
  const pattern = params.pattern ?? 'plain';
  ctx.save();
  path(ctx, q);
  ctx.clip();
  const rail = Math.min(36, heightPx * 0.3);
  const at = (t: number, z: number): Pt => {
    const x = q[0].x + (q[1].x - q[0].x) * t;
    const yb = q[0].y + (q[1].y - q[0].y) * t;
    return { x, y: yb - z };
  };
  if (detail) {
    if (pattern === 'stripes') {
      const n = 4;
      for (let i = 0; i < n; i++) {
        if (((Math.floor(u * n) + i) & 1) === 0) continue;
        const t0 = i / n;
        const t1 = (i + 0.5) / n;
        const a = at(t0, 0);
        const b = at(t1, 0);
        const c = at(t1, heightPx);
        const d = at(t0, heightPx);
        path(ctx, [a, b, c, d]);
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fill();
      }
    } else if (pattern === 'panels' || pattern === 'wainscot') {
      const a = at(0, 0);
      const b = at(1, 0);
      const c = at(1, rail);
      const d = at(0, rail);
      path(ctx, [a, b, c, d]);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fill();
      const r0 = at(0, rail);
      const r1 = at(1, rail);
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y);
      ctx.lineTo(r1.x, r1.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (pattern === 'panels') {
        for (const t of [0.12, 0.62]) {
          const p0 = at(t, rail * 0.2);
          const p1 = at(t + 0.26, rail * 0.2);
          const p2 = at(t + 0.26, rail * 0.8);
          const p3 = at(t, rail * 0.8);
          path(ctx, [p0, p1, p2, p3]);
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    } else if (pattern === 'brick') {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 0.7;
      const rows = Math.max(3, Math.floor(heightPx / 9));
      for (let r = 1; r < rows; r++) {
        const z = (heightPx * r) / rows;
        const a = at(0, z);
        const b = at(1, z);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const off = (r + Math.floor(u * 2)) % 2 === 0 ? 0 : 0.25;
        for (let t = off; t < 1; t += 0.5) {
          const c0 = at(t, z);
          const c1 = at(t, z - heightPx / rows);
          ctx.beginPath();
          ctx.moveTo(c0.x, c0.y);
          ctx.lineTo(c1.x, c1.y);
          ctx.stroke();
        }
      }
    } else if (pattern === 'dots') {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 6; i++) {
        for (let j = 1; j < 5; j++) {
          const pt = at((i + (j % 2) * 0.5 + 0.25) / 6, (heightPx * j) / 5);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // baseboard and a lighter top edge
  const bb0 = at(0, 0);
  const bb1 = at(1, 0);
  const bb2 = at(1, 6);
  const bb3 = at(0, 6);
  path(ctx, [bb0, bb1, bb2, bb3]);
  ctx.fillStyle = shade(base, 0.55);
  ctx.fill();
  const t0 = at(0, heightPx);
  const t1 = at(1, heightPx);
  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Adds a material (gloss, pattern) on top of an already filled face polygon. */
export function drawFinish(ctx: CanvasRenderingContext2D, pts: [number, number][], kind: string, pattern: string | undefined, color: string, seed: number): void {
  if (kind === 'matte') return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (kind === 'gloss') {
    const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
    g.addColorStop(0, 'rgba(255,255,255,0.38)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  } else if (kind === 'pattern') {
    const dark = shade(color, 0.72);
    const light = shade(color, 1.22);
    ctx.lineWidth = 1;
    if (pattern === 'stripes') {
      ctx.strokeStyle = dark;
      for (let x = minX - (maxY - minY); x < maxX; x += 4.5) {
        ctx.beginPath();
        ctx.moveTo(x, maxY);
        ctx.lineTo(x + (maxY - minY), minY);
        ctx.stroke();
      }
    } else if (pattern === 'checker') {
      const s = 4;
      for (let y = Math.floor(minY / s) * s; y < maxY; y += s) {
        for (let x = Math.floor(minX / s) * s; x < maxX; x += s) {
          if (((x / s + y / s) & 1) === 0) continue;
          ctx.fillStyle = dark;
          ctx.fillRect(x, y, s, s);
        }
      }
    } else if (pattern === 'dots') {
      ctx.fillStyle = light;
      for (let y = Math.floor(minY / 5) * 5; y < maxY; y += 5) {
        for (let x = Math.floor(minX / 5) * 5 + ((y / 5) & 1) * 2.5; x < maxX; x += 5) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 'grain') {
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.5;
      for (let y = minY; y < maxY; y += 2.6) {
        ctx.beginPath();
        ctx.moveTo(minX, y + hash2(seed, Math.floor(y), 3) * 1.5);
        ctx.lineTo(maxX, y + hash2(seed, Math.floor(y), 4) * 1.5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
