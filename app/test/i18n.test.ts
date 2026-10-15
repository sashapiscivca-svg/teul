import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { allWords, lang, plural, pluralIndex, setLang, t } from '../src/i18n';
import { TABLES } from '../src/lang';
import { loadEngine } from '../src/engine';

const CYR = /[А-Яа-яЄєІіЇїҐґ]/;
const holes = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(',');

afterEach(() => setLang('uk'));

describe('the word tables', () => {
  it('give every key its Ukrainian and its English words', () => {
    const bad: string[] = [];
    for (const [key, [uk, en]] of Object.entries(allWords())) {
      if (!uk || !en) bad.push(`${key}: missing words`);
      else if (CYR.test(en)) bad.push(`${key}: Ukrainian in the English «${en}»`);
      else if (holes(uk) !== holes(en)) bad.push(`${key}: holes ${holes(uk)} vs ${holes(en)}`);
      else if (uk.includes('|') !== en.includes('|')) bad.push(`${key}: plural forms only on one side`);
      else if (uk.includes('|') && (uk.split('|').length !== 3 || en.split('|').length !== 2)) bad.push(`${key}: plural forms are one|few|many and one|other`);
    }
    expect(bad).toEqual([]);
  });

  it('never give one key twice', () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const [name, table] of Object.entries(TABLES)) {
      for (const key of Object.keys(table)) {
        if (seen.has(key)) twice.push(`${key} in ${seen.get(key)} and ${name}`);
        seen.set(key, name);
      }
    }
    expect(twice).toEqual([]);
  });
});

describe('t()', () => {
  it('speaks Ukrainian unless told otherwise (no device in the tests)', () => {
    expect(lang()).toBe('uk');
    expect(t('season.Winter')).toBe('Зима');
  });

  it('speaks English when English is chosen', () => {
    setLang('en');
    expect(t('season.Winter')).toBe('Winter');
  });

  it('falls back to a readable id for unknown keys', () => {
    expect(t('item.brand_new_thing')).toBe('Brand new thing');
  });

  it('picks plural forms by the language', () => {
    expect([1, 2, 5, 11, 21, 22, 25, 112].map((n) => pluralIndex(n, 'uk'))).toEqual([0, 1, 2, 2, 0, 1, 2, 2]);
    expect([0, 1, 2, 21].map((n) => pluralIndex(n, 'en'))).toEqual([1, 0, 1, 1]);
    expect(plural(3, 'день|дні|днів')).toBe('дні');
    setLang('en');
    expect(plural(3, 'day|days')).toBe('days');
  });
});

describe('the pack in English', () => {
  const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8')) as unknown;
  const overlay = JSON.parse(readFileSync(new URL('../../content/base/en.json', import.meta.url), 'utf8')) as { lang: string; pack: string; text: unknown };

  /** The same rule the core lays an overlay with (`content.rs::overlay_text`). */
  function lay(target: unknown, text: unknown): unknown {
    if (typeof target === 'string') return typeof text === 'string' ? text : target;
    if (Array.isArray(target) && text && typeof text === 'object') {
      return target.map((el, i) => {
        const id = el && typeof el === 'object' && typeof (el as { id?: unknown }).id === 'string' ? (el as { id: string }).id : String(i);
        const t = (text as Record<string, unknown>)[id];
        return t === undefined ? el : lay(el, t);
      });
    }
    if (target && typeof target === 'object' && text && typeof text === 'object' && !Array.isArray(text)) {
      const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
      for (const [k, v] of Object.entries(text)) if (k in out) out[k] = lay(out[k], v);
      return out;
    }
    return target;
  }

  function ukrainian(x: unknown, path: string, out: string[]): void {
    if (typeof x === 'string') {
      if (CYR.test(x)) out.push(`${path}: ${x.slice(0, 60)}`);
    } else if (Array.isArray(x)) x.forEach((v, i) => ukrainian(v, `${path}/${i}`, out));
    else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) ukrainian(v, `${path}/${k}`, out);
  }

  it('is an overlay of the base pack in English', () => {
    expect(overlay.lang).toBe('en');
    expect(overlay.pack).toBe((pack as { id: string }).id);
  });

  it('leaves no Ukrainian word in the pack', () => {
    const left: string[] = [];
    ukrainian(lay(pack, overlay.text), '', left);
    expect(left.slice(0, 20)).toEqual([]);
  });

  it('changes only words: the same shape, numbers and ids', () => {
    const shape = (x: unknown): unknown => (typeof x === 'string' ? (CYR.test(x) ? '' : x) : Array.isArray(x) ? x.map(shape) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : x);
    const english = shape(lay(pack, overlay.text));
    const strip = (x: unknown): unknown => (typeof x === 'string' ? '' : Array.isArray(x) ? x.map(strip) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, strip(v)])) : x);
    expect(strip(english)).toEqual(strip(pack));
  });

  it('is laid over the world by the core: English names, the same outcomes', async () => {
    const text = readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8');
    const wasm = readFileSync(new URL('../src/wasm/teul_wasm_bg.wasm', import.meta.url));
    const en = readFileSync(new URL('../../content/base/en.json', import.meta.url), 'utf8');
    const opts = { packs: [text], device: 1, seed: 7, epochUnixSecs: 1_700_000_000, events: [], wasm };
    const uk = await loadEngine(opts);
    const english = await loadEngine({ ...opts, text: en });
    expect(uk.catalog.items.futon.name).toBe('Футон');
    expect(english.catalog.items.futon.name).not.toMatch(CYR);
    const a = uk.command({ type: 'acquire', item: 'fern' }, 10);
    const b = english.command({ type: 'acquire', item: 'fern' }, 10);
    expect(b.ok).toBe(a.ok);
    expect(JSON.stringify(english.drain())).toBe(JSON.stringify(uk.drain()));
  });
});
