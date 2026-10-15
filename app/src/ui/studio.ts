import { iconSvg } from '../icons';
import { t } from '../i18n';
import {
  ACCESSORIES, BEARDS, BOTTOM_STYLES, CHEEKS, CLOTH_COLORS, SHOE_STYLES, EYE_COLORS, FACES, HAIR_COLORS, HAIR_STYLES, PET_FURS, PET_KINDS, PET_PATTERNS, SKIN_TONES, TOP_STYLES,
  BUILDS, lookFromSettings, petFromSettings, petLayers, type Dir, type Look,
} from '../character';
import { buildOf, HERO_CROP, heroLayers } from '../people/hero';
import { layersSize } from '../layers';
import { drawItemThumbnail } from '../render';
import type { Catalog, InventoryEntry, PlacementView, RoomView } from '../types';
import { clear, h } from './dom';

export type StudioMode = 'items' | 'shape' | 'paint' | 'world' | 'look';
export type ShapeTool = 'add' | 'remove' | 'divider';
export type PaintTarget = 'floor' | 'wall';

export interface StudioHandlers {
  onDone(): void;
  onMode(mode: StudioMode): void;
  onUndo(): void;
  onRedo(): void;
  onRotate(): void;
  onStore(): void;
  onDuplicate(): void;
  onPick(item: string): void;
  onShop(): void;
  onRecolor(pid: number, slot: string, color: string): void;
  onProp(pid: number, key: string, value: string): void;
  onShapeTool(tool: ShapeTool): void;
  /** Opens the plan of the home: its parts, bigger or smaller, new ones. */
  onPlan(): void;
  onPaintTarget(target: PaintTarget): void;
  onPaintStyle(style: string | null): void;
  onFill(): void;
  onSetting(key: string, value: string): void;
  onStyle(kind: string, id: string): void;
  onTheme(id: string): void;
  onLook(key: string, value: string): void;
  onLookRandom(): void;
  onWorkshop(): void;
  onEditCustom(item: string): void;
}

export interface StudioState {
  mode: StudioMode;
  held: { item: string; rot: number } | null;
  selected: PlacementView | null;
  inventory: InventoryEntry[];
  room: RoomView;
  shapeTool: ShapeTool;
  paintTarget: PaintTarget;
  paintStyle: string | null;
  canUndo: boolean;
  canRedo: boolean;
  ownedStyles: Set<string>;
  ownedThemes: Set<string>;
  /** Coin price of styles and themes the player does not own yet. */
  prices: Record<string, number>;
}

const MODES: { id: StudioMode; icon: string }[] = [
  { id: 'items', icon: 'sit' },
  { id: 'shape', icon: 'home' },
  { id: 'paint', icon: 'palette' },
  { id: 'world', icon: 'sun' },
  { id: 'look', icon: 'person' },
];

function chip(label: string, on: boolean, onclick: () => void, dot?: string): HTMLButtonElement {
  return h('button', { class: `chip ${on ? 'on' : ''}`, type: 'button', onclick }, dot ? h('i', { class: 'dot', style: { background: dot } }) : null, label);
}

function round(icon: string, label: string, onclick: () => void, opts: { disabled?: boolean; active?: boolean; cls?: string } = {}): HTMLButtonElement {
  return h('button', { class: `round ${opts.cls ?? ''} ${opts.active ? 'active' : ''}`, type: 'button', 'aria-label': label, title: label, disabled: opts.disabled, html: iconSvg(icon, 22), onclick });
}

function colorInput(value: string, onchange: (v: string) => void): HTMLInputElement {
  const input = h('input', { type: 'color', class: 'hex', value, 'aria-label': t('ui.hex') });
  input.addEventListener('change', () => onchange(input.value));
  return input;
}

/** The room editor: mode tabs, a context strip and, for a selected item, a properties panel. */
/** The hero's look keys that are no longer set freely once the hero is made (the core's rule). */
const FIXED_LOOK = /^look\.(top|top_color|top2_color|bottom|bottom_color|shoe|shoes_color|acc|acc_color|hair|hair_color|beard|skin_color|eye_color|face|cheeks|build)$/;

export class Studio {
  readonly root: HTMLElement;
  private readonly modes: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tools: HTMLElement;
  private readonly panel: HTMLElement;
  private slot: string | null = null;
  private last: StudioState | null = null;
  private panelOpen = true;

  constructor(parent: HTMLElement, private catalog: Catalog, private readonly handlers: StudioHandlers) {
    this.modes = h('div', { class: 'modes' });
    this.body = h('div', { class: 'strip', role: 'group' });
    this.tools = h('div', { class: 'tools' });
    this.panel = h('div', { class: 'palette props' });
    this.panel.style.display = 'none';
    this.root = h('div', { class: 'edit-bar' }, this.modes, this.body, this.tools);
    this.root.style.display = 'none';
    parent.append(this.root, this.panel);
  }

  setCatalog(catalog: Catalog): void {
    this.catalog = catalog;
  }

  /** Height of the bar in CSS pixels, so the scene can keep clear of it. */
  height(): number {
    return this.root.style.display === 'none' ? 0 : this.root.offsetHeight;
  }

  show(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
    if (!on) this.panel.style.display = 'none';
  }

  update(state: StudioState): void {
    this.last = state;
    this.renderModes(state);
    this.renderBody(state);
    this.renderTools(state);
    this.renderPanel(state);
  }

  private redraw(): void {
    if (this.last) this.update(this.last);
  }

  private renderModes(s: StudioState): void {
    clear(this.modes);
    for (const m of MODES) {
      this.modes.append(round(m.icon, t(`ui.mode.${m.id}`), () => this.handlers.onMode(m.id), { active: s.mode === m.id, cls: 'mode' }));
    }
  }

  // ---- the strip -------------------------------------------------------------------------------------

  private renderBody(s: StudioState): void {
    clear(this.body);
    if (s.mode === 'items') this.itemsStrip(s);
    else if (s.mode === 'shape') this.shapeStrip(s);
    else if (s.mode === 'paint') this.paintStrip(s);
    else if (s.mode === 'world') this.worldStrip(s);
    else this.lookStrip(s);
  }

  private itemsStrip(s: StudioState): void {
    const free = s.inventory.filter((i) => i.known && i.free > 0);
    for (const entry of free) {
      const def = this.catalog.items[entry.item];
      const canvas = h('canvas', { width: 184, height: 152 });
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        drawItemThumbnail(ctx, def, 92, 76);
      }
      const held = s.held?.item === entry.item;
      this.body.append(h('button', { class: `item ${held ? 'held' : ''}`, type: 'button', 'aria-label': t(def.name), onclick: () => this.handlers.onPick(entry.item) }, canvas, h('span', { class: 'count' }, `×${entry.free}`)));
    }
    if (free.length === 0) {
      this.body.append(h('span', { class: 'hint' }, t('ui.empty')), round('bag', t('ui.shop'), () => this.handlers.onShop()));
    }
  }

  private shapeStrip(s: StudioState): void {
    const tools: [ShapeTool, string][] = [['add', t('ui.add_floor')], ['remove', t('ui.remove_floor')], ['divider', t('ui.divider')]];
    for (const [id, label] of tools) this.body.append(chip(label, s.shapeTool === id, () => this.handlers.onShapeTool(id)));
    this.body.prepend(chip(t('plan.open'), false, () => this.handlers.onPlan()));
    this.body.append(h('span', { class: 'hint' }, `${t('ui.area')}: ${s.room.area_used}/${s.room.area_budget}${s.room.cell_price ? ` · ${t('plan.cellPrice', { n: s.room.cell_price })}` : ''}`));
  }

  private styleChips(s: StudioState, kind: string, active: string | null, onPick: (id: string) => void): HTMLElement[] {
    return Object.values(this.catalog.styles)
      .filter((st) => st.kind === kind)
      .map((st) => {
        const color = st.params.color ?? '#555566';
        const owned = s.ownedStyles.has(st.id);
        return chip(`${owned ? '' : '🔒 '}${t(st.name)}${!owned && s.prices[st.id] ? ` · ${s.prices[st.id]}` : ''}`, active === st.id, () => onPick(st.id), color);
      });
  }

  private paintStrip(s: StudioState): void {
    this.body.append(chip(t('ui.floor'), s.paintTarget === 'floor', () => this.handlers.onPaintTarget('floor')), chip(t('ui.walls'), s.paintTarget === 'wall', () => this.handlers.onPaintTarget('wall')));
    this.body.append(...this.styleChips(s, s.paintTarget, s.paintStyle, (id) => this.handlers.onPaintStyle(id)));
    this.body.append(chip(t('ui.fill'), false, () => this.handlers.onFill()));
  }

  private worldStrip(s: StudioState): void {
    const set = s.room.settings;
    const row = (label: string, ...kids: HTMLElement[]) => this.body.append(h('div', { class: 'group' }, h('span', { class: 'label' }, label), ...kids));
    row(
      t('ui.time'),
      chip(t('ui.time_real'), (set.time_mode ?? 'real') === 'real', () => this.handlers.onSetting('time_mode', 'real')),
      chip(t('ui.time_fixed'), set.time_mode === 'fixed', () => this.handlers.onSetting('time_mode', 'fixed')),
      this.timeSlider(set),
    );
    row(t('ui.backdrop'), ...this.styleChips(s, 'backdrop', s.room.styles.backdrop ?? null, (id) => this.handlers.onStyle('backdrop', id)));
    row(t('ui.weather'), ...this.styleChips(s, 'weather', s.room.styles.weather ?? null, (id) => this.handlers.onStyle('weather', id)));
    row(
      t('ui.ambient'),
      colorInput(set.ambient_color ?? '#ffb36a', (v) => this.handlers.onSetting('ambient_color', v)),
      this.range(Number(set.ambient_strength ?? 40), 0, 100, (v) => this.handlers.onSetting('ambient_strength', String(v))),
      chip(t('ui.none'), !set.ambient_color, () => this.handlers.onSetting('ambient_color', '')),
    );
    row(
      t('ui.wall_mode'),
      chip(t('ui.wall_full'), set.wall_mode === 'full', () => this.handlers.onSetting('wall_mode', 'full')),
      chip(t('ui.wall_cut'), set.wall_mode === undefined || set.wall_mode === 'cut', () => this.handlers.onSetting('wall_mode', 'cut')),
      chip(t('ui.wall_down'), set.wall_mode === 'down', () => this.handlers.onSetting('wall_mode', 'down')),
      chip(t('ui.shadows'), set.shadows !== '0', () => this.handlers.onSetting('shadows', set.shadows === '0' ? '1' : '0')),
    );
    row(
      t('ui.themes'),
      ...Object.values(this.catalog.themes).map((th) => chip(`${s.ownedThemes.has(th.id) ? '' : '🔒 '}${t(th.name)}${!s.ownedThemes.has(th.id) && s.prices[th.id] ? ` · ${s.prices[th.id]}` : ''}`, false, () => this.handlers.onTheme(th.id))),
    );
  }

  // ---- the look of the player and the pet --------------------------------------------------------------

  private previewDir: Dir = 'down';

  private sprite(layers: { color: string; path: string }[], size: number, crop?: [number, number, number, number]): HTMLCanvasElement {
    const canvas = h('canvas', { width: size, height: size });
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const n = layersSize(layers);
      const [cx, cy, cw, ch] = crop ?? [0, 0, n, n];
      ctx.imageSmoothingEnabled = false;
      ctx.scale(size / cw, size / ch);
      ctx.translate(-cx, -cy);
      for (const l of layers) {
        ctx.fillStyle = l.color;
        ctx.fill(new Path2D(l.path));
      }
    }
    return canvas;
  }

  private swatches(colors: string[], current: string, key: string, extra = true): HTMLElement {
    const kids: HTMLElement[] = colors.map((c) => h('button', { class: `color ${current.toLowerCase() === c ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => this.handlers.onLook(key, c) }));
    if (extra) kids.push(colorInput(current, (v) => this.handlers.onLook(key, v)));
    return h('div', { class: 'group' }, ...kids);
  }

  private thumbs(count: number, current: number, key: string, make: (i: number) => HTMLCanvasElement): HTMLElement {
    return h('div', { class: 'group' }, ...Array.from({ length: count }, (_, i) => h('button', { class: `thumb ${current === i ? 'on' : ''}`, type: 'button', 'aria-label': String(i + 1), onclick: () => this.handlers.onLook(key, String(i)) }, make(i))));
  }

  private lookStrip(s: StudioState): void {
    const look = lookFromSettings(s.room.settings);
    const pet = petFromSettings(s.room.settings);
    const withLook = (o: Partial<Look>): Look => ({ ...look, ...o });
    const preview = h('button', { class: 'preview', type: 'button', 'aria-label': t('studio.turnFigure'), onclick: () => {
      const order: Dir[] = ['down', 'right', 'up', 'left'];
      this.previewDir = order[(order.indexOf(this.previewDir) + 1) % 4];
      this.redraw();
    } }, this.sprite(heroLayers(look, this.previewDir, 'idle', 0), 120));
    this.body.append(preview);
    const col = h('div', { class: 'lookcol' });
    const row = (label: string, kid: HTMLElement) => col.append(h('div', { class: 'group' }, h('span', { class: 'label' }, label), kid));
    // once the hero is made, clothes come from the wardrobe and hair from the salon; here, only the pet
    const fixed = Object.keys(s.room.settings).some((k) => FIXED_LOOK.test(k));
    if (fixed) {
      col.append(h('p', { class: 'hint' }, t('studio.clothesHint')));
      row(t('studio.pet'), this.thumbs(PET_KINDS, pet.kind, 'look.pet', (i) => (i === 3 ? this.sprite([], 44) : this.sprite(petLayers({ ...pet, kind: i }, 'right', 'sit', 0), 44))));
      row(t('studio.fur'), this.swatches(PET_FURS, pet.fur, 'look.cat_color'));
      row(t('studio.pattern'), this.thumbs(PET_PATTERNS, pet.pattern, 'look.cat_pattern', (i) => this.sprite(petLayers({ ...pet, pattern: i }, 'right', 'sit', 0), 44)));
      this.body.append(col);
      return;
    }
    row(t('studio.build'), this.thumbs(BUILDS, buildOf(look), 'look.build', (i) => this.sprite(heroLayers(withLook({ build: i }), 'down', 'idle', 0), 44)));
    row(t('studio.hair'), this.thumbs(HAIR_STYLES, look.hairStyle, 'look.hair', (i) => this.sprite(heroLayers(withLook({ hairStyle: i }), 'down', 'idle', 0), 44, [...HERO_CROP.head])));
    row(t('studio.colour'), this.swatches(HAIR_COLORS, look.hair, 'look.hair_color'));
    row(t('studio.beard'), this.thumbs(BEARDS, look.beard, 'look.beard', (i) => this.sprite(heroLayers(withLook({ beard: i }), 'down', 'idle', 0), 44, [13, 4, 14, 14])));
    row(t('studio.skin'), this.swatches(SKIN_TONES, look.skin, 'look.skin_color', false));
    row(t('studio.eyes'), this.swatches(EYE_COLORS, look.eye, 'look.eye_color', false));
    row(t('studio.face'), this.thumbs(FACES, look.face, 'look.face', (i) => this.sprite(heroLayers(withLook({ face: i }), 'down', 'idle', 0), 44, [...HERO_CROP.face])));
    row(t('studio.cheeks'), this.thumbs(CHEEKS, look.cheeks, 'look.cheeks', (i) => this.sprite(heroLayers(withLook({ cheeks: i }), 'down', 'idle', 0), 44, [14, 4, 12, 12])));
    row(t('studio.top'), this.thumbs(TOP_STYLES, look.topStyle, 'look.top', (i) => this.sprite(heroLayers(withLook({ topStyle: i }), 'down', 'idle', 0), 44, [...HERO_CROP.top])));
    row(t('studio.colour'), this.swatches(CLOTH_COLORS, look.top, 'look.top_color'));
    row(t('studio.accent'), this.swatches(CLOTH_COLORS, look.top2, 'look.top2_color', false));
    row(t('studio.bottom'), this.thumbs(BOTTOM_STYLES, look.bottomStyle, 'look.bottom', (i) => this.sprite(heroLayers(withLook({ bottomStyle: i }), 'down', 'idle', 0), 44, [...HERO_CROP.bottom])));
    row(t('studio.colour'), this.swatches(CLOTH_COLORS, look.bottom, 'look.bottom_color'));
    row(t('studio.shoes'), this.thumbs(SHOE_STYLES, look.shoeStyle, 'look.shoe', (i) => this.sprite(heroLayers(withLook({ shoeStyle: i, bottomStyle: look.bottomStyle === 4 ? 0 : look.bottomStyle }), 'down', 'idle', 0), 44, [...HERO_CROP.shoes])));
    row(t('studio.colour'), this.swatches(CLOTH_COLORS, look.shoes, 'look.shoes_color', false));
    row(t('studio.accessory'), this.thumbs(ACCESSORIES, look.acc, 'look.acc', (i) => this.sprite(heroLayers(withLook({ acc: i }), 'down', 'idle', 0), 44, [...HERO_CROP.acc])));
    row(t('studio.colour'), this.swatches(CLOTH_COLORS, look.accColor, 'look.acc_color', false));
    row(t('studio.pet'), this.thumbs(PET_KINDS, pet.kind, 'look.pet', (i) => (i === 3 ? this.sprite([], 44) : this.sprite(petLayers({ ...pet, kind: i }, 'right', 'sit', 0), 44))));
    row(t('studio.fur'), this.swatches(PET_FURS, pet.fur, 'look.cat_color'));
    row(t('studio.pattern'), this.thumbs(PET_PATTERNS, pet.pattern, 'look.cat_pattern', (i) => this.sprite(petLayers({ ...pet, pattern: i }, 'right', 'sit', 0), 44)));
    col.append(h('div', { class: 'group' }, chip(t('studio.randomLook'), false, () => this.handlers.onLookRandom())));
    this.body.append(col);
  }

  private timeSlider(set: Record<string, string>): HTMLElement {
    const m = /^(\d{1,2}):(\d{2})$/.exec(set.time_fixed ?? '');
    const minutes = m ? Number(m[1]) * 60 + Number(m[2]) : 12 * 60;
    const label = h('span', { class: 'label' }, set.time_fixed ?? '12:00');
    const input = h('input', { type: 'range', min: '0', max: '1435', step: '5', value: String(minutes), 'aria-label': t('ui.time') });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      label.textContent = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      this.handlers.onSetting('time_fixed', `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`);
      this.handlers.onSetting('time_mode', 'fixed');
    });
    return h('span', { class: 'slider' }, input, label);
  }

  private range(value: number, min: number, max: number, onchange: (v: number) => void): HTMLElement {
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: '5', value: String(value) });
    input.addEventListener('change', () => onchange(Number(input.value)));
    return h('span', { class: 'slider' }, input);
  }

  // ---- tools -----------------------------------------------------------------------------------------

  private renderTools(s: StudioState): void {
    clear(this.tools);
    const items = s.mode === 'items';
    const canRotate = items && (s.held !== null || s.selected !== null);
    this.tools.append(
      round('check', t('ui.done'), () => this.handlers.onDone(), { cls: 'done' }),
      round('undo', t('ui.undo'), () => this.handlers.onUndo(), { disabled: !s.canUndo }),
      round('redo', t('ui.redo'), () => this.handlers.onRedo(), { disabled: !s.canRedo }),
    );
    if (items) {
      this.tools.append(
        round('rotate', t('studio.rotate'), () => this.handlers.onRotate(), { disabled: !canRotate }),
        round('copy', t('ui.duplicate'), () => this.handlers.onDuplicate(), { disabled: s.selected === null }),
        round('store', t('studio.store'), () => this.handlers.onStore(), { disabled: s.selected === null }),
        round('bag', t('ui.shop'), () => this.handlers.onShop()),
        round('hammer', t('studio.workshop'), () => this.handlers.onWorkshop()),
      );
    }
  }

  // ---- properties panel ------------------------------------------------------------------------------

  private renderPanel(s: StudioState): void {
    const sel = s.selected;
    const def = sel ? this.catalog.items[sel.item] : undefined;
    if (s.mode !== 'items' || !sel || !def) {
      this.panel.style.display = 'none';
      return;
    }
    clear(this.panel);
    const head = h('div', { class: 'ph' }, h('b', null, t(def.name)), round(this.panelOpen ? 'close' : 'edit', t('studio.properties'), () => { this.panelOpen = !this.panelOpen; this.redraw(); }));
    this.panel.append(head);
    this.panel.style.display = '';
    if (!this.panelOpen) return;

    const slots = Object.keys(def.slots);
    const props = sel.props ?? {};
    const set = (key: string, value: string) => this.handlers.onProp(sel.pid, key, value);

    if (slots.length > 0) {
      if (!this.slot || !def.slots[this.slot]) this.slot = slots[0];
      const slot = this.slot;
      const current = sel.colors[slot] ?? def.slots[slot].default;
      this.panel.append(
        h('div', { class: 'slots' }, ...slots.map((name) => h('button', { class: `slot ${slot === name ? 'on' : ''}`, type: 'button', onclick: () => { this.slot = name; this.redraw(); } }, h('i', { class: 'dot', style: { background: sel.colors[name] ?? def.slots[name].default } }), t(`slot.${name}`)))),
        h('div', { class: 'colors' }, ...(this.catalog.palettes[def.slots[slot].palette] ?? []).map((c) => h('button', { class: `color ${current === c ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => this.handlers.onRecolor(sel.pid, slot, c) })), colorInput(current, (v) => this.handlers.onRecolor(sel.pid, slot, v))),
        h('div', { class: 'group' }, h('span', { class: 'label' }, t('ui.finish')), ...Object.values(this.catalog.materials).map((m) => chip(t(m.name), (props[`finish.${slot}`] ?? 'matte') === m.id, () => set(`finish.${slot}`, m.id === 'matte' ? '' : m.id)))),
      );
    }

    if (def.category === 'custom') this.panel.append(h('div', { class: 'group' }, chip(t('studio.editInWorkshop'), false, () => this.handlers.onEditCustom(def.id))));

    const nudge = (axis: 'nudge_x' | 'nudge_y', label: string) => {
      const v = Number(props[axis] ?? 0);
      const step = (d: number) => set(axis, String(Math.max(-50, Math.min(50, v + d))));
      return h('span', { class: 'stepper' }, h('button', { type: 'button', onclick: () => step(-5) }, '−'), h('span', null, `${label} ${v}`), h('button', { type: 'button', onclick: () => step(5) }, '+'));
    };
    this.panel.append(h('div', { class: 'group' }, h('span', { class: 'label' }, t('ui.nudge')), nudge('nudge_x', 'X'), nudge('nudge_y', 'Y'), chip(t('ui.mirror'), props.mirror === '1', () => set('mirror', props.mirror === '1' ? '' : '1'))));

    if (def.tags.includes('light')) {
      const lit = props.lit;
      this.panel.append(
        h('div', { class: 'group' }, h('span', { class: 'label' }, t('ui.light')),
          chip(t('ui.light_auto'), lit === undefined || lit === '', () => set('lit', '')),
          chip(t('ui.light_on'), lit === '1', () => set('lit', '1')),
          chip(t('ui.light_off'), lit === '0', () => set('lit', '0'))),
        h('div', { class: 'group' }, colorInput(props.light_color ?? '#ffd27a', (v) => set('light_color', v)), this.range(Number(props.light_strength ?? 70), 0, 100, (v) => set('light_strength', String(v)))),
      );
    }
  }
}
