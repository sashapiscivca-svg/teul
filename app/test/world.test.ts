import { describe, expect, it } from 'vitest';
import { blockedCells, groundAt, nearestInteractable, RADIUS, stepWalker, WALK_SPEED, type Walker } from '../src/world';
import type { Catalog, ItemDef, PlacementView, RoomView } from '../src/types';

function def(over: Partial<ItemDef> & { id: string }): ItemDef {
  return {
    name: `item.${over.id}`,
    category: 'x',
    tags: [],
    footprint: { w: 1, d: 1 },
    layer: 'floor',
    rules: { provides_surface: false },
    model: [],
    slots: {},
    actions: [],
    acquire: 'free',
    ...over,
  };
}

const catalog = {
  items: {
    sofa: def({ id: 'sofa', footprint: { w: 3, d: 1 }, actions: ['sit'] }),
    rug: def({ id: 'rug', footprint: { w: 2, d: 2 }, layer: 'rug' }),
    cup: def({ id: 'cup', layer: 'surface', actions: ['brew_tea'] }),
    table: def({ id: 'table', footprint: { w: 2, d: 2 }, rules: { provides_surface: true } }),
    picture: def({ id: 'picture', layer: 'wall' }),
    door: def({ id: 'door', layer: 'wall', tags: ['door'], actions: ['enter'] }),
    window: def({ id: 'window', layer: 'wall', footprint: { w: 2, d: 1 }, tags: ['window'] }),
  },
} as unknown as Catalog;

function place(over: Partial<PlacementView> & { pid: number; item: string }): PlacementView {
  return { x: 0, y: 0, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true, ...over };
}

function roomOf(placements: PlacementView[], w = 6, h = 6, dividers: RoomView['dividers'] = []): RoomView {
  const cells: [number, number][] = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) cells.push([x, y]);
  return {
    cells, styles: {}, style_params: {}, placements, floor_paint: {}, wall_paint: {}, dividers, settings: {},
    area_budget: cells.length, area_used: cells.length,
  };
}

const DOOR = place({ pid: 90, item: 'door', x: 0, y: 4, wall: 'west' });
const WINDOW = place({ pid: 92, item: 'window', x: 1, y: 0, wall: 'north' });

const at = (x: number, y: number): Walker => ({ x, y, facing: 'right' });

describe('blockedCells', () => {
  it('blocks floor furniture but not rugs, surface items or wall items', () => {
    const room = roomOf([
      place({ pid: 0, item: 'sofa', x: 3, y: 0 }),
      place({ pid: 1, item: 'rug', x: 0, y: 0 }),
      place({ pid: 2, item: 'table', x: 0, y: 3 }),
      place({ pid: 3, item: 'cup', x: 0, y: 3, on: 2 }),
      place({ pid: 4, item: 'picture', wall: 'west', x: 0, y: 1 }),
    ]);
    const blocked = blockedCells(room, catalog);
    expect([...blocked].sort()).toEqual(['0,3', '0,4', '1,3', '1,4', '3,0', '4,0', '5,0'].sort());
  });

  it('honours rotation', () => {
    const blocked = blockedCells(roomOf([place({ pid: 0, item: 'sofa', x: 0, y: 0, rot: 1 })]), catalog);
    expect([...blocked].sort()).toEqual(['0,0', '0,1', '0,2']);
  });

  it('ignores items missing from the catalog', () => {
    expect(blockedCells(roomOf([place({ pid: 0, item: 'ghost', known: false })]), catalog).size).toBe(0);
  });
});

describe('stepWalker', () => {
  const room = roomOf([]);

  it('does not move without input', () => {
    const w = at(2.5, 2.5);
    stepWalker(w, 0, 0, 0.1, room, catalog);
    expect(w).toMatchObject({ x: 2.5, y: 2.5 });
  });

  it('moves at the walking speed along the screen direction', () => {
    const right = at(2.5, 2.5);
    stepWalker(right, 1, 0, 0.1, room, catalog);
    // screen-right is grid +x, -y
    expect(right.x).toBeGreaterThan(2.5);
    expect(right.y).toBeLessThan(2.5);
    expect(Math.hypot(right.x - 2.5, right.y - 2.5)).toBeCloseTo(WALK_SPEED * 0.1, 6);
    const down = at(2.5, 2.5);
    stepWalker(down, 0, 1, 0.1, room, catalog);
    expect(down.x).toBeCloseTo(down.y, 9);
    expect(down.x).toBeGreaterThan(2.5);
  });

  it('does not walk faster diagonally on screen', () => {
    const a = at(2.5, 2.5);
    const b = at(2.5, 2.5);
    stepWalker(a, 1, 0, 0.1, room, catalog);
    stepWalker(b, Math.SQRT1_2, Math.SQRT1_2, 0.1, room, catalog);
    expect(Math.hypot(a.x - 2.5, a.y - 2.5)).toBeCloseTo(Math.hypot(b.x - 2.5, b.y - 2.5), 9);
  });

  it('scales the speed with the push', () => {
    const half = at(2.5, 2.5);
    stepWalker(half, 0.5, 0, 0.1, room, catalog);
    expect(Math.hypot(half.x - 2.5, half.y - 2.5)).toBeCloseTo(WALK_SPEED * 0.05, 6);
  });

  it('stops at the edge of the room', () => {
    const w = at(0.5, 0.5);
    for (let i = 0; i < 60; i++) stepWalker(w, -1, 0, 0.1, room, catalog);
    expect(w.x).toBeGreaterThanOrEqual(RADIUS - 1e-9);
    expect(w.y).toBeLessThanOrEqual(6);
    for (let i = 0; i < 400; i++) stepWalker(w, 0, 1, 0.1, room, catalog);
    expect(w.x).toBeLessThanOrEqual(6 - RADIUS + 1e-9);
    expect(w.y).toBeLessThanOrEqual(6 - RADIUS + 1e-9);
  });

  it('cannot walk through furniture but slides along it', () => {
    const withSofa = roomOf([place({ pid: 0, item: 'sofa', x: 3, y: 0 })]);
    const w = at(3.5, 1.6);
    // screen up-right = grid -y: straight into the sofa
    for (let i = 0; i < 30; i++) stepWalker(w, 0.894, -0.447, 0.1, withSofa, catalog);
    expect(w.y).toBeGreaterThanOrEqual(1 + RADIUS - 1e-9);
  });

  it('never ends up inside a blocked cell or outside the room, whatever the input', () => {
    const withTable = roomOf([place({ pid: 0, item: 'table', x: 2, y: 2 })]);
    const blocked = blockedCells(withTable, catalog);
    const cells = new Set(withTable.cells.map(([x, y]) => `${x},${y}`));
    const w = at(0.5, 0.5);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 2000; i++) {
      stepWalker(w, rnd() * 2 - 1, rnd() * 2 - 1, 0.05, withTable, catalog);
      const key = `${Math.floor(w.x)},${Math.floor(w.y)}`;
      expect(cells.has(key), key).toBe(true);
      expect(blocked.has(key), key).toBe(false);
    }
  });
});

describe('nearestInteractable', () => {
  const room = roomOf([
    place({ pid: 0, item: 'sofa', x: 3, y: 0 }),
    place({ pid: 1, item: 'table', x: 0, y: 2 }),
    place({ pid: 2, item: 'cup', x: 0, y: 2, on: 1 }),
  ]);

  it('finds an item with an action next to the walker', () => {
    expect(nearestInteractable(at(3.5, 1.6), room, catalog)).toEqual({ kind: 'item', pid: 0, item: 'sofa', action: 'sit' });
  });

  it('finds an item on a surface', () => {
    expect(nearestInteractable(at(0.5, 3.5), room, catalog)).toMatchObject({ kind: 'item', pid: 2, action: 'brew_tea' });
  });

  it('returns nothing when nothing is near', () => {
    expect(nearestInteractable(at(2.5, 5.5), room, catalog)).toBeNull();
  });

  it('finds the door on the west wall', () => {
    const r = roomOf([DOOR, WINDOW]);
    expect(nearestInteractable(at(0.6, 4.5), r, catalog)).toMatchObject({ kind: 'door', pid: 90, action: 'enter' });
  });

  it('does not offer the window', () => {
    expect(nearestInteractable(at(1.5, 0.6), roomOf([DOOR, WINDOW]), catalog)).toBeNull();
  });

  it('finds a door that was moved to another wall', () => {
    const moved = place({ pid: 90, item: 'door', x: 2, y: 5, wall: 'south' });
    expect(nearestInteractable(at(2.5, 5.4), roomOf([moved]), catalog)).toMatchObject({ kind: 'door' });
    expect(nearestInteractable(at(0.6, 4.5), roomOf([moved]), catalog)).toBeNull();
  });

  it('prefers whichever is nearer', () => {
    const near = roomOf([place({ pid: 0, item: 'sofa', x: 0, y: 4 })]);
    expect(nearestInteractable(at(0.6, 4.6), near, catalog)).toMatchObject({ kind: 'item', pid: 0 });
  });
});


describe('dividers', () => {
  it('stop the walker like a wall', () => {
    const room = roomOf([], 6, 6, [[2, 2, 'east']]);
    const w = at(2.6, 2.5);
    for (let i = 0; i < 40; i++) stepWalker(w, 0.894, -0.447 * -1, 0.05, room, catalog);
    // screen direction (0.894, 0.447) is grid +x: straight at the divider on the east side of cell (2, 2)
    expect(w.x).toBeLessThan(3 - RADIUS + 1e-9);
  });

  it('let the walker pass where there is no divider', () => {
    const room = roomOf([], 6, 6, [[2, 2, 'east']]);
    const w = at(2.6, 3.5);
    for (let i = 0; i < 40; i++) stepWalker(w, 0.894, 0.447, 0.05, room, catalog);
    expect(w.x).toBeGreaterThan(3.5);
  });

  it('block movement in every direction', () => {
    const room = roomOf([], 6, 6, [[2, 2, 'south']]);
    const w = at(2.5, 2.6);
    for (let i = 0; i < 40; i++) stepWalker(w, -0.894, 0.447, 0.05, room, catalog);
    expect(w.y).toBeLessThan(3 - RADIUS + 1e-9);
    const back = at(2.5, 3.6);
    for (let i = 0; i < 40; i++) stepWalker(back, 0.894, -0.447, 0.05, room, catalog);
    expect(back.y).toBeGreaterThan(3 + RADIUS - 1e-9);
  });
});

import { stepWalker as step2 } from '../src/world';
import { stepPet } from '../src/pet';

describe('view-aware walking and the pet', () => {
  const room = { cells: Array.from({ length: 36 }, (_, i) => [i % 6, Math.floor(i / 6)] as [number, number]), placements: [], dividers: [], floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 36, area_used: 36 } as never;
  const catalog = { items: {} } as never;

  it('pushing screen-right walks along world +x/-y in view 0 but along +x/+y... rotated with the view', () => {
    const a = { x: 3, y: 3, facing: 'right' as const };
    step2(a, 1, 0, 0.1, room, catalog, 0);
    const b = { x: 3, y: 3, facing: 'right' as const };
    step2(b, 1, 0, 0.1, room, catalog, 1);
    expect(a.x).toBeGreaterThan(3);
    expect(a.y).toBeLessThan(3);
    expect([b.x - 3, b.y - 3].map((v) => Math.sign(Math.round(v * 100)))).not.toEqual([a.x - 3, a.y - 3].map((v) => Math.sign(Math.round(v * 100))));
  });

  it('the pet follows a far player, sits when close, and sleeps on its bed after a long rest', () => {
    const pet = { x: 0.5, y: 0.5, dir: 'right' as const, pose: 'sit' as const, idle: 0 };
    const player = { x: 5.5, y: 5.5, facing: 'right' as const };
    for (let i = 0; i < 160; i++) stepPet(pet, player, true, 0.05, room, catalog, () => 0.5);
    expect(Math.hypot(pet.x - player.x, pet.y - player.y)).toBeLessThan(1.7);
    const withBed = { ...(room as object), placements: [{ pid: 1, item: 'cat_bed', x: 1, y: 1, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true }] } as never;
    for (let i = 0; i < 600; i++) stepPet(pet, player, false, 0.05, withBed, catalog, () => 0.5);
    expect(pet.pose).toBe('sleep');
    expect(Math.hypot(pet.x - 1.5, pet.y - 1.55)).toBeLessThan(0.3);
  });
});

import { settle } from '../src/world';

describe('settle', () => {
  const cells = Array.from({ length: 36 }, (_, i) => [i % 6, Math.floor(i / 6)] as [number, number]);
  const room = { cells, placements: [], dividers: [], floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 36, area_used: 36 } as never;
  const catalog = { items: {} } as never;

  it('leaves a free position alone and moves a stuck one to the nearest free cell', () => {
    const ok = { x: 3.5, y: 3.5 };
    settle(ok, room, catalog);
    expect(ok).toEqual({ x: 3.5, y: 3.5 });
    const outside = { x: 9.5, y: 2.5 };
    settle(outside, room, catalog);
    expect(outside.x).toBeLessThan(6);
    expect(Math.abs(outside.y - 2.5)).toBeLessThan(1);
  });
});

describe('things one walks round', () => {
  const box = (x: number, y: number, z: number, w: number, d: number, h: number) => ({ box: [x, y, z, w, d, h] as [number, number, number, number, number, number], slot: 's' });
  const cat = {
    items: {
      ...catalog.items,
      tree: def({ id: 'tree', footprint: { w: 2, d: 2 }, model: [box(90, 90, 0, 20, 20, 80), box(0, 0, 80, 200, 200, 120)] }),
      rocks: def({ id: 'rocks', model: [box(20, 20, 0, 60, 60, 16)] }),
      wall: def({ id: 'wall', footprint: { w: 1, d: 3 }, model: [box(0, 0, 0, 100, 300, 120)] }),
    },
  } as unknown as Catalog;

  it('a tree stops one only at its trunk, not across all of its cells', () => {
    const w = at(2.3, 2.3);
    stepWalker(w, 0, 0.001, 0.01, roomOf([place({ pid: 0, item: 'tree', x: 2, y: 2 })]), cat);
    const near = at(2.3, 2.3);
    for (let i = 0; i < 5; i++) stepWalker(near, -0.447, 0.894, 0.02, roomOf([place({ pid: 0, item: 'tree', x: 2, y: 2 })]), cat);
    expect(near.x !== 2.3 || near.y !== 2.3).toBe(true);
  });

  it('low stones are stepped over', () => {
    const w = at(1.5, 3.5);
    for (let i = 0; i < 10; i++) stepWalker(w, 0.894, 0.447, 0.1, roomOf([place({ pid: 0, item: 'rocks', x: 2, y: 3 })]), cat);
    expect(w.x).toBeGreaterThan(3);
  });

  it('walking straight at something, one turns aside and goes round it', () => {
    const room = roomOf([place({ pid: 0, item: 'wall', x: 3, y: 1 })], 7, 6);
    const w = at(1.5, 2.5);
    // screen (0.894, 0.447) is grid +x: straight at the middle of the wall
    for (let i = 0; i < 60; i++) stepWalker(w, 0.894, 0.447, 0.05, room, cat);
    expect(w.x).toBeLessThan(3 - RADIUS + 1e-9);
    expect(Math.abs(w.y - 2.5)).toBeGreaterThan(0.3);
  });
});

describe('roots one walks over', () => {
  const root = def({ id: 'root', tags: ['climb'], model: [{ box: [0, 0, 0, 100, 100, 50], slot: 'log' }] as never });
  const stone = def({ id: 'stone', model: [{ box: [0, 0, 0, 100, 100, 50], slot: 'log' }] as never });
  const cat = { items: { root, stone } } as unknown as Catalog;
  const lane = (item: string): RoomView => ({ cells: Array.from({ length: 6 }, (_, x) => [x, 0] as [number, number]), placements: [{ pid: 1, item, x: 3, y: 0, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true }], dividers: [], floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 6, area_used: 6 });

  it('a root is climbed over, a stone of the same height is not', () => {
    for (const [item, passes] of [['root', true], ['stone', false]] as const) {
      const w: Walker = { x: 1.5, y: 0.5, facing: 'right' };
      for (let i = 0; i < 120; i++) stepWalker(w, 1, 0.5, 1 / 60, lane(item), cat);
      expect(w.x > 3.6, item).toBe(passes);
    }
    expect(blockedCells(lane('root'), cat).has('3,0')).toBe(false);
  });

  it('on a root one stands at its height, beside it on the ground', () => {
    expect(groundAt(lane('root'), cat, 3.5, 0.5)).toBe(50);
    expect(groundAt(lane('root'), cat, 1.5, 0.5)).toBe(0);
  });
});
