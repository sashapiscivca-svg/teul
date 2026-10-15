// The paper, the town's celebrations and the plant beyond the fields, in a real (headless Firefox) browser against
// `vite preview` of an e2e build. Usage: BASE=http://localhost:4173/ node e2e/paper.mjs [shots dir]
// The world's clock only moves forward: the dates visited go in order.
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? '';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}


/** Minutes from now to a date and hour of the town. */
function shiftTo(y, m, d, hour, minute = 0) {
  return Math.round((new Date(y, m - 1, d, hour, minute).getTime() - Date.now()) / 60_000);
}

await withFirefox(async (page) => {
  const load = async (shift) => {
    await page.goto(`${BASE}?debug&skip&shift=${shift}`);
    for (let i = 0; i < 120 && !(await page.eval('!!(window.__teul && window.__teul.game && window.__teul.game.started)')); i++) await page.sleep(250);
    await page.sleep(1500);
  };
  /** Opens the world at a date and hour of the town (its clock keeps Kyiv's hours): a little early, then exactly. */
  const open = async (shift) => {
    const target = shift + Math.round(Date.now() / 60_000);
    await load(shift - 90);
    const at = JSON.parse(await g('JSON.stringify({ c: e.calendarDay(g.now()), m: Math.floor(g.now()) % 1440 })'));
    const town = Math.round(new Date(at.c.year, at.c.month - 1, at.c.day, 0, at.m).getTime() / 60_000);
    // how far the town's clock is from the wanted moment (the minutes the load took count for nothing)
    const err = target - town;
    if (Math.abs(err) > 2) await load(shift - 90 + err);
    return shift - 90 + (Math.abs(err) > 2 ? err : 0);
  };
  const g = (js) => page.eval(`(() => { const g = window.__teul.game; const e = window.__teul.engine; return ${js}; })()`);
  const paperOpen = () => page.eval("document.querySelector('.paper')?.style.display === ''");
  const photosPrinted = async () => {
    for (let i = 0; i < 80; i++) {
      const left = await page.eval("document.querySelectorAll('.paper .paper-photo.loading').length");
      if (left === 0) break;
      await page.sleep(250);
    }
    return page.eval("[...document.querySelectorAll('.paper .paper-photo img')].filter((i) => /^data:image\\/png/.test(i.src)).length");
  };
  const shot = async (name, town = false) => {
    if (!SHOTS) return;
    // in town: the paper (which may open late, on a new day) put away, the toasts hidden
    if (town) {
      await page.eval("(() => { window.__teul.game.paperSheet.close(); if (!document.getElementById('shot-css')) { const s = document.createElement('style'); s.id = 'shot-css'; s.textContent = '.toast, .toasts { display: none !important }'; document.head.append(s); } })()");
      await page.sleep(400);
    }
    await page.shot(`${SHOTS}/paper-${name}.png`);
  };
  const outside = async (x, y, settle = 1600) => {
    await g("(g.paperSheet.close(), g.debugGo('village'), 0)");
    await page.sleep(900);
    if (x !== undefined) await g(`(g.debugTeleport(${x}, ${y}), 0)`);
    await page.sleep(settle);
  };
  const near = async (item, dx = 1.5, dy = 2.5) => {
    const at = JSON.parse(await g(`JSON.stringify(g.room.placements.find((p) => p.item === ${JSON.stringify(item)}) ?? null)`));
    if (at) await g(`(g.debugTeleport(${at.x + dx}, ${at.y + dy}), 0)`);
    await page.sleep(1400);
    return at;
  };
  const count = (item) => g(`g.room.placements.filter((p) => p.item === ${JSON.stringify(item)}).length`);


  // ---- 26 October 2026: the plant is announced; the front page with its photo
  await open(shiftTo(2026, 10, 26, 8, 30));
  await g('(g.morningPaper(true), 0)');
  await page.sleep(300);
  check('the morning paper is open', await paperOpen());
  const printed = await photosPrinted();
  check('every story in the paper has a photo printed from the town', printed >= 1 && printed === (await page.eval("document.querySelectorAll('.paper .paper-photo').length")), `printed ${printed}`);
  const all = await page.eval("[...document.querySelectorAll('.paper-lead h2, .paper-story b')].map((e) => e.textContent).join(' | ')");
  check('the paper tells that a nuclear plant will be built beyond the town', /атомну станцію/.test(all), all);
  check('the texts are short (a headline and a line or two)', await page.eval("[...document.querySelectorAll('.paper-lead p, .paper-story p')].every((p) => p.textContent.length < 240)"));
  check('no separate «while you were away» screen', !(await page.eval("document.querySelector('.ask')?.style.display === ''")));
  await shot('front-npp');

  // ---- back after five days away: the missed issues lie on top of the paper (11 November, the lantern night)
  await open(shiftTo(2026, 11, 11, 8, 0));
  // (leaving a page writes the moment it was left; so the five days away are set here, as if just opened)
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet.close(); localStorage.setItem('teul.lastSeen', String(g.now() - 5 * 1440)); g.morningPaper(true, g.welcomeBack()); })()");
  for (let i = 0; i < 20 && !(await paperOpen()); i++) await page.sleep(250);
  check('back after days away, the paper opens with the issues missed on top', (await page.eval("document.querySelector('.paper-away h3')?.textContent ?? ''")) === 'Поки тебе не було' && (await page.eval("document.querySelectorAll('.paper-back').length")) >= 3);
  check('the note over them is short', await page.eval("[...document.querySelectorAll('.paper-away-note')].length <= 3 && [...document.querySelectorAll('.paper-away-note')].every((p) => p.textContent.length < 140)"));
  await photosPrinted();
  check('the lantern night makes the front page', /Ніч ліхтариків/.test(await page.eval("[...document.querySelectorAll('.paper-lead h2, .paper-story b')].map((e) => e.textContent).join(' ')")));
  await shot('away');
  await page.eval("document.querySelector('.paper-close')?.click()");

  // ---- the lantern night in town, at dusk
  await open(shiftTo(2026, 11, 11, 17, 40));
  await outside();
  check('paper lanterns are out in town on the lantern night', (await count('lantern_post')) >= 3);
  await near('lantern_post', 0.5, 2);
  await shot('holiday-lanterns', true);

  // ---- 5 December: the protest on the square, placards
  await open(shiftTo(2026, 12, 5, 12, 0));
  await outside();
  check('on the day of the protest there are placards on the square', (await count('protest_placards')) >= 1);
  check('the plant has not been begun yet: nothing on the horizon', await g('g.plantOnHorizon() === null'));

  // ---- the Lunar New Year (6 February 2027): getting ready the days before, the dragon on the day
  await open(shiftTo(2027, 2, 3, 12, 0));
  await outside();
  const prep = JSON.parse(await g('JSON.stringify(e.festival(g.now()))'));
  check('three days before, the town is getting ready for the Lunar New Year', prep?.id === 'lunar_new_year' && prep?.phase === 'prep', JSON.stringify(prep));
  check('posters are up and red lanterns are being hung', (await count('poster_board')) >= 1 && (await count('red_lanterns')) >= 1);
  const fewer = await count('red_lanterns');
  await open(shiftTo(2027, 2, 6, 11, 20));
  await outside();
  check('on the day there are more lanterns than while getting ready', (await count('red_lanterns')) > fewer);
  const parade = JSON.parse(await g('JSON.stringify(g.paradeNow())'));
  check('the dragon dances down the main street, carried by the townsfolk', !!parade && parade.pieces[0].item === 'dragon_head' && parade.pieces.length >= 6 && parade.dancers.length >= 6, `minute ${await g('Math.floor(g.now()) % 1440')}`);
  if (parade) await g(`(g.debugTeleport(${parade.pieces[4].x + 2.5}, ${parade.pieces[4].y + 2.5}), g.zoom = 1.5, 0)`);
  await page.sleep(1500);
  await shot('holiday-lunar', true);
  check('the Lunar New Year pastries are sold at the bread stall that day', await g("e.stations(g.now()).some((s) => s.id === 'st.stall_bread.sesame_balls' && s.ok)"));

  // ---- the town's day (10 July 2027): a stage in scaffolding a few days before, the stage on the day
  await open(shiftTo(2027, 7, 6, 12, 0));
  await outside();
  check('days before the town day the stage stands in scaffolding', (await count('stage_frame')) === 1 && (await count('town_stage')) === 0);
  await open(shiftTo(2027, 7, 10, 18, 30));
  await outside();
  check('on the town day the stage is up, with garlands and stalls', (await count('town_stage')) === 1 && (await count('bunting')) >= 3 && (await count('festival_stall')) >= 2);
  await near('town_stage', 1.5, 3);
  await shot('holiday-townday', true);
  await open(shiftTo(2027, 7, 11, 9, 0));
  await outside();
  check('the morning after: rubbish bags, the stalls gone', (await count('rubbish_bags')) >= 1 && (await count('festival_stall')) === 0);

  // ---- 1 October 2027: the first cooling tower — the paper's photo looks over the fields to the horizon
  await open(shiftTo(2027, 10, 1, 9, 0));
  await g('(g.morningPaper(true), 0)');
  await photosPrinted();
  check('the paper tells the tower is rising, with a photo of the horizon', /градирня/.test(await page.eval("[...document.querySelectorAll('.paper-lead h2, .paper-story b')].map((e) => e.textContent).join(' ')")) && /поле/i.test(await page.eval("[...document.querySelectorAll('.paper figcaption')].map((e) => e.textContent).join(' ')")));
  await shot('npp-towers');

  // ---- November 2027: cranes and a rising cooling tower on the horizon
  await open(shiftTo(2027, 11, 3, 16, 30));
  const plant = JSON.parse(await g('JSON.stringify(e.npp(g.now()))'));
  check('by autumn 2027 the cooling towers are rising', plant?.id === 'towers' && plant.built > 0, JSON.stringify(plant));
  await outside(36, 3, 2200);
  check('out of doors the plant stands on the horizon', await g('g.plantOnHorizon() !== null'));
  check('people talk about the plant, for and against', await g("['r1','r2','r3','r4','r5','r6','r7','r8'].some(() => true) && Object.keys(e.catalog.residents ?? {}).slice(0, 30).map((id) => g.talkCtx(id)?.topics ?? []).flat().some((l) => /станці|градирн|кран/i.test(l))"));

  // ---- the title screen two years on: the plant risen beyond the town's hills
  await page.goto(`${BASE}?debug&shift=${shiftTo(2029, 10, 2, 12, 0)}`);
  for (let i = 0; i < 60 && !(await page.eval("!!document.querySelector('.title-screen .screen-go')")); i++) await page.sleep(250);
  await page.sleep(2500);
  await shot('npp-title');
}, { width: 900, height: 420 });

console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
