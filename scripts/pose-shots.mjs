// Screenshots of the hero sitting / lying on things, for checking poses. Usage: node scripts/pose-shots.mjs OUTDIR [BASE]
import { withFirefox } from './bidi.mjs';
const out = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:4176/';
const cases = JSON.parse(process.env.CASES ?? '[]');
await withFirefox(async (page) => {
  await page.goto(`${base}?debug&skip`);
  await page.sleep(2500);
  for (const c of cases) {
    const r = await page.eval(`(() => {
      const g = window.__teul.game;
      g.seat = null;
      ${c.setup ?? ''}
      const p = g.room.placements.find((q) => ${c.find});
      if (!p) return 'missing';
      const def = g.engine.catalog.items[p.item];
      g.debugTeleport(${c.at ? c.at : 'p.x - 0.5, p.y + 0.5'});
      for (let i = 0; i < 4 && g.view !== ${c.view ?? 0}; i++) g.rotateView(1);
      g.doUse(p.pid, '${c.action ?? 'sit'}');
      return JSON.stringify([p.item, p.x, p.y, p.rot, g.seat]);
    })()`);
    await page.sleep(1800);
    const at = await page.eval(`(() => { const g = window.__teul.game; const s = g.seat ?? g.walker; const c = document.getElementById('scene'); const r = c.getBoundingClientRect(); const p = g.renderer.toScreen(s.x, s.y, 0); return JSON.stringify([p.x + r.left, p.y + r.top]); })()`);
    await page.shot(`${out}/${c.name}.png`);
    console.log(c.name, r, at);
  }
  for (const e of page.errors()) console.log(`[${e.level}] ${e.text}`);
}, { width: 844, height: 390 });
