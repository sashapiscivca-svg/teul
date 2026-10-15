// Someone in a bed, on a sofa, in a hammock or in a bath is drawn as part of the thing itself: their head on the
// pillow, the body a bump under the blanket (or lying on the cushions in their clothes), in the water up to the
// chest. Being boxes of the model, they are lit, turned and hidden by the headboard or the bath's rim like any
// other part, in every view and rotation. Sitting, the parts of the seat nearer to the eye than the sitter (the
// back of a chair turned away, the near arm of an armchair) are drawn again over them.

import { rotXY, type View } from '../geometry';
import { worldBoxes } from '../models';
import type { ItemDef, PlacementView, Primitive } from '../types';

export type Rest = 'lie' | 'bath';

/** The colours of the one lying there (a character look has all of them). */
export interface Sleeper {
  skin: string;
  hair: string;
  eye: string;
  top: string;
  bottom: string;
  shoes: string;
}

const SOFT = /^(cushion|sheet|blanket|body|seat|mattress|cloth|water)$/;
type Box = Primitive['box'];

interface Bed {
  /** The long way of the thing in its own model: x or y. */
  long: 'x' | 'y';
  /** The head lies at the low end of the long way. */
  headLow: boolean;
  a0: number;
  a1: number;
  c0: number;
  c1: number;
  /** The top of what one lies on (or the water's surface). */
  top: number;
  pillowTop: number | null;
  blanket: { a0: number; a1: number; top: number } | null;
  pillowAcross: number | null;
}

const along = (b: Box, long: 'x' | 'y'): [number, number] => (long === 'y' ? [b[1], b[1] + b[4]] : [b[0], b[0] + b[3]]);
const across = (b: Box, long: 'x' | 'y'): [number, number] => (long === 'y' ? [b[0], b[0] + b[3]] : [b[1], b[1] + b[4]]);
const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

function bedOf(def: ItemDef, mode: Rest): Bed | null {
  const long: 'x' | 'y' = def.footprint.d >= def.footprint.w ? 'y' : 'x';
  const soft = def.model.filter((m) => (mode === 'bath' ? m.slot === 'water' : SOFT.test(m.slot) && m.slot !== 'water') && m.box[2] + m.box[5] <= 80);
  if (soft.length === 0) return null;
  const a0 = Math.min(...soft.map((m) => along(m.box, long)[0]));
  const a1 = Math.max(...soft.map((m) => along(m.box, long)[1]));
  const c0 = Math.min(...soft.map((m) => across(m.box, long)[0]));
  const c1 = Math.max(...soft.map((m) => across(m.box, long)[1]));
  const centre = (a0 + a1) / 2;
  // on a lounger or a sofa the cushions are not all one height: lie on the low ones, the high one is the back
  const lowTop = (ms: Primitive[]) => Math.min(...ms.map((m) => m.box[2] + m.box[5]));
  const tops = soft.map((m) => m.box[2] + m.box[5]);
  let top = Math.max(...tops);
  const pillows = def.model.filter((m) => m.slot === 'pillow');
  const tap = def.model.find((m) => m.slot === 'tap');
  let headLow = true;
  let backTop: number | null = null;
  if (pillows.length > 0) headLow = mid(along(pillows[0].box, long)) < centre;
  else if (tap) headLow = mid(along(tap.box, long)) > centre;
  else if (soft.length > 1 && lowTop(soft) < top - 12) {
    // the raised cushion is the backrest: the head goes there
    const back = soft.reduce((a, b) => (a.box[2] + a.box[5] > b.box[2] + b.box[5] ? a : b));
    headLow = mid(along(back.box, long)) < centre;
    backTop = top;
    top = lowTop(soft);
  }
  const blankets = def.model.filter((m) => m.slot === 'blanket');
  const blanket =
    mode === 'lie' && blankets.length > 0
      ? {
          a0: Math.min(...blankets.map((m) => along(m.box, long)[0])),
          a1: Math.max(...blankets.map((m) => along(m.box, long)[1])),
          top: Math.max(...blankets.map((m) => m.box[2] + m.box[5])),
        }
      : null;
  const pillowTop = pillows.length > 0 ? Math.max(...pillows.map((m) => m.box[2] + m.box[5])) : backTop;
  // on a double bed one lies on one pillow, not in the gap between the two
  const middle = (c0 + c1) / 2;
  const pillowAcross = pillows.length > 0 ? pillows.map((m) => mid(across(m.box, long))).reduce((a, b) => (Math.abs(a - middle) <= Math.abs(b - middle) ? a : b)) : null;
  return { long, headLow, a0, a1, c0, c1, top, pillowTop, blanket, pillowAcross };
}

/** The model of a bed, sofa or bath with someone lying in it; null when it has nowhere to lie. */
export function occupiedModel(def: ItemDef, mode: Rest): Primitive[] | null {
  const b = bedOf(def, mode);
  if (!b) return null;
  const L = b.a1 - b.a0;
  const cc = b.pillowAcross ?? (b.c0 + b.c1) / 2;
  const at = (f: number) => (b.headLow ? b.a0 + f * L : b.a1 - f * L);
  const box = (f0: number, f1: number, width: number, z: number, h: number, slot: string, off = 0): Primitive => {
    const p = Math.round(Math.min(at(f0), at(f1)));
    const q = Math.round(Math.max(at(f0), at(f1)));
    // never past the edge of what one lies on
    const c = Math.round(Math.max(b.c0, Math.min(b.c1 - width, cc + off - width / 2)));
    const bx: Box = b.long === 'y' ? [c, p, Math.round(z), Math.round(width), q - p, Math.round(h)] : [p, c, Math.round(z), q - p, Math.round(width), Math.round(h)];
    return { box: bx, slot };
  };
  const extra: Primitive[] = [];
  // the head lies along the bed in the middle of its width (a double bed: still the middle), face up
  const head = (f0: number, f1: number, z: number, h: number, open: boolean) => {
    const hair = f0 + (f1 - f0) * 0.42;
    extra.push(box(f0, f1, 34, z, h, 'occ_skin'));
    extra.push(box(f0 - 0.015, hair, 40, z, h + 3, 'occ_hair'));
    // the eyes, just below the hairline: closed (a line) or open (dots)
    const e0 = hair + (f1 - hair) * 0.18;
    const e1 = e0 + (open ? 0.03 : 0.018);
    extra.push(box(e0, e1, 7, z + h, 1, 'occ_eye', -8));
    extra.push(box(e0, e1, 7, z + h, 1, 'occ_eye', 8));
  };
  if (mode === 'bath') {
    const w = b.top;
    // shoulders under the water, the head above it, knees up out of it, foam about
    extra.push(box(0.2, 0.42, 50, w - 16, 12, 'occ_skin'));
    head(0.05, 0.27, w - 8, 26, true);
    extra.push(box(0.62, 0.74, 14, w - 12, 15, 'occ_skin', -11));
    extra.push(box(0.62, 0.74, 14, w - 12, 15, 'occ_skin', 11));
    for (let i = 0; i < 7; i++) extra.push(box(0.3 + i * 0.09, 0.36 + i * 0.09, 12, w, 3, 'occ_foam', ((i * 37) % 5) * 9 - 18));
    return [...def.model, ...extra];
  }
  const z = b.top;
  const pz = b.pillowTop !== null ? b.pillowTop - 6 : z;
  head(0.03, 0.22, pz, 24, false);
  if (b.blanket) {
    // under the blanket: shoulders in the top's colour where it is turned down, the body a bump in it
    const bl0 = Math.max(0.2, Math.min(0.45, ((b.headLow ? b.blanket.a0 - b.a0 : b.a1 - b.blanket.a1) / L)));
    extra.push(box(0.21, bl0 + 0.03, 52, z - 4, 14, 'occ_top'));
    extra.push(box(bl0, 0.62, 56, b.blanket.top - 2, 9, 'blanket'));
    extra.push(box(0.62, 0.93, 44, b.blanket.top - 2, 6, 'blanket'));
    extra.push(box(0.86, 0.94, 40, b.blanket.top + 2, 5, 'blanket'));
  } else {
    // on the cushions in their clothes
    extra.push(box(0.2, 0.52, 44, z, 14, 'occ_top'));
    extra.push(box(0.24, 0.48, 10, z, 10, 'occ_skin', -26));
    extra.push(box(0.52, 0.88, 34, z, 10, 'occ_bottom'));
    extra.push(box(0.88, 0.96, 30, z, 15, 'occ_shoes'));
  }
  return [...def.model, ...extra];
}

/** Where the head is (tiles and hundredths up), for the sleeper's z's. */
export function headPoint(def: ItemDef, p: PlacementView, mode: Rest): { x: number; y: number; z: number } | null {
  const model = occupiedModel(def, mode);
  if (!model) return null;
  const local: ItemDef = { ...def, model: model.filter((m) => m.slot === 'occ_hair') };
  const [h] = worldBoxes(local, p, 0);
  return h ? { x: h.gx + h.gw / 2, y: h.gy + h.gd / 2, z: h.z + h.h } : null;
}

export function sleeperColors(s: Sleeper): Record<string, string> {
  return { occ_skin: s.skin, occ_hair: s.hair, occ_eye: '#2a2030', occ_top: s.top, occ_bottom: s.bottom, occ_shoes: s.shoes, occ_foam: '#ffffff' };
}

/**
 * The parts of a seat to draw over someone sitting at (x, y) at `seatTop` (hundredths): what rises above the
 * seat and stands nearer the eye than they do. Indices into the model.
 */
export function nearParts(def: ItemDef, p: PlacementView, view: View, x: number, y: number, seatTop: number): number[] {
  const boxes = worldBoxes(def, p, 0);
  const [sx, sy] = rotXY(view, x, y);
  const out: number[] = [];
  boxes.forEach((b, i) => {
    if (b.z + b.h <= seatTop + 6) return;
    const [bx, by] = rotXY(view, b.gx + b.gw / 2, b.gy + b.gd / 2);
    if (bx + by > sx + sy + 0.12) out.push(i);
  });
  return out;
}
