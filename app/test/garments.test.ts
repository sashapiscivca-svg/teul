import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCESSORIES, BOTTOM_STYLES, DEFAULT_LOOK, MITTS, SHOE_STYLES, TOP_STYLES, lookFromSettings } from '../src/character';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8')) as {
  items: { id: string; wear?: { slot: string; set: [string, string][] }; acquire: unknown }[];
};
const garments = pack.items.filter((i) => i.wear);
const STYLE_KEY: Record<string, [string, number, keyof typeof DEFAULT_LOOK]> = {
  top: ['look.top', TOP_STYLES, 'topStyle'],
  bottom: ['look.bottom', BOTTOM_STYLES, 'bottomStyle'],
  shoes: ['look.shoe', SHOE_STYLES, 'shoeStyle'],
  acc: ['look.acc', ACCESSORIES, 'acc'],
  hands: ['look.mitt', MITTS, 'mitt'],
};

describe('the clothes of the shop', () => {
  it('there are clothes for every part, coats and raincoats among them', () => {
    for (const slot of ['top', 'bottom', 'shoes', 'acc']) expect(garments.filter((g) => g.wear!.slot === slot).length).toBeGreaterThan(3);
    expect(garments.some((g) => g.wear!.set.some(([k, v]) => k === 'look.top' && v === '9'))).toBe(true);
    expect(garments.some((g) => g.wear!.set.some(([k, v]) => k === 'look.top' && v === '10'))).toBe(true);
  });

  it('every season has its clothes: down coats, felt boots and mittens; trenches and umbrellas; sundresses, swimwear and panamas', () => {
    const has = (k: string, v: string) => garments.some((g) => g.wear!.set.some(([a, b]) => a === k && b === v));
    for (const [k, v] of [['look.top', '11'], ['look.top', '12'], ['look.shoe', '3'], ['look.mitt', '1'], ['look.acc', '14'], ['look.top', '13'], ['look.top', '14'], ['look.acc', '12'], ['look.top', '15'], ['look.top', '16'], ['look.bottom', '5'], ['look.acc', '13'], ['look.acc', '11']])
      expect(has(k, v), `${k}=${v}`).toBe(true);
  });

  it('every garment gives a style the figure can draw, in a colour it reads', () => {
    for (const g of garments) {
      const [key, count, field] = STYLE_KEY[g.wear!.slot];
      const style = g.wear!.set.find(([k]) => k === key);
      expect(style, g.id).toBeDefined();
      expect(Number(style![1]), g.id).toBeLessThan(count);
      const look = lookFromSettings(Object.fromEntries(g.wear!.set));
      expect(look[field], g.id).toBe(Number(style![1]));
      for (const [k, v] of g.wear!.set) if (k.endsWith('_color')) expect(v, `${g.id} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(g.acquire, g.id).toHaveProperty('coins');
    }
  });
});
