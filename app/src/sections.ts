// The parts of a home: the floor split by its walls into rooms, gardens and plots. Each part takes its name and
// kind from the room settings ("room.<x>_<y>.name|kind", the cell being any cell of the part), so a part needs
// no stored outline: it is whatever the walls enclose. Growing and shrinking move one edge by a row of cells.

import { DELTA, SIDES, cellKey, dividerKey } from './geometry';
import type { WallSide } from './types';

export const GRID = 32;

export type SectionKind = 'room' | 'hall' | 'kitchen' | 'bedroom' | 'bath' | 'lounge' | 'cinema' | 'games' | 'workshop' | 'garden' | 'farm' | 'orangery';

export interface Section {
  /** The first cell (top row, then left), as "x,y". */
  id: string;
  cells: [number, number][];
  x: number;
  y: number;
  w: number;
  d: number;
  name: string | null;
  kind: SectionKind;
  /** The cell its name and kind are kept on ("x_y"), or null when it has none of its own. */
  nameKey: string | null;
  outdoor: boolean;
}

const byRow = (a: [number, number], b: [number, number]) => a[1] - b[1] || a[0] - b[0];

/** The parts of the floor, in the order of their first cells. */
export function sectionsOf(
  cells: [number, number][],
  dividers: Set<string>,
  settings: Record<string, string>,
  outdoor: (x: number, y: number) => 'garden' | 'farm' | null,
): Section[] {
  const all = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const seen = new Set<string>();
  const out: Section[] = [];
  for (const start of [...cells].sort(byRow)) {
    if (seen.has(cellKey(start[0], start[1]))) continue;
    const part: [number, number][] = [];
    const queue: [number, number][] = [start];
    seen.add(cellKey(start[0], start[1]));
    while (queue.length) {
      const [x, y] = queue.pop() as [number, number];
      part.push([x, y]);
      for (const side of SIDES) {
        const [dx, dy] = DELTA[side];
        const k = cellKey(x + dx, y + dy);
        if (!all.has(k) || seen.has(k) || dividers.has(dividerKey(x, y, side))) continue;
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
    part.sort(byRow);
    const xs = part.map(([x]) => x);
    const ys = part.map(([, y]) => y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const nameKey = part.map(([cx, cy]) => `${cx}_${cy}`).find((k) => settings[`room.${k}.name`] || settings[`room.${k}.kind`]) ?? null;
    const open = outdoor(part[0][0], part[0][1]);
    const kind = (nameKey && (settings[`room.${nameKey}.kind`] as SectionKind | undefined)) || open || 'room';
    out.push({ id: cellKey(part[0][0], part[0][1]), cells: part, x, y, w: Math.max(...xs) - x + 1, d: Math.max(...ys) - y + 1, name: (nameKey && settings[`room.${nameKey}.name`]) || null, kind, nameKey, outdoor: open !== null });
  }
  return out;
}

export function sectionAt(sections: Section[], x: number, y: number): Section | null {
  return sections.find((s) => s.cells.some(([cx, cy]) => cx === x && cy === y)) ?? null;
}

/** The outermost cell of every line across `side`: the row a step toward that side would grow from or lose. */
function edgeCells(s: Section, side: WallSide): [number, number][] {
  const [dx, dy] = DELTA[side];
  const lines = new Map<number, [number, number]>();
  for (const c of s.cells) {
    const line = dx !== 0 ? c[1] : c[0];
    const at = lines.get(line);
    if (!at || (dx !== 0 ? (c[0] - at[0]) * dx > 0 : (c[1] - at[1]) * dy > 0)) lines.set(line, c);
  }
  return [...lines.values()].sort(byRow);
}

/** The cells one row further toward `side`, or nothing when any of them is taken or off the grid. */
export function growCells(s: Section, side: WallSide, all: Set<string>, limit = GRID): [number, number][] {
  const [dx, dy] = DELTA[side];
  const next = edgeCells(s, side).map(([x, y]) => [x + dx, y + dy] as [number, number]);
  const free = next.every(([x, y]) => x >= 0 && y >= 0 && x < limit && y < limit && !all.has(cellKey(x, y)));
  return free ? next : [];
}

/** The row on `side` to give back, or nothing when the part is a single line that way. */
export function shrinkCells(s: Section, side: WallSide): [number, number][] {
  const vertical = side === 'east' || side === 'west';
  if ((vertical ? s.w : s.d) < 2) return [];
  const [dx, dy] = DELTA[side];
  const own = new Set(s.cells.map(([x, y]) => cellKey(x, y)));
  // a line one cell long would vanish; keep those
  return edgeCells(s, side).filter(([x, y]) => own.has(cellKey(x - dx, y - dy)));
}

/** The edges of new cells that face cells of other parts: these get a wall, so the parts stay apart. */
export function newWalls(added: [number, number][], own: Set<string>, all: Set<string>): [number, number, WallSide][] {
  const fresh = new Set(added.map(([x, y]) => cellKey(x, y)));
  const out: [number, number, WallSide][] = [];
  for (const [x, y] of added) {
    for (const side of SIDES) {
      const [dx, dy] = DELTA[side];
      const k = cellKey(x + dx, y + dy);
      if (all.has(k) && !own.has(k) && !fresh.has(k)) out.push([x, y, side]);
    }
  }
  return out;
}

/** Where the part's name should be kept once `gone` is taken away: its own cell if it stays, else the first left. */
export function nameKeyFor(s: Section, gone: [number, number][]): string | null {
  const lost = new Set(gone.map(([x, y]) => `${x}_${y}`));
  if (s.nameKey && !lost.has(s.nameKey)) return s.nameKey;
  const keep = s.cells.map(([x, y]) => `${x}_${y}`).find((k) => !lost.has(k));
  return keep ?? null;
}

/** Whether the floor is all one piece (side by side, walls or not). */
export function connected(cells: [number, number][]): boolean {
  if (cells.length === 0) return false;
  const all = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const seen = new Set([cellKey(cells[0][0], cells[0][1])]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop() as [number, number];
    for (const side of SIDES) {
      const [dx, dy] = DELTA[side];
      const k = cellKey(x + dx, y + dy);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === all.size;
}

/** What a part nobody named is, by the things in it: a bed makes a bedroom, a stove a kitchen. */
export function guessKind(items: string[]): SectionKind | null {
  const has = (re: RegExp) => items.some((i) => re.test(i));
  if (has(/^(bathtub|toilet|shower|washbasin)/)) return 'bath';
  if (has(/^(stove|oven|counter_sink)/)) return 'kitchen';
  if (has(/^(bed|futon|bunk_bed)/)) return 'bedroom';
  if (has(/^(home_workbench|workbench)/)) return 'workshop';
  if (has(/^(game_table_home|gaming_chair|console)$/)) return 'games';
  if (has(/^(sofa|wall_tv|tv)/)) return 'lounge';
  return null;
}
