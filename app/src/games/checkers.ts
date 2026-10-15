// Шашки, classic 8×8 draughts (East-European rules): an 8×8 board, the dark squares; men move one square diagonally forward and take
// forward and backward; taking is a must and goes on while it can (any line of jumps may be chosen, not only the
// longest); a man that reaches the far row becomes a king — in the middle of a take too, and takes on as a king.
// Kings fly: along a diagonal any distance, and take a piece at any distance, landing on any free square beyond.
// Taken pieces leave the board when the move ends (none is jumped twice). No moves left: the game is lost.
// A draw when thirty moves pass with only kings moving and nothing taken.

import type { Result, Rules, Side } from './types';
import { t } from '../i18n';

/** 'w', 'b' men; 'W', 'B' kings; '' empty. Index = row * 8 + col, row 0 at the top (black's side). */
export type Cell = '' | 'w' | 'b' | 'W' | 'B';

export interface CheckersState {
  b: Cell[];
  side: Side;
  /** Moves since a man moved or something was taken. */
  quiet: number;
}

export interface CheckersMove {
  /** The squares the piece stands on, from the first to the last. */
  path: number[];
}

const rowOf = (i: number) => i >> 3;
const colOf = (i: number) => i & 7;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const owner = (c: Cell): Side | null => (c === '' ? null : c.toLowerCase() === 'w' ? 0 : 1);
const king = (c: Cell) => c === 'W' || c === 'B';
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function checkersInit(): CheckersState {
  const b: Cell[] = Array(64).fill('');
  for (let i = 0; i < 64; i++) {
    if ((rowOf(i) + colOf(i)) % 2 === 0) continue;
    if (rowOf(i) <= 2) b[i] = 'b';
    if (rowOf(i) >= 5) b[i] = 'w';
  }
  return { b, side: 0, quiet: 0 };
}

const lastRow = (side: Side) => (side === 0 ? 0 : 7);

/** Every line of takes from `from` (the piece `piece`), the taken ones not jumped again. */
function takes(b: Cell[], from: number, piece: Cell, side: Side, taken: Set<number>): number[][] {
  const out: number[][] = [];
  const r = rowOf(from);
  const c = colOf(from);
  for (const [dr, dc] of DIRS) {
    if (king(piece)) {
      // fly to the first piece, take it if it is theirs and the square beyond is free, land anywhere beyond
      let rr = r + dr;
      let cc = c + dc;
      while (at(rr, cc) >= 0 && b[at(rr, cc)] === '') {
        rr += dr;
        cc += dc;
      }
      const over = at(rr, cc);
      if (over < 0 || owner(b[over]) === side || taken.has(over)) continue;
      let lr = rr + dr;
      let lc = cc + dc;
      const lands: number[] = [];
      while (at(lr, lc) >= 0 && b[at(lr, lc)] === '') {
        lands.push(at(lr, lc));
        lr += dr;
        lc += dc;
      }
      for (const land of lands) {
        const t2 = new Set(taken).add(over);
        const b2 = [...b];
        b2[land] = piece;
        b2[from] = '';
        const more = takes(b2, land, piece, side, t2);
        if (more.length) for (const rest of more) out.push([land, ...rest]);
        else out.push([land]);
      }
    } else {
      const over = at(r + dr, c + dc);
      const land = at(r + 2 * dr, c + 2 * dc);
      if (over < 0 || land < 0 || b[land] !== '' || b[over] === '' || owner(b[over]) === side || taken.has(over)) continue;
      // a man that reaches the far row in a take is crowned and takes on as a king
      const crowned = rowOf(land) === lastRow(side) ? ((side === 0 ? 'W' : 'B') as Cell) : piece;
      const t2 = new Set(taken).add(over);
      const b2 = [...b];
      b2[land] = crowned;
      b2[from] = '';
      const more = takes(b2, land, crowned, side, t2);
      if (more.length) for (const rest of more) out.push([land, ...rest]);
      else out.push([land]);
    }
  }
  return out;
}

export function checkersLegal(s: CheckersState): CheckersMove[] {
  const caps: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (owner(p) !== s.side) continue;
    for (const line of takes(s.b, i, p, s.side, new Set())) caps.push({ path: [i, ...line] });
    if (caps.length) continue;
    const r = rowOf(i);
    const c = colOf(i);
    for (const [dr, dc] of DIRS) {
      if (king(p)) {
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) >= 0 && s.b[at(rr, cc)] === '') {
          steps.push({ path: [i, at(rr, cc)] });
          rr += dr;
          cc += dc;
        }
      } else if (dr === (s.side === 0 ? -1 : 1)) {
        const t = at(r + dr, c + dc);
        if (t >= 0 && s.b[t] === '') steps.push({ path: [i, t] });
      }
    }
  }
  return caps.length ? caps : steps;
}

/** The squares jumped over between two stops on a diagonal (a taken piece, if any). */
function between(b: Cell[], a: number, z: number): number[] {
  const dr = Math.sign(rowOf(z) - rowOf(a));
  const dc = Math.sign(colOf(z) - colOf(a));
  const out: number[] = [];
  let r = rowOf(a) + dr;
  let c = colOf(a) + dc;
  while (at(r, c) !== z) {
    if (b[at(r, c)] !== '') out.push(at(r, c));
    r += dr;
    c += dc;
  }
  return out;
}

export function checkersApply(s: CheckersState, m: CheckersMove): CheckersState {
  const b = [...s.b];
  let piece = b[m.path[0]];
  const wasMan = !king(piece);
  let took = false;
  for (let k = 1; k < m.path.length; k++) {
    for (const x of between(b, m.path[k - 1], m.path[k])) {
      b[x] = '';
      took = true;
    }
    if (rowOf(m.path[k]) === lastRow(s.side)) piece = s.side === 0 ? 'W' : 'B';
  }
  b[m.path[0]] = '';
  b[m.path[m.path.length - 1]] = piece;
  return { b, side: s.side === 0 ? 1 : 0, quiet: took || wasMan ? 0 : s.quiet + 1 };
}

export function checkersResult(s: CheckersState): Result | null {
  if (checkersLegal(s).length === 0) return { winner: s.side === 0 ? 1 : 0, why: s.b.some((c) => owner(c) === s.side) ? t('games.checkers.stuck') : t('games.checkers.taken') };
  if (s.quiet >= 30) return { winner: null, why: t('games.checkers.kings') };
  return null;
}

function evaluate(s: CheckersState): number {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (p === '') continue;
    const mine = owner(p) === s.side;
    const worth = king(p) ? 300 : 100 + (owner(p) === 0 ? 7 - rowOf(i) : rowOf(i)) * 4;
    v += mine ? worth : -worth;
  }
  return v;
}

function search(s: CheckersState, depth: number, alpha: number, beta: number): number {
  const moves = checkersLegal(s);
  if (moves.length === 0) return -10000 - depth;
  if (depth === 0) return evaluate(s);
  for (const m of moves) {
    const v = -search(checkersApply(s, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

export function checkersAi(s: CheckersState, skill: number, r: () => number): CheckersMove {
  const moves = checkersLegal(s);
  const depth = skill >= 5 ? 5 : skill >= 3 ? 3 : skill >= 2 ? 2 : 1;
  const noise = [0, 120, 70, 35, 12, 0][Math.max(0, Math.min(5, skill))];
  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves) {
    const v = -search(checkersApply(s, m), depth - 1, -Infinity, Infinity) + r() * noise;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

export const CHECKERS: Rules<CheckersState, CheckersMove> = {
  id: 'checkers',
  get name() { return t('games.checkers.name'); },
  init: () => checkersInit(),
  turn: (s) => s.side,
  legal: checkersLegal,
  apply: checkersApply,
  result: checkersResult,
  ai: checkersAi,
};
