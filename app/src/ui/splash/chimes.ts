// Small sounds for the title screens, made on the spot: a bell, a creak, a whoosh, a chirp, a meow.
// The title comes before the world's own sound is started, so it keeps a tiny audio context of its own,
// opened on the first touch (browsers allow sound only after one) and closed when the title is left.

export class Chimes {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;

  constructor(private readonly volume: number) {}

  /** Call from a touch. */
  wake(): void {
    if (this.ctx || this.volume <= 0) return;
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.out = this.ctx.createGain();
    this.out.gain.value = this.volume * 0.5;
    this.out.connect(this.ctx.destination);
    void this.ctx.resume();
  }

  close(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) window.setTimeout(() => void ctx.close(), 1500);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, glide?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, freq: number, q: number, vol: number, at = 0, to?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + at;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
  }

  /** A bell; `step` picks a note of a pentatonic scale, so any run of them sounds like a tune. */
  bell(step = 0, vol = 0.25): void {
    const scale = [0, 2, 4, 7, 9];
    const n = scale[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5);
    const f = 523.25 * Math.pow(2, n / 12);
    this.tone(f, 1.6, 'sine', vol);
    this.tone(f * 2.01, 0.8, 'sine', vol * 0.35);
    this.tone(f * 3.98, 0.4, 'triangle', vol * 0.12);
  }

  chord(steps: number[], vol = 0.16): void {
    steps.forEach((s, i) => window.setTimeout(() => this.bell(s, vol), i * 70));
  }

  creak(amount: number): void {
    const f = 180 + Math.random() * 120;
    this.tone(f, 0.18 + amount * 0.2, 'sawtooth', 0.025, 0, f * (0.8 + Math.random() * 0.5));
  }

  whoosh(vol = 0.2, dur = 1.2): void {
    this.noise(dur, 300, 0.8, vol, 0, 2400);
  }

  chirp(): void {
    for (let i = 0; i < 3; i++) this.tone(2400 + Math.random() * 900, 0.07, 'sine', 0.06, i * 0.09, 3400);
  }

  meow(): void {
    this.tone(620, 0.45, 'sawtooth', 0.04, 0, 470);
    this.noise(0.4, 900, 4, 0.03);
  }

  drip(): void {
    this.tone(900 + Math.random() * 400, 0.18, 'sine', 0.12, 0, 1800);
  }

  click(): void {
    this.noise(0.05, 2400, 2, 0.15);
  }
}
