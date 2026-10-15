// The device's private entries in the web storage (the diary on the computer at home), sealed with the data key.
// The game reads and writes them synchronously as before: they are opened once at launch into memory, and every
// write is sealed and stored right after. Plain entries left by an older version are sealed on the first launch
// (sealed, read back, then removed). What version 1.0 kept for its network world (the network keys, the contacts,
// the friends, letters waiting to go, games by letter) is let go of at launch.

import { open, seal } from './seal';

type Web = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key'> & { readonly length: number };
export type KeyValue = Pick<Storage, 'getItem' | 'setItem'> & { removeItem(key: string): void };

/** The sealed copy of an entry is kept under this prefix. */
export const SEALED = 'teul.sealed:';

/** Entries that are private (with or without a world's `w<key8>.` prefix). */
const PRIVATE = /^(w[0-9a-f]{8}\.)?teul\.pc\.diary$/;

export const isPrivate = (key: string): boolean => PRIVATE.test(key);

/** Entries of the network world of version 1.0 (with or without a world's prefix): nothing reads them any more. */
const RETIRED = /^(w[0-9a-f]{8}\.)?teul\.(net\.[A-Za-z]+|friends|games\.post)$/;

export const isRetired = (key: string): boolean => RETIRED.test(key);

export class Vault implements KeyValue {
  private readonly plain = new Map<string, string>();
  private readonly queued = new Set<string>();
  private chain: Promise<void> = Promise.resolve();
  /** Entries that could not be opened (another key): kept as they are, never overwritten by accident. */
  readonly unreadable: string[] = [];

  private constructor(
    private readonly key: CryptoKey,
    private readonly web: Web,
  ) {}

  /** Opens the sealed entries, and seals the plain private ones an older version left. */
  static async open(key: CryptoKey, web: Web): Promise<Vault> {
    const v = new Vault(key, web);
    const keys: string[] = [];
    for (let i = 0; i < web.length; i++) {
      const k = web.key(i);
      if (k) keys.push(k);
    }
    // what the network world of 1.0 kept (sealed or plain) goes; the rest of the save is untouched
    const retired = keys.filter((k) => isRetired(k.startsWith(SEALED) ? k.slice(SEALED.length) : k));
    for (const k of retired) web.removeItem(k);
    if (retired.length) console.info(`let go of ${retired.length} entries of the network world of 1.0`);
    keys.splice(0, keys.length, ...keys.filter((k) => !retired.includes(k)));
    for (const k of keys.filter((k) => k.startsWith(SEALED))) {
      const name = k.slice(SEALED.length);
      try {
        v.plain.set(name, await open(key, web.getItem(k) ?? '', name));
      } catch {
        v.unreadable.push(name);
      }
    }
    for (const k of keys.filter(isPrivate)) {
      const text = web.getItem(k);
      if (text === null) continue;
      if (!v.plain.has(k) && !v.unreadable.includes(k)) {
        // migrate: seal, read back, and only then forget the plain text
        const sealed = await seal(key, text, k);
        if ((await open(key, sealed, k)) !== text) continue;
        web.setItem(SEALED + k, sealed);
        if ((await open(key, web.getItem(SEALED + k) ?? '', k)) !== text) continue;
        v.plain.set(k, text);
      }
      web.removeItem(k);
    }
    return v;
  }

  getItem(k: string): string | null {
    if (!isPrivate(k)) return this.web.getItem(k);
    return this.plain.get(k) ?? null;
  }

  setItem(k: string, value: string): void {
    if (!isPrivate(k)) {
      this.web.setItem(k, value);
      return;
    }
    if (this.unreadable.includes(k)) this.unreadable.splice(this.unreadable.indexOf(k), 1);
    this.plain.set(k, value);
    this.write(k);
  }

  removeItem(k: string): void {
    if (!isPrivate(k)) {
      this.web.removeItem(k);
      return;
    }
    this.plain.delete(k);
    this.write(k);
  }

  /** Every entry (private ones opened) whose key starts with one of the prefixes. */
  entries(match: (key: string) => boolean): [string, string][] {
    const out = new Map<string, string>();
    for (let i = 0; i < this.web.length; i++) {
      const k = this.web.key(i);
      if (!k || k.startsWith(SEALED) || isPrivate(k) || !match(k)) continue;
      const v = this.web.getItem(k);
      if (v !== null) out.set(k, v);
    }
    for (const [k, v] of this.plain) if (match(k)) out.set(k, v);
    return [...out];
  }

  /** Waits until every write so far is sealed and stored. */
  flush(): Promise<void> {
    return this.chain;
  }

  private write(k: string): void {
    if (this.queued.has(k)) return;
    this.queued.add(k);
    this.chain = this.chain.then(async () => {
      this.queued.delete(k);
      const value = this.plain.get(k);
      try {
        if (value === undefined) this.web.removeItem(SEALED + k);
        else this.web.setItem(SEALED + k, await seal(this.key, value, k));
      } catch (e) {
        console.error('could not keep a private entry', e);
      }
    });
  }
}

let vault: Vault | null = null;

export function setVault(v: Vault | null): void {
  vault = v;
}

export function currentVault(): Vault | null {
  return vault;
}

/**
 * The web storage as the game uses it: private entries sealed (once the vault is open at launch), the rest as
 * they are. Before that (and in tests) the plain storage.
 */
export function secureLocal(): KeyValue | null {
  if (vault) return vault;
  const ls = globalThis.localStorage;
  return ls ?? null;
}
