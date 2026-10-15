import { describe, expect, it } from 'vitest';
import { figureLayers, lookFromSettings, DEFAULT_LOOK } from '../src/character';
import type { ComfortView } from '../src/engine';
import { heroFx, iceCells, nearHeat, remark, walkFactor } from '../src/warmth';

const view = (o: Partial<ComfortView>): ComfortView => ({ air: 100, out: 100, feel: 0, wet: false, breath: false, hearth: false, sun: false, ice: false, ...o });

describe('cold and warmth as the hero lives them', () => {
  it('a stove warms only close by, and only with gas; a fireplace and a campfire reach further', () => {
    const things = [{ item: 'stove', x: 4, y: 4, w: 1, d: 1 }];
    expect(nearHeat(5, 5, things)).toBe(true);
    expect(nearHeat(5, 5, things, false)).toBe(false);
    expect(nearHeat(9, 9, things)).toBe(false);
    expect(nearHeat(8.5, 5, [{ item: 'campfire', x: 4, y: 4, w: 2, d: 2 }])).toBe(true);
    expect(nearHeat(5, 5, [{ item: 'sofa', x: 4, y: 4, w: 2, d: 1 }])).toBe(false);
  });

  it('frozen through: hugging oneself when standing, a slower walk; the heat: sweat; the ice: skates', () => {
    const cold = view({ feel: -3, breath: true });
    expect(heroFx(cold, { moving: false, seated: false, onIce: false, outdoors: true })).toMatchObject({ hug: true, breath: true });
    expect(heroFx(cold, { moving: true, seated: false, onIce: false, outdoors: true }).hug).toBe(false);
    expect(walkFactor(cold)).toBeLessThan(1);
    expect(walkFactor(view({}))).toBe(1);
    expect(heroFx(view({ feel: 2, sun: true }), { moving: false, seated: false, onIce: false, outdoors: true }).sweat).toBe(true);
    // by the stove one is warm, not sweating
    expect(heroFx(view({ feel: 3, hearth: true }), { moving: false, seated: false, onIce: false, outdoors: false }).sweat).toBe(false);
    expect(heroFx(view({}), { moving: true, seated: false, onIce: true, outdoors: true }).skate).toBe(true);
  });

  it('passers-by say something only when it shows', () => {
    expect(remark(view({}), 1)).toBeNull();
    expect(remark(view({ feel: -2 }), 1)).toMatch(/\S/);
    expect(remark(view({ feel: 2, sun: true }), 1)).toMatch(/\S/);
    expect(remark(view({ wet: true, feel: -1 }), 0)).toMatch(/Змок|мокрий/);
  });

  it('the ice of a map is its still water cells', () => {
    const ice = iceCells([[3, 1, 3], [4, 2, 2]]);
    expect([...ice].sort()).toEqual(['1,3', '2,3', '2,4', '3,3']);
  });

  it('every new garment draws, in every direction, with the weather on the figure', () => {
    for (const top of ['11', '12', '13', '14', '15', '16']) {
      for (const dir of ['down', 'up', 'left', 'right'] as const) {
        const look = lookFromSettings({ 'look.top': top, 'look.bottom': '5', 'look.shoe': '3', 'look.acc': '14', 'look.mitt': '1', 'look.mitt_color': '#d9534f' });
        expect(look.topStyle).toBe(Number(top));
        for (const fx of [{}, { hug: true, breath: true }, { skate: true }, { sweat: true }]) expect(figureLayers(look, dir, 'idle', 0, false, fx).length).toBeGreaterThan(4);
      }
    }
    // the umbrella, the panama and dark glasses change the drawing
    const plain = JSON.stringify(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0));
    for (const acc of [11, 12, 13, 14]) expect(JSON.stringify(figureLayers({ ...DEFAULT_LOOK, acc }, 'down', 'idle', 0))).not.toBe(plain);
    // mittens are drawn on the hands
    expect(JSON.stringify(figureLayers({ ...DEFAULT_LOOK, mitt: 1, mittColor: '#123456' }, 'down', 'idle', 0))).toContain('#12345');
  });
});

describe('the street thermometer by the clock', () => {
  it('shows whole degrees with a sign', async () => {
    const { degrees } = await import('../src/ui/hud');
    expect(degrees(72)).toBe('+7°');
    expect(degrees(-34)).toBe('−3°');
    expect(degrees(3)).toBe('0°');
    expect(degrees(-4)).toBe('0°');
  });
});
