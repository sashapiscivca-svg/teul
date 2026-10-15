// The town dressed for its celebrations: lights and a fir through the winter, the Lunar New Year's red lanterns,
// hearts, flowers, a carnival stage, saplings on Earth Day, the town's day with its stage and stalls, a film
// screen at the end of summer, the harvest fair, pumpkins, paper lanterns; flags on the state days. Getting ready
// shows: posters, a stage in scaffolding, a few more garlands each day; the morning after, bags of rubbish.
// What is out is decided by the calendar (the same for everyone); where it stands is worked out from the map:
// on free grass or paving near the square, the town hall, the church and the houses — never on a road, a path,
// the water, or on top of anything.

import type { Catalog, LocationDef, LocationProp, PlacementView, RoomView } from './types';
import { cellKey } from './geometry';

export type FestiveKind =
  | 'winter' | 'newyear' | 'halloween' | 'flags' | 'kupala' | 'lunar' | 'hearts' | 'flowers' | 'carnival' | 'earth' | 'kids'
  | 'townday' | 'cinema' | 'harvest' | 'lanterns' | 'protest' | 'hearing';

/** Where the town is with a celebration: getting ready (`ready` 0..1 of the way), the day, the morning after. */
export interface FestiveStage {
  phase: 'prep' | 'day' | 'after';
  ready: number;
}

/** What today is to the town (from the core): the holiday, the big celebration near, the plant's event. */
export interface FestiveDay {
  holiday?: string | null;
  festival?: { id: string; phase: 'prep' | 'day' | 'after'; ready: number } | null;
  /** The plant story's one-day event (hearing, protest). */
  npp?: string | null;
}

/** Each big celebration's look (core festival.rs ids). */
const FESTIVAL: Record<string, FestiveKind[]> = {
  lunar_new_year: ['lunar'], valentine: ['hearts'], womens_day: ['flowers'], spring_carnival: ['carnival'], earth_day: ['earth'],
  flower_festival: ['flowers'], childrens_day: ['kids'], kupala: ['kupala'], town_day: ['townday'], summer_end: ['cinema'],
  harvest_fair: ['harvest'], halloween: ['halloween'], lantern_night: ['lanterns'], winter_lights: ['winter'], new_year_eve: ['winter', 'newyear'],
};
/** Smaller days that dress the town only on the day. */
const SMALL: Record<string, FestiveKind[]> = { mothers_day: ['flowers'], last_bell: ['kids'], knowledge_day: ['kids'], april_fools: ['kids'] };

/** Which decorations are out on a date. */
export function festiveKinds(month: number, day: number, today: FestiveDay = {}): FestiveKind[] {
  const out = new Set<FestiveKind>();
  // the winter lights stay up from St Nicholas' week to after the New Year
  if ((month === 12 && day >= 6) || (month === 1 && day <= 10)) out.add('winter');
  if ((month === 10 && day >= 25) || (month === 11 && day === 1)) out.add('halloween');
  // the state's days: flags on the town hall and the houses
  if ((month === 8 && day >= 20 && day <= 25) || (month === 6 && day === 28) || (month === 7 && day === 15) || (month === 10 && day === 1)) out.add('flags');
  const f = today.festival;
  if (f) for (const k of FESTIVAL[f.id] ?? []) out.add(k);
  for (const k of SMALL[today.holiday ?? ''] ?? []) out.add(k);
  if (today.npp === 'protest') out.add('protest');
  if (today.npp === 'hearing') out.add('hearing');
  return [...out];
}

/** The stage of the celebration whose things are out (the day itself when there is none). */
export function festiveStage(today: FestiveDay): FestiveStage {
  const f = today.festival;
  return f ? { phase: f.phase, ready: f.phase === 'prep' ? f.ready / 1000 : 1 } : { phase: 'day', ready: 1 };
}

const OPEN_FLOOR = new Set(['floor.grass', 'floor.meadow', 'floor.plaza', 'floor.moss']);
/** Where people walk: paths to the doors, the streets, the square. */
const WALKWAY = new Set(['floor.path', 'floor.cobble', 'floor.plaza']);
const LANDMARK = /^(fountain|town_hall)$/;
const HOUSE = /^(house|cottage)/;

function footprint(catalog: Catalog, item: string, rot = 0): [number, number] {
  const f = catalog.items[item]?.footprint ?? { w: 1, d: 1 };
  return rot % 2 === 1 ? [f.d, f.w] : [f.w, f.d];
}

class Ground {
  private readonly taken = new Set<string>();
  /** Decorations keep a step apart from each other, so they never form a heap. */
  private readonly near = new Set<string>();

  constructor(private readonly ok: (x: number, y: number) => boolean) {}

  occupy(x: number, y: number, w: number, d: number): void {
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.taken.add(cellKey(x + i, y + j));
  }

  private fits(x: number, y: number, w: number, d: number): boolean {
    for (let j = -1; j <= d; j++) {
      for (let i = -1; i <= w; i++) {
        const inside = i >= 0 && j >= 0 && i < w && j < d;
        const k = cellKey(x + i, y + j);
        if (inside && (!this.ok(x + i, y + j) || this.taken.has(k) || this.near.has(k))) return false;
      }
    }
    return true;
  }

  /**
   * The free spot for a w×d thing nearest to (cx, cy), within `radius`; it is taken. With `by`, spots next to
   * such cells (a path or the street: where people pass, by the doors) count as much nearer.
   */
  place(cx: number, cy: number, w: number, d: number, radius: number, by?: (x: number, y: number) => boolean): [number, number] | null {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    const beside = (x: number, y: number) => {
      if (!by) return false;
      for (let j = -1; j <= d; j++) for (let i = -1; i <= w; i++) if ((i === -1 || j === -1 || i === w || j === d) && by(x + i, y + j)) return true;
      return false;
    };
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        const raw = Math.hypot(x + w / 2 - cx, y + d / 2 - cy);
        if (raw > radius) continue;
        const dist = by && !beside(x, y) ? raw + radius : raw;
        if (dist >= bestD || !this.fits(x, y, w, d)) continue;
        best = [x, y];
        bestD = dist;
      }
    }
    if (!best) return null;
    this.occupy(best[0], best[1], w, d);
    for (let j = -1; j <= d; j++) for (let i = -1; i <= w; i++) this.near.add(cellKey(best[0] + i, best[1] + j));
    return best;
  }
}

/** Decorations for an outdoor place on a date (none indoors or underground). */
export function festiveProps(loc: LocationDef, catalog: Catalog, kinds: FestiveKind[], stage: FestiveStage = { phase: 'day', ready: 1 }): LocationProp[] {
  if (kinds.length === 0 || loc.inside || loc.underground) return [];
  const floor = (x: number, y: number) => (x >= 0 && y >= 0 && x < loc.w && y < loc.h ? loc.legend[loc.tiles[y][x]] : undefined);
  const ground = new Ground((x, y) => OPEN_FLOOR.has(floor(x, y) ?? ''));
  const centre = (p: LocationProp): [number, number] => {
    const [w, d] = footprint(catalog, p.item, p.rot ?? 0);
    return [p.x + w / 2, p.y + d / 2];
  };
  for (const p of loc.props) {
    const [w, d] = footprint(catalog, p.item, p.rot ?? 0);
    ground.occupy(p.x, p.y, w, d);
  }
  const landmark = loc.props.find((p) => LANDMARK.test(p.item));
  const square: [number, number] = landmark ? centre(landmark) : [loc.w / 2, loc.h / 2];
  const hall = loc.props.find((p) => p.item === 'town_hall');
  const church = loc.props.find((p) => p.item === 'church');
  const houses = loc.props.filter((p) => HOUSE.test(p.item));
  const out: LocationProp[] = [];
  const walkway = (x: number, y: number) => WALKWAY.has(floor(x, y) ?? '');
  const put = (item: string, at: [number, number], radius: number, rot = 0, byWalk = false) => {
    const [w, d] = footprint(catalog, item, rot);
    const spot = catalog.items[item] ? ground.place(at[0], at[1], w, d, radius, byWalk ? walkway : undefined) : null;
    if (spot) out.push({ item, x: spot[0], y: spot[1], rot });
  };
  const byHouses = (item: string, n: number) => {
    // spread over the town: every other house, from the square outwards
    const sorted = [...houses].sort((a, b) => Math.hypot(...centre(a).map((v, i) => v - square[i]) as [number, number]) - Math.hypot(...centre(b).map((v, i) => v - square[i]) as [number, number]));
    for (const h of sorted.filter((_, i) => i % 2 === 0).slice(0, n)) {
      const [w, d] = footprint(catalog, h.item, h.rot ?? 0);
      // by the house's own path, where its door is, rather than behind it
      put(item, centre(h), Math.max(w, d) / 2 + 3, 0, true);
    }
  };
  // getting ready: the things come out a few more each day; the morning after, half are still up
  const share = stage.phase === 'day' ? 1 : stage.phase === 'after' ? 0.5 : Math.max(0.15, stage.ready);
  const some = (n: number) => Math.max(1, Math.round(n * share));
  const ready = stage.phase === 'day' || stage.ready >= 0.75;
  const stageAt = (at: [number, number]) => put(stage.phase === 'day' || (stage.phase === 'prep' && ready) ? 'town_stage' : 'stage_frame', at, 14);
  const stalls = (n: number, item = 'festival_stall') => {
    if (stage.phase === 'after' || (stage.phase === 'prep' && stage.ready < 0.5)) return;
    for (let i = 0; i < some(n); i++) put(item, square, 16, 0, true);
  };
  const many = (item: string, n: number, at: [number, number] = square, radius = 14) => {
    for (let i = 0; i < some(n); i++) put(item, at, radius);
  };
  const big = kinds.some((k) => !['flags', 'protest', 'hearing'].includes(k));
  if (big && stage.phase === 'prep') {
    put('poster_board', square, 10, 0, true);
    if (hall) put('poster_board', centre(hall), 7, 0, true);
  }
  if (big && stage.phase === 'after') {
    put('rubbish_bags', square, 8);
    put('rubbish_bags', square, 12);
  }
  for (const kind of kinds) {
    if (kind === 'winter') {
      put('festive_tree', square, 12);
      put('garland_arch', square, 14);
      if (hall) put('garland_arch', centre(hall), 8);
      if (church) put('garland_arch', centre(church), 9);
      if (stage.phase !== 'prep' || stage.ready > 0.3) stalls(2);
    } else if (kind === 'newyear') {
      stageAt(square);
    } else if (kind === 'halloween') {
      byHouses('pumpkin_lantern', some(10));
      stalls(1);
    } else if (kind === 'flags') {
      if (hall) {
        put('flag_pole', centre(hall), 6);
        put('flag_pole', centre(hall), 7);
      }
      put('flag_pole', square, 8);
      byHouses('flag_pole', 4);
    } else if (kind === 'kupala') {
      const water = findWater(loc);
      put('kupala_fire', water ?? square, water ? 6 : 14);
      if (stage.phase === 'day') put('kupala_fire', square, 14);
      stalls(1);
    } else if (kind === 'lunar') {
      many('red_lanterns', 5, square, 16);
      stalls(2);
    } else if (kind === 'hearts') {
      put('heart_arch', square, 12);
      put('flower_stand', square, 12, 0, true);
    } else if (kind === 'flowers') {
      put('flower_arch', square, 12);
      many('flower_stand', 3);
    } else if (kind === 'carnival') {
      stageAt(square);
      many('bunting', 3);
      many('balloons', 2);
      stalls(1);
    } else if (kind === 'earth') {
      many('toloka_heap', 2);
      const water = findWater(loc);
      if (stage.phase !== 'prep') many('sapling', 4, water ?? square, 10);
    } else if (kind === 'kids') {
      many('balloons', 3);
      many('bunting', 2);
    } else if (kind === 'townday') {
      stageAt(square);
      many('bunting', 4);
      many('balloons', 2);
      stalls(3);
    } else if (kind === 'cinema') {
      if (stage.phase !== 'prep' || stage.ready > 0.5) put('cinema_screen', square, 14);
      stalls(1);
    } else if (kind === 'harvest') {
      stalls(3, 'harvest_stall');
      many('bunting', 2);
    } else if (kind === 'lanterns') {
      many('lantern_post', 4);
      byHouses('lantern_post', some(4));
    } else if (kind === 'protest') {
      many('protest_placards', 3, square, 10);
    } else if (kind === 'hearing') {
      if (hall) put('poster_board', centre(hall), 6, 0, true);
    }
  }
  return out;
}

function findWater(loc: LocationDef): [number, number] | null {
  for (let y = 0; y < loc.h; y++) for (let x = 0; x < loc.w; x++) if (loc.legend[loc.tiles[y][x]] === 'floor.water') return [x, y];
  return null;
}

/** At home: a little decorated fir in the room shown during the winter feasts (if there is a free corner). */
export function homeDecorations(room: RoomView, catalog: Catalog, kinds: FestiveKind[], cells: [number, number][]): PlacementView[] {
  if (!kinds.includes('winter') || cells.length === 0 || !catalog.items.festive_tree) return [];
  const floor = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const ground = new Ground((x, y) => floor.has(cellKey(x, y)));
  for (const p of room.placements) {
    const def = catalog.items[p.item];
    if (!def || def.layer !== 'floor') continue;
    const [w, d] = footprint(catalog, p.item, p.rot);
    ground.occupy(p.x, p.y, w, d);
  }
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  // a corner far from the middle (not in the way), the farthest free one
  const corner: [number, number] = [Math.min(...xs), Math.min(...ys)];
  const spot = ground.place(corner[0], corner[1], 2, 2, Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + 2);
  if (!spot) return [];
  const def = catalog.items.festive_tree;
  const colors: Record<string, string> = {};
  for (const [slot, s] of Object.entries(def.slots ?? {})) colors[slot] = s.default;
  return [{ pid: 990_000, item: 'festive_tree', x: spot[0], y: spot[1], rot: 0, wall: null, on: null, colors, props: { festive: '1' }, known: true }];
}

/** Fireworks over the town: the New Year's midnight, the town's day and the Lunar New Year's evening, the winter lights' switching on. */
export function fireworksAt(festival: FestiveDay['festival'], minute: number): boolean {
  if (!festival || festival.phase !== 'day') return false;
  switch (festival.id) {
    case 'new_year_eve':
      return minute >= 23 * 60 + 30 || minute < 60;
    case 'town_day':
      return minute >= 22 * 60 && minute < 23 * 60;
    case 'lunar_new_year':
      return minute >= 19 * 60 && minute < 20 * 60 + 30;
    case 'winter_lights':
      return minute >= 18 * 60 && minute < 18 * 60 + 40;
    default:
      return false;
  }
}

/**
 * Things stood near a spot for a moment (a newspaper photo's placards, a stall, a rig): on free open ground or
 * paving nearest to it, clear of everything else on the map and of `also`.
 */
export function standNear(loc: LocationDef, catalog: Catalog, items: string[], at: [number, number], also: LocationProp[] = []): LocationProp[] {
  if (items.length === 0 || loc.inside || loc.underground) return [];
  const floor = (x: number, y: number) => (x >= 0 && y >= 0 && x < loc.w && y < loc.h ? loc.legend[loc.tiles[y][x]] : undefined);
  const ground = new Ground((x, y) => OPEN_FLOOR.has(floor(x, y) ?? '') || WALKWAY.has(floor(x, y) ?? '') || floor(x, y) === 'floor.dirt' || floor(x, y) === 'floor.field');
  for (const p of [...loc.props, ...also]) {
    const [w, d] = footprint(catalog, p.item, p.rot ?? 0);
    ground.occupy(p.x, p.y, w, d);
  }
  const out: LocationProp[] = [];
  for (const item of items) {
    if (!catalog.items[item]) continue;
    const [w, d] = footprint(catalog, item, 0);
    const spot = ground.place(at[0], at[1], w, d, 12);
    if (spot) out.push({ item, x: spot[0], y: spot[1], rot: 0 });
  }
  return out;
}
