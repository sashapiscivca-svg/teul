import { describe, expect, it } from 'vitest';
import { ACCESSORIES, BOTTOM_STYLES, DEFAULT_LOOK, HAIR_STYLES, HOLDS, lookFromSettings, TOP_STYLES, type Dir, type PoseName } from '../src/character';
import { layersSize } from '../src/layers';
import { buildOf, HERO_PX, heroLayers } from '../src/people/hero';

const cells = (layers: { color: string; path: string }[]) => JSON.stringify(layers);
const dirs: Dir[] = ['down', 'up', 'left', 'right'];
const POSES: PoseName[] = ['idle', 'walk', 'sit', 'crouch', 'ground', 'lotus', 'pray', 'wash', 'work', 'eat', 'pedal', ...HOLDS];

function pixels(layers: { color: string; path: string }[]): Set<string> {
  const out = new Set<string>();
  for (const l of layers) for (const m of l.path.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)) for (let i = 0; i < Number(m[3]); i++) out.add(`${Number(m[1]) + i},${m[2]}`);
  return out;
}

describe('heroLayers', () => {
  it('is cached and marked as drawn on the hero grid', () => {
    const a = heroLayers(DEFAULT_LOOK, 'down', 'idle', 0);
    expect(heroLayers(DEFAULT_LOOK, 'down', 'idle', 0)).toBe(a);
    expect(layersSize(a)).toBe(HERO_PX);
  });

  it('draws every direction differently, left the mirror of right', () => {
    expect(new Set(dirs.map((d) => cells(heroLayers(DEFAULT_LOOK, d, 'idle', 0)))).size).toBe(4);
    const mirrored = new Set([...pixels(heroLayers(DEFAULT_LOOK, 'right', 'walk', 1))].map((c) => {
      const [x, y] = c.split(',').map(Number);
      return `${HERO_PX - 1 - x},${y}`;
    }));
    expect(pixels(heroLayers(DEFAULT_LOOK, 'left', 'walk', 1))).toEqual(mirrored);
  });

  it('walks in four steps, every pose its own picture, all inside the grid', () => {
    const steps = [0, 1, 2, 3].map((f) => cells(heroLayers(DEFAULT_LOOK, 'right', 'walk', f)));
    expect(steps[1]).not.toBe(steps[0]);
    expect(steps[1]).not.toBe(steps[3]);
    const seen = new Set<string>();
    for (const p of POSES) {
      const pic = cells(heroLayers(DEFAULT_LOOK, 'right', p, 1));
      expect(seen.has(pic), p).toBe(false);
      seen.add(pic);
      for (const d of dirs)
        for (const c of pixels(heroLayers(DEFAULT_LOOK, d, p, 1))) {
          const [x, y] = c.split(',').map(Number);
          expect(x >= 0 && x < HERO_PX && y >= 0 && y < HERO_PX, `${p} ${d} ${c}`).toBe(true);
        }
    }
  });

  it('every choice of look changes the picture', () => {
    const base = { ...DEFAULT_LOOK, hairStyle: 0, acc: 0, topStyle: 0, bottomStyle: 0 };
    const plain = dirs.map((d) => cells(heroLayers(base, d, 'idle', 0)));
    const differs = (o: object) => dirs.some((d, i) => cells(heroLayers({ ...base, ...o }, d, 'idle', 0)) !== plain[i]);
    for (let i = 1; i < HAIR_STYLES; i++) expect(differs({ hairStyle: i }), `hair ${i}`).toBe(true);
    for (let i = 1; i < TOP_STYLES; i++) expect(differs({ topStyle: i }), `top ${i}`).toBe(true);
    for (let i = 1; i < BOTTOM_STYLES; i++) expect(differs({ bottomStyle: i }), `bottom ${i}`).toBe(true);
    for (let i = 1; i <= ACCESSORIES; i++) expect(differs({ acc: i }), `acc ${i}`).toBe(true);
    for (const o of [{ shoeStyle: 1 }, { shoeStyle: 2 }, { shoeStyle: 3 }, { beard: 1 }, { beard: 2 }, { beard: 3 }, { face: 1 }, { face: 2 }, { face: 3 }, { cheeks: 1 }, { cheeks: 2 }, { build: 0 }, { mitt: 1, mittColor: '#2244aa' }, { expr: 'grin' }])
      expect(differs(o), JSON.stringify(o)).toBe(true);
  });

  it('reads the build when chosen and guesses it for an older hero', () => {
    expect(lookFromSettings({ 'look.build': '0' }).build).toBe(0);
    expect(lookFromSettings({}).build).toBeUndefined();
    expect(buildOf({ ...DEFAULT_LOOK, beard: 3 })).toBe(1);
    expect(buildOf({ ...DEFAULT_LOOK, hairStyle: 1, beard: 0 })).toBe(0);
    expect(buildOf({ ...DEFAULT_LOOK, hairStyle: 4, beard: 0 })).toBe(1);
  });

  it('blinks, shivers and breathes in the frost', () => {
    expect(cells(heroLayers(DEFAULT_LOOK, 'down', 'idle', 0, true))).not.toBe(cells(heroLayers(DEFAULT_LOOK, 'down', 'idle', 0)));
    expect(cells(heroLayers(DEFAULT_LOOK, 'down', 'idle', 0, false, { hug: true }))).not.toBe(cells(heroLayers(DEFAULT_LOOK, 'down', 'idle', 0)));
    expect(cells(heroLayers(DEFAULT_LOOK, 'right', 'idle', 0, false, { breath: true }))).not.toBe(cells(heroLayers(DEFAULT_LOOK, 'right', 'idle', 0)));
  });
});
