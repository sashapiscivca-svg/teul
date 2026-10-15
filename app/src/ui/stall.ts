// A counter's wares in one place: what this stall, shelf or counter sells (and buys), each with its price and one
// button; what cannot be had right now says why in the stall's own words. Opened by «Крамничка» at the counter.

import { iconSvg } from '../icons';
import { h } from './dom';
import { t } from '../i18n';

export interface StallRow {
  id: string;
  /** A picture of what one gets (null: a coin, for what the stall buys). */
  thumb: HTMLCanvasElement | null;
  name: string;
  /** What is said under the name (the wares' own words, or why not now). */
  note: string;
  /** The button: «Купити · 4», «Продати · +6». */
  button: string;
  ok: boolean;
}

export interface StallHandlers {
  /** The stall's wares now (asked afresh after every purchase). */
  rows(): StallRow[];
  coins(): number;
  use(id: string): void;
}

export class StallSheet {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly purse: HTMLElement;

  constructor(parent: HTMLElement, private readonly handlers: StallHandlers) {
    this.title = h('b', null, t('stall.title'));
    this.purse = h('span', { class: 'stall-purse' });
    this.body = h('div', { class: 'stall-body' });
    this.root = h(
      'div',
      { class: 'settings stall', role: 'dialog', 'aria-label': t('stall.title') },
      h('div', { class: 'settings-card stall-card' },
        h('div', { class: 'ph' }, this.title, this.purse, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.body),
    );
    this.root.style.display = 'none';
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(title: string): void {
    this.title.textContent = title;
    this.root.setAttribute('aria-label', title);
    this.root.style.display = '';
    this.render();
  }

  close(): void {
    this.root.style.display = 'none';
  }

  render(): void {
    if (!this.isOpen()) return;
    this.purse.innerHTML = `${iconSvg('coin', 16)}<span>${this.handlers.coins()}</span>`;
    const rows = this.handlers.rows();
    if (rows.length === 0) {
      this.body.replaceChildren(h('p', { class: 'hint' }, t('stall.empty')));
      return;
    }
    this.body.replaceChildren(
      ...rows.map((r) => {
        const pic = r.thumb ?? h('span', { class: 'stall-coin', html: iconSvg('coin', 28) });
        if (r.thumb) r.thumb.className = 'stall-thumb';
        return h('div', { class: `stall-row${r.ok ? '' : ' off'}` },
          pic,
          h('div', { class: 'stall-text' }, h('b', null, r.name), r.note ? h('span', { class: 'stall-note' }, r.note) : null),
          h('button', { class: r.ok ? 'cta' : 'cta muted', type: 'button', 'data-station': r.id, onclick: () => this.handlers.use(r.id) }, r.button));
      }),
    );
  }
}
