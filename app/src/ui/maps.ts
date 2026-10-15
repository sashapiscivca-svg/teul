// «Мапи»: the maps app on one's smartphone and on the computer at home. A clean street map of Липове and the
// maps around it drawn from the world's own map data (not the game's camera): streets with their names, the
// places with pins, one's blue dot, search, a place's card (hours, what is there, who works there), a walking
// route along the streets, the taxi's price there now and a call for it; layers for the traffic, the weather and
// what is on today. All of it local: it works without the network.

import { iconSvg } from '../icons';
import type { TaxiQuoteView } from '../engine';
import type { LocationDef, ResidentDef, SiteDef, StationDef } from '../types';
import { glyphBits } from '../pixel/glyph';
import {
  dayHoursText, happenings, layoutAtlas, myHomePlace, openStatus, weekHours, MAX_ZOOM, MIN_ZOOM, pan, placeIndex, project, search, toAtlas, walkMinutes, walkRoute, zoomAt,
  type Atlas, type Happening, type Place, type Pt, type Route, type View,
} from '../maps/model';
import { h } from './dom';
import { has, t as tr } from '../i18n';

export interface MapsDeps {
  catalog(): { locations: Record<string, LocationDef>; residents: ResidentDef[] | Record<string, ResidentDef>; stations: Record<string, StationDef> | StationDef[] };
  /** Where the hero is (a room or home is shown at its door). */
  hero(): { loc: string; x: number; y: number; facing: 'left' | 'right' } | null;
  minute(): number;
  /** 0 Monday … 6 Sunday. */
  weekday(): number;
  festival(): string | null;
  /** The sky now: its kind (clear, cloudy, rain, storm, snow, fog) and in words. */
  weather(): { sky: string; words: string };
  /** The vehicles about on the map one is on. */
  traffic(): { loc: string; x: number; y: number }[];
  /** The taxi's prices from here now, or why it cannot come. */
  quotes(): { list: TaxiQuoteView[]; refusal: string | null };
  ride(id: string): void;
  /** The door of where one lives now (and the home's own name, if it has one), or null when one has no home. */
  home(): { loc: string; x: number; y: number; name: string | null } | null;
  /** A snapshot of a place today in colour (a data URL), or null when it cannot be taken. */
  photo(shot: Shot): Promise<string | null>;
}

/** What a snapshot of a place is of: the map or room, the cell looked at, who is in it, the minute of the day. */
export interface Shot {
  place: string;
  at: [number, number] | null;
  people: string[];
  minute: number;
}

type SiteWithJobs = SiteDef & { jobs?: { role: string; from: number; to: number; days?: number[] }[] };

/** The floors' colours on the map (by the style's last word). */
const FLOOR: [RegExp, string][] = [
  [/water/, '#aad3f5'],
  [/cobble|asphalt/, '#ffffff'],
  [/plaza|tile|concrete|stone/, '#f2efe9'],
  [/path/, '#efe7d4'],
  [/gravel/, '#e8e1cf'],
  [/deck|wood/, '#ddcba7'],
  [/sand/, '#f5e6b6'],
  [/soil|dirt/, '#e7dbc1'],
  [/grass|meadow|moss|leaf/, '#d4eac6'],
];
const LAND = '#ecebe4';
const S = 6;

function floorColor(style: string | undefined): string {
  if (!style) return LAND;
  for (const [re, c] of FLOOR) if (re.test(style)) return c;
  return LAND;
}

/** A pin's colour and glyph by the kind of place. */
export function pinStyle(sort: string): [string, string] {
  const food = ['cafe', 'bakery', 'grocery', 'market', 'donuts'];
  const shop = ['flowers', 'clothes', 'hardware', 'post', 'salon', 'garage'];
  const health = ['hospital', 'vet'];
  const fun = ['park', 'playground', 'square', 'gym', 'hippodrome'];
  const glyph: Record<string, string> = {
    cafe: 'brew_tea', bakery: 'harvest', grocery: 'bag', market: 'store', donuts: 'heart', flowers: 'leaf', clothes: 'palette', hardware: 'hammer',
    myhome: 'home', post: 'mail', salon: 'sparkle', garage: 'gear', hospital: 'plus', vet: 'feed_cat', park: 'leaf', playground: 'sparkle', square: 'village', gym: 'walk',
    library: 'read', townhall: 'village', school: 'page', police: 'lock', fire: 'drop', utility: 'coin', workshop: 'hammer', factory: 'gear', tower: 'drop',
    church: 'rest', temple: 'rest', power: 'power', forest: 'leaf', hostel: 'rest', newsroom: 'paper', radio: 'listen', cinema: 'camera', farm: 'harvest',
    hippodrome: 'walk', winery: 'brew_tea', creamery: 'store', sawmill: 'hammer', cemetery: 'rest', dump: 'store', fields: 'harvest', vineyard: 'brew_tea',
  };
  const colour = food.includes(sort) ? '#e8710a' : shop.includes(sort) ? '#1a73e8' : health.includes(sort) ? '#d93025' : fun.includes(sort) ? '#188038'
    : sort === 'myhome' ? '#00897b' : sort === 'cinema' ? '#9334e6' : sort === 'church' || sort === 'temple' ? '#8d6e63' : '#5f6b7a';
  return [colour, glyph[sort] ?? 'pin'];
}

export class MapsSheet {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: HTMLInputElement;
  private readonly results: HTMLElement;
  private readonly card: HTMLElement;
  private readonly chip: HTMLElement;
  private readonly layersBox: HTMLElement;
  private atlas: Atlas | null = null;
  private places: Place[] = [];
  private locations: Record<string, LocationDef> = {};
  private residents: ResidentDef[] = [];
  private stations: StationDef[] = [];
  private readonly images = new Map<string, HTMLCanvasElement>();
  private readonly glyphs = new Map<string, HTMLCanvasElement>();
  private view: View = { cx: 37, cy: 57, zoom: 6, w: 360, h: 640 };
  private raf = 0;
  readonly layers = { traffic: false, weather: true, events: false };
  /** The place whose card is open. */
  selected: Place | null = null;
  /** The route shown, and to where. */
  route: Route | null = null;
  private heading = 0;
  private last: Pt | null = null;
  private readonly pointers = new Map<number, Pt>();
  private moved = 0;
  private followHero = true;

  constructor(parent: HTMLElement, private readonly deps: MapsDeps) {
    this.canvas = h('canvas', { class: 'maps-canvas' }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.input = h('input', { class: 'maps-input', type: 'search', placeholder: tr('maps.searchHere'), 'aria-label': tr('maps.searchLabel'), autocomplete: 'off' }) as HTMLInputElement;
    this.input.addEventListener('input', () => this.showResults());
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const first = this.results.querySelector('button');
        if (first) (first as HTMLButtonElement).click();
      } else if (e.key === 'Escape') this.close();
    });
    this.results = h('div', { class: 'maps-results' });
    this.card = h('div', { class: 'maps-card' });
    this.chip = h('div', { class: 'maps-weather' });
    const layer = (key: keyof MapsSheet['layers'], label: string) => {
      const b = h('button', { class: `maps-layer${this.layers[key] ? ' on' : ''}`, type: 'button', 'data-layer': key, onclick: () => {
        this.layers[key] = !this.layers[key];
        b.classList.toggle('on', this.layers[key]);
        if (key === 'events' && this.layers.events) this.showToday();
      } }, label);
      return b;
    };
    this.layersBox = h('div', { class: 'maps-layers-box' }, layer('traffic', tr('maps.layer.traffic')), layer('weather', tr('maps.layer.weather')), layer('events', tr('maps.layer.events')));
    this.layersBox.style.display = 'none';
    const round = (icon: string, label: string, run: () => void, cls = '') => h('button', { class: `maps-round ${cls}`, type: 'button', 'aria-label': label, title: label, html: icon, onclick: run });
    this.root = h(
      'div',
      { class: 'maps', role: 'dialog', 'aria-label': tr('maps.title') },
      this.canvas,
      h('div', { class: 'maps-top' },
        h('div', { class: 'maps-bar' },
          h('button', { class: 'maps-back', type: 'button', 'aria-label': tr('maps.close'), html: iconSvg('close', 18), onclick: () => this.close() }),
          this.input),
        this.results,
        this.chip),
      h('div', { class: 'maps-side' },
        round(iconSvg('menu', 18), tr('maps.layers'), () => { this.layersBox.style.display = this.layersBox.style.display === 'none' ? '' : 'none'; }, 'maps-layers'),
        this.layersBox,
        round(iconSvg('clock', 18), tr('maps.timetable'), () => this.showTimetable(), 'maps-timetable'),
        round('+', tr('maps.zoomIn'), () => this.zoomBy(1.6)),
        round('−', tr('maps.zoomOut'), () => this.zoomBy(1 / 1.6)),
        round(iconSvg('walk', 18), tr('maps.me'), () => this.centreOnHero(true), 'maps-me')),
      this.card,
    );
    this.root.style.display = 'none';
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      this.view = zoomAt(this.view, Math.exp(-e.deltaY * 0.0015), [e.clientX - r.left, e.clientY - r.top]);
      this.followHero = false;
    }, { passive: false });
    this.canvas.addEventListener('dblclick', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.view = zoomAt(this.view, 2, [e.clientX - r.left, e.clientY - r.top]);
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  open(): void {
    this.build();
    this.placeHome();
    this.root.style.display = '';
    this.input.value = '';
    this.results.replaceChildren();
    this.card.replaceChildren();
    this.card.style.display = 'none';
    this.selected = null;
    this.route = null;
    // the photos are of today: taken afresh each time the maps open
    this.strip = null;
    this.followHero = true;
    this.resize();
    this.view.zoom = 7;
    this.centreOnHero(false);
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  // ---- data ---------------------------------------------------------------------------------------------------

  private build(): void {
    if (this.atlas) return;
    const c = this.deps.catalog();
    this.locations = c.locations;
    this.residents = Array.isArray(c.residents) ? c.residents : Object.values(c.residents);
    this.stations = Array.isArray(c.stations) ? c.stations : Object.values(c.stations);
    this.atlas = layoutAtlas(this.locations);
    this.places = placeIndex(this.atlas, c);
    for (const [id, p] of this.atlas.maps) this.images.set(id, this.paintMap(p.def));
  }

  /** One's own home among the places, where it is now (one may have moved since the maps were last open). */
  private placeHome(): void {
    this.places = this.places.filter((p) => p.key !== 'home:mine');
    const home = this.deps.home();
    if (home && this.locations[home.loc]) this.places.push(myHomePlace(home));
  }

  /** One map drawn once, `S` pixels a cell: the floors, the kerbs, the buildings, the woods. */
  private paintMap(def: LocationDef): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = def.w * S;
    cv.height = def.h * S;
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    const style = (x: number, y: number) => def.legend[(def.tiles[y] ?? '')[x]];
    const road = (x: number, y: number) => /cobble|asphalt/.test(style(x, y) ?? '');
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        g.fillStyle = floorColor(style(x, y));
        g.fillRect(x * S, y * S, S, S);
      }
    }
    // the kerbs: a fine line where a carriageway meets anything else
    g.fillStyle = '#d6d1c4';
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        if (!road(x, y)) continue;
        if (y > 0 && !road(x, y - 1)) g.fillRect(x * S, y * S, S, 1);
        if (y < def.h - 1 && !road(x, y + 1)) g.fillRect(x * S, y * S + S - 1, S, 1);
        if (x > 0 && !road(x - 1, y)) g.fillRect(x * S, y * S, 1, S);
        if (x < def.w - 1 && !road(x + 1, y)) g.fillRect(x * S + S - 1, y * S, 1, S);
      }
    }
    // the woods: a canopy of soft greens where the trees stand
    const trees = def.props.filter((p) => /^(tree|pine|oak|birch|spruce|fir|bush)/.test(p.item));
    for (const t of trees) {
      g.fillStyle = (t.x * 7 + t.y * 13) % 3 ? '#b9dca6' : '#add596';
      g.beginPath();
      g.arc(t.x * S + S / 2, t.y * S + S / 2, S * 0.95, 0, Math.PI * 2);
      g.fill();
    }
    // the buildings
    for (const s of def.sites ?? []) {
      const b = s.building;
      if (!b) continue;
      g.fillStyle = s.kind === 'home' ? '#e6e1d8' : '#dcd6ca';
      g.strokeStyle = '#c4bcac';
      g.lineWidth = 1;
      g.fillRect(b[0] * S + 1, b[1] * S + 1, b[2] * S - 2, b[3] * S - 2);
      g.strokeRect(b[0] * S + 1.5, b[1] * S + 1.5, b[2] * S - 3, b[3] * S - 3);
    }
    return cv;
  }

  private glyph(name: string): HTMLCanvasElement {
    let cv = this.glyphs.get(name);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = 12;
    cv.height = 12;
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#fff';
    const bits = glyphBits(name);
    for (let i = 0; i < 144; i++) if (bits[i]) g.fillRect(i % 12, Math.floor(i / 12), 1, 1);
    this.glyphs.set(name, cv);
    return cv;
  }

  /** The hero on the atlas (a room or home at its building's door). */
  heroAt(): { p: Pt; loc: string; x: number; y: number } | null {
    const hero = this.deps.hero();
    if (!hero || !this.atlas) return null;
    let { loc, x, y } = hero;
    const def = this.locations[loc];
    if (def?.inside) {
      for (const [l, p] of this.atlas.maps) {
        const s = (p.def.sites ?? []).find((q) => q.id === def.inside);
        if (s) {
          [loc, x, y] = [l, s.x + 0.5, s.y + 1.5];
          break;
        }
      }
    }
    const p = toAtlas(this.atlas, loc, x, y);
    return p ? { p, loc, x, y } : null;
  }

  // ---- the view -------------------------------------------------------------------------------------------------

  private resize(): void {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(r.width));
    const hh = Math.max(200, Math.round(r.height));
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hh * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hh * dpr);
    }
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${hh}px`;
    this.view.w = w;
    this.view.h = hh;
  }

  private zoomBy(f: number): void {
    this.view = zoomAt(this.view, f, [this.view.w / 2, this.view.h / 2]);
  }

  centreOnHero(follow: boolean): void {
    const at = this.heroAt();
    if (at) {
      this.view.cx = at.p[0];
      this.view.cy = at.p[1];
    }
    this.followHero = follow || this.followHero;
  }

  /** The part of the screen the card and the search bar leave free: [x0, y0, x1, y1]. */
  private free(): [number, number, number, number] {
    const v = this.view;
    const card = this.card.style.display !== 'none' || this.selected;
    if (!card) return [10, 70, v.w - 64, v.h - 10];
    return v.w >= 720 ? [430, 64, v.w - 64, v.h - 10] : [10, 64, v.w - 64, v.h * 0.46];
  }

  /** Shows these atlas points in the free part of the screen. */
  private fit(pts: Pt[]): void {
    if (!pts.length) return;
    const v = this.view;
    const [x0, y0, x1, y1] = this.free();
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 6;
    const hh = Math.max(...ys) - Math.min(...ys) + 6;
    v.zoom = Math.max(MIN_ZOOM, Math.min(12, (x1 - x0) / w, (y1 - y0) / hh));
    this.place([(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]);
    this.followHero = false;
  }

  /** Puts an atlas point in the middle of the free part of the screen. */
  private place(p: Pt): void {
    const v = this.view;
    const [x0, y0, x1, y1] = this.free();
    v.cx = p[0] - ((x0 + x1) / 2 - v.w / 2) / v.zoom;
    v.cy = p[1] - ((y0 + y1) / 2 - v.h / 2) / v.zoom;
  }

  private centreOn(p: Pt, zoom?: number): void {
    if (zoom) this.view.zoom = Math.max(this.view.zoom, zoom);
    this.place(p);
    this.followHero = false;
  }

  private local(e: PointerEvent): Pt {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, this.local(e));
    this.moved = 0;
    this.layersBox.style.display = 'none';
  }

  private move(e: PointerEvent): void {
    const was = this.pointers.get(e.pointerId);
    if (!was) return;
    const now = this.local(e);
    if (this.pointers.size >= 2) {
      // a pinch: the zoom follows the fingers' spread, about their middle
      const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      const o = others[0];
      const before = Math.hypot(was[0] - o[0], was[1] - o[1]);
      const after = Math.hypot(now[0] - o[0], now[1] - o[1]);
      if (before > 4) this.view = zoomAt(this.view, after / before, [(now[0] + o[0]) / 2, (now[1] + o[1]) / 2]);
      this.view = pan(this.view, (now[0] - was[0]) / 2, (now[1] - was[1]) / 2);
    } else {
      this.view = pan(this.view, now[0] - was[0], now[1] - was[1]);
    }
    this.moved += Math.abs(now[0] - was[0]) + Math.abs(now[1] - was[1]);
    if (this.moved > 6) this.followHero = false;
    this.pointers.set(e.pointerId, now);
  }

  private up(e: PointerEvent): void {
    const at = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!at || this.moved > 8 || this.pointers.size) return;
    // a tap: the pin under it, or nothing (the card goes)
    const hit = this.pinAt(at);
    if (hit) this.select(hit);
    else if (!this.route) {
      this.selected = null;
      this.card.style.display = 'none';
    }
  }

  /** The pins shown at this zoom. */
  private pins(): Place[] {
    const z = this.view.zoom;
    return this.places.filter((p) => {
      if (p.kind === 'map') return z < 5;
      if (p.kind !== 'site') return false;
      if (z >= 4) return true;
      return z >= 2.2 && ['myhome', 'cafe', 'hospital', 'grocery', 'market', 'townhall', 'cinema', 'post', 'school', 'church', 'park', 'hippodrome'].includes(p.sort);
    });
  }

  private pinAt(s: Pt): Place | null {
    if (!this.atlas) return null;
    let best: Place | null = null;
    let dist = 22;
    for (const p of this.pins()) {
      const a = toAtlas(this.atlas, p.loc, p.x + 0.5, p.y + 0.5);
      if (!a) continue;
      const q = project(this.view, a);
      const d = Math.hypot(q[0] - s[0], q[1] - s[1] + 10);
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    return best;
  }

  // ---- search and the card --------------------------------------------------------------------------------------

  private showResults(): void {
    const found = search(this.places, this.input.value);
    this.results.replaceChildren(...found.map((p) => {
      const [colour, glyph] = pinStyle(p.kind === 'street' ? 'street' : p.sort);
      return h('button', { class: 'maps-result', type: 'button', 'data-key': p.key, onclick: () => this.select(p) },
        h('span', { class: 'maps-dot', style: { background: p.kind === 'street' ? '#80868b' : colour }, html: iconSvg(p.kind === 'street' ? 'walk' : p.kind === 'person' ? 'person' : glyph, 14, '#fff') }),
        h('span', { class: 'maps-result-text' }, h('b', null, p.name), h('small', null, `${p.what}${p.loc !== 'village' ? ` · ${this.locations[p.loc]?.name ?? ''}` : ''}`)));
    }));
    if (this.input.value.trim() && !found.length) this.results.append(h('p', { class: 'maps-none' }, tr('maps.none')));
  }

  /** Opens a place's card and shows it on the map. */
  select(p: Place): void {
    this.selected = p;
    this.route = null;
    this.results.replaceChildren();
    this.input.value = p.name;
    this.input.blur();
    const a = this.atlas ? toAtlas(this.atlas, p.loc, p.x + 0.5, p.y + 0.5) : null;
    if (a) this.centreOn(a, p.kind === 'map' ? 3 : 7);
    this.renderCard();
  }

  private siteOf(p: Place): SiteWithJobs | undefined {
    if (!p.site) return undefined;
    return this.atlas?.maps.get(p.loc)?.def.sites?.find((s) => s.id === p.site) as SiteWithJobs | undefined;
  }

  /** Whether the hours' table under the card is unfolded (it stays so from place to place). */
  private weekOpen = false;
  /** The photos shown on the card, kept while it is the same place (a route redraws the card). */
  private strip: { key: string; el: HTMLElement } | null = null;

  private status(site: SiteWithJobs): { open: boolean; text: string } {
    return openStatus(site, this.deps.minute(), this.deps.weekday());
  }

  /** The week's hours, today first in bold, folded under one line with today's. */
  private weekBox(site: SiteWithJobs): HTMLElement {
    const week = weekHours(site);
    const today = this.deps.weekday();
    const names = tr('maps.weekdays').split(',');
    const box = h('details', { class: 'maps-week' },
      h('summary', null, h('b', null, tr('maps.hours')), ` · ${tr('maps.today').toLowerCase()} ${dayHoursText(week[today])}`),
      h('table', null, h('tbody', null, ...week.map((d, i) => h('tr', { class: `${i === today ? 'today' : ''}${d ? '' : ' off'}`.trim() || null }, h('td', null, names[i]), h('td', null, dayHoursText(d)))))));
    (box as HTMLDetailsElement).open = this.weekOpen;
    box.addEventListener('toggle', () => (this.weekOpen = (box as HTMLDetailsElement).open));
    return box;
  }

  /** What the camera takes of a place: the front by day, the room inside with those at work, the front by night. */
  shots(p: Place): { label: string; shot: Shot }[] {
    if (!this.locations[p.loc]) return [];
    const site = this.siteOf(p);
    const out: { label: string; shot: Shot }[] = [];
    const front: [number, number] = site ? [site.x, site.y] : [p.x, p.y];
    out.push({ label: tr('maps.photo.out'), shot: { place: p.loc, at: front, people: [], minute: 13 * 60 } });
    const room = site ? Object.values(this.locations).find((l) => l.inside === site.id) : undefined;
    if (site && room) {
      const day = weekHours(site)[this.deps.weekday()] ?? weekHours(site).find(Boolean) ?? null;
      const minute = day && day.to - day.from < 1440 ? Math.round(day.from + Math.min(day.to - day.from, 240) / 2) % 1440 : 13 * 60;
      const staff = this.residents.filter((r) => r.job?.[0] === site.id).map((r) => r.id).slice(0, 3);
      out.push({ label: tr('maps.photo.in'), shot: { place: room.id, at: null, people: staff, minute } });
    }
    out.push({ label: tr('maps.photo.evening'), shot: { place: p.loc, at: front, people: [], minute: 21 * 60 + 30 } });
    return out;
  }

  /** The photos of a place, coming one after another as the camera takes them; a touch shows one big. */
  private photoStrip(p: Place): HTMLElement | null {
    if (this.strip?.key === p.key) return this.strip.el;
    const shots = this.shots(p);
    if (!shots.length) return null;
    const el = h('div', { class: 'maps-photos' });
    for (const s of shots) {
      const fig = h('button', { class: 'maps-photo', type: 'button', 'aria-label': tr('maps.photo.of', { place: p.name, what: s.label }) }, h('span', null, s.label));
      el.append(fig);
      void this.deps.photo(s.shot).then((url) => {
        if (!url) {
          fig.remove();
          return;
        }
        fig.prepend(h('img', { src: url, alt: '' }));
        fig.classList.add('ready');
        fig.addEventListener('click', () => this.showBig(url, `${p.name} · ${s.label}`));
      });
    }
    this.strip = { key: p.key, el };
    return el;
  }

  private showBig(url: string, caption: string): void {
    const big = h('button', { class: 'maps-big', type: 'button', 'aria-label': tr('panels.close'), onclick: () => big.remove() }, h('img', { src: url, alt: caption }), h('span', null, caption));
    this.root.append(big);
  }

  private renderCard(): void {
    const p = this.selected;
    if (!p) return;
    const kids: (HTMLElement | null)[] = [];
    kids.push(h('div', { class: 'maps-card-head' },
      h('div', null, h('b', { class: 'maps-card-name' }, p.name), h('small', null, `${p.what}${p.loc !== 'village' ? ` · ${this.locations[p.loc]?.name ?? ''}` : ''}`)),
      h('button', { class: 'maps-x', type: 'button', 'aria-label': tr('maps.closeCard'), html: iconSvg('close', 16), onclick: () => { this.selected = null; this.route = null; this.card.style.display = 'none'; } })));
    const site = this.siteOf(p);
    if (site) {
      const st = this.status(site);
      kids.push(h('p', { class: 'maps-hours' }, h('b', { class: st.open ? 'open' : 'shut' }, st.open ? tr('maps.open') : tr('maps.shut')), st.text ? ` · ${st.text}` : ''));
    }
    kids.push(this.photoStrip(p));
    if (site) {
      if (site.about) kids.push(h('p', { class: 'maps-about' }, site.about));
      if (site.jobs?.length) kids.push(this.weekBox(site));
      const room = Object.values(this.locations).find((l) => l.inside === site.id);
      const here = room ? [...new Set(this.stations.filter((s) => s.location === room.id).map((s) => s.label))].slice(0, 5) : [];
      if (here.length) kids.push(h('p', { class: 'maps-what' }, h('b', null, tr('maps.here')), here.join(' · ')));
      const staff = this.residents.filter((r) => r.job?.[0] === site.id).map((r) => r.name).slice(0, 4);
      if (staff.length) kids.push(h('p', { class: 'maps-what' }, h('b', null, tr('maps.staff')), staff.join(', ')));
    }
    const today = this.layers.events && this.atlas ? happenings(this.atlas, this.deps.minute(), this.deps.weekday(), this.deps.festival()).filter((x) => x.loc === p.loc && Math.abs(x.x - p.x) + Math.abs(x.y - p.y) <= 6) : [];
    for (const x of today) kids.push(h('p', { class: 'maps-event' }, h('b', null, x.title), ` · ${x.when}`));
    if (this.route) kids.push(this.routeBox());
    kids.push(h('div', { class: 'maps-actions' },
      h('button', { class: 'maps-btn primary maps-go', type: 'button', onclick: () => this.showRoute() }, tr('maps.route')),
      h('button', { class: 'maps-btn maps-taxi-here', type: 'button', onclick: () => this.showRoute(true) }, tr('maps.taxiHere'))));
    this.card.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
    this.card.style.display = '';
  }

  /** Every place that keeps hours, open ones first, each with when it opens or closes; a touch opens its card. */
  showTimetable(openOnly = true): void {
    this.build();
    this.selected = null;
    this.route = null;
    const sites = this.places.filter((p) => p.kind === 'site' && this.siteOf(p)?.jobs?.length);
    const rows = sites.map((p) => ({ p, st: this.status(this.siteOf(p)!) })).filter((r) => !openOnly || r.st.open);
    rows.sort((a, b) => Number(b.st.open) - Number(a.st.open) || a.p.name.localeCompare(b.p.name, 'uk'));
    const chip = (label: string, on: boolean, only: boolean) => h('button', { class: `maps-layer${on ? ' on' : ''}`, type: 'button', 'data-filter': only ? 'open' : 'all', onclick: () => this.showTimetable(only) }, label);
    this.card.replaceChildren(
      h('div', { class: 'maps-card-head' }, h('b', { class: 'maps-card-name' }, tr('maps.timetableTitle')),
        h('button', { class: 'maps-x', type: 'button', 'aria-label': tr('panels.close'), html: iconSvg('close', 16), onclick: () => { this.card.style.display = 'none'; } })),
      h('div', { class: 'maps-filter' }, chip(tr('maps.openNowOnly'), openOnly, true), chip(tr('maps.everything'), !openOnly, false)),
      ...(rows.length ? rows.map(({ p, st }) => h('button', { class: 'maps-slot', type: 'button', 'data-site': p.site ?? '', onclick: () => this.select(p) },
        h('b', null, p.name), h('small', null, p.what), h('em', { class: st.open ? 'open' : 'shut' }, st.open ? tr('maps.open') : tr('maps.shut'), h('br', null), st.text))) : [h('p', { class: 'maps-none' }, tr('maps.nothingOpen'))]),
    );
    this.card.style.display = '';
    this.card.scrollTop = 0;
  }

  /** The taxi stop for a place: its own door, or the stop nearest it on its map. */
  taxiFor(p: Place, list: TaxiQuoteView[]): TaxiQuoteView | null {
    const own = p.key === 'home:mine' ? list.find((d) => d.id === 'taxi.home') : p.site ? list.find((d) => d.id === `site:${p.site}`) : undefined;
    if (own) return own;
    let best: TaxiQuoteView | null = null;
    let dist = p.kind === 'map' ? 999 : 10;
    for (const d of list) {
      if (d.location !== p.loc) continue;
      const k = Math.abs(d.x - p.x) + Math.abs(d.y - p.y);
      if (k < dist) {
        dist = k;
        best = d;
      }
    }
    return best;
  }

  /** The walk there drawn on the map, with its minutes, and the taxi's price there now. */
  showRoute(taxi = false): void {
    const p = this.selected;
    const me = this.heroAt();
    const hero = this.deps.hero();
    if (!p || !this.atlas) return;
    const from = hero && this.locations[hero.loc] && hero.loc !== 'home' ? { loc: hero.loc, x: Math.floor(hero.x), y: Math.floor(hero.y) } : me ? { loc: me.loc, x: Math.floor(me.x), y: Math.floor(me.y) } : null;
    this.route = from ? walkRoute(this.atlas, this.locations, from, { loc: p.loc, x: p.x, y: p.y }) : null;
    this.renderCard();
    // the whole way in view, beside the card
    if (this.route && me) this.fit(this.route.lines.flat());
    if (taxi) this.card.querySelector('.maps-call')?.scrollIntoView({ block: 'nearest' });
  }

  private routeBox(): HTMLElement {
    const p = this.selected!;
    const r = this.route!;
    const walk = h('p', { class: 'maps-walk' }, h('span', { html: iconSvg('walk', 16) }), tr('maps.walk', { min: walkMinutes(r.tiles) }));
    const q = this.deps.quotes();
    const stop = this.taxiFor(p, q.list);
    let taxi: HTMLElement;
    if (q.refusal) taxi = h('p', { class: 'maps-taxi-note' }, q.refusal);
    else if (!stop) taxi = h('p', { class: 'maps-taxi-note' }, r.tiles < 14 ? tr('maps.nearby') : tr('maps.noTaxi'));
    else if (stop.shut) taxi = h('p', { class: 'maps-taxi-note' }, stop.shut);
    else {
      taxi = h('div', { class: 'maps-taxi', 'data-fare': String(stop.fare), 'data-eta': String(stop.eta) },
        h('p', null, h('span', { html: iconSvg('taxi', 16) }), tr('maps.taxiRide', { min: stop.minutes, eta: stop.eta })),
        stop.why ? h('small', { class: `maps-why ${stop.trend > 0 ? 'up' : stop.trend < 0 ? 'down' : ''}` }, stop.why) : null,
        h('button', { class: 'maps-btn primary maps-call', type: 'button', 'data-id': stop.id, onclick: () => { this.close(); this.deps.ride(stop.id); } },
          h('span', null, tr('maps.callTaxi')), h('span', { class: 'maps-fare', html: `${iconSvg('coin', 14)} ${stop.fare}` })));
    }
    return h('div', { class: 'maps-route' }, walk, taxi);
  }

  private showToday(): void {
    if (!this.atlas) return;
    const list = happenings(this.atlas, this.deps.minute(), this.deps.weekday(), this.deps.festival());
    this.selected = null;
    this.route = null;
    this.card.replaceChildren(
      h('div', { class: 'maps-card-head' }, h('b', { class: 'maps-card-name' }, tr('maps.todayIn')),
        h('button', { class: 'maps-x', type: 'button', 'aria-label': tr('panels.close'), html: iconSvg('close', 16), onclick: () => { this.card.style.display = 'none'; } })),
      ...list.map((x) => h('button', { class: 'maps-today', type: 'button', onclick: () => {
        const place = this.places.find((p) => p.loc === x.loc && Math.abs(p.x - x.x) + Math.abs(p.y - x.y) <= 4 && p.kind === 'site') ?? { key: `ev:${x.key}`, name: x.title, what: x.when, kind: 'landmark' as const, sort: 'landmark', loc: x.loc, x: x.x, y: x.y, words: '' };
        this.select(place);
      } }, h('b', null, x.title), h('small', null, x.when))),
    );
    this.card.style.display = '';
  }

  // ---- drawing --------------------------------------------------------------------------------------------------

  private draw(): void {
    if (!this.atlas) return;
    this.resize();
    const v = this.view;
    const hero = this.heroAt();
    if (hero) {
      if (this.last && Math.hypot(hero.p[0] - this.last[0], hero.p[1] - this.last[1]) > 0.04) this.heading = Math.atan2(hero.p[1] - this.last[1], hero.p[0] - this.last[0]);
      else if (!this.last) this.heading = this.deps.hero()?.facing === 'left' ? Math.PI : 0;
      this.last = hero.p;
      if (this.followHero) {
        v.cx = hero.p[0];
        v.cy = hero.p[1];
      }
    }
    const g = this.ctx;
    this.labelled = [];
    const dpr = this.canvas.width / v.w;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = LAND;
    g.fillRect(0, 0, v.w, v.h);
    // the roads between the maps
    const line = (pts: Pt[], width: number, colour: string) => {
      g.beginPath();
      pts.forEach((p, i) => {
        const s = project(v, p);
        if (i) g.lineTo(s[0], s[1]);
        else g.moveTo(s[0], s[1]);
      });
      g.strokeStyle = colour;
      g.lineWidth = width;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.stroke();
    };
    for (const r of this.atlas.roads) line(r, Math.max(3, v.zoom * 2.2) + 2, '#d6d1c4');
    for (const r of this.atlas.roads) line(r, Math.max(3, v.zoom * 2.2), '#fff');
    // the maps
    g.imageSmoothingEnabled = v.zoom < S;
    for (const [id, p] of this.atlas.maps) {
      const a = project(v, [p.ox, p.oy]);
      const w = p.def.w * v.zoom;
      const hh = p.def.h * v.zoom;
      if (a[0] > v.w || a[1] > v.h || a[0] + w < 0 || a[1] + hh < 0) continue;
      g.drawImage(this.images.get(id)!, a[0], a[1], w, hh);
    }
    // the traffic: how busy each street is, and the cars on it
    if (this.layers.traffic) this.drawTraffic();
    // the route
    if (this.route) for (const l of this.route.lines) {
      line(l, Math.max(5, v.zoom * 0.9) + 3, '#1557b0');
      line(l, Math.max(5, v.zoom * 0.9), '#4c8df6');
    }
    this.drawLabels();
    this.drawPins();
    if (this.layers.events) this.drawEvents();
    if (hero) this.drawHero(project(v, hero.p));
    if (this.layers.weather) this.drawWeather();
    else this.chip.style.display = 'none';
  }

  /** Labels drawn this frame (a label that would overlap one is left out). */
  private labelled: [number, number, number, number][] = [];

  /** A label that keeps clear of the others; false when there was no room for it. */
  private label(s: string, x: number, y: number, size: number, colour: string, weight = 600): boolean {
    const g = this.ctx;
    g.font = `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    const w = g.measureText(s).width / 2 + 2;
    const box: [number, number, number, number] = [x - w, y - size / 2 - 1, x + w, y + size / 2 + 1];
    if (this.labelled.some((b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) return false;
    this.labelled.push(box);
    this.text(s, x, y, size, colour, weight);
    return true;
  }

  private text(s: string, x: number, y: number, size: number, colour = '#3c4043', weight = 600, angle = 0): void {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    if (angle) g.rotate(angle);
    g.font = `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.strokeText(s, 0, 0);
    g.fillStyle = colour;
    g.fillText(s, 0, 0);
    g.restore();
  }

  private drawLabels(): void {
    const v = this.view;
    for (const [, p] of this.atlas!.maps) {
      // the map's name when far out
      if (v.zoom < 4.5) {
        const c = project(v, [p.ox + p.def.w / 2, p.oy + p.def.h / 2]);
        this.text(p.def.name, c[0], c[1], p.def.id === 'village' ? 15 : 13, '#202124', 700);
      }
      if (v.zoom < 3.2) continue;
      // the streets, named along their middle (where they are in view)
      for (const [id, l] of Object.entries(p.def.landmarks ?? {})) {
        if (!id.endsWith('_street')) continue;
        const across = l.w >= l.h;
        const a = project(v, [p.ox + l.x, p.oy + l.y]);
        const b = project(v, [p.ox + l.x + l.w, p.oy + l.y + l.h]);
        if (b[0] < 0 || b[1] < 0 || a[0] > v.w || a[1] > v.h) continue;
        const size = Math.max(10, Math.min(14, v.zoom * 1.4));
        if (across) {
          const x = Math.max(a[0] + 60, Math.min(b[0] - 60, v.w / 2));
          this.label(l.name, x, (a[1] + b[1]) / 2, size, '#5f6368', 500);
        } else {
          const y = Math.max(a[1] + 60, Math.min(b[1] - 60, v.h / 2));
          this.text(l.name, (a[0] + b[0]) / 2, y, size, '#5f6368', 500, -Math.PI / 2);
        }
      }
      // water and parks by name
      if (v.zoom >= 5) {
        for (const id of ['lake', 'park', 'river', 'square', 'hill', 'training_ground']) {
          const l = p.def.landmarks?.[id];
          if (!l) continue;
          const c = project(v, [p.ox + l.x + l.w / 2, p.oy + l.y + l.h / 2]);
          this.text(l.name, c[0], c[1], 11, id === 'lake' || id === 'river' ? '#1a6fb0' : '#2d7d46', 500);
        }
      }
    }
  }

  private pinXY(p: Place): Pt | null {
    const a = toAtlas(this.atlas!, p.loc, p.x + 0.5, p.y + 0.5);
    return a ? project(this.view, a) : null;
  }

  private drawPin(s: Pt, colour: string, glyph: string, big: boolean): void {
    const g = this.ctx;
    const r = big ? 14 : 10;
    const y = s[1] - r - 3;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(s[0], s[1], r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colour;
    g.beginPath();
    g.arc(s[0], y, r, Math.PI * 0.8, Math.PI * 2.2);
    g.lineTo(s[0], s[1]);
    g.closePath();
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.stroke();
    g.imageSmoothingEnabled = false;
    const k = big ? 14 : 12;
    g.drawImage(this.glyph(glyph), s[0] - k / 2, y - k / 2, k, k);
  }

  private drawPins(): void {
    const v = this.view;
    const list = this.pins();
    const sel = this.selected ? this.pinXY(this.selected) : null;
    if (sel) this.labelled.push([sel[0] - 70, sel[1] + 3, sel[0] + 70, sel[1] + 19]);
    for (const p of list) {
      if (p === this.selected) continue;
      const s = this.pinXY(p);
      if (!s || s[0] < -20 || s[1] < -20 || s[0] > v.w + 20 || s[1] > v.h + 40) continue;
      const [colour, glyph] = pinStyle(p.sort);
      this.drawPin(s, colour, glyph, false);
      if (v.zoom >= 7.5) this.label(p.name, s[0], s[1] + 9, 11, colour, 600);
    }
    if (this.selected) {
      const s = this.pinXY(this.selected);
      if (s) {
        this.drawPin(s, '#ea4335', this.selected.kind === 'site' ? pinStyle(this.selected.sort)[1] : 'pin', true);
        this.text(this.selected.name, s[0], s[1] + 11, 12, '#c5221f', 700);
      }
    }
  }

  private drawHero(s: Pt): void {
    const g = this.ctx;
    g.fillStyle = 'rgba(66,133,244,0.16)';
    g.beginPath();
    g.arc(s[0], s[1], 22, 0, Math.PI * 2);
    g.fill();
    // the way one faces: a soft beam
    const grad = g.createRadialGradient(s[0], s[1], 4, s[0], s[1], 30);
    grad.addColorStop(0, 'rgba(66,133,244,0.55)');
    grad.addColorStop(1, 'rgba(66,133,244,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(s[0], s[1]);
    g.arc(s[0], s[1], 30, this.heading - 0.55, this.heading + 0.55);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(s[0], s[1], 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#4285f4';
    g.beginPath();
    g.arc(s[0], s[1], 6.5, 0, Math.PI * 2);
    g.fill();
  }

  private drawTraffic(): void {
    const g = this.ctx;
    const v = this.view;
    const cars = this.deps.traffic();
    // each named street coloured by how many are on it: free, busy, a jam
    const vil = this.atlas!.maps.get('village');
    if (vil) {
      for (const [id, l] of Object.entries(vil.def.landmarks ?? {})) {
        if (!id.endsWith('_street')) continue;
        const n = cars.filter((c) => c.loc === 'village' && c.x >= l.x - 1 && c.x <= l.x + l.w + 1 && c.y >= l.y - 1 && c.y <= l.y + l.h + 1).length;
        const colour = n >= 5 ? '#ea4335' : n >= 2 ? '#f9ab00' : '#34a853';
        const across = l.w >= l.h;
        const a: Pt = across ? [vil.ox + l.x, vil.oy + l.y + l.h / 2] : [vil.ox + l.x + l.w / 2, vil.oy + l.y];
        const b: Pt = across ? [vil.ox + l.x + l.w, a[1]] : [a[0], vil.oy + l.y + l.h];
        const sa = project(v, a);
        const sb = project(v, b);
        g.strokeStyle = colour;
        g.globalAlpha = 0.75;
        g.lineWidth = Math.max(2.5, v.zoom * 0.7);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(sa[0], sa[1]);
        g.lineTo(sb[0], sb[1]);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    for (const c of cars) {
      const a = toAtlas(this.atlas!, c.loc, c.x, c.y);
      if (!a) continue;
      const s = project(v, a);
      g.fillStyle = '#3c4043';
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(s[0], s[1], Math.max(3, Math.min(6, v.zoom * 0.5)), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  private drawEvents(): void {
    const list: Happening[] = happenings(this.atlas!, this.deps.minute(), this.deps.weekday(), this.deps.festival());
    for (const x of list) {
      const a = toAtlas(this.atlas!, x.loc, x.x + 0.5, x.y + 0.5);
      if (!a) continue;
      const s = project(this.view, a);
      this.drawPin([s[0] + 12, s[1] - 18], '#9334e6', 'sparkle', false);
      if (this.view.zoom >= 3) this.label(x.title, s[0] + 12, s[1] - 48, 11, '#7627bb', 700);
    }
  }

  private drawWeather(): void {
    const w = this.deps.weather();
    const g = this.ctx;
    const v = this.view;
    const t = performance.now() / 1000;
    this.chip.style.display = '';
    const now = has(`maps.sky.${w.sky}`) ? tr(`maps.sky.${w.sky}`) : w.words;
    this.chip.textContent = w.words && !now.toLowerCase().startsWith(w.words.toLowerCase()) ? tr('maps.weatherToday', { now, words: w.words }) : now;
    this.chip.dataset.sky = w.sky;
    if (w.sky === 'rain' || w.sky === 'storm') {
      g.fillStyle = w.sky === 'storm' ? 'rgba(40,60,90,0.16)' : 'rgba(60,90,130,0.08)';
      g.fillRect(0, 0, v.w, v.h);
      g.strokeStyle = 'rgba(70,110,170,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = ((i * 137.5 + t * 60) % (v.w + 40)) - 20;
        const y = ((i * 89.3 + t * 420) % (v.h + 40)) - 20;
        g.moveTo(x, y);
        g.lineTo(x - 3, y + 10);
      }
      g.stroke();
    } else if (w.sky === 'snow') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 60; i++) {
        const x = ((i * 137.5 + Math.sin(t + i) * 12) % v.w + v.w) % v.w;
        const y = ((i * 89.3 + t * 40) % (v.h + 20)) - 10;
        g.beginPath();
        g.arc(x, y, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    } else if (w.sky === 'fog') {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, v.w, v.h);
    } else if (w.sky === 'cloudy') {
      g.fillStyle = 'rgba(120,130,150,0.06)';
      g.fillRect(0, 0, v.w, v.h);
    }
  }
}
