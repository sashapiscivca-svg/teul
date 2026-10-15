// A big map's floor, walls and shadows painted in chunks: what would be painted onto one canvas the size of the
// map (thousands of tiles, several megapixels) is first only written down, stroke by stroke, then each square of
// it is painted when the camera comes near and let go when it is far. The picture is the same to the pixel.

/** One stroke: a picture or a filled box at a place, with the colour and the see-through it was given. */
export interface Op {
  x: number;
  y: number;
  w: number;
  h: number;
  img: CanvasImageSource | null;
  style: string;
  alpha: number;
  /** A picture asked for each time its square is painted (a cell of crops, trodden or not). */
  live?: () => CanvasImageSource | null;
}

/** Takes the place of a 2D context for the painters of the floor: writes down what they paint. */
export class Recorder {
  readonly ops: Op[] = [];
  fillStyle = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  /** The painters of light say how they mix and where they stop; the layer applies that to every chunk. */
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';

  drawImage(img: CanvasImageSource, x: number, y: number): void {
    const s = img as { width: number; height: number };
    this.ops.push({ x, y, w: s.width, h: s.height, img, style: this.fillStyle, alpha: this.globalAlpha });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ops.push({ x, y, w, h, img: null, style: this.fillStyle, alpha: this.globalAlpha });
  }

  /** A picture of `w`×`h` at a place, asked for when its square is painted (and again when it is told to change,
   * `ChunkedLayer.change`); the stroke's number. */
  drawLive(x: number, y: number, w: number, h: number, live: () => CanvasImageSource | null): number {
    this.ops.push({ x, y, w, h, img: null, style: '', alpha: this.globalAlpha, live });
    return this.ops.length - 1;
  }

  clearRect(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  clip(): void {}
}

export interface LayerLook {
  /** A shape every stroke stays inside (the outline of the map, for its light). */
  clip?: [number, number][];
  /** How the strokes mix (light adds up). */
  composite?: GlobalCompositeOperation;
}

/** The strokes of each chunk (by index, in the order painted), chunks row by row. */
export function bucketOps(ops: Op[], w: number, h: number, size: number): { cols: number; rows: number; lists: number[][] } {
  const cols = Math.max(1, Math.ceil(w / size));
  const rows = Math.max(1, Math.ceil(h / size));
  const lists: number[][] = Array.from({ length: cols * rows }, () => []);
  ops.forEach((o, i) => {
    const c0 = Math.max(0, Math.floor(o.x / size));
    const c1 = Math.min(cols - 1, Math.floor((o.x + o.w - 1e-6) / size));
    const r0 = Math.max(0, Math.floor(o.y / size));
    const r1 = Math.min(rows - 1, Math.floor((o.y + o.h - 1e-6) / size));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) lists[r * cols + c].push(i);
  });
  return { cols, rows, lists };
}

/** The chunks a screen of `sw`×`sh` shows of a layer drawn at (`ox`, `oy`), and `ring` chunks round them. */
export function tilesOver(cols: number, rows: number, size: number, ox: number, oy: number, sw: number, sh: number, ring: number): number[] {
  const c0 = Math.max(0, Math.floor(-ox / size) - ring);
  const c1 = Math.min(cols - 1, Math.floor((sw - 1 - ox) / size) + ring);
  const r0 = Math.max(0, Math.floor(-oy / size) - ring);
  const r1 = Math.min(rows - 1, Math.floor((sh - 1 - oy) / size) + ring);
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(r * cols + c);
  return out;
}

/** Chunks painted at most at once (the ones far behind go first). */
const KEEP = 64;

export class ChunkedLayer {
  private readonly cols: number;
  private readonly rows: number;
  private readonly lists: number[][];
  private readonly painted = new Map<number, HTMLCanvasElement>();
  /** Squares painted whose picture has changed since (painted again a few a frame; the old one shown till then). */
  private readonly stale = new Set<number>();

  constructor(private readonly ops: Op[], readonly width: number, readonly height: number, private readonly look: LayerLook = {}, private readonly size = 256) {
    const b = bucketOps(ops, width, height, size);
    this.cols = b.cols;
    this.rows = b.rows;
    this.lists = b.lists;
  }

  private chunk(i: number): HTMLCanvasElement {
    let c = this.painted.get(i);
    if (c) {
      this.painted.delete(i);
      this.painted.set(i, c);
      return c;
    }
    c = this.paint(i, null);
    this.painted.set(i, c);
    for (const k of this.painted.keys()) {
      if (this.painted.size <= KEEP) break;
      this.painted.delete(k);
      this.stale.delete(k);
    }
    return c;
  }

  /** Paints a square (into the canvas it had, when painted again). */
  private paint(i: number, into: HTMLCanvasElement | null): HTMLCanvasElement {
    const tx = (i % this.cols) * this.size;
    const ty = Math.floor(i / this.cols) * this.size;
    const c = into ?? document.createElement('canvas');
    if (!into) {
      c.width = Math.min(this.size, this.width - tx);
      c.height = Math.min(this.size, this.height - ty);
    }
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    if (into) g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(-tx, -ty);
    const clip = this.look.clip;
    if (clip && clip.length >= 3) {
      g.beginPath();
      clip.forEach(([x, y], k) => (k === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.closePath();
      g.clip();
    }
    if (this.look.composite) g.globalCompositeOperation = this.look.composite;
    for (const k of this.lists[i]) {
      const o = this.ops[k];
      g.globalAlpha = o.alpha;
      if (o.live) {
        const img = o.live();
        if (img) g.drawImage(img, o.x, o.y);
      } else if (o.img) g.drawImage(o.img, o.x, o.y);
      else {
        g.fillStyle = o.style;
        g.fillRect(o.x, o.y, o.w, o.h);
      }
    }
    g.restore();
    return c;
  }

  /** A live stroke's picture has changed: the squares it lies in are painted again when next drawn. */
  change(op: number): void {
    const o = this.ops[op];
    if (!o) return;
    const c0 = Math.max(0, Math.floor(o.x / this.size));
    const c1 = Math.min(this.cols - 1, Math.floor((o.x + o.w - 1e-6) / this.size));
    const r0 = Math.max(0, Math.floor(o.y / this.size));
    const r1 = Math.min(this.rows - 1, Math.floor((o.y + o.h - 1e-6) / this.size));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.painted.has(r * this.cols + c)) this.stale.add(r * this.cols + c);
  }

  /** Of the squares on the screen whose picture changed, paints again as many as `budget.n` allows (the rest go on
   * showing the old picture till a later frame). */
  refresh(ox: number, oy: number, sw: number, sh: number, budget: { n: number }): void {
    if (!this.stale.size) return;
    for (const i of tilesOver(this.cols, this.rows, this.size, ox, oy, sw, sh, 0)) {
      if (budget.n <= 0) return;
      const c = this.painted.get(i);
      if (!c || !this.stale.has(i)) continue;
      budget.n--;
      this.stale.delete(i);
      this.paint(i, c);
    }
  }

  /** Draws the part on the screen (the layer's corner at `ox`, `oy`), painting the chunks it needs. */
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, sw: number, sh: number): void {
    for (const i of tilesOver(this.cols, this.rows, this.size, ox, oy, sw, sh, 0)) {
      if (this.lists[i].length === 0) continue;
      ctx.drawImage(this.chunk(i), ox + (i % this.cols) * this.size, oy + Math.floor(i / this.cols) * this.size);
    }
  }

  /** Paints the chunks round the screen ahead, while the time lasts. */
  warm(ox: number, oy: number, sw: number, sh: number, budgetMs: number): void {
    const end = performance.now() + budgetMs;
    for (const i of tilesOver(this.cols, this.rows, this.size, ox, oy, sw, sh, 1)) {
      if (performance.now() >= end) return;
      if (!this.painted.has(i) && this.lists[i].length > 0) this.chunk(i);
    }
  }
}

/** Things of a big map sorted into squares by the box their picture fills, so a frame asks only the squares on the
 * screen instead of every thing of the map. */
export class SpotGrid {
  private readonly x0: number;
  private readonly y0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: number[][];
  private readonly seen: Uint32Array;
  private stamp = 0;

  constructor(private readonly boxes: [number, number, number, number][], private readonly size: number) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const b of boxes) {
      x0 = Math.min(x0, b[0]);
      y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[2]);
      y1 = Math.max(y1, b[3]);
    }
    if (!boxes.length) x0 = y0 = x1 = y1 = 0;
    this.x0 = x0;
    this.y0 = y0;
    this.cols = Math.max(1, Math.floor((x1 - x0) / size) + 1);
    this.rows = Math.max(1, Math.floor((y1 - y0) / size) + 1);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    boxes.forEach((b, i) => {
      for (let r = this.row(b[1]); r <= this.row(b[3]); r++) for (let c = this.col(b[0]); c <= this.col(b[2]); c++) this.cells[r * this.cols + c].push(i);
    });
    this.seen = new Uint32Array(boxes.length);
  }

  private col(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.x0) / this.size)));
  }

  private row(y: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.y0) / this.size)));
  }

  /** The things whose box meets the given one, each once, in their own order. */
  query(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = [];
    this.stamp++;
    for (let r = this.row(y0); r <= this.row(y1); r++) {
      for (let c = this.col(x0); c <= this.col(x1); c++) {
        for (const i of this.cells[r * this.cols + c]) {
          if (this.seen[i] === this.stamp) continue;
          this.seen[i] = this.stamp;
          const b = this.boxes[i];
          if (b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1) out.push(i);
        }
      }
    }
    return out.sort((a, b) => a - b);
  }
}
