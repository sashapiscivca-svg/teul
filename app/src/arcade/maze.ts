// «Котик у лабіринті»: the cat walks a maze picking up crumbs; four dogs wander after it. A big fish makes
// the dogs run away for a while, and then the cat can chase them home. The rules only, no drawing.

export const MAZE = [
  '###################',
  '#o.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#       #.#   ',
  '####.# ##=## #.####',
  '    .  #DDD#  .    ',
  '####.# ##### #.####',
  '   #.#       #.#   ',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface Mover {
  x: number;
  y: number;
  px: number;
  py: number;
  dir: Dir;
}

export interface Dog extends Mover {
  /** Ticks left of running away; 0 when it hunts. */
  scared: number;
  /** Eaten and walking back home. */
  home: boolean;
  /** Ticks to wait in the doghouse before coming out. */
  wait: number;
}

export interface Maze {
  w: number;
  h: number;
  walls: boolean[][];
  door: [number, number];
  den: [number, number][];
  crumbs: Set<string>;
  fish: Set<string>;
  cat: Mover & { want: Dir };
  dogs: Dog[];
  score: number;
  lives: number;
  level: number;
  ticks: number;
  over: boolean;
  /** The ticks left of the short pause after the cat is caught or a level is cleared. */
  pause: number;
  seed: number;
  start: [number, number];
}

const key = (x: number, y: number) => `${x},${y}`;

function random(m: Maze): number {
  let s = m.seed | 0 || 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  m.seed = s >>> 0;
  return m.seed;
}

export function newMaze(seed: number): Maze {
  const h = MAZE.length;
  const w = MAZE[0].length;
  const m: Maze = {
    w, h, walls: [], door: [0, 0], den: [], crumbs: new Set(), fish: new Set(),
    cat: { x: 0, y: 0, px: 0, py: 0, dir: 3, want: 3 }, dogs: [], score: 0, lives: 3, level: 1, ticks: 0, over: false, pause: 8, seed: seed >>> 0 || 1, start: [0, 0],
  };
  fill(m);
  return m;
}

/** Lays out the crumbs, the fish, the cat and the dogs as at the start of a level. */
function fill(m: Maze): void {
  m.walls = [];
  m.den = [];
  for (let y = 0; y < m.h; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < m.w; x++) {
      const c = MAZE[y][x];
      row.push(c === '#' || c === '=');
      if (c === '.') m.crumbs.add(key(x, y));
      if (c === 'o') m.fish.add(key(x, y));
      if (c === 'P') m.start = [x, y];
      if (c === '=') m.door = [x, y];
      if (c === 'D') m.den.push([x, y]);
    }
    m.walls.push(row);
  }
  reset(m);
}

/** Puts everyone back in their places (after the cat is caught). */
function reset(m: Maze): void {
  const [sx, sy] = m.start;
  m.cat = { x: sx, y: sy, px: sx, py: sy, dir: 3, want: 3 };
  m.dogs = [0, 1, 2, 3].map((i) => {
    const [x, y] = i === 0 ? [m.door[0], m.door[1] - 1] : m.den[(i - 1) % m.den.length];
    return { x, y, px: x, py: y, dir: 0 as Dir, scared: 0, home: false, wait: i * 12 };
  });
  m.pause = 8;
}

function wrap(m: Maze, x: number): number {
  return (x + m.w) % m.w;
}

/** Can a mover step from (x, y) towards dir? The doghouse door lets only dogs through. */
export function open(m: Maze, x: number, y: number, dir: Dir, dog = false): boolean {
  const nx = wrap(m, x + DX[dir]);
  const ny = y + DY[dir];
  if (ny < 0 || ny >= m.h) return false;
  if (dog && nx === m.door[0] && ny === m.door[1]) return true;
  return !m.walls[ny][nx];
}

function step(m: Maze, who: Mover, dir: Dir): void {
  who.px = who.x;
  who.py = who.y;
  who.dir = dir;
  who.x = wrap(m, who.x + DX[dir]);
  who.y += DY[dir];
}

/** The player asks the cat to go a way; it turns there as soon as it can. */
export function steer(m: Maze, dir: Dir): void {
  m.cat.want = dir;
}

function dogTarget(m: Maze, i: number, dog: Dog): [number, number] {
  if (dog.home) return [m.door[0], m.door[1] + 1];
  const c = m.cat;
  if (i === 0) return [c.x, c.y];
  if (i === 1) return [c.x + DX[c.dir] * 4, c.y + DY[c.dir] * 4];
  if (i === 2) return [c.x * 2 - m.dogs[0].x, c.y * 2 - m.dogs[0].y];
  // the fourth hunts from afar and wanders off when close
  return Math.hypot(dog.x - c.x, dog.y - c.y) > 7 ? [c.x, c.y] : [0, m.h];
}

function moveDog(m: Maze, i: number, dog: Dog): void {
  if (dog.wait > 0) {
    dog.wait--;
    dog.px = dog.x;
    dog.py = dog.y;
    return;
  }
  // inside the doghouse: out through the door first
  const inDen = m.den.some(([x, y]) => x === dog.x && y === dog.y) || (dog.x === m.door[0] && dog.y === m.door[1]);
  const back = ((dog.dir + 2) % 4) as Dir;
  let ways = ([0, 1, 2, 3] as Dir[]).filter((d) => open(m, dog.x, dog.y, d, dog.home || inDen) && d !== back);
  if (ways.length === 0) ways = [back];
  let target = dogTarget(m, i, dog);
  if (inDen && !dog.home) target = [m.door[0], m.door[1] - 1];
  let best: Dir;
  if (dog.scared > 0 && !dog.home && !inDen) {
    best = ways[random(m) % ways.length];
  } else {
    best = ways.reduce((a, d) => {
      const da = Math.hypot(wrap(m, dog.x + DX[a]) - target[0], dog.y + DY[a] - target[1]);
      const dd = Math.hypot(wrap(m, dog.x + DX[d]) - target[0], dog.y + DY[d] - target[1]);
      return dd < da ? d : a;
    });
  }
  step(m, dog, best);
  if (dog.home && m.den.some(([x, y]) => x === dog.x && y === dog.y)) {
    dog.home = false;
    dog.scared = 0;
    dog.wait = 6;
  }
}

function meet(m: Maze): void {
  const c = m.cat;
  for (const dog of m.dogs) {
    if (dog.home) continue;
    const same = dog.x === c.x && dog.y === c.y;
    const crossed = dog.x === c.px && dog.y === c.py && dog.px === c.x && dog.py === c.y;
    if (!same && !crossed) continue;
    if (dog.scared > 0) {
      dog.home = true;
      dog.scared = 0;
      m.score += 200;
    } else {
      m.lives--;
      if (m.lives <= 0) m.over = true;
      else reset(m);
      return;
    }
  }
}

/** One tick of the game. Dogs are a little slower than the cat, and slower still when scared. */
export function tick(m: Maze): void {
  if (m.over) return;
  m.ticks++;
  if (m.pause > 0) {
    m.pause--;
    return;
  }
  const c = m.cat;
  if (open(m, c.x, c.y, c.want)) step(m, c, c.want);
  else if (open(m, c.x, c.y, c.dir)) step(m, c, c.dir);
  else {
    c.px = c.x;
    c.py = c.y;
  }
  const here = key(c.x, c.y);
  if (m.crumbs.delete(here)) m.score += 10;
  if (m.fish.delete(here)) {
    m.score += 50;
    for (const d of m.dogs) if (!d.home) d.scared = Math.max(20, 60 - m.level * 6);
  }
  meet(m);
  if (m.pause > 0 || m.over) return;
  const slow = 6 - Math.min(3, m.level - 1);
  m.dogs.forEach((dog, i) => {
    if (dog.home || (dog.scared > 0 ? m.ticks % 2 === 0 : m.ticks % slow !== 0)) moveDog(m, i, dog);
    else {
      dog.px = dog.x;
      dog.py = dog.y;
    }
    if (dog.scared > 0) dog.scared--;
  });
  meet(m);
  if (m.crumbs.size === 0 && m.fish.size === 0) {
    m.level++;
    fill(m);
  }
}

/** How long a tick lasts, in milliseconds. */
export function tickMs(m: Maze): number {
  return Math.max(110, 170 - (m.level - 1) * 10);
}
