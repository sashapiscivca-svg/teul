import { describe, expect, it } from 'vitest';
import { footprintCells, modelFaces, rotateBox, rotateWorldBox, shade, topHeight, worldBoxes } from '../src/models';
import type { ItemDef, PlacementView } from '../src/types';

const sofa: ItemDef = {
  id: 'sofa',
  name: 'item.sofa',
  category: 'seating',
  tags: [],
  footprint: { w: 3, d: 1 },
  layer: 'floor',
  rules: { provides_surface: false },
  model: [
    { box: [0, 0, 0, 300, 100, 30], slot: 'body' },
    { box: [0, 0, 30, 300, 25, 48], slot: 'body' },
  ],
  slots: { body: { default: '#808080', palette: 'fabric' } },
  actions: ['sit'],
  acquire: 'free',
};

const table: ItemDef = {
  ...sofa,
  id: 'table',
  footprint: { w: 2, d: 2 },
  rules: { provides_surface: true },
  model: [{ box: [0, 0, 0, 200, 200, 40], slot: 'body' }],
};

const cup: ItemDef = { ...sofa, id: 'cup', footprint: { w: 1, d: 1 }, layer: 'surface', model: [{ box: [30, 30, 0, 40, 40, 12], slot: 'body' }] };

const painting: ItemDef = {
  ...sofa,
  id: 'painting',
  footprint: { w: 2, d: 1 },
  layer: 'wall',
  model: [{ box: [10, 0, 40, 180, 6, 60], slot: 'body' }],
};

function placement(over: Partial<PlacementView>): PlacementView {
  return { pid: 0, item: 'sofa', x: 0, y: 0, rot: 0, wall: null, on: null, colors: { body: '#808080' }, props: {}, known: true, ...over };
}

describe('shade', () => {
  it('scales each channel and clamps', () => {
    expect(shade('#808080', 0.5)).toBe('#404040');
    expect(shade('#ffffff', 2)).toBe('#ffffff');
    expect(shade('#102030', 1)).toBe('#102030');
  });
});

describe('rotateBox', () => {
  const box: [number, number, number, number, number, number] = [0, 0, 5, 300, 100, 40];

  it('is the identity at rotation 0', () => {
    expect(rotateBox(box, 300, 100, 0)).toEqual(box);
  });

  it('turns a 3x1 box into a 1x3 box at rotation 1 and 3', () => {
    expect(rotateBox(box, 300, 100, 1)).toEqual([0, 0, 5, 100, 300, 40]);
    expect(rotateBox(box, 300, 100, 3)).toEqual([0, 0, 5, 100, 300, 40]);
  });

  it('keeps a box inside the rotated footprint', () => {
    for (const rot of [0, 1, 2, 3]) {
      const [x, y, , w, d] = rotateBox([20, 10, 0, 50, 30, 10], 300, 100, rot);
      const [fw, fd] = rot % 2 ? [100, 300] : [300, 100];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(fw);
      expect(y + d).toBeLessThanOrEqual(fd);
    }
  });

  it('returns to the start after four quarter turns', () => {
    const original: [number, number, number, number, number, number] = [20, 10, 3, 50, 30, 10];
    let b = original;
    let w = 300;
    let d = 100;
    for (let i = 0; i < 4; i++) {
      b = rotateBox(b, w, d, 1);
      [w, d] = [d, w];
    }
    expect(b).toEqual(original);
  });
});

describe('footprint and height', () => {
  it('lists the cells of a rotated item', () => {
    expect(footprintCells(sofa, 0)).toHaveLength(3);
    expect(footprintCells(sofa, 1)).toEqual([[0, 0], [0, 1], [0, 2]]);
  });

  it('reports the top of the tallest box in hundredths', () => {
    expect(topHeight(sofa)).toBe(78);
    expect(topHeight(table)).toBe(40);
  });
});

describe('worldBoxes', () => {
  it('places floor boxes at the placement cell', () => {
    const boxes = worldBoxes(sofa, placement({ x: 2, y: 1 }), 0);
    expect(boxes[0]).toMatchObject({ gx: 2, gy: 1, gw: 3, gd: 1, z: 0, h: 30 });
  });

  it('puts surface items on top of their host', () => {
    const boxes = worldBoxes(cup, placement({ item: 'cup', x: 1, y: 1, on: 7 }), topHeight(table));
    expect(boxes[0]).toMatchObject({ gx: 1.3, gy: 1.3, z: 40 });
  });

  it('puts wall items in the wall plane: the west wall runs along y', () => {
    const left = worldBoxes(painting, placement({ item: 'painting', x: 0, y: 2, wall: 'west' }), 0)[0];
    expect(left.gx).toBeCloseTo(0, 9);
    expect(left.gy).toBeCloseTo(2.1, 9);
    expect(left.gw).toBeCloseTo(0.06, 9);
    expect(left.gd).toBeCloseTo(1.8, 9);
    expect(left.z).toBe(40);
  });

  it('puts wall items in the wall plane: the north wall runs along x', () => {
    const right = worldBoxes(painting, placement({ item: 'painting', x: 3, y: 0, wall: 'north' }), 0)[0];
    expect(right.gx).toBeCloseTo(3.1, 9);
    expect(right.gy).toBeCloseTo(0, 9);
    expect(right.gw).toBeCloseTo(1.8, 9);
    expect(right.gd).toBeCloseTo(0.06, 9);
  });

  it('rotates floor models with the placement', () => {
    const turned = worldBoxes(sofa, placement({ rot: 1 }), 0)[0];
    expect(turned).toMatchObject({ gw: 1, gd: 3 });
  });
});

describe('modelFaces', () => {
  it('gives three faces per box, back to front (right, left, top)', () => {
    const faces = modelFaces(sofa, placement({}), 0);
    expect(faces).toHaveLength(6);
    expect(faces.slice(0, 3).map((f) => f.kind)).toEqual(['right', 'left', 'top']);
  });

  it('shades the faces from the slot colour', () => {
    const [right, left, top] = modelFaces(sofa, placement({ colors: { body: '#808080' } }), 0);
    expect(top.fill).toBe('#808080');
    expect(left.fill).toBe(shade('#808080', 0.82));
    expect(right.fill).toBe(shade('#808080', 0.66));
  });

  it('uses the placement colour over the default and falls back to the default', () => {
    expect(modelFaces(sofa, placement({ colors: { body: '#ff0000' } }), 0)[2].fill).toBe('#ff0000');
    expect(modelFaces(sofa, placement({ colors: {} }), 0)[2].fill).toBe('#808080');
  });

  it('raises a surface item by the host height', () => {
    const onFloor = modelFaces(cup, placement({ item: 'cup', x: 1, y: 1 }), 0);
    const onTable = modelFaces(cup, placement({ item: 'cup', x: 1, y: 1, on: 1 }), 40);
    expect(onTable[2].points[0][1]).toBeLessThan(onFloor[2].points[0][1]);
  });

  it('draws nothing for an unknown item', () => {
    expect(modelFaces(undefined, placement({ item: 'ghost', known: false }), 0)).toEqual([]);
  });
});


describe('more wall sides, mirror, nudge and views', () => {
  it('puts wall items on the south and east walls with the item facing into the room', () => {
    const south = worldBoxes(painting, placement({ item: 'painting', x: 1, y: 5, wall: 'south' }), 0)[0];
    expect(south.gx).toBeCloseTo(1.1, 9);
    expect(south.gy).toBeCloseTo(5 + 1 - 0.06, 9);
    expect(south.gw).toBeCloseTo(1.8, 9);
    expect(south.gd).toBeCloseTo(0.06, 9);
    const east = worldBoxes(painting, placement({ item: 'painting', x: 5, y: 1, wall: 'east' }), 0)[0];
    expect(east.gx).toBeCloseTo(5 + 1 - 0.06, 9);
    expect(east.gy).toBeCloseTo(1.1, 9);
    expect(east.gw).toBeCloseTo(0.06, 9);
    expect(east.gd).toBeCloseTo(1.8, 9);
  });

  it('mirrors a model inside its footprint', () => {
    const asym: ItemDef = { ...sofa, model: [{ box: [0, 0, 0, 100, 100, 40], slot: 'body' }] };
    const plain = worldBoxes(asym, placement({ x: 2, y: 1 }), 0)[0];
    const mirrored = worldBoxes(asym, placement({ x: 2, y: 1, props: { mirror: '1' } }), 0)[0];
    expect(plain.gx).toBe(2);
    expect(mirrored.gx).toBe(4);
    expect(mirrored.gy).toBe(plain.gy);
  });

  it('nudges an item without changing its size', () => {
    const base = worldBoxes(sofa, placement({ x: 1, y: 1 }), 0)[0];
    const nudged = worldBoxes(sofa, placement({ x: 1, y: 1, props: { nudge_x: '25', nudge_y: '-10' } }), 0)[0];
    expect(nudged.gx).toBeCloseTo(base.gx + 0.25, 9);
    expect(nudged.gy).toBeCloseTo(base.gy - 0.1, 9);
    expect(nudged.gw).toBe(base.gw);
  });

  it('ignores a nudge that is not a number', () => {
    const base = worldBoxes(sofa, placement({ x: 1, y: 1 }), 0)[0];
    const bad = worldBoxes(sofa, placement({ x: 1, y: 1, props: { nudge_x: 'abc' } }), 0)[0];
    expect(bad.gx).toBe(base.gx);
  });

  it('rotates boxes with the view and keeps their size up to swapping', () => {
    const b = worldBoxes(sofa, placement({ x: 1, y: 2 }), 0)[0];
    const r = rotateWorldBox(b, 1);
    expect([r.gw, r.gd]).toEqual([b.gd, b.gw]);
    expect(rotateWorldBox(b, 0)).toBe(b);
  });

  it('carries the material of a slot onto its faces', () => {
    const faces = modelFaces(sofa, placement({ props: { 'finish.body': 'gloss' } }), 0);
    expect(faces.every((f) => f.finish === 'gloss' && f.slot === 'body')).toBe(true);
  });
});
