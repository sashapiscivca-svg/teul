import { setPlantClock } from './nppdates';
import basePack from '../../content/base/pack.json?raw';
import { isEnglish } from './i18n';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/tiny5/400.css';
import './style.css';
import { guardPictures } from './guard';
import { loadEngine } from './engine';
import { Game, weakDevice, type DebugOptions } from './game';
import { newIdSeed, newSecret, worldEpoch, type WorldMeta } from './storage';
import { Unreadable, backupHandlers, cannotOpen, daily, eraseEverything, openSealed, startingWorld } from './keeping';
import { APP_VERSION, SAVE_FORMAT, contentVersion, formatOf, migrateMeta } from './savefmt';
import { settleUpdate } from './update';
import { BackupSheet } from './ui/backup';
import { usePixelIcons } from './icons';
import { installPixelKit, pixelIconSvg } from './ui/pixelkit';
import { Loading, heroScreen, lookSettings } from './ui/screens';
import { titleScreen, SPLASHES, type SplashName } from './ui/splash/index';
import type { Look } from './ui/splash/town';
import { loadPrefs } from './prefs';
import { lookFromSettings, type PetLook } from './character';
import { wheelScrollsSideways } from './ui/dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

installPixelKit();
usePixelIcons(pixelIconSvg);
import { packOf } from './workshop/voxels';
import { t } from './i18n';

guardPictures();

function randomU32(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

function debugFromUrl(): DebugOptions {
  const q = new URLSearchParams(location.search);
  const debug: DebugOptions = {};
  const time = q.get('t');
  if (time && /^\d{1,2}:\d{2}$/.test(time)) {
    const [hh, mm] = time.split(':').map(Number);
    debug.minuteOfDay = hh * 60 + mm;
  }
  if (q.has('demo')) debug.demo = true;
  // a shifted clock is for the tests; a release build ignores it (no moving the world's time from a link)
  const shift = Number(q.get('shift'));
  if (import.meta.env.MODE !== 'production' && Number.isFinite(shift) && shift > 0) {
    debug.shift = Math.floor(shift);
    setPlantClock(debug.shift);
  }
  if (q.has('edit')) debug.edit = true;
  if (q.has('workshop')) debug.workshop = true;
  const theme = q.get('theme');
  if (theme) debug.theme = theme;
  const sheet = q.get('sheet');
  if (sheet === 'shop' || sheet === 'inventory' || sheet === 'room') debug.sheet = sheet;
  return debug;
}

async function spriteSheet(root: HTMLElement): Promise<void> {
  const { DEFAULT_LOOK, figureLayers, petLayers, DEFAULT_PET } = await import('./character');
  const looks = [
    DEFAULT_LOOK,
    { ...DEFAULT_LOOK, hairStyle: 3, hair: '#d86a3a', topStyle: 3, top: '#d86aa0', acc: 6, face: 2, skin: '#c98f65' },
    { ...DEFAULT_LOOK, hairStyle: 6, hair: '#3a5a8a', topStyle: 4, top: '#e8a23a', bottomStyle: 1, acc: 5, face: 1, skin: '#fbe0c8' },
    { ...DEFAULT_LOOK, hairStyle: 8, hair: '#1f1a26', topStyle: 5, top: '#5aa469', bottomStyle: 2, acc: 7, face: 3, skin: '#6e4630' },
    { ...DEFAULT_LOOK, hairStyle: 2, hair: '#e8d9a0', topStyle: 1, acc: 4, skin: '#e0a97c' },
    { ...DEFAULT_LOOK, hairStyle: 5, hair: '#9aa0b0', topStyle: 0, acc: 2, acc2: 0, skin: '#a06b47' },
    // a winter coat with a beanie, and a raincoat
    { ...DEFAULT_LOOK, hairStyle: 1, topStyle: 9, top: '#2f3a5a', top2: '#e8a23a', acc: 8, accColor: '#d9534f', shoeStyle: 1, shoes: '#5a3a28' },
    { ...DEFAULT_LOOK, hairStyle: 4, topStyle: 10, top: '#f4d35e', top2: '#2f3a5a', bottomStyle: 0, shoeStyle: 1, shoes: '#3a5a8a', acc: 0 },
  ];
  const c = document.getElementById('scene') as HTMLCanvasElement;
  c.style.display = 'none';
  const sheet = document.createElement('canvas');
  const S = 3;
  sheet.width = 32 * S * 12;
  sheet.height = 32 * S * (looks.length + 6);
  sheet.style.cssText = 'position:absolute;left:0;top:0;background:#8aa4c8;image-rendering:pixelated;z-index:99';
  root.append(sheet);
  const ctx = sheet.getContext('2d') as CanvasRenderingContext2D;
  const draw = (layers: { color: string; path: string }[], x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(S, S);
    for (const l of layers) {
      ctx.fillStyle = l.color;
      ctx.fill(new Path2D(l.path));
    }
    ctx.restore();
  };
  looks.forEach((look, row) => {
    const frames: [string, string, number][] = [['down', 'idle', 0], ['down', 'walk', 1], ['up', 'idle', 0], ['up', 'walk', 3], ['right', 'idle', 0], ['right', 'walk', 1], ['right', 'walk', 3], ['left', 'walk', 1], ['left', 'idle', 0], ['right', 'sit', 0], ['down', 'sit', 0], ['up', 'sit', 0]];
    frames.forEach(([dir, pose, f], i) => draw(figureLayers(look, dir as never, pose as never, f), i * 32 * S, row * 32 * S));
  });
  // how the townsfolk get about: a wheelchair (still, rolling), a pram, a walking stick — each way they face
  const { residentLayers } = await import('./mobility');
  const ways = [{ mobility: 'wheelchair' }, { pram: true }, { mobility: 'cane' }];
  ways.forEach((traits, k) => {
    (['down', 'right', 'up', 'left'] as const).forEach((dir, i) => {
      draw(residentLayers(looks[k + 1], dir, false, 0, traits, k), (i * 3) * 32 * S, (looks.length + k) * 32 * S);
      draw(residentLayers(looks[k + 1], dir, true, 1, traits, k), (i * 3 + 1) * 32 * S, (looks.length + k) * 32 * S);
    });
  });
  const r = (looks.length + 3) * 32 * S;
  const pets = [0, 1, 2].flatMap((kind) => [
    { kind, fur: ['#d98a3a', '#c9a050', '#e8e0d0'][kind], pattern: 1 },
    { kind, fur: ['#2e2a36', '#6a5a4a', '#8a8a96'][kind], pattern: 3 },
  ]);
  pets.forEach((pet, row) => {
    (['sit', 'walk', 'walk', 'walk', 'walk', 'sleep'] as const).forEach((pose, i) => draw(petLayers(pet, 'right', pose, i === 0 ? 0 : i - 1), (i + (row % 2) * 6) * 32 * S, r + Math.floor(row / 2) * 32 * S));
  });
}

async function itemSheet(root: HTMLElement): Promise<void> {
  const { loadEngine } = await import('./engine');
  const { drawItemThumbnail } = await import('./render');
  const engine = await loadEngine({ packs: [basePack], device: 1, seed: 1, epochUnixSecs: 0, events: [] });
  document.getElementById('scene')!.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;overflow:auto;background:#cfd8e8;display:flex;flex-wrap:wrap;gap:4px;padding:4px;z-index:99';
  root.append(wrap);
  for (const def of Object.values(engine.catalog.items)) {
    const cell = document.createElement('div');
    cell.style.cssText = 'width:110px;font:10px sans-serif;text-align:center;color:#223';
    const c = document.createElement('canvas');
    c.width = 220;
    c.height = 180;
    c.style.cssText = 'width:110px;height:90px;background:#e8eef8;border-radius:6px';
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    drawItemThumbnail(ctx, def, 110, 90);
    cell.append(c, def.id);
    wrap.append(cell);
  }
}

async function pixelSheet(root: HTMLElement): Promise<void> {
  const { loadEngine } = await import('./engine');
  const { drawPixelThumb } = await import('./pixel/items');
  const engine = await loadEngine({ packs: [basePack], device: 1, seed: 1, epochUnixSecs: 0, events: [] });
  document.getElementById('scene')!.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;overflow:auto;background:#2a2d45;display:flex;flex-wrap:wrap;gap:4px;padding:4px;z-index:99';
  root.append(wrap);
  for (const def of Object.values(engine.catalog.items)) {
    const c = document.createElement('canvas');
    c.width = 150;
    c.height = 120;
    c.style.cssText = 'width:150px;height:120px;background:#3a3f60;image-rendering:pixelated';
    drawPixelThumb(c.getContext('2d')!, def, 150, 120);
    const cell = document.createElement('div');
    cell.style.cssText = 'font:10px sans-serif;color:#ccd;text-align:center';
    cell.append(c, document.createElement('br'), def.id);
    wrap.append(cell);
  }
}

const loading = new Loading();

/** `?at=night:winter` shows the title in a given light and season (screenshots). */
function splashAt(v: string | null): Look | undefined {
  const [light, season] = (v ?? '').split(':');
  if (!['day', 'dusk', 'night'].includes(light) || !['spring', 'summer', 'autumn', 'winter'].includes(season)) return undefined;
  return { light, season } as Look;
}

async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  if (q.has('pxitems') || q.has('items') || q.has('chars')) loading.done();
  if (new URLSearchParams(location.search).has('pxitems')) {
    await pixelSheet(document.getElementById('app') as HTMLElement);
    return;
  }
  if (new URLSearchParams(location.search).has('items')) {
    await itemSheet(document.getElementById('app') as HTMLElement);
    return;
  }
  if (new URLSearchParams(location.search).has('chars')) {
    await spriteSheet(document.getElementById('app') as HTMLElement);
    return;
  }
  const step = document.querySelector('#boot .boot-step');
  if (step) step.textContent = t('main.loading');
  const root = document.getElementById('app') as HTMLElement;
  wheelScrollsSideways();
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  (document.querySelector('#rotate span') as HTMLElement).dataset.text = t('main.rotate');

  const debug = debugFromUrl();
  loading.step(t('main.fonts'), 0.1);
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  loading.step(t('main.saves'), 0.25);
  // The demo never touches saved data.
  // tests may keep a second world beside the first (never in a release build)
  const other = import.meta.env.MODE !== 'production' ? q.get('world')?.replace(/[^a-z0-9]/g, '') : '';
  // a test world that starts with enough coins to buy what a test needs (its own save, never in a release build)
  const rich = import.meta.env.MODE !== 'production' && q.has('rich');
  const base = rich ? basePack.replace('"start_coins": 300', '"start_coins": 6000') : basePack;
  // a new build lets go of anything an older one cached (never a mix of old and new files)
  await settleUpdate();
  const storeName = debug.demo ? 'teul-demo' : startingWorld(rich ? 'rich' : other || null);
  // the save and the web storage are sealed with the device's data key (a plain save from an
  // older version is sealed now); a save that cannot be opened here is never written over
  let opened;
  try {
    opened = await openSealed(storeName, !!debug.demo);
  } catch (err) {
    if (!(err instanceof Unreadable)) throw err;
    loading.done();
    cannotOpen(root, 'unreadable');
    return;
  }
  const store = opened.store;
  let meta = await store.loadMeta();
  if (!meta) {
    const fresh: WorldMeta = { device: randomU32(), seed: randomU32(), epochUnixSecs: worldEpoch(new Date()), format: SAVE_FORMAT };
    await store.saveMeta(fresh);
    meta = fresh;
  }
  // a save from a newer version waits for an update; an older one is brought up to this format
  if (formatOf(meta) > SAVE_FORMAT) {
    loading.done();
    cannotOpen(root, 'too-new', formatOf(meta));
    return;
  }
  {
    const up = { ...migrateMeta(meta), content: contentVersion([base]), app: APP_VERSION };
    if (JSON.stringify(up) !== JSON.stringify(meta)) {
      meta = up;
      await store.saveMeta(meta);
    }
  }
  // the device's chain secret: a save from before the chain gets one now (its old events stay trusted as they are)
  if (meta.secret === undefined) {
    meta = { ...meta, secret: newSecret() };
    await store.saveMeta(meta);
  }
  // the world's own key (it names the world's backups and its sealed web storage): an older save gets one now
  if (meta.idSeed === undefined) {
    meta = { ...meta, idSeed: newIdSeed() };
    await store.saveMeta(meta);
  }
  // the latest snapshot and only the events after it (the whole log only when there is none, or it does not verify)
  performance.mark('teul:store');
  const snapshot = await store.loadSnapshot();
  const events = snapshot ? await store.loadEventsAfter(snapshot.through) : await store.loadEvents();
  const covered = snapshot ? await store.countThrough(snapshot.through) : undefined;
  const fromLog = { events, snapshot: snapshot?.json, covered, fullEvents: () => store.loadEvents() };
  const userItems = await store.loadUserItems();
  const packs = userItems.length > 0 ? [base, packOf(userItems)] : [base];
  loading.step(t('main.waking'), 0.45);
  performance.mark('teul:log');
  // the world's own words in English: an overlay on the pack's text (never on what happens)
  const text = isEnglish() ? (await import('../../content/base/en.json?raw')).default : undefined;
  let engine;
  try {
    engine = await loadEngine({ packs, ...meta, ...fromLog, text });
  } catch (err) {
    if (packs.length === 1) throw err;
    // The player's own items could not be loaded; the world still opens with the base content.
    console.error(err);
    engine = await loadEngine({ packs: [base], ...meta, ...fromLog, text });
  }
  loading.step(t('main.town'), 0.8);
  performance.mark('teul:engine');
  // the town's week is simulated once at the start (the slowest single call): here, under the loading bar,
  // rather than in the first frame (its answer is kept, and the next minutes go on from it)
  if (engine.catalog.sites) engine.life();
  performance.mark('teul:town');
  const firstRun = events.length === 0 && !snapshot;
  const game = new Game({ root, canvas, engine, store, debug, firstRun, packs: [base], userItems });
  // «Резервна копія» in the settings, and today's automatic copy (a while after the start, off the first frames)
  let sheet: BackupSheet | null = null;
  if (!debug.demo) {
    const keeping = { opened, meta, flush: () => game.saveNow() };
    const backup = new BackupSheet(root, backupHandlers(keeping));
    sheet = backup;
    game.settingsAction(t('backup.title'), () => {
      game.closeSettings();
      backup.open();
    });
    game.settingsAction(t('account.erase'), () => {
      game.closeSettings();
      game.askErase(async () => {
        await eraseEverything(store);
        location.reload();
      }, () => {
        game.closeSettings();
        backup.open();
      });
    });
    window.setTimeout(() => void daily(keeping), 20_000);
    window.setInterval(() => void daily(keeping), 3_600_000);
  }
  // the phone's back button, Escape and a mouse's back button close the backup sheet first
  const back = () => (sheet?.isOpen() ? sheet.close() : game.back());
  if (Capacitor.isNativePlatform()) void App.addListener('backButton', back);
  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) back();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && sheet?.isOpen()) {
      e.stopImmediatePropagation();
      sheet.close();
    }
  }, true);
  loading.step(t('main.ready'), 1);
  loading.done();
  // the title, then (only the first time) the hero, then straight into the room; the demo and `?skip` go right in
  let hero: [string, string][] | undefined;
  let first: { name: string; pet: PetLook } | undefined;
  if (!debug.demo && !q.has('skip')) {
    const saved = firstRun ? null : lookFromSettings(engine.room().settings);
    const prefs = loadPrefs();
    const asked = q.get('splash') as SplashName | null;
    const splash = asked && SPLASHES.some(([n]) => n === asked) ? asked : prefs.splash;
    await titleScreen(root, { look: saved, splash, volume: prefs.master * prefs.effects, lowPower: prefs.quality === 'low' || (prefs.quality === 'auto' && weakDevice() >= 2), at: splashAt(q.get('at')), onSettings: () => game.openSettings() });
    if (firstRun) {
      const chosen = await heroScreen(root);
      hero = lookSettings(chosen.look);
      first = { name: chosen.name, pet: chosen.pet };
    }
  }
  performance.mark('teul:game');
  game.start(firstRun, hero, first);
  performance.mark('teul:started');
  // the debug hook is for tests and development only: a release build has no way in from the console
  if (q.has('debug') && import.meta.env.MODE !== 'production') (window as unknown as { __teul: unknown }).__teul = { game, engine, thumb: (...a: Parameters<typeof import('./pixel/items').drawPixelThumb>) => import('./pixel/items').then((m) => m.drawPixelThumb(...a)), sprite: (...a: Parameters<typeof import('./pixel/items').itemSprite>) => import('./pixel/items').then((m) => m.itemSprite(...a)) };
}

main().catch((err) => {
  console.error(err);
  loading.done();
  document.body.append(Object.assign(document.createElement('pre'), { textContent: String(err), style: 'color:#e8788c;padding:16px;white-space:pre-wrap' }));
});
