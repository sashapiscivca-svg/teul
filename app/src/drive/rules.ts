// The road's rules as the car feels them (pure): how fast it goes and stops, what the town allows where, and what
// the player does wrong on the way. What comes of a wrong (whether anyone saw, the fine, the cell) is the core's.

/** Cells a second: the car's top speed, the town's limit («50»), the school's («20»). Ten km/h a cell a second. */
export const CAR_MAX = 9;
export const TOWN_LIMIT = 5;
export const SCHOOL_LIMIT = 2;
/** How fast the car gathers speed and how hard it brakes (cells a second, each second). */
export const ACCEL = 4.5;
export const BRAKE = 9;
/** What the wheels may roll on without a fine: the streets, the gravel forecourts, the bridges, the tracks. */
export const DRIVABLE = new Set(['floor.cobble', 'floor.dirt', 'floor.deck', 'floor.gravel']);
/** How near the school's door counts as its zone (cells). */
export const SCHOOL_ZONE = 7;

export interface Car {
  x: number;
  y: number;
  /** Cells a second, along the way it faces. */
  speed: number;
  /** Quarter turns (like a mover): 0 +x, 1 +y, 2 -x, 3 -y. */
  rot: number;
  /** Cells driven this trip. */
  cells: number;
}

/** The speed the car heads for: the push on the stick (0..1) of the top speed; keys hold a town pace unless hurried. */
export function targetSpeed(push: number, fromKeys: boolean, hurry: boolean): number {
  if (push <= 0.05) return 0;
  if (fromKeys) return hurry ? CAR_MAX : TOWN_LIMIT * 0.9;
  return CAR_MAX * Math.min(1, push);
}

/** The new speed after `dt`: up gently, down quickly. */
export function nextSpeed(speed: number, target: number, dt: number): number {
  if (target > speed) return Math.min(target, speed + ACCEL * dt);
  return Math.max(target, speed - BRAKE * dt);
}

/** The quarter turn of a move over the floor. */
export function rotOf(dx: number, dy: number, was: number): number {
  if (Math.abs(dx) + Math.abs(dy) < 1e-5) return was;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

/** The limit where the car is. */
export function limitAt(nearSchool: boolean): number {
  return nearSchool ? SCHOOL_LIMIT : TOWN_LIMIT;
}

/** What the car is going through this frame. */
export interface RoadSample {
  dt: number;
  speed: number;
  /** The floor under the car. */
  floor: string;
  /** Within the school's zone. */
  nearSchool: boolean;
  /** On a zebra crossing, with someone on or at it. */
  zebraBusy: boolean;
  /** The nearest person (cells). */
  nearestPerson: number;
  /** It ran into something (it went far less than it meant to). */
  bumped: boolean;
}

export type Fault = 'speeding' | 'school_zone' | 'sidewalk' | 'zebra' | 'pedestrian' | 'crash';

/** How long each wrong must last before it counts (seconds), and how long before the same is counted again. */
const HOLD: Record<Fault, number> = { speeding: 1.4, school_zone: 0.8, sidewalk: 0.7, zebra: 0, pedestrian: 0, crash: 0 };
const AGAIN = 9;

/**
 * Watches a trip frame by frame and tells each wrong once (then not again for a while): too fast for the town or
 * the school, on the pavement or the grass, through a busy zebra, too close to people, into a fence.
 */
export class RoadWatch {
  private held = new Map<Fault, number>();
  private last = new Map<Fault, number>();
  private clock = 0;

  step(s: RoadSample): Fault[] {
    this.clock += s.dt;
    const now: Fault[] = [];
    const on = (f: Fault, cond: boolean) => {
      const h = cond ? (this.held.get(f) ?? 0) + s.dt : 0;
      this.held.set(f, h);
      if (!cond || h < HOLD[f]) return;
      const was = this.last.get(f);
      if (was !== undefined && this.clock - was < AGAIN) return;
      this.last.set(f, this.clock);
      now.push(f);
    };
    const moving = s.speed > 0.8;
    on('school_zone', s.nearSchool && s.speed > SCHOOL_LIMIT * 1.2);
    on('speeding', !s.nearSchool && s.speed > TOWN_LIMIT * 1.12);
    on('sidewalk', moving && !DRIVABLE.has(s.floor));
    on('zebra', moving && s.zebraBusy);
    on('pedestrian', s.speed > 2.4 && s.nearestPerson < 0.75);
    on('crash', s.bumped && s.speed > 2.6);
    return now;
  }

  reset(): void {
    this.held.clear();
    this.last.clear();
    this.clock = 0;
  }
}

/** The needle of the speedometer: an angle (radians) from the dial's start, 0..1 of its sweep. */
export function needle(speed: number): number {
  return Math.max(0, Math.min(1, speed / (CAR_MAX * 1.1)));
}

/** The practical exam's route: three road cells far from each other and from the start, then back. */
export function examRoute(roads: [number, number][], start: [number, number], seed: number): [number, number][] {
  if (roads.length === 0) return [];
  const pick: [number, number][] = [];
  let from = start;
  for (let k = 0; k < 3; k++) {
    let best: [number, number] | null = null;
    let bestScore = -1;
    for (let i = 0; i < roads.length; i += 7) {
      const c = roads[(i + seed * 13 + k * 101) % roads.length];
      const d = Math.abs(c[0] - from[0]) + Math.abs(c[1] - from[1]);
      const near = pick.some((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) < 8);
      // far enough to be a drive, not across the whole map
      const score = near ? -1 : d >= 10 && d <= 30 ? 100 - Math.abs(d - 18) : d < 10 ? d : 40 - d / 4;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    pick.push(best);
    from = best;
  }
  return [...pick, start];
}

/** Where the car is in the coupon's eyes: the holes as a row of punched (true) and whole places. */
export function couponPlaces(holes: number, coupon: number): boolean[] {
  return Array.from({ length: coupon }, (_, i) => i < holes);
}
