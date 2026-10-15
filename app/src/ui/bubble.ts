import { iconSvg } from '../icons';
import { clear, h } from './dom';

export interface BubbleAction {
  icon: string;
  label: string;
  run(): void;
  primary?: boolean;
}

/** A small floating menu that points at something in the room: the actions of an item, or the tools of a selection. */
export class Bubble {
  readonly root: HTMLElement;
  private readonly row: HTMLElement;
  private owner = '';

  constructor(parent: HTMLElement) {
    this.row = h('div', { class: 'bubble-row' });
    this.root = h('div', { class: 'bubble', role: 'menu' }, this.row, h('i', { class: 'bubble-tip' }));
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** `owner` names what the bubble belongs to, so it is rebuilt only when that changes. */
  show(owner: string, x: number, y: number, actions: BubbleAction[]): void {
    if (owner !== this.owner || !this.isOpen()) {
      this.owner = owner;
      clear(this.row);
      for (const a of actions) {
        this.row.append(
          h('button', { class: `bubble-btn ${a.primary ? 'primary' : ''}`, type: 'button', 'aria-label': a.label, title: a.label, onclick: (e: Event) => { e.stopPropagation(); a.run(); } },
            h('span', { class: 'ico', html: iconSvg(a.icon, 20) }), h('span', { class: 'lbl' }, a.label)),
        );
      }
      this.root.style.display = '';
      this.root.classList.remove('in');
      void this.root.offsetWidth;
      this.root.classList.add('in');
    }
    this.place(x, y);
  }

  place(x: number, y: number): void {
    const parent = this.root.parentElement;
    const w = this.root.offsetWidth;
    const maxX = (parent?.clientWidth ?? 800) - w / 2 - 8;
    const cx = Math.max(w / 2 + 8, Math.min(maxX, x));
    this.root.style.left = `${cx}px`;
    this.root.style.top = `${Math.max(64, y)}px`;
    (this.root.querySelector('.bubble-tip') as HTMLElement).style.left = `${w / 2 + (x - cx)}px`;
  }

  hide(): void {
    this.root.style.display = 'none';
    this.owner = '';
  }
}
