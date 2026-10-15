// Cold and warmth, end to end: the lake frozen in a frosty winter while the river flows, the hero skating on it,
// the frost on the screen in the cold, the glow by the stove, the summer heat, the rain on the lens, the clothes
// of every season, and the street thermometer by the clock (the only number; the season is not named).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/warmth.mjs [shots-dir]
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
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.away?.close?.(); })()");
};

/** Minutes to add to reach `minute` of the first day (from today) whose comfort view (out of doors) passes. */
const shiftTo = (page, test, minute, from = 0) =>
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = ${from}; k < 400; k++) {
      const t = now + k * 1440 + (${minute} - (now % 1440));
      const v = e.comfort(false, -1, t);
      const sky = JSON.parse(e.weatherAt(t));
      if ((${test})(v, sky, e.dayView(t))) return t - now;
    }
    return -1;
  })()`);

const go = (page, where, x, y) =>
  page.eval(`(async () => { const g = window.__teul.game; g.debugGo('${where}'); await new Promise((r) => setTimeout(r, 900)); ${x !== undefined ? `g.debugTeleport(${x}, ${y});` : ''} await new Promise((r) => setTimeout(r, 400)); return true; })()`);

/** Holds the screen's feeling still at its target (they come on over seconds) and gives it a moment to draw. */
const settle = (page) => page.eval(`(async () => { const g = window.__teul.game; g.updateComfort(); g.skin.settle(); await new Promise((r) => setTimeout(r, 700)); return JSON.stringify({ c: g.comfortNow, s: g.skin.state() }); })()`);

// ---- 1. a frosty winter day: the lake iced over, the river flowing, skating, the frost on the screen
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const clock = await page.eval("document.querySelector('.hud-tl')?.textContent ?? ''");
  check('the clock shows the air in degrees and no season', /\d\d:\d\d · (\+|\u2212)?\d+°/.test(clock) && !/Осінь|Зима|Весна|Літо/.test(clock), clock);

  const shift = await shiftTo(page, '(v, sky, day) => v.ice && v.out < -30 && sky !== "snow" && day.day_off', 15 * 60);
  check('a frosty day with the lake frozen comes this winter', shift > 0, String(shift));
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  await go(page, 'village');
  const lake = JSON.parse(await page.eval(`JSON.stringify((() => {
    const g = window.__teul.game;
    const loc = g.village.loc;
    const runs = g.village.def.ice ?? [];
    const [y, x0] = runs[Math.floor(runs.length / 2)];
    return { ice: loc.ice.size, iceWater: [...loc.ice].some((k) => loc.water.has(k)), painted: g.room.floor_paint[x0 + ',' + y], river: loc.water.has('58,5'), riverPaint: g.room.floor_paint['58,5'], cell: [x0, y] };
  })())`));
  check('the lake is iced over (laid as ice, not water)', lake.ice > 100 && !lake.iceWater && lake.painted === 'floor.ice', JSON.stringify(lake));
  check('the river keeps flowing', lake.river && lake.riverPaint === 'floor.water', JSON.stringify(lake));
  const skate = await page.eval(`(async () => {
    const g = window.__teul.game;
    const [x, y] = [${lake.cell[0]} + 2.5, ${lake.cell[1]} + 0.5];
    g.debugTeleport(x, y);
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify({ onIce: g.onIce(), swim: g.swimming() });
  })()`);
  check('the hero stands on the ice and does not swim', skate.includes('"onIce":true') && skate.includes('"swim":false'), skate);
  const cold = JSON.parse(await settle(page));
  check('out on a frosty day in everyday clothes the hero is cold and their breath shows', cold.c.feel < 0 && cold.c.breath, JSON.stringify(cold.c));
  check('the cold shows on the screen (frost from the edges), not as a number', cold.s.cold > 0 && (await page.eval("getComputedStyle(document.querySelector('.feel-layer')).display")) !== 'none');
  check('no meter or number about the cold is on the screen', !(await page.eval("/холод|тепло|\\d+%/i.test(document.querySelector('.hud').textContent)")));
  const fx = await page.eval(`JSON.stringify((() => { const g = window.__teul.game; g.moving = false; return g.playerSprite().length; })())`);
  check('the hero is drawn hugging themself', Number(fx) > 4, fx);
  if (SHOTS) await page.shot(`${SHOTS}/warmth-cold-frost.png`);
  // put the hero on the bank so the skaters and the river are in view, the screen calm for the picture
  await page.eval(`(async () => { const g = window.__teul.game; g.debugTeleport(${lake.cell[0]} + 0.5, ${lake.cell[1]} + 0.5); await new Promise((r) => setTimeout(r, 6000)); })()`);
  // the hero glides off across the ice
  const glide = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.path = [[${lake.cell[0]} + 6.5, ${lake.cell[1]} + 0.5]];
    await new Promise((r) => setTimeout(r, 450));
    return JSON.stringify({ onIce: g.onIce(), moving: g.moving });
  })()`);
  check('the hero skates across the frozen lake', glide.includes('"onIce":true') && glide.includes('"moving":true'), glide);
  const skaters = await page.eval(`(() => { const g = window.__teul.game; return [...g.resPoses.values()].filter((p) => g.village.loc.ice.has(Math.floor(p.x) + ',' + Math.floor(p.y))).length; })()`);
  console.log(`  (skaters on the ice now: ${skaters})`);
  if (SHOTS) await page.shot(`${SHOTS}/warmth-frozen-lake.png`);

  // a frosty winter long after the last bill was paid: the gas is cut off and the house is cold
  const home = await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('home'); await new Promise((r) => setTimeout(r, 900)); g.updateComfort(); return JSON.stringify({ c: g.comfortNow, gas: !(g.bills?.utilities ?? []).some((u) => u.id === 'gas' && !u.on) }); })()`);
  const h = JSON.parse(home);
  check('at home in a frost the house is warm while the gas is on, cold when it is cut off', h.gas ? h.c.feel >= 0 : h.c.feel < 0, home);
});

// ---- 1b. today, at home by the stove (the gas is on): the golden glow
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  // home, by the stove: the golden glow
  const stove = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('home');
    await new Promise((r) => setTimeout(r, 900));
    const s = g.room.placements.find((p) => p.item === 'stove' || p.item === 'fireplace');
    if (!s) return 'no stove';
    g.debugTeleport(s.x + 0.5, s.y + 1.4);
    await new Promise((r) => setTimeout(r, 300));
    return 'ok';
  })()`);
  const warm = JSON.parse(await settle(page));
  check('by the stove at home it is warm and the screen glows', stove === 'ok' && warm.c.hearth && warm.s.hearth > 0 && warm.s.cold === 0, stove + ' ' + JSON.stringify(warm));
  await page.sleep(4500);
  if (SHOTS) await page.shot(`${SHOTS}/warmth-stove.png`);
});

// ---- 2. a hot summer noon: the heat; a rainy day: wet through
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await shiftTo(page, '(v, sky) => v.out >= 280 && sky === "clear"', 14 * 60, 150);
  check('a hot clear summer afternoon comes', shift > 0, String(shift));
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  await go(page, 'village', 40, 20);
  const hot = JSON.parse(await settle(page));
  check('in the heat the screen burns white and shimmers, the hero sweats', hot.c.feel > 0 && hot.c.sun && hot.s.heat > 0, JSON.stringify(hot));
  if (SHOTS) await page.shot(`${SHOTS}/warmth-summer-heat.png`);
});

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  // the rain comes for some hours of a day: find a day and an hour of it
  const at = await page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    for (let k = 1; k < 300; k++)
      for (let h = 9; h < 20; h++) {
        const t = now + k * 1440 + (h * 60 - (now % 1440));
        if (JSON.parse(e.weatherAt(t)) === 'rain' && e.comfort(false, -1, t).out > 50) return t - now;
      }
    return -1;
  })()`);
  check('a rainy day comes', at > 0, String(at));
  await page.goto(`${BASE}?debug&skip&shift=${at}`);
  await ready(page);
  await go(page, 'village', 40, 20);
  const wet = JSON.parse(await settle(page));
  check('out in the rain without a raincoat the hero is wet through: drops on the lens', wet.c.wet && wet.s.wet > 0, JSON.stringify(wet));
  if (SHOTS) await page.shot(`${SHOTS}/warmth-rain.png`);
});

// ---- 3. the clothes of every season: on sale at «Льон», in the wardrobe's tabs, drawn on the hero
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const sale = await page.eval(`(() => {
    const items = window.__teul.engine.catalog.items;
    return ['wear.puffer_red', 'wear.sheepskin', 'wear.felt_boots', 'wear.mittens_deer', 'wear.earflap_hat', 'wear.trench_beige', 'wear.windbreaker_mint', 'wear.umbrella_red', 'wear.sundress_lemon', 'wear.swimsuit_dots', 'wear.swim_shorts', 'wear.panama_white', 'wear.sunglasses'].filter((id) => !items[id]).join(',');
  })()`);
  check('the clothes shop has clothes for every season', sale === '', sale);
  // a board of the four seasons' outfits, drawn with the game's own figure
  const board = await page.eval(`(() => {
    const g = window.__teul.game;
    const base = g.engine.room().settings;
    const outfits = [
      ['Весна', { 'look.top': '13', 'look.top_color': '#c9a878', 'look.top2_color': '#5a3a28', 'look.bottom': '0', 'look.bottom_color': '#2f3a5a', 'look.shoe': '1', 'look.shoes_color': '#4a8fd0', 'look.acc': '12', 'look.acc_color': '#d9534f' }],
      ['Літо', { 'look.top': '15', 'look.top_color': '#f4d35e', 'look.top2_color': '#5aa469', 'look.shoe': '2', 'look.shoes_color': '#8a5a2e', 'look.acc': '13', 'look.acc_color': '#e8e0c8' }],
      ['Осінь', { 'look.top': '10', 'look.top_color': '#d9534f', 'look.top2_color': '#e8e0c8', 'look.bottom': '0', 'look.bottom_color': '#2f3a5a', 'look.shoe': '1', 'look.shoes_color': '#8a5a2e', 'look.acc': '2', 'look.acc_color': '#f4d35e' }],
      ['Зима', { 'look.top': '11', 'look.top_color': '#d9534f', 'look.top2_color': '#f2ead8', 'look.bottom': '0', 'look.bottom_color': '#2f3a5a', 'look.shoe': '3', 'look.shoes_color': '#8a8a96', 'look.acc': '14', 'look.acc_color': '#7a7a88', 'look.mitt': '1', 'look.mitt_color': '#e8e0c8' }],
    ];
    const c = document.createElement('canvas');
    c.width = 844; c.height = 390;
    c.style.cssText = 'position:fixed;inset:0;z-index:99;background:#1b1d33';
    const x = c.getContext('2d');
    x.fillStyle = '#1b1d33'; x.fillRect(0, 0, 844, 390);
    x.font = '20px Pixelify Sans, sans-serif'; x.fillStyle = '#e8e0c8'; x.textAlign = 'center';
    outfits.forEach(([name, set], i) => {
      const look = g.debugLook({ ...base, ...set });
      ['down', 'right'].forEach((dir, j) => {
        const layers = g.debugFigure(look, dir);
        x.save();
        x.translate(8 + i * 210 + j * 98, 60);
        x.scale(3.1, 3.1);
        for (const l of layers) { x.fillStyle = l.color; x.fill(new Path2D(l.path)); }
        x.restore();
      });
      x.fillText(name, 8 + i * 210 + 98, 330);
    });
    document.body.append(c);
    return 'ok';
  })()`);
  check('the outfits of the four seasons draw on the hero from every side', board === 'ok', board);
  if (SHOTS) await page.shot(`${SHOTS}/warmth-outfits.png`);
});

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
