// Draws the isometric room on a canvas. Reads views, never changes state.

import type { Sleeper } from './pixel/occupant';
import { daylight } from './daylight';
import { ALONG, DELTA, cellKey, cellSet, dividerSet, edgeKey, isBackFacing, isWallEdge, rotXY, unrotXY, wallEdgesOfItem, wallOrientation, type View } from './geometry';
import { GLYPHS } from './icons';
import { project, unproject, TILE, Z_PER_CENTI, type Pt } from './iso';
import { boxFaces, footprintCells, modelFaces, paintFace, rotateWorldBox, shade, topHeight, type Face } from './models';
import { drawBackdrop, drawWeather } from './render/backdrop';
import { drawPixelThumb } from './pixel/items';
import { clampZoom, fitCamera, type Bounds } from './render/camera';
import { ambientFor, lampOf, lightMinute, shadowsOn, wallMode, type WallMode } from './render/lighting';
import { drawFinish, drawFloorCell, drawWallFace, hash2, type SurfaceParams } from './render/surfaces';
import type { Layer } from './sprites';
import { layersSize } from './layers';
import type { Catalog, ItemDef, PlacementView, RoomView, WallSide } from './types';
import type { Target, Walker } from './world';

export const WALL_H = 118; // pixels
const FLOOR_THICKNESS = 8;
const SPRITE_SCALE = 2; // pixels per sprite cell, before the camera
const DIVIDER_T = 0.1; // tiles
const SIDES: WallSide[] = ['north', 'east', 'south', 'west'];

/** Parts that move or glow: an item with one of them is drawn fresh every frame. */
const LIVE_SLOTS = new Set(['flame', 'fire', 'glow', 'screen', 'water', 'bulb']);
const LIGHT_TAG = 'light';
const liveCache = new WeakMap<ItemDef, boolean>();
function isLive(def: ItemDef): boolean {
  let v = liveCache.get(def);
  if (v === undefined) {
    v = def.tags.includes('window') || def.tags.includes('portal') || def.tags.includes('mirror') || def.tags.includes(LIGHT_TAG) || def.tags.includes('switch') || def.model.some((m) => LIVE_SLOTS.has(m.slot));
    liveCache.set(def, v);
  }
  return v;
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function bounds(points: [number, number][]): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

export interface Ghost {
  item: string;
  x: number;
  y: number;
  rot: number;
  wall: WallSide | null;
  on: number | null;
  valid: boolean;
  colors?: Record<string, string>;
  props?: Record<string, string>;
}

import type { PlantOnHorizon } from './pixel/plant';

export interface Frame {
  room: RoomView;
  catalog: Catalog;
  walker: Walker;
  playerLayers: Layer[];
  /** The pet, if any: floor position, how high it sits above the floor (pixels) and its sprite. */
  pet?: { x: number; y: number; lift: number; layers: Layer[] } | null;
  /** The other animals of the house (each as the pet). */
  pets?: { x: number; y: number; lift: number; layers: Layer[] }[];
  minuteOfDay: number;
  /** Seconds, for animation. */
  time: number;
  view: View;
  zoom: number;
  pan: { x: number; y: number };
  ghost?: Ghost | null;
  selectedPids?: number[];
  /** Floor cells and wall faces to tint (editing hints). */
  highlight?: { x: number; y: number; ok: boolean }[];
  highlightEdges?: { x: number; y: number; side: WallSide; ok: boolean }[];
  target?: Target | null;
  /** Draw the walker sitting down (lowered). */
  sitting?: boolean;
  /** How high the hero stands (on a root), and the ground under them, hundredths of a tile (a hop goes above). */
  heroLift?: number;
  /** What the hero holds (the thing in the chosen place at hand). */
  held?: string | null;
  /** What the hero holds in the left hand. */
  offhand?: string | null;
  heroGround?: number;
  /** The seat the walker sits on: drawn just after that item, raised by `lift` pixels. */
  seat?: { pid: number; lift: number; mode?: 'sit' | 'lie' | 'bath'; axis?: [number, number]; look?: Sleeper } | null;
  /** Hands being washed under a tap here (x, y in tiles, z the basin's height in hundredths). */
  washAt?: { x: number; y: number; z: number };
  /** Pixels at the bottom of the canvas that are covered by the interface. */
  insetBottom?: number;
  /** Draw less detail (no patterns, simpler shadows) on slow devices. */
  lowDetail?: boolean;
  /** Out of doors on a map: land all round it to the horizon instead of open sky, and earth at its edges. */
  landscape?: boolean;
  /** A room of a house or a building: it stands on a lawn in the landscape rather than in the air. */
  grounded?: boolean;
  /** Under the ground: the room is a hollow in solid rock. */
  underground?: boolean;
  /** The slowest phones: no drifting clouds, no light map over a big map, thin weather. */
  minimal?: boolean;
  /** A big map (the village): the camera follows this floor point instead of fitting the whole room. */
  follow?: { x: number; y: number } | null;
  /** Other people on the floor. */
  npcs?: NpcFigure[];
  /** The player is swimming. */
  swimming?: boolean;
  /** Floor points where something can be gathered today. */
  sparkles?: { x: number; y: number }[];
  /** Money lying on the road: coins, or a note. */
  coins?: { x: number; y: number; note: boolean }[];
  /** The player is at the wheel: the car (a mover) is drawn instead of them. */
  driving?: boolean;
  /**
   * A place with no light but what one carries (the dark ways): how far the light in the hands reaches (cells; a
   * little round the hero with none), whether it flickers (a flame in the open), and its colour.
   */
  handLight?: { reach: number; flicker: boolean; color: string };
  /** Vehicles and animals: models moving over the floor (centred on x, y). */
  movers?: { item: string; x: number; y: number; rot: number; bob: number; flash?: boolean; z?: number; colors?: Record<string, string> }[];
  /** The season outdoors (a big map): ground and trees follow it. */
  season?: string;
  /** How overcast the sky is (0 clear .. 1 storm), and whether lightning flashes now. */
  overcast?: number;
  lightning?: boolean;
  /** Hoses: water from a firefighter to the fire. */
  sprays?: { from: { x: number; y: number }; to: { x: number; y: number }; hose?: { x: number; y: number } }[];
  /** Looking over the whole map from up high (the water tower). */
  overview?: boolean;
  /** Wires hung between poles: x, y in tiles, z in hundredths of a tile. */
  wires?: { a: [number, number, number]; b: [number, number, number] }[];
  /** The player is riding a bicycle, facing this way (quarter turns, like a mover). */
  bike?: number;
  /** How hard the wind blows (1 a breeze, 3 a storm): the turbines turn with it. */
  wind?: number;
  /** Buildings on fire (floor rectangles) and how fiercely. */
  fires?: { x: number; y: number; w: number; h: number; fire: number }[];
  /** The nuclear plant being built on the horizon (out of doors), if its building has begun. */
  plant?: PlantOnHorizon | null;
  /** Fireworks over the town (a celebration's night). */
  fireworks?: boolean;
}

export interface NpcFigure {
  id: string;
  x: number;
  y: number;
  layers: Layer[];
  /** In the water: only head and shoulders show, with ripples. */
  swim?: boolean;
  /** A small icon over the head (what they are doing). */
  emote?: string | null;
  /** The colour of the icon (a pink heart, a red anger mark…); the usual ink when absent. */
  emoteColor?: string;
  /** Raised off the ground by this many pixels (a skip in the step). */
  hop?: number;
  /** Size relative to a grown-up (children are smaller). */
  scale?: number;
  /** Sitting on this seat, raised by `lift` pixels (drawn just after it, its nearer parts over them). */
  seat?: { pid: number; lift: number };
}

export type Pick =
  | { kind: 'item'; pid: number; cell: [number, number]; exact?: boolean }
  | { kind: 'wall'; x: number; y: number; side: WallSide }
  | { kind: 'floor'; x: number; y: number }
  | { kind: 'npc'; id: string };

const glyphCache = new Map<string, Path2D>();
function glyph(name: string): Path2D {
  let p = glyphCache.get(name);
  if (!p) {
    p = new Path2D(GLYPHS[name] ?? 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6');
    glyphCache.set(name, p);
  }
  return p;
}

/** Draws a 24x24 stroke glyph centred at (cx, cy). */
export function drawGlyph(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(glyph(name));
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function pointInPoly(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface Drawable {
  key: number;
  pid?: number;
  faces: Face[];
  alpha?: number;
  tint?: string;
  def?: ItemDef;
  placement?: PlacementView;
  custom?: () => void;
}

interface Hit {
  pid: number;
  polys: [number, number][][];
}

interface WallHit {
  x: number;
  y: number;
  side: WallSide;
  poly: [number, number][];
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

export class VectorScene {
  private ctx: CanvasRenderingContext2D;
  private readonly mainCtx: CanvasRenderingContext2D;
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticKey = '';
  private backdropCanvas: HTMLCanvasElement | null = null;
  private backdropKey = '';
  private backdropAt = 0;
  private readonly glows = new Map<string, HTMLCanvasElement>();
  private readonly roomIds = new WeakMap<object, number>();
  private nextRoomId = 1;
  private readonly sprites = new Map<string, { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }>();
  private dpr = 1;
  /** Upper limit of the canvas pixel ratio; lowered on slow devices. */
  private maxDpr = 2;
  private cssW = 0;
  private cssH = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private view: View = 0;
  private hits: Hit[] = [];
  private wallHits: WallHit[] = [];
  private cells = new Set<string>();
  private dividers = new Set<string>();
  private fade: { img: HTMLCanvasElement; start: number; ms: number } | null = null;
  /** The room's silhouette (floor and back walls), so lamp light does not spill onto the scenery. */
  private lightClip = new Path2D();
  private clipPoints: Pt[] = [];
  /** Milliseconds spent per phase, summed over frames (for profiling with ?debug). */
  readonly prof: Record<string, number> = {};
  private lap = 0;
  /** Collect `prof` only when asked (the debug build); it costs a clock read per phase. */
  profiling = false;
  private mark(name: string): void {
    if (!this.profiling) return;
    const now = performance.now();
    this.prof[name] = (this.prof[name] ?? 0) + (now - this.lap);
    this.lap = now;
  }
  private readonly pathCache = new WeakMap<Layer[], Path2D[]>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context is unavailable');
    this.ctx = ctx;
    this.mainCtx = ctx;
  }

  /** After a failed frame: draw into the screen again and rebuild the cached layers. */
  recover(): void {
    this.ctx = this.mainCtx;
    this.staticKey = '';
  }

  setMaxPixelRatio(r: number): void {
    if (r === this.maxDpr) return;
    this.maxDpr = r;
    this.resize();
  }

  resize(): void {
    const px = Number(new URLSearchParams(location.search).get('px') ?? 0);
    this.dpr = px > 0 ? 1 / px : Math.max(1, Math.min(this.maxDpr, window.devicePixelRatio || 1));
    this.canvas.style.imageRendering = px > 0 ? 'pixelated' : '';
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.cssH * this.dpr));
    this.staticKey = '';
    this.sprites.clear();
  }

  /** A copy of what is on screen now, to cross-fade into the next view. */
  startFade(ms: number, now: number): void {
    const img = document.createElement('canvas');
    img.width = this.canvas.width;
    img.height = this.canvas.height;
    img.getContext('2d')?.drawImage(this.canvas, 0, 0);
    this.fade = { img, start: now, ms };
  }

  // ---- projection ---------------------------------------------------------------------------------

  private proj(x: number, y: number, z = 0): Pt {
    const [rx, ry] = rotXY(this.view, x, y);
    return project(rx, ry, z);
  }

  /** CSS-pixel position of a world point (tiles, height in pixels). */
  toScreen(x: number, y: number, z = 0): { x: number; y: number } {
    const p = this.proj(x, y, z);
    return { x: p.x * this.scale + this.ox, y: p.y * this.scale + this.oy };
  }

  /** The world point on the floor plane under a CSS-pixel point (tiles, floats). */
  floorPoint(cssX: number, cssY: number, z = 0): { x: number; y: number } {
    const g = unproject((cssX - this.ox) / this.scale, (cssY - this.oy) / this.scale, z);
    const [x, y] = unrotXY(this.view, g.x, g.y);
    return { x, y };
  }

  private computeBounds(room: RoomView): Bounds {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const grow = (p: Pt) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    };
    for (const [cx, cy] of room.cells) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) grow(this.proj(cx + dx, cy + dy, -FLOOR_THICKNESS));
      for (const side of SIDES) {
        if (!isBackFacing(this.view, side) || !isWallEdge(this.cells, this.dividers, cx, cy, side)) continue;
        const [x0, y0, x1, y1] = edgePoints(cx, cy, side);
        grow(this.proj(x0, y0, WALL_H));
        grow(this.proj(x1, y1, WALL_H));
      }
    }
    return { minX, maxX, minY, maxY };
  }

  /** What is under a CSS-pixel point of the canvas. */
  pick(cssX: number, cssY: number): Pick | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hit = this.hits[i];
      if (hit.polys.some((poly) => pointInPoly(cssX, cssY, poly))) {
        const f = this.floorPoint(cssX, cssY);
        return { kind: 'item', pid: hit.pid, cell: [Math.floor(f.x), Math.floor(f.y)] };
      }
    }
    for (let i = this.wallHits.length - 1; i >= 0; i--) {
      const w = this.wallHits[i];
      if (pointInPoly(cssX, cssY, w.poly)) return { kind: 'wall', x: w.x, y: w.y, side: w.side };
    }
    const f = this.floorPoint(cssX, cssY);
    const x = Math.floor(f.x);
    const y = Math.floor(f.y);
    return this.cells.has(cellKey(x, y)) ? { kind: 'floor', x, y } : null;
  }

  /** The cell side nearest a point on the floor, if the point is close to one (for dividers and wall tools). */
  pickEdge(cssX: number, cssY: number, tolerance = 0.3): { x: number; y: number; side: WallSide } | null {
    const f = this.floorPoint(cssX, cssY);
    const cx = Math.floor(f.x);
    const cy = Math.floor(f.y);
    const fx = f.x - cx;
    const fy = f.y - cy;
    const options: [number, WallSide][] = [[fy, 'north'], [1 - fx, 'east'], [1 - fy, 'south'], [fx, 'west']];
    options.sort((a, b) => a[0] - b[0]);
    const [dist, side] = options[0];
    return dist <= tolerance ? { x: cx, y: cy, side } : null;
  }

  private paths(layers: Layer[]): Path2D[] {
    let cached = this.pathCache.get(layers);
    if (!cached) {
      cached = layers.map((l) => new Path2D(l.path));
      this.pathCache.set(layers, cached);
    }
    return cached;
  }

  private drawSprite(layers: Layer[], feetX: number, feetY: number, scale: number, lower = 0): void {
    const ctx = this.ctx;
    const paths = this.paths(layers);
    ctx.save();
    const n = layersSize(layers);
    ctx.translate(feetX - (n / 2) * scale, feetY - Math.round((n * 30) / 32) * scale + lower);
    ctx.scale(scale, scale);
    layers.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fill(paths[i]);
    });
    ctx.restore();
  }

  // ---- the frame ----------------------------------------------------------------------------------

  draw(frame: Frame): void {
    const ctx = this.ctx;
    const { room } = frame;
    this.view = frame.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const settings = room.settings;
    const minute = lightMinute(settings, frame.minuteOfDay);
    const amb = ambientFor(settings, minute);
    const dl = daylight(minute);
    this.lap = performance.now();
    this.paintBackdrop(room.style_params.backdrop?.kind ?? 'void', dl, frame.time, Math.round(minute));
    this.mark('backdrop');
    if (room.cells.length === 0) return;

    this.cells = cellSet(room);
    this.dividers = dividerSet(room);
    const bounds = this.computeBounds(room);
    const cam = fitCamera({
      cssW: this.cssW,
      cssH: this.cssH,
      bounds,
      zoom: frame.zoom,
      panX: frame.pan.x,
      panY: frame.pan.y,
      padTop: 54,
      padBottom: 10 + (frame.insetBottom ?? 0),
      padSide: 24,
    });
    this.scale = cam.scale;
    this.ox = cam.ox;
    this.oy = cam.oy;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);

    const detail = !frame.lowDetail;
    this.lap = performance.now();
    this.hits = [];
    this.drawStatic(frame, detail, amb.dark, shadowsOn(settings));
    this.drawEntities(frame, amb.sky, amb.dark);
    this.mark('entities');
    this.drawOverlays(frame);
    this.mark('overlays');

    // Light of the day, then the player's ambient colour, laid over the scene.
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = amb.tintAlpha;
    ctx.fillStyle = amb.tint;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.restore();
    this.mark('tint');
    this.drawWindowLight(frame, amb.dark);
    this.drawLamps(frame, amb.dark);
    this.mark('lamps');
    this.drawHint(frame);

    this.drawVignette();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const weather = room.style_params.weather?.kind;
    if (weather && weather !== 'none') drawWeather(ctx, this.cssW, this.cssH, weather, dl, frame.time);
    this.mark('weather');

    if (this.fade) {
      const t = (performance.now() - this.fade.start) / this.fade.ms;
      if (t >= 1) {
        this.fade = null;
      } else {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(this.fade.img, 0, 0);
        ctx.restore();
      }
    }
  }

  // ---- floor and walls -----------------------------------------------------------------------------

  private floorStyle(frame: Frame, x: number, y: number): SurfaceParams {
    const room = frame.room;
    const painted = room.floor_paint[cellKey(x, y)];
    const params = painted ? frame.catalog.styles[painted]?.params : undefined;
    const base = params ?? room.style_params.floor ?? {};
    return { color: base.color ?? '#c28f5c', alt: base.alt, pattern: base.pattern };
  }

  private wallStyle(frame: Frame, x: number, y: number, side: WallSide): { params: SurfaceParams; right: string } {
    const room = frame.room;
    const painted = room.wall_paint[edgeKey(x, y, side)];
    const params = (painted ? frame.catalog.styles[painted]?.params : undefined) ?? room.style_params.wall ?? {};
    const color = params.color ?? '#6a5688';
    return { params: { color, pattern: params.pattern }, right: params.color_right ?? shade(color, 1.15) };
  }

  private drawFloor(frame: Frame, detail: boolean): void {
    const ctx = this.ctx;
    const sorted = [...frame.room.cells].sort((a, b) => this.depthOfCell(a[0], a[1]) - this.depthOfCell(b[0], b[1]));
    for (const [x, y] of sorted) {
      const corners = [this.proj(x, y), this.proj(x + 1, y), this.proj(x + 1, y + 1), this.proj(x, y + 1)];
      const top = corners.reduce((a, b) => (b.y < a.y ? b : a));
      const bottom = corners.reduce((a, b) => (b.y > a.y ? b : a));
      const left = corners.reduce((a, b) => (b.x < a.x ? b : a));
      const right = corners.reduce((a, b) => (b.x > a.x ? b : a));
      const params = this.floorStyle(frame, x, y);
      drawFloorCell(ctx, [top, right, bottom, left], x, y, params, detail);
      this.addClip([top, right, bottom, left]);
      // The thickness of the floor shows on edges that face the viewer.
      for (const side of SIDES) {
        const [dx, dy] = DELTA[side];
        if (this.cells.has(cellKey(x + dx, y + dy)) || isBackFacing(this.view, side)) continue;
        const [x0, y0, x1, y1] = edgePoints(x, y, side);
        const k = wallOrientation(this.view, side) === 'left' ? 0.72 : 0.55;
        poly(ctx, [this.proj(x0, y0, 0), this.proj(x1, y1, 0), this.proj(x1, y1, -FLOOR_THICKNESS), this.proj(x0, y0, -FLOOR_THICKNESS)], shade(params.color, k));
      }
    }
  }

  /** The scenery moves slowly, so it is redrawn a few times a second and shown from a picture in between. */
  private paintBackdrop(kind: string, dl: ReturnType<typeof daylight>, time: number, minute: number): void {
    const key = `${kind}|${this.canvas.width}x${this.canvas.height}|${minute}`;
    if (!this.backdropCanvas || this.backdropCanvas.width !== this.canvas.width || this.backdropCanvas.height !== this.canvas.height) {
      this.backdropCanvas = document.createElement('canvas');
      this.backdropCanvas.width = this.canvas.width;
      this.backdropCanvas.height = this.canvas.height;
      this.backdropKey = '';
    }
    if (key !== this.backdropKey || time - this.backdropAt > 0.12 || time < this.backdropAt) {
      const bctx = this.backdropCanvas.getContext('2d') as CanvasRenderingContext2D;
      bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawBackdrop(bctx, this.cssW, this.cssH, kind, dl, time);
      this.backdropKey = key;
      this.backdropAt = time;
    }
    const main = this.mainCtx;
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.drawImage(this.backdropCanvas, 0, 0);
    main.restore();
  }

  private roomId(room: object): number {
    let id = this.roomIds.get(room);
    if (!id) {
      id = this.nextRoomId++;
      this.roomIds.set(room, id);
    }
    return id;
  }

  /** Floor, back walls and shadows only change with the room, the camera or the light, so they are kept as a picture. */
  private drawStatic(frame: Frame, detail: boolean, dark: number, shadows: boolean): void {
    const main = this.mainCtx;
    const key = [this.roomId(frame.room), this.view, this.scale.toFixed(3), Math.round(this.ox), Math.round(this.oy), this.canvas.width, this.canvas.height, detail, Math.round(dark * 8), shadows].join('|');
    if (key !== this.staticKey || !this.staticCanvas) {
      if (!this.staticCanvas || this.staticCanvas.width !== this.canvas.width || this.staticCanvas.height !== this.canvas.height) {
        this.staticCanvas = document.createElement('canvas');
        this.staticCanvas.width = this.canvas.width;
        this.staticCanvas.height = this.canvas.height;
      }
      const sctx = this.staticCanvas.getContext('2d') as CanvasRenderingContext2D;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
      sctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
      this.ctx = sctx;
      this.wallHits = [];
      this.clipPoints = [];
      this.drawFloor(frame, detail);
      this.mark('floor');
      this.drawBackWalls(frame, detail);
      this.mark('walls');
      if (shadows) this.drawShadows(frame, dark, detail);
      this.mark('shadows');
      this.lightClip = hullPath(this.clipPoints);
      this.ctx = main;
      this.staticKey = key;
    }
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.drawImage(this.staticCanvas, 0, 0);
    main.restore();
    this.mark('static');
  }

  private addClip(pts: Pt[]): void {
    this.clipPoints.push(...pts);
  }

  private depthOfCell(x: number, y: number): number {
    const [rx, ry] = rotXY(this.view, x + 0.5, y + 0.5);
    return rx + ry;
  }

  private drawBackWalls(frame: Frame, detail: boolean): void {
    const ctx = this.ctx;
    const faces: { x: number; y: number; side: WallSide; depth: number }[] = [];
    for (const [x, y] of frame.room.cells) {
      for (const side of SIDES) {
        if (!isBackFacing(this.view, side)) continue;
        if (!isWallEdge(this.cells, this.dividers, x, y, side)) continue;
        // A divider is drawn as a slab with the other walls of the room, not as a back wall.
        const [dx, dy] = DELTA[side];
        if (this.cells.has(cellKey(x + dx, y + dy))) continue;
        const [x0, y0, x1, y1] = edgePoints(x, y, side);
        const [rx, ry] = rotXY(this.view, (x0 + x1) / 2, (y0 + y1) / 2);
        faces.push({ x, y, side, depth: rx + ry });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const f of faces) {
      const [x0, y0, x1, y1] = edgePoints(f.x, f.y, f.side);
      let a = this.proj(x0, y0, 0);
      let b = this.proj(x1, y1, 0);
      let ta = this.proj(x0, y0, WALL_H);
      let tb = this.proj(x1, y1, WALL_H);
      if (a.x > b.x) {
        [a, b] = [b, a];
        [ta, tb] = [tb, ta];
      }
      const style = this.wallStyle(frame, f.x, f.y, f.side);
      const left = wallOrientation(this.view, f.side) === 'left';
      const params: SurfaceParams = left ? style.params : { ...style.params, color: style.right };
      const along = f.side === 'north' || f.side === 'south' ? f.x : f.y;
      drawWallFace(ctx, [a, b, tb, ta], along, params, 1, detail, WALL_H);
      this.addClip([a, b, tb, ta]);
      this.wallHits.push({ x: f.x, y: f.y, side: f.side, poly: [a, b, tb, ta].map((p) => [p.x * this.scale + this.ox, p.y * this.scale + this.oy] as [number, number]) });
    }
    // Where the floor meets a back wall it is a little darker.
    ctx.save();
    for (const f of faces) {
      const [x0, y0, x1, y1] = edgePoints(f.x, f.y, f.side);
      const [dx, dy] = DELTA[f.side];
      const a = this.proj(x0, y0, 0);
      const b = this.proj(x1, y1, 0);
      const c = this.proj(x1 - dx * 0.35, y1 - dy * 0.35, 0);
      const d = this.proj(x0 - dx * 0.35, y0 - dy * 0.35, 0);
      const g = ctx.createLinearGradient(a.x, a.y, d.x, d.y);
      g.addColorStop(0, 'rgba(0,0,0,0.2)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- shadows --------------------------------------------------------------------------------------

  private drawShadows(frame: Frame, dark: number, detail: boolean): void {
    const ctx = this.ctx;
    const passes = detail ? 3 : 1;
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      if (!def || def.layer === 'wall' || def.layer === 'rug') continue;
      let lift = 0;
      if (def.layer === 'surface') lift = this.hostTop(frame, p);
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map(([cx]) => cx)) + 1;
      const d = Math.max(...cells.map(([, cy]) => cy)) + 1;
      const h = (lift + topHeight(def)) / 100;
      const off = Math.min(0.55, 0.12 + h * 0.2);
      const x = p.x + Number(p.props?.nudge_x ?? 0) / 100;
      const y = p.y + Number(p.props?.nudge_y ?? 0) / 100;
      const sw = def.layer === 'surface' ? 1 : w;
      const sd = def.layer === 'surface' ? 1 : d;
      const rise = lift * Z_PER_CENTI;
      for (let i = 0; i < passes; i++) {
        const grow = i * 0.07;
        const a = 0.11 * (1 - dark * 0.5);
        for (const o of [0, off]) {
          const pts = [this.proj(x + o - grow, y + o - grow), this.proj(x + o + sw + grow, y + o - grow), this.proj(x + o + sw + grow, y + o + sd + grow), this.proj(x + o - grow, y + o + sd + grow)];
          if (rise) pts.forEach((pt) => (pt.y -= rise));
          poly(ctx, pts, `rgba(0,0,0,${a})`);
        }
      }
    }
  }

  // ---- things in the room ---------------------------------------------------------------------------

  private hostTop(frame: Frame, p: PlacementView): number {
    if (p.on === null) return 0;
    const host = frame.room.placements.find((q) => q.pid === p.on);
    const hd = host ? frame.catalog.items[host.item] : undefined;
    return hd ? topHeight(hd) : 0;
  }

  private center(def: ItemDef | undefined, p: PlacementView): number {
    if (!def) return 0;
    let w = 1;
    let d = 1;
    if (def.layer !== 'surface' && def.layer !== 'wall') {
      const cells = footprintCells(def, p.rot);
      w = Math.max(...cells.map(([cx]) => cx)) + 1;
      d = Math.max(...cells.map(([, cy]) => cy)) + 1;
    }
    const [rx, ry] = rotXY(this.view, p.x + w / 2, p.y + d / 2);
    return rx + ry;
  }

  private sliceFill(def: ItemDef, face: Face, frame: Frame, dl: { sky: string; dark: number }, phase: number, p?: PlacementView): string | CanvasGradient | null {
    const ctx = this.ctx;
    const slot = face.slot ?? '';
    const t = frame.time + phase * 1.7;
    const lamp = p ? lampOf(def, p, dl.dark) : null;
    const on = lamp ? lamp.lit : p?.props?.lit === '1';
    const lightColor = lamp?.color ?? '#ffd27a';
    if (slot === 'flame' || slot === 'fire') {
      if (!on && slot === 'flame' && lamp) return shade(face.fill, 0.7);
      const bx = bounds(face.points);
      const flick = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1.1);
      const g = ctx.createRadialGradient(bx.cx, bx.y + bx.h * 0.7, 0.5, bx.cx, bx.cy, Math.max(bx.w, bx.h) * 0.75 * flick);
      g.addColorStop(0, '#fffbe6');
      g.addColorStop(0.35, '#ffd25a');
      g.addColorStop(0.75, slot === 'fire' ? '#ff7a2a' : '#ffae3a');
      g.addColorStop(1, 'rgba(220,60,20,0.85)');
      return g;
    }
    if (slot === 'bulb' || slot === 'glow') {
      if (def.tags.includes('portal')) return null;
      if (!on) return shade(face.fill, slot === 'bulb' ? 0.85 : 0.6);
      const bx = bounds(face.points);
      const pulse = slot === 'glow' ? 0.9 + 0.1 * Math.sin(t * 1.6) : 1;
      const g = ctx.createRadialGradient(bx.cx - bx.w * 0.15, bx.cy - bx.h * 0.2, 0.5, bx.cx, bx.cy, Math.max(bx.w, bx.h) * 0.7);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45 * pulse, shade(lightColor, 1.15));
      g.addColorStop(1, shade(lightColor, 0.8 * pulse));
      return g;
    }
    if (slot === 'shade' && lamp) {
      if (!on) return null;
      const bx = bounds(face.points);
      const g = ctx.createRadialGradient(bx.cx, bx.y + bx.h * 0.85, 1, bx.cx, bx.cy, Math.max(bx.w, bx.h) * 0.8);
      g.addColorStop(0, '#fffaf0');
      g.addColorStop(0.5, shade(face.fill, 1.18));
      g.addColorStop(1, shade(face.fill, 0.95));
      return g;
    }
    if (slot === 'screen') {
      if (!on) return '#161922';
      const bx = bounds(face.points);
      const g = ctx.createLinearGradient(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h);
      const k = (Math.sin(t * 0.7) + 1) / 2;
      g.addColorStop(0, '#2b5f9e');
      g.addColorStop(0.45 + k * 0.2, '#7fd3ff');
      g.addColorStop(1, '#8a63c9');
      return g;
    }
    if (slot === 'water') {
      const bx = bounds(face.points);
      const g = ctx.createLinearGradient(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h);
      const k = (Math.sin(t * 0.9) + 1) / 2;
      g.addColorStop(0, rgba(shade(face.fill, 1.2), 0.42));
      g.addColorStop(0.3 + k * 0.4, 'rgba(255,255,255,0.32)');
      g.addColorStop(1, rgba(face.fill, 0.38));
      return g;
    }
    if (def.tags.includes('mirror') && slot === 'glass') {
      const bx = bounds(face.points);
      const g = ctx.createLinearGradient(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h);
      g.addColorStop(0, '#dfe9f5');
      g.addColorStop(0.38, '#b6c6da');
      g.addColorStop(0.46, '#f4f8ff');
      g.addColorStop(0.55, '#a9b9cf');
      g.addColorStop(1, '#8796ad');
      return g;
    }
    if (def.tags.includes('window') && face.slot === 'glass') {
      const ys = face.points.map((p) => p[1]);
      const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
      g.addColorStop(0, shade(dl.sky, 0.9));
      g.addColorStop(1, shade(dl.sky, 1.15));
      return g;
    }
    return null;
  }

  private drawEntities(frame: Frame, sky: string, dark: number): void {
    const ctx = this.ctx;
    const { room, catalog, walker } = frame;
    const mode = wallMode(room.settings);
    const list: Drawable[] = [];
    const dl = { sky, dark };

    for (const p of room.placements) {
      const def = catalog.items[p.item];
      const faces = def ? modelFaces(def, p, this.hostTop(frame, p), this.view) : [];
      let key = this.center(def, p);
      if (def?.layer === 'rug') key = -50;
      else if (def?.layer === 'surface') {
        const host = room.placements.find((q) => q.pid === p.on);
        key = (host ? this.center(catalog.items[host.item], host) : key) + 0.01;
      } else if (def?.layer === 'wall') {
        if (!p.wall || (mode !== 'full' && !isBackFacing(this.view, p.wall))) continue;
        const [ax, ay] = ALONG[p.wall];
        const len = def.footprint.w;
        const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
        const mx = (x0 + x1) / 2 + ax * (len - 1) * 0.5;
        const my = (y0 + y1) / 2 + ay * (len - 1) * 0.5;
        const [rx, ry] = rotXY(this.view, mx, my);
        key = rx + ry - 0.02;
      }
      list.push({ key, pid: p.pid, faces, def, placement: p });
    }

    // Dividers and walls that face the viewer are slabs among the items.
    for (const s of this.slabs(frame, mode)) list.push(s);

    for (const pet of [...(frame.pet ? [frame.pet] : []), ...(frame.pets ?? [])]) {
      const pf = this.proj(pet.x, pet.y, pet.lift);
      const [prx, pry] = rotXY(this.view, pet.x, pet.y);
      list.push({
        key: prx + pry + 0.02,
        faces: [],
        custom: () => {
          ctx.save();
          ctx.fillStyle = '#00000038';
          ctx.beginPath();
          ctx.ellipse(pf.x, pf.y, 11, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          this.drawSprite(pet.layers, pf.x, pf.y + 2, 1.7);
        },
      });
    }

    const lift = frame.seat?.lift ?? 0;
    const feet = this.proj(walker.x, walker.y, lift);
    const [wrx, wry] = rotXY(this.view, walker.x, walker.y);
    const seatPlacement = frame.seat ? room.placements.find((q) => q.pid === frame.seat?.pid) : undefined;
    const walkerKey = seatPlacement ? this.center(catalog.items[seatPlacement.item], seatPlacement) + 0.05 : wrx + wry;
    list.push({
      key: walkerKey,
      faces: [],
      custom: () => {
        if (!lift) {
          ctx.save();
          ctx.fillStyle = '#00000040';
          ctx.beginPath();
          ctx.ellipse(feet.x, feet.y, 15, 6.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        this.drawSprite(frame.playerLayers, feet.x, feet.y + 2, SPRITE_SCALE, frame.sitting && !lift ? 7 : lift ? 8 : 0);
      },
    });

    if (frame.ghost) {
      const g = frame.ghost;
      const def = catalog.items[g.item];
      if (def) {
        const gp: PlacementView = { pid: -1, item: g.item, x: g.x, y: g.y, rot: g.rot, wall: g.wall, on: g.on, colors: g.colors ?? {}, props: g.props ?? {}, known: true };
        list.push({ key: this.center(def, gp) + 0.5, faces: modelFaces(def, gp, this.hostTop(frame, gp), this.view), alpha: 0.72, tint: g.valid ? undefined : '#ff5a5a' });
      }
    }

    list.sort((a, b) => a.key - b.key);
    this.mark('ent-prep');
    for (const d of list) {
      if (d.custom) {
        d.custom();
        this.mark('ent-custom');
        continue;
      }
      const cached = d.def && d.pid !== undefined && d.pid >= 0 ? this.spriteOf(d, frame) : null;
      if (cached) {
        const tx = Math.round((cached.minX * this.scale + this.ox) * this.dpr);
        const ty = Math.round((cached.minY * this.scale + this.oy) * this.dpr);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cached.canvas, tx - cached.pad, ty - cached.pad);
        ctx.restore();
        this.mark('ent-sprite');
        this.hits.push({ pid: d.pid as number, polys: d.faces.map((f) => f.points.map(([x, y]) => [x * this.scale + this.ox, y * this.scale + this.oy] as [number, number])) });
        continue;
      }
      ctx.save();
      if (d.alpha !== undefined) ctx.globalAlpha = d.alpha;
      const polys: [number, number][][] = [];
      for (const f of d.faces) {
        const special = d.def && !d.tint ? this.sliceFill(d.def, f, frame, dl, d.pid ?? 0, d.placement) : null;
        if (special) {
          ctx.beginPath();
          f.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = special;
          ctx.fill();
          ctx.strokeStyle = 'rgba(20,14,30,0.22)';
          ctx.lineWidth = 0.55;
          ctx.stroke();
        } else {
          paintFace(ctx, f, {
            tint: d.tint,
            finish: frame.lowDetail
              ? undefined
              : (face) => {
                  const material = catalog.materials[face.finish as string];
                  if (material) drawFinish(ctx, face.points, material.kind, material.params.pattern, face.fill, d.pid ?? 0);
                },
          });
        }
        polys.push(f.points.map(([x, y]) => [x * this.scale + this.ox, y * this.scale + this.oy] as [number, number]));
      }
      if (d.def?.tags.includes('window') && dark > 0.55) this.windowStars(d.faces);
      ctx.restore();
      if (d.pid !== undefined && d.pid >= 0) this.hits.push({ pid: d.pid, polys });
    }
  }

  /** A placed item as a small picture, so each frame draws one image instead of every face. */
  private spriteOf(d: Drawable, frame: Frame): { canvas: HTMLCanvasElement; minX: number; minY: number; pad: number } | null {
    const def = d.def;
    if (!def || d.faces.length === 0 || d.tint || d.alpha !== undefined) return null;
    if (isLive(def)) return null; // windows, flames, screens and lights change with the sky and the clock
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let fingerprint = '';
    for (const f of d.faces) {
      fingerprint += f.fill;
      for (const [x, y] of f.points) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    // the shape relative to its own corner, so equal items anywhere share one picture
    const shape = d.faces.map((f) => f.points.map(([x, y]) => `${Math.round((x - minX) * 8)},${Math.round((y - minY) * 8)}`).join(' ')).join(';');
    const hasFinish = d.faces.some((f) => f.finish);
    const key = `${this.scale.toFixed(3)}|${this.dpr}|${frame.lowDetail ? 1 : 0}|${hasFinish ? d.pid : ''}|${fingerprint}|${shape}`;
    const pad = 3;
    let entry = this.sprites.get(key);
    if (!entry) {
      const k = this.dpr * this.scale;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil((maxX - minX) * k) + pad * 2;
      canvas.height = Math.ceil((maxY - minY) * k) + pad * 2;
      const c = canvas.getContext('2d') as CanvasRenderingContext2D;
      c.setTransform(k, 0, 0, k, pad - minX * k, pad - minY * k);
      for (const f of d.faces) {
        paintFace(c, f, {
          finish: frame.lowDetail
            ? undefined
            : (face) => {
                const material = frame.catalog.materials[face.finish as string];
                if (material) drawFinish(c, face.points, material.kind, material.params.pattern, face.fill, d.pid ?? 0);
              },
        });
      }
      if (this.sprites.size > 300) this.sprites.clear();
      entry = { canvas, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      this.sprites.set(key, entry);
    }
    return { canvas: entry.canvas, minX, minY, pad };
  }

  private windowStars(faces: Face[]): void {
    const ctx = this.ctx;
    for (const f of faces.filter((q) => q.slot === 'glass' && q.kind === 'right')) {
      const xs = f.points.map((p) => p[0]);
      const ys = f.points.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x0 + hash2(i, 1, 21) * (Math.max(...xs) - x0), y0 + hash2(i, 2, 21) * (Math.max(...ys) - y0), 1.2, 1.2);
    }
  }

  /** Dividers and the room's walls that face the viewer, as thin slabs at their cut-away height. */
  private slabs(frame: Frame, mode: WallMode): Drawable[] {
    const out: Drawable[] = [];
    const heightOf = (divider: boolean): number => {
      if (mode === 'full') return WALL_H;
      if (mode === 'cut') return divider ? 56 : 30;
      return divider ? 16 : 0;
    };
    const add = (gx: number, gy: number, gw: number, gd: number, h: number, color: string, depthX: number, depthY: number) => {
      if (h <= 0) return;
      const box = rotateWorldBox({ gx, gy, gw, gd, z: 0, h: h / Z_PER_CENTI, slot: 'wall' }, this.view);
      const [rx, ry] = rotXY(this.view, depthX, depthY);
      out.push({ key: rx + ry, faces: boxFaces(box, color) });
    };
    for (const [x, y, side] of frame.room.dividers) {
      const color = this.wallStyle(frame, x, y, side).params.color;
      if (side === 'east') add(x + 1 - DIVIDER_T / 2, y, DIVIDER_T, 1, heightOf(true), color, x + 1, y + 0.5);
      else add(x, y + 1 - DIVIDER_T / 2, 1, DIVIDER_T, heightOf(true), color, x + 0.5, y + 1);
    }
    for (const [x, y] of frame.room.cells) {
      for (const side of SIDES) {
        const [dx, dy] = DELTA[side];
        if (this.cells.has(cellKey(x + dx, y + dy)) || isBackFacing(this.view, side)) continue;
        const color = this.wallStyle(frame, x, y, side).params.color;
        const t = 0.07;
        if (side === 'north') add(x, y - t, 1, t, heightOf(false), color, x + 0.5, y);
        else if (side === 'south') add(x, y + 1, 1, t, heightOf(false), color, x + 0.5, y + 1);
        else if (side === 'west') add(x - t, y, t, 1, heightOf(false), color, x, y + 0.5);
        else add(x + 1, y, t, 1, heightOf(false), color, x + 1, y + 0.5);
      }
    }
    return out;
  }

  // ---- overlays -------------------------------------------------------------------------------------

  private drawOverlays(frame: Frame): void {
    const ctx = this.ctx;
    for (const h of frame.highlight ?? []) {
      poly(ctx, [this.proj(h.x, h.y), this.proj(h.x + 1, h.y), this.proj(h.x + 1, h.y + 1), this.proj(h.x, h.y + 1)], h.ok ? '#55d6c255' : '#ff5a5a55');
    }
    for (const e of frame.highlightEdges ?? []) {
      const [x0, y0, x1, y1] = edgePoints(e.x, e.y, e.side);
      poly(ctx, [this.proj(x0, y0, 0), this.proj(x1, y1, 0), this.proj(x1, y1, 44), this.proj(x0, y0, 44)], e.ok ? '#55d6c288' : '#ff5a5a88');
    }
    const pulse = 0.55 + 0.45 * Math.sin(frame.time * 4);
    for (const pid of frame.selectedPids ?? []) {
      const p = frame.room.placements.find((q) => q.pid === pid);
      const def = p ? frame.catalog.items[p.item] : undefined;
      if (!p || !def) continue;
      ctx.save();
      ctx.strokeStyle = `rgba(244,184,96,${pulse})`;
      ctx.lineWidth = 2;
      if (def.layer === 'wall' && p.wall) {
        for (const [ex, ey, es] of wallEdgesOfItem(def, p.x, p.y, p.wall)) {
          const [x0, y0, x1, y1] = edgePoints(ex, ey, es);
          const a = this.proj(x0, y0, 0);
          const b = this.proj(x1, y1, 0);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      } else {
        const cells: [number, number][] = def.layer === 'surface' ? [[0, 0]] : footprintCells(def, p.rot);
        const lift = def.layer === 'surface' ? this.hostTop(frame, p) * Z_PER_CENTI : 0;
        for (const [dx, dy] of cells) {
          const cx = p.x + dx;
          const cy = p.y + dy;
          const pts = [this.proj(cx, cy), this.proj(cx + 1, cy), this.proj(cx + 1, cy + 1), this.proj(cx, cy + 1)];
          ctx.beginPath();
          pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y - lift) : ctx.lineTo(pt.x, pt.y - lift)));
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private lampPosition(frame: Frame, p: PlacementView, def: ItemDef): { head: Pt; base: Pt } {
    const lift = this.hostTop(frame, p);
    const tipZ = (lift + Math.max(topHeight(def) - 18, 10)) * Z_PER_CENTI;
    if (def.layer === 'wall' && p.wall) {
      const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
      const [dx, dy] = DELTA[p.wall];
      const mx = (x0 + x1) / 2 - dx * 0.2;
      const my = (y0 + y1) / 2 - dy * 0.2;
      return { head: this.proj(mx, my, tipZ), base: this.proj(mx, my, 0) };
    }
    return { head: this.proj(p.x + 0.5, p.y + 0.5, tipZ), base: this.proj(p.x + 0.5, p.y + 0.5, lift * Z_PER_CENTI) };
  }

  /** A soft round light of one colour, drawn once and reused at any size. */
  private glow(color: string, kind: 'halo' | 'pool'): HTMLCanvasElement {
    const key = `${color}|${kind}`;
    let c = this.glows.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      const rgb = color.slice(1);
      const col = (a: number) => `rgba(${parseInt(rgb.slice(0, 2), 16)},${parseInt(rgb.slice(2, 4), 16)},${parseInt(rgb.slice(4, 6), 16)},${a})`;
      const grad = g.createRadialGradient(64, 64, kind === 'halo' ? 2 : 4, 64, 64, 64);
      grad.addColorStop(0, col(kind === 'halo' ? 1 : 1));
      grad.addColorStop(1, col(0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      if (this.glows.size > 60) this.glows.clear();
      this.glows.set(key, c);
    }
    return c;
  }

  private vignette: HTMLCanvasElement | null = null;

  /** A gentle darkening toward the screen edges draws the eye to the room. */
  private drawVignette(): void {
    if (!this.vignette || this.vignette.width !== this.canvas.width || this.vignette.height !== this.canvas.height) {
      const v = document.createElement('canvas');
      v.width = this.canvas.width;
      v.height = this.canvas.height;
      const c = v.getContext('2d') as CanvasRenderingContext2D;
      const w = v.width;
      const h = v.height;
      const g = c.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.35, w / 2, h * 0.52, Math.hypot(w, h) * 0.62);
      g.addColorStop(0, 'rgba(8,8,20,0)');
      g.addColorStop(1, 'rgba(8,8,20,0.38)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      this.vignette = v;
    }
    const ctx = this.mainCtx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.vignette, 0, 0);
    ctx.restore();
  }

  /** Sunlight (or moonlight) falling through windows onto the floor, split by the window's crossbar. */
  private drawWindowLight(frame: Frame, dark: number): void {
    const day = 1 - dark;
    const moon = dark > 0.6 ? (dark - 0.6) * 0.5 : 0;
    const strength = day > 0.15 ? day * 0.2 : moon * 0.22;
    if (strength <= 0.01) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    ctx.clip(this.lightClip);
    ctx.fillStyle = day > 0.15 ? `rgba(255,244,214,${strength})` : `rgba(170,190,255,${strength})`;
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      if (!def || !def.tags.includes('window') || !p.wall) continue;
      const [x0, y0] = edgePoints(p.x, p.y, p.wall);
      const [ax, ay] = ALONG[p.wall];
      const [dx, dy] = DELTA[p.wall];
      const len = def.footprint.w;
      const inX = -dx;
      const inY = -dy;
      const skew = 0.8;
      const depth = 1.6 + len * 0.3;
      const bars = len >= 2 ? 2 : 1;
      for (let b = 0; b < bars; b++) {
        const a0 = (b * len) / bars + 0.1;
        const a1 = ((b + 1) * len) / bars - 0.1;
        const pt = (along: number, into: number) => this.proj(x0 + ax * along + inX * into + ax * skew * into * 0.5, y0 + ay * along + inY * into + ay * skew * into * 0.5, 0);
        const quad = [pt(a0, 0.05), pt(a1, 0.05), pt(a1, depth), pt(a0, depth)];
        ctx.beginPath();
        quad.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawLamps(frame: Frame, dark: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    ctx.clip(this.lightClip);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of frame.room.placements) {
      const def = frame.catalog.items[p.item];
      const lamp = lampOf(def, p, dark);
      if (!def || !lamp || !lamp.lit) continue;
      const k = lamp.strength * Math.max(0.35, dark);
      const { head, base } = this.lampPosition(frame, p, def);
      const r1 = 70 * (0.6 + lamp.strength);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.5 * k);
      const halo = this.glow(lamp.color, 'halo');
      ctx.drawImage(halo, head.x - r1, head.y - r1, r1 * 2, r1 * 2);
      ctx.restore();
      // a pool of light on the floor, flattened like the floor itself
      const r2 = 78 * (0.6 + lamp.strength);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.32 * k);
      ctx.translate(base.x, base.y);
      ctx.scale(1, 0.5);
      ctx.drawImage(this.glow(lamp.color, 'pool'), -r2, -r2, r2 * 2, r2 * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawHint(frame: Frame): void {
    const t = frame.target;
    if (!t) return;
    const ctx = this.ctx;
    const p = frame.room.placements.find((q) => q.pid === t.pid);
    const def = p ? frame.catalog.items[p.item] : undefined;
    if (!p || !def) return;
    let anchor: { x: number; y: number };
    if (def.layer === 'wall' && p.wall) {
      const [x0, y0, x1, y1] = edgePoints(p.x, p.y, p.wall);
      const [ax, ay] = ALONG[p.wall];
      const len = def.footprint.w;
      anchor = this.toScreen((x0 + x1) / 2 + ax * (len - 1) * 0.5, (y0 + y1) / 2 + ay * (len - 1) * 0.5, topHeight(def) * Z_PER_CENTI + 16);
    } else {
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map(([cx]) => cx)) + 1;
      const d = Math.max(...cells.map(([, cy]) => cy)) + 1;
      anchor = this.toScreen(p.x + w / 2, p.y + d / 2, (this.hostTop(frame, p) + topHeight(def)) * Z_PER_CENTI + 14);
    }
    const name = t.kind === 'door' ? 'door' : t.action;
    const color = t.kind === 'door' ? '#e8a23a' : '#f4b860';
    const bob = Math.sin(frame.time * 3.2) * 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y + bob, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18,20,29,0.86)';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();
    drawGlyph(ctx, name, anchor.x, anchor.y + bob, 20, color);
  }
}

/** A small vector preview of an item (kept for the workshop's blocks). */
export function drawVectorThumbnail(ctx: CanvasRenderingContext2D, def: ItemDef, w: number, h: number, colors: Record<string, string> = {}, rot = 0): void {
  const placement: PlacementView = { pid: -1, item: def.id, x: 0, y: 0, rot, wall: def.layer === 'wall' ? 'north' : null, on: null, colors, props: {}, known: true };
  const faces = modelFaces(def, placement, 0);
  ctx.clearRect(0, 0, w, h);
  if (faces.length === 0) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const f of faces) {
    for (const [x, y] of f.points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const s = Math.min((w - 8) / (maxX - minX || 1), (h - 8) / (maxY - minY || 1), 2.2);
  ctx.save();
  ctx.translate((w - (maxX - minX) * s) / 2 - minX * s, (h - (maxY - minY) * s) / 2 - minY * s);
  ctx.scale(s, s);
  for (const f of faces) paintFace(ctx, f, { lineScale: 1 / Math.max(1, s) });
  ctx.restore();
}

export { clampZoom, TILE };

/** The outline of a set of points as one simple path (lamp light is clipped to it with a single cheap clip). */
function hullPath(points: Pt[]): Path2D {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const path = new Path2D();
  if (pts.length < 3) return path;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  hull.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.closePath();
  return path;
}

export { PixelScene as SceneRenderer } from './pixel/scene';

/** A catalogue preview: the item's pixel sprite scaled up by a whole number. */
export function drawItemThumbnail(ctx: CanvasRenderingContext2D, def: ItemDef, w: number, h: number, colors: Record<string, string> = {}, rot = 0): void {
  drawPixelThumb(ctx, def, w, h, rot, colors);
}
