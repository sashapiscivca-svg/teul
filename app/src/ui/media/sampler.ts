// The instruments' recorded notes (app/public/music/kit/*.ogg, crates/teul-music sprites.rs) played through Web
// Audio: a note is a slice of the sprite, bent by up to a semitone and a half to the key wanted. A performance
// is scheduled a little ahead at a time so it can be stopped at once. The audio context is the game's: when the
// app goes to the background it is suspended, and the music with it.

import type { Performance, Sounded } from './arrange';
import { KITS, sampleFor, type Kit, type KitId } from './kits';

export interface AudioOut {
  ctx: AudioContext;
  out: AudioNode;
}

const buffers = new Map<KitId, Promise<AudioBuffer | null>>();

function load(out: AudioOut, kit: Kit, base: string): Promise<AudioBuffer | null> {
  let p = buffers.get(kit.id);
  if (!p) {
    p = fetch(`${base}music/kit/${kit.id}.ogg`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => out.ctx.decodeAudioData(data))
      .catch(() => null);
    buffers.set(kit.id, p);
  }
  return p;
}

/** Whether the note keeps sounding while held (bowed, blown, pumped) rather than dying away (struck, plucked). */
const SUSTAINED = new Set<KitId>(['violin', 'accordion', 'sopilka']);

export class Sampler {
  private buffer: AudioBuffer | null = null;
  private timer = 0;
  private live: AudioScheduledSourceNode[] = [];
  private onNote: ((n: Sounded) => void) | null = null;

  constructor(
    private readonly out: AudioOut,
    readonly kit: Kit,
    private readonly base: string = import.meta.env?.BASE_URL ?? '/',
  ) {}

  static of(out: AudioOut, id: KitId): Sampler {
    return new Sampler(out, KITS[id]);
  }

  async ready(): Promise<boolean> {
    this.buffer = await load(this.out, this.kit, this.base);
    return !!this.buffer;
  }

  /** One note now (or `at` seconds from now), for `len` seconds. */
  note(key: number, len = 0.6, vel = 0.8, at = 0): void {
    const buf = this.buffer;
    const ctx = this.out.ctx;
    if (!buf) return;
    const { index, rate } = sampleFor(this.kit, key);
    const when = ctx.currentTime + Math.max(0, at);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const peak = 0.15 + 0.85 * vel;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.006);
    const sustain = SUSTAINED.has(this.kit.id);
    const ring = sustain ? Math.min(len, this.kit.slot - 0.35) : Math.min(this.kit.slot - 0.2, len + 0.9);
    const stop = when + Math.max(0.12, ring) / 1;
    // a sustained note lets go when it ends; a plucked one rings a while and is damped
    g.gain.setValueAtTime(peak * (sustain ? 0.9 : 0.55), Math.max(when + 0.02, stop - 0.2));
    g.gain.linearRampToValueAtTime(0.0001, stop + 0.12);
    src.connect(g).connect(this.out.out);
    const offset = index * this.kit.slot;
    src.start(when, offset, (stop + 0.15 - when) * rate);
    src.stop(stop + 0.2);
    this.live.push(src);
    src.onended = () => {
      this.live = this.live.filter((s) => s !== src);
    };
  }

  /** Plays a performance; `onNote` is told each note as it sounds, `done` when it is over (not when stopped).
   * The piece keeps the wall clock: while sound is not allowed or the app is hidden it goes on silently, and
   * nothing piles up to burst out when sound comes back. */
  play(p: Performance, onNote: (n: Sounded) => void, done: () => void): void {
    this.stop();
    this.onNote = onNote;
    const ctx = this.out.ctx;
    const start = performance.now() + 150;
    let next = 0;
    let told = 0;
    const tick = () => {
      const now = (performance.now() - start) / 1000;
      while (next < p.notes.length && p.notes[next].t < now + 0.35) {
        const n = p.notes[next];
        const at = n.t - now;
        if (ctx.state === 'running' && at > -0.05) this.note(n.key, n.len, n.vel, Math.max(0, at));
        next++;
      }
      while (told < p.notes.length && p.notes[told].t <= now) this.onNote?.(p.notes[told++]);
      if (now >= p.secs) {
        this.halt();
        done();
      }
    };
    this.timer = window.setInterval(tick, 40);
    tick();
  }

  private halt(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.onNote = null;
  }

  playing(): boolean {
    return this.timer !== 0;
  }

  /** Stops whatever is sounding. */
  stop(): void {
    this.halt();
    const t = this.out.ctx.currentTime;
    for (const s of this.live) {
      try {
        s.stop(t + 0.05);
      } catch {
        // already ended
      }
    }
    this.live = [];
  }
}
