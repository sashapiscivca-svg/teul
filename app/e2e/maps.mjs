// «Мапи», end to end: opened from the phone and from the computer at home, a street map with the streets named and
// the hero's blue dot, search («кава», a person's name), a place's card with its hours, a walking route drawn, and
// a taxi called from the card at the price the card showed; the same ride costs more in the rain than on a clear
// day, with the reason said in words.
// Usage: npm run build:e2e, then vite preview; BASE=http://localhost:4173/ node e2e/maps.mjs
import { mkdirSync } from 'node:fs';
import { withFirefox } from '../../scripts/bidi.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = new URL('../../.shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
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

await withFirefox(async (page) => {
  await page.viewport?.(900, 420);
  await page.goto(`${BASE}?debug&skip&rich&world=maps`);
  await ready(page);

  // out in the town, the phone's apps
  const phone = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.debugGo('village');
    await new Promise((r) => setTimeout(r, 1200));
    g.phoneSheet.open();
    const app = [...document.querySelectorAll('.phone .phone-app')].find((b) => b.textContent.includes('Мапи'));
    app?.click();
    await new Promise((r) => setTimeout(r, 700));
    const m = g.mapsSheet;
    return JSON.stringify({ app: !!app, open: m.isOpen(), phoneClosed: !g.phoneSheet.isOpen(), hero: m.heroAt() });
  })()`));
  check('the phone has «Мапи» and it opens', phone.app && phone.open && phone.phoneClosed, JSON.stringify(phone));
  check('the hero is a dot on the map where they stand', !!phone.hero && phone.hero.loc === 'village', JSON.stringify(phone.hero));
  // the map is drawn: something more than the empty land on the canvas, streets named
  const drawn = JSON.parse(await page.eval(`(() => {
    const c = document.querySelector('.maps-canvas');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) colours.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    const streets = Object.entries(window.__teul.engine.catalog.locations.village.landmarks).filter(([k]) => k.endsWith('_street')).length;
    return JSON.stringify({ w: c.width, h: c.height, colours: colours.size, streets });
  })()`));
  check('a street map is drawn on the screen', drawn.w > 200 && drawn.colours > 12, JSON.stringify(drawn));
  check('the town’s streets have names', drawn.streets >= 8, String(drawn.streets));
  await page.shot(`${SHOTS}maps-1-town.png`);

  // search: «кава» finds the café; a person's name finds where they work
  const found = JSON.parse(await page.eval(`(async () => {
    const input = document.querySelector('.maps-input');
    input.value = 'кава';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    const coffee = [...document.querySelectorAll('.maps-result')].map((b) => b.dataset.key);
    const marta = Object.values(window.__teul.engine.catalog.residents).find((r) => r.job && r.job[0] === 'cafe_site');
    input.value = marta.name.split(' ')[0];
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    const person = [...document.querySelectorAll('.maps-result')].map((b) => b.dataset.key);
    input.value = 'аптека';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    const pharmacy = [...document.querySelectorAll('.maps-result')].map((b) => b.dataset.key);
    return JSON.stringify({ coffee, person, pharmacy, who: marta.id });
  })()`));
  check('«кава» finds the café', found.coffee.includes('site:cafe_site'), JSON.stringify(found.coffee));
  check('a name finds where that person works', found.person.includes(`person:${found.who}`), JSON.stringify(found.person));
  check('«аптека» finds the hospital', found.pharmacy.includes('site:hospital_site'), JSON.stringify(found.pharmacy));

  // the card: the cinema, its hours, a route drawn, the walk and the taxi
  const card = JSON.parse(await page.eval(`(async () => {
    const input = document.querySelector('.maps-input');
    input.value = 'Кінотеатр';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    document.querySelector('.maps-result[data-key="site:cinema_site"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const c = document.querySelector('.maps-card');
    const hours = c.querySelector('.maps-hours')?.textContent ?? '';
    c.querySelector('.maps-go').click();
    await new Promise((r) => setTimeout(r, 300));
    const m = window.__teul.game.mapsSheet;
    const walk = c.querySelector('.maps-walk')?.textContent ?? '';
    const taxi = c.querySelector('.maps-taxi');
    return JSON.stringify({ name: c.querySelector('.maps-card-name')?.textContent, hours, lines: m.route?.lines.length ?? 0, tiles: m.route?.tiles ?? 0, walk, fare: Number(taxi?.dataset.fare ?? 0), eta: Number(taxi?.dataset.eta ?? 0), text: taxi?.textContent ?? '' });
  })()`));
  check('a place card with its hours', card.name === 'Кінотеатр «Зоря»' && /\d\d:\d\d/.test(card.hours) && /Відчинено|Зачинено/.test(card.hours), JSON.stringify(card));
  check('«Маршрут» draws a walk along the streets, with its minutes', card.lines >= 1 && card.tiles > 10 && /Пішки ≈ \d+ хв/.test(card.walk), JSON.stringify(card));
  check('the card says the taxi’s price and how soon the car comes', card.fare >= 5 && card.eta >= 1 && card.text.includes('Викликати таксі'), JSON.stringify(card));
  await page.shot(`${SHOTS}maps-2-route.png`);

  // the same card: a few words about the place, the week's hours day by day, and its photos as the camera takes them
  const more = JSON.parse(await page.eval(`(async () => {
    const c = document.querySelector('.maps-card');
    for (let i = 0; i < 80 && c.querySelectorAll('.maps-photo img').length < c.querySelectorAll('.maps-photo').length; i++) await new Promise((r) => setTimeout(r, 250));
    const imgs = [...c.querySelectorAll('.maps-photo img')];
    const sizes = imgs.map((i) => [i.naturalWidth, i.naturalHeight]);
    const week = c.querySelector('.maps-week');
    week.querySelector('summary').click();
    await new Promise((r) => setTimeout(r, 100));
    const rows = [...week.querySelectorAll('tr')].map((r) => r.textContent);
    imgs[0]?.parentElement.click();
    await new Promise((r) => setTimeout(r, 100));
    const big = !!document.querySelector('.maps-big img');
    document.querySelector('.maps-big')?.click();
    return JSON.stringify({ about: c.querySelector('.maps-about')?.textContent ?? '', labels: [...c.querySelectorAll('.maps-photo span')].map((s) => s.textContent), photos: imgs.length, sizes, open: week.open, rows, today: week.querySelector('tr.today')?.textContent ?? '', big, left: !document.querySelector('.maps-big') });
  })()`));
  check('the card says a few words about the place', /попкорн/.test(more.about), more.about);
  check('the card has photos: outside, inside, in the evening', more.photos === 3 && more.labels.join() === 'Ззовні,Всередині,Увечері' && more.sizes.every(([w, h]) => w >= 300 && h >= 180), JSON.stringify(more));
  check('the week’s hours day by day, today marked', more.open && more.rows.length === 7 && more.rows[0].startsWith('Понеділок') && /12:00–00:00/.test(more.rows[3]) && !!more.today, JSON.stringify(more.rows));
  check('a photo touched shows big, and a touch puts it away', more.big && more.left, JSON.stringify(more));
  await page.shot(`${SHOTS}maps-2b-photos.png`);

  // «Хто коли працює»: what is open now, what opens when; a row opens the place's card
  const table = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const m = g.mapsSheet;
    document.querySelector('.maps-timetable').click();
    await new Promise((r) => setTimeout(r, 100));
    const c = document.querySelector('.maps-card');
    const openRows = [...c.querySelectorAll('.maps-slot')].map((r) => ({ site: r.dataset.site, em: r.querySelector('em').textContent }));
    c.querySelector('[data-filter="all"]').click();
    await new Promise((r) => setTimeout(r, 50));
    const allRows = [...c.querySelectorAll('.maps-slot')].map((r) => ({ site: r.dataset.site, em: r.querySelector('em').textContent }));
    const town = c.querySelector('.maps-slot[data-site="townhall_site"]');
    town?.click();
    await new Promise((r) => setTimeout(r, 100));
    return JSON.stringify({ minute: g.now() % 1440, openRows, all: allRows.length, sample: allRows.slice(0, 3), parks: allRows.some((r) => r.site === 'park_site'), picked: m.selected?.site ?? null });
  })()`));
  check('the timetable lists what is open now, each saying when it closes', table.openRows.every((r) => /Відчинено/.test(r.em)) && table.openRows.filter((r) => /зачиниться о \d\d:\d\d|Цілодобово/.test(r.em)).length === table.openRows.length, JSON.stringify(table));
  check('and everything that keeps hours, the shut ones saying when they open', table.all >= 30 && !table.parks && table.all >= table.openRows.length, JSON.stringify(table));
  check('a row of the timetable opens that place’s card', table.picked === 'townhall_site', JSON.stringify(table));

  // one's own home is on the maps: found by «дім», with a card, a pin at its door
  const home = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const m = g.mapsSheet;
    const input = document.querySelector('.maps-input');
    input.value = 'дім';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    const hit = document.querySelector('.maps-result[data-key="home:mine"]');
    hit?.click();
    await new Promise((r) => setTimeout(r, 200));
    const door = window.__teul.engine.taxiDestinations('village', 0, 0, g.now()).find((d) => d.id === 'taxi.home');
    const pin = m.pins().some((p) => p.key === 'home:mine');
    g.paperMap.open();
    const paper = g.paperMap.places.some((p) => p.key === 'home:mine');
    g.paperMap.close();
    return JSON.stringify({ found: !!hit, name: document.querySelector('.maps-card-name')?.textContent, at: m.selected && [m.selected.x, m.selected.y], door: door && [door.x, door.y], pin, paper });
  })()`));
  check('one’s own home is on the maps, found by «дім», at its door', home.found && home.name === 'Мій дім' && JSON.stringify(home.at) === JSON.stringify(home.door) && home.pin, JSON.stringify(home));
  check('and on the paper map', home.paper, JSON.stringify(home));

  // the paper map says it too, under the name of the place touched
  const paper = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.mapsSheet.close();
    g.paperMap.open();
    await new Promise((r) => setTimeout(r, 300));
    const cafe = g.paperMap.places.find((p) => p.site === 'cafe_site');
    g.paperMap.find(cafe);
    await new Promise((r) => setTimeout(r, 100));
    const line = document.querySelector('.paper-map-card .paper-map-hours')?.textContent ?? '';
    g.paperMap.close();
    // back to the cinema's card with its route, for the taxi below
    g.mapsSheet.open();
    g.mapsSheet.select(g.mapsSheet.places.find((p) => p.key === 'site:cinema_site'));
    g.mapsSheet.showRoute();
    await new Promise((r) => setTimeout(r, 200));
    return JSON.stringify({ line });
  })()`));
  check('the paper map says whether a place is open and when that changes', /^(Відчинено · зачиниться о 21:00|Зачинено · відчиниться (завтра )?о 07:00)$/.test(paper.line), paper.line);

  // the taxi from the card: paid exactly what the card said, and there
  const ride = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const before = window.__teul.engine.wallet().coins;
    const btn = document.querySelector('.maps-call');
    const fare = Number(document.querySelector('.maps-taxi').dataset.fare);
    btn.click();
    await new Promise((r) => setTimeout(r, 3200));
    return JSON.stringify({ paid: before - window.__teul.engine.wallet().coins, fare, closed: !g.mapsSheet.isOpen(), loc: g.location, x: g.walker.x, y: g.walker.y });
  })()`));
  check('«Викликати таксі» from the card: paid the price shown, the map closed', ride.paid === ride.fare && ride.closed, JSON.stringify(ride));
  check('the taxi brought the hero to the cinema', ride.loc === 'village' && Math.abs(ride.x - 58) + Math.abs(ride.y - 74) < 8, JSON.stringify(ride));

  // the price by the weather: the same ride, on a rainy minute and on a clear one (no feast, the same hour)
  const weather = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    const e = window.__teul.engine;
    const now = g.now();
    const at = (sky) => {
      for (let d = 1; d < 400; d++) {
        const t = (Math.floor(now / 1440) + d) * 1440 + 13 * 60 + 5;
        const day = e.dayView(t);
        if (JSON.parse(e.weatherAt(t)) === sky && !day.holiday && !(e.festival(t)?.phase === 'day')) return t;
      }
      return null;
    };
    const rain = at('rain');
    const clear = at('clear');
    const seen = {};
    const m = g.mapsSheet;
    for (const [sky, t] of [['rain', rain], ['clear', clear]]) {
      g.debugOffset += t - g.now();
      m.open();
      const input = document.querySelector('.maps-input');
      input.value = 'Пекарня';
      input.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 100));
      document.querySelector('.maps-result[data-key="site:bakery"]').click();
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector('.maps-card .maps-go').click();
      await new Promise((r) => setTimeout(r, 250));
      const taxi = document.querySelector('.maps-taxi');
      seen[sky] = { fare: Number(taxi?.dataset.fare ?? 0), why: taxi?.querySelector('.maps-why')?.textContent ?? '', chip: document.querySelector('.maps-weather')?.textContent ?? '' };
      if (sky === 'rain') await new Promise((r) => setTimeout(r, 400));
    }
    return JSON.stringify({ rain, clear, seen });
  })()`));
  await page.shot(`${SHOTS}maps-3-clear.png`);
  check('a ride costs more in the rain than on a clear day', weather.seen.rain.fare > weather.seen.clear.fare, JSON.stringify(weather));
  check('and the card says why in words', /Дощ/.test(weather.seen.rain.why) && /нижча/.test(weather.seen.clear.why), JSON.stringify(weather.seen));

  // the layers: traffic, today's events
  const layers = JSON.parse(await page.eval(`(async () => {
    const m = window.__teul.game.mapsSheet;
    document.querySelector('.maps-layers').click();
    document.querySelector('.maps-layer[data-layer="traffic"]').click();
    document.querySelector('.maps-layer[data-layer="events"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const today = [...document.querySelectorAll('.maps-today')].map((b) => b.textContent);
    return JSON.stringify({ traffic: m.layers.traffic, events: m.layers.events, today });
  })()`));
  check('the layers switch: traffic and today’s happenings', layers.traffic && layers.events && layers.today.length >= 2, JSON.stringify(layers));
  await page.shot(`${SHOTS}maps-4-layers.png`);
  await page.eval('window.__teul.game.mapsSheet.close()');
});

// the computer at home has «Мапи» too
await withFirefox(async (page) => {
  await page.goto(`${BASE}?debug&skip&rich&world=maps-pc`);
  await ready(page);
  const pc = JSON.parse(await page.eval(`(async () => {
    const g = window.__teul.game;
    g.media.desktop.open();
    await new Promise((r) => setTimeout(r, 200));
    const icon = document.querySelector('.pc-icon[data-app="maps"]');
    icon?.click();
    await new Promise((r) => setTimeout(r, 600));
    const m = g.mapsSheet;
    const input = document.querySelector('.maps-input');
    input.value = 'пошта';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 100));
    document.querySelector('.maps-result[data-key="site:post_site"]')?.click();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('.maps-card .maps-go')?.click();
    await new Promise((r) => setTimeout(r, 300));
    const note = document.querySelector('.maps-taxi-note')?.textContent ?? '';
    return JSON.stringify({ icon: !!icon, open: m.isOpen(), pcClosed: !g.media.desktop.isOpen(), hero: m.heroAt(), route: m.route?.tiles ?? 0, note });
  })()`));
  check('the computer has «Мапи»; it opens with home at one’s door', pc.icon && pc.open && pc.pcClosed && pc.hero?.loc === 'village', JSON.stringify(pc));
  check('from home: the walk is shown, the taxi says to step out first', pc.route > 0 && /вийди надвір/.test(pc.note), JSON.stringify(pc));
});

console.log(failed ? `${failed} FAILED` : 'ALL MAPS CHECKS PASSED');
process.exit(failed ? 1 : 0);
