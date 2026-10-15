// How the hero feels the air, shown by the screen itself and never by a bar or a number: frost creeping in from
// the edges and a cold blue light when one is freezing, a golden glow by the stove or a fire, the air shimmering
// and the light burning white in the summer heat, raindrops on the "lens" when one is wet through. Everything
// eases in and out slowly; with reduced motion the drops and the shimmer stand still.

import { motionReduced } from '../a11y';
import type { ComfortView } from '../engine';

interface Drop {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** A small deterministic noise for laying out the frost the same way each time. */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class FeelLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** The eased strength of each feeling, 0..1. */
  private cold = 0;
  private heat = 0;
  private hearth = 0;
  private wet = 0;
  private target = { cold: 0, heat: 0, hearth: 0, wet: 0 };
  /** Frost at three depths: the edge first, then deeper as the cold bites. */
  private frost: HTMLCanvasElement[] = [];
  private frostSize = '';
  private drops: Drop[] = [];
  private t = 0;
  /** Motion held back (the settings, or the system's wish): drops and shimmer stand still. */
  private get reduced(): boolean {
    return motionReduced();
  }

  /** Laid right over the scene (`scene`), under the hud and the sheets. */
  constructor(scene: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'feel-layer';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    scene.insertAdjacentElement('afterend', this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    for (let i = 0; i < 26; i++) this.drops.push({ x: rnd(i * 3), y: rnd(i * 3 + 1), r: 3 + rnd(i * 3 + 2) * 7, speed: 0.004 + rnd(i + 50) * 0.02, phase: rnd(i + 90) * 6 });
  }

  /** What the hero feels now (null: nothing, e.g. at home in the editor). */
  set(c: ComfortView | null): void {
    if (!c) {
      this.target = { cold: 0, heat: 0, hearth: 0, wet: 0 };
      return;
    }
    this.target = {
      cold: c.feel < 0 ? -c.feel / 3 : 0,
      heat: c.feel > 0 && !c.hearth ? c.feel / 3 : 0,
      hearth: c.hearth ? 1 : 0,
      wet: c.wet ? 1 : 0,
    };
  }

  /** The strengths now (for tests). */
  state(): { cold: number; heat: number; hearth: number; wet: number } {
    return { cold: this.cold, heat: this.heat, hearth: this.hearth, wet: this.wet };
  }

  /** Jump straight to the target (on entering a place, for a photo). */
  settle(): void {
    Object.assign(this, this.target);
  }

  draw(dt: number): void {
    this.t += dt;
    // a feeling comes on over several seconds and leaves a little faster
    const ease = (v: number, to: number) => (to > v ? Math.min(to, v + dt * 0.12) : Math.max(to, v - dt * 0.25));
    this.cold = ease(this.cold, this.target.cold);
    this.heat = ease(this.heat, this.target.heat);
    this.hearth = ease(this.hearth, this.target.hearth);
    this.wet = ease(this.wet, this.target.wet);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const idle = this.cold < 0.01 && this.heat < 0.01 && this.hearth < 0.01 && this.wet < 0.01;
    this.canvas.style.display = idle ? 'none' : '';
    if (idle || !w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.cold > 0.01) this.drawCold(w, h);
    if (this.hearth > 0.01) this.drawHearth(w, h);
    if (this.heat > 0.01) this.drawHeat(w, h);
    if (this.wet > 0.01) this.drawWet(w, h);
  }

  private drawCold(w: number, h: number): void {
    const ctx = this.ctx;
    const k = this.cold;
    // a cold blue light, deeper at the edges
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, `rgba(150,190,235,${0.04 * k})`);
    g.addColorStop(1, `rgba(120,165,225,${0.32 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    this.ensureFrost(w, h);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 3; i++) {
      const a = clamp01(k * 3 - i);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(this.frost[i], 0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /** Ice crystals growing in from the edges, drawn small and scaled up so they stay pixel-crisp. */
  private ensureFrost(w: number, h: number): void {
    const size = `${w}x${h}`;
    if (this.frostSize === size) return;
    this.frostSize = size;
    const s = 3;
    const cw = Math.ceil(w / s);
    const ch = Math.ceil(h / s);
    this.frost = [0, 1, 2].map((depth) => {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const x = c.getContext('2d')!;
      const reach = [0.07, 0.15, 0.26][depth] * Math.min(cw, ch);
      // a white rime along the edges
      const g = (x0: number, y0: number, x1: number, y1: number) => {
        const lg = x.createLinearGradient(x0, y0, x1, y1);
        lg.addColorStop(0, `rgba(240,248,255,${0.55 - depth * 0.12})`);
        lg.addColorStop(1, 'rgba(240,248,255,0)');
        return lg;
      };
      const r = reach * 0.6;
      x.fillStyle = g(0, 0, r, 0);
      x.fillRect(0, 0, r, ch);
      x.fillStyle = g(cw, 0, cw - r, 0);
      x.fillRect(cw - r, 0, r, ch);
      x.fillStyle = g(0, 0, 0, r);
      x.fillRect(0, 0, cw, r);
      x.fillStyle = g(0, ch, 0, ch - r);
      x.fillRect(0, ch - r, cw, r);
      // feathery crystals: branches growing inward from points along the edge, each with side twigs
      x.lineCap = 'square';
      const n = Math.round((cw + ch) / 9);
      for (let i = 0; i < n; i++) {
        const seed = i * 7 + depth * 1000;
        const along = rnd(seed);
        const edge = Math.floor(rnd(seed + 1) * 4);
        const [sx, sy, dx, dy] = edge === 0 ? [along * cw, 0, 0, 1] : edge === 1 ? [along * cw, ch, 0, -1] : edge === 2 ? [0, along * ch, 1, 0] : [cw, along * ch, -1, 0];
        const len = reach * (0.5 + rnd(seed + 2) * 0.8);
        const tilt = (rnd(seed + 3) - 0.5) * 1.1;
        const ang = Math.atan2(dy, dx) + tilt;
        branch(x, sx, sy, ang, len, 3, seed, depth);
      }
      return c;
    });
  }

  private drawHearth(w: number, h: number): void {
    const ctx = this.ctx;
    const k = this.hearth;
    const flicker = this.reduced ? 1 : 0.85 + 0.15 * Math.sin(this.t * 7.3) * Math.sin(this.t * 2.9 + 1);
    const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.2, w / 2, h * 0.55, Math.max(w, h) * 0.8);
    g.addColorStop(0, `rgba(255,190,110,${0.1 * k})`);
    g.addColorStop(1, `rgba(255,140,60,${0.42 * k * flicker})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawHeat(w: number, h: number): void {
    const ctx = this.ctx;
    const k = this.heat;
    // the light burns white at the top, a warm haze over everything
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(255,248,215,${0.5 * k})`);
    g.addColorStop(0.5, `rgba(255,225,160,${0.16 * k})`);
    g.addColorStop(1, `rgba(255,200,120,${0.24 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // the shimmer: soft wavering bands rising over the ground
    if (this.reduced) return;
    ctx.strokeStyle = `rgba(255,255,255,${0.12 * k})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const y0 = h - (((this.t * 18 + i * (h / 9)) % h) | 0);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = y0 + Math.sin(x * 0.03 + this.t * 3 + i) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private drawWet(w: number, h: number): void {
    const ctx = this.ctx;
    const k = this.wet;
    for (const d of this.drops) {
      const y = this.reduced ? d.y : (d.y + this.t * d.speed * 0.25 + Math.sin(this.t * 0.7 + d.phase) * 0.002) % 1;
      const x = d.x * w;
      const yy = y * h;
      const r = d.r * Math.min(1.6, w / 600 + 0.6);
      ctx.fillStyle = `rgba(200,225,250,${0.16 * k})`;
      ctx.beginPath();
      ctx.ellipse(x, yy, r * 0.8, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.32 * k})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.55 * k})`;
      ctx.fillRect(x - r * 0.35, yy - r * 0.5, Math.max(1, r * 0.25), Math.max(1, r * 0.25));
    }
  }
}

function branch(x: CanvasRenderingContext2D, sx: number, sy: number, ang: number, len: number, level: number, seed: number, depth: number): void {
  const ex = sx + Math.cos(ang) * len;
  const ey = sy + Math.sin(ang) * len;
  x.strokeStyle = `rgba(238,248,255,${0.62 + level * 0.1 - depth * 0.06})`;
  x.lineWidth = level >= 3 ? 1.6 : level === 2 ? 1.2 : 1;
  x.beginPath();
  x.moveTo(sx, sy);
  x.lineTo(ex, ey);
  x.stroke();
  if (level <= 0) return;
  const twigs = 2 + Math.floor(rnd(seed + 5) * 3);
  for (let i = 1; i <= twigs; i++) {
    const t = i / (twigs + 1);
    const px = sx + (ex - sx) * t;
    const py = sy + (ey - sy) * t;
    const side = i % 2 === 0 ? 1 : -1;
    branch(x, px, py, ang + side * (0.75 + rnd(seed + i) * 0.35), len * (0.42 - t * 0.18), level - 1, seed * 3 + i, depth);
  }
}
