// The workshop: build your own item from small coloured blocks and drop it into the room.

import { rotXY, unrotXY, type View } from '../geometry';
import { iconSvg } from '../icons';
import { t } from '../i18n';
import { rotateWorldBox } from '../models';
import { proj, TH, TW, unproj, ZPX } from '../pixel/iso';
import { rasterize, toSprite, type RPrim } from '../pixel/raycast';
import { CLOTH_COLORS } from '../character';
import { clear, h } from '../ui/dom';
import { MAX_BLOCKS, MAX_SPAN, SLOT_NAMES, UNIT, blocksOf, cellKey, cellsOf, inBounds, parseCell, problemsOf, toBoxes, type Cells, type UserItem } from './voxels';

type Tool = 'add' | 'erase' | 'paint';

export interface WorkshopHandlers {
  onSave(item: UserItem): void;
  onClose(): void;
}


const ACTIONS: (string | null)[] = [null, 'sit', 'rest', 'read'];
const BLOCK = UNIT / 100; // tiles

const WOOD = ['#8a5a2e', '#a8743c', '#6a4528', '#c9a050', '#e8e0c8', '#3a2a40'];
const START_COLORS = ['#8a5a2e', '#3f8c94', '#e8a23a', '#e8e0c8'];

function emptyItem(): UserItem {
  return { id: '', name: '', layer: 'floor', colors: [...START_COLORS], blocks: [], surface: false, light: false, action: null };
}

export class Workshop {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly side: HTMLElement;
  private item: UserItem = emptyItem();
  private cells: Cells = new Map();
  private undoStack: Cells[] = [];
  private redoStack: Cells[] = [];
  private tool: Tool = 'add';
  private slot = 0;
  private view: View = 1;
  private stroke: Set<string> | null = null;
  private dpr = 1;
  private message = '';
  private raf = 0;
  private dirty = true;

  constructor(parent: HTMLElement, private readonly handlers: WorkshopHandlers, private readonly existing: () => UserItem[]) {
    this.canvas = h('canvas', { class: 'ws-canvas' });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context is unavailable');
    this.ctx = ctx;
    this.side = h('div', { class: 'ws-side' });
    this.root = h('div', { class: 'workshop' }, this.canvas, this.side);
    this.root.style.display = 'none';
    parent.append(this.root);
    this.bind();
    window.addEventListener('resize', () => this.root.style.display !== 'none' && this.resize());
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(item?: UserItem): void {
    this.item = item ? { ...item, colors: [...item.colors], blocks: item.blocks.map((b) => [...b] as UserItem['blocks'][number]) } : emptyItem();
    this.cells = cellsOf(this.item);
    this.undoStack = [];
    this.redoStack = [];
    this.message = '';
    this.root.style.display = '';
    this.resize();
    this.renderSide();
    this.loop();
  }

  close(): void {
    this.root.style.display = 'none';
    cancelAnimationFrame(this.raf);
    this.handlers.onClose();
  }

  private resize(): void {
    this.dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
    this.dirty = true;
  }

  private loop = (): void => {
    if (!this.isOpen()) return;
    if (this.dirty) {
      this.draw();
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---- editing -----------------------------------------------------------------------------------------

  private snapshot(): void {
    this.undoStack.push(new Map(this.cells));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  private apply(cell: [number, number, number]): void {
    const key = cellKey(...cell);
    if (this.stroke?.has(key + this.tool)) return;
    this.stroke?.add(key + this.tool);
    if (this.tool === 'add') {
      if (!inBounds(...cell) || this.cells.has(key)) return;
      if (this.cells.size >= MAX_BLOCKS) {
        this.message = t('workshop.builder.tooMany');
        return;
      }
      this.cells.set(key, this.slot);
    } else if (this.tool === 'erase') {
      this.cells.delete(key);
    } else if (this.cells.has(key)) {
      this.cells.set(key, this.slot);
    }
    this.dirty = true;
  }

  /** The block to act on for a pointer position: the face under it (its neighbour for adding), or the floor. */
  private targetAt(x: number, y: number): [number, number, number] | null {
    const hit = this.castAt(x, y);
    if (!hit) return null;
    if ('floor' in hit) return this.tool === 'add' ? [hit.floor[0], hit.floor[1], 0] : null;
    if (this.tool !== 'add') return hit.cell;
    return [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
  }

  // The plate is centred on the origin of its own cells, then rotated by the view about its middle.
  private toView(x: number, y: number): [number, number] {
    const c = (MAX_SPAN * BLOCK) / 2;
    const [rx, ry] = rotXY(this.view, x - c, y - c);
    return [rx + c, ry + c];
  }

  private fromView(x: number, y: number): [number, number] {
    const c = (MAX_SPAN * BLOCK) / 2;
    const [ux, uy] = unrotXY(this.view, x - c, y - c);
    return [ux + c, uy + c];
  }

  private bind(): void {
    const local = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // synthetic pointers cannot be captured
      }
      this.snapshot();
      this.stroke = new Set();
      const p = local(e);
      const target = this.targetAt(p.x, p.y);
      if (target) this.apply(target);
      this.renderSide();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.stroke) return;
      const p = local(e);
      const target = this.targetAt(p.x, p.y);
      if (target) this.apply(target);
    });
    const end = () => {
      if (!this.stroke) return;
      this.stroke = null;
      if (this.undoStack.length > 0 && sameCells(this.undoStack[this.undoStack.length - 1], this.cells)) this.undoStack.pop();
      this.message = '';
      this.renderSide();
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(new Map(this.cells));
    this.cells = prev;
    this.dirty = true;
    this.renderSide();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(new Map(this.cells));
    this.cells = next;
    this.dirty = true;
    this.renderSide();
  }

  private turn(dir: 1 | -1): void {
    this.view = ((this.view + dir + 4) % 4) as View;
    this.dirty = true;
  }

  // ---- drawing -----------------------------------------------------------------------------------------

  private k = 3;
  private artW = 1;
  private artH = 1;
  private camX = 0;
  private camY = 0;
  private plate: HTMLCanvasElement | null = null;
  private plateKey = '';

  /** Pixel art like the room: the plate and the blocks are drawn into a small canvas scaled up by a whole number. */
  private draw(): void {
    const ctx = this.ctx;
    const devW = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    const devH = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
    const span = MAX_SPAN * BLOCK;
    const top = Math.max(6, ...[...this.cells.keys()].map((key) => parseCell(key)[2] + 1)) * UNIT * ZPX;
    const plateW = span * TW + 16;
    const plateH = span * TH + top + 24;
    this.k = Math.max(1, Math.floor(Math.min(devW / plateW, devH / plateH)));
    this.artW = Math.ceil(devW / this.k);
    this.artH = Math.ceil(devH / this.k);
    if (this.canvas.width !== this.artW || this.canvas.height !== this.artH) {
      this.canvas.width = this.artW;
      this.canvas.height = this.artH;
    }
    this.canvas.style.imageRendering = 'pixelated';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#14162c';
    ctx.fillRect(0, 0, this.artW, this.artH);
    ctx.fillStyle = '#1b1d3a';
    for (let y = 0; y < this.artH; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < this.artW; x += 4) ctx.fillRect(x, y, 1, 1);
    this.camX = Math.round(this.artW / 2);
    this.camY = Math.round((this.artH - span * TH) / 2 + top / 2);

    // the plate: 3×3 tiles of 4×4 blocks each
    const key = `${this.view}`;
    if (key !== this.plateKey || !this.plate) {
      const w = span * TW;
      const h = span * TH;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const p = unproj(px - w / 2 + 0.5, py + 0.5);
          const [gx, gy] = this.fromView(p.x, p.y);
          if (gx < 0 || gy < 0 || gx >= span || gy >= span) continue;
          const i = Math.floor(gx / BLOCK);
          const j = Math.floor(gy / BLOCK);
          const tile = (Math.floor(i / 4) + Math.floor(j / 4)) % 2 === 0;
          const edge = (gx / BLOCK) % 1 < 0.12 || (gy / BLOCK) % 1 < 0.12;
          g.fillStyle = edge ? (tile ? '#2c3260' : '#262b54') : tile ? '#3a4270' : '#323a64';
          g.fillRect(px, py, 1, 1);
        }
      }
      this.plate = c;
      this.plateKey = key;
    }
    ctx.drawImage(this.plate, this.camX - span * (TW / 2), this.camY);

    // the blocks, merged into boxes and ray cast like furniture
    if (this.cells.size > 0) {
      let mi = Infinity;
      let mj = Infinity;
      let mk = Infinity;
      for (const key2 of this.cells.keys()) {
        const [i, j, k] = parseCell(key2);
        mi = Math.min(mi, i);
        mj = Math.min(mj, j);
        mk = Math.min(mk, k);
      }
      const prims: RPrim[] = toBoxes(this.cells).map((bx) => {
        const [x, y, z, w, d, h] = bx.box;
        const slot = SLOT_NAMES.indexOf(bx.slot as (typeof SLOT_NAMES)[number]);
        const r = rotateAround({ gx: x / 100 + mi * BLOCK, gy: y / 100 + mj * BLOCK, gw: w / 100, gd: d / 100, z: z + mk * UNIT, h, slot: bx.slot }, this.view);
        return { gx: r.gx, gy: r.gy, gw: r.gw, gd: r.gd, z: r.z, h: r.h, color: this.item.colors[slot] ?? '#9aa0b0' };
      });
      const sprite = toSprite(rasterize(prims));
      const o = proj(0, 0);
      ctx.drawImage(sprite.canvas, Math.round(this.camX + o.x - span * 0 + sprite.x), Math.round(this.camY + o.y + sprite.y));
    }
  }

  /** The block under a CSS point and the face the ray met, found by casting the same view ray as the picture. */
  private castAt(cssX: number, cssY: number): { cell: [number, number, number]; normal: [number, number, number] } | { floor: [number, number] } | null {
    const ax = (cssX * this.dpr) / this.k - this.camX + 0.5;
    const ay = (cssY * this.dpr) / this.k - this.camY + 0.5;
    const p = unproj(ax, ay);
    const K = TH / ZPX;
    let best = -Infinity;
    let hit: { cell: [number, number, number]; normal: [number, number, number] } | null = null;
    for (const key of this.cells.keys()) {
      const [i, j, k] = parseCell(key);
      const r = rotateAround({ gx: i * BLOCK, gy: j * BLOCK, gw: BLOCK, gd: BLOCK, z: k * UNIT, h: UNIT, slot: 'a' }, this.view);
      const lo = [r.gx - p.x, r.gy - p.y, r.z / K];
      const hi = [r.gx + r.gw - p.x, r.gy + r.gd - p.y, (r.z + r.h) / K];
      const enter = Math.max(...lo);
      const exit = Math.min(...hi);
      if (enter >= exit || exit <= best) continue;
      best = exit;
      let n: [number, number] | null = null;
      let nz = 0;
      if (exit === hi[2]) nz = 1;
      else if (exit === hi[1]) n = this.fromViewDir(0, 1);
      else n = this.fromViewDir(1, 0);
      hit = { cell: [i, j, k], normal: n ? [n[0], n[1], 0] : [0, 0, nz] };
    }
    if (hit) return hit;
    const [gx, gy] = this.fromView(p.x, p.y);
    const i = Math.floor(gx / BLOCK);
    const j = Math.floor(gy / BLOCK);
    return inBounds(i, j, 0) ? { floor: [i, j] } : null;
  }

  private fromViewDir(x: number, y: number): [number, number] {
    const [ux, uy] = unrotXY(this.view, x, y);
    return [Math.round(ux), Math.round(uy)];
  }

  // ---- side panel --------------------------------------------------------------------------------------

  private renderSide(): void {
    clear(this.side);
    const problems = problemsOf({ ...this.item, blocks: blocksOf(this.cells) });
    const chip = (label: string, on: boolean, click: () => void) => h('button', { class: `chip ${on ? 'on' : ''}`, type: 'button', onclick: click }, label);
    const round = (icon: string, label: string, click: () => void, disabled = false) => h('button', { class: 'round small', type: 'button', 'aria-label': label, title: label, disabled, html: iconSvg(icon, 20), onclick: click });

    const name = h('input', { class: 'ws-name', type: 'text', maxlength: '28', placeholder: t('workshop.builder.namePlaceholder'), value: this.item.name, 'aria-label': t('workshop.builder.name') });
    name.addEventListener('input', () => (this.item.name = name.value.replace(/[.]/g, '')));

    const colorRow = h('div', { class: 'group' });
    SLOT_NAMES.forEach((_, i) => {
      colorRow.append(
        h('button', { class: `slot ${this.slot === i ? 'on' : ''}`, type: 'button', 'aria-label': t('workshop.builder.colour', { n: i + 1 }), onclick: () => { this.slot = i; this.renderSide(); } }, h('i', { class: 'dot', style: { background: this.item.colors[i] } }), String(i + 1)),
      );
    });
    const swatches = h('div', { class: 'colors' });
    for (const c of [...CLOTH_COLORS, ...WOOD]) {
      swatches.append(h('button', { class: `color ${this.item.colors[this.slot] === c ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => { this.item.colors[this.slot] = c; this.dirty = true; this.renderSide(); } }));
    }
    const hex = h('input', { type: 'color', class: 'hex', value: this.item.colors[this.slot], 'aria-label': t('ui.hex') });
    hex.addEventListener('change', () => {
      this.item.colors[this.slot] = hex.value;
      this.dirty = true;
      this.renderSide();
    });
    swatches.append(hex);

    const mine = this.existing();
    this.side.append(
      h('div', { class: 'ph' }, h('b', null, t('workshop.builder.title')), h('span', { class: 'hint' }, this.message || (problems.includes('no_name') ? t('workshop.builder.giveName') : problems.includes('empty') ? t('workshop.builder.addBlocks') : '')), h('button', { class: 'chip on save', type: 'button', disabled: problems.length > 0, onclick: () => this.save() }, t('workshop.builder.save')), h('button', { class: 'round small', type: 'button', 'aria-label': t('ui.done'), html: iconSvg('close', 20), onclick: () => this.close() })),
      name,
      h('div', { class: 'group' }, chip(t('workshop.builder.add'), this.tool === 'add', () => { this.tool = 'add'; this.renderSide(); }), chip(t('workshop.builder.erase'), this.tool === 'erase', () => { this.tool = 'erase'; this.renderSide(); }), chip(t('workshop.builder.paint'), this.tool === 'paint', () => { this.tool = 'paint'; this.renderSide(); })),
      colorRow,
      swatches,
      h('div', { class: 'group' },
        chip(t('workshop.builder.floor'), this.item.layer === 'floor', () => { this.item.layer = 'floor'; this.renderSide(); }),
        chip(t('workshop.builder.onTable'), this.item.layer === 'surface', () => { this.item.layer = 'surface'; this.item.surface = false; this.renderSide(); }),
        this.item.layer === 'floor' ? chip(t('workshop.builder.surface'), this.item.surface, () => { this.item.surface = !this.item.surface; this.renderSide(); }) : null,
        chip(t('workshop.builder.glows'), this.item.light, () => { this.item.light = !this.item.light; this.renderSide(); })),
      h('div', { class: 'group' }, h('span', { class: 'label' }, t('workshop.builder.action')), ...ACTIONS.map((a) => chip(a ? t(`action.${a}`) : t('ui.none'), this.item.action === a, () => { this.item.action = a; this.renderSide(); }))),
      h('div', { class: 'group' },
        round('rotate', t('workshop.builder.turn'), () => this.turn(-1)), round('rotate', t('workshop.builder.turn'), () => this.turn(1)),
        round('undo', t('ui.undo'), () => this.undo(), this.undoStack.length === 0), round('redo', t('ui.redo'), () => this.redo(), this.redoStack.length === 0),
        chip(t('workshop.builder.clear'), false, () => { this.snapshot(); this.cells = new Map(); this.dirty = true; this.renderSide(); }),
        h('span', { class: 'hint' }, `${this.cells.size}/${MAX_BLOCKS}`)),
      ...(mine.length > 0 ? [h('div', { class: 'group' }, h('span', { class: 'label' }, t('workshop.builder.mine')), ...mine.map((m) => chip(m.name, m.id === this.item.id, () => this.open(m))), chip(t('workshop.builder.new'), false, () => this.open()))] : []),
    );
  }

  private save(): void {
    const item: UserItem = { ...this.item, name: this.item.name.trim(), blocks: blocksOf(this.cells) };
    if (problemsOf(item).length > 0) return;
    this.handlers.onSave(item);
    this.close();
  }
}

function sameCells(a: Cells, b: Cells): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}


/** Rotates a block about the middle of the plate (rotateWorldBox turns about the origin). */
function rotateAround(box: { gx: number; gy: number; gw: number; gd: number; z: number; h: number; slot: string }, view: View) {
  const c = (MAX_SPAN * BLOCK) / 2;
  const moved = rotateWorldBox({ ...box, gx: box.gx - c, gy: box.gy - c }, view);
  return { ...moved, gx: moved.gx + c, gy: moved.gy + c };
}
