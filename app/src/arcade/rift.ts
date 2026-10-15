// «Розлом»: the game on the computer hidden behind the cellar. A miner cat with a lamp goes down a crack that
// winds and narrows into the dark. Steer left and right; the rock and the spikes hurt, the crystals give light
// and points; the lamp burns down as you go, and a flare (three of them) lights the whole shaft for a moment.
// The deeper, the faster. The rules only, no drawing; integer arithmetic, the same seed digs the same shaft.

export const SHAFT_W = 13;
export const VIEW_H = 20;
/** The row the miner is on (the shaft scrolls up past it). */
export const PLAYER_ROW = 5;

export interface Rift {
  rows: string[];
  x: number;
  depth: number;
  score: number;
  lives: number;
  /** The lamp, 0..100. */
  light: number;
  flares: number;
  flareTicks: number;
  /** Ticks of grace after a hit. */
  hurt: number;
  over: boolean;
  ticks: number;
  rng: number;
  center: number;
  gap: number;
}

function next(r: Rift): number {
  r.rng = (Math.imul(r.rng, 1103515245) + 12345) >>> 0;
  return r.rng >>> 8;
}

/** One new row at the bottom: rock either side of a gap that drifts by at most one cell, so the way never breaks. */
function dig(r: Rift): string {
  const narrow = Math.min(3, Math.floor(r.depth / 150));
  const roll = next(r) % 10;
  if (roll < 3) r.center -= 1;
  else if (roll < 6) r.center += 1;
  if (next(r) % 7 === 0) r.gap += next(r) % 2 === 0 ? -1 : 1;
  r.gap = Math.max(3, Math.min(7 - narrow, r.gap));
  const half = Math.floor(r.gap / 2);
  r.center = Math.max(1 + half, Math.min(SHAFT_W - 2 - half, r.center));
  const from = r.center - half;
  const to = from + r.gap - 1;
  const row: string[] = [];
  for (let x = 0; x < SHAFT_W; x++) row.push(x >= from && x <= to ? '.' : '#');
  if (r.depth > 6) {
    const pick = from + (next(r) % r.gap);
    const what = next(r) % 100;
    if (what < 9) row[pick] = '*';
    else if (what < 9 + Math.min(18, 6 + Math.floor(r.depth / 40)) && r.gap >= 4) row[pick] = '^';
  }
  return row.join('');
}

export function newRift(seed: number): Rift {
  const r: Rift = { rows: [], x: 6, depth: 0, score: 0, lives: 3, light: 100, flares: 3, flareTicks: 0, hurt: 0, over: false, ticks: 0, rng: seed >>> 0 || 1, center: 6, gap: 6 };
  for (let i = 0; i < VIEW_H; i++) r.rows.push(dig(r));
  r.x = r.center;
  return r;
}

const open = (c: string | undefined) => c !== undefined && c !== '#';

export function steer(r: Rift, dx: number): void {
  if (r.over) return;
  const nx = r.x + Math.sign(dx);
  if (nx >= 0 && nx < SHAFT_W && open(r.rows[PLAYER_ROW][nx])) r.x = nx;
}

export function flare(r: Rift): boolean {
  if (r.over || r.flares <= 0) return false;
  r.flares--;
  r.flareTicks = 24;
  return true;
}

/** Whether a cell can be seen: near the lamp, or anywhere while a flare burns. */
export function lit(r: Rift, x: number, y: number): boolean {
  if (r.flareTicks > 0) return true;
  const radius = 1 + Math.floor(r.light / 16);
  return Math.abs(x - r.x) + Math.abs(y - PLAYER_ROW) <= radius;
}

/** One step down. Returns what the miner met there. */
export function tick(r: Rift): 'gem' | 'hit' | null {
  if (r.over) return null;
  r.ticks++;
  r.rows.shift();
  r.rows.push(dig(r));
  r.depth++;
  r.score++;
  if (r.flareTicks > 0) r.flareTicks--;
  if (r.hurt > 0) r.hurt--;
  if (r.ticks % 2 === 0) r.light = Math.max(0, r.light - 1);
  let met: 'gem' | 'hit' | null = null;
  const row = r.rows[PLAYER_ROW];
  const here = row[r.x];
  if (here === '*') {
    r.score += 25;
    r.light = Math.min(100, r.light + 30);
    r.rows[PLAYER_ROW] = row.slice(0, r.x) + '.' + row.slice(r.x + 1);
    met = 'gem';
  } else if (here === '#' || here === '^') {
    if (r.hurt === 0) {
      r.lives--;
      r.hurt = 6;
    }
    met = 'hit';
    // out of the rock to the nearest free cell
    for (let d = 1; d < SHAFT_W; d++) {
      const a = r.x - d;
      const b = r.x + d;
      if (a >= 0 && row[a] !== '#' && row[a] !== '^') {
        r.x = a;
        break;
      }
      if (b < SHAFT_W && row[b] !== '#' && row[b] !== '^') {
        r.x = b;
        break;
      }
    }
  }
  if (r.lives <= 0 || r.light <= 0) r.over = true;
  return met;
}

export function tickMs(r: Rift): number {
  return Math.max(70, 190 - Math.floor(r.depth / 4));
}
