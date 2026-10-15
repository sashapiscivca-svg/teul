import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { animalMovers, Drives, postsInside, residentPose, roadRoom, tripMover } from '../src/life';
import type { Catalog, LocationDef, ResidentView, RoomView, SiteDef } from '../src/types';
import { locationRoom, Routes } from '../src/village';

const pack = JSON.parse(readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8'));
const catalog = {
  items: Object.fromEntries(pack.items.map((i: { id: string }) => [i.id, { tags: [], actions: [], rules: { provides_surface: false }, ...i }])),
  styles: Object.fromEntries(pack.styles.map((s: { id: string }) => [s.id, s])),
} as unknown as Catalog;
const home = { settings: {}, style_params: {} } as unknown as RoomView;
const village: LocationDef = pack.locations.find((l: LocationDef) => l.id === 'village');
const sites: Record<string, SiteDef> = {};
const siteLocation: Record<string, string> = {};
for (const l of pack.locations as LocationDef[]) for (const s of l.sites ?? []) {
  sites[s.id] = s;
  siteLocation[s.id] = l.id;
}
const loc = locationRoom(village, catalog, home);
const routes = new Routes(loc, catalog);
const ctx = { routes, here: village, sites, siteLocation };

function resident(over: Partial<ResidentView>): ResidentView {
  return { id: 'res_1', name: 'Оксана', gender: 'f', age: 'adult', site: 'grocery', from: 'home_1', since: 1000, activity: 'shop', mood: 0, ...over };
}

describe('residents on the map', () => {
  it('walk from the last site to the next and then go indoors', () => {
    const walking = residentPose(resident({}), 1000 + 1 / 60, ctx);
    expect(walking.visible && walking.walking).toBe(true);
    const inside = residentPose(resident({ activity: 'shop' }), 1100, ctx);
    expect(inside.visible).toBe(false);
  });

  it('stroll in the open where the site has a yard, and stand round a fire', () => {
    const square = residentPose(resident({ site: 'square_site', activity: 'leisure' }), 1100, ctx);
    expect(square.visible).toBe(true);
    const [ax, ay, aw, ah] = sites.square_site.area!;
    expect(square.x).toBeGreaterThanOrEqual(ax - 1);
    expect(square.y).toBeLessThanOrEqual(ay + ah + 1);
    expect(square.x).toBeLessThanOrEqual(ax + aw + 1);
    const fighter = residentPose(resident({ site: 'bakery', activity: 'firefight' }), 1100, ctx);
    expect(fighter.visible).toBe(true);
  });

  it('leaving for another place they walk to the road out of town, not vanish on the spot', () => {
    const leaving = residentPose(resident({ site: 'forest_glade_site', from: 'grocery', activity: 'leisure' }), 1000 + 2 / 60, ctx);
    expect(leaving.visible && leaving.walking).toBe(true);
    // and once on the road out they are gone
    expect(residentPose(resident({ site: 'forest_glade_site', from: 'grocery', activity: 'leisure' }), 1000 + 600, ctx).visible).toBe(false);
  });

  it('are not drawn in another location', () => {
    expect(residentPose(resident({ site: 'forest_glade_site', from: 'forest_glade_site' }), 1100, ctx).visible).toBe(false);
  });
});

describe('vehicles and animals', () => {
  const drives = new Drives(roadRoom(loc.room), catalog);

  it('a cart drives the roads to its stop, waits, and drives back', () => {
    const trip = { kind: 'cart' as const, from: 'farm', to: 'grocery', depart: 1000, arrive: 1050 };
    const start = tripMover(trip, 1000, ctx, drives);
    expect(start?.item).toBe('horse_cart');
    const later = tripMover(trip, 1000 + 5 / 60, ctx, drives);
    expect(Math.hypot((later?.x ?? 0) - (start?.x ?? 0), (later?.y ?? 0) - (start?.y ?? 0))).toBeGreaterThan(5);
    expect(tripMover(trip, 1000 + 60, ctx, drives)).toBeNull();
  });

  it('vehicles keep to the roads (never the pavements, the square or a footpath to a door) and to their own side', () => {
    const trip = { kind: 'car' as const, from: 'grocery', to: 'school_site', depart: 1000, arrive: 1010 };
    const seen = new Set<string>();
    for (let s = 0; s < 120; s += 0.5) {
      const m = tripMover(trip, 1000 + s / 60, ctx, drives);
      if (!m || !m.moving) continue;
      const style = loc.room.floor_paint[`${Math.floor(m.x - (m.heading?.[1] ?? 0) * -0.32)},${Math.floor(m.y - (m.heading?.[0] ?? 0) * 0.32)}`];
      seen.add(style);
    }
    for (const st of seen) expect(['floor.cobble', 'floor.dirt', 'floor.deck', 'floor.gravel']).toContain(st);
    // going and coming back, a car passes the same place on the other side of the road
    const out = tripMover(trip, 1000 + 2 / 60, ctx, drives)!;
    const total = (() => { for (let s = 3; s < 600; s += 0.25) { const m = tripMover(trip, 1000 + s / 60, ctx, drives); if (m && m.moving && m.heading && out.heading && m.heading[0] * out.heading[0] + m.heading[1] * out.heading[1] < -0.9 && Math.hypot(m.x - out.x, m.y - out.y) < 0.8) return m; } return null; })();
    if (total) expect(Math.hypot(total.x - out.x, total.y - out.y)).toBeGreaterThan(0.3);
  });

  it('water birds keep to the water and the rest to dry land', () => {
    const free = () => true;
    const movers = animalMovers(village.animals ?? [], 1234, 'day', loc.water, free);
    const ducks = movers.filter((m) => m.item === 'duck' || m.item === 'swan');
    expect(ducks.length).toBeGreaterThan(0);
    for (const d of ducks) expect(loc.water.has(`${Math.floor(d.x)},${Math.floor(d.y)}`)).toBe(true);
    const night = animalMovers(village.animals ?? [], 1234, 'night', loc.water, free);
    expect(night.some((m) => m.item === 'chicken')).toBe(false);
  });
});

describe('inside the buildings', () => {
  const school: LocationDef = pack.locations.find((l: LocationDef) => l.id === 'school_in');
  const inside = locationRoom(school, catalog, home);
  const insideCtx = { routes: new Routes(inside, catalog), here: school, sites, siteLocation };

  it('a room inside a building has walls of its own and things on them', () => {
    expect(inside.room.style_params.wall).toBeDefined();
    expect(inside.room.style_params.weather).toBeUndefined();
    expect(inside.room.placements.some((p) => p.wall === 'north' && p.item === 'blackboard')).toBe(true);
  });

  it('the teacher stands at the front and the pupils at their desks, one to a place', () => {
    const people = [
      resident({ id: 'res_9', site: 'school_site', from: 'school_site', activity: 'school' }),
      resident({ id: 'res_2', site: 'school_site', from: 'school_site', activity: 'work' }),
      resident({ id: 'res_5', site: 'school_site', from: 'school_site', activity: 'school' }),
      resident({ id: 'res_7', site: 'grocery', from: 'grocery', activity: 'shop' }),
      resident({ id: 'res_8', site: 'school_site', from: 'home_1', since: 999.5, activity: 'school' }),
    ];
    const posts = postsInside(school, people, 1000);
    expect(posts.get('res_2')).toEqual(school.posts![0]);
    expect(posts.has('res_9') && posts.has('res_5')).toBe(true);
    expect(posts.has('res_7')).toBe(false);
    expect(posts.has('res_8')).toBe(false); // still coming in through the door
    const cells = [...posts.values()].map((p) => p.join(','));
    expect(new Set(cells).size).toBe(cells.length);
    const pose = residentPose(people[1], 1000, { ...insideCtx, posts });
    expect(pose.visible).toBe(true);
    expect(Math.floor(pose.x)).toBe(school.posts![0][0]);
    expect(residentPose(people[3], 1000, { ...insideCtx, posts }).visible).toBe(false);
  });

  it('the dump shows more heaps the fuller it is', () => {
    const dump: LocationDef = pack.locations.find((l: LocationDef) => l.id === 'dump');
    const empty = locationRoom(dump, catalog, home, 0).room.placements.length;
    const half = locationRoom(dump, catalog, home, 50).room.placements.length;
    const full = locationRoom(dump, catalog, home, 110).room.placements.length;
    expect(empty).toBeLessThan(half);
    expect(half).toBeLessThan(full);
  });
});

describe('how the townsfolk move', () => {
  const leaving = (id: string) => resident({ id, site: 'square_site', from: 'home_1', since: 1000, activity: 'leisure' });

  it('a slow walker has gone less far than a quick one in the same time', () => {
    const quick = residentPose(leaving('res_1'), 1000 + 6 / 60, { ...ctx, speedOf: () => 1.4 });
    const slow = residentPose(leaving('res_1'), 1000 + 6 / 60, { ...ctx, speedOf: () => 0.7 });
    const start = residentPose(leaving('res_1'), 1000, ctx);
    const gone = (p: { x: number; y: number }) => Math.hypot(p.x - start.x, p.y - start.y);
    expect(quick.walking && slow.walking).toBe(true);
    expect(gone(slow)).toBeLessThan(gone(quick) * 0.7);
  });

  it('a couple walks side by side, and strolls together once there', () => {
    const partnerOf = (id: string) => ({ res_1: 'res_2', res_2: 'res_1' })[id];
    const c = { ...ctx, partnerOf };
    for (const minutes of [1000 + 5 / 60, 1000 + 40]) {
      const a = residentPose(leaving('res_1'), minutes, c);
      const b = residentPose(leaving('res_2'), minutes, c);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      expect(d).toBeGreaterThan(0.2);
      expect(d).toBeLessThan(0.9);
    }
  });
});

describe('the postman', () => {
  it('stands at the door of the house he brings the post to', () => {
    const at = residentPose(resident({ id: 'res_9', site: 'home_1', from: 'home_1', since: 1000, activity: 'work' }), 1003, ctx);
    const door = sites.home_1;
    expect(at.visible).toBe(true);
    expect(Math.hypot(at.x - (door.x + 0.5), at.y - (door.y + 1.5))).toBeLessThan(1.6);
  });
});
