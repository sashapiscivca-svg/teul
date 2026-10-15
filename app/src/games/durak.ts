// «Дурень» підкидний for two: a deck of 36 (six to ace), six cards each, the last card of the deck face up shows
// the trumps. The one with the lowest trump attacks first. The attacker lays a card; the defender beats it with a
// higher card of its suit or with a trump, or takes; the attacker may throw in cards of the ranks already on the
// table (never more than the defender holds and never over six). All beaten: «бито», the cards go out and the
// defender attacks next; taken: the defender picks the table up and the attacker goes again. Both fill up to six
// from the deck, the attacker first. When the deck is gone, whoever is left holding cards is the «дурень».

import { shuffled, type Result, type Rules, type Side } from './types';
import { t } from '../i18n';

/** A card as "suit-rank": suits s c d h, ranks 6..14 (11 jack, 12 queen, 13 king, 14 ace). */
export type Card = string;

export interface DurakState {
  deck: Card[];
  trump: string;
  /** The face-up card at the bottom (it is drawn last). */
  trumpCard: Card;
  hands: [Card[], Card[]];
  /** Attacks and what beat them. */
  table: { a: Card; d: Card | null }[];
  attacker: Side;
  /** The defender said «беру»: the attacker may throw in, then the table is taken. */
  taking: boolean;
  /** How many the defender held when the bout began (the most that can be laid). */
  limit: number;
  out: number;
  /** Who was the first to run out of cards with the deck empty (they win). */
  first: Side | null;
}

export type DurakMove =
  | { type: 'play'; card: Card }
  | { type: 'beat'; card: Card; onto: number }
  | { type: 'take' }
  | { type: 'done' };

const SUITS = ['s', 'c', 'd', 'h'];
export const suitOf = (c: Card) => c.split('-')[0];
export const rankOf = (c: Card) => Number(c.split('-')[1]);

export function durakInit(seed: number): DurakState {
  const all: Card[] = [];
  for (const s of SUITS) for (let r = 6; r <= 14; r++) all.push(`${s}-${r}`);
  const deck = shuffled(all, seed);
  const hands: [Card[], Card[]] = [deck.splice(0, 6), deck.splice(0, 6)];
  const trumpCard = deck[deck.length - 1];
  const trump = suitOf(trumpCard);
  const low = (h: Card[]) => Math.min(99, ...h.filter((c) => suitOf(c) === trump).map(rankOf));
  const attacker: Side = low(hands[1]) < low(hands[0]) ? 1 : 0;
  return { deck, trump, trumpCard, hands, table: [], attacker, taking: false, limit: 6, out: 0, first: null };
}

const other = (s: Side): Side => (s === 0 ? 1 : 0);
const defender = (s: DurakState) => other(s.attacker);

export function durakTurn(s: DurakState): Side {
  if (s.taking) return s.attacker;
  return s.table.some((p) => p.d === null) ? defender(s) : s.attacker;
}

/** Whether `d` beats `a`. */
export function beats(d: Card, a: Card, trump: string): boolean {
  if (suitOf(d) === suitOf(a)) return rankOf(d) > rankOf(a);
  return suitOf(d) === trump && suitOf(a) !== trump;
}

export function durakLegal(s: DurakState): DurakMove[] {
  if (durakResult(s)) return [];
  const who = durakTurn(s);
  const hand = s.hands[who];
  const out: DurakMove[] = [];
  if (who === s.attacker) {
    const ranks = new Set(s.table.flatMap((p) => [p.a, ...(p.d ? [p.d] : [])]).map(rankOf));
    const laid = s.table.length;
    const unbeaten = s.table.filter((p) => p.d === null).length;
    const room = laid < 6 && laid < s.limit && (s.taking ? unbeaten < s.hands[defender(s)].length : true);
    for (const c of hand) if (room && (laid === 0 || ranks.has(rankOf(c)))) out.push({ type: 'play', card: c });
    if (laid > 0) out.push({ type: 'done' });
  } else {
    s.table.forEach((p, i) => {
      if (p.d !== null) return;
      for (const c of hand) if (beats(c, p.a, s.trump)) out.push({ type: 'beat', card: c, onto: i });
    });
    out.push({ type: 'take' });
  }
  return out;
}

function refill(s: DurakState): void {
  for (const who of [s.attacker, defender(s)]) {
    while (s.hands[who].length < 6 && s.deck.length) s.hands[who].push(s.deck.shift() as Card);
  }
}

export function durakApply(prev: DurakState, m: DurakMove): DurakState {
  const s: DurakState = structuredClone(prev);
  const who = durakTurn(s);
  const drop = (c: Card) => {
    s.hands[who] = s.hands[who].filter((x) => x !== c);
  };
  if (m.type === 'play') {
    if (s.table.length === 0) s.limit = Math.min(6, s.hands[defender(s)].length);
    drop(m.card);
    s.table.push({ a: m.card, d: null });
  } else if (m.type === 'beat') {
    drop(m.card);
    s.table[m.onto].d = m.card;
  } else if (m.type === 'take') {
    s.taking = true;
  } else if (m.type === 'done') {
    if (s.taking) {
      // the defender picks it all up; the same attacker goes again
      s.hands[defender(s)].push(...s.table.flatMap((p) => [p.a, ...(p.d ? [p.d] : [])]));
      s.table = [];
      s.taking = false;
      refill(s);
    } else {
      s.out += s.table.length * 2;
      s.table = [];
      refill(s);
      s.attacker = defender(s);
    }
  }
  // the first to be left with nothing, the deck gone, is out of the game (and not the fool)
  if (s.deck.length === 0 && s.first === null) {
    for (const side of [0, 1] as Side[]) if (s.hands[side].length === 0 && !(side === defender(s) && s.table.some((p) => p.d === null))) s.first ??= side;
  }
  // an attacker with no cards left while all is beaten: the bout ends by itself
  if (s.hands[s.attacker].length === 0 && s.table.length && s.table.every((p) => p.d !== null) && !s.taking) return durakApply(s, { type: 'done' });
  return s;
}

export function durakResult(s: DurakState): Result | null {
  if (s.deck.length > 0) return null;
  const [a, b] = [s.hands[0].length, s.hands[1].length];
  const open = s.table.length > 0;
  if (open) return null;
  if (a === 0 && b === 0) return { winner: null, why: t('games.durak.both') };
  if (a === 0) return { winner: 0, why: t('games.durak.fool') };
  if (b === 0) return { winner: 1, why: t('games.durak.fool') };
  return null;
}

export function durakAi(s: DurakState, skill: number, r: () => number): DurakMove {
  const moves = durakLegal(s);
  if (skill <= 1 && r() < 0.35) return moves[Math.floor(r() * moves.length)];
  const cost = (c: Card) => rankOf(c) + (suitOf(c) === s.trump ? 20 : 0);
  const who = durakTurn(s);
  if (who === s.attacker) {
    const plays = moves.filter((m): m is { type: 'play'; card: Card } => m.type === 'play').sort((x, y) => cost(x.card) - cost(y.card));
    // open with the cheapest; throw in only cheap cards (or anything near the end)
    if (s.table.length === 0) return plays[0] ?? moves[0];
    const cheap = plays.filter((p) => cost(p.card) < (s.deck.length > 6 ? 11 + skill : 40));
    return cheap[0] ?? { type: 'done' };
  }
  const beatsMoves = moves.filter((m): m is { type: 'beat'; card: Card; onto: number } => m.type === 'beat');
  const open = s.table.map((p, i) => ({ p, i })).filter((x) => x.p.d === null);
  // beat the open cards one by one with the cheapest that will do; take when it costs too dear
  const target = open[0];
  const options = beatsMoves.filter((m) => m.onto === target.i).sort((x, y) => cost(x.card) - cost(y.card));
  if (!options.length) return { type: 'take' };
  const best = options[0];
  const dear = cost(best.card) >= 30 && s.deck.length > 8 && skill >= 3;
  return dear ? { type: 'take' } : best;
}

export const DURAK: Rules<DurakState, DurakMove> = {
  id: 'durak',
  get name() { return t('games.durak.name'); },
  init: durakInit,
  turn: durakTurn,
  legal: durakLegal,
  apply: durakApply,
  result: durakResult,
  ai: durakAi,
};
