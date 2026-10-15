import { describe, expect, it } from 'vitest';
import { Match } from '../src/games/match';
import { GAMES } from '../src/games';
import { rng } from '../src/games/types';

describe('a table game against the computer', () => {
  it('drops a move out of turn or against the rules', () => {
    const m = new Match('x', 'chess', 1, 1, { kind: 'ai', skill: 1, who: 'res_1' });
    // white's move is the computer's: not the hero's to make
    expect(m.play({ f: 52, t: 36 })).toBe(false);
    m.aiMove();
    expect(m.moves).toHaveLength(1);
    // a black move that is no move at all
    expect(m.play({ f: 0, t: 40 })).toBe(false);
    expect(m.play(m.legal()[0])).toBe(true);
  });

  it('plays the computer to the end, and a resignation ends it', () => {
    const m = new Match('c', 'checkers', 5, 0, { kind: 'ai', skill: 2, who: 'res_1' });
    const r = rng(9);
    for (let n = 0; n < 400 && !m.result; n++) {
      if (m.myTurn()) m.play(GAMES.checkers.ai(m.state, 1, r));
      else m.aiMove();
    }
    expect(m.result).not.toBeNull();
    const c = new Match('d', 'chess', 5, 1, { kind: 'ai', skill: 1, who: 'res_1' });
    c.aiMove();
    c.resign();
    expect(c.result?.winner).toBe(0);
  });
});
