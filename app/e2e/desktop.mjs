// On a computer, end to end: played with a mouse and keys there is no joystick on the screen, the settings are laid
// out wide (two columns) without the phone's rows (vibration, the joystick's side, big touch targets), with «На весь
// екран» and the keys of the game; the map button and M open the maps with their search, not the paper map.
// The same build on a touch screen keeps the joystick and the phone's rows.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/desktop.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1400);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
const shown = (page, sel) => page.eval(`(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; })()`);
const rows = (page) => page.eval(`[...document.querySelectorAll('.prefs-sheet [data-pref]')].map((b) => b.dataset.pref.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i).join(',')`);

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&rich&world=desk&device=mouse`);
  await ready(page);
  check('no joystick on the screen of a computer', !(await shown(page, '.stick')));
  await page.eval('window.__teul.game.settings.open()');
  await page.sleep(300);
  const r = await rows(page);
  check('the settings have the full screen, not the phone rows', r.includes('fullscreen') && !r.includes('haptics') && !r.includes('stick') && !r.includes('bigTargets'), r);
  check('the keys of the game are listed', (await page.eval(`document.querySelectorAll('.prefs-sheet .settings-keys kbd, .prefs-sheet .settings-keys .key-set').length`)) >= 5);
  check('the settings are laid out in two columns', await page.eval(`getComputedStyle(document.querySelector('.prefs-sheet .settings-body')).gridTemplateColumns.split(' ').length === 2`));
  await page.eval('window.__teul.game.settings.close()');
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }))`);
  await page.sleep(900);
  check('M opens the maps with their search', (await shown(page, '.maps')) && !!(await page.eval(`!!document.querySelector('.maps input')`)));
  check('not the paper map', !(await page.eval('window.__teul.game.paperMap.isOpen()')));
  await page.eval('window.__teul.game.mapsSheet.close()');

  // arranging the room: the row of things at the bottom goes along under the wheel
  // enough things owned that they do not all fit in the row
  await page.eval(`(() => { const g = window.__teul.game, e = window.__teul.engine; let n = 0;
    for (const d of Object.values(e.catalog.items)) { if (n >= 30) break; if (!d.hidden && d.layer === 'floor' && d.acquire && d.acquire.coins > 0 && d.acquire.coins < 60 && e.command({ type: 'acquire', item: d.id }, g.now()).ok) n++; }
    g.refresh(); })()`);
  await page.eval('window.__teul.game.enterEdit()');
  await page.sleep(600);
  const wheel = JSON.parse(await page.eval(`(() => {
    const rows = [...document.querySelectorAll('.strip, .strip .group')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1);
    const row = rows[0];
    if (!row) return JSON.stringify({ row: false });
    row.scrollLeft = 0;
    const kid = row.firstElementChild ?? row;
    kid.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    return JSON.stringify({ row: true, left: row.scrollLeft });
  })()`));
  check('the wheel moves the row of things along', wheel.row && wheel.left > 0, JSON.stringify(wheel));
  await page.eval('window.__teul.game.exitEdit()');

  await page.goto(`${BASE}?debug&skip&world=desk2&device=touch`);
  await ready(page);
  check('a touch screen keeps the joystick', await shown(page, '.stick'));
  await page.eval('window.__teul.game.settings.open()');
  await page.sleep(300);
  const t = await rows(page);
  check('and the phone rows in the settings', t.includes('haptics') && t.includes('stick') && !t.includes('fullscreen'), t);
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
