// The town's feelings on the screen: keeps the latest `feelings_view`, and for each resident drawn says what face
// they make, what bubble shows over them, whether they skip or drag their feet, whom they walk with, who waves
// at the player or comes over to say something. No DOM here: the game asks, this answers.

import type { Look } from './character';
import { approach, comesOver, emoteOf, expressionOf, hopOf, paceOf, warmer, type Emote, type FeelingsView, type ResidentFeel, type WarmthView } from './feel';
import type { NpcPose } from './village';

interface Point {
  x: number;
  y: number;
}

/** Someone on their way over to the player, or standing by them to talk. */
interface Comer {
  from: Point;
  to: Point;
  t0: number;
  walk: number;
  until: number;
  /** They have said what they came to say. */
  said: boolean;
}

export class TownFeel {
  private view: FeelingsView | null = null;
  private readonly moods = new Map<string, ResidentFeel>();
  private readonly warm = new Map<string, WarmthView>();
  private readonly crossWith = new Map<string, Set<string>>();
  /** Who waved at the player, and when (seconds of play). */
  private readonly waved = new Map<string, number>();
  private readonly comers = new Map<string, Comer>();
  /** Who came over lately (they do not keep coming). */
  private readonly came = new Map<string, number>();
  private readonly surprised = new Map<string, number>();
  private checked = -1e9;

  /** Takes a fresh view now and then (the feelings change with the hour, not the frame). */
  update(time: number, get: () => FeelingsView): void {
    if (this.view && time - this.checked < 5) return;
    this.checked = time;
    this.set(get());
  }

  set(view: FeelingsView): void {
    this.view = view;
    this.moods.clear();
    this.warm.clear();
    this.crossWith.clear();
    for (const r of view.residents) {
      this.moods.set(r.id, r);
      if (r.cross?.length) this.crossWith.set(r.id, new Set(r.cross));
    }
    for (const w of view.warmth) this.warm.set(w.id, w);
  }

  get current(): FeelingsView | null {
    return this.view;
  }

  mood(id: string): ResidentFeel | undefined {
    return this.moods.get(id);
  }

  warmth(id: string): WarmthView | undefined {
    return this.warm.get(id);
  }

  /** Whom someone keeps company with now (a date, a hug after making up). */
  withOf(id: string): string | undefined {
    return this.moods.get(id)?.with;
  }

  /** Two people who are not speaking today. */
  quarrel(a: string, b: string): boolean {
    return this.crossWith.get(a)?.has(b) ?? false;
  }

  surprise(id: string, time: number): void {
    this.surprised.set(id, time + 1.4);
  }

  /** The face someone makes now. */
  face(id: string, look: Look, time: number, nearCross: boolean): Look {
    const m = this.moods.get(id);
    const moment = (this.surprised.get(id) ?? 0) > time ? 'surprised' : nearCross ? 'cross' : null;
    const expr = expressionOf(m?.mood, moment);
    return expr ? { ...look, expr } : look;
  }

  /** The bubble over someone's head now, if any. */
  bubble(id: string, time: number, pose: Point, others: Map<string, Point>): Emote | null {
    const m = this.moods.get(id);
    const near = (other: string | undefined) => {
      const p = other ? others.get(other) : undefined;
      return !!p && Math.hypot(p.x - pose.x, p.y - pose.y) < 4;
    };
    const quarrel = [...(this.crossWith.get(id) ?? [])].some((o) => near(o));
    const together = near(m?.with) || (!!m?.love && near(m.love));
    return emoteOf(id, m?.mood, time, {
      surprised: (this.surprised.get(id) ?? 0) > time,
      wave: (this.waved.get(id) ?? -1e9) + 2.4 > time,
      quarrel,
      together,
    });
  }

  /** Whether someone stands near a person they are not speaking to (they glare). */
  nearCross(id: string, pose: Point, others: Map<string, Point>): boolean {
    for (const o of this.crossWith.get(id) ?? []) {
      const p = others.get(o);
      if (p && Math.hypot(p.x - pose.x, p.y - pose.y) < 4) return true;
    }
    return false;
  }

  hop(id: string, walking: boolean, time: number): number {
    return hopOf(this.moods.get(id)?.mood, walking, time, id);
  }

  pace(id: string): number {
    return paceOf(this.moods.get(id)?.mood);
  }

  /**
   * People who like the player react to them: a wave from a little way off, and now and then one who is fond
   * of them walks over. Returns who waved now (for a greeting) and who arrived beside the player.
   */
  react(time: number, me: Point, poses: Map<string, NpcPose>, free: (x: number, y: number) => boolean, busy: (id: string) => boolean): { waved: string[]; arrived: string[] } {
    const waved: string[] = [];
    const arrived: string[] = [];
    for (const [id, pose] of poses) {
      const w = this.warm.get(id);
      if (!w || !pose.visible || busy(id)) continue;
      const d = Math.hypot(pose.x - me.x, pose.y - me.y);
      if (warmer(w.level, 'warm') && d > 2.6 && d < 7 && time - (this.waved.get(id) ?? -1e9) > 75) {
        this.waved.set(id, time);
        waved.push(id);
      }
      const mood = this.moods.get(id)?.mood;
      if (!pose.walking && !this.comers.has(id) && time - (this.came.get(id) ?? -1e9) > 240 && mood !== 'cross' && mood !== 'sleepy' && comesOver(id, w.level, d, time)) {
        // a free spot beside the player, on their side
        const spots: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => ({ x: Math.floor(me.x) + dx + 0.5, y: Math.floor(me.y) + dy + 0.5 }));
        const to = spots.filter((p) => free(Math.floor(p.x), Math.floor(p.y))).sort((a, b) => Math.hypot(a.x - pose.x, a.y - pose.y) - Math.hypot(b.x - pose.x, b.y - pose.y))[0];
        if (!to) continue;
        const walk = Math.hypot(to.x - pose.x, to.y - pose.y) / 1.3;
        this.comers.set(id, { from: { x: pose.x, y: pose.y }, to, t0: time, walk, until: time + walk + 9, said: false });
        this.came.set(id, time);
      }
    }
    for (const [id, c] of this.comers) {
      if (time > c.until) this.comers.delete(id);
      else if (!c.said && time >= c.t0 + c.walk) {
        c.said = true;
        arrived.push(id);
      }
    }
    return { waved, arrived };
  }

  /** Where someone who is coming over is (their usual pose otherwise). */
  pose(id: string, pose: NpcPose, time: number, me: Point): NpcPose {
    const c = this.comers.get(id);
    if (!c) return pose;
    const at = approach(c.from, c.to, time - c.t0, c.walk);
    // standing beside the player: turned to them
    const dx = at.walking ? at.dx : Math.sign(me.x - at.x);
    const dy = at.walking ? at.dy : Math.sign(me.y - at.y);
    return { ...pose, x: at.x, y: at.y, walking: at.walking, dx, dy, visible: true };
  }

  /** Someone came over and is still by the player. */
  beside(id: string, time: number): boolean {
    const c = this.comers.get(id);
    return !!c && time >= c.t0 + c.walk && time <= c.until;
  }

  /** Waving at the player just now (turned to them). */
  waving(id: string, time: number): boolean {
    return (this.waved.get(id) ?? -1e9) + 2.4 > time || this.beside(id, time);
  }

  /** The player went somewhere else: nobody is coming over any more. */
  reset(): void {
    this.comers.clear();
    this.waved.clear();
  }
}
