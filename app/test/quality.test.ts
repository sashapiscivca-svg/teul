import { describe, expect, it } from 'vitest';
import { QualityLadder } from '../src/quality';

/** Frames of a given pace and work, `n` of them, from `t` (ms); returns the time after them. */
function run(q: QualityLadder, t: number, n: number, elapsedMs: number, workMs: number, interval = 0): number {
  for (let i = 0; i < n; i++) {
    t += elapsedMs;
    q.frame(t, elapsedMs / 1000, interval, workMs);
  }
  return t;
}

describe('the quality ladder', () => {
  it('steps down when frames keep coming late', () => {
    const q = new QualityLadder(0);
    run(q, 10_000, 25, 60, 50);
    expect(q.level).toBe(1);
  });

  it('does not count the heavy moments of loading a place (start, a new location)', () => {
    const q = new QualityLadder(0);
    q.hold(0, 4000);
    run(q, 0, 40, 90, 80); // all within the first 3.6 s
    expect(q.level).toBe(0);
    q.hold(5000, 4000); // walking into a new place: its pictures are drawn
    run(q, 5000, 40, 90, 80);
    expect(q.level).toBe(0);
  });

  it('comes back up once the frames have long been light again, but never above where the device started', () => {
    const q = new QualityLadder(0);
    let t = run(q, 10_000, 25, 60, 50);
    expect(q.level).toBe(1);
    t = run(q, t, 600, 33, 2, 1 / 30); // 20 s of light frames
    expect(q.level).toBe(0);
    run(q, t, 2000, 16, 1);
    expect(q.level).toBe(0);
    const weak = new QualityLadder(2);
    run(weak, 10_000, 2000, 50, 1, 1 / 20);
    expect(weak.level).toBe(2);
  });

  it('gives up on a level that has failed twice', () => {
    const q = new QualityLadder(0);
    let t = 10_000;
    for (let k = 0; k < 2; k++) {
      t = run(q, t, 25, 60, 50);
      expect(q.level).toBe(1);
      t = run(q, t, 600, 33, 2, 1 / 30);
      expect(q.level).toBe(0);
    }
    t = run(q, t, 25, 60, 50);
    expect(q.level).toBe(1);
    run(q, t, 3000, 33, 2, 1 / 30);
    expect(q.level).toBe(1);
  });

  it('does not come up while the frames, though on time, are heavy', () => {
    const q = new QualityLadder(0);
    let t = run(q, 10_000, 25, 60, 50);
    t = run(q, t, 1200, 33, 14, 1 / 30);
    expect(q.level).toBe(1);
  });
});
