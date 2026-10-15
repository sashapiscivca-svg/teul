// Where the time goes: the hero walks about the busiest places (the town at midday and in the evening, the
// forest, a full café) while every frame is timed section by section (?perf, test builds only); prints the average
// and the worst frame of each section, and the midnight turn of the day. A probe, not a pass/fail suite, except
// for the budgets at the end.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/perf.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const out = {};
const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
const minutesTo = (page, hour) => page.eval(`(() => { const now = window.__teul.game.now(); const m = now % 1440; return (${hour} * 60 - m + 1440) % 1440; })()`);

async function measure(page, name, where, seconds = 8) {
  await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 900));
    ${where}
    await new Promise((r) => setTimeout(r, 1500));
    g.perf.reset();
    g.renderer.profiling = true;
    for (const k of Object.keys(g.renderer.prof)) delete g.renderer.prof[k];
    // walk in a slow square so the camera and everyone move
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    for (let i = 0; i < ${seconds}; i++) {
      const k = keys[i % 4];
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k }));
      await new Promise((r) => setTimeout(r, 1000));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k }));
    }
  })()`);
  out[name] = JSON.parse(await page.eval('(() => { const g = window.__teul.game; const n = Math.max(1, g.perf.frames); const scene = Object.fromEntries(Object.entries(g.renderer.prof).map(([k, v]) => [k, +(v / n).toFixed(2)])); return JSON.stringify({ frames: g.perf.frames, ...g.perf.report(), scene, npcs: g.resPoses?.size ?? 0 }); })()'));
  console.log(name, JSON.stringify(out[name]));
}

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&perf`);
  await ready(page);
  const noon = await minutesTo(page, 12);
  await page.goto(`${BASE}?debug&skip&perf&shift=${noon}`);
  await ready(page);
  await measure(page, 'town-noon', 'g.debugTeleport(44.5, 26.5);');
  await measure(page, 'cafe', "g.enterLocation('cafe_in', [5, 7]);");
  await measure(page, 'forest', "g.enterLocation('forest', [44, 90]);");
  const eve = await minutesTo(page, 19);
  await page.goto(`${BASE}?debug&skip&perf&shift=${noon + eve}`);
  await ready(page);
  await measure(page, 'town-evening', 'g.debugTeleport(44.5, 26.5);');
  // the turn of the day: how long the first frame after midnight takes
  const mid = await page.eval(`(async () => {
    const g = window.__teul.game;
    const t0 = performance.now();
    g.engine.life(g.now() - (g.now() % 1440) + 1440 + 2);
    g.engine.townDay?.(g.now() - (g.now() % 1440) + 1440 + 2);
    return performance.now() - t0;
  })()`);
  out.midnight_ms = mid;
  console.log('midnight life recompute ms', mid);
});
console.log(JSON.stringify(out));
