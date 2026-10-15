// The notebook: what I promised whom and where, who would be glad of a hand today, what was done. A personal
// notebook, not a checklist: no counters, no prizes announced, no instructions — people's words and places.

import { t } from '../i18n';
import type { WarmthView } from '../feel';
import { iconSvg } from '../icons';
import { deadlineWords, whereWords } from '../notebook';
import type { QuestOffer, QuestsView, QuestView } from '../types';
import { h } from './dom';

export type JournalTab = 'promised' | 'asked' | 'done' | 'people';

export interface JournalDeps {
  /** Location names by id. */
  names(): Record<string, string>;
  /** Where the player is now. */
  here(): string;
  today(): number;
  epoch(): number;
  start(key: string): void;
  step(key: string, choice: number | null): void;
  /** The promise shown under the clock. */
  tracked(): string | null;
  track(key: string | null): void;
  /** The people the player knows, and how things stand with each, in words. */
  people?(): WarmthView[];
}

/** Why one cannot promise it now, in the world's words. */
function notYet(o: QuestOffer, where: string): string {
  switch (o.reason) {
    case 'not_here':
      return where ? t('journal.notHereAt', { where }) : t('journal.notHere');
    case 'too_soon':
      return t('journal.tooManyPromises');
    case 'pocket_full':
      return t('journal.pocketFullTake');
    case 'closed':
      return t('journal.notTheTime');
    case 'locked':
      return t('journal.lockedFirst');
    default:
      return '';
  }
}

export class JournalSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs: HTMLElement;
  private tab: JournalTab = 'promised';
  private view: QuestsView | null = null;

  constructor(parent: HTMLElement, private readonly deps: JournalDeps) {
    this.tabs = h('div', { class: 'pocket-tabs' });
    this.body = h('div', { class: 'journal-body' });
    this.root = h(
      'div',
      { class: 'settings journal', role: 'dialog', 'aria-label': t('journal.title') },
      h('div', { class: 'settings-card journal-card' },
        h('div', { class: 'ph' }, h('b', null, t('journal.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('journal.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.tabs,
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

  open(view: QuestsView, tab?: JournalTab): void {
    this.tab = tab ?? (view.active.length > 0 ? 'promised' : 'asked');
    this.refresh(view);
    this.root.style.display = '';
  }

  refresh(view: QuestsView): void {
    this.view = view;
    this.render();
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    const tab = (id: JournalTab, label: string) => h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, type: 'button', onclick: () => { this.tab = id; this.render(); } }, label);
    this.tabs.replaceChildren(tab('promised', t('journal.tabPromised')), tab('asked', t('journal.tabAsked')), tab('done', t('journal.tabDone')), ...(this.deps.people ? [tab('people', t('journal.tabPeople'))] : []));
    const kids: HTMLElement[] = [];
    if (this.tab === 'promised') {
      if (v.active.length === 0) kids.push(h('p', { class: 'pocket-empty' }, t('journal.nothingPromised')));
      for (const q of v.active) kids.push(this.promise(q));
    } else if (this.tab === 'asked') {
      const offers = v.offers.filter((o) => o.can_start);
      if (offers.length === 0) kids.push(h('p', { class: 'pocket-empty' }, t('journal.nobodyAsks')));
      for (const o of offers) kids.push(this.offer(o));
    } else if (this.tab === 'people') {
      kids.push(...peoplePage(this.deps.people?.() ?? []));
    } else {
      if (v.titles.length > 0) kids.push(h('p', { class: 'journal-titles' }, t('journal.titles', { titles: v.titles.join(', ') })));
      if (v.done.length === 0 && v.missed.length === 0) kids.push(h('p', { class: 'pocket-empty' }, t('journal.empty')));
      for (const d of [...v.done].reverse()) {
        kids.push(h('div', { class: 'journal-entry done' }, h('b', null, d.title), h('span', { class: 'journal-who' }, d.giver_name), d.bye ? h('p', { class: 'journal-bye' }, d.bye) : ''));
      }
      for (const d of v.missed) {
        kids.push(h('div', { class: 'journal-entry missed' }, h('b', null, d.title), h('span', { class: 'journal-who' }, t('journal.missed', { name: d.giver_name }))));
      }
    }
    this.body.replaceChildren(...kids);
  }

  private promise(q: QuestView): HTMLElement {
    const names = this.deps.names();
    const where = whereWords(q.location, names);
    const when = deadlineWords(q.deadline, this.deps.today(), this.deps.epoch());
    const tracked = this.deps.tracked() === q.key;
    const doIt: HTMLElement[] = [];
    if (q.act.do === 'choose' && q.here) {
      q.act.options.forEach((o, i) => doIt.push(h('button', { class: 'cta journal-choice', type: 'button', onclick: () => this.deps.step(q.key, i) }, o.label)));
    } else if ((q.act.do === 'go' || q.act.do === 'bring' || q.act.do === 'wait') && q.here) {
      const label = q.act.do === 'bring' ? t('journal.give') : q.act.do === 'wait' ? t('journal.next') : t('journal.imHere');
      doIt.push(h('button', { class: 'cta', type: 'button', disabled: !q.ready, onclick: () => this.deps.step(q.key, null) }, label));
    }
    const note = !q.ready && q.here ? this.why(q) : '';
    return h('div', { class: `journal-entry ${tracked ? 'tracked' : ''}` },
      h('div', { class: 'journal-head' },
        h('b', null, q.title),
        h('button', { class: `chip journal-track ${tracked ? 'on' : ''}`, type: 'button', 'aria-label': tracked ? t('journal.untrackLabel') : t('journal.trackLabel'), onclick: () => { this.deps.track(tracked ? null : q.key); this.render(); } }, tracked ? t('journal.tracked') : t('journal.track'))),
      h('span', { class: 'journal-who' }, q.giver_name),
      h('p', { class: 'journal-now' }, q.text),
      where || when ? h('p', { class: 'journal-where' }, [where, when].filter(Boolean).join(' · ')) : '',
      note ? h('p', { class: 'journal-note' }, note) : '',
      doIt.length ? h('div', { class: 'journal-do' }, ...doIt) : '');
  }

  private why(q: QuestView): string {
    switch (q.reason) {
      case 'closed':
        return q.act.do === 'go' && q.act.hours ? t('journal.comeBetween', { from: q.act.hours[0], to: q.act.hours[1] }) : t('journal.notNow');
      case 'not_enough':
        return t('journal.notEnough');
      case 'too_soon':
        return q.wait_left > 0 ? t('journal.waitABit') : t('journal.notYet');
      case 'pocket_full':
        return t('journal.pocketFull');
      default:
        return '';
    }
  }

  private offer(o: QuestOffer): HTMLElement {
    const where = whereWords(o.offer, this.deps.names());
    const here = this.deps.here();
    const canHere = here === o.offer || here === 'village';
    const when = deadlineWords(o.deadline, this.deps.today(), this.deps.epoch());
    const reason = canHere && o.reason !== 'not_here' ? notYet(o, where) : o.reason === 'not_here' || !canHere ? notYet({ ...o, reason: 'not_here' }, where) : '';
    return h('div', { class: 'journal-entry' },
      h('b', null, o.title),
      h('span', { class: 'journal-who' }, `${o.giver_name}${where ? ` · ${where}` : ''}${when ? ` · ${when}` : ''}`),
      h('p', { class: 'journal-now' }, o.intro),
      reason ? h('p', { class: 'journal-note' }, reason) : '',
      canHere && !o.reason ? h('div', { class: 'journal-do' }, h('button', { class: 'cta', type: 'button', onclick: () => this.deps.start(o.key) }, t('journal.promise'))) : '');
  }
}

const LEVEL_ORDER = ['dear', 'close', 'warm', 'known', 'stranger'];

/** Everyone the player has come to know, the closest first (strangers are not on the page). */
export function peopleKnown(people: WarmthView[]): WarmthView[] {
  return people.filter((p) => p.level !== 'stranger').sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.name.localeCompare(b.name, 'uk'));
}

/** The people page: each person told in a few lines. */
function peoplePage(people: WarmthView[]): HTMLElement[] {
  const known = peopleKnown(people);
  if (known.length === 0) return [h('p', { class: 'pocket-empty' }, t('journal.noPeople'))];
  return known.map((p) =>
    h('div', { class: `journal-entry person-${p.level}` },
      h('div', { class: 'journal-head' }, h('b', null, p.name), h('span', { class: 'journal-who' }, p.today)),
      h('p', { class: 'journal-now' }, p.words),
      p.people.length ? h('p', { class: 'journal-where' }, p.people.join('; ')) : '',
      p.confide ? h('p', { class: 'journal-bye' }, t('journal.secret', { words: p.confide })) : ''));
}
