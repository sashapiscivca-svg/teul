// What the townsfolk hold once new things have come to the town: a smartphone looked at on a bench, held to the
// ear walking, raised to take a picture at a feast; a laptop open on the café table. Drawn on the figures' own
// 32x32 grid in the same pixel style, in front of the figure.

import { propLayers, type Dir } from './character';
import type { Layer } from './sprites';

export type Gadget = 'phone' | 'call' | 'photo' | 'laptop';

const CASE = '#2a2a34';
const GLOW = '#9ad8ff';
const LID = '#b8bcc8';
const KEYS = '#5a5e6a';

/** The gadget in someone's hands (or on the table before them), for the way they face. */
export function gadgetLayers(kind: Gadget, dir: Dir, sitting: boolean): Layer[] {
  const flip = dir === 'left';
  const side = dir === 'left' || dir === 'right';
  const lift = sitting ? 3 : 0;
  if (kind === 'laptop') {
    if (dir === 'up') return [];
    return propLayers(`gadget|laptop|${side ? 's' : 'd'}`, (c) => {
      if (side) {
        // the lid open toward the person, the keys on the table
        c.r(21, 22, 7, 1, KEYS);
        c.r(26, 16, 1, 6, LID);
        c.r(25, 17, 1, 4, GLOW);
      } else {
        c.r(10, 24, 12, 2, KEYS);
        c.r(10, 19, 12, 5, LID);
        c.r(11, 20, 10, 3, GLOW);
      }
    }, flip);
  }
  if (dir === 'up' && kind !== 'photo') return [];
  return propLayers(`gadget|${kind}|${side ? 's' : 'd'}|${lift}`, (c) => {
    if (kind === 'call') {
      // held to the ear
      if (side) c.r(18, 8, 2, 4, CASE);
      else c.r(22, 9, 2, 4, CASE);
    } else if (kind === 'photo') {
      // raised before the face, the screen toward the person
      if (side) {
        c.r(21, 7, 2, 5, CASE);
      } else {
        c.r(13, 6, 6, 4, CASE);
        c.r(14, 7, 4, 2, GLOW);
      }
    } else {
      // looked at, low in the hands, a glow on the face
      if (side) {
        c.r(20, 17 + lift, 3, 2, CASE);
        c.p(20, 17 + lift, GLOW);
      } else {
        c.r(14, 18 + lift, 4, 3, CASE);
        c.r(15, 18 + lift, 2, 2, GLOW);
      }
    }
  }, flip);
}

/**
 * What someone holds now (null: nothing): a pure choice from who they are, where, and the minute — so it stays put
 * for a while and is the same on every device. `phone`/`laptop`: they have one; `cafe`: they sit at the café;
 * `feast`: a festive day out on the square.
 */
export function gadgetOf(o: { phone: boolean; laptop: boolean; walking: boolean; seated: boolean; cafe: boolean; feast: boolean; working: boolean; seed: number; minute: number }): Gadget | null {
  // at the café a laptop sits open on the table before them (or on the high bar table)
  if (o.laptop && o.cafe && !o.walking) return 'laptop';
  if (!o.phone || o.working) return null;
  // a few minutes of this, a few of that, by the person
  const slot = Math.floor((o.minute + (o.seed % 13) * 7) / 6);
  const pick = (slot * 2654435761 + o.seed) >>> 0;
  if (o.walking) return pick % 9 === 0 ? 'call' : null;
  if (o.feast && pick % 4 === 0) return 'photo';
  if (o.seated) return pick % 3 !== 2 ? 'phone' : null;
  return pick % 5 === 0 ? 'phone' : null;
}
