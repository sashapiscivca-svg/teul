import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headPoint, nearParts, occupiedModel } from '../src/pixel/occupant';
import type { ItemDef, PlacementView } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const items: Record<string, ItemDef> = Object.fromEntries(pack.items.map((i: ItemDef) => [i.id, { ...i, tags: i.tags ?? [], actions: i.actions ?? [] }]));
const at = (item: string, rot = 0): PlacementView => ({ pid: 1, item, x: 0, y: 0, rot, wall: null, on: null, colors: {}, props: {}, known: true });
const extra = (def: ItemDef, mode: 'lie' | 'bath') => (occupiedModel(def, mode) ?? []).slice(def.model.length);

describe('someone lying in a thing is part of its model', () => {
  it('lays the head on the pillow, not at the feet, whichever way the bed is turned', () => {
    const bed = items.bed;
    const pillowY = bed.model.filter((m) => m.slot === 'pillow')[0].box[1];
    const hair = extra(bed, 'lie').find((m) => m.slot === 'occ_hair')!;
    expect(Math.abs(hair.box[1] - pillowY)).toBeLessThan(40);
    // turned, the head follows the pillow round (the pillow is at the bed's low-y end: after a half turn, high y)
    const h0 = headPoint(bed, at('bed', 0), 'lie')!;
    const h2 = headPoint(bed, at('bed', 2), 'lie')!;
    expect(h0.y).toBeLessThan(1);
    expect(h2.y).toBeGreaterThan(1);
  });

  it('rests the head on the pillow and puts the body under the blanket', () => {
    const bed = items.bed;
    const pillowTop = Math.max(...bed.model.filter((m) => m.slot === 'pillow').map((m) => m.box[2] + m.box[5]));
    const skin = extra(bed, 'lie').find((m) => m.slot === 'occ_skin')!;
    expect(skin.box[2]).toBeLessThanOrEqual(pillowTop);
    expect(skin.box[2] + skin.box[5]).toBeGreaterThan(pillowTop);
    // no legs or shoes showing: the blanket covers them
    expect(extra(bed, 'lie').some((m) => m.slot === 'occ_bottom' || m.slot === 'occ_shoes')).toBe(false);
    expect(extra(bed, 'lie').some((m) => m.slot === 'blanket')).toBe(true);
  });

  it('keeps everyone inside the footprint of what they lie in', () => {
    for (const id of ['bed', 'bed_single', 'bunk_bed', 'canopy_bed', 'futon', 'hammock', 'sun_lounger', 'chesterfield', 'sofa2', 'sofa3']) {
      const def = items[id];
      if (!def) continue;
      for (const m of extra(def, 'lie')) {
        const [x, y, , w, d] = m.box;
        expect(x, `${id} ${m.slot}`).toBeGreaterThanOrEqual(0);
        expect(y, `${id} ${m.slot}`).toBeGreaterThanOrEqual(0);
        expect(x + w, `${id} ${m.slot}`).toBeLessThanOrEqual(def.footprint.w * 100);
        expect(y + d, `${id} ${m.slot}`).toBeLessThanOrEqual(def.footprint.d * 100);
      }
    }
  });

  it('lies in the bath with the head away from the tap, above the water, the shoulders under it', () => {
    const tub = items.bathtub;
    const tapX = tub.model.find((m) => m.slot === 'tap')!.box[0];
    const water = tub.model.find((m) => m.slot === 'water')!;
    const surface = water.box[2] + water.box[5];
    const ex = extra(tub, 'bath');
    const hair = ex.find((m) => m.slot === 'occ_hair')!;
    expect(Math.abs(hair.box[0] - tapX)).toBeGreaterThan(100);
    expect(hair.box[2] + hair.box[5]).toBeGreaterThan(surface);
    const shoulders = ex.find((m) => m.slot === 'occ_skin')!;
    expect(shoulders.box[2] + shoulders.box[5]).toBeLessThan(surface);
  });

  it('on a lounger lays the head on the raised back', () => {
    const l = items.sun_lounger;
    const hair = extra(l, 'lie').find((m) => m.slot === 'occ_hair')!;
    expect(hair.box[1]).toBeLessThan(50);
    expect(hair.box[2]).toBeGreaterThan(30);
  });
});

describe('a seat drawn over the one sitting on it', () => {
  it('covers the sitter with the chair back only when the back is nearer the eye', () => {
    const chair = items.dining_chair_wood;
    // the back is at the chair's low-y side; turned 0 it faces +y: in view 0 the back is behind the sitter
    expect(nearParts(chair, at('dining_chair_wood', 0), 0, 0.5, 0.5, 50)).toEqual([]);
    // turned round, the back is between the eye and the sitter
    const back = chair.model.findIndex((m) => m.box[5] === 44);
    expect(nearParts(chair, at('dining_chair_wood', 2), 0, 0.5, 0.5, 50)).toContain(back);
  });

  it('never covers the sitter with the seat or the legs under it', () => {
    const stool = items.stool;
    for (let r = 0; r < 4; r++) for (let v = 0; v < 4; v++) expect(nearParts(stool, at('stool', r), v as 0, 0.5, 0.5, 49)).toEqual([]);
  });
});
