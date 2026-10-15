// «Сапер» for the computer at home: a field of hidden mines, numbers that tell how many are around, the first
// cell always safe. Pure functions over a plain board.

export interface Mines {
  w: number;
  h: number;
  mine: boolean[];
  open: boolean[];
  flag: boolean[];
  /** Mines are laid at the first opening, away from it. */
  laid: boolean;
  count: number;
  seed: number;
  lost: boolean;
}

export function newMines(w = 9, h = 9, count = 10, seed = 1): Mines {
  const n = w * h;
  return { w, h, mine: Array(n).fill(false), open: Array(n).fill(false), flag: Array(n).fill(false), laid: false, count, seed, lost: false };
}

function around(m: Mines, i: number): number[] {
  const x = i % m.w;
  const y = Math.floor(i / m.w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h) out.push(ny * m.w + nx);
  }
  return out;
}

export function near(m: Mines, i: number): number {
  return around(m, i).filter((j) => m.mine[j]).length;
}

function lay(m: Mines, safe: number): void {
  let s = m.seed >>> 0 || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const keep = new Set([safe, ...around(m, safe)]);
  let placed = 0;
  while (placed < m.count) {
    const i = Math.floor(rnd() * m.w * m.h);
    if (m.mine[i] || keep.has(i)) continue;
    m.mine[i] = true;
    placed++;
  }
  m.laid = true;
}

/** Opens a cell (and the quiet field around a zero). */
export function reveal(m: Mines, x: number, y: number): Mines {
  const i = y * m.w + x;
  if (m.lost || m.open[i] || m.flag[i]) return m;
  if (!m.laid) lay(m, i);
  if (m.mine[i]) {
    m.lost = true;
    m.mine.forEach((b, j) => {
      if (b) m.open[j] = true;
    });
    return m;
  }
  const stack = [i];
  while (stack.length) {
    const j = stack.pop() as number;
    if (m.open[j]) continue;
    m.open[j] = true;
    m.flag[j] = false;
    if (near(m, j) === 0) for (const k of around(m, j)) if (!m.open[k] && !m.mine[k]) stack.push(k);
  }
  return m;
}

export function toggleFlag(m: Mines, x: number, y: number): Mines {
  const i = y * m.w + x;
  if (!m.open[i] && !m.lost) m.flag[i] = !m.flag[i];
  return m;
}

export function won(m: Mines): boolean {
  return m.laid && !m.lost && m.open.every((o, i) => o || m.mine[i]);
}
