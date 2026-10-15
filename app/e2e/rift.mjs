// The rift and the eerie nights, end to end, each in a fresh world (the clock only moves forward).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/rift.mjs [shots-dir]
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
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};

/** Minutes to add to reach `minute` of the first day (from today) that `test(dayView)` holds. */
const shiftTo = (page, test, minute) =>
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = 0; k < 400; k++) {
      const v = e.dayView(now + k * 1440);
      if ((${test})(v)) return k * 1440 + (${minute} - (now % 1440));
    }
    return -1;
  })()`);

// ---- 1. an ordinary day: the Other Side is closed and says why; the rift day: it opens
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const closed = await page.eval(`(() => {
    const g = window.__teul.game;
    const r = window.__teul.engine.command({ type: 'travel', to: 'rift_winter' }, g.now());
    return r.ok ? 'open?!' : JSON.stringify(r.error);
  })()`);
  check('on an ordinary day the rift worlds are closed and say they open on their day', closed.includes('"day"') && closed.includes('rift'), closed);
  check('on an ordinary day there is no crack in the square', !(await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 700)); return g.room.placements.some((p) => p.item === 'rift_crack'); })()`)));

  const shift = await shiftTo(page, '(v) => v.rift', 12 * 60);
  check('a rift day comes within the year', shift > 0, String(shift));
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  const day = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.dayView(window.__teul.game.now()))'));
  check('the rift day is named in the calendar', day.rift && /рівнодення|сонцестояння/.test(day.holiday ?? ''), JSON.stringify(day));
  check('the garden at home has its own crack today', await page.eval("window.__teul.game.room.placements.some((p) => p.item === 'rift_crack')"));
  const stepped = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 900));
    const crack = g.room.placements.find((p) => p.item === 'rift_crack');
    if (!crack) return 'no crack in the village';
    g.debugTeleport(crack.x + 0.5, crack.y + 1.5);
    await new Promise((r) => setTimeout(r, 300));
    const opts = g.optionsFor(crack.pid);
    g.doUse(crack.pid, 'rift');
    await new Promise((r) => setTimeout(r, 900));
    return JSON.stringify({ opts, location: g.location, world: window.__teul.engine.skyView(g.now()).rift_world, echoes: g.npcsSeated(g.room).filter((n) => n.id.startsWith('being:')).length });
  })()`);
  const st = JSON.parse(stepped.startsWith('{') ? stepped : '{}');
  check('a crack stands in the square on the rift day and offers the way', (st.opts ?? []).includes('rift'), stepped);
  check('stepping in reaches the world of the day, with its beings', st.location === st.world && st.echoes > 0, stepped);
  if (SHOTS) await page.shot(`${SHOTS}/otherside.png`);
  const found = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const spots = (e.catalog.locations[g.location].spots ?? []).map((s) => s.id);
    for (const spot of spots) {
      const r = e.command({ type: 'gather', spot }, g.now());
      if (r.ok) return 'ok';
    }
    return 'nothing found';
  })()`);
  check('the rift world gives its own finds', found === 'ok', found);
  const back = await page.eval(`(async () => {
    const g = window.__teul.game;
    const crack = g.room.placements.find((p) => p.item === 'rift_crack');
    g.doUse(crack.pid, 'rift');
    await new Promise((r) => setTimeout(r, 900));
    return g.location;
  })()`);
  check('the crack leads back', back === 'village', back);
  if (SHOTS) {
    await page.eval(`(async () => { const g = window.__teul.game; const c = g.room.placements.find((p) => p.item === 'rift_crack'); g.debugTeleport(c.x + 1.5, c.y + 2.5); })()`);
    await page.sleep(700);
    await page.shot(`${SHOTS}/rift-square.png`);
  }
  for (const e of page.errors()) if (e.level === 'error' && !/prepend of null/.test(e.text)) check('no console errors', false, e.text);
});

// ---- 2. Halloween night: nothing eerie with the setting off; with it on, someone may knock
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(v) => v.holiday_id === 'halloween'", 22 * 60 + 30);
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  const run = (on) =>
    page.eval(`(async () => {
      const g = window.__teul.game;
      g.prefs.horror = ${on};
      const seen = [];
      const orig = g.haunt.bind(g);
      g.haunt = (e) => { seen.push(e.kind); orig(e); };
      const base = 1e9 + ${on ? 5e7 : 0};
      for (let k = 0; k < 60; k++) {
        g.ask.close();
        g.nightTick(base + k * 70000);
      }
      g.haunt = orig;
      return JSON.stringify(seen);
    })()`);
  const off = JSON.parse(await run(false));
  check('with the setting off, Halloween night stays sweet', off.length === 0, JSON.stringify(off));
  const on = JSON.parse(await run(true));
  check('with it on, eerie things happen at night — a knock at the door among them', on.length > 5 && on.includes('knock'), JSON.stringify(on));
  if (SHOTS) {
    await page.eval(`(() => { const g = window.__teul.game; g.haunt({ kind: 'knock', text: 'Тук. Тук. Тук. Хтось стукає у двері — пізно, дуже пізно.', sound: 'knock', choices: [{ label: 'Відчинити', text: '' }, { label: 'Не відчиняти', text: '', leave: true }] }); g.shade(); })()`);
    await page.sleep(500);
    await page.shot(`${SHOTS}/halloween-knock.png`);
  }
});

console.log(failed ? `${failed} CHECK(S) FAILED` : 'all rift checks passed');
process.exit(failed ? 1 : 0);
