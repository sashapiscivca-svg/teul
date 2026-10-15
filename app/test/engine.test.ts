import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadEngine } from '../src/engine';

const pack = readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8');
const wasm = readFileSync(new URL('../src/wasm/teul_wasm_bg.wasm', import.meta.url));

function make(events: unknown[] = []) {
  return loadEngine({ packs: [pack], device: 1, seed: 7, epochUnixSecs: 1_700_000_000, events: events as never, wasm });
}

describe('GameEngine', () => {
  it('starts with the start coins and the start room', async () => {
    const e = await make();
    expect(e.wallet().coins).toBe(300);
    expect(e.room().cells).toHaveLength(100);
    expect(e.room().styles.floor).toBe('floor.oak');
  });

  it('acquires and places an item', async () => {
    const e = await make();
    expect(e.command({ type: 'acquire', item: 'fern' }, 10).ok).toBe(true);
    const placed = e.command({ type: 'place', item: 'fern', x: 1, y: 1, rot: 0 }, 11);
    expect(placed.ok).toBe(true);
    expect(e.room().placements).toHaveLength(1);
    expect(e.inventory().find((i) => i.item === 'fern')?.placed).toBe(1);
  });

  it('reports a locked purchase with what is missing and changes nothing', async () => {
    const e = await make();
    const r = e.command({ type: 'acquire', item: 'piano' }, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('locked');
      // the piano was 350 coins and 3 pages; tokens are earned nowhere now, so a token counts 30 coins
      expect(r.error.missing).toContainEqual(expect.objectContaining({ type: 'coins', need: 440 }));
    }
    expect(e.drain()).toHaveLength(0);
  });

  it('previews a command without applying it', async () => {
    const e = await make();
    expect(e.can({ type: 'acquire', item: 'fern' }, 10).ok).toBe(true);
    expect(e.inventory()).toHaveLength(0);
    expect(e.can({ type: 'acquire', item: 'piano' }, 10).ok).toBe(false);
  });

  it('drains events once and reproduces the world from them', async () => {
    const e = await make();
    e.command({ type: 'acquire', item: 'fern' }, 10);
    e.command({ type: 'place', item: 'fern', x: 2, y: 2, rot: 0 }, 11);
    e.command({ type: 'perform', action: 'water_plant', pid: 0 }, 12);
    const events = e.drain();
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(e.drain()).toHaveLength(0);
    const again = await make(events);
    expect(again.room()).toEqual(e.room());
    expect(again.wallet()).toEqual(e.wallet());
    expect(again.wallet().coins).toBe(290); // the fern cost 10
  });

  it('caches a catalog with models and fixtures', async () => {
    const e = await make();
    expect(e.catalog.items.sofa3.model.length).toBeGreaterThanOrEqual(3);
    expect(e.catalog.materials.gloss.kind).toBe('gloss');
    expect(Object.values(e.catalog.items).some((i) => i.tags.includes('door'))).toBe(true);
    expect(e.catalog.palettes.fabric.length).toBeGreaterThan(3);
  });

  it('reports the calendar for a world minute', async () => {
    const e = await make();
    const w = e.world(1440 * 30 + 125);
    expect(w.day).toBe(30);
    // seasons follow the real calendar: a world first opened on 2023-11-14 is in early winter 30 days on
    expect(w.season).toBe('Winter');
    expect(w.season_phase).toBe(0);
  });

  it('turns the current time into world minutes', async () => {
    const e = await make();
    expect(e.nowMinutes()).toBeGreaterThan(0);
    expect(e.minutesAt(1_700_000_000_000 + 125_000)).toBe(2);
  });

  it('rejects an unusable content pack list', async () => {
    await expect(
      loadEngine({ packs: ['not json'], device: 1, seed: 1, epochUnixSecs: 0, events: [], wasm }),
    ).rejects.toThrow();
  });
});

describe('the world economy through the engine', () => {
  const secret = 123456789;
  const mk = (events: unknown[] = []) => loadEngine({ packs: [pack], device: 1, seed: 7, epochUnixSecs: 1_700_000_000, events: events as never, wasm, secret });

  it('knows where the player is, and a locked place says why', async () => {
    const e = await mk();
    expect(e.locations(10).location).toBe('home');
    const cave = e.locations(10).places.cave;
    expect(cave.open).toBe(false);
    expect(cave.hint.length).toBeGreaterThan(0);
    const r = e.command({ type: 'travel', to: 'cave' }, 10);
    expect(r.ok).toBe(false);
    expect(e.command({ type: 'travel', to: 'village' }, 11).ok).toBe(true);
    expect(e.locations(11).location).toBe('village');
  });

  it('has a pocket, places to use, help and a morning paper', async () => {
    const e = await mk();
    const pocket = e.pocket();
    expect(pocket.capacity).toBe(64); // the inventory: up to 64 kinds
    expect(pocket.used).toBe(0);
    expect(e.stations(600).length).toBeGreaterThan(20);
    expect(e.helps(600).some((h) => h.available)).toBe(true);
    const paper = e.paper(600);
    expect(paper.title).toBe('Липовий вісник');
    expect(paper.date).toMatch(/^\d+ [а-яіїєґ']+$/);
  });

  it('a save reopens whole, and an event written into it by hand is left out', async () => {
    const e = await mk();
    e.command({ type: 'travel', to: 'village' }, 10);
    e.command({ type: 'acquire', item: 'fern' }, 11);
    const events = e.drain();
    expect(events.every((ev) => (ev.chain ?? 0) > 0)).toBe(true);
    expect((await mk(events)).integrity().tampered).toBe(0);
    const last = events[events.length - 1];
    const forged = [...events, { ...last, id: { device: 1, seq: last.id.seq + 1 }, kind: { type: 'CoinsEarned', amount: 5000 } }];
    const opened = await mk(forged);
    expect(opened.integrity().tampered).toBe(1);
    expect(opened.wallet().coins).toBe((await mk(events)).wallet().coins);
  });
});

describe('views asked again', () => {
  it('are not recomputed for the same minute until something changes', async () => {
    const e = await make();
    const a = e.world(600);
    expect(e.world(600)).toBe(a);
    expect(e.world(601)).not.toBe(a);
    const life = e.life(600);
    expect(e.life(600)).toBe(life);
    e.command({ type: 'set_setting', key: 'time_mode', value: 'fixed' }, 602);
    // a command may change anything: asked again, it is the world as it is now
    expect(e.world(600)).not.toBe(a);
    expect(e.world(600)).toEqual(a);
  });
});

describe('the plant beyond the fields', () => {
  it('the title screen keeps the same days as the core', async () => {
    const { plantOn } = await import('../src/nppdates');
    const engine = await make();
    for (let t = 0; t < 9 * 365 * 1440; t += 23 * 1440 + 17) {
      const c = engine.calendarDay(t);
      const day = Math.floor(Date.UTC(c.year, c.month - 1, c.day) / 86_400_000);
      const core = engine.npp(t);
      const mine = plantOn(day);
      expect(mine ? { stage: mine.stage, id: mine.id, built: mine.built } : null).toEqual(core ? { stage: core.stage, id: core.id, built: core.built } : null);
    }
  });
});
