import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));

describe('names', () => {
  it('every item of the base pack has a Ukrainian name', () => {
    const missing = pack.items.filter((i: { name: string }) => /^[a-z]/.test(t(i.name)) || t(i.name) === i.name && i.name.startsWith('item.')).map((i: { id: string }) => i.id);
    expect(missing).toEqual([]);
  });
});
