// The animals (pets.rs): who can come home from here (the shelter, the fox's den, the counter, the egg), and one's
// own — how each is, said in words, and what can be done for it: food, play, a stroke, the charger, a screwdriver;
// who goes out walking. Nothing is counted.

import { t } from '../i18n';
import { petLayers, type PetLook } from '../character';
import { iconSvg } from '../icons';
import type { PetOffer, PetsView, PetView } from '../types';
import { h } from './dom';

export interface PetsDeps {
  look(kind: number): PetLook;
  adopt(offer: PetOffer): void;
  care(pet: string, what: string): void;
  companion(pet: string | null): void;
  /** The first day's cat, dog or rabbit (empty: none). */
  firstName(): string;
}

const STEP_LABEL: Record<string, string> = {
  adopt: 'pets.adopt',
  feed_fox: 'pets.feedFox',
  nest_egg: 'pets.nestEgg',
  hatch: 'pets.hatch',
};

const STEP_WHY: Record<string, string> = {
  owned: 'pets.owned',
  wait: 'pets.wait',
  later: 'pets.later',
};

/** A little picture of the animal. */
function portrait(look: PetLook, pose: 'sit' | 'sleep' = 'sit'): HTMLCanvasElement {
  const c = h('canvas', { width: '64', height: '64', class: 'pet-portrait' });
  const g = c.getContext('2d');
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  g.scale(2, 2);
  for (const l of petLayers(look, 'right', pose, 0)) {
    g.fillStyle = l.color;
    g.fill(new Path2D(l.path));
  }
  return c;
}

export class PetsSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly head: HTMLElement;

  constructor(parent: HTMLElement, private readonly deps: PetsDeps) {
    this.head = h('b', null, t('pets.title'));
    this.body = h('div', { class: 'pocket-body pets-body' });
    this.root = h(
      'div',
      { class: 'settings pets', role: 'dialog', 'aria-label': t('pets.title') },
      h('div', { class: 'settings-card pocket-card' },
        h('div', { class: 'ph' }, this.head, h('button', { class: 'round small', type: 'button', 'aria-label': t('pets.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
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

  /** `only`: just this animal of one's own (tapped at home). */
  open(v: PetsView, title = t('pets.title'), only: string | null = null): void {
    this.head.textContent = title;
    this.render(v, only);
    this.root.style.display = '';
  }

  refresh(v: PetsView, only: string | null = null): void {
    if (this.isOpen()) this.render(v, only);
  }

  private own(p: PetView, v: PetsView): HTMLElement {
    const buttons: HTMLElement[] = [];
    const add = (label: string, what: string) => buttons.push(h('button', { class: 'chip', type: 'button', onclick: () => this.deps.care(p.id, what) }, label));
    add(t('pets.stroke'), 'stroke');
    add(t('pets.play'), 'play');
    if (p.eats) add(t('pets.feed'), 'feed');
    else {
      add(t('pets.charge'), 'charge');
      if (p.worn) add(t('pets.fix'), 'fix');
    }
    const walking = v.companion === p.id;
    buttons.push(h('button', { class: `chip ${walking ? 'on' : ''}`, type: 'button', onclick: () => this.deps.companion(walking ? null : p.id) }, walking ? t('pets.walking') : t('pets.takeOut')));
    return h('div', { class: 'card pet-card' },
      portrait(this.deps.look(p.kind)),
      h('div', { class: 'recipe-main' }, h('b', null, p.name), h('p', { class: 'recipe-text' }, p.words), h('div', { class: 'pocket-actions' }, ...buttons)));
  }

  private render(v: PetsView, only: string | null): void {
    const parts: HTMLElement[] = [];
    for (const o of v.here) {
      const can = o.step in STEP_LABEL;
      parts.push(h('div', { class: `card recipe ${can ? 'ok' : ''}` },
        portrait(this.deps.look(o.kind)),
        h('div', { class: 'recipe-main' },
          h('b', null, o.name),
          o.text ? h('p', { class: 'recipe-text' }, o.text) : '',
          o.id === 'fox' && v.fox ? h('p', { class: 'pocket-empty' }, v.fox[0].toUpperCase() + v.fox.slice(1) + '.') : '',
          o.id === 'dragon' && v.egg ? h('p', { class: 'pocket-empty' }, o.step === 'hatch' ? t('pets.cracking') : t('pets.eggWarm')) : ''),
        h('button', { class: `cta ${can ? '' : 'muted'}`, type: 'button', disabled: !can, onclick: () => this.deps.adopt(o) },
          can ? (o.step === 'adopt' && o.price > 0 ? `${t(STEP_LABEL[o.step])} · ${o.price}` : t(STEP_LABEL[o.step])) : t(STEP_WHY[o.step] ?? 'pets.later'))));
    }
    const mine = v.owned.filter((p) => !only || p.id === only);
    if (mine.length) {
      if (!only && v.here.length) parts.push(h('h3', { class: 'home-sub' }, t('pets.yours')));
      for (const p of mine) parts.push(this.own(p, v));
      if (!only && v.companion) {
        const first = this.deps.firstName();
        if (first) parts.push(h('button', { class: 'chip', type: 'button', onclick: () => this.deps.companion(null) }, t('pets.walkFirst', { name: first.toLowerCase() })));
      }
    }
    if (!parts.length) parts.push(h('p', { class: 'pocket-empty' }, t('pets.nobody')));
    this.body.replaceChildren(...parts);
  }
}
