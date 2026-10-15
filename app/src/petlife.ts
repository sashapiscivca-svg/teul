// The animals at home besides the one that walks with the player (pets.rs): each goes about its own day in the
// house — the turtle slow, to the bath or the pond; the fox curious, everywhere, now and then off with something
// small in its teeth; the robot to its charger, beeping; the dragon to its nest or the warm stove, sparks from its
// nose. Hungry ones wait by the bowl, lonely ones follow the player about, happy ones play. How they are shows only
// in this: nothing is counted.

import { cellKey } from './geometry';
import { findPath } from './path';
import { PET_DRAGON, PET_FOX, PET_ROBOT, PET_TURTLE, type PetLook, type PetPose } from './character';
import type { Catalog, PetView, PlacementView, RoomView } from './types';
import { gridOf } from './world';

export interface HousePet {
  id: string;
  look: PetLook;
  x: number;
  y: number;
  dir: 'left' | 'right';
  pose: PetPose;
  /** What it is about now and until when (seconds of play). */
  doing: 'idle' | 'walk' | 'eat' | 'sleep' | 'play' | 'follow';
  until: number;
  path: [number, number][];
  /** The fox has something small in its teeth. */
  carry: boolean;
}

/** How fast each walks (cells a second). */
export function speedOf(kind: number): number {
  return kind === PET_TURTLE ? 0.45 : kind === PET_ROBOT ? 1.3 : kind === PET_FOX ? 2.6 : kind === PET_DRAGON ? 1.7 : 2;
}

/** Where each likes to be: a thing at home by its id or tag (first found). */
const FAVOURITE: Record<number, string[]> = {
  [PET_TURTLE]: ['bathtub', 'pond', 'aquarium', 'garden_tub'],
  [PET_FOX]: ['garden_bench', 'tree_apple', 'bush_round', 'rug_big'],
  [PET_ROBOT]: ['robot_dock', 'tv', 'computer', 'desk'],
  [PET_DRAGON]: ['dragon_nest', 'stove', 'fireplace', 'candle'],
};
const BEDS = ['cat_bed', 'doghouse', 'dragon_nest'];

function find(room: RoomView, ids: string[]): PlacementView | undefined {
  for (const id of ids) {
    const p = room.placements.find((q) => q.item === id && !q.wall);
    if (p) return p;
  }
  return undefined;
}

/** The free cells next to a thing (where an animal stands to it). */
function around(room: RoomView, catalog: Catalog, p: PlacementView): [number, number][] {
  const grid = gridOf(room, catalog);
  const def = catalog.items[p.item];
  const w = def ? (p.rot % 2 ? def.footprint.d : def.footprint.w) : 1;
  const d = def ? (p.rot % 2 ? def.footprint.w : def.footprint.d) : 1;
  const out: [number, number][] = [];
  for (let x = p.x - 1; x <= p.x + w; x++) {
    for (let y = p.y - 1; y <= p.y + d; y++) {
      const inside = x >= p.x && x < p.x + w && y >= p.y && y < p.y + d;
      if (!inside && grid.cells.has(cellKey(x, y)) && !grid.blocked.has(cellKey(x, y))) out.push([x, y]);
    }
  }
  return out;
}

export function newHousePet(id: string, look: PetLook, at: { x: number; y: number }): HousePet {
  return { id, look, x: at.x, y: at.y, dir: 'right', pose: 'sit', doing: 'idle', until: 0, path: [], carry: false };
}

export interface PetWorld {
  room: RoomView;
  catalog: Catalog;
  /** Seconds of play. */
  time: number;
  player: { x: number; y: number };
  view: PetView | undefined;
  /** In the same room as the player (only those are seen). */
  near: (x: number, y: number) => boolean;
  random: () => number;
}

/** Decides what an animal does next. */
function choose(p: HousePet, w: PetWorld): void {
  const kind = p.look.kind;
  const r = w.random();
  const grid = gridOf(w.room, w.catalog);
  const from: [number, number] = [Math.floor(p.x), Math.floor(p.y)];
  const go = (goals: [number, number][], doing: HousePet['doing'], stay: number): boolean => {
    const path = goals.length ? findPath(w.room, w.catalog, from, goals) : null;
    if (!path) return false;
    p.path = path;
    p.doing = doing;
    p.until = w.time + stay;
    return true;
  };
  const v = w.view;
  // hungry: by the bowl (the robot by its charger)
  if (v?.hungry) {
    const at = kind === PET_ROBOT ? find(w.room, ['robot_dock']) : find(w.room, ['pet_bowl']);
    if (at && go(around(w.room, w.catalog, at), 'eat', 8)) return;
  }
  // lonely, or very fond: after the player
  if ((v?.lonely || (v?.happy && r < 0.25)) && Math.hypot(w.player.x - p.x, w.player.y - p.y) > 1.6) {
    const [px, py] = [Math.floor(w.player.x), Math.floor(w.player.y)];
    if (go([[px - 1, py], [px + 1, py], [px, py + 1], [px, py - 1]], 'follow', 4)) return;
  }
  if (v?.happy && r < 0.45) {
    p.doing = 'play';
    p.path = [];
    p.until = w.time + 3;
    return;
  }
  // its own place: to sleep there (the dragon, the robot at its charger), or just to be there
  const fav = find(w.room, [...(FAVOURITE[kind] ?? []), ...BEDS]);
  if (fav && r < 0.5) {
    const sleepy = kind === PET_DRAGON || BEDS.includes(fav.item) || (kind === PET_ROBOT && fav.item === 'robot_dock');
    if (go(around(w.room, w.catalog, fav), kind === PET_ROBOT && fav.item === 'robot_dock' ? 'eat' : sleepy ? 'sleep' : 'idle', 6 + w.random() * 10)) return;
  }
  // somewhere near, free; the fox farther and oftener
  const reach = kind === PET_FOX ? 6 : kind === PET_TURTLE ? 2 : 4;
  const cells = w.room.cells.filter(([x, y]) => Math.abs(x - from[0]) + Math.abs(y - from[1]) <= reach && !grid.blocked.has(cellKey(x, y)));
  const pick = cells[Math.floor(w.random() * cells.length)];
  if (pick && go([pick], 'walk', 2 + w.random() * 4)) {
    if (kind === PET_FOX) p.carry = w.random() < 0.2;
    return;
  }
  p.doing = 'idle';
  p.until = w.time + 3;
}

/** One step of an animal's day. */
export function stepHousePet(p: HousePet, dt: number, w: PetWorld): void {
  if (p.path.length === 0 && w.time >= p.until) choose(p, w);
  const target = p.path[0];
  if (target) {
    const dx = target[0] - p.x;
    const dy = target[1] - p.y;
    const dist = Math.hypot(dx, dy);
    const step = speedOf(p.look.kind) * dt;
    if (dist <= step) {
      p.x = target[0];
      p.y = target[1];
      p.path.shift();
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
    if (Math.abs(dx) > 0.001) p.dir = dx > 0 ? 'right' : 'left';
    p.pose = 'walk';
    return;
  }
  p.pose = p.doing === 'eat' ? 'eat' : p.doing === 'sleep' ? 'sleep' : p.doing === 'play' ? 'play' : 'sit';
  // the fox lets go of what it carried once it stops
  if (p.doing !== 'walk') p.carry = false;
}

/** What the dragon does to the air: warm within a couple of steps of it. */
export function warmsAt(pets: HousePet[], x: number, y: number): boolean {
  return pets.some((p) => p.look.kind === PET_DRAGON && Math.hypot(p.x - x, p.y - y) < 2.5);
}
