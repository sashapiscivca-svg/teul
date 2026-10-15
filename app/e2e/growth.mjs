// The town grows and wears, end to end: building sites stage by stage, a stalled frame, an empty old house, a worn
// building and its mender, the ice-cream cart with its queue, the donut shop shut while it is built and open once
// it stands. Each moment in a fresh world (the clock only moves forward), reached with the test-only ?shift=.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/growth.mjs [shots-dir]
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

/** Minutes to add to reach `minute` of the first day (from today, up to `days` on) that `test(growthView, flags, day)` holds. */
const shiftTo = (page, test, minute, days = 900) => (console.log(`  (looking for ${test.slice(0, 60)}…)`),
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = 0; k < ${days}; k++) {
      const t = now - (now % 1440) + k * 1440 + ${minute};
      if (t < now) continue;
      if ((${test})(e.growth(t), e.town(t).flags, k)) return t - now;
    }
    return -1;
  })()`));

/** A fresh world at `shift` minutes on, out in the town by a cell. */
async function at(page, shift, x, y) {
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 900)); g.debugTeleport(${x}, ${y}); })()`);
  await page.sleep(900);
}

/** A screenshot without the passing words on top. */
async function snap(page, file) {
  console.log(`  (shot ${file})`);
  await page.eval("(() => { document.querySelector('.toasts')?.replaceChildren(); return 1; })()");
  await page.sleep(150);
  await page.shot(file);
}

const placed = (page, test) => page.eval(`window.__teul.game.room.placements.filter((p) => (${test})(p)).map((p) => p.item).join(',')`);
const figures = (page) => page.eval("window.__teul.game.townFigures().map((f) => f.id).join(',')");
const site = (page, id) => page.eval(`JSON.stringify(window.__teul.engine.catalog.growth.sites.find((s) => s.id === '${id}'))`).then(JSON.parse);

// ---- 1. the first days: the donut shop is a fenced pit at most, its door shut, saying why in the world's words
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shut = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    e.command({ type: 'travel', to: 'village' }, g.now());
    const r = e.command({ type: 'travel', to: 'donuts_in' }, g.now());
    return r.ok ? 'open?!' : JSON.stringify(r.error);
  })()`);
  check('the donut shop does not open before it is built, and says it is being built', shut.includes('"flag"') && shut.includes('donut_site'), shut);
  const name = await page.eval("window.__teul.engine.catalog.locations.village.name");
  check('Lypove is a town now', name === 'Містечко Липове', name);
  const tower = await page.eval("JSON.stringify(window.__teul.engine.catalog.sites.water_tower_site)");
  check('the water tower stands on the factories\' edge, not in the middle', JSON.parse(tower).x >= 56, tower);
  const marks = await page.eval("Object.keys(window.__teul.engine.catalog.locations.village.landmarks ?? {}).length");
  check('the town\'s places have names to stand by', marks > 40, String(marks));
});

// ---- 2. building sites in stages (several dates), builders at work, a stalled frame
const stages = [
  ['pit', "(g) => g.sites.some((s) => s.id === 'grow.nova1' && s.stage === 'pit')", 'site_pit'],
  ['foundation', "(g) => g.sites.some((s) => s.id === 'grow.nova1' && s.stage === 'foundation')", 'site_slab'],
  ['walls', "(g) => g.sites.some((s) => s.id === 'grow.nova1' && s.stage === 'walls')", 'site_frame'],
  ['roof', "(g) => g.sites.some((s) => s.id === 'grow.nova1' && s.stage === 'roof')", 'cottage_cream'],
  ['built', "(g) => g.sites.some((s) => s.id === 'grow.nova1' && s.stage === 'built')", 'cottage_cream'],
];
for (const [stage, test, item] of stages) {
  await withFirefox(async (page) => {
    await page.goto(`${BASE}?debug&skip`);
    await ready(page);
    // a working weekday in its stage, mid-morning
    const shift = await shiftTo(page, `(g, f) => (${test})(g) && (${stage === 'built' ? 'true' : "f.includes('grow:grow.nova1:work')"})`, 10 * 60 + 30);
    check(`the house at Новобудовна 1 reaches its ${stage}`, shift > 0, String(shift));
    if (shift <= 0) return;
    const s = await site(page, 'grow.nova1');
    await at(page, shift, s.x - 0.5, s.y + 1.6);
    const here = await placed(page, `(p) => p.item.startsWith('${item}')`);
    check(`the ${stage} stands on the plot`, here.length > 0, here);
    if (stage !== 'built') {
      const f = await figures(page);
      check(`builders are at work on the ${stage}`, f.includes('town:builder:grow:grow.nova1'), f);
    }
    if (stage === 'built') {
      const stuck = await page.eval('JSON.stringify(window.__teul.game.debugStuckPeople())');
      check('nobody walks through the new houses and props', stuck === '[]', stuck);
    }
    if (SHOTS) await snap(page, `${SHOTS}/growth-${['pit', 'foundation'].includes(stage) ? '1' : stage === 'walls' ? '2' : stage === 'roof' ? '3' : '4'}-${stage}.png`);
  });
}

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(g, f) => f.includes('grow:grow.nova7:stalled')", 11 * 60);
  check('a building site stalls and stands as a bare frame', shift > 0, String(shift));
  if (shift <= 0) return;
  const s = await site(page, 'grow.nova7');
  await at(page, shift, s.x - 0.5, s.y + 1.6);
  check('the stalled frame stands with its graffiti and weeds', (await placed(page, "(p) => p.item.startsWith('site_stalled')")).length > 0);
  check('nobody works at a stalled site', !(await figures(page)).includes('grow:grow.nova7'));
  if (SHOTS) await snap(page, `${SHOTS}/growth-5-nedobudova.png`);
});

// ---- 3. an old house left empty; a worn building with its mender on the ladder
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(g, f) => f.some((x) => x.startsWith('abandon:'))", 16 * 60);
  check('an old house is left empty some months on', shift > 0, String(shift));
  if (shift <= 0) return;
  const old = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.catalog.growth.abandon.find((a) => window.__teul.engine.town(window.__teul.game.now() + ${shift}).flags.includes('abandon:' + a.id)))`));
  await at(page, shift, old.x + 0.5, old.y + 1.5);
  check('it stands boarded up, the yard overgrown', (await placed(page, "(p) => p.item.startsWith('abandoned_')")).length > 0);
  if (SHOTS) await snap(page, `${SHOTS}/growth-6-abandoned.png`);
});

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(g, f) => f.some((x) => x.startsWith('fix:') && f.includes('wear:' + x.slice(4) + ':crack')) || f.some((x) => x.startsWith('fix:') && f.includes('wear:' + x.slice(4) + ':window'))", 10 * 60 + 15, 400);
  check('a building wears and its workers come to mend it', shift > 0, String(shift));
  if (shift <= 0) return;
  const w = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.catalog.growth.wear.find((w) => window.__teul.engine.town(window.__teul.game.now() + ${shift}).flags.includes('fix:' + w.id)))`));
  await at(page, shift, w.x + 0.5, w.y + 1.6);
  check('the worn look shows on the building', (await placed(page, "(p) => p.item.startsWith('worn_')")).length > 0);
  check('the ladder stands by it', (await placed(page, "(p) => p.item === 'ladder_wall'")).length > 0);
  check('a mender works on it', (await figures(page)).includes('town:mender:fix:' + w.id));
  if (SHOTS) await snap(page, `${SHOTS}/growth-7-repair.png`);
});

// ---- 4. the ice-cream cart on a warm day: the seller, the children queueing, an ice cream bought and eaten
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(g, f, k) => g.cart && new Date(Date.now() + k * 864e5).getDay() !== 0", 15 * 60 + 20, 400);
  check('the ice-cream cart comes out on a warm day', shift > 0, String(shift));
  if (shift <= 0) return;
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  const stop = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 900));
    const cart = g.room.placements.find((p) => p.item === 'ice_cream_cart');
    if (!cart) return 'no cart';
    g.debugTeleport(cart.x + 1, cart.y + 2.6);
    return JSON.stringify({ x: cart.x, y: cart.y });
  })()`);
  check('the cart stands at its stop of the hour', stop.startsWith('{'), stop);
  await page.sleep(800);
  const f = await figures(page);
  check('the seller and a queue of children are at the cart', f.includes('town:seller:cart:seller') && (f.match(/town:kid:/g) ?? []).length >= 2, f);
  const bought = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const r = e.command({ type: 'use', station: 'st.cart.ice_cream_berry' }, g.now());
    return r.ok ? 'ok' : JSON.stringify(r.error);
  })()`);
  check('an ice cream can be bought from the cart', bought === 'ok', bought);
  if (SHOTS) await snap(page, `${SHOTS}/growth-8-icecream.png`);
});

// ---- 5. the donut shop, built and open: outside and inside
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, "(g, f, k) => f.includes('grow:donut_site:built') && new Date(Date.now() + k * 864e5).getDay() !== 0", 13 * 60);
  check('the donut shop is finished some weeks on', shift > 0, String(shift));
  if (shift <= 0) return;
  const s = await site(page, 'donut_site');
  await at(page, shift, s.x + 0.5, s.y - 1.5);
  check('«Пончикова» stands on the outskirts', (await placed(page, "(p) => p.item === 'donut_shop'")).length > 0);
  if (SHOTS) await snap(page, `${SHOTS}/growth-9-donuts-outside.png`);
  const inside = await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const site = e.catalog.sites.donut_site;
    g.enterLocation('donuts_in', [site.x, site.y]);
    await new Promise((r) => setTimeout(r, 1200));
    const r = e.command({ type: 'use', station: 'st.donuts.donut_pink' }, g.now());
    return JSON.stringify({ at: g.location, bought: r.ok ? 'ok' : r.error });
  })()`);
  check('its door leads in and a donut can be bought', inside.includes('"at":"donuts_in"') && inside.includes('"bought":"ok"'), inside);
  await page.eval("(() => { const g = window.__teul.game; g.debugTeleport(4.5, 4.5); })()");
  await page.sleep(900);
  if (SHOTS) await snap(page, `${SHOTS}/growth-10-donuts-inside.png`);
  for (const e of page.errors()) if (e.level === 'error' && !/prepend of null/.test(e.text)) check('no console errors', false, e.text);
});

console.log(failed ? `${failed} CHECK(S) FAILED` : 'all growth checks passed');
process.exit(failed ? 1 : 0);
