// After an update the app must run as one piece of the new version, never a mix of old and new files.
// The phone and the desktop carry their files inside the installed app (an update replaces them all at once);
// in a browser the page's scripts and the core's wasm have content-hashed names, so a new index.html can only
// load new ones. What could still hold old files is a service worker or a Cache Storage of the game left by an
// earlier version: on the first launch of a new build they are let go of.
//
// Only the game's own. A browser origin may be shared with other games — itch.io serves every HTML game from one
// origin, each in a folder of its own — so a service worker is ours only when its scope lies inside the game's
// folder, a cache only when its name starts with "teul", and a web-storage entry only when its key is the game's.

const KEY = 'teul.build';

/** This build's identity: the version and when it was built. */
export const BUILD: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/** A key of the web storage that belongs to the game: `teul…`, or a world's own `w<8 hex>.…`. */
export function ownKey(key: string): boolean {
  return key.startsWith('teul') || /^w(?:[0-9a-f]{8})?\./i.test(key);
}

/** A Cache Storage entry of the game. */
export function ownCache(name: string): boolean {
  return name.startsWith('teul');
}

/** A service worker of the game: its scope lies inside the folder the game is served from. */
export function ownScope(scope: string, base: string): boolean {
  return base !== '' && scope.startsWith(base);
}

/** The folder the game is served from (with its trailing slash), e.g. https://html-classic.itch.zone/html/123/. */
export function appBase(href: string = globalThis.location?.href ?? ''): string {
  try {
    return new URL('./', href).href;
  } catch {
    return '';
  }
}

interface UpdateEnv {
  serviceWorker?: Pick<ServiceWorkerContainer, 'getRegistrations'> | null;
  caches?: Pick<CacheStorage, 'keys' | 'delete'> | null;
  base?: string;
}

function webStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Clears what an older build of the game may have cached; true when this is the first launch of this build. */
export async function settleUpdate(web: Pick<Storage, 'getItem' | 'setItem'> | null = webStorage(), env: UpdateEnv = {}): Promise<boolean> {
  let was: string | null = null;
  try {
    was = web?.getItem(KEY) ?? null;
  } catch {
    return false;
  }
  if (was === BUILD) return false;
  const base = env.base ?? appBase();
  try {
    const sw = env.serviceWorker !== undefined ? env.serviceWorker : globalThis.navigator?.serviceWorker;
    const regs = (await sw?.getRegistrations?.()) ?? [];
    await Promise.all(regs.filter((r) => ownScope(r.scope, base)).map((r) => r.unregister()));
  } catch {
    // no service workers here
  }
  try {
    const cs = env.caches !== undefined ? env.caches : globalThis.caches;
    const names = (await cs?.keys?.()) ?? [];
    await Promise.all(names.filter(ownCache).map((n) => cs?.delete(n)));
  } catch {
    // no Cache Storage here
  }
  try {
    web?.setItem(KEY, BUILD);
  } catch {
    // storage blocked
  }
  return true;
}
