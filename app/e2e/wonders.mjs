// The wonders, end to end: the four rift worlds (the winter one the town inside out, kept by other beings), the
// eerie nights out of doors (nothing with the setting off; the mob, the masked ones in the wheat, the hunt with it
// on), and the sky (an eclipse, a meteor night, a comet, the visitors and the cow, the circle in the wheat).
// Each part in a fresh world (the clock only moves forward).
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/wonders.mjs [shots-dir]
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
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};

/** Minutes to add to the clock to reach `minute` of the next day a sky event of `kind` happens. */
const shiftToSky = (page, kind, minute, days = 4000) =>
  page.eval(`(() => {
    const e = window.__teul.engine;
    const now = window.__teul.game.now();
    const at = e.skyNext('${kind}', now, ${days});
    return at === null ? -1 : at + ${minute} - now;
  })()`);

const shot = async (page, name) => {
  if (!SHOTS) return;
  // nothing in the way of the picture: no dialogs, no toasts
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.dialogue?.close?.(); document.querySelectorAll('.toast, .sheet.open').forEach((t) => t.remove()); })()");
  await page.sleep(300);
  await page.shot(`${SHOTS}/wonders-${name}.png`);
};

/** Opens a fresh world at a moment of the sky, for one part of the test. */
async function at(kind, minute, fn, days) {
  await withFirefox(async (page) => {
    await page.goto(`${BASE}?debug&skip`);
    await ready(page);
    const shift = await shiftToSky(page, kind, minute, days);
    if (shift < 0) {
      check(`a ${kind} comes within ${days ?? 4000} days`, false, String(shift));
      return;
    }
    await page.goto(`${BASE}?debug&skip&shift=${shift}`);
    await ready(page);
    await fn(page);
    for (const e of page.errors()) if (!/prepend of null|WebGL|webgl/.test(e.text)) check('no console errors', false, e.text);
  });
}

// ---- 1. the four rift worlds
for (const [world, minute, name] of [['rift_spring', 12 * 60, 'spring-glasshouse'], ['rift_summer', 13 * 60, 'summer-salt-sea'], ['rift_autumn', 17 * 60, 'autumn-clockwork-orchard'], ['rift_winter', 22 * 60, 'winter-town-inside-out']]) {
  await at(world, minute, async (page) => {
    const sky = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.skyView(window.__teul.game.now()))'));
    check(`${world}: the rifts open into it on its day`, sky.rift_world === world, JSON.stringify(sky));
    const r = JSON.parse(await page.eval(`(async () => {
      const g = window.__teul.game;
      g.debugGo('village');
      await new Promise((r) => setTimeout(r, 1200));
      const crack = g.room.placements.find((p) => p.item === 'rift_crack');
      if (!crack) return JSON.stringify({ err: 'no crack' });
      g.debugTeleport(crack.x + 0.5, crack.y + 1.5);
      await new Promise((r) => setTimeout(r, 300));
      g.doUse(crack.pid, 'rift');
      await new Promise((r) => setTimeout(r, 2500));
      const npcs = g.npcsSeated(g.room);
      return JSON.stringify({ location: g.location, beings: npcs.filter((n) => n.id.startsWith('being:')).length, people: npcs.filter((n) => /^res_/.test(n.id)).length, post: getComputedStyle(document.querySelector('.wonders-post')).display, opacity: document.getElementById('scene').style.opacity });
    })()`));
    check(`${world}: stepping into the crack reaches it`, r.location === world, JSON.stringify(r));
    check(`${world}: beings live there, and no people`, r.beings >= 3 && r.people === 0, JSON.stringify(r));
    if (world === 'rift_winter') check('the town inside out is drawn through the shader (or its filter)', r.post === 'block' || (await page.eval("document.getElementById('scene').style.filter")).includes('invert'), JSON.stringify(r));
    // to the heart of the world for its picture
    await page.eval(`(async () => {
      const g = window.__teul.game;
      const spot = (g.engine.catalog.locations['${world}'].spots ?? [])[0];
      if (spot && '${world}' !== 'rift_winter') g.debugTeleport(spot.x + 0.5, spot.y + 1.5);
      await new Promise((r) => setTimeout(r, 1500));
    })()`);
    await shot(page, name);
    const found = await page.eval(`(() => {
      const g = window.__teul.game;
      const e = window.__teul.engine;
      for (const spot of (e.catalog.locations['${world}'].spots ?? []).map((s) => s.id)) if (e.command({ type: 'gather', spot }, g.now()).ok) return 'ok';
      return 'nothing found';
    })()`);
    check(`${world}: it gives its own finds`, found === 'ok', found);
    const said = await page.eval(`(() => { const g = window.__teul.game; const b = g.npcsSeated(g.room).find((n) => n.id.startsWith('being:')); return b ? g.wonders.says(b.id, 3) : null; })()`);
    check(`${world}: a being says something`, typeof said === 'string' && said.length > 0, String(said));
    const back = await page.eval(`(async () => {
      const g = window.__teul.game;
      const crack = g.room.placements.find((p) => p.item === 'rift_crack');
      g.debugTeleport(crack.x + 0.5, crack.y + 1.5);
      g.doUse(crack.pid, 'rift');
      await new Promise((r) => setTimeout(r, 1500));
      return JSON.stringify({ location: g.location, opacity: document.getElementById('scene').style.opacity });
    })()`);
    const b = JSON.parse(back);
    check(`${world}: the crack leads back, and the picture is itself again`, b.location === 'village' && b.opacity !== '0', back);
  }, 400);
}

// ---- 2. the eerie night: nothing with the setting off; the mob, the field and the hunt with it on
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await page.eval(`(() => {
    const e = window.__teul.engine; const now = window.__teul.game.now();
    for (let k = 0; k < 400; k++) if (e.dayView(now + k * 1440).holiday_id === 'halloween') return k * 1440 + (22 * 60 + 30 - (now % 1440));
    return -1;
  })()`);
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  const tryNights = (on) =>
    page.eval(`(async () => {
      const g = window.__teul.game;
      g.prefs.horror = ${on};
      g.debugGo('village');
      await new Promise((r) => setTimeout(r, 1200));
      const night = { holiday: 'halloween', tomorrow: null, rift: false, minute: 22 * 60 + 30, place: g.location };
      let started = null;
      for (let slot = 0; slot < 80 && !started; slot++) started = g.wonders.maybeNight(g.wondersHost(), night, 5, slot);
      return JSON.stringify(started);
    })()`);
  check('with the setting off, Halloween night stays sweet: no night unfolds', (await tryNights(false)) === 'null');
  const off = await page.eval(`(() => { const g = window.__teul.game; const seen = []; const orig = g.haunt.bind(g); g.haunt = (e) => seen.push(e.kind); for (let k = 0; k < 40; k++) { g.ask.close(); g.nightTick(2e9 + k * 70000); } g.haunt = orig; return JSON.stringify([seen, g.wonders.nightmare.active]); })()`);
  check('…and nothing eerie happens at all', off === '[[],false]', off);
  const started = JSON.parse(await tryNights(true));
  check('with it on, a whole night unfolds out of doors', started === 'mob' || started === 'chase', String(started));
  await page.eval('window.__teul.game.wonders.nightmare.stop()');
  // the mob
  const mob = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.wonders.begin('mob', g.wondersHost(), 7);
    await new Promise((r) => setTimeout(r, 12000));
    const me = g.walker;
    const f = g.nightFigures;
    return JSON.stringify({ n: f.length, torches: f.filter((x) => x.layers.some((l) => l.color === '#ff7a1a')).length, nearest: Math.min(...f.map((x) => Math.hypot(x.x - me.x, x.y - me.y))) });
  })()`));
  check('the mob fills the street with torches and pitchforks', mob.n >= 8 && mob.torches >= 3, JSON.stringify(mob));
  check('…and closes in, but keeps an arm and a bit away', mob.nearest > 2 && mob.nearest < 14, JSON.stringify(mob));
  await shot(page, 'horror-torch-mob');
  await page.eval('window.__teul.game.wonders.nightmare.stop()');
  // the masked ones in the wheat
  const field = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.enterLocation('fields', [20, 20]);
    await new Promise((r) => setTimeout(r, 1500));
    if (g.location !== 'fields') return JSON.stringify({ err: g.location });
    g.wonders.begin('field', g.wondersHost(), 3);
    await new Promise((r) => setTimeout(r, 1200));
    window.__fieldStart = true;
    const me = g.walker;
    const d0 = Math.min(...g.nightFigures.map((x) => Math.hypot(x.x - me.x, x.y - me.y)));
    const robed = g.nightFigures.length;
    // turn one's back on them, again and again
    for (let i = 0; i < 6; i++) {
      const away = g.nightFigures.reduce((a, x) => [a[0] + x.x, a[1] + x.y], [0, 0]).map((v) => v / Math.max(1, g.nightFigures.length));
      const dx = me.x - away[0], dy = me.y - away[1], d = Math.hypot(dx, dy) || 1;
      for (let k = 0; k < 8; k++) { g.walker.x += (dx / d) * 0.05; g.walker.y += (dy / d) * 0.05; await new Promise((r) => setTimeout(r, 40)); }
      await new Promise((r) => setTimeout(r, 2400));
    }
    const d1 = g.nightFigures.length ? Math.min(...g.nightFigures.map((x) => Math.hypot(x.x - me.x, x.y - me.y))) : 0;
    return JSON.stringify({ robed, d0, d1, behind: g.nightFigures.some((x) => x.id === 'nm:robed:behind') });
  })()`));
  check('in the field, masked figures in robes stand in the wheat', field.robed >= 3, JSON.stringify(field));
  check('…and each time you turn your back they are closer', field.d1 < field.d0, JSON.stringify(field));
  // a picture of them standing there, a few steps off
  await page.eval(`(async () => { const g = window.__teul.game; g.wonders.nightmare.stop(); g.wonders.begin('field', g.wondersHost(), 5); await new Promise((r) => setTimeout(r, 1500)); })()`);
  await shot(page, 'horror-masked-in-wheat');
  await page.eval('window.__teul.game.wonders.nightmare.stop()');
  // the hunt: it comes after you; caught, you wake at home
  const chase = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    g.wonders.begin('chase', g.wondersHost(), 11);
    await new Promise((r) => setTimeout(r, 300));
    const h0 = g.nightFigures.find((x) => x.id === 'nm:hunter');
    const me = g.walker;
    const d0 = h0 ? Math.hypot(h0.x - me.x, h0.y - me.y) : -1;
    await new Promise((r) => setTimeout(r, 3000));
    const h1 = g.nightFigures.find((x) => x.id === 'nm:hunter');
    const d1 = h1 ? Math.hypot(h1.x - me.x, h1.y - me.y) : -1;
    return JSON.stringify({ d0, d1 });
  })()`));
  check('something hunts you, and it comes closer', chase.d0 > 3 && chase.d1 >= 0 && chase.d1 < chase.d0, JSON.stringify(chase));
  // the picture when it is a few steps behind
  await page.eval(`(async () => { const g = window.__teul.game; for (let i = 0; i < 100; i++) { const h = g.nightFigures.find((x) => x.id === 'nm:hunter'); if (!h || Math.hypot(h.x - g.walker.x, h.y - g.walker.y) < 3.2) break; await new Promise((r) => setTimeout(r, 100)); } })()`);
  await shot(page, 'horror-chase');
  const caught = await page.eval(`(async () => {
    const g = window.__teul.game;
    const h = g.nightFigures.find((x) => x.id === 'nm:hunter');
    if (h) g.debugTeleport(h.x, h.y);
    for (let i = 0; i < 60 && g.location !== 'home'; i++) await new Promise((r) => setTimeout(r, 100));
    return g.location;
  })()`);
  check('caught: the screen goes black and you wake at home', caught === 'home', caught);
});

// ---- 3. the sky
await at('eclipse', 13 * 60 + 20, async (page) => {
  const r = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 4000));
    const s = window.__teul.engine.skyView(g.now());
    const sq = g.engine.catalog.locations.village.places.find((p) => p.id === 'square');
    g.debugTeleport(sq.x + sq.w / 2, sq.y + sq.h + 1);
    await new Promise((r) => setTimeout(r, 1500));
    return JSON.stringify({ eclipse: s.eclipse, watching: g.watching.size, fx: document.querySelector('.wonders-fx').width > 0 });
  })()`));
  check('an eclipse darkens the afternoon on its real day', r.eclipse && r.eclipse.now > 0, JSON.stringify(r));
  check('the town comes out on the square to watch it', r.watching >= 3, JSON.stringify(r));
  await shot(page, 'sky-eclipse');
}, 400);

await at('meteors', 23 * 60, async (page) => {
  const r = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const s = window.__teul.engine.skyView(g.now());
    // the test sees the streaks whatever the clouds say tonight
    g.wonders.forced = { meteors: { ...s.meteors, clear: true } };
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1500));
    const hill = g.engine.catalog.locations.village.places.find((p) => p.id === 'hill');
    g.debugTeleport(hill.x + 1, hill.y + hill.h + 1);
    let most = 0;
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 150)); most = Math.max(most, g.wonders.fx.streaking); }
    g.wonders.fx.burst(6);
    return JSON.stringify({ meteors: s.meteors, most, watching: g.watching.size });
  })()`));
  check('a meteor shower on its real peak night', !!r.meteors && r.meteors.rate >= 2 && r.meteors.dark, JSON.stringify(r));
  check('stars streak across the sky', r.most > 0, JSON.stringify(r));
  check('people lie on the starry hill to watch', r.watching >= 2, JSON.stringify(r));
  await page.eval('window.__teul.game.wonders.fx.burst(7)');
  await page.sleep(150);
  if (SHOTS) await page.shot(`${SHOTS}/wonders-sky-meteor-shower.png`);
}, 400);

await at('comet', 22 * 60, async (page) => {
  const r = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 2000));
    const s = window.__teul.engine.skyView(g.now());
    const story = window.__teul.engine.skyStories(g.now());
    return JSON.stringify({ comet: s.comet, story: story.map((x) => x.headline) });
  })()`));
  check('a comet comes, a few a decade, and the paper says so on its first day', !!r.comet && r.story.some((h) => h.includes('Комета')), JSON.stringify(r));
  await shot(page, 'sky-comet');
});

await at('aliens', 115, async (page) => {
  const r = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.enterLocation('farm', [30, 30]);
    await new Promise((r) => setTimeout(r, 2500));
    const s = window.__teul.engine.skyView(g.now());
    const pasture = g.engine.catalog.locations.farm.places.find((p) => p.id === 'pasture');
    if (pasture) g.debugTeleport(pasture.x + pasture.w / 2 + 1, pasture.y + pasture.h / 2 + 2);
    await new Promise((r) => setTimeout(r, 1500));
    const stories = window.__teul.engine.skyStories(g.now()).map((x) => x.id);
    return JSON.stringify({ location: g.location, aliens: s.aliens, stories });
  })()`));
  check('the visitors come over the farm at night, very rarely, and a beam takes a cow', r.location === 'farm' && r.aliens && r.aliens.phase === 2, JSON.stringify(r));
  check('the morning paper tells it', r.stories.some((id) => id.startsWith('sky.aliens')), JSON.stringify(r));
  await page.sleep(600);
  await shot(page, 'sky-cow-abduction');
});

await at('aliens', 1440 + 11 * 60, async (page) => {
  const r = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.enterLocation('fields', [20, 20]);
    await new Promise((r) => setTimeout(r, 2000));
    const circle = g.room.placements.find((p) => p.item === 'crop_circle');
    if (circle) g.debugTeleport(circle.x + 3.5, circle.y + 8);
    await new Promise((r) => setTimeout(r, 1200));
    const s = window.__teul.engine.skyView(g.now());
    return JSON.stringify({ circle: !!circle, missing: s.cow_missing });
  })()`));
  check('the next day: a circle pressed into the wheat, and the cow still gone', r.circle && r.missing, JSON.stringify(r));
  await shot(page, 'sky-crop-circle');
});

console.log(failed ? `${failed} CHECK(S) FAILED` : 'all wonders checks passed');
process.exit(failed ? 1 : 0);
