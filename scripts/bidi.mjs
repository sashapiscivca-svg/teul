// Minimal WebDriver BiDi client for headless Firefox, enough to drive and screenshot the app.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withFirefox(fn, { width = 844, height = 390, prefs = {} } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(path.join(tmpdir(), 'ffbidi-'));
  // a throwaway profile for the tests: the system may ask Firefox to resist fingerprinting, which poisons every
  // read of a canvas (photos come out as stripes); plus any extra preferences of a test (e.g. autoplay for the sound tests)
  // the device speaks Ukrainian unless a test says otherwise (the language follows the device on first run)
  prefs = { 'intl.accept_languages': 'uk-UA, uk', ...prefs };
  const lines = ['user_pref("privacy.resistFingerprinting", false);', 'user_pref("privacy.fingerprintingProtection", false);', ...Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`)];
  writeFileSync(path.join(profile, 'user.js'), lines.join('\n') + '\n');
  const ff = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port)], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 80 && !ws; i++) {
    try {
      ws = await new Promise((resolve, reject) => {
        const s = new WebSocket(`ws://127.0.0.1:${port}/session`);
        s.onopen = () => resolve(s);
        s.onerror = reject;
      });
    } catch {
      await sleep(250);
    }
  }
  if (!ws) {
    ff.kill();
    throw new Error('could not connect to Firefox');
  }
  let seq = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(`${msg.error}: ${msg.message}`));
      else p.resolve(msg.result);
    } else if (msg.method === 'log.entryAdded') {
      logs.push({ level: msg.params.level, text: msg.params.text });
    }
  };
  const send = (method, params = {}) => {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const first = (await send('browsingContext.getTree', {})).contexts[0].context;
  const makePage = (context) => ({
    logs,
    sleep,
    async viewport(w, h) {
      await send('browsingContext.setViewport', { context, viewport: { width: w, height: h }, devicePixelRatio: 1 });
    },
    async goto(url) {
      await send('browsingContext.navigate', { context, url, wait: 'complete' });
    },
    async eval(expression) {
      const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true, resultOwnership: 'none' });
      if (r.type === 'exception') throw new Error(`page exception: ${r.exceptionDetails?.text}`);
      return r.result?.value;
    },
    /** Real input (a pointer that presses, moves and lets go; keys): what a person does, not a script's click. */
    async act(actions) {
      await send('input.performActions', { context, actions });
      await send('input.releaseActions', { context });
    },
    /** A press and release at a point of the page (CSS pixels), with a mouse or a finger. */
    async tap(x, y, pointerType = 'mouse') {
      await this.act([{ type: 'pointer', id: 'p1', parameters: { pointerType }, actions: [
        { type: 'pointerMove', x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 40 }, { type: 'pointerUp', button: 0 }] }]);
    },
    /** A drag from one point to another in steps (as a hand moves), with a mouse or a finger. */
    async drag(x0, y0, x1, y1, pointerType = 'mouse', steps = 12) {
      const moves = [];
      for (let i = 1; i <= steps; i++) moves.push({ type: 'pointerMove', x: Math.round(x0 + ((x1 - x0) * i) / steps), y: Math.round(y0 + ((y1 - y0) * i) / steps), duration: 16 });
      await this.act([{ type: 'pointer', id: 'p1', parameters: { pointerType }, actions: [
        { type: 'pointerMove', x: Math.round(x0), y: Math.round(y0) }, { type: 'pointerDown', button: 0 }, ...moves, { type: 'pointerUp', button: 0 }] }]);
    },
    async shot(file) {
      const s = await send('browsingContext.captureScreenshot', { context });
      writeFileSync(file, Buffer.from(s.data, 'base64'));
    },
    errors() {
      return logs.filter((l) => l.level === 'error' && !/typekit|downloadable font/i.test(l.text));
    },
    /** Brings this tab to the front (a background tab draws nothing). */
    async activate() {
      await send('browsingContext.activate', { context });
    },
    /** A second tab in the same browser (two worlds side by side). */
    async newPage() {
      const { context: c } = await send('browsingContext.create', { type: 'tab' });
      const p = makePage(c);
      await p.viewport(width, height);
      return p;
    },
  });
  const page = makePage(first);
  await page.viewport(width, height);
  try {
    return await fn(page);
  } finally {
    ws.close();
    // the temporary Firefox profile is large: wait for Firefox to let go of it, then remove it before returning,
    // so a caller that exits right away does not leave it behind
    const gone = new Promise((resolve) => (ff.exitCode !== null ? resolve() : ff.once('exit', resolve)));
    ff.kill();
    await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 3000))]);
    rmSync(profile, { recursive: true, force: true });
  }
}
