// The town's quieter places on screen: on the full-moon night a ring of people round the fire of the old forest
// circle, palms together, turning slowly round it (from eight in the evening to one past midnight); and in the
// temple, on the days its bowls are filled, a few people sitting cross-legged on the cushions and one standing at
// the offerings with palms together. Pure functions of the place, the calendar and the clock.

import type { Look } from './character';
import { DEFAULT_LOOK } from './character';
import type { SiteDef } from './types';
import { t } from './i18n';

export interface FaithFigure {
  id: string;
  x: number;
  y: number;
  look: Look;
  pose: 'pray' | 'lotus' | 'idle';
  dir: 'down' | 'up' | 'left' | 'right';
  /** The way they face on the map (a step on the grid): the fire, the altar. The screen turns it with the view. */
  face: [number, number];
  emote: string | null;
  role: 'rite' | 'devotee';
}

const LINEN = ['#f4eedf', '#e8e0c8', '#d8d0bc', '#efe6d0'];
const SASH = ['#d9534f', '#5aa469', '#e8a23a', '#4a8fd0', '#8a63c9'];
const SKINS = ['#f1c9a5', '#e0ac83', '#c68c62', '#f5d6bd', '#8d5a3b'];
const HAIRS = ['#4a2f27', '#1f1a26', '#c9a050', '#7a4a2a', '#9aa0b0', '#d86a3a'];

/** Someone of the circle: a long linen shirt, a coloured sash, a wreath of flowers on some. */
function celebrant(k: number): Look {
  return {
    ...DEFAULT_LOOK,
    skin: SKINS[k % SKINS.length],
    hair: HAIRS[(k * 3) % HAIRS.length],
    hairStyle: (k * 5) % 9,
    topStyle: 4,
    top: LINEN[k % LINEN.length],
    top2: SASH[k % SASH.length],
    bottomStyle: k % 2 ? 4 : 0,
    bottom: k % 2 ? LINEN[(k + 1) % LINEN.length] : '#5a4a3a',
    acc: 0,
  };
}

function devotee(k: number): Look {
  const tops = ['#e8a23a', '#d9534f', '#f4eedf', '#5aa469', '#4a8fd0'];
  return { ...DEFAULT_LOOK, skin: SKINS[(k + 2) % SKINS.length], hair: HAIRS[(k + 1) % HAIRS.length], hairStyle: (k * 7) % 9, topStyle: k % 3, top: tops[k % tops.length], bottom: '#3a3a44', acc: 0 };
}

/** The ring round the fire of the old circle on the full-moon night. */
export function riteFigures(o: { location: string; grove: SiteDef | null | undefined; fullTonight: boolean; fullLastNight: boolean; minuteOfDay: number; time: number }): FaithFigure[] {
  const g = o.grove;
  if (!g || o.location !== 'forest') return [];
  const evening = o.fullTonight && o.minuteOfDay >= 20 * 60;
  const smallHours = o.fullLastNight && o.minuteOfDay < 60;
  if (!evening && !smallHours) return [];
  const [ax, ay, aw, ah] = g.area ?? [g.x - 3, g.y - 2, 7, 4];
  // the fire is in the middle of the circle's ground
  const cx = ax + aw / 2;
  const cy = ay + ah / 2;
  const n = 9;
  const turn = (o.time / 40) % (Math.PI * 2);
  const out: FaithFigure[] = [];
  for (let k = 0; k < n; k++) {
    const a = turn + (k / n) * Math.PI * 2;
    const r = 2.6 + (k % 2) * 0.35;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.85;
    // facing the fire
    const dx = cx - x;
    const dy = cy - y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    // most with palms together; now and then one raises the song
    const singing = Math.floor(o.time / 3 + k) % 7 === 0;
    const face: [number, number] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    out.push({ id: `rite:${k}`, x, y, look: celebrant(k), pose: k % 3 === 2 && !singing ? 'idle' : 'pray', dir, face, emote: singing ? 'play_music' : null, role: 'rite' });
  }
  return out;
}

/** People at the temple on the days the offerings are brought (seven in the morning to seven in the evening). */
export function templeFigures(o: { location: string; offerings: boolean; minuteOfDay: number; day: number }): FaithFigure[] {
  if (o.location !== 'temple_in' || !o.offerings) return [];
  if (o.minuteOfDay < 7 * 60 || o.minuteOfDay >= 19 * 60) return [];
  const hour = Math.floor(o.minuteOfDay / 60);
  // who sits on the cushions changes through the day; the cushions are at (1..2, 4..5) and (6..7, 4..5)
  const cushions: [number, number][] = [[1.5, 4.5], [2.5, 5.5], [6.5, 4.5], [7.5, 5.5], [2.5, 4.5], [6.5, 5.5]];
  const sitting = 1 + ((o.day + hour) % 3);
  const out: FaithFigure[] = [];
  for (let k = 0; k < sitting; k++) {
    const [x, y] = cushions[(o.day * 2 + hour + k * 2) % cushions.length];
    out.push({ id: `devotee:${k}`, x, y, look: devotee(o.day + k * 3 + hour), pose: 'lotus', dir: 'up', face: [0, -1], emote: null, role: 'devotee' });
  }
  // one at the offering table, palms together
  const left = (o.day + hour) % 2 === 0;
  out.push({ id: 'devotee:offer', x: left ? 2.5 : 7.5, y: 2.6, look: devotee(o.day + hour + 7), pose: 'pray', dir: 'up', face: [0, -1], emote: null, role: 'devotee' });
  return out;
}

/** What they say when tapped. */
export function faithLine(role: 'rite' | 'devotee', k: number): string {
  const lines = {
    rite: [
      'faiths.rite1',
      'faiths.rite2',
      'faiths.rite3',
    ],
    devotee: [
      'faiths.devotee1',
      'faiths.devotee2',
      'faiths.devotee3',
    ],
  };
  const list = lines[role];
  return t(list[Math.abs(k) % list.length]);
}
