import { describe, expect, it, vi } from 'vitest';
import * as path from '../src/path';
import { stepPet, type Pet } from '../src/pet';
import type { Catalog, ItemDef, RoomView } from '../src/types';
import type { Walker } from '../src/world';

const cells = Array.from({ length: 100 }, (_, i) => [i % 10, Math.floor(i / 10)] as [number, number]);
const box: ItemDef = { id: 'box', name: 'box', category: 'x', tags: [], footprint: { w: 1, d: 1 }, layer: 'floor', rules: { provides_surface: false }, model: [], slots: {}, actions: [], acquire: 'free' };
const catalog = { items: { box } } as unknown as Catalog;
const at = (x: number, y: number) => ({ pid: x * 10 + y, item: 'box', x, y, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true });
// a wall of roots across the room: the pet on one side, the player on the other
const wall = Array.from({ length: 10 }, (_, y) => at(5, y));
const room: RoomView = { cells, placements: wall, dividers: [], floor_paint: {}, wall_paint: {}, settings: {}, styles: {}, style_params: {}, area_budget: 100, area_used: 100 };

describe('the pet among the roots', () => {
  it('does not look for a way round every frame when there is none, and slips through to the player', () => {
    const spy = vi.spyOn(path, 'findPath');
    const pet: Pet = { x: 2.5, y: 4.5, dir: 'right', pose: 'sit', idle: 0 };
    const player = { x: 8.5, y: 4.5, facing: 'down' } as unknown as Walker;
    for (let i = 0; i < 60; i++) stepPet(pet, player, true, 1 / 60, room, catalog, () => 0.5);
    // a second of frames: a few searches at most, not sixty
    expect(spy.mock.calls.length).toBeLessThanOrEqual(3);
    // and the pet is by the player's side, past the roots
    expect(pet.x).toBeGreaterThan(5);
    expect(Math.hypot(pet.x - player.x, pet.y - player.y)).toBeLessThan(2.5);
    spy.mockRestore();
  });
});
