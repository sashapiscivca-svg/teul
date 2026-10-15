// The home, walked through like a person would: every thing and every option it has, the editor (place, turn,
// put away, undo), the builders (order, the site, the keys, the new room), the animals (the turtle from the
// shelter, the fox from the forest, the robot, the dragon's egg) and the night.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/home.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS ?? '/tmp/shots';
const nowLocal = new Date();
const SHIFT = (((12 * 60 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

await withFirefox(async (page) => {
  const ev = (js) => page.eval(js);
  const closePaper = async () => {
    await ev("(() => { for (const el of document.querySelectorAll('.paper, .settings')) if (el.style.display === '') { const x = el.querySelector('.paper-close, .ph .round'); if (x) x.click(); } })()");
    await page.sleep(300);
  };
  const state = async () => JSON.parse(await ev('JSON.stringify(window.__teul.game.debugState())'));
  await page.goto(`${BASE}?debug&rich&shift=${SHIFT}`);
  for (let i = 0; i < 80 && !(await ev("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await ev(`(() => { window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message))); const ce = console.error; console.error = (...a) => { window.__errs.push(a.map(String).join(' ')); ce(...a); }; })()`);
  await ev("document.querySelector('.title-screen .screen-go').click()");
  for (let i = 0; i < 40 && !(await ev("!!document.querySelector('.hero-go')")); i++) await page.sleep(250);
  await ev("document.querySelector('.hero-go').click()");
  await page.sleep(1800);
  await ev("document.querySelector('.paper-close')?.click()");
  await page.sleep(300);

  // ---- every thing at home, every option: reachable, nothing throws
  const walk = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { items: 0, options: 0, bad: [] };
    const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent);
    const close = () => { for (const el of document.querySelectorAll('.settings')) if (el.style.display === '') { const x = el.querySelector('.ph .round, .paper-close'); if (x) x.click(); else el.style.display = 'none'; } };
    for (const p of g.debugState().placements) {
      out.items++;
      for (const o of g.optionsFor(p.pid)) {
        if (o === 'enter' || o === 'rift') continue;
        out.options++;
        g.seat = null; g.performing = null; g.path = null;
        const before = toasts().length;
        try { g.use(p.pid, o); } catch (e) { out.bad.push(p.item + ':' + o + ' threw ' + e.message); continue; }
        for (let i = 0; i < 40 && g.path && g.path.length; i++) await sleep(120);
        await sleep(200);
        const t = toasts().slice(before).join(' | ');
        if (/не пройти/.test(t)) out.bad.push(p.item + '@' + p.x + ',' + p.y + ':' + o + ' ' + t);
        close();
      }
    }
    out.reach = g.debugReachable();
    return JSON.stringify(out);
  })()`));
  check('every thing at home can be used: walked to, its options run', walk.bad.length === 0 && walk.options > 40, JSON.stringify(walk.bad.slice(0, 6)));
  check('every room of the house can be walked into', Object.values(walk.reach).every(Boolean), JSON.stringify(walk.reach));
  check('nothing at home throws an error', (await ev('window.__errs.length')) === 0, await ev('JSON.stringify(window.__errs.slice(0, 5))'));

  // ---- the editor: place a thing, turn it, put it away, undo
  const editor = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.run({ type: 'acquire', item: 'pet_bowl' });
    g.enterEdit();
    const n0 = g.debugState().placements.length;
    g.pickFromInventory('pet_bowl');
    const grid = g.debugReachable && g.room;
    // a free cell in the living room
    const blocked = new Set(g.room.placements.flatMap((p) => [p.x + ',' + p.y]));
    let spot = null;
    for (let y = 2; y < 9 && !spot; y++) for (let x = 2; x < 9 && !spot; x++) if (g.engine.can({ type: 'place', item: 'pet_bowl', x, y, rot: 0, wall: null, on: null }, g.now()).ok) spot = [x, y];
    const r = g.placeItem({ type: 'place', item: 'pet_bowl', x: spot[0], y: spot[1], rot: 0, wall: null, on: null });
    await sleep(100);
    const placed = g.debugState().placements.find((p) => p.item === 'pet_bowl');
    g.held = null;
    g.selectedPid = placed.pid;
    g.rotate();
    await sleep(100);
    const rot = g.debugState().placements.find((p) => p.pid === placed.pid)?.rot;
    g.storeSelected();
    const gone = !g.debugState().placements.some((p) => p.item === 'pet_bowl');
    g.history.undo();
    await sleep(100);
    const back = g.debugState().placements.some((p) => p.item === 'pet_bowl');
    g.exitEdit();
    return JSON.stringify({ ok: r.ok, n0, rot, gone, back, toasts: document.querySelectorAll('.toast').length });
  })()`));
  check('the editor places a thing from the inventory', editor.ok, JSON.stringify(editor));
  check('the editor turns it, puts it away, and undo brings it back', editor.rot === 1 && editor.gone && editor.back, JSON.stringify(editor));

  // ---- the builders: an order at the utility office, the site by the house, the keys days later
  const order = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const loc = g.engine.catalog.locations.utility_in;
    g.enterLocation('utility_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
    await sleep(600);
    const counter = g.room.placements.find((p) => p.item === 'bill_counter');
    const opts = g.optionsFor(counter.pid);
    g.doUse(counter.pid, 'builders');
    await sleep(200);
    const sheet = document.querySelector('.builders')?.style.display === '';
    const offers = document.querySelectorAll('.builders .recipe').length;
    const coins = g.wallet.coins;
    const took = g.orderBuild(g.engine.builds(g.now()).offers.find((o) => o.id === 'build.music'));
    await sleep(200);
    return JSON.stringify({ opts, sheet, offers, took, paid: coins - g.wallet.coins });
  })()`));
  check('the utility office counter has the builders', order.opts.includes('builders'), JSON.stringify(order.opts));
  check('the builders show what they build', order.sheet && order.offers >= 8, JSON.stringify(order));
  check('a room is ordered and paid for', order.took && order.paid === 900, JSON.stringify(order));
  const site = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.debugGo('home');
    await sleep(800);
    g.debugOffset += 1440;
    g.refresh();
    await sleep(300);
    const o = g.engine.builds(g.now()).orders[0];
    const cells = new Set(g.room.cells.map(([x, y]) => x + ',' + y));
    const fenced = cells.has((o.x + 1) + ',' + (o.y + 1));
    const reach = g.reachable([o.x + 1, o.y + 1]);
    // look at it: the arrows take one into the site
    const r = g.regions();
    const id = r.of.get((o.x + 1) + ',' + (o.y + 1));
    const reg = r.list[id];
    g.walker.x = o.x + 1.5; g.walker.y = o.y + 2.5;
    await sleep(500);
    const shown = g.shownRoom();
    const props = shown.placements.filter((p) => p.pid <= -70000).map((p) => p.item);
    return JSON.stringify({ fenced, reach, stage: o.stage, name: g.regionName(id), props });
  })()`));
  check('the site is fenced off next to the house, closed from it', site.fenced && !site.reach, JSON.stringify(site));
  check('the site shows its work: scaffolding, bricks', site.props.length >= 3, JSON.stringify(site));
  await closePaper();
  await page.sleep(400);
  await page.shot(`${SHOTS}/home-extension-building.png`);
  const done = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.debugTeleport(3.5, 4.5);
    g.debugOffset += 4 * 1440;
    g.refresh();
    await sleep(500);
    const o = g.engine.builds(g.now()).orders[0];
    const reach = g.reachable([o.x + 1, o.y + 1]);
    const inside = g.debugState().placements.filter((p) => p.x >= o.x && p.y >= o.y && p.x < o.x + o.w && p.y < o.y + o.d).map((p) => p.item);
    return JSON.stringify({ done: o.done, reach, inside, rooms: Object.keys(g.debugReachable()), allReach: Object.values(g.debugReachable()).every(Boolean) });
  })()`));
  check('the keys are handed over when the work is done', done.done, JSON.stringify(done));
  check('the new room opens into the house and is furnished', done.reach && done.inside.includes('piano'), JSON.stringify(done));
  check('every room still can be walked into', done.allReach, JSON.stringify(done.rooms));
  await ev(`(() => { const g = window.__teul.game; const o = g.engine.builds(g.now()).orders[0]; g.walker.x = o.x + 2.5; g.walker.y = o.y + 3.5; })()`);
  await closePaper();
  await page.sleep(700);
  await page.shot(`${SHOTS}/home-new-room.png`);

  // ---- the animals: a turtle from the shelter, fed and played with
  const turtle = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const loc = g.engine.catalog.locations.vet_in;
    g.enterLocation('vet_in', loc.entry ?? [loc.exits[0].x, loc.exits[0].y]);
    await sleep(600);
    const desk = g.room.placements.find((p) => p.item === 'reception_desk');
    const opts = g.optionsFor(desk.pid);
    g.doUse(desk.pid, 'pets');
    await sleep(200);
    const offered = [...document.querySelectorAll('.pets .recipe b')].map((b) => b.textContent);
    g.adopt({ id: 'turtle', name: 'Черепаха', kind: 4, price: 80, text: '', step: 'adopt' });
    g.useStation('st.vet.pet_food');
    await sleep(200);
    g.debugGo('home');
    await sleep(800);
    g.petCare('turtle', 'feed');
    g.petCare('turtle', 'play');
    const v = g.engine.pets(g.now());
    return JSON.stringify({ opts, offered, owned: v.owned.map((p) => p.id + ':' + p.words), house: g.housePets.map((p) => p.id) });
  })()`));
  check('the vet has a shelter', turtle.opts.includes('pets') && turtle.offered.includes('Черепаха'), JSON.stringify(turtle));
  check('the turtle comes home and is cared for, said in words', turtle.owned.some((s) => s.startsWith('turtle:')) && turtle.house.includes('turtle'), JSON.stringify(turtle));

  // the fox: food left three days, then it follows
  const fox = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const steps = [];
    for (let d = 0; d < 4; d++) {
      const vet = g.engine.catalog.locations.vet_in;
      g.enterLocation('vet_in', vet.entry ?? [vet.exits[0].x, vet.exits[0].y]);
      await sleep(300);
      g.useStation('st.vet.pet_food');
      const f = g.engine.catalog.locations.forest;
      g.enterLocation('forest', f.entry ?? [f.exits[0].x, f.exits[0].y]);
      await sleep(400);
      const den = g.room.placements.find((p) => p.item === 'fox_den');
      steps.push(g.engine.pets(g.now()).here.find((o) => o.id === 'fox')?.step);
      g.adopt(g.engine.pets(g.now()).here.find((o) => o.id === 'fox'));
      g.debugOffset += 1440;
      g.refresh();
    }
    return JSON.stringify({ steps, owned: g.engine.pets(g.now()).owned.map((p) => p.id) });
  })()`));
  check('the fox learns to trust: food on three days, then it comes along', fox.steps.slice(0, 3).every((s) => s === 'feed_fox') && fox.steps[3] === 'adopt' && fox.owned.includes('fox'), JSON.stringify(fox));

  // the robot from the counter (once the laptops have come) and the dragon from an egg
  const more = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.debugOffset += 50 * 1440;
    g.refresh();
    const post = g.engine.catalog.locations.post_in;
    g.enterLocation('post_in', post.entry ?? [post.exits[0].x, post.exits[0].y]);
    await sleep(500);
    const shelf = g.room.placements.find((p) => p.item === 'parcel_shelf');
    const opts = g.optionsFor(shelf.pid);
    g.adopt(g.engine.pets(g.now()).here.find((o) => o.id === 'robot'));
    g.debugGo('home');
    await sleep(800);
    g.petCare('robot', 'charge');
    return JSON.stringify({ opts, owned: g.engine.pets(g.now()).owned.map((p) => p.id) });
  })()`));
  check('the counter «Техніка» has a robot once laptops have come', more.opts.includes('pets') && more.owned.includes('robot'), JSON.stringify(more));

  // the companion: the fox goes out walking, the town notices
  const walkies = JSON.parse(await ev(`(async () => {
    const g = window.__teul.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.setCompanion('fox');
    await sleep(200);
    const look = g.petLook.kind;
    const homeKinds = g.housePets.map((p) => p.look.kind).sort();
    return JSON.stringify({ look, homeKinds });
  })()`));
  check('the fox walks with the player; the others and the first cat stay at home', walkies.look === 5 && walkies.homeKinds.includes(4) && walkies.homeKinds.includes(6), JSON.stringify(walkies));
  // the pet family in one room for a picture
  await ev(`(() => {
    const g = window.__teul.game;
    g.debugTeleport(4.5, 4.5);
    const spots = [[2.5, 6.5], [6.5, 6.5], [5.5, 2.5], [3.2, 3.5]];
    g.housePets.forEach((p, i) => { const [x, y] = spots[i % spots.length]; p.x = x; p.y = y; p.path = []; p.until = g.time + 30; p.doing = i % 2 ? 'play' : 'idle'; });
    g.pet.x = 5.5; g.pet.y = 5.5;
  })()`);
  await closePaper();
  await page.sleep(900);
  await page.shot(`${SHOTS}/home-pet-family.png`);

  // ---- pictures of the home (screenshots for the report)
  const clean = () => ev("(() => { window.__teul.game.toasts.clear(); for (const el of document.querySelectorAll('.paper, .settings')) if (el.style.display === '') { const x = el.querySelector('.paper-close, .ph .round'); if (x) x.click(); } })()");
  // each animal close up, beside the hero in the living room (the dragon only drawn: its egg comes from a rift)
  for (const [kind, name] of [[4, 'turtle'], [5, 'fox'], [6, 'robot'], [7, 'dragon']]) {
    await ev(`(() => {
      const g = window.__teul.game;
      g.debugTeleport(5.5, 7.5);
      g.seat = null;
      g.dir = 'right';
      const away = g.regions().list.find((r, i) => i !== g.regionAt(5.5, 7.5)).cells[0];
      const hp = g.housePets.find((p) => p.look.kind === ${kind}) ?? (() => { const p = { id: 'shot', look: { kind: ${kind}, fur: '#3fae7a', pattern: 0 }, x: 0, y: 0, dir: 'right', pose: 'sit', doing: 'idle', until: 0, path: [], carry: false }; g.housePets.push(p); return p; })();
      for (const p of g.housePets) if (p !== hp) { p.x = away[0] + 0.5; p.y = away[1] + 0.5; p.until = g.time + 60; p.path = []; }
      const spot = [6.7, 7.3];
      if (g.petLook.kind === ${kind}) { g.pet.x = spot[0]; g.pet.y = spot[1]; }
      else { g.pet.x = away[0] + 0.5; g.pet.y = away[1] + 0.5; hp.x = spot[0]; hp.y = spot[1]; hp.path = []; hp.until = g.time + 60; hp.doing = ${kind} === 6 ? 'eat' : ${kind} === 7 ? 'idle' : 'play'; }
    })()`);
    await ev("(() => { const g = window.__teul.game; g.zoom = 3; g.pan = { x: 0, y: 0 }; })()");
    await page.sleep(300);
    await ev("(() => { const g = window.__teul.game; const c = document.getElementById('scene').getBoundingClientRect(); const at = g.renderer.toScreen(6.1, 7.4, 10); g.pan = { x: c.width / 2 - at.x, y: c.height / 2 - at.y }; })()");
    await clean();
    await page.sleep(900);
    await page.shot(`${SHOTS}/home-pet-${name}.png`);
  }
  await ev("(() => { const g = window.__teul.game; g.housePets = g.housePets.filter((p) => p.id !== 'shot'); g.zoom = 1; g.pan = { x: 0, y: 0 }; })()");
  // the room by day and by night
  await ev("(() => { const g = window.__teul.game; g.zoom = 1; g.debugTeleport(5.5, 6.5); g.pet.x = 6.5; g.pet.y = 6.5; })()");
  await clean();
  await page.sleep(800);
  await page.shot(`${SHOTS}/home-room-day.png`);
  await ev('window.__teul.game.debug.minuteOfDay = 22 * 60 + 30');
  await clean();
  await page.sleep(900);
  await page.shot(`${SHOTS}/home-room-night.png`);
  await ev('window.__teul.game.debug.minuteOfDay = undefined');
  // the editor: a thing held over the floor (its ghost green where it fits), then the whole house at once
  await ev(`(() => {
    const g = window.__teul.game;
    g.run({ type: 'acquire', item: 'armchair' });
    g.enterEdit();
    g.pickFromInventory('armchair');
    const at = g.debugCellScreen(6, 7);
    g.hover = g.renderer.pick(at.x, at.y);
  })()`);
  await clean();
  await page.sleep(700);
  await page.shot(`${SHOTS}/home-build-mode.png`);
  await ev("(() => { const g = window.__teul.game; g.held = null; g.hover = null; g.viewRegion = -1; g.zoom = 0.6; g.pushEdit(); })()");
  await clean();
  await page.sleep(800);
  check('the editor shows the whole house at once', (await ev("document.querySelector('.room-bar, .hud-room')?.textContent ?? ''")).includes('Увесь дім') || (await ev('window.__teul.game.shownRoom().cells.length')) === (await ev('window.__teul.game.room.cells.length')));
  await page.shot(`${SHOTS}/home-whole-house.png`);
  await ev('window.__teul.game.exitEdit(); window.__teul.game.zoom = 1');

  check('no errors through it all', (await ev('window.__errs.length')) === 0, await ev('JSON.stringify(window.__errs.slice(0, 5))'));
});

console.log(failed ? `${failed} FAILED` : 'ALL HOME CHECKS PASSED');
process.exit(failed ? 1 : 0);
