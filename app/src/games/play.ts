// Table games in the world: who sits at the tables of the town (two old men over dominoes by the square, a pair
// at the park's chess table), whom one can play at a table (whoever is at it or near it, or oneself at home), and
// the computer's moves at a human pace and its words. Pure where it can be; the game supplies the world through
// `TableHost`.

import { GAMES } from './index';
import { Match } from './match';
import type { GameId, Side } from './types';
import { TableGameSheet, type Opponent } from '../ui/tablegame';
import { t } from '../i18n';

export interface TableHost {
  /** Residents of the town: id, name, age (child, adult, elder). */
  residents(): { id: string; name: string; age: string }[];
  /** Residents standing or sitting within a few steps of a point here. */
  near(x: number, y: number): string[];
  myName(): string;
  /** A little warmth with a neighbour after a game together. */
  together(who: string): void;
  seatAt(x: number, y: number): void;
}

const ALL: GameId[] = ['chess', 'checkers', 'backgammon', 'durak', 'dominoes'];
/** What each kind of table is laid for. */
export const TABLE_GAMES: Record<string, GameId[]> = {
  chess_table: ['chess', 'checkers'],
  domino_table: ['dominoes', 'durak', 'backgammon'],
  game_table_home: ALL,
  game_shelf: ALL,
};

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** How well someone plays (1 a small child … 5 the old master): by age and a little by who they are. */
export function skillOf(id: string, age: string): number {
  const k = hash(id) % 3;
  if (age === 'child') return 1 + (k === 2 ? 1 : 0);
  if (age === 'elder') return 3 + Math.min(2, k);
  return 2 + k;
}

const LINES = {
  start: ['games.play.start1', 'games.play.start2', 'games.play.start3', 'games.play.start4'],
  think: ['games.play.think1', 'games.play.think2', 'games.play.think3', 'games.play.think4'],
  win: ['games.play.win1', 'games.play.win2', 'games.play.win3'],
  lose: ['games.play.lose1', 'games.play.lose2', 'games.play.lose3'],
  draw: ['games.play.draw1', 'games.play.draw2'],
};
const line = (kind: keyof typeof LINES, name: string, k: number) => t(LINES[kind][Math.abs(k) % LINES[kind].length], { n: name });

/** Who sits at the town's tables now (a pure function of the clock and the day). */
export interface TableFigure {
  id: string;
  /** The resident playing (their look is theirs). */
  who: string;
  x: number;
  y: number;
  face: [number, number];
  emote: string | null;
}

export function tableFigures(o: {
  location: string;
  landmarks: Record<string, { x: number; y: number; w: number; h: number }> | undefined;
  elders: string[];
  minuteOfDay: number;
  day: number;
  wet: boolean;
  time: number;
}): TableFigure[] {
  if (o.location !== 'village' || !o.landmarks || o.wet || o.elders.length < 4) return [];
  const out: TableFigure[] = [];
  const pick = (k: number) => o.elders[(o.day * 3 + k) % o.elders.length];
  const pair = (lm: { x: number; y: number }, from: number, to: number, a: string, b: string, tag: string) => {
    if (o.minuteOfDay < from || o.minuteOfDay >= to) return;
    // a cheer now and then, when someone slams a bone down or takes a queen
    const beat = Math.floor(o.time / 4 + hash(tag)) % 9;
    out.push({ id: `${tag}:0`, who: a, x: lm.x + 0.5, y: lm.y + 0.5, face: [1, 0], emote: beat === 0 ? 'exclaim' : null });
    out.push({ id: `${tag}:1`, who: b, x: lm.x + 2.5, y: lm.y + 0.5, face: [-1, 0], emote: beat === 4 ? 'note' : null });
  };
  const dom = o.landmarks.domino_table;
  if (dom) pair(dom, 10 * 60, 18 * 60, pick(0), pick(1), 'dominoes');
  const chess = o.landmarks.chess_table;
  // chess in the afternoon, and not every day
  if (chess && (o.day % 3) !== 1) pair(chess, 14 * 60, 19 * 60, pick(2), pick(3), 'chess');
  return out;
}

export class TableGames {
  readonly sheet: TableGameSheet;
  match: Match | null = null;
  private opponentName = '';
  private aiTimer = 0;
  /** Where the table stands (for the seat), and its kind. */
  private table: { item: string; x: number; y: number } | null = null;

  constructor(parent: HTMLElement, private readonly host: TableHost) {
    this.sheet = new TableGameSheet(parent, {
      start: (who, game) => this.start(who, game),
      move: (m) => this.move(m),
      resign: () => this.resign(),
      draw: () => this.draw(),
      close: () => this.close(),
    });
  }

  isOpen(): boolean {
    return this.sheet.isOpen();
  }

  /** At a table: whom to play, and what. */
  open(item: string, x: number, y: number, figures: TableFigure[]): void {
    this.table = { item, x, y };
    const games = TABLE_GAMES[item] ?? ALL;
    const res = new Map(this.host.residents().map((r) => [r.id, r]));
    const opps: Opponent[] = [];
    const seen = new Set<string>();
    // those sitting at this very table first (one of them gives up the seat), then whoever is near
    for (const id of [...figures.filter((f) => Math.abs(f.x - x) < 3 && Math.abs(f.y - y) < 2).map((f) => f.who), ...this.host.near(x, y)]) {
      const r = res.get(id);
      if (!r || seen.has(id)) continue;
      seen.add(id);
      opps.push({ id: `res:${id}`, name: r.name, note: r.age === 'child' ? t('games.play.learning') : skillOf(id, r.age) >= 5 ? t('games.play.master') : t('games.play.neighbour'), games });
    }
    if (item === 'game_table_home' || item === 'game_shelf') opps.push({ id: 'self', name: t('games.play.self'), note: t('games.play.selfNote'), games });
    this.sheet.pick(item === 'chess_table' ? t('games.play.chessTable') : item === 'domino_table' ? t('games.play.dominoTable') : t('games.play.boardGames'), opps.filter((o) => o.games.length > 0),
      t('games.play.nobody'));
    this.host.seatAt(x, y);
  }

  private seedNow(): number {
    return (Date.now() ^ (hash(this.host.myName()) << 3)) >>> 0;
  }

  start(who: string, game: GameId): void {
    const seed = this.seedNow();
    const side: Side = (seed & 1) as Side;
    if (who.startsWith('res:')) {
      const id = who.slice(4);
      const r = this.host.residents().find((x) => x.id === id);
      if (!r) return;
      this.opponentName = r.name.split(' ')[0];
      this.match = new Match(`ai:${seed}`, game, seed, side, { kind: 'ai', skill: skillOf(id, r.age), who: id });
      this.show(line('start', this.opponentName, seed));
      this.schedule();
    } else if (who === 'self') {
      this.opponentName = '';
      this.match = new Match(`self:${seed}`, game, seed, 0, { kind: 'ai', skill: 0, who: '' });
      // both sides are the hero's: the match is turned for whoever is to move
      this.show(t('games.play.selfStart'));
    }
  }

  private show(words = ''): void {
    if (!this.match) return;
    const title = this.opponentName ? t('games.play.with', { game: GAMES[this.match.game].name, who: this.opponentName }) : GAMES[this.match.game].name;
    this.sheet.play(this.match, title, words);
  }

  private move(m: unknown): void {
    const match = this.match;
    if (!match) return;
    // playing both sides: the hero is whoever is to move
    if (match.id.startsWith('self:')) {
      (match as unknown as { me: Side }).me = match.turn();
      match.play(m);
      (match as unknown as { me: Side }).me = match.turn();
      this.show();
      return;
    }
    if (!match.play(m)) return;
    this.after();
    this.schedule();
  }

  /** The computer moves after a moment's thought. */
  private schedule(): void {
    const match = this.match;
    if (!match || match.result || match.myTurn()) return;
    window.clearTimeout(this.aiTimer);
    const think = 700 + (match.game === 'chess' ? 600 : 0);
    this.aiTimer = window.setTimeout(() => {
      if (this.match !== match) return;
      match.aiMove();
      this.after(Math.random() < 0.2 ? line('think', this.opponentName, match.moves.length) : '');
      this.schedule();
    }, think);
  }

  private after(words = ''): void {
    const match = this.match;
    if (!match) return;
    if (match.result) {
      const res = match.result;
      const kind = res.winner === null ? 'draw' : res.winner === match.me ? 'lose' : 'win';
      if (this.opponentName) {
        words = line(kind, this.opponentName, match.moves.length);
        this.host.together(match.them.who);
      }
    }
    this.show(words);
  }

  private resign(): void {
    this.match?.resign();
    this.after();
  }

  private draw(): void {
    this.match?.offerDraw();
    this.after(this.match?.result ? '' : t('games.play.drawOffered'));
  }

  close(): void {
    window.clearTimeout(this.aiTimer);
    this.match = null;
    this.sheet.close();
  }
}
