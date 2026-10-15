import { iconSvg } from '../icons';
import { joystickVector, type Push } from '../input';
import { t } from '../i18n';
import type { WalletView } from '../types';
import { clear, h } from './dom';

export interface HudHandlers {
  onEdit(): void;
  onShop(): void;
  onAction(): void;
  /** A hop up on the spot (or along, while walking). */
  onJump(): void;
  /** Down on one's heels, or up again. */
  onCrouch(): void;
  /** A place at hand chosen (0–8). */
  onSlot?(n: number): void;
  /** The left hand tapped: the hands change their things. */
  onSwap?(): void;
  onTurn(dir: 1 | -1): void;
  onSettings(): void;
  onRoom(dir: 1 | -1): void;
  onPeople(): void;
  onToday(): void;
  onPhoto(): void;
  onPocket(): void;
  /** The notebook of promises. */
  onJournal(): void;
  onTaxi(): void;
  /** One's own smartphone (shown once one has it). */
  onPhone?(): void;
  /** Takes out an instrument and plays in the street. */
  onBusk(): void;
  /** One's own name and who walks along. */
  onMe(): void;
  /** The cars to buy. */
  onCars(): void;
  /** The folded paper map. */
  onMap(): void;
}

const STICK_RADIUS = 52;

/** A button that answers the moment a finger touches it: a tap while another finger holds the stick makes no click
 * (the phone takes the two for a gesture), so the hop, the crouch, the action and the places at hand go by the touch
 * itself; a key (Enter, Space on a focused button) still clicks. */
function onPress(el: HTMLElement, fn: () => void): HTMLElement {
  let at = -1e9;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (el as HTMLButtonElement).disabled) return;
    at = performance.now();
    fn();
  });
  el.addEventListener('click', () => {
    if (performance.now() - at < 700) return;
    fn();
  });
  return el;
}

/** The in-game overlay: clock, wallet, buttons, joystick and the contextual action button. */
export class Hud {
  readonly root: HTMLElement;
  private readonly timeText: HTMLElement;
  private readonly timeIcon: HTMLElement;
  private readonly seasonText: HTMLElement;
  private readonly wallet: HTMLElement;
  private readonly todayBtn: HTMLButtonElement;
  private readonly pocketBtn: HTMLButtonElement;
  private readonly pocketNum: HTMLElement;
  private readonly questLine: HTMLButtonElement;
  private readonly taxiBtn: HTMLButtonElement;
  private readonly phoneBtn: HTMLButtonElement;
  private readonly buskBtn: HTMLButtonElement;
  private readonly badge: HTMLElement;
  private readonly walkLayer: HTMLElement;
  private readonly actionBtn: HTMLButtonElement;
  private readonly menu: HTMLElement;
  private readonly menuBtn: HTMLButtonElement;
  private readonly rotBar: HTMLElement;
  private readonly actionLabel: HTMLElement;
  /** What the place one is in offers (a shop's wares, a job, a service), without walking up to its things. */
  private readonly placeBar: HTMLElement;
  private placeKey = '';
  private readonly knob: HTMLElement;
  private readonly stick: HTMLElement;
  private pointerId: number | null = null;
  private current: Push = { x: 0, y: 0, mag: 0 };

  private toggleMenu(): void {
    const open = this.menu.style.display === 'none';
    this.menu.style.display = open ? '' : 'none';
    this.menuBtn.classList.toggle('active', open);
    this.menuBtn.setAttribute('aria-expanded', String(open));
  }

  closeMenu(): void {
    this.menu.style.display = 'none';
    this.menuBtn.classList.remove('active');
    this.menuBtn.setAttribute('aria-expanded', 'false');
  }

  constructor(parent: HTMLElement, private readonly handlers: HudHandlers) {
    this.timeIcon = h('span', { class: 'ico' });
    this.timeText = h('span', { class: 'time' });
    this.seasonText = h('span', { class: 'season' });
    this.wallet = h('div', { class: 'pill wallet' });
    this.badge = h('span', { class: 'badge' });
    this.todayBtn = h('button', { class: 'round today-btn', type: 'button', 'aria-label': t('hud.paperAndMail'), html: iconSvg('mail', 24), onclick: () => handlers.onToday() });
    this.todayBtn.append(this.badge);
    this.pocketNum = h('span', { class: 'pocket-num' });
    this.pocketBtn = h('button', { class: 'round hud-pocket', type: 'button', 'aria-label': t('hud.pocket'), html: iconSvg('pouch', 24), onclick: () => handlers.onPocket() });
    this.pocketBtn.append(this.pocketNum);
    this.buskBtn = h('button', { class: 'round hud-busk', type: 'button', 'aria-label': t('hud.busk'), html: iconSvg('play_music', 24), onclick: () => handlers.onBusk() });
    this.buskBtn.style.display = 'none';
    const labelled = (cls: string, label: string, short: string, icon: string, go: () => void) => {
      const b = h('button', { class: `round tile ${cls}`, type: 'button', 'aria-label': label, onclick: () => { this.closeMenu(); go(); } });
      b.innerHTML = iconSvg(icon, 24);
      b.append(h('span', { class: 'tile-label' }, short));
      return b;
    };
    this.taxiBtn = labelled('hud-taxi', t('hud.callTaxi'), t('hud.taxi'), 'taxi', () => handlers.onTaxi());
    this.phoneBtn = labelled('hud-phone', t('hud.phone'), t('hud.phone'), 'phone', () => handlers.onPhone?.());
    this.phoneBtn.style.display = 'none';

    // the clock with the air's temperature (and the network's state, small), the promise one follows under it
    const topLeft = h('div', { class: 'hud-tl pill' }, this.timeIcon, this.timeText, this.seasonText);
    this.questLine = h('button', { class: 'hud-quest', type: 'button', onclick: () => handlers.onJournal() });
    this.questLine.style.display = 'none';
    // everything that is not needed every minute folds into one menu of labelled tiles
    const tile = (cls: string, label: string, icon: string, go: () => void, extra?: HTMLElement) => {
      const b = h('button', { class: `round tile ${cls}`, type: 'button', 'aria-label': label, onclick: () => { this.closeMenu(); go(); } });
      b.innerHTML = iconSvg(icon, 24);
      b.append(h('span', { class: 'tile-label' }, label));
      if (extra) b.append(extra);
      return b;
    };
    this.menu = h(
      'div',
      { class: 'hud-menu', role: 'menu' },
      tile('hud-photo', t('hud.photo'), 'camera', () => handlers.onPhoto()),
      this.taxiBtn,
      this.phoneBtn,
      tile('hud-me', t('hud.me'), 'person', () => handlers.onMe()),
      tile('hud-map', t('hud.map'), 'map', () => handlers.onMap()),
      tile('hud-cars', t('hud.cars'), 'taxi', () => handlers.onCars()),
      tile('hud-people', t('hud.residents'), 'people', () => handlers.onPeople()),
      tile('hud-journal', t('hud.journal'), 'paper', () => handlers.onJournal()),
      tile('hud-settings', t('hud.settings'), 'gear', () => handlers.onSettings()),
      tile('hud-shop', t('ui.shop'), 'bag', () => handlers.onShop()),
      tile('hud-edit', t('ui.room'), 'edit', () => handlers.onEdit()),
    );
    this.menu.style.display = 'none';
    this.menuBtn = h('button', { class: 'round hud-menu-btn', type: 'button', 'aria-label': t('hud.menu'), 'aria-expanded': 'false', html: iconSvg('menu', 24), onclick: () => this.toggleMenu() });
    const topRight = h('div', { class: 'hud-tr' }, this.wallet, this.buskBtn, this.pocketBtn, this.todayBtn, this.menuBtn, this.menu);
    // turning the view: two small buttons by the action button, where the thumb already is
    this.rotBar = h(
      'div',
      { class: 'hud-rot' },
      h('button', { class: 'round small', type: 'button', 'aria-label': t('hud.turnLeft'), html: iconSvg('rotate', 20), onclick: () => handlers.onTurn(-1) }),
      h('button', { class: 'round small flip', type: 'button', 'aria-label': t('hud.turnRight'), html: iconSvg('rotate', 20), onclick: () => handlers.onTurn(1) }),
    );
    document.addEventListener('pointerdown', (e) => {
      if (this.menu.style.display !== 'none' && !this.menu.contains(e.target as Node) && !this.menuBtn.contains(e.target as Node)) this.closeMenu();
    });

    this.knob = h('div', { class: 'knob' });
    this.stick = h(
      'div',
      { class: 'stick', role: 'group', 'aria-label': t('hud.stick') },
      h('div', { class: 'ring' }),
      h('span', { class: 'tick up' }),
      h('span', { class: 'tick down' }),
      h('span', { class: 'tick left' }),
      h('span', { class: 'tick right' }),
      this.knob,
    );
    this.bindStick();

    this.actionLabel = h('span', { class: 'label' });
    this.actionBtn = h(
      'button',
      { class: 'action', type: 'button', disabled: true, 'aria-label': t('hud.action') },
      h('span', { class: 'glyph' }),
      this.actionLabel,
    );
    onPress(this.actionBtn, () => handlers.onAction());
    this.placeBar = h('div', { class: 'hud-place', role: 'toolbar', 'aria-label': t('hud.place') });
    // a hop and a crouch, always at hand beside the action button (on a computer: Space and C)
    this.crouchBtn = onPress(h('button', { class: 'round move-btn crouch', type: 'button', 'aria-label': t('hud.crouch'), 'aria-pressed': 'false', html: iconSvg('crouch', 22) }), () => handlers.onCrouch()) as HTMLButtonElement;
    const moves = h('div', { class: 'move-btns' },
      onPress(h('button', { class: 'round move-btn jump', type: 'button', 'aria-label': t('hud.jump'), html: iconSvg('jump', 22) }), () => handlers.onJump()),
      this.crouchBtn);
    // the nine places at hand, at the bottom (as in Minecraft): a turn of the wheel over them goes along
    this.hotbar = h('div', { class: 'hotbar', role: 'toolbar', 'aria-label': t('hud.hotbar') });
    this.hotbar.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onSlot?.((this.slot + (e.deltaY > 0 ? 1 : 8)) % 9);
    }, { passive: false });
    this.walkLayer = h('div', { class: 'walk-layer' }, this.stick, this.actionBtn, moves, this.placeBar, this.hotbar);

    this.roomName = h('span', { class: 'room-name' });
    this.roomBar = h(
      'div',
      { class: 'hud-room pill' },
      h('button', { class: 'room-step', type: 'button', 'aria-label': t('hud.prevRoom'), html: iconSvg('undo', 12), onclick: () => handlers.onRoom(-1) }),
      this.roomName,
      h('button', { class: 'room-step', type: 'button', 'aria-label': t('hud.nextRoom'), html: iconSvg('redo', 12), onclick: () => handlers.onRoom(1) }),
    );
    this.roomBar.style.display = 'none';
    this.root = h('div', { class: 'hud' }, topLeft, this.questLine, this.roomBar, topRight, this.rotBar, this.walkLayer);
    parent.append(this.root);
    this.setAction(null);
  }

  private bindStick(): void {
    const move = (e: PointerEvent) => {
      const r = this.stick.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      this.current = joystickVector(dx, dy, STICK_RADIUS);
      const len = Math.min(STICK_RADIUS, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      this.knob.style.transform = `translate(${Math.cos(a) * len}px, ${Math.sin(a) * len}px)`;
    };
    this.stick.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      try {
        this.stick.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable (synthetic pointer); the stick still works while the pointer stays over it.
      }
      this.stick.classList.add('held');
      move(e);
      e.preventDefault();
    });
    this.stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.current = { x: 0, y: 0, mag: 0 };
      this.knob.style.transform = 'translate(0, 0)';
      this.stick.classList.remove('held');
    };
    this.stick.addEventListener('pointerup', end);
    this.stick.addEventListener('pointercancel', end);
  }

  /** The current joystick push in screen space. */
  push(): Push {
    return this.current;
  }

  setMode(mode: 'walk' | 'edit'): void {
    this.walkLayer.style.display = mode === 'walk' ? '' : 'none';
    this.root.classList.toggle('editing', mode === 'edit');
  }

  private readonly roomName: HTMLElement;
  private readonly roomBar: HTMLElement;
  private roomKey = '';

  /** The name of the room being shown, with arrows to the others (hidden when the home has one room). */
  setRoom(name: string, index: number, count: number): void {
    const key = `${name}|${index}|${count}`;
    if (key === this.roomKey) return;
    this.roomKey = key;
    this.roomBar.style.display = count > 1 ? '' : 'none';
    this.roomName.textContent = index < 0 ? name : `${name} · ${index + 1}/${count}`;
  }

  /** The clock and the air out of doors (tenths of a degree, null while not known); the day's feast, if any.
   * The season is not named: the world shows it. */
  setTime(minuteOfDay: number, air: number | null, holiday?: string | null): void {
    const hh = String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(minuteOfDay % 60)).padStart(2, '0');
    this.timeText.textContent = air === null ? `${hh}:${mm}` : `${hh}:${mm} · ${degrees(air)}`;
    this.seasonText.textContent = holiday ?? '';
    this.seasonText.style.display = holiday ? '' : 'none';
    const hour = minuteOfDay / 60;
    const name = hour >= 21 || hour < 5 ? 'rest' : hour >= 17.5 ? 'sunset' : 'sun';
    this.timeIcon.innerHTML = iconSvg(name, 18, name === 'rest' ? '#9db2ff' : name === 'sunset' ? '#ff9a6a' : '#f4b860');
  }

  /** How many things today want attention (shown on the "Today" button; nothing at zero). */
  setToday(n: number): void {
    this.badge.textContent = n > 0 ? String(n) : '';
    this.badge.style.display = n > 0 ? '' : 'none';
  }

  /** The taxi can be called from anywhere out of the house. */
  /** An instrument to take out, out in the street. */
  setBusk(shown: boolean): void {
    this.buskBtn.style.display = shown ? '' : 'none';
  }

  setTaxi(shown: boolean): void {
    this.taxiBtn.style.display = shown ? '' : 'none';
  }

  /** One's own smartphone, once bought. */
  setPhone(shown: boolean): void {
    this.phoneBtn.style.display = shown ? '' : 'none';
  }

  /** The promise one follows, or nothing. */
  setQuest(line: string | null): void {
    this.questLine.textContent = line ?? '';
    this.questLine.style.display = line ? '' : 'none';
  }

  /** The pocket on the HUD: how full it is (red when nothing more fits). */
  setPocket(used: number, capacity: number): void {
    this.pocketNum.textContent = `${used}/${capacity}`;
    this.pocketNum.classList.toggle('full', used >= capacity);
  }

  /** The coins in the purse. */
  setWallet(w: WalletView): void {
    clear(this.wallet);
    this.wallet.insertAdjacentHTML('beforeend', iconSvg('coin', 18, '#f4b860'));
    this.wallet.append(h('b', null, String(w.coins)));
  }

  /** The buttons of the place one is in (redrawn only when they change; what they do is always the latest). */
  setPlace(items: { key: string; icon: string; label: string; run: () => void }[]): void {
    this.placeRuns = items.map((i) => i.run);
    const key = items.map((i) => `${i.key}:${i.icon}:${i.label}`).join('|');
    if (key === this.placeKey) return;
    this.placeKey = key;
    this.placeBar.replaceChildren(
      ...items.map((it, n) => {
        const b = h('button', { class: 'place-btn', type: 'button', 'data-place': it.key, 'aria-label': it.label, onclick: () => this.placeRuns[n]?.() });
        b.innerHTML = iconSvg(it.icon, 20);
        b.append(h('span', null, it.label));
        // its key on a computer (1–8)
        if (n < 8) b.append(h('kbd', { class: 'place-key' }, `Alt+${n + 1}`));
        return b;
      }),
    );
    this.placeBar.style.display = items.length ? '' : 'none';
  }

  private placeRuns: (() => void)[] = [];
  private readonly hotbar: HTMLElement;
  private slot = 0;
  private hotbarKey = '';

  /** The nine places at hand: what each holds (its picture and how many), and which one is in the hand; to their left,
   * the left hand. */
  setHotbar(slots: ({ item: string; n: number; name: string; thumb: () => HTMLCanvasElement } | null)[], chosen: number, off: { item: string; n: number; name: string; thumb: () => HTMLCanvasElement } | null = null): void {
    this.slot = chosen;
    const key = slots.map((s) => (s ? `${s.item}:${s.n}` : '-')).join('|') + `#${chosen}#${off ? `${off.item}:${off.n}` : '-'}`;
    if (key === this.hotbarKey) return;
    this.hotbarKey = key;
    const left = onPress(h('button', { class: 'hot-slot off', type: 'button', 'data-slot': 'off', 'aria-label': off ? `${t('pocket.offhand')}: ${off.name}` : t('pocket.offhand') }), () => this.handlers.onSwap?.());
    if (off) {
      const c = off.thumb();
      c.className = 'hot-thumb';
      left.append(c);
      if (off.n > 1) left.append(h('span', { class: 'hot-n' }, String(off.n)));
    }
    this.hotbar.replaceChildren(
      left,
      ...slots.map((s, i) => {
        const b = h('button', { class: `hot-slot${i === chosen ? ' on' : ''}`, type: 'button', 'data-slot': String(i), 'aria-label': s ? `${i + 1}: ${s.name}` : String(i + 1), 'aria-pressed': String(i === chosen) },
          h('span', { class: 'hot-num' }, String(i + 1)));
        onPress(b, () => this.handlers.onSlot?.(i));
        if (s) {
          const c = s.thumb();
          c.className = 'hot-thumb';
          b.append(c);
          if (s.n > 1) b.append(h('span', { class: 'hot-n' }, String(s.n)));
        }
        return b;
      }),
    );
  }
  private readonly crouchBtn: HTMLButtonElement;

  /** The keys written on the action, the hop and the crouch buttons (a computer's own, as set). */
  setKeys(act: string, jump: string, crouch: string): void {
    this.actionBtn.dataset.key = act;
    const [j, c] = [...this.root.querySelectorAll<HTMLElement>('.move-btn')];
    if (j) j.dataset.key = jump;
    if (c) c.dataset.key = crouch;
  }

  /** The crouch button shows whether one is down. */
  setCrouch(on: boolean): void {
    if (this.crouchBtn.classList.contains('on') === on) return;
    this.crouchBtn.classList.toggle('on', on);
    this.crouchBtn.setAttribute('aria-pressed', String(on));
  }

  /** The key of a place button pressed (1–8): true when there was one. */
  pressPlace(n: number): boolean {
    const run = this.placeRuns[n];
    if (!run) return false;
    (this.placeBar.children[n] as HTMLElement | undefined)?.classList.add('pressed');
    window.setTimeout(() => (this.placeBar.children[n] as HTMLElement | undefined)?.classList.remove('pressed'), 160);
    run();
    return true;
  }

  /** `null` dims the button; otherwise it shows the glyph of what pressing it would do. */
  setAction(a: { glyph: string; label: string } | null): void {
    const glyph = this.actionBtn.querySelector('.glyph') as HTMLElement;
    this.actionBtn.disabled = a === null;
    this.actionBtn.classList.toggle('ready', a !== null);
    glyph.innerHTML = iconSvg(a?.glyph ?? 'check', 30);
    this.actionLabel.textContent = a?.label ?? '';
    this.actionBtn.setAttribute('aria-label', a?.label ?? t('hud.action'));
  }
}

/** Tenths of a degree as the street thermometer shows it: «+7°», «0°», «−3°». */
export function degrees(tenths: number): string {
  const c = Math.round(tenths / 10);
  return c > 0 ? `+${c}°` : c < 0 ? `−${-c}°` : '0°';
}
