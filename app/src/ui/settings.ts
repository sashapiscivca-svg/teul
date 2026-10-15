import { chooseLang, lang, t, type Lang } from '../i18n';
import { iconSvg } from '../icons';
import { usesMouse } from '../platform';
import type { KeyAction, Prefs } from '../prefs';

/** Keys that keep their own work (walking, the place's buttons, back, the whole screen): not given to anything else. */
const RESERVED = /^(Key[WASD]|Arrow(Up|Down|Left|Right)|Digit[1-9]|Numpad[1-9]|KeyI|Escape|F11|Enter|Tab|Meta(Left|Right)|Control(Left|Right)|BracketLeft|BracketRight)$/;

/** A key as it is written on the keyboard. */
export function keyName(code: string): string {
  if (code === 'Space') return '␣';
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  if (m) return m[1];
  return ({ ShiftLeft: 'Shift', ShiftRight: 'Shift ⇢', AltLeft: 'Alt', AltRight: 'Alt Gr', Backspace: '⌫', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' } as Record<string, string>)[code] ?? code;
}
import { clear, h } from './dom';

export interface SettingsHandlers {
  onChange(prefs: Prefs): void;
  onExit?(): void;
  /** Another language was chosen: save and draw everything again in it (default: reload the page). */
  onLang?(next: Lang): void;
}

/** Each language named in its own words. */
const LANG_NAMES: [Lang, string][] = [
  ['uk', 'Українська'],
  ['en', 'English'],
];

/** Sound, comfort, accessibility and performance settings of this device, and the language. */
export class SettingsPanel {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private prefs: Prefs;
  /** Rows of their own (the backup: main.ts). */
  private readonly actions: [string, () => void][] = [];

  constructor(parent: HTMLElement, prefs: Prefs, private readonly handlers: SettingsHandlers) {
    this.prefs = { ...prefs };
    this.body = h('div', { class: 'settings-body' });
    this.root = h(
      'div',
      { class: 'settings prefs-sheet', role: 'dialog', 'aria-label': t('settings.title') },
      h('div', { class: 'settings-card' }, h('div', { class: 'ph' }, h('b', null, t('settings.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('settings.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.body),
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

  open(): void {
    this.render();
    this.root.style.display = '';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  /** The preferences changed elsewhere (a key for the full screen): shown as they are now. */
  sync(prefs: Prefs): void {
    // what this sheet itself just changed comes back here too: drawing the sheet again then would pull a slider
    // out from under the finger that is moving it
    const same = JSON.stringify(prefs) === JSON.stringify(this.prefs);
    this.prefs = { ...prefs };
    if (this.isOpen() && !same) this.render();
  }

  /** A button row of its own, above the way out. */
  addAction(label: string, run: () => void): void {
    this.actions.push([label, run]);
  }

  private set(patch: Partial<Prefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    this.handlers.onChange(this.prefs);
    this.render();
  }

  private setLang(next: Lang): void {
    if (next === lang()) return;
    if (this.handlers.onLang) this.handlers.onLang(next);
    else {
      chooseLang(next);
      location.reload();
    }
  }

  private slider(label: string, key: 'master' | 'music' | 'effects' | 'ambience'): HTMLElement {
    const percent = Math.round(this.prefs[key] * 100);
    const input = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(percent), 'aria-label': label, 'aria-valuetext': `${percent}%`, 'data-pref': key }) as HTMLInputElement;
    const shown = h('span', { class: 'value' }, `${percent}%`);
    const fill = (v: number) => input.style.setProperty('--fill', `${v}%`);
    fill(percent);
    // every step of the hand, at once: the number, the filled part of the track, the sound
    input.addEventListener('input', () => {
      const v = Number(input.value);
      shown.textContent = `${v}%`;
      input.setAttribute('aria-valuetext', `${v}%`);
      fill(v);
      this.prefs = { ...this.prefs, [key]: v / 100 };
      this.handlers.onChange(this.prefs);
    });
    return h('label', { class: 'row slider-row' }, h('span', { class: 'label' }, label), input, shown);
  }

  private chips<T>(label: string, options: [T, string][], current: T, pick: (value: T) => void, id: string): HTMLElement {
    const group = h(
      'div',
      { class: 'group', role: 'radiogroup', 'aria-label': label },
      ...options.map(([value, text], i) =>
        h('button', { class: `chip ${current === value ? 'on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(current === value), 'data-pref': `${id}:${i}`, onclick: () => {
          pick(value);
          // the sheet is drawn again: the focus stays on the choice just made (keyboard and screen reader users keep their place)
          this.body.querySelector<HTMLElement>(`[data-pref="${id}:${i}"]`)?.focus();
        } }, text),
      ),
    );
    return h('div', { class: 'row' }, h('span', { class: 'label' }, label), group);
  }

  private choice<T extends string | number | boolean>(label: string, key: keyof Prefs, options: [T, string][]): HTMLElement {
    return this.chips(label, options, this.prefs[key] as T, (value) => this.set({ [key]: value } as Partial<Prefs>), String(key));
  }

  private onOff(label: string, key: 'contrast' | 'colorblind' | 'bigTargets' | 'readable' | 'captions' | 'fullscreen' | 'keyHints'): HTMLElement {
    return this.choice(label, key, [[true, t('settings.yes')], [false, t('settings.no')]]);
  }

  /** A group of rows under its heading (on a wide screen the groups stand side by side). */
  private section(key: string, ...rows: HTMLElement[]): HTMLElement {
    return h('section', { class: 'settings-section' }, h('h3', { class: 'settings-group' }, t(key)), ...rows);
  }

  /** The keys of the game, for a computer: the ones one may set (a press on the key, then the new key), and the
   * fixed ones. */
  private keys(): HTMLElement {
    const k = this.prefs.keys;
    const own: [KeyAction, string, string][] = [
      ['act', t('settings.keyAct'), 'Enter'],
      ['jump', t('settings.keyJump'), ''],
      ['crouch', t('settings.keyCrouch'), 'Ctrl'],
      ['turnLeft', t('settings.keyTurnLeft'), '['],
      ['turnRight', t('settings.keyTurnRight'), ']'],
      ['map', t('settings.keyMap'), ''],
      ['swap', t('settings.keySwap'), ''],
    ];
    const fixed: [string, string][] = [
      ['W A S D · ← ↑ → ↓', t('settings.keyWalk')],
      ['1 – 9', t('settings.keyHotbar')],
      ['I', t('settings.keyInventory')],
      ['Alt + 1 – 8', t('settings.keyPlace')],
      ['F11', t('settings.keyFull')],
      ['Esc', t('settings.keyBack')],
    ];
    return h('dl', { class: 'settings-keys' },
      ...own.flatMap(([action, what, also]) => [
        h('dt', null,
          h('button', { class: 'key-set', type: 'button', 'data-key': action, 'aria-label': t('settings.keySet', { what }), onclick: (e: Event) => this.listenKey(action, e.currentTarget as HTMLButtonElement) }, keyName(k[action])),
          also ? h('span', { class: 'key-also' }, ` · ${also}`) : null),
        h('dd', null, what)]),
      ...fixed.flatMap(([key, what]) => [h('dt', null, h('kbd', null, key)), h('dd', null, what)]));
  }

  /** Waits for the next key and gives it to an action (the one that had it takes this one's old key). */
  private listenKey(action: KeyAction, btn: HTMLButtonElement): void {
    btn.textContent = t('settings.keyPress');
    btn.classList.add('listening');
    const take = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.removeEventListener('keydown', take, true);
      if (e.code === 'Escape' || RESERVED.test(e.code)) {
        this.render();
        return;
      }
      const keys = { ...this.prefs.keys };
      const other = (Object.keys(keys) as KeyAction[]).find((a) => a !== action && keys[a] === e.code);
      if (other) keys[other] = keys[action];
      keys[action] = e.code;
      this.set({ keys });
    };
    window.addEventListener('keydown', take, true);
  }

  private render(): void {
    clear(this.body);
    const mouse = usesMouse();
    this.root.classList.toggle('wide', mouse);
    const language = this.section('settings.groupLanguage', this.chips(t('settings.language'), LANG_NAMES, lang(), (l) => this.setLang(l), 'lang'));
    const sound = this.section(
      'settings.groupSound',
      this.slider(t('settings.master'), 'master'),
      this.slider(t('settings.music'), 'music'),
      this.slider(t('settings.effects'), 'effects'),
      this.slider(t('settings.ambience'), 'ambience'),
    );
    const access = this.section(
      'settings.groupAccess',
      this.choice(t('settings.textSize'), 'textSize', [[0, t('settings.text0')], [1, t('settings.text1')], [2, t('settings.text2')]]),
      this.onOff(t('settings.contrast'), 'contrast'),
      this.choice(t('settings.motion'), 'motion', [['auto', t('settings.motionAuto')], ['reduce', t('settings.motionReduce')], ['full', t('settings.motionFull')]]),
      this.onOff(t('settings.colorblind'), 'colorblind'),
      // with a mouse there is nothing to hit with a finger
      ...(mouse ? [] : [this.onOff(t('settings.bigTargets'), 'bigTargets')]),
      this.onOff(t('settings.readable'), 'readable'),
      this.onOff(t('settings.captions'), 'captions'),
    );
    const controls = this.section(
      'settings.groupControls',
      // a computer neither vibrates nor has a joystick on its screen; it has a whole screen and keys
      ...(mouse
        ? [this.onOff(t('settings.fullscreen'), 'fullscreen')]
        : [this.choice(t('settings.haptics'), 'haptics', [[true, t('settings.yes')], [false, t('settings.no')]]), this.choice(t('settings.stick'), 'stick', [['left', t('settings.left')], ['right', t('settings.right')]])]),
      this.choice(t('settings.hudSize'), 'hudSize', [[0, t('settings.small')], [1, t('settings.normal')], [2, t('settings.large')]]),
      this.choice(t('settings.quality'), 'quality', [['auto', t('settings.auto')], ['high', t('settings.high')], ['low', t('settings.low')]]),
      this.choice(t('settings.horror'), 'horror', [[false, t('settings.horrorOff')], [true, t('settings.horrorOn')]]),
    );
    // on a wide screen two columns of about the same height, each filled from the top (no gaps between groups);
    // on a phone one after another
    if (mouse) this.body.append(h('div', { class: 'settings-col' }, language, sound, controls), h('div', { class: 'settings-col' }, access, this.section('settings.groupKeys', this.keys(), this.onOff(t('settings.keyHints'), 'keyHints'))));
    else this.body.append(language, sound, access, controls);
    for (const [label, run] of this.actions) this.body.append(h('div', { class: 'row' }, h('span', { class: 'label' }, label), h('button', { class: 'chip settings-action', type: 'button', onclick: () => run() }, t('settings.open'))));
    const exit = this.handlers.onExit;
    if (exit) this.body.append(h('div', { class: 'exit-row' }, h('button', { class: 'cta muted', type: 'button', onclick: () => exit() }, t('settings.exit'))));
  }
}
