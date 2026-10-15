// The plan of the home: the floor seen from above, split into its parts (sections.ts). A touch picks a part: its
// name, what it is, a row more or less on any side (the floor bought as it is built, the price on the button), or
// taking it away. Below, a new part to build — a lounge, a cinema, a games room… — with what it costs in all.

import { t } from '../i18n';
import { iconSvg } from '../icons';
import { cellKey, dividerKey } from '../geometry';
import type { Section, SectionKind } from '../sections';
import type { WallSide } from '../types';
import { h } from './dom';

export const INDOOR_KINDS: SectionKind[] = ['room', 'lounge', 'cinema', 'games', 'workshop', 'kitchen', 'bedroom', 'bath', 'hall', 'orangery'];
export const OUTDOOR_KINDS: SectionKind[] = ['garden', 'farm'];
/** What can be built new, and in which sizes (small, middle, big). */
export const BUILD_SIZES: Partial<Record<SectionKind, [number, number][]>> = {
  lounge: [[6, 5], [7, 6], [9, 7]],
  cinema: [[6, 7], [7, 8], [9, 9]],
  games: [[6, 5], [7, 6], [9, 7]],
  workshop: [[5, 4], [6, 5], [8, 6]],
  room: [[5, 5], [6, 6], [8, 6]],
  kitchen: [[6, 5], [7, 6], [8, 7]],
  bedroom: [[6, 5], [7, 6], [8, 7]],
  bath: [[4, 4], [5, 5], [6, 5]],
  hall: [[2, 5], [2, 7], [3, 8]],
  orangery: [[5, 5], [6, 6], [8, 6]],
  garden: [[6, 6], [8, 8], [10, 10]],
  farm: [[6, 4], [8, 6], [10, 8]],
};

const COLOR: Record<SectionKind, string> = {
  room: '#c9a27a', hall: '#a89478', kitchen: '#d8b56a', bedroom: '#c99aa6', bath: '#8fb7c9', lounge: '#d08a5a',
  cinema: '#7a6aa8', games: '#5aa0a0', workshop: '#a0845a', garden: '#6aa85a', farm: '#8a6a44', orangery: '#7ac0a8',
};

export interface Quote {
  /** Cells of floor still to buy, and all the coins it comes to (floor and things). */
  cells: number;
  coins: number;
}

export interface PlanView {
  parts: (Section & { entrance: boolean })[];
  dividers: Set<string>;
  used: number;
  budget: number;
  cellPrice: number;
  coins: number;
  homeName: string;
}

export interface PlanHandlers {
  quoteGrow(id: string, side: WallSide): Quote | null;
  canShrink(id: string, side: WallSide): boolean;
  quoteBuild(kind: SectionKind, w: number, d: number): Quote | null;
  grow(id: string, side: WallSide): void;
  shrink(id: string, side: WallSide): void;
  remove(id: string): void;
  rename(id: string, name: string): void;
  setKind(id: string, kind: SectionKind): void;
  build(kind: SectionKind, w: number, d: number): void;
  setHomeName(name: string): void;
}

const SIDES_SHOWN: [WallSide, string][] = [['north', '↑'], ['east', '→'], ['south', '↓'], ['west', '←']];

export function kindName(kind: SectionKind): string {
  return t(`plan.kind.${kind}`);
}

export class PlanSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private view: PlanView | null = null;
  private selected: string | null = null;
  private buildKind: SectionKind = 'lounge';
  private buildSize = 1;
  private confirmRemove = false;

  constructor(parent: HTMLElement, private readonly handlers: PlanHandlers) {
    this.body = h('div', { class: 'pocket-body plan-body' });
    this.root = h(
      'div',
      { class: 'settings plan-sheet', role: 'dialog', 'aria-label': t('plan.title') },
      h('div', { class: 'settings-card pocket-card' },
        h('div', { class: 'ph' }, h('b', null, t('plan.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('home.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
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

  open(view: PlanView, select?: string | null): void {
    this.selected = select ?? this.selected;
    this.confirmRemove = false;
    this.root.style.display = '';
    this.render(view);
  }

  refresh(view: PlanView): void {
    if (this.isOpen()) this.render(view);
  }

  close(): void {
    this.root.style.display = 'none';
  }

  private render(view: PlanView): void {
    this.view = view;
    if (this.selected && !view.parts.some((p) => p.id === this.selected)) this.selected = null;
    const part = view.parts.find((p) => p.id === this.selected) ?? null;
    const scroll = this.body.scrollTop;
    const side = this.body.querySelector('.plan-side-col');
    const sideScroll = side ? side.scrollTop : 0;
    this.body.replaceChildren(
      h('div', { class: 'plan-map-col' },
        this.map(view),
        h('p', { class: 'plan-area' }, t('plan.area', { used: view.used, budget: view.budget }), view.cellPrice ? ` · ${t('plan.cellPrice', { n: view.cellPrice })}` : '')),
      h('div', { class: 'plan-side-col' },
        part ? this.partBlock(part, view) : h('p', { class: 'pocket-empty' }, t('plan.pick')),
        this.buildBlock(view),
        this.homeBlock(view)),
    );
    this.body.scrollTop = scroll;
    const col = this.body.querySelector('.plan-side-col');
    if (col) col.scrollTop = sideScroll;
  }

  private homeBlock(view: PlanView): HTMLElement {
    const name = h('input', { class: 'plan-name', type: 'text', maxlength: '32', value: view.homeName, placeholder: t('plan.homeName'), 'aria-label': t('plan.homeName') }) as HTMLInputElement;
    name.addEventListener('change', () => this.handlers.setHomeName(name.value.trim()));
    return h('div', { class: 'plan-home' }, name);
  }

  private map(view: PlanView): HTMLElement {
    const all = view.parts.flatMap((p) => p.cells);
    const minX = Math.min(...all.map(([x]) => x));
    const minY = Math.min(...all.map(([, y]) => y));
    const cols = Math.max(...all.map(([x]) => x)) - minX + 1;
    const rows = Math.max(...all.map(([, y]) => y)) - minY + 1;
    const size = Math.max(5, Math.min(16, Math.floor(300 / cols), Math.floor(240 / rows)));
    const c = h('canvas', { class: 'plan-map', width: String(cols * size + 2), height: String(rows * size + 2) }) as HTMLCanvasElement;
    const g = c.getContext('2d');
    const owner = new Map<string, Section>();
    for (const p of view.parts) for (const [x, y] of p.cells) owner.set(cellKey(x, y), p);
    if (g) {
      const px = (x: number) => (x - minX) * size + 1;
      const py = (y: number) => (y - minY) * size + 1;
      for (const p of view.parts) {
        g.fillStyle = COLOR[p.kind];
        g.globalAlpha = p.id === this.selected ? 1 : 0.72;
        for (const [x, y] of p.cells) g.fillRect(px(x), py(y), size, size);
      }
      g.globalAlpha = 1;
      g.fillStyle = '#1a1424';
      for (const p of view.parts) {
        for (const [x, y] of p.cells) {
          const wall = (side: WallSide, nx: number, ny: number) => !owner.has(cellKey(nx, ny)) || view.dividers.has(dividerKey(x, y, side));
          if (wall('north', x, y - 1)) g.fillRect(px(x), py(y), size, 1);
          if (wall('south', x, y + 1)) g.fillRect(px(x), py(y) + size - 1, size, 1);
          if (wall('west', x - 1, y)) g.fillRect(px(x), py(y), 1, size);
          if (wall('east', x + 1, y)) g.fillRect(px(x) + size - 1, py(y), 1, size);
        }
      }
      const sel = view.parts.find((p) => p.id === this.selected);
      if (sel) {
        g.strokeStyle = '#f6b347';
        g.lineWidth = 2;
        g.strokeRect(px(sel.x), py(sel.y), sel.w * size, sel.d * size);
      }
      g.font = `${Math.max(9, Math.min(12, size))}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const p of view.parts) {
        const label = p.name ?? kindName(p.kind);
        const wpx = p.w * size;
        if (wpx < 24 || p.d * size < 12) continue;
        g.fillStyle = '#1a1424';
        g.fillText(label.length * 6 > wpx ? `${label.slice(0, Math.max(2, Math.floor(wpx / 7)))}…` : label, px(p.x) + wpx / 2, py(p.y) + (p.d * size) / 2, wpx - 4);
      }
    }
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) * (c.width / r.width) - 1) / size) + minX;
      const y = Math.floor(((e.clientY - r.top) * (c.height / r.height) - 1) / size) + minY;
      const hit = owner.get(cellKey(x, y));
      this.selected = hit ? hit.id : null;
      this.confirmRemove = false;
      if (this.view) this.render(this.view);
    });
    return h('div', { class: 'plan-map-wrap' }, c);
  }

  private partBlock(part: PlanView['parts'][number], view: PlanView): HTMLElement {
    const name = h('input', { class: 'plan-name', type: 'text', maxlength: '32', value: part.name ?? '', placeholder: kindName(part.kind), 'aria-label': t('plan.partName') }) as HTMLInputElement;
    name.addEventListener('change', () => this.handlers.rename(part.id, name.value.trim()));
    const kinds = (part.outdoor ? OUTDOOR_KINDS : INDOOR_KINDS).map((k) => h('button', { class: `chip ${part.kind === k ? 'on' : ''}`, type: 'button', onclick: () => this.handlers.setKind(part.id, k) }, kindName(k)));
    const sides = SIDES_SHOWN.map(([side, arrow]) => {
      const q = this.handlers.quoteGrow(part.id, side);
      const poor = !!q && q.coins > view.coins;
      return h('div', { class: 'plan-side' },
        h('span', { class: 'plan-arrow' }, arrow),
        h('button', { class: 'chip', type: 'button', disabled: !q || poor, title: q ? '' : t('plan.noRoom'), onclick: () => this.handlers.grow(part.id, side) },
          q ? (q.coins > 0 ? t('plan.growFor', { n: q.coins }) : t('plan.grow')) : t('plan.noRoom')),
        h('button', { class: 'chip', type: 'button', disabled: !this.handlers.canShrink(part.id, side), onclick: () => this.handlers.shrink(part.id, side) }, t('plan.shrink')));
    });
    const remove = part.entrance
      ? h('p', { class: 'plan-hint' }, t('plan.entrance'))
      : this.confirmRemove
        ? h('div', { class: 'plan-row' },
          h('span', { class: 'plan-hint' }, t('plan.removeSure')),
          h('button', { class: 'cta', type: 'button', onclick: () => { this.confirmRemove = false; this.handlers.remove(part.id); } }, t('plan.removeYes')),
          h('button', { class: 'cta muted', type: 'button', onclick: () => { this.confirmRemove = false; this.render(view); } }, t('plan.removeNo')))
        : h('button', { class: 'cta muted', type: 'button', onclick: () => { this.confirmRemove = true; this.render(view); } }, t('plan.remove'));
    return h('div', { class: 'plan-part' },
      h('h3', { class: 'home-sub' }, `${part.name ?? kindName(part.kind)} · ${part.w}×${part.d}`),
      name,
      h('div', { class: 'plan-row plan-kinds' }, ...kinds),
      h('div', { class: 'plan-sides' }, ...sides),
      remove);
  }

  private buildBlock(view: PlanView): HTMLElement {
    const kinds = (Object.keys(BUILD_SIZES) as SectionKind[]).map((k) => h('button', { class: `chip ${this.buildKind === k ? 'on' : ''}`, type: 'button', onclick: () => { this.buildKind = k; this.render(view); } }, kindName(k)));
    const sizes = BUILD_SIZES[this.buildKind] ?? [[6, 6]];
    const sizeChips = sizes.map(([w, d], i) => h('button', { class: `chip ${this.buildSize === i ? 'on' : ''}`, type: 'button', onclick: () => { this.buildSize = i; this.render(view); } }, `${t(`plan.size.${i}`)} ${w}×${d}`));
    const [w, d] = sizes[Math.min(this.buildSize, sizes.length - 1)];
    const q = this.handlers.quoteBuild(this.buildKind, w, d);
    const poor = !!q && q.coins > view.coins;
    return h('div', { class: 'plan-build' },
      h('h3', { class: 'home-sub' }, t('plan.newPart')),
      h('div', { class: 'plan-row plan-kinds' }, ...kinds),
      h('div', { class: 'plan-row' }, ...sizeChips),
      h('p', { class: 'plan-hint' }, q ? (q.cells > 0 ? t('plan.buildCost', { n: q.coins, cells: q.cells }) : t('plan.buildCostNoFloor', { n: q.coins })) : t('plan.noSpot')),
      h('button', { class: 'cta', type: 'button', disabled: !q || poor, onclick: () => this.handlers.build(this.buildKind, w, d) }, poor ? t('plan.tooDear') : t('plan.build')));
  }
}
