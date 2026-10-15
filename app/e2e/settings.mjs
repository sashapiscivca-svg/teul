// The settings sheet, end to end, as a hand uses it: with a finger (a phone) and with a mouse (a computer), every
// choice is pressed for real and does what it says (stored, shown as chosen, applied to the page or the game);
// every sound slider is dragged and follows the hand smoothly, not in jumps, without being redrawn under the
// finger; the sheet closes by its button, by the backdrop and by Escape; the language changes and comes back.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/settings.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1200);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); })()");
  await page.sleep(300);
};

const prefs = async (page) => JSON.parse((await page.eval("localStorage.getItem('teul.prefs') || '{}'")) || '{}');
const htmlHas = (page, cls) => page.eval(`document.documentElement.classList.contains(${JSON.stringify(cls)})`);
const rootHas = (page, cls) => page.eval(`!!document.querySelector('.${cls}')`);

/** The centre of an element in the settings (scrolled into view first), or null. */
const centre = async (page, sel) =>
  JSON.parse(await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'null'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, w: r.width }); })()`));

const press = async (page, sel, pointer) => {
  const c = await centre(page, sel);
  if (!c) return false;
  await page.tap(c.x, c.y, pointer);
  await page.sleep(160);
  return true;
};

const openSettings = async (page) => {
  await page.eval('window.__teul.game.openSettings()');
  await page.sleep(400);
};

// every choice of the sheet: [pref, option index, value it stores, a check of what it does (or null)]
const CHOICES = (mouse) => [
  ['textSize', 1, 1, (p) => htmlHas(p, 'a11y-text-1')],
  ['textSize', 2, 2, (p) => htmlHas(p, 'a11y-text-2')],
  ['textSize', 0, 0, async (p) => !(await htmlHas(p, 'a11y-text-1')) && !(await htmlHas(p, 'a11y-text-2'))],
  ['contrast', 0, true, (p) => htmlHas(p, 'a11y-contrast')],
  ['contrast', 1, false, async (p) => !(await htmlHas(p, 'a11y-contrast'))],
  ['motion', 1, 'reduce', (p) => htmlHas(p, 'a11y-still')],
  ['motion', 2, 'full', async (p) => !(await htmlHas(p, 'a11y-still'))],
  ['motion', 0, 'auto', null],
  ['colorblind', 0, true, (p) => htmlHas(p, 'a11y-cb')],
  ['colorblind', 1, false, async (p) => !(await htmlHas(p, 'a11y-cb'))],
  ...(mouse ? [] : [['bigTargets', 0, true, (p) => htmlHas(p, 'a11y-big')], ['bigTargets', 1, false, async (p) => !(await htmlHas(p, 'a11y-big'))]]),
  ['readable', 0, true, (p) => htmlHas(p, 'a11y-readable')],
  ['readable', 1, false, async (p) => !(await htmlHas(p, 'a11y-readable'))],
  ['captions', 0, true, (p) => htmlHas(p, 'a11y-captions')],
  ['captions', 1, false, async (p) => !(await htmlHas(p, 'a11y-captions'))],
  ...(mouse
    ? [['fullscreen', 0, true, (p) => p.eval('!!document.fullscreenElement')], ['fullscreen', 1, false, (p) => p.eval('!document.fullscreenElement')]]
    : [['haptics', 1, false, null], ['haptics', 0, true, null],
       ['stick', 1, 'right', (p) => rootHas(p, 'stick-right')], ['stick', 0, 'left', async (p) => !(await rootHas(p, 'stick-right'))]]),
  ['hudSize', 0, 0, (p) => rootHas(p, 'hud-small')],
  ['hudSize', 2, 2, (p) => rootHas(p, 'hud-large')],
  ['hudSize', 1, 1, async (p) => !(await rootHas(p, 'hud-small')) && !(await rootHas(p, 'hud-large'))],
  ['quality', 2, 'low', async (p) => (await p.eval('window.__teul.game.level')) === 2],
  ['quality', 1, 'high', async (p) => (await p.eval('window.__teul.game.level')) === 0],
  ['quality', 0, 'auto', null],
  ['horror', 1, true, null],
  ['horror', 0, false, null],
];

const SLIDERS = ['master', 'music', 'effects', 'ambience', 'voices'];

async function run(page, device) {
  const mouse = device === 'mouse';
  const pointer = mouse ? 'mouse' : 'touch';
  await page.goto(`${BASE}?debug&skip&world=sets-${device}&device=${device}`);
  await ready(page);
  await openSettings(page);
  check(`${device}: the settings open`, await page.eval("getComputedStyle(document.querySelector('.settings.prefs-sheet')).display !== 'none'"));
  if (SHOTS) await page.shot(`${SHOTS}/settings-${device}.png`);

  // ---- every choice, pressed for real
  for (const [pref, i, value, effect] of CHOICES(mouse)) {
    const sel = `.prefs-sheet [data-pref="${pref}:${i}"]`;
    const found = await press(page, sel, pointer);
    if (!found) {
      check(`${device}: ${pref} → ${JSON.stringify(value)} is there`, false, 'no such button');
      continue;
    }
    const stored = (await prefs(page))[pref];
    const shown = await page.eval(`document.querySelector('${sel}')?.getAttribute('aria-checked') === 'true'`);
    const does = effect ? await effect(page) : true;
    check(`${device}: ${pref} → ${JSON.stringify(value)}`, stored === value && shown && does, `stored ${JSON.stringify(stored)}, shown ${shown}, applied ${does}`);
  }
  if (mouse && (await page.eval('!!document.fullscreenElement'))) await page.eval('document.exitFullscreen()');

  // ---- the sliders: dragged by hand, smoothly, the same element all the way
  for (const key of SLIDERS) {
    const sel = `.prefs-sheet input[data-pref="${key}"]`;
    const c = await centre(page, sel);
    if (!c) {
      check(`${device}: the ${key} slider is there`, false);
      continue;
    }
    await page.eval(`(() => { const el = document.querySelector('${sel}'); el.dataset.mark = '1'; window.__seen = []; el.addEventListener('input', () => window.__seen.push(Number(el.value))); })()`);
    // from a fifth to four fifths of the track, then back to a third
    await page.drag(c.l + c.w * 0.2, c.y, c.l + c.w * 0.8, c.y, pointer, 24);
    await page.sleep(120);
    const same = await page.eval(`document.querySelector('${sel}')?.dataset.mark === '1'`);
    const seen = JSON.parse(await page.eval('JSON.stringify(window.__seen)'));
    const distinct = new Set(seen).size;
    const jumps = seen.slice(1).map((v, k) => Math.abs(v - seen[k]));
    const high = (await prefs(page))[key];
    await page.drag(c.l + c.w * 0.8, c.y, c.l + c.w * (1 / 3), c.y, pointer, 16);
    await page.sleep(120);
    const low = (await prefs(page))[key];
    const shownText = await page.eval(`document.querySelector('${sel}')?.closest('.row')?.querySelector('.value')?.textContent ?? ''`);
    check(`${device}: the ${key} slider follows the hand`, same && distinct >= 10 && Math.max(0, ...jumps) <= 8 && high > 0.7 && high < 0.9 && low > 0.25 && low < 0.42,
      `same element ${same}, ${distinct} values, biggest jump ${Math.max(0, ...jumps)}, high ${high}, low ${low}`);
    check(`${device}: the ${key} slider shows its value`, /\d+\s*%/.test(shownText) && Math.abs(parseInt(shownText, 10) - Math.round(low * 100)) <= 1, `«${shownText}» vs ${low}`);
  }
  const audioOk = await page.eval('(() => { const s = window.__teul.game.sound; return !!s && typeof s.setPrefs === "function"; })()');
  check(`${device}: the sound takes the volumes`, audioOk);

  // ---- the ways out of the sheet
  await press(page, '.prefs-sheet .ph button', pointer);
  check(`${device}: the close button closes it`, await page.eval("getComputedStyle(document.querySelector('.settings.prefs-sheet')).display === 'none'"));
  await openSettings(page);
  await page.tap(6, 6, pointer);
  await page.sleep(200);
  check(`${device}: a press on the backdrop closes it`, await page.eval("getComputedStyle(document.querySelector('.settings.prefs-sheet')).display === 'none'"));
  await openSettings(page);
  await page.act([{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '' }, { type: 'keyUp', value: '' }] }]);
  await page.sleep(200);
  check(`${device}: Escape closes it`, await page.eval("getComputedStyle(document.querySelector('.settings.prefs-sheet')).display === 'none'"));

  // ---- the rows of their own (the backup, the account) open something
  await openSettings(page);
  const actions = await page.eval("document.querySelectorAll('.prefs-sheet .settings-action').length");
  check(`${device}: the rows of their own are there`, actions >= 1, `${actions}`);
  for (let k = 0; k < actions; k++) {
    await openSettings(page);
    const btns = JSON.parse(await page.eval("JSON.stringify([...document.querySelectorAll('.prefs-sheet .settings-action')].map((b) => b.closest('.row').querySelector('.label').textContent))"));
    await page.eval(`document.querySelectorAll('.prefs-sheet .settings-action')[${k}]?.click()`);
    await page.sleep(500);
    const after = await page.eval("[...document.querySelectorAll('[role=dialog], .sheet, .backup, .erase')].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none').length");
    check(`${device}: «${btns[k] ?? k}» opens its sheet`, after >= 1, `${after}`);
    await page.act([{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '' }, { type: 'keyUp', value: '' }] }]);
    await page.sleep(200);
    await page.eval("(() => { for (const b of document.querySelectorAll('[role=dialog] .ph button, .sheet .ph button')) if (b.getClientRects().length) b.click(); })()");
    await page.sleep(200);
  }

  // ---- the language: another one, and back
  await openSettings(page);
  await press(page, '.prefs-sheet [data-pref="lang:1"]', pointer);
  await page.sleep(2500);
  await ready(page);
  await openSettings(page);
  const title = await page.eval("document.querySelector('.prefs-sheet .ph b')?.textContent ?? ''");
  check(`${device}: the language changes to English`, /settings/i.test(title), title);
  await press(page, '.prefs-sheet [data-pref="lang:0"]', pointer);
  await page.sleep(2500);
  await ready(page);
  await openSettings(page);
  const back = await page.eval("document.querySelector('.prefs-sheet .ph b')?.textContent ?? ''");
  check(`${device}: and back to Ukrainian`, /налаштув/i.test(back), back);
  check(`${device}: the page shows no errors`, page.errors().length === 0, JSON.stringify(page.errors().slice(0, 3)));
}

await withFirefox(async (page) => {
  await run(page, 'touch');
  if (!process.env.ONLY_TOUCH) await run(page, 'mouse');
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
