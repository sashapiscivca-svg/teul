// A shift at a job: who is in charge, what is asked right now, and the answers to choose from. Between tasks the
// next guest (the next tray, the next parcel) takes a little while — the world's own pace; leaving the counter
// ends the shift and the town pays for what was done.

import { iconSvg } from '../icons';
import type { ShiftView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface WorkHandlers {
  shift(): ShiftView | null;
  /** World minutes now. */
  now(): number;
  answer(choice: number): void;
  end(): void;
}


export class WorkSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private timer: number | null = null;
  /** What the last answer was, shown until the next task. */
  private said: { text: string; good: boolean } | null = null;

  constructor(parent: HTMLElement, private readonly handlers: WorkHandlers) {
    this.title = h('b', null, t('work.title'));
    this.body = h('div', { class: 'work-body' });
    this.root = h(
      'div',
      { class: 'settings work', role: 'dialog', 'aria-label': t('work.title') },
      h('div', { class: 'settings-card work-card' },
        h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('work.minimize'), html: iconSvg('close', 20), onclick: () => this.hide() })),
        this.body),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(): void {
    this.said = null;
    this.root.style.display = '';
    this.render();
    if (this.timer === null) this.timer = window.setInterval(() => this.render(), 1000);
  }

  close(): void {
    this.hide();
  }

  /** Hides the sheet; the shift goes on (the counter is where it is). */
  hide(): void {
    this.root.style.display = 'none';
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** After an answer: how it went (the core's verdict), until the next task. */
  answered(good: boolean, text: string): void {
    this.said = { good, text };
    this.render();
  }

  render(): void {
    const s = this.handlers.shift();
    if (!s) {
      this.hide();
      return;
    }
    this.title.textContent = s.name;
    const ready = this.handlers.now() >= s.ready_at;
    const done = s.step >= s.steps || s.over;
    const kids: HTMLElement[] = [h('p', { class: 'work-boss' }, s.step === 0 && !this.said ? `${s.boss}: «${s.start}»` : t('work.bossNear', { boss: s.boss }))];
    if (this.said) kids.push(h('p', { class: `work-said ${this.said.good ? 'good' : 'bad'}` }, this.said.text));
    if (done) {
      kids.push(h('p', { class: 'work-line' }, s.over && s.step < s.steps ? t('work.over') : t('work.allDone')));
      kids.push(h('div', { class: 'ask-choices' }, h('button', { class: 'cta', type: 'button', onclick: () => this.handlers.end() }, t('work.end'))));
    } else if (!ready) {
      kids.push(h('p', { class: 'work-line wait' }, t('work.wait').split('\n')[s.step % 3]));
    } else {
      kids.push(h('p', { class: 'work-line' }, s.line));
      kids.push(h('div', { class: 'work-options' }, ...s.options.map((o, i) => h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.answer(i) }, o))));
    }
    if (!done) kids.push(h('div', { class: 'work-foot' }, h('span', { class: 'hint' }, s.earned > 0 ? t('work.earned', { n: s.earned }) : ''), h('button', { class: 'cta muted', type: 'button', onclick: () => this.handlers.end() }, t('work.leave'))));
    this.body.replaceChildren(...kids);
  }
}
