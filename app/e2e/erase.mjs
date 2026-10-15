// «Видалити акаунт», end to end: the settings have it; it asks first (a copy offered) and once more; after the
// second yes everything on this device is gone — the world's save, the keys, the preferences — and the game
// starts again from the beginning.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/erase.mjs
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
const click = (page, re, sel = 'button') => page.eval(`(() => { const b = [...document.querySelectorAll('${sel}')].find((x) => x.getClientRects().length && ${re}.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);

await withFirefox(async (page) => {
  // the player's own world (no test world name): what a person would delete
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  // something of this world: a thing bought, a preference changed
  const item = await page.eval(`(() => { const g = window.__teul.game, e = window.__teul.engine; const id = Object.values(e.catalog.items).find((d) => !d.hidden && d.acquire && d.acquire.coins > 0 && d.acquire.coins < 100).id; e.command({ type: 'acquire', item: id }, g.now()); g.applyPrefs({ ...g.prefs, music: 0.1 }); return id; })()`);
  await page.eval('window.__teul.game.saveNow()');
  await page.sleep(500);
  const owned = (p) => p.eval(`window.__teul.engine.inventory().find((i) => i.item === '${item}')?.owned ?? 0`);
  check('the world has bought something', (await owned(page)) > 0);

  await page.eval('window.__teul.game.settings.open()');
  await page.sleep(300);
  const row = await page.eval(`[...document.querySelectorAll('.prefs-sheet .row')].some((r) => /Видалити акаунт/.test(r.textContent))`);
  check('the settings have «Видалити акаунт»', row);
  await page.eval(`(() => { const r = [...document.querySelectorAll('.prefs-sheet .row')].find((r) => /Видалити акаунт/.test(r.textContent)); r.querySelector('button').click(); })()`);
  await page.sleep(300);
  check('it asks first, offering a copy', /Спершу зберегти копію/.test(await page.eval(`document.querySelector('.ask').textContent`)));
  await click(page, '/^Видалити все$/', '.ask button');
  await page.sleep(200);
  check('and once more', /Точно видалити/.test(await page.eval(`document.querySelector('.ask').textContent`)));
  await click(page, '/Так, видалити все/', '.ask button');
  // the page reloads onto a first start
  await page.sleep(2500);
  await ready(page);
  check('the world starts over (what was bought is gone)', (await owned(page)) === 0);
  check('the preferences are the first ones', (await page.eval('window.__teul.game.prefs.music')) === 0.5);
}, { width: 900, height: 600 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
