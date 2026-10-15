// Joining a figure's layers with what it carries (a pram, a cane, a phone) without making a new array every
// frame: the renderer keeps a sprite per layer list, so the same parts must give the same list.
import type { Layer } from './sprites';

interface Node {
  next: WeakMap<Layer[], Node>;
  value?: Layer[];
}

const ROOT: Node = { next: new WeakMap() };
const EMPTY: Layer[] = [];

/** The parts one after another, as one list: the same list each time for the same parts. */
export function joinLayers(...parts: Layer[][]): Layer[] {
  const ps = parts.filter((p) => p.length > 0);
  if (ps.length === 0) return EMPTY;
  if (ps.length === 1) return ps[0];
  let node = ROOT;
  for (const p of ps) {
    let n = node.next.get(p);
    if (!n) {
      n = { next: new WeakMap() };
      node.next.set(p, n);
    }
    node = n;
  }
  if (!node.value) {
    node.value = ps.flat();
    // drawn on the biggest grid of its parts (a hero's 40 with a cane's 32 is still a 40)
    const n = Math.max(...ps.map(layersSize));
    if (n !== 32) SIZES.set(node.value, n);
  }
  return node.value;
}

const SIZES = new WeakMap<Layer[], number>();

/** Marks layers as drawn on a grid `n` pixels a side (the hero's is 40; anything unmarked is 32). */
export function sizedLayers(layers: Layer[], n: number): Layer[] {
  if (n !== 32) SIZES.set(layers, n);
  return layers;
}

/** The side of the grid these layers are drawn on: 32 unless marked. */
export function layersSize(layers: Layer[]): number {
  return SIZES.get(layers) ?? 32;
}
