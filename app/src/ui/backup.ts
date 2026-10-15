// «Резервна копія»: the whole world in a file under the player's passphrase (to keep, or to carry to another
// device), opening such a file here, the automatic copies of the last days, and the worlds on this device.

import { iconSvg } from '../icons';
import { clear, h } from './dom';
import { t } from '../i18n';

export interface OpenedBackup {
  /** When the copy was made (ISO), and by which version. */
  made: string;
  app: string;
  /** The same world as the one open here (then only replacing makes sense). */
  sameWorld: boolean;
}

export interface BackupHandlers {
  /** Seals the world under the passphrase and hands the file to the platform; false when the player cancelled. */
  save(passphrase: string): Promise<boolean>;
  pick(): Promise<Uint8Array | null>;
  /** Opens a picked file (throws a `BackupError` with the reason when it cannot). */
  open(file: Uint8Array, passphrase: string): Promise<OpenedBackup>;
  /** What to do with the opened copy: in place of this world, or beside it. */
  replace(): Promise<void>;
  keepBoth(): Promise<void>;
  daily(): Promise<string[]>;
  restoreDaily(day: string): Promise<void>;
  worlds(): { id: string; name: string; active: boolean }[];
  switchTo(id: string): void;
  /** The words for a failure. */
  explain(err: unknown): string;
}


export function dayText(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return t('photo.date', { day: d.getDate(), month: t('photo.months').split('\n')[d.getMonth()], year: d.getFullYear() });
}

export class BackupSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private picked: Uint8Array | null = null;

  constructor(parent: HTMLElement, private readonly handlers: BackupHandlers) {
    this.body = h('div', { class: 'settings-body backup-body' });
    this.root = h(
      'div',
      { class: 'settings backup', role: 'dialog', 'aria-label': t('backup.title') },
      h('div', { class: 'settings-card' }, h('div', { class: 'ph' }, h('b', null, t('backup.title')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })), this.body),
    );
    this.root.style.display = 'none';
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    // typing a passphrase never walks the hero
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
    this.root.addEventListener('keyup', (e) => e.stopPropagation());
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(): void {
    this.picked = null;
    this.render();
    this.root.style.display = '';
  }

  close(): void {
    this.root.style.display = 'none';
  }

  private render(): void {
    clear(this.body);
    this.body.append(this.saveBlock(), this.openBlock(), this.dailyBlock());
    const ws = this.handlers.worlds();
    if (ws.length > 1) this.body.append(this.worldsBlock(ws));
  }

  private saveBlock(): HTMLElement {
    const pass = h('input', { type: 'password', class: 'backup-pass', autocomplete: 'new-password', placeholder: t('backup.pass'), 'aria-label': t('backup.pass') }) as HTMLInputElement;
    const again = h('input', { type: 'password', class: 'backup-pass2', autocomplete: 'new-password', placeholder: t('backup.again'), 'aria-label': t('backup.againLabel') }) as HTMLInputElement;
    const said = h('p', { class: 'friend-hint backup-said' });
    const go = h('button', { class: 'cta backup-save', type: 'button' }, t('backup.save')) as HTMLButtonElement;
    go.onclick = async () => {
      if (pass.value.length < 8) {
        said.textContent = t('backup.short');
        return;
      }
      if (pass.value !== again.value) {
        said.textContent = t('backup.mismatch');
        return;
      }
      go.disabled = true;
      said.textContent = t('backup.sealing');
      try {
        const saved = await this.handlers.save(pass.value);
        said.textContent = saved ? t('backup.saved') : t('backup.notSaved');
        if (saved) pass.value = again.value = '';
      } catch (e) {
        said.textContent = this.handlers.explain(e);
      } finally {
        go.disabled = false;
      }
    };
    return h('section', { class: 'backup-block' },
      h('b', null, t('backup.toFile')),
      h('p', { class: 'friend-hint' }, t('backup.toFileHint')),
      h('div', { class: 'backup-row' }, pass, again),
      h('div', { class: 'friend-actions' }, go),
      said,
    );
  }

  private openBlock(): HTMLElement {
    const said = h('p', { class: 'friend-hint backup-open-said' });
    const pass = h('input', { type: 'password', class: 'backup-open-pass', autocomplete: 'current-password', placeholder: t('backup.copyPass'), 'aria-label': t('backup.copyPass') }) as HTMLInputElement;
    const step2 = h('div', { class: 'backup-step2' });
    step2.style.display = 'none';
    const choose = h('div', { class: 'backup-choose' });
    const pickBtn = h('button', { class: 'cta muted backup-pick', type: 'button' }, t('backup.pick')) as HTMLButtonElement;
    pickBtn.onclick = async () => {
      clear(choose);
      const f = await this.handlers.pick().catch(() => null);
      if (!f) return;
      this.picked = f;
      step2.style.display = '';
      said.textContent = t('backup.picked');
      pass.focus();
    };
    const openBtn = h('button', { class: 'cta backup-open', type: 'button' }, t('backup.open')) as HTMLButtonElement;
    openBtn.onclick = async () => {
      if (!this.picked) return;
      openBtn.disabled = true;
      said.textContent = t('backup.opening');
      clear(choose);
      try {
        const o = await this.handlers.open(this.picked, pass.value);
        said.textContent = t(o.sameWorld ? 'backup.copyOfSame' : 'backup.copyOf', { day: dayText(o.made) });
        choose.append(this.choices(o, said));
      } catch (e) {
        said.textContent = this.handlers.explain(e);
      } finally {
        openBtn.disabled = false;
      }
    };
    step2.append(h('div', { class: 'backup-row' }, pass), h('div', { class: 'friend-actions' }, openBtn));
    return h('section', { class: 'backup-block' },
      h('b', null, t('backup.openCopy')),
      h('div', { class: 'friend-actions' }, pickBtn),
      step2,
      said,
      choose,
    );
  }

  /** Replace this world, or keep both — each asks once more, plainly. */
  private choices(o: OpenedBackup, said: HTMLElement): HTMLElement {
    const box = h('div', { class: 'backup-choices' });
    const ask = (text: string, yes: string, run: () => Promise<void>) => {
      clear(box);
      const go = h('button', { class: 'cta backup-yes', type: 'button' }, yes) as HTMLButtonElement;
      go.onclick = async () => {
        go.disabled = true;
        said.textContent = t('backup.moving');
        try {
          await run();
        } catch (e) {
          said.textContent = this.handlers.explain(e);
          go.disabled = false;
        }
      };
      box.append(h('p', { class: 'backup-confirm' }, text), h('div', { class: 'friend-actions' }, go, h('button', { class: 'cta muted backup-no', type: 'button', onclick: () => {
        clear(box);
        box.append(this.choices(o, said));
      } }, t('backup.noBack'))));
    };
    const replace = h('button', { class: 'cta backup-replace', type: 'button', onclick: () => ask(t('backup.replaceAsk'), t('backup.replaceYes'), () => this.handlers.replace()) }, t('backup.replace'));
    box.append(replace);
    if (!o.sameWorld) box.append(h('button', { class: 'cta muted backup-both', type: 'button', onclick: () => ask(t('backup.bothAsk'), t('backup.bothYes'), () => this.handlers.keepBoth()) }, t('backup.both')));
    return box;
  }

  private dailyBlock(): HTMLElement {
    const list = h('div', { class: 'backup-daily' });
    const said = h('p', { class: 'friend-hint' });
    void this.handlers.daily().then((days) => {
      if (days.length === 0) {
        list.append(h('p', { class: 'friend-hint' }, t('backup.firstDaily')));
        return;
      }
      for (const day of [...days].reverse()) {
        list.append(h('div', { class: 'row' }, h('span', { class: 'label' }, dayText(day)), h('button', { class: 'chip', type: 'button', onclick: () => {
          clear(list);
          const yes = h('button', { class: 'cta backup-yes', type: 'button' }, t('backup.restoreYes')) as HTMLButtonElement;
          yes.onclick = async () => {
            yes.disabled = true;
            said.textContent = t('backup.restoring');
            try {
              await this.handlers.restoreDaily(day);
            } catch (e) {
              said.textContent = this.handlers.explain(e);
            }
          };
          list.append(h('p', { class: 'backup-confirm' }, t('backup.restoreAsk', { day: dayText(day) })), h('div', { class: 'friend-actions' }, yes, h('button', { class: 'cta muted', type: 'button', onclick: () => this.render() }, t('backup.no'))));
        } }, t('backup.restore'))));
      }
    });
    return h('section', { class: 'backup-block' },
      h('b', null, t('backup.daily')),
      h('p', { class: 'friend-hint' }, t('backup.dailyHint')),
      list,
      said,
    );
  }

  private worldsBlock(ws: { id: string; name: string; active: boolean }[]): HTMLElement {
    return h('section', { class: 'backup-block backup-worlds' },
      h('b', null, t('backup.worlds')),
      ...ws.map((w) => h('div', { class: 'row' }, h('span', { class: 'label' }, w.name), w.active ? h('span', { class: 'friend-hint' }, t('backup.active')) : h('button', { class: 'chip', type: 'button', onclick: () => this.handlers.switchTo(w.id) }, t('backup.open')))),
    );
  }
}
