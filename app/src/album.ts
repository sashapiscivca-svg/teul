// The photo album: pictures the player took, kept on this device (IndexedDB), with where and when.
// Photos are memories, not part of the world: they never enter the event log.
import { t } from './i18n';

export interface PhotoMeta {
  /** Unix milliseconds when it was taken. */
  taken: number;
  /** The place's name. */
  place: string;
  /** The season then (Spring, Summer, Autumn, Winter). */
  season: string;
  /** The world day. */
  day: number;
}

export interface PhotoEntry extends PhotoMeta {
  id: number;
}

export interface Album {
  add(dataUrl: string, meta: PhotoMeta): Promise<number>;
  /** Newest first. */
  list(): Promise<PhotoEntry[]>;
  image(id: number): Promise<string | null>;
  remove(id: number): Promise<void>;
}

const META = 'meta';
const IMAGES = 'images';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openAlbum(name = 'teul-album', idb: IDBFactory = indexedDB): Promise<Album> {
  const open = idb.open(name, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
  };
  const db = await req(open);
  return {
    async add(dataUrl, meta) {
      const tx = db.transaction([META, IMAGES], 'readwrite');
      const id = (await req(tx.objectStore(META).add({ ...meta }))) as number;
      tx.objectStore(IMAGES).put(dataUrl, id);
      await done(tx);
      return id;
    },
    async list() {
      const tx = db.transaction(META, 'readonly');
      const all = (await req(tx.objectStore(META).getAll())) as PhotoEntry[];
      return all.sort((a, b) => b.taken - a.taken || b.id - a.id);
    },
    async image(id) {
      const tx = db.transaction(IMAGES, 'readonly');
      const v = await req(tx.objectStore(IMAGES).get(id));
      return typeof v === 'string' ? v : null;
    },
    async remove(id) {
      const tx = db.transaction([META, IMAGES], 'readwrite');
      tx.objectStore(META).delete(id);
      tx.objectStore(IMAGES).delete(id);
      await done(tx);
    },
  };
}

export type PhotoFilter = 'plain' | 'warm' | 'dusk' | 'bw' | 'film';

export const FILTERS: [PhotoFilter, string][] = [
  ['plain', t('album.plain')],
  ['warm', t('album.warm')],
  ['dusk', t('album.dusk')],
  ['bw', t('album.bw')],
  ['film', t('album.film')],
];

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** A small seeded noise (film grain that stays the same for the same photo). */
function noise(seed: number, i: number): number {
  let x = (seed * 374761393 + i * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296 - 0.5;
}

/** Colours a picture in place: RGBA bytes, `w`×`h`. */
export function applyFilter(d: Uint8ClampedArray, w: number, h: number, kind: PhotoFilter, seed: number): void {
  if (kind === 'plain') return;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (kind === 'warm') {
        r = r * 1.08 + 10;
        g = g * 1.02 + 4;
        b = b * 0.86;
      } else if (kind === 'dusk') {
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        r = l * 0.55 + r * 0.45 + 18;
        g = l * 0.45 + g * 0.35;
        b = l * 0.5 + b * 0.55 + 22;
      } else if (kind === 'bw' || kind === 'film') {
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        if (kind === 'bw') {
          r = g = b = l;
        } else {
          // faded warm film: a touch of sepia, lifted blacks, grain and a soft vignette
          r = l * 0.6 + r * 0.4 + 14;
          g = l * 0.6 + g * 0.4 + 8;
          b = l * 0.6 + b * 0.4;
          const grain = noise(seed, y * w + x) * 26;
          const v = 1 - 0.32 * Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2);
          r = (r + grain) * v;
          g = (g + grain) * v;
          b = (b + grain) * v;
        }
      }
      d[i] = clamp(Math.round(r));
      d[i + 1] = clamp(Math.round(g));
      d[i + 2] = clamp(Math.round(b));
    }
  }
}
