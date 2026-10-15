// The town's builders (builds.rs): what they can build on to the house, for how much and how long; one's order
// and how far along it is. Taken at the utility office or the town hall; only an owner orders.

import { iconSvg } from '../icons';
import type { BuildOffer, BuildsView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface BuildersDeps {
  /** Orders a room; returns whether the builders took it. */
  order(offer: BuildOffer): boolean;
  coins(): number;
  /** The world day now. */
  today(): number;
}

const ICON: Record<string, string> = { room: 'home', attic: 'home', cellar: 'home', upstairs: 'home', terrace: 'sun', garden: 'leaf', farm: 'leaf', orangery: 'leaf' };

export class BuildersSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement, private readonly deps: BuildersDeps) {
    this.body = h('div', { class: 'pocket-body builders-body' });
    this.root = h(
      'div',
      { class: 'settings builders', role: 'dialog', 'aria-label': t('builders.title') },
      h('div', { class: 'settings-card pocket-card' },
        h('div', { class: 'ph' }, h('b', null, t('builders.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
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

  open(v: BuildsView): void {
    this.render(v);
    this.root.style.display = '';
  }

  refresh(v: BuildsView): void {
    if (this.isOpen()) this.render(v);
  }

  private render(v: BuildsView): void {
    const busy = v.orders.find((o) => !o.done);
    const parts: HTMLElement[] = [];
    if (!v.owner) parts.push(h('p', { class: 'home-warn' }, t('builders.owners')));
    if (busy) {
      parts.push(h('div', { class: 'card build-now' },
        h('b', null, busy.name),
        h('p', { class: 'pocket-empty' }, busy.due ? t('builders.ready') : `${busy.words}. ${busy.ready - this.deps.today() <= 1 ? t('builders.tomorrow') : t('builders.inDays', { n: busy.ready - this.deps.today() })}`),
      ));
    }
    const built = v.orders.filter((o) => o.done);
    if (built.length) parts.push(h('p', { class: 'pocket-empty' }, t('builders.built', { list: built.map((o) => o.name.toLowerCase()).join(', ') })));
    parts.push(h('div', { class: 'recipe-list' },
      ...v.offers.map((o) => {
        const can = v.owner && v.here && !busy && this.deps.coins() >= o.price;
        const why = !v.owner ? t('builders.ownersOnly') : busy ? t('builders.busy') : this.deps.coins() < o.price ? t('builders.noCoins') : '';
        return h('div', { class: `card recipe ${can ? 'ok' : ''}` },
          h('div', { class: 'thumb-wrap build-icon', html: iconSvg(ICON[o.kind] ?? 'home', 34) }),
          h('div', { class: 'recipe-main' },
            h('b', null, o.name),
            h('div', { class: 'recipe-needs' }, h('span', null, `${o.w}×${o.d}`), h('span', null, t('builders.price', { n: o.price })), h('span', null, t('builders.workDays', { n: o.days }))),
            o.text ? h('p', { class: 'recipe-text' }, o.text) : ''),
          h('button', { class: `cta ${can ? '' : 'muted'}`, type: 'button', disabled: !can, onclick: () => this.deps.order(o) && this.close() }, can ? t('builders.order') : why || t('builders.order')));
      })));
    this.body.replaceChildren(...parts);
  }
}
