// The salon «Локон»: the hero in the chair, a new hairstyle, a colour, a beard — and what it comes to.

import { BEARDS, HAIR_COLORS, HAIR_STYLES, lookFromSettings, type Dir } from '../character';
import { HERO_CROP, HERO_PX, heroLayers } from '../people/hero';
import { iconSvg } from '../icons';
import type { SalonView } from '../types';
import { clear, h } from './dom';
import { t } from '../i18n';

export interface SalonHandlers {
  settings(): Record<string, string>;
  coins(): number;
  cut(set: [string, string][]): void;
}

function sprite(settings: Record<string, string>, size: number, crop?: [number, number, number, number], dir: Dir = 'down'): HTMLCanvasElement {
  const [cx, cy, cw, ch] = crop ?? [0, 0, HERO_PX, HERO_PX];
  const canvas = h('canvas', { width: String(cw * 2), height: String(ch * 2) });
  canvas.style.width = `${size}px`;
  canvas.style.height = `${(size * ch) / cw}px`;
  canvas.style.imageRendering = 'pixelated';
  const g = canvas.getContext('2d');
  if (g) {
    g.scale(2, 2);
    g.translate(-cx, -cy);
    for (const l of heroLayers(lookFromSettings(settings), dir, 'idle', 0)) {
      g.fillStyle = l.color;
      g.fill(new Path2D(l.path));
    }
  }
  return canvas;
}

export class SalonSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly stage: HTMLElement;
  private view: SalonView | null = null;
  private want: Record<string, string> = {};

  constructor(parent: HTMLElement, private readonly handlers: SalonHandlers) {
    this.stage = h('div', { class: 'preview wardrobe-stage' });
    this.body = h('div', { class: 'pocket-body wardrobe-body' });
    this.root = h(
      'div',
      { class: 'settings wardrobe salon', role: 'dialog', 'aria-label': t('salon.label') },
      h('div', { class: 'settings-card pocket-card wardrobe-card' },
        h('div', { class: 'ph' }, h('b', null, t('salon.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('div', { class: 'wardrobe-main' }, this.stage, h('div', { class: 'wardrobe-side' }, this.body))),
    );
    this.root.style.display = 'none';
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  open(view: SalonView): void {
    this.view = view;
    this.want = {};
    this.render();
    this.root.style.display = '';
  }

  /** After a haircut: the new hair is the current one. */
  done(view: SalonView): void {
    this.view = view;
    this.want = {};
    this.render();
  }

  private current(): Record<string, string> {
    return this.handlers.settings();
  }

  private changed(): [string, string][] {
    const cur = this.current();
    return Object.entries(this.want).filter(([k, v]) => (cur[k] ?? '') !== v);
  }

  private price(): number {
    const v = this.view;
    if (!v) return 0;
    const ch = new Set(this.changed().map(([k]) => k));
    return (ch.has('look.hair') ? v.price_style : 0) + (ch.has('look.hair_color') ? v.price_color : 0) + (ch.has('look.beard') ? v.price_beard : 0);
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    const look = { ...this.current(), ...this.want };
    clear(this.stage);
    this.stage.append(sprite(look, 132));
    clear(this.body);
    const pick = (key: string, value: string) => {
      this.want = { ...this.want, [key]: value };
      this.render();
    };
    const thumbs = (key: string, count: number, crop: [number, number, number, number]) =>
      h('div', { class: 'group' }, ...Array.from({ length: count }, (_, i) => {
        const on = (look[key] ?? '') === String(i);
        return h('button', { class: `thumb ${on ? 'on' : ''}`, type: 'button', 'aria-label': String(i + 1), onclick: () => pick(key, String(i)) }, sprite({ ...look, [key]: String(i) }, 40, crop));
      }));
    const swatches = (key: string, colors: string[]) =>
      h('div', { class: 'group' }, ...colors.map((c) => h('button', { class: `color ${(look[key] ?? '').toLowerCase() === c ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => pick(key, c) })));
    const row = (label: string, kid: HTMLElement) => h('div', { class: 'hero-row' }, h('span', { class: 'label' }, label), kid);
    this.body.append(
      row(t('salon.style', { price: v.price_style }), thumbs('look.hair', HAIR_STYLES, [...HERO_CROP.head])),
      row(t('salon.colour', { price: v.price_color }), swatches('look.hair_color', HAIR_COLORS)),
      row(t('salon.beard', { price: v.price_beard }), thumbs('look.beard', BEARDS, [13, 6, 14, 12])),
    );
    const price = this.price();
    const can = v.here && v.open && price > 0 && this.handlers.coins() >= price;
    const note = !v.open ? t('salon.hours', { from: v.hours[0], to: v.hours[1] }) : price === 0 ? t('salon.choose') : this.handlers.coins() < price ? t('salon.short', { price, have: this.handlers.coins() }) : t('salon.total', { price });
    this.body.append(h('p', { class: 'pocket-empty' }, note), h('button', { class: 'cta', type: 'button', disabled: !can, onclick: () => this.handlers.cut(this.changed()) }, t('salon.cut')));
  }
}
