import { describe, expect, it } from 'vitest';
import { ACCESSORIES, BEARDS, BOTTOM_STYLES, CHEEKS, DEFAULT_LOOK, HAIR_STYLES, SHOE_STYLES, TOP_STYLES, dirOf, figureLayers, lookFromSettings, petFromSettings, petLayers, type Dir } from '../src/character';

const cells = (layers: { color: string; path: string }[]) => JSON.stringify(layers);

describe('lookFromSettings', () => {
  it('falls back to the default look when nothing is set', () => {
    expect(lookFromSettings({})).toEqual(DEFAULT_LOOK);
  });

  it('reads colours and style numbers, and ignores junk', () => {
    const look = lookFromSettings({ 'look.hair_color': '#AABBCC', 'look.hair': '4', 'look.top': 'x', 'look.skin_color': 'red', 'look.acc': '99' });
    expect(look.hair).toBe('#aabbcc');
    expect(look.hairStyle).toBe(4);
    expect(look.topStyle).toBe(DEFAULT_LOOK.topStyle);
    expect(look.skin).toBe(DEFAULT_LOOK.skin);
    expect(look.acc).toBe(ACCESSORIES - 1);
  });

  it('reads the pet look', () => {
    expect(petFromSettings({ 'look.cat_color': '#112233', 'look.cat_pattern': '2', 'look.pet': '1' })).toEqual({ kind: 1, fur: '#112233', pattern: 2 });
  });
});

describe('figureLayers', () => {
  const dirs: Dir[] = ['down', 'up', 'left', 'right'];

  it('is deterministic and cached', () => {
    expect(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0)).toBe(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0));
  });

  it('draws every direction differently', () => {
    const drawn = dirs.map((d) => cells(figureLayers(DEFAULT_LOOK, d, 'idle', 0)));
    expect(new Set(drawn).size).toBe(4);
  });

  it('left has the mirrored silhouette of right (light still comes from the upper left)', () => {
    const set = (d: Dir) => {
      const out = new Set<string>();
      for (const l of figureLayers(DEFAULT_LOOK, d, 'idle', 0)) for (const m of l.path.matchAll(/M(\d+) (\d+)h(\d+)/g)) for (let i = 0; i < Number(m[3]); i++) out.add(`${Number(m[1]) + i},${m[2]}`);
      return out;
    };
    const mirrored = new Set([...set('right')].map((c) => {
      const [x, y] = c.split(',').map(Number);
      return `${31 - x},${y}`;
    }));
    expect(set('left')).toEqual(mirrored);
  });

  it('animates the walk and keeps four distinct steps', () => {
    const steps = [0, 1, 2, 3].map((f) => cells(figureLayers(DEFAULT_LOOK, 'right', 'walk', f)));
    expect(steps[0]).not.toBe(steps[1]);
    expect(steps[1]).not.toBe(steps[3]);
    expect(steps[0]).toBe(steps[2]);
  });

  it('sits lower than it stands and breathes when idle', () => {
    expect(cells(figureLayers(DEFAULT_LOOK, 'down', 'sit', 0))).not.toBe(cells(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0)));
    expect(cells(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0))).not.toBe(cells(figureLayers(DEFAULT_LOOK, 'down', 'idle', 1)));
  });

  it('every hair style and accessory changes the picture and stays inside the 32x32 grid', () => {
    const plain = cells(figureLayers({ ...DEFAULT_LOOK, hairStyle: 0, acc: 0 }, 'down', 'idle', 0));
    for (let i = 1; i < HAIR_STYLES; i++) expect(cells(figureLayers({ ...DEFAULT_LOOK, hairStyle: i, acc: 0 }, 'down', 'idle', 0)), `hair ${i}`).not.toBe(plain);
    for (let a = 1; a < ACCESSORIES; a++) expect(cells(figureLayers({ ...DEFAULT_LOOK, acc: a }, 'down', 'idle', 0)), `acc ${a}`).not.toBe(cells(figureLayers({ ...DEFAULT_LOOK, acc: 0 }, 'down', 'idle', 0)));
    for (const d of dirs)
      for (const l of figureLayers({ ...DEFAULT_LOOK, hairStyle: 3, topStyle: 3, acc: 3 }, d, 'walk', 1))
        for (const m of l.path.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)) {
          expect(Number(m[1])).toBeGreaterThanOrEqual(0);
          expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(32);
          expect(Number(m[2])).toBeGreaterThanOrEqual(0);
          expect(Number(m[2])).toBeLessThan(32);
        }
  });
});

describe('the wider wardrobe', () => {
  const dirs: Dir[] = ['down', 'up', 'left', 'right'];
  const poses = ['idle', 'walk', 'sit', 'wash'] as const;

  it('draws old saves exactly as before', () => {
    let h = 0;
    const add = (s: string) => {
      for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    };
    const variants: object[] = [];
    for (let i = 0; i < 9; i++) variants.push({ hairStyle: i });
    for (let i = 0; i < 6; i++) variants.push({ topStyle: i });
    for (let i = 0; i < 3; i++) variants.push({ bottomStyle: i });
    for (let i = 0; i < 8; i++) variants.push({ acc: i });
    for (let i = 0; i < 4; i++) variants.push({ face: i });
    for (const v of variants) for (const d of dirs) for (const p of poses) for (const f of [0, 1, 3]) add(JSON.stringify(figureLayers({ ...DEFAULT_LOOK, ...v }, d, p, f, f === 3)));
    expect(h).toBe(-722413725);
  });

  it('has more hair, tops, bottoms, shoes, beards, cheeks and accessories', () => {
    expect(HAIR_STYLES).toBeGreaterThanOrEqual(14);
    expect(TOP_STYLES).toBeGreaterThanOrEqual(9);
    expect(BOTTOM_STYLES).toBeGreaterThanOrEqual(5);
    expect(SHOE_STYLES).toBeGreaterThanOrEqual(3);
    expect(BEARDS).toBeGreaterThanOrEqual(4);
    expect(CHEEKS).toBeGreaterThanOrEqual(3);
    expect(ACCESSORIES).toBeGreaterThanOrEqual(11);
  });

  it('reads the new settings and defaults them to how a figure looked before', () => {
    expect(lookFromSettings({})).toMatchObject({ shoeStyle: 0, beard: 0, cheeks: 0 });
    expect(lookFromSettings({ 'look.shoe': '1', 'look.beard': '3', 'look.cheeks': '2' })).toMatchObject({ shoeStyle: 1, beard: 3, cheeks: 2 });
  });

  it('every new option changes the picture in every direction and pose, inside the grid', () => {
    const options: [keyof typeof DEFAULT_LOOK, number, number][] = [
      ['hairStyle', 9, HAIR_STYLES], ['topStyle', 6, TOP_STYLES], ['bottomStyle', 3, BOTTOM_STYLES],
      ['shoeStyle', 1, SHOE_STYLES], ['beard', 1, BEARDS], ['cheeks', 1, CHEEKS], ['acc', 8, ACCESSORIES],
    ];
    const base = { ...DEFAULT_LOOK, hairStyle: 0, acc: 0 };
    for (const [key, from, to] of options)
      for (let i = from; i < to; i++) {
        const look = { ...base, [key]: i };
        const seen = dirs.filter((d) => cells(figureLayers(look, d, 'idle', 0)) !== cells(figureLayers(base, d, 'idle', 0)));
        expect(seen.length, `${key} ${i}`).toBeGreaterThan(0);
        for (const d of dirs)
          for (const p of [...poses, 'work', 'eat'] as const)
            for (const l of figureLayers(look, d, p, 1))
              for (const m of l.path.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)) {
                expect(Number(m[1]), `${key} ${i} ${d} ${p}`).toBeGreaterThanOrEqual(0);
                expect(Number(m[1]) + Number(m[3])).toBeLessThanOrEqual(32);
                expect(Number(m[2])).toBeGreaterThanOrEqual(0);
                expect(Number(m[2])).toBeLessThan(32);
              }
      }
  }, 30000);
});

describe('petLayers', () => {
  it('has distinct sit, walk and sleep poses and mirrors with direction', () => {
    const look = { kind: 0, fur: '#d98a3a', pattern: 1 };
    const sit = cells(petLayers(look, 'right', 'sit', 0));
    expect(sit).not.toBe(cells(petLayers(look, 'right', 'walk', 0)));
    expect(sit).not.toBe(cells(petLayers(look, 'right', 'sleep', 0)));
    expect(cells(petLayers(look, 'left', 'sit', 0))).not.toBe(sit);
    expect(cells(petLayers(look, 'right', 'walk', 0))).not.toBe(cells(petLayers(look, 'right', 'walk', 1)));
  });
});

describe('dirOf', () => {
  it('picks the screen direction of a push and keeps the old one when still', () => {
    expect(dirOf(1, 0, 'down')).toBe('right');
    expect(dirOf(-1, 0.1, 'down')).toBe('left');
    expect(dirOf(0, 1, 'left')).toBe('down');
    expect(dirOf(0.1, -1, 'left')).toBe('up');
    expect(dirOf(0, 0, 'up')).toBe('up');
  });
});
