// What people feel, end to end: moods on faces and in bubbles, a word that makes someone known, the people page
// in the notebook, a pair out on a date, two who are not speaking, a friend who waves and comes over.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/feel.mjs [shots-dir]
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
  await page.sleep(1200);
  await page.eval("(() => { const g = window.__teul.game; g.paperSheet?.close(); g.ask?.close(); g.journal?.close(); })()");
};

/** Minutes to add to reach `minute` of today. */
const toMinute = (page, minute) => page.eval(`(() => { const now = window.__teul.game.now(); const m = ((now % 1440) + 1440) % 1440; return (${minute} - m + 1440) % 1440 || 1440; })()`);

/** Goes to a location and stands at a cell (by the people to look at). */
const goTo = (page, loc, x, y) =>
  page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    if (g.location !== '${loc}') {
      if ('${loc}' === e.catalog.front) g.debugGo('village');
      else { g.debugGo('village'); await new Promise((r) => setTimeout(r, 600)); const def = e.catalog.locations['${loc}']; g.enterLocation('${loc}', def.entry ?? [${Math.floor(x)}, ${Math.floor(y)}]); }
      await new Promise((r) => setTimeout(r, 900));
    }
    g.debugTeleport(${x}, ${y});
    await new Promise((r) => setTimeout(r, 400));
    return g.location;
  })()`);

// ---- 1. a day in town: moods, faces, bubbles, a first word, the people page
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift = await toMinute(page, 12 * 60);
  await page.goto(`${BASE}?debug&skip&shift=${shift}`);
  await ready(page);
  await page.eval("window.__teul.game.debugGo('village')");
  await page.sleep(1500);
  const v = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.feelings(window.__teul.game.now()))'));
  const moods = new Set(v.residents.map((r) => r.mood));
  check('everyone in town has a mood of their own', v.residents.length > 40 && [...moods].every((m) => ['joyful', 'content', 'calm', 'tired', 'sleepy', 'sad', 'cross', 'in_love', 'unwell'].includes(m)), [...moods].join(','));
  check('moods differ from person to person', moods.size >= 3, [...moods].join(','));
  check('nobody is a friend yet in a new world', v.warmth.length === 0, JSON.stringify(v.warmth).slice(0, 200));
  // bubbles over heads, now and then, in colour
  const seen = await page.eval(`(async () => {
    const g = window.__teul.game;
    const out = new Set();
    for (let i = 0; i < 100 && out.size === 0; i++) {
      for (const f of g.residentFigures()) if (f.emoteColor) out.add(f.emote);
      await new Promise((r) => setTimeout(r, 250));
    }
    return [...out].join(',');
  })()`);
  check('feelings show over heads now and then', seen.length > 0, seen);
  // someone near: a word makes them known
  const who = await page.eval(`(() => {
    const g = window.__teul.game;
    const [id, p] = [...g.resPoses.entries()].find(([, p]) => p.visible && !p.walking) ?? [...g.resPoses.entries()][0] ?? [];
    if (!id) return '';
    g.debugTeleport(p.x + 1.2, p.y + 0.4);
    return id;
  })()`);
  check('someone is about in the village at noon', !!who);
  await page.sleep(500);
  const said = await page.eval(`(() => { const g = window.__teul.game; g.residentSays('${who}'); return g.saying.get('${who}')?.text ?? ''; })()`);
  check('they answer when spoken to', said.length > 5, said);
  const known = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.feelings(window.__teul.game.now() + 1).warmth.find((w) => w.id === '${who}') ?? null)`));
  check('after a word they know the player', known?.level === 'known', JSON.stringify(known));
  check('how things stand is told in words, not numbers', !!known && !/\d/.test(known.words) && !/\d/.test(known.today), JSON.stringify(known));
  if (SHOTS) {
    await page.eval('window.__teul.game.zoomBy(2.2)');
    await page.sleep(900);
    await page.shot(`${SHOTS}/feel-faces-day.png`);
    await page.eval('window.__teul.game.zoomBy(1 / 2.2)');
  }
  const journal = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.journal.open(window.__teul.engine.quests(g.now()), 'people');
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('.journal')?.textContent ?? '';
  })()`);
  const name = await page.eval(`window.__teul.engine.catalog.residents['${who}'].name`);
  check('the notebook has a page of people, with the one just met', journal.includes('Люди') && journal.includes(name), journal.slice(0, 300));
  if (SHOTS) await page.shot(`${SHOTS}/feel-journal-people.png`);
  await page.eval('window.__teul.game.journal.close()');
  check('no hearts counted anywhere', await page.eval("document.querySelectorAll('.hearts, .dlg-bar').length === 0"));
});

// ---- 2. an evening out: a pair courting walk together
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const found = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const now = g.now();
    const base = now - (((now % 1440) + 1440) % 1440);
    for (let k = 0; k < 200; k++) {
      for (const minute of [19 * 60 + 40, 20 * 60 + 5]) {
        const t = base + k * 1440 + minute;
        if (t <= now) continue;
        const f = e.feelings(t);
        const life = e.life(t);
        const site = Object.fromEntries(life.residents.map((r) => [r.id, r.site]));
        for (const r of f.residents) {
          if (!r.with) continue;
          const def = e.catalog.residents[r.id];
          if (def.partner === r.with) continue;
          const s = site[r.id];
          const loc = e.catalog.site_location[s];
          const area = e.catalog.sites[s]?.area;
          if (s && s === site[r.with] && area && loc === e.catalog.front) return JSON.stringify({ shift: t - now, a: r.id, b: r.with, site: s, loc, area });
        }
      }
    }
    return 'null';
  })()`));
  check('within months a pair goes out on a date', !!found, 'none found');
  if (found) {
    await page.goto(`${BASE}?debug&skip&shift=${found.shift}`);
    await ready(page);
    const [ax, ay, aw, ah] = found.area;
    await goTo(page, found.loc, ax + aw / 2, ay + ah / 2);
    await page.sleep(2500);
    // they may come from two homes, but once there they keep side by side
    const pair = JSON.parse(await page.eval(`(async () => {
      const g = window.__teul.game;
      let best = 99;
      let seen = null;
      for (let i = 0; i < 40; i++) {
        const a = g.resPoses.get('${found.a}');
        const b = g.resPoses.get('${found.b}');
        if (a && b) {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < best) { best = d; seen = { a, b }; }
          if (i === 0) g.debugTeleport((a.x + b.x) / 2 + 1.5, (a.y + b.y) / 2 + 1.5);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      return JSON.stringify({ best, seen });
    })()`));
    const d = pair.best;
    check('the two on a date keep together (side by side, as couples do)', d < 2.2, JSON.stringify(pair));
    const moods = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.feelings(window.__teul.game.now()).residents.filter((r) => r.id === '${found.a}' || r.id === '${found.b}').map((r) => r.mood))`));
    check('and they are in love (or at least glad)', moods.some((m) => m === 'in_love' || m === 'joyful' || m === 'content'), moods.join(','));
    if (SHOTS) {
      await page.eval('window.__teul.game.zoomBy(2.2)');
      await page.sleep(1800);
      await page.shot(`${SHOTS}/feel-date-evening.png`);
    }
  }
});

// ---- 3. two who are not speaking
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const found = JSON.parse(await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const now = g.now();
    const base = now - (((now % 1440) + 1440) % 1440);
    for (let k = 1; k < 120; k++) {
      for (const minute of [11 * 60, 13 * 60, 16 * 60 + 30, 18 * 60]) {
        const t = base + k * 1440 + minute;
        const f = e.feelings(t);
        const life = e.life(t);
        const site = Object.fromEntries(life.residents.map((r) => [r.id, r.site]));
        const act = Object.fromEntries(life.residents.map((r) => [r.id, r.activity]));
        for (const r of f.residents) {
          for (const o of r.cross ?? []) {
            const s = site[r.id];
            const area = e.catalog.sites[s]?.area;
            if (s && s === site[o] && area && e.catalog.site_location[s] === e.catalog.front && act[r.id] === 'leisure' && act[o] === 'leisure') return JSON.stringify({ shift: t - now, a: r.id, b: o, area });
          }
        }
      }
    }
    return 'null';
  })()`));
  check('now and then two people fall out and still meet in town', !!found, 'none found');
  if (found) {
    await page.goto(`${BASE}?debug&skip&shift=${found.shift}`);
    await ready(page);
    const [ax, ay, aw, ah] = found.area;
    await goTo(page, 'village', ax + aw / 2, ay + ah / 2);
    await page.sleep(1500);
    const glare = await page.eval(`(async () => {
      const g = window.__teul.game;
      const a = g.resPoses.get('${found.a}');
      const b = g.resPoses.get('${found.b}');
      if (a && b) g.debugTeleport((a.x + b.x) / 2 + 1.5, (a.y + b.y) / 2 + 1.5);
      let anger = false;
      for (let i = 0; i < 60 && !anger; i++) {
        anger = g.residentFigures().some((f) => (f.id === '${found.a}' || f.id === '${found.b}') && f.emote === 'anger');
        await new Promise((r) => setTimeout(r, 250));
      }
      const chatting = g.pairs.some((p) => p.includes('${found.a}') && p.includes('${found.b}'));
      return JSON.stringify({ anger, chatting, near: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null });
    })()`);
    const st = JSON.parse(glare);
    check('two who quarrelled do not chat together', !st.chatting, glare);
    check('and when close, they show they are cross', st.anger || (st.near ?? 99) >= 4, glare);
    if (SHOTS) {
      await page.eval('window.__teul.game.zoomBy(2.2)');
      await page.sleep(1200);
      await page.eval('window.__teul.game.ask.close()');
      await page.shot(`${SHOTS}/feel-quarrel.png`);
    }
  }
  const gossip = JSON.parse(await page.eval('JSON.stringify(window.__teul.engine.feelings(window.__teul.game.now()).gossip)'));
  check('the town talks about it', gossip.length > 0, JSON.stringify(gossip));
});

// ---- 4. a friend made over weeks: a warm hello, a wave, a secret
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip`);
  await ready(page);
  const shift0 = await toMinute(page, 11 * 60);
  // weeks of saying hello to the same person, a day at a time (the world's clock only goes forward)
  const friend = await page.eval(`(() => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const t0 = g.now() + ${shift0};
    e.command({ type: 'travel', to: e.catalog.front }, t0);
    const life = e.life(t0);
    const pick = life.residents.find((r) => r.age === 'adult' && e.catalog.residents[r.id]);
    for (let d = 0; d < 45; d++) {
      const r = e.command({ type: 'talk', npc: pick.id }, t0 + d * 1440);
      if (!r.ok) return 'fail ' + JSON.stringify(r.error);
    }
    g.persist();
    return pick.id;
  })()`);
  check('weeks of talks go through', !friend.startsWith('fail'), friend);
  await page.sleep(1500);
  await page.goto(`${BASE}?debug&skip&shift=${shift0 + 45 * 1440 + 30}`);
  await ready(page);
  const w = JSON.parse(await page.eval(`JSON.stringify(window.__teul.engine.feelings(window.__teul.game.now()).warmth.find((w) => w.id === '${friend}') ?? null)`));
  check('weeks of hellos make a close friend', w && (w.level === 'close' || w.level === 'dear'), JSON.stringify(w));
  check('a close friend shares a secret', !!w?.confide, JSON.stringify(w));
  check('a friend greets warmly, not as a stranger', !!w && !/^Добрий день\.$/.test(w.greet), w?.greet);
  const waved = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 40; i++) {
      const p = g.resPoses.get('${friend}');
      if (p) {
        g.debugTeleport(p.x + 4, p.y + 0.5);
        await new Promise((r) => setTimeout(r, 1200));
        return JSON.stringify({ text: g.saying.get('${friend}')?.text ?? '', waving: g.feel.waving('${friend}', g.time) });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return JSON.stringify({ text: '', where: 'not in the village' });
  })()`);
  const st = JSON.parse(waved);
  check('a friend a little way off waves and says hello', st.where === 'not in the village' || (st.waving && st.text.length > 3), waved);
  if (SHOTS && st.text) {
    await page.eval('window.__teul.game.zoomBy(2.2)');
    await page.eval('window.__teul.game.ask.close()');
    await page.sleep(300);
    await page.shot(`${SHOTS}/feel-friend-waves.png`);
  }
  const page2 = await page.eval(`(async () => {
    const g = window.__teul.game;
    g.ask.close();
    g.journal.open(window.__teul.engine.quests(g.now()), 'people');
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('.journal')?.textContent ?? '';
  })()`);
  check('the notebook tells of a close friend and their secret', page2.includes('По секрету'), page2.slice(0, 300));
  if (SHOTS) await page.shot(`${SHOTS}/feel-journal-friend.png`);
});

console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
