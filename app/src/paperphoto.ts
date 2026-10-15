// The paper's photographs: each story's scene rendered for real, off screen — the place as it was that day (its
// season, weather, light and decorations), the people and the things of the story in the frame — and then
// printed the way a small-town paper prints: a grainy halftone in two inks on cream paper.

import { SceneRenderer, type Frame, type NpcFigure } from './render';
import type { PlantOnHorizon } from './pixel/plant';
import { paintSky } from './pixel/sky';
import { drawPlant } from './pixel/plant';
import { daylight } from './daylight';
import type { Catalog, PhotoHint, RoomView } from './types';

/** Everything the camera needs of one place on one day (the game builds it from the world). */
export interface PhotoScene {
  room: RoomView;
  landscape: boolean;
  grounded: boolean;
  underground: boolean;
  /** The floor point the camera looks at. */
  focus: { x: number; y: number };
  npcs: NpcFigure[];
  minute: number;
  season?: string;
  overcast: number;
  plant?: PlantOnHorizon | null;
  /** A wide shot (less zoom). */
  wide: boolean;
  /** A view over the fields to the horizon (what is far off, the plant), not of the map. */
  panorama?: boolean;
}

export interface PhotoWorld {
  catalog: Catalog;
  /** The scene of a story's photo on a world day, or null if its place is not known. */
  scene(hint: PhotoHint, day: number): PhotoScene | null;
}

const INK: [number, number, number] = [44, 36, 32];
const MID: [number, number, number] = [138, 118, 98];
const PAPER: [number, number, number] = [238, 230, 212];
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Prints a picture in place as the paper does: brightness stretched to the picture's own range, then dithered
 * through a 4×4 halftone screen into three tones of two inks (dark ink, its wash, the paper), with a little grain.
 */
export function inkPrint(data: Uint8ClampedArray, w: number, h: number): void {
  let lo = 255;
  let hi = 0;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
    lum[i] = l;
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  const span = Math.max(24, hi - lo);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // grain: a fixed speckle (the same picture prints the same)
      const grain = ((Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 24) / 255 - 0.5) * 0.05;
      const v = Math.min(1, Math.max(0, (lum[i] - lo) / span + grain)) * 2;
      const t = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
      const level = Math.min(2, Math.floor(v) + (v - Math.floor(v) > t ? 1 : 0));
      const c = level === 0 ? INK : level === 1 ? MID : PAPER;
      data[i * 4] = c[0];
      data[i * 4 + 1] = c[1];
      data[i * 4 + 2] = c[2];
      data[i * 4 + 3] = 255;
    }
  }
}

/** The size of a printed photo, in its own (big, visible) dots. */
export const PHOTO_W = 300;
export const PHOTO_H = 186;

export class PaperPhotos {
  private readonly cache = new Map<string, string>();
  private host: HTMLDivElement | null = null;
  private renderer: SceneRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  /** One photo is taken at a time (one camera). */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly world: PhotoWorld) {}

  /**
   * The printed photo of a story (a data URL), taken once a day per story; null if it cannot be taken. In colour
   * (`ink` false) it is a plain snapshot, as the maps show a place.
   */
  photo(key: string, hint: PhotoHint, day: number, ink = true): Promise<string | null> {
    const k = `${day}|${key}|${hint.place}|${ink ? 'ink' : 'colour'}`;
    const known = this.cache.get(k);
    if (known) return Promise.resolve(known);
    const next = this.queue.then(() => this.take(hint, day, ink)).then((url) => {
      if (url) {
        if (this.cache.size > 40) this.cache.clear();
        this.cache.set(k, url);
      }
      return url;
    });
    this.queue = next.catch(() => null);
    return next.catch(() => null);
  }

  private camera(): { renderer: SceneRenderer; canvas: HTMLCanvasElement } {
    if (!this.host || !this.renderer || !this.canvas) {
      // off screen, at a fixed size: the shape of a photo in the paper
      this.host = document.createElement('div');
      this.host.setAttribute('aria-hidden', 'true');
      Object.assign(this.host.style, { position: 'fixed', left: '-2000px', top: '0', width: '400px', height: '248px', overflow: 'hidden', pointerEvents: 'none' });
      this.canvas = document.createElement('canvas');
      this.host.append(this.canvas);
      document.body.append(this.host);
      this.renderer = new SceneRenderer(this.canvas);
      this.renderer.resize();
    }
    return { renderer: this.renderer, canvas: this.canvas };
  }

  private async take(hint: PhotoHint, day: number, ink = true): Promise<string | null> {
    const scene = this.world.scene(hint, day);
    if (!scene) return null;
    if (scene.panorama) return this.panorama(scene, ink);
    const { renderer, canvas } = this.camera();
    renderer.prewarm(scene.room, this.world.catalog);
    const frame: Frame = {
      room: scene.room,
      catalog: this.world.catalog,
      // the photographer is behind the camera, not in the picture
      walker: { x: -40, y: -40, facing: 'down' } as unknown as Frame['walker'],
      playerLayers: [],
      minuteOfDay: scene.minute,
      time: 1,
      view: 0,
      zoom: scene.wide ? 0.55 : 0.95,
      pan: { x: 0, y: 0 },
      landscape: scene.landscape,
      grounded: scene.grounded,
      underground: scene.underground,
      follow: scene.focus,
      npcs: scene.npcs,
      season: scene.season,
      overcast: scene.overcast,
      plant: scene.plant ?? null,
    };
    // a few frames: the things of a big map are drawn into the cache a few at a time
    for (let i = 0; i < 8; i++) {
      renderer.draw(frame);
      await new Promise((r) => setTimeout(r, 0));
    }
    return this.print(canvas, ink);
  }

  /** Over the fields to the horizon: the sky, the hills and what stands far off on them. */
  private panorama(scene: PhotoScene, ink = true): string | null {
    // painted at half the size and enlarged: what is far off reads in the paper's coarse print
    const w = PHOTO_W / 2;
    const h = PHOTO_H / 2;
    const dl = daylight(scene.minute);
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const s = small.getContext('2d');
    const c = document.createElement('canvas');
    c.width = PHOTO_W;
    c.height = PHOTO_H;
    const g = c.getContext('2d');
    if (!g || !s) return null;
    s.drawImage(paintSky(w, h, 'sky', dl), 0, 0);
    const season = (scene.season ?? 'Summer').split(':')[0];
    const shade = (base: [number, number, number], k: number) => `rgb(${base.map((v) => Math.round(v * (1 - dl.dark * k))).join(',')})`;
    const far = Math.round(h * 0.6);
    // the far hills, the plant on them, the near woods and the fields
    s.fillStyle = shade([150, 168, 170], 0.6);
    for (let x = 0; x < w; x++) s.fillRect(x, Math.round(far - 3 * Math.sin(x / 17) - 1.5 * Math.sin(x / 7 + 1)), 1, h);
    if (scene.plant) drawPlant(s, w, far + 2, scene.plant, dl, 0, 0.3);
    const woods: Record<string, [number, number, number]> = { Spring: [72, 120, 70], Summer: [52, 100, 60], Autumn: [140, 96, 52], Winter: [120, 128, 136] };
    s.fillStyle = shade(woods[season] ?? woods.Summer, 0.6);
    for (let x = 0; x < w; x++) s.fillRect(x, Math.round(far + 4 - (x % 5 < 3 ? 2 : 0) - 1.5 * Math.sin(x / 9)), 1, h);
    const fields: Record<string, [number, number, number]> = { Spring: [120, 170, 90], Summer: [196, 176, 90], Autumn: [150, 120, 70], Winter: [226, 232, 240] };
    const f = fields[season] ?? fields.Summer;
    for (let y = far + 7; y < h; y++) {
      // furrows converging on the horizon
      s.fillStyle = shade(y % 3 === 0 ? [f[0] * 0.85, f[1] * 0.85, f[2] * 0.85] : f, 0.6);
      s.fillRect(0, y, w, 1);
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, PHOTO_W, PHOTO_H);
    return ink ? this.print(c) : c.toDataURL('image/png');
  }

  /** The middle of a picture, cropped to the photo's shape and printed (or kept in colour, twice the size). */
  private print(canvas: HTMLCanvasElement, ink = true): string | null {
    const k = ink ? 1 : 2;
    const out = document.createElement('canvas');
    out.width = PHOTO_W * k;
    out.height = PHOTO_H * k;
    const g = out.getContext('2d');
    if (!g || canvas.width === 0) return null;
    // the middle of the shot, cropped to the photo's shape
    const scale = Math.min(canvas.width / PHOTO_W, canvas.height / PHOTO_H);
    const sw = PHOTO_W * scale;
    const sh = PHOTO_H * scale;
    // a colour snapshot enlarged keeps its pixels sharp
    g.imageSmoothingEnabled = ink || sw >= out.width;
    g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, PHOTO_W * k, PHOTO_H * k);
    if (!ink) return out.toDataURL('image/jpeg', 0.86);
    const img = g.getImageData(0, 0, PHOTO_W, PHOTO_H);
    inkPrint(img.data, PHOTO_W, PHOTO_H);
    g.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  }
}
