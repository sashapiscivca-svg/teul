// Where a frame's time goes, section by section (test builds only: `?perf`): totals and the worst frame, read by
// the e2e probe through window.__teul.game.perf.
export class FramePerf {
  private t0 = 0;
  private last = 0;
  readonly total = new Map<string, number>();
  readonly worst = new Map<string, number>();
  frames = 0;
  private cur = new Map<string, number>();

  start(): void {
    this.t0 = this.last = performance.now();
    this.cur.clear();
  }

  mark(name: string): void {
    const now = performance.now();
    this.cur.set(name, (this.cur.get(name) ?? 0) + now - this.last);
    this.last = now;
  }

  end(): void {
    this.mark('rest');
    this.cur.set('frame', performance.now() - this.t0);
    for (const [k, v] of this.cur) {
      this.total.set(k, (this.total.get(k) ?? 0) + v);
      this.worst.set(k, Math.max(this.worst.get(k) ?? 0, v));
    }
    this.frames++;
  }

  report(): Record<string, { avg: number; worst: number }> {
    const out: Record<string, { avg: number; worst: number }> = {};
    for (const [k, v] of this.total) out[k] = { avg: +(v / Math.max(1, this.frames)).toFixed(2), worst: +(this.worst.get(k) ?? 0).toFixed(1) };
    return out;
  }

  reset(): void {
    this.total.clear();
    this.worst.clear();
    this.frames = 0;
  }
}
