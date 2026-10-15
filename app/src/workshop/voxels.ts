// Custom items are built from small blocks. This module turns a set of blocks into the boxes of an item
// model, and a saved description into a content pack, so the engine treats a player-made item like any other.

import type { ItemDef, Primitive } from '../types';

/** One block is a quarter of a tile. */
export const UNIT = 25;
export const MAX_TILES = 3;
export const MAX_SPAN = MAX_TILES * 4;
export const MAX_HEIGHT = 12;
export const MAX_BLOCKS = 600;
/** Colours offered for the slots of player-made items, besides the ones they picked themselves. */
export const USER_PALETTE = ['#d9534f', '#e8a23a', '#f4d35e', '#5aa469', '#3fb8b0', '#4a8fd0', '#8a63c9', '#d86aa0', '#e8e0c8', '#2f3a5a', '#3a3a44', '#8a5a2e', '#a8743c', '#6a4528', '#c9a050', '#3a2a40'];
export const SLOT_NAMES = ['a', 'b', 'c', 'd'] as const;

export type Cells = Map<string, number>;

export const cellKey = (i: number, j: number, k: number): string => `${i},${j},${k}`;

export function parseCell(key: string): [number, number, number] {
  const [i, j, k] = key.split(',').map(Number);
  return [i, j, k];
}

export function inBounds(i: number, j: number, k: number): boolean {
  return i >= 0 && j >= 0 && k >= 0 && i < MAX_SPAN && j < MAX_SPAN && k < MAX_HEIGHT;
}

/** The same blocks moved so they touch the origin on every axis. */
export function normalize(cells: Cells): Cells {
  if (cells.size === 0) return new Map();
  let mi = Infinity;
  let mj = Infinity;
  let mk = Infinity;
  for (const key of cells.keys()) {
    const [i, j, k] = parseCell(key);
    mi = Math.min(mi, i);
    mj = Math.min(mj, j);
    mk = Math.min(mk, k);
  }
  const out: Cells = new Map();
  for (const [key, slot] of cells) {
    const [i, j, k] = parseCell(key);
    out.set(cellKey(i - mi, j - mj, k - mk), slot);
  }
  return out;
}

/** The footprint in whole tiles, and the height in blocks. */
export function sizeOf(cells: Cells): { w: number; d: number; h: number } {
  let i = -1;
  let j = -1;
  let k = -1;
  for (const key of cells.keys()) {
    const [a, b, c] = parseCell(key);
    i = Math.max(i, a);
    j = Math.max(j, b);
    k = Math.max(k, c);
  }
  if (i < 0) return { w: 1, d: 1, h: 0 };
  return { w: Math.floor(i / 4) + 1, d: Math.floor(j / 4) + 1, h: k + 1 };
}

/** Merges blocks into as few boxes as it can: runs along x, then rows along y, then stacks along z. */
export function toBoxes(input: Cells): Primitive[] {
  const cells = normalize(input);
  const flat: { i: number; j: number; k: number; w: number; d: number; slot: number }[] = [];
  const layers = new Map<number, Cells>();
  for (const [key, slot] of cells) {
    const [, , k] = parseCell(key);
    if (!layers.has(k)) layers.set(k, new Map());
    layers.get(k)!.set(key, slot);
  }
  for (const [k, layer] of layers) {
    const used = new Set<string>();
    const at = (i: number, j: number) => layer.get(cellKey(i, j, k));
    for (let j = 0; j < MAX_SPAN; j++) {
      for (let i = 0; i < MAX_SPAN; i++) {
        const slot = at(i, j);
        if (slot === undefined || used.has(cellKey(i, j, k))) continue;
        let w = 1;
        while (i + w < MAX_SPAN && at(i + w, j) === slot && !used.has(cellKey(i + w, j, k))) w++;
        let d = 1;
        grow: while (j + d < MAX_SPAN) {
          for (let x = 0; x < w; x++) if (at(i + x, j + d) !== slot || used.has(cellKey(i + x, j + d, k))) break grow;
          d++;
        }
        for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) used.add(cellKey(i + x, j + y, k));
        flat.push({ i, j, k, w, d, slot });
      }
    }
  }
  // stack identical footprints that sit on top of each other
  flat.sort((a, b) => a.i - b.i || a.j - b.j || a.w - b.w || a.d - b.d || a.slot - b.slot || a.k - b.k);
  const merged: { i: number; j: number; k: number; w: number; d: number; slot: number; h: number }[] = [];
  for (const f of flat) {
    const last = merged[merged.length - 1];
    if (last && last.i === f.i && last.j === f.j && last.w === f.w && last.d === f.d && last.slot === f.slot && last.k + last.h === f.k) last.h++;
    else merged.push({ ...f, h: 1 });
  }
  return merged.map((m) => ({ box: [m.i * UNIT, m.j * UNIT, m.k * UNIT, m.w * UNIT, m.d * UNIT, m.h * UNIT], slot: SLOT_NAMES[m.slot] }));
}

/** Blocks back from boxes made by `toBoxes` (or any boxes aligned to the block grid). */
export function fromBoxes(boxes: Primitive[]): Cells {
  const cells: Cells = new Map();
  for (const { box, slot } of boxes) {
    const [x, y, z, w, d, h] = box;
    const index = Math.max(0, SLOT_NAMES.indexOf(slot as (typeof SLOT_NAMES)[number]));
    for (let k = 0; k < Math.round(h / UNIT); k++)
      for (let j = 0; j < Math.round(d / UNIT); j++)
        for (let i = 0; i < Math.round(w / UNIT); i++) cells.set(cellKey(Math.round(x / UNIT) + i, Math.round(y / UNIT) + j, Math.round(z / UNIT) + k), index);
  }
  return cells;
}

export interface UserItem {
  id: string;
  name: string;
  layer: 'floor' | 'surface';
  colors: string[];
  /** [i, j, k, slot] per block. */
  blocks: [number, number, number, number][];
  /** Other items can be placed on top of it. */
  surface: boolean;
  light: boolean;
  action: string | null;
}

export function cellsOf(item: UserItem): Cells {
  return new Map(item.blocks.map(([i, j, k, s]) => [cellKey(i, j, k), s] as [string, number]));
}

export function blocksOf(cells: Cells): UserItem['blocks'] {
  return [...normalize(cells)].map(([key, slot]) => [...parseCell(key), slot] as [number, number, number, number]);
}

export type Problem = 'empty' | 'too_many' | 'no_name';

export function problemsOf(item: UserItem): Problem[] {
  const out: Problem[] = [];
  if (item.blocks.length === 0) out.push('empty');
  if (item.blocks.length > MAX_BLOCKS) out.push('too_many');
  if (item.name.trim() === '') out.push('no_name');
  return out;
}

export function itemDefOf(item: UserItem): ItemDef {
  const cells = cellsOf(item);
  const { w, d } = sizeOf(normalize(cells));
  const used = new Set(item.blocks.map((b) => b[3]));
  const slots: ItemDef['slots'] = {};
  SLOT_NAMES.forEach((name, i) => {
    if (used.has(i)) slots[name] = { default: (item.colors[i] ?? '#9aa0b0').toLowerCase(), palette: 'user' };
  });
  return {
    id: item.id,
    name: item.name.trim(),
    category: 'custom',
    tags: item.light ? ['light', 'custom'] : ['custom'],
    footprint: { w, d },
    layer: item.layer,
    rules: { provides_surface: item.surface && item.layer === 'floor' },
    model: toBoxes(cells),
    slots,
    actions: item.action ? [item.action] : [],
    acquire: 'free',
  };
}

/** A content pack with the player's items, in the same format as the base pack. */
export function packOf(items: UserItem[]): string {
  const colors = new Set(USER_PALETTE);
  for (const item of items) for (const c of item.colors) colors.add(c.toLowerCase());
  return JSON.stringify({ schema: 1, id: 'user', version: 1, palettes: { user: [...colors] }, items: items.map(itemDefOf) });
}

export function newId(items: UserItem[], name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
  let n = items.length + 1;
  while (items.some((i) => i.id === `custom.${slug}_${n}`)) n++;
  return `custom.${slug}_${n}`;
}
