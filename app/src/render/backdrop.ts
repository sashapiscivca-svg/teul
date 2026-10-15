// What lies around the room: sky and scenery behind it, weather in front of it.

import { lerpColor, type Daylight } from '../daylight';
import { shade } from '../models';
import { hash2 } from './surfaces';

export const BACKDROP_KINDS = ['void', 'sky', 'forest', 'city', 'sea', 'mountains', 'space'] as const;
export const WEATHER_KINDS = ['none', 'rain', 'snow', 'fog', 'fireflies', 'petals'] as const;

function dim(color: string, dl: Daylight, strength = 0.62): string {
  return shade(color, 1 - dl.dark * strength);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow: string): void {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.2, 0.8], [-0.9, 0.25, 0.75], [0.3, -0.35, 0.8]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, kind: string, dl: Daylight, t: number): void {
  const horizon = h * 0.64;
  if (kind === 'void' || !BACKDROP_KINDS.includes(kind as (typeof BACKDROP_KINDS)[number])) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, lerpColor('#0e1018', dl.sky, 0.12));
    g.addColorStop(1, lerpColor('#171a28', dl.sky, 0.08));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (kind === 'space') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05060f');
    g.addColorStop(1, '#14102a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const neb = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.5);
    neb.addColorStop(0, 'rgba(120,70,200,0.28)');
    neb.addColorStop(1, 'rgba(120,70,200,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + hash2(i, 1, 9)) + i);
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * hash2(i, 2, 9) * tw})`;
      const s = 0.6 + hash2(i, 3, 9) * 1.4;
      ctx.fillRect(hash2(i, 4, 9) * w, hash2(i, 5, 9) * h, s, s);
    }
    disc(ctx, w * 0.16, h * 0.24, Math.min(w, h) * 0.07, '#8fb0ff', 'rgba(143,176,255,0.25)');
    return;
  }
  // sky for the other scenes
  const top = dim(shade(dl.sky, 0.85), dl, 0.2);
  const low = lerpColor(dl.sky, '#ffffff', 0.32 * (1 - dl.dark));
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, top);
  sky.addColorStop(1, low);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (dl.dark > 0.5) {
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${(dl.dark - 0.4) * (0.3 + 0.5 * hash2(i, 1, 4))})`;
      ctx.fillRect(hash2(i, 2, 4) * w, hash2(i, 3, 4) * horizon * 0.9, 1.2, 1.2);
    }
  }
  const sunUp = dl.dark < 0.55;
  if (sunUp) disc(ctx, w * 0.8, h * (0.16 + 0.1 * dl.dark), Math.min(w, h) * 0.055, '#fff3c4', 'rgba(255,230,160,0.35)');
  else disc(ctx, w * 0.2, h * 0.17, Math.min(w, h) * 0.04, '#eef0ff', 'rgba(200,210,255,0.25)');

  if (kind === 'sky' || kind === 'mountains' || kind === 'sea') {
    for (let i = 0; i < 4; i++) {
      const x = ((hash2(i, 1, 6) * w * 1.3 + t * (6 + i * 2)) % (w * 1.3)) - w * 0.15;
      cloud(ctx, x, h * (0.12 + hash2(i, 2, 6) * 0.22), h * (0.05 + hash2(i, 3, 6) * 0.03), `rgba(255,255,255,${0.5 - dl.dark * 0.3})`);
    }
  }
  if (kind === 'sky') {
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, dim('#d9ecff', dl, 0.5));
    ground.addColorStop(1, dim('#9fc4ea', dl, 0.5));
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);
  } else if (kind === 'forest') {
    const layers = [{ c: '#2f6b4a', dy: 0, n: 16, s: 1.15 }, { c: '#235a3e', dy: 0.05, n: 13, s: 1.35 }, { c: '#184a32', dy: 0.1, n: 10, s: 1.7 }];
    layers.forEach((layer, li) => {
      ctx.fillStyle = dim(layer.c, dl);
      for (let i = 0; i < layer.n; i++) {
        const x = ((i + hash2(i, li, 2) * 0.8) / layer.n) * w * 1.1 - w * 0.05;
        const th = h * (0.16 + 0.1 * hash2(i, li, 3)) * layer.s;
        const base = horizon + h * layer.dy + h * 0.2;
        const tw = th * 0.5;
        for (let k = 0; k < 3; k++) {
          const y = base - th * (0.34 * k);
          const sw = tw * (1 - k * 0.22);
          ctx.beginPath();
          ctx.moveTo(x - sw, y);
          ctx.lineTo(x, y - th * 0.5);
          ctx.lineTo(x + sw, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    });
    ctx.fillStyle = dim('#12341f', dl);
    ctx.fillRect(0, horizon + h * 0.22, w, h);
  } else if (kind === 'city') {
    const skyline = [{ c: '#4b5575', n: 22, hs: 0.22, dy: 0 }, { c: '#343c58', n: 16, hs: 0.3, dy: 0.06 }];
    skyline.forEach((row, ri) => {
      for (let i = 0; i < row.n; i++) {
        const bw = (w / row.n) * (0.9 + hash2(i, ri, 5) * 0.6);
        const bx = (i / row.n) * w * 1.05 - 6;
        const bh = h * row.hs * (0.5 + hash2(i, ri, 6) * 0.9);
        const by = horizon + h * (0.2 + row.dy) - bh;
        ctx.fillStyle = dim(row.c, dl, 0.5);
        ctx.fillRect(bx, by, bw, bh + h);
        for (let wy = by + 5; wy < by + bh - 3; wy += 8) {
          for (let wx = bx + 3; wx < bx + bw - 3; wx += 7) {
            const lit = hash2(Math.floor(wx), Math.floor(wy), ri) > 0.55;
            ctx.fillStyle = lit && dl.dark > 0.35 ? `rgba(255,214,120,${0.4 + dl.dark * 0.5})` : 'rgba(255,255,255,0.06)';
            ctx.fillRect(wx, wy, 2.6, 3.4);
          }
        }
      }
    });
  } else if (kind === 'sea') {
    const sea = ctx.createLinearGradient(0, horizon * 0.92, 0, h);
    sea.addColorStop(0, dim('#5aa6d6', dl, 0.5));
    sea.addColorStop(1, dim('#1c4f86', dl, 0.5));
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon * 0.92, w, h);
    ctx.strokeStyle = `rgba(255,255,255,${0.22 - dl.dark * 0.12})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const y = horizon * 0.95 + (hash2(i, 1, 7) * (h - horizon * 0.95));
      const x = hash2(i, 2, 7) * w;
      const len = 18 + hash2(i, 3, 7) * 40;
      const o = Math.sin(t * 0.8 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(x + o, y);
      ctx.lineTo(x + len + o, y);
      ctx.stroke();
    }
  } else if (kind === 'mountains') {
    const ridges = [{ c: '#6d7fa3', amp: 0.2, f: 0.9, dy: 0 }, { c: '#516289', amp: 0.26, f: 0.6, dy: 0.06 }, { c: '#3a4a6d', amp: 0.3, f: 1.1, dy: 0.12 }];
    ridges.forEach((r, ri) => {
      ctx.fillStyle = dim(r.c, dl, 0.55);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) {
        const y = horizon + h * r.dy + h * 0.1 - Math.abs(Math.sin(x * 0.006 * r.f + ri * 2)) * h * r.amp - Math.sin(x * 0.02 + ri) * 4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });
  }
}

export function drawWeather(ctx: CanvasRenderingContext2D, w: number, h: number, kind: string, dl: Daylight, t: number): void {
  ctx.save();
  if (kind === 'rain') {
    ctx.strokeStyle = `rgba(180,210,255,${0.45 - dl.dark * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 130; i++) {
      const sp = 0.7 + hash2(i, 1, 11) * 0.6;
      const x = (hash2(i, 2, 11) * (w + 80) - t * 90 * sp + (w + 80) * 10) % (w + 80);
      const y = (hash2(i, 3, 11) * h + t * 620 * sp) % h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 15);
    }
    ctx.stroke();
  } else if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 90; i++) {
      const sp = 0.4 + hash2(i, 1, 12) * 0.6;
      const x = (hash2(i, 2, 12) * w + Math.sin(t * sp + i) * 14 + w * 5) % w;
      const y = (hash2(i, 3, 12) * h + t * 38 * sp) % h;
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash2(i, 4, 12) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'fog') {
    for (let i = 0; i < 3; i++) {
      const y = h * (0.35 + i * 0.22) + Math.sin(t * 0.2 + i) * 14;
      const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
      g.addColorStop(0, 'rgba(235,240,250,0)');
      g.addColorStop(0.5, `rgba(235,240,250,${0.2 - dl.dark * 0.08})`);
      g.addColorStop(1, 'rgba(235,240,250,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 60, w, 120);
    }
  } else if (kind === 'fireflies') {
    for (let i = 0; i < 26; i++) {
      const x = hash2(i, 1, 13) * w + Math.sin(t * 0.5 + i * 2) * 26;
      const y = h * 0.4 + hash2(i, 2, 13) * h * 0.55 + Math.cos(t * 0.4 + i) * 16;
      const a = (0.25 + 0.75 * Math.max(0, Math.sin(t * 1.4 + i * 3))) * Math.min(1, 0.25 + dl.dark);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, `rgba(220,255,140,${a})`);
      g.addColorStop(1, 'rgba(220,255,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 9, y - 9, 18, 18);
    }
  } else if (kind === 'petals') {
    for (let i = 0; i < 40; i++) {
      const sp = 0.5 + hash2(i, 1, 14);
      const x = (hash2(i, 2, 14) * w + t * 22 * sp + Math.sin(t + i) * 12 + w * 5) % w;
      const y = (hash2(i, 3, 14) * h + t * 30 * sp) % h;
      ctx.fillStyle = hash2(i, 4, 14) > 0.5 ? 'rgba(255,190,210,0.85)' : 'rgba(255,225,235,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3, 1.6, t + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
