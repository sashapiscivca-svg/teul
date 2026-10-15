// "While you were away", as the paper tells it: the issues missed lie by the door, and a short note over them —
// how long it was, the feasts that passed, who waits, the mail and the bills. A line or two, not a report.
import { t } from './i18n';

export interface AwayInput {
  days: number;
  /** Today's weather (clear, cloudy, rain, storm, snow, fog). */
  sky: string;
  season: string;
  /** Feasts that passed meanwhile, by name. */
  holidays: string[];
  /** What happened in town, oldest first. */
  news: { kind: string; text: string }[];
  /** Names of people who asked for the player. */
  waiting: string[];
  /** Unopened letters. */
  letters: number;
  /** Bills not yet paid. */
  bills: { name: string; amount: number; overdue: boolean }[];
  /** Utilities switched off for not paying, in the accusative (воду, газ…). */
  switchedOff: string[];
}


/** 1 день, 2 дні, 5 днів … in words up to ten. */
function plural(n: number, forms: string): string {
  const form = t(forms, { n });
  const num = n <= 10 && n !== 1 ? t('away.num').split(',')[n] : String(n);
  return `${num} ${form}`;
}

function and(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')}${t('away.and')}${list[list.length - 1]}`;
}

/** The paper's short note over the missed issues: at most three short lines. */
export function awayNote(a: AwayInput): string[] {
  const out: string[] = [];
  const time = a.days === 1 ? t('away.goneDay') : t('away.gone', { days: plural(a.days, 'away.day') });
  out.push(a.holidays.length > 0 ? t('away.holidays', { time, what: and(a.holidays.slice(0, 2)) }) : t('away.news', { time }));
  const home: string[] = [];
  if (a.waiting.length > 0) home.push(a.waiting.length > 1 ? t('away.askedMany', { who: and(a.waiting.slice(0, 2)) }) : t('away.asked', { who: a.waiting[0] }));
  if (a.letters > 0) home.push(a.letters === 1 ? t('away.oneLetter') : t('away.letters', { letters: plural(a.letters, 'away.letter') }));
  if (home.length) out.push(home.join(' '));
  if (a.switchedOff.length > 0) out.push(t('away.switchedOff', { what: and(a.switchedOff) }));
  else if (a.bills.some((b) => b.overdue)) out.push(t('away.overdue'));
  return out;
}

