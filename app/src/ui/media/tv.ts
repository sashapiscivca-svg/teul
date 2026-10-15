// The television: «Липове ТБ» on a schedule by the real local time (morning news, cartoons, a cooking show, the
// nature hour, the evening news with the forecast, a concert, the late film, and at night the test card) and
// the weather channel. The screen is drawn in pixels; the concert plays a real piece through the instruments.

import { t as tr } from '../../i18n';
import { iconSvg } from '../../icons';
import { h } from '../dom';

export type ProgrammeId = 'test' | 'morning' | 'cartoons' | 'cooking' | 'nature' | 'news' | 'concert' | 'film' | 'weather';

export interface Programme {
  id: ProgrammeId;
  title: string;
  /** Minutes of the day it runs from and to. */
  from: number;
  to: number;
}

const DAY: [number, number, ProgrammeId, string][] = [
  [0, 6, 'test', 'media.tv.test'],
  [6, 9, 'morning', 'media.tv.morning'],
  [9, 12, 'cartoons', 'media.tv.cartoons'],
  [12, 13, 'cooking', 'media.tv.cooking'],
  [13, 17, 'nature', 'media.tv.nature'],
  [17, 18, 'cartoons', 'media.tv.cartoons'],
  [18, 19, 'news', 'media.tv.news'],
  [19, 21, 'concert', 'media.tv.concert'],
  [21, 24, 'film', 'media.tv.film'],
];

/** The day's programmes on «Липове ТБ» (on the weekend the cartoons run all afternoon). */
export function listing(weekend: boolean): Programme[] {
  return DAY.map(([a, b, id, title]) => ({ id: weekend && id === 'nature' ? 'cartoons' : id, title: tr(weekend && id === 'nature' ? 'media.tv.cartoons' : title), from: a * 60, to: b * 60 }));
}

export function programmeAt(minute: number, weekend: boolean, channel = 0): Programme {
  const m = ((minute % 1440) + 1440) % 1440;
  if (channel === 1) return { id: 'weather', title: tr('media.tv.weather'), from: 0, to: 1440 };
  return listing(weekend).find((p) => m >= p.from && m < p.to) ?? listing(weekend)[0];
}

/** What the screen shows: the paper's headlines, the weather, the recipe of the day. */
export interface TvFeed {
  headlines: string[];
  weatherNow: string;
  weatherNext: string;
  /** The season's sky: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'. */
  sky: string;
  recipe: { name: string; needs: string[]; text: string } | null;
  minute: () => number;
  weekend: boolean;
  /** The concert: start (and stop) a piece through the instruments. */
  concert?: (on: boolean) => string | null;
}

const W = 160;
const H = 120;

function hh(m: number): string {
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export class TvSheet {
  readonly root: HTMLElement;
  private readonly screen: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private readonly guide: HTMLElement;
  private feed: TvFeed | null = null;
  private channel = 0;
  private raf = 0;
  private t0 = 0;
  private shown: ProgrammeId | null = null;
  private concertPiece: string | null = null;
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.screen = h('canvas', { class: 'tv-screen', width: W, height: H });
    this.caption = h('div', { class: 'tv-caption' });
    this.guide = h('div', { class: 'tv-guide' });
    const chan = (n: number, label: string) => h('button', { class: 'chip', type: 'button', onclick: () => this.tune(n) }, label);
    this.root = h(
      'div',
      { class: 'settings tv', role: 'dialog', 'aria-label': tr('media.tv.tv') },
      h('div', { class: 'settings-card tv-card' },
        h('div', { class: 'ph' }, h('b', null, tr('media.tv.tv')), h('button', { class: 'round small', type: 'button', 'aria-label': tr('media.tv.off'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('div', { class: 'tv-set' }, this.screen),
        this.caption,
        h('div', { class: 'tv-channels' }, chan(0, `1 · ${tr('media.tv.channel')}`), chan(1, `2 · ${tr('media.tv.weather')}`)),
        this.guide),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** The programme on now (for the e2e). */
  now(): Programme | null {
    return this.feed ? programmeAt(this.feed.minute(), this.feed.weekend, this.channel) : null;
  }

  open(feed: TvFeed, onClose: () => void = () => {}): void {
    this.feed = feed;
    this.onClose = onClose;
    this.root.style.display = '';
    this.t0 = performance.now();
    this.shown = null;
    this.renderGuide();
    this.loop();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.root.style.display = 'none';
    cancelAnimationFrame(this.raf);
    this.stopConcert();
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  private tune(n: number): void {
    this.channel = n;
    this.t0 = performance.now();
    this.renderGuide();
  }

  private stopConcert(): void {
    if (this.concertPiece) this.feed?.concert?.(false);
    this.concertPiece = null;
  }

  private renderGuide(): void {
    const f = this.feed;
    if (!f) return;
    const m = f.minute();
    const rows = listing(f.weekend).map((p) => h('div', { class: `tv-row${m >= p.from && m < p.to && this.channel === 0 ? ' on' : ''}` }, h('span', null, hh(p.from)), h('span', null, p.title)));
    this.guide.replaceChildren(...rows);
  }

  private loop(): void {
    const f = this.feed;
    if (!f || !this.isOpen()) return;
    const p = programmeAt(f.minute(), f.weekend, this.channel);
    if (p.id !== this.shown) {
      this.shown = p.id;
      this.t0 = performance.now();
      if (p.id === 'concert') this.concertPiece = f.concert?.(true) ?? null;
      else this.stopConcert();
      this.renderGuide();
    }
    const t = (performance.now() - this.t0) / 1000;
    const c = this.screen.getContext('2d');
    if (c) {
      c.imageSmoothingEnabled = false;
      draw(c, p.id, t, f, this.concertPiece);
    }
    this.caption.textContent = caption(p, t, f, this.concertPiece);
    this.raf = requestAnimationFrame(() => this.loop());
  }
}

/** The line under the screen: what is being said or shown. */
export function caption(p: Programme, t: number, f: TvFeed, piece: string | null): string {
  const cycle = <T,>(list: T[], secs: number): T | undefined => (list.length ? list[Math.floor(t / secs) % list.length] : undefined);
  switch (p.id) {
    case 'test':
      return tr('media.tv.testCaption');
    case 'morning':
    case 'news':
      return cycle([tr('media.tv.newsWeather', { now: f.weatherNow, next: f.weatherNext }), ...f.headlines], 6) ?? '';
    case 'weather':
      return tr('media.tv.weatherNow', { now: f.weatherNow, next: f.weatherNext });
    case 'cooking':
      return f.recipe ? cycle([tr('media.tv.cookToday', { name: f.recipe.name }), tr('media.tv.cookNeeds', { needs: f.recipe.needs.join(', ') }), f.recipe.text], 6) ?? '' : tr('media.tv.cookBread');
    case 'cartoons':
      return cycle([tr('media.tv.cartoon1'), tr('media.tv.cartoon2'), tr('media.tv.cartoon3')], 20) ?? '';
    case 'nature':
      return cycle([tr('media.tv.nature1'), tr('media.tv.nature2'), tr('media.tv.nature3')], 9) ?? '';
    case 'concert':
      return piece ? tr('media.tv.concertPiece', { piece }) : tr('media.tv.tuning');
    case 'film':
      return cycle([tr('media.tv.film1'), tr('media.tv.film2'), tr('media.tv.film3')], 7) ?? '';
  }
}

// ---- the pictures ---------------------------------------------------------------------------------------------

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hgt));
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, col = '#fff', size = 8): void {
  c.fillStyle = col;
  c.font = `${size}px monospace`;
  c.fillText(s, x, y);
}

function person(c: CanvasRenderingContext2D, x: number, y: number, top: string, skin = '#f1c9a5', hair = '#4a2f27', bob = 0): void {
  rect(c, x - 4, y - 18 + bob, 8, 8, skin);
  rect(c, x - 4, y - 19 + bob, 8, 3, hair);
  rect(c, x - 6, y - 10 + bob, 12, 10, top);
  rect(c, x - 2, y - 15 + bob, 1, 1, '#2a2035');
  rect(c, x + 1, y - 15 + bob, 1, 1, '#2a2035');
}

function draw(c: CanvasRenderingContext2D, id: ProgrammeId, t: number, f: TvFeed, piece: string | null): void {
  const blink = Math.floor(t * 2) % 2;
  switch (id) {
    case 'test': {
      const bars = ['#f0f0f0', '#f0e040', '#40e0e0', '#40d040', '#e040e0', '#e04040', '#4040e0', '#202020'];
      bars.forEach((col, i) => rect(c, (i * W) / 8, 0, W / 8 + 1, H * 0.7, col));
      rect(c, 0, H * 0.7, W, H * 0.3, '#101018');
      c.strokeStyle = '#fff';
      c.beginPath();
      c.arc(W / 2, H * 0.42, 34, 0, Math.PI * 2);
      c.stroke();
      text(c, tr('media.tv.logo'), W / 2 - 24, H * 0.88, '#fff');
      break;
    }
    case 'morning':
    case 'news': {
      // the studio: the presenter at the desk, the town on the screen behind
      rect(c, 0, 0, W, H, id === 'news' ? '#1a2a50' : '#f0c890');
      rect(c, 92, 14, 58, 40, '#0b0c18');
      rect(c, 94, 16, 54, 36, id === 'news' ? '#3a6aa0' : '#9ad0f0');
      for (let i = 0; i < 5; i++) rect(c, 98 + i * 10, 34 - (i % 3) * 4, 8, 18 + (i % 3) * 4, ['#e0a97c', '#d86a3a', '#e8e0c8', '#c98f65', '#f4d35e'][i]);
      person(c, 46, 76, id === 'news' ? '#2f3a5a' : '#d86aa0', '#f1c9a5', '#7a4a2a', 0);
      if (Math.floor(t * 4) % 3 === 0) rect(c, 44, 63, 4, 1, '#a8505a');
      rect(c, 10, 76, 80, 20, '#5a3a2a');
      rect(c, 0, 98, W, 22, '#c0392b');
      const news = f.headlines.length ? f.headlines[Math.floor(t / 6) % f.headlines.length] : f.weatherNow;
      const x = W - ((t * 30) % (W + news.length * 5));
      text(c, news, x, 112, '#fff', 8);
      text(c, id === 'news' ? tr('media.tv.newsBanner') : tr('media.tv.morningBanner'), 6, 12, id === 'news' ? '#f4d35e' : '#2a2420');
      break;
    }
    case 'weather': {
      rect(c, 0, 0, W, H, '#3a6aa0');
      // the map of the region with the town marked, and the sky over it
      rect(c, 14, 22, 90, 76, '#5aa469');
      rect(c, 40, 30, 8, 60, '#4a8fd0');
      rect(c, 64, 56, 6, 6, '#f4f0e6');
      text(c, tr('media.tv.town'), 56, 72, '#fff', 7);
      const sky = f.sky;
      if (sky === 'clear') {
        rect(c, 116, 30, 26, 26, '#f4d35e');
        for (let i = 0; i < 8; i++) rect(c, 128 + Math.cos(i + t) * 20, 42 + Math.sin(i + t) * 20, 3, 3, '#f4d35e');
      } else {
        rect(c, 110, 34, 40, 14, '#e8e8f0');
        rect(c, 118, 26, 24, 12, '#e8e8f0');
        if (sky === 'rain' || sky === 'storm') for (let i = 0; i < 8; i++) rect(c, 112 + i * 5, 52 + ((t * 40 + i * 7) % 20), 1, 4, '#9ad0f0');
        if (sky === 'snow') for (let i = 0; i < 8; i++) rect(c, 112 + i * 5, 52 + ((t * 15 + i * 7) % 24), 2, 2, '#fff');
        if (sky === 'storm' && blink) rect(c, 128, 50, 3, 12, '#f4d35e');
      }
      text(c, tr('media.tv.weatherBanner'), 6, 12, '#f4d35e');
      break;
    }
    case 'cartoons': {
      // a cat after a butterfly over a meadow
      rect(c, 0, 0, W, H, '#9ad0f0');
      rect(c, 0, 84, W, 36, '#5aa469');
      rect(c, 120, 12, 22, 22, '#f4d35e');
      const bx = (t * 30) % (W + 40) - 20;
      const by = 46 + Math.sin(t * 4) * 10;
      rect(c, bx, by, 4, 4, '#d86aa0');
      rect(c, bx + (blink ? -3 : -2), by - 2, 3, 3, '#f4a0c8');
      rect(c, bx + 4, by - 2, 3, 3, '#f4a0c8');
      const cx = bx - 40;
      const jump = Math.abs(Math.sin(t * 3)) * 12;
      rect(c, cx, 74 - jump, 18, 10, '#d98a3a');
      rect(c, cx + 14, 66 - jump, 10, 10, '#d98a3a');
      rect(c, cx + 15, 64 - jump, 2, 3, '#d98a3a');
      rect(c, cx + 21, 64 - jump, 2, 3, '#d98a3a');
      rect(c, cx + 19, 69 - jump, 1, 1, '#2a2035');
      rect(c, cx - 4, 70 - jump + (blink ? 2 : 0), 5, 2, '#d98a3a');
      break;
    }
    case 'cooking': {
      rect(c, 0, 0, W, H, '#f4eedf');
      for (let i = 0; i < 8; i++) rect(c, i * 20, 0, 10, 50, '#e8dcc0');
      rect(c, 0, 80, W, 40, '#8a5a2e');
      person(c, 80, 80, '#e8e0c8', '#e0a97c', '#9aa0b0', Math.floor(t * 2) % 2);
      rect(c, 72, 60, 16, 4, '#f4f0e6');
      rect(c, 40, 70, 24, 10, '#3a3a44');
      for (let i = 0; i < 3; i++) rect(c, 44 + i * 7, 62 - ((t * 10 + i * 5) % 14), 2, 3, '#e8e8f0');
      rect(c, 100, 72, 20, 8, '#d9534f');
      text(c, f.recipe?.name ?? tr('media.tv.bread'), 6, 112, '#2a2420', 8);
      break;
    }
    case 'nature': {
      rect(c, 0, 0, W, H, '#bfe0f0');
      rect(c, 0, 70, W, 50, '#7ab05a');
      for (let i = 0; i < 6; i++) rect(c, i * 30 + 6, 40, 8, 34, '#4a6a3a');
      // a stork flying over
      const x = (t * 20) % (W + 30) - 30;
      const flap = Math.floor(t * 3) % 2;
      rect(c, x, 30, 14, 4, '#f4f0e6');
      rect(c, x + 2, flap ? 24 : 32, 10, 6, '#f4f0e6');
      rect(c, x + 10, flap ? 22 : 34, 4, 2, '#2a2420');
      rect(c, x + 14, 30, 5, 2, '#d9534f');
      // a fox in the grass
      const fx = 120 - ((t * 6) % 140);
      rect(c, fx, 88, 16, 7, '#d86a3a');
      rect(c, fx - 6, 84, 7, 7, '#d86a3a');
      rect(c, fx + 16, 86, 8, 4, '#f4f0e6');
      break;
    }
    case 'concert': {
      rect(c, 0, 0, W, H, '#1a1430');
      for (let i = 0; i < 3; i++) {
        const lx = 30 + i * 50;
        c.fillStyle = 'rgba(255,230,160,0.18)';
        c.beginPath();
        c.moveTo(lx, 0);
        c.lineTo(lx - 20, 100);
        c.lineTo(lx + 20, 100);
        c.fill();
      }
      rect(c, 0, 96, W, 24, '#5a3a2a');
      // the pianist at the grand piano, the violinist beside
      rect(c, 40, 70, 46, 14, '#0b0c18');
      rect(c, 44, 66, 38, 4, '#0b0c18');
      rect(c, 42, 82, 3, 14, '#0b0c18');
      rect(c, 80, 82, 3, 14, '#0b0c18');
      person(c, 34, 86, '#2a2438', '#f1c9a5', '#1f1a26', Math.floor(t * 4) % 2);
      person(c, 116, 92, '#7a2a3a', '#e0a97c', '#c9a050', 0);
      rect(c, 120, 74, 10, 4, '#8a3a1a');
      const bow = Math.sin(t * 5) * 6;
      rect(c, 112 + bow, 78, 16, 1, '#f0ecd8');
      if (piece) for (let i = 0; i < 3; i++) text(c, '♪', 60 + i * 20 + Math.sin(t * 2 + i) * 4, 40 - ((t * 12 + i * 9) % 30), '#f4d35e', 10);
      break;
    }
    case 'film': {
      rect(c, 0, 0, W, H, '#0e1430');
      rect(c, 120, 14, 16, 16, '#f4f0d0');
      rect(c, 0, 76, W, 44, '#1a2a50');
      for (let i = 0; i < 12; i++) rect(c, (i * 23 + t * 4) % W, 80 + (i % 3) * 8, 6, 1, '#f4f0d0');
      // two on a bench by the river
      rect(c, 50, 66, 40, 4, '#5a3a2a');
      rect(c, 52, 70, 2, 6, '#5a3a2a');
      rect(c, 86, 70, 2, 6, '#5a3a2a');
      person(c, 62, 66, '#3a3a44', '#c98f65', '#1f1a26', 0);
      person(c, 78, 66, '#8a63c9', '#f1c9a5', '#d86a3a', 0);
      rect(c, 0, 0, W, 8, '#000');
      rect(c, 0, H - 8, W, 8, '#000');
      break;
    }
  }
  // the glass: scanlines and a soft glare
  c.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 2) c.fillRect(0, y, W, 1);
}
