// The device's data key: one random AES-256 key that seals the saves, the network keys and the contacts.
// It is kept where the platform keeps secrets:
// - Android: the Keystore (via @aparajita/capacitor-secure-storage: AES-GCM under a Keystore key);
// - desktop: the OS keyring (Windows Credential Manager, the Secret Service on Linux) via a Tauri command;
// - a browser: a non-extractable CryptoKey kept in IndexedDB (scripts can use it, never read it out).
// Without any of these (a locked-down browser) the key lives for the session, as the in-memory save does.

import { hasSecretStore, secretGet, secretSet } from '../platform';
import { fromB64, importDataKey, newDataKey, randomBytes, toB64 } from './seal';

export const DATA_KEY_NAME = 'teul.dataKey';
const NAME = DATA_KEY_NAME;
export const KEYS_DB = 'teul-keys';
const DB = KEYS_DB;

export class KeyLost extends Error {
  constructor() {
    super('the data key of this device is gone');
  }
}

function idbKey(factory: IDBFactory): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const get = store.get('data');
      get.onsuccess = async () => {
        const have = get.result as CryptoKey | undefined;
        if (have) {
          resolve(have);
          db.close();
          return;
        }
        // made outside the transaction (it would close while waiting for crypto), then kept
        try {
          const key = await newDataKey();
          const tx2 = db.transaction('keys', 'readwrite');
          const put = tx2.objectStore('keys').add(key, 'data');
          tx2.oncomplete = () => {
            db.close();
            resolve(key);
          };
          tx2.onerror = () => {
            // another tab made one first: use that
            put.onerror = null;
            const again = db.transaction('keys', 'readonly').objectStore('keys').get('data');
            again.onsuccess = () => resolve((again.result as CryptoKey) ?? key);
            again.onerror = () => reject(again.error);
          };
        } catch (e) {
          reject(e);
        }
      };
      get.onerror = () => reject(get.error);
    };
  });
}

let cached: Promise<CryptoKey> | null = null;

/** For tests: the key to use instead of the platform's. */
export function useDataKey(key: CryptoKey | null): void {
  cached = key ? Promise.resolve(key) : null;
}

/**
 * The data key (made on the first launch). `hadSaves`: whether sealed data already exists — then a missing key
 * means it was lost (the app's secure storage was wiped) and is not silently replaced.
 */
export function dataKey(hadSealed = false, factory: IDBFactory | null | undefined = globalThis.indexedDB): Promise<CryptoKey> {
  if (cached) return cached;
  const made = (async () => {
    if (hasSecretStore()) {
      const raw = await secretGet(NAME);
      if (raw) return importDataKey(fromB64(raw));
      if (hadSealed) throw new KeyLost();
      const fresh = randomBytes(32);
      await secretSet(NAME, toB64(fresh));
      // read back: a store that did not keep it would lose the world on the next launch
      const check = await secretGet(NAME);
      if (check !== toB64(fresh)) throw new Error('the secure store did not keep the key');
      return importDataKey(fresh);
    }
    if (factory) {
      try {
        return await idbKey(factory);
      } catch {
        // IndexedDB refused: fall through to a key for this session
      }
    }
    if (hadSealed) throw new KeyLost();
    return newDataKey();
  })();
  cached = made;
  made.catch(() => {
    cached = null;
  });
  return made;
}
