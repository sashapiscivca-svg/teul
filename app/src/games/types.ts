// The table games' common shape: a pure rule engine per game (a state, the legal moves, a move applied, the
// result), and a computer opponent of some skill. Moves are plain JSON.

export type Side = 0 | 1;

export interface Result {
  /** The winner, or null for a draw. */
  winner: Side | null;
  /** How it ended, in the world's words. */
  why: string;
}

export interface Rules<S, M> {
  id: GameId;
  name: string;
  /** A new game; `seed` decides the deal or the dice (both players use the same). */
  init(seed: number): S;
  /** Whose move it is. */
  turn(s: S): Side;
  /** Every legal move now (never empty while the game goes on). */
  legal(s: S): M[];
  apply(s: S, m: M): S;
  result(s: S): Result | null;
  /** The computer's move at a skill of 1 (a child) to 5 (the old master in the park). */
  ai(s: S, skill: number, rng: () => number): M;
}

export type GameId = 'chess' | 'checkers' | 'backgammon' | 'durak' | 'dominoes';

/** A small seeded generator (mulberry32): the same on every device. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffle by a seed (Fisher–Yates). */
export function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const r = rng(seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Two moves are the same move (they are small JSON values). */
export function sameMove(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether `m` is one of the legal moves now: a move from the other side is checked like this. */
export function isLegal<S, M>(rules: Rules<S, M>, s: S, m: unknown): m is M {
  return rules.legal(s).some((x) => sameMove(x, m));
}
