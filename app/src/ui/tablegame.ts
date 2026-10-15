// The table game sheet: first who to play and what, then the board. Chess and draughts on a pixel board (tap a
// piece, then where it goes), backgammon on its points (tap where from, then where to; the dice roll by
// themselves), the cards of «Дурень» and the bones of dominoes as rows to tap. The other player's words above
// the board; resign and draw below; how to play on request.

import { t } from '../i18n';
import { iconSvg } from '../icons';
import type { BgMove, BgState, BgStep } from '../games/backgammon';
import { bgPrefixOk } from '../games/backgammon';
import type { CheckersMove, CheckersState } from '../games/checkers';
import type { ChessMove, ChessState } from '../games/chess';
import type { DominoMove, DominoState } from '../games/dominoes';
import { rankOf, suitOf, type DurakMove, type DurakState } from '../games/durak';
import { GAMES } from '../games';
import type { Match } from '../games/match';
import type { GameId } from '../games/types';
import { h } from './dom';

export interface Opponent {
  id: string;
  name: string;
  /** What kind of opponent, in a word (a neighbour, a master, oneself). */
  note: string;
  games: GameId[];
}

export interface TableHandlers {
  start(opponent: string, game: GameId): void;
  move(m: unknown): void;
  resign(): void;
  draw(): void;
  close(): void;
}

const RULES: Record<GameId, string> = {
  chess: 'tablegame.rulesChess',
  checkers: 'tablegame.rulesCheckers',
  backgammon: 'tablegame.rulesBackgammon',
  durak: 'tablegame.rulesDurak',
  dominoes: 'tablegame.rulesDominoes',
};

const SUIT: Record<string, string> = { s: '♠', c: '♣', d: '♦', h: '♥' };
const RANK: Record<number, string> = { 11: 'tablegame.jack', 12: 'tablegame.queen', 13: 'tablegame.king', 14: 'tablegame.ace' };
const cardName = (c: string) => `${RANK[rankOf(c)] ? t(RANK[rankOf(c)]) : rankOf(c)}${SUIT[suitOf(c)]}`;

// pixel pieces, 10×10: '#' body, '+' outline
const PIECE: Record<string, string[]> = {
  p: ['..........', '....##....', '...####...', '...####...', '....##....', '...####...', '..######..', '..######..', '.########.', '..........'],
  n: ['..........', '...###....', '..#####...', '.###.###..', '.####.##..', '....####..', '...#####..', '..######..', '.########.', '..........'],
  b: ['....#.....', '...###....', '..##.##...', '..#.###...', '..#####...', '...###....', '...###....', '..#####...', '.#######..', '..........'],
  r: ['..........', '.#.##.#...', '.######...', '..####....', '..####....', '..####....', '..####....', '.######...', '########..', '..........'],
  q: ['.#.#.#.#..', '.#######..', '..#####...', '..#####...', '...###....', '...###....', '..#####...', '.#######..', '#########.', '..........'],
  k: ['....#.....', '...###....', '....#.....', '..#####...', '.#######..', '..#####...', '...###....', '..#####...', '.#######..', '..........'],
};

function drawPiece(g: CanvasRenderingContext2D, kind: string, white: boolean, x: number, y: number, cell: number): void {
  const map = PIECE[kind];
  const px = Math.max(1, Math.floor(cell / 12));
  const ox = x + Math.floor((cell - 10 * px) / 2);
  const oy = y + Math.floor((cell - 10 * px) / 2);
  // an outline a pixel round the body
  g.fillStyle = white ? '#2a2420' : '#efe6cf';
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (map[r][c] === '#') g.fillRect(ox + (c - 1) * px, oy + (r - 1) * px, px * 3, px * 3);
  g.fillStyle = white ? '#f4eedf' : '#2a2438';
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (map[r][c] === '#') g.fillRect(ox + c * px, oy + r * px, px, px);
}

export class TableGameSheet {
  readonly root: HTMLElement;
  private readonly card: HTMLElement;
  private match: Match | null = null;
  private title = '';
  private words = '';
  private sel: number | null = null;
  /** Checkers: the squares tapped so far; backgammon: the steps chosen so far. */
  private path: number[] = [];
  private steps: BgStep[] = [];
  private pickBone: { bone: [number, number]; ends: ('L' | 'R')[] } | null = null;
  private pickCard: string | null = null;
  private promo: ChessMove[] | null = null;
  private showRules = false;

  constructor(parent: HTMLElement, private readonly on: TableHandlers) {
    this.card = h('div', { class: 'settings-card tg-card' });
    this.root = h('div', { class: 'settings tablegame', role: 'dialog', 'aria-label': t('tablegame.title') }, this.card);
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  close(): void {
    this.root.style.display = 'none';
    this.match = null;
  }

  private head(title: string): HTMLElement {
    return h('div', { class: 'ph' }, h('b', null, title), h('button', { class: 'round small', type: 'button', 'aria-label': t('tablegame.close'), html: iconSvg('close', 20), onclick: () => this.on.close() }));
  }

  /** Who to play with, and what. */
  pick(place: string, opponents: Opponent[], empty: string): void {
    this.match = null;
    const rows: HTMLElement[] = [];
    for (const o of opponents) {
      rows.push(h('div', { class: 'tg-opp' }, h('div', { class: 'tg-opp-name' }, h('b', null, o.name), h('small', null, o.note)),
        h('div', { class: 'tg-opp-games' }, ...o.games.map((g) => h('button', { class: 'chip tg-game', type: 'button', 'data-game': g, 'data-who': o.id, onclick: () => this.on.start(o.id, g) }, GAMES[g].name)))));
    }
    if (!rows.length) rows.push(h('p', { class: 'tg-empty' }, empty));
    this.card.replaceChildren(this.head(place), h('div', { class: 'tg-pick' }, ...rows));
    this.root.style.display = '';
  }

  /** The board of a match, and what the other player says. */
  play(match: Match, title: string, words = ''): void {
    const fresh = this.match !== match;
    this.match = match;
    this.title = title;
    if (words) this.words = words;
    if (fresh) {
      this.sel = null;
      this.path = [];
      this.steps = [];
      this.pickBone = null;
      this.pickCard = null;
      this.promo = null;
      this.showRules = false;
    }
    this.render();
    this.root.style.display = '';
  }

  say(words: string): void {
    this.words = words;
    if (this.match) this.render();
  }

  render(): void {
    const m = this.match;
    if (!m) return;
    const status = m.result
      ? m.result.winner === null ? t('tablegame.drawWhy', { why: m.result.why }) : m.result.winner === m.me ? t('tablegame.winWhy', { why: m.result.why }) : t('tablegame.lossWhy', { why: m.result.why })
      : m.myTurn() ? t('tablegame.yourTurn') : t('tablegame.theirTurn');
    const board = this.board(m);
    const buttons: HTMLElement[] = [];
    if (!m.result) {
      buttons.push(h('button', { class: 'chip', type: 'button', onclick: () => this.on.resign() }, t('tablegame.resign')));
      if (m.game === 'chess' || m.game === 'checkers') buttons.push(h('button', { class: 'chip', type: 'button', onclick: () => this.on.draw() }, t('tablegame.offerDraw')));
    } else buttons.push(h('button', { class: 'cta', type: 'button', onclick: () => this.on.close() }, t('tablegame.leave')));
    buttons.push(h('button', { class: 'chip', type: 'button', onclick: () => { this.showRules = !this.showRules; this.render(); } }, t('tablegame.howTo')));
    const parts: HTMLElement[] = [
      this.head(this.title),
      h('p', { class: 'tg-words' }, this.words || ' '),
      h('div', { class: `tg-status ${m.result ? 'over' : m.myTurn() ? 'mine' : ''}` }, status),
      board,
      h('div', { class: 'tg-buttons' }, ...buttons),
    ];
    if (this.showRules) parts.push(h('p', { class: 'tg-rules' }, t(RULES[m.game])));
    this.card.replaceChildren(...parts);
  }

  private board(m: Match): HTMLElement {
    if (m.game === 'chess' || m.game === 'checkers') return this.grid(m);
    if (m.game === 'backgammon') return this.points(m);
    if (m.game === 'durak') return this.cards(m);
    return this.bones(m);
  }

  // ---- chess and draughts ------------------------------------------------------------------------------------

  private grid(m: Match): HTMLElement {
    const size = Math.min(336, Math.floor(Math.min(window.innerWidth * 0.86, window.innerHeight * 0.55) / 8) * 8);
    const cell = size / 8;
    const c = h('canvas', { class: 'tg-board', width: size, height: size }) as HTMLCanvasElement;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const flip = m.me === 1;
    const view = (i: number) => (flip ? 63 - i : i);
    const legal = m.legal() as (ChessMove | CheckersMove)[];
    const last = m.moves[m.moves.length - 1] as (ChessMove & CheckersMove) | undefined;
    const lastSq = last ? (m.game === 'chess' ? [last.f, last.t] : last.path) : [];
    const targets = new Set<number>();
    if (this.sel !== null) {
      if (m.game === 'chess') for (const x of legal as ChessMove[]) if (x.f === this.sel) targets.add(x.t);
      if (m.game === 'checkers') for (const x of legal as CheckersMove[]) if (this.path.every((p, i) => x.path[i] === p) && x.path.length > this.path.length) targets.add(x.path[this.path.length]);
    }
    for (let v = 0; v < 64; v++) {
      const i = view(v);
      const x = (v % 8) * cell;
      const y = Math.floor(v / 8) * cell;
      const dark = ((i >> 3) + (i & 7)) % 2 === 1;
      g.fillStyle = dark ? '#8a5a3a' : '#efd9b0';
      g.fillRect(x, y, cell, cell);
      if (lastSq.includes(i)) {
        g.fillStyle = 'rgba(246, 179, 71, 0.45)';
        g.fillRect(x, y, cell, cell);
      }
      if (i === this.sel || this.path.includes(i)) {
        g.fillStyle = 'rgba(85, 214, 194, 0.55)';
        g.fillRect(x, y, cell, cell);
      }
      if (m.game === 'chess') {
        const p = (m.state as ChessState).b[i];
        if (p) drawPiece(g, p.toLowerCase(), p === p.toUpperCase(), x, y, cell);
      } else {
        const p = (m.state as CheckersState).b[i];
        if (p) {
          const white = p.toLowerCase() === 'w';
          g.fillStyle = white ? '#2a2420' : '#efe6cf';
          g.beginPath();
          g.arc(x + cell / 2, y + cell / 2, cell * 0.38, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = white ? '#f4eedf' : '#2a2438';
          g.beginPath();
          g.arc(x + cell / 2, y + cell / 2, cell * 0.32, 0, Math.PI * 2);
          g.fill();
          if (p === 'W' || p === 'B') {
            g.fillStyle = '#f6b347';
            g.fillRect(x + cell * 0.38, y + cell * 0.38, cell * 0.24, cell * 0.24);
          }
        }
      }
      if (targets.has(i)) {
        g.fillStyle = 'rgba(42, 160, 120, 0.85)';
        g.fillRect(x + cell * 0.4, y + cell * 0.4, cell * 0.2, cell * 0.2);
      }
    }
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const col = Math.floor(((e.clientX - r.left) / r.width) * 8);
      const row = Math.floor(((e.clientY - r.top) / r.height) * 8);
      if (col < 0 || col > 7 || row < 0 || row > 7) return;
      this.tapSquare(m, view(row * 8 + col));
    });
    const wrap = h('div', { class: 'tg-board-wrap' }, c);
    if (this.promo) {
      wrap.append(h('div', { class: 'tg-promo' }, ...this.promo.map((x) => h('button', { class: 'chip', type: 'button', onclick: () => { this.promo = null; this.sel = null; this.on.move(x); } }, t({ q: 'tablegame.queenPiece', r: 'tablegame.rook', b: 'tablegame.bishop', n: 'tablegame.knight' }[x.p ?? 'q'] ?? 'tablegame.queenPiece')))));
    }
    return wrap;
  }

  private tapSquare(m: Match, i: number): void {
    if (!m.myTurn()) return;
    if (m.game === 'chess') {
      const legal = m.legal() as ChessMove[];
      if (this.sel !== null) {
        const to = legal.filter((x) => x.f === this.sel && x.t === i);
        if (to.length === 1) {
          this.sel = null;
          this.on.move(to[0]);
          return;
        }
        if (to.length > 1) {
          this.promo = to;
          this.render();
          return;
        }
      }
      this.sel = legal.some((x) => x.f === i) ? i : null;
      this.render();
      return;
    }
    const legal = m.legal() as CheckersMove[];
    if (this.path.length === 0 || legal.every((x) => x.path[0] !== this.path[0]) || (legal.some((x) => x.path[0] === i) && this.path.length === 1 && i !== this.path[0])) {
      if (legal.some((x) => x.path[0] === i)) {
        this.path = [i];
        this.sel = i;
      } else {
        this.path = [];
        this.sel = null;
      }
      this.render();
      return;
    }
    // straight to where it stops, if only one way leads there; else step by step
    const ends = legal.filter((x) => x.path[0] === this.path[0] && x.path[x.path.length - 1] === i && this.path.every((p, k) => x.path[k] === p));
    if (ends.length === 1) {
      this.path = [];
      this.sel = null;
      this.on.move(ends[0]);
      return;
    }
    const next = [...this.path, i];
    if (legal.some((x) => next.every((p, k) => x.path[k] === p))) {
      const done = legal.find((x) => x.path.length === next.length && next.every((p, k) => x.path[k] === p));
      if (done) {
        this.path = [];
        this.sel = null;
        this.on.move(done);
        return;
      }
      this.path = next;
    }
    this.render();
  }

  // ---- backgammon ---------------------------------------------------------------------------------------------

  private points(m: Match): HTMLElement {
    const s = m.state as BgState;
    const W = Math.min(360, Math.floor(window.innerWidth * 0.9));
    const H = Math.floor(W * 0.66);
    const c = h('canvas', { class: 'tg-board', width: W, height: H }) as HTMLCanvasElement;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const off = Math.floor(W * 0.08);
    const pw = (W - off - W * 0.06) / 12;
    const barX = 6 * pw;
    const barW = W * 0.06;
    // a point's left edge on screen, and whether it is on the top row
    const place = (p: number): { x: number; top: boolean } => {
      if (p <= 11) {
        const k = 11 - p;
        return { x: k * pw + (k >= 6 ? barW : 0), top: false };
      }
      const k = p - 12;
      return { x: k * pw + (k >= 6 ? barW : 0), top: true };
    };
    g.fillStyle = '#6a4528';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d8c39a';
    g.fillRect(2, 2, W - off - 4, H - 4);
    g.fillStyle = '#6a4528';
    g.fillRect(barX, 0, barW, H);
    const sim = this.steps.reduce((st, x) => ({ ...st, ...stepped(st, x) }), s);
    const from = new Set<number>();
    const to = new Set<number>();
    if (m.myTurn()) {
      for (const mv of m.legal() as BgMove[]) {
        if (!this.steps.every((st, i) => mv.steps[i] && mv.steps[i].from === st.from && mv.steps[i].to === st.to)) continue;
        const nx = mv.steps[this.steps.length];
        if (!nx) continue;
        from.add(nx.from);
        if (this.sel !== null && nx.from === this.sel) to.add(nx.to);
      }
    }
    for (let p = 0; p < 24; p++) {
      const { x, top } = place(p);
      g.fillStyle = p % 2 ? '#8a3a2a' : '#2f4a5a';
      g.beginPath();
      if (top) {
        g.moveTo(x, 2);
        g.lineTo(x + pw, 2);
        g.lineTo(x + pw / 2, H * 0.42);
      } else {
        g.moveTo(x, H - 2);
        g.lineTo(x + pw, H - 2);
        g.lineTo(x + pw / 2, H * 0.58);
      }
      g.fill();
      if (p === this.sel || to.has(p)) {
        g.fillStyle = p === this.sel ? 'rgba(85,214,194,0.55)' : 'rgba(42,160,120,0.6)';
        g.fillRect(x + 2, top ? 2 : H * 0.55, pw - 4, H * 0.43);
      }
      const n = Math.abs(sim.pts[p]);
      const white = sim.pts[p] > 0;
      const r = Math.min(pw * 0.45, H * 0.07);
      for (let k = 0; k < Math.min(n, 5); k++) {
        const cy = top ? 2 + r + k * r * 2 : H - 2 - r - k * r * 2;
        disc(g, x + pw / 2, cy, r, white);
      }
      if (n > 5) {
        g.fillStyle = white ? '#2a2420' : '#efe6cf';
        g.font = `${Math.floor(r)}px monospace`;
        g.fillText(String(n), x + pw / 2 - r / 3, top ? 2 + r * 9.4 : H - 2 - r * 8.6);
      }
    }
    // the bar and the off tray
    for (const side of [0, 1] as const) {
      for (let k = 0; k < sim.bar[side]; k++) disc(g, barX + barW / 2, side === 0 ? H * 0.62 + k * 10 : H * 0.38 - k * 10, Math.min(barW * 0.45, 9), side === 0);
      g.fillStyle = side === 0 ? '#f4eedf' : '#2a2438';
      for (let k = 0; k < sim.off[side]; k++) g.fillRect(W - off + 4, side === 0 ? H - 6 - k * 5 : 2 + k * 5, off - 8, 4);
    }
    if (to.has(24)) {
      g.fillStyle = 'rgba(42,160,120,0.6)';
      g.fillRect(W - off, 0, off, H);
    }
    // the dice
    const dice = s.dice.slice(this.steps.length === 0 ? 0 : 0);
    dice.forEach((d, k) => {
      const used = k < this.steps.length;
      const dx = barX + barW + pw * 2 + k * (pw * 0.9);
      g.fillStyle = used ? '#a89880' : '#f4eedf';
      g.fillRect(dx, H / 2 - pw * 0.35, pw * 0.7, pw * 0.7);
      g.fillStyle = '#2a2420';
      g.font = `${Math.floor(pw * 0.5)}px monospace`;
      g.fillText(String(d), dx + pw * 0.2, H / 2 + pw * 0.18);
    });
    c.addEventListener('click', (e) => {
      if (!m.myTurn()) return;
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      let hit: number | null = null;
      if (x >= W - off) hit = 24;
      else if (x >= barX && x < barX + barW) hit = -1;
      else for (let p = 0; p < 24; p++) {
        const pl = place(p);
        if (x >= pl.x && x < pl.x + pw && (pl.top ? y < H / 2 : y >= H / 2)) hit = p;
      }
      if (hit === null) return;
      if (this.sel !== null && to.has(hit)) {
        const legal = m.legal() as BgMove[];
        const step = legal.map((mv) => mv.steps[this.steps.length]).find((st) => st && st.from === this.sel && st.to === hit);
        if (step && bgPrefixOk(s, [...this.steps, step])) {
          this.steps.push(step);
          this.sel = null;
          const done = legal.find((mv) => mv.steps.length === this.steps.length && mv.steps.every((st, i) => st.from === this.steps[i].from && st.to === this.steps[i].to && st.die === this.steps[i].die));
          if (done) {
            this.steps = [];
            this.on.move(done);
            return;
          }
        }
      } else this.sel = from.has(hit) ? hit : null;
      this.render();
    });
    const wrap = h('div', { class: 'tg-board-wrap' }, c);
    const legal = m.myTurn() ? (m.legal() as BgMove[]) : [];
    if (legal.length === 1 && legal[0].steps.length === 0) wrap.append(h('button', { class: 'chip', type: 'button', onclick: () => this.on.move(legal[0]) }, t('tablegame.noMove')));
    if (this.steps.length) wrap.append(h('button', { class: 'chip', type: 'button', onclick: () => { this.steps = []; this.sel = null; this.render(); } }, t('tablegame.restartMove')));
    return wrap;
  }

  // ---- «Дурень» -----------------------------------------------------------------------------------------------

  private cards(m: Match): HTMLElement {
    const s = m.state as DurakState;
    const legal = m.legal() as DurakMove[];
    const them = s.hands[m.me === 0 ? 1 : 0].length;
    const top = h('div', { class: 'tg-row' }, h('span', { class: 'tg-back' }, t('tablegame.theirCards', { n: them })), h('span', { class: 'tg-deck' }, s.deck.length ? t('tablegame.deckTrump', { n: s.deck.length, card: cardName(s.trumpCard) }) : t('tablegame.trump', { suit: SUIT[s.trump] })));
    const table = h('div', { class: 'tg-table' }, ...s.table.map((p, i) => {
      const can = this.pickCard !== null && legal.some((x) => x.type === 'beat' && x.card === this.pickCard && x.onto === i);
      return h('button', { class: `tg-pair ${can ? 'target' : ''}`, type: 'button', disabled: !can, onclick: () => { const c = this.pickCard; this.pickCard = null; this.on.move({ type: 'beat', card: c, onto: i }); } },
        this.cardEl(p.a), p.d ? this.cardEl(p.d, 'over') : null);
    }));
    const hand = h('div', { class: 'tg-hand' }, ...[...s.hands[m.me]].sort((a, b) => (suitOf(a) === s.trump ? 100 : 0) + rankOf(a) - ((suitOf(b) === s.trump ? 100 : 0) + rankOf(b))).map((c) => {
      const play = legal.find((x) => x.type === 'play' && x.card === c);
      const beat = legal.some((x) => x.type === 'beat' && x.card === c);
      const el = this.cardEl(c, `${play || beat ? 'can' : ''} ${this.pickCard === c ? 'picked' : ''}`) as HTMLButtonElement;
      el.addEventListener('click', () => {
        if (play) this.on.move(play);
        else if (beat) {
          const only = legal.filter((x) => x.type === 'beat' && x.card === c);
          if (only.length === 1) this.on.move(only[0]);
          else {
            this.pickCard = c;
            this.render();
          }
        }
      });
      return el;
    }));
    const acts = h('div', { class: 'tg-row' },
      legal.some((x) => x.type === 'take') ? h('button', { class: 'chip', type: 'button', onclick: () => this.on.move({ type: 'take' }) }, t('tablegame.take')) : null,
      legal.some((x) => x.type === 'done') ? h('button', { class: 'chip', type: 'button', onclick: () => this.on.move({ type: 'done' }) }, s.taking ? t('tablegame.takeThem') : t('tablegame.beaten')) : null);
    return h('div', { class: 'tg-cards' }, top, table, hand, acts);
  }

  private cardEl(c: string, cls = ''): HTMLElement {
    const red = suitOf(c) === 'h' || suitOf(c) === 'd';
    return h('button', { class: `tg-card-face ${red ? 'red' : ''} ${cls}`, type: 'button', 'data-card': c }, cardName(c));
  }

  // ---- dominoes -----------------------------------------------------------------------------------------------

  private bones(m: Match): HTMLElement {
    const s = m.state as DominoState;
    const legal = m.legal() as DominoMove[];
    const bone = (b: [number, number], cls = '') => h('span', { class: `tg-bone ${cls}` }, h('i', null, String(b[0])), h('i', null, String(b[1])));
    const line = h('div', { class: 'tg-line' }, ...s.line.map((b) => bone(b)));
    const them = s.hands[m.me === 0 ? 1 : 0].length;
    const top = h('div', { class: 'tg-row' }, h('span', { class: 'tg-back' }, t('tablegame.theirBones', { n: them })), h('span', { class: 'tg-deck' }, t('tablegame.pile', { n: s.pile.length })));
    const hand = h('div', { class: 'tg-hand' }, ...s.hands[m.me].map((b) => {
      const ends = legal.filter((x): x is Extract<DominoMove, { type: 'lay' }> => x.type === 'lay' && x.bone[0] === b[0] && x.bone[1] === b[1]).map((x) => x.end);
      const el = h('button', { class: `tg-bone-btn ${ends.length ? 'can' : ''}`, type: 'button', 'data-bone': `${b[0]}-${b[1]}` }, bone(b));
      el.addEventListener('click', () => {
        if (!ends.length) return;
        if (ends.length === 1) this.on.move({ type: 'lay', bone: b, end: ends[0] });
        else {
          this.pickBone = { bone: b, ends };
          this.render();
        }
      });
      return el;
    }));
    const acts = h('div', { class: 'tg-row' },
      ...(this.pickBone ? this.pickBone.ends.map((e) => h('button', { class: 'chip', type: 'button', onclick: () => { const b = this.pickBone!.bone; this.pickBone = null; this.on.move({ type: 'lay', bone: b, end: e }); } }, e === 'L' ? t('tablegame.left') : t('tablegame.right'))) : []),
      legal.some((x) => x.type === 'draw') ? h('button', { class: 'chip', type: 'button', onclick: () => this.on.move({ type: 'draw' }) }, t('tablegame.drawBone')) : null,
      legal.some((x) => x.type === 'pass') ? h('button', { class: 'chip', type: 'button', onclick: () => this.on.move({ type: 'pass' }) }, t('tablegame.pass')) : null);
    return h('div', { class: 'tg-cards' }, top, line, hand, acts);
  }
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number, white: boolean): void {
  g.fillStyle = white ? '#2a2420' : '#efe6cf';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = white ? '#f4eedf' : '#2a2438';
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  g.fill();
}

/** The board after a step (for drawing the steps chosen so far). */
function stepped(s: BgState, st: BgStep): Pick<BgState, 'pts' | 'bar' | 'off'> {
  const pts = [...s.pts];
  const bar: [number, number] = [...s.bar];
  const off: [number, number] = [...s.off];
  const one = s.side === 0 ? 1 : -1;
  if (st.from === -1) bar[s.side]--;
  else pts[st.from] -= one;
  if (st.to === 24) off[s.side]++;
  else {
    if (pts[st.to] * one < 0 && Math.abs(pts[st.to]) === 1) {
      pts[st.to] = 0;
      bar[s.side === 0 ? 1 : 0]++;
    }
    pts[st.to] += one;
  }
  return { pts, bar, off };
}
