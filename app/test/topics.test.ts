import { describe, expect, it } from 'vitest';
import { nppOpinion, townTopics } from '../src/topics';

describe('what the town talks about', () => {
  it('the plant: some for, some against, each the same way always', () => {
    const ops = Array.from({ length: 60 }, (_, i) => nppOpinion(`r${i}`));
    expect(ops).toContain(1);
    expect(ops).toContain(-1);
    expect(ops).toContain(0);
    expect(nppOpinion('r7')).toBe(nppOpinion('r7'));
    const npp = { stage: 1, id: 'announced', name: 'Оголошення', since: 0, built: 0, event: null };
    const forIt = Array.from({ length: 60 }, (_, i) => `r${i}`).find((id) => nppOpinion(id) === 1)!;
    const against = Array.from({ length: 60 }, (_, i) => `r${i}`).find((id) => nppOpinion(id) === -1)!;
    expect(townTopics(forIt, null, npp).join(' ')).toMatch(/за|світло/);
    expect(townTopics(against, null, npp).join(' ')).toMatch(/проти/);
  });

  it('the days before a celebration, the day, the morning after', () => {
    const f = { id: 'town_day', name: 'День Липового', phase: 'prep' as const, days_left: 3, ready: 500 };
    expect(townTopics('a', f, null).join(' ')).toMatch(/Оркестр|Сцену|медівник/);
    expect(townTopics('a', { ...f, phase: 'day', days_left: 0, ready: 1000 }, null)[0]).toMatch(/Зі святом/);
    expect(townTopics('a', null, null)).toEqual([]);
  });
});
