// The nuclear plant far beyond the fields, on the horizon of every outdoor map: nothing at first, then a fence
// and a crane, more cranes, two cooling towers rising ring by ring, the reactor's block and its dome, and at the
// end white steam over the towers. Hazy with the distance; the cranes' red lights blink at night.

import type { Daylight } from '../daylight';
import { hexToRgb, rgbToHex, type RGB } from './palette';

export interface PlantOnHorizon {
  /** The step of the story (core npp.rs): 6 the site, 8 cranes, 9 towers, 10 the dome, 11 running. */
  stage: number;
  /** How far the building has got, in thousandths. */
  built: number;
}

const SITE = 6;
const DOME = 10;
const RUNNING = 11;

function mixc(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** How tall (0..1) a part is when it is built from `from` to `to` (thousandths of the whole building). */
function grown(built: number, from: number, to: number): number {
  return Math.max(0, Math.min(1, (built - from) / (to - from)));
}

/**
 * Draws the plant standing on the horizon line `base` (art pixels), `across` of the way across (its first tower).
 * `t` is seconds (for the blinking lights and the drifting steam); a still picture passes 0.
 */
export function drawPlant(ctx: CanvasRenderingContext2D, w: number, base: number, plant: PlantOnHorizon, dl: Daylight, t = 0, across = 0.2): void {
  if (plant.stage < SITE) return;
  const sky = hexToRgb(dl.sky);
  // concrete and steel, far off: mostly the colour of the air between
  const haze = (c: RGB, k = 0.35) => rgbToHex(mixc(mixc(c, [30, 32, 52], dl.dark * 0.6), sky, k));
  const x0 = Math.round(w * across);
  const b = plant.built;
  // the fence along the site
  ctx.fillStyle = haze([120, 120, 118], 0.6);
  ctx.fillRect(x0 - 10, base - 1, 70, 1);
  for (let x = x0 - 10; x < x0 + 60; x += 3) ctx.fillRect(x, base - 2, 1, 1);
  // the reactor's block, and on it the dome
  const block = grown(b, 0, 450);
  if (block > 0) {
    const bh = Math.max(1, Math.round(10 * block));
    ctx.fillStyle = haze([120, 116, 112]);
    ctx.fillRect(x0 + 24, base - bh, 16, bh);
    if (plant.stage >= DOME) {
      ctx.fillStyle = haze([170, 168, 164]);
      for (let i = 0; i < 6; i++) {
        const half = Math.round(Math.sqrt(36 - i * i) * 1.2);
        ctx.fillRect(x0 + 32 - half, base - bh - i, half * 2, 1);
      }
    }
  }
  // two cooling towers: a waisted ring rising, the second one later
  const tower = (cx: number, h: number) => {
    if (h <= 0) return;
    const full = 26;
    const top = Math.round(full * h);
    ctx.fillStyle = haze([140, 136, 130]);
    for (let y = 0; y < top; y++) {
      // a hyperboloid: wide at the foot, narrowest at two thirds, flaring a little at the top
      const k = y / full;
      const half = Math.round(9 - 7 * Math.sin(Math.min(1, k / 0.75) * Math.PI * 0.5) + (k > 0.75 ? (k - 0.75) * 12 : 0));
      ctx.fillRect(cx - half, base - 1 - y, half * 2, 1);
    }
    // scaffolding ring at the top while it grows
    if (h < 1) {
      ctx.fillStyle = haze([150, 120, 80], 0.5);
      ctx.fillRect(cx - 6, base - 1 - top, 12, 1);
    }
  };
  tower(x0, grown(b, 60, 700));
  tower(x0 + 54, grown(b, 380, 920));
  // the cranes: one at the start, more while it is built, gone when it runs
  if (plant.stage < RUNNING) {
    const cranes = [x0 + 12, x0 - 6, x0 + 44, x0 + 66].slice(0, b < 60 ? 1 : b < 200 ? 2 : b < 850 ? 4 : 2);
    for (let i = 0; i < cranes.length; i++) {
      const cx = cranes[i];
      const ch = 30 + (i % 2) * 6;
      ctx.fillStyle = haze([214, 160, 40], 0.25);
      ctx.fillRect(cx, base - ch, 2, ch);
      // the jib, the counter-jib and a hook line
      const dir = i % 2 === 0 ? 1 : -1;
      for (let k = -5; k <= 14; k++) ctx.fillRect(cx + k * dir, base - ch, 1, 2);
      ctx.fillRect(cx + 11 * dir, base - ch + 1, 1, 6);
      if (dl.dark > 0.4 && Math.floor(t * 1.2 + i * 0.7) % 2 === 0) {
        ctx.fillStyle = '#ff4a3a';
        ctx.fillRect(cx, base - ch - 1, 1, 1);
        ctx.fillRect(cx + 14 * dir, base - ch, 1, 1);
      }
    }
  } else {
    // steam over the towers, drifting
    ctx.fillStyle = rgbToHex(mixc([240, 240, 244], sky, 0.25 + dl.dark * 0.4));
    for (const cx of [x0, x0 + 54]) {
      for (let i = 0; i < 9; i++) {
        const r = 3 + i * 0.6;
        const px = Math.round(cx + Math.sin(t * 0.2 + i) * 1.5 + i * 1.8);
        const py = Math.round(base - 28 - i * 2.4);
        ctx.fillRect(px - r, py - r / 2, r * 2, r);
      }
    }
  }
}
