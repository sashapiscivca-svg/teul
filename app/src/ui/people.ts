// The people of the village in the interface: a dialogue box with a portrait and typed-out lines, a picker for
// gifts, and a panel with everyone the player knows.

import { warmthOfHearts, warmthWords } from '../feel';
import { iconSvg } from '../icons';
import type { Layer } from '../sprites';
import { clear, h } from './dom';
import { t } from '../i18n';

/** Draws figure layers (32×32 paths) into a small canvas; CSS scales it up without smoothing. */
export function portrait(layers: Layer[], size = 32, crop: [number, number, number, number] = [0, 0, 32, 32]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.imageSmoothingEnabled = false;
  const s = size / crop[2];
  g.setTransform(s, 0, 0, s, -crop[0] * s, -crop[1] * s);
  for (const l of layers) {
    g.fillStyle = l.color;
    g.fill(new Path2D(l.path));
  }
  return c;
}

/** How close the player is with someone, in a few words (never a count of hearts). */
function bond(n: number): HTMLElement {
  return h('span', { class: 'bond-words' }, warmthWords(warmthOfHearts(n)));
}

export interface DialogueChoice {
  icon: string;
  label: string;
  run(): void;
  primary?: boolean;
}

export interface DialogueLine {
  name: string;
  layers: Layer[];
  hearts: number;
  /** Friendship points within the current heart, 0..1, for the little bar under the hearts. */
  progress: number;
  text: string;
  choices?: DialogueChoice[];
}

/** The box at the bottom of the screen in which someone speaks; tapping finishes the line, then closes it. */
export class DialogueBox {
  readonly root: HTMLElement;
  private readonly face: HTMLElement;
  private readonly name: HTMLElement;
  private readonly meter: HTMLElement;
  private readonly text: HTMLElement;
  private readonly choices: HTMLElement;
  private full = '';
  private shown = 0;
  private timer = 0;
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.face = h('div', { class: 'dlg-face' });
    this.name = h('b', { class: 'dlg-name' });
    this.meter = h('div', { class: 'dlg-meter' });
    this.text = h('p', { class: 'dlg-text', 'aria-live': 'polite' });
    this.choices = h('div', { class: 'dlg-choices' });
    this.root = h(
      'div',
      { class: 'dialogue', role: 'dialog', 'aria-label': t('people.talk') },
      h('div', { class: 'dlg-card' }, this.face, h('div', { class: 'dlg-main' }, h('div', { class: 'dlg-head' }, this.name, this.meter), this.text, this.choices)),
    );
    this.root.style.display = 'none';
    this.root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      if (this.shown < this.full.length) this.finish();
      else if (this.choices.childElementCount === 0) this.close();
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** The text being shown in full (for tests). */
  line(): string {
    return this.full;
  }

  show(line: DialogueLine, onClose: (() => void) | null = null): void {
    this.onClose = onClose;
    clear(this.face);
    const pic = portrait(line.layers, 32, [4, 0, 24, 24]);
    this.face.append(pic);
    this.name.textContent = line.name;
    clear(this.meter);
    this.meter.append(bond(line.hearts));
    clear(this.choices);
    for (const c of line.choices ?? []) {
      this.choices.append(
        h('button', { class: `chip ${c.primary ? 'on' : ''}`, type: 'button', onclick: (e: Event) => { e.stopPropagation(); c.run(); } },
          h('span', { class: 'ico', html: iconSvg(c.icon, 16) }), c.label),
      );
    }
    this.choices.style.visibility = 'hidden';
    this.full = line.text;
    this.shown = 0;
    this.text.textContent = '';
    this.root.style.display = '';
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.shown = Math.min(this.full.length, this.shown + 2);
      this.text.textContent = this.full.slice(0, this.shown);
      if (this.shown >= this.full.length) this.finish();
    }, 28);
  }

  private finish(): void {
    window.clearInterval(this.timer);
    this.shown = this.full.length;
    this.text.textContent = this.full;
    this.choices.style.visibility = '';
  }

  close(): void {
    if (!this.isOpen()) return;
    window.clearInterval(this.timer);
    this.root.style.display = 'none';
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }
}

export interface GiftOption {
  id: string;
  name: string;
  count: number;
  /** How they took it before: +1, 0, -1, or undefined when never given. */
  taste?: number;
  thumb: HTMLCanvasElement;
}

/** A sheet of the player's free items to give someone. */
export class GiftPicker {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly grid: HTMLElement;

  constructor(parent: HTMLElement) {
    this.title = h('b', null);
    this.grid = h('div', { class: 'gift-grid' });
    this.root = h(
      'div',
      { class: 'settings gift', role: 'dialog', 'aria-label': t('people.gift') },
      h('div', { class: 'settings-card' }, h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.grid),
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

  open(who: string, options: GiftOption[], onPick: (id: string) => void): void {
    this.title.textContent = t('people.giftFor', { who });
    clear(this.grid);
    if (options.length === 0) this.grid.append(h('p', { class: 'hint' }, t('people.noThings')));
    for (const o of options) {
      const mark = o.taste === undefined ? '' : o.taste > 0 ? 'liked' : o.taste < 0 ? 'disliked' : 'neutral';
      const label = o.taste === undefined ? '' : o.taste > 0 ? t('people.likes') : o.taste < 0 ? t('people.dislikes') : t('people.soSo');
      this.grid.append(
        h('button', { class: `card gift-card ${mark}`, type: 'button', title: o.name, onclick: () => { this.close(); onPick(o.id); } },
          h('div', { class: 'thumb-wrap' }, o.thumb),
          h('span', { class: 'name' }, o.name),
          o.count > 1 ? h('span', { class: 'count' }, `×${o.count}`) : null,
          mark ? h('span', { class: `taste ${mark}`, html: iconSvg(mark === 'liked' ? 'heart' : mark === 'disliked' ? 'close' : 'check', 12) + label }) : null),
      );
    }
    this.root.style.display = '';
  }

  close(): void {
    this.root.style.display = 'none';
  }
}

export interface PersonEntry {
  id: string;
  name: string;
  about: string;
  layers: Layer[];
  met: boolean;
  hearts: number;
  progress: number;
  where: string;
  liked: string[];
  disliked: string[];
  visit: string | null;
}

/** Everyone in the village: who they are, where they are now and how close the player is to them. */
export class PeoplePanel {
  readonly root: HTMLElement;
  private readonly list: HTMLElement;

  constructor(parent: HTMLElement) {
    this.list = h('div', { class: 'people-list' });
    this.root = h(
      'div',
      { class: 'settings people', role: 'dialog', 'aria-label': t('people.residents') },
      h('div', { class: 'settings-card' }, h('div', { class: 'ph' }, h('b', null, t('people.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.list),
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

  open(people: PersonEntry[]): void {
    clear(this.list);
    for (const p of people) {
      const face = h('div', { class: `person-face ${p.met ? '' : 'stranger'}` }, portrait(p.layers, 32, [4, 0, 24, 24]));
      const facts: (HTMLElement | null)[] = [
        h('div', { class: 'person-where', html: iconSvg('home', 12) + ' ' + p.where }),
        p.visit ? h('div', { class: 'person-visit', html: iconSvg('invite', 12) + ' ' + p.visit }) : null,
        p.liked.length ? h('div', { class: 'person-taste', html: iconSvg('heart', 12, '#ef6f8a') + ' ' + p.liked.join(', ') }) : null,
        p.disliked.length ? h('div', { class: 'person-taste', html: iconSvg('close', 12, '#8f94ad') + ' ' + p.disliked.join(', ') }) : null,
      ];
      this.list.append(
        h('div', { class: 'card person' }, face,
          h('div', { class: 'person-main' },
            h('div', { class: 'person-head' }, h('b', null, p.name), p.met ? bond(p.hearts) : h('span', { class: 'hint' }, t('people.notMet'))),
            p.met ? h('p', { class: 'person-about' }, p.about) : null,
            ...facts)),
      );
    }
    this.root.style.display = '';
  }

  close(): void {
    this.root.style.display = 'none';
  }
}
