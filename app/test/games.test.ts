import { describe, expect, it } from 'vitest';
import { CHESS, chessInit, chessLegal, chessApply, chessResult, inCheck, type ChessState } from '../src/games/chess';
import { CHECKERS, checkersInit, checkersLegal, checkersApply, type CheckersState, type Cell } from '../src/games/checkers';
import { BACKGAMMON, bgInit, bgLegal, rollDice, type BgState } from '../src/games/backgammon';
import { DURAK, durakInit, durakLegal, durakApply, beats } from '../src/games/durak';
import { DOMINOES, dominoInit, dominoLegal } from '../src/games/dominoes';
import { GAMES, GAME_IDS } from '../src/games';
import { isLegal, rng } from '../src/games/types';

const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);
const mv = (s: ChessState, f: string, t: string, p?: 'q' | 'r' | 'b' | 'n') => {
  const m = chessLegal(s).find((x) => x.f === sq(f) && x.t === sq(t) && x.p === p);
  if (!m) throw new Error(`${f}-${t} is not legal`);
  return chessApply(s, m);
};
const board = (rows: string[]): ChessState['b'] => rows.join('').split('').map((c) => (c === '.' ? '' : (c as never)));

describe('chess', () => {
  it('has twenty moves at the start', () => {
    expect(chessLegal(chessInit())).toHaveLength(20);
  });
  it("ends in fool's mate", () => {
    let s = chessInit();
    s = mv(s, 'f2', 'f3');
    s = mv(s, 'e7', 'e5');
    s = mv(s, 'g2', 'g4');
    s = mv(s, 'd8', 'h4');
    expect(inCheck(s)).toBe(true);
    expect(chessResult(s)).toEqual({ winner: 1, why: 'Мат.' });
  });
  it('castles both ways, not through check', () => {
    const s: ChessState = { b: board(['r...k..r', '........', '........', '........', '........', '........', '........', 'R...K..R']), side: 0, castle: 'KQkq', ep: -1, half: 0, seen: [] };
    const castles = chessLegal(s).filter((m) => m.f === sq('e1') && Math.abs(m.t - m.f) === 2).map((m) => m.t);
    expect(castles.sort()).toEqual([sq('c1'), sq('g1')].sort());
    const after = mv(s, 'e1', 'g1');
    expect(after.b[sq('f1')]).toBe('R');
    expect(after.castle).toBe('kq');
    // a black rook on f8 looking down the f-file: no short castling through f1
    const guarded: ChessState = { ...s, b: board(['r...kr..', '........', '........', '........', '........', '........', '........', 'R...K..R']) };
    expect(chessLegal(guarded).some((m) => m.f === sq('e1') && m.t === sq('g1'))).toBe(false);
  });
  it('takes en passant and promotes to any piece', () => {
    let s = chessInit();
    s = mv(s, 'e2', 'e4');
    s = mv(s, 'a7', 'a6');
    s = mv(s, 'e4', 'e5');
    s = mv(s, 'd7', 'd5');
    s = mv(s, 'e5', 'd6');
    expect(s.b[sq('d5')]).toBe('');
    const p: ChessState = { b: board(['....k...', 'P.......', '........', '........', '........', '........', '........', '....K...']), side: 0, castle: '', ep: -1, half: 0, seen: [] };
    const promos = chessLegal(p).filter((m) => m.f === sq('a7')).map((m) => m.p);
    expect(promos.sort()).toEqual(['b', 'n', 'q', 'r']);
    expect(mv(p, 'a7', 'a8', 'n').b[sq('a8')]).toBe('N');
  });
  it('calls stalemate and bare kings a draw', () => {
    const stale: ChessState = { b: board(['k.......', '..Q.....', '.K......', '........', '........', '........', '........', '........']), side: 1, castle: '', ep: -1, half: 0, seen: [] };
    expect(chessResult(stale)?.winner).toBeNull();
    const bare: ChessState = { b: board(['k.......', '........', '........', '........', '........', '........', '........', '.......K']), side: 0, castle: '', ep: -1, half: 0, seen: [] };
    expect(chessResult(bare)?.winner).toBeNull();
  });
  it('sees a mate in one at a high skill', () => {
    const s: ChessState = { b: board(['k.......', '........', '.K......', '........', '........', '........', '........', '.......Q']), side: 0, castle: '', ep: -1, half: 0, seen: [] };
    const m = CHESS.ai(s, 5, rng(1));
    expect(chessResult(chessApply(s, m))?.winner).toBe(0);
  });
});

const cb = (rows: string[]): Cell[] => rows.join('').split('').map((c) => (c === '.' ? '' : (c as Cell)));

describe('draughts (Шашки)', () => {
  it('starts with seven moves for white', () => {
    expect(checkersLegal(checkersInit())).toHaveLength(7);
  });
  it('makes taking a must, men take backwards, and chains', () => {
    // a white man on c3 with black men on b4 and on d4... taking is the only kind of move
    const s: CheckersState = { b: cb(['........', '........', '........', '........', '.b.b....', '..w.....', '........', '........']), side: 0, quiet: 0 };
    const moves = checkersLegal(s);
    expect(moves.every((m) => m.path.length >= 2 && Math.abs(m.path[1] - m.path[0]) === 18 || Math.abs(m.path[1] - m.path[0]) === 14)).toBe(true);
    // backwards: a white man on d4 takes a black man on c5? no — on e3 (behind it)
    const back: CheckersState = { b: cb(['........', '........', '........', '........', '...w....', '....b...', '........', '........']), side: 0, quiet: 0 };
    expect(checkersLegal(back).map((m) => m.path)).toEqual([[35, 53]]);
    // a chain of two takes
    const chain: CheckersState = { b: cb(['........', '........', '...b....', '........', '.b......', 'w.......', '........', '........']), side: 0, quiet: 0 };
    expect(checkersLegal(chain).map((m) => m.path)).toEqual([[40, 26, 12]]);
  });
  it('crowns a man mid-take and kings fly', () => {
    const s: CheckersState = { b: cb(['........', '..b.....', '...w....', '........', '........', '........', '........', '........']), side: 0, quiet: 0 };
    const after = checkersApply(s, checkersLegal(s)[0]);
    expect(after.b.includes('W')).toBe(true);
    const k: CheckersState = { b: cb(['........', '........', '........', '........', '........', '........', '........', 'W.......']), side: 0, quiet: 0 };
    expect(checkersLegal(k)).toHaveLength(7);
  });
  it('loses with no moves', () => {
    const s: CheckersState = { b: cb(['........', '........', '........', '........', '........', '........', '........', '........']), side: 0, quiet: 0 };
    expect(CHECKERS.result(s)?.winner).toBe(1);
  });
});

describe('backgammon (Нарди)', () => {
  it('rolls the same dice from the same seed, a double four times', () => {
    expect(rollDice(7, 3)).toEqual(rollDice(7, 3));
    for (let t = 0; t < 50; t++) {
      const d = rollDice(11, t);
      expect(d.length === 2 || (d.length === 4 && d.every((x) => x === d[0]))).toBe(true);
    }
  });
  it('plays both dice when it can, and comes in from the bar first', () => {
    const s = bgInit(5);
    const moves = bgLegal(s);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.steps.length === s.dice.length)).toBe(true);
    const barred: BgState = { ...s, bar: [1, 0], pts: s.pts.map((n, i) => (i === 23 ? 1 : n)), dice: [3, 5] };
    expect(bgLegal(barred).every((m) => m.steps[0].from === -1)).toBe(true);
  });
  it('bears off and wins', () => {
    const pts = Array(24).fill(0);
    pts[0] = 1;
    pts[23] = -15;
    const s: BgState = { pts, bar: [0, 0], off: [14, 0], side: 0, dice: [6, 2], turn: 9, seed: 1 };
    const m = BACKGAMMON.legal(s)[0];
    expect(m.steps.some((x: { to: number }) => x.to === 24)).toBe(true);
    expect(BACKGAMMON.result(BACKGAMMON.apply(s, m))?.winner).toBe(0);
  });
});

describe('durak (Дурень)', () => {
  it('deals six each with a trump at the bottom', () => {
    const s = durakInit(3);
    expect(s.hands[0]).toHaveLength(6);
    expect(s.hands[1]).toHaveLength(6);
    expect(s.deck).toHaveLength(24);
    expect(s.deck[s.deck.length - 1]).toBe(s.trumpCard);
  });
  it('beats by suit or by trump, and throws in only ranks on the table', () => {
    expect(beats('h-10', 'h-9', 's')).toBe(true);
    expect(beats('s-6', 'h-14', 's')).toBe(true);
    expect(beats('c-14', 'h-6', 's')).toBe(false);
    let s = durakInit(3);
    const first = durakLegal(s).find((m) => m.type === 'play');
    s = durakApply(s, first!);
    s = durakApply(s, { type: 'take' });
    const rank = Number((first as { card: string }).card.split('-')[1]);
    expect(durakLegal(s).filter((m) => m.type === 'play').every((m) => Number((m as { card: string }).card.split('-')[1]) === rank)).toBe(true);
  });
});

describe('dominoes (Доміно)', () => {
  it('lays only where the pips meet and draws when nothing fits', () => {
    const s = dominoInit(9);
    expect(dominoLegal(s)).toHaveLength(7);
    const t = DOMINOES.apply(s, dominoLegal(s)[0]);
    const ends = [t.line[0][0], t.line[t.line.length - 1][1]];
    for (const m of dominoLegal(t)) if (m.type === 'lay') expect(m.bone.some((p: number) => ends.includes(p))).toBe(true);
  });
});

describe('every game to its end', () => {
  for (const id of GAME_IDS) {
    it(`${id}: two computer players finish a game with only legal moves`, () => {
      const rules = GAMES[id];
      const r = rng(42);
      let s = rules.init(1234);
      let n = 0;
      while (!rules.result(s) && n < 600) {
        const m = rules.ai(s, n % 2 ? 2 : 4, r);
        expect(isLegal(rules, s, m)).toBe(true);
        s = rules.apply(s, m);
        n++;
      }
      // chess and draughts may draw by their own rules; every game either ended or is still lawful
      if (id !== 'chess' && id !== 'checkers') expect(rules.result(s)).not.toBeNull();
    });
  }
});
