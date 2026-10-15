// After an update the app must run as one piece of the new version, never a mix of old and new files.
// The phone and the desktop carry their files inside the installed app (an update replaces them all at once);
// in a browser the page's scripts and the core's wasm have content-hashed names, so a new index.html can only
// load new ones. What could still hold old files is a service worker or a Cache Storage left by an earlier
// version (or anything on the same origin): on the first launch of a new build they are let go of.

const KEY = 'teul.build';

/** This build's identity: the version and when it was built. */
export const BUILD: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/** Clears what an older build may have cached; true when this is the first launch of this build. */
export async function settleUpdate(web: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null): Promise<boolean> {
  let was: string | null = null;
  try {
    was = web?.getItem(KEY) ?? null;
  } catch {
    return false;
  }
  if (was === BUILD) return false;
  try {
    const regs = (await globalThis.navigator?.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // no service workers here
  }
  try {
    const names = (await globalThis.caches?.keys?.()) ?? [];
    await Promise.all(names.map((n) => caches.delete(n)));
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
