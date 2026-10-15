// The paper map the hero carries: Lypove and its surroundings drawn like a folded tourist map — paper, ink lines,
// watercolour washes, hand-lettered names, a compass rose — with «Ви тут». A place tapped shows its name and the
// way to it; «Прокласти шлях» draws the walk on the paper and leaves a guide in the world until one gets there.
// The data and the walking routes are those of «Мапи» (maps/model.ts); only the look is the paper's.

import { iconSvg } from '../icons';
import { t } from '../i18n';
import { layoutAtlas, myHomePlace, openStatus, placeIndex, walkRoute, type Atlas, type Place, type Pt, type Route } from '../maps/model';
import type { LocationDef, ResidentDef, StationDef } from '../types';
import { h } from './dom';
import { pinStyle } from './maps';

export interface PaperMapDeps {
  catalog(): { locations: Record<string, LocationDef>; residents: ResidentDef[] | Record<string, ResidentDef>; stations: Record<string, StationDef> | StationDef[] };
  /** Where the hero is (indoors: at the door of the building). */
  hero(): { loc: string; x: number; y: number } | null;
  /** Leaves a guide in the world to this place (null clears it). */
  guide(to: { loc: string; x: number; y: number; name: string } | null): void;
  /** The door of where one lives now, and the home's own name if it has one. */
  home(): { loc: string; x: number; y: number; name: string | null } | null;
  /** The minute of the day and the weekday (0 Monday … 6 Sunday), for whether a place is open. */
  clock(): { minute: number; weekday: number };
}

/** Tiles per paper pixel at the start, and the paper's own pixels per tile in its cached drawing. */
const BASE = 4;

/** The washes and inks of the paper by what a cell is. */
export function paperColour(style: string): string {
  if (/water/.test(style)) return '#9ec4d2';
  if (/ice/.test(style)) return '#cfe2ea';
  if (/cobble|asphalt|road/.test(style)) return '#b89c6c';
  if (/plaza|stone|tile|concrete/.test(style)) return '#e2d2a8';
  if (/path|gravel|dirt|soil/.test(style)) return '#d4bd8c';
  if (/sand|deck/.test(style)) return '#ead9a6';
  if (/moss|forest/.test(style)) return '#a9bd88';
  if (/meadow/.test(style)) return '#c8d49e';
  return '#d3dcaa';
}

export class PaperMapSheet {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly card: HTMLElement;
  private atlas: Atlas | null = null;
  private places: Place[] = [];
  private paper: HTMLCanvasElement | null = null;
  private view = { cx: 0, cy: 0, zoom: 4 };
  private route: Route | null = null;
  private picked: Place | null = null;
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  private readonly index: HTMLElement;
  /** The little white signs inside the pins, drawn once per kind of place. */
  private readonly glyphs = new Map<string, HTMLImageElement>();

  constructor(parent: HTMLElement, private readonly deps: PaperMapDeps) {
    this.canvas = h('canvas', { class: 'paper-map-canvas' }) as HTMLCanvasElement;
    this.card = h('div', { class: 'paper-map-card' });
    this.index = h('div', { class: 'paper-map-index' });
    this.index.style.display = 'none';
    this.root = h(
      'div',
      { class: 'settings paper-map', role: 'dialog', 'aria-label': t('papermap.title') },
      h('div', { class: 'paper-map-sheet' },
        h('div', { class: 'paper-map-head' },
          h('b', null, t('papermap.title')),
          h('div', { class: 'paper-map-tools' },
            h('button', { class: 'paper-map-btn', type: 'button', 'aria-label': t('papermap.zoomIn'), onclick: () => this.zoomBy(1.4) }, '+'),
            h('button', { class: 'paper-map-btn', type: 'button', 'aria-label': t('papermap.zoomOut'), onclick: () => this.zoomBy(1 / 1.4) }, '−'),
            h('button', { class: 'paper-map-btn', type: 'button', 'aria-label': t('papermap.here'), onclick: () => this.centreOnHero() }, '◎'),
            h('button', { class: 'paper-map-btn wide', type: 'button', 'aria-label': t('papermap.index'), onclick: () => this.toggleIndex() }, t('papermap.index')),
            h('button', { class: 'paper-map-btn', type: 'button', 'aria-label': t('papermap.close'), html: iconSvg('close', 16), onclick: () => this.close() }))),
        this.canvas,
        this.index,
        this.card),
    );
    this.root.style.display = 'none';
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.view.cx = this.drag.cx - (e.clientX - this.drag.x) / this.view.zoom;
      this.view.cy = this.drag.cy - (e.clientY - this.drag.y) / this.view.zoom;
      this.draw();
    });
    this.canvas.addEventListener('pointerup', (e) => {
      const moved = this.drag && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6;
      this.drag = null;
      if (!moved) this.tap(e.offsetX, e.offsetY);
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  open(): void {
    const c = this.deps.catalog();
    if (!this.atlas) {
      this.atlas = layoutAtlas(c.locations);
      this.places = placeIndex(this.atlas, { locations: c.locations, residents: c.residents, stations: c.stations }).filter((p) => p.kind === 'site' || p.kind === 'map' || p.kind === 'street');
      this.paper = this.paint(this.atlas);
    }
    // one's own home, where it is now
    this.places = this.places.filter((p) => p.key !== 'home:mine');
    const home = this.deps.home();
    if (home && this.atlas.maps.has(home.loc)) this.places.push(myHomePlace(home));
    this.root.style.display = '';
    this.fit();
    this.centreOnHero();
    this.showCard();
  }

  private fit(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    const town = this.atlas?.maps.get('village');
    if (town) this.view.zoom = Math.max(2, Math.min(r.width / town.def.w, r.height / town.def.h) * 0.95);
  }

  private heroAt(): Pt | null {
    const hero = this.deps.hero();
    const p = hero && this.atlas?.maps.get(hero.loc);
    return hero && p ? [p.ox + hero.x, p.oy + hero.y] : null;
  }

  private centreOnHero(): void {
    const at = this.heroAt();
    const town = this.atlas?.maps.get('village');
    const c: Pt = at ?? (town ? [town.ox + town.def.w / 2, town.oy + town.def.h / 2] : [0, 0]);
    this.view.cx = c[0];
    this.view.cy = c[1];
    this.draw();
  }

  private zoomBy(k: number): void {
    this.view.zoom = Math.max(1.2, Math.min(28, this.view.zoom * k));
    this.draw();
  }

  /** The whole atlas painted once on paper at BASE pixels a tile: washes, ink outlines of buildings, roads. */
  private paint(atlas: Atlas): HTMLCanvasElement {
    const b = atlas.bounds;
    const c = document.createElement('canvas');
    c.width = Math.ceil((b.x1 - b.x0) * BASE);
    c.height = Math.ceil((b.y1 - b.y0) * BASE);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    // the roads between the maps: country lanes in ink
    g.strokeStyle = '#a8895a';
    g.lineWidth = BASE * 1.6;
    g.setLineDash([BASE * 2, BASE]);
    for (const road of atlas.roads) {
      g.beginPath();
      road.forEach(([x, y], i) => (i ? g.lineTo((x - b.x0) * BASE, (y - b.y0) * BASE) : g.moveTo((x - b.x0) * BASE, (y - b.y0) * BASE)));
      g.stroke();
    }
    g.setLineDash([]);
    for (const p of atlas.maps.values()) {
      const d = p.def;
      const ox = (p.ox - b.x0) * BASE;
      const oy = (p.oy - b.y0) * BASE;
      for (let y = 0; y < d.h; y++) {
        const row = d.tiles[y] ?? '';
        for (let x = 0; x < d.w; x++) {
          g.fillStyle = paperColour(d.legend[row[x]] ?? '');
          g.fillRect(ox + x * BASE, oy + y * BASE, BASE, BASE);
        }
      }
      // trees as little ink circles on the forests and parks
      g.fillStyle = 'rgba(70, 96, 52, 0.55)';
      for (const pr of d.props) {
        if (!pr.item.startsWith('tree_')) continue;
        g.beginPath();
        g.arc(ox + (pr.x + 0.5) * BASE, oy + (pr.y + 0.5) * BASE, BASE * 0.55, 0, Math.PI * 2);
        g.fill();
      }
      // buildings: a warm wash with an ink outline and a little hatching
      for (const s of d.sites ?? []) {
        if (!s.building) continue;
        const [bx, by, bw, bh] = s.building;
        const X = ox + bx * BASE;
        const Y = oy + by * BASE;
        g.fillStyle = s.kind === 'home' ? '#e7c9a0' : '#dba679';
        g.fillRect(X, Y, bw * BASE, bh * BASE);
        g.strokeStyle = '#5a3e26';
        g.lineWidth = 1;
        g.strokeRect(X + 0.5, Y + 0.5, bw * BASE - 1, bh * BASE - 1);
        g.strokeStyle = 'rgba(90, 62, 38, 0.35)';
        for (let k = 3; k < bw * BASE + bh * BASE; k += 4) {
          g.beginPath();
          g.moveTo(X + Math.min(k, bw * BASE), Y + Math.max(0, k - bw * BASE));
          g.lineTo(X + Math.max(0, k - bh * BASE), Y + Math.min(k, bh * BASE));
          g.stroke();
        }
      }
    }
    return c;
  }

  private draw(): void {
    const g = this.canvas.getContext('2d');
    if (!g || !this.atlas || !this.paper) return;
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the paper itself
    g.fillStyle = '#efe2bf';
    g.fillRect(0, 0, W, H);
    const b = this.atlas.bounds;
    const z = this.view.zoom;
    const sx = (x: number) => (x - this.view.cx) * z + W / 2;
    const sy = (y: number) => (y - this.view.cy) * z + H / 2;
    g.imageSmoothingEnabled = z < BASE;
    g.globalAlpha = 0.95;
    g.drawImage(this.paper, sx(b.x0), sy(b.y0), (b.x1 - b.x0) * z, (b.y1 - b.y0) * z);
    g.globalAlpha = 1;
    // the folds of the paper and its aged edges
    g.strokeStyle = 'rgba(120, 96, 60, 0.18)';
    g.lineWidth = 1;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath();
      g.moveTo(W * k, 0);
      g.lineTo(W * k, H);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(110, 80, 40, 0.28)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // the walk, in red ink
    if (this.route) {
      g.strokeStyle = '#b8322a';
      g.lineWidth = 3;
      g.setLineDash([7, 5]);
      for (const line of this.route.lines) {
        g.beginPath();
        line.forEach(([x, y], i) => (i ? g.lineTo(sx(x + 0.5), sy(y + 0.5)) : g.moveTo(sx(x + 0.5), sy(y + 0.5))));
        g.stroke();
      }
      g.setLineDash([]);
    }
    // the places: a pin of its colour with its sign for every shop, office and public place (homes are just
    // houses); names in ink, each only where it does not lie over another (the picked one and the maps' names
    // first), so the paper stays readable at any zoom
    const taken: [number, number, number, number][] = [];
    const free = (x0: number, y0: number, x1: number, y1: number) => !taken.some((r) => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]);
    const label = (text: string, X: number, Y: number, font: string, colour: string, must = false, beside = 0) => {
      g.font = font;
      const w = g.measureText(text).width;
      // a pin's name goes beside it, on whichever side is clear: right, left, under, over
      const tries: Pt[] = beside ? [[X + beside + w / 2 + 3, Y - beside * 1.4], [X - beside - w / 2 - 3, Y - beside * 1.4], [X, Y + 9], [X, Y - beside * 3.2]] : [[X, Y]];
      let place: Pt | null = null;
      for (const [x, y] of tries) {
        if (must || free(x - w / 2 - 2, y - 7, x + w / 2 + 2, y + 7)) {
          place = [x, y];
          break;
        }
      }
      if (!place) return;
      [X, Y] = place;
      taken.push([X - w / 2 - 2, Y - 7, X + w / 2 + 2, Y + 7]);
      g.strokeStyle = 'rgba(239, 226, 191, 0.92)';
      g.lineWidth = 3;
      g.strokeText(text, X, Y);
      g.fillStyle = colour;
      g.fillText(text, X, Y);
    };
    const mapNames = new Set(this.places.filter((p) => p.kind === 'map').map((p) => p.name));
    const spot = (p: Place): Pt | null => {
      const pl = this.atlas!.maps.get(p.loc);
      return pl ? [sx(pl.ox + p.x + 0.5), sy(pl.oy + p.y + 0.5)] : null;
    };
    const onScreen = ([X, Y]: Pt) => X > -40 && Y > -20 && X < W + 40 && Y < H + 20;
    const sites = this.places.filter((p) => p.kind === 'site' && p.sort !== 'home' && !mapNames.has(p.name));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // pins first, so the names go round them
    const pinR = z < 3 ? 6 : 8;
    for (const p of sites) {
      const c = spot(p);
      if (!c || !onScreen(c)) continue;
      this.pin(g, c[0], c[1], p.sort, pinR, this.picked?.key === p.key);
      taken.push([c[0] - pinR, c[1] - pinR * 2.4, c[0] + pinR, c[1]]);
    }
    if (this.picked) {
      const c = spot(this.picked);
      if (c) label(this.picked.name, c[0], c[1], '700 13px Georgia, serif', '#b8322a', true, pinR * 1.3);
    }
    for (const p of this.places) {
      if (p.kind !== 'map') continue;
      const c = spot(p);
      if (c && onScreen(c)) label(p.name, c[0], c[1], 'italic 600 15px Georgia, serif', '#3a2416');
    }
    if (z >= 3) {
      for (const p of sites) {
        if (p.key === this.picked?.key) continue;
        const c = spot(p);
        if (c && onScreen(c)) label(p.name, c[0], c[1], '600 11px Georgia, serif', '#3a2416', false, pinR);
      }
    }
    if (z >= 5) {
      for (const p of this.places) {
        if (p.kind !== 'street') continue;
        const c = spot(p);
        if (c && onScreen(c)) label(p.name, c[0], c[1], 'italic 11px Georgia, serif', 'rgba(74, 48, 32, 0.75)');
      }
    }
    // «Ви тут»
    const at = this.heroAt();
    if (at) {
      const X = sx(at[0] + 0.5);
      const Y = sy(at[1] + 0.5);
      g.fillStyle = '#b8322a';
      g.beginPath();
      g.moveTo(X, Y);
      g.arc(X, Y - 12, 6, Math.PI * 0.85, Math.PI * 0.15);
      g.closePath();
      g.fill();
      g.fillStyle = '#efe2bf';
      g.beginPath();
      g.arc(X, Y - 12, 2.2, 0, Math.PI * 2);
      g.fill();
      g.font = 'italic 700 12px Georgia, serif';
      g.fillStyle = '#b8322a';
      g.fillText(t('papermap.youAreHere'), X, Y - 26);
    }
    // the compass rose and the title cartouche
    this.rose(g, W - 34, H - 40);
    g.font = 'italic 700 14px Georgia, serif';
    g.fillStyle = '#4a3020';
    g.textAlign = 'left';
    g.fillText(t('papermap.cartouche'), 12, H - 14);
  }

  /** A map pin: a drop of the place's colour with its white sign in it; the picked one bigger, ringed in red. */
  private pin(g: CanvasRenderingContext2D, X: number, Y: number, sort: string, r: number, on: boolean): void {
    const [colour, glyph] = pinStyle(sort);
    const R = on ? r * 1.3 : r;
    const cy = Y - R * 1.4;
    g.fillStyle = 'rgba(40, 24, 12, 0.3)';
    g.beginPath();
    g.ellipse(X, Y, R * 0.6, R * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(X, Y);
    g.arc(X, cy, R, Math.PI * 0.75, Math.PI * 0.25);
    g.closePath();
    g.fill();
    g.strokeStyle = on ? '#b8322a' : '#3a2416';
    g.lineWidth = on ? 2.5 : 1.2;
    g.stroke();
    const img = this.glyph(glyph);
    if (img.complete && img.naturalWidth) g.drawImage(img, X - R * 0.7, cy - R * 0.7, R * 1.4, R * 1.4);
  }

  private glyph(name: string): HTMLImageElement {
    let img = this.glyphs.get(name);
    if (!img) {
      img = new Image();
      img.onload = () => this.draw();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(name, 24, '#ffffff').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
      this.glyphs.set(name, img);
    }
    return img;
  }

  /** «Покажчик»: every place on the map by kind, each with its pin; a touch finds it on the paper. */
  private toggleIndex(): void {
    if (this.index.style.display !== 'none') {
      this.index.style.display = 'none';
      return;
    }
    const sites = this.places.filter((p) => p.kind === 'site' && p.sort !== 'home').sort((a, b) => pinStyle(a.sort)[0].localeCompare(pinStyle(b.sort)[0]) || a.name.localeCompare(b.name));
    this.index.replaceChildren(...sites.map((p) => {
      const [colour, glyph] = pinStyle(p.sort);
      return h('button', { class: 'paper-map-row', type: 'button', onclick: () => this.find(p) },
        h('span', { class: 'paper-map-dot', style: `background:${colour}`, html: iconSvg(glyph, 14, '#fff') }),
        h('span', null, p.name));
    }));
    this.index.style.display = '';
  }

  /** Shows a place: picks it, brings it to the middle, close enough to read. */
  find(p: Place): void {
    const pl = this.atlas?.maps.get(p.loc);
    if (!pl) return;
    this.picked = p;
    this.view.cx = pl.ox + p.x + 0.5;
    this.view.cy = pl.oy + p.y + 0.5;
    this.view.zoom = Math.max(this.view.zoom, 7);
    this.index.style.display = 'none';
    this.showCard();
    this.draw();
  }

  private rose(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.save();
    g.translate(x, y);
    g.strokeStyle = '#4a3020';
    g.fillStyle = '#4a3020';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -22);
      g.lineTo(4, 0);
      g.lineTo(-4, 0);
      g.closePath();
      if (k === 3) g.fill();
      else g.stroke();
    }
    g.font = '700 10px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(t('papermap.north'), 0, -28);
    g.restore();
  }

  private tap(px: number, py: number): void {
    if (!this.atlas) return;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const z = this.view.zoom;
    let best: Place | null = null;
    let bestD = 18;
    for (const p of this.places) {
      const pl = this.atlas.maps.get(p.loc);
      if (!pl || (p.kind === 'site' && p.sort === 'home') || (p.kind === 'street' && z < 5)) continue;
      const X = (pl.ox + p.x + 0.5 - this.view.cx) * z + W / 2;
      // a pin is touched at its head, above the point
      const Y = (pl.oy + p.y + 0.5 - this.view.cy) * z + H / 2 - (p.kind === 'site' ? 11 : 0);
      const d = Math.hypot(X - px, Y - py);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    this.picked = best;
    this.showCard();
    this.draw();
  }

  /** Draws the walk from where one is to the place picked, and leaves the guide in the world. */
  routeTo(place: Place): boolean {
    const hero = this.deps.hero();
    if (!this.atlas || !hero) return false;
    this.route = walkRoute(this.atlas, this.deps.catalog().locations, hero, { loc: place.loc, x: place.x, y: place.y });
    if (!this.route) return false;
    this.deps.guide({ loc: place.loc, x: place.x, y: place.y, name: place.name });
    this.draw();
    return true;
  }

  private showCard(): void {
    const p = this.picked;
    if (!p) {
      this.card.replaceChildren(h('p', { class: 'paper-map-hint' }, t('papermap.pick')));
      return;
    }
    const said = h('span', { class: 'paper-map-said' });
    const site = p.site ? this.atlas?.maps.get(p.loc)?.def.sites?.find((s) => s.id === p.site) as Parameters<typeof openStatus>[0] | undefined : undefined;
    const c = this.deps.clock();
    const st = site?.jobs?.length ? openStatus(site, c.minute, c.weekday) : null;
    this.card.replaceChildren(
      h('b', null, p.name),
      h('span', { class: 'paper-map-what' }, p.what),
      st ? h('span', { class: `paper-map-hours ${st.open ? 'open' : 'shut'}` }, `${st.open ? t('maps.open') : t('maps.shut')} · ${st.text}`) : '',
      h('button', { class: 'cta', type: 'button', onclick: () => {
        said.textContent = this.routeTo(p) ? t('papermap.routed') : t('papermap.noWay');
      } }, t('papermap.route')),
      h('button', { class: 'chip', type: 'button', onclick: () => {
        this.route = null;
        this.deps.guide(null);
        this.draw();
        said.textContent = '';
      } }, t('papermap.clear')),
      said,
    );
  }
}
