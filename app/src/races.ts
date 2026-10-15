// Horse races at the racecourse: every half hour through the day six horses parade to the start, run two laps
// of the oval and finish in front of the grandstand. Who wins follows from the day and the hour, so every
// device sees the same race.

import type { Mover } from './life';
import { mix } from './village';
import { t as tr } from './i18n';

/** The oval's centre line (tiles) and where the finishing post is on it. */
export const TRACK = { cx: 30, cy: 21, rx: 22, ry: 13.25 };
export const HORSES = tr('races.horses').split(',');
const EVERY = 30;
const FIRST = 9 * 60;
const LAST = 20 * 60;
/** Seconds of parade before the start, and how long the horses stay after the race. */
const PARADE = 60;
const WINDOW = 6 * 60;
const LAPS = 2;

export interface Race {
  /** World minute it starts (the parade begins then; the off is a minute later). */
  start: number;
  /** Seconds each horse takes to run the race, by horse. */
  times: number[];
  /** The horses by finishing place. */
  order: number[];
}

/** The race on at `minutes` (of world time), if any. */
export function raceAt(minutes: number): Race | null {
  const start = Math.floor(minutes / EVERY) * EVERY;
  const ofDay = ((start % 1440) + 1440) % 1440;
  if (ofDay < FIRST || ofDay >= LAST || (minutes - start) * 60 >= WINDOW) return null;
  const times = HORSES.map((_, i) => 88 + (mix(start, i + 1) % 1300) / 100);
  const order = HORSES.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  return { start, times, order };
}

/** How far round the track a horse is (in laps) `t` seconds after the off. */
function progress(race: Race, i: number, t: number): number {
  if (t <= 0) return 0;
  const T = race.times[i];
  if (t >= T) return LAPS + Math.min(0.12, ((t - T) / 40) * 0.12) * (1 - Math.min(1, (t - T) / 40) / 2);
  // a little surging and fading on the way, which evens out by the line
  const f = t / T;
  return LAPS * (f + 0.015 * Math.sin(f * Math.PI * 3 + i) * Math.sin(f * Math.PI));
}

function facing(dx: number, dy: number): number {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

/** A point of a lane `laps` round from the finishing line (running clockwise on the map). */
function onTrack(laps: number, lane: number): [number, number] {
  const a = Math.PI / 2 - laps * Math.PI * 2;
  return [TRACK.cx + (TRACK.rx + lane) * Math.cos(a), TRACK.cy + (TRACK.ry + lane) * Math.sin(a)];
}

/** The racehorses with their jockeys, where they are now. */
export function raceMovers(minutes: number): Mover[] {
  const race = raceAt(minutes);
  if (!race) return [];
  const t = (minutes - race.start) * 60 - PARADE;
  return HORSES.map((_, i) => {
    const lane = -1.5 + i * 0.6;
    // before the off: walking up to the line, then standing at it
    const p = t < 0 ? Math.max(-0.06, t / 900) : progress(race, i, t);
    const [x, y] = onTrack(p, lane);
    const [nx, ny] = onTrack(p + 0.01, lane);
    const running = t > 0 && t < race.times[i];
    return { item: `horse_rider_${i}`, x, y, rot: facing(nx - x, ny - y), bob: running ? Math.round(Math.sin(minutes * 60 * 14 + i) * 1) : 0 };
  });
}

/** What the course announces now: the start, the winner; null in between. */
export function raceNews(minutes: number): { key: string; text: string } | null {
  const race = raceAt(minutes);
  if (!race) return null;
  const t = (minutes - race.start) * 60 - PARADE;
  const hh = String(Math.floor((race.start % 1440) / 60)).padStart(2, '0');
  const mm = String(race.start % 60).padStart(2, '0');
  if (t < 0) return { key: `${race.start}:parade`, text: tr('races.parade', { time: `${hh}:${mm}` }) };
  if (t < race.times[race.order[0]]) return { key: `${race.start}:off`, text: tr('races.off') };
  const [a, b, c] = race.order.map((i) => `${HORSES[i]} (№${i + 1})`);
  return { key: `${race.start}:won`, text: tr('races.won', { a, b, c }) };
}
