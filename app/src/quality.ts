// The quality ladder of a device left on "auto": full, then fewer details and a lower pixel ratio, then lower still.
// Frames that keep coming late step it down; frames that have long been light step it back up, never above where
// the device started and never to a level that has failed twice. The heavy moments of loading a place (the start,
// a new location drawing its pictures) are not held against the device.

/** Light frames needed before a step up (ms of play). */
const CALM_MS = 15_000;
/** Work per frame (ms) that counts as light, by the level one is on (the level above draws more pixels). */
const LIGHT_MS = [0, 6, 4];

export class QualityLadder {
  level: number;
  private slow = 0;
  private calm = 0;
  private holdUntil = 0;
  private readonly failed = [0, 0, 0];
  /** The level last stepped up to, while it is still on trial. */
  private trial = -1;

  constructor(private readonly start: number) {
    this.level = start;
  }

  /** Not to judge the frames until `now + ms` (a place being loaded). */
  hold(now: number, ms: number): void {
    this.holdUntil = Math.max(this.holdUntil, now + ms);
    this.slow = 0;
    this.calm = 0;
  }

  /** One frame: when it came (ms), the time since the last one and the frame's own pace (s), the work it took
   * (ms). Returns true when the level changed. */
  frame(now: number, elapsed: number, interval: number, work: number): boolean {
    if (now < this.holdUntil) return false;
    const late = elapsed > interval + 0.03;
    this.slow = late ? Math.min(60, this.slow + 1) : Math.max(0, this.slow - 1);
    if (this.slow >= 20 && this.level < 2) {
      if (this.trial === this.level) this.failed[this.level]++;
      this.trial = -1;
      this.slow = 0;
      this.calm = 0;
      this.level++;
      return true;
    }
    this.calm = !late && work < LIGHT_MS[this.level] ? this.calm + elapsed * 1000 : 0;
    const up = this.level - 1;
    if (this.level > this.start && this.calm >= CALM_MS && this.failed[up] < 2) {
      this.calm = 0;
      this.slow = 0;
      this.level = up;
      this.trial = up;
      return true;
    }
    return false;
  }
}
