import { describe, expect, it } from 'vitest';
import { isRepeat } from '../src/ui/toast';

describe('toasts', () => {
  it('the same words are not said twice while they are still on the screen', () => {
    expect(isRepeat(['Нова пошта: 8 листів'], 'Нова пошта: 8 листів')).toBe(true);
    expect(isRepeat(['Нова пошта: 8 листів'], 'Сьогодні в селі тебе дехто чекає')).toBe(false);
    expect(isRepeat([], 'Нова пошта: 8 листів')).toBe(false);
  });
});
