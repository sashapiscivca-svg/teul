// The room in pixel art: everything is drawn into a small framebuffer (one art pixel = k device pixels) and the
// browser scales it up without smoothing. Implements the same interface the game used before.

import { cueColor } from '../a11y';
import { daylight } from '../daylight';
import { ALONG, DELTA, cellKey, cellSet, dividerSet, edgeKey, isBackFacing, isWallEdge, rotXY, STEP, unrotXY, wallEdgesOfItem, type View } from '../geometry';
import { glyphBits } from './glyph';
import { footprintCells, overhang, topHeight } from '../models';
import type { Frame, Pick } from '../render';
import { ambientFor, lampOf, lightMinute, shadowsOn, wallMode, type WallMode } from '../render/lighting';
import { doorways, easedHeight } from '../world';
import type { Layer } from '../sprites';
import { layersSize } from '../layers';
import type { ItemDef, PlacementView, RoomView, WallSide } from '../types';
import { proj, TH, TW, unproj, ZPX } from './iso';
import { itemSprite, type Live } from './items';
import { headPoint, nearParts, occupiedModel, sleeperColors, type Rest } from './occupant';
import { bayer, ramp, rgbToHex } from './palette';
import { rasterize, toSprite, type Sprite } from './raycast';
import { ChunkedLayer, Recorder, SpotGrid } from './chunks';
import { drawClouds, drawWeatherPx, paintLandscape, paintSky } from './sky';
import { drawFireworks } from './fireworks';
import { blockSides, DARK_ALPHA, DARK_RGB, darkHole, FLOOR_DROP, floorTile, glowSprite, shadowSprite, slopeFace, wallFoot, wallPiece, WALL_PX, type FaceStyle } from './tiles';

const SIDES: WallSide[] = ['north', 'east', 'south', 'west'];
/** Old renderer heights were in "pixels" of 0.56 per hundredth; the game still passes some heights that way. */
const OLD_Z = 0.56;

interface Hit {
  pid: number;
  x: number;
  y: number;
  sprite: Sprite;
}

interface WallHit {
  x: number;
  y: number;
  side: WallSide;
  poly: [number, number][];
}

interface Drawable {
  key: number;
  draw: () => void;
  /** Cells of raised land in front of it, higher than its feet, that reach over its picture: painted again after it
   * (x, y pairs, the furthest first). */
  cover?: number[] | null;
}

/** The lie of the land in a grid over the map (no cell: -1), for the sums done often. */
interface Lie {
  x0: number;
  y0: number;
  w: number;
  h: number;
  hs: Float32Array;
  /** The highest land of the map. */
  top: number;
}

function pointIn(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function edgePoints(x: number, y: number, side: WallSide): [number, number, number, number] {
  switch (side) {
    case 'north':
      return [x, y, x + 1, y];
    case 'south':
      return [x, y + 1, x + 1, y + 1];
    case 'west':
      return [x, y, x, y + 1];
    default:
      return [x + 1, y, x + 1, y + 1];
  }
}

function mixRgb(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}

/** Cells of land painted round a map out of doors. */
/** How far the land goes on past a map's edge (its roads, rivers and fields carrying on, trees about), in tiles. */
const APRON = 16;
/** Cells of the dark house drawn round a room. */
const DARK_MARGIN = 7;
/** Cells across the window a room in the village is seen through. */
const WINDOW = 12;

const SLOT_LIVE = new Set(['flame', 'fire', 'glow', 'screen', 'bulb', 'glass', 'shade']);

/** A thing as the scene keeps it between frames. */
interface Ent {
  p: PlacementView;
  def: ItemDef;
  key: number;
  hostTop: number;
  /** Where its anchor lands, without the camera. */
  ox: number;
  oy: number;
  /** How far its picture can reach around the anchor. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** It changes as it is used or as the light changes (lamps, screens, windows): drawn afresh each frame. */
  live: boolean;
  sprite?: Sprite;
  /** The height of the land it stands on, and where it stands in the turned grid (x0, y0, x1, y1). */
  ground: number;
  foot: [number, number, number, number];
  /** The raised land in front of it that hides part of it (worked out when it is first drawn). */
  cover?: number[] | null;
}

const liveCache = new WeakMap<ItemDef, boolean>();
function liveItem(def: ItemDef): boolean {
  let v = liveCache.get(def);
  if (v === undefined) {
    v = def.tags.includes('light') || def.tags.includes('switch') || def.tags.includes('portal') || def.model.some((m) => SLOT_LIVE.has(m.slot) && (m.slot !== 'glass' || def.tags.includes('window') || def.tags.includes('mirror')));
    liveCache.set(def, v);
  }
  return v;
}

/** A screen of more device pixels than this (a phone's or a tablet's dense screen) is drawn in art pixels and
 * scaled up whole by the browser: every layer of every frame filled at the device's own resolution costs several
 * times more there, and the picture is the same, only the camera steps by whole art pixels. */
const SMOOTH_PIXELS = 1_600_000;

export class PixelScene {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private devW = 1;
  private devH = 1;
  private k = 3;
  private artW = 1;
  private artH = 1;
  private camX = 0;
  private camY = 0;
  private view: View = 0;
  private hits: Hit[] = [];

  /** A position snapped to whole device pixels (figures between art pixels, never between device pixels). */
  private snap(v: number): number {
    return this.smooth ? Math.round(v * this.k) / this.k : Math.round(v);
  }
  /** The fraction of an art pixel the picture is shifted by (the camera between pixels). */
  private subX = 0;
  private subY = 0;
  private skyLayer: HTMLCanvasElement | null = null;
  private skyAt = -1;
  private setsOf: RoomView | null = null;
  private boundsKey = '';
  private boundsValue = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  /** How far the static layer has moved since it was painted (wall hit areas are in its coordinates). */
  private staticOffset: [number, number] = [0, 0];
  private npcHits: { id: string; x: number; y: number }[] = [];
  /** Where the camera was when the static layer was painted (it is shifted by the difference since). */
  private staticCam: [number, number] = [0, 0];
  private staticHull: [number, number][] = [];
  /** The convex outline of a set of floor points, worked out once per set. */
  private readonly hullOf = new WeakMap<[number, number][], [number, number][]>();
  private staticWallHits: WallHit[] = [];
  private lightCanvas: HTMLCanvasElement | null = null;
  private lightKey = '';
  /** Where the light layer has anything: [x0, y0, x1, y1] in its own pixels. */
  private lightBox: [number, number, number, number] | null = null;

  private grow(x: number, y: number, w: number, h: number): void {
    const b = this.lightBox;
    this.lightBox = b ? [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x + w), Math.max(b[3], y + h)] : [x, y, x + w, y + h];
  }
  private wallHits: WallHit[] = [];
  private cells = new Set<string>();
  private home = new Set<string>();
  private lastFrame: Frame | null = null;
  private dividers = new Set<string>();
  private staticCanvas: HTMLCanvasElement | null = null;
  /** The floor of a big map, in chunks. */
  private staticChunks: ChunkedLayer | null = null;
  /** The light of a big map, in chunks. */
  private lightChunks: ChunkedLayer | null = null;
  private staticKey = '';
  private sky: HTMLCanvasElement | null = null;
  private skyKey = '';
  private hull: [number, number][] = [];
  private readonly roomIds = new WeakMap<object, number>();
  private nextRoomId = 1;
  private readonly layerCache = new WeakMap<Layer[], HTMLCanvasElement>();
  private readonly outlineCache = new WeakMap<Sprite, HTMLCanvasElement>();
  private readonly tintCache = new WeakMap<Sprite, HTMLCanvasElement>();
  private readonly slabCache = new Map<string, Sprite>();
  private readonly glyphCache = new Map<string, HTMLCanvasElement>();
  private maxK = 10;
  profiling = false;
  readonly prof: Record<string, number> = {};
  /** For the tests: the sky (and the land painted round a map) one flat colour, and nothing laid over the picture
   * (no tint of the hour, no lights, no weather, no faint hero through what hides them), so a pixel of that colour
   * inside the map is a hole in it. */
  testKey: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context is unavailable');
    this.ctx = ctx;
    canvas.style.imageRendering = 'pixelated';
  }

  // ---- size and camera ---------------------------------------------------------------------------------------

  resize(): void {
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    const host = this.canvas.parentElement ?? document.body;
    this.devW = Math.max(1, Math.round(host.clientWidth * this.dpr));
    this.devH = Math.max(1, Math.round(host.clientHeight * this.dpr));
    this.smooth = this.smoothWanted && this.devW * this.devH <= SMOOTH_PIXELS;
    this.applyK(this.k);
  }

  /**
   * The canvas has the device's own resolution; the picture is drawn in art pixels scaled by `k` without
   * smoothing, so it stays crisp, while the camera and moving figures can sit between art pixels and glide.
   */
  private applyK(k: number): void {
    this.k = Math.max(1, Math.min(this.maxK, k));
    // one art pixel more each way, for the fraction the camera is shifted by
    this.artW = Math.ceil(this.devW / this.k) + 1;
    this.artH = Math.ceil(this.devH / this.k) + 1;
    // smooth: device resolution; otherwise (slow devices) art pixels scaled up by the browser
    const w = this.smooth ? this.devW : this.artW;
    const h = this.smooth ? this.devH : this.artH;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.canvas.style.width = `${(this.smooth ? this.devW : this.artW * this.k) / this.dpr}px`;
    this.canvas.style.height = `${(this.smooth ? this.devH : this.artH * this.k) / this.dpr}px`;
    this.staticKey = '';
    this.lightKey = '';
    this.skyKey = '';
  }

  setMaxPixelRatio(r: number): void {
    // on slow devices allow bigger art pixels (fewer of them), and at the lowest step draw in art pixels
    this.maxK = r >= 2 ? 10 : 6;
    this.smoothWanted = r > 1;
    const smooth = this.smoothWanted && this.devW * this.devH <= SMOOTH_PIXELS;
    if (smooth !== this.smooth) {
      this.smooth = smooth;
      this.applyK(this.k);
    }
  }

  /** Drawing at the device's resolution (smooth camera) rather than in art pixels. */
  private smooth = true;
  /** The quality allows the smooth camera (it is still not used on a screen of too many pixels). */
  private smoothWanted = true;

  /** Device pixels per art pixel in the canvas itself. */
  private get scale(): number {
    return this.smooth ? this.k : 1;
  }

  /** Things of a big map, to be drawn into the sprite cache a few at a time before they come on screen. */
  private warmQueue: { def: ItemDef; p: PlacementView }[] = [];

  prewarm(room: RoomView, catalog: Frame['catalog']): void {
    // one of each kind of thing (a forest of the same pine is one sprite), the nearest drawn first
    const seen = new Set<string>();
    this.warmQueue = room.placements.flatMap((p) => {
      const def = catalog.items[p.item];
      const key = `${p.item}|${p.rot}|${p.wall ?? ''}|${JSON.stringify(p.colors ?? null)}|${JSON.stringify(p.props ?? null)}`;
      // a mountain or a whole building is drawn when it first comes on screen, not ahead (one is a long job)
      if (!def || seen.has(key) || def.footprint.w * def.footprint.d > 16) return [];
      seen.add(key);
      return [{ def, p }];
    });
    this.warmSorted = false;
  }

  private warmSorted = false;
  /** Where the hero was drawn this frame (for the faint figure through what stands in front). */
  private heroGhost: { canvas: HTMLCanvasElement; x: number; y: number } | null = null;
  /** Where the hero's hands are on the screen this frame (the light carried shines from there). */
  private heroHands: { x: number; y: number } | null = null;

  /** The queue in order of distance from where one stands (the last in the queue is drawn first). */
  private sortWarm(at: { x: number; y: number }): void {
    this.warmQueue.sort((a, b) => Math.hypot(b.p.x - at.x, b.p.y - at.y) - Math.hypot(a.p.x - at.x, a.p.y - at.y));
    this.warmSorted = true;
  }

  /** Draws a few queued things into the sprite cache exactly as they will be drawn (the season's shape, the
   * glow of a lamp at night, what they stand on), so the cache holds what the screen will ask for. */
  private warmUp(budgetMs: number, frame: Frame, dark: number, sky: string): void {
    const end = performance.now() + budgetMs;
    while (this.warmQueue.length > 0 && performance.now() < end) {
      const w = this.warmQueue.pop();
      if (w) itemSprite(w.def, w.p, this.hostTop(frame, w.p), this.view, this.liveOf(w.def, w.p, frame, dark, sky));
    }
  }

  recover(): void {
    this.staticKey = '';
    this.lightKey = '';
  }

  startFade(_ms?: number, _now?: number): void {
    // the pixel renderer turns instantly; a crossfade would blur the pixels
  }

  private cssToArt(x: number, y: number): [number, number] {
    return [(x * this.dpr) / this.k - this.subX, (y * this.dpr) / this.k - this.subY];
  }

  /** The lie of the land of the room drawn now (none: flat). */
  private terrain: Record<string, number> | null = null;
  private lieFor: RoomView | null = null;

  /** The height of the land at a floor point (its cell's), model units. */
  private terrainAt(x: number, y: number): number {
    return this.terrain ? this.terrain[cellKey(Math.floor(x), Math.floor(y))] ?? 0 : 0;
  }

  /** The height of the land under someone walking (world.ts easedHeight): its single steps eased, so people and
   * animals go up and down them as they walk instead of jumping at the edge. */
  private easedAt(x: number, y: number): number {
    const t = this.terrain;
    if (!t) return 0;
    return easedHeight((cx, cy) => t[cellKey(cx, cy)] ?? 0, x, y, TERRAIN_STEP + 3);
  }

  /** A point in the picture for someone walking there (on the eased land). */
  private rpWalk(x: number, y: number, z = 0): { x: number; y: number } {
    return this.rp(x, y, z + this.easedAt(x, y) - this.terrainAt(x, y));
  }

  /** The heights of the room drawn now in a grid (none: flat). */
  private lie: Lie | null = null;

  private lieOf(room: RoomView): Lie | null {
    const t = room.terrain;
    if (!t || room.cells.length === 0) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of room.cells) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const hs = new Float32Array(w * h).fill(-1);
    let top = 0;
    for (const [x, y] of room.cells) {
      const v = t[cellKey(x, y)] ?? 0;
      hs[(y - y0) * w + (x - x0)] = v;
      top = Math.max(top, v);
    }
    return { x0, y0, w, h, hs, top };
  }

  /** The height of the land of a cell; -1 off the map. */
  private heightAt(x: number, y: number): number {
    const l = this.lie;
    if (!l) return this.cells.has(cellKey(x, y)) ? 0 : -1;
    const i = x - l.x0;
    const j = y - l.y0;
    return i < 0 || j < 0 || i >= l.w || j >= l.h ? -1 : l.hs[j * l.w + i];
  }

  /** The cell whose corner nearest the back is (i, j) in the turned grid. */
  private rotCell(i: number, j: number): [number, number] {
    switch (this.view) {
      case 0:
        return [i, j];
      case 1:
        return [j, -i - 1];
      case 2:
        return [-i - 1, -j - 1];
      default:
        return [-j - 1, i];
    }
  }

  /** A cell's corner nearest the back in the turned grid (the other way round from rotCell). */
  private cellRot(x: number, y: number): [number, number] {
    switch (this.view) {
      case 0:
        return [x, y];
      case 1:
        return [-y - 1, x];
      case 2:
        return [-x - 1, -y - 1];
      default:
        return [y, -x - 1];
    }
  }

  /** Where a cell's tile is drawn at a height: its picture's corner (the tile is 32 × 16 with its top at +16, 0). */
  private tileAt(x: number, y: number, h: number): [number, number] {
    const [i, j] = this.cellRot(x, y);
    const p = proj(i, j, h);
    return [Math.round(p.x - TW / 2 + this.camX), Math.round(p.y + this.camY)];
  }

  private rp(x: number, y: number, z = 0): { x: number; y: number } {
    const [rx, ry] = rotXY(this.view, x, y);
    // everything stands on the land: a hill lifts what is on it
    const p = proj(rx, ry, z + this.terrainAt(x, y));
    return { x: p.x + this.camX, y: p.y + this.camY };
  }

  /** CSS-pixel position of a world point (tiles; height in the old renderer's pixels). */
  toScreen(x: number, y: number, z = 0): { x: number; y: number } {
    const p = this.rp(x, y, z / OLD_Z);
    return { x: ((p.x + this.subX) * this.k) / this.dpr, y: ((p.y + this.subY) * this.k) / this.dpr };
  }

  /** The world point on the floor under a CSS-pixel point. */
  floorPoint(cssX: number, cssY: number): { x: number; y: number } {
    const [ax, ay] = this.cssToArt(cssX, cssY);
    const g = unproj(ax - this.camX, ay - this.camY);
    const lie = this.lie;
    if (lie) {
      // on raised land: the line of sight through the point, from up high near the viewer down to the ground; the
      // first cell whose land it meets (its top, or the side of it facing the viewer) is the one seen there
      const per = TH / ZPX;
      for (let s = lie.top / per + 0.02; s >= 0; s -= 0.02) {
        const [x, y] = this.rotCell(Math.floor(g.x + s), Math.floor(g.y + s));
        const h = this.heightAt(x, y);
        if (h < 0 || h < s * per) continue;
        // on its top, or (on its side) at its edge right above the point
        const [i, j] = this.cellRot(x, y);
        const up = h / per;
        const u = Math.min(i + 0.999, Math.max(i + 0.001, g.x + up));
        const v = Math.min(j + 0.999, Math.max(j + 0.001, g.y + up));
        const [ux, uy] = unrotXY(this.view, u, v);
        return { x: ux, y: uy };
      }
    }
    const [x, y] = unrotXY(this.view, g.x, g.y);
    return { x, y };
  }

  pick(cssX: number, cssY: number): Pick | null {
    const [ax, ay] = this.cssToArt(cssX, cssY);
    const ix = Math.floor(ax);
    const iy = Math.floor(ay);
    // people first: a figure in front of a building is what the finger meant
    // of all the figures under the finger, the one whose middle is nearest (the village's own people first)
    let best: { id: string; d: number } | null = null;
    for (const n of this.npcHits) {
      if (ix < n.x - 8 || ix > n.x + 8 || iy < n.y - 30 || iy > n.y + 2) continue;
      const d = Math.hypot(ax - n.x, ay - (n.y - 14)) + (n.id.startsWith('res_') ? 4 : 0);
      if (!best || d < best.d) best = { id: n.id, d };
    }
    if (best) return { kind: 'npc', id: best.id };
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      const lx = ix - h.x;
      const ly = iy - h.y;
      if (lx < 0 || ly < 0 || lx >= h.sprite.w || ly >= h.sprite.h) continue;
      if (h.sprite.mask[ly * h.sprite.w + lx]) {
        const f = this.floorPoint(cssX, cssY);
        return { kind: 'item', pid: h.pid, cell: [Math.floor(f.x), Math.floor(f.y)], exact: true };
      }
    }
    for (let i = this.wallHits.length - 1; i >= 0; i--) {
      const w = this.wallHits[i];
      if (pointIn(ax - this.staticOffset[0], ay - this.staticOffset[1], w.poly)) return { kind: 'wall', x: w.x, y: w.y, side: w.side };
    }
    const f = this.floorPoint(cssX, cssY);
    const x = Math.floor(f.x);
    const y = Math.floor(f.y);
    if (!this.cells.has(cellKey(x, y))) return null;
    // a tap between the legs of a chair still means the chair
    const fr = this.lastFrame;
    if (fr) {
      for (const layer of ['floor', 'rug']) {
        for (const p of fr.room.placements) {
          const def = fr.catalog.items[p.item];
          if (!def || def.layer !== layer) continue;
          if (footprintCells(def, p.rot).some(([dx, dy]) => p.x + dx === x && p.y + dy === y)) return { kind: 'item', pid: p.pid, cell: [x, y] };
        }
      }
    }
    return { kind: 'floor', x, y };
  }

  pickEdge(cssX: number, cssY: number, tolerance = 0.3): { x: number; y: number; side: WallSide } | null {
    const f = this.floorPoint(cssX, cssY);
    const cx = Math.floor(f.x);
    const cy = Math.floor(f.y);
    const fx = f.x - cx;
    const fy = f.y - cy;
    const options: [number, WallSide][] = [[fy, 'north'], [1 - fx, 'east'], [1 - fy, 'south'], [fx, 'west']];
    options.sort((a, b) => a[0] - b[0]);
    return options[0][0] <= tolerance ? { x: cx, y: cy, side: options[0][1] } : null;
  }

  private mark(name: string, t0: number): void {
    if (this.profiling) this.prof[name] = (this.prof[name] ?? 0) + performance.now() - t0;
  }

  private roomId(room: object): number {
    let id = this.roomIds.get(room);
    if (!id) {
      id = this.nextRoomId++;
      this.roomIds.set(room, id);
    }
    return id;
  }

  /** Room bounds in unrotated-camera art pixels. */
  private land: HTMLCanvasElement | null = null;
  private landKey = '';
  /** How many cells of land (or street) the map has round it, rather than an edge over the void. */
  private apron = 0;

  private bounds(room: RoomView): { minX: number; maxX: number; minY: number; maxY: number } {
    const key = `${this.roomId(room)}|${this.view}|${this.apron}`;
    if (key === this.boundsKey) return this.boundsValue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [cx, cy] of room.cells) {
      // (raised land stands higher than a wall)
      const up = Math.max(WALL_PX, (room.terrain?.[cellKey(cx, cy)] ?? 0) * ZPX + 2);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const [rx, ry] = rotXY(this.view, cx + dx, cy + dy);
        const p = proj(rx, ry);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y - up);
        maxY = Math.max(maxY, p.y + FLOOR_DROP);
      }
    }
    if (this.apron) {
      // the land (or the street) round the map
      minX -= this.apron * TW;
      maxX += this.apron * TW;
      minY -= this.apron * TH + 90;
      maxY += this.apron * TH;
    }
    this.boundsKey = key;
    this.boundsValue = { minX, maxX, minY, maxY };
    return this.boundsValue;
  }

  /** How high the camera looks (the land under the one it follows, eased), for which room, as of when. */
  private camLift = 0;
  private camLiftFor: RoomView | null = null;
  private camLiftAt = 0;

  private placeCamera(frame: Frame): void {
    if (frame.follow && !frame.overview) {
      // about eleven cells across the screen, whatever the map's size
      const fit = Math.max(2, Math.floor(this.devW / (TW * 11)));
      const k = Math.max(1, Math.min(this.maxK, Math.round(fit * frame.zoom)));
      if (k !== this.k) this.applyK(k);
      const top = Math.round(54 * this.dpr) / this.k;
      const availH = (this.devH - ((frame.insetBottom ?? 0) * this.dpr | 0)) / this.k - top;
      const [rx, ry] = rotXY(this.view, frame.follow.x, frame.follow.y);
      // up on raised land the camera rises with the one it follows, easing up and down the steps (at once in a new
      // place)
      const lift = this.terrainAt(frame.follow.x, frame.follow.y);
      if (this.camLiftFor !== frame.room) {
        this.camLiftFor = frame.room;
        this.camLift = lift;
      } else this.camLift += (lift - this.camLift) * Math.min(1, Math.max(0, frame.time - this.camLiftAt) * 6);
      this.camLiftAt = frame.time;
      if (Math.abs(lift - this.camLift) < 0.5) this.camLift = lift;
      // the camera glides: whole art pixels in the picture, the rest as a shift of the whole picture
      const p = proj(rx, ry, this.camLift);
      const cx = this.artW / 2 + (frame.pan.x * this.dpr) / this.k - p.x;
      const cy = top + availH / 2 + 12 + (frame.pan.y * this.dpr) / this.k - p.y;
      this.camX = Math.floor(cx);
      this.camY = Math.floor(cy);
      // the shift is a whole number of device pixels, so art pixels keep their size while the camera glides
      this.subX = Math.round((cx - this.camX) * this.k) / this.k;
      this.subY = Math.round((cy - this.camY) * this.k) / this.k;
      return;
    }
    const b = this.bounds(frame.room);
    // a room in the village is seen through a window of a fixed size (at least WINDOW cells), so the scale stays
    // the same from room to room and the street round it is always in the picture
    const roomW = Math.max(b.maxX - b.minX + 8, frame.grounded ? WINDOW * TW : 0);
    const roomH = Math.max(b.maxY - b.minY + 8, frame.grounded ? WINDOW * TH + WALL_PX : 0);
    const inset = ((frame.insetBottom ?? 0) * this.dpr) | 0;
    const top = Math.round(54 * this.dpr);
    // the scale does not depend on the editor's dock, so opening the editor never halves the room
    const fit = Math.max(1, Math.floor(Math.min(this.devW / roomW, (this.devH - top) / roomH)));
    const k = Math.max(1, Math.min(this.maxK, Math.round(fit * frame.zoom)));
    if (k !== this.k) this.applyK(k);
    const availTop = top / this.k;
    const availH = (this.devH - inset - top) / this.k;
    const panX = (frame.pan.x * this.dpr) / this.k;
    const panY = (frame.pan.y * this.dpr) / this.k;
    this.camX = Math.round(this.artW / 2 - (b.minX + b.maxX) / 2 + panX);
    this.camY = Math.round(availTop + availH / 2 - (b.minY + b.maxY) / 2 + panY);
    this.subX = 0;
    this.subY = 0;
  }

  // ---- the frame ---------------------------------------------------------------------------------------------

  draw(frame: Frame): void {
    const ctx = this.ctx;
    const { room } = frame;
    this.view = frame.view;
    this.lastFrame = frame;
    this.terrain = room.terrain ?? null;
    if (this.lieFor !== room) {
      this.lieFor = room;
      this.lie = this.lieOf(room);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const minute = lightMinute(room.settings, frame.minuteOfDay);
    const amb = ambientFor(room.settings, minute);
    const dl = daylight(minute);
    const kind = room.style_params.backdrop?.kind ?? 'void';
    let t0 = performance.now();
    const skyKey = `${kind}|${this.artW}x${this.artH}|${Math.round(minute / 5)}`;
    if (skyKey !== this.skyKey || !this.sky) {
      this.sky = paintSky(this.artW, this.artH, kind, dl);
      this.skyKey = skyKey;
      this.skyAt = -1;
    }
    // sky and drifting clouds, composed in art pixels a few times a second and scaled up once
    if (!this.skyLayer || this.skyLayer.width !== this.artW || this.skyLayer.height !== this.artH) {
      this.skyLayer = document.createElement('canvas');
      this.skyLayer.width = this.artW;
      this.skyLayer.height = this.artH;
      this.skyAt = -1;
    }
    if (this.skyAt < 0 || frame.time - this.skyAt > 0.3) {
      const g = this.skyLayer.getContext('2d') as CanvasRenderingContext2D;
      g.imageSmoothingEnabled = false;
      g.drawImage(this.sky, 0, 0);
      if (!frame.minimal) drawClouds(g, this.artW, this.artH, kind, dl, frame.time);
      this.skyAt = frame.time;
    }
    if (this.testKey) {
      ctx.fillStyle = this.testKey;
      ctx.fillRect(0, 0, this.artW, this.artH);
    } else if (frame.underground || frame.grounded) {
      // under the ground there is no sky, and round a room there is only the dark of the rest of the house
      ctx.fillStyle = '#14121a';
      ctx.fillRect(0, 0, this.artW, this.artH);
    } else {
      ctx.drawImage(this.skyLayer, 0, 0);
      if (frame.fireworks && frame.landscape) drawFireworks(ctx, this.artW, this.artH, frame.time);
    }
    // a map the camera follows is painted whole, its land round it too; a room is fitted to the screen as it is
    this.apron = !frame.follow ? 0 : frame.grounded ? DARK_MARGIN : frame.landscape ? APRON : 0;
    if (frame.landscape && !this.testKey) {
      const lk = `${this.artW}x${this.artH}|${frame.season ?? ''}|${Math.round(dl.dark * 10)}|${!!frame.grounded}|${frame.plant ? `${frame.plant.stage}:${Math.round(frame.plant.built / 10)}` : ''}`;
      if (lk !== this.landKey || !this.land) {
        this.land = paintLandscape(this.artW, this.artH, frame.season ?? 'Summer:1', dl, 0, !!frame.grounded, frame.plant ?? null);
        this.landKey = lk;
      }
      ctx.drawImage(this.land, 0, 0);
    }
    this.mark('sky', t0);
    if (room.cells.length === 0) return;

    if (this.setsOf !== room) {
      this.setsOf = room;
      this.cells = cellSet(room);
      this.home = new Set((room.home_cells ?? room.cells).map(([x, y]) => cellKey(x, y)));
      this.dividers = dividerSet(room);
    }
    this.placeCamera(frame);
    if (!this.smooth) {
      this.subX = 0;
      this.subY = 0;
    }
    ctx.setTransform(this.scale, 0, 0, this.scale, this.subX * this.scale, this.subY * this.scale);
    t0 = performance.now();
    this.drawStatic(frame, amb.dark, shadowsOn(room.settings));
    this.mark('static', t0);
    t0 = performance.now();
    this.hits = [];
    this.heroGhost = null;
    this.drawEntities(frame, amb.dark, dl.sky);
    // the hero behind a house, a tree or the back of a bench still shows, faintly, through it (drawn over
    // itself it changes nothing; only where something stands in front does the faint outline show)
    const ghost = this.heroGhost as { canvas: HTMLCanvasElement; x: number; y: number } | null;
    if (ghost && !this.testKey) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.drawImage(ghost.canvas, ghost.x, ghost.y);
      ctx.restore();
    }
    this.mark('entities', t0);
    t0 = performance.now();
    this.drawOverlays(frame);
    this.mark('overlays', t0);
    if (this.testKey) return;
    t0 = performance.now();

    // daylight and the player's ambient colour
    ctx.save();
    ctx.globalAlpha = amb.tintAlpha;
    ctx.fillStyle = amb.tint;
    ctx.fillRect(0, 0, this.artW, this.artH);
    // an overcast sky dims and cools everything; lightning lights it all for a moment
    if (frame.overcast) {
      ctx.globalAlpha = Math.min(0.32, frame.overcast * 0.3);
      ctx.fillStyle = '#2a3346';
      ctx.fillRect(0, 0, this.artW, this.artH);
    }
    if (frame.lightning) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(0, 0, this.artW, this.artH);
    }
    ctx.restore();
    this.mark('tint', t0);
    t0 = performance.now();
    // a light map over a whole big map is a canvas the size of the map: the slowest phones go without it
    // street lamps light the night even on a slow phone (the light layer is painted once and reused)
    this.drawLight(frame, amb.dark);
    this.drawFireLight(frame, amb.dark);
    this.drawCarriedLight(frame);
    this.mark('light', t0);
    t0 = performance.now();
    this.drawHint(frame);
    if (this.warmQueue.length > 0) {
      if (!this.warmSorted && frame.follow) this.sortWarm(frame.follow);
      // a little at a time while the frame is busy (walking, a slow phone), more while all is still
      this.warmUp(frame.minimal ? 1 : frame.lowDetail ? 1.5 : 2.5, frame, amb.dark, dl.sky);
    }
    this.warmChunks(frame.minimal ? 0.5 : 1.5);
    this.mark('warm', t0);
    t0 = performance.now();
    const weather = room.style_params.weather?.kind;
    if (weather && weather !== 'none') drawWeatherPx(ctx, this.artW, this.artH, weather, dl, frame.time, frame.minimal ? 0.3 : frame.lowDetail ? 0.55 : 1);
    this.mark('weather', t0);
  }

  // ---- floor and walls ---------------------------------------------------------------------------------------

  /** Floor styles by paint while the static layer is painted (the same for every cell of a paint). */
  private styleMemo: Map<string, ReturnType<PixelScene['floorStyleOf']>> | null = null;

  private floorStyle(frame: Frame, x: number, y: number) {
    const painted = frame.room.floor_paint[cellKey(x, y)];
    const memo = this.styleMemo;
    if (!memo) return this.floorStyleOf(frame, painted);
    let st = memo.get(painted ?? '');
    if (!st) {
      st = this.floorStyleOf(frame, painted);
      memo.set(painted ?? '', st);
    }
    return st;
  }

  private floorStyleOf(frame: Frame, painted: string | undefined) {
    const params = (painted ? frame.catalog.styles[painted]?.params : undefined) ?? frame.room.style_params.floor ?? {};
    const style = { color: params.color ?? '#c28f5c', alt: params.alt, pattern: params.pattern, outdoor: params.outdoor === '1' };
    return frame.season && style.outdoor ? seasonalFloor(style, painted ?? '', frame.season) : style;
  }

  /** Garden cells have no walls around them; their edge shows earth. */
  private outdoor(frame: Frame, x: number, y: number): boolean {
    return this.floorStyle(frame, x, y).outdoor;
  }

  /** No wall on this edge: a garden cell facing open ground (a garden next to the house still has the house wall). */
  private open(frame: Frame, x: number, y: number, side: WallSide): boolean {
    if (!this.outdoor(frame, x, y)) return false;
    const [dx, dy] = DELTA[side];
    const across = cellKey(x + dx, y + dy);
    if (!this.home.has(across)) return true;
    return this.outdoor(frame, x + dx, y + dy);
  }

  private wallStyle(frame: Frame, x: number, y: number, side: WallSide) {
    const painted = frame.room.wall_paint[edgeKey(x, y, side)];
    const params = (painted ? frame.catalog.styles[painted]?.params : undefined) ?? frame.room.style_params.wall ?? {};
    return { color: params.color ?? '#6a5688', right: params.color_right, pattern: params.pattern };
  }

  /**
   * Floors, back walls and shadows, painted once into a canvas. A room is painted as seen; a big map is painted
   * whole, so following the player only moves the picture.
   */
  private drawStatic(frame: Frame, dark: number, shadows: boolean): void {
    const whole = frame.follow ? this.bounds(frame.room) : null;
    const w = whole ? Math.ceil(whole.maxX - whole.minX) + 8 : this.artW;
    const h = whole ? Math.ceil(whole.maxY - whole.minY) + 8 : this.artH;
    const key = [this.roomId(frame.room), this.view, whole ? 'whole' : `${this.camX},${this.camY}`, w, h, Math.round(dark * 6), shadows, frame.season ?? ''].join('|');
    if (key !== this.staticKey || (!this.staticCanvas && !this.staticChunks)) {
      // a big map is written down whole and painted in chunks as the camera comes near; a room is painted as seen
      const rec = whole ? new Recorder() : null;
      let s: CanvasRenderingContext2D;
      if (rec) {
        this.staticCanvas = null;
        s = rec as unknown as CanvasRenderingContext2D;
      } else {
        this.staticChunks = null;
        if (!this.staticCanvas || this.staticCanvas.width !== w || this.staticCanvas.height !== h) {
          this.staticCanvas = document.createElement('canvas');
          this.staticCanvas.width = w;
          this.staticCanvas.height = h;
        }
        s = this.staticCanvas.getContext('2d') as CanvasRenderingContext2D;
        s.imageSmoothingEnabled = false;
        s.clearRect(0, 0, w, h);
      }
      const cam: [number, number] = [this.camX, this.camY];
      if (whole) {
        this.camX = Math.round(4 - whole.minX);
        this.camY = Math.round(4 - whole.minY);
      }
      this.styleMemo = new Map();
      this.paintFloor(s, frame);
      this.paintBackWalls(s, frame);
      if (shadows) this.paintShadows(s, frame, dark);
      this.styleMemo = null;
      if (rec) this.staticChunks = new ChunkedLayer(rec.ops, w, h);
      this.staticCam = [this.camX, this.camY];
      this.staticHull = this.hull;
      this.staticWallHits = this.wallHits;
      [this.camX, this.camY] = cam;
      this.staticKey = key;
      this.lightKey = '';
    }
    const ox = this.camX - this.staticCam[0];
    const oy = this.camY - this.staticCam[1];
    // hit areas stay in the layer's coordinates; picking shifts the point instead of the areas
    this.hull = this.staticHull;
    this.wallHits = this.staticWallHits;
    this.staticOffset = [ox, oy];
    if (this.staticChunks) this.staticChunks.draw(this.ctx, ox, oy, this.artW, this.artH);
    else if (this.staticCanvas) this.blit(this.staticCanvas, ox, oy);
  }

  /** Paints the chunks of a big map round the screen ahead of the camera. */
  private warmChunks(budgetMs: number): void {
    const ox = this.camX - this.staticCam[0];
    const oy = this.camY - this.staticCam[1];
    this.staticChunks?.warm(ox, oy, this.artW, this.artH, budgetMs);
    this.lightChunks?.warm(ox, oy, this.artW, this.artH, budgetMs / 2);
  }

  /** Three blades round a hub, turned by `turn` (radians), in the plane across the nacelle. */
  private drawBlades(hub: { x: number; y: number; z: number }, turn: number): void {
    const ctx = this.ctx;
    const c = this.rp(hub.x, hub.y, hub.z);
    for (let k = 0; k < 3; k++) {
      const a = turn + (k * Math.PI * 2) / 3;
      const tip = this.rp(hub.x + Math.cos(a) * 1.7, hub.y, hub.z + Math.sin(a) * 170);
      const n = Math.max(4, Math.ceil(Math.hypot(tip.x - c.x, tip.y - c.y)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = this.snap(c.x + (tip.x - c.x) * t);
        const y = this.snap(c.y + (tip.y - c.y) * t);
        const wide = t < 0.25 ? 3 : t < 0.7 ? 2 : 1;
        ctx.fillStyle = '#eef2f4';
        ctx.fillRect(x, y, wide, wide);
        ctx.fillStyle = '#9aa4ae';
        ctx.fillRect(x, y + wide, wide, 1);
      }
    }
    ctx.fillStyle = '#f6f8fa';
    ctx.fillRect(this.snap(c.x) - 2, this.snap(c.y) - 2, 5, 5);
  }

  /** A wire from one pole to the next, in a few pieces, each sorted by its own depth. */
  private pushWire(list: { key: number; draw: () => void }[], w: { a: [number, number, number]; b: [number, number, number] }): void {
    const [ax, ay, az] = w.a;
    const [bx, by, bz] = w.b;
    const len = Math.hypot(bx - ax, by - ay);
    const sag = 12 + len * 5;
    const at = (t: number) => this.rp(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t - sag * 4 * t * (1 - t));
    const pieces = Math.max(2, Math.ceil(len / 3));
    const ctx = this.ctx;
    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces;
      const t1 = (i + 1) / pieces;
      const p0 = at(t0);
      const p1 = at(t1);
      if (Math.max(p0.x, p1.x) < -4 || Math.min(p0.x, p1.x) > this.artW + 4 || Math.max(p0.y, p1.y) < -4 || Math.min(p0.y, p1.y) > this.artH + 4) continue;
      const tm = (t0 + t1) / 2;
      list.push({
        key: this.depth(ax + (bx - ax) * tm, ay + (by - ay) * tm) + 0.03,
        draw: () => {
          // one thin stroke per piece: hundreds of wires stay cheap
          ctx.strokeStyle = '#2a2632';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y + 0.5);
          ctx.lineTo(p1.x, p1.y + 0.5);
          ctx.stroke();
        },
      });
    }
  }

  private depth(x: number, y: number): number {
    const [rx, ry] = rotXY(this.view, x, y);
    return rx + ry;
  }

  /**
   * The land round a map out of doors: the ground of its edge carried on outwards (roads for a few cells, then
   * grass; rivers on), fading into the landscape behind, and trees standing about behind the far edges.
   */
  private paintApron(s: CanvasRenderingContext2D, frame: Frame): void {
    const room = frame.room;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // in the village the street goes round the plot: the home's whole grid (it never grows past it), or the
    // building's room
    // the street goes round the room itself: one room at a time, the town right round it
    for (const [x, y] of room.cells) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const A = APRON;
    const ring: [number, number, number][] = [];
    for (let y = y0 - A; y <= y1 + A; y++) {
      for (let x = x0 - A; x <= x1 + A; x++) {
        if (this.cells.has(cellKey(x, y))) continue;
        ring.push([x, y, Math.max(0, x0 - x, x - x1, y0 - y, y - y1)]);
      }
    }
    ring.sort((a, b) => this.depth(a[0] + 0.5, a[1] + 0.5) - this.depth(b[0] + 0.5, b[1] + 0.5));
    const wild = { ...this.seasonGrass(frame), outdoor: true };
    for (const [x, y, d] of ring) {
      const ex = Math.max(x0, Math.min(x1, x));
      const ey = Math.max(y0, Math.min(y1, y));
      let st = this.cells.has(cellKey(ex, ey)) ? this.floorStyle(frame, ex, ey) : wild;
      // the roads, the paths and the rivers carry on out of the map (the world goes on); anything else turns to field
      const goesOn = st.pattern === 'water' || st.pattern === 'grass' || st.pattern === 'meadow' || /stones|gravel|sand|asphalt/.test(String(st.pattern ?? ''));
      if (!st.outdoor || (!goesOn && d > 3) || st.pattern === 'soil') st = wild;
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => rotXY(this.view, x + dx, y + dy));
      const p = proj(Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])));
      s.globalAlpha = d <= APRON - 3 ? 1 : Math.max(0, (APRON - d + 0.5) / 3.5);
      s.drawImage(floorTile(st, this.view % 2 ? y : x, this.view % 2 ? x : y), Math.round(p.x - TW / 2 + this.camX), Math.round(p.y + this.camY));
    }
    s.globalAlpha = 1;
    this.apronRing = { ring, x0, y0, x1, y1 };
    this.paintApronGrowth(s, frame, false);
  }

  private apronRing: { ring: [number, number, number][]; x0: number; y0: number; x1: number; y1: number } | null = null;

  /** Trees about the far edges of the land round a map (`front`: the low growth before its near edges, painted after
   * the map, which it stands in front of). */
  private paintApronGrowth(s: CanvasRenderingContext2D, frame: Frame, front: boolean): void {
    const room = frame.room;
    if (!this.apronRing) return;
    const { ring, x0, y0, x1, y1 } = this.apronRing;
    // trees about the far edges (the near ones would stand in front of the map)
    const trees = room.placements.filter((p) => p.item.startsWith('tree_')).length;
    const density = frame.grounded ? 0.14 : Math.min(0.55, 0.12 + (trees / Math.max(1, room.cells.length)) * 6);
    const kinds = ['tree_pine', 'tree_birch', 'tree_oak', 'tree_pine', 'tree_maple'];
    const lows = ['bush_round', 'bush_flowering', 'rocks', 'bush_round', 'mushrooms'];
    for (const [x, y, d] of ring) {
      if (d < 2 || d > APRON - 1) continue;
      const [rx, ry] = rotXY(this.view, x, y);
      const [ax, ay] = rotXY(this.view, x0, y0);
      const [bx, by] = rotXY(this.view, x1, y1);
      // behind the map: trees; in front of it (where trees would hide the map): bushes, stones, low growth
      const far = rx < Math.min(ax, bx) || ry < Math.min(ay, by);
      if (far === front) continue;
      const roll = Math.abs((x * 73856093) ^ (y * 19349663)) % 1000 / 1000;
      if (roll > (far ? density : density * 0.45) || this.cells.has(cellKey(Math.max(x0, Math.min(x1, x)), Math.max(y0, Math.min(y1, y)))) === false) continue;
      const def = frame.catalog.items[(far ? kinds : lows)[Math.abs(x * 7 + y * 3) % (far ? kinds : lows).length]];
      if (!def) continue;
      const pv: PlacementView = { pid: -3, item: def.id, x, y, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true };
      const sprite = itemSprite(def, pv, 0, this.view, { season: frame.season });
      const at = this.rp(x, y);
      s.globalAlpha = d > APRON - 3 ? 0.6 : 1;
      s.drawImage(sprite.canvas, Math.round(at.x + sprite.x), Math.round(at.y + sprite.y));
    }
    s.globalAlpha = 1;
  }

  /**
   * Round a room, as in the cave: darkness. The rest of the house (the next rooms, its walls) stands round it as
   * dark blocks — up to the height of the walls behind the room, low beside and in front of it so they never hide
   * it — fading into the dark the further off they are. One room at a time, lit, in the dark of its house.
   */
  private paintDark(s: CanvasRenderingContext2D, frame: Frame): void {
    const room = frame.room;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let sx0 = Infinity, sy0 = Infinity;
    for (const [x, y] of room.cells) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      const [rx, ry] = rotXY(this.view, x, y);
      sx0 = Math.min(sx0, rx);
      sy0 = Math.min(sy0, ry);
    }
    const M = DARK_MARGIN;
    const cells: [number, number, number][] = [];
    for (let y = y0 - M; y <= y1 + M; y++) {
      for (let x = x0 - M; x <= x1 + M; x++) {
        if (this.cells.has(cellKey(x, y))) continue;
        cells.push([x, y, Math.max(0, x0 - x, x - x1, y0 - y, y - y1)]);
      }
    }
    cells.sort((a, b) => this.depth(a[0] + 0.5, a[1] + 0.5) - this.depth(b[0] + 0.5, b[1] + 0.5));
    // straight along the grid, like walls: standing behind the room, lying low beside and before it
    const tall = (x: number, y: number) => {
      if (this.cells.has(cellKey(x, y))) return false;
      const [rx, ry] = rotXY(this.view, x, y);
      return rx < sx0 || ry < sy0;
    };
    const low = 3;
    for (const [x, y, d] of cells) {
      const h = tall(x, y) ? WALL_PX : low;
      const fade = Math.min(1, d / M);
      // near the room the dark has the colour of the house's walls; further off it is only dark
      const top = rgbToHex(mixRgb([58, 50, 74], [20, 18, 28], fade));
      const left = rgbToHex(mixRgb([44, 38, 58], [16, 14, 22], fade));
      const right = rgbToHex(mixRgb([34, 30, 46], [14, 12, 20], fade));
      const [rx, ry] = rotXY(this.view, x, y);
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => rotXY(this.view, x + dx, y + dy));
      const p = proj(Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])));
      const ax = Math.round(p.x - TW / 2 + this.camX);
      const ay = Math.round(p.y + this.camY);
      // a face only where nothing as tall stands before it
      const [lx, ly] = unrotXY(this.view, rx, ry + 1);
      const [qx, qy] = unrotXY(this.view, rx + 1, ry);
      const sl = h > low && !tall(lx, ly) ? left : null;
      const sr = h > low && !tall(qx, qy) ? right : null;
      if (sl || sr) s.drawImage(blockSides(sl, sr, h), ax, ay - h);
      s.drawImage(floorTile({ color: top, alt: top, pattern: 'flat' }, 0, 0), ax, ay - h);
    }
  }

  /** Grass in the season, for the land round a map. */
  private seasonGrass(frame: Frame): { color: string; alt?: string; pattern?: string } {
    const params = frame.catalog.styles['floor.grass']?.params ?? {};
    const base = { color: params.color ?? '#6aa84f', alt: params.alt, pattern: params.pattern ?? 'grass', outdoor: true };
    return frame.season ? seasonalFloor(base, 'floor.grass', frame.season) : base;
  }

  /**
   * A cave is a hollow in rock: everything round its chambers is solid stone, drawn as blocks of rock up to the
   * height of its walls behind the chambers and kept low in front of them (so one can see in).
   */
  private paintRock(s: CanvasRenderingContext2D, frame: Frame): void {
    const room = frame.room;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of room.cells) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const M = 16;
    const rock: [number, number][] = [];
    for (let y = y0 - M; y <= y1 + M; y++) for (let x = x0 - M; x <= x1 + M; x++) if (!this.cells.has(cellKey(x, y))) rock.push([x, y]);
    rock.sort((a, b) => this.depth(a[0] + 0.5, a[1] + 0.5) - this.depth(b[0] + 0.5, b[1] + 0.5));
    const low = Math.round(WALL_PX * 0.25);
    const top = { color: '#3a3642', alt: '#2e2a36', pattern: 'stones', outdoor: true };
    for (const [x, y] of rock) {
      // in front of a chamber (seen from here) the rock is kept low
      const [rx, ry] = rotXY(this.view, x, y);
      let front = false;
      for (let k = 1; k <= 3 && !front; k++) {
        for (const [ux, uy] of [unrotXY(this.view, rx - k, ry), unrotXY(this.view, rx, ry - k), unrotXY(this.view, rx - k, ry - k)]) if (this.cells.has(cellKey(ux, uy))) front = true;
      }
      const h = front ? low : WALL_PX;
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => rotXY(this.view, x + dx, y + dy));
      const p = proj(Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])));
      const ax = Math.round(p.x - TW / 2 + this.camX);
      const ay = Math.round(p.y + this.camY);
      // the two faces towards the viewer, then the top
      s.drawImage(blockSides('#26222c', '#1c1922', h), ax, ay - h);
      s.drawImage(floorTile(top, x, y), ax, ay - h);
    }
  }

  private paintFloor(s: CanvasRenderingContext2D, frame: Frame, only?: [number, number][]): void {
    if (only) this.apronRing = null;
    else if (frame.underground) this.paintRock(s, frame);
    else if (frame.grounded) this.paintDark(s, frame);
    else if (frame.landscape) this.paintApron(s, frame);
    else this.apronRing = null;
    // in drawing order (each cell's depth worked out once, not at every comparison)
    const cells = (only ?? frame.room.cells).map((c) => ({ c, d: this.depth(c[0] + 0.5, c[1] + 0.5) })).sort((a, b) => a.d - b.d).map((e) => e.c);
    const hullPts: [number, number][] = [];
    for (const [x, y] of cells) {
      const [ax, ay] = this.paintCell(s, frame, x, y);
      // the outline of the floor: only cells at its edge can be on it (a big map has thousands inside)
      if (!this.cells.has(cellKey(x + 1, y)) || !this.cells.has(cellKey(x - 1, y)) || !this.cells.has(cellKey(x, y + 1)) || !this.cells.has(cellKey(x, y - 1))) {
        hullPts.push([ax, ay + TH / 2], [ax + TW, ay + TH / 2], [ax + TW / 2, ay], [ax + TW / 2, ay + TH]);
        // (raised land at the edge goes down to the ground round the map)
        if (this.terrainAt(x, y) > 0) {
          const [bx, by] = this.tileAt(x, y, 0);
          hullPts.push([bx, by + TH / 2], [bx + TW, by + TH / 2], [bx + TW / 2, by + TH]);
        }
      }
      // thickness of the floor on edges that face the viewer (not out of doors: the land goes on there), under the
      // tile's lower-left edge where there is no floor down-left of it, under its lower-right edge likewise (raised
      // land: under the foot of its side)
      if (!frame.landscape && !frame.grounded && !frame.underground) {
        const [i, j] = this.cellRot(x, y);
        for (const left of [true, false]) {
          const [nx, ny] = this.rotCell(left ? i : i + 1, left ? j + 1 : j);
          if (this.cells.has(cellKey(nx, ny))) continue;
          const [bx, by] = this.terrain ? this.tileAt(x, y, 0) : [ax, ay];
          const st = this.floorStyle(frame, x, y);
          const r = ramp(st.outdoor ? '#7a5238' : st.color);
          s.fillStyle = rgbToHex(left ? r[1] : r[0]);
          for (let k = 0; k < TW / 2; k++) s.fillRect(left ? bx + k : bx + TW / 2 + k, left ? by + TH / 2 + Math.ceil(k / 2) : by + TH - Math.ceil(k / 2), 1, FLOOR_DROP);
        }
      }
    }
    if (frame.landscape && !frame.underground && !frame.grounded && !only) this.paintApronGrowth(s, frame, true);
    this.hull = hullPts;
  }

  /** A cell of the floor with its sides: where its tile went. */
  private paintCell(s: CanvasRenderingContext2D, frame: Frame, x: number, y: number): [number, number] {
    const [ax, ay] = this.tileAt(x, y, this.terrainAt(x, y));
    // the land's sides down to lower land in front first (they hang below the top), then the top
    if (this.terrain) this.paintSlopes(s, frame, x, y, ax, ay);
    // unrotated cell coordinates keep patterns attached to the floor when the view turns
    s.drawImage(floorTile(this.floorStyle(frame, x, y), this.view % 2 ? y : x, this.view % 2 ? x : y), ax, ay);
    return [ax, ay];
  }

  /** Cells painted again over something they stand in front of (x, y pairs). */
  private paintCover(s: CanvasRenderingContext2D, frame: Frame, cover: number[]): void {
    for (let k = 0; k < cover.length; k += 2) this.paintCell(s, frame, cover[k], cover[k + 1]);
  }

  /**
   * The cells of raised land that hide part of a thing: in front of it (past its footprint `fx0…fy1` in the turned
   * grid, along either axis), higher than the ground it stands on (`ground`), and reaching over its picture (the
   * box `bx0…by1`, art pixels without the camera). The furthest first; null for none.
   */
  private coverOf(fx0: number, fy0: number, fx1: number, fy1: number, ground: number, bx0: number, by0: number, bx1: number, by1: number): number[] | null {
    const lie = this.lie;
    if (!lie || ground >= lie.top) return null;
    let out: number[] | null = null;
    const m0 = Math.floor(bx0 / (TW / 2)) - 1;
    const m1 = Math.ceil(bx1 / (TW / 2)) + 1;
    // a cell's top and sides reach from its height down to the ground: from a row of the grid (n = i + j) down
    const n0 = Math.max(Math.floor((by0 - TH) / (TH / 2)), Math.floor(fx0) + Math.floor(fy0));
    const n1 = Math.ceil((by1 + lie.top * ZPX) / (TH / 2));
    for (let n = n0; n <= n1; n++) {
      for (let m = m0 + ((((n + m0) % 2) + 2) % 2); m <= m1; m += 2) {
        const i = (n + m) / 2;
        const j = (n - m) / 2;
        if (i < fx1 && j < fy1) continue;
        const [x, y] = this.rotCell(i, j);
        const h = this.heightAt(x, y);
        if (h <= ground + 1) continue;
        const cx = m * (TW / 2);
        if (cx + TW / 2 <= bx0 || cx - TW / 2 >= bx1 || n * (TH / 2) - h * ZPX >= by1 || n * (TH / 2) + TH <= by0) continue;
        (out ??= []).push(x, y);
      }
    }
    return out;
  }

  /** What a cell's sides are made of, by the floor on it. */
  private faceStyle(frame: Frame, x: number, y: number): FaceStyle {
    const st = this.floorStyle(frame, x, y);
    const pattern = String(st.pattern ?? '');
    const painted = frame.room.floor_paint[cellKey(x, y)] ?? '';
    if (!st.outdoor || /gravel|rock|slate|cave|salt|water|ice|snow/.test(pattern + painted)) return { kind: 'rock', color: st.color };
    if (/stones|cobble|plaza|asphalt|tiles|marble|deck|plank/.test(pattern + painted)) return { kind: 'masonry', color: st.color };
    if (/sand|dune/.test(pattern + painted)) return { kind: 'sand', color: st.color };
    return { kind: 'earth', color: st.color };
  }

  /**
   * The sides of a raised cell that face the viewer, each from its top edge down to the land in front of it (down to
   * the ground round the map at its edge, down under the water by a quay): dressed stone under paving, earth under
   * turf, rock under gravel. Each is one picture whose columns meet the tile above and the tile below exactly.
   */
  private paintSlopes(s: CanvasRenderingContext2D, frame: Frame, x: number, y: number, ax: number, ay: number): void {
    const h = this.terrainAt(x, y);
    if (h <= 0) return;
    const [i, j] = this.cellRot(x, y);
    let style: FaceStyle | null = null;
    for (const left of [true, false]) {
      // the land in front: down-left of the tile across its lower-left edge, down-right across the other
      const [nx, ny] = this.rotCell(left ? i : i + 1, left ? j + 1 : j);
      const inside = this.cells.has(cellKey(nx, ny));
      const below = inside ? this.terrainAt(nx, ny) : 0;
      if (below >= h) continue;
      const drop = this.tileAt(nx, ny, below)[1] - ay - TH / 2;
      if (drop <= 0) continue;
      style ??= this.faceStyle(frame, x, y);
      const wet = inside && this.floorStyle(frame, nx, ny).pattern === 'water';
      s.drawImage(slopeFace(style, left, drop, wet, (x * 7 + y * 13) & 3), left ? ax : ax + TW / 2, ay + TH / 2);
    }
  }

  private paintBackWalls(s: CanvasRenderingContext2D, frame: Frame): void {
    const faces: { x: number; y: number; side: WallSide; depth: number }[] = [];
    for (const [x, y] of frame.room.cells) {
      // a back wall stands only where the floor ends (a cell with all four neighbours has none)
      if (this.cells.has(cellKey(x + 1, y)) && this.cells.has(cellKey(x - 1, y)) && this.cells.has(cellKey(x, y + 1)) && this.cells.has(cellKey(x, y - 1))) continue;
      for (const side of SIDES) {
        if (!isBackFacing(this.view, side) || !isWallEdge(this.cells, this.dividers, x, y, side)) continue;
        const [dx, dy] = DELTA[side];
        if (this.cells.has(cellKey(x + dx, y + dy))) continue;
        if (this.open(frame, x, y, side)) continue;
        const [x0, y0, x1, y1] = edgePoints(x, y, side);
        faces.push({ x, y, side, depth: this.depth((x0 + x1) / 2, (y0 + y1) / 2) });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    this.wallHits = [];
    for (const f of faces) {
      const [x0, y0, x1, y1] = edgePoints(f.x, f.y, f.side);
      let a = this.rp(x0, y0);
      let b = this.rp(x1, y1);
      if (a.x > b.x) [a, b] = [b, a];
      const dir = a.y < b.y ? 'right' : 'left';
      const along = f.side === 'north' || f.side === 'south' ? f.x : f.y;
      const piece = wallPiece(this.wallStyle(frame, f.x, f.y, f.side), dir, along);
      const top = Math.round(Math.min(a.y, b.y) - WALL_PX);
      s.drawImage(piece, Math.round(a.x), top);
      this.wallHits.push({ x: f.x, y: f.y, side: f.side, poly: [[a.x, a.y], [b.x, b.y], [b.x, b.y - WALL_PX], [a.x, a.y - WALL_PX]] });
      this.hull.push([a.x, a.y - WALL_PX], [b.x, b.y - WALL_PX]);
      // a dithered shade along the foot of the wall (one cached picture)
      const fx = Math.round(a.x);
      const fy = Math.round(a.y);
      const rise = Math.round(b.y - a.y);
      s.drawImage(wallFoot(dir, fx, fy, rise), fx, fy + Math.min(0, rise) + 1);
    }
  }

  private hostTop(frame: Frame, p: PlacementView): number {
    if (p.on === null) return 0;
    const host = frame.room.placements.find((q) => q.pid === p.on);
    const hd = host ? frame.catalog.items[host.item] : undefined;
    return hd ? topHeight(hd) : 0;
  }

  private paintShadows(s: CanvasRenderingContext2D, frame: Frame, dark: number): void {
    // the footprint of a kind of thing turned a way is the same wherever it stands
    const sizes = new Map<string, [number, number]>();
    // on raised land, the furthest first: the land in front painted again over a shadow behind it stays under the
    // shadows of what stands on it
    const all = this.lie ? [...frame.room.placements].sort((a, b) => this.depth(a.x, a.y) - this.depth(b.x, b.y)) : frame.room.placements;
    for (const p of all) {
      const def = frame.catalog.items[p.item];
      if (!def || def.layer !== 'floor') continue;
      const sk = `${p.item}|${p.rot}`;
      let size = sizes.get(sk);
      if (!size) {
        const cells = footprintCells(def, p.rot);
        size = [Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1];
        sizes.set(sk, size);
      }
      const [w, d] = size;
      // a quarter turn keeps the box a box: two opposite corners hold the least and the most
      const [ax0, ay0] = rotXY(this.view, p.x, p.y);
      const [ax1, ay1] = rotXY(this.view, p.x + w, p.y + d);
      const minRx = Math.min(ax0, ax1);
      const minRy = Math.min(ay0, ay1);
      const rw = Math.max(ax0, ax1) - minRx;
      const rd = Math.max(ay0, ay1) - minRy;
      const sh = shadowSprite(rw, rd, 0.75 - dark * 0.3);
      // on the land it stands on
      const ground = this.terrainAt(p.x, p.y);
      const o = proj(minRx, minRy, ground);
      const sx = Math.round(o.x - rd * (TW / 2) - 2 + 1);
      const sy = Math.round(o.y - 2 + 1);
      s.drawImage(sh, sx + this.camX, sy + this.camY);
      const cover = this.coverOf(minRx, minRy, minRx + rw, minRy + rd, ground, sx, sy, sx + sh.width, sy + sh.height);
      if (cover) this.paintCover(s, frame, cover);
    }
  }

  // ---- things in the room ----------------------------------------------------------------------------------

  private liveOf(def: ItemDef, p: PlacementView, frame: Frame, dark: number, sky: string): Live {
    const glow: Record<string, string> = {};
    const slots = new Set(def.model.map((m) => m.slot));
    const lamp = lampOf(def, p, dark);
    // an old lamp blinks now and then; a broken one stays dark
    const age = Number(p.props?.wear ?? 0);
    const blink = age === 2 && Math.floor(frame.time * 7 + p.pid * 3) % 11 === 0;
    const on = age < 3 && !blink && (lamp ? lamp.lit : p.props?.lit === '1');
    const f = Math.floor(frame.time * 6) % 3;
    for (const slot of slots) {
      if (!SLOT_LIVE.has(slot)) continue;
      if (slot === 'glass') {
        if (def.tags.includes('window')) glow.glass = sky;
        else if (def.tags.includes('mirror')) glow.glass = '#c7d6ea';
      } else if (slot === 'flame' || slot === 'fire') {
        if (on || slot === 'fire') glow[slot] = ['#ffcf4a', '#ffb43a', '#ffe28a'][f];
      } else if (slot === 'screen') {
        // an old screen shows snow between the pictures
        glow.screen = on ? (age >= 2 && Math.floor(frame.time * 3) % 2 === 0 ? ['#c8ccd4', '#8a8e98', '#e8eaf0'][f] : ['#6fc7ff', '#7fd3ff', '#8fbfff'][f]) : '#22283c';
      } else if (slot === 'glow') {
        if (on) glow.glow = lamp?.color ?? '#ffd27a';
      } else if ((slot === 'bulb' || slot === 'shade') && on) {
        glow[slot] = slot === 'bulb' ? '#fff3c4' : (p.colors.shade ?? def.slots.shade?.default ?? '#ffe7b0');
      }
    }
    return { glow, season: frame.season };
  }

  private anchor(p: PlacementView): { x: number; y: number } {
    return this.rp(p.x, p.y);
  }

  /** Big floor things (houses, trees, stalls) with their rotated extents, for ordering people around them. */
  private bigOf(frame: Frame): { minX: number; minY: number; maxX: number; maxY: number; key: number }[] {
    if (this.bigFor === frame.room && this.bigView === this.view) return this.bigList;
    this.bigFor = frame.room;
    this.bigView = this.view;
    this.bigList = [];
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      if (!def || def.layer !== 'floor') continue;
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map((c) => c[0])) + 1;
      const d = Math.max(...cells.map((c) => c[1])) + 1;
      if (w * d < 2) continue;
      const corners = [[0, 0], [w, 0], [0, d], [w, d]].map(([dx, dy]) => rotXY(this.view, p.x + dx, p.y + dy));
      this.bigList.push({
        minX: Math.min(...corners.map((c) => c[0])),
        minY: Math.min(...corners.map((c) => c[1])),
        maxX: Math.max(...corners.map((c) => c[0])),
        maxY: Math.max(...corners.map((c) => c[1])),
        key: this.center(def, p),
      });
    }
    return this.bigList;
  }

  private bigFor: RoomView | null = null;
  private bigView: View = 0;
  private bigList: { minX: number; minY: number; maxX: number; maxY: number; key: number }[] = [];

  /**
   * Drawing order of someone standing at a floor point: in front of every big thing they stand in front of
   * (past its front edges), behind every big thing they stand behind.
   */
  private personKey(frame: Frame, x: number, y: number): number {
    let key = this.depth(x, y);
    const [rx, ry] = rotXY(this.view, x, y);
    for (const b of this.bigOf(frame)) {
      if (rx < b.minX - 2 || ry < b.minY - 2 || rx > b.maxX + 2 || ry > b.maxY + 2) continue;
      if (rx >= b.maxX || ry >= b.maxY) key = Math.max(key, b.key + 0.002);
      else key = Math.min(key, b.key - 0.002);
    }
    return key;
  }

  private entCache: { room: RoomView; view: View; season: string; mode: WallMode; list: Ent[]; grid: SpotGrid } | null = null;

  /**
   * The room's things in drawing order, with where each lands on the floor and how far its picture can reach
   * (so things off the screen are passed over without making their pictures). Made once per room and view.
   */
  private entitiesOf(frame: Frame, mode: WallMode): Ent[] {
    const c = this.entCache;
    const season = frame.season ?? '';
    if (c && c.room === frame.room && c.view === this.view && c.season === season && c.mode === mode) return c.list;
    const { room, catalog } = frame;
    const byPid = new Map(room.placements.map((q) => [q.pid, q]));
    const list: Ent[] = [];
    for (const p of room.placements) {
      const def = catalog.items[p.item];
      if (!def) continue;
      let key = this.center(def, p);
      if (def.layer === 'rug') key = -1000 + key * 0.001;
      else if (def.layer === 'surface') {
        const host = p.on === null ? undefined : byPid.get(p.on);
        key = (host ? this.center(catalog.items[host.item], host) : key) + 0.01;
      } else if (def.layer === 'wall') {
        if (!p.wall) continue;
        const facing = this.wallFacesViewer(p);
        if (mode !== 'full' && facing && !this.outdoor(frame, p.x, p.y)) continue;
        const [ax, ay] = ALONG[p.wall];
        const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
        key = this.depth((x0 + x1) / 2 + ax * (def.footprint.w - 1) * 0.5, (y0 + y1) / 2 + ay * (def.footprint.w - 1) * 0.5) - 0.02;
      }
      const host = p.on === null ? undefined : byPid.get(p.on);
      const hd = host ? catalog.items[host.item] : undefined;
      const hostTop = hd ? topHeight(hd) : 0;
      // the picture's reach around the anchor: the footprint (rotated) and the tallest part
      const [rx, ry] = rotXY(this.view, p.x, p.y);
      // it stands on the land of its cell (a thing on another, on the land of that one)
      const ground = host ? this.terrainAt(host.x, host.y) : this.terrainAt(p.x, p.y);
      const o = proj(rx, ry, ground);
      const [w, d] = def.layer === 'floor' || def.layer === 'rug' ? this.sizeOf(def, p) : [1, 1];
      const [fa, fb] = rotXY(this.view, p.x + w, p.y + d);
      const reach = Math.max(def.footprint.w, def.footprint.d) + 1 + overhang(def);
      const tall = (topHeight(def) + hostTop + 40) * ZPX;
      list.push({
        p, def, key, hostTop, ox: o.x, oy: o.y,
        x0: -reach * (TW / 2) - 4, x1: reach * (TW / 2) + 4, y0: -tall - 8, y1: reach * TH + 8,
        live: liveItem(def),
        ground,
        foot: [Math.min(rx, fa), Math.min(ry, fb), Math.max(rx, fa), Math.max(ry, fb)],
      });
    }
    // where each picture can reach, in squares: a frame asks only the squares on the screen
    const grid = new SpotGrid(list.map((e) => [e.ox + e.x0, e.oy + e.y0, e.ox + e.x1, e.oy + e.y1]), 256);
    this.entCache = { room, view: this.view, season, mode, list, grid };
    return list;
  }

  private slabsCache: { room: RoomView; view: View; mode: WallMode; list: [number, number, number, number, string, number, number, number, boolean][] } | null = null;

  /** The wall slabs facing the viewer and the dividers, worked out once per room and view. */
  private slabsOf(frame: Frame, mode: WallMode): [number, number, number, number, string, number, number, number, boolean][] {
    const c = this.slabsCache;
    if (c && c.room === frame.room && c.view === this.view && c.mode === mode) return c.list;
    const { room, catalog } = frame;
    const list: [number, number, number, number, string, number, number, number, boolean][] = [];
    const doors = doorways(room, catalog);
    for (const [x, y, side] of room.dividers) {
      if (doors.has(`${x},${y},${side === 'east' ? 'e' : 's'}`)) continue; // a doorway: the door frame stands there instead
      const color = this.wallStyle(frame, x, y, side).color;
      if (side === 'east') list.push([x + 1 - 0.06, y, 0.12, 1, color, x + 1, y + 0.5, 0, true]);
      else list.push([x, y + 1 - 0.06, 1, 0.12, color, x + 0.5, y + 1, 0, true]);
    }
    for (const [x, y] of room.cells) {
      for (const side of SIDES) {
        const [dx, dy] = DELTA[side];
        if (this.cells.has(cellKey(x + dx, y + dy)) || isBackFacing(this.view, side)) continue;
        if (this.open(frame, x, y, side)) continue;
        const color = this.wallStyle(frame, x, y, side).color;
        const t = 0.1;
        if (side === 'north') list.push([x, y - t, 1, t, color, x + 0.5, y, 0, false]);
        else if (side === 'south') list.push([x, y + 1, 1, t, color, x + 0.5, y + 1, 0, false]);
        else if (side === 'west') list.push([x - t, y, t, 1, color, x, y + 0.5, 0, false]);
        else list.push([x + 1, y, t, 1, color, x + 1, y + 0.5, 0, false]);
      }
    }
    this.slabsCache = { room, view: this.view, mode, list };
    return list;
  }

  private turbinesOf: { room: RoomView; list: PlacementView[] } | null = null;
  private readonly slabPlaces = new WeakMap<object, { sprite: Sprite; x: number; y: number; key: number } | null>();

  /** A wall slab's picture, where it lands (before the camera) and its drawing order; null for one not standing. */
  private slabPlace(sl: [number, number, number, number, string, number, number, number, boolean], mode: WallMode): { sprite: Sprite; x: number; y: number; key: number } | null {
    let g = this.slabPlaces.get(sl);
    if (g !== undefined) return g;
    const [gx, gy, gw, gd, color, dx, dy, , divider] = sl;
    const h = mode === 'full' ? 210 : mode === 'cut' ? (divider ? 70 : 34) : divider ? 18 : 0;
    if (h <= 0) g = null;
    else {
      const corners = [[gx, gy], [gx + gw, gy], [gx, gy + gd], [gx + gw, gy + gd]].map(([x, y]) => rotXY(this.view, x, y));
      const rx = Math.min(...corners.map((c) => c[0]));
      const ry = Math.min(...corners.map((c) => c[1]));
      const rw = Math.max(...corners.map((c) => c[0])) - rx;
      const rd = Math.max(...corners.map((c) => c[1])) - ry;
      const o = proj(rx, ry);
      g = { sprite: this.slab(color, rw, rd, h), x: o.x, y: o.y, key: this.depth(dx, dy) };
    }
    this.slabPlaces.set(sl, g);
    return g;
  }

  /** A floor thing's width and depth in cells, turned as it stands. */
  private sizeOf(def: ItemDef, p: PlacementView): [number, number] {
    const cells = footprintCells(def, p.rot);
    return [Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1];
  }

  /** The raised land that hides part of someone standing at a floor point at a height, their figure about `feet`
   * (art pixels with the camera). */
  private personCover(x: number, y: number, ground: number, feet: { x: number; y: number }): number[] | null {
    if (!this.lie) return null;
    const [rx, ry] = rotXY(this.view, x, y);
    const fx = feet.x - this.camX;
    const fy = feet.y - this.camY;
    return this.coverOf(rx - 0.2, ry - 0.2, rx + 0.2, ry + 0.2, ground, fx - 16, fy - 40, fx + 16, fy + 3);
  }

  private center(def: ItemDef | undefined, p: PlacementView): number {
    if (!def) return 0;
    let w = 1;
    let d = 1;
    if (def.layer !== 'surface' && def.layer !== 'wall') {
      const cells = footprintCells(def, p.rot);
      w = Math.max(...cells.map((c) => c[0])) + 1;
      d = Math.max(...cells.map((c) => c[1])) + 1;
    }
    return this.depth(p.x + w / 2, p.y + d / 2);
  }

  private slab(color: string, gw: number, gd: number, h: number): Sprite {
    const key = `${color}|${gw.toFixed(3)}|${gd.toFixed(3)}|${h}`;
    let s = this.slabCache.get(key);
    if (!s) {
      s = toSprite(rasterize([{ gx: 0, gy: 0, gw, gd, z: 0, h, color }]));
      if (this.slabCache.size > 400) this.slabCache.clear();
      this.slabCache.set(key, s);
    }
    return s;
  }

  private layerSprite(layers: Layer[], size = layersSize(layers)): HTMLCanvasElement {
    let c = this.layerCache.get(layers);
    if (!c) {
      c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      for (const l of layers) {
        g.fillStyle = l.color;
        g.fill(new Path2D(l.path));
      }
      this.layerCache.set(layers, c);
    }
    return c;
  }

  private drawEntities(frame: Frame, dark: number, sky: string): void {
    const ctx = this.ctx;
    const { room, catalog, walker } = frame;
    const mode = wallMode(room.settings);
    const list: Drawable[] = [];
    // what stands where is worked out once for the room and the view; each frame only looks at what is on screen
    const ents = this.entitiesOf(frame, mode);
    const margin = 8;
    // something very big (a mountain, a whole building) thins to a veil while the hero is
    // behind it, so the hero and what is round them are not lost under it
    const heroFoot = this.rp(walker.x, walker.y);
    const heroKey = this.personKey(frame, walker.x, walker.y);
    const veiled = (sprite: { w: number; h: number; mask: Uint8Array | boolean[] | number[] }, sx: number, sy: number) => {
      for (const dy of [-6, -16, -26]) {
        const lx = Math.round(heroFoot.x) - sx;
        const ly = Math.round(heroFoot.y + dy) - sy;
        if (lx >= 0 && ly >= 0 && lx < sprite.w && ly < sprite.h && sprite.mask[ly * sprite.w + lx]) return true;
      }
      return false;
    };
    const grid = this.entCache?.grid;
    const near = grid ? grid.query(-this.camX - margin, -this.camY - margin, this.artW - this.camX + margin, this.artH - this.camY + margin) : null;
    for (let n = 0; n < (near ? near.length : ents.length); n++) {
      const e = ents[near ? near[n] : n];
      const bx = e.ox + this.camX;
      const by = e.oy + this.camY;
      if (bx + e.x0 > this.artW + margin || by + e.y0 > this.artH + margin || bx + e.x1 < -margin || by + e.y1 < -margin) continue;
      const { p, def, key } = e;
      const sprite =
        this.occupiedSprite(frame, def, p, e.hostTop) ??
        (e.live ? itemSprite(def, p, e.hostTop, this.view, this.liveOf(def, p, frame, dark, sky)) : (e.sprite ??= itemSprite(def, p, e.hostTop, this.view, { season: frame.season })));
      const sx = Math.round(bx + sprite.x);
      const sy = Math.round(by + sprite.y);
      // off the screen (on a big map most things are)
      if (sx > this.artW || sy > this.artH || sx + sprite.w < 0 || sy + sprite.h < 0) continue;
      const veil = !!def.tags?.includes('see_through') && key > heroKey && veiled(sprite, sx, sy);
      if (e.cover === undefined) e.cover = this.lie ? this.coverOf(...e.foot, e.ground, e.ox + sprite.x, e.oy + sprite.y, e.ox + sprite.x + sprite.w, e.oy + sprite.y + sprite.h) : null;
      list.push({
        key,
        cover: e.cover,
        draw: () => {
          if (veil) ctx.globalAlpha = 0.35;
          ctx.drawImage(sprite.canvas, sx, sy);
          ctx.globalAlpha = 1;
          this.hits.push({ pid: p.pid, x: sx, y: sy, sprite });
        },
      });
    }

    // walls that face the viewer and dividers are slabs among the items
    // (each slab's picture and place are worked out once; the slabs off the screen are passed over)
    for (const sl of this.slabsOf(frame, mode)) {
      const g = this.slabPlace(sl, mode);
      if (!g) continue;
      const sx = Math.round(g.x + this.camX + g.sprite.x);
      const sy = Math.round(g.y + this.camY + g.sprite.y);
      if (sx > this.artW || sy > this.artH || sx + g.sprite.w < 0 || sy + g.sprite.h < 0) continue;
      list.push({ key: g.key, draw: () => ctx.drawImage(g.sprite.canvas, sx, sy) });
    }

    for (const pet of [...(frame.pet ? [frame.pet] : []), ...(frame.pets ?? [])]) {
      const pf = this.rpWalk(pet.x, pet.y, pet.lift / OLD_Z);
      list.push({
        key: this.personKey(frame, pet.x, pet.y) + 0.0001,
        cover: this.personCover(pet.x, pet.y, this.terrainAt(pet.x, pet.y) + pet.lift / OLD_Z, pf),
        draw: () => {
          ctx.drawImage(shadowSprite(0.35, 0.35, 0.6), this.snap(pf.x - 6), this.snap(pf.y - 3));
          ctx.drawImage(this.layerSprite(pet.layers), this.snap(pf.x - 16), this.snap(pf.y - 30));
        },
      });
    }

    for (const m of frame.movers ?? []) {
      const def = catalog.items[m.item];
      if (!def) continue;
      const odd = m.rot % 2 === 1;
      const w = odd ? def.footprint.d : def.footprint.w;
      const d = odd ? def.footprint.w : def.footprint.d;
      const p: PlacementView = { pid: -3, item: m.item, x: 0, y: 0, rot: m.rot, wall: null, on: null, colors: m.colors ?? {}, props: {}, known: true };
      const on = m.flash && Math.floor(frame.time * 4) % 2 === 0;
      // sirens flash; after dusk headlights and tail lights are on
      const glow: Record<string, string> = {};
      // two beacons taking turns: blue, then red
      if (m.flash) {
        glow.siren = on ? '#6aa0ff' : '#1c2a55';
        glow.siren2 = on ? '#4a1a1a' : '#ff4a4a';
      }
      if (dark > 0.3 && def.category === 'vehicle') {
        glow.light = '#fff3c4';
        glow.tail = '#ff5a5a';
      }
      // (drawn from its corner, lifted to the eased land under its middle)
      const lift = (m.z ?? 0) + this.easedAt(m.x, m.y) - this.terrainAt(m.x - w / 2, m.y - d / 2);
      const at = this.rp(m.x - w / 2, m.y - d / 2, lift);
      // (off the screen: not even its picture made)
      if (at.x > this.artW + 120 || at.y > this.artH + 160 || at.x < -120 || at.y < -160) continue;
      const live = { glow, season: frame.season };
      const sprite = itemSprite(def, p, 0, this.view, live);
      if (at.x + sprite.x > this.artW + 40 || at.y + sprite.y > this.artH + 40 || at.x + sprite.x + sprite.w < -40 || at.y + sprite.y + sprite.h < -40) continue;
      // a bird up in the air: its shadow on the ground under it, fainter the higher it is
      if (lift > 20) {
        const ground = this.rp(m.x, m.y);
        const k = Math.max(0.3, 1 - lift / 400);
        list.push({ key: this.depth(m.x, m.y) - 0.3, draw: () => ctx.drawImage(shadowSprite(0.45 * k, 0.45 * k, 0.5 * k), this.snap(ground.x - 8 * k), this.snap(ground.y - 3 * k)) });
      }
      list.push({ key: lift > 20 ? this.personKey(frame, m.x, m.y) + lift / 40 : this.personKey(frame, m.x, m.y), draw: () => ctx.drawImage(sprite.canvas, this.snap(at.x + sprite.x), this.snap(at.y + sprite.y + m.bob)) });
    }

    for (const f of frame.fires ?? []) {
      // tongues of fire along the roof's ridge, drawn just in front of the burning building
      list.push({
        key: this.depth(f.x + f.w / 2, f.y + f.h / 2) + 0.01,
        draw: () => {
          // sparks drifting up
          for (let i = 0; i < 6 + f.fire; i++) {
            const age = (frame.time * 0.9 + i * 0.29) % 1;
            const sp = this.rp(f.x + ((i * 0.618) % 1) * f.w, f.y + f.h / 2, 190 + age * 300);
            ctx.fillStyle = age < 0.5 ? '#ffe28a' : '#ff8a3a';
            ctx.globalAlpha = 1 - age;
            ctx.fillRect(this.snap(sp.x + Math.sin(i * 3 + frame.time * 2) * 6 * age), this.snap(sp.y), 1, 1);
          }
          ctx.globalAlpha = 1;
          const tongues = Math.min(18, 4 + f.fire * 2);
          for (let i = 0; i < tongues; i++) {
            const u = 0.1 + ((i * 0.618) % 1) * 0.8;
            const v = 0.35 + ((i * 0.381) % 1) * 0.3;
            const base = this.rp(f.x + u * f.w, f.y + v * f.h, 175 + ((i * 7) % 20));
            const flick = Math.sin(frame.time * 11 + i * 2.3);
            const hgt = 5 + Math.round((flick + 1) * 3) + Math.min(8, f.fire);
            const w = 3 + (i % 2);
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ff8a3a';
            ctx.fillRect(base.x - w, base.y - hgt - 2, w * 3, hgt + 3);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#e8582e';
            ctx.fillRect(base.x - w / 2, base.y - hgt, w, hgt);
            ctx.fillStyle = flick > 0 ? '#ffe28a' : '#ffb43a';
            ctx.fillRect(base.x - w / 2 + 1, base.y - hgt * 0.7, Math.max(1, w - 2), hgt * 0.7);
          }
        },
      });
    }

    this.npcHits = [];
    for (const n of frame.npcs ?? []) {
      const seatP = n.seat ? room.placements.find((q) => q.pid === n.seat?.pid) : undefined;
      const at = seatP ? this.rp(n.x, n.y, n.seat ? n.seat.lift / OLD_Z : 0) : this.rpWalk(n.x, n.y, 0);
      list.push({
        key: seatP ? this.center(catalog.items[seatP.item], seatP) + 0.04 : this.personKey(frame, n.x, n.y),
        cover: seatP ? null : this.personCover(n.x, n.y, this.terrainAt(n.x, n.y), at),
        draw: () => {
          if (n.swim) this.drawSwimmer(n.layers, at.x, at.y, frame.time);
          else if (seatP) {
            // sitting: on the seat, the seat's nearer parts over them
            const k = n.scale ?? 1;
            const S = layersSize(n.layers);
            ctx.drawImage(this.layerSprite(n.layers), this.snap(at.x - (S / 2) * k), this.snap(at.y - feetRow(S) * k + 4), S * k, S * k);
            this.drawSeatOver(catalog.items[seatP.item], seatP, n.x, n.y, frame);
          } else {
            const S = layersSize(n.layers);
            const k = (n.scale ?? 1) * (S / 32);
            ctx.drawImage(shadowSprite(0.4 * k, 0.4 * k, 0.7), this.snap(at.x - 7 * k), this.snap(at.y - 3 * k));
            ctx.drawImage(this.layerSprite(n.layers), this.snap(at.x - (S / 2) * (n.scale ?? 1)), this.snap(at.y - feetRow(S) * (n.scale ?? 1) - (n.hop ?? 0)), S * (n.scale ?? 1), S * (n.scale ?? 1));
          }
          if (n.emote) {
            const bob = Math.floor(frame.time * 3) % 2;
            const ex = Math.round(at.x - 10);
            const ey = Math.round(at.y - (n.swim ? 40 : 52) - bob - (n.hop ?? 0));
            ctx.drawImage(this.bubble('#f4eedf'), ex, ey);
            ctx.drawImage(this.glyph(n.emote, n.emoteColor ?? '#f4eedf'), ex + 4, ey + 4);
          }
          this.npcHits.push({ id: n.id, x: Math.round(at.x), y: Math.round(at.y) - (n.swim ? -10 : 0) });
        },
      });
    }

    // (a seat's lift is in the old renderer's pixels; a root's height in hundredths of a tile, as the stage's)
    // (the height one stands at counts the land; the land is added by rp itself)
    const land = this.terrainAt(walker.x, walker.y);
    const lift = frame.seat ? frame.seat.lift / OLD_Z : (frame.heroLift ?? 0) - land;
    const feet = this.rp(walker.x, walker.y, lift);
    // standing on a root: drawn after the root under the feet (its own cell's depth), not sunk into it
    const onTop = !frame.seat && (frame.heroGround ?? 0) - land > 0 ? this.depth(Math.floor(walker.x) + 0.5, Math.floor(walker.y) + 0.5) + 0.01 : -Infinity;
    const seatPlacement = frame.seat ? room.placements.find((q) => q.pid === frame.seat?.pid) : undefined;
    const heroDrawKey = seatPlacement ? this.center(catalog.items[seatPlacement.item], seatPlacement) + 0.05 : Math.max(this.personKey(frame, walker.x, walker.y), onTop);
    list.push({
      key: heroDrawKey,
      // (on the way up a hop or down a fall, as high as one is now)
      cover: frame.seat || frame.driving ? null : this.personCover(walker.x, walker.y, land + lift, feet),
      draw: () => {
        // at the wheel: the car (a mover) is all there is to see
        if (frame.driving) return;
        if (frame.swimming) {
          this.drawSwimmer(frame.playerLayers, feet.x, feet.y, frame.time, frame.walker);
          return;
        }
        if (frame.seat?.mode === 'lie' || frame.seat?.mode === 'bath') {
          // in the bed (or the bath) as part of it, drawn with it; here only the z's of sleep
          const def = seatPlacement ? catalog.items[seatPlacement.item] : undefined;
          if (def && seatPlacement && frame.seat.look && this.occupiedDef(def, frame.seat.mode)) {
            if (frame.seat.mode === 'lie') this.drawSleep(frame, headPoint(def, seatPlacement, 'lie'));
          } else this.drawLying(frame, seatPlacement, feet);
          return;
        }
        if (!frame.seat) {
          // the shadow on what is underfoot, smaller the higher a hop goes
          const ground = this.rp(walker.x, walker.y, (frame.heroGround ?? 0) - land);
          const k = Math.max(0.55, 1 - Math.max(0, lift - ((frame.heroGround ?? 0) - land)) / 90);
          ctx.drawImage(shadowSprite(0.4 * k, 0.4 * k, 0.7), this.snap(ground.x - 7 * k), this.snap(ground.y - 3 * k));
        }
        // on a bicycle: the bike under the rider, the rider up on its saddle
        const bikeDef = frame.bike !== undefined ? catalog.items.bicycle : undefined;
        if (bikeDef) {
          const bp: PlacementView = { pid: -2, item: 'bicycle', x: 0, y: 0, rot: frame.bike ?? 0, wall: null, on: null, colors: {}, props: {}, known: true };
          const sprite = itemSprite(bikeDef, bp, 0, this.view);
          const at = this.rp(walker.x - 0.5, walker.y - 0.5);
          ctx.drawImage(sprite.canvas, this.snap(at.x + sprite.x), this.snap(at.y + sprite.y));
        }
        const seated = frame.seat?.lift ?? 0;
        // (the hero's grid is 40, the old figures' 32: the feet on the ground point either way)
        const HS = layersSize(frame.playerLayers);
        const heroAt = { x: this.snap(feet.x - HS / 2), y: this.snap(feet.y - feetRow(HS) + (bikeDef ? -7 : frame.sitting && !seated ? 4 : seated ? 4 : 0)) };
        ctx.drawImage(this.layerSprite(frame.playerLayers), heroAt.x, heroAt.y);
        this.heroGhost = { canvas: this.layerSprite(frame.playerLayers), ...heroAt };
        this.heroHands = { x: heroAt.x + HS / 2, y: heroAt.y + Math.round((HS * 20) / 32) };
        const hand = HS === 32 ? { r: 22, l: 10, y: 24 } : { r: 25, l: 15, y: 28 };
        // the thing at hand, small, in the hand on the side one faces
        // (and the thing in the left hand, smaller, on the other side)
        for (const [id, near] of [[frame.held, true], [frame.offhand, false]] as const) {
          const heldDef = id && !frame.seat ? catalog.items[id] : undefined;
          if (!heldDef) continue;
          const hp: PlacementView = { pid: near ? -5 : -6, item: heldDef.id, x: 0, y: 0, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true };
          const s = itemSprite(heldDef, hp, 0, this.view);
          const most = near ? 11 : 9;
          const k = Math.min(1, most / Math.max(1, s.w), most / Math.max(1, s.h));
          const w = Math.max(1, Math.round(s.w * k));
          const hgt = Math.max(1, Math.round(s.h * k));
          const right = (walker.facing !== 'left') === near;
          ctx.drawImage(s.canvas, heroAt.x + (right ? hand.r : hand.l - w), heroAt.y + (near ? hand.y : hand.y + 1) - hgt, w, hgt);
        }
        // the parts of the seat nearer the eye (a chair's back turned away, an armchair's near arm) over the sitter
        if (seatPlacement && frame.seat?.mode === 'sit') this.drawSeatOver(catalog.items[seatPlacement.item], seatPlacement, walker.x, walker.y, frame);
      },
    });

    // water from the tap over the washing hands, and soap bubbles
    if (frame.washAt) {
      const w = frame.washAt;
      list.push({
        key: this.personKey(frame, walker.x, walker.y) + 0.01,
        draw: () => {
          for (let i = 0; i < 6; i++) {
            const t = (frame.time * 2.4 + i / 6) % 1;
            const p = this.rp(w.x, w.y, w.z / OLD_Z + 14 - t * 16);
            ctx.fillStyle = i % 2 ? '#8fd0f6' : '#d8f0ff';
            ctx.fillRect(this.snap(p.x + (i % 3) - 1), this.snap(p.y), 1, 2);
          }
          for (let i = 0; i < 5; i++) {
            const t = (frame.time * 0.7 + i * 0.37) % 1;
            const p = this.rp(w.x, w.y, w.z / OLD_Z + 4 + t * 12);
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.snap(p.x + Math.sin(i * 2.1 + frame.time) * 5), this.snap(p.y), 2, 2);
          }
          ctx.globalAlpha = 1;
        },
      });
    }

    if (frame.ghost) {
      const g = frame.ghost;
      const def = catalog.items[g.item];
      if (def) {
        const gp: PlacementView = { pid: -1, item: g.item, x: g.x, y: g.y, rot: g.rot, wall: g.wall, on: g.on, colors: g.colors ?? {}, props: g.props ?? {}, known: true };
        const sprite = itemSprite(def, gp, this.hostTop(frame, gp), this.view);
        const at = this.anchor(gp);
        list.push({
          key: this.center(def, gp) + 0.5,
          draw: () => {
            ctx.save();
            ctx.globalAlpha = 0.75;
            ctx.drawImage(g.valid ? sprite.canvas : this.tinted(sprite, '#ff5a5a'), Math.round(at.x + sprite.x), Math.round(at.y + sprite.y));
            ctx.restore();
          },
        });
      }
    }
    // the wind turbines' blades turn, faster the harder the wind blows
    if (this.turbinesOf?.room !== room) this.turbinesOf = { room, list: room.placements.filter((p) => catalog.items[p.item]?.tags.includes('turbine')) };
    for (const p of this.turbinesOf.list) {
      const def = catalog.items[p.item];
      if (!def) continue;
      const hub = { x: p.x + def.footprint.w / 2, y: p.y + def.footprint.d * 0.83, z: 538 };
      const c = this.rp(hub.x, hub.y, hub.z);
      if (c.x < -100 || c.y < -100 || c.x > this.artW + 100 || c.y > this.artH + 100) continue;
      const turn = frame.time * (frame.wind ?? 1) * 1.4 + p.x * 0.7 + p.y * 1.3;
      list.push({ key: this.center(def, p) + 0.02, draw: () => this.drawBlades(hub, turn) });
    }
    // wires sag between the poles; each piece is drawn at its own depth, so buildings in front hide it
    for (const w of frame.wires ?? []) this.pushWire(list, w);
    list.sort((a, b) => a.key - b.key);
    for (const d of list) {
      d.draw();
      // the raised land in front of it, over it again
      if (d.cover) this.paintCover(ctx, frame, d.cover);
    }
  }

  private readonly occupiedDefs = new Map<string, ItemDef | null>();

  /** The thing with someone lying in it (see occupant.ts); null when it has nowhere to lie. */
  private occupiedDef(def: ItemDef, mode: Rest): ItemDef | null {
    const key = `${def.id}+${mode}+${def.model.length}`;
    let d = this.occupiedDefs.get(key);
    if (d === undefined) {
      const model = occupiedModel(def, mode);
      d = model ? { ...def, id: `${def.id}+${mode}`, model } : null;
      this.occupiedDefs.set(key, d);
    }
    return d;
  }

  private occupiedSprite(frame: Frame, def: ItemDef, p: PlacementView, hostTop: number): Sprite | null {
    const seat = frame.seat;
    if (!seat || seat.pid !== p.pid || !seat.look || (seat.mode !== 'lie' && seat.mode !== 'bath')) return null;
    const occ = this.occupiedDef(def, seat.mode);
    if (!occ) return null;
    return itemSprite(occ, { ...p, colors: { ...p.colors, ...sleeperColors(seat.look) } }, hostTop, this.view, { season: frame.season });
  }

  /** Draws again over the sitter the parts of their seat that stand nearer the eye. */
  private drawSeatOver(def: ItemDef | undefined, p: PlacementView, x: number, y: number, frame: Frame): void {
    if (!def) return;
    const soft = def.model.filter((m) => ['cushion', 'sheet', 'blanket', 'body', 'seat'].includes(m.slot) && m.box[2] + m.box[5] <= 62);
    const top = soft.length > 0 ? Math.max(...soft.map((m) => m.box[2] + m.box[5])) : Math.min(46, topHeight(def));
    const parts = nearParts(def, p, this.view, x, y, top);
    if (parts.length === 0) return;
    const sub: ItemDef = { ...def, id: `${def.id}#${parts.join('.')}`, model: parts.map((i) => def.model[i]) };
    const sprite = itemSprite(sub, p, 0, this.view, { season: frame.season });
    const at = this.anchor(p);
    this.ctx.drawImage(sprite.canvas, Math.round(at.x + sprite.x), Math.round(at.y + sprite.y));
  }

  /** A slow z rising now and then over a sleeper's head. */
  private drawSleep(frame: Frame, head: { x: number; y: number; z: number } | null): void {
    if (!head) return;
    const ctx = this.ctx;
    const at = this.rp(head.x, head.y, head.z / OLD_Z);
    const t = (frame.time * 0.4) % 1;
    if (t >= 0.7) return;
    ctx.globalAlpha = 1 - t / 0.7;
    ctx.fillStyle = '#f4eedf';
    const zx = this.snap(at.x + 4 + t * 8);
    const zy = this.snap(at.y - 8 - t * 14);
    ctx.fillRect(zx, zy, 4, 1);
    ctx.fillRect(zx + 2, zy + 1, 1, 1);
    ctx.fillRect(zx + 1, zy + 2, 1, 1);
    ctx.fillRect(zx, zy + 3, 4, 1);
    ctx.globalAlpha = 1;
  }

  /** A figure in the water: head and shoulders above it, rings of ripples around. */
  /** Lying on a bed under its blanket, or in a bath up to the chin in foam. */
  private drawLying(frame: Frame, bed: PlacementView | undefined, feet: { x: number; y: number }): void {
    const ctx = this.ctx;
    const seat = frame.seat;
    if (!seat) return;
    const sprite = this.layerSprite(frame.playerLayers);
    const S = layersSize(frame.playerLayers);
    const K = S / 32;
    const { x: wx, y: wy } = frame.walker;
    const [ax, ay] = seat.axis ?? [0, 1];
    const a0 = this.rp(wx, wy);
    const a1 = this.rp(wx + ax, wy + ay);
    const angle = Math.atan2(a1.y - a0.y, a1.x - a0.x) - Math.PI / 2;
    if (seat.mode === 'bath') {
      // only the head above the water; foam round it; the water's skin
      const x = this.snap(feet.x);
      const y = this.snap(feet.y);
      const top = Math.round(14 * K) + (S === 32 ? 0 : 2);
      ctx.drawImage(sprite, 0, 0, S, top, x - S / 2, y - top, S, top);
      ctx.fillStyle = 'rgba(168,216,234,0.9)';
      ctx.fillRect(x - 11, y - 1, 22, 3);
      for (let i = 0; i < 14; i++) {
        const t = (frame.time * 0.5 + i * 0.13) % 1;
        const r = 2 + (i % 3);
        ctx.fillStyle = i % 4 === 0 ? '#e8f6ff' : '#ffffff';
        ctx.fillRect(x - 12 + ((i * 7) % 24), y - 2 - Math.round(Math.sin(i + frame.time * 2) * 1.5) - (t > 0.8 ? 3 : 0), r, r - 1);
      }
      return;
    }
    ctx.save();
    ctx.translate(this.snap(feet.x), this.snap(feet.y - 6));
    ctx.rotate(angle);
    ctx.drawImage(sprite, -S / 2, -Math.round(18 * K) - (S === 32 ? 0 : 2));
    // the blanket over the body, up to the shoulders, with its turned-down edge
    const blanket = bed?.colors.blanket ?? bed?.colors.sheet ?? '#8fb8de';
    ctx.fillStyle = blanket;
    ctx.fillRect(-10, -4, 20, 16 + (S === 32 ? 0 : 4));
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-10, -4, 20, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-10, 10 + (S === 32 ? 0 : 4), 20, 2);
    ctx.restore();
    // sleep: a slow z rising now and then
    const t = (frame.time * 0.4) % 1;
    if (t < 0.7) {
      ctx.globalAlpha = 1 - t / 0.7;
      ctx.fillStyle = '#f4eedf';
      const zx = this.snap(feet.x + 6 + t * 8);
      const zy = this.snap(feet.y - 22 - t * 14);
      ctx.fillRect(zx, zy, 4, 1);
      ctx.fillRect(zx + 2, zy + 1, 1, 1);
      ctx.fillRect(zx + 1, zy + 2, 1, 1);
      ctx.fillRect(zx, zy + 3, 4, 1);
      ctx.globalAlpha = 1;
    }
  }

  private drawSwimmer(layers: Layer[], fx: number, fy: number, time: number, walker?: { x: number; y: number }): void {
    const ctx = this.ctx;
    const x = this.snap(fx);
    const y = this.snap(fy);
    const bob = Math.round(Math.sin(time * 3) * 0.8);
    // the top of the figure (19 rows of the old 32, 23 of the hero's 40), lowered so the water cuts it at the chest
    const S = layersSize(layers);
    const R = S === 32 ? 19 : 23;
    ctx.drawImage(this.layerSprite(layers), 0, 0, S, R, x - S / 2, y - R + bob, S, R);
    // arms reaching over in turn (a crawl), splashing where they go in
    const stroke = Math.sin(time * 5);
    const skin = '#f1c9a5';
    for (const side of [-1, 1]) {
      const up = side * stroke;
      if (up <= 0.1) continue;
      const ax = x + side * 9;
      const top = Math.round(y - 4 - up * 7 + bob);
      ctx.fillStyle = skin;
      ctx.fillRect(ax - 1, top, 3, Math.max(2, Math.round(up * 7)));
      if (up > 0.85) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) ctx.fillRect(ax - 3 + i * 2, y - 2 - (i % 2) * 2, 1, 1);
      }
    }
    // a little wake behind, flickering
    if (walker) {
      ctx.fillStyle = 'rgba(232,246,255,0.7)';
      for (let i = 1; i < 4; i++) ctx.fillRect(x - 4 - i * 3, y + 2 + i, 2, 1), ctx.fillRect(x + 3 + i * 3, y + 2 + i, 2, 1);
    }
    const phase = (time * 1.6) % 1;
    for (const [r, alpha] of [[5 + phase * 5, 0.9 - phase * 0.7], [10 + phase * 4, 0.5 - phase * 0.4]] as [number, number][]) {
      ctx.fillStyle = `rgba(232,246,255,${Math.max(0, alpha).toFixed(2)})`;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + bob + Math.sin(a) * r * 0.45), 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(232,246,255,0.95)';
    ctx.fillRect(x - 6, y + bob, 12, 1);
  }

  private tinted(s: Sprite, color: string): HTMLCanvasElement {
    let c = this.tintCache.get(s);
    if (!c) {
      c = document.createElement('canvas');
      c.width = s.w;
      c.height = s.h;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.drawImage(s.canvas, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = color;
      g.globalAlpha = 0.6;
      g.fillRect(0, 0, s.w, s.h);
      this.tintCache.set(s, c);
    }
    return c;
  }

  private outline(s: Sprite): HTMLCanvasElement {
    let c = this.outlineCache.get(s);
    if (!c) {
      c = document.createElement('canvas');
      c.width = s.w + 2;
      c.height = s.h + 2;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = '#ffd27a';
      for (let y = -1; y <= s.h; y++) {
        for (let x = -1; x <= s.w; x++) {
          const inside = x >= 0 && y >= 0 && x < s.w && y < s.h && s.mask[y * s.w + x] !== 0;
          if (inside) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const qx = x + dx;
            const qy = y + dy;
            return qx >= 0 && qy >= 0 && qx < s.w && qy < s.h && s.mask[qy * s.w + qx] !== 0;
          });
          if (near) g.fillRect(x + 1, y + 1, 1, 1);
        }
      }
      this.outlineCache.set(s, c);
    }
    return c;
  }

  private diamond(color: string): HTMLCanvasElement {
    const key = `d|${color}`;
    let c = this.glyphCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = TW;
      c.height = TH;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = color;
      for (let y = 0; y < TH; y++) {
        const half = y < TH / 2 ? (y + 1) * 2 : (TH - y) * 2;
        g.fillRect(TW / 2 - half, y, half * 2, 1);
      }
      this.glyphCache.set(key, c);
    }
    return c;
  }

  /** Whether a wall item hangs on a wall that faces the viewer from inside the shown room (a cut-away wall). */
  private wallFacesViewer(p: PlacementView): boolean {
    if (!p.wall) return false;
    const inside = this.cells.has(cellKey(p.x, p.y));
    // seen from the other room the item is on the opposite face of the same wall
    const side = inside ? p.wall : ({ north: 'south', south: 'north', east: 'west', west: 'east' } as const)[p.wall];
    return !isBackFacing(this.view, side);
  }

  /** Doors in cut-away walls: a lit mat on the floor shows the way out. */
  private drawExits(frame: Frame): void {
    const ctx = this.ctx;
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      if (!def || !p.wall || !def.tags.includes('door') || !this.wallFacesViewer(p)) continue;
      for (const [x, y, side] of wallEdgesOfItem(def, p.x, p.y, p.wall)) {
        const [dx, dy] = DELTA[side];
        const cell = this.cells.has(cellKey(x, y)) ? [x, y] : [x + dx, y + dy];
        if (!this.cells.has(cellKey(cell[0], cell[1]))) continue;
        const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([ex, ey]) => rotXY(this.view, cell[0] + ex, cell[1] + ey));
        const q = proj(Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])));
        const pulse = Math.floor(frame.time * 2) % 2 ? 0.45 : 0.3;
        ctx.drawImage(this.diamond(`rgba(246,179,71,${pulse})`), Math.round(q.x - TW / 2 + this.camX), Math.round(q.y + this.camY));
      }
    }
  }

  private drawOverlays(frame: Frame): void {
    const ctx = this.ctx;
    this.drawExits(frame);
    // smoke from burning buildings rises above everything
    (frame.fires ?? []).forEach((f, fi) => {
      const puffs = Math.min(24, 6 + f.fire * 2);
      for (let i = 0; i < puffs; i++) {
        const age = (frame.time * 0.35 + i / puffs) % 1;
        const u = 0.25 + ((i * 0.618 + fi * 0.37) % 1) * 0.5;
        const sp = this.rp(f.x + u * f.w, f.y + f.h / 2, 200 + age * 520);
        const r = 3 + Math.round(age * 7);
        ctx.fillStyle = `rgba(${60 + Math.round(age * 60)},${56 + Math.round(age * 56)},${62 + Math.round(age * 60)},${(0.55 * (1 - age)).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sp.x + Math.sin(i * 1.7 + frame.time * 0.8) * 4 * age, sp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // money on the road: a coin glinting now and then, or a crumpled note
    (frame.coins ?? []).forEach((c, i) => {
      const p = this.rp(c.x, c.y, 1);
      if (p.x < -12 || p.y < -12 || p.x > this.artW + 12 || p.y > this.artH + 12) return;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      ctx.fillStyle = 'rgba(20, 16, 30, 0.35)';
      ctx.fillRect(x - 4, y + 1, 9, 2);
      if (c.note) {
        ctx.fillStyle = '#2f5f3a';
        ctx.fillRect(x - 5, y - 3, 11, 6);
        ctx.fillStyle = '#7ab87a';
        ctx.fillRect(x - 4, y - 2, 9, 4);
        ctx.fillStyle = '#e0ffd9';
        ctx.fillRect(x - 1, y - 1, 3, 2);
        ctx.fillStyle = '#5aa469';
        ctx.fillRect(x - 4, y - 2, 1, 4);
      } else {
        ctx.fillStyle = '#8a5a2e';
        ctx.fillRect(x - 3, y - 1, 7, 3);
        ctx.fillStyle = '#e8a23a';
        ctx.fillRect(x - 3, y - 3, 7, 4);
        ctx.fillStyle = '#f4d35e';
        ctx.fillRect(x - 2, y - 3, 5, 3);
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(x - 1, y - 3, 2, 1);
      }
      const phase = (frame.time * 0.8 + i * 0.41) % 1;
      if (phase < 0.3) {
        ctx.save();
        ctx.globalAlpha = 1 - phase / 0.3;
        ctx.fillStyle = '#fffbe6';
        ctx.fillRect(x + 1, y - 10, 1, 7);
        ctx.fillRect(x - 2, y - 7, 7, 1);
        ctx.restore();
      }
    });
    // twinkles over what can be gathered: each its own rhythm
    (frame.sparkles ?? []).forEach((sp, i) => {
      const phase = (frame.time * 1.3 + i * 0.37) % 1;
      if (phase > 0.55) return;
      const p = this.rp(sp.x, sp.y, 26 + Math.round(phase * 10));
      if (p.x < -12 || p.y < -12 || p.x > this.artW + 12 || p.y > this.artH + 12) return;
      ctx.save();
      ctx.globalAlpha = 0.95 - phase;
      ctx.drawImage(this.glyph('sparkle', '#fff6c8'), Math.round(p.x - 6), Math.round(p.y - 6));
      ctx.restore();
    });
    for (const h of frame.highlight ?? []) {
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => rotXY(this.view, h.x + dx, h.y + dy));
      const p = proj(Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), this.terrainAt(h.x, h.y));
      ctx.drawImage(this.diamond(h.ok ? 'rgba(85,214,194,0.45)' : 'rgba(255,90,90,0.45)'), Math.round(p.x - TW / 2 + this.camX), Math.round(p.y + this.camY));
    }
    for (const e of frame.highlightEdges ?? []) {
      const [x0, y0, x1, y1] = edgePoints(e.x, e.y, e.side);
      const a = this.rp(x0, y0);
      const b = this.rp(x1, y1);
      ctx.fillStyle = e.ok ? 'rgba(85,214,194,0.7)' : 'rgba(255,90,90,0.7)';
      for (let i = 0; i <= 16; i++) ctx.fillRect(Math.round(a.x + ((b.x - a.x) * i) / 16), Math.round(a.y + ((b.y - a.y) * i) / 16) - 12, 1, 12);
    }
    if ((frame.selectedPids ?? []).length > 0 && Math.floor(frame.time * 3) % 3 !== 0) {
      for (const pid of frame.selectedPids ?? []) {
        const hit = this.hits.find((h) => h.pid === pid);
        if (hit) ctx.drawImage(this.outline(hit.sprite), hit.x - 1, hit.y - 1);
      }
    }
  }

  // ---- light -------------------------------------------------------------------------------------------------

  /**
   * Window light and lamp glows change only with the room and the light of the day, so they are painted once into
   * a layer (the whole map for a big one) and added onto each frame.
   */
  private drawLight(frame: Frame, dark: number): void {
    const whole = frame.follow ? this.bounds(frame.room) : null;
    const w = whole ? Math.ceil(whole.maxX - whole.minX) + 8 : this.artW;
    const h = whole ? Math.ceil(whole.maxY - whole.minY) + 8 : this.artH;
    const key = [this.roomId(frame.room), this.view, whole ? 'whole' : `${this.camX},${this.camY}`, w, h, Math.round(dark * 24), frame.minimal ? 'm' : ''].join('|');
    // (a big map with no light at all is painted too: there is nothing to draw)
    if (key !== this.lightKey || (!whole && !this.lightCanvas)) {
      // a big map's light is written down and painted in chunks, like its floor; a room's is painted as seen
      const rec = whole ? new Recorder() : null;
      let g: CanvasRenderingContext2D;
      if (rec) {
        this.lightCanvas = null;
        g = rec as unknown as CanvasRenderingContext2D;
      } else {
        this.lightChunks = null;
        if (!this.lightCanvas || this.lightCanvas.width !== w || this.lightCanvas.height !== h) {
          this.lightCanvas = document.createElement('canvas');
          this.lightCanvas.width = w;
          this.lightCanvas.height = h;
        }
        g = this.lightCanvas.getContext('2d') as CanvasRenderingContext2D;
        g.clearRect(0, 0, w, h);
      }
      const cam: [number, number] = [this.camX, this.camY];
      const hull = this.hull;
      // paint in the static layer's coordinates
      this.camX = this.staticCam[0];
      this.camY = this.staticCam[1];
      this.hull = this.staticHull;
      this.lightBox = null;
      if (!(frame.minimal && frame.follow)) this.drawWindowLight(g, frame, dark);
      this.drawLamps(g, frame, dark);
      if (rec) this.lightChunks = rec.ops.length ? new ChunkedLayer(rec.ops, w, h, { clip: this.staticHull.length >= 3 ? convexHull(this.staticHull) : undefined, composite: 'lighter' }) : null;
      [this.camX, this.camY] = cam;
      this.hull = hull;
      this.lightKey = key;
    }
    const ctx = this.ctx;
    const ox = this.camX - this.staticCam[0];
    const oy = this.camY - this.staticCam[1];
    if (this.lightChunks) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.lightChunks.draw(ctx, ox, oy, this.artW, this.artH);
      ctx.restore();
      return;
    }
    const box = this.lightBox;
    if (!box || !this.lightCanvas) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // only where there is light
    const x0 = Math.max(Math.floor(box[0]), -ox, 0);
    const y0 = Math.max(Math.floor(box[1]), -oy, 0);
    const x1 = Math.min(Math.ceil(box[2]), this.artW - ox, this.lightCanvas.width);
    const y1 = Math.min(Math.ceil(box[3]), this.artH - oy, this.lightCanvas.height);
    if (x1 > x0 && y1 > y0) ctx.drawImage(this.lightCanvas, x0, y0, x1 - x0, y1 - y0, x0 + ox, y0 + oy, x1 - x0, y1 - y0);
    ctx.restore();
  }

  /**
   * Where there is no light but what one carries: all dark, but for a round of light about the hero's hands (a
   * torch's flickers). Four bands of dark and one cached picture a frame, nothing more.
   */
  private drawCarriedLight(frame: Frame): void {
    const hl = frame.handLight;
    if (!hl) return;
    const ctx = this.ctx;
    const at = this.heroHands ?? { x: this.artW / 2, y: this.artH / 2 };
    // a flame breathes between three sizes, a few times a second
    const beat = hl.flicker ? [1, 0.95, 1.04, 0.97][Math.floor(frame.time * 7) % 4] : 1;
    const rx = Math.max(6, Math.round(hl.reach * (TW / 2) * beat));
    const ry = Math.max(4, Math.round(rx * 0.62));
    const x0 = Math.round(at.x - rx), y0 = Math.round(at.y - ry), x1 = x0 + 2 * rx, y1 = y0 + 2 * ry;
    ctx.save();
    // a warm glow on what the light falls on
    if (hl.reach > 1.5) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = hl.flicker ? 0.38 : 0.26;
      ctx.drawImage(glowSprite(hl.color, Math.round(rx * 0.8), 0.62), Math.round(at.x - rx * 0.8), Math.round(at.y - rx * 0.8 * 0.62));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = `rgba(${DARK_RGB.join(',')},${DARK_ALPHA})`;
    const W = this.artW, H = this.artH;
    if (y0 > 0) ctx.fillRect(0, 0, W, y0);
    if (y1 < H) ctx.fillRect(0, y1, W, H - y1);
    if (x0 > 0) ctx.fillRect(0, Math.max(0, y0), x0, Math.min(H, y1) - Math.max(0, y0));
    if (x1 < W) ctx.fillRect(x1, Math.max(0, y0), W - x1, Math.min(H, y1) - Math.max(0, y0));
    ctx.drawImage(darkHole(rx, ry), x0, y0);
    ctx.restore();
  }

  /** The glow of fires and the water from the hoses, over the light of the day (so the night does not hide them). */
  private drawFireLight(frame: Frame, dark: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of frame.fires ?? []) {
      // a wide warm glow over the street and a bright heart over the flames, flickering
      const flick = Math.sin(frame.time * 9) * 0.08 + Math.sin(frame.time * 23) * 0.05;
      const wide = this.rp(f.x + f.w / 2, f.y + f.h / 2, 20);
      const rw = 46 + Math.min(40, f.fire * 5);
      ctx.globalAlpha = Math.min(1, 0.55 + dark * 0.6 + flick);
      ctx.drawImage(glowSprite('#ff7a2a', rw, 0.6), wide.x - rw, wide.y - rw * 0.6);
      const heart = this.rp(f.x + f.w / 2, f.y + f.h / 2, 190);
      const rh = 24 + Math.min(20, f.fire * 2);
      ctx.globalAlpha = Math.min(1, 0.75 + dark * 0.4 + flick);
      ctx.drawImage(glowSprite('#ffd27a', rh), heart.x - rh, heart.y - rh);
      ctx.drawImage(glowSprite('#ff9a3a', rh + 10), heart.x - rh - 10, heart.y - rh - 10);
    }
    // beacons of the police, the ambulance and the fire truck throw blue and red on the road
    for (const m of frame.movers ?? []) {
      if (!m.flash) continue;
      const on = Math.floor(frame.time * 4) % 2 === 0;
      const at = this.rp(m.x, m.y, 30);
      const r = 26;
      ctx.globalAlpha = Math.min(1, 0.45 + dark * 0.55);
      ctx.drawImage(glowSprite(on ? '#4a7aff' : '#ff3a3a', r, 0.55), at.x - r, at.y - r * 0.55);
    }
    ctx.restore();
    for (const sp of frame.sprays ?? []) {
      // the hose along the ground from the truck to the firefighter's hands
      if (sp.hose) {
        const h0 = this.rp(sp.hose.x, sp.hose.y, 4);
        const h1 = this.rp(sp.from.x, sp.from.y, 4);
        ctx.fillStyle = '#8a2a22';
        for (let i = 0; i <= 30; i++) {
          const t = i / 30;
          ctx.fillRect(this.snap(h0.x + (h1.x - h0.x) * t), this.snap(h0.y + (h1.y - h0.y) * t + Math.sin(t * 9) * 1.5), 2, 2);
        }
      }
      const a = this.rp(sp.from.x, sp.from.y, 70);
      const b = this.rp(sp.to.x, sp.to.y, 150);
      for (let i = 0; i < 24; i++) {
        const t = (i / 24 + frame.time * 1.5) % 1;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 16;
        ctx.fillStyle = i % 3 === 0 ? '#f2fbff' : '#8fd0f6';
        ctx.fillRect(this.snap(x), this.snap(y), 2, 2);
      }
    }
  }

  /** Draws only the part of a layer that falls on the screen. */
  private blit(src: HTMLCanvasElement, ox: number, oy: number): void {
    const sx = Math.max(0, -ox);
    const sy = Math.max(0, -oy);
    const w = Math.min(src.width - sx, this.artW - Math.max(0, ox));
    const h = Math.min(src.height - sy, this.artH - Math.max(0, oy));
    if (w <= 0 || h <= 0) return;
    this.ctx.drawImage(src, sx, sy, w, h, Math.max(0, ox), Math.max(0, oy), w, h);
  }

  private clipRoom(ctx: CanvasRenderingContext2D): void {
    if (this.hull.length < 3) return;
    let pts = this.hullOf.get(this.hull);
    if (!pts) {
      pts = convexHull(this.hull);
      this.hullOf.set(this.hull, pts);
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.clip();
  }

  private drawWindowLight(ctx: CanvasRenderingContext2D, frame: Frame, dark: number): void {
    const day = 1 - dark;
    const strength = day > 0.15 ? day : dark > 0.6 ? (dark - 0.6) * 0.8 : 0;
    if (strength <= 0.02) return;
    ctx.save();
    this.clipRoom(ctx);
    ctx.globalCompositeOperation = 'lighter';
    const col = day > 0.15 ? [60, 52, 30] : [26, 32, 60];
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      if (!def || !def.tags.includes('window') || !p.wall) continue;
      const [x0, y0] = edgePoints(p.x, p.y, p.wall);
      const [ax, ay] = ALONG[p.wall];
      const [dx, dy] = DELTA[p.wall];
      const len = def.footprint.w;
      const depth = 1.4 + len * 0.3;
      for (let i = 0; i < len * 16; i++) {
        const along = (i + 0.5) / 16;
        for (let j = 0; j < depth * 16; j++) {
          const into = (j + 0.5) / 16;
          const wx = x0 + ax * (along + into * 0.4) - dx * into;
          const wy = y0 + ay * (along + into * 0.4) - dy * into;
          const q = this.rp(wx, wy);
          const fall = (1 - into / depth) * strength;
          const bar = Math.abs(((along * 2) % 1) - 0.5) < 0.06;
          if (bar || fall < bayer(Math.round(q.x), Math.round(q.y)) * 1.4) continue;
          ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
          this.grow(q.x, q.y, 1, 1);
        }
      }
    }
    ctx.restore();
  }

  private drawLamps(ctx: CanvasRenderingContext2D, frame: Frame, dark: number): void {
    ctx.save();
    this.clipRoom(ctx);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      const lamp = lampOf(def, p, dark);
      if (!def || !lamp || !lamp.lit) continue;
      const k = lamp.strength * Math.max(0.35, dark);
      const lift = this.hostTop(frame, p);
      const tip = lift + Math.max(topHeight(def) - 18, 10);
      let hx = p.x + 0.5;
      let hy = p.y + 0.5;
      if (def.layer === 'wall' && p.wall) {
        const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
        const [dx, dy] = DELTA[p.wall];
        hx = (x0 + x1) / 2 - dx * 0.2;
        hy = (y0 + y1) / 2 - dy * 0.2;
      }
      const head = this.rp(hx, hy, tip);
      const base = this.rp(hx, hy, def.layer === 'wall' ? 0 : lift);
      // outdoors (a big map) lamps light a wider circle of the street
      const out = frame.follow ? 1.5 : 1;
      const r1 = Math.round((20 + 22 * lamp.strength) * out);
      const r2 = Math.round((26 + 30 * lamp.strength) * out);
      ctx.globalAlpha = Math.min(1, 0.9 * k * out);
      const halo = glowSprite(lamp.color, r1);
      ctx.drawImage(halo, Math.round(head.x - r1), Math.round(head.y - r1));
      this.grow(head.x - r1, head.y - r1, r1 * 2, r1 * 2);
      const pool = glowSprite(lamp.color, r2, 0.5);
      ctx.drawImage(pool, Math.round(base.x - r2), Math.round(base.y - r2 * 0.5));
      this.grow(base.x - r2, base.y - r2, r2 * 2, r2 * 2);
    }
    ctx.restore();
  }

  // ---- hint above the thing the player can use ---------------------------------------------------------------

  private glyph(name: string, color: string): HTMLCanvasElement {
    const key = `${name}|${color}`;
    let c = this.glyphCache.get(key);
    if (!c) {
      const bits = glyphBits(name);
      c = document.createElement('canvas');
      c.width = 12;
      c.height = 12;
      const o = c.getContext('2d') as CanvasRenderingContext2D;
      o.fillStyle = color;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (bits[y * 12 + x]) o.fillRect(x, y, 1, 1);
      this.glyphCache.set(key, c);
    }
    return c;
  }

  private bubble(color: string): HTMLCanvasElement {
    const key = `b|${color}`;
    let c = this.glyphCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = 20;
      c.height = 23;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          const d = Math.hypot(x - 9.5, y - 9.5);
          if (d > 9.6) continue;
          g.fillStyle = d > 8.6 ? color : '#1b1d2e';
          g.fillRect(x, y, 1, 1);
        }
      }
      g.fillStyle = color;
      g.fillRect(9, 20, 2, 1);
      g.fillRect(9, 21, 1, 1);
      this.glyphCache.set(key, c);
    }
    return c;
  }

  private drawHint(frame: Frame): void {
    const t = frame.target;
    if (!t) return;
    const p = frame.room.placements.find((q) => q.pid === t.pid);
    const def = p ? frame.catalog.items[p.item] : undefined;
    if (!p || !def) return;
    let anchor: { x: number; y: number };
    if (def.layer === 'wall' && p.wall) {
      const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
      const [ax, ay] = ALONG[p.wall];
      anchor = this.rp((x0 + x1) / 2 + ax * (def.footprint.w - 1) * 0.5, (y0 + y1) / 2 + ay * (def.footprint.w - 1) * 0.5, topHeight(def) + 20);
    } else {
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map((c) => c[0])) + 1;
      const d = Math.max(...cells.map((c) => c[1])) + 1;
      anchor = this.rp(p.x + w / 2, p.y + d / 2, this.hostTop(frame, p) + topHeight(def) + 20);
    }
    const name = t.kind === 'door' ? 'door' : t.action;
    const color = cueColor('hint');
    const bob = Math.floor(frame.time * 3) % 2;
    const x = Math.round(anchor.x - 10);
    const y = Math.round(anchor.y - 23 - bob);
    this.ctx.drawImage(this.bubble(color), x, y);
    this.ctx.drawImage(this.glyph(name, color), x + 4, y + 4);
  }
}

/** Ground through the year: fresh in spring, golden in autumn, under snow in winter, the river dark and cold. */
function seasonalFloor<T extends { color: string; alt?: string; pattern?: string; outdoor: boolean }>(style: T, id: string, full: string): T {
  const [season, w] = full.split(':');
  const week = Number(w ?? 1) || 0;
  const green = style.pattern === 'grass' || style.pattern === 'meadow';
  if (season === 'Winter') {
    // the first week: snow lies in patches and the water has not frozen yet; then everything is white and iced
    // the water keeps flowing (the river never freezes; a lake frozen over is laid as ice by the map itself)
    if (id === 'floor.water') return { ...style, color: '#3f7aa8', alt: '#c4dcee' };
    if (id === 'floor.ice') return style;
    if (green || style.pattern === 'soil' || style.pattern === 'sand') return week === 0 ? { ...style, color: '#a8b8a0', alt: '#eef2f8', pattern: 'meadow' } : { ...style, color: '#e8eef6', alt: '#cdd8e6', pattern: 'gravel' };
    return { ...style, alt: '#e8eef6' };
  }
  if (season === 'Spring' && week === 0 && green) return { ...style, color: '#7a9a5a', alt: '#e8eef6', pattern: 'meadow' };
  if (!green) return style;
  if (season === 'Autumn') return week >= 2 ? { ...style, color: id === 'floor.moss' ? '#6a6a3a' : '#a08e50', alt: '#c87a3a', pattern: 'meadow' } : { ...style, color: id === 'floor.moss' ? '#6f7a3a' : '#9aa045', alt: '#c9a050' };
  if (season === 'Spring') return { ...style, color: id === 'floor.moss' ? '#5a9a46' : '#78c05a', alt: style.pattern === 'meadow' ? '#f4f0a0' : '#68b04c' };
  return style;
}

function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

export const PX_ZPX = ZPX;
/** Height units in a step of the land (village.ts STEP). */
const TERRAIN_STEP = STEP;
/** The floors of the open land out in the world (not a town's), where the cliffs throw their shade. */
export const PX_WALL = WALL_PX;
export type { RoomView, WallSide };
void wallEdgesOfItem;

/** The row of a figure's grid that stands on the ground: 30 of the old 32, 38 of the hero's 40. */
function feetRow(size: number): number {
  return Math.round((size * 30) / 32);
}
