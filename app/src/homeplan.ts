// How the house is furnished: every room by a plan read from the back wall (the one opposite its door) toward the
// door, so a kitchen has its counters and stove along one wall facing into the room, a bedroom its bed against
// the wall with a table and a lamp each side, wherever the door happens to be. Pure geometry, no game state.

import type { WallSide } from './types';

const VEC: Record<WallSide, [number, number]> = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
/** The way an item faces for each rotation. */
const FRONT: [number, number][] = [[0, 1], [-1, 0], [0, -1], [1, 0]];

export type Facing = 'door' | 'back' | 'left' | 'right';

export interface RoomFrame {
  /** Cells across (left to right, looking at the back wall from the door) and from the back wall to the door. */
  uLen: number;
  vLen: number;
  dirU: [number, number];
  dirV: [number, number];
  cell(u: number, v: number): [number, number];
}

/**
 * A room seen from its door: v = 0 is the back wall's row, v = vLen - 1 the row by the door. Mirrored, left and
 * right swap (the same plan, the other way round).
 */
export function roomFrame(spot: { x: number; y: number; w: number; d: number }, doorSide: WallSide, mirror = false): RoomFrame {
  const dirV = VEC[doorSide];
  const dirU: [number, number] = mirror ? [dirV[1], -dirV[0]] : [-dirV[1], dirV[0]];
  const uLen = dirU[0] !== 0 ? spot.w : spot.d;
  const vLen = dirV[0] !== 0 ? spot.w : spot.d;
  const x0 = dirU[0] < 0 || dirV[0] < 0 ? spot.x + spot.w - 1 : spot.x;
  const y0 = dirU[1] < 0 || dirV[1] < 0 ? spot.y + spot.d - 1 : spot.y;
  return { uLen, vLen, dirU, dirV, cell: (u, v) => [x0 + u * dirU[0] + v * dirV[0], y0 + u * dirU[1] + v * dirV[1]] };
}

function facingVec(f: RoomFrame, face: Facing): [number, number] {
  switch (face) {
    case 'door':
      return f.dirV;
    case 'back':
      return [-f.dirV[0], -f.dirV[1]];
    case 'right':
      return f.dirU;
    default:
      return [-f.dirU[0], -f.dirU[1]];
  }
}

export interface Placed {
  x: number;
  y: number;
  rot: number;
  cells: [number, number][];
}

/**
 * A floor item of footprint w×d at local (u, v), facing a way. Negative u counts from the right wall (-1: flush
 * to it), negative v from the door wall.
 */
export function placeItem(f: RoomFrame, size: { w: number; d: number }, u: number, v: number, face: Facing): Placed {
  // an item is as wide as `w` across its front, and `d` deep
  const along = face === 'door' || face === 'back';
  const lu = along ? size.w : size.d;
  const lv = along ? size.d : size.w;
  const u0 = u < 0 ? f.uLen + u - lu + 1 : u;
  const v0 = v < 0 ? f.vLen + v - lv + 1 : v;
  const cells: [number, number][] = [];
  for (let i = 0; i < lu; i++) for (let j = 0; j < lv; j++) cells.push(f.cell(u0 + i, v0 + j));
  const [fx, fy] = facingVec(f, face);
  const rot = FRONT.findIndex(([a, b]) => a === fx && b === fy);
  return { x: Math.min(...cells.map((c) => c[0])), y: Math.min(...cells.map((c) => c[1])), rot, cells };
}

export interface OnWall {
  x: number;
  y: number;
  side: WallSide;
  cells: [number, number][];
}

/** A wall item of width w on the back, left or right wall, starting `along` cells in (negative: from the far end). */
export function placeOnWall(f: RoomFrame, size: { w: number; d?: number }, wall: 'back' | 'left' | 'right', along: number): OnWall {
  const cells: [number, number][] = [];
  let out: [number, number];
  if (wall === 'back') {
    const a = along < 0 ? f.uLen + along - size.w + 1 : along;
    for (let i = 0; i < size.w; i++) cells.push(f.cell(a + i, 0));
    out = [-f.dirV[0], -f.dirV[1]];
  } else {
    const a = along < 0 ? f.vLen + along - size.w + 1 : along;
    const u = wall === 'left' ? 0 : f.uLen - 1;
    for (let i = 0; i < size.w; i++) cells.push(f.cell(u, a + i));
    out = wall === 'left' ? [-f.dirU[0], -f.dirU[1]] : f.dirU;
  }
  const side = (Object.keys(VEC) as WallSide[]).find((s) => VEC[s][0] === out[0] && VEC[s][1] === out[1]) as WallSide;
  return { x: Math.min(...cells.map((c) => c[0])), y: Math.min(...cells.map((c) => c[1])), side, cells };
}

// ---- the plans --------------------------------------------------------------------------------------------

export interface PlanThing {
  item: string;
  u: number;
  v: number;
  face: Facing;
  /** Stands on the n-th (0: first) thing of this id placed by the plan. */
  on?: string;
}

export interface PlanWallThing {
  item: string;
  wall: 'back' | 'left' | 'right';
  along: number;
}

export interface RoomPlan {
  floor: PlanThing[];
  walls: PlanWallThing[];
}

/** The rooms of the house a new home gets, by what is in them. */
export const PLANS: Record<string, RoomPlan> = {
  // the kitchen: one working wall (fridge, counter, stove, sink, drawers) with cupboards above, the table by the
  // window side with a chair each side and fruit on it
  kitchen: {
    floor: [
      { item: 'fridge', u: 0, v: 0, face: 'door' },
      { item: 'counter', u: 1, v: 0, face: 'door' },
      { item: 'stove', u: 2, v: 0, face: 'door' },
      { item: 'counter_sink', u: 3, v: 0, face: 'door' },
      { item: 'counter_drawers', u: 4, v: 0, face: 'door' },
      { item: 'kettle', u: 1, v: 0, face: 'door', on: 'counter' },
      { item: 'herb_pots', u: 4, v: 0, face: 'door', on: 'counter_drawers' },
      { item: 'round_dining', u: -2, v: 2, face: 'door' },
      { item: 'dining_chair_wood', u: -4, v: 2, face: 'right' },
      { item: 'dining_chair_wood', u: -1, v: 3, face: 'left' },
      { item: 'fruit_bowl', u: -2, v: 2, face: 'door', on: 'round_dining' },
      { item: 'plate_stack', u: 3, v: 0, face: 'door', on: 'counter_sink' },
    ],
    walls: [
      { item: 'wall_cabinet', wall: 'back', along: 1 },
      { item: 'wall_cabinet', wall: 'back', along: 4 },
      { item: 'window_basic', wall: 'right', along: 1 },
      { item: 'wall_clock', wall: 'left', along: 2 },
    ],
  },
  // the bedroom: the bed in the middle of the back wall, a table and a lamp each side, a picture over it, a rug at
  // its foot, the wardrobe on one side wall, a dresser with a mirror on the other, a plant in the corner
  bedroom: {
    floor: [
      { item: 'bed', u: 2, v: 0, face: 'door' },
      { item: 'nightstand', u: 1, v: 0, face: 'door' },
      { item: 'nightstand', u: 4, v: 0, face: 'door' },
      { item: 'table_lamp', u: 1, v: 0, face: 'door', on: 'nightstand' },
      { item: 'table_lamp', u: 4, v: 0, face: 'door', on: 'nightstand#1' },
      { item: 'rug_small', u: 2, v: 2, face: 'door' },
      { item: 'wardrobe', u: 0, v: 2, face: 'right' },
      { item: 'dresser', u: -1, v: 2, face: 'left' },
      { item: 'fern', u: -1, v: 0, face: 'door' },
    ],
    walls: [
      { item: 'painting_wide', wall: 'back', along: 2 },
      { item: 'window_basic', wall: 'left', along: 0 },
      { item: 'mirror', wall: 'right', along: 2 },
    ],
  },
  // the bathroom: the bath along the back wall with a mat in front, the toilet in the far corner, the basin with
  // its mirror on a side wall, the washing machine and the basket on the other, a towel rail, a plant
  bath: {
    floor: [
      { item: 'bathtub', u: 0, v: 0, face: 'door' },
      { item: 'toilet', u: -1, v: 0, face: 'door' },
      { item: 'snake_plant', u: 2, v: 0, face: 'door' },
      { item: 'bath_mat', u: 0, v: 1, face: 'door' },
      { item: 'washbasin', u: 0, v: 2, face: 'right' },
      { item: 'washing_machine', u: -1, v: 2, face: 'left' },
      { item: 'laundry_basket', u: -1, v: 3, face: 'left' },
    ],
    walls: [
      { item: 'mirror', wall: 'left', along: 2 },
      { item: 'towel_rail', wall: 'back', along: 3 },
    ],
  },
  // the garden: the apple tree in a corner, the pond in the middle with a bench facing it and a lantern by the
  // bench, flowers along the back, bushes in the other corners
  garden: {
    floor: [
      { item: 'tree_apple', u: 0, v: 0, face: 'door' },
      { item: 'flower_bed', u: 3, v: 0, face: 'door' },
      { item: 'bush_round', u: -1, v: 0, face: 'door' },
      { item: 'pond', u: 3, v: 3, face: 'door' },
      { item: 'garden_bench', u: 3, v: 6, face: 'back' },
      { item: 'lantern', u: 6, v: 6, face: 'back' },
      { item: 'bush_flowering', u: 0, v: -2, face: 'door' },
    ],
    walls: [],
  },
  // the vegetable plot: beds in rows with paths between, the scarecrow, the compost in a corner
  farm: {
    floor: [
      { item: 'garden_plot', u: 1, v: 1, face: 'door' },
      // plots to sow: two rows of three with a path between
      { item: 'garden_plot', u: 1, v: 3, face: 'door' },
      { item: 'garden_plot', u: 2, v: 3, face: 'door' },
      { item: 'garden_plot', u: 3, v: 3, face: 'door' },
      { item: 'garden_plot', u: 1, v: 5, face: 'door' },
      { item: 'garden_plot', u: 2, v: 5, face: 'door' },
      { item: 'garden_plot', u: 3, v: 5, face: 'door' },
      { item: 'scarecrow', u: -2, v: 3, face: 'door' },
      { item: 'compost_bin', u: -1, v: 0, face: 'door' },
    ],
    walls: [],
  },
  // the orangery: the two trees in the back corners, the potting bench between them, the orchids on a side, a
  // wicker chair to sit among them
  orangery: {
    floor: [
      { item: 'lemon_tree', u: 0, v: 0, face: 'door' },
      { item: 'orange_tree', u: -1, v: 0, face: 'door' },
      { item: 'potting_bench', u: 2, v: 0, face: 'door' },
      { item: 'orchid_stand', u: 0, v: 2, face: 'right' },
      { item: 'garden_tub', u: 2, v: 2, face: 'door' },
      { item: 'garden_tub', u: 3, v: 2, face: 'door' },
      { item: 'wicker_chair', u: -2, v: 3, face: 'back' },
    ],
    walls: [],
  },
  // the parts a home adds to spend time together (the plan of the home, sections.ts): a lounge to sit about in, a
  // cinema with its rows facing the screen, a games room with a console and a table for board games, a hall
  lounge: {
    floor: [
      { item: 'sofa3', u: 2, v: 0, face: 'door' },
      { item: 'rug_big', u: 2, v: 1, face: 'door' },
      { item: 'coffee_table', u: 2, v: 2, face: 'door' },
      { item: 'armchair', u: 1, v: 2, face: 'right' },
      { item: 'armchair', u: 4, v: 2, face: 'left' },
      { item: 'lava_lamp', u: 2, v: 2, face: 'door', on: 'coffee_table' },
      { item: 'floor_lamp_arc', u: 0, v: 0, face: 'door' },
      { item: 'side_table', u: -1, v: 0, face: 'door' },
      { item: 'record_player', u: -1, v: 0, face: 'door', on: 'side_table' },
      { item: 'bookshelf', u: 0, v: 3, face: 'right' },
      { item: 'monstera', u: -1, v: 3, face: 'door' },
    ],
    walls: [
      { item: 'neon_sign', wall: 'back', along: 2 },
      { item: 'string_lights', wall: 'left', along: 1 },
      { item: 'poster', wall: 'right', along: 1 },
    ],
  },
  cinema: {
    floor: [
      { item: 'media_console', u: 2, v: 0, face: 'door' },
      { item: 'console', u: 0, v: 0, face: 'door' },
      { item: 'rug_shaggy', u: 2, v: 2, face: 'door' },
      { item: 'sofa3', u: 2, v: 3, face: 'back' },
      { item: 'pouf', u: 1, v: 5, face: 'back' },
      { item: 'pouf', u: 3, v: 5, face: 'back' },
      { item: 'pouf', u: 5, v: 5, face: 'back' },
      { item: 'floor_lamp', u: -1, v: 3, face: 'door' },
    ],
    walls: [
      { item: 'wall_tv', wall: 'back', along: 2 },
      { item: 'wall_lamp', wall: 'left', along: 3 },
      { item: 'wall_lamp', wall: 'right', along: 3 },
    ],
  },
  games: {
    floor: [
      { item: 'tv_stand', u: 1, v: 0, face: 'door' },
      { item: 'tv', u: 1, v: 0, face: 'door', on: 'tv_stand' },
      { item: 'console', u: 3, v: 0, face: 'door' },
      { item: 'gaming_chair', u: 2, v: 2, face: 'back' },
      { item: 'game_table_home', u: -2, v: 3, face: 'door' },
      { item: 'pouf', u: -3, v: 3, face: 'right' },
      { item: 'pouf', u: -1, v: 3, face: 'left' },
      { item: 'game_shelf', u: -1, v: 0, face: 'door' },
      { item: 'bar_stool', u: 0, v: 3, face: 'right' },
    ],
    walls: [
      { item: 'neon_heart', wall: 'back', along: 5 },
      { item: 'poster', wall: 'left', along: 1 },
      { item: 'string_lights', wall: 'right', along: 1 },
    ],
  },
  hall: {
    floor: [
      { item: 'rug_runner', u: 0, v: 1, face: 'door' },
      { item: 'coat_rack', u: -1, v: 0, face: 'door' },
    ],
    walls: [{ item: 'mirror', wall: 'left', along: 2 }],
  },
  // rooms the builders build on (builds.rs): the workshop, the music room, the attic, the cellar, upstairs, the
  // terrace and the yard — each with what its order brings
  workshop: {
    floor: [
      { item: 'home_workbench', u: 1, v: 0, face: 'door' },
      { item: 'chest', u: -1, v: 0, face: 'door' },
      { item: 'bookshelf', u: 0, v: 2, face: 'right' },
      { item: 'floor_lamp', u: 0, v: 0, face: 'door' },
    ],
    walls: [{ item: 'window_basic', wall: 'back', along: 2 }],
  },
  music: {
    floor: [
      { item: 'piano', u: 1, v: 0, face: 'door' },
      { item: 'rug_round', u: 2, v: 2, face: 'door' },
      { item: 'armchair', u: -1, v: 3, face: 'left' },
      { item: 'gramophone', u: -1, v: 0, face: 'door' },
      { item: 'floor_lamp', u: 0, v: 3, face: 'door' },
    ],
    walls: [{ item: 'window_round', wall: 'left', along: 2 }],
  },
  attic: {
    floor: [
      { item: 'futon', u: 1, v: 0, face: 'door' },
      { item: 'chest', u: -1, v: 0, face: 'door' },
      { item: 'rocking_chair', u: -2, v: 2, face: 'left' },
    ],
    walls: [
      { item: 'window_round', wall: 'back', along: 4 },
      { item: 'string_lights', wall: 'left', along: 1 },
    ],
  },
  cellar: {
    floor: [
      { item: 'chest', u: 0, v: 0, face: 'door' },
      { item: 'chest', u: 1, v: 0, face: 'door' },
      { item: 'bookshelf', u: -1, v: 1, face: 'left' },
      { item: 'lantern', u: 0, v: 2, face: 'door' },
    ],
    walls: [],
  },
  upstairs: {
    floor: [
      { item: 'desk', u: 1, v: 0, face: 'door' },
      { item: 'office_chair', u: 1, v: 1, face: 'back' },
      { item: 'bookshelf', u: 4, v: 0, face: 'door' },
      { item: 'bed_single', u: -1, v: 2, face: 'left' },
      { item: 'toy_box', u: -1, v: 0, face: 'door' },
      { item: 'rug_round', u: 3, v: 3, face: 'door' },
      { item: 'floor_lamp', u: 0, v: 0, face: 'door' },
    ],
    walls: [
      { item: 'window_basic', wall: 'back', along: 2 },
      { item: 'window_basic', wall: 'left', along: 1 },
    ],
  },
  terrace: {
    floor: [
      { item: 'sun_lounger', u: 0, v: 0, face: 'door' },
      { item: 'picnic_table', u: 3, v: 1, face: 'door' },
      { item: 'bbq_grill', u: -1, v: 0, face: 'door' },
    ],
    walls: [],
  },
  yard: {
    floor: [
      { item: 'tree_apple', u: 0, v: 0, face: 'door' },
      { item: 'swing', u: 3, v: 0, face: 'door' },
      { item: 'sandbox', u: -2, v: 1, face: 'door' },
      { item: 'garden_bench', u: 2, v: 4, face: 'back' },
      { item: 'bush_round', u: -1, v: -1, face: 'door' },
      { item: 'hammock', u: 0, v: 4, face: 'right' },
    ],
    walls: [],
  },
};

/**
 * The first room (the living room), in its own coordinates: the front door is in the west wall, the window in
 * the north. The television against the north wall, the sofa facing it across a low table on a big rug, an
 * armchair at the side, a bookshelf, a lamp by the sofa, plants in corners, pictures and a wall lamp.
 */
export const LIVING: { floor: { item: string; x: number; y: number; rot: number; on?: string }[]; walls: { item: string; x: number; y: number; side: WallSide }[] } = {
  floor: [
    { item: 'rug_big', x: 4, y: 2, rot: 0 },
    { item: 'tv_stand', x: 4, y: 0, rot: 0 },
    { item: 'tv', x: 4, y: 0, rot: 0, on: 'tv_stand' },
    { item: 'vase', x: 5, y: 0, rot: 0, on: 'tv_stand' },
    { item: 'coffee_table', x: 4, y: 3, rot: 0 },
    { item: 'book_stack', x: 5, y: 3, rot: 0, on: 'coffee_table' },
    { item: 'sofa3', x: 4, y: 5, rot: 2 },
    { item: 'armchair', x: 7, y: 3, rot: 1 },
    { item: 'floor_lamp', x: 7, y: 5, rot: 0 },
    { item: 'bookshelf', x: 8, y: 0, rot: 0 },
    { item: 'monstera', x: 9, y: 9, rot: 0 },
    { item: 'ficus', x: 9, y: 2, rot: 0 },
  ],
  walls: [
    { item: 'painting_wide', x: 6, y: 0, side: 'north' },
    { item: 'wall_lamp', x: 5, y: 9, side: 'south' },
    { item: 'window_basic', x: 2, y: 9, side: 'south' },
  ],
};
