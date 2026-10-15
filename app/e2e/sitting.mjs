// Sitting out of doors: on the grass of the park right where one stands (and up again), never on the road; the
// beach is left free.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/sitting.mjs [shots-dir]
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

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const noon = await page.eval('(() => { const now = window.__teul.game.now(); return (13 * 60 - (now % 1440) + 1440) % 1440; })()');
  await page.goto(`${BASE}?debug&skip&shift=${noon}`);
  await ready(page);
  const park = JSON.parse(await page.eval("JSON.stringify(window.__teul.engine.catalog.locations.village.landmarks.park)"));
  // a free cell of grass in the park
  const spot = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    for (let y = ${park.y}; y < ${park.y + park.h}; y++) for (let x = ${park.x}; x < ${park.x + park.w}; x++) {
      if (g.village.routes.free(x, y) && g.village.def.tiles[y][x] !== 'c') return JSON.stringify({ x: x + 0.5, y: y + 0.5 });
    }
    return 'null';
  })()`));
  check('the park has open ground', !!spot);
  await page.eval(`window.__teul.game.debugTeleport(${spot.x}, ${spot.y})`);
  await page.sleep(600);
  const before = await page.eval("document.querySelector('.action .label')?.textContent ?? ''");
  check('on the grass the button offers to sit down', before === 'Сісти', before);
  await page.eval("document.querySelector('.action').click()");
  await page.sleep(600);
  const sat = JSON.parse(await page.eval("JSON.stringify({ ground: window.__teul.game.groundSit, label: document.querySelector('.action .label')?.textContent })"));
  check('the hero sits on the ground, and the button says to get up', sat.ground && sat.label === 'Встати', JSON.stringify(sat));
  await shot(page, 'sit-park-grass');
  {
    // a step and one is up again
    await page.eval("(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' })); await new Promise((r) => setTimeout(r, 300)); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp' })); })()");
    await page.sleep(500);
    check('walking off, one stands up', !(await page.eval('window.__teul.game.groundSit')));
  }
  // not on the road
  const road = JSON.parse(await page.eval(`(() => { const g = window.__teul.game; const t = g.village.def.tiles; for (let y = 0; y < t.length; y++) for (let x = 0; x < t[y].length; x++) if (t[y][x] === 'c' && g.village.routes.free(x, y)) return JSON.stringify({ x: x + 0.5, y: y + 0.5 }); return 'null'; })()`));
  await page.eval(`window.__teul.game.debugTeleport(${road.x}, ${road.y})`);
  await page.sleep(600);
  check('nobody sits down in the middle of the road', (await page.eval("document.querySelector('.action .label')?.textContent ?? ''")) !== 'Сісти');

  // the beach is left as it is: sand and water, no loungers
  const loungers = await page.eval("window.__teul.game.room.placements.filter((p) => p.item === 'sun_lounger').length");
  check('the beach is free of loungers', loungers === 0, String(loungers));
});

console.log(failed ? `${failed} FAILED` : 'ALL SITTING CHECKS PASSED');
process.exit(failed ? 1 : 0);
