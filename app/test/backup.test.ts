// Backups: a world exported under a passphrase and opened on «another device» (another store, another data
// key) is the same world; a wrong passphrase or another file is refused with words the player understands.

import { readFileSync } from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { BackupError, collect, exportBundle, importBundle, keepDaily, loadDaily, problemText, restore, stateDigest, travels } from '../src/backup';
import { loadEngine } from '../src/engine';
import { newDataKey } from '../src/secure/seal';
import { openStore, type Store } from '../src/storage';

const pack = readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8');
const wasm = readFileSync(new URL('../src/wasm/teul_wasm_bg.wasm', import.meta.url));
const golden = JSON.parse(readFileSync(new URL('../../crates/teul-core/tests/fixtures/saves/played.json', import.meta.url), 'utf8'));

async function engineOf(store: Store) {
  const meta = (await store.loadMeta())!;
  return loadEngine({ packs: [pack], device: meta.device, seed: meta.seed, epochUnixSecs: meta.epochUnixSecs, secret: meta.secret, events: await store.loadEvents(), wasm });
}

/** A device: its own IndexedDB, its own data key, its own web storage entries. */
async function device(name: string) {
  const key = await newDataKey();
  const store = await openStore(name, new IDBFactory(), IDBKeyRange, key);
  const web = new Map<string, string>();
  const local = { getItem: (k: string) => web.get(k) ?? null, setItem: (k: string, v: string) => void web.set(k, v), removeItem: (k: string) => void web.delete(k), entries: (m: (k: string) => boolean) => [...web].filter(([k]) => m(k)) };
  return { store, web, local };
}

describe('a backup file', () => {
  it('carries a world to another device whole (the same state digest)', async () => {
    const a = await device('a');
    await restore(a.store, golden, a.local);
    a.web.set('wdeadbeef.teul.notes', '{"x":"11","n":"22"}');
    a.web.set('teul.pc.diary', 'Сьогодні бачила Марту');
    a.web.set('wcafebabe.teul.notes', '{"x":"other world"}');
    const before = await stateDigest(await engineOf(a.store));
    const file = await exportBundle(await collect(a.store, a.local, 'wdeadbeef.'), 'липи цвітуть у червні');
    const text = new TextDecoder().decode(file);
    for (const plain of ['Тарас', 'Марта', '"x":"11"', golden.world.meta.idSeed]) expect(text).not.toContain(plain);

    const b = await device('b');
    const opened = await importBundle(file, 'липи цвітуть у червні');
    await restore(b.store, opened, b.local);
    expect(await stateDigest(await engineOf(b.store))).toBe(before);
    expect(await b.store.loadMeta()).toEqual(await a.store.loadMeta());
    expect(b.web.get('teul.pc.diary')).toContain('Марту');
    expect(b.web.get('wdeadbeef.teul.notes')).toBe('{"x":"11","n":"22"}');
    // another world's entries stay on the first device
    expect(b.web.has('wcafebabe.teul.notes')).toBe(false);
  }, 30_000);

  it('a wrong passphrase is refused kindly, and so is a file that is not a backup', async () => {
    const a = await device('c');
    await restore(a.store, golden, a.local);
    const file = await exportBundle(await collect(a.store, a.local, 'w'), 'правильна фраза');
    const wrong = await importBundle(file, 'неправильна фраза').catch((e) => e);
    expect(wrong).toBeInstanceOf(BackupError);
    expect((wrong as BackupError).problem).toBe('passphrase');
    expect(problemText('passphrase')).toMatch(/Ключ-фраза не підходить/);
    const other = await importBundle(new TextEncoder().encode('{"hello":1}'), 'x').catch((e) => e);
    expect((other as BackupError).problem).toBe('not-backup');
    expect(problemText('not-backup')).toMatch(/не резервна копія/);
    // a header changed in the file (the version, the rounds) does not open either
    const head = JSON.parse(new TextDecoder().decode(file));
    const edited = new TextEncoder().encode(JSON.stringify({ ...head, app: '9.9.9' }));
    expect(((await importBundle(edited, 'правильна фраза').catch((e) => e)) as BackupError).problem).toBe('passphrase');
  }, 30_000);

  it('refuses a short passphrase', async () => {
    const a = await device('d');
    await restore(a.store, golden, a.local);
    await expect(exportBundle(await collect(a.store, a.local, 'w'), 'коротка')).rejects.toThrow();
  });

  it('never carries the sealed copies, the registry of worlds or the data key', () => {
    expect(travels('teul.sealed:teul.pc.diary', 'wdeadbeef.')).toBe(false);
    expect(travels('teul.worlds', 'wdeadbeef.')).toBe(false);
    expect(travels('teul.prefs', 'wdeadbeef.')).toBe(true);
    expect(travels('wdeadbeef.teul.notes', 'wdeadbeef.')).toBe(true);
    expect(travels('wcafebabe.teul.notes', 'wdeadbeef.')).toBe(false);
    // what the network world of 1.0 kept does not travel any more
    expect(travels('wdeadbeef.teul.net.keys', 'wdeadbeef.')).toBe(false);
    expect(travels('teul.friends', 'wdeadbeef.')).toBe(false);
  });

  it('a backup made by 1.0 restores its world, but not its network keys, contacts and friends', async () => {
    const a = await device('f');
    const old = { ...golden, local: [['wdeadbeef.teul.net.keys', '{"x":"11"}'], ['wdeadbeef.teul.net.contacts', '[{"nick":"Марта"}]'], ['teul.friends', '[]'], ['teul.games.post', '[]'], ['teul.prefs', '{"master":0.6}']] };
    await restore(a.store, old, a.local);
    expect([...a.web.keys()]).toEqual(['teul.prefs']);
  });
});

describe('the daily copies', () => {
  it('one a day, the three latest kept, sealed, and a copy brings the world back', async () => {
    const a = await device('e');
    await restore(a.store, golden, a.local);
    const before = await stateDigest(await engineOf(a.store));
    for (const d of [1, 2, 3, 4]) expect(await keepDaily(a.store, a.local, 'w', new Date(2026, 9, d, 12))).toBe(true);
    expect(await keepDaily(a.store, a.local, 'w', new Date(2026, 9, 4, 18))).toBe(false);
    expect(await a.store.listDaily()).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    const copy = await loadDaily(a.store, '2026-10-03');
    const b = await device('f');
    await restore(b.store, copy!, b.local);
    expect(await stateDigest(await engineOf(b.store))).toBe(before);
  }, 30_000);
});
