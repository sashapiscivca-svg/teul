import { describe, expect, it } from 'vitest';
import { joystickVector, keyboardVector } from '../src/input';

describe('joystickVector', () => {
  it('ignores a touch near the centre (dead zone)', () => {
    expect(joystickVector(0, 0, 60)).toEqual({ x: 0, y: 0, mag: 0 });
    expect(joystickVector(3, -2, 60)).toEqual({ x: 0, y: 0, mag: 0 });
  });

  it('scales the push by how far the stick is moved', () => {
    const v = joystickVector(30, 0, 60);
    expect(v.mag).toBeCloseTo(0.5, 9);
    expect(v.x).toBeCloseTo(1, 9);
    expect(v.y).toBeCloseTo(0, 9);
  });

  it('clamps beyond the rim and keeps the direction', () => {
    const v = joystickVector(-300, 300, 60);
    expect(v.mag).toBe(1);
    expect(v.x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(v.y).toBeCloseTo(Math.SQRT1_2, 9);
  });
});

describe('keyboardVector', () => {
  it('maps arrows and WASD to screen directions', () => {
    expect(keyboardVector(new Set(['ArrowRight']))).toEqual({ x: 1, y: 0 });
    expect(keyboardVector(new Set(['KeyA']))).toEqual({ x: -1, y: 0 });
    expect(keyboardVector(new Set(['KeyW']))).toEqual({ x: 0, y: -1 });
    expect(keyboardVector(new Set(['ArrowDown']))).toEqual({ x: 0, y: 1 });
  });

  it('keeps diagonals at unit length and cancels opposite keys', () => {
    const d = keyboardVector(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 9);
    expect(keyboardVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
    expect(keyboardVector(new Set())).toEqual({ x: 0, y: 0 });
  });
});
