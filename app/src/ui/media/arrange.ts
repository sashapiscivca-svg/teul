// A piece played by the hero's hands on an instrument: the melody and the chords of the score (scores.json, from
// scripts/scores.py) arranged the way the instrument plays them, and played as well as the hands can — slower and
// with a slip now and then at first, steady and full later. The same hands play the same piece the same way on
// the same try (a seeded hand), so nothing here is random in a way a test cannot see.

import scoresJson from './scores.json';
import type { Kit } from './kits';

export interface Score {
  id: string;
  name: string;
  by: string;
  tempo: number;
  meter: number;
  /** [beat, beats, key] */
  melody: [number, number, number][];
  /** [beat, beats, bass key, chord keys] */
  chords: [number, number, number, number[]][];
  level: number;
}

export const SCORES: Score[] = scoresJson as unknown as Score[];

export function scoreOf(id: string): Score | undefined {
  return SCORES.find((s) => s.id === id);
}

/** A note to sound: seconds from the start, how long, which key, how loud (0..1). */
export interface Sounded {
  t: number;
  len: number;
  key: number;
  vel: number;
  /** A note of the tune (the screen lights it). */
  lead: boolean;
  /** A slip of the finger. */
  slip?: boolean;
}

export interface Performance {
  notes: Sounded[];
  secs: number;
  /** The tempo actually taken (quarter notes a minute). */
  tempo: number;
}

/** How the hands at each level of the skill play: tempo, slips (per mille), timing spread (s), how full. */
const HANDS = [
  { tempo: 0.72, slips: 70, spread: 0.07, full: 0 },
  { tempo: 0.85, slips: 30, spread: 0.045, full: 1 },
  { tempo: 0.95, slips: 10, spread: 0.025, full: 2 },
  { tempo: 1.0, slips: 0, spread: 0.012, full: 2 },
];

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Octaves to move the tune by so it lies where the instrument sings. */
export function octaveShift(score: Score, kit: Kit): number {
  const keys = score.melody.map((n) => n[2]);
  const lo = Math.min(...keys);
  const hi = Math.max(...keys);
  let shift = 0;
  while (lo + shift < kit.low && hi + shift + 12 <= kit.high + 3) shift += 12;
  while (hi + shift > kit.high && lo + shift - 12 >= kit.low - 3) shift -= 12;
  return shift;
}

/** The accompaniment of one chord span, in beats, as the instrument plays it. */
function accompany(kit: Kit, meter: number, span: [number, number, number, number[]], full: number): [number, number, number, number][] {
  const [at, len, bass, tones] = span;
  const out: [number, number, number, number][] = [];
  if (kit.chords === 'none') return out;
  const beats = Math.max(1, Math.round(len));
  const strong = (b: number) => (at + b) % meter === 0;
  for (let b = 0; b < beats; b++) {
    const t = at + b;
    const rest = Math.min(1, at + len - t);
    if (rest <= 0) break;
    const first = b === 0;
    if (full === 0) {
      // the first tries: only the bass, where the chord changes
      if (first) out.push([t, Math.min(len, 2), bass + 12, 0.45]);
      continue;
    }
    switch (kit.chords) {
      case 'block':
        if (first || strong(b)) out.push([t, rest, bass, 0.5]);
        else if (full >= 2 || b % 2 === 0) for (const k of tones) out.push([t, rest * 0.9, k - 12 >= 48 ? k - 12 : k, 0.32]);
        break;
      case 'bellows':
        if (first || strong(b)) out.push([t, 0.5, bass, 0.5]);
        else for (const k of tones) out.push([t, 0.45, k - 12 >= 48 ? k - 12 : k, 0.3]);
        break;
      case 'strum': {
        const down = first || strong(b) || full < 2 || b % 2 === 0;
        const strings = [bass, ...tones.map((k) => k - 12 >= 40 ? k - 12 : k), ...tones].slice(0, 6);
        const order = down ? strings : [...strings].reverse();
        order.forEach((k, i) => out.push([t + i * 0.035, rest, k, (down ? 0.42 : 0.3) - i * 0.02]));
        break;
      }
      case 'arp': {
        const notes = [bass, ...tones.map((k) => k - 12 >= 40 ? k - 12 : k)];
        out.push([t, 0.9, notes[(b * 2) % notes.length], 0.36]);
        if (full >= 2 && rest > 0.5) out.push([t + 0.5, 0.9, notes[(b * 2 + 1) % notes.length], 0.3]);
        break;
      }
    }
  }
  return out;
}

/** The piece as these hands play it on this instrument. `tries` makes each sitting a little different. */
export function perform(score: Score, kit: Kit, skill: number, tries = 0): Performance {
  const hands = HANDS[Math.max(0, Math.min(3, skill))];
  // a piece above the hands is taken slower and slips more
  const hard = Math.max(0, score.level - skill);
  const tempo = score.tempo * hands.tempo * (hard > 0 ? 0.9 : 1);
  const spb = 60 / tempo;
  const rand = rng(hashOf(`${score.id}|${kit.id}|${skill}|${tries}`));
  const shift = octaveShift(score, kit);
  const slips = hands.slips + hard * 40;
  const notes: Sounded[] = [];
  for (const [at, len, key] of score.melody) {
    const jitter = (rand() - 0.5) * 2 * hands.spread;
    const slip = rand() * 1000 < slips;
    const k = key + shift + (slip ? (rand() < 0.5 ? -1 : 1) * (rand() < 0.7 ? 1 : 2) : 0);
    // phrasing: the downbeat a little louder, the end of a long note softer
    const down = at % score.meter === 0 ? 0.08 : 0;
    notes.push({ t: Math.max(0, at * spb + jitter), len: len * spb, key: k, vel: Math.min(1, 0.7 + down + (rand() - 0.5) * 0.1), lead: true, slip });
  }
  for (const span of score.chords) {
    for (const [at, len, key, vel] of accompany(kit, score.meter, span, hands.full)) {
      const k = key + (kit.low > key ? 12 * Math.ceil((kit.low - key) / 12) : 0);
      notes.push({ t: Math.max(0, at * spb + (rand() - 0.5) * hands.spread), len: len * spb, key: k, vel, lead: false });
    }
  }
  notes.sort((a, b) => a.t - b.t);
  const secs = Math.max(...notes.map((n) => n.t + n.len)) + 0.8;
  return { notes, secs, tempo };
}
