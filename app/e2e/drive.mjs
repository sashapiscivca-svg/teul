// The road, end to end, in a fresh world: lessons at the driving school, the theory, the practical exam in the
// school's car, the licence; days of shifts for a used car from the service station; driving it in town; the
// police stop, the punched coupon, the night in the cell, the paper's story; money found on the road.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/drive.mjs [shots-dir]
import { readFileSync } from 'node:fs';
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
const PACK = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const RIGHT = Object.fromEntries(PACK.driving.questions.map((q) => [q.q, q.answers[q.right]]));
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

// the next Monday, ten in the morning (the school works on weekdays)
const now = new Date();
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (((8 - now.getDay()) % 7) || 7), 10, 0);
const SHIFT = Math.round((monday.getTime() - now.getTime()) / 60_000);

await withFirefox(async (page) => {
  const ev = (js) => page.eval(js);
  const wait = (ms) => page.sleep(ms);
  const clickText = (text) =>
    ev(`(() => { const el = [...document.querySelectorAll('.ask-choices .cta')].find((e) => e.textContent.includes(${JSON.stringify(text)}) && !e.disabled); if (!el) return false; el.click(); return true; })()`);
  const askText = () => ev("document.querySelector('.ask')?.style.display === '' ? (document.querySelector('.ask-text')?.textContent ?? '') : ''");
  const road = async () => JSON.parse(await ev('JSON.stringify(window.__teul.game.debugRoad())'));
  const enter = (id) =>
    ev(`(async () => { const g = window.__teul.game; const l = window.__teul.engine.catalog.locations[${JSON.stringify(id)}]; g.enterLocation(${JSON.stringify(id)}, l.entry ?? [l.exits[0].x, l.exits[0].y]); await new Promise((r) => setTimeout(r, 700)); return g.location; })()`);
  /** Moves the clock to `minute` of the day `days` ahead. */
  const toDay = async (days, minute) => {
    await ev(`(() => { const g = window.__teul.game; const m = g.now() % 1440; g.debugOffset += ${days} * 1440 + (${minute} - m); return g.now(); })()`);
    await wait(700);
    await ev('window.__teul.game.paperSheet?.close()');
  };
  /** A photo of the moment: the morning paper and passing words put away first. */
  const shot = async (name, settle = 400) => {
    if (!SHOTS) return;
    await ev("(() => { window.__teul.game.paperSheet?.close(); document.querySelectorAll('.toast').forEach((t) => t.remove()); })()");
    await wait(settle);
    await page.shot(`${SHOTS}/${name}.png`);
  };
  const use = (item, action) =>
    ev(`(() => { const g = window.__teul.game; const p = g.room.placements.find((q) => q.item === ${JSON.stringify(item)}); if (!p) return 'no ' + ${JSON.stringify(item)}; g.doUse(p.pid, ${JSON.stringify(action)}); return 'ok'; })()`);

  await page.goto(`${BASE}?debug&skip&shift=${SHIFT}`);
  for (let i = 0; i < 80 && !(await ev('!!(window.__teul && window.__teul.game)')); i++) await wait(250);
  await wait(1500);
  await ev("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");

  // ---- the town has the places: the service station, the driving school, zebras by the school
  await ev("window.__teul.game.debugGo('village')");
  await wait(900);
  const town = JSON.parse(await ev(`JSON.stringify((() => { const g = window.__teul.game; const has = (i) => g.room.placements.filter((p) => p.item === i).length; return { sto: has('sto_garage') + has('car_service'), school: has('driving_school'), zebra: has('road_zebra'), pump: has('fuel_pump') }; })())`));
  check('the town has a service station, a driving school, a pump and zebra crossings', town.sto === 1 && town.school === 1 && town.zebra >= 4 && town.pump === 1, JSON.stringify(town));

  // ---- four lessons on four days
  for (let d = 0; d < 4; d++) {
    if (d > 0) await toDay(1, 10 * 60);
    await enter('driving_in');
    if (d === 1) await shot('drive-school', 1500);
    await use('desk', 'driving');
    await wait(200);
    const had = await clickText('Заняття');
    if (d === 0) await shot('drive-lesson');
    for (let i = 0; i < 8 && (await clickText('Далі')); i++) await wait(80);
    await clickText('Дякую');
    if (!had) break;
  }
  let v = (await road()).view;
  check('four lessons, one a day, with the instructor', v.lessons_done === 4, JSON.stringify({ done: v.lessons_done }));
  check('the instructor is at the school by day', await ev("window.__teul.engine.life(window.__teul.game.now()).residents.some((r) => r.id === 'res_instructor' && r.site === 'driving_site' && r.activity === 'work')"));

  // ---- the theory on the fifth day: today's questions, answered right
  await toDay(1, 10 * 60);
  await enter('driving_in');
  await use('desk', 'driving');
  await wait(200);
  await clickText('Скласти теорію');
  await wait(150);
  for (let i = 0; i < 8; i++) {
    const q = await askText();
    const a = RIGHT[q];
    if (!a) break;
    if (i === 1) await shot('drive-theory');
    await clickText(a);
    await wait(100);
  }
  check('the theory is passed', /Голова варить/.test(await askText()), await askText());
  await clickText('Добре');

  // ---- the practical exam: out in the school's car, the route's points, back to the school
  await use('desk', 'driving');
  await wait(150);
  await clickText('На маршрут');
  await wait(100);
  await clickText('До машини');
  await wait(1200);
  let r = await road();
  check('the exam starts in the school car on the street, with a route of points', r.car && r.exam && r.exam.route.length === 4 && (await ev('window.__teul.game.location')) === 'village', JSON.stringify(r));
  await ev("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))");
  await wait(900);
  await shot('drive-exam');
  await ev("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }))");
  await wait(500);
  r = await road();
  check('the car drives (and the hero is in it)', r.car && r.car.cells > 0.5, JSON.stringify(r.car));
  await ev('window.__teul.game.debugOffset += 4');
  for (const [x, y] of r.exam.route) {
    await ev(`window.__teul.game.debugCarTo(${x + 0.5}, ${y + 0.5})`);
    await wait(250);
  }
  await wait(300);
  const verdict = await ev("document.querySelector('.ask-title')?.textContent ?? ''");
  v = (await road()).view;
  check('the route driven, the licence given', verdict === 'Іспит складено!' && v.licence !== null, `${verdict} ${JSON.stringify(v.licence)}`);
  check('the licence is on the keyring', await ev("window.__teul.engine.pocket().keys.includes('driver_licence')"));
  await clickText('Дякую');
  await ev('window.__teul.game.paperSheet?.close()');

  // ---- some days of work for a used car
  const earned = await ev(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let d = 0; d < 30 && e.wallet().coins < 760; d++) {
      const m = g.now() % 1440;
      g.debugOffset += 1440 + (9 * 60 - m);
      const loc = e.catalog.locations.cafe_in;
      g.enterLocation('cafe_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
      await sleep(120);
      g.startShift('work.cafe');
      for (let i = 0; i < 10; i++) {
        const s = e.shift(g.now());
        if (!s || s.step >= s.steps) break;
        g.debugOffset += 4;
        const w = e.shift(g.now());
        g.workStep(w.options.indexOf(w.asks));
      }
      g.endShift();
      g.ask?.close();
    }
    g.paperSheet?.close();
    return e.wallet().coins;
  })()`);
  check('the town pays for honest work, enough for an old car', earned >= 700, String(earned));

  // ---- the service station: a car, the keys, to the car
  const dow = await ev('new Date(Date.now() + window.__teul.game.debugOffset * 60000).getDay()');
  await toDay(dow === 6 ? 2 : 1, 11 * 60);
  await enter('sto_in');
  await wait(1500);
  await use('cash_counter', 'sto');
  await wait(200);
  await shot('drive-sto');
  const offered = await ev("[...document.querySelectorAll('.ask-choices .cta')].filter((b) => b.textContent.startsWith('Купити')).length");
  check('the mechanic offers every car there is', offered >= 6, String(offered));
  await clickText('Купити «Ластівка»');
  await wait(200);
  await clickText('До машини');
  await wait(1200);
  v = (await road()).view;
  check('the car is bought and waits on the station’s forecourt; the keys are on the ring', v.car && v.car.at_sto && (await ev("window.__teul.engine.pocket().keys.includes('car_keys')")), JSON.stringify(v.car));
  check('the parked car stands in the town', await ev("window.__teul.game.room.placements.some((p) => p.item === 'car_hatch')"));
  await use('car_hatch', 'drive');
  await wait(400);
  await ev("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))");
  await wait(1100);
  await ev("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }))");
  await ev("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))");
  await wait(1300);
  await shot('drive-town');
  await ev("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }))");
  r = await road();
  if (r.car && r.car.cells < 1) {
    // someone stopped by to talk (a busy town): the talk is put aside and the car driven on
    await ev("(() => { const g = window.__teul.game; g.ask?.close(); g.dialogue?.close(); })()");
    await ev("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))");
    await wait(1300);
    await ev("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }))");
    r = await road();
  }
  check('one drives one’s own car through the town', r.car && r.car.cells > 1 && !r.exam, JSON.stringify(r.car));
  check('the speedometer is shown at the wheel', await ev("document.querySelector('.drive-dash')?.style.display === ''"));

  // ---- too close to people: the police pull over, the coupon is punched
  let stop = '';
  for (let i = 0; i < 12 && !stop; i++) {
    await ev("window.__teul.game.debugOffset += 1; window.__teul.game.reportFault('pedestrian')");
    await wait(300);
    stop = await ev("document.querySelector('.ask')?.style.display === '' ? document.querySelector('.ask-title')?.textContent ?? '' : ''");
  }
  r = await road();
  check('someone saw: the police stop the car, lights flashing behind', stop === 'Поліція' && r.police, stop);
  await shot('drive-police');
  check('the officer’s words name the fault and the fine', /небезпечну їзду/.test(await askText()) || /небезпечну їзду/.test(await ev("document.querySelector('.ask-lines')?.textContent ?? ''")), await askText());
  await clickText('Зрозуміло');
  v = (await road()).view;
  check('three holes in the coupon', v.holes === 3, String(v.holes));
  await ev('window.__teul.game.driveDesk.licence()');
  await wait(150);
  const coupon = await ev("document.querySelector('.ask-lines')?.textContent ?? ''");
  check('the licence shows the coupon with its holes, no numbers in it', coupon.includes('○ ○ ○ ▣ ▣'), coupon);
  await shot('drive-licence');
  await clickText('Закрити');

  // ---- again: the coupon is full, the licence taken, a night in the cell
  let jail = false;
  for (let i = 0; i < 12 && !jail; i++) {
    await ev("window.__teul.game.debugOffset += 1; window.__teul.game.reportFault('pedestrian')");
    await wait(300);
    jail = await clickText('Іти з ними');
    if (!jail) await clickText('Зрозуміло');
  }
  await wait(1500);
  check('arrested: into the police station, the licence gone', jail && (await ev('window.__teul.game.location')) === 'police_in' && !(await ev("window.__teul.engine.pocket().keys.includes('driver_licence')")));
  check('the one in the next bunk talks', /Камера/.test(await ev("document.querySelector('.ask .ph b')?.textContent ?? ''")));
  await shot('drive-jail');
  for (let i = 0; i < 5 && (await clickText('Слухати далі')); i++) await wait(80);
  await clickText('Лягти на нари');
  const out = await ev("JSON.stringify(window.__teul.engine.command({ type: 'travel', to: 'village' }, window.__teul.game.now()))");
  check('the cell is locked until it is time', out.includes('jailed'), out);
  v = (await road()).view;
  check('the car is towed to the police yard', v.car && v.car.at[1] === PACK.locations.find((l) => l.id === 'village').sites.find((s) => s.id === 'police_site').x, JSON.stringify(v.car?.at));
  const paper = JSON.parse(await ev('JSON.stringify(window.__teul.engine.paper(window.__teul.game.now() + 1440))'));
  const titles = [paper.headline.title, ...paper.stories.map((s) => s.title)];
  check('the next morning the paper tells of it', titles.includes('Місцевий водій провів ніч у відділку'), titles.join(' | '));

  // ---- out in the morning; a coin on the road one day
  await toDay(1, 9 * 60);
  await wait(800);
  const free = await enter('village');
  check('let out when the time is up', free === 'village', free);
  await ev('window.__teul.game.paperSheet?.close()');
  const k = await ev(`(() => { const g = window.__teul.game; const e = window.__teul.engine; for (let d = 0; d < 40; d++) { const v = e.drive(g.now() + d * 1440); if (v && v.coins.length) return d; } return -1; })()`);
  check('now and then money lies on the road', k >= 0, String(k));
  if (k >= 0) {
    await ev(`window.__teul.game.debugOffset += ${k} * 1440`);
    await wait(900);
    await ev('window.__teul.game.paperSheet?.close()');
    const coin = JSON.parse(await ev('JSON.stringify(window.__teul.engine.drive(window.__teul.game.now()).coins[0])'));
    await ev(`window.__teul.game.debugTeleport(${coin.x + 2.5}, ${coin.y + 0.5})`);
    await wait(600);
    await shot('drive-coin');
    const before = await ev('window.__teul.engine.wallet().coins');
    await ev(`window.__teul.game.debugTeleport(${coin.x + 0.5}, ${coin.y + 0.5})`);
    await wait(500);
    const after = await ev('window.__teul.engine.wallet().coins');
    check('walking over it picks it up', after - before === coin.coins, `${before} → ${after} (${coin.coins})`);
  }
});

console.log(failed ? `${failed} FAILED` : 'drive: all passed');
process.exit(failed ? 1 : 0);
