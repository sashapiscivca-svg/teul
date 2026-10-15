// The notebook of promises, in words: what one promised whom and where, by when — the way people say it.
// No counters, no progress bars, no prizes: a note, not a checklist.

import type { QuestView } from './types';
import { t } from './i18n';


/** A world day as a date of the year ("31 жовтня"), from the world's epoch (its first local midnight). */
export function dateWords(day: number, epochUnixSecs: number): string {
  // noon of that day: the right date whatever the time zone
  const d = new Date((epochUnixSecs + day * 86_400 + 43_200) * 1000);
  return t('notebook.date', { d: d.getUTCDate(), m: t('notebook.months').split(',')[d.getUTCMonth()] });
}

/** By when, as one would say it. */
export function deadlineWords(deadline: number | null, today: number, epochUnixSecs: number): string {
  if (deadline === null) return '';
  if (deadline <= today) return t('notebook.tonight');
  if (deadline === today + 1) return t('notebook.tomorrow');
  return t('notebook.by', { date: dateWords(deadline, epochUnixSecs) });
}

/** Where, in words ("вдома", or the place's name). */
export function whereWords(location: string, names: Record<string, string>): string {
  if (!location) return '';
  if (location === 'home') return t('notebook.home');
  return names[location] ?? location;
}

export function daysWords(n: number): string {
  return t('notebook.days', { n });
}

/** The one line under the clock for the promise one follows. */
export function hudLine(q: QuestView, names: Record<string, string>): string {
  if (q.act.do === 'wait') return `→ ${q.text}${q.wait_left > 0 ? t('notebook.waitLeft', { days: daysWords(q.wait_left) }) : ''}`;
  const where = whereWords(q.location, names);
  return where ? `→ ${where}: ${q.text}` : `→ ${q.text}`;
}
