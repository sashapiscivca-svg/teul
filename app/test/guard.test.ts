import { describe, expect, it } from 'vitest';
import { guardPictures } from '../src/guard';

describe('the pictures stay in the world', () => {
  const on = new Map<string, (e: Event) => void>();
  guardPictures({ addEventListener: (type: string, f: (e: Event) => void) => on.set(type, f) } as never);
  const fire = (type: string, target: unknown) => {
    let stopped = false;
    on.get(type)?.({ target, preventDefault: () => (stopped = true) } as unknown as Event);
    return stopped;
  };
  const picture = { closest: () => null };
  const field = { closest: (q: string) => (q.includes('input') ? {} : null) };

  it('no menu, no drag, no copy on a picture', () => {
    expect(fire('contextmenu', picture)).toBe(true);
    expect(fire('dragstart', picture)).toBe(true);
    expect(fire('copy', picture)).toBe(true);
  });

  it('a typing field keeps its long press', () => {
    expect(fire('contextmenu', field)).toBe(false);
    expect(fire('selectstart', field)).toBe(false);
  });
});
