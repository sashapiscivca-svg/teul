// Пори року: the town cracked like glass into four shards, and each shard is the same street in another season
// and another hour: spring morning, a summer evening, an autumn day, a winter night. The cracks meet at one
// point; drag it and the shards change shape. Touch a shard and it opens wide (its season sounds), and the
// birds, windows and the cat in it answer. Going in, the cracks heal and the season of today fills the screen.

import type { Env, Splash } from './index';
import { Town, glow, hash, rect, type Look, type Season } from './town';

const ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const LIGHTS: Look[] = [
  { season: 'spring', light: 'day' },
  { season: 'summer', light: 'dusk' },
  { season: 'autumn', light: 'day' },
  { season: 'winter', light: 'night' },
];
const CHORDS = [[4, 7, 9], [2, 4, 7, 9], [0, 2, 4], [5, 7, 9, 12]];
const TAU = Math.PI * 2;

export function seasons(env: Env): Splash {
  const { W, H } = env;
  const towns = LIGHTS.map(() => new Town(W, H, { seed: 41, church: 0.2, hall: 0.74 }));
  const shards = LIGHTS.map(() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return { c, g: c.getContext('2d') as CanvasRenderingContext2D };
  });
  const today = Math.max(0, ORDER.indexOf(env.look.season));

  let px = W * 0.5;
  let py = H * 0.6;
  let tx = px;
  let ty = py;
  // where each crack leaves the meeting point (radians), and how wide each shard is
  let spans = [TAU / 4, TAU / 4, TAU / 4, TAU / 4];
  let focus = -1;
  let focusUntil = 0;
  let enterAt = -1;
  let dragging = false;
  let frameNo = 0;

  const startAngle = -Math.PI;
  const rayAngles = (t: number): number[] => {
    const out: number[] = [];
    let a = startAngle + Math.sin(t * 0.13) * 0.06;
    for (let i = 0; i < 4; i++) {
      out.push(a + Math.sin(t * 0.2 + i * 1.7) * 0.05);
      a += spans[i];
    }
    return out;
  };
  /** A crack from the meeting point outward: straight runs with kinks, out past the screen. */
  const ray = (a: number, seed: number): [number, number][] => {
    const pts: [number, number][] = [[px, py]];
    let d = 0;
    let k = 0;
    while (d < W + H) {
      d += 8 + hash(seed, k) * 12;
      const off = (hash(seed, k + 50) - 0.5) * 6;
      pts.push([px + Math.cos(a) * d - Math.sin(a) * off, py + Math.sin(a) * d + Math.cos(a) * off]);
      k++;
    }
    return pts;
  };
  const sector = (a0: number, span: number, r0: [number, number][], r1: [number, number][]): Path2D => {
    const p = new Path2D();
    p.moveTo(r0[0][0], r0[0][1]);
    for (const [x, y] of r0) p.lineTo(x, y);
    const far = (W + H) * 2;
    const steps = Math.max(1, Math.ceil(span / (Math.PI / 3)));
    for (let i = 1; i < steps; i++) p.lineTo(px + Math.cos(a0 + (span * i) / steps) * far, py + Math.sin(a0 + (span * i) / steps) * far);
    for (let i = r1.length - 1; i >= 0; i--) p.lineTo(r1[i][0], r1[i][1]);
    p.closePath();
    return p;
  };
  const which = (x: number, y: number, t: number): number => {
    const a = Math.atan2(y - py, x - px);
    const rays = rayAngles(t);
    for (let i = 0; i < 4; i++) {
      let d = a - rays[i];
      while (d < 0) d += TAU;
      while (d >= TAU) d -= TAU;
      if (d < spans[i]) return i;
    }
    return 0;
  };

  return {
    frame(g, t, dt) {
      frameNo++;
      px += (tx - px) * Math.min(1, dt * 5);
      py += (ty - py) * Math.min(1, dt * 5);
      if (focus >= 0 && t > focusUntil && enterAt < 0) focus = -1;
      const want = spans.map((_, i) => {
        const f = enterAt >= 0 ? today : focus;
        if (f < 0) return TAU / 4;
        if (enterAt >= 0) return i === f ? TAU - 0.0001 * 3 : 0.0001;
        return i === f ? TAU - 0.5 * 3 : 0.5;
      });
      spans = spans.map((s, i) => s + (want[i] - s) * Math.min(1, dt * (enterAt >= 0 ? 2.5 : 3)));
      const sum = spans.reduce((a, b) => a + b, 0);
      spans = spans.map((s) => (s / sum) * TAU);

      // the four towns, each in its own season (on a tired phone, two per frame)
      for (let i = 0; i < 4; i++) {
        if (env.lowPower && (i + frameNo) % 2 === 1) continue;
        towns[i].draw(shards[i].g, LIGHTS[i], t, env.lowPower ? dt * 2 : dt, env.par);
      }
      const angles = rayAngles(t);
      const rays = angles.map((a, i) => ray(a, i * 13 + 5));
      for (let i = 0; i < 4; i++) {
        if (spans[i] < 0.01) continue;
        g.save();
        g.clip(sector(angles[i], spans[i], rays[i], rays[(i + 1) % 4]));
        g.drawImage(shards[i].c, 0, 0);
        g.restore();
      }
      // the cracks: a dark seam with a bright lip, fading as they heal
      const heal = enterAt >= 0 ? Math.min(1, (t - enterAt) / 1.2) : 0;
      g.globalAlpha = 1 - heal;
      for (let i = 0; i < 4; i++) {
        const r = rays[i];
        for (let k = 0; k + 1 < r.length; k++) {
          const [x0, y0] = r[k];
          const [x1, y1] = r[k + 1];
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 0; s <= n; s++) {
            const x = Math.round(x0 + ((x1 - x0) * s) / n);
            const y = Math.round(y0 + ((y1 - y0) * s) / n);
            rect(g, x + 1, y + 1, 1, 1, '#0b0c18');
            rect(g, x, y, 1, 1, (k + s + Math.floor(t * 8)) % 23 === 0 ? '#ffffff' : '#fff3c4');
          }
        }
      }
      // a glint where they meet
      const tw = 2 + Math.round(Math.sin(t * 2.2) * 1.5);
      rect(g, px - tw, py, tw * 2 + 1, 1, '#ffffff');
      rect(g, px, py - tw, 1, tw * 2 + 1, '#ffffff');
      glow(g, px, py, 4, '#fff3c4', 0.35);
      g.globalAlpha = 1;
      // a sweep of light over the healed glass
      if (heal > 0 && heal < 1) {
        const sx = Math.round(-W * 0.3 + heal * W * 1.6);
        g.globalAlpha = 0.25;
        for (let y = 0; y < H; y++) rect(g, sx - y * 0.4, y, 6, 1, '#ffffff');
        g.globalAlpha = 1;
      }
    },
    down(x, y) {
      if (enterAt >= 0) return;
      dragging = Math.hypot(x - px, y - py) < 16;
    },
    move(x, y) {
      if (!dragging) return;
      tx = Math.max(20, Math.min(W - 20, x));
      ty = Math.max(20, Math.min(H - 20, y));
    },
    up() {
      dragging = false;
    },
    tap(x, y, t) {
      if (enterAt >= 0) return;
      const i = which(x, y, t);
      const hit = towns[i].poke(x, y, t);
      if (hit === 'birds') env.chimes.chirp();
      else if (hit === 'cat') env.chimes.meow();
      if (focus !== i) {
        focus = i;
        env.chimes.chord(CHORDS[i], 0.12);
      } else if (hit === 'window' || hit === null) env.chimes.bell(CHORDS[i][Math.floor(Math.random() * CHORDS[i].length)], 0.14);
      focusUntil = t + 7;
    },
    enter(t) {
      enterAt = t;
      tx = W * 0.5;
      ty = H * 0.5;
      env.chimes.chord(CHORDS[today], 0.13);
      env.chimes.whoosh(0.1, 1.4);
      return 1.7;
    },
  };
}
