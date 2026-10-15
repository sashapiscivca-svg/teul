// «Липовий вісник»: the morning paper, laid out as a paper — masthead, the front page with its photo, three more
// stories with photos, a short column of news and the coming days, the small ads. Text is short: a headline and a
// line or two. After days away, the missed issues lie on top, each with its front page. It opens by itself on the
// first open of each world day.

import { iconSvg } from '../icons';
import type { PaperStory, PaperView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

const SKY = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];

function sky(s: string): string {
  return SKY.includes(s.toLowerCase()) ? t(`paper.sky.${s.toLowerCase()}`) : s;
}

/** The issues missed while the player was away, and the paper's short note over them. */
export interface AwayIssues {
  note: string[];
  issues: { day: number; date: string; story: PaperStory }[];
}

export interface PaperDeps {
  /** A story's printed photo (a data URL), or null. */
  photo(story: PaperStory, day: number): Promise<string | null>;
  /** Where a photo was taken, for its caption. */
  placeName(place: string): string;
}

export class PaperSheet {
  readonly root: HTMLElement;
  private readonly page: HTMLElement;
  private shown = 0;

  constructor(parent: HTMLElement, private readonly deps: PaperDeps) {
    this.page = h('article', { class: 'paper-page' });
    this.root = h(
      'div',
      { class: 'settings paper', role: 'dialog', 'aria-label': t('paper.label') },
      h('div', { class: 'paper-card' }, this.page),
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

  /** A photo frame that fills in when its picture is printed. */
  private figure(story: PaperStory, day: number, size: 'big' | 'small', date: string): HTMLElement | null {
    if (!story.photo) return null;
    const img = h('img', { class: 'paper-photo-img', alt: story.title }) as HTMLImageElement;
    const fig = h('figure', { class: `paper-photo ${size} loading` }, img, size === 'big' ? h('figcaption', null, t('paper.photoCaption', { place: this.deps.placeName(story.photo.place), date })) : null);
    const ticket = this.shown;
    void this.deps.photo(story, day).then((url) => {
      if (ticket !== this.shown) return;
      if (url) {
        img.src = url;
        fig.classList.remove('loading');
      } else fig.remove();
    });
    return fig;
  }

  open(p: PaperView, away: AwayIssues | null = null): void {
    this.shown++;
    const list = (title: string, lines: string[], cls = '') =>
      lines.length === 0 ? null : h('section', { class: `paper-col ${cls}` }, h('h3', null, title), ...lines.map((l) => h('p', null, l)));
    const missed = away && away.issues.length > 0
      ? h('section', { class: 'paper-away' },
        h('h3', null, t('paper.whileAway')),
        ...away.note.map((l) => h('p', { class: 'paper-away-note' }, l)),
        h('div', { class: 'paper-stack' },
          ...away.issues.map((i) => h('div', { class: 'paper-back' },
            this.figure(i.story, i.day, 'small', i.date),
            h('span', { class: 'paper-back-date' }, i.date),
            h('b', null, i.story.title)))))
      : null;
    const parts: (HTMLElement | null)[] = [
      h('header', { class: 'paper-mast' },
        h('div', { class: 'paper-meta' }, h('span', null, `№ ${p.number}`), h('span', null, p.date), h('span', null, t('paper.weather', { today: sky(p.weather.today), tomorrow: sky(p.weather.tomorrow) })),
          // printed into the masthead's corner, ink on paper: folding the paper away
          h('button', { class: 'paper-close', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 16), onclick: () => this.close() })),
        h('h1', null, p.title),
        h('div', { class: 'paper-rule' })),
      missed,
      h('section', { class: 'paper-lead' },
        this.figure(p.headline, p.day, 'big', p.date),
        h('h2', null, p.headline.title),
        h('p', null, p.headline.text)),
      p.stories.length
        ? h('section', { class: 'paper-stories' },
          ...p.stories.map((s) => h('div', { class: 'paper-story' }, this.figure(s, p.day, 'small', p.date), h('div', null, h('b', null, s.title), h('p', null, s.text)))))
        : null,
      h('div', { class: 'paper-cols' },
        p.interview ? h('section', { class: 'paper-col paper-interview' }, h('h3', null, t('paper.interview')), h('p', { class: 'q' }, p.interview.question), h('p', { class: 'a' }, `— ${p.interview.answer}`)) : null,
        list(t('paper.short'), p.town.filter((l) => l !== p.headline.text && !p.stories.some((st) => st.text === l))),
        list(t('paper.soon'), p.events ?? []),
        list(t('paper.ads'), [...p.asks, ...p.ads], 'paper-ads')),
      h('footer', { class: 'paper-foot' }, h('button', { class: 'paper-fold', type: 'button', onclick: () => this.close() }, t('paper.fold'))),
    ];
    this.page.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    this.root.style.display = '';
    this.page.scrollTop = 0;
  }
}
