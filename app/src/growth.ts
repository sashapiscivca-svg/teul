// The growing town on screen (crates/teul-core/src/growth.rs): where the ice-cream cart stands this hour, and the
// people at work on it — builders on the building sites, a mender on a ladder by a worn building, workers on an
// empty house being mended, movers carrying boxes from the van, the ice-cream seller and the children queueing.
// Pure functions of the catalog, the town's flags and the time: the same on every device.

import type { Look } from './character';
import { DEFAULT_LOOK } from './character';
import type { GrowthDef } from './types';
import { t } from './i18n';

/** The stop of the ice-cream cart at a minute of the day (its flag `cart:<i>`), or null when it is not out. */
export function cartStop(growth: GrowthDef | null | undefined, flags: readonly string[], minuteOfDay: number): number | null {
  const cart = growth?.cart;
  if (!cart || !cart.spots.length || !flags.includes('icecream')) return null;
  const hour = Math.floor(minuteOfDay / 60);
  if (hour < cart.hours[0] || hour >= cart.hours[1]) return null;
  return Math.floor((hour - cart.hours[0]) / 3) % cart.spots.length;
}

/** The town's flags with the cart's stop of the hour added (map props show by them). */
export function withCartFlag(growth: GrowthDef | null | undefined, flags: readonly string[], minuteOfDay: number): string[] {
  const stop = cartStop(growth, flags, minuteOfDay);
  return stop === null ? [...flags] : [...flags, `cart:${stop}`];
}

export type GrowthRole = 'builder' | 'mender' | 'mover' | 'seller' | 'kid';

export interface GrowthFigure {
  id: string;
  x: number;
  y: number;
  look: Look;
  pose: 'idle' | 'work' | 'eat';
  dir: 'down' | 'up' | 'left' | 'right';
  emote: string | null;
  role: GrowthRole;
  child?: boolean;
}

const VEST = '#e8a23a';
const BUILDER: Look = { ...DEFAULT_LOOK, hairStyle: 0, hair: '#4a2f27', topStyle: 0, top: VEST, top2: '#f4d35e', bottom: '#2f3a5a', bottomStyle: 0, shoes: '#3a2a40', shoeStyle: 1, acc: 0 };
const SELLER: Look = { ...DEFAULT_LOOK, hairStyle: 3, hair: '#c9a050', topStyle: 4, top: '#ffffff', top2: '#f4b6c8', bottom: '#4a8fd0', acc: 0 };
const KID_TOPS = ['#d9534f', '#5aa469', '#4a8fd0', '#f4d35e', '#d86aa0', '#8a63c9'];
const KID_HAIR = ['#4a2f27', '#c9a050', '#1f1a26', '#d86a3a'];

function vary(base: Look, k: number): Look {
  const skins = ['#f1c9a5', '#e0ac83', '#c68c62', '#f5d6bd'];
  const hairs = ['#4a2f27', '#1f1a26', '#7a4a2a', '#9aa0b0'];
  return { ...base, skin: skins[k % skins.length], hair: hairs[(k * 3) % hairs.length], beard: k % 3 === 1 ? 2 : 0 };
}

function kid(k: number): Look {
  return { ...DEFAULT_LOOK, hairStyle: (k * 5) % 9, hair: KID_HAIR[k % KID_HAIR.length], topStyle: k % 3, top: KID_TOPS[k % KID_TOPS.length], bottom: KID_TOPS[(k + 2) % KID_TOPS.length], bottomStyle: k % 2 };
}

/** Who is at work on the town's buildings in `location` at this minute, and the cart's seller and its queue. */
export function growthFigures(growth: GrowthDef | null | undefined, location: string, flags: readonly string[], minuteOfDay: number, day: number): GrowthFigure[] {
  if (!growth) return [];
  const out: GrowthFigure[] = [];
  const has = new Set(flags);
  const hour = minuteOfDay / 60;
  const working = hour >= 8 && hour < 17 && !(hour >= 12 && hour < 13);
  // builders: two on a site while it is being built (none while it stalls), a lunch hour off
  for (const [k, s] of growth.sites.entries()) {
    if (s.location !== location) continue;
    if (working && has.has(`grow:${s.id}:work`)) {
      out.push({ id: `grow:${s.id}:0`, x: s.x + 0.5, y: s.y + 0.4, look: vary(BUILDER, k), pose: 'work', dir: 'up', emote: null, role: 'builder' });
      out.push({ id: `grow:${s.id}:1`, x: s.x - 1.2, y: s.y + 0.6, look: vary(BUILDER, k + 1), pose: (day + k) % 2 ? 'work' : 'idle', dir: 'left', emote: null, role: 'builder' });
    }
    if (hour >= 9 && hour < 18 && has.has(`grow:${s.id}:moving`)) {
      out.push({ id: `move:${s.id}:0`, x: s.x - 0.6, y: s.y + 0.2, look: vary(BUILDER, k + 2), pose: 'idle', dir: 'up', emote: 'bag', role: 'mover' });
      out.push({ id: `move:${s.id}:1`, x: s.x + 1.4, y: s.y + 0.5, look: { ...vary(BUILDER, k + 3), top: '#4a8fd0' }, pose: 'idle', dir: 'left', emote: 'bag', role: 'mover' });
    }
  }
  // a mender by the ladder of a worn building
  for (const [k, w] of growth.wear.entries()) {
    if (w.location === location && working && has.has(`fix:${w.id}`)) {
      out.push({ id: `fix:${w.id}`, x: w.x + 0.5, y: w.y + 0.85, look: vary(BUILDER, k + 5), pose: 'work', dir: 'up', emote: null, role: 'mender' });
    }
  }
  // workers mending an empty house before new people move in
  for (const [k, a] of growth.abandon.entries()) {
    if (a.location === location && working && has.has(`mend:${a.id}`)) {
      out.push({ id: `mend:${a.id}:0`, x: a.x + 0.5, y: a.y + 0.6, look: vary(BUILDER, k + 7), pose: 'work', dir: 'up', emote: null, role: 'builder' });
      out.push({ id: `mend:${a.id}:1`, x: a.x + 1.6, y: a.y + 0.8, look: vary(BUILDER, k + 8), pose: 'idle', dir: 'up', emote: null, role: 'builder' });
    }
  }
  // the ice-cream seller behind the cart, and children in a queue before it (more of them in the afternoon)
  const cart = growth.cart;
  const stop = cartStop(growth, flags, minuteOfDay);
  if (cart && stop !== null && cart.location === location) {
    const s = cart.spots[stop];
    out.push({ id: 'cart:seller', x: s.x + 1.9, y: s.y + 0.4, look: SELLER, pose: 'idle', dir: 'left', emote: Math.floor(minuteOfDay / 7) % 5 === 0 ? 'talk' : null, role: 'seller' });
    const kids = 2 + ((day + stop + Math.floor(minuteOfDay / 40)) % (hour >= 14 ? 3 : 2));
    for (let i = 0; i < kids; i++) {
      const eating = i === kids - 1 && kids > 2;
      out.push({ id: `cart:kid${i}`, x: s.x + 0.5 + (i % 2) * 0.4, y: s.y + 1.3 + i * 0.7, look: kid(day + i * 3 + stop), pose: eating ? 'eat' : 'idle', dir: eating ? 'down' : 'up', emote: null, role: 'kid', child: true });
    }
  }
  return out;
}

/** What someone at work says when tapped. */
export function growthLine(role: GrowthRole, k: number): string {
  const lines: Record<GrowthRole, string[]> = {
    builder: ['growth.builder1', 'growth.builder2', 'growth.builder3'],
    mender: ['growth.mender1', 'growth.mender2', 'growth.mender3'],
    mover: ['growth.mover1', 'growth.mover2'],
    seller: ['growth.seller1', 'growth.seller2'],
    kid: ['growth.kid1', 'growth.kid2', 'growth.kid3'],
  };
  const list = lines[role];
  return t(list[Math.abs(k) % list.length]);
}
