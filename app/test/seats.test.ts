import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { worldBoxes } from '../src/models';
import { seatMode, seatSpots } from '../src/seats';
import type { ItemDef, PlacementView } from '../src/types';

const raw = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8')) as { items: ItemDef[] };
const pack = { items: raw.items.map((d) => ({ ...d, actions: d.actions ?? [], tags: d.tags ?? [] })) };
const seats = pack.items.filter((d) => d.actions.includes('sit') || d.actions.includes('rest'));
const at = (d: ItemDef, rot: number): PlacementView => ({ pid: 1, item: d.id, x: 10, y: 10, rot } as PlacementView);
const turn = (v: [number, number], r: number): [number, number] => (r === 0 ? [v[0] || 0, v[1] || 0] : turn([-v[1], v[0]], r - 1));
/** Things whose "rest" is an action, not a place to sit or lie. */
const ACTION_ONLY = new Set(['fireplace', 'kotatsu', 'bandstand']);

describe('every seat and bed of the world', () => {
  it('there are many of them, and each is a seat, a bed or a bath — or knowingly none', () => {
    expect(seats.length).toBeGreaterThan(50);
    for (const d of seats) {
      const modes = d.actions.filter((a) => a === 'sit' || a === 'rest').map((a) => seatMode(d, a));
      if (ACTION_ONLY.has(d.id)) expect(modes.every((m) => m === null), d.id).toBe(true);
      else expect(modes.some((m) => m !== null), d.id).toBe(true);
    }
    expect(seatMode(pack.items.find((d) => d.id === 'bathtub')!, 'rest')).toBe('bath');
    for (const id of ['bed', 'bed_single', 'bunk_bed', 'canopy_bed', 'hospital_bed', 'hammock', 'sun_lounger']) expect(seatMode(pack.items.find((d) => d.id === id)!, 'rest'), id).toBe('lie');
    expect(seatMode(pack.items.find((d) => d.id === 'sofa3')!, 'sit')).toBe('sit');
    expect(seatMode(pack.items.find((d) => d.id === 'sofa3')!, 'rest')).toBe('lie');
  });

  for (const d of seats.filter((x) => seatMode(x, 'sit') === 'sit')) {
    it(`${d.id}: sat on at the seat's height, inside it, facing away from its back, the same when turned`, () => {
      const base = seatSpots(d, at(d, 0));
      expect(base.length, 'somewhere to sit').toBeGreaterThan(0);
      for (let rot = 0; rot < 4; rot++) {
        const p = at(d, rot);
        const spots = seatSpots(d, p);
        expect(spots.length).toBe(base.length);
        const boxes = worldBoxes(d, p, 0);
        const x1 = Math.max(...boxes.map((b) => b.gx + b.gw));
        const y1 = Math.max(...boxes.map((b) => b.gy + b.gd));
        spots.forEach((s, i) => {
          expect(s.x).toBeGreaterThan(p.x);
          expect(s.y).toBeGreaterThan(p.y);
          expect(s.x).toBeLessThan(x1 + 0.01);
          expect(s.y).toBeLessThan(y1 + 0.01);
          expect(s.top, 'a seat, not the floor or the top of the back').toBeGreaterThanOrEqual(14);
          expect(s.top).toBeLessThanOrEqual(72);
          expect(Math.abs(s.front[0]) + Math.abs(s.front[1])).toBe(1);
          // turning the thing turns the way one faces on it
          expect(spots.map((q) => q.front)).toContainEqual(turn(base[i].front, rot));
          // the legs hang in front: nothing of the seat taller than the sitter's lap stands right before them
          const fx = s.x + s.front[0] * 0.42;
          const fy = s.y + s.front[1] * 0.42;
          const blocking = boxes.filter((b) => fx > b.gx && fx < b.gx + b.gw && fy > b.gy && fy < b.gy + b.gd && b.z < s.top - 4 && b.z + b.h > s.top + 16);
          expect(blocking.map((b) => b.slot), `${d.id} rot ${rot}: legs inside`).toEqual([]);
        });
      }
    });
  }

  it('chairs with their back at the far side face the other way (the salon, the church, the hospital)', () => {
    for (const id of ['salon_chair', 'pew', 'waiting_bench', 'old_armchair']) {
      const d = pack.items.find((x) => x.id === id)!;
      expect(seatSpots(d, at(d, 0))[0].front, id).toEqual([0, -1]);
    }
    for (const id of ['armchair', 'sofa3', 'dining_chair_wood', 'chesterfield']) {
      const d = pack.items.find((x) => x.id === id)!;
      expect(seatSpots(d, at(d, 0))[0].front, id).toEqual([0, 1]);
    }
  });

  it('at a picnic table one sits on the benches facing the table, never on its top', () => {
    const d = pack.items.find((x) => x.id === 'picnic_table')!;
    const s = seatSpots(d, at(d, 0));
    expect(s.length).toBe(4);
    for (const q of s) expect(q.top).toBeLessThanOrEqual(36);
    expect(s.filter((q) => q.front[1] === 1)).toHaveLength(2);
    expect(s.filter((q) => q.front[1] === -1)).toHaveLength(2);
  });
});
