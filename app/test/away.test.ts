import { describe, expect, it } from 'vitest';
import { awayNote, type AwayInput } from '../src/away';

const base: AwayInput = { days: 3, sky: 'rain', season: 'Autumn', holidays: [], news: [], waiting: [], letters: 0, bills: [], switchedOff: [] };

describe('while you were away, in the paper', () => {
  it('says how long it was, in good Ukrainian', () => {
    expect(awayNote({ ...base, days: 1 })[0]).toMatch(/^Тебе не було день/);
    expect(awayNote({ ...base, days: 3 })[0]).toMatch(/три дні/);
    expect(awayNote({ ...base, days: 5 })[0]).toMatch(/п’ять днів/);
    expect(awayNote({ ...base, days: 21 })[0]).toMatch(/21 день/);
  });

  it('is a short note: the feasts, who waits, the mail, the bills — three lines at most', () => {
    const note = awayNote({ ...base, holidays: ['День Липового', 'Ярмарок урожаю', 'Гелловін'], waiting: ['Марта', 'Остап', 'Ія'], letters: 2, bills: [{ name: 'Вода', amount: 18, overdue: true }] });
    expect(note.length).toBeLessThanOrEqual(3);
    expect(note.join(' ')).toMatch(/День Липового й Ярмарок урожаю/);
    expect(note.join(' ')).not.toMatch(/Гелловін/);
    expect(note.join(' ')).toMatch(/Марта й Остап/);
    expect(note.join(' ')).toMatch(/два листи/);
    expect(note.join(' ')).toMatch(/контор/);
    expect(note.join(' ').length).toBeLessThan(220);
  });

  it('says plainly when something was switched off', () => {
    expect(awayNote({ ...base, switchedOff: ['воду', 'газ'] }).join(' ')).toMatch(/вимкнули воду й газ/);
  });

  it('is one line when nothing much happened', () => {
    expect(awayNote(base)).toHaveLength(1);
  });
});
