// Доміно («козел» for two, the draw game): 28 bones from 0–0 to 6–6, seven each, the rest face down. The one with
// the highest double begins (else the highest bone). A bone is laid at either end of the line where its pips
// match; with nothing to lay, one draws from the rest, and passes when none are left. Whoever lays the last bone
// wins; when neither can go on, the fewer pips in hand win.

import { shuffled, type Result, type Rules, type Side } from './types';
import { t } from '../i18n';

export type Bone = [number, number];

export interface DominoState {
  hands: [Bone[], Bone[]];
  pile: Bone[];
  /** The line on the table, each bone turned so the pips meet: [left end … right end]. */
  line: Bone[];
  side: Side;
  /** Passes in a row (two: the game is blocked). */
  passes: number;
}

export type DominoMove = { type: 'lay'; bone: Bone; end: 'L' | 'R' } | { type: 'draw' } | { type: 'pass' };

const same = (a: Bone, b: Bone) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
const pipsOf = (h: Bone[]) => h.reduce((n, b) => n + b[0] + b[1], 0);

export function dominoInit(seed: number): DominoState {
  const all: Bone[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b]);
  const pile = shuffled(all, seed);
  const hands: [Bone[], Bone[]] = [pile.splice(0, 7), pile.splice(0, 7)];
  const best = (h: Bone[]) => Math.max(...h.map((b) => (b[0] === b[1] ? 100 + b[0] : b[0] + b[1])));
  return { hands, pile, line: [], side: best(hands[1]) > best(hands[0]) ? 1 : 0, passes: 0 };
}

function lays(s: DominoState): DominoMove[] {
  const hand = s.hands[s.side];
  if (s.line.length === 0) return hand.map((bone) => ({ type: 'lay', bone, end: 'R' as const }));
  const l = s.line[0][0];
  const r = s.line[s.line.length - 1][1];
  const out: DominoMove[] = [];
  for (const bone of hand) {
    if (bone[0] === l || bone[1] === l) out.push({ type: 'lay', bone, end: 'L' });
    if ((bone[0] === r || bone[1] === r) && !(l === r && (bone[0] === l || bone[1] === l))) out.push({ type: 'lay', bone, end: 'R' });
  }
  return out;
}

export function dominoLegal(s: DominoState): DominoMove[] {
  if (dominoResult(s)) return [];
  const l = lays(s);
  if (l.length) return l;
  return s.pile.length ? [{ type: 'draw' }] : [{ type: 'pass' }];
}

export function dominoApply(prev: DominoState, m: DominoMove): DominoState {
  const s: DominoState = structuredClone(prev);
  const hand = s.hands[s.side];
  if (m.type === 'draw') {
    hand.push(s.pile.shift() as Bone);
    s.passes = 0;
    return s; // the same player goes on (draws until something fits)
  }
  if (m.type === 'pass') {
    s.passes++;
    s.side = s.side === 0 ? 1 : 0;
    return s;
  }
  s.hands[s.side] = hand.filter((b) => !same(b, m.bone));
  const [a, b] = m.bone;
  if (s.line.length === 0) s.line.push([a, b]);
  else if (m.end === 'L') {
    const l = s.line[0][0];
    s.line.unshift(b === l ? [a, b] : [b, a]);
  } else {
    const r = s.line[s.line.length - 1][1];
    s.line.push(a === r ? [a, b] : [b, a]);
  }
  s.passes = 0;
  s.side = s.side === 0 ? 1 : 0;
  return s;
}

export function dominoResult(s: DominoState): Result | null {
  if (s.hands[0].length === 0) return { winner: 0, why: t('games.dominoes.fish') };
  if (s.hands[1].length === 0) return { winner: 1, why: t('games.dominoes.fish') };
  if (s.passes >= 2) {
    const [a, b] = [pipsOf(s.hands[0]), pipsOf(s.hands[1])];
    if (a === b) return { winner: null, why: t('games.dominoes.blockedEven') };
    return { winner: a < b ? 0 : 1, why: t('games.dominoes.blocked') };
  }
  return null;
}

export function dominoAi(s: DominoState, skill: number, r: () => number): DominoMove {
  const moves = dominoLegal(s);
  if (skill <= 1 && r() < 0.4) return moves[Math.floor(r() * moves.length)];
  // lay the heaviest bone first (doubles a little before), keeping ends one still holds
  const hand = s.hands[s.side];
  const score = (m: DominoMove) => {
    if (m.type !== 'lay') return -1;
    const [a, b] = m.bone;
    const keep = hand.filter((x) => !same(x, m.bone)).filter((x) => x.includes(a) || x.includes(b)).length;
    return a + b + (a === b ? 3 : 0) + keep * (skill >= 3 ? 2 : 0);
  };
  return [...moves].sort((x, y) => score(y) - score(x))[0];
}

export const DOMINOES: Rules<DominoState, DominoMove> = {
  id: 'dominoes',
  get name() { return t('games.dominoes.name'); },
  init: dominoInit,
  turn: (s) => s.side,
  legal: dominoLegal,
  apply: dominoApply,
  result: dominoResult,
  ai: dominoAi,
};
