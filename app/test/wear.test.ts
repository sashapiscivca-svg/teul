import { describe, expect, it } from 'vitest';
import { gadgetOf } from '../src/gadgets';
import type { RoomView, WearView } from '../src/types';
import { agedBoxes, agedColor, wearOf, withWear } from '../src/wear';

const room = { placements: [{ pid: 1, item: 'chair', x: 0, y: 0, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true }, { pid: 2, item: 'lamp', x: 1, y: 0, rot: 0, wall: null, on: null, colors: {}, props: { lit: '1' }, known: true }] } as unknown as RoomView;
const view = (pid: number, stage: number): WearView => ({ pid, item: 'x', stage, looks: '', broken: stage === 3, fix: 0, by_hand: false });

describe('things at home show their age', () => {
  it('marks only aged things, keeping their own props', () => {
    const out = withWear(room, [view(1, 0), view(2, 2)]);
    expect(out.placements[0].props).toEqual({});
    expect(out.placements[1].props).toEqual({ lit: '1', wear: '2' });
    expect(withWear(room, [view(1, 0)])).toBe(room);
    expect(wearOf({ wear: '3' })).toBe(3);
    expect(wearOf({ wear: 'x' })).toBe(0);
  });

  it('a colour fades and darkens with age, fabric most; a new one keeps it', () => {
    expect(agedColor('#d9534f', 0, true)).toBe('#d9534f');
    const lum = (c: string) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);
    const sat = (c: string) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v); };
    expect(sat(agedColor('#d9534f', 2, false))).toBeLessThan(sat('#d9534f'));
    expect(sat(agedColor('#d9534f', 2, true))).toBeLessThan(sat(agedColor('#d9534f', 2, false)));
    expect(lum(agedColor('#d9534f', 3, false))).toBeLessThan(lum(agedColor('#d9534f', 1, false)));
  });

  it('a worn thing gets scuffs on top; a broken one sags and cracks', () => {
    const boxes = [{ gx: 0, gy: 0, gw: 1, gd: 1, z: 0, h: 40, slot: 'seat' }, { gx: 0.4, gy: 0.4, gw: 0.1, gd: 0.1, z: 0, h: 30, slot: 'leg' }];
    expect(agedBoxes(boxes, 1, 3)).toBe(boxes);
    const worn = agedBoxes(boxes, 2, 3);
    expect(worn.filter((b) => b.slot === 'scuff')).toHaveLength(2);
    expect(worn.every((b) => b.slot !== 'scuff' || b.z === 40)).toBe(true);
    const broken = agedBoxes(boxes, 3, 3);
    expect(broken[0].z).toBe(0);
    expect(broken.filter((b) => b.slot === 'scuff')).toHaveLength(5);
    // the original boxes are not touched
    expect(boxes[0].z).toBe(0);
  });
});

describe('gadgets in the town', () => {
  const base = { phone: true, laptop: false, walking: false, seated: true, cafe: false, feast: false, working: false, seed: 7, minute: 600 };
  it('nobody holds what they do not have; nobody plays with a phone at work', () => {
    expect(gadgetOf({ ...base, phone: false })).toBeNull();
    expect(gadgetOf({ ...base, working: true })).toBeNull();
  });
  it('a laptop at the café table; phones mostly on benches, now and then a call walking', () => {
    expect(gadgetOf({ ...base, laptop: true, cafe: true })).toBe('laptop');
    const seated = Array.from({ length: 100 }, (_, m) => gadgetOf({ ...base, minute: m * 6 })).filter((g) => g === 'phone').length;
    expect(seated).toBeGreaterThan(40);
    const walking = Array.from({ length: 200 }, (_, m) => gadgetOf({ ...base, seated: false, walking: true, minute: m * 6 }));
    expect(walking.filter((g) => g === 'call').length).toBeGreaterThan(5);
    expect(walking.filter((g) => g === 'call').length).toBeLessThan(60);
    // it stays put for a few minutes
    expect(gadgetOf({ ...base, minute: 601 })).toBe(gadgetOf({ ...base, minute: 602 }));
  });
});
