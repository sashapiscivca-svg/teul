import { describe, expect, it } from 'vitest';
import { forgetOwn } from '../src/keeping';
import { BUILD, appBase, ownCache, ownKey, ownScope, settleUpdate } from '../src/update';

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(entries));
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

/** itch.io serves every HTML game from one origin, each in its own folder. */
const ITCH = 'https://html-classic.itch.zone/html/1234567/';
const OTHER = 'https://html-classic.itch.zone/html/7654321/';

function sharedOrigin() {
  const unregistered: string[] = [];
  const deleted: string[] = [];
  const reg = (scope: string) => ({ scope, unregister: async () => (unregistered.push(scope), true) }) as unknown as ServiceWorkerRegistration;
  const serviceWorker = { getRegistrations: async () => [reg(ITCH), reg(`${ITCH}sub/`), reg(OTHER), reg('https://html-classic.itch.zone/')] };
  const names = ['teul-old-build', 'teul', 'other-game-v3', 'workbox-precache-v2-https://html-classic.itch.zone/html/7654321/'];
  const caches = { keys: async () => names, delete: async (n: string) => (deleted.push(n), true) };
  return { serviceWorker, caches, unregistered, deleted };
}

describe('update clean-up on a shared origin (itch.io)', () => {
  it('knows the game folder from the page address', () => {
    expect(appBase(`${ITCH}index.html?x=1`)).toBe(ITCH);
    expect(appBase('https://sashapiscivca-svg.github.io/teul/')).toBe('https://sashapiscivca-svg.github.io/teul/');
    expect(appBase('not a url')).toBe('');
  });

  it('tells the game\'s own from the neighbours\'', () => {
    expect(ownScope(`${ITCH}`, ITCH)).toBe(true);
    expect(ownScope(OTHER, ITCH)).toBe(false);
    expect(ownScope('https://html-classic.itch.zone/', ITCH)).toBe(false);
    expect(ownScope(ITCH, '')).toBe(false);
    expect(ownCache('teul-anything')).toBe(true);
    expect(ownCache('other-game-v3')).toBe(false);
    for (const k of ['teul.build', 'teul.prefs', 'teul.sealed:x', 'w0a1b2c3d.paper', 'w.notes']) expect(ownKey(k)).toBe(true);
    for (const k of ['save', 'game1.progress', 'walrus.x', 'wonder', 'unity.player']) expect(ownKey(k)).toBe(false);
  });

  it('on a new build lets go only of its own service workers and caches', async () => {
    const env = sharedOrigin();
    const web = memoryStorage({ 'teul.build': 'older' });
    expect(await settleUpdate(web, { serviceWorker: env.serviceWorker, caches: env.caches, base: ITCH })).toBe(true);
    expect(env.unregistered.sort()).toEqual([ITCH, `${ITCH}sub/`].sort());
    expect(env.deleted.sort()).toEqual(['teul', 'teul-old-build']);
    expect(web.getItem('teul.build')).toBe(BUILD);
  });

  it('does nothing on a launch of the same build', async () => {
    const env = sharedOrigin();
    const web = memoryStorage({ 'teul.build': BUILD });
    expect(await settleUpdate(web, { serviceWorker: env.serviceWorker, caches: env.caches, base: ITCH })).toBe(false);
    expect(env.unregistered).toEqual([]);
    expect(env.deleted).toEqual([]);
  });

  it('with an unknown folder touches no service worker', async () => {
    const env = sharedOrigin();
    await settleUpdate(memoryStorage(), { serviceWorker: env.serviceWorker, caches: env.caches, base: '' });
    expect(env.unregistered).toEqual([]);
  });

  it('"Delete account" forgets only the game\'s entries of the web storage', () => {
    const st = memoryStorage({ 'teul.prefs': '{}', 'teul.worlds': '[]', 'w0a1b2c3d.paper': '1', 'other-game.save': 'keep', 'highscore': '42' });
    forgetOwn(st);
    expect([...Array(st.length).keys()].map((i) => st.key(i)).sort()).toEqual(['highscore', 'other-game.save']);
  });
});
