// Persistence of the event log and world metadata. IndexedDB when available, memory otherwise so the game
// still runs (without saving) in private or locked-down browsers.

import type { EventRecord } from './types';
import type { UserItem } from './workshop/voxels';
import { isSealed, open, openJson, seal, sealJson } from './secure/seal';

/**
 * A new world begins at the local midnight of the day it is made, so the world's time of day is the player's own
 * (people keep their routines by it, and the first visit is not always at midnight).
 */
export function worldEpoch(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(midnight.getTime() / 1000);
}

export interface WorldMeta {
  device: number;
  seed: number;
  epochUnixSecs: number;
  /** This device's chain secret (a save without one gets one when it is next opened). */
  secret?: number;
  /** The seed of this world's key (hex): its public key names the world's backups. Never leaves the device. */
  idSeed?: string;
  /** The save's format (`savefmt.ts`); a save without one is format 1. */
  format?: number;
  /** The content the world was last opened with (`id@version` of each pack) and the app's version then. */
  content?: string;
  app?: string;
}

/** A random seed for this world's key (32 bytes, hex). */
export function newIdSeed(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A random chain secret that survives a JavaScript number (52 bits). */
export function newSecret(): number {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0] & 0xfffff) * 0x100000000 + a[1];
}

/** A snapshot of the world the engine made (kept as its exact JSON), where in the log it stands, how many events it covers. */
export interface StoredSnapshot {
  json: string;
  through: [number, number, number];
  covered: number;
}

/** An event's place in the log: world time, device, sequence number. */
export function sortKey(e: EventRecord): [number, number, number] {
  return [e.time, e.id.device, e.id.seq];
}

function after(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
}

export interface Store {
  kind: 'indexeddb' | 'memory';
  loadMeta(): Promise<WorldMeta | null>;
  saveMeta(meta: WorldMeta): Promise<void>;
  loadEvents(): Promise<EventRecord[]>;
  appendEvents(events: EventRecord[]): Promise<void>;
  /** The latest snapshot kept (null when none): opening starts from it and reads only the events after it. */
  loadSnapshot(): Promise<StoredSnapshot | null>;
  /** Keeps a snapshot (the two latest are kept). */
  saveSnapshot(snapshot: StoredSnapshot): Promise<void>;
  /** The events after a place in the log, and how many there are up to and including it. */
  loadEventsAfter(through: [number, number, number]): Promise<EventRecord[]>;
  countThrough(through: [number, number, number]): Promise<number>;
  /** Items the player built in the workshop. */
  loadUserItems(): Promise<UserItem[]>;
  saveUserItems(items: UserItem[]): Promise<void>;
  clear(): Promise<void>;
  /** Every snapshot kept, oldest first. */
  loadSnapshots(): Promise<StoredSnapshot[]>;
  /** Replaces the whole world at once (a backup restored): all of it or, on failure, nothing. */
  replaceAll(world: WorldData): Promise<void>;
  /** The automatic local copies, by day (`YYYY-MM-DD`): the three latest are kept. */
  saveDaily(day: string, data: string): Promise<void>;
  listDaily(): Promise<string[]>;
  loadDaily(day: string): Promise<string | null>;
  /** Whether the save is sealed with the device's data key. */
  readonly sealed: boolean;
}

/** A whole world as the store keeps it. */
export interface WorldData {
  meta: WorldMeta;
  events: EventRecord[];
  snapshots: StoredSnapshot[];
  userItems: UserItem[];
}

const META = 'meta';
const EVENTS = 'events';
const SNAPSHOTS = 'snapshots';
/** The events by their place in the log (time, device, seq). */
const ORDER = 'order';
const META_KEY = 'world';
const USER_ITEMS_KEY = 'user_items';
/** The automatic local copies of the world, one a day. */
const DAILY = 'daily';
/** How the records are kept (plain, beside the meta): 2 = sealed with the device's data key. */
const AT_REST_KEY = 'at_rest';
const AT_REST_SEALED = 2;
const DAILY_KEPT = 3;

class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  readonly sealed = false;
  private daily = new Map<string, string>();
  async loadSnapshots() {
    return [...this.snapshots];
  }
  async replaceAll(w: WorldData) {
    this.meta = w.meta;
    this.events = [...w.events];
    this.snapshots = w.snapshots.slice(-2);
    this.userItems = [...w.userItems];
  }
  async saveDaily(day: string, data: string) {
    this.daily.set(day, data);
    for (const d of [...this.daily.keys()].sort().slice(0, -DAILY_KEPT)) this.daily.delete(d);
  }
  async listDaily() {
    return [...this.daily.keys()].sort();
  }
  async loadDaily(day: string) {
    return this.daily.get(day) ?? null;
  }
  private meta: WorldMeta | null = null;
  private events: EventRecord[] = [];
  private userItems: UserItem[] = [];
  private snapshots: StoredSnapshot[] = [];

  async loadSnapshot() {
    return this.snapshots.at(-1) ?? null;
  }
  async saveSnapshot(snapshot: StoredSnapshot) {
    this.snapshots = [...this.snapshots, snapshot].slice(-2);
  }
  async loadEventsAfter(through: [number, number, number]) {
    return this.events.filter((e) => after(sortKey(e), through));
  }
  async countThrough(through: [number, number, number]) {
    return this.events.filter((e) => !after(sortKey(e), through)).length;
  }

  async loadUserItems() {
    return [...this.userItems];
  }
  async saveUserItems(items: UserItem[]) {
    this.userItems = [...items];
  }
  async loadMeta() {
    return this.meta;
  }
  async saveMeta(meta: WorldMeta) {
    this.meta = meta;
  }
  async loadEvents() {
    return [...this.events];
  }
  async appendEvents(events: EventRecord[]) {
    this.events.push(...events);
  }
  async clear() {
    this.meta = null;
    this.events = [];
    this.userItems = [];
    this.snapshots = [];
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** A sealed event: its place in the log stays readable (the order index), what happened is sealed. */
interface SealedEvent {
  time: number;
  id: { device: number; seq: number };
  sealed: string;
}
interface SealedSnapshot {
  through: [number, number, number];
  covered: number;
  sealed: string;
}

const eventAad = (e: { time: number; id: { device: number; seq: number } }) => `event:${e.time}:${e.id.device}:${e.id.seq}`;
const snapAad = (through: [number, number, number]) => `snapshot:${through.join(':')}`;

class IdbStore implements Store {
  readonly kind = 'indexeddb' as const;
  constructor(
    private readonly db: IDBDatabase,
    /** The key ranges of the same IndexedDB as the database (the browser's, or a test's). */
    private readonly range: typeof IDBKeyRange,
    /** The device's data key: with it, everything is sealed at rest. */
    private readonly key: CryptoKey | null = null,
  ) {}

  get sealed(): boolean {
    return this.key !== null;
  }

  private async sealValue(value: unknown, aad: string): Promise<unknown> {
    return this.key ? { sealed: await sealJson(this.key, value, aad) } : value;
  }

  /** A value as kept: sealed ones opened (a plain one, from before sealing, as it is). */
  private async openValue<T>(raw: unknown, aad: string): Promise<T> {
    const s = (raw as { sealed?: unknown } | undefined)?.sealed;
    if (isSealed(s)) {
      if (!this.key) throw new Error('this save is sealed');
      return openJson<T>(this.key, s, aad);
    }
    return raw as T;
  }

  private async sealEvent(e: EventRecord): Promise<EventRecord | SealedEvent> {
    if (!this.key) return e;
    return { time: e.time, id: { device: e.id.device, seq: e.id.seq }, sealed: await sealJson(this.key, e, eventAad(e)) };
  }

  private async openEvents(raw: unknown[]): Promise<EventRecord[]> {
    return Promise.all(
      raw.map(async (r) => {
        const s = (r as Partial<SealedEvent>).sealed;
        if (!isSealed(s)) return r as EventRecord;
        if (!this.key) throw new Error('this save is sealed');
        const e = await openJson<EventRecord>(this.key, s, eventAad(r as SealedEvent));
        // the readable place must be the sealed one's (a moved record would not open; a relabelled one neither)
        if (e.time !== (r as SealedEvent).time || e.id.seq !== (r as SealedEvent).id.seq || e.id.device !== (r as SealedEvent).id.device) throw new Error('a record does not match its place');
        return e;
      }),
    );
  }

  private async sealSnapshot(snap: StoredSnapshot): Promise<StoredSnapshot | SealedSnapshot> {
    if (!this.key) return snap;
    return { through: snap.through, covered: snap.covered, sealed: await seal(this.key, snap.json, snapAad(snap.through)) };
  }

  private async openSnapshot(raw: unknown): Promise<StoredSnapshot> {
    const r = raw as Partial<SealedSnapshot> & Partial<StoredSnapshot>;
    if (!isSealed(r.sealed)) return raw as StoredSnapshot;
    if (!this.key) throw new Error('this save is sealed');
    return { json: await open(this.key, r.sealed, snapAad(r.through!)), through: r.through!, covered: r.covered! };
  }

  async loadMeta() {
    const tx = this.db.transaction(META, 'readonly');
    const value = await request(tx.objectStore(META).get(META_KEY));
    return value === undefined ? null : this.openValue<WorldMeta>(value, 'meta');
  }

  async saveMeta(meta: WorldMeta) {
    const value = await this.sealValue(meta, 'meta');
    const tx = this.db.transaction(META, 'readwrite');
    tx.objectStore(META).put(value, META_KEY);
    await done(tx);
  }

  async loadUserItems() {
    const tx = this.db.transaction(META, 'readonly');
    const value = await request(tx.objectStore(META).get(USER_ITEMS_KEY));
    return value === undefined ? [] : ((await this.openValue<UserItem[]>(value, 'user_items')) ?? []);
  }

  async saveUserItems(items: UserItem[]) {
    const value = await this.sealValue(items, 'user_items');
    const tx = this.db.transaction(META, 'readwrite');
    tx.objectStore(META).put(value, USER_ITEMS_KEY);
    await done(tx);
  }

  async loadEvents() {
    const tx = this.db.transaction(EVENTS, 'readonly');
    return this.openEvents((await request(tx.objectStore(EVENTS).getAll())) as unknown[]);
  }

  async appendEvents(events: EventRecord[]) {
    if (events.length === 0) return;
    const rows = await Promise.all(events.map((e) => this.sealEvent(e)));
    const tx = this.db.transaction(EVENTS, 'readwrite');
    const store = tx.objectStore(EVENTS);
    for (const e of rows) store.add(e);
    await done(tx);
  }

  async loadSnapshot() {
    const tx = this.db.transaction(SNAPSHOTS, 'readonly');
    const cursor = await request(tx.objectStore(SNAPSHOTS).openCursor(null, 'prev'));
    return cursor?.value ? this.openSnapshot(cursor.value) : null;
  }

  async loadSnapshots() {
    const tx = this.db.transaction(SNAPSHOTS, 'readonly');
    const all = (await request(tx.objectStore(SNAPSHOTS).getAll())) as unknown[];
    return Promise.all(all.map((r) => this.openSnapshot(r)));
  }

  async saveSnapshot(snapshot: StoredSnapshot) {
    const row = await this.sealSnapshot(snapshot);
    const tx = this.db.transaction(SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(SNAPSHOTS);
    store.add(row);
    // only the two latest are kept
    const keys = (await request(store.getAllKeys())) as IDBValidKey[];
    for (const k of keys.slice(0, Math.max(0, keys.length - 2))) store.delete(k);
    await done(tx);
  }

  async loadEventsAfter(through: [number, number, number]) {
    const tx = this.db.transaction(EVENTS, 'readonly');
    return this.openEvents((await request(tx.objectStore(EVENTS).index(ORDER).getAll(this.range.lowerBound(through, true)))) as unknown[]);
  }

  async countThrough(through: [number, number, number]) {
    const tx = this.db.transaction(EVENTS, 'readonly');
    return request(tx.objectStore(EVENTS).index(ORDER).count(this.range.upperBound(through)));
  }

  async clear() {
    const tx = this.db.transaction([META, EVENTS, SNAPSHOTS], 'readwrite');
    tx.objectStore(META).clear();
    tx.objectStore(EVENTS).clear();
    tx.objectStore(SNAPSHOTS).clear();
    if (this.key) tx.objectStore(META).put(AT_REST_SEALED, AT_REST_KEY);
    await done(tx);
  }

  async replaceAll(w: WorldData) {
    // everything sealed first (crypto cannot wait inside a transaction), then written in one transaction
    const meta = await this.sealValue(w.meta, 'meta');
    const items = await this.sealValue(w.userItems, 'user_items');
    const events = await Promise.all(w.events.map((e) => this.sealEvent(e)));
    const snaps = await Promise.all(w.snapshots.slice(-2).map((s) => this.sealSnapshot(s)));
    const tx = this.db.transaction([META, EVENTS, SNAPSHOTS], 'readwrite');
    const m = tx.objectStore(META);
    m.clear();
    tx.objectStore(EVENTS).clear();
    tx.objectStore(SNAPSHOTS).clear();
    m.put(meta, META_KEY);
    m.put(items, USER_ITEMS_KEY);
    if (this.key) m.put(AT_REST_SEALED, AT_REST_KEY);
    for (const e of events) tx.objectStore(EVENTS).add(e);
    for (const s of snaps) tx.objectStore(SNAPSHOTS).add(s);
    await done(tx);
  }

  async saveDaily(day: string, data: string) {
    const row = await this.sealValue(data, `daily:${day}`);
    const tx = this.db.transaction(DAILY, 'readwrite');
    const store = tx.objectStore(DAILY);
    store.put(row, day);
    const keys = ((await request(store.getAllKeys())) as string[]).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - DAILY_KEPT))) store.delete(k);
    await done(tx);
  }

  async listDaily() {
    const tx = this.db.transaction(DAILY, 'readonly');
    return ((await request(tx.objectStore(DAILY).getAllKeys())) as string[]).sort();
  }

  async loadDaily(day: string) {
    const tx = this.db.transaction(DAILY, 'readonly');
    const raw = await request(tx.objectStore(DAILY).get(day));
    return raw === undefined ? null : this.openValue<string>(raw, `daily:${day}`);
  }

  /**
   * Seals a plain save (from before sealing) in place: every record sealed and checked to open again in memory,
   * all of them written in one transaction (so either the whole save is sealed or it stays as it was), then
   * read back and checked once more. Plain records are gone once the transaction commits.
   */
  async sealAtRest(): Promise<number> {
    if (!this.key) return 0;
    const tx0 = this.db.transaction(META, 'readonly');
    if ((await request(tx0.objectStore(META).get(AT_REST_KEY))) === AT_REST_SEALED) return 0;
    const read = this.db.transaction([META, EVENTS, SNAPSHOTS], 'readonly');
    const meta = await request(read.objectStore(META).get(META_KEY));
    const items = await request(read.objectStore(META).get(USER_ITEMS_KEY));
    const evKeys = (await request(read.objectStore(EVENTS).getAllKeys())) as IDBValidKey[];
    const evRows = (await request(read.objectStore(EVENTS).getAll())) as unknown[];
    const snKeys = (await request(read.objectStore(SNAPSHOTS).getAllKeys())) as IDBValidKey[];
    const snRows = (await request(read.objectStore(SNAPSHOTS).getAll())) as unknown[];
    const plainEvents = evRows.map((r, i) => [evKeys[i], r] as const).filter(([, r]) => !isSealed((r as { sealed?: unknown }).sealed));
    const plainSnaps = snRows.map((r, i) => [snKeys[i], r] as const).filter(([, r]) => !isSealed((r as { sealed?: unknown }).sealed));
    const sealedEvents = await Promise.all(plainEvents.map(async ([k, r]) => [k, await this.sealEvent(r as EventRecord)] as const));
    const sealedSnaps = await Promise.all(plainSnaps.map(async ([k, r]) => [k, await this.sealSnapshot(r as StoredSnapshot)] as const));
    const metaPlain = meta !== undefined && !isSealed((meta as { sealed?: unknown }).sealed);
    const itemsPlain = items !== undefined && !isSealed((items as { sealed?: unknown }).sealed);
    const sealedMeta = metaPlain ? await this.sealValue(meta, 'meta') : null;
    const sealedItems = itemsPlain ? await this.sealValue(items, 'user_items') : null;
    // verify before writing: each sealed record opens to exactly the plain one
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const opened = await this.openEvents(sealedEvents.map(([, r]) => r));
    if (!opened.every((e, i) => same(e, plainEvents[i][1]))) throw new Error('sealing the log did not verify');
    for (let i = 0; i < sealedSnaps.length; i++) if (!same(await this.openSnapshot(sealedSnaps[i][1]), plainSnaps[i][1])) throw new Error('sealing a snapshot did not verify');
    if (sealedMeta && !same(await this.openValue(sealedMeta, 'meta'), meta)) throw new Error('sealing the meta did not verify');
    if (sealedItems && !same(await this.openValue(sealedItems, 'user_items'), items)) throw new Error('sealing the items did not verify');
    const tx = this.db.transaction([META, EVENTS, SNAPSHOTS], 'readwrite');
    for (const [k, r] of sealedEvents) tx.objectStore(EVENTS).put(r, k);
    for (const [k, r] of sealedSnaps) tx.objectStore(SNAPSHOTS).put(r, k);
    if (sealedMeta) tx.objectStore(META).put(sealedMeta, META_KEY);
    if (sealedItems) tx.objectStore(META).put(sealedItems, USER_ITEMS_KEY);
    tx.objectStore(META).put(AT_REST_SEALED, AT_REST_KEY);
    await done(tx);
    // and read back through the normal path
    const back = await this.loadEvents();
    if (back.length !== evRows.length) throw new Error('the sealed log lost events');
    return plainEvents.length + plainSnaps.length + (metaPlain ? 1 : 0) + (itemsPlain ? 1 : 0);
  }
}

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 3);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // version 1: meta and the log; version 2: the log by its order, and the snapshots; version 3: daily copies
      if (e.oldVersion < 1) {
        db.createObjectStore(META);
        db.createObjectStore(EVENTS, { autoIncrement: true });
      }
      if (e.oldVersion < 2) {
        const events = req.transaction?.objectStore(EVENTS);
        events?.createIndex(ORDER, ['time', 'id.device', 'id.seq']);
        db.createObjectStore(SNAPSHOTS, { autoIncrement: true });
      }
      if (e.oldVersion < 3) db.createObjectStore(DAILY);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('database blocked'));
  });
}

/** Whether a store holds anything sealed already (then a missing data key means it was lost, not new). */
export async function hasSealed(name: string, factory: IDBFactory | null | undefined = globalThis.indexedDB): Promise<boolean> {
  if (!factory) return false;
  try {
    const db = await openDb(factory, name);
    const tx = db.transaction(META, 'readonly');
    const v = await request(tx.objectStore(META).get(AT_REST_KEY));
    db.close();
    return v === AT_REST_SEALED;
  } catch {
    return false;
  }
}

/**
 * Opens the store. Pass a factory to test, or `null` to force an in-memory store; by default the browser's
 * IndexedDB is used when present. With the device's data key the save is sealed at rest (a plain one from an
 * older version is sealed now).
 */
export async function openStore(name = 'teul', factory: IDBFactory | null | undefined = globalThis.indexedDB, range: typeof IDBKeyRange | undefined = globalThis.IDBKeyRange, key: CryptoKey | null = null): Promise<Store> {
  if (!factory || !range) return new MemoryStore();
  let db: IDBDatabase;
  try {
    db = await openDb(factory, name);
  } catch {
    return new MemoryStore();
  }
  const store = new IdbStore(db, range, key);
  try {
    await store.sealAtRest();
  } catch (e) {
    // the plain save stays as it is (nothing was written); it opens as before and is sealed next time
    console.error('could not seal the save', e);
  }
  return store;
}

/** Deletes a world's database (a world the player let go of). */
export function deleteStore(name: string, factory: IDBFactory | null | undefined = globalThis.indexedDB): Promise<void> {
  return new Promise((resolve) => {
    if (!factory) return resolve();
    const req = factory.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
