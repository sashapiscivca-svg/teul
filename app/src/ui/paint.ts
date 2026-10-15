// The easel: a 16×12 canvas and sixteen colours. A finished picture gets a name and becomes a canvas to hang
// on a wall at home. Pixels are kept as hex digits (one colour each), row by row.

import { iconSvg } from '../icons';
import { h } from './dom';
import { t } from '../i18n';

export const ART_W = 16;
export const ART_H = 12;
/** The easel's sixteen colours (index = hex digit). */
export const ART_COLORS = [
  '#f4eedf', '#2a2035', '#d9534f', '#e8a23a', '#f4d35e', '#5aa469', '#3f7f4a', '#3fb8b0',
  '#4a8fd0', '#2f3a5a', '#8a63c9', '#d86aa0', '#8a5a2e', '#c9a050', '#a3a8cf', '#87c0e8',
];

/** A blank canvas: a sky over a field (something to start from). */
export function blankArt(): string {
  let s = '';
  for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) s += y < 8 ? 'f' : '6';
  return s;
}

export function artColor(pixels: string, x: number, y: number): string {
  return ART_COLORS[parseInt(pixels[y * ART_W + x] ?? '0', 16) || 0];
}

export class PaintSheet {
  readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly palette: HTMLElement;
  private readonly name: HTMLInputElement;
  private pixels: string[] = blankArt().split('');
  private color = 1;
  private down = false;
  private onSave: ((title: string, pixels: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.grid = h('div', { class: 'paint-grid' });
    this.palette = h('div', { class: 'paint-palette' });
    this.name = h('input', { class: 'ws-name paint-name', type: 'text', maxlength: '40', placeholder: t('paint.namePlaceholder') });
    this.root = h(
      'div',
      { class: 'settings paint', role: 'dialog', 'aria-label': t('paint.title') },
      h('div', { class: 'settings-card paint-card' },
        h('div', { class: 'ph' }, h('b', null, t('paint.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('div', { class: 'paint-main' }, this.grid, this.palette),
        h('div', { class: 'paint-foot' }, this.name,
          h('button', { class: 'chip', type: 'button', onclick: () => this.clear() }, t('paint.clear')),
          h('button', { class: 'cta', type: 'button', onclick: () => this.save() }, t('panels.done')))),
    );
    this.root.style.display = 'none';
    window.addEventListener('pointerup', () => (this.down = false));
    // a finger drawn across the canvas paints every cell it passes (touch has no pointerenter)
    const at = (e: PointerEvent) => {
      const r = this.grid.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * ART_W);
      const y = Math.floor(((e.clientY - r.top) / r.height) * ART_H);
      if (x < 0 || y < 0 || x >= ART_W || y >= ART_H) return;
      const i = y * ART_W + x;
      this.paint(i, this.grid.children[i] as HTMLElement);
    };
    this.grid.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.down = true;
      at(e);
    });
    this.grid.addEventListener('pointermove', (e) => {
      if (this.down) at(e);
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(onSave: (title: string, pixels: string) => void, title = t('paint.title')): void {
    (this.root.querySelector('.ph b') as HTMLElement).textContent = title;
    this.onSave = onSave;
    this.render();
    this.root.style.display = '';
  }

  close(): void {
    this.root.style.display = 'none';
    this.onSave = null;
  }

  private clear(): void {
    this.pixels = blankArt().split('');
    this.render();
  }

  private save(): void {
    const title = this.name.value.trim() || t('paint.untitled');
    const done = this.onSave;
    this.close();
    if (done) done(title, this.pixels.join(''));
    this.name.value = '';
    this.pixels = blankArt().split('');
  }

  private paint(i: number, cell: HTMLElement): void {
    this.pixels[i] = this.color.toString(16);
    cell.style.background = ART_COLORS[this.color];
  }

  private render(): void {
    this.grid.replaceChildren(...this.pixels.map((p) => h('span', { class: 'paint-cell', style: { background: ART_COLORS[parseInt(p, 16)] } })));
    this.palette.replaceChildren(
      ...ART_COLORS.map((c, i) => h('button', { class: `color ${i === this.color ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => { this.color = i; this.render(); } })),
    );
  }
}
