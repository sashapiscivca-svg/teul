// The computer at home: a small desktop of its own, offline. A diary, a picture to draw and print for the wall, a
// composer that plays the instruments, the town's encyclopedia (the places, and the people one knows),
// «Сапер», the weather, the maps and the games.

import { t } from '../../i18n';
import { iconSvg } from '../../icons';
import { h } from '../dom';
import { newMines, near, reveal, toggleFlag, won, type Mines } from '../../arcade/mines';
import { ROWS, STEPS, packPattern, patternNotes, unpackPattern, type Pattern } from './composer';
import { KITS, type KitId } from './kits';
import { Sampler, type AudioOut } from './sampler';
import { secureLocal } from '../../secure/vault';

export interface WikiEntry {
  kind: 'place' | 'person';
  name: string;
  text: string;
}

export interface DesktopHandlers {
  /** The paint app: draws, then prints and frames the picture (a canvas to hang). */
  paint(): void;
  games(): void;
  /** «Мапи»: the town's street map. */
  maps(): void;
  wiki(): WikiEntry[];
  weather(): { now: string; next: string };
  audio(): AudioOut | null;
  /** The day as a date line for the diary ("11 жовтня 2026"). */
  today(): string;
  /** The minute of the day (the world's clock). */
  minute(): number;
}

type App = 'diary' | 'paint' | 'composer' | 'wiki' | 'mines' | 'weather' | 'games' | 'maps';

const APPS: { id: App; name: string; icon: string }[] = [
  { id: 'diary', name: 'media.desktop.diary', icon: 'page' },
  { id: 'paint', name: 'media.desktop.paint', icon: 'paint' },
  { id: 'composer', name: 'media.desktop.composer', icon: 'play_music' },
  { id: 'wiki', name: 'media.desktop.wiki', icon: 'read' },
  { id: 'mines', name: 'media.desktop.mines', icon: 'gear' },
  { id: 'weather', name: 'media.desktop.weather', icon: 'sun' },
  { id: 'maps', name: 'media.desktop.maps', icon: 'map' },
  { id: 'games', name: 'media.desktop.games', icon: 'sparkle' },
];

function readLocal(key: string): string | null {
  try {
    return secureLocal()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    secureLocal()?.setItem(key, value);
  } catch {
    // a private window: kept for this sitting only
  }
}

export class Desktop {
  readonly root: HTMLElement;
  private readonly screen: HTMLElement;
  private readonly clock: HTMLElement;
  private app: App | null = null;
  private sampler: Sampler | null = null;
  private loop = 0;
  private timer = 0;

  constructor(parent: HTMLElement, private readonly handlers: DesktopHandlers) {
    this.screen = h('div', { class: 'pc-screen' });
    this.clock = h('span', { class: 'pc-clock' });
    this.root = h(
      'div',
      { class: 'settings pc', role: 'dialog', 'aria-label': t('media.desktop.computer') },
      h('div', { class: 'settings-card pc-card' },
        h('div', { class: 'pc-monitor' }, this.screen, h('div', { class: 'pc-bar' }, h('button', { class: 'pc-start', type: 'button', onclick: () => this.home() }, t('media.desktop.os')), this.clock)),
        h('button', { class: 'chip pc-off', type: 'button', onclick: () => this.close() }, t('media.desktop.off'))),
    );
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** The app open now (for the e2e). */
  current(): string | null {
    return this.app;
  }

  open(): void {
    this.root.style.display = '';
    this.home();
    const tick = () => {
      const m = Math.floor(this.handlers.minute()) % 1440;
      this.clock.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    tick();
    this.timer = window.setInterval(tick, 10000);
  }

  close(): void {
    this.stopMusic();
    window.clearInterval(this.timer);
    this.root.style.display = 'none';
    this.app = null;
  }

  private home(): void {
    this.stopMusic();
    this.app = null;
    this.screen.replaceChildren(h('div', { class: 'pc-icons' }, ...APPS.map((a) =>
      h('button', { class: 'pc-icon', type: 'button', 'data-app': a.id, onclick: () => this.launch(a.id) }, h('span', { html: iconSvg(a.icon, 28) }), h('small', null, t(a.name))))));
  }

  launch(id: App): void {
    if (id === 'paint') return this.handlers.paint();
    // the games and the maps open over the room: the desktop steps aside
    if (id === 'games' || id === 'maps') {
      this.close();
      return id === 'maps' ? this.handlers.maps() : this.handlers.games();
    }
    this.app = id;
    const win = (title: string, ...kids: (HTMLElement | null)[]) =>
      h('div', { class: 'pc-window' }, h('div', { class: 'pc-title' }, h('b', null, title), h('button', { class: 'pc-x', type: 'button', 'aria-label': t('media.desktop.closeWindow'), onclick: () => this.home() }, '×')), ...kids);
    if (id === 'diary') {
      const text = h('textarea', { class: 'pc-diary', rows: 9, spellcheck: false }) as HTMLTextAreaElement;
      text.value = readLocal('teul.pc.diary') ?? '';
      if (!text.value.includes(this.handlers.today())) text.value = `${text.value ? `${text.value}\n\n` : ''}${this.handlers.today()}\n`;
      text.addEventListener('input', () => writeLocal('teul.pc.diary', text.value));
      this.screen.replaceChildren(win(t('media.desktop.diary'), text));
      text.focus();
    } else if (id === 'wiki') this.screen.replaceChildren(win(t('media.desktop.wikiTitle'), this.wiki()));
    else if (id === 'weather') {
      const w = this.handlers.weather();
      this.screen.replaceChildren(win(t('media.desktop.weather'), h('div', { class: 'pc-weather' }, h('p', null, h('b', null, t('media.desktop.now')), w.now), h('p', null, h('b', null, t('media.desktop.tomorrow')), w.next))));
    } else if (id === 'mines') this.screen.replaceChildren(win(t('media.desktop.mines'), this.mines()));
    else if (id === 'composer') this.screen.replaceChildren(win(t('media.desktop.composer'), this.composer()));
  }

  private wiki(): HTMLElement {
    const entries = this.handlers.wiki();
    const list = h('div', { class: 'pc-wiki' });
    const show = (kind: WikiEntry['kind']) =>
      list.replaceChildren(...entries.filter((e) => e.kind === kind).map((e) => h('details', null, h('summary', null, e.name), h('p', null, e.text))));
    show('place');
    return h('div', null, h('div', { class: 'pc-tabs' },
      h('button', { class: 'chip', type: 'button', onclick: () => show('place') }, t('media.desktop.places')),
      h('button', { class: 'chip', type: 'button', onclick: () => show('person') }, t('media.desktop.people'))), list);
  }

  private mines(): HTMLElement {
    let m: Mines = newMines(9, 9, 10, Date.now() & 0xffff);
    let flagging = false;
    const grid = h('div', { class: 'pc-mines' });
    const face = h('button', { class: 'chip', type: 'button', onclick: () => {
      m = newMines(9, 9, 10, Date.now() & 0xffff);
      paint();
    } }, '🙂');
    const flagBtn = h('button', { class: 'chip', type: 'button', onclick: () => {
      flagging = !flagging;
      flagBtn.classList.toggle('on', flagging);
    } }, '⚑');
    const paint = () => {
      face.textContent = m.lost ? '😵' : won(m) ? '😎' : '🙂';
      grid.replaceChildren(...m.open.map((_, i) => {
        const x = i % m.w;
        const y = Math.floor(i / m.w);
        const open = m.open[i];
        const n = open && !m.mine[i] ? near(m, i) : 0;
        const cell = h('button', { class: `mc${open ? ' open' : ''}${open && m.mine[i] ? ' boom' : ''} n${n}`, type: 'button' }, open ? (m.mine[i] ? '✹' : n ? String(n) : '') : m.flag[i] ? '⚑' : '');
        cell.addEventListener('click', () => {
          m = flagging ? toggleFlag(m, x, y) : reveal(m, x, y);
          paint();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          m = toggleFlag(m, x, y);
          paint();
        });
        return cell;
      }));
    };
    paint();
    return h('div', null, h('div', { class: 'pc-tabs' }, face, flagBtn), grid);
  }

  private composer(): HTMLElement {
    let pattern: Pattern = unpackPattern(readLocal('teul.pc.pattern'));
    let kit: KitId = (readLocal('teul.pc.kit') as KitId) in KITS ? (readLocal('teul.pc.kit') as KitId) : 'piano';
    const grid = h('div', { class: 'pc-seq' });
    const cells: HTMLElement[][] = [];
    for (let r = ROWS.length - 1; r >= 0; r--) {
      const row: HTMLElement[] = [];
      for (let s = 0; s < STEPS; s++) {
        const c = h('button', { class: `sq${pattern[r][s] ? ' on' : ''}${s % 4 === 0 ? ' beat' : ''}`, type: 'button' });
        c.addEventListener('click', () => {
          pattern[r][s] = !pattern[r][s];
          c.classList.toggle('on', pattern[r][s]);
          writeLocal('teul.pc.pattern', packPattern(pattern));
          if (pattern[r][s]) this.sampler?.note(ROWS[r], 0.4, 0.7);
        });
        row[s] = c;
        grid.append(c);
      }
      cells[r] = row;
    }
    const kits = h('select', { class: 'pc-kit' }) as HTMLSelectElement;
    for (const k of Object.values(KITS)) kits.append(h('option', { value: k.id }, k.name));
    kits.value = kit;
    const useKit = () => {
      this.stopMusic();
      const out = this.handlers.audio();
      this.sampler = out ? new Sampler(out, KITS[kit]) : null;
      void this.sampler?.ready();
    };
    kits.addEventListener('change', () => {
      kit = kits.value as KitId;
      writeLocal('teul.pc.kit', kit);
      useKit();
    });
    useKit();
    const play = h('button', { class: 'chip', type: 'button', onclick: () => {
      if (this.loop) return this.stopMusic();
      const bpm = 108;
      const lap = (STEPS * 60) / bpm / 2;
      let step = 0;
      const go = () => {
        for (const n of patternNotes(pattern, bpm)) this.sampler?.note(n.key, n.len, 0.75, n.t);
      };
      go();
      this.loop = window.setInterval(go, lap * 1000);
      const show = window.setInterval(() => {
        if (!this.loop) return window.clearInterval(show);
        cells.forEach((row) => row.forEach((c, s) => c.classList.toggle('now', s === step)));
        step = (step + 1) % STEPS;
      }, (lap / STEPS) * 1000);
    } }, '▶ / ■');
    const clear = h('button', { class: 'chip', type: 'button', onclick: () => {
      pattern = unpackPattern(null);
      writeLocal('teul.pc.pattern', packPattern(pattern));
      cells.forEach((row) => row.forEach((c) => c.classList.remove('on')));
    } }, t('media.desktop.clear'));
    return h('div', null, h('div', { class: 'pc-tabs' }, kits, play, clear), grid);
  }

  private stopMusic(): void {
    window.clearInterval(this.loop);
    this.loop = 0;
    this.sampler?.stop();
  }
}
