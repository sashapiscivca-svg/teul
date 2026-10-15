import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { openStore, worldEpoch } from '../src/storage';
import type { EventRecord } from '../src/types';

function ev(seq: number): EventRecord {
  return { id: { device: 1, seq }, time: seq, rules_version: 2, kind: { type: 'CoinsEarned', amount: seq } };
}

describe('store (IndexedDB)', () => {
  it('starts empty', async () => {
    const s = await openStore('t1', new IDBFactory(), IDBKeyRange);
    expect(s.kind).toBe('indexeddb');
    expect(await s.loadMeta()).toBeNull();
    expect(await s.loadEvents()).toEqual([]);
  });

  it('round-trips the world metadata', async () => {
    const s = await openStore('t2', new IDBFactory(), IDBKeyRange);
    await s.saveMeta({ device: 5, seed: 99, epochUnixSecs: 1_700_000_000 });
    expect(await s.loadMeta()).toEqual({ device: 5, seed: 99, epochUnixSecs: 1_700_000_000 });
  });

  it('keeps events in the order they were appended, across calls', async () => {
    const s = await openStore('t3', new IDBFactory(), IDBKeyRange);
    await s.appendEvents([ev(0), ev(1)]);
    await s.appendEvents([ev(2)]);
    await s.appendEvents([]);
    expect((await s.loadEvents()).map((e) => e.id.seq)).toEqual([0, 1, 2]);
  });

  it('survives reopening the same database', async () => {
    const factory = new IDBFactory();
    const first = await openStore('t4', factory, IDBKeyRange);
    await first.saveMeta({ device: 1, seed: 2, epochUnixSecs: 3 });
    await first.appendEvents([ev(0), ev(1)]);
    const again = await openStore('t4', factory, IDBKeyRange);
    expect(await again.loadMeta()).toEqual({ device: 1, seed: 2, epochUnixSecs: 3 });
    expect(await again.loadEvents()).toHaveLength(2);
  });

  it('isolates databases by name', async () => {
    const factory = new IDBFactory();
    const a = await openStore('a', factory, IDBKeyRange);
    const b = await openStore('b', factory, IDBKeyRange);
    await a.appendEvents([ev(0)]);
    expect(await b.loadEvents()).toEqual([]);
  });

  it('clears everything', async () => {
    const s = await openStore('t5', new IDBFactory(), IDBKeyRange);
    await s.saveMeta({ device: 1, seed: 2, epochUnixSecs: 3 });
    await s.appendEvents([ev(0)]);
    await s.clear();
    expect(await s.loadMeta()).toBeNull();
    expect(await s.loadEvents()).toEqual([]);
  });

  it('handles a thousand events', async () => {
    const s = await openStore('t6', new IDBFactory(), IDBKeyRange);
    await s.appendEvents(Array.from({ length: 1000 }, (_, i) => ev(i)));
    const all = await s.loadEvents();
    expect(all).toHaveLength(1000);
    expect(all[999].id.seq).toBe(999);
  });
});

describe('store (fallback)', () => {
  it('falls back to memory when IndexedDB is missing', async () => {
    const s = await openStore('m1', undefined);
    expect(s.kind).toBe('memory');
    await s.appendEvents([ev(0), ev(1)]);
    await s.saveMeta({ device: 1, seed: 2, epochUnixSecs: 3 });
    expect((await s.loadEvents()).map((e) => e.id.seq)).toEqual([0, 1]);
    expect(await s.loadMeta()).toEqual({ device: 1, seed: 2, epochUnixSecs: 3 });
    await s.clear();
    expect(await s.loadEvents()).toEqual([]);
  });

  it('falls back to memory when opening throws (private mode, blocked storage)', async () => {
    const broken = { open: () => { throw new Error('denied'); } } as unknown as IDBFactory;
    const s = await openStore('m2', broken, IDBKeyRange);
    expect(s.kind).toBe('memory');
    await s.appendEvents([ev(0)]);
    expect(await s.loadEvents()).toHaveLength(1);
  });

  it('falls back to memory when the open request errors', async () => {
    const failing = {
      open: () => {
        const req: { onerror?: () => void; error: Error } = { error: new Error('blocked') };
        queueMicrotask(() => req.onerror?.());
        return req;
      },
    } as unknown as IDBFactory;
    const s = await openStore('m3', failing, IDBKeyRange);
    expect(s.kind).toBe('memory');
  });
});

describe('worldEpoch', () => {
  it('starts a world at the local midnight of its first day', () => {
    const now = new Date(2026, 9, 10, 14, 37, 12);
    const epoch = worldEpoch(now);
    const minutes = Math.floor((now.getTime() / 1000 - epoch) / 60);
    expect(minutes).toBe(14 * 60 + 37);
    expect(new Date(epoch * 1000).getHours()).toBe(0);
  });
});

describe('snapshots beside the log', () => {
  const ev = (time: number, seq: number): EventRecord => ({ id: { device: 1, seq }, time, rules_version: 1, kind: { type: 'PlayerNamed', name: String(seq) } });
  const log = [ev(10, 0), ev(10, 1), ev(20, 2), ev(30, 3), ev(30, 4)];

  for (const [name, open] of [
    ['IndexedDB', () => openStore('snap-' + Math.random(), new IDBFactory(), IDBKeyRange)],
    ['memory', () => openStore('x', null)],
  ] as const) {
    it(`${name}: keeps the latest two snapshots and reads only the events after one`, async () => {
      const store = await open();
      await store.appendEvents(log);
      expect(await store.loadSnapshot()).toBeNull();
      for (const through of [[10, 1, 0], [10, 1, 1], [20, 1, 2]] as [number, number, number][]) {
        await store.saveSnapshot({ json: JSON.stringify({ through }), through, covered: 0 });
      }
      const latest = await store.loadSnapshot();
      expect(latest?.through).toEqual([20, 1, 2]);
      expect((await store.loadEventsAfter([10, 1, 1])).map((e) => e.id.seq)).toEqual([2, 3, 4]);
      expect(await store.countThrough([10, 1, 1])).toBe(2);
      expect(await store.countThrough([30, 1, 4])).toBe(5);
      expect(await store.loadEventsAfter([30, 1, 4])).toEqual([]);
    });
  }

  it('an old save (version 1) gets the order of its log without losing an event', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('old', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('meta');
        req.result.createObjectStore('events', { autoIncrement: true });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('events', 'readwrite');
        for (const e of log) tx.objectStore('events').add(e);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
    const store = await openStore('old', factory, IDBKeyRange);
    expect(store.kind).toBe('indexeddb');
    expect((await store.loadEvents()).length).toBe(5);
    expect(await store.countThrough([20, 1, 2])).toBe(3);
    expect(await store.loadSnapshot()).toBeNull();
  });
});
