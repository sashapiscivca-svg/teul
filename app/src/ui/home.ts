// Living at home: the fridge (food out of the pocket), the stove (what one can cook from what one has) and the
// monthly bills (what is due, what is switched off, paying at the utility office).

import { t } from '../i18n';
import { iconSvg } from '../icons';
import { drawPixelThumb } from '../pixel/items';
import type { BillsView, FridgeView, ItemDef, PocketView, RecipeView } from '../types';
import { h } from './dom';

export interface HomeSheetDeps {
  name(item: string): string;
  /** A name for a need: an item or a kind of things (#fish). */
  keyName(key: string): string;
  def(item: string): ItemDef | undefined;
}

function thumb(def: ItemDef | undefined, w = 72, hgt = 58): HTMLCanvasElement {
  const c = h('canvas', { width: String(w), height: String(hgt), class: 'pocket-thumb' });
  const g = c.getContext('2d');
  if (g && def) drawPixelThumb(g, def, w, hgt);
  return c;
}

/** A sheet with a title and a body, closed by a tap outside or the cross. */
class Sheet {
  readonly root: HTMLElement;
  protected readonly body: HTMLElement;
  protected readonly head: HTMLElement;

  constructor(parent: HTMLElement, cls: string, label: string) {
    this.head = h('b', null, label);
    this.body = h('div', { class: 'pocket-body' });
    this.root = h(
      'div',
      { class: `settings ${cls}`, role: 'dialog', 'aria-label': label },
      h('div', { class: 'settings-card pocket-card' }, h('div', { class: 'ph' }, this.head, h('button', { class: 'round small', type: 'button', 'aria-label': t('home.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.body),
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

  protected show(): void {
    this.root.style.display = '';
  }
}

// ---- the fridge --------------------------------------------------------------------------------------------

export class FridgeSheet extends Sheet {
  constructor(parent: HTMLElement, private readonly deps: HomeSheetDeps, private readonly move: (item: string, n: number, into: boolean) => void) {
    super(parent, 'fridge', t('home.fridge'));
  }

  /** `food`: what of the pocket can go into the fridge. */
  open(fridge: FridgeView, pocket: PocketView, food: (item: string) => boolean): void {
    this.render(fridge, pocket, food);
    this.show();
  }

  refresh(fridge: FridgeView, pocket: PocketView, food: (item: string) => boolean): void {
    if (this.isOpen()) this.render(fridge, pocket, food);
  }

  private render(fridge: FridgeView, pocket: PocketView, food: (item: string) => boolean): void {
    const card = (item: string, n: number, action: HTMLElement[]) =>
      h('div', { class: 'card pocket-item' }, h('div', { class: 'thumb-wrap' }, thumb(this.deps.def(item))), h('div', { class: 'name' }, this.deps.name(item)), n > 1 ? h('span', { class: 'count' }, `×${n}`) : '', ...(action.length ? [h('div', { class: 'pocket-actions' }, ...action)] : []));
    const inside = Object.entries(fridge.items).filter(([, n]) => n > 0);
    const room = pocket.capacity - pocket.used;
    const parts: HTMLElement[] = [];
    if (fridge.broken) parts.push(h('p', { class: 'home-warn' }, t('home.fridgeBroken', { why: fridge.broken })));
    else if (!fridge.working) parts.push(h('p', { class: 'home-warn' }, t('home.fridgeOff')));
    parts.push(h('h3', { class: 'home-sub' }, t('home.inFridge')));
    parts.push(inside.length
      ? h('div', { class: 'pocket-grid' }, ...inside.map(([item, n]) => card(item, n, fridge.working ? [
        h('button', { class: 'chip', type: 'button', disabled: room < 1, onclick: () => this.move(item, 1, false) }, t('home.take')),
        ...(n > 1 ? [h('button', { class: 'chip', type: 'button', disabled: room < 2, onclick: () => this.move(item, Math.min(n, room), false) }, t('home.asMuchAsFits'))] : []),
      ] : [])))
      : h('p', { class: 'pocket-empty' }, t('home.fridgeEmpty')));
    const carried = Object.entries(pocket.items).filter(([item, n]) => n > 0 && food(item));
    parts.push(h('h3', { class: 'home-sub' }, t('home.pocketFood')));
    parts.push(carried.length
      ? h('div', { class: 'pocket-grid' }, ...carried.map(([item, n]) => card(item, n, fridge.working ? [
        h('button', { class: 'chip', type: 'button', onclick: () => this.move(item, 1, true) }, t('home.put')),
        ...(n > 1 ? [h('button', { class: 'chip', type: 'button', onclick: () => this.move(item, n, true) }, t('home.all'))] : []),
      ] : [])))
      : h('p', { class: 'pocket-empty' }, t('home.noPocketFood')));
    this.body.replaceChildren(...parts);
  }
}

// ---- the stove ---------------------------------------------------------------------------------------------

const COOK_REASON: Record<string, string> = {
  not_here: 'home.cookNotHere',
  no_stove: 'home.cookNoStove',
  gas: 'home.cookGas',
  not_enough: 'home.cookNotEnough',
  pocket_full: 'home.cookPocketFull',
};

export class CookSheet extends Sheet {
  constructor(parent: HTMLElement, private readonly deps: HomeSheetDeps, private readonly cook: (recipe: string) => void) {
    super(parent, 'cook', t('home.stove'));
  }

  open(recipes: RecipeView[]): void {
    this.render(recipes);
    this.show();
  }

  refresh(recipes: RecipeView[]): void {
    if (this.isOpen()) this.render(recipes);
  }

  private render(recipes: RecipeView[]): void {
    const gasOff = recipes.some((r) => r.reason === 'gas');
    // what can be cooked first, then the closest to it
    const order = [...recipes].sort((a, b) => Number(b.ok) - Number(a.ok) || b.needs.filter(([, n, have]) => have >= n).length / b.needs.length - a.needs.filter(([, n, have]) => have >= n).length / a.needs.length);
    this.body.replaceChildren(
      ...(gasOff ? [h('p', { class: 'home-warn' }, t('home.stoveCold'))] : []),
      h('p', { class: 'pocket-empty' }, t('home.cookFrom')),
      h('div', { class: 'recipe-list' },
        ...order.map((r) =>
          h('div', { class: `card recipe ${r.ok ? 'ok' : ''}` },
            h('div', { class: 'thumb-wrap' }, thumb(this.deps.def(r.gives[0]), 64, 52)),
            h('div', { class: 'recipe-main' },
              h('b', null, r.gives[1] > 1 ? `${r.name} ×${r.gives[1]}` : r.name),
              h('div', { class: 'recipe-needs' }, ...r.needs.map(([k, n, have]) => h('span', { class: have >= n ? 'have' : 'miss' }, `${this.deps.keyName(k)} ${Math.min(have, n)}/${n}`))),
              r.text ? h('p', { class: 'recipe-text' }, r.text) : ''),
            h('button', { class: `cta ${r.ok ? '' : 'muted'}`, type: 'button', disabled: !r.ok, title: r.reason && COOK_REASON[r.reason] ? t(COOK_REASON[r.reason]) : '', onclick: () => this.cook(r.id) }, r.ok ? t('home.cook') : t(COOK_REASON[r.reason ?? ''] ?? 'home.cannot')),
          )),
      ),
    );
  }
}

// ---- the bills ---------------------------------------------------------------------------------------------

/** The bills, as a block for any panel: switched-off utilities, what is due, pay buttons when at the office. */
export function billsBlock(v: BillsView, pay: (utility: string | null) => void): HTMLElement {
  const off = v.utilities.filter((u) => !u.on);
  const unpaid = v.bills.filter((b) => !b.paid);
  const status = h('div', { class: 'bills-utils' }, ...v.utilities.map((u) => h('span', { class: `bill-util ${u.on ? 'on' : 'off'}` }, `${u.name}: ${u.on ? t('home.utilOn') : t('home.utilOff')}`)));
  const rows = v.bills.map((b) =>
    h('div', { class: `bill-row ${b.paid ? 'paid' : b.overdue ? 'overdue' : ''}` },
      h('span', { class: 'bill-name' }, b.name),
      h('span', { class: 'bill-period' }, b.period),
      h('span', { class: 'bill-sum' }, t('home.coins', { n: b.amount })),
      h('span', { class: 'bill-state' }, b.paid ? t('home.paid') : b.overdue ? t('home.overdue', { due: b.due }) : t('home.due', { due: b.due })),
      v.can_pay && !b.paid ? h('button', { class: 'chip', type: 'button', onclick: () => pay(b.utility) }, t('home.pay')) : ''));
  const where = v.can_pay
    ? h('p', { class: 'pocket-empty' }, t('home.atOffice'))
    : h('p', { class: 'pocket-empty' }, t('home.payAt', { office: v.office_name, from: v.hours[0], to: v.hours[1] }));
  return h('div', { class: 'bills' },
    ...(off.length ? [h('p', { class: 'home-warn' }, t('home.cutOff', { what: off.map((u) => u.name.toLowerCase()).join(', ') }))] : []),
    status,
    unpaid.length === 0 && v.bills.length === 0 ? h('p', { class: 'pocket-empty' }, t('home.noBills')) : '',
    unpaid.length === 0 && v.bills.length > 0 ? h('p', { class: 'pocket-empty' }, t('home.allPaid')) : '',
    ...rows,
    unpaid.length > 1 && v.can_pay ? h('button', { class: 'cta', type: 'button', onclick: () => pay(null) }, t('home.payAll', { n: v.total_due })) : '',
    where);
}

export class BillsSheet extends Sheet {
  constructor(parent: HTMLElement, private readonly pay: (utility: string | null) => void) {
    super(parent, 'bills-sheet', t('home.billsTitle'));
  }

  open(v: BillsView): void {
    this.body.replaceChildren(billsBlock(v, this.pay));
    this.show();
  }

  refresh(v: BillsView): void {
    if (this.isOpen()) this.body.replaceChildren(billsBlock(v, this.pay));
  }
}
