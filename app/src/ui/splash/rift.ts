// Розлом: a crack runs down the sky over the town, and through it the same town shows in the other light, day
// when it is night here, night when it is day. It breathes. Take hold of it and it follows the finger and opens,
// spilling light on the houses; touch the town and a mote of that light flies to the spot and wakes the windows;
// the birds on the wires take off, the cat on the roof answers. Going in, the rift opens over everything.

import { plantToday } from '../../nppdates';
import type { Env, Splash } from './index';
import { Town, glow, hash, rect, type Light, type Look } from './town';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  to: [number, number] | null;
}

export function rift(env: Env): Splash {
  const { W, H } = env;
  const town = new Town(W, H, { seed: 11, church: 0.14, hall: 0.8, plant: plantToday() });
  const here: Look = env.look;
  const otherLight: Light = here.light === 'day' ? 'night' : 'day';
  const there: Look = { light: otherLight, season: here.season };
  const other = document.createElement('canvas');
  other.width = W;
  other.height = H;
  const og = other.getContext('2d') as CanvasRenderingContext2D;

  const y0 = 3;
  const y1 = town.ground + 3;
  // the crack's course: straight runs between sharp kinks, as rock or glass breaks
  const jag: number[] = new Array(H + 1).fill(0);
  {
    let y = 0;
    let x = 0;
    let k = 0;
    while (y <= H) {
      const run = 5 + Math.floor(hash(k, 3) * 9);
      const nx = Math.max(-6, Math.min(6, x + Math.round((hash(k, 4) - 0.5) * 9)));
      for (let i = 0; i < run && y + i <= H; i++) jag[y + i] = Math.round(x + ((nx - x) * i) / run);
      y += run;
      x = nx;
      k++;
    }
  }
  // hairline cracks branching off it
  const branches = Array.from({ length: 5 }, (_, i) => ({ y: Math.round(y0 + 10 + hash(i, 61) * (H * 0.55)), dir: i % 2 ? 1 : -1, len: 5 + Math.floor(hash(i, 62) * 8), seed: i }));
  const taper = (y: number) => Math.pow(Math.max(0, Math.sin((Math.PI * (y - y0)) / (y1 - y0))), 0.7);

  let rx = Math.round(W * 0.66);
  let rxTarget = rx;
  let width = 2;
  let held = false;
  let enterAt = -1;
  let motes: Mote[] = [];
  let spill = 0;
  let frameNo = 0;

  const cx = (y: number) => rx + jag[Math.max(0, Math.min(H, Math.round(y)))] * (1 + width / 24);
  const near = (x: number, y: number) => y > y0 - 4 && y < y1 + 4 && Math.abs(x - cx(y)) < 9 + width / 2;

  return {
    frame(g, t, dt) {
      // how open it is: breathing when left alone, opening while held, all the way going in
      const idle = 4.5 + Math.sin(t * 1.1) * 1.2 + Math.sin(t * 0.37) * 0.8;
      const target = enterAt >= 0 ? W * 1.6 : held ? 36 : idle;
      width += (target - width) * Math.min(1, dt * (enterAt >= 0 ? 2.2 : held ? 1.5 : 2.5));
      rx += (rxTarget - rx) * Math.min(1, dt * 6);

      town.draw(g, here, t, dt, env.par);
      // the other light shows only through the crack: every other frame is enough for it (all of them once it opens)
      if ((frameNo++ & 1) === 0 || width > 12) town.draw(og, there, t, 0, env.par);

      // light spilling out of a wide rift wakes the windows near it
      spill += dt * width;
      if (spill > 14) {
        spill = 0;
        const yy = y0 + Math.random() * (y1 - y0);
        if (width > 8) town.lightAround(cx(yy), town.ground - 10 - Math.random() * 30, width * 0.8, t);
      }

      // its glow on the night
      for (let y = y0; y < y1; y += 5) glow(g, cx(y), y, Math.round(3 + width / 3 + taper(y) * 3), '#f6b347', 0.05 + Math.min(0.08, width / 300));
      // the other light, row by row inside the crack, with bright lips
      for (let y = y0; y <= y1; y++) {
        const hw = (width * taper(y)) / 2;
        const c = cx(y);
        if (hw < 0.6) {
          if (taper(y) > 0.05) rect(g, c, y, 1, 1, '#fff3c4');
          continue;
        }
        const a = Math.max(0, Math.floor(c - hw));
        const b = Math.min(W, Math.ceil(c + hw));
        if (b > a) g.drawImage(other, a, y, b - a, 1, a, y, b - a, 1);
        rect(g, a - 1, y, 1, 1, '#fff3c4');
        rect(g, b, y, 1, 1, '#fff3c4');
        if ((y + Math.floor(t * 6)) % 3 === 0) {
          g.globalAlpha = 0.5;
          rect(g, a - 2, y, 1, 1, '#f6b347');
          rect(g, b + 1, y, 1, 1, '#f6b347');
          g.globalAlpha = 1;
        }
      }
      // hairlines off the main crack, brighter as it opens
      g.globalAlpha = Math.min(1, 0.35 + width / 30);
      for (const br of branches) {
        let x = cx(br.y) + (br.dir * width * taper(br.y)) / 2;
        let y = br.y;
        for (let i = 0; i < br.len + Math.floor(width / 4); i++) {
          x += br.dir;
          if (hash(br.seed, i) < 0.45) y += hash(br.seed, i + 40) < 0.5 ? -1 : 1;
          rect(g, x, y, 1, 1, i < 3 ? '#fff3c4' : '#f6b347');
        }
      }
      g.globalAlpha = 1;
      // motes of light drift out of the rift; some fly where they were sent
      if (Math.random() < dt * (5 + width / 2) && enterAt < 0) {
        const y = y0 + 6 + Math.random() * (y1 - y0 - 12);
        const side = Math.random() < 0.5 ? -1 : 1;
        motes.push({ x: cx(y) + (side * width * taper(y)) / 2, y, vx: side * (2 + Math.random() * 5), vy: -1 - Math.random() * 3, life: 0, to: null });
      }
      motes = motes.filter((m) => m.life < 4);
      for (const m of motes) {
        m.life += dt;
        if (m.to) {
          const dx = m.to[0] - m.x;
          const dy = m.to[1] - m.y;
          const d = Math.hypot(dx, dy);
          if (d < 2) {
            town.lightAround(m.to[0], m.to[1], 9, t);
            m.life = 99;
            continue;
          }
          m.vx += (dx / d) * 120 * dt;
          m.vy += (dy / d) * 120 * dt;
          m.vx *= 0.92;
          m.vy *= 0.92;
        } else {
          m.vx *= 0.99;
          m.vy += Math.sin(t * 2 + m.x) * dt * 2;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        g.globalAlpha = m.to ? 1 : Math.max(0, 1 - m.life / 4);
        glow(g, m.x, m.y, 2, '#f6b347', 0.25);
        rect(g, m.x, m.y, 1, 1, '#fff3c4');
        g.globalAlpha = 1;
      }
    },
    down(x, y, t) {
      if (enterAt >= 0) return;
      if (near(x, y)) {
        held = true;
        env.chimes.whoosh(0.08, 0.9);
        env.chimes.bell(Math.floor((1 - y / H) * 7));
      }
    },
    move(x) {
      if (held) rxTarget = Math.max(16, Math.min(W - 16, x));
    },
    up() {
      held = false;
    },
    tap(x, y, t) {
      if (enterAt >= 0) return;
      if (near(x, y)) return;
      const hit = town.poke(x, y, t);
      if (hit === 'birds') env.chimes.chirp();
      else if (hit === 'cat') env.chimes.meow();
      // a few motes fly from the rift to the touch and wake the windows there
      const fromY = Math.max(y0 + 8, Math.min(y1 - 8, y));
      for (let i = 0; i < 4; i++) motes.push({ x: cx(fromY), y: fromY + (i - 2) * 3, vx: (x < cx(fromY) ? -1 : 1) * 10, vy: -8 + i * 3, life: 0, to: [x + (i - 2) * 3, y] });
      env.chimes.bell(Math.floor((x / W) * 9), 0.18);
    },
    enter(t) {
      enterAt = t;
      env.chimes.whoosh(0.22, 1.4);
      env.chimes.chord([0, 2, 4, 7], 0.12);
      return 1.6;
    },
  };
}
