// The workbench: what one knows how to make (and from what, with which tools), and a corner of the bench where
// things from the pocket can be laid side by side to see if something comes of them.

import { iconSvg } from '../icons';
import { drawPixelThumb } from '../pixel/items';
import type { CraftsView, ItemDef, ToolView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface CraftDeps {
  name(item: string): string;
  /** A name for a need: an item or a kind of things (#flower). */
  keyName(key: string): string;
  def(item: string): ItemDef | undefined;
  craft(recipe: string): void;
  tinker(items: [string, number][]): void;
}

function thumb(def: ItemDef | undefined, w = 64, hgt = 52): HTMLCanvasElement {
  const c = h('canvas', { width: String(w), height: String(hgt), class: 'pocket-thumb' });
  const g = c.getContext('2d');
  if (g && def) drawPixelThumb(g, def, w, hgt);
  return c;
}

export class CraftSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  /** What lies on the bench to try: item → how many. */
  private laid = new Map<string, number>();
  private view: CraftsView | null = null;
  private tools: ToolView[] = [];

  constructor(parent: HTMLElement, private readonly deps: CraftDeps) {
    this.body = h('div', { class: 'pocket-body craft-body' });
    this.root = h(
      'div',
      { class: 'settings craft', role: 'dialog', 'aria-label': t('craft.title') },
      h('div', { class: 'settings-card pocket-card' }, h('div', { class: 'ph' }, h('b', null, t('craft.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.body),
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

  open(view: CraftsView, tools: ToolView[]): void {
    this.laid.clear();
    this.root.style.display = '';
    this.refresh(view, tools);
  }

  refresh(view: CraftsView, tools: ToolView[]): void {
    this.view = view;
    this.tools = tools;
    // what left the pocket cannot stay on the bench
    const have = new Map(view.materials);
    for (const [k, n] of [...this.laid]) {
      const m = have.get(k) ?? 0;
      if (m <= 0) this.laid.delete(k);
      else if (n > m) this.laid.set(k, m);
    }
    if (this.isOpen()) this.render();
  }

  close(): void {
    this.root.style.display = 'none';
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    const d = this.deps;
    const parts: HTMLElement[] = [];
    // what one knows
    for (const c of v.known) {
      const needs = c.needs.map(([k, n], i) => h('span', { class: `chip need ${c.have[i] >= n ? 'ok' : 'short'}` }, `${d.keyName(k)} ${Math.min(c.have[i], n)}/${n}`));
      const tools = c.tools.map((t) => h('span', { class: 'chip tool' }, d.name(t)));
      parts.push(
        h('div', { class: 'card craft-item' },
          h('div', { class: 'thumb-wrap' }, thumb(d.def(c.gives[0]))),
          h('div', { class: 'craft-text' }, h('div', { class: 'name' }, c.name + (c.gives[1] > 1 ? ` ×${c.gives[1]}` : '')), h('div', { class: 'craft-from' }, c.from), h('div', { class: 'craft-needs' }, ...needs, ...tools)),
          h('button', { class: `cta ${c.ok ? '' : 'muted'}`, type: 'button', disabled: c.ok ? undefined : 'true', onclick: () => d.craft(c.id) }, t('craft.make'))),
      );
    }
    // the corner of the bench: lay things side by side
    const laid = [...this.laid];
    const chips = v.materials.map(([item, n]) => {
      const on = this.laid.get(item) ?? 0;
      return h('button', { class: `chip pick ${on > 0 ? 'on' : ''}`, type: 'button', onclick: () => {
        const next = on >= n || on >= 9 ? 0 : on + 1;
        if (next === 0) this.laid.delete(item);
        else this.laid.set(item, next);
        this.render();
      } }, thumb(d.def(item), 28, 22), `${d.name(item)}${on > 0 ? ` · ${on}` : ''}`);
    });
    parts.push(
      h('div', { class: 'craft-try' },
        h('b', null, t('craft.whatIf')),
        h('div', { class: 'craft-chips' }, ...chips),
        h('button', { class: `cta ${laid.length ? '' : 'muted'}`, type: 'button', disabled: laid.length ? undefined : 'true', onclick: () => d.tinker(laid) }, t('craft.try'))),
    );
    if (this.tools.length) parts.push(h('div', { class: 'craft-tools' }, ...this.tools.map((t) => h('span', { class: 'chip tool' }, `${d.name(t.item)}: ${t.words}`))));
    this.body.replaceChildren(...parts);
  }
}
