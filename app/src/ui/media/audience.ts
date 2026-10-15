// Who stops to listen when the hero plays in the street: the nearest passers-by stand where they are, turn to the
// music and, when it ends, clap a little before going on their way.

export interface Pinned {
  x: number;
  y: number;
  /** Clapping (after the piece) rather than listening. */
  clap: boolean;
}

export class Audience {
  private pins = new Map<string, { x: number; y: number; until: number }>();
  private endAt = Infinity;

  /** The music starts at (x, y): up to `n` of the people within reach stop. */
  start(x: number, y: number, people: { id: string; x: number; y: number }[], n: number): string[] {
    this.pins.clear();
    this.endAt = Infinity;
    const near = people
      .map((p) => ({ ...p, d: Math.hypot(p.x - x, p.y - y) }))
      .filter((p) => p.d < 9 && p.d > 0.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(0, n));
    for (const p of near) this.pins.set(p.id, { x: p.x, y: p.y, until: Infinity });
    return near.map((p) => p.id);
  }

  /** The piece ended at `now`: a few seconds of applause, then everyone goes on. */
  end(now: number): void {
    this.endAt = now;
    for (const p of this.pins.values()) p.until = now + 3.5;
  }

  /** Stopped before the end: they just go. */
  cancel(): void {
    this.pins.clear();
    this.endAt = Infinity;
  }

  pin(id: string, now: number): Pinned | null {
    const p = this.pins.get(id);
    if (!p) return null;
    if (now > p.until) {
      this.pins.delete(id);
      return null;
    }
    return { x: p.x, y: p.y, clap: now >= this.endAt };
  }

  size(): number {
    return this.pins.size;
  }
}
