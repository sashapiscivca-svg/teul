// «Цеглинки»: shapes of four blocks fall into a well; full rows vanish. The rules only, no drawing:
// the computer's screen draws the state and feeds it the player's keys and the ticks of time.

export const WELL_W = 10;
export const WELL_H = 20;

/** The seven shapes of four blocks, each as cells in a 4×4 box, and its colour. */
export const SHAPES: { cells: [number, number][]; color: string }[] = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#3fb8b0' },
  { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: '#f4d35e' },
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#8a63c9' },
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#5aa469' },
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#d9534f' },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#4a8fd0' },
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#e8a23a' },
];

export interface Piece {
  shape: number;
  cells: [number, number][];
  x: number;
  y: number;
}

export interface Blocks {
  /** The well, row by row; 0 is empty, otherwise the shape's number plus one. */
  well: number[][];
  piece: Piece;
  next: number;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  /** A small generator of its own, so a game can be replayed from its seed. */
  seed: number;
}

function random(state: Blocks): number {
  // xorshift32
  let s = state.seed | 0 || 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  state.seed = s >>> 0;
  return state.seed;
}

function spawn(shape: number): Piece {
  return { shape, cells: SHAPES[shape].cells.map(([x, y]) => [x, y] as [number, number]), x: 3, y: 0 };
}

export function newBlocks(seed: number): Blocks {
  const state: Blocks = { well: Array.from({ length: WELL_H }, () => Array(WELL_W).fill(0)), piece: spawn(0), next: 0, score: 0, lines: 0, level: 1, over: false, seed: seed >>> 0 || 1 };
  state.piece = spawn(random(state) % SHAPES.length);
  state.next = random(state) % SHAPES.length;
  return state;
}

export function fits(state: Blocks, piece: Piece): boolean {
  return piece.cells.every(([cx, cy]) => {
    const x = piece.x + cx;
    const y = piece.y + cy;
    return x >= 0 && x < WELL_W && y < WELL_H && (y < 0 || state.well[y][x] === 0);
  });
}

/** Moves the piece sideways or down by one; false when something is in the way. */
export function move(state: Blocks, dx: number, dy: number): boolean {
  if (state.over) return false;
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (!fits(state, moved)) return false;
  state.piece = moved;
  return true;
}

/** Turns the piece a quarter clockwise, nudging it off a wall when it has to. */
export function turn(state: Blocks): boolean {
  if (state.over || state.piece.shape === 1) return false;
  const size = state.piece.shape === 0 ? 4 : 3;
  const cells = state.piece.cells.map(([x, y]) => [size - 1 - y, x] as [number, number]);
  for (const kick of [0, -1, 1, -2, 2]) {
    const turned = { ...state.piece, cells, x: state.piece.x + kick };
    if (fits(state, turned)) {
      state.piece = turned;
      return true;
    }
  }
  return false;
}

const LINE_SCORE = [0, 100, 300, 500, 800];

function settle(state: Blocks): number {
  for (const [cx, cy] of state.piece.cells) {
    const y = state.piece.y + cy;
    if (y < 0) {
      state.over = true;
      return 0;
    }
    state.well[y][state.piece.x + cx] = state.piece.shape + 1;
  }
  const kept = state.well.filter((row) => row.some((c) => c === 0));
  const cleared = WELL_H - kept.length;
  while (kept.length < WELL_H) kept.unshift(Array(WELL_W).fill(0));
  state.well = kept;
  state.lines += cleared;
  state.score += LINE_SCORE[cleared] * state.level;
  state.level = 1 + Math.floor(state.lines / 10);
  state.piece = spawn(state.next);
  state.next = random(state) % SHAPES.length;
  if (!fits(state, state.piece)) state.over = true;
  return cleared;
}

/** One tick of time: the piece falls a row, or lands. Returns how many rows were cleared. */
export function tick(state: Blocks): number {
  if (state.over) return 0;
  return move(state, 0, 1) ? 0 : settle(state);
}

/** Drops the piece all the way down at once. */
export function drop(state: Blocks): number {
  if (state.over) return 0;
  let fell = 0;
  while (move(state, 0, 1)) fell++;
  state.score += fell * 2;
  return settle(state);
}

/** How long a tick lasts at the current level, in milliseconds. */
export function tickMs(state: Blocks): number {
  return Math.max(90, 700 - (state.level - 1) * 60);
}

/** Where the piece would land, for the faint shadow under it. */
export function ghostY(state: Blocks): number {
  let y = state.piece.y;
  while (fits(state, { ...state.piece, y: y + 1 })) y++;
  return y;
}
