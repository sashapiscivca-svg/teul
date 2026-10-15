import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rasterize, type RPrim } from '../src/pixel/raycast';
import { itemPrims } from '../src/pixel/items';
import type { ItemDef, PlacementView } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const items: ItemDef[] = Array.isArray(pack.items) ? pack.items : Object.values(pack.items);
const byId = new Map(items.map((i) => [i.id, i]));

function primsOf(id: string, rot = 0, view: 0 | 1 | 2 | 3 = 0): RPrim[] {
  const def = byId.get(id) as ItemDef;
  const p: PlacementView = { pid: 1, item: id, x: 3, y: 5, rot, wall: def.layer === 'wall' ? 'north' : null, on: null, colors: {}, props: {}, known: true };
  return itemPrims(def, p, 0, view, { season: 'Autumn:1' });
}

/** A small random scene of every shape, glass among them, overlapping and touching. */
function scene(seed: number): RPrim[] {
  let s = seed;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const shapes = ['box', 'cyl', 'ball', 'cone', 'gable', 'gable_y', 'round'];
  return Array.from({ length: 30 }, (_, i) => ({
    gx: Math.round(r() * 8) / 4,
    gy: Math.round(r() * 8) / 4,
    gw: 0.1 + Math.round(r() * 6) / 4,
    gd: 0.1 + Math.round(r() * 6) / 4,
    z: Math.round(r() * 80),
    h: 2 + Math.round(r() * 90),
    shape: shapes[i % shapes.length],
    color: ['#c8423a', '#4a9458', '#e8a23a', '#6a5688'][i % 4],
    alpha: i % 9 === 4 ? 0.35 : undefined,
    glow: i % 11 === 5 ? '#fff3c4' : undefined,
    material: ['wood', 'stone', 'leaf', undefined][i % 4],
  }));
}

describe('the ray caster', () => {
  it('draws every pixel exactly as testing every part for it would', () => {
    const cases: RPrim[][] = [
      ...[1, 2, 3, 4, 5, 6].map(scene),
      primsOf('mountain'),
      primsOf('mountain', 1, 3),
      primsOf('cafe_house', 2),
      primsOf('worn_cafe_house_roof', 1, 1),
      primsOf('bakery'),
    ];
    for (const prims of cases) {
      const fast = rasterize(prims);
      const full = rasterize(prims, true);
      expect([fast.x, fast.y, fast.w, fast.h]).toEqual([full.x, full.y, full.w, full.h]);
      expect(Buffer.from(fast.mask).equals(Buffer.from(full.mask))).toBe(true);
      expect(Buffer.from(fast.rgba).equals(Buffer.from(full.rgba))).toBe(true);
    }
  });

  it('draws a many-part model quickly (the mountain by Lypove, not a quarter of a second)', () => {
    const prims = primsOf('mountain');
    rasterize(prims);
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) rasterize(prims);
    const ms = (performance.now() - t0) / 3;
    const t1 = performance.now();
    rasterize(prims, true);
    const full = performance.now() - t1;
    expect(ms).toBeLessThan(full / 4);
  });
});
