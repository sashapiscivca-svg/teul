#!/usr/bin/env node
// Installs the debug APK on a running emulator/device and checks the game through the WebView's DevTools.
// Usage: node scripts/android-smoke.mjs [--apk path] [--shots dir]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const apk = args.apk ?? 'app/android/app/build/outputs/apk/debug/app-debug.apk';
const shots = args.shots ?? '/tmp/shots';
const PKG = 'com.teul.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' }).trim();
const adbRaw = (...a) => execFileSync('adb', a, { maxBuffer: 64 * 1024 * 1024 });

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

if (!existsSync(apk)) {
  console.error(`APK not found: ${apk}. Run scripts/build-apk.sh first.`);
  process.exit(2);
}
mkdirSync(shots, { recursive: true });
const screenshot = (name) => writeFileSync(path.join(shots, name), adbRaw('exec-out', 'screencap', '-p'));

async function attach() {
  let pid = '';
  for (let i = 0; i < 40 && !pid; i++) {
    try {
      pid = adb('shell', 'pidof', PKG);
    } catch {
      /* not started yet */
    }
    if (!pid) await sleep(500);
  }
  if (!pid) throw new Error('the app did not start');
  let socket = '';
  for (let i = 0; i < 40 && !socket; i++) {
    const unix = adb('shell', 'cat', '/proc/net/unix');
    socket = (unix.match(new RegExp(`webview_devtools_remote_${pid.split(' ')[0]}`)) ?? [''])[0];
    if (!socket) await sleep(500);
  }
  if (!socket) throw new Error('no WebView DevTools socket (is the build debuggable?)');
  const port = 9400 + Math.floor(Math.random() * 400);
  adb('forward', `tcp:${port}`, `localabstract:${socket}`);
  let targets = [];
  for (let i = 0; i < 40 && targets.length === 0; i++) {
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page');
    } catch {
      /* retry */
    }
    if (targets.length === 0) await sleep(500);
  }
  if (targets.length === 0) throw new Error('no page target');
  const ws = await new Promise((resolve, reject) => {
    const s = new WebSocket(targets[0].webSocketDebuggerUrl);
    s.onopen = () => resolve(s);
    s.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description ?? ''));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  const send = (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  return {
    errors,
    url: targets[0].url,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async navigate(url) {
      await send('Page.navigate', { url });
      await sleep(2500);
      for (let i = 0; i < 30; i++) {
        const ready = await send('Runtime.evaluate', { expression: '!!window.__teul', returnByValue: true }).catch(() => null);
        if (ready?.result?.value) break;
        await sleep(1000);
      }
    },
    close: () => ws.close(),
  };
}

try {
  check('a device is connected', /device$/m.test(adb('devices').split('\n').slice(1).join('\n')), adb('devices'));
  adb('shell', 'am', 'force-stop', PKG);
  try {
    adb('uninstall', PKG);
  } catch {
    /* not installed yet */
  }
  adb('shell', 'wm', 'dismiss-keyguard');
  check('the APK installs', /Success/.test(adb('install', '-r', apk)));
  const size = adbRaw('shell', 'wm', 'size').toString().trim();
  console.log(`      screen: ${size}`);

  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(3500);
  // Android shows a one-time "Viewing full screen" notice over immersive apps; press its button like a person would
  for (let i = 0; i < 3; i++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
      const xml = adb('shell', 'cat', '/sdcard/ui.xml');
      const m = xml.match(/text="(Got it|Зрозуміло|OK|Wait|Зачекати)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!m) break;
      adb('shell', 'input', 'tap', String((Number(m[2]) + Number(m[4])) >> 1), String((Number(m[3]) + Number(m[5])) >> 1));
      await sleep(800);
    } catch {
      break;
    }
  }
  // let the first launch finish saving its starter room before the page is reloaded with the test hooks
  await sleep(3000);
  let page = await attach();
  await page.navigate('https://localhost/?debug');
  const state = async () => JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())'));
  let s = await state();
  check('the game starts on the device', s.mode === 'walk');
  check('the whole house is placed', s.placements.length > 40, JSON.stringify(s.placements.length));
  check('start coins after the starter purchases', s.coins === 200, String(s.coins));
  check('storage is IndexedDB inside the WebView', s.storage === 'indexeddb', s.storage);
  const orientation = await page.eval('JSON.stringify([innerWidth, innerHeight])');
  const [iw, ih] = JSON.parse(orientation);
  check('the window is landscape', iw > ih, orientation);
  await sleep(500);
  screenshot('android-1-start.png');

  await page.eval('window.__teul.game.debugTeleport(2.4, 1.5)');
  await sleep(300);
  const coins0 = (await state()).coins;
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))");
  await sleep(400);
  s = await state();
  check('an action pays coins on the device', s.coins === coins0 + 25, `${coins0} -> ${s.coins}`);
  screenshot('android-2-action.png');

  // the real touch path: tap the shop button with adb
  const rect = JSON.parse(await page.eval(`JSON.stringify((() => { const r = document.querySelector('.hud-tr button[aria-label="Магазин"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, dpr: devicePixelRatio, w: innerWidth, h: innerHeight }; })())`));
  const wmSize = size.match(/(\d+)x(\d+)/);
  const physW = Math.max(Number(wmSize[1]), Number(wmSize[2]));
  const physH = Math.min(Number(wmSize[1]), Number(wmSize[2]));
  adb('shell', 'input', 'tap', String(Math.round((rect.x / rect.w) * physW)), String(Math.round((rect.y / rect.h) * physH)));
  await sleep(600);
  check('a real touch opens the shop', (await state()).sheet === true);
  screenshot('android-3-shop.png');
  await page.eval("document.querySelector('.sheet button[aria-label=\"Готово\"]').click()");

  // the studio by real touch: open the editor, switch to the look tab, and measure the frame rate
  const tapEl = async (selector) => {
    const r = JSON.parse(await page.eval(`JSON.stringify((() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: innerWidth, h: innerHeight }; })())`));
    adb('shell', 'input', 'tap', String(Math.round((r.x / r.w) * physW)), String(Math.round((r.y / r.h) * physH)));
    await sleep(500);
  };
  await tapEl('.hud-tr button[aria-label="Кімната"]');
  {
    const st = await state();
    check('a real touch opens the editor', st.mode === 'edit', JSON.stringify({ mode: st.mode, sheet: st.sheet }));
  }
  await tapEl('.modes button[aria-label="Образ"]');
  await sleep(1500);
  screenshot('android-3b-look.png');
  const measure = () => page.eval(`new Promise((resolve) => { const g = window.__teul.game; const f0 = g.frames; const p0 = g.debugProfile(); setTimeout(() => { const p1 = g.debugProfile(); const d = {}; for (const k in p1) d[k] = Math.round(p1[k] - (p0[k] || 0)); console.log('profile', JSON.stringify(d)); window.__lastProfile = JSON.stringify(d); resolve(Math.round((g.frames - f0) / 3)); }, 3000); })`);
  await sleep(6000); // the quality ladder settles on slow devices
  const fps = await measure();
  console.log(`      frames drawn per second in the look editor: ${fps}  profile(ms/3s): ${await page.eval('window.__lastProfile')}`);
  check('the editor draws a usable number of frames', fps >= 5, String(fps));
  await tapEl('.modes button[aria-label="Світ"]');
  screenshot('android-3c-world.png');
  await tapEl('.edit-bar .tools .round.done');
  check('done returns to walking', (await state()).mode === 'walk');
  await page.eval("window.__teul.game.debugTeleport(3.5, 4.5)");
  const fpsWalk = await measure();
  console.log(`      frames drawn per second standing in the room: ${fpsWalk}`);

  // the village: out through the front door, people about, a talk
  await page.eval('window.__teul.game.debugTeleport(0.5, 7.5)');
  await sleep(400);
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))");
  await sleep(300);
  await page.eval("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))");
  await sleep(1500);
  let v = await state();
  check('the front door leads to the village', v.location === 'village', v.location);
  screenshot('android-5-village.png');
  await page.eval('window.__teul.game.debugTeleport(28.5, 22.5)');
  await sleep(1200);
  screenshot('android-6-square.png');
  const fpsVillage = await measure();
  console.log(`      frames drawn per second in the village: ${fpsVillage}  profile(ms/3s): ${await page.eval('window.__lastProfile')}`);
  check('the village draws a usable number of frames', fpsVillage >= 5, String(fpsVillage));
  const out = v.npcs.find((n) => n.shown) ?? v.npcs[0];
  await page.eval(`window.__teul.game.debugTalk('${out.id}')`);
  await sleep(2500);
  v = await state();
  check('talking to someone opens a dialogue', !!v.dialogue, String(v.dialogue));
  screenshot('android-7-dialogue.png');
  await page.eval("window.__teul.game.debugTeleport(53.5, 40.5)");
  await sleep(1500);
  check('the lake can be swum in', (await page.eval('window.__teul.game.debugState().walker.y')) > 40);
  screenshot('android-8-swim.png');
  await page.eval("window.__teul.game.debugTeleport(20.5, 1.5)");
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))");
  await sleep(900);
  await page.eval("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))");
  await sleep(1500);
  check('the way north leads into the forest', (await state()).location === 'forest');
  screenshot('android-9-forest.png');
  await page.eval("window.__teul.game.debugGo('home')");
  await sleep(800);

  const saved = await state();
  page.close();
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(800);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(3500);
  page = await attach();
  await page.navigate('https://localhost/?debug');
  const again = await state();
  check('the room survives a force-stop', again.placements.length === saved.placements.length, `${saved.placements.length} vs ${again.placements.length}`);
  check('the wallet survives a force-stop', again.coins === saved.coins, `${saved.coins} vs ${again.coins}`);
  screenshot('android-4-restart.png');
  const ours = page.errors.filter((e) => !/safe area CSS/.test(e)); // Capacitor's own inset script, not the game
  check('no JavaScript errors in the WebView', ours.length === 0, JSON.stringify(ours).slice(0, 400));
  page.close();
} catch (e) {
  console.error('smoke test error:', e.message);
  failed++;
}
console.log(failed === 0 ? '\nANDROID SMOKE PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
