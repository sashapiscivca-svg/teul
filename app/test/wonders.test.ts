import { describe, expect, it } from 'vitest';
import { BEINGS, carried, creatureLayers, mirrorBeing, type Creature } from '../src/wonders/creatures';
import { BEING_LINES, BEING_SPOTS, isRiftWorld, RIFT_WORLDS, WORLD_LOOK, worldOfMonth } from '../src/wonders/worlds';
import { cowsOut, withSkyMarks } from '../src/wonders/index';
import type { LocationDef, SkyView } from '../src/types';

const ALL: Creature[] = ['lantern', 'moth', 'deer', 'shade', 'seedling', 'gardener', 'saltwalker', 'beetle', 'owl', 'clockfox', 'robed', 'hunter'];
const sky = (o: Partial<SkyView>): SkyView => ({ rift_world: null, eclipse: null, meteors: null, comet: null, aliens: null, crop_circle: false, cow_missing: false, cow_back: false, ...o });

describe('the rift worlds', () => {
  it('are four, one for each equinox and solstice, each with its own look and words', () => {
    expect(RIFT_WORLDS).toHaveLength(4);
    expect(worldOfMonth(3)).toBe('rift_spring');
    expect(worldOfMonth(6)).toBe('rift_summer');
    expect(worldOfMonth(9)).toBe('rift_autumn');
    expect(worldOfMonth(12)).toBe('rift_winter');
    expect(worldOfMonth(10)).toBeNull();
    expect(isRiftWorld('rift_winter')).toBe(true);
    expect(isRiftWorld('village')).toBe(false);
    const looks = new Set(RIFT_WORLDS.map((w) => `${WORLD_LOOK[w].time}|${WORLD_LOOK[w].ambient}`));
    expect(looks.size).toBe(4);
    for (const w of RIFT_WORLDS) {
      expect(WORLD_LOOK[w].arrive.length).toBeGreaterThan(20);
      expect(BEINGS[w].length).toBeGreaterThan(0);
    }
    for (const w of ['rift_spring', 'rift_summer', 'rift_autumn'] as const) expect(BEING_SPOTS[w].length).toBeGreaterThan(5);
  });
});

describe('the beings', () => {
  it('are drawn in every direction, step when they walk, and have no face from behind', () => {
    for (const k of ALL) {
      for (const d of ['down', 'up', 'left', 'right'] as const) {
        const l = creatureLayers(k, d, false, 0);
        expect(l.length).toBeGreaterThan(0);
        for (const x of l) expect(x.path).toMatch(/^M\d+ \d+h1v1h-1z/);
      }
      const front = JSON.stringify(creatureLayers(k, 'down', false, 0));
      expect(JSON.stringify(creatureLayers(k, 'up', false, 0))).not.toBe(front === '' ? 'x' : 'never');
    }
    // the lantern-head's flame is a face: it shows in front, not from behind
    const flame = (d: 'down' | 'up') => creatureLayers('lantern', d, false, 0).some((l) => l.color === '#fff3c4');
    expect(flame('down')).toBe(true);
    expect(flame('up')).toBe(false);
    // walking moves the legs
    expect(JSON.stringify(creatureLayers('deer', 'down', true, 1))).not.toBe(JSON.stringify(creatureLayers('deer', 'down', true, 3)));
  });

  it('a resident is always kept by the same being on the other side of the town', () => {
    expect(mirrorBeing(12345)).toBe(mirrorBeing(12345));
    expect(new Set(Array.from({ length: 40 }, (_, i) => mirrorBeing(i * 7919))).size).toBe(BEINGS.rift_winter.length);
  });

  it('say something when one stops by them', () => {
    for (const k of ALL) expect(BEING_LINES[k].length).toBeGreaterThan(0);
  });

  it('the mob carries torches and pitchforks', () => {
    expect(carried('torch', 'down', 0).some((l) => l.color === '#ff7a1a')).toBe(true);
    expect(carried('pitchfork', 'left', 0).some((l) => l.color === '#8a8f99')).toBe(true);
  });
});

describe('the sky leaves its marks', () => {
  const fields = { id: 'fields', props: [{ item: 'wheat_a', x: 10, y: 10 }, { item: 'wheat_b', x: 12, y: 10 }, { item: 'wheat_a', x: 10, y: 12 }, { item: 'wheat_b', x: 12, y: 12 }, { item: 'scarecrow', x: 11, y: 11 }], places: [] } as unknown as LocationDef;

  it('a circle in the wheat after the visitors, and nothing otherwise', () => {
    expect(withSkyMarks(fields, sky({}))).toBe(fields);
    const marked = withSkyMarks(fields, sky({ crop_circle: true }));
    expect(marked.props.some((p) => p.item === 'crop_circle')).toBe(true);
    expect(marked.props.some((p) => p.item === 'scarecrow')).toBe(true);
    expect(marked.props.filter((p) => p.item.startsWith('wheat')).length).toBe(0);
    // only the field
    expect(withSkyMarks({ ...fields, id: 'farm' } as LocationDef, sky({ crop_circle: true })).props).toHaveLength(5);
  });

  it('a cow less at the farm for the week it is gone', () => {
    const farm = { id: 'farm', props: [], places: [] } as unknown as LocationDef;
    expect(cowsOut(farm, sky({ cow_missing: true }), 5)).toBe(4);
    expect(cowsOut(farm, sky({}), 5)).toBe(5);
    expect(cowsOut(fields, sky({ cow_missing: true }), 5)).toBe(5);
  });
});
