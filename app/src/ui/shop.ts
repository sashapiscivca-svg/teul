import { drawItemThumbnail } from '../render';
import { iconSvg } from '../icons';
import { t } from '../i18n';
import type { Cost, GameEngineLike } from './shared';
import type { InventoryEntry, ItemDef, Missing, ShopEntry, StyleDef } from '../types';
import { clear, h } from './dom';

export interface ShopDeps {
  engine: GameEngineLike;
  now(): number;
  activeStyles(): Record<string, string>;
  onBuyItem(id: string): void;
  onBuyStyle(id: string, kind: string, owned: boolean): void;
  onExpand(id: string): void;
  onPickInventory(item: string): void;
  /** Sells a thing that stands nowhere second-hand (at home only); null when nobody would buy it. */
  sellBackPrice?(item: string): number | null;
  onSellBack?(item: string): void;
  onClose(): void;
}

export type Tab = 'shop' | 'inventory' | 'room';

const CATEGORIES: [string, string][] = [
  ['all', 'bag'],
  ['seating', 'sit'],
  ['tables', 'brew_tea'],
  ['storage', 'store'],
  ['lighting', 'sun'],
  ['decor', 'heart'],
  ['plants', 'water_plant'],
  ['rugs', 'palette'],
  ['wall', 'read'],
  ['openings', 'door'],
  ['kitchen', 'brew_tea'],
  ['bath', 'water_plant'],
  ['office', 'read'],
  ['kids', 'heart'],
  ['garden', 'leaf'],
  ['farm', 'harvest'],
  ['orangery', 'sun'],
  ['flowers', 'heart'],
  ['custom', 'hammer'],
];

/** Categories sold only in their own shop in the village, not in the catalogue. */
const STORE_ONLY = new Set(['flowers', 'dairy']);

/** The room's groups: id, the key of its label, icon. */
const ROOM_GROUPS: [string, string, string][] = [
  ['floor', 'shop.floor', 'palette'],
  ['wall', 'shop.walls', 'home'],
  ['backdrop', 'shop.backdrop', 'sun'],
  ['weather', 'shop.weather', 'rest'],
  // floor is no longer sold here: it is bought in the plan of the home, while building (ui/plan.ts)
];

function costLine(cost: Cost): HTMLElement {
  const box = h('div', { class: 'price' });
  if (cost.coins === 0 && Object.values(cost.tokens).every((n) => n === 0)) {
    box.append(h('span', { class: 'free' }, t('ui.free')));
    return box;
  }
  if (cost.coins > 0) box.append(h('span', { html: `${iconSvg('coin', 15, '#f4b860')}<b>${cost.coins}</b>` }));
  for (const [kind, n] of Object.entries(cost.tokens)) {
    if (n > 0) box.append(h('span', { html: `${iconSvg(kind === 'leaf' ? 'leaf' : 'page', 15, '#7ad06a')}<b>${n}</b>` }));
  }
  return box;
}

function missingLine(missing: Missing[]): HTMLElement {
  const box = h('div', { class: 'need' }, h('span', { html: iconSvg('lock', 14, '#8f94ad') }));
  for (const m of missing) {
    if (m.type === 'coins') box.append(h('span', { html: `${iconSvg('coin', 14, '#8f94ad')} ${m.have}/${m.need}` }));
    else if (m.type === 'token') box.append(h('span', { html: `${iconSvg(m.kind === 'leaf' ? 'leaf' : 'page', 14, '#8f94ad')} ${m.have}/${m.need}` }));
    else if (m.type === 'action') box.append(h('span', { html: `${iconSvg(m.kind, 14, '#8f94ad')} ${m.have}/${m.need}` }));
    else box.append(h('span', { html: iconSvg('sun', 14, '#8f94ad') }));
  }
  return box;
}

function missingText(m: Missing): string {
  if (m.type === 'coins') return t('shop.moreCoins', { n: m.need - m.have });
  if (m.type === 'token') return t('shop.tokenOf', { what: t(`token.${m.kind}`), have: m.have, need: m.need });
  if (m.type === 'action') return t('shop.actionOf', { what: t(`action.${m.kind}`), have: m.have, need: m.need });
  return t('shop.otherSeason');
}

export function thumb(def: ItemDef, w: number, hgt: number, rot = 0): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = h('canvas', { width: Math.round(w * dpr), height: Math.round(hgt * dpr) });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawItemThumbnail(ctx, def, w, hgt, {}, rot);
  }
  return c;
}

function swatch(def: StyleDef): HTMLElement {
  const a = def.params.color ?? '#888888';
  const b = def.params.alt ?? def.params.color_right ?? a;
  if (def.kind === 'backdrop' || def.kind === 'weather') {
    return h('div', { class: `swatch big scene-${def.params.kind ?? 'none'}`, html: iconSvg(def.kind === 'weather' ? 'rest' : 'sun', 30, '#ffffffcc') });
  }
  const el = h('div', { class: `swatch big pattern-${def.params.pattern ?? 'plain'}` });
  el.style.setProperty('--a', a);
  el.style.setProperty('--b', b);
  return el;
}

type Selection = { kind: 'item' | 'style' | 'expansion'; id: string } | null;

/** The catalogue: the shop, the player's things and the room's surfaces, with a detail card for the selection. */
export class ShopSheet {
  readonly root: HTMLElement;
  private readonly tabsRow: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly search: HTMLInputElement;
  private tab: Tab = 'shop';
  private category = 'all';
  private group = 'floor';
  private query = '';
  private selected: Selection = null;
  private opened = false;
  private spin = 0;
  private spinTimer: number | null = null;
  private previewHost: HTMLElement | null = null;
  /** A shop in the world (the flower shop): only its own categories, under its own name. */
  private store: { title: string; categories: string[] } | null = null;

  constructor(parent: HTMLElement, private readonly deps: ShopDeps) {
    this.tabsRow = h('div', { class: 'tabs', role: 'tablist' });
    this.wallet = h('div', { class: 'cat-wallet' });
    this.search = h('input', { class: 'cat-search', type: 'search', placeholder: t('shop.search'), 'aria-label': t('shop.search') });
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.renderGrid();
    });
    const close = h('button', { class: 'round', type: 'button', 'aria-label': t('ui.done'), html: iconSvg('close', 22), onclick: () => deps.onClose() });
    this.rail = h('nav', { class: 'cat-rail' });
    this.grid = h('div', { class: 'cards' });
    this.detail = h('aside', { class: 'detail' });
    const panel = h('div', { class: 'cat-panel' }, h('div', { class: 'sheet-head' }, this.tabsRow, this.search, this.wallet, close), h('div', { class: 'cat-body' }, this.rail, this.grid, this.detail));
    this.root = h('div', { class: 'sheet', role: 'dialog', 'aria-label': t('ui.shop') }, panel);
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) deps.onClose();
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.opened;
  }

  /** Opens as a shop in the world selling only these categories. */
  openStore(title: string, categories: string[]): void {
    this.store = { title, categories };
    this.selected = null;
    this.category = 'all';
    this.tab = 'shop';
    this.opened = true;
    this.root.classList.add('open');
    this.refresh();
  }

  open(tab: Tab = this.tab): void {
    if (this.store) {
      this.store = null;
      this.selected = null;
      this.category = 'all';
    }
    if (tab !== this.tab) {
      this.selected = null;
      this.category = 'all';
    }
    this.tab = tab;
    this.opened = true;
    this.root.classList.add('open');
    this.refresh();
    if (this.spinTimer === null) {
      this.spinTimer = window.setInterval(() => {
        this.spin = (this.spin + 1) % 4;
        this.renderPreview();
      }, 1400);
    }
  }

  close(): void {
    this.opened = false;
    this.root.classList.remove('open');
    if (this.spinTimer !== null) window.clearInterval(this.spinTimer);
    this.spinTimer = null;
  }

  refresh(): void {
    if (!this.opened) return;
    this.renderTabs();
    this.renderWallet();
    this.renderRail();
    this.renderGrid();
    this.renderDetail();
  }

  private renderTabs(): void {
    clear(this.tabsRow);
    if (this.store) {
      this.tabsRow.append(h('div', { class: 'tab on', html: `${iconSvg('heart', 18)}<span>${this.store.title}</span>` }));
      return;
    }
    const tab = (id: Tab, label: string, icon: string) =>
      h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(this.tab === id), html: `${iconSvg(icon, 18)}<span>${label}</span>`, onclick: () => this.open(id) });
    this.tabsRow.append(tab('shop', t('ui.shop'), 'bag'), tab('inventory', t('ui.inventory'), 'store'), tab('room', t('ui.room'), 'home'));
  }

  private renderWallet(): void {
    clear(this.wallet);
    const w = this.deps.engine.wallet?.();
    if (!w) return;
    this.wallet.insertAdjacentHTML('beforeend', `${iconSvg('coin', 16, '#f4b860')}<b>${w.coins}</b>`);
    for (const [kind, n] of Object.entries(w.tokens)) if (n > 0) this.wallet.insertAdjacentHTML('beforeend', `${iconSvg(kind === 'leaf' ? 'leaf' : 'page', 15, kind === 'leaf' ? '#7ad06a' : '#9db2ff')}<b>${n}</b>`);
  }

  private renderRail(): void {
    clear(this.rail);
    if (this.tab === 'room') {
      for (const [id, label, icon] of ROOM_GROUPS) {
        this.rail.append(h('button', { class: `rail-btn ${this.group === id ? 'on' : ''}`, type: 'button', onclick: () => { this.group = id; this.selected = null; this.refresh(); } }, h('span', { class: 'ri', html: iconSvg(icon, 20) }), h('span', null, t(label))));
      }
      return;
    }
    const present = new Set(Object.values(this.deps.engine.catalog.items).map((i) => i.category));
    for (const [id, icon] of CATEGORIES) {
      if (id !== 'all' && !present.has(id)) continue;
      if (this.store ? id !== 'all' && !this.store.categories.includes(id) : STORE_ONLY.has(id)) continue;
      const label = id === 'all' ? t('shop.all') : id === 'custom' ? t('shop.myMade') : t(`cat.${id}`);
      this.rail.append(h('button', { class: `rail-btn ${this.category === id ? 'on' : ''}`, type: 'button', onclick: () => { this.category = id; this.renderRail(); this.renderGrid(); } }, h('span', { class: 'ri', html: iconSvg(icon, 20) }), h('span', null, label)));
    }
  }

  private matches(name: string): boolean {
    return this.query === '' || name.toLowerCase().includes(this.query);
  }

  private tile(on: boolean, cls: string, select: () => void, ...kids: (Node | string)[]): HTMLElement {
    const el = h('div', { class: `card ${cls} ${on ? 'sel' : ''}`, role: 'button', tabindex: '0' }, ...kids);
    el.addEventListener('click', select);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
    return el;
  }

  private renderGrid(): void {
    clear(this.grid);
    const { engine } = this.deps;
    if (this.tab === 'shop') {
      const owned = new Map(engine.inventory().map((i) => [i.item, i.owned]));
      const store = this.store;
      const entries = engine
        .shop(this.deps.now())
        .filter((e) => e.kind === 'item' && (this.category === 'all' || e.category === this.category) && (store ? store.categories.includes(e.category) : !STORE_ONLY.has(e.category)));
      entries.sort((a, b) => Number(b.status.state === 'available') - Number(a.status.state === 'available'));
      for (const e of entries) {
        const def = engine.catalog.items[e.id];
        if (!def || !this.matches(t(def.name))) continue;
        const count = owned.get(e.id) ?? 0;
        const el = this.tile(this.selected?.kind === 'item' && this.selected.id === e.id, e.status.state === 'available' ? 'can' : 'locked', () => this.select({ kind: 'item', id: e.id }), h('div', { class: 'thumb-wrap' }, thumb(def, 112, 84)), h('div', { class: 'name' }, t(def.name)));
        if (e.status.state === 'available') el.append(costLine(e.status.cost));
        else if (e.status.state === 'locked') el.append(missingLine(e.status.missing));
        if (count > 0) el.append(h('span', { class: 'count' }, `×${count}`));
        this.grid.append(el);
      }
      if (this.grid.childElementCount === 0) this.grid.append(h('div', { class: 'empty' }, t('shop.nothingFound')));
    } else if (this.tab === 'inventory') {
      const items = engine.inventory().filter((i) => i.known && i.free > 0 && (this.category === 'all' || engine.catalog.items[i.item]?.category === this.category));
      for (const entry of items) {
        const def = engine.catalog.items[entry.item];
        if (!this.matches(t(def.name))) continue;
        this.grid.append(this.tile(this.selected?.kind === 'item' && this.selected.id === entry.item, 'can', () => this.select({ kind: 'item', id: entry.item }), h('div', { class: 'thumb-wrap' }, thumb(def, 112, 84)), h('div', { class: 'name' }, t(def.name)), h('span', { class: 'count' }, `×${entry.free}`)));
      }
      if (this.grid.childElementCount === 0) this.grid.append(h('div', { class: 'empty' }, h('div', { html: iconSvg('store', 40, '#5a6080') }), t('shop.emptyStore')));
    } else {
      const active = this.deps.activeStyles();
      for (const e of engine.shop(this.deps.now())) {
        if (this.group === 'expansion') {
          if (e.kind !== 'expansion') continue;
          const def = engine.catalog.expansions[e.id];
          if (!def) continue;
          const el = this.tile(this.selected?.id === e.id, e.status.state === 'locked' ? 'locked' : 'can', () => this.select({ kind: 'expansion', id: e.id }), h('div', { class: 'swatch big area', html: `${iconSvg('plus', 26, '#f4b860')}<b>+${def.area}</b>` }), h('div', { class: 'name' }, t(def.name)));
          el.append(e.status.state === 'owned' ? h('div', { class: 'price', html: iconSvg('check', 16, '#55d6c2') }) : e.status.state === 'available' ? costLine(e.status.cost) : missingLine(e.status.missing));
          this.grid.append(el);
          continue;
        }
        if (e.kind !== 'style') continue;
        const def = engine.catalog.styles[e.id];
        if (!def || def.kind !== this.group || !this.matches(t(def.name))) continue;
        const isOn = active[def.kind] === e.id;
        const el = this.tile(this.selected?.id === e.id, isOn ? 'can active' : e.status.state === 'locked' ? 'locked' : '', () => this.select({ kind: 'style', id: e.id }), swatch(def), h('div', { class: 'name' }, t(def.name)));
        el.append(isOn ? h('div', { class: 'price', html: `${iconSvg('check', 16, '#55d6c2')}<span>${t('shop.now')}</span>` }) : e.status.state === 'available' ? costLine(e.status.cost) : e.status.state === 'locked' ? missingLine(e.status.missing) : h('div', { class: 'price' }, t('ui.owned')));
        this.grid.append(el);
      }
    }
  }

  private select(s: Selection): void {
    this.selected = s;
    this.spin = 0;
    for (const el of this.grid.querySelectorAll('.card.sel')) el.classList.remove('sel');
    this.renderGrid();
    this.renderDetail();
  }

  private renderPreview(): void {
    if (!this.previewHost || this.selected?.kind !== 'item') return;
    const def = this.deps.engine.catalog.items[this.selected.id];
    if (!def) return;
    clear(this.previewHost);
    this.previewHost.append(thumb(def, 240, 170, def.layer === 'wall' ? 0 : this.spin));
  }

  private actions(...kids: (HTMLElement | null)[]): HTMLElement {
    const box = h('div', { class: 'detail-actions' });
    for (const k of kids) if (k) box.append(k);
    return box;
  }

  private statusLine(entry: ShopEntry | undefined): HTMLElement | null {
    if (!entry) return null;
    if (entry.status.state === 'available') return costLine(entry.status.cost);
    if (entry.status.state === 'locked') return h('div', { class: 'need-text' }, ...entry.status.missing.map((m) => h('div', null, missingText(m))));
    return null;
  }

  private renderDetail(): void {
    clear(this.detail);
    this.previewHost = null;
    const sel = this.selected;
    const { engine } = this.deps;
    if (!sel) {
      this.detail.append(h('div', { class: 'detail-empty' }, h('div', { html: iconSvg(this.tab === 'room' ? 'home' : 'bag', 44, '#4a5070') }), this.tab === 'room' ? t('shop.pickRoom') : t('shop.pickThing')));
      return;
    }
    const entry = engine.shop(this.deps.now()).find((e) => e.id === sel.id);
    if (sel.kind === 'item') {
      const def = engine.catalog.items[sel.id];
      if (!def) return;
      const free = engine.inventory().find((i) => i.item === sel.id)?.free ?? 0;
      this.previewHost = h('div', { class: 'preview-stage' });
      this.detail.append(this.previewHost);
      this.renderPreview();
      const features: string[] = [`${def.footprint.w}×${def.footprint.d}`];
      if (def.layer === 'wall') features.push(t('shop.onWall'));
      if (def.layer === 'surface') features.push(t('shop.onTable'));
      if (def.rules.provides_surface) features.push(t('shop.surface'));
      if (def.tags.includes('light')) features.push(t('shop.glows'));
      this.detail.append(
        h('div', { class: 'detail-title' }, t(def.name)),
        h('div', { class: 'detail-meta' }, def.category === 'custom' ? t('shop.myThing') : t(`cat.${def.category}`)),
        h('div', { class: 'feature-row' }, ...features.map((f) => h('span', { class: 'feature' }, f)), ...def.actions.map((a) => h('span', { class: 'feature act', html: `${iconSvg(a, 14)}<span>${t(`action.${a}`)}</span>` }))),
      );
      const buy = this.tab === 'shop' && entry ? h('button', { class: `cta buy ${entry.status.state === 'available' ? '' : 'muted'}`, type: 'button', onclick: () => this.deps.onBuyItem(sel.id) }, t('shop.buy')) : null;
      const place = free > 0 && !this.store ? h('button', { class: `cta place ${buy ? 'secondary' : ''}`, type: 'button', onclick: () => this.deps.onPickInventory(sel.id) }, t('shop.place', { n: free })) : null;
      const price = this.tab === 'inventory' && free > 0 ? this.deps.sellBackPrice?.(sel.id) ?? null : null;
      const sell = price !== null ? h('button', { class: 'cta secondary sell-back', type: 'button', onclick: () => this.deps.onSellBack?.(sel.id) }, t('shop.sellBack', { price })) : null;
      this.detail.append(this.actions(this.tab === 'shop' ? this.statusLine(entry) : null, buy, place, sell));
      return;
    }
    if (sel.kind === 'style') {
      const def = engine.catalog.styles[sel.id];
      if (!def || !entry) return;
      const active = this.deps.activeStyles()[def.kind] === sel.id;
      this.detail.append(h('div', { class: 'preview-stage style' }, swatch(def)), h('div', { class: 'detail-title' }, t(def.name)), h('div', { class: 'detail-meta' }, t(ROOM_GROUPS.find((g) => g[0] === def.kind)?.[1] ?? def.kind)));
      const cta = h('button', { class: `cta ${active ? 'muted' : ''}`, type: 'button', onclick: () => !active && this.deps.onBuyStyle(sel.id, def.kind, entry.status.state === 'owned') }, active ? t('shop.inRoom') : entry.status.state === 'owned' ? t('shop.apply') : t('shop.buyApply'));
      this.detail.append(this.actions(this.statusLine(entry), cta));
      return;
    }
    const def = engine.catalog.expansions[sel.id];
    if (!def || !entry) return;
    this.detail.append(
      h('div', { class: 'preview-stage style' }, h('div', { class: 'swatch big area', html: `${iconSvg('plus', 36, '#f4b860')}<b>+${def.area}</b>` })),
      h('div', { class: 'detail-title' }, t(def.name)),
      h('div', { class: 'detail-meta' }, t('shop.moreCells', { n: def.area })),
    );
    const cta = h('button', { class: `cta ${entry.status.state === 'owned' ? 'muted' : ''}`, type: 'button', onclick: () => entry.status.state !== 'owned' && this.deps.onExpand(sel.id) }, entry.status.state === 'owned' ? t('shop.have') : t('shop.expand'));
    this.detail.append(this.actions(this.statusLine(entry), cta));
  }
}

export type { InventoryEntry };
