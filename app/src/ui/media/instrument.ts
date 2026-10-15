// At an instrument: a piece of the repertoire played by the hero's hands (as well as they can), or playing freely
// on keys, chords, strings or the holes of a pipe. The notes run along a little staff as they sound. No scores,
// no marks: the piece simply sounds better as the hands learn it.

import { iconSvg } from '../../icons';
import { h } from '../dom';
import { perform, scoreOf, type Sounded } from './arrange';
import { KITS, type Kit, type KitId } from './kits';
import { Sampler, type AudioOut } from './sampler';
import type { PieceView } from '../../types';
import { t } from '../../i18n';

export interface PlayResult {
  /** Notes played by hand. */
  notes: number;
  /** A piece played to its end. */
  piece?: string;
}

export interface PlayOpen {
  kit: KitId;
  title: string;
  /** The pieces the hands know (or have the sheet for). */
  pieces: PieceView[];
  /** The music skill's level (0..3). */
  skill: number;
  audio: AudioOut | null;
  /** In the street: a piece played to the end is played for whoever listens. */
  street?: boolean;
  /** The hero's pose while playing (null: put down). */
  onPose?: (playing: boolean) => void;
  /** A piece ended (in the street the town answers it). */
  onPiece?: (piece: string) => void;
  done: (r: PlayResult) => void;
  /** In the street with more than one instrument along: which to play. */
  choices?: { id: string; name: string }[];
  chosen?: string;
  onChoose?: (id: string) => void;
}

const DO = t('media.instrument.notes').split('\n');
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const GUITAR_CHORDS: [string, number[]][] = [
  ['Am', [45, 52, 57, 60, 64]], ['C', [48, 52, 55, 60, 64]], ['Dm', [50, 57, 62, 65]], ['E', [40, 47, 52, 56, 59, 64]],
  ['G', [43, 47, 50, 55, 59, 67]], ['F', [41, 48, 53, 57, 60, 65]], ['Em', [40, 47, 52, 55, 59, 64]], ['D', [50, 57, 62, 66]],
];

export class InstrumentSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly staff: HTMLCanvasElement;
  private sampler: Sampler | null = null;
  private opts: PlayOpen | null = null;
  private notes = 0;
  private finished: string | undefined;
  private tries = 0;
  private trail: { key: number; at: number; slip: boolean }[] = [];
  private raf = 0;
  private progress = 0;
  private nowPlaying: string | null = null;

  constructor(parent: HTMLElement) {
    this.title = h('b', null, t('play.title'));
    this.body = h('div', { class: 'play-body' });
    this.staff = h('canvas', { class: 'play-staff', width: 320, height: 72 });
    this.root = h(
      'div',
      { class: 'settings play', role: 'dialog', 'aria-label': t('play.label') },
      h('div', { class: 'settings-card play-card' },
        h('div', { class: 'ph' }, this.title, h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.staff,
        this.body),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** What is being played now (for the e2e and the hero's pose). */
  playing(): string | null {
    return this.nowPlaying;
  }

  open(o: PlayOpen): void {
    this.opts = o;
    this.notes = 0;
    this.finished = undefined;
    this.trail = [];
    this.title.textContent = o.title;
    this.sampler = o.audio ? new Sampler(o.audio, KITS[o.kit]) : null;
    void this.sampler?.ready();
    this.root.style.display = '';
    this.showList();
    this.draw();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.sampler?.stop();
    this.nowPlaying = null;
    this.opts?.onPose?.(false);
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.progress);
    this.raf = 0;
    this.root.style.display = 'none';
    const o = this.opts;
    this.opts = null;
    o?.done({ notes: this.notes, piece: this.finished });
  }

  private kit(): Kit {
    return KITS[this.opts?.kit ?? 'piano'];
  }

  private showList(): void {
    const o = this.opts;
    if (!o) return;
    const known = o.pieces.filter((p) => p.known && scoreOf(p.id));
    const rows = known.map((p) =>
      h('button', { class: 'play-piece', type: 'button', onclick: () => this.playPiece(p.id) },
        h('span', { class: 'pp-name' }, p.name),
        h('span', { class: 'pp-by' }, p.by),
        p.learned ? null : h('span', { class: 'pp-sheet', html: iconSvg('paper', 14), title: t('media.instrument.fromScore') })),
    );
    const choose = o.choices && o.choices.length > 1
      ? h('div', { class: 'play-modes' }, ...o.choices.map((c) => h('button', { class: `chip${c.id === o.chosen ? ' on' : ''}`, type: 'button', onclick: () => o.onChoose?.(c.id) }, c.name)))
      : null;
    this.body.replaceChildren(
      ...(choose ? [choose] : []),
      h('div', { class: 'play-pieces' }, ...rows),
      h('div', { class: 'play-modes' }, h('button', { class: 'chip', type: 'button', onclick: () => this.showFree() }, t('media.instrument.free'))),
    );
  }

  private playPiece(id: string): void {
    const o = this.opts;
    const score = scoreOf(id);
    if (!o || !score) return;
    const name = o.pieces.find((p) => p.id === id)?.name ?? score.name;
    const perf = perform(score, this.kit(), o.skill, this.tries++);
    this.nowPlaying = id;
    o.onPose?.(true);
    const stop = h('button', { class: 'chip', type: 'button', onclick: () => {
      this.sampler?.stop();
      this.nowPlaying = null;
      o.onPose?.(false);
      this.showList();
    } }, t('media.instrument.stop'));
    const bar = h('div', { class: 'play-progress' }, h('i', null));
    this.body.replaceChildren(h('div', { class: 'play-now' }, h('div', null, h('b', null, name), h('span', null, score.by)), stop), bar);
    const fill = bar.firstElementChild as HTMLElement;
    const t0 = performance.now();
    const step = () => {
      fill.style.width = `${Math.min(100, ((performance.now() - t0) / 1000 / perf.secs) * 100)}%`;
      if (this.nowPlaying === id) this.progress = requestAnimationFrame(step);
    };
    this.progress = requestAnimationFrame(step);
    const onNote = (n: Sounded) => {
      if (n.lead) {
        this.notes++;
        this.mark(n.key, !!n.slip);
      }
    };
    const end = () => {
      if (this.nowPlaying !== id) return;
      this.nowPlaying = null;
      this.finished = id;
      o.onPose?.(false);
      o.onPiece?.(id);
      this.showList();
    };
    if (this.sampler) this.sampler.play(perf, onNote, end);
    else {
      // no sound (a muted or old browser): the piece still takes its time
      for (const n of perf.notes) if (n.lead) window.setTimeout(() => this.nowPlaying === id && onNote(n), n.t * 1000);
      window.setTimeout(end, perf.secs * 1000);
    }
  }

  /** A note played by hand. */
  private hit(key: number, len = 0.6): void {
    this.notes++;
    this.sampler?.note(key, len, 0.8);
    this.mark(key, false);
    this.opts?.onPose?.(true);
    window.clearTimeout(this.poseOff);
    this.poseOff = window.setTimeout(() => this.opts?.onPose?.(false), 1600);
  }

  private poseOff = 0;

  private showFree(): void {
    const kit = this.kit();
    const back = h('button', { class: 'chip', type: 'button', onclick: () => this.showList() }, t('media.instrument.toScores'));
    const press = (el: HTMLElement, run: () => void) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.classList.add('on');
        run();
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => el.classList.remove('on'));
      return el;
    };
    let pad: HTMLElement;
    if (kit.free === 'keys') {
      // two octaves of keys, the black ones over the white
      const base = kit.id === 'accordion' ? 60 : 60;
      const whites: HTMLElement[] = [];
      const blacks: HTMLElement[] = [];
      for (let o = 0; o < 2; o++) {
        WHITE.forEach((w, i) => {
          const key = base + o * 12 + w;
          whites.push(press(h('button', { class: 'play-key', type: 'button', 'aria-label': DO[i], 'data-key': key }, DO[i]), () => this.hit(key)));
          if (w !== 4 && w !== 11) {
            const bk = h('button', { class: 'play-black', type: 'button', 'aria-label': `${DO[i]}♯`, 'data-key': key + 1, style: `left: calc(${((o * 7 + i + 1) / 14) * 100}% - 3.2%)` });
            blacks.push(press(bk, () => this.hit(key + 1)));
          }
        });
      }
      pad = h('div', { class: 'play-keys piano' }, ...whites, ...blacks);
    } else if (kit.free === 'chords') {
      pad = h('div', { class: 'play-chords' }, ...GUITAR_CHORDS.map(([name, keys]) =>
        press(h('button', { class: 'play-chord', type: 'button' }, name), () => {
          keys.forEach((k, i) => this.sampler?.note(k, 1.6, 0.6 - i * 0.03, i * 0.03));
          this.notes++;
          this.mark(keys[keys.length - 1], false);
          this.opts?.onPose?.(true);
          window.clearTimeout(this.poseOff);
          this.poseOff = window.setTimeout(() => this.opts?.onPose?.(false), 1600);
        })));
    } else {
      // strings or holes: a scale to run up and down
      const base = kit.id === 'violin' ? 67 : kit.id === 'sopilka' ? 72 : 55;
      const count = kit.id === 'bandura' ? 15 : kit.id === 'violin' ? 10 : 8;
      const keys = Array.from({ length: count }, (_, i) => base + Math.floor(i / 7) * 12 + WHITE[i % 7] - WHITE[0]);
      pad = h('div', { class: `play-strings ${kit.free}` }, ...keys.map((k, i) =>
        press(h('button', { class: 'play-string', type: 'button', 'data-key': k }, DO[i % 7]), () => this.hit(k, kit.id === 'violin' || kit.id === 'sopilka' ? 0.9 : 1.2))));
    }
    this.body.replaceChildren(pad, h('div', { class: 'play-modes' }, back));
  }

  private mark(key: number, slip: boolean): void {
    this.trail.push({ key, at: performance.now(), slip });
    if (this.trail.length > 40) this.trail.shift();
    if (!this.raf) this.raf = requestAnimationFrame(() => this.draw());
  }

  /** The staff: five lines and the notes drifting left as they sound. */
  private draw(): void {
    this.raf = 0;
    const c = this.staff.getContext('2d');
    if (!c) return;
    const W = this.staff.width;
    const H = this.staff.height;
    c.fillStyle = '#f4eedf';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#8a7a60';
    for (let i = 0; i < 5; i++) c.fillRect(8, 18 + i * 8, W - 16, 1);
    c.fillStyle = '#2a2420';
    c.font = '28px serif';
    c.fillText('𝄞', 8, 56);
    const now = performance.now();
    let alive = false;
    for (const n of this.trail) {
      const age = (now - n.at) / 1000;
      const x = W - 24 - age * 70;
      if (x < 34) continue;
      alive = true;
      // E4 sits on the bottom line; each step of the scale is half a line
      const step = Math.round(((n.key - 64) * 7) / 12);
      const y = 50 - step * 4;
      c.fillStyle = n.slip ? '#c0392b' : '#2a2420';
      c.fillRect(Math.round(x), Math.round(Math.max(2, Math.min(H - 6, y))) - 2, 6, 5);
      c.fillRect(Math.round(x) + 5, Math.round(Math.max(2, Math.min(H - 6, y))) - 14, 1, 12);
    }
    if (alive || this.nowPlaying) this.raf = requestAnimationFrame(() => this.draw());
  }
}
