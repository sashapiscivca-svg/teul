import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Catalog, LocationDef, NpcDef, NpcView, PlaceDef, RoomView } from '../src/types';
import { gridOf } from '../src/world';
import { chatPairs, exitAt, locationRoom, NPC_SPEED, npcPose, partOfDay, pickLine, Routes, STROLL_EVERY, VILLAGE_PID0, type NpcPose } from '../src/village';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const catalog = {
  items: Object.fromEntries(pack.items.map((i: { id: string }) => [i.id, { tags: [], actions: [], rules: { provides_surface: false }, ...i }])),
  styles: Object.fromEntries(pack.styles.map((s: { id: string }) => [s.id, s])),
} as unknown as Catalog;
const home = { settings: { time_mode: 'fixed', time_fixed: '10:00', wall_mode: 'full' }, style_params: { backdrop: { kind: 'sky' } } } as unknown as RoomView;
const locations: Record<string, LocationDef> = Object.fromEntries(pack.locations.map((l: LocationDef) => [l.id, l]));
const village = locations.village;
const forest = locations.forest;
const places: Record<string, PlaceDef> = Object.fromEntries(pack.locations.flatMap((l: LocationDef) => l.places.map((p) => [p.id, p])));

function view(over: Partial<NpcView> = {}): NpcView {
  const sq = places.square;
  const cafe = places.cafe;
  return {
    location: 'village', from_location: 'village',
    id: 'marta', name: 'Марта', place: 'square', place_name: '', activity: 'chat', x: sq.x + 2, y: sq.y + 2, from_place: 'cafe', from_x: cafe.x + 1, from_y: cafe.y,
    since: 1000, until: 1200, arrives: 1020, visiting: false, visit: null, met: false, points: 0, hearts: 0, talked_today: false, talks_today: 0,
    gift_today: false, tastes: {}, received: [], ...over,
  };
}

describe('a location as a room', () => {
  const loc = locationRoom(village, catalog, home);

  it('has every cell, props as placements with their own ids, and the home time settings', () => {
    expect(loc.room.cells.length).toBe(village.w * village.h);
    // the cracks of the rift stand only on the rift days
    // (and what the town has not built or opened yet is not there)
    expect(loc.room.placements.length).toBe(village.props.filter((p) => !p.rift && !p.flag).length);
    expect(loc.room.placements.some((p) => p.item === 'rift_crack')).toBe(false);
    const riftDay = locationRoom(village, catalog, home, 0, Infinity, [], true);
    expect(riftDay.room.placements.some((p) => p.item === 'rift_crack')).toBe(true);
    expect(loc.room.placements.every((p) => p.pid >= VILLAGE_PID0 && p.known)).toBe(true);
    expect(loc.room.settings.time_mode).toBe('fixed');
    expect(loc.room.style_params.backdrop.kind).toBe('sky');
  });

  it('shows what the town built by its flags, hides what it replaced, and darkens the lamps in a power cut', () => {
    const built = locationRoom(village, catalog, home, 0, Infinity, [], false, new Set(['project:proj.bandstand:done', 'project:proj.library_roof:done', 'outage']));
    const items = (r: typeof built) => r.room.placements.map((p) => p.item);
    expect(items(loc)).not.toContain('bandstand');
    expect(items(built)).toContain('bandstand');
    // the library stands once either way: the old roof, or the mended one
    const libs = (r: typeof built) => r.room.placements.filter((p) => p.colors.roof === '#b84a32').length;
    expect(libs(loc)).toBe(0);
    expect(libs(built)).toBe(1);
    expect(built.room.placements.length).toBeLessThan(loc.room.placements.length + 20);
    const lamps = built.room.placements.filter((p) => p.item === 'lamp_street');
    expect(lamps.length).toBeGreaterThan(5);
    expect(lamps.every((p) => p.props.lit === '0')).toBe(true);
    expect(loc.room.placements.filter((p) => p.item === 'lamp_street').every((p) => p.props.lit !== '0')).toBe(true);
  });

  it('lets the player swim in the water but keeps people on dry land', () => {
    expect(loc.water.size).toBeGreaterThan(50);
    const [k] = [...loc.water];
    expect(gridOf(loc.room, catalog).blocked.has(k)).toBe(false);
    const routes = new Routes(loc, catalog);
    expect(gridOf(routes.dry, catalog).blocked.has(k)).toBe(true);
  });

  it('has a way to the forest and back', () => {
    const out = village.exits.find((e) => e.to === 'forest')!;
    expect(exitAt(village, out.x + 0.5, out.y + 0.5)?.to).toBe('forest');
    const back = forest.exits.find((e) => e.to === 'village')!;
    // arriving does not land in the way back
    expect(exitAt(forest, out.at[0] + 0.5, out.at[1] + 0.5)).toBeUndefined();
    expect(exitAt(village, back.at[0] + 0.5, back.at[1] + 0.5)).toBeUndefined();
  });
});

describe('where people are drawn', () => {
  const loc = locationRoom(village, catalog, home);
  const routes = new Routes(loc, catalog);
  const ctx = { routes, here: village, places };

  it('walks from the last place at the start of a part of the day, then strolls about the place', () => {
    const start = npcPose(view(), 1000, ctx);
    expect(start.walking).toBe(true);
    const later = npcPose(view(), 1000 + 2 / 60, ctx);
    expect(Math.hypot(later.x - start.x, later.y - start.y)).toBeGreaterThan(NPC_SPEED);
    const seen = new Set<string>();
    let walked = false;
    for (let s = 60; s < 60 + STROLL_EVERY * 12; s += 1) {
      const p = npcPose(view(), 1000 + s / 60, ctx);
      expect(p.visible).toBe(true);
      walked ||= p.walking;
      seen.add(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      const sq = places.square;
      expect(p.x).toBeGreaterThanOrEqual(sq.x - 1);
      expect(p.x).toBeLessThanOrEqual(sq.x + sq.w + 1);
    }
    expect(walked).toBe(true);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('comes in from the way out of another location', () => {
    const exit = village.exits.find((e) => e.to === 'forest')!;
    const p = npcPose(view({ from_location: 'forest' }), 1000, ctx);
    expect(Math.hypot(p.x - (exit.x + exit.w / 2), p.y - (exit.y + exit.h / 2))).toBeLessThan(1);
  });

  it('hides people at home, elsewhere, and while they visit the player', () => {
    const marta = places.home_marta;
    expect(npcPose(view({ place: 'home_marta', x: marta.x, y: marta.y }), 1100, ctx).visible).toBe(false);
    expect(npcPose(view({ location: 'forest' }), 1100, ctx).visible).toBe(false);
    expect(npcPose(view({ visiting: true }), 1100, ctx).visible).toBe(false);
  });
});

describe('people meeting', () => {
  const pose = (x: number, y: number, walking = false): NpcPose => ({ x, y, walking, dx: 0, dy: 0, visible: true });

  it('pairs people standing near each other at the same place, each only once', () => {
    const poses = new Map([['a', pose(1, 1)], ['b', pose(2, 1)], ['c', pose(2.5, 1.5)], ['d', pose(9, 9)], ['e', pose(1, 2, true)]]);
    const placeOf = new Map([['a', 'sq'], ['b', 'sq'], ['c', 'sq'], ['d', 'sq'], ['e', 'sq']]);
    expect(chatPairs(poses, placeOf)).toEqual([['a', 'b']]);
    placeOf.set('b', 'park');
    expect(chatPairs(poses, placeOf)).toEqual([['a', 'c']]);
  });
});

describe('what people say', () => {
  const def: NpcDef = {
    id: 'marta', name: 'Марта', look: {}, traits: {}, home: 'home_marta', likes: [], dislikes: [], gifts: [], about: '', chatter: [], greet: [], asks: [],
    lines: [{ text: 'привіт' }, { text: 'ранок', when: 'morning' }, { text: 'на площі', at: 'square' }, { text: 'друзі', hearts: 3 }, { text: 'в гостях', at: 'home' }],
  };

  it('says only what fits the moment, the place and the friendship', () => {
    const said = new Set<string>();
    for (let day = 0; day < 40; day++) for (let n = 0; n < 4; n++) said.add(pickLine(def, view({ talks_today: n }), 13 * 60, day, false));
    expect([...said].sort()).toEqual(['на площі', 'привіт']);
    expect(pickLine(def, view({ place: 'park' }), 13 * 60, 1, true)).toBe('в гостях');
  });

  it('names the parts of the day', () => {
    expect([6 * 60, 12 * 60, 19 * 60, 23 * 60, 2 * 60].map(partOfDay)).toEqual(['morning', 'day', 'evening', 'night', 'night']);
  });
});
