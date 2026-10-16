import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { canStore, isStorageRefusal } from '../src/storagecheck';

/** A web storage that works (a plain map). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

const insecure = () => new DOMException('The operation is insecure.', 'SecurityError');

describe('storage check (a browser that refuses this site its storage)', () => {
  it('passes when both the web storage and IndexedDB work, and leaves nothing behind', async () => {
    const ls = memoryStorage();
    const idb = new IDBFactory();
    expect(await canStore({ localStorage: ls, indexedDB: idb })).toBe(true);
    expect(ls.length).toBe(0);
    const names = (await idb.databases()).map((d) => d.name);
    expect(names).not.toContain('teul.probe');
  });

  it('fails when touching localStorage throws SecurityError (all cross-site data blocked in a frame)', async () => {
    const env = {
      get localStorage(): Storage {
        throw insecure();
      },
      indexedDB: new IDBFactory(),
    };
    expect(await canStore(env)).toBe(false);
  });

  it('fails when localStorage refuses writes (quota 0 in a strict private mode)', async () => {
    const ls = memoryStorage();
    ls.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    expect(await canStore({ localStorage: ls, indexedDB: new IDBFactory() })).toBe(false);
  });

  it('fails when IndexedDB is refused, missing, errors or never answers', async () => {
    const throwing = { open: () => { throw insecure(); } } as unknown as IDBFactory;
    expect(await canStore({ localStorage: memoryStorage(), indexedDB: throwing })).toBe(false);
    expect(await canStore({ localStorage: memoryStorage() })).toBe(false);
    const erroring = { open: () => { const req = {} as IDBOpenDBRequest; setTimeout(() => req.onerror?.(new Event('error')), 0); return req; } } as unknown as IDBFactory;
    expect(await canStore({ localStorage: memoryStorage(), indexedDB: erroring })).toBe(false);
    const silent = { open: () => ({}) } as unknown as IDBFactory;
    expect(await canStore({ localStorage: memoryStorage(), indexedDB: silent }, 20)).toBe(false);
    const getterThrows = { localStorage: memoryStorage(), get indexedDB(): IDBFactory { throw insecure(); } };
    expect(await canStore(getterThrows)).toBe(false);
  });

  it('tells a storage refusal from other errors', () => {
    expect(isStorageRefusal(insecure())).toBe(true);
    expect(isStorageRefusal(new Error('SecurityError: The operation is insecure.'))).toBe(true);
    expect(isStorageRefusal(new Error('unexpected token in JSON'))).toBe(false);
    expect(isStorageRefusal(new TypeError('x is undefined'))).toBe(false);
    expect(isStorageRefusal(null)).toBe(false);
  });
});
