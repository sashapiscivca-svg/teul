// Photo mode and the album. In photo mode the interface steps aside: the camera moves freely (drag, pinch,
// turn), a look can be chosen, the hero turns to the camera, in profile or away; the shutter keeps the picture
// in the album on this device. The album shows them with where and when, to look at, share or let go.

import { Capacitor } from '@capacitor/core';
import { iconSvg } from '../icons';
import { applyFilter, FILTERS, type Album, type PhotoEntry, type PhotoFilter, type PhotoMeta } from '../album';
import { h } from './dom';
import { isDesktop, saveFile } from '../platform';
import { fromB64 } from '../secure/seal';
import { t } from '../i18n';

export type Facing = 'down' | 'right' | 'up';

const CSS_LOOK: Record<PhotoFilter, string> = {
  plain: '',
  warm: 'sepia(0.22) saturate(1.15) brightness(1.03)',
  dusk: 'hue-rotate(-14deg) saturate(0.85) brightness(0.92)',
  bw: 'grayscale(1) contrast(1.05)',
  film: 'sepia(0.4) contrast(0.92) brightness(1.04)',
};


export function photoCaption(p: PhotoMeta): string {
  const d = new Date(p.taken);
  const date = t('photo.date', { day: d.getDate(), month: t('photo.months').split('\n')[d.getMonth()], year: d.getFullYear() });
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'].includes(p.season) ? t(`photo.season.${p.season}`) : p.season;
  return `${date} · ${p.place} · ${season}`;
}

/** Shares a picture (the phone's share sheet) or saves it (a download on the web). */
export async function sharePhoto(dataUrl: string, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const file = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1] ?? '', directory: Directory.Cache });
    await Share.share({ title: t('photo.shareTitle'), files: [file.uri] });
    return;
  }
  if (isDesktop()) {
    await saveFile(name, fromB64(dataUrl.split(',')[1] ?? ''), 'image/png');
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

/** The picture on the scene canvas, scaled down (crisp) and coloured by the look. */
export function capture(scene: HTMLCanvasElement, look: PhotoFilter, seed: number, maxSide = 1600): string {
  // shrink by a whole factor and average the pixels: picking one pixel of every few turns the town's dithered
  // shading into moiré stripes
  const step = Math.max(1, Math.ceil(Math.max(scene.width, scene.height) / maxSide));
  const w = Math.max(1, Math.floor(scene.width / step));
  const hgt = Math.max(1, Math.floor(scene.height / step));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const g = c.getContext('2d');
  if (!g) return scene.toDataURL('image/png');
  g.imageSmoothingEnabled = step > 1;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#0e0f1f';
  g.fillRect(0, 0, w, hgt);
  g.drawImage(scene, 0, 0, w, hgt);
  if (look !== 'plain') {
    const img = g.getImageData(0, 0, w, hgt);
    applyFilter(img.data, w, hgt, look, seed);
    g.putImageData(img, 0, 0);
  }
  // grain and gradients do not keep well in PNG: a careful JPEG for the looks, a crisp PNG as it is
  return look === 'plain' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
}

export interface PhotoHandlers {
  face(f: Facing): void;
  shoot(look: PhotoFilter): Promise<void>;
  openAlbum(): void;
  done(): void;
}

export class PhotoBar {
  readonly root: HTMLElement;
  private look: PhotoFilter = 'plain';
  private facing: Facing = 'down';
  private readonly looks: HTMLElement;
  private readonly faces: HTMLElement;
  private readonly flash: HTMLElement;

  constructor(parent: HTMLElement, private readonly scene: HTMLCanvasElement, private readonly handlers: PhotoHandlers) {
    this.looks = h('div', { class: 'photo-group' });
    this.faces = h('div', { class: 'photo-group' });
    this.flash = h('div', { class: 'photo-flash' });
    const shutter = h('button', { class: 'photo-shutter', type: 'button', 'aria-label': t('photo.shoot'), onclick: () => void this.shoot() });
    this.root = h('div', { class: 'photo-bar', role: 'toolbar', 'aria-label': t('photo.bar') },
      h('div', { class: 'photo-row' }, this.looks, this.faces),
      h('div', { class: 'photo-row main' },
        h('button', { class: 'cta muted', type: 'button', onclick: () => handlers.openAlbum() }, t('photo.album')),
        shutter,
        h('button', { class: 'cta muted', type: 'button', onclick: () => handlers.done() }, t('panels.done'))));
    this.root.style.display = 'none';
    parent.append(this.root, this.flash);
    this.render();
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  open(): void {
    this.root.style.display = '';
    this.apply();
  }

  close(): void {
    this.root.style.display = 'none';
    this.scene.style.filter = '';
  }

  private apply(): void {
    this.scene.style.filter = CSS_LOOK[this.look];
  }

  private render(): void {
    this.looks.replaceChildren(...FILTERS.map(([id, label]) => h('button', { class: `chip ${this.look === id ? 'on' : ''}`, type: 'button', onclick: () => { this.look = id; this.apply(); this.render(); } }, label)));
    const face = (id: Facing, label: string) => h('button', { class: `chip ${this.facing === id ? 'on' : ''}`, type: 'button', onclick: () => { this.facing = id; this.handlers.face(id); this.render(); } }, label);
    this.faces.replaceChildren(face('down', t('photo.front')), face('right', t('photo.profile')), face('up', t('photo.back')));
  }

  private async shoot(): Promise<void> {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
    await this.handlers.shoot(this.look);
  }
}

export class AlbumSheet {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement, private readonly album: () => Promise<Album>) {
    this.body = h('div', { class: 'album-body' });
    this.root = h('div', { class: 'settings album', role: 'dialog', 'aria-label': t('photo.album') },
      h('div', { class: 'settings-card album-card' },
        h('div', { class: 'ph' }, h('b', null, t('photo.album')), h('button', { class: 'round small', type: 'button', 'aria-label': t('panels.close'), html: iconSvg('close', 20), onclick: () => this.close() })),
        this.body));
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

  async open(): Promise<void> {
    this.root.style.display = '';
    await this.grid();
  }

  private async grid(): Promise<void> {
    const album = await this.album();
    const photos = await album.list();
    if (photos.length === 0) {
      this.body.replaceChildren(h('p', { class: 'pocket-empty' }, t('photo.empty')));
      return;
    }
    const cells = await Promise.all(photos.map(async (p) => {
      const src = (await album.image(p.id)) ?? '';
      return h('button', { class: 'album-thumb', type: 'button', 'aria-label': photoCaption(p), onclick: () => void this.show(p, src) }, h('img', { src, alt: '' }));
    }));
    this.body.replaceChildren(h('div', { class: 'album-grid' }, ...cells));
  }

  private async show(p: PhotoEntry, src: string): Promise<void> {
    const album = await this.album();
    this.body.replaceChildren(
      h('div', { class: 'album-view' },
        h('img', { src, alt: photoCaption(p) }),
        h('p', { class: 'album-caption' }, photoCaption(p)),
        h('div', { class: 'album-actions' },
          h('button', { class: 'cta muted', type: 'button', onclick: () => void this.grid() }, t('photo.toAlbum')),
          h('button', { class: 'cta', type: 'button', onclick: () => void sharePhoto(src, `lypove-${p.id}.${src.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`) }, t('photo.share')),
          h('button', { class: 'cta muted', type: 'button', onclick: async () => { await album.remove(p.id); await this.grid(); } }, t('photo.delete')))),
    );
  }
}
