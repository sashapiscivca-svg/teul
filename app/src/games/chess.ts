// Chess with the full rules: castling (not out of, through or into check), en passant, promotion (to any piece),
// check, mate and stalemate; draws by the fifty-move rule, by threefold repetition and by too little material to
// mate. The board is 64 squares from a8 (0) to h1 (63); white pieces are capitals, white moves first (side 0).

import type { Result, Rules, Side } from './types';
import { t } from '../i18n';

export type Piece = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface ChessState {
  b: (Piece | '')[];
  side: Side;
  /** Castling still allowed: K, Q (white), k, q (black). */
  castle: string;
  /** The square a pawn may be taken on en passant, or -1. */
  ep: number;
  /** Half-moves since the last capture or pawn move (the fifty-move rule). */
  half: number;
  /** Every position so far (for threefold repetition). */
  seen: string[];
}

export interface ChessMove {
  f: number;
  t: number;
  /** The piece a pawn becomes on the last rank. */
  p?: 'q' | 'r' | 'b' | 'n';
}

const START = 'rnbqkbnrpppppppp' + ' '.repeat(32) + 'PPPPPPPPRNBQKBNR';
const white = (c: string) => c !== '' && c === c.toUpperCase();
const sideOf = (c: string): Side | null => (c === '' ? null : white(c) ? 0 : 1);
const rowOf = (i: number) => i >> 3;
const colOf = (i: number) => i & 7;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

function key(s: Pick<ChessState, 'b' | 'side' | 'castle' | 'ep'>): string {
  return `${s.b.map((x) => x || '.').join('')}|${s.side}|${s.castle}|${s.ep}`;
}

export function chessInit(): ChessState {
  const b = [...START].map((c) => (c === ' ' ? '' : (c as Piece)));
  const s: ChessState = { b, side: 0, castle: 'KQkq', ep: -1, half: 0, seen: [] };
  s.seen = [key(s)];
  return s;
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Whether square `sq` is attacked by `by`. */
export function attacked(b: ChessState['b'], sq: number, by: Side): boolean {
  const r = rowOf(sq);
  const c = colOf(sq);
  const is = (i: number, kinds: string) => i >= 0 && b[i] !== '' && sideOf(b[i]) === by && kinds.includes(b[i].toLowerCase());
  // pawns attack diagonally forward (white upward, to smaller rows)
  const pr = by === 0 ? r + 1 : r - 1;
  if (is(at(pr, c - 1), 'p') || is(at(pr, c + 1), 'p')) return true;
  for (const [dr, dc] of KNIGHT) if (is(at(r + dr, c + dc), 'n')) return true;
  for (const [dr, dc] of KING) if (is(at(r + dr, c + dc), 'k')) return true;
  for (const [dirs, kinds] of [[ROOK, 'rq'], [BISHOP, 'bq']] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (at(rr, cc) >= 0) {
        const i = at(rr, cc);
        if (b[i] !== '') {
          if (is(i, kinds)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

export function inCheck(s: ChessState, side: Side = s.side): boolean {
  const k = s.b.indexOf(side === 0 ? 'K' : 'k');
  return k >= 0 && attacked(s.b, k, side === 0 ? 1 : 0);
}

function pseudo(s: ChessState): ChessMove[] {
  const out: ChessMove[] = [];
  const { b, side } = s;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p === '' || sideOf(p) !== side) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const kind = p.toLowerCase();
    const add = (t: number) => {
      if (t < 0) return false;
      if (b[t] === '') {
        out.push({ f: i, t });
        return true;
      }
      if (sideOf(b[t]) !== side) out.push({ f: i, t });
      return false;
    };
    if (kind === 'p') {
      const dir = side === 0 ? -1 : 1;
      const last = side === 0 ? 0 : 7;
      const push = (t: number) => {
        if (rowOf(t) === last) for (const q of ['q', 'r', 'b', 'n'] as const) out.push({ f: i, t, p: q });
        else out.push({ f: i, t });
      };
      const one = at(r + dir, c);
      if (one >= 0 && b[one] === '') {
        push(one);
        const two = at(r + 2 * dir, c);
        if ((side === 0 ? r === 6 : r === 1) && b[two] === '') out.push({ f: i, t: two });
      }
      for (const dc of [-1, 1]) {
        const t = at(r + dir, c + dc);
        if (t < 0) continue;
        if ((b[t] !== '' && sideOf(b[t]) !== side) || t === s.ep) push(t);
      }
    } else if (kind === 'n') for (const [dr, dc] of KNIGHT) add(at(r + dr, c + dc));
    else if (kind === 'k') {
      for (const [dr, dc] of KING) add(at(r + dr, c + dc));
      // castling: the king and the rook unmoved, the squares between empty, the king not passing through check
      const home = side === 0 ? 60 : 4;
      const them: Side = side === 0 ? 1 : 0;
      if (i === home && !attacked(b, home, them)) {
        const [k, q] = side === 0 ? ['K', 'Q'] : ['k', 'q'];
        if (s.castle.includes(k) && b[home + 1] === '' && b[home + 2] === '' && b[home + 3] === (side === 0 ? 'R' : 'r') && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) out.push({ f: i, t: home + 2 });
        if (s.castle.includes(q) && b[home - 1] === '' && b[home - 2] === '' && b[home - 3] === '' && b[home - 4] === (side === 0 ? 'R' : 'r') && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) out.push({ f: i, t: home - 2 });
      }
    } else {
      const dirs = kind === 'r' ? ROOK : kind === 'b' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (add(at(rr, cc))) {
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return out;
}

/** The board after a move (no checks): castling moves the rook, en passant removes the pawn. */
function play(s: ChessState, m: ChessMove): ChessState {
  const b = [...s.b];
  const p = b[m.f] as Piece;
  const kind = p.toLowerCase();
  const capture = b[m.t] !== '' || (kind === 'p' && m.t === s.ep);
  if (kind === 'p' && m.t === s.ep) b[m.t + (s.side === 0 ? 8 : -8)] = '';
  b[m.t] = m.p ? ((s.side === 0 ? m.p.toUpperCase() : m.p) as Piece) : p;
  b[m.f] = '';
  if (kind === 'k' && Math.abs(m.t - m.f) === 2) {
    const rookFrom = m.t > m.f ? m.f + 3 : m.f - 4;
    const rookTo = m.t > m.f ? m.f + 1 : m.f - 1;
    b[rookTo] = b[rookFrom];
    b[rookFrom] = '';
  }
  let castle = s.castle;
  const strip = (chars: string) => {
    for (const ch of chars) castle = castle.replace(ch, '');
  };
  if (p === 'K') strip('KQ');
  if (p === 'k') strip('kq');
  for (const sq of [m.f, m.t]) {
    if (sq === 63) strip('K');
    if (sq === 56) strip('Q');
    if (sq === 7) strip('k');
    if (sq === 0) strip('q');
  }
  const ep = kind === 'p' && Math.abs(m.t - m.f) === 16 ? (m.f + m.t) / 2 : -1;
  const side: Side = s.side === 0 ? 1 : 0;
  const next: ChessState = { b, side, castle, ep, half: capture || kind === 'p' ? 0 : s.half + 1, seen: s.seen };
  return next;
}

export function chessLegal(s: ChessState): ChessMove[] {
  return pseudo(s).filter((m) => !inCheck(play(s, m), s.side));
}

export function chessApply(s: ChessState, m: ChessMove): ChessState {
  const n = play(s, m);
  n.seen = [...s.seen, key(n)];
  return n;
}

function tooLittle(b: ChessState['b']): boolean {
  const rest = b.filter((x) => x !== '' && x.toLowerCase() !== 'k').map((x) => x.toLowerCase());
  return rest.length === 0 || (rest.length === 1 && (rest[0] === 'b' || rest[0] === 'n'));
}

export function chessResult(s: ChessState): Result | null {
  if (chessLegal(s).length === 0) {
    return inCheck(s) ? { winner: s.side === 0 ? 1 : 0, why: t('games.chess.mate') } : { winner: null, why: t('games.chess.stalemate') };
  }
  if (s.half >= 100) return { winner: null, why: t('games.chess.fifty') };
  const k = s.seen[s.seen.length - 1];
  if (s.seen.filter((x) => x === k).length >= 3) return { winner: null, why: t('games.chess.repeat') };
  if (tooLittle(s.b)) return { winner: null, why: t('games.chess.noMate') };
  return null;
}

// ---- the computer opponent: alpha-beta over material and a little sense of place ------------------------------

const VALUE: Record<string, number> = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };

function evaluate(s: ChessState): number {
  // from the side to move's point of view
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (p === '') continue;
    const kind = p.toLowerCase();
    const r = rowOf(i);
    const c = colOf(i);
    let v = VALUE[kind];
    const centre = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
    if (kind === 'n' || kind === 'b') v += centre * 6;
    if (kind === 'p') v += (white(p) ? 6 - r : r - 1) * 6 + (c >= 2 && c <= 5 ? 4 : 0);
    score += sideOf(p) === s.side ? v : -v;
  }
  return score;
}

function search(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = chessLegal(s);
  if (moves.length === 0) return inCheck(s) ? -100000 - depth : 0;
  if (depth === 0) return evaluate(s);
  // captures first: the cut-offs come sooner
  moves.sort((a, b) => (s.b[b.t] ? VALUE[s.b[b.t].toLowerCase()] : 0) - (s.b[a.t] ? VALUE[s.b[a.t].toLowerCase()] : 0));
  for (const m of moves) {
    const v = -search(play(s, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

export function chessAi(s: ChessState, skill: number, r: () => number): ChessMove {
  const moves = chessLegal(s);
  const depth = skill >= 5 ? 3 : skill >= 3 ? 2 : 1;
  // a weaker player sees less and errs more
  const noise = [0, 160, 90, 50, 20, 0][Math.max(0, Math.min(5, skill))];
  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves) {
    const v = -search(play(s, m), depth - 1, -Infinity, Infinity) + r() * noise;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

export const CHESS: Rules<ChessState, ChessMove> = {
  id: 'chess',
  get name() { return t('games.chess.name'); },
  init: () => chessInit(),
  turn: (s) => s.side,
  legal: chessLegal,
  apply: chessApply,
  result: chessResult,
  ai: chessAi,
};

/** A square's name (a8…h1), for the record of a game. */
export function squareName(i: number): string {
  return 'abcdefgh'[colOf(i)] + String(8 - rowOf(i));
}
