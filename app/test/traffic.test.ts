import { describe, expect, it } from 'vitest';
import { stepAside, vehicleAt } from '../src/traffic';

const fp = () => ({ w: 2, d: 1 });
const car = { item: 'car_red', x: 10, y: 10, rot: 0, bob: 0, moving: true };

describe('cars are solid', () => {
  it('one standing in a car is found, one beside it is not', () => {
    expect(vehicleAt({ x: 10.5, y: 10.1 }, [car], fp)).toBe(car);
    expect(vehicleAt({ x: 10, y: 11.2 }, [car], fp)).toBe(null);
    // turned a quarter, it is long the other way
    expect(vehicleAt({ x: 10.1, y: 10.9 }, [{ ...car, rot: 1 }], fp)).not.toBe(null);
  });

  it('a car coming on someone moves them to the nearer side, clear of it', () => {
    const out = stepAside({ x: 10.2, y: 10.2 }, car, fp());
    expect(vehicleAt(out, [car], fp)).toBe(null);
    expect(out.y).toBeGreaterThan(10);
  });
});
