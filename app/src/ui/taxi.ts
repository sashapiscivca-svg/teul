// The taxi stand: where the taxi can take you from here, and what each ride costs.

import { iconSvg } from '../icons';
import { h } from './dom';
import { t } from '../i18n';

export interface TaxiStopView {
  id: string;
  name: string;
  fare: number;
  /** The place it is in, for grouping. */
  where?: string;
  /** Why the taxi cannot go there yet (a place still shut), in the world's words. */
  shut?: string | null;
  /** Minutes until the car is there. */
  eta?: number;
  /** Why the price is what it is now (empty: the usual price). */
  why?: string;
  /** 1 dearer than usual, -1 cheaper. */
  trend?: number;
}

export class TaxiSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly note: HTMLElement;
  private stops: TaxiStopView[] = [];
  private coins = 0;

  constructor(parent: HTMLElement, private readonly onRide: (stop: string) => void) {
    this.body = h('div', { class: 'taxi-body' });
    this.search = h('input', { class: 'taxi-search', type: 'search', placeholder: t('taxi.where'), 'aria-label': t('taxi.where') }) as HTMLInputElement;
    this.search.addEventListener('input', () => this.render());
    this.note = h('div', { class: 'taxi-note' });
    this.root = h(
      'div',
      { class: 'settings taxi', role: 'dialog', 'aria-label': t('taxi.label') },
      h('div', { class: 'settings-card' },
        h('div', { class: 'ph' }, h('b', null, t('taxi.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.note,
        this.search,
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

  open(stops: TaxiStopView[], coins: number): void {
    this.stops = stops;
    this.coins = coins;
    this.search.value = '';
    // how soon a car comes, and why the prices are what they are now (the reason most rides share)
    const open = stops.filter((x) => !x.shut);
    const eta = open.length ? Math.min(...open.map((x) => x.eta ?? 0)) : 0;
    const why = this.common();
    const trend = open.find((x) => x.why === why)?.trend ?? 0;
    this.note.replaceChildren(
      ...(eta ? [h('span', { class: 'taxi-eta' }, t('taxi.nearest', { eta }))] : []),
      ...(why ? [h('small', { class: `taxi-reason ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}` }, why)] : []),
    );
    this.note.style.display = eta || why ? '' : 'none';
    this.render();
    this.root.style.display = '';
  }

  /** The reason most rides share now. */
  private common(): string {
    const n = new Map<string, number>();
    for (const x of this.stops) if (!x.shut && x.why) n.set(x.why, (n.get(x.why) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }

  /** Grouped by the place they are in, nearest places first; narrowed by what is typed. */
  private render(): void {
    const q = this.search.value.trim().toLowerCase();
    const shown = q ? this.stops.filter((s) => s.name.toLowerCase().includes(q) || (s.where ?? '').toLowerCase().includes(q)) : this.stops;
    const kids: HTMLElement[] = [];
    let where = '';
    for (const s of shown) {
      if (s.where && s.where !== where) {
        where = s.where;
        kids.push(h('b', { class: 'taxi-where' }, where));
      }
      kids.push(this.row(s));
    }
    if (!kids.length) kids.push(h('p', { class: 'taxi-none' }, t('taxi.unknown')));
    this.body.replaceChildren(...kids);
  }

  private row(s: TaxiStopView): HTMLElement {
    const short = this.coins < s.fare;
    const off = short || !!s.shut;
    const b = h('button', { class: `cta taxi-stop ${off ? 'muted' : ''}`, type: 'button', disabled: off, onclick: () => { this.close(); this.onRide(s.id); } },
      h('span', { class: 'taxi-name' }, s.name, s.shut ? h('small', { class: 'taxi-why' }, s.shut) : short ? h('small', { class: 'taxi-why' }, t('taxi.short')) : s.why && s.why !== this.common() ? h('small', { class: 'taxi-why' }, s.why) : null),
      h('span', { class: 'taxi-fare', html: `${iconSvg('coin', 14)} ${s.fare}` }));
    return b;
  }
}
