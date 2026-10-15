// The hero cannot walk through a car and a car coming on them moves them aside; whoever one talks to stands still
// for the talk; small things on the ground are walked round or over; a long press on a picture saves nothing.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/solid.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

await withFirefox(async (page) => {
  const noon = new Date();
  const shift = (((12 * 60 - (noon.getHours() * 60 + noon.getMinutes())) % 1440) + 1440) % 1440;
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.debugGo('village'); })()");
  await page.sleep(1500);

  // ---- a parked car in the street: walking at it stops at its side
  const car = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const w = g.walker;
    const at = { x: w.x + 2, y: w.y };
    const o = g.roadMovers.bind(g);
    g.roadMovers = function () { o(); this.movers.push({ item: 'car_red', x: at.x, y: at.y, rot: 0, bob: 0, moving: false, kind: 'car' }); };
    await new Promise((r) => setTimeout(r, 300));
    const inside = () => Math.abs(g.walker.x - at.x) < 1 && Math.abs(g.walker.y - at.y) < 0.5;
    let through = false;
    // screen (0.894, 0.447) is grid +x
    g.keys.vector = () => ({ x: 0.894, y: 0.447 });
    for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 50)); if (inside()) through = true; }
    g.keys.vector = () => ({ x: 0, y: 0 });
    // now the car drives onto the hero standing in the road
    const me = { x: g.walker.x, y: g.walker.y };
    at.x = me.x; at.y = me.y + 0.1;
    g.roadMovers = function () { o(); this.movers.push({ item: 'car_red', x: at.x, y: at.y, rot: 0, bob: 0, moving: true, heading: [1, 0], kind: 'car' }); };
    await new Promise((r) => setTimeout(r, 500));
    const moved = Math.hypot(g.walker.x - me.x, g.walker.y - me.y);
    g.roadMovers = o;
    return JSON.stringify({ through, moved, still: inside() });
  })()`));
  check('one does not walk through a car', !car.through, JSON.stringify(car));
  check('a car coming on someone moves them aside', car.moved > 0.3 && !car.still, JSON.stringify(car));

  // ---- talking to a resident: they stand still while the words are open
  const talk = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    let id = null;
    for (let i = 0; i < 40 && !id; i++) {
      id = [...g.resPoses.entries()].find(([, p]) => p.walking)?.[0] ?? null;
      if (!id) await new Promise((r) => setTimeout(r, 250));
    }
    if (!id) return JSON.stringify({ none: true });
    const p0 = { ...g.resPoses.get(id) };
    g.debugTeleport(p0.x + 1, p0.y);
    g.talkWith = { id, at: g.time, pose: null };
    g.residentSays(id);
    await new Promise((r) => setTimeout(r, 100));
    const a = { ...g.resPoses.get(id) };
    await new Promise((r) => setTimeout(r, 1500));
    const b = { ...g.resPoses.get(id) };
    const open = g.ask.isOpen() || g.dialogue.isOpen();
    return JSON.stringify({ open, moved: Math.hypot(a.x - b.x, a.y - b.y), walking: b.walking });
  })()`));
  check('whoever one talks to stands still while the talk is open', talk.none || (talk.moved < 0.01 && !talk.walking), JSON.stringify(talk));
  await page.eval('(() => { const g = window.__teul.game; g.ask.close(); g.dialogue.close?.(); })()');

  // ---- every building's door: the same «Увійти» button, a mark at the door, no boards over the roofs
  const door = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    const out = [];
    for (const id of ['flowers', 'grocery', 'bakery', 'cafe']) {
      const site = (window.__teul.engine.catalog.locations.village.sites ?? []).find((s) => s.id === id || s.kind === id);
      if (!site) continue;
      g.debugGo('village');
      await new Promise((r) => setTimeout(r, 800));
      g.debugTeleport(site.x + 0.5, site.y + 0.5);
      await new Promise((r) => setTimeout(r, 500));
      const label = document.querySelector('.action .label')?.textContent ?? '';
      const marks = document.querySelectorAll('.door-mark').length;
      const signs = document.querySelectorAll('.shop-sign').length;
      document.querySelector('.action').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      document.querySelector('.action').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      document.querySelector('.action').click();
      await new Promise((r) => setTimeout(r, 900));
      out.push({ id: site.id, label, marks, signs, inside: !!g.village?.def.inside });
    }
    return JSON.stringify(out);
  })()`));
  check('at each shop door the button says «Увійти»', door.length >= 2 && door.every((d) => d.label === 'Увійти'), JSON.stringify(door));
  check('and it takes one in', door.every((d) => d.inside), JSON.stringify(door));
  check('a mark at the doors, no boards over the roofs', door.every((d) => d.marks > 0 && d.signs === 0), JSON.stringify(door));

  // ---- a long press or a right click on the world's picture offers nothing
  const guard = await page.eval(`(() => {
    const c = document.querySelector('canvas');
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    c.dispatchEvent(e);
    const d = new Event('dragstart', { bubbles: true, cancelable: true });
    c.dispatchEvent(d);
    return e.defaultPrevented && d.defaultPrevented;
  })()`);
  check('no "save image" on the pictures of the world', guard === true);

  const errs = page.errors().filter((e) => !/WebSocket|wss:/.test(e.text));
  check('no errors in the console', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
});

console.log(failed ? `${failed} FAILED` : 'ALL SOLID CHECKS PASSED');
process.exit(failed ? 1 : 0);
