import { describe, expect, it } from 'vitest';
import { initialMode } from '../src/inputmode';

describe('the controls shown', () => {
  it('a computer gets keyboard and mouse, a phone the touch stick', () => {
    expect(initialMode({ maxTouchPoints: 0, finePointer: true, desktopShell: false })).toBe('pc');
    expect(initialMode({ maxTouchPoints: 5, finePointer: false, desktopShell: false })).toBe('touch');
    // a touch laptop starts with touch controls until keys or the mouse are used
    expect(initialMode({ maxTouchPoints: 10, finePointer: true, desktopShell: false })).toBe('touch');
    // the desktop app is a computer
    expect(initialMode({ maxTouchPoints: 10, finePointer: true, desktopShell: true })).toBe('pc');
  });
});
