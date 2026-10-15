// The pocket: what the player carries (with how much room is left), the chest at home, and the keyring.
// Things move between the pocket and the chest only at home; keys never leave the ring.

import { iconSvg } from '../icons';
import { drawPixelThumb } from '../pixel/items';
import type { ItemDef, PocketView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export type PocketTab = 'pocket' | 'chest' | 'keys';

/** Someone a thing can be given to: a person standing near. */
export interface Recipient {
  id: string;
  name: string;
}

export interface PocketHandlers {
  /** Name of an item (already translated). */
  name(item: string): string;
  def(item: string): ItemDef | undefined;
  stash(item: string, n: number): void;
  take(item: string, n: number): void;
  /** Out of the pocket for good. */
  throwAway(item: string, n: number): void;
  /** Into the chosen place at hand (the bar at the bottom). */
  toHand?(item: string): void;
  /** A place at hand given a thing (or emptied). */
  setSlot?(slot: number, item: string | null): void;
  /** The left hand given a thing (or emptied). */
  setOffhand?(item: string | null): void;
  /** A piece of armour put on, or the armour of a place taken off. */
  wear?(item: string): void;
  takeOff?(slot: string): void;
  /** The hero as drawn now (in the armour worn), looking `dir`. */
  figure?(dir: 'down' | 'left' | 'right'): { color: string; path: string }[];
  /** Whom it can be given to now: the people standing near. */
  recipients(item: string): Recipient[];
  give(item: string, to: Recipient): void;
  /** What the buyer one stands at pays for a piece (null: not that); only while selling. */
  price?(item: string): number | null;
  sell?(item: string, n: number): void;
  /** A key that can be looked at (the driving licence and its coupon): what the button says. */
  look?(item: string): string | null;
  open?(item: string): void;
}

/** A place in the inventory window: a cell of the inventory, one of the nine at hand, the left hand, or where armour
 * is worn. */
type Place = { kind: 'main'; i: number } | { kind: 'bar'; i: number } | { kind: 'off' } | { kind: 'armor'; slot: string };

const ARMOR_SLOTS = ['head', 'body', 'legs', 'feet'] as const;
const COLS = 9;
const ORDER_KEY = 'teul.inv.order';

const placeId = (p: Place) => (p.kind === 'main' || p.kind === 'bar' ? `${p.kind}:${p.i}` : p.kind === 'off' ? 'off' : `armor:${p.slot}`);

function slotThumb(def: ItemDef | undefined, size = 32): HTMLCanvasElement {
  const c = h('canvas', { width: String(size), height: String(size), class: 'mc-thumb' });
  const g = c.getContext('2d');
  if (g && def) drawPixelThumb(g, def, size, size);
  return c;
}

/** Where each kind lies in the inventory's cells (kept between openings, as one left them). */
function loadOrder(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function thumb(def: ItemDef | undefined): HTMLCanvasElement {
  const c = h('canvas', { width: '72', height: '58', class: 'pocket-thumb' });
  const g = c.getContext('2d');
  if (g && def) drawPixelThumb(g, def, 72, 58);
  return c;
}

export class PocketSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly meter: HTMLElement;
  private tab: PocketTab = 'pocket';
  private view: PocketView | null = null;
  private atHome = false;
  /** At a buyer: the pocket shows prices and sells. */
  private selling: string | null = null;
  /** Choosing whom to give this to. */
  private giving: string | null = null;
  /** A throw waiting for its second tap. */
  private sure: string | null = null;
  private sureTimer = 0;
  /** A thing taken up to be put somewhere (as in Minecraft: a click takes it, a click on a place puts it there). */
  private carrying: { item: string; from: Place } | null = null;
  private order: Record<string, number> = loadOrder();
  /** The name under the pointer, and the thing carried along with it. */
  private readonly tip: HTMLElement;
  private readonly cursor: HTMLElement;
  private figureDir: 'down' | 'left' | 'right' = 'down';
  private figureBox: HTMLCanvasElement | null = null;

  constructor(parent: HTMLElement, private readonly handlers: PocketHandlers) {
    this.tabs = h('div', { class: 'pocket-tabs' });
    this.meter = h('div', { class: 'pocket-meter' });
    this.body = h('div', { class: 'pocket-body' });
    this.root = h(
      'div',
      { class: 'settings pocket', role: 'dialog', 'aria-label': t('pocket.title') },
      h('div', { class: 'settings-card pocket-card' },
        h('div', { class: 'ph' }, h('b', null, t('pocket.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.meter,
        this.tabs,
        this.body),
    );
    this.tip = h('div', { class: 'mc-tip', role: 'presentation' });
    this.cursor = h('div', { class: 'mc-cursor', role: 'presentation' });
    this.root.append(this.tip, this.cursor);
    this.root.style.display = 'none';
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    // the name follows the pointer over a cell; what is carried follows it everywhere; the hero looks at it
    this.root.addEventListener('pointermove', (e) => {
      const x = e.clientX;
      const y = e.clientY;
      this.tip.style.transform = `translate(${x + 14}px, ${y - 30}px)`;
      this.cursor.style.transform = `translate(${x - 18}px, ${y - 18}px)`;
      this.cursor.classList.toggle('shown', e.pointerType === 'mouse' && !!this.carrying);
      const f = this.figureBox?.getBoundingClientRect();
      if (f && f.width) {
        const dx = x - (f.left + f.width / 2);
        const dir = Math.abs(dx) < f.width ? 'down' : dx < 0 ? 'left' : 'right';
        if (dir !== this.figureDir) {
          this.figureDir = dir;
          this.drawFigure();
        }
      }
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.carrying) {
        e.stopPropagation();
        this.carrying = null;
        this.render();
      }
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
    this.carrying = null;
    this.tip.classList.remove('shown');
    this.cursor.classList.remove('shown');
  }

  /** `selling`: the buyer one stands at (its name over the list), or nothing. */
  open(view: PocketView, atHome: boolean, tab: PocketTab = 'pocket', selling: string | null = null): void {
    this.tab = tab;
    this.selling = selling;
    this.giving = null;
    this.carrying = null;
    this.sure = null;
    this.refresh(view, atHome);
    this.root.style.display = '';
  }

  /** Redraws with fresh numbers (after a move), keeping the tab. */
  refresh(view: PocketView, atHome: boolean): void {
    this.view = view;
    this.atHome = atHome;
    this.render();
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    const full = v.used >= v.capacity;
    const bag = v.bag ? this.handlers.name(v.bag) : t('pocket.onlyPocket', { n: v.capacity });
    // how many kinds of things are carried, of how many (a kind takes one place, however many of it)
    const fill = h('span', { class: 'pocket-fill' });
    fill.style.width = `${Math.round((100 * Math.min(v.used, v.capacity)) / Math.max(1, v.capacity))}%`;
    this.meter.replaceChildren(
      h('span', { class: `pocket-count ${full ? 'full' : ''}` }, `${v.used}/${v.capacity}`),
      h('span', { class: 'pocket-bar' }, fill),
      h('span', { class: 'pocket-bag' }, bag),
    );
    const tab = (id: PocketTab, label: string, n: number) =>
      h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, type: 'button', onclick: () => { this.tab = id; this.render(); } }, n > 0 ? `${label} · ${n}` : label);
    const count = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    this.tabs.replaceChildren(tab('pocket', t('pocket.title'), Object.values(v.items).filter((n) => n > 0).length), tab('chest', t('pocket.chest'), count(v.chest)), tab('keys', t('pocket.keys'), v.keys.length));
    const entries = this.tab === 'pocket' ? Object.entries(v.items) : this.tab === 'chest' ? Object.entries(v.chest) : v.keys.map((k) => [k, 1] as [string, number]);
    const list = entries.filter(([, n]) => n > 0).sort((a, b) => this.handlers.name(a[0]).localeCompare(this.handlers.name(b[0]), 'uk'));
    // the inventory and the chest as in Minecraft (selling and the keys keep their cards)
    const windowed = !this.selling && !!this.handlers.setSlot && (this.tab === 'pocket' || this.tab === 'chest');
    if (list.length === 0 && !windowed) {
      const empty = this.tab === 'pocket' ? t('pocket.emptyPocket') : this.tab === 'chest' ? t('pocket.emptyChest') : t('pocket.emptyKeys');
      this.body.replaceChildren(h('p', { class: 'pocket-empty' }, empty));
      return;
    }
    const roomLeft = v.capacity - v.used;
    if (this.giving && this.tab === 'pocket') {
      this.renderGiving(this.giving);
      return;
    }
    if (windowed) {
      this.body.replaceChildren(this.tab === 'pocket' ? this.window(v) : this.chestWindow(v));
      this.cursor.replaceChildren(...(this.carrying ? [slotThumb(this.handlers.def(this.carrying.item), 36)] : []));
      if (!this.carrying) this.cursor.classList.remove('shown');
      return;
    }
    this.body.replaceChildren(
      ...(this.selling && this.tab === 'pocket' ? [h('p', { class: 'pocket-sell-head' }, this.selling)] : []),
      h('div', { class: 'pocket-grid' },
        ...list.map(([item, n]) => {
          const actions: HTMLElement[] = [];
          if (this.tab === 'pocket' && this.atHome) {
            actions.push(h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.stash(item, 1) }, t('pocket.stash')));
            if (n > 1) actions.push(h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.stash(item, n) }, t('pocket.all')));
          }
          if (this.tab === 'chest' && this.atHome) {
            // a kind one carries already always fits; a new one needs a free place
            const fits = (v.items[item] ?? 0) > 0 || roomLeft >= 1;
            actions.push(h('button', { class: 'chip', type: 'button', disabled: !fits, onclick: () => this.handlers.take(item, 1) }, t('pocket.take')));
            if (n > 1) actions.push(h('button', { class: 'chip', type: 'button', disabled: !fits, onclick: () => this.handlers.take(item, n) }, t('pocket.all')));
          }
          if (this.tab === 'pocket' && this.selling) {
            const price = this.handlers.price?.(item) ?? null;
            if (price === null) actions.push(h('span', { class: 'pocket-no' }, t('pocket.notBought')));
            else {
              actions.push(h('button', { class: 'chip', type: 'button', 'data-sell': item, onclick: () => this.handlers.sell?.(item, 1) }, t('pocket.sellOne', { price })));
              if (n > 1) actions.push(h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.sell?.(item, n) }, t('pocket.sellAll', { price: price * n })));
            }
          } else if (this.tab === 'pocket') {
            if (this.handlers.wear && this.handlers.def(item)?.armor) actions.push(h('button', { class: 'chip', type: 'button', 'data-wear': item, onclick: () => this.handlers.wear?.(item) }, t('pocket.wear')));
            else if (this.handlers.toHand) actions.push(h('button', { class: 'chip', type: 'button', 'data-hand': item, onclick: () => this.handlers.toHand?.(item) }, t('pocket.toHand')));
            actions.push(h('button', { class: 'chip', type: 'button', 'data-give': item, onclick: () => { this.giving = item; this.render(); } }, t('pocket.give')));
            const sure = this.sure === item;
            actions.push(h('button', { class: `chip ${sure ? 'warn' : ''}`, type: 'button', 'data-throw': item, onclick: () => {
              if (!sure) {
                this.sure = item;
                window.clearTimeout(this.sureTimer);
                this.sureTimer = window.setTimeout(() => { this.sure = null; this.render(); }, 3500);
                this.render();
                return;
              }
              this.sure = null;
              this.handlers.throwAway(item, 1);
            } }, sure ? t('pocket.throwSure') : t('pocket.throw')));
          }
          const look = this.tab === 'keys' ? this.handlers.look?.(item) : null;
          if (look) actions.push(h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.open?.(item) }, look));
          return h('div', { class: 'card pocket-item' },
            h('div', { class: 'thumb-wrap' }, thumb(this.handlers.def(item))),
            h('div', { class: 'name' }, this.handlers.name(item)),
            n > 1 ? h('span', { class: 'count' }, `×${n}`) : null,
            actions.length ? h('div', { class: 'pocket-actions' }, ...actions) : null);
        })),
      ...(this.tab === 'chest' && !this.atHome ? [h('p', { class: 'pocket-empty' }, t('pocket.chestAway'))] : []),
    );
  }

  /** The inventory as in Minecraft: the armour by the hero, the left hand, the cells of the inventory and the nine at
   * hand under them. A click takes a thing up (it follows the pointer), a click on a place puts it there (what was
   * there changes places with it); with Shift, straight across (onto the bar and back, armour put on and taken off). */
  private window(v: PocketView): HTMLElement {
    // what was carried and is gone (eaten, given, thrown away) is not carried any more
    const c = this.carrying;
    if (c && !(v.items[c.item] ?? 0) && !Object.values(v.armor ?? {}).includes(c.item)) this.carrying = null;
    const fig = h('canvas', { width: '24', height: '32', class: 'mc-figure', 'aria-hidden': 'true' });
    this.figureBox = fig;
    this.drawFigure();
    const top = h('div', { class: 'mc-top' },
      h('div', { class: 'mc-armor' }, ...ARMOR_SLOTS.map((s) => this.slot({ kind: 'armor', slot: s }, v.armor?.[s] ?? null, v, t(`pocket.armor.${s}`)))),
      h('div', { class: 'mc-figure-box' }, fig),
      h('div', { class: 'mc-side' },
        h('span', { class: 'mc-defense', title: t('pocket.defense'), 'aria-label': `${t('pocket.defense')}: ${v.defense ?? 0}` }, h('span', { html: iconSvg('lock', 14) }), String(v.defense ?? 0)),
        this.slot({ kind: 'off' }, v.offhand ?? null, v, t('pocket.offhand'))));
    const cells = this.mainCells(v);
    const main = h('div', { class: 'mc-grid mc-main', role: 'group', 'aria-label': t('pocket.title') }, ...cells.map((item, i) => this.slot({ kind: 'main', i }, item, v, '')));
    const bar = h('div', { class: 'mc-grid mc-bar', role: 'group', 'aria-label': t('hud.hotbar') }, ...Array.from({ length: COLS }, (_, i) => this.slot({ kind: 'bar', i }, v.hotbar?.[i] ?? null, v, String(i + 1))));
    return h('div', { class: `mc${this.carrying ? ' carrying' : ''}` }, h('div', { class: 'mc-left' }, top), h('div', { class: 'mc-right' }, main, bar, this.info(v)));
  }

  /** The cells of the inventory: what is not at hand, each kind where one left it, the rest in the first free cells;
   * three rows at least, and always one cell free to put a thing in. */
  private mainCells(v: PocketView): (string | null)[] {
    const atHand = new Set([...(v.hotbar ?? []), v.offhand].filter((x): x is string => !!x));
    const kinds = Object.entries(v.items)
      .filter(([id, n]) => n > 0 && !atHand.has(id))
      .map(([id]) => id)
      .sort((a, b) => this.handlers.name(a).localeCompare(this.handlers.name(b), 'uk'));
    const cells: (string | null)[] = Array(Math.max(3, Math.ceil((kinds.length + 1) / COLS)) * COLS).fill(null);
    const rest: string[] = [];
    for (const id of kinds) {
      const k = this.order[id];
      if (k !== undefined && k < cells.length && !cells[k]) cells[k] = id;
      else rest.push(id);
    }
    for (const id of rest) {
      const k = cells.indexOf(null);
      cells[k] = id;
      this.order[id] = k;
    }
    return cells;
  }

  private saveOrder(): void {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(this.order));
    } catch {
      // kept for this run only
    }
  }

  private slot(p: Place, item: string | null, v: PocketView, label: string): HTMLElement {
    const from = !!this.carrying && placeId(this.carrying.from) === placeId(p);
    const name = item ? this.handlers.name(item) : '';
    const n = item ? (v.items[item] ?? 0) : 0;
    const b = h('button', {
      class: `mc-slot ${p.kind}${from ? ' from' : ''}${item ? ' full' : ''}`,
      type: 'button',
      'data-place': placeId(p),
      'data-item': item ?? undefined,
      'aria-label': [label, name, n > 1 ? `×${n}` : ''].filter(Boolean).join(' · ') || t('pocket.emptyCell'),
      onclick: (e: MouseEvent) => this.click(p, item, e.shiftKey),
      onpointerenter: (e: PointerEvent) => this.showTip(e.pointerType === 'mouse' ? name : ''),
      onpointerleave: () => this.showTip(''),
    });
    if (item) {
      b.append(slotThumb(this.handlers.def(item)));
      if (n > 1) b.append(h('span', { class: 'mc-n' }, String(n)));
    } else if (p.kind === 'armor' || p.kind === 'off') b.append(h('span', { class: 'mc-ghost' }, label));
    if (p.kind === 'bar') b.append(h('span', { class: 'mc-num' }, String(p.i + 1)));
    return b;
  }

  private showTip(name: string): void {
    this.tip.textContent = name;
    this.tip.classList.toggle('shown', !!name && !this.carrying);
  }

  private click(p: Place, item: string | null, shift: boolean): void {
    const hd = this.handlers;
    const c = this.carrying;
    this.showTip('');
    if (!c) {
      if (!item) return;
      if (shift) {
        this.quick(p, item);
        return;
      }
      this.carrying = { item, from: p };
      this.render();
      return;
    }
    const f = c.from;
    // armour goes only where it is worn: a helmet on the head; anything else stays carried
    if (p.kind === 'armor' && hd.def(c.item)?.armor?.slot !== p.slot) return;
    this.carrying = null;
    if (placeId(f) === placeId(p)) {
      this.render();
      return;
    }
    if (p.kind === 'main') {
      // into the inventory: the place it came from takes what lay here (or is left empty)
      if (f.kind === 'bar') hd.setSlot?.(f.i, item);
      else if (f.kind === 'off') hd.setOffhand?.(item);
      else if (f.kind === 'armor') {
        hd.takeOff?.(f.slot);
        if (item) delete this.order[item];
      } else if (item) this.order[item] = f.i;
      this.order[c.item] = p.i;
      this.saveOrder();
    } else if (p.kind === 'bar' || p.kind === 'off') {
      if (f.kind === 'armor') hd.takeOff?.(f.slot);
      if (p.kind === 'bar') hd.setSlot?.(p.i, c.item);
      else hd.setOffhand?.(c.item);
      if (item && f.kind === 'bar') hd.setSlot?.(f.i, item);
      else if (item && f.kind === 'off') hd.setOffhand?.(item);
      else if (item && f.kind === 'main') {
        this.order[item] = f.i;
        this.saveOrder();
      }
    } else {
      if (f.kind === 'bar') hd.setSlot?.(f.i, null);
      else if (f.kind === 'off') hd.setOffhand?.(null);
      hd.wear?.(c.item);
      if (item && f.kind === 'main') {
        this.order[item] = f.i;
        this.saveOrder();
      }
    }
    this.render();
  }

  /** Shift and a click: from the inventory onto the first free place at hand (armour: put on), and back. */
  private quick(p: Place, item: string): void {
    const hd = this.handlers;
    if (p.kind === 'main') {
      if (hd.def(item)?.armor) hd.wear?.(item);
      else {
        const k = (this.view?.hotbar ?? []).findIndex((x) => !x);
        if (k >= 0) hd.setSlot?.(k, item);
      }
    } else if (p.kind === 'bar') hd.setSlot?.(p.i, null);
    else if (p.kind === 'off') hd.setOffhand?.(null);
    else hd.takeOff?.(p.slot);
  }

  /** Under the cells, for what is carried: its name and what can be done with it. */
  private info(v: PocketView): HTMLElement {
    const c = this.carrying;
    if (!c) return h('div', { class: 'mc-info' });
    const hd = this.handlers;
    const item = c.item;
    const n = v.items[item] ?? 0;
    const acts: HTMLElement[] = [];
    const armor = hd.def(item)?.armor;
    if (armor && c.from.kind !== 'armor' && hd.wear) acts.push(h('button', { class: 'chip', type: 'button', 'data-wear': item, onclick: () => this.click({ kind: 'armor', slot: armor.slot }, v.armor?.[armor.slot] ?? null, false) }, t('pocket.wear')));
    if (n > 0) {
      if (this.atHome) acts.push(h('button', { class: 'chip', type: 'button', 'data-stash': item, onclick: () => { this.carrying = null; hd.stash(item, n); } }, t('pocket.stash')));
      acts.push(h('button', { class: 'chip', type: 'button', 'data-give': item, onclick: () => { this.carrying = null; this.giving = item; this.render(); } }, t('pocket.give')));
      const sure = this.sure === item;
      acts.push(h('button', { class: `chip ${sure ? 'warn' : ''}`, type: 'button', 'data-throw': item, onclick: () => {
        if (!sure) {
          this.sure = item;
          window.clearTimeout(this.sureTimer);
          this.sureTimer = window.setTimeout(() => { this.sure = null; this.render(); }, 3500);
          this.render();
          return;
        }
        this.sure = null;
        hd.throwAway(item, 1);
      } }, sure ? t('pocket.throwSure') : t('pocket.throw')));
    }
    return h('div', { class: 'mc-info on' }, h('b', { class: 'mc-name' }, n > 1 ? `${hd.name(item)} ×${n}` : hd.name(item)), ...acts);
  }

  /** The chest at home over the inventory: a click moves the whole of a thing across (away from home, only a look). */
  private chestWindow(v: PocketView): HTMLElement {
    const byName = (a: string, b: string) => this.handlers.name(a).localeCompare(this.handlers.name(b), 'uk');
    const chest = Object.keys(v.chest).filter((id) => (v.chest[id] ?? 0) > 0).sort(byName);
    const mine = Object.keys(v.items).filter((id) => (v.items[id] ?? 0) > 0).sort(byName);
    const roomLeft = v.capacity - v.used;
    const cell = (id: string | null, n: number, where: string, i: number, move: (() => void) | null) => {
      const name = id ? this.handlers.name(id) : '';
      const b = h('button', {
        class: `mc-slot ${where}${id ? ' full' : ''}`,
        type: 'button',
        'data-place': `${where}:${i}`,
        'data-item': id ?? undefined,
        disabled: !id || !move,
        'aria-label': id ? (n > 1 ? `${name} · ×${n}` : name) : t('pocket.emptyCell'),
        onclick: () => move?.(),
        onpointerenter: (e: PointerEvent) => this.showTip(e.pointerType === 'mouse' ? name : ''),
        onpointerleave: () => this.showTip(''),
      });
      if (id) {
        b.append(slotThumb(this.handlers.def(id)));
        if (n > 1) b.append(h('span', { class: 'mc-n' }, String(n)));
      }
      return b;
    };
    const fill = (ids: string[]) => [...ids, ...Array(Math.max(3, Math.ceil(ids.length / COLS)) * COLS - ids.length).fill(null)] as (string | null)[];
    const home = this.atHome;
    return h('div', { class: 'mc mc-chest' },
      h('div', { class: 'mc-right' },
        h('div', { class: 'mc-grid mc-main', role: 'group', 'aria-label': t('pocket.chest') }, ...fill(chest).map((id, i) => {
          const n = id ? (v.chest[id] ?? 0) : 0;
          // a kind one carries already always fits; a new one needs a free place
          const fits = !!id && ((v.items[id] ?? 0) > 0 || roomLeft >= 1);
          return cell(id, n, 'chest', i, home && id && fits ? () => this.handlers.take(id, n) : null);
        })),
        ...(home ? [] : [h('p', { class: 'pocket-empty' }, t('pocket.chestAway'))]),
        h('div', { class: 'mc-grid mc-main', role: 'group', 'aria-label': t('pocket.title') }, ...fill(mine).map((id, i) => {
          const n = id ? (v.items[id] ?? 0) : 0;
          return cell(id, n, 'main', i, home && id ? () => this.handlers.stash(id, n) : null);
        }))));
  }

  private drawFigure(): void {
    const c = this.figureBox;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.translate(-4, 0);
    for (const l of this.handlers.figure?.(this.figureDir) ?? []) {
      g.fillStyle = l.color;
      g.fill(new Path2D(l.path));
    }
  }

  /** Whom to give `item` to: the people near; back to the pocket. */
  private renderGiving(item: string): void {
    const people = this.handlers.recipients(item);
    const back = h('button', { class: 'chip', type: 'button', onclick: () => { this.giving = null; this.render(); } }, t('pocket.back'));
    const row = (p: Recipient) => h('button', { class: 'chip pocket-to', type: 'button', 'data-to': p.id, onclick: () => { this.giving = null; this.handlers.give(item, p); } }, p.name);
    this.body.replaceChildren(
      h('p', { class: 'pocket-sell-head' }, t('pocket.giveWhom', { item: this.handlers.name(item) })),
      ...(people.length ? [h('h4', { class: 'pocket-sub' }, t('pocket.near')), h('div', { class: 'pocket-people' }, ...people.map(row))] : [h('p', { class: 'pocket-empty' }, t('pocket.nobody'))]),
      h('div', { class: 'pocket-actions' }, back),
    );
  }
}
