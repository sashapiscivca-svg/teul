// The words the player reads, in Ukrainian (the world's own) or English. Every string lives in a keyed table
// (`lang/*.ts`) with both languages side by side; `t(key, params)` picks the player's language.
// Content ids map to names through the keys the packs use (`item.<id>` and so on); anything unknown falls back to
// a readable form of its id, so a new content pack never shows a raw key.
// The world's own words (names, stations, stories) come translated from the core through the pack's text overlay
// (`content/base/en.json`); the language never changes an outcome.
import { TABLES } from './lang';
import type { Entry } from './lang/types';

export type Lang = 'uk' | 'en';
export const LANGS: readonly Lang[] = ['uk', 'en'];
const LANG_KEY = 'teul.lang';

const WORDS: Record<string, Entry> = {};
for (const table of Object.values(TABLES)) Object.assign(WORDS, table);

/** The language chosen in the settings; on first run the device's (Ukrainian unless it speaks no Ukrainian). */
function detect(): Lang {
  try {
    if (import.meta.env.MODE !== 'production' && typeof location !== 'undefined') {
      const flag = new URLSearchParams(location.search).get('lang');
      if (flag === 'uk' || flag === 'en') return flag;
    }
  } catch {
    /* no address bar */
  }
  // no page (the tests): the world's own language
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return 'uk';
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    /* storage refused */
  }
  const spoken = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean).map((l) => l.toLowerCase());
  if (spoken.length === 0 || spoken.some((l) => l.startsWith('uk'))) return 'uk';
  return 'en';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function lang(): Lang {
  return current;
}

export function isEnglish(): boolean {
  return current === 'en';
}

/** Chooses the language and remembers it (the shell reloads, so everything is drawn again in it). */
export function chooseLang(next: Lang): void {
  try {
    globalThis.localStorage?.setItem(LANG_KEY, next);
  } catch {
    /* storage refused: for this session only */
  }
  setLang(next);
}

/** Switches the language for this session (tests, and `chooseLang`). */
export function setLang(next: Lang): void {
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

/** Which plural form `n` takes: Ukrainian one|few|many, English one|other. */
export function pluralIndex(n: number, l: Lang = current): number {
  const a = Math.abs(Math.trunc(n));
  if (l === 'en') return a === 1 ? 0 : 1;
  if (a % 10 === 1 && a % 100 !== 11) return 0;
  if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return 1;
  return 2;
}

function readable(key: string): string {
  const last = key.split('.').pop() ?? key;
  const text = last.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function has(key: string): boolean {
  return key in WORDS;
}

/** The words for `key` in the player's language, with `{name}` holes filled from `params`; `{n}` also picks
 *  the plural form when the words have `|`-separated forms. */
export function t(key: string, params?: Readonly<Record<string, string | number>>): string {
  const entry = WORDS[key];
  if (!entry) return readable(key);
  let text = (current === 'en' ? entry[1] : entry[0]) || entry[0];
  if (params && typeof params.n === 'number' && text.includes('|')) {
    const forms = text.split('|');
    text = forms[Math.min(pluralIndex(params.n), forms.length - 1)];
  }
  if (params) text = text.replace(/\{(\w+)\}/g, (hole, name: string) => (name in params ? String(params[name]) : hole));
  return text;
}

/** Plural forms given inline as `one|few|many` (Ukrainian) or `one|other` (English), already in the player's language. */
export function plural(n: number, forms: string): string {
  const list = forms.split('|');
  return list[Math.min(pluralIndex(n), list.length - 1)];
}

export function itemName(id: string): string {
  return t(`item.${id}`);
}

export function seasonName(season: string): string {
  return has(`season.${season}`) ? t(`season.${season}`) : season;
}

/** Every key with its words, for the tests. */
export function allWords(): Readonly<Record<string, Entry>> {
  return WORDS;
}
