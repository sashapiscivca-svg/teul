// The world in English: with English chosen no Ukrainian is left on the main screens (the title, the hero, the
// HUD and its menu, the paper, the notebook, the shop, a talk in town, the taxi), and choosing the language in the
// settings is remembered. Usage: npm run build:e2e, vite preview, BASE=http://localhost:4173/ node e2e/lang.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? '';
const nowLocal = new Date();
// midday in town (people are out, shops are open)
const SHIFT = (((12 * 60 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

/** Every Ukrainian word a player could see or hear from a screen reader: visible text and the labels of visible things. */
const LEFTOVERS = `(() => {
  const CYR = /[А-Яа-яЄєІіЇїҐґ]/;
  const shown = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (CYR.test(n.textContent) && shown(n.parentElement)) out.push(n.textContent.trim().slice(0, 80));
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    if (!shown(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(a);
      if (v && CYR.test(v)) out.push('@' + a + ': ' + v.slice(0, 80));
    }
  }
  return JSON.stringify([...new Set(out)]);
})()`;

await withFirefox(async (page) => {
  const g = (js) => page.eval(`(() => { const g = window.__teul.game; const e = window.__teul.engine; return ${js}; })()`);
  const left = async () => JSON.parse(await page.eval(LEFTOVERS));
  const english = async (name) => {
    const l = await left();
    check(`${name}: no Ukrainian left`, l.length === 0, JSON.stringify(l.slice(0, 12)));
    if (SHOTS) await page.shot(`${SHOTS}/lang-${name.replace(/\W+/g, '-')}.png`);
  };
  const click = (selector) => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const started = async () => {
    for (let i = 0; i < 160 && !(await page.eval('!!(window.__teul && window.__teul.game && window.__teul.game.started)')); i++) await page.sleep(250);
    await page.sleep(1200);
  };

  // ---- a device that speaks English: the first run is in English
  await page.goto(`${BASE}?debug&lang=en&world=langen&shift=${SHIFT}`);
  for (let i = 0; i < 80 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await page.sleep(500);
  check('the page says it is English', (await page.eval('document.documentElement.lang')) === 'en');
  check('the title offers to start in English', /start|begin|new/i.test(await page.eval("document.querySelector('.title-screen .screen-go')?.textContent ?? ''")));
  await english('title');
  await click('.title-screen .screen-go');
  for (let i = 0; i < 40 && !(await page.eval("!!document.querySelector('.hero-screen')")); i++) await page.sleep(200);
  await page.sleep(400);
  check('the hero is made in English', await page.eval("!!document.querySelector('.hero-screen')"));
  await english('hero creator');
  // every tab of the hero creator
  const tabs = await page.eval("document.querySelectorAll('.hero-tabs .tab').length");
  for (let i = 0; i < tabs; i++) {
    await page.eval(`document.querySelectorAll('.hero-tabs .tab')[${i}].click()`);
    await page.sleep(150);
  }
  await english('hero creator tabs');
  await click('.hero-go');
  await started();
  // a first meeting may ask who one is: answer it if it is there
  await page.sleep(800);
  await english('the room');

  // the paper of the morning
  await g('(g.morningPaper(true), 0)');
  await page.sleep(600);
  check('the paper is open', await page.eval("document.querySelector('.paper')?.style.display === ''"));
  check('the paper has an English masthead', /Lypove/.test(await page.eval("document.querySelector('.paper-mast h1')?.textContent ?? ''")));
  await english('paper');
  await click('.paper-close');
  await page.sleep(300);

  // the HUD and its menu
  await click('.hud-menu-btn');
  await page.sleep(300);
  await english('HUD menu');
  await click('.hud-journal');
  await page.sleep(500);
  await english('notebook');
  for (let i = 0; i < 3; i++) {
    await page.eval(`(() => { const t = document.querySelectorAll('.journal .tab, .journal-tabs .tab')[${i}]; if (t) t.click(); })()`);
    await page.sleep(200);
  }
  await english('notebook tabs');
  await page.eval("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await g('(g.closeSheets ? g.closeSheets() : 0, 0)');
  await page.eval("document.querySelectorAll('.settings .round, .sheet .round').forEach((b) => { if (b.offsetParent && /close|×|✕/i.test(b.getAttribute('aria-label') ?? b.textContent)) b.click(); })");
  await page.sleep(300);

  // the shop
  await click('.hud-menu-btn');
  await page.sleep(200);
  await page.eval("[...document.querySelectorAll('.hud-menu .tile')].find((b) => /^shop$/i.test(b.getAttribute('aria-label') ?? ''))?.click()");
  await page.sleep(500);
  check('the shop opens', JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())')).sheet === true);
  await english('shop');
  await page.eval("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))");
  await page.sleep(300);

  // town: someone to talk to, then the taxi
  await g("(g.debugGo('village'), 0)");
  await page.sleep(1500);
  await english('town');
  const s = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())'));
  const someone = s.npcs.find((n) => n.shown) ?? s.npcs[0];
  await g(`(g.debugTalk(${JSON.stringify(someone.id)}), 0)`);
  for (let i = 0; i < 40 && !JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())')).dialogue; i++) await page.sleep(200);
  await page.sleep(1500);
  const dlg = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())')).dialogue;
  check('a talk in town is in English', typeof dlg === 'string' && dlg.length > 3 && !/[А-Яа-яЄєІіЇїҐґ]/.test(dlg), String(dlg));
  await english('dialog');
  await g('(g.debugGo("village"), 0)');
  await page.sleep(800);
  await click('.hud-taxi');
  await page.sleep(400);
  check('the taxi opens', await page.eval('window.__teul.game.taxi.isOpen()'));
  await english('taxi');
  await page.eval('window.__teul.game.taxi.close()');

  // the maps: found by English words, a place card with its hours and the way there
  await g('(g.mapsSheet.open(), 0)');
  await page.sleep(700);
  await page.eval("(() => { const i = document.querySelector('.maps-input'); i.value = 'cinema'; i.dispatchEvent(new Event('input')); })()");
  await page.sleep(300);
  check('the maps find a place by an English word', await page.eval(`!!document.querySelector('.maps-result[data-key="site:cinema_site"]')`));
  await english('maps search');
  await click('.maps-result[data-key="site:cinema_site"]');
  await page.sleep(300);
  check('the place card speaks English', /Open now|Closed/.test(await page.eval("document.querySelector('.maps-hours')?.textContent ?? ''")));
  await click('.maps-go');
  await page.sleep(500);
  await english('maps card');
  await g('(g.mapsSheet.close(), 0)');

  // the backup sheet
  await page.eval('window.__teul.game.openSettings()');
  await page.sleep(300);
  check('the settings offer a backup', await page.eval("(() => { const r = [...document.querySelectorAll('.settings .row')].find((x) => x.textContent.includes('Backup')); r?.querySelector('button')?.click(); return !!r; })()"));
  await page.sleep(400);
  await english('backup');
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))");
  await page.sleep(200);

  // ---- choosing Ukrainian in the settings is remembered across a reload
  await page.goto(`${BASE}?debug&skip&world=langchoice&shift=${SHIFT}`);
  await started();
  await page.eval("localStorage.setItem('teul.lang', 'en')");
  await page.goto(`${BASE}?debug&skip&world=langchoice&shift=${SHIFT}`);
  await started();
  check('a language chosen before is kept after a reload', (await page.eval('document.documentElement.lang')) === 'en');
  await english('after a reload');
  await page.eval("localStorage.setItem('teul.lang', 'uk')");
  await page.goto(`${BASE}?debug&skip&world=langchoice&shift=${SHIFT}`);
  await started();
  check('Ukrainian comes back when chosen', (await page.eval('document.documentElement.lang')) === 'uk');
  check('in Ukrainian the menu is Ukrainian', /Меню/.test(await page.eval("document.querySelector('.hud-menu-btn')?.getAttribute('aria-label') ?? ''")));
  await page.eval("localStorage.removeItem('teul.lang')");

  const errors = page.errors();
  check('no console errors', errors.length === 0, JSON.stringify(errors));
});

if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all lang checks passed');
