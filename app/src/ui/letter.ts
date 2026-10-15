// A letter in the world: a sheet of lined paper with the writer's words and name — how the neighbour tells a newcomer
// about the house and the town (the «letters» quests), and what one finds on the table or under the door.

import { t } from '../i18n';
import { h } from './dom';

export class LetterSheet {
  readonly root: HTMLElement;
  private readonly page: HTMLElement;

  constructor(parent: HTMLElement) {
    this.page = h('article', { class: 'letter-page' });
    this.root = h('div', { class: 'settings letter', role: 'dialog', 'aria-label': t('letter.title') }, this.page);
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

  /** A letter: its title, the words (paragraphs split by blank lines), who wrote it, and what one is asked to do. */
  open(letter: { title: string; text: string; from: string; todo?: string }): void {
    this.page.replaceChildren(
      h('h2', { class: 'letter-title' }, letter.title),
      ...letter.text.split(/\n\s*\n/).map((p) => h('p', null, p)),
      h('p', { class: 'letter-from' }, `— ${letter.from}`),
      ...(letter.todo ? [h('p', { class: 'letter-todo' }, letter.todo)] : []),
      h('button', { class: 'letter-fold', type: 'button', onclick: () => this.close() }, t('letter.fold')),
    );
    this.root.style.display = '';
  }
}
