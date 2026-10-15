// The screens around the world: loading, the first-run hero, and the goodbye (the title is in ./splash).
// The goodbye stands over the town of the title, in the light of the hour.

import { t } from '../i18n';
import { ACCESSORIES, BEARDS, BOTTOM_STYLES, CHEEKS, CLOTH_COLORS, DEFAULT_LOOK, DEFAULT_PET, EYE_COLORS, FACES, HAIR_COLORS, HAIR_STYLES, PET_FURS, PET_NAMES, SHOE_STYLES, SKIN_TONES, TOP_STYLES, BUILDS, petLayers, type Look, type PetLook } from '../character';
import { buildOf, HERO_CROP, HERO_PX, heroLayers } from '../people/hero';
import { clear, h } from './dom';
import { Town } from './splash/town';
import { lookNow } from './splash/index';

type Dir = 'down' | 'right' | 'up' | 'left';
type Layer = { color: string; path: string };

function paint(ctx: CanvasRenderingContext2D, layers: Layer[], x: number, y: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  for (const l of layers) {
    ctx.fillStyle = l.color;
    ctx.fill(new Path2D(l.path));
  }
  ctx.restore();
}

// ---- the town behind the goodbye -----------------------------------------------------------------------------

/** The same town as on the title, in the light of this hour, filling its parent until `stop()`. */
function townBackdrop(parent: HTMLElement): { el: HTMLCanvasElement; stop: () => void } {
  const el = h('canvas', { class: 'screen-bg' });
  parent.append(el);
  const ctx = el.getContext('2d');
  let town: Town | null = null;
  let raf = 0;
  let last = 0;
  const frame = (ms: number) => {
    raf = requestAnimationFrame(frame);
    if (ms - last < 33 || !ctx) return;
    const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
    last = ms;
    const scale = Math.max(2, Math.round((parent.clientHeight || 390) / 150));
    const W = Math.ceil((parent.clientWidth || 844) / scale);
    const H = Math.ceil((parent.clientHeight || 390) / scale);
    if (!town || town.W !== W || town.H !== H) {
      town = new Town(W, H, { seed: 31, church: 0.12, hall: 0.76 });
      el.width = W;
      el.height = H;
    }
    ctx.imageSmoothingEnabled = false;
    town.draw(ctx, lookNow(), ms / 1000, dt);
  };
  raf = requestAnimationFrame(frame);
  return { el, stop: () => cancelAnimationFrame(raf) };
}

// ---- loading -----------------------------------------------------------------------------------------------

/** The loading screen. Its markup is already in index.html, so it shows before any script has run. */
export class Loading {
  private readonly el: HTMLElement | null;

  constructor() {
    this.el = document.getElementById('boot');
  }

  step(text: string, part: number): void {
    if (!this.el) return;
    const bar = this.el.querySelector('.boot-bar i') as HTMLElement | null;
    const label = this.el.querySelector('.boot-step') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%`;
    if (label) label.textContent = text;
  }

  done(): void {
    if (!this.el) return;
    this.el.classList.add('gone');
    window.setTimeout(() => this.el?.remove(), 400);
  }
}

// ---- the hero ----------------------------------------------------------------------------------------------

/** The settings that describe a look (the same keys the studio writes). */
export function lookSettings(look: Look): [string, string][] {
  return [
    ['look.hair', String(look.hairStyle)],
    ['look.hair_color', look.hair],
    ['look.skin_color', look.skin],
    ['look.eye_color', look.eye],
    ['look.face', String(look.face)],
    ['look.top', String(look.topStyle)],
    ['look.top_color', look.top],
    ['look.top2_color', look.top2],
    ['look.bottom', String(look.bottomStyle)],
    ['look.bottom_color', look.bottom],
    ['look.shoes_color', look.shoes],
    ['look.acc', String(look.acc)],
    ['look.acc_color', look.accColor],
    ['look.shoe', String(look.shoeStyle)],
    ['look.beard', String(look.beard)],
    ['look.cheeks', String(look.cheeks)],
    ['look.build', String(buildOf(look))],
  ];
}

export function randomLook(rand: () => number = Math.random): Look {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const idx = (n: number) => Math.floor(rand() * n);
  const look: Look = {
    skin: pick(SKIN_TONES),
    eye: pick(EYE_COLORS),
    hair: pick(HAIR_COLORS),
    hairStyle: idx(HAIR_STYLES),
    face: idx(FACES),
    top: pick(CLOTH_COLORS),
    top2: pick(CLOTH_COLORS),
    topStyle: idx(TOP_STYLES),
    bottom: pick(CLOTH_COLORS),
    bottomStyle: idx(BOTTOM_STYLES),
    shoes: pick(CLOTH_COLORS),
    acc: idx(ACCESSORIES),
    accColor: pick(CLOTH_COLORS),
    shoeStyle: idx(SHOE_STYLES),
    // most faces are bare; a beard now and then
    beard: rand() < 0.7 ? 0 : 1 + idx(BEARDS - 1),
    cheeks: idx(CHEEKS),
  };
  // a man's build with a beard; else either
  look.build = look.beard ? 1 : idx(BUILDS);
  return look;
}

function sprite(layers: Layer[], size: number, crop?: [number, number, number, number]): HTMLCanvasElement {
  const [cx, cy, cw, ch] = crop ?? [0, 0, HERO_PX, HERO_PX];
  const canvas = h('canvas', { width: String(cw * 2), height: String(ch * 2) });
  canvas.style.width = `${size}px`;
  canvas.style.height = `${(size * ch) / cw}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(2, 2);
    paint(ctx, layers, -cx, -cy);
  }
  return canvas;
}

type Tab = 'me' | 'hair' | 'face' | 'clothes' | 'shoes' | 'extra';
const TABS: [Tab, string][] = [['me', 'screens.tabMe'], ['hair', 'screens.tabHair'], ['face', 'screens.tabFace'], ['clothes', 'screens.tabClothes'], ['shoes', 'screens.tabShoes'], ['extra', 'screens.tabExtra']];
const ORDER: Dir[] = ['down', 'right', 'up', 'left'];

/** The first-run hero: a look made here and nowhere else; resolves with it when the player goes in. */
/** What the first meeting with the world settles: the hero's look, the name, and who walks along. */
export interface HeroChoice {
  look: Look;
  name: string;
  pet: PetLook;
}

export function heroScreen(parent: HTMLElement, start: Look = DEFAULT_LOOK): Promise<HeroChoice> {
  return new Promise((resolve) => {
    let look: Look = { ...start };
    let tab: Tab = 'me';
    let name = '';
    let pet: PetLook = { ...DEFAULT_PET };
    let dir: Dir = 'down';
    const root = h('div', { class: 'screen hero-screen', role: 'dialog', 'aria-label': t('screens.hero') });
    const stage = h('canvas', { class: 'hero-figure', width: String(HERO_PX * 2), height: String(HERO_PX * 2) });
    const tabs = h('div', { class: 'hero-tabs' });
    const body = h('div', { class: 'hero-body' });
    const turn = (k: number) => {
      dir = ORDER[(ORDER.indexOf(dir) + k + 4) % 4];
    };
    let raf = 0;
    let last = 0;
    const animate = (ms: number) => {
      raf = requestAnimationFrame(animate);
      if (ms - last < 110) return;
      last = ms;
      const ctx = stage.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, HERO_PX * 2, HERO_PX * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(HERO_PX - 12, HERO_PX * 2 - 4, 24, 3);
      const step = Math.floor(ms / 140);
      const walking = Math.floor(ms / 3000) % 2 === 1;
      ctx.save();
      ctx.scale(2, 2);
      paint(ctx, heroLayers(look, dir, walking ? 'walk' : 'idle', walking ? step % 4 : 0, !walking && step % 28 === 0), 0, 0);
      ctx.restore();
    };
    raf = requestAnimationFrame(animate);

    const set = (patch: Partial<Look>) => {
      look = { ...look, ...patch };
      render();
    };
    const thumbs = (count: number, current: number, make: (i: number) => HTMLCanvasElement, on: (i: number) => void) =>
      h('div', { class: 'group' }, ...Array.from({ length: count }, (_, i) => h('button', { class: `thumb ${current === i ? 'on' : ''}`, type: 'button', 'aria-label': String(i + 1), onclick: () => on(i) }, make(i))));
    const swatches = (colors: string[], current: string, on: (c: string) => void) =>
      h('div', { class: 'group' }, ...colors.map((c) => h('button', { class: `color ${current.toLowerCase() === c ? 'on' : ''}`, type: 'button', 'aria-label': c, style: { background: c }, onclick: () => on(c) })));
    const row = (label: string, kid: HTMLElement) => h('div', { class: 'hero-row' }, h('span', { class: 'label' }, label), kid);
    const withLook = (o: Partial<Look>): Look => ({ ...look, ...o });

    const render = () => {
      clear(tabs);
      tabs.append(...TABS.map(([id, label]) => h('button', { class: `tab ${tab === id ? 'on' : ''}`, type: 'button', onclick: () => { tab = id; render(); } }, t(label))));
      clear(body);
      const look0 = (o: Partial<Look>) => heroLayers(withLook(o), 'down', 'idle', 0);
      if (tab === 'me') {
        const input = h('input', { class: 'me-name', type: 'text', maxlength: '24', placeholder: t('screens.namePrompt'), value: name, 'aria-label': t('screens.name') }) as HTMLInputElement;
        input.addEventListener('input', () => {
          name = input.value;
        });
        const petImg = (k: number) => {
          const c = h('canvas', { width: 40, height: 40 }) as HTMLCanvasElement;
          const g = c.getContext('2d');
          if (g && k !== 3) {
            g.imageSmoothingEnabled = false;
            g.scale(40 / 32, 40 / 32);
            paint(g, petLayers({ ...pet, kind: k }, 'right', 'sit', 0), 0, 0);
          }
          return c;
        };
        body.append(
          row(t('screens.name'), input),
          row(t('screens.build'), thumbs(BUILDS, buildOf(look), (i) => sprite(look0({ build: i }), 40, [10, 0, 20, 40]), (i) => set({ build: i }))),
          row(t('screens.pet'), h('div', { class: 'group' }, ...PET_NAMES.map((n, k) => h('button', { class: `thumb ${pet.kind === k ? 'on' : ''}`, type: 'button', 'aria-label': n, title: n, onclick: () => { pet = { ...pet, kind: k }; render(); } }, petImg(k))))),
          row(t('screens.fur'), swatches(PET_FURS, pet.fur, (c) => { pet = { ...pet, fur: c }; render(); })),
        );
      } else if (tab === 'hair') {
        body.append(
          row(t('screens.hairstyle'), thumbs(HAIR_STYLES, look.hairStyle, (i) => sprite(look0({ hairStyle: i, acc: look.acc === 8 || look.acc === 3 || look.acc === 4 ? 0 : look.acc }), 40, [...HERO_CROP.head]), (i) => set({ hairStyle: i }))),
          row(t('screens.colour'), swatches(HAIR_COLORS, look.hair, (c) => set({ hair: c }))),
          row(t('screens.beard'), thumbs(BEARDS, look.beard, (i) => sprite(look0({ beard: i }), 40, [13, 4, 14, 14]), (i) => set({ beard: i }))),
        );
      } else if (tab === 'face') {
        body.append(
          row(t('screens.face'), thumbs(FACES, look.face, (i) => sprite(look0({ face: i }), 40, [...HERO_CROP.face]), (i) => set({ face: i }))),
          row(t('screens.cheeks'), thumbs(CHEEKS, look.cheeks, (i) => sprite(look0({ cheeks: i }), 40, [14, 4, 12, 12]), (i) => set({ cheeks: i }))),
          row(t('screens.skin'), swatches(SKIN_TONES, look.skin, (c) => set({ skin: c }))),
          row(t('screens.eyes'), swatches(EYE_COLORS, look.eye, (c) => set({ eye: c }))),
        );
      } else if (tab === 'clothes') {
        body.append(
          row(t('screens.top'), thumbs(TOP_STYLES, look.topStyle, (i) => sprite(look0({ topStyle: i }), 40, [...HERO_CROP.top]), (i) => set({ topStyle: i }))),
          row(t('screens.colour'), swatches(CLOTH_COLORS, look.top, (c) => set({ top: c }))),
          row(t('screens.accent'), swatches(CLOTH_COLORS, look.top2, (c) => set({ top2: c }))),
          row(t('screens.bottom'), thumbs(BOTTOM_STYLES, look.bottomStyle, (i) => sprite(look0({ bottomStyle: i }), 40, [...HERO_CROP.bottom]), (i) => set({ bottomStyle: i }))),
          row(t('screens.colour'), swatches(CLOTH_COLORS, look.bottom, (c) => set({ bottom: c }))),
        );
      } else if (tab === 'shoes') {
        body.append(
          row(t('screens.shoes'), thumbs(SHOE_STYLES, look.shoeStyle, (i) => sprite(look0({ shoeStyle: i, bottomStyle: look.bottomStyle === 4 ? 0 : look.bottomStyle }), 40, [...HERO_CROP.shoes]), (i) => set({ shoeStyle: i }))),
          row(t('screens.colour'), swatches(CLOTH_COLORS, look.shoes, (c) => set({ shoes: c }))),
        );
      } else {
        body.append(
          row(t('screens.accessory'), thumbs(ACCESSORIES, look.acc, (i) => sprite(look0({ acc: i }), 40, [...HERO_CROP.acc]), (i) => set({ acc: i }))),
          row(t('screens.colour'), swatches(CLOTH_COLORS, look.accColor, (c) => set({ accColor: c }))),
        );
      }
    };

    const done = h('button', { class: 'cta hero-go', type: 'button', onclick: () => {
      cancelAnimationFrame(raf);
      root.classList.add('gone');
      window.setTimeout(() => root.remove(), 300);
      resolve({ look, name: name.trim(), pet });
    } }, t('screens.toRoom'));
    root.append(
      h('div', { class: 'hero-card' },
        h('div', { class: 'hero-left' },
          h('b', { class: 'hero-title' }, t('screens.hero')),
          h('div', { class: 'hero-stage' }, stage),
          h('div', { class: 'hero-turn' },
            h('button', { class: 'chip', type: 'button', 'aria-label': t('screens.turnLeft'), onclick: () => turn(-1) }, '◀'),
            h('button', { class: 'chip', type: 'button', onclick: () => set(randomLook()) }, t('screens.random')),
            h('button', { class: 'chip', type: 'button', 'aria-label': t('screens.turnRight'), onclick: () => turn(1) }, '▶'),
          ),
          done,
        ),
        h('div', { class: 'hero-right' }, tabs, body),
      ),
    );
    render();
    parent.append(root);
  });
}

// ---- goodbye -----------------------------------------------------------------------------------------------

export interface ExitOptions {
  /** Whether the app can close itself (on the phone). */
  canClose: boolean;
  onBack: () => void;
  onClose: () => void;
}

/** The goodbye: the world is saved; back into it, or (on the phone) close the app. */
export class ExitScreen {
  private root: HTMLElement | null = null;
  private stopBg: (() => void) | null = null;

  constructor(private readonly parent: HTMLElement, private readonly opts: ExitOptions) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  open(saved: Promise<void>): void {
    if (this.root) return;
    const root = h('div', { class: 'screen exit-screen', role: 'dialog', 'aria-label': t('screens.exit') });
    const bg = townBackdrop(root);
    this.stopBg = bg.stop;
    const note = h('p', { class: 'title-sub' }, t('screens.saving'));
    const close = this.opts.canClose ? h('button', { class: 'cta', type: 'button', disabled: true, onclick: () => this.opts.onClose() }, t('screens.close')) : null;
    root.append(
      h('div', { class: 'title-block' }, h('h1', { class: 'title-name small' }, t('screens.bye')), note),
      h('div', { class: 'title-actions' }, h('button', { class: `cta ${close ? 'muted' : ''}`, type: 'button', onclick: () => this.close() }, t('screens.back')), close),
    );
    this.parent.append(root);
    this.root = root;
    saved
      .then(() => (note.textContent = t('screens.saved')))
      .catch(() => (note.textContent = t('screens.saveFailed')))
      .finally(() => close?.removeAttribute('disabled'));
  }

  close(): void {
    if (!this.root) return;
    this.stopBg?.();
    this.root.remove();
    this.root = null;
    this.opts.onBack();
  }
}
