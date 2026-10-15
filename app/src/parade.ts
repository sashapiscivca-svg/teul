// The Lunar New Year's dragon dance: a long red dragon — a head and a string of body segments, each held up on a
// pole by a dancer — weaving down the main street from the square and back, twice a day. Where it is follows from
// the time (the same for everyone); the street is the route the town's paths give between two landmarks.

import { FESTIVAL_PARADES } from './paradeTimes';

export interface ParadePiece {
  item: 'dragon_head' | 'dragon_body';
  x: number;
  y: number;
  /** Quarter turns, as a mover. */
  rot: number;
  /** How high it bobs, pixels. */
  bob: number;
}

/** Seconds since the parade set off at `minute` of the day (game minutes), or null if none goes now. */
export function paradeClock(festival: { id: string; phase: string } | null, minute: number): number | null {
  if (!festival || festival.phase !== 'day') return null;
  for (const [from, to] of FESTIVAL_PARADES[festival.id] ?? []) if (minute >= from && minute < to) return (minute - from) * 60;
  return null;
}

function pointAt(route: [number, number][], dist: number): { x: number; y: number; dx: number; dy: number } {
  let left = Math.max(0, dist);
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1];
    const [bx, by] = route[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len && len > 0) return { x: ax + ((bx - ax) * left) / len, y: ay + ((by - ay) * left) / len, dx: (bx - ax) / len, dy: (by - ay) / len };
    left -= len;
  }
  const [x, y] = route[route.length - 1] ?? [0, 0];
  return { x, y, dx: 0, dy: 1 };
}

function rotOf(dx: number, dy: number): number {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
}

/**
 * The dragon on a route (there and back, again and again) `seconds` after it set off: the head first, `segments` after it, a step
 * apart, weaving a little side to side and bobbing as the dancers lift their poles in turn.
 */
export function dragonAt(route: [number, number][], seconds: number, segments = 8, speed = 0.4): ParadePiece[] {
  if (route.length < 2) return [];
  const there = [...route];
  const loop = [...there, ...there.slice(0, -1).reverse()];
  let total = 0;
  for (let i = 1; i < loop.length; i++) total += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
  // there and back again, round and round while the parade lasts
  const head = total > 0 ? (seconds * speed) % total : 0;
  const out: ParadePiece[] = [];
  for (let k = 0; k <= segments; k++) {
    // the loop ends where it starts: the tail follows round it without a gap
    const d = (((head - k * 0.9) % total) + total) % total;
    const p = pointAt(loop, d);
    const sway = Math.sin(seconds * 2.2 - k * 0.8) * 0.28;
    out.push({ item: k === 0 ? 'dragon_head' : 'dragon_body', x: p.x - p.dy * sway, y: p.y + p.dx * sway, rot: rotOf(p.dx, p.dy), bob: Math.round(3 + 3 * Math.sin(seconds * 5 - k * 0.9)) });
  }
  return out;
}
