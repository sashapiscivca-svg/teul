// Every vehicle is drawn facing the way it goes: its front (headlights, grille, the horse) leads, in all four
// directions — the town's traffic (life.ts), the player's car (drive/rules.ts), and cars left standing.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { facing } from '../src/life';
import { rotOf } from '../src/drive/rules';
import { worldBoxes } from '../src/models';
import type { ItemDef, PlacementView } from '../src/types';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8')) as { items: ItemDef[] };
const vehicles = pack.items.filter((i) => i.category === 'vehicle');
const FRONT = new Set(['light', 'grille', 'horse']);
const HEADINGS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Where the front of a vehicle points on the floor when drawn at `rot`: from its middle to its front parts. */
function frontOf(def: ItemDef, rot: number): [number, number] {
  const p: PlacementView = { pid: 1, item: def.id, x: 0, y: 0, rot, wall: null, on: null, colors: {}, props: {}, known: true };
  const boxes = worldBoxes(def, p, 0);
  const mid = (bs: typeof boxes): [number, number] => {
    const n = bs.reduce((a, b) => a + b.gw * b.gd, 0) || 1;
    return [bs.reduce((a, b) => a + (b.gx + b.gw / 2) * b.gw * b.gd, 0) / n, bs.reduce((a, b) => a + (b.gy + b.gd / 2) * b.gw * b.gd, 0) / n];
  };
  const all = mid(boxes);
  const front = mid(boxes.filter((b) => FRONT.has(b.slot)));
  const dx = front[0] - all[0];
  const dy = front[1] - all[1];
  const n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}

describe('vehicles face the way they go', () => {
  it('every vehicle has a front to lead with', () => {
    expect(vehicles.length).toBeGreaterThan(8);
    for (const v of vehicles) expect(v.model.some((m) => FRONT.has(m.slot)), v.id).toBe(true);
  });

  for (const v of vehicles) {
    it(`${v.id}: the town's traffic and the player's car lead with the front, all four ways`, () => {
      for (const [hx, hy] of HEADINGS) {
        for (const rot of [facing(hx, hy), rotOf(hx, hy, 0)]) {
          const [fx, fy] = frontOf(v, rot);
          expect(fx * hx + fy * hy, `${v.id} going ${hx},${hy} drawn at rot ${rot}`).toBeGreaterThan(0.9);
        }
      }
    });
  }

  it('the traffic and the player’s car agree on the turn for every way', () => {
    for (const [hx, hy] of [...HEADINGS, [0.7, 0.3], [-0.2, 0.9], [-0.9, -0.4], [0.3, -0.95]] as [number, number][]) expect(rotOf(hx, hy, 0)).toBe(facing(hx, hy));
  });
});
