// Every kind of seat, bed and bath: the hero walks to it, sits or lies down, and stands up again onto a free cell —
// at home (each one set out in turn, turned every way) and on the town's own benches, pews and chairs. A contact
// sheet of all of them goes to the shots folder.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/seats.mjs [shots-dir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
const nowLocal = new Date();
const SHIFT = (((12 * 60 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}
const TMP = SHOTS ? `${SHOTS}/seats-tmp` : null;
if (TMP) mkdirSync(TMP, { recursive: true });
const sheet = [];

await withFirefox(async (page) => {
  const wait = async (expr, secs = 10) => {
    for (let i = 0; i < secs * 5; i++) {
      if (await page.eval(expr)) return true;
      await page.sleep(200);
    }
    return false;
  };
  const key = (type, code) => page.eval(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', bubbles: true }))`);
  await page.goto(`${BASE}?debug&skip&rich&world=seats&shift=${SHIFT}`);
  await wait('!!(window.__teul && window.__teul.game)', 20);
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");

  /** Sits (or lies) on `pid` with `action`, takes its picture, stands up; returns what happened. */
  const trySeat = async (label, pid, action) => {
    await page.eval(`window.__teul.game.use(${pid}, '${action}')`);
    const sat = await wait(`!!window.__teul.game.seat && window.__teul.game.seat.pid === ${pid}`, 12);
    const info = JSON.parse(await page.eval(`(() => {
      const g = window.__teul.game;
      const s = g.seat;
      if (!s) return JSON.stringify({ sat: false });
      const at = g.renderer.toScreen(s.x, s.y, 30);
      const r = document.getElementById('scene').getBoundingClientRect();
      return JSON.stringify({ sat: true, mode: s.mode, dir: g.dir, x: r.left + at.x, y: r.top + at.y });
    })()`));
    await page.sleep(500);
    if (TMP && sat) {
      const file = `${TMP}/${sheet.length}.png`;
      await page.shot(file);
      sheet.push({ file, label, x: info.x, y: info.y });
    }
    // standing up: a step away, onto a free cell (not into the seat)
    await key('keydown', 'ArrowDown');
    await page.sleep(260);
    await key('keyup', 'ArrowDown');
    await page.sleep(200);
    const up = JSON.parse(await page.eval(`(() => {
      const g = window.__teul.game, e = window.__teul.engine;
      const p = g.room.placements.find((q) => q.pid === ${pid});
      const def = p && e.catalog.items[p.item];
      const w = (p.rot & 1) ? def.footprint.d : def.footprint.w, d = (p.rot & 1) ? def.footprint.w : def.footprint.d;
      const cx = Math.floor(g.walker.x), cy = Math.floor(g.walker.y);
      return JSON.stringify({ seated: !!g.seat, inside: p ? cx >= p.x && cx < p.x + w && cy >= p.y && cy < p.y + d : false });
    })()`));
    return { sat, ...info, up };
  };

  // ---- at home: every seat, bed and bath one can have, each set out in turn and turned a different way
  const items = JSON.parse(await page.eval(`JSON.stringify(Object.values(window.__teul.engine.catalog.items)
    .filter((d) => !d.hidden && d.layer === 'floor' && (d.actions.includes('sit') || d.actions.includes('rest')) && !['fireplace', 'kotatsu'].includes(d.id))
    .map((d) => ({ id: d.id, name: d.name, rest: d.actions.includes('rest'), sit: d.actions.includes('sit') })))`));
  check('the catalog has its seats, beds and baths to try', items.length >= 40, String(items.length));
  let i = 0;
  for (const it of items) {
    const rot = i++ % 4;
    const pid = await page.eval(`(() => {
      const g = window.__teul.game, e = window.__teul.engine;
      g.debugGo('home');
      if (!e.command({ type: 'acquire', item: '${it.id}' }, g.now()).ok) return null;
      const sx = 3, sy = 3;
      for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const p = e.command({ type: 'place', item: '${it.id}', x: sx + dx, y: sy + dy, rot: ${rot}, wall: null, on: null }, g.now());
        if (p.ok) { g.refresh(); return p.events.find((x) => x.kind.type === 'Placed').kind.pid; }
      }
      return null;
    })()`);
    if (pid === null) {
      check(`${it.id} can be set out at home`, false);
      continue;
    }
    const actions = it.sit && it.rest && /sofa|chesterfield|loveseat|futon|window_seat|wicker_sofa/.test(it.id) ? ['sit', 'rest'] : [it.sit ? 'sit' : 'rest'];
    for (const action of actions) {
      const r = await trySeat(`${it.id} ${action} r${rot}`, pid, action);
      const want = it.id === 'bathtub' ? 'bath' : action === 'rest' && !/chair|wingback|bean_bag|egg|rocking|lounge|armchair/.test(it.id) ? 'lie' : /hammock|sun_lounger/.test(it.id) ? 'lie' : 'sit';
      check(`${it.id} (${action}, turned ${rot}): reached, ${want === 'sit' ? 'sat on' : want === 'lie' ? 'lain on' : 'lain in'}, and left onto a free cell`, r.sat && r.mode === want && !r.up.seated && !r.up.inside, JSON.stringify(r));
    }
    await page.eval(`(() => { const g = window.__teul.game; window.__teul.engine.command({ type: 'store', pid: ${pid} }, g.now()); g.refresh(); })()`);
  }

  // ---- the town's own seats: a bench in the street, the church's pews, the salon's chair, the hospital's bench and bed
  for (const [loc, item, action] of [['village', 'bench', 'sit'], ['church_in', 'pew', 'sit'], ['salon_in', 'salon_chair', 'sit'], ['hospital_in', 'waiting_bench', 'sit'], ['hospital_in', 'hospital_bed', 'rest'], ['cafe_in', 'dining_chair_wood', 'sit'], ['library_in', 'armchair', 'sit']]) {
    const there = await page.eval(`(() => {
      const g = window.__teul.game;
      const def = window.__teul.engine.catalog.locations['${loc}'];
      if (g.location !== '${loc}') g.enterLocation('${loc}', def.entry ?? [Math.floor(def.w / 2), def.h - 2]);
      return g.location === '${loc}';
    })()`);
    await page.sleep(1200);
    const pids = JSON.parse(await page.eval(`JSON.stringify(window.__teul.game.room.placements.filter((p) => p.item === '${item}').map((p) => p.pid))`));
    if (!there || pids.length === 0) {
      check(`${item} in ${loc} is there to sit on`, false, `${there} ${pids.length}`);
      continue;
    }
    // the nearest few of them (a far bench may be on the other side of town)
    const near = JSON.parse(await page.eval(`(() => { const g = window.__teul.game; return JSON.stringify(g.room.placements.filter((p) => p.item === '${item}').sort((a, b) => Math.hypot(a.x - g.walker.x, a.y - g.walker.y) - Math.hypot(b.x - g.walker.x, b.y - g.walker.y)).slice(0, 2).map((p) => p.pid)); })()`));
    for (const pid of near) {
      // a few steps away from it (the town is big; the walk itself is not what is tested here)
      await page.eval(`(() => { const g = window.__teul.game; const c = g.standCells(${pid}); const far = c[c.length - 1]; if (far) g.debugTeleport(far[0] + 0.5, far[1] + 0.5); })()`);
      await page.sleep(300);
      const r = await trySeat(`${item} @${loc}`, pid, action);
      check(`${item} in ${loc}: reached, ${action === 'rest' ? 'lain on' : 'sat on'}, left onto a free cell`, r.sat && r.mode === (action === 'rest' ? 'lie' : 'sit') && !r.up.seated && !r.up.inside, JSON.stringify(r));
    }
  }
  check('no errors in the page', page.errors().length === 0, page.errors().join(' | '));
});

// ---- the contact sheet: each seat cropped around the hero, labelled
if (TMP && sheet.length) {
  writeFileSync(`${TMP}/sheet.json`, JSON.stringify(sheet));
  execFileSync('python3', ['-I', '-c', `
import json, sys
from PIL import Image, ImageDraw
items = json.load(open(sys.argv[1]))
W, H, S = 150, 120, 2
cols = 8
rows = (len(items) + cols - 1) // cols
out = Image.new('RGB', (cols * W * S, rows * (H * S + 22)), (18, 16, 30))
d = ImageDraw.Draw(out)
for i, it in enumerate(items):
    im = Image.open(it['file']).convert('RGB')
    x, y = int(it['x']), int(it['y'])
    crop = im.crop((x - W // 2, y - H // 2 - 10, x + W // 2, y + H // 2 - 10)).resize((W * S, H * S), Image.NEAREST)
    cx, cy = (i % cols) * W * S, (i // cols) * (H * S + 22)
    out.paste(crop, (cx, cy))
    d.text((cx + 6, cy + H * S + 4), it['label'], fill=(240, 236, 216))
out.save(sys.argv[2])
`, `${TMP}/sheet.json`, `${SHOTS}/media-seats.png`]);
  console.log(`contact sheet: ${SHOTS}/media-seats.png (${sheet.length} seats)`);
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
