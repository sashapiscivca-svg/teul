// Encryption at rest: sealed records round-trip, any change is caught, a plain save from an older version is
// sealed on the first launch without losing anything, and the private web-storage entries are sealed too.

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { isSealed, newDataKey, open, openBytes, passKey, seal, sealBytes } from '../src/secure/seal';
import { SEALED, Vault, isPrivate, isRetired } from '../src/secure/vault';
import { openStore, type StoredSnapshot, type WorldMeta } from '../src/storage';
import type { EventRecord } from '../src/types';

const ev = (time: number, seq: number, name = `кіт ${seq}`): EventRecord => ({ id: { device: 7, seq }, time, rules_version: 2, kind: { type: 'PlayerNamed', name } });
const META: WorldMeta = { device: 7, seed: 42, epochUnixSecs: 1_700_000_000, secret: 123456789, idSeed: 'ab'.repeat(32) };

/** Every value kept in a fake IndexedDB database, as raw JSON text. */
async function rawDump(factory: IDBFactory, name: string): Promise<string> {
  const db: IDBDatabase = await new Promise((res, rej) => {
    const r = factory.open(name);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const out: unknown[] = [];
  for (const s of Array.from(db.objectStoreNames)) {
    const all = await new Promise<unknown[]>((res) => {
      const q = db.transaction(s, 'readonly').objectStore(s).getAll();
      q.onsuccess = () => res(q.result);
    });
    out.push(s, all);
  }
  db.close();
  return JSON.stringify(out);
}

async function rawEdit(factory: IDBFactory, name: string, store: string, edit: (rows: [IDBValidKey, unknown][]) => [IDBValidKey, unknown][]): Promise<void> {
  const db: IDBDatabase = await new Promise((res) => {
    const r = factory.open(name);
    r.onsuccess = () => res(r.result);
  });
  const keys = await new Promise<IDBValidKey[]>((res) => {
    const q = db.transaction(store, 'readonly').objectStore(store).getAllKeys();
    q.onsuccess = () => res(q.result);
  });
  const vals = await new Promise<unknown[]>((res) => {
    const q = db.transaction(store, 'readonly').objectStore(store).getAll();
    q.onsuccess = () => res(q.result);
  });
  const rows = edit(keys.map((k, i) => [k, vals[i]]));
  await new Promise<void>((res) => {
    const tx = db.transaction(store, 'readwrite');
    for (const [k, v] of rows) tx.objectStore(store).put(v, k);
    tx.oncomplete = () => res();
  });
  db.close();
}

describe('sealing (AES-256-GCM)', () => {
  it('round-trips text and bytes', async () => {
    const key = await newDataKey();
    const s = await seal(key, 'Липове 🌳', 'meta');
    expect(isSealed(s)).toBe(true);
    expect(s).not.toContain('Липове');
    expect(await open(key, s, 'meta')).toBe('Липове 🌳');
    const b = await sealBytes(key, new Uint8Array([1, 2, 3]), 'x');
    expect([...(await openBytes(key, b, 'x'))]).toEqual([1, 2, 3]);
  });

  it('two seals of the same text differ (a fresh nonce each time)', async () => {
    const key = await newDataKey();
    expect(await seal(key, 'a', 'k')).not.toBe(await seal(key, 'a', 'k'));
  });

  it('catches a changed byte, another place, another key', async () => {
    const key = await newDataKey();
    const s = await seal(key, 'секрет', 'event:1');
    const body = s.slice(3);
    const flipped = s.slice(0, 3) + (body[10] === 'A' ? 'B' : 'A') + body.slice(1).slice(0, 9) + body.slice(11);
    await expect(open(key, flipped, 'event:1')).rejects.toThrow();
    await expect(open(key, s, 'event:2')).rejects.toThrow();
    await expect(open(await newDataKey(), s, 'event:1')).rejects.toThrow();
  });

  it('a passphrase key opens only with the same passphrase and salt', async () => {
    const salt = new Uint8Array(16).fill(3);
    const k1 = await passKey('довга ключ-фраза', salt, 1000);
    const s = await seal(k1, 'світ', 'b');
    expect(await open(await passKey('довга ключ-фраза', salt, 1000), s, 'b')).toBe('світ');
    await expect(open(await passKey('інша ключ-фраза', salt, 1000), s, 'b')).rejects.toThrow();
  });
});

describe('a sealed store', () => {
  it('keeps no plain text at rest and reads everything back', async () => {
    const factory = new IDBFactory();
    const key = await newDataKey();
    const s = await openStore('sealed1', factory, IDBKeyRange, key);
    expect(s.sealed).toBe(true);
    await s.saveMeta(META);
    await s.appendEvents([ev(10, 0), ev(10, 1), ev(20, 2)]);
    const snap: StoredSnapshot = { json: '{"through":[10,7,1],"state":"Оксана"}', through: [10, 7, 1], covered: 2 };
    await s.saveSnapshot(snap);
    await s.saveUserItems([{ id: 'u_lamp', name: 'Моя лампа' } as never]);
    const raw = await rawDump(factory, 'sealed1');
    for (const secret of ['кіт', 'Оксана', '123456789', 'abab', 'PlayerNamed', 'Моя лампа']) expect(raw).not.toContain(secret);
    expect(await s.loadMeta()).toEqual(META);
    expect((await s.loadEvents()).map((e) => (e.kind as unknown as { name: string }).name)).toEqual(['кіт 0', 'кіт 1', 'кіт 2']);
    expect((await s.loadEventsAfter([10, 7, 1])).map((e) => e.id.seq)).toEqual([2]);
    expect(await s.countThrough([10, 7, 1])).toBe(2);
    expect(await s.loadSnapshot()).toEqual(snap);
    expect((await s.loadUserItems())[0]).toMatchObject({ name: 'Моя лампа' });
    // reopened with the same key
    const again = await openStore('sealed1', factory, IDBKeyRange, key);
    expect(await again.loadMeta()).toEqual(META);
  });

  it('refuses a record changed or moved at rest, and another key', async () => {
    const factory = new IDBFactory();
    const key = await newDataKey();
    const s = await openStore('sealed2', factory, IDBKeyRange, key);
    await s.appendEvents([ev(10, 0), ev(11, 1)]);
    // two sealed bodies swapped between their places: neither opens where it now stands
    await rawEdit(factory, 'sealed2', 'events', (rows) => {
      const a = rows[0][1] as { sealed: string };
      const b = rows[1][1] as { sealed: string };
      return [[rows[0][0], { ...a, sealed: b.sealed }], [rows[1][0], { ...b, sealed: a.sealed }]];
    });
    await expect(s.loadEvents()).rejects.toThrow();
    const t = await openStore('sealed3', factory, IDBKeyRange, key);
    await t.saveMeta(META);
    await expect((await openStore('sealed3', factory, IDBKeyRange, await newDataKey())).loadMeta()).rejects.toThrow();
  });

  it('seals a plain save from an older version on the first launch, losing nothing', async () => {
    const factory = new IDBFactory();
    // the old version's save (format 1, plain)
    const plain = await openStore('old', factory, IDBKeyRange);
    await plain.saveMeta(META);
    const log = Array.from({ length: 50 }, (_, i) => ev(10 + Math.floor(i / 3), i));
    await plain.appendEvents(log);
    await plain.saveSnapshot({ json: '{"x":"Оксана"}', through: [12, 7, 8], covered: 9 });
    await plain.saveUserItems([{ id: 'u_x', name: 'Стілець діда' } as never]);
    expect(await rawDump(factory, 'old')).toContain('кіт 49');
    const key = await newDataKey();
    const s = await openStore('old', factory, IDBKeyRange, key);
    const raw = await rawDump(factory, 'old');
    for (const secret of ['кіт', 'Оксана', 'Стілець діда', '123456789']) expect(raw).not.toContain(secret);
    expect(await s.loadMeta()).toEqual(META);
    expect(await s.loadEvents()).toEqual(log);
    expect((await s.loadSnapshot())?.json).toBe('{"x":"Оксана"}');
    expect((await s.loadUserItems())[0]).toMatchObject({ name: 'Стілець діда' });
    expect(await s.countThrough([12, 7, 8])).toBe(9);
    // the next launch has nothing left to seal, and new events go on after the old ones
    await s.appendEvents([ev(99, 50)]);
    const next = await openStore('old', factory, IDBKeyRange, key);
    expect((await next.loadEvents()).length).toBe(51);
  });
});

/** A web storage in memory. */
function memoryStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('the sealed web storage', () => {
  it('knows which entries are private', () => {
    expect(isPrivate('teul.pc.diary')).toBe(true);
    expect(isPrivate('teul.prefs')).toBe(false);
    expect(isPrivate('teul.arcade.snake')).toBe(false);
  });

  it('seals the plain diary an older version left, and keeps it readable', async () => {
    const web = memoryStorage({ 'teul.pc.diary': 'Сьогодні бачила Марту', 'teul.prefs': '{"master":0.5}' });
    const key = await newDataKey();
    const v = await Vault.open(key, web);
    expect(web.getItem('teul.pc.diary')).toBeNull();
    expect(web.getItem(SEALED + 'teul.pc.diary')).not.toContain('Марту');
    expect(v.getItem('teul.pc.diary')).toContain('Марту');
    expect(v.getItem('teul.prefs')).toBe('{"master":0.5}');
    v.setItem('teul.pc.diary', 'А сьогодні Ганну');
    await v.flush();
    expect(JSON.stringify([...Array(web.length)].map((_, i) => web.getItem(web.key(i)!)))).not.toContain('Ганну');
    const again = await Vault.open(key, web);
    expect(again.getItem('teul.pc.diary')).toContain('Ганну');
    // another key cannot read it, and does not overwrite it
    const other = await Vault.open(await newDataKey(), web);
    expect(other.getItem('teul.pc.diary')).toBeNull();
    expect(other.unreadable).toContain('teul.pc.diary');
    expect(web.getItem(SEALED + 'teul.pc.diary')).not.toBeNull();
  });

  it('lets go of what the network world of 1.0 kept, sealed or plain, and nothing else', async () => {
    const key = await newDataKey();
    const web = memoryStorage({ 'teul.prefs': '{"master":0.5}', 'teul.games.post': '[]', 'w0123abcd.teul.net.requests': '[]' });
    web.setItem(SEALED + 'w0123abcd.teul.net.contacts', await seal(key, '[{"nick":"Марта"}]', 'w0123abcd.teul.net.contacts'));
    web.setItem(SEALED + 'teul.friends', await seal(key, '[]', 'teul.friends'));
    expect(isRetired('w0123abcd.teul.net.keys')).toBe(true);
    expect(isRetired('teul.pc.diary')).toBe(false);
    const v = await Vault.open(key, web);
    expect(Array.from({ length: web.length }, (_, i) => web.key(i))).toEqual(['teul.prefs']);
    expect(v.getItem('w0123abcd.teul.net.contacts')).toBeNull();
  });
});
