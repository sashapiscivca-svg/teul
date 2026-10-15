// The hands and the armour, as in Minecraft: in the inventory, a thing taken up (a tap on its picture) goes where one
// taps next (a place at hand, the left hand, a place of armour, if it fits there); X swaps what the hands hold, the
// left hand shows beside the bar at the bottom, and armour worn is drawn on the hero.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/equip.mjs [shots-dir]
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
const key = async (page, value, code) => {
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(value)}, code: '${code}', bubbles: true, cancelable: true }))`);
  await page.sleep(60);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keyup', { key: ${JSON.stringify(value)}, code: '${code}', bubbles: true }))`);
  await page.sleep(200);
};
const press = async (page, sel) => {
  const c = JSON.parse(await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || !el.getClientRects().length) return 'null'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
  if (!c) return false;
  await page.tap(c.x, c.y, 'mouse');
  await page.sleep(250);
  return true;
};
const view = async (page) => JSON.parse(await page.eval('JSON.stringify(window.__teul.game.engine.pocket())'));

await withFirefox(async (page) => {
  const d = new Date();
  const NOON = (((12 * 60 - (d.getHours() * 60 + d.getMinutes())) % 1440) + 1440) % 1440;
  await page.goto(`${BASE}?debug&skip&device=mouse&shift=${NOON}&world=equip${Date.now() % 1000}`);
  await ready(page);
  // a helmet and boots from «Майстер», a loaf from the grocery
  await page.eval("window.__teul.game.enterLocation('hardware_in', [5, 5])");
  await page.sleep(900);
  const bought = await page.eval(`(() => { const g = window.__teul.game; return ['st.hardware.armor_leather_head', 'st.hardware.armor_leather_feet'].map((id) => g.run({ type: 'use', station: id }).ok).join(','); })()`);
  await page.eval("window.__teul.game.enterLocation('grocery_in', [5, 5])");
  await page.sleep(900);
  const food = await page.eval(`(() => { const g = window.__teul.game; const st = g.engine.stations(g.now()).find((x) => x.location === 'grocery_in' && x.ok && x.kind === 'buy'); return st ? (g.run({ type: 'use', station: st.id }).ok ? st.gives[0][0] : '') : ''; })()`);
  check('bought: a helmet, boots and something to eat', bought === 'true,true' && !!food, `${bought} ${food}`);

  await page.eval('window.__teul.game.openPocket()');
  await page.sleep(500);
  check('as in Minecraft: four places of armour, the hero, the left hand, the cells (three rows at least), nine at hand', await page.eval("document.querySelectorAll('.mc [data-place^=\"armor:\"]').length === 4 && !!document.querySelector('.mc .mc-figure') && !!document.querySelector('.mc [data-place=\"off\"]') && document.querySelectorAll('.mc-main .mc-slot').length >= 27 && document.querySelectorAll('.mc-bar [data-place^=\"bar:\"]').length === 9"));
  // the helmet taken up (it follows the pointer) and put on the head
  await press(page, '.mc-main [data-item="armor_leather_head"]');
  check('a click takes it up: its name and what can be done with it below', /Шкіряний шолом/.test(await page.eval("document.querySelector('.mc-info')?.textContent ?? ''")));
  await press(page, '.mc [data-place="armor:head"]');
  let v = await view(page);
  check('and a click on the head: worn, out of the inventory, defence 1', v.armor?.head === 'armor_leather_head' && !v.items.armor_leather_head && v.defense === 1, JSON.stringify({ armor: v.armor, d: v.defense }));
  // boots do not go on the head: still carried; «Вдягнути» puts them on the feet
  await press(page, '.mc-main [data-item="armor_leather_feet"]');
  await press(page, '.mc [data-place="armor:head"]');
  v = await view(page);
  const still = await page.eval("!!document.querySelector('.mc-slot.from[data-item=\"armor_leather_feet\"]')");
  check('boots onto the head: not worn there, still carried', v.armor?.head === 'armor_leather_head' && !v.armor?.feet && still);
  await press(page, '.mc-info [data-wear="armor_leather_feet"]');
  v = await view(page);
  check('«Вдягнути»: on the feet, defence 2', v.armor?.feet === 'armor_leather_feet' && v.defense === 2);
  // the food into the left hand, then to the third place at hand
  await press(page, `.mc-main [data-item="${food}"]`);
  await press(page, '.mc [data-place="off"]');
  v = await view(page);
  check('into the left hand', v.offhand === food, JSON.stringify(v.offhand));
  await press(page, '.mc [data-place="off"]');
  await press(page, '.mc [data-place="bar:2"]');
  v = await view(page);
  check('from the left hand to the third place at hand: one place at most', v.hotbar?.[2] === food && !v.offhand, JSON.stringify({ off: v.offhand, bar: v.hotbar }));
  // the helmet taken off: from the head into a cell of the inventory, the very one clicked
  await press(page, '.mc [data-place="armor:head"]');
  await press(page, '.mc-main [data-place="main:20"]');
  v = await view(page);
  const at20 = await page.eval("document.querySelector('.mc-main [data-place=\"main:20\"]')?.dataset.item ?? ''");
  check('the helmet into the 21st cell: taken off, lying there', !v.armor?.head && v.items.armor_leather_head === 1 && at20 === 'armor_leather_head', at20);
  // Shift and a click: straight across
  const shift = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
  await shift('.mc-main [data-item="armor_leather_head"]');
  await page.sleep(300);
  v = await view(page);
  check('Shift and a click on the helmet: put on', v.armor?.head === 'armor_leather_head');
  await shift('.mc [data-place="bar:2"]');
  await page.sleep(300);
  v = await view(page);
  const back = await page.eval(`!!document.querySelector('.mc-main [data-item="${food}"]')`);
  check('Shift and a click on the bar: back into the inventory', !v.hotbar?.[2] && back);
  await shift(`.mc-main [data-item="${food}"]`);
  await page.sleep(300);
  v = await view(page);
  check('and again: onto the first free place at hand', v.hotbar?.[0] === food, JSON.stringify(v.hotbar));
  await press(page, '.mc [data-place="bar:0"]');
  await press(page, '.mc [data-place="bar:2"]');
  if (SHOTS) await page.shot(`${SHOTS}/equip-sheet.png`);
  await page.eval('window.__teul.game.pocketSheet.close()');
  await page.sleep(300);

  // X: the hands swap; the left hand beside the bar
  await key(page, '3', 'Digit3');
  await key(page, 'x', 'KeyX');
  v = await view(page);
  const off = await page.eval("!!document.querySelector('.hotbar .hot-slot.off .hot-thumb')");
  check('X: the thing in the hand goes to the left hand, shown beside the bar', v.offhand === food && !v.hotbar?.[2] && off, JSON.stringify({ off: v.offhand, bar: v.hotbar, shown: off }));
  await press(page, '.hotbar .hot-slot.off');
  v = await view(page);
  check('a tap on the left hand swaps them back', v.hotbar?.[2] === food && !v.offhand);
  check('the settings know the key', await page.eval("(() => { window.__teul.game.openSettings(); return !!document.querySelector('.prefs-sheet .key-set[data-key=\"swap\"]'); })()"));
  if (SHOTS) await page.shot(`${SHOTS}/equip-settings.png`);
  check('the page shows no errors', page.errors().length === 0, JSON.stringify(page.errors().slice(0, 3)));
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
