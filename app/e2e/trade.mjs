// What is carried can leave the pocket, end to end: thrown away (a second tap to be sure), given to someone standing
// near, sold at the market's second-hand buyer at the prices it shows; a thing of the home
// that stands nowhere sells second-hand from the inventory; and a garden gate taken off the fence between the garden
// and the vegetable plot goes back on it (an edge inside the home is pointed at by the floor beside it).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/trade.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

// eleven in the morning (the market's hours), whatever the time the test runs
const now = new Date();
const toEleven = (24 * 60 - (now.getHours() * 60 + now.getMinutes()) + 11 * 60) % (24 * 60) || 24 * 60;

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&rich&world=trade${Date.now() % 100000}&device=touch&shift=${toEleven}`);
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
  const ev = (js) => page.eval(js);
  const pocket = async () => JSON.parse(await ev('JSON.stringify(window.__teul.engine.pocket().items)'));

  // something in the pocket: buns from the bakery stall (in the village)
  const setup = JSON.parse(await ev(`(() => {
    const g = window.__teul.game, e = window.__teul.engine;
    g.debugGo('village');
    const st = Object.values(e.catalog.stations).find((s) => s.id === 'st.market.buyer');
    const stall = g.room.placements.find((p) => p.item === st.prop);
    g.debugTeleport(stall.x + 0.5, stall.y + 1.5);
    // carrots from the vegetable stall: two at a time, twice
    const a = e.command({ type: 'use', station: 'st.stall_veg.carrot' }, g.now());
    const b = e.command({ type: 'use', station: 'st.stall_veg.carrot' }, g.now());
    g.refresh();
    return JSON.stringify({ ok: !!stall && a.ok && b.ok, carry: ['carrot'], why: [a.ok || a.error, b.ok || b.error] });
  })()`));
  check('the buyer stands at the market', setup.ok, JSON.stringify(setup));
  const before = await pocket();
  check('four carrots in the pocket', before.carrot === 4, JSON.stringify(before));

  // ---- thrown away: the first tap asks, the second throws
  await ev(`window.__teul.game.openPocket()`);
  await page.sleep(200);
  // a click on the carrots takes them up; what can be done with them shows below
  await ev(`document.querySelector('.pocket .mc-main [data-item="carrot"]').click()`);
  await page.sleep(150);
  await ev(`document.querySelector('.pocket [data-throw]').click()`);
  await page.sleep(150);
  check('the first tap asks to be sure', /Точно/.test(await ev(`document.querySelector('.pocket [data-throw]').textContent`)) && (await pocket()).carrot === 4);
  await ev(`document.querySelector('.pocket [data-throw]').click()`);
  await page.sleep(300);
  check('the second throws one away', (await pocket()).carrot === 3, JSON.stringify(await pocket()));

  // ---- given: the list says who is near
  await ev(`document.querySelector('.pocket [data-give]').click()`);
  await page.sleep(200);
  check('giving asks whom to', /Кому подарувати/.test(await ev(`document.querySelector('.pocket .pocket-body').textContent`)));
  await ev(`[...document.querySelectorAll('.pocket .pocket-body button')].find((b) => /Назад/.test(b.textContent)).click()`);
  await page.sleep(150);
  // someone of the town put right beside the hero, then given a carrot
  const gave = JSON.parse(await ev(`(() => {
    const g = window.__teul.game;
    const id = [...g.resPoses.keys()][0];
    if (!id) return JSON.stringify({ id: null });
    const p = g.resPoses.get(id);
    g.debugTeleport(p.x + 0.6, p.y);
    const who = g.giftRecipients().find((r) => r.id === id);
    if (who) g.giveFromPocket('${setup.carry[0]}', who);
    return JSON.stringify({ id, listed: !!who });
  })()`));
  await page.sleep(400);
  check('someone standing near is among whom to give to', gave.listed, JSON.stringify(gave));
  check('and the gift leaves the pocket', (await pocket()).carrot === 2, JSON.stringify(await pocket()));

  // ---- sold at the buyer: its prices on the pocket, coins in
  await ev(`(() => { const g = window.__teul.game; const st = window.__teul.engine.catalog.stations['st.market.buyer']; const stall = g.room.placements.find((p) => p.item === st.prop); g.debugTeleport(stall.x + 0.5, stall.y + 1.5); g.useStation('st.market.buyer'); })()`);
  await page.sleep(300);
  const shown = await ev(`(() => { const b = document.querySelector('.pocket [data-sell]'); return b ? b.textContent : ''; })()`);
  check('the pocket opens at the buyer with a price', /Продати · \d+/.test(shown), shown);
  const coins0 = await ev('window.__teul.engine.wallet().coins');
  await ev(`document.querySelector('.pocket [data-sell]').click()`);
  await page.sleep(300);
  const coins1 = await ev('window.__teul.engine.wallet().coins');
  check('selling pays the price shown', coins1 - coins0 === Number(shown.match(/\d+/)[0]), `${coins0} -> ${coins1}`);
  check('and one carrot is gone', (await pocket()).carrot === 1, JSON.stringify(await pocket()));
  await ev('window.__teul.game.pocketSheet.close()');

  // ---- the inventory: a lamp bought and not set out sells second-hand
  const sold = JSON.parse(await ev(`(() => {
    const g = window.__teul.game, e = window.__teul.engine;
    g.debugGo('home');
    const def = Object.values(e.catalog.items).find((d) => !d.hidden && !d.carry && d.acquire && d.acquire.coins >= 20 && d.layer === 'floor');
    e.command({ type: 'acquire', item: def.id }, g.now());
    g.refresh();
    return JSON.stringify({ item: def.id, price: def.acquire.coins });
  })()`));
  await ev(`(() => { const g = window.__teul.game; g.enterEdit(); g.shop.open('inventory'); })()`);
  await page.sleep(300);
  await ev(`window.__teul.game.shop.select({ kind: 'item', id: '${sold.item}' })`);
  await page.sleep(200);
  const label = await ev(`(() => { const b = document.querySelector('.sell-back'); return b ? b.textContent : ''; })()`);
  check('the inventory offers to sell it second-hand for less', new RegExp(String(Math.floor(sold.price * 0.4))).test(label), `${label} (${sold.price})`);
  const c0 = await ev('window.__teul.engine.wallet().coins');
  await ev(`document.querySelector('.sell-back').click()`);
  await page.sleep(300);
  check('selling it pays 40% and it leaves the inventory', (await ev('window.__teul.engine.wallet().coins')) - c0 === Math.floor(sold.price * 0.4) && !(await ev(`window.__teul.engine.inventory().find((i) => i.item === '${sold.item}')?.free`)));
  await ev('window.__teul.game.exitEdit()');

  // ---- the garden gate goes back between the garden and the plot
  const gate = JSON.parse(await ev(`(() => {
    const g = window.__teul.game, e = window.__teul.engine;
    g.addRoom('garden', 6, 6); g.refresh(); g.addRoom('farm', 6, 6); g.refresh();
    const gates = g.room.placements.filter((p) => p.item === 'garden_gate');
    const gt = gates[gates.length - 1];
    e.command({ type: 'store', pid: gt.pid }, g.now()); g.refresh();
    g.enterEdit();
    g.held = { item: 'garden_gate', rot: 0 };
    // the floor just beside that edge, on the screen
    const [dx, dy] = gt.wall === 'east' ? [0.9, 0.5] : gt.wall === 'west' ? [0.1, 0.5] : gt.wall === 'south' ? [0.5, 0.9] : [0.5, 0.1];
    const s = g.renderer.toScreen(gt.x + dx, gt.y + dy, 0);
    const pick = g.editPick(s.x, s.y);
    return JSON.stringify({ gt: [gt.x, gt.y, gt.wall], pick });
  })()`));
  const pk = gate.pick;
  check('beside the fence between the garden and the plot the gate points at that edge', pk && pk.kind === 'wall', JSON.stringify(gate));
  const placed = await ev(`(() => { const g = window.__teul.game, e = window.__teul.engine; const p = ${JSON.stringify(pk)}; const r = e.command({ type: 'place', item: 'garden_gate', x: p.x, y: p.y, rot: 0, wall: p.side, on: null }, g.now()); g.held = null; g.exitEdit(); return r.ok; })()`);
  check('and it is set back on it', placed);

  // ---- copying a door costs a door: nothing in the catalogue is free to take without end
  const dup = JSON.parse(await ev(`(() => {
    const g = window.__teul.game, e = window.__teul.engine;
    g.enterEdit();
    const door = g.room.placements.find((p) => p.item === 'door_basic');
    const free = () => e.inventory().find((i) => i.item === 'door_basic')?.free ?? 0;
    const c0 = e.wallet().coins;
    g.selectedPid = door.pid;
    g.duplicateSelected();
    g.held = null;
    const c1 = e.wallet().coins;
    g.exitEdit();
    return JSON.stringify({ paid: c0 - c1, price: e.catalog.items.door_basic.acquire.coins, free: free() });
  })()`));
  check('a copied door is bought at its price', dup.paid === dup.price && dup.price > 0, JSON.stringify(dup));
}, { width: 900, height: 600 });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
