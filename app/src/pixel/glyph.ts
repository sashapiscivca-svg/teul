// Pixel bitmaps of the stroke glyphs, computed geometrically (isPointInStroke) rather than by reading pixels
// back from a canvas, which some browsers deliberately randomise.

import { GLYPHS } from '../icons';
import { pixelBits } from './icons12';

const cache = new Map<string, boolean[]>();

/** A 12×12 on/off grid for a glyph. */
export function glyphBits(name: string): boolean[] {
  let bits = cache.get(name);
  if (bits) return bits;
  const drawn = pixelBits(name);
  if (drawn) {
    cache.set(name, drawn);
    return drawn;
  }
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const path = new Path2D(GLYPHS[name] ?? GLYPHS.check);
  g.lineWidth = 2.7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  bits = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      let hits = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (g.isPointInStroke(path, x * 2 + (i + 0.5) / 2, y * 2 + (j + 0.5) / 2)) hits++;
      bits.push(hits >= 6);
    }
  }
  cache.set(name, bits);
  return bits;
}
