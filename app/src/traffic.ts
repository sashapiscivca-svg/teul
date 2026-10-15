// Cars are solid: the hero cannot walk through one, parked or under way, and a car coming on someone standing
// in the road nudges them aside (out of its way, onto the nearest free side) instead of passing through them.

import type { Mover } from './life';

export interface Body {
  x: number;
  y: number;
}

/** Half the length and half the width of a vehicle (tiles) by its footprint, and which axis it runs along. */
function extent(m: Mover, fp: { w: number; d: number } | undefined): { hx: number; hy: number } {
  const len = (fp?.w ?? 2) / 2;
  const wid = (fp?.d ?? 1) / 2;
  return m.rot % 2 === 0 ? { hx: len, hy: wid } : { hx: wid, hy: len };
}

/** The vehicle the body is inside (with a margin for one's own width), if any. */
export function vehicleAt(b: Body, movers: Mover[], footprint: (item: string) => { w: number; d: number } | undefined, margin = 0.28): Mover | null {
  for (const m of movers) {
    if (!isVehicle(m)) continue;
    const { hx, hy } = extent(m, footprint(m.item));
    if (Math.abs(b.x - m.x) < hx + margin && Math.abs(b.y - m.y) < hy + margin) return m;
  }
  return null;
}

/** What counts as a vehicle one bumps into (not the animals, not a horse and rider at the races). */
export function isVehicle(m: Mover): boolean {
  return /car|taxi|truck|van|bus|ambulance|cart|tractor|police|cyclist|bicycle/.test(m.item) || !!m.kind;
}

/** Where to step aside from a car on top of the body: to whichever side of it is nearer, just clear of it. */
export function stepAside(b: Body, m: Mover, footprint: { w: number; d: number } | undefined, margin = 0.3): Body {
  const { hx, hy } = extent(m, footprint);
  // across the car's way (its width), to the nearer side
  if (m.rot % 2 === 0) {
    const side = b.y >= m.y ? 1 : -1;
    return { x: b.x, y: m.y + side * (hy + margin + 0.02) };
  }
  const side = b.x >= m.x ? 1 : -1;
  return { x: m.x + side * (hx + margin + 0.02), y: b.y };
}
