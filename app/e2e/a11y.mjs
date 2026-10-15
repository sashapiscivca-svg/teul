// Accessibility, end to end: the settings apply (text size, contrast, motion, colours, targets, font, captions),
// every control has a name, sheets take the focus, keep Tab inside, close on Escape and give the focus back,
// the menu works from the keyboard, and a sound that matters gets a caption.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/a11y.mjs [shots-dir]
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

/** Presses a key on whatever has the focus (as the keyboard would send it). */
const key = (page, k, shift = false) =>
  page.eval(`(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, code: ${JSON.stringify(k === ' ' ? 'Space' : k)}, shiftKey: ${shift}, bubbles: true, cancelable: true })); return true; })()`);

/** Names of the visible controls inside a selector that have no accessible name. */
const unnamed = (page, sel) =>
  page.eval(`(() => {
    const out = [];
    for (const scope of document.querySelectorAll(${JSON.stringify(sel)})) {
      for (const el of scope.querySelectorAll('button, input, select, textarea, [role="button"], [role="menuitem"]')) {
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        const name = (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby') ? 'x' : '') || (el.textContent || '').trim() || (el.closest('label')?.textContent || '').trim();
        if (!name) out.push(el.outerHTML.slice(0, 80));
      }
    }
    return JSON.stringify(out);
  })()`);

/** Clicks the choice `index` of the settings row for `pref`. */
const choose = (page, pref, index) =>
  page.eval(`(() => { const b = document.querySelector('[data-pref="${pref}:${index}"]'); if (!b) return false; b.click(); return true; })()`);

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&world=a11y&device=touch`);
  await ready(page);

  // ---- the hud menu: names, keyboard
  const menuBtn = '.hud-menu-btn';
  check('the hud has no control without a name', JSON.parse(await unnamed(page, '.hud')).length === 0, await unnamed(page, '.hud'));
  await page.eval(`(() => { const b = document.querySelector('${menuBtn}'); b.focus(); b.click(); })()`);
  await page.sleep(300);
  check('the menu opens', await page.eval(`getComputedStyle(document.querySelector('.hud-menu')).display !== 'none'`));
  check('every tile in the menu has a name', JSON.parse(await unnamed(page, '.hud-menu')).length === 0, await unnamed(page, '.hud-menu'));
  check('the tiles are menu items', await page.eval(`[...document.querySelectorAll('.hud-menu > button')].every((b) => b.getAttribute('role') === 'menuitem')`));
  await page.eval(`document.querySelector('.hud-menu button').focus()`);
  const first = await page.eval('document.activeElement.getAttribute("aria-label")');
  await key(page, 'ArrowRight');
  const second = await page.eval('document.activeElement.getAttribute("aria-label")');
  check('arrow keys move between the tiles', !!second && second !== first, `${first} -> ${second}`);
  await key(page, 'ArrowLeft');
  check('and back', (await page.eval('document.activeElement.getAttribute("aria-label")')) === first);
  await key(page, 'Escape');
  await page.sleep(200);
  check('Escape folds the menu', await page.eval(`getComputedStyle(document.querySelector('.hud-menu')).display === 'none'`));
  check('the focus goes back to the menu button', await page.eval(`document.activeElement === document.querySelector('${menuBtn}')`));

  // ---- a sheet: dialog, focus in, Tab kept inside, Escape closes, focus back
  await page.eval(`(() => { const b = document.querySelector('${menuBtn}'); b.focus(); window.__teul.game.settings.open(); })()`);
  await page.sleep(400);
  const dialog = await page.eval(`(() => { const d = document.querySelector('.prefs-sheet'); return JSON.stringify({ role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), name: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') }); })()`);
  const d = JSON.parse(dialog);
  check('the settings sheet is a named modal dialog', d.role === 'dialog' && d.modal === 'true' && !!d.name, dialog);
  check('the focus moves into the sheet', await page.eval(`document.querySelector('.prefs-sheet').contains(document.activeElement)`));
  check('every control in the settings has a name', JSON.parse(await unnamed(page, '.prefs-sheet')).length === 0, await unnamed(page, '.prefs-sheet'));
  await page.eval(`(() => { const list = [...document.querySelectorAll('.prefs-sheet button, .prefs-sheet input')].filter((e) => e.getClientRects().length); list[list.length - 1].focus(); })()`);
  await key(page, 'Tab');
  check('Tab from the last control wraps to the first, inside the sheet', await page.eval(`(() => { const list = [...document.querySelectorAll('.prefs-sheet button, .prefs-sheet input')].filter((e) => e.getClientRects().length); return document.activeElement === list[0]; })()`));
  await key(page, 'Tab', true);
  check('Shift+Tab from the first goes to the last', await page.eval(`(() => { const list = [...document.querySelectorAll('.prefs-sheet button, .prefs-sheet input')].filter((e) => e.getClientRects().length); return document.activeElement === list[list.length - 1]; })()`));
  await key(page, 'Escape');
  await page.sleep(300);
  check('Escape closes the sheet', !(await page.eval('window.__teul.game.settings.isOpen()')));
  check('the focus returns to what opened it', await page.eval(`document.activeElement === document.querySelector('${menuBtn}')`));

  // ---- the settings apply
  await page.eval('window.__teul.game.settings.open()');
  await page.sleep(300);
  const before = await page.eval(`document.querySelector('.prefs-sheet .settings-card .ph b').getBoundingClientRect().height`);
  await choose(page, 'textSize', 2);
  await page.sleep(300);
  const after = await page.eval(`document.querySelector('.prefs-sheet .settings-card .ph b').getBoundingClientRect().height`);
  check('the largest text makes the words bigger', after > before * 1.15, `${before} -> ${after}`);
  check('text size is on <html>', await page.eval(`document.documentElement.classList.contains('a11y-text-2')`));
  await choose(page, 'textSize', 0);
  for (const [pref, cls] of [['contrast', 'a11y-contrast'], ['colorblind', 'a11y-cb'], ['bigTargets', 'a11y-big'], ['readable', 'a11y-readable'], ['captions', 'a11y-captions']]) {
    await choose(page, pref, 0);
    await page.sleep(150);
    check(`${pref} on sets .${cls}`, await page.eval(`document.documentElement.classList.contains('${cls}')`));
  }
  check('high contrast makes the ink white', ['#fff', '#ffffff'].includes(await page.eval(`getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().toLowerCase()`)));
  check('colour-blind cues use the safe palette', (await page.eval('window.__teulA11y.cueColor("hint")')) === '#f0e442');
  check('the readable font is not the pixel one', !(await page.eval(`getComputedStyle(document.querySelector('.prefs-sheet .settings-card')).fontFamily`)).includes('Pixelify'));
  check('larger touch targets are at least 44px', (await page.eval(`document.querySelector('.hud-menu-btn').getBoundingClientRect().width`)) >= 44);
  check('the choices kept the focus on the one just made', await page.eval(`document.activeElement?.dataset?.pref === 'captions:0'`));
  if (SHOTS) await page.shot(`${SHOTS}/a11y-settings.png`);

  // ---- reduce motion
  await choose(page, 'motion', 1);
  await page.sleep(150);
  check('reduce motion sets .a11y-still', await page.eval(`document.documentElement.classList.contains('a11y-still')`));
  check('the renderer sees motion held back (no lightning flash)', await page.eval('window.__teulA11y.motionReduced()'));
  const flicker = await page.eval(`(() => { const c = document.getElementById('scene'); c.classList.add('flicker'); const a = getComputedStyle(c).animationName; c.classList.remove('flicker'); return a; })()`);
  check('the screen does not flicker', flicker === 'none', flicker);
  await choose(page, 'motion', 2);
  await page.sleep(150);
  check('full motion brings it back', !(await page.eval('window.__teulA11y.motionReduced()')));

  // ---- captions
  await page.eval('window.__teul.game.settings.close()');
  await page.eval(`window.__teulA11y.caption('knock', 0.9)`);
  await page.sleep(200);
  const cap = await page.eval(`document.querySelector('.a11y-caption-line .a11y-caption')?.textContent ?? ''`);
  check('a knock gets a caption', cap.length > 4, cap);
  check('the caption is announced', (await page.eval(`document.querySelector('.a11y-caption-line').getAttribute('aria-live')`)) === 'polite');
  await page.eval(`window.__teulA11y.caption('knock', 0.9)`);
  check('the same sound is not captioned twice in a row', (await page.eval(`document.querySelectorAll('.a11y-caption-line .a11y-caption').length`)) === 1);
  // a sound through the mixer itself gets one too (captions do not need the sound on)
  await page.eval(`window.__teul.game.sound.at('thunder', 0.9, 0)`);
  await page.sleep(100);
  check('thunder from the mixer gets a caption', (await page.eval(`[...document.querySelectorAll('.a11y-caption')].some((c) => c.dataset.sound === 'thunder')`)));

  // ---- the preferences outlive a reload
  await page.goto(`${BASE}?debug&skip&world=a11y&device=touch`);
  await ready(page);
  check('the settings are kept', await page.eval(`['a11y-contrast', 'a11y-cb', 'a11y-big', 'a11y-readable', 'a11y-captions'].every((c) => document.documentElement.classList.contains(c))`));
  // leave the device as it was found
  await page.eval(`(() => { const g = window.__teul.game; g.applyPrefs({ ...g.prefs, contrast: false, colorblind: false, bigTargets: false, readable: false, captions: false, motion: 'auto', textSize: 0 }); })()`);
});

process.exit(failed === 0 ? 0 : 1);
