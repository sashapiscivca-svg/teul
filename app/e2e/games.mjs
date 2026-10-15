// Table games, end to end: the old men at the domino table by the square and a pair at the park's chess table;
// sitting down with one of them, a whole game of draughts to its end; a chess board mid-game, the cards of
// «Дурень».
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/games.mjs [shots-dir]
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
  await page.sleep(1400);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
async function snap(page, name) {
  if (!SHOTS) return;
  await page.eval("(() => { document.querySelector('.toasts')?.replaceChildren(); return 1; })()");
  await page.sleep(200);
  await page.shot(`${SHOTS}/${name}.png`);
}
/** Minutes to `minute` of the first dry day from now on (the old men do not play in the rain). */
const dryDay = (page, minute, test = '() => true') => page.eval(`(() => {
  const e = window.__teul.engine, now = window.__teul.game.now();
  for (let k = 0; k < 30; k++) {
    const t = now - (now % 1440) + k * 1440 + ${minute};
    if (t < now) continue;
    const sky = JSON.parse(e.weatherAt(t));
    if (!['rain', 'storm', 'snow'].includes(sky) && (${test})(Math.floor(t / 1440))) return t - now;
  }
  return -1;
})()`);

await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const lm = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.catalog.locations.village.landmarks)'));
  check('the town has a chess table in the park and a domino table by the square', !!lm.chess_table && !!lm.domino_table);

  // ---- the old men at their dominoes (late morning), a pair at chess (afternoon, not every day)
  const morning = await dryDay(page, 11 * 60);
  await page.goto(`${BASE}?debug&skip&shift=${morning}`);
  await ready(page);
  await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 1000)); g.debugTeleport(${lm.domino_table.x + 1.5}, ${lm.domino_table.y + 2.5}); })()`);
  await page.sleep(1800);
  const dom = JSON.parse(await page.eval("JSON.stringify((window.__teul.game.seatsTaken = new Set(), window.__teul.game.townFigures()).map((f) => f.id).filter((id) => id.startsWith('town:table:dominoes')))"));
  check('two old neighbours sit at the domino table', dom.length === 2, JSON.stringify(dom));
  await snap(page, 'games-domino-yard');

  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const afternoon = await dryDay(page, 15 * 60, '(d) => d % 3 !== 1');
  await page.goto(`${BASE}?debug&skip&shift=${afternoon}`);
  await ready(page);
  await page.eval(`(async () => { const g = window.__teul.game; g.debugGo('village'); await new Promise((r) => setTimeout(r, 1000)); g.debugTeleport(${lm.chess_table.x + 1.5}, ${lm.chess_table.y + 1.5}); })()`);
  await page.sleep(1800);
  const chessFigs = JSON.parse(await page.eval("JSON.stringify((window.__teul.game.seatsTaken = new Set(), window.__teul.game.townFigures()).map((f) => f.id).filter((id) => id.startsWith('town:table:chess')))"));
  check('a pair plays chess in the park', chessFigs.length === 2, JSON.stringify(chessFigs));
  await snap(page, 'games-park-chess');

  // ---- at the chess table: the players there are the ones to play with
  const opened = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    const t = g.room.placements.find((p) => p.item === 'chess_table');
    if (!t) return JSON.stringify({ shown: false, games: [g.location, g.room.placements.length] });
    g.doUse(t.pid, 'games');
    return JSON.stringify({ shown: g.tables.isOpen(), games: [...document.querySelectorAll('.tg-game')].map((b) => b.dataset.game + '@' + b.dataset.who) });
  })()`));
  check('sitting down at the table offers a game with the players', opened.shown && opened.games.some((x) => x.startsWith('chess@res:')) && opened.games.some((x) => x.startsWith('checkers@res:')), JSON.stringify(opened.games.slice(0, 6)));

  // a whole game of draughts against one of them, the hero's moves chosen by the rules' own helper
  const played = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const b = [...document.querySelectorAll('.tg-game')].find((x) => x.dataset.game === 'checkers');
    b.click();
    const t = g.tables;
    for (let n = 0; n < 500 && !t.match.result; n++) {
      if (t.match.myTurn()) t.move(t.match.legal()[0]);
      else { window.clearTimeout(t.aiTimer); t.match.aiMove(); t.after(); }
    }
    return JSON.stringify({ result: t.match.result, moves: t.match.moves.length, status: document.querySelector('.tg-status')?.textContent });
  })()`));
  check('a whole game of draughts with a neighbour ends, and the sheet says how', !!played.result && /Перемога|Поразка|Нічия/.test(played.status), JSON.stringify(played));
  await page.eval('window.__teul.game.tables.close()');

  // a chess board mid-game, and the computer answers by itself
  const chess = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const t = g.room.placements.find((p) => p.item === 'chess_table');
    g.doUse(t.pid, 'games');
    [...document.querySelectorAll('.tg-game')].find((x) => x.dataset.game === 'chess').click();
    const tb = g.tables;
    for (let n = 0; n < 8; n++) {
      if (tb.match.myTurn()) tb.move(tb.match.legal()[Math.floor(n * 7) % tb.match.legal().length]);
      await new Promise((r) => setTimeout(r, 1700));
    }
    return JSON.stringify({ moves: tb.match.moves.length, board: !!document.querySelector('.tg-board') });
  })()`));
  check('chess: the neighbour answers each move by itself', chess.moves >= 7 && chess.board, JSON.stringify(chess));
  await snap(page, 'games-chess-board');
  await page.eval('window.__teul.game.tables.close()');

  // the cards
  await page.eval(`(() => {
    const g = window.__teul.game;
    const t = g.room.placements.find((p) => p.item === 'chess_table');
    g.tables.open('domino_table', t.x + 0.5, t.y + 0.5, g.tableFigs());
  })()`);
  const cards = await page.eval(`(() => { const b = [...document.querySelectorAll('.tg-game')].find((x) => x.dataset.game === 'durak'); if (!b) return 'none'; b.click(); return document.querySelectorAll('.tg-hand .tg-card-face').length; })()`);
  check('«Дурень»: six cards in hand', cards === 6, String(cards));
  await page.sleep(1600);
  await snap(page, 'games-durak');
  await page.eval('window.__teul.game.tables.close()');
});

console.log(failed ? `${failed} FAILED` : 'ALL GAMES CHECKS PASSED');
process.exit(failed ? 1 : 0);
