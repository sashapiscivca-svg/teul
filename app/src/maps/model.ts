// The maps app's model: the town and the maps around it laid out as one atlas (each map put beside the one its
// road leads from, the roads between drawn in), the view's projection, walking routes along the streets and
// paths (A* over the real tiles, through the ways out between maps), the places to search (buildings, streets,
// people's workplaces, what is sold where), opening hours from who works there, and the day's happenings.
// Pure functions over the catalog: no DOM, all local data (it works offline).

import type { LocationDef, ResidentDef, SiteDef, StationDef } from '../types';
import { has, t } from '../i18n';

export type Pt = [number, number];

export interface Placed {
  def: LocationDef;
  /** Where its cell (0, 0) is in the atlas, in tiles. */
  ox: number;
  oy: number;
}

export interface Atlas {
  maps: Map<string, Placed>;
  /** The roads between maps, as polylines in atlas tiles. */
  roads: Pt[][];
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

/** Maps the atlas shows: the outdoors reachable by road from the town (no rooms, no caves, no other worlds). */
function shown(def: LocationDef | undefined): def is LocationDef {
  return !!def && !def.inside && !def.underground && def.id !== 'home';
}

function side(def: LocationDef, e: { x: number; y: number; w: number; h: number }): 'w' | 'e' | 'n' | 's' | null {
  if (e.x <= 0) return 'w';
  if (e.x + e.w >= def.w) return 'e';
  if (e.y <= 0) return 'n';
  if (e.y + e.h >= def.h) return 's';
  return null;
}

/** Lays the maps out around `root`: each next to the edge its road leaves from, nothing on top of another. */
export function layoutAtlas(locations: Record<string, LocationDef>, root = 'village', gap = 10): Atlas {
  const maps = new Map<string, Placed>();
  const roads: Pt[][] = [];
  const first = locations[root];
  if (!shown(first)) return { maps, roads, bounds: { x0: 0, y0: 0, x1: 1, y1: 1 } };
  maps.set(root, { def: first, ox: 0, oy: 0 });
  const queue = [root];
  const overlaps = (x: number, y: number, w: number, h: number) =>
    [...maps.values()].some((p) => x < p.ox + p.def.w + 3 && p.ox < x + w + 3 && y < p.oy + p.def.h + 3 && p.oy < y + h + 3);
  while (queue.length) {
    const from = maps.get(queue.shift()!)!;
    for (const e of from.def.exits) {
      const def = locations[e.to];
      const s = side(from.def, e);
      if (!shown(def) || !s) continue;
      const out: Pt = [from.ox + e.x + e.w / 2, from.oy + e.y + e.h / 2];
      const already = maps.get(e.to);
      if (!already) {
        let ox = 0;
        let oy = 0;
        if (s === 'w') [ox, oy] = [from.ox - gap - def.w, out[1] - e.at[1]];
        else if (s === 'e') [ox, oy] = [from.ox + from.def.w + gap, out[1] - e.at[1]];
        else if (s === 'n') [ox, oy] = [out[0] - e.at[0], from.oy - gap - def.h];
        else [ox, oy] = [out[0] - e.at[0], from.oy + from.def.h + gap];
        // slide along the edge (the least either way), or failing that further out, until clear of the others
        const along = s === 'w' || s === 'e';
        const out1 = s === 'w' ? -1 : s === 'e' ? 1 : 0;
        const out2 = s === 'n' ? -1 : s === 's' ? 1 : 0;
        found: for (let far = 0; far < 200; far += 4) {
          for (let k = 0; k < 160; k++) {
            for (const sign of k ? [1, -1] : [1]) {
              const x = ox + out1 * far + (along ? 0 : sign * k);
              const y = oy + out2 * far + (along ? sign * k : 0);
              if (!overlaps(x, y, def.w, def.h)) {
                [ox, oy] = [x, y];
                break found;
              }
            }
          }
        }
        maps.set(e.to, { def, ox, oy });
        queue.push(e.to);
      }
      const to = maps.get(e.to)!;
      const arrive: Pt = [to.ox + e.at[0] + 0.5, to.oy + e.at[1] + 0.5];
      // a road out from the edge, across, and in (each pair once)
      const mid: Pt = s === 'w' || s === 'e' ? [(out[0] + arrive[0]) / 2, out[1]] : [out[0], (out[1] + arrive[1]) / 2];
      const turn: Pt = s === 'w' || s === 'e' ? [mid[0], arrive[1]] : [arrive[0], mid[1]];
      if (!already || !roads.some((r) => near(r[r.length - 1], out) && near(r[0], arrive))) roads.push([out, mid, turn, arrive]);
    }
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of maps.values()) {
    x0 = Math.min(x0, p.ox);
    y0 = Math.min(y0, p.oy);
    x1 = Math.max(x1, p.ox + p.def.w);
    y1 = Math.max(y1, p.oy + p.def.h);
  }
  return { maps, roads, bounds: { x0, y0, x1, y1 } };
}

function near(a: Pt, b: Pt): boolean {
  return Math.abs(a[0] - b[0]) < 5 && Math.abs(a[1] - b[1]) < 5;
}

/** A cell of a map in atlas tiles (its centre); null when the map is not on the atlas. */
export function toAtlas(atlas: Atlas, loc: string, x: number, y: number): Pt | null {
  const p = atlas.maps.get(loc);
  return p ? [p.ox + x, p.oy + y] : null;
}

// ---- the view -----------------------------------------------------------------------------------------------

export interface View {
  /** The atlas point at the middle of the screen. */
  cx: number;
  cy: number;
  /** Pixels per tile. */
  zoom: number;
  w: number;
  h: number;
}

export const MIN_ZOOM = 1.2;
export const MAX_ZOOM = 40;

export function project(v: View, p: Pt): Pt {
  return [(p[0] - v.cx) * v.zoom + v.w / 2, (p[1] - v.cy) * v.zoom + v.h / 2];
}

export function unproject(v: View, s: Pt): Pt {
  return [(s[0] - v.w / 2) / v.zoom + v.cx, (s[1] - v.h / 2) / v.zoom + v.cy];
}

/** Zooms by `factor` keeping the atlas point under the screen point `at` where it is. */
export function zoomAt(v: View, factor: number, at: Pt): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
  const p = unproject(v, at);
  return { ...v, zoom, cx: p[0] - (at[0] - v.w / 2) / zoom, cy: p[1] - (at[1] - v.h / 2) / zoom };
}

/** Moves the view by a drag of (dx, dy) screen pixels. */
export function pan(v: View, dx: number, dy: number): View {
  return { ...v, cx: v.cx - dx / v.zoom, cy: v.cy - dy / v.zoom };
}

// ---- walking --------------------------------------------------------------------------------------------------

/** What a step on each floor costs a walker (the pavements best, grass slower, water not at all). */
export function stepCost(style: string | undefined): number {
  if (!style) return 3;
  if (style.endsWith('water')) return Infinity;
  if (/plaza|path|gravel|deck|stone|tile|wood|concrete|asphalt/.test(style)) return 1;
  if (/cobble/.test(style)) return 1.15;
  if (/dirt|soil|sand/.test(style)) return 1.6;
  return 2.2;
}

/** Cells nobody walks through: the buildings' footprints (their doors excepted). */
function blockedCells(def: LocationDef): Set<number> {
  const out = new Set<number>();
  for (const s of def.sites ?? []) {
    const b = s.building;
    if (!b) continue;
    for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) out.add(y * def.w + x);
  }
  return out;
}

const gridCache = new WeakMap<LocationDef, Float32Array>();

function costGrid(def: LocationDef): Float32Array {
  let g = gridCache.get(def);
  if (g) return g;
  g = new Float32Array(def.w * def.h);
  const blocked = blockedCells(def);
  for (let y = 0; y < def.h; y++) {
    const row = def.tiles[y] ?? '';
    for (let x = 0; x < def.w; x++) g[y * def.w + x] = blocked.has(y * def.w + x) ? Infinity : stepCost(def.legend[row[x]]);
  }
  gridCache.set(def, g);
  return g;
}

/** The cheapest walk between two cells of one map (A*, four ways), as cells; null when there is none. */
export function walkCells(def: LocationDef, from: Pt, to: Pt): Pt[] | null {
  const W = def.w;
  const H = def.h;
  const clamp = (p: Pt): Pt => [Math.max(0, Math.min(W - 1, Math.floor(p[0]))), Math.max(0, Math.min(H - 1, Math.floor(p[1])))];
  const [sx, sy] = clamp(from);
  const [tx, ty] = clamp(to);
  const cost = costGrid(def);
  const start = sy * W + sx;
  const goal = ty * W + tx;
  const g = new Float32Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const h = (i: number) => (Math.abs((i % W) - tx) + Math.abs(Math.floor(i / W) - ty)) * 1;
  g[start] = 0;
  push(h(start), start);
  while (heap.length) {
    const [, i] = pop();
    if (i === goal) break;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      const c = j === goal ? 1 : cost[j];
      if (c === Infinity) continue;
      const ng = g[i] + c;
      if (ng < g[j]) {
        g[j] = ng;
        prev[j] = i;
        push(ng + h(j), j);
      }
    }
  }
  if (g[goal] === Infinity) return null;
  const out: Pt[] = [];
  for (let i = goal; i !== -1; i = prev[i]) out.push([i % W, Math.floor(i / W)]);
  return out.reverse();
}

/** Drops the cells in the middle of straight runs (the line drawn is the same, with far fewer points). */
export function simplify(cells: Pt[]): Pt[] {
  if (cells.length <= 2) return cells;
  const out: Pt[] = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = out[out.length - 1];
    const b = cells[i];
    const c = cells[i + 1];
    if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) out.push(b);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/** The maps one walks through from one to another (by their ways out), the first and last included. */
export function mapPath(locations: Record<string, LocationDef>, from: string, to: string): string[] | null {
  const prev = new Map<string, string>([[from, '']]);
  const queue = [from];
  while (queue.length) {
    const l = queue.shift()!;
    if (l === to) break;
    for (const e of locations[l]?.exits ?? []) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, l);
      queue.push(e.to);
    }
  }
  if (!prev.has(to)) return null;
  const out: string[] = [];
  for (let l = to; l; l = prev.get(l) ?? '') out.push(l);
  return out.reverse();
}

export interface Route {
  /** Polylines in atlas tiles (one per map walked through, the roads between joining them). */
  lines: Pt[][];
  /** Cells walked. */
  tiles: number;
}

/** A walk from a cell of one map to a cell of another, along the streets and paths. */
export function walkRoute(atlas: Atlas, locations: Record<string, LocationDef>, from: { loc: string; x: number; y: number }, to: { loc: string; x: number; y: number }): Route | null {
  const path = mapPath(locations, from.loc, to.loc);
  if (!path) return null;
  const lines: Pt[][] = [];
  let tiles = 0;
  let at: Pt = [from.x, from.y];
  for (let i = 0; i < path.length; i++) {
    const def = locations[path[i]];
    const next = path[i + 1];
    const exit = next ? def.exits.find((e) => e.to === next) : undefined;
    const goal: Pt = exit ? [exit.x + Math.floor(exit.w / 2), exit.y + Math.floor(exit.h / 2)] : [to.x, to.y];
    const placed = atlas.maps.get(def.id);
    if (placed) {
      const cells = walkCells(def, at, goal);
      if (!cells) return null;
      tiles += cells.length - 1;
      lines.push(simplify(cells).map(([x, y]) => [placed.ox + x + 0.5, placed.oy + y + 0.5] as Pt));
      // the road between this map and the next, as the atlas draws it
      if (exit && atlas.maps.has(next!)) {
        const road = atlas.roads.find((r) => near(r[0], [placed.ox + exit.x + exit.w / 2, placed.oy + exit.y + exit.h / 2]) || near(r[r.length - 1], [placed.ox + exit.x + exit.w / 2, placed.oy + exit.y + exit.h / 2]));
        if (road) {
          const start = near(road[0], [placed.ox + exit.x + exit.w / 2, placed.oy + exit.y + exit.h / 2]);
          lines.push(start ? road : [...road].reverse());
          for (let k = 1; k < road.length; k++) tiles += Math.abs(road[k][0] - road[k - 1][0]) + Math.abs(road[k][1] - road[k - 1][1]);
        }
      }
    } else {
      // a room (or a cave): only its door counts
      tiles += Math.abs(at[0] - goal[0]) + Math.abs(at[1] - goal[1]);
    }
    if (exit) at = [exit.at[0], exit.at[1]];
  }
  return { lines, tiles: Math.round(tiles) };
}

/** Walking minutes for so many cells (the hero walks three cells a second); at least one. */
export function walkMinutes(tiles: number): number {
  return Math.max(1, Math.round(tiles / 3 / 60));
}

// ---- places ---------------------------------------------------------------------------------------------------

export type PlaceKind = 'site' | 'street' | 'landmark' | 'map' | 'person' | 'stand';

export interface Place {
  key: string;
  name: string;
  /** What it is, in words (the kind of a site, «вулиця», a person's work). */
  what: string;
  kind: PlaceKind;
  /** The site's kind (cafe, grocery…), for its pin. */
  sort: string;
  loc: string;
  x: number;
  y: number;
  /** The site it is (or where the person works). */
  site?: string;
  /** Words it is also found by (what is sold there, its kind's synonyms). */
  words: string;
}

/** The words people look for a kind of site by (in both languages; its name is `kindName`). */
export const KINDS: Record<string, string> = {
  cafe: 'кава кафе каву кавʼярня кофе чай десерт бар пиво coffee cafe café tea dessert bar beer',
  bakery: 'хліб випічка булка булочки bread pastry bun buns',
  grocery: 'магазин крамниця продукти їжа супермаркет shop store groceries food supermarket',
  flowers: 'квіти букет flowers bouquet florist',
  library: 'книжки книги читати books read reading',
  townhall: 'громада мер голова довідки council mayor certificates',
  hardware: 'інструменти фарба цвяхи tools paint nails',
  square: 'центр фонтан centre center fountain',
  market: 'базар овочі фрукти bazaar vegetables fruit',
  school: 'навчання освіта study education',
  hospital: 'аптека ліки лікар медицина швидка пігулки pharmacy medicine doctor ambulance pills',
  police: 'відділок поліцейський station officer',
  fire: 'пожежники firefighters firemen',
  post: 'посилка лист техніка телефон ноутбук parcel letter electronics phone laptop',
  utility: 'рахунки комуналка оплата bills utilities payment',
  workshop: 'ремонт лагодити repair mend fix',
  vet: 'ветеринар тварини притулок veterinarian animals shelter',
  gym: 'спорт тренування фітнес sport training fitness',
  playground: 'діти гойдалки children kids swings',
  park: 'прогулянка озеро лавки walk lake benches',
  factory: 'завод робота factory work',
  tower: 'вежа tower',
  church: 'церква меса храм church mass',
  temple: 'медитація meditation',
  power: 'електрика electricity power',
  forest: 'дерева гриби trees mushrooms woods',
  hostel: 'готель ночівля hotel night stay',
  newsroom: 'газета новини newspaper news',
  clothes: 'одяг магазин куртка clothes shop jacket',
  salon: 'стрижка зачіска haircut hairstyle barber',
  donuts: 'пончики солодке кава donuts sweets coffee',
  garage: 'авто ремонт машина бензин car repair petrol gas',
  radio: 'радіо музика radio music',
  cinema: 'кіно фільм сеанс попкорн cinema film movie screening popcorn',
  farm: 'молоко яйця тварини milk eggs animals',
  sawmill: 'дерево дошки wood planks timber',
  cemetery: 'цвинтар graveyard',
  dump: 'барахолка сміття flea market junk rubbish',
  winery: 'вино виноград дегустація wine grapes tasting',
  hippodrome: 'коні перегони скачки horses races racing',
  creamery: 'вовна сир торби wool cheese bags',
};

/** What a kind of site is called (`maps.kind.<kind>`), or `fallback` for a kind with no name of its own. */
export function kindName(kind: string, fallback: string): string {
  return has(`maps.kind.${kind}`) ? t(`maps.kind.${kind}`) : fallback;
}

/** Folds what is typed for matching: lower case, one apostrophe, no quotes. */
export function fold(s: string): string {
  return s.toLowerCase().replace(/[’'ʼ`]/g, 'ʼ').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
}

export interface PlaceSources {
  locations: Record<string, LocationDef>;
  residents?: ResidentDef[] | Record<string, ResidentDef>;
  stations?: Record<string, StationDef> | StationDef[];
}

/** Every place one can look for on the atlas. */
export function placeIndex(atlas: Atlas, src: PlaceSources): Place[] {
  const out: Place[] = [];
  const siteAt = new Map<string, { loc: string; site: SiteDef }>();
  const rooms = new Map<string, string>();
  for (const def of Object.values(src.locations)) if (def.inside) rooms.set(def.id, def.inside);
  const stations = Array.isArray(src.stations) ? src.stations : Object.values(src.stations ?? {});
  const sold = new Map<string, string[]>();
  for (const st of stations) {
    const site = rooms.get(st.location);
    if (!site) continue;
    const list = sold.get(site) ?? [];
    list.push(st.label);
    sold.set(site, list);
  }
  for (const [loc, p] of atlas.maps) {
    for (const s of p.def.sites ?? []) {
      siteAt.set(s.id, { loc, site: s });
      if (s.kind === 'home') continue;
      const what = kindName(s.kind, s.name);
      const words = KINDS[s.kind] ?? '';
      out.push({ key: `site:${s.id}`, name: s.name, what, kind: 'site', sort: s.kind, loc, x: s.x, y: s.y, site: s.id, words: fold(`${words} ${(sold.get(s.id) ?? []).join(' ')}`) });
    }
    for (const [id, l] of Object.entries(p.def.landmarks ?? {})) {
      if (id.startsWith('door:') || id.startsWith('cart_stop')) continue;
      const street = id.endsWith('_street');
      out.push({ key: `mark:${loc}:${id}`, name: l.name, what: street ? t('maps.street') : p.def.name, kind: street ? 'street' : 'landmark', sort: street ? 'street' : 'landmark', loc, x: l.x + Math.floor(l.w / 2), y: l.y + Math.floor(l.h / 2), words: street ? 'вулиця street' : '' });
    }
    if (loc !== 'village') {
      const e = p.def.exits[0];
      out.push({ key: `map:${loc}`, name: p.def.name, what: t('maps.outskirts'), kind: 'map', sort: loc, loc, x: e ? e.x + Math.floor(e.w / 2) : Math.floor(p.def.w / 2), y: e ? e.y + Math.floor(e.h / 2) : Math.floor(p.def.h / 2), words: fold(KINDS[loc] ?? '') });
    }
  }
  const people = Array.isArray(src.residents) ? src.residents : Object.values(src.residents ?? {});
  for (const r of people) {
    const job = r.job;
    const at = job ? siteAt.get(job[0]) : undefined;
    if (!at) continue;
    out.push({ key: `person:${r.id}`, name: r.name, what: t('maps.worksAt', { site: at.site.name }), kind: 'person', sort: at.site.kind, loc: at.loc, x: at.site.x, y: at.site.y, site: at.site.id, words: '' });
  }
  return out;
}

/** One's own home as a place on the maps (homes of others are not shown): at its door, by its name if it has one. */
export function myHomePlace(home: { loc: string; x: number; y: number; name: string | null }): Place {
  return { key: 'home:mine', name: home.name || t('maps.myHome'), what: t('maps.myHomeWhat'), kind: 'site', sort: 'myhome', loc: home.loc, x: home.x, y: home.y, words: fold(`${t('maps.myHome')} дім додому хата home house`) };
}

/** The places that match what is typed, the best first (a name that starts with it, then one that has it, then
 * one found by its other words). */
export function search(places: Place[], query: string, limit = 12): Place[] {
  const q = fold(query);
  if (!q) return [];
  const scored: [number, Place][] = [];
  for (const p of places) {
    const name = fold(p.name);
    let s = 0;
    if (name.startsWith(q) || name.split(' ').some((w) => w.startsWith(q))) s = 4;
    else if (name.includes(q)) s = 3;
    else if (fold(p.what).includes(q)) s = 2;
    else if (p.words.split(' ').some((w) => w.startsWith(q)) || p.words.includes(q)) s = 1;
    if (s > 0) scored.push([s * 10 - (p.kind === 'person' ? 1 : 0), p]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'uk'));
  return scored.slice(0, limit).map((x) => x[1]);
}

// ---- hours ----------------------------------------------------------------------------------------------------

export interface Hours {
  /** Minutes of the day it opens and closes (close may pass midnight: over 1440). */
  from: number;
  to: number;
  /** Weekdays it is open (0 Monday … 6 Sunday). */
  days: number[];
  /** Open day and night. */
  always: boolean;
}

/** When a place is open: while anyone works there (none working there: always open, like a park). */
export function hoursOf(site: SiteDef & { jobs?: { from: number; to: number; days?: number[] }[] }): Hours {
  const jobs = site.jobs ?? [];
  if (!jobs.length) return { from: 0, to: 1440, days: [0, 1, 2, 3, 4, 5, 6], always: true };
  const from = Math.min(...jobs.map((j) => j.from));
  const to = Math.max(...jobs.map((j) => j.to));
  const days = [...new Set(jobs.flatMap((j) => (j.days?.length ? j.days : [0, 1, 2, 3, 4, 5, 6])))].sort();
  return { from, to, days, always: to - from >= 1440 && days.length === 7 };
}

export function isOpen(h: Hours, minute: number, weekday: number): boolean {
  if (h.always) return true;
  const m = ((minute % 1440) + 1440) % 1440;
  if (h.days.includes(weekday) && m >= h.from && m < h.to) return true;
  // the night shift that started yesterday
  return h.to > 1440 && h.days.includes((weekday + 6) % 7) && m < h.to - 1440;
}

const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Hours as a line: «08:00–20:00», «пн–пт 09:00–18:00», «Цілодобово». */
export function hoursText(h: Hours): string {
  if (h.always) return t('maps.always');
  const time = `${hhmm(h.from)}–${hhmm(h.to)}`;
  if (h.days.length === 7) return t('maps.daily', { time });
  const d = h.days;
  const DAYS = t('maps.days').split(',');
  const run = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  return `${run ? `${DAYS[d[0]]}–${DAYS[d[d.length - 1]]}` : d.map((x) => DAYS[x]).join(', ')} ${time}`;
}

/** One day's hours (`to` may pass midnight: over 1440), or null for a day off. */
export interface DayHours {
  from: number;
  to: number;
}

/** The week day by day (0 Monday … 6 Sunday): from the first shift that starts to the last that ends that day. */
export function weekHours(site: SiteDef & { jobs?: { from: number; to: number; days?: number[] }[] }): (DayHours | null)[] {
  const jobs = site.jobs ?? [];
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    if (!jobs.length) return { from: 0, to: 1440 };
    const on = jobs.filter((j) => !j.days?.length || j.days.includes(d));
    return on.length ? { from: Math.min(...on.map((j) => j.from)), to: Math.max(...on.map((j) => j.to)) } : null;
  });
}

/**
 * When the door next opens or closes from `minute` on `weekday`: `at` is the minute of the day it happens and
 * `days` how many days on; `at` is null when it never closes (or never opens) within the week.
 */
export function nextChange(week: (DayHours | null)[], minute: number, weekday: number): { open: boolean; at: number | null; days: number } {
  const spans: [number, number][] = [];
  for (let k = -1; k <= 8; k++) {
    const d = week[(((weekday + k) % 7) + 7) % 7];
    if (d) spans.push([k * 1440 + d.from, k * 1440 + d.to]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const m = ((minute % 1440) + 1440) % 1440;
  const now = merged.find(([a, b]) => a <= m && m < b);
  if (now) return now[1] >= 8 * 1440 ? { open: true, at: null, days: 0 } : { open: true, at: now[1] % 1440, days: Math.floor(now[1] / 1440) };
  const next = merged.find(([a]) => a > m);
  return next ? { open: false, at: next[0] % 1440, days: Math.floor(next[0] / 1440) } : { open: false, at: null, days: 0 };
}

/** One day's hours as a line: «09:00–18:00», «Цілодобово», «Вихідний». */
export function dayHoursText(d: DayHours | null): string {
  if (!d) return t('maps.dayOff');
  if (d.to - d.from >= 1440) return t('maps.always');
  return `${hhmm(d.from)}–${hhmm(d.to)}`;
}

/** Open or shut now, and when that changes: («Відчинено», «зачиниться о 20:00»), («Зачинено», «відчиниться завтра о 08:00»). */
export function openStatus(site: SiteDef & { jobs?: { from: number; to: number; days?: number[] }[] }, minute: number, weekday: number): { open: boolean; text: string } {
  const st = nextChange(weekHours(site), minute, weekday);
  let text: string;
  if (st.at === null) text = st.open ? (site.jobs?.length ? t('maps.always') : t('maps.alwaysOpen')) : '';
  else if (st.open) text = t('maps.closesAt', { time: hhmm(st.at) });
  else if (st.days === 0) text = t('maps.opensAt', { time: hhmm(st.at) });
  else if (st.days === 1) text = t('maps.opensTomorrow', { time: hhmm(st.at) });
  else text = t('maps.opensOn', { day: t('maps.onDays').split(',')[(weekday + st.days) % 7], time: hhmm(st.at) });
  return { open: st.open, text };
}

// ---- the day's happenings -------------------------------------------------------------------------------------

export interface Happening {
  key: string;
  title: string;
  when: string;
  loc: string;
  x: number;
  y: number;
}

/** What is on today and where: the feast on the square, the market, the flea market at the dump at the weekend,
 * the cinema's show, the races. */
export function happenings(atlas: Atlas, minute: number, weekday: number, festival: string | null): Happening[] {
  const out: Happening[] = [];
  const v = atlas.maps.get('village')?.def;
  const mark = (id: string) => v?.landmarks?.[id];
  const site = (id: string) => v?.sites?.find((s) => s.id === id);
  const m = ((minute % 1440) + 1440) % 1440;
  const sq = mark('square_centre') ?? mark('square');
  if (festival && sq) out.push({ key: 'fest', title: t('maps.fest', { festival }), when: t('maps.allDay'), loc: 'village', x: sq.x, y: sq.y });
  const market = site('market_site');
  if (market && m < 18 * 60) out.push({ key: 'market', title: t('maps.marketOpen'), when: t('maps.until', { time: '18:00' }), loc: 'village', x: market.x, y: market.y });
  const cinema = site('cinema_site') ?? (mark('cinema') ? { x: mark('cinema')!.x, y: mark('cinema')!.y } : undefined);
  if (cinema) {
    const weekend = weekday >= 5;
    const at = weekend ? 11 * 60 : 13 * 60;
    out.push({ key: 'cinema', title: weekend ? t('maps.film.weekend') : t('maps.film.weekday'), when: m < at ? t('maps.showFrom', { time: hhmm(at) }) : t('maps.showsLate'), loc: 'village', x: cinema.x, y: cinema.y });
  }
  if (weekday >= 5 && atlas.maps.has('dump')) out.push({ key: 'flea', title: t('maps.flea'), when: t('maps.today'), loc: 'dump', x: 14, y: 11 });
  if (atlas.maps.has('hippodrome') && m < 20 * 60) {
    const next = Math.max(9 * 60, Math.ceil(m / 30) * 30);
    out.push({ key: 'races', title: t('maps.races'), when: next < 20 * 60 ? t('maps.nextRace', { time: hhmm(next) }) : t('maps.racesOver'), loc: 'hippodrome', x: 30, y: 6 });
  }
  return out;
}
