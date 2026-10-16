// A browser that refuses the site its storage, end to end: the game shows its own screen — what happened and what
// to do, in the player's language — never a raw error. Two ways a browser refuses: the web storage switched off,
// and all cross-site data blocked while the game runs in another site's frame (as on itch.io).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/storage.mjs [shots-dir]
import { createServer } from 'node:http';
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2];
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}
const state = `JSON.stringify({ blocked: !!document.querySelector('.storage-blocked'), title: !!document.querySelector('.title-screen'), raw: !!document.querySelector('body > pre'), text: document.querySelector('.storage-blocked')?.textContent ?? '', links: [...document.querySelectorAll('.storage-blocked a')].map((a) => a.href) })`;

async function waitFor(evalIn, ms = 20000) {
  let s = null;
  for (let t = 0; t < ms; t += 250) {
    try {
      s = JSON.parse(await evalIn(state));
      if (s.blocked || s.title || s.raw) return s;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return s;
}

// 1. the web storage switched off in the browser, both languages
for (const [lang, words] of [['en', /does not let this site save anything/], ['uk', /не дає цьому сайту нічого зберігати/]]) {
  await withFirefox(async (page) => {
    await page.goto(`${BASE}?lang=${lang}`);
    const s = await waitFor((e) => page.eval(e));
    check(`${lang}: storage off → the game's own screen`, s?.blocked && !s.title && !s.raw, JSON.stringify(s));
    check(`${lang}: it says what happened in the player's language`, words.test(s?.text ?? ''), s?.text);
    check(`${lang}: it links to the game's own page and the downloads`, s?.links.some((h) => h.includes('github.io/teul')) && s?.links.some((h) => h.includes('/releases')), JSON.stringify(s?.links));
    await page.sleep(800);
    check(`${lang}: the loading screen has gone`, await page.eval(`(() => { return !document.getElementById("boot"); })()`));
    if (SHOTS) await page.shot(`${SHOTS}/storage-off-${lang}.png`);
  }, { prefs: { 'dom.storage.enabled': false } });
}

// another site to embed the game in: a page served from 127.0.0.1 while the game is on localhost (as itch.io's
// page embeds games from its own html domain)
const parent = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><body style="margin:0;background:#222"><iframe src="${BASE}?lang=en" style="position:absolute;left:20px;top:30px;width:960px;height:540px;border:0" allow="autoplay; fullscreen"></iframe></body>`);
});
await new Promise((r) => parent.listen(0, '127.0.0.1', r));
const PARENT = `http://127.0.0.1:${parent.address().port}/`;

// 2. all cross-site cookies and data blocked, the game in another site's frame (another site's page, as on itch.io)
await withFirefox(async (page) => {
  await page.viewport(1000, 600);
  await page.goto(PARENT);
  let frame;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = (await page.send('browsingContext.getTree', { root: page.context })).contexts[0].children?.[0]?.context;
    if (!frame) await page.sleep(250);
  }
  const evalIn = async (expression) => {
    const r = await page.send('script.evaluate', { expression, target: { context: frame }, awaitPromise: true, resultOwnership: 'none' });
    if (r.type === 'exception') throw new Error(r.exceptionDetails?.text);
    return r.result?.value;
  };
  const s = await waitFor(evalIn);
  check('cross-site frame, third-party data blocked → the game\'s own screen', s?.blocked && !s.title && !s.raw, JSON.stringify(s));
  check('it tells to allow the site that shows the game', /page you are playing on/.test(s?.text ?? ''), s?.text);
  await page.sleep(800);
  if (SHOTS) await page.shot(`${SHOTS}/storage-frame-en.png`);
}, { prefs: { 'network.cookie.cookieBehavior': 1, 'intl.accept_languages': 'en-US, en' } });

// 3. and with the default privacy settings the same frame starts the game as usual (third-party data partitioned)
await withFirefox(async (page) => {
  await page.goto(PARENT);
  let frame;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = (await page.send('browsingContext.getTree', { root: page.context })).contexts[0].children?.[0]?.context;
    if (!frame) await page.sleep(250);
  }
  const s = await waitFor(async (expression) => (await page.send('script.evaluate', { expression, target: { context: frame }, awaitPromise: true, resultOwnership: 'none' })).result?.value);
  check('cross-site frame, default privacy → the title screen', s?.title && !s.blocked && !s.raw, JSON.stringify(s));
}, { prefs: { 'network.cookie.cookieBehavior': 5, 'intl.accept_languages': 'en-US, en' } });

parent.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
