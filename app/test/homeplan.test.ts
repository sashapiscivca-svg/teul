import { describe, expect, it } from 'vitest';
import { placeItem, placeOnWall, roomFrame } from '../src/homeplan';

const spot = { x: 10, y: 20, w: 7, d: 6 };

describe('a room plan, read from the back wall toward the door', () => {
  it('puts the back wall opposite the door, whichever side the door is on', () => {
    const south = roomFrame(spot, 'south');
    expect(south.vLen).toBe(6);
    expect(south.uLen).toBe(7);
    // v = 0 is the row farthest from a door in the south wall
    expect(south.cell(0, 0)[1]).toBe(20);
    expect(south.cell(0, south.vLen - 1)[1]).toBe(25);
    const east = roomFrame(spot, 'east');
    expect(east.vLen).toBe(7);
    expect(east.cell(0, 0)[0]).toBe(10);
    expect(east.cell(0, east.vLen - 1)[0]).toBe(16);
  });

  it('every local cell is inside the room, mirrored or not', () => {
    for (const [side, mirror] of (['north', 'east', 'south', 'west'] as const).flatMap((s) => [[s, false], [s, true]] as const)) {
      const f = roomFrame(spot, side, mirror);
      for (let u = 0; u < f.uLen; u++) {
        for (let v = 0; v < f.vLen; v++) {
          const [x, y] = f.cell(u, v);
          expect(x >= 10 && x < 17 && y >= 20 && y < 26, `${side} ${u},${v} -> ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it('turns a thing against the back wall to face the door', () => {
    // a 2x1 counter: with the door south it faces south (rot 0) along the top row
    const s = placeItem(roomFrame(spot, 'south'), { w: 2, d: 1 }, 0, 0, 'door');
    expect(s.rot).toBe(0);
    expect(s.cells.every(([, y]) => y === 20)).toBe(true);
    expect(s.cells.length).toBe(2);
    // with the door east it stands along the west wall, facing east (rot 3), one cell wide and two long
    const e = placeItem(roomFrame(spot, 'east'), { w: 2, d: 1 }, 0, 0, 'door');
    expect(e.rot).toBe(3);
    expect(e.cells.every(([x]) => x === 10)).toBe(true);
    expect(new Set(e.cells.map(([, y]) => y)).size).toBe(2);
    // its corner is the smallest cell of its footprint
    expect([e.x, e.y]).toEqual([Math.min(...e.cells.map((c) => c[0])), Math.min(...e.cells.map((c) => c[1]))]);
  });

  it('counts negative places from the far side (flush to the right wall or to the door wall)', () => {
    const f = roomFrame(spot, 'south');
    const right = placeItem(f, { w: 1, d: 1 }, -1, 0, 'door');
    expect(right.cells).toEqual([f.cell(f.uLen - 1, 0)]);
    const front = placeItem(f, { w: 2, d: 1 }, 0, -1, 'back');
    expect(front.rot).toBe(2);
    expect(front.cells.every(([, y]) => y === 25)).toBe(true);
  });

  it('faces sideways: a chair at the left of a table looks right', () => {
    const f = roomFrame(spot, 'south');
    const chair = placeItem(f, { w: 1, d: 1 }, 2, 2, 'right');
    // right (+u) is along the room's u axis: the chair's front must point there
    const fronts: [number, number][] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    const [fx, fy] = fronts[chair.rot];
    const [ax, ay] = f.cell(2, 2);
    const [bx, by] = f.cell(3, 2);
    expect([fx, fy]).toEqual([bx - ax, by - ay]);
  });

  it('hangs things on the back wall facing into the room', () => {
    const f = roomFrame(spot, 'south');
    const w = placeOnWall(f, { w: 2, d: 1 }, 'back', 1);
    expect(w.side).toBe('north');
    expect(w.cells.length).toBe(2);
    expect([w.x, w.y]).toEqual([Math.min(...w.cells.map((c) => c[0])), 20]);
    const left = placeOnWall(roomFrame(spot, 'east'), { w: 1, d: 1 }, 'left', 2);
    expect(['north', 'south']).toContain(left.side);
  });
});

describe('a mirrored plan', () => {
  it('swaps left and right but keeps the back wall', () => {
    const a = roomFrame(spot, 'south');
    const b = roomFrame(spot, 'south', true);
    expect(b.cell(0, 0)).toEqual(a.cell(a.uLen - 1, 0));
    expect(placeItem(b, { w: 1, d: 1 }, 0, 0, 'door').rot).toBe(0);
  });
});
