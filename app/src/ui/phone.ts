// One's own smartphone, once bought at the post office: the camera, the maps, a taxi, the weather, and a
// master to call home when something there is broken.

import { iconSvg } from '../icons';
import type { WearView } from '../types';
import { h } from './dom';
import { t } from '../i18n';

export interface PhoneDeps {
  camera(): void;
  taxi(): void;
  /** The day's weather, said in a few words. */
  weather(): string;
  /** What at home has aged (to call a master for), with names. */
  worn(): { view: WearView; name: string }[];
  callMaster(pid: number): void;
  /** «Мапи». */
  maps(): void;
  /** «Авто»: the cars to buy. */
  cars(): void;
}

export class PhoneSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement, private readonly deps: PhoneDeps) {
    this.body = h('div', { class: 'phone-body' });
    this.root = h(
      'div',
      { class: 'settings phone', role: 'dialog', 'aria-label': t('phone.title') },
      h('div', { class: 'settings-card phone-card' }, h('div', { class: 'ph' }, h('b', null, t('phone.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.body),
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

  open(): void {
    this.root.style.display = '';
    this.home();
  }

  private app(icon: string, label: string, run: () => void): HTMLElement {
    return h('button', { class: 'phone-app', type: 'button', onclick: run }, h('span', { class: 'phone-icon', html: iconSvg(icon, 26) }), h('span', null, label));
  }

  private home(): void {
    const d = this.deps;
    this.body.replaceChildren(
      h('div', { class: 'phone-apps' },
        this.app('photo', t('phone.camera'), () => { this.close(); d.camera(); }),
        this.app('map', t('phone.maps'), () => { this.close(); d.maps(); }),
        this.app('taxi', t('phone.taxi'), () => { this.close(); d.taxi(); }),
        this.app('taxi', t('phone.cars'), () => { this.close(); d.cars(); }),
        this.app('sun', t('phone.weather'), () => this.weather()),
        this.app('hammer', t('phone.master'), () => this.masters())),
    );
  }

  private back(): HTMLElement {
    return h('button', { class: 'chip', type: 'button', onclick: () => this.home() }, t('phone.back'));
  }

  private weather(): void {
    this.body.replaceChildren(h('p', { class: 'phone-line' }, this.deps.weather()), this.back());
  }

  private masters(): void {
    const worn = this.deps.worn().filter((w) => w.view.stage >= 2);
    const rows = worn.map((w) =>
      h('div', { class: 'phone-row' }, h('span', null, `${w.name}: ${w.view.looks}`), h('button', { class: 'cta', type: 'button', onclick: () => { this.deps.callMaster(w.view.pid); this.masters(); } }, t('phone.call', { fix: w.view.fix }))),
    );
    this.body.replaceChildren(...(rows.length ? rows : [h('p', { class: 'phone-line' }, t('phone.allWhole'))]), this.back());
  }
}
