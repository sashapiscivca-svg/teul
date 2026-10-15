// The beings of the other worlds and of the eerie nights, as pixel sprites in the same 32×32 grid as people:
// small ASCII drawings (12 wide, 24 tall, standing on the grid's floor line), turned for the four directions, with
// a step and a bob for walking. Also what the mob carries (torches, pitchforks) over the residents' own sprites.

import type { Dir } from '../character';
import type { Layer } from '../sprites';

export type Creature =
  | 'lantern'
  | 'moth'
  | 'deer'
  | 'shade'
  | 'seedling'
  | 'gardener'
  | 'saltwalker'
  | 'beetle'
  | 'owl'
  | 'clockfox'
  | 'robed'
  | 'hunter';

interface Art {
  rows: string[];
  colors: Record<string, string>;
  /** Pixels that are a face: on the back they take this colour. */
  face?: string;
  back?: string;
  /** Floats (no steps): bobs up and down instead. */
  floats?: boolean;
}

// 12 columns × 24 rows each; '.' is empty
const ART: Record<Creature, Art> = {
  // a tall figure in a long coat whose head is an iron lantern with a fire inside
  lantern: {
    rows: [
      '.....ii.....', '....iiii....', '...i....i...', '..iiiiiiii..', '..igfFFfgi..', '..igfFFfgi..', '..iggffggi..', '..iiiiiiii..',
      '....iiii....', '...kkkkkk...', '..kkkkkkkk..', '.kkkkKKkkkk.', '.kkkkKKkkkk.', '.kk.kKKk.kk.', '.hh.kKKk.hh.', '....kKKk....',
      '....kKKk....', '...kkKKkk...', '...kkKKkk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...dd..dd...', '..ddd..ddd..',
    ],
    colors: { i: '#2e2c38', g: '#f6b347', f: '#ffcf6a', F: '#fff3c4', k: '#1c1a2a', K: '#2f2a48', h: '#b9a7c9', d: '#121018' },
    face: 'fFg',
    back: '#2e2c38',
  },
  // pale, with a cloak of soft wings, feathered antennae and two black eyes
  moth: {
    rows: [
      '..a......a..', '...a....a...', '....wwww....', '...wwwwww...', '...weewwe...', '...wwwwww...', '....wwww....', '.mm.wwww.mm.',
      'mmmmwwwwmmmm', 'mMmmwwwwmmMm', 'mMMmwwwwmMMm', 'mMmmwwwwmmMm', 'mmmmwwwwmmmm', '.mmmwwwwmmm.', '..mmwwwwmm..', '...mwwwwm...',
      '....wwww....', '....wwww....', '....w..w....', '....w..w....', '....w..w....', '....w..w....', '....l..l....', '...ll..ll...',
    ],
    colors: { a: '#cfc6a8', w: '#e9e2cc', e: '#141018', m: '#bdb08a', M: '#8a7a5a', l: '#6a5c48' },
    face: 'e',
    back: '#e9e2cc',
  },
  // a gaunt walker in black with a deer's skull for a face and antlers wider than its shoulders
  deer: {
    rows: [
      'a..a....a..a', '.a.a....a.a.', '..aa....aa..', '...aassaa...', '....ssss....', '....seSs....', '....ssss....', '.....ss.....',
      '....kkkk....', '...kkkkkk...', '..kkkkkkkk..', '..kk.kk.kk..', '..kk.kk.kk..', '..hh.kk.hh..', '..h..kk..h..', '.....kk.....',
      '....kkkk....', '....k..k....', '....k..k....', '....k..k....', '....k..k....', '....k..k....', '....d..d....', '...dd..dd...',
    ],
    colors: { a: '#d9cfb6', s: '#efe7d2', e: '#120c10', S: '#120c10', k: '#16121c', h: '#3a3044', d: '#0c0a10' },
    face: 'eS',
    back: '#efe7d2',
  },
  // a person-shaped piece of the night with two points of light
  shade: {
    rows: [
      '............', '....kkkk....', '...kkkkkk...', '...kekkek...', '...kkkkkk...', '....kkkk....', '.....kk.....', '...kkkkkk...',
      '..kkkkkkkk..', '.kkkkkkkkkk.', '.kk.kkkk.kk.', '.kk.kkkk.kk.', '.k..kkkk..k.', '.k..kkkk..k.', '....kkkk....', '....kkkk....',
      '....kkkk....', '....k..k....', '....k..k....', '....k..k....', '....k..k....', '...kk..kk...', '..k......k..', '.k........k.',
    ],
    colors: { k: '#0a0812', e: '#d8e4ff' },
    face: 'e',
    back: '#0a0812',
  },
  // a drifting seed with a glowing heart
  seedling: {
    rows: [
      '............', '............', '..h..h..h...', '...h.h.h....', 'hh.hhhhh.hh.', '...hhhhhh...', '..hhhhhhhh..', 'hhhhhhhhhhhh',
      '..hhhhhhhh..', '...hhhhhh...', '..h.hhhh.h..', '.h...gg...h.', '.....gG.....', '.....gg.....', '......s.....', '......s.....',
      '.....s......', '......s.....', '............', '............', '............', '............', '............', '............',
    ],
    colors: { h: '#f4fbef', g: '#fff6b0', G: '#ffffff', s: '#9ad8a8' },
    floats: true,
  },
  // a mossy, hunched gardener with a flower for a head and a can of light
  gardener: {
    rows: [
      '...pp..pp...', '..pppppppp..', '..ppPccPpp..', '..pppccppp..', '...pppppp...', '.....ss.....', '...mmmmmm...', '..mmmmmmmm..',
      '.mmMmmmmMmm.', '.mmmmmmmmmm.', '.mm.mmmm.mm.', '.mm.mmmm.mmw', '.hh.mmmm.hww', '....mmmm..ww', '....mMmm....', '...mmmmmm...',
      '...mm..mm...', '...mm..mm...', '...mm..mm...', '...mm..mm...', '...mm..mm...', '...mm..mm...', '...dd..dd...', '..ddd..ddd..',
    ],
    colors: { p: '#ff8ab8', P: '#f7d2ec', c: '#fff6b0', s: '#2f8f7a', m: '#3d6f4a', M: '#5fae86', h: '#8fbf7a', w: '#9ad8ff', d: '#2a4a32' },
    face: 'c',
    back: '#ff8ab8',
  },
  // a tall walker of the salt in a white robe, its head a wide parasol
  saltwalker: {
    rows: [
      'pppppppppppp', '.pPpPpPpPpP.', '.....rr.....', '....wwww....', '....weew....', '....wwww....', '...wwwwww...', '..wwwwwwww..',
      '..wwWwwWww..', '..wwwwwwww..', '..ww.ww.ww..', '..ww.ww.ww..', '..hh.ww.hh..', '.....ww.....', '....wwww....', '....wwww....',
      '...wwwwww...', '...wwwwww...', '..wwwwwwww..', '..wwwwwwww..', '..wwwwwwww..', '.wwwwwwwwww.', '..ww....ww..', '............',
    ],
    colors: { p: '#f2c38b', P: '#d98c5f', r: '#b9b2c9', w: '#fbfaf4', W: '#e0d9c6', e: '#9fd3da', h: '#e9e3d4' },
    face: 'e',
    back: '#fbfaf4',
  },
  // a beetle of glass the size of a cat
  beetle: {
    rows: [
      '............', '............', '............', '............', '............', '............', '............', '............',
      '............', '............', '............', '............', '............', '....aa.aa...', '.....a.a....', '...gggggg...',
      '..gGgggggg..', '.gGgggGggggg', '.gggggGggggg', '.ggggGgggggg', '..gggggggg..', '.l.l....l.l.', 'l..l....l..l', '............',
    ],
    colors: { a: '#9fd3da', g: '#7fc8d4', G: '#e8fbff', l: '#4a8a96' },
    floats: true,
  },
  // an archivist with an owl's head, a robe of amber and a book under the wing
  owl: {
    rows: [
      '..o......o..', '..oooooooo..', '.oooooooooo.', '.oEEooooEEo.', '.oEeoooEeoo.', '.oooobboooo.', '..oooooooo..', '...oooooo...',
      '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrRrrrrRrr.', '.rrrrrrrbbr.', '.rr.rrrbbbr.', '.ff.rrrrrff.', '....rrrr....', '...rrrrrr...',
      '...rrrrrr...', '..rrrrrrrr..', '..rrrrrrrr..', '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '...ff..ff...', '..fff..fff..',
    ],
    colors: { o: '#a8582a', E: '#ffcf7a', e: '#2a1a12', b: '#5a3322', r: '#7a4b8c', R: '#c9a24a', f: '#e89a3c' },
    face: 'Ee',
    back: '#a8582a',
  },
  // a fox that ticks: copper fur and a brass gear for a heart
  clockfox: {
    rows: [
      '............', '............', '............', '............', '............', '............', '............', '............',
      '............', '............', '.o.....o....', '.oo...oo....', '.ooooooo....', '.oeooeoo....', '..ooooo.....', '...wn.......',
      '..ooooooooo.', '.oooGgooooo.', '.ooogGoooooo', '.oooooooooot', '.o.o...o.ott', '.o.o...o.o.t', '.l.l...l.l..', '............',
    ],
    colors: { o: '#e89a3c', e: '#2a1a12', w: '#f4e6c8', n: '#2a1a12', G: '#c9a24a', g: '#7a5a20', t: '#f4e6c8', l: '#5a3322' },
    face: 'en',
    back: '#e89a3c',
  },
  // a figure in a long hooded robe; where the face should be, a blank white mask
  robed: {
    rows: [
      '.....rr.....', '....rrrr....', '...rrrrrr...', '..rrmmmmrr..', '..rmmmmmmr..', '..rmEmmEmr..', '..rmmmmmmr..', '..rrmmmmrr..',
      '..rrrMMrrr..', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrrRrrRrrr.', '.rrrRrrRrrr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.',
      '.rrrrrrrrrr.', '.rrrrrrrrrr.', 'rrrrrrrrrrrr', 'rrrrRrrRrrrr', 'rrrrrrrrrrrr', 'rrrrrrrrrrrr', 'rrrrrrrrrrrr', '.rrrrrrrrrr.',
    ],
    colors: { r: '#2a1e22', R: '#3a2a2e', m: '#e8e2d6', E: '#0a0608', M: '#e8e2d6' },
    face: 'mEM',
    back: '#2a1e22',
  },
  // the one that hunts: too tall, too thin, long arms, a mask with holes for eyes
  hunter: {
    rows: [
      '....mmmm....', '...mmmmmm...', '...mEmmEm...', '...mmmmmm...', '...mmNNmm...', '....mmmm....', '.....kk.....', '...kkkkkk...',
      '..kkkkkkkk..', '.kkkkkkkkkk.', '.kk.kkkk.kk.', '.kk.kkkk.kk.', '.kk.kkkk.kk.', '.kk.kkkk.kk.', '.kk.kkkk.kk.', '.hh.kkkk.hh.',
      '.hh.kkkk.hh.', '.h..kkkk..h.', '....k..k....', '....k..k....', '....k..k....', '....k..k....', '....d..d....', '...dd..dd...',
    ],
    colors: { m: '#d8d0c0', E: '#000000', N: '#3a1010', k: '#121014', h: '#8a8478', d: '#060508' },
    face: 'mEN',
    back: '#121014',
  },
};

const CACHE = new Map<string, Layer[]>();

/** The layers of a being, facing `dir`, walking or standing, at an animation frame. */
export function creatureLayers(kind: Creature, dir: Dir, walking: boolean, frame: number): Layer[] {
  const key = `${kind}|${dir}|${walking ? frame % 4 : -1}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const art = ART[kind];
  const W = 12;
  const H = 24;
  const ox = 10;
  const bob = art.floats ? [0, -1, -2, -1][frame % 4] : walking ? (frame % 2 === 1 ? -1 : 0) : 0;
  const oy = 32 - H + bob - 1;
  const by = new Map<string, string>();
  const put = (x: number, y: number, color: string) => {
    if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
    by.set(color, (by.get(color) ?? '') + `M${x} ${y}h1v1h-1z`);
  };
  for (let r = 0; r < H; r++) {
    const row = art.rows[r] ?? '';
    // legs swing when walking: the bottom rows shift a pixel one way on one step and back on the next
    const legs = walking && !art.floats && r >= H - 6;
    const swing = legs ? (frame % 4 === 1 ? 1 : frame % 4 === 3 ? -1 : 0) : 0;
    for (let c = 0; c < W; c++) {
      let ch = row[c] ?? '.';
      if (ch === '.') continue;
      let x = dir === 'left' ? W - 1 - c : c;
      // the face looks the way it walks; from behind there is no face
      if (art.face?.includes(ch)) {
        if (dir === 'up') {
          put(ox + x, oy + r, art.back ?? art.colors[ch]);
          continue;
        }
        if (dir === 'left') x -= 1;
        if (dir === 'right') x += 1;
      }
      if (legs) x += c < W / 2 ? swing : -swing;
      ch = ch in art.colors ? ch : '.';
      if (ch !== '.') put(ox + x, oy + r, art.colors[ch]);
    }
  }
  const layers = [...by.entries()].map(([color, path]) => ({ color, path }));
  CACHE.set(key, layers);
  return layers;
}

/** The beings that live in each rift world (by its id). */
export const BEINGS: Record<string, Creature[]> = {
  rift_spring: ['seedling', 'gardener', 'seedling'],
  rift_summer: ['saltwalker', 'beetle', 'saltwalker'],
  rift_autumn: ['owl', 'clockfox', 'owl'],
  rift_winter: ['lantern', 'moth', 'deer', 'shade'],
};

/** Which being lives a resident's day on the other side of the town (the same one every time). */
export function mirrorBeing(seed: number): Creature {
  const k = BEINGS.rift_winter;
  return k[Math.abs(seed) % k.length];
}

/** A burning torch held up, or a pitchfork, over a person's sprite (the mob of the eerie night). */
export function carried(kind: 'torch' | 'pitchfork', dir: Dir, t: number): Layer[] {
  const out: Layer[] = [];
  const side = dir === 'left' ? 8 : dir === 'up' ? 21 : 22;
  if (kind === 'torch') {
    out.push({ color: '#5a3a22', path: `M${side} 9h1v10h-1z` });
    const f = Math.floor(t * 9) % 3;
    out.push({ color: '#ff7a1a', path: `M${side - 1} ${6 - (f === 1 ? 1 : 0)}h3v3h-3z` });
    out.push({ color: '#ffd27a', path: `M${side} ${5 - f % 2}h1v3h-1z` });
  } else {
    out.push({ color: '#6a4a2a', path: `M${side} 6h1v15h-1z` });
    out.push({ color: '#8a8f99', path: `M${side - 2} 5h5v1h-5zM${side - 2} 2h1v3h-1zM${side} 2h1v3h-1zM${side + 2} 2h1v3h-1z` });
  }
  return out;
}
