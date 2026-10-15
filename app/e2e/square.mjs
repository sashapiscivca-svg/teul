// The square through the year and two new things in town: the fountain on the square in summer and a fir in a tub
// in its place in winter; the cinema «Зоря» (a ticket, a seat facing the screen, the film); «Про мене» in the menu
// (one's name, who walks along).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/square.mjs [shots-dir]
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
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.eval("(() => { document.querySelector('.toasts')?.replaceChildren(); return 1; })()");
  await page.sleep(200);
  await page.shot(`${SHOTS}/${name}.png`);
};
const shiftTo = (page, test, minute) =>
  page.eval(`(() => { const e = window.__teul.engine, now = window.__teul.game.now(); for (let k = 0; k < 400; k++) { const t = now - (now % 1440) + k * 1440 + ${minute}; if (t < now) continue; if ((${test})(e.dayView(t), e.town(t).flags)) return t - now; } return -1; })()`);
const placed = (page, item) => page.eval(`window.__teul.game.room.placements.filter((p) => p.item === '${item}').length`);

await withFirefox(async (page) => {
  for (const [name, test] of [['summer', '(d, f) => !f.includes("fountain_off")'], ['winter', '(d, f) => f.includes("fountain_off")']]) {
    await page.goto(`${BASE}?debug&skip`);
    await ready(page);
    const shift = await shiftTo(page, test, 12 * 60);
    await page.goto(`${BASE}?debug&skip&rich&shift=${shift}`);
    await ready(page);
    const c = JSON.parse(await page.eval("JSON.stringify(window.__teul.engine.catalog.locations.village.landmarks.square_centre)"));
    await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 1200)); g.debugTeleport(${c.x + 0.5}, ${c.y + 2.5}); })()`);
    await page.sleep(1500);
    const fountain = await placed(page, 'fountain');
    const fir = await placed(page, 'square_winter_fir');
    if (name === 'summer') check('in the warm months the fountain plays on the square', fountain === 1 && fir === 0, `${fountain}/${fir}`);
    else check('in winter the fountain is taken down and a fir stands in its place', fountain === 0 && fir === 1, `${fountain}/${fir}`);
    await shot(page, `square-${name}`);
  }

  // the cinema: a ticket at the window, a seat facing the screen, the film
  const cinema = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.enterLocation('cinema_in', [6, 9]);
    await new Promise((r) => setTimeout(r, 1500));
    const t = g.run({ type: 'use', station: 'st.cinema.ticket' });
    const seat = g.room.placements.find((p) => p.item === 'cinema_seat');
    g.debugTeleport(seat.x + 0.5, seat.y + 1.5);
    await new Promise((r) => setTimeout(r, 300));
    g.sitOn(seat, window.__teul.engine.catalog.items.cinema_seat, 'sit');
    await new Promise((r) => setTimeout(r, 600));
    const day = window.__teul.engine.dayView(g.now());
    const film = g.run({ type: 'use', station: day.day_off && !day.holiday ? 'st.cinema.film_weekend' : 'st.cinema.film' });
    return JSON.stringify({ loc: g.location, ticket: t.ok, film: film.ok || film.error?.kind, front: g.seat?.front });
  })()`));
  check('the cinema sells a ticket and shows the film', cinema.loc === 'cinema_in' && cinema.ticket && (cinema.film === true || cinema.film === 'closed'), JSON.stringify(cinema));
  check('in the hall one sits facing the screen', JSON.stringify(cinema.front) === '[0,-1]', JSON.stringify(cinema.front));
  await shot(page, 'cinema-hall');

  // «Про мене»: a new name, and a dog to walk with
  await page.eval("document.querySelector('.hud-me').click()");
  await page.sleep(500);
  const me = JSON.parse(await page.eval(`(async () => {
    const i = document.querySelector('.me-name');
    i.value = 'Тестовий Сусід';
    [...document.querySelectorAll('.me .cta')].find((b) => b.textContent.includes('Зберегти')).click();
    await new Promise((r) => setTimeout(r, 300));
    [...document.querySelectorAll('.me-pet')].find((b) => b.textContent.includes('Пес')).click();
    await new Promise((r) => setTimeout(r, 400));
    const g = window.__teul.game;
    return JSON.stringify({ name: window.__teul.engine.world(g.now()).player_name, pet: g.petLook.kind, on: document.querySelector('.me-pet.on')?.textContent });
  })()`));
  check('«Про мене» renames the hero', me.name === 'Тестовий Сусід', JSON.stringify(me));
  check('and picks who walks along', me.pet === 1 && /Пес/.test(me.on ?? ''), JSON.stringify(me));
  await shot(page, 'me-sheet');
});

console.log(failed ? `${failed} FAILED` : 'ALL SQUARE CHECKS PASSED');
process.exit(failed ? 1 : 0);
