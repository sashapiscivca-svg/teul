// A hop and a crouch, as part of the controls: on a computer Space hops and C crouches (while held), and the keys
// can be set anew in the settings and work at once; on a phone two buttons beside the action button do the same.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/moves.mjs [shots-dir]
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
};
const CODE = { ' ': 'Space', c: 'KeyC', g: 'KeyG', 1: 'Digit1', 3: 'Digit3' };
/** A key pressed (down, held, up) as the page gets it. */
const key = async (page, value, hold = 60) => {
  const code = CODE[value] ?? value;
  // (whatever came up meanwhile, the morning's paper, is put away: keys go to an open sheet first)
  await page.eval("(() => { const g = window.__teul.game; if (!document.querySelector('.prefs-sheet') || getComputedStyle(document.querySelector('.settings.prefs-sheet')).display === 'none') { g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); } })()");
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(value)}, code: '${code}', bubbles: true, cancelable: true }))`);
  await page.sleep(hold);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keyup', { key: ${JSON.stringify(value)}, code: '${code}', bubbles: true }))`);
};
const keyDown = (page, value) => page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(value)}, code: '${CODE[value] ?? value}', bubbles: true, cancelable: true }))`);
const keyUp = (page, value) => page.eval(`window.dispatchEvent(new KeyboardEvent('keyup', { key: ${JSON.stringify(value)}, code: '${CODE[value] ?? value}', bubbles: true }))`);
/** The highest the hero rose in the next `ms`. */
const peak = (page, ms) => page.eval(`new Promise((res) => { let top = 0; const end = performance.now() + ${ms}; (function t() { top = Math.max(top, window.__teul.game.heroLift); if (performance.now() < end) requestAnimationFrame(t); else res(Math.round(top)); })(); })`);
const press = async (page, sel, pointer) => {
  const c = JSON.parse(await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || !el.getClientRects().length) return 'null'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
  if (!c) return false;
  await page.tap(c.x, c.y, pointer);
  await page.sleep(200);
  return true;
};

await withFirefox(async (page) => {
  // ---- a computer
  // noon, whatever the hour (the shops open)
  const d = new Date();
  const NOON = (((12 * 60 - (d.getHours() * 60 + d.getMinutes())) % 1440) + 1440) % 1440;
  await page.goto(`${BASE}?debug&skip&device=mouse&shift=${NOON}&world=moves${Date.now() % 1000}`);
  await ready(page);
  await page.eval("window.__teul.game.enterLocation('village', [41, 23])");
  await page.sleep(1200);
  const p0 = peak(page, 700);
  await key(page, ' ');
  check('Space: a hop up and down again', (await p0) > 25 && Math.round(await page.eval('window.__teul.game.heroLift')) === 0);
  await keyDown(page, 'c');
  await page.sleep(400);
  await page.sleep(150);
  const down = await page.eval('window.__teul.game.crouching()');
  const btnOn = await page.eval("document.querySelector('.move-btn.crouch')?.classList.contains('on')");
  await keyUp(page, 'c');
  await page.sleep(200);
  check('C held: down on the heels (and the button shows it), let go: up', down && btnOn && !(await page.eval('window.__teul.game.crouching()')), `${down} ${btnOn}`);
  const hints = JSON.parse(await page.eval("JSON.stringify([...document.querySelectorAll('.move-btn')].map((b) => b.dataset.key))"));
  check('the buttons say their keys', hints[0] === '␣' && hints[1] === 'C', JSON.stringify(hints));

  // ---- set anew in the settings: the hop on G, and it works at once
  await page.eval('window.__teul.game.openSettings()');
  await page.sleep(400);
  check('the settings list the keys one can set', await page.eval("document.querySelectorAll('.prefs-sheet .key-set').length") === 8);
  await press(page, '.prefs-sheet .key-set[data-key="jump"]', 'mouse');
  await key(page, 'g');
  await page.sleep(300);
  const stored = JSON.parse(await page.eval("localStorage.getItem('teul.prefs')")).keys;
  check('the hop set to G (kept)', stored.jump === 'KeyG', JSON.stringify(stored));
  // a key one action already has goes there, and that one takes the old key
  await press(page, '.prefs-sheet .key-set[data-key="crouch"]', 'mouse');
  await key(page, 'g');
  await page.sleep(300);
  const swapped = JSON.parse(await page.eval("localStorage.getItem('teul.prefs')")).keys;
  check('a key already taken changes places', swapped.crouch === 'KeyG' && swapped.jump === 'KeyC', JSON.stringify(swapped));
  if (SHOTS) await page.shot(`${SHOTS}/moves-settings.png`);
  await page.act([{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '' }, { type: 'keyUp', value: '' }] }]);
  await page.sleep(300);
  const p1 = peak(page, 700);
  await key(page, 'c');
  check('and C now hops', (await p1) > 25);

  // ---- the places at hand, at the bottom (as in Minecraft)
  check('nine places at hand at the bottom', await page.eval("document.querySelectorAll('.hotbar .hot-slot:not(.off)').length") === 9 && await page.eval("!!document.querySelector('.hotbar .hot-slot.off')"));
  await page.eval(`(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.enterLocation('grocery_in', [5, 5]); })()`);
  await page.sleep(900);
  const bought = await page.eval(`(() => { const g = window.__teul.game; const st = g.engine.stations(g.now()).filter((x) => x.location === 'grocery_in' && x.ok && x.kind === 'buy').slice(0, 2); return st.map((x) => g.run({ type: 'use', station: x.id }).ok).join(','); })()`);
  // the third place, by its number, then the thing put there from the inventory
  await key(page, '3');
  check('3 chooses the third place', (await page.eval('window.__teul.game.handSlot')) === 2);
  await page.eval("window.__teul.game.openPocket()");
  await page.sleep(400);
  // a thing from the inventory taken up and put on the third place
  await press(page, '.mc-main .mc-slot.full', 'mouse');
  await press(page, '.mc [data-place="bar:2"]', 'mouse');
  await page.sleep(400);
  const held = await page.eval('window.__teul.game.heldItem()');
  const slot = JSON.parse(await page.eval("JSON.stringify({ thumb: !!document.querySelector('.hot-slot[data-slot=\"2\"] .hot-thumb'), on: document.querySelector('.hot-slot[data-slot=\"2\"]')?.classList.contains('on') })"));
  check('taken from the inventory onto the third place, it is in the hand', !!held && slot.thumb && slot.on, `${bought} ${held} ${JSON.stringify(slot)}`);
  await page.eval("window.__teul.game.pocketSheet.close()");
  await key(page, '1');
  check('1 takes another place: the hand empty', (await page.eval('window.__teul.game.heldItem()')) == null);
  await key(page, '3');
  if (SHOTS) await page.shot(`${SHOTS}/moves-hotbar.png`);

  // ---- a phone
  await page.goto(`${BASE}?debug&skip&device=touch&world=moves2${Date.now() % 1000}`);
  await ready(page);
  await page.eval("window.__teul.game.enterLocation('village', [41, 23])");
  await page.sleep(1200);
  const p2 = peak(page, 800);
  check('a hop by its button', (await press(page, '.move-btn.jump', 'touch')) && (await p2) > 25);
  // one finger holds the stick forward, another taps the hop: both at once (a phone makes no click of such a tap)
  const at = (sel) => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify([Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]); })()`).then(JSON.parse);
  const [sx, sy] = await at('.stick');
  const [jx, jy] = await at('.move-btn.jump');
  const x0 = await page.eval('window.__teul.game.walker.x + window.__teul.game.walker.y');
  const p3 = peak(page, 1400);
  await page.act([
    { type: 'pointer', id: 'f1', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', x: sx, y: sy }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', x: sx + 30, y: sy - 30, duration: 120 }, { type: 'pause', duration: 1100 }, { type: 'pointerUp', button: 0 }] },
    { type: 'pointer', id: 'f2', parameters: { pointerType: 'touch' }, actions: [{ type: 'pause', duration: 300 }, { type: 'pointerMove', x: jx, y: jy }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 }] },
  ]);
  const x1 = await page.eval('window.__teul.game.walker.x + window.__teul.game.walker.y');
  check('walking with the stick and a tap on the hop: a hop on the way', (await p3) > 25 && Math.abs(x1 - x0) > 0.5, `${await p3} ${x0} ${x1}`);
  await press(page, '.move-btn.crouch', 'touch');
  await page.sleep(200);
  check('the crouch button: down', await page.eval('window.__teul.game.crouching()'));
  if (SHOTS) await page.shot(`${SHOTS}/moves-phone.png`);
  await press(page, '.move-btn.crouch', 'touch');
  await page.sleep(200);
  check('and up again', !(await page.eval('window.__teul.game.crouching()')));
  check('the page shows no errors', page.errors().length === 0, JSON.stringify(page.errors().slice(0, 3)));
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
