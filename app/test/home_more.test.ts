import { describe, expect, it } from 'vitest';
import { petLayers, petLookOf, DEFAULT_PET, PET_DRAGON, PET_FOX, PET_ROBOT, PET_TURTLE, type PetPose } from '../src/character';
import { newHousePet, speedOf, stepHousePet, warmsAt } from '../src/petlife';
import { outerEdges, rectCells, sharedEdges, siteProps, siteWorkers, SITE_PID } from '../src/site';
import type { BuildOrderView, Catalog, PetView, RoomView } from '../src/types';

const room = (w = 8, d = 8): RoomView => {
  const cells: [number, number][] = [];
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  return { cells, styles: {}, style_params: {}, placements: [], floor_paint: {}, wall_paint: {}, dividers: [], settings: {}, area_budget: 999, area_used: cells.length };
};
const catalog = { items: {}, styles: {} } as unknown as Catalog;

const order = (o: Partial<BuildOrderView>): BuildOrderView => ({
  n: 0, build: 'build.music', name: 'Музична кімната', kind: 'room', x: 10, y: 0, w: 6, d: 6, day: 0, ready: 4, due: false, done: false, words: '', stage: 0,
  floor: null, wall: null, plan: 'music', items: [], ...o,
});

describe('the animals that come later', () => {
  it('each new kind has its own look and every pose draws', () => {
    for (const kind of [PET_TURTLE, PET_FOX, PET_ROBOT, PET_DRAGON]) {
      const look = petLookOf(kind, DEFAULT_PET);
      expect(look.kind).toBe(kind);
      for (const pose of ['sit', 'walk', 'sleep', 'eat', 'play'] as PetPose[]) {
        for (const dir of ['left', 'right'] as const) expect(petLayers(look, dir, pose, 1).length).toBeGreaterThan(2);
      }
    }
    // the first day's cat keeps the chosen fur
    expect(petLookOf(0, { ...DEFAULT_PET, fur: '#123456' }).fur).toBe('#123456');
  });

  it('the fox with something in its teeth looks different', () => {
    const fox = petLookOf(PET_FOX, DEFAULT_PET);
    expect(JSON.stringify(petLayers(fox, 'right', 'walk', 0, true))).not.toBe(JSON.stringify(petLayers(fox, 'right', 'walk', 0, false)));
  });

  it('the turtle is slow, the fox quick', () => {
    expect(speedOf(PET_TURTLE)).toBeLessThan(speedOf(PET_ROBOT));
    expect(speedOf(PET_FOX)).toBeGreaterThan(speedOf(PET_DRAGON));
  });

  it('a hungry animal goes to its bowl and eats there', () => {
    const r = room();
    r.placements.push({ pid: 1, item: 'pet_bowl', x: 6, y: 6, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true });
    const cat = { ...catalog, items: { pet_bowl: { id: 'pet_bowl', footprint: { w: 1, d: 1 }, layer: 'floor', model: [], tags: [], actions: [] } } } as unknown as Catalog;
    const p = newHousePet('turtle', petLookOf(PET_TURTLE, DEFAULT_PET), { x: 1.5, y: 1.5 });
    const view = { id: 'turtle', hungry: true, lonely: false, happy: false } as PetView;
    let time = 0;
    for (let i = 0; i < 600 && p.pose !== 'eat'; i++) {
      time += 0.1;
      stepHousePet(p, 0.1, { room: r, catalog: cat, time, player: { x: 1, y: 7 }, view, near: () => true, random: () => 0.9 });
    }
    expect(p.pose).toBe('eat');
    expect(Math.hypot(p.x - 6.5, p.y - 6.5)).toBeLessThan(1.6);
  });

  it('the dragon warms the air close to it only', () => {
    const d = newHousePet('dragon', petLookOf(PET_DRAGON, DEFAULT_PET), { x: 3, y: 3 });
    expect(warmsAt([d], 4, 3)).toBe(true);
    expect(warmsAt([d], 8, 8)).toBe(false);
    expect(warmsAt([newHousePet('fox', petLookOf(PET_FOX, DEFAULT_PET), { x: 3, y: 3 })], 3, 3)).toBe(false);
  });
});

describe('a room being built on', () => {
  it('the site touches the house along its shared side, and has walls all round', () => {
    const rect = rectCells({ x: 10, y: 0, w: 3, d: 2 });
    expect(rect).toHaveLength(6);
    const house = new Set(['9,0', '9,1']);
    expect(sharedEdges(rect, house)).toEqual([[10, 0, 'west'], [10, 1, 'west']]);
    expect(outerEdges(rect)).toHaveLength(10);
  });

  it('dug earth first, then scaffolding; its things never take a real pid', () => {
    const has = () => true;
    const early = siteProps(order({ stage: 0 }), has).map((p) => p.item);
    expect(early).toContain('cement_mixer');
    const walls = siteProps(order({ stage: 1 }), has);
    expect(walls.filter((p) => p.item === 'scaffold')).toHaveLength(4);
    expect(walls.every((p) => p.pid <= SITE_PID)).toBe(true);
    expect(siteProps(order({ stage: 2 }), (i) => i !== 'scaffold').some((p) => p.item === 'scaffold')).toBe(false);
  });

  it('the crew works in the day, not at night, and leaves once it is done', () => {
    expect(siteWorkers(order({}), 10 * 60, 0)).toHaveLength(2);
    expect(siteWorkers(order({}), 22 * 60, 0)).toHaveLength(0);
    expect(siteWorkers(order({ due: true }), 10 * 60, 0)).toHaveLength(0);
  });
});
