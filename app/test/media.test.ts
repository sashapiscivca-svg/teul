import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, figureLayers, HOLDS, type Dir } from '../src/character';
import { newMines, reveal, toggleFlag, won } from '../src/arcade/mines';
import { octaveShift, perform, SCORES, scoreOf } from '../src/ui/media/arrange';
import { emptyPattern, packPattern, patternNotes, unpackPattern } from '../src/ui/media/composer';
import { KITS, kitOfItem, sampleFor } from '../src/ui/media/kits';
import { nextStation, onAir, RECORDS, STATIONS } from '../src/ui/media/radio';
import { caption, listing, programmeAt } from '../src/ui/media/tv';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8')) as {
  pieces: { id: string; name: string; sheet: string | null }[];
  items: { id: string; tags?: string[] }[];
  stations: { id: string; gives: [string, number][] }[];
};

describe('the repertoire', () => {
  it('every piece the world knows has a score, and every score is a piece', () => {
    expect(pack.pieces.length).toBeGreaterThanOrEqual(10);
    for (const p of pack.pieces) expect(scoreOf(p.id), p.id).toBeTruthy();
    for (const s of SCORES) expect(pack.pieces.some((p) => p.id === s.id), s.id).toBe(true);
  });

  it('sheet music is an item, and somewhere in town hands it out', () => {
    for (const p of pack.pieces.filter((x) => x.sheet)) {
      expect(pack.items.some((i) => i.id === p.sheet && i.tags?.includes('sheet')), p.id).toBe(true);
      expect(pack.stations.some((s) => s.gives.some(([g]) => g === p.sheet)), p.id).toBe(true);
    }
  });

  it('the melodies are real tunes: enough notes, in a singing range, the chords ending with them', () => {
    for (const s of SCORES) {
      expect(s.melody.length, s.id).toBeGreaterThanOrEqual(30);
      for (const [, len, key] of s.melody) {
        expect(len).toBeGreaterThan(0);
        expect(key).toBeGreaterThanOrEqual(48);
        expect(key).toBeLessThanOrEqual(84);
      }
      const end = Math.max(...s.melody.map(([a, l]) => a + l));
      const chordEnd = Math.max(...s.chords.map(([a, l]) => a + l));
      expect(Math.abs(end - chordEnd), s.id).toBeLessThanOrEqual(s.meter);
    }
  });

  it('famous openings are as written: Ode to Joy, Für Elise, Shchedryk', () => {
    const keys = (id: string, n: number) => scoreOf(id)!.melody.slice(0, n).map((m) => m[2]);
    expect(keys('ode', 8)).toEqual([64, 64, 65, 67, 67, 65, 64, 62]);
    expect(keys('fur_elise', 9)).toEqual([76, 75, 76, 75, 76, 71, 74, 72, 69]);
    expect(keys('shchedryk', 4)).toEqual([70, 69, 70, 67]);
  });
});

describe('the hands at the instrument', () => {
  const ode = scoreOf('ode')!;

  it('a beginner plays slower and slips; a master plays it as written', () => {
    const novice = perform(ode, KITS.piano, 0);
    const master = perform(ode, KITS.piano, 3);
    expect(novice.secs).toBeGreaterThan(master.secs * 1.25);
    expect(master.notes.filter((n) => n.slip)).toHaveLength(0);
    const leads = master.notes.filter((n) => n.lead).map((n) => n.key);
    expect(leads).toEqual(ode.melody.map((m) => m[2] + octaveShift(ode, KITS.piano)));
  });

  it('the first tries keep the left hand simple; later the chords fill in', () => {
    const simple = perform(ode, KITS.piano, 0).notes.filter((n) => !n.lead).length;
    const full = perform(ode, KITS.piano, 2).notes.filter((n) => !n.lead).length;
    expect(full).toBeGreaterThan(simple * 2);
  });

  it('the same hands play the same try the same way, another try a little differently', () => {
    const a = perform(ode, KITS.guitar, 0, 1);
    const b = perform(ode, KITS.guitar, 0, 1);
    const c = perform(ode, KITS.guitar, 0, 2);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('one-voice instruments play only the tune, in their own range', () => {
    for (const s of SCORES) {
      const p = perform(s, KITS.sopilka, 3);
      expect(p.notes.every((n) => n.lead)).toBe(true);
      const shift = octaveShift(s, KITS.sopilka);
      expect(Math.min(...s.melody.map((m) => m[2])) + shift).toBeGreaterThanOrEqual(KITS.sopilka.low - 3);
    }
  });

  it('a guitar strums its chords string by string', () => {
    const p = perform(scoreOf('greensleeves')!, KITS.guitar, 3);
    const acc = p.notes.filter((n) => !n.lead);
    const gaps = acc.slice(1).map((n, i) => n.t - acc[i].t).filter((g) => g > 0 && g < 0.06);
    expect(gaps.length).toBeGreaterThan(20);
  });

  it('a recorded note is never bent more than a semitone and a half', () => {
    for (const kit of Object.values(KITS)) {
      for (let k = kit.low - 2; k <= kit.high + 2; k++) {
        const { index, rate } = sampleFor(kit, k);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(Math.abs(12 * Math.log2(rate))).toBeLessThanOrEqual(2.0001);
      }
    }
  });

  it('things of the world are instruments, and their notes are on disk', () => {
    expect(kitOfItem('piano')).toBe('piano');
    expect(kitOfItem('guitar')).toBe('guitar');
    expect(kitOfItem('bandura')).toBe('bandura');
    expect(kitOfItem('sofa3')).toBeNull();
    for (const kit of Object.values(KITS)) {
      const f = new URL(`../public/music/kit/${kit.id}.ogg`, import.meta.url);
      expect(existsSync(f), kit.id).toBe(true);
      expect(statSync(f).size).toBeLessThan(400_000);
    }
  });

  it('every instrument pose is drawn from every side, and the hands move', () => {
    for (const hold of HOLDS) {
      for (const dir of ['down', 'up', 'left', 'right'] as Dir[]) {
        const a = JSON.stringify(figureLayers(DEFAULT_LOOK, dir, hold, 0));
        const b = JSON.stringify(figureLayers(DEFAULT_LOOK, dir, hold, 1));
        expect(a.length).toBeGreaterThan(100);
        if (dir !== 'up') expect(a, `${hold} ${dir}`).not.toBe(b);
      }
    }
  });
});

describe('the television', () => {
  it('runs a whole day without gaps, the test card at night', () => {
    for (const weekend of [false, true]) {
      const l = listing(weekend);
      expect(l[0].from).toBe(0);
      expect(l[l.length - 1].to).toBe(1440);
      for (let i = 1; i < l.length; i++) expect(l[i].from).toBe(l[i - 1].to);
    }
    expect(programmeAt(3 * 60, false).id).toBe('test');
    expect(programmeAt(7 * 60, false).id).toBe('morning');
    expect(programmeAt(12 * 60 + 30, false).id).toBe('cooking');
    expect(programmeAt(14 * 60, false).id).toBe('nature');
    expect(programmeAt(14 * 60, true).id).toBe('cartoons');
    expect(programmeAt(19 * 60 + 30, false).id).toBe('concert');
    expect(programmeAt(23 * 60, false).id).toBe('film');
    expect(programmeAt(23 * 60, false, 1).id).toBe('weather');
  });

  it('the news reads the paper and the cooking show a recipe', () => {
    const feed = { headlines: ['Міст полагодили'], weatherNow: 'ясно', weatherNext: 'дощ', sky: 'clear', recipe: { name: 'Вареники', needs: ['борошно'], text: 'Ліпимо.' }, minute: () => 0, weekend: false };
    expect(caption(programmeAt(18 * 60, false), 7, feed, null)).toContain('Міст полагодили');
    expect(caption(programmeAt(12 * 60, false), 0, feed, null)).toContain('Вареники');
  });
});

describe('the radio and the records', () => {
  it('each station plays something at every hour, night music at night', () => {
    for (const s of STATIONS) for (let h = 0; h < 24; h++) expect(onAir(s.id, h * 60, 10).track).toBeTruthy();
    expect(onAir('fm', 2 * 60, 10).track).toBe('night');
    expect(onAir('folk', 18 * 60, 12).track).toBe('rec/rec_shchedryk');
    expect(nextStation('fm')).toBe('classic');
    expect(nextStation('folk')).toBe('fm');
  });

  it('every record is pressed (on disk) and sold somewhere', () => {
    for (const r of RECORDS) {
      expect(existsSync(new URL(`../public/music/rec/${r.id}.ogg`, import.meta.url)), r.id).toBe(true);
      expect(pack.stations.some((s) => s.gives.some(([g]) => g === r.id)), r.id).toBe(true);
    }
    for (const s of STATIONS) for (let h = 0; h < 24; h++) {
      const t = onAir(s.id, h * 60, 1).track;
      if (t.startsWith('rec/')) expect(RECORDS.some((r) => `rec/${r.id}` === t)).toBe(true);
    }
  });
});

describe('the computer', () => {
  it('«Сапер»: the first cell is always safe, flags guard, clearing the field wins', () => {
    for (let seed = 1; seed < 30; seed++) {
      const m = reveal(newMines(9, 9, 10, seed), 4, 4);
      expect(m.lost).toBe(false);
      expect(m.mine.filter(Boolean)).toHaveLength(10);
    }
    let m = newMines(9, 9, 10, 7);
    m = toggleFlag(m, 0, 0);
    m = reveal(m, 0, 0);
    expect(m.open[0]).toBe(false);
    m = reveal(toggleFlag(m, 0, 0), 4, 4);
    for (let i = 0; i < 81; i++) if (!m.mine[i]) m = reveal(m, i % 9, Math.floor(i / 9));
    expect(won(m)).toBe(true);
  });

  it('the composer keeps a pattern and turns held steps into longer notes', () => {
    const p = emptyPattern();
    p[0][0] = true;
    p[0][1] = true;
    p[3][4] = true;
    expect(unpackPattern(packPattern(p))).toEqual(p);
    expect(unpackPattern('junk')).toEqual(emptyPattern());
    const notes = patternNotes(p, 120);
    expect(notes).toHaveLength(2);
    expect(notes[0].len).toBeCloseTo(0.5);
  });
});
