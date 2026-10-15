// How the townsfolk get about, drawn with them: a wheelchair (the person sits in it and it rolls), a pram pushed
// ahead (a young parent), a walking stick (an elder). Same 32x32 grid and pixel style as the figures; parts
// behind the person are drawn before the figure, parts in front after it.

import { joinLayers } from './layers';
import { figureLayers, propLayers, type Dir, type Fx, type Look } from './character';
import type { Layer } from './sprites';

export interface Traits {
  mobility?: string | null;
  pram?: boolean;
}

const FRAME = '#5a6078';
const TIRE = '#2a2630';
const RIM = '#a8aec0';
const SEAT = '#3a5a8a';
const HANDLE = '#3a3a44';
const CANE = '#7a5232';
const PRAMS = ['#8ab8d8', '#e8a0b8', '#a8d8a0', '#e8d080'];

type Paint = { r: (x: number, y: number, w: number, h: number, c: string) => void; p: (x: number, y: number, c: string | null) => void };

/** A wheel seen from the side: a tyre ring, the rim, spokes that turn with `turn`. */
function wheel(c: Paint, cx: number, cy: number, rad: number, turn: number): void {
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    c.p(Math.round(cx + Math.cos(t) * rad), Math.round(cy + Math.sin(t) * rad), TIRE);
    c.p(Math.round(cx + Math.cos(t) * (rad - 1)), Math.round(cy + Math.sin(t) * (rad - 1)), RIM);
  }
  for (let k = 0; k < 4; k++) {
    const t = ((k + turn * 0.5) / 4) * Math.PI;
    for (let d = 1; d < rad - 1; d++) {
      c.p(Math.round(cx + Math.cos(t) * d), Math.round(cy + Math.sin(t) * d), FRAME);
      c.p(Math.round(cx - Math.cos(t) * d), Math.round(cy - Math.sin(t) * d), FRAME);
    }
  }
  c.p(cx, cy, RIM);
}

function chair(dir: Dir, turn: number): { back: Layer[]; front: Layer[] } {
  if (dir === 'right' || dir === 'left') {
    const flip = dir === 'left';
    const back = propLayers(`chair|side|back`, (c) => {
      c.r(6, 12, 3, 1, FRAME); // push handle
      c.r(8, 12, 2, 12, FRAME); // the back post
      c.r(9, 14, 2, 8, SEAT); // the backrest
      c.r(9, 23, 12, 2, SEAT); // the seat
      c.r(10, 19, 8, 1, FRAME); // armrest
      c.r(11, 20, 1, 3, FRAME);
    }, flip);
    const front = propLayers(`chair|side|front|${turn % 2}`, (c) => {
      wheel(c, 13, 24, 5, turn % 2);
      c.r(20, 25, 1, 3, FRAME); // the leg to the footrest
      c.r(20, 27, 5, 1, FRAME); // footrest
      c.r(22, 28, 2, 2, TIRE); // caster
    }, flip);
    return { back, front };
  }
  if (dir === 'down') {
    const back = propLayers('chair|down|back', (c) => {
      c.r(8, 12, 2, 2, FRAME);
      c.r(22, 12, 2, 2, FRAME);
    });
    const front = propLayers(`chair|down|front|${turn % 2}`, (c) => {
      for (const x of [5, 24]) {
        c.r(x, 17, 3, 12, TIRE);
        c.r(x + 1, 18, 1, 10, RIM);
        c.p(x + 1, 21 + (turn % 2) * 3, FRAME);
      }
      c.r(7, 19, 3, 1, FRAME);
      c.r(22, 19, 3, 1, FRAME);
      c.r(11, 28, 10, 1, FRAME);
      c.r(10, 29, 2, 2, TIRE);
      c.r(20, 29, 2, 2, TIRE);
    });
    return { back, front };
  }
  // seen from behind: the backrest covers the back; the head shows above it
  const front = propLayers(`chair|up|front|${turn % 2}`, (c) => {
    c.r(8, 11, 2, 2, FRAME);
    c.r(22, 11, 2, 2, FRAME);
    c.r(9, 13, 14, 11, FRAME);
    c.r(10, 14, 12, 9, SEAT);
    for (const x of [5, 24]) {
      c.r(x, 17, 3, 12, TIRE);
      c.r(x + 1, 18, 1, 10, RIM);
      c.p(x + 1, 21 + (turn % 2) * 3, FRAME);
    }
  });
  return { back: [], front };
}

function pram(dir: Dir, color: string, frame: number): { back: Layer[]; front: Layer[] } {
  const hood = shade(color);
  const bob = frame % 2;
  if (dir === 'right' || dir === 'left') {
    const flip = dir === 'left';
    const front = propLayers(`pram|side|${color}|${bob}`, (c) => {
      // the handle from the hands down to the pram
      c.r(19, 18, 2, 1, HANDLE);
      c.p(21, 19, HANDLE);
      c.p(22, 20, HANDLE);
      // the basket, its hood folded up over the end by the handle
      c.r(22, 20 + bob, 8, 5, color);
      c.r(23, 19 + bob, 6, 1, color);
      c.r(22, 16 + bob, 4, 4, hood);
      c.r(26, 18 + bob, 1, 2, hood);
      c.r(23, 25, 6, 1, HANDLE);
      c.r(23, 26, 1, 1, HANDLE);
      c.r(28, 26, 1, 1, HANDLE);
      c.r(22, 27, 2, 2, TIRE);
      c.r(28, 27, 2, 2, TIRE);
    }, flip);
    return { back: [], front };
  }
  if (dir === 'down') {
    // pushed toward us: in front of the person, the hood on the far side
    const front = propLayers(`pram|down|${color}|${bob}`, (c) => {
      c.r(10, 18, 12, 1, HANDLE);
      c.r(10, 19 + bob, 12, 3, hood);
      c.r(9, 22 + bob, 14, 5, color);
      c.r(10, 27, 12, 1, HANDLE);
      c.r(9, 28, 3, 2, TIRE);
      c.r(20, 28, 3, 2, TIRE);
    });
    return { back: [], front };
  }
  // pushed away from us: beyond the person, showing at their sides
  const back = propLayers(`pram|up|${color}|${bob}`, (c) => {
    c.r(4, 17 + bob, 24, 6, color);
    c.r(5, 16 + bob, 22, 1, shade(color));
    c.r(5, 23, 22, 1, HANDLE);
    c.r(4, 24, 3, 2, TIRE);
    c.r(25, 24, 3, 2, TIRE);
  });
  return { back, front: [] };
}

function cane(dir: Dir, frame: number): Layer[] {
  const step = frame % 2;
  if (dir === 'right' || dir === 'left') {
    return propLayers(`cane|side|${step}`, (c) => {
      c.r(18, 18, 3, 1, CANE);
      c.r(20, 19, 1, 10, CANE);
      if (step) c.p(21, 28, CANE);
    }, dir === 'left');
  }
  const x = dir === 'down' ? 23 : 8;
  return propLayers(`cane|${dir}|${step}`, (c) => {
    c.r(x - 1, 18, 2, 1, CANE);
    c.r(x, 19 - step, 1, 10 + step, CANE);
  });
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.round(v * 0.72).toString(16).padStart(2, '0');
  return `#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)}`;
}

/** The pram's colour, the same for one family every day. */
export function pramColor(seed: number): string {
  return PRAMS[seed % PRAMS.length];
}

/**
 * A resident as drawn: the figure in its pose, with what they get about with. Someone in a wheelchair always
 * sits in it (and it rolls along when they move); a parent pushes the pram ahead; an elder walks with a stick.
 */
export function residentLayers(look: Look, dir: Dir, walking: boolean, frame: number, traits: Traits, seed = 0, blink = false, fx: Fx = {}): Layer[] {
  if (traits.mobility === 'wheelchair') {
    const { back, front } = chair(dir, walking ? frame : 0);
    return joinLayers(back, figureLayers(look, dir, 'sit', 0, blink), front);
  }
  // on a frozen lake one glides on skates instead of walking
  const skate = !!fx.skate && walking && !traits.pram && !traits.mobility;
  const body = figureLayers(look, dir, walking && !skate ? 'walk' : 'idle', frame, blink, { ...fx, skate });
  if (traits.pram) {
    const { back, front } = pram(dir, pramColor(seed), walking ? frame : 0);
    return joinLayers(back, body, front);
  }
  if (traits.mobility === 'cane') return joinLayers(body, cane(dir, walking ? frame : 0));
  return body;
}

/** How fast someone walks (cells a second): the old slowly, with a stick slower, a pram and a wheelchair at an
 * easy pace, children quickly — and everyone calmly in the late evening and at night. */
export function walkSpeed(age: string, traits: Traits, minuteOfDay: number): number {
  let v = age === 'child' ? 1.6 : age === 'elder' ? 1.0 : 1.4;
  if (traits.mobility === 'cane') v = 0.75;
  else if (traits.mobility === 'wheelchair') v = 1.15;
  else if (traits.pram) v = 1.05;
  const night = minuteOfDay >= 20 * 60 + 30 || minuteOfDay < 6 * 60;
  return night ? v * 0.7 : v;
}
