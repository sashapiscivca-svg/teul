// The first meeting with the world settles the name, the pet and shows the device's number; the camera holds
// still while one watches TV; the garden at home is tended from the action button; in the rain the town opens
// umbrellas or runs; the racecourse has its stables and horses.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/fixes.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
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

await withFirefox(async (page) => {
  // ---- a brand-new world: the hero screen opens on «Про мене»
  await page.goto(`${BASE}?world=fresh${Date.now() % 100000}&debug`);
  for (let i = 0; i < 60 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await page.sleep(600);
  await page.eval("document.querySelector('.title-screen .screen-go').click()");
  for (let i = 0; i < 40 && !(await page.eval("!!document.querySelector('.hero-screen .me-name')")); i++) await page.sleep(250);
  const first = JSON.parse(await page.eval(`(() => {
    const input = document.querySelector('.hero-screen .me-name');
    const device = document.querySelector('.hero-screen .device-no')?.textContent ?? '';
    input.value = 'Оксана';
    input.dispatchEvent(new Event('input'));
    document.querySelector('.hero-screen button[aria-label="Пес"]').click();
    return JSON.stringify({ device });
  })()`));
  check('the first screen asks the name and the pet, and shows the device number', /^TL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(first.device), JSON.stringify(first));
  await page.sleep(300);
  await page.eval("document.querySelector('.hero-go').click()");
  await ready(page);
  const after = JSON.parse(await page.eval("(() => { const g = window.__teul.game; return JSON.stringify({ name: window.__teul.engine.world(g.now()).player_name, pet: g.petLook.kind }); })()"));
  check('the world knows the name and walks the chosen pet', after.name === 'Оксана' && after.pet === 1, JSON.stringify(after));

  // ---- TV: the camera settles and stays still
  const tv = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game, c = window.__teul.engine.catalog;
    g.debugGo('home');
    await new Promise((r) => setTimeout(r, 1200));
    const set = g.room.placements.find((p) => p.item === 'tv');
    if (!set) return JSON.stringify({ skip: true });
    g.doUse(set.pid, 'watch');
    for (let i = 0; i < 60 && !(g.media.tv.isOpen() && g.seat); i++) await new Promise((r) => setTimeout(r, 250));
    if (!g.media.tv.isOpen()) return JSON.stringify({ skip: 'not open' });
    await new Promise((r) => setTimeout(r, 3500));
    const seen = [];
    for (let i = 0; i < 12; i++) { seen.push([g.zoom, g.pan.x, g.pan.y]); await new Promise((r) => setTimeout(r, 120)); }
    g.media.tv.close?.();
    const moved = seen.slice(1).some((s, i) => Math.abs(s[0] - seen[i][0]) > 1e-6 || Math.abs(s[1] - seen[i][1]) > 0.5 || Math.abs(s[2] - seen[i][2]) > 0.5);
    return JSON.stringify({ moved, zoom: seen[0][0] });
  })()`));
  check('watching TV the view comes close and holds still', !tv.skip && !tv.moved && tv.zoom > 1.5, JSON.stringify(tv));

  // ---- the garden at home: walk up to a bed, the button offers to tend it
  const bed = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game, c = window.__teul.engine.catalog;
    g.seat = null;
    const p = g.room.placements.find((q) => c.items[q.item]?.tags.includes('plot') && !c.items[q.item]?.tags.includes('indoor'));
    if (!p) return JSON.stringify({ none: true });
    g.debugTeleport(p.x + 0.5, p.y + 1.4);
    await new Promise((r) => setTimeout(r, 700));
    return JSON.stringify({ target: g.target?.action, label: document.querySelector('.action .label')?.textContent });
  })()`));
  check('by a garden bed at home the button tends it', bed.target === 'tend' && bed.label === 'Город', JSON.stringify(bed));
});

// ---- the rain and the racecourse
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const hip = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1000));
    const stables = window.__teul.engine.catalog.locations.hippodrome.props.filter((p) => p.item === 'stable').length;
    const herds = (window.__teul.engine.catalog.locations.hippodrome.animals ?? []).filter((a) => a.kind === 'horse').reduce((n, a) => n + a.count, 0);
    return JSON.stringify({ stables, herds });
  })()`));
  check('the racecourse has a row of stables', hip.stables >= 4, JSON.stringify(hip));
  check('and horses in the paddocks and on the infield', hip.herds >= 12, JSON.stringify(hip));
});

// ---- «Авто»: the cars as a list, bought from it; no bus stops in a town without buses
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&rich`);
  await ready(page);
  const noon = await page.eval('(() => { const now = window.__teul.game.now(); return (11 * 60 - (now % 1440) + 1440) % 1440 + 1440 * 2; })()');
  await page.goto(`${BASE}?debug&skip&rich&shift=${noon}`);
  await ready(page);
  const cars = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    document.querySelector('.hud-cars').click();
    await new Promise((r) => setTimeout(r, 400));
    const rows = document.querySelectorAll('.cars .car-row').length;
    const btn = [...document.querySelectorAll('.cars .car-row .cta')].find((b) => !b.disabled);
    btn?.click();
    await new Promise((r) => setTimeout(r, 400));
    const note = document.querySelector('.cars-note')?.textContent ?? '';
    const car = window.__teul.engine.drive(g.now())?.car?.model ?? null;
    const stops = window.__teul.engine.catalog.locations.village.props.filter((p) => p.item === 'bus_stop').length;
    return JSON.stringify({ rows, car, note, stops });
  })()`));
  check('«Авто» lists the cars to buy', cars.rows >= 6, JSON.stringify(cars));
  check('a car is bought right from the list', !!cars.car && /СТО/.test(cars.note), JSON.stringify(cars));
  check('there are no bus stops in a town without buses', cars.stops === 0, JSON.stringify(cars));
});

console.log(failed ? `${failed} FAILED` : 'ALL FIX CHECKS PASSED');
process.exit(failed ? 1 : 0);
