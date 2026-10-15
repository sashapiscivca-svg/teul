// What happens in the sky (and in the dark), painted over the scene on a canvas of its own: the eclipse dimming the
// afternoon with the sun turned to a sickle, meteors streaking a night tinted to sky, a comet's tail, the visitors'
// saucer over the pasture with its beam and a cow going up into it; on the eerie nights the red moon, the lights
// going out and the black when they catch you. The view is from above, so the sky is drawn the way weather is: over
// the picture, mostly at its top.

export interface FxState {
  /** Seconds, for animation. */
  t: number;
  dt: number;
  /** Dark enough for the night sky (0..1). */
  night: number;
  eclipse?: { now: number; cover: number } | null;
  meteors?: { rate: number } | null;
  comet?: { bright: number } | null;
  /** The saucer: where on screen the pasture is, the phase, and how far the cow has risen (0..1). */
  ufo?: { x: number; y: number; phase: number; lift: number } | null;
  /** The eerie night: how dark it has gone, the red moon, and the black. */
  horror?: { dark: number; moon: boolean; blackout: number } | null;
  /** Warm light round torches carried at night (screen points). */
  glows?: { x: number; y: number; r: number }[];
  /** The town inside out, where the shader is not there to do it. */
  mirror?: boolean;
  /** No moving things (reduced motion). */
  still?: boolean;
}

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  len: number;
}

export class SkyFx {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private streaks: Streak[] = [];
  private flakes: { x: number; y: number; s: number }[] = [];
  private blank = true;

  constructor(after: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wonders-fx';
    this.canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    after.after(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  /** A handful of streaks at once (a burst of the shower; for photographs and tests). */
  burst(n: number): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    for (let i = 0; i < n; i++) {
      const sp = 500 + Math.random() * 300;
      this.streaks.push({ x: w * (0.2 + Math.random() * 0.8), y: h * (0.15 + Math.random() * 0.3), vx: -sp * 0.82, vy: sp * 0.55, life: 0.9 + Math.random() * 0.6, len: 70 + Math.random() * 110 });
    }
  }

  /** How many streaks are in the sky now (for tests). */
  get streaking(): number {
    return this.streaks.length;
  }

  draw(s: FxState): void {
    const any = !!(s.eclipse?.now || (s.meteors && s.night > 0.3) || (s.comet && s.night > 0.3) || s.ufo || s.horror || s.mirror || s.glows?.length);
    if (!any) {
      if (!this.blank) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.blank = true;
      }
      this.streaks = [];
      return;
    }
    this.blank = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    const w = cw;
    const h = ch;
    if (s.mirror) this.mirror(g, w, h, s);
    if ((s.meteors || s.comet) && s.night > 0.3) this.nightSky(g, w, h, s);
    if (s.comet && s.night > 0.3) this.comet(g, w, h, s.comet.bright / 100, s.t);
    if (s.meteors && s.night > 0.3) this.meteors(g, w, h, s);
    if (s.eclipse && s.eclipse.now > 0) this.eclipse(g, w, h, s.eclipse.now / 100, s.eclipse.cover / 100);
    if (s.ufo) this.ufo(g, s.ufo, s.t);
    if (s.horror) this.horror(g, w, h, s.horror, s.t);
    if (s.glows?.length) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const l of s.glows) {
        const fl = s.still ? 1 : 0.85 + 0.15 * Math.sin(s.t * 13 + l.x);
        const grad = g.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r * fl);
        grad.addColorStop(0, 'rgba(255,170,60,0.55)');
        grad.addColorStop(0.4, 'rgba(255,110,30,0.22)');
        grad.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = grad;
        g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      g.restore();
    }
  }

  private nightSky(g: CanvasRenderingContext2D, w: number, h: number, s: FxState): void {
    const grad = g.createLinearGradient(0, 0, 0, h * 0.45);
    grad.addColorStop(0, `rgba(8,12,40,${0.42 * s.night})`);
    grad.addColorStop(1, 'rgba(8,12,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h * 0.45);
    for (let i = 0; i < 60; i++) {
      const x = ((i * 7919) % 997) / 997 * w;
      const y = ((i * 104729) % 991) / 991 * h * 0.38;
      const tw = s.still ? 0.7 : 0.5 + 0.5 * Math.sin(s.t * 2 + i);
      g.fillStyle = `rgba(230,236,255,${0.55 * tw * s.night})`;
      g.fillRect(Math.round(x), Math.round(y), i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
    }
  }

  private meteors(g: CanvasRenderingContext2D, w: number, h: number, s: FxState): void {
    const rate = s.meteors?.rate ?? 1;
    if (!s.still && Math.random() < s.dt * (0.25 + rate * 0.55)) {
      const sp = 700 + Math.random() * 500;
      this.streaks.push({ x: w * (0.15 + Math.random() * 0.95), y: h * Math.random() * 0.3, vx: -sp * 0.82, vy: sp * 0.55, life: 0.5 + Math.random() * 0.4, len: 60 + Math.random() * 110 });
    }
    g.lineCap = 'round';
    for (const m of this.streaks) {
      m.x += m.vx * s.dt;
      m.y += m.vy * s.dt;
      m.life -= s.dt;
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / sp) * m.len;
      const ty = m.y - (m.vy / sp) * m.len;
      const grad = g.createLinearGradient(m.x, m.y, tx, ty);
      const a = Math.max(0, Math.min(1, m.life * 3));
      grad.addColorStop(0, `rgba(255,255,240,${a})`);
      grad.addColorStop(1, 'rgba(160,190,255,0)');
      g.strokeStyle = grad;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(m.x, m.y);
      g.lineTo(tx, ty);
      g.stroke();
    }
    this.streaks = this.streaks.filter((m) => m.life > 0);
  }

  private comet(g: CanvasRenderingContext2D, w: number, h: number, k: number, t: number): void {
    const x = w * 0.7;
    const y = h * 0.26;
    const len = 150 + 260 * k;
    g.save();
    g.translate(x, y);
    g.rotate(-0.45);
    const tail = g.createLinearGradient(0, 0, len, 0);
    tail.addColorStop(0, `rgba(210,240,255,${0.75 * k + 0.2})`);
    tail.addColorStop(1, 'rgba(120,180,255,0)');
    g.fillStyle = tail;
    g.beginPath();
    g.moveTo(0, -4);
    g.quadraticCurveTo(len * 0.5, -20 - 6 * Math.sin(t * 0.3), len, -40);
    g.lineTo(len, 26);
    g.quadraticCurveTo(len * 0.5, 12, 0, 4);
    g.fill();
    const head = g.createRadialGradient(0, 0, 0, 0, 0, 22);
    head.addColorStop(0, 'rgba(255,255,255,1)');
    head.addColorStop(1, 'rgba(160,220,255,0)');
    g.fillStyle = head;
    g.fillRect(-22, -22, 44, 44);
    g.restore();
  }

  private eclipse(g: CanvasRenderingContext2D, w: number, h: number, now: number, cover: number): void {
    g.fillStyle = `rgba(10,12,34,${Math.min(0.72, now * 0.9)})`;
    g.fillRect(0, 0, w, h);
    const x = w - 74;
    const y = 96;
    const r = 18;
    const glow = g.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2);
    glow.addColorStop(0, `rgba(255,236,190,${0.55 - now * 0.25})`);
    glow.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = glow;
    g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    g.fillStyle = '#fff4c8';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // the moon slides over it: at the greatest phase it covers as much as the eclipse gives here
    const off = 2 * r * (1 - Math.min(now, cover));
    g.fillStyle = '#141428';
    g.beginPath();
    g.arc(x + off, y - 2, r, 0, Math.PI * 2);
    g.fill();
  }

  private ufo(g: CanvasRenderingContext2D, u: NonNullable<FxState['ufo']>, t: number): void {
    const bob = Math.sin(t * 1.7) * 4;
    const sx = u.x + Math.sin(t * 0.6) * 6;
    const sy = Math.max(70, u.y - 95) + bob;
    if (u.phase === 2) {
      const beam = g.createLinearGradient(0, sy, 0, u.y);
      beam.addColorStop(0, 'rgba(200,255,220,0.55)');
      beam.addColorStop(1, 'rgba(200,255,220,0.15)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(sx - 12, sy + 6);
      g.lineTo(sx + 12, sy + 6);
      g.lineTo(u.x + 34, u.y + 8);
      g.lineTo(u.x - 34, u.y + 8);
      g.fill();
      // the cow, going up, slowly turning
      const cy = u.y - (u.y - sy - 16) * u.lift;
      const cx = u.x + (sx - u.x) * u.lift;
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.sin(t * 1.3) * 0.5 * u.lift);
      g.fillStyle = '#f4f1ea';
      g.fillRect(-11, -6, 22, 11);
      g.fillStyle = '#2a2420';
      g.fillRect(-6, -6, 6, 5);
      g.fillRect(3, -2, 5, 4);
      g.fillStyle = '#f4f1ea';
      g.fillRect(9, -9, 7, 7);
      g.fillStyle = '#e8a0a0';
      g.fillRect(13, -5, 3, 3);
      g.fillStyle = '#2a2420';
      for (const lx of [-9, -4, 4, 8]) g.fillRect(lx, 5, 2, 5);
      g.restore();
    }
    // the saucer
    g.fillStyle = '#9aa6b8';
    g.beginPath();
    g.ellipse(sx, sy, 30, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8f5ff';
    g.beginPath();
    g.ellipse(sx, sy - 6, 12, 8, 0, Math.PI, 0);
    g.fill();
    for (let i = 0; i < 6; i++) {
      const on = Math.floor(t * 6 + i) % 3 === 0;
      g.fillStyle = on ? '#ff5a7a' : '#ffe08a';
      g.fillRect(Math.round(sx - 24 + i * 9.5), Math.round(sy + 1), 3, 3);
    }
    if (u.phase === 1) {
      const glow = g.createRadialGradient(sx, sy, 4, sx, sy, 70);
      glow.addColorStop(0, 'rgba(200,255,230,0.35)');
      glow.addColorStop(1, 'rgba(200,255,230,0)');
      g.fillStyle = glow;
      g.fillRect(sx - 70, sy - 70, 140, 140);
    }
  }

  private horror(g: CanvasRenderingContext2D, w: number, h: number, s: NonNullable<FxState['horror']>, t: number): void {
    if (s.dark > 0) {
      g.fillStyle = `rgba(4,2,6,${s.dark * 0.62})`;
      g.fillRect(0, 0, w, h);
    }
    if (s.moon) {
      const x = 64;
      const y = 92;
      const glow = g.createRadialGradient(x, y, 10, x, y, 80);
      glow.addColorStop(0, 'rgba(190,30,20,0.45)');
      glow.addColorStop(1, 'rgba(190,30,20,0)');
      g.fillStyle = glow;
      g.fillRect(x - 80, y - 80, 160, 160);
      g.fillStyle = '#b3261e';
      g.beginPath();
      g.arc(x, y, 17, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(80,8,8,0.6)';
      g.fillRect(x - 6, y - 4, 5, 4);
      g.fillRect(x + 4, y + 3, 4, 3);
    }
    if (s.blackout > 0) {
      g.fillStyle = `rgba(0,0,0,${s.blackout})`;
      g.fillRect(0, 0, w, h);
      if (s.blackout > 0.9) {
        // muffled, as if under water: a dim red line of a heartbeat
        g.strokeStyle = 'rgba(120,10,10,0.6)';
        g.lineWidth = 2;
        g.beginPath();
        const y = h / 2;
        g.moveTo(w * 0.3, y);
        const k = (t * 0.8) % 1;
        g.lineTo(w * (0.3 + 0.18 * k), y);
        g.lineTo(w * (0.3 + 0.18 * k) + 6, y - 18);
        g.lineTo(w * (0.3 + 0.18 * k) + 12, y + 12);
        g.lineTo(w * (0.3 + 0.18 * k) + 18, y);
        g.lineTo(w * 0.7, y);
        g.stroke();
      }
    }
  }

  private mirror(g: CanvasRenderingContext2D, w: number, h: number, s: FxState): void {
    // the aurora and the snow falling up, without a shader
    for (let i = 0; i < 3; i++) {
      const grad = g.createLinearGradient(0, 0, 0, h * 0.35);
      grad.addColorStop(0, i % 2 ? 'rgba(190,90,255,0.22)' : 'rgba(70,255,170,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      for (let x = 0; x <= w; x += 24) g.lineTo(x, h * (0.16 + 0.08 * Math.sin(x / 90 + s.t * 0.3 + i * 2)));
      g.lineTo(w, 0);
      g.fill();
    }
    if (this.flakes.length === 0) for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random() * w, y: Math.random() * h, s: 20 + Math.random() * 40 });
    g.fillStyle = 'rgba(235,242,255,0.8)';
    for (const f of this.flakes) {
      if (!s.still) f.y -= f.s * s.dt;
      if (f.y < -4) {
        f.y = h + 4;
        f.x = Math.random() * w;
      }
      g.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
    }
  }
}
