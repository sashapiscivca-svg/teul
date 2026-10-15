// Accessibility of the interface: how big the words are, contrast, motion, colours for the important cues, larger
// touch targets, a readable font, captions for the sounds that matter, names for every control, and keyboard
// use of the sheets and the menu. All of it is how the world is shown on this device, never the world itself.
import { t } from './i18n';
import type { Prefs } from './prefs';

/** The scale of the interface for each text size. */
export const TEXT_SCALE = [1, 1.15, 1.3] as const;

const OS_STILL = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let still = OS_STILL;
let colorblind = false;
let captionsOn = false;

/** Whether motion is held back: no screen shake, no flashes, no drifting or swaying for effect. */
export function motionReduced(): boolean {
  return still;
}

/** What the motion setting means on this device: `auto` follows the system. */
export function stillFor(motion: Prefs['motion'], os: boolean = OS_STILL): boolean {
  return motion === 'reduce' || (motion === 'auto' && os);
}

export type Cue = 'hint' | 'go' | 'alert' | 'off';

/** Colours of the cues that matter (bubbles over things to use, ways out, warnings); a palette safe for colour
 *  blindness (Okabe–Ito) when asked. */
const CUES: Record<'normal' | 'safe', Record<Cue, string>> = {
  normal: { hint: '#f6b660', go: '#55d6c2', alert: '#ef6f8a', off: '#8f94ad' },
  safe: { hint: '#f0e442', go: '#56b4e9', alert: '#d55e00', off: '#9a9a9a' },
};

export function cueColor(cue: Cue): string {
  return CUES[colorblind ? 'safe' : 'normal'][cue];
}

/** The classes on <html> for these preferences (pure, for tests). */
export function a11yClasses(p: Prefs, os: boolean = OS_STILL): Record<string, boolean> {
  return {
    'a11y-text-1': p.textSize === 1,
    'a11y-text-2': p.textSize === 2,
    'a11y-contrast': p.contrast,
    'a11y-still': stillFor(p.motion, os),
    'a11y-cb': p.colorblind,
    'a11y-big': p.bigTargets,
    'a11y-readable': p.readable,
    'a11y-captions': p.captions,
  };
}

/** Applies the preferences to the page (and to what the renderer and the sounds read). */
export function applyA11y(p: Prefs, root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null): void {
  still = stillFor(p.motion);
  colorblind = p.colorblind;
  captionsOn = p.captions;
  if (!root) return;
  for (const [cls, on] of Object.entries(a11yClasses(p))) root.classList.toggle(cls, on);
  root.style.setProperty('--ui-scale', String(TEXT_SCALE[p.textSize] ?? 1));
}

// ---- captions: a small line for the sounds that matter -----------------------------------------------------

/** Which sounds get a caption, and the key of its words. */
export const SOUND_CAPTIONS: Readonly<Record<string, string>> = {
  knock: 'a11y.cap.knock',
  door: 'a11y.cap.door',
  shop_bell: 'a11y.cap.shopBell',
  thunder: 'a11y.cap.thunder',
  firework: 'a11y.cap.firework',
  siren: 'a11y.cap.siren',
  horn: 'a11y.cap.horn',
  church: 'a11y.cap.bells',
  peal: 'a11y.cap.bells',
  bell: 'a11y.cap.bell',
  school_bell: 'a11y.cap.schoolBell',
  cart_bell: 'a11y.cap.cartBell',
  train: 'a11y.cap.train',
  whisper: 'a11y.cap.whisper',
  steps: 'a11y.cap.steps',
  breath: 'a11y.cap.breath',
  heartbeat: 'a11y.cap.heartbeat',
  hollow_meow: 'a11y.cap.meow',
  song_far: 'a11y.cap.songFar',
  bark: 'a11y.cap.bark',
  dog_far: 'a11y.cap.bark',
  cheer: 'a11y.cap.cheer',
  ice_crack: 'a11y.cap.ice',
  gong: 'a11y.cap.gong',
  ufo: 'a11y.cap.hum',
  otherworld: 'a11y.cap.hum',
};

/** Whether a sound at this loudness is worth a caption now (not too faint; not the same one again too soon). */
export function captionDue(kind: string, volume: number, now: number, last: ReadonlyMap<string, number>, gapMs = 6000): boolean {
  if (!(kind in SOUND_CAPTIONS) || volume < 0.12) return false;
  const before = last.get(SOUND_CAPTIONS[kind]);
  return before === undefined || now - before >= gapMs;
}

let captionLine: HTMLElement | null = null;
const lastCaption = new Map<string, number>();

/** A sound was heard: with captions on, its words show for a moment at the bottom of the screen. */
export function caption(kind: string, volume = 1): void {
  if (!captionsOn || !captionLine) return;
  const now = Date.now();
  if (!captionDue(kind, volume, now, lastCaption)) return;
  const key = SOUND_CAPTIONS[kind];
  lastCaption.set(key, now);
  const line = document.createElement('div');
  line.className = 'a11y-caption';
  line.dataset.sound = kind;
  line.textContent = t(key);
  captionLine.append(line);
  while (captionLine.children.length > 2) captionLine.firstElementChild?.remove();
  window.setTimeout(() => line.remove(), 3800);
}

// ---- names for controls -------------------------------------------------------------------------------------

/** The name a control would be read by: its own label, its text, else a title or a data label (pure, for tests). */
export function nameOf(c: { ariaLabel?: string | null; labelledBy?: string | null; text?: string | null; title?: string | null; dataLabel?: string | null }): string {
  return (c.ariaLabel ?? '').trim() || (c.labelledBy ? '·' : '') || (c.text ?? '').trim() || (c.title ?? '').trim() || (c.dataLabel ?? '').trim();
}

const CONTROLS = 'button, [role="button"], input:not([type="hidden"]), select, textarea, a[href], [role="menuitem"], [role="tab"], [role="switch"]';

/** Gives a missing accessible name from `title` or `data-label` (the safety net under the per-control labels). */
function nameControls(scope: ParentNode): void {
  for (const el of scope.querySelectorAll<HTMLElement>('[role="menu"] > button:not([role])')) el.setAttribute('role', 'menuitem');
  for (const el of scope.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) continue;
    if ((el.textContent ?? '').trim()) continue;
    const label = el.getAttribute('title') || el.dataset.label || el.getAttribute('placeholder') || el.closest('label')?.textContent?.trim();
    if (label) el.setAttribute('aria-label', label);
  }
}

// ---- sheets: focus in, focus back, Tab kept inside, Escape closes ------------------------------------------

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CLOSERS = '[data-close], .ph > button.round:last-child, .paper-close, .sheet-head > button.round:last-child';

function visible(el: Element): boolean {
  if (!el.isConnected) return false;
  const style = getComputedStyle(el);
  // a sheet faded out (opacity 0, as the shop when closed) is not open either
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  return (el as HTMLElement).getClientRects().length > 0;
}

function focusables(scope: Element): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => visible(el));
}

/** The sheets open now, the topmost last. */
export function openDialogs(scope: ParentNode = document): HTMLElement[] {
  const open = [...scope.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(visible);
  return open.sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0));
}

let titleIds = 0;
const openers = new WeakMap<HTMLElement, Element | null>();
let shown = new Set<HTMLElement>();

function prepare(d: HTMLElement): void {
  d.setAttribute('aria-modal', 'true');
  if (!d.hasAttribute('tabindex')) d.setAttribute('tabindex', '-1');
  if (!d.hasAttribute('aria-labelledby')) {
    const title = d.querySelector<HTMLElement>('.ph > b, .ph > h2, h2, h1');
    if (title) {
      if (!title.id) title.id = `a11y-title-${++titleIds}`;
      d.setAttribute('aria-labelledby', title.id);
    }
  }
}

function syncDialogs(): void {
  const now = new Set(openDialogs());
  for (const d of now) {
    prepare(d);
    if (shown.has(d)) continue;
    // a sheet just opened: remember who opened it, and bring the focus in (unless it is already there)
    const from = document.activeElement;
    openers.set(d, from && from !== document.body && !d.contains(from) ? from : openers.get(d) ?? null);
    if (!d.contains(document.activeElement)) {
      const first = focusables(d).find((el) => !el.matches(CLOSERS)) ?? focusables(d)[0];
      (first ?? d).focus({ preventScroll: true });
    }
  }
  for (const d of shown) {
    if (now.has(d)) continue;
    // a sheet closed: the focus goes back to what opened it (if it is still there and nothing else took it)
    const back = openers.get(d);
    const lost = !document.activeElement || document.activeElement === document.body || d.contains(document.activeElement);
    if (lost && back instanceof HTMLElement && visible(back)) back.focus({ preventScroll: true });
  }
  shown = now;
}

function inControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('button, input, select, textarea, a[href], [role="button"], [role="menuitem"]');
}

function onKey(e: KeyboardEvent): void {
  const top = openDialogs().at(-1);
  if (e.key === 'Escape' && top) {
    const close = [...top.querySelectorAll<HTMLElement>(CLOSERS)].find(visible);
    if (close) {
      e.preventDefault();
      e.stopImmediatePropagation();
      close.click();
    }
    return;
  }
  if (e.key === 'Tab' && top) {
    const list = focusables(top);
    if (list.length === 0) {
      e.preventDefault();
      top.focus();
      return;
    }
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && (i <= 0)) {
      e.preventDefault();
      list[list.length - 1].focus();
    } else if (!e.shiftKey && (i === -1 || i === list.length - 1)) {
      e.preventDefault();
      list[0].focus();
    }
    return;
  }
  // the menu: arrows move between its tiles, Escape folds it back to its button
  const menu = (e.target as HTMLElement | null)?.closest?.('[role="menu"]') as HTMLElement | null;
  if (menu) {
    const items = focusables(menu);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (step && items.length) {
      e.preventDefault();
      e.stopImmediatePropagation();
      items[(i + step + items.length) % items.length].focus();
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopImmediatePropagation();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
      return;
    }
    if (e.key === 'Escape') {
      const button = document.querySelector<HTMLElement>('[aria-expanded="true"]');
      e.preventDefault();
      e.stopImmediatePropagation();
      button?.click();
      button?.focus();
      return;
    }
  }
  // Enter and Space on a focused control press it, and nothing else (the hero does not also act)
  if ((e.key === 'Enter' || e.key === ' ') && inControl(e.target)) e.stopImmediatePropagation();
  // arrows in a slider or a text field move in it, not the hero
  if (e.key.startsWith('Arrow') && e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) e.stopImmediatePropagation();
}

let installed = false;

/** Installs the caption line, the names safety net and the keyboard handling (once). */
export function installA11y(root: HTMLElement): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  captionLine = document.createElement('div');
  captionLine.className = 'a11y-caption-line';
  captionLine.setAttribute('role', 'status');
  captionLine.setAttribute('aria-live', 'polite');
  root.append(captionLine);
  window.addEventListener('keydown', onKey, true);
  // tests read what the renderer reads (never in a release build)
  if (import.meta.env.MODE !== 'production') (window as unknown as { __teulA11y: unknown }).__teulA11y = { motionReduced, cueColor, caption };
  // a menu opened from the keyboard puts the focus on its first tile
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.('[aria-expanded]') as HTMLElement | null;
    if (!b || (e as MouseEvent).detail !== 0) return;
    requestAnimationFrame(() => {
      if (b.getAttribute('aria-expanded') !== 'true') return;
      const menu = b.parentElement?.querySelector<HTMLElement>('[role="menu"]');
      if (menu) focusables(menu)[0]?.focus();
    });
  });
  let queued = false;
  const pass = () => {
    queued = false;
    nameControls(root);
    syncDialogs();
  };
  // the name tags, bubbles and floating numbers move every frame: they hold no sheets and no unnamed controls
  const busy = '.npc-tags, .pop, .toasts, .a11y-caption-line, .feel-layer';
  new MutationObserver((records) => {
    if (queued || records.every((r) => r.target instanceof Element && r.target.closest(busy))) return;
    queued = true;
    requestAnimationFrame(pass);
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  pass();
}
