// End-to-end flows in a real (headless Firefox) browser against `vite preview`.
// Usage: npm run build:e2e (a release build has no debug hook), then vite preview; BASE=http://localhost:4173/ node e2e/flows.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
// The town keeps real hours (people sleep at night, stalls close): run the world at midday whatever the hour.
const nowLocal = new Date();
const SHIFT = (((12 * 60 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;
const URL0 = `${BASE}?debug&shift=${SHIFT}`;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

await withFirefox(async (page) => {
  const state = async () => JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugState())'));
  const key = (type, code) => page.eval(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', bubbles: true }))`);
  const press = async (code, ms) => {
    await key('keydown', code);
    await page.sleep(ms);
    await key('keyup', code);
  };
  const tapCell = async (x, y) => {
    await page.eval(`(() => {
      const c = document.getElementById('scene');
      const r = c.getBoundingClientRect();
      const p = window.__teul.game.debugCellScreen(${x}, ${y});
      const o = { clientX: r.left + p.x, clientY: r.top + p.y, pointerId: 1, bubbles: true, isPrimary: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointermove', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    })()`);
    await page.sleep(150);
  };
  const click = (selector) => page.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const clickText = (selector, text) =>
    page.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);

  // ---- first run: the title, the hero, then straight into the room (no tutorial)
  await page.goto(URL0);
  // wait for the title (a busy machine loads slower), then a moment for it to settle
  for (let i = 0; i < 60 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await page.sleep(400);
  check('the loading screen is gone once the world is ready', await page.eval("!document.getElementById('boot') || document.getElementById('boot').classList.contains('gone')"));
  check('the title offers to start a new world', (await page.eval("document.querySelector('.title-screen .screen-go')?.textContent ?? ''")) === 'Почати');
  await click('.title-screen .screen-go');
  await page.sleep(2400);
  check('the first run asks for a hero', await page.eval("!!document.querySelector('.hero-screen')"));
  await clickText('.hero-tabs .tab', 'Волосся');
  await page.eval("document.querySelectorAll('.hero-body .thumb')[4].click()");
  await page.eval("[...document.querySelectorAll('.hero-body .color')].find((b) => b.getAttribute('aria-label') === '#3fb8b0').click()");
  await click('.hero-go');
  await page.sleep(1600);
  let s = await state();
  check('no screen is left over the room', await page.eval("!document.querySelector('.screen:not(.gone)')"));
  const settings = JSON.parse(await page.eval("JSON.stringify(window.__teul.engine.room().settings)"));
  check('the hero made on the first screen is the one in the room', settings['look.hair'] === '4' && settings['look.hair_color'] === '#3fb8b0' && !!settings['look.top2_color'], JSON.stringify(settings));
  check('no tutorial hints on the first run', !(await page.eval("[...document.querySelectorAll('.toast')].some((t) => /Джойстик|Олівець|Образ/.test(t.textContent))")));

  // ---- the morning paper opens by itself on the first open of a day, and closes
  check('the morning paper opens by itself', await page.eval("document.querySelector('.paper')?.style.display === ''"));
  check('the paper has its masthead and a front page story', /Липовий вісник/.test(await page.eval("document.querySelector('.paper-mast h1')?.textContent ?? ''")) && !!(await page.eval("document.querySelector('.paper-lead h2')?.textContent ?? ''")));
  for (let i = 0; i < 40 && !(await page.eval("!!document.querySelector('.paper-lead .paper-photo:not(.loading) img')?.src")); i++) await page.sleep(250);
  check('the front page has a photo printed from the town itself', /^data:image\/png/.test(await page.eval("document.querySelector('.paper-lead .paper-photo img')?.src ?? ''")) && /Фото:/.test(await page.eval("document.querySelector('.paper-lead figcaption')?.textContent ?? ''")));
  check('the paper is short: three stories at most, no long columns', await page.eval("document.querySelectorAll('.paper-story').length <= 3 && [...document.querySelectorAll('.paper-col p')].length <= 14"));
  await click('.paper-close');
  check('the paper closes', await page.eval("document.querySelector('.paper').style.display === 'none'"));

  // ---- the pocket: on the HUD with how full it is; its sheet with the pocket, the chest at home and the keys
  check('the pocket shows how full it is', /^\d+\/\d+$/.test(await page.eval("document.querySelector('.hud-pocket .pocket-num')?.textContent ?? ''")));
  await click('.hud-pocket');
  check('the pocket sheet has the pocket, the chest and the keyring', (await page.eval("[...document.querySelectorAll('.pocket-tabs .tab')].map((b) => b.textContent).join('|')")).includes('Скриня вдома'));
  await click('.pocket .paper-close, .pocket .ph .round');

  check('first run places the starter room and furnishes the whole house', s.placements.length > 40, String(s.placements.length));
  check('the house has its rooms, garden, vegetable plot and orangery', s.room.cells > 300, String(s.room.cells));
  const reach = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.debugReachable())'));
  check('every room of the house can be walked into', Object.values(reach).every(Boolean) && Object.keys(reach).length >= 7, JSON.stringify(reach));
  check('the starter room spends 100 of 300 coins', s.coins === 200, String(s.coins));
  check('storage is IndexedDB', s.storage === 'indexeddb', s.storage);
  check('walking mode at start', s.mode === 'walk');

  // ---- at home the action button puts the hero ON the thing: in the bath, on the bed, on the chair
  for (const [item, mode] of [['bathtub', 'bath'], ['bed', 'lie'], ['dining_chair_wood', 'sit']]) {
    const seated = await page.eval(`(async () => {
      const g = window.__teul.game;
      const p = g.debugState().placements.find((q) => q.item === '${item}');
      if (!p) return 'no ${item}';
      // stand on a free cell next to it, then press the action button
      // get up first (a step does it), as a player would
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown', bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      const near = [];
      for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) near.push([dx, dy]);
      for (const [dx, dy] of near) {
        g.debugTeleport(p.x + dx + 0.5, p.y + dy + 0.5);
        await new Promise((r) => setTimeout(r, 250));
        if (g.target && g.target.pid === p.pid) break;
      }
      if (!g.target || g.target.pid !== p.pid) return 'not reachable';
      g.act();
      await new Promise((r) => setTimeout(r, 400));
      const seat = g.seat;
      const out = seat ? seat.mode + ':' + seat.pid : 'standing';
      g.debugTeleport(p.x - 0.5, p.y - 0.5);
      return out === '${mode}:' + p.pid ? 'ok' : out;
    })()`);
    check(`the action button at home puts the hero on the ${item} (${mode})`, seated === 'ok', String(seated));
  }
  const throughWall = await page.eval(`(async () => {
    const g = window.__teul.game;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown', bubbles: true }));
    const bed = g.debugState().placements.find((q) => q.item === 'bed');
    const home = g.regionAt(bed.x + 0.5, bed.y + 0.5);
    // a cell right by the bed but in the next room, through the wall
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 3; dx++) {
      const x = bed.x + dx + 0.5, y = bed.y + dy + 0.5;
      const r = g.regionAt(x, y);
      if (r === home || r < 0) continue;
      g.debugTeleport(x, y);
      await new Promise((res) => setTimeout(res, 300));
      if (g.target && g.target.pid === bed.pid) return 'reached through the wall from ' + x + ',' + y;
    }
    return 'ok';
  })()`);
  check('nothing is used through a wall from the next room', throughWall === 'ok', String(throughWall));
  await page.shot('/tmp/shots/e2e-1-first-run.png');

  // ---- walking
  await page.eval('window.__teul.game.debugTeleport(3.5, 4.5)');
  const before = (await state()).walker;
  await press('KeyD', 700);
  const after = (await state()).walker;
  check('keyboard walking moves the figure', Math.hypot(after.x - before.x, after.y - before.y) > 1, JSON.stringify([before, after]));
  check('screen-right is grid +x/-y', after.x > before.x && after.y < before.y, JSON.stringify([before, after]));
  for (let i = 0; i < 40; i++) await press('KeyA', 120);
  s = await state();
  check('the figure stays inside the room', s.walker.x >= 0 && s.walker.y >= 0 && s.walker.x < 10 && s.walker.y < 10, JSON.stringify(s.walker));

  // ---- tap to walk, sit down, stand up with the stick
  // (the living room is furnished: the open floor is by the window, round the rug and the sofa)
  await page.eval('window.__teul.game.debugTeleport(3.5, 8.5)');
  await tapCell(6, 8);
  await page.sleep(1800);
  s = await state();
  check('tapping the floor walks there', Math.hypot(s.walker.x - 6.5, s.walker.y - 8.5) < 0.2, JSON.stringify(s.walker));
  const stoolAt = s.placements.find((p) => p.item === 'stool');
  const stoolPid = stoolAt?.pid;
  await tapCell(stoolAt.x, stoolAt.y);
  await page.sleep(1800);
  s = await state();
  check('tapping a stool walks to it and sits down', s.seat === stoolPid, JSON.stringify([s.seat, stoolPid, s.walker, s.path]));
  await page.shot('/tmp/shots/e2e-1b-seated.png');
  await press('KeyD', 300);
  check('moving with the keys stands up', (await state()).seat === null);

  // ---- doing something earns coins
  await page.eval('window.__teul.game.debugTeleport(2.4, 1.5)');
  await page.sleep(200);
  s = await state();
  check('standing by the fern offers an action', s.target && s.target.kind === 'item' && s.target.action === 'water_plant', JSON.stringify(s.target));
  const coins0 = s.coins;
  await press('Enter', 60);
  await page.sleep(200);
  s = await state();
  check('watering pays nothing (no coins from chores at home)', s.coins === coins0, `${coins0} -> ${s.coins}`);
  await page.shot('/tmp/shots/e2e-2-action.png');

  // ---- shop: buy a stool
  await click('.hud-tr button[aria-label="Магазин"]');
  await page.sleep(400);
  check('the shop sheet opens', (await state()).sheet === true);
  const freeBefore = (await state()).free.stool ?? 0;
  const bought = await clickText('.card', 'Табурет');
  await page.sleep(200);
  await click('.detail .cta.buy');
  await page.sleep(300);
  s = await state();
  check('the stool card exists', bought === true);
  check('buying a stool costs 25 coins and adds one', s.coins === coins0 - 25 && (s.free.stool ?? 0) === freeBefore + 1, JSON.stringify([s.coins, s.free]));
  await page.shot('/tmp/shots/e2e-3-shop.png');

  // ---- a locked item shows what is missing, and does not change coins
  const coinsLocked = (await state()).coins;
  await clickText('.card', 'Піаніно');
  await page.sleep(200);
  await click('.detail .cta.buy');
  await page.sleep(300);
  check('a locked item does not spend anything', (await state()).coins === coinsLocked);
  check('a message explains why', (await page.eval("document.querySelectorAll('.toast.error').length")) >= 1);

  // ---- edit mode: place the stool
  await click('.sheet button[aria-label="Готово"]');
  await page.sleep(300);
  await click('.hud-tr button[aria-label="Кімната"]');
  await page.sleep(300);
  s = await state();
  check('edit mode is on', s.mode === 'edit');
  const placedBefore = s.placements.length;
  await click('.edit-bar .strip .item[aria-label="Табурет"]');
  await page.sleep(200);
  s = await state();
  check('tapping an inventory item holds it', s.held && s.held.item === 'stool', JSON.stringify(s.held));
  await tapCell(5, 7);
  s = await state();
  check('tapping the floor places it', s.placements.length === placedBefore + 1, `${placedBefore} -> ${s.placements.length}`);
  const stool = s.placements.find((p) => p.item === 'stool' && p.x === 5 && p.y === 7);
  check('it landed on the tapped cell', !!stool, JSON.stringify(s.placements));
  await page.shot('/tmp/shots/e2e-4-edit.png');

  // ---- leaving the editor
  await click('.edit-bar .tools .round.done');
  await page.sleep(200);
  check('leaving edit mode returns to walking', (await state()).mode === 'walk');

  // ---- studio: paint, shape, world, undo
  await click('.hud-tr button[aria-label="Кімната"]');
  await page.sleep(300);
  await page.eval('window.__teul.game.debugTeleport(3.5, 4.5)');
  await click('.hud-tr button[aria-label="Готово"], .edit-bar .tools .round.done');
  await page.sleep(200);
  for (let i = 0; i < 3; i++) {
    await page.eval('window.__teul.game.debugTeleport(2.4, 1.5)');
    await page.sleep(150);
    await press('Enter', 60);
    await page.sleep(1700);
  }
  await click('.hud-tr button[aria-label="Кімната"]');
  await page.sleep(300);
  await click('.modes button[aria-label="Фарба"]');
  await page.sleep(200);
  let coinsPaint = (await state()).coins;
  check('there are coins for a style', coinsPaint >= 60, String(coinsPaint));
  await clickText('.strip .chip', 'Сосна');
  await page.sleep(300);
  s = await state();
  check('choosing a locked style buys it for its price', s.coins === coinsPaint - 60, `${coinsPaint} -> ${s.coins}`);
  await tapCell(1, 1);
  await page.sleep(200);
  s = await state();
  check('tapping the floor paints that cell', s.room.floorPaint['1,1'] === 'floor.pine', JSON.stringify(s.room.floorPaint));
  await click('.tools button[aria-label="Скасувати"]');
  await page.sleep(200);
  s = await state();
  check('undo removes the paint', s.room.floorPaint['1,1'] === undefined, JSON.stringify(s.room.floorPaint['1,1']));
  await click('.tools button[aria-label="Повторити"]');
  await page.sleep(200);
  check('redo paints again', (await state()).room.floorPaint['1,1'] === 'floor.pine');
  await page.shot('/tmp/shots/e2e-5-paint.png');

  await click('.modes button[aria-label="Форма"]');
  await page.sleep(200);
  const cellsBefore = (await state()).room.cells;
  await clickText('.strip .chip', 'Прибрати підлогу');
  await tapCell(6, 8);
  await page.sleep(200);
  s = await state();
  check('the remove brush takes a cell out of the room', s.room.cells === cellsBefore - 1, `${cellsBefore} -> ${s.room.cells}`);
  await click('.tools button[aria-label="Скасувати"]');
  await page.sleep(200);
  check('undo puts the cell back', (await state()).room.cells === cellsBefore);

  await click('.modes button[aria-label="Світ"]');
  await page.sleep(200);
  await clickText('.strip .chip', 'Зафіксований');
  await page.sleep(200);
  s = await state();
  check('world mode fixes the time of day', s.room.settings.time_mode === 'fixed', JSON.stringify(s.room.settings));
  await page.shot('/tmp/shots/e2e-6-world.png');
  await click('.edit-bar .tools .round.done');
  await page.sleep(200);

  // ---- workshop: build an item, hold it, place it, and keep it after a reload
  await click('.hud-tr button[aria-label="Кімната"]');
  await page.sleep(300);
  await click('.modes button[aria-label="Речі"]');
  await page.sleep(200);
  await click('.edit-bar .tools button[aria-label="Майстерня"]');
  await page.sleep(400);
  check('the workshop opens', (await page.eval("getComputedStyle(document.querySelector('.workshop')).display")) !== 'none');
  await page.eval(`(() => {
    const c = document.querySelector('.ws-canvas');
    const r = c.getBoundingClientRect();
    let n = 0;
    for (const fy of [0.55, 0.6, 0.65, 0.7]) for (const fx of [0.4, 0.45, 0.5, 0.55, 0.6]) {
      const o = { clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, pointerId: 7 + n++, bubbles: true, isPrimary: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    }
  })()`);
  await page.sleep(200);
  const blocks = await page.eval("document.querySelector('.ws-side .hint').textContent");
  check('tapping the plate adds blocks', /Дай назву/.test(blocks), blocks);
  await page.eval(`(() => { const i = document.querySelector('.ws-name'); i.value = 'Мій пуф'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.eval(`document.querySelector('.ws-side .ph').querySelector('.save').removeAttribute('disabled')`);
  await clickText('.ws-side .chip', 'Зберегти');
  await page.sleep(500);
  s = await state();
  check('the saved item is in the inventory and held', Object.keys(s.free).some((k) => k.startsWith('custom.')) && s.held && s.held.item.startsWith('custom.'), JSON.stringify([s.free, s.held]));
  // (it is 3×3 and centred on the tapped cell: by the front door, over the mat, the floor is free)
  await tapCell(2, 8);
  await page.sleep(200);
  s = await state();
  check('the custom item can be placed', s.placements.some((p) => p.item.startsWith('custom.')), JSON.stringify(s.placements.map((p) => p.item)));
  await click('.edit-bar .tools .round.done');
  await page.sleep(200);

  // ---- rotating the view
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', bubbles: true }))");
  await page.sleep(500);
  check('the view turns a quarter', (await state()).room.view === 1);
  await page.shot('/tmp/shots/e2e-7-rotated.png');

  // ---- out of the front door: the village and its people
  await page.eval('window.__teul.game.debugTeleport(0.5, 7.5)');
  await page.sleep(400);
  s = await state();
  check('by the front door the action button opens it', s.target?.kind === 'door', JSON.stringify(s.target));
  await press('Enter', 60);
  await page.sleep(800);
  s = await state();
  check('the front door leads to the village', s.location === 'village', s.location);
  check('the town is one big map (with the outskirts street «Новобудовна» in the south)', s.room.cells === 74 * 114, String(s.room.cells));
  check('eight people live in the village', s.npcs.length === 8, String(s.npcs.length));
  await page.shot('/tmp/shots/e2e-v1-village.png');
  let someone = s.npcs.find((n) => n.shown);
  if (someone) {
    // walk up to them by tapping them and choosing to talk
    // stand a few steps away (they may be across the village)
    await page.eval(`(() => { const g = window.__teul.game; const n = g.debugState().npcs.find((q) => q.id === '${someone.id}'); g.debugTeleport(n.x, n.y + 2.5); })()`);
    await page.sleep(400);
    await page.eval(`(() => {
      const c = document.getElementById('scene');
      const r = c.getBoundingClientRect();
      const p = window.__teul.game.debugNpcScreen('${someone.id}');
      const o = { clientX: r.left + p.x, clientY: r.top + p.y, pointerId: 1, bubbles: true, isPrimary: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    })()`);
    await page.sleep(300);
    s = await state();
    check('tapping someone offers to talk', s.bubble === true);
    await clickText('.bubble-btn', 'Поговорити');
    for (let i = 0; i < 60 && !(await state()).dialogue; i++) await page.sleep(200);
  } else {
    // late at night everyone is at home; talk to someone directly
    console.log('note: nobody is out at this hour; talking without the tap');
    someone = s.npcs[0];
    await page.eval(`window.__teul.game.debugTalk('${someone.id}')`);
    await page.sleep(300);
  }
  s = await state();
  check('talking opens a dialogue', typeof s.dialogue === 'string' && s.dialogue.length > 5, String(s.dialogue));
  // the tap may have found whoever stood nearest the finger
  const met = s.npcs.find((n) => n.points > 0);
  check('the first talk of the day brings friendship', met?.points === 20, JSON.stringify(s.npcs));
  await page.sleep(1500);
  await page.shot('/tmp/shots/e2e-v2-dialogue.png');
  await clickText('.dlg-choices .chip', 'Подарувати');
  await page.sleep(300);
  check('a gift opens the picker', await page.eval(`getComputedStyle(document.querySelector('.settings.gift')).display !== 'none'`));
  await page.eval(`document.querySelector('.settings.gift .round').click()`);
  await click('[aria-label="Мешканці"]');
  await page.sleep(300);
  check('the people panel lists everyone', (await page.eval(`document.querySelectorAll('.people .person').length`)) === 8);
  await page.shot('/tmp/shots/e2e-v3-people.png');
  await page.eval(`document.querySelector('.settings.people .round').click()`);
  // the day: mail, gathering, fishing
  await page.eval('window.__teul.game.debugGo(\'village\')');
  await page.sleep(600);
  // a new world has no neighbours' letters yet (they write once they know one): the mail is read when there is some
  const unreadNow = await page.eval('(window.__teul.game.daily?.letters ?? []).filter((l) => !l.opened).length');
  if (unreadNow > 0) {
    const badge = Number(await page.eval(`document.querySelector('.today-btn .badge')?.textContent || '0'`));
    check('the today button shows what waits', badge > 0, String(badge));
    await click('.today-btn');
    await page.sleep(300);
    const unread = await page.eval(`document.querySelectorAll('.today .letter:not(.opened)').length`);
    await page.eval(`document.querySelector('.today .letter .cta').click()`);
    await page.sleep(300);
    check('opening a letter reads it', (await page.eval(`document.querySelectorAll('.today .letter:not(.opened)').length`)) === unread - 1);
    await page.shot('/tmp/shots/e2e-v4-mail.png');
    await page.eval(`document.querySelector('.today .round').click()`);
  } else {
    console.log('(no letters yet in a new world: the mail is skipped)');
  }
  const spot = JSON.parse(await page.eval(`JSON.stringify(window.__teul.game.village.def.spots.find((s) => s.id.includes('beach')))`));
  await page.eval(`window.__teul.game.debugTeleport(${spot.x + 0.5}, ${spot.y + 0.5})`);
  await page.sleep(400);
  await press('Enter', 60);
  await page.sleep(500);
  const found = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.daily.collected)'));
  check('a twinkling spot gives something for the album', found.length === 1, JSON.stringify(found));
  await page.eval('(() => { const f = window.__teul.engine.catalog.locations.village.fishing[0]; window.__teul.game.debugTeleport(f.x + f.w - 0.5, f.y + 0.5); })()');
  await page.sleep(400);
  await press('Enter', 60);
  let landed = false;
  for (let i = 0; i < 60 && !landed; i++) {
    await page.sleep(100);
    if (await page.eval(`!!document.querySelector('.fishing .float.bite')`)) {
      await page.eval(`document.querySelector('.fishing .fish-actions .cta').click()`);
      landed = true;
    }
  }
  await page.sleep(400);
  const dayAfter = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.daily)'));
  check('a fish bites and is landed', landed && dayAfter.catches_left === 11, String(dayAfter.catches_left));
  await page.shot('/tmp/shots/e2e-v5-fish.png');

  // ---- into a public building and out again
  const school = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.catalog.sites.school_site)'));
  await page.eval(`window.__teul.game.debugTeleport(${school.x + 0.5}, ${school.y - 0.5})`);
  await page.sleep(300);
  await tapCell(school.x, school.y + 2);
  await page.sleep(300);
  // one thing to do there: the player just goes in (with more, a bubble asks)
  await clickText('.bubble-btn', 'Увійти');
  for (let i = 0; i < 30 && (await state()).location !== 'school_in'; i++) await page.sleep(150);
  s = await state();
  check('the school can be entered', s.location === 'school_in', s.location);
  await page.shot('/tmp/shots/e2e-v6-school.png');
  // the way out: the middle of the classroom's door in the south wall
  const way = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.catalog.locations.school_in.exits[0])`));
  await tapCell(way.x + 1, way.y);
  for (let i = 0; i < 30 && (await state()).location !== 'village'; i++) await page.sleep(150);
  s = await state();
  check('the classroom door leads back out to the street', s.location === 'village' && Math.hypot(s.walker.x - school.x - 0.5, s.walker.y - school.y - 0.5) < 2, `${s.location} ${JSON.stringify(s.walker)}`);

  // ---- a worn thing from a bin, mended at the workshop
  const bin = JSON.parse(await page.eval(`JSON.stringify(window.__teul.game.village.def.spots.find((s) => s.id.includes('.bin.') && !window.__teul.game.daily.gathered_today.includes(s.id)) ?? null)`));
  if (bin) {
    await page.eval(`window.__teul.game.debugTeleport(${bin.x + 0.5}, ${bin.y + 0.5})`);
    await page.sleep(400);
    await press('Enter', 60);
    await page.sleep(500);
    const worn = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.inventory().filter((i) => i.item.startsWith('worn_')))`));
    check('a bin had a worn thing in it today', worn.length === 1, JSON.stringify(worn));
  } else {
    console.log('(no bin holds anything today in this world: the find is skipped)');
  }
  const shop = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.catalog.sites.workshop_site)'));
  await page.eval(`window.__teul.game.debugTeleport(${shop.x + 0.5}, ${shop.y - 0.5})`);
  await page.sleep(300);
  // a touch on the building goes in, like every door in the town; the mending is at the workbench inside
  await tapCell(shop.x, shop.y + 2);
  for (let i = 0; i < 20 && (await page.eval('window.__teul.game.location')) !== 'workshop_in'; i++) await page.sleep(250);
  check('a touch on the workshop takes one in', (await page.eval('window.__teul.game.location')) === 'workshop_in');
  const bench = JSON.parse(await page.eval("JSON.stringify(window.__teul.game.room.placements.find((p) => p.item === 'workbench'))"));
  await page.eval(`window.__teul.game.debugTeleport(${bench.x + 0.5}, ${bench.y + 1.5})`);
  await page.sleep(300);
  await tapCell(bench.x, bench.y);
  await page.sleep(300);
  check('the workshop offers to mend things', await clickText('.bubble-btn', 'Відновити'));
  await page.sleep(1200);
  check('the workshop opens', await page.eval(`getComputedStyle(document.querySelector('.settings.workshop')).display !== 'none'`));
  await page.shot('/tmp/shots/e2e-v7-workshop.png');
  if (bin) {
    const coins = (await state()).coins;
    await page.eval(`document.querySelector('.workshop-row .cta').click()`);
    await page.sleep(400);
    const mended = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.inventory().filter((i) => i.free > 0).map((i) => i.item))`));
    check('mending costs coins and gives the thing back as new', (await state()).coins < coins && !mended.some((i) => i.startsWith('worn_')), JSON.stringify(mended));
  }
  await key('keydown', 'Escape');
  await page.sleep(200);

  // ---- the library's computer has games on it
  await page.eval(`window.__teul.game.enterLocation('library_in', [5, 7])`);
  // seen from the usual corner, so the tall shelves are not in front of the desk
  await page.eval(`(() => { const g = window.__teul.game; for (let i = 0; i < 4 && g.view !== 0; i++) g.rotateView(1); })()`);
  await page.sleep(800);
  // the desk's top, where the screen is (not the floor behind it)
  await page.eval(`(() => {
    const c = document.getElementById('scene');
    const r = c.getBoundingClientRect();
    const pc = window.__teul.game.room.placements.find((q) => q.item === 'pc_desk');
    const p = window.__teul.game.renderer.toScreen(pc.x + 1.5, pc.y + 0.4, 76);
    const o = { clientX: r.left + p.x, clientY: r.top + p.y, pointerId: 1, bubbles: true, isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  })()`);
  await page.sleep(300);
  await clickText('.bubble-btn', 'Ігри');
  for (let i = 0; i < 30 && !(await page.eval(`document.querySelector('.arcade').style.display !== 'none'`)); i++) await page.sleep(150);
  check('the library computer opens its games', await clickText('.arcade-menu .cta', 'Цеглинки'));
  await page.sleep(400);
  for (const k of ['ArrowLeft', 'ArrowUp', 'Space']) await press(k, 40);
  await page.sleep(300);
  await page.shot('/tmp/shots/e2e-v8-games.png');
  await key('keydown', 'Escape');
  await key('keydown', 'Escape');
  await page.sleep(200);
  check('the games close', await page.eval(`document.querySelector('.arcade').style.display === 'none'`));
  await page.eval('window.__teul.game.debugGo(\'village\')');
  await page.sleep(400);

  // ---- the taxi from the square (the racecourse is locked; the farm is not)
  const stops = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.engine.catalog.taxi)'));
  const sq = stops['taxi.square'];
  await page.eval(`window.__teul.game.debugTeleport(${sq.x - 2.5}, ${sq.y + 0.5})`);
  await page.sleep(300);
  const sign = JSON.parse(await page.eval(`JSON.stringify(window.__teul.game.room.placements.find((p) => p.item === 'taxi_sign' && Math.abs(p.x - ${sq.x}) + Math.abs(p.y - ${sq.y}) <= 2))`));
  await page.eval(`(() => {
    const c = document.getElementById('scene');
    const r = c.getBoundingClientRect();
    const p = window.__teul.game.renderer.toScreen(${sign.x + 0.5}, ${sign.y + 0.5}, 60);
    const o = { clientX: r.left + p.x, clientY: r.top + p.y, pointerId: 1, bubbles: true, isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  })()`);
  await page.sleep(300);
  await clickText('.bubble-btn', 'таксі');
  for (let i = 0; i < 30 && !(await page.eval(`document.querySelector('.settings.taxi').style.display !== 'none'`)); i++) await page.sleep(150);
  const coinsBefore = (await state()).coins;
  const places = JSON.parse(await page.eval('JSON.stringify(window.__teul.game.taxiPlaces)'));
  check('the taxi goes everywhere: the church, the hostel, the bread factory, the vineyard', [/Костел/, /Хостел/, /[Хх]ліб/, /Лоза/].every((re) => places.some((p) => re.test(p.name))), places.map((p) => p.name).join(', '));
  const farmFare = places.find((p) => p.id === 'taxi.farm').fare;
  // the racecourse wants a pass at its gate: without one the taxi does not take you (and charges nothing)
  check('the taxi stand lists where it goes', await clickText('.taxi-stop', 'Іподром'));
  await page.sleep(700);
  s = await state();
  check('a locked place is not reached by taxi either', s.location === 'village' && s.coins === coinsBefore, `${s.location} ${s.coins}`);
  await page.eval(`window.__teul.game.rideTaxi('taxi.farm')`);
  for (let i = 0; i < 30 && (await state()).location !== 'farm'; i++) await page.sleep(150);
  s = await state();
  check('the taxi takes the player to the farm for its fare', s.location === 'farm' && s.coins === coinsBefore - farmFare, `${s.location} ${s.coins}`);
  await page.shot('/tmp/shots/e2e-v9-farm.png');
  await page.eval('window.__teul.game.debugGo(\'village\')');
  await page.sleep(400);

  // home again by the player's own house
  const entry = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.catalog.locations.village.entry)'));
  await page.eval(`window.__teul.game.debugTeleport(${entry[0] + 0.5}, ${entry[1] + 0.5})`);
  await page.sleep(200);
  await tapCell(entry[0] - 1, entry[1] - 2);
  await page.sleep(600);
  s = await state();
  check('the house in the village leads home', s.location === 'home', s.location);
  check('back home by the front door', Math.hypot(s.walker.x - 0.5, s.walker.y - 7.5) < 1.5, JSON.stringify(s.walker));

  // ---- a station in town gives something into the pocket; a help shows what it needs
  const station = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    // whatever is open at this hour, in any open place (stalls keep their hours, the test runs at any time)
    const open = e.locations(g.now()).places;
    const all = e.stations(g.now()).filter((s) => s.gives.length > 0 && (s.ok || s.reason === null || s.reason === 'not_here') && open[s.location]?.open !== false);
    for (const st of all) {
      const loc = e.catalog.locations?.[st.location];
      if (st.location === 'village') g.debugGo('village');
      else if (loc && (loc.entry || loc.exits?.length)) g.enterLocation(st.location, loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
      else continue;
      await new Promise((r) => setTimeout(r, 700));
      if (e.locations(g.now()).location !== st.location) continue;
      const now = e.stations(g.now()).find((s) => s.id === st.id);
      if (!now || !now.ok) continue;
      const before = e.pocket().used;
      g.useStation(st.id);
      await new Promise((r) => setTimeout(r, 300));
      return e.pocket().used > before ? 'ok' : 'nothing came: ' + st.id;
    }
    const closed = e.stations(g.now()).filter((s) => s.reason === 'closed').length;
    return closed > 0 ? 'ok' : 'no station works and none says it is closed';
  })()`);
  check('a station in town puts what it gives into the pocket', station === 'ok', String(station));
  const help = await page.eval(`(() => {
    const g = window.__teul.game;
    const h = window.__teul.engine.helps(g.now()).find((x) => x.available && !x.done);
    if (!h) return 'no help';
    g.openHelp(h);
    const ok = document.querySelector('.ask').style.display === '' && document.querySelectorAll('.ask-lines li').length > 0;
    g.ask.close();
    return ok ? 'ok' : 'dialog empty';
  })()`);
  check('a help shows what it needs and what it brings', help === 'ok', String(help));
  const locked = await page.eval(`(() => {
    const v = window.__teul.engine.locations(window.__teul.game.now());
    const shut = Object.entries(v.places).filter(([, a]) => !a.open);
    return shut.length > 0 && shut.every(([, a]) => a.hint.length > 10) ? 'ok' : JSON.stringify(shut.slice(0, 3));
  })()`);
  check('locked places are locked and say where to look', locked === 'ok', String(locked));


  // ---- the utility office stands in the town; its counter shows the bills (none in a new home's first month)
  const office = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    if (!e.catalog.locations.village.props.some((p) => p.item === 'utility_office')) return 'no office in the village';
    const loc = e.catalog.locations.utility_in;
    if (!loc) return 'no utility_in';
    g.enterLocation('utility_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
    await new Promise((r) => setTimeout(r, 800));
    if (e.locations(g.now()).location !== 'utility_in') return 'did not get in';
    const counter = g.room.placements.find((p) => p.item === 'bill_counter');
    if (!counter) return 'no counter';
    if (!g.optionsFor(counter.pid).includes('bills')) return 'the counter has no bills';
    g.doUse(counter.pid, 'bills');
    const text = document.querySelector('.bills-sheet')?.textContent ?? '';
    g.billsSheet.close();
    return /Вода/.test(text) && /Електрика/.test(text) && /Газ/.test(text) ? 'ok' : text.slice(0, 120);
  })()`);
  check('the utility office counter shows the bills for water, electricity, gas and garbage', office === 'ok', String(office));
  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(800);
  check('out of the house a taxi can be called from anywhere', await page.eval("getComputedStyle(document.querySelector('.hud-taxi')).display !== 'none'"));
  await click('.hud-taxi');
  await page.sleep(300);
  check('the taxi button opens the stops', await page.eval("window.__teul.game.taxi.isOpen() && document.querySelectorAll('.taxi-body button').length > 3"));
  await page.eval('window.__teul.game.taxi.close()');
  await page.eval('window.__teul.game.goHome()');
  await page.sleep(800);
  check('at home there is no taxi button', await page.eval("getComputedStyle(document.querySelector('.hud-taxi')).display === 'none'"));
  // ---- at home: the fridge and the stove open their sheets; the Today panel has the bills
  const kitchen = await page.eval(`(() => {
    const g = window.__teul.game;
    const fridge = g.room.placements.find((p) => p.item === 'fridge');
    const stove = g.room.placements.find((p) => p.item === 'stove');
    if (!fridge || !stove) return 'no fridge or stove at home';
    if (!g.optionsFor(fridge.pid).includes('fridge') || !g.optionsFor(stove.pid).includes('cook')) return 'no options';
    g.doUse(fridge.pid, 'fridge');
    const f = document.querySelector('.fridge')?.style.display === '' && /У холодильнику/.test(document.querySelector('.fridge').textContent);
    g.fridgeSheet.close();
    g.doUse(stove.pid, 'cook');
    const recipes = document.querySelectorAll('.cook .recipe').length;
    const omelette = [...document.querySelectorAll('.cook .recipe')].some((r) => /Омлет/.test(r.textContent) && /Яйця|яйця/.test(r.textContent));
    g.cookSheet.close();
    return f && recipes >= 8 && omelette ? 'ok' : JSON.stringify({ f, recipes, omelette });
  })()`);
  check('at home the fridge opens and the stove lists what can be cooked', kitchen === 'ok', String(kitchen));
  const billsTab = await page.eval(`(() => {
    const g = window.__teul.game;
    g.openToday();
    const tab = [...document.querySelectorAll('.chip')].find((b) => /Рахунки/.test(b.textContent));
    if (!tab) return 'no tab';
    tab.click();
    const text = document.querySelector('.bills')?.textContent ?? '';
    g.todayPanel.close();
    return /безкоштовно|сплачено|до /.test(text) ? 'ok' : text.slice(0, 100);
  })()`);
  check('the Today panel has the bills', billsTab === 'ok', String(billsTab));

  // ---- people walk round things, never through them
  const stuck = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      for (const s of g.debugStuckPeople()) seen.add(s.split('@')[0] + '@' + s.split('@')[1].split(',').map((v) => Math.floor(Number(v))).join(','));
    }
    g.goHome();
    return [...seen];
  })()`);
  await page.sleep(800);
  check('people in town never stand in a bench, a tree, a wall or the water', stuck.length === 0, JSON.stringify(stuck.slice(0, 12)));

  // ---- persistence across a reload
  const saved = await state();
  await page.goto(URL0);
  for (let i = 0; i < 60 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await page.sleep(400);
  check('a saved world is continued from the title', (await page.eval("document.querySelector('.title-screen .screen-go')?.textContent ?? ''")) === 'Продовжити');
  await click('.title-screen .screen-go');
  await page.sleep(2600);
  check('a saved world does not ask for the hero again', !(await page.eval("!!document.querySelector('.hero-screen')")));
  // the goodbye: from the settings, over a saved world, and back again
  await page.eval('window.__teul.game.openSettings()');
  await clickText('.settings .cta', 'Вийти з гри');
  await page.sleep(600);
  check('leaving shows the goodbye with the world saved', /збережено/.test(await page.eval("document.querySelector('.exit-screen .title-sub')?.textContent ?? ''")));
  await clickText('.exit-screen .cta', 'Повернутися');
  await page.sleep(300);
  check('back from the goodbye into the world', !(await page.eval("!!document.querySelector('.exit-screen')")));
  const reloaded = await state();
  check('a custom item survives a reload', reloaded.placements.some((p) => p.item.startsWith('custom.')));
  check('the room survives a reload', reloaded.placements.length === saved.placements.length, `${saved.placements.length} vs ${reloaded.placements.length}`);
  check('the wallet survives a reload', reloaded.coins === saved.coins, `${saved.coins} vs ${reloaded.coins}`);
  check('friendship survives a reload', reloaded.npcs.some((n) => n.points === 20), JSON.stringify(reloaded.npcs));
  check('a reload is not a first run again', reloaded.placements.length > 0 && reloaded.placements.length === saved.placements.length);

  // ---- the notebook: who asks, a promise made on the square, a day's small need done to the end
  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(800);
  await page.eval("window.__teul.game.openJournal('asked')");
  await page.sleep(200);
  const asked = await page.eval("[...document.querySelectorAll('.journal-entry b')].map((b) => b.textContent)");
  check('the notebook shows who would be glad of a hand', Array.isArray(asked) && asked.length > 0, JSON.stringify(asked));
  check('the notebook announces no prizes and counts nothing', !(await page.eval("/нагород|винагород|\\d+\\/\\d+|ліміт|квест|завдання/i.test(document.querySelector('.journal').textContent)")));
  const promised = await page.eval(`(() => {
    const g = window.__teul.game;
    const o = window.__teul.engine.quests(g.now()).offers.find((x) => x.kind === 'calendar' && x.can_start && !x.reason);
    if (!o) return 'none';
    g.promise(o.key);
    const v = window.__teul.engine.quests(g.now());
    return v.active.some((a) => a.key === o.key) ? o.key : 'not promised';
  })()`);
  check('a calendar request can be promised on the square', promised !== 'none' && promised !== 'not promised', String(promised));
  check('the promise followed shows as a line under the clock', /^→ /.test(await page.eval("document.querySelector('.hud-quest')?.textContent ?? ''")));
  await page.eval('window.__teul.game.journal.close()');
  const job = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const doable = /^job\\.(parcels|letter|medicine)$/;
    // the town's needs come by the day; find the next day with one that can be done here and now
    for (let d = 0; d < 40; d++) {
      const v = e.quests(g.now() + d * 1440);
      const o = v.offers.find((x) => x.kind === 'job' && doable.test(x.id) && x.can_start);
      if (!o) continue;
      g.debugOffset += d * 1440;
      g.debugGo('village');
      await new Promise((r) => setTimeout(r, 700));
      g.promise(o.key);
      for (let guard = 0; guard < 6; guard++) {
        const q = e.quests(g.now()).active.find((a) => a.key === o.key);
        if (!q) break;
        const loc = q.location;
        if (loc && loc !== e.locations(g.now()).location) {
          if (loc === 'village') g.debugGo('village');
          else g.enterLocation(loc, e.catalog.locations[loc].entry ?? [e.catalog.locations[loc].exits[0].x, e.catalog.locations[loc].exits[0].y]);
          await new Promise((r) => setTimeout(r, 700));
        }
        g.questStep(o.key, null);
        await new Promise((r) => setTimeout(r, 200));
      }
      const done = e.quests(g.now()).done.some((x) => x.key === o.key);
      return done ? 'ok' : 'not done: ' + o.key;
    }
    return 'none in forty days';
  })()`);
  check('a small need of the day is taken and seen through', job === 'ok', String(job));
  check('thanks come at the end, in the person\'s words', job === 'ok' && (await page.eval("document.querySelector('.ask')?.style.display === '' && document.querySelector('.ask-text').textContent.length > 0")));
  await page.eval('window.__teul.game.ask.close()');
  // ---- photos: the interface steps aside, the shutter keeps a picture in the album
  await click('.hud-photo');
  await page.sleep(300);
  check('photo mode hides the interface and shows the shutter', await page.eval("document.getElementById('app').classList.contains('photo-mode') && document.querySelector('.photo-bar').style.display === ''"));
  const photosBefore = await page.eval('window.__teul.game.album().then((a) => a.list()).then((l) => l.length)');
  await click('.photo-shutter');
  await page.sleep(900);
  const photosAfter = await page.eval('window.__teul.game.album().then((a) => a.list()).then((l) => l.length)');
  check('a photo goes into the album', photosAfter === photosBefore + 1, `${photosBefore} → ${photosAfter}`);
  await clickText('.photo-bar .cta', 'Альбом');
  await page.sleep(500);
  check('the album shows the photo with where and when', await page.eval("document.querySelectorAll('.album-thumb').length >= 1 && /Липове|Дім/.test(document.querySelector('.album-thumb').getAttribute('aria-label'))"));
  await page.eval('window.__teul.game.back()');
  await page.eval('window.__teul.game.back()');
  check('leaving photo mode brings the interface back', !(await page.eval("document.getElementById('app').classList.contains('photo-mode')")));

  // ---- two weeks later, at Halloween (the clock only moves forward): a word of what happened, and pumpkins in town
  const nowReal = new Date();
  let hallowe = new Date(nowReal.getFullYear(), 9, 28, 12, 0);
  if (hallowe.getTime() - nowReal.getTime() < 2 * 86_400_000) hallowe = new Date(nowReal.getFullYear() + 1, 9, 28, 12, 0);
  const ahead = Math.round((hallowe.getTime() - nowReal.getTime()) / 60_000);
  await page.goto(`${BASE}?debug&shift=${ahead}`);
  for (let i = 0; i < 40 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await click('.title-screen .screen-go');
  for (let i = 0; i < 30 && !(await page.eval("document.querySelector('.paper')?.style.display === ''")); i++) await page.sleep(200);
  check('after days away the paper tells what happened: the missed issues on top, no separate screen', (await page.eval("document.querySelector('.paper-away h3')?.textContent ?? ''")) === 'Поки тебе не було' && (await page.eval("document.querySelectorAll('.paper-back').length")) >= 2 && !(await page.eval("document.querySelector('.ask')?.style.display === ''")));
  await page.eval("document.querySelector('.paper-close')?.click()");
  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(900);
  check('at Halloween carved pumpkins stand by the houses', await page.eval("window.__teul.game.room.placements.filter((p) => p.item === 'pumpkin_lantern').length >= 3"));

  // ---- work: a shift at the café, paid by the town; the garden: sown, watered, sprouting; «Я»
  const shiftPaid = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // the next morning at ten, when the café takes help
    const m = g.now() % 1440;
    g.debugOffset += (((10 * 60 - m) % 1440) + 1440) % 1440 + 1440;
    const loc = e.catalog.locations.cafe_in;
    g.enterLocation('cafe_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
    await wait(700);
    const coins = e.wallet().coins;
    // taken on at the café first (a word with the boss), then the shift
    g.run({ type: 'take_job', work: 'work.cafe' });
    g.startShift('work.cafe');
    await wait(150);
    if (document.querySelector('.work')?.style.display !== '') return 'no shift sheet';
    for (let i = 0; i < 10; i++) {
      const s = e.shift(g.now());
      if (!s || s.step >= s.steps) break;
      g.debugOffset += 3;
      const v = e.shift(g.now());
      g.workStep(v.options.indexOf(v.asks));
      await wait(60);
    }
    g.endShift();
    await wait(150);
    const got = e.wallet().coins - coins;
    return got > 0 ? 'ok:' + got : 'unpaid';
  })()`);
  check('a shift at the café is worked through and paid by the town', String(shiftPaid).startsWith('ok:'), String(shiftPaid));
  const sprout = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const loc = e.catalog.locations.grocery_in;
    g.enterLocation('grocery_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
    await wait(700);
    g.useStation('st.grocery.seed_tomato');
    await wait(150);
    if (!e.pocket().items.seed_tomato) return 'no seeds bought';
    g.goHome();
    await wait(900);
    const plot = e.garden(g.now()).find((p) => p.item === 'garden_plot' && !p.plant);
    if (!plot) return 'no empty plot';
    g.tendPlot(plot.pid, 'plant');
    await wait(150);
    const choice = [...document.querySelectorAll('.ask-choices .cta')].find((b) => /помідор/i.test(b.textContent));
    if (!choice) return 'no seed to choose';
    choice.click();
    await wait(150);
    for (let d = 0; d < 4; d++) {
      g.debugOffset += 1440;
      const v = e.garden(g.now()).find((p) => p.pid === plot.pid);
      if (v && !v.watered_today && !v.dead) g.tendPlot(plot.pid, 'water');
      await wait(60);
    }
    const v = e.garden(g.now()).find((p) => p.pid === plot.pid);
    // stand in the garden by the plot to see it
    const at = g.debugState().placements.find((p) => p.pid === plot.pid);
    g.debugTeleport(at.x + 0.5, at.y + 1.5);
    await wait(400);
    const drawn = g.shownRoom().placements.some((p) => p.pid === -10000 - plot.pid);
    return v && v.stage >= 1 && drawn ? 'ok' : JSON.stringify({ v, drawn });
  })()`);
  check('a seed sown at home, watered for days, comes up as a sprout on the plot', sprout === 'ok', String(sprout));
  const me = await page.eval(`(() => {
    const g = window.__teul.game;
    g.openToday();
    const tab = [...document.querySelectorAll('.today .chip, .settings .chip')].find((b) => b.textContent.trim().startsWith('Я'));
    if (!tab) return 'no tab';
    tab.click();
    const text = document.querySelector('.me-page')?.textContent ?? '';
    g.todayPanel.close();
    return /Що вміють руки/.test(text) && /Город і сад/.test(text) && /кав'ярні|Кав'ярн/.test(text) ? 'ok' : text.slice(0, 200);
  })()`);
  check('the «Я» page says what the hands know and where one works', me === 'ok', String(me));

  // ---- a town that lives on: a birthday wished, a project given to, the building going up after some days
  const birthday = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    g.ask.close();
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 700));
    // the next day with a birthday in town (the clock only goes forward)
    for (let d = 0; d < 370; d++) {
      const who = e.town(g.now() + d * 1440).today.birthdays.find((b) => e.catalog.residents?.[b.id]);
      if (!who) continue;
      g.debugOffset += d * 1440;
      await new Promise((r) => setTimeout(r, 400));
      g.openBirthday(who.id);
      const asked = document.querySelector('.ask').style.display === '' && /день народження/.test(document.querySelector('.ask-title')?.textContent ?? '');
      const wish = [...document.querySelectorAll('.ask-choices .cta')].find((b) => b.textContent === 'Привітати');
      if (!asked || !wish) return 'no birthday dialog';
      wish.click();
      await new Promise((r) => setTimeout(r, 300));
      const bond = e.town(g.now()).bonds.find((b) => b.id === who.id);
      g.ask.close();
      return bond && bond.memories.includes('birthday') ? 'ok' : 'not remembered: ' + JSON.stringify(bond);
    }
    return 'no birthday within a year';
  })()`);
  check('a birthday in town is wished well, and remembered', birthday === 'ok', String(birthday));
  const project = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const hall = e.catalog.locations.townhall_in;
    g.enterLocation('townhall_in', [hall.exits[0].x + 1, hall.exits[0].y - 1]);
    await new Promise((r) => setTimeout(r, 700));
    g.openProjects();
    const open = e.town(g.now()).projects.find((p) => p.status === 'open');
    if (!open) return 'no project open';
    const before = open.mine;
    const give = [...document.querySelectorAll('.projects .chip')].find((b) => /монет/.test(b.textContent) && !b.disabled);
    if (!give) return 'no way to give';
    give.click();
    await new Promise((r) => setTimeout(r, 300));
    const after = e.town(g.now()).projects.find((p) => p.id === open.id);
    g.projectsSheet.close();
    return after.mine > before ? 'ok:' + open.id : 'nothing given';
  })()`);
  check('coins are given to a town project at the town hall', String(project).startsWith('ok'), String(project));
  const built = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const status = () => e.town(g.now()).projects.find((p) => p.id === 'proj.bandstand')?.status;
    const was = status();
    g.debugOffset += 80 * 1440;
    await new Promise((r) => setTimeout(r, 400));
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 900));
    const now = status();
    const shown = g.room.placements.some((p) => p.item === 'bandstand');
    return (now === 'building' || now === 'done') && (now !== 'done' || shown) ? 'ok' : 'still ' + was + ' → ' + now + ', shown ' + shown;
  })()`);
  check('the town builds over the days: the bandstand goes up on the square', built === 'ok', String(built));

  // ---- phone-sized screens
  for (const [w, h] of [[640, 360], [932, 430]]) {
    await page.viewport(w, h);
    await page.sleep(500);
    await page.shot(`/tmp/shots/e2e-size-${w}x${h}.png`);
  }
  // ---- a new world for the look and the homes: what they cost needs a purse of the first day
  // (from a page that does not open the save, so nothing holds the database open while it is deleted)
  await page.goto(`${BASE}?pxitems`);
  await page.sleep(500);
  await page.eval(`(async () => {
    localStorage.clear();
    await new Promise((res) => { const r = indexedDB.deleteDatabase('teul'); r.onsuccess = r.onerror = () => res(); });
  })()`);
  await page.goto(URL0);
  for (let i = 0; i < 80 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await click('.title-screen .screen-go');
  for (let i = 0; i < 40 && !(await page.eval("!!document.querySelector('.hero-go')")); i++) await page.sleep(250);
  await click('.hero-go');
  for (let i = 0; i < 40 && !(await page.eval('!!window.__teul')); i++) await page.sleep(250);
  await page.sleep(1500);
  await page.eval("document.querySelector('.paper') && (document.querySelector('.paper').style.display = 'none')");
  check('a new world starts with the first day\'s purse', (await state()).coins >= 150, String((await state()).coins));

  // ---- a flat to rent, moving in, and out of its own front door
  const homeFlow = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = (text) => { const b = [...document.querySelectorAll('.ask .cta')].find((x) => x.textContent.includes(text) && !x.disabled); if (b) b.click(); return !!b; };
    const out = {};
    g.debugGo('village');
    await wait(800);
    const block = g.room.placements.find((p) => p.item === 'flat_block');
    out.options = g.optionsFor(block.pid).join(',');
    out.coins = e.wallet().coins;
    g.openHome('flat.sadova.1');
    await wait(150);
    out.rented = click('Орендувати');
    await wait(200);
    g.openHome('flat.sadova.1');
    await wait(150);
    out.moved = click('Переселитися');
    await wait(200);
    out.address = e.homes(g.now()).address;
    g.goHome();
    await wait(700);
    g.goOut();
    await wait(800);
    out.outAt = [g.location, Math.round(g.walker.x), Math.round(g.walker.y)].join(',');
    // and back to the first house
    g.openHome('home.lypova');
    await wait(150);
    click('Переселитися');
    await wait(200);
    out.back = e.homes(g.now()).address;
    g.goHome();
    await wait(700);
    return JSON.stringify(out);
  })()`);
  const hf = JSON.parse(homeFlow);
  check('a block of flats offers its flats', /homeinfo:flat\.sadova\.1/.test(hf.options), homeFlow);
  check('a flat is rented and moved into', hf.rented && hf.moved && hf.address === 'flat.sadova.1', homeFlow);
  check('out of the house one steps out of the flat\'s door', /^village,2[0-6],(7[8-9]|8[0-4])$/.test(hf.outAt), homeFlow);
  check('one can move back to the first house', hf.back === 'home.lypova', homeFlow);

  // ---- the look in town: a scarf bought at «Льон», put on at home by the wardrobe; a haircut at «Локон»
  const style = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const loc = (id) => e.catalog.locations[id];
    const go = async (id) => { const l = loc(id); g.enterLocation(id, l.entry ?? [l.exits[0].x, l.exits[0].y]); await wait(700); };
    const click = (sel, text) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(text) && !x.disabled); if (b) b.click(); return !!b; };
    const out = {};
    await go('clothes_in');
    const rack = g.room.placements.find((p) => p.item === 'clothes_rack');
    g.doUse(rack.pid, 'clothes');
    await wait(200);
    out.shopOpen = document.querySelector('.wardrobe').style.display === '';
    click('.wardrobe .tab', 'Аксесуари');
    await wait(100);
    const card = [...document.querySelectorAll('.wardrobe .pocket-item')].find((c) => c.textContent.includes('Червоний шарф'));
    out.card = !!card;
    const coins0 = e.wallet().coins;
    card?.querySelectorAll('button').forEach((b) => { if (b.textContent === 'Купити') b.click(); });
    await wait(200);
    out.bought = e.wardrobe(g.now()).owned.some((x) => x.item === 'wear.scarf_red') && e.wallet().coins === coins0 - 20;
    g.wardrobeSheet.close();
    g.goHome();
    await wait(700);
    const robe = g.room.placements.find((p) => /^wardrobe/.test(p.item));
    out.robe = !!robe;
    g.doUse(robe.pid, 'dress');
    await wait(200);
    click('.wardrobe .tab', 'Аксесуари');
    await wait(100);
    const mine = [...document.querySelectorAll('.wardrobe .pocket-item')].find((c) => c.textContent.includes('Червоний шарф'));
    mine?.querySelectorAll('button').forEach((b) => { if (b.textContent === 'Одягти') b.click(); });
    await wait(200);
    out.worn = e.room().settings['look.acc'] === '2' && e.room().settings['look.acc_color'] === '#d9534f';
    g.wardrobeSheet.close();
    // the hair: at the salon, a new style
    await go('salon_in');
    const chair = g.room.placements.find((p) => p.item === 'salon_chair');
    g.doUse(chair.pid, 'salon');
    await wait(200);
    const before = e.room().settings['look.hair'];
    const thumbs = [...document.querySelectorAll('.salon .hero-row')][0].querySelectorAll('button');
    [...thumbs].find((b) => !b.classList.contains('on')).click();
    await wait(100);
    const coins1 = e.wallet().coins;
    click('.salon .cta', 'Підстригтися');
    await wait(200);
    out.cut = e.room().settings['look.hair'] !== before && e.wallet().coins === coins1 - 40;
    g.salonSheet.close();
    // the studio no longer changes clothes or hair
    out.fixed = e.homes(g.now()).fixed === true;
    g.goHome();
    await wait(700);
    return JSON.stringify(out);
  })()`);
  const st = JSON.parse(style);
  check('the clothes shop opens with its clothes', st.shopOpen && st.card, style);
  check('a scarf is bought at the shop for its price', st.bought, style);
  check('at home, by the wardrobe, the scarf is put on and the hero wears it', st.robe && st.worn, style);
  check('a haircut at the salon changes the hair for its price', st.cut, style);
  check('once the hero is made, the look is changed in town only', st.fixed, style);

  // (Firefox itself sometimes reports a "prepend of null" of its own while a page reloads: not ours)
  const errors = page.errors().filter((e) => !String(e.text).includes('"prepend" of null'));
  check('no console errors', errors.length === 0, JSON.stringify(errors));
});

console.log(failed === 0 ? '\nALL FLOWS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
