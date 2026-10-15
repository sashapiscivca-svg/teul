import { describe, expect, it } from 'vitest';
import { bucketOps, Recorder, SpotGrid, tilesOver } from '../src/pixel/chunks';

const img = (w: number, h: number) => ({ width: w, height: h }) as unknown as HTMLCanvasElement;

describe('a big map painted in chunks', () => {
  it('records what is painted, with the colour and the see-through at the time', () => {
    const r = new Recorder();
    r.fillStyle = '#123456';
    r.fillRect(1, 2, 3, 4);
    r.globalAlpha = 0.5;
    r.drawImage(img(10, 8), 20, 30);
    expect(r.ops).toEqual([
      { x: 1, y: 2, w: 3, h: 4, img: null, style: '#123456', alpha: 1 },
      { x: 20, y: 30, w: 10, h: 8, img: expect.anything(), style: '#123456', alpha: 0.5 },
    ]);
  });

  it('puts every stroke into every chunk it touches, in the order it was painted', () => {
    const r = new Recorder();
    r.fillRect(10, 10, 5, 5); // only the first chunk
    r.drawImage(img(40, 10), 90, 10); // across the first two
    r.fillRect(150, 150, 2, 2); // the last one
    r.fillRect(95, 20, 1, 1); // across nothing but the first? no: x 95 < 100, the first only
    const b = bucketOps(r.ops, 200, 200, 100);
    expect(b.cols).toBe(2);
    expect(b.rows).toBe(2);
    expect(b.lists[0]).toEqual([0, 1, 3]);
    expect(b.lists[1]).toEqual([1]);
    expect(b.lists[2]).toEqual([]);
    expect(b.lists[3]).toEqual([2]);
  });

  it('knows which chunks the screen shows (and a ring round them, to paint ahead)', () => {
    // a 1000×600 layer in chunks of 256, the layer shifted so that the screen (400×300) shows its 300..700 × 200..500
    expect(tilesOver(4, 3, 256, -300, -200, 400, 300, 0).sort((a, b) => a - b)).toEqual([1, 2, 5, 6]);
    expect(tilesOver(4, 3, 256, -300, -200, 400, 300, 1).length).toBe(12);
  });
});

describe('the things of a big map, found by where they are', () => {
  it('gives back only the things whose picture reaches the screen, each once, in their own order', () => {
    // boxes: [x0, y0, x1, y1] in layer pixels
    const boxes: [number, number, number, number][] = [
      [0, 0, 10, 10], // far top left
      [500, 500, 900, 520], // long, across several squares
      [610, 610, 620, 620],
      [-50, 590, -40, 600], // off the layer to the left
      [700, 100, 710, 110],
    ];
    const g = new SpotGrid(boxes, 256);
    expect(g.query(600, 480, 1000, 700)).toEqual([1, 2]);
    expect(g.query(-100, 550, 0, 650)).toEqual([3]);
    expect(g.query(0, 0, 2000, 2000)).toEqual([0, 1, 2, 4]);
    // the same as looking at every box
    const all = (x0: number, y0: number, x1: number, y1: number) => boxes.map((b, i) => (b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1 ? i : -1)).filter((i) => i >= 0);
    for (const q of [[100, 100, 400, 300], [480, 480, 640, 640], [-60, -60, 2000, 2000]] as const) expect(g.query(q[0], q[1], q[2], q[3])).toEqual(all(q[0], q[1], q[2], q[3]));
  });
});
