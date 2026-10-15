// «Про мене»: one's own name in the town (as neighbours and the paper call one) and who walks along —
// the first pet (a cat, a dog, a rabbit, or none) or any of the animals one has taken in since.

import { iconSvg } from '../icons';
import { petLayers, petLookOf, PET_NAMES, type PetLook } from '../character';
import type { PetView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface MeDeps {
  name(): string;
  /** Renames the hero; returns the words to show (an error in the world's words) or null when done. */
  rename(name: string): string | null;
  /** The first pet chosen at the start (its look), and the animals taken in since. */
  pets(): { first: PetLook; owned: PetView[]; companion: string | null };
  /** Walks with the first pet of this kind (3: nobody). */
  chooseFirst(kind: number): void;
  /** Walks with an animal taken in later. */
  chooseOwned(id: string): void;
}

export class MeSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement, private readonly deps: MeDeps) {
    this.body = h('div', { class: 'me-body' });
    this.root = h(
      'div',
      { class: 'settings me', role: 'dialog', 'aria-label': t('me.title') },
      h('div', { class: 'settings-card' },
        h('div', { class: 'ph' }, h('b', null, t('me.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
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

  private thumb(layers: { color: string; path: string }[]): HTMLCanvasElement {
    const c = h('canvas', { width: 48, height: 48, class: 'me-pet-img' }) as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (g) {
      g.imageSmoothingEnabled = false;
      g.scale(48 / 32, 48 / 32);
      for (const l of layers) {
        g.fillStyle = l.color;
        g.fill(new Path2D(l.path));
      }
    }
    return c;
  }

  private render(): void {
    const input = h('input', { class: 'me-name', type: 'text', maxlength: '24', value: this.deps.name(), 'aria-label': t('me.name') }) as HTMLInputElement;
    const said = h('p', { class: 'me-said' });
    const save = h('button', { class: 'cta', type: 'button', onclick: () => {
      const r = this.deps.rename(input.value.trim());
      said.textContent = r ?? t('me.saved');
    } }, t('me.save'));
    const { first, owned, companion } = this.deps.pets();
    const walking = (k: number) => !companion && first.kind === k;
    const tiles: HTMLElement[] = [];
    for (let k = 0; k < PET_NAMES.length; k++) {
      const look = petLookOf(k, first);
      tiles.push(h('button', { class: `me-pet ${walking(k) ? 'on' : ''}`, type: 'button', onclick: () => { this.deps.chooseFirst(k); this.render(); } },
        k === 3 ? h('span', { class: 'me-pet-none' }, '—') : this.thumb(petLayers(look, 'right', 'sit', 0)), h('span', null, PET_NAMES[k])));
    }
    for (const p of owned) {
      tiles.push(h('button', { class: `me-pet ${companion === p.id ? 'on' : ''}`, type: 'button', onclick: () => { this.deps.chooseOwned(p.id); this.render(); } },
        this.thumb(petLayers(petLookOf(p.kind, first), 'right', 'sit', 0)), h('span', null, p.name)));
    }
    this.body.replaceChildren(
      h('b', { class: 'me-h' }, t('me.whatName')),
      h('div', { class: 'me-row' }, input, save),
      said,
      h('b', { class: 'me-h' }, t('me.whoWalks')),
      h('div', { class: 'me-pets' }, ...tiles),
    );
  }
}
