// A whole eerie night out of doors (horror.ts picks which): the mob with torches and pitchforks that fills the street
// and closes in, silent, heads turning after you; the masked, robed figures in the wheat that come a step closer each
// time you turn your back, until one is right behind you; the one that hunts you through the streets — outrun it to
// a door. Caught, the screen goes black and you wake at home. Every night ends on its own. The figures walk the
// location's routes (never through houses or fences); nothing here touches the world's state.

import { joinLayers } from '../layers';
import { figureLayers, type Dir, type Look } from '../character';
import type { NpcFigure } from '../render';
import type { Routes } from '../village';
import { carried, creatureLayers } from './creatures';
import type { Scenario } from '../horror';

export interface NightHost {
  walker: { x: number; y: number };
  routes: Routes | null;
  /** Looks of the town's people (the mob wears their faces). */
  looks: Look[];
  sound(kind: string, volume: number, pan: number): void;
  vibrate(pattern: number[]): void;
}

export interface NightFrame {
  figures: NpcFigure[];
  /** How hard the heart beats (0..1) and how dark it has gone (0..1, the lights going out). */
  pulse: number;
  dark: number;
  /** The screen goes black (0..1). */
  blackout: number;
  /** The night is over: ended on its own, or it caught you. */
  done: 'end' | 'caught' | null;
}

interface Mover {
  x: number;
  y: number;
  path: [number, number][];
  at: number;
  repath: number;
  dir: Dir;
  walking: boolean;
  /** For the field: when it last stepped closer. */
  stepped: number;
}

function rnd(seed: number, k: number): number {
  let x = Math.imul(seed ^ (k * 0x9e3779b1), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** The screen direction of a floor vector (the default view: x goes right-down, y left-down). */
function dirOf(dx: number, dy: number): Dir {
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  if (Math.abs(sy) > Math.abs(sx) * 0.9) return sy > 0 ? 'down' : 'up';
  return sx > 0 ? 'right' : 'left';
}

export class Nightmare {
  kind: Scenario | null = null;
  private t = 0;
  private seed = 1;
  private movers: Mover[] = [];
  private facing: [number, number] = [0, 1];
  private last = { x: 0, y: 0 };
  private approaches = 0;
  private behind: Mover | null = null;
  private behindAt = -1;
  private caughtAt = -1;
  private far = 0;
  private beat = 0;
  private stepT = 0;
  private chantT = 0;

  get active(): boolean {
    return this.kind !== null;
  }

  start(kind: Scenario, host: NightHost, seed: number): boolean {
    const r = host.routes;
    if (!r) return false;
    this.kind = kind;
    this.t = 0;
    this.seed = seed | 0 || 1;
    this.movers = [];
    this.approaches = 0;
    this.behind = null;
    this.behindAt = -1;
    this.caughtAt = -1;
    this.far = 0;
    this.last = { x: host.walker.x, y: host.walker.y };
    const me = host.walker;
    if (kind === 'mob') {
      // they come up the street from far off, in a loose crowd
      const a = rnd(this.seed, 1) * Math.PI * 2;
      const at = this.freeNear(r, me.x + Math.cos(a) * 10, me.y + Math.sin(a) * 10, 6) ?? this.freeNear(r, me.x, me.y + 10, 8);
      if (!at) return this.fail();
      for (let i = 0; i < 11; i++) {
        const p = this.freeNear(r, at[0] + (rnd(this.seed, 10 + i) - 0.5) * 4, at[1] + (rnd(this.seed, 30 + i) - 0.5) * 4, 3) ?? at;
        this.movers.push(this.mover(p));
      }
    } else if (kind === 'field') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 1.2 - 0.6 + rnd(this.seed, i) * 0.3;
        const p = this.freeNear(r, me.x + Math.cos(a) * 8, me.y + Math.sin(a) * 8, 3);
        if (p) this.movers.push(this.mover(p));
      }
      if (this.movers.length < 3) return this.fail();
    } else {
      const p = this.freeNear(r, me.x - 11, me.y - 6, 6) ?? this.freeNear(r, me.x + 11, me.y + 6, 6);
      if (!p) return this.fail();
      this.movers.push(this.mover(p));
    }
    return true;
  }

  stop(): void {
    this.kind = null;
    this.movers = [];
    this.behind = null;
  }

  private fail(): false {
    this.stop();
    return false;
  }

  private mover(p: [number, number]): Mover {
    return { x: p[0], y: p[1], path: [], at: 0, repath: 0, dir: 'down', walking: false, stepped: -9 };
  }

  private freeNear(r: Routes, x: number, y: number, radius: number): [number, number] | null {
    for (let d = 0; d <= radius; d++) {
      for (let k = 0; k < 8 + d * 8; k++) {
        const a = (k / (8 + d * 8)) * Math.PI * 2;
        const cx = Math.floor(x + Math.cos(a) * d);
        const cy = Math.floor(y + Math.sin(a) * d);
        if (r.free(cx + 0.5, cy + 0.5)) return [cx + 0.5, cy + 0.5];
      }
    }
    return null;
  }

  /** Walks a figure along the routes towards a point; true when there. */
  private walk(m: Mover, r: Routes, tx: number, ty: number, speed: number, dt: number): boolean {
    m.repath -= dt;
    if (m.repath <= 0 || m.path.length === 0) {
      m.repath = 0.8;
      const from: [number, number] = [m.x, m.y];
      m.path = r.route(`nm|${Math.floor(m.x)},${Math.floor(m.y)}|${Math.floor(tx)},${Math.floor(ty)}`, from, [tx, ty]);
      m.at = 1;
    }
    let left = speed * dt;
    while (left > 0 && m.at < m.path.length) {
      const [px, py] = m.path[m.at];
      const dx = px - m.x;
      const dy = py - m.y;
      const d = Math.hypot(dx, dy);
      if (d <= left) {
        m.x = px;
        m.y = py;
        left -= d;
        m.at++;
      } else {
        m.x += (dx / d) * left;
        m.y += (dy / d) * left;
        m.dir = dirOf(dx, dy);
        left = 0;
      }
    }
    m.walking = m.at < m.path.length;
    return !m.walking;
  }

  update(dt: number, host: NightHost, time: number, stillMotion: boolean): NightFrame {
    const out: NightFrame = { figures: [], pulse: 0, dark: 0, blackout: 0, done: null };
    const kind = this.kind;
    const r = host.routes;
    if (!kind || !r) return out;
    this.t += dt;
    const me = host.walker;
    const mx = me.x - this.last.x;
    const my = me.y - this.last.y;
    if (Math.hypot(mx, my) > 0.02) this.facing = [mx / Math.hypot(mx, my), my / Math.hypot(mx, my)];
    this.last = { x: me.x, y: me.y };
    const frame = Math.floor(time * 7) % 4;
    const pan = (x: number) => Math.max(-1, Math.min(1, (x - me.x) / 8));

    if (kind === 'mob') {
      out.dark = Math.min(0.55, this.t / 30);
      const ending = this.t > 48;
      this.chantT -= dt;
      if (this.chantT <= 0 && !ending) {
        this.chantT = 3.2;
        host.sound('chant', 0.55, 0);
        host.sound('torch', 0.35, 0);
      }
      this.movers.forEach((m, i) => {
        // a ring round you, never closer than arm's length and a bit
        const a = (i / this.movers.length) * Math.PI * 2 + 0.4;
        const rad = 3.2 + (i % 3) * 0.8;
        if (!ending) this.walk(m, r, me.x + Math.cos(a) * rad, me.y + Math.sin(a) * rad, 1.35, dt);
        else m.walking = false;
        // heads turn after you
        const toMe = dirOf(me.x - m.x, me.y - m.y);
        const look = host.looks[i % Math.max(1, host.looks.length)];
        if (ending && this.t > 48 + i * 0.35) return;
        const d = m.walking ? m.dir : toMe;
        const body = look ? figureLayers(look, d, m.walking ? 'walk' : 'idle', frame) : creatureLayers('shade', d, m.walking, frame);
        out.figures.push({ id: `nm:mob:${i}`, x: m.x, y: m.y, layers: joinLayers(body, carried(i % 2 ? 'pitchfork' : 'torch', d, time + i)) });
      });
      out.pulse = Math.max(0, 1 - Math.min(...this.movers.map((m) => Math.hypot(m.x - me.x, m.y - me.y))) / 9);
      if (this.t > 48 + this.movers.length * 0.35 + 0.5) out.done = 'end';
    } else if (kind === 'field') {
      const [fx, fy] = this.facing;
      for (const m of this.movers) {
        const dx = m.x - me.x;
        const dy = m.y - me.y;
        const d = Math.hypot(dx, dy);
        // behind your back (out of sight), now and then, it steps closer
        if (this.behindAt < 0 && (dx * fx + dy * fy) / Math.max(0.01, d) < -0.1 && d > 2.2 && this.t - m.stepped > 2.2) {
          const p = this.freeNear(r, m.x - (dx / d) * 1.4, m.y - (dy / d) * 1.4, 1);
          if (p) {
            m.x = p[0];
            m.y = p[1];
            m.stepped = this.t;
            this.approaches++;
            host.sound('rustle', 0.4, pan(m.x));
          }
        }
        out.figures.push({ id: `nm:robed:${this.movers.indexOf(m)}`, x: m.x, y: m.y, layers: creatureLayers('robed', dirOf(-dx, -dy), false, 0), scale: 1.1 });
      }
      out.pulse = Math.max(0, 1 - Math.min(...this.movers.map((m) => Math.hypot(m.x - me.x, m.y - me.y))) / 8);
      out.dark = 0.25;
      // and then one is right behind you
      if (this.behindAt < 0 && (this.approaches >= 7 || this.t > 38)) {
        const p = this.freeNear(r, me.x - fx * 1.1, me.y - fy * 1.1, 1);
        if (p) {
          this.behind = this.mover(p);
          this.behindAt = this.t;
          host.sound('sting', 1, 0);
          host.vibrate([60, 40, 120]);
        }
      }
      if (this.behind) {
        out.figures.push({ id: 'nm:robed:behind', x: this.behind.x, y: this.behind.y, layers: creatureLayers('robed', dirOf(me.x - this.behind.x, me.y - this.behind.y), false, 0) });
        out.pulse = 1;
      }
      if (this.behindAt >= 0 && this.t - this.behindAt > 1.8) {
        out.figures = [];
        out.done = 'end';
      }
      if (this.t > 60) out.done = 'end';
    } else {
      const m = this.movers[0];
      const d = Math.hypot(m.x - me.x, m.y - me.y);
      if (this.caughtAt < 0) {
        this.walk(m, r, me.x, me.y, 2.15, dt);
        if (d < 0.75) {
          this.caughtAt = this.t;
          host.sound('sting', 1, 0);
          host.sound('muffled', 0.9, 0);
          host.vibrate([200, 80, 300]);
        }
      }
      this.stepT -= dt;
      if (this.stepT <= 0 && this.caughtAt < 0) {
        this.stepT = 0.45;
        host.sound('steps', Math.max(0.15, 1 - d / 16), pan(m.x));
        if (d < 5) host.sound('breath', 0.5, pan(m.x));
      }
      out.pulse = Math.max(0.2, 1 - d / 14);
      out.dark = 0.3;
      out.figures.push({ id: 'nm:hunter', x: m.x, y: m.y, layers: creatureLayers('hunter', m.walking ? m.dir : dirOf(me.x - m.x, me.y - m.y), m.walking, frame), scale: 1.12 });
      this.far = d > 14 ? this.far + dt : 0;
      if (this.caughtAt >= 0) {
        out.blackout = Math.min(1, (this.t - this.caughtAt) / 0.5);
        if (this.t - this.caughtAt > 3) out.done = 'caught';
      } else if (this.far > 8 || this.t > 75) out.done = 'end';
    }
    // the heart: faster and louder the closer they are
    this.beat -= dt;
    if (out.pulse > 0.15 && this.beat <= 0) {
      this.beat = 1.15 - out.pulse * 0.7;
      host.sound('heartbeat', 0.25 + out.pulse * 0.6, 0);
    }
    if (stillMotion) out.pulse = Math.min(out.pulse, 0.5);
    if (out.done) this.stop();
    return out;
  }
}
