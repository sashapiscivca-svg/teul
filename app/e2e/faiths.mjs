// The town's quieter places, end to end: the small temple by the park (cushions, the altar under the wheel, the
// offerings on their days, someone sitting cross-legged, the hero sitting on a cushion and praying at the table),
// and the old circle in the forest (the cold ring by day, the fire and a ring of people on the full-moon night,
// standing in the circle). Each moment in a fresh world reached with the test-only ?shift=.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/faiths.mjs [shots-dir]
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

/** Minutes from now to `minute` of the first day on which `test(dayView, flags)` holds. */
const shiftTo = (page, test, minute, days = 400) =>
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = 0; k < ${days}; k++) {
      const t = now - (now % 1440) + k * 1440 + ${minute};
      if (t < now) continue;
      if ((${test})(e.dayView(t), e.town(t).flags)) return t - now;
    }
    return -1;
  })()`);

async function at(page, shift, where, x, y) {
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 1000)); ${where !== 'village' ? `g.enterLocation('${where}', [${Math.floor(x)}, ${Math.floor(y)}]); await new Promise((r) => setTimeout(r, 1000));` : ''} ${x !== undefined ? `g.debugTeleport(${x}, ${y});` : ''} })()`);
  await page.sleep(1000);
}

async function snap(page, file) {
  if (!SHOTS) return;
  await page.eval("(() => { document.querySelector('.toasts')?.replaceChildren(); return 1; })()");
  await page.sleep(200);
  await page.shot(`${SHOTS}/${file}`);
}

const figures = (page) => page.eval("JSON.stringify(window.__teul.game.townFigures().map((f) => f.id))").then(JSON.parse);
const placed = (page, item) => page.eval(`window.__teul.game.room.placements.filter((p) => p.item === '${item}').length`);

await withFirefox(async (page) => {
  // ---- the temple from outside, on a day of offerings, by day
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, '(d, flags) => flags.includes("offerings") && !d.full_moon', 11 * 60);
  check('a day of offerings comes soon', shift >= 0, String(shift));
  const door = await page.eval("JSON.stringify(window.__teul.engine.catalog.sites.temple_site)").then(JSON.parse);
  check('the temple stands in the town', !!door && door.kind === 'temple', JSON.stringify(door));
  await at(page, shift, 'village', door.x + 0.5, door.y + 1.5);
  check('its building is on the map', (await placed(page, 'temple')) === 1);
  await snap(page, 'faith-temple-outside.png');

  // ---- inside: the altar, the cushions, the offerings laid out, someone sitting cross-legged
  await page.eval("(async () => { const g = window.__teul.game; g.enterLocation('temple_in', [5, 7]); await new Promise((r) => setTimeout(r, 1000)); g.debugTeleport(4.5, 6.5); })()");
  await page.sleep(1200);
  check('the hall has its altar and cushions', (await placed(page, 'temple_altar')) === 1 && (await placed(page, 'zafu')) === 8);
  check('the offerings are laid out today', (await placed(page, 'offering_bowls')) === 2);
  const who = await figures(page);
  check('people sit and pray at the temple', who.some((id) => id.startsWith('town:devotee:')), JSON.stringify(who));
  // the hero on a cushion: cross-legged
  const sat = await page.eval(`(async () => {
    const g = window.__teul.game;
    const p = g.room.placements.find((q) => q.item === 'zafu' && !g.seatsTaken.has(q.x + 0.5 + ',' + (q.y + 0.5)));
    g.sitOn(p, window.__teul.engine.catalog.items.zafu, 'sit');
    await new Promise((r) => setTimeout(r, 600));
    return JSON.stringify({ seat: !!g.seat, pose: g.seat ? g.poseOnSeat(g.seat.pid) : null });
  })()`).then(JSON.parse);
  check('the hero sits cross-legged on a cushion', sat.seat && sat.pose === 'lotus', JSON.stringify(sat));
  await snap(page, 'faith-temple-inside.png');
  // standing up, an offering of fruit: palms together
  await page.eval("(async () => { const g = window.__teul.game; g.standUp?.(); g.seat = null; g.debugTeleport(2.5, 2.6); })()");
  const offered = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    g.run({ type: 'use', station: 'st.temple.buy_incense' });
    g.useStation('st.temple.incense');
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify({ pray: !!g.performing?.pray, incense: e.pocket().items?.length ?? 0 });
  })()`).then(JSON.parse);
  check('lighting incense: the hero stands with palms together', offered.pray, JSON.stringify(offered));
  await snap(page, 'faith-temple-incense.png');

  // ---- the forest circle by day: the cold ring, the idol, the stones, nobody there
  await at(page, shift, 'forest', 92.5, 50.5);
  check('the idol and the stones stand in the forest', (await placed(page, 'forest_idol')) === 1 && (await placed(page, 'standing_stone')) >= 5);
  check('the ring is cold on an ordinary day', (await placed(page, 'ritual_hearth')) === 1 && (await placed(page, 'ritual_hearth_lit')) === 0);
  check('nobody gathers on an ordinary night', !(await figures(page)).some((id) => id.startsWith('town:rite:')));
  await snap(page, 'faith-circle-day.png');

  // ---- the full-moon night: the fire, the torches, the ring of people
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const moon = await shiftTo(page, '(d) => d.full_moon', 22 * 60);
  check('a full moon comes within the month', moon >= 0 && moon < 33 * 1440, String(moon));
  await at(page, moon, 'forest', 93.5, 50.5);
  check('the fire burns in the ring on the full moon', (await placed(page, 'ritual_hearth_lit')) === 1 && (await placed(page, 'torch_stake')) >= 3);
  const rite = (await figures(page)).filter((id) => id.startsWith('town:rite:'));
  check('people stand in a ring round the fire', rite.length >= 7, JSON.stringify(rite));
  const joined = await page.eval("JSON.stringify(window.__teul.game.run({ type: 'use', station: 'st.grove.circle' }).ok)");
  check('the hero can stand in the circle that night', joined === 'true', joined);
  await snap(page, 'faith-circle-full-moon.png');
});

console.log(failed ? `${failed} FAILED` : 'ALL FAITH CHECKS PASSED');
process.exit(failed ? 1 : 0);
