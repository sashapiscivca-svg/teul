import { describe, expect, it } from 'vitest';
import { makeCat, makeHuman, seedOf, type Accessory } from '../src/sprites';

function cells(layers: { color: string; path: string }[]): Set<string> {
  const out = new Set<string>();
  for (const l of layers) {
    for (const m of l.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      const w = Number(m[3]);
      expect(Number(m[4])).toBe(w);
      for (let i = 0; i < w; i++) out.add(`${x + i},${y}`);
    }
  }
  return out;
}

const ACCESSORIES: Accessory[] = ['none', 'glasses', 'scarf', 'hat', 'cap', 'apron', 'cane'];

describe('sprites', () => {
  it('hashes names to stable numbers', () => {
    expect(seedOf('Орися')).toBe(seedOf('Орися'));
    expect(seedOf('Орися')).not.toBe(seedOf('Тихон'));
  });

  it('is deterministic: the same seed gives the same figure', () => {
    expect(makeHuman({ seed: 'Орися', hair: 1, acc: 'glasses' })).toEqual(makeHuman({ seed: 'Орися', hair: 1, acc: 'glasses' }));
  });

  it('differs between seeds', () => {
    expect(makeHuman({ seed: 'Орися' })).not.toEqual(makeHuman({ seed: 'Тихон' }));
  });

  it('never needs more than 16 colour layers, whatever the seed or accessory', () => {
    for (let i = 0; i < 120; i++) {
      for (const acc of ACCESSORIES) {
        const layers = makeHuman({ seed: `s${i}`, acc, hair: i % 4, elder: acc === 'cane' });
        expect(layers.length).toBeLessThanOrEqual(16);
        expect(layers.length).toBeGreaterThan(3);
      }
    }
  });

  it('draws only unit-high runs inside the 32x32 grid', () => {
    for (const acc of ACCESSORIES) {
      for (const layers of [makeHuman({ seed: 'grid', acc }), makeCat({ seed: 'grid' })]) {
        for (const l of layers) expect(l.path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
        for (const key of cells(layers)) {
          const [x, y] = key.split(',').map(Number);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(32);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(32);
        }
      }
    }
  });

  it('is mirror-symmetric apart from the cane and the cap brim, which point to one side on purpose', () => {
    for (const acc of ACCESSORIES.filter((a) => a !== 'cane' && a !== 'cap')) {
      const set = cells(makeHuman({ seed: 'sym', hair: 2, acc }));
      for (const key of set) {
        const [x, y] = key.split(',').map(Number);
        expect(set.has(`${31 - x},${y}`), `${acc}: cell ${key} has no mirror`).toBe(true);
      }
    }
  });

  it('changes the figure for every accessory and makes the cane asymmetric', () => {
    const plain = JSON.stringify(makeHuman({ seed: 'acc', hair: 0, acc: 'none' }));
    for (const acc of ACCESSORIES.filter((a) => a !== 'none')) {
      expect(JSON.stringify(makeHuman({ seed: 'acc', hair: 0, acc })), acc).not.toBe(plain);
    }
    const cane = cells(makeHuman({ seed: 'acc', hair: 0, acc: 'cane' }));
    expect([...cane].some((k) => !cane.has(`${31 - Number(k.split(',')[0])},${k.split(',')[1]}`))).toBe(true);
  });

  it('turns an elder white-haired', () => {
    const colors = makeHuman({ seed: 'old', elder: true, hair: 0 }).map((l) => l.color);
    expect(colors).toContain('#e8e8f0');
  });

  it('draws a cat with few layers and a shadow', () => {
    const cat = makeCat({ seed: 'Мурка' });
    expect(cat.length).toBeLessThanOrEqual(8);
    expect(cat.some((l) => l.color === '#0000004d')).toBe(true);
  });
});
