// A new world: the neighbour's letter waits on the first morning; following it brings the next one; the paper map
// opens from the menu, draws the way to a place and leaves an arrow in the world.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/onboard.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.sleep(200);
  await page.shot(`${SHOTS}/${name}.png`);
};

await withFirefox(async (page) => {
  const noon = 0;
  await page.goto(`${BASE}?world=onb${Date.now() % 100000}&debug&letters&skip&device=touch&shift=${noon}`);
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.eval("(() => { window.__teul.game.paperSheet?.close(); })()");
  for (let i = 0; i < 30 && !(await page.eval("document.querySelector('.letter')?.style.display === ''")); i++) await page.sleep(300);
  const first = await page.eval("document.querySelector('.letter-title')?.textContent ?? ''");
  check('on the first morning a letter from the neighbour is there', first === 'Лист на столі', first);
  await shot(page, 'onboard-letter');
  check('it tells how to walk and how to get out of the house', /Двері/.test(await page.eval("document.querySelector('.letter')?.textContent ?? ''")));
  await page.eval("document.querySelector('.letter-fold').click()");
  // following it: out through the house's own door, with the button
  const out = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game, c = window.__teul.engine.catalog;
    const door = g.room.placements.find((p) => c.items[p.item]?.tags.includes('door'));
    if (!door) return JSON.stringify({ none: true });
    const [dx, dy] = door.wall === 'west' ? [0.6, 0.5] : door.wall === 'east' ? [0.4, 0.5] : door.wall === 'north' ? [0.5, 0.6] : [0.5, 0.4];
    g.debugTeleport(door.x + dx, door.y + dy);
    await new Promise((r) => setTimeout(r, 500));
    const label = document.querySelector('.action .label')?.textContent ?? '';
    document.querySelector('.action').click();
    for (let i = 0; i < 20 && g.location === 'home'; i++) await new Promise((r) => setTimeout(r, 250));
    // (the morning paper opens outside; the letter waits until it is put away)
    const title = () => (document.querySelector('.letter')?.style.display === '' ? document.querySelector('.letter-title')?.textContent ?? '' : '');
    for (let i = 0; i < 30 && title() !== 'Лист про дошку'; i++) {
      g.paperSheet?.close();
      g.ask?.close();
      if (title()) document.querySelector('.letter-fold')?.click();
      await new Promise((r) => setTimeout(r, 400));
    }
    return JSON.stringify({ label, loc: g.location, letter: document.querySelector('.letter-title')?.textContent ?? '' });
  })()`));
  check('at the door the button says «Двері» and takes one outside', out.label === 'Двері' && out.loc !== 'home', JSON.stringify(out));
  check('outside, the next letter comes', out.letter === 'Лист про дошку', JSON.stringify(out));
  await page.eval("document.querySelector('.letter-fold')?.click()");
  // then the notice board by the market
  const next = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    g.run({ type: 'use', station: 'st.notice_board.read' });
    await new Promise((r) => setTimeout(r, 400));
    g.ask?.close();
    g.paperSheet?.close();
    for (let i = 0; i < 20 && document.querySelector('.letter')?.style.display !== ''; i++) await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('.letter-title')?.textContent ?? '';
  })()`);
  check('done as asked, the next letter comes', next === 'Лист про ринок', next);
  await page.eval("document.querySelector('.letter-fold')?.click()");

  // the paper map: open from the menu, a place picked, the way drawn, the arrow in the world
  const map = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    document.querySelector('.hud-map').click();
    await new Promise((r) => setTimeout(r, 600));
    const open = g.paperMap.isOpen();
    const cafe = g.paperMap.places.find((p) => p.site === 'cafe_site');
    const routed = cafe ? g.paperMap.routeTo(cafe) : false;
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify({ open, routed, guide: !!g.guide });
  })()`));
  check('the paper map opens from the menu and draws the way', map.open && map.routed && map.guide, JSON.stringify(map));
  await shot(page, 'onboard-papermap');
  const arrow = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.paperMap.close();
    await new Promise((r) => setTimeout(r, 500));
    return document.querySelector('.world-guide')?.style.display === '';
  })()`);
  check('in the world an arrow points the way', arrow);
  await shot(page, 'onboard-guide');
  const gone = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugTeleport(g.guide.x + 0.5, g.guide.y + 0.5);
    await new Promise((r) => setTimeout(r, 600));
    return !g.guide && document.querySelector('.world-guide')?.style.display === 'none';
  })()`);
  check('on arrival the arrow goes', gone);
});

console.log(failed ? `${failed} FAILED` : 'ALL ONBOARDING CHECKS PASSED');
process.exit(failed ? 1 : 0);
