// A while at an instrument: eight keys of a pentatonic scale that can never sound wrong, and — for one who has
// played a good while — a few tunes the hands remember. A while of playing counts as practice when it ends.

import { iconSvg } from '../icons';
import { h } from './dom';
import { t } from '../i18n';

/** Semitones above C4 of the keys: C D E G A c d e. */
const KEYS = [0, 2, 4, 7, 9, 12, 14, 16];
const NAMES = (): string[] => t('play.notes').split('\n');
/** Tunes by key index, with lengths in beats. */
const TUNES: { name: string; level: number; notes: [number, number][] }[] = [
  { name: 'lullaby', level: 1, notes: [[4, 1], [2, 1], [4, 1], [2, 1], [3, 2], [2, 1], [1, 1], [0, 2], [1, 1], [2, 1], [1, 2], [0, 3]] },
  { name: 'spring', level: 2, notes: [[0, 1], [2, 1], [4, 1], [5, 2], [4, 1], [3, 1], [4, 2], [2, 1], [1, 1], [2, 1], [0, 3]] },
  { name: 'pond', level: 3, notes: [[5, 2], [4, 1], [3, 1], [4, 2], [2, 2], [3, 1], [2, 1], [1, 2], [0, 1], [1, 1], [2, 4]] },
];

export class PlaySheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private ctx: AudioContext | null = null;
  private notes = 0;
  private onDone: ((notes: number) => void) | null = null;

  constructor(parent: HTMLElement, private readonly volume: () => number) {
    this.title = h('b', null, t('play.title'));
    this.body = h('div', { class: 'play-body' });
    this.root = h(
      'div',
      { class: 'settings play', role: 'dialog', 'aria-label': t('play.label') },
      h('div', { class: 'settings-card play-card' },
        h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.body),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** Sits down at the instrument: `level` is how well the hands know it; `done` is told how much was played. */
  open(name: string, level: number, done: (notes: number) => void): void {
    this.title.textContent = name;
    this.notes = 0;
    this.onDone = done;
    const names = NAMES();
    const keys = h('div', { class: 'play-keys' }, ...KEYS.map((_, i) => h('button', { class: 'play-key', type: 'button', 'aria-label': names[i], onpointerdown: () => this.note(i) }, names[i])));
    const tunes = TUNES.filter((t) => t.level <= level);
    this.body.replaceChildren(
      keys,
      tunes.length ? h('div', { class: 'play-tunes' }, h('span', { class: 'hint' }, t('play.remember')), ...tunes.map((tn) => h('button', { class: 'chip', type: 'button', onclick: () => this.tune(tn.notes) }, t(`play.tune.${tn.name}`)))) : h('p', { class: 'hint' }, t('play.free')),
    );
    this.root.style.display = '';
  }

  close(): void {
    if (!this.isOpen()) return;
    this.root.style.display = 'none';
    const done = this.onDone;
    this.onDone = null;
    if (done) done(this.notes);
  }

  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  /** A soft plucked-piano note. */
  private note(i: number, at = 0): void {
    this.notes++;
    const ctx = this.audio();
    if (!ctx) return;
    void ctx.resume();
    const t = ctx.currentTime + at;
    const f = 261.63 * Math.pow(2, KEYS[i] / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.22 * this.volume()), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    for (const [mult, type, vol] of [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.08]] as const) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f * mult, t);
      og.gain.value = vol;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 1.5);
    }
    g.connect(ctx.destination);
    const key = this.body.querySelectorAll('.play-key')[i] as HTMLElement | undefined;
    if (key) window.setTimeout(() => {
      key.classList.add('on');
      window.setTimeout(() => key.classList.remove('on'), 160);
    }, at * 1000);
  }

  private tune(notes: [number, number][]): void {
    let at = 0;
    for (const [k, beats] of notes) {
      this.note(k, at);
      at += beats * 0.42;
    }
  }
}
