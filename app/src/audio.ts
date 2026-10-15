// Sound: ambience follows the weather and the time of day, short synthesized sounds answer taps (oscillators
// and noise), and the music of each place plays over it (recorded pieces, see musicplayer.ts).

import { caption } from './a11y';
import type { Prefs } from './prefs';
import { rates, seasonal, STEPS, type Around, type Surface } from './audio/ambience';

export interface Scene {
  /** 0 in daylight, 1 deep night. */
  dark: number;
  weather: string;
  backdrop: string;
  moving: boolean;
  fire: boolean;
  /** Whether the player is in the room (false while a sheet covers the screen is still "in the room"). */
  active: boolean;
  /** Where the player is: the music follows it (night overrides it after dark). */
  place?: import('./musicplayer').MusicPlace;
  /** Something in the room is playing: the radio, a record, a music box (it takes over from the place's music). */
  playing?: import('./musicplayer').MoodScene['playing'];
  /** The hour, the season, the day, the feast, out of doors: the music follows them too (musicplayer.ts). */
  minute?: number;
  season?: import('./musicplayer').MoodScene['season'];
  day?: number;
  festival?: string | null;
  outdoors?: boolean;
  /** The world around in detail (audio/ambience.ts): the layers and the occasional sounds follow it. */
  around?: Around;
  /** What the hero walks on (the footsteps). */
  surface?: Surface;
}

export interface Mix {
  rain: number;
  wind: number;
  birds: number;
  crickets: number;
  fire: number;
  room: number;
  crackle: number;
  /** Rain on the roof (heard inside). */
  roof: number;
  /** The town going about its day. */
  hum: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Target level of each ambience layer for a scene. Pure, so it can be tested without any audio. */
export function mixFor(s: Scene): Mix {
  const wet = s.weather === 'rain' ? 1 : 0;
  const outdoors = s.backdrop === 'forest' || s.backdrop === 'sea' || s.backdrop === 'mountains' ? 1 : s.backdrop === 'void' || s.backdrop === 'space' ? 0 : 0.6;
  return {
    rain: wet * 0.9,
    wind: clamp((s.weather === 'snow' || s.weather === 'fog' ? 0.6 : 0.25) * outdoors + (s.backdrop === 'mountains' ? 0.25 : 0)),
    birds: wet ? 0 : clamp((1 - s.dark) * outdoors * 0.8),
    crickets: wet ? 0 : clamp(s.dark * outdoors * 0.25 + (s.weather === "fireflies" ? 0.15 : 0)),
    fire: s.fire ? 0.55 : 0,
    room: 0.12,
    crackle: s.playing === 'vinyl' ? 0.25 : 0,
    roof: 0,
    hum: 0,
  };
}

/** The mix with the world around taken into account (the season's birds and crickets, rain on the roof, the
 * town's hum), when the scene says where one is in detail. */
export function mixAround(s: Scene): Mix {
  const base = mixFor(s);
  if (!s.around) return base;
  const l = seasonal(s.around);
  return { ...base, birds: l.birds, crickets: l.crickets, rain: l.leaves, roof: l.roof, wind: l.wind, hum: l.hum };
}

function rngOf(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

// ---- the music: recorded pieces for each place (see musicplayer.ts and crates/teul-music) -------------------
import { MusicPlayer, mediaDeck, moodOf, type Mood } from './musicplayer';
export type { Mood };

export type Sfx = 'tap' | 'place' | 'buy' | 'error' | 'turn' | 'step' | 'save' | 'pop' | 'chime' | 'purr' | 'switch' | 'page' | 'click' | 'coins';

/** How loud each ambience layer is at its full level. */
const LAYER_GAIN: Record<string, number> = { rain: 0.35, wind: 0.5, crickets: 0.05, room: 0.5, crackle: 0.5, roof: 0.45, hum: 0.25 };
/** One-shot sounds that may ring at once. */
const MAX_SOUNDING = 18;

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private effects!: GainNode;
  private ambience!: GainNode;
  /** The recorded music (created with the audio context, on the first tap). */
  private player: MusicPlayer | null = null;

  /** On a slow phone. The music is recorded and streamed, so it costs the same either way; kept for the callers. */
  setLowPower(_on: boolean): void {}
  private noise!: AudioBuffer;
  private layers = new Map<keyof Mix, GainNode>();
  private nextBird = 0;
  private nextCrackle = 0;
  private seed = 12345;
  private scene: Scene = { dark: 0, weather: 'none', backdrop: 'sky', moving: false, fire: false, active: true };
  private lastStep = 0;

  constructor(private prefs: Prefs) {}

  setPrefs(p: Prefs): void {
    this.prefs = p;
    this.applyVolumes(true);
  }

  private hushed = false;
  private hidden = false;

  /** Quiets everything (the goodbye screen) or brings it back. */
  hush(on: boolean): void {
    this.hushed = on;
    this.applyQuiet();
  }

  /** The app went to the background (another app, the screen off) or came back: no sound while unseen. */
  setHidden(on: boolean): void {
    this.hidden = on;
    this.applyQuiet();
  }

  private applyQuiet(): void {
    if (!this.ctx) return;
    const quiet = this.hushed || this.hidden;
    this.player?.setPaused(quiet);
    void (quiet ? this.ctx.suspend() : this.ctx.resume());
  }

  /** Browsers only allow sound after a tap; call this from the first one. */
  unlock(): void {
    if (this.ctx) {
      if (!this.hushed && !this.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.effects = ctx.createGain();
    this.ambience = ctx.createGain();
    this.music.connect(this.master);
    this.effects.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(ctx.destination);
    const music = this.music;
    this.player = new MusicPlayer(() => mediaDeck(ctx, music), import.meta.env?.BASE_URL ?? '/');
    this.player.setPaused(this.hushed || this.hidden);
    this.noise = this.makeNoise(2);
    this.buildAmbience();
    this.applyVolumes();
    void ctx.resume();
  }

  private ducked = false;
  private instrument: GainNode | null = null;

  /** Where the hero's own instrument sounds (at the music's volume), once sound is allowed. */
  instrumentOut(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.ctx) return null;
    if (!this.instrument) {
      this.instrument = this.ctx.createGain();
      this.instrument.connect(this.master);
      this.applyVolumes();
    }
    return { ctx: this.ctx, out: this.instrument };
  }

  /** The music steps back while the hero plays (or a TV speaks). */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  /** `byHand`: a slider is moving — the music follows it at once (otherwise it comes back up slowly after a duck). */
  private applyVolumes(byHand = false): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.prefs.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.prefs.music * (this.ducked ? 0.08 : 1), t, this.ducked ? 0.15 : byHand ? 0.06 : 0.6);
    this.instrument?.gain.setTargetAtTime(Math.max(0.35, this.prefs.music) * 0.9, t, 0.05);
    this.effects.gain.setTargetAtTime(this.prefs.effects, t, 0.05);
    this.ambience.gain.setTargetAtTime(this.prefs.ambience, t, 0.05);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const r = rngOf(7);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.96 + (r() * 2 - 1) * 0.28;
      d[i] = last;
    }
    return buf;
  }

  private looped(filter: BiquadFilterType, freq: number, q = 0.7): GainNode {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.ambience);
    src.start();
    return g;
  }

  private buildAmbience(): void {
    this.layers.set('rain', this.looped('bandpass', 3800, 0.5));
    this.layers.set('wind', this.looped('lowpass', 520, 0.4));
    this.layers.set('room', this.looped('lowpass', 180, 0.3));
    // the crackle of a record
    this.layers.set('crackle', this.looped('highpass', 2600, 0.6));
    // rain drumming on the roof (low, uneven) and the town's far hum
    this.layers.set('roof', this.looped('lowpass', 900, 0.8));
    this.layers.set('hum', this.looped('lowpass', 240, 0.4));
    const ctx = this.ctx as AudioContext;
    // crickets: a high tone pulsed by a slow square wave
    const tone = ctx.createOscillator();
    tone.frequency.value = 4600;
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(pulse.gain);
    const crickets = ctx.createGain();
    crickets.gain.value = 0;
    tone.connect(pulse).connect(crickets).connect(this.ambience);
    tone.start();
    lfo.start();
    this.layers.set('crickets', crickets);
    this.layers.set('birds', ctx.createGain());
    this.layers.set('fire', ctx.createGain());
    this.layers.get('birds')?.connect(this.ambience);
    this.layers.get('fire')?.connect(this.ambience);
  }

  /** Called every frame (cheap): follows the scene and schedules music, birds and crackles. */
  update(scene: Scene, now: number): void {
    this.scene = scene;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    // the layers follow the world a few times a second (they glide anyway); no new objects every frame
    if (!this.lastMix || now - this.mixAt > 0.25 || now < this.mixAt) {
      this.mixAt = now;
      this.lastMix = mixAround(scene);
      for (const [name, node] of this.layers) {
        if (name === 'birds' || name === 'fire') continue;
        node.gain.setTargetAtTime(this.lastMix[name] * (LAYER_GAIN[name] ?? 0.5), t, 0.8);
      }
    }
    const mix = this.lastMix;
    if (scene.around) this.occasions(scene.around, now);
    this.lastMood = moodOf(scene);
    this.player?.want(this.lastMood, t);
    if (mix.birds > 0.05 && now >= this.nextBird) {
      // more often in the dawn chorus
      this.nextBird = now + (2.5 + (this.seed % 7)) / Math.max(0.6, mix.birds * 1.6);
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      this.chirp(mix.birds);
    }
    if (mix.fire > 0 && now >= this.nextCrackle) {
      this.nextCrackle = now + 0.12 + (this.seed % 9) / 14;
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      this.crackle(mix.fire);
    }
    if (scene.moving && now - this.lastStep > 0.32) {
      this.lastStep = now;
      this.step(scene.surface ?? 'stone');
    }
  }

  /** A footstep on what is underfoot (audio/ambience.ts STEPS). */
  private step(surface: Surface): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = STEPS[surface];
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = s.band * (0.9 + (this.seed % 20) / 100);
    f.Q.value = s.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(s.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.len);
    src.connect(f).connect(g).connect(this.effects);
    src.start(t, (this.seed % 150) / 100);
    src.stop(t + s.len + 0.02);
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    if (s.thud > 0) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      const og = ctx.createGain();
      og.gain.setValueAtTime(s.thud, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(og).connect(this.effects);
      o.start(t);
      o.stop(t + 0.08);
    }
  }

  private nextOccasion = 0;
  private pealUntil = 0;
  private nextPeal = 0;

  /** The occasional sounds of the world, a few times a second at most (audio/ambience.ts rates). */
  private occasions(a: Around, now: number): void {
    if (now < this.nextOccasion) return;
    const dt = 0.25;
    this.nextOccasion = now + dt;
    const r = rates(a);
    const roll = (perSecond: number) => perSecond > 0 && Math.random() < perSecond * dt;
    const side = () => Math.random() * 1.6 - 0.8;
    if (roll(r.rooster)) this.at('rooster', a.place === 'farm' ? 0.6 : 0.3, side());
    if (roll(r.dog)) this.at('dog_far', 0.25, side());
    if (roll(r.cat)) this.at('meow', 0.25, side());
    if (roll(r.train)) this.at('train', 0.3, Math.random() < 0.5 ? -0.7 : 0.7);
    if (roll(r.gong)) this.at('gong', a.temple >= 1 ? 0.5 : 0.2 * a.temple, 0);
    if (roll(r.iceCrack)) this.at('ice_crack', 0.4 * a.ice, side());
    if (roll(r.firework)) this.at('firework', 0.5, side());
    // the Sunday peal: a few bells in turn for a while
    if (r.peal && now >= this.nextPeal) {
      this.nextPeal = now + 2.4;
      this.at('peal', a.outdoors ? 0.35 : 0.15, 0.2);
    }
    void this.pealUntil;
  }

  private chirp(level: number): void {
    const ctx = this.ctx as AudioContext;
    const t = ctx.currentTime;
    const base = 2400 + (this.seed % 1200);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.layers.get('birds') as GainNode);
    (this.layers.get('birds') as GainNode).gain.setTargetAtTime(0.12 * level, t, 0.1);
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t + i * 0.11);
      osc.frequency.exponentialRampToValueAtTime(base * 1.4, t + i * 0.11 + 0.07);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t + i * 0.11);
      e.gain.linearRampToValueAtTime(0.6, t + i * 0.11 + 0.02);
      e.gain.linearRampToValueAtTime(0, t + i * 0.11 + 0.09);
      osc.connect(e).connect(g);
      osc.start(t + i * 0.11);
      osc.stop(t + i * 0.11 + 0.12);
    }
    g.gain.setValueAtTime(1, t);
    g.gain.setTargetAtTime(0, t + 0.5, 0.2);
  }

  private crackle(level: number): void {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500 + (this.seed % 2000);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.12 * level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.ambience);
    src.start(t, (this.seed % 100) / 50);
    src.stop(t + 0.06);
  }

  /** Short synthesized sounds for taps and events. */
  // ---- the world's sounds, placed: animals, traffic, bells, machines, water, people --------------------

  /** A short sound at a volume (0..1, already lowered for distance) and a side (-1 left .. 1 right). */
  at(kind: string, volume: number, pan = 0): void {
    // the sounds that matter get a caption (with captions on), even with the sound itself off
    caption(kind, volume);
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || volume <= 0.02) return;
    // a phone can only mix so much at once: the rest is let go (the world is busy anyway)
    if (this.sounding >= MAX_SOUNDING) return;
    this.sounding++;
    window.setTimeout(() => (this.sounding = Math.max(0, this.sounding - 1)), 3000);
    const t = ctx.currentTime + 0.01;
    const out = ctx.createStereoPanner();
    out.pan.value = pan;
    const bus = ctx.createGain();
    bus.gain.value = Math.min(1, volume);
    out.connect(bus).connect(this.effects);
    /** A tone gliding from f0 to f1, through a filter, with a quick attack and a fall. */
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, filter = 2400, q = 0.7, vib = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + dur);
      if (vib) {
        const l = ctx.createOscillator();
        l.frequency.value = vib;
        const lg = ctx.createGain();
        lg.gain.value = f0 * 0.04;
        l.connect(lg).connect(o.frequency);
        l.start(t + at);
        l.stop(t + at + dur + 0.05);
      }
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filter;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(vol, t + at + Math.min(0.03, dur / 4));
      g.gain.setValueAtTime(vol, t + at + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0005, t + at + dur);
      o.connect(f).connect(g).connect(out);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    };
    /** A burst of noise through a band. */
    const hiss = (dur: number, band: number, vol: number, at = 0, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = band;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t + at);
      g.gain.exponentialRampToValueAtTime(0.0005, t + at + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t + at, Math.random() * 1.5);
      src.stop(t + at + dur + 0.05);
    };
    /** A bell: a pure tone with an inharmonic partial, long to die away. */
    const bell = (f: number, vol: number, at = 0, dur = 2.5) => {
      tone('sine', f, f, dur, vol, at, f, 0.3);
      tone('sine', f * 2.76, f * 2.76, dur * 0.6, vol * 0.3, at, f * 2.76, 0.3);
      tone('sine', f * 5.4, f * 5.4, dur * 0.3, vol * 0.12, at, f * 5.4, 0.3);
    };
    switch (kind) {
      case 'moo': tone('sawtooth', 120, 100, 1.1, 0.5, 0, 500, 2, 3); break;
      case 'baa': tone('sawtooth', 380, 340, 0.6, 0.35, 0, 1100, 3, 9); break;
      case 'cluck': [0, 0.12, 0.22].forEach((d) => tone('square', 700, 900, 0.07, 0.15, d, 1300, 4)); break;
      case 'quack': [0, 0.18].forEach((d) => tone('sawtooth', 480, 380, 0.13, 0.25, d, 900, 6)); break;
      case 'bark': [0, 0.2].forEach((d) => { tone('square', 320, 220, 0.11, 0.3, d, 700, 2); hiss(0.08, 1200, 0.15, d); }); break;
      case 'oink': [0, 0.25].forEach((d) => tone('square', 190, 160, 0.18, 0.25, d, 600, 5)); break;
      case 'neigh': tone('sawtooth', 700, 380, 1.2, 0.3, 0, 1400, 2, 11); break;
      case 'honk_goose': [0, 0.3].forEach((d) => tone('square', 360, 330, 0.22, 0.2, d, 800, 4)); break;
      case 'owl': [0, 0.55].forEach((d) => tone('sine', 420, 380, 0.4, 0.25, d, 420, 1)); break;
      case 'frog': [0, 0.1, 0.2].forEach((d) => tone('square', 130, 110, 0.08, 0.15, d, 400, 3)); break;
      case 'woodpecker': for (let i = 0; i < 8; i++) hiss(0.03, 2200, 0.25, i * 0.06, 4); break;
      case 'bird': tone('sine', 3200, 4200, 0.12, 0.12, 0, 3600, 1); tone('sine', 3800, 3000, 0.1, 0.1, 0.15, 3400, 1); break;
      case 'bat': [0, 0.09, 0.16].forEach((d) => tone('sine', 6200, 5200, 0.04, 0.08, d, 5800, 2)); break;
      case 'drip': tone('sine', 1500, 700, 0.12, 0.2, 0, 1100, 1); break;
      case 'horn': tone('square', 420, 420, 0.45, 0.25, 0, 900, 1); tone('square', 525, 525, 0.45, 0.2, 0, 1100, 1); break;
      case 'bell': bell(2600, 0.15, 0, 0.5); bell(2600, 0.15, 0.18, 0.6); break;
      case 'hooves': for (let i = 0; i < 4; i++) hiss(0.04, 900 - i * 60, 0.3, i * 0.11, 3); break;
      case 'cheer': hiss(1.6, 900, 0.35, 0, 0.6); hiss(1.2, 2200, 0.15, 0.2, 0.8); break;
      case 'church': bell(220, 0.5, 0, 4); break;
      case 'school_bell': for (let i = 0; i < 20; i++) tone('square', 1000, 1000, 0.05, 0.12, i * 0.07, 1000, 2); break;
      case 'typewriter': for (let i = 0; i < 5; i++) hiss(0.02, 3000, 0.3, i * (0.08 + (i % 2) * 0.05), 3); break;
      case 'till': bell(1900, 0.2, 0, 0.8); hiss(0.25, 600, 0.2, 0.1); break;
      case 'door': hiss(0.12, 300, 0.4, 0, 1); tone('sawtooth', 240, 180, 0.25, 0.08, 0.05, 500, 4); break;
      case 'splash': hiss(0.35, 1200, 0.4, 0, 0.5); hiss(0.2, 3000, 0.2, 0.05, 1); break;
      case 'chatter': for (let i = 0; i < 4; i++) tone('triangle', 260 + ((i * 97) % 140), 220 + ((i * 53) % 120), 0.09, 0.08, i * 0.11, 900, 2); break;
      case 'thunder': hiss(2.8, 90, 0.9, 0.3, 0.4); hiss(1.5, 200, 0.4, 0.4, 0.5); break;
      case 'saw': tone('sawtooth', 180, 210, 1.2, 0.08, 0, 2400, 1, 6); hiss(1.2, 3000, 0.1); break;
      case 'rustle': hiss(0.4, 2000, 0.2, 0, 0.5); break;
      case 'pages': hiss(0.15, 4000, 0.15); hiss(0.15, 3500, 0.12, 0.2); break;
      // the eerie nights (opt-in): a knock at the door, whispers, a low drone, a sting, a flicker's buzz, footsteps
      case 'knock': [0, 0.32, 0.64].forEach((d) => { hiss(0.09, 180, 0.9, d, 2); tone('sine', 90, 70, 0.12, 0.35, d, 160, 1); }); break;
      case 'whisper': for (let i = 0; i < 6; i++) hiss(0.35 + (i % 3) * 0.1, 2400 + ((i * 431) % 1600), 0.08, i * 0.28, 6); break;
      case 'drone': tone('sine', 55, 52, 4, 0.35, 0, 110, 0.5); tone('sine', 82.4, 80, 4, 0.18, 0.3, 160, 0.5); tone('triangle', 58.3, 58, 3.5, 0.08, 0.6, 200, 1, 0.2); break;
      case 'sting': [311, 330, 466, 494].forEach((f, i) => tone('sawtooth', f, f * 0.98, 1.4, 0.07, i * 0.01, 1600, 0.8, 6)); hiss(0.6, 5000, 0.08, 0, 2); break;
      case 'buzz': for (let i = 0; i < 5; i++) tone('square', 100, 100, 0.06, 0.06, i * 0.09 + (i % 2) * 0.05, 300, 2); break;
      case 'steps': for (let i = 0; i < 6; i++) hiss(0.06, 260 + (i % 2) * 40, 0.35, i * 0.42, 3); break;
      case 'hollow_meow': tone('sine', 700, 380, 1.1, 0.12, 0, 900, 0.6, 3); tone('sine', 352, 190, 1.1, 0.06, 0.02, 500, 0.6, 3); break;
      // the wonders: horror nights and the sky (app/src/wonders)
      case 'heartbeat': [0, 0.22].forEach((d, i) => tone('sine', 62, 44, 0.18, i ? 0.45 : 0.6, d, 120, 1)); break;
      case 'breath': hiss(0.9, 700, 0.18, 0, 1.5); hiss(0.7, 500, 0.14, 1.0, 1.5); break;
      case 'chant': [110, 98, 110, 82.4].forEach((f, i) => { tone('sawtooth', f, f, 0.55, 0.09, i * 0.6, 420, 2, 4); tone('sawtooth', f * 1.5, f * 1.5, 0.55, 0.04, i * 0.6, 600, 2, 5); }); hiss(2.4, 800, 0.05, 0, 0.5); break;
      case 'crowd_far': for (let i = 0; i < 10; i++) tone('triangle', 150 + ((i * 37) % 90), 130 + ((i * 53) % 70), 0.3, 0.035, i * 0.17, 500, 2, 3); hiss(1.8, 700, 0.06, 0, 0.6); break;
      case 'torch': hiss(1.2, 300, 0.12, 0, 0.6); hiss(0.4, 1800, 0.05, 0.3, 2); break;
      case 'scrape': hiss(0.7, 2600, 0.12, 0, 8); tone('sawtooth', 900, 700, 0.6, 0.03, 0, 1800, 6); break;
      case 'muffled': tone('sine', 70, 40, 2.4, 0.3, 0, 90, 0.5); hiss(2.2, 160, 0.2, 0, 0.5); break;
      case 'ufo': tone('sine', 220, 230, 3, 0.12, 0, 260, 0.5, 7); tone('triangle', 660, 640, 3, 0.05, 0, 700, 2, 11); break;
      case 'beam': tone('sine', 300, 1200, 2.2, 0.1, 0, 900, 0.5, 3); hiss(2.2, 6000, 0.05, 0, 1); break;
      case 'meteor': hiss(0.5, 5200, 0.05, 0, 3); break;
      case 'hush': tone('sine', 196, 196, 3.5, 0.06, 0, 196, 0.3); tone('sine', 293.7, 293.7, 3.5, 0.04, 0.4, 294, 0.3); break;
      case 'otherworld': [523, 659, 784, 988].forEach((f, i) => bell(f, 0.08, i * 0.35, 3)); break;
      // the town's days (audio/ambience.ts rates): animals, the train, bells, the temple, the ice, fireworks
      case 'rooster': tone('sawtooth', 520, 700, 0.18, 0.18, 0, 1200, 3); tone('sawtooth', 700, 820, 0.35, 0.2, 0.2, 1400, 3, 7); tone('sawtooth', 820, 480, 0.5, 0.16, 0.55, 1200, 3, 5); break;
      case 'dog_far': [0, 0.35].forEach((d) => tone('square', 300, 210, 0.12, 0.12, d, 600, 2)); break;
      case 'meow': tone('sine', 520, 760, 0.25, 0.1, 0, 900, 1.5, 4); tone('sine', 760, 420, 0.35, 0.09, 0.25, 800, 1.5, 4); break;
      case 'train': hiss(3.5, 220, 0.25, 0, 0.5); tone('square', 440, 440, 0.7, 0.05, 0.4, 900, 2); tone('square', 554, 554, 0.7, 0.04, 0.4, 1100, 2); for (let i = 0; i < 8; i++) hiss(0.06, 400, 0.12, 0.6 + i * 0.36, 3); break;
      case 'gong': tone('sine', 98, 96, 5, 0.4, 0, 120, 0.4); tone('sine', 196.5, 195, 4, 0.18, 0, 220, 0.4, 0.3); tone('sine', 293, 291, 3, 0.1, 0.02, 320, 0.4, 0.5); tone('sine', 412, 410, 2.4, 0.06, 0.03, 450, 0.5); break;
      case 'ice_crack': tone('sine', 1800, 200, 0.5, 0.15, 0, 900, 0.8); hiss(0.05, 3000, 0.2, 0, 3); tone('sine', 900, 120, 0.8, 0.08, 0.05, 500, 0.6); break;
      case 'firework': hiss(0.6, 3500, 0.06, 0, 1); hiss(1.2, 160, 0.6, 0.6, 0.5); for (let i = 0; i < 6; i++) hiss(0.04, 4500, 0.1, 0.7 + i * 0.07 + Math.random() * 0.05, 3); break;
      case 'peal': [523, 659, 587, 784].forEach((f, i) => bell(f * 0.5, 0.18, i * 0.55, 2.4)); break;
      case 'cart_bell': for (let i = 0; i < 4; i++) bell(2093, 0.1, i * 0.14, 0.35); break;
      case 'shop_bell': bell(1760, 0.14, 0, 0.9); bell(2217, 0.1, 0.09, 0.8); break;
      case 'song_far': [392, 349, 330, 294, 262].forEach((f, i) => tone('sine', f, f * 0.995, 0.7, 0.05, i * 0.6, f, 0.4, 5)); break;
      default: break;
    }
    window.setTimeout(() => out.disconnect(), 5000);
  }

  private lastMix: Mix | null = null;
  private mixAt = 0;
  private lastMood: Mood | null = null;

  /** What is playing and how loud each layer of the ambience is now (for tests and the settings' meters-free view). */
  state(): { running: boolean; mood: Mood | null; mix: Mix | null; sounding: number; loops: string[] } {
    return { running: this.ctx?.state === 'running', mood: this.lastMood, mix: this.lastMix, sounding: this.sounding, loops: [...this.loops.keys()] };
  }

  private loops = new Map<string, GainNode>();
  /** One-shot sounds still ringing (a few seconds each). */
  private sounding = 0;

  /** A sound that goes on (an engine, water, a crowd, machines, a siren) at a level (0 is off). */
  loop(kind: string, level: number): void {
    if (level > 0.2) caption(kind, level);
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let g = this.loops.get(kind);
    if (!g) {
      if (level <= 0.01) return;
      g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.ambience);
      const noise = (type: BiquadFilterType, f: number, q: number, am = 0, amDepth = 0.5) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const flt = ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.value = f;
        flt.Q.value = q;
        const amp = ctx.createGain();
        amp.gain.value = 1 - amDepth / 2;
        if (am) {
          const l = ctx.createOscillator();
          l.frequency.value = am;
          const lg = ctx.createGain();
          lg.gain.value = amDepth / 2;
          l.connect(lg).connect(amp.gain);
          l.start();
        }
        src.connect(flt).connect(amp).connect(g as GainNode);
        src.start(0, Math.random() * 1.5);
      };
      const hum = (type: OscillatorType, f: number, cut: number, level2: number, wobble = 0) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        if (wobble) {
          const l = ctx.createOscillator();
          l.frequency.value = wobble;
          const lg = ctx.createGain();
          lg.gain.value = f * 0.05;
          l.connect(lg).connect(o.frequency);
          l.start();
        }
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = cut;
        const lv = ctx.createGain();
        lv.gain.value = level2;
        o.connect(flt).connect(lv).connect(g as GainNode);
        o.start();
      };
      if (kind === 'engine') { hum('sawtooth', 58, 220, 0.5, 3); noise('lowpass', 300, 0.5); }
      else if (kind === 'water') noise('lowpass', 450, 0.6, 0.3, 0.8);
      else if (kind === 'fountain') noise('bandpass', 1800, 0.5, 0, 0);
      else if (kind === 'machine') { hum('square', 98, 320, 0.25, 0); noise('bandpass', 900, 1, 6, 0.6); }
      else if (kind === 'turbine') noise('bandpass', 500, 0.8, 0.7, 0.9);
      else if (kind === 'crowd') noise('bandpass', 650, 0.9, 2.5, 0.7);
      else if (kind === 'siren') { hum('sine', 800, 2000, 0.4, 0.8); }
      else if (kind === 'tap') noise('bandpass', 2600, 0.6, 0, 0);
      else if (kind === 'wind_high') noise('bandpass', 1200, 0.4, 0.2, 0.8);
      this.loops.set(kind, g);
    }
    g.gain.setTargetAtTime(Math.min(0.5, level) * (kind === 'siren' ? 0.15 : kind === 'engine' ? 0.6 : 0.35), ctx.currentTime, 0.3);
  }

  sfx(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const blip = (freq: number, to: number, len: number, gain: number, type: OscillatorType = 'sine', at = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t + at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + at + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      osc.connect(g).connect(this.effects);
      osc.start(t + at);
      osc.stop(t + at + len + 0.02);
    };
    switch (name) {
      case 'tap':
        blip(520, 380, 0.06, 0.12, 'triangle');
        break;
      case 'place':
        blip(300, 140, 0.12, 0.3, 'sine');
        blip(900, 500, 0.05, 0.08, 'triangle');
        break;
      case 'pop':
        blip(700, 1200, 0.07, 0.14);
        break;
      case 'buy':
        blip(880, 880, 0.12, 0.14, 'triangle');
        blip(1320, 1320, 0.18, 0.14, 'triangle', 0.08);
        break;
      case 'chime':
        blip(1046, 1046, 0.3, 0.1, 'sine');
        blip(1568, 1568, 0.4, 0.08, 'sine', 0.1);
        break;
      case 'error':
        blip(200, 150, 0.16, 0.2, 'square');
        break;
      case 'purr': {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 220;
        const g = ctx.createGain();
        g.gain.value = 0;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 24;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.35;
        lfo.connect(lfoGain).connect(g.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.9, t + 0.15);
        env.gain.linearRampToValueAtTime(0, t + 1.1);
        src.connect(f).connect(g).connect(env).connect(this.effects);
        src.start(t);
        lfo.start(t);
        src.stop(t + 1.2);
        lfo.stop(t + 1.2);
        break;
      }
      case 'click':
        blip(1800, 1200, 0.025, 0.06, 'triangle');
        break;
      case 'coins':
        [0, 0.06, 0.13].forEach((d, i) => blip(2600 + i * 400, 2400 + i * 300, 0.12, 0.07, 'triangle', d));
        break;
      case 'page': {
        // a page turned: a dry rustle that rises and falls
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        src.connect(f).connect(g).connect(this.effects);
        src.start(t, Math.random());
        src.stop(t + 0.34);
        break;
      }
      case 'switch':
        blip(1400, 900, 0.03, 0.12, 'square');
        blip(700, 600, 0.04, 0.08, 'triangle', 0.03);
        break;
      case 'turn':
        blip(420, 560, 0.1, 0.1, 'sine');
        break;
      case 'save':
        blip(660, 660, 0.1, 0.12, 'triangle');
        blip(880, 880, 0.1, 0.12, 'triangle', 0.09);
        blip(1320, 1320, 0.2, 0.12, 'triangle', 0.18);
        break;
      default: {
        // footstep: a soft burst of filtered noise
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        src.connect(f).connect(g).connect(this.effects);
        src.start(t, Math.random() * 1.5);
        src.stop(t + 0.08);
      }
    }
  }
}

export function vibrate(prefs: Prefs, ms: number | number[]): void {
  if (!prefs.haptics) return;
  try {
    globalThis.navigator?.vibrate?.(ms);
  } catch {
    // not available
  }
}
