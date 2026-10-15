// Keeping the world: opening it sealed at launch (the data key, the sealed web storage, the store), the
// «Резервна копія» sheet's work, the daily copies, and what the player sees when a save cannot be opened.

import { BackupError, backupName, collect, exportBundle, importBundle, keepDaily, loadDaily, problemText, restore, type WorldBundle } from './backup';
import { publicKeyOf } from './engine';
import { openFile, saveFile, secretDelete } from './platform';
import { SAVE_FORMAT, SaveTooNew, formatOf } from './savefmt';
import { DATA_KEY_NAME, KEYS_DB, KeyLost, dataKey } from './secure/keystore';
import { SEALED, Vault, setVault } from './secure/vault';
import { deleteStore, hasSealed, openStore, type Store, type WorldMeta } from './storage';
import type { BackupHandlers } from './ui/backup';
import { h } from './ui/dom';
import { activeWorld, addWorld, dbName, switchWorld, worlds } from './worlds';
import { t } from './i18n';

/** A save this device cannot open (sealed with a key that is gone, or damaged). */
export class Unreadable extends Error {}

export interface Opened {
  store: Store;
  vault: Vault | null;
  key: CryptoKey | null;
}

function webStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Opens a world's store sealed with the device's data key (and the sealed web storage). */
export async function openSealed(name: string, memory = false): Promise<Opened> {
  if (memory) return { store: await openStore(name, null), vault: null, key: null };
  const web = webStorage();
  let sealedWeb = false;
  if (web) for (let i = 0; i < web.length && !sealedWeb; i++) sealedWeb = web.key(i)?.startsWith(SEALED) ?? false;
  const had = sealedWeb || (await hasSealed(name));
  let key: CryptoKey;
  try {
    key = await dataKey(had);
  } catch (e) {
    if (e instanceof KeyLost) throw new Unreadable('the data key is gone');
    // no secure store answers (a broken keyring): the save opens as it is, unsealed, rather than not at all
    console.error('no data key', e);
    return { store: await openStore(name), vault: null, key: null };
  }
  const vault = web ? await Vault.open(key, web) : null;
  setVault(vault);
  const store = await openStore(name, undefined, undefined, key);
  try {
    await store.loadMeta();
  } catch {
    throw new Unreadable('the save does not open with this key');
  }
  return { store, vault, key };
}

export const worldPrefix = (meta: WorldMeta): string => `w${publicKeyOf(meta.idSeed ?? '').slice(0, 8)}.`;

/** The store name of the world that opens (a test may name its own). */
export function startingWorld(testWorld: string | null): string {
  return testWorld ? `teul-${testWorld}` : dbName(activeWorld().id);
}

/** Stops a store from taking any more writes (the world in it is being replaced; the page reloads next). */
function freeze(store: Store): void {
  const none = async () => undefined;
  Object.assign(store, { appendEvents: none, saveSnapshot: none, saveMeta: none, saveUserItems: none });
}

function today(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function explain(err: unknown): string {
  if (err instanceof BackupError) return problemText(err.problem);
  if (err instanceof SaveTooNew) return problemText('too-new');
  console.error(err);
  return t('backup.failed');
}

export interface KeepingContext {
  opened: Opened;
  meta: WorldMeta;
  /** Writes what is still unsaved (the game's `saveNow`). */
  flush: () => Promise<void>;
  reload?: () => void;
}

/** The work behind the «Резервна копія» sheet. */
export function backupHandlers(ctx: KeepingContext): BackupHandlers {
  const { store, vault, key } = ctx.opened;
  const prefix = worldPrefix(ctx.meta);
  const reload = ctx.reload ?? (() => location.reload());
  let bundle: WorldBundle | null = null;
  const replaceWith = async (b: WorldBundle) => {
    await ctx.flush();
    // nothing of the running world is written any more (the page reloads into the restored one)
    freeze(store);
    // today's copy is the world as it was, so a replacement can be undone from the daily copies
    await store.saveDaily(today(), JSON.stringify(await collect(store, vault, prefix)));
    await restore(store, b, vault, true);
    await vault?.flush();
    reload();
  };
  return {
    async save(passphrase) {
      await ctx.flush();
      const file = await exportBundle(await collect(store, vault, prefix), passphrase);
      return saveFile(backupName(), file, 'application/json', t('backup.fileTitle'));
    },
    pick: () => openFile('.teulbackup,application/json,*/*'),
    async open(file, passphrase) {
      bundle = await importBundle(file, passphrase);
      return { made: bundle.made, app: bundle.app, sameWorld: bundle.world.meta.idSeed === ctx.meta.idSeed };
    },
    async replace() {
      if (!bundle) return;
      await replaceWith(bundle);
    },
    async keepBoth() {
      if (!bundle) return;
      await ctx.flush();
      const entry = addWorld(t('backup.copyName', { date: bundle.made.slice(0, 10).split('-').reverse().join('.') }), true);
      const target = await openStore(dbName(entry.id), undefined, undefined, key);
      await restore(target, bundle, vault, false);
      await vault?.flush();
      reload();
    },
    daily: () => store.listDaily(),
    async restoreDaily(day) {
      const b = await loadDaily(store, day);
      if (b) await replaceWith(b);
    },
    worlds: () => {
      const active = activeWorld().id;
      return worlds().map((w) => ({ id: w.id, name: w.name, active: w.id === active }));
    },
    switchTo(id) {
      switchWorld(id);
      reload();
    },
    explain,
  };
}

/** Today's automatic copy (once a day; errors are only logged: the world itself is safe in its store). */
export async function daily(ctx: KeepingContext): Promise<void> {
  try {
    await keepDaily(ctx.opened.store, ctx.opened.vault, worldPrefix(ctx.meta));
  } catch (e) {
    console.error('no daily copy', e);
  }
}

/** The save cannot be opened here: say so plainly, and offer a backup or a new world (the old one is never touched). */
export function cannotOpen(root: HTMLElement, why: 'unreadable' | 'too-new', format = SAVE_FORMAT + 1): void {
  const said = h('p', { class: 'friend-hint' });
  const card = h('div', { class: 'settings-card' });
  const screen = h('div', { class: 'settings backup cannot-open', role: 'dialog' }, card);
  if (why === 'too-new') {
    card.append(
      h('b', null, t('backup.tooNewTitle')),
      h('p', null, t('backup.tooNewText', { format, known: SAVE_FORMAT })),
    );
    root.append(screen);
    return;
  }
  const pass = h('input', { type: 'password', placeholder: t('backup.copyPass'), 'aria-label': t('backup.copyPass') }) as HTMLInputElement;
  let file: Uint8Array | null = null;
  const openBtn = h('button', { class: 'cta', type: 'button', onclick: async () => {
    if (!file) file = await openFile('.teulbackup,application/json,*/*');
    if (!file) return;
    said.textContent = t('backup.opening');
    try {
      const b = await importBundle(file, pass.value);
      const entry = addWorld(t('backup.copyName', { date: b.made.slice(0, 10).split('-').reverse().join('.') }), true);
      const opened = await openSealed(dbName(entry.id));
      await restore(opened.store, b, opened.vault, true);
      await opened.vault?.flush();
      location.reload();
    } catch (e) {
      said.textContent = explain(e);
    }
  } }, t('backup.openBackup'));
  const fresh = h('button', { class: 'cta muted', type: 'button', onclick: () => {
    addWorld(t('worlds.main'), true);
    location.reload();
  } }, t('backup.fresh'));
  card.append(
    h('b', null, t('backup.lostTitle')),
    h('p', null, t('backup.lostText')),
    h('div', { class: 'backup-row' }, pass),
    h('div', { class: 'friend-actions' }, openBtn, fresh),
    said,
  );
  root.append(screen);
}

/**
 * Lets go of everything this device keeps of the game: every world and its saves, the data key (in the platform's
 * secure store too), the preferences. The page reloads onto a first start.
 */
export async function eraseEverything(store: Store | null): Promise<void> {
  if (store) freeze(store);
  const names = new Set<string>([...worlds().map((w) => dbName(w.id)), KEYS_DB]);
  try {
    for (const d of (await globalThis.indexedDB?.databases?.()) ?? []) if (d.name && /^teul/.test(d.name)) names.add(d.name);
  } catch {
    // a browser that cannot list them: the known ones are enough
  }
  for (const n of names) await deleteStore(n);
  await secretDelete(DATA_KEY_NAME);
  try {
    globalThis.localStorage?.clear();
    globalThis.sessionStorage?.clear();
  } catch {
    // storage blocked: nothing was kept there
  }
  try {
    for (const c of (await globalThis.caches?.keys?.()) ?? []) await globalThis.caches.delete(c);
  } catch {
    // no caches
  }
}

export { deleteStore, formatOf };
