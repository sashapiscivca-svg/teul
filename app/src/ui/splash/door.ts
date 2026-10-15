// Прочинені двері: a dark hallway at home, the front door left ajar, and through the gap the town outside in
// the light of this very hour. A beam falls across the floorboards with dust turning in it. Drag sideways and the
// door swings open (and creaks), let go and the draught pulls it back to ajar. The lamp on the little table
// switches on and off, the picture swings when touched, the clock keeps the real time and strikes when tapped,
// the cat sits by the door and goes out into the light when it is open wide enough. The hero, if there is one,
// stands in the hallway with their back to us and walks where the floor is touched.

import { figureLayers } from '../../character';
import type { Env, Splash } from './index';
import { Town, disc, glow, hash, line, mix, rect, soft } from './town';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  p: number;
}

export function door(env: Env): Splash {
  const { W, H } = env;
  const floorY = H - 30;
  const dw = 30;
  const dh = 58;
  const dxL = Math.round(W * 0.66);
  const dxR = dxL + dw;
  const dTop = floorY - dh;
  const outLook = env.look;
  const town = new Town(W, H, { seed: 23, church: 0.45, hall: 0.95, street: 26 });
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const og = out.getContext('2d') as CanvasRenderingContext2D;
  const beam = outLook.light === 'day' ? '#fff0c0' : outLook.light === 'dusk' ? '#ffc890' : '#b8c4ff';

  const AJAR = 0.62;
  let angle = AJAR;
  let target = AJAR;
  let dragFrom: { x: number; a: number } | null = null;
  let lastCreak = 0;
  let lamp = true;
  let swing = 0;
  let swingV = 0;
  let strike = -10;
  let enterAt = -1;
  const heroAt = { x: dxL - 30, to: dxL - 30, dir: 'up' as 'up' | 'left' | 'right' };
  const cat = { x: dxL - 9, out: -1, back: 0 };
  const motes: Mote[] = Array.from({ length: 34 }, (_, i) => ({ x: dxL + hash(i, 1) * dw, y: dTop + hash(i, 2) * (H - dTop), vx: 0, vy: 0, p: hash(i, 3) * 10 }));

  const table = { x: 24, y: floorY - 14, w: 20 };
  const picture = { x: 30, y: floorY - 46, w: 16, h: 12 };
  const clock = { x: W - 26, y: floorY - 44 };

  const freeEdge = () => dxR - dw * Math.cos(angle);
  const bulge = () => Math.sin(angle) * 7;

  function wall(g: CanvasRenderingContext2D): void {
    // wallpaper: stripes and a small figure, in the dark of the hallway
    rect(g, 0, 0, W, floorY, '#2a2440');
    for (let x = 0; x < W; x += 8) rect(g, x, 0, 3, floorY - 18, '#2f2948');
    for (let y = 6; y < floorY - 20; y += 10) {
      for (let x = 5 + ((y / 10) % 2) * 4; x < W; x += 8) {
        rect(g, x, y, 1, 1, '#3a3358');
        rect(g, x - 1, y + 1, 3, 1, '#352f52');
        rect(g, x, y + 2, 1, 1, '#3a3358');
      }
    }
    // the cornice, the wainscot and the skirting
    rect(g, 0, 0, W, 3, '#1e1a30');
    rect(g, 0, 3, W, 1, '#3a3358');
    rect(g, 0, floorY - 19, W, 1, '#4a3a2e');
    rect(g, 0, floorY - 18, W, 18, '#3a2c24');
    for (let x = 4; x < W; x += 22) {
      rect(g, x, floorY - 15, 18, 11, '#33271f');
      rect(g, x, floorY - 15, 18, 1, '#2a201a');
      rect(g, x, floorY - 5, 18, 1, '#46362c');
    }
    rect(g, 0, floorY - 2, W, 2, '#241a14');
    // the floorboards, running toward us
    for (let y = floorY; y < H; y++) rect(g, 0, y, W, 1, mix('#3a2a20', '#4a362a', (y - floorY) / (H - floorY)));
    for (let y = floorY + 2; y < H; y += 3 + Math.floor((y - floorY) / 8)) rect(g, 0, y, W, 1, '#2a1e18');
    for (let i = 0; i < 40; i++) rect(g, Math.floor(hash(i, 31) * W), floorY + Math.floor(hash(i, 30) * (H - floorY)), 1, 1, '#241a14');
  }

  function furniture(g: CanvasRenderingContext2D, t: number): void {
    // the little table and its lamp
    rect(g, table.x, table.y, table.w, 2, '#6a4a32');
    rect(g, table.x + 1, table.y + 2, table.w - 2, 1, '#4a3424');
    rect(g, table.x + 2, table.y + 3, 1, 11, '#4a3424');
    rect(g, table.x + table.w - 3, table.y + 3, 1, 11, '#4a3424');
    rect(g, table.x + 4, table.y + 7, table.w - 8, 1, '#4a3424');
    const lx = table.x + 7;
    rect(g, lx + 2, table.y - 6, 1, 6, '#c9a050');
    rect(g, lx, table.y - 1, 5, 1, '#c9a050');
    for (let i = 0; i < 5; i++) rect(g, lx - 2 + Math.floor(i / 2), table.y - 11 + i, 9 - Math.floor(i / 2) * 2, 1, lamp ? (i < 2 ? '#ffe7a0' : '#f6b347') : '#6a5a4a');
    rect(g, table.x + 14, table.y - 3, 3, 3, '#5aa469');
    rect(g, table.x + 15, table.y - 5, 1, 2, '#5aa469');
    // a picture on the wall: a tiny landscape; it swings when touched
    const sw = Math.round(swing * 3);
    for (let r = 0; r < picture.h; r++) {
      const off = Math.round((sw * r) / picture.h);
      const y = picture.y + r;
      rect(g, picture.x + off, y, picture.w, 1, '#c9a050');
      if (r === 0 || r === picture.h - 1) continue;
      rect(g, picture.x + off + 1, y, picture.w - 2, 1, r < 6 ? '#8cbfe8' : r < 8 ? '#7cc06a' : '#5f9f58');
      if (r === 3) rect(g, picture.x + off + 11, y, 2, 1, '#fff2b8');
      if (r === 6) rect(g, picture.x + off + 4, y, 3, 1, '#5f9f58');
    }
    line(g, picture.x + picture.w / 2, picture.y - 4, picture.x + 2, picture.y, '#1e1a30');
    line(g, picture.x + picture.w / 2, picture.y - 4, picture.x + picture.w - 3, picture.y, '#1e1a30');
    // the clock, with its pendulum, telling the real time
    disc(g, clock.x, clock.y, 7, '#5a3a28');
    disc(g, clock.x, clock.y, 5, '#efe3c8');
    const d = new Date();
    const hA = ((d.getHours() % 12) + d.getMinutes() / 60) * (Math.PI / 6) - Math.PI / 2;
    const mA = d.getMinutes() * (Math.PI / 30) - Math.PI / 2;
    line(g, clock.x, clock.y, clock.x + Math.round(Math.cos(hA) * 2.5), clock.y + Math.round(Math.sin(hA) * 2.5), '#2a2030');
    line(g, clock.x, clock.y, clock.x + Math.round(Math.cos(mA) * 4), clock.y + Math.round(Math.sin(mA) * 4), '#2a2030');
    rect(g, clock.x - 3, clock.y + 7, 7, 14, '#5a3a28');
    rect(g, clock.x - 2, clock.y + 8, 5, 12, '#2a1e18');
    const pa = Math.sin(t * Math.PI) * 0.35;
    const px = clock.x + Math.round(Math.sin(pa) * 9);
    const py = clock.y + 8 + Math.round(Math.cos(pa) * 9);
    line(g, clock.x, clock.y + 8, px, py, '#c9a050');
    disc(g, px, py, 1, '#e8c060');
    // a runner on the floor, leading to the door
    for (let y = floorY + 3; y < H; y++) {
      const k = (y - floorY) / (H - floorY);
      const a = Math.round(dxL - 4 - k * 26);
      const b = Math.round(dxR - 2 + k * 6);
      rect(g, a, y, b - a, 1, (y - floorY) % 6 === 0 ? '#c8a050' : '#7a2e34');
      rect(g, a, y, 1, 1, '#c8a050');
      rect(g, b - 1, y, 1, 1, '#c8a050');
      if ((y - floorY) % 6 === 3) for (let x = a + 3; x < b - 3; x += 4) rect(g, x, y, 2, 1, '#9a4a3a');
    }
    // a shelf with books and a plant over the table
    const sx = table.x - 6;
    const sy = picture.y - 16;
    rect(g, sx, sy, 34, 2, '#6a4a32');
    rect(g, sx + 2, sy + 2, 2, 3, '#4a3424');
    rect(g, sx + 30, sy + 2, 2, 3, '#4a3424');
    const books = ['#d9534f', '#4a8fd0', '#e8a23a', '#5aa469', '#8a63c9', '#e8e0c8', '#3fb8b0'];
    let bx = sx + 2;
    for (let i = 0; i < 7; i++) {
      const bh = 6 + Math.floor(hash(i, 50) * 3);
      rect(g, bx, sy - bh, 2, bh, books[i]);
      rect(g, bx, sy - bh + 2, 2, 1, mix(books[i], '#ffffff', 0.3));
      bx += 2 + (i === 3 ? 1 : 0);
    }
    rect(g, sx + 24, sy - 4, 5, 4, '#b8552a');
    for (let i = 0; i < 4; i++) rect(g, sx + 23 + i * 2, sy - 7 - (i % 2) * 2, 1, 3 + (i % 2) * 2, '#5aa469');
    // a coat rack by the door
    const cx = dxL - 40;
    rect(g, cx, floorY - 40, 1, 40, '#4a3424');
    rect(g, cx - 3, floorY - 1, 7, 1, '#4a3424');
    rect(g, cx - 3, floorY - 40, 7, 1, '#4a3424');
    rect(g, cx - 4, floorY - 38, 4, 14, '#7a3a3a');
    rect(g, cx - 4, floorY - 38, 4, 1, '#9a4a4a');
    rect(g, cx + 1, floorY - 43, 5, 3, '#2f3a5a');
    rect(g, cx, floorY - 40, 7, 1, '#2f3a5a');
  }

  function doorway(g: CanvasRenderingContext2D): void {
    const xf = Math.round(freeEdge());
    const e = bulge();
    // the town outside, through the gap
    if (xf > dxL) {
      const sy = town.ground + 2 - floorY;
      const sx = Math.round(env.par * 10);
      g.drawImage(out, dxL + sx, dTop + sy, xf - dxL, dh, dxL, dTop, xf - dxL, dh);
    }
    // the frame
    rect(g, dxL - 4, dTop - 4, dw + 8, 4, '#4a3424');
    rect(g, dxL - 4, dTop - 4, 4, dh + 4, '#4a3424');
    rect(g, dxR, dTop - 4, 4, dh + 4, '#4a3424');
    rect(g, dxL - 4, dTop - 4, dw + 8, 1, '#5e4430');
    rect(g, dxL - 1, dTop, 1, dh, '#2a1e18');
    rect(g, dxL - 2, floorY, dw + 4, 2, '#6a4a32');
    // the leaf, hinged on the right, swung toward us
    const base = mix('#5a3a28', '#2a1c14', Math.min(1, angle * 0.7));
    for (let x = xf; x < dxR; x++) {
      const k = (dxR - x) / Math.max(1, dxR - xf);
      const top = Math.round(dTop - e * k * 0.6);
      const bot = Math.round(floorY + e * k * 0.5);
      rect(g, x, top, 1, bot - top, base);
      if ((k > 0.15 && k < 0.19) || (k > 0.81 && k < 0.86)) {
        rect(g, x, top + 6, 1, (bot - top) * 0.4, '#3a2618');
        rect(g, x, top + 8 + (bot - top) * 0.45, 1, (bot - top) * 0.35, '#3a2618');
      }
      if (k > 0.76 && k < 0.84) rect(g, x, Math.round((top + bot) / 2), 1, 2, '#e8c060');
      // the edge catches the light
      if (x === xf) rect(g, x, top, 1, bot - top, mix(beam, '#5a3a28', 0.4));
    }
  }

  function light(g: CanvasRenderingContext2D, t: number, dt: number): void {
    const xf = freeEdge();
    const gap = Math.max(0, xf - dxL);
    // the beam on the floor, widening toward us
    if (gap > 0) {
      const spread = (H - floorY) * 0.9;
      g.fillStyle = beam;
      for (let y = floorY + 2; y < H; y++) {
        const k = (y - floorY) / (H - floorY);
        const a = dxL - spread * k * 0.9;
        const b = xf + spread * k * 0.25;
        g.globalAlpha = (0.16 + 0.1 * Math.min(1, gap / 20)) * (1 - k * 0.5);
        for (let x = Math.round(a); x < b; x++) if (((x + y) & 1) === 0 || k < 0.3) g.fillRect(x, y, 1, 1);
      }
      g.globalAlpha = 1;
      soft(g, dxL + gap / 2, floorY - dh / 2, Math.round(12 + gap * 1.2), beam, 0.025, 5);
    }
    // the lamp's warm pool
    if (lamp) {
      soft(g, table.x + 9, table.y - 8, 30, '#f6b347', 0.03, 6);
    }
    // dust turning in the beam
    for (const m of motes) {
      m.x += (m.vx + Math.sin(t * 0.5 + m.p) * 1.2) * dt;
      m.y += (m.vy + Math.cos(t * 0.4 + m.p) * 0.8) * dt;
      m.vx *= 0.96;
      m.vy *= 0.96;
      if (m.x < dxL - 50 || m.x > dxR + 20 || m.y < dTop - 10 || m.y > H) {
        m.x = dxL + Math.random() * Math.max(4, gap);
        m.y = dTop + Math.random() * dh;
      }
      const inBeam = gap > 1 && m.x > dxL - Math.max(0, m.y - floorY) * 0.8 && m.x < xf + 4;
      if (!inBeam) continue;
      g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + m.p);
      rect(g, m.x, m.y, 1, 1, '#fff6dc');
      g.globalAlpha = 1;
    }
    const flood = enterAt >= 0 ? Math.min(1, (t - enterAt) / 1.4) : 0;
    if (flood > 0) {
      g.globalAlpha = flood * flood;
      rect(g, 0, 0, W, H, '#fff6dc');
      g.globalAlpha = 1;
    }
  }

  function drawCat(g: CanvasRenderingContext2D, t: number): void {
    if (cat.out > 0) return;
    const x = Math.round(cat.x);
    const y = floorY + 4;
    const c = '#1e1a26';
    rect(g, x, y - 6, 5, 6, c);
    rect(g, x + 1, y - 9, 4, 3, c);
    rect(g, x + 1, y - 10, 1, 1, c);
    rect(g, x + 4, y - 10, 1, 1, c);
    const tail = Math.floor(t * 1.2) % 4;
    rect(g, x - 1, y - 2, 1, 2, c);
    rect(g, x - 2 - (tail > 1 ? 1 : 0), y - 4 + (tail % 2), 1, 2, c);
    if (Math.floor(t * 0.5) % 6 !== 0) {
      rect(g, x + 2, y - 8, 1, 1, '#c8f060');
      rect(g, x + 4, y - 8, 1, 1, '#c8f060');
    }
  }

  function drawHero(g: CanvasRenderingContext2D, t: number, dt: number): void {
    if (!env.hero) return;
    const walking = Math.abs(heroAt.to - heroAt.x) > 0.5;
    if (walking) {
      const s = Math.sign(heroAt.to - heroAt.x);
      heroAt.x += s * Math.min(Math.abs(heroAt.to - heroAt.x), dt * 22);
      heroAt.dir = s > 0 ? 'right' : 'left';
    } else heroAt.dir = 'up';
    const layers = figureLayers(env.hero, heroAt.dir, walking ? 'walk' : 'idle', walking ? Math.floor(t * 8) % 4 : 0);
    rect(g, Math.round(heroAt.x) - 6, floorY + 6, 12, 2, '#1a120e');
    g.save();
    g.translate(Math.round(heroAt.x) - 16, floorY + 7 - 32);
    for (const l of layers) {
      g.fillStyle = l.color;
      g.fill(new Path2D(l.path));
    }
    g.restore();
  }

  return {
    frame(g, t, dt) {
      if (!dragFrom) target += (AJAR - target) * Math.min(1, dt * 0.6);
      if (enterAt >= 0) target = 1.45;
      const before = angle;
      angle += (target - angle) * Math.min(1, dt * 5);
      if (dt > 0 && Math.abs(angle - before) / dt > 0.5 && t - lastCreak > 0.25) {
        lastCreak = t;
        env.chimes.creak(Math.abs(angle - before) / dt);
      }
      swingV += (-swing * 30 - swingV * 2.2) * dt;
      swing += swingV * dt;
      // the cat goes out into the light when the door is wide, and comes back later
      if (cat.out < 0 && angle > 0.8 && !dragFrom) {
        cat.x += dt * 12;
        if (cat.x > dxL + 6) {
          cat.out = t;
          cat.back = t + 6 + Math.random() * 6;
        }
      } else if (cat.out > 0 && t > cat.back && angle > 0.15) {
        cat.out = -1;
        cat.x = dxL + 4;
      } else if (cat.out < 0 && cat.x > dxL - 9) cat.x -= dt * 8;

      town.draw(og, outLook, t, dt, 0);
      wall(g);
      furniture(g, t);
      doorway(g);
      drawCat(g, t);
      drawHero(g, t, dt);
      light(g, t, dt);
      if (t - strike < 1.4) {
        g.globalAlpha = Math.max(0, 1 - (t - strike) / 1.4) * 0.5;
        glow(g, clock.x, clock.y, 10, '#ffe7b0', 1);
        g.globalAlpha = 1;
      }
    },
    down(x) {
      if (enterAt >= 0) return;
      dragFrom = { x, a: target };
    },
    move(x) {
      if (!dragFrom) return;
      target = Math.max(0.05, Math.min(1.35, dragFrom.a + (x - dragFrom.x) * 0.025));
      for (const m of motes) if (Math.hypot(m.x - x, m.y - (floorY - 20)) < 18) m.vx += (m.x - x) * 2;
    },
    up() {
      dragFrom = null;
    },
    tap(x, y, t) {
      if (enterAt >= 0) return;
      dragFrom = null;
      if (x > table.x - 4 && x < table.x + 22 && y > table.y - 14 && y < table.y + 2) {
        lamp = !lamp;
        env.chimes.click();
      } else if (x > picture.x - 2 && x < picture.x + picture.w + 2 && y > picture.y - 4 && y < picture.y + picture.h + 2) {
        swingV += 4;
        env.chimes.bell(3, 0.08);
      } else if (Math.hypot(x - clock.x, y - clock.y) < 9 || (Math.abs(x - clock.x) < 5 && y > clock.y && y < clock.y + 22)) {
        strike = t;
        const hours = new Date().getHours() % 12 || 12;
        for (let i = 0; i < Math.min(hours, 6); i++) window.setTimeout(() => env.chimes.bell(0, 0.14), i * 450);
      } else if (cat.out < 0 && Math.abs(x - cat.x - 2) < 6 && y > floorY - 8 && y < floorY + 8) {
        env.chimes.meow();
      } else if (x > dxL && x < freeEdge() && y > dTop && y < floorY) {
        // a touch in the gap: the dust swirls and the draught pushes the door a little
        target = Math.min(1.2, target + 0.25);
        for (const m of motes) {
          m.vx += (Math.random() - 0.5) * 30;
          m.vy += (Math.random() - 0.5) * 30;
        }
        env.chimes.whoosh(0.06, 0.6);
      } else if (y > floorY - 4 && env.hero) {
        heroAt.to = Math.max(10, Math.min(dxL - 10, x));
      }
    },
    enter(t) {
      enterAt = t;
      if (env.hero) heroAt.to = dxL - 10;
      env.chimes.creak(2);
      env.chimes.whoosh(0.16, 1.6);
      window.setTimeout(() => env.chimes.chord([0, 4, 7, 9], 0.12), 500);
      return 1.8;
    },
  };
}
