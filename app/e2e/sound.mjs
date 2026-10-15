// The music and the sounds, end to end, as the audio graph sees them (headless Firefox may not play a sound; the
// state of the graph is checked, not the waves): the piece follows the hour, the season, the place, the rain and
// the feast; the ambience's layers follow the world around (the town's hum by day, crickets at night, rain on the
// roof inside); footsteps know what is underfoot.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/sound.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let worlds = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game)')); i++) await page.sleep(250);
  await page.sleep(1400);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.sound.unlock(); })()");
  await page.sleep(400);
};

/** Minutes from now to `minute` of the first day (from today on) for which `test(dayView, sky, festival)` holds. */
const shiftTo = async (page, test, minute, days = 420, world = `snd${worlds + 1}`) => {
  // in the world the moment will be shown in (its weather is its own), on today's clock
  await page.goto(`${BASE}?debug&skip&world=${world}`);
  await ready(page);
  return page.eval(`(() => {
    const e = window.__teul.engine, now = window.__teul.game.now();
    for (let k = 0; k < ${days}; k++) {
      const t = now - (now % 1440) + k * 1440 + ${minute};
      if (t < now) continue;
      let sky = 'clear';
      try { sky = JSON.parse(e.weatherAt(t)); } catch {}
      if ((${test})(e.dayView(t), sky, e.festival ? e.festival(t) : null)) return t - now;
    }
    return -1;
  })()`);
};

/** A fresh world for each moment (the clock of a world only goes forward). */
async function at(page, shift, where, x, y) {
  await page.goto(`${BASE}?debug&skip&world=snd${++worlds}&shift=${Math.max(0, shift)}`);
  await ready(page);
  await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    for (let i = 0; i < 40 && g.location !== 'village'; i++) await new Promise((r) => setTimeout(r, 150));
    await new Promise((r) => setTimeout(r, 400));
    ${where !== 'village' ? `g.enterLocation('${where}', [${Math.floor(x)}, ${Math.floor(y)}]); await new Promise((r) => setTimeout(r, 900));` : ''}
    ${x !== undefined ? `g.debugTeleport(${x}, ${y});` : ''}
  })()`);
  await page.sleep(1600);
}

const state = (page) => page.eval('JSON.stringify(window.__teul.game.sound.state())').then(JSON.parse);

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const first = await state(page);
  check('the sound starts once allowed', first.running, JSON.stringify(first));
  if (!first.running) {
    console.log('(no audio context running in this browser: the graph cannot be checked)');
    return;
  }
  const sq = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.catalog.locations.village.landmarks.square_centre)'));

  // ---- the town at midday on a dry day: the season's tune (or the town's own), its hum, birds
  const noon = await shiftTo(page, '(d, sky) => sky !== "rain" && sky !== "storm" && !d.festive', 13 * 60);
  await at(page, noon, 'village', sq.x + 0.5, sq.y + 3.5);
  let s = await state(page);
  check('midday in town plays the season or the town', ['spring', 'summer', 'autumn', 'winter', 'village'].includes(s.mood), s.mood);
  check('the town hums by day', s.mix.hum > 0, JSON.stringify(s.mix));
  check('no rain heard on a dry day', s.mix.rain === 0 && s.mix.roof === 0, JSON.stringify(s.mix));

  // ---- places with a sound of their own
  for (const [loc, x, y, mood] of [['cafe_in', 5.5, 6.5, 'cafe'], ['church_in', 5.5, 8.5, 'church'], ['temple_in', 4.5, 6.5, 'temple']]) {
    await page.eval(`(async () => { const g = window.__teul.game; g.enterLocation('${loc}', [${Math.floor(x)}, ${Math.floor(y) + 1}]); await new Promise((r) => setTimeout(r, 900)); g.debugTeleport(${x}, ${y}); })()`);
    await page.sleep(1200);
    s = await state(page);
    check(`${loc}: its own music (${mood})`, s.mood === mood, s.mood);
    check(`${loc}: no birds, no town hum indoors`, s.mix.birds === 0 && s.mix.hum === 0, JSON.stringify(s.mix));
  }

  // ---- the morning and the night in town
  const morning = await shiftTo(page, '(d, sky) => sky !== "rain" && sky !== "storm" && !d.festive', 7 * 60);
  await at(page, morning, 'village', sq.x + 0.5, sq.y + 3.5);
  s = await state(page);
  check('a morning tune in the morning', s.mood === 'morning', `${s.mood} at ${await page.eval('window.__teul.game.location + " " + (window.__teul.game.now() % 1440)')}`);
  const night = await shiftTo(page, '(d, sky) => sky !== "rain" && sky !== "storm" && !d.festive', 23 * 60);
  await at(page, night, 'village', sq.x + 0.5, sq.y + 3.5);
  s = await state(page);
  check('the night tune at night', s.mood === 'night', s.mood);
  check('no birds at night', s.mix.birds === 0, JSON.stringify(s.mix));

  // ---- the rain: its own tune out of doors, the roof drumming inside
  const wet = await shiftTo(page, '(d, sky) => sky === "rain" && !d.festive', 13 * 60);
  if (wet >= 0) {
    await at(page, wet, 'village', sq.x + 0.5, sq.y + 3.5);
    s = await state(page);
    check('the rain tune out in the rain', s.mood === 'rain', s.mood);
    check('rain on the leaves out of doors', s.mix.rain > 0.3, JSON.stringify(s.mix));
    await page.eval("(async () => { const g = window.__teul.game; g.enterLocation('library_in', [5, 7]); await new Promise((r) => setTimeout(r, 900)); g.debugTeleport(5.5, 6.5); })()");
    await page.sleep(1200);
    s = await state(page);
    check('inside, the rain drums on the roof', s.mix.roof > 0.2 && s.mix.rain === 0, JSON.stringify(s.mix));
  } else console.log('SKIP  no rainy day within the year for this world');

  // ---- a feast: Lunar New Year's music on the square
  const lunar = await shiftTo(page, '(d, sky, f) => !!f && f.id === "lunar_new_year" && f.phase === "day"', 11 * 60);
  check('Lunar New Year comes within the year', lunar >= 0, String(lunar));
  if (lunar >= 0) {
    await at(page, lunar, 'village', sq.x + 0.5, sq.y + 3.5);
    s = await state(page);
    check('the dragon\'s music on the feast', s.mood === 'lunar', s.mood);
  }

  // ---- footsteps by what is underfoot
  const steps = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    const out = {};
    for (const [x, y] of [[${sq.x} + 0.5, ${sq.y} + 3.5], [${sq.x} + 0.5, ${sq.y} + 0.5]]) { g.debugTeleport(x, y); out[x + ',' + y] = g.surfaceNow(); }
    return JSON.stringify(out);
  })()`));
  check('footsteps know what is underfoot', Object.values(steps).every((v) => typeof v === 'string' && v.length > 2), JSON.stringify(steps));
}, { prefs: { 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0, 'media.autoplay.block-webaudio': false } });

console.log(failed ? `${failed} FAILED` : 'ALL SOUND CHECKS PASSED');
process.exit(failed ? 1 : 0);
