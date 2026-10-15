import { describe, expect, it } from 'vitest';
import { dateWords, deadlineWords, hudLine, whereWords } from '../src/notebook';
import type { QuestView } from '../src/types';

// 2026-10-10, local midnight in Kyiv (world day 0 is a Saturday in October)
const EPOCH = 20_736 * 86_400 - 3 * 3_600;

const q = (o: Partial<QuestView>): QuestView => ({
  key: 'job:3:job.parcels:0', id: 'job.parcels', title: 'Посилки від пошти', kind: 'job', giver: 'res_93', giver_name: 'Ліна Петренко',
  stage: 0, stages: 2, text: 'Віднести посилку: Ганна Коваль', done: '', act: { do: 'bring', location: 'village', items: [['parcel', 1]] },
  who: null, location: 'village', here: false, ready: false, reason: 'not_here', wait_left: 0, deadline: 3, ...o,
});

describe('the notebook', () => {
  it('says a world day as a date', () => {
    expect(dateWords(0, EPOCH)).toBe('10 жовтня');
    expect(dateWords(21, EPOCH)).toBe('31 жовтня');
    expect(dateWords(22, EPOCH)).toBe('1 листопада');
  });

  it('says a deadline the way people do', () => {
    expect(deadlineWords(3, 3, EPOCH)).toBe('до вечора');
    expect(deadlineWords(4, 3, EPOCH)).toBe('до завтра');
    expect(deadlineWords(21, 3, EPOCH)).toBe('до 31 жовтня');
    expect(deadlineWords(null, 3, EPOCH)).toBe('');
  });

  it('says where in words', () => {
    const names = { village: 'Село Липове', post_in: 'Пошта «Липове»' };
    expect(whereWords('home', names)).toBe('вдома');
    expect(whereWords('post_in', names)).toBe('Пошта «Липове»');
    expect(whereWords('', names)).toBe('');
  });

  it('keeps one line on the screen for the promise one follows', () => {
    const names = { village: 'Село Липове' };
    expect(hudLine(q({}), names)).toBe('→ Село Липове: Віднести посилку: Ганна Коваль');
    expect(hudLine(q({ act: { do: 'wait', days: 2 }, location: '', wait_left: 2, text: 'Почекати' }), names)).toBe('→ Почекати (ще 2 дні)');
    // no counters, no progress: it is a note, not a checklist
    expect(hudLine(q({}), names)).not.toMatch(/\d\/\d/);
  });
});
