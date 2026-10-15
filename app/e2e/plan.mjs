// The plan of the home: its parts told apart by their walls, a row more or less on a side (the windows going with
// the wall), a new part built and furnished, named, then taken away with its things back in the inventory; the
// floor bought as it is laid.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/plan.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

await withFirefox(async (page) => {
  const ev = (js) => page.eval(js);
  await page.goto(`${BASE}?debug&rich`);
  for (let i = 0; i < 80 && !(await ev("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await ev(`(() => { window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message))); const ce = console.error; console.error = (...a) => { window.__errs.push(a.map(String).join(' ')); ce(...a); }; })()`);
  await ev("document.querySelector('.title-screen .screen-go').click()");
  for (let i = 0; i < 40 && !(await ev("!!document.querySelector('.hero-go')")); i++) await page.sleep(250);
  await ev("document.querySelector('.hero-go').click()");
  await page.sleep(1800);
  await ev("document.querySelector('.paper-close')?.click()");
  await page.sleep(300);

  const r = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const parts = () => g.homeParts();
    const coins = () => g.engine.wallet().coins;
    // the plan opens from the shape tools of the editor
    g.enterEdit();
    g.setStudioMode('shape');
    await sleep(200);
    const open = [...document.querySelectorAll('.studio .chip, .chip')].find((b) => b.textContent === 'План дому');
    open?.click();
    await sleep(200);
    out.opened = !!open && document.querySelector('.plan-sheet')?.style.display === '';
    out.kinds = parts().map((p) => p.kind);
    out.entrances = parts().filter((p) => p.entrance).length;
    // a touch on the map picks a part
    const c = document.querySelector('.plan-map');
    const rc = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('click', { clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2, bubbles: true }));
    await sleep(100);
    out.picked = !!document.querySelector('.plan-part h3');
    // a row more on a free side of the bedroom, and back
    const bed = parts().find((p) => p.kind === 'bedroom');
    const sides = ['north', 'east', 'south', 'west'];
    const side = sides.find((s) => g.planSheet.handlers.quoteGrow(bed.id, s));
    const hang = (id) => { const own = new Set(parts().find((p) => p.id === id).cells.map(([x, y]) => x + ',' + y)); return g.homeRoom.placements.filter((p) => p.wall && own.has(p.x + ',' + p.y)).length; };
    const before = { w: bed.w, d: bed.d, hung: hang(bed.id), used: g.homeRoom.area_used };
    g.movePartEdge(bed.id, side, true);
    const grown = parts().find((p) => p.kind === 'bedroom');
    out.grew = { side, before, after: { w: grown.w, d: grown.d, hung: hang(grown.id), used: g.homeRoom.area_used } };
    g.movePartEdge(grown.id, side, false);
    const back = parts().find((p) => p.kind === 'bedroom');
    out.shrank = { w: back.w, d: back.d, hung: hang(back.id) };
    // the way in cannot be taken away
    const door = parts().find((p) => p.entrance);
    const n = parts().length;
    g.removePart(door.id);
    out.entranceStays = parts().length === n;
    // floor bought: coins for cells
    const c0 = coins(); const b0 = g.homeRoom.area_budget;
    out.buy = g.run({ type: 'buy_area', cells: 3 }).ok && coins() === c0 - 3 * g.homeRoom.cell_price && g.homeRoom.area_budget === b0 + 3;
    // a cinema, built and furnished, priced before
    const q = g.quoteBuild('cinema', 6, 7);
    const c1 = coins();
    g.buildPart('cinema', 6, 7);
    const cin = parts().find((p) => p.kind === 'cinema');
    const own = cin ? new Set(cin.cells.map(([x, y]) => x + ',' + y)) : new Set();
    out.cinema = { quote: q, spent: c1 - coins(), size: cin && [cin.w, cin.d], things: g.homeRoom.placements.filter((p) => own.has(p.x + ',' + p.y)).map((p) => p.item) };
    g.namePart(cin.id, 'name', 'Підвал');
    out.named = parts().find((p) => p.kind === 'cinema')?.name;
    const tvBefore = g.engine.inventory().find((i) => i.item === 'wall_tv')?.free ?? 0;
    g.removePart(cin.id);
    out.removed = !parts().some((p) => p.kind === 'cinema') && (g.engine.inventory().find((i) => i.item === 'wall_tv')?.free ?? 0) > tvBefore;
    out.noShopArea = !g.engine.catalog.expansions || ![...document.querySelectorAll('.shop .tab, .shop .rail-btn')].some((b) => /Площа/.test(b.textContent));
    out.errs = window.__errs;
    return JSON.stringify(out);
  })()`));

  check('the plan opens from the shape tools', r.opened);
  for (const k of ['lounge', 'kitchen', 'bedroom', 'bath', 'garden', 'farm']) check(`the house has a ${k}`, r.kinds.includes(k), JSON.stringify(r.kinds));
  check('one part holds the way in', r.entrances === 1, String(r.entrances));
  check('a touch on the map picks a part', r.picked);
  const g = r.grew;
  check('a row more on a free side', g.after.w * g.after.d > g.before.w * g.before.d && g.after.used > g.before.used, JSON.stringify(g));
  check('what hangs on the walls goes with them', g.after.hung === g.before.hung, JSON.stringify(g));
  check('and a row less brings it back', r.shrank.w === g.before.w && r.shrank.d === g.before.d && r.shrank.hung === g.before.hung, JSON.stringify(r.shrank));
  check('the part with the way in stays', r.entranceStays);
  check('floor is bought by the cell', r.buy);
  check('a cinema is built where the plan said, for what it said', !!r.cinema.size && r.cinema.quote && r.cinema.spent === r.cinema.quote.coins, JSON.stringify(r.cinema));
  check('the cinema has its screen and seats', r.cinema.things.includes('wall_tv') && r.cinema.things.includes('sofa3'), JSON.stringify(r.cinema.things));
  check('a part takes a name', r.named === 'Підвал', String(r.named));
  check('taken away, its things are back in the inventory', r.removed);
  check('no floor in the shop', r.noShopArea);
  check('nothing threw', r.errs.length === 0, JSON.stringify(r.errs.slice(0, 3)));
});

console.log(failed ? `plan: ${failed} FAILED` : 'plan: ALL PLAN CHECKS PASSED');
process.exit(failed ? 1 : 0);
