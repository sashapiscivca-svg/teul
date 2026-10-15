// Things grow old, things are made, new things come — end to end in one world whose clock moves forward.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/craft.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

// midday today, whatever the hour
const nowLocal = new Date();
const NOON = (((12 * 60 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1200);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
const run = (page, cmd) => page.eval(`JSON.stringify(window.__teul.game.run(${JSON.stringify(cmd)}))`).then(JSON.parse);
const shot = async (page, name) => {
  if (SHOTS) await page.shot(`${SHOTS}/craft-${name}.png`);
};
const go = async (page, id, at) => {
  await page.eval(`window.__teul.game.enterLocation(${JSON.stringify(id)}, ${JSON.stringify(at)})`);
  await page.sleep(900);
};
/** Minutes to add (from the base shift) to reach `minute` of the first day at least `from` days on where `test(dayView)` holds. */
const shiftTo = (page, from, test, minute) =>
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = ${from}; k < ${from} + 30; k++) {
      const v = e.dayView(now + k * 1440);
      if ((${test})(v)) return k * 1440 + (${minute} - (now % 1440));
    }
    return -1;
  })()`);

await withFirefox(async (page) => {
  // ---- a new world: everything at home is new; the hardware store sells tools; the workbench makes things
  await page.goto(`${BASE}?debug&skip&shift=${NOON}`);
  await ready(page);
  const fresh = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.wear(window.__teul.game.now()))'));
  check('a new home: its things age, and all of them are new', fresh.length > 10 && fresh.every((w) => w.stage === 0), JSON.stringify(fresh.slice(0, 3)));
  await page.eval('window.__teul.game.zoomBy(1.8)');
  await page.sleep(400);
  await shot(page, 'room-new');
  await page.eval('window.__teul.game.zoom = 1');

  await go(page, 'hardware_in', [5, 6]);
  check('the hardware store is a place of its own', (await page.eval('window.__teul.game.location')) === 'hardware_in');
  const coins0 = await page.eval('window.__teul.engine.wallet().coins');
  const bought = [];
  for (const st of ['st.hardware.hammer', 'st.hardware.saw', 'st.hardware.repair_kit', 'st.hardware.nails']) {
    const r = await run(page, { type: 'use', station: st });
    bought.push(r.ok ? 'ok' : r.error?.kind);
  }
  check('tools, kits and nails are bought at «Господарчий»', bought.every((b) => b === 'ok'), `${bought} (coins ${coins0})`);
  const seller = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const who = Object.values(e.catalog.residents).find((r) => r.job?.[0] === 'hardware_site');
    if (!who) return 'nobody';
    if (e.dayView(g.now()).day_off) return 'day off';
    return (g.life?.residents ?? []).some((x) => x.id === who.id && x.activity === 'work') ? 'at work' : 'away';
  })()`);
  check('a seller keeps the store in its hours (days off aside)', seller === 'at work' || seller === 'day off', seller);
  await shot(page, 'hardware');

  await go(page, 'workshop_in', [4, 6]);
  for (const st of ['st.workshop.planks', 'st.workshop.planks', 'st.workshop.nails']) await run(page, { type: 'use', station: st });
  const bench = await page.eval(`(() => { const g = window.__teul.game; const p = g.room.placements.find((q) => q.item === 'workbench'); return p ? JSON.stringify({ pid: p.pid, opts: g.optionsFor(p.pid) }) : '{}'; })()`);
  const b = JSON.parse(bench);
  check('the workshop bench offers to make things', (b.opts ?? []).includes('craft'), bench);
  await page.eval(`window.__teul.game.doUse(${b.pid}, 'craft')`);
  await page.sleep(500);
  check('the workbench opens with what one knows', await page.eval(`[...document.querySelectorAll('.craft .craft-item .name')].some((e) => e.textContent.includes('Табурет'))`));
  await page.eval(`[...document.querySelectorAll('.craft .chip.pick')].slice(0, 1).forEach((c) => c.click())`);
  await page.sleep(200);
  await shot(page, 'workbench');
  const made = await page.eval(`(() => { const b = [...document.querySelectorAll('.craft .craft-item')].find((e) => e.textContent.includes('Табурет')); const btn = b?.querySelector('button'); if (!btn || btn.disabled) return 'disabled'; btn.click(); return 'ok'; })()`);
  await page.sleep(400);
  const stool = await page.eval(`window.__teul.engine.inventory().find((i) => i.item === 'stool')?.free ?? 0`);
  check('a stool made at the bench waits at home among one\'s things', made === 'ok' && stool >= 1, `${made} ${stool}`);
  const fizz = await run(page, { type: 'tinker', items: [['nails', 1]] });
  check('a try that makes nothing leaves the nails whole', !fizz.ok && fizz.error.kind === 'fizzled', JSON.stringify(fizz));
  await page.eval("window.__teul.game.craftSheet.close()");

  // ---- months later: things at home have aged; a broken one refuses in its own words; hands and masters mend
  const later = await shiftTo(page, 320, '(v) => !v.day_off && !v.holiday', 12 * 60);
  check('a working day comes most of a year on', later > 0, String(later));
  await page.goto(`${BASE}?debug&skip&shift=${NOON + later}`);
  await ready(page);
  await page.eval("window.__teul.game.debugGo('home')");
  await page.sleep(900);
  const aged = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.wear(window.__teul.game.now()))'));
  check('most of a year on, things at home have aged, some are broken', aged.some((w) => w.stage >= 2) && aged.some((w) => w.broken), JSON.stringify(aged.map((w) => w.stage)));
  check('an aged thing looks it (its picture carries its age)', await page.eval(`window.__teul.game.room.placements.some((p) => Number(p.props?.wear ?? 0) >= 2)`));
  await page.eval('window.__teul.game.zoomBy(1.8)');
  await page.sleep(400);
  await shot(page, 'room-worn');
  const brokenSeat = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const w = e.wear(g.now()).find((x) => x.broken && (e.catalog.items[x.item].actions ?? []).some((a) => a === 'sit' || a === 'rest'));
    if (!w) return 'none';
    const a = e.catalog.items[w.item].actions.find((x) => x === 'sit' || x === 'rest');
    const r = e.command({ type: 'perform', action: a, pid: w.pid }, g.now());
    return r.ok ? 'sat?!' : JSON.stringify(r.error);
  })()`);
  check('a broken seat refuses in its own words', brokenSeat === 'none' || brokenSeat.includes('"broken"'), brokenSeat);
  // a worn thing at home offers to be mended; by hand with a kit and the hammer
  const fix = await page.eval(`(() => {
    const g = window.__teul.game;
    const w = window.__teul.engine.wear(g.now()).find((x) => x.stage === 2 && x.by_hand) ?? window.__teul.engine.wear(g.now()).find((x) => x.stage === 1 && x.by_hand);
    if (!w) return JSON.stringify({ none: true });
    const opts = g.optionsFor(w.pid);
    g.doUse(w.pid, 'fix');
    return JSON.stringify({ pid: w.pid, opts });
  })()`);
  const f = JSON.parse(fix);
  check('something worn offers to be mended', (f.opts ?? []).includes('fix'), fix);
  await page.sleep(400);
  await shot(page, 'repair');
  if (f.pid !== undefined) {
    await page.eval('window.__teul.game.ask.close()');
    const r = await run(page, { type: 'repair', pid: f.pid });
    const stage = await page.eval(`window.__teul.engine.wear(window.__teul.game.now()).find((x) => x.pid === ${f.pid}).stage`);
    check('mended by one\'s own hands, it is like new', r.ok && stage === 0, JSON.stringify(r).slice(0, 200));
  }
  // ---- the town has taken up smartphones; the post office sells them; freelancers sit in the café with laptops
  const tech = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.tech(window.__teul.game.now()))'));
  const people = await page.eval('Object.keys(window.__teul.engine.catalog.residents).length');
  check('most of a year on, most of the town has a smartphone', tech.phones_sold && tech.phones.length > people / 2, `${tech.phones.length}/${people}`);
  check('some grown-ups have laptops', tech.laptops_sold && tech.laptops.length > 5, String(tech.laptops.length));
  // a broken one: a master from the utility office, for coins
  await go(page, 'utility_in', [4, 6]);
  const master = await page.eval(`(() => {
    const g = window.__teul.game;
    const w = window.__teul.engine.wear(g.now()).find((x) => x.broken);
    if (!w) return 'none';
    const before = window.__teul.engine.wallet().coins;
    const r = g.run({ type: 'call_master', pid: w.pid });
    return JSON.stringify({ ok: r.ok, paid: before - window.__teul.engine.wallet().coins, fix: w.fix, after: window.__teul.engine.wear(g.now()).find((x) => x.pid === w.pid).stage });
  })()`);
  const m = master === 'none' ? { ok: true, paid: 0, fix: 0, after: 0 } : JSON.parse(master);
  check('a master from the utility office mends a broken thing for coins', m.ok && m.paid === m.fix && m.after === 0, master);
  await shot(page, 'utility-master');


  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(1500);
  // someone of the town with a phone: walk up to them
  const near = await page.eval(`(() => {
    const g = window.__teul.game;
    const phones = new Set(window.__teul.engine.tech(g.now()).phones);
    let best = null;
    for (const [id, pose] of g.resPoses) if (phones.has(id) && !pose.walking) { best = pose; if (g.npcSeat(pose.x, pose.y, new Set())) break; }
    if (!best) for (const [id, pose] of g.resPoses) if (phones.has(id)) { best = pose; break; }
    if (!best) return 'nobody';
    g.debugTeleport(best.x + 1.2, best.y + 1.2);
    g.zoom = 1;
    g.zoomBy(1.3);
    return 'ok';
  })()`);
  await page.sleep(1200);
  const held = await page.eval(`window.__teul.game.residentFigures().length`);
  check('the village has people out, some with phones', held > 0 && near === 'ok', `${held} ${near}`);
  await shot(page, 'phones');

  // late morning of a working day: the café (a stormy day keeps everyone in: then the next working day)
  let l = { here: 0, laptops: 0 };
  let lap = '';
  let total = later;
  for (let attempt = 0; attempt < 4 && l.laptops < 1; attempt++) {
    const cafe = await shiftTo(page, 1, '(v) => !v.day_off && !v.holiday', 11 * 60);
    total += cafe;
    await page.goto(`${BASE}?debug&skip&shift=${NOON + total}`);
    await ready(page);
    await go(page, 'cafe_in', [4, 6]);
    await page.sleep(1500);
    lap = await page.eval(`(() => {
      const g = window.__teul.game;
      const t = window.__teul.engine.tech(g.now());
      const here = (g.life?.residents ?? []).filter((r) => window.__teul.engine.catalog.sites?.[r.site]?.kind === 'cafe' && r.activity !== 'work');
      return JSON.stringify({ here: here.length, laptops: here.filter((r) => t.laptops.includes(r.id)).length });
    })()`);
    l = JSON.parse(lap);
  }
  check('freelancers sit in the café with laptops of a weekday morning', l.laptops >= 1, lap);
  await shot(page, 'cafe-laptops');
});

// ---- a second world: most of a year on, a smartphone from the post office, and what it does
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&shift=${NOON}`);
  await ready(page);
  const later = await shiftTo(page, 330, '(v) => !v.day_off && !v.holiday', 12 * 60);
  await page.goto(`${BASE}?debug&skip&shift=${NOON + later}`);
  await ready(page);
  await go(page, 'post_in', [4, 6]);
  const phone = await run(page, { type: 'use', station: 'st.post.phone' });
  check('the post office sells a smartphone, and it shows on the screen', phone.ok && (await page.eval(`getComputedStyle(document.querySelector('.hud-phone')).display !== 'none'`)), JSON.stringify(phone).slice(0, 200));
  await page.eval("document.querySelector('.hud-phone').click()");
  await page.sleep(300);
  check('the phone has a camera, the maps, a taxi, the weather, messages and a master', await page.eval(`document.querySelectorAll('.phone .phone-app').length === 6`));
  await page.eval("[...document.querySelectorAll('.phone .phone-app')].find((b) => b.textContent.includes('Погода')).click()");
  await page.sleep(200);
  check('the phone tells the weather', await page.eval(`document.querySelector('.phone .phone-line')?.textContent.includes('Сьогодні')`));
  // a master called from one's own phone
  await page.eval("[...document.querySelectorAll('.phone .chip')].find((b) => b.textContent.includes('Назад'))?.click()");
  await page.eval("[...document.querySelectorAll('.phone .phone-app')].find((b) => b.textContent.includes('Майстер')).click()");
  await page.sleep(200);
  await shot(page, 'phone');
  const called = await page.eval(`(() => {
    const g = window.__teul.game;
    const w = window.__teul.engine.wear(g.now()).find((x) => x.stage >= 2 && x.fix <= window.__teul.engine.wallet().coins);
    if (!w) return 'none';
    const btn = [...document.querySelectorAll('.phone .phone-row')].find((r) => r.textContent.includes(String(w.fix)))?.querySelector('button');
    if (!btn) return 'no row';
    btn.click();
    return String(window.__teul.engine.wear(g.now()).find((x) => x.pid === w.pid).stage);
  })()`);
  check('a master called from the phone mends a thing at home', called === '0' || called === 'none', called);
  await page.eval("window.__teul.game.phoneSheet.close()");
});

console.log(failed === 0 ? '\nall craft flows pass' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
