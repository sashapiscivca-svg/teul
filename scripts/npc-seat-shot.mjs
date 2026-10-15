// Finds townsfolk sitting in the village (or a building) and screenshots them. Usage: node scripts/npc-seat-shot.mjs OUTDIR [BASE]
import { withFirefox } from './bidi.mjs';
const out = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:4176/';
await withFirefox(async (page) => {
  for (const t of ['10:30', '13:00', '17:30']) {
    await page.goto(`${base}?debug&skip&t=${t}`);
    await page.sleep(2500);
    await page.eval(`window.__teul.game.debugGo('village')`);
    await page.sleep(3000);
    const seated = JSON.parse(await page.eval(`JSON.stringify(window.__teul.game.npcsSeated(window.__teul.game.room).filter((n) => n.seat).map((n) => [n.id, n.x, n.y]))`));
    console.log(t, seated.length, JSON.stringify(seated.slice(0, 6)));
    for (const [i, s] of seated.slice(0, 2).entries()) {
      await page.eval(`window.__teul.game.debugTeleport(${s[1] + 3.5}, ${s[2] - 1.5})`);
      await page.sleep(1500);
      const at = await page.eval(`(() => { const g = window.__teul.game; const c = document.getElementById('scene'); const r = c.getBoundingClientRect(); const p = g.renderer.toScreen(${s[1]}, ${s[2]}, 0); return JSON.stringify([p.x + r.left, p.y + r.top]); })()`);
      await page.shot(`${out}/npc_${t.replace(':', '')}_${i}.png`);
      console.log('shot', `npc_${t.replace(':', '')}_${i}`, at);
    }
  }
  for (const e of page.errors()) console.log(`[${e.level}] ${e.text}`);
}, { width: 844, height: 390 });
