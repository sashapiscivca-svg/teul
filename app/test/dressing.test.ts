import { describe, expect, it } from 'vitest';
import { rainWay, dressForWeather } from '../src/dressing';

const out = (season: string, sky: string, air?: number) => ({ season, sky, outdoors: true, air });

describe('people dress for the weather', () => {
  it('in a winter cold: a coat or a down coat, boots and a beanie or a scarf', () => {
    for (let seed = 0; seed < 30; seed++) {
      const d = dressForWeather(out('Winter', 'clear', -20), seed, 'adult', false);
      expect(['9', '11']).toContain(d['look.top']);
      expect(d['look.shoe']).toBe('1');
      expect(['2', '8']).toContain(d['look.acc']);
    }
  });

  it('in a hard frost: down coats and sheepskins, felt boots, fur hats, mittens on everyone', () => {
    const elders = Array.from({ length: 30 }, (_, s) => dressForWeather(out('Winter', 'clear', -150), s, 'elder', false));
    for (const d of elders) {
      expect(['11', '12']).toContain(d['look.top']);
      expect(d['look.shoe']).toBe('3');
      expect(d['look.acc']).toBe('14');
      expect(d['look.mitt']).toBe('1');
    }
    expect(elders.some((d) => d['look.top'] === '12')).toBe(true);
  });

  it('in the rain most open an umbrella or put on a raincoat, and the rest run for cover', () => {
    const adults = Array.from({ length: 100 }, (_, s) => dressForWeather(out('Summer', 'rain', 180), s, 'adult', false));
    const umbrellas = adults.filter((d) => d['look.acc'] === '12').length;
    const coats = adults.filter((d) => d['look.top'] === '10').length;
    expect(umbrellas).toBeGreaterThan(coats);
    expect(umbrellas + coats).toBeGreaterThan(70);
    // whoever has neither is running
    for (let s = 0; s < 100; s++) {
      const d = adults[s];
      if (d['look.acc'] !== '12' && d['look.top'] !== '10') expect(rainWay(s, 'adult')).toBe('run');
    }
    // children: raincoats and rubber boots, or a dash through the puddles
    for (let s = 0; s < 20; s++) {
      const d = dressForWeather(out('Summer', 'storm', 200), s, 'child', false);
      expect(d['look.top'] === '10' || rainWay(s, 'child') === 'run').toBe(true);
    }
  });

  it('in the heat: light clothes, sandals, sundresses and panamas', () => {
    const hot = Array.from({ length: 40 }, (_, s) => dressForWeather(out('Summer', 'clear', 300), s, 'adult', false, 'f'));
    expect(hot.every((d) => d['look.shoe'] === '2')).toBe(true);
    expect(hot.some((d) => d['look.top'] === '15')).toBe(true);
    expect(hot.some((d) => d['look.acc'] === '13')).toBe(true);
    // men keep to t-shirts and shorts
    expect(dressForWeather(out('Summer', 'clear', 300), 2, 'adult', false, 'm')['look.bottom']).toBe('1');
  });

  it('in the chill of spring and autumn: trenches, jumpers, windbreakers', () => {
    const tops = new Set(Array.from({ length: 30 }, (_, s) => dressForWeather(out('Autumn', 'cloudy', 60), s, 'adult', false)['look.top']));
    expect(tops).toEqual(new Set(['13', '7', '9']));
    const cool = new Set(Array.from({ length: 30 }, (_, s) => dressForWeather(out('Spring', 'clear', 130), s, 'adult', false)['look.top']));
    expect(cool.has('14')).toBe(true);
  });

  it('indoors, in uniform or on a mild day nothing changes', () => {
    expect(dressForWeather({ season: 'Winter', sky: 'snow', outdoors: false }, 3, 'adult', false)).toEqual({});
    expect(dressForWeather(out('Winter', 'snow', -30), 3, 'adult', true)).toEqual({});
    expect(dressForWeather(out('Summer', 'clear', 210), 3, 'adult', false)).toEqual({});
  });

  it('a person dresses the same way on the same kind of day', () => {
    const w = out('Winter', 'clear', -40);
    expect(dressForWeather(w, 17, 'elder', false)).toEqual(dressForWeather(w, 17, 'elder', false));
  });
});
