// Drawn pictures kept for reuse, within a budget of pixels: the ones unused the longest go first, a few at a time,
// so a big place with many kinds of things (the village) never loses all its pictures at once.

export class SpriteCache<T extends { w: number; h: number }> {
  private readonly map = new Map<string, T>();
  /** Pixels held now. */
  area = 0;

  constructor(private readonly budget: number) {}

  get size(): number {
    return this.map.size;
  }

  get(key: string): T | undefined {
    const s = this.map.get(key);
    if (s) {
      // the freshest at the end of the map's order
      this.map.delete(key);
      this.map.set(key, s);
    }
    return s;
  }

  set(key: string, s: T): void {
    const old = this.map.get(key);
    if (old) {
      this.map.delete(key);
      this.area -= old.w * old.h;
    }
    const add = s.w * s.h;
    for (const [k, v] of this.map) {
      if (this.area + add <= this.budget) break;
      this.map.delete(k);
      this.area -= v.w * v.h;
    }
    this.map.set(key, s);
    this.area += add;
  }
}
