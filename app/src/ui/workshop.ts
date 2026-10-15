// The workshop "Друге життя": the worn things the player has found, what mending each costs, and the button.
// A mended thing goes to the inventory, ready to be put in the house.

import { iconSvg } from '../icons';
import { t } from '../i18n';
import type { Catalog } from '../types';
import { h } from './dom';
import { thumb } from './shop';

export interface WornEntry {
  item: string;
  free: number;
}

export class WorkshopSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly purse: HTMLElement;

  constructor(parent: HTMLElement, private readonly catalog: () => Catalog, private readonly onRestore: (item: string) => boolean) {
    this.body = h('div', { class: 'workshop-body' });
    this.purse = h('span', { class: 'workshop-purse' });
    this.root = h(
      'div',
      { class: 'settings workshop', role: 'dialog', 'aria-label': t('workshop.label') },
      h('div', { class: 'settings-card' },
        h('div', { class: 'ph' }, h('b', null, t('workshop.title')), this.purse, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('p', { class: 'workshop-intro' }, t('workshop.intro')),
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

  open(worn: WornEntry[], coins: number): void {
    this.root.style.display = '';
    this.render(worn, coins);
  }

  render(worn: WornEntry[], coins: number): void {
    const c = this.catalog();
    this.purse.innerHTML = `${iconSvg('coin', 16)} ${coins}`;
    this.body.replaceChildren();
    if (worn.length === 0) {
      this.body.append(h('p', { class: 'workshop-empty' }, t('workshop.empty')));
      return;
    }
    for (const w of worn) {
      const def = c.items[w.item];
      const into = def?.restores ? c.items[def.restores] : undefined;
      if (!def || !into) continue;
      const price = c.restore_prices?.[w.item] ?? 30;
      const can = coins >= price;
      this.body.append(
        h('div', { class: 'workshop-row' },
          h('div', { class: 'thumb-wrap' }, thumb(def, 72, 56)),
          h('span', { class: 'workshop-arrow' }, '→'),
          h('div', { class: 'thumb-wrap' }, thumb(into, 72, 56)),
          h('div', { class: 'workshop-name' }, h('b', null, t(into.name)), h('span', null, w.free > 1 ? t('workshop.wornN', { n: w.free }) : t('workshop.worn'))),
          h('button', { class: `cta ${can ? '' : 'muted'}`, type: 'button', disabled: !can, onclick: () => this.onRestore(w.item) }, t('workshop.restore', { price }))),
      );
    }
  }
}
