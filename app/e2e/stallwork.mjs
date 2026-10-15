// The counters and the jobs of the town, as a newcomer meets them: at a counter one button opens its stall with
// every ware, price and «Купити»; at the café one asks for a job, is taken on and works an evening shift; the job
// is in «Я» and can be left; at the bakery late in the evening one is taken on for tomorrow.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/stallwork.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

// half past eight in the evening today, whatever the hour: the café still takes a shift, the bakery no more
const nowLocal = new Date();
const EVENING = (((20 * 60 + 30 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1200);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); })()");
};
const shot = async (page, name) => {
  if (SHOTS) await page.shot(`${SHOTS}/stallwork-${name}.png`);
};
const go = async (page, id, at) => {
  await page.eval(`window.__teul.game.enterLocation(${JSON.stringify(id)}, ${JSON.stringify(at)})`);
  await page.sleep(900);
};
const shown = (page, sel) => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; })()`);
/** A real press on the first element matching `sel` whose text matches `text`. */
const press = async (page, sel, text = '') => {
  const c = JSON.parse(await page.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.getClientRects().length && e.textContent.includes(${JSON.stringify(text)})); if (!el) return 'null'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
  if (!c) return false;
  await page.tap(c.x, c.y, 'mouse');
  await page.sleep(400);
  return true;
};
const opts = (page, item) => page.eval(`(() => { const g = window.__teul.game; const p = g.room.placements.find((q) => q.item === ${JSON.stringify(item)}); return JSON.stringify(p ? { pid: p.pid, opts: g.optionsFor(p.pid) } : null); })()`).then(JSON.parse);
/** Touches a thing and picks an action, as a hand does: the hero walks up to it first; waits for `sel` to show. */
const useAt = async (page, pid, action, sel) => {
  await page.eval(`window.__teul.game.use(${pid}, ${JSON.stringify(action)})`);
  for (let i = 0; i < 40 && !(await shown(page, sel)); i++) await page.sleep(250);
  await page.sleep(300);
};
const job = (page, id) => page.eval(`JSON.stringify(window.__teul.engine.works(window.__teul.game.now()).find((w) => w.id === ${JSON.stringify(id)}))`).then(JSON.parse);

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&device=mouse&shift=${EVENING}&world=stallwork${Date.now() % 1000}`);
  await ready(page);

  // ---- the café's counter: its wares in one stall, the job beside it
  await go(page, 'cafe_in', [6, 6]);
  const counter = await opts(page, 'counter');
  check('the café counter offers its stall', !!counter && counter.opts.includes('stall'), JSON.stringify(counter));
  check('the counter no longer lists every ware as a button of its own', !!counter && !counter.opts.some((o) => o.startsWith('st:') && /buy/.test(o)), JSON.stringify(counter?.opts));
  check('the counter offers the job, and asks to be taken on first', !!counter && counter.opts.includes('work:work.cafe') && (await page.eval(`window.__teul.game.optionLabel(${counter.pid}, 'work:work.cafe').label`)) === 'Влаштуватися на роботу');

  await useAt(page, counter.pid, 'stall', '.stall');
  check('«Крамничка» opens the stall sheet', await shown(page, '.stall'));
  const rows = JSON.parse(await page.eval("JSON.stringify([...document.querySelectorAll('.stall-row')].map((r) => ({ name: r.querySelector('b')?.textContent, btn: r.querySelector('button')?.textContent, ok: !r.classList.contains('off') })))"));
  check('every ware has its name and a price on its button', rows.length >= 2 && rows.every((r) => r.name && /\d/.test(r.btn ?? '')), JSON.stringify(rows));
  await shot(page, 'stall');
  const coins0 = await page.eval('window.__teul.engine.wallet().coins');
  const firstOk = rows.find((r) => r.ok);
  const pressed = firstOk ? await press(page, '.stall-row:not(.off) button', '') : false;
  await page.sleep(400);
  const coins1 = await page.eval('window.__teul.engine.wallet().coins');
  check('a press on «Купити» buys it: the coins go down, the stall stays open', pressed && coins1 < coins0 && (await shown(page, '.stall')), `${coins0} → ${coins1}, ${JSON.stringify(firstOk)}`);
  await press(page, '.stall .ph button');
  check('the stall closes by its button', !(await shown(page, '.stall')));

  // ---- the job: asked for, taken on, an evening shift
  await useAt(page, counter.pid, 'work:work.cafe', '.ask');
  const offer = await page.eval("document.querySelector('.ask .ask-text')?.textContent ?? ''");
  check('the boss offers the job with its hours and pay', (await shown(page, '.ask')) && /22:00/.test(offer) && /монет/.test(offer), offer);
  await shot(page, 'offer');
  await press(page, '.ask .ask-choices button', 'Влаштуватися');
  check('taken on at the café', (await job(page, 'work.cafe'))?.hired === true);
  const welcome = await page.eval("document.querySelector('.ask .ask-text')?.textContent ?? ''");
  check('at half past eight in the evening the café still takes a shift: «хоч зараз»', /зараз/.test(welcome), welcome);
  await press(page, '.ask .ask-choices button', 'Стати на зміну');
  check('the shift begins', (await shown(page, '.work')) && !!(await page.eval('!!window.__teul.engine.shift(window.__teul.game.now())')));
  // a task a minute: the next guest comes a world minute later
  for (let k = 0; k < 2; k++) {
    await page.eval('window.__teul.game.debugOffset += 1');
    await page.sleep(1200);
    const asks = await page.eval('window.__teul.engine.shift(window.__teul.game.now())?.asks ?? ""');
    await press(page, '.work-options .chip', asks);
  }
  const s = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.shift(window.__teul.game.now()))'));
  check('two tasks done right, a minute apart', s && s.step === 2 && s.right === 2, JSON.stringify(s));
  await shot(page, 'shift');
  await press(page, '.work-foot button');
  check('leaving the shift ends it', !(await page.eval('!!window.__teul.engine.shift(window.__teul.game.now())')));

  // ---- the job in «Я», and leaving it
  await page.eval("(() => { const g = window.__teul.game; g.todayPanel.open(g.daily, 'me'); })()");
  await page.sleep(500);
  const me = await page.eval("[...document.querySelectorAll('.me-row')].map((r) => r.textContent).join(' | ')");
  check('«Я» shows where one works and its hours', /кав'ярні/.test(me) && /22:00/.test(me), me);
  await shot(page, 'me');
  await press(page, '.me-quit');
  await press(page, '.ask .ask-choices button', 'звільняюся');
  check('the job can be left', (await job(page, 'work.cafe'))?.hired === false);
  await page.eval('window.__teul.game.todayPanel.close()');

  // ---- the bakery late: taken on for tomorrow, told the hours
  await go(page, 'bakery_in', [5, 6]);
  const oven = await opts(page, 'bread_oven');
  check('the bakery offers its job at the oven', !!oven && oven.opts[0] === 'work:work.bakery', JSON.stringify(oven));
  await useAt(page, oven.pid, 'work:work.bakery', '.ask');
  await press(page, '.ask .ask-choices button', 'Влаштуватися');
  const toast = await page.eval("[...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')");
  check('too late for a shift tonight: taken on, and told when to come', (await job(page, 'work.bakery'))?.hired === true && /5:00/.test(toast) && /21:00/.test(toast), toast);

  // ---- the buttons of the place by the hand: no thing touched
  await go(page, 'grocery_in', [5, 5]);
  await page.sleep(1200);
  const place = JSON.parse(await page.eval("JSON.stringify([...document.querySelectorAll('.hud-place .place-btn')].map((b) => ({ key: b.dataset.place, label: b.textContent })))"));
  check('inside a shop its buttons stand on the right: the stall first, the way out last', place.length >= 2 && place[0].key === 'stall' && place[place.length - 1].key === 'leave', JSON.stringify(place));
  await shot(page, 'place-buttons');
  check('the grocery has its job too, among its buttons', place.some((b) => b.key === 'work:work.grocery'), JSON.stringify(place));
  const coinsG0 = await page.eval('window.__teul.engine.wallet().coins');
  // on a computer the place's buttons answer Alt and their numbers: Alt+1 is the stall
  await page.act([{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '\uE00A' }, { type: 'keyDown', value: '1' }, { type: 'keyUp', value: '1' }, { type: 'keyUp', value: '\uE00A' }] }]);
  await page.sleep(400);
  const wares = await page.eval("document.querySelectorAll('.stall-row').length");
  check('Alt+1 opens the stall, and «Крамничка» there shows every ware of the whole shop', (await shown(page, '.stall')) && wares >= 8, `${wares}`);
  await press(page, '.stall-row:not(.off) button');
  check('and sells from it', (await page.eval('window.__teul.engine.wallet().coins')) < coinsG0);
  await press(page, '.stall .ph button');
  await go(page, 'post_in', [5, 5]);
  await page.sleep(1200);
  const post = JSON.parse(await page.eval("JSON.stringify([...document.querySelectorAll('.hud-place .place-btn')].map((b) => b.dataset.place))"));
  check('an office has its own buttons too (the post: its job among them)', post.some((k) => k === 'work:work.post'), JSON.stringify(post));
  await press(page, '.hud-place .place-btn[data-place="leave"]');
  await page.sleep(900);
  check('«Вийти» takes one out', (await page.eval('window.__teul.game.location')) === 'village');

  // ---- a shut shop is not walked into
  const night = JSON.parse(await page.eval(`(() => { const g = window.__teul.game; g.debugOffset += ((3 * 60 - (g.now() % 1440)) + 1440) % 1440; const r = g.engine.command({ type: 'travel', to: 'grocery_in' }, g.now()); return JSON.stringify({ ok: r.ok, kind: r.error?.kind, at: g.now() % 1440 }); })()`));
  check('at three in the night the grocery lets nobody in', !night.ok && night.kind === 'closed', JSON.stringify(night));
  await page.eval("window.__teul.game.enterLocation('grocery_in', [5, 5])");
  await page.sleep(600);
  const shut = await page.eval("[...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')");
  check('and says when it opens', (await page.eval('window.__teul.game.location')) === 'village' && /зачинено/.test(shut) && /7:00/.test(shut), shut);

  // ---- on a computer the world turns with Q and E (the morning's paper, come with the night, put away first)
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); })()");
  await page.sleep(300);
  const turn = async (key) => {
    // whatever came up meanwhile (the morning's paper) is put away: keys go to an open sheet first
    await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); })()");
    await page.sleep(200);
    await page.act([{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: key }, { type: 'keyUp', value: key }] }]);
    await page.sleep(400);
    return page.eval('window.__teul.game.view');
  };
  const view0 = await page.eval('window.__teul.game.view');
  const view1 = await turn('e');
  const view2 = await turn('q');
  check('E turns the world to the right and Q back', view1 === (view0 + 1) % 4 && view2 === view0, `${view0} → ${view1} → ${view2}`);

  check('the page shows no errors', page.errors().length === 0, JSON.stringify(page.errors().slice(0, 3)));
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
