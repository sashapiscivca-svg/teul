import { iconSvg } from '../icons';
import { h } from './dom';

export type ToastKind = 'info' | 'good' | 'error';

/** Short messages at the top centre, and numbers that float up from a point. */
export class Toasts {
  private readonly stack: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.stack = h('div', { class: 'toasts', 'aria-live': 'polite' });
    root.append(this.stack);
  }

  /** `action`: one button in the message (an invitation's «Зайти»); the message then stays a while longer. */
  show(text: string, opts: { icon?: string; kind?: ToastKind; ms?: number; action?: { label: string; run(): void } } = {}): void {
    // something already being said is not said again (two parts of the game noticing the same thing)
    if (isRepeat([...this.stack.children].map((c) => c.textContent ?? ''), text)) return;
    const el = h('div', { class: `toast ${opts.kind ?? 'info'}` });
    if (opts.icon) el.insertAdjacentHTML('beforeend', iconSvg(opts.icon, 18));
    el.append(h('span', null, text));
    if (opts.action) {
      const act = opts.action;
      el.classList.add('with-action');
      el.append(h('button', { class: 'chip toast-act', type: 'button', onclick: () => {
        el.remove();
        act.run();
      } }, act.label));
    }
    this.stack.append(el);
    while (this.stack.children.length > 3) this.stack.firstElementChild?.remove();
    setTimeout(() => el.remove(), opts.ms ?? 2400);
  }

  /** Clears what is being said (the editor wants the room in view). */
  clear(): void {
    this.stack.replaceChildren();
  }

  /** A number or short word that floats up and fades from a screen point. */
  pop(text: string, x: number, y: number, color = '#f4b860', icon?: string): void {
    const el = h('div', { class: 'pop', style: { left: `${x}px`, top: `${y}px`, color } });
    if (icon) el.insertAdjacentHTML('beforeend', iconSvg(icon, 16));
    el.append(h('span', null, text));
    this.root.append(el);
    setTimeout(() => el.remove(), 1100);
  }
}

/** Whether these words are already on the screen. */
export function isRepeat(shown: string[], text: string): boolean {
  return shown.some((t) => t.trim() === text.trim());
}
