// A room being built on to the house (builds.rs): the site fenced off next to it, how it looks at each stage of the
// work (dug earth and a cement mixer; bare walls in scaffolding; the roof going on), and the crew at work in the
// day. Only to look at: what is drawn here is not part of the room.

import { DEFAULT_LOOK, figureLayers, type Look } from './character';
import { cellKey } from './geometry';
import type { NpcFigure } from './render';
import type { BuildOrderView, PlacementView, WallSide } from './types';

/** Display-only things get pids from here down (never a real placement's). */
export const SITE_PID = -70000;

export function rectCells(o: { x: number; y: number; w: number; d: number }): [number, number][] {
  const out: [number, number][] = [];
  for (let j = 0; j < o.d; j++) for (let i = 0; i < o.w; i++) out.push([o.x + i, o.y + j]);
  return out;
}

const SIDES: [WallSide, number, number][] = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]];

/** The edges of the site that touch the house (seen from the site's cells). */
export function sharedEdges(rect: [number, number][], house: Set<string>): [number, number, WallSide][] {
  const inside = new Set(rect.map(([x, y]) => cellKey(x, y)));
  const out: [number, number, WallSide][] = [];
  for (const [x, y] of rect) for (const [side, dx, dy] of SIDES) if (!inside.has(cellKey(x + dx, y + dy)) && house.has(cellKey(x + dx, y + dy))) out.push([x, y, side]);
  return out;
}

/** Every outer edge of the site (where its walls stand). */
export function outerEdges(rect: [number, number][]): [number, number, WallSide][] {
  const inside = new Set(rect.map(([x, y]) => cellKey(x, y)));
  const out: [number, number, WallSide][] = [];
  for (const [x, y] of rect) for (const [side, dx, dy] of SIDES) if (!inside.has(cellKey(x + dx, y + dy))) out.push([x, y, side]);
  return out;
}

function prop(n: number, item: string, x: number, y: number, rot = 0): PlacementView {
  return { pid: SITE_PID - n, item, x, y, rot, wall: null, on: null, colors: {}, props: {}, known: true };
}

/** What stands about the site at its stage (only for things the catalog has). */
export function siteProps(o: BuildOrderView, has: (item: string) => boolean): PlacementView[] {
  const out: PlacementView[] = [];
  const x1 = o.x + o.w - 1;
  const y1 = o.y + o.d - 1;
  const base = o.n * 16;
  const put = (k: number, item: string, x: number, y: number, rot = 0) => {
    if (has(item)) out.push(prop(base + k, item, x, y, rot));
  };
  if (o.stage === 0) {
    put(0, 'cement_mixer', o.x + 1, o.y + 1);
    put(1, 'brick_stack', x1 - 1, o.y + 1);
    put(2, 'brick_stack', x1 - 1, y1 - 1);
    put(3, 'wheelbarrow', o.x + 1, y1 - 1);
  } else {
    // scaffolding at the corners, the bricks and the mixer still about
    put(0, 'scaffold', o.x, o.y);
    put(1, 'scaffold', x1, o.y);
    put(2, 'scaffold', o.x, y1);
    put(3, 'scaffold', x1, y1);
    if (o.stage === 1) put(4, 'cement_mixer', o.x + 2, o.y + 1);
    put(5, 'brick_stack', x1 - 2, y1 - 1);
    put(6, 'wheelbarrow', o.x + 2, y1 - 1);
  }
  return out;
}

/** The crew: a mason and a carpenter, in orange, at work on the site in the day (8:00–18:00). */
const CREW: Look[] = [
  { ...DEFAULT_LOOK, top: '#f08a24', top2: '#f4d35e', topStyle: 0, bottom: '#3a4a6a', shoes: '#4a3a30', shoeStyle: 1, hair: '#5a3a28', beard: 2 },
  { ...DEFAULT_LOOK, top: '#f08a24', top2: '#f4d35e', topStyle: 0, bottom: '#4a4a52', shoes: '#4a3a30', shoeStyle: 1, hair: '#c9a050', skin: '#e8b98f' },
];

export function siteWorkers(o: BuildOrderView, minuteOfDay: number, time: number): NpcFigure[] {
  if (o.done || o.due || minuteOfDay < 8 * 60 || minuteOfDay >= 18 * 60) return [];
  const spots: [number, number][] = [[o.x + Math.floor(o.w / 2), o.y + 1], [o.x + 1, o.y + Math.floor(o.d / 2) + 1]];
  return CREW.map((look, i) => {
    const [x, y] = spots[i];
    // now hammering, now carrying across the site and back
    const carry = Math.floor(time / 6 + i * 3) % 3 === 2;
    const t = (time / 3 + i) % 2;
    const dx = carry ? (t < 1 ? t : 2 - t) * Math.min(2, o.w - 3) : 0;
    return {
      id: `builder:${o.n}:${i}`,
      x: x + 0.5 + dx,
      y: y + 0.5,
      layers: figureLayers(look, carry ? (t < 1 ? 'right' : 'left') : i === 0 ? 'up' : 'left', carry ? 'walk' : 'work', Math.floor(time * (carry ? 8 : 3)) % (carry ? 4 : 2)),
      emote: carry ? null : 'hammer',
    };
  });
}
