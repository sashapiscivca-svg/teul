// The life of the settlement on the map: where each resident is (walking between places, about in a yard or a
// square, or out of sight indoors), the carts and cars on the roads, and the animals. The core decides where
// everyone is; this file only animates the way there and the small moves about a place.

import { cellKey } from './geometry';
import { findPath } from './path';
import type { AnimalDef, Catalog, LocationDef, ResidentView, RoomView, SiteDef, TripView } from './types';
import { exitTo, idSeed, mix, NPC_SPEED, type NpcPose, type Routes } from './village';

/** Cells a second for vehicles, and how long they stay at the destination before driving back (seconds). */
export const DRIVE_SPEED = 3.2;
const STAY: Record<string, number> = { fire_truck: 900, ambulance: 150, police: 240, cart: 60, car: 90, garbage: 45, taxi: 20, bike: 15, van: 40, grain: 60 };

/** What vehicles drive on: the streets, the tracks and the bridges (never the pavements, the square or the paths). */
const ROAD = new Set(['floor.cobble', 'floor.dirt', 'floor.deck', 'floor.gravel']);
/** Tiles a second: bicycles and the horse cart are slower than the cars. */
const SPEED: Record<string, number> = { bike: 1.7, cart: 1.6, grain: 2.6 };
/** Vehicles keep to the right half of the road. */
const LANE = 0.32;

export interface LifeContext {
  routes: Routes;
  here: LocationDef;
  sites: Record<string, SiteDef>;
  siteLocation: Record<string, string>;
  /** Inside a building: where each of its people stands (see postsInside). */
  posts?: Map<string, [number, number]>;
  /** How fast each walks (cells a second); the usual pace when not given. */
  speedOf?: (r: ResidentView) => number;
  /** The other half of someone's couple: they walk side by side and stroll together. */
  partnerOf?: (id: string) => string | undefined;
}

/** A couple a little apart, side by side across the way they face (the same side each time). */
function beside(pose: NpcPose, side: number, free: (x: number, y: number) => boolean): NpcPose {
  const len = Math.hypot(pose.dx, pose.dy);
  const [px, py] = len > 0.01 ? [-pose.dy / len, pose.dx / len] : [0.7, -0.7];
  const x = pose.x + px * 0.27 * side;
  const y = pose.y + py * 0.27 * side;
  // on a narrow path one walks just behind the other instead of through the fence
  if (free(x, y)) return { ...pose, x, y };
  const bx = pose.x - (len > 0.01 ? pose.dx / len : 0) * 0.3 * (side > 0 ? 1 : 0);
  const by = pose.y - (len > 0.01 ? pose.dy / len : 0) * 0.3 * (side > 0 ? 1 : 0);
  return free(bx, by) ? { ...pose, x: bx, y: by } : pose;
}

/** What people do inside a building rather than in its yard or at the door. */
const INDOOR = new Set(['work', 'school', 'shop', 'eat', 'leisure', 'sick', 'injured', 'arrested', 'interview']);
/** Minutes to come in through the door before one is at one's place. */
const SETTLING = 2;

/**
 * Inside a building: who of the residents is in it now and where each stands. Those at work take the first
 * posts (the counter, the teacher's desk), the rest the others; one person a post, the same each time.
 */
export function postsInside(here: LocationDef, residents: ResidentView[], minutes: number): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const posts = here.posts ?? [];
  if (!here.inside || posts.length === 0) return out;
  const inside = residents.filter((r) => r.site === here.inside && INDOOR.has(r.activity) && (r.site === r.from || minutes - r.since >= SETTLING));
  const staff = inside.filter((r) => r.activity === 'work').sort((a, b) => a.id.localeCompare(b.id));
  const guests = inside.filter((r) => r.activity !== 'work').sort((a, b) => a.id.localeCompare(b.id));
  const free = posts.map((p) => p as [number, number]);
  for (const r of staff) {
    const p = free.shift();
    if (p) out.set(r.id, p);
  }
  for (const r of guests) {
    if (free.length === 0) break;
    // a guest takes a post of their own among those left, by who they are
    const i = idSeed(r.id) % free.length;
    out.set(r.id, free.splice(i, 1)[0]);
  }
  return out;
}

function door(s: SiteDef): [number, number] {
  return [s.x + 0.5, s.y + 0.5];
}

function routeLength(route: [number, number][]): number {
  let n = 0;
  for (let i = 1; i < route.length; i++) n += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return n;
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

/** Activities seen outdoors at the site; anything else happens indoors. */
const OUTDOOR = new Set(['leisure', 'work', 'patrol', 'firefight', 'shop']);

/**
 * Where a resident is drawn at `minutes` (world minutes, fractional): on the way from the last site for the first
 * moments after setting off, then strolling about the site's yard or square, or hidden indoors.
 */
export function residentPose(r: ResidentView, minutes: number, ctx: LifeContext): NpcPose {
  const partner = ctx.partnerOf?.(r.id);
  const pose = soloPose(r, minutes, ctx, partner && partner < r.id ? partner : r.id);
  return partner && pose.visible && !ctx.here.inside ? beside(pose, partner < r.id ? -1 : 1, (x, y) => ctx.routes.free(x, y)) : pose;
}

/** Where someone is drawn; `key` is whose way they share (a couple go the same way, to the same spots). */
function soloPose(r: ResidentView, minutes: number, ctx: LifeContext, key: string): NpcPose {
  const speed = ctx.speedOf?.(r) ?? NPC_SPEED;
  const hidden: NpcPose = { x: 0, y: 0, walking: false, dx: 0, dy: 0, visible: false };
  if (ctx.here.inside) {
    const p = ctx.posts?.get(r.id);
    // a little sway in place: people at work turn to the room now and then
    return p ? { x: p[0] + 0.5, y: p[1] + 0.5, walking: false, dx: 0, dy: mix(idSeed(r.id), Math.floor(minutes / 3)) % 2 ? 1 : -1, visible: true } : hidden;
  }
  const site = ctx.sites[r.site];
  if (!site || ctx.siteLocation[r.site] !== ctx.here.id) {
    // on the way out of this place (to the forest, the farm, the fields…): walked to the road out, not vanished
    const was = ctx.sites[r.from];
    const out = site && was && ctx.siteLocation[r.from] === ctx.here.id ? exitTo(ctx.here, ctx.siteLocation[r.site]) : undefined;
    if (out && was) {
      const route = ctx.routes.route(`out|${key}|${r.since}`, ctx.routes.spot(was.x, was.y), [out.x + out.w / 2, out.y + out.h / 2]);
      const t = Math.max(0, (minutes - r.since) * 60);
      if (t * speed < routeLength(route)) {
        const at = along(route, t * speed);
        return { x: at.x, y: at.y, walking: true, dx: at.dx, dy: at.dy, visible: true };
      }
    }
    return hidden;
  }
  const from = ctx.sites[r.from];
  const fromHere = from && ctx.siteLocation[r.from] === ctx.here.id;
  const exit = !fromHere && from ? exitTo(ctx.here, ctx.siteLocation[r.from]) : undefined;
  const start: [number, number] | null = fromHere ? ctx.routes.spot(from.x, from.y) : exit ? [exit.x + exit.w / 2, exit.y + exit.h / 2] : null;
  const end = ctx.routes.spot(site.x, site.y);
  const seconds = Math.max(0, (minutes - r.since) * 60);
  // long arrived (judged by a straight line, generously): no need to find the way at all
  const arrived = start ? seconds > (Math.hypot(end[0] - start[0], end[1] - start[1]) * 2.2) / speed + 4 : true;
  if (start && r.site !== r.from && !arrived) {
    const route = ctx.routes.route(`res|${key}|${r.since}`, start, end);
    const walk = routeLength(route) / speed;
    if (seconds < walk) {
      const at = along(route, seconds * speed);
      return { x: at.x, y: at.y, walking: true, dx: at.dx, dy: at.dy, visible: true };
    }
  }
  // firefighters and the police stand around the building they were called to
  if ((r.activity === 'firefight' || r.activity === 'patrol') && site.building) {
    const [bx, by, bw, bh] = site.building;
    const ring: [number, number][] = [];
    for (let x = bx - 1; x <= bx + bw; x++) ring.push([x, by + bh], [x, by - 1]);
    for (let y = by; y < by + bh; y++) ring.push([bx - 1, y], [bx + bw, y]);
    const [cx, cy] = ring[idSeed(r.id) % ring.length];
    const s = ctx.routes.spot(cx, cy);
    return { x: s[0], y: s[1], walking: false, dx: 0, dy: 0, visible: true };
  }
  // a journalist out on an interview waits by the door with a notebook (or stands about the yard)
  if (r.activity === 'interview' && !site.area) {
    const s = ctx.routes.spot(site.x + ((idSeed(r.id) % 3) - 1), site.y + 1);
    return { x: s[0], y: s[1], walking: false, dx: 0, dy: -1, visible: true };
  }
  // the postman on his round: at the door of the house, with the post
  if (r.activity === 'work' && site.kind === 'home') {
    const s = ctx.routes.spot(site.x, site.y + 1);
    return { x: s[0], y: s[1], walking: false, dx: 0, dy: -1, visible: true };
  }
  // at mass (or a quiet prayer) people are inside the church, not crowding its door
  if (site.kind === 'church' && r.activity === 'leisure') return hidden;
  if (!site.area || (!OUTDOOR.has(r.activity) && r.activity !== 'interview')) return hidden;
  // the staff of the hospital, the police and the fire station step outside now and then
  if (r.activity === 'work' && (site.kind === 'hospital' || site.kind === 'police' || site.kind === 'fire') && mix(idSeed(r.id), Math.floor(minutes / 10)) % 3 !== 0) return hidden;
  // about the yard: a new spot every few seconds
  const [ax, ay, aw, ah] = site.area;
  const k = Math.floor(seconds / 8);
  const seed = idSeed(key) ^ r.since;
  const stroll = 0.8 * (speed / NPC_SPEED);
  const pick = (n: number): [number, number] => {
    if (n < 0) return end;
    const h = mix(seed, n);
    return ctx.routes.spot(ax + (h % aw), ay + ((h >>> 8) % ah));
  };
  const a = pick(k - 1);
  const b = pick(k);
  const t = seconds - k * 8;
  // round the benches and the fountain, not through them
  const path = ctx.routes.route(`stroll|${key}|${r.since}|${k}`, a, b);
  const length = routeLength(path);
  if (length > 0.01 && t < length / stroll) {
    const at = along(path, t * stroll);
    return { x: at.x, y: at.y, walking: true, dx: at.dx, dy: at.dy, visible: true };
  }
  return { x: b[0], y: b[1], walking: false, dx: 0, dy: 0, visible: true };
}

/** The roads of a location as a room where only road cells can be driven on. */
export function roadRoom(room: RoomView): RoomView {
  const blocked: [number, number][] = [];
  for (const [x, y] of room.cells) if (!ROAD.has(room.floor_paint[cellKey(x, y)] ?? '')) blocked.push([x, y]);
  return { ...room, placements: [], blocked };
}

const VEHICLE: Record<TripView['kind'], string> = { cart: 'horse_cart', car: 'car_red', police: 'police_car', ambulance: 'ambulance', fire_truck: 'fire_truck', garbage: 'garbage_truck', taxi: 'taxi', bike: 'cyclist', van: 'bread_van', grain: 'grain_truck' };

/** Taxis about the place: each takes a fare from one door to another and comes back, again and again. */
export function taxiTrips(minutes: number, sites: string[], cars = 2, kind: TripView['kind'] = 'taxi', PERIOD = 1.5): TripView[] {
  if (sites.length < 2) return [];
  const out: TripView[] = [];
  for (let c = 0; c < cars; c++) {
    const shift = (c * PERIOD) / cars;
    const k = Math.floor((minutes - shift) / PERIOD);
    const from = sites[mix(k, c + 11) % sites.length];
    let to = sites[mix(k + 7, c + 29) % sites.length];
    if (to === from) to = sites[(sites.indexOf(from) + 1) % sites.length];
    out.push({ kind, from, to, depart: k * PERIOD + shift, arrive: k * PERIOD + shift + 0.5 });
  }
  return out;
}

export interface Mover {
  item: string;
  x: number;
  y: number;
  /** Quarter turns, facing the way it goes. */
  rot: number;
  bob: number;
  /** Flashing lights (a siren). */
  flash?: boolean;
  /** Under way (not standing at its stop), and which way. */
  moving?: boolean;
  heading?: [number, number];
  /** What kind of trip it is on (a car, a bicycle...), for its sounds. */
  kind?: string;
  /** How high above the ground it is (a bird in flight), hundredths of a tile; its shadow stays on the ground. */
  z?: number;
  /** Its own colours by slot (an animal's coat). */
  colors?: Record<string, string>;
}

/** The quarter turn a vehicle (modelled facing +x) is drawn at, going this way. */
export function facing(dx: number, dy: number): number {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

/** The nearest road cell to a point. */
function nearestRoad(roads: RoomView, catalog: Catalog, x: number, y: number, blocked: Set<string>): [number, number] {
  let best: [number, number] = [Math.floor(x), Math.floor(y)];
  let bd = Infinity;
  for (const [cx, cy] of roads.cells) {
    if (blocked.has(cellKey(cx, cy))) continue;
    const d = Math.abs(cx - x) + Math.abs(cy - y);
    if (d < bd) {
      bd = d;
      best = [cx, cy];
    }
  }
  void catalog;
  return best;
}

/** Remembers the road routes of a location. */
export class Drives {
  private readonly cache = new Map<string, [number, number][]>();
  private readonly blocked: Set<string>;

  constructor(private readonly roads: RoomView, private readonly catalog: Catalog) {
    this.blocked = new Set((roads.blocked ?? []).map(([x, y]) => cellKey(x, y)));
  }

  route(from: [number, number], to: [number, number]): [number, number][] {
    const key = `${from}|${to}`;
    let r = this.cache.get(key);
    if (!r) {
      const a = nearestRoad(this.roads, this.catalog, from[0], from[1], this.blocked);
      const b = nearestRoad(this.roads, this.catalog, to[0], to[1], this.blocked);
      const path = findPath(this.roads, this.catalog, a, [b]) ?? [];
      r = [[a[0] + 0.5, a[1] + 0.5], ...path];
      this.cache.set(key, r);
    }
    return r;
  }
}

/**
 * A vehicle on a trip at `minutes`: it sets off when the trip departs, drives the roads, waits at the
 * destination, and drives back. Only shown while both ends are in the location shown.
 */
export function tripMover(trip: TripView, minutes: number, ctx: LifeContext, drives: Drives): Mover | null {
  const a = ctx.sites[trip.from];
  const b = ctx.sites[trip.to];
  if (!a || !b || trip.from === trip.to) return null;
  // an end in another location is the way out towards it
  const end = (s: SiteDef, id: string): [number, number] | null => {
    if (ctx.siteLocation[id] === ctx.here.id) return door(s);
    const exit = exitTo(ctx.here, ctx.siteLocation[id]);
    return exit ? [exit.x + exit.w / 2, exit.y + exit.h / 2] : null;
  };
  const from = end(a, trip.from);
  const to = end(b, trip.to);
  if (!from || !to || (ctx.siteLocation[trip.from] !== ctx.here.id && ctx.siteLocation[trip.to] !== ctx.here.id)) return null;
  const route = drives.route(from, to);
  const len = routeLength(route);
  if (len < 1) return null;
  const speed = SPEED[trip.kind] ?? DRIVE_SPEED;
  const drive = len / speed;
  // the right-hand lane: a little to the right of the way it is going
  const lane = (p: { x: number; y: number; dx: number; dy: number }) => {
    const n = Math.hypot(p.dx, p.dy) || 1;
    return { x: p.x - (p.dy / n) * LANE, y: p.y + (p.dx / n) * LANE };
  };
  const t = (minutes - trip.depart) * 60;
  if (t < 0) return null;
  const item = VEHICLE[trip.kind];
  const flash = trip.kind === 'police' || trip.kind === 'ambulance' || trip.kind === 'fire_truck';
  if (t < drive) {
    const at = along(route, t * speed);
    const l = lane(at);
    const n = Math.hypot(at.dx, at.dy) || 1;
    return { item, x: l.x, y: l.y, rot: facing(at.dx, at.dy), bob: Math.round(Math.sin(t * 9) * 0.5), flash, moving: true, heading: [at.dx / n, at.dy / n], kind: trip.kind };
  }
  if (t < drive + STAY[trip.kind]) {
    const [x, y] = route[route.length - 1];
    const last = route.length > 1 ? route[route.length - 2] : route[0];
    // parked at the kerb on its own side, engine off
    const l = lane({ x, y, dx: x - last[0], dy: y - last[1] });
    return { item, x: l.x, y: l.y, rot: facing(x - last[0], y - last[1]), bob: 0, flash, moving: false, kind: trip.kind };
  }
  if (t < drive * 2 + STAY[trip.kind]) {
    const back = [...route].reverse();
    const at = along(back, (t - drive - STAY[trip.kind]) * speed);
    const l = lane(at);
    const n = Math.hypot(at.dx, at.dy) || 1;
    return { item, x: l.x, y: l.y, rot: facing(at.dx, at.dy), bob: Math.round(Math.sin(t * 9) * 0.5), flash: false, moving: true, heading: [at.dx / n, at.dy / n], kind: trip.kind };
  }
  return null;
}

/** A spot an animal can always stand on in its area (the first good cell from its middle), or null if none. */
function home(d: AnimalDef, water: Set<string>, free: (x: number, y: number) => boolean): [number, number] | null {
  const cx = d.x + Math.floor(d.w / 2);
  const cy = d.y + Math.floor(d.h / 2);
  for (let r = 0; r <= Math.max(d.w, d.h); r++) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < d.x || y < d.y || x >= d.x + d.w || y >= d.y + d.h) continue;
        const wet = water.has(cellKey(x, y));
        if (d.swims ? wet : !wet && free(x, y)) return [x + 0.5, y + 0.5];
      }
    }
  }
  return null;
}

/**
 * Animals at `seconds` (of world time): each wanders its area at its own pace, pausing now and then; those of
 * the water stay on it, the rest on dry land; they are about only at their hours.
 */
export function animalMovers(defs: AnimalDef[], seconds: number, part: string, water: Set<string>, free: (x: number, y: number) => boolean, season = ''): Mover[] {
  const out: Mover[] = [];
  defs.forEach((d, di) => {
    if (d.when && d.when.length > 0 && !d.when.includes(part)) return;
    // the water birds fly south and the butterflies are gone in winter
    // in winter the water birds are gone and the water is ice; butterflies only in the warm months
    if (season === 'Winter' && (d.swims || d.kind === 'butterfly' || d.kind === 'hedgehog')) return;
    if (season === 'Autumn' && d.kind === 'butterfly') return;
    const speed = (d.speed ?? (d.kind === 'butterfly' || d.kind === 'bird' ? 2 : 1)) * 0.6;
    for (let n = 0; n < d.count; n++) {
      const seed = idSeed(`${d.kind}|${di}|${n}`);
      const step = 6 + (seed % 5);
      const k = Math.floor((seconds + (seed % 97)) / step);
      const at = (m: number): [number, number] | null => {
        for (let tries = 0; tries < 16; tries++) {
          const h = mix(seed + tries * 7919, m);
          const x = d.x + (h % d.w) + 0.5;
          const y = d.y + ((h >>> 9) % d.h) + 0.5;
          const wet = water.has(cellKey(Math.floor(x), Math.floor(y)));
          if (d.swims ? wet : !wet && free(Math.floor(x), Math.floor(y))) return [x, y];
        }
        return null;
      };
      // when no good spot turns up it stays where it last was: an animal never blinks out of sight on its own
      const settle = (m: number): [number, number] | null => at(m) ?? at(m - 1) ?? at(m - 2) ?? at(m - 3) ?? home(d, water, free);
      const b0 = settle(k);
      const a0 = settle(k - 1) ?? b0;
      if (!a0 || !b0) continue;
      const a = a0;
      const b = b0;
      const t = (seconds + (seed % 97)) - k * step;
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const move = Math.min(1, (t * speed) / Math.max(dist, 0.001));
      const x = a[0] + (b[0] - a[0]) * move;
      const y = a[1] + (b[1] - a[1]) * move;
      const flying = d.kind === 'butterfly' || d.kind === 'bird';
      const bob = flying ? Math.round(Math.sin(seconds * 7 + n) * 2) - 4 : move < 1 ? Math.round(Math.sin(seconds * 10 + n)) : 0;
      out.push({ item: d.kind, x, y, rot: facing(b[0] - a[0], b[1] - a[1]), bob });
    }
  });
  return out;
}
