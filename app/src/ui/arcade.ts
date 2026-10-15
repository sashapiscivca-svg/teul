// The computer's screen: a little menu of games and the games themselves, drawn on a canvas in pixels.
// Arrows or the buttons on screen move; Space or the round button turns or drops; Escape closes.

import { t } from '../i18n';
import * as B from '../arcade/blocks';
import * as M from '../arcade/maze';
import * as R from '../arcade/rift';
import { h } from './dom';

type Game = { kind: 'blocks'; state: B.Blocks } | { kind: 'maze'; state: M.Maze } | { kind: 'rift'; state: R.Rift };
type Kind = Game['kind'];

const TITLES = { blocks: 'arcade.blocks', maze: 'arcade.maze', rift: 'arcade.rift' } as const;
const HINTS = { blocks: 'arcade.blocksHint', maze: 'arcade.mazeHint', rift: 'arcade.riftHint' } as const;

function best(kind: string): number {
  try {
    return Number(localStorage.getItem(`teul.arcade.${kind}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function keep(kind: string, score: number): void {
  try {
    if (score > best(kind)) localStorage.setItem(`teul.arcade.${kind}`, String(score));
  } catch {
    // a private window: the record just is not kept
  }
}

export class Arcade {
  readonly root: HTMLElement;
  private readonly screen: HTMLCanvasElement;
  private readonly menu: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;
  private game: Game | null = null;
  private frame = 0;
  private last = 0;
  private acc = 0;
  private repeat: number | null = null;
  /** The games this computer has: the hidden one in the cellar has only its own. */
  private kinds: Kind[] = ['blocks', 'maze'];

  constructor(parent: HTMLElement, private readonly onSound: (kind: 'blip' | 'line' | 'over') => void = () => {}) {
    this.screen = h('canvas', { class: 'arcade-screen', width: 240, height: 288 });
    this.title = h('b', { class: 'arcade-title' });
    this.hint = h('p', { class: 'arcade-hint' });
    this.menu = h('div', { class: 'arcade-menu' });
    const pad = (label: string, run: () => void, cls = '') => {
      const btn = h('button', { class: `round arcade-btn ${cls}`, type: 'button', 'aria-label': label }, label);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        run();
        this.stopRepeat();
        if (cls.includes('rep')) this.repeat = window.setInterval(run, 110);
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => this.stopRepeat());
      return btn;
    };
    const left = h('div', { class: 'arcade-pad' },
      pad('▲', () => this.press('up')),
      h('div', { class: 'arcade-row' }, pad('◀', () => this.press('left'), 'rep'), pad('▶', () => this.press('right'), 'rep')),
      pad('▼', () => this.press('down'), 'rep'));
    const right = h('div', { class: 'arcade-pad' },
      pad('●', () => this.press('act'), 'big'),
      h('button', { class: 'cta muted', type: 'button', onclick: () => this.toMenu() }, t('arcade.menu')),
      h('button', { class: 'cta muted', type: 'button', onclick: () => this.close() }, t('arcade.off')));
    this.root = h('div', { class: 'arcade', role: 'dialog', 'aria-label': t('arcade.computer') },
      h('div', { class: 'arcade-card' }, left, h('div', { class: 'arcade-mid' }, this.title, this.screen, this.menu, this.hint), right));
    this.root.style.display = 'none';
    parent.append(this.root);
  }

  isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  /** Switches the computer on; the hidden one under the bar starts straight into its game. */
  open(secret = false): void {
    this.root.style.display = '';
    this.kinds = secret ? ['rift'] : ['blocks', 'maze'];
    if (secret) this.start('rift');
    else this.toMenu();
  }

  close(): void {
    this.stopRepeat();
    cancelAnimationFrame(this.frame);
    this.game = null;
    this.root.style.display = 'none';
  }

  private stopRepeat(): void {
    if (this.repeat !== null) window.clearInterval(this.repeat);
    this.repeat = null;
  }

  private toMenu(): void {
    cancelAnimationFrame(this.frame);
    this.game = null;
    const secret = this.kinds.includes('rift');
    this.title.textContent = secret ? t('arcade.secretTitle') : t('arcade.title');
    this.hint.textContent = secret ? t('arcade.secretHint') : t('arcade.pick');
    this.screen.style.display = 'none';
    this.menu.style.display = '';
    this.menu.replaceChildren(
      ...this.kinds.map((kind) =>
        h('button', { class: 'cta', type: 'button', onclick: () => this.start(kind) }, `${t(TITLES[kind])}  ·  ${t('arcade.best', { n: best(kind) })}`)),
    );
  }

  start(kind: Kind): void {
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    this.game = kind === 'blocks' ? { kind, state: B.newBlocks(seed) } : kind === 'maze' ? { kind, state: M.newMaze(seed) } : { kind, state: R.newRift(seed) };
    this.title.textContent = t(TITLES[kind]);
    this.hint.textContent = t(HINTS[kind]);
    this.menu.style.display = 'none';
    this.screen.style.display = '';
    if (kind === 'blocks') {
      this.screen.width = 220;
      this.screen.height = 284;
    } else if (kind === 'rift') {
      this.screen.width = R.SHAFT_W * RS;
      this.screen.height = R.VIEW_H * RS + 18;
    } else {
      this.screen.width = M.MAZE[0].length * 12;
      this.screen.height = M.MAZE.length * 12 + 16;
    }
    this.last = performance.now();
    this.acc = 0;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  /** A key or a button: what it does depends on the game. */
  press(what: 'left' | 'right' | 'up' | 'down' | 'act'): void {
    const g = this.game;
    if (!g) return;
    if (g.kind === 'blocks') {
      const s = g.state;
      if (s.over) {
        if (what === 'act') this.start('blocks');
        return;
      }
      if (what === 'left') B.move(s, -1, 0);
      else if (what === 'right') B.move(s, 1, 0);
      else if (what === 'up') B.turn(s);
      else if (what === 'down') {
        if (B.tick(s) > 0) this.onSound('line');
        s.score += 1;
      } else if (B.drop(s) > 0) this.onSound('line');
      else this.onSound('blip');
    } else if (g.kind === 'rift') {
      const s = g.state;
      if (s.over) {
        if (what === 'act') this.start('rift');
        return;
      }
      if (what === 'left') R.steer(s, -1);
      else if (what === 'right') R.steer(s, 1);
      else if (what === 'act' && R.flare(s)) this.onSound('line');
    } else {
      const s = g.state;
      if (s.over) {
        if (what === 'act') this.start('maze');
        return;
      }
      M.steer(s, ({ up: 0, right: 1, down: 2, left: 3, act: s.cat.want } as const)[what] as M.Dir);
    }
    this.draw(1);
  }

  /** Keys while the screen is open; true when the key was used. */
  key(e: KeyboardEvent): boolean {
    const map: Record<string, 'left' | 'right' | 'up' | 'down' | 'act'> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'act', Enter: 'act',
    };
    if (e.code === 'Escape') {
      if (this.game) this.toMenu();
      else this.close();
      return true;
    }
    const what = map[e.code];
    if (!what) return false;
    e.preventDefault();
    this.press(what);
    return true;
  }

  private loop(now: number): void {
    const g = this.game;
    if (!g || !this.isOpen()) return;
    this.acc += Math.min(250, now - this.last);
    this.last = now;
    const ms = g.kind === 'blocks' ? B.tickMs(g.state) : g.kind === 'rift' ? R.tickMs(g.state) : M.tickMs(g.state);
    const wasOver = g.state.over;
    while (this.acc >= ms) {
      this.acc -= ms;
      if (g.kind === 'blocks') {
        if (B.tick(g.state) > 0) this.onSound('line');
      } else if (g.kind === 'rift') {
        const met = R.tick(g.state);
        if (met === 'gem') this.onSound('line');
        else if (met === 'hit') this.onSound('blip');
      } else {
        const crumbs = g.state.crumbs.size;
        M.tick(g.state);
        if (g.state.crumbs.size < crumbs && g.state.ticks % 4 === 0) this.onSound('blip');
      }
    }
    if (g.state.over && !wasOver) {
      keep(g.kind, g.state.score);
      this.onSound('over');
    }
    this.draw(this.acc / ms);
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  private draw(phase: number): void {
    const g = this.game;
    const ctx = this.screen.getContext('2d');
    if (!g || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10122a';
    ctx.fillRect(0, 0, this.screen.width, this.screen.height);
    if (g.kind === 'blocks') drawBlocks(ctx, g.state);
    else if (g.kind === 'rift') drawRift(ctx, g.state);
    else drawMaze(ctx, g.state, Math.min(1, phase));
    if (g.state.over) {
      ctx.fillStyle = 'rgba(8, 9, 20, 0.78)';
      ctx.fillRect(0, this.screen.height / 2 - 30, this.screen.width, 60);
      ctx.fillStyle = '#f6b347';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('arcade.gameOver', { n: g.state.score }), this.screen.width / 2, this.screen.height / 2 - 6);
      ctx.fillStyle = '#e8f4f8';
      ctx.font = '12px monospace';
      ctx.fillText(t('arcade.again'), this.screen.width / 2, this.screen.height / 2 + 16);
    }
  }
}

function cell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  // a light top-left edge and a dark bottom-right one, like a little brick
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, size, 2);
  ctx.fillRect(x, y, 2, size);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x, y + size - 2, size, 2);
  ctx.fillRect(x + size - 2, y, 2, size);
  ctx.globalAlpha = 1;
}

function drawBlocks(ctx: CanvasRenderingContext2D, s: B.Blocks): void {
  const S = 14;
  ctx.fillStyle = '#1b1e3e';
  ctx.fillRect(2, 2, B.WELL_W * S, B.WELL_H * S);
  ctx.fillStyle = '#22264a';
  for (let x = 1; x < B.WELL_W; x++) ctx.fillRect(2 + x * S, 2, 1, B.WELL_H * S);
  s.well.forEach((row, y) => row.forEach((c, x) => c && cell(ctx, 2 + x * S, 2 + y * S, S, B.SHAPES[c - 1].color)));
  if (!s.over) {
    const gy = B.ghostY(s);
    for (const [cx, cy] of s.piece.cells) if (gy + cy >= 0) cell(ctx, 2 + (s.piece.x + cx) * S, 2 + (gy + cy) * S, S, B.SHAPES[s.piece.shape].color, 0.22);
    for (const [cx, cy] of s.piece.cells) if (s.piece.y + cy >= 0) cell(ctx, 2 + (s.piece.x + cx) * S, 2 + (s.piece.y + cy) * S, S, B.SHAPES[s.piece.shape].color);
  }
  const px = B.WELL_W * S + 10;
  ctx.fillStyle = '#e8f4f8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(t('arcade.next'), px, 16);
  for (const [cx, cy] of B.SHAPES[s.next].cells) cell(ctx, px + cx * 11, 24 + cy * 11, 11, B.SHAPES[s.next].color);
  ctx.fillStyle = '#e8f4f8';
  ctx.fillText(t('arcade.score'), px, 92);
  ctx.fillStyle = '#f6b347';
  ctx.fillText(String(s.score), px, 106);
  ctx.fillStyle = '#e8f4f8';
  ctx.fillText(t('arcade.lines'), px, 130);
  ctx.fillStyle = '#f6b347';
  ctx.fillText(String(s.lines), px, 144);
  ctx.fillStyle = '#e8f4f8';
  ctx.fillText(t('arcade.level'), px, 168);
  ctx.fillStyle = '#f6b347';
  ctx.fillText(String(s.level), px, 182);
}

const DOG_COLORS = ['#c9874a', '#e8e0c8', '#6a4528', '#9aa0b0'];

function drawMaze(ctx: CanvasRenderingContext2D, m: M.Maze, phase: number): void {
  const S = 12;
  const top = 16;
  ctx.fillStyle = '#e8f4f8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${t('arcade.score')} ${m.score}`, 4, 12);
  ctx.textAlign = 'right';
  ctx.fillText(`${'♥'.repeat(Math.max(0, m.lives))}  ${t('arcade.lvl', { n: m.level })}`, m.w * S - 4, 12);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.walls[y][x]) continue;
      const door = x === m.door[0] && y === m.door[1];
      ctx.fillStyle = door ? '#d86aa0' : '#3a5a8a';
      if (door) ctx.fillRect(x * S, top + y * S + 5, S, 2);
      else {
        ctx.fillRect(x * S + 1, top + y * S + 1, S - 2, S - 2);
        ctx.fillStyle = '#4a8fd0';
        ctx.fillRect(x * S + 1, top + y * S + 1, S - 2, 2);
      }
    }
  }
  ctx.fillStyle = '#f4eedf';
  for (const k of m.crumbs) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x * S + 5, top + y * S + 5, 2, 2);
  }
  const blink = Math.floor(performance.now() / 250) % 2 === 0;
  for (const k of m.fish) {
    const [x, y] = k.split(',').map(Number);
    if (!blink) continue;
    ctx.fillStyle = '#7ac8f0';
    ctx.fillRect(x * S + 2, top + y * S + 4, 6, 4);
    ctx.fillRect(x * S + 8, top + y * S + 3, 2, 6);
    ctx.fillStyle = '#10122a';
    ctx.fillRect(x * S + 3, top + y * S + 5, 1, 1);
  }
  const at = (who: M.Mover): [number, number] => {
    const far = Math.abs(who.x - who.px) > 1;
    const k = far ? 1 : phase;
    return [(who.px + (who.x - who.px) * k) * S, top + (who.py + (who.y - who.py) * k) * S];
  };
  // the cat: ginger, round, two ears, looking the way it goes
  const [cx, cy] = at(m.cat);
  ctx.fillStyle = '#e8a23a';
  ctx.fillRect(cx + 2, cy + 3, 8, 7);
  ctx.fillRect(cx + 2, cy + 1, 2, 2);
  ctx.fillRect(cx + 8, cy + 1, 2, 2);
  ctx.fillStyle = '#c47a22';
  ctx.fillRect(cx + 4, cy + 3, 4, 1);
  ctx.fillStyle = '#10122a';
  const look = [[0, -1], [1, 0], [0, 1], [-1, 0]][m.cat.dir];
  ctx.fillRect(cx + 4 + look[0], cy + 5 + look[1], 1, 1);
  ctx.fillRect(cx + 7 + look[0], cy + 5 + look[1], 1, 1);
  m.dogs.forEach((d, i) => {
    const [dx, dy] = at(d);
    if (d.home) {
      ctx.fillStyle = '#e8f4f8';
      ctx.fillRect(dx + 3, dy + 4, 2, 2);
      ctx.fillRect(dx + 7, dy + 4, 2, 2);
      return;
    }
    const scared = d.scared > 0 && (d.scared > 12 || blink);
    ctx.fillStyle = scared ? '#3a6aa0' : DOG_COLORS[i];
    ctx.fillRect(dx + 1, dy + 3, 10, 6);
    ctx.fillRect(dx + 2, dy + 9, 2, 2);
    ctx.fillRect(dx + 8, dy + 9, 2, 2);
    ctx.fillStyle = scared ? '#2a4a80' : '#3e2a1c';
    ctx.fillRect(dx + 1, dy + 1, 2, 4);
    ctx.fillRect(dx + 9, dy + 1, 2, 4);
    ctx.fillStyle = scared ? '#e8f4f8' : '#10122a';
    ctx.fillRect(dx + 4, dy + 5, 1, 1);
    ctx.fillRect(dx + 7, dy + 5, 1, 1);
  });
}

const RS = 16;

/** The shaft in the dark: rock with veins, crystals, spikes, the miner cat and its lamp. */
function drawRift(ctx: CanvasRenderingContext2D, r: R.Rift): void {
  const top = 18;
  ctx.fillStyle = '#05050c';
  ctx.fillRect(0, top, R.SHAFT_W * RS, R.VIEW_H * RS);
  const blink = Math.floor(performance.now() / 200) % 2 === 0;
  for (let y = 0; y < R.VIEW_H; y++) {
    for (let x = 0; x < R.SHAFT_W; x++) {
      if (!R.lit(r, x, y)) continue;
      const c = r.rows[y][x];
      const px = x * RS;
      const py = top + y * RS;
      // the light falls off away from the lamp
      const far = Math.abs(x - r.x) + Math.abs(y - R.PLAYER_ROW);
      ctx.globalAlpha = r.flareTicks > 0 ? 1 : Math.max(0.45, 1 - far * 0.09);
      if (c === '#') {
        ctx.fillStyle = '#5a5070';
        ctx.fillRect(px, py, RS, RS);
        ctx.fillStyle = '#7a6e94';
        ctx.fillRect(px, py, RS, 3);
        ctx.fillStyle = '#3a3448';
        ctx.fillRect(px, py + RS - 3, RS, 3);
        if (((x * 7 + (y + r.depth) * 13) % 11) === 0) {
          ctx.fillStyle = '#c9a050';
          ctx.fillRect(px + 5, py + 6, 3, 2);
        }
      } else {
        ctx.fillStyle = '#241f33';
        ctx.fillRect(px, py, RS, RS);
        if (c === '*') {
          ctx.fillStyle = blink ? '#7af0e0' : '#4fd1b8';
          ctx.fillRect(px + 6, py + 3, 4, 10);
          ctx.fillRect(px + 4, py + 6, 8, 4);
          ctx.fillStyle = '#e8fffb';
          ctx.fillRect(px + 7, py + 4, 1, 3);
        } else if (c === '^') {
          ctx.fillStyle = '#a8a0b8';
          for (let i = 0; i < 3; i++) ctx.fillRect(px + 2 + i * 5, py + 6, 3, 9);
          ctx.fillStyle = '#e8e0f0';
          for (let i = 0; i < 3; i++) ctx.fillRect(px + 3 + i * 5, py + 3, 1, 4);
        }
      }
    }
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#f6b347';
  ctx.beginPath();
  ctx.arc(r.x * RS + RS / 2, top + R.PLAYER_ROW * RS + RS / 2, RS * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // the miner cat: ginger, a helmet with a lamp, blinking while hurt
  if (!(r.hurt > 0 && blink)) {
    const px = r.x * RS;
    const py = top + R.PLAYER_ROW * RS;
    ctx.fillStyle = '#e8a23a';
    ctx.fillRect(px + 3, py + 6, 10, 8);
    ctx.fillRect(px + 3, py + 4, 3, 3);
    ctx.fillRect(px + 10, py + 4, 3, 3);
    ctx.fillStyle = '#f4d35e';
    ctx.fillRect(px + 4, py + 2, 8, 3);
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(px + 7, py + 1, 2, 2);
    ctx.fillStyle = '#10122a';
    ctx.fillRect(px + 6, py + 9, 1, 1);
    ctx.fillRect(px + 9, py + 9, 1, 1);
  }
  // the lamp, the flares, the hearts, the depth
  ctx.fillStyle = '#10122a';
  ctx.fillRect(0, 0, R.SHAFT_W * RS, top);
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(4, 6, 60, 6);
  ctx.fillStyle = r.light > 25 ? '#f6b347' : '#e8546a';
  ctx.fillRect(4, 6, Math.round((60 * r.light) / 100), 6);
  ctx.fillStyle = '#e8f4f8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${'✦'.repeat(r.flares)} ${'♥'.repeat(Math.max(0, r.lives))}`, 70, 13);
  ctx.textAlign = 'right';
  ctx.fillText(`${t('arcade.metres', { n: r.depth })}  ${r.score}`, R.SHAFT_W * RS - 4, 13);
}
