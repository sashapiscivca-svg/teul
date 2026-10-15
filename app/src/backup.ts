// A whole world in one file the player keeps, for a new device or a bad day: the event log, the snapshots, the
// meta (with the chain secret and the world's key), the player's own items, the diary and the preferences. Sealed with a passphrase the player chooses (PBKDF2-SHA-256, 600 000 rounds →
// AES-256-GCM); without it the file is noise. No server sees it: it goes wherever the player puts it.
//
// File (UTF-8 JSON): {"teul":"world-backup","v":1,"app","made","kdf":{"name","rounds","salt"},"zip","data"}
// where data = base64(iv ‖ AES-GCM(gzip(JSON(bundle)))) and the header (everything but data) is the
// associated data, so no field of it can be changed either.

import { SAVE_FORMAT, APP_VERSION, SaveTooNew, migrateWorld } from './savefmt';
import { PBKDF2_ROUNDS, fromB64, gunzip, gzip, openBytes, passKey, randomBytes, sealBytes, sha256Hex, toB64 } from './secure/seal';
import { isRetired, type KeyValue } from './secure/vault';
import type { Store, WorldData } from './storage';
import { t } from './i18n';

/** A world and the device's entries that belong with it. */
export interface WorldBundle {
  kind: 'teul-world';
  format: number;
  app: string;
  made: string;
  world: WorldData;
  /** Web-storage entries (private ones opened): the world's own (`w<key8>.…`) and the device's (`teul.…`). */
  local: [string, string][];
}

export type BackupProblem = 'not-backup' | 'passphrase' | 'too-new' | 'damaged';

export class BackupError extends Error {
  constructor(readonly problem: BackupProblem) {
    super(problem);
  }
}

/** What the player reads when a backup cannot be opened (in the world's own words). */
export function problemText(p: BackupProblem): string {
  switch (p) {
    case 'passphrase':
      return t('backup.problem.passphrase');
    case 'not-backup':
      return t('backup.problem.notBackup');
    case 'too-new':
      return t('backup.problem.tooNew');
    default:
      return t('backup.problem.damaged');
  }
}

/** Entries of the web storage that travel with a world (never the sealed copies, the registry or the data key). */
export function travels(key: string, worldPrefix: string): boolean {
  if (key.startsWith('teul.sealed:') || key === 'teul.worlds' || key === 'teul.build' || key === 'teul.dataKey' || isRetired(key)) return false;
  return key.startsWith(worldPrefix) || key.startsWith('teul.');
}

export async function collect(store: Store, local: { entries(match: (k: string) => boolean): [string, string][] } | null, worldPrefix: string): Promise<WorldBundle> {
  const meta = await store.loadMeta();
  if (!meta) throw new Error('no world to keep');
  const world: WorldData = { meta, events: await store.loadEvents(), snapshots: await store.loadSnapshots(), userItems: await store.loadUserItems() };
  return { kind: 'teul-world', format: SAVE_FORMAT, app: APP_VERSION, made: new Date().toISOString(), world, local: local ? local.entries((k) => travels(k, worldPrefix)) : [] };
}

interface Header {
  teul: 'world-backup';
  v: 1;
  app: string;
  made: string;
  kdf: { name: 'PBKDF2-SHA256'; rounds: number; salt: string };
  zip: 'gzip' | null;
}

const headerText = (h: Header) => JSON.stringify({ teul: h.teul, v: h.v, app: h.app, made: h.made, kdf: { name: h.kdf.name, rounds: h.kdf.rounds, salt: h.kdf.salt }, zip: h.zip });

export const MIN_PASSPHRASE = 8;

export async function exportBundle(bundle: WorldBundle, passphrase: string, rounds = PBKDF2_ROUNDS): Promise<Uint8Array> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error('passphrase too short');
  const salt = randomBytes(16);
  const plain = new TextEncoder().encode(JSON.stringify(bundle));
  const zipped = await gzip(plain);
  const head: Header = { teul: 'world-backup', v: 1, app: bundle.app, made: bundle.made, kdf: { name: 'PBKDF2-SHA256', rounds, salt: toB64(salt) }, zip: zipped ? 'gzip' : null };
  const key = await passKey(passphrase, salt, rounds);
  const data = await sealBytes(key, zipped ?? plain, headerText(head));
  return new TextEncoder().encode(JSON.stringify({ ...head, data: toB64(data) }));
}

/** Opens a backup file; a wrong passphrase, another file or a newer format is a `BackupError`. */
export async function importBundle(file: Uint8Array, passphrase: string): Promise<WorldBundle> {
  let head: Header & { data: string };
  try {
    head = JSON.parse(new TextDecoder().decode(file)) as Header & { data: string };
  } catch {
    throw new BackupError('not-backup');
  }
  if (head?.teul !== 'world-backup' || typeof head.data !== 'string' || head.kdf?.name !== 'PBKDF2-SHA256') throw new BackupError('not-backup');
  if (head.v !== 1) throw new BackupError('too-new');
  const rounds = Number(head.kdf.rounds);
  if (!Number.isInteger(rounds) || rounds < 100_000 || rounds > 50_000_000) throw new BackupError('damaged');
  let plain: Uint8Array;
  try {
    const key = await passKey(passphrase, fromB64(head.kdf.salt), rounds);
    plain = await openBytes(key, fromB64(head.data), headerText(head));
  } catch {
    // AES-GCM cannot tell a wrong passphrase from a changed file; a wrong passphrase is by far the likelier
    throw new BackupError('passphrase');
  }
  let bundle: WorldBundle;
  try {
    const text = new TextDecoder().decode(head.zip === 'gzip' ? await gunzip(plain) : plain);
    bundle = JSON.parse(text) as WorldBundle;
  } catch {
    throw new BackupError('damaged');
  }
  if (bundle?.kind !== 'teul-world' || !bundle.world?.meta || !Array.isArray(bundle.world.events)) throw new BackupError('damaged');
  try {
    bundle = { ...bundle, world: migrateWorld(bundle.world), local: Array.isArray(bundle.local) ? bundle.local : [] };
  } catch (e) {
    if (e instanceof SaveTooNew) throw new BackupError('too-new');
    throw new BackupError('damaged');
  }
  return bundle;
}

/**
 * Puts a world from a backup into a store (replacing what it held) and its entries into the web storage
 * (`deviceEntries`: also the device-wide ones, when the backup replaces the only world).
 */
export async function restore(store: Store, bundle: WorldBundle, local: KeyValue | null, deviceEntries = true): Promise<void> {
  const world = migrateWorld(bundle.world);
  await store.replaceAll(world);
  for (const [k, v] of bundle.local) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    // the world's own entries always; the device's (preferences, the diary) only when it replaces this one
    const own = /^w[0-9a-f]{8}\./.test(k);
    if (!own && !(deviceEntries && k.startsWith('teul.'))) continue;
    if (k.startsWith('teul.sealed:') || k === 'teul.worlds' || k === 'teul.dataKey') continue;
    // a backup made by 1.0 carries its network world's keys, contacts and friends: nothing reads them now
    if (isRetired(k)) {
      console.info(`not restored (the network world of 1.0): ${k}`);
      continue;
    }
    try {
      local?.setItem(k, v);
    } catch {
      // full storage: the world itself is back; the rest comes again
    }
  }
}

/** The automatic copy of today, kept on the device (sealed with its data key): the three latest days are kept. */
export async function keepDaily(store: Store, local: { entries(match: (k: string) => boolean): [string, string][] } | null, worldPrefix: string, now = new Date()): Promise<boolean> {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const have = await store.listDaily();
  if (have.includes(day)) return false;
  const bundle = await collect(store, local, worldPrefix);
  await store.saveDaily(day, JSON.stringify(bundle));
  return true;
}

export async function loadDaily(store: Store, day: string): Promise<WorldBundle | null> {
  const text = await store.loadDaily(day);
  if (!text) return null;
  const b = JSON.parse(text) as WorldBundle;
  return { ...b, world: migrateWorld(b.world) };
}

/** A digest of what a world holds (its room, things, money and what the opening found), to compare two copies. */
export async function stateDigest(engine: { room(): unknown; inventory(): unknown; wallet(): unknown; integrity(): unknown }): Promise<string> {
  return sha256Hex(JSON.stringify([engine.room(), engine.inventory(), engine.wallet(), engine.integrity()]));
}

/** A file name for a backup: `lypove-2026-10-11.teulbackup`. */
export function backupName(now = new Date()): string {
  return `lypove-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.teulbackup`;
}
