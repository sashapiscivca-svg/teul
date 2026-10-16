// Can this page keep anything? A browser may refuse a site its storage: all cross-site data blocked while the game
// runs in another site's frame (itch.io), or a strict private mode. Then nothing can be saved, and the game says so
// in its own words instead of breaking on the first touch of the storage.

import { h } from './ui/dom';
import { t } from './i18n';

/** Where the game can always be played in a page of its own, and downloaded. */
export const WEB_HOME = 'https://sashapiscivca-svg.github.io/teul/';
export const DOWNLOADS = 'https://github.com/sashapiscivca-svg/teul/releases/latest';

const PROBE = 'teul.probe';

interface Env {
  localStorage?: Storage;
  indexedDB?: IDBFactory;
}

/** True when an error is the browser refusing storage (not a damaged save or a bug). */
export function isStorageRefusal(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  if (name === 'SecurityError') return true;
  return /the operation is insecure|access is denied for this document|storage.*(disabled|blocked|denied)/i.test(String((err as Error).message ?? ''));
}

/** Tries the web storage and IndexedDB the way the game uses them; false when the browser refuses either. */
export async function canStore(env: Env = globalThis as Env, timeoutMs = 4000): Promise<boolean> {
  try {
    const ls = env.localStorage;
    if (!ls) return false;
    ls.setItem(PROBE, '1');
    const ok = ls.getItem(PROBE) === '1';
    ls.removeItem(PROBE);
    if (!ok) return false;
  } catch {
    return false;
  }
  let factory: IDBFactory | undefined;
  try {
    factory = env.indexedDB;
  } catch {
    return false;
  }
  if (!factory) return false;
  return new Promise<boolean>((resolve) => {
    let done = false;
    // a browser that neither opens nor refuses (it happens in some private modes) counts as refusing
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(v: boolean): void {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }
    try {
      const req = factory.open(PROBE, 1);
      req.onsuccess = () => {
        // the probe database is removed before answering (the game then opens its own on a clean slate)
        try {
          req.result.close();
          const del = factory.deleteDatabase(PROBE);
          del.onsuccess = del.onerror = del.onblocked = () => finish(true);
        } catch {
          finish(true);
        }
      };
      req.onerror = () => {
        finish(false);
      };
      req.onblocked = () => {
        finish(true);
      };
    } catch {
      finish(false);
    }
  });
}

/** True when the game runs inside another site's frame (itch.io and the like). */
function framed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/** The screen shown instead of the game when nothing can be kept: what happened and what to do, never a raw error. */
export function storageBlocked(root: HTMLElement): void {
  const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  const onHome = typeof location !== 'undefined' && location.href.startsWith(WEB_HOME);
  const ways = h('ul', { class: 'storage-ways' },
    h('li', null, framed() ? t('storage.allowFramed') : t('storage.allow')),
    onHome ? null : h('li', null, t('storage.playHome'), ' ', link(WEB_HOME, WEB_HOME.replace(/^https:\/\//, '').replace(/\/$/, ''))),
    h('li', null, t('storage.download'), ' ', link(DOWNLOADS, t('storage.downloadLink'))),
  );
  const card = h('div', { class: 'settings-card' },
    h('b', null, t('storage.title')),
    h('p', null, t('storage.text')),
    ways,
    h('p', { class: 'friend-hint' }, t('storage.private')),
    h('div', { class: 'friend-actions' }, h('button', { class: 'cta', type: 'button', onclick: () => location.reload() }, t('storage.retry'))),
  );
  root.append(h('div', { class: 'settings backup cannot-open storage-blocked', role: 'dialog', 'aria-label': t('storage.title') }, card));
}
