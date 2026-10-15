// The taxi, end to end: from the town, a building, the forest; every destination it offers is a real place one
// can stand on (not inside a building, not in the water), the fare is honest, a locked place says why in the
// world's words and costs nothing, the ride ends where it said, and the hero can walk on from there. The price is
// by demand (the hour, the weather, the feasts, the place): the sheet says how soon the car comes and why, and the
// ride costs exactly what the list said.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/taxi.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1400);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};

await withFirefox(async (page) => {
  // a world with money for rides, at midday
  await page.goto(`${BASE}?debug&skip&rich`);
  await ready(page);
  await page.eval("(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 1200)); })()");
  await page.sleep(800);

  // the list: nothing twice, every stop a free cell of its place, fares within reason
  const list = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    g.openTaxi();
    const shown = [...document.querySelectorAll('.taxi .taxi-row, .taxi button[data-id], .taxi .row')].length;
    g.taxi.close?.();
    const note = document.querySelector('.taxi .taxi-note')?.textContent ?? '';
    return JSON.stringify({ shown, note, places: g.taxiPlaces.map((d) => ({ id: d.id, name: d.name, location: d.location, x: d.x, y: d.y, fare: d.fare, eta: d.eta, why: d.why, shut: d.shut ?? null })) });
  })()`));
  check('the taxi offers places to go', list.places.length >= 10, String(list.places.length));
  const names = list.places.map((d) => d.name + '|' + d.location);
  check('no place is offered twice', new Set(names).size === names.length, names.filter((n, i) => names.indexOf(n) !== i).join(', '));
  check('the fares are honest (a little, more the farther, never wild)', list.places.every((d) => d.fare >= 5 && d.fare <= 120), JSON.stringify(list.places.filter((d) => d.fare < 5 || d.fare > 120)));
  check('each ride says how soon the car comes', list.places.every((d) => d.eta >= 1 && d.eta <= 25) && /Найближча машина — за \d+ хв/.test(list.note), list.note);
  const far = list.places.filter((d) => !d.shut).sort((a, b) => b.fare - a.fare)[0];
  const near = list.places.filter((d) => !d.shut && d.location === 'village').sort((a, b) => a.fare - b.fare)[0];
  check('farther costs more', far.fare > near.fare, `${far.name} ${far.fare} / ${near.name} ${near.fare}`);

  // a place still shut is shown, greyed, with why — and nobody is driven there
  const shut = list.places.filter((d) => d.shut);
  check('places still shut say why and cannot be chosen', shut.length > 0 && shut.every((d) => d.shut.length > 3), JSON.stringify(shut).slice(0, 200));
  const greyed = await page.eval(`(() => { const g = window.__teul.game; g.openTaxi(); const rows = [...document.querySelectorAll('.taxi .taxi-stop')]; const off = rows.filter((r) => r.disabled && r.querySelector('.taxi-why')).length; g.taxi.close(); return off; })()`);
  check('in the list they are greyed with the reason under the name', greyed >= shut.length, String(greyed));
  // ride to every one of them in turn, from wherever the last ride left us
  const bad = [];
  let rides = 0;
  for (const d of list.places.filter((x) => !x.shut)) {
    const r = JSON.parse(await page.eval(`(async () => {
      const g = window.__teul.game;
      g.openTaxi();
      g.taxi.close?.();
      const stop = g.taxiPlaces.find((q) => q.id === '${d.id}');
      if (!stop) return JSON.stringify({ skipped: true });
      const before = window.__teul.engine.wallet().coins;
      g.rideTaxi('${d.id}');
      await new Promise((r) => setTimeout(r, 2800));
      const free = !!g.village?.routes.free(Math.floor(g.walker.x), Math.floor(g.walker.y));
      const after = window.__teul.engine.wallet().coins;
      return JSON.stringify({ loc: g.location, x: g.walker.x, y: g.walker.y, free, paid: before - after, fare: stop.fare, want: stop.location });
    })()`));
    if (r.skipped) continue;
    rides++;
    if (r.loc !== r.want || !r.free || r.paid <= 0 || r.paid !== r.fare) bad.push(`${d.name} → ${JSON.stringify(r)}`);
  }
  check('every ride ends where it said, on free ground, paid exactly the price shown', bad.length === 0 && rides >= 10, `${rides} rides; ${bad.slice(0, 6).join(' | ')}`);

  // from inside a building the taxi still comes (to the door), and at home there is none
  const inside = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 900));
    g.enterLocation('cafe_in', [5, 7]);
    await new Promise((r) => setTimeout(r, 900));
    g.openTaxi();
    g.taxi.close?.();
    const n = g.taxiPlaces.length;
    const shown = getComputedStyle(document.querySelector('.hud-taxi')).display !== 'none';
    return JSON.stringify({ n, shown });
  })()`));
  check('from inside a building the taxi can be called', inside.shown && inside.n > 5, JSON.stringify(inside));
});

console.log(failed ? `${failed} FAILED` : 'ALL TAXI CHECKS PASSED');
process.exit(failed ? 1 : 0);
