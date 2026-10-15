// The day in the interface: the "Today" panel (the village paper, letters, requests, the album, stories) and the
// little fishing game.

import { t } from '../i18n';
import { iconSvg } from '../icons';
import type { DailyView } from '../types';
import { clear, h } from './dom';

export type TodayTab = 'paper' | 'mail' | 'requests' | 'album' | 'stories' | 'bills' | 'me';

export interface TodayDeps {
  /** A thing's name and a small picture of it. */
  name(item: string): string;
  thumb(item: string, size: number): HTMLCanvasElement;
  /** How many free copies the player has of things answering a key (an id or `#tag`). */
  have(key: string): number;
  openLetter(npc: string, index: number): void;
  /** Hints where a missing thing of the album can be found. */
  whereToFind(item: string): string;
  /** Someone's name. */
  person(id: string): string;
  /** What really happened in the settlement since yesterday, newest first. */
  news(): string[];
  /** Opens today's full paper. */
  openPaper?(): void;
  /** The monthly bills as a block, and how many are unpaid (for the tab's badge). */
  bills?(): { block: HTMLElement; due: number };
  /** The «Я» page: what the hands have learned, where one works, the pictures painted. */
  me?(): HTMLElement;
}

/** How many things in the day want the player's attention (for the badge on the button). */
export function todayCount(d: DailyView): number {
  return d.letters.filter((l) => !l.opened).length + d.requests.filter((r) => !r.done && r.ready).length + d.stories.filter((s) => s.ready && s.next && s.has_items).length;
}

export class TodayPanel {
  readonly root: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private tab: TodayTab = 'paper';
  private day: DailyView | null = null;

  constructor(parent: HTMLElement, private readonly deps: TodayDeps) {
    this.tabs = h('div', { class: 'today-tabs' });
    this.body = h('div', { class: 'today-body' });
    this.root = h(
      'div',
      { class: 'settings today', role: 'dialog', 'aria-label': t('daily.today') },
      h('div', { class: 'settings-card' }, h('div', { class: 'ph' }, h('b', null, t('daily.todayIn')), h('button', { class: 'round small', type: 'button', 'aria-label': t('daily.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.tabs, this.body),
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

  open(day: DailyView, tab?: TodayTab): void {
    this.day = day;
    if (tab) this.tab = tab;
    this.root.style.display = '';
    this.render();
  }

  /** Shows a newer state of the day (after a letter was opened, say), staying on the same tab. */
  update(day: DailyView): void {
    this.day = day;
    if (this.isOpen()) this.render();
  }

  close(): void {
    this.root.style.display = 'none';
  }

  private render(): void {
    const d = this.day;
    if (!d) return;
    clear(this.tabs);
    const unread = d.letters.filter((l) => !l.opened).length;
    const open = d.requests.filter((r) => !r.done).length;
    const tab = (id: TodayTab, label: string, icon: string, badge = 0) =>
      h('button', { class: `chip ${this.tab === id ? 'on' : ''}`, type: 'button', onclick: () => { this.tab = id; this.render(); } },
        h('span', { class: 'ico', html: iconSvg(icon, 16) }), label, badge > 0 ? h('span', { class: 'badge' }, String(badge)) : null);
    const bills = this.deps.bills?.();
    this.tabs.append(tab('paper', t('daily.paper'), 'read'), tab('mail', t('daily.mail'), 'mail', unread), tab('requests', t('daily.requests'), 'heart', open), tab('album', t('daily.album'), 'leaf'), tab('stories', t('daily.stories'), 'talk'));
    if (bills) this.tabs.append(tab('bills', t('daily.bills'), 'coin', bills.due));
    const me = this.deps.me;
    if (me) this.tabs.append(tab('me', t('daily.me'), 'person'));
    clear(this.body);
    if (this.tab === 'me' && me) this.body.append(me());
    else if (this.tab === 'bills' && bills) this.body.append(bills.block);
    else if (this.tab === 'paper') this.paper(d);
    else if (this.tab === 'mail') this.mail(d);
    else if (this.tab === 'requests') this.requests(d);
    else if (this.tab === 'album') this.album(d);
    else this.stories(d);
  }

  private paper(d: DailyView): void {
    this.body.append(h('div', { class: 'paper-head' }, h('b', null, t('daily.herald')), h('span', { class: 'hint' }, t('daily.day', { n: d.day + 1 }))));
    const open = this.deps.openPaper;
    if (open) this.body.append(h('button', { class: 'cta paper-open', type: 'button', onclick: () => open() }, t('daily.openIssue')));
    const news = this.deps.news();
    if (news.length > 0) {
      this.body.append(h('div', { class: 'paper-section' }, t('daily.events')));
      for (const line of news.slice(0, 8)) this.body.append(h('p', { class: 'paper-line news' }, line));
      this.body.append(h('div', { class: 'paper-section' }, t('daily.villageLife')));
    }
    for (const line of d.paper) this.body.append(h('p', { class: 'paper-line' }, line));
    if (d.note) this.body.append(h('div', { class: 'card note' }, h('span', { class: 'hint' }, t('daily.noteFrom', { name: d.note[1] })), h('p', null, t('daily.quoted', { text: d.note[2] }))));
  }

  private mail(d: DailyView): void {
    const letters = [...d.letters].sort((a, b) => Number(a.opened) - Number(b.opened));
    if (letters.length === 0) this.body.append(h('p', { class: 'hint' }, t('daily.noLetters')));
    for (const l of letters) {
      const card = h('div', { class: `card letter ${l.opened ? 'opened' : ''}` },
        h('div', { class: 'letter-head' }, h('span', { class: 'ico', html: iconSvg('mail', 16) }), h('b', null, l.name), l.gift && !l.opened ? h('span', { class: 'gift-mark', html: iconSvg('gift', 14) }) : null));
      if (l.opened) card.append(h('p', null, l.text));
      else card.append(h('button', { class: 'cta', type: 'button', onclick: () => this.deps.openLetter(l.npc, l.index) }, l.gift ? t('daily.openGift') : t('daily.open')));
      this.body.append(card);
    }
  }

  private requests(d: DailyView): void {
    this.body.append(h('p', { class: 'hint' }, t('daily.requestsHint')));
    for (const r of d.requests) {
      const need = h('div', { class: 'need-row' });
      for (const [key, n] of r.items) {
        const have = this.deps.have(key);
        const label = key.startsWith('#') ? TAG_NAMES[key.slice(1)] ?? key.slice(1) : this.deps.name(key);
        need.append(h('span', { class: `need-item ${have >= n ? 'ok' : ''}` }, key.startsWith('#') ? '' : this.deps.thumb(key, 28), `${label} ${Math.min(have, n)}/${n}`));
      }
      const reward = [r.coins > 0 ? t('daily.coins', { n: r.coins }) : '', r.gift ? t('daily.gift', { name: this.deps.name(r.gift) }) : '', t('daily.friendship')].filter(Boolean).join(' · ');
      this.body.append(h('div', { class: `card request ${r.done ? 'done' : ''}` },
        h('div', { class: 'letter-head' }, h('b', null, r.name), r.done ? h('span', { class: 'done-mark', html: iconSvg('check', 14) + ' ' + t('daily.done') }) : null),
        h('p', null, t('daily.quoted', { text: r.text })), need, h('div', { class: 'hint' }, t('daily.reward', { reward }))));
    }
  }

  private album(d: DailyView): void {
    const have = new Set(d.collected);
    const total = d.collections.reduce((n, c) => n + c.items.length, 0);
    this.body.append(h('p', { class: 'hint' }, t('daily.found', { have: d.collections.reduce((n, c) => n + c.found.length, 0), total })));
    for (const c of d.collections) {
      const row = h('div', { class: 'album-row' });
      for (const item of c.items) {
        const found = have.has(item);
        const cell = h('div', { class: `album-cell ${found ? 'found' : ''}`, title: found ? this.deps.name(item) : this.deps.whereToFind(item) }, this.deps.thumb(item, 40), h('span', null, found ? this.deps.name(item) : '?'));
        if (!found) cell.append(h('span', { class: 'where' }, this.deps.whereToFind(item)));
        row.append(cell);
      }
      this.body.append(h('div', { class: `card album ${c.done ? 'done' : ''}` },
        h('div', { class: 'letter-head' }, h('b', null, c.name), h('span', { class: 'hint' }, c.done ? t('daily.collected') : t('daily.progress', { have: c.found.length, total: c.items.length, reward: this.deps.name(c.reward) }))), row));
    }
  }

  private stories(d: DailyView): void {
    if (d.stories.length === 0) this.body.append(h('p', { class: 'hint' }, t('daily.noStories')));
    for (const s of d.stories) {
      const state = !s.next ? t('daily.storyDone') : s.ready ? t('daily.storyReady', { next: s.next }) : t('daily.storyNext', { next: s.next });
      this.body.append(h('div', { class: 'card story' }, h('div', { class: 'letter-head' }, h('b', null, s.npc === 'yarynka' ? t('daily.yarynkaMap') : this.deps.person(s.npc)), h('span', { class: 'hint' }, `${s.step}/${s.total}`)), h('p', null, state)));
    }
  }
}

export const TAG_NAMES: Record<string, string> = {
  get fish() { return t('daily.tagFish'); },
  get berry() { return t('daily.tagBerry'); },
  get flower() { return t('daily.tagFlower'); },
  get fruit() { return t('daily.tagFruit'); },
  get mushroom() { return t('daily.tagMushroom'); },
};

/**
 * Fishing: the float bobs, then dips; tapping while it is down lands the fish. Too early or too late and it is
 * gone. Reports the result once.
 */
export class FishingGame {
  readonly root: HTMLElement;
  private readonly float: HTMLElement;
  private readonly text: HTMLElement;
  private readonly button: HTMLButtonElement;
  private timers: number[] = [];
  private state: 'idle' | 'waiting' | 'bite' = 'idle';
  private done: ((ok: boolean) => void) | null = null;
  private last: { where: string; done: (ok: boolean) => void } | null = null;

  constructor(parent: HTMLElement, private readonly onBite: () => void, private readonly canCast: () => boolean = () => true) {
    this.float = h('div', { class: 'float' }, h('i', { class: 'bob' }), h('i', { class: 'ring' }));
    this.text = h('p', { class: 'fish-text' });
    this.button = h('button', { class: 'cta', type: 'button', onclick: () => this.pull() }, t('daily.pull'));
    this.root = h('div', { class: 'fishing', role: 'dialog', 'aria-label': t('daily.fishing') },
      h('div', { class: 'fish-card' }, h('div', { class: 'water' }, this.float), this.text, h('div', { class: 'fish-actions' }, this.button, h('button', { class: 'cta muted', type: 'button', onclick: () => this.stop() }, t('daily.packUp')))));
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** Casts the line; `done` hears whether a fish was landed (not called when the player gives up). */
  start(where: string, done: (ok: boolean) => void): void {
    this.clear();
    this.done = done;
    this.last = { where, done };
    this.button.textContent = t('daily.pull');
    this.root.style.display = '';
    this.text.textContent = t('daily.casting', { where });
    this.state = 'waiting';
    this.float.className = 'float';
    const wait = 1500 + Math.random() * 3500;
    // a nibble or two first, to tease
    this.timers.push(window.setTimeout(() => this.float.classList.add('nibble'), wait * 0.5));
    this.timers.push(window.setTimeout(() => this.float.classList.remove('nibble'), wait * 0.5 + 300));
    this.timers.push(window.setTimeout(() => {
      this.state = 'bite';
      this.float.classList.add('bite');
      this.text.textContent = t('daily.bite');
      this.onBite();
      this.timers.push(window.setTimeout(() => this.finish(false, t('daily.gotAway')), 950));
    }, wait));
  }

  pull(): void {
    if (this.state === 'idle' && this.last) {
      if (this.canCast()) this.start(this.last.where, this.last.done);
      else this.text.textContent = t('daily.noMoreFish');
    }
    else if (this.state === 'bite') this.finish(true, '');
    else if (this.state === 'waiting') this.finish(false, t('daily.tooEarly'));
  }

  private finish(ok: boolean, message: string): void {
    this.clear();
    this.state = 'idle';
    this.float.className = 'float';
    const done = this.done;
    this.done = null;
    if (ok) this.root.style.display = 'none';
    else {
      this.text.textContent = message;
      this.button.textContent = t('daily.castAgain');
    }
    done?.(ok);
  }

  stop(): void {
    this.clear();
    this.state = 'idle';
    this.done = null;
    this.root.style.display = 'none';
  }

  private clear(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }
}
