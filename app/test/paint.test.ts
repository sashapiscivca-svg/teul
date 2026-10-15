import { describe, expect, it } from 'vitest';
import { ART_COLORS, ART_H, ART_W, artColor, blankArt } from '../src/ui/paint';

describe('the easel', () => {
  it('paints 16×12 pixels of 16 colours, as the core takes them', () => {
    const blank = blankArt();
    expect(blank).toHaveLength(ART_W * ART_H);
    expect(/^[0-9a-f]+$/.test(blank)).toBe(true);
    expect(new Set(ART_COLORS).size).toBe(16);
  });

  it('reads a pixel back as its colour', () => {
    const p = blankArt().split('');
    p[3 * ART_W + 5] = 'a';
    expect(artColor(p.join(''), 5, 3)).toBe(ART_COLORS[10]);
    expect(artColor(p.join(''), 0, 0)).toBe(ART_COLORS[15]);
  });
});
