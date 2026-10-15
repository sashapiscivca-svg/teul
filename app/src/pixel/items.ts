// Item models as pixel sprites, cached by everything that changes how they look.

import { rotateWorldBox, worldBoxes } from '../models';
import type { View } from '../geometry';
import type { ItemDef, PlacementView } from '../types';
import { materialOf, rasterize, toSprite, type RPrim, type Sprite } from './raycast';
import { SpriteCache } from './spritecache';
import { parseSeason, seasonBoxes, type SeasonBox } from './seasons';
import { agedBoxes, agedColor, wearOf } from '../wear';

/** Pictures of things, by everything that changes how they look; the longest unused go first when it is full
 * (seasons, views, a big place's many kinds of things). About 48 MB of pixels at most. */
const cache = new SpriteCache<Sprite>(12_000_000);

export interface Live {
  /** Colour per slot that glows (flames, bulbs, screens, window sky); omitted slots are lit normally. */
  glow?: Record<string, string>;
  /** The season outdoors: leaves turn in autumn, fall in winter, snow lies on roofs and crowns. */
  season?: string;
}

const EVERGREEN = /pine|spruce|palm|hedge|cactus|bamboo|fern/;
const CROWN = /^(crown|leaf|leafy|bush)/;
const CROWNED = /^(tree_|bush_|berry_bush|rose_bush)/;
const SNOWY = /^(roof|crown|leaf|leafy|bush|top|lid|awn_|can_|hay|load)/;
const AUTUMN = ['#d9662e', '#e8a23a', '#c8423a', '#d4a72c', '#b8552a'];

/** Wheat through the year: green shoots, gold in summer, pale stubble after the harvest, frosted in winter. */
const WHEAT: Record<string, [string, string]> = { Spring: ['#6aa84a', '#8ec85a'], Autumn: ['#b89a5a', '#d6c48e'], Winter: ['#b8bcc0', '#e4e8ec'] };

/** Vines: fresh leaves and tiny green berries in spring, green grapes in summer, ripe ones and red leaves in autumn. */
const VINE: Record<string, [string, string]> = { Spring: ['#7cc46a', '#a8d870'], Summer: ['#4a9458', '#8ab84a'], Autumn: ['#c8762e', '#5a2a6a'], Winter: ['#8a7a6e', '#8a7a6e'] };

/** A crown's colour in a season (null: as modelled). */
function seasonal(def: ItemDef, slot: string, full: string | undefined, p: PlacementView): string | null {
  const season = full?.split(':')[0];
  if (season && def.id.startsWith('wheat')) return WHEAT[season]?.[slot === 'ear' ? 1 : 0] ?? null;
  if (season && def.id === 'grapevine' && (slot === 'leaf' || slot === 'grape')) return VINE[season]?.[slot === 'grape' ? 1 : 0] ?? null;
  if (!season || !CROWN.test(slot) || !CROWNED.test(def.id)) return null;
  if (EVERGREEN.test(def.id)) return null;
  const pick = AUTUMN[Math.abs(p.x * 7 + p.y * 13 + slot.length) % AUTUMN.length];
  if (season === 'Autumn') return pick;
  if (season === 'Winter') return '#8a7a6e';
  if (season === 'Spring' && def.id !== 'tree_sakura') return '#7cc46a';
  return null;
}

/** Which of four looks a plant has (its bare branches, its colours), by where it stands. */
function variant(def: ItemDef, p: PlacementView): number {
  return CROWNED.test(def.id) || def.id.startsWith('tree_') ? Math.abs(p.x * 7 + p.y * 13) % 4 : 0;
}

/** The parts of a placed item in world space (relative to the placement's own cell, so sprites can be shared). */
export function itemPrims(def: ItemDef, p: PlacementView, hostTop: number, view: View, live: Live = {}): RPrim[] {
  const local: PlacementView = { ...p, x: 0, y: 0 };
  const season = parseSeason(live.season);
  const winter = season?.name === 'Winter';
  // a thing at home shows its age: faded, scuffed, a broken one sagging
  const age = wearOf(p.props);
  const boxes: SeasonBox[] = agedBoxes(seasonBoxes(def, worldBoxes(def, local, hostTop), season, variant(def, p)), age, p.pid);
  const fabric = def.category === 'seating';
  return boxes.map((b) => {
    const r = rotateWorldBox(b, view);
    const base = b.color ?? seasonal(def, b.slot, live.season, p) ?? p.colors[b.slot] ?? def.slots[b.slot]?.default ?? '#888888';
    const color = b.slot === 'scuff' ? base : agedColor(base, age, fabric && (b.slot === 'body' || b.slot === 'cushion' || b.slot === 'fabric'));
    const glow = live.glow?.[b.slot];
    return {
      gx: r.gx,
      gy: r.gy,
      gw: r.gw,
      gd: r.gd,
      z: r.z,
      h: r.h,
      shape: b.shape === 'gable' && ((p.rot + view) & 1) === 1 ? 'gable_y' : b.shape,
      color,
      finish: p.props?.[`finish.${b.slot}`],
      glow,
      // water and the panes of shop fridges and glass cabinets are seen through
      alpha: b.slot === 'water' ? 0.55 : b.slot === 'pane' ? 0.35 : undefined,
      material: def.category === 'seating' && b.slot === 'body' ? 'fabric' : materialOf(b.slot),
      snow: b.snow ?? (winter && SNOWY.test(b.slot)),
    };
  });
}

function spriteKey(def: ItemDef, p: PlacementView, hostTop: number, view: View, live: Live): string {
  return [def.id, def.model.length, view, p.rot, p.wall ?? '', hostTop, JSON.stringify(p.colors), JSON.stringify(p.props ?? {}), JSON.stringify(live.glow ?? {}), live.season ?? '',
    // trees and flowers come in a few shapes of their own through the year; everything else is the same wherever it stands
    live.season ? variant(def, p) : ''].join('|');
}

export function itemSprite(def: ItemDef, p: PlacementView, hostTop: number, view: View, live: Live = {}): Sprite {
  const key = spriteKey(def, p, hostTop, view, live);
  let s = cache.get(key);
  if (!s) {
    s = toSprite(rasterize(itemPrims(def, p, hostTop, view, live)));
    cache.set(key, s);
  }
  return s;
}

/** A catalogue preview: the item's sprite, scaled up by a whole number to fit the box, centred. */
export function drawPixelThumb(ctx: CanvasRenderingContext2D, def: ItemDef, w: number, h: number, rot = 0, colors: Record<string, string> = {}): void {
  const p: PlacementView = { pid: -1, item: def.id, x: 0, y: 0, rot, wall: def.layer === 'wall' ? 'north' : null, on: null, colors, props: {}, known: true };
  const s = itemSprite(def, p, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (s.w === 0) return;
  const k = Math.max(1, Math.floor(Math.min((w - 4) / s.w, (h - 4) / s.h)));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, Math.round((w - s.w * k) / 2), Math.round((h - s.h * k) / 2), s.w * k, s.h * k);
}
