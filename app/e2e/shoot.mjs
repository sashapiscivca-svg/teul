// The photo session of the whole world (not a test): the title, the hero's first look, the town from above by day
// and at night, the square on its feast days through the year, the church on Sunday, the temple, the clothes
// shop, the salon, the café, the market, the menu, the taxi and the paper. Each moment in a fresh world reached
// with the test-only ?shift=.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/shoot.mjs <shots-dir>
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? '/tmp/shots';
const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1600);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.todayPanel?.close?.(); })()");
};
const clean = (page) => page.eval("(() => { document.querySelector('.toasts')?.replaceChildren(); return 1; })()");
async function snap(page, name) {
  await clean(page);
  await page.sleep(250);
  await page.shot(`${SHOTS}/${name}.png`);
  console.log('shot', name);
}

/** Minutes from now to `minute` of the first day (from today on) whose day view passes `test`. */
const shiftTo = (page, test, minute, days = 420) =>
  page.eval(`(() => {
    const e = window.__teul.engine, now = window.__teul.game.now();
    for (let k = 0; k < ${days}; k++) {
      const t = now - (now % 1440) + k * 1440 + ${minute};
      if (t < now) continue;
      if ((${test})(e.dayView(t), e.town(t).flags, e.festival ? e.festival(t) : null)) return t - now;
    }
    return -1;
  })()`);

async function go(page, shift, where, x, y, extra = '') {
  await page.goto(`${BASE}?debug&skip&shift=${Math.max(0, shift)}`);
  await ready(page);
  await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1000));
    ${where !== 'village' ? `g.enterLocation('${where}', [${Math.floor(x)}, ${Math.floor(y)}]); await new Promise((r) => setTimeout(r, 1200));` : ''}
    g.debugTeleport(${x}, ${y});
    ${extra}
  })()`);
  await page.sleep(2200);
}

await withFirefox(async (page) => {
  // ---- the title (the town with a crack in the sky) and the first look at the hero
  await page.goto(`${BASE}?debug`);
  for (let i = 0; i < 60 && !(await page.eval("!!document.querySelector('.title-screen')")); i++) await page.sleep(250);
  await page.sleep(2500);
  await snap(page, '00-title-rift');
  await page.eval("document.querySelector('.title-screen .screen-go')?.click()");
  await page.sleep(1800);
  await snap(page, '01-hero-creator');

  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const sq = JSON.parse(await page.eval("JSON.stringify(window.__teul.engine.catalog.locations.village.landmarks.square_centre)"));
  const noon = await shiftTo(page, () => true, 12 * 60);
  // ---- the town by day, from above, and its square
  await go(page, noon, 'village', sq.x + 0.5, sq.y + 2.5, 'g.overview = true;');
  await snap(page, '02-town-from-above-day');
  await go(page, noon, 'village', sq.x + 0.5, sq.y + 3.5);
  await snap(page, '03-town-square-noon');
  // the menu and the taxi
  await page.eval("document.querySelector('.hud-menu-btn').click()");
  await page.sleep(400);
  await snap(page, '04-hud-menu');
  await page.eval("(() => { document.querySelector('.hud-menu-btn').click(); window.__teul.game.openTaxi(); })()");
  await page.sleep(500);
  await snap(page, '05-taxi');
  await page.eval("(() => { const g = window.__teul.game; g.taxi.close(); g.morningPaper?.(true, null); })()");
  await page.sleep(2600);
  await snap(page, '06-morning-paper');

  // ---- the town at night: the street lamps, lit windows
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const night = await shiftTo(page, () => true, 21 * 60 + 30);
  await go(page, night, 'village', sq.x + 0.5, sq.y + 3.5);
  await snap(page, '07-town-night');
  await go(page, night, 'village', sq.x + 0.5, sq.y + 2.5, 'g.overview = true;');
  await snap(page, '08-town-from-above-night');

  // ---- the feasts on the square through the year
  for (const [id, minute, name] of [
    ['halloween', 18 * 60, '09-feast-halloween'],
    ['winter_lights', 18 * 60, '10-feast-winter-lights'],
    ['new_year_eve', 23 * 60 + 58, '11-feast-new-year-fireworks'],
    ['lunar_new_year', 11 * 60 + 20, '12-feast-lunar-new-year-dragon'],
    ['valentine', 13 * 60, '13-feast-valentine'],
    ['flower_festival', 13 * 60, '14-feast-flower-festival'],
    ['kupala', 22 * 60, '15-feast-midsummer-night'],
    ['town_day', 21 * 60 + 50, '16-feast-town-day'],
    ['harvest_fair', 12 * 60, '17-feast-harvest-fair'],
  ]) {
    await page.goto(`${BASE}?debug&skip`);
    await ready(page);
    const at = await shiftTo(page, `(d, f, fest) => d.holiday_id === '${id}' || (fest && (fest.id === '${id}' && fest.phase === 'day'))`, minute);
    if (at < 0) {
      console.log('no day for', id);
      continue;
    }
    await go(page, at, 'village', sq.x + 0.5, sq.y + 3.5);
    await snap(page, name);
  }

  // ---- inside: the church on a Sunday, the temple, the café, the clothes shop, the salon, the library
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const sunday = await shiftTo(page, "(d) => d.weekday === 'неділя'", 10 * 60);
  for (const [loc, x, y, name] of [
    ['church_in', 5.5, 8.5, '18-church-sunday'],
    ['temple_in', 4.5, 6.5, '19-temple'],
    ['cafe_in', 5.5, 6.5, '20-cafe'],
    ['clothes_in', 5.5, 6.5, '21-clothes-shop'],
    ['salon_in', 4.5, 5.5, '22-salon'],
    ['library_in', 5.5, 6.5, '23-library'],
    ['bar_cellar', 4.5, 4.5, '24-cellar-secret'],
    ['water_tower_in', 3.5, 4.5, '25-water-tower'],
  ]) {
    await go(page, sunday, loc, x, y);
    await snap(page, name);
  }
  // ---- the forest by day, the farm, the fields
  for (const [loc, x, y, name] of [['forest', 44.5, 40.5, '26-forest-glade'], ['farm', 20.5, 20.5, '27-farm'], ['fields', 20.5, 20.5, '28-fields']]) {
    await go(page, noon, loc, x, y);
    await snap(page, name);
  }
  // ---- home: the room, and the photo mode
  await page.goto(`${BASE}?debug&skip&shift=${noon}`);
  await ready(page);
  await page.eval("(async () => { const g = window.__teul.game; g.debugGo('home'); })()");
  await page.sleep(2000);
  await snap(page, '29-home');
  await page.eval("(() => { const b = document.querySelector('.hud-photo'); b?.click(); })()");
  await page.sleep(1200);
  await snap(page, '30-photo-mode');
});
console.log('done');
