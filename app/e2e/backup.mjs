// «Резервна копія» in a real browser: a world saved to a file under a passphrase, a wrong passphrase refused
// kindly, the file opened in another world that becomes the same world, the save sealed at rest, and a copy
// kept beside a world as a second one.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/backup.mjs
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
}
const ready = async (page) => {
  for (let i = 0; i < 80 && !(await page.eval('!!(window.__teul && window.__teul.game && window.__teul.game.started)')); i++) await page.sleep(250);
  await page.sleep(1200);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); })()");
};
const waitFor = async (page, expr, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await page.eval(`!!(${expr})`)) return true;
    await page.sleep(250);
  }
  return false;
};
const digest = (page) => page.eval(`JSON.stringify((() => { const e = window.__teul.engine; return [e.room().placements.map((p) => [p.item, p.x, p.y, p.rot]), e.inventory(), e.wallet(), e.world(e.nowMinutes()).player_name]; })())`);
const openBackup = async (page) => {
  await page.eval('window.__teul.game.openSettings()');
  await page.sleep(300);
  await page.eval(`[...document.querySelectorAll('.settings .row')].find((r) => r.textContent.includes('Резервна копія')).querySelector('button').click()`);
  return waitFor(page, "document.querySelector('.backup') && document.querySelector('.backup').style.display !== 'none'");
};
const type = (page, sel, value) => page.eval(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input')); })()`);

const tag = Date.now() % 1000000;
const A = `bka${tag}`;
const B = `bkb${tag}`;
const C = `bkc${tag}`;
const PASS = 'липи цвітуть у червні';

await withFirefox(async (page) => {
  // ---- world A: a little lived in, then saved to a file
  await page.goto(`${BASE}?world=${A}&debug&skip`);
  await ready(page);
  const played = await page.eval(`(async () => {
    const g = window.__teul.game, e = window.__teul.engine;
    const r1 = g.run({ type: 'name_player', name: 'Богдан' });
    const buy = e.shop().find((s) => s.kind === 'item' && s.status.state === 'available' && s.status.cost.coins > 0 && s.status.cost.coins <= 60);
    const r2 = buy ? g.run({ type: 'acquire', item: buy.id }) : { ok: false };
    await g.saveNow();
    return JSON.stringify({ ok: r1.ok && r2.ok, r1, r2 });
  })()`);
  check('world A is lived in a little', JSON.parse(played).ok, played);
  const before = await digest(page);

  check('the settings open «Резервна копія»', await openBackup(page));
  await type(page, '.backup-pass', 'коротко');
  await type(page, '.backup-pass2', 'коротко');
  await page.eval("document.querySelector('.backup-save').click()");
  await page.sleep(300);
  const short = await page.eval("document.querySelector('.backup-said').textContent");
  check('a short passphrase is refused in plain words', /закоротка/.test(short), short);
  await type(page, '.backup-pass', PASS);
  await type(page, '.backup-pass2', PASS);
  await page.eval('delete window.__teulSaved; document.querySelector(\'.backup-save\').click()');
  const saved = await waitFor(page, 'window.__teulSaved', 80);
  const file = saved ? await page.eval("(() => { const b = window.__teulSaved.bytes; let s = ''; for (const x of b) s += String.fromCharCode(x); return JSON.stringify({ name: window.__teulSaved.name, b64: btoa(s) }); })()") : '{}';
  const f = JSON.parse(file);
  const said = await page.eval("document.querySelector('.backup-said').textContent");
  check('the world is saved to a file', saved && /\.teulbackup$/.test(f.name ?? '') && /збережено/.test(said), `${f.name} ${said}`);
  const plainInFile = f.b64 ? atob(f.b64) : '';
  check('the file is sealed (no name, no world key in it)', plainInFile.includes('"world-backup"') && !Buffer.from(plainInFile, 'latin1').toString('utf8').includes('Богдан'));

  // ---- world B: the file opened here
  await page.goto(`${BASE}?world=${B}&debug&skip`);
  await ready(page);
  const otherBefore = await digest(page);
  check('world B starts as another world', otherBefore !== before);
  await openBackup(page);
  await page.eval(`window.__teulPick = Uint8Array.from(atob(${JSON.stringify(f.b64)}), (c) => c.charCodeAt(0)); document.querySelector('.backup-pick').click()`);
  await waitFor(page, "document.querySelector('.backup-step2').style.display !== 'none'");
  await type(page, '.backup-open-pass', 'не та фраза');
  await page.eval("document.querySelector('.backup-open').click()");
  await waitFor(page, "/не підходить/.test(document.querySelector('.backup-open-said').textContent)", 80);
  const wrong = await page.eval("document.querySelector('.backup-open-said').textContent");
  check('a wrong passphrase is refused kindly', /Ключ-фраза не підходить/.test(wrong), wrong);
  await type(page, '.backup-open-pass', PASS);
  await page.eval("document.querySelector('.backup-open').click()");
  const offered = await waitFor(page, "document.querySelector('.backup-replace')", 80);
  const both = await page.eval("!!document.querySelector('.backup-both')");
  check('the copy opens and offers to replace this world or keep both', offered && both);
  await page.eval("document.querySelector('.backup-replace').click()");
  await page.sleep(200);
  const confirm = await page.eval("document.querySelector('.backup-confirm')?.textContent ?? ''");
  check('replacing asks once more, plainly', /заміниться копією/.test(confirm), confirm);
  await page.eval("document.querySelector('.backup-yes').click()");
  await page.sleep(2500);
  await ready(page);
  const after = await digest(page);
  check('world B is now world A (the same state)', after === before, `${after.slice(0, 160)} vs ${before.slice(0, 160)}`);
  const atRest = await page.eval(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('teul-${B}'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = async (s) => new Promise((res) => { const q = db.transaction(s, 'readonly').objectStore(s).getAll(); q.onsuccess = () => res(q.result); });
    const text = JSON.stringify([await all('meta'), await all('events'), await all('snapshots')]);
    db.close();
    const ls = JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
    return JSON.stringify({ name: text.includes('Богдан'), kinds: text.includes('PlayerNamed'), sealed: text.includes('"sealed"'), keysPlain: /teul\\.net\\.keys"/.test(ls) && !/teul\\.sealed:/.test(ls) });
  })()`);
  const r = JSON.parse(atRest);
  check('the save at rest is sealed (nothing readable in IndexedDB)', r.sealed && !r.name && !r.kinds, atRest);
  const daily = await page.eval("window.__teul.game && JSON.stringify(true)");
  check('the game runs on after the restore', daily === 'true');

  // ---- world C: the copy kept beside it as a second world
  await page.goto(`${BASE}?world=${C}&debug&skip`);
  await ready(page);
  await openBackup(page);
  await page.eval(`window.__teulPick = Uint8Array.from(atob(${JSON.stringify(f.b64)}), (c) => c.charCodeAt(0)); document.querySelector('.backup-pick').click()`);
  await waitFor(page, "document.querySelector('.backup-step2').style.display !== 'none'");
  await type(page, '.backup-open-pass', PASS);
  await page.eval("document.querySelector('.backup-open').click()");
  await waitFor(page, "document.querySelector('.backup-both')", 80);
  await page.eval("document.querySelector('.backup-both').click()");
  await page.sleep(200);
  await page.eval("document.querySelector('.backup-yes').click()");
  await page.sleep(2500);
  await ready(page);
  const reg = await page.eval(`(async () => {
    const r = JSON.parse(localStorage.getItem('teul.worlds') ?? 'null');
    const dbs = (await indexedDB.databases?.())?.map((d) => d.name) ?? [];
    const copy = r?.list?.find((w) => w.id !== 'main');
    return JSON.stringify({ n: r?.list?.length ?? 0, active: r?.active, copy: copy?.name, db: copy ? dbs.includes('teul-w' + copy.id) : false });
  })()`);
  const g = JSON.parse(reg);
  check('keeping both makes a second world on the device (and opens it)', g.n >= 2 && g.db && g.active !== 'main' && /^Копія від/.test(g.copy ?? ''), reg);
  // let the device be as it was for other suites: the first world opens again
  await page.eval("(() => { const r = JSON.parse(localStorage.getItem('teul.worlds')); r.active = 'main'; localStorage.setItem('teul.worlds', JSON.stringify(r)); })()");
  check('no errors in the console', (await page.errors()).length === 0, JSON.stringify(await page.errors()));
});

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
