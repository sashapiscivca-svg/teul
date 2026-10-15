import { describe, expect, it } from 'vitest';
import { PLAYER_ROW, SHAFT_W, VIEW_H, flare, lit, newRift, steer, tick, tickMs } from '../src/arcade/rift';

describe('Розлом', () => {
  it('starts in an open shaft with the miner on a free cell', () => {
    const r = newRift(5);
    expect(r.rows).toHaveLength(VIEW_H);
    expect(r.rows.every((row) => row.length === SHAFT_W)).toBe(true);
    expect(r.rows[PLAYER_ROW][r.x]).not.toBe('#');
    expect(r.lives).toBe(3);
    expect(r.over).toBe(false);
  });

  it('every row of the shaft leaves a way through', () => {
    const r = newRift(11);
    for (let i = 0; i < 400; i++) {
      tick(r);
      r.lives = 3;
      r.light = 100;
      for (const row of r.rows) expect(row.split('').some((c) => c !== '#')).toBe(true);
    }
  });

  it('consecutive rows always overlap, so the way never breaks', () => {
    const r = newRift(3);
    for (let i = 0; i < 300; i++) {
      tick(r);
      r.lives = 3;
      r.light = 100;
      for (let y = 0; y + 1 < r.rows.length; y++) {
        const a = r.rows[y];
        const b = r.rows[y + 1];
        expect(a.split('').some((c, x) => c !== '#' && b[x] !== '#')).toBe(true);
      }
    }
  });

  it('the miner cannot walk into the rock', () => {
    const r = newRift(7);
    for (let i = 0; i < SHAFT_W; i++) steer(r, -1);
    expect(r.rows[PLAYER_ROW][r.x]).not.toBe('#');
    for (let i = 0; i < SHAFT_W; i++) steer(r, 1);
    expect(r.rows[PLAYER_ROW][r.x]).not.toBe('#');
  });

  it('a crystal scores and brings the light back', () => {
    const r = newRift(9);
    r.light = 40;
    const below = r.rows[PLAYER_ROW + 1].split('');
    below[r.x] = '*';
    r.rows[PLAYER_ROW + 1] = below.join('');
    const score = r.score;
    expect(tick(r)).toBe('gem');
    expect(r.score).toBeGreaterThan(score + 1);
    expect(r.light).toBeGreaterThan(40);
  });

  it('a spike costs a life and moves the miner out of it', () => {
    const r = newRift(9);
    const below = r.rows[PLAYER_ROW + 1].split('');
    below[r.x] = '^';
    r.rows[PLAYER_ROW + 1] = below.join('');
    expect(tick(r)).toBe('hit');
    expect(r.lives).toBe(2);
    expect('#^').not.toContain(r.rows[PLAYER_ROW][r.x]);
  });

  it('the light runs out and the game ends in the dark', () => {
    const r = newRift(2);
    r.light = 1;
    for (let i = 0; i < 10 && !r.over; i++) {
      r.lives = 3;
      tick(r);
    }
    expect(r.over).toBe(true);
  });

  it('a flare lights the whole shaft for a while, three of them', () => {
    const r = newRift(4);
    r.light = 10;
    expect(lit(r, 0, VIEW_H - 1)).toBe(false);
    expect(flare(r)).toBe(true);
    expect(lit(r, 0, VIEW_H - 1)).toBe(true);
    flare(r);
    flare(r);
    expect(flare(r)).toBe(false);
  });

  it('it speeds up the deeper it goes, and the same seed digs the same shaft', () => {
    const a = newRift(77);
    const b = newRift(77);
    const slow = tickMs(a);
    for (let i = 0; i < 300; i++) {
      for (const r of [a, b]) {
        r.lives = 3;
        r.light = 100;
        tick(r);
      }
    }
    expect(tickMs(a)).toBeLessThan(slow);
    expect(a.rows).toEqual(b.rows);
  });
});
