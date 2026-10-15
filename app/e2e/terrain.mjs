// The lie of the land: a raised cell's sides go down to the land in front of it (to the land round the map at the
// map's edge, under the water by a quay) without a hole of a pixel, from every side the view is turned to; a high
// bank hides whoever stands behind it and not whoever stands in front of it or on top of it; a tap on raised land
// picks the cell one sees there; one walks down stairs and off a cliff, and not up it.
// A small place made for the test (a plateau at the map's corner, a terrace of turf with a rock on it, a river under
// a stone quay, stairs, a jumble of hills).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/terrain.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';
// height units in a step of the land (app/src/geometry.ts STEP)
const S = 26;

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
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); g.todayPanel?.close(); })()");
};
const J = async (page, js) => JSON.parse(await page.eval(`JSON.stringify(${js})`));

/** The sky's colour while testing: a pixel of it inside the land is a hole. */
const KEY = [255, 0, 255];

/** The test's place: 20 × 20, heights in steps. */
const PLACE = `(() => {
  const W = 20, H = 20, t = [], hs = [];
  for (let y = 0; y < H; y++) {
    let tr = '', hr = '';
    for (let x = 0; x < W; x++) {
      let c = 'r', h = 0;
      if (x < 6 && y < 6) { c = 's'; h = 12; }
      else if (x >= 8 && y < 8) { c = 'g'; h = 6; if (x >= 14 && y < 3) { c = 'r'; h = 9; } }
      else if (y >= 10 && y <= 11) c = 'w';
      else if (y >= 12 && x < 8) { c = 's'; h = 6; }
      else if (y >= 12 && x >= 8 && x <= 10) { c = 's'; h = Math.min(6, y - 11); }
      else if (y >= 12) { c = 'g'; h = [0, 1, 3, 2, 4, 1, 0, 2, 5][(x * 3 + y * 5) % 9]; }
      tr += c; hr += h.toString(36);
    }
    t.push(tr); hs.push(hr);
  }
  return { id: 'test_terrain', name: 'Рельєф', w: W, h: H, tiles: t, heights: hs, legend: { r: 'floor.gravel', g: 'floor.grass', s: 'floor.zl_street', w: 'floor.water' },
    props: [{ item: 'tree_pine', x: 7, y: 3 }, { item: 'rocks', x: 12, y: 4 }, { item: 'tree_oak', x: 16, y: 6 }, { item: 'bush_round', x: 3, y: 3 }],
    places: [], exits: [], spots: [], fishing: [], beyond: true };
})()`;

/** Pixels of the sky's colour inside the land on the screen now: every cell's column, from its top down to the
 * ground under it, less one art pixel round the outline of the whole (where the edge of a tile meets the sky). */
const HOLES = `(() => {
  const g = window.__teul.game, r = g.renderer, room = g.room, v = g.view;
  const cv = r.canvas, W = cv.width, H = cv.height;
  const px = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const s = r.smooth ? r.k : 1;
  const m = document.createElement('canvas'); m.width = W; m.height = H;
  const mg = m.getContext('2d');
  mg.setTransform(s, 0, 0, s, r.subX * s, r.subY * s);
  mg.fillStyle = '#fff';
  const rot = (x, y) => (v === 0 ? [x, y] : v === 1 ? [-y, x] : v === 2 ? [-x, -y] : [y, -x]);
  const at = (rx, ry, z) => [(rx - ry) * 16 + r.camX, (rx + ry) * 8 - z * 0.26 + r.camY];
  for (const [x, y] of room.cells) {
    const h = room.terrain?.[x + ',' + y] ?? 0;
    const [a0, b0] = rot(x, y), [a1, b1] = rot(x + 1, y + 1);
    const rx = Math.min(a0, a1), ry = Math.min(b0, b1);
    const pts = [at(rx, ry, h), at(rx + 1, ry, h), at(rx + 1, ry, 0), at(rx + 1, ry + 1, 0), at(rx, ry + 1, 0), at(rx, ry + 1, h)];
    mg.beginPath();
    pts.forEach(([X, Y], i) => (i ? mg.lineTo(X, Y) : mg.moveTo(X, Y)));
    mg.closePath();
    mg.fill();
  }
  const ma = mg.getImageData(0, 0, W, H).data;
  // one art pixel in from the outline: a pixel counts only if all within that distance are inside
  const e = Math.max(1, Math.ceil(s));
  const row = new Uint8Array(W * H), inn = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) { run = ma[(y * W + x) * 4 + 3] > 250 ? run + 1 : 0; if (run > 2 * e) row[y * W + x - e] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let run = 0;
    for (let y = 0; y < H; y++) { run = row[y * W + x] ? run + 1 : 0; if (run > 2 * e) inn[(y - e) * W + x] = 1; }
  }
  let holes = 0, inside = 0, first = null;
  for (let i = 0; i < W * H; i++) {
    if (!inn[i]) continue;
    inside++;
    if (px[i * 4] === ${KEY[0]} && px[i * 4 + 1] === ${KEY[1]} && px[i * 4 + 2] === ${KEY[2]}) {
      holes++;
      if (!first) first = [Math.round(((i % W) * cv.clientWidth) / W), Math.round((Math.floor(i / W) * cv.clientHeight) / H)];
    }
  }
  return { holes, inside, first };
})()`;

/** How much of the hero's figure shows on the screen as it was drawn (0 … 1). */
const SHOWN = `(() => {
  const r = window.__teul.game.renderer, gh = r.heroGhost;
  if (!gh) return -1;
  const cv = r.canvas, s = r.smooth ? r.k : 1;
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const sp = gh.canvas.getContext('2d').getImageData(0, 0, gh.canvas.width, gh.canvas.height).data;
  let solid = 0, seen = 0;
  for (let y = 0; y < gh.canvas.height; y++) for (let x = 0; x < gh.canvas.width; x++) {
    const i = (y * gh.canvas.width + x) * 4;
    if (sp[i + 3] < 255) continue;
    const X = Math.floor((gh.x + x + 0.5 + r.subX) * s), Y = Math.floor((gh.y + y + 0.5 + r.subY) * s);
    if (X < 0 || Y < 0 || X >= cv.width || Y >= cv.height) continue;
    solid++;
    const k = (Y * cv.width + X) * 4;
    if (px[k] === sp[i] && px[k + 1] === sp[i + 1] && px[k + 2] === sp[i + 2]) seen++;
  }
  return solid ? seen / solid : -1;
})()`;

/** The view turned to `v` (a quarter turn at a time, as the player turns it). */
const turnTo = async (page, v) => {
  for (let i = 0; i < 4 && (await page.eval('window.__teul.game.view')) !== v; i++) await page.eval('window.__teul.game.rotateView(1)');
};

/** Stands at (x, y), turns the view to each side and looks for holes; `name` for the report. */
const noHoles = async (page, name, x, y, shot) => {
  const bad = [];
  for (let v = 0; v < 4; v++) {
    await turnTo(page, v);
    await page.eval(`window.__teul.game.debugTeleport(${x}, ${y})`);
    await page.sleep(700);
    const h = await J(page, HOLES);
    if (h.holes > 0 || h.inside < 1000) bad.push({ v, ...h });
    if (SHOTS && shot) await page.shot(`${SHOTS}/terrain-${shot}-v${v}.png`);
  }
  check(`${name}: no hole in the land, the view turned every way`, bad.length === 0, JSON.stringify(bad));
};

/** Taps on the middle of each cell (as drawn, at its height) pick that cell, the view turned every way. */
const picks = async (page, name, cells) => {
  const wrong = [];
  for (let v = 0; v < 4; v++) {
    await turnTo(page, v);
    await page.sleep(300);
    const got = await J(page, `(${JSON.stringify(cells)}).map(([x, y]) => { const g = window.__teul.game; g.debugTeleport(x + 0.5, y + 2.5); const c = g.debugCellScreen(x, y); const p = g.renderer.floorPoint(c.x, c.y); return [x, y, Math.floor(p.x), Math.floor(p.y)]; })`);
    for (const [x, y, px, py] of got) if (x !== px || y !== py) wrong.push({ v, cell: [x, y], picked: [px, py] });
  }
  check(`${name}: a tap on raised land picks the cell drawn there`, wrong.length === 0, JSON.stringify(wrong.slice(0, 6)));
};

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&device=mouse&world=terrain${Date.now() % 1000}`);
  await ready(page);
  await page.eval(`window.__teul.game.renderer.testKey = 'rgb(${KEY.join(',')})'`);

  // ---- the test's place
  await page.eval(`(() => { const g = window.__teul.game; g.enterLocation('test_terrain', [7, 9], true, ${PLACE}); g.zoom = 1; })()`);
  await page.sleep(1500);
  check('in the test place, its land in heights', (await page.eval('window.__teul.game.location')) === 'test_terrain' && (await page.eval("window.__teul.game.room.terrain['2,2']")) === 12 * S);
  await noHoles(page, 'a plateau at the map\'s corner (the edge of the map high up)', 6.5, 6.5, 'corner');
  await noHoles(page, 'a terrace of turf, a rock above it', 12.5, 9.5, 'terrace');
  await noHoles(page, 'a quay over a river', 4.5, 10.5, 'quay');
  await noHoles(page, 'stairs up from the river', 9.5, 12.5, 'stairs');
  await noHoles(page, 'hills of three heights and more', 15.5, 15.5, 'hills');

  // who stands behind a high bank is hidden by it; in front of it or up on it, seen
  const shown = async (v, x, y, shot) => {
    await turnTo(page, v);
    await page.eval(`window.__teul.game.debugTeleport(${x}, ${y})`);
    await page.sleep(600);
    if (SHOTS) await page.shot(`${SHOTS}/terrain-${shot}.png`);
    return page.eval(SHOWN);
  };
  const behind = await shown(2, 6.5, 1.5, 'behind');
  check('behind the plateau (twelve steps high), the hero is hidden by it', behind >= 0 && behind < 0.15, String(behind));
  // (south of it: east of it the six-step terrace stands in front of one, and hides one's side)
  const before = await shown(0, 2.5, 6.5, 'before');
  check('in front of it, seen whole', before > 0.95, String(before));
  const onTop = await shown(0, 5.8, 1.5, 'ontop');
  check('up on it by its edge, seen whole', onTop > 0.95, String(onTop));
  const onTerrace = await shown(0, 8.3, 5.5, 'onterrace');
  check('on the terrace by its edge (the land lower behind it), seen whole', onTerrace > 0.95, String(onTerrace));

  await picks(page, 'the test place', [[3, 3], [5, 2], [2, 5], [0, 0], [12, 7], [12, 4], [19, 0], [15, 1], [9, 15], [10, 17], [4, 12], [7, 19]]);

  // walking: up the stairs, not up the cliff, off the cliff's edge down to the ground
  await turnTo(page, 0);
  const walk = async (from, to, ms = 4000) => {
    await page.eval(`window.__teul.game.debugTeleport(${from[0]}, ${from[1]})`);
    await page.sleep(400);
    const c = await J(page, `window.__teul.game.debugCellScreen(${to[0]}, ${to[1]})`);
    await page.tap(c.x, c.y, 'mouse');
    await page.sleep(ms);
    return J(page, `(() => { const g = window.__teul.game; return { x: Math.floor(g.walker.x), y: Math.floor(g.walker.y), lift: Math.round(g.heroLift) }; })()`);
  };
  const up = await walk([9.5, 12.5], [9, 17]);
  check('up the stairs onto the quay', up.x === 9 && up.y === 17 && up.lift === 6 * S, JSON.stringify(up));
  const cliff = await walk([6.5, 3.5], [4, 3], 2500);
  check('not up the cliff (twelve steps)', cliff.lift === 0 && cliff.x >= 6, JSON.stringify(cliff));
  const off = await walk([3.5, 3.5], [3, 8], 5000);
  check('off the plateau\'s edge: down on the ground below', off.x === 3 && off.y === 8 && off.lift === 0, JSON.stringify(off));
  const tp = await J(page, `(() => { const g = window.__teul.game; g.debugTeleport(2.5, 2.5); return Math.round(g.heroLift); })()`);
  check('a jump of the tests onto the plateau: standing on it', tp === 12 * S, String(tp));

  check('the page shows no errors', page.errors().length === 0, JSON.stringify(page.errors().slice(0, 3)));
}, { width: 1280, height: 800 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
