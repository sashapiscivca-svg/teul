// A match at a table: two players (the hero and a townsperson played by the computer, or the hero playing both
// sides), one rule engine. A move that is not legal or out of turn is not taken.

import { GAMES } from './index';
import { isLegal, rng, type GameId, type Result, type Side } from './types';
import { t } from '../i18n';

export type Player = { kind: 'ai'; skill: number; who: string };

export class Match {
  state: unknown;
  readonly moves: unknown[] = [];
  result: Result | null = null;
  private readonly ai: () => number;
  onChange: () => void = () => {};

  constructor(
    readonly id: string,
    readonly game: GameId,
    readonly seed: number,
    /** The side the hero plays. */
    readonly me: Side,
    readonly them: Player,
  ) {
    this.state = GAMES[game].init(seed);
    this.ai = rng(seed ^ 0x51ed);
  }

  get rules() {
    return GAMES[this.game];
  }

  turn(): Side {
    return this.rules.turn(this.state);
  }

  myTurn(): boolean {
    return !this.result && this.turn() === this.me;
  }

  legal(): unknown[] {
    return this.myTurn() ? this.rules.legal(this.state) : [];
  }

  private take(m: unknown): void {
    this.state = this.rules.apply(this.state, m);
    this.moves.push(m);
    this.result = this.rules.result(this.state);
    this.onChange();
  }

  /** The hero's move: taken if legal and in turn. */
  play(m: unknown): boolean {
    if (!this.myTurn() || !isLegal(this.rules, this.state, m)) return false;
    this.take(m);
    return true;
  }

  /** The computer's move, when it is its turn. */
  aiMove(): unknown | null {
    if (this.result || this.turn() === this.me) return null;
    const m = this.rules.ai(this.state, this.them.skill, this.ai);
    this.take(m);
    return m;
  }

  resign(): void {
    if (this.result) return;
    this.result = { winner: this.me === 0 ? 1 : 0, why: t('games.match.youResigned') };
    this.onChange();
  }

  /** Offers a draw: the computer agrees when the game is long. */
  offerDraw(): boolean {
    if (this.result) return false;
    if (this.moves.length > 40) {
      this.result = { winner: null, why: t('games.match.nod') };
      this.onChange();
      return true;
    }
    return false;
  }
}
