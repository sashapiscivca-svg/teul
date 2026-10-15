import { describe, expect, it } from 'vitest';
import { residentIntro, residentLine, type TalkCtx } from '../src/talk';

const base: TalkCtx = { id: 'res_1', name: 'Оксана', gender: 'f', age: 'adult', activity: 'leisure', part: 'day', weather: 'clear', season: 'Autumn', mood: 0, news: [] };

describe('what the townsfolk say', () => {
  it('different people say different things in the same moment', () => {
    const busy = new Set<string>();
    const said = Array.from({ length: 20 }, (_, i) => {
      const line = residentLine({ ...base, id: `res_${i + 1}` }, 7, busy);
      busy.add(line);
      return line;
    });
    expect(new Set(said).size).toBe(20);
  });

  it('even without minding each other, few say the same', () => {
    const said = Array.from({ length: 20 }, (_, i) => residentLine({ ...base, id: `res_${i + 1}` }, 7));
    expect(new Set(said).size).toBeGreaterThanOrEqual(12);
  });

  it('a person speaks of their work, their age, their pram', () => {
    const baker = Array.from({ length: 12 }, (_, s) => residentLine({ ...base, activity: 'work', role: 'baker' }, s));
    expect(baker.some((l) => /тісто|хліб|піч|Маковики/i.test(l))).toBe(true);
    const kid = Array.from({ length: 12 }, (_, s) => residentLine({ ...base, age: 'child' }, s));
    expect(kid.every((l) => !l.startsWith('Чули?'))).toBe(true);
    const parent = Array.from({ length: 20 }, (_, s) => residentLine({ ...base, pram: true }, s));
    expect(parent.some((l) => /малий|зубчик|ростемо/.test(l))).toBe(true);
  });

  it('the same person says the same thing in the same moment, and moves on later', () => {
    expect(residentLine(base, 3)).toBe(residentLine(base, 3));
    const lines = new Set(Array.from({ length: 10 }, (_, s) => residentLine(base, s)));
    expect(lines.size).toBeGreaterThan(4);
  });

  it('a tap gives a greeting for the hour, the name and the work', () => {
    const t = residentIntro({ ...base, part: 'evening', activity: 'work', role: 'baker' }, 'пекарка', 1);
    expect(t.startsWith('Добрий вечір! Я Оксана, пекарка.')).toBe(true);
  });
});
