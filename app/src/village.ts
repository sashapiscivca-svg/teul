// The world outside the home (the village, the forest): each map as a room the renderer already knows how to
// draw, where its people stand, stroll or walk right now (the engine says where they are; this file animates the
// way between places and the small moves within one), and what they say.

import { iceCells } from './warmth';
import { cellKey, STEP } from './geometry';
import { isRiftWorld, WORLD_LOOK } from './wonders/worlds';
import { findPath } from './path';
import type { Catalog, ExitDef, LocationDef, NpcDef, NpcView, PlaceDef, PlacementView, RoomView, LocationProp } from './types';
import { gridOf, settle } from './world';

/** Props of a location get placement ids from here up, so they never clash with the home's. */
export const VILLAGE_PID0 = 1_000_000;
/** Cells per second people walk at between places, and stroll at within one. */
export const NPC_SPEED = 1.5;
export const STROLL_SPEED = 0.8;
/** Seconds between small moves within a place. */
export const STROLL_EVERY = 9;
/** Friendship points per heart and the hearts needed to invite someone (as in the engine). */
export const POINTS_PER_HEART = 200;
export const INVITE_HEARTS = 2;
/** How long a visit lasts, in world minutes. */
export const VISIT_MINUTES = 120;

const CARRY = ['time_mode', 'time_fixed', 'ambient_color', 'ambient_strength', 'shadows'];

export interface LocationRoom {
  /** The map as a room for drawing and for the player (water can be swum in). */
  room: RoomView;
  /** Cells of water. */
  water: Set<string>;
  /** Cells of a lake or a pond frozen over today (walked and skated on; not water while it holds). */
  ice: Set<string>;
}

/** A location's map as a room: every cell, floors from the legend, props as placements. */
/**
 * A location as a room to walk in; `fill` is how full the dump is and `day` how old the world is (heaps and graves
 * that need more are left out).
 */
/** The dream of Lypove behind the rift. */
/** The old single Other Side (now the four worlds of wonders/worlds.ts). */
export const OTHER_SIDE = 'otherside';

/** A step of the land (half a level), in model units: one is walked up, two want a hop, more are a cliff. */
export { STEP };

export function locationRoom(v: LocationDef, catalog: Catalog, home: RoomView, fill = 0, day = Infinity, extra: LocationProp[] = [], rift = false, flags: ReadonlySet<string> = new Set(), frozen = false): LocationRoom {
  const cells: [number, number][] = [];
  const floor_paint: Record<string, string> = {};
  const water = new Set<string>();
  // in a frosty winter the lakes and ponds ice over (the rivers keep flowing)
  const ice = frozen && !v.inside && !v.underground ? iceCells(v.ice) : new Set<string>();
  for (let y = 0; y < v.h; y++) {
    const row = [...v.tiles[y]];
    for (let x = 0; x < v.w; x++) {
      // solid rock (a cave's): no floor there at all, so its walls follow the hollow
      if (v.legend[row[x]] === 'void') continue;
      cells.push([x, y]);
      const style = v.legend[row[x]] ?? 'floor.grass';
      const k = cellKey(x, y);
      if (style === 'floor.water' && ice.has(k)) {
        floor_paint[k] = 'floor.ice';
        continue;
      }
      ice.delete(k);
      floor_paint[k] = style;
      // other waters say so in their style
      if (style === 'floor.water' || catalog.styles[style]?.params.water === '1') water.add(k);
    }
  }
  // the feasts' decorations stand like any other thing of the place (people and carts go round them)
  const placements: PlacementView[] = [...v.props, ...extra].flatMap((p, i) => {
    if ((p.min_fill ?? 0) > fill || (p.min_day ?? 0) > day) return [];
    // a crack to the Other Side stands only on the rift days
    if (p.rift && !rift) return [];
    // what the town built, opened or put up for a while, shown while it holds (and the old thing it replaced, not)
    if ((p.flag && !flags.has(p.flag)) || (p.unflag && flags.has(p.unflag))) return [];
    const def = catalog.items[p.item];
    const colors: Record<string, string> = {};
    for (const [slot, s] of Object.entries(def?.slots ?? {})) colors[slot] = s.default;
    // a storm took the power out: the street lamps stay dark tonight
    const dark = flags.has('outage') && !v.inside && !!def?.tags.includes('light');
    return [{ pid: VILLAGE_PID0 + i, item: p.item, x: p.x, y: p.y, rot: p.rot ?? 0, wall: p.wall ?? null, on: null, colors: { ...colors, ...(p.colors ?? {}) }, props: (dark ? { lit: '0' } : {}) as Record<string, string>, known: !!def }];
  });
  const settings: Record<string, string> = { wall_mode: 'cut' };
  for (const k of CARRY) if (home.settings[k] !== undefined) settings[k] = home.settings[k];
  const style_params: Record<string, Record<string, string>> = { floor: catalog.styles['floor.grass']?.params ?? {} };
  if (home.style_params.backdrop) style_params.backdrop = home.style_params.backdrop;
  // indoors there is no weather, and the walls are the building's own
  if (home.style_params.weather && !v.inside && !v.underground) style_params.weather = home.style_params.weather;
  if (v.wall) style_params.wall = catalog.styles[v.wall]?.params ?? {};
  // underground it is always night: only the torches, the crystals and the mushrooms give light
  if (v.underground) style_params.backdrop = catalog.styles['backdrop.void']?.params ?? { kind: 'void' };
  if (v.underground) Object.assign(settings, { time_mode: 'fixed', time_fixed: '01:00', ambient_color: '#6a5aa0', ambient_strength: '30' });
  // the worlds behind the rifts: each its own sky and its own light, the same hour all day long
  const world = isRiftWorld(v.id) ? WORLD_LOOK[v.id] : null;
  if (world) {
    style_params.backdrop = catalog.styles[`backdrop.${world.backdrop}`]?.params ?? { kind: world.backdrop };
    delete style_params.weather;
    Object.assign(settings, { time_mode: 'fixed', time_fixed: world.time, ambient_color: world.ambient, ambient_strength: world.strength });
  }
  // the lie of the land: a step is 15 (a hop goes over two)
  let terrain: Record<string, number> | undefined;
  if (v.heights?.length) {
    terrain = {};
    for (let y = 0; y < v.heights.length; y++) {
      const row = v.heights[y];
      for (let x = 0; x < row.length; x++) {
        const h = parseInt(row[x], 36) || 0;
        if (h) terrain[`${x},${y}`] = h * STEP;
      }
    }
  }
  const room: RoomView = {
    terrain,
    cells,
    styles: { floor: 'floor.grass' },
    style_params,
    placements,
    floor_paint,
    wall_paint: {},
    dividers: [],
    settings,
    area_budget: cells.length,
    cell_price: 0,
    area_used: cells.length,
  };
  return { room, water, ice };
}

/** The same room for those who keep to dry land (people's routes, the pet): water blocks. */
export function dryRoom(r: LocationRoom): RoomView {
  return { ...r.room, blocked: [...r.water].map((k) => k.split(',').map(Number) as [number, number]) };
}

/** The way out of a location that leads to another one, if there is one. */
export function exitTo(v: LocationDef, to: string): ExitDef | undefined {
  return v.exits.find((e) => e.to === to);
}

/** The way out that a floor point stands in, if any. */
export function exitAt(v: LocationDef, x: number, y: number): ExitDef | undefined {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  return v.exits.find((e) => cx >= e.x && cy >= e.y && cx < e.x + e.w && cy < e.y + e.h);
}

export type PartOfDay = 'morning' | 'day' | 'evening' | 'night';

export function partOfDay(minuteOfDay: number): PartOfDay {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  if (m >= 300 && m < 660) return 'morning';
  if (m >= 660 && m < 1020) return 'day';
  if (m >= 1020 && m < 1320) return 'evening';
  return 'night';
}

export function mix(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A number from a person's id, to give each their own rhythm. */
export function idSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * What someone says now. Lines that fit the moment (their friendship, the part of the day, where they are) are
 * preferred over general ones; each talk of a day moves on to another line.
 */
export function pickLine(def: NpcDef, view: NpcView, minuteOfDay: number, day: number, visiting: boolean): string {
  const part = partOfDay(minuteOfDay);
  const where = visiting ? 'home' : view.place;
  const fits = def.lines.filter((l) => (l.hearts ?? 0) <= view.hearts && (!l.when || l.when === part) && (!l.at || l.at === where));
  if (fits.length === 0) return '…';
  const special = fits.filter((l) => l.when || l.at || (l.hearts ?? 0) > 0);
  // the first talk of a day favours what fits the moment; later talks go through everything that fits
  const pool = view.talks_today === 0 && special.length > 0 ? special : fits;
  const i = mix(day * 31 + view.talks_today, def.id.length * 7 + def.id.charCodeAt(0)) % pool.length;
  return pool[i].text;
}

export interface NpcPose {
  x: number;
  y: number;
  walking: boolean;
  /** Direction of travel in world cells (for facing). */
  dx: number;
  dy: number;
  /** Out and about here (not indoors at home, not in another location, not visiting the player). */
  visible: boolean;
}

/** Remembers routes and free spots of one location, so each is found once. */
export class Routes {
  private readonly cache = new Map<string, [number, number][]>();
  private readonly spots = new Map<string, [number, number]>();
  readonly dry: RoomView;

  /** `dry`: the room as those who keep to dry land walk it (made from the place's water when not given). */
  constructor(readonly loc: LocationRoom, private readonly catalog: Catalog, dry?: RoomView) {
    this.dry = dry ?? dryRoom(loc);
  }

  /** A free spot on dry land at or next to a cell (props or water may cover the planned one). */
  spot(x: number, y: number): [number, number] {
    const key = `${x},${y}`;
    let s = this.spots.get(key);
    if (!s) {
      const p = { x: x + 0.5, y: y + 0.5 };
      settle(p, this.dry, this.catalog);
      s = [p.x, p.y];
      this.spots.set(key, s);
    }
    return s;
  }

  private freeCells: Set<string> | null = null;

  /** Whether a point stands on open dry ground (not in a prop, a building, the water, off the map). */
  free(x: number, y: number): boolean {
    if (!this.freeCells) {
      const grid = gridOf(this.dry, this.catalog);
      this.freeCells = new Set([...grid.cells].filter((k) => !grid.blocked.has(k)));
    }
    return this.freeCells.has(cellKey(Math.floor(x), Math.floor(y)));
  }

  route(key: string, from: [number, number], to: [number, number]): [number, number][] {
    let r = this.cache.get(key);
    if (!r) {
      const path = findPath(this.dry, this.catalog, [Math.floor(from[0]), Math.floor(from[1])], [[Math.floor(to[0]), Math.floor(to[1])]]);
      // no way there (cut off for now): one is simply there, rather than walking through walls
      r = path ? [from, ...path] : [to];
      if (this.cache.size > 1500) this.cache.clear();
      this.cache.set(key, r);
    }
    return r;
  }

  /** Free cells someone can stroll to within a place (swimmers may also go into the water next to their beach). */
  strollCells(place: PlaceDef, swimming = true): [number, number][] {
    const key = `stroll|${place.id}|${swimming}|${this.loc.ice.size}`;
    let out = this.cache.get(key);
    if (!out) {
      const grid = gridOf(this.dry, this.catalog);
      const swim = place.activity === 'swim' && swimming;
      // a frozen lake: the beach's people go out skating on it
      const skate = place.activity === 'swim' && this.loc.ice.size > 0;
      const pad = swim || skate ? 3 : 0;
      out = [];
      for (let y = place.y - pad; y < place.y + place.h + pad; y++) {
        for (let x = place.x - pad; x < place.x + place.w + pad; x++) {
          const k = cellKey(x, y);
          const inPlace = x >= place.x && y >= place.y && x < place.x + place.w && y < place.y + place.h;
          if (inPlace && grid.cells.has(k) && !grid.blocked.has(k)) out.push([x + 0.5, y + 0.5]);
          else if (swim && this.loc.water.has(k)) out.push([x + 0.5, y + 0.5]);
          else if (skate && this.loc.ice.has(k) && !grid.blocked.has(k)) out.push([x + 0.5, y + 0.5]);
        }
      }
      this.cache.set(key, out);
    }
    return out;
  }
}

function along(route: [number, number][], dist: number): { x: number; y: number; dx: number; dy: number; done: boolean } {
  let left = dist;
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1];
    const [bx, by] = route[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg && seg > 0) {
      const f = left / seg;
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: bx - ax, dy: by - ay, done: false };
    }
    left -= seg;
  }
  const [x, y] = route[route.length - 1];
  return { x, y, dx: 0, dy: 0, done: true };
}

function routeLength(route: [number, number][]): number {
  let n = 0;
  for (let i = 1; i < route.length; i++) n += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return n;
}

export interface PoseContext {
  routes: Routes;
  /** The location being shown. */
  here: LocationDef;
  places: Record<string, PlaceDef>;
  /** Whether it is swimming weather (a summer day, warm hours): otherwise swimmers walk the shore. */
  swim?: boolean;
}

/**
 * Where someone is drawn at `minutes` (world minutes, fractional). For the first moments of a part of the day
 * they walk from where they were (from the way in, if they come from another location); then they stroll about
 * their place every few seconds. Home is indoors, so they are hidden there.
 */
export function npcPose(view: NpcView, minutes: number, ctx: PoseContext): NpcPose {
  const hidden = { x: 0, y: 0, walking: false, dx: 0, dy: 0, visible: false };
  if (view.visiting || view.location !== ctx.here.id) return hidden;
  const { routes } = ctx;
  const place = ctx.places[view.place];
  const to = routes.spot(view.x, view.y);
  const fromExit = view.from_location !== ctx.here.id ? exitTo(ctx.here, view.from_location) : undefined;
  const from: [number, number] = fromExit ? [fromExit.x + fromExit.w / 2, fromExit.y + fromExit.h / 2] : routes.spot(view.from_x, view.from_y);
  const seconds = Math.max(0, (minutes - view.since) * 60);
  const route = routes.route(`${view.id}|${view.since}|${from[0]},${from[1]}`, from, to);
  const walkTime = routeLength(route) / NPC_SPEED;
  if (seconds < walkTime) {
    const at = along(route, seconds * NPC_SPEED);
    return { x: at.x, y: at.y, walking: true, dx: at.dx, dy: at.dy, visible: true };
  }
  if (place?.activity === 'home') return { x: to[0], y: to[1], walking: false, dx: 0, dy: 0, visible: false };
  // strolling: every few seconds a step to another free cell of the place (or a pause)
  const cells = place ? routes.strollCells(place, ctx.swim ?? true) : [];
  if (cells.length < 2) return { x: to[0], y: to[1], walking: false, dx: 0, dy: 0, visible: true };
  const seed = (idSeed(view.id) ^ view.since) >>> 0;
  const after = seconds - walkTime;
  const k = Math.floor(after / STROLL_EVERY);
  const target = (n: number): [number, number] => {
    // one move in three is a pause where they were
    let m = n;
    while (m >= 0 && mix(seed, m) % 3 === 0) m--;
    return m < 0 ? to : cells[mix(seed + 7, m) % cells.length];
  };
  const a = k > 0 ? target(k - 1) : to;
  const b = target(k);
  const t = after - k * STROLL_EVERY;
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01) {
    // around benches and trees, not through them (swimmers just swim)
    const swim = place?.activity === 'swim' && (ctx.swim ?? true);
    const path = swim ? [a, b] : routes.route(`stroll|${a[0]},${a[1]}|${b[0]},${b[1]}`, a, b);
    const walk = routeLength(path) / STROLL_SPEED;
    if (t < walk) {
      const at = along(path, t * STROLL_SPEED);
      return { x: at.x, y: at.y, walking: true, dx: at.dx, dy: at.dy, visible: true };
    }
  }
  return { x: b[0], y: b[1], walking: false, dx: 0, dy: 0, visible: true };
}

/** The NPC's own `look.*` settings, so the player's figure code can draw them. */
export function lookSettings(def: NpcDef): Record<string, string> {
  return Object.fromEntries(Object.entries(def.look).map(([k, v]) => [`look.${k}`, v]));
}

/** Pairs of people near each other at the same place, both standing still: they turn to each other and talk. */
export function chatPairs(poses: Map<string, NpcPose>, placeOf: Map<string, string>): [string, string][] {
  const idle = [...poses.entries()].filter(([, p]) => p.visible && !p.walking).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const used = new Set<string>();
  const out: [string, string][] = [];
  for (let i = 0; i < idle.length; i++) {
    const [a, pa] = idle[i];
    if (used.has(a)) continue;
    let best: string | null = null;
    let bestD = 3.2;
    for (let j = i + 1; j < idle.length; j++) {
      const [b, pb] = idle[j];
      if (used.has(b) || placeOf.get(a) !== placeOf.get(b)) continue;
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      used.add(a);
      used.add(best);
      out.push([a, best]);
    }
  }
  return out;
}

/** An icon over someone now and then, from what they do there (`time` in seconds). */
export function emoteFor(npc: string, activity: string, part: PartOfDay, time: number): string | null {
  const cycle = (time + (idSeed(npc) % 97)) % 11;
  if (cycle > 3) return null;
  if (npc === 'taras' && (activity === 'chat' || activity === 'cafe' || part === 'evening')) return 'play_music';
  if (npc === 'solomiia' && (activity === 'walk' || activity === 'swim' || activity === 'chat')) return 'paint';
  switch (activity) {
    case 'cafe':
      return 'brew_tea';
    case 'read':
      return 'read';
    case 'garden':
    case 'flowers':
      return 'water_plant';
    case 'gather':
      return 'harvest';
    case 'fish':
      return 'rest';
    case 'stars':
      return 'sun';
    case 'shop':
      return 'bag';
    default:
      return null;
  }
}
