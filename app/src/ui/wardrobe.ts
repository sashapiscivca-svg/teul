// The wardrobe at home (and the fitting room), and the clothes shop: the hero in front, the clothes by part
// (top, bottom, shoes, an accessory), each shown on the hero. At the shop a garment is bought; where one can
// change, it is put on (or the first day's clothes again).

import { lookFromSettings, type Dir } from '../character';
import { HERO_CROP, HERO_PX, heroLayers } from '../people/hero';
import { iconSvg } from '../icons';
import type { WardrobeView } from '../types';
import { clear, h } from './dom';
import { t } from '../i18n';

type Slot = 'top' | 'bottom' | 'shoes' | 'acc' | 'hands';
const SLOTS: Slot[] = ['top', 'bottom', 'shoes', 'acc', 'hands'];
/** What part of the figure to show on a card, per slot: [x, y, w, h] of the hero's sprite. */
const CROP: Record<Slot, [number, number, number, number]> = { top: [...HERO_CROP.top], bottom: [...HERO_CROP.bottom], shoes: [...HERO_CROP.shoes], acc: [...HERO_CROP.acc], hands: [...HERO_CROP.hands] };

export interface WardrobeHandlers {
  name(item: string): string;
  settings(): Record<string, string>;
  buy(item: string): void;
  wear(slot: Slot, item: string | null): void;
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

export class WardrobeSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly title: HTMLElement;
  private slot: Slot = 'top';
  private view: WardrobeView | null = null;
  private mode: 'shop' | 'wear' = 'wear';
  private trying: [string, string][] | null = null;
  private dir: Dir = 'down';

  constructor(parent: HTMLElement, private readonly handlers: WardrobeHandlers) {
    this.title = h('b', null, t('wardrobe.title'));
    this.tabs = h('div', { class: 'pocket-tabs' });
    this.stage = h('button', { class: 'preview wardrobe-stage', type: 'button', 'aria-label': t('wardrobe.turn'), onclick: () => this.turn() });
    this.body = h('div', { class: 'pocket-body wardrobe-body' });
    this.root = h(
      'div',
      { class: 'settings wardrobe', role: 'dialog', 'aria-label': t('wardrobe.label') },
      h('div', { class: 'settings-card pocket-card wardrobe-card' },
        h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('div', { class: 'wardrobe-main' }, this.stage, h('div', { class: 'wardrobe-side' }, this.tabs, this.body))),
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
    this.trying = null;
  }

  /** Opens at the shop (buying, trying on) or at the wardrobe (changing). */
  open(view: WardrobeView, mode: 'shop' | 'wear'): void {
    this.mode = mode;
    this.trying = null;
    this.title.textContent = mode === 'shop' ? t('wardrobe.shopTitle') : t('wardrobe.title');
    this.refresh(view);
    this.root.style.display = '';
  }

  refresh(view: WardrobeView): void {
    this.view = view;
    this.render();
  }

  private turn(): void {
    const order: Dir[] = ['down', 'right', 'up', 'left'];
    this.dir = order[(order.indexOf(this.dir) + 1) % 4];
    this.render();
  }

  private settingsWith(set: [string, string][] | null): Record<string, string> {
    const s = { ...this.handlers.settings() };
    for (const [k, v] of set ?? []) {
      if (v === '') delete s[k];
      else s[k] = v;
    }
    return s;
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    clear(this.stage);
    this.stage.append(sprite(this.settingsWith(this.trying), 132, undefined, this.dir));
    clear(this.tabs);
    for (const id of SLOTS) this.tabs.append(h('button', { class: `tab ${this.slot === id ? 'on' : ''}`, type: 'button', onclick: () => { this.slot = id; this.trying = null; this.render(); } }, t(`wardrobe.slot.${id}`)));
    clear(this.body);
    const cards: HTMLElement[] = [];
    const crop = CROP[this.slot];
    if (this.mode === 'shop') {
      for (const [item, price] of v.for_sale) {
        const set = this.setOf(item);
        if (!set || set.slot !== this.slot) continue;
        cards.push(this.card(item, set.set, `${price}`, [
          h('button', { class: 'chip', type: 'button', onclick: () => { this.trying = set.set; this.render(); } }, t('wardrobe.tryOn')),
          h('button', { class: 'chip on', type: 'button', onclick: () => this.handlers.buy(item) }, t('wardrobe.buy')),
        ], crop));
      }
      if (!v.shop_open) this.body.append(h('p', { class: 'pocket-empty' }, t('wardrobe.shut')));
    }
    // the clothes one has: the first day's, then the bought ones
    const owned = v.owned.filter((g) => g.slot === this.slot);
    if (this.mode === 'wear' || owned.length > 0) {
      const first = v.first[this.slot] ?? [];
      const firstSet: [string, string][] = first.length ? first : (SLOT_KEYS[this.slot].map((k) => [k, ''] as [string, string]));
      const wearing = (set: [string, string][]) => set.every(([k, val]) => (this.handlers.settings()[k] ?? '') === val);
      if (this.mode === 'wear') cards.push(this.card(null, firstSet, wearing(firstSet) ? t('wardrobe.worn') : '', [this.wearButton(null, wearing(firstSet))], crop, (this.slot === 'acc' || this.slot === 'hands') && !first.length ? t('wardrobe.nothing') : t('wardrobe.firstDay')));
      for (const g of owned) cards.push(this.card(g.item, g.set, g.worn ? t('wardrobe.worn') : this.mode === 'shop' ? t('wardrobe.yours') : '', [this.wearButton(g.item, g.worn)], crop));
    }
    if (cards.length === 0) this.body.append(h('p', { class: 'pocket-empty' }, this.mode === 'shop' ? t('wardrobe.emptyShop') : t('wardrobe.emptyOwn')));
    else this.body.append(h('div', { class: 'pocket-grid' }, ...cards));
    if (!v.can_change) {
      const why = v.reason === 'no_wardrobe' ? t('wardrobe.noWardrobe') : this.mode === 'shop' ? t('wardrobe.fittingRoom') : t('wardrobe.whereChange');
      this.body.append(h('p', { class: 'pocket-empty' }, why));
    }
  }

  private setOf(item: string): { slot: Slot; set: [string, string][] } | null {
    const g = GARMENTS.get(item);
    return g ?? null;
  }

  private wearButton(item: string | null, worn: boolean): HTMLElement {
    const can = this.view?.can_change ?? false;
    return h('button', { class: `chip ${worn ? 'on' : ''}`, type: 'button', disabled: !can || worn, onclick: () => this.handlers.wear(this.slot, item) }, worn ? t('wardrobe.alreadyOn') : t('wardrobe.putOn'));
  }

  private card(item: string | null, set: [string, string][], note: string, actions: HTMLElement[], crop: [number, number, number, number], label?: string): HTMLElement {
    return h('div', { class: 'card pocket-item', onclick: (e: Event) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') { this.trying = set; this.render(); } } },
      h('div', { class: 'thumb-wrap' }, sprite(this.settingsWith(set), 64, crop)),
      h('div', { class: 'name' }, label ?? (item ? this.handlers.name(item) : '')),
      note ? h('span', { class: 'count' }, note) : null,
      h('div', { class: 'pocket-actions' }, ...actions));
  }
}

/** The keys of each slot (as the core has them). */
export const SLOT_KEYS: Record<Slot, string[]> = {
  top: ['look.top', 'look.top_color', 'look.top2_color'],
  bottom: ['look.bottom', 'look.bottom_color'],
  shoes: ['look.shoe', 'look.shoes_color'],
  acc: ['look.acc', 'look.acc_color'],
  hands: ['look.mitt', 'look.mitt_color'],
};

/** Every garment of the catalogue, filled in once the catalogue is known. */
export const GARMENTS = new Map<string, { slot: Slot; set: [string, string][] }>();

export function learnGarments(items: Record<string, { wear?: { slot: string; set: [string, string][] } }>): void {
  GARMENTS.clear();
  for (const [id, def] of Object.entries(items)) if (def.wear) GARMENTS.set(id, { slot: def.wear.slot as Slot, set: def.wear.set });
}
