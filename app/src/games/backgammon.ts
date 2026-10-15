// Нарди in the international (backgammon) rules: 24 points, 15 checkers each, two dice (a double is played four
// times); a lone checker hit goes to the bar and must come back in first; a point with two or more of theirs is
// closed; bearing off once all are home. As many dice as possible must be played; if only one can be, the larger.
// The dice of each turn come from the game's seed and the turn's number: both players' devices roll the same.
// (No doubling cube and no opening roll: white begins; a win is a win, no gammons.)

import { rng, type Result, type Rules, type Side } from './types';
import { t } from '../i18n';

export interface BgState {
  /** Checkers on the points 0..23: white positive, black negative. White goes 23 → 0, black 0 → 23. */
  pts: number[];
  bar: [number, number];
  off: [number, number];
  side: Side;
  /** The dice of this turn (a double four times). */
  dice: number[];
  turn: number;
  seed: number;
}

/** One checker moved: from a point (or -1 from the bar) to a point (or 24 off the board). */
export interface BgStep {
  from: number;
  to: number;
  die: number;
}

export interface BgMove {
  steps: BgStep[];
}

export function rollDice(seed: number, turn: number): number[] {
  const r = rng((seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0);
  const a = 1 + Math.floor(r() * 6);
  const b = 1 + Math.floor(r() * 6);
  return a === b ? [a, a, a, a] : [a, b];
}

export function bgInit(seed: number): BgState {
  const pts = Array(24).fill(0);
  // white: 2 on 24 (index 23), 5 on 13, 3 on 8, 5 on 6; black mirrored
  pts[23] = 2;
  pts[12] = 5;
  pts[7] = 3;
  pts[5] = 5;
  pts[0] = -2;
  pts[11] = -5;
  pts[16] = -3;
  pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0], side: 0, dice: rollDice(seed, 0), turn: 0, seed };
}

const mine = (n: number, side: Side) => (side === 0 ? n > 0 : n < 0);
const theirs = (n: number, side: Side) => (side === 0 ? n < 0 : n > 0);
const count = (n: number) => Math.abs(n);

function allHome(s: BgState): boolean {
  if (s.bar[s.side] > 0) return false;
  for (let p = 0; p < 24; p++) {
    if (!mine(s.pts[p], s.side)) continue;
    if (s.side === 0 ? p > 5 : p < 18) return false;
  }
  return true;
}

/** The single steps a die allows now. */
function stepsFor(s: BgState, die: number): BgStep[] {
  const out: BgStep[] = [];
  const side = s.side;
  const open = (p: number) => count(s.pts[p]) <= 1 || !theirs(s.pts[p], side);
  if (s.bar[side] > 0) {
    const to = side === 0 ? 24 - die : die - 1;
    if (open(to)) out.push({ from: -1, to, die });
    return out;
  }
  const home = allHome(s);
  for (let p = 0; p < 24; p++) {
    if (!mine(s.pts[p], side)) continue;
    const to = side === 0 ? p - die : p + die;
    if (to >= 0 && to < 24) {
      if (open(to)) out.push({ from: p, to, die });
    } else if (home) {
      // bearing off: exactly, or with a bigger die from the farthest checker
      const exact = side === 0 ? p - die === -1 : p + die === 24;
      const farther = side === 0 ? s.pts.slice(p + 1, 6).some((n) => mine(n, side)) : s.pts.slice(18, p).some((n) => mine(n, side));
      if (exact || !farther) out.push({ from: p, to: 24, die });
    }
  }
  return out;
}

function step(s: BgState, st: BgStep): BgState {
  const pts = [...s.pts];
  const bar: [number, number] = [...s.bar];
  const off: [number, number] = [...s.off];
  const one = s.side === 0 ? 1 : -1;
  if (st.from === -1) bar[s.side]--;
  else pts[st.from] -= one;
  if (st.to === 24) off[s.side]++;
  else {
    if (theirs(pts[st.to], s.side) && count(pts[st.to]) === 1) {
      pts[st.to] = 0;
      bar[s.side === 0 ? 1 : 0]++;
    }
    pts[st.to] += one;
  }
  const dice = [...s.dice];
  dice.splice(dice.indexOf(st.die), 1);
  return { ...s, pts, bar, off, dice };
}

/** Every way to play the dice through (the most dice possible; then only the larger if just one). */
export function bgLegal(s: BgState): BgMove[] {
  if (s.off[0] === 15 || s.off[1] === 15) return [];
  const lines: BgStep[][] = [];
  const seen = new Set<string>();
  const walk = (cur: BgState, done: BgStep[]) => {
    const dice = [...new Set(cur.dice)];
    let any = false;
    for (const d of dice) {
      for (const st of stepsFor(cur, d)) {
        any = true;
        walk(step(cur, st), [...done, st]);
      }
    }
    if (!any) {
      const k = done.map((x) => `${x.from}>${x.to}:${x.die}`).join(',');
      if (!seen.has(k)) {
        seen.add(k);
        lines.push(done);
      }
    }
  };
  walk(s, []);
  const most = Math.max(...lines.map((l) => l.length));
  let best = lines.filter((l) => l.length === most);
  if (most === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const big = Math.max(...best.map((l) => l[0].die));
    best = best.filter((l) => l[0].die === big);
  }
  return best.map((steps) => ({ steps }));
}

export function bgApply(s: BgState, m: BgMove): BgState {
  let cur = s;
  for (const st of m.steps) cur = step(cur, st);
  const turn = s.turn + 1;
  return { ...cur, side: s.side === 0 ? 1 : 0, turn, dice: rollDice(s.seed, turn) };
}

export function bgResult(s: BgState): Result | null {
  if (s.off[0] === 15) return { winner: 0, why: t('games.backgammon.off') };
  if (s.off[1] === 15) return { winner: 1, why: t('games.backgammon.off') };
  return null;
}

/** How many pips a side still has to go. */
export function pips(s: BgState, side: Side): number {
  let n = s.bar[side] * 25;
  for (let p = 0; p < 24; p++) if (mine(s.pts[p], side)) n += count(s.pts[p]) * (side === 0 ? p + 1 : 24 - p);
  return n;
}

function judge(s: BgState, side: Side): number {
  const them: Side = side === 0 ? 1 : 0;
  let v = (pips(s, them) - pips(s, side)) * 2 + s.off[side] * 12 + s.bar[them] * 20;
  for (let p = 0; p < 24; p++) {
    if (!mine(s.pts[p], side)) continue;
    if (count(s.pts[p]) === 1) v -= 9; // a blot can be hit
    else v += 6; // a made point
  }
  return v;
}

export function bgAi(s: BgState, skill: number, r: () => number): BgMove {
  const moves = bgLegal(s);
  const noise = [0, 60, 35, 18, 8, 0][Math.max(0, Math.min(5, skill))];
  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves) {
    let cur = s;
    for (const st of m.steps) cur = step(cur, st);
    const v = judge(cur, s.side) + r() * noise;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

export const BACKGAMMON: Rules<BgState, BgMove> = {
  id: 'backgammon',
  get name() { return t('games.backgammon.name'); },
  init: bgInit,
  turn: (s) => s.side,
  legal: (s) => {
    const l = bgLegal(s);
    // no way to play these dice: the turn passes
    return l.length === 0 && !bgResult(s) ? [{ steps: [] }] : l;
  },
  apply: bgApply,
  result: bgResult,
  ai: bgAi,
};

/** Whether a few steps chosen so far can still become a whole legal move (for picking step by step). */
export function bgPrefixOk(s: BgState, steps: BgStep[]): boolean {
  return BACKGAMMON.legal(s).some((m) => steps.every((st, i) => m.steps[i] && m.steps[i].from === st.from && m.steps[i].to === st.to && m.steps[i].die === st.die));
}
