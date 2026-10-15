// A small dialog with someone in town: who speaks, what they say, a few things to answer or do.
// Used for a journalist's question (pick an answer) and for a request for help (what is needed, what it brings).

import { iconSvg } from '../icons';
import { h } from './dom';
import { t } from '../i18n';

export interface AskChoice {
  label: string;
  /** The main (amber) button. */
  primary?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface AskContent {
  who: string;
  title?: string;
  text: string;
  /** Lines under the text (needs, rewards…), each may be marked as met. */
  lines?: { text: string; ok?: boolean }[];
  choices: AskChoice[];
}

export class AskDialog {
  readonly root: HTMLElement;
  private readonly card: HTMLElement;

  constructor(parent: HTMLElement) {
    this.card = h('div', { class: 'settings-card ask-card' });
    this.root = h('div', { class: 'settings ask', role: 'dialog', 'aria-label': t('people.talk') }, this.card);
    this.root.style.display = 'none';
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  open(c: AskContent): void {
    this.card.replaceChildren(
      h('div', { class: 'ph' }, h('b', null, c.who), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
      ...(c.title ? [h('h3', { class: 'ask-title' }, c.title)] : []),
      h('p', { class: 'ask-text' }, c.text),
      ...(c.lines?.length ? [h('ul', { class: 'ask-lines' }, ...c.lines.map((l) => h('li', { class: l.ok === undefined ? '' : l.ok ? 'ok' : 'no' }, l.text)))] : []),
      h('div', { class: 'ask-choices' },
        ...c.choices.map((ch) => h('button', { class: `cta ${ch.primary ? '' : 'muted'}`, type: 'button', disabled: !!ch.disabled, onclick: () => ch.run() }, ch.label))),
    );
    this.root.style.display = '';
  }
}
