// The town hall's board: what Lypove is building together. What each project is for, how much is gathered (the
// town gives a little every day by itself), what the player can add — coins, or materials from the pocket — and,
// once it is funded, how the building goes, stage by stage.

import { iconSvg } from '../icons';
import type { ProjectView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface ProjectsHandlers {
  name(item: string): string;
  /** Copies of an item in the pocket. */
  inPocket(item: string): number;
  coins(): number;
  give(project: string, coins: number, items: [string, number][]): void;
}

export class ProjectsSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private here = false;

  constructor(parent: HTMLElement, private readonly handlers: ProjectsHandlers) {
    this.body = h('div', { class: 'projects-body' });
    this.root = h(
      'div',
      { class: 'settings projects', role: 'dialog', 'aria-label': t('projects.title') },
      h('div', { class: 'settings-card projects-card' },
        h('div', { class: 'ph' }, h('b', null, t('projects.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        h('p', { class: 'workshop-intro' }, t('projects.intro')),
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

  close(): void {
    this.root.style.display = 'none';
  }

  /** `here`: the player stands at the board (only there can one give). */
  open(projects: ProjectView[], here: boolean): void {
    this.here = here;
    this.render(projects);
    this.root.style.display = '';
  }

  refresh(projects: ProjectView[]): void {
    if (this.isOpen()) this.render(projects);
  }

  private render(projects: ProjectView[]): void {
    const order = { building: 0, open: 1, soon: 2, done: 3 } as const;
    const list = [...projects].sort((a, b) => order[a.status] - order[b.status]);
    this.body.replaceChildren(...list.map((p) => this.card(p)));
  }

  private card(p: ProjectView): HTMLElement {
    const status =
      p.status === 'done'
        ? t('projects.built')
        : p.status === 'building'
          ? t('projects.building', { stage: (p.stage ?? '').toLowerCase(), i: p.stage_index, of: p.stages.length })
          : p.status === 'soon'
            ? t('projects.soon')
            : t('projects.collected', { have: p.coins_have, need: p.coins_need });
    const bar = h('div', { class: 'project-bar' }, h('i', { style: { width: `${Math.round(Math.min(1, p.coins_have / Math.max(1, p.coins_need)) * 100)}%` } }));
    const items = p.items.map(([item, need, have]) => h('li', { class: have >= need ? 'ok' : '' }, `${this.handlers.name(item)}: ${have}/${need}`));
    const actions: HTMLElement[] = [];
    if (p.status === 'open' && this.here) {
      const left = p.coins_need - p.coins_have;
      for (const c of [10, 50, 100]) {
        const n = Math.min(c, left);
        if (n > 0) actions.push(h('button', { class: 'chip', type: 'button', disabled: this.handlers.coins() < n, onclick: () => this.handlers.give(p.id, n, []) }, t('projects.giveCoins', { n })));
      }
      for (const [item, need, have] of p.items) {
        const mine = this.handlers.inPocket(item);
        const n = Math.min(mine, need - have);
        if (n > 0) actions.push(h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.give(p.id, 0, [[item, n]]) }, t('projects.giveThing', { name: this.handlers.name(item), n })));
      }
    }
    return h('div', { class: `project ${p.status}` },
      h('b', null, p.name),
      h('p', null, p.status === 'done' ? p.done : p.text),
      h('span', { class: 'project-status' }, status),
      p.status === 'open' ? bar : null,
      items.length && p.status === 'open' ? h('ul', { class: 'project-items' }, ...items) : null,
      p.mine > 0 ? h('span', { class: 'project-mine' }, t('projects.mine', { n: p.mine })) : null,
      actions.length ? h('div', { class: 'project-actions' }, ...actions) : null,
      p.status === 'open' && !this.here ? h('span', { class: 'project-mine' }, t('projects.atHall')) : null);
  }
}
