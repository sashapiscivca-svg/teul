// Music, the TV, the radio, the records and the computer, end to end in a fresh test world with coins to spare.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/media.mjs [shots-dir]
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = process.argv[2] ?? null;
const nowLocal = new Date();
const SHIFT = (((12 * 60 + 10 - (nowLocal.getHours() * 60 + nowLocal.getMinutes())) % 1440) + 1440) % 1440;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}

await withFirefox(async (page) => {
  const shot = async (name) => {
    if (SHOTS) await page.shot(`${SHOTS}/media-${name}.png`);
  };
  const wait = async (expr, secs = 10) => {
    for (let i = 0; i < secs * 5; i++) {
      if (await page.eval(expr)) return true;
      await page.sleep(200);
    }
    return false;
  };
  await page.goto(`${BASE}?debug&skip&rich&shift=${SHIFT}`);
  await wait('!!(window.__teul && window.__teul.game)', 20);
  await page.sleep(1500);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");

  // ---- buy and set out the things that play
  const placed = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const out = {};
    const wx = Math.floor(g.walker.x), wy = Math.floor(g.walker.y);
    for (const item of ['piano', 'guitar', 'accordion', 'violin', 'bandura', 'desk', 'side_table', 'sopilka', 'record_player', 'radio', 'computer']) {
      const a = e.command({ type: 'acquire', item }, g.now());
      if (!a.ok) { out[item] = 'acquire ' + JSON.stringify(a.error); continue; }
      let pid = null;
      // a small thing goes on a table, a shelf, a desk
      if (e.catalog.items[item].layer === 'surface')
        for (const host of [...g.room.placements].sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))) {
          const fp = e.catalog.items[host.item]?.footprint ?? { w: 1, d: 1 };
          for (let i = 0; i < fp.w * fp.d && pid === null; i++)
            for (const [cx, cy] of [[host.x + (i % fp.w), host.y + Math.floor(i / fp.w)], [host.x + Math.floor(i / fp.w), host.y + (i % fp.w)]]) {
              const p = e.command({ type: 'place', item, x: cx, y: cy, rot: 0, wall: null, on: host.pid }, g.now());
              if (p.ok) { pid = p.events.find((x) => x.kind.type === 'Placed').kind.pid; break; }
            }
          if (pid !== null) break;
        }
      for (let r = 2; r < 9 && pid === null; r++)
        for (let dx = -r; dx <= r && pid === null; dx++)
          for (const dy of [-r, r]) {
            const p = e.command({ type: 'place', item, x: wx + dx, y: wy + dy, rot: 0, wall: null, on: null }, g.now());
            if (p.ok) { pid = p.events.find((x) => x.kind.type === 'Placed').kind.pid; break; }
          }
      out[item] = pid;
    }
    g.refresh();
    return JSON.stringify(out);
  })()`));
  check('the instruments, the record player, the radio and the computer can be bought and set out', Object.values(placed).every((v) => typeof v === 'number'), JSON.stringify(placed));
  const tv = await page.eval("window.__teul.game.room.placements.find((p) => p.item === 'tv')?.pid ?? null");
  const opts = JSON.parse(await page.eval(`JSON.stringify({ piano: window.__teul.game.optionsFor(${placed.piano}), tv: window.__teul.game.optionsFor(${tv}), rec: window.__teul.game.optionsFor(${placed.record_player}), radio: window.__teul.game.optionsFor(${placed.radio}), pc: window.__teul.game.optionsFor(${placed.computer}) })`));
  check('each thing offers what it does: play, watch, a record, a station, the computer', opts.piano[0] === 'play' && opts.tv.includes('watch') && opts.rec.includes('records') && opts.radio.includes('stations') && opts.pc.includes('pc'), JSON.stringify(opts));

  // ---- the piano: a piece of the repertoire, played by a beginner's hands
  await page.eval(`window.__teul.game.use(${placed.piano}, 'play')`);
  check('the hero walks to the piano and the music opens', await wait("document.querySelector('.settings.play')?.style.display === ''", 15));
  const list = await page.eval("[...document.querySelectorAll('.play-piece .pp-name')].map((e) => e.textContent).join('|')");
  check('the pieces known by heart are there, the ones without their sheet are not', list.includes('Колискова') && list.includes('Вийди, вийди, сонечко') && !list.includes('Щедрик'), list);
  await page.eval("[...document.querySelectorAll('.play-piece')].find((b) => b.textContent.includes('Вийди, вийди')).click()");
  await page.sleep(2500);
  check('playing, the hero sits at the keys (the piano pose)', (await page.eval('window.__teul.game.media.heroHold()')) === 'piano');
  check('the notes run along the staff as they sound', await page.eval("window.__teul.game.media.instrument.trail.length > 2"));
  await page.sleep(1500);
  await shot('piano');
  check('the piece plays to its end', await wait('window.__teul.game.media.instrument.playing() === null', 60));
  await page.eval("document.querySelector('.settings.play .ph .round').click()");
  await page.sleep(400);
  const learned = await page.eval("window.__teul.engine.repertoire().find((p) => p.id === 'vesnianka').learned");
  check('a piece played to the end is remembered by the hands (and counts as practice)', learned && (await page.eval("window.__teul.engine.skills().find((k) => k.id === 'music').practice")) >= 1);
  const coinsHome = await page.eval('window.__teul.game.debugState().coins');

  // ---- free play on the guitar, the accordion, the violin
  for (const [item, pose] of [['guitar', 'guitar'], ['accordion', 'accordion'], ['violin', 'violin']]) {
    await page.eval(`window.__teul.game.doUse(${placed[item]}, 'play')`);
    await page.sleep(300);
    await page.eval("[...document.querySelectorAll('.play-modes .chip')].find((b) => b.textContent.includes('заманеться')).click()");
    await page.sleep(300);
    const pads = await page.eval("document.querySelectorAll('.play-chord, .play-key, .play-string').length");
    await page.eval(`(() => { const pads = [...document.querySelectorAll('.play-chord, .play-key, .play-string')]; for (const i of [0, 2, 4]) pads[i]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); })()`);
    await page.sleep(400);
    check(`free play on the ${item}: ${pads} keys or pads, and the hero holds it`, pads >= 8 && (await page.eval('window.__teul.game.media.heroHold()')) === pose);
    await page.sleep(1600);
    await page.eval(`(() => { const pads = [...document.querySelectorAll('.play-chord, .play-key, .play-string')]; pads[3]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); })()`);
    await page.sleep(300);
    await shot(item);
    await page.eval("document.querySelector('.settings.play .ph .round').click()");
    await page.sleep(300);
  }
  check('nothing played at home paid a coin', (await page.eval('window.__teul.game.debugState().coins')) === coinsHome);

  // ---- a record from the radio station, on the record player
  const bought = await page.eval(`(() => {
    const g = window.__teul.game, e = window.__teul.engine;
    const go = e.command({ type: 'travel', to: 'radio_in' }, g.now());
    const st = e.command({ type: 'use', station: 'st.record.rec_canon' }, g.now());
    const back = e.command({ type: 'travel', to: 'home' }, g.now());
    g.refresh();
    return go.ok && st.ok && back.ok ? 'ok' : JSON.stringify([go, st, back].filter((r) => !r.ok).map((r) => r.error));
  })()`);
  check('a record can be had at the radio station', bought === 'ok', bought);
  await page.eval(`window.__teul.game.use(${placed.record_player}, 'records')`);
  await wait("document.querySelector('.settings.records')?.style.display === ''", 15);
  await page.sleep(1800);
  const sleeves = await page.eval("[...document.querySelectorAll('.records .rec-row')].map((e) => e.textContent).join('|')");
  check('the shelf shows the records one has', sleeves.includes('Канон') && !sleeves.includes('Тиха ніч'), sleeves);
  await page.eval("[...document.querySelectorAll('.records .rec-row')].find((b) => b.textContent.includes('Канон')).click()");
  await page.sleep(1500);
  await shot('records');
  check('the record goes on and the room plays it', (await page.eval('window.__teul.game.playingNow()')) === 'rec/rec_canon');
  await page.eval(`window.__teul.game.run({ type: 'set_prop', pid: ${placed.record_player}, key: 'lit', value: '0' })`);

  // ---- the radio: a station by the hour
  await page.eval(`window.__teul.game.doUse(${placed.radio}, 'stations')`);
  await page.sleep(300);
  const stations = await page.eval("document.querySelectorAll('.records .rec-row').length");
  await page.eval("[...document.querySelectorAll('.records .rec-row')].find((b) => b.textContent.includes('Класика')).click()");
  await page.sleep(400);
  const air = await page.eval('window.__teul.game.playingNow()');
  check('the radio has its stations; the classical one plays records', stations === 3 && String(air).startsWith('rec/'), `${stations} ${air}`);
  await page.eval(`window.__teul.game.run({ type: 'set_prop', pid: ${placed.radio}, key: 'lit', value: '0' })`);

  // ---- the TV: the hero sits on the sofa, the channel is what the schedule says
  await page.eval(`window.__teul.game.doUse(${tv}, 'watch')`);
  check('the TV goes on once the hero is on the sofa', await wait("window.__teul.game.media.tv.isOpen() && !!window.__teul.game.seat", 20));
  const prog = await page.eval('window.__teul.game.media.tv.now().id');
  check('at midday «Липове ТБ» shows the cooking show', prog === 'cooking', prog);
  const cap = await page.eval("document.querySelector('.tv-caption').textContent");
  check('the show says what is cooked today', /готуємо|Бабуся/.test(cap), cap);
  await page.sleep(800);
  await shot('tv');
  await page.eval("[...document.querySelectorAll('.tv-channels .chip')][1].click()");
  await page.sleep(300);
  check('the second channel is the weather', (await page.eval('window.__teul.game.media.tv.now().id')) === 'weather');
  await page.eval("document.querySelector('.settings.tv .ph .round').click()");

  // ---- the computer
  await page.eval(`window.__teul.game.doUse(${placed.computer}, 'pc')`);
  await page.sleep(400);
  const icons = await page.eval("[...document.querySelectorAll('.pc-icon small')].map((e) => e.textContent).join('|')");
  check('the computer has its desktop of apps', ['Щоденник', 'Малюнок', 'Композитор', 'Енциклопедія', 'Пошта', 'Сапер', 'Погода', 'Ігри'].every((n) => icons.includes(n)), icons);
  await shot('desktop');
  await page.eval("document.querySelector('.pc-icon[data-app=mines]').click()");
  await page.sleep(200);
  await page.eval("document.querySelectorAll('.pc-mines .mc')[40].click()");
  check('«Сапер»: the first cell opens safely', await page.eval("document.querySelectorAll('.pc-mines .mc.open').length > 0 && !document.querySelector('.pc-mines .mc.boom')"));
  await page.eval("document.querySelector('.pc-x').click()");
  await page.eval("document.querySelector('.pc-icon[data-app=wiki]').click()");
  await page.sleep(200);
  check('the encyclopedia knows the town’s places', (await page.eval("document.querySelectorAll('.pc-wiki details').length")) > 10);
  await page.eval("document.querySelector('.pc-x').click()");
  await page.eval("document.querySelector('.pc-icon[data-app=composer]').click()");
  await page.sleep(200);
  await page.eval("(() => { const q = document.querySelectorAll('.pc-seq .sq'); for (const i of [0, 18, 36, 52, 70]) q[i].click(); })()");
  check('the composer keeps what is written', /1/.test((await page.eval("localStorage.getItem('teul.pc.pattern')")) ?? ''));
  await page.eval("document.querySelector('.pc-x').click()");
  const paintings = await page.eval('window.__teul.engine.paintings().length');
  await page.eval("document.querySelector('.pc-icon[data-app=paint]').click()");
  await page.sleep(300);
  await page.eval(`(() => {
    const grid = document.querySelector('.paint-grid');
    const r = grid.getBoundingClientRect();
    const colors = document.querySelectorAll('.paint-palette .color');
    const dot = (x, y, c) => { colors[c].click(); grid.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + (x + 0.5) * r.width / 16, clientY: r.top + (y + 0.5) * r.height / 12, bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup')); };
    for (let x = 0; x < 16; x++) for (let y = 7; y < 12; y++) dot(x, y, 4);
    for (const [x, y] of [[3, 3], [4, 2], [5, 3], [4, 4], [11, 2], [12, 2], [12, 3], [11, 3]]) dot(x, y, 2);
    document.querySelector('.paint-name').value = 'Липове з вікна';
  })()`);
  await shot('paint');
  await page.eval("document.querySelector('.paint .cta').click()");
  await page.sleep(400);
  check('a picture drawn on the computer is printed and framed', (await page.eval('window.__teul.engine.paintings().length')) === paintings + 1);
  await page.eval("window.__teul.game.media.desktop.close()");

  // ---- out in the street with an instrument
  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(1500);
  await page.eval(`(() => {
    const g = window.__teul.game;
    const sq = window.__teul.engine.catalog.sites?.square_site;
    const [ax, ay, aw, ah] = sq?.area ?? [sq?.x ?? 30, sq?.y ?? 30, 1, 1];
    g.debugTeleport(ax + aw / 2 + 0.5, ay + ah / 2 + 2.5);
  })()`);
  await page.sleep(800);
  check('out in the street with an instrument, the hero can take it out', await page.eval("document.querySelector('.hud-busk')?.style.display === ''"));
  await page.eval("document.querySelector('.hud-busk').click()");
  await page.sleep(300);
  const choices = await page.eval("document.querySelectorAll('.settings.play .play-modes .chip').length");
  check('with several instruments along, one chooses which to play', choices >= 5, String(choices));
  const before = await page.eval('window.__teul.game.debugState().coins');
  await page.eval("[...document.querySelectorAll('.play-piece')].find((b) => b.textContent.includes('Вийди, вийди')).click()");
  await page.sleep(4000);
  const listening = await page.eval('window.__teul.game.media.audience.size()');
  await shot('street');
  check('passers-by stop to listen', listening > 0, String(listening));
  check('the piece in the street plays to its end', await wait('window.__teul.game.media.instrument.playing() === null', 60));
  await page.sleep(400);
  const after = await page.eval('window.__teul.game.debugState().coins');
  const said = await page.eval("[...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|')");
  check('the street answers in its own words (and maybe a coin or two)', /слухав|Слухали|плеще|Ніхто не зупинився/.test(said) && after >= before && after - before <= 14, `${before}→${after} ${said}`);
  check('nothing says a number of plays, a quota or how to play', !/\d+\s*\/\s*\d+|залишилось|ліміт|інструкц/i.test(said));
  check('no errors in the page', page.errors().length === 0, page.errors().join(' | '));
});

console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
