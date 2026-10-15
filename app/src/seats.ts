// Where one sits or lies on a thing, read from its model rather than assumed: for each cell of a seat, the
// height of what one sits on there and the way one faces (away from its back); which things are lain on
// (beds, sofas to rest on, a hammock, a lounger) and which only look like seats (a fireplace, a kotatsu, the
// bandstand). Used for the hero and for everyone in town, so all sit the same way.

import { footprintCells, worldBoxes, type WorldBox } from './models';
import type { ItemDef, PlacementView } from './types';

export type SeatMode = 'sit' | 'lie' | 'bath';

/** Things lain on when rested on (sofas) or always (a bed, a hammock, a lounger). */
const LIE_ON_REST = /^(bed|bed_single|bunk_bed|canopy_bed|futon|hospital_bed|sofa|sofa2|sofa3|sofa_l|sofa_modern2|sofa_modern3|chesterfield|loveseat|wicker_sofa|window_seat|hammock|sun_lounger)$/;
const LIE_ALWAYS = /^(hammock|sun_lounger)$/;
/** "Rest" here is not sitting on it: warming at the fire, sitting by the kotatsu (the action alone). */
const NOT_A_SEAT = /^(fireplace|kotatsu|bandstand)$/;
/** Seats along the sides of a table: one sits on the benches, never on the top. */
const TABLE_BENCHES = /^(picnic_table)$/;
/** Parts that are not sat on even when low (legs, frames, ropes, the water of a bath). */
const NOT_SITTING_PART = /^(legs|base|rope|post|frame|feet|tap|rocker|ring|kneeler|button|dust|mane|metal|stand)$/;

/** How a thing is used by "sit" or "rest", or null when it is not a seat at all. */
export function seatMode(def: ItemDef, action: string): SeatMode | null {
  if (def.layer !== 'floor' || NOT_A_SEAT.test(def.id)) return null;
  if (!def.actions.includes('sit') && !def.actions.includes('rest')) return null;
  if (def.id === 'bathtub') return action === 'rest' ? 'bath' : null;
  if (LIE_ALWAYS.test(def.id)) return 'lie';
  if (action === 'rest' && LIE_ON_REST.test(def.id)) return 'lie';
  // a bed's "rest" is lying; nothing sits on a bed
  if (/bed|futon/.test(def.id) && !def.actions.includes('sit')) return 'lie';
  return 'sit';
}

export interface SeatSpot {
  pid: number;
  /** The middle of the cell, in tiles. */
  x: number;
  y: number;
  /** The top of what one sits on, in hundredths of a tile. */
  top: number;
  /** The way the sitter faces (a unit step on the grid). */
  front: [number, number];
}

/** Things sat on right on the floor, cross-legged (a meditation cushion, a mat): the lotus pose, palms together. */
const ON_THE_FLOOR = /^(zafu|meditation_mat|ritual_mat)$/;

/** How one sits on a thing: on a chair's seat, or cross-legged on the floor. */
export function sittingPose(item: string | undefined): 'sit' | 'lotus' {
  return item && ON_THE_FLOOR.test(item) ? 'lotus' : 'sit';
}

/** Seats whose model hides what is sat on (a hollow egg, a horse's saddle). */
const SEAT_TOP: Record<string, number> = { egg_chair: 44, rocking_horse: 42 };

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** The places to sit on a placed thing: each cell one can sit on, how high, facing which way. */
export function seatSpots(def: ItemDef, p: PlacementView): SeatSpot[] {
  if (seatMode(def, 'sit') !== 'sit') return [];
  const boxes = worldBoxes(def, p, 0);
  const cells = footprintCells(def, p.rot).map(([dx, dy]) => [p.x + dx, p.y + dy] as [number, number]);
  const sitting = boxes.filter((b) => !NOT_SITTING_PART.test(b.slot) && b.z + b.h <= 72 && b.z + b.h >= 8);
  const all = { x0: Math.min(...boxes.map((b) => b.gx)), y0: Math.min(...boxes.map((b) => b.gy)), x1: Math.max(...boxes.map((b) => b.gx + b.gw)), y1: Math.max(...boxes.map((b) => b.gy + b.gd)) };
  const out: SeatSpot[] = [];
  for (const [cx, cy] of cells) {
    const inCell = (b: WorldBox) => Math.max(0, overlap(b.gx, b.gx + b.gw, cx, cx + 1)) * Math.max(0, overlap(b.gy, b.gy + b.gd, cy, cy + 1));
    if (TABLE_BENCHES.test(def.id)) {
      // the benches are the low boards along the sides; the table top in the middle is not a seat
      const bench = sitting.filter((b) => b.z + b.h <= 50 && inCell(b) > 0.08).sort((a, b) => inCell(b) - inCell(a))[0];
      if (!bench) continue;
      const mid = { x: (all.x0 + all.x1) / 2, y: (all.y0 + all.y1) / 2 };
      const bx = Math.min(cx + 0.9, Math.max(cx + 0.1, bench.gx + bench.gw / 2));
      const by = Math.min(cy + 0.9, Math.max(cy + 0.1, bench.gy + bench.gd / 2));
      // facing the table across the bench
      const front: [number, number] = bench.gw >= bench.gd ? [0, by < mid.y ? 1 : -1] : [bx < mid.x ? 1 : -1, 0];
      out.push({ pid: p.pid, x: bench.gw >= bench.gd ? cx + 0.5 : bx, y: bench.gw >= bench.gd ? by : cy + 0.5, top: bench.z + bench.h, front });
      continue;
    }
    // what one sits on: the highest broad part under the middle of the cell (not an arm, a pillow or a back)
    const under = sitting.filter((b) => overlap(b.gx, b.gx + b.gw, cx + 0.3, cx + 0.7) > 0 && overlap(b.gy, b.gy + b.gd, cy + 0.3, cy + 0.7) > 0 && inCell(b) >= 0.2);
    const seat = under.sort((a, b) => b.z + b.h - (a.z + a.h))[0];
    const top = SEAT_TOP[def.id] ?? (seat ? seat.z + seat.h : Math.min(46, Math.max(...boxes.map((b) => b.z + b.h))));
    // sitting on the middle of the seat itself (a chair's seat is in front of its back)
    const sx = seat ? Math.min(cx + 0.8, Math.max(cx + 0.2, Math.max(seat.gx, cx) / 2 + Math.min(seat.gx + seat.gw, cx + 1) / 2)) : cx + 0.5;
    const sy = seat ? Math.min(cy + 0.8, Math.max(cy + 0.2, Math.max(seat.gy, cy) / 2 + Math.min(seat.gy + seat.gd, cy + 1) / 2)) : cy + 0.5;
    out.push({ pid: p.pid, x: sx, y: sy, top, front: frontOf(boxes, top, cx, cy, p.rot) });
  }
  return out;
}

/** Away from the back: the tall parts behind the seat, weighed by how tall they are. Without a back (a stool,
 * a bench) the way the thing was turned. */
export function frontOf(boxes: WorldBox[], top: number, cx: number, cy: number, rot: number): [number, number] {
  const turned = [[0, 1], [-1, 0], [0, -1], [1, 0]][rot & 3] as [number, number];
  const backs = boxes.filter((b) => b.z + b.h > top + 14 && !/^(post|rope|frame|roof|canopy|tap)$/.test(b.slot));
  let sx = 0;
  let sy = 0;
  for (const b of backs) {
    // only what stands beside or across this cell counts
    const nearX = overlap(b.gx, b.gx + b.gw, cx, cx + 1) > 0;
    const nearY = overlap(b.gy, b.gy + b.gd, cy, cy + 1) > 0;
    if (!nearX && !nearY) continue;
    const w = (b.z + b.h - top) * b.gw * b.gd;
    const bx = b.gx + b.gw / 2 - (cx + 0.5);
    const by = b.gy + b.gd / 2 - (cy + 0.5);
    // a back is long and thin: its side is where it is thin
    if (b.gw >= b.gd * 1.5 && nearX) sy += Math.sign(by) * w;
    else if (b.gd >= b.gw * 1.5 && nearY) sx += Math.sign(bx) * w;
  }
  if (Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6) return turned;
  // the arms of an armchair are as tall as its back but at both sides: they cancel out, the back does not
  if (Math.abs(sy) >= Math.abs(sx)) return [0, sy > 0 ? -1 : 1];
  return [sx > 0 ? -1 : 1, 0];
}
