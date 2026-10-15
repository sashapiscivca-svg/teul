// «Авто»: the cars one can buy, as a list to look through and choose from (on the phone, from the menu). The car
// bought waits at the service station's forecourt with its keys; servicing it is another matter.

import { iconSvg } from '../icons';
import { t } from '../i18n';
import type { DriveCarDef, ItemDef } from '../types';
import { h } from './dom';
import { thumb } from './shop';

export interface CarsDeps {
  cars(): DriveCarDef[];
  item(id: string): ItemDef | undefined;
  coins(): number;
  /** The car one has already, if any (its model id). */
  owned(): string | null;
  /** Buys a car; returns words to show when it could not be bought, or null when it is done. */
  buy(id: string): string | null;
}

export class CarsSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement, private readonly deps: CarsDeps) {
    this.body = h('div', { class: 'cars-body' });
    this.root = h(
      'div',
      { class: 'settings cars', role: 'dialog', 'aria-label': t('cars.title') },
      h('div', { class: 'settings-card' },
        h('div', { class: 'ph' }, h('b', null, t('cars.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('cars.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.body),
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

  open(): void {
    this.render();
    this.root.style.display = '';
  }

  private render(note = ''): void {
    const owned = this.deps.owned();
    const coins = this.deps.coins();
    const rows = [...this.deps.cars()].sort((a, b) => a.price - b.price).map((c) => {
      const def = this.deps.item(c.item);
      const mine = owned === c.id;
      const short = coins < c.price;
      const btn = h('button', { class: 'cta', type: 'button', disabled: !!owned || short, onclick: () => {
        const r = this.deps.buy(c.id);
        this.render(r ?? t('cars.bought', { name: c.name }));
      } }, mine ? t('cars.yours') : t('cars.buy', { price: c.price }));
      return h('div', { class: `car-row ${mine ? 'mine' : ''}` },
        def ? thumb(def, 96, 64, 1) : h('span', null),
        h('div', { class: 'car-text' }, h('b', null, c.name), h('p', null, c.text), short && !owned ? h('small', null, t('cars.short')) : null),
        btn);
    });
    this.body.replaceChildren(
      ...(note ? [h('p', { class: 'cars-note' }, note)] : []),
      ...(owned && !note ? [h('p', { class: 'cars-note' }, t('cars.haveOne'))] : []),
      ...rows,
    );
  }
}
