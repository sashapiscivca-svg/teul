// The pet: follows the player through doors (along a path), strolls about when the player rests, and curls up
// in its bed after a while.

import { cellKey } from './geometry';
import { cellsAround, findPath } from './path';
import type { Catalog, RoomView } from './types';
import { gridOf, type Walker } from './world';

export interface Pet {
  x: number;
  y: number;
  dir: 'left' | 'right';
  pose: 'sit' | 'walk' | 'sleep';
  /** Seconds the player has stood still. */
  idle: number;
  path?: [number, number][];
  /** Seconds until the path is worked out again. */
  repath?: number;
  /** Where it strolls to while the player rests, and until when. */
  stroll?: { x: number; y: number; until: number } | null;
  clock?: number;
}

const SPEED = 2.3;
const BEDS = ['cat_bed', 'doghouse'];

function cellOf(x: number, y: number): [number, number] {
  return [Math.floor(x), Math.floor(y)];
}

/** One step of the pet's life. `random` is injected so tests can be deterministic. */
export function stepPet(pet: Pet, player: Walker, playerMoving: boolean, dt: number, room: RoomView, catalog: Catalog, random: () => number = Math.random): Pet {
  pet.idle = playerMoving ? 0 : pet.idle + dt;
  pet.clock = (pet.clock ?? 0) + dt;
  pet.repath = (pet.repath ?? 0) - dt;
  const grid = gridOf(room, catalog);
  const bed = room.placements.find((p) => BEDS.includes(p.item));
  const far = Math.hypot(player.x - pet.x, player.y - pet.y);

  let target: [number, number] | null = null;
  let mode: 'follow' | 'stroll' | 'bed' | 'stay' = 'stay';
  if (bed && pet.idle > 12) {
    mode = 'bed';
  } else if (far > 2.2 || (playerMoving && far > 1.4)) {
    mode = 'follow';
    pet.stroll = null;
  } else if (pet.idle > 4) {
    mode = 'stroll';
  }

  if (mode === 'bed' && bed) {
    const bx = bed.x + 0.5;
    const by = bed.y + 0.55;
    if (Math.hypot(bx - pet.x, by - pet.y) < 0.1) {
      pet.pose = 'sleep';
      pet.path = [];
      return pet;
    }
    if (Math.hypot(bx - pet.x, by - pet.y) < 1.2) {
      // the last hop onto the bed itself
      pet.path = [[bx, by]];
    } else if (pet.repath <= 0 || !pet.path?.length) {
      const route = findPath(room, catalog, cellOf(pet.x, pet.y), cellsAround(bed.x, bed.y, 1, 1));
      pet.path = route ? [...route, [bx, by]] : [[bx, by]];
      pet.repath = 1.5;
    }
  } else if (mode === 'follow') {
    // a way worked out again now and then; with none left to walk, a little sooner — but never every frame (a
    // search over a whole big map, again and again, when no way is found)
    if (pet.repath <= 0 || (!pet.path?.length && pet.repath < 0.45)) {
      const [px, py] = cellOf(player.x, player.y);
      const goals: [number, number][] = [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1], [px - 1, py + 1], [px + 1, py + 1]];
      const route = findPath(room, catalog, cellOf(pet.x, pet.y), goals);
      pet.path = route ?? [];
      pet.repath = 0.6;
      if (!route) {
        // no way round (the roots of the oak, a hedge): it slips through to the player's side, as cats do
        const free = goals.find(([x, y]) => grid.cells.has(cellKey(x, y)) && !grid.blocked.has(cellKey(x, y)));
        if (free) {
          pet.x = free[0] + 0.5;
          pet.y = free[1] + 0.5;
        }
      }
    }
  } else if (mode === 'stroll') {
    if (!pet.stroll || (pet.clock ?? 0) > pet.stroll.until) {
      const [px, py] = cellOf(player.x, player.y);
      const choices = room.cells.filter(([x, y]) => Math.abs(x - px) + Math.abs(y - py) <= 3 && !grid.blocked.has(cellKey(x, y)));
      const pick = choices[Math.floor(random() * choices.length)];
      pet.stroll = pick ? { x: pick[0] + 0.5, y: pick[1] + 0.5, until: (pet.clock ?? 0) + 3 + random() * 4 } : null;
      if (pick) pet.path = findPath(room, catalog, cellOf(pet.x, pet.y), [pick]) ?? [];
    }
  } else {
    pet.path = [];
  }

  target = pet.path && pet.path.length > 0 ? pet.path[0] : null;
  if (!target) {
    pet.pose = 'sit';
    return pet;
  }
  const dx = target[0] - pet.x;
  const dy = target[1] - pet.y;
  const dist = Math.hypot(dx, dy);
  const step = SPEED * dt * (mode === 'stroll' ? 0.5 : 1);
  if (dist <= step) {
    pet.x = target[0];
    pet.y = target[1];
    pet.path?.shift();
  } else {
    pet.x += (dx / dist) * step;
    pet.y += (dy / dist) * step;
  }
  if (Math.abs(dx) > 0.001) pet.dir = dx > 0 ? 'right' : 'left';
  pet.pose = 'walk';
  return pet;
}
