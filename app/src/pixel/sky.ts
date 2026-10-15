// What lies around the room, in pixels: banded skies with dithered steps, scenery silhouettes, pixel clouds,
// sun and moon, and weather particles.

import type { Daylight } from '../daylight';
import { bayer, hexToRgb, ramp, rgbToHex, type RGB } from './palette';
import { drawPlant, type PlantOnHorizon } from './plant';

function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function lerp(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function dim(c: RGB, dark: number, k = 0.6): RGB {
  const night: RGB = [24, 26, 60];
  return lerp(c, lerp(c, night, 0.7), dark * k);
}

/** The static part of the scene behind the room (sky, sun or moon, stars, scenery), drawn once per minute. */
export function paintSky(w: number, h: number, kind: string, dl: Daylight): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const sky = hexToRgb(dl.sky);
  const horizon = Math.round(h * 0.66);
  const top: RGB = kind === 'space' ? [6, 6, 20] : kind === 'void' ? [14, 15, 26] : dim(lerp(sky, [40, 60, 140], 0.35), dl.dark, 0.5);
  const low: RGB = kind === 'space' ? [26, 16, 50] : kind === 'void' ? [24, 26, 40] : lerp(sky, [255, 246, 230], 0.35 * (1 - dl.dark));
  const bands = 7;
  const put = (x: number, y: number, col: RGB) => {
    const i = (y * w + x) * 4;
    d[i] = col[0];
    d[i + 1] = col[1];
    d[i + 2] = col[2];
    d[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    const k = Math.min(1, y / horizon);
    for (let x = 0; x < w; x++) {
      const step = Math.min(bands - 1, Math.floor(k * (bands - 1) + bayer(x, y)));
      put(x, y, lerp(top, low, step / (bands - 1)));
    }
  }
  // stars at night and in space
  const starAmount = kind === 'space' ? 1 : Math.max(0, dl.dark - 0.45) * 1.6;
  if (starAmount > 0) {
    for (let i = 0; i < (w * h) / 220; i++) {
      const x = Math.floor(hash(i, 1) * w);
      const y = Math.floor(hash(i, 2) * horizon * 0.95);
      if (hash(i, 3) > starAmount) continue;
      const b = hash(i, 4) > 0.85 ? 255 : 190;
      put(x, y, [b, b, Math.min(255, b + 20)]);
    }
  }
  ctx.putImageData(img, 0, 0);
  // sun or moon
  const sunUp = dl.dark < 0.55 && kind !== 'space' && kind !== 'void';
  const disc = (cx: number, cy: number, r: number, col: RGB, halo: RGB) => {
    for (let y = -r * 3; y <= r * 3; y++) {
      for (let x = -r * 3; x <= r * 3; x++) {
        const dd = Math.hypot(x, y);
        if (dd <= r) {
          ctx.fillStyle = rgbToHex(dd > r - 1.2 ? lerp(col, halo, 0.3) : col);
          ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
        } else if (dd < r * 2.6 && (r * 2.6 - dd) / (r * 1.6) > bayer(x + 64, y + 64) * 1.6) {
          ctx.fillStyle = `rgba(${halo[0]},${halo[1]},${halo[2]},0.25)`;
          ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
        }
      }
    }
  };
  const r = Math.max(5, Math.round(Math.min(w, h) * 0.045));
  if (sunUp) disc(w * 0.8, h * (0.18 + 0.12 * dl.dark), r, [255, 240, 196], [255, 214, 140]);
  else if (kind !== 'void') {
    disc(w * 0.18, h * 0.18, Math.round(r * 0.8), [232, 236, 255], [170, 186, 255]);
    ctx.fillStyle = rgbToHex(top);
    const mr = Math.round(r * 0.8);
    for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) if (Math.hypot(x - mr * 0.55, y + mr * 0.2) < mr * 0.8 && Math.hypot(x, y) <= mr) ctx.fillRect(Math.round(w * 0.18 + x), Math.round(h * 0.18 + y), 1, 1);
  }
  // scenery
  const scen = (col: string, fn: (x: number) => number, from: number) => {
    const rr = ramp(col);
    for (let x = 0; x < w; x++) {
      const top = Math.round(fn(x));
      for (let y = Math.max(0, top); y < h; y++) {
        const shade = y < top + 2 ? 3 : y > from + (h - from) * 0.6 ? 1 : 2;
        ctx.fillStyle = rgbToHex(dim(rr[shade], dl.dark));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  if (kind === 'forest') {
    for (const [layer, col, base, size] of [[0, '#4f8a6a', 0.6, 0.07], [1, '#3b7356', 0.66, 0.09], [2, '#2a5c45', 0.73, 0.11]] as [number, string, number, number][]) {
      scen(col, (x) => {
        const cell = Math.floor(x / (w * size * 0.5));
        const cx = (cell + 0.5) * w * size * 0.5 + (hash(cell, layer) - 0.5) * 6;
        const tall = h * size * (1.2 + hash(cell, layer, 2));
        return h * base - Math.max(0, tall - Math.abs(x - cx) * 2.2);
      }, h * base);
    }
  } else if (kind === 'mountains') {
    scen('#8a96c0', (x) => h * 0.5 - Math.abs(Math.sin(x / 37) * 26 + Math.sin(x / 13) * 6), h * 0.5);
    scen('#5c6b98', (x) => h * 0.6 - Math.abs(Math.sin(x / 23 + 1) * 18 + Math.sin(x / 7) * 3), h * 0.6);
  } else if (kind === 'city') {
    const rr = ramp('#2a3055');
    for (let x = 0; x < w; ) {
      const bw = 6 + Math.floor(hash(x, 9) * 14);
      const bh = Math.round(h * (0.12 + hash(x, 10) * 0.28));
      const y0 = Math.round(h * 0.7) - bh;
      ctx.fillStyle = rgbToHex(dim(rr[hash(x, 11) > 0.5 ? 2 : 1], dl.dark * 0.4));
      ctx.fillRect(x, y0, bw, h - y0);
      for (let wy = y0 + 2; wy < h * 0.7 - 2; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) if (hash(wx, wy) > (dl.dark > 0.4 ? 0.55 : 0.85)) {
        ctx.fillStyle = dl.dark > 0.4 ? '#ffd27a' : '#9fb6d8';
        ctx.fillRect(wx, wy, 1, 1);
      }
      x += bw + 1;
    }
  } else if (kind === 'sea') {
    const rr = ramp('#3a7fb8');
    for (let y = Math.round(h * 0.62); y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tone = (y - h * 0.62) / (h * 0.38) < 0.3 ? 3 : 2;
        ctx.fillStyle = rgbToHex(dim(rr[hash(x >> 2, y) > 0.97 ? 4 : tone], dl.dark));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  if (kind !== 'space' && kind !== 'void' && kind !== 'sea' && kind !== 'city') {
    // ground band under the scenery
    const g = ramp(kind === 'forest' ? '#2a5c45' : kind === 'mountains' ? '#4a5a80' : '#a8c7ea');
    for (let y = Math.round(h * 0.74); y < h; y++) for (let x = 0; x < w; x++) {
      ctx.fillStyle = rgbToHex(dim(g[y < h * 0.74 + 2 ? 3 : 2], dl.dark));
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

const cloudCache = new Map<number, HTMLCanvasElement>();
function cloud(seed: number): HTMLCanvasElement {
  let c = cloudCache.get(seed);
  if (c) return c;
  const w = 28 + Math.floor(hash(seed, 1) * 20);
  const h = 12 + Math.floor(hash(seed, 2) * 6);
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const blobs = [[0.3, 0.6, 0.32], [0.55, 0.45, 0.4], [0.75, 0.62, 0.28], [0.45, 0.7, 0.3]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false;
      let low = false;
      for (const [bx, by, br] of blobs) {
        const dx = (x + 0.5) / w - bx;
        const dy = ((y + 0.5) / h - by) * (h / w);
        if (Math.hypot(dx, dy * 2.2) < br * 0.5) {
          inside = true;
          if ((y + 0.5) / h > 0.62) low = true;
        }
      }
      if (inside) {
        ctx.fillStyle = low ? 'rgba(214,224,246,1)' : 'rgba(255,255,255,1)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  cloudCache.set(seed, c);
  return c;
}

/** Clouds drift over the sky; drawn every frame at whole pixels. */
export function drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number, kind: string, dl: Daylight, t: number): void {
  if (kind === 'space' || kind === 'void') return;
  ctx.save();
  ctx.globalAlpha = 0.85 - dl.dark * 0.5;
  for (let i = 0; i < 5; i++) {
    const c = cloud(i);
    const span = w + c.width * 2;
    const x = Math.round(((hash(i, 5) * span + t * (2 + i * 0.7)) % span) - c.width);
    const y = Math.round(h * (0.08 + hash(i, 6) * 0.25));
    ctx.drawImage(c, x, y);
  }
  ctx.restore();
}

/** Weather particles in front of everything, at whole pixels. */
/**
 * Weather over the picture: slanting rain with splashes where it lands, a storm's heavier, windier rain, snow in
 * flakes of two sizes drifting on the wind, fog in slow bands. `density` thins it on a slow phone.
 */
export function drawWeatherPx(ctx: CanvasRenderingContext2D, w: number, h: number, kind: string, dl: Daylight, t: number, density = 1): void {
  if (kind === 'none') return;
  if (kind === 'fog') {
    ctx.save();
    ctx.fillStyle = 'rgba(224,230,240,0.14)';
    ctx.fillRect(0, 0, w, h);
    // bands of mist moving slowly across, thicker low down
    for (let y = 0; y < h; y += 3) {
      const a = 0.05 + 0.07 * Math.max(0, Math.sin(y / 23 + t * 0.12)) + 0.05 * (y / h);
      ctx.fillStyle = `rgba(232,236,244,${a.toFixed(3)})`;
      const shift = Math.sin(y / 11 + t * 0.2) * 20;
      ctx.fillRect(shift - 20, y, w + 40, 2);
    }
    ctx.restore();
    return;
  }
  const storm = kind === 'storm';
  const wet = kind === 'rain' || storm;
  const per = wet ? (storm ? 420 : 800) : kind === 'snow' ? 1100 : 1800;
  const n = Math.round(((w * h) / per) * density);
  if (wet) {
    const wind = storm ? 0.55 : 0.2;
    const len = storm ? 6 : 4;
    ctx.fillStyle = storm ? 'rgba(200,214,240,0.6)' : 'rgba(190,210,255,0.5)';
    for (let i = 0; i < n; i++) {
      const speed = 150 + hash(i, 3) * 60;
      const y = (hash(i, 2) * h + t * speed) % h;
      const x = (hash(i, 1) * w - t * speed * wind + w * 4) % w;
      // a streak along the wind, drawn as a few pixels
      for (let k = 0; k < len; k++) ctx.fillRect(Math.round(x - k * wind), Math.round(y - k), 1, 1);
    }
    // splashes on the ground: little crowns that flash and are gone
    ctx.fillStyle = 'rgba(220,234,255,0.7)';
    const splashes = Math.round(n * 0.25);
    for (let i = 0; i < splashes; i++) {
      const phase = (t * 3 + hash(i, 7)) % 1;
      if (phase > 0.3) continue;
      const x = Math.round(hash(i, 8 + Math.floor(t * 3 + hash(i, 7))) * w);
      const y = Math.round(h * 0.25 + hash(i, 9 + Math.floor(t * 3 + hash(i, 7))) * h * 0.75);
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillRect(x, y, 1, 1);
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    const sx = hash(i, 1) * w;
    const sy = hash(i, 2) * h;
    if (kind === 'snow') {
      const big = hash(i, 4) > 0.75;
      const y = Math.round((sy + t * (big ? 18 : 11)) % h);
      const x = Math.round((sx + t * 6 + Math.sin(t * 0.8 + i) * (big ? 6 : 3) + w * 4) % w);
      ctx.fillStyle = big ? '#ffffff' : 'rgba(255,255,255,0.8)';
      ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    } else if (kind === 'petals') {
      const y = Math.round((sy + t * 12) % h);
      const x = Math.round((sx + t * 8 + Math.sin(t * 1.5 + i) * 5) % w);
      ctx.fillStyle = i % 2 ? '#ffb7cf' : '#ffd6e4';
      ctx.fillRect(x, y, 2, 1);
    } else if (kind === 'fireflies') {
      const x = Math.round((sx + Math.sin(t * 0.6 + i) * 10 + w) % w);
      const y = Math.round((sy + Math.cos(t * 0.5 + i * 2) * 6 + h) % h);
      if (Math.sin(t * 2 + i * 3) > 0) {
        ctx.fillStyle = dl.dark > 0.3 ? '#fff3a0' : 'rgba(255,243,160,0.5)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * The land around a map out of doors, as far as the eye goes: rolling hills and a line of forest on the horizon,
 * hazier the further off they are, and the ground (green, gold, brown or white with the season) from there to
 * the bottom of the screen, so a village or a forest sits in a world rather than floating in the sky.
 */
export function paintLandscape(w: number, h: number, season: string, dl: Daylight, shift: number, town = false, plant: PlantOnHorizon | null = null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const sky = hexToRgb(dl.sky);
  const name = season.split(':')[0];
  const ground: Record<string, [RGB, RGB]> = {
    Spring: [[120, 190, 92], [104, 176, 76]], Summer: [[106, 168, 79], [90, 148, 67]], Autumn: [[160, 150, 80], [140, 120, 62]], Winter: [[226, 234, 244], [205, 216, 230]],
  };
  const forest: Record<string, RGB> = { Spring: [72, 132, 70], Summer: [52, 110, 62], Autumn: [150, 96, 52], Winter: [110, 120, 130] };
  // in the village the ground beyond is paving and yards, not fields
  const [g1, g2] = town ? ([[176, 166, 150], [150, 140, 126]] as [RGB, RGB]) : (ground[name] ?? ground.Summer);
  const horizon = Math.round(h * 0.2);
  // three ridges, the far ones paler with the air between
  const ridge = (base: number, amp: number, freq: number, seed: number, col: RGB, trees: boolean) => {
    for (let x = 0; x < w; x++) {
      const wx = x + shift * (0.08 + seed * 0.04);
      let y = base - amp * (0.55 * Math.sin(wx * freq + seed) + 0.3 * Math.sin(wx * freq * 2.3 + seed * 3) + 0.15 * Math.sin(wx * freq * 5.1 + seed * 7));
      // a fringe of treetops along the nearer ridges
      if (trees) y -= (Math.floor(wx) % 5 < 3 ? 2 : 0) + (Math.floor(wx / 3) % 4 === 0 ? 2 : 0);
      ctx.fillStyle = rgbToHex(col);
      ctx.fillRect(x, Math.round(y), 1, h - Math.round(y));
    }
  };
  const far = lerp(lerp(forest[name] ?? forest.Summer, sky, 0.7), [255, 255, 255], name === 'Winter' ? 0.3 : 0);
  if (town) {
    // in the village: roofs upon roofs to the horizon, chimneys and a spire, windows lit at night
    const rows: [number, number, RGB][] = [[horizon + 4, 0.65, [120, 110, 130]], [horizon + 14, 0.4, [150, 96, 80]], [horizon + 24, 0.15, [130, 84, 70]]];
    for (const [base, haze, col] of rows) {
      let x = -Math.floor(hash(base, 1) * 20);
      let k = 0;
      while (x < w) {
        const bw = 14 + Math.floor(hash(base, k) * 18);
        const bh = 8 + Math.floor(hash(base, k + 50) * 14);
        const roof = Math.floor(bw / 2.4);
        const c = dim(lerp(col, sky, haze), dl.dark, 0.35);
        const wall = dim(lerp([200, 190, 170], sky, haze), dl.dark, 0.5);
        ctx.fillStyle = rgbToHex(wall);
        ctx.fillRect(x, base - bh, bw, h);
        ctx.fillStyle = rgbToHex(c);
        for (let i = 0; i <= roof; i++) ctx.fillRect(x + i, base - bh - roof + i, bw - i * 2, 1);
        if (hash(base, k + 9) > 0.6) ctx.fillRect(x + Math.floor(bw * 0.7), base - bh - roof - 4, 3, roof + 2);
        if (dl.dark > 0.4) {
          ctx.fillStyle = 'rgba(255,214,120,0.85)';
          for (let i = 0; i < 3; i++) if (hash(base + i, k + 21) > 0.45) ctx.fillRect(x + 3 + i * 5, base - bh + 3, 2, 2);
        }
        x += bw + (hash(base, k + 77) > 0.8 ? 3 : 0);
        k++;
      }
    }
    // the church's spire far off
    ctx.fillStyle = rgbToHex(dim(lerp([110, 110, 120], sky, 0.5), dl.dark, 0.4));
    const sx = Math.floor(w * 0.72);
    for (let i = 0; i < 26; i++) ctx.fillRect(sx - Math.floor(i / 5), horizon - 16 + i, 1 + Math.floor(i / 5) * 2, 1);
  } else {
    ridge(horizon - 6, 10, 0.013, 1, dim(far, dl.dark, 0.2), false);
    // the plant being built beyond the fields, half hidden by the nearer hills
    if (plant) drawPlant(ctx, w, horizon + 3, plant, dl);
  }
  if (!town) {
    ridge(horizon + 2, 7, 0.021, 2, dim(lerp(forest[name] ?? forest.Summer, sky, 0.45), dl.dark, 0.2), true);
    ridge(horizon + 9, 4, 0.034, 3, dim(lerp(forest[name] ?? forest.Summer, sky, 0.2), dl.dark, 0.2), true);
  }
  // the ground, a little hazy at first, dithered in two tones (written as pixels: one pass, cheap)
  const top = town ? horizon + 26 : horizon + 12;
  if (top < h) {
    const img = ctx.createImageData(w, h - top);
    const d = img.data;
    for (let y = top; y < h; y++) {
      const haze = Math.max(0, 1 - (y - top) / (h * 0.35)) * 0.35;
      const a = dim(lerp(g1, sky, haze), dl.dark, 0.15);
      const b = dim(lerp(g2, sky, haze), dl.dark, 0.15);
      for (let x = 0; x < w; x++) {
        const col = bayer(x, y) > 0.55 ? b : a;
        const i = ((y - top) * w + x) * 4;
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, top);
  }
  void shift;
  return c;
}
