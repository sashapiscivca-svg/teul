// The title screen and its splashes. teul is a gap, a crack, a rift. Each splash is a way of looking at the
// little town through one: a rift in the night sky with the other light inside it (the default); a door left
// ajar in a dark hallway; a crack running from the street down into the depths; a town broken into its four
// seasons like glass.
// They answer touch (and the tilt of the phone); nothing on them has to be learned.

import type { Look as HeroLook } from '../../character';
import { h } from '../dom';
import { Chimes } from './chimes';
import type { Look, Season } from './town';
import { t } from '../../i18n';

export type SplashName = 'rift' | 'door' | 'depth' | 'seasons';
export const SPLASHES: [SplashName, string][] = (['rift', 'depth', 'door', 'seasons'] as const).map((id) => [id, t(`splash.index.${id}`)]);

export interface Env {
  /** The canvas size in its own (big) pixels. */
  W: number;
  H: number;
  /** The light and season of the moment (the device clock). */
  look: Look;
  /** The saved hero, or null on the first run. */
  hero: HeroLook | null;
  chimes: Chimes;
  /** -1..1: the tilt of the phone or where the finger hovers, for depth. */
  par: number;
  lowPower: boolean;
}

export interface Splash {
  frame(g: CanvasRenderingContext2D, t: number, dt: number): void;
  down?(x: number, y: number, t: number): void;
  move?(x: number, y: number, t: number): void;
  up?(x: number, y: number, t: number): void;
  tap?(x: number, y: number, t: number): void;
  /** Starts the way in; returns how long it takes, in seconds. */
  enter(t: number): number;
  /** 0..1: how much the title should step aside (when the splash wants the whole screen). */
  veil?(): number;
}

export function lookNow(d = new Date()): Look {
  const hr = d.getHours() + d.getMinutes() / 60;
  const light = hr >= 7.5 && hr < 17.5 ? 'day' : (hr >= 17.5 && hr < 20.5) || (hr >= 5.5 && hr < 7.5) ? 'dusk' : 'night';
  const m = d.getMonth();
  const season: Season = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  return { light, season };
}

type Maker = (env: Env) => Splash;
async function maker(name: SplashName): Promise<Maker> {
  switch (name) {
    case 'depth':
      return (await import('./depth')).depth;
    case 'door':
      return (await import('./door')).door;
    case 'seasons':
      return (await import('./seasons')).seasons;
    default:
      return (await import('./rift')).rift;
  }
}

export interface TitleOptions {
  look: HeroLook | null;
  splash: SplashName;
  volume: number;
  lowPower: boolean;
  /** A fixed light and season instead of the clock's (screenshots). */
  at?: Look;
  onSettings: () => void;
}

/** The title over a splash; resolves when the player goes in. */
export async function titleScreen(parent: HTMLElement, opts: TitleOptions): Promise<void> {
  const make = await maker(opts.splash);
  return new Promise((resolve) => {
    const root = h('div', { class: 'screen title-screen', role: 'dialog', 'aria-label': 'teul' });
    const canvas = h('canvas', { class: 'screen-bg splash' });
    root.append(canvas);
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    const chimes = new Chimes(opts.volume);
    let env: Env;
    let splash: Splash;
    let scale = 3;
    const build = () => {
      const vw = root.clientWidth || window.innerWidth;
      const vh = root.clientHeight || window.innerHeight;
      // whole pixels: the town is ~150 of its pixels tall whatever the screen
      scale = Math.max(2, Math.round(vh / 150));
      const W = Math.ceil(vw / scale);
      const H = Math.ceil(vh / scale);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      env = { W, H, look: opts.at ?? lookNow(), hero: opts.look, chimes, par: 0, lowPower: opts.lowPower };
      splash = make(env);
    };
    parent.append(root);
    build();

    // touch: down / move / up go to the splash; a short still touch is a tap
    let downAt: { x: number; y: number; t: number } | null = null;
    let hover = 0;
    let tilt: number | null = null;
    const at = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    };
    const now = () => performance.now() / 1000;
    canvas.addEventListener('pointerdown', (e) => {
      chimes.wake();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser no longer knows (or a synthetic one): carry on without capture
      }
      const [x, y] = at(e);
      downAt = { x, y, t: now() };
      splash.down?.(x, y, now());
      hint.classList.add('gone');
    });
    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = at(e);
      hover = (x / env.W) * 2 - 1;
      splash.move?.(x, y, now());
    });
    const end = (e: PointerEvent) => {
      const [x, y] = at(e);
      splash.up?.(x, y, now());
      if (downAt && now() - downAt.t < 0.35 && Math.hypot(x - downAt.x, y - downAt.y) < 5) splash.tap?.(x, y, now());
      downAt = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      // the phone lies sideways: its forward/back tilt is the picture's left/right
      const landscape = window.innerWidth > window.innerHeight;
      const v = landscape ? (e.beta ?? 0) * (screen.orientation?.angle === 270 ? -1 : 1) : e.gamma ?? 0;
      tilt = Math.max(-1, Math.min(1, v / 25));
    };
    window.addEventListener('deviceorientation', onTilt);
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    let raf = 0;
    let last = now();
    let leaving = -1;
    let leaveFor = 1;
    const fade = h('div', { class: 'splash-fade' });
    const title = h('div', { class: 'title-block' },
      h('h1', { class: 'title-name' }, 'teul'),
      h('p', { class: 'title-sub' }, t('splash.index.sub')),
    );
    const hint = h('p', { class: 'splash-hint' }, t('splash.index.hint'));
    const go = h('button', { class: 'cta screen-go', type: 'button', onclick: () => {
      if (leaving >= 0) return;
      chimes.wake();
      leaving = now();
      leaveFor = Math.max(0.3, splash.enter(leaving));
    } }, opts.look ? t('splash.index.continue') : t('splash.index.start'));
    const actions = h('div', { class: 'title-actions' }, go, h('button', { class: 'cta muted', type: 'button', onclick: () => opts.onSettings() }, t('splash.index.settings')));
    root.append(title, hint, actions, fade);
    window.setTimeout(() => hint.classList.add('gone'), 7000);

    // every frame the screen shows, as smooth as it goes; a device that cannot keep up (a frame costing more than
    // half of the screen's own) draws every other one instead, never fewer
    let cost = 0;
    let half = false;
    let skip = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = now();
      const dt = Math.min(0.1, t - last);
      if (half && (skip = !skip)) return;
      last = t;
      const began = performance.now();
      const target = tilt ?? hover * 0.6;
      env.par += (target - env.par) * Math.min(1, dt * 3);
      g.imageSmoothingEnabled = false;
      splash.frame(g, t, dt);
      cost += (performance.now() - began - cost) * 0.1;
      // (with some room either way, so it does not flip back and forth)
      if (!half && cost > 11) half = true;
      else if (half && cost < 5) half = false;
      const veil = splash.veil?.() ?? 0;
      title.style.opacity = String(1 - veil);
      if (leaving >= 0) {
        const k = (t - leaving) / leaveFor;
        actions.style.opacity = String(Math.max(0, 1 - k * 3));
        title.style.opacity = String(Math.max(0, 1 - veil - k * 2));
        fade.style.opacity = String(Math.max(0, Math.min(1, (k - 0.7) / 0.3)));
        if (k >= 1) {
          cancelAnimationFrame(raf);
          window.removeEventListener('deviceorientation', onTilt);
          window.removeEventListener('resize', onResize);
          chimes.close();
          root.classList.add('gone');
          window.setTimeout(() => root.remove(), 300);
          resolve();
        }
      }
    };
    raf = requestAnimationFrame(frame);
    go.focus();
  });
}
