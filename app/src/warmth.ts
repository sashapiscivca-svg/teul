// Cold and warmth as the hero lives them: what gives heat nearby, how the hero carries themself (hugging
// themself and shivering in the cold, sweating and squinting in the heat, gliding on skates over the ice), and
// what the town's people say when they see someone frozen through. The core decides how warm one feels
// (crates/teul-core/src/warmth.rs); nothing here is ever shown as a number or a bar.

import type { Fx } from './character';
import type { ComfortView } from './engine';
import { t } from './i18n';

/** Things that give off heat, and how close one has to be to feel it (cells). */
export const HEAT: Record<string, number> = {
  stove: 1.8,
  fireplace: 2.6,
  campfire: 3,
  kupala_fire: 3.4,
  bread_oven: 2.4,
  tunnel_oven: 2.4,
};

/** Whether a heat source stands within reach of a point. `on` says whether a gas stove has gas. */
export function nearHeat(x: number, y: number, things: { item: string; x: number; y: number; w: number; d: number }[], gas = true): boolean {
  for (const t of things) {
    const r = HEAT[t.item];
    if (!r || (t.item === 'stove' && !gas)) continue;
    const cx = t.x + t.w / 2;
    const cy = t.y + t.d / 2;
    if (Math.hypot(x - cx, y - cy) <= r + Math.max(t.w, t.d) / 2) return true;
  }
  return false;
}

/** How the hero carries themself. */
export function heroFx(c: ComfortView | null, state: { moving: boolean; seated: boolean; onIce: boolean; outdoors: boolean }): Fx {
  if (!c) return {};
  return {
    hug: c.feel <= -2 && !state.moving && !state.seated,
    breath: c.breath,
    sweat: c.feel >= 2 && !c.hearth && state.outdoors && !state.seated,
    skate: state.onIce && state.moving,
  };
}

/** The walk slows a little when one is frozen through or worn out by the heat. */
export function walkFactor(c: ComfortView | null): number {
  if (!c) return 1;
  if (c.feel <= -3) return 0.85;
  if (c.feel <= -2) return 0.92;
  if (c.feel >= 3 && !c.hearth) return 0.9;
  return 1;
}

const COLD_LINES = [
  'warmth.cold1',
  'warmth.cold2',
  'warmth.cold3',
  'warmth.cold4',
  'warmth.cold5',
];
const HOT_LINES = [
  'warmth.hot1',
  'warmth.hot2',
  'warmth.hot3',
  'warmth.hot4',
];
const WET_LINES = ['warmth.wet1', 'warmth.wet2'];

/** What a passer-by may say on seeing the hero (none when nothing shows). `k` picks among the lines. */
export function remark(c: ComfortView | null, k: number): string | null {
  if (!c) return null;
  const pick = (l: string[]) => t(l[Math.abs(k) % l.length]);
  if (c.wet && c.feel <= 0) return pick(WET_LINES);
  if (c.feel <= -2) return pick(COLD_LINES);
  if (c.feel >= 2 && !c.hearth && c.sun) return pick(HOT_LINES);
  return null;
}

/** The still water of a map as a set of cell keys ("x,y"). */
export function iceCells(runs: [number, number, number][] | undefined): Set<string> {
  const out = new Set<string>();
  for (const [y, x0, x1] of runs ?? []) for (let x = x0; x <= x1; x++) out.add(`${x},${y}`);
  return out;
}
