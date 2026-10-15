import { describe, expect, it } from 'vitest';
import { eveningOf, kindOf, pickEvent, pickScenario, SCENARIO_TEXT, spookyTheme, type Night } from '../src/horror';

const night = (o: Partial<Night>): Night => ({ holiday: null, tomorrow: null, rift: false, minute: 23 * 60, place: 'home', ...o });

describe('the eerie nights (opt-in)', () => {
  it('belong to Halloween, Walpurgis, a Friday the 13th, Midsummer and the rift nights, and only after dark', () => {
    expect(spookyTheme(night({ holiday: 'halloween' }))).toBe('halloween');
    expect(spookyTheme(night({ date: { month: 10, day: 31, weekday: 5 } }))).toBe('halloween');
    expect(spookyTheme(night({ date: { month: 4, day: 30, weekday: 2 } }))).toBe('walpurgis');
    expect(spookyTheme(night({ date: { month: 2, day: 13, weekday: 4 } }))).toBe('friday13');
    expect(spookyTheme(night({ holiday: 'kupala' }))).toBe('midsummer');
    expect(spookyTheme(night({ rift: true }))).toBe('rift');
    // a 13th that is no Friday, an ordinary night, Halloween at noon: nothing
    expect(spookyTheme(night({ date: { month: 2, day: 13, weekday: 1 } }))).toBeNull();
    expect(spookyTheme(night({}))).toBeNull();
    expect(spookyTheme(night({ holiday: 'halloween', minute: 12 * 60 }))).toBeNull();
    // a sweet feast stays sweet
    expect(spookyTheme(night({ holiday: 'christmas' }))).toBeNull();
    expect(spookyTheme(night({ holiday: 'new_year' }))).toBeNull();
  });

  it('after midnight the night still belongs to the evening before', () => {
    expect(eveningOf(2 * 60)).toBe(-1);
    expect(eveningOf(22 * 60)).toBe(0);
    expect(eveningOf(12 * 60)).toBe(0);
  });

  it('never happens when the setting is off', () => {
    for (let slot = 0; slot < 200; slot++) {
      expect(pickEvent('halloween', 'home', 7, slot, false)).toBeNull();
      expect(pickScenario('halloween', 'village', 7, slot, false)).toBeNull();
      expect(pickScenario('friday13', 'forest', 7, slot, false)).toBeNull();
    }
  });

  it('when on, something happens now and then — fitting the place and the night — and the same for the same moment', () => {
    const kinds = new Set<string>();
    let some = 0;
    for (let slot = 0; slot < 200; slot++) {
      const e = pickEvent('halloween', 'home', 7, slot, true);
      if (!e) continue;
      some++;
      kinds.add(e.kind);
      expect(pickEvent('halloween', 'home', 7, slot, true)).toEqual(e);
      expect(e.text.length).toBeGreaterThan(10);
    }
    expect(some).toBeGreaterThan(40);
    expect(some).toBeLessThan(170);
    expect(kinds.has('knock')).toBe(true);
    // a knock happens at a door one is behind: at home, not in the forest
    for (let slot = 0; slot < 200; slot++) expect(pickEvent('halloween', 'forest', 7, slot, true)?.kind).not.toBe('knock');
    const has = (theme: Parameters<typeof pickEvent>[0], place: string, kind: string) => Array.from({ length: 300 }, (_, i) => pickEvent(theme, place, 3, i, true)?.kind).includes(kind as never);
    expect(has('halloween', 'cave', 'steps')).toBe(true);
    expect(has('friday13', 'home', 'phone')).toBe(true);
  });

  it('out of doors whole nights unfold: the mob in the town, the masked ones in the field, the hunt in the forest', () => {
    const seen = (theme: Parameters<typeof pickScenario>[0], place: string) => new Set(Array.from({ length: 400 }, (_, i) => pickScenario(theme, place, 5, i, true)).filter(Boolean));
    expect(seen('halloween', 'village').has('mob')).toBe(true);
    expect(seen('halloween', 'fields').has('field')).toBe(true);
    expect(seen('friday13', 'forest').has('chase')).toBe(true);
    expect(seen('friday13', 'village').has('chase')).toBe(true);
    // never indoors, at home or in the rift worlds
    for (const place of ['home', 'cafe_in', 'cave', 'rift_spring', 'rift_winter']) expect(seen('halloween', place).size).toBe(0);
    // not every moment: a night has its quiet stretches
    const n = Array.from({ length: 400 }, (_, i) => pickScenario('halloween', 'village', 5, i, true)).filter(Boolean).length;
    expect(n).toBeGreaterThan(80);
    expect(n).toBeLessThan(260);
    // each says how it begins and how it ends; the hunt says what happens when it catches you
    for (const k of ['mob', 'field', 'chase'] as const) expect(SCENARIO_TEXT[k].start.length).toBeGreaterThan(20);
    expect(SCENARIO_TEXT.chase.caught).toMatch(/вдома/);
  });

  it('knows the places', () => {
    expect(kindOf('fields')).toBe('field');
    expect(kindOf('rift_autumn')).toBe('rift');
    expect(kindOf('village')).toBe('town');
    expect(kindOf('library_in')).toBe('inside');
  });

  it('every event has a way out: a dialog always offers to walk away', () => {
    for (let slot = 0; slot < 300; slot++) {
      for (const place of ['home', 'village', 'forest', 'cave', 'rift_winter']) {
        const e = pickEvent('rift', place, 11, slot, true) ?? pickEvent('halloween', place, 11, slot, true);
        if (e?.choices) expect(e.choices.some((c) => c.leave)).toBe(true);
      }
    }
  });
});
